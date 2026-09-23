beforeAll(async () => {
  await import('../../app');
});

describe('repro', () => {
  it('trivial', () => {
    expect(1).toBe(1);
  });
});
