import { describe, expect, it } from 'vitest';
import { getStoreAdminPath } from '../utils/adminStoreNavigation';

describe('사업자 대시보드 바로가기 경로', () => {
  it('메뉴 관리와 테이블 관리를 각 전용 화면으로 분리한다', () => {
    expect(getStoreAdminPath(3, 'menu')).toBe('/admin/stores/3/menu');
    expect(getStoreAdminPath(3, 'tables')).toBe('/admin/stores/3/tables');
  });

  it('메뉴판 편집 경로를 매장 테마 설정 경로와 혼동하지 않는다', () => {
    expect(getStoreAdminPath(3, 'visual-builder')).toBe('/admin');
    expect(getStoreAdminPath(3, 'settings')).toBe('/admin');
  });

  it('매장 식별자 없이 잘못된 관리 URL을 만들지 않는다', () => {
    expect(getStoreAdminPath(undefined, 'menu')).toBe('/admin/stores/new');
    expect(getStoreAdminPath('undefined', 'tables')).toBe('/admin');
  });
});
