import {useState, useEffect, useRef} from 'react';
import {ChevronDownIcon, ChevronUpIcon} from '@heroicons/react/24/outline';
import Tooltip from '../../common/Tooltip';
import {fetchOptimizerBranches} from '../../../api/client';
import type {OptimizerGeneration, OptimizerBranch, OptimizerResult, OptimizerParamDiff} from '../../../context/Types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// --- Formatting helpers ---

export function fmtNum(n?: number): string {
    if (n == null) return '—';
    const abs = Math.abs(n);
    if (abs === 0) return '0';
    if (abs < 0.01) return n.toExponential(2);
    return n.toFixed(2);
}

export function fmtPct(n?: number): string {
    if (n == null) return '—';
    if (n === 0) return '0%';
    const sign = n >= 0 ? '+' : '';
    const abs = Math.abs(n);
    const dec = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
    return sign + n.toFixed(dec) + '%';
}

export function avgPnl(r: {total_pnl?: number; total_trades?: number}): string {
    if (r.total_pnl == null || !r.total_trades) return '—';
    return fmtPct(r.total_pnl / r.total_trades);
}

export function plColor(pnl?: number): string {
    if (pnl == null) return '';
    return pnl >= 0 ? 'text-emerald-500' : 'text-red-500';
}

// --- Presentational components ---

export function WRFractionStat({wr, breakevenWR, isDarkMode}: {wr?: number; breakevenWR?: number; isDarkMode: boolean}) {
    const above = wr != null && breakevenWR != null && breakevenWR > 0 && wr > breakevenWR;
    const wrColor = wr == null ? (isDarkMode ? 'text-gray-200' : 'text-gray-700')
        : above ? 'text-emerald-400' : 'text-red-400';
    const beColor = isDarkMode ? 'text-gray-500' : 'text-gray-400';
    return (
        <div className={`rounded px-2 py-1 ${isDarkMode ? 'bg-slate-600/50' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>WR / BE</p>
            <p className="text-xs font-semibold" title={`WR: ${wr != null ? wr.toFixed(1) : '—'}% / BE: ${breakevenWR ? breakevenWR.toFixed(1) : '—'}%`}>
                <span className={wrColor}>{wr != null ? `${wr.toFixed(0)}` : '—'}</span>
                <span className={`mx-0.5 ${beColor}`}>/</span>
                <span className={beColor}>{breakevenWR ? `${breakevenWR.toFixed(0)}` : '—'}</span>
            </p>
        </div>
    );
}

export function ResultStat({label, value, isDarkMode, color, tooltip, fullValue}: {label: string; value: string; isDarkMode: boolean; color?: string; tooltip?: string; fullValue?: string}) {
    const box = (
        <div className={`rounded px-2 py-1 min-w-0 ${isDarkMode ? 'bg-slate-600/50' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
            <p className={`text-xs font-semibold ${color ?? (isDarkMode ? 'text-gray-200' : 'text-gray-700')}`} title={fullValue ?? value}>{value}</p>
        </div>
    );
    if (tooltip) return <Tooltip content={tooltip} className="">{box}</Tooltip>;
    return box;
}

export function TimeframeBadge({tf, isDarkMode}: {tf: string; isDarkMode: boolean}) {
    const colors: Record<string, string> = {
        scalp: isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700',
        intraday: isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700',
        swing: isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700',
    };
    const cls = colors[tf?.toLowerCase()] ?? (isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500');
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{tf || '—'}</span>;
}

export function GenStatusBadge({status, isDarkMode}: {status: string; isDarkMode: boolean}) {
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

export function DiffBlock({diffs, baseId: _baseId, isDarkMode, muted, stripPrefix, hideHeader}: {
    diffs: OptimizerParamDiff[]; baseId?: number; isDarkMode: boolean; muted: string; stripPrefix?: string; hideHeader?: boolean;
}) {
    const filtered = [...diffs].sort((a, b) => a.key.localeCompare(b.key));
    return (
        <div>
            {!hideHeader && (
                <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${muted}`}>
                    vs baseline — {filtered.length} param{filtered.length !== 1 ? 's' : ''}
                </p>
            )}
            <div className={`rounded border px-2 py-1.5 overflow-hidden flex flex-wrap gap-1 ${isDarkMode ? 'border-slate-600/50 bg-slate-900/60' : 'border-gray-300 bg-gray-200/60'}`}>
                {filtered.map(d => {
                    const displayKey = stripPrefix && d.key.startsWith(stripPrefix) ? d.key.slice(stripPrefix.length) : d.key;
                    return (
                        <span key={d.key} title={d.key} className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-gray-300/80'}`}>
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

export function ResultBlock({label, result, isDarkMode, muted}: {label: string; result: OptimizerResult; isDarkMode: boolean; muted: string}) {
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

export function BranchRow({branch: b, isDarkMode, muted, winnerId}: {branch: OptimizerBranch; isDarkMode: boolean; muted: string; winnerId?: number}) {
    const [expanded, setExpanded] = useState(false);
    const isWinner = winnerId === b.id;
    const tdCl = `text-xs font-mono ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`;
    const rowCls = isWinner ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50') : (isDarkMode ? 'even:bg-slate-600/20' : 'even:bg-gray-50/50');
    const statusCls = b.status === 'passed' ? 'text-emerald-500' : b.status === 'failed' ? 'text-red-500' : b.status === 'running' || b.status === 'verifying' ? 'text-yellow-500' : (isDarkMode ? 'text-gray-400' : 'text-gray-500');
    const r = b.oos_result ?? b.is_result;
    const trades = r?.total_trades ?? b.total_trades;
    const winRate = r?.win_rate ?? b.win_rate;
    const pf = r?.profit_factor ?? b.profit_factor;
    const sharpe = r?.sharpe_ratio ?? b.sharpe_ratio;
    const dd = r?.max_drawdown ?? b.max_drawdown;
    const durationStr = b.created_at && b.completed_at ? (() => {
        const ms = dayjs(b.completed_at).diff(dayjs(b.created_at));
        if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
        if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
        const h = Math.floor(ms / 3_600_000);
        const m = Math.round((ms % 3_600_000) / 60_000);
        return `${h}h ${m}m`;
    })() : null;
    const dateRange = (start?: string, end?: string) => start && end ? `${dayjs(start).format('YYYY-MM-DD')} → ${dayjs(end).format('YYYY-MM-DD')}` : null;

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
                        : <span className={muted}>—</span>}
                </td>
                <td className={`${tdCl} py-1.5 pr-3`}>{trades || '—'}</td>
                <td className={`${tdCl} py-1.5 pr-3`}>{winRate ? `${winRate.toFixed(0)}%` : '—'}</td>
                <td className={`${tdCl} py-1.5 pr-3`}>{pf ? pf.toFixed(2) : '—'}</td>
                <td className={`${tdCl} py-1.5 pr-3`}>{sharpe ? sharpe.toFixed(2) : '—'}</td>
                <td className={`${tdCl} py-1.5 pr-3`}>{dd ? dd.toFixed(4) : '—'}</td>
                <td className={`${tdCl} py-1.5 text-xs truncate max-w-[200px]`} title={b.exploration_directive}>
                    {b.exploration_directive || '—'}
                    {expanded ? <ChevronUpIcon className={`w-3 h-3 inline ml-1 ${muted}`}/> : <ChevronDownIcon className={`w-3 h-3 inline ml-1 ${muted}`}/>}
                </td>
            </tr>
            {expanded && (
                <tr className={rowCls}>
                    <td colSpan={9} className="px-3 pb-3 pt-1">
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-4 text-xs">
                                {durationStr && <span className={muted}>Duration: <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{durationStr}</span></span>}
                                {dateRange(b.is_start, b.is_end) && <span className={muted}>IS: <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{dateRange(b.is_start, b.is_end)}</span></span>}
                                {dateRange(b.oos_start, b.oos_end) && <span className={muted}>OOS: <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{dateRange(b.oos_start, b.oos_end)}</span></span>}
                            </div>
                            {b.failure_reason && <div className="text-xs text-red-400 font-mono">{b.failure_reason}</div>}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {b.is_result && <ResultBlock label="In-Sample" result={b.is_result} isDarkMode={isDarkMode} muted={muted}/>}
                                {b.oos_result && <ResultBlock label="Out-of-Sample" result={b.oos_result} isDarkMode={isDarkMode} muted={muted}/>}
                            </div>
                            {b.param_diffs && b.param_diffs.length > 0 && <DiffBlock diffs={b.param_diffs} isDarkMode={isDarkMode} muted={muted}/>}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export function GenerationRow({gen, isDarkMode, muted}: {gen: OptimizerGeneration; isDarkMode: boolean; muted: string}) {
    const [expanded, setExpanded] = useState(false);
    const [branches, setBranches] = useState<OptimizerBranch[] | null>(null);
    const thCl = `text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`;

    useEffect(() => {
        if (!expanded || gen.status !== 'active') return;
        const iv = setInterval(async () => {
            const data = await fetchOptimizerBranches(gen.id);
            if (data) setBranches(data);
        }, 3_000);
        return () => clearInterval(iv);
    }, [expanded, gen.id, gen.status]);

    const prevStatus = useRef(gen.status);
    useEffect(() => {
        if (expanded && prevStatus.current === 'active' && gen.status !== 'active') {
            fetchOptimizerBranches(gen.id).then(data => { if (data) setBranches(data); });
        }
        prevStatus.current = gen.status;
    }, [expanded, gen.id, gen.status]);

    const toggle = async () => {
        if (!expanded) {
            if (branches === null || gen.status !== 'active') {
                const data = await fetchOptimizerBranches(gen.id);
                setBranches(data ?? []);
            }
        }
        setExpanded(!expanded);
    };

    const genDuration = () => {
        if (!gen.completed_at || !gen.started_at) return '—';
        const ms = dayjs(gen.completed_at).diff(dayjs(gen.started_at));
        if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
        if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
        const h = Math.floor(ms / 3_600_000);
        const m = Math.round((ms % 3_600_000) / 60_000);
        return `${h}h ${m}m`;
    };

    return (
        <div className={`rounded-lg ${isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
            <button onClick={toggle} className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:${isDarkMode ? 'bg-slate-700/60' : 'bg-gray-100'} rounded-lg transition-colors`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>#{gen.id}</span>
                    <TimeframeBadge tf={gen.timeframe} isDarkMode={isDarkMode}/>
                    <GenStatusBadge status={gen.status} isDarkMode={isDarkMode}/>
                    {gen.claimed_by && <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-mono ${isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-gray-200 text-gray-500'}`}>@{gen.claimed_by}</span>}
                    <span className={`text-xs ${muted} hidden sm:inline`}>
                        {gen.branch_count} branches
                        {gen.passed ? ` · ${gen.passed} passed` : ''}
                        {gen.failed ? ` · ${gen.failed} failed` : ''}
                    </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs ${muted}`}>{genDuration()}</span>
                    <span className={`text-xs ${muted} hidden sm:inline`}>{dayjs(gen.started_at).fromNow()}</span>
                    {expanded ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
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
                                        <BranchRow key={b.id} branch={b} isDarkMode={isDarkMode} winnerId={gen.winner_branch_id} muted={muted}/>
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

export function StageBadge({stage, isDarkMode}: {stage: string; isDarkMode: boolean}) {
    const colors: Record<string, string> = {
        disabled: isDarkMode ? 'bg-slate-700/50 text-gray-500' : 'bg-gray-200 text-gray-500',
        queued: isDarkMode ? 'bg-slate-600/30 text-slate-400' : 'bg-slate-100 text-slate-600',
        seeding: isDarkMode ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-100 text-cyan-700',
        optimizing: isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700',
        lhc: isDarkMode ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-100 text-violet-700',
        promoted: isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700',
        soaking: isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700',
        live: isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700',
        // Legacy stages (mapped from API until backend updated)
        passed: isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700',
        stalled: isDarkMode ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700',
        failed: isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700',
    };
    const cls = colors[stage] ?? (isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500');
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase ${cls}`}>{stage}</span>;
}
