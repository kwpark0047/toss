const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const FONT_DIR = path.join(__dirname, '../fonts');
const FONTS = {
  ko: {
    regular: path.join(FONT_DIR, 'NanumGothic-Regular.ttf'),
    bold: path.join(FONT_DIR, 'NanumGothic-Bold.ttf'),
  },
  en: {
    regular: path.join(FONT_DIR, 'NotoSans-Regular.ttf'),
    bold: path.join(FONT_DIR, 'NotoSans-Regular.ttf'),
  },
  ja: {
    regular: path.join(FONT_DIR, 'NotoSansJP-Regular.ttf'),
    bold: path.join(FONT_DIR, 'NotoSansJP-Regular.ttf'),
  },
  zh: {
    regular: path.join(FONT_DIR, 'NotoSansSC-Regular.ttf'),
    bold: path.join(FONT_DIR, 'NotoSansSC-Regular.ttf'),
  },
};

const CHART_WIDTH = 500;
const CHART_HEIGHT = 300;
const chartCallback = (ChartJS) => {
  ChartJS.defaults.font.family = 'NotoSans';
  ChartJS.defaults.color = '#333333';
};

class ReportPdfService {
  constructor() {
    this.fontsLoaded = {};
    for (const [lang, fonts] of Object.entries(FONTS)) {
      const hasFont =
        fs.existsSync(fonts.regular) &&
        fs.existsSync(fonts.bold) &&
        fs.statSync(fonts.regular).size > 1000 &&
        fs.statSync(fonts.bold).size > 1000;
      this.fontsLoaded[lang] = hasFont;
      if (hasFont) {
        logger.info(`${lang} font loaded for PDF`);
      } else {
        logger.warn(`${lang} font not found or invalid - using fallback`);
      }
    }

    this.chartCanvas = new ChartJSNodeCanvas({
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      backgroundColour: 'white',
      chartCallback,
    });
  }

  getFonts(lang = 'ko') {
    const fonts = FONTS[lang] || FONTS.ko;
    const loaded = this.fontsLoaded[lang] || false;
    return {
      loaded,
      regular: loaded ? fonts.regular : 'Helvetica',
      bold: loaded ? fonts.bold : 'Helvetica-Bold',
    };
  }

  /**
   * 차트 이미지 버퍼 생성
   */
  async generateChartBuffer(config) {
    try {
      return await this.chartCanvas.renderToBuffer(config);
    } catch (error) {
      logger.warn({ error: error.message }, 'Chart generation failed');
      return null;
    }
  }

  /**
   * 일별 매출 라인 차트
   */
  async generateDailySalesChart(dailyStats, labels, lang = 'ko') {
    const data = labels.map((d) => dailyStats[d] || 0);
    return this.generateChartBuffer({
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: this.getLabel('dailySales', lang),
            data,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 3,
          },
        ],
      },
      options: this.getChartOptions(lang),
    });
  }

  /**
   * 결제 수단별 도넛 차트
   */
  async generatePaymentMethodChart(paymentMethodStats, lang = 'ko') {
    const labels = Object.keys(paymentMethodStats);
    const data = Object.values(paymentMethodStats);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return this.generateChartBuffer({
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors.slice(0, labels.length),
            borderWidth: 2,
            borderColor: '#ffffff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'NotoSans', size: 11 } } },
        },
      },
    });
  }

  /**
   * 전년도 비교 바 차트
   */
  async generateYearComparisonChart(currentYearData, prevYearData, labels, lang = 'ko') {
    return this.generateChartBuffer({
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: this.getLabel('currentYear', lang),
            data: currentYearData,
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: '#3b82f6',
            borderWidth: 1,
          },
          {
            label: this.getLabel('prevYear', lang),
            data: prevYearData,
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: '#10b981',
            borderWidth: 1,
          },
        ],
      },
      options: {
        ...this.getChartOptions(lang),
        scales: {
          y: { beginAtZero: true, title: { display: true, text: this.getLabel('revenue', lang) } },
        },
      },
    });
  }

  getChartOptions(lang) {
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        title: { display: false },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
        x: { grid: { display: false } },
      },
    };
  }

  /**
   * 메인 리포트 생성 (다국어 지원)
   */
  async generateStoreReportPdf(storeId, startDate, endDate, outputPath, options = {}) {
    const { lang = 'ko', includeCharts = true, compareYear = true } = options;
    const numericStoreId = Number(storeId);

    const store = await prisma.stores.findUnique({
      where: { id: numericStoreId },
      include: {
        store_business_info: true,
        store_settlement_config: true,
      },
    });
    if (!store) throw new Error(this.getLabel('storeNotFound', lang) || '매장을 찾을 수 없습니다.');

    // 현재 기간 주문
    const orders = await prisma.orders.findMany({
      where: {
        store_id: numericStoreId,
        created_at: { gte: new Date(startDate), lte: new Date(endDate) },
        status: { not: 'cancelled' },
      },
      select: { total_amount: true, created_at: true, method: true, id: true },
    });

    // 전년도 동기간 주문 (비교용)
    let prevYearOrders = [];
    if (compareYear) {
      const startPrev = new Date(startDate);
      startPrev.setFullYear(startPrev.getFullYear() - 1);
      const endPrev = new Date(endDate);
      endPrev.setFullYear(endPrev.getFullYear() - 1);

      prevYearOrders = await prisma.orders.findMany({
        where: {
          store_id: numericStoreId,
          created_at: { gte: startPrev, lte: endPrev },
          status: { not: 'cancelled' },
        },
        select: { total_amount: true, created_at: true },
      });
    }

    // 집계 계산
    const stats = this.calculateStats(orders, prevYearOrders, compareYear);

    // 차트 생성
    let chartBuffers = {};
    if (includeCharts) {
      chartBuffers = await this.generateCharts(stats, lang);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, autoFirstPage: false });
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // 폰트 등록
      const fonts = this.getFonts(lang);
      if (fonts.loaded) {
        doc.registerFont('NotoSans', fonts.regular);
        doc.registerFont('NotoSans-Bold', fonts.bold);
      }
      const fontRegular = fonts.regular;
      const fontBold = fonts.bold;

      // 페이지 추가
      doc.addPage();

      // 리포트 헤더
      this.renderHeader(doc, store, startDate, endDate, fontRegular, fontBold, lang);

      // 매출 요약
      this.renderSalesSummary(doc, stats, fontRegular, fontBold, lang);

      // 차트 섹션
      if (includeCharts && chartBuffers.dailySales) {
        this.renderChartSection(
          doc,
          chartBuffers.dailySales,
          this.getLabel('dailySales', lang),
          fontRegular,
          fontBold
        );
      }
      if (includeCharts && chartBuffers.paymentMethod) {
        this.renderChartSection(
          doc,
          chartBuffers.paymentMethod,
          this.getLabel('paymentMethod', lang),
          fontRegular,
          fontBold
        );
      }
      if (compareYear && includeCharts && chartBuffers.yearComparison) {
        this.renderChartSection(
          doc,
          chartBuffers.yearComparison,
          this.getLabel('yearComparison', lang),
          fontRegular,
          fontBold
        );
      }
      if (includeCharts && chartBuffers.topProducts) {
        this.renderChartSection(
          doc,
          chartBuffers.topProducts,
          this.getLabel('topProducts', lang),
          fontRegular,
          fontBold
        );
      }

      // 상세 테이블
      this.renderDetailTables(doc, stats, fontRegular, fontBold, lang);

      // 푸터
      this.renderFooter(doc, fontRegular, lang);

      doc.end();

      stream.on('finish', () => {
        logger.info({ storeId: numericStoreId, outputPath, lang }, 'Enhanced PDF report generated');
        resolve(outputPath);
      });
      stream.on('error', (err) => reject(err));
    });
  }

  calculateStats(orders, prevYearOrders, compareYear) {
    const totalRevenue = orders.reduce((a, o) => a + (o.total_amount || 0), 0);
    const totalOrdersCount = orders.length;
    const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

    const paymentMethodStats = orders.reduce((a, o) => {
      const m = o.method || 'unknown';
      a[m] = (a[m] || 0) + (o.total_amount || 0);
      return a;
    }, {});

    const dailyStats = orders.reduce((a, o) => {
      const d = new Date(o.created_at).toISOString().split('T')[0];
      a[d] = (a[d] || 0) + (o.total_amount || 0);
      return a;
    }, {});

    // 상품별 매출
    const productStats = orders.reduce((a, o) => {
      // 주문별 상세 상품 정보는 별도 조회 필요 - 여기서는 주문 단위 집계
      return a;
    }, {});

    let prevYearStats = null;
    if (compareYear && prevYearOrders.length) {
      const prevRevenue = prevYearOrders.reduce((a, o) => a + (o.total_amount || 0), 0);
      const prevOrdersCount = prevYearOrders.length;
      const prevAvgOrder = prevOrdersCount > 0 ? Math.round(prevRevenue / prevOrdersCount) : 0;

      const prevDailyStats = prevYearOrders.reduce((a, o) => {
        const d = new Date(o.created_at).toISOString().split('T')[0];
        a[d] = (a[d] || 0) + (o.total_amount || 0);
        return a;
      }, {});

      prevYearStats = {
        totalRevenue: prevRevenue,
        totalOrdersCount: prevOrdersCount,
        avgOrderValue: prevAvgOrder,
        dailyStats: prevDailyStats,
        growthRate:
          prevRevenue > 0 ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : 0,
      };
    }

    return {
      current: { totalRevenue, totalOrdersCount, avgOrderValue, paymentMethodStats, dailyStats },
      previous: prevYearStats,
    };
  }

  async generateCharts(stats, lang) {
    const { current, previous } = stats;
    const sortedDates = Object.keys(current.dailyStats).sort();
    const last14Days = sortedDates.slice(-14);

    const charts = await Promise.all([
      this.generateDailySalesChart(current.dailyStats, last14Days, lang),
      this.generatePaymentMethodChart(current.paymentMethodStats, lang),
    ]);

    let yearComparison = null;
    const topProducts = null;

    if (previous) {
      // 전년도 비교용 월별 데이터 구성
      const months = [
        '1월',
        '2월',
        '3월',
        '4월',
        '5월',
        '6월',
        '6월',
        '7월',
        '8월',
        '9월',
        '10월',
        '11월',
        '12월',
      ];
      const currentMonthly = Array(12).fill(0);
      const prevMonthly = Array(12).fill(0);

      for (const [date, amount] of Object.entries(current.dailyStats)) {
        const month = new Date(date).getMonth();
        currentMonthly[month] += amount;
      }
      for (const [date, amount] of Object.entries(previous.dailyStats)) {
        const month = new Date(date).getMonth();
        prevMonthly[month] += amount;
      }

      yearComparison = await this.generateYearComparisonChart(
        currentMonthly,
        prevMonthly,
        months.slice(0, new Date().getMonth() + 1),
        lang
      );
    }

    return { dailySales: charts[0], paymentMethod: charts[1], yearComparison, topProducts };
  }

  renderHeader(doc, store, startDate, endDate, fontRegular, fontBold, lang) {
    try {
      doc
        .font(fontBold)
        .fontSize(24)
        .fillColor('#1f2937')
        .text('WeMarket 매출 분석 리포트', { align: 'center' });
    } catch (e) {
      doc
        .font('Helvetica-Bold')
        .fontSize(24)
        .fillColor('#1f2937')
        .text('WeMarket Sales Report', { align: 'center' });
    }
    doc.moveDown(0.3);
    try {
      doc
        .font(fontRegular)
        .fontSize(12)
        .fillColor('#6b7280')
        .text('매장 운영 현황 요약', { align: 'center' });
    } catch (e) {
      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor('#6b7280')
        .text('Store Sales Summary', { align: 'center' });
    }
    doc.moveDown(0.5);

    // 메타 정보 박스
    const boxY = doc.y;
    doc.rect(50, boxY, 500, 60).fill('#f9fafb');
    try {
      doc.font(fontBold).fontSize(11).fillColor('#1f2937');
    } catch (e) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937');
    }
    doc.text(`매장: ${store.name}`, 60, boxY + 10);
    doc.text(`기간: ${startDate} ~ ${endDate}`, 60, boxY + 25);
    doc.text(`생성: ${new Date().toLocaleString('ko-KR')}`, 300, boxY + 10);
    doc.moveDown(4);
  }

  renderSalesSummary(doc, stats, fontRegular, fontBold, lang) {
    const { current, previous } = stats;
    const growth = previous
      ? ` (${previous.growthRate > 0 ? '+' : ''}${previous.growthRate}%)`
      : '';

    doc
      .font(fontBold)
      .fontSize(16)
      .fillColor('#1f2937')
      .text(this.getLabel('salesSummary', lang), { underline: true });
    doc.moveDown(0.3);

    // 요약 카드 스타일
    const items = [
      {
        label: this.getLabel('totalRevenue', lang),
        value: `${current.totalRevenue.toLocaleString()} 원${growth}`,
      },
      {
        label: this.getLabel('totalOrders', lang),
        value: `${current.totalOrdersCount.toLocaleString()} 건`,
      },
      {
        label: this.getLabel('avgOrderValue', lang),
        value: `${current.avgOrderValue.toLocaleString()} 원`,
      },
    ];

    for (const item of items) {
      doc
        .font(fontBold)
        .fontSize(11)
        .text(item.label + ': ');
      doc.font(fontRegular).fontSize(11).fillColor('#374151').text(item.value, { indent: 20 });
      doc.moveDown(0.2);
    }
    doc.moveDown();
  }

  renderChartSection(doc, chartBuffer, title, fontRegular, fontBold) {
    if (!chartBuffer) return;
    try {
      doc.font(fontBold).fontSize(14).fillColor('#1f2937').text(title, { underline: true });
    } catch (e) {
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#1f2937').text(title, { underline: true });
    }
    doc.moveDown(0.3);
    const imgWidth = Math.min(500, doc.page.width - 100);
    try {
      doc.image(chartBuffer, { fit: [imgWidth, 300], align: 'center' });
    } catch (e) {
      logger.warn({ error: e.message }, 'Failed to embed chart image, skipping');
      try {
        doc
          .font(fontRegular)
          .fontSize(10)
          .fillColor('#9ca3af')
          .text('[차트 이미지 로드 실패]', { align: 'center' });
      } catch (e2) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#9ca3af')
          .text('[Chart image failed to load]', { align: 'center' });
      }
    }
    doc.moveDown();
  }

  renderDetailTables(doc, stats, fontRegular, fontBold, lang) {
    const { current } = stats;

    // 결제 수단별 상세
    if (Object.keys(current.paymentMethodStats).length > 0) {
      doc.moveDown();
      doc.font(fontBold).fontSize(14).text(this.getLabel('paymentMethodDetail', lang));
      doc.moveDown(0.3);

      const total = current.totalRevenue;
      for (const [method, amount] of Object.entries(current.paymentMethodStats)) {
        const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
        doc
          .font(fontRegular)
          .fontSize(10)
          .text(`${method}: ${amount.toLocaleString()} 원 (${pct}%)`);
      }
      doc.moveDown();
    }

    // 일별 매출 (최근 7일)
    const sortedDates = Object.keys(current.dailyStats).sort().slice(-7);
    if (sortedDates.length > 0) {
      doc.font(fontBold).fontSize(14).text(this.getLabel('recentDailySales', lang));
      doc.moveDown(0.3);
      for (const date of sortedDates) {
        const amount = current.dailyStats[date];
        doc.font(fontRegular).fontSize(10).text(`${date}: ${amount.toLocaleString()} 원`);
      }
    }
  }

  renderFooter(doc, fontRegular, lang) {
    doc.moveDown(2);
    doc
      .font(fontRegular)
      .fontSize(8)
      .fillColor('#9ca3af')
      .text('본 리포트는 WeMarket 플랫폼에서 자동 생성되었습니다.', { align: 'center' })
      .text('© 2024 WeMarket. All rights reserved.', { align: 'center' });
  }

  getLabel(key, lang) {
    const labels = {
      ko: {
        salesSummary: '매출 요약',
        totalRevenue: '총 매출액',
        totalOrders: '총 주문 수',
        avgOrderValue: '평균 객단가',
        dailySales: '일별 매출 추이',
        dailySalesShort: '일별 매출',
        currentYear: '올해',
        prevYear: '작년',
        revenue: '매출액 (원)',
        paymentMethod: '결제 수단별 매출 비중',
        paymentMethodShort: '결제 수단별',
        paymentMethodDetail: '결제 수단별 상세',
        topProducts: '인기 메뉴 TOP 5',
        topProductsShort: '인기 메뉴 TOP 5',
        yearComparison: '전년도 동기간 비교',
        recentDailySales: '최근 7일 일별 매출',
        orderTrend: '주문 추이',
        storeNotFound: '매장을 찾을 수 없습니다.',
      },
      en: {
        salesSummary: 'Sales Summary',
        totalRevenue: 'Total Revenue',
        totalOrders: 'Total Orders',
        avgOrderValue: 'Avg Order Value',
        dailySales: 'Daily Sales Trend',
        dailySalesShort: 'Daily Sales',
        currentYear: 'Current Year',
        prevYear: 'Previous Year',
        revenue: 'Revenue (KRW)',
        paymentMethod: 'Payment Method Distribution',
        paymentMethodShort: 'Payment Methods',
        paymentMethodDetail: 'Payment Method Details',
        topProducts: 'Top 5 Products',
        topProductsShort: 'Top 5 Products',
        yearComparison: 'Year-over-Year Comparison',
        recentDailySales: 'Recent 7 Days Sales',
        orderTrend: 'Order Trend',
        storeNotFound: 'Store not found.',
      },
      ja: {
        salesSummary: '売上サマリー',
        totalRevenue: '総売上高',
        totalOrders: '総注文数',
        avgOrderValue: '平均客単価',
        dailySales: '日別売上推移',
        paymentMethod: '決済手段別売上比率',
        paymentMethodDetail: '決済手段別詳細',
        topProducts: '人気メニュー TOP 5',
        yearComparison: '前年同期比較',
        recentDailySales: '直近7日間の日別売上',
        storeNotFound: '店舗が見つかりません。',
      },
      zh: {
        salesSummary: '销售摘要',
        totalRevenue: '总销售额',
        totalOrders: '总订单数',
        avgOrderValue: '平均客单价',
        dailySales: '每日销售趋势',
        paymentMethod: '支付方式分布',
        paymentMethodDetail: '支付方式详情',
        topProducts: '热门菜单 TOP 5',
        yearComparison: '同比去年对比',
        recentDailySales: '近7日每日销售',
        storeNotFound: '未找到店铺。',
      },
    };
    return (labels[lang] && labels[lang][key]) || labels.ko[key];
  }
}

module.exports = new ReportPdfService();
