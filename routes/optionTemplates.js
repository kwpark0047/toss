const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// ?µì…˜ ?œí”Œë¦?ëª©ë¡ ì¡°íšŒ
router.get('/store/:storeId', authMiddleware, catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    const templates = await prisma.option_templates.findMany({
        where: { store_id: storeId },
        orderBy: { created_at: 'desc' }
    });
    res.json(templates);
}));

// ?µì…˜ ?œí”Œë¦??ì„±
router.post('/', authMiddleware, catchAsync(async (req, res) => {
    const { store_id, name, options } = req.body;
    const template = await prisma.option_templates.create({
        data: {
            store_id: parseInt(store_id),
            name,
            options: typeof options === 'string' ? options : JSON.stringify(options)
        }
    });
    res.status(201).json(template);
}));

// ?µì…˜ ?œí”Œë¦??˜ì •
router.put('/:id', authMiddleware, catchAsync(async (req, res) => {
    const { name, options } = req.body;
    const template = await prisma.option_templates.update({
        where: { id: parseInt(req.params.id) },
        data: {
            name,
            options: typeof options === 'string' ? options : JSON.stringify(options)
        }
    });
    res.json(template);
}));

// ?µì…˜ ?œí”Œë¦??? œ
router.delete('/:id', authMiddleware, catchAsync(async (req, res) => {
    await prisma.option_templates.delete({
        where: { id: parseInt(req.params.id) }
    });
    res.json({ message: '?œí”Œë¦¿ì´ ?? œ?˜ì—ˆ?µë‹ˆ??' });
}));

module.exports = router;

