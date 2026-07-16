const express = require('express');
const cors = require('cors');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8081;

// 간단한 Mock 디바이스 (프린터가 없을 때도 테스트 가능하도록)
class MockDevice {
  open(callback) { callback(null); }
  write(data, callback) { callback(null); }
  close(callback) { if(callback) callback(null); }
}

app.post('/print', (req, res) => {
  console.log('[Print Agent] Received print request');
  const { storeName, orderNo, type, items, total, date } = req.body;

  let device;
  try {
    // 실제 USB/네트워크 프린터 연결 시도
    // const device = new escpos.USB();
    // const device = new escpos.Network('192.168.1.100');
    device = new MockDevice(); // 현재는 에러 방지를 위해 Mock 사용
  } catch (e) {
    device = new MockDevice();
  }

  const printer = new escpos.Printer(device, { encoding: 'EUC-KR' });

  device.open((err) => {
    if (err) {
      console.error('[Print Agent] Printer Error:', err);
      return res.status(500).json({ success: false, error: 'Printer connection failed' });
    }

    try {
      printer
        .align('ct')
        .size(2, 2)
        .text(storeName || 'WeMarket')
        .size(1, 1)
        .text('--------------------------------')
        .align('lt')
        .text('주문번호: ' + (orderNo || 'N/A'))
        .text('유형: ' + (type === 'for_here' ? '매장식사' : '포장'))
        .text('일시: ' + (date || new Date().toLocaleString()))
        .text('--------------------------------');

      if (items && items.length > 0) {
        items.forEach(item => {
          printer.text(item.name + ' x' + item.quantity + '  ' + (item.price * item.quantity).toLocaleString());
          if (item.options && item.options.length > 0) {
            item.options.forEach(opt => {
              printer.text('  - ' + opt.name);
            });
          }
        });
      }

      printer
        .text('--------------------------------')
        .align('rt')
        .size(1, 2)
        .text('총액: ' + (total || 0).toLocaleString() + '원')
        .cut()
        .close();

      console.log('[Print Agent] Print successful');
      res.json({ success: true, message: 'Printed successfully' });
    } catch (e) {
      console.error('[Print Agent] Formatting Error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
});

app.listen(PORT, () => {
  console.log('====================================');
  console.log('[WeMarket Local Print Agent] Started');
  console.log('Listening on http://localhost:' + PORT);
  console.log('====================================');
});
