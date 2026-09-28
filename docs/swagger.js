const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

/**
 * WeMarket API - OpenAPI 3.0 Specification Generator
 *
 * This module auto-generates OpenAPI specs from:
 * 1. JSDoc comments in route files
 * 2. Route definitions (auto-discovered)
 * 3. Prisma schema (for model definitions)
 * 4. Zod validation schemas (if present)
 */

function extractRouteInfo(routeFilePath) {
  const content = fs.readFileSync(routeFilePath, 'utf-8');
  const routes = [];

  // Extract HTTP method + path patterns
  const routePattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = routePattern.exec(content)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      file: path.basename(routeFilePath),
    });
  }

  // Extract JSDoc comments for each route
  const jsdocPattern = /\/\*\*([\s\S]*?)\*\/\s*router\.(get|post|put|patch|delete)/g;
  while ((match = jsdocPattern.exec(content)) !== null) {
    const jsdoc = match[1];
    const method = match[2].toUpperCase();
    // Find the path for this JSDoc
    const pathMatch = content.slice(match.index).match(/router\.\w+\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (pathMatch) {
      routes.push({
        method,
        path: pathMatch[1],
        jsdoc: parseJSDoc(jsdoc),
        file: path.basename(routeFilePath),
      });
    }
  }

  return routes;
}

function parseJSDoc(jsdoc) {
  const result = {
    summary: '',
    description: '',
    tags: [],
    parameters: [],
    responses: {},
    security: [],
  };

  const lines = jsdoc.split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim());
  let currentTag = null;

  for (const line of lines) {
    if (line.startsWith('@')) {
      const [tag, ...rest] = line.split(' ');
      currentTag = tag.slice(1);
      const value = rest.join(' ').trim();

      switch (currentTag) {
        case 'summary':
          result.summary = value;
          break;
        case 'description':
          result.description = value;
          break;
        case 'tag':
        case 'tags':
          result.tags.push(value);
          break;
        case 'param': {
          // @param {type} name - description
          const paramMatch = value.match(/^\{(.+)\}\s+(\w+)\s*-\s*(.+)$/);
          if (paramMatch) {
            result.parameters.push({
              name: paramMatch[2],
              in: 'query',
              schema: { type: paramMatch[1] },
              description: paramMatch[3],
            });
          }
          break;
        }
        case 'response':
        case 'responses': {
          // @response {200} {type} description
          const respMatch = value.match(/^\{(\d+)\}\s+\{(.+)\}\s+(.+)$/);
          if (respMatch) {
            result.responses[respMatch[1]] = {
              description: respMatch[3],
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${respMatch[2]}` },
                },
              },
            };
          }
          break;
        }
        case 'security':
          result.security.push(value);
          break;
      }
    } else if (currentTag && line) {
      // Continuation of previous tag
      if (currentTag === 'description') {
        result.description += ' ' + line;
      }
    }
  }

  return result;
}

function generatePrismaSchemas() {
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) return {};

  const content = fs.readFileSync(schemaPath, 'utf-8');
  const schemas = {};

  // Extract model definitions
  const modelPattern = /model\s+(\w+)\s*{([^}]+)}/g;
  let match;
  while ((match = modelPattern.exec(content)) !== null) {
    const modelName = match[1];
    const fields = match[2];

    const properties = {};
    const required = [];

    const fieldLines = fields
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'));
    for (const line of fieldLines) {
      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\??)\s*(?:@.*)?$/);
      if (fieldMatch) {
        const [, fieldName, fieldType, optional] = fieldMatch;
        const typeMap = {
          String: 'string',
          Int: 'integer',
          Float: 'number',
          Boolean: 'boolean',
          DateTime: 'string',
          Json: 'object',
          Decimal: 'number',
        };

        properties[fieldName] = {
          type: typeMap[fieldType] || 'string',
          format: fieldType === 'DateTime' ? 'date-time' : undefined,
        };

        if (!optional) required.push(fieldName);
      }
    }

    if (Object.keys(properties).length > 0) {
      schemas[modelName] = {
        type: 'object',
        properties,
        required,
      };
    }
  }

  return schemas;
}

function buildSwaggerSpec() {
  const routesDir = path.join(__dirname, '../routes');
  const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'));

  let allRoutes = [];
  for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    allRoutes = allRoutes.concat(extractRouteInfo(filePath));
  }

  // Deduplicate routes
  const uniqueRoutes = Array.from(
    new Map(allRoutes.map((r) => [`${r.method} ${r.path}`, r])).values()
  );

  // Build paths object
  const paths = {};
  for (const route of uniqueRoutes) {
    if (!paths[route.path]) paths[route.path] = {};

    const jsdoc = route.jsdoc || {};
    paths[route.path][route.method.toLowerCase()] = {
      summary: jsdoc.summary || `${route.method} ${route.path}`,
      description: jsdoc.description || '',
      tags: jsdoc.tags.length > 0 ? jsdoc.tags : [route.file.replace('.js', '')],
      parameters: jsdoc.parameters || [],
      responses:
        Object.keys(jsdoc.responses).length > 0
          ? jsdoc.responses
          : {
              200: { description: 'Success' },
              400: {
                description: 'Bad Request',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
              },
              401: {
                description: 'Unauthorized',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
              },
              500: {
                description: 'Internal Server Error',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
              },
            },
      security:
        jsdoc.security.length > 0 ? jsdoc.security.map((s) => ({ [s]: [] })) : [{ bearerAuth: [] }],
    };
  }

  const prismaSchemas = generatePrismaSchemas();

  return {
    openapi: '3.0.3',
    info: {
      title: 'WeMarket QR Menu Platform API',
      version: process.env.npm_package_version || '1.3.0',
      description:
        'WeMarket QR 메뉴 & 스마트 매장 관리 플랫폼 API 문서\n\n' +
        '## 인증\n' +
        '모든 API는 Bearer Token(JWT) 인증을 사용합니다.\n' +
        '```\nAuthorization: Bearer <your_jwt_token>\n```\n\n' +
        '## 에러 응답 형식\n' +
        '모든 에러는 다음 형식을 따릅니다:\n' +
        '```json\n{\n  "success": false,\n  "message": "에러 메시지",\n  "error": "에러 코드"\n}\n```',
      contact: { name: 'WeMarket Team', email: 'support@wemarket.com' },
      license: { name: 'MIT' },
    },
    servers: [
      { url: process.env.API_URL || 'http://localhost:3000', description: 'Development' },
      { url: 'https://wemarket.onrender.com', description: 'Production (Render)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase ID Token 또는 WeMarket 액세스 토큰',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: '에러 메시지' },
            error: { type: 'string', example: 'ERROR_CODE' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                total: { type: 'integer', example: 100 },
                totalPages: { type: 'integer', example: 5 },
                hasMore: { type: 'boolean', example: true },
              },
            },
          },
        },
        ...prismaSchemas,
      },
    },
    tags: [
      { name: 'Auth', description: '인증/인가 (로그인, 회원가입, 2FA)' },
      { name: 'Stores', description: '매장 관리 (CRUD, 설정, 연동)' },
      { name: 'Products', description: '상품/메뉴 관리 (CRUD, 카테고리, 옵션)' },
      { name: 'Orders', description: '주문 관리 (생성, 상태변경, 내역)' },
      { name: 'Waiting', description: '대기열/웨이팅 관리' },
      { name: 'KDS', description: '주방 디스플레이 시스템 (Kitchen Display System)' },
      { name: 'CRM', description: '고객 관계 관리 (포인트, 쿠폰, 세그먼트)' },
      { name: 'Alimtalk', description: '카카오 알림톡 연동' },
      { name: 'Print Jobs', description: '프린트 작업 관리' },
      { name: 'Staff', description: '직원 관리 (출근, PIN, 권한)' },
      { name: 'Inventory', description: '재고 관리 (입출고, 알림)' },
      { name: 'Reservations', description: '예약 관리' },
      { name: 'Reviews', description: '리뷰/평가 관리' },
      { name: 'Settlement', description: '정산/매출 분석' },
      { name: 'Campaigns', description: '캠페인/프로모션 관리' },
      { name: 'Notifications', description: '알림/푸시/알림톡' },
      { name: 'Analytics', description: '분석/통계/대시보드' },
      { name: 'Settings', description: '매장 설정/영수증/테마' },
      { name: 'System', description: '시스템 상태/모니터링/개발자 도구' },
    ],
    paths,
  };
}

const spec = buildSwaggerSpec();

module.exports = (app) => {
  try {
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info .title { color: #F97316 }
        .swagger-ui .scheme-container { background: #0f172a; border-radius: 8px; padding: 16px }
        .swagger-ui .opblock.opblock-get { border-color: #10b981 }
        .swagger-ui .opblock.opblock-post { border-color: #3b82f6 }
        .swagger-ui .opblock.opblock-put { border-color: #f59e0b }
        .swagger-ui .opblock.opblock-delete { border-color: #ef4444 }
      `,
        customSiteTitle: 'WeMarket API Documentation',
        customfavIcon: '/icons/icon.svg',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
          tryItOutEnabled: true,
        },
      })
    );

    // JSON spec endpoint
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(spec);
    });

    console.log('[Swagger] API 문서가 /api-docs 에서 제공됩니다');
  } catch (e) {
    console.warn('[Swagger] 문서 생성 실패:', e.message);
  }
};

// Export for testing/CLI usage
module.exports.spec = spec;
module.exports.buildSwaggerSpec = buildSwaggerSpec;
