export async function createQrImage(url, width = 600, color = '#0f172a') {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(url, {
    width,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: color, light: '#ffffff' },
  });
}
