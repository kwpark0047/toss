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
     * @param {Object} menuInfo - 메뉴 이름, 카테고리, 가격 등
     * @returns {Promise<string>} 생성된 설명문
     */
    async generateMenuDescription(menuInfo) {
        const { name, category, description = "" } = menuInfo; // 미사용 변수 price 제거
        const cacheKey = `desc_${name}_${category}`;

        // 1. 캐시 확인
        if (this.cache.has(cacheKey)) {
            logger.debug(`[AI] 캐시된 설명을 반환합니다: ${name}`);
            return this.cache.get(cacheKey);
        }

        const prompt = `
      당신은 전문 카피라이터이자 푸드 에디터입니다. 
      다음 메뉴의 정보를 바탕으로 고객의 입맛을 돋우는 매력적인 메뉴 설명문을 2~3문장으로 작성해 주세요.
      
      - 메뉴 이름: ${name}
      - 카테고리: ${category}
      - 현재 설명: ${description}
      
      작성 시 주의사항:
      1. 친절하고 전문적인 톤앤매너를 유지하세요.
      2. 음식의 맛, 질감, 특징을 생생하게 표현하세요.
      3. 결과물만 한글로 출력하세요. 다른 설명은 생략하세요.
    `;

        try {
            const res = await this.generateWithFallback(prompt);
            this.cache.set(cacheKey, res); // 결과 캐싱
            return res;
        } catch (error) {
            logger.error(error);
            throw new Error("AI 설명 생성에 실패했습니다. 나중에 다시 시도해 주세요.");
        }
    }

    /**
     * 고객 선호도나 상황에 맞는 메뉴 추천 (캐싱 적용)
     * @param {Object} context - 고객 선호도, 현재 날씨, 시간, 기분, 과거 주문 등
     * @param {Array} menuList - 전체 메뉴 목록
     * @returns {Promise<Array>} 추천 메뉴 목록 및 추천 사유
     */
    async recommendMenus(context, menuList) {
        const { preferences, time, weather = "맑음", mood = "보통", pastOrders = [] } = context;
        // 메뉴 ID들의 해시값 대신 간단한 키 조합 사용
        const cacheKey = `rec_${preferences}_${weather}_${mood}_${pastOrders.length}_${menuList.length}`;

        if (this.cache.has(cacheKey)) {
            logger.debug(`[AI] 캐시된 추천 결과를 반환합니다.`);
            return this.cache.get(cacheKey);
        }

        const menus = menuList.map(m => ({ id: m.id, name: m.name, category: m.categories?.name, price: m.price }));
        const prompt = `
      당신은 매장의 전문 매니저입니다. 고객의 상황과 선호도에 따라 가장 잘 어울리는 메뉴 3가지를 추천해 주세요.
      
      [고객 상황]
      - 선호도: ${preferences}
      - 현재 시간: ${time}
      - 현재 날씨: ${weather}
      - 현재 기분 태그: ${mood}
      - 과거 주문했던 메뉴들: ${pastOrders.join(", ") || "내역 없음"}
      
      [메뉴 목록]
      ${JSON.stringify(menus)}
      
      [결과 형식]
      반드시 다음 JSON 형식으로만 응답하세요:
      [
        { "id": 메뉴ID, "reason": "추천 사유(한 문장)" },
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
      반드시 다음 JSON 형식으로만 응답하세요:
      [
        { "id": 메뉴ID, "reason": "페어링 사유(한 문장, 예: 매콤한 입안을 시원하게 달래줄 아이스크림입니다.)" }
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

        // 최대 재시도 횟수는 모델 리스트 크기만큼
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
                    break; // 다른 유형의 에러는 즉시 중단
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
     * 메뉴 이름 리스트를 분석하여 카테고리, 설명, 가격 추천 (일괄 등록용)
     * menuData: 엑셀에서 파싱된 구조화 힌트 [{name, price, category, description, spicy_level, allergens}]
     */
    async analyzeMenuList(menuNames, existingCategories = [], menuData = []) {
        // 엑셀 힌트가 있으면 상세 목록, 없으면 이름만 나열
        const menuListText = menuData.length > 0
            ? menuNames.map(name => {
                const hint = menuData.find(d => d.name === name) || {};
                const parts = [`- ${name}`];
                const meta = [];
                if (hint.price) meta.push(`가격: ${hint.price}원`);
                if (hint.category) meta.push(`카테고리: ${hint.category}`);
                if (hint.description) meta.push(`설명힌트: ${hint.description}`);
                if (hint.spicy_level != null) meta.push(`맵기: ${hint.spicy_level}`);
                if (hint.allergens) meta.push(`알레르기: ${hint.allergens}`);
                return meta.length > 0 ? `${parts[0]} (${meta.join(' / ')})` : parts[0];
            }).join('\n')
            : menuNames.map(n => `- ${n}`).join('\n');

        const prompt = `
            당신은 매장 컨설팅 전문가입니다.
            다음은 매장 관리자가 입력한 메뉴 이름들입니다.
            이 메뉴들을 분석하여 적절한 카테고리 분류, 메뉴 설명, 그리고 예상 판매 가격(원화)을 추천해 주세요.

            [메뉴 리스트]
            ${menuListText}

            [기존 카테고리 참고]
            ${existingCategories.map(c => c.name).join(', ') || '없음 (새로 생성 필요)'}

            [출력 지침]
            1. 반드시 다음 JSON 형식의 배열로만 응답하세요:
           [
             {
               "name": "메뉴명",
               "category_name": "카테고리명",
               "description": "친절한 설명",
               "price": 예상가격(숫자),
               "allergens": "알레르기 정보 (없으면 빈 문자열)",
               "tags": ["태그1", "태그2"],
               "spicy_level": 맵기단계(0~3),
               "options": [{"name": "옵션명", "type": "radio/checkbox", "values": ["값1", "값2"]}],
               "image_keyword": "영문 이미지 검색 키워드 (예: crispy fried chicken)"
             }
           ]
        2. 카테고리명은 가급적 기존 카테고리를 활용하고, 없으면 새로 만드세요.
        3. 가격힌트가 제공된 경우 해당 가격을 그대로 사용하고, 없으면 100원 단위로 추천하세요.
        4. 카테고리힌트가 제공된 경우 해당 카테고리를 우선 사용하세요.
        5. 설명힌트가 제공된 경우 이를 바탕으로 더 풍성하게 작성하세요.
        6. 알레르기 정보가 제공된 경우 그대로 allergens 필드에 반영하세요.
        7. spicy_level은 안매움(0)부터 아주매움(3)까지 숫자로 표현하세요.
        8. options는 해당 메뉴에 어울리는 추가 선택 사항(예: 굽기, 토핑, 사이즈)을 제안하세요.
        9. image_keyword는 Unsplash에서 검색하기 좋은 구체적인 영문 키워드로 작성해 주세요.
        10. 다른 텍스트는 절대 포함하지 마세요.
        11. 한국어로 작성하세요 (image_keyword 제외).
        `;

        try {
            const rawText = await this.generateWithFallback(prompt);
            const text = rawText.replace(/```json|```/g, "").trim();
            return JSON.parse(text);
        } catch (error) {
            logger.error(error);
            return menuNames.map(name => {
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
                    image_keyword: 'food'
                };
            });
        }
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
        } catch (error) {
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
}

module.exports = new AIService();
