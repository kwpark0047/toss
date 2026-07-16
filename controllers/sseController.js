const logger = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const clients = new Map();

exports.subscribeToOrder = (req, res) => {
    const { orderId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!clients.has(orderId)) {
        clients.set(orderId, new Set());
    }
    clients.get(orderId).add(res);

    logger.info(`[SSE] Client connected to order: ${orderId}`);

    req.on('close', () => {
        const orderClients = clients.get(orderId);
        if (orderClients) {
            orderClients.delete(res);
            if (orderClients.size === 0) {
                clients.delete(orderId);
            }
        }
        logger.info(`[SSE] Client disconnected from order: ${orderId}`);
    });
};

exports.notifyOrderStatusChange = (orderId, newStatus) => {
    const orderClients = clients.get(String(orderId));
    if (orderClients) {
        orderClients.forEach(client => {
            client.write(`data: ${JSON.stringify({ status: newStatus })}\n\n`);
        });
        logger.info(`[SSE] Notified clients for order ${orderId} of status change to ${newStatus}`);
    }
};
