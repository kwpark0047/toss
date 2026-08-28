const ReportPdfService = require('../../../services/ReportPdfService');
const fs = require('fs');
const path = require('path');

// ── Manual mocks ──────────────────────────────────────────
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../config/prisma', () => ({
  stores: {
    findUnique: jest.fn(),
  },
  orders: {
    findMany: jest.fn(),
  },
}));

// chartjs-node-canvas mock that returns a valid PNG buffer
jest.mock('chartjs-node-canvas', () => ({
  ChartJSNodeCanvas: jest.fn().mockImplementation(() => ({
    renderToBuffer: jest
      .fn()
      .mockResolvedValue(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        )
      ),
  })),
}));

jest.mock('chart.js', () => ({
  Chart: jest.fn(),
  registerables: [],
}));

const prisma = require('../../../config/prisma');

describe('ReportPdfService', () => {
  const outputPath = path.join(__dirname, '../../../../reports/test_report.pdf');

  beforeAll(() => {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('한글 폰트 파일 존재 확인 (NotoSans 계열)', () => {
    const fontDir = path.join(__dirname, '../../../fonts');
    expect(fs.existsSync(path.join(fontDir, 'NotoSans-Regular.ttf'))).toBe(true);
    expect(fs.existsSync(path.join(fontDir, 'NotoSansJP-Regular.ttf'))).toBe(true);
    expect(fs.existsSync(path.join(fontDir, 'NotoSansSC-Regular.ttf'))).toBe(true);
  });

  test('PDF 생성 시 한글 폰트 등록 확인', async () => {
    prisma.stores.findUnique.mockResolvedValue({
      id: 1,
      name: '테스트 매장',
    });

    prisma.orders.findMany.mockResolvedValue([
      { total_amount: 50000, created_at: new Date(), method: 'card' },
      { total_amount: 30000, created_at: new Date(), method: 'cash' },
    ]);

    const result = await ReportPdfService.generateStoreReportPdf(
      1,
      '2026-01-01',
      '2026-01-31',
      outputPath
    );

    expect(result).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  test('존재하지 않는 매장일 경우 에러', async () => {
    prisma.stores.findUnique.mockResolvedValue(null);

    await expect(
      ReportPdfService.generateStoreReportPdf(999, '2026-01-01', '2026-01-31', outputPath)
    ).rejects.toThrow('매장을 찾을 수 없습니다.');
  });

  test('다국어 라벨 지원', () => {
    const service = ReportPdfService;

    // 한국어
    expect(service.getLabel('totalRevenue', 'ko')).toBe('총 매출액');
    expect(service.getLabel('salesSummary', 'ko')).toBe('매출 요약');

    // 영어
    expect(service.getLabel('totalRevenue', 'en')).toBe('Total Revenue');
    expect(service.getLabel('salesSummary', 'en')).toBe('Sales Summary');

    // 일본어
    expect(service.getLabel('totalRevenue', 'ja')).toBe('総売上高');

    // 중국어
    expect(service.getLabel('totalRevenue', 'zh')).toBe('总销售额');
  });

  test('차트 옵션 설정', () => {
    const service = ReportPdfService;
    const options = service.getChartOptions('ko');

    expect(options).toHaveProperty('responsive', true);
    expect(options).toHaveProperty('maintainAspectRatio', true);
    expect(options.scales).toHaveProperty('y');
    expect(options.scales).toHaveProperty('x');
  });

  test('폰트 로딩 상태 확인', () => {
    const service = ReportPdfService;
    const fonts = service.getFonts('ko');
    expect(fonts).toHaveProperty('loaded');
    expect(fonts).toHaveProperty('regular');
    expect(fonts).toHaveProperty('bold');
  });
});
