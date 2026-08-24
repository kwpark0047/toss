/**
 * Zod 검증 미들웨어 테스트
 * tests/middleware/validate.test.ts
 */

const express = require('express');
const request = require('supertest');
const { validateBody, validateQuery, validateParams } = require('../../middleware/validate');
const { registerSchema, loginSchema } = require('../../src/validation/schemas');

describe('validate middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('validateBody', () => {
    const testSchema = registerSchema;

    beforeEach(() => {
      app.post('/test', validateBody(testSchema), (req, res) => {
        res.json({ success: true, data: req.validated });
      });
    });

    it('유효한 회원가입 데이터로 통과', async () => {
      const res = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'Test1234',
          passwordConfirm: 'Test1234',
          name: '테스트',
          phone: '01012345678',
          agreeTerms: true,
          agreePrivacy: true,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.body.email).toBe('test@example.com');
    });

    it('잘못된 이메일 형식으로 400 반환', async () => {
      const res = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          password: 'Test1234',
          passwordConfirm: 'Test1234',
          name: '테스트',
          phone: '01012345678',
          agreeTerms: true,
          agreePrivacy: true,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email', code: 'invalid_format' }),
        ])
      );
    });

    it('비밀번호 미확인으로 400 반환', async () => {
      const res = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'Test1234',
          passwordConfirm: 'Different1234',
          name: '테스트',
          phone: '01012345678',
          agreeTerms: true,
          agreePrivacy: true,
        })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'passwordConfirm', code: 'custom' }),
        ])
      );
    });

    it('필수 필드 누락 시 400 반환', async () => {
      const res = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('약한 비밀번호로 400 반환', async () => {
      const res = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'short',
          passwordConfirm: 'short',
          name: '테스트',
          phone: '01012345678',
          agreeTerms: true,
          agreePrivacy: true,
        })
        .expect(400);

      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'password', code: 'too_small' }),
          expect.objectContaining({ field: 'password', code: 'invalid_format' }),
        ])
      );
    });

    it('잘못된 전화번호 형식으로 400 반환', async () => {
      const res = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'Test1234',
          passwordConfirm: 'Test1234',
          name: '테스트',
          phone: '123',
          agreeTerms: true,
          agreePrivacy: true,
        })
        .expect(400);

      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'phone', code: 'invalid_format' }),
        ])
      );
    });
  });

  describe('validateQuery', () => {
    const searchSchema = require('../../src/validation/schemas').storeSearchQuerySchema;

    beforeEach(() => {
      app.get('/search', validateQuery(searchSchema), (req, res) => {
        res.json({ success: true, query: req.validated.query });
      });
    });

    it('유효한 검색 쿼리로 통과', async () => {
      const res = await request(app)
        .get('/search?q=강남&page=1&limit=20')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.query.q).toBe('강남');
    });

    it('page 0으로 400 반환', async () => {
      const res = await request(app)
        .get('/search?page=0')
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'page', code: 'too_small' }),
        ])
      );
    });

    it('limit 100 초과로 400 반환', async () => {
      const res = await request(app)
        .get('/search?limit=101')
        .expect(400);

      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'limit', code: 'too_big' }),
        ])
      );
    });
  });

  describe('validateParams', () => {
    const idSchema = require('../../src/validation/schemas').storeIdParamSchema;

    beforeEach(() => {
      app.get('/stores/:id', validateParams(idSchema), (req, res) => {
        res.json({ success: true, params: req.validated.params });
      });
    });

    it('유효한 ID로 통과', async () => {
      const res = await request(app)
        .get('/stores/123')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.params.id).toBe(123);
    });

    it('숫자가 아닌 ID로 400 반환', async () => {
      const res = await request(app)
        .get('/stores/abc')
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'id', code: 'invalid_format' }),
        ])
      );
    });
  });

  describe('로그인 스키마', () => {
    beforeEach(() => {
      app.post('/login', validateBody(loginSchema), (req, res) => {
        res.json({ success: true });
      });
    });

    it('유효한 로그인 데이터로 통과', async () => {
      await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);
    });

    it('이메일 누락 시 400', async () => {
      await request(app)
        .post('/login')
        .send({ password: 'password123' })
        .expect(400);
    });

    it('비밀번호 누락 시 400', async () => {
      await request(app)
        .post('/login')
        .send({ email: 'test@example.com' })
        .expect(400);
    });
  });
});