import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AlertCircle, RotateCcw } from 'lucide-react';

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-red-50 rounded-xl border border-red-100 text-center">
      <div className="bg-red-100 p-3 rounded-full mb-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <h2 className="text-xl font-semibold text-red-900 mb-2">Something went wrong</h2>
      <p className="text-red-700 mb-6 max-w-md font-mono text-sm text-balance">
        {(error as Error).message}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium shadow-sm active:scale-95"
      >
        <RotateCcw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
};

export const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
};
