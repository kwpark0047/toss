const prisma = require('../../../config/prisma');

class SocialAccountRepository {
  async findByProvider(provider, providerId) {
    return prisma.social_accounts.findUnique({
      where: { provider_provider_id: { provider, provider_id: providerId } },
      include: { users: true },
    });
  }

  async findByUserId(userId) {
    return prisma.social_accounts.findMany({
      where: { user_id: userId },
    });
  }

  async create(data) {
    return prisma.social_accounts.create({ data });
  }

  async delete(id) {
    return prisma.social_accounts.delete({ where: { id } });
  }
}

module.exports = new SocialAccountRepository();
