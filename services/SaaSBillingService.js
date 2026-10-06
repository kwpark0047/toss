const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const TossAPI = require('../utils/toss');
const { AppError } = require('../utils/errorHandler');
const { encryptToken, decryptToken } = require('../utils/tokenEncryption');
const { nextBillingPeriod, effectivePlan } = require('../utils/subscriptionPolicy');
const logger = require('../utils/logger');

const customerKey = (storeId) =>
  `sub-${crypto.createHash('sha256').update(String(storeId)).digest('hex')}`;
const price = (plan, cycle) => {
  const amount = cycle === 'YEARLY' ? plan.price_yearly : plan.price_monthly;
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new AppError('유료 플랜의 결제 금액이 설정되지 않았습니다.', 400);
  return amount;
};
const publicSubscription = (sub) =>
  sub && {
    id: sub.id,
    status: sub.status,
    billing_cycle: sub.billing_cycle,
    current_period_start: sub.current_period_start,
    current_period_end: sub.current_period_end,
    next_payment_at: sub.next_payment_at,
    last_payment_at: sub.last_payment_at,
    cancel_at: sub.cancel_at,
    auto_renew: sub.auto_renew,
    plan: sub.plan,
    effective_plan: effectivePlan(sub),
    has_payment_method: Boolean(sub.payment_method_id),
    pending_plan_change: sub.metadata?.pending_plan_change || null,
  };

class SaaSBillingService {
  async checkout(storeId, userId, planId, cycle, mode = 'subscribe') {
    if (!['subscribe', 'payment_method'].includes(mode))
      throw new AppError('유효한 구독 작업이 필요합니다.', 400);
    if (!['MONTHLY', 'YEARLY'].includes(cycle))
      throw new AppError('결제 주기가 올바르지 않습니다.', 400);
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan?.is_active) throw new AppError('활성 플랜을 찾을 수 없습니다.', 404);
    const amount = price(plan, cycle);
    const existing = await prisma.subscription.findUnique({ where: { store_id: storeId } });
    if (
      mode === 'payment_method' &&
      (!existing || existing.plan_id !== planId || existing.billing_cycle !== cycle)
    )
      throw new AppError('현재 구독의 결제수단만 변경할 수 있습니다.', 409);
    if (
      mode === 'subscribe' &&
      existing &&
      ['active', 'trialing'].includes(existing.status) &&
      existing.current_period_end > new Date()
    ) {
      throw new AppError('현재 구독의 플랜 변경은 다음 결제일에 예약해 주세요.', 409);
    }
    if (!process.env.TOSS_CLIENT_KEY || !process.env.JWT_SECRET)
      throw new AppError('구독 결제 설정이 필요합니다.', 503);
    const token = jwt.sign(
      { type: 'subscription_checkout', storeId, userId, planId, cycle, amount, mode },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' }
    );
    return {
      checkout_token: token,
      customer_key: customerKey(storeId),
      client_key: process.env.TOSS_CLIENT_KEY,
      plan: { id: plan.id, name: plan.display_name },
      amount,
      currency: 'KRW',
      billing_cycle: cycle,
    };
  }

  async activate(storeId, userId, authKey, token) {
    let claim;
    try {
      claim = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw new AppError('구독 결제 세션이 만료되었거나 유효하지 않습니다.', 403);
    }
    if (
      claim.type !== 'subscription_checkout' ||
      claim.storeId !== storeId ||
      claim.userId !== userId ||
      typeof authKey !== 'string' ||
      !authKey
    ) {
      throw new AppError('구독 결제 권한이 없습니다.', 403);
    }
    const plan = await prisma.plan.findUnique({ where: { id: claim.planId } });
    if (!plan?.is_active || price(plan, claim.cycle) !== claim.amount)
      throw new AppError('플랜 가격이 변경되었습니다. 다시 확인해 주세요.', 409);
    const billing = await TossAPI.issueBillingKeyFromAuth(authKey, customerKey(storeId));
    if (
      !billing?.billingKey ||
      billing.customerKey !== customerKey(storeId) ||
      billing.billingKey.startsWith('mock_')
    ) {
      throw new AppError('유효한 결제수단을 등록하지 못했습니다.', 502);
    }
    if (claim.mode === 'payment_method') {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public.stores WHERE id = ${storeId} FOR UPDATE`;
        const sub = await tx.subscription.findUnique({ where: { store_id: storeId } });
        if (!sub || sub.plan_id !== claim.planId)
          throw new AppError('구독이 변경되었습니다. 다시 확인해 주세요.', 409);
        await tx.subscription.update({
          where: { id: sub.id },
          data: { payment_method_id: encryptToken(billing.billingKey) },
        });
      });
      return this.summary(storeId);
    }
    const invoice = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.stores WHERE id = ${storeId} FOR UPDATE`;
      const current = await tx.subscription.findUnique({ where: { store_id: storeId } });
      if (
        current &&
        ['active', 'trialing'].includes(current.status) &&
        current.current_period_end > new Date()
      )
        throw new AppError('이미 활성 구독이 있습니다.', 409);
      const unsettled =
        current &&
        (await tx.billingInvoice.findFirst({
          where: {
            subscription_id: current.id,
            status: { in: ['pending', 'processing', 'failed', 'manual_review'] },
          },
        }));
      if (unsettled) throw new AppError('처리 중인 청구서를 먼저 확인해 주세요.', 409);
      const now = new Date();
      const data = {
        plan_id: plan.id,
        status: 'incomplete',
        billing_cycle: claim.cycle,
        payment_method_id: encryptToken(billing.billingKey),
        auto_renew: true,
        cancel_at: null,
        canceled_at: null,
        current_period_start: now,
        current_period_end: now,
        metadata: {
          automatic_payment_consent: {
            user_id: userId,
            recorded_at: now.toISOString(),
            plan_id: plan.id,
            billing_cycle: claim.cycle,
            amount: claim.amount,
            notice_version: '2026-10-06',
          },
        },
      };
      const subscription = await tx.subscription.upsert({
        where: { store_id: storeId },
        create: { store_id: storeId, ...data },
        update: data,
      });
      // Card registration alone must not grant paid entitlements.
      return tx.billingInvoice.create({
        data: {
          subscription_id: subscription.id,
          store_id: storeId,
          plan_id: plan.id,
          billing_cycle: claim.cycle,
          order_id: `wm-sub-${crypto.randomUUID()}`,
          amount: claim.amount,
          period_start: now,
          period_end: nextBillingPeriod(now, claim.cycle),
        },
      });
    });
    await this.chargeInvoice(invoice.id);
    return this.summary(storeId);
  }

  async chargeInvoice(id) {
    const invoice = await prisma.billingInvoice.findUnique({
      where: { id },
      include: { subscription: { include: { plan: true } } },
    });
    if (!invoice) throw new AppError('청구서를 찾을 수 없습니다.', 404);
    if (invoice.status === 'paid') return { paid: true, alreadyPaid: true };
    if (invoice.status === 'manual_review' || invoice.attempts >= 3)
      throw new AppError('청구서를 운영자가 확인해야 합니다.', 409);
    const now = new Date();
    const sub = invoice.subscription;
    const claim = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.stores WHERE id = ${sub.store_id} FOR UPDATE`;
      const current = await tx.subscription.findUnique({ where: { id: sub.id } });
      // Initial invoices are incomplete; renewals require current renewal consent.
      if (current.auto_renew === false || current.cancel_at) {
        await tx.billingInvoice.updateMany({
          where: { id, status: { in: ['pending', 'failed'] } },
          data: { status: 'void', next_retry_at: null },
        });
        return { count: 0 };
      }
      return tx.billingInvoice.updateMany({
        where: {
          id,
          attempts: { lt: 3 },
          OR: [
            {
              status: { in: ['pending', 'failed'] },
              OR: [{ next_retry_at: null }, { next_retry_at: { lte: now } }],
            },
            { status: 'processing', claimed_at: { lt: new Date(now.getTime() - 120_000) } },
          ],
        },
        data: { status: 'processing', claimed_at: now, attempts: { increment: 1 } },
      });
    });
    if (claim.count !== 1)
      throw new AppError('청구가 이미 처리 중이거나 재시도 대기 중입니다.', 409);
    try {
      if (!sub.payment_method_id) throw new AppError('결제수단을 등록해 주세요.', 400);
      // The same order ID and provider idempotency key are retained after response loss.
      const result = await TossAPI.payWithBillingKey(
        decryptToken(sub.payment_method_id),
        customerKey(sub.store_id),
        invoice.amount,
        invoice.order_id,
        `WeMarket ${sub.plan.display_name || sub.plan.name}`
      );
      if (
        result.status !== 'DONE' ||
        Number(result.totalAmount) !== invoice.amount ||
        result.orderId !== invoice.order_id ||
        !result.paymentKey
      ) {
        const error = new AppError('결제 확인 금액이나 주문 번호가 일치하지 않습니다.', 502);
        error.manualReview = true;
        throw error;
      }
      const paidAt = new Date(result.approvedAt || now);
      if (!Number.isFinite(paidAt.getTime()))
        throw Object.assign(new Error('Invalid approval time'), { manualReview: true });
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public.stores WHERE id = ${sub.store_id} FOR UPDATE`;
        const current = await tx.subscription.findUnique({ where: { id: sub.id } });
        await tx.billingInvoice.update({
          where: { id },
          data: {
            status: 'paid',
            payment_key: encryptToken(result.paymentKey),
            paid_at: paidAt,
            receipt_url: result.receipt?.url || null,
            failure_code: null,
            next_retry_at: null,
          },
        });
        // Late completion of an older invoice must never shorten newer entitlements.
        if (current.current_period_end > invoice.period_end) return;
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            plan_id: invoice.plan_id,
            billing_cycle: invoice.billing_cycle,
            status: 'active',
            current_period_start: invoice.period_start,
            current_period_end: invoice.period_end,
            last_payment_at: paidAt,
            next_payment_at: current.auto_renew === false ? null : invoice.period_end,
            metadata: {
              ...(current.metadata || {}),
              pending_plan_change: null,
              renewal_consent: null,
              automatic_payment_consent: {
                ...(current.metadata?.automatic_payment_consent || {}),
                amount: invoice.amount,
                plan_id: invoice.plan_id,
                billing_cycle: invoice.billing_cycle,
              },
            },
          },
        });
        const plan = (await tx.plan?.findUnique({ where: { id: invoice.plan_id } })) || sub.plan;
        await tx.stores.update({ where: { id: sub.store_id }, data: { plan: plan.name } });
        await tx.store_subscriptions.upsert({
          where: { store_id: sub.store_id },
          create: {
            store_id: sub.store_id,
            plan: plan.name,
            plan_expires_at: invoice.period_end,
            billing_cycle: invoice.billing_cycle,
            auto_renew: current.auto_renew !== false,
          },
          update: {
            plan: plan.name,
            plan_expires_at: invoice.period_end,
            last_payment_at: paidAt,
            next_payment_at: current.auto_renew === false ? null : invoice.period_end,
            auto_renew: current.auto_renew !== false,
          },
        });
      });
      return { paid: true, invoice_id: id };
    } catch (error) {
      const manual = error.manualReview || invoice.attempts + 1 >= 3;
      await prisma.$transaction(async (tx) => {
        await tx.billingInvoice.update({
          where: { id },
          data: {
            status: manual ? 'manual_review' : 'failed',
            failure_code: String(error.code || 'BILLING_FAILED').slice(0, 100),
            next_retry_at: manual
              ? null
              : new Date(now.getTime() + (invoice.attempts + 1) * 24 * 60 * 60 * 1000),
          },
        });
        await tx.subscription.update({ where: { id: sub.id }, data: { status: 'past_due' } });
      });
      logger.error('Subscription charge failed', {
        invoiceId: id,
        code: error.code || 'BILLING_FAILED',
      });
      throw new AppError(
        '구독 결제가 완료되지 않았습니다. 청구 상태와 결제수단을 확인해 주세요.',
        502
      );
    }
  }

  async summary(storeId) {
    const sub = await prisma.subscription.findUnique({
      where: { store_id: storeId },
      include: { plan: true },
    });
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const [menus, staff, orders] = await Promise.all([
      prisma.products.count({ where: { store_id: storeId } }),
      prisma.staff.count({ where: { store_id: storeId, is_active: 1 } }),
      prisma.orders.count({ where: { store_id: storeId, created_at: { gte: start } } }),
    ]);
    const { planLimit } = require('../utils/planQuota');
    return {
      subscription: publicSubscription(sub),
      effective_plan: effectivePlan(sub),
      usage: { maxMenus: menus, maxStaff: staff, ordersPerMonth: orders },
      limits: Object.fromEntries(
        ['maxMenus', 'maxStaff', 'ordersPerMonth'].map((key) => [key, planLimit(sub, key)])
      ),
      usage_period_start: start,
    };
  }

  invoices(storeId) {
    return prisma.billingInvoice.findMany({
      where: { store_id: storeId },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        billing_cycle: true,
        period_start: true,
        period_end: true,
        attempts: true,
        next_retry_at: true,
        paid_at: true,
        receipt_url: true,
        failure_code: true,
      },
    });
  }

  async retryInvoice(storeId, invoiceId) {
    const result = await prisma.billingInvoice.updateMany({
      where: { id: invoiceId, store_id: storeId, status: 'failed', attempts: { lt: 3 } },
      data: { next_retry_at: new Date() },
    });
    if (result.count !== 1) throw new AppError('재시도 가능한 청구서가 없습니다.', 409);
    return this.chargeInvoice(invoiceId);
  }

  async cancel(storeId) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.stores WHERE id = ${storeId} FOR UPDATE`;
      const sub = await tx.subscription.findUnique({ where: { store_id: storeId } });
      if (!sub) throw new AppError('구독을 찾을 수 없습니다.', 404);
      const processing = await tx.billingInvoice.findFirst({
        where: { subscription_id: sub.id, status: 'processing' },
      });
      if (processing)
        throw new AppError('결제 처리 중입니다. 청구 상태 확인 후 해지를 다시 요청해 주세요.', 409);
      await tx.billingInvoice.updateMany({
        where: { subscription_id: sub.id, status: { in: ['pending', 'failed'] } },
        data: { status: 'void', next_retry_at: null },
      });
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          auto_renew: false,
          cancel_at: sub.current_period_end,
          canceled_at: new Date(),
          next_payment_at: null,
        },
      });
      await tx.store_subscriptions.updateMany({
        where: { store_id: storeId },
        data: { auto_renew: false },
      });
      return { cancel_at: sub.current_period_end, auto_renew: false };
    });
  }

  async resume(storeId, userId) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.stores WHERE id = ${storeId} FOR UPDATE`;
      const sub = await tx.subscription.findUnique({
        where: { store_id: storeId },
        include: { plan: true },
      });
      if (!sub || effectivePlan(sub) === 'free' || !sub.payment_method_id)
        throw new AppError('활성 구독과 결제수단이 필요합니다.', 409);
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          auto_renew: true,
          cancel_at: null,
          canceled_at: null,
          next_payment_at: sub.current_period_end,
        },
      });
      await tx.store_subscriptions.updateMany({
        where: { store_id: storeId },
        data: { auto_renew: true },
      });
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          metadata: {
            ...(sub.metadata || {}),
            renewal_consent: {
              user_id: userId,
              recorded_at: new Date().toISOString(),
              amount: price(sub.plan, sub.billing_cycle),
              notice_version: '2026-10-06',
            },
          },
        },
      });
      return { auto_renew: true, next_payment_at: sub.current_period_end };
    });
  }

  async schedulePlan(storeId, planId, cycle, userId) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.stores WHERE id = ${storeId} FOR UPDATE`;
      const [sub, plan] = await Promise.all([
        tx.subscription.findUnique({ where: { store_id: storeId }, include: { plan: true } }),
        tx.plan.findUnique({ where: { id: planId } }),
      ]);
      if (!sub || effectivePlan(sub) === 'free' || !sub.auto_renew)
        throw new AppError('자동 갱신 중인 활성 구독이 필요합니다.', 409);
      if (!plan?.is_active || !['MONTHLY', 'YEARLY'].includes(cycle))
        throw new AppError('유효한 플랜과 결제 주기가 필요합니다.', 400);
      price(plan, cycle);
      const invoice = await tx.billingInvoice.findUnique({
        where: {
          subscription_id_period_start: {
            subscription_id: sub.id,
            period_start: sub.current_period_end,
          },
        },
      });
      if (invoice)
        throw new AppError('다음 청구가 이미 생성되었습니다. 청구 완료 후 변경해 주세요.', 409);
      const pending = {
        plan_id: planId,
        billing_cycle: cycle,
        scheduled_at: sub.current_period_end.toISOString(),
        amount: price(plan, cycle),
        user_id: userId,
        consent_recorded_at: new Date().toISOString(),
      };
      await tx.subscription.update({
        where: { id: sub.id },
        data: { metadata: { ...(sub.metadata || {}), pending_plan_change: pending } },
      });
      return pending;
    });
  }

  async runDueBilling() {
    const now = new Date();
    await prisma.billingInvoice.updateMany({
      where: {
        status: 'processing',
        attempts: { gte: 3 },
        claimed_at: { lt: new Date(now.getTime() - 120_000) },
      },
      data: { status: 'manual_review', failure_code: 'OUTCOME_UNKNOWN', next_retry_at: null },
    });
    const due = await prisma.subscription.findMany({
      where: {
        auto_renew: true,
        cancel_at: null,
        status: { in: ['active', 'trialing'] },
        current_period_end: { lte: now },
        payment_method_id: { not: null },
      },
      include: { plan: true },
      take: 100,
    });
    for (const sub of due) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM public.stores WHERE id = ${sub.store_id} FOR UPDATE`;
          const current = await tx.subscription.findUnique({
            where: { id: sub.id },
            include: { plan: true },
          });
          if (
            !current.auto_renew ||
            current.cancel_at ||
            !['active', 'trialing'].includes(current.status) ||
            current.current_period_end > now
          )
            return;
          const pending = current.metadata?.pending_plan_change;
          const plan = pending?.plan_id
            ? await tx.plan.findUnique({ where: { id: pending.plan_id } })
            : current.plan;
          if (!plan?.is_active) throw new Error('Inactive billing plan');
          const cycle = pending?.billing_cycle || current.billing_cycle;
          const agreedAmount =
            pending?.amount ??
            current.metadata?.renewal_consent?.amount ??
            current.metadata?.automatic_payment_consent?.amount;
          if (agreedAmount !== price(plan, cycle))
            throw new Error('Renewal price requires new customer consent');
          const start = current.current_period_end;
          await tx.billingInvoice.upsert({
            where: {
              subscription_id_period_start: { subscription_id: sub.id, period_start: start },
            },
            update: {},
            create: {
              subscription_id: sub.id,
              store_id: sub.store_id,
              plan_id: plan.id,
              billing_cycle: cycle,
              amount: agreedAmount,
              order_id: `wm-sub-${crypto.randomUUID()}`,
              period_start: start,
              period_end: nextBillingPeriod(start, cycle),
            },
          });
        });
      } catch (error) {
        logger.error('Renewal invoice creation failed', {
          subscriptionId: sub.id,
          error: error.message,
        });
      }
    }
    const pending = await prisma.billingInvoice.findMany({
      where: {
        OR: [
          {
            status: { in: ['pending', 'failed'] },
            attempts: { lt: 3 },
            OR: [{ next_retry_at: null }, { next_retry_at: { lte: now } }],
          },
          {
            status: 'processing',
            attempts: { lt: 3 },
            claimed_at: { lt: new Date(now.getTime() - 120_000) },
          },
        ],
      },
      take: 100,
      orderBy: { created_at: 'asc' },
    });
    for (const invoice of pending) {
      try {
        await this.chargeInvoice(invoice.id);
      } catch {
        /* Each invoice retains its failure and retry state. */
      }
    }
    // Expired/canceled subscriptions lose paid access even when no billing method exists.
    await prisma.$transaction(async (tx) => {
      const expired = await tx.subscription.findMany({
        where: {
          current_period_end: { lte: now },
          OR: [{ auto_renew: false }, { payment_method_id: null }],
        },
        take: 100,
      });
      for (const sub of expired) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: sub.cancel_at ? 'canceled' : 'expired' },
        });
        await tx.stores.update({ where: { id: sub.store_id }, data: { plan: 'free' } });
        await tx.store_subscriptions.updateMany({
          where: { store_id: sub.store_id },
          data: { plan: 'free', auto_renew: false },
        });
      }
    });
    return { subscriptions_scanned: due.length, invoices_processed: pending.length };
  }
}
module.exports = new SaaSBillingService();
