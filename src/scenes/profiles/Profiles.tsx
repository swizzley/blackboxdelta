import {useEffect, useState, useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {useToast} from '../../context/Toast';
import {
    fetchOptimizerAllProfiles, fetchOptimizerSeedRuns,
    enableProfile, disableProfile, soakProfile, goLiveProfile, noLiveProfile,
    reseedProfile, cancelSeedProfile, fetchDashboard, fetchLHCRuns,
} from '../../api/client';
import type {OptimizerAllProfilesResponse, SeedRun, ProfileFlat, ProfileStage, ProfileStats, LHCRun} from '../../context/Types';
import {flattenProfiles, matchesSearch, isGoldProfile, STAGE_ORDER, STAGE_COLORS, STAGE_LABELS} from './utils';
import {BaseTimeframeBadge, CompositeScoreBar, fmtNum, plColor} from './components/shared';
import GoldenProfiles from './GoldenProfiles';

export default function Profiles() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const {toast} = useToast();
    const navigate = useNavigate();

    const [rawData, setRawData] = useState<OptimizerAllProfilesResponse | null>(null);
    const [seedRuns, setSeedRuns] = useState<SeedRun[]>([]);
    const [lhcRuns, setLhcRuns] = useState<LHCRun[]>([]);
    const [liveStats, setLiveStats] = useState<Map<string, ProfileStats>>(new Map());
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
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
        if (sr) setSeedRuns(sr.items ?? []);
        if (lhc) setLhcRuns(lhc.items ?? []);
        if (dash?.by_profile) {
            const map = new Map<string, ProfileStats>();
            for (const ps of dash.by_profile) {
                map.set(ps.profile, ps);
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
        (true) && matchesSearch(p, searchQuery)
    );

    const getLive = (p: ProfileFlat) => liveStats.get(p.name);
    const isGold = (p: ProfileFlat) => isGoldProfile(p.baseline?.stats);

    // Live Trading includes both live and soaking profiles that have actual trades.
    // Profiles with 0W/0L are hidden until they make their first trade.
    const liveProfiles = filtered
        .filter(p => (p.stage === 'live' || p.stage === 'soaking') && (getLive(p)?.total_orders ?? 0) > 0)
        .sort((a, b) => (getLive(b)?.total_pl ?? 0) - (getLive(a)?.total_pl ?? 0));
    // Drag-and-drop between kanban columns
    // Kanban is the human override control center — any stage to any stage.
    const canDrop = (from: ProfileStage, to: ProfileStage): boolean => from !== to;
    const [stageOverrides, setStageOverrides] = useState<Map<string, ProfileStage>>(new Map());
    const handleDrop = async (target: ProfileStage) => {
        setDragOver(null);
        if (!dragProfile || dragProfile.stage === target || !canDrop(dragProfile.stage, target)) {
            setDragProfile(null);
            return;
        }
        // Temporarily move card to target column until next data refresh
        const key = cardKey(dragProfile);
        const p = dragProfile;
        setStageOverrides(prev => new Map(prev).set(key, target));
        setDragProfile(null);

        // Execute the stage transition via API
        try {
            // Cancel seed queue entry when leaving queued/seeding
            if (p.stage === 'queued' || p.stage === 'seeding') {
                await cancelSeedProfile(p.name);
            }

            switch (target) {
                case 'disabled':
                    await disableProfile(p.name);
                    break;
                case 'queued':
                    // Disable first (pull out of optimizer), then enqueue for reseed
                    await disableProfile(p.name);
                    await reseedProfile(p.name);
                    break;
                case 'seeding':
                    await reseedProfile(p.name);
                    break;
                case 'soaking':
                    await soakProfile(p.name);
                    break;
                case 'live':
                    await goLiveProfile(p.name);
                    break;
                case 'optimizing':
                    if (p.stage === 'live' || p.stage === 'soaking') {
                        await noLiveProfile(p.name);
                    }
                    await enableProfile(p.name);
                    break;
                case 'lhc':
                    if (p.stage === 'live' || p.stage === 'soaking') {
                        await noLiveProfile(p.name);
                    }
                    await enableProfile(p.name);
                    // TODO: enqueue for LHC when cancel/enqueue LHC endpoints exist
                    break;
            }
            toast(`${p.name}: moved to ${target}`, 'success');
        } catch (err: any) {
            const msg = err?.message || String(err);
            toast(`${p.name}: ${msg}`, 'error');
        }
        // Clear override and refresh data
        setStageOverrides(prev => { const m = new Map(prev); m.delete(key); return m; });
        loadData();
    };

    const cardKey = (p: ProfileFlat) => p.name;
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
                        <div/>
                        <a href="/profiles/all" className={`text-xs ${isDarkMode ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-700'}`}>
                            View all {allProfiles.length} &rarr;
                        </a>
                    </div>

                    {/* Golden Profiles */}
                    <GoldenProfiles profiles={
                        Array.from(liveStats.entries())
                            .filter(([, s]) => s.win_rate_pct >= 90 && s.total_orders > 3)
                            .sort((a, b) => b[1].total_orders - a[1].total_orders)
                            .map(([name, stats]) => ({name, stats}))
                    }/>

                    {/* Pipeline — kanban columns with scroll + search/sort */}
                    <div className={card}>
                        <h2 className={`${heading} mb-3`}>Pipeline</h2>
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
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {STAGE_ORDER.map(stage => {
                                const stageProfiles = filtered
                                    .filter(p => (stageOverrides.get(cardKey(p)) ?? p.stage) === stage && (!kanbanSearch || p.name.toLowerCase().includes(kanbanSearch.toLowerCase())))
                                    .sort((a, b) => {
                                        if (stage === 'queued') return (b.seed_queue_priority ?? -1) - (a.seed_queue_priority ?? -1);
                                        switch (kanbanSort) {
                                            case 'name': return a.name.localeCompare(b.name);
                                            case 'trades': return (b.baseline?.stats?.total_trades ?? 0) - (a.baseline?.stats?.total_trades ?? 0);
                                            case 'pnl': return (b.baseline?.stats?.total_pnl ?? -999) - (a.baseline?.stats?.total_pnl ?? -999);
                                            case 'gens': return (b.baseline?.generation_counter ?? 0) - (a.baseline?.generation_counter ?? 0);
                                            default: return (b.baseline?.stats?.composite_score ?? -999) - (a.baseline?.stats?.composite_score ?? -999);
                                        }
                                    });
                                const colors = STAGE_COLORS[stage];
                                const isEmpty = stageProfiles.length === 0;
                                return (
                                    <div key={stage}
                                        onDragOver={e => { e.preventDefault(); if (dragProfile && canDrop(dragProfile.stage, stage)) setDragOver(stage); }}
                                        onDragLeave={() => setDragOver(null)}
                                        onDrop={e => { e.preventDefault(); handleDrop(stage); }}
                                        className={`${isEmpty ? 'min-w-[40px] w-[40px]' : 'min-w-0 flex-1'} flex-shrink-0 rounded-lg ${isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50'} flex flex-col transition-all ${dragOver === stage ? (isDarkMode ? 'ring-2 ring-cyan-500/50 bg-slate-700/50' : 'ring-2 ring-cyan-400/50 bg-cyan-50/50') : ''}`}
                                    >
                                        <div className={`flex items-center ${isEmpty ? 'flex-col py-3 px-1' : 'justify-between px-3 pt-3 pb-2'}`}>
                                            <span className={`text-[10px] font-semibold uppercase ${isEmpty ? 'writing-mode-vertical' : ''} ${isDarkMode ? colors.darkText : colors.text}`}
                                                style={isEmpty ? {writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.1em'} : undefined}
                                            >{STAGE_LABELS[stage]}</span>
                                            <span className={`text-[10px] font-mono ${muted} ${isEmpty ? 'mt-1' : ''}`}>{stageProfiles.length}</span>
                                        </div>
                                        {!isEmpty && (
                                            <div className="overflow-y-auto px-1.5 pb-2 space-y-0.5" style={{maxHeight: '400px'}}>
                                                {stageProfiles.map(p => (
                                                    <div key={cardKey(p)}
                                                        draggable
                                                        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragProfile(p); }}
                                                        onDragEnd={() => { setDragProfile(null); setDragOver(null); }}
                                                        onClick={() => navigate(`/profiles/all?name=${p.name}`)}
                                                        className={`block rounded px-2 py-1 overflow-hidden transition-colors cursor-grab active:cursor-grabbing ${
                                                            isGold(p) ? (isDarkMode ? 'bg-amber-900/10 ring-1 ring-amber-500/40 hover:bg-amber-900/20' : 'bg-amber-50/50 ring-1 ring-amber-400/40 hover:bg-amber-50')
                                                            : isDarkMode ? 'bg-slate-800/60 hover:bg-slate-800' : 'bg-white hover:bg-gray-100'
                                                        } ${dragProfile && cardKey(dragProfile) === cardKey(p) ? 'opacity-40' : ''}`}
                                                    >
                                                        <div className="flex items-center justify-between gap-1 overflow-hidden">
                                                            <span className={`font-mono text-[10px] font-medium truncate min-w-0 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`} title={p.name}>{p.name}</span>
                                                            {p.base_timeframe && <span className={`text-[8px] font-mono flex-shrink-0 ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>{p.base_timeframe}</span>}
                                                        </div>
                                                        {p.baseline?.stats && (
                                                            <div className="mt-0.5">
                                                                <CompositeScoreBar stats={p.baseline.stats} isDarkMode={isDarkMode}/>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Live Trading — compact rows */}
                    {liveProfiles.length > 0 && (
                        <div className={card}>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className={heading}>
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"/>
                                    Live Trading
                                    <span className={`text-sm font-normal font-mono ${muted}`}>({liveProfiles.length})</span>
                                </h2>
                                <span className={`text-xs font-mono ${muted}`}>
                                    WR:{liveAgg.wr.toFixed(0)}% {liveAgg.trades}t P&L:<span className={plColor(liveAgg.pnl)}>{fmtNum(liveAgg.pnl)}</span>
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                {liveProfiles.map(p => {
                                    const live = getLive(p);
                                    const pnl = live?.total_pl ?? 0;
                                    return (
                                        <div
                                            key={cardKey(p)}
                                            onClick={() => toggleExpand(p)}
                                            className={`flex items-center justify-between px-3 py-1.5 rounded cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'} ${isExpanded(p) ? (isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50') : ''}`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pnl > 0 ? 'bg-emerald-400' : pnl < 0 ? 'bg-red-400' : 'bg-gray-500'}`}/>
                                                <span className={`font-mono text-xs font-medium truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{p.name}</span>
                                                <BaseTimeframeBadge baseTf={p.base_timeframe} isDarkMode={isDarkMode}/>
                                                {p.stage === 'soaking' && <span className={`text-[9px] px-1 py-0.5 rounded ${isDarkMode ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>SOAK</span>}
                                            </div>
                                            <div className="flex items-center gap-4 flex-shrink-0">
                                                {live && <span className={`text-[10px] font-mono ${muted}`}>WR:{live.win_rate_pct.toFixed(0)}% {live.total_orders}t</span>}
                                                <span className={`font-mono text-xs font-semibold w-16 text-right ${plColor(pnl)}`}>{live ? fmtNum(pnl) : '—'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </main>
            <Foot/>
        </div>
    );
}
