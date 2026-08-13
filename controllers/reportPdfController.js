const ReportPdfService = require('../services/ReportPdfService');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const path = require('path');
const fs = require('fs');

const reportPdfController = {
  /**
   * 매장 매출 리포트 PDF 생성 및 다운로드
   */
  generateStoreReport: catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate와 endDate는 필수입니다.' });
    }

    const numericStoreId = Number(storeId);
    const outputPath = path.join(
      __dirname,
      '../../reports',
      `store_${storeId}_${startDate}_${endDate}.pdf`
    );

    const pdfPath = await ReportPdfService.generateStoreReportPdf(
      numericStoreId,
      startDate,
      endDate,
      outputPath
    );

    if (fs.existsSync(pdfPath)) {
      res.download(pdfPath, `report_${storeId}_${startDate}_${endDate}.pdf`, (err) => {
        if (err) console.error('PDF 다운로드 에러:', err);
        // 다운로드 후 파일 삭제 (옵션)
        // fs.unlink(pdfPath, () => {});
      });
    } else {
      res.status(404).json({ error: 'PDF 생성 실패' });
    }
  }),

  /**
   * 전체 매장 리포트 일괄 생성 (슈퍼어드민)
   */
  generateAllStoreReports: catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate와 endDate는 필수입니다.' });
    }

    const stores = await prisma.stores.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
    });

    const results = [];
    for (const store of stores) {
      try {
        const outputPath = path.join(
          __dirname,
          '../../reports',
          `store_${store.id}_${startDate}_${endDate}.pdf`
        );
        await ReportPdfService.generateStoreReportPdf(store.id, startDate, endDate, outputPath);
        results.push({ storeId: store.id, storeName: store.name, success: true, path: outputPath });
      } catch (e) {
        results.push({
          storeId: store.id,
          storeName: store.name,
          success: false,
          error: e.message,
        });
      }
    }

    res.success(results, '전체 매장 리포트 생성 완료');
  }),

  /**
   * 리포트 템플릿 목록
   */
  getTemplates: catchAsync(async (req, res) => {
    const templates = [
      { id: 'weekly_sales', name: '주간 매출 리포트', description: '주간 매출/주문/객단가 요약' },
      {
        id: 'monthly_sales',
        name: '월간 매출 리포트',
        description: '월간 매출 트렌드/상위 메뉴/결제수단별',
      },
      { id: 'menu_analysis', name: '메뉴 분석 리포트', description: '메뉴별 판매량/수익률/폐기율' },
      {
        id: 'customer_analysis',
        name: '고객 분석 리포트',
        description: 'RFM 세그먼트/재방문율/평균 체류시간',
      },
      {
        id: 'payment_analysis',
        name: '결제 분석 리포트',
        description: '결제수단별 비율/취소율/환불율',
      },
    ];
    res.success(templates, '리포트 템플릿 목록');
  }),
};

module.exports = reportPdfController;
