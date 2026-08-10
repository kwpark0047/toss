const aiService = require('../services/aiService');
const Product = require('../repositories/Product');
const Order = require('../repositories/Order');
const Store = require('../repositories/Store');
const catchAsync = require('../utils/catchAsync');
const weatherService = require('../services/weatherService');
const WeatherService = require('../services/weatherService');
const RecommendationContextService = require('../services/RecommendationContextService');

const aiController = {
  // [설명 생성]
  describeMenu: catchAsync(async (req, res) => {
    const { name, category, price, image_url, description } = req.body;
    const aiDescription = await aiService.generateMenuDescription({
      name,
      category,
      price,
      image_url,
      description,
    });
    res.json({ description: aiDescription });
  }),

  // [인스타그램 홍보글 카피라이팅 생성]
  generateInstagramCopy: catchAsync(async (req, res) => {
    const { name, category, price, image_url, description } = req.body;
    const copy = await aiService.generateInstagramCopy({
      name,
      category,
      price,
      image_url,
      description,
    });
    res.json({ success: true, copy });
  }),

  // [메뉴 추천]
  recommendMenus: catchAsync(async (req, res) => {
    const { store_id, preferences, weather, mood, phone, toss_user_key } = req.body;
    const hour = new Date().getHours();
    const time = new Date().toLocaleTimeString('ko-KR');

    let pastOrders = [];
    if (phone || toss_user_key) {
      const history = await Order.findByCustomer(phone, toss_user_key);
      pastOrders = history
        .flatMap((order) => order.items.map((item) => item.product_name))
        .slice(0, 10);
    }

    const menuList = await Product.findActiveAndInStock(store_id);

    if (menuList.length === 0) {
      return res.json({ recommendations: [] });
    }

    const trendingProductIds = await Order.findTrendingProducts(store_id);
    const trendingNames =
      trendingProductIds.length > 0
        ? await Product.findByIds(trendingProductIds, { name: true }).then((rows) =>
            rows.map((r) => r.name)
          )
        : [];

    const timePeriod =
      hour >= 5 && hour < 10
        ? '아침 (조식)'
        : hour >= 10 && hour < 15
          ? '점심 (중식)'
          : hour >= 15 && hour < 17
            ? '오후 간식'
            : hour >= 17 && hour < 22
              ? '저녁 (석식)'
              : '야식';

    const timeContext = {
      period: timePeriod,
      is_meal_time: [5, 10, 15, 17].some((h) => Math.abs(hour - h) <= 2),
    };

    // 실시간 날씨 데이터 가져오기
    let enhancedWeather = null;
    try {
      const store = await Store.findById(store_id);
      if (store?.latitude && store?.longitude) {
        enhancedWeather = await weatherService.getEnhancedWeatherContext(
          WeatherService.getStationByCoords(store.latitude, store.longitude)
        );
      } else {
        enhancedWeather = await weatherService.getEnhancedWeatherContext('108');
      }
    } catch (weatherError) {
      console.warn('Failed to fetch weather:', weatherError.message);
    }

    // 고객 세그먼트(RFM)/선호도 컨텍스트 구성
    let segmentContext = '';
    let recContext = null;
    try {
      const phoneForCtx = phone || (toss_user_key ? undefined : undefined);
      if (phoneForCtx) {
        recContext = await RecommendationContextService.buildContext(store_id, phoneForCtx);
        segmentContext = RecommendationContextService.formatContext(recContext);
      }
    } catch (ctxError) {
      console.warn('Failed to build recommendation context:', ctxError.message);
    }

    const recommendations = await aiService.recommendMenus(
      {
        preferences,
        time,
        weather: weather || enhancedWeather?.condition || '맑음',
        mood,
        pastOrders,
        trendingItems: trendingNames,
        timePeriod,
        timeContext,
        segmentContext,
        // 향상된 날씨 컨텍스트 추가
        temperature: enhancedWeather?.temp,
        humidity: enhancedWeather?.humidity,
        isRaining: enhancedWeather?.isRaining,
        rainAmount: enhancedWeather?.rain,
        feelsLike: enhancedWeather?.feelsLike,
        airQuality: enhancedWeather?.airQuality,
        season: enhancedWeather?.season,
        foodWeights: enhancedWeather?.foodWeights,
      },
      menuList
    );

    const enrichedRecommendations = recommendations
      .map((rec) => {
        const menu = menuList.find((m) => m.id === rec.id);
        if (!menu) return null;
        const isTrending = trendingProductIds.includes(menu.id);
        return {
          ...menu,
          recommend_reason: rec.reason,
          is_trending: isTrending,
          time_period: timePeriod,
          ...(recContext?.segment ? { customer_segment: recContext.segment.segment_label } : {}),
        };
      })
      .filter(Boolean);

    res.json({ recommendations: enrichedRecommendations });
  }),

  // [디저트 추천]
  recommendDessert: catchAsync(async (req, res) => {
    const { store_id, currentItems } = req.body;

    if (!currentItems || !Array.isArray(currentItems) || currentItems.length === 0) {
      return res.json({ recommendations: [] });
    }

    const dessertList = await Product.findDessertsForStore(store_id);

    if (dessertList.length === 0) {
      return res.json({ recommendations: [] });
    }

    const recommendations = await aiService.recommendDesserts(currentItems, dessertList);

    const enrichedRecommendations = recommendations
      .map((rec) => {
        const menu = dessertList.find((d) => d.id === rec.id);
        if (!menu) return null;
        return {
          ...menu,
          recommend_reason: rec.reason,
        };
      })
      .filter(Boolean);

    res.json({ recommendations: enrichedRecommendations });
  }),

  // [대량 메뉴 번역]
  translateMenu: catchAsync(async (req, res) => {
    const { store_id, targetLang } = req.body;

    const menuList = await Product.findActiveByStoreId(store_id, {
      id: true,
      name: true,
      description: true,
    });

    if (menuList.length === 0) {
      return res.json({ success: true, translations: [] });
    }

    const translations = await aiService.batchTranslateMenus(menuList, targetLang);

    res.json({
      success: true,
      targetLang,
      translations,
    });
  }),

  // [텍스트 단일 번역]
  translate: catchAsync(async (req, res) => {
    const { text, targetLang } = req.body;
    const translated = await aiService.translateText(text, targetLang);
    res.json({ success: true, translated });
  }),

  // [스토리텔링 생성]
  storytelling: catchAsync(async (req, res) => {
    const { name, category, description, targetLang } = req.body;
    const story = await aiService.generateMenuStory({
      name,
      category,
      description,
      targetLang: targetLang || 'ko',
    });
    res.json({ success: true, story });
  }),

  // [일괄 등록 메뉴 분석]
  analyzeMenuList: catchAsync(async (req, res) => {
    const { menuNames, menuData, categories } = req.body;
    if (!menuNames || !Array.isArray(menuNames)) {
      return res.status(400).json({ success: false, error: 'menuNames 배열이 필요합니다.' });
    }
    const suggestions = await aiService.analyzeMenuList(
      menuNames,
      categories || [],
      menuData || []
    );
    res.json({ success: true, suggestions });
  }),

  // [메뉴 정보 제안]
  proposeMenuFull: catchAsync(async (req, res) => {
    const { name, categoryName } = req.body;
    const proposal = await aiService.proposeMenuFull({ name, categoryName });
    res.json({ success: true, proposal });
  }),

  // [인기 메뉴 조합 추천]
  recommendPairing: catchAsync(async (req, res) => {
    const { store_id: _store_id, product_ids } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.json({ recommendations: [] });
    }

    const pairingData = await Order.findPairingData(product_ids);

    const recommendedProducts = await Product.findByIds(
      pairingData.map((p) => p.product_id).filter((id) => id !== null),
      null,
      { categories: { select: { name: true } } }
    );

    const enrichedRecommendations = await Promise.all(
      recommendedProducts.map(async (product) => {
        const count = pairingData.find((p) => p.product_id === product.id)?._count.product_id || 0;
        return {
          ...product,
          pairing_score: count,
          recommend_reason: `${product.name}은(는) 현재 선택하신 메뉴와 함께 가장 많이 선택되는 인기 조합입니다.`,
        };
      })
    );

    res.json({
      recommendations: enrichedRecommendations.sort((a, b) => b.pairing_score - a.pairing_score),
    });
  }),

  // [AI 메뉴 이미지 생성]
  generateMenuImage: catchAsync(async (req, res) => {
    const { store_id, name, category, description } = req.body;
    const storeId = parseInt(store_id);

    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
    }

    if (store.plan === 'free') {
      return res.status(403).json({
        success: false,
        error:
          'AI 메뉴 이미지 생성은 유료 구독자 전용 기능입니다. 설정 > 요금제에서 업그레이드해 주세요.',
      });
    }

    const result = await aiService.generateMenuImage({ name, category, description });

    res.json({
      success: true,
      data: {
        imageUrl: result.imageUrl,
        keyword: result.keyword,
      },
    });
  }),

  scanMenuImage: catchAsync(async (req, res) => {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'image 필드가 필요합니다. (base64)' });
    }
    const suggestions = await aiService.scanMenuImage(image, mimeType);
    res.json({ success: true, suggestions });
  }),

  // [리뷰 답글 생성]
  generateReviewReply: catchAsync(async (req, res) => {
    const { rating, content, customer_name, store_name } = req.body;
    if (rating == null || !content) {
      return res.status(400).json({ success: false, error: 'rating과 content 필드가 필요합니다.' });
    }
    const reply = await aiService.generateReviewReply(
      { rating, content, customer_name },
      store_name || '매장'
    );
    res.json({ success: true, reply });
  }),

  // [이미지 보정 필터 추천]
  recommendImageEnhancement: catchAsync(async (req, res) => {
    const { description } = req.body;
    const filters = await aiService.recommendImageEnhancement(description || '');
    res.json({ success: true, filters });
  }),

  // [틱커벨 AI 추천] - 매장 AI 어시스턴트 동적 메뉴 추천
  tinkerbellRecommend: catchAsync(async (req, res) => {
    const { store_id, weather, mood, phone, toss_user_key } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id가 필요합니다.' });
    }

    const hour = new Date().getHours();
    const timePeriod =
      hour >= 5 && hour < 10
        ? '아침 (조식)'
        : hour >= 10 && hour < 15
          ? '점심 (중식)'
          : hour >= 15 && hour < 17
            ? '오후 간식'
            : hour >= 17 && hour < 22
              ? '저녁 (석식)'
              : '야식';

    let pastOrders = [];
    if (phone || toss_user_key) {
      const history = await Order.findByCustomer(phone, toss_user_key);
      pastOrders = history
        .flatMap((order) => order.items.map((item) => item.product_name))
        .slice(0, 10);
    }

    const menuList = await Product.findActiveAndInStock(store_id);
    if (menuList.length === 0) {
      return res.json({ recommendations: [], source: 'ai' });
    }

    const trendingProductIds = await Order.findTrendingProducts(store_id);
    const trendingNames =
      trendingProductIds.length > 0
        ? await Product.findByIds(trendingProductIds, { name: true }).then((rows) =>
            rows.map((r) => r.name)
          )
        : [];

    const time = new Date().toLocaleTimeString('ko-KR');
    const preferences = mood ? `기분: ${mood}` : undefined;

    // 실시간 날씨 데이터 가져오기
    let enhancedWeather = null;
    try {
      const store = await Store.findById(store_id);
      if (store?.latitude && store?.longitude) {
        enhancedWeather = await weatherService.getEnhancedWeatherContext(
          WeatherService.getStationByCoords(store.latitude, store.longitude)
        );
      } else {
        enhancedWeather = await weatherService.getEnhancedWeatherContext('108');
      }
    } catch (weatherError) {
      console.warn('Failed to fetch weather:', weatherError.message);
    }

    // 고객 세그먼트(RFM)/선호도 컨텍스트 구성
    let segmentContext = '';
    let recContext = null;
    try {
      if (phone) {
        recContext = await RecommendationContextService.buildContext(store_id, phone);
        segmentContext = RecommendationContextService.formatContext(recContext);
      }
    } catch (ctxError) {
      console.warn('Failed to build recommendation context:', ctxError.message);
    }

    const recommendations = await aiService.recommendMenus(
      {
        preferences,
        time,
        weather: weather || enhancedWeather?.condition || '맑음',
        mood: mood || '보통',
        pastOrders,
        trendingItems: trendingNames,
        timePeriod,
        segmentContext,
        // 향상된 날씨 컨텍스트 추가
        temperature: enhancedWeather?.temp,
        humidity: enhancedWeather?.humidity,
        isRaining: enhancedWeather?.isRaining,
        rainAmount: enhancedWeather?.rain,
        feelsLike: enhancedWeather?.feelsLike,
        airQuality: enhancedWeather?.airQuality,
        season: enhancedWeather?.season,
        foodWeights: enhancedWeather?.foodWeights,
      },
      menuList
    );

    const enriched = recommendations
      .map((rec) => {
        const menu = menuList.find((m) => m.id === rec.id);
        if (!menu) return null;
        const isTrending = trendingProductIds.includes(menu.id);
        return {
          ...menu,
          recommend_reason: rec.reason,
          is_trending: isTrending,
          time_period: timePeriod,
          source: 'ai',
          ...(recContext?.segment ? { customer_segment: recContext.segment.segment_label } : {}),
        };
      })
      .filter(Boolean);

    res.json({ recommendations: enriched, source: 'ai' });
  }),
};

module.exports = aiController;
