const fs = require('fs');
let code = fs.readFileSync('services/OrderService.js', 'utf8');
const searchStr = 'async _processInventory(order) {';
const searchEnd = 'async _restoreInventory';
const startIdx = code.indexOf(searchStr);
const endIdx = code.indexOf(searchEnd);

const replacement = `async _processInventory(order) {
        const items = await prisma.order_items.findMany({
            where: { order_id: order.id },
            select: { product_id: true, quantity: true }
        });
        for (const item of items) {
            if (!item.product_id) continue;
            const result = await prisma.$transaction(async (tx) => {
                const product = await tx.products.findUnique({
                    where: { id: item.product_id },
                    select: { id: true, name: true, store_id: true, stock_quantity: true, low_stock_threshold: true }
                });
                if (!product || product.stock_quantity === null) return null;
                if (product.stock_quantity < item.quantity) {
                    await tx.products.update({ where: { id: item.product_id }, data: { is_sold_out: true } });
                    return { is_sold_out: true, name: product.name, store_id: product.store_id, productId: product.id, newQty: 0, threshold: product.low_stock_threshold };
                }
                const newQty = product.stock_quantity - item.quantity;
                const is_sold_out = newQty === 0;
                await tx.products.update({
                    where: { id: item.product_id },
                    data: { stock_quantity: newQty, is_sold_out }
                });
                await tx.stock_history.create({
                    data: {
                        product_id: item.product_id, store_id: product.store_id,
                        change: -item.quantity, qty_after: newQty,
                        reason: 'ORDER', order_id: order.id
                    }
                });
                return { is_sold_out, name: product.name, store_id: product.store_id, productId: product.id, newQty, threshold: product.low_stock_threshold };
            });
            if (result) {
                if (result.newQty <= result.threshold) {
                    notificationService.notifyLowStockDB({ id: item.product_id, stock_quantity: result.newQty }).catch(() => {});
                }
                if (this.io && result.is_sold_out) {
                    this.io.to('store - ' + result.store_id).emit('product-updated', {
                        productId: result.productId,
                        is_sold_out: true,
                        name: result.name
                    });
                }
            }
        }
    }

    `;
code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
fs.writeFileSync('services/OrderService.js', code);
