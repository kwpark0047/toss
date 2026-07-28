const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const naverLocal = require('../services/naverLocalService');
const seoulData = require('../services/seoulDataService');
const geocodeSvc = require('../services/geocodeService');

exports.enrichNaver = catchAsync(async (req, res) => {
  if (!naverLocal.isConfigured()) {
    return res.status(503).json({ success: false, error: 'NAVER_CLIENT_SECRET 미설정' });
  }
  const limit = Math.min(50, Math.max(1, parseInt(req.body.limit, 10) || 10));
  const afterId = parseInt(req.body.afterId, 10) || 0;

  const stores = await prisma.stores.findMany({
    where: {
      id: { gt: afterId },
      OR: [
        { latitude: null },
        { phone: null },
        { business_type: null },
      ],
    },
    orderBy: { id: 'asc' },
    take: limit,
  });

  if (!stores.length) {
    return res.success({ processed: 0, matched: 0, updated: 0, results: [], nextCursor: 0, done: true });
  }

  let processed = 0, matched = 0, updated = 0;
  const results = [];

  for (const store of stores) {
    processed++;
    try {
      const out = await naverLocal.enrichStore(store);
      if (out) {
        matched++;
        await prisma.stores.update({ where: { id: store.id }, data: out.patch });
        updated++;
        results.push({ id: store.id, name: store.name, patch: out.patch });
      } else {
        results.push({ id: store.id, name: store.name });
      }
    } catch (err) {
      logger.warn({ storeId: store.id, error: err.message }, '네이버 보강 실패');
      results.push({ id: store.id, name: store.name, error: err.message });
    }
  }

  const lastId = stores[stores.length - 1].id;
  const remaining = await prisma.stores.count({
    where: {
      id: { gt: lastId },
      OR: [
        { latitude: null },
        { phone: null },
        { business_type: null },
      ],
    },
  });

  res.success({
    processed, matched, updated, results,
    nextCursor: lastId,
    done: remaining === 0,
  });
});

exports.enrichSeoul = catchAsync(async (req, res) => {
  if (!seoulData.isConfigured()) {
    return res.status(503).json({ success: false, error: 'SEOUL_OPENAPI_KEYS 미설정' });
  }
  const size = Math.min(1000, Math.max(1, parseInt(req.body.size, 10) || 300));
  const start = parseInt(req.body.start, 10) || 1;
  const end = start + size - 1;

  let total, rows;
  try {
    const page = await seoulData.fetchPage(start, end);
    total = page.total;
    rows = page.rows;
  } catch (err) {
    return res.status(502).json({ success: false, error: `서울 API 호출 실패: ${err.message}` });
  }

  const stores = await prisma.stores.findMany({
    where: { address: { contains: '서울', mode: 'insensitive' } },
    select: { id: true, name: true, address: true, phone: true, business_type: true, latitude: true, longitude: true },
  });

  if (!stores.length || !rows.length) {
    return res.success({
      processed: rows.length, matched: 0, updated: 0, nameFixed: 0,
      samples: [], nextStart: end + 1, done: end >= total,
    });
  }

  const storeIndex = {};
  for (const s of stores) {
    const key = seoulData.addrCore(s.address);
    if (key) {
      if (!storeIndex[key]) storeIndex[key] = [];
      storeIndex[key].push(s);
    }
  }

  let processed = 0, matched = 0, updated = 0, nameFixed = 0;
  const samples = [];

  for (const row of rows) {
    processed++;
    const seoulItem = seoulData.mapRow(row);
    const key = seoulData.addrCore(seoulItem.address);
    if (!key || !storeIndex[key]) continue;

    const candidate = storeIndex[key].find(s => {
      const sn = seoulData.normName(s.name);
      const rn = seoulData.normName(seoulItem.name);
      return sn && rn && (sn === rn || sn.includes(rn) || rn.includes(sn));
    });
    if (!candidate) continue;

    matched++;
    const patch = {};
    if (!candidate.phone && seoulItem.phone) patch.phone = seoulItem.phone;
    if (!candidate.business_type && seoulItem.businessType) patch.business_type = seoulItem.businessType;

    const patch2 = {};
    if (patch.phone || patch.business_type) {
      Object.assign(patch2, patch);
    }

    if (seoulItem.name && seoulData.normName(candidate.name) !== seoulData.normName(seoulItem.name)) {
      const origName = candidate.name;
      const wantName = seoulItem.name;
      const simpler = wantName.length < origName.length && origName.includes(wantName.slice(0, -2));
      const unwanted = seoulData.hasCorruptName(origName);
      if (simpler || unwanted) {
        patch2.name = wantName;
        nameFixed++;
      }
    }

    if (Object.keys(patch2).length) {
      await prisma.stores.update({ where: { id: candidate.id }, data: patch2 });
      updated++;
      if (samples.length < 5) samples.push({ was: candidate.name, patch: patch2 });
    }
  }

  res.success({
    processed: rows.length, matched, updated, nameFixed, samples,
    nextStart: end + 1,
    done: end >= total,
  });
});

exports.geocodeStores = catchAsync(async (req, res) => {
  if (!geocodeSvc.isConfigured()) {
    return res.status(503).json({ success: false, error: '지오코딩 키(KAKAO_REST_API_KEY) 미설정' });
  }
  const limit = Math.min(100, Math.max(1, parseInt(req.body.limit, 10) || 20));
  const afterId = parseInt(req.body.afterId, 10) || 0;

  const stores = await prisma.stores.findMany({
    where: {
      id: { gt: afterId },
      address: { not: null },
      OR: [
        { latitude: null },
        { longitude: null },
      ],
    },
    orderBy: { id: 'asc' },
    take: limit,
  });

  if (!stores.length) {
    return res.success({
      processed: 0, geocoded: 0, failed: 0, provider: geocodeSvc.provider(),
      samples: [], nextCursor: 0, done: true,
    });
  }

  let processed = 0, geocoded = 0, failed = 0;
  const samples = [];

  for (const store of stores) {
    processed++;
    try {
      const coord = await geocodeSvc.geocode(store.address);
      if (coord) {
        await prisma.stores.update({
          where: { id: store.id },
          data: { latitude: coord.lat, longitude: coord.lng },
        });
        geocoded++;
        if (samples.length < 5) samples.push({ name: store.name, lat: coord.lat, lng: coord.lng });
      } else {
        failed++;
      }
    } catch (err) {
      logger.warn({ storeId: store.id, error: err.message }, '지오코딩 실패');
      failed++;
    }
  }

  const lastId = stores[stores.length - 1].id;
  const remaining = await prisma.stores.count({
    where: {
      id: { gt: lastId },
      address: { not: null },
      OR: [{ latitude: null }, { longitude: null }],
    },
  });

  res.success({
    processed, geocoded, failed, provider: geocodeSvc.provider(), samples,
    nextCursor: lastId,
    done: remaining === 0,
  });
});
