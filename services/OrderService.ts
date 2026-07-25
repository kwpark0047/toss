import prisma from '../config/prisma';
import Order from '../repositories/Order';
import Coupon from '../repositories/Coupon';
import Table from '../repositories/Table';
import Product from '../repositories/Product';
import notificationService from './notificationService';
import webhookDispatcher from './webhookDispatcher';
import printService from './printService';
import logger from '../utils/logger';
import { encryptPhone, decryptPhone, normalizePhone } from '../utils/phoneEncryption';

interface OrderItem {
  product_id?: number;
  product_name?: string;
  quantity: number;
  price: number;
  options?: Record<string, any>;
  user_phone?: string;
}

interface CreateOrderData {
  user_coupon_id?: number;
  store_id: string | number;
  table_id?: string | number;
  table_number?: string;
  items: OrderItem[];
  total_amount: number;
  phone?: string;
  customer_phone?: string;
  payment_method?: string;
  method?: string;
  latitude?: number;
  longitude?: number;
  toss_user_key?: string;
  customer_name?: string;
}

interface OrderFilters {
  status?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

class OrderService {
  private io: any;

  constructor(io?: any) {
    this.io = io;
  }

  async createOrder(data: CreateOrderData) {
    const { user_coupon_id, store_id, table_id, table_number, items, total_amount, phone, customer_phone, payment_method, method, latitude, longitude } = data;
    let discount_amount = 0;

    const Store = require('../repositories/Store');
    const store = await Store.findById(store_id);
    if (!store) {
      throw new Error('매장을 찾을 수 없습니다.');
    }

    if (table_id && latitude && longitude && store.latitude && store.longitude) {
      const distanceKm = this.getDistanceFromLatLonInKm(latitude, longitude, store.latitude, store.longitude);
      if (distanceKm > 0.5) {
        throw new Error('매장 반경 500m 밖에서는 주문할 수 없습니다.');
      }
    }

    if (user_coupon_id) {
      const userCoupon = await Coupon.findUserCoupon(user_coupon_id);
      if (!userCoupon || userCoupon.status !== 'UNUSED') {
        throw new Error('유효하지 않은 쿠폰입니다.');
      }
      const coupon = userCoupon.coupons;
      if (coupon.type === 'FIXED') {
        discount_amount = coupon.amount;
      } else if (coupon.type === 'PERCENT') {
        discount_amount = Math.floor(total_amount * (coupon.amount / 100));
      }
      if (total_amount < coupon.min_order_amount) {
        throw new Error(`최소 ${coupon.min_order_amount.toLocaleString()}원 이상 주문 시 사용 가능합니다.`);
      }
    }

    const storeIdNum = parseInt(String(store_id));
    let resolvedTableId: number | null = null;
    let resolvedTableName: string | null = null;
    let lookupStr = table_number || (table_id && isNaN(parseInt(String(table_id))) ? String(table_id) : null);
    if (lookupStr && lookupStr.endsWith('번')) { lookupStr = lookupStr.replace('번', ''); }

    if (lookupStr) {
      const table = await Table.findByStoreAndTable(storeIdNum, lookupStr);
      resolvedTableId = table?.id || null;
      resolvedTableName = table?.table_number || lookupStr;
    } else if (table_id && !isNaN(parseInt(String(table_id)))) {
      resolvedTableId = parseInt(String(table_id));
      const table = await Table.findById(resolvedTableId);
      resolvedTableName = table?.table_number || null;
    }

    if (items && items.length > 0) {
      const insufficient: string[] = [];
      for (const item of items) {
        if (!item.product_id) continue;
        const product = await Product.findById(item.product_id);
        if (!product) continue;
        if (product.is_sold_out) {
          insufficient.push(`'${product.name}' 품절`);
        } else if (product.stock_quantity !== null && product.stock_quantity < (item.quantity || 1)) {
          insufficient.push(`'${product.name}' 재고 부족 (재고 ${product.stock_quantity}개)`);
        }
      }
      if (insufficient.length > 0) {
        throw new Error(insufficient.join(', '));
      }
    }

    const final_amount = Math.max(0, total_amount - discount_amount);
    const orderNumber = this.generateOrderNumber();
    const customerPhone = phone || customer_phone;

    const result = await prisma.$transaction(async (tx: any) => {
      const order = await tx.orders.create({
        data: {
          store_id: storeIdNum,
          order_number: orderNumber,
          table_id: resolvedTableId,
          table_number: resolvedTableName,
          customer_phone: customerPhone ? encryptPhone(customerPhone) : null,
          customer_name: data.customer_name || null,
          total_amount: final_amount,
          discount_amount,
          status: 'pending',
          method: method || payment_method || 'card',
          toss_user_key: data.toss_user_key || null,
          created_at: new Date(),
          updated_at: new Date(),
          order_items: {
            create: items.map((item: OrderItem) => ({
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.price * item.quantity,
              options: item.options ? JSON.stringify(item.options) : null,
              user_phone: item.user_phone ? encryptPhone(item.user_phone) : null
            }))
          }
        },
        include: { order_items: true }
      });

      if (user_coupon_id) {
        await tx.user_coupons.update({
          where: { id: user_coupon_id },
          data: { status: 'USED', used_at: new Date() }
        });
      }

      if (resolvedTableId) {
        await tx.tables.update({
          where: { id: resolvedTableId },
          data: { status: 'occupied', current_order_id: order.id }
        });
      }

      return order;
    });

    if (this.io) {
      this.io.to(`store - ${storeIdNum}`).emit('new-order', {
        ...result,
        table_number: resolvedTableName
      });
    }

    try {
      await printService.printOrder(result, storeIdNum);
    } catch (printError) {
      logger.error('프린트 실패 (주문은 성공):', printError);
    }

    try {
      await webhookDispatcher.dispatch(storeIdNum, 'order.created', {
        order_id: result.id,
        order_number: result.order_number,
        total_amount: final_amount,
        items: items.length
      });
    } catch (webhookError) {
      logger.error('웹훅 전송 실패:', webhookError);
    }

    return {
      ...result,
      customer_phone: customerPhone
    };
  }

  async getOrder(orderId: number) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('주문을 찾을 수 없습니다.');
    }
    return order;
  }

  async getOrderByNumber(orderNumber: string) {
    const order = await Order.findByOrderNumber(orderNumber);
    if (!order) {
      throw new Error('주문을 찾을 수 없습니다.');
    }
    return order;
  }

  async getOrdersByStore(storeId: number, filters: OrderFilters = {}) {
    return await Order.findByStoreId(storeId, filters);
  }

  async updateOrderStatus(orderId: number, status: string) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('주문을 찾을 수 없습니다.');
    }

    const updated = await Order.updateStatus(orderId, status);

    if (this.io) {
      this.io.to(`store - ${order.store_id}`).emit('order-status-updated', {
        order_id: orderId,
        order_number: order.order_number,
        status,
        table_id: order.table_id
      });
    }

    return updated;
  }

  async cancelOrder(orderId: number, reason?: string) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('주문을 찾을 수 없습니다.');
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new Error('이미 완료되거나 취소된 주문입니다.');
    }

    const updated = await Order.updateStatus(orderId, 'cancelled');

    if (order.table_id) {
      await Table.updateStatus(order.table_id, 'available');
    }

    if (this.io) {
      this.io.to(`store - ${order.store_id}`).emit('order-cancelled', {
        order_id: orderId,
        order_number: order.order_number,
        reason
      });
    }

    return updated;
  }

  private generateOrderNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${dateStr}-${randomStr}`;
  }

  private getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export default OrderService;
