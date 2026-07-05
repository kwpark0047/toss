#!/usr/bin/env node
/**
 * print-bridge.js — WeMarket 온프레미스 프린트 브리지 (매장 로컬 실행)
 *
 * 매장 로컬 PC/라즈베리파이에서 실행. WeMarket 클라우드에서 대기 중인 프린트
 * 잡을 주기적으로 claim → 로컬 ESC/POS 프린터(LAN 9100 / USB)로 전송 → ack.
 * 클라우드는 로컬 프린터에 직접 접근하지 않는다(NAT 안쪽에서 아웃바운드 폴링만).
 *
 * 환경변수:
 *   WM_API_BASE   기본 https://wemarket.onrender.com/api/v1
 *   WM_API_KEY    매장 API 키(wm_live_..., write 스코프)
 *   PRINTER_TYPE  net | usb  (기본 net)
 *   PRINTER_HOST  net일 때 프린터 IP (예: 192.168.0.50)
 *   PRINTER_PORT  net일 때 포트 (기본 9100)
 *   POLL_MS       폴링 주기 ms (기본 3000)
 *
 * 사용 예:
 *   WM_API_KEY=wm_live_xxx PRINTER_HOST=192.168.0.50 node scripts/print-bridge.js
 *
 * LAN 프린터는 net 소켓(RAW 9100)으로 바로 전송하므로 추가 의존성이 없다.
 * USB 프린터는 node-escpos + escpos-usb 설치 후 사용(주석 참고).
 */
const net = require('net');

const API_BASE = process.env.WM_API_BASE || 'https://wemarket.onrender.com/api/v1';
const API_KEY = process.env.WM_API_KEY;
const PRINTER_TYPE = process.env.PRINTER_TYPE || 'net';
const PRINTER_HOST = process.env.PRINTER_HOST || '127.0.0.1';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT) || 9100;
const POLL_MS = parseInt(process.env.POLL_MS) || 3000;

if (!API_KEY) { console.error('WM_API_KEY 환경변수가 필요합니다.'); process.exit(1); }

const api = (path, body) => fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify(body || {}),
}).then(async r => ({ status: r.status, json: await r.json().catch(() => ({})) }));

// LAN 프린터(RAW 9100)로 ESC/POS 바이트 전송
function printNet(bytes) {
    return new Promise((resolve, reject) => {
        const sock = net.createConnection({ host: PRINTER_HOST, port: PRINTER_PORT }, () => {
            sock.write(bytes, () => sock.end());
        });
        sock.on('error', reject);
        sock.on('close', () => resolve());
        sock.setTimeout(8000, () => { sock.destroy(); reject(new Error('printer timeout')); });
    });
}

// USB 프린터 예시 (node-escpos 설치 시)
// function printUsb(bytes) {
//   const escpos = require('escpos'); escpos.USB = require('escpos-usb');
//   const device = new escpos.USB();
//   return new Promise((res, rej) => device.open(err => {
//     if (err) return rej(err);
//     device.write(bytes, () => device.close(res));
//   }));
// }

async function tick() {
    try {
        const { status, json } = await api('/print/jobs/claim', { max: 5 });
        if (status !== 200) { console.warn(`claim 실패 HTTP ${status}`); return; }
        const jobs = json.data || [];
        for (const job of jobs) {
            const bytes = Buffer.from(job.payload_b64, 'base64');
            try {
                if (PRINTER_TYPE === 'net') await printNet(bytes);
                // else if (PRINTER_TYPE === 'usb') await printUsb(bytes);
                await api(`/print/jobs/${job.id}/ack`, { success: true });
                console.log(`✅ 인쇄 완료 job=${job.id} order=${job.order_id}`);
            } catch (e) {
                await api(`/print/jobs/${job.id}/ack`, { success: false, error: e.message });
                console.error(`❌ 인쇄 실패 job=${job.id}: ${e.message}`);
            }
        }
    } catch (e) {
        console.error('폴링 오류:', e.message);
    }
}

console.log(`WeMarket 프린트 브리지 시작 — ${PRINTER_TYPE} ${PRINTER_HOST}:${PRINTER_PORT}, ${POLL_MS}ms 폴링`);
setInterval(tick, POLL_MS);
tick();
