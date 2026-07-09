const prisma = require('../../config/prisma');

class UserRepository {
  async findUnique(id) {
    return prisma.users.findUnique({ where: { id } });
  }

  async findByEmail(email) {
    return prisma.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
  }

  async findByPhone(encryptedPhoneCandidates) {
    return prisma.users.findFirst({
      where: { phone: { in: encryptedPhoneCandidates } },
    });
  }

  async create(data) {
    return prisma.users.create({ data });
  }

  async update(id, data) {
    return prisma.users.update({ where: { id }, data });
  }
}

module.exports = new UserRepository();
