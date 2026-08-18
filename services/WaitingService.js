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
   * 대기 상태 변경 (상태 전이 검증 포함)
   */
  async updateStatus(id, status) {
    const validStatuses = ['waiting', 'called', 'entered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new AppError('유효하지 않은 대기 상태입니다.', 400);
    }

    const existing = await prisma.waiting_list.findUnique({
      where: { id: parseInt(id) },
    });
    if (!existing) throw new AppError('대기 항목을 찾을 수 없습니다.', 404);

    // 상태 전이 검증
    const invalidTransitions = {
      cancelled: ['waiting', 'called', 'entered', 'cancelled'],
      entered: ['waiting', 'called', 'entered', 'cancelled'],
    };

    if (invalidTransitions[existing.status]?.includes(status)) {
      throw new AppError(
        `이미 ${existing.status} 상태인 대기는 ${status}로 변경할 수 없습니다.`,
        400
      );
    }

    // waiting에서는 called, cancelled만 허용
    if (existing.status === 'waiting' && !['called', 'cancelled'].includes(status)) {
      throw new AppError('대기 중인 고객은 호출 또는 취소만 가능합니다.', 400);
    }

    // called에서는 entered, cancelled만 허용
    if (existing.status === 'called' && !['entered', 'cancelled'].includes(status)) {
      throw new AppError('호출된 고객은 입장 또는 취소만 가능합니다.', 400);
    }

    const updated = await prisma.waiting_list.update({
      where: { id: parseInt(id) },
      data: {
        status,
        called_at: status === 'called' ? new Date() : undefined,
      },
    });
    const result = decryptPhoneFields(updated);

    try {
      const store = await prisma.stores.findUnique({
        where: { id: existing.store_id },
        select: { name: true },
      });
      const storeName = store?.name || '매장';
      const phone = result.customer_phone;

      if (status === 'called') {
        alimtalkService
          .sendWaitingCall(phone, storeName, updated.queue_number)
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
   * 고객 본인 대기 취소 (전화번호 본인 확인)
   */
  async cancelWaiting(id, phone, io) {
    const waiting = await prisma.waiting_list.findUnique({
      where: { id: parseInt(id) },
    });
    if (!waiting) {
      throw new AppError('대기 항목을 찾을 수 없습니다.', 404);
    }
    if (waiting.customer_phone !== phone) {
      throw new AppError('본인의 대기만 취소할 수 있습니다.', 403);
    }
    if (waiting.status !== 'waiting' && waiting.status !== 'called') {
      throw new AppError('현재 상태에서는 취소할 수 없습니다.', 400);
    }

    const entry = await prisma.waiting_list.update({
      where: { id: parseInt(id) },
      data: { status: 'cancelled' },
    });
    const result = decryptPhoneFields(entry);

    if (io) {
      io.to(`store - waiting - ${waiting.store_id}`).emit('waiting-list-changed', {
        storeId: waiting.store_id,
      });
      io.to(`customer - waiting - ${phone}`).emit('waiting-status-changed', {
        status: 'cancelled',
        entry: result,
        message: '대기가 취소되었습니다.',
      });
    }

    // 취소 알림톡 발송
    try {
      const store = await prisma.stores.findUnique({
        where: { id: waiting.store_id },
        select: { name: true },
      });
      await alimtalkService.sendWaitingCancel(phone, store?.name || '매장');
    } catch (e) {
      logger.warn(`[Waiting] 취소 알림톡 발송 실패: ${e.message}`);
    }

    return result;
  }

  /**
   * 고객 알림 재발송 (전화번호 본인 확인)
   */
  async resendCustomerNotification(id, phone) {
    const waiting = await prisma.waiting_list.findUnique({
      where: { id: parseInt(id) },
      select: { store_id: true, customer_phone: true, status: true, queue_number: true },
    });
    if (!waiting) throw new AppError('대기 항목을 찾을 수 없습니다.', 404);
    if (waiting.customer_phone !== phone) {
      throw new AppError('본인의 대기만 재발송할 수 있습니다.', 403);
    }

    const store = await prisma.stores.findUnique({
      where: { id: waiting.store_id },
      select: { name: true },
    });
    const storeName = store?.name || '매장';

    try {
      if (waiting.status === 'called') {
        await alimtalkService.sendWaitingCall(phone, storeName, waiting.queue_number);
      } else if (waiting.status === 'cancelled') {
        await alimtalkService.sendWaitingCancel(phone, storeName);
      } else if (waiting.status === 'waiting') {
        const waitingCount = await this.getStoreStatus(waiting.store_id);
        await alimtalkService.sendWaitingRegistered(
          phone,
          storeName,
          waiting.queue_number,
          waitingCount
        );
      }
    } catch (e) {
      logger.warn(`[Waiting] 고객 알림 재발송 실패: ${e.message}`);
      throw new AppError('알림 재발송에 실패했습니다.', 500);
    }

    return { message: '알림 재발송 완료', status: waiting.status };
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

  /**
   * 알림톡 재발송 (상태 변경 없이 현재 상태에 맞는 알림 재전송)
   */
  async resendNotification(id) {
    const entry = await prisma.waiting_list.findUnique({
      where: { id: parseInt(id) },
      select: { store_id: true, customer_phone: true, status: true, queue_number: true },
    });
    if (!entry) throw new Error('Waiting entry not found');

    const store = await prisma.stores.findUnique({
      where: { id: entry.store_id },
      select: { name: true },
    });
    const storeName = store?.name || '매장';
    const phone = entry.customer_phone;

    try {
      if (entry.status === 'called') {
        await alimtalkService.sendWaitingCall(phone, storeName, entry.queue_number);
      } else if (entry.status === 'cancelled') {
        await alimtalkService.sendWaitingCancel(phone, storeName);
      } else if (entry.status === 'waiting') {
        const waitingCount = await this.getStoreStatus(entry.store_id);
        await alimtalkService.sendWaitingRegistered(
          phone,
          storeName,
          entry.queue_number,
          waitingCount
        );
      }
    } catch (e) {
      logger.warn(`[Waiting] 알림톡 재발송 실패: ${e.message}`);
    }

    return { message: '알림톡 재발송 완료', status: entry.status };
  }
}

module.exports = WaitingService;
