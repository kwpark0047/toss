const fs = require('fs');
const path = require('path');

function walkSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    const dirent = fs.statSync(dirFile);
    if (dirent.isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.jsx') || dirFile.endsWith('.js')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
}

const files = walkSync(path.join(__dirname, 'frontend/src'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const importRegex = /import\s+({[^}]+})\s+from\s+['"]([^'"]+)['"]/g;
  content = content.replace(importRegex, (match, importsStr, moduleName) => {
    const newImportsStr = importsStr.replace(/\b_([A-Za-z0-9_]+)\b/g, (m, word) => {
      return word;
    });
    if (newImportsStr !== importsStr) {
      changed = true;
    }
    return `import ${newImportsStr} from '${moduleName}'`;
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed imports in', file);
  }
}
