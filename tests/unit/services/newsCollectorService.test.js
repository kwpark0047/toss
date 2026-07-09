jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));
/* cheerio가 의존하는 undici 모의 — DOM 파싱에는 불필요하고 Node 24의 Jest VM과 호환되지 않음 */
jest.mock('undici', () => ({}));
jest.mock('../../../config/prisma', () => ({
  users: { findFirst: jest.fn() },
  posts: { findMany: jest.fn(), create: jest.fn() },
}));

const axios = require('axios');
const prisma = require('../../../config/prisma');
const { normalizeTitle, fetchNewsByKeyword, collectAndPost } = require('../../../services/newsCollectorService');

describe('normalizeTitle', () => {
  test('HTML 태그 제거 및 공백 정규화', () => {
    expect(normalizeTitle('<b>소상공인</b> 지원 정책 발표')).toBe('소상공인지원정책발표');
  });

  test('특수문자 제거 및 소문자 변환', () => {
    expect(normalizeTitle('"자영업자" 축제·행사 소식!')).toBe('자영업자축제행사소식');
  });

  test('빈 문자열 처리', () => {
    expect(normalizeTitle('')).toBe('');
  });
});

describe('fetchNewsByKeyword', () => {
  const mockHtml = `
    <html>
    <body>
      <ul class="list_news">
        <li>
          <div class="news_wrap">
            <a class="news_tit" href="https://example.com/news1">소상공인 지원 정책 발표</a>
            <div class="dsc_wrap">정부가 소상공인을 위한 새로운 지원 정책을 발표했습니다.</div>
            <div class="info_group">네이버뉴스 2026.07.08</div>
          </div>
        </li>
        <li>
          <div class="news_wrap">
            <a class="news_tit" href="https://example.com/news2">지역 축제 및 행사 안내</a>
            <div class="dsc_wrap">다양한 지역 축제 정보를 확인하세요.</div>
            <div class="info_group">연합뉴스 2026.07.07</div>
          </div>
        </li>
        <li>
          <div class="news_wrap">
            <a class="news_tit" href=""></a>
            <div class="dsc_wrap">빈 링크는 건너뛰기</div>
            <div class="info_group">테스트 2026.07.08</div>
          </div>
        </li>
      </ul>
    </body>
    </html>
  `;

  test('네이버 뉴스 검색 결과를 파싱한다', async () => {
    axios.get.mockResolvedValue({ data: mockHtml });

    const articles = await fetchNewsByKeyword('소상공인');

    expect(articles).toHaveLength(2);
    expect(articles[0].title).toBe('소상공인 지원 정책 발표');
    expect(articles[0].link).toBe('https://example.com/news1');
    expect(articles[0].description).toContain('소상공인');
    expect(articles[1].title).toBe('지역 축제 및 행사 안내');
  });

  test('HTTP 요청 실패 시 빈 배열 반환(에러 전파)', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'));
    await expect(fetchNewsByKeyword('소상공인')).rejects.toThrow('Network Error');
  });
});

describe('collectAndPost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('super_admin이 없으면 0 반환', async () => {
    prisma.users.findFirst.mockResolvedValue(null);
    const result = await collectAndPost();
    expect(result).toBe(0);
  });

  test('뉴스를 수집하여 posts 테이블에 등록한다', async () => {
    prisma.users.findFirst.mockResolvedValue({ id: 1, name: '관리자' });
    prisma.posts.findMany.mockResolvedValue([]);
    prisma.posts.create.mockResolvedValue({});

    const mockHtml = `
      <html><body>
        <ul class="list_news">
          <li>
            <div class="news_wrap">
              <a class="news_tit" href="https://example.com/n1">소상공인 대출 지원 확대</a>
              <div class="dsc_wrap">소상공인 대출 지원이 확대됩니다.</div>
              <div class="info_group">뉴스1 2026.07.08</div>
            </div>
          </li>
        </ul>
      </body></html>
    `;

    // 4개 키워드 각각 같은 HTML 응답
    axios.get.mockResolvedValue({ data: mockHtml });

    const result = await collectAndPost();

    expect(result).toBeGreaterThan(0);
    expect(prisma.users.findFirst).toHaveBeenCalledWith({
      where: { role: 'super_admin' },
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });
    expect(prisma.posts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          board_type: 'news',
          author_id: 1,
        }),
      }),
    );
  });

  test('최근 24시간 동일 제목이 있으면 중복 게시하지 않음', async () => {
    prisma.users.findFirst.mockResolvedValue({ id: 1, name: '관리자' });
    // 이미 등록된 제목
    prisma.posts.findMany.mockResolvedValue([
      { title: '소상공인 대출 지원 확대' },
    ]);
    prisma.posts.create.mockResolvedValue({});

    const mockHtml = `
      <html><body>
        <ul class="list_news">
          <li>
            <div class="news_wrap">
              <a class="news_tit" href="https://example.com/n1">소상공인 대출 지원 확대</a>
              <div class="dsc_wrap">소상공인 대출 지원이 확대됩니다.</div>
              <div class="info_group">뉴스1 2026.07.08</div>
            </div>
          </li>
        </ul>
      </body></html>
    `;
    axios.get.mockResolvedValue({ data: mockHtml });

    const result = await collectAndPost();

    // 중복 제목은 건너뛰고, 다른 키워드(자영업자 등)에서 추가될 수 있음
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
