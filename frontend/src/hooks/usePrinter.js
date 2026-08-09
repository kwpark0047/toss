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
      toast.error('이 브라우저는 Web Bluetooth API를 지원하지 않습니다. (Local Agent 폴백을 사용합니다)');
      return;
    }
    try {
      setIsConnecting(true);
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });
      setPrinterDevice(device);
      toast.success(`프린터 연결됨: ${device.name}`);
      device.addEventListener('gattserverdisconnected', () => {
        setPrinterDevice(null);
        toast.warning('프린터 연결이 끊어졌습니다.');
      });
    } catch (error) {
      console.error('Printer connection error:', error);
      toast.error('블루투스 프린터 연결에 실패했습니다.');
    } finally {
      setIsConnecting(false);
    }
  };
  const printReceipt = useCallback(async order => {
    // 1. Web Bluetooth 시도
    if (printerDevice && isSupported) {
      try {
        const server = await printerDevice.gatt.connect();
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
        const encoder = new TextEncoder();
        const ESC = '\x1B';
        const GS = '\x1D';
        const INIT = ESC + '@';
        const ALIGN_CENTER = ESC + 'a' + '\x01';
        const ALIGN_LEFT = ESC + 'a' + '\x00';
        const BOLD_ON = ESC + 'E' + '\x01';
        const BOLD_OFF = ESC + 'E' + '\x00';
        const CUT = GS + 'V' + '\x41' + '\x00';
        let receipt = INIT;
        receipt += ALIGN_CENTER + BOLD_ON + '=== 주문 영수증 ===\n\n' + BOLD_OFF;
        receipt += ALIGN_LEFT;
        receipt += `주문번호: #${order.order_number}\n`;
        receipt += `유형: ${order.is_takeout ? '포장' : '매장'}\n`;
        if (!order.is_takeout && order.table_name) {
          receipt += `테이블: ${order.table_name}\n`;
        }
        receipt += `주문일시: ${new Date(order.created_at).toLocaleString()}\n`;
        receipt += '-'.repeat(32) + '\n';
        order.items?.forEach(item => {
          receipt += `${item.menu_name} x ${item.quantity}\n`;
          receipt += `  ${item.price}원\n`;
          if (item.options) {
            try {
              const opts = typeof item.options === 'string' ? JSON.parse(item.options) : item.options;
              Object.entries(opts).forEach(([k, v]) => {
                receipt += `    - ${k}: ${v}\n`;
              });
            } catch (_e) {}
          }
        });
        receipt += '-'.repeat(32) + '\n';
        if (order.notes) {
          receipt += `요청사항: ${order.notes}\n`;
          receipt += '-'.repeat(32) + '\n';
        }
        receipt += '\n\n\n' + CUT;
        const data = encoder.encode(receipt);
        const CHUNK_SIZE = 512;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          await characteristic.writeValue(chunk);
        }
        toast.success('영수증 출력이 완료되었습니다. (Web Bluetooth)');
        return true;
      } catch (error) {
        console.error('Web Bluetooth Printing error:', error);
      }
    }

    // 2. Local Print Agent 폴백 (사파리나 미지원 기기용)
    try {
      let parsedItems = order.items || [];
      if (typeof parsedItems === 'string') {
        try {
          parsedItems = JSON.parse(parsedItems);
        } catch (_e) {}
      }
      const response = await fetch('http://localhost:8081/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeName: order.store?.name || 'WeMarket',
          orderNo: order.order_number?.slice(-4),
          type: order.is_takeout ? 'takeout' : 'for_here',
          date: new Date(order.created_at).toLocaleString('ko-KR'),
          items: parsedItems,
          total: order.total_amount
        })
      });
      if (!response.ok) throw new Error('Local agent responded with error');
      toast.success('영수증 출력이 완료되었습니다. (Local Agent)');
      return true;
    } catch (fallbackError) {
      console.error('Local Agent Printing error:', fallbackError);
      toast.error('프린터 연결을 찾을 수 없습니다. (블루투스 연결 확인 또는 Local Agent 실행 필요)');
      return false;
    }
  }, [printerDevice, isSupported]);
  return {
    printerDevice,
    isConnecting,
    isSupported,
    connectPrinter,
    printReceipt
  };
}
