#!/usr/bin/env node
/**
 * Performance Budget Checker
 */
const fs = require('fs');
const path = require('path');
const BUDGET_CONFIG = require('../performance-budget.json');
const DIST_DIR = '/mnt/d/wemarket-toss/250105/frontend/dist';

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

function checkBudgets() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('dist directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const distFiles = fs.readdirSync(DIST_DIR, { recursive: true })
    .filter(f => 
      f.endsWith('.js') || f.endsWith('.css') || 
      f.endsWith('.woff2') || f.endsWith('.png') || 
      f.endsWith('.jpg') || f.endsWith('.webp') || 
      f.endsWith('.avif') || f.endsWith('.svg')
    )
    .map(f => path.join(DIST_DIR, f));

  console.log('\nPerformance Budget Report');
  console.log('='.repeat(40));

  let hasErrors = false;
  let totalSize = 0;

  for (const budget of BUDGET_CONFIG.budgets) {
    for (const sizeBudget of budget.resourceSizes) {
      const type = sizeBudget.resourceType;
      const budgetKb = sizeBudget.budget;
      
      let resourceFiles = [];
      if (type === 'script') resourceFiles = distFiles.filter(f => f.endsWith('.js'));
      else if (type === 'stylesheet') resourceFiles = distFiles.filter(f => f.endsWith('.css'));
      else if (type === 'font') resourceFiles = distFiles.filter(f => f.endsWith('.woff2'));
      else if (type === 'image') resourceFiles = distFiles.filter(f => ['.png','.jpg','.webp','.avif','.svg'].some(ext => f.endsWith(ext)));
      else if (type === 'total') resourceFiles = distFiles;

      const totalBytes = resourceFiles.reduce((sum, f) => sum + getFileSize(f), 0);
      const totalKb = totalBytes / 1024;
      totalSize += totalKb;

      if (totalKb > budgetKb) {
        console.log(`FAIL ${type}: ${formatBytes(totalBytes)} exceeds budget ${budgetKb} KB`);
        process.exitCode = 1;
      } else {
        console.log(`OK ${type}: ${formatBytes(totalBytes)} / ${budgetKb} KB`);
      }
    }
  }

  console.log(`\nTotal: ${formatBytes(totalSize * 1024)}`);
  console.log('\nWeb Vital Thresholds (reference):');
  for (const [metric, threshold] of Object.entries(BUDGET_CONFIG.thresholds)) {
    console.log(`  ${metric}: ${threshold}ms`);
  }

  if (process.exitCode) {
    console.log('\nPerformance budget exceeded!');
    process.exit(1);
  } else {
    console.log('\nAll performance budgets met!');
  }
}

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

checkBudgets();
