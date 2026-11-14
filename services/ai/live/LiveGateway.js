const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');
const { ToolRegistry } = require('./ToolRegistry');
const { GeminiLiveProvider } = require('./GeminiLiveProvider');
const { usageCost } = require('./LivePolicy');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
class LiveGateway {
  constructor({ policy, store, catalog, summary, authorize, providerFactory, clock = Date.now }) {
    Object.assign(this, { policy, store, catalog, summary, authorize, clock });
    this.providerFactory =
      providerFactory ||
      (() => new GeminiLiveProvider({ apiKey: policy.apiKey, allowPaid: policy.allowPaid }));
    this.connections = new Set();
  }
  async issue({ storeId, purpose, consent, origin, user, ip, idempotencyKey }) {
    if (!this.policy.enabled || !this.policy.allowPaid)
      throw Error('Live disabled; use existing voice ordering');
    if (
      !this.policy.origins.includes(origin) ||
      !Number.isSafeInteger(storeId) ||
      !['customer', 'manager'].includes(purpose) ||
      consent !== true ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(idempotencyKey || '')
    )
      throw Error('Live request forbidden');
    const limits = this.policy.stores[storeId];
    if (!limits?.enabled) throw Error('Store Live disabled');
    await this.authorize(storeId, purpose, user);
    const now = this.clock();
    const day = new Date(now + 9 * 3600000).toISOString().slice(0, 10),
      month = day.slice(0, 7);
    const seconds = Math.min(
      limits.sessionSeconds,
      Math.floor((Date.parse(day + 'T23:59:59+09:00') - now) / 1000) - 30
    );
    if (seconds < 10) throw Error('Live daily boundary; retry later');
    const principal = purpose === 'manager' ? `user:${user.id}` : `visitor:${hash(String(ip))}`;
    const id = crypto
      .createHmac('sha256', this.policy.secret)
      .update(JSON.stringify([month, storeId, purpose, principal, idempotencyKey]))
      .digest('hex');
    const ticket = crypto
      .createHmac('sha256', this.policy.secret)
      .update('ticket:' + id)
      .digest('hex');
    const session = await this.store.reserve({
      id,
      storeId,
      purpose,
      actorId: purpose === 'manager' ? user.id : null,
      actorSid: purpose === 'manager' ? user.sid : null,
      origin,
      month,
      day,
      model: this.policy.model,
      pricingVersion: this.policy.pricing.version,
      seconds,
      state: 'ready',
      ticketHash: hash(ticket),
      ticketExpires: now + 30000,
      deadline: now + 30000 + seconds * 1000,
      reservation: limits.reservationMicros,
      monthLimit: limits.monthlyLimitMicros,
      dayLimit: limits.dailySeconds,
      concurrency: limits.concurrency,
    });
    if (session.state !== 'ready' || session.ticketExpires < now)
      throw Error('Live request already consumed or expired');
    return {
      sessionId: id,
      ticket,
      expiresAt: session.ticketExpires,
      seconds: session.seconds,
      connectPath: '/api/ai/live/connect',
    };
  }
  attach(server) {
    const wss = new WebSocketServer({
      noServer: true,
      maxPayload: 24000,
      perMessageDeflate: false,
    });
    const upgrade = (req, socket, head) => {
      let url;
      try {
        url = new URL(req.url, 'http://localhost');
      } catch {
        return;
      }
      if (url.pathname !== '/api/ai/live/connect') return;
      if (
        !this.policy.enabled ||
        !this.policy.allowPaid ||
        url.search ||
        !this.policy.origins.includes(req.headers.origin)
      ) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => this.handle(ws, req.headers.origin));
    };
    server.on('upgrade', upgrade);
    return async () => {
      server.off('upgrade', upgrade);
      await Promise.allSettled([...this.connections].map((c) => c()));
      wss.close();
    };
  }
  handle(ws, origin) {
    let session,
      provider,
      registry,
      stopped = false,
      authenticated = false,
      authenticating = false,
      estimate = 0,
      handle,
      reconnects = 0,
      reconnecting = false;
    let incomingBytes = 0,
      outgoingBytes = 0,
      textChars = 0,
      turns = 0,
      started = this.clock(),
      lastActivity = started;
    let usageQueue = Promise.resolve(),
      pendingEvents = 0,
      usageSequence = 0;
    const publishedDrafts = new Set();
    let draftRevision = 0;
    const send = (value) => {
      if (ws.readyState === 1) {
        if (ws.bufferedAmount > 192000) throw Error('Live backpressure');
        ws.send(JSON.stringify(value));
      }
    };
    const close = async (reason = 'closed') => {
      if (stopped) return;
      stopped = true;
      clearTimeout(authTimer);
      clearInterval(timer);
      provider?.close();
      this.connections.delete(close);
      try {
        if (session) await this.store.finish(session, estimate, reason);
      } finally {
        ws.close(1000, 'Use existing voice ordering');
      }
    };
    this.connections.add(close);
    const fail = () => {
      try {
        send({
          type: 'fallback',
          message: '실시간 연결을 종료했어요. 기존 음성 주문이나 텍스트를 이용해 주세요.',
        });
      } finally {
        void close('fallback').catch(() => ws.terminate());
      }
    };
    const authTimer = setTimeout(fail, 5000);
    const timer = setInterval(() => {
      if (
        authenticated &&
        (this.clock() - started >= session.seconds * 1000 || this.clock() - lastActivity > 30000)
      )
        fail();
    }, 1000);
    timer.unref?.();
    authTimer.unref?.();
    const emit = (event) => {
      if (stopped) return;
      if (
        event.type === 'interrupted' ||
        (event.type === 'transcript' && event.direction === 'inputTranscription')
      ) {
        draftRevision++;
        try {
          send({ type: 'draftInvalidated' });
        } catch {
          fail();
          return;
        }
      }
      const eventRevision = draftRevision;
      // Cancellation must be observed even while a read-only tool is awaiting its result.
      if (event.type === 'toolCancel') {
        registry.cancel(event.ids);
        return;
      }
      if (++pendingEvents > 128) {
        fail();
        return;
      }
      usageQueue = usageQueue
        .then(async () => {
          if (stopped) return;
          if (event.type === 'usage') {
            // Charge each provider usage report, including repeated context. Conservative duplicates
            // may close early; they can never create free credit. Client usage messages are forbidden.
            const cost = usageCost(event.usage, this.policy.pricing);
            estimate += cost;
            await this.store.recordUsage(session, ++usageSequence, event.usage, cost);
            if (!Number.isSafeInteger(estimate) || estimate >= session.reservation) {
              await close('budget');
              return;
            }
          } else if (event.type === 'audio') {
            outgoingBytes += Buffer.from(event.data || '', 'base64').length;
            if (outgoingBytes > session.seconds * 48000) throw Error('Live output limit');
            send(event);
          } else if (event.type === 'resumeHandle') handle = event.handle;
          else if (event.type === 'goAway') {
            if (!handle || ++reconnects > 2 || reconnecting) throw Error('Live resume unavailable');
            reconnecting = true;
            send({ type: 'state', state: 'CONNECTING' });
            await new Promise((resolve) =>
              setTimeout(resolve, 100 * 2 ** (reconnects - 1) + crypto.randomInt(0, 100))
            );
            if (stopped) return;
            await provider.resume(
              { model: session.model, tools: registry.declarations, handle },
              emit
            );
            if (stopped) {
              provider.close();
              return;
            }
            reconnecting = false;
            send({ type: 'state', state: 'LISTENING' });
          } else if (event.type === 'toolCall') {
            if (event.calls.length > 8) throw Error('Live tool limit');
            send({ type: 'state', state: 'TOOL_CALLING' });
            for (const call of event.calls) {
              await this.authorize(
                session.storeId,
                session.purpose,
                session.actorId ? { id: session.actorId, sid: session.actorSid } : null
              );
              await this.store.auditTool(session, call, 'running');
              let result;
              let status = 'completed';
              try {
                result = await registry.execute(call);
              } catch {
                result = { error: 'Tool rejected or cancelled' };
                status = 'rejected';
              }
              await this.store.auditTool(session, call, status);
              if (!stopped) provider.sendToolResult(call, { result });
              if (
                !stopped &&
                eventRevision === draftRevision &&
                call.name === 'validate_order_draft' &&
                result.success &&
                !publishedDrafts.has(call.id)
              ) {
                publishedDrafts.add(call.id);
                send({ type: 'draft', draftId: `${session.id}:${call.id}`, draft: result });
              }
            }
          } else if (['error', 'disconnected'].includes(event.type))
            throw Error('Live disconnected');
          else if (event.type === 'turnComplete') {
            if (++turns > 20) throw Error('Live turn limit');
            send({ type: 'state', state: 'LISTENING' });
          } else send(event);
        })
        .catch(fail)
        .finally(() => {
          pendingEvents--;
        });
    };
    ws.on('message', async (data, binary) => {
      try {
        if (binary || stopped) throw Error('Invalid Live message');
        const message = JSON.parse(data.toString());
        if (!authenticated) {
          if (
            authenticating ||
            message.type !== 'auth' ||
            typeof message.ticket !== 'string' ||
            message.ticket.length !== 64
          )
            throw Error('Live authentication failed');
          authenticating = true;
          session = await this.store.claim(message.sessionId, hash(message.ticket), origin);
          if (stopped) {
            await this.store.finish(session, 0, 'auth-timeout');
            return;
          }
          await this.authorize(
            session.storeId,
            session.purpose,
            session.actorId ? { id: session.actorId, sid: session.actorSid } : null
          );
          registry = new ToolRegistry({
            storeId: session.storeId,
            purpose: session.purpose,
            catalog: this.catalog,
            summary: this.summary,
          });
          provider = this.providerFactory();
          await provider.connect({ model: session.model, tools: registry.declarations }, emit);
          if (stopped) {
            provider.close();
            return;
          }
          authenticated = true;
          started = this.clock();
          lastActivity = started;
          clearTimeout(authTimer);
          send({ type: 'state', state: 'LISTENING' });
          return;
        }
        if (reconnecting) return;
        lastActivity = this.clock();
        if (message.type === 'audio') {
          if (
            typeof message.data !== 'string' ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(message.data) ||
            message.data.length % 4
          )
            throw Error('Invalid PCM');
          const bytes = Buffer.from(message.data, 'base64').length;
          incomingBytes += bytes;
          if (
            !bytes ||
            bytes % 2 ||
            bytes > 16000 ||
            incomingBytes > Math.min(session.seconds * 32000, (this.clock() - started) * 32 + 32000)
          )
            throw Error('Live audio limit');
          provider.sendAudio(message.data);
        } else if (message.type === 'text') {
          if (
            typeof message.text !== 'string' ||
            !message.text.trim() ||
            message.text.length > 500 ||
            (textChars += message.text.length) > 4000
          )
            throw Error('Live text limit');
          draftRevision++;
          send({ type: 'draftInvalidated' });
          provider.sendText(message.text);
        } else if (message.type === 'close') await close('user');
        else throw Error('Unsupported Live message');
      } catch {
        fail();
      }
    });
    ws.on('error', fail);
    ws.on('close', () => {
      void close('disconnect').catch(() => {});
    });
  }
}
module.exports = { LiveGateway };
