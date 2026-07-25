const QRCode = require('qrcode');
const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// 한글 폰트 등록
registerFont('C:/Windows/Fonts/malgun.ttf', { family: 'Malgun Gothic' });
registerFont('C:/Windows/Fonts/malgunbd.ttf', { family: 'Malgun Gothic', weight: 'bold' });

// 설정
const STORE_ID = 1;
const STORE_NAME = '위마켓 카페';
const BASE_URL = 'http://localhost:3002';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'qrcodes');

// 디자인 설정
const CONFIG = {
  size: 400,
  margin: 40,
  qrSize: 240,
  dotStyle: 'rounded', // rounded, square, dots
  primaryColor: '#4f46e5', // 인디고 (브랜드 컬러)
  secondaryColor: '#7c3aed', // 바이올렛
  backgroundColor: '#ffffff',
  frameColor: '#f8fafc',
  textColor: '#1e293b'
};

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

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 둥근 사각형 그리기
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// 그라디언트 생성
function createGradient(ctx, x, y, size) {
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, CONFIG.primaryColor);
  gradient.addColorStop(1, CONFIG.secondaryColor);
  return gradient;
}

// 커스텀 QR 코드 그리기
function drawCustomQR(ctx, qrData, x, y, size) {
  const moduleCount = qrData.modules.size;
  const moduleSize = size / moduleCount;
  const dotRadius = moduleSize * 0.4;

  const gradient = createGradient(ctx, x, y, size);

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qrData.modules.get(row, col)) {
        const px = x + col * moduleSize;
        const py = y + row * moduleSize;
        const centerX = px + moduleSize / 2;
        const centerY = py + moduleSize / 2;

        // 파인더 패턴 (모서리 큰 사각형) 체크
        const isFinderPattern =
          (row < 7 && col < 7) ||
          (row < 7 && col >= moduleCount - 7) ||
          (row >= moduleCount - 7 && col < 7);

        ctx.fillStyle = gradient;

        if (isFinderPattern) {
          // 파인더 패턴은 사각형으로
          const padding = moduleSize * 0.1;
          roundRect(ctx, px + padding, py + padding, moduleSize - padding * 2, moduleSize - padding * 2, moduleSize * 0.15);
          ctx.fill();
        } else {
          // 일반 모듈은 둥근 점으로
          ctx.beginPath();
          ctx.arc(centerX, centerY, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

// 중앙 로고 그리기
function drawCenterLogo(ctx, centerX, centerY) {
  const logoSize = 50;
  const logoRadius = logoSize / 2;

  // 흰색 배경 원
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(centerX, centerY, logoRadius + 8, 0, Math.PI * 2);
  ctx.fill();

  // 그라디언트 원
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, logoRadius);
  gradient.addColorStop(0, CONFIG.secondaryColor);
  gradient.addColorStop(1, CONFIG.primaryColor);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, logoRadius, 0, Math.PI * 2);
  ctx.fill();

  // W 글자
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Malgun Gothic"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('W', centerX, centerY + 2);
}

async function generateDesignerQRCode(table) {
  const url = `${BASE_URL}/?store_id=${STORE_ID}&table_id=${table.id}`;

  // QR 코드 데이터 생성
  const qrData = QRCode.create(url, { errorCorrectionLevel: 'H' });

  // 캔버스 생성
  const canvas = createCanvas(CONFIG.size, CONFIG.size + 80);
  const ctx = canvas.getContext('2d');

  // 배경 그리기
  ctx.fillStyle = CONFIG.frameColor;
  roundRect(ctx, 0, 0, CONFIG.size, CONFIG.size + 80, 20);
  ctx.fill();

  // QR 코드 배경
  const qrBgX = (CONFIG.size - CONFIG.qrSize - 40) / 2;
  const qrBgY = 30;
  ctx.fillStyle = CONFIG.backgroundColor;
  roundRect(ctx, qrBgX, qrBgY, CONFIG.qrSize + 40, CONFIG.qrSize + 40, 16);
  ctx.fill();

  // 그림자 효과
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = CONFIG.backgroundColor;
  roundRect(ctx, qrBgX, qrBgY, CONFIG.qrSize + 40, CONFIG.qrSize + 40, 16);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // 커스텀 QR 코드 그리기
  const qrX = (CONFIG.size - CONFIG.qrSize) / 2;
  const qrY = 50;
  drawCustomQR(ctx, qrData, qrX, qrY, CONFIG.qrSize);

  // 중앙 로고
  drawCenterLogo(ctx, CONFIG.size / 2, qrY + CONFIG.qrSize / 2);

  // 테이블 이름
  ctx.fillStyle = CONFIG.textColor;
  ctx.font = 'bold 24px "Malgun Gothic"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(table.name, CONFIG.size / 2, CONFIG.size + 20);

  // 매장 이름 (작게)
  ctx.fillStyle = '#64748b';
  ctx.font = '14px "Malgun Gothic"';
  ctx.fillText(STORE_NAME, CONFIG.size / 2, CONFIG.size + 50);

  // 스캔 안내 문구 (상단)
  ctx.fillStyle = CONFIG.primaryColor;
  ctx.font = 'bold 12px "Malgun Gothic"';
  ctx.fillText('QR 스캔하여 주문하기', CONFIG.size / 2, 15);

  // 파일 저장
  const buffer = canvas.toBuffer('image/png');
  const filename = `table-${table.id}-designer.png`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);

  return filename;
}

async function generateAllQRCodes() {
  console.log('🎨 디자인 QR코드 생성 시작...\n');

  for (const table of tables) {
    try {
      const filename = await generateDesignerQRCode(table);
      console.log(`✓ ${table.name}: ${filename}`);
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
  <title>디자인 QR코드 - ${STORE_NAME}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 {
      text-align: center;
      color: white;
      font-size: 32px;
      margin-bottom: 10px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .subtitle {
      text-align: center;
      color: rgba(255,255,255,0.8);
      margin-bottom: 40px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 30px;
    }
    .card {
      background: white;
      border-radius: 24px;
      padding: 24px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .card img {
      width: 100%;
      max-width: 300px;
      border-radius: 16px;
    }
    .card h3 {
      font-size: 20px;
      color: #1e293b;
      margin-top: 16px;
    }
    .card p {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 8px;
    }
    .btn-group {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 40px;
    }
    .btn {
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 600;
      background: white;
      color: #4f46e5;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      transition: all 0.3s;
    }
    .btn:hover {
      background: #4f46e5;
      color: white;
      transform: translateY(-2px);
    }
    .btn-secondary {
      background: rgba(255,255,255,0.2);
      color: white;
    }
    .btn-secondary:hover {
      background: white;
      color: #4f46e5;
    }
    @media print {
      body { background: white; padding: 20px; }
      .btn-group { display: none; }
      .card { box-shadow: 0 2px 10px rgba(0,0,0,0.1); break-inside: avoid; }
      h1 { color: #1e293b; text-shadow: none; }
      .subtitle { color: #64748b; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎨 ${STORE_NAME}</h1>
    <p class="subtitle">테이블별 디자인 QR코드</p>

    <div class="btn-group">
      <button class="btn" onclick="window.print()">🖨️ 전체 인쇄</button>
      <button class="btn btn-secondary" onclick="downloadAll()">📥 전체 다운로드</button>
    </div>

    <div class="grid">
${tables.map(t => `      <div class="card">
        <img src="table-${t.id}-designer.png" alt="${t.name} QR코드">
        <h3>${t.name}</h3>
        <p>QR 스캔하여 주문하기</p>
      </div>`).join('\n')}
    </div>
  </div>

  <script>
    function downloadAll() {
      const links = [${tables.map(t => `'table-${t.id}-designer.png'`).join(', ')}];
      links.forEach((filename, i) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = filename;
          a.download = filename;
          a.click();
        }, i * 200);
      });
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'designer.html'), htmlContent, 'utf8');

  console.log('\n✓ 미리보기 페이지: qrcodes/designer.html');
  console.log(`\n🎉 총 ${tables.length}개의 디자인 QR코드가 생성되었습니다!`);
  console.log(`📁 저장 위치: ${OUTPUT_DIR}`);
}

generateAllQRCodes();
