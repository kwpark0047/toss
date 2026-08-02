const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

class ReportPdfService {
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

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // 폰트 설정 (한글 폰트 미설정 시 기본 폰트로 깨질 수 있으므로 영문/기본 레이아웃 구성)
      doc.fontSize(22).text('WeMarket Business Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`Store Name: ${store.name}`);
      doc.text(`Period: ${startDate} ~ ${endDate}`);
      doc.text(`Generated At: ${new Date().toISOString()}`);
      doc.moveDown();

      doc.fontSize(16).text('Sales Summary', { underline: true });
      doc.fontSize(12).text(`- Total Revenue: ${totalRevenue.toLocaleString()} KRW`);
      doc.text(`- Total Orders: ${totalOrdersCount} orders`);
      doc.text(`- Average Order Value: ${avgOrderValue.toLocaleString()} KRW`);
      doc.moveDown();

      doc
        .fontSize(10)
        .text('Thank you for using WeMarket platform.', { align: 'center', oblique: true });

      doc.end();

      stream.on('finish', () => {
        logger.info({ storeId: numericStoreId, outputPath }, 'Store revenue PDF report generated');
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
