const winston = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = winston.format;

// [로그 포맷 정의]
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

// [로거 인스턴스 생성]
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        errors({ stack: true }), // 에러 스택 추적 지원
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        // 1. 콘솔 출력 (색상 적용)
        new winston.transports.Console({
            format: combine(
                colorize(),
                logFormat
            )
        }),
        // 2. 파일 출력 (에러 전용)
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error'
        }),
        // 3. 파일 출력 (전체 로그)
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/combined.log')
        })
    ]
});

module.exports = logger;
