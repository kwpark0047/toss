const ApiClient = require('../lib/client');

// Mock global fetch
global.fetch = jest.fn();

describe('ApiClient', () => {
    let client;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new ApiClient({
            baseUrl: 'https://backend.example.com',
            apiKey: 'test-api-key-123',
            storeId: '42'
        });
    });

    test('strips trailing slash from baseUrl', () => {
        const c = new ApiClient({ baseUrl: 'https://example.com/', apiKey: 'k', storeId: '1' });
        expect(c.baseUrl).toBe('https://example.com');
    });

    describe('fetchPendingJobs', () => {
        test('returns jobs from data field', async () => {
            const mockJobs = [{ id: 1, payload_b64: 'abc' }, { id: 2, payload_b64: 'def' }];
            fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ data: mockJobs })
            });

            const jobs = await client.fetchPendingJobs();

            expect(jobs).toEqual(mockJobs);
            expect(fetch).toHaveBeenCalledWith(
                'https://backend.example.com/api/print-jobs/pending?store_id=42',
                {
                    headers: {
                        'Authorization': 'Bearer test-api-key-123',
                        'Content-Type': 'application/json'
                    }
                }
            );
        });

        test('falls back to jobs field', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ jobs: [{ id: 3 }] })
            });

            const jobs = await client.fetchPendingJobs();
            expect(jobs).toEqual([{ id: 3 }]);
        });

        test('returns empty array when no data or jobs', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            const jobs = await client.fetchPendingJobs();
            expect(jobs).toEqual([]);
        });

        test('throws on non-ok response', async () => {
            fetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error'
            });

            await expect(client.fetchPendingJobs()).rejects.toThrow('API 500: Internal Server Error');
        });
    });

    describe('claimJob', () => {
        test('sends PATCH to claim endpoint', async () => {
            fetch.mockResolvedValue({ ok: true });

            const result = await client.claimJob(42);

            expect(result).toBe(true);
            expect(fetch).toHaveBeenCalledWith(
                'https://backend.example.com/api/print-jobs/42/claim',
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': 'Bearer test-api-key-123',
                        'Content-Type': 'application/json'
                    }
                }
            );
        });

        test('throws on failure', async () => {
            fetch.mockResolvedValue({ ok: false, status: 409 });

            await expect(client.claimJob(42)).rejects.toThrow('Claim failed: 409');
        });
    });

    describe('completeJob', () => {
        test('sends PATCH to complete endpoint', async () => {
            fetch.mockResolvedValue({ ok: true });

            const result = await client.completeJob(42);
            expect(result).toBe(true);
            expect(fetch).toHaveBeenCalledWith(
                'https://backend.example.com/api/print-jobs/42/complete',
                expect.objectContaining({ method: 'PATCH' })
            );
        });

        test('throws on failure', async () => {
            fetch.mockResolvedValue({ ok: false, status: 404 });
            await expect(client.completeJob(42)).rejects.toThrow('Complete failed: 404');
        });
    });

    describe('failJob', () => {
        test('sends PATCH with error body', async () => {
            fetch.mockResolvedValue({ ok: true });

            const result = await client.failJob(42, 'Printer offline');
            expect(result).toBe(true);
            expect(fetch).toHaveBeenCalledWith(
                'https://backend.example.com/api/print-jobs/42/fail',
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': 'Bearer test-api-key-123',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'Printer offline' })
                }
            );
        });

        test('throws on failure', async () => {
            fetch.mockResolvedValue({ ok: false, status: 500 });
            await expect(client.failJob(42, 'err')).rejects.toThrow('Fail report failed: 500');
        });
    });
});
