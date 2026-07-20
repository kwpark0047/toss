const axios = require('axios');
const { apiLogger } = require('../utils/logger');

class WeatherService {
  constructor() {
    this.authKey = process.env.KMA_API_KEY || 'DbUh4_ekRRi1IeP3pPUYog'; // Use user's key as fallback
    this.baseUrl = 'https://apihub.kma.go.kr/api/typ01/url/kma_sfctm2.php';
    this.cachedWeather = null;
    this.lastFetchTime = null;
    this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache
  }

  /**
   * 기상청 ASOS 최신 관측 데이터를 가져옵니다.
   * @param {string} stn - 지점번호 (기본값: 108 서울)
   * @returns {Promise<Object>} 파싱된 날씨 데이터 객체
   */
  async getCurrentWeather(stn = '108') {
    // Check cache
    if (this.cachedWeather && this.lastFetchTime && (Date.now() - this.lastFetchTime < this.CACHE_DURATION)) {
      return this.cachedWeather;
    }

    try {
      const url = `${this.baseUrl}?stn=${stn}&help=0&authKey=${this.authKey}`;
      const response = await axios.get(url, { timeout: 5000 });
      const dataText = response.data;

      const parsedData = this.parseSfctm2(dataText);
      if (parsedData) {
        this.cachedWeather = parsedData;
        this.lastFetchTime = Date.now();
        return parsedData;
      } else {
        throw new Error('No valid weather data found in response');
      }
    } catch (error) {
      apiLogger.error({ error: error.message }, 'Failed to fetch weather data from KMA');
      // Return a safe fallback or cached data if available
      return this.cachedWeather || {
        temp: 20,
        rain: 0,
        humidity: 50,
        isRaining: false,
        condition: 'Clear',
        message: '날씨 정보를 불러올 수 없습니다.'
      };
    }
  }

  parseSfctm2(text) {
    const lines = text.split('\n');
    for (const line of lines) {
      // '#'으로 시작하는 줄은 주석/헤더이므로 무시
      if (line.trim() === '' || line.startsWith('#')) continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length >= 25) {
        const temp = parseFloat(parts[11]);       // TA: 기온
        const humidity = parseFloat(parts[13]);   // HM: 습도
        const rain1hr = parseFloat(parts[15]);    // RN: 1시간 강수량 (-9.0은 강수없음)
        
        const isRaining = rain1hr > 0;
        
        let condition = '맑음';
        if (isRaining) {
          condition = '비/눈';
        } else if (parseFloat(parts[25]) >= 8) {  // CA: 전운량 (0~10)
          condition = '흐림';
        } else if (parseFloat(parts[25]) >= 5) {
          condition = '구름많음';
        }

        return {
          timestamp: parts[0],
          station: parts[1],
          temp: temp === -99 ? null : temp,
          humidity: humidity === -99 ? null : humidity,
          rain: rain1hr < 0 ? 0 : rain1hr,
          isRaining,
          condition
        };
      }
    }
    return null;
  }
}

module.exports = new WeatherService();
