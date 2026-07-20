const { TcpPrinter, UsbPrinter, createPrinter } = require('../lib/printer');

// Mock net module
jest.mock('net', () => {
    const mockSocket = {
        connect: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn(),
    };
    return {
        Socket: jest.fn(() => mockSocket),
        __mockSocket: mockSocket,
    };
});

// Mock usb module
const mockUsbDevice = {
    deviceDescriptor: { idVendor: 0x0456, idProduct: 0x0808 },
    open: jest.fn(),
    close: jest.fn(),
    interfaces: [{
        isKernelDriverActive: jest.fn(() => false),
        detachKernelDriver: jest.fn(),
        claim: jest.fn(),
        release: jest.fn(),
        endpoints: [{ direction: 'out', transfer: jest.fn() }],
    }],
};

jest.mock('usb', () => ({
    getDeviceList: jest.fn(() => [mockUsbDevice]),
}));

describe('TcpPrinter', () => {
    let printer;
    let mockSocket;
    const net = require('net');

    beforeEach(() => {
        jest.clearAllMocks();
        printer = new TcpPrinter('192.168.1.100', 9100);
        mockSocket = net.__mockSocket;
    });

    test('prints successfully', async () => {
        // Setup mock: connect → write → end chain
        mockSocket.connect.mockImplementation((port, host, cb) => {
            expect(port).toBe(9100);
            expect(host).toBe('192.168.1.100');
            cb();
        });
        mockSocket.write.mockImplementation((data, cb) => cb());
        mockSocket.end.mockImplementation((cb) => cb());

        const payload = Buffer.from('HELLO').toString('base64');
        const result = await printer.print(payload);

        expect(result).toBe(true);
        expect(mockSocket.connect).toHaveBeenCalledWith(9100, '192.168.1.100', expect.any(Function));
        expect(mockSocket.write).toHaveBeenCalledWith(Buffer.from('HELLO'), expect.any(Function));
        expect(mockSocket.end).toHaveBeenCalled();
    });

    test('rejects on timeout', async () => {
        mockSocket.connect.mockImplementation(() => {}); // never calls callback
        mockSocket.on.mockImplementation(() => {});

        const payload = Buffer.from('TEST').toString('base64');

        await expect(printer.print(payload)).rejects.toThrow('Printer connection timeout');
    }, 10000);

    test('rejects on socket error', async () => {
        mockSocket.connect.mockImplementation((port, host, cb) => cb());
        mockSocket.write.mockImplementation((data, cb) => cb());
        mockSocket.on.mockImplementation((event, cb) => {
            if (event === 'error') {
                cb(new Error('ECONNREFUSED'));
            }
        });

        const payload = Buffer.from('TEST').toString('base64');
        await expect(printer.print(payload)).rejects.toThrow('Printer error: ECONNREFUSED');
    });
});

describe('UsbPrinter', () => {
    let printer;
    const usb = require('usb');

    beforeEach(() => {
        jest.clearAllMocks();
        printer = new UsbPrinter(0x0456, 0x0808);
    });

    test('prints successfully', async () => {
        const iface = mockUsbDevice.interfaces[0];
        iface.endpoints[0].transfer.mockImplementation((data, cb) => cb());

        const payload = Buffer.from('USB_TEST').toString('base64');
        const result = await printer.print(payload);

        expect(result).toBe(true);
        expect(mockUsbDevice.open).toHaveBeenCalled();
        expect(iface.claim).toHaveBeenCalled();
        expect(iface.endpoints[0].transfer).toHaveBeenCalledWith(Buffer.from('USB_TEST'), expect.any(Function));
        expect(iface.release).toHaveBeenCalled();
        expect(mockUsbDevice.close).toHaveBeenCalled();
    });

    test('throws when USB device not found', async () => {
        usb.getDeviceList.mockReturnValue([]);

        const payload = Buffer.from('TEST').toString('base64');
        await expect(printer.print(payload)).rejects.toThrow('USB print failed: USB printer not found');
    });

    test('detaches kernel driver if active', async () => {
        const iface = mockUsbDevice.interfaces[0];
        iface.isKernelDriverActive.mockReturnValue(true);
        iface.endpoints[0].transfer.mockImplementation((data, cb) => cb());

        const payload = Buffer.from('TEST').toString('base64');
        await printer.print(payload);

        expect(iface.detachKernelDriver).toHaveBeenCalled();
    });

    test('throws when no output endpoint', async () => {
        mockUsbDevice.interfaces[0].endpoints = [{ direction: 'in' }];

        const payload = Buffer.from('TEST').toString('base64');
        await expect(printer.print(payload)).rejects.toThrow('USB print failed: No output endpoint found');
    });
});

describe('createPrinter', () => {
    test('creates TcpPrinter by default', () => {
        const printer = createPrinter({ type: 'tcp', host: '192.168.1.100', port: 9100 });
        expect(printer).toBeInstanceOf(TcpPrinter);
        expect(printer.host).toBe('192.168.1.100');
        expect(printer.port).toBe(9100);
    });

    test('creates UsbPrinter when type is usb', () => {
        const printer = createPrinter({ type: 'usb', vid: '0x0456', pid: '0x0808' });
        expect(printer).toBeInstanceOf(UsbPrinter);
        expect(printer.vid).toBe(0x0456);
        expect(printer.pid).toBe(0x0808);
    });

    test('defaults to TcpPrinter for unknown type', () => {
        const printer = createPrinter({ type: 'unknown', host: 'localhost', port: 9100 });
        expect(printer).toBeInstanceOf(TcpPrinter);
    });
});
