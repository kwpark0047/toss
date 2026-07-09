import { Component } from 'react';

/**
 * ErrorFallback — 에러 발생 시 표시되는 UI
 * @param {{ error: Error, resetErrorBoundary: () => void, [key: string]: any }} props
 */
export function ErrorFallback({ error, resetErrorBoundary, fullPage = false }) {
  const containerClass = fullPage
    ? 'min-h-screen flex items-center justify-center bg-slate-950 p-6'
    : 'flex items-center justify-center p-8';

  return (
    <div className={containerClass}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4 select-none" aria-hidden="true">⚠️</div>
        <h3 className="text-lg font-semibold text-slate-100 mb-1">
          문제가 발생했습니다
        </h3>
        <p className="text-slate-400 text-sm mb-4 leading-relaxed">
          페이지를 불러오는 중 예기치 않은 오류가 생겼습니다.
          {error?.message && (
            <span className="block mt-1 text-xs text-slate-500 font-mono">
              {error.message}
            </span>
          )}
        </p>
        {resetErrorBoundary && (
          <button
            onClick={resetErrorBoundary}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg
                       bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium
                       transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          >
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * ErrorBoundary — React class component 에러 경계
 * lazy 컴포넌트 로딩 실패(Suspense 미처리 런타임 에러)를 캐치하여 fallback 렌더
 *
 * @example
 * <ErrorBoundary>
 *   <Suspense fallback={<Spinner />}>
 *     <HeavyComponent />
 *   </Suspense>
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.handleReset,
        });
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          resetErrorBoundary={this.handleReset}
          fullPage={this.props.fullPage}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
