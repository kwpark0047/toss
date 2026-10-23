import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

vi.mock('framer-motion', () => {
  const components = new Map();
  return {
    motion: new Proxy({}, {
      get: (_, tag) => {
        if (!components.has(tag)) {
          components.set(tag, ({ children }) => React.createElement(tag, null, children));
        }
        return components.get(tag);
      },
    }),
    AnimatePresence: ({ children }) => children,
  };
});
vi.mock('../components/admin/wizard/WizardTinkerbell', () => ({
  Wing: () => <span aria-hidden="true" />,
  Spark: () => null,
  speak: vi.fn(),
}));

import Step1InlineGuide from '../components/admin/wizard/Step1InlineGuide';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('keeps the selected setup guidance stable so its text becomes visible', async () => {
  vi.useFakeTimers();
  const { container } = render(
    <Step1InlineGuide
      focus="name"
      form={{ name: '', business_type: 'cafe' }}
      customBtype=""
      voiceEnabled={false}
    />
  );

  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });

  const guidance = container.querySelector('p');
  expect(guidance).not.toBeNull();
  expect(guidance.textContent.trim().length).toBeGreaterThan(5);
  const initialText = guidance.textContent;

  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });

  expect(guidance.textContent.startsWith(initialText)).toBe(true);
  expect(guidance.textContent.length).toBeGreaterThan(initialText.length);
});
