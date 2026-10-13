jest.mock('../../../config/prisma', () => ({}));
jest.mock('../../../services/ProviderCredentialService', () => ({ resolve: jest.fn() }));
jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
const credentials = require('../../../services/ProviderCredentialService'),
  axios = require('axios');
beforeEach(() => {
  jest.clearAllMocks();
  process.env.NODE_ENV = 'production';
});
test('uses encrypted dashboard credentials without Render SMS variables', async () => {
  credentials.resolve.mockResolvedValue({
    values: { api_key: 'test-api-key', api_secret: 'test-api-secret', sender: '01000000000' },
  });
  axios.post.mockResolvedValue({ data: { messageId: 'fixture-message' } });
  const result = await require('../../../utils/smsService').sendSms(
    '01011111111',
    'fixture message'
  );
  expect(result.sent).toBe(true);
  expect(axios.post.mock.calls[0][1].message.from).toBe('01000000000');
});
test('production missing/disabled config is never simulated success', async () => {
  credentials.resolve.mockResolvedValue(null);
  const result = await require('../../../utils/smsService').sendSms('01011111111', 'fixture');
  expect(result.sent).toBe(false);
  expect(result.dev).not.toBe(true);
  expect(axios.post).not.toHaveBeenCalled();
});
test('provider rejected response is never accepted as successful delivery', async () => {
  credentials.resolve.mockResolvedValue({
    values: { api_key: 'fixture-key', api_secret: 'fixture-secret', sender: '01000000000' },
  });
  axios.post.mockResolvedValue({ data: { messageId: 'fixture-rejected', statusCode: '4000' } });
  expect((await require('../../../utils/smsService').sendSms('01011111111', 'fixture')).sent).toBe(
    false
  );
});
