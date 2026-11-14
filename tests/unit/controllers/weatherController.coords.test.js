jest.mock('../../../services/weatherService', () => ({
  getCurrentWeather: jest.fn(),
  getEnhancedWeatherContext: jest.fn().mockResolvedValue({ temp: 18, source: 'kma' }),
  getStationByCoords: jest.fn(() => '174'),
}));
jest.mock('../../../utils/logger', () => ({ apiLogger: { error: jest.fn(), warn: jest.fn() } }));

const weatherService = require('../../../services/weatherService');
const { getWeatherByCoords } = require('../../../controllers/weatherController');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('getWeatherByCoords', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    [{ lat: 'abc', lng: '127.5' }],
    [{ lat: '37.5', lng: 'Infinity' }],
    [{ lat: '40', lng: '127.5' }],
    [{ lat: '37.5', lng: '133' }],
    [{}],
  ])('잘못되거나 KMA 국내 범위 밖인 좌표는 거부한다: %j', async (query) => {
    const res = response();
    await getWeatherByCoords({ query }, res);

    expect(res.statusCode).toBe(400);
    expect(weatherService.getStationByCoords).not.toHaveBeenCalled();
    expect(weatherService.getEnhancedWeatherContext).not.toHaveBeenCalled();
  });

  it('유효한 매장 좌표를 가장 가까운 관측 지점 조회에 전달한다', async () => {
    const res = response();
    await getWeatherByCoords({ query: { lat: '37.5', lng: '126.8' } }, res);

    expect(weatherService.getStationByCoords).toHaveBeenCalledWith(37.5, 126.8);
    expect(weatherService.getEnhancedWeatherContext).toHaveBeenCalledWith('174');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({ temp: 18, station: '174' });
  });
});
