const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

class VoiceOrderService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
    // Simple rule-based matcher
    const matchedItems = [];
    for (const menu of menuItems) {
      if (promptText.includes(menu.name)) {
        matchedItems.push({
          product_id: menu.id,
          quantity: 1,
          options: [],
        });
      }
    }
    return { success: true, items: matchedItems, rawText: promptText, fallback: true };
  }
}

module.exports = new VoiceOrderService();
