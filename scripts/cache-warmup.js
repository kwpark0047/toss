
const prisma = require('../config/prisma');
const dbCache = require('../utils/dbCache');
const Order = require('../repositories/Order');
const Product = require('../repositories/Product');

async function warmUpCache() {
    console.log('[CacheWarmUp] Starting cache warm-up...');
    
    try {
        // Get top 20 stores by order count
        const topStores = await prisma.orders.groupBy({
            by: ['store_id'],
            _count: { store_id: true },
            orderBy: { _count: { store_id: 'desc' } },
            take: 20,
        });

        for (const store of topStores) {
            const storeId = store.store_id;
            console.log(`[CacheWarmUp] Warming up store ${storeId}`);
            
            // Warm up popular products
            const stats = await Order.getDetailedStats(storeId, 
                new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
                new Date().toISOString().split('T')[0]
            );
            
            const popularProducts = stats.products.slice(0, 10).map(p => p.product_name);
            const cacheKey = `popular_products:store:${storeId}:${new Date().toISOString().split('T')[0]}`;
            dbCache.set(cacheKey, popularProducts, 3600);
            
            console.log(`[CacheWarmUp] Cached ${popularProducts.length} popular products for store ${storeId}`);
        }
        
        console.log('[CacheWarmUp] Cache warm-up completed successfully');
    } catch (err) {
        console.error('[CacheWarmUp] Failed:', err.message);
    }
}

if (require.main === module) {
    warmUpCache().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { warmUpCache };
