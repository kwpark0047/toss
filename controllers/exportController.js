const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

// ─── 공통 헬퍼 ────────────────────────────────────────────────────────────────

const won = (n) => `₩${Number(n || 0).toLocaleString('ko-KR')}`;
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** 기간 쿼리 파라미터에서 Date 범위 추출 */
function parseDateRange(query) {
    const now = new Date();
    const start = query.start_date
        ? new Date(query.start_date)
        : new Date(now.getTime() - 30 * 86400000);
    const end = query.end_date ? new Date(query.end_date) : now;
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

/** 공통 Excel 헤더 스타일 */
function applyHeaderStyle(row, bgColor = 'FF1E293B') {
    row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF334155' } },
            bottom: { style: 'thin', color: { argb: 'FF334155' } },
            left: { style: 'thin', color: { argb: 'FF334155' } },
            right: { style: 'thin', color: { argb: 'FF334155' } },
        };
    });
    row.height = 28;
}

/** 교대 행 배경 */
function applyRowStyle(row, isEven) {
    const argb = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
    row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
            bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };
    });
    row.height = 22;
}

/** 워크북에 제목 행 삽입 */
function insertTitle(ws, title, subtitle, colSpan) {
    ws.mergeCells(`A1:${String.fromCharCode(64 + colSpan)}1`);
    const titleCell = ws.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
    ws.getRow(1).height = 36;

    ws.mergeCells(`A2:${String.fromCharCode(64 + colSpan)}2`);
    const subCell = ws.getCell('A2');
    subCell.value = subtitle;
    subCell.font = { size: 10, color: { argb: 'FF64748B' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 20;

    ws.addRow([]);
}

// ─── Excel 내보내기 ───────────────────────────────────────────────────────────

/**
 * 1. 매출 통계 Excel
 * GET /api/export/store/:storeId/excel/sales
 */
const exportSalesExcel = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const { start, end } = parseDateRange(req.query);
        const sid = Number(storeId);

        const store = await prisma.stores.findUnique({ where: { id: sid }, select: { name: true } });
        if (!store) return next(new AppError('매장을 찾을 수 없습니다.', 404));

        const orders = await prisma.orders.findMany({
            where: { store_id: sid, created_at: { gte: start, lte: end }, status: { not: 'cancelled' } },
            orderBy: { created_at: 'asc' },
            select: { id: true, total_amount: true, created_at: true, method: true }
        });

        // 일별 집계
        const dailyMap = {};
        const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, amount: 0 }));
        const dowMap = Array.from({ length: 7 }, (_, d) => ({ day: DAY_KO[d], count: 0, amount: 0 }));
        const methodMap = {};

        for (const o of orders) {
            const d = o.created_at.toISOString().slice(0, 10);
            if (!dailyMap[d]) dailyMap[d] = { date: d, count: 0, amount: 0 };
            dailyMap[d].count++;
            dailyMap[d].amount += o.total_amount || 0;
            hourly[o.created_at.getHours()].count++;
            hourly[o.created_at.getHours()].amount += o.total_amount || 0;
            dowMap[o.created_at.getDay()].count++;
            dowMap[o.created_at.getDay()].amount += o.total_amount || 0;
            const m = o.method || '기타';
            methodMap[m] = (methodMap[m] || { count: 0, amount: 0 });
            methodMap[m].count++;
            methodMap[m].amount += o.total_amount || 0;
        }

        const totalSales = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
        const subtitle = `${store.name} | ${start.toLocaleDateString('ko-KR')} ~ ${end.toLocaleDateString('ko-KR')} | 생성: ${new Date().toLocaleString('ko-KR')}`;

        const wb = new ExcelJS.Workbook();
        wb.creator = 'WeMarket';
        wb.created = new Date();

        // ── 시트 1: 요약 ──
        const wsSummary = wb.addWorksheet('📊 요약');
        wsSummary.columns = [
            { key: 'label', width: 24 },
            { key: 'value', width: 24 },
        ];
        insertTitle(wsSummary, `매출 통계 보고서`, subtitle, 2);
        const sumHeader = wsSummary.addRow(['항목', '값']);
        applyHeaderStyle(sumHeader, 'FFF97316');

        const summaryRows = [
            ['조회 기간', `${start.toLocaleDateString('ko-KR')} ~ ${end.toLocaleDateString('ko-KR')}`],
            ['총 매출', won(totalSales)],
            ['총 주문 수', `${orders.length}건`],
            ['평균 주문 금액', won(orders.length ? Math.round(totalSales / orders.length) : 0)],
            ['일 평균 매출', won(Object.keys(dailyMap).length ? Math.round(totalSales / Object.keys(dailyMap).length) : 0)],
            ['영업 일수', `${Object.keys(dailyMap).length}일`],
        ];
        summaryRows.forEach((r, i) => {
            const row = wsSummary.addRow(r);
            applyRowStyle(row, i % 2 === 0);
            row.getCell(2).font = { bold: true, color: { argb: 'FFF97316' } };
        });
        wsSummary.getColumn(1).font = { bold: true };

        // ── 시트 2: 일별 매출 ──
        const wsDaily = wb.addWorksheet('📅 일별 매출');
        wsDaily.columns = [
            { key: 'date', header: '날짜', width: 16 },
            { key: 'count', header: '주문 수', width: 14 },
            { key: 'amount', header: '매출액', width: 18 },
            { key: 'avg', header: '평균 주문액', width: 18 },
        ];
        insertTitle(wsDaily, '일별 매출', subtitle, 4);
        applyHeaderStyle(wsDaily.addRow(['날짜', '주문 수', '매출액', '평균 주문액']), 'FF0F172A');
        Object.values(dailyMap).forEach((d, i) => {
            const row = wsDaily.addRow([
                d.date, d.count, won(d.amount),
                won(d.count ? Math.round(d.amount / d.count) : 0)
            ]);
            applyRowStyle(row, i % 2 === 0);
            row.getCell(3).font = { bold: true };
        });
        // 합계 행
        const dailyTotal = wsDaily.addRow(['합계', orders.length, won(totalSales), won(orders.length ? Math.round(totalSales / orders.length) : 0)]);
        applyHeaderStyle(dailyTotal, 'FFF97316');

        // ── 시트 3: 시간대별 매출 ──
        const wsHourly = wb.addWorksheet('⏰ 시간대별');
        wsHourly.columns = [
            { key: 'hour', header: '시간대', width: 14 },
            { key: 'count', header: '주문 수', width: 14 },
            { key: 'amount', header: '매출액', width: 18 },
            { key: 'share', header: '매출 비중', width: 14 },
        ];
        insertTitle(wsHourly, '시간대별 매출', subtitle, 4);
        applyHeaderStyle(wsHourly.addRow(['시간대', '주문 수', '매출액', '매출 비중']), 'FF0F172A');
        hourly.forEach((h, i) => {
            const row = wsHourly.addRow([
                `${String(h.hour).padStart(2, '0')}:00~${String(h.hour).padStart(2, '0')}:59`,
                h.count,
                won(h.amount),
                pct(totalSales ? (h.amount / totalSales) * 100 : 0)
            ]);
            applyRowStyle(row, i % 2 === 0);
        });

        // ── 시트 4: 요일별 매출 ──
        const wsDow = wb.addWorksheet('📆 요일별');
        wsDow.columns = [
            { key: 'day', header: '요일', width: 10 },
            { key: 'count', header: '주문 수', width: 14 },
            { key: 'amount', header: '매출액', width: 18 },
            { key: 'share', header: '매출 비중', width: 14 },
        ];
        insertTitle(wsDow, '요일별 매출', subtitle, 4);
        applyHeaderStyle(wsDow.addRow(['요일', '주문 수', '매출액', '매출 비중']), 'FF0F172A');
        dowMap.forEach((d, i) => {
            const row = wsDow.addRow([
                `${d.day}요일`, d.count, won(d.amount),
                pct(totalSales ? (d.amount / totalSales) * 100 : 0)
            ]);
            applyRowStyle(row, i % 2 === 0);
        });

        // ── 시트 5: 결제수단별 ──
        const wsMethod = wb.addWorksheet('💳 결제수단별');
        wsMethod.columns = [
            { key: 'method', header: '결제수단', width: 18 },
            { key: 'count', header: '주문 수', width: 14 },
            { key: 'amount', header: '매출액', width: 18 },
            { key: 'share', header: '비중', width: 12 },
        ];
        insertTitle(wsMethod, '결제수단별 매출', subtitle, 4);
        applyHeaderStyle(wsMethod.addRow(['결제수단', '주문 수', '매출액', '비중']), 'FF0F172A');
        Object.entries(methodMap).forEach(([m, v], i) => {
            const row = wsMethod.addRow([m, v.count, won(v.amount), pct(totalSales ? (v.amount / totalSales) * 100 : 0)]);
            applyRowStyle(row, i % 2 === 0);
        });

        const fileName = `매출통계_${store.name}_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) { next(err); }
};

/**
 * 2. 주문 내역 Excel
 * GET /api/export/store/:storeId/excel/orders
 */
const exportOrdersExcel = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const { start, end } = parseDateRange(req.query);
        const sid = Number(storeId);

        const store = await prisma.stores.findUnique({ where: { id: sid }, select: { name: true } });
        if (!store) return next(new AppError('매장을 찾을 수 없습니다.', 404));

        const orders = await prisma.orders.findMany({
            where: { store_id: sid, created_at: { gte: start, lte: end } },
            orderBy: { created_at: 'desc' },
            include: {
                order_items: { select: { product_name: true, quantity: true, price: true, subtotal: true } },
                tables: { select: { table_number: true } },
                payments: { select: { status: true, method: true, amount: true } }
            }
        });

        const subtitle = `${store.name} | ${start.toLocaleDateString('ko-KR')} ~ ${end.toLocaleDateString('ko-KR')} | 생성: ${new Date().toLocaleString('ko-KR')}`;

        const wb = new ExcelJS.Workbook();
        wb.creator = 'WeMarket';

        // ── 주문 목록 시트 ──
        const ws = wb.addWorksheet('📋 주문 내역');
        ws.columns = [
            { key: 'no', width: 8 },
            { key: 'order_number', width: 22 },
            { key: 'date', width: 22 },
            { key: 'table', width: 12 },
            { key: 'items', width: 38 },
            { key: 'total', width: 16 },
            { key: 'method', width: 14 },
            { key: 'status', width: 14 },
            { key: 'payment_status', width: 14 },
            { key: 'customer', width: 18 },
        ];
        insertTitle(ws, '주문 내역', subtitle, 10);
        applyHeaderStyle(ws.addRow(['No.', '주문번호', '주문일시', '테이블', '주문 메뉴', '총 금액', '결제수단', '주문상태', '결제상태', '고객연락처']), 'FF0F172A');

        orders.forEach((o, i) => {
            const itemSummary = o.order_items.map(it => `${it.product_name}×${it.quantity}`).join(', ');
            const row = ws.addRow([
                i + 1,
                o.order_number,
                o.created_at?.toLocaleString('ko-KR') || '-',
                o.tables?.table_number || (o.is_takeout ? '포장' : '-'),
                itemSummary,
                won(o.total_amount),
                o.method || '-',
                o.status || '-',
                o.payment_status || '-',
                o.customer_phone || '-',
            ]);
            applyRowStyle(row, i % 2 === 0);
            // 상태 색상
            const statusCell = row.getCell(8);
            if (o.status === 'completed') statusCell.font = { color: { argb: 'FF10B981' }, bold: true };
            else if (o.status === 'cancelled') statusCell.font = { color: { argb: 'FFEF4444' }, bold: true };
            else if (o.status === 'pending') statusCell.font = { color: { argb: 'FFF59E0B' }, bold: true };
        });

        // 합계
        const total = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
        const sumRow = ws.addRow(['', '', '', '', `총 ${orders.length}건`, won(total), '', '', '', '']);
        applyHeaderStyle(sumRow, 'FFF97316');

        const fileName = `주문내역_${store.name}_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) { next(err); }
};

/**
 * 3. 단골 고객 리스트 Excel
 * GET /api/export/store/:storeId/excel/customers
 */
const exportCustomersExcel = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const sid = Number(storeId);

        const store = await prisma.stores.findUnique({ where: { id: sid }, select: { name: true } });
        if (!store) return next(new AppError('매장을 찾을 수 없습니다.', 404));

        const customers = await prisma.store_customers.findMany({
            where: { store_id: sid },
            orderBy: { total_spent: 'desc' }
        });

        const subtitle = `${store.name} | 전체 기간 | 생성: ${new Date().toLocaleString('ko-KR')}`;

        const wb = new ExcelJS.Workbook();
        wb.creator = 'WeMarket';

        const ws = wb.addWorksheet('👥 단골 고객');
        ws.columns = [
            { key: 'rank', width: 8 },
            { key: 'phone', width: 18 },
            { key: 'visits', width: 12 },
            { key: 'total_spent', width: 18 },
            { key: 'avg_spent', width: 18 },
            { key: 'tier', width: 14 },
            { key: 'last_visited', width: 22 },
        ];
        insertTitle(ws, '단골 고객 리스트', subtitle, 7);
        applyHeaderStyle(ws.addRow(['순위', '연락처', '방문 횟수', '누적 결제액', '평균 주문액', '등급', '최근 방문']), 'FF0F172A');

        customers.forEach((c, i) => {
            const row = ws.addRow([
                i + 1,
                c.customer_phone || '-',
                c.visit_count || 0,
                won(c.total_spent),
                won(c.visit_count ? Math.round((c.total_spent || 0) / c.visit_count) : 0),
                c.tier || 'GENERAL',
                c.last_visited_at?.toLocaleDateString('ko-KR') || '-',
            ]);
            applyRowStyle(row, i % 2 === 0);
            // 등급 색상
            const tierColors = { CHAMPIONS: 'FFD97706', LOYAL: 'FF7C3AED', AT_RISK: 'FFDC2626', LOST: 'FF6B7280', NEW: 'FF059669' };
            const tierCell = row.getCell(6);
            const color = tierColors[c.tier?.toUpperCase()] || 'FF1E293B';
            tierCell.font = { bold: true, color: { argb: color } };
        });

        const fileName = `단골고객_${store.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) { next(err); }
};

/**
 * 4. 메뉴 판매 분석 Excel
 * GET /api/export/store/:storeId/excel/menu
 */
const exportMenuExcel = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const { start, end } = parseDateRange(req.query);
        const sid = Number(storeId);

        const store = await prisma.stores.findUnique({ where: { id: sid }, select: { name: true } });
        if (!store) return next(new AppError('매장을 찾을 수 없습니다.', 404));

        const items = await prisma.order_items.findMany({
            where: {
                orders: { store_id: sid, created_at: { gte: start, lte: end }, status: { not: 'cancelled' } }
            },
            include: { products: { select: { id: true } } }
        });

        // 집계
        const map = {};
        for (const item of items) {
            const k = item.product_name;
            if (!map[k]) map[k] = { name: k, qty: 0, revenue: 0 };
            map[k].qty += item.quantity;
            map[k].revenue += item.subtotal || item.price * item.quantity;
        }
        const total = Object.values(map).reduce((s, p) => s + p.revenue, 0);
        let cumulative = 0;
        const ranked = Object.values(map)
            .sort((a, b) => b.revenue - a.revenue)
            .map((p, i) => {
                cumulative += p.revenue;
                const share = total ? (p.revenue / total) * 100 : 0;
                const cShare = total ? (cumulative / total) * 100 : 0;
                return { rank: i + 1, ...p, share, cumShare: cShare, grade: cShare <= 70 ? 'A' : cShare <= 90 ? 'B' : 'C' };
            });

        const subtitle = `${store.name} | ${start.toLocaleDateString('ko-KR')} ~ ${end.toLocaleDateString('ko-KR')} | 생성: ${new Date().toLocaleString('ko-KR')}`;
        const wb = new ExcelJS.Workbook();
        wb.creator = 'WeMarket';

        const ws = wb.addWorksheet('🍽️ 메뉴 분석');
        ws.columns = [
            { key: 'rank', width: 8 },
            { key: 'name', width: 30 },
            { key: 'qty', width: 14 },
            { key: 'revenue', width: 18 },
            { key: 'share', width: 14 },
            { key: 'cum', width: 16 },
            { key: 'grade', width: 10 },
        ];
        insertTitle(ws, '메뉴 판매 분석 (ABC 등급)', subtitle, 7);
        applyHeaderStyle(ws.addRow(['순위', '메뉴명', '판매량', '매출액', '매출 비중', '누적 비중', '등급']), 'FF0F172A');

        ranked.forEach((p, i) => {
            const row = ws.addRow([
                p.rank, p.name, p.qty, won(p.revenue), pct(p.share), pct(p.cumShare), p.grade
            ]);
            applyRowStyle(row, i % 2 === 0);
            const gradeCell = row.getCell(7);
            if (p.grade === 'A') gradeCell.font = { bold: true, color: { argb: 'FF10B981' } };
            else if (p.grade === 'B') gradeCell.font = { bold: true, color: { argb: 'FFF59E0B' } };
            else gradeCell.font = { bold: true, color: { argb: 'FF94A3B8' } };
        });
        ws.addRow(['합계', '', ranked.reduce((s, p) => s + p.qty, 0), won(total), '100%', '', '']);

        const fileName = `메뉴분석_${store.name}_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) { next(err); }
};

// ─── PDF 내보내기 ─────────────────────────────────────────────────────────────

/**
 * 5. 종합 보고서 PDF
 * GET /api/export/store/:storeId/pdf/report
 */
const exportReportPdf = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const { start, end } = parseDateRange(req.query);
        const sid = Number(storeId);

        const store = await prisma.stores.findUnique({ where: { id: sid }, select: { name: true, business_type: true } });
        if (!store) return next(new AppError('매장을 찾을 수 없습니다.', 404));

        // 데이터 수집
        const [orders, items, customers] = await Promise.all([
            prisma.orders.findMany({
                where: { store_id: sid, created_at: { gte: start, lte: end }, status: { not: 'cancelled' } },
                select: { id: true, total_amount: true, created_at: true, method: true, status: true }
            }),
            prisma.order_items.findMany({
                where: { orders: { store_id: sid, created_at: { gte: start, lte: end }, status: { not: 'cancelled' } } },
                select: { product_name: true, quantity: true, subtotal: true, price: true }
            }),
            prisma.store_customers.findMany({
                where: { store_id: sid },
                orderBy: { total_spent: 'desc' },
                take: 5
            })
        ]);

        const totalSales = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
        const avgOrder = orders.length ? Math.round(totalSales / orders.length) : 0;

        // TOP 5 메뉴
        const menuMap = {};
        for (const it of items) {
            if (!menuMap[it.product_name]) menuMap[it.product_name] = { qty: 0, revenue: 0 };
            menuMap[it.product_name].qty += it.quantity;
            menuMap[it.product_name].revenue += it.subtotal || it.price * it.quantity;
        }
        const top5 = Object.entries(menuMap)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 5);

        // 결제수단 분포
        const methodMap = {};
        for (const o of orders) {
            const m = o.method || '기타';
            methodMap[m] = (methodMap[m] || 0) + (o.total_amount || 0);
        }

        // PDF 생성
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 },
            info: { Title: `WeMarket 종합 보고서 - ${store.name}`, Author: 'WeMarket' }
        });

        const fileName = `종합보고서_${store.name}_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        doc.pipe(res);

        const W = 595 - 100; // usable width
        const orange = '#F97316';
        const dark = '#0F172A';
        const gray = '#64748B';
        const light = '#F1F5F9';

        // ── 헤더 배너 ──
        doc.rect(0, 0, 595, 90).fill(dark);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22)
            .text('WeMarket', 50, 22);
        doc.fillColor(orange).font('Helvetica-Bold').fontSize(13)
            .text('종합 매출 보고서', 50, 50);
        doc.fillColor('#94A3B8').font('Helvetica').fontSize(9)
            .text(`${store.name}  |  ${start.toLocaleDateString('ko-KR')} ~ ${end.toLocaleDateString('ko-KR')}  |  생성일: ${new Date().toLocaleString('ko-KR')}`, 50, 70);

        let y = 110;

        // ── 섹션: 핵심 지표 ──
        const drawSectionTitle = (title, yPos) => {
            doc.rect(50, yPos, W, 26).fill(dark);
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(title, 58, yPos + 7);
            return yPos + 36;
        };

        const drawKpiBox = (label, value, xPos, yPos, w = 115) => {
            doc.rect(xPos, yPos, w, 58).fill(light);
            doc.fillColor(gray).font('Helvetica').fontSize(8).text(label, xPos + 8, yPos + 8);
            doc.fillColor(dark).font('Helvetica-Bold').fontSize(13).text(value, xPos + 8, yPos + 26, { width: w - 16 });
        };

        y = drawSectionTitle('핵심 지표', y);
        const kpiW = (W - 9) / 4;
        drawKpiBox('총 매출', won(totalSales), 50, y, kpiW);
        drawKpiBox('총 주문 수', `${orders.length}건`, 50 + kpiW + 3, y, kpiW);
        drawKpiBox('평균 주문액', won(avgOrder), 50 + (kpiW + 3) * 2, y, kpiW);
        drawKpiBox('단골 고객 수', `${customers.length}명`, 50 + (kpiW + 3) * 3, y, kpiW);
        y += 76;

        // ── 섹션: TOP 5 메뉴 ──
        y = drawSectionTitle('TOP 5 인기 메뉴', y);
        doc.rect(50, y, W, 18).fill('#334155');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
            .text('순위', 56, y + 5).text('메뉴명', 90, y + 5).text('판매량', 330, y + 5).text('매출액', 400, y + 5).text('비중', 490, y + 5);
        y += 18;

        top5.forEach(([name, stat], i) => {
            const bg = i % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
            doc.rect(50, y, W, 18).fill(bg);
            const share = totalSales ? pct((stat.revenue / totalSales) * 100) : '0%';
            doc.fillColor(i === 0 ? orange : dark).font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
                .text(`#${i + 1}`, 56, y + 5)
                .text(name.length > 28 ? name.slice(0, 28) + '…' : name, 90, y + 5)
                .text(`${stat.qty}개`, 330, y + 5)
                .text(won(stat.revenue), 400, y + 5)
                .text(share, 490, y + 5);
            y += 18;
        });
        y += 14;

        // ── 섹션: 결제수단 분포 ──
        y = drawSectionTitle('결제수단별 매출', y);
        Object.entries(methodMap).forEach(([method, amount], i) => {
            const bg = i % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
            doc.rect(50, y, W, 18).fill(bg);
            const barW = totalSales ? Math.round((amount / totalSales) * (W - 220)) : 0;
            doc.rect(200, y + 4, barW, 10).fill(orange);
            doc.fillColor(dark).font('Helvetica').fontSize(8)
                .text(method, 56, y + 5)
                .text(won(amount), 110, y + 5)
                .text(pct(totalSales ? (amount / totalSales) * 100 : 0), 455, y + 5);
            y += 18;
        });
        y += 14;

        // ── 섹션: 단골 고객 TOP 5 ──
        if (customers.length > 0) {
            y = drawSectionTitle('단골 고객 TOP 5', y);
            doc.rect(50, y, W, 18).fill('#334155');
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
                .text('순위', 56, y + 5).text('연락처', 90, y + 5).text('방문 횟수', 230, y + 5)
                .text('누적 결제액', 310, y + 5).text('등급', 430, y + 5);
            y += 18;

            customers.forEach((c, i) => {
                const bg = i % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
                doc.rect(50, y, W, 18).fill(bg);
                doc.fillColor(dark).font('Helvetica').fontSize(8)
                    .text(`#${i + 1}`, 56, y + 5)
                    .text(c.customer_phone || '-', 90, y + 5)
                    .text(`${c.visit_count || 0}회`, 230, y + 5)
                    .text(won(c.total_spent), 310, y + 5)
                    .text(c.tier || 'GENERAL', 430, y + 5);
                y += 18;
            });
            y += 14;
        }

        // ── 푸터 ──
        doc.rect(0, 792, 595, 50).fill(dark);
        doc.fillColor('#475569').font('Helvetica').fontSize(8)
            .text('© WeMarket — 본 보고서는 자동 생성되었습니다.', 50, 803)
            .text(`생성 일시: ${new Date().toLocaleString('ko-KR')}`, 400, 803);

        doc.end();
    } catch (err) { next(err); }
};

module.exports = {
    exportSalesExcel,
    exportOrdersExcel,
    exportCustomersExcel,
    exportMenuExcel,
    exportReportPdf,
};
