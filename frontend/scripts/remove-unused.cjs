const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const SRC_DIR = path.resolve(__dirname, '..', 'src');

let eslintData = {};
try {
  const out = execSync('npx eslint src --format json', {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const reports = JSON.parse(out);
  for (const f of reports) {
    const matched = f.messages.filter((m) => m.ruleId === 'no-unused-vars');
    if (matched.length) {
      const names = [];
      for (const m of matched) {
        const s = m.suggestions && m.suggestions[0];
        const varName =
          (s && s.data && s.data.varName) ||
          m.name ||
          (m.message.match(/'([^']+)' is/) || [])[1];
        if (varName && !names.includes(varName)) names.push(varName);
      }
      eslintData[f.filePath] = names;
    }
  }
} catch (e) {
  console.error('ESLint 수집 실패:', e.message);
  process.exit(1);
}
console.log(`eslintData 키 수: ${Object.keys(eslintData).length}`);

let removedExtensions = 0;
let removedCatchRenames = 0;
let processedFiles = 0;

/**
 * 주어진 소스를 파싱해 unused import 멤버와 catch param를 안전하게 정리한다.
 * 반환: [정리된 코드|null, 제거된 멤버 수]
 */
function cleanSource(source, unusedNames) {
  let ast;
  try {
    ast = parser.parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'topLevelAwait'],
    });
  } catch {
    return { code: null, removed: 0, renamed: 0 };
  }

  const unused = new Set(unusedNames || []);
  let removed = 0;
  let renamed = 0;
  let changed = false;

  traverse(ast, {
    ImportDeclaration(p) {
      const specifiers = [...p.node.specifiers];
      const kept = specifiers.filter((s) => {
        const name =
          t.isImportNamespaceSpecifier(s) || t.isImportSpecifier(s) || t.isImportDefaultSpecifier(s)
            ? s.local.name
            : null;
        return name ? !unused.has(name) : true;
      });
      if (kept.length !== specifiers.length) {
        removed += specifiers.length - kept.length;
        if (kept.length === 0) {
          p.remove();
        } else {
          p.node.specifiers = kept;
        }
        changed = true;
      }
    },
    CatchClause(path) {
      const p = path.node.param;
      if (p && t.isIdentifier(p) && unused.has(p.name) && !p.name.startsWith('_')) {
        p.name = '_' + p.name;
        renamed++;
        changed = true;
      }
    },
    // 변수명(variable/arg) unused 제거는 코드 동작에 영향이 큰 케이스가 있어 보수적으로 건너뜀
  });

  if (!changed) return { code: null, removed: 0, renamed: 0 };

  const code = generate(ast, { comments: true, retainLines: false }).code;
  return { code: code + '\n', removed, renamed };
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full);
    } else if (/\.(jsx|js)m?$/.test(entry.name)) {
      if (!eslintData[full]) continue;
      const source = fs.readFileSync(full, 'utf8');
      const { code, removed, renamed } = cleanSource(source, eslintData[full]);
      if (code) {
        fs.writeFileSync(full, code);
        removedExtensions += removed;
        removedCatchRenames += renamed;
        processedFiles++;
        console.log(`[FIX] ${full} (import -${removed}, catch rename ${renamed})`);
      }
    }
  }
}

walk(SRC_DIR);
console.log(`\n완료: ${processedFiles}개 파일, import ${removedExtensions}개 제거, catch ${removedCatchRenames}개 renamed`);