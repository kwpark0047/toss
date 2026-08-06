import { describe, expect, it } from 'vitest';

import {
  THEME_PRESETS,
  DEFAULT_THEME_SETTINGS,
  getThemePreset,
  resolveThemeStyle,
  formatPriceWithOptions,
} from '../lib/themePresets';

describe('themePresets', () => {
  it('exposes presets and sane defaults', () => {
    expect(THEME_PRESETS.length).toBe(6);
    expect(DEFAULT_THEME_SETTINGS.menu_layout).toBe('grid');
    expect(DEFAULT_THEME_SETTINGS.menu_options.priceFormat).toBe('comma');
  });

  it('getThemePreset resolves by id', () => {
    expect(getThemePreset({ theme_preset: 'forest-green' })?.colors.primary).toBe('#10B981');
    expect(getThemePreset({})).toBeNull();
    expect(getThemePreset({ theme_preset: 'nope' })).toBeNull();
    expect(getThemePreset(null)).toBeNull();
  });

  it('resolveThemeStyle maps preset colors to customer CSS variables', () => {
    const style = resolveThemeStyle({ theme_preset: 'classic-blue' });
    expect(style['--color-primary']).toBe('#0EA5E9');
    expect(style['--customer-bg-base']).toBe('#F8FAFC');
    expect(style['--customer-bg-card']).toBe('#FFFFFF');
    expect(style['--customer-text-main']).toBe('#1E293B');
    expect(style.fontFamily).toBe('Inter, sans-serif');
    expect(style.backgroundColor).toBe('#F8FAFC');
  });

  it('resolveThemeStyle prefers saved custom_colors over preset', () => {
    const style = resolveThemeStyle({
      theme_preset: 'classic-blue',
      custom_colors: {
        primary: '#FF0000',
        secondary: '#00FF00',
        background: '#000000',
        surface: '#111111',
        text: '#FFFFFF',
        border: '#222222',
      },
    });
    expect(style['--color-primary']).toBe('#FF0000');
    expect(style['--customer-bg-base']).toBe('#000000');
    expect(style['--customer-text-main']).toBe('#FFFFFF');
  });

  it('resolveThemeStyle returns empty object without a usable theme', () => {
    expect(resolveThemeStyle(null)).toEqual({});
    expect(resolveThemeStyle({ theme_preset: 'missing' })).toEqual({});
  });

  it('formats price per priceFormat and unit', () => {
    expect(formatPriceWithOptions(1234567, 'comma', '원')).toBe('1,234,567원');
    expect(formatPriceWithOptions(1234567, 'dot', '원')).toBe('1.234.567원');
    expect(formatPriceWithOptions(1234567, 'space', '원')).toBe('1 234 567원');
    expect(formatPriceWithOptions(null, 'comma', '원')).toBe('0원');
  });
});
