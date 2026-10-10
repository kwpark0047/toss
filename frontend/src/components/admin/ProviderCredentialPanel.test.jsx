import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProviderCredentialPanel from './ProviderCredentialPanel';
const { api } = vi.hoisted(() => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../api/client', () => ({ default: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [{ provider:'tossplace', label:'토스플레이스 POS', fields:['api_key'], registered:true, configured:true, source:'store', enabled:true, masked:{api_key:'••••1234'}, last_test_status:'untested', adapter:false }] });
  api.put.mockResolvedValue({saved:true});
});
describe('store provider credentials', () => {
  it('shows masked metadata and submits replacement only to the selected store', async () => {
    render(<ProviderCredentialPanel storeId={3} />);
    const input = await screen.findByLabelText('토스플레이스 POS API 키');
    expect(input.value).toBe('');
    expect(input.type).toBe('password');
    expect(screen.getByText('현재 값: ••••1234')).toBeTruthy();
    fireEvent.change(input,{target:{value:'fixture-key-replacement'}});
    fireEvent.click(screen.getByRole('button',{name:'저장',exact:true}));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/provider-credentials/stores/3/tossplace',{api_key:'fixture-key-replacement',enabled:true}));
    await waitFor(() => expect(input.value).toBe(''));
  });
  it('blank fields keep existing keys while allowing deactivation', async () => {
    render(<ProviderCredentialPanel storeId={4} />);
    await screen.findByLabelText('토스플레이스 POS API 키');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button',{name:'저장',exact:true}));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/provider-credentials/stores/4/tossplace',{enabled:false}));
  });
});
