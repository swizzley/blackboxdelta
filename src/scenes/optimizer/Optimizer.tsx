import {useEffect, useState, useCallback} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {
    fetchOptimizerStatus, fetchOptimizerGenerations,
    fetchOptimizerTrunks, fetchOptimizerRecommendations,
    queueRecommendation, skipRecommendation,
} from '../../api/client';
import type {
    OptimizerStatus, OptimizerGeneration, OptimizerTrunk,
    OptimizerRecommendation, OptimizerResult,
} from '../../context/Types';
import {
    BeakerIcon, ArrowTrendingUpIcon, ClockIcon,
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
            fetchOptimizerTrunks(10),
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
    const rowBg = isDarkMode ? 'even:bg-slate-700/30' : 'even:bg-gray-50';

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
                            {/* Current Trunk + Active Generation */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                {/* Current Trunk */}
                                <div className={card}>
                                    <h2 className={heading}><ArrowTrendingUpIcon className={iconCl}/>Current Trunk</h2>
                                    {status?.current_trunk ? (
                                        <TrunkCard trunk={status.current_trunk} isDarkMode={isDarkMode} muted={muted}/>
                                    ) : (
                                        <p className={`text-sm ${muted}`}>No active trunk</p>
                                    )}
                                    <div className="grid grid-cols-3 gap-3 mt-4">
                                        <MiniStat label="Total Trunks" value={String(status?.total_trunks ?? 0)} isDarkMode={isDarkMode}/>
                                        <MiniStat label="Generations" value={String(status?.total_generations ?? 0)} isDarkMode={isDarkMode}/>
                                        <MiniStat label="Consec. Failures" value={String(status?.consecutive_failures ?? 0)} isDarkMode={isDarkMode}
                                                  warn={(status?.consecutive_failures ?? 0) > 3}/>
                                    </div>
                                </div>

                                {/* Active Generation */}
                                <div className={card}>
                                    <h2 className={heading}><BeakerIcon className={iconCl}/>Active Generation</h2>
                                    {status?.active_generation ? (
                                        <GenerationCard gen={status.active_generation} isDarkMode={isDarkMode} muted={muted}/>
                                    ) : (
                                        <p className={`text-sm ${muted}`}>No generation running</p>
                                    )}
                                </div>
                            </div>

                            {/* Trunk History */}
                            <div className={`${card} mb-6`}>
                                <h2 className={heading}><TableCellsIcon className={iconCl}/>Trunk History</h2>
                                {trunks.length === 0 ? (
                                    <p className={`text-sm ${muted}`}>No trunks recorded</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-700/30">
                                                    <th className={`${thCl} pb-2 pr-4`}>ID</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>Gen</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>AI Score</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>Sharpe</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>PF</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>Win Rate</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>P&L</th>
                                                    <th className={`${thCl} pb-2`}>Promoted</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trunks.map(t => (
                                                    <tr key={t.id} className={rowBg}>
                                                        <td className={`${tdCl} py-2 pr-4 font-mono`}>{t.id}</td>
                                                        <td className={`${tdCl} py-2 pr-4`}>{t.generation}</td>
                                                        <td className={`${tdCl} py-2 pr-4 font-semibold`}>{t.ai_score}</td>
                                                        <td className={`${tdCl} py-2 pr-4`}>{t.oos_result?.sharpe_ratio?.toFixed(2) ?? '—'}</td>
                                                        <td className={`${tdCl} py-2 pr-4`}>{t.oos_result?.profit_factor?.toFixed(2) ?? '—'}</td>
                                                        <td className={`${tdCl} py-2 pr-4`}>{t.oos_result?.win_rate ? `${(t.oos_result.win_rate * 100).toFixed(0)}%` : '—'}</td>
                                                        <td className={`${tdCl} py-2 pr-4 ${plColor(t.oos_result?.total_pnl)}`}>{t.oos_result?.total_pnl?.toFixed(2) ?? '—'}</td>
                                                        <td className={`${tdCl} py-2`}>{dayjs(t.promoted_at).fromNow()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Generation History */}
                            <div className={`${card} mb-6`}>
                                <h2 className={heading}><ClockIcon className={iconCl}/>Generation History</h2>
                                {generations.length === 0 ? (
                                    <p className={`text-sm ${muted}`}>No generations recorded</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-700/30">
                                                    <th className={`${thCl} pb-2 pr-4`}>ID</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>Trunk</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>Timeframe</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>Status</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>Branches</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>Passed</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>Failed</th>
                                                    <th className={`${thCl} pb-2 pr-4`}>Duration</th>
                                                    <th className={`${thCl} pb-2`}>Started</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {generations.map(g => (
                                                    <tr key={g.id} className={rowBg}>
                                                        <td className={`${tdCl} py-2 pr-4 font-mono`}>{g.id}</td>
                                                        <td className={`${tdCl} py-2 pr-4`}>{g.trunk_id}</td>
                                                        <td className={`${tdCl} py-2 pr-4`}>
                                                            <TimeframeBadge tf={g.timeframe} isDarkMode={isDarkMode}/>
                                                        </td>
                                                        <td className={`${tdCl} py-2 pr-4`}>
                                                            <GenStatusBadge status={g.status} isDarkMode={isDarkMode}/>
                                                        </td>
                                                        <td className={`${tdCl} py-2 pr-4`}>{g.branch_count}</td>
                                                        <td className={`${tdCl} py-2 pr-4 text-emerald-500`}>{g.passed ?? '—'}</td>
                                                        <td className={`${tdCl} py-2 pr-4 text-red-500`}>{g.failed ?? '—'}</td>
                                                        <td className={`${tdCl} py-2 pr-4`}>{genDuration(g)}</td>
                                                        <td className={`${tdCl} py-2`}>{dayjs(g.started_at).fromNow()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Recommendations */}
                            <div className={`${card} mb-6`}>
                                <h2 className={heading}><LightBulbIcon className={iconCl}/>Recommendations</h2>
                                {recommendations.length === 0 ? (
                                    <p className={`text-sm ${muted}`}>No recommendations</p>
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
                                            />
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
                    <ResultStat label="Win Rate" value={r.win_rate ? `${(r.win_rate * 100).toFixed(0)}%` : '—'} isDarkMode={isDarkMode}/>
                    <ResultStat label="P&L" value={r.total_pnl?.toFixed(2) ?? '—'} isDarkMode={isDarkMode} color={plColor(r.total_pnl)}/>
                </div>
            ) : (
                <p className={`text-sm ${muted}`}>No OOS result available</p>
            )}
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

function RecommendationRow({rec, isDarkMode, muted, onQueue, onSkip}: {
    rec: OptimizerRecommendation; isDarkMode: boolean; muted: string;
    onQueue: () => void; onSkip: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const isPending = rec.status === 'pending';

    return (
        <div className={`rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <RecStatusBadge status={rec.status} isDarkMode={isDarkMode}/>
                    <span className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        {rec.source}{rec.source_id ? ` #${rec.source_id}` : ''}
                    </span>
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
                <ResultStat label="Win%" value={result.win_rate ? `${(result.win_rate * 100).toFixed(0)}%` : '—'} isDarkMode={isDarkMode}/>
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
