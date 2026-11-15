import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAILiveSession } from '../hooks/useAILiveSession';
import api from '../api/client';
import { LiveAudio } from '../utils/live/LiveAudio';
vi.mock('../api/client', () => ({
  default: { defaults: { baseURL: 'https://api.fixture.invalid/api' }, post: vi.fn() },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('keeps streamed caption fragments in order and clears them for the next session', async () => {
  api.post.mockResolvedValue({ data: { sessionId: 'fixture', ticket: 'fixture-ticket' } });
  vi.spyOn(LiveAudio.prototype, 'start').mockResolvedValue();
  class Socket {
    constructor() {
      this.readyState = 1;
      queueMicrotask(() => this.onopen?.());
    }
    send() {
      queueMicrotask(() => {
        this.onmessage({ data: JSON.stringify({ type: 'state', state: 'LISTENING' }) });
        for (const text of ['메뉴를 ', '확인해요'])
          this.onmessage({
            data: JSON.stringify({ type: 'transcript', direction: 'outputTranscription', text }),
          });
      });
    }
    close() {}
  }
  vi.stubGlobal('WebSocket', Socket);
  const { result } = renderHook(() => useAILiveSession());
  await act(async () => {
    await result.current.start({ storeId: 3, purpose: 'customer', consent: true });
  });
  expect(result.current.transcript.output).toBe('메뉴를 확인해요');
  act(() => result.current.stop());
});
it('disabled server falls back without asking for a microphone or opening a websocket', async () => {
  api.post.mockRejectedValueOnce(Error('disabled'));
  const fallback = vi.fn(),
    microphone = vi.fn(),
    ws = vi.spyOn(globalThis, 'WebSocket');
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: microphone },
  });
  const { result } = renderHook(() => useAILiveSession({ onFallback: fallback }));
  await act(async () => {
    await result.current.start({ storeId: 3, purpose: 'customer', consent: true });
  });
  expect(result.current.state).toBe('FALLBACK');
  expect(fallback).toHaveBeenCalledOnce();
  expect(microphone).not.toHaveBeenCalled();
  expect(ws).not.toHaveBeenCalled();
});
it('stopping while issuance is pending ignores the late rejection', async () => {
  let reject;
  api.post.mockImplementationOnce(
    () =>
      new Promise((_r, j) => {
        reject = j;
      })
  );
  const fallback = vi.fn();
  const { result, unmount } = renderHook(() => useAILiveSession({ onFallback: fallback }));
  let starting;
  act(() => {
    starting = result.current.start({ storeId: 3, purpose: 'customer', consent: true });
  });
  act(() => result.current.stop());
  unmount();
  await act(async () => {
    reject(Error('late'));
    await starting;
  });
  expect(fallback).not.toHaveBeenCalled();
});
