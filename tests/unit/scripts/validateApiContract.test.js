const { validateApiContract } = require('../../../scripts/validate-api-contract');

describe('validate-api-contract', () => {
  it('핵심 route group과 endpoint가 등록되어 있으면 통과한다', () => {
    expect(validateApiContract()).toEqual([]);
  });

  it('등록되지 않은 endpoint를 감지한다', () => {
    const failures = validateApiContract({
      root: require('path').join(__dirname, '../../fixtures/api-contract-missing'),
    });
    expect(failures).toEqual(
      expect.arrayContaining([expect.stringContaining('missing route file: routes/customers.js')])
    );
  });
});
