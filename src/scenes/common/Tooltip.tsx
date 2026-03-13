import {useState, useRef, useEffect, type ReactNode} from 'react';
import {useTheme} from '../../context/Theme';

interface TooltipProps {
    content: ReactNode;
    children: ReactNode;
    className?: string;
}

export default function Tooltip({content, children, className}: TooltipProps) {
    const {isDarkMode} = useTheme();
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState<'top' | 'bottom'>('top');
    const triggerRef = useRef<HTMLDivElement>(null);
    const tipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (visible && triggerRef.current && tipRef.current) {
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const tipHeight = tipRef.current.offsetHeight;
            setPos(triggerRect.top - tipHeight - 8 < 0 ? 'bottom' : 'top');
        }
    }, [visible]);

    return (
        <div
            ref={triggerRef}
            className={`relative inline-flex ${className ?? ''}`}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && (
                <div
                    ref={tipRef}
                    className={`absolute z-50 rounded-md px-3 py-2 text-xs font-medium shadow-lg pointer-events-none
                        ${pos === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2
                        ${isDarkMode ? 'bg-gray-900 text-gray-200 ring-1 ring-gray-700' : 'bg-gray-800 text-white'}`}
                >
                    {content}
                    <div className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-[5px] border-transparent
                        ${pos === 'top'
                            ? `top-full ${isDarkMode ? 'border-t-gray-900' : 'border-t-gray-800'}`
                            : `bottom-full ${isDarkMode ? 'border-b-gray-900' : 'border-b-gray-800'}`
                        }`}
                    />
                </div>
            )}
        </div>
    );
}
