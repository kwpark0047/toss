const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const {
  encryptPhone,
  decryptPhoneFields,
  phoneSearchCandidates,
} = require('../utils/phoneEncryption');
const { sendReservationNotification } = require('../utils/notifications');
const logger = require('../utils/logger');

class ReservationsService {
  /**
   * 예약 등록
   */
  async register(data, io) {
    const { store_id, customer_name, customer_phone, party_size, reservation_time, notes } = data;

    const entry = await prisma.reservations.create({
      data: {
        store_id: parseInt(store_id),
        customer_name,
        customer_phone: encryptPhone(customer_phone),
        party_size: parseInt(party_size),
        reservation_time: new Date(reservation_time),
        notes,
        status: 'PENDING',
      },
    });

    if (io) {
      io.to(`store - ${store_id}`).emit('new-reservation', decryptPhoneFields(entry));
    }

    return decryptPhoneFields(entry);
  }

  /**
   * 매장별 예약 리스트 조회
   */
  async getStoreReservations(storeId, filters) {
    const { status, date } = filters;
    const where = { store_id: parseInt(storeId) };

    if (status) where.status = status;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.reservation_time = { gte: start, lte: end };
    }

    const list = await prisma.reservations.findMany({
      where,
      orderBy: { reservation_time: 'asc' },
    });

    return list.map((e) => decryptPhoneFields(e));
  }

  /**
   * 예약 상태 변경
   */
  async updateStatus(id, status) {
    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELED', 'COMPLETED', 'NOSHOW', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      throw new AppError('유효하지 않은 예약 상태입니다.', 400);
    }

    const existing = await prisma.reservations.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existing) {
      throw new AppError('예약을 찾을 수 없습니다.', 404);
    }

    // 상태 전이 규칙 검증
    const invalidTransitions = {
      CANCELED: ['PENDING', 'CONFIRMED', 'COMPLETED', 'NOSHOW', 'REJECTED'],
      COMPLETED: ['PENDING', 'CONFIRMED', 'CANCELED', 'NOSHOW', 'REJECTED'],
      NOSHOW: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'REJECTED'],
      REJECTED: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NOSHOW'],
    };

    if (invalidTransitions[existing.status]?.includes(status)) {
      throw new AppError(
        `이미 ${existing.status} 상태인 예약은 ${status}로 변경할 수 없습니다.`,
        400
      );
    }

    // PENDING에서는 CONFIRMED, REJECTED, CANCELED만 허용
    if (existing.status === 'PENDING' && !['CONFIRMED', 'REJECTED', 'CANCELED'].includes(status)) {
      throw new AppError('대기 중인 예약은 확정, 거절, 취소만 가능합니다.', 400);
    }

    // CONFIRMED에서는 COMPLETED, NOSHOW, CANCELED만 허용
    if (existing.status === 'CONFIRMED' && !['COMPLETED', 'NOSHOW', 'CANCELED'].includes(status)) {
      throw new AppError('확정된 예약은 방문완료, 노쇼, 취소만 가능합니다.', 400);
    }

    const entry = await prisma.reservations.update({
      where: { id: parseInt(id) },
      data: { status },
    });

    sendReservationNotification(decryptPhoneFields(entry), status).catch((err) =>
      logger.error(err)
    );

    return decryptPhoneFields(entry);
  }

  /**
   * 내 예약 조회 (휴대폰 번호 기준)
   */
  async getMyReservations(phone) {
    const entries = await prisma.reservations.findMany({
      where: {
        customer_phone: { in: [...phoneSearchCandidates(phone), phone] },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { stores: true },
      orderBy: { reservation_time: 'asc' },
    });

    return entries.map((e) => decryptPhoneFields(e));
  }

  /**
   * 고객 본인 예약 취소
   */
  async cancelReservation(id, phone, io) {
    const reservation = await prisma.reservations.findUnique({
      where: { id: parseInt(id) },
    });

    if (!reservation) {
      throw new AppError('예약을 찾을 수 없습니다.', 404);
    }
    if (reservation.customer_phone !== phone) {
      throw new AppError('본인의 예약만 취소할 수 있습니다.', 403);
    }
    if (reservation.status !== 'PENDING' && reservation.status !== 'CONFIRMED') {
      throw new AppError('현재 상태에서는 취소할 수 없습니다.', 400);
    }

    const entry = await prisma.reservations.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELED' },
    });

    if (io) {
      io.to(`store - ${entry.store_id}`).emit('new-reservation', entry);
    }

    sendReservationNotification(entry, 'CANCELED').catch((err) => logger.error(err));

    return entry;
  }
}

module.exports = ReservationsService;
