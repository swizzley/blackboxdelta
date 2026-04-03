import {useEffect, useState, useCallback} from 'react';
import Pagination from '../common/Pagination';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {
    fetchSurgeProfiles, fetchSurgeGenerations, fetchSurgeBranches,
    enableSurgeProfile, disableSurgeProfile, soakSurgeProfile,
    goliveSurgeProfile, noliveSurgeProfile,
} from '../../api/client';
import type {SurgeProfile, SurgeGeneration, SurgeBranch} from '../../context/Types';
import {ChevronDownIcon, ChevronUpIcon, MapIcon} from '@heroicons/react/24/outline';

const GEN_PAGE_SIZE = 10;

export default function SurgeSection() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();

    const [profiles, setProfiles] = useState<SurgeProfile[]>([]);
    const [generations, setGenerations] = useState<SurgeGeneration[]>([]);
    const [genTotal, setGenTotal] = useState(0);
    const [genPage, setGenPage] = useState(0);
    const [showProfiles, setShowProfiles] = useState(true);
    const [showGens, setShowGens] = useState(false);
    const [expandedGen, setExpandedGen] = useState<number | null>(null);
    const [branches, setBranches] = useState<SurgeBranch[]>([]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`;
    const heading = `text-lg font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const iconCl = 'w-5 h-5 text-cyan-500';
    const thCl = `text-left text-xs font-medium uppercase tracking-wider ${muted}`;
    const tdCl = `text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`;

    const loadData = useCallback(async () => {
        if (!apiAvailable) return;
        const [p, g] = await Promise.all([
            fetchSurgeProfiles(),
            fetchSurgeGenerations(GEN_PAGE_SIZE, genPage),
        ]);
        if (p) setProfiles(p);
        if (g) { setGenerations(g.items ?? []); setGenTotal(g.total); }
    }, [apiAvailable, genPage]);

    useEffect(() => {
        loadData();
        const iv = setInterval(loadData, 5_000);
        return () => clearInterval(iv);
    }, [loadData]);

    const loadBranches = async (genId: number) => {
        if (expandedGen === genId) { setExpandedGen(null); return; }
        setExpandedGen(genId);
        const b = await fetchSurgeBranches(genId);
        setBranches(b ?? []);
    };

    const doAction = async (fn: (name: string) => Promise<any>, name: string) => {
        setActionLoading(name);
        await fn(name);
        await loadData();
        setActionLoading(null);
    };

    const statusBadge = (p: SurgeProfile) => {
        if (p.is_live && p.soaking) return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-amber-900/40 text-amber-400 animate-pulse' : 'bg-amber-100 text-amber-700 animate-pulse'}`}>SOAKING</span>;
        if (p.is_live) return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'}`}>LIVE</span>;
        if (p.enabled) return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-cyan-900/40 text-cyan-400 animate-pulse' : 'bg-cyan-100 text-cyan-700 animate-pulse'}`}>OPTIMIZING</span>;
        return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-gray-900/40 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>OFF</span>;
    };

    const genStatusBadge = (status: string) => {
        const cls = status === 'running' ? (isDarkMode ? 'bg-cyan-900/40 text-cyan-400 animate-pulse' : 'bg-cyan-100 text-cyan-700 animate-pulse')
            : status === 'complete' ? (isDarkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700')
            : status === 'failed' ? (isDarkMode ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700')
            : (isDarkMode ? 'bg-gray-900/40 text-gray-400' : 'bg-gray-100 text-gray-600');
        return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>{status}</span>;
    };

    const plColor = (v: number) => v > 0 ? 'text-green-500' : v < 0 ? 'text-red-500' : muted;

    return (
        <>
            {/* Surge Profiles */}
            <div className={`${card} mb-6`}>
                <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowProfiles(s => !s)}>
                    <MapIcon className={iconCl}/>
                    Surge Profiles (Market Structure)
                    <span className={`text-xs font-normal ${muted} ml-auto`}>{profiles.length}</span>
                    {showProfiles ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                </h2>
                {showProfiles && (
                    profiles.length === 0
                    ? <p className={`text-sm ${muted}`}>No surge profiles found. Run surge-seed.sql on the database.</p>
                    : <div className="space-y-2">
                        {profiles.map(p => (
                            <div key={p.name} className={`rounded px-3 py-2 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`font-mono text-xs font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>{p.name}</span>
                                    {statusBadge(p)}
                                    <span className={`text-[10px] ${muted}`}>{p.curve_timeframe} / {p.trend_timeframe} / {p.zone_timeframe}</span>
                                    <span className={`text-[10px] ${muted}`}>gens: {p.generation_counter}</span>
                                    {p.consecutive_failures > 0 && <span className={`text-[10px] text-amber-500`}>fails: {p.consecutive_failures}</span>}
                                    {p.oos_result && <span className={`text-[10px] font-mono ${plColor(p.oos_result.SharpeRatio || 0)}`}>
                                        Sharpe: {(p.oos_result.SharpeRatio || 0).toFixed(3)}
                                    </span>}

                                    <span className="ml-auto flex gap-1">
                                        {!p.is_live && (
                                            <button disabled={actionLoading === p.name}
                                                onClick={() => doAction(p.enabled ? disableSurgeProfile : enableSurgeProfile, p.name)}
                                                className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${p.enabled ? (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700') : (isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700')}`}>
                                                {p.enabled ? 'Off' : 'On'}
                                            </button>
                                        )}
                                        {p.enabled && !p.is_live && (
                                            <button disabled={actionLoading === p.name}
                                                onClick={() => doAction(soakSurgeProfile, p.name)}
                                                className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                                                Soak
                                            </button>
                                        )}
                                        {p.is_live && p.soaking && (
                                            <button disabled={actionLoading === p.name}
                                                onClick={() => doAction(goliveSurgeProfile, p.name)}
                                                className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'}`}>
                                                Go Live
                                            </button>
                                        )}
                                        {p.is_live && (
                                            <button disabled={actionLoading === p.name}
                                                onClick={() => doAction(noliveSurgeProfile, p.name)}
                                                className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'}`}>
                                                Pull
                                            </button>
                                        )}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Surge Generations */}
            <div className={`${card} mb-6`}>
                <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowGens(s => !s)}>
                    <MapIcon className={iconCl}/>
                    Surge Generations
                    <span className={`text-xs font-normal ${muted} ml-auto`}>{genTotal}</span>
                    {showGens ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
                </h2>
                {showGens && (
                    generations.length === 0
                    ? <p className={`text-sm ${muted}`}>No surge generations yet.</p>
                    : <>
                        <div className="space-y-2">
                            {generations.map(g => (
                                <div key={g.id}>
                                    <div className={`rounded px-3 py-2 cursor-pointer ${isDarkMode ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                                        onClick={() => loadBranches(g.id)}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`font-mono text-xs ${muted}`}>#{g.id}</span>
                                            <span className={`font-mono text-xs font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>{g.profile_name}</span>
                                            {genStatusBadge(g.status)}
                                            <span className={`text-[10px] ${muted}`}>{g.branch_count} branches</span>
                                            {g.claimed_by && <span className={`text-[10px] ${muted}`}>{g.claimed_by}</span>}
                                            <span className={`text-[10px] ${muted} ml-auto`}>{g.created_at?.slice(0, 19)}</span>
                                        </div>
                                    </div>
                                    {expandedGen === g.id && branches.length > 0 && (
                                        <div className={`ml-4 mt-1 mb-2 rounded ${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-100'} p-2`}>
                                            <table className="w-full text-xs font-mono">
                                                <thead>
                                                    <tr className={`border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                                        <th className={thCl}>ID</th>
                                                        <th className={thCl}>Status</th>
                                                        <th className={thCl}>IS Sharpe</th>
                                                        <th className={thCl}>IS PF</th>
                                                        <th className={thCl}>IS Trades</th>
                                                        <th className={thCl}>OOS Sharpe</th>
                                                        <th className={thCl}>OOS PF</th>
                                                        <th className={thCl}>OOS Trades</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {branches.map(b => (
                                                        <tr key={b.id} className={`border-b ${isDarkMode ? 'border-slate-700/30' : 'border-gray-100'}`}>
                                                            <td className={`px-1.5 py-1 ${muted}`}>{b.id}</td>
                                                            <td className="px-1.5 py-1">{genStatusBadge(b.status)}</td>
                                                            <td className={`px-1.5 py-1 ${plColor(b.is_sharpe)}`}>{b.is_sharpe.toFixed(3)}</td>
                                                            <td className={`px-1.5 py-1 ${plColor(b.is_pf - 1)}`}>{b.is_pf.toFixed(2)}</td>
                                                            <td className={tdCl}>{b.is_trades}</td>
                                                            <td className={`px-1.5 py-1 ${plColor(b.oos_sharpe)}`}>{b.oos_sharpe.toFixed(3)}</td>
                                                            <td className={`px-1.5 py-1 ${plColor(b.oos_pf - 1)}`}>{b.oos_pf.toFixed(2)}</td>
                                                            <td className={tdCl}>{b.oos_trades}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <Pagination totalItems={genTotal} page={genPage} pageSize={GEN_PAGE_SIZE} onPageChange={setGenPage}/>
                    </>
                )}
            </div>
        </>
    );
}
