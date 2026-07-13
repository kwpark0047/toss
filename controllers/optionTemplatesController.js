const OptionTemplatesService = require('../services/OptionTemplatesService');

const optionTemplatesService = new OptionTemplatesService();

/**
 * [옵션 템플릿 컨트롤러]
 * 외부 어드민 화면 옵션 템플릿 생성/조회/수정/삭제 HTTP 엔드포인트 핸들러 레이어입니다.
 */
const optionTemplatesController = {
    /**
     * GET /api/option-templates/store/:storeId
     * 특정 매장의 전체 옵션 템플릿 목록을 조회합니다.
     */
    async getTemplates(req, res) {
        const { storeId } = req.params;
        const templates = await optionTemplatesService.getTemplatesByStore(storeId);
        res.json(templates);
    },

    /**
     * POST /api/option-templates/
     * 신규 옵션 템플릿을 생성합니다.
     */
    async createTemplate(req, res) {
        const { store_id, name, options } = req.body;
        const template = await optionTemplatesService.createTemplate({
            storeId: store_id,
            name,
            options
        });
        res.status(201).json(template);
    },

    /**
     * PUT /api/option-templates/:id
     * 기존 옵션 템플릿을 수정합니다.
     */
    async updateTemplate(req, res) {
        const { id } = req.params;
        const { name, options } = req.body;
        const template = await optionTemplatesService.updateTemplate(id, {
            name,
            options
        });
        res.json(template);
    },

    /**
     * DELETE /api/option-templates/:id
     * 특정 옵션 템플릿을 삭제합니다.
     */
    async deleteTemplate(req, res) {
        const { id } = req.params;
        await optionTemplatesService.deleteTemplate(id);
        res.json({ message: '템플릿이 삭제되었습니다.' });
    }
};

module.exports = optionTemplatesController;
