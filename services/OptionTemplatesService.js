const OptionTemplate = require('../repositories/OptionTemplate');
const logger = require('../utils/logger');

/**
 * [옵션 템플릿 서비스]
 * 메뉴에 연결해 사용할 수 있는 복합 선택 옵션들의 구성과 형식을 제어하는 비즈니스 계층입니다.
 */
class OptionTemplatesService {
    /**
     * 특정 매장의 전체 옵션 템플릿 목록을 조회합니다.
     */
    async getTemplatesByStore(storeId) {
        if (!storeId) throw new Error('매장 ID는 필수입니다.');
        return await OptionTemplate.findByStoreId(storeId);
    }

    /**
     * 신규 옵션 템플릿을 생성합니다.
     */
    async createTemplate({ storeId, name, options }) {
        if (!storeId || !name) {
            throw new Error('매장 ID와 템플릿 이름은 필수입니다.');
        }

        const data = {
            store_id: parseInt(storeId),
            name,
            options: typeof options === 'string' ? options : JSON.stringify(options)
        };

        const template = await OptionTemplate.create(data);
        logger.info(`[옵션템플릿] 매장 ${storeId}번에 신규 옵션 템플릿 "${name}"이(가) 등록되었습니다.`);
        return template;
    }

    /**
     * 기존 옵션 템플릿을 수정합니다.
     */
    async updateTemplate(id, { name, options }) {
        if (!id) throw new Error('템플릿 ID가 제공되지 않았습니다.');

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (options !== undefined) {
            updateData.options = typeof options === 'string' ? options : JSON.stringify(options);
        }

        const template = await OptionTemplate.update(id, updateData);
        logger.info(`[옵션템플릿] 옵션 템플릿 ID ${id}번이 성공적으로 수정되었습니다.`);
        return template;
    }

    /**
     * 특정 옵션 템플릿을 데이터베이스에서 물리 삭제합니다.
     */
    async deleteTemplate(id) {
        if (!id) throw new Error('템플릿 ID가 제공되지 않았습니다.');
        const result = await OptionTemplate.delete(id);
        logger.info(`[옵션템플릿] 옵션 템플릿 ID ${id}번이 완전히 삭제되었습니다.`);
        return result;
    }
}

module.exports = OptionTemplatesService;
