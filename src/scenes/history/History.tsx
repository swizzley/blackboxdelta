import React, {useEffect, useState, useCallback, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {formatDollar} from '../common/Util';
import {fetchOrders as apiFetchOrders} from '../../api/client';
import {connectOrders} from '../../api/sse';
import {OrderSummary, ApiOrder} from '../../context/Types';
import dayjs from 'dayjs';

const PAGE_SIZE = 50;

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
        direction: o.direction,
        timeframe: o.timeframe,
        status: o.status,
        profit: o.profit,
        close_reason: o.close_reason,
        created: o.created,
        closed: o.closed,
    };
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
                cmp = (a.profit ?? 0) - (b.profit ?? 0);
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
                            <div className="flex gap-2 ml-auto">
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
                                    <th className={th} onClick={() => handleSort('direction')}>Dir<SortIndicator col="direction"/></th>
                                    <th className={th} onClick={() => handleSort('timeframe')}>Timeframe<SortIndicator col="timeframe"/></th>
                                    <th className={th} onClick={() => handleSort('status')}>Status<SortIndicator col="status"/></th>
                                    <th className={th}>Reason</th>
                                    <th className={th} onClick={() => handleSort('profit')}>P&L<SortIndicator col="profit"/></th>
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
                                            lastDay = day;
                                            rows.push(
                                                <tr key={`day-${day}`} className={isDarkMode ? 'bg-slate-700/60' : 'bg-gray-100/80'}>
                                                    <td colSpan={7} className="px-3 py-1.5">
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
                                                <td className={`${td} font-medium ${
                                                    o.profit === null ? '' :
                                                        o.profit > 0 ? 'text-emerald-500' :
                                                            o.profit < 0 ? 'text-red-500' : ''
                                                }`}>
                                                    {o.profit !== null ? formatDollar(o.profit) : '-'}
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
