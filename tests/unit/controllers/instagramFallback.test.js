jest.mock('../../../services/aiService');
jest.mock('../../../utils/catchAsync', () => (fn) => fn);
const ai = require('../../../controllers/aiController');
const service = require('../../../services/aiService');
test('legacy instagram path returns a local review draft without an unbudgeted paid call', async () => {
  const res = { json: jest.fn() };
  await ai.generateInstagramCopy({ body: { name: 'QA 메뉴' } }, res);
  expect(service.generateInstagramCopy).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      draft_only: true,
      source: 'template',
      instagramCopy: expect.stringContaining('QA 메뉴'),
    })
  );
});
