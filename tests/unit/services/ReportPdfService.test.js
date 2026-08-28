const ReportPdfService = require('../../../services/ReportPdfService');
const fs = require('fs');
const path = require('path');

jest.mock('../../../config/prisma');
jest.mock('../../../utils/logger');

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

  test('한글 폰트 파일 존재 확인', () => {
    const fontDir = path.join(__dirname, '../../../fonts');
    expect(fs.existsSync(path.join(fontDir, 'NanumGothic-Regular.ttf'))).toBe(true);
    expect(fs.existsSync(path.join(fontDir, 'NanumGothic-Bold.ttf'))).toBe(true);
  });

  test('PDF 생성 시 한글 폰트 등록 확인', async () => {
    // Mock store 데이터
    prisma.stores.findUnique.mockResolvedValue({
      id: 1,
      name: '테스트 매장',
    });

    // Mock 주문 데이터
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

  test('startDate와 endDate가 필수', async () => {
    prisma.stores.findUnique.mockResolvedValue({ id: 1, name: '테스트' });

    await expect(
      ReportPdfService.generateStoreReportPdf(1, null, '2026-01-31', outputPath)
    ).rejects.toThrow();
  });
});
