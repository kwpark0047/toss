const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const FONT_DIR = path.join(__dirname, '../fonts');
const NANUM_REGULAR = path.join(FONT_DIR, 'NanumGothic-Regular.ttf');
const NANUM_BOLD = path.join(FONT_DIR, 'NanumGothic-Bold.ttf');

class ReportPdfService {
  constructor() {
    this.hasKoreanFont = fs.existsSync(NANUM_REGULAR) && fs.existsSync(NANUM_BOLD);
    if (this.hasKoreanFont) {
      logger.info('NanumGothic font loaded for PDF Korean support');
    } else {
      logger.warn('NanumGothic font not found - PDF Korean text may not render correctly');
    }
  }

  /**
   * 점주용 주간/월간 매출 분석 리포트 PDF 생성
   */
  async generateStoreReportPdf(storeId, startDate, endDate, outputPath) {
    const numericStoreId = Number(storeId);
    const store = await prisma.stores.findUnique({ where: { id: numericStoreId } });
    if (!store) throw new Error('매장을 찾을 수 없습니다.');

    // 해당 기간 주문 집계
    const orders = await prisma.orders.findMany({
      where: {
        store_id: numericStoreId,
        created_at: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        status: { not: 'cancelled' },
      },
      select: {
        total_amount: true,
        created_at: true,
        method: true,
      },
    });

    const totalRevenue = orders.reduce((acc, cur) => acc + (cur.total_amount || 0), 0);
    const totalOrdersCount = orders.length;
    const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

    // 결제 수단별 집계
    const paymentMethodStats = orders.reduce((acc, cur) => {
      const method = cur.method || 'unknown';
      acc[method] = (acc[method] || 0) + (cur.total_amount || 0);
      return acc;
    }, {});

    // 일별 매출 집계
    const dailyStats = orders.reduce((acc, cur) => {
      const date = new Date(cur.created_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + (cur.total_amount || 0);
      return acc;
    }, {});

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, autoFirstPage: false });
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // 폰트 등록
      if (this.hasKoreanFont) {
        doc.registerFont('NanumGothic', NANUM_REGULAR);
        doc.registerFont('NanumGothic-Bold', NANUM_BOLD);
      }

      const useKorean = this.hasKoreanFont;
      const fontRegular = useKorean ? 'NanumGothic' : 'Helvetica';
      const fontBold = useKorean ? 'NanumGothic-Bold' : 'Helvetica-Bold';

      // 첫 페이지 추가
      doc.addPage();

      // 헤더
      doc.font(fontBold).fontSize(22).text('WeMarket 매출 분석 리포트', { align: 'center' });
      doc.moveDown(0.5);
      doc
        .font(fontRegular)
        .fontSize(12)
        .fillColor('#666666')
        .text('매장 운영 현황 요약', { align: 'center' });
      doc.moveDown();

      // 매장 정보
      doc.font(fontBold).fontSize(14).fillColor('#000000').text('매장 정보');
      doc.moveDown(0.3);
      doc.font(fontRegular).fontSize(11).text(`매장명: ${store.name}`);
      doc.text(`기간: ${startDate} ~ ${endDate}`);
      doc.text(`생성일시: ${new Date().toLocaleString('ko-KR')}`);
      doc.moveDown();

      // 매출 요약
      doc.font(fontBold).fontSize(16).text('매출 요약', { underline: true });
      doc.moveDown(0.3);
      doc.font(fontRegular).fontSize(11);
      doc.text(`총 매출액: ${totalRevenue.toLocaleString()} 원`);
      doc.text(`총 주문 건수: ${totalOrdersCount.toLocaleString()} 건`);
      doc.text(`평균 객단가: ${avgOrderValue.toLocaleString()} 원`);
      doc.moveDown();

      // 결제 수단별 비율
      if (Object.keys(paymentMethodStats).length > 0) {
        doc.font(fontBold).fontSize(14).text('결제 수단별 매출');
        doc.moveDown(0.3);
        doc.font(fontRegular).fontSize(10);
        for (const [method, amount] of Object.entries(paymentMethodStats)) {
          const pct = totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(1) : 0;
          doc.text(`  ${method}: ${amount.toLocaleString()} 원 (${pct}%)`);
        }
        doc.moveDown();
      }

      // 일별 매출 트렌드 (최근 14일)
      const recentDates = Object.keys(dailyStats).sort().slice(-14);
      if (recentDates.length > 0) {
        doc.font(fontBold).fontSize(14).text('일별 매출 추이 (최근 14일)');
        doc.moveDown(0.3);
        doc.font(fontRegular).fontSize(10);
        for (const date of recentDates) {
          const amount = dailyStats[date];
          doc.text(`  ${date}: ${amount.toLocaleString()} 원`);
        }
        doc.moveDown();
      }

      // 푸터
      doc
        .font(fontRegular)
        .fontSize(9)
        .fillColor('#999999')
        .text('본 리포트는 WeMarket 플랫폼에서 자동 생성되었습니다.', { align: 'center' });
      doc.text('문의사항은 고객센터로 연락 바랍니다.', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        logger.info(
          { storeId: numericStoreId, outputPath },
          'Store revenue PDF report generated with Korean font support'
        );
        resolve(outputPath);
      });

      stream.on('error', (err) => {
        logger.error({ error: err.message }, 'Failed to generate PDF report');
        reject(err);
      });
    });
  }
}

module.exports = new ReportPdfService();
