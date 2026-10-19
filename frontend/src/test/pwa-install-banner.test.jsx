import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const installState = vi.hoisted(() => ({ canInstall: true, install: vi.fn() }));
vi.mock('@/hooks/usePWA', () => ({
  usePWAInstall: () => installState,
}));

import PWAInstallBanner from '@/components/common/PWAInstallBanner';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  installState.canInstall = true;
  installState.install.mockReset();
});

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PWAInstallBanner />
      <Routes>
        <Route path="*" element={<main data-testid="route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PWA install banner visibility', () => {
  it('shows the install banner during account registration', () => {
    renderAt('/register');

    expect(screen.getByText('위마켓 앱 설치')).toBeInTheDocument();
  });

  it('shows the banner only while the customer registration sheet is open', () => {
    renderAt('/menu/3');
    expect(screen.queryByText('위마켓 앱 설치')).not.toBeInTheDocument();

    act(() => window.dispatchEvent(new CustomEvent('wemarket:customer-registration', { detail: true })));
    expect(screen.getByText('위마켓 앱 설치')).toBeInTheDocument();

    act(() => window.dispatchEvent(new CustomEvent('wemarket:customer-registration', { detail: false })));
    expect(screen.queryByText('위마켓 앱 설치')).not.toBeInTheDocument();
  });

  it.each(['/','/pricing','/menu/1','/admin','/auth'])('hides the banner outside registration at %s', (path) => {
    renderAt(path);

    expect(screen.queryByText('위마켓 앱 설치')).not.toBeInTheDocument();
  });

  it('does not show the banner when the browser cannot install the app', () => {
    installState.canInstall = false;
    renderAt('/register');

    expect(screen.queryByText('위마켓 앱 설치')).not.toBeInTheDocument();
  });

  it('keeps a dismissed banner hidden during the same session', () => {
    sessionStorage.setItem('pwa-banner-dismissed', '1');
    renderAt('/register');

    expect(screen.queryByText('위마켓 앱 설치')).not.toBeInTheDocument();
  });
});

