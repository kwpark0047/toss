// Inspect real production output; this is a download budget, not a simulated timing score.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../frontend/dist');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+\.(?:js|css))"/g)].map(m => m[1]);
const initial = [...new Set(assets)].map(url => {
  const body = fs.readFileSync(path.join(root, url));
  return { url, bytes: body.length, gzip: zlib.gzipSync(body).length };
});
const gzipBytes = initial.reduce((sum, item) => sum + item.gzip, 0);
console.log(JSON.stringify({ initial, gzipBytes }, null, 2));
assert(gzipBytes < 300_000, 'Initial JS + CSS must stay below 300 KB gzip');
const icons = initial.find(item => item.url.includes('vendor-icons'));
assert(!icons || icons.bytes < 180_000, 'Do not bundle the entire icon catalogue at startup');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
assert(!/url:"assets\/(?:AIStoreManager|MenuManager|MenuBuilder|jspdf|xlsx)-/.test(sw), 'Unvisited routes and export libraries must not be precached');
