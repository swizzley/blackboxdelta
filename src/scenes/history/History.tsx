import React, {useEffect, useState, useCallback, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {formatDollar, formatPct} from '../common/Util';
import {fetchOrders as apiFetchOrders, fetchLive, closeOrder, closeProfitableOrders} from '../../api/client';
import {connectOrders} from '../../api/sse';
import {OrderSummary, ApiOrder} from '../../context/Types';
import dayjs from 'dayjs';

const PAGE_SIZE = 50;
const LIVE_POLL_MS = 10_000;

// Candle durations in seconds per timeframe
const CANDLE_SECS: Record<string, number> = {scalp: 60, intraday: 900, swing: 86400};

function isSameCandle(o: OrderSummary): boolean {
    if (!o.closed) return false;
    const interval = CANDLE_SECS[o.timeframe] ?? 60;
    const created = Math.floor(new Date(o.created).getTime() / 1000);
    const closed = Math.floor(new Date(o.closed).getTime() / 1000);
    return Math.floor(created / interval) === Math.floor(closed / interval);
}

function apiOrderToSummary(o: ApiOrder): OrderSummary {
    return {
        id: o.id,
        symbol: o.symbol,
        direction: (o.quantity ?? 0) >= 0 ? 'Long' : 'Short',
        timeframe: o.timeframe,
        profile: o.profile,
        status: o.status,
        profit: o.profit,
        close_reason: o.close_reason,
        created: o.created,
        closed: o.closed,
        spread: o.spread,
        price: o.price,
        quantity: o.quantity,
    };
}

// Compute P&L % for a closed order from dollar profit and position notional
function closedPLPct(o: OrderSummary): number | null {
    if (o.profit == null || !o.price || !o.quantity) return null;
    const notional = o.price * Math.abs(o.quantity);
    if (notional === 0) return null;
    return o.profit / notional;
}

interface LivePL {
    unrealizedPL: number;
    currentPrice: number;
}

type SortKey = 'created' | 'symbol' | 'timeframe' | 'status' | 'profit' | 'direction';
type SortDir = 'asc' | 'desc';

export default function History() {
    const {isDarkMode} = useTheme();
    const {apiAvailable, apiBase} = useApi();
    const navigate = useNavigate();
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [page, setPage] = useState(0);
    const [sortKey, setSortKey] = useState<SortKey>('created');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [filterTimeframe, setFilterTimeframe] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [totalApiOrders, setTotalApiOrders] = useState(0);
    const sseCleanupRef = useRef<(() => void) | null>(null);
    const [liveMap, setLiveMap] = useState<Map<string, LivePL>>(new Map());
    const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
    const [closingAll, setClosingAll] = useState(false);

    const loadApiOrders = useCallback(async () => {
        const result = await apiFetchOrders({
            status: filterStatus !== 'all' ? filterStatus : undefined,
            timeframe: filterTimeframe !== 'all' ? filterTimeframe : undefined,
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
        });
        if (result) {
            setOrders(result.map(apiOrderToSummary));
            setTotalApiOrders(result.length === PAGE_SIZE ? (page + 2) * PAGE_SIZE : page * PAGE_SIZE + result.length);
        }
    }, [filterStatus, filterTimeframe, page]);

    useEffect(() => {
        if (apiAvailable) {
            loadApiOrders();
        }
    }, [apiAvailable, loadApiOrders]);

    // SSE: prepend new orders at top
    useEffect(() => {
        if (!apiAvailable) return;
        sseCleanupRef.current = connectOrders(apiBase, (order) => {
            setOrders(prev => [apiOrderToSummary(order), ...prev].slice(0, PAGE_SIZE));
        });
        return () => { sseCleanupRef.current?.(); };
    }, [apiAvailable, apiBase]);

    // Poll /api/live for unrealized P&L on open positions
    useEffect(() => {
        if (!apiAvailable) return;
        let active = true;
        const poll = async () => {
            const data = await fetchLive();
            if (!active || !data) return;
            const m = new Map<string, LivePL>();
            for (const o of data.open_orders) {
                if (o.unrealized_pl != null && o.current_price != null) {
                    m.set(o.id, {unrealizedPL: o.unrealized_pl, currentPrice: o.current_price});
                }
            }
            setLiveMap(m);
        };
        poll();
        const iv = setInterval(poll, LIVE_POLL_MS);
        return () => { active = false; clearInterval(iv); };
    }, [apiAvailable]);

    async function handleCloseOrder(e: React.MouseEvent, o: OrderSummary) {
        e.stopPropagation();
        const dir = (o.quantity ?? 0) >= 0 ? 'Long' : 'Short';
        if (!window.confirm(`Close ${o.symbol.replace('_', '/')} ${dir} at market?`)) return;
        setClosingIds(prev => new Set(prev).add(o.id));
        await closeOrder(o.id);
        // Poll until order status changes (up to 15s)
        let attempts = 0;
        const pollUntilClosed = setInterval(async () => {
            attempts++;
            await loadApiOrders();
            if (attempts >= 5) {
                clearInterval(pollUntilClosed);
                setClosingIds(prev => { const s = new Set(prev); s.delete(o.id); return s; });
            }
        }, 3000);
    }

    async function handleTakeProfitNow() {
        const profitableCount = profitableOpenCount;
        if (profitableCount === 0) return;
        if (!window.confirm(`Close ${profitableCount} profitable order${profitableCount > 1 ? 's' : ''} at market?`)) return;
        setClosingAll(true);
        await closeProfitableOrders();
        // Poll until orders reflect the close (up to 15s)
        let attempts = 0;
        const pollUntilClosed = setInterval(async () => {
            attempts++;
            await loadApiOrders();
            const stillOpen = Array.from(liveMap.values()).filter(lp => lp.unrealizedPL > 0).length;
            if (stillOpen === 0 || attempts >= 5) {
                clearInterval(pollUntilClosed);
                setClosingAll(false);
                setLiveMap(new Map());
            }
        }, 3000);
    }

    // Count profitable open orders from live data (not paginated orders list)
    const profitableOpenCount = Array.from(liveMap.values()).filter(lp => lp.unrealizedPL > 0).length;

    function handleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
        setPage(0);
    }

    // Filtering is server-side in API mode (params passed to loadApiOrders)
    const filtered = orders;

    // For sorting, use live unrealized P&L for open orders
    const getPL = (o: OrderSummary): number => {
        if (o.status === 'FILLED') {
            const live = liveMap.get(o.id);
            return live ? live.unrealizedPL : 0;
        }
        return closedPLPct(o) ?? 0;
    };

    const sorted = [...filtered].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
            case 'created':
                cmp = a.created.localeCompare(b.created);
                break;
            case 'symbol':
                cmp = a.symbol.localeCompare(b.symbol);
                break;
            case 'timeframe':
                cmp = a.timeframe.localeCompare(b.timeframe);
                break;
            case 'status':
                cmp = a.status.localeCompare(b.status);
                break;
            case 'direction':
                cmp = a.direction.localeCompare(b.direction);
                break;
            case 'profit':
                cmp = getPL(a) - getPL(b);
                break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
    });

    const totalPages = Math.ceil(totalApiOrders / PAGE_SIZE);
    const paged = sorted;

    const th = `px-3 py-2 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none`;
    const td = `px-3 py-2 text-sm whitespace-nowrap`;

    function SortIndicator({col}: { col: SortKey }) {
        if (sortKey !== col) return null;
        return <span className="ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
    }

    // Render P&L cell for an order
    function PLCell({o}: { o: OrderSummary }) {
        // FILLED — show live unrealized P&L
        if (o.status === 'FILLED') {
            const live = liveMap.get(o.id);
            if (!live) return <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>...</span>;
            const pct = live.unrealizedPL;
            const color = pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-red-400' : isDarkMode ? 'text-gray-400' : 'text-gray-500';
            return (
                <span className={`${color} inline-flex items-center gap-1`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" title="Live"/>
                    {formatPct(pct)}
                </span>
            );
        }
        // CLOSED — show realized P&L as %
        if (o.status === 'CLOSED') {
            const pct = closedPLPct(o);
            if (pct == null) return <span>-</span>;
            const color = pct > 0 ? 'text-emerald-500' : pct < 0 ? 'text-red-500' : '';
            return <span className={color}>{formatPct(pct)}</span>;
        }
        // PENDING / CANCELLED
        return <span>-</span>;
    }

    const selectClass = `rounded text-sm px-2 py-1 ${isDarkMode ? 'bg-slate-700 text-gray-200 border-slate-600' : 'bg-white text-gray-700 border-gray-300'} border`;

    if (!apiAvailable) {
        return (
            <>
                <Nav/>
                <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-12 text-center transition-colors duration-500`}>
                            <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                Order history requires VPN access.
                            </p>
                            <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                Connect to VPN to view live order history.
                            </p>
                        </div>
                    </div>
                </div>
                <Foot/>
            </>
        );
    }

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow transition-colors duration-500`}>
                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-4 p-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                Order History
                                <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400 leading-none align-middle"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>LIVE</span>
                            </h2>
                            <div className="flex gap-2 ml-auto items-center">
                                {profitableOpenCount > 0 && (
                                    <button
                                        onClick={handleTakeProfitNow}
                                        disabled={closingAll}
                                        className="px-3 py-1 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
                                    >
                                        {closingAll ? 'Closing...' : `Take Profit Now (${profitableOpenCount})`}
                                    </button>
                                )}
                                <select value={filterTimeframe} onChange={e => { setFilterTimeframe(e.target.value); setPage(0); }} className={selectClass}>
                                    <option value="all">All Timeframes</option>
                                    <option value="scalp">Scalp</option>
                                    <option value="intraday">Intraday</option>
                                    <option value="swing">Swing</option>
                                </select>
                                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }} className={selectClass}>
                                    <option value="all">All Status</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="FILLED">Filled</option>
                                    <option value="CLOSED">Closed</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className={isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}>
                                <tr className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                                    <th className={th} onClick={() => handleSort('created')}>Date<SortIndicator col="created"/></th>
                                    <th className={th} onClick={() => handleSort('symbol')}>Symbol<SortIndicator col="symbol"/></th>
                                    <th className={th} onClick={() => handleSort('direction')}><span className="hidden sm:inline">Direction</span><span className="sm:hidden">Dir</span><SortIndicator col="direction"/></th>
                                    <th className={th} onClick={() => handleSort('timeframe')}>Timeframe<SortIndicator col="timeframe"/></th>
                                    <th className={th}>Profile</th>
                                    <th className={th} onClick={() => handleSort('status')}>Status<SortIndicator col="status"/></th>
                                    <th className={th}>Reason</th>
                                    <th className={th}>Spread</th>
                                    <th className={th} onClick={() => handleSort('profit')}>P&L %<SortIndicator col="profit"/></th>
                                </tr>
                                </thead>
                                <tbody>
                                {(() => {
                                    const rows: React.ReactNode[] = [];
                                    let lastDay = '';
                                    paged.forEach(o => {
                                        const day = o.created.slice(0, 10);
                                        if (day !== lastDay) {
                                            // Compute day totals for closed orders in this page
                                            const dayOrders = paged.filter(x => x.created.startsWith(day));
                                            const dayPL = dayOrders.reduce((sum, x) => sum + (x.profit ?? 0), 0);
                                            const closed = dayOrders.filter(x => x.profit !== null);
                                            const wins = closed.filter(x => (x.profit ?? 0) > 0).length;
                                            const openCount = dayOrders.filter(x => x.status === 'FILLED').length;
                                            lastDay = day;
                                            rows.push(
                                                <tr key={`day-${day}`} className={isDarkMode ? 'bg-slate-700/60' : 'bg-gray-100/80'}>
                                                    <td colSpan={9} className="px-3 py-1.5">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                                {dayjs(day).format('ddd, MMM D YYYY')}
                                                            </span>
                                                            <span className={`text-xs font-bold ${dayPL > 0 ? 'text-emerald-500' : dayPL < 0 ? 'text-red-500' : isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                {formatDollar(dayPL)}
                                                            </span>
                                                            {closed.length > 0 && (
                                                                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                    {wins}W/{closed.length - wins}L
                                                                </span>
                                                            )}
                                                            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                {dayOrders.length} orders
                                                            </span>
                                                            {openCount > 0 && (
                                                                <span className="text-xs text-blue-400">
                                                                    {openCount} open
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        rows.push(
                                            <tr
                                                key={o.id}
                                                onClick={() => navigate(`/trade/${o.created.slice(0,10).replace(/-/g,'/')}/${o.id}`)}
                                                className={`cursor-pointer border-t ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50 text-gray-200' : 'border-gray-100 hover:bg-gray-50 text-gray-700'}`}
                                            >
                                                <td className={td}>{dayjs(o.created).format('YYYY-MM-DD HH:mm')}</td>
                                                <td className={`${td} font-medium`}>
                                                    {o.symbol.replace('_', '/')}
                                                    {isSameCandle(o) && <span className="text-pink-500 ml-0.5" title="Entry and exit on same candle">*</span>}
                                                </td>
                                                <td className={td}>
                                                    <span className={o.direction === 'Long' ? 'text-emerald-500' : 'text-red-500'}>
                                                        {o.direction}
                                                    </span>
                                                </td>
                                                <td className={td}>{o.timeframe}</td>
                                                <td className={td}>
                                                    {o.profile && o.profile !== 'default'
                                                        ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>{o.profile}</span>
                                                        : <span className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                                                    }
                                                </td>
                                                <td className={td}>
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                                                        ${o.status === 'CLOSED' ? 'bg-gray-100 text-gray-700 dark:bg-slate-600 dark:text-gray-300' :
                                                        o.status === 'FILLED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                            o.status === 'CANCELLED' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                                'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'}`}
                                                    >
                                                        {o.status}
                                                    </span>
                                                </td>
                                                <td className={`${td} text-xs`}>{o.close_reason ?? '-'}</td>
                                                <td className={`${td} text-xs`}>{o.spread ? o.spread.toFixed(5) : '-'}</td>
                                                <td className={`${td} font-medium`}>
                                                    <div className="flex items-center gap-1.5">
                                                        <PLCell o={o}/>
                                                        {o.status === 'FILLED' && !closingIds.has(o.id) && (
                                                            <button
                                                                onClick={(e) => handleCloseOrder(e, o)}
                                                                className="text-red-400 hover:text-red-300 text-xs font-bold opacity-40 hover:opacity-100 transition-opacity"
                                                                title="Close at market"
                                                            >×</button>
                                                        )}
                                                        {closingIds.has(o.id) && (
                                                            <span className="text-yellow-400 text-[10px] animate-pulse">closing</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    });
                                    return rows;
                                })()}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className={`flex items-center justify-between p-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {sorted.length} orders ({paged.length > 0 ? `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, sorted.length)}` : '0'})
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className={`px-3 py-1 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-gray-200 disabled:opacity-30' : 'bg-gray-100 text-gray-700 disabled:opacity-30'}`}
                                >
                                    Prev
                                </button>
                                <span className={`px-2 py-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {page + 1} / {totalPages || 1}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className={`px-3 py-1 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-gray-200 disabled:opacity-30' : 'bg-gray-100 text-gray-700 disabled:opacity-30'}`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Foot/>
        </>
    );
}
