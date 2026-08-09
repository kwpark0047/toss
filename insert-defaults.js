const { PrismaClient } = require('./prisma/app/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  // Insert default plans
  const plans = [
    {
      id: 'plan_free',
      name: 'free',
      display_name: 'Free',
      description: '기본 매장 운영 및 QR 코드 생성',
      price_monthly: 0,
      price_yearly: 0,
      features: {
        maxMenus: 50,
        maxStaff: 1,
        aiRecommendations: false,
        brandpay: false,
        analytics: 'basic',
        customDomain: false,
      },
      limits: { menuItems: 50, staff: 1, ordersPerMonth: 1000 },
      is_active: true,
      sort_order: 0,
      trial_days: 0,
    },
    {
      id: 'plan_pro',
      name: 'pro',
      display_name: 'Pro',
      description: '실시간 결제 및 부가 편의 기능',
      price_monthly: 20000,
      price_yearly: 200000,
      features: {
        maxMenus: 200,
        maxStaff: 10,
        aiRecommendations: true,
        brandpay: true,
        analytics: 'advanced',
        customDomain: true,
      },
      limits: { menuItems: 200, staff: 10, ordersPerMonth: 10000 },
      is_active: true,
      sort_order: 1,
      trial_days: 14,
    },
    {
      id: 'plan_enterprise',
      name: 'enterprise',
      display_name: 'Enterprise',
      description: '프리미엄 통합 매장 운영',
      price_monthly: 50000,
      price_yearly: 500000,
      features: {
        maxMenus: -1,
        maxStaff: -1,
        aiRecommendations: true,
        brandpay: true,
        analytics: 'premium',
        customDomain: true,
        dedicatedManager: true,
        apiAccess: true,
      },
      limits: { menuItems: -1, staff: -1, ordersPerMonth: -1 },
      is_active: true,
      sort_order: 2,
      trial_days: 30,
    },
  ];

  for (const plan of plans) {
    try {
      await prisma.$executeRaw`
        INSERT INTO "Plan" ("id", "name", "display_name", "description", "price_monthly", "price_yearly", "features", "limits", "is_active", "sort_order", "trial_days", "created_at", "updated_at")
        VALUES (${plan.id}, ${plan.name}, ${plan.display_name}, ${plan.description}, ${plan.price_monthly}, ${plan.price_yearly}, ${JSON.stringify(plan.features)}::jsonb, ${JSON.stringify(plan.limits)}::jsonb, ${plan.is_active}, ${plan.sort_order}, ${plan.trial_days}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("name") DO NOTHING
      `;
      console.log(`Plan ${plan.name} inserted`);
    } catch (e) {
      if (e.message.includes('duplicate')) {
        console.log(`Plan ${plan.name} already exists`);
      } else {
        console.error(`Error inserting ${plan.name}:`, e.message);
      }
    }
  }

  // Create subscriptions for existing stores
  const stores = await prisma.$queryRaw`SELECT id, plan, created_at FROM "stores"`;
  console.log(`Found ${stores.length} stores`);

  for (const store of stores) {
    const planMap = { pro: 'plan_pro', enterprise: 'plan_enterprise' };
    const planId = planMap[store.plan] || 'plan_free';

    try {
      // Check if subscription exists
      const existing =
        await prisma.$queryRaw`SELECT id FROM "Subscription" WHERE store_id = ${store.id}`;
      if (existing.length > 0) {
        console.log(`Store ${store.id} already has subscription`);
        continue;
      }

      const subId = require('crypto').randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "Subscription" ("id", "store_id", "plan_id", "status", "billing_cycle", "current_period_start", "current_period_end", "created_at", "updated_at")
        VALUES (${subId}, ${store.id}, ${planId}, 'active', 'MONTHLY', ${store.created_at}, ${new Date(new Date(store.created_at).getTime() + 30 * 24 * 60 * 60 * 1000)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      // Update stores.subscription_id
      await prisma.$executeRaw`UPDATE "stores" SET "subscription_id" = ${subId} WHERE id = ${store.id}`;
      console.log(`Created subscription for store ${store.id} (${planId})`);
    } catch (e) {
      console.error(`Error creating subscription for store ${store.id}:`, e.message);
    }
  }

  console.log('Done');
  await prisma.$disconnect();
}

main().catch((e) => console.error(e));
