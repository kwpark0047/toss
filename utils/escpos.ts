import iconv from 'iconv-lite';
import { fmtWon } from './format.js';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

class EscPosBuilder {
  chunks: Buffer[];

  constructor() {
    this.chunks = [];
  }

  raw(bytes: number[]): this {
    this.chunks.push(Buffer.from(bytes));
    return this;
  }

  text(str: string): this {
    this.chunks.push(iconv.encode(String(str), 'cp949'));
    return this;
  }

  line(str = ''): this {
    return this.text(str).raw([LF]);
  }

  feed(n = 1): this {
    return this.raw([ESC, 0x64, n]);
  }

  init(): this {
    return this.raw([ESC, 0x40, ESC, 0x74, 0x12]);
  }

  align(a: 'left' | 'center' | 'right'): this {
    return this.raw([ESC, 0x61, a === 'center' ? 1 : a === 'right' ? 2 : 0]);
  }

  bold(on: boolean): this {
    return this.raw([ESC, 0x45, on ? 1 : 0]);
  }

  size(w: number, h: number): this {
    return this.raw([GS, 0x21, ((Math.max(1, w) - 1) << 4) | (Math.max(1, h) - 1)]);
  }

  hr(char = '-', width = 32): this {
    return this.line(char.repeat(width));
  }

  cut(): this {
    return this.raw([GS, 0x56, 0x42, 0x00]);
  }

  beep(): this {
    return this.raw([ESC, 0x42, 0x03, 0x02]);
  }

  build(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

/** 좌: 항목명, 우: 수량 — 32컬럼(80mm 기준) 정렬 (한글 폭 2 계산) */
function padRow(left: string, right: string, width = 32): string {
  const w = (s: string) => [...String(s)].reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
  const gap = Math.max(1, width - w(left) - w(right));
  return left + ' '.repeat(gap) + right;
}

/**
 * 주방 영수증 ESC/POS 바이트 생성.
 * @param {object} order { order_number, table_name|table_id, created_at, notes, total_amount }
 * @param {Array}  items  [{ name|item_name|product_name, quantity, options }]
 * @param {object} store  { name }
 */
export function buildKitchenReceipt(order: any, items: any[], store: any = {}): Buffer {
  const b = new EscPosBuilder().init();
  const time = new Date(order.created_at || Date.now())
    .toLocaleString('ko-KR', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  // 헤더
  const b = new EscPosBuilder().init();
  b.align('center').bold(true).size(1, 2).line('[ 주 방 주 문 ]').size(1, 1).bold(false);
  if (store.name) b.line(store.name);
  b.hr('=');

  // 주문 메타 (테이블/주문번호 크게)
  b.align('left').bold(true).size(2, 2);
  b.line(`테이블 ${order.table_name || order.table_id || '-'}`);
  b.size(1, 1).bold(false);
  b.line(`주문번호 ${order.order_number || order.id || ''}`);
  b.line(`시간 ${time}`);
  b.hr('-');

  // 품목
  b.bold(true).size(1, 2);
  for (const it of items || []) {
    const name = it.name || it.item_name || it.product_name || '항목';
    b.line(padRow(name, `x${it.quantity || 1}`));
    // 옵션 표시 (있으면 작게 들여쓰기)
    let opts = it.options;
    try { if (typeof opts === 'string') opts = JSON.parse(opts); } catch { opts = null; }
    if (Array.isArray(opts) && opts.length) {
      b.size(1, 1).bold(false);
      for (const o of opts) b.line(`  - ${o.name || o.label || o.value || o}`);
      b.bold(true).size(1, 2);
    }
  }
  b.size(1, 1).bold(false).hr('-');

  // 요청사항
  if (order.notes) { b.bold(true).line('요청: ' + order.notes).bold(false); b.hr('-'); }

  // 합계
  if (order.total_amount != null) b.align('right').line('합계 ' + fmtWon(order.total_amount));

  b.feed(1).align('center').line('WeMarket').feed(3).cut().beep();
  return b.build();
}

export { EscPosBuilder, buildKitchenReceipt, padRow };