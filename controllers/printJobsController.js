const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const printJobsController = {
    getPending: async (req, res) => {
        try {
            const storeId = parseInt(req.query.store_id || req.params.storeId);
            const jobs = await prisma.$queryRawUnsafe(
                `SELECT id, store_id, order_id, kind, status, payload_b64, created_at
                 FROM print_jobs
                 WHERE store_id = $1 AND status = 'pending'
                 ORDER BY created_at ASC
                 LIMIT 20`,
                storeId
            );
            res.json({ success: true, data: jobs });
        } catch (err) {
            logger.error(`[PrintJobs] 조회 실패: ${err.message}`);
            res.status(500).json({ success: false, message: '조회 실패' });
        }
    },

    claim: async (req, res) => {
        try {
            const jobId = parseInt(req.params.jobId);
            const result = await prisma.$executeRawUnsafe(
                `UPDATE print_jobs SET status = 'printing', claimed_at = NOW()
                 WHERE id = $1 AND status = 'pending'`,
                jobId
            );
            if (result === 0) {
                return res.status(409).json({ success: false, message: '이미 처리 중이거나 완료된 작업입니다.' });
            }
            res.json({ success: true });
        } catch (err) {
            logger.error(`[PrintJobs] 클레임 실패: ${err.message}`);
            res.status(500).json({ success: false, message: '클레임 실패' });
        }
    },

    complete: async (req, res) => {
        try {
            const jobId = parseInt(req.params.jobId);
            await prisma.$executeRawUnsafe(
                `UPDATE print_jobs SET status = 'completed', completed_at = NOW()
                 WHERE id = $1 AND status = 'printing'`,
                jobId
            );
            res.json({ success: true });
        } catch (err) {
            logger.error(`[PrintJobs] 완료 처리 실패: ${err.message}`);
            res.status(500).json({ success: false, message: '완료 처리 실패' });
        }
    },

    fail: async (req, res) => {
        try {
            const jobId = parseInt(req.params.jobId);
            const { error } = req.body;
            await prisma.$executeRawUnsafe(
                `UPDATE print_jobs SET status = 'failed', error_message = $2, completed_at = NOW()
                 WHERE id = $1 AND status IN ('pending', 'printing')`,
                jobId, error || 'Unknown error'
            );
            res.json({ success: true });
        } catch (err) {
            logger.error(`[PrintJobs] 실패 처리 실패: ${err.message}`);
            res.status(500).json({ success: false, message: '실패 처리 실패' });
        }
    }
};

module.exports = printJobsController;
