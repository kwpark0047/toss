const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { AppError } = require('./errorHandler');
const base = path.resolve(__dirname, '../private/payment-proofs');
const validKey = (key) => typeof key === 'string' && /^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(key);
function imageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16)
    throw new AppError('유효한 이미지 파일이 필요합니다.', 400);
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
    return 'webp';
  throw new AppError('PNG, JPEG, WebP 증빙만 업로드할 수 있습니다.', 400);
}
async function remote() {
  const { createClient } = require('@supabase/supabase-js');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new AppError('비공개 저장소 설정이 필요합니다.', 503);
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = process.env.SUPABASE_PRIVATE_BUCKET || 'payment-proofs';
  const { data, error } = await client.storage.getBucket(bucket);
  if (error || !data || data.public)
    throw new AppError('결제 증빙 저장소는 비공개 버킷이어야 합니다.', 503);
  return { client, bucket };
}
async function save(buffer) {
  const ext = imageType(buffer);
  const key = `${crypto.randomUUID()}.${ext}`;
  if (process.env.STORAGE_DRIVER === 'supabase') {
    const { client, bucket } = await remote();
    const { error } = await client.storage
      .from(bucket)
      .upload(key, buffer, {
        contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
        upsert: false,
      });
    if (error) throw new AppError('증빙 저장에 실패했습니다.', 503);
  } else {
    if (process.env.NODE_ENV === 'production')
      throw new AppError('운영 결제 증빙은 비공개 원격 저장소가 필요합니다.', 503);
    await fs.promises.mkdir(base, { recursive: true });
    await fs.promises.writeFile(path.join(base, key), buffer, { flag: 'wx' });
  }
  return key;
}
async function access(key) {
  if (!validKey(key)) throw new AppError('비공개 증빙 키가 유효하지 않습니다.', 404);
  if (process.env.STORAGE_DRIVER === 'supabase') {
    const { client, bucket } = await remote();
    const { data, error } = await client.storage.from(bucket).createSignedUrl(key, 60);
    if (error || !data?.signedUrl) throw new AppError('증빙을 조회할 수 없습니다.', 404);
    return { url: data.signedUrl };
  }
  return { path: path.join(base, key) };
}
module.exports = { save, access, imageType };
