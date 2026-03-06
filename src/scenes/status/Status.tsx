import {useEffect, useState, useRef, useCallback} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {formatDollar} from '../common/Util';
import {useApi} from '../../context/Api';
import {fetchMarkets, fetchSettings, fetchVersions} from '../../api/client';
import {connectOrders, connectAlerts} from '../../api/sse';
import type {ApiMarket, ApiSetting, ApiOrder, ApiAlert} from '../../context/Types';

const MAX_FEED = 20;

export default function Status() {
    const {isDarkMode} = useTheme();
    const {apiAvailable, apiBase, setApiBase, checking} = useApi();
    const [urlInput, setUrlInput] = useState(apiBase);

    const [versions, setVersions] = useState<Record<string, string> | null>(null);
    const [markets, setMarkets] = useState<ApiMarket[] | null>(null);
    const [settings, setSettings] = useState<ApiSetting[] | null>(null);
    const [liveOrders, setLiveOrders] = useState<ApiOrder[]>([]);
    const [liveAlerts, setLiveAlerts] = useState<ApiAlert[]>([]);
    const ordersEndRef = useRef<HTMLDivElement>(null);
    const alertsEndRef = useRef<HTMLDivElement>(null);

    // Fetch REST data when API becomes available
    useEffect(() => {
        if (!apiAvailable) {
            setVersions(null);
            setMarkets(null);
            setSettings(null);
            return;
        }
        fetchVersions().then(setVersions);
        fetchMarkets().then(setMarkets);
        fetchSettings().then(setSettings);
    }, [apiAvailable]);

    // SSE connections
    useEffect(() => {
        if (!apiAvailable) return;
        const cleanupOrders = connectOrders(apiBase, (order) => {
            setLiveOrders(prev => [...prev.slice(-(MAX_FEED - 1)), order]);
        });
        const cleanupAlerts = connectAlerts(apiBase, (alert) => {
            setLiveAlerts(prev => [...prev.slice(-(MAX_FEED - 1)), alert]);
        });
        return () => { cleanupOrders(); cleanupAlerts(); };
    }, [apiAvailable, apiBase]);

    // Auto-scroll feeds
    useEffect(() => { ordersEndRef.current?.scrollIntoView({behavior: 'smooth'}); }, [liveOrders]);
    useEffect(() => { alertsEndRef.current?.scrollIntoView({behavior: 'smooth'}); }, [liveAlerts]);

    const handleSaveUrl = useCallback(() => {
        setApiBase(urlInput.trim());
    }, [urlInput, setApiBase]);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-4 transition-colors duration-500`;
    const heading = `text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';

    // Group settings by prefix
    const settingsGroups = settings ? groupSettings(settings) : {};

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    <h1 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>System Status</h1>

                    {/* Connection Panel */}
                    <div className={`${card} mb-6`}>
                        <h2 className={heading}>Connection</h2>
                        <div className="flex flex-wrap items-center gap-3">
                            <input
                                type="text"
                                value={urlInput}
                                onChange={e => setUrlInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveUrl()}
                                className={`flex-1 min-w-[250px] rounded-md px-3 py-1.5 text-sm font-mono border ${
                                    isDarkMode ? 'bg-slate-700 text-gray-200 border-slate-600' : 'bg-gray-50 text-gray-800 border-gray-300'
                                }`}
                            />
                            <button
                                onClick={handleSaveUrl}
                                className="px-4 py-1.5 rounded-md text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600"
                            >
                                Save
                            </button>
                            <span className={`inline-flex items-center gap-2 text-sm ${muted}`}>
                                <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                                    checking ? 'bg-yellow-400 animate-pulse' : apiAvailable ? 'bg-emerald-400' : 'bg-red-500'
                                }`}/>
                                {checking ? 'Checking...' : apiAvailable ? 'Connected' : 'Unavailable'}
                            </span>
                        </div>
                    </div>

                    {!apiAvailable && !checking && (
                        <div className={`${card} mb-6 text-center py-12`}>
                            <p className={`text-lg ${muted}`}>API unavailable — connect to VPN to access live data</p>
                        </div>
                    )}

                    {apiAvailable && (
                        <>
                            {/* Service Versions */}
                            {versions && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}>Service Versions</h2>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                                            <tr>
                                                <th className="text-left py-1 px-2 font-medium">Service</th>
                                                <th className="text-left py-1 px-2 font-medium">Version</th>
                                            </tr>
                                            </thead>
                                            <tbody className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>
                                            {Object.entries(versions).map(([svc, sha]) => (
                                                <tr key={svc} className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-100'}`}>
                                                    <td className="py-1.5 px-2">{svc}</td>
                                                    <td className="py-1.5 px-2 font-mono text-cyan-500">{sha}</td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Markets */}
                            {markets && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}>Markets ({markets.filter(m => m.enabled).length}/{markets.length} enabled)</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {markets.map(m => (
                                            <span
                                                key={m.id}
                                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                                                    m.enabled
                                                        ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                                                        : (isDarkMode ? 'bg-slate-700 text-gray-500' : 'bg-gray-100 text-gray-400')
                                                }`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${m.enabled ? 'bg-emerald-400' : 'bg-gray-400'}`}/>
                                                {m.id.replace('_', '/')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Settings */}
                            {settings && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}>Settings</h2>
                                    <div className="space-y-4">
                                        {Object.entries(settingsGroups).map(([group, items]) => (
                                            <div key={group}>
                                                <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {group}
                                                </h3>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <tbody>
                                                        {items.map(s => (
                                                            <tr key={s.key} className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-100'}`}>
                                                                <td className={`py-1 px-2 ${muted} w-1/3`}>{s.key}</td>
                                                                <td className={`py-1 px-2 font-mono ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{s.value}</td>
                                                                <td className="py-1 px-2 w-16 text-center">
                                                                    <span className={`inline-block w-2 h-2 rounded-full ${s.enabled ? 'bg-emerald-400' : 'bg-gray-400'}`}/>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Live Feeds */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                {/* Live Orders */}
                                <div className={card}>
                                    <h2 className={heading}>Live Orders <span className="text-xs font-normal text-cyan-500 animate-pulse">SSE</span></h2>
                                    <div className="max-h-96 overflow-y-auto space-y-1.5">
                                        {liveOrders.length === 0 && (
                                            <p className={`text-sm ${muted}`}>Waiting for orders...</p>
                                        )}
                                        {liveOrders.map((o, i) => (
                                            <div key={`${o.id}-${i}`} className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                                                isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'
                                            }`}>
                                                <div className="flex items-center gap-2">
                                                    <span className={o.direction === 'Long' ? 'text-emerald-500' : 'text-red-500'}>
                                                        {o.direction === 'Long' ? 'L' : 'S'}
                                                    </span>
                                                    <span className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>{o.symbol.replace('_', '/')}</span>
                                                    <span className={muted}>{o.timeframe}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                                        o.status === 'CLOSED' ? (isDarkMode ? 'bg-slate-600 text-gray-300' : 'bg-gray-100 text-gray-600') :
                                                        o.status === 'FILLED' ? 'bg-blue-900/30 text-blue-400' :
                                                        'bg-cyan-900/30 text-cyan-400'
                                                    }`}>{o.status}</span>
                                                    {o.profit != null && (
                                                        <span className={Number(o.profit) >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                                                            {formatDollar(Number(o.profit))}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={ordersEndRef}/>
                                    </div>
                                </div>

                                {/* Live Alerts */}
                                <div className={card}>
                                    <h2 className={heading}>Live Alerts <span className="text-xs font-normal text-cyan-500 animate-pulse">SSE</span></h2>
                                    <div className="max-h-96 overflow-y-auto space-y-1.5">
                                        {liveAlerts.length === 0 && (
                                            <p className={`text-sm ${muted}`}>Waiting for alerts...</p>
                                        )}
                                        {liveAlerts.map((a, i) => (
                                            <div key={`${a.id}-${i}`} className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                                                isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'
                                            }`}>
                                                <div className="flex items-center gap-2">
                                                    <span className={a.direction === 'Long' ? 'text-emerald-500' : 'text-red-500'}>
                                                        {a.direction === 'Long' ? 'L' : 'S'}
                                                    </span>
                                                    <span className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>{a.symbol.replace('_', '/')}</span>
                                                    <span className={muted}>{a.timeframe}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={muted}>{a.strategy}</span>
                                                    <span className={`font-medium ${
                                                        Number(a.score) >= 70 ? 'text-emerald-500' :
                                                        Number(a.score) >= 50 ? 'text-yellow-500' : 'text-red-500'
                                                    }`}>{Number(a.score).toFixed(1)}</span>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={alertsEndRef}/>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Foot/>
        </>
    );
}

function groupSettings(settings: ApiSetting[]): Record<string, ApiSetting[]> {
    const groups: Record<string, ApiSetting[]> = {};
    for (const s of settings) {
        const dotIdx = s.key.indexOf('.');
        const group = dotIdx > 0 ? s.key.slice(0, dotIdx) : 'general';
        (groups[group] ??= []).push(s);
    }
    return groups;
}
