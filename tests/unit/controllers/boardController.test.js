const boardController = require('../../../controllers/boardController');
const { Post } = require('../../../repositories/Board');

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
  });
});
