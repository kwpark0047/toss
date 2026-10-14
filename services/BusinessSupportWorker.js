const crypto = require('crypto');
const prisma = require('../config/prisma');
const Support = require('./BusinessSupportService');
class BusinessSupportWorker {
  constructor(db = prisma) {
    this.db = db;
    this.service = new Support(db);
  }
  async schedule() {
    // Only enrolled stores, never the public store directory. Refresh at most 100 per invocation.
    return this.db.$executeRawUnsafe(`INSERT INTO business_support_jobs(store_id)
      SELECT e.store_id FROM business_support_enrollments e JOIN stores s ON s.id=e.store_id
      LEFT JOIN business_support_jobs j ON j.store_id=e.store_id
      WHERE e.enabled AND e.owner_id=s.user_id AND s.is_active=true AND
      (j.store_id IS NULL OR (j.status='done' AND j.updated_at<now()-interval '5 minutes'))
      ORDER BY j.updated_at NULLS FIRST,e.store_id LIMIT 100
      ON CONFLICT(store_id) DO UPDATE SET status='pending',attempts=0,available_at=now(),generation=business_support_jobs.generation+1,updated_at=now()`);
  }
  async claim() {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`UPDATE business_support_jobs SET status='dead',lease_id=NULL,lease_until=NULL,last_error='lease_exhausted'
        WHERE status='running' AND lease_until<now() AND attempts>=5`);
      const rows =
        await tx.$queryRawUnsafe(`SELECT j.* FROM business_support_jobs j JOIN business_support_enrollments e ON e.store_id=j.store_id
        JOIN stores s ON s.id=e.store_id WHERE e.enabled AND e.owner_id=s.user_id AND s.is_active=true AND j.attempts<5 AND
        ((j.status='pending' AND j.available_at<=now()) OR (j.status='running' AND j.lease_until<now()))
        ORDER BY j.available_at,j.store_id FOR UPDATE OF j SKIP LOCKED LIMIT 1`);
      if (!rows.length) return null;
      const job = rows[0],
        lease = crypto.randomUUID();
      await tx.$executeRawUnsafe(
        "UPDATE business_support_jobs SET status='running',attempts=attempts+1,lease_id=$1::uuid,lease_until=now()+interval '2 minutes',updated_at=now() WHERE store_id=$2",
        lease,
        job.store_id
      );
      return { ...job, lease_id: lease, attempts: job.attempts + 1 };
    });
  }
  async process(job) {
    try {
      const operations = await this.db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS pending,
        COALESCE(MAX(EXTRACT(EPOCH FROM (now() AT TIME ZONE 'UTC'-created_at))/60),0)::float AS oldest_minutes
        FROM orders WHERE store_id=$1 AND status::text='pending' AND created_at>=now()-interval '1 day'`,
        job.store_id
      );
      const activity = await this.db.$queryRawUnsafe(
        'SELECT id FROM orders WHERE store_id=$1 LIMIT 1',
        job.store_id
      );
      const snapshot = activity.length ? await this.service.manager.briefing(job.store_id) : null;
      const stockAlerts = await this.db.$queryRawUnsafe(
        `SELECT id,name,stock_quantity,is_sold_out,updated_at FROM products WHERE store_id=$1 AND is_active=true AND (is_sold_out=true OR stock_quantity<=0) ORDER BY id LIMIT 20`,
        job.store_id
      );
      operations[0].stock_alerts = stockAlerts;
      const published = await this.db.$transaction(async (tx) => {
        // Consent updates and job completion use the same store -> job lock order.
        await tx.$queryRawUnsafe('SELECT id FROM stores WHERE id=$1 FOR UPDATE', job.store_id);
        const current = await tx.$queryRawUnsafe(
          'SELECT * FROM business_support_jobs WHERE store_id=$1 FOR UPDATE',
          job.store_id
        );
        if (current[0]?.lease_id !== job.lease_id) return false;
        await this.service.eligible(tx, job.store_id);
        if (snapshot)
          await this.service.createFromSnapshot(job.store_id, snapshot, operations[0], tx);
        await tx.$executeRawUnsafe(
          `UPDATE business_support_jobs SET status=CASE WHEN generation=$1 THEN 'done' ELSE 'pending' END,
          attempts=0,lease_id=NULL,lease_until=NULL,last_error=$2,updated_at=now() WHERE store_id=$3`,
          job.generation,
          snapshot ? null : 'operating_data_required',
          job.store_id
        );
        return true;
      });
      return {
        store_id: job.store_id,
        status: !published ? 'lease_lost' : snapshot ? 'analyzed' : 'operating_data_required',
      };
    } catch (error) {
      await this.db.$executeRawUnsafe(
        `UPDATE business_support_jobs SET status=CASE WHEN attempts>=5 THEN 'dead' ELSE 'pending' END,
        available_at=now()+($1::int*interval '1 second'),lease_id=NULL,lease_until=NULL,last_error=$2,updated_at=now()
        WHERE store_id=$3 AND lease_id=$4::uuid`,
        Math.min(3600, 30 * 2 ** (job.attempts - 1)),
        error.statusCode === 409 ? 'consent_required' : 'analysis_failed',
        job.store_id,
        job.lease_id
      );
      return { store_id: job.store_id, status: 'retry_or_dead' };
    }
  }
  async runBatch({ limit = 10, concurrency = 2 } = {}) {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(concurrency) ||
      concurrency < 1 ||
      concurrency > 2
    )
      throw new Error('Invalid worker bounds');
    const results = [];
    let reserved = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (reserved < limit) {
          reserved++;
          const job = await this.claim();
          if (!job) return;
          results.push(await this.process(job));
        }
      })
    );
    return { results };
  }
}
module.exports = BusinessSupportWorker;
