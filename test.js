const prisma = require('./config/prisma'); prisma.tables.findMany({take:2}).then(console.log).finally(() => process.exit(0));
