const legalController = require('../../../controllers/legalController');
const Store = require('../../../repositories/Store');

jest.mock('../../../utils/catchAsync', () => (fn) => fn);
jest.mock('../../../repositories/Store');

describe('legalController', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            body: {},
            query: {},
            params: {}
        };
        res = {
            success: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
    });

    describe('getStoreTerms', () => {
        test('매장 이용약관을 성공적으로 조회한다', async () => {
            req.params.storeId = '1';
            Store.findById.mockResolvedValue({ id: 1, name: '스타벅스', terms_of_service: '약관내용' });

            await legalController.getStoreTerms(req, res);

            expect(Store.findById).toHaveBeenCalledWith('1');
            expect(res.success).toHaveBeenCalledWith({ content: '약관내용' });
        });
    });
});
