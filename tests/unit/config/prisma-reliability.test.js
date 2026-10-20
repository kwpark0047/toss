jest.mock('../../../prisma/app/generated/prisma', () => ({ PrismaClient: jest.fn() }));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn(), debug: jest.fn() }));
describe('database pool and telemetry', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.REPLICA_URL;
    delete process.env.DATABASE_URL;
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

  it('enables Prisma PgBouncer compatibility for transaction-pooler URLs only', () => {
    const generated = require('../../../prisma/app/generated/prisma');
    generated.PrismaClient.mockImplementation(() => ({
      $on: jest.fn(),
      $disconnect: jest.fn(),
    }));
    process.env.DATABASE_URL =
      'postgresql://app:secret@aws-0-example.pooler.supabase.com:6543/postgres?sslmode=require';
    process.env.REPLICA_URL =
      'postgresql://replica:secret@aws-0-example.pooler.supabase.com:6543/postgres';

    require('../../../config/prisma');

    const urls = generated.PrismaClient.mock.calls.map((call) => call[0].datasources.db.url);
    expect(urls).toHaveLength(2);
    for (const connectionUrl of urls) {
      const parsed = new URL(connectionUrl);
      expect(parsed.port).toBe('6543');
      expect(parsed.searchParams.get('pgbouncer')).toBe('true');
    }
  });

  it('leaves direct/session-pooler URLs unchanged', () => {
    const generated = require('../../../prisma/app/generated/prisma');
    generated.PrismaClient.mockImplementation(() => ({
      $on: jest.fn(),
      $disconnect: jest.fn(),
    }));
    process.env.DATABASE_URL =
      'postgresql://app:secret@aws-0-example.pooler.supabase.com:5432/postgres?sslmode=require';

    require('../../../config/prisma');

    const connectionUrl = generated.PrismaClient.mock.calls[0][0].datasources.db.url;
    expect(connectionUrl).toBe(process.env.DATABASE_URL);
    expect(new URL(connectionUrl).searchParams.has('pgbouncer')).toBe(false);
  });
});
