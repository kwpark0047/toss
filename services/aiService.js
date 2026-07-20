const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const logger = require('../utils/logger');

// 환경 변수 로드
dotenv.config();

/**
 * AI 서비스 모듈
 * Google Gemini API를 사용하여 메뉴 설명 생성 및 추천 기능을 제공합니다.
 */
class AIService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            logger.error('GEMINI_API_KEY is not set in environment');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.cache = new Map(); // 메뉴 설명 및 추천 캐시를 위한 메모리 맵
        this.MAX_CACHE_SIZE = 100; // 최대 캐시 항목 수
        this.models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"]; // 가용 가능한 모델 리스트 (폴백용)
        this.currentModelIndex = 0;
        this.model = null;

        this.initModel();
    }

    /**
     * 사용 가능한 모델 중 최적의 모델로 초기화
     */
    initModel() {
        const modelName = this.models[this.currentModelIndex];
        this.model = this.genAI.getGenerativeModel({ model: modelName });
        logger.info(`[AI] ${modelName} 모델로 엔진이 초기화되었습니다.`);
    }

    /**
     * 다음 우선순위 모델로 폴백 수행
     */
    async fallbackModel() {
        if (this.currentModelIndex < this.models.length - 1) {
            this.currentModelIndex++;
            const nextModel = this.models[this.currentModelIndex];
            this.model = this.genAI.getGenerativeModel({ model: nextModel });
            logger.warn(`[AI] 오류 발생으로 인해 ${nextModel} 모델로 폴백합니다.`);
            return true;
        }
        return false;
    }

    /**
     * 메뉴 기반 감성 스토리텔링 생성
     */
    async generateMenuStory({ name, category, description, targetLang = 'ko' }) {
        const prompt = `
      너는 세계적인 음식 평론가이자 스토리텔러야. 
      다음 메뉴 정보를 바탕으로 고객의 감성을 자극하는 짧고 매혹적인 이야기를 들려줘.
      
      메뉴 이름: ${name}
      카테고리: ${category || '일반'}
      기본 설명: ${description || '신선한 재료로 만든 특별한 요리'}
      
      요구사항:
      1. 메뉴의 풍미, 식감, 혹은 이 음식을 먹었을 때의 기분을 묘사해줘.
      2. 3~4문장 내외로 작성해줘.
      3. ${targetLang === 'ko' ? '한국어' : targetLang}로 작성해줘.
      4. 지나치게 광고 같지 않고, 한 편의 에세이처럼 감성적으로 써줘.
    `;

        try {
            const result = await this.generateWithFallback(prompt);
            return result;
        } catch (error) {
            logger.error(error);
            return description || "맛있고 특별한 즐거움을 선사하는 메뉴입니다.";
        }
    }

    /**
     * 메뉴 정보를 바탕으로 매력적인 설명문 생성 (캐싱 적용)
     * @param {Object} menuInfo - 메뉴 이름, 카테고리, 가격, 이미지 URL 등
     * @returns {Promise<string>} 생성된 설명문
     */
    async generateMenuDescription(menuInfo) {
        const { name, category, price, image_url, description = "" } = menuInfo;
        const cacheKey = `desc_${name}_${category}_${price || 0}`;

        // 1. 캐시 확인
        if (this.cache.has(cacheKey)) {
            logger.debug(`[AI] 캐시된 설명을 반환합니다: ${name}`);
            return this.cache.get(cacheKey);
        }

        const prompt = `
      당신은 20대 여성들에게 엄청난 인기를 끄는 성수동·홍대 핫플레이스의 수석 푸드 에디터이자 크리에이티브 카피라이터입니다. 
      다음 메뉴 정보를 분석하고, 인공지능 트렌드 검색을 반영하여 20대 여성 고객의 취향을 완벽히 저격할 수 있는 '사랑스럽고, 깔끔하며, 소장 욕구를 자극하는' 인스타그램 감성의 메뉴 설명문을 2~3문장으로 작성해 주세요.
      
      [메뉴 기본 정보]
      - 메뉴 이름: ${name}
      - 카테고리: ${category || '디저트/푸드'}
      - 판매 가격: ₩${Number(price || 0).toLocaleString('ko-KR')}
      - 점주 설명: ${description || '맛있는 특별 메뉴'}
      - 이미지 정보: ${image_url ? `업로드된 비주얼 연동 가능 (참조 경로: ${image_url})` : '기본 비주얼'}
      
      [카피라이팅 및 톤앤매너 요구사항]
      1. 말투: "요", "죠" 체를 사용하여 극도로 친근하고, 러블리하며, 비주얼과 식감을 묘사하는 감성적인 어투로 작성해 주세요.
      2. 트렌드 키워드 결합: 20대 여성들이 환호하는 트렌디한 표현(예: "비주얼 장인", "겉바속촉 끝판왕", "입안 가득 행복", "인생샷 치트키")을 자연스럽게 1~2개 섞어 주세요.
      3. 가격 녹여내기: 가격(₩${Number(price || 0).toLocaleString('ko-KR')})을 언급할 때 거부감이 들지 않도록, "이 퀄리티에 이 가격은 정말 천사...", "나에게 선물하는 달콤한 소확행"과 같이 매력적으로 승화해 주세요.
      4. 비주얼 감성: 이미지가 연동되어 있다는 느낌을 주도록 "눈을 사로잡는 영롱한 비주얼", "사진기부터 먼저 켜게 되는 압도적 비주얼"과 같이 이미지 묘사를 추가해 주세요.
      5. 이모지 장식: 리듬감 있는 가독성을 위해 적절하고 어울리는 이모지(🍰, ✨, 💖, 🍓, 🧸 등)를 문장 곳곳에 배치해 주세요.
      6. 출력 형식: 다른 군더더기 설명이나 마크다운 백틱 없이, 오직 완성된 '메뉴 설명글' 본문(한글)만 깔끔하게 출력하세요.
    `;

        try {
            const res = await this.generateWithFallback(prompt);
            this.setCache(cacheKey, res); // 결과 캐싱 (with eviction)
            return res;
        } catch (error) {
            logger.error(error);
            throw new Error("AI 설명 생성에 실패했습니다. 나중에 다시 시도해 주세요.");
        }
    }

    /**
     * 인공지능 인스타그램 홍보 카피 라이팅 생성 (20대 여성 타겟 취향 저격)
     */
    async generateInstagramCopy(menuInfo) {
        const { name, category, price, image_url, description = "" } = menuInfo;
        const prompt = `
      당신은 성수동, 한남동에서 20대 여성들의 피드를 도배시키는 실시간 힙스타 점포 브랜드 마케터이자 소셜 콘텐츠 디렉터입니다.
      다음 신메뉴 정보를 바탕으로, 인스타 피드에 올렸을 때 당장 '좋아요'와 저장 수가 폭발할 수 있는 '사랑스럽고, 깔끔하며, 트렌디한' 인플루언서 감성의 인스타그램 홍보 카피라이팅 글을 피드 게시물 형식으로 작성해 주세요.
      
      [메뉴 정보]
      - 메뉴 이름: ${name}
      - 카테고리: ${category || '디저트'}
      - 판매 가격: ₩${Number(price || 0).toLocaleString('ko-KR')}
      - 점주 묘사: ${description || '맛있는 추천 메뉴'}
      - 실물 이미지: ${image_url ? `비주얼 참조 (${image_url})` : '비주얼 장인급 실물'}
      
      [피드 구성 요구사항]
      1. 헤드라인: 20대 여성의 시선을 끌 수 있는 한 줄 감성 태그 문구 (예: "오늘의 영롱한 소확행 발견...🎀", "비주얼에 한 번, 맛에 두 번 반하는 인생샷 치트키 등장...✨")
      2. 본문:
         - 이 메뉴가 왜 특별한지 식감과 향을 입안이 군침 돌도록 "러블리"하고 "깔끔한" 톤앤매너로 묘사해 주세요.
         - "요", "죠" 체를 섞어 다정하게 소통하듯 작성해 주세요.
         - 가격 정보를 인플루언서 특유의 문체("요 퀄리티가 단돈 ₩${Number(price || 0).toLocaleString()}원이라니.. 정말 매일 오고 싶어지잖아효..💖")로 매혹적으로 자연스럽게 삽입해 주세요.
      3. 해시태그 배치: 피드 최하단에 20대 여성 고객들이 자주 검색하는 10개 내외의 트렌디하고 감성적인 인스타그램 인기 해시태그를 어울리게 배치해 주세요 (예: #성수핫플, #디저트맛집, #비주얼장인, #인스타감성, #소확행, #존맛탱구리, #일상 기록 등).
      4. 이모지 조화: 문단 첫머리와 끝마다 💖, ✨, 🍰, 🧸, 🍓 등 인스타 감성이 물씬 묻어나는 트렌디 이모지를 풍부히 데코레이션해 주세요.
      5. 출력 형식: 다른 군더더기 서두나 "알겠습니다" 같은 말을 싹 생략하고 오직 복사해서 바로 업로드할 수 있는 '인스타그램 피드 본문' 내용만 깔끔하게 인쇄해 주세요.
    `;

        try {
            return await this.generateWithFallback(prompt);
        } catch (error) {
            logger.error(error);
            return `✨ [${name}] 인스타 핫플 등극 예감! 💖\n\n비주얼 장인급 퀄리티에 한 번 반하고 입안 가득 퍼지는 달콤함에 두 번 반하는 인생샷 치트키 등장..🍰\n단돈 ₩${Number(price || 0).toLocaleString()}원으로 만나는 소소하지만 확실한 행복을 지금 바로 매장에서 경험해 보세용! ✨\n\n#인스타감성 #디저트맛집 #인생샷치트키 #비주얼끝판왕`;
        }
    }

    /**
     * 고객 선호도나 상황에 맞는 메뉴 추천 (캐싱 적용)
     * @param {Object} context - 고객 선호도, 현재 날씨, 시간, 기분, 과거 주문 등
     * @param {Array} menuList - 전체 메뉴 목록
     * @returns {Promise<Array>} 추천 메뉴 목록 및 추천 사유
     */
    async recommendMenus(context, menuList) {
        const { preferences, time, weather = "맑음", mood = "보통", pastOrders = [], trendingItems = [], timePeriod = '' } = context;
        const cacheKey = `rec_${preferences}_${weather}_${mood}_${pastOrders.length}_${trendingItems.length}_${menuList.length}`;

        if (this.cache.has(cacheKey)) {
            logger.debug(`[AI] 캐시에서 추천 결과를 반환합니다.`);
            return this.cache.get(cacheKey);
        }

        const menus = menuList.map(m => ({ id: m.id, name: m.name, category: m.categories?.name, price: m.price }));
        const prompt = `
      당신은 매장의 전문 매니저입니다. 고객의 상황과 취향에 따라 가장 잘 어울리는 메뉴 3가지를 추천해주세요.
      
      [고객 상황]
      - 선호도: ${preferences || '없음'}
      - 현재 시간: ${time}
      - 시간대: ${timePeriod || '일반'}
      - 현재 날씨: ${weather}
      - 현재 기분 태그: ${mood}
      - 과거 주문했던 메뉴들: ${pastOrders.join(", ") || "내역 없음"}
      - 요즘 인기 메뉴: ${trendingItems.join(", ") || "없음"}
      
      [추천 규칙]
      1. 시간대와 날씨에 잘 어울리는 메뉴를 우선 추천하세요.
      2. 고객이 과거에 주문한 메뉴와 비슷한 메뉴를 추천하세요.
      3. 요즘 인기 메뉴가 있다면 가중치를 두고 고려하세요.
      4. 선호도가 명시된 경우 이를 최우선으로 반영하세요.
      
      [메뉴 목록]
      ${JSON.stringify(menus)}
      
      [결과 형식]
      반드시 다음 JSON 형식으로만 응답하세요. 다른 설명은 제외하고 순수 JSON 배열만 반환하세요:
      [
        { "id": 메뉴ID, "reason": "추천 이유(한 문장, 예: 비오는 날에 따뜻하게 즐기기 좋은 메뉴입니다.)" },
        ...
      ]
    `;

        try {
            const rawText = await this.generateWithFallback(prompt);
            const text = rawText.replace(/```json|```/g, "").trim();

            let result;
            try {
                result = JSON.parse(text);
            } catch (pErr) {
                logger.warn("[AI] JSON 파싱 에러, 정규표현식 추출 시도:", pErr);
                // JSON 부분만 추출 시도
                const jsonMatch = text.match(/\[.*\]/s);
                if (jsonMatch) {
                    result = JSON.parse(jsonMatch[0]);
                } else {
                    throw pErr;
                }
            }

            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            logger.error(error);
            // 최소한의 방어 레이어: 1순위 메뉴 추천 (JSON 포맷)
            if (menuList.length > 0) {
                return [{ id: menuList[0].id, reason: "취향에 맞는 메뉴를 골라보세요." }];
            }
            return [];
        }
    }

    /**
     * 현재 주문 중인 상품과 어울리는 후식(디저트) 추천
     * @param {Array} currentItems - 현재 장바구니에 담긴 메뉴 이름 리스트
     * @param {Array} dessertList - 매장 내 디저트/후식 카데고리 메뉴 리스트
     */
    async recommendDesserts(currentItems, dessertList) {
        if (!dessertList || dessertList.length === 0) return [];

        const cacheKey = `dessert_${currentItems.join("_")}_${dessertList.length}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const prompt = `
      당신은 디저트 페어링 전문가입니다. 고객이 현재 주문한 메뉴들과 가장 잘 어울리는 후식을 추천해 주세요.
      
      [현재 주문한 메뉴]
      ${currentItems.join(", ")}
      
      [가용한 후식 목록]
      ${JSON.stringify(dessertList.map(d => ({ id: d.id, name: d.name, price: d.price })))}
      
      [페어링 가이드]
      1. 매운 음식을 먹었다면 입안을 달래줄 달콤하거나 시원한 디저트 추천.
      2. 기름진 음식을 먹었다면 깔끔하게 마무리할 수 있는 상큼한 디저트나 차(Tea) 추천.
      3. 가벼운 식사라면 풍미를 더해줄 진한 디저트 추천.
      
      [결과 형식]
      반드시 다음 JSON 형식으로만 응답하세요. 다른 설명은 제외하고 순수 JSON 배열만 반환하세요:
      [
        { "id": 1, "reason": "페어링 사유(한 문장, 예: 매콤한 입안을 시원하게 달래줄 아이스크림입니다.)" }
      ]
      * 최대 2개까지만 추천하세요.
    `;

        try {
            const rawText = await this.generateWithFallback(prompt);
            const text = rawText.replace(/```json|```/g, "").trim();
            const result = JSON.parse(text);
            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            logger.error(error);
            // 기본값: 첫 번째 디저트 추천
            return [{ id: dessertList[0].id, reason: "달콤한 마무리를 위한 추천 메뉴입니다." }];
        }
    }

    /**
     * 폴백 로직을 포함한 콘텐츠 생성 공통 메서드
     */
    async generateWithFallback(prompt) {
        let lastError = null;

        // 설정된 사용 가능한 모델 리스트 크기만큼
        for (let i = 0; i < this.models.length; i++) {
            try {
                if (!this.model) this.initModel();
                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                return response.text().trim();
            } catch (error) {
                lastError = error;
                // 429(할당량 초과) 또는 404(모델 없음)일 때 폴백 시도
                if (error.status === 429 || error.status === 404 || error.message?.includes('quota')) {
                    const hasNext = await this.fallbackModel();
                    if (!hasNext) break;
                } else {
                    logger.error(error);
                    break; // 다른 유형의 에러면 즉시 중단
                }
            }
        }
        throw lastError;
    }

    /**
     * 캐시 저장 관리 (크기 제한)
     */
    setCache(key, value) {
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    /**
     * [메뉴 목록 대량 번역]
     * 여러 메뉴의 이름과 설명을 한 번의 AI 호출로 대상 언어로 번역합니다.
     * @param {Array} menuList - 번역할 메뉴 객체 배열
     * @param {string} targetLang - 대상 언어 (en, jp, cn)
     */
    async batchTranslateMenus(menuList, targetLang) {
        if (!menuList || menuList.length === 0) return [];

        const langMap = {
            'en': 'English',
            'jp': 'Japanese',
            'cn': 'Simplified Chinese'
        };

        const targetDisplayName = langMap[targetLang] || targetLang;

        // 프롬프트 구성을 위해 메뉴 데이터를 요약
        const menuDataToTranslate = menuList.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description || ""
        }));

        const prompt = `
            You are a professional translator for a premium restaurant menu.
            Translate the following menu list into ${targetDisplayName}.
            
            [Menu List]
            ${JSON.stringify(menuDataToTranslate)}
            
            [Output Instructions]
            1. Return ONLY a valid JSON array of objects.
            2. Each object must have: "id", "translated_name", "translated_description".
            3. Maintain the professional and appetizing tone of the original menu.
            4. Do not include any other text or explanations.
        `;

        try {
            const rawText = await this.generateWithFallback(prompt);
            const text = rawText.replace(/```json|```/g, "").trim();

            let result;
            try {
                result = JSON.parse(text);
            } catch (pErr) {
                const jsonMatch = text.match(/\[.*\]/s);
                if (jsonMatch) {
                    result = JSON.parse(jsonMatch[0]);
                } else {
                    throw pErr;
                }
            }

            return result;
        } catch (error) {
            logger.error(error);
            // 실패 시 원본 리스트를 유지하는 형태로 반환
            return menuList.map(m => ({
                id: m.id,
                translated_name: m.name,
                translated_description: m.description
            }));
        }
    }

    /**
     * Unsplash 이미지 URL 생성 (API 키 있으면 검색 API, 없으면 source URL)
     */
    async _fetchMenuImageUrl(keyword) {
        const safeKeyword = encodeURIComponent(keyword.trim());
        if (process.env.UNSPLASH_ACCESS_KEY) {
            try {
                const https = require('https');
                const url = `https://api.unsplash.com/search/photos?query=${safeKeyword}&per_page=3&orientation=squarish&content_filter=high`;
                const data = await new Promise((resolve, reject) => {
                    const req = https.get(url, {
                        headers: {
                            Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
                            'Accept-Version': 'v1'
                        }
                    }, (res) => {
                        let body = '';
                        res.on('data', chunk => { body += chunk; });
                        res.on('end', () => resolve(body));
                    });
                    req.on('error', reject);
                    req.setTimeout(4000, () => { req.destroy(); reject(new Error('timeout')); });
                });
                const json = JSON.parse(data);
                const results = json.results || [];
                if (results.length > 0) {
                    const pick = results[Math.floor(Math.random() * results.length)];
                    return pick.urls?.regular || pick.urls?.small || null;
                }
            } catch (e) {
                logger.warn(`Unsplash API 이미지 검색 실패 (${keyword}):`, e.message);
            }
        }
        // 폴백: source.unsplash.com (무료, 키 불필요)
        return `https://source.unsplash.com/featured/480x480/?${safeKeyword},food`;
    }

    /**
     * 메뉴 이름 리스트를 분석하여 카테고리, 설명, 가격, 이미지 URL 생성 (일괄 등록용)
     * menuData: 엑셀에서 파싱된 구조화 힌트 [{name, price, category, description, spicy_level, allergens}]
     */
    async analyzeMenuList(menuNames, existingCategories = [], menuData = []) {
        const menuListText = menuData.length > 0
            ? menuNames.map(name => {
                const hint = menuData.find(d => d.name === name) || {};
                const meta = [];
                if (hint.price) meta.push(`가격: ${hint.price}원`);
                if (hint.category) meta.push(`카테고리: ${hint.category}`);
                if (hint.description) meta.push(`설명힌트: ${hint.description}`);
                if (hint.spicy_level != null) meta.push(`맵기: ${hint.spicy_level}`);
                if (hint.allergens) meta.push(`알레르기: ${hint.allergens}`);
                return meta.length > 0 ? `- ${name} (${meta.join(' / ')})` : `- ${name}`;
            }).join('\n')
            : menuNames.map(n => `- ${n}`).join('\n');

        const prompt = `
당신은 한국 외식업 메뉴 전문 컨설턴트입니다.
아래 메뉴 이름들을 분석하여 카테고리, 상세 설명, 가격, 태그, 옵션, 이미지 키워드를 생성해 주세요.

[메뉴 리스트]
${menuListText}

[기존 카테고리 참고]
${existingCategories.map(c => c.name).join(', ') || '없음'}

[출력 형식 - JSON 배열만 반환, 다른 텍스트 금지]
[
  {
    "name": "메뉴명 (입력값 그대로)",
    "category_name": "카테고리 (치킨/피자/한식/중식/일식/분식/음료/사이드/디저트/주류 등)",
    "description": "2문장 설명: 첫 문장은 주요 재료와 조리법, 두 번째 문장은 이 메뉴만의 특징과 추천 상황",
    "price": 가격숫자,
    "allergens": "알레르기 원재료 (밀·대두·닭고기 등, 없으면 빈 문자열)",
    "tags": ["태그1","태그2","태그3"],
    "spicy_level": 0~3,
    "options": [{"name":"옵션명","type":"radio","values":["선택1","선택2"]}],
    "image_keyword": "3~5개 영단어 식품사진 키워드"
  }
]

[세부 지침]
카테고리:
- 기존 카테고리가 있으면 최대한 활용, 없으면 위 예시 중 가장 적합한 것으로 생성

설명 (2문장 필수):
- 1문장: "OO 재료를 XX 방식으로 조리한 메뉴입니다." 형태
- 2문장: 맛 특징, 인기 이유, 어울리는 상황 중 하나

가격 (힌트 없을 때 한국 배달/외식 시세 기준):
- 치킨 메인: 17,000~24,000원 / 피자 M: 18,000~28,000원
- 한식 메인: 8,000~16,000원 / 분식: 4,000~12,000원
- 음료: 2,500~6,000원 / 사이드: 2,000~7,000원
- 주류: 4,000~9,000원 / 디저트: 3,000~8,000원
- 가격힌트 제공 시 그대로 사용, 100원 단위

tags (3~4개):
- 맛 특성: 달콤한·매콤한·담백한·고소한·짭짤한
- 주재료: 닭·소고기·돼지·해산물·채소·치즈
- 상황: 혼밥·회식·가족·야식·술안주
- 특성: 인기·신메뉴·매장추천·한정

spicy_level: 0=안매움, 1=약간매움, 2=매움, 3=아주매움

options: 해당 메뉴에 실제로 필요한 선택 항목만 (사이즈·굽기·토핑·수량 등)

image_keyword (중요 - Unsplash 검색에 사용됨):
- 반드시 영문, 3~5단어, 해당 음식을 정확히 묘사
- 좋은 예: "crispy korean fried chicken drumsticks", "bibimbap colorful korean rice bowl", "cold iced americano coffee glass"
- 나쁜 예: "food", "korean food", "chicken" (너무 일반적)
- 힌트: 조리법(crispy/grilled/steamed) + 음식명 + 시각적특징(close-up/plated/overhead)
`;

        let suggestions;
        try {
            const rawText = await this.generateWithFallback(prompt);
            const text = rawText.replace(/```json\n?|```/g, '').trim();
            // JSON 배열 추출 (앞뒤 텍스트 제거)
            const match = text.match(/\[[\s\S]*\]/);
            suggestions = JSON.parse(match ? match[0] : text);
        } catch (error) {
            logger.error('analyzeMenuList AI 파싱 실패:', error);
            suggestions = menuNames.map(name => {
                const hint = menuData.find(d => d.name === name) || {};
                return {
                    name,
                    category_name: hint.category || '기타',
                    description: hint.description || `${name}입니다.`,
                    price: hint.price || 0,
                    allergens: hint.allergens || '',
                    spicy_level: hint.spicy_level || 0,
                    tags: [],
                    options: [],
                    image_keyword: name + ' food korean'
                };
            });
        }

        // 각 메뉴에 실제 이미지 URL 추가 (병렬)
        const suggestionsWithImages = await Promise.all(
            suggestions.map(async (s) => {
                const keyword = s.image_keyword || (s.name + ' food');
                const imageUrl = await this._fetchMenuImageUrl(keyword);
                return { ...s, image_url: imageUrl };
            })
        );

        return suggestionsWithImages;
    }

    /**
     * 이미지 보정을 위한 필터 값 추천
     */
    async recommendImageEnhancement(imageDescription) {
        const prompt = `
            사용자가 업로드한 음식 사진에 대한 설명: "${imageDescription}"
            이 사진을 더 맛있어 보이게 만들기 위한 CSS filter 속성값들을 추천해 주세요.
            
            [응답 형식]
            반드시 다음 JSON 형식으로만 응답하세요:
            {
              "brightness": 1.1,
              "contrast": 1.2,
              "saturate": 1.3,
              "sepia": 0.1,
              "sharpness": 1.1
            }
            
            수치는 기본값 1.0을 기준으로 미세하게 조정해 주세요.
        `;

        try {
            const rawText = await this.generateWithFallback(prompt);
            const text = rawText.replace(/```json|```/g, "").trim();
            return JSON.parse(text);
        } catch (_error) {
            return { brightness: 1.1, contrast: 1.1, saturate: 1.2, sepia: 0, sharpness: 1.0 };
        }
    }

    /**
     * 특정 텍스트를 지정된 언어로 번역 (실시간)
     * @param {string} text - 번역할 원본 텍스트
     * @param {string} targetLang - 대상 언어 (en, jp, cn 등)
     */
    async translateText(text, targetLang) {
        const cacheKey = `trans_${targetLang}_${text}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const langMap = {
            'en': 'English',
            'jp': 'Japanese',
            'cn': 'Simplified Chinese',
            'ko': 'Korean'
        };

        const prompt = `
            Translate the following text into ${langMap[targetLang] || targetLang}.
            Original Text: "${text}"
            
            Return ONLY the translated text without any explanations or quotes.
        `;

        try {
            const res = await this.generateWithFallback(prompt);
            this.setCache(cacheKey, res);
            return res;
        } catch (error) {
            logger.error(error);
            return text; // 실패 시 원본 반환
        }
    }

    /**
     * 메뉴명 기반 종합 정보 제안 (마법사용)
     */
    async proposeMenuFull({ name, categoryName }) {
        const prompt = `
            당신은 매장 컨설팅 전문가입니다. 
            매장 관리자가 새로 추가하려는 메뉴의 이름이 "${name}"(카테고리: ${categoryName || '미정'})입니다.
            이 메뉴에 대해 고객의 구매 욕구를 자극할 수 있는 종합 정보를 제안해 주세요.

            [출력 지침]
            1. 반드시 다음 JSON 형식으로만 응답하세요:
               {
                 "description": "매력적인 짧은 설명 (2문장 이내)",
                 "price": 추천 가격 (숫자, 100원 단위),
                 "tags": ["태그1", "태그2", "태그3"],
                 "options": [
                   { "name": "옵션명(예: 맵기 조절)", "type": "radio/checkbox", "values": ["값1", "값2"] }
                 ],
                 "spicy_level": 맵기 정도 (0~3),
                 "image_keyword": "Unsplash 영문 키워드"
               }
            2. 다른 텍스트는 절대 포함하지 마세요.
            3. 한국어로 작성하세요 (image_keyword 제외).
        `;

        try {
            const rawText = await this.generateWithFallback(prompt);
            const text = rawText.replace(/```json|```/g, "").trim();
            return JSON.parse(text);
        } catch (error) {
            logger.error(error);
            return {
                description: `${name}입니다.`,
                price: 0,
                tags: [],
                options: [],
                spicy_level: 0,
                image_keyword: "food"
            };
        }
    }

    /**
     * 고객 리뷰에 대한 사장님 답글 초안 생성
     * @param {object} review - { rating, content, customer_name }
     * @param {string} storeName - 매장명
     */
    /**
     * AI 메뉴 이미지 생성/검색 (유료 구독자 전용).
     * Gemini가 메뉴명+설명으로 최적의 검색 키워드를 생성하고,
     * Unsplash에서 고품질 이미지를 찾아 URL 반환.
     * @param {Object} menuInfo - { name, category, description }
     * @returns {Promise<{imageUrl: string, keyword: string}>}
     */
    async generateMenuImage(menuInfo) {
        const { name, category, description } = menuInfo;
        const cacheKey = `img_${name}_${category}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const prompt = `
      You are a food photography expert. Generate 3~5 English keywords
      for finding a high-quality professional food photo on Unsplash
      for the following menu item.

      Menu name: ${name}
      Category: ${category || 'General'}
      Description: ${description || ''}

      Rules:
      1. Return ONLY a JSON object: { "keyword": "word1 word2 word3 word4 word5" }
      2. Keywords must be English, 3~5 words.
      3. Include cooking method (grilled/fried/steamed/roasted), main ingredient, and visual style (close-up/plated/overhead).
      4. Be specific — avoid generic terms like "food", "delicious".
      5. Example for 김치찌개: { "keyword": "kimchi jjigae korean stew bubbling clay pot" }
    `;

        try {
            const rawText = await this.generateWithFallback(prompt);
            const text = rawText.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(text);
            const keyword = parsed.keyword || `${name} food plated`;
            const imageUrl = await this._fetchMenuImageUrl(keyword);
            const result = { imageUrl, keyword };
            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            logger.error({ error: error.message }, '[AI] generateMenuImage failed');
            const fallbackUrl = await this._fetchMenuImageUrl(`${name} food`);
            return { imageUrl: fallbackUrl, keyword: `${name} food` };
        }
    }

    async generateReviewReply(review, storeName) {
        const tone = review.rating >= 4
            ? '감사 인사를 진심으로 전하고, 다음 방문을 기대하게 만드는'
            : review.rating === 3
                ? '방문에 감사하되 아쉬운 점을 겸허히 수용하고 개선 의지를 보이는'
                : '불편에 대해 진정성 있게 사과하고 구체적인 개선 약속과 재방문을 정중히 요청하는';

        const prompt = `
            당신은 "${storeName}" 매장의 사장님입니다.
            아래 고객 리뷰에 대한 답글을 작성해 주세요.

            [리뷰 정보]
            - 평점: ${review.rating}/5
            - 고객명: ${review.customer_name || '고객'}
            - 내용: "${review.content}"

            [작성 지침]
            1. ${tone} 톤으로 작성하세요.
            2. 3~4문장, 200자 이내로 간결하게.
            3. 리뷰에서 언급된 구체적 내용(메뉴, 서비스 등)을 자연스럽게 인용하세요.
            4. 과장된 표현이나 이모지 남발은 피하고, 이모지는 최대 1개만.
            5. 답글 텍스트만 반환하세요 (따옴표, 설명 없이).
        `;

        const text = await this.generateWithFallback(prompt);
        return text.replace(/^["']|["']$/g, '').trim();
    }

    async scanMenuImage(base64Data, mimeType) {
        const prompt = `
            당신은 저화질, 흔들림, 빛 반사, 저조도 또는 초점이 흐려진 메뉴판 사진에서도 텍스트를 정확하게 판독하는 초정밀 OCR 및 음식 카피라이팅 전문가입니다.
            제공된 이미지로부터 모든 메뉴 항목들을 끝까지 스캔하여 구조화된 JSON 데이터로 반환해 주세요.

            [저화질/흐림 이미지 판독 지침]
            1. 이미지의 선명도가 낮거나 초점이 흐려 글자가 찌그러진 경우, 문맥(한식, 분식, 일식, 카페 등 업종별 메뉴 조합)에 근거한 문자 윤곽 추론을 적용하세요.
               (예: '아메ㄹ|카노' -> '아메리카노', '삼ㄱㅕㅂ살' -> '삼겹살', 'ㅅㅗㅈㅜ' -> '소주', '돈ㅋㅏ스' -> '돈까스' 등 정황 추론)
            2. 가격 숫자가 흐릿하거나 가려져서 일부만 보일 경우, 해당 메뉴의 일반적인 한국 배달/매장 시세를 감안하여 가장 합리적인 가격(1,000원 단위 또는 500원 단위)으로 완성도 있게 보정해 주세요.
            3. 이미지 훼손이 극심하더라도 에러를 내거나 빈 배열을 반환하지 말고, 윤곽이나 정황상 식별 가능한 최소 1개 이상의 대표 메뉴 항목을 추론하여 완성도 높은 가상 제안 리스트를 출력해 주세요.

            [요구사항]
            1. 이미지 내의 모든 음식/음료 메뉴 이름, 가격, 카테고리를 정확히 찾아내세요.
            2. 가격이 표기되어 있지 않은 경우, 메뉴명의 대략적인 시장 적정 가격(원화)을 숫자로 가상 제안해 주세요.
            3. 각 메뉴별로 해당 음식을 더 돋보이게 만들 수 있는 매력적이고 고급스러운 한글 설명(1~2문장)을 직접 창작해 제안해 주세요.
            4. 각 메뉴별로 Unsplash에서 사용할 수 있는 대표 음식의 영어 검색 키워드(예: "steamed mandu dumplings plated")를 'image_keyword' 항목으로 생성해 주세요.
            
            [출력 지침]
            - 반드시 아래의 완벽한 JSON 배열 형식으로만 응답하고 다른 텍스트는 절대 포함하지 마세요:
              [
                {
                  "name": "메뉴 이름 (한글)",
                  "price": 가격 (원화, 10000과 같은 정수),
                  "category_name": "추천 카테고리 (예: 메인메뉴, 사이드메뉴, 음료 등)",
                  "description": "고객의 군침을 자극할 고급스럽고 매력적인 1~2문장 설명",
                  "image_keyword": "unsplash_english_keywords"
                }
              ]
        `;

        let rawText = "";
        const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                const model = this.genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType || "image/jpeg"
                        }
                    }
                ]);
                rawText = result.response.text();
                if (rawText) break;
            } catch (err) {
                logger.warn(`[AI] ${modelName} 이미지 분석 실패, 다음 모델 시도:`, err.message);
                lastError = err;
            }
        }

        if (!rawText && lastError) {
            throw lastError;
        }

        try {
            const text = rawText.replace(/```json\n?|```/g, '').trim();
            const match = text.match(/\[[\s\S]*\]/);
            const suggestions = JSON.parse(match ? match[0] : text);

            const suggestionsWithImages = await Promise.all(
                suggestions.map(async (s) => {
                    const keyword = s.image_keyword || (s.name + ' food');
                    const imageUrl = await this._fetchMenuImageUrl(keyword);
                    return {
                        name: s.name,
                        price: s.price || 0,
                        category_name: s.category_name || '기타',
                        description: s.description || `${s.name}입니다.`,
                        image_url: imageUrl
                    };
                })
            );

            return suggestionsWithImages;
        } catch (error) {
            logger.error('AI 메뉴판 이미지 스캔 실패:', error);
            throw error;
        }
    }
}

module.exports = new AIService();
