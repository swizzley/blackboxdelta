import {useEffect, useState, useCallback} from 'react';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {
    fetchSurgeProfiles,
    enableSurgeProfile, disableSurgeProfile, soakSurgeProfile,
    goliveSurgeProfile, noliveSurgeProfile,
} from '../../api/client';
import type {SurgeProfile} from '../../context/Types';
import {ChevronDownIcon, ChevronUpIcon, MapIcon} from '@heroicons/react/24/outline';

export default function SurgeSection() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();

    const [profiles, setProfiles] = useState<SurgeProfile[]>([]);
    const [showProfiles, setShowProfiles] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`;
    const heading = `text-lg font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const iconCl = 'w-5 h-5 text-cyan-500';

    const loadData = useCallback(async () => {
        if (!apiAvailable) return;
        const p = await fetchSurgeProfiles();
        if (p) setProfiles(p);
    }, [apiAvailable]);

    useEffect(() => {
        loadData();
        const iv = setInterval(loadData, 5_000);
        return () => clearInterval(iv);
    }, [loadData]);

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

    const plColor = (v: number) => v > 0 ? 'text-green-500' : v < 0 ? 'text-red-500' : muted;

    if (profiles.length === 0) return null;

    return (
        <div className={`${card} mb-6`}>
            <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setShowProfiles(s => !s)}>
                <MapIcon className={iconCl}/>
                Surge Profiles (Market Structure)
                <span className={`text-xs font-normal ${muted} ml-auto`}>{profiles.length}</span>
                {showProfiles ? <ChevronUpIcon className={`w-4 h-4 ${muted}`}/> : <ChevronDownIcon className={`w-4 h-4 ${muted}`}/>}
            </h2>
            {showProfiles && (
                <div className="space-y-2">
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
    );
}
