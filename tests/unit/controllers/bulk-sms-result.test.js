jest.mock('../../../config/prisma', () => ({
  store_customers: { findMany: jest.fn().mockResolvedValue([{ customer_phone: '01000000000' }]) },
}));
jest.mock('../../../utils/smsService', () => ({
  sendSms: jest.fn().mockResolvedValue({ sent: false }),
}));
jest.mock('../../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const controller = require('../../../controllers/bulkSmsController'),
  logger = require('../../../utils/logger');
test('failed provider result is not counted as accepted message', async () => {
  let job;
  const spy = jest.spyOn(global, 'setImmediate').mockImplementation((fn) => {
    job = fn;
    return 1;
  });
  try {
    await controller.sendBulkSms(
      { user: { role: 'super_admin' }, body: { message: 'fixture', filters: { storeId: '1' } } },
      { success: jest.fn() },
      jest.fn()
    );
    await job();
    expect(logger.info).toHaveBeenCalledWith('[BulkSMS] 발송 완료: 0/1');
  } finally {
    spy.mockRestore();
  }
});
