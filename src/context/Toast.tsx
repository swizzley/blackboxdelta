import React, {createContext, useContext, useState, useCallback, useRef, useEffect} from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextProps {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const useToast = (): ToastContextProps => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};

export const ToastProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(0);

    const toast = useCallback((message: string, type: ToastType = 'info') => {
        const id = nextId.current++;
        setToasts(prev => [...prev, {id, message, type}]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    return (
        <ToastContext.Provider value={{toast}}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={() => setToasts(prev => prev.filter(x => x.id !== t.id))}/>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

function ToastItem({toast: t, onDismiss}: {toast: Toast; onDismiss: () => void}) {
    const [visible, setVisible] = useState(false);
    useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

    const colors = {
        success: 'bg-emerald-900/90 text-emerald-100 border-emerald-700',
        error: 'bg-red-900/90 text-red-100 border-red-700',
        info: 'bg-slate-800/90 text-slate-100 border-slate-600',
    };

    const icons = {
        success: '\u2713',
        error: '\u2717',
        info: '\u2139',
    };

    return (
        <div
            onClick={onDismiss}
            className={`cursor-pointer px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm text-sm font-mono
                transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                ${colors[t.type]}`}
        >
            <span className="mr-2">{icons[t.type]}</span>
            {t.message}
        </div>
    );
}
