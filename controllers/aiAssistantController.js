const { AppError } = require('../utils/errorHandler');
const aiService = require('../services/aiService');

/**
 * 1. AI 메뉴 어시스턴트 채팅
 * POST /api/ai-assistant/chat
 * body: { message, storeId?, menuContext? }
 */
const chatWithAI = async (req, res, next) => {
    try {
        const { message, storeId: _storeId, menuContext } = req.body;

        if (!message || !message.trim()) {
            return next(new AppError('메시지를 입력해주세요.', 400));
        }

        const contextInfo = menuContext
            ? `\n현재 메뉴 정보:\n${JSON.stringify(menuContext, null, 2)}`
            : '';

        const prompt = `
당신은 레스토랑 메뉴 전문 AI 어시스턴트입니다.
고객의 질문에 친절하고 자연스럽게 답변해주세요.
메뉴 추천, 알레르기, 맵기, 재료, 조리법 등에 대한 질문에 답변합니다.
답변은 2~4문장으로 간결하게 작성해주세요.
${contextInfo}

고객 질문: ${message}`;

        const reply = await aiService.generateWithFallback(prompt);

        res.success({
            reply: reply?.trim() || '죄송합니다. 현재 답변을 드리기 어렵습니다.',
            message
        }, 'AI 응답 완료');
    } catch (err) {
        next(err);
    }
};

/**
 * 2. 메시지 번역
 * POST /api/ai-assistant/translate
 * body: { text, targetLang }
 */
const translateMessage = async (req, res, next) => {
    try {
        const { text, targetLang } = req.body;

        if (!text || !text.trim()) return next(new AppError('번역할 텍스트를 입력해주세요.', 400));
        if (!targetLang) return next(new AppError('targetLang이 필요합니다. (ko/en/ja/zh)', 400));

        const langNames = { ko: '한국어', en: '영어', ja: '일본어', zh: '중국어(간체)' };
        const langName = langNames[targetLang] || targetLang;

        const prompt = `다음 텍스트를 ${langName}로 자연스럽게 번역해주세요. 번역문만 출력하세요:\n\n${text}`;
        const translated = await aiService.generateWithFallback(prompt);

        res.success({
            original: text,
            translated: translated?.trim(),
            target_lang: targetLang
        }, '번역 완료');
    } catch (err) {
        next(err);
    }
};

module.exports = { chatWithAI, translateMessage };
