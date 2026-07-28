const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

exports.listRequests = catchAsync(async (req, res) => {
  const status = req.query.status || 'pending';

  const requests = await prisma.store_link_requests.findMany({
    where: { status },
    orderBy: { created_at: 'desc' },
  });

  const userIds = [...new Set(requests.map(r => r.user_id))];
  const storeIds = [...new Set(requests.map(r => r.store_id))];

  const [users, stores] = await Promise.all([
    prisma.users.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    }),
    prisma.stores.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, name: true, address: true },
    }),
  ]);

  const userMap = {};
  for (const u of users) userMap[u.id] = u;
  const storeMap = {};
  for (const s of stores) storeMap[s.id] = s;

  const enriched = requests.map(r => ({
    id: r.id,
    requested_name: r.requested_name,
    requested_address: r.requested_address,
    status: r.status,
    admin_note: r.admin_note,
    created_at: r.created_at,
    decided_at: r.decided_at,
    store: storeMap[r.store_id] || null,
    requester: userMap[r.user_id] || null,
  }));

  res.success({ requests: enriched });
});

exports.approveRequest = catchAsync(async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  if (!requestId) return res.status(400).json({ success: false, error: '잘못된 요청 ID입니다.' });

  const request = await prisma.store_link_requests.findUnique({ where: { id: requestId } });
  if (!request) return res.status(404).json({ success: false, error: '요청을 찾을 수 없습니다.' });

  if (request.status !== 'pending') {
    return res.status(400).json({ success: false, error: `이미 ${request.status} 처리된 요청입니다.` });
  }

  await prisma.store_link_requests.update({
    where: { id: requestId },
    data: {
      status: 'approved',
      reviewed_by: req.user?.id || null,
      decided_at: new Date(),
    },
  });

  logger.info({ requestId, storeId: request.store_id, userId: request.user_id }, '매장 연동 승인');
  res.success({ id: requestId, status: 'approved' }, '승인 완료');
});

exports.rejectRequest = catchAsync(async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  if (!requestId) return res.status(400).json({ success: false, error: '잘못된 요청 ID입니다.' });

  const request = await prisma.store_link_requests.findUnique({ where: { id: requestId } });
  if (!request) return res.status(404).json({ success: false, error: '요청을 찾을 수 없습니다.' });

  if (request.status !== 'pending') {
    return res.status(400).json({ success: false, error: `이미 ${request.status} 처리된 요청입니다.` });
  }

  const { admin_note } = req.body;

  await prisma.store_link_requests.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      reviewed_by: req.user?.id || null,
      admin_note: admin_note || '관리자에 의해 거절되었습니다.',
      decided_at: new Date(),
    },
  });

  logger.info({ requestId, storeId: request.store_id, userId: request.user_id }, '매장 연동 거절');
  res.success({ id: requestId, status: 'rejected' }, '거절 완료');
});
