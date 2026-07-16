import fs from 'fs';
import { execSync } from 'child_process';

let output = '';
try {
  output = execSync('npx eslint . -f json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (e) {
  output = e.stdout;
}

if (!output || !output.startsWith('[')) {
    console.log("Not JSON:", output.substring(0, 100));
    process.exit(1);
}

let results;
try {
  results = JSON.parse(output);
} catch(e) {
  console.log('Failed to parse json');
  process.exit(1);
}

let fixCount = 0;

for (const result of results) {
  let content = fs.readFileSync(result.filePath, 'utf8');
  let lines = content.split('\n');
  
  // Sort messages in descending order of line/column to avoid messing up offsets
  const messages = result.messages
    .filter(m => m.ruleId === 'no-unused-vars')
    .sort((a, b) => {
      if (a.line !== b.line) return b.line - a.line;
      return b.column - a.column;
    });

  let fileChanged = false;

  for (const msg of messages) {
    const match = msg.message.match(/'([^']+)' is (defined|assigned a value) but never used/);
    if (!match) continue;
    const varName = match[1];
    const lineIndex = msg.line - 1;
    let line = lines[lineIndex];

    if (line.includes('import ') && line.includes('{') && line.includes('}')) {
      const regex = new RegExp('(\\s*,?\\s*' + varName + '\\s*,?\\s*)');
      line = line.replace(regex, (m) => {
         if (m.startsWith(',') && m.endsWith(',')) return ', ';
         if (m.startsWith(',')) return '';
         if (m.endsWith(',')) return '';
         return '';
      });
      line = line.replace(/,\s*}/, ' }').replace(/{\s*,/, '{ ').replace(/{\s*}/, '');
      if (line.trim().startsWith('import') && !line.includes('{') && !line.match(/import\s+[A-Za-z0-9_]+\s+from/)) {
        line = '';
      }
      lines[lineIndex] = line;
      fileChanged = true;
      fixCount++;
    } else {
        const regex = new RegExp('\\b' + varName + '\\b');
        lines[lineIndex] = line.replace(regex, '_' + varName);
        fileChanged = true;
        fixCount++;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(result.filePath, lines.join('\n'), 'utf8');
  }
}
console.log('Fixed ' + fixCount + ' unused vars');