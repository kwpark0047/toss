jest.mock('../../../config/prisma', () => ({}));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));

const { requireScope } = require('../../../middleware/apiKeyAuth');

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

describe('API key feature scopes', () => {
  it('legacy read/write scopes remain compatible', () => {
    const next = jest.fn();
    requireScope('orders:read')({ apiClient: { scopes: ['read'] } }, response(), next);
    requireScope('orders:write')({ apiClient: { scopes: ['write'] } }, response(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('specific scopes do not grant unrelated operations', () => {
    const next = jest.fn();
    const res = response();
    requireScope('orders:write')({ apiClient: { scopes: ['menus:read'] } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
