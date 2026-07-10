const aiController = require('../../../controllers/aiController');
const aiService = require('../../../services/aiService');
const Product = require('../../../repositories/Product');
const Order = require('../../../repositories/Order');
const Store = require('../../../repositories/Store');

jest.mock('../../../utils/catchAsync', () => (fn) => fn);
jest.mock('../../../services/aiService');
jest.mock('../../../repositories/Product');
jest.mock('../../../repositories/Order');
jest.mock('../../../repositories/Store');

describe('aiController', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            body: {},
            query: {},
            params: {}
        };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
    });

    describe('describeMenu', () => {
        test('메뉴 설명을 성공적으로 생성하여 반환한다', async () => {
            req.body = { name: '아메리카노', category: '커피' };
            aiService.generateMenuDescription.mockResolvedValue('시원하고 고소한 아메리카노입니다.');

            await aiController.describeMenu(req, res);

            expect(aiService.generateMenuDescription).toHaveBeenCalledWith(req.body);
            expect(res.json).toHaveBeenCalledWith({ description: '시원하고 고소한 아메리카노입니다.' });
        });
    });

    describe('generateMenuImage', () => {
        test('매장이 유료 요금제인 경우 이미지를 생성한다', async () => {
            req.body = { store_id: '1', name: '김치찌개' };
            Store.findById.mockResolvedValue({ id: 1, plan: 'pro' });
            aiService.generateMenuImage.mockResolvedValue({ imageUrl: 'http://image.url', keyword: 'kimchi' });

            await aiController.generateMenuImage(req, res);

            expect(Store.findById).toHaveBeenCalledWith(1);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { imageUrl: 'http://image.url', keyword: 'kimchi' }
            });
        });

        test('매장이 무료 요금제(free)인 경우 403 에러를 반환한다', async () => {
            req.body = { store_id: '1', name: '김치찌개' };
            Store.findById.mockResolvedValue({ id: 1, plan: 'free' });

            await aiController.generateMenuImage(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'AI 메뉴 이미지 생성은 유료 구독자 전용 기능입니다. 설정 > 요금제에서 업그레이드해 주세요.'
            });
        });
    });
});
