// Transport credentials exist only in memory. Legacy voice is the failure path.
export class LiveClient {
  constructor({
    issue,
    url,
    beforeConnect,
    WebSocketClass = WebSocket,
    onEvent = () => {},
    onFallback = () => {},
  }) {
    Object.assign(this, { issue, url, beforeConnect, WebSocketClass, onEvent, onFallback });
    this.generation = 0;
    this.confirmed = new Set();
    this.seenDrafts = new Set();
  }
  state(state) {
    if (['CONNECTING', 'TOOL_CALLING', 'IDLE', 'FALLBACK'].includes(state)) this.invalidateDraft();
    this.currentState = state;
    this.onEvent({ type: 'state', state });
  }
  start(options) {
    if (this.starting) return this.starting;
    if (this.socket) return Promise.resolve();
    const generation = ++this.generation;
    this.state('CONNECTING');
    this.starting = (async () => {
      try {
        const session = await this.issue(options, crypto.randomUUID());
        if (generation !== this.generation) return;
        if (this.beforeConnect) await this.beforeConnect();
        if (generation !== this.generation) return;
        const socket = new this.WebSocketClass(this.url);
        this.socket = socket;
        this.sessionId = session.sessionId;
        await new Promise((resolve, reject) => {
          this.rejectStart = reject;
          this.timeout = setTimeout(() => reject(Error('Live timeout')), 10000);
          socket.onopen = () => {
            if (generation === this.generation)
              socket.send(
                JSON.stringify({
                  type: 'auth',
                  sessionId: session.sessionId,
                  ticket: session.ticket,
                })
              );
            session.ticket = null;
          };
          socket.onmessage = (event) => {
            if (generation !== this.generation) return;
            try {
              const message = JSON.parse(event.data);
              if (message.type === 'transcript' && message.direction === 'inputTranscription')
                this.invalidateDraft();
              if (message.type === 'draftInvalidated') this.invalidateDraft();
              if (message.type === 'interrupted') this.invalidateDraft();
              if (message.type === 'fallback') throw Error('Live unavailable');
              if (message.type === 'state') {
                this.state(message.state);
                if (message.state === 'LISTENING') {
                  clearTimeout(this.timeout);
                  this.rejectStart = null;
                  resolve();
                }
              } else if (message.type === 'draft') {
                const id =
                  message.draftId ||
                  `${this.sessionId}:${(this.revision = (this.revision || 0) + 1)}`;
                if (this.confirmed.has(id) || this.seenDrafts.has(id)) return;
                this.seenDrafts.add(id);
                this.draftId = id;
                this.draft = { ...message.draft, draftId: id };
                this.onEvent({ type: 'draft', draft: this.draft });
              } else this.onEvent(message);
            } catch {
              reject(Error('Live unavailable'));
              this.fallback();
            }
          };
          socket.onerror = () => {
            reject(Error('Live unavailable'));
            this.fallback();
          };
          socket.onclose = () => {
            reject(Error('Live disconnected'));
            if (generation === this.generation) this.fallback();
          };
        });
      } catch {
        if (generation === this.generation) this.fallback();
      } finally {
        if (generation === this.generation) this.starting = null;
      }
    })();
    return this.starting;
  }
  send(type, value) {
    if (type === 'text') this.invalidateDraft();
    if (this.socket?.readyState !== 1 || this.currentState === 'CONNECTING') return;
    if (this.socket.bufferedAmount > 64000) {
      this.fallback();
      return;
    }
    this.socket.send(JSON.stringify({ type, ...value }));
  }
  confirmDraft(id, apply) {
    if (
      !this.draft ||
      id !== this.draftId ||
      this.draft.needs_clarification ||
      this.confirmed.has(id)
    )
      return false;
    const draft = this.draft;
    this.confirmed.add(id);
    this.draft = null;
    this.draftId = null;
    apply(draft);
    return true;
  }
  invalidateDraft() {
    this.draft = null;
    this.draftId = null;
    this.onEvent({ type: 'draftInvalidated' });
  }
  fallback() {
    if (this.currentState === 'FALLBACK') return;
    this.stop();
    this.state('FALLBACK');
    this.onFallback();
  }
  stop() {
    this.generation++;
    clearTimeout(this.timeout);
    this.rejectStart?.(Error('Stopped'));
    this.rejectStart = null;
    const socket = this.socket;
    this.socket = null;
    this.starting = null;
    this.draft = null;
    this.draftId = null;
    this.confirmed.clear();
    this.seenDrafts.clear();
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
    }
    this.state('IDLE');
  }
}
