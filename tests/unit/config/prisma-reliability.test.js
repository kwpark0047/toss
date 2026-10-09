jest.mock('../../../prisma/app/generated/prisma', () => ({ PrismaClient: jest.fn() }));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn(), debug: jest.fn() }));
describe('database pool and telemetry', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.REPLICA_URL;
  });
  it('shares one pool without a replica and never retains query text or parameter values', () => {
    const generated = require('../../../prisma/app/generated/prisma');
    let listener;
    generated.PrismaClient.mockImplementation(() => ({
      $on: (_, fn) => {
        listener = fn;
      },
      $disconnect: jest.fn(),
    }));
    const prisma = require('../../../config/prisma');
    expect(generated.PrismaClient).toHaveBeenCalledTimes(1);
    listener({ query: "SELECT 'secret@example.com'", params: '["private-token"]', duration: 1000 });
    const logs = JSON.stringify(prisma.getQueryLogs());
    expect(logs).not.toContain('secret@example.com');
    expect(logs).not.toContain('private-token');
    expect(prisma.getQueryLogs()[0]).toHaveProperty('fingerprint');
  });
});
