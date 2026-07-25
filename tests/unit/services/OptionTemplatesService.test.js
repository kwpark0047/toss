// OptionTemplatesService 단위 테스트
jest.mock('../../../repositories/OptionTemplate', () => ({
    findByStoreId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

const OptionTemplatesService = require('../../../services/OptionTemplatesService');
const OptionTemplate = require('../../../repositories/OptionTemplate');

describe('OptionTemplatesService', () => {
    let svc;

    beforeEach(() => {
        jest.clearAllMocks();
        svc = new OptionTemplatesService();
    });

    describe('getTemplatesByStore', () => {
        test('매장 ID가 제공되면 옵션 템플릿 목록을 성공적으로 반환한다', async () => {
            const mockTemplates = [
                { id: 1, store_id: 1, name: '스테이크 굽기', options: '["레어", "미디움", "웰던"]' }
            ];
            OptionTemplate.findByStoreId.mockResolvedValue(mockTemplates);

            const result = await svc.getTemplatesByStore(1);

            expect(result).toEqual(mockTemplates);
            expect(OptionTemplate.findByStoreId).toHaveBeenCalledWith(1);
        });

        test('매장 ID가 누락되면 에러를 발생시킨다', async () => {
            await expect(svc.getTemplatesByStore(null)).rejects.toThrow('매장 ID는 필수입니다.');
        });
    });

    describe('createTemplate', () => {
        test('필수 파라미터가 없으면 에러를 발생시킨다', async () => {
            await expect(svc.createTemplate({ storeId: null, name: '토핑', options: [] }))
                .rejects.toThrow('매장 ID와 템플릿 이름은 필수입니다.');

            await expect(svc.createTemplate({ storeId: 1, name: null, options: [] }))
                .rejects.toThrow('매장 ID와 템플릿 이름은 필수입니다.');
        });

        test('옵션 객체가 들어오면 문자열로 직렬화하여 저장하고 생성된 템플릿을 반환한다', async () => {
            const mockCreated = { id: 1, store_id: 1, name: '당도', options: '["기본", "덜달게"]' };
            OptionTemplate.create.mockResolvedValue(mockCreated);

            const result = await svc.createTemplate({
                storeId: 1,
                name: '당도',
                options: ['기본', '덜달게']
            });

            expect(result).toEqual(mockCreated);
            expect(OptionTemplate.create).toHaveBeenCalledWith({
                store_id: 1,
                name: '당도',
                options: '["기본","덜달게"]'
            });
        });

        test('옵션이 이미 문자열인 경우 그대로 저장한다', async () => {
            const mockCreated = { id: 2, store_id: 1, name: '사이즈업', options: '["S", "M", "L"]' };
            OptionTemplate.create.mockResolvedValue(mockCreated);

            const result = await svc.createTemplate({
                storeId: 1,
                name: '사이즈업',
                options: '["S", "M", "L"]'
            });

            expect(result).toEqual(mockCreated);
            expect(OptionTemplate.create).toHaveBeenCalledWith({
                store_id: 1,
                name: '사이즈업',
                options: '["S", "M", "L"]'
            });
        });
    });

    describe('updateTemplate', () => {
        test('템플릿 ID가 없으면 에러를 발생시킨다', async () => {
            await expect(svc.updateTemplate(null, { name: '이름수정' }))
                .rejects.toThrow('템플릿 ID가 제공되지 않았습니다.');
        });

        test('이름과 옵션을 성공적으로 수정하여 반환한다', async () => {
            const mockUpdated = { id: 1, store_id: 1, name: '굽기 수정', options: '["레어", "미디움"]' };
            OptionTemplate.update.mockResolvedValue(mockUpdated);

            const result = await svc.updateTemplate(1, {
                name: '굽기 수정',
                options: ['레어', '미디움']
            });

            expect(result).toEqual(mockUpdated);
            expect(OptionTemplate.update).toHaveBeenCalledWith(1, {
                name: '굽기 수정',
                options: '["레어","미디움"]'
            });
        });
    });

    describe('deleteTemplate', () => {
        test('정상적인 템플릿 ID가 주어지면 템플릿을 물리 삭제한다', async () => {
            OptionTemplate.delete.mockResolvedValue(true);

            const result = await svc.deleteTemplate(1);

            expect(result).toBe(true);
            expect(OptionTemplate.delete).toHaveBeenCalledWith(1);
        });

        test('템플릿 ID가 없으면 에러를 발생시킨다', async () => {
            await expect(svc.deleteTemplate(null)).rejects.toThrow('템플릿 ID가 제공되지 않았습니다.');
        });
    });
});
