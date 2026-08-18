const boardController = require('../../../controllers/boardController');
const { Post, Comment } = require('../../../repositories/Board');

jest.mock('../../../utils/catchAsync', () => (fn) => fn);
jest.mock('../../../repositories/Board');

describe('boardController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      query: {},
      params: {},
      user: { id: 1, name: '홍길동', role: 'free_user' },
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('getPostById', () => {
    test('게시글을 성공적으로 상세조회한다', async () => {
      req.params.id = '123';
      const mockPost = { id: 123, title: '테스트', view_count: 5 };
      Post.findById.mockResolvedValue(mockPost);
      Post.incrementView.mockResolvedValue();

      await boardController.getPostById(req, res);

      expect(Post.findById).toHaveBeenCalledWith(123, 1);
      expect(Post.incrementView).toHaveBeenCalledWith(123);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { ...mockPost, view_count: 6 },
      });
    });

    test('잘못된 게시글 ID는 저장소를 호출하지 않고 400을 반환한다', async () => {
      req.params.id = 'not-a-number';

      await boardController.getPostById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(Post.findById).not.toHaveBeenCalled();
    });
  });

  describe('createPost', () => {
    test('제목이나 내용이 공백이면 400을 반환한다', async () => {
      req.params.type = 'free';
      req.body = { title: '   ', content: '내용' };

      await boardController.createPost(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(Post.create).not.toHaveBeenCalled();
    });

    test('태그가 문자열이 아니면 400을 반환한다', async () => {
      req.params.type = 'free';
      req.body = { title: '제목', content: '내용', tags: ['잘못된 형식'] };

      await boardController.createPost(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(Post.create).not.toHaveBeenCalled();
    });
  });

  describe('createComment', () => {
    test('잘못된 부모 댓글 ID는 400을 반환한다', async () => {
      req.params.id = '10';
      req.body = { content: '댓글', parent_id: 'invalid' };

      await boardController.createComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(Comment.create).not.toHaveBeenCalled();
    });
  });
});
