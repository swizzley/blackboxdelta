import {useEffect, useState, useCallback} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import Tooltip from '../common/Tooltip';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {
    fetchOptimizerStatus, fetchOptimizerGenerations,
    fetchOptimizerTrunks, fetchOptimizerRecommendations,
    fetchOptimizerBranches, fetchOptimizerTrunkDetail,
    fetchOptimizerSeedRuns, fetchOptimizerWorkers, updateOptimizerWorkers,
    pushTrunk, revertTrunk, applyRecommendation, queueRecommendation, skipRecommendation,
} from '../../api/client';
import type {
    OptimizerStatus, OptimizerGeneration, OptimizerTrunk,
    OptimizerRecommendation, OptimizerResult, OptimizerBranch,
    OptimizerTrunkDetail, OptimizerParamDiff, OptimizerWorkerConfig,
    SeedRun, SeedComponentResult, SeedVariantResult,
    SeedStageBResult, SeedStageCResult, SeedStageEResult,
} from '../../context/Types';
import {
    BeakerIcon, ClockIcon,
    TableCellsIcon, LightBulbIcon, ChevronDownIcon, ChevronUpIcon,
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
    const [trunks, setTrunks] = useState<OptimizerTrunk[]>([]);
    const [generations, setGenerations] = useState<OptimizerGeneration[]>([]);
    const [recommendations, setRecommendations] = useState<OptimizerRecommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [seedRuns, setSeedRuns] = useState<SeedRun[]>([]);
    const [workerConfig, setWorkerConfig] = useState<OptimizerWorkerConfig | null>(null);
    const [workerDraft, setWorkerDraft] = useState<Record<string, {enabled: boolean; priority: number}>>({});
    const [workerDirty, setWorkerDirty] = useState(false);
    const [showSeeds, setShowSeeds] = useState(false);
    const [showTrunks, setShowTrunks] = useState(false);
    const [showRecs, setShowRecs] = useState(true);
    const [recActionLoading, setRecActionLoading] = useState<number | null>(null);
    const [showGens, setShowGens] = useState(false);
    const [revertTarget, setRevertTarget] = useState<number | null>(null);
    const [revertReason, setRevertReason] = useState('overfit');

    const loadData = useCallback(async () => {
        if (!apiAvailable) return;
        const [s, t, g, r, sr, wc] = await Promise.all([
            fetchOptimizerStatus(),
            fetchOptimizerTrunks(),
            fetchOptimizerGenerations(20),
            fetchOptimizerRecommendations(),
            fetchOptimizerSeedRuns(),
            fetchOptimizerWorkers(),
        ]);
        if (s) setStatus(s);
        if (t) setTrunks(t);
        if (g) setGenerations(g);
        if (r) setRecommendations(r);
        if (sr) setSeedRuns(sr);
        if (wc) {
            setWorkerConfig(wc);
            if (!workerDirty) {
                const draft: Record<string, {enabled: boolean; priority: number}> = {};
                for (const tf of ['scalp', 'intraday', 'swing']) {
                    const info = wc.timeframes[tf];
                    if (info) draft[tf] = {enabled: info.enabled, priority: info.priority};
                }
                setWorkerDraft(draft);
            }
        }
        setLoading(false);
    }, [apiAvailable, workerDirty]);

    useEffect(() => {
        loadData();
        const iv = setInterval(loadData, 10_000);
        return () => clearInterval(iv);
    }, [loadData]);

    const REVERT_REASONS = [
        { value: 'overfit', label: 'Overfitting (trade count collapse / curve fit)' },
        { value: 'regression', label: 'Performance regression' },
        { value: 'regime_change', label: 'Market regime change' },
        { value: 'bad_push', label: 'Bad push (wrong params)' },
        { value: 'manual_override', label: 'Manual override' },
    ];

    const handleRevert = async (trunkId: number) => {
        await revertTrunk(trunkId, revertReason);
        setRevertTarget(null);
        setRevertReason('overfit');
        loadData();
    };

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
                            {/* Per-Timeframe OOS Trade Totals */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-4">
                                {['scalp', 'intraday', 'swing'].map(tf => {
                                    const tfTrunks = trunks.filter(t => t.timeframe === tf);
                                    const totalTrades = tfTrunks.reduce((sum, t) => sum + (t.oos_result?.total_trades ?? 0), 0);
                                    return (
                                        <div key={tf} className={`rounded-lg px-4 py-2 flex items-center justify-between gap-3 ${isDarkMode ? 'bg-slate-800' : 'bg-white'} shadow`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <TimeframeBadge tf={tf} isDarkMode={isDarkMode}/>
                                                <span className={`text-xs ${muted} leading-tight`}>OOS trades (all trunks)</span>
                                            </div>
                                            <span className={`text-lg font-bold font-mono flex-shrink-0 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalTrades.toLocaleString()}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Per-Timeframe Trunks */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                {['scalp', 'intraday', 'swing'].map(tf => {
                                    const trunk = status?.current_trunks?.find(t => t.timeframe === tf);
                                    const activeGen = status?.active_generations?.find(g => g.timeframe === tf);
                                    const tfTrunks = trunks.filter(t => t.timeframe === tf);
                                    const liveTrunk = tfTrunks
                                        .filter(t => t.pushed_at)
                                        .sort((a, b) => new Date(b.pushed_at!).getTime() - new Date(a.pushed_at!).getTime())[0];
                                    const liveId = liveTrunk?.id;
                                    const isUpToDate = trunk ? trunk.id === liveId : true;
                                    const evolutionsSincePush = liveId != null && trunk
                                        ? tfTrunks.filter(t => t.id > liveId && t.id <= trunk.id).length
                                        : trunk?.id ?? 0;

                                    return (
                                        <div key={tf} className={card}>
                                            <div className="flex items-center justify-between mb-1">
                                                <h2 className={`${heading} !mb-0`}>
                                                    <TimeframeBadge tf={tf} isDarkMode={isDarkMode}/>
                                                    Trunk
                                                </h2>
                                                {trunk && (
                                                    <div className="flex items-center gap-2">
                                                        {!isUpToDate && (
                                                            <span className={`text-xs ${muted}`}>
                                                                {evolutionsSincePush} ev{evolutionsSincePush !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {isUpToDate && liveTrunk && (
                                                            <span className={`text-xs ${muted}`}>
                                                                {dayjs(liveTrunk.pushed_at).fromNow()}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={async () => { await pushTrunk(trunk.id); loadData(); }}
                                                            disabled={isUpToDate || !trunk.oos_result}
                                                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                                                isUpToDate || !trunk.oos_result
                                                                    ? isDarkMode ? 'bg-slate-700 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer'
                                                            }`}>
                                                            {isUpToDate ? 'Up to date' : !trunk.oos_result ? 'No OOS data' : `Deploy #${trunk.id}`}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {trunk ? (
                                                <TrunkCard trunk={trunk} isDarkMode={isDarkMode} muted={muted}/>
                                            ) : (
                                                <p className={`text-sm ${muted}`}>No trunk</p>
                                            )}

                                            {/* Active generation for this timeframe */}
                                            {activeGen && (
                                                <div className="mt-3">
                                                    <GenerationCard gen={activeGen} isDarkMode={isDarkMode} muted={muted}/>
                                                </div>
                                            )}

                                            {/* Diff drawer: changes since last push */}
                                            {trunk && (
                                                <TrunkDiffDrawer trunkId={trunk.id} isDarkMode={isDarkMode} muted={muted}/>
                                            )}

                                            {/* Per-timeframe counts */}
                                            <div className="mt-3 flex gap-4">
                                                <span className={`text-xs ${muted}`}>{tfTrunks.length} trunk{tfTrunks.length !== 1 ? 's' : ''}</span>
                                                <span className={`text-xs ${muted}`}>{generations.filter(g => g.timeframe === tf).length} gen{generations.filter(g => g.timeframe === tf).length !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Worker Allocation */}
                            {workerConfig && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}>
                                        <BeakerIcon className={iconCl}/>Worker Allocation
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
                                    {(() => {
                                        const budget = workerConfig.max_memory_units;
                                        const cores = workerConfig.cpu_cores || 16;
                                        const preview = computeDraftWorkers(budget, cores, workerDraft, workerConfig.host_count || 1);
                                        return (<>
                                            <WorkerGauge workers={preview.totalWorkers} cores={cores} memUsed={preview.memUsed} memBudget={budget} isDarkMode={isDarkMode}/>
                                            <div className="space-y-3">
                                                {['scalp', 'intraday', 'swing'].map(tf => {
                                                    const draft = workerDraft[tf];
                                                    const live = workerConfig.timeframes[tf];
                                                    const activeGen = status?.active_generations?.find(g => g.timeframe === tf);
                                                    if (!draft || !live) return null;
                                                    const tfWorkers = preview.perTF[tf] ?? 0;

                                                    return (
                                                        <div key={tf} className={`flex items-center gap-4 p-3 rounded-lg ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                                            <div className="flex items-center gap-2 w-24">
                                                                <TimeframeBadge tf={tf} isDarkMode={isDarkMode}/>
                                                            </div>

                                                            {/* Enable/Disable toggle */}
                                                            <button
                                                                onClick={() => {
                                                                    setWorkerDraft(prev => ({...prev, [tf]: {...prev[tf], enabled: !prev[tf].enabled}}));
                                                                    setWorkerDirty(true);
                                                                }}
                                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                                                    draft.enabled ? 'bg-cyan-600' : isDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                                                                }`}
                                                            >
                                                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                                    draft.enabled ? 'translate-x-5' : 'translate-x-0'
                                                                }`}/>
                                                            </button>

                                                            {/* Priority selector */}
                                                            <div className="flex gap-1">
                                                                {([1, 2, 3] as const).map(p => {
                                                                    const labels = {1: 'Low', 2: 'Med', 3: 'High'} as const;
                                                                    const isActive = draft.priority === p;
                                                                    return (
                                                                        <button
                                                                            key={p}
                                                                            disabled={!draft.enabled}
                                                                            onClick={() => {
                                                                                setWorkerDraft(prev => ({...prev, [tf]: {...prev[tf], priority: p}}));
                                                                                setWorkerDirty(true);
                                                                            }}
                                                                            className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                                                                                !draft.enabled
                                                                                    ? isDarkMode ? 'bg-slate-700 text-gray-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                                                    : isActive
                                                                                        ? 'bg-cyan-600 text-white'
                                                                                        : isDarkMode ? 'bg-slate-600 text-gray-300 hover:bg-slate-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                                            }`}
                                                                        >
                                                                            {labels[p]}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Per-TF worker count */}
                                                            <span className={`ml-auto text-xs font-mono ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                {tfWorkers > 0 ? `${tfWorkers}w` : '—'}
                                                            </span>

                                                            {/* Active generation indicator */}
                                                            {activeGen && (
                                                                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500 animate-pulse" title={`Gen ${activeGen.id} active`}/>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>);
                                    })()}

                                    {/* Apply button */}
                                    <div className="mt-4 flex items-center gap-3">
                                        <button
                                            disabled={!workerDirty}
                                            onClick={async () => {
                                                const cfg: Record<string, {enabled: boolean; priority: number}> = {};
                                                for (const tf of ['scalp', 'intraday', 'swing']) {
                                                    if (workerDraft[tf]) cfg[tf] = workerDraft[tf];
                                                }
                                                await updateOptimizerWorkers(cfg);
                                                setWorkerDirty(false);
                                                loadData();
                                            }}
                                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                                workerDirty
                                                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer'
                                                    : isDarkMode ? 'bg-slate-700 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            }`}
                                        >
                                            Apply
                                        </button>
                                        {workerDirty && (
                                            <button
                                                onClick={() => {
                                                    if (workerConfig) {
                                                        const draft: Record<string, {enabled: boolean; priority: number}> = {};
                                                        for (const tf of ['scalp', 'intraday', 'swing']) {
                                                            const info = workerConfig.timeframes[tf];
                                                            if (info) draft[tf] = {enabled: info.enabled, priority: info.priority};
                                                        }
                                                        setWorkerDraft(draft);
                                                    }
                                                    setWorkerDirty(false);
                                                }}
                                                className={`text-xs ${muted} hover:underline cursor-pointer`}
                                            >
                                                Reset
                                            </button>
                                        )}
                                        <span className={`text-xs ${muted} ml-auto`}>Changes take effect at next generation boundary</span>
                                    </div>
                                </div>
                            )}

                            {/* Seed Calibration Runs */}
                            {seedRuns.length > 0 && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowSeeds(s => !s)}>
                                        <BeakerIcon className={iconCl}/>Seed Calibration
                                        <span className={`text-xs font-normal ${muted} ml-auto`}>{seedRuns.length}</span>
                                        {showSeeds ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                                    </h2>
                                    {showSeeds && (
                                        <div className="space-y-3">
                                            {seedRuns.map(sr => (
                                                <SeedRunCard key={sr.id} run={sr} isDarkMode={isDarkMode} muted={muted}/>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Verification Queue (Recommendations) */}
                            <div className={`${card} mb-6`}>
                                <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowRecs(r => !r)}>
                                    <LightBulbIcon className={iconCl}/>Verification Queue
                                    <span className={`text-xs font-normal ${muted} ml-auto`}>{recommendations.length}</span>
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
                                                                <>
                                                                    <button
                                                                        disabled={recActionLoading === rec.id}
                                                                        onClick={async () => { setRecActionLoading(rec.id); await queueRecommendation(rec.id); loadData(); setRecActionLoading(null); }}
                                                                        className="px-2 py-1 text-xs rounded bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50"
                                                                    >Queue</button>
                                                                    <button
                                                                        disabled={recActionLoading === rec.id}
                                                                        onClick={async () => { setRecActionLoading(rec.id); await skipRecommendation(rec.id); loadData(); setRecActionLoading(null); }}
                                                                        className={`px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-slate-600 hover:bg-slate-500 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} disabled:opacity-50`}
                                                                    >Skip</button>
                                                                </>
                                                            )}
                                                            {rec.status === 'passed' && (
                                                                <button
                                                                    disabled={recActionLoading === rec.id}
                                                                    onClick={async () => {
                                                                        if (!confirm(`Apply recommendation #${rec.id} to ${rec.timeframe} trunk?`)) return;
                                                                        setRecActionLoading(rec.id);
                                                                        await applyRecommendation(rec.id);
                                                                        loadData();
                                                                        setRecActionLoading(null);
                                                                    }}
                                                                    className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                                                                >Apply to Trunk</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>

                            {/* Trunk History */}
                            <div className={`${card} mb-6`}>
                                <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowTrunks(t => !t)}>
                                    <TableCellsIcon className={iconCl}/>Trunk History
                                    <span className={`text-xs font-normal ${muted} ml-auto`}>{trunks.length}</span>
                                    {showTrunks ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                                </h2>
                                {showTrunks && (trunks.length === 0 ? (
                                    <p className={`text-sm ${muted}`}>No trunks recorded</p>
                                ) : (
                                    <div className="space-y-1">
                                        {(() => {
                                            // Find the live trunk per timeframe — most recently pushed for each tf
                                            const liveIdByTf = new Map<string, number>();
                                            for (const tf of ['scalp', 'intraday', 'swing']) {
                                                const pushed = trunks
                                                    .filter(t => t.timeframe === tf && t.pushed_at)
                                                    .sort((a, b) => new Date(b.pushed_at!).getTime() - new Date(a.pushed_at!).getTime());
                                                if (pushed.length > 0) liveIdByTf.set(tf, pushed[0].id);
                                            }
                                            // Sort: live trunks first (by tf order), then by ID descending
                                            const liveIds = new Set(liveIdByTf.values());
                                            const sorted = [...trunks].sort((a, b) => {
                                                const aLive = liveIds.has(a.id) ? 1 : 0;
                                                const bLive = liveIds.has(b.id) ? 1 : 0;
                                                if (aLive !== bLive) return bLive - aLive;
                                                return b.id - a.id;
                                            });
                                            return sorted.map(t => (
                                                <TrunkRow key={t.id} trunk={t} isDarkMode={isDarkMode} muted={muted}
                                                          isLive={liveIdByTf.get(t.timeframe) === t.id}
                                                          revertTarget={revertTarget} setRevertTarget={setRevertTarget}
                                                          revertReason={revertReason} setRevertReason={setRevertReason}
                                                          revertReasons={REVERT_REASONS} onRevert={handleRevert}/>
                                            ));
                                        })()}
                                    </div>
                                ))}
                            </div>

                            {/* Generation History with expandable branch details */}
                            <div className={`${card} mb-6`}>
                                <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowGens(g => !g)}>
                                    <ClockIcon className={iconCl}/>Generation History
                                    <span className={`text-xs font-normal ${muted} ml-auto`}>{generations.length}</span>
                                    {showGens ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                                </h2>
                                {showGens && (generations.length === 0 ? (
                                    <p className={`text-sm ${muted}`}>No generations recorded</p>
                                ) : (
                                    <div className="space-y-1">
                                        {generations.map(g => (
                                            <GenerationRow key={g.id} gen={g} isDarkMode={isDarkMode} muted={muted} thCl={thCl} tdCl={tdCl}/>
                                        ))}
                                    </div>
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

function TrunkSourceDot({trunk}: {trunk: OptimizerTrunk}) {
    const color = trunk.promoted_from_recommendation_id
        ? 'bg-violet-400' : trunk.promoted_from_branch_id
        ? 'bg-cyan-500' : 'bg-slate-500';
    const title = trunk.promoted_from_recommendation_id
        ? (trunk.promoted_rec_source ?? 'recommendation')
        : trunk.promoted_from_branch_id ? 'optimizer' : 'seed';
    return <span className={`inline-block w-2 h-2 rounded-sm flex-shrink-0 ${color}`} title={title}/>;
}

function TrunkCard({trunk, isDarkMode, muted}: {trunk: OptimizerTrunk; isDarkMode: boolean; muted: string}) {
    const r = trunk.oos_result;
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState<OptimizerTrunkDetail | null>(null);
    const [loading, setLoading] = useState(false);

    const toggle = async () => {
        if (!expanded && detail === null) {
            setLoading(true);
            const data = await fetchOptimizerTrunkDetail(trunk.id, 0);
            setDetail(data ?? null);
            setLoading(false);
        }
        setExpanded(e => !e);
    };

    const diffs = detail?.diffs ?? [];

    return (
        <div className={`rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50 hover:bg-slate-700/70' : 'bg-gray-50 hover:bg-gray-100'} cursor-pointer transition-colors`} onClick={toggle}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                    <TrunkSourceDot trunk={trunk}/>
                    <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Trunk #{trunk.id}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs ${muted}`}>Gen {trunk.generation} — {dayjs(trunk.promoted_at).fromNow()}</span>
                    {loading
                        ? <span className={`text-xs ${muted}`}>Loading…</span>
                        : expanded
                            ? <ChevronUpIcon className={`w-3.5 h-3.5 ${muted}`}/>
                            : <ChevronDownIcon className={`w-3.5 h-3.5 ${muted}`}/>
                    }
                </div>
            </div>
            {r ? (
                <div className="grid grid-cols-4 gap-1.5">
                    <ResultStat label="Sharpe" value={r.sharpe_ratio?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                    <ResultStat label="PF" value={r.profit_factor?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                    <WRFractionStat wr={r.win_rate} breakevenWR={r.breakeven_wr} isDarkMode={isDarkMode}/>
                    <ResultStat label="Avg P&L" value={avgPnl(r)} isDarkMode={isDarkMode} color={plColor(r.total_pnl)}/>
                    <ResultStat label="Trades" value={r.total_trades?.toLocaleString() ?? '—'} isDarkMode={isDarkMode}/>
                    <ResultStat label="T/Day" value={trunk.oos_days && r.total_trades ? (r.total_trades / trunk.oos_days).toFixed(2) : '—'} isDarkMode={isDarkMode}/>
                    <ResultStat label="AvgW" value={fmtPct(r.avg_win)} isDarkMode={isDarkMode} color="text-emerald-500"/>
                    <ResultStat label="AvgL" value={fmtPct(r.avg_loss)} isDarkMode={isDarkMode} color="text-red-500"/>
                </div>
            ) : (
                <p className={`text-sm ${muted}`}>No OOS result available</p>
            )}
            {expanded && detail && (
                <div className="mt-3 pt-3 border-t border-slate-600/30" onClick={e => e.stopPropagation()}>
                    {diffs.length === 0 ? (
                        <p className={`text-xs ${muted}`}>No significant changes from baseline (trunk #{detail.diff_base_id})</p>
                    ) : (
                        <DiffBlock diffs={diffs} baseId={detail.diff_base_id} isDarkMode={isDarkMode} muted={muted}/>
                    )}
                </div>
            )}
        </div>
    );
}

function TrunkDiffDrawer({trunkId, isDarkMode, muted}: {trunkId: number; isDarkMode: boolean; muted: string}) {
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState<OptimizerTrunkDetail | null>(null);
    const [loading, setLoading] = useState(false);

    const toggle = async () => {
        if (!expanded && detail === null) {
            setLoading(true);
            const data = await fetchOptimizerTrunkDetail(trunkId);
            setDetail(data ?? null);
            setLoading(false);
        }
        setExpanded(!expanded);
    };

    const diffs = detail?.diffs ?? [];

    return (
        <div className="mt-2">
            <button onClick={toggle} className={`flex items-center gap-1.5 text-xs ${muted} hover:${isDarkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors`}>
                {expanded
                    ? <ChevronUpIcon className="w-3.5 h-3.5"/>
                    : <ChevronDownIcon className="w-3.5 h-3.5"/>
                }
                {loading ? 'Loading...' : `Changes since last deploy${diffs.length > 0 ? ` (${diffs.length})` : ''}`}
            </button>
            {expanded && detail && (
                <div className="mt-2">
                    {diffs.length === 0 ? (
                        <p className={`text-xs ${muted}`}>No parameter changes since {detail.diff_base_id ? `trunk #${detail.diff_base_id}` : 'baseline'}</p>
                    ) : (
                        <DiffBlock diffs={diffs} baseId={detail.diff_base_id} isDarkMode={isDarkMode} muted={muted}/>
                    )}
                </div>
            )}
        </div>
    );
}

function DiffBlock({diffs, baseId, isDarkMode, muted}: {diffs: OptimizerParamDiff[]; baseId?: number; isDarkMode: boolean; muted: string}) {
    const filtered = [...diffs]
        .filter(d => d.key !== 'check.trunk_winrate')
        .sort((a, b) => a.key.localeCompare(b.key));
    return (
        <div>
            <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>
                vs {baseId ? `trunk #${baseId}` : 'baseline'} — {filtered.length} param{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className={`rounded border px-2 py-1.5 overflow-hidden flex flex-wrap gap-1 ${
                isDarkMode ? 'border-slate-600/50 bg-slate-900/60' : 'border-gray-300 bg-gray-200/60'
            }`}>
                {filtered.map(d => (
                    <span key={d.key} className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'
                    }`}>
                        <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>{d.key}:</span>
                        {d.old_value != null && <span className="text-red-400">{d.old_value}</span>}
                        {d.old_value != null && !d.removed && <span className={isDarkMode ? 'text-slate-600' : 'text-gray-400'}>→</span>}
                        {!d.removed && <span className="text-emerald-400">{d.new_value}</span>}
                        {d.removed && <span className={isDarkMode ? 'text-slate-600' : 'text-gray-400'}>(removed)</span>}
                    </span>
                ))}
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
                    <TimeframeBadge tf={gen.timeframe} isDarkMode={isDarkMode}/>
                    {phaseBadge
                        ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium animate-pulse ${phaseBadge.cls}`}>{phaseBadge.label}</span>
                        : <GenStatusBadge status={gen.status} isDarkMode={isDarkMode}/>
                    }
                </div>
                <span className={`text-xs ${muted}`}>{dayjs(gen.started_at).fromNow()}</span>
            </div>
            {noBranches ? (
                <p className={`text-xs ${muted}`}>
                    {failures >= 20
                        ? 'Deep stall — seed reset + cooldown pause active'
                        : failures >= 10
                            ? 'Stalling — escalated exploration with broader mutations and relaxed verifier'
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

    const toggle = async () => {
        if (!expanded && branches === null) {
            const data = await fetchOptimizerBranches(gen.id);
            setBranches(data ?? []);
        }
        setExpanded(!expanded);
    };

    return (
        <div className={`rounded-lg ${isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
            <button onClick={toggle} className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:${isDarkMode ? 'bg-slate-700/60' : 'bg-gray-100'} rounded-lg transition-colors`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>#{gen.id}</span>
                    <TimeframeBadge tf={gen.timeframe} isDarkMode={isDarkMode}/>
                    <GenStatusBadge status={gen.status} isDarkMode={isDarkMode}/>
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

function TrunkRow({trunk: t, isDarkMode, muted, isLive, revertTarget, setRevertTarget, revertReason, setRevertReason, revertReasons, onRevert}: {
    trunk: OptimizerTrunk; isDarkMode: boolean; muted: string; isLive: boolean;
    revertTarget: number | null; setRevertTarget: (id: number | null) => void;
    revertReason: string; setRevertReason: (r: string) => void;
    revertReasons: {value: string; label: string}[]; onRevert: (id: number) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState<OptimizerTrunkDetail | null>(null);

    const toggle = async () => {
        if (!expanded && detail === null) {
            const data = await fetchOptimizerTrunkDetail(t.id);
            setDetail(data ?? null);
        }
        setExpanded(!expanded);
    };

    const r = t.oos_result;
    const wasPushed = !!t.pushed_at;

    return (
        <div className={`rounded-lg ${isLive
            ? (isDarkMode ? 'bg-cyan-900/20 ring-1 ring-cyan-700/50' : 'bg-cyan-50 ring-1 ring-cyan-200')
            : (isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50')
        }`}>
            <button onClick={toggle} className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:${isDarkMode ? 'bg-slate-700/60' : 'bg-gray-100'} rounded-lg transition-colors`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <TrunkSourceDot trunk={t}/>
                        <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>#{t.id}</span>
                    </div>
                    <TimeframeBadge tf={t.timeframe} isDarkMode={isDarkMode}/>
                    <span className={`text-xs ${muted}`}>Gen {t.generation}</span>
                    {r && r.total_trades > 0 ? (
                        <span className={`text-xs ${muted} hidden sm:inline`}>
                            {r.total_trades} trades · <span>{r.win_rate?.toFixed(0)}% WR</span> · PF {r.profit_factor?.toFixed(2)} · Sharpe {r.sharpe_ratio?.toFixed(3)} · <span className={plColor(r.total_pnl)}>Avg P&L {avgPnl(r)}</span>
                        </span>
                    ) : (
                        <span className={`text-xs ${muted} hidden sm:inline`}>No OOS data</span>
                    )}
                    {isLive && (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isDarkMode ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                        }`}>LIVE</span>
                    )}
                    {wasPushed && !isLive && (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            isDarkMode ? 'bg-slate-600 text-gray-400' : 'bg-gray-200 text-gray-500'
                        }`}>previously pushed</span>
                    )}
                    {t.revert_reason && !t.reverted_to_trunk_id && (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            isDarkMode ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700'
                        }`}>{t.revert_reason}</span>
                    )}
                    {t.reverted_to_trunk_id && (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            isDarkMode ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-100 text-amber-700'
                        }`}>reverted from #{t.reverted_to_trunk_id}{t.revert_reason ? `: ${t.revert_reason}` : ''}</span>
                    )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs ${muted}`}>{dayjs(t.promoted_at).fromNow()}</span>
                    {expanded
                        ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/>
                        : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>
                    }
                </div>
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-4">
                    {/* OOS Results */}
                    {r && (
                        <div>
                            <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>OOS Results</p>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                <ResultStat label="Sharpe" value={r.sharpe_ratio?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                                <ResultStat label="PF" value={r.profit_factor?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                                <ResultStat label="Win%" value={r.win_rate ? `${r.win_rate.toFixed(0)}%` : '—'} isDarkMode={isDarkMode}/>
                                <ResultStat label="Trades" value={String(r.total_trades)} isDarkMode={isDarkMode}/>
                                <ResultStat label="Max DD" value={r.max_drawdown?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                                <ResultStat label="Avg P&L" value={avgPnl(r)} isDarkMode={isDarkMode} color={plColor(r.total_pnl)}/>
                            </div>
                        </div>
                    )}

                    {/* Branch directive */}
                    {detail?.directive && (
                        <div>
                            <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${muted}`}>Exploration Directive</p>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{detail.directive}</p>
                        </div>
                    )}

                    {/* Param diffs */}
                    {detail && detail.diffs && detail.diffs.length > 0 && (
                        <DiffBlock diffs={detail.diffs} baseId={detail.diff_base_id} isDarkMode={isDarkMode} muted={muted}/>
                    )}

                    {detail && (!detail.diffs || detail.diffs.length === 0) && (
                        <p className={`text-sm ${muted}`}>No parameter changes (initial trunk or identical params)</p>
                    )}

                    {/* Revert to this trunk (hide for already-reverted trunks) */}
                    {r && !isLive && !t.revert_reason && (
                        <div className="pt-2 border-t border-slate-600/30">
                            {revertTarget === t.id ? (
                                <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                                    <select
                                        value={revertReason}
                                        onChange={e => setRevertReason(e.target.value)}
                                        className={`text-xs rounded px-2 py-1.5 ${
                                            isDarkMode ? 'bg-slate-700 text-gray-200 border-slate-600' : 'bg-white text-gray-700 border-gray-300'
                                        } border`}>
                                        {revertReasons.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => onRevert(t.id)}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors">
                                        Confirm Revert
                                    </button>
                                    <button
                                        onClick={() => setRevertTarget(null)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                            isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}>
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setRevertTarget(t.id); }}
                                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                                        isDarkMode ? 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    }`}>
                                    Revert to #{t.id}
                                </button>
                            )}
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
                    <td colSpan={8} className="px-3 pb-3 pt-1">
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
                                <DiffBlock diffs={b.param_diffs} isDarkMode={isDarkMode} muted={muted}/>
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
        </div>
    );
}

function WRFractionStat({wr, breakevenWR, isDarkMode}: {wr?: number; breakevenWR?: number; isDarkMode: boolean}) {
    const above = wr != null && breakevenWR != null && breakevenWR > 0 && wr > breakevenWR;
    const wrColor = wr == null ? (isDarkMode ? 'text-gray-200' : 'text-gray-700')
        : above ? 'text-emerald-400' : 'text-red-400';
    return (
        <div className={`rounded px-2 py-1 ${isDarkMode ? 'bg-slate-600/50' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>WR</p>
            <p className={`text-sm font-semibold leading-tight ${wrColor}`}>{wr != null ? `${wr.toFixed(1)}%` : '—'}</p>
            <div className={`my-0.5 border-t ${isDarkMode ? 'border-slate-500/50' : 'border-gray-300/70'}`}/>
            <p className={`text-[10px] leading-tight ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{breakevenWR ? `BE ${breakevenWR.toFixed(1)}%` : 'BE —'}</p>
        </div>
    );
}

function ResultStat({label, value, isDarkMode, color, tooltip}: {label: string; value: string; isDarkMode: boolean; color?: string; tooltip?: string}) {
    const box = (
        <div className={`rounded px-2 py-1 ${isDarkMode ? 'bg-slate-600/50' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
            <p className={`text-sm font-semibold ${color ?? (isDarkMode ? 'text-gray-200' : 'text-gray-700')}`}>{value}</p>
        </div>
    );
    if (tooltip) return <Tooltip content={tooltip} className="">{box}</Tooltip>;
    return box;
}

function MiniStat({label, value, isDarkMode, warn}: {label: string; value: string; isDarkMode: boolean; warn?: boolean}) {
    return (
        <div className={`rounded-lg px-3 py-2 text-center ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
            <p className={`text-lg font-bold ${warn ? 'text-yellow-500' : (isDarkMode ? 'text-gray-200' : 'text-gray-700')}`}>{value}</p>
        </div>
    );
}

function TimeframeBadge({tf, isDarkMode}: {tf: string; isDarkMode: boolean}) {
    const colors: Record<string, string> = {
        scalp: isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700',
        intraday: isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700',
        swing: isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700',
    };
    const cls = colors[tf?.toLowerCase()] ?? (isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500');
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{tf || '—'}</span>;
}

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

const SEED_STAGES = ['Stage0', 'StageA', 'StageB', 'StageC', 'StageD', 'StageE'] as const;
const STAGE_LABELS: Record<string, string> = {
    Stage0: 'Weights',
    StageA: 'Baseline',
    StageB: 'Filters',
    StageC: 'Dampeners',
    StageD: 'Entry',
    StageE: 'Assembly',
};

function SeedRunCard({run, isDarkMode, muted}: {run: SeedRun; isDarkMode: boolean; muted: string}) {
    const [expanded, setExpanded] = useState(false);
    const isRunning = run.status === 'running';
    const currentIdx = SEED_STAGES.indexOf(run.current_stage as typeof SEED_STAGES[number]);

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
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>#{run.id}</span>
                    <TimeframeBadge tf={run.timeframe} isDarkMode={isDarkMode}/>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusCls}${isRunning ? ' animate-pulse' : ''}`}>{run.status}</span>
                    <span className={`text-xs ${muted}`}>{run.trigger_reason}</span>
                    {isRunning && <span className={`text-xs font-medium ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>{STAGE_LABELS[run.current_stage] ?? run.current_stage}</span>}
                    {run.trunk_id && <span className={`text-xs font-mono ${muted}`}>→ trunk #{run.trunk_id}</span>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    {durationStr && <span className={`text-xs ${muted}`}>{durationStr}</span>}
                    <span className={`text-xs ${muted}`}>{dayjs(run.started_at).fromNow()}</span>
                    {expanded ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                </div>
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Stage progress bar */}
                    <div className="flex gap-1">
                        {SEED_STAGES.map((stage, i) => {
                            const done = i < currentIdx || run.status === 'completed';
                            const active = i === currentIdx && isRunning;
                            return (
                                <div key={stage} className="flex-1">
                                    <div className={`h-1.5 rounded-full ${
                                        done ? 'bg-emerald-500'
                                        : active ? 'bg-cyan-500 animate-pulse'
                                        : isDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                                    }`}/>
                                    <p className={`text-[10px] mt-0.5 text-center ${
                                        active ? (isDarkMode ? 'text-cyan-400' : 'text-cyan-600')
                                        : done ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')
                                        : muted
                                    }`}>{STAGE_LABELS[stage] ?? stage}</p>
                                </div>
                            );
                        })}
                    </div>

                    {run.error_message && (
                        <p className="text-xs text-red-400 font-mono">{run.error_message}</p>
                    )}

                    {/* Stage 0: Component weights */}
                    {run.stage0_results && (run.stage0_results as SeedComponentResult[]).length > 0 && (
                        <SeedStageSection title="Weights — Component Ranking" isDarkMode={isDarkMode} muted={muted}>
                            <div className="flex flex-wrap gap-1">
                                {(run.stage0_results as SeedComponentResult[])
                                    .sort((a, b) => b.sharpe - a.sharpe)
                                    .map(c => (
                                    <span key={c.component} className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                        isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'
                                    }`}>
                                        <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>{c.component}</span>
                                        <span className={c.sharpe > 0 ? 'text-emerald-400' : 'text-red-400'}>S:{fmtNum(c.sharpe)}</span>
                                        <span className={muted}>W:{fmtNum(c.weight)}</span>
                                        <span className={muted}>{c.trades}t</span>
                                    </span>
                                ))}
                            </div>
                        </SeedStageSection>
                    )}

                    {/* Stage A: Raw signal variants */}
                    {run.stagea_results && (run.stagea_results as SeedVariantResult[]).length > 0 && (
                        <SeedStageSection title="Baseline — Raw Signal Variants" isDarkMode={isDarkMode} muted={muted}>
                            <div className="flex flex-wrap gap-1">
                                {(run.stagea_results as SeedVariantResult[]).map(v => (
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
                        </SeedStageSection>
                    )}

                    {/* Stage B: Filter isolation */}
                    {run.stageb_results && (
                        <SeedStageSection title="Filters — Isolation Sweep" isDarkMode={isDarkMode} muted={muted}>
                            <div className="space-y-1">
                                <p className={`text-[10px] ${muted}`}>Baseline Sharpe: {fmtNum((run.stageb_results as SeedStageBResult).baseline_sharpe)}</p>
                                <div className="flex flex-wrap gap-1">
                                    {(run.stageb_results as SeedStageBResult).filters?.map(f => (
                                        <span key={f.filter} className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                            f.helps ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50')
                                            : isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'
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

                    {/* Stage C: Dampener isolation */}
                    {run.stagec_results && (
                        <SeedStageSection title="Dampeners — With vs Without" isDarkMode={isDarkMode} muted={muted}>
                            <div className={`flex gap-3 text-[10px] font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                <span>With: S:{fmtNum((run.stagec_results as SeedStageCResult).with_dampeners)}</span>
                                <span>Without: S:{fmtNum((run.stagec_results as SeedStageCResult).without_dampeners)}</span>
                                <span className="text-emerald-500">Winner: {(run.stagec_results as SeedStageCResult).winner}</span>
                            </div>
                        </SeedStageSection>
                    )}

                    {/* Stage D: Entry strategy sweep */}
                    {run.staged_results && (run.staged_results as SeedVariantResult[]).length > 0 && (
                        <SeedStageSection title="Entry — Strategy Sweep" isDarkMode={isDarkMode} muted={muted}>
                            <div className="flex flex-wrap gap-1">
                                {(run.staged_results as SeedVariantResult[]).map(v => (
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
                        </SeedStageSection>
                    )}

                    {/* Stage E: Final assembly */}
                    {run.stagee_results && (
                        <SeedStageSection title="Assembly — Final Calibration" isDarkMode={isDarkMode} muted={muted}>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className={`text-[10px] font-medium uppercase ${muted} mb-1`}>Calibrated</p>
                                    <div className="flex gap-2 text-[10px] font-mono">
                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>S:{fmtNum((run.stagee_results as SeedStageEResult).calibrated_sharpe)}</span>
                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>WR:{(run.stagee_results as SeedStageEResult).calibrated_wr.toFixed(0)}%</span>
                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{(run.stagee_results as SeedStageEResult).calibrated_trades}t</span>
                                    </div>
                                </div>
                                <div>
                                    <p className={`text-[10px] font-medium uppercase ${muted} mb-1`}>Seed Default</p>
                                    <div className="flex gap-2 text-[10px] font-mono">
                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>S:{fmtNum((run.stagee_results as SeedStageEResult).seed_sharpe)}</span>
                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>WR:{(run.stagee_results as SeedStageEResult).seed_wr.toFixed(0)}%</span>
                                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{(run.stagee_results as SeedStageEResult).seed_trades}t</span>
                                    </div>
                                </div>
                            </div>
                            <p className={`text-[10px] font-mono mt-1 text-emerald-500`}>Winner: {(run.stagee_results as SeedStageEResult).winner}</p>
                        </SeedStageSection>
                    )}
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
function fmtNum(n?: number): string {
    if (n == null) return '—';
    const abs = Math.abs(n);
    if (abs === 0) return '0';
    if (abs < 0.01) return n.toExponential(2);
    return n.toFixed(2);
}

function fmtPct(n?: number): string {
    if (n == null) return '—';
    const pct = n * 100;
    if (pct === 0) return '0%';
    return (pct >= 0 ? '+' : '') + pct.toFixed(3) + '%';
}

function avgPnl(r: {total_pnl?: number; total_trades?: number}): string {
    if (r.total_pnl == null || !r.total_trades) return '—';
    return fmtPct(r.total_pnl / r.total_trades);
}


function plColor(pnl?: number): string {
    if (pnl == null) return '';
    return pnl >= 0 ? 'text-emerald-500' : 'text-red-500';
}

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
                <span className={`text-xs font-mono whitespace-nowrap ${cpuText}`}>
                    {workers}/{cores} workers ({cpuDisplay}%)
                </span>
            </div>
            <div className="flex items-center gap-3">
                <span className={labelCl}>RAM</span>
                <div className={trackCl}>
                    <div className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${memBar} ${memGlow}`}
                        style={{width: `${memDisplay}%`}}/>
                </div>
                <span className={`text-xs font-mono whitespace-nowrap ${memText}`}>
                    {memUsed.toFixed(1)}/{memBudget} units ({memDisplay}%)
                </span>
            </div>
        </div>
    );
}

