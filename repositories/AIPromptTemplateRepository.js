const prisma = require('../config/prisma');

const AIPromptTemplateRepository = {
    async findActive(name) {
        return prisma.ai_prompt_templates.findFirst({
            where: { name, isActive: true },
            orderBy: { version: 'desc' },
        });
    },

    async findByName(name) {
        return prisma.ai_prompt_templates.findFirst({
            where: { name },
            orderBy: { version: 'desc' },
        });
    },

    async findAll(includeInactive = false) {
        const where = includeInactive ? {} : { isActive: true };
        return prisma.ai_prompt_templates.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
        });
    },

    async create(data) {
        return prisma.ai_prompt_templates.create({
            data: {
                name: data.name,
                description: data.description || null,
                prompt: data.prompt,
                version: 1,
                isActive: true,
            },
        });
    },

    async createVersion(name, newPrompt, description) {
        const existing = await prisma.ai_prompt_templates.findFirst({
            where: { name },
            orderBy: { version: 'desc' },
        });

        if (!existing) {
            return prisma.ai_prompt_templates.create({
                data: {
                    name,
                    description: description || null,
                    prompt: newPrompt,
                    version: 1,
                    isActive: true,
                },
            });
        }

        // Deactivate current active version
        await prisma.ai_prompt_templates.updateMany({
            where: { name, isActive: true },
            data: { isActive: false },
        });

        return prisma.ai_prompt_templates.create({
            data: {
                name,
                description: description || existing.description,
                prompt: newPrompt,
                version: existing.version + 1,
                isActive: true,
            },
        });
    },

    async deactivate(name) {
        return prisma.ai_prompt_templates.updateMany({
            where: { name },
            data: { isActive: false },
        });
    },

    async delete(name) {
        return prisma.ai_prompt_templates.deleteMany({
            where: { name },
        });
    },
};

module.exports = AIPromptTemplateRepository;
