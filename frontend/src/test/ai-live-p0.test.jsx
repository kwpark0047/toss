import { describe, it, expect, vi } from 'vitest';
import { LiveClient } from '../utils/live/LiveClient';
import { LiveAudio } from '../utils/live/LiveAudio';
class Socket {
  constructor() {
    this.readyState = 1;
    this.bufferedAmount = 0;
    this.sent = [];
    Socket.latest = this;
  }
  send(value) {
    this.sent.push(JSON.parse(value));
  }
  close() {
    this.readyState = 3;
  }
}
describe('P0 live client preserves legacy fallback', () => {
  it('mute disables microphone tracks and discards playback until unmuted', () => {
    const audio = new LiveAudio(), track = { enabled: true };
    audio.stream = { getAudioTracks: () => [track] };
    audio.interrupt = vi.fn();
    audio.setMuted(true);
    expect(track.enabled).toBe(false);
    expect(audio.interrupt).toHaveBeenCalledOnce();
    expect(() => audio.play('invalid base64%%')).not.toThrow();
    audio.setMuted(false);
    expect(track.enabled).toBe(true);
  });
  it('denied microphone preparation never opens a provider websocket', async () => {
    const ws = vi.fn(function () { throw Error('must not open'); }), fallback = vi.fn();
    const client = new LiveClient({ issue: async () => ({ sessionId: 's', ticket: 't' }), beforeConnect: async () => { throw Error('NotAllowedError'); }, WebSocketClass: ws, onFallback: fallback });
    await client.start({}); expect(ws).not.toHaveBeenCalled(); expect(fallback).toHaveBeenCalledTimes(1);
  });
  it('falls back when issuance is disabled without creating a websocket', async () => {
    const fallback = vi.fn();
    const ws = vi.fn();
    const client = new LiveClient({
      issue: async () => {
        throw Error('disabled');
      },
      WebSocketClass: ws,
      onFallback: fallback,
    });
    await client.start({});
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(ws).not.toHaveBeenCalled();
    expect(client.currentState).toBe('FALLBACK');
  });
  it('single-flights start and only applies the latest explicitly confirmed draft once', async () => {
    const issue = vi.fn(async () => ({ sessionId: 'session', ticket: 'private-ticket' }));
    const client = new LiveClient({ issue, url: 'wss://fixture.invalid', WebSocketClass: Socket });
    const start = client.start({});
    expect(client.start({})).toBe(start);
    await Promise.resolve();
    await Promise.resolve();
    const socket = Socket.latest;
    socket.onopen();
    expect(socket.sent[0].type).toBe('auth');
    socket.onmessage({ data: JSON.stringify({ type: 'state', state: 'LISTENING' }) });
    await start;
    socket.onmessage({ data: JSON.stringify({ type: 'draft', draft: { items: [1] } }) });
    const stale = client.draftId;
    socket.onmessage({ data: JSON.stringify({ type: 'draft', draft: { items: [2] } }) });
    const apply = vi.fn();
    expect(client.confirmDraft(stale, apply)).toBe(false);
    const id = client.draftId;
    expect(client.confirmDraft(id, apply)).toBe(true);
    expect(client.confirmDraft(id, apply)).toBe(false);
    expect(apply).toHaveBeenCalledTimes(1);
    client.stop();
    expect(socket.readyState).toBe(3);
    expect(client.currentState).toBe('IDLE');
    expect(issue).toHaveBeenCalledTimes(1);
  });
  it('explicit stop prevents late issuance from reopening a session', async () => {
    let release;
    const ws = vi.fn();
    const fallback = vi.fn();
    const client = new LiveClient({
      issue: () =>
        new Promise((r) => {
          release = r;
        }),
      WebSocketClass: ws,
      onFallback: fallback,
    });
    const start = client.start({});
    client.stop();
    release({ sessionId: 's', ticket: 'private' });
    await start;
    expect(ws).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });
  it('does not reapply a confirmed provider draft when its tool response is repeated', async () => {
    const client = new LiveClient({
      issue: async () => ({ sessionId: 's', ticket: 't' }),
      url: 'wss://fixture.invalid',
      WebSocketClass: Socket,
    });
    const start = client.start({});
    await Promise.resolve();
    await Promise.resolve();
    const socket = Socket.latest;
    socket.onopen();
    socket.onmessage({ data: JSON.stringify({ type: 'state', state: 'LISTENING' }) });
    await start;
    const message = {
      data: JSON.stringify({
        type: 'draft',
        draftId: 'stable-provider-call',
        draft: { items: [] },
      }),
    };
    socket.onmessage(message);
    const apply = vi.fn();
    expect(client.confirmDraft('stable-provider-call', apply)).toBe(true);
    socket.onmessage(message);
    expect(client.confirmDraft('stable-provider-call', apply)).toBe(false);
    expect(apply).toHaveBeenCalledTimes(1);
    client.stop();
  });
  it('releases a microphone stream arriving after stop without creating an AudioContext', async () => {
    let release;
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(
          () =>
            new Promise((r) => {
              release = r;
            })
        ),
      },
    });
    const audio = new LiveAudio();
    const start = audio.start(vi.fn());
    audio.stop();
    release({ getTracks: () => [{ stop: stopTrack }] });
    await start;
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
});
