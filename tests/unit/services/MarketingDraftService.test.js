const { MarketingDraftService } = require('../../../services/MarketingDraftService');
const facts = {
  store: { id: 3, name: 'QA 매장' },
  products: [{ id: 7, name: 'QA 메뉴', price: 1000 }],
};
const input = { product_ids: [7], channel: 'instagram', tone: 'friendly' };
const enabled = {
  AI_MARKETING_ENABLED: 'true',
  AI_MARKETING_ALLOW_PAID: 'true',
  AI_MARKETING_MODEL: 'fixture',
};
describe('MarketingDraftService draft safety', () => {
  test('creates useful local drafts without a provider and rejects foreign or invalid selections', async () => {
    const service = new MarketingDraftService({ env: {} });
    await expect(service.generate(facts, input)).resolves.toMatchObject({
      source: 'template',
      draft_only: true,
      store_id: 3,
      content: expect.stringContaining('QA 메뉴'),
    });
    await expect(
      service.generate(facts, { ...input, channel: 'poster', tone: 'formal' })
    ).resolves.toMatchObject({ hashtags: [], content: expect.stringContaining('방문해 주세요') });
    for (const changed of [
      { product_ids: [] },
      { product_ids: [99] },
      { product_ids: [7, 7] },
      { product_ids: ['7'] },
      { channel: 'publish' },
      { tone: 'unknown' },
    ]) {
      await expect(service.generate(facts, { ...input, ...changed })).rejects.toMatchObject({
        statusCode: 400,
      });
    }
  });
  test('requires both cost gates and explicit consent before provider use', async () => {
    for (const env of [{}, { AI_MARKETING_ENABLED: 'true' }, { AI_MARKETING_ALLOW_PAID: 'true' }]) {
      await expect(
        new MarketingDraftService({ env }).generate(facts, {
          ...input,
          use_ai: true,
          consent: true,
        })
      ).rejects.toMatchObject({ statusCode: 503 });
    }
    await expect(
      new MarketingDraftService({ env: enabled }).generate(facts, { ...input, use_ai: true })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      new MarketingDraftService({ env: { ...enabled, AI_MARKETING_MODEL: '' } }).generate(facts, {
        ...input,
        use_ai: true,
        consent: true,
      })
    ).rejects.toMatchObject({ statusCode: 503 });
    await expect(
      new MarketingDraftService({ env: enabled }).generate(facts, {
        ...input,
        use_ai: true,
        consent: true,
      })
    ).rejects.toMatchObject({ statusCode: 503 });
  });
  test('uses allowlisted facts only and discards provider execution fields', async () => {
    const client = {
      models: {
        generateContent: async (request) => {
          const data = JSON.parse(request.contents[0].parts[0].text);
          expect(data).toEqual({ facts, channel: 'instagram', tone: 'friendly' });
          return {
            text: JSON.stringify({
              content: '검토용 문구',
              hashtags: ['#QA'],
              publish_url: 'https://invalid.test',
            }),
          };
        },
      },
    };
    const result = await new MarketingDraftService({ env: enabled, client }).generate(facts, {
      ...input,
      use_ai: true,
      consent: true,
      customer_phone: 'DO_NOT_FORWARD',
    });
    expect(result).toMatchObject({
      source: 'gemini',
      draft_only: true,
      content: '검토용 문구',
      hashtags: ['#QA'],
    });
    expect(result).not.toHaveProperty('publish_url');
  });
  test.each([
    'not-json',
    JSON.stringify({ content: '', hashtags: [] }),
    JSON.stringify({ content: 'x', hashtags: ['https://invalid.test'] }),
    JSON.stringify({ content: 'x'.repeat(1501), hashtags: [] }),
  ])('rejects invalid provider output without producing a usable draft: %s', async (text) => {
    const service = new MarketingDraftService({
      env: enabled,
      client: { models: { generateContent: async () => ({ text }) } },
    });
    await expect(
      service.generate(facts, { ...input, use_ai: true, consent: true })
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});
