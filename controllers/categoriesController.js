const catchAsync = require('../utils/catchAsync');
const CategoriesService = require('../services/CategoriesService');

const categoriesService = new CategoriesService();

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
        const category = await categoriesService.createCategory(req.body);
        res.status(201).json(category);
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
    })
};

module.exports = categoriesController;
