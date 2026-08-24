/**
 * JSX Reference Validation Tool
 * Detects uppercase JSX tags used without a matching import or local declaration.
 * Guards against partial icon-conversion regressions (import removed before all
 * usages were converted), which previously caused runtime ReferenceErrors.
 *
 * Usage: node scripts/validate-jsx-references.js
 * Exit codes: 0 = clean, 1 = unresolved references found
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '..', 'frontend', 'src');
const EXTENSIONS = new Set(['.jsx', '.tsx', '.js', '.ts']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

// Remove comments so JSDoc examples (e.g. ErrorBoundary.jsx) are not scanned
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

// Identifiers that count as "defined" in a file
function collectDefinedIdentifiers(code) {
  const defined = new Set();

  const patterns = [
    // import Default from / import { A, B as C } from / import * as NS from
    /import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*(?:\*\s+as\s+([A-Za-z_$][\w$]*)\s*)?from/g,
    // function Foo / class Foo
    /\b(?:function|class)\s+([A-Z][A-Za-z0-9]*)/g,
    // const/let/var Foo = (component declarations)
    /\b(?:const|let|var)\s+([A-Z][A-Za-z0-9]*)\s*=/g,
    // require destructuring: const { Foo } = require('...')
    /=\s*require\s*\(\s*['"][^'"]+['"]\s*\)/g,
  ];

  let m;
  while ((m = patterns[0].exec(code)) !== null) {
    if (m[1]) defined.add(m[1]);
    if (m[2]) {
      for (const part of m[2].split(',')) {
        const name = part
          .split(/\s+as\s+/)
          .pop()
          .trim();
        if (/^[A-Z]/.test(name)) defined.add(name);
      }
    }
    if (m[3]) defined.add(m[3]);
  }

  while ((m = patterns[1].exec(code)) !== null) defined.add(m[1]);
  while ((m = patterns[2].exec(code)) !== null) defined.add(m[1]);

  // const { X } = require(...) / const { X } = someNamespace
  const destructureRe = /(?:const|let|var)\s*\{([^}]*)\}\s*=/g;
  while ((m = destructureRe.exec(code)) !== null) {
    for (const part of m[1].split(',')) {
      const name = part
        .split(/\s*:\s*/)
        .pop()
        .split(/\s*=\s*/)[0]
        .trim();
      if (/^[A-Z][A-Za-z0-9]*$/.test(name)) defined.add(name);
    }
  }

  return defined;
}

// Uppercase JSX opening tags with safe boundaries:
// - previous non-space char must not be word/closing bracket/dot/quote (rules out comparisons)
// - tag must be followed by whitespace+attr-ish token, '>' or '/>'
function findJsxTags(code) {
  const tags = [];
  const re = /<([A-Z][A-Za-z0-9]*)(?=[\s/>])/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const idx = m.index;
    const prev = code.slice(Math.max(0, idx - 1), idx);
    if (idx > 0 && /[\w$.>)\]'"]/.test(prev)) continue; // comparison like `a <B` or `x)<Y`
    const line = code.slice(0, idx).split('\n').length;
    tags.push({ name: m[1], line });
  }
  return tags;
}

function main() {
  const files = walk(FRONTEND_SRC);
  const violations = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const code = stripComments(raw);
    if (!/<[A-Z]/.test(code)) continue;

    const defined = collectDefinedIdentifiers(code);
    for (const tag of findJsxTags(code)) {
      if (!defined.has(tag.name)) {
        violations.push({
          file: path.relative(process.cwd(), file),
          line: tag.line,
          name: tag.name,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log(`OK: ${files.length} files scanned, no unresolved JSX references`);
    process.exit(0);
  }

  console.error(`FAIL: ${violations.length} unresolved JSX reference(s):\n`);
  for (const v of violations) console.error(`  ${v.file}:${v.line}  <${v.name}>`);
  console.error('\nHint: add the missing import (lucide-react / ui/Icon) or convert the usage.');
  process.exit(1);
}

main();
