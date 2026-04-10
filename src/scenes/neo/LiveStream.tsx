import {useEffect, useState, useRef, useMemo} from 'react';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {connectSignalBus} from '../../api/sse';
import type {BusSignal} from '../../context/Types';
import {SignalIcon, PauseCircleIcon, PlayCircleIcon} from '@heroicons/react/24/outline';

const MAX_EVENTS = 500;

const SERVICE_COLORS: Record<string, string> = {
    'agent-neo': 'bg-cyan-500',
    'trading-engine': 'bg-green-500',
    'alerts-engine': 'bg-blue-500',
    'collection-engine': 'bg-violet-500',
    'optimization-engine': 'bg-amber-500',
    'monitoring-service': 'bg-pink-500',
    'sentdex-engine': 'bg-orange-500',
    'analysis-engine': 'bg-teal-500',
    'api': 'bg-gray-500',
};

const SEV_DOTS: Record<string, string> = {
    INFO: 'bg-gray-400',
    LOW: 'bg-blue-400',
    MEDIUM: 'bg-yellow-400',
    HIGH: 'bg-orange-400',
    CRITICAL: 'bg-red-500',
};

const SERVICES = ['all', 'agent-neo', 'api', 'trading-engine', 'alerts-engine', 'collection-engine',
    'optimization-engine', 'monitoring-service', 'sentdex-engine', 'analysis-engine'];

const SEVERITIES = ['all', 'INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface Props {
    onSelectCorrelation?: (id: string) => void;
}

export default function LiveStream({onSelectCorrelation}: Props) {
    const {isDarkMode} = useTheme();
    const {apiBase} = useApi();
    const [events, setEvents] = useState<BusSignal[]>([]);
    const [paused, setPaused] = useState(false);
    const [connected, setConnected] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [serviceFilter, setServiceFilter] = useState('all');
    const [severityFilter, setSeverityFilter] = useState('all');
    const scrollRef = useRef<HTMLDivElement>(null);
    const pausedRef = useRef(false);
    const eventsRef = useRef<BusSignal[]>([]);

    // Keep refs in sync for the SSE callback
    pausedRef.current = paused;
    eventsRef.current = events;

    useEffect(() => {
        if (!apiBase) return;

        setConnected(true);
        const disconnect = connectSignalBus(apiBase, (sig) => {
            if (pausedRef.current) return;
            setEvents(prev => {
                const next = [sig, ...prev];
                return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
            });
        });

        return () => {
            disconnect();
            setConnected(false);
        };
    }, [apiBase]);

    // Auto-scroll to top on new events (newest first)
    useEffect(() => {
        if (!paused && scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [events.length, paused]);

    const filtered = useMemo(() => events.filter(sig => {
        if (serviceFilter !== 'all' && sig.source_service !== serviceFilter) return false;
        if (severityFilter !== 'all' && sig.severity !== severityFilter) return false;
        return true;
    }), [events, serviceFilter, severityFilter]);

    const formatTime = (ts: string) => {
        try {
            const d = new Date(ts);
            return d.toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'});
        } catch {
            return '??:??:??';
        }
    };

    const summarize = (sig: BusSignal): string => {
        const p = sig.payload || {};
        const parts: string[] = [];

        // Tier info
        if (p.tier) parts.push(`T${String(p.tier).replace('t', '')}`);

        // Sweep info
        if (p.sweep) parts.push(`#${p.sweep}`);
        if (p.signals_collected !== undefined) parts.push(`${p.signals_collected} collected`);
        if (p.signals_novel !== undefined) parts.push(`${p.signals_novel} novel`);
        if (p.incidents !== undefined) parts.push(`${p.incidents} incidents`);
        if (p.duration_ms !== undefined) parts.push(`${(p.duration_ms / 1000).toFixed(1)}s`);

        // Signal detection
        if (p.signal_name) parts.push(String(p.signal_name));
        if (p.value !== undefined) parts.push(`=${p.value}`);
        if (p.reason) parts.push(String(p.reason));

        // Tool calls
        if (p.tool) {
            const args = String(p.args || '').substring(0, 40);
            parts.push(`${p.tool}(${args})${p.result_size ? ` → ${p.result_size}` : ''}`);
        }

        // Issues
        if (p.iid) parts.push(`#${p.iid}`);
        if (p.issue_iid) parts.push(`#${p.issue_iid}`);
        if (p.title) parts.push(String(p.title).substring(0, 60));
        if (p.severity && !parts.some(x => x.includes('P'))) parts.push(String(p.severity));

        // Investigation
        if (p.decision) parts.push(String(p.decision));
        if (p.summary) parts.push(String(p.summary).substring(0, 80));

        // MR
        if (p.url) parts.push(String(p.url).split('/').slice(-3).join('/'));
        if (p.branch) parts.push(String(p.branch));

        // Safety
        if (p.gate) parts.push(String(p.gate));

        // Evidence
        if (p.evidence) parts.push(String(p.evidence).substring(0, 60));

        return parts.join(' | ') || JSON.stringify(p).substring(0, 80);
    };

    const shortType = (t: string) => t.replace(/^neo\./, '').replace(/^trading\./, '').replace(/^alerts\./, '')
        .replace(/^collection\./, '').replace(/^optimizer\./, '');

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow transition-colors duration-500`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const selectCl = `text-xs rounded px-2 py-1 ${isDarkMode ? 'bg-slate-700 text-gray-300 border-slate-600' : 'bg-gray-50 text-gray-700 border-gray-200'} border`;

    return (
        <div className={`${card} p-4`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} className={selectCl}>
                        {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className={selectCl}>
                        {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => setPaused(!paused)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${paused ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}`}>
                        {paused ? <><PlayCircleIcon className="w-3.5 h-3.5"/> Resume</> : <><PauseCircleIcon className="w-3.5 h-3.5"/> Pause</>}
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-xs ${muted}`}>{filtered.length !== events.length ? `${filtered.length}/` : ''}{events.length} events</span>
                    <span className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}/>
                        <span className={`text-xs ${muted}`}>{connected ? 'Connected' : 'Disconnected'}</span>
                    </span>
                </div>
            </div>

            {/* Event stream */}
            <div ref={scrollRef} className="overflow-y-auto max-h-[600px] font-mono text-xs space-y-px">
                {filtered.length === 0 && (
                    <div className={`text-center py-8 ${muted}`}>
                        <SignalIcon className="w-8 h-8 mx-auto mb-2 opacity-40"/>
                        Waiting for signals...
                    </div>
                )}
                {filtered.map(sig => (
                    <div key={sig.id}>
                        <div
                            onClick={() => setExpanded(expanded === sig.id ? null : sig.id)}
                            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors
                                ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}
                                ${expanded === sig.id ? (isDarkMode ? 'bg-slate-700' : 'bg-gray-50') : ''}`}>
                            {/* Severity dot */}
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEV_DOTS[sig.severity] || 'bg-gray-400'}`}/>
                            {/* Timestamp */}
                            <span className={`flex-shrink-0 ${muted}`}>{formatTime(sig.ts)}</span>
                            {/* Service pill */}
                            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-white text-[10px] font-medium ${SERVICE_COLORS[sig.source_service || ''] || 'bg-gray-500'}`}>
                                {(sig.source_service || 'unknown').replace('-engine', '').replace('-service', '')}
                            </span>
                            {/* Event type */}
                            <span className={`flex-shrink-0 font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                {shortType(sig.signal_type)}
                            </span>
                            {/* Summary */}
                            <span className={`truncate ${muted}`}>{summarize(sig)}</span>
                            {/* Correlation chain icon */}
                            {sig.correlation_id && onSelectCorrelation && (
                                <button onClick={e => {e.stopPropagation(); onSelectCorrelation(sig.correlation_id!);}}
                                    className="flex-shrink-0 text-cyan-500 hover:text-cyan-400" title="View correlation chain">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                                    </svg>
                                </button>
                            )}
                        </div>
                        {/* Expanded payload */}
                        {expanded === sig.id && (
                            <pre className={`ml-6 px-3 py-2 rounded text-[10px] overflow-x-auto ${isDarkMode ? 'bg-slate-900 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                {JSON.stringify(sig, null, 2)}
                            </pre>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
