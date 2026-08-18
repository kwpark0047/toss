const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

const MAX_BOARD_LIMIT = 50;

const parsePositiveInt = (value, fieldName, defaultValue = null) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName}는 양의 정수여야 합니다.`, 400);
  }
  return parsed;
};

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
    const {
      board_type = 'free',
      title,
      content,
      author_id,
      author_name,
      is_pinned = false,
      tags = '',
    } = data;
    return await prisma.posts.create({
      data: {
        board_type,
        title,
        content,
        author_id,
        author_name,
        is_pinned,
        tags,
        like_count: 0,
        view_count: 0,
        comment_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  },

  // 게시글 목록 조회 (페이지네이션 + 검색 + 정렬 + 태그 필터 + 좋아요 연동)
  findAll: async (boardType, options = {}, userId = null) => {
    const { page = 1, limit = 10, search = '', searchType = 'title', tag = '' } = options;
    const pageNumber = parsePositiveInt(page, '페이지', 1);
    const limitNumber = Math.min(parsePositiveInt(limit, '페이지 크기', 10), MAX_BOARD_LIMIT);
    const skip = (pageNumber - 1) * limitNumber;

    const where = { board_type: boardType };

    // 검색 조건 추가
    if (search) {
      if (searchType === 'title') {
        where.title = { contains: search };
      } else if (searchType === 'content') {
        where.content = { contains: search };
      } else if (searchType === 'author') {
        where.author_name = { contains: search };
      } else {
        where.OR = [
          { title: { contains: search } },
          { content: { contains: search } },
          { author_name: { contains: search } },
        ];
      }
    }

    // 태그 조건 추가
    if (tag) {
      where.tags = { contains: tag };
    }

    // 전체 개수 및 목록 동시 조회
    const [total, posts] = await Promise.all([
      prisma.posts.count({ where }),
      prisma.posts.findMany({
        where,
        orderBy: [{ is_pinned: 'desc' }, { created_at: 'desc' }],
        take: limitNumber,
        skip: skip,
      }),
    ]);

    let likedPostIds = new Set();
    if (userId && posts.length > 0) {
      const likes = await prisma.post_likes.findMany({
        where: { user_id: userId, post_id: { in: posts.map((p) => p.id) } },
        select: { post_id: true },
      });
      likedPostIds = new Set(likes.map((l) => l.post_id));
    }

    const enrichedPosts = posts.map((p) => ({
      ...p,
      is_liked: likedPostIds.has(p.id),
    }));

    return {
      posts: enrichedPosts,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    };
  },

  // 게시글 상세 조회 (좋아요 여부 포함)
  findById: async (id, userId = null) => {
    const post = await prisma.posts.findUnique({
      where: { id },
    });
    if (!post) return null;

    let is_liked = false;
    if (userId) {
      const like = await prisma.post_likes.findUnique({
        where: { post_id_user_id: { post_id: id, user_id: userId } },
      });
      is_liked = !!like;
    }

    return { ...post, is_liked };
  },

  // 게시글 수정
  update: async (id, data) => {
    return await prisma.posts.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  },

  // 게시글 삭제
  delete: async (id) => {
    return await prisma.posts.delete({
      where: { id },
    });
  },

  // 조회수 증가
  incrementView: async (id) => {
    await prisma.posts.update({
      where: { id },
      data: { view_count: { increment: 1 } },
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
        updated_at: new Date(),
      },
    });
  },

  // 댓글 수 동기화
  syncCommentCount: async (postId) => {
    const count = await prisma.comments.count({
      where: { post_id: postId },
    });
    await prisma.posts.update({
      where: { id: postId },
      data: { comment_count: count },
    });
  },

  // 좋아요 토글
  toggleLike: async (postId, userId) => {
    const existingPost = await prisma.posts.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!existingPost) throw new AppError('게시글을 찾을 수 없습니다.', 404);

    const existing = await prisma.post_likes.findUnique({
      where: { post_id_user_id: { post_id: postId, user_id: userId } },
    });

    let liked;
    if (existing) {
      await prisma.post_likes.delete({
        where: { post_id_user_id: { post_id: postId, user_id: userId } },
      });
      await prisma.posts.update({
        where: { id: postId },
        data: { like_count: { decrement: 1 } },
      });
      liked = false;
    } else {
      await prisma.post_likes.create({
        data: { post_id: postId, user_id: userId },
      });
      await prisma.posts.update({
        where: { id: postId },
        data: { like_count: { increment: 1 } },
      });
      liked = true;
    }

    const post = await prisma.posts.findUnique({
      where: { id: postId },
      select: { like_count: true },
    });

    return { liked, like_count: post.like_count };
  },

  // 인기 게시글 목록 조회
  findTrending: async (limit = 5) => {
    const limitNumber = Math.min(parsePositiveInt(limit, 'limit', 5), MAX_BOARD_LIMIT);
    return await prisma.posts.findMany({
      orderBy: [{ like_count: 'desc' }, { view_count: 'desc' }],
      take: limitNumber,
      select: {
        id: true,
        board_type: true,
        title: true,
        author_name: true,
        view_count: true,
        like_count: true,
        comment_count: true,
        created_at: true,
        is_pinned: true,
        tags: true,
      },
    });
  },
};

// ==============================================================
// Comment (댓글) 모델
// ==============================================================
const Comment = {
  // 댓글 작성
  create: async (data) => {
    const { post_id, parent_id = null, content, author_id, author_name } = data;

    const post = await prisma.posts.findUnique({
      where: { id: post_id },
      select: { id: true },
    });
    if (!post) throw new AppError('게시글을 찾을 수 없습니다.', 404);

    if (parent_id !== null) {
      const parent = await prisma.comments.findUnique({
        where: { id: parent_id },
        select: { id: true, post_id: true },
      });
      if (!parent || parent.post_id !== post_id) {
        throw new AppError('유효하지 않은 부모 댓글입니다.', 400);
      }
    }

    const comment = await prisma.comments.create({
      data: {
        post_id,
        parent_id,
        content,
        author_id,
        author_name,
        created_at: new Date(),
      },
    });

    // 비동기로 댓글 수 동기화
    await Post.syncCommentCount(post_id);

    return comment;
  },

  // 특정 댓글 조회
  findById: async (id) => {
    return await prisma.comments.findUnique({
      where: { id },
    });
  },

  // 특정 게시글의 모든 댓글 조회 (계층 구조 변환)
  findByPostId: async (postId) => {
    const comments = await prisma.comments.findMany({
      where: { post_id: postId },
      orderBy: { created_at: 'asc' },
    });

    const rootComments = [];
    const commentMap = {};

    comments.forEach((comment) => {
      comment.replies = [];
      commentMap[comment.id] = comment;
    });

    comments.forEach((comment) => {
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
      where: { parent_id: id },
    });

    const result = await prisma.comments.delete({
      where: { id },
    });

    // 댓글 수 동기화
    await Post.syncCommentCount(comment.post_id);

    return result;
  },
};

module.exports = { Post, Comment };
