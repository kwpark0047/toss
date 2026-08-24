#!/usr/bin/env node
/**
 * Swagger/OpenAPI 스펙 검증 스크립트
 * CI/CD 파이프라인에서 실행: npm run validate:swagger
 */

const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

// routes/swagger.js의 options 재사용 (직접 import 불가하므로 여기서 정의)
const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WeMarket API',
      version: require('../package.json').version,
      description: 'WeMarket QR Menu & Small Business Platform API',
    },
    servers: [
      { url: 'https://wemarket.onrender.com/api', description: 'Production' },
      { url: 'http://localhost:3000/api', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        orderCapability: { type: 'apiKey', in: 'header', name: 'x-order-capability' },
      },
    },
    tags: [
      { name: 'Auth', description: '인증/인가' },
      { name: 'Stores', description: '매장 관리' },
      { name: 'Products', description: '상품/메뉴 관리' },
      { name: 'Orders', description: '주문 관리' },
      { name: 'Payments', description: '결제 관리' },
      { name: 'Points', description: '포인트 관리' },
      { name: 'Waiting', description: '대기열/웨이팅' },
      { name: 'Reservations', description: '예약 관리' },
      { name: 'AI/ML', description: 'AI/머신러닝' },
      { name: 'Analytics', description: '분석/통계' },
      { name: 'Notifications', description: '알림' },
      { name: 'KDS', description: '주방 디스플레이' },
      { name: 'Admin', description: '관리자' },
      { name: 'Config', description: '설정' },
      { name: 'Health', description: '헬스체크' },
    ],
  },
  apis: ['./routes/*.js', './controllers/*.js'],
};

async function validateSwagger() {
  console.log('[Swagger Validation] Starting...\n');

  try {
    // 1. 스펙 생성
    console.log('1. Generating OpenAPI spec...');
    const specs = swaggerJsdoc(options);
    console.log('   ✓ Spec generated successfully');

    // 2. 기본 구조 검증
    console.log('\n2. Validating basic structure...');
    const requiredFields = ['openapi', 'info', 'servers', 'paths', 'components'];
    for (const field of requiredFields) {
      if (!specs[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
      console.log(`   ✓ ${field} present`);
    }

    // 3. Info 검증
    console.log('\n3. Validating info...');
    if (!specs.info.title || !specs.info.version) {
      throw new Error('Missing title or version in info');
    }
    console.log(`   ✓ Title: ${specs.info.title}`);
    console.log(`   ✓ Version: ${specs.info.version}`);

    // 4. Paths 검증
    console.log('\n4. Validating paths...');
    const pathCount = Object.keys(specs.paths).length;
    console.log(`   ✓ Total paths: ${pathCount}`);

    if (pathCount === 0) {
      throw new Error('No paths found - check JSDoc annotations in routes/*.js');
    }

    // 주요 엔드포인트 존재 확인
    const criticalPaths = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/stores',
      '/api/products',
      '/api/orders',
      '/api/health',
    ];

    for (const criticalPath of criticalPaths) {
      const found = Object.keys(specs.paths).some(p => p.includes(criticalPath.replace('/api', '')));
      if (!found) {
        console.warn(`   ⚠ Critical path not found: ${criticalPath}`);
      } else {
        console.log(`   ✓ Found: ${criticalPath}`);
      }
    }

    // 5. Components 검증
    console.log('\n5. Validating components...');
    if (specs.components?.schemas) {
      const schemaCount = Object.keys(specs.components.schemas).length;
      console.log(`   ✓ Schemas: ${schemaCount}`);
    }
    if (specs.components?.securitySchemes) {
      const schemeCount = Object.keys(specs.components.securitySchemes).length;
      console.log(`   ✓ Security schemes: ${schemeCount}`);
    }

    // 6. 스펙 파일 저장 (아티팩트용)
    console.log('\n6. Saving spec to swagger.json...');
    const outputPath = path.join(__dirname, '../swagger.json');
    fs.writeFileSync(outputPath, JSON.stringify(specs, null, 2));
    console.log(`   ✓ Saved to ${outputPath}`);

    // 7. 스펙 유효성 검증 (swagger-codegen validate 시뮬레이션)
    console.log('\n7. Running structural validation...');
    const validationErrors = [];

    // 각 path의 각 operation 검증
    for (const [path, pathItem] of Object.entries(specs.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(method)) {
          // responses 필수 확인
          if (!operation.responses) {
            validationErrors.push(`${method.toUpperCase()} ${path}: missing responses`);
          }
          // summary 권장
          if (!operation.summary) {
            validationErrors.push(`${method.toUpperCase()} ${path}: missing summary (recommended)`);
          }
        }
      }
    }

    if (validationErrors.length > 0) {
      console.warn(`   ⚠ ${validationErrors.length} validation warnings:`);
      validationErrors.slice(0, 10).forEach(err => console.warn(`      - ${err}`));
      if (validationErrors.length > 10) {
        console.warn(`      ... and ${validationErrors.length - 10} more`);
      }
    } else {
      console.log('   ✓ No validation errors');
    }

    console.log('\n=== Swagger Validation PASSED ===');
    console.log(`Total paths: ${pathCount}`);
    console.log(`Spec saved to: ${outputPath}`);

    process.exit(0);

  } catch (error) {
    console.error('\n=== Swagger Validation FAILED ===');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

validateSwagger();