const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const {
  encryptPhone,
  decryptPhoneFields,
  phoneSearchCandidates,
} = require('../utils/phoneEncryption');
const alimtalkService = require('./AlimtalkService');
const logger = require('../utils/logger');

class WaitingService {
  /**
   * 매장 대기 현황 조회 (대기 팀 수)
   */
  async getStoreStatus(storeId) {
    return await prisma.waiting_list.count({
      where: { store_id: parseInt(storeId), status: 'waiting' },
    });
  }

  /**
   * 매장 대기 리스트 조회 (관리자용)
   */
  async getStoreWaitingList(storeId) {
    const list = await prisma.waiting_list.findMany({
      where: { store_id: parseInt(storeId) },
      orderBy: { queue_number: 'asc' },
    });
    return list.map((e) => decryptPhoneFields(e));
  }

  /**
   * 대기 등록
   */
  async register(data) {
    const { store_id, customer_name, customer_phone, party_size } = data;
    const encPhone = encryptPhone(customer_phone);

    // 이미 대기 중인 고객 확인
    const existing = await prisma.waiting_list.findFirst({
      where: {
        store_id: parseInt(store_id),
        customer_phone: { in: [encPhone, customer_phone] },
        status: { in: ['waiting', 'called'] },
      },
    });

    if (existing) {
      throw new AppError('이미 대기 등록이 되어 있습니다.', 400, undefined, {
        existing: decryptPhoneFields(existing),
      });
    }

    // 오늘 마지막 대기 번호 조회
    const lastEntry = await prisma.waiting_list.findFirst({
      where: {
        store_id: parseInt(store_id),
        created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      orderBy: { queue_number: 'desc' },
    });

    const newQueueNumber = (lastEntry?.queue_number || 0) + 1;

    const entry = await prisma.waiting_list.create({
      data: {
        store_id: parseInt(store_id),
        customer_name,
        customer_phone: encPhone,
        party_size: parseInt(party_size),
        queue_number: newQueueNumber,
        status: 'waiting',
      },
    });

    const result = decryptPhoneFields(entry);

    try {
      const store = await prisma.stores.findUnique({
        where: { id: parseInt(store_id) },
        select: { name: true },
      });
      const waitingCount = await this.getStoreStatus(store_id);
      alimtalkService
        .sendWaitingRegistered(customer_phone, store?.name || '매장', newQueueNumber, waitingCount)
        .catch((e) => logger.warn(`[Waiting] 알림톡 발송 실패: ${e.message}`));
    } catch (e) {
      logger.warn(`[Waiting] 등록 알림 처리 중 예외: ${e.message}`);
    }

    return result;
  }

  /**
   * 대기 상태 변경
   */
  async updateStatus(id, status) {
    const entry = await prisma.waiting_list.findUnique({
      where: { id: parseInt(id) },
      select: { store_id: true },
    });
    if (!entry) throw new Error('Waiting entry not found');
    const updated = await prisma.waiting_list.update({
      where: { id: parseInt(id) },
      data: {
        status,
        called_at: status === 'called' ? new Date() : undefined,
      },
    });
    const result = decryptPhoneFields(entry);

    try {
      const store = await prisma.stores.findUnique({
        where: { id: entry.store_id },
        select: { name: true },
      });
      const storeName = store?.name || '매장';
      const phone = result.customer_phone;

      if (status === 'called') {
        alimtalkService
          .sendWaitingCall(phone, storeName, entry.queue_number)
          .catch((e) => logger.warn(`[Waiting] 호출 알림톡 실패: ${e.message}`));
      } else if (status === 'cancelled') {
        alimtalkService
          .sendWaitingCancel(phone, storeName)
          .catch((e) => logger.warn(`[Waiting] 취소 알림톡 실패: ${e.message}`));
      }
    } catch (e) {
      logger.warn(`[Waiting] 상태 변경 알림 처리 중 예외: ${e.message}`);
    }

    return result;
  }

  /**
   * 내 대기 상태 조회 (휴대폰 번호 기준)
   */
  async getMyWaiting(phone) {
    const entries = await prisma.waiting_list.findMany({
      where: {
        customer_phone: { in: [...phoneSearchCandidates(phone), phone] },
        status: { in: ['waiting', 'called'] },
      },
      include: { stores: true },
      orderBy: { created_at: 'desc' },
    });

    const results = await Promise.all(
      entries.map(async (entry) => {
        const aheadCount = await prisma.waiting_list.count({
          where: {
            store_id: entry.store_id,
            status: 'waiting',
            queue_number: { lt: entry.queue_number },
          },
        });
        return { ...decryptPhoneFields(entry), ahead_count: aheadCount };
      })
    );

    return results;
  }
}

module.exports = WaitingService;
