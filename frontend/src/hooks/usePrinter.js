import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export function usePrinter() {
  const [printerDevice, setPrinterDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // Check if Web Bluetooth API is supported
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.bluetooth) {
      setIsSupported(true);
    }
  }, []);

  const connectPrinter = async () => {
    if (!isSupported) {
      toast.error('이 브라우저는 Web Bluetooth API를 지원하지 않습니다.');
      return;
    }

    try {
      setIsConnecting(true);
      // 영수증 프린터의 일반적인 서비스 UUID를 요청합니다.
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] 
      });

      setPrinterDevice(device);
      toast.success(`프린터 연결됨: ${device.name || '알 수 없는 장치'}`);
      
      device.addEventListener('gattserverdisconnected', () => {
        setPrinterDevice(null);
        toast.warning('프린터 연결이 끊어졌습니다.');
      });
    } catch (error) {
      console.error('Printer connection error:', error);
      toast.error('프린터 연결에 실패했습니다.');
    } finally {
      setIsConnecting(false);
    }
  };

  const printReceipt = useCallback(async (order) => {
    if (!printerDevice) {
      toast.error('연결된 프린터가 없습니다. 먼저 프린터를 연결해주세요.');
      return false;
    }

    try {
      const server = await printerDevice.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      const encoder = new TextEncoder();
      
      // ESC/POS commands
      const ESC = '\x1B';
      const GS = '\x1D';
      const INIT = ESC + '@';
      const ALIGN_CENTER = ESC + 'a' + '\x01';
      const ALIGN_LEFT = ESC + 'a' + '\x00';
      const BOLD_ON = ESC + 'E' + '\x01';
      const BOLD_OFF = ESC + 'E' + '\x00';
      const CUT = GS + 'V' + '\x41' + '\x00';

      // Build receipt text
      let receipt = INIT;
      receipt += ALIGN_CENTER + BOLD_ON + '=== 주문 영수증 ===\n\n' + BOLD_OFF;
      receipt += ALIGN_LEFT;
      receipt += `주문번호: #${order.order_number?.slice(-4)}\n`;
      receipt += `유형: ${order.is_takeout ? '포장' : '매장 식사'}\n`;
      if (!order.is_takeout && order.table_name) {
        receipt += `테이블: ${order.table_name}\n`;
      }
      receipt += `주문일시: ${new Date(order.created_at).toLocaleString('ko-KR')}\n`;
      receipt += '-'.repeat(32) + '\n';
      
      order.items?.forEach(item => {
        receipt += `${item.product_name}\n`;
        receipt += `  ${item.quantity}개\n`;
        if (item.options) {
          try {
            const opts = typeof item.options === 'string' ? JSON.parse(item.options) : item.options;
            Object.entries(opts).forEach(([k, v]) => {
              receipt += `    - ${k}: ${v}\n`;
            });
          } catch (e) {}
        }
      });
      
      receipt += '-'.repeat(32) + '\n';
      if (order.notes) {
        receipt += `요청사항: ${order.notes}\n`;
        receipt += '-'.repeat(32) + '\n';
      }
      receipt += '\n\n\n' + CUT;

      // Write in chunks
      const data = encoder.encode(receipt);
      const CHUNK_SIZE = 512;
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await characteristic.writeValue(chunk);
      }

      toast.success('영수증 출력이 완료되었습니다.');
      return true;
    } catch (error) {
      console.error('Printing error:', error);
      toast.error('출력 중 오류가 발생했습니다: ' + error.message);
      return false;
    }
  }, [printerDevice]);

  return {
    printerDevice,
    isConnecting,
    isSupported,
    connectPrinter,
    printReceipt
  };
}