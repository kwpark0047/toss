import { expect, it, vi } from 'vitest';
import { LiveCamera } from '../utils/live/LiveCamera';
it('does not request a camera before consent and stops tracks granted after cancellation', async () => {
  let resolve;
  const track = { stop: vi.fn() };
  const media = {
    getUserMedia: vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    ),
  };
  const camera = new LiveCamera({ media });
  await expect(camera.start({}, false)).rejects.toThrow();
  expect(media.getUserMedia).not.toHaveBeenCalled();
  const pending = camera.start({}, true);
  camera.stop();
  resolve({ getTracks: () => [track] });
  await pending;
  expect(track.stop).toHaveBeenCalledOnce();
});
it('sends only the current approved frame with a 1fps/session cap and no queue', () => {
  let now = 0;
  const send = vi.fn(() => true);
  const camera = new LiveCamera({ clock: () => now });
  camera.stream = { getTracks: () => [] };
  camera.frame = 'fixture';
  expect(camera.send(send)).toBe(true);
  expect(() => camera.send(send)).toThrow();
  now = 1000;
  camera.frame = 'new';
  camera.send(send);
  expect(send.mock.calls.map((c) => c[0])).toEqual(['fixture', 'new']);
  expect(camera.frame).toBeNull();
  camera.stop();
});
