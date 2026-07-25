/**
 * ssrfGuard.js — 웹훅 URL SSRF 방어
 *
 * 사용자가 등록한 웹훅 URL로 서버가 아웃바운드 요청을 보내므로, 내부 주소
 * (loopback/사설/링크로컬/메타데이터)를 가리키는 URL을 차단해야 한다.
 * 등록 시점(DNS 해석 포함)과 발송 시점(리다이렉트 hop 포함)에서 모두 검증.
 *
 * 개발 환경(NODE_ENV!=='production')에서는 localhost 테스트를 위해 loopback 허용.
 */
const dns = require('dns').promises;
const net = require('net');

const isProd = () => process.env.NODE_ENV === 'production';

/** IPv4/IPv6 문자열이 내부(사설/loopback/링크로컬/예약) 대역인지 */
function isPrivateAddress(ip) {
    if (!ip) return true;
    // IPv6 매핑 IPv4 (::ffff:127.0.0.1) 정규화
    const v4 = ip.replace(/^::ffff:/i, '');
    if (net.isIPv4(v4)) {
        const o = v4.split('.').map(Number);
        if (o[0] === 10) return true;                          // 10.0.0.0/8
        if (o[0] === 127) return true;                         // loopback
        if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // 172.16/12
        if (o[0] === 192 && o[1] === 168) return true;         // 192.168/16
        if (o[0] === 169 && o[1] === 254) return true;         // 링크로컬(메타데이터 169.254.169.254 포함)
        if (o[0] === 0) return true;                           // 0.0.0.0/8
        if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // CGNAT 100.64/10
        if (o[0] >= 224) return true;                          // 멀티캐스트/예약
        return false;
    }
    const lower = String(ip).toLowerCase();
    if (lower === '::1' || lower === '::') return true;        // IPv6 loopback/unspecified
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
    if (lower.startsWith('fe80')) return true;                 // 링크로컬
    return true; // 알 수 없는 형식은 보수적으로 차단
}

/**
 * 웹훅 URL 검증. 통과 시 { ok:true }, 실패 시 { ok:false, reason }.
 * 프로토콜(https 강제, dev는 http 허용) + 호스트 DNS 해석 후 내부대역 차단.
 */
async function validateWebhookUrl(rawUrl) {
    let u;
    try { u = new URL(rawUrl); } catch { return { ok: false, reason: '잘못된 URL 형식입니다.' }; }

    const allowHttp = !isProd(); // 프로덕션은 https 강제
    if (u.protocol !== 'https:' && !(allowHttp && u.protocol === 'http:')) {
        return { ok: false, reason: 'https URL을 입력해주세요.' };
    }

    // 호스트가 리터럴 IP면 즉시 검사, 도메인이면 DNS 해석 후 모든 A/AAAA 검사
    const host = u.hostname;
    if (net.isIP(host)) {
        // dev에서 localhost 테스트(127.0.0.1)는 허용
        if (!isProd() && (host === '127.0.0.1' || host === '::1')) return { ok: true };
        if (isPrivateAddress(host)) return { ok: false, reason: '내부 IP 주소는 허용되지 않습니다.' };
        return { ok: true };
    }
    if (!isProd() && (host === 'localhost')) return { ok: true }; // dev 로컬 테스트
    try {
        const addrs = await dns.lookup(host, { all: true });
        if (addrs.length === 0) return { ok: false, reason: '호스트를 해석할 수 없습니다.' };
        if (addrs.some(a => isPrivateAddress(a.address))) {
            return { ok: false, reason: '내부 네트워크를 가리키는 호스트는 허용되지 않습니다.' };
        }
        return { ok: true };
    } catch {
        return { ok: false, reason: '호스트를 해석할 수 없습니다.' };
    }
}

module.exports = { validateWebhookUrl, isPrivateAddress };
