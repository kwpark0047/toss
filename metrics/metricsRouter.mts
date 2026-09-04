/**
 * Prometheus /metrics 엔드포인트 라우터
 *
 * Prometheus/Grafana 스크랩 대상. 인증 없이 표준 텍스트 포맷을 반환한다.
 * (네트워크 노출 제한은 인프라 계층에서 담당 — 내부망/VPC 또는 스크랩 허용 IP)
 */
import { Router } from 'express';
import { registry } from './PrometheusMetrics.js';

const router = Router();

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     tags: [Monitoring]
 *     summary: Prometheus 메트릭 (스크랩)
 *     description: prom-client 기반 표준 Prometheus 텍스트 포맷 (Grafana/Prometheus 스크랩용)
 *     responses:
 *       200:
 *         description: Prometheus 텍스트 포맷 메트릭
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/', async (_req, res) => {
  try {
    const metricsText = await registry.metrics();
    res.setHeader('Content-Type', registry.contentType);
    res.send(metricsText);
  } catch (err) {
    res.status(500).json({ error: 'metrics 수집 실패', detail: (err as Error).message });
  }
});

export default router;
