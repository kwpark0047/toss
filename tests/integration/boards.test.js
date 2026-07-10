const request = require('supertest');
const { app } = require('../../app');
const { Post, Comment } = require('../../repositories/Board');

let mockUser = { id: 1, name: '홍길동', role: 'user' };

jest.mock('../../middleware/auth', () => {
    const mockAuthMiddleware = (req, res, next) => {
        if (!mockUser) {
            return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
        }
        req.user = mockUser;
        next();
    };

    const mockOptionalAuth = (req, res, next) => {
        req.user = mockUser;
        next();
    };

    const mockAdminOnly = (req, res, next) => {
        if (!mockUser || mockUser.role !== 'super_admin') {
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }
        next();
    };

    const mockAuthModule = mockAuthMiddleware;
    mockAuthModule.authMiddleware = mockAuthMiddleware;
    mockAuthModule.optionalAuth = mockOptionalAuth;
    mockAuthModule.adminOnly = mockAdminOnly;

    return mockAuthModule;
});

jest.mock('../../repositories/Board');

describe('Boards Integration Tests', () => {
    const baseUrl = '/api/boards';

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = { id: 1, name: '홍길동', role: 'user' };
    });

    describe('GET /posts/:id', () => {
        it('should get a post by id successfully', async () => {
            Post.findById.mockResolvedValue({
                id: 100,
                title: '테스트 글',
                content: '테스트 내용',
                author_id: 1,
                view_count: 5
            });
            Post.incrementView.mockResolvedValue();

            const response = await request(app).get(`${baseUrl}/posts/100`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(100);
            expect(response.body.data.view_count).toBe(6);
            expect(Post.findById).toHaveBeenCalledWith(100, 1);
        });

        it('should return 404 when post is not found', async () => {
            Post.findById.mockResolvedValue(null);

            const response = await request(app).get(`${baseUrl}/posts/999`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /posts/:id', () => {
        it('should update post successfully when authorized', async () => {
            Post.findById.mockResolvedValue({ id: 100, author_id: 1 });
            Post.update.mockResolvedValue({ id: 100, title: '수정된 제목' });

            const response = await request(app)
                .put(`${baseUrl}/posts/100`)
                .send({ title: '수정된 제목', tags: '수정,게시글' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('수정되었습니다.');
        });

        it('should return 403 when updating another user\'s post', async () => {
            Post.findById.mockResolvedValue({ id: 100, author_id: 2 });

            const response = await request(app)
                .put(`${baseUrl}/posts/100`)
                .send({ title: '수정된 제목' });

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /posts/:id', () => {
        it('should delete post successfully when authorized', async () => {
            Post.findById.mockResolvedValue({ id: 100, author_id: 1 });
            Post.delete.mockResolvedValue();

            const response = await request(app).delete(`${baseUrl}/posts/100`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('삭제되었습니다.');
        });
    });

    describe('PUT /posts/:id/pin', () => {
        it('should toggle pin state for admin', async () => {
            mockUser = { id: 9, name: '어드민', role: 'super_admin' };
            Post.findById.mockResolvedValue({ id: 100, is_pinned: false });
            Post.togglePin.mockResolvedValue({ id: 100, is_pinned: true });

            const response = await request(app).put(`${baseUrl}/posts/100/pin`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.is_pinned).toBe(true);
        });

        it('should return 403 for regular user', async () => {
            const response = await request(app).put(`${baseUrl}/posts/100/pin`);
            expect(response.status).toBe(403);
        });
    });

    describe('POST /posts/:id/like', () => {
        it('should toggle like state', async () => {
            Post.toggleLike.mockResolvedValue({ like_count: 5, is_liked: true });

            const response = await request(app).post(`${baseUrl}/posts/100/like`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.is_liked).toBe(true);
        });
    });

    describe('GET /posts/:id/comments', () => {
        it('should retrieve nested comments list', async () => {
            Comment.findByPostId.mockResolvedValue([
                { id: 1, content: '첫 댓글', parent_id: null }
            ]);

            const response = await request(app).get(`${baseUrl}/posts/100/comments`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
        });
    });

    describe('POST /posts/:id/comments', () => {
        it('should create a comment successfully', async () => {
            Comment.create.mockResolvedValue({ id: 50, content: '새로운 댓글' });

            const response = await request(app)
                .post(`${baseUrl}/posts/100/comments`)
                .send({ content: '새로운 댓글' });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.content).toBe('새로운 댓글');
        });

        it('should return 400 when content is blank', async () => {
            const response = await request(app)
                .post(`${baseUrl}/posts/100/comments`)
                .send({ content: ' ' });

            expect(response.status).toBe(400);
        });
    });

    describe('DELETE /comments/:id', () => {
        it('should delete comment successfully when authorized', async () => {
            Comment.findById.mockResolvedValue({ id: 50, author_id: 1 });
            Comment.delete.mockResolvedValue();

            const response = await request(app).delete(`${baseUrl}/comments/50`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /trending', () => {
        it('should retrieve trending posts', async () => {
            Post.findTrending.mockResolvedValue([
                { id: 10, title: '인기 글 1', view_count: 100 }
            ]);

            const response = await request(app).get(`${baseUrl}/trending?limit=3`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
        });
    });

    describe('GET /:type', () => {
        it('should return posts list for valid board type', async () => {
            Post.findAll.mockResolvedValue({
                items: [{ id: 100, title: '글 1' }],
                total: 1,
                page: 1,
                limit: 12
            });

            const response = await request(app).get(`${baseUrl}/free?page=1&limit=10`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.items).toHaveLength(1);
        });

        it('should return 400 for invalid board type', async () => {
            const response = await request(app).get(`${baseUrl}/invalid-board-type`);
            expect(response.status).toBe(400);
        });
    });

    describe('POST /:type', () => {
        it('should create post successfully', async () => {
            Post.create.mockResolvedValue({ id: 101, title: '새 글', board_type: 'free' });

            const response = await request(app)
                .post(`${baseUrl}/free`)
                .send({ title: '새 글', content: '내용입니다.' });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe('새 글');
        });

        it('should return 403 when non-admin attempts notice boards', async () => {
            const response = await request(app)
                .post(`${baseUrl}/notice`)
                .send({ title: '공지사항', content: '공지 내용' });

            expect(response.status).toBe(403);
        });
    });
});
