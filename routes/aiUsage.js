const express = require('express');
const router = express.Router();
const aiUsageTracker = require('../utils/aiUsageTracker');
const { catchAsync } = require('../utils/catchAsync');

router.get('/stats', catchAsync(async (req, res) => {
    const storeId = req.query.storeId ? parseInt(req.query.storeId) : null;
    const { startDate, endDate, provider, limit } = req.query;
    const params = { startDate, endDate, provider, limit: limit ? parseInt(limit) : 50 };

    const { records, stats } = await aiUsageTracker.getUsageStats(storeId, params);

    const totalCost = stats._sum?.costUsd ? parseFloat(stats._sum.costUsd) : 0;
    const totalTokens = stats._sum?.totalTokens || 0;
    const totalCalls = stats._count?.id || 0;
    const avgDuration = stats._avg?.durationMs || 0;

    res.json({
        summary: {
            totalCalls,
            totalCostUSD: Math.round(totalCost * 10000) / 10000,
            totalTokens,
            avgDurationMs: Math.round(avgDuration * 100) / 100,
            period: { startDate, endDate },
        },
        records,
    });
}));

module.exports = router;
