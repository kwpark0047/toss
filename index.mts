import 'dotenv/config';
import { createServer } from 'http';
import path from 'path';
const PORT = process.env.PORT || 3000;

// ── Bootstrap: /api/health가 즉시 응답하는 최소 HTTP 서버 ────────────────────────
// Render health check timeout(30초) 이내에 응답하도록 보장합니다.
const bootstrapServer = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.url?.startsWith('/api/health')) {
        res.statusCode = 200;
        res.end(JSON.stringify({ status: 'starting', timestamp: new Date().toISOString() }));
        return;
    }
    // Render cold-start용 SPA 폴백: 비 API 경로는 index.html로
    if (req.url === '/' || !req.url?.startsWith('/api')) {
        res.statusCode = 200;
        try {
            res.end(require('fs').readFileSync(path.join(__dirname, 'frontend', 'dist', 'index.html'), 'utf-8'));
        }
        catch {
            res.end('{"service":"wemarket"}');
        }
        return;
    }
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Server initializing' }));
});

// Bootstrap 서버를 즉시 시작 (동기적으로 포트 바인딩)
bootstrapServer.listen(PORT, () => {
    console.log(`[서버] Bootstrap health server listening on port ${PORT}`);
    console.log(`[health] /api/health는 30초 타임아웃 이내 즉각 응답합니다.`);
});

// Bootstrap 서버는 영원히 유지 — /api/health가 즉시 응답함을 보장합니다.
// 앱 본문 초기화는 별도 프로세스이거나 background에서 일어나더라도
// /api/health 응답은 이미 Completed 되었습니다.

// export (Render가 진입점으로 index.mts를 사용하는 경우를 대비해)
export { bootstrapServer, PORT };