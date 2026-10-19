import { describe, expect, it } from 'vitest';
import {
  formatCustomerPhone,
  getPhoneDigits,
  isValidCustomerMobilePhone,
} from '../utils/customerPhone';

describe('customer notification phone input', () => {
  it('formats digits while preserving only a Korean mobile number', () => {
    expect(formatCustomerPhone('01012345678')).toBe('010-1234-5678');
    expect(getPhoneDigits('010-1234-5678')).toBe('01012345678');
    expect(isValidCustomerMobilePhone('010-1234-5678')).toBe(true);
  });

  it.each(['010-12', '0212345678', '010123456789'])(
    'rejects malformed or non-mobile value %s',
    (value) => {
      expect(isValidCustomerMobilePhone(value)).toBe(false);
    }
  );
});

