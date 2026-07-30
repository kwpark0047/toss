import { beforeEach, describe, expect, it } from 'vitest';

import {
  getCustomerOrderCapability,
  getOrderCapability,
  getReservationCapabilities,
  getReservationCapability,
  saveOrderCapability,
  saveReservationCapability,
} from '../utils/customerCapabilities';

describe('customer capability storage', () => {
  beforeEach(() => localStorage.clear());

  it('stores an order capability by resource and customer scope', () => {
    saveOrderCapability(
      { id: 10, store_id: 3, order_capability: 'order-token' },
      { customer_phone: '010-1234-5678' }
    );

    expect(getOrderCapability(10)).toBe('order-token');
    expect(getCustomerOrderCapability({ phone: '01012345678', storeId: 3 })).toBe('order-token');
    expect(getCustomerOrderCapability({ phone: '01012345678', storeId: 4 })).toBeNull();
    expect(getCustomerOrderCapability({ phone: '01099999999', storeId: 3 })).toBeNull();
  });

  it('keeps reservation capabilities separate by reservation and phone', () => {
    saveReservationCapability(
      { id: 20, reservation_capability: 'reservation-token' },
      '010-1234-5678'
    );

    expect(getReservationCapability(20)).toBe('reservation-token');
    expect(getReservationCapabilities('01012345678')).toEqual(['reservation-token']);
    expect(getReservationCapabilities('01099999999')).toEqual([]);
  });
});
