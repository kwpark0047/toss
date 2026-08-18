const { Post, Comment } = require('../repositories/Board');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

const parsePositiveId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const normalizeTags = (tags) => {
  if (tags == null) return '';
  if (typeof tags !== 'string') return null;
  return tags
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#/, '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5)
    .join(',');
};

const isAdmin = (user) => ['super_admin', 'store_admin'].includes(user?.role);

const boardController = {
  // [게시글 단일 상세 조회]
  getPostById: catchAsync(async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id)
      return res.status(400).json({ success: false, error: '유효하지 않은 게시글 ID입니다.' });

    const post = await Post.findById(id, req.user?.id);
    if (!post) return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다.' });

    Post.incrementView(id).catch((e) => logger.error(e));
    post.view_count = (post.view_count || 0) + 1;

    return res.json({ success: true, data: post });
  }),

  // [게시글 수정]
  updatePost: catchAsync(async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id)
      return res.status(400).json({ success: false, error: '유효하지 않은 게시글 ID입니다.' });
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ success: false, error: '게시글이 없습니다.' });

    if (post.author_id !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: '수정 권한이 없습니다.' });
    }

    const { title, content, is_pinned, tags } = req.body;
    if (title !== undefined && !title?.trim()) {
      return res.status(400).json({ success: false, error: '제목은 비워둘 수 없습니다.' });
    }
    if (content !== undefined && !content?.trim()) {
      return res.status(400).json({ success: false, error: '내용은 비워둘 수 없습니다.' });
    }
    const normalizedTags = tags != null ? normalizeTags(tags) : post.tags;
    if (normalizedTags === null) {
      return res.status(400).json({ success: false, error: '태그 형식이 올바르지 않습니다.' });
    }

    const updated = await Post.update(id, {
      ...(title && { title: title.trim() }),
      ...(content && { content: content.trim() }),
      ...(isAdmin(req.user) && is_pinned !== undefined && { is_pinned }),
      tags: normalizedTags,
    });

    return res.json({ success: true, data: updated, message: '수정되었습니다.' });
  }),

  // [게시글 삭제]
  deletePost: catchAsync(async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id)
      return res.status(400).json({ success: false, error: '유효하지 않은 게시글 ID입니다.' });
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ success: false, error: '게시글이 없습니다.' });

    if (post.author_id !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: '삭제 권한이 없습니다.' });
    }

    await Post.delete(id);
    return res.json({ success: true, message: '삭제되었습니다.' });
  }),

  // [게시글 상단 고정 토글]
  togglePin: catchAsync(async (req, res) => {
    if (!isAdmin(req.user))
      return res.status(403).json({ success: false, error: '권한이 없습니다.' });

    const id = parsePositiveId(req.params.id);
    if (!id)
      return res.status(400).json({ success: false, error: '유효하지 않은 게시글 ID입니다.' });
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ success: false, error: '게시글이 없습니다.' });

    const updated = await Post.togglePin(id);
    return res.json({
      success: true,
      data: updated,
      message: updated.is_pinned ? '고정되었습니다.' : '해제되었습니다.',
    });
  }),

  // [게시글 좋아요 토글]
  toggleLike: catchAsync(async (req, res) => {
    const postId = parsePositiveId(req.params.id);
    if (!postId)
      return res.status(400).json({ success: false, error: '유효하지 않은 게시글 ID입니다.' });
    const userId = req.user.id;

    const result = await Post.toggleLike(postId, userId);
    return res.json({ success: true, data: result });
  }),

  // [댓글 목록 조회]
  getComments: catchAsync(async (req, res) => {
    const postId = parsePositiveId(req.params.id);
    if (!postId)
      return res.status(400).json({ success: false, error: '유효하지 않은 게시글 ID입니다.' });
    const nestedComments = await Comment.findByPostId(postId);
    return res.json({ success: true, data: nestedComments });
  }),

  // [댓글 작성]
  createComment: catchAsync(async (req, res) => {
    const post_id = parsePositiveId(req.params.id);
    if (!post_id)
      return res.status(400).json({ success: false, error: '유효하지 않은 게시글 ID입니다.' });
    const { content, parent_id = null } = req.body;
    if (!content?.trim())
      return res.status(400).json({ success: false, error: '내용을 입력해주세요.' });
    const parentId = parent_id === null || parent_id === '' ? null : parsePositiveId(parent_id);
    if (parent_id !== null && parent_id !== '' && !parentId) {
      return res.status(400).json({ success: false, error: '유효하지 않은 부모 댓글 ID입니다.' });
    }

    const comment = await Comment.create({
      post_id,
      parent_id: parentId,
      content: content.trim(),
      author_id: req.user.id,
      author_name: req.user.name,
    });

    return res.created(comment, '등록되었습니다.');
  }),

  // [댓글 삭제]
  deleteComment: catchAsync(async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: '유효하지 않은 댓글 ID입니다.' });
    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ success: false, error: '댓글이 없습니다.' });

    if (comment.author_id !== req.user.id && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: '삭제 권한이 없습니다.' });
    }

    await Comment.delete(id);
    return res.json({ success: true, message: '삭제되었습니다.' });
  }),

  // [인기 게시글 목록 조회]
  getTrendingPosts: catchAsync(async (req, res) => {
    const { limit = 5 } = req.query;
    const posts = await Post.findTrending(limit);
    return res.json({ success: true, data: posts });
  }),

  // [게시글 목록 조회]
  getPosts: catchAsync(async (req, res) => {
    const { type } = req.params;
    const validTypes = ['notice', 'free', 'faq', 'qna', 'news'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: '유효하지 않은 게시판 타입입니다.' });
    }

    const { page = 1, limit = 12, search = '', searchType = 'title', tag = '' } = req.query;
    const result = await Post.findAll(type, { page, limit, search, searchType, tag }, req.user?.id);

    return res.json({
      success: true,
      data: result,
    });
  }),

  // [게시글 작성]
  createPost: catchAsync(async (req, res) => {
    const { type } = req.params;
    if (!['notice', 'free', 'faq', 'qna', 'news'].includes(type)) {
      return res.status(400).json({ success: false, error: '유효하지 않은 타입입니다.' });
    }
    if (['notice', 'faq', 'news'].includes(type) && !isAdmin(req.user)) {
      return res
        .status(403)
        .json({ success: false, error: '해당 게시판은 관리자만 작성 가능합니다.' });
    }

    const { title, content, is_pinned = false, tags = '' } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ success: false, error: '제목과 내용을 모두 입력해주세요.' });
    }

    const normalizedTags = normalizeTags(tags);
    if (normalizedTags === null) {
      return res.status(400).json({ success: false, error: '태그 형식이 올바르지 않습니다.' });
    }

    const post = await Post.create({
      board_type: type,
      title: title.trim(),
      content: content.trim(),
      author_id: req.user.id,
      author_name: req.user.name,
      is_pinned: isAdmin(req.user) ? is_pinned : false,
      tags: normalizedTags,
    });

    return res.created(post, '등록되었습니다.');
  }),
};

module.exports = boardController;
