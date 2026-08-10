const weatherService = require('../services/weatherService');
const WeatherService = require('../services/weatherService');
const { apiLogger } = require('../utils/logger');

const getCurrentWeather = async (req, res) => {
  try {
    const stn = req.query.stn || '108'; // Default to Seoul (108)
    const weather = await weatherService.getCurrentWeather(stn);

    return res.status(200).json({
      success: true,
      data: weather,
    });
  } catch (error) {
    apiLogger.error({ error: error.message }, 'Failed to get current weather in controller');
    return res.status(500).json({
      success: false,
      error: '날씨 정보를 가져오는데 실패했습니다.',
    });
  }
};

/**
 * 향상된 날씨 컨텍스트 (추천 시스템용)
 */
const getEnhancedWeatherContext = async (req, res) => {
  try {
    const stn = req.query.stn || '108';
    const weather = await weatherService.getEnhancedWeatherContext(stn);

    return res.status(200).json({
      success: true,
      data: weather,
    });
  } catch (error) {
    apiLogger.error({ error: error.message }, 'Failed to get enhanced weather context');
    return res.status(500).json({
      success: false,
      error: '향상된 날씨 정보를 가져오는데 실패했습니다.',
    });
  }
};

/**
 * 좌표 기반 날씨 조회
 */
const getWeatherByCoords = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: '위도(lat)와 경도(lng)가 필요합니다.',
      });
    }

    const stn = WeatherService.getStationByCoords(parseFloat(lat), parseFloat(lng));
    const weather = await weatherService.getEnhancedWeatherContext(stn);

    return res.status(200).json({
      success: true,
      data: { ...weather, station: stn },
    });
  } catch (error) {
    apiLogger.error({ error: error.message }, 'Failed to get weather by coords');
    return res.status(500).json({
      success: false,
      error: '좌표 기반 날씨 정보를 가져오는데 실패했습니다.',
    });
  }
};

module.exports = {
  getCurrentWeather,
  getEnhancedWeatherContext,
  getWeatherByCoords,
};
