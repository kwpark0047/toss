#!/usr/bin/env node
/**
 * Performance Budget Checker (M-5 개정판)
 *
 * [변경 이유]
 *  1. DIST_DIR 이 개발자 머신의 절대경로로 하드코딩되어 CI 에서 항상 실패/오탐이었다.
 *  2. 기존 script 예산 4000KB 는 "모든 청크의 합"을 재는 값이라 사실상 게이트가 아니었다.
 *     실제 사용자 체감(LCP)에 영향을 주는 것은 **초기 로드 청크**이므로,
 *     entry(index-*.js) + 정적 vendor 청크만 따로 재는 initial 예산을 추가했다.
 *     lazy 청크(라우트 분할, 동적 import)는 total 예산으로만 관리한다.
 */
const fs = require('fs');
const path = require('path');

const BUDGET_CONFIG = require('../performance-budget.json');
const DIST_DIR = path.resolve(__dirname, '../dist');

const ASSET_EXTENSIONS = ['.js', '.css', '.woff2', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg'];

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function listAssets(dir) {
  return fs
    .readdirSync(dir, { recursive: true })
    .filter(f => ASSET_EXTENSIONS.some(ext => String(f).endsWith(ext)))
    .map(f => path.join(dir, f))
    .filter(f => fs.statSync(f).isFile());
}

function sizeOf(files) {
  return files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
}

/**
 * 초기 로드에 포함되는 자산을 추린다.
 *  - index.html 이 <script src> / <link href> 로 직접 참조하는 파일
 *  - 그리고 그것이 정적으로 import 하는 vendor-* 청크
 * (정확한 그래프 분석 대신 index.html 참조 + modulepreload 를 사용한다)
 */
function collectInitialAssets(dir) {
  const htmlPath = path.join(dir, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;

  const html = fs.readFileSync(htmlPath, 'utf8');
  const refs = new Set();

  // <script type="module" src="/assets/x.js">, <link rel="modulepreload" href=...>,
  // <link rel="stylesheet" href=...>
  const re = /(?:src|href)="(\/[^"]+\.(?:js|css))"/g;
  for (const m of html.matchAll(re)) {
    refs.add(m[1].replace(/^\//, ''));
  }

  return [...refs]
    .map(rel => path.join(dir, rel))
    .filter(p => fs.existsSync(p));
}

function checkBudgets() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`dist directory not found at ${DIST_DIR}. Run "npm run build" first.`);
    process.exit(1);
  }

  const distFiles = listAssets(DIST_DIR);

  console.log('\nPerformance Budget Report');
  console.log(`dist: ${DIST_DIR}`);
  console.log('='.repeat(60));

  let failed = false;

  const byType = {
    script: distFiles.filter(f => f.endsWith('.js')),
    stylesheet: distFiles.filter(f => f.endsWith('.css')),
    font: distFiles.filter(f => f.endsWith('.woff2')),
    image: distFiles.filter(f => ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg'].some(e => f.endsWith(e))),
    total: distFiles,
  };

  const initialAssets = collectInitialAssets(DIST_DIR);
  if (initialAssets) {
    byType.initial = initialAssets;
  }

  for (const budget of BUDGET_CONFIG.budgets) {
    for (const { resourceType, budget: budgetKb } of budget.resourceSizes) {
      const files = byType[resourceType];
      if (!files) {
        console.log(`SKIP ${resourceType}: 측정 대상 없음`);
        continue;
      }
      const bytes = sizeOf(files);
      const kb = bytes / 1024;

      if (kb > budgetKb) {
        console.log(`FAIL ${resourceType.padEnd(11)} ${formatKb(bytes).padStart(10)} > ${budgetKb} KB`);
        failed = true;
      } else {
        console.log(`OK   ${resourceType.padEnd(11)} ${formatKb(bytes).padStart(10)} / ${budgetKb} KB`);
      }
    }
  }

  // 개별 청크 상위 목록 — 회귀 원인 파악용
  const largest = [...byType.script]
    .map(f => ({ f: path.basename(f), size: fs.statSync(f).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 8);

  console.log('\nLargest JS chunks:');
  for (const { f, size } of largest) {
    console.log(`  ${formatKb(size).padStart(10)}  ${f}`);
  }

  console.log('\nWeb Vital Thresholds (reference):');
  for (const [metric, threshold] of Object.entries(BUDGET_CONFIG.thresholds)) {
    console.log(`  ${metric}: ${threshold}${metric === 'CLS' ? '' : 'ms'}`);
  }

  if (failed) {
    console.log('\nPerformance budget exceeded.');
    process.exit(1);
  }
  console.log('\nAll performance budgets met.');
}

checkBudgets();
