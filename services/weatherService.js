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
    if (
      this.cachedWeather &&
      this.lastFetchTime &&
      Date.now() - this.lastFetchTime < this.CACHE_DURATION
    ) {
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
      return (
        this.cachedWeather || {
          temp: 20,
          rain: 0,
          humidity: 50,
          isRaining: false,
          condition: 'Clear',
          message: '날씨 정보를 불러올 수 없습니다.',
        }
      );
    }
  }

  /**
   * 지점번호를 위도/경도로 변환
   */
  static getStationByCoords(lat, lng) {
    // 주요 기상관측 지점 좌표 매핑
    const stations = {
      108: { lat: 37.5665, lng: 126.978, name: '서울' }, // 서울
      112: { lat: 35.1796, lng: 129.0756, name: '부산' }, // 부산
      133: { lat: 35.8714, lng: 128.6014, name: '대구' }, // 대구
      143: { lat: 35.1595, lng: 126.8526, name: '광주' }, // 광주
      146: { lat: 36.3504, lng: 127.3845, name: '대전' }, // 대전
      152: { lat: 35.228, lng: 129.081, name: '울산' }, // 울산
      156: { lat: 36.8151, lng: 127.109, name: '청주' }, // 청주
      159: { lat: 35.8242, lng: 127.148, name: '전주' }, // 전주
      162: { lat: 36.351, lng: 127.892, name: '춘천' }, // 춘천
      165: { lat: 35.1634, lng: 126.908, name: '목포' }, // 목포
      168: { lat: 36.8, lng: 128.6, name: '강릉' }, // 강릉
      170: { lat: 37.5, lng: 127.0333, name: '수원' }, // 수원
      172: { lat: 37.4138, lng: 126.7, name: '인천' }, // 인천
      174: { lat: 37.45, lng: 126.65, name: '부천' }, // 부천
      177: { lat: 37.3799, lng: 126.924, name: '안양' }, // 안양
      184: { lat: 37.55, lng: 127.0833, name: '서울(성북)' }, // 서울 성북
      192: { lat: 37.5665, lng: 126.978, name: '서울(종로)' }, // 서울 종로
      202: { lat: 37.5665, lng: 126.978, name: '서울(중구)' }, // 서울 중구
    };

    // Find closest station
    let closest = '108'; // Default to Seoul
    let minDist = Infinity;

    for (const [id, station] of Object.entries(stations)) {
      const dist = Math.sqrt(Math.pow(lat - station.lat, 2) + Math.pow(lng - station.lng, 2));
      if (dist < minDist) {
        minDist = dist;
        closest = id;
      }
    }

    return closest;
  }

  /**
   * 향상된 날씨 컨텍스트 반환 (추천 시스템용)
   */
  async getEnhancedWeatherContext(stn = '108') {
    const weather = await this.getCurrentWeather(stn);

    // 체감온도 계산 (Heat Index / Wind Chill)
    const feelsLike = this.calculateFeelsLike(weather.temp, weather.humidity);

    // 미세먼지/공기질 등급 추정 (기온/습도/날씨 기반 추정)
    const airQuality = this.estimateAirQuality(weather);

    // 계절 판별
    const season = this.getSeason();

    // 시간대 판별
    const hour = new Date().getHours();
    const timePeriod = this.getTimePeriod(hour);

    // 음식 추천 가중치 계산
    const foodWeights = this.calculateFoodWeights(weather, season, timePeriod);

    return {
      ...weather,
      feelsLike,
      airQuality,
      season,
      timePeriod,
      hour,
      foodWeights,
      // 레거시 호환성
      condition: weather.condition || weather.condition,
    };
  }

  /**
   * 체감온도 계산 (Heat Index / Wind Chill)
   */
  calculateFeelsLike(temp, humidity) {
    if (temp === null || temp === undefined) return temp;

    // Heat Index (고온 다습 시)
    if (temp >= 27 && humidity >= 40) {
      const T = temp;
      const R = humidity;
      const HI =
        -42.379 +
        2.04901523 * T +
        10.14333127 * R -
        0.22475541 * T * R -
        6.83783e-3 * T * T -
        5.481717e-2 * R * R +
        1.22874e-3 * T * T * R +
        8.5282e-4 * T * R * R -
        1.99e-6 * T * T * R * R;
      return Math.round(Math.max(HI, temp) * 10) / 10;
    }

    // Wind Chill (저온 시) - 풍속 데이터 없으므로 단순화
    if (temp <= 10) {
      return Math.round((temp - 1) * 10) / 10;
    }

    return temp;
  }

  /**
   * 공기질 등급 추정 (임시 - 실제 API 연동 시 교체)
   */
  estimateAirQuality(weather) {
    // 강수 시 미세먼지 씻겨 나감
    if (weather.isRaining || weather.rain > 0) {
      return { grade: '좋음', pm10: 20, pm25: 10, level: 1 };
    }

    // 고온 다습 시 오존/미세먼지 상승
    if (weather.temp > 25 && weather.humidity > 70) {
      return { grade: '나쁨', pm10: 80, pm25: 45, level: 3 };
    }

    // 기본값
    return { grade: '보통', pm10: 40, pm25: 20, level: 2 };
  }

  /**
   * 계절 판별
   */
  getSeason() {
    const m = new Date().getMonth();
    if (m >= 2 && m <= 4) return '봄';
    if (m >= 5 && m <= 7) return '여름';
    if (m >= 8 && m <= 10) return '가을';
    return '겨울';
  }

  /**
   * 시간대 판별
   */
  getTimePeriod(hour) {
    if (hour >= 5 && hour < 10) return '아침';
    if (hour >= 10 && hour < 15) return '점심';
    if (hour >= 15 && hour < 17) return '오후';
    if (hour >= 17 && hour < 21) return '저녁';
    return '야식';
  }

  /**
   * 음식 추천 가중치 계산
   */
  calculateFoodWeights(weather, season, timePeriod) {
    const weights = {
      hot: 1.0, // 뜨거운 음식
      cold: 1.0, // 차가운 음식
      spicy: 1.0, // 매운 음식
      soup: 1.0, // 국물 음식
      fried: 1.0, // 튀김/구이
      light: 1.0, // 가벼운 음식
      sweet: 1.0, // 달콤한 음식/디저트
    };

    // 날씨 기반
    if (weather.temp <= 5) {
      weights.hot *= 1.5;
      weights.soup *= 1.5;
      weights.spicy *= 1.2;
      weights.cold *= 0.5;
    } else if (weather.temp <= 15) {
      weights.hot *= 1.2;
      weights.soup *= 1.2;
      weights.cold *= 0.8;
    } else if (weather.temp >= 28) {
      weights.cold *= 1.5;
      weights.light *= 1.3;
      weights.sweet *= 1.2;
      weights.hot *= 0.6;
      weights.soup *= 0.7;
    } else if (weather.temp >= 20) {
      weights.cold *= 1.1;
      weights.light *= 1.1;
    }

    // 강수
    if (weather.isRaining || weather.rain > 0) {
      weights.hot *= 1.3;
      weights.soup *= 1.4;
      weights.spicy *= 1.1;
      weights.fried *= 0.8;
    }

    // 습도
    if (weather.humidity > 80) {
      weights.light *= 0.8;
      weights.soup *= 1.1;
    }

    // 계절
    switch (season) {
      case '겨울':
        weights.hot *= 1.3;
        weights.soup *= 1.3;
        weights.spicy *= 1.1;
        weights.cold *= 0.5;
        break;
      case '여름':
        weights.cold *= 1.3;
        weights.light *= 1.2;
        weights.sweet *= 1.1;
        weights.hot *= 0.6;
        break;
      case '봄':
        weights.light *= 1.1;
        weights.sweet *= 1.05;
        break;
      case '가을':
        weights.soup *= 1.1;
        weights.hot *= 1.05;
        break;
    }

    // 시간대
    switch (timePeriod) {
      case '아침':
        weights.soup *= 1.2;
        weights.light *= 1.1;
        break;
      case '점심':
        weights.soup *= 1.1;
        break;
      case '오후':
        weights.sweet *= 1.2;
        weights.cold *= 1.1;
        break;
      case '저녁':
        weights.hot *= 1.1;
        weights.soup *= 1.1;
        weights.fried *= 1.1;
        break;
      case '야식':
        weights.fried *= 1.3;
        weights.sweet *= 1.2;
        weights.spicy *= 1.1;
        break;
    }

    return weights;
  }

  parseSfctm2(text) {
    const lines = text.split('\n');
    for (const line of lines) {
      // '#'으로 시작하는 줄은 주석/헤더이므로 무시
      if (line.trim() === '' || line.startsWith('#')) continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length >= 25) {
        const temp = parseFloat(parts[11]); // TA: 기온
        const humidity = parseFloat(parts[13]); // HM: 습도
        const rain1hr = parseFloat(parts[15]); // RN: 1시간 강수량 (-9.0은 강수없음)

        const isRaining = rain1hr > 0;

        let condition = '맑음';
        if (isRaining) {
          condition = '비/눈';
        } else if (parseFloat(parts[25]) >= 8) {
          // CA: 전운량 (0~10)
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
          condition,
        };
      }
    }
    return null;
  }
}

module.exports = new WeatherService();
