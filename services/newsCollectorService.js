/**
 * newsCollectorService.js
 * 네이버 뉴스에서 소상공인·자영업자·축제·행사 관련 최신 뉴스를 수집하여
 * 관리자 게시판(board_type='news')에 자동 게시한다.
 *
 * - 수집 주기: 매일 07:00 KST (index.js에서 cron 호출)
 * - 중복 방지: 동일 제목(정규화)의 게시글이 최근 24시간 내 있으면 skip
 * - 작성자: 최고 관리자(super_admin) 중 첫 번째 사용자
 */
const axios = require('axios');
const cheerio = require('cheerio');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

/** 뉴스 수집 키워드 목록 */
const NEWS_KEYWORDS = ['소상공인', '자영업자', '축제', '행사'];

/** HTTP 요청 헤더 (브라우저 흉내) */
const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

/**
 * 뉴스 제목 정규화 (중복 비교용)
 * - 공백·특수문자 제거, 소문자 변환
 */
function normalizeTitle(title) {
  return title
    .replace(/<[^>]+>/g, '')
    .replace(/[\s"',.!?·∼~\-–—(){}・]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * 네이버 뉴스 검색 페이지에서 기사 목록을 추출한다.
 * @param {string} keyword - 검색 키워드
 * @returns {Promise<Array<{title: string, link: string, description: string, pubDate: Date}>>}
 */
async function fetchNewsByKeyword(keyword) {
  const url = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(keyword)}&sort=1&pd=1`;
  const { data: html } = await axios.get(url, { headers: REQUEST_HEADERS, timeout: 10000 });
  const $ = cheerio.load(html);
  const articles = [];
  const seenLinks = new Set();

  $('.news_wrap, ul.list_news > li, .bx > .news_wrap').each((_, el) => {
    const $el = $(el);
    const titleEl = $el.find('a.news_tit, a[title]').first();
    const title = titleEl.text().trim() || $el.find('.news_tit').text().trim();
    const link = titleEl.attr('href') || '';
    const descEl = $el.find('.dsc_wrap, .news_dsc, .api_txt_lines, .dsc_txt_wrap');
    const description = descEl.text().trim() || '';
    const infoEl = $el.find('.info_group, .sub_info');
    const dateText = infoEl.text().trim();

    if (!title || !link) return;
    if (seenLinks.has(link)) return;
    seenLinks.add(link);

    // 날짜 파싱 (네이버 형식: "2026.07.08" 또는 "1시간 전" 등)
    let pubDate = new Date();
    const dateMatch = dateText.match(/(\d{4})[./](\d{1,2})[./](\d{1,2})/);
    if (dateMatch) {
      pubDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
    }

    // 최대 키워드당 15개만 수집
    if (articles.length >= 15) return;

    articles.push({ title, link, description, pubDate });
  });

  return articles;
}

/**
 * 수집된 모든 뉴스를 posts 테이블에 저장한다.
 * 중복(동일 제목, 최근 24시간)은 건너뛴다.
 * @returns {Promise<number>} 신규 등록된 게시글 수
 */
async function collectAndPost() {
  // 최고 관리자(super_admin) 조회
  const admin = await prisma.users.findFirst({
    where: { role: 'super_admin' },
    orderBy: { id: 'asc' },
    select: { id: true, name: true },
  });
  if (!admin) {
    logger.warn('[뉴스수집] super_admin 사용자가 없어 게시글을 등록할 수 없습니다.');
    return 0;
  }

  // 최근 24시간 내 등록된 뉴스 제목 목록 (중복 방지)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentPosts = await prisma.posts.findMany({
    where: { board_type: 'news', created_at: { gte: dayAgo } },
    select: { title: true },
  });
  const recentTitles = new Set(recentPosts.map(p => normalizeTitle(p.title)));

  let totalPosted = 0;

  for (const keyword of NEWS_KEYWORDS) {
    try {
      const articles = await fetchNewsByKeyword(keyword);
      for (const article of articles) {
        const norm = normalizeTitle(article.title);
        if (recentTitles.has(norm)) continue;
        recentTitles.add(norm); // 동일 배치 내 중복 방지

        // 내용 구성: description + 원본 링크
        const content = [
          `🔍 관련 키워드: ${keyword}`,
          '',
          article.description || '내용을 불러올 수 없습니다.',
          '',
          `📰 출처: ${article.link}`,
        ].join('\n');

        await prisma.posts.create({
          data: {
            board_type: 'news',
            title: article.title,
            content,
            author_id: admin.id,
            author_name: `${admin.name} (뉴스봇)`,
            is_pinned: false,
            tags: keyword,
            view_count: 0,
            like_count: 0,
            comment_count: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        totalPosted++;
      }
      logger.info(`[뉴스수집] "${keyword}" → ${articles.length}건 수집, ${articles.filter(a => !recentTitles.has(normalizeTitle(a.title))).length}건 신규`);
    } catch (err) {
      logger.error({ error: err.message }, `[뉴스수집] "${keyword}" 검색 실패`);
    }
  }

  if (totalPosted > 0) {
    logger.info(`[뉴스수집] 총 ${totalPosted}건의 뉴스가 게시판에 등록되었습니다.`);
  }
  return totalPosted;
}

/**
 * 수동 트리거용 (관리자 페이지 등에서 호출)
 */
async function triggerCollect() {
  return collectAndPost();
}

module.exports = { collectAndPost, triggerCollect, fetchNewsByKeyword, normalizeTitle };
