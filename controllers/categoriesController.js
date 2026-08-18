const catchAsync = require('../utils/catchAsync');
const CategoriesService = require('../services/CategoriesService');
const { getStoreRole, rolePermissions } = require('../middleware/storeAuth');
const { AppError } = require('../utils/errorHandler');

const categoriesService = new CategoriesService();

async function checkStoreAccess(userId, storeId, requiredPermission = 'items:manage') {
  if (!userId) throw new AppError('인증이 필요합니다.', 401);
  const role = await getStoreRole(userId, storeId);
  if (!role) throw new AppError('해당 매장에 대한 권한이 없습니다.', 403);
  const permissions = rolePermissions[role] || [];
  if (role !== 'owner' && !permissions.includes(requiredPermission)) {
    throw new AppError(`권한이 부족합니다 (${requiredPermission})`, 403);
  }
}

const categoriesController = {
  // [GET] 매장별 카테고리 조회
  getStoreCategories: catchAsync(async (req, res) => {
    const categories = await categoriesService.getStoreCategories(parseInt(req.params.storeId));
    res.json(categories);
  }),

  // [PUT] 카테고리 일괄 정렬 순서 업데이트
  updateSortOrders: catchAsync(async (req, res) => {
    await categoriesService.updateSortOrders(req.body.orders);
    res.json({ message: '정렬 순서가 업데이트되었습니다.' });
  }),

  // [POST] 카테고리 생성
  createCategory: catchAsync(async (req, res) => {
    await checkStoreAccess(req.user.id, req.body.store_id);
    const category = await categoriesService.createCategory(req.body);
    res.created(category);
  }),

  // [PUT] 카테고리 수정
  updateCategory: catchAsync(async (req, res) => {
    const category = await categoriesService.updateCategory(parseInt(req.params.id), req.body);
    res.json(category);
  }),

  // [DELETE] 카테고리 삭제
  deleteCategory: catchAsync(async (req, res) => {
    await categoriesService.deleteCategory(parseInt(req.params.id));
    res.json({ message: '카테고리가 삭제되었습니다.' });
  }),

  // [GET] 전체 카테고리 목록 조회
  getAllCategories: catchAsync(async (req, res) => {
    const categories = await categoriesService.getAllCategories();
    res.json(categories);
  }),

  // [GET] 카테고리 단일 조회
  getCategoryById: catchAsync(async (req, res) => {
    const category = await categoriesService.getCategoryById(parseInt(req.params.id));
    res.json(category);
  }),
};

module.exports = categoriesController;
