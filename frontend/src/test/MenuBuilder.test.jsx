import { expect, it } from 'vitest';
import MenuBuilder from '../components/admin/MenuBuilder';

it('loads the menu builder module without undefined layout icon references', () => {
  expect(MenuBuilder).toBeTypeOf('function');
});
