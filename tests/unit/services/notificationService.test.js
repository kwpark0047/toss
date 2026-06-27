// Mock Supabase before any imports
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    data: null,
    error: null
  }
}));

const notificationService = require('../../../services/notificationService');
const { supabase } = require('../../../lib/supabase');

describe('Notification Service', () => {
  it('should call saveFCMToken and return success', async () => {
    const mockData = { user_id: 'user123', fcm_token: 'test-token' };
    supabase.from().insert().single.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await notificationService.saveFCMToken('user123', 'test-token');
    
    expect(result).toEqual({ success: true });
  });
});
