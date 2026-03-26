import {useState, useRef, useCallback, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '../../context/Theme';

interface TooltipProps {
    content: ReactNode;
    children: ReactNode;
    className?: string;
}

export default function Tooltip({content, children, className}: TooltipProps) {
    const {isDarkMode} = useTheme();
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState<{x: number; y: number; pos: 'top' | 'bottom'}>({x: 0, y: 0, pos: 'top'});
    const triggerRef = useRef<HTMLDivElement>(null);

    const show = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const spaceAbove = rect.top;
            const pos = spaceAbove < 40 ? 'bottom' : 'top';
            const y = pos === 'top' ? rect.top - 4 : rect.bottom + 4;
            setCoords({x, y, pos});
        }
        setVisible(true);
    }, []);

    return (
        <div
            ref={triggerRef}
            className={`relative ${className ?? 'inline-flex'}`}
            onMouseEnter={show}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: coords.x,
                        top: coords.y,
                        transform: coords.pos === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                        zIndex: 9999,
                    }}
                    className={`rounded-md px-3 py-2 text-xs font-medium shadow-lg pointer-events-none whitespace-nowrap
                        ${isDarkMode ? 'bg-gray-900 text-gray-200 ring-1 ring-gray-700' : 'bg-gray-800 text-white'}`}
                >
                    {content}
                    <div
                        style={{
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            ...(coords.pos === 'top'
                                ? {top: '100%', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `5px solid ${isDarkMode ? '#111827' : '#1f2937'}`}
                                : {bottom: '100%', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `5px solid ${isDarkMode ? '#111827' : '#1f2937'}`}
                            ),
                            width: 0,
                            height: 0,
                        }}
                    />
                </div>,
                document.body
            )}
        </div>
    );
}
