const fs = require('fs');
const file = 'services/NotificationService.js';
let content = fs.readFileSync(file, 'utf8');

const matchFuncPattern = /\/\*\* 주문 \?성 \?\?NEW_ORDER \?림 \([\s\S]*?link: `\/admin\/stores\/\${order\.store_id}\/orders`\n    \}\);\n  \}/;

const newFunc = `  /** 주문 생성 시 NEW_ORDER 알림 (관리자 커스텀 템플릿 우선 적용) */
  async notifyNewOrderDB(order) {
    const tableName = order.table_name || '매장';
    const orderNumber = order.order_number || order.id;
    const tpl = await resolveTemplate(order.store_id, 'NEW_ORDER', {
      tableName, orderNumber, storeId: order.store_id,
    });
    
    const record = await this.createNotification({
      store_id: order.store_id,
      type: 'NEW_ORDER',
      title: tpl?.title || '신규 주문 접수',
      message: tpl?.message || \`\${tableName}에서 주문이 들어왔습니다. (주문번호: \${orderNumber})\`,
      data: { orderId: order.id, orderNumber: order.order_number, tableId: order.table_id },
      priority: 'high',
      link: \`/admin/stores/\${order.store_id}/orders\`
    });

    // Send FCM Push to Store Owner
    try {
      const store = await prisma.stores.findUnique({
        where: { id: Number(order.store_id) },
        select: { user_id: true, name: true },
      });
      if (store?.user_id) {
        const owner = await prisma.users.findUnique({
          where: { id: store.user_id },
          select: { fcm_token: true },
        });
        if (owner?.fcm_token) {
          await this.sendPush(owner.fcm_token, {
            title: \`[\${store.name}] 신규 주문!\`,
            body: \`\${tableName}에서 새 주문이 들어왔습니다.\`,
            data: { type: 'NEW_ORDER', store_id: order.store_id, order_id: order.id },
          });
        }
      }
    } catch (err) {
      logger.warn(\`[NEW_ORDER FCM] store \${order.store_id} 발송 실패: \${err.message}\`);
    }

    return record;
  }`;

content = content.replace(matchFuncPattern, newFunc);
fs.writeFileSync(file, content);
console.log('Fixed FCM in NotificationService');
