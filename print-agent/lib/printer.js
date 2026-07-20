const net = require('net');

class TcpPrinter {
    constructor(host, port) {
        this.host = host;
        this.port = port;
    }

    async print(base64Payload) {
        const data = Buffer.from(base64Payload, 'base64');
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
                socket.destroy();
                reject(new Error('Printer connection timeout'));
            }, 5000);

            socket.connect(this.port, this.host, () => {
                socket.write(data, () => {
                    socket.end(() => {
                        clearTimeout(timeout);
                        resolve(true);
                    });
                });
            });

            socket.on('error', (err) => {
                clearTimeout(timeout);
                reject(new Error(`Printer error: ${err.message}`));
            });
        });
    }
}

class UsbPrinter {
    constructor(vid, pid) {
        this.vid = vid;
        this.pid = pid;
    }

    async print(base64Payload) {
        try {
            const usb = require('usb');
            const device = usb.getDeviceList().find(
                d => d.deviceDescriptor.idVendor === this.vid && d.deviceDescriptor.idProduct === this.pid
            );
            if (!device) throw new Error(`USB printer not found (VID:${this.vid} PID:${this.pid})`);

            device.open();
            const iface = device.interfaces[0];
            if (iface.isKernelDriverActive()) iface.detachKernelDriver();
            iface.claim();

            const outEndpoint = iface.endpoints.find(e => e.direction === 'out');
            if (!outEndpoint) throw new Error('No output endpoint found');

            const data = Buffer.from(base64Payload, 'base64');
            await new Promise((resolve, reject) => {
                outEndpoint.transfer(data, (err) => {
                    if (err) reject(new Error(`USB transfer failed: ${err.message}`));
                    else resolve();
                });
            });

            iface.release();
            device.close();
            return true;
        } catch (err) {
            throw new Error(`USB print failed: ${err.message}`);
        }
    }
}

function createPrinter(config) {
    if (config.type === 'usb') {
        return new UsbPrinter(parseInt(config.vid, 16), parseInt(config.pid, 16));
    }
    return new TcpPrinter(config.host, config.port);
}

module.exports = { TcpPrinter, UsbPrinter, createPrinter };
