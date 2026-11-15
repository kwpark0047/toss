export function initialMenuDraft(draft = {}) {
  return {
    name: String(draft.name || '').slice(0, 80),
    description: String(draft.description || '').slice(0, 600),
    category_name: String(draft.category_name || '').slice(0, 80),
    ingredient_review: String(draft.ingredient_review || '').slice(0, 600),
    marketing_copy: String(draft.marketing_copy || '').slice(0, 300),
    image_description: String(draft.image_description || '').slice(0, 300),
    price: '',
    allergens: '',
    image_url: '',
  };
}
export function menuDraftApproved(form, review) {
  return (
    /^\d+$/.test(String(form.price)) &&
    Number.isSafeInteger(Number(form.price)) &&
    Number(form.price) <= 100000000 &&
    review.price === true &&
    review.allergens === true &&
    review.approve === true &&
    (!!String(form.allergens || '').trim() || review.none === true)
  );
}
export async function prepareMenuPhoto(file) {
  if (
    !file ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error('5MB 이하 JPG·PNG·WEBP 사진을 선택해 주세요.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.4]) {
      const url = canvas.toDataURL('image/jpeg', quality);
      if (atob(url.split(',')[1]).length <= 524288) return url;
    }
    throw Error('사진이 큽니다. 메뉴별로 나누어 촬영해 주세요.');
  } finally {
    bitmap.close();
  }
}
