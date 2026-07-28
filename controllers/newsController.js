// [수정] 모듈마다 new PrismaClient() 를 만들면 커넥션 풀이 중복 생성되어
// 서버리스/컨테이너 환경에서 DB 연결 수가 폭증한다. 공유 싱글턴을 사용한다.
const prisma = require('../config/prisma');
const { apiLogger } = require('../utils/logger');
const newsCrawlerService = require('../services/newsCrawlerService');

exports.getNews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const source = req.query.source;
    const category = req.query.category;

    const skip = (page - 1) * limit;

    const where = {};
    if (source) where.source = source;
    if (category) where.category = category;

    const [items, total] = await Promise.all([
      prisma.news.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.news.count({ where }),
    ]);

    apiLogger.info({ count: items.length }, 'News retrieved');

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    apiLogger.error({ error: error.message }, 'Failed to fetch news');
    res.status(500).json({ error: '뉴스 조회 실패' });
  }
};

exports.triggerCrawl = async (req, res) => {
  try {
    // Non-blocking trigger
    newsCrawlerService.crawlAllSources();
    res.json({ message: '크롤링 작업이 백그라운드에서 시작되었습니다.' });
  } catch (error) {
    apiLogger.error({ error: error.message }, 'Failed to trigger crawl');
    res.status(500).json({ error: '크롤링 시작 실패' });
  }
};
