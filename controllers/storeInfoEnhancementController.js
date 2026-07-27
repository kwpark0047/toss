const storeInfoEnhancementService = require('../services/StoreInfoEnhancementService');
const Store = require('../repositories/Store');
const catchAsync = require('../utils/catchAsync');

const storeInfoEnhancementController = {
    // 매장 정보 보강 및 자동 완성
    enhanceStoreInfo: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const { autoSave = false } = req.query;
        
        const enhancement = await storeInfoEnhancementService.autoCompleteStoreInfo(
            storeId, 
            { autoSave: autoSave === 'true' }
        );
        
        res.success(enhancement);
    }),

    // 매장 정보 검증 및 보완 리포트
    getCompletionReport: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        
        const report = await storeInfoEnhancementService.generateCompletionReport(storeId);
        
        res.success(report);
    }),

    // 법적 필수 필드 자동 생성
    generateLegalFields: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const store = await Store.findById(storeId);
        
        if (!store) {
            return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
        }
        
        const missingFields = storeInfoEnhancementService.getMissingFields(store).legal;
        
        if (missingFields.length === 0) {
            return res.success({ message: '모든 법적 필수 필드가 이미 설정되어 있습니다.' });
        }
        
        const generated = await storeInfoEnhancementService.generateMissingLegalFields(
            { ...req.body, ...await Store.findById(req.params.storeId) },
            missingFields
        );
        
        res.success({
            generatedFields: generated,
            message: `${Object.keys(generated).length}개 필드가 생성되었습니다.`
        });
    }),

    // 영업시간 자동 생성
    generateBusinessHours: async (req, res) => {
        const { storeId } = req.params;
        
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
        }
        
        const hours = await storeInfoEnhancementService.generateBusinessHours(store);
        
        res.success({
            hours,
            message: '영업시간이 생성되었습니다.'
        });
    }),

    // 업종 자동 분류
    classifyBusinessType: async (req, res) => {
        const { storeId } = req.params;
        
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
        }
        
        const businessType = await storeInfoEnhancementService.classifyBusinessType(store);
        
        if (!businessType) {
            return res.status(400).json({ 
                success: false, 
                error: '업종 분류에 실패했습니다. 직접 입력해주세요.' 
            });
        }
        
        res.success({
            businessType,
            message: `업종이 "${businessType}"으로 분류되었습니다.`
        });
    }),

    // 매장 설명 자동 생성
    generateDescription: async (req, res) => {
        const { storeId } = req.params;
        
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
        }
        
        const description = await storeInfoEnhancementService.generateStoreDescription(store);
        
        if (!description) {
            return res.status(400).json({ 
                success: false, 
                error: '설명 생성에 실패했습니다. 직접 입력해주세요.' 
            });
        }
        
        res.success({
            description,
            message: '매장 설명이 생성되었습니다.'
        });
    }),

    // 서비스/메뉴 제안
    getServiceSuggestions: async (req, res) => {
        const { storeId } = req.params;
        
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
        }
        
        const suggestions = await storeInfoEnhancementService.generateServiceSuggestions(store);
        
        res.success({
            suggestions,
            businessType: store.business_type
        });
    }),

    // 매장 정보 완성도 검증 (실시간)
    validateStoreInfo: async (req, res) => {
        const { storeId } = req.params;
        
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
        }
        
        const report = await storeInfoEnhancementService.generateCompletionReport(storeId);
        
        res.success({
            isValid: report.isComplete,
            isLegalComplete: report.isLegalComplete,
            canOperate: report.canOperate,
            score: report.completionScore,
            missingCount: report.missingCount,
            priorityActions: report.priorityActions
        });
    }),

    // 저장된 매장 정보에 보강 데이터 적용
    applyEnhancements: async (req, res) => {
        const { storeId } = req.params;
        const { enhancements } = req.body;
        
        if (!enhancements || Object.keys(enhancements).length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: '적용할 보강 데이터가 없습니다.' 
            });
        }
        
        const updated = await Store.update(storeId, enhancements);
        
        // 캐시 무효화
        const storeService = require('../services/StoreService');
        storeService.flushStoreCache(storeId);
        
        res.success({
            store: updated,
            message: `${Object.keys(enhancements).length}개 필드가 업데이트되었습니다.`
        });
    }),

    // 일괄 매장 정보 보강 (관리자용)
    bulkEnhanceStores: async (req, res) => {
        const { storeIds, options = {} } = req.body;
        
        if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'storeIds 배열이 필요합니다.' 
            });
        }
        
        const results = [];
        const errors = [];
        
        for (const storeId of storeIds) {
            try {
                const enhancement = await storeInfoEnhancementService.autoCompleteStoreInfo(
                    storeId, 
                    { autoSave: options.autoSave || false }
                );
                results.push({ storeId, ...enhancement });
            } catch (error) {
                errors.push({ storeId, error: error.message });
            }
        }
        
        res.success({
            processed: results.length,
            failed: errors.length,
            results,
            errors
        });
    })
};

module.exports = storeInfoEnhancementController;
