const { imageType, access } = require('../../../utils/privateProofStorage');
test('SVG and executable payloads are rejected despite an image MIME type', () => {
  expect(() => imageType(Buffer.from('<svg onload="alert(1)"></svg>'))).toThrow();
  expect(() => imageType(Buffer.from('MZ executable image spoof'))).toThrow();
});
test('PNG signatures are accepted', () => {
  expect(
    imageType(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(20)]))
  ).toBe('png');
});
test('proof identifiers cannot escape the private directory', async () => {
  await expect(access('../../.env')).rejects.toThrow();
});
