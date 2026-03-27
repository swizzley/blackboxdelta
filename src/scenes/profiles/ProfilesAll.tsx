import {useEffect, useState, useCallback, useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {
    fetchOptimizerAllProfiles, fetchOptimizerSeedRuns,
    enableProfile, disableProfile, deleteProfile,
    reseedProfile, fetchDashboard, fetchProfileTimeline,
    fetchOptimizerGenerations, fetchProfileHistory, fetchOrders, fetchProfileParams, fetchLHCRuns,
} from '../../api/client';
import type {OptimizerAllProfilesResponse, SeedRun, ProfileFlat, ProfileStage, ProfileStats, ProfileTimelineResponse, OptimizerGeneration, ProfileHistoryEntry, ApiOrder, ProfileParamsResponse, LHCRun} from '../../context/Types';
import {flattenProfiles, matchesSearch, STAGE_ORDER, STAGE_COLORS, STAGE_LABELS} from './utils';
import {GenerationRow, fmtNum, plColor} from './components/shared';
import Tooltip from '../common/Tooltip';
import {ClockIcon, ChartBarIcon, ListBulletIcon, AdjustmentsHorizontalIcon, BoltIcon, ArrowsRightLeftIcon, ArrowTrendingUpIcon} from '@heroicons/react/24/outline';
import ReactECharts from 'echarts-for-react';

type SortKey = 'name' | 'timeframe' | 'stage' | 'sharpe' | 'win_rate' | 'pf' | 'trades' | 'pnl' | 'drawdown' | 'gens' | 'failures' | 'updated' | 'live_trades' | 'live_wr' | 'live_pnl' | 'time_live';

const PAGE_SIZE = 50;

export default function ProfilesAll() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const [searchParams, setSearchParams] = useSearchParams();

    const [rawData, setRawData] = useState<OptimizerAllProfilesResponse | null>(null);
    const [seedRuns, setSeedRuns] = useState<SeedRun[]>([]);
    const [lhcRuns, setLhcRuns] = useState<LHCRun[]>([]);
    const [liveStats, setLiveStats] = useState<Map<string, ProfileStats>>(new Map());
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Unified expansion: {key: "tf:name", panel: "timeline"|"gens"|"history"|"trades"|"params"}
    const [expanded, setExpanded] = useState<{key: string; panel: string} | null>(null);
    const [timeline, setTimeline] = useState<ProfileTimelineResponse | null>(null);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [genHistory, setGenHistory] = useState<OptimizerGeneration[]>([]);
    const [genHistoryLoading, setGenHistoryLoading] = useState(false);
    const [genHistoryPage, setGenHistoryPage] = useState(0);
    const [baselineHistory, setBaselineHistory] = useState<ProfileHistoryEntry[]>([]);
    const [baselineHistoryLoading, setBaselineHistoryLoading] = useState(false);
    const [trades, setTrades] = useState<ApiOrder[]>([]);
    const [tradesLoading, setTradesLoading] = useState(false);
    const [tradePage, setTradePage] = useState(0);
    const [params, setParams] = useState<ProfileParamsResponse | null>(null);
    const [paramsLoading, setParamsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionDone, setActionDone] = useState<string | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    // Filter state from URL params
    const nameFilter = searchParams.get('name') ?? '';
    const tfFilter = (searchParams.get('tf') ?? 'all') as 'all' | 'scalp' | 'intraday' | 'swing';
    const stageFilter = (searchParams.get('stage') ?? 'all') as ProfileStage | 'all';
    const enabledFilter = (searchParams.get('enabled') ?? 'all') as 'all' | 'yes' | 'no';
    const liveFilter = (searchParams.get('live') ?? 'all') as 'all' | 'yes' | 'no';
    const sortKey = (searchParams.get('sort') ?? 'sharpe') as SortKey;
    const sortDir = (searchParams.get('dir') ?? 'desc') as 'asc' | 'desc';
    const page = parseInt(searchParams.get('page') ?? '0', 10);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(searchParams);
        if (value === '' || value === 'all' || value === '0') {
            next.delete(key);
        } else {
            next.set(key, value);
        }
        // Reset page on filter change
        if (key !== 'page') next.delete('page');
        setSearchParams(next, {replace: true});
    };

    const loadData = useCallback(async () => {
        if (!apiAvailable) return;
        const [pd, sr, dash, lhc] = await Promise.all([
            fetchOptimizerAllProfiles(),
            fetchOptimizerSeedRuns(),
            fetchDashboard(),
            fetchLHCRuns(),
        ]);
        if (pd) setRawData(pd);
        if (sr) setSeedRuns(sr);
        if (lhc) setLhcRuns(lhc);
        if (dash?.by_profile) {
            const map = new Map<string, ProfileStats>();
            for (const ps of dash.by_profile) {
                map.set(`${ps.timeframe}:${ps.profile}`, ps);
            }
            setLiveStats(map);
        }
        setLoading(false);
    }, [apiAvailable]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, [loadData]);

    const allProfiles: ProfileFlat[] = useMemo(() => rawData ? flattenProfiles(rawData, seedRuns, lhcRuns) : [], [rawData, seedRuns, lhcRuns]);

    // Apply filters
    const filtered = useMemo(() => {
        return allProfiles.filter(p => {
            if (tfFilter !== 'all' && p.timeframe !== tfFilter) return false;
            if (stageFilter !== 'all' && p.stage !== stageFilter) return false;
            if (enabledFilter === 'yes' && !p.enabled) return false;
            if (enabledFilter === 'no' && p.enabled) return false;
            if (liveFilter === 'yes' && !p.live) return false;
            if (liveFilter === 'no' && p.live) return false;
            if (nameFilter && !matchesSearch(p, nameFilter)) return false;
            return true;
        });
    }, [allProfiles, tfFilter, stageFilter, enabledFilter, liveFilter, nameFilter]);

    // Helper to get live stats for a profile
    const getLive = useCallback((p: ProfileFlat) => liveStats.get(`${p.timeframe}:${p.name}`), [liveStats]);

    // Sort
    const sorted = useMemo(() => {
        const getStat = (p: ProfileFlat) => p.baseline?.stats;
        const cmp = (a: ProfileFlat, b: ProfileFlat): number => {
            let av: number | string = 0, bv: number | string = 0;
            switch (sortKey) {
                case 'name': av = a.name; bv = b.name; break;
                case 'timeframe': av = a.timeframe; bv = b.timeframe; break;
                case 'stage': av = STAGE_ORDER.indexOf(a.stage); bv = STAGE_ORDER.indexOf(b.stage); break;
                case 'sharpe': av = getStat(a)?.sharpe_ratio ?? -999; bv = getStat(b)?.sharpe_ratio ?? -999; break;
                case 'win_rate': av = getStat(a)?.win_rate ?? -999; bv = getStat(b)?.win_rate ?? -999; break;
                case 'pf': av = getStat(a)?.profit_factor ?? -999; bv = getStat(b)?.profit_factor ?? -999; break;
                case 'trades': av = getStat(a)?.total_trades ?? 0; bv = getStat(b)?.total_trades ?? 0; break;
                case 'pnl': av = getStat(a)?.total_pnl ?? -999; bv = getStat(b)?.total_pnl ?? -999; break;
                case 'drawdown': av = getStat(a)?.max_drawdown ?? 0; bv = getStat(b)?.max_drawdown ?? 0; break;
                case 'gens': av = a.baseline?.generation_counter ?? 0; bv = b.baseline?.generation_counter ?? 0; break;
                case 'failures': av = a.baseline?.consecutive_failures ?? 0; bv = b.baseline?.consecutive_failures ?? 0; break;
                case 'updated': av = a.baseline?.updated_at ?? ''; bv = b.baseline?.updated_at ?? ''; break;
                case 'live_trades': av = getLive(a)?.total_orders ?? 0; bv = getLive(b)?.total_orders ?? 0; break;
                case 'live_wr': av = getLive(a)?.win_rate_pct ?? -999; bv = getLive(b)?.win_rate_pct ?? -999; break;
                case 'live_pnl': av = getLive(a)?.total_pl ?? -999; bv = getLive(b)?.total_pl ?? -999; break;
                case 'time_live': {
                    const ap = a.baseline?.pushed_at; const bp = b.baseline?.pushed_at;
                    av = ap ? new Date(ap).getTime() : 0; bv = bp ? new Date(bp).getTime() : 0; break;
                }
            }
            if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
            return sortDir === 'asc' ? av - (bv as number) : (bv as number) - av;
        };
        return [...filtered].sort(cmp);
    }, [filtered, sortKey, sortDir, getLive]);

    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
    const pageProfiles = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setParam('dir', sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            const next = new URLSearchParams(searchParams);
            next.set('sort', key);
            next.set('dir', 'desc');
            next.delete('page');
            setSearchParams(next, {replace: true});
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === pageProfiles.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(pageProfiles.map(p => `${p.timeframe}:${p.name}`)));
        }
    };

    const doAction = async (action: (name: string, tf: string) => Promise<any>, name: string, tf: string) => {
        const key = `${tf}:${name}`;
        setActionLoading(key);
        await action(name, tf);
        setActionLoading(null);
        setActionDone(key);
        setTimeout(() => setActionDone(null), 2000);
        loadData();
    };

    const doBulkAction = async (action: (name: string, tf: string) => Promise<any>) => {
        setBulkLoading(true);
        const selected = allProfiles.filter(p => selectedIds.has(`${p.timeframe}:${p.name}`));
        await Promise.all(selected.map(p => action(p.name, p.timeframe)));
        setBulkLoading(false);
        setSelectedIds(new Set());
        loadData();
    };

    const GEN_PAGE_SIZE = 5;

    const togglePanel = async (p: ProfileFlat, panel: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const key = `${p.timeframe}:${p.name}`;
        // Toggle off if same panel on same row
        if (expanded?.key === key && expanded.panel === panel) {
            setExpanded(null);
            return;
        }
        setExpanded({key, panel});

        if (panel === 'timeline') {
            setTimeline(null);
            setTimelineLoading(true);
            const tl = await fetchProfileTimeline(p.name, p.timeframe);
            setTimeline(tl);
            setTimelineLoading(false);
        } else if (panel === 'gens') {
            setGenHistory([]);
            setGenHistoryPage(0);
            setGenHistoryLoading(true);
            const gens = await fetchOptimizerGenerations(100);
            setGenHistory((gens ?? []).filter(g => g.target_profile === p.name && g.timeframe === p.timeframe));
            setGenHistoryLoading(false);
        } else if (panel === 'history') {
            setBaselineHistory([]);
            setBaselineHistoryLoading(true);
            const res = await fetchProfileHistory(p.name, p.timeframe);
            setBaselineHistory(res?.history ?? []);
            setBaselineHistoryLoading(false);
        } else if (panel === 'trades') {
            setTrades([]);
            setTradePage(0);
            setTradesLoading(true);
            const orders = await fetchOrders({profile: p.name, timeframe: p.timeframe, status: 'CLOSED', limit: 500});
            setTrades(orders ?? []);
            setTradesLoading(false);
        } else if (panel === 'params') {
            setParams(null);
            setParamsLoading(true);
            const pr = await fetchProfileParams(p.name, p.timeframe);
            setParams(pr);
            setParamsLoading(false);
        }
    };

    // Compute "time live" from first order date
    const timeLive = (p: ProfileFlat): string => {
        const firstOrder = p.first_order_at;
        if (!firstOrder) return '—';
        const days = Math.floor((Date.now() - new Date(firstOrder).getTime()) / 86400000);
        if (days < 1) return '<1d';
        if (days < 30) return `${days}d`;
        return `${Math.floor(days / 30)}mo ${days % 30}d`;
    };

    const headerTips: Partial<Record<SortKey, string>> = {
        sharpe: 'Backtest Sharpe Ratio', win_rate: 'Backtest Win Rate %', pf: 'Backtest Profit Factor',
        trades: 'Backtest Trade Count', pnl: 'Backtest P&L',
        live_trades: 'Live Trade Count', live_wr: 'Live Win Rate %', live_pnl: 'Live P&L',
        time_live: 'Time Since First Trade', gens: 'Generation Counter', failures: 'Consecutive Failures',
    };
    const SortHeader = ({label, field, className}: {label: string; field: SortKey; className?: string}) => (
        <th
            onClick={() => toggleSort(field)}
            className={`cursor-pointer select-none px-1 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide ${muted} hover:text-cyan-400 whitespace-nowrap ${className ?? ''}`}
        >
            {headerTips[field] ? (
                <Tooltip content={headerTips[field]!} className="inline">{label}{sortKey === field ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}</Tooltip>
            ) : (
                <>{label}{sortKey === field ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}</>
            )}
        </th>
    );

    // Chart data
    const stageChartData = useMemo(() => STAGE_ORDER.map(s => ({
        name: s,
        value: allProfiles.filter(p => p.stage === s).length,
    })).filter(d => d.value > 0), [allProfiles]);

    const sharpeHistogram = useMemo(() => {
        const buckets = [{label: '< -0.5', min: -Infinity, max: -0.5}, {label: '-0.5–0', min: -0.5, max: 0}, {label: '0–0.5', min: 0, max: 0.5}, {label: '0.5–1.0', min: 0.5, max: 1.0}, {label: '1.0–1.5', min: 1.0, max: 1.5}, {label: '1.5+', min: 1.5, max: Infinity}];
        return buckets.map(b => ({
            label: b.label,
            count: allProfiles.filter(p => {
                const s = p.baseline?.stats?.sharpe_ratio;
                return s != null && s >= b.min && s < b.max;
            }).length,
        }));
    }, [allProfiles]);

    const scatterData = useMemo(() =>
        allProfiles
            .filter(p => p.baseline?.stats)
            .map(p => [p.baseline!.stats!.total_trades, p.baseline!.stats!.sharpe_ratio, p.name, p.timeframe]),
        [allProfiles]
    );

    const chartTextColor = isDarkMode ? '#9ca3af' : '#6b7280';
    const chartGridColor = isDarkMode ? '#334155' : '#e5e7eb';

    if (loading) {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
                <Nav/>
                <main className="-mt-24 pb-8"><div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
                    <div className={card}><p className={muted}>Loading profiles...</p></div>
                </div></main>
                <Foot/>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'} transition-colors duration-500`}>
            <Nav/>
            <main className="-mt-24 pb-8">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 space-y-6">

                    {/* Header */}
                    <div className={`${card} !p-3 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <a href="/profiles" className={`text-xs ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>&larr; Dashboard</a>
                            <span className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>All Profiles</span>
                            <span className={`text-sm font-mono ${muted}`}>{allProfiles.length} total, {filtered.length} shown</span>
                        </div>
                    </div>

                    {/* Summary Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Stage Distribution Donut */}
                        <div className={card}>
                            <ReactECharts
                                style={{height: 220}}
                                option={{
                                    tooltip: {trigger: 'item', formatter: '{b}: {c} ({d}%)'},
                                    series: [{
                                        type: 'pie',
                                        radius: ['45%', '70%'],
                                        center: ['50%', '55%'],
                                        data: stageChartData.map(d => ({
                                            name: d.name,
                                            value: d.value,
                                            itemStyle: {color: ({
                                                disabled: '#64748b', queued: '#94a3b8', seeding: '#22d3ee',
                                                optimizing: '#3b82f6', lhc: '#8b5cf6', promoted: '#10b981',
                                                soaking: '#f59e0b', live: '#22c55e',
                                            } as Record<string, string>)[d.name] ?? '#64748b'},
                                        })),
                                        label: {show: false},
                                        emphasis: {label: {show: true, fontSize: 12, color: chartTextColor}},
                                    }],
                                    backgroundColor: 'transparent',
                                }}
                            />
                            <p className={`text-center text-xs ${muted} -mt-2`}>Pipeline Distribution</p>
                        </div>

                        {/* Sharpe Histogram */}
                        <div className={card}>
                            <ReactECharts
                                style={{height: 220}}
                                option={{
                                    tooltip: {trigger: 'axis'},
                                    xAxis: {type: 'category', data: sharpeHistogram.map(b => b.label), axisLabel: {color: chartTextColor, fontSize: 10}, axisLine: {lineStyle: {color: chartGridColor}}},
                                    yAxis: {type: 'value', axisLabel: {color: chartTextColor, fontSize: 10}, splitLine: {lineStyle: {color: chartGridColor}}},
                                    series: [{type: 'bar', data: sharpeHistogram.map((b, i) => ({value: b.count, itemStyle: {color: i < 2 ? '#ef4444' : i < 3 ? '#f59e0b' : '#10b981'}})), barWidth: '60%'}],
                                    grid: {left: 40, right: 10, top: 10, bottom: 25},
                                    backgroundColor: 'transparent',
                                }}
                            />
                            <p className={`text-center text-xs ${muted} -mt-2`}>Sharpe Distribution</p>
                        </div>

                        {/* Sharpe vs Trades Scatter */}
                        <div className={card}>
                            <ReactECharts
                                style={{height: 220}}
                                option={{
                                    tooltip: {trigger: 'item', formatter: (p: any) => `${p.data[2]} (${p.data[3]})<br/>Trades: ${p.data[0]}, Sharpe: ${p.data[1].toFixed(2)}`},
                                    xAxis: {type: 'value', name: 'Trades', nameTextStyle: {color: chartTextColor, fontSize: 10}, axisLabel: {color: chartTextColor, fontSize: 10}, axisLine: {lineStyle: {color: chartGridColor}}, splitLine: {lineStyle: {color: chartGridColor}}},
                                    yAxis: {type: 'value', name: 'Sharpe', nameTextStyle: {color: chartTextColor, fontSize: 10}, axisLabel: {color: chartTextColor, fontSize: 10}, axisLine: {lineStyle: {color: chartGridColor}}, splitLine: {lineStyle: {color: chartGridColor}}},
                                    series: [{type: 'scatter', data: scatterData, symbolSize: 8, itemStyle: {color: '#3b82f6', opacity: 0.7}}],
                                    grid: {left: 45, right: 10, top: 15, bottom: 30},
                                    backgroundColor: 'transparent',
                                }}
                            />
                            <p className={`text-center text-xs ${muted} -mt-2`}>Sharpe vs Trade Count</p>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className={`${card} !p-3 flex flex-wrap items-center gap-2`}>
                        <div className="relative min-w-[160px]">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={nameFilter}
                                onChange={e => setParam('name', e.target.value)}
                                className={`w-full rounded-md px-2 py-1 pr-6 text-xs ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border focus:outline-none focus:ring-1 focus:ring-cyan-500`}
                            />
                            {nameFilter && (
                                <button
                                    onClick={() => setParam('name', '')}
                                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-xs leading-none ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                                >&times;</button>
                            )}
                        </div>
                        <select value={tfFilter} onChange={e => setParam('tf', e.target.value)}
                            className={`rounded-md px-2 py-1 text-xs ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border`}>
                            <option value="all">TF: All</option>
                            <option value="scalp">TF: Scalp</option>
                            <option value="intraday">TF: Intraday</option>
                            <option value="swing">TF: Swing</option>
                        </select>
                        <select value={stageFilter} onChange={e => setParam('stage', e.target.value)}
                            className={`rounded-md px-2 py-1 text-xs ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border`}>
                            <option value="all">Stage: All</option>
                            {STAGE_ORDER.map(s => <option key={s} value={s}>Stage: {STAGE_LABELS[s]}</option>)}
                        </select>
                        <select value={enabledFilter} onChange={e => setParam('enabled', e.target.value)}
                            className={`rounded-md px-2 py-1 text-xs ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border`}>
                            <option value="all">Enabled: All</option>
                            <option value="yes">Enabled</option>
                            <option value="no">Disabled</option>
                        </select>
                        <select value={liveFilter} onChange={e => setParam('live', e.target.value)}
                            className={`rounded-md px-2 py-1 text-xs ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border`}>
                            <option value="all">Live: All</option>
                            <option value="yes">Live</option>
                            <option value="no">Not Live</option>
                        </select>
                        {(nameFilter || tfFilter !== 'all' || stageFilter !== 'all' || enabledFilter !== 'all' || liveFilter !== 'all') && (
                            <button
                                onClick={() => setSearchParams({}, {replace: true})}
                                className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>

                    {/* Bulk Actions */}
                    {selectedIds.size > 0 && (
                        <div className={`${card} !p-3 flex items-center gap-3 sticky bottom-4 z-20 ring-2 ${isDarkMode ? 'ring-cyan-800' : 'ring-cyan-300'}`}>
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedIds.size} selected</span>
                            <button disabled={bulkLoading} onClick={() => doBulkAction(enableProfile)}
                                className={`px-2 py-1 text-xs font-medium rounded ${isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'}`}>
                                Enable All
                            </button>
                            <button disabled={bulkLoading} onClick={() => doBulkAction(disableProfile)}
                                className={`px-2 py-1 text-xs font-medium rounded ${isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'}`}>
                                Disable All
                            </button>
                            <button disabled={bulkLoading} onClick={() => doBulkAction(reseedProfile)}
                                className={`px-2 py-1 text-xs font-medium rounded ${isDarkMode ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-50 text-cyan-700'}`}>
                                Reseed All
                            </button>
                            <button disabled={bulkLoading} onClick={() => { if (confirm('Delete selected profiles? This cannot be undone.')) doBulkAction(deleteProfile); }}
                                className={`px-2 py-1 text-xs font-medium rounded ${isDarkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700'}`}>
                                Delete
                            </button>
                            <button onClick={() => setSelectedIds(new Set())}
                                className={`ml-auto text-xs ${muted} hover:underline`}>
                                Clear
                            </button>
                        </div>
                    )}

                    {/* Profile Table */}
                    <div className={card}>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className={`border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                        <th className="px-1 py-1.5 w-6">
                                            <input type="checkbox" checked={selectedIds.size === pageProfiles.length && pageProfiles.length > 0}
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-500"/>
                                        </th>
                                        <SortHeader label="Name" field="name"/>
                                        <SortHeader label="TF" field="timeframe"/>
                                        <SortHeader label="St" field="stage"/>
                                        {/* Backtest */}
                                        <SortHeader label="BT S" field="sharpe"/>
                                        <SortHeader label="WR" field="win_rate"/>
                                        <SortHeader label="PF" field="pf"/>
                                        <SortHeader label="Trd" field="trades" className="hidden md:table-cell"/>
                                        <SortHeader label="P&L" field="pnl" className="hidden md:table-cell"/>
                                        {/* Live */}
                                        <SortHeader label="L.Trd" field="live_trades"/>
                                        <SortHeader label="L.WR" field="live_wr"/>
                                        <SortHeader label="L.P&L" field="live_pnl"/>
                                        <SortHeader label="Soak" field="time_live" className="hidden lg:table-cell"/>
                                        {/* Meta */}
                                        <SortHeader label="G" field="gens" className="hidden xl:table-cell"/>
                                        <SortHeader label="F" field="failures" className="hidden xl:table-cell"/>
                                        <th className={`px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-right ${muted}`}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageProfiles.flatMap(p => {
                                        const s = p.baseline?.stats;
                                        const live = getLive(p);
                                        const key = `${p.timeframe}:${p.name}`;
                                        const isAnyExp = expanded?.key === key;
                                        const rows = [
                                            <tr key={key} onClick={() => togglePanel(p, 'timeline')}
                                                className={`border-b cursor-pointer transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-gray-100 hover:bg-gray-50'} ${isAnyExp ? (isDarkMode ? 'bg-slate-700/40' : 'bg-gray-50') : ''}`}>
                                                <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                                                    <input type="checkbox" checked={selectedIds.has(key)} onChange={() => toggleSelect(key)} className="rounded border-gray-500"/>
                                                </td>
                                                <td className={`px-1 py-1 font-mono text-[11px] font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{p.name}</td>
                                                <td className="px-1 py-1">
                                                    <Tooltip content={p.timeframe === 'scalp' ? 'Scalp (1m)' : p.timeframe === 'intraday' ? 'Intraday (15m)' : 'Swing (daily)'}>
                                                        {p.timeframe === 'scalp'
                                                            ? <BoltIcon className="w-3.5 h-3.5 text-purple-400"/>
                                                            : p.timeframe === 'intraday'
                                                            ? <ArrowsRightLeftIcon className="w-3.5 h-3.5 text-blue-400"/>
                                                            : <ArrowTrendingUpIcon className="w-3.5 h-3.5 text-amber-400"/>
                                                        }
                                                    </Tooltip>
                                                </td>
                                                <td className="px-1 py-1">
                                                    <Tooltip content={<>{STAGE_LABELS[p.stage] ?? p.stage}{p.disabled_reason ? ` (${p.disabled_reason})` : ''}</>}>
                                                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${STAGE_COLORS[p.stage]?.dot ?? 'bg-gray-500'} ${p.stage === 'live' || p.stage === 'seeding' ? 'animate-pulse' : ''}`}/>
                                                    </Tooltip>
                                                </td>
                                                {/* Backtest */}
                                                <td className={`px-1 py-1 text-[11px] font-mono ${s && s.sharpe_ratio >= 1 ? 'text-emerald-400' : s && s.sharpe_ratio >= 0 ? (isDarkMode ? 'text-amber-400' : 'text-amber-600') : s ? 'text-red-400' : muted}`}>
                                                    {s ? s.sharpe_ratio.toFixed(2) : '—'}
                                                </td>
                                                <td className={`px-1 py-1 text-[11px] font-mono ${muted}`}>{s ? `${s.win_rate.toFixed(0)}` : '—'}</td>
                                                <td className={`px-1 py-1 text-[11px] font-mono ${muted}`}>{s ? s.profit_factor.toFixed(1) : '—'}</td>
                                                <td className={`px-1 py-1 text-[11px] font-mono ${muted} hidden md:table-cell`}>{s?.total_trades ?? '—'}</td>
                                                <td className={`px-1 py-1 text-[11px] font-mono ${plColor(s?.total_pnl)} hidden md:table-cell`}>{s ? fmtNum(s.total_pnl) : '—'}</td>
                                                {/* Live */}
                                                <td className={`px-1 py-1 text-[11px] font-mono ${isDarkMode ? 'border-l border-slate-600/50' : 'border-l border-gray-200'} ${live ? (isDarkMode ? 'text-gray-200' : 'text-gray-800') : muted}`}>
                                                    {live?.total_orders ?? '—'}
                                                </td>
                                                <td className={`px-1 py-1 text-[11px] font-mono ${live && live.win_rate_pct > 50 ? 'text-emerald-400' : live ? (isDarkMode ? 'text-amber-400' : 'text-amber-600') : muted}`}>
                                                    {live ? `${live.win_rate_pct.toFixed(0)}` : '—'}
                                                </td>
                                                <td className={`px-1 py-1 text-[11px] font-mono ${plColor(live?.total_pl)}`}>
                                                    {live ? fmtNum(live.total_pl) : '—'}
                                                </td>
                                                <td className={`px-1 py-1 text-[11px] font-mono ${muted} hidden lg:table-cell`}>{timeLive(p)}</td>
                                                {/* Meta */}
                                                <td className={`px-1 py-1 text-[11px] font-mono ${muted} hidden xl:table-cell`}>{p.baseline?.generation_counter ?? '—'}</td>
                                                <td className={`px-1 py-1 text-[11px] font-mono ${muted} hidden xl:table-cell`}>{p.baseline?.consecutive_failures ?? '—'}</td>
                                                <td className="px-2 py-1.5 text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-1">
                                                        {([
                                                            {panel: 'gens', icon: ClockIcon, title: 'Generation history'},
                                                            {panel: 'history', icon: ChartBarIcon, title: 'Baseline evolution'},
                                                            {panel: 'trades', icon: ListBulletIcon, title: 'Trade list'},
                                                            {panel: 'params', icon: AdjustmentsHorizontalIcon, title: 'Current params'},
                                                        ] as const).map(({panel, icon: Icon, title}) => (
                                                            <button key={panel}
                                                                onClick={(e) => togglePanel(p, panel, e)}
                                                                title={title}
                                                                className={`p-0.5 rounded transition-colors ${expanded?.key === key && expanded.panel === panel ? 'bg-cyan-600 text-white' : isDarkMode ? 'text-gray-500 hover:text-cyan-400' : 'text-gray-400 hover:text-cyan-600'}`}>
                                                                <Icon className="w-3.5 h-3.5"/>
                                                            </button>
                                                        ))}
                                                        <button disabled={actionLoading === key}
                                                            onClick={() => doAction(p.enabled ? disableProfile : enableProfile, p.name, p.timeframe)}
                                                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${p.enabled ? (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700') : (isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700')}`}>
                                                            {p.enabled ? 'Off' : 'On'}
                                                        </button>
                                                        <button disabled={actionLoading === key || actionDone === key}
                                                            onClick={() => doAction(reseedProfile, p.name, p.timeframe)}
                                                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${actionDone === key ? (isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700') : isDarkMode ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-50 text-cyan-700'}`}>
                                                            {actionLoading === key ? '...' : actionDone === key ? 'Queued' : 'Seed'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ];
                                        // Unified expansion panel
                                        if (expanded?.key === key) {
                                            const panelCls = `${isDarkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`;
                                            rows.push(
                                                <tr key={`${key}-panel`} className={panelCls}>
                                                    <td colSpan={16} className="px-4 py-4">

                                                        {/* Timeline panel */}
                                                        {expanded.panel === 'timeline' && (
                                                            timelineLoading ? <p className={`text-sm ${muted}`}>Loading timeline...</p> : (
                                                            <div className="space-y-3">
                                                                {p.description && <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{p.description}</div>}
                                                                {timeline && timeline.series.length > 0 ? (<>
                                                                    <div className="flex flex-wrap gap-4 text-xs font-mono">
                                                                        <span className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}><strong>{timeline.total_trades}</strong> trades</span>
                                                                        <span className={timeline.winners > timeline.losers ? 'text-emerald-400' : 'text-red-400'}>{timeline.winners}W / {timeline.losers}L ({timeline.win_rate_pct.toFixed(1)}%)</span>
                                                                        <span className={plColor(timeline.total_pl)}>P&L: {fmtNum(timeline.total_pl)}</span>
                                                                        {timeline.avg_win != null && <span className="text-emerald-400">Avg Win: {fmtNum(timeline.avg_win)}</span>}
                                                                        {timeline.avg_loss != null && <span className="text-red-400">Avg Loss: {fmtNum(timeline.avg_loss)}</span>}
                                                                        <span className={muted}>{timeline.days_live} trading days{timeline.first_trade && ` (since ${timeline.first_trade.slice(0, 10)})`}</span>
                                                                    </div>
                                                                    <ReactECharts style={{height: 220}} option={{
                                                                        tooltip: {trigger: 'axis', formatter: (params: any) => { const idx = params[0]?.dataIndex; const day = idx != null ? timeline.series[idx] : null; if (!day) return ''; return `<b>${day.date.slice(0, 10)}</b><br/>Daily P&L: ${day.daily_pl.toFixed(2)}<br/>${day.wins}W / ${day.losses}L`; }},
                                                                        xAxis: {type: 'category', data: timeline.series.map(d => d.date.slice(0, 10)), axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 9, rotate: 45, interval: 0}, axisLine: {lineStyle: {color: isDarkMode ? '#334155' : '#e5e7eb'}}},
                                                                        yAxis: [{type: 'value', name: 'Cum P&L', nameTextStyle: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 10}, axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 10}, splitLine: {lineStyle: {color: isDarkMode ? '#334155' : '#e5e7eb'}}}, {type: 'value', name: 'Trades', nameTextStyle: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 10}, axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 10}, splitLine: {show: false}, minInterval: 1}],
                                                                        series: [{name: 'Cumulative P&L', type: 'line', data: timeline.series.map(d => ({value: d.cumulative_pl, itemStyle: {color: d.cumulative_pl >= 0 ? '#10b981' : '#ef4444'}})), smooth: true, lineStyle: {width: 2, color: {type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{offset: 0, color: '#10b981'}, {offset: 1, color: '#ef4444'}]}}, areaStyle: {opacity: 0.08, color: {type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{offset: 0, color: '#10b981'}, {offset: 1, color: '#ef4444'}]}}, yAxisIndex: 0}, {name: 'Winners', type: 'bar', stack: 'trades', data: timeline.series.map(d => d.wins), itemStyle: {color: '#10b981', opacity: 0.7}, yAxisIndex: 1}, {name: 'Losers', type: 'bar', stack: 'trades', data: timeline.series.map(d => d.losses), itemStyle: {color: '#ef4444', opacity: 0.7}, yAxisIndex: 1}],
                                                                        grid: {left: 55, right: 55, top: 25, bottom: 70}, backgroundColor: 'transparent',
                                                                    }}/>
                                                                </>) : <p className={`text-xs ${muted}`}>No live trading data yet.</p>}
                                                            </div>)
                                                        )}

                                                        {/* Generation history panel */}
                                                        {expanded.panel === 'gens' && (
                                                            genHistoryLoading ? <p className={`text-sm ${muted}`}>Loading generations...</p> : genHistory.length > 0 ? (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Generation History ({genHistory.length})</p>
                                                                    {Math.ceil(genHistory.length / GEN_PAGE_SIZE) > 1 && (
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[10px] ${muted}`}>{genHistoryPage + 1}/{Math.ceil(genHistory.length / GEN_PAGE_SIZE)}</span>
                                                                            <button disabled={genHistoryPage === 0} onClick={e => { e.stopPropagation(); setGenHistoryPage(pg => pg - 1); }} className={`px-1.5 py-0.5 text-[10px] rounded ${isDarkMode ? 'bg-slate-700 text-gray-400 disabled:opacity-30' : 'bg-gray-100 text-gray-600 disabled:opacity-30'}`}>Prev</button>
                                                                            <button disabled={genHistoryPage >= Math.ceil(genHistory.length / GEN_PAGE_SIZE) - 1} onClick={e => { e.stopPropagation(); setGenHistoryPage(pg => pg + 1); }} className={`px-1.5 py-0.5 text-[10px] rounded ${isDarkMode ? 'bg-slate-700 text-gray-400 disabled:opacity-30' : 'bg-gray-100 text-gray-600 disabled:opacity-30'}`}>Next</button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    {genHistory.slice(genHistoryPage * GEN_PAGE_SIZE, (genHistoryPage + 1) * GEN_PAGE_SIZE).map(gen => (
                                                                        <GenerationRow key={gen.id} gen={gen} isDarkMode={isDarkMode} muted={muted}/>
                                                                    ))}
                                                                </div>
                                                            </div>) : <p className={`text-sm ${muted}`}>No generations found.</p>
                                                        )}

                                                        {/* Baseline evolution panel */}
                                                        {expanded.panel === 'history' && (
                                                            baselineHistoryLoading ? <p className={`text-sm ${muted}`}>Loading baseline history...</p> : baselineHistory.length > 0 ? (
                                                            <div className="space-y-3">
                                                                <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Baseline Evolution ({baselineHistory.length} promotions)</p>
                                                                <ReactECharts style={{height: 200}} option={{
                                                                    tooltip: {trigger: 'axis', formatter: (params: any) => {
                                                                        const idx = params[0]?.dataIndex;
                                                                        const h = baselineHistory[baselineHistory.length - 1 - idx];
                                                                        if (!h?.oos) return '';
                                                                        return `<b>Gen ${h.generation_counter}</b> (${h.created_at.slice(0, 10)})<br/>Sharpe: ${h.oos.sharpe_ratio.toFixed(3)}<br/>PF: ${h.oos.profit_factor.toFixed(2)}<br/>WR: ${h.oos.win_rate.toFixed(0)}%<br/>Trades: ${h.oos.total_trades}`;
                                                                    }},
                                                                    xAxis: {type: 'category', data: [...baselineHistory].reverse().map(h => `g${h.generation_counter}`), axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 9}, axisLine: {lineStyle: {color: isDarkMode ? '#334155' : '#e5e7eb'}}},
                                                                    yAxis: {type: 'value', name: 'Sharpe', nameTextStyle: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 10}, axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 10}, splitLine: {lineStyle: {color: isDarkMode ? '#334155' : '#e5e7eb'}}},
                                                                    series: [{type: 'line', data: [...baselineHistory].reverse().map(h => ({value: h.oos?.sharpe_ratio ?? 0, itemStyle: {color: (h.oos?.sharpe_ratio ?? 0) >= 0 ? '#10b981' : '#ef4444'}})), smooth: true, lineStyle: {width: 2, color: '#3b82f6'}, areaStyle: {opacity: 0.08, color: '#3b82f6'}}],
                                                                    grid: {left: 50, right: 20, top: 20, bottom: 30}, backgroundColor: 'transparent',
                                                                }}/>
                                                            </div>) : <p className={`text-sm ${muted}`}>No baseline history.</p>
                                                        )}

                                                        {/* Trade list panel */}
                                                        {expanded.panel === 'trades' && (() => {
                                                            const TRADE_PAGE = window.innerWidth < 768 ? 50 : 100;
                                                            const tradeTotalPages = Math.ceil(trades.length / TRADE_PAGE);
                                                            const pageTrades = trades.slice(tradePage * TRADE_PAGE, (tradePage + 1) * TRADE_PAGE);
                                                            return tradesLoading ? <p className={`text-sm ${muted}`}>Loading trades...</p> : trades.length > 0 ? (
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Trades ({trades.length})</p>
                                                                    {tradeTotalPages > 1 && (
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[10px] ${muted}`}>{tradePage + 1}/{tradeTotalPages}</span>
                                                                            <button disabled={tradePage === 0} onClick={e => { e.stopPropagation(); setTradePage(pg => pg - 1); }}
                                                                                className={`px-1.5 py-0.5 text-[10px] rounded ${isDarkMode ? 'bg-slate-700 text-gray-400 disabled:opacity-30' : 'bg-gray-100 text-gray-600 disabled:opacity-30'}`}>Prev</button>
                                                                            <button disabled={tradePage >= tradeTotalPages - 1} onClick={e => { e.stopPropagation(); setTradePage(pg => pg + 1); }}
                                                                                className={`px-1.5 py-0.5 text-[10px] rounded ${isDarkMode ? 'bg-slate-700 text-gray-400 disabled:opacity-30' : 'bg-gray-100 text-gray-600 disabled:opacity-30'}`}>Next</button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-xs font-mono">
                                                                        <thead>
                                                                            <tr className={`border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                                                                {['Date', 'Symbol', 'Dir', 'Qty', 'Entry', 'Exit', 'P&L $', 'P&L %', 'R:R', 'Close'].map(h => (
                                                                                    <th key={h} className={`text-left px-1.5 py-1 text-[10px] font-semibold uppercase ${muted}`}>{h}</th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {pageTrades.map(o => {
                                                                                const qty = o.quantity ?? 0;
                                                                                const isLong = qty > 0;
                                                                                const absQty = Math.abs(qty);
                                                                                const exitPrice = o.profit != null && qty !== 0 ? o.price + (o.profit / qty) : null;
                                                                                const pctChg = o.profit != null && o.price !== 0 ? (o.profit / (absQty * o.price)) * 100 : null;
                                                                                // Compute R:R from score or from SL/TP/entry
                                                                                const rr = o.risk_reward ?? (o.take_profit && o.stop_loss && o.price
                                                                                    ? Math.abs(o.take_profit - o.price) / Math.abs(o.stop_loss - o.price)
                                                                                    : null);
                                                                                // Build trade detail link: /trade/YYYY/MM/DD/id
                                                                                const dateStr = o.closed ?? o.created;
                                                                                const [y, m, d] = dateStr.slice(0, 10).split('-');
                                                                                const tradeHref = `/trade/${y}/${m}/${d}/${o.id}`;
                                                                                return (
                                                                                <tr key={o.id} onClick={() => window.location.href = tradeHref}
                                                                                    className={`border-b cursor-pointer transition-colors ${isDarkMode ? 'border-slate-700/30 hover:bg-slate-700/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                                                                                    <td className={`px-1.5 py-1 ${muted}`}>{dateStr.slice(0, 10)}</td>
                                                                                    <td className={`px-1.5 py-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{o.symbol}</td>
                                                                                    <td className={`px-1.5 py-1 ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>{isLong ? 'L' : 'S'}</td>
                                                                                    <td className={`px-1.5 py-1 ${muted}`} title={absQty.toString()}>{absQty >= 1000 ? `${(absQty/1000).toFixed(0)}k` : absQty.toLocaleString()}</td>
                                                                                    <td className={`px-1.5 py-1 ${muted}`}>{o.price.toFixed(5)}</td>
                                                                                    <td className={`px-1.5 py-1 ${muted}`}>{exitPrice != null ? exitPrice.toFixed(5) : '—'}</td>
                                                                                    <td className={`px-1.5 py-1 ${plColor(o.profit ?? undefined)}`} title={o.profit?.toFixed(6)}>{o.profit != null ? fmtNum(o.profit) : '—'}</td>
                                                                                    <td className={`px-1.5 py-1 ${plColor(pctChg ?? undefined)}`}>{pctChg != null ? `${pctChg >= 0 ? '+' : ''}${pctChg.toFixed(2)}%` : '—'}</td>
                                                                                    <td className={`px-1.5 py-1 ${muted}`}>{rr ? rr.toFixed(1) : '—'}</td>
                                                                                    <td className={`px-1.5 py-1 ${muted}`}>{o.close_reason ?? '—'}</td>
                                                                                </tr>);
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>) : <p className={`text-sm ${muted}`}>No trades found.</p>;
                                                        })()}

                                                        {/* Params panel */}
                                                        {expanded.panel === 'params' && (
                                                            paramsLoading ? <p className={`text-sm ${muted}`}>Loading params...</p> : params && params.params.length > 0 ? (
                                                            <div>
                                                                <p className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Current Params (mutation #{params.mutation_id}, {params.params.length} keys)</p>
                                                                <div className={`rounded border px-2 py-1.5 overflow-hidden flex flex-wrap gap-1 ${isDarkMode ? 'border-slate-600/50 bg-slate-900/60' : 'border-gray-300 bg-gray-200/60'}`}>
                                                                    {params.params.map(({key: k, value: v}) => (
                                                                        <span key={k} title={`${k} = ${v}`} className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'}`}>
                                                                            <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>{k.replace(/^profile\.\w+\./, '').replace(/\.\w+$/, '')}:</span>
                                                                            <span className="text-emerald-400">{v}</span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>) : <p className={`text-sm ${muted}`}>No params found.</p>
                                                        )}

                                                    </td>
                                                </tr>
                                            );
                                        }
                                        return rows;
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                <span className={`text-xs ${muted}`}>
                                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
                                </span>
                                <div className="flex gap-1">
                                    <button disabled={page === 0} onClick={() => setParam('page', String(page - 1))}
                                        className={`px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-slate-700 text-gray-400 disabled:opacity-30' : 'bg-gray-100 text-gray-600 disabled:opacity-30'}`}>
                                        Prev
                                    </button>
                                    <button disabled={page >= totalPages - 1} onClick={() => setParam('page', String(page + 1))}
                                        className={`px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-slate-700 text-gray-400 disabled:opacity-30' : 'bg-gray-100 text-gray-600 disabled:opacity-30'}`}>
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </main>
            <Foot/>
        </div>
    );
}
