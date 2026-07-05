/**
 * imageCompress.js — 업로드 전 클라이언트 이미지 리사이즈·압축
 *
 * 휴대폰 카메라 사진은 보통 4000px 이상, 3~8MB로 매우 크다. 그대로 올리면
 * 업로드가 느리고 서버·트래픽 낭비, 모바일 로딩도 느리다. 업로드 직전에
 * 최대 변을 제한하고 JPEG로 재인코딩해 수백 KB로 줄인다.
 *
 * - EXIF 회전 보정: createImageBitmap({ imageOrientation: 'from-image' })
 *   → 휴대폰 세로 사진이 눕는 문제 방지 (미지원 브라우저는 <img> 폴백)
 * - 실패/미지원 시 원본 파일을 그대로 반환 (업로드 자체는 항상 성공하도록)
 */

const DEFAULTS = { maxDim: 1200, quality: 0.82, mimeType: 'image/jpeg' };

// File → 방향 보정된 비트맵/이미지 소스
async function loadOriented(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* 옵션 미지원 시 아래 폴백 */ }
    try {
      return await createImageBitmap(file);
    } catch { /* 폴백 */ }
  }
  // <img> 폴백 (구형 브라우저)
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/**
 * 이미지 파일을 리사이즈·압축한 File을 반환.
 * @param {File} file 원본 이미지 파일
 * @param {object} opts { maxDim, quality, mimeType }
 * @returns {Promise<{ file: File, width, height, originalSize, size, compressed }>}
 */
export async function compressImage(file, opts = {}) {
  const { maxDim, quality, mimeType } = { ...DEFAULTS, ...opts };

  // 이미지가 아니면 손대지 않음
  if (!file || !file.type?.startsWith('image/')) {
    return { file, width: 0, height: 0, originalSize: file?.size || 0, size: file?.size || 0, compressed: false };
  }
  // GIF(애니메이션)는 canvas로 처리하면 첫 프레임만 남으므로 원본 유지
  if (file.type === 'image/gif') {
    return { file, width: 0, height: 0, originalSize: file.size, size: file.size, compressed: false };
  }

  let src;
  try {
    src = await loadOriented(file);
  } catch {
    return { file, width: 0, height: 0, originalSize: file.size, size: file.size, compressed: false };
  }

  const sw = src.width, sh = src.height;
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = dw; canvas.height = dh;
    const ctx = canvas.getContext('2d');
    // JPEG는 투명도가 없으므로 흰 배경을 깔아 PNG 투명 영역이 검게 나오는 것 방지
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dw, dh);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, dw, dh);
    if (src.close) src.close(); // ImageBitmap 메모리 해제

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
    if (!blob) return { file, width: sw, height: sh, originalSize: file.size, size: file.size, compressed: false };

    // 압축 결과가 원본보다 크면(이미 잘 압축된 작은 파일 등) 원본 유지
    if (blob.size >= file.size && scale === 1) {
      return { file, width: sw, height: sh, originalSize: file.size, size: file.size, compressed: false };
    }

    const ext = mimeType === 'image/jpeg' ? 'jpg' : (mimeType.split('/')[1] || 'jpg');
    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    const out = new File([blob], `${baseName}.${ext}`, { type: mimeType, lastModified: Date.now() });
    return { file: out, width: dw, height: dh, originalSize: file.size, size: out.size, compressed: true };
  } catch {
    return { file, width: sw, height: sh, originalSize: file.size, size: file.size, compressed: false };
  }
}
