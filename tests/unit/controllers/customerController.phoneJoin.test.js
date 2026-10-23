process.env.JWT_SECRET = process.env.JWT_SECRET || 'phone-join-test-secret';

const mockPhoneJoin = jest.fn();
jest.mock('../../../services/CustomerService', () => jest.fn(() => ({ phoneJoin: mockPhoneJoin })));
jest.mock('../../../repositories/StoreCustomer', () => ({}));
jest.mock('../../../config/prisma', () => ({}));

const customerController = require('../../../controllers/customerController');
const { createOrderCapability } = require('../../../utils/orderCapability');

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const makeReq = (body, capability) => ({
  body,
  get: (name) => (name === 'x-order-capability' ? capability : undefined),
});

describe('customerController.phoneJoin', () => {
  beforeEach(() => jest.clearAllMocks());
  const body = { phone: '01012345678', store_id: 3, order_id: 41 };

  it('주문 capability 없이 남의 주문 번호로 적립할 수 없다', async () => {
    const res = makeRes();
    await customerController.phoneJoin(makeReq(body, undefined), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockPhoneJoin).not.toHaveBeenCalled();
  });

  it('다른 주문의 capability로는 적립할 수 없다', async () => {
    const res = makeRes();
    const other = createOrderCapability({ id: 99, store_id: 3 });
    await customerController.phoneJoin(makeReq(body, other), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockPhoneJoin).not.toHaveBeenCalled();
  });

  it('본인 주문 capability가 있으면 그 주문·매장 기준으로 적립한다', async () => {
    mockPhoneJoin.mockResolvedValue({ points_earned: 100 });
    const res = makeRes();
    const own = createOrderCapability({ id: 41, store_id: 3 });
    await customerController.phoneJoin(makeReq({ ...body, store_id: 999 }, own), res);
    expect(mockPhoneJoin).toHaveBeenCalledWith(expect.anything(), { orderId: 41, storeId: 3 });
    expect(res.json).toHaveBeenCalledWith({ success: true, points_earned: 100 });
  });
});
