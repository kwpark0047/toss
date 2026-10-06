import { describe, it, expect, vi } from 'vitest';
import QRCode from 'qrcode';
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test') },
}));
import { buildMenuUrl, buildQrUrl, SITE_ORIGIN } from '../utils/site';
import { createQrImage } from '../utils/tableQr';

describe('table QR links', () => {
  it('uses the stable public deployment, including special table names and tokens', () => {
    expect(SITE_ORIGIN).toBe('https://wemarket-saas.vercel.app');
    const menu = new URL(buildMenuUrl(3, '창가 & 1'));
    expect(menu.pathname).toBe('/menu/3');
    expect(menu.searchParams.get('table')).toBe('창가 & 1');
    expect(buildQrUrl('token/with?symbols')).toBe(`${SITE_ORIGIN}/qr/token%2Fwith%3Fsymbols`);
    expect(buildMenuUrl(3)).toBe(`${SITE_ORIGIN}/menu/3`);
  });
  it('creates printable QR images locally without external requests', async () => {
    const image = await createQrImage(buildQrUrl('table-token'), 600);
    expect(image.startsWith('data:image/png;base64,')).toBe(true);
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      buildQrUrl('table-token'),
      expect.objectContaining({ width: 600, margin: 4, errorCorrectionLevel: 'M' })
    );
  });
});
