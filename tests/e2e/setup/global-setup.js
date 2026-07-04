/**
 * Playwright 글로벌 셋업
 * - API 서버 가용성 확인
 * - 테스트용 공통 쿠키/토큰 저장
 */
const { chromium } = require('@playwright/test');
const https = require('https');
const http  = require('http');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const API_URL  = process.env.PLAYWRIGHT_API_URL  || 'http://localhost:3000';

async function waitForServer(url, maxRetries = 10, delayMs = 2000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await new Promise((resolve, reject) => {
                const client = url.startsWith('https') ? https : http;
                const req = client.get(url + '/api/health', (res) => {
                    res.resume();
                    res.statusCode < 500 ? resolve() : reject(new Error(`Status ${res.statusCode}`));
                });
                req.on('error', reject);
                req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
            });
            console.log(`[E2E Setup] 서버 준비 완료: ${url}`);
            return;
        } catch {
            if (i < maxRetries - 1) {
                console.log(`[E2E Setup] 서버 대기 중... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
    }
    console.warn(`[E2E Setup] 서버 응답 없음 (${url}) — 테스트를 계속 진행합니다.`);
}

module.exports = async function globalSetup() {
    await waitForServer(API_URL);
};
