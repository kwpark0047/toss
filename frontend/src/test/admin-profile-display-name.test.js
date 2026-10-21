import { describe, expect, it } from 'vitest';
import { resolveAdminProfileDisplayName } from '../utils/adminMenuAccess';

describe('resolveAdminProfileDisplayName', () => {
  it('shows the registered store name for a business account instead of the generic signup name', () => {
    expect(
      resolveAdminProfileDisplayName({
        role: 'user',
        storeName: '모락모락',
        userName: '위마켓 회원',
      })
    ).toBe('모락모락');
  });

  it('keeps the personal profile name for a super admin', () => {
    expect(
      resolveAdminProfileDisplayName({
        role: 'super_admin',
        storeName: '모락모락',
        userName: '최고관리자',
      })
    ).toBe('최고관리자');
  });

  it('falls back to the personal name when the account has not created a store', () => {
    expect(resolveAdminProfileDisplayName({ role: 'user', userName: '위마켓 회원' })).toBe(
      '위마켓 회원'
    );
  });
});
