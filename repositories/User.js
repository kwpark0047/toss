const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

/**
 * 사용자 모델 (Prisma 기반)
 * 전체 관리자, 매장 관리자, 직원 등 모든 시스템 사용자의 인증 및 정보를 담당합니다.
 */
const User = {
    // [사용자 생성] — phone 기반 가입 지원 (name, email 선택)
    create: async (data) => {
        const { name, email, password, phone, role = 'user' } = data;

        const hashedPassword = bcrypt.hashSync(password, 10);

        const createData = { password: hashedPassword, role };
        if (name) createData.name = name;
        if (email) {
            const existing = await User.findByEmail(email);
            if (existing) throw new Error('이미 존재하는 이메일입니다.');
            createData.email = email;
        }
        if (phone) createData.phone = phone;

        return await prisma.users.create({ data: createData });
    },

    // [ID로 사용자 조회]
    findById: async (id) => {
        return await prisma.users.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                created_at: true,
                fcm_token: true
            }
        });
    },

    // [이메일로 사용자 조회]
    findByEmail: async (email) => {
        return await prisma.users.findUnique({
            where: { email }
        });
    },

    // [비밀번호 검증 및 로그인]
    verifyUser: async (email, password) => {
        const user = await prisma.users.findUnique({
            where: { email }
        });

        if (!user) return null;

        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) return null;

        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    },

    // [사용자 정보 업데이트]
    update: async (id, data) => {
        const { name, password, role, fcm_token } = data;
        const updateData = {};

        if (name) updateData.name = name;
        if (password) updateData.password = bcrypt.hashSync(password, 10);
        if (role) updateData.role = role;
        if (fcm_token !== undefined) updateData.fcm_token = fcm_token;

        if (Object.keys(updateData).length === 0) return await User.findById(id);

        return await prisma.users.update({
            where: { id: parseInt(id) },
            data: updateData
        });
    },

    // [관리자 초기 생성용 (Internal)]
    createAdmin: async (name, email, hashedPassword) => {
        const result = await prisma.users.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'admin'
            }
        });
        return result.id;
    }
};

module.exports = User;
