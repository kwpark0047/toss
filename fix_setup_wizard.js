const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/components/admin/StoreSetupWizard.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Ensure import for buildQrUrl and buildMenuUrl
if (!content.includes("from '../../utils/site'")) {
  content = content.replace(
    /import \{ getSocket \} from '\.\.\/\.\.\/utils\/socket';/,
    `import { getSocket } from '../../utils/socket';\nimport { buildMenuUrl, buildQrUrl } from '../../utils/site';`
  );
}

// if getSocket doesn't exist, just add it after react imports
if (!content.includes("from '../../utils/site'")) {
    content = content.replace(
        /import React, \{ useState, useEffect \} from 'react';/,
        `import React, { useState, useEffect } from 'react';\nimport { buildMenuUrl, buildQrUrl } from '../../utils/site';`
    );
}


content = content.replace(
  /const getMenuUrl = \(table\) =>\s*`\$\{window\.location\.origin\}\/menu\/\$\{createdStore\?\.id\}\?table=\$\{encodeURIComponent\(table\.table_number \|\| ''\)\}`;/g,
  `const getMenuUrl = (table) => table?.qr_code ? buildQrUrl(table.qr_code) : buildMenuUrl(createdStore?.id, table.table_number || '');`
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Replaced in StoreSetupWizard.jsx');
