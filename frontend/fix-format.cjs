const fs = require('fs');

fs.writeFileSync('src/utils/fileUtils.js', `export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}`, 'utf8');

let content = fs.readFileSync('src/components/admin/ProductModal.jsx', 'utf8');
content = content.replace(/import \{ ImagePreview, formatFileSize \} from '.\/ImagePreview';/, "import { ImagePreview } from './ImagePreview';\nimport { formatFileSize } from '../../utils/fileUtils';");
fs.writeFileSync('src/components/admin/ProductModal.jsx', content, 'utf8');

let content2 = fs.readFileSync('src/components/admin/ImagePreview.jsx', 'utf8');
content2 = "import { formatFileSize } from '../../utils/fileUtils';\n" + content2;
fs.writeFileSync('src/components/admin/ImagePreview.jsx', content2, 'utf8');

console.log('Fixed ProductModal and ImagePreview');
