const request = require('supertest');
const { app } = require('../../app');
const aiService = require('../../services/aiService');
const Product = require('../../repositories/Product');
const Order = require('../../repositories/Order');
const Store = require('../../repositories/Store');

jest.mock('../../services/aiService');
jest.mock('../../repositories/Product');
jest.mock('../../repositories/Order');
jest.mock('../../repositories/Store');

describe('AI Integration Tests', () => {
    const baseUrl = '/api/ai';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /describe-menu', () => {
        it('should generate description successfully', async () => {
            aiService.generateMenuDescription.mockResolvedValue('고소하고 깊은 맛의 프리미엄 에스프레소.');

            const response = await request(app)
                .post(`${baseUrl}/describe-menu`)
                .send({ name: '에스프레소', category: '커피', price: 3000 });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ description: '고소하고 깊은 맛의 프리미엄 에스프레소.' });
            expect(aiService.generateMenuDescription).toHaveBeenCalledWith({
                name: '에스프레소',
                category: '커피',
                price: 3000,
                description: undefined
            });
        });

        it('should return 400 when name is missing', async () => {
            const response = await request(app)
                .post(`${baseUrl}/describe-menu`)
                .send({ category: '커피' });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /recommend', () => {
        it('should recommend menus successfully', async () => {
            const mockProducts = [
                { id: 1, name: '아메리카노', is_active: true },
                { id: 2, name: '치즈케이크', is_active: true }
            ];
            Product.findActiveAndInStock.mockResolvedValue(mockProducts);
            Order.findTrendingProducts.mockResolvedValue([1]);
            Product.findByIds.mockResolvedValue([{ id: 1, name: '아메리카노' }]);
            
            aiService.recommendMenus.mockResolvedValue([
                { id: 1, reason: '트렌디하고 시원해서' }
            ]);

            const response = await request(app)
                .post(`${baseUrl}/recommend`)
                .send({ store_id: 1, weather: '맑음', mood: '기쁨' });

            expect(response.status).toBe(200);
            expect(response.body.recommendations).toHaveLength(1);
            expect(response.body.recommendations[0].name).toBe('아메리카노');
            expect(response.body.recommendations[0].recommend_reason).toBe('트렌디하고 시원해서');
        });

        it('should return empty recommendations when product list is empty', async () => {
            Product.findActiveAndInStock.mockResolvedValue([]);

            const response = await request(app)
                .post(`${baseUrl}/recommend`)
                .send({ store_id: 1 });

            expect(response.status).toBe(200);
            expect(response.body.recommendations).toEqual([]);
        });
    });

    describe('POST /recommend-dessert', () => {
        it('should recommend desserts successfully', async () => {
            const mockDesserts = [
                { id: 10, name: '마카롱', category: '디저트' }
            ];
            Product.findDessertsForStore.mockResolvedValue(mockDesserts);
            aiService.recommendDesserts.mockResolvedValue([
                { id: 10, reason: '달콤한 마카롱이 메인 음료와 잘 어울려요' }
            ]);

            const response = await request(app)
                .post(`${baseUrl}/recommend-dessert`)
                .send({ store_id: 1, currentItems: ['아메리카노'] });

            expect(response.status).toBe(200);
            expect(response.body.recommendations).toHaveLength(1);
            expect(response.body.recommendations[0].name).toBe('마카롱');
            expect(response.body.recommendations[0].recommend_reason).toBe('달콤한 마카롱이 메인 음료와 잘 어울려요');
        });

        it('should return 400 when store_id is missing', async () => {
            const response = await request(app)
                .post(`${baseUrl}/recommend-dessert`)
                .send({ currentItems: ['아메리카노'] });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /translate-menu', () => {
        it('should batch translate store products successfully', async () => {
            Product.findActiveByStoreId.mockResolvedValue([
                { id: 1, name: '아메리카노', description: '시원한 에스프레소 워터' }
            ]);
            aiService.batchTranslateMenus.mockResolvedValue([
                { id: 1, name: 'Americano', description: 'Cold espresso water' }
            ]);

            const response = await request(app)
                .post(`${baseUrl}/translate-menu`)
                .send({ store_id: 1, targetLang: 'en' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.targetLang).toBe('en');
            expect(response.body.translations).toHaveLength(1);
            expect(response.body.translations[0].name).toBe('Americano');
        });
    });

    describe('POST /translate', () => {
        it('should translate single text successfully', async () => {
            aiService.translateText.mockResolvedValue('Hello');

            const response = await request(app)
                .post(`${baseUrl}/translate`)
                .send({ text: '안녕하세요', targetLang: 'en' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.translated).toBe('Hello');
        });
    });

    describe('POST /storytelling', () => {
        it('should generate storytelling successfully', async () => {
            aiService.generateMenuStory.mockResolvedValue('갓 볶은 원두로 정성껏 내린 풍미 가득한 스토리.');

            const response = await request(app)
                .post(`${baseUrl}/storytelling`)
                .send({ name: '카페라떼', category: '커피' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.story).toBe('갓 볶은 원두로 정성껏 내린 풍미 가득한 스토리.');
        });
    });

    describe('POST /analyze-menu-list', () => {
        it('should analyze menu list successfully', async () => {
            aiService.analyzeMenuList.mockResolvedValue([
                { name: '아메리카노', category: '음료' }
            ]);

            const response = await request(app)
                .post(`${baseUrl}/analyze-menu-list`)
                .send({ menuNames: ['아메리카노', '카페라떼'] });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.suggestions).toHaveLength(1);
        });

        it('should return 400 when menuNames is missing', async () => {
            const response = await request(app)
                .post(`${baseUrl}/analyze-menu-list`)
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('POST /propose-menu-full', () => {
        it('should propose menu full metadata successfully', async () => {
            aiService.proposeMenuFull.mockResolvedValue({
                description: '부드러운 크림이 올라간 라떼',
                price: 5500
            });

            const response = await request(app)
                .post(`${baseUrl}/propose-menu-full`)
                .send({ name: '아인슈페너' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.proposal.price).toBe(5500);
        });
    });

    describe('POST /recommend-pairing', () => {
        it('should recommend pairing products successfully', async () => {
            Order.findPairingData.mockResolvedValue([
                { product_id: 2, _count: { product_id: 15 } }
            ]);
            Product.findByIds.mockResolvedValue([
                { id: 2, name: '치즈케이크', price: 5000 }
            ]);

            const response = await request(app)
                .post(`${baseUrl}/recommend-pairing`)
                .send({ store_id: 1, product_ids: [1] });

            expect(response.status).toBe(200);
            expect(response.body.recommendations).toHaveLength(1);
            expect(response.body.recommendations[0].name).toBe('치즈케이크');
            expect(response.body.recommendations[0].pairing_score).toBe(15);
        });
    });

    describe('POST /generate-menu-image', () => {
        it('should generate image when plan is premium', async () => {
            Store.findById.mockResolvedValue({ id: 1, plan: 'pro' });
            aiService.generateMenuImage.mockResolvedValue({
                imageUrl: 'http://image.url/1.png',
                keyword: 'coffee'
            });

            const response = await request(app)
                .post(`${baseUrl}/generate-menu-image`)
                .send({ store_id: 1, name: '바닐라 라떼' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.imageUrl).toBe('http://image.url/1.png');
        });

        it('should return 403 when plan is free', async () => {
            Store.findById.mockResolvedValue({ id: 1, plan: 'free' });

            const response = await request(app)
                .post(`${baseUrl}/generate-menu-image`)
                .send({ store_id: 1, name: '바닐라 라떼' });

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });
    });
});
