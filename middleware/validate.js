const Joi = require('joi');

/**
 * Joi 스키마를 사용하여 요청 데이터를 검증하는 미들웨어
 * @param {Object} schema - Joi schema object (body, query, params, etc.)
 */
const validate = (schema) => (req, res, next) => {
  // 1. 검증 대상 선택 (body > query > params 순서 또는 명시된 것)
  // 보통 body 검증이 가장 많으므로, schema가 Joi 객체라면 body로 간주
  // schema가 { body: ..., query: ... } 형태라면 각각 검증

  // 편의상 schema가 Joi 객체인 경우 req.body를 검증
  if (Joi.isSchema(schema)) {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const errorMessage = error.details.map((details) => details.message).join(', ');
      return res.status(400).json({
        error: 'Validation Error',
        message: errorMessage,
        details: error.details,
      });
    }
    req.body = value; // 정제된(Type casting 등) 데이터로 교체
    return next();
  }

  // 객체 형태로 전달된 경우 (예: { body: schema, query: schema })
  const validations = [];
  if (schema.body) validations.push({ type: 'body', data: req.body, schema: schema.body });
  if (schema.query) validations.push({ type: 'query', data: req.query, schema: schema.query });
  if (schema.params) validations.push({ type: 'params', data: req.params, schema: schema.params });

  for (const v of validations) {
    const { error, value } = v.schema.validate(v.data, { abortEarly: false, stripUnknown: true });
    if (error) {
      const errorMessage = error.details.map((details) => details.message).join(', ');
      return res.status(400).json({
        error: `Validation Error (${v.type})`,
        message: errorMessage,
        details: error.details,
      });
    }
    if (v.type === 'query' || v.type === 'params') {
      Object.defineProperty(req, v.type, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      req[v.type] = value;
    }
  }

  next();
};

module.exports = validate;
