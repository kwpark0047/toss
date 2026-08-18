jest.mock('../../../config/prisma', () => ({
  posts: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  post_likes: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  comments: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

const prisma = require('../../../config/prisma');
const { Post, Comment } = require('../../../repositories/Board');

describe('Board repository validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('게시글 목록의 페이지 크기를 50으로 제한한다', async () => {
    prisma.posts.count.mockResolvedValue(0);
    prisma.posts.findMany.mockResolvedValue([]);

    const result = await Post.findAll('free', { page: 2, limit: 500 });

    expect(prisma.posts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 50 })
    );
    expect(result).toEqual(expect.objectContaining({ page: 2, limit: 50, totalPages: 0 }));
  });

  it('존재하지 않는 게시글의 좋아요는 404로 거부한다', async () => {
    prisma.posts.findUnique.mockResolvedValue(null);

    await expect(Post.toggleLike(999, 1)).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.post_likes.findUnique).not.toHaveBeenCalled();
  });

  it('존재하지 않는 게시글에는 댓글을 작성할 수 없다', async () => {
    prisma.posts.findUnique.mockResolvedValue(null);

    await expect(
      Comment.create({ post_id: 999, content: '댓글', author_id: 1, author_name: '사용자' })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.comments.create).not.toHaveBeenCalled();
  });

  it('다른 게시글의 댓글을 부모로 사용할 수 없다', async () => {
    prisma.posts.findUnique.mockResolvedValue({ id: 1 });
    prisma.comments.findUnique.mockResolvedValue({ id: 2, post_id: 999 });

    await expect(
      Comment.create({
        post_id: 1,
        parent_id: 2,
        content: '댓글',
        author_id: 1,
        author_name: '사용자',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.comments.create).not.toHaveBeenCalled();
  });
});
