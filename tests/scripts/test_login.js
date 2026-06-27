const axios = require('axios');

async function testLogin() {
    try {
        const response = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'superadmin@wemarket.com',
            password: 'super1234'
        });
        console.log('Login Success:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Login Failed:', error.response?.data || error.message);
    }
}

testLogin();
