const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// 설정
const STORE_ID = 1;
const BASE_URL = 'http://localhost:3002'; // 미니앱 URL (배포 시 변경)
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'qrcodes');

// 테이블 목록
const tables = [
  { id: 1, name: '테이블 1' },
  { id: 2, name: '테이블 2' },
  { id: 3, name: '테이블 3' },
  { id: 4, name: '테이블 4' },
  { id: 5, name: '테이블 5' },
  { id: 6, name: '테이블 6' },
  { id: 7, name: '테이블 7' },
  { id: 8, name: '테이블 8' },
  { id: 9, name: '테이블 9' },
  { id: 10, name: '테이블 10' }
];

// 출력 폴더 생성
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateQRCodes() {
  console.log('QR코드 생성 시작...\n');

  for (const table of tables) {
    const url = `${BASE_URL}/?store_id=${STORE_ID}&table_id=${table.id}`;
    const filename = `table-${table.id}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);

    try {
      await QRCode.toFile(filepath, url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      console.log(`✓ ${table.name}: ${filename}`);
      console.log(`  URL: ${url}\n`);
    } catch (err) {
      console.error(`✗ ${table.name} 생성 실패:`, err.message);
    }
  }

  // HTML 미리보기 페이지 생성
  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>테이블 QR코드 - 위마켓 카페</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    h1 { text-align: center; margin-bottom: 30px; color: #333; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; max-width: 1200px; margin: 0 auto; }
    .card { background: white; border-radius: 16px; padding: 20px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .card img { width: 200px; height: 200px; margin-bottom: 15px; }
    .card h3 { font-size: 18px; color: #333; margin-bottom: 8px; }
    .card p { font-size: 12px; color: #666; word-break: break-all; }
    .print-btn { display: block; margin: 30px auto; padding: 15px 30px; font-size: 16px; background: #4f46e5; color: white; border: none; border-radius: 10px; cursor: pointer; }
    .print-btn:hover { background: #4338ca; }
    @media print {
      .print-btn { display: none; }
      .card { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>위마켓 카페 - 테이블 QR코드</h1>
  <button class="print-btn" onclick="window.print()">인쇄하기</button>
  <div class="grid">
${tables.map(t => `    <div class="card">
      <img src="table-${t.id}.png" alt="${t.name} QR코드">
      <h3>${t.name}</h3>
      <p>${BASE_URL}/?store_id=${STORE_ID}&table_id=${t.id}</p>
    </div>`).join('\n')}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), htmlContent, 'utf8');
  console.log('✓ QR코드 미리보기 페이지: qrcodes/index.html\n');
  console.log(`총 ${tables.length}개의 QR코드가 생성되었습니다.`);
  console.log(`저장 위치: ${OUTPUT_DIR}`);
}

generateQRCodes();
