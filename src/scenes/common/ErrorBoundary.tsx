import React from 'react';

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends React.Component<{children: React.ReactNode}, State> {
    state: State = {hasError: false, error: null};

    static getDerivedStateFromError(error: Error): State {
        return {hasError: true, error};
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                    <div className="bg-slate-800 rounded-lg p-8 max-w-md text-center shadow-lg">
                        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
                        <p className="text-gray-400 text-sm mb-4">{this.state.error?.message}</p>
                        <button
                            onClick={() => { this.setState({hasError: false, error: null}); window.location.reload(); }}
                            className="px-4 py-2 bg-cyan-500 text-white rounded-md hover:bg-cyan-600 text-sm"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
