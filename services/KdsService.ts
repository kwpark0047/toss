import prisma from '../config/prisma';
import AlimtalkService from './AlimtalkService';
import logger from '../utils/logger';
import { decryptPhone } from '../utils/phoneEncryption';

export interface KdsOrderItem {
    id: number;
    order_id: number;
    product_id: number | null;
    product_name: string;
    price: number;
    quantity: number;
    subtotal: number;
    options: string | null;
    user_phone: string | null;
    created_at: Date | null;
}

export interface KdsOrder {
    id: number;
    store_id: number;
    table_id: number | null;
    order_number: string;
    customer_name: string | null;
    customer_phone: string | null;
    customer_fcm_token: string | null;
    notes: string | null;
    status: string | null;
    method: string | null;
    payment_status: string | null;
    total_amount: number | null;
    queue_number: number | null;
    estimated_minutes: number | null;
    created_at: Date | null;
    toss_user_key: string | null;
    updated_at: Date | null;
    completed_at: Date | null;
    is_takeout: number | null;
    order_type: string | null;
    delivery_address: string | null;
    preparing_at: Date | null;
    ready_at: Date | null;
    split_type: string | null;
    is_split_payment: boolean | null;
    split_status: string | null;
    handled_by_staff_id: number | null;
    order_items?: KdsOrderItem[];
    items?: KdsOrderItem[];
    table_name?: string | null;
    store_name?: string | null;
}

class KdsService {
    /**
     * KDS 활성 주문 목록 조회 (pending, preparing, ready 상태)
     */
    async getActiveKdsOrders(storeId: string | number): Promise<KdsOrder[]> {
        try {
            const numericStoreId = typeof storeId === 'string' ? parseInt(storeId, 10) : storeId;
            if (isNaN(numericStoreId)) {
                throw new Error('올바르지 않은 매장 ID입니다.');
            }

            const activeStatuses = ['pending', 'preparing', 'ready'];

            const orders = await prisma.orders.findMany({
                where: {
                    store_id: numericStoreId,
                    status: { in: activeStatuses }
                },
                include: {
                    order_items: true,
                    tables: {
                        select: {
                            table_number: true
                        }
                    },
                    stores: {
                        select: {
                            name: true
                        }
                    }
                },
                orderBy: {
                    created_at: 'asc' // 오래된 주문이 위로 가게 함
                }
            });

            return orders.map(order => ({
                ...order,
                items: order.order_items || [],
                table_name: order.tables?.table_number || null,
                store_name: order.stores?.name || ''
            })) as KdsOrder[];
        } catch (error: any) {
            logger.error(`[KDS Service] getActiveKdsOrders failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * KDS 주문 상태 업데이트 및 자동 기능 트리거 (알림톡, 주방 프린터 잡)
     */
    async updateKdsOrderStatus(
        storeId: string | number, 
        orderId: string | number, 
        status: string, 
        staffId: string | number | null = null, 
        io: any = null
    ): Promise<KdsOrder> {
        try {
            const numericStoreId = typeof storeId === 'string' ? parseInt(storeId, 10) : storeId;
            const numericOrderId = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;

            if (isNaN(numericStoreId) || isNaN(numericOrderId)) {
                throw new Error('매장 ID 또는 주문 ID가 잘못되었습니다.');
            }

            // 1. 주문 데이터 확인
            const order = await prisma.orders.findUnique({
                where: { id: numericOrderId },
                include: {
                    order_items: true,
                    tables: {
                        select: { table_number: true }
                    },
                    stores: {
                        select: { name: true }
                    }
                }
            });

            if (!order || order.store_id !== numericStoreId) {
                throw new Error('주문을 찾을 수 없거나 해당 매장 소유가 아닙니다.');
            }

            // 2. 상태 전이 및 업데이트용 데이터 조립
            const updateData: any = {
                status,
                updated_at: new Date()
            };

            if (staffId !== null) {
                updateData.handled_by_staff_id = typeof staffId === 'string' ? parseInt(staffId, 10) : staffId;
            }

            if (status === 'preparing') {
                updateData.preparing_at = new Date();
            } else if (status === 'ready') {
                updateData.ready_at = new Date();
            } else if (status === 'completed') {
                updateData.completed_at = new Date();
            }

            // 3. 트랜잭션으로 상태 업데이트와 프린트 잡 생성을 일괄 처리
            const updatedOrder = await prisma.$transaction(async (tx: any) => {
                const res = await tx.orders.update({
                    where: { id: numericOrderId },
                    data: updateData,
                    include: {
                        order_items: true
                    }
                });

                // 조리 시작('preparing') 시 주방 전용 인쇄 작업(Base64 ESC/POS)을 큐에 자동 등록
                if (status === 'preparing') {
                    const payloadB64 = this.formatKitchenSlip({
                        ...order,
                        table_name: order.tables?.table_number || null
                    });

                    await tx.print_jobs.create({
                        data: {
                            store_id: numericStoreId,
                            order_id: numericOrderId,
                            kind: 'kitchen',
                            status: 'pending',
                            payload_b64: payloadB64
                        }
                    });
                    logger.info(`[KDS Service] KDS 주방 인쇄 작업 등록 성공: Order #${order.order_number}`);
                }

                return res;
            });

            // 4. 조리 완료('ready') 시 고객 전화번호 복호화 후 알림톡 자동 발송
            if (status === 'ready' && order.customer_phone) {
                setImmediate(async () => {
                    try {
                        const decryptedPhone = decryptPhone(order.customer_phone!);
                        if (decryptedPhone) {
                            await AlimtalkService.sendFoodReady(
                                decryptedPhone,
                                order.stores?.name || 'WeMarket',
                                order.order_number,
                                order.tables?.table_number || '픽업대'
                            );
                        }
                    } catch (err: any) {
                        logger.error(`[KDS Service] 알림톡 자동 전송 실패: ${err.message}`);
                    }
                });
            }

            // 5. Socket.io 실시간 브로드캐스팅
            if (io) {
                const payload = {
                    orderId: numericOrderId,
                    orderNumber: order.order_number,
                    status,
                    table_name: order.tables?.table_number || null
                };
                
                // 해당 매장 주방 룸에 전파
                io.to(`kitchen - ${numericStoreId}`).emit('kds:order_updated', payload);
                // 해당 매장 전체 룸에 전파 (태블릿, 매니저 동기화)
                io.to(`store - ${numericStoreId}`).emit('order_updated', payload);
                
                logger.info(`[KDS Socket] KDS 실시간 브로드캐스트 전송 완료: Store ${numericStoreId}, Order ${order.order_number} → ${status}`);
            }

            return {
                ...updatedOrder,
                table_name: order.tables?.table_number || null,
                store_name: order.stores?.name || ''
            } as KdsOrder;
        } catch (error: any) {
            logger.error(`[KDS Service] updateKdsOrderStatus failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * 주방 주문 영수증 슬립 텍스트 포맷터 및 Base64 인코더
     */
    formatKitchenSlip(order: KdsOrder | any): string {
        let slip = `==============================\n`;
        slip += `       KITCHEN ORDER SLIP     \n`;
        slip += `==============================\n`;
        slip += `주문번호 : ${order.order_number}\n`;
        slip += `구  분   : ${order.is_takeout ? '포장(TAKEOUT)' : '매장(DINE-IN)'}\n`;
        if (order.table_name) {
            slip += `테이블   : ${order.table_name}번\n`;
        }
        slip += `주문시간 : ${new Date(order.created_at!).toLocaleString('ko-KR')}\n`;
        slip += `------------------------------\n`;
        
        (order.order_items || []).forEach((item: any, idx: number) => {
            slip += `${idx + 1}. ${item.product_name} x ${item.quantity}\n`;
            if (item.options) {
                try {
                    const opts = JSON.parse(item.options);
                    Object.entries(opts).forEach(([key, val]) => {
                        slip += `   └ ${key}: ${val}\n`;
                    });
                } catch (_) {}
            }
        });
        
        slip += `==============================\n`;
        return Buffer.from(slip, 'utf-8').toString('base64');
    }
}

const kdsServiceInstance = new KdsService();
export = kdsServiceInstance;
