import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('first visit must not restart while the service worker installs', () => {
  it('has one registration owner and no automatic controller-change reload', () => {
    const source = fs.readFileSync('src/main.jsx', 'utf8');
    expect(source).not.toContain("addEventListener('controllerchange'");
    expect(source).not.toContain('registration.update()');
    expect(source).not.toContain('fetch(window.location.href');
  });
});
