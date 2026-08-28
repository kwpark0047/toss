const ReportPdfService = require('../../../services/ReportPdfService');
const fs = require('fs');
const path = require('path');

describe('ReportPdfService', () => {
  const outputPath = path.join(__dirname, '../../../reports/test_report.pdf');

  beforeAll(() => {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  });

  test('should generate PDF with Korean font support', async () => {
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

  test('should have Korean font files available', () => {
    const fontDir = path.join(__dirname, '../../../fonts');
    expect(fs.existsSync(path.join(fontDir, 'NanumGothic-Regular.ttf'))).toBe(true);
    expect(fs.existsSync(path.join(fontDir, 'NanumGothic-Bold.ttf'))).toBe(true);
  });
});
