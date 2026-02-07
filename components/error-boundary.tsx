/**
 * 错误边界组件
 * 捕获并优雅地处理 React 错误
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * 默认错误回退 UI
 */
function ErrorFallback({
  error,
  onReset,
}: {
  error?: Error;
  onReset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500/10 rounded-full blur-3xl" />
          <div className="relative w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-red-500/20 to-red-500/5 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">
            出了点问题
          </h1>
          <p className="text-sm text-muted-foreground">
            应用遇到了意外错误，请尝试刷新页面或返回首页
          </p>
          {error?.message && (
            <p className="text-xs text-muted-foreground/70 font-mono bg-muted p-2 rounded mt-2 overflow-auto">
              {error.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button onClick={onReset} variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />}>
            重试
          </Button>
          <Link href="/">
            <Button leftIcon={<Home className="w-4 h-4" />}>
              返回首页
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * 组件级错误边界
 */
export function ComponentErrorBoundary({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div
          className={cn(
            'p-8 rounded-xl bg-red-50 border border-red-200 text-center',
            className
          )}
        >
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600">加载失败，请刷新重试</p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
