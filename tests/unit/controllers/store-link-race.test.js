jest.mock('../../../config/prisma', () => ({
  store_link_requests: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({ info: jest.fn() }));
const db = require('../../../config/prisma'),
  controller = require('../../../controllers/storeLinkController');
test('lost approval race returns conflict and does not overwrite rejection', async () => {
  db.store_link_requests.findUnique.mockResolvedValue({ id: 1, status: 'pending' });
  db.store_link_requests.updateMany.mockResolvedValue({ count: 0 });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), success: jest.fn() };
  await controller.approveRequest({ params: { id: '1' }, user: { id: 1 } }, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(409);
  expect(db.store_link_requests.update).not.toHaveBeenCalled();
});
