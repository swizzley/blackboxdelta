import {useEffect, useState, useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {
    fetchOptimizerAllProfiles, fetchOptimizerSeedRuns,
    goLiveProfile, noLiveProfile, disableProfile,
    reseedProfile, demoteProfile, fetchDashboard, fetchLHCRuns,
} from '../../api/client';
import type {OptimizerAllProfilesResponse, SeedRun, ProfileFlat, ProfileStage, ProfileStats, LHCRun} from '../../context/Types';
import {flattenProfiles, matchesSearch, STAGE_ORDER, STAGE_COLORS, STAGE_LABELS} from './utils';
import {ResultStat, WRFractionStat, TimeframeBadge, StageBadge, fmtNum, plColor} from './components/shared';

export default function Profiles() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const navigate = useNavigate();

    const [rawData, setRawData] = useState<OptimizerAllProfilesResponse | null>(null);
    const [seedRuns, setSeedRuns] = useState<SeedRun[]>([]);
    const [lhcRuns, setLhcRuns] = useState<LHCRun[]>([]);
    const [liveStats, setLiveStats] = useState<Map<string, ProfileStats>>(new Map());
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [tfFilter, setTfFilter] = useState<'all' | 'scalp' | 'intraday' | 'swing'>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [kanbanSearch, setKanbanSearch] = useState('');
    const [kanbanSort, setKanbanSort] = useState<'sharpe' | 'name' | 'trades' | 'pnl' | 'gens'>('sharpe');
    const [dragProfile, setDragProfile] = useState<ProfileFlat | null>(null);
    const [dragOver, setDragOver] = useState<ProfileStage | null>(null);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const heading = `text-lg font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;

    const loadData = useCallback(async () => {
        if (!apiAvailable) return;
        const [pd, sr, dash, lhc] = await Promise.all([
            fetchOptimizerAllProfiles(),
            fetchOptimizerSeedRuns(),
            fetchDashboard(),
            fetchLHCRuns(),
        ]);
        if (pd) { setRawData(pd); setStageOverrides(new Map()); }
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
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, [loadData]);

    const allProfiles: ProfileFlat[] = rawData ? flattenProfiles(rawData, seedRuns, lhcRuns) : [];

    // Apply search and TF filter
    const filtered = allProfiles.filter(p =>
        (tfFilter === 'all' || p.timeframe === tfFilter) && matchesSearch(p, searchQuery)
    );

    const getLive = (p: ProfileFlat) => liveStats.get(`${p.timeframe}:${p.name}`);

    const soakTime = (p: ProfileFlat): string => {
        const firstOrder = p.first_order_at;
        if (!firstOrder) return '—';
        const days = Math.floor((Date.now() - new Date(firstOrder).getTime()) / 86400000);
        if (days < 1) return '<1d';
        if (days < 30) return `${days}d`;
        return `${Math.floor(days / 30)}mo ${days % 30}d`;
    };

    const byStage = (stage: ProfileStage) => filtered.filter(p => p.stage === stage);
    const liveProfiles = byStage('live').sort((a, b) => (getLive(b)?.total_pl ?? 0) - (getLive(a)?.total_pl ?? 0));
    const readyProfiles = byStage('promoted')
        .filter(p => p.baseline?.stats && p.baseline.stats.sharpe_ratio > 0 && p.baseline.stats.profit_factor > 1)
        .sort((a, b) => (b.baseline?.stats?.sharpe_ratio ?? 0) - (a.baseline?.stats?.sharpe_ratio ?? 0))
        .slice(0, 10);
    const attentionProfiles = filtered.filter(p =>
        (p.disabled_reason === 'stall') ||
        (p.stage === 'live' && getLive(p) && getLive(p)!.total_pl < 0)
    );

    const doAction = async (action: (name: string, tf: string) => Promise<any>, name: string, tf: string) => {
        setActionLoading(`${tf}:${name}`);
        await action(name, tf);
        setActionLoading(null);
        loadData();
    };

    // Drag-and-drop between kanban columns
    // Forward: only to next stage. Backward: step back through pipeline (skip promoted/soaking)
    const validDropTargets: Record<string, ProfileStage[]> = {
        disabled: ['queued'],
        queued: ['disabled', 'seeding'],
        seeding: ['disabled', 'queued'],
        optimizing: ['disabled', 'queued', 'seeding'],
        lhc: ['disabled', 'queued', 'seeding', 'optimizing'],
        promoted: ['disabled', 'queued', 'seeding', 'optimizing', 'lhc', 'soaking'],
        soaking: ['disabled', 'queued', 'seeding', 'optimizing', 'lhc', 'live'],
        live: ['disabled', 'queued', 'seeding', 'optimizing', 'lhc'],
    };
    const canDrop = (from: ProfileStage, to: ProfileStage): boolean => {
        if (from === to) return false;
        return (validDropTargets[from] ?? []).includes(to);
    };
    const [stageOverrides, setStageOverrides] = useState<Map<string, ProfileStage>>(new Map());
    const handleDrop = async (target: ProfileStage) => {
        setDragOver(null);
        if (!dragProfile || dragProfile.stage === target || !canDrop(dragProfile.stage, target)) {
            setDragProfile(null);
            return;
        }
        // Temporarily move card to target column until next data refresh
        const key = cardKey(dragProfile);
        setStageOverrides(prev => new Map(prev).set(key, target));
        setDragProfile(null);
        // TODO: wire up actual stage transition actions when backend pipeline is implemented
    };

    const cardKey = (p: ProfileFlat) => `${p.timeframe}:${p.name}`;
    const isExpanded = (p: ProfileFlat) => expandedCard === cardKey(p);
    const toggleExpand = (p: ProfileFlat) => setExpandedCard(isExpanded(p) ? null : cardKey(p));

    // Aggregate stats for live profiles (from actual trading data)
    const liveAgg = (() => {
        let trades = 0, wins = 0, pnl = 0;
        for (const p of liveProfiles) {
            const live = getLive(p);
            if (!live) continue;
            trades += live.total_orders;
            wins += live.winners;
            pnl += live.total_pl;
        }
        return {
            trades,
            wr: trades > 0 ? (wins / trades * 100) : 0,
            pnl,
        };
    })();

    // Pipeline stage counts — show all stages, even empty
    const stageCounts = STAGE_ORDER.map(s => ({stage: s, count: filtered.filter(p => p.stage === s).length}));
    const totalFiltered = filtered.length;

    if (loading) {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'} transition-colors duration-500`}>
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

                    {/* Search + Filter Bar */}
                    <div className={`${card} !p-3 flex flex-wrap items-center gap-3`}>
                        <div className="relative flex-1 min-w-[200px]">
                            <input
                                type="text"
                                placeholder="Search profiles..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className={`w-full rounded-md px-3 py-1.5 pr-7 text-sm ${isDarkMode ? 'bg-slate-700 text-white placeholder-gray-500 border-slate-600' : 'bg-gray-50 text-gray-900 placeholder-gray-400 border-gray-300'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 text-sm leading-none ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                                >&times;</button>
                            )}
                        </div>
                        <div className="flex gap-1">
                            {(['all', 'scalp', 'intraday', 'swing'] as const).map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => setTfFilter(tf)}
                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                        tfFilter === tf
                                            ? 'bg-cyan-600 text-white'
                                            : isDarkMode ? 'bg-slate-700 text-gray-400 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {tf === 'all' ? 'All' : tf.charAt(0).toUpperCase() + tf.slice(1)}
                                </button>
                            ))}
                        </div>
                        <a href="/profiles/all" className={`text-xs ${isDarkMode ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-700'}`}>
                            View all {allProfiles.length} &rarr;
                        </a>
                    </div>

                    {/* Live Trading Section */}
                    <div className={card}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className={heading}>
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse inline-block"/>
                                Live Trading
                                <span className={`text-sm font-normal font-mono ${muted}`}>({liveProfiles.length})</span>
                            </h2>
                            {liveProfiles.length > 0 && (
                                <span className={`text-xs font-mono ${muted}`}>
                                    WR:{liveAgg.wr.toFixed(0)}% {liveAgg.trades}t P&L:<span className={plColor(liveAgg.pnl)}>{fmtNum(liveAgg.pnl)}</span>
                                </span>
                            )}
                        </div>
                        {liveProfiles.length === 0 ? (
                            <p className={`text-sm ${muted}`}>No profiles currently in live trading.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(['scalp', 'intraday', 'swing'] as const)
                                    .filter(tf => tfFilter === 'all' || tfFilter === tf)
                                    .map(tf => {
                                    const tfLive = liveProfiles.filter(p => p.timeframe === tf);
                                    return (
                                        <div key={tf}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <TimeframeBadge tf={tf} isDarkMode={isDarkMode}/>
                                                <span className={`text-xs font-mono ${muted}`}>{tfLive.length} live</span>
                                            </div>
                                            {tfLive.length === 0 ? (
                                                <p className={`text-xs ${muted}`}>None</p>
                                            ) : (
                                            <div className="space-y-3">
                                {tfLive.map(p => {
                                    const live = getLive(p);
                                    const pnl = live?.total_pl ?? 0;
                                    return (
                                        <div
                                            key={cardKey(p)}
                                            onClick={() => toggleExpand(p)}
                                            className={`rounded-lg p-3 cursor-pointer transition-all ${pnl > 0 ? (isDarkMode ? 'bg-emerald-900/20 border border-emerald-800/30' : 'bg-emerald-50 border border-emerald-200') : pnl < 0 ? (isDarkMode ? 'bg-red-900/20 border border-red-800/30' : 'bg-red-50 border border-red-200') : (isDarkMode ? 'bg-slate-700/50' : 'bg-gray-100')} hover:scale-[1.01]`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`font-mono text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{p.name}</span>
                                                <span className={`text-[10px] font-mono ${muted}`}>{soakTime(p)}</span>
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                                <span className={`text-2xl font-bold ${plColor(pnl)}`}>
                                                    {live ? fmtNum(pnl) : '—'}
                                                </span>
                                                <span className={`text-xs ${muted}`}>P&L</span>
                                            </div>
                                            {live && (
                                                <div className={`text-xs font-mono ${muted} mt-1`}>
                                                    WR:{live.win_rate_pct.toFixed(0)}% {live.total_orders}t {live.winners}W/{live.losers}L
                                                </div>
                                            )}
                                            {isExpanded(p) && (
                                                <div className="mt-3 pt-3 border-t border-gray-600/30 space-y-2">
                                                    {live && (
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                                            <ResultStat label="Sharpe" value={live.sharpe_ratio != null ? live.sharpe_ratio.toFixed(2) : '—'} fullValue={live.sharpe_ratio?.toFixed(6) ?? undefined} isDarkMode={isDarkMode} color={live.sharpe_ratio != null && live.sharpe_ratio >= 1 ? 'text-emerald-400' : live.sharpe_ratio != null && live.sharpe_ratio >= 0 ? (isDarkMode ? 'text-amber-400' : 'text-amber-600') : 'text-red-400'}/>
                                                            <WRFractionStat wr={live.win_rate_pct} breakevenWR={live.breakeven_pct ?? undefined} isDarkMode={isDarkMode}/>
                                                            <ResultStat label="Trades" value={String(live.total_orders)} isDarkMode={isDarkMode}/>
                                                            <ResultStat label="W/L" value={`${live.winners}/${live.losers}`} isDarkMode={isDarkMode}/>
                                                            <ResultStat label="Avg W" value={live.avg_win != null ? fmtNum(live.avg_win) : '—'} fullValue={live.avg_win?.toFixed(6)} isDarkMode={isDarkMode} color="text-emerald-500"/>
                                                            <ResultStat label="Avg L" value={live.avg_loss != null ? fmtNum(live.avg_loss) : '—'} fullValue={live.avg_loss?.toFixed(6)} isDarkMode={isDarkMode} color="text-red-500"/>
                                                            <ResultStat label="Avg P&L" value={live.total_orders > 0 ? fmtNum(live.total_pl / live.total_orders) : '—'} fullValue={live.total_orders > 0 ? (live.total_pl / live.total_orders).toFixed(6) : undefined} isDarkMode={isDarkMode} color={plColor(live.total_pl)}/>
                                                            <ResultStat label="Soak" value={soakTime(p)} isDarkMode={isDarkMode}/>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-1.5 mt-2">
                                                        <a
                                                            href={`/profiles/all?name=${p.name}&tf=${p.timeframe}`}
                                                            onClick={e => e.stopPropagation()}
                                                            className={`px-2 py-1 text-[10px] font-medium rounded ${isDarkMode ? 'bg-slate-600/50 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                        >
                                                            Details
                                                        </a>
                                                        <button
                                                            disabled={actionLoading === cardKey(p)}
                                                            onClick={e => { e.stopPropagation(); doAction(noLiveProfile, p.name, p.timeframe); }}
                                                            className={`px-2 py-1 text-[10px] font-medium rounded ${isDarkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                                                        >
                                                            Demote
                                                        </button>
                                                        <button
                                                            disabled={actionLoading === cardKey(p)}
                                                            onClick={e => { e.stopPropagation(); doAction(reseedProfile, p.name, p.timeframe); }}
                                                            className={`px-2 py-1 text-[10px] font-medium rounded ${isDarkMode ? 'bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}
                                                        >
                                                            Re-seed
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                            </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Ready to Promote Section */}
                    {readyProfiles.length > 0 && (
                        <div className={card}>
                            <h2 className={`${heading} mb-4`}>
                                Ready to Promote
                                <span className={`text-sm font-normal font-mono ${muted}`}>({readyProfiles.length})</span>
                            </h2>
                            <div className="space-y-2">
                                {readyProfiles.map(p => {
                                    const s = p.baseline?.stats;
                                    return (
                                        <div key={cardKey(p)} className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                            <span className={`font-mono text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{p.name}</span>
                                            <TimeframeBadge tf={p.timeframe} isDarkMode={isDarkMode}/>
                                            {s && (
                                                <span className={`text-xs font-mono ${muted}`}>
                                                    S:{s.sharpe_ratio.toFixed(2)} PF:{s.profit_factor.toFixed(2)} {s.total_trades}t
                                                </span>
                                            )}
                                            <span className={`text-xs font-mono ${muted}`}>
                                                {p.baseline?.generation_counter ?? 0} gens
                                            </span>
                                            <div className="ml-auto flex gap-1.5">
                                                <button
                                                    disabled={actionLoading === cardKey(p)}
                                                    onClick={() => doAction(goLiveProfile, p.name, p.timeframe)}
                                                    className={`px-2 py-1 text-[10px] font-medium rounded ${isDarkMode ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                                                >
                                                    Go Live
                                                </button>
                                                <button
                                                    disabled={actionLoading === cardKey(p)}
                                                    onClick={() => doAction(demoteProfile, p.name, p.timeframe)}
                                                    className={`px-2 py-1 text-[10px] font-medium rounded ${isDarkMode ? 'bg-slate-600/50 text-gray-400 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                >
                                                    Skip
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {byStage('promoted').length > 10 && (
                                <a href="/profiles/all?stage=promoted" className={`text-xs mt-2 inline-block ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                                    View all {byStage('promoted').length} promoted &rarr;
                                </a>
                            )}
                        </div>
                    )}

                    {/* Needs Attention Section */}
                    <div className={card}>
                        <h2 className={`${heading} mb-4`}>
                            Needs Attention
                            <span className={`text-sm font-normal font-mono ${muted}`}>({attentionProfiles.length})</span>
                        </h2>
                        {attentionProfiles.length === 0 ? (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
                                <span className="w-2 h-2 rounded-full bg-emerald-500"/>
                                <span className={`text-sm ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>All clear — no profiles need attention.</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {attentionProfiles.map(p => {
                                    const isStalled = p.disabled_reason === 'stall';
                                    const isNegLive = p.stage === 'live' && getLive(p) && getLive(p)!.total_pl < 0;
                                    return (
                                        <div key={cardKey(p)} className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                            <span className={`font-mono text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{p.name}</span>
                                            <TimeframeBadge tf={p.timeframe} isDarkMode={isDarkMode}/>
                                            <StageBadge stage={p.stage} isDarkMode={isDarkMode}/>
                                            {isNegLive && p.baseline?.stats && (
                                                <span className="text-xs font-mono text-red-400">S:{p.baseline.stats.sharpe_ratio.toFixed(2)}</span>
                                            )}
                                            {isStalled && (
                                                <span className={`text-xs ${muted}`}>f:{p.baseline?.consecutive_failures ?? 0}</span>
                                            )}
                                            <div className="ml-auto flex gap-1.5">
                                                <button
                                                    disabled={actionLoading === cardKey(p)}
                                                    onClick={() => doAction(reseedProfile, p.name, p.timeframe)}
                                                    className={`px-2 py-1 text-[10px] font-medium rounded ${isDarkMode ? 'bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}
                                                >
                                                    Reseed
                                                </button>
                                                {isNegLive && (
                                                    <button
                                                        disabled={actionLoading === cardKey(p)}
                                                        onClick={() => doAction(noLiveProfile, p.name, p.timeframe)}
                                                        className={`px-2 py-1 text-[10px] font-medium rounded ${isDarkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                                                    >
                                                        Demote
                                                    </button>
                                                )}
                                                {!isNegLive && p.enabled && (
                                                    <button
                                                        disabled={actionLoading === cardKey(p)}
                                                        onClick={() => doAction(disableProfile, p.name, p.timeframe)}
                                                        className={`px-2 py-1 text-[10px] font-medium rounded ${isDarkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                                                    >
                                                        Disable
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Pipeline Health Bar */}
                    <div className={card}>
                        <h2 className={`${heading} mb-4`}>
                            Pipeline
                            <span className={`text-sm font-normal font-mono ${muted}`}>({totalFiltered} profiles)</span>
                        </h2>
                        <div className="flex rounded-lg overflow-hidden h-10">
                            {stageCounts.map(({stage, count}) => {
                                const colors = STAGE_COLORS[stage];
                                return (
                                    <button
                                        key={stage}
                                        onClick={() => count > 0 ? navigate(`/profiles/all?stage=${stage}${tfFilter !== 'all' ? `&tf=${tfFilter}` : ''}`) : undefined}
                                        className={`flex-1 flex items-center justify-center gap-0.5 text-[10px] font-medium transition-opacity ${count > 0 ? 'hover:opacity-80 cursor-pointer' : 'opacity-40 cursor-default'} ${isDarkMode ? `${colors.darkBg} ${colors.darkText}` : `${colors.bg} ${colors.text}`}`}
                                        title={`${STAGE_LABELS[stage]}: ${count} profiles`}
                                    >
                                        <span className="truncate">{STAGE_LABELS[stage]}</span>
                                        <span className="font-mono">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Pipeline Detail — kanban columns with scroll + search/sort */}
                    <div className={card}>
                        <h2 className={`${heading} mb-3`}>Pipeline Detail</h2>
                        <div className="flex gap-2 mb-3 flex-wrap">
                            <input
                                type="text"
                                placeholder="Filter..."
                                value={kanbanSearch}
                                onChange={e => setKanbanSearch(e.target.value)}
                                className={`rounded-md px-2 py-1 text-xs min-w-[120px] ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border focus:outline-none focus:ring-1 focus:ring-cyan-500`}
                            />
                            <select value={kanbanSort} onChange={e => setKanbanSort(e.target.value as any)}
                                className={`rounded-md px-2 py-1 text-xs ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border`}>
                                <option value="sharpe">Sort: Sharpe</option>
                                <option value="name">Sort: Name</option>
                                <option value="trades">Sort: Trades</option>
                                <option value="pnl">Sort: P&L</option>
                                <option value="gens">Sort: Gens</option>
                            </select>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {STAGE_ORDER.map(stage => {
                                const stageProfiles = filtered
                                    .filter(p => (stageOverrides.get(cardKey(p)) ?? p.stage) === stage && (!kanbanSearch || p.name.toLowerCase().includes(kanbanSearch.toLowerCase())))
                                    .sort((a, b) => {
                                        switch (kanbanSort) {
                                            case 'name': return a.name.localeCompare(b.name);
                                            case 'trades': return (b.baseline?.stats?.total_trades ?? 0) - (a.baseline?.stats?.total_trades ?? 0);
                                            case 'pnl': return (b.baseline?.stats?.total_pnl ?? -999) - (a.baseline?.stats?.total_pnl ?? -999);
                                            case 'gens': return (b.baseline?.generation_counter ?? 0) - (a.baseline?.generation_counter ?? 0);
                                            default: return (b.baseline?.stats?.sharpe_ratio ?? -999) - (a.baseline?.stats?.sharpe_ratio ?? -999);
                                        }
                                    });
                                const colors = STAGE_COLORS[stage];
                                return (
                                    <div key={stage}
                                        onDragOver={e => { e.preventDefault(); if (dragProfile && canDrop(dragProfile.stage, stage)) setDragOver(stage); }}
                                        onDragLeave={() => setDragOver(null)}
                                        onDrop={() => handleDrop(stage)}
                                        className={`min-w-[180px] w-[180px] flex-shrink-0 rounded-lg ${isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50'} flex flex-col transition-all ${dragOver === stage ? (isDarkMode ? 'ring-2 ring-cyan-500/50 bg-slate-700/50' : 'ring-2 ring-cyan-400/50 bg-cyan-50/50') : ''}`}>
                                        <div className={`flex items-center justify-between px-3 pt-3 pb-2`}>
                                            <span className={`text-xs font-semibold uppercase ${isDarkMode ? colors.darkText : colors.text}`}>{STAGE_LABELS[stage]}</span>
                                            <span className={`text-xs font-mono ${muted}`}>{stageProfiles.length}</span>
                                        </div>
                                        <div className="overflow-y-auto px-2 pb-2 space-y-1" style={{maxHeight: '400px'}}>
                                            {stageProfiles.length === 0 ? (
                                                <p className={`text-[10px] ${muted} text-center py-4`}>Empty</p>
                                            ) : stageProfiles.map(p => (
                                                <a key={cardKey(p)} href={`/profiles/all?name=${p.name}&tf=${p.timeframe}`}
                                                    draggable
                                                    onDragStart={() => setDragProfile(p)}
                                                    onDragEnd={() => { setDragProfile(null); setDragOver(null); }}
                                                    className={`block rounded px-2 py-1.5 transition-colors cursor-grab active:cursor-grabbing ${isDarkMode ? 'bg-slate-800/60 hover:bg-slate-800' : 'bg-white hover:bg-gray-100'} ${dragProfile && cardKey(dragProfile) === cardKey(p) ? 'opacity-40' : ''}`}>
                                                    <div className="flex items-center justify-between">
                                                        <span className={`font-mono text-[11px] font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{p.name}</span>
                                                        <span className={`text-[9px] font-bold ${
                                                            p.timeframe === 'scalp' ? 'text-purple-400' : p.timeframe === 'intraday' ? 'text-blue-400' : 'text-amber-400'
                                                        }`}>{p.timeframe[0].toUpperCase()}</span>
                                                    </div>
                                                    {p.baseline?.stats && (
                                                        <div className={`text-[10px] font-mono ${muted} mt-0.5`}>
                                                            S:{p.baseline.stats.sharpe_ratio.toFixed(2)} {p.baseline.stats.total_trades}t
                                                            {p.baseline.stats.total_pnl != null && <span className={p.baseline.stats.total_pnl >= 0 ? ' text-emerald-400' : ' text-red-400'}> {fmtNum(p.baseline.stats.total_pnl)}</span>}
                                                        </div>
                                                    )}
                                                    {p.disabled_reason && (
                                                        <span className={`text-[9px] ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>{p.disabled_reason}</span>
                                                    )}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </main>
            <Foot/>
        </div>
    );
}
