const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { encryptPhone, decryptPhoneFields, phoneSearchCandidates } = require('../utils/phoneEncryption');
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
                status: 'PENDING'
            }
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
            orderBy: { reservation_time: 'asc' }
        });

        return list.map(e => decryptPhoneFields(e));
    }

    /**
     * 예약 상태 변경
     */
    async updateStatus(id, status) {
        const entry = await prisma.reservations.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        sendReservationNotification(decryptPhoneFields(entry), status)
            .catch(err => logger.error(err));

        return decryptPhoneFields(entry);
    }

    /**
     * 내 예약 조회 (휴대폰 번호 기준)
     */
    async getMyReservations(phone) {
        const entries = await prisma.reservations.findMany({
            where: {
                customer_phone: { in: [...phoneSearchCandidates(phone), phone] },
                status: { in: ['PENDING', 'CONFIRMED'] }
            },
            include: { stores: true },
            orderBy: { reservation_time: 'asc' }
        });

        return entries.map(e => decryptPhoneFields(e));
    }

    /**
     * 고객 본인 예약 취소
     */
    async cancelReservation(id, phone, io) {
        const reservation = await prisma.reservations.findUnique({
            where: { id: parseInt(id) }
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
            data: { status: 'CANCELED' }
        });

        if (io) {
            io.to(`store - ${entry.store_id}`).emit('new-reservation', entry);
        }

        sendReservationNotification(entry, 'CANCELED')
            .catch(err => logger.error(err));

        return entry;
    }
}

module.exports = ReservationsService;
