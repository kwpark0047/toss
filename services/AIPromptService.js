const AIPromptTemplateRepository = require('../repositories/AIPromptTemplateRepository');
const logger = require('../utils/logger');

class AIPromptService {
    constructor() {
        this.promptCache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    }

    async getPrompt(name, fallback) {
        const cacheKey = `prompt:${name}`;
        const cached = this.promptCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.prompt;
        }

        try {
            const template = await AIPromptTemplateRepository.findActive(name);
            if (template) {
                this.promptCache.set(cacheKey, { prompt: template.prompt, timestamp: Date.now() });
                return template.prompt;
            }
        } catch (err) {
            logger.warn(`[AIPromptService] Failed to load prompt '${name}':`, err.message);
        }

        return fallback;
    }

    async createPrompt(name, prompt, description) {
        const template = await AIPromptTemplateRepository.create(name, prompt, description);
        this.invalidateCache(name);
        return template;
    }

    async updatePrompt(name, newPrompt, description) {
        const template = await AIPromptTemplateRepository.createVersion(name, newPrompt, description);
        this.invalidateCache(name);
        return template;
    }

    async listPrompts(includeInactive = false) {
        return AIPromptTemplateRepository.findAll(includeInactive);
    }

    async deactivatePrompt(name) {
        await AIPromptTemplateRepository.deactivate(name);
        this.invalidateCache(name);
    }

    invalidateCache(name) {
        this.promptCache.delete(`prompt:${name}`);
    }
}

module.exports = new AIPromptService();
