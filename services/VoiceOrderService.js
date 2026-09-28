const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

class VoiceOrderService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    }
  }

  /**
   * 자연어 음성/채팅 주문 텍스트를 파싱하여 구조화된 주문 아이템으로 변환
   */
  async parseOrderFromText(promptText, menuItems = []) {
    if (!promptText) {
      throw new AppError('주문 내용이 비어 있습니다.', 400);
    }

    if (!this.model) {
      logger.warn('Gemini API key not configured. Using rule-based fallback order parser.');
      return this.fallbackParse(promptText, menuItems);
    }

    try {
      const menuListStr = JSON.stringify(
        menuItems.map((m) => ({ id: m.id, name: m.name, price: m.price }))
      );
      const fullPrompt = `
You are an intelligent AI waiter for WeMarket QR menu. 
Given the available menu items: ${menuListStr}
And the customer request: "${promptText}"

Extract the ordered items with their quantities and option requests. 
Return ONLY a valid JSON array of objects with keys: product_id, quantity, options (array of strings). Do not include markdown code blocks or any other text.
`;

      const result = await this.model.generateContent(fullPrompt);
      const responseText = result.response.text().trim();
      const cleanedJson = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsedItems = JSON.parse(cleanedJson);

      return { success: true, items: parsedItems, rawText: promptText };
    } catch (error) {
      logger.error(
        { error: error.message },
        'Gemini voice order parsing failed. Falling back to rule-based parser.'
      );
      return this.fallbackParse(promptText, menuItems);
    }
  }

  fallbackParse(promptText, menuItems) {
    // Rule-based matcher: 메뉴명 매칭 + 수량/옵션 추출
    const matchedItems = [];
    for (const menu of menuItems) {
      if (promptText.includes(menu.name)) {
        matchedItems.push({
          product_id: menu.id,
          quantity: this._extractQuantity(promptText, menu.name),
          options: this._extractOptions(promptText, menu.name),
        });
      }
    }
    return { success: true, items: matchedItems, rawText: promptText, fallback: true };
  }

  _extractQuantity(promptText, menuName) {
    const UNITS = '(개|잔|인분|병|마리|판|팩|봉|컵)';
    const KOREAN_NUMERALS = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 하나: 1, 둘: 2, 셋: 3, 넷: 4 };

    // 1) 메뉴명 직후 수량 우선 — "메뉴 2개", "메뉴 한 잔"
    const after = promptText.slice(promptText.indexOf(menuName) + menuName.length);
    const afterArabic = after.match(new RegExp(`^\\s*(\\d+)\\s*${UNITS}?`));
    if (afterArabic) return parseInt(afterArabic[1], 10);
    const afterKorean = after.match(
      new RegExp(`^\\s*(한|두|세|네|다섯|하나|둘|셋|넷|다섯)\\s*${UNITS}?`)
    );
    if (afterKorean) return KOREAN_NUMERALS[afterKorean[1]];

    // 2) 메뉴명 앞 수량 폴백 — "2개 메뉴", "두 잔 메뉴"
    const before = promptText.slice(0, promptText.indexOf(menuName));
    const beforeArabic = before.match(new RegExp(`(\\d+)\\s*${UNITS}?\\s*$`));
    if (beforeArabic) return parseInt(beforeArabic[1], 10);
    const beforeKorean = before.match(
      new RegExp(`(한|두|세|네|다섯|하나|둘|셋|넷|다섯)\\s*${UNITS}?\\s*$`)
    );
    if (beforeKorean) return KOREAN_NUMERALS[beforeKorean[1]];

    return 1;
  }

  _extractOptions(promptText, menuName) {
    const BARE_WORDS = [
      '샷',
      '시럽',
      '얼음',
      '뜨거운',
      '따뜻',
      '생크림',
      '휘핑',
      '연하게',
      '크게',
      '적게',
      '빼주',
    ];
    const PAREN_WORDS = [...BARE_WORDS, '추가', '옵션'];

    const idx = promptText.indexOf(menuName);
    if (idx === -1) return [];
    const rest = promptText.slice(idx + menuName.length);
    const options = [];

    // 1) 괄호 옵션: "메뉴 (샷 추가, 연하게) 주세요"
    const parenMatch = rest.match(/^\s*\(([^()]*)\)/);
    if (parenMatch) {
      for (const chunk of parenMatch[1].split(/[,，#、]+/)) {
        const opt = chunk.trim();
        if (opt && PAREN_WORDS.some((word) => opt.includes(word))) options.push(opt);
      }
    }

    // 2) 괄호 없는 옵션 표현: "메뉴 샷 추가해서", "메뉴 얼음 빼주세요"
    const bare = parenMatch ? rest.slice(parenMatch[0].length) : rest;
    for (const word of BARE_WORDS) {
      const phrase = bare.match(new RegExp(`${word}(?:\\s*추가|\\s*로)?`));
      if (phrase) options.push(phrase[0].trim());
    }

    return [...new Set(options)].slice(0, 5);
  }
}

module.exports = new VoiceOrderService();
