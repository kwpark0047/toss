const prisma = require('../config/prisma');
const Point = require('../repositories/Point');
const StoreTier = require('../repositories/StoreTier');
const { AppError } = require('../utils/errorHandler');

/**
 * [PointsService]
 * 포인트 전체 관리 서비스.
 * - 사용자Facing API: getBalance, getHistory, walletLookup, adminEarn/Deduct
 * - 트랜잭션 메서드: earn, use, revertOnCancel, findOrCreateUser, unifyPoints
 *   (PaymentService 등에서 $transaction() 내부에서 호출)
 * - 계산: calculateEarnPoints (tier-aware), calculateUsablePoints
 */
class PointsService {
    // ─── 사용자Facing (Repository 기반) ─────────────────────────

    /**
     * 포인트 잔액 조회
     */
    async getBalance(identifier) {
        return await Point.getBalance(identifier);
    }

    /**
     * 포인트 내역 조회
     */
    async getHistory(identifier, options) {
        const history = await Point.getHistory(identifier, options);
        return {
            transactions: history,
            pagination: {
                limit: options.limit || 20,
                offset: options.offset || 0
            }
        };
    }

    /**
     * 월렛 조회 (포인트 잔액 + 내역 + 매장 설정 + 등급 정보)
     */
    async walletLookup(identifier, storeId) {
        const balance = await Point.getBalance(identifier);
        const history = await Point.getHistory(identifier, {
            store_id: storeId || undefined,
            limit: 5
        });

        let storeSettings = null;
        let tierInfo = null;

        if (storeId) {
            storeSettings = await Point.getStoreSettings(storeId);

            if (balance.user_id || balance.phone || balance.toss_user_key) {
                const userPoint = await prisma.user_points.findFirst({
                    where: {
                        OR: [
                            { id: balance.id },
                            { phone: identifier.phone || undefined },
                            { toss_user_key: identifier.toss_user_key || undefined }
                        ]
                    }
                });

                if (userPoint) {
                    const customer = await prisma.store_customers.findFirst({
                        where: {
                            store_id: storeId,
                            OR: [
                                { customer_phone: userPoint.phone || undefined },
                                { toss_user_key: userPoint.toss_user_key || undefined }
                            ]
                        }
                    });

                    if (customer) {
                        const tiers = await StoreTier.getTiers(storeId);
                        const currentTier = tiers.find(t => t.tier_name === customer.tier) || {
                            tier_name: 'GENERAL',
                            earn_rate: 1.0,
                            min_spent: 0
                        };
                        const nextTier = tiers.find(t => t.min_spent > customer.total_spent);
                        tierInfo = {
                            current: currentTier,
                            next: nextTier || null,
                            total_spent: customer.total_spent,
                            remaining_for_next: nextTier ? nextTier.min_spent - customer.total_spent : 0
                        };
                    }
                }
            }
        }

        return {
            balance,
            history: history || [],
            store_settings: storeSettings,
            tier_info: tierInfo
        };
    }

    /**
     * 사용 가능 포인트 계산
     */
    async calculateUsablePoints(amount, storeId, userId) {
        const identifier = { user_id: userId };
        const balance = await Point.getBalance(identifier);
        const usablePoints = await Point.calculateUsablePoints(amount, balance.total_points, storeId);
        return {
            total_points: balance.total_points,
            usable_points: usablePoints,
            max_discount: usablePoints
        };
    }

    /**
     * 매장 포인트 설정 조회
     */
    async getStoreSettings(storeId) {
        return await Point.getStoreSettings(storeId);
    }

    /**
     * 매장 포인트 설정 업데이트
     */
    async updateStoreSettings(storeId, data) {
        return await Point.updateStoreSettings(storeId, data);
    }

    /**
     * 수동 포인트 적립 (관리자용)
     */
    async adminEarn(identifier, storeId, amount, description) {
        return await Point.earn({
            identifier,
            store_id: storeId,
            amount,
            description: description || '관리자 수동 적립'
        });
    }

    /**
     * 수동 포인트 차감 (super_admin 전용)
     */
    async adminDeduct(identifier, storeId, amount, description) {
        return await Point.use({
            identifier,
            store_id: storeId,
            amount,
            description: description || '관리자 수동 차감'
        });
    }

    // ─── 적립 포인트 계산 (Tier-aware) ────────────────────────────

    /**
     * 적립 가능한 포인트를 계산합니다 (등급별 적립률 반영).
     * @param {number} amount - 결제 금액
     * @param {number|string} storeId - 매장 ID
     * @param {{ phone?: string, toss_user_key?: string }} [identifier] - 고객 식별자 (선택)
     * @returns {Promise<number>} 적립 포인트
     */
    async calculateEarnPoints(amount, storeId, identifier) {
        if (identifier) {
            // Tier-aware: raw prisma로 등급별 earn_rate 조회
            const settings = await prisma.store_point_settings.findUnique({
                where: { store_id: parseInt(storeId) }
            });
            if (!settings || !settings.is_enabled) return 0;
            if (amount < settings.min_earn_amount) return 0;

            let earnRate = settings.earn_rate;

            const { phone, toss_user_key } = identifier;
            const where = { store_id: parseInt(storeId) };
            if (phone) where.customer_phone = phone;
            else if (toss_user_key) where.toss_user_key = toss_user_key;

            if (Object.keys(where).length > 1) {
                const customer = await prisma.store_customers.findFirst({ where });
                if (customer && customer.tier !== 'GENERAL') {
                    const tiers = await prisma.store_tier_settings.findMany({
                        where: { store_id: parseInt(storeId) }
                    });
                    const currentTier = tiers.find(t => t.tier_name === customer.tier);
                    if (currentTier) {
                        earnRate = currentTier.earn_rate;
                    }
                }
            }

            return Math.floor(amount * (earnRate / 100));
        }

        // Fallback: repository 기반 기본 계산
        return await Point.calculateEarnPoints(amount, storeId);
    }

    // ─── 트랜잭션 메서드 (PaymentService 등에서 $transaction() 내부 사용) ──

    /**
     * 포인트 사용자를 조회하거나 생성합니다.
     * @param {{ toss_user_key?: string, phone?: string, user_id?: number }} identifier
     * @param {import('@prisma/client').PrismaTransactionClient} [tx] - 트랜잭션 클라이언트
     * @returns {Promise<{ id: number, total_points: number, lifetime_earned: number, lifetime_used: number }>}
     */
    async findOrCreateUser(identifier, tx) {
        const { toss_user_key, phone, user_id } = identifier;
        const { normalizePhone } = require('../utils/phoneEncryption');
        const normalizedPhone = phone ? normalizePhone(phone) : null;

        const where = {};
        if (toss_user_key) where.toss_user_key = toss_user_key;
        else if (normalizedPhone) where.phone = normalizedPhone;
        else if (user_id) where.user_id = user_id;

        const db = tx || prisma;
        let user = await db.user_points.findFirst({ where });
        if (!user) {
            user = await db.user_points.create({
                data: {
                    user_id: user_id || null,
                    toss_user_key: toss_user_key || null,
                    phone: normalizedPhone || null,
                    total_points: 0
                }
            });
        }
        return user;
    }

    /**
     * 게스트 포인트를 사용자 계정으로 통합합니다.
     * @param {number} userId
     * @param {string} phone
     * @param {import('@prisma/client').PrismaTransactionClient} [tx]
     */
    async unifyPoints(userId, phone, tx) {
        const { normalizePhone } = require('../utils/phoneEncryption');
        const normalized = normalizePhone(phone);
        if (!normalized) return;

        const db = tx || prisma;

        const guestPoints = await db.user_points.findMany({
            where: { phone: normalized, user_id: null }
        });

        if (guestPoints.length === 0) return;

        guestPoints.sort((a, b) => b.total_points - a.total_points);
        const mainRecord = guestPoints[0];

        await db.user_points.update({
            where: { id: mainRecord.id },
            data: { user_id: userId }
        });

        for (let i = 1; i < guestPoints.length; i++) {
            const record = guestPoints[i];
            await db.user_points.update({
                where: { id: mainRecord.id },
                data: {
                    total_points: { increment: record.total_points },
                    lifetime_earned: { increment: record.lifetime_earned },
                    lifetime_used: { increment: record.lifetime_used }
                }
            });
            await db.point_transactions.updateMany({
                where: { user_point_id: record.id },
                data: { user_point_id: mainRecord.id }
            });
            await db.user_points.delete({ where: { id: record.id } });
        }
    }

    /**
     * 결제에 대해 포인트를 적립합니다 (트랜잭션 내에서 사용).
     * @param {number} orderId
     * @param {number} paymentId
     * @param {number} storeId
     * @param {string} orderNumber
     * @param {string} phone - 고객 전화번호
     * @param {number} earnAmount - 적립할 포인트
     * @param {import('@prisma/client').PrismaTransactionClient} tx
     * @returns {Promise<object|null>} 적립 트랜잭션 레코드
     */
    async earn(orderId, paymentId, storeId, orderNumber, phone, earnAmount, tx) {
        if (earnAmount <= 0 || !phone) return null;

        // phone은 unique 키가 아니므로 upsert 불가 → findFirst + update/create
        let userPoint = await tx.user_points.findFirst({ where: { phone } });
        if (userPoint) {
            userPoint = await tx.user_points.update({
                where: { id: userPoint.id },
                data: {
                    total_points: { increment: earnAmount },
                    lifetime_earned: { increment: earnAmount }
                }
            });
        } else {
            userPoint = await tx.user_points.create({
                data: {
                    phone,
                    total_points: earnAmount,
                    lifetime_earned: earnAmount
                }
            });
        }

        // store_point_settings의 expiry_days 사용 (없으면 365일)
        const settings = await tx.store_point_settings.findUnique({
            where: { store_id: storeId }
        });
        const expiresAt = settings?.expiry_days
            ? new Date(Date.now() + settings.expiry_days * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        return tx.point_transactions.create({
            data: {
                user_point_id: userPoint.id,
                store_id: storeId,
                order_id: orderId,
                payment_id: paymentId,
                type: 'earn',
                amount: earnAmount,
                balance_after: userPoint.total_points + earnAmount,
                description: `주문(#${orderNumber}) 적립`,
                expires_at: expiresAt
            }
        });
    }

    /**
     * 포인트를 사용합니다 (트랜잭션 내에서 사용).
     * @param {number} orderId
     * @param {number} paymentId
     * @param {number} storeId
     * @param {string} orderNumber
     * @param {{ phone?: string, toss_user_key?: string }} identifier
     * @param {number} pointAmount - 사용할 포인트
     * @param {import('@prisma/client').PrismaTransactionClient} tx
     * @returns {Promise<object>} 사용 트랜잭션 레코드
     */
    async use(orderId, paymentId, storeId, orderNumber, identifier, pointAmount, tx) {
        const user = await this.findOrCreateUser(identifier, tx);
        if (!user || user.total_points < pointAmount) {
            throw new Error('포인트가 부족합니다');
        }

        const newBalance = user.total_points - pointAmount;
        await tx.user_points.update({
            where: { id: user.id },
            data: {
                total_points: newBalance,
                lifetime_used: { increment: pointAmount },
                updated_at: new Date()
            }
        });

        return tx.point_transactions.create({
            data: {
                user_point_id: user.id,
                store_id: storeId,
                order_id: orderId,
                payment_id: paymentId,
                type: 'use',
                amount: -pointAmount,
                balance_after: newBalance,
                description: `주문(#${orderNumber}) 포인트 사용`
            }
        });
    }

    /**
     * 결제 취소 시 포인트를 회수/복구합니다 (트랜잭션 내에서 사용).
     * @param {number} paymentId
     * @param {import('@prisma/client').PrismaTransactionClient} tx
     */
    async revertOnCancel(paymentId, tx) {
        const pointTxs = await tx.point_transactions.findMany({
            where: { payment_id: paymentId }
        });

        for (const pt of pointTxs) {
            if (pt.type === 'earn') {
                const user = await tx.user_points.findFirst({
                    where: { id: pt.user_point_id }
                });
                if (user) {
                    const newBalance = Math.max(0, user.total_points - pt.amount);
                    await tx.user_points.update({
                        where: { id: user.id },
                        data: { total_points: newBalance, lifetime_earned: { decrement: pt.amount }, updated_at: new Date() }
                    });
                    await tx.point_transactions.create({
                        data: {
                            user_point_id: user.id,
                            store_id: pt.store_id,
                            order_id: pt.order_id,
                            payment_id: pt.payment_id,
                            type: 'cancel_earn',
                            amount: -pt.amount,
                            balance_after: newBalance,
                            description: '결제 취소 포인트 회수'
                        }
                    });
                }
            } else if (pt.type === 'use') {
                const usedAmount = Math.abs(pt.amount);
                const user = await tx.user_points.findFirst({
                    where: { id: pt.user_point_id }
                });
                if (user) {
                    const newBalance = user.total_points + usedAmount;
                    await tx.user_points.update({
                        where: { id: user.id },
                        data: { total_points: newBalance, lifetime_used: { decrement: usedAmount }, updated_at: new Date() }
                    });
                    await tx.point_transactions.create({
                        data: {
                            user_point_id: user.id,
                            store_id: pt.store_id,
                            order_id: pt.order_id,
                            payment_id: pt.payment_id,
                            type: 'cancel_use',
                            amount: usedAmount,
                            balance_after: newBalance,
                            description: '결제 취소 포인트 복구'
                        }
                    });
                }
            }
        }
    }
}

module.exports = new PointsService();
