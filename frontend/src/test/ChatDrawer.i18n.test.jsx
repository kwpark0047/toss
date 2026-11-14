import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import ChatDrawer from '../components/customer/ChatDrawer';

vi.mock('../api', () => ({ chatAPI: {}, getSocket: () => null }));

async function openChat(translation = {}, lng = 'ko') {
  const instance = i18next.createInstance();
  await instance.init({ lng, fallbackLng: false, resources: { [lng]: { translation } } });
  render(
    <I18nextProvider i18n={instance}>
      <ChatDrawer isOpen onClose={() => {}} store={{}} customerInfo={null} />
    </I18nextProvider>
  );
}

describe('customer chat translation fallback', () => {
  it('shows Korean labels when the chat resource is missing', async () => {
    await openChat();
    expect(screen.getByRole('heading', { name: '매장 문의' })).toBeInTheDocument();
    expect(screen.getByText('실시간 상담')).toBeInTheDocument();
    expect(screen.getByText('매장에 궁금한 점을 물어보세요')).toBeInTheDocument();
    expect(screen.getByText('메뉴, 주문, 이용 방법을 문의해 주세요.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('메시지를 입력해 주세요')).toBeInTheDocument();
    expect(screen.queryByText(/^chat\./)).not.toBeInTheDocument();
  });

  it('keeps a supplied translation instead of overriding it with the fallback', async () => {
    await openChat({ chat: { manager_title: 'Contact staff', live_support: 'Live support' } }, 'en');
    expect(screen.getByRole('heading', { name: 'Contact staff' })).toBeInTheDocument();
    expect(screen.getByText('Live support')).toBeInTheDocument();
  });
});
