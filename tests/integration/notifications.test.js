// Mock the Supabase client before any imports
jest.mock('../../lib/supabase', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    data: [],
    error: null
  };
  return { supabase: mockSupabase };
}, { virtual: true });

const request = require('supertest');
const { app } = require('../../app');

describe('Notifications API', () => {
  const baseUrl = '/api/notifications';

  describe('GET /', () => {
    it('should return an empty array of notifications', async () => {
      const response = await request(app).get(baseUrl);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('POST /mark-read/:id', () => {
    it('should mark a notification as read', async () => {
      const notificationId = 'test-notification-id';
      const response = await request(app).post(`${baseUrl}/mark-read/${notificationId}`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ id: notificationId, read: true });
    });
  });

  describe('POST /mark-all-read', () => {
    it('should mark all notifications as read', async () => {
      const response = await request(app).post(`${baseUrl}/mark-all-read`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ message: 'All notifications marked as read' });
    });
  });

});
