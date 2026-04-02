import {useEffect, useState, useCallback, useRef} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import Tooltip from '../common/Tooltip';
import Pagination from '../common/Pagination';
import {useTheme} from '../../context/Theme';
import {ResultStat as SharedResultStat, fmtNum as sharedFmtNum, fmtPct as sharedFmtPct, avgPnl as sharedAvgPnl, plColor as sharedPlColor} from '../profiles/components/shared';
import {useApi} from '../../context/Api';
import {
    fetchOptimizerStatus, fetchOptimizerGenerations,
    fetchOptimizerRecommendations,
    fetchOptimizerBranches,
    fetchOptimizerSeedRuns, fetchOptimizerWorkers,
    fetchGenerationQueue,
    retrySeedProfile,
    applyRecommendation,
    fetchLHCRuns, fetchLHCRunDetail, spawnLHCProfile,
} from '../../api/client';
import type {
    OptimizerStatus, OptimizerGeneration,
    OptimizerRecommendation, OptimizerResult, OptimizerBranch,
    OptimizerParamDiff, OptimizerWorkerConfig,
    SeedRun, SeedComponentResult, SeedVariantResult,
    SeedStageBResult, SeedStageCResult, SeedStageEResult,
    Tier2Summary, Tier3Summary, SeedDiagnostics,
    LHCRun, LHCRunDetail, GenQueueResponse,
} from '../../context/Types';
import {
    BeakerIcon, ClockIcon,
    LightBulbIcon, ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';

dayjs.extend(relativeTime);
dayjs.extend(duration);

export default function Optimizer() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();

    const [status, setStatus] = useState<OptimizerStatus | null>(null);
    const [generations, setGenerations] = useState<OptimizerGeneration[]>([]);
    const [recommendations, setRecommendations] = useState<OptimizerRecommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [seedRuns, setSeedRuns] = useState<SeedRun[]>([]);
    const [workerConfig, setWorkerConfig] = useState<OptimizerWorkerConfig | null>(null);
    const [showSeeds, setShowSeeds] = useState(false);
    const [showLHC, setShowLHC] = useState(false);
    const [showRecs, setShowRecs] = useState(false);
    const [showGens, setShowGens] = useState(false);
    const [genSort, setGenSort] = useState<{field: 'id' | 'timeframe' | 'profile'; dir: 'asc' | 'desc'}>({field: 'id', dir: 'desc'});
    const [lhcRuns, setLhcRuns] = useState<LHCRun[]>([]);
    const [expandedLHC, setExpandedLHC] = useState<number | null>(null);
    const [lhcDetail, setLhcDetail] = useState<LHCRunDetail | null>(null);
    const [lhcSort, setLhcSort] = useState<'score' | 'combined_sharpe' | 'total_pnl' | 'profit_factor' | 'total_trades'>('score');
    const [spawnedProfiles, setSpawnedProfiles] = useState<Record<string, string>>({}); // "runId:index" → profile name
    const [spawning, setSpawning] = useState<string | null>(null);
    const [recActionLoading, setRecActionLoading] = useState<number | null>(null);
    const [genQueue, setGenQueue] = useState<GenQueueResponse | null>(null);
    const [showGenQueue, setShowGenQueue] = useState(false);

    // Pagination state
    const [seedPage, setSeedPage] = useState(0);
    const [seedTotal, setSeedTotal] = useState(0);
    const [lhcPage, setLhcPage] = useState(0);
    const [lhcTotal, setLhcTotal] = useState(0);
    const [recPage, setRecPage] = useState(0);
    const [recTotal, setRecTotal] = useState(0);
    const [genPage, setGenPage] = useState(0);
    const [genTotal, setGenTotal] = useState(0);

    const SEED_PAGE_SIZE = 10;
    const LHC_PAGE_SIZE = 10;
    const REC_PAGE_SIZE = 20;
    const GEN_PAGE_SIZE = 15;

    const loadData = useCallback(async () => {
        if (!apiAvailable) return;
        const [s, g, r, sr, wc, lhc, gq] = await Promise.all([
            fetchOptimizerStatus(),
            fetchOptimizerGenerations(GEN_PAGE_SIZE, undefined, genPage),
            fetchOptimizerRecommendations(undefined, REC_PAGE_SIZE, recPage),
            fetchOptimizerSeedRuns(undefined, undefined, SEED_PAGE_SIZE, seedPage),
            fetchOptimizerWorkers(),
            fetchLHCRuns(LHC_PAGE_SIZE, lhcPage),
            fetchGenerationQueue(),
        ]);
        if (s) setStatus(s);
        if (g) { setGenerations(g.items ?? []); setGenTotal(g.total); }
        if (r) { setRecommendations(r.items ?? []); setRecTotal(r.total); }
        if (sr) { setSeedRuns(sr.items ?? []); setSeedTotal(sr.total); }
        if (lhc) { setLhcRuns(lhc.items ?? []); setLhcTotal(lhc.total); }
        if (wc) setWorkerConfig(wc);
        if (gq) setGenQueue(gq);
        setLoading(false);
    }, [apiAvailable, genPage, recPage, seedPage, lhcPage]);

    useEffect(() => {
        loadData();
        const iv = setInterval(loadData, 2_000);
        return () => clearInterval(iv);
    }, [loadData]);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`;
    const heading = `text-lg font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const iconCl = 'w-5 h-5 text-cyan-500';
    const thCl = `text-left text-xs font-medium uppercase tracking-wider ${muted}`;
    const tdCl = `text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`;

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    <h1 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Optimizer</h1>

                    {!apiAvailable ? (
                        <div className={`${card} text-center py-16`}>
                            <BeakerIcon className="w-12 h-12 mx-auto text-gray-400 mb-4"/>
                            <p className={`text-lg ${muted}`}>API unavailable — connect to VPN to view optimizer data</p>
                        </div>
                    ) : loading ? (
                        <div className={`${card} text-center py-16`}>
                            <p className={`text-lg ${muted}`}>Loading optimizer data...</p>
                        </div>
                    ) : (
                        <>
                            {/* Active Generations */}
                            {(status?.active_generations ?? []).length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                {(status?.active_generations ?? []).map(gen => (
                                    <div key={gen.id} className={card}>
                                        <h2 className={`${heading} !mb-0`}>
                                            <span className={`font-mono text-sm ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>{gen.target_profile || `Gen #${gen.id}`}</span>
                                        </h2>
                                        <div className="mt-3">
                                            <GenerationCard gen={gen} isDarkMode={isDarkMode} muted={muted}/>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            )}

                            {/* Worker Pool */}
                            {workerConfig && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}>
                                        <BeakerIcon className={iconCl}/>Unified Worker Pool
                                        {workerConfig.host_count != null && workerConfig.host_count > 0 && (
                                            <Tooltip content={workerConfig.active_hosts?.join(', ') ?? ''}>
                                                <span className={`ml-2 text-xs font-normal px-1.5 py-0.5 rounded ${
                                                    isDarkMode ? 'bg-cyan-900/40 text-cyan-400' : 'bg-cyan-100 text-cyan-700'
                                                }`}>
                                                    {workerConfig.host_count} host{workerConfig.host_count > 1 ? 's' : ''}
                                                </span>
                                            </Tooltip>
                                        )}
                                    </h2>
                                    <WorkerGauge workers={workerConfig.total_workers} cores={workerConfig.cpu_cores || 16} memUsed={workerConfig.memory_used ?? 0} memBudget={workerConfig.max_memory_units} isDarkMode={isDarkMode}/>
                                    <div className={`mt-3 flex gap-4 text-xs font-mono ${muted}`}>
                                        <span>{workerConfig.total_workers} total workers</span>
                                        <span>{(status?.active_generations ?? []).length} active gen{(status?.active_generations ?? []).length !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            )}


                            {/* Generation Queue */}
                            {(genQueue?.items?.length ?? 0) > 0 && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowGenQueue(s => !s)}>
                                        <ClockIcon className={iconCl}/>Generation Queue
                                        <span className={`text-xs font-normal ${muted} ml-auto`}>{genQueue?.total ?? 0} pending</span>
                                        {showGenQueue ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                                    </h2>
                                    {showGenQueue && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-700/30">
                                                        <th className={thCl}>Profile</th>
                                                        <th className={thCl}>Priority</th>
                                                        <th className={thCl}>Memory</th>
                                                        <th className={thCl}>Status</th>
                                                        <th className={thCl}>Host</th>
                                                        <th className={thCl}>Age</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(genQueue?.items ?? []).map(item => (
                                                        <tr key={item.id} className={`border-b border-gray-700/10 ${item.status === 'claimed' ? (isDarkMode ? 'bg-cyan-900/20' : 'bg-cyan-50') : ''}`}>
                                                            <td className={tdCl}><span className="font-mono">{item.profile_name}</span></td>
                                                            <td className={tdCl}>{item.priority}</td>
                                                            <td className={tdCl}>{item.memory_cost.toFixed(2)}</td>
                                                            <td className={tdCl}>
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                    item.status === 'claimed' ? 'bg-cyan-500/20 text-cyan-400' :
                                                                    'bg-gray-500/20 text-gray-400'
                                                                }`}>{item.status}</span>
                                                            </td>
                                                            <td className={tdCl}>{item.claimed_by ?? '-'}</td>
                                                            <td className={`${tdCl} text-xs`}>{dayjs(item.created_at).fromNow()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Seed Calibration Runs */}
                                <div className={`${card} mb-6`}>
                                    <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowSeeds(s => !s)}>
                                        <BeakerIcon className={iconCl}/>Seed Calibration
                                        <span className={`text-xs font-normal ${muted} ml-auto`}>{seedTotal}</span>
                                        {showSeeds ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                                    </h2>
                                    {showSeeds && (
                                        seedRuns.length === 0
                                        ? <p className={`text-sm ${muted}`}>No seed runs yet.</p>
                                        : <div className="space-y-3">
                                            {seedRuns.map(sr => (
                                                <SeedRunCard key={sr.id} run={sr} isDarkMode={isDarkMode} muted={muted} onRefresh={async () => {
                                                    const fresh = await fetchOptimizerSeedRuns(undefined, undefined, SEED_PAGE_SIZE, seedPage);
                                                    if (fresh) { setSeedRuns(fresh.items ?? []); setSeedTotal(fresh.total); }
                                                }}/>
                                            ))}
                                            <Pagination page={seedPage} totalItems={seedTotal} pageSize={SEED_PAGE_SIZE} onPageChange={setSeedPage}/>
                                        </div>
                                    )}
                                </div>

                            {/* LHC Sweep Runs */}
                            {lhcTotal > 0 && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowLHC(s => !s)}>
                                        <BeakerIcon className={iconCl}/>LHC Sweeps
                                        <span className={`text-xs font-normal ${muted} ml-auto`}>{lhcTotal}</span>
                                        {showLHC ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                                    </h2>
                                    {showLHC && (<div className="space-y-2">
                                        {lhcRuns.map(run => (
                                            <div key={run.id} className={`rounded px-3 py-2 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`font-mono text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>#{run.id}</span>
                                                    
                                                    <span className={`font-mono text-xs font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>{run.profile_name}</span>
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                                        run.status === 'complete' ? isDarkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
                                                        : run.status === 'failed' ? isDarkMode ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700'
                                                        : run.status === 'sweeping' ? isDarkMode ? 'bg-amber-900/40 text-amber-400 animate-pulse' : 'bg-amber-100 text-amber-700 animate-pulse'
                                                        : isDarkMode ? 'bg-cyan-900/40 text-cyan-400 animate-pulse' : 'bg-cyan-100 text-cyan-700 animate-pulse'
                                                    }`}>{run.status}</span>
                                                    {(() => {
                                                        const pct = run.combos > 0 ? Math.min(100, (run.configs_tested / run.combos) * 100) : 0;
                                                        return (
                                                            <div className="flex items-center gap-1.5 min-w-[120px]">
                                                                <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-600/50' : 'bg-gray-200'}`}>
                                                                    <div className={`h-full rounded-full transition-all duration-500 ${
                                                                        run.status === 'complete' ? 'bg-emerald-500'
                                                                        : run.status === 'failed' ? 'bg-red-500'
                                                                        : run.status === 'preloading' ? 'bg-cyan-500 animate-pulse'
                                                                        : 'bg-amber-500'
                                                                    }`} style={{width: `${run.status === 'preloading' ? 15 : run.status === 'complete' ? 100 : pct}%`}}/>
                                                                </div>
                                                                <span className={`text-[10px] font-mono ${muted} whitespace-nowrap`}>
                                                                    {run.status === 'preloading' ? 'warming...'
                                                                        : `${run.configs_tested.toLocaleString()}/${run.combos.toLocaleString()}`}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                    {run.best_sharpe != null && (
                                                        <span className={`text-[10px] font-mono ${run.best_sharpe > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            best:{run.best_sharpe.toFixed(4)}
                                                        </span>
                                                    )}
                                                    {run.claimed_by && <span className={`text-[10px] ${muted}`}>@{run.claimed_by}</span>}
                                                    <span className={`text-[10px] ${muted}`}>{dayjs(run.started_at).fromNow()}</span>
                                                    {run.status === 'complete' && (
                                                        <button
                                                            onClick={async () => {
                                                                if (expandedLHC === run.id) { setExpandedLHC(null); return; }
                                                                const detail = await fetchLHCRunDetail(run.id);
                                                                if (detail) { setLhcDetail(detail); setExpandedLHC(run.id); }
                                                            }}
                                                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
                                                                isDarkMode ? 'bg-slate-600/50 text-gray-400 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            {expandedLHC === run.id ? 'Hide' : 'Results'}
                                                        </button>
                                                    )}
                                                    {run.error_message && <span className="text-[10px] text-red-400">{run.error_message}</span>}
                                                </div>
                                                {/* Expanded results table */}
                                                {expandedLHC === run.id && lhcDetail?.results && (() => {
                                                    const sorted = [...lhcDetail.results].sort((a, b) => {
                                                        const av = a[lhcSort] as number ?? 0;
                                                        const bv = b[lhcSort] as number ?? 0;
                                                        return bv - av;
                                                    });
                                                    return (
                                                        <div className="mt-2">
                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                <span className={`text-[10px] font-medium ${muted}`}>Rank by:</span>
                                                                {(['score', 'combined_sharpe', 'total_pnl', 'profit_factor', 'total_trades'] as const).map(key => (
                                                                    <button key={key} onClick={() => setLhcSort(key)}
                                                                        className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                                                                            lhcSort === key
                                                                                ? isDarkMode ? 'bg-cyan-900/50 text-cyan-300' : 'bg-cyan-100 text-cyan-800'
                                                                                : isDarkMode ? 'bg-slate-600/30 text-gray-500 hover:text-gray-300' : 'bg-gray-50 text-gray-400 hover:text-gray-700'
                                                                        }`}>
                                                                        {key === 'combined_sharpe' ? 'Sharpe' : key === 'total_pnl' ? 'P&L' : key === 'profit_factor' ? 'PF' : key === 'total_trades' ? 'Trades' : 'Score'}
                                                                    </button>
                                                                ))}
                                                                <span className={`text-[10px] ${muted} ml-auto`}>{sorted.length} results</span>
                                                            </div>
                                                            <div className="space-y-1 max-h-96 overflow-y-auto">
                                                                {sorted.slice(0, 20).map((r, i) => {
                                                                    const spawnKey = `${run.id}:${r.rank - 1}`;
                                                                    const spawned = spawnedProfiles[spawnKey];
                                                                    return (
                                                                    <div key={i} className={`flex flex-wrap items-center gap-3 px-2 py-1 rounded text-[10px] font-mono ${
                                                                        isDarkMode ? 'bg-slate-800/60' : 'bg-gray-100/80'
                                                                    }`}>
                                                                        <span className={`w-4 text-right ${muted}`}>{i + 1}</span>
                                                                        <span className={r.score > 0 ? 'text-emerald-400' : 'text-red-400'}>S:{r.score.toFixed(4)}</span>
                                                                        <span className={muted}>Sharpe:{r.combined_sharpe.toFixed(4)}</span>
                                                                        <span className={muted}>PF:{r.profit_factor.toFixed(2)}</span>
                                                                        <span className={muted}>WR:{r.win_rate.toFixed(1)}%</span>
                                                                        <span className={muted}>{r.total_trades.toLocaleString()}t</span>
                                                                        <span className={r.total_pnl > 0 ? 'text-emerald-400' : 'text-red-400'}>P&L:{r.total_pnl.toFixed(2)}</span>
                                                                        <span className={muted}>Sil:{r.silence_ratio.toFixed(2)}</span>
                                                                        {spawned ? (
                                                                            <span className={`px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                                                                                {spawned}
                                                                            </span>
                                                                        ) : (
                                                                            <button
                                                                                disabled={spawning === spawnKey}
                                                                                onClick={async () => {
                                                                                    setSpawning(spawnKey);
                                                                                    const result = await spawnLHCProfile(run.id, r.rank - 1);
                                                                                    if (result?.profile_name) {
                                                                                        setSpawnedProfiles(prev => ({...prev, [spawnKey]: result.profile_name}));
                                                                                    }
                                                                                    setSpawning(null);
                                                                                    loadData();
                                                                                }}
                                                                                className={`px-1.5 py-0.5 rounded transition-colors ${
                                                                                    spawning === spawnKey
                                                                                        ? isDarkMode ? 'bg-slate-700 text-gray-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                                                        : isDarkMode ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                                                                                }`}
                                                                            >
                                                                                {spawning === spawnKey ? '...' : 'Spawn'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ))}
                                        <Pagination page={lhcPage} totalItems={lhcTotal} pageSize={LHC_PAGE_SIZE} onPageChange={setLhcPage}/>
                                    </div>)}
                                </div>
                            )}

                            {/* Analyzer Queue */}
                            <div className={`${card} mb-6`}>
                                <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowRecs(r => !r)}>
                                    <LightBulbIcon className={iconCl}/>Analyzer Queue
                                    {(() => { const active = recommendations.filter(r => r.status === 'running' || r.status === 'queued').length; return active > 0 ? <span className={`text-xs font-medium ml-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>{active} active</span> : null; })()}
                                    <span className={`text-xs font-normal ${muted} ml-auto`}>{recTotal}</span>
                                    {showRecs ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                                </h2>
                                {showRecs && (recommendations.length === 0 ? (
                                    <p className={`text-sm ${muted}`}>No recommendations queued. Submit hypotheses from the Analysis page.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {recommendations.map(rec => {
                                            const statusColors: Record<string, string> = {
                                                queued: 'text-yellow-400',
                                                running: 'text-blue-400',
                                                passed: 'text-emerald-400',
                                                failed: 'text-red-400',
                                                applied: 'text-purple-400',
                                                skipped: 'text-gray-500',
                                                pending: 'text-gray-400',
                                            };
                                            const mutCount = Object.keys(rec.mutations || {}).length;
                                            return (
                                                <div key={rec.id} className={`rounded-lg p-3 text-sm ${isDarkMode ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
                                                    <div className="flex items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>#{rec.id}</span>
                                                                <span className={`text-xs font-medium ${statusColors[rec.status] || muted}`}>{rec.status}</span>
                                                                <span className={`text-xs ${muted}`}>{rec.timeframe}</span>
                                                                <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-600/50 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>{rec.source}</span>
                                                                {mutCount > 0 && <span className={`text-xs ${muted}`}>{mutCount} mutations</span>}
                                                            </div>
                                                            {rec.prompt && (
                                                                <p className={`text-xs italic ${muted} mb-1 truncate`} title={rec.prompt}>&ldquo;{rec.prompt}&rdquo;</p>
                                                            )}
                                                            {!rec.prompt && rec.rationale && (
                                                                <p className={`text-xs ${muted} mb-1 truncate`} title={rec.rationale}>{rec.rationale}</p>
                                                            )}
                                                            {mutCount > 0 && (
                                                                <DiffBlock
                                                                    diffs={Object.entries(rec.mutations).map(([key, val]) => ({key, new_value: val}))}
                                                                    baseId={undefined}
                                                                    isDarkMode={isDarkMode}
                                                                    muted={muted}
                                                                />
                                                            )}
                                                            {rec.oos_result && (
                                                                <div className={`text-xs ${muted} flex gap-3`}>
                                                                    <span>Sharpe: {rec.oos_result.sharpe_ratio.toFixed(4)}</span>
                                                                    <span>PF: {rec.oos_result.profit_factor.toFixed(2)}</span>
                                                                    <span>WR: {rec.oos_result.win_rate.toFixed(0)}%</span>
                                                                    <span>Trades: {rec.oos_result.total_trades}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1.5 flex-shrink-0">
                                                            {rec.status === 'pending' && (
                                                                <span className={`text-xs ${muted} italic`}>pending pickup</span>
                                                            )}
                                                            {rec.status === 'passed' && (
                                                                <button
                                                                    disabled={recActionLoading === rec.id}
                                                                    onClick={async () => {
                                                                        setRecActionLoading(rec.id);
                                                                        await applyRecommendation(rec.id);
                                                                        loadData();
                                                                        setRecActionLoading(null);
                                                                    }}
                                                                    className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                                                                >Apply to Baseline</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <Pagination page={recPage} totalItems={recTotal} pageSize={REC_PAGE_SIZE} onPageChange={setRecPage}/>
                                    </div>
                                ))}
                            </div>


                            {/* Generation History with expandable branch details */}
                            <div className={`${card} mb-6`}>
                                <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowGens(g => !g)}>
                                    <ClockIcon className={iconCl}/>Generation History
                                    <span className={`text-xs font-normal ${muted} ml-auto`}>{genTotal}</span>
                                    {showGens ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                                </h2>
                                {showGens && (generations.length === 0 ? (
                                    <p className={`text-sm ${muted}`}>No generations recorded</p>
                                ) : (
                                    <>
                                        <div className="flex gap-1.5 mb-3" onClick={e => e.stopPropagation()}>
                                            {(['id', 'profile', 'timeframe'] as const).map(field => (
                                                <button key={field} onClick={() => setGenSort(s => ({field, dir: s.field === field && s.dir === 'desc' ? 'asc' : 'desc'}))}
                                                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${genSort.field === field ? 'bg-cyan-600 text-white' : isDarkMode ? 'bg-slate-700 text-gray-400 hover:bg-slate-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                                    {field}{genSort.field === field ? (genSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="space-y-1">
                                            {(() => {
                                                const tfOrder: Record<string, number> = {scalp: 0, intraday: 1, swing: 2};
                                                const sorted = [...generations].sort((a, b) => {
                                                    if (genSort.field === 'profile') {
                                                        const cmp = (a.target_profile ?? '').localeCompare(b.target_profile ?? '');
                                                        if (cmp !== 0) return genSort.dir === 'asc' ? cmp : -cmp;
                                                        return b.id - a.id;
                                                    }
                                                    if (genSort.field === 'timeframe') {
                                                        const cmp = (tfOrder[a.timeframe ?? ""] ?? 3) - (tfOrder[b.timeframe ?? ""] ?? 3);
                                                        if (cmp !== 0) return genSort.dir === 'asc' ? cmp : -cmp;
                                                        return b.id - a.id;
                                                    }
                                                    return genSort.dir === 'asc' ? a.id - b.id : b.id - a.id;
                                                });
                                                return sorted.map(g => (
                                                    <GenerationRow key={g.id} gen={g} isDarkMode={isDarkMode} muted={muted} thCl={thCl} tdCl={tdCl}/>
                                                ));
                                            })()}
                                            <Pagination page={genPage} totalItems={genTotal} pageSize={GEN_PAGE_SIZE} onPageChange={setGenPage}/>
                                        </div>
                                    </>
                                ))}
                            </div>

                        </>
                    )}
                </div>
            </div>
            <Foot/>
        </>
    );
}

// --- Sub-components ---

function DiffBlock({diffs, baseId, isDarkMode, muted, stripPrefix, hideHeader}: {
    diffs: OptimizerParamDiff[]; baseId?: number; isDarkMode: boolean; muted: string; stripPrefix?: string; hideHeader?: boolean;
}) {
    const filtered = [...diffs]
        .filter(d => d.key !== 'check.baseline_winrate')
        .sort((a, b) => a.key.localeCompare(b.key));
    return (
        <div>
            {!hideHeader && (
                <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>
                    vs {baseId ? `baseline #${baseId}` : 'baseline'} — {filtered.length} param{filtered.length !== 1 ? 's' : ''}
                </p>
            )}
            <div className={`rounded border px-2 py-1.5 overflow-hidden flex flex-wrap gap-1 ${
                isDarkMode ? 'border-slate-600/50 bg-slate-900/60' : 'border-gray-300 bg-gray-200/60'
            }`}>
                {filtered.map(d => {
                    const displayKey = stripPrefix && d.key.startsWith(stripPrefix) ? d.key.slice(stripPrefix.length) : d.key;
                    return (
                        <span key={d.key} title={d.key} className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'
                        }`}>
                            <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>{displayKey}:</span>
                            {d.old_value != null && <span className="text-red-400">{d.old_value}</span>}
                            {d.old_value != null && !d.removed && <span className={isDarkMode ? 'text-slate-600' : 'text-gray-400'}>→</span>}
                            {!d.removed && <span className="text-emerald-400">{d.new_value}</span>}
                            {d.removed && <span className={isDarkMode ? 'text-slate-600' : 'text-gray-400'}>(removed)</span>}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

function GenerationCard({gen, isDarkMode, muted}: {gen: OptimizerGeneration; isDarkMode: boolean; muted: string}) {
    // Determine explanatory badge when generation has no branches
    const noBranches = gen.branch_count === 0 && (gen.passed ?? 0) === 0 && (gen.failed ?? 0) === 0 && (gen.running ?? 0) === 0;
    const failures = gen.consecutive_failures ?? 0;
    let phaseBadge: {label: string; cls: string} | null = null;
    if (noBranches && gen.status === 'active') {
        const ageMinutes = dayjs().diff(dayjs(gen.started_at), 'minute');
        if (failures >= 20) {
            phaseBadge = {label: `Stall T2 (${failures} fails)`, cls: isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'};
        } else if (failures >= 10) {
            phaseBadge = {label: `Stall T1 (${failures} fails)`, cls: isDarkMode ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700'};
        } else if (ageMinutes < 3) {
            phaseBadge = {label: 'AI Planning', cls: isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'};
        } else {
            phaseBadge = {label: 'Waiting', cls: isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700'};
        }
    } else if (gen.status === 'active' && failures >= 10) {
        // Even when branches are running, show stall indicator if many consecutive failures
        phaseBadge = {label: `${failures} consecutive fails`, cls: isDarkMode ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700'};
    }

    return (
        <div className={`rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Gen #{gen.id}</span>
                    
                    {gen.claimed_by && <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-mono ${isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-gray-200 text-gray-500'}`}>@{gen.claimed_by}</span>}
                    {phaseBadge
                        ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium animate-pulse ${phaseBadge.cls}`}>{phaseBadge.label}</span>
                        : <GenStatusBadge status={gen.status} isDarkMode={isDarkMode}/>
                    }
                </div>
                <span className={`text-xs ${muted}`}>{dayjs(gen.started_at).fromNow()}</span>
            </div>
            {noBranches ? (
                <p className={`text-xs ${muted}`}>
                    {failures >= 10
                        ? `Stalling (${failures} consecutive failures) — escalated exploration with broader mutations and relaxed verifier`
                        : phaseBadge?.label === 'AI Planning'
                            ? 'AI is planning branch explorations for this generation...'
                            : 'Generation is waiting — may be paused for replication lag, OOS data coverage, or post-reset cooldown'}
                </p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MiniStat label="Branches" value={String(gen.branch_count)} isDarkMode={isDarkMode}/>
                    <MiniStat label="Passed" value={String(gen.passed ?? 0)} isDarkMode={isDarkMode}/>
                    <MiniStat label="Failed" value={String(gen.failed ?? 0)} isDarkMode={isDarkMode}/>
                    <MiniStat label="Running" value={String(gen.running ?? 0)} isDarkMode={isDarkMode}/>
                </div>
            )}
        </div>
    );
}

function GenerationRow({gen, isDarkMode, muted, thCl, tdCl}: {
    gen: OptimizerGeneration; isDarkMode: boolean; muted: string; thCl: string; tdCl: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const [branches, setBranches] = useState<OptimizerBranch[] | null>(null);

    // Auto-refresh branches while expanded and generation is active
    useEffect(() => {
        if (!expanded) return;
        if (gen.status !== 'active') return;
        const iv = setInterval(async () => {
            const data = await fetchOptimizerBranches(gen.id);
            if (data) setBranches(data);
        }, 3_000);
        return () => clearInterval(iv);
    }, [expanded, gen.id, gen.status]);

    // Final fetch when generation completes while expanded (branches may still show verifying)
    const prevStatus = useRef(gen.status);
    useEffect(() => {
        if (expanded && prevStatus.current === 'active' && gen.status !== 'active') {
            fetchOptimizerBranches(gen.id).then(data => { if (data) setBranches(data); });
        }
        prevStatus.current = gen.status;
    }, [expanded, gen.id, gen.status]);

    const toggle = async () => {
        if (!expanded) {
            // Always re-fetch on expand if generation is complete (cached data may be stale)
            if (branches === null || gen.status !== 'active') {
                const data = await fetchOptimizerBranches(gen.id);
                setBranches(data ?? []);
            }
        }
        setExpanded(!expanded);
    };

    return (
        <div className={`rounded-lg ${isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
            <button onClick={toggle} className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:${isDarkMode ? 'bg-slate-700/60' : 'bg-gray-100'} rounded-lg transition-colors`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>#{gen.id}</span>
                    {gen.target_profile && <span className={`text-xs font-mono font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>{gen.target_profile}</span>}
                    <GenStatusBadge status={gen.status} isDarkMode={isDarkMode}/>
                    {gen.claimed_by && <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-mono ${isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-gray-200 text-gray-500'}`}>@{gen.claimed_by}</span>}
                    <span className={`text-xs ${muted} hidden sm:inline`}>
                        {gen.branch_count} branches
                        {gen.passed ? ` · ${gen.passed} passed` : ''}
                        {gen.failed ? ` · ${gen.failed} failed` : ''}
                    </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs ${muted}`}>{genDuration(gen)}</span>
                    <span className={`text-xs ${muted} hidden sm:inline`}>{dayjs(gen.started_at).fromNow()}</span>
                    {expanded
                        ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/>
                        : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>
                    }
                </div>
            </button>

            {expanded && branches !== null && (
                <div className="px-4 pb-3">
                    {branches.length === 0 ? (
                        <p className={`text-sm ${muted} py-2`}>No branches</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full mt-1">
                                <thead>
                                    <tr className="border-b border-gray-700/20">
                                        <th className={`${thCl} pb-1.5 pr-3`}>Branch</th>
                                        <th className={`${thCl} pb-1.5 pr-3`}>Status</th>
                                        <th className={`${thCl} pb-1.5 pr-3`}>Profile</th>
                                        <th className={`${thCl} pb-1.5 pr-3`}>Trades</th>
                                        <th className={`${thCl} pb-1.5 pr-3`}>Win%</th>
                                        <th className={`${thCl} pb-1.5 pr-3`}>PF</th>
                                        <th className={`${thCl} pb-1.5 pr-3`}>Sharpe</th>
                                        <th className={`${thCl} pb-1.5 pr-3`}>DD</th>
                                        <th className={`${thCl} pb-1.5`}>Directive</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branches.map(b => (
                                        <BranchRow key={b.id} branch={b} isDarkMode={isDarkMode} tdCl={tdCl} winnerId={gen.winner_branch_id} muted={muted}/>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function BranchRow({branch: b, isDarkMode, tdCl, winnerId, muted}: {branch: OptimizerBranch; isDarkMode: boolean; tdCl: string; winnerId?: number; muted: string}) {
    const [expanded, setExpanded] = useState(false);
    const isWinner = winnerId === b.id;
    const rowCls = isWinner
        ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50')
        : (isDarkMode ? 'even:bg-slate-600/20' : 'even:bg-gray-50/50');

    const statusCls = b.status === 'passed'
        ? 'text-emerald-500'
        : b.status === 'failed'
            ? 'text-red-500'
            : b.status === 'running' || b.status === 'verifying'
                ? 'text-yellow-500'
                : (isDarkMode ? 'text-gray-400' : 'text-gray-500');

    // Show OOS result if available, fall back to denormalized fields
    const r = b.oos_result ?? b.is_result;
    const trades = r?.total_trades ?? b.total_trades;
    const winRate = r?.win_rate ?? b.win_rate;
    const pf = r?.profit_factor ?? b.profit_factor;
    const sharpe = r?.sharpe_ratio ?? b.sharpe_ratio;
    const dd = r?.max_drawdown ?? b.max_drawdown;

    // Compute duration
    const durationStr = b.created_at && b.completed_at
        ? (() => {
            const ms = dayjs(b.completed_at).diff(dayjs(b.created_at));
            if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
            if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
            const h = Math.floor(ms / 3_600_000);
            const m = Math.round((ms % 3_600_000) / 60_000);
            return `${h}h ${m}m`;
        })()
        : null;

    const dateRange = (start?: string, end?: string) => {
        if (!start || !end) return null;
        return `${dayjs(start).format('YYYY-MM-DD')} → ${dayjs(end).format('YYYY-MM-DD')}`;
    };

    return (
        <>
            <tr className={`${rowCls} cursor-pointer`} onClick={() => setExpanded(!expanded)}>
                <td className={`${tdCl} py-1.5 pr-3 font-mono`}>
                    {isWinner && <span className="text-emerald-500 mr-1" title="Winner">★</span>}
                    {b.id}
                </td>
                <td className={`text-xs font-medium py-1.5 pr-3 ${statusCls}`}>{b.status}</td>
                <td className={`${tdCl} py-1.5 pr-3`}>
                    {b.target_profile
                        ? <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>{b.target_profile}</span>
                        : <span className={muted}>—</span>
                    }
                </td>
                <td className={`${tdCl} py-1.5 pr-3`}>{trades || '—'}</td>
                <td className={`${tdCl} py-1.5 pr-3`}>{winRate ? `${winRate.toFixed(0)}%` : '—'}</td>
                <td className={`${tdCl} py-1.5 pr-3`}>{pf ? pf.toFixed(2) : '—'}</td>
                <td className={`${tdCl} py-1.5 pr-3`}>{sharpe ? sharpe.toFixed(2) : '—'}</td>
                <td className={`${tdCl} py-1.5 pr-3`}>{dd ? dd.toFixed(4) : '—'}</td>
                <td className={`${tdCl} py-1.5 text-xs truncate max-w-[200px]`} title={b.exploration_directive}>
                    {b.exploration_directive || '—'}
                    {expanded
                        ? <ChevronUpIcon className={`w-3 h-3 inline ml-1 ${muted}`}/>
                        : <ChevronDownIcon className={`w-3 h-3 inline ml-1 ${muted}`}/>
                    }
                </td>
            </tr>
            {expanded && (
                <tr className={rowCls}>
                    <td colSpan={9} className="px-3 pb-3 pt-1">
                        <div className="space-y-3">
                            {/* Meta row: duration, date ranges */}
                            <div className="flex flex-wrap gap-4 text-xs">
                                {durationStr && (
                                    <span className={muted}>Duration: <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{durationStr}</span></span>
                                )}
                                {dateRange(b.is_start, b.is_end) && (
                                    <span className={muted}>IS: <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{dateRange(b.is_start, b.is_end)}</span></span>
                                )}
                                {dateRange(b.oos_start, b.oos_end) && (
                                    <span className={muted}>OOS: <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{dateRange(b.oos_start, b.oos_end)}</span></span>
                                )}
                            </div>

                            {/* Failure reason */}
                            {b.failure_reason && (
                                <div className="text-xs text-red-400 font-mono">{b.failure_reason}</div>
                            )}

                            {/* IS + OOS results side by side */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {b.is_result && (
                                    <ResultBlock label="In-Sample" result={b.is_result} isDarkMode={isDarkMode} muted={muted}/>
                                )}
                                {b.oos_result && (
                                    <ResultBlock label="Out-of-Sample" result={b.oos_result} isDarkMode={isDarkMode} muted={muted}/>
                                )}
                            </div>

                            {/* Param diffs */}
                            {b.param_diffs && b.param_diffs.length > 0 && (
                                <DiffBlock diffs={b.param_diffs} isDarkMode={isDarkMode} muted={muted} stripPrefix={b.target_profile ? `profile.${b.target_profile}.` : undefined} hideHeader/>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

function ResultBlock({label, result, isDarkMode, muted}: {label: string; result: OptimizerResult; isDarkMode: boolean; muted: string}) {
    return (
        <div>
            <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>{label}</p>
            <div className="flex flex-wrap gap-2">
                <ResultStat label="Sharpe" value={result.sharpe_ratio?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                <ResultStat label="PF" value={result.profit_factor?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                <ResultStat label="Win%" value={result.win_rate ? `${result.win_rate.toFixed(0)}%` : '—'} isDarkMode={isDarkMode}/>
                <ResultStat label="Avg W" value={fmtPct(result.avg_win)} isDarkMode={isDarkMode} color="text-emerald-500"/>
                <ResultStat label="Avg L" value={fmtPct(result.avg_loss)} isDarkMode={isDarkMode} color="text-red-500"/>
                <ResultStat label="Trades" value={String(result.total_trades)} isDarkMode={isDarkMode}/>
                <ResultStat label="Max DD" value={result.max_drawdown?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                <ResultStat label="Avg P&L" value={avgPnl(result)} isDarkMode={isDarkMode} color={plColor(result.total_pnl)}/>
            </div>
            {result.ProfileBreakdown && Object.keys(result.ProfileBreakdown).length > 0 && (
                <div className="mt-2 space-y-1.5">
                    {Object.entries(result.ProfileBreakdown).sort().map(([name, pr]) => (
                        <div key={name} className={`pl-3 border-l-2 ${isDarkMode ? 'border-slate-500/50' : 'border-gray-300/70'}`}>
                            <p className={`text-[10px] font-medium uppercase tracking-wider mb-0.5 ${muted}`}>{name}</p>
                            <div className="flex flex-wrap gap-1.5">
                                <ResultStat label="Sharpe" value={pr.sharpe_ratio?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                                <ResultStat label="Win%" value={pr.win_rate ? `${pr.win_rate.toFixed(0)}%` : '—'} isDarkMode={isDarkMode}/>
                                <ResultStat label="Trades" value={String(pr.total_trades)} isDarkMode={isDarkMode}/>
                                <ResultStat label="PF" value={pr.profit_factor?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function MiniStat({label, value, isDarkMode}: {label: string; value: string; isDarkMode: boolean}) {
    return (
        <div className={`rounded px-2 py-1 ${isDarkMode ? 'bg-slate-800/60' : 'bg-gray-100'}`}>
            <p className={`text-[10px] uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
            <p className={`text-sm font-mono ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{value}</p>
        </div>
    );
}

const ResultStat = SharedResultStat;

function GenStatusBadge({status, isDarkMode}: {status: string; isDarkMode: boolean}) {
    const s = status?.toLowerCase();
    const cls = s === 'completed' || s === 'done'
        ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
        : s === 'running' || s === 'active'
            ? (isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700')
            : s === 'failed'
                ? (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700')
                : (isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500');
    const pulse = (s === 'running' || s === 'active') ? ' animate-pulse' : '';
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}${pulse}`}>{status}</span>;
}

// --- Seed Run Components ---

const ALL_SEED_STAGES = ['StageA', 'StageD', 'StageD2', 'StageD4', 'StageD5', 'StageB', 'StageC', 'StageD3', 'StageE', 'StageF', 'LHC', 'Diagnostics'] as const;
const STAGE_LABELS: Record<string, string> = {
    StageA: 'Baseline',
    StageB: 'Filters',
    StageC: 'Damp',
    StageD: 'Entry',
    StageD2: 'R:R',
    StageD3: 'Hours',
    StageD4: 'Trail',
    StageD5: 'Mkt/Lim',
    StageE: 'Assembly',
    StageF: 'Cascade',
    Tier1: 'Tier 1',
    LHC: 'LHC Sweep',
    LHC_sweep: 'LHC Sweep',
    LHC_preload: 'LHC Preload',
    Diagnostics: 'Diag',
    FinalOOS: 'Final OOS',
    Start: 'Starting',
    'concurrent:all': 'All Profiles',
};
// All seed stages are always shown. Skipped stages display as "skip" in the progress bar.
function seedStagesForTf(_tf?: string): string[] {
    return [...ALL_SEED_STAGES];
}
const STAGE_TIME_EST: Record<string, Record<string, string>> = {
    scalp: {
        StageA: '~15m', StageD: '~25m', StageD2: '~20m',
        StageD4: '~20m', StageD5: '~15m', StageB: '~40m',
        StageD3: '~20m', StageE: '~5m', LHC: '~3m', Diagnostics: '~2m',
    },
    intraday: {
        StageA: '~5m', StageD: '~8m', StageD2: '~6m',
        StageD4: '~6m', StageB: '~12m',
        StageD3: '~6m', StageE: '~2m', LHC: '~3m', Diagnostics: '~1m',
    },
    swing: {
        StageA: '~2m', StageD: '~3m', StageD2: '~3m',
        StageD4: '~3m', StageB: '~5m', StageC: '~1m',
        StageD3: '~3m', StageE: '~1m', LHC: '~10m', Diagnostics: '~1m',
    },
};

// Parse a profile-prefixed stage like "meanrev:StageD3" into {profile, stage}
function parseProfileStage(raw: string): {profile: string | null; stage: string} {
    const colonIdx = raw.indexOf(':');
    if (colonIdx > 0) {
        const prefix = raw.slice(0, colonIdx);
        const suffix = raw.slice(colonIdx + 1);
        // If suffix looks like a stage name (starts with uppercase or is a known keyword), treat prefix as profile
        if (suffix && /^[A-Z]/.test(suffix) || ['Start', 'Tier1', 'LHC', 'init', 'loading', 'preload'].some(s => suffix.startsWith(s))) {
            return {profile: prefix, stage: suffix};
        }
    }
    return {profile: null, stage: raw};
}

// Extract per-profile stage data from profile-keyed JSON columns.
// New format: {"meanrev": [...], "breakout": [...]}
// Old format (legacy): [...] — returned for profile "default" only
function getProfileStageData<T>(data: any, profile: string): T | null {
    if (!data) return null;
    if (Array.isArray(data)) return profile === 'default' ? data as T : null;
    // Check for non-array legacy objects (e.g. SeedStageBResult stored flat)
    if (typeof data === 'object' && !data[profile] && !Array.isArray(Object.values(data)[0]) && typeof Object.values(data)[0] !== 'object') {
        return profile === 'default' ? data as T : null;
    }
    return data[profile] ?? null;
}

// Get all profile names that have data in a stage result column
function getStageProfiles(data: any): string[] {
    if (!data) return [];
    if (Array.isArray(data)) return ['default'];
    if (typeof data === 'object') return Object.keys(data);
    return [];
}

function formatStageLabel(raw: string): string {
    const {profile, stage} = parseProfileStage(raw);
    const label = STAGE_LABELS[stage] ?? stage;
    return profile ? `${profile}: ${label}` : label;
}

function SeedRunCard({run, isDarkMode, muted, onRefresh}: {run: SeedRun; isDarkMode: boolean; muted: string; onRefresh?: () => void}) {
    const [expanded, setExpanded] = useState(false);
    const [openProfiles, setOpenProfiles] = useState<Set<string>>(new Set());
    const isRunning = run.status === 'running';
    const parsed = parseProfileStage(run.current_stage);
    const stages = seedStagesForTf(run.timeframe ?? "");
    // Strip sub-stage suffix for index lookup (e.g. "Stage0:TFSweep" → "Stage0")
    const baseStage = parsed.stage.includes(':') ? parsed.stage.split(':')[0] : parsed.stage;
    const currentIdx = stages.indexOf(baseStage);
    const hasProfileStages = run.profile_stages != null && Object.keys(run.profile_stages).filter(k => k !== 'concurrent' && k !== 'all').length > 0;
    const isConcurrentProfile = hasProfileStages;

    const statusCls = isRunning
        ? (isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700')
        : run.status === 'completed'
            ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
            : (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700');

    const durationStr = run.completed_at
        ? (() => { const ms = dayjs(run.completed_at).diff(dayjs(run.started_at)); return ms < 60_000 ? `${Math.round(ms/1000)}s` : ms < 3_600_000 ? `${Math.round(ms/60_000)}m` : `${Math.floor(ms/3_600_000)}h ${Math.round((ms%3_600_000)/60_000)}m`; })()
        : isRunning ? dayjs(run.started_at).fromNow(true) : null;

    return (
        <div className={`rounded-lg ${isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
            <button onClick={() => setExpanded(!expanded)} className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:${isDarkMode ? 'bg-slate-700/60' : 'bg-gray-100'} rounded-lg transition-colors`}>
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>#{run.id}</span>
                    
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusCls}${isRunning ? ' animate-pulse' : ''}`}>{run.status}</span>
                    <span className={`text-xs font-mono ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>{
                        // Extract profile name: try trigger_reason (lhc_seed:bbrsi), then profile_stages keys, then current_stage prefix
                        run.trigger_reason?.includes(':') ? run.trigger_reason.split(':').pop()
                        : run.profile_stages ? Object.keys(run.profile_stages).filter(k => k !== 'concurrent' && k !== 'all')[0] ?? run.trigger_reason
                        : run.current_stage?.includes(':') ? run.current_stage.split(':')[0]
                        : run.trigger_reason
                    }</span>
                    {isRunning && !isConcurrentProfile && <span className={`text-xs font-medium ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>{formatStageLabel(run.current_stage)}</span>}
                    {run.best_sharpe !== undefined && <span className={`text-xs font-mono ${run.best_sharpe >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>S:{fmtNum(run.best_sharpe)}</span>}
                    {run.configs_tested > 0 && <span className={`text-xs ${muted}`}>{run.configs_tested} configs</span>}
                    {run.claimed_by && <span className={`text-xs ${muted}`}>@{run.claimed_by}</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {durationStr && <span className={`text-xs ${muted}`}>{durationStr}</span>}
                    <span className={`text-xs ${muted}`}>{dayjs(run.started_at).fromNow()}</span>
                    {expanded ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                </div>
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Stage progress bar — concurrent profile view for scalp, linear for others */}
                    {isConcurrentProfile ? (
                        <div className="space-y-2">
                            <p className={`text-[10px] font-medium uppercase ${muted}`}>Concurrent Profile Seeding</p>
                            {/* Stage labels row */}
                            <div className="flex items-end gap-2">
                                <span className="w-16"/>
                                <div className="flex gap-0.5 flex-1">
                                    {stages.map(stage => (
                                        <div key={stage} className="flex-1 text-center">
                                            <p className={`text-[8px] leading-tight ${muted}`}>{STAGE_LABELS[stage] ?? stage}</p>
                                        </div>
                                    ))}
                                </div>
                                <span className="w-28"/>
                            </div>
                            {/* Time estimates row */}
                            <div className="flex items-end gap-2 -mt-1.5">
                                <span className="w-16"/>
                                <div className="flex gap-0.5 flex-1">
                                    {stages.map(stage => (
                                        <div key={stage} className="flex-1 text-center">
                                            <p className={`text-[7px] leading-tight ${muted} opacity-60`}>{STAGE_TIME_EST[run.timeframe ?? ""]?.[stage] ?? ''}</p>
                                        </div>
                                    ))}
                                </div>
                                <span className="w-28"/>
                            </div>
                            {/* Profile progress rows — filter out metadata keys */}
                            {(run.profile_stages ? Object.keys(run.profile_stages).filter(k => k !== 'concurrent' && k !== 'all') : []).map(pName => {
                                const pStageRaw = run.profile_stages?.[pName] ?? '';
                                const isSkipped = pStageRaw.startsWith('SKIPPED:');
                                const isDone = pStageRaw.startsWith('PASSED:') || pStageRaw.startsWith('FAILED:') || isSkipped;
                                const isPassed = pStageRaw.startsWith('PASSED:');
                                const pStageIdx = isDone ? stages.length : stages.indexOf(pStageRaw);
                                const pStageLabel = isDone ? pStageRaw : (STAGE_LABELS[pStageRaw] ?? pStageRaw);
                                const isActive = isRunning && !isDone && pStageRaw !== '';
                                const sharpeMatch = isDone ? pStageRaw.match(/S(-?\d+\.\d+)/) : null;
                                const tierMatch = isDone ? pStageRaw.match(/T(\d)/) : null;
                                const profileResult = run.profile_results?.find((p: any) => p.profile === pName);
                                const showResult = isDone || (profileResult && !isRunning);
                                const pSA = getProfileStageData<SeedVariantResult[]>(run.stagea_results, pName);
                                const pInverted = pSA?.some(v => v.label === 'inverted-direction' && v.winner);

                                return (
                                    <div key={pName} className="flex items-center gap-2">
                                        <span className={`text-[10px] font-mono w-16 flex items-center gap-1 ${
                                            isSkipped ? muted
                                            : isDone ? (isPassed ? 'text-emerald-400' : 'text-red-400')
                                            : isActive ? (isDarkMode ? 'text-cyan-400' : 'text-cyan-600')
                                            : muted
                                        }`}>{pName}{pInverted && <span className="text-amber-400" title="Direction inverted">⟲</span>}</span>
                                        <div className="flex gap-0.5 flex-1">
                                            {stages.map((stage, i) => (
                                                <div key={stage} className={`h-2 flex-1 rounded-full ${
                                                    isSkipped ? (isDarkMode ? 'bg-slate-700/50' : 'bg-gray-200')
                                                    : showResult
                                                        ? i <= pStageIdx
                                                            ? (isPassed || profileResult?.passed ? 'bg-emerald-500' : 'bg-red-500/40')
                                                            : (isDarkMode ? 'bg-slate-600/30 border border-slate-600' : 'bg-gray-200 border border-gray-300')
                                                        : i < pStageIdx ? 'bg-emerald-500'
                                                        : i === pStageIdx && isActive ? 'bg-cyan-500 animate-pulse'
                                                        : isDarkMode ? 'bg-slate-700' : 'bg-gray-300'
                                                }`} title={`${STAGE_LABELS[stage] ?? stage}${showResult && i > pStageIdx ? ' (skipped)' : ''}`}/>
                                            ))}
                                        </div>
                                        <span className={`text-[10px] font-mono w-28 text-right ${
                                            isSkipped ? muted
                                            : showResult
                                                ? (isPassed || profileResult?.passed ? 'text-emerald-400' : 'text-red-400')
                                                : isActive ? (isDarkMode ? 'text-cyan-400' : 'text-cyan-600')
                                                : muted
                                        }`}>
                                            {isSkipped ? 'skipped'
                                                : showResult
                                                ? `${isPassed || profileResult?.passed ? 'PASS' : 'FAIL'} T${tierMatch?.[1] ?? profileResult?.tier ?? '?'} S:${sharpeMatch ? fmtNum(parseFloat(sharpeMatch[1])) : profileResult ? fmtNum(profileResult.sharpe) : '?'}`
                                                : isActive ? pStageLabel
                                                : pStageRaw === '' ? 'queued' : pStageLabel}
                                        </span>
                                        {isDone && !isPassed && !isSkipped && (run.status === 'resumable' || run.status === 'running' || run.status === 'failed') && (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    await retrySeedProfile(pName);
                                                    onRefresh?.();
                                                }}
                                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                                    isDarkMode ? 'bg-amber-900/30 text-amber-400 hover:bg-amber-800/40' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                } transition-colors`}
                                                title={`Clear checkpoint and retry ${pName} from scratch`}
                                            >
                                                ↻
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            {/* Overall progress summary — only shown for multi-profile concurrent seeds */}
                            {(() => {
                                const profileKeys = Object.keys(run.profile_stages ?? {}).filter(k => k !== 'concurrent' && k !== 'all');
                                const total = profileKeys.length;
                                if (total <= 1) return null;
                                const passed = profileKeys.filter(k => (run.profile_stages?.[k] ?? '').startsWith('PASSED:')).length;
                                const failed = profileKeys.filter(k => (run.profile_stages?.[k] ?? '').startsWith('FAILED:')).length;
                                const skipped = profileKeys.filter(k => (run.profile_stages?.[k] ?? '').startsWith('SKIPPED:')).length;
                                const done = passed + failed + skipped;
                                return (
                                    <div className={`flex items-center gap-3 pt-1 mt-1 border-t text-[10px] font-mono ${isDarkMode ? 'border-slate-600/50' : 'border-gray-300'} ${muted}`}>
                                        <span>{done}/{total} done</span>
                                        {passed > 0 && <span className="text-emerald-400">{passed} passed</span>}
                                        {failed > 0 && <span className="text-red-400">{failed} failed</span>}
                                        {skipped > 0 && <span>{skipped} skipped</span>}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="flex gap-1 overflow-x-auto pb-1">
                            {stages.map((stage, i) => {
                                const isDone = run.status === 'completed' || run.status === 'failed';
                                const done = i < currentIdx || isDone;
                                const active = i === currentIdx && isRunning;
                                return (
                                    <div key={stage} className="flex-1 min-w-[40px]">
                                        <div className={`h-1.5 rounded-full ${
                                            done && isDone && run.status === 'failed' ? 'bg-red-500/40'
                                            : done ? 'bg-emerald-500'
                                            : active ? 'bg-cyan-500 animate-pulse'
                                            : isDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                                        }`}/>
                                        <p className={`text-[10px] mt-0.5 text-center ${
                                            active ? (isDarkMode ? 'text-cyan-400' : 'text-cyan-600')
                                            : done && isDone && run.status === 'failed' ? 'text-red-400'
                                            : done ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')
                                            : muted
                                        }`}>{STAGE_LABELS[stage] ?? stage}{active && parsed.stage.includes(':') ? `: ${parsed.stage.split(':').pop()}` : ''}</p>
                                        {STAGE_TIME_EST[run.timeframe ?? ""]?.[stage] && (
                                            <p className={`text-[7px] text-center ${muted} opacity-60`}>{STAGE_TIME_EST[run.timeframe ?? ""][stage]}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {run.error_message && (
                        <p className="text-xs text-red-400 font-mono">{run.error_message}</p>
                    )}

                    {/* Per-profile seed results with ALL summary */}
                    {run.profile_results && (run.profile_results as any[]).length > 0 && (() => {
                        const pr = run.profile_results as any[];
                        const passed = pr.filter(p => p.passed).length;
                        const failed = pr.length - passed;
                        const avgSharpe = pr.reduce((s, p) => s + (p.sharpe ?? 0), 0) / pr.length;
                        const totalTrades = pr.reduce((s, p) => s + (p.trades ?? 0), 0);
                        const totalConfigs = pr.reduce((s, p) => s + (p.configs_tested ?? 0), 0);
                        const avgWR = pr.filter(p => p.win_rate > 0).length > 0
                            ? pr.filter(p => p.win_rate > 0).reduce((s, p) => s + p.win_rate, 0) / pr.filter(p => p.win_rate > 0).length
                            : 0;
                        return (
                        <SeedStageSection title="Profile Results" isDarkMode={isDarkMode} muted={muted}>
                            <div className="space-y-2">
                                {/* ALL summary row */}
                                <div className={`flex items-center gap-3 text-xs font-mono pb-1.5 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-300'}`}>
                                    <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>ALL ({pr.length})</span>
                                    <span className="text-emerald-400">{passed} passed</span>
                                    {failed > 0 && <span className="text-red-400">{failed} failed</span>}
                                    <span className={avgSharpe >= 0 ? 'text-emerald-400' : 'text-red-400'}>avg S:{fmtNum(avgSharpe)}</span>
                                    {totalTrades > 0 && <span className={muted}>{totalTrades}t</span>}
                                    {avgWR > 0 && <span className={muted}>avg WR:{avgWR.toFixed(0)}%</span>}
                                    {totalConfigs > 0 && <span className={muted}>{totalConfigs} configs</span>}
                                </div>
                                {/* Individual profile rows */}
                                <div className="space-y-1">
                                    {pr.map((p: any) => (
                                        <div key={p.profile} className={`flex items-center gap-2 text-xs font-mono`}>
                                            <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{p.profile}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                p.passed
                                                    ? isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                                                    : isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {p.passed ? 'PASSED' : 'FAILED'}
                                            </span>
                                            {p.tier > 0 && <span className={muted}>Tier {p.tier}</span>}
                                            <span className={p.sharpe >= 0 ? 'text-emerald-400' : 'text-red-400'}>S:{fmtNum(p.sharpe)}</span>
                                            {p.trades > 0 && <span className={muted}>{p.trades}t</span>}
                                            {p.win_rate > 0 && <span className={muted}>WR:{p.win_rate.toFixed(0)}%</span>}
                                            {p.configs_tested > 0 && <span className={muted}>{p.configs_tested} configs</span>}
                                            {p.error && <span className="text-red-400">{p.error}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </SeedStageSection>
                        );
                    })()}

                    {/* Per-profile stage details — each profile individually expandable */}
                    <div>
                        {(() => {
                        const profiles = isConcurrentProfile
                            ? (run.profile_stages ? Object.keys(run.profile_stages).filter(k => k !== 'concurrent' && k !== 'all') : getStageProfiles(run.stagea_results))
                            : (() => {
                                // Single-profile seeds: derive profile name from stage result keys
                                const candidates = new Set<string>();
                                for (const data of [run.stage0_results, run.stagea_results, run.staged_results, run.stageb_results, run.stagef_results, run.diagnostics]) {
                                    if (data && typeof data === 'object' && !Array.isArray(data)) {
                                        Object.keys(data).forEach(k => candidates.add(k));
                                    }
                                }
                                candidates.delete('concurrent');
                                candidates.delete('all');
                                return candidates.size > 0 ? [...candidates] : ['default'];
                            })();
                        const allHaveData = profiles.filter(prf => {
                            const hasAny = getProfileStageData(run.stage0_results, prf) || getProfileStageData(run.stagea_results, prf) || getProfileStageData(run.staged_results, prf) || getProfileStageData(run.stageb_results, prf) || getProfileStageData(run.stagec_results, prf) || getProfileStageData(run.stagee_results, prf) || getProfileStageData(run.stagef_results, prf) || getProfileStageData(run.tier2_results, prf) || getProfileStageData(run.tier3_results, prf) || getProfileStageData(run.diagnostics, prf) || (isConcurrentProfile && (run.profile_stages?.[prf] ?? '') !== '');
                            return hasAny;
                        });
                        if (allHaveData.length === 0) return null;
                        const allOpen = allHaveData.every(p => openProfiles.has(p));
                        return (
                        <>
                        <button
                            onClick={() => {
                                setOpenProfiles(prev => {
                                    const next = new Set(prev);
                                    if (allOpen) { allHaveData.forEach(p => next.delete(p)); }
                                    else { allHaveData.forEach(p => next.add(p)); }
                                    return next;
                                });
                            }}
                            className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mt-1 mb-2 ${isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                        >
                            <span className={`transform transition-transform ${allOpen ? 'rotate-90' : ''}`}>▶</span>
                            {allOpen ? 'Collapse all profiles' : 'Profile stage details'}
                        </button>
                        {allHaveData.map(prf => {
                            const sA = getProfileStageData<SeedVariantResult[]>(run.stagea_results, prf);
                            const sD = getProfileStageData<SeedVariantResult[]>(run.staged_results, prf);
                            const sD2 = getProfileStageData<SeedVariantResult[]>(run.staged2_results, prf);
                            const sD4 = getProfileStageData<SeedVariantResult[]>(run.staged4_results, prf);
                            const sD5 = getProfileStageData<SeedVariantResult[]>(run.staged5_results, prf);
                            const sB = getProfileStageData<SeedStageBResult>(run.stageb_results, prf);
                            const sC = getProfileStageData<SeedStageCResult>(run.stagec_results, prf);
                            const sD3 = getProfileStageData<SeedVariantResult[]>(run.staged3_results, prf);
                            const sE = getProfileStageData<SeedStageEResult>(run.stagee_results, prf);
                            const sF = getProfileStageData<any>(run.stagef_results, prf);
                            const t2 = getProfileStageData<Tier2Summary>(run.tier2_results, prf);
                            const t3 = getProfileStageData<Tier3Summary>(run.tier3_results, prf);
                            const diag = getProfileStageData<SeedDiagnostics>(run.diagnostics, prf);
                            const profileStageVal = isConcurrentProfile ? (run.profile_stages?.[prf] ?? '') : '';
                            const isFastFail = profileStageVal.includes('fast-fail');
                            const isOpen = openProfiles.has(prf);

                            const toggleProfile = () => {
                                setOpenProfiles(prev => {
                                    const next = new Set(prev);
                                    if (next.has(prf)) next.delete(prf); else next.add(prf);
                                    return next;
                                });
                            };

                            const variantChips = (variants: SeedVariantResult[]) => (
                                <div className="flex flex-wrap gap-1">
                                    {variants.map(v => (
                                        <span key={v.label} className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                            v.winner ? (isDarkMode ? 'bg-emerald-900/30 ring-1 ring-emerald-700/50' : 'bg-emerald-50 ring-1 ring-emerald-200')
                                            : isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'
                                        }`}>
                                            <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>{v.label}</span>
                                            <span className={v.sharpe > 0 ? 'text-emerald-400' : 'text-red-400'}>S:{fmtNum(v.sharpe)}</span>
                                            <span className={muted}>{v.trades}t</span>
                                            {v.winner && <span className="text-emerald-500">★</span>}
                                        </span>
                                    ))}
                                </div>
                            );

                            // Get profile result summary for inline display
                            const profileResult = (run.profile_results as any[])?.find((p: any) => p.profile === prf);
                            const sAForBadge = getProfileStageData<SeedVariantResult[]>(run.stagea_results, prf);
                            const isInverted = sAForBadge?.some(v => v.label === 'inverted-direction' && v.winner);

                            return (
                                <div key={prf} className="mb-1">
                                    <button
                                        onClick={toggleProfile}
                                        className={`flex items-center gap-2 w-full text-left py-1 px-1 rounded ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-gray-200/60'} transition-colors`}
                                    >
                                        <span className={`transform transition-transform text-[10px] ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                                        <span className={`text-xs font-mono font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{prf === 'default' ? 'default' : prf}</span>
                                        {isInverted && <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${isDarkMode ? 'bg-amber-900/30 text-amber-400 ring-1 ring-amber-700/50' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>INV</span>}
                                        {isFastFail && <span className="text-[10px] text-red-400 font-mono">FAST-FAIL</span>}
                                        {profileResult && (
                                            <span className={`text-[10px] font-mono ${profileResult.sharpe >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>S:{fmtNum(profileResult.sharpe)}</span>
                                        )}
                                        {profileResult && profileResult.trades > 0 && <span className={`text-[10px] font-mono ${muted}`}>{profileResult.trades}t</span>}
                                        {profileResult && (
                                            <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                                                profileResult.passed
                                                    ? isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                                                    : isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                                            }`}>{profileResult.passed ? 'PASS' : 'FAIL'}</span>
                                        )}
                                        {!profileResult && profileStageVal && (
                                            <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600'}`}>{profileStageVal}</span>
                                        )}
                                    </button>
                                    {isOpen && (
                                    <div className={`space-y-3 ml-4 mt-1 pl-2 border-l-2 ${isDarkMode ? 'border-purple-800/40' : 'border-purple-200'}`}>

                                    {/* Historical seed runs may have stage0_results — they render as no-op now */}

                                    {(getProfileStageData<SeedComponentResult[]>(run.stage0_results, prf)?.length ?? 0) > 0 && (
                                        <SeedStageSection title="Weights — Component Ranking" isDarkMode={isDarkMode} muted={muted}>
                                            <div className="flex flex-wrap gap-1">
                                                {(getProfileStageData<SeedComponentResult[]>(run.stage0_results, prf) ?? []).sort((a, b) => b.sharpe - a.sharpe).map(c => (
                                                    <span key={c.component} className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'}`}>
                                                        <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>{c.component}</span>
                                                        <span className={c.sharpe > 0 ? 'text-emerald-400' : 'text-red-400'}>S:{fmtNum(c.sharpe)}</span>
                                                        <span className={muted}>WR:{c.win_rate ? `${c.win_rate.toFixed(0)}%` : '—'}</span>
                                                        <span className={muted}>{c.trades}t</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </SeedStageSection>
                                    )}

                                    {sA && sA.length > 0 && <SeedStageSection title={sA.some(v => v.label === 'inverted-direction') ? 'Baseline + Inversion Test' : 'Baseline — Raw Signal Variants'} isDarkMode={isDarkMode} muted={muted}>{variantChips(sA)}</SeedStageSection>}
                                    {sD && sD.length > 0 && <SeedStageSection title="Entry — Strategy Sweep" isDarkMode={isDarkMode} muted={muted}>{variantChips(sD)}</SeedStageSection>}
                                    {sD2 && sD2.length > 0 && <SeedStageSection title="R:R Threshold — Min Risk:Reward" isDarkMode={isDarkMode} muted={muted}>{variantChips(sD2)}</SeedStageSection>}
                                    {sD4 && sD4.length > 0 && <SeedStageSection title="Trail — Trailing Stop Sweep" isDarkMode={isDarkMode} muted={muted}>{variantChips(sD4)}</SeedStageSection>}
                                    {sD5 && sD5.length > 0 && <SeedStageSection title="Mkt/Lim — Market Order Sweep" isDarkMode={isDarkMode} muted={muted}>{variantChips(sD5)}</SeedStageSection>}

                                    {sB && (
                                        <SeedStageSection title="Filters — Isolation Sweep" isDarkMode={isDarkMode} muted={muted}>
                                            <div className="space-y-1">
                                                <p className={`text-[10px] ${muted}`}>Baseline Sharpe: {fmtNum(sB.baseline_sharpe)}</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {sB.filters?.map(f => (
                                                        <span key={f.filter} className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                                            f.helps ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50') : isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'
                                                        }`}>
                                                            <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>{f.filter}</span>
                                                            <span className={f.helps ? 'text-emerald-400' : 'text-red-400'}>S:{fmtNum(f.sharpe)}</span>
                                                            <span className={f.helps ? 'text-emerald-500' : 'text-red-500'}>{f.helps ? 'kept' : 'dropped'}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </SeedStageSection>
                                    )}

                                    {sC && (
                                        <SeedStageSection title="Dampeners — With vs Without" isDarkMode={isDarkMode} muted={muted}>
                                            <div className={`flex gap-3 text-[10px] font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                <span>With: S:{fmtNum(sC.with_dampeners)} T:{sC.with_trades ?? '?'} WR:{(sC.with_wr ?? 0).toFixed(1)}%</span>
                                                <span>Without: S:{fmtNum(sC.without_dampeners)} T:{sC.without_trades ?? '?'} WR:{(sC.without_wr ?? 0).toFixed(1)}%</span>
                                                <span className="text-emerald-500">Winner: {sC.winner}</span>
                                            </div>
                                        </SeedStageSection>
                                    )}

                                    {sD3 && sD3.length > 0 && <SeedStageSection title="Hours — Trading Hour Exclusion" isDarkMode={isDarkMode} muted={muted}>{variantChips(sD3)}</SeedStageSection>}

                                    {sE && (
                                        <SeedStageSection title="Assembly — Final Calibration" isDarkMode={isDarkMode} muted={muted}>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className={`text-[10px] font-medium uppercase ${muted} mb-1`}>Calibrated</p>
                                                    <div className="flex gap-2 text-[10px] font-mono">
                                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>S:{fmtNum(sE.calibrated_sharpe)}</span>
                                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>WR:{sE.calibrated_wr.toFixed(0)}%</span>
                                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{sE.calibrated_trades}t</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className={`text-[10px] font-medium uppercase ${muted} mb-1`}>Seed Default</p>
                                                    <div className="flex gap-2 text-[10px] font-mono">
                                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>S:{fmtNum(sE.seed_sharpe)}</span>
                                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>WR:{sE.seed_wr.toFixed(0)}%</span>
                                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{sE.seed_trades}t</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className={`text-[10px] font-mono mt-1 text-emerald-500`}>Winner: {sE.winner}</p>
                                        </SeedStageSection>
                                    )}

                                    {sF && (
                                        <SeedStageSection title={`Cascade — MTF Confirmation (${sF.entry_tf ?? '?'})`} isDarkMode={isDarkMode} muted={muted}>
                                            {sF.status === 'skipped' ? (
                                                <p className={`text-[10px] ${muted}`}>No cascade checks defined for this profile.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-3 text-[10px] font-mono">
                                                        <span className={muted}>Result:</span>
                                                        <span className={sF.winner === 'cascade'
                                                            ? 'text-emerald-400 font-semibold'
                                                            : sF.winner === 'nocascade'
                                                            ? 'text-cyan-400 font-semibold'
                                                            : 'text-gray-400'
                                                        }>{sF.winner === 'cascade' ? 'cascade kept (default)' : sF.winner === 'nocascade' ? 'nocascade child spawned' : sF.winner}</span>
                                                        {sF.child_spawned && <span className={muted}>({sF.child_spawned})</span>}
                                                    </div>
                                                    {sF.results?.length > 0 && (
                                                        <div className="space-y-1">
                                                            {(sF.results as any[]).map((r: any) => {
                                                                const withCas = r.with_cascade;
                                                                const noCas = r.without;
                                                                return (
                                                                    <div key={r.mode} className={`flex flex-wrap items-center gap-2 text-[10px] font-mono px-2 py-1 rounded ${
                                                                        isDarkMode ? 'bg-slate-800/50' : 'bg-gray-100'
                                                                    }`}>
                                                                        <span className="w-full text-[9px] text-gray-500 mb-0.5">with cascade (default) vs without</span>
                                                                        <span className={muted}>S:</span>
                                                                        <span className={withCas?.SharpeRatio >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtNum(withCas?.SharpeRatio)}</span>
                                                                        <span className={muted}>vs</span>
                                                                        <span className={noCas?.SharpeRatio >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtNum(noCas?.SharpeRatio)}</span>
                                                                        <span className={muted}>PF:</span>
                                                                        <span>{fmtNum(withCas?.ProfitFactor)}</span>
                                                                        <span className={muted}>vs</span>
                                                                        <span>{fmtNum(noCas?.ProfitFactor)}</span>
                                                                        <span className={muted}>t:</span>
                                                                        <span>{withCas?.TotalTrades ?? 0}</span>
                                                                        <span className={muted}>vs</span>
                                                                        <span>{noCas?.TotalTrades ?? 0}</span>
                                                                        {r.improvement && <span className="text-cyan-400">(nocascade viable)</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </SeedStageSection>
                                    )}

                                    {t2 && (
                                        <SeedStageSection title="Tier 2 — Hill Climbing" isDarkMode={isDarkMode} muted={muted}>
                                            <div className="flex flex-wrap gap-3 text-[10px] font-mono">
                                                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Rounds: {t2.rounds}</span>
                                                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Improvements: {t2.improvements}</span>
                                                <span className={t2.start_sharpe > 0 ? 'text-emerald-400' : 'text-red-400'}>Start: {fmtNum(t2.start_sharpe)}</span>
                                                <span className={t2.end_sharpe > 0 ? 'text-emerald-400' : 'text-red-400'}>End: {fmtNum(t2.end_sharpe)}</span>
                                                <span className={muted}>{t2.best_trades}t</span>
                                            </div>
                                        </SeedStageSection>
                                    )}

                                    {t3 && (
                                        <SeedStageSection title="Tier 3 — Random Exploration" isDarkMode={isDarkMode} muted={muted}>
                                            <div className="flex flex-wrap gap-3 text-[10px] font-mono">
                                                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Window Tests: {t3.window_tests}</span>
                                                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Random Tests: {t3.random_tests}</span>
                                                <span className={t3.best_cal_sharpe > 0 ? 'text-emerald-400' : 'text-red-400'}>Cal Best: {fmtNum(t3.best_cal_sharpe)}</span>
                                                <span className={t3.best_random_sharpe > 0 ? 'text-emerald-400' : 'text-red-400'}>Rand Best: {fmtNum(t3.best_random_sharpe)}</span>
                                                {t3.random_beat_calibrated && <span className="text-amber-400">Random beat calibrated!</span>}
                                                <span className={muted}>{t3.best_trades}t</span>
                                            </div>
                                        </SeedStageSection>
                                    )}

                                    {diag && (
                                        <SeedStageSection title="Diagnostics — Failure Analysis" isDarkMode={isDarkMode} muted={muted}>
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap gap-3 text-[10px] font-mono">
                                                    <span className="text-red-400">Best Sharpe: {fmtNum(diag.best_sharpe)}</span>
                                                    <span className={muted}>Configs: {diag.configs_tested}</span>
                                                    <span className={muted}>IS/OOS Gap: {fmtNum(diag.is_vs_oos_gap)}</span>
                                                    {diag.random_beat_calibrated && <span className="text-amber-400">Random &gt; Calibrated</span>}
                                                </div>
                                                {diag.per_direction?.length > 0 && (
                                                    <div>
                                                        <p className={`text-[9px] uppercase ${muted} mb-0.5`}>Direction</p>
                                                        <div className="flex gap-2">
                                                            {diag.per_direction.map(d => (
                                                                <span key={d.d} className={`text-[10px] font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{d.d}: {d.w}/{d.n} wins, PF:{fmtNum(d.pf)}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {diag.per_exit?.length > 0 && (
                                                    <div>
                                                        <p className={`text-[9px] uppercase ${muted} mb-0.5`}>Exit Reasons</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {diag.per_exit.map(e => (
                                                                <span key={e.r} className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'}`}>
                                                                    <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>{e.r}</span>
                                                                    <span className={muted}>{e.n}x</span>
                                                                    <span className={e.avg >= 0 ? 'text-emerald-400' : 'text-red-400'}>avg:{fmtNum(e.avg)}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {diag.score_dist && Object.keys(diag.score_dist).length > 0 && (
                                                    <div>
                                                        <p className={`text-[9px] uppercase ${muted} mb-0.5`}>Score Distribution</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {Object.entries(diag.score_dist).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([bucket, count]) => (
                                                                <span key={bucket} className={`text-[10px] font-mono px-1 py-0.5 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'}`}>
                                                                    <span className={muted}>{bucket}:</span> <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{count}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {diag.per_symbol?.length > 0 && (
                                                    <div>
                                                        <p className={`text-[9px] uppercase ${muted} mb-0.5`}>Top Symbols (by trades)</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {diag.per_symbol.slice(0, 10).map(s => (
                                                                <span key={s.s} className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'}`}>
                                                                    <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>{s.s}</span>
                                                                    <span className={s.sr > 0 ? 'text-emerald-400' : 'text-red-400'}>S:{fmtNum(s.sr)}</span>
                                                                    <span className={muted}>{s.w}/{s.n}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {diag.per_hour?.length > 0 && (
                                                    <div>
                                                        <p className={`text-[9px] uppercase ${muted} mb-0.5`}>Hourly Performance</p>
                                                        <div className="flex flex-wrap gap-0.5">
                                                            {diag.per_hour.sort((a, b) => a.h - b.h).map(h => {
                                                                const wr = h.n > 0 ? h.w / h.n : 0;
                                                                const bg = h.n === 0 ? (isDarkMode ? 'bg-slate-800' : 'bg-gray-300')
                                                                    : wr >= 0.6 ? 'bg-emerald-600/40' : wr >= 0.4 ? 'bg-yellow-600/40' : 'bg-red-600/40';
                                                                return (
                                                                    <span key={h.h} className={`text-[9px] font-mono px-1 py-0.5 rounded ${bg}`}
                                                                          title={`${h.h}:00 — ${h.n} trades, ${h.w} wins, PnL: ${h.pnl.toFixed(2)}`}>
                                                                        {h.h.toString().padStart(2, '0')}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </SeedStageSection>
                                    )}
                                    </div>
                                    )}
                                </div>
                            );
                        })}
                        </>
                        );
                    })()}
                    </div>
                </div>
            )}
        </div>
    );
}

function SeedStageSection({title, isDarkMode, muted, children}: {title: string; isDarkMode: boolean; muted: string; children: React.ReactNode}) {
    return (
        <div>
            <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>{title}</p>
            <div className={`rounded border px-2 py-1.5 ${isDarkMode ? 'border-slate-600/50 bg-slate-900/60' : 'border-gray-300 bg-gray-200/60'}`}>
                {children}
            </div>
        </div>
    );
}

// --- Helpers ---

/** Format numbers smartly — use exponential notation for very small values */
const fmtNum = sharedFmtNum;
const fmtPct = sharedFmtPct;
const avgPnl = sharedAvgPnl;
const plColor = sharedPlColor;

function genDuration(g: OptimizerGeneration): string {
    if (!g.completed_at || !g.started_at) return '—';
    const ms = dayjs(g.completed_at).diff(dayjs(g.started_at));
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
    const h = Math.floor(ms / 3_600_000);
    const m = Math.round((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
}

// Memory cost per worker by timeframe (mirrors backend memoryCost map)
const MEM_COST: Record<string, number> = {scalp: 1.0, intraday: 0.29, swing: 0.02};

// @ts-ignore unused after unified pool
function computeDraftWorkers(
    budget: number,
    maxPerTF: number,
    draft: Record<string, {enabled: boolean; priority: number}>,
    hostCount: number = 1,
): {totalWorkers: number; memUsed: number; perTF: Record<string, number>} {
    const tfs = ['scalp', 'intraday', 'swing'];
    const perTF: Record<string, number> = {};
    const enabledTFs: string[] = [];
    let prioritySum = 0;
    const hosts = hostCount > 0 ? hostCount : 1;

    // Compute per-host budget (each host runs its own allocation independently)
    const perHostBudget = Math.max(1, Math.floor(budget / hosts));
    const perHostCores = Math.max(2, Math.floor(maxPerTF / hosts));

    for (const tf of tfs) {
        perTF[tf] = 0;
        if (draft[tf]?.enabled) {
            enabledTFs.push(tf);
            prioritySum += draft[tf].priority;
        }
    }
    if (enabledTFs.length === 0 || prioritySum === 0) return {totalWorkers: 0, memUsed: 0, perTF};

    for (const tf of enabledTFs) {
        const share = perHostBudget * draft[tf].priority / prioritySum;
        const cost = MEM_COST[tf] ?? 1;
        let workers = Math.floor(share / cost);
        if (workers < 1) workers = 1;
        if (workers > perHostCores) workers = perHostCores;
        perTF[tf] = workers;
    }

    // Trim pass 1: enforce per-host memory budget (lowest priority, highest cost first)
    for (;;) {
        let totalCost = 0;
        for (const tf of enabledTFs) totalCost += perTF[tf] * (MEM_COST[tf] ?? 1);
        if (totalCost <= perHostBudget) break;
        let trimTF = '';
        let trimPri = 999;
        let trimCost = 0;
        for (const tf of enabledTFs) {
            if (perTF[tf] > 1 && (draft[tf].priority < trimPri || (draft[tf].priority === trimPri && (MEM_COST[tf] ?? 1) > trimCost))) {
                trimPri = draft[tf].priority;
                trimCost = MEM_COST[tf] ?? 1;
                trimTF = tf;
            }
        }
        if (!trimTF) break;
        perTF[trimTF]--;
    }

    // Trim pass 2: enforce per-host CPU budget (lowest priority, cheapest mem cost first)
    for (;;) {
        let total = 0;
        for (const tf of enabledTFs) total += perTF[tf];
        if (total <= perHostCores) break;
        let trimTF = '';
        let trimPri = 999;
        let trimCost = Infinity;
        for (const tf of enabledTFs) {
            const cost = MEM_COST[tf] ?? 1;
            if (perTF[tf] > 1 && (draft[tf].priority < trimPri || (draft[tf].priority === trimPri && cost < trimCost))) {
                trimPri = draft[tf].priority;
                trimCost = cost;
                trimTF = tf;
            }
        }
        if (!trimTF) break;
        perTF[trimTF]--;
    }

    // Multiply by host count to get pool-wide totals
    let totalWorkers = 0;
    let memUsed = 0;
    for (const tf of enabledTFs) {
        perTF[tf] *= hosts;
        totalWorkers += perTF[tf];
        memUsed += perTF[tf] * (MEM_COST[tf] ?? 1);
    }
    return {totalWorkers, memUsed, perTF};
}

function WorkerGauge({workers, cores, memUsed, memBudget, isDarkMode}: {
    workers: number; cores: number; memUsed: number; memBudget: number; isDarkMode: boolean;
}) {
    // CPU gauge: workers vs cores
    const cpuPct = cores > 0 ? Math.min(workers / cores, 1) : 0;
    const cpuDisplay = Math.round(cpuPct * 100);
    const cpuBar = cpuPct <= 0.60 ? 'bg-emerald-500' : cpuPct <= 0.85 ? 'bg-amber-500' : 'bg-red-500';
    const cpuGlow = cpuPct <= 0.60 ? 'shadow-emerald-500/30' : cpuPct <= 0.85 ? 'shadow-amber-500/30' : 'shadow-red-500/30';
    const cpuText = cpuPct > 0.85 ? 'text-red-400 font-semibold' : cpuPct > 0.60 ? 'text-amber-400' : isDarkMode ? 'text-gray-400' : 'text-gray-500';

    // Memory gauge: always fits, but show utilization
    const memPct = memBudget > 0 ? Math.min(memUsed / memBudget, 1) : 0;
    const memDisplay = Math.round(memPct * 100);
    const memBar = memPct <= 0.60 ? 'bg-emerald-500' : memPct <= 0.85 ? 'bg-amber-500' : 'bg-red-500';
    const memGlow = memPct <= 0.60 ? 'shadow-emerald-500/30' : memPct <= 0.85 ? 'shadow-amber-500/30' : 'shadow-red-500/30';
    const memText = memPct > 0.85 ? 'text-red-400 font-semibold' : memPct > 0.60 ? 'text-amber-400' : isDarkMode ? 'text-gray-400' : 'text-gray-500';

    const labelCl = `text-xs font-medium w-10 text-right ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`;
    const trackCl = `flex-1 h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-gray-200'}`;

    return (
        <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-3">
                <span className={labelCl}>CPU</span>
                <div className={trackCl}>
                    <div className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${cpuBar} ${cpuGlow}`}
                        style={{width: `${cpuDisplay}%`}}/>
                </div>
                <span className={`text-xs font-mono whitespace-nowrap ${cpuText} hidden sm:inline`}>
                    {workers}/{cores} workers ({cpuDisplay}%)
                </span>
                <span className={`text-xs font-mono ${cpuText} sm:hidden`}>{cpuDisplay}%</span>
            </div>
            <div className="flex items-center gap-3">
                <span className={labelCl}>RAM</span>
                <div className={trackCl}>
                    <div className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${memBar} ${memGlow}`}
                        style={{width: `${memDisplay}%`}}/>
                </div>
                <span className={`text-xs font-mono whitespace-nowrap ${memText} hidden sm:inline`}>
                    {memUsed.toFixed(1)}/{memBudget} units ({memDisplay}%)
                </span>
                <span className={`text-xs font-mono ${memText} sm:hidden`}>{memDisplay}%</span>
            </div>
        </div>
    );
}

