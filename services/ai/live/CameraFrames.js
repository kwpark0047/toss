function jpegSize(data, { maxBytes = 16384, maxWidth = 320, maxHeight = 240 } = {}) {
  if (
    typeof data !== 'string' ||
    data.length > Math.ceil(maxBytes / 3) * 4 ||
    data.length % 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data)
  )
    throw Error('Invalid camera frame');
  const bytes = Buffer.from(data, 'base64');
  if (
    bytes.length > maxBytes ||
    bytes.length < 20 ||
    bytes.readUInt16BE(0) !== 0xffd8 ||
    bytes.readUInt16BE(bytes.length - 2) !== 0xffd9
  )
    throw Error('Invalid JPEG');
  let offset = 2,
    size,
    tables = 0;
  while (offset < bytes.length - 2) {
    if (bytes[offset] !== 255) throw Error('Invalid JPEG marker');
    const marker = bytes[offset + 1],
      length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length - 2) throw Error('Invalid JPEG segment');
    if (marker === 0xe1 || (marker >= 0xe3 && marker <= 0xef) || marker === 0xfe)
      throw Error('JPEG metadata forbidden');
    if (
      marker === 0xe2 &&
      (length > 4096 || bytes.subarray(offset + 4, offset + 16).toString() !== 'ICC_PROFILE\0')
    )
      throw Error('JPEG metadata forbidden');
    if (marker === 0xdb || marker === 0xc4) tables++;
    if (marker === 0xc0) {
      if (length < 11 || bytes[offset + 4] !== 8) throw Error('Invalid JPEG dimensions');
      size = { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      if (size.width < 1 || size.height < 1 || size.width > maxWidth || size.height > maxHeight)
        throw Error('JPEG dimensions limit');
    }
    if (marker === 0xda) {
      if (!size || tables < 2) throw Error('Incomplete JPEG');
      for (let i = offset + 2 + length; i < bytes.length - 2; i++)
        if (bytes[i] === 255) {
          const next = bytes[++i];
          if (next !== 0 && !(next >= 0xd0 && next <= 0xd7)) throw Error('Invalid JPEG scan');
        }
      return size;
    }
    offset += 2 + length;
  }
  throw Error('Incomplete JPEG');
}
class CameraFrames {
  constructor(allowed, clock = Date.now) {
    this.allowed = allowed === true;
    this.clock = clock;
    this.enabled = false;
    this.count = 0;
    this.last = -Infinity;
  }
  consent(enabled) {
    if (enabled !== true && enabled !== false) throw Error('Camera consent required');
    if (enabled && !this.allowed) throw Error('Camera unavailable');
    this.enabled = enabled;
  }
  accept(data) {
    if (!this.enabled) throw Error('Camera consent required');
    if (this.count >= 30) throw Error('Camera frame limit');
    const now = this.clock();
    if (now - this.last < 1000) throw Error('Camera frame rate');
    const size = jpegSize(data);
    this.last = now;
    this.count++;
    return size;
  }
}
module.exports = { CameraFrames, jpegSize };
