jest.mock('../../../config/prisma', () => ({
  stores: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  community_posts: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  community_post_likes: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  store_partnerships: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../../services/notificationService', () => ({
  createNotification: jest.fn(),
}));

const prisma = require('../../../config/prisma');
const CommunityService = require('../../../services/CommunityService');
const { AppError } = require('../../../utils/errorHandler');

describe('CommunityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFeed', () => {
    it('정상적인 페이지네이션을 적용하고 limit을 50으로 제한한다', async () => {
      prisma.community_posts.findMany.mockResolvedValue([]);
      prisma.community_posts.count.mockResolvedValue(0);

      const result = await CommunityService.getFeed({ page: '2', limit: '500' });

      expect(prisma.community_posts.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 50,
        })
      );
      expect(result).toEqual(expect.objectContaining({ page: 2, limit: 50 }));
    });

    it('잘못된 페이지 값은 400으로 거부한다', async () => {
      await expect(CommunityService.getFeed({ page: 'bad' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('createPost', () => {
    it('유효하지 않은 유형과 날짜를 거부한다', async () => {
      await expect(
        CommunityService.createPost(1, 1, {
          type: 'INVALID',
          title: '제목',
          content: '내용',
        })
      ).rejects.toBeInstanceOf(AppError);

      await expect(
        CommunityService.createPost(1, 1, {
          type: 'NEWS',
          title: '제목',
          content: '내용',
          expires_at: 'bad-date',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.stores.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('toggleLike', () => {
    it('없는 게시물은 404로 거부한다', async () => {
      prisma.community_posts.findUnique.mockResolvedValue(null);

      await expect(CommunityService.toggleLike(999, 1)).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.community_post_likes.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('createPartnership', () => {
    it('존재하지 않거나 비활성인 대상 매장은 거부한다', async () => {
      prisma.stores.findFirst.mockResolvedValue({ id: 1, user_id: 1 });
      prisma.stores.findUnique.mockResolvedValue(null);

      await expect(CommunityService.createPartnership(1, 2, 1, '협업')).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(prisma.store_partnerships.create).not.toHaveBeenCalled();
    });
  });

  describe('respondToPartnership', () => {
    it('accept/reject 이외 action은 400으로 거부한다', async () => {
      await expect(CommunityService.respondToPartnership(1, 1, 'approve')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(prisma.store_partnerships.findUnique).not.toHaveBeenCalled();
    });
  });
});
