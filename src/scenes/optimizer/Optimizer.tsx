import {useEffect, useState, useCallback} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {
    fetchOptimizerStatus, fetchOptimizerGenerations,
    fetchOptimizerTrunks, fetchOptimizerRecommendations,
    fetchOptimizerBranches, fetchOptimizerTrunkDetail,
    queueRecommendation, skipRecommendation,
    applyRecommendation, pushTrunk,
} from '../../api/client';
import type {
    OptimizerStatus, OptimizerGeneration, OptimizerTrunk,
    OptimizerRecommendation, OptimizerResult, OptimizerBranch,
    OptimizerTrunkDetail, OptimizerParamDiff,
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

    const loadData = useCallback(async () => {
        if (!apiAvailable) return;
        const [s, t, g, r] = await Promise.all([
            fetchOptimizerStatus(),
            fetchOptimizerTrunks(),
            fetchOptimizerGenerations(20),
            fetchOptimizerRecommendations(),
        ]);
        if (s) setStatus(s);
        if (t) setTrunks(t);
        if (g) setGenerations(g);
        if (r) setRecommendations(r);
        setLoading(false);
    }, [apiAvailable]);

    useEffect(() => {
        loadData();
        const iv = setInterval(loadData, 10_000);
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

                            {/* Verification Queue (Recommendations) */}
                            <div className={`${card} mb-6`}>
                                <h2 className={heading}><LightBulbIcon className={iconCl}/>Verification Queue</h2>
                                {recommendations.length === 0 ? (
                                    <div className={`text-center py-6 ${isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50'} rounded-lg`}>
                                        <LightBulbIcon className={`w-8 h-8 mx-auto mb-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}/>
                                        <p className={`text-sm ${muted}`}>No pending recommendations</p>
                                        <p className={`text-xs ${muted} mt-1`}>Analysis TODOs with parameter mutations will appear here for verification</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {recommendations.map(rec => (
                                            <RecommendationRow
                                                key={rec.id}
                                                rec={rec}
                                                isDarkMode={isDarkMode}
                                                muted={muted}
                                                onQueue={async () => { await queueRecommendation(rec.id); loadData(); }}
                                                onSkip={async () => { await skipRecommendation(rec.id); loadData(); }}
                                                onApply={async () => { await applyRecommendation(rec.id); loadData(); }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Trunk History */}
                            <div className={`${card} mb-6`}>
                                <h2 className={heading}><TableCellsIcon className={iconCl}/>Trunk History</h2>
                                {trunks.length === 0 ? (
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
                                                          isLive={liveIdByTf.get(t.timeframe) === t.id}/>
                                            ));
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* Generation History with expandable branch details */}
                            <div className={`${card} mb-6`}>
                                <h2 className={heading}><ClockIcon className={iconCl}/>Generation History</h2>
                                {generations.length === 0 ? (
                                    <p className={`text-sm ${muted}`}>No generations recorded</p>
                                ) : (
                                    <div className="space-y-1">
                                        {generations.map(g => (
                                            <GenerationRow key={g.id} gen={g} isDarkMode={isDarkMode} muted={muted} thCl={thCl} tdCl={tdCl}/>
                                        ))}
                                    </div>
                                )}
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

function TrunkCard({trunk, isDarkMode, muted}: {trunk: OptimizerTrunk; isDarkMode: boolean; muted: string}) {
    const r = trunk.oos_result;
    return (
        <div className={`rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Trunk #{trunk.id}</span>
                <span className={`text-xs ${muted}`}>Gen {trunk.generation} — {dayjs(trunk.promoted_at).fromNow()}</span>
            </div>
            {r ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <ResultStat label="Sharpe" value={r.sharpe_ratio?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                    <ResultStat label="Profit Factor" value={r.profit_factor?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                    <ResultStat label="Win Rate" value={r.win_rate ? `${r.win_rate.toFixed(0)}%` : '—'} isDarkMode={isDarkMode}/>
                    <ResultStat label="P&L" value={r.total_pnl?.toFixed(2) ?? '—'} isDarkMode={isDarkMode} color={plColor(r.total_pnl)}/>
                </div>
            ) : (
                <p className={`text-sm ${muted}`}>No OOS result available</p>
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
    return (
        <div>
            <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>
                vs {baseId ? `trunk #${baseId}` : 'baseline'} — {diffs.length} param{diffs.length !== 1 ? 's' : ''}
            </p>
            <div className={`rounded-lg overflow-hidden border max-h-64 overflow-y-auto ${isDarkMode ? 'border-slate-600 bg-slate-900' : 'border-gray-300 bg-gray-950'}`}>
                <div className="overflow-x-auto">
                    {[...diffs].sort((a, b) => a.key.localeCompare(b.key)).map(d => (
                        <div key={d.key}>
                            {d.old_value != null && (
                                <div className="flex bg-red-500/10 border-l-2 border-red-500">
                                    <span className="select-none w-6 text-center text-red-400 text-xs font-mono py-0.5 flex-shrink-0">-</span>
                                    <span className="text-xs font-mono py-0.5 text-red-300">{d.key} = {d.old_value}</span>
                                </div>
                            )}
                            {!d.removed && (
                                <div className="flex bg-emerald-500/10 border-l-2 border-emerald-500">
                                    <span className="select-none w-6 text-center text-emerald-400 text-xs font-mono py-0.5 flex-shrink-0">+</span>
                                    <span className="text-xs font-mono py-0.5 text-emerald-300">{d.key} = {d.new_value}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function GenerationCard({gen, isDarkMode, muted}: {gen: OptimizerGeneration; isDarkMode: boolean; muted: string}) {
    return (
        <div className={`rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Gen #{gen.id}</span>
                    <TimeframeBadge tf={gen.timeframe} isDarkMode={isDarkMode}/>
                    <GenStatusBadge status={gen.status} isDarkMode={isDarkMode}/>
                </div>
                <span className={`text-xs ${muted}`}>{dayjs(gen.started_at).fromNow()}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniStat label="Branches" value={String(gen.branch_count)} isDarkMode={isDarkMode}/>
                <MiniStat label="Passed" value={String(gen.passed ?? 0)} isDarkMode={isDarkMode}/>
                <MiniStat label="Failed" value={String(gen.failed ?? 0)} isDarkMode={isDarkMode}/>
                <MiniStat label="Running" value={String(gen.running ?? 0)} isDarkMode={isDarkMode}/>
            </div>
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

function TrunkRow({trunk: t, isDarkMode, muted, isLive}: {
    trunk: OptimizerTrunk; isDarkMode: boolean; muted: string; isLive: boolean;
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
                    <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>#{t.id}</span>
                    <TimeframeBadge tf={t.timeframe} isDarkMode={isDarkMode}/>
                    <span className={`text-xs ${muted}`}>Gen {t.generation}</span>
                    {r && r.total_trades > 0 ? (
                        <span className={`text-xs ${muted} hidden sm:inline`}>
                            {r.total_trades} trades · {r.win_rate?.toFixed(0)}% WR · PF {r.profit_factor?.toFixed(2)} · Sharpe {r.sharpe_ratio?.toFixed(3)} · <span className={plColor(r.total_pnl)}>P&L {r.total_pnl?.toFixed(2)}</span>
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
                                <ResultStat label="P&L" value={r.total_pnl?.toFixed(2) ?? '—'} isDarkMode={isDarkMode} color={plColor(r.total_pnl)}/>
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

                    {/* Param diffs — git-diff style */}
                    {detail && detail.diffs && detail.diffs.length > 0 && (
                        <div>
                            <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>
                                Changes since {detail.diff_base_id ? `trunk #${detail.diff_base_id}` : 'baseline'} ({detail.diffs.length} params)
                            </p>
                            <div className={`rounded-lg overflow-hidden border ${isDarkMode ? 'border-slate-600 bg-slate-900' : 'border-gray-300 bg-gray-950'}`}>
                                <div className="overflow-x-auto">
                                    {detail.diffs.sort((a, b) => a.key.localeCompare(b.key)).map(d => (
                                        <div key={d.key}>
                                            {d.old_value != null && (
                                                <div className="flex bg-red-500/10 border-l-2 border-red-500">
                                                    <span className="select-none w-6 text-center text-red-400 text-xs font-mono py-0.5 flex-shrink-0">-</span>
                                                    <span className="text-xs font-mono py-0.5 text-red-300">{d.key} = {d.old_value}</span>
                                                </div>
                                            )}
                                            {!d.removed && (
                                                <div className="flex bg-emerald-500/10 border-l-2 border-emerald-500">
                                                    <span className="select-none w-6 text-center text-emerald-400 text-xs font-mono py-0.5 flex-shrink-0">+</span>
                                                    <span className="text-xs font-mono py-0.5 text-emerald-300">{d.key} = {d.new_value}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {detail && (!detail.diffs || detail.diffs.length === 0) && (
                        <p className={`text-sm ${muted}`}>No parameter changes (initial trunk or identical params)</p>
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
                                <div>
                                    <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>
                                        Mutations ({b.param_diffs.length} params)
                                    </p>
                                    <div className={`rounded-lg overflow-hidden border ${isDarkMode ? 'border-slate-600 bg-slate-900' : 'border-gray-300 bg-gray-950'}`}>
                                        <div className="overflow-x-auto">
                                            {b.param_diffs.sort((a, b) => a.key.localeCompare(b.key)).map(d => (
                                                <div key={d.key}>
                                                    {d.old_value != null && (
                                                        <div className="flex bg-red-500/10 border-l-2 border-red-500">
                                                            <span className="select-none w-6 text-center text-red-400 text-xs font-mono py-0.5 flex-shrink-0">-</span>
                                                            <span className="text-xs font-mono py-0.5 text-red-300">{d.key} = {d.old_value}</span>
                                                        </div>
                                                    )}
                                                    {!d.removed && (
                                                        <div className="flex bg-emerald-500/10 border-l-2 border-emerald-500">
                                                            <span className="select-none w-6 text-center text-emerald-400 text-xs font-mono py-0.5 flex-shrink-0">+</span>
                                                            <span className="text-xs font-mono py-0.5 text-emerald-300">{d.key} = {d.new_value}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

function RecommendationRow({rec, isDarkMode, muted, onQueue, onSkip, onApply}: {
    rec: OptimizerRecommendation; isDarkMode: boolean; muted: string;
    onQueue: () => void; onSkip: () => void; onApply: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const isPending = rec.status === 'pending';
    const isPassed = rec.status === 'passed';
    const canApply = isPassed;

    return (
        <div className={`rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <RecStatusBadge status={rec.status} isDarkMode={isDarkMode}/>
                    {rec.timeframe && <TimeframeBadge tf={rec.timeframe} isDarkMode={isDarkMode}/>}
                    <span className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        {rec.source}{rec.source_id ? ` #${rec.source_id}` : ''}
                    </span>
                    {rec.trunk_id && <span className={`text-xs font-mono ${muted} hidden sm:inline`}>trunk #{rec.trunk_id}</span>}
                    <span className={`text-xs ${muted} hidden sm:inline`}>{dayjs(rec.created_at).fromNow()}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {isPending && (
                        <>
                            <button onClick={onQueue}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors">
                                Run
                            </button>
                            <button onClick={onSkip}
                                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                                        isDarkMode ? 'bg-slate-600 hover:bg-slate-500 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                                    }`}>
                                Skip
                            </button>
                        </>
                    )}
                    <button onClick={canApply ? onApply : undefined}
                            disabled={!canApply}
                            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                                canApply
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                                    : isDarkMode
                                        ? 'bg-slate-700 text-gray-600 cursor-not-allowed'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}>
                        Apply to Trunk
                    </button>
                    <button onClick={() => setExpanded(!expanded)}
                            className={`p-1 rounded ${isDarkMode ? 'hover:bg-slate-600' : 'hover:bg-gray-200'}`}>
                        {expanded
                            ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/>
                            : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>
                        }
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mt-3 space-y-3">
                    {rec.rationale && (
                        <p className={`text-sm ${muted}`}>{rec.rationale}</p>
                    )}

                    {/* Mutations */}
                    {rec.mutations && Object.keys(rec.mutations).length > 0 && (
                        <div>
                            <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>Mutations</p>
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(rec.mutations).map(([k, v]) => (
                                    <span key={k} className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono ${
                                        isDarkMode ? 'bg-slate-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                                    }`}>
                                        {k}={v}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {rec.is_result && (
                            <ResultBlock label="In-Sample" result={rec.is_result} isDarkMode={isDarkMode} muted={muted}/>
                        )}
                        {rec.oos_result && (
                            <ResultBlock label="Out-of-Sample" result={rec.oos_result} isDarkMode={isDarkMode} muted={muted}/>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ResultBlock({label, result, isDarkMode, muted}: {label: string; result: OptimizerResult; isDarkMode: boolean; muted: string}) {
    return (
        <div>
            <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>{label}</p>
            <div className="grid grid-cols-3 gap-2">
                <ResultStat label="Sharpe" value={result.sharpe_ratio?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                <ResultStat label="PF" value={result.profit_factor?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                <ResultStat label="Win%" value={result.win_rate ? `${result.win_rate.toFixed(0)}%` : '—'} isDarkMode={isDarkMode}/>
                <ResultStat label="Trades" value={String(result.total_trades)} isDarkMode={isDarkMode}/>
                <ResultStat label="Max DD" value={result.max_drawdown?.toFixed(2) ?? '—'} isDarkMode={isDarkMode}/>
                <ResultStat label="P&L" value={result.total_pnl?.toFixed(2) ?? '—'} isDarkMode={isDarkMode} color={plColor(result.total_pnl)}/>
            </div>
        </div>
    );
}

function ResultStat({label, value, isDarkMode, color}: {label: string; value: string; isDarkMode: boolean; color?: string}) {
    return (
        <div className={`rounded px-2 py-1 ${isDarkMode ? 'bg-slate-600/50' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
            <p className={`text-sm font-semibold ${color ?? (isDarkMode ? 'text-gray-200' : 'text-gray-700')}`}>{value}</p>
        </div>
    );
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

function RecStatusBadge({status, isDarkMode}: {status: string; isDarkMode: boolean}) {
    const s = status?.toLowerCase();
    let cls: string;
    let extra = '';
    switch (s) {
        case 'pending':
            cls = isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500';
            break;
        case 'queued':
            cls = isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700';
            break;
        case 'running':
            cls = isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700';
            extra = ' animate-pulse';
            break;
        case 'passed':
            cls = isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700';
            break;
        case 'failed':
            cls = isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700';
            break;
        case 'skipped':
            cls = isDarkMode ? 'bg-slate-700 text-gray-500 line-through' : 'bg-gray-100 text-gray-400 line-through';
            break;
        case 'applied':
            cls = isDarkMode ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-100 text-cyan-700';
            break;
        default:
            cls = isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500';
    }
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${cls}${extra}`}>{status}</span>;
}

// --- Helpers ---

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
