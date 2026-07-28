const logger = require('../utils/logger');
// [수정] 모듈마다 new PrismaClient() 를 만들면 커넥션 풀이 중복 생성되어
// 서버리스/컨테이너 환경에서 DB 연결 수가 폭증한다. 공유 싱글턴을 사용한다.
const prisma = require('../config/prisma');

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
    orderClients.forEach((client) => {
      client.write(`data: ${JSON.stringify({ status: newStatus })}\n\n`);
    });
    logger.info(`[SSE] Notified clients for order ${orderId} of status change to ${newStatus}`);
  }
};
