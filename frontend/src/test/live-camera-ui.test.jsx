import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LiveCameraHelper from '../components/ai/LiveCameraHelper';
import { LiveCamera } from '../utils/live/LiveCamera';
afterEach(() => vi.restoreAllMocks());
const live = () => ({
  state: 'LISTENING',
  cameraAllowed: true,
  cameraConsent: vi.fn(() => true),
  sendImage: vi.fn(() => true),
});
it('requires separate camera consent and preview approval before transmitting', async () => {
  const l = live(),
    start = vi.spyOn(LiveCamera.prototype, 'start').mockResolvedValue(true);
  vi.spyOn(LiveCamera.prototype, 'capture').mockReturnValue('ZmFrZQ==');
  vi.spyOn(LiveCamera.prototype, 'send').mockImplementation((send) => send('ZmFrZQ=='));
  render(<LiveCameraHelper live={l} />);
  expect(start).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '카메라 켜기' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '카메라 켜기' })));
  fireEvent.click(screen.getByRole('button', { name: '사진 확인' }));
  expect(l.sendImage).not.toHaveBeenCalled();
  expect(screen.getByAltText('전송 전 사진')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '이 사진 전송' }));
  expect(l.sendImage).toHaveBeenCalledOnce();
});
it('server capability cannot be overridden by browser consent', () => {
  const l = { ...live(), cameraAllowed: false };
  render(<LiveCameraHelper live={l} />);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: '카메라 켜기' })).toBeDisabled();
  expect(l.cameraConsent).not.toHaveBeenCalledWith(true);
});
it('releases the camera on a hidden document, session end and unmount', async () => {
  const stop = vi.spyOn(LiveCamera.prototype, 'stop');
  vi.spyOn(LiveCamera.prototype, 'start').mockResolvedValue(true);
  const l = live();
  const { rerender, unmount } = render(<LiveCameraHelper live={l} />);
  fireEvent.click(screen.getByRole('checkbox'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '카메라 켜기' })));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(stop).toHaveBeenCalled();
  expect(l.cameraConsent).toHaveBeenCalledWith(false);
  rerender(<LiveCameraHelper live={{ ...l, state: 'IDLE' }} />);
  unmount();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
