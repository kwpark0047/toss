const isAllowedProfileImageUrl = (value, req) => {
  if (value === null) return true;
  if (typeof value !== 'string' || value.length > 2048) return false;

  let candidate;
  try {
    candidate = new URL(value);
  } catch {
    return false;
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
    .split(',')[0]
    .trim();
  const requestOrigin = `${forwardedProto}://${req.get('host')}`;
  const isLocalRequest = ['localhost', '127.0.0.1'].includes(req.hostname);
  const sameApiHost =
    candidate.origin === requestOrigin &&
    candidate.pathname.startsWith('/uploads/') &&
    !candidate.pathname.includes('..') &&
    !candidate.search &&
    !candidate.hash;

  if (
    sameApiHost &&
    (candidate.protocol === 'https:' || (isLocalRequest && candidate.protocol === 'http:'))
  ) {
    return true;
  }

  const storageUrl = process.env.SUPABASE_URL;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';
  if (!storageUrl || candidate.protocol !== 'https:') return false;

  try {
    const storageOrigin = new URL(storageUrl).origin;
    const publicObjectPrefix = `/storage/v1/object/public/${encodeURIComponent(bucket)}/`;
    return candidate.origin === storageOrigin && candidate.pathname.startsWith(publicObjectPrefix);
  } catch {
    return false;
  }
};

module.exports = { isAllowedProfileImageUrl };
