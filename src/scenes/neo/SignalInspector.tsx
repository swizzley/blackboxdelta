import {useState, useCallback} from 'react';
import {useTheme} from '../../context/Theme';
import {fetchSignalsByCorrelation} from '../../api/client';
import type {BusSignal} from '../../context/Types';
import {MagnifyingGlassIcon, LinkIcon} from '@heroicons/react/24/outline';

const SERVICE_COLORS: Record<string, string> = {
    'agent-neo': 'bg-cyan-500',
    'trading-engine': 'bg-green-500',
    'alerts-engine': 'bg-blue-500',
    'collection-engine': 'bg-violet-500',
    'optimization-engine': 'bg-amber-500',
    'monitoring-service': 'bg-pink-500',
    'sentdex-engine': 'bg-orange-500',
    'analysis-engine': 'bg-teal-500',
};

const NODE_ICONS: Record<string, string> = {
    'candle_collected': '📊',
    'candle_synthesized': '🔄',
    'indicator_computed': '📈',
    'alert_evaluated': '🔍',
    'alert_fired': '🔔',
    'alert_suppressed': '🚫',
    'order_submitted': '📤',
    'order_filled': '✅',
    'order_closed': '🏁',
    'guardrail_blocked': '🛡',
};

interface Props {
    initialCorrelationId?: string;
}

export default function SignalInspector({initialCorrelationId}: Props) {
    const {isDarkMode} = useTheme();
    const [correlationId, setCorrelationId] = useState(initialCorrelationId || '');
    const [chain, setChain] = useState<BusSignal[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow transition-colors duration-500`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const inputCl = `text-sm rounded px-3 py-2 flex-1 font-mono ${isDarkMode ? 'bg-slate-700 text-gray-200 border-slate-600' : 'bg-gray-50 text-gray-800 border-gray-200'} border`;

    const search = useCallback(async () => {
        if (!correlationId.trim()) return;
        setLoading(true);
        setSearched(true);
        const results = await fetchSignalsByCorrelation(correlationId.trim());
        setChain(results || []);
        setLoading(false);
    }, [correlationId]);

    const formatTime = (ts: string) => {
        try {
            const d = new Date(ts);
            return d.toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'});
        } catch {
            return '??:??:??';
        }
    };

    const shortType = (t: string) => t.replace(/^neo\./, '').replace(/^trading\./, '').replace(/^alerts\./, '')
        .replace(/^collection\./, '').replace(/^optimizer\./, '');

    const getIcon = (event: string): string => {
        const short = shortType(event);
        return NODE_ICONS[short] || '○';
    };

    const keyFields = (sig: BusSignal): string[] => {
        const p = sig.payload || {};
        const parts: string[] = [];
        if (p.pair || p.symbol) parts.push(String(p.pair || p.symbol));
        if (p.profile) parts.push(`profile: ${p.profile}`);
        if (p.direction) parts.push(String(p.direction));
        if (p.score !== undefined) parts.push(`score: ${p.score}`);
        if (p.sharpe !== undefined) parts.push(`sharpe: ${p.sharpe}`);
        if (p.pnl !== undefined) parts.push(`P&L: ${p.pnl}`);
        if (p.reason) parts.push(String(p.reason));
        if (p.entry) parts.push(`entry: ${p.entry}`);
        if (p.sl) parts.push(`sl: ${p.sl}`);
        if (p.tp) parts.push(`tp: ${p.tp}`);
        if (p.fill_price) parts.push(`filled: ${p.fill_price}`);
        if (p.trade_id) parts.push(`trade: ${p.trade_id}`);
        if (p.order_id) parts.push(`order: ${p.order_id}`);
        if (p.timeframe || p.tf) parts.push(String(p.timeframe || p.tf));
        return parts;
    };

    return (
        <div className={`${card} p-4`}>
            {/* Search bar */}
            <div className="flex items-center gap-2 mb-4">
                <LinkIcon className="w-5 h-5 text-cyan-500 flex-shrink-0"/>
                <input
                    type="text"
                    value={correlationId}
                    onChange={e => setCorrelationId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && search()}
                    placeholder="Enter correlation ID..."
                    className={inputCl}
                />
                <button onClick={search} disabled={loading}
                    className="flex items-center gap-1 px-3 py-2 bg-cyan-600 text-white text-sm rounded hover:bg-cyan-500 disabled:opacity-50">
                    <MagnifyingGlassIcon className="w-4 h-4"/>
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </div>

            {/* Empty state */}
            {!searched && chain.length === 0 && (
                <div className={`text-center py-12 ${muted}`}>
                    <LinkIcon className="w-10 h-10 mx-auto mb-3 opacity-30"/>
                    <p className="text-sm">Enter a correlation ID to trace the event chain</p>
                    <p className="text-xs mt-1 opacity-60">Click the chain icon on any Live event to inspect its correlation</p>
                </div>
            )}

            {/* No results */}
            {searched && chain.length === 0 && !loading && (
                <div className={`text-center py-8 ${muted}`}>
                    <p className="text-sm">No events found for this correlation ID</p>
                    <p className="text-xs mt-1 opacity-60">Correlation chains populate once alerts-engine is wired to the signal bus</p>
                </div>
            )}

            {/* Chain timeline */}
            {chain.length > 0 && (
                <div className="relative ml-4">
                    {/* Vertical line */}
                    <div className={`absolute left-2 top-3 bottom-3 w-px ${isDarkMode ? 'bg-slate-600' : 'bg-gray-300'}`}/>

                    <div className="space-y-3">
                        {chain.map((sig) => (
                            <div key={sig.id} className="relative pl-8">
                                {/* Node dot */}
                                <div className="absolute left-0 top-1 w-5 h-5 flex items-center justify-center text-xs">
                                    {getIcon(sig.event)}
                                </div>

                                <div
                                    onClick={() => setExpanded(expanded === sig.id ? null : sig.id)}
                                    className={`rounded px-3 py-2 cursor-pointer transition-colors
                                        ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}
                                        ${expanded === sig.id ? (isDarkMode ? 'bg-slate-700' : 'bg-gray-50') : ''}`}>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className={`font-mono ${muted}`}>{formatTime(sig.ts)}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-white text-[10px] font-medium ${SERVICE_COLORS[sig.service] || 'bg-gray-500'}`}>
                                            {sig.service.replace('-engine', '').replace('-service', '')}
                                        </span>
                                        <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {shortType(sig.event)}
                                        </span>
                                    </div>
                                    {keyFields(sig).length > 0 && (
                                        <div className={`text-xs mt-1 ${muted}`}>
                                            {keyFields(sig).join(' | ')}
                                        </div>
                                    )}
                                </div>

                                {expanded === sig.id && (
                                    <pre className={`ml-0 mt-1 px-3 py-2 rounded text-[10px] overflow-x-auto font-mono ${isDarkMode ? 'bg-slate-900 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                        {JSON.stringify(sig, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
