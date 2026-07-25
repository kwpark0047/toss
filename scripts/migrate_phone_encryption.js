/**
 * 전화번호 암호화 마이그레이션 스크립트
 *
 * 기존 평문 전화번호를 AES-256-CBC로 암호화합니다.
 * 이미 암호화된 값(enc: 접두사)은 건너뜁니다.
 *
 * 사용법: node scripts/migrate_phone_encryption.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { encryptPhone, isEncrypted } = require('../utils/phoneEncryption');

const prisma = new PrismaClient();

// 마이그레이션 대상: 테이블명 → { 필드명, where 조건 }
const TARGETS = [
  { table: 'orders',            field: 'customer_phone', where: {} },
  { table: 'orders',            field: 'user_phone',     where: {} },
  { table: 'payments',          field: 'payer_phone',    where: {} },
  { table: 'order_items',       field: 'user_phone',     where: {} },
  { table: 'store_customers',   field: 'customer_phone',  where: {} },
  { table: 'user_coupons',      field: 'customer_phone',  where: {} },
  { table: 'waiting_list',      field: 'customer_phone',  where: {} },
  { table: 'reservations',      field: 'customer_phone',  where: {} },
  { table: 'reviews',           field: 'customer_phone',  where: {} },
  { table: 'chat_rooms',        field: 'customer_phone',  where: {} },
  { table: 'store_favorites',   field: 'customer_phone',  where: {} },
  { table: 'shared_cart_items', field: 'customer_phone',  where: {} },
  { table: 'users',             field: 'phone',           where: {} },
  { table: 'user_points',       field: 'phone',           where: {} },
  { table: 'point_transactions',field: 'phone',           where: {} },
  { table: 'phone_otps',        field: 'phone',           where: {} },
  { table: 'staff',             field: 'phone',           where: {} },
  { table: 'stores',            field: 'phone',           where: {} },
  { table: 'stores',            field: 'customer_service_phone', where: {} },
];

async function migrate() {
  if (!process.env.PHONE_ENC_KEY && !process.env.JWT_SECRET) {
    console.error('[ERROR] PHONE_ENC_KEY 또는 JWT_SECRET이 설정되지 않았습니다.');
    process.exit(1);
  }

  console.log('[Migration] 전화번호 암호화 마이그레이션 시작...');
  console.log(`[Migration] 암호화 키 출처: ${process.env.PHONE_ENC_KEY ? 'PHONE_ENC_KEY' : 'JWT_SECRET'}\n`);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const target of TARGETS) {
    const { table, field, where } = target;
    try {
      const records = await prisma[table].findMany({
        where: { ...where, [field]: { not: null } },
        select: { id: true, [field]: true },
      });

      if (records.length === 0) continue;

      totalProcessed += records.length;
      let updated = 0;
      let skipped = 0;

      for (const record of records) {
        const value = record[field];
        if (!value || isEncrypted(value)) {
          skipped++;
          continue;
        }
        try {
          const encrypted = encryptPhone(value);
          if (encrypted === value) {
            skipped++;
            continue;
          }
          await prisma[table].update({
            where: { id: record.id },
            data: { [field]: encrypted },
          });
          updated++;
        } catch (err) {
          console.error(`  [ERROR] ${table}.${field} id=${record.id}: ${err.message}`);
          totalErrors++;
        }
      }

      totalUpdated += updated;
      totalSkipped += skipped;
      console.log(`  ${table}.${field}: ${updated} updated, ${skipped} skipped (of ${records.length})`);
    } catch (err) {
      // 테이블/필드가 존재하지 않으면 스킵
      if (err.message.includes('does not exist') || err.message.includes('not found')) {
        console.log(`  ${table}.${field}: SKIP (${err.message})`);
      } else {
        console.error(`  [ERROR] ${table}.${field}: ${err.message}`);
        totalErrors++;
      }
    }
  }

  console.log(`\n[Summary] Total: ${totalProcessed} | Updated: ${totalUpdated} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`);
  console.log('[Migration] 완료.');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
