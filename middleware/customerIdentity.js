const { optionalAuth } = require('./auth');
const users = require('../app/lib/repositories/user.repository');
const db = require('../config/prisma');
const { decryptPhone, normalizePhone } = require('../utils/phoneEncryption');

// Request phone/external IDs and order-created history tokens are NOT identity proof.
// Public recommendation remains available if authentication or its lookup is unavailable.
async function customerIdentity(req, res, next) {
  optionalAuth(req, res, async () => {
    req.customerIdentity = null;
    try {
      const storeId = Number(req.body?.store_id || req.params?.storeId);
      if (req.user?.id && Number.isSafeInteger(storeId) && storeId > 0) {
        const user = await users.findUnique(req.user.id);
        const phone = normalizePhone(decryptPhone(user?.phone));
        // Check revocation on the primary, never a potentially stale replica.
        const grant = await db.$transaction((tx) =>
          tx.customer_ai_consents.findUnique({
            where: { store_id_user_id: { store_id: storeId, user_id: req.user.id } },
          })
        );
        if (
          phone.length >= 10 &&
          grant?.verified_at &&
          grant?.consent_at &&
          !grant.revoked_at &&
          normalizePhone(decryptPhone(grant.verified_phone)) === phone
        )
          req.customerIdentity = { phone, userId: user.id, storeId };
      }
    } catch {
      /* No private personalization on lookup failure. */
    }
    next();
  });
}
module.exports = customerIdentity;
