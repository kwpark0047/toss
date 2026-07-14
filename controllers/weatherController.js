const weatherService = require('../services/weatherService');
const { apiLogger } = require('../services/logger');

const getCurrentWeather = async (req, res) => {
  try {
    const stn = req.query.stn || '108'; // Default to Seoul (108)
    const weather = await weatherService.getCurrentWeather(stn);
    
    return res.status(200).json({
      success: true,
      data: weather
    });
  } catch (error) {
    apiLogger.error({ error: error.message }, 'Failed to get current weather in controller');
    return res.status(500).json({
      success: false,
      error: '날씨 정보를 가져오는데 실패했습니다.'
    });
  }
};

module.exports = {
  getCurrentWeather
};
