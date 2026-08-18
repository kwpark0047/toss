// FoodTruckService 디자인 쇼케이스(고객 노출 콘셉트) 단위 테스트
jest.mock('../../../repositories/FoodTruck', () => ({
  findByStoreId: jest.fn(),
  updateDesign: jest.fn(),
}));
jest.mock('../../../services/notificationService', () => ({
  sendSocket: jest.fn().mockReturnValue(true),
}));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const foodTruckService = require('../../../services/FoodTruckService');
const FoodTruckRepository = require('../../../repositories/FoodTruck');
const notificationService = require('../../../services/notificationService');

describe('FoodTruckService · Design Showcase (고객 노출 콘셉트)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateDesignTheme', () => {
    test('유효한 콘셉트는 저장하고 매장 및 관리자 룸에 실시간 브로드캐스트한다', async () => {
      FoodTruckRepository.updateDesign.mockResolvedValue({
        id: 1,
        store_id: 10,
        design_theme: 'concept4',
      });

      const result = await foodTruckService.updateDesignTheme('10', 'concept4');

      expect(FoodTruckRepository.updateDesign).toHaveBeenCalledWith('10', 'concept4');
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'store - 10',
        'food-truck-design-updated',
        expect.objectContaining({ storeId: 10, design_theme: 'concept4' })
      );
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'admin',
        'global-food-truck-design-updated',
        expect.objectContaining({ storeId: 10, design_theme: 'concept4' })
      );
      expect(result.design_theme).toBe('concept4');
    });

    test('지원하지 않는 콘셉트는 AppError(400)를 던진다', async () => {
      await expect(
        foodTruckService.updateDesignTheme('10', 'concept_사이버')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_DESIGN_THEME',
      });
      expect(FoodTruckRepository.updateDesign).not.toHaveBeenCalled();
      expect(notificationService.sendSocket).not.toHaveBeenCalled();
    });
  });

  describe('getDesignTheme', () => {
    test('저장된 콘셉트를 반환한다', async () => {
      FoodTruckRepository.findByStoreId.mockResolvedValue({
        store_id: 10,
        design_theme: 'concept3',
      });

      const theme = await foodTruckService.getDesignTheme('10');
      expect(theme).toBe('concept3');
    });

    test('아직 저장 전이면 기본 concept1을 반환한다', async () => {
      FoodTruckRepository.findByStoreId.mockResolvedValue(null);

      const theme = await foodTruckService.getDesignTheme('999');
      expect(theme).toBe('concept1');
    });
  });
});
