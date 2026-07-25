const prisma = require('../config/prisma');
const logger = require('../utils/logger');

async function archiveLogs() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  try {
    const deletedMetrics = await prisma.metrics.deleteMany({
      where: { timestamp: { lt: sixMonthsAgo } }
    });
    
    const deletedNotifications = await prisma.notifications.deleteMany({
      where: { created_at: { lt: sixMonthsAgo } }
    });

    const deletedLedger = await prisma.ledger.deleteMany({
      where: { created_at: { lt: sixMonthsAgo }, order_id: null }
    });

    logger.info(`[Archive] Purged old logs: metrics=${deletedMetrics.count}, notifications=${deletedNotifications.count}, ledger=${deletedLedger.count}`);
  } catch (error) {
    logger.error(`[Archive] Failed to purge old logs: ${error.message}`);
  }
}

module.exports = archiveLogs;
