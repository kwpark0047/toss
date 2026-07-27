const rateLimit = require('express-rate-limit');
const logger = require('./logger');

const AI_RATE_LIMITS = {
    describeMenu: { windowMs: 60_000, max: 30 },
    instagram: { windowMs: 60_000, max: 30 },
    recommend: { windowMs: 60_000, max: 60 },
    recommendDessert: { windowMs: 60_000, max: 60 },
    translateMenu: { windowMs: 60_000, max: 10 },
    translate: { windowMs: 60_000, max: 30 },
    storytelling: { windowMs: 60_000, max: 30 },
    generateMenuImage: { windowMs: 60_000, max: 10 },
    scanMenuImage: { windowMs: 60_000, max: 10 },
    generateReviewReply: { windowMs: 60_000, max: 30 },
    recommendImageEnhancement: { windowMs: 60_000, max: 30 },
    tinkerbellRec: { windowMs: 60_000, max: 60 },
    chat: { windowMs: 60_000, max: 60 },
    translateMessage: { windowMs: 60_000, max: 30 },
    proposeSetMenus: { windowMs: 60_000, max: 20 },
    getMenuAnalysis: { windowMs: 60_000, max: 20 },
    getAISuggestions: { windowMs: 60_000, max: 30 },
};

function createAIRateLimiter(endpoint) {
    const config = AI_RATE_LIMITS[endpoint] || { windowMs: 60_000, max: 30 };

    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            error: 'API rate limit exceeded',
            retryAfter: Math.ceil(config.windowMs / 1000),
        },
        handler: (req, res, next, options) => {
            logger.warn(`[AI Rate Limit] ${req.method} ${req.originalUrl} - client: ${req.ip}`);
            res.status(options.statusCode).json({
                error: options.message.error,
                retryAfter: options.retryAfter,
            });
        },
        skipSuccessfulRequests: false,
    });
}

module.exports = { createAIRateLimiter, AI_RATE_LIMITS };