import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// 간단한 테스트 컴포넌트
function HelloWorld() {
  return <div>Hello, WeMarket!</div>;
}

describe('smoke test', () => {
  it('renders without crashing', () => {
    render(<HelloWorld />);
    expect(screen.getByText('Hello, WeMarket!')).toBeInTheDocument();
  });
});
