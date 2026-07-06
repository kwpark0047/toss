const Joi = require('joi');

// 옵션 항목 하나의 스키마 (VisualOptionEditor 포맷 포함)
const optionItemSchema = Joi.object({
    name: Joi.string().required().messages({
        'any.required': '옵션명은 필수입니다.'
    }),
    values: Joi.array().items(Joi.string().allow('')).min(1).required().messages({
        'array.min': '옵션 값은 최소 1개 이상이어야 합니다.',
        'any.required': '옵션 값은 필수입니다.'
    }),
    type: Joi.string().valid('radio', 'checkbox', 'select').default('radio'),
    required: Joi.boolean().optional(),
    prices: Joi.array().items(Joi.number().allow(null)).optional(),
}).unknown(true);

const schemas = {
    // === [Auth] ===
    auth: {
        sendOtp: Joi.object({
            phone: Joi.string().pattern(/^[0-9-]{9,14}$/).required().messages({
                'string.pattern.base': '유효한 핸드폰 번호를 입력해주세요.',
                'any.required': '핸드폰 번호는 필수입니다.',
            }),
        }),
        verifyOtp: Joi.object({
            phone: Joi.string().pattern(/^[0-9-]{9,14}$/).required().messages({
                'string.pattern.base': '유효한 핸드폰 번호를 입력해주세요.',
            }),
            otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
                'string.length': '인증번호는 6자리입니다.',
                'string.pattern.base': '인증번호는 숫자로만 구성됩니다.',
                'any.required': '인증번호는 필수입니다.',
            }),
        }),
        register: Joi.object({
            phone: Joi.string().pattern(/^[0-9-]{9,14}$/).required().messages({
                'string.pattern.base': '유효한 핸드폰 번호를 입력해주세요.',
                'any.required': '핸드폰 번호는 필수입니다.',
            }),
            password: Joi.string().min(6).required().messages({
                'string.min': '비밀번호는 최소 6자 이상이어야 합니다.',
                'any.required': '비밀번호는 필수입니다.',
            }),
        }),
        // identifier = 핸드폰 번호 또는 이메일
        login: Joi.object({
            identifier: Joi.string().optional(),
            email: Joi.string().email().optional(),
            password: Joi.string().required()
        }).or('identifier', 'email'),
        updateProfile: Joi.object({
            name: Joi.string().allow('', null).optional(),
            email: Joi.string().email().allow('', null).optional().messages({
                'string.email': '유효한 이메일 주소를 입력해주세요.'
            }),
            address: Joi.string().allow('', null).optional(),
        }).min(1).messages({
            'object.min': '변경할 항목을 하나 이상 입력해주세요.'
        }),
        changePassword: Joi.object({
            current_password: Joi.string().required().messages({
                'any.required': '현재 비밀번호를 입력해주세요.',
            }),
            new_password: Joi.string().min(6).required().messages({
                'string.min': '새 비밀번호는 최소 6자 이상이어야 합니다.',
                'any.required': '새 비밀번호를 입력해주세요.',
            }),
        }),
    },

    // === [Store] ===
    store: {
        create: Joi.object({
            user_id: Joi.number().integer().optional(), // 보통 토큰에서 가져오지만 명시적 전달 시
            name: Joi.string().required(),
            description: Joi.string().allow('', null),
            address: Joi.string().allow('', null),
            phone: Joi.string().allow('', null),
            business_type: Joi.string().allow('', null),
            open_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).allow('', null),
            close_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).allow('', null),
            plan: Joi.string().valid('free', 'pro', 'enterprise').default('free'),
            latitude: Joi.number().allow(null),
            longitude: Joi.number().allow(null)
        })
    },

    // === [Product] ===
    product: {
        create: Joi.object({
            store_id: Joi.number().integer().required(),
            category_id: Joi.number().integer().allow(null).optional(),
            name: Joi.string().required(),
            price: Joi.number().min(0).required(),
            description: Joi.string().allow('', null),
            image_url: Joi.string().allow('', null),
            is_active: Joi.number().valid(0, 1).default(1),
            is_sold_out: Joi.number().valid(0, 1).default(0),
            detail_description: Joi.string().allow('', null),
            allergens: Joi.string().allow('', null),
            ingredients: Joi.string().allow('', null),
            nutrition_info: Joi.string().allow('', null),
            spicy_level: Joi.number().min(0).max(5).default(0),
            is_popular: Joi.number().valid(0, 1).default(0),
            is_new: Joi.number().valid(0, 1).default(0),
            tags: Joi.string().allow('', null),
            detail_images: Joi.string().allow('', null),
            cooking_time: Joi.number().min(0).default(5),
            stock_quantity: Joi.number().integer().allow(null).optional(),
            low_stock_threshold: Joi.number().integer().min(0).default(5),
            options: Joi.alternatives().try(
                Joi.array().items(optionItemSchema).allow(null),
                Joi.string().allow('', null)
            ).optional(),
        }).unknown(true)
    },

    // === [Option Template] ===
    optionTemplate: {
        create: Joi.object({
            store_id: Joi.number().integer().required(),
            name: Joi.string().required().messages({
                'any.required': '템플릿 이름은 필수입니다.'
            }),
            options: Joi.string().custom((value, helpers) => {
                try {
                    const parsed = JSON.parse(value);
                    const { error } = Joi.array().items(optionItemSchema).min(1).validate(parsed);
                    if (error) return helpers.error('any.invalid', { message: '옵션 형식이 올바르지 않습니다.' });
                    return value;
                } catch {
                    return helpers.error('any.invalid', { message: '옵션은 JSON 문자열이어야 합니다.' });
                }
            }).required().messages({
                'any.required': '옵션 데이터는 필수입니다.',
                'any.invalid': '옵션 형식이 올바르지 않습니다.'
            })
        }),
        update: Joi.object({
            name: Joi.string().optional(),
            options: Joi.string().custom((value, helpers) => {
                try {
                    const parsed = JSON.parse(value);
                    const { error } = Joi.array().items(optionItemSchema).min(1).validate(parsed);
                    if (error) return helpers.error('any.invalid', { message: '옵션 형식이 올바르지 않습니다.' });
                    return value;
                } catch {
                    return helpers.error('any.invalid', { message: '옵션은 JSON 문자열이어야 합니다.' });
                }
            }).optional()
        }).min(1)
    },

    // === [Order] ===
    order: {
        create: Joi.object({
            store_id: Joi.number().integer().required(),
            table_id: Joi.alternatives().try(Joi.number().integer(), Joi.string()).allow(null).optional(),
            table_number: Joi.string().allow('', null).optional(),
            total_amount: Joi.number().min(0).required(),
            payment_method: Joi.string().valid('card', 'cash', 'point', 'mixed', 'toss').required(),
            items: Joi.array().items(
                Joi.object({
                    product_id: Joi.number().integer().required(),
                    product_name: Joi.string().required(),
                    quantity: Joi.number().integer().min(1).required(),
                    price: Joi.number().min(0).required(),
                    subtotal: Joi.number().min(0).optional(),
                    options: Joi.array().optional()
                })
            ).min(1).required(),
            phone: Joi.string().allow('', null),
            customer_name: Joi.string().allow('', null),
            toss_user_key: Joi.string().allow('', null),
            point_amount: Joi.number().min(0).default(0),
            // [추가] 분할 결제 필드
            is_split_payment: Joi.boolean().default(false),
            split_type: Joi.string().valid('NONE', 'EQUAL', 'ITEM').default('NONE'),
            split_status: Joi.string().valid('PENDING', 'PARTIAL', 'COMPLETED').default('PENDING')
        })
    }
};

module.exports = schemas;
