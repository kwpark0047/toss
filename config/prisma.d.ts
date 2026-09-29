import type { PrismaClient } from '../prisma/app/generated/prisma/index.js';

type PrismaProxy = PrismaClient & {
  getQueryLogs?: () => unknown[];
  disconnectAll?: () => Promise<void>;
};

declare const prisma: PrismaProxy;
export default prisma;
