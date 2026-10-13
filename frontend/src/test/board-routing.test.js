import { test, expect } from 'vitest';
import source from '../App.jsx?raw';
test('global board menu resolves list, category, detail and protected editor routes', () => {
  expect(source).not.toMatch(/path="\/board" element=\{<Navigate to="\/admin"/);
  for (const path of ['/board', '/board/:type', '/board/posts/:id', '/board/write']) {
    expect(source).toContain(`path="${path}"`);
  }
});
