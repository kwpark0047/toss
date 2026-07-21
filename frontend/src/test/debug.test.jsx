import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { MemoryRouter } from 'react-router-dom';

const h = React.createElement;

describe('Debug: component imports', () => {
  it('basic render works', () => {
    render(h('div', null, 'hello'));
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('Link renders', () => {
    const { Link } = require('react-router-dom');
    render(h(Link, { to: '/test' }, 'link text'));
    expect(screen.getByText('link text')).toBeInTheDocument();
  });

  it('lucide Store icon renders', () => {
    const { Store } = require('lucide-react');
    render(h(Store, { 'data-testid': 'store-icon' }));
    expect(screen.getByTestId('store-icon')).toBeInTheDocument();
  });
});
