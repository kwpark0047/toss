const fs = require('fs');
let code = fs.readFileSync('services/aiService.js', 'utf-8');

const t2 = '[\n        { "id": 메뉴ID, "reason": "이유를 작성해주세요" },\n        ...\n      ]';
const rep = '[\n        { "id": 1, "reason": "이유" }\n      ]';

code = code.split(t2).join(rep);

fs.writeFileSync('services/aiService.js', code);
