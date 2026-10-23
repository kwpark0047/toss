import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

vi.mock('../api/stores', () => ({
  storesAPI: {
    searchLocation: vi.fn(),
    update: vi.fn(),
  },
}));
// jsdom에서는 Leaflet CDN을 불러오지 않는다 — 지도 오류 상태에서도 검색·저장이 동작해야 한다
vi.mock('../utils/leafletLoader', async (orig) => {
  const actual = await orig();
  return { ...actual, loadLeaflet: vi.fn(() => Promise.reject(new Error('no cdn'))), loadMarkerCluster: vi.fn(() => Promise.reject(new Error('no cdn'))) };
});

import { storesAPI } from '../api/stores';
import { isValidKoreaCoord, externalMapLinks } from '../utils/leafletLoader';
import StoreLocationEditor from '../components/admin/StoreLocationEditor';
import StoreMapLeaflet from '../components/StoreMapLeaflet';

describe('좌표 유틸', () => {
  it('대한민국 범위 숫자 좌표만 유효', () => {
    expect(isValidKoreaCoord(37.5, 127)).toBe(true);
    expect(isValidKoreaCoord('37.5', '127')).toBe(true);
    expect(isValidKoreaCoord(0, 0)).toBe(false);
    expect(isValidKoreaCoord(null, 127)).toBe(false);
    expect(isValidKoreaCoord(NaN, 127)).toBe(false);
    expect(isValidKoreaCoord(35.6, 139.7)).toBe(false);
  });

  it('길찾기 링크에 매장명을 인코딩한다', () => {
    const l = externalMapLinks('카페 & 베이커리', 37.5, 127.1);
    expect(l.kakao).toBe('https://map.kakao.com/link/to/%EC%B9%B4%ED%8E%98%20%26%20%EB%B2%A0%EC%9D%B4%EC%BB%A4%EB%A6%AC,37.5,127.1');
    expect(l.naver).toContain('127.1,37.5');
  });
});

describe('StoreMapLeaflet', () => {
  it('지도 로드 실패 시 오류 안내를 보여준다', async () => {
    render(<StoreMapLeaflet stores={[{ id: 1, name: 'a', latitude: 37.5, longitude: 127 }]} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('지도를 불러오지 못했어요');
  });
});

describe('StoreLocationEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    storesAPI.searchLocation.mockReset();
    storesAPI.update.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  const searchFor = async (text) => {
    fireEvent.change(screen.getByLabelText('주소 또는 건물명 검색'), { target: { value: text } });
    await act(async () => { vi.advanceTimersByTime(450); });
  };

  it('검색어를 디바운스해 한 번만 호출하고, 선택 → 확인 → 저장한다', async () => {
    storesAPI.searchLocation.mockResolvedValue({ data: { results: [{ roadAddress: '서울 중구 세종대로 110', jibunAddress: '서울 중구 태평로1가 31', lat: 37.566317, lng: 126.977829 }] } });
    storesAPI.update.mockResolvedValue({ data: { id: 42 } });
    const onSaved = vi.fn();
    render(<StoreLocationEditor storeId="42" initial={{ address: '옛 주소', latitude: null, longitude: null }} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('주소 또는 건물명 검색'), { target: { value: '세종' } });
    await searchFor('세종대로 110');
    expect(storesAPI.searchLocation).toHaveBeenCalledTimes(1);
    expect(storesAPI.searchLocation.mock.calls[0].slice(0, 2)).toEqual(['42', '세종대로 110']);

    fireEvent.click(await screen.findByText('서울 중구 세종대로 110'));
    expect(screen.getByText('변경 전')).toBeInTheDocument();
    expect(storesAPI.update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('이 위치로 변경'));
    fireEvent.click(screen.getByText('변경 확정'));
    await waitFor(() => expect(storesAPI.update).toHaveBeenCalledWith('42', { address: '서울 중구 세종대로 110', latitude: 37.566317, longitude: 126.977829 }));
    expect(await screen.findByText('매장 위치가 저장되었어요.')).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalled();
  });

  it('결과 없음 / 429 상태를 안내한다', async () => {
    storesAPI.searchLocation.mockResolvedValueOnce({ data: { results: [] } });
    render(<StoreLocationEditor storeId="42" />);
    await searchFor('없는주소');
    expect(await screen.findByText(/검색 결과가 없어요/)).toBeInTheDocument();

    storesAPI.searchLocation.mockRejectedValueOnce({ response: { status: 429 } });
    await searchFor('다른주소');
    expect(await screen.findByText(/검색 요청이 많아요/)).toBeInTheDocument();
  });

  it('저장 권한이 없으면 오류를 보여준다', async () => {
    storesAPI.searchLocation.mockResolvedValue({ data: { results: [{ roadAddress: '서울 a로 1', lat: 37.5, lng: 127 }] } });
    storesAPI.update.mockRejectedValue({ response: { status: 403 } });
    render(<StoreLocationEditor storeId="42" />);
    await searchFor('서울 a로 1');
    fireEvent.click(await screen.findByText('서울 a로 1'));
    fireEvent.click(screen.getByText('이 위치로 변경'));
    fireEvent.click(screen.getByText('변경 확정'));
    expect(await screen.findByText('이 매장의 위치를 변경할 권한이 없어요.')).toBeInTheDocument();
  });
});
