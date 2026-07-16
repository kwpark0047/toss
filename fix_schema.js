const fs = require('fs');
const file = 'prisma/schema.prisma';
let data = fs.readFileSync(file, 'utf8');
data = data.replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  previewFeatures = ["multiSchema"]');
data = data.replace('directUrl = env("DIRECT_URL")', 'directUrl = env("DIRECT_URL")\n  schemas = ["public", "auth"]');
fs.writeFileSync(file, data);
