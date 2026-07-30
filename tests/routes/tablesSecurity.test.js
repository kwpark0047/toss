const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'tables-route-test-secret';

const mockPrisma = {
    stores: { findUnique: jest.fn() },
    staff: { findFirst: jest.fn() },
    tables: { findMany: jest.fn() }
};
jest.mock('../../config/prisma', () => mockPrisma);

const mockTable = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findById: jest.fn(),
    findByQrCode: jest.fn(),
    findByStoreId: jest.fn(),
    regenerateQr: jest.fn(),
    updateLayout: jest.fn()
};
jest.mock('../../repositories/Table', () => mockTable);

const responseFormatter = require('../../middleware/responseFormatter');

function app() {
    const instance = express();
    instance.use(express.json());
    instance.use(responseFormatter);
    instance.use('/api/tables', require('../../routes/tables'));
    instance.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));
    return instance;
}

const tokenFor = (id, role = 'owner') => jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const OWNER_TOKEN = tokenFor(1);
const OUTSIDER_TOKEN = tokenFor(2);
const ADMIN_TOKEN = tokenFor(99, 'super_admin');

describe('table route tenant authorization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.stores.findUnique.mockResolvedValue({ id: 42, user_id: 1 });
        mockPrisma.staff.findFirst.mockResolvedValue(null);
        mockPrisma.tables.findMany.mockResolvedValue([{ id: 10, store_id: 42 }]);
        mockTable.create.mockResolvedValue({ id: 10, store_id: 42 });
        mockTable.update.mockResolvedValue({ id: 10, store_id: 42 });
        mockTable.findById.mockResolvedValue({ id: 10, store_id: 42 });
        mockTable.updateLayout.mockResolvedValue([{ id: 10, store_id: 42 }]);
    });

    test('생성 시 body store_id에 권한이 없는 사용자를 거부한다', async () => {
        const response = await request(app())
            .post('/api/tables')
            .set('Authorization', `Bearer ${OUTSIDER_TOKEN}`)
            .send({ store_id: 42, table_number: 'A1' });

        expect(response.status).toBe(403);
        expect(mockTable.create).not.toHaveBeenCalled();
    });

    test('생성 시 body store_id의 store:update 권한이 있으면 허용한다', async () => {
        const response = await request(app())
            .post('/api/tables')
            .set('Authorization', `Bearer ${OWNER_TOKEN}`)
            .send({ store_id: 42, table_number: 'A1' });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('테이블이 생성되었습니다.');
        expect(mockTable.create).toHaveBeenCalled();
    });

    test.each([
        ['put', '/api/tables/10', { table_number: 'B1' }, 'update'],
        ['delete', '/api/tables/10', null, 'delete']
    ])('수정과 삭제는 대상 테이블의 저장된 매장으로 권한을 확인한다', async (method, path, body, mutation) => {
        const call = request(app())[method](path).set('Authorization', `Bearer ${OUTSIDER_TOKEN}`);
        const response = body ? await call.send(body) : await call;

        expect(response.status).toBe(403);
        expect(mockPrisma.tables.findMany).toHaveBeenCalledWith({
            where: { id: { in: [10] } },
            select: { id: true, store_id: true }
        });
        expect(mockTable[mutation]).not.toHaveBeenCalled();
    });

    test('super_admin은 대상 테이블 수정 권한을 유지한다', async () => {
        const response = await request(app())
            .put('/api/tables/10')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ table_number: 'B1' });

        expect(response.status).toBe(200);
        expect(mockTable.update).toHaveBeenCalledWith('10', { table_number: 'B1' });
    });

    test('layout 테이블이 URL 매장과 다르면 갱신하지 않는다', async () => {
        mockPrisma.tables.findMany.mockResolvedValue([{ id: 10, store_id: 43 }]);

        const response = await request(app())
            .put('/api/tables/store/42/layout')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ layout: [{ id: 10, x: 1, y: 2 }] });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('모든 테이블은 요청한 매장에 속해야 합니다.');
        expect(mockTable.updateLayout).not.toHaveBeenCalled();
    });

    test('layout의 모든 테이블이 URL 매장 소속이면 갱신한다', async () => {
        const layout = [{ id: 10, x: 1, y: 2 }];
        const response = await request(app())
            .put('/api/tables/store/42/layout')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ layout });

        expect(response.status).toBe(200);
        expect(mockTable.updateLayout).toHaveBeenCalledWith('42', layout);
    });
});
