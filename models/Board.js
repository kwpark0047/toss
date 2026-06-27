const prisma = require('../config/prisma');

/**
 * 게시판(Board) 모델 (Prisma 기반)
 * 게시글(Post)과 댓글(Comment)의 CRUD를 담당합니다.
 */

// ==============================================================
// Post (게시글) 모델
// ==============================================================
const Post = {
    // 게시글 생성
    create: async (data) => {
        const { board_type = 'free', title, content, author_id, author_name, is_pinned = false } = data;
        return await prisma.posts.create({
            data: {
                board_type,
                title,
                content,
                author_id,
                author_name,
                is_pinned,
                created_at: new Date(),
                updated_at: new Date()
            }
        });
    },

    // 게시글 목록 조회 (페이지네이션 + 검색 + 정렬)
    findAll: async (boardType, options = {}) => {
        const { page = 1, limit = 10, search = '', searchType = 'title' } = options;
        const skip = (page - 1) * limit;

        const where = { board_type: boardType };

        // 검색 조건 추가
        if (search) {
            if (searchType === 'title') {
                where.title = { contains: search };
            } else if (searchType === 'content') {
                where.content = { contains: search };
            } else if (searchType === 'author') {
                where.author_name = { contains: search };
            } else if (searchType === 'all') {
                where.OR = [
                    { title: { contains: search } },
                    { content: { contains: search } },
                    { author_name: { contains: search } }
                ];
            }
        }

        // 전체 개수 및 목록 동시 조회
        const [total, posts] = await Promise.all([
            prisma.posts.count({ where }),
            prisma.posts.findMany({
                where,
                orderBy: [
                    { is_pinned: 'desc' },
                    { created_at: 'desc' }
                ],
                take: limit,
                skip: skip
            })
        ]);

        return {
            posts,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit)
        };
    },

    // 게시글 상세 조회
    findById: async (id) => {
        return await prisma.posts.findUnique({
            where: { id }
        });
    },

    // 게시글 수정
    update: async (id, data) => {
        return await prisma.posts.update({
            where: { id },
            data: {
                ...data,
                updated_at: new Date()
            }
        });
    },

    // 게시글 삭제
    delete: async (id) => {
        return await prisma.posts.delete({
            where: { id }
        });
    },

    // 조회수 증가
    incrementView: async (id) => {
        await prisma.posts.update({
            where: { id },
            data: { view_count: { increment: 1 } }
        });
    },

    // 고정글 토글
    togglePin: async (id) => {
        const post = await Post.findById(id);
        if (!post) return null;

        return await prisma.posts.update({
            where: { id },
            data: {
                is_pinned: !post.is_pinned,
                updated_at: new Date()
            }
        });
    },

    // 댓글 수 동기화
    syncCommentCount: async (postId) => {
        const count = await prisma.comments.count({
            where: { post_id: postId }
        });
        await prisma.posts.update({
            where: { id: postId },
            data: { comment_count: count }
        });
    }
};

// ==============================================================
// Comment (댓글) 모델
// ==============================================================
const Comment = {
    // 댓글 작성
    create: async (data) => {
        const { post_id, parent_id = null, content, author_id, author_name } = data;

        const comment = await prisma.comments.create({
            data: {
                post_id,
                parent_id,
                content,
                author_id,
                author_name,
                created_at: new Date()
            }
        });

        // 비동기로 댓글 수 동기화
        await Post.syncCommentCount(post_id);

        return comment;
    },

    // 특정 댓글 조회
    findById: async (id) => {
        return await prisma.comments.findUnique({
            where: { id }
        });
    },

    // 특정 게시글의 모든 댓글 조회 (계층 구조 변환)
    findByPostId: async (postId) => {
        const comments = await prisma.comments.findMany({
            where: { post_id: postId },
            orderBy: { created_at: 'asc' }
        });

        const rootComments = [];
        const commentMap = {};

        comments.forEach(comment => {
            comment.replies = [];
            commentMap[comment.id] = comment;
        });

        comments.forEach(comment => {
            if (comment.parent_id && commentMap[comment.parent_id]) {
                commentMap[comment.parent_id].replies.push(comment);
            } else {
                rootComments.push(comment);
            }
        });

        return rootComments;
    },

    // 댓글 삭제
    delete: async (id) => {
        const comment = await Comment.findById(id);
        if (!comment) return null;

        // 대댓글이 있는 경우 Prisma 스키마 설정에 따라 처리되거나 명시적 삭제 필요
        // 여기서는 명시적으로 대댓글 먼저 삭제 (스키마에 설정되어 있지 않을 경우 대비)
        await prisma.comments.deleteMany({
            where: { parent_id: id }
        });

        const result = await prisma.comments.delete({
            where: { id }
        });

        // 댓글 수 동기화
        await Post.syncCommentCount(comment.post_id);

        return result;
    }
};

module.exports = { Post, Comment };
