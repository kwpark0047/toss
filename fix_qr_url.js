const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/components/admin/TableManager.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(
  /const getMenuUrl = \(table\) =>\s*buildMenuUrl\(storeId,\s*table\.table_number \|\| table\.name \|\| ''\);/g,
  `const getMenuUrl = (table) => table?.qr_code ? buildQrUrl(table.qr_code) : buildMenuUrl(storeId, table.table_number || table.name || '');`
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Replaced in TableManager.jsx');
