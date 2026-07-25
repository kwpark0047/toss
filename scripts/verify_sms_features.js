const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyFeatures() {
    console.log('--- [Feature Verification Start] ---');
    try {
        // 1. stores 테이블에 can_send_sms 필드 존재 여부 및 데이터 확인
        const storeSample = await prisma.stores.findFirst({
            select: { id: true, name: true, can_send_sms: true, address: true, business_type: true }
        });

        console.log('1. Store Permission Field Check:');
        if (storeSample && 'can_send_sms' in storeSample) {
            console.log(`   [SUCCESS] 'can_send_sms' field exists in 'stores' table.`);
            console.log(`   Sample Data: { id: ${storeSample.id}, name: "${storeSample.name}", can_send_sms: ${storeSample.can_send_sms} }`);
        } else {
            console.error(`   [FAILURE] 'can_send_sms' field NOT found in 'stores' table.`);
        }

        // 2. 통합 Bulk SMS 필터 옵션 추출 로직 검증
        const allStores = await prisma.stores.findMany({
            where: { is_active: true },
            select: { address: true, business_type: true }
        });

        const regions = [...new Set(allStores.map(s => s.address?.split(' ')[0]).filter(Boolean))];
        const businessTypes = [...new Set(allStores.map(s => s.business_type).filter(Boolean))];

        console.log('\n2. Bulk SMS Filter Options Logic Check:');
        console.log(`   Available Regions: ${regions.join(', ') || 'No regions found'}`);
        console.log(`   Available Business Types: ${businessTypes.join(', ') || 'No business types found'}`);

        if (regions.length > 0 || businessTypes.length > 0) {
            console.log(`   [SUCCESS] Filter options extracted correctly from store data.`);
        } else {
            console.warn(`   [WARNING] No regions or business types found. Check if store addresses/types are seeded.`);
        }

        // 3. 필터링 쿼리 시뮬레이션
        if (regions.length > 0) {
            const targetRegion = regions[0];
            const customersInRegion = await prisma.store_customers.count({
                where: {
                    stores: { address: { startsWith: targetRegion } }
                }
            });
            console.log(`\n3. Filtering Query Simulation:`);
            console.log(`   Total customers in region "${targetRegion}": ${customersInRegion}명`);
            console.log(`   [SUCCESS] Join query for bulk filtering is operational.`);
        }

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await prisma.$disconnect();
        console.log('\n--- [Feature Verification End] ---');
    }
}

verifyFeatures();
