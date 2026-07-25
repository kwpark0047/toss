const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('TypeScript Migration', () => {
  const projectRoot = path.join(__dirname, '..', '..', '..');

  it('npx tsc --noEmit passes without errors', () => {
    try {
      const output = execSync('npx tsc --noEmit 2>&1', {
        cwd: projectRoot,
        encoding: 'utf-8',
      });
      expect(output.trim()).toBe('');
    } catch (error) {
      throw new Error(`TypeScript compilation failed:\n${error.stdout || error.message}`);
    }
  });

  it('all migrated services have .ts files', () => {
    const services = [
      'PointsService',
      'OrderService',
      'StoreService',
      'CustomerService',
      'StaffService',
      'CartService',
    ];

    const servicesDir = path.join(projectRoot, 'services');

    services.forEach((name) => {
      const tsFile = path.join(servicesDir, `${name}.ts`);
      expect(fs.existsSync(tsFile)).toBe(true);
    });
  });

  it('type definition files exist', () => {
    const typesDir = path.join(projectRoot, 'types');
    const typeFiles = ['payment.ts', 'store.ts', 'order.ts', 'staff.ts', 'cart.ts'];

    typeFiles.forEach((file) => {
      const filePath = path.join(typesDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});
