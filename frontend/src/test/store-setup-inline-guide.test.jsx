import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

vi.mock('framer-motion', () => {
  const components = new Map();
  return {
    motion: new Proxy(
      {},
      {
        get: (_, tag) => {
          if (!components.has(tag)) {
            components.set(tag, ({ children }) => React.createElement(tag, null, children));
          }
          return components.get(tag);
        },
      }
    ),
    AnimatePresence: ({ children }) => children,
  };
});
vi.mock('../components/admin/wizard/WizardTinkerbell', () => ({
  Wing: () => <span aria-hidden="true" />,
  Spark: () => null,
  speak: vi.fn(),
}));

import Step1InlineGuide from '../components/admin/wizard/Step1InlineGuide';
import { speak } from '../components/admin/wizard/WizardTinkerbell';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it('speaks the latest guide on focus change without repeating speech on name edits', () => {
  const props = {
    focus: 'name',
    form: { name: '', business_type: 'cafe' },
    customBtype: '',
    voiceEnabled: true,
  };
  const { rerender } = render(<Step1InlineGuide {...props} />);
  expect(speak).toHaveBeenCalledTimes(1);
  rerender(<Step1InlineGuide {...props} form={{ ...props.form, name: 'QA 매장' }} />);
  expect(speak).toHaveBeenCalledTimes(1);
  rerender(
    <Step1InlineGuide {...props} focus="business_type" form={{ ...props.form, name: 'QA 매장' }} />
  );
  expect(speak).toHaveBeenCalledTimes(2);
  expect(speak.mock.calls[1][0]).toMatch(/영업 시간|최적화/);
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
