/**
 * [Validator Middleware]
 * API 요청 본문(body)의 필수 필드를 검증하는 매개변수 기반 유효성 검사 미들웨어입니다.
 */
const validateBody = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = requiredFields.filter(field => {
            const value = req.body[field];
            return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
        });

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `다음 필수 항목이 누락되었습니다: ${missingFields.join(', ')}`
            });
        }

        next();
    };
};

/**
 * [ID Validator]
 * URL 파라미터나 본문의 ID 값이 유효한 숫자인지 확인합니다.
 */
const validateId = (paramNames) => {
    return (req, res, next) => {
        const invalidParams = paramNames.filter(name => {
            const val = req.params[name] || req.query[name] || req.body[name];
            return isNaN(parseInt(val));
        });

        if (invalidParams.length > 0) {
            return res.status(400).json({
                error: `유효하지 않은 ID 형식입니다: ${invalidParams.join(', ')}`
            });
        }

        next();
    };
};

module.exports = {
    validateBody,
    validateId
};
