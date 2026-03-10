import {useEffect, useState, useRef, useCallback} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {formatDollar} from '../common/Util';
import {useApi} from '../../context/Api';
import {fetchSettings, fetchSystem} from '../../api/client';
import {connectOrders, connectAlerts} from '../../api/sse';
import type {ApiSetting, ApiOrder, ApiAlert, ApiSystem, MonitorOllamaStatus} from '../../context/Types';
import {
    ServerStackIcon, CircleStackIcon, SignalIcon, Cog6ToothIcon,
    GlobeAltIcon, CheckCircleIcon, ClockIcon, ArrowTrendingUpIcon,
    ArrowTrendingDownIcon, BellAlertIcon, ChartBarSquareIcon, CpuChipIcon,
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const MAX_FEED = 20;

export default function Status() {
    const {isDarkMode} = useTheme();
    const {apiAvailable, apiBase, setApiBase, checking} = useApi();
    const [urlInput, setUrlInput] = useState(apiBase);

    const [system, setSystem] = useState<ApiSystem | null>(null);
    const [settings, setSettings] = useState<ApiSetting[] | null>(null);
    const [liveOrders, setLiveOrders] = useState<ApiOrder[]>([]);
    const [liveAlerts, setLiveAlerts] = useState<ApiAlert[]>([]);
    const [ollama, setOllama] = useState<MonitorOllamaStatus | null>(null);
    const ordersEndRef = useRef<HTMLDivElement>(null);
    const alertsEndRef = useRef<HTMLDivElement>(null);

    // Fetch REST data when API becomes available
    useEffect(() => {
        if (!apiAvailable) {
            setSystem(null);
            setSettings(null);
            return;
        }
        fetchSystem().then(setSystem);
        fetchSettings().then(setSettings);
        fetch(`${apiBase}/api/monitor/status`, {signal: AbortSignal.timeout(5000)})
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data?.ollama) setOllama(data.ollama); })
            .catch(() => {});
        const interval = setInterval(() => fetchSystem().then(setSystem), 30_000);
        return () => clearInterval(interval);
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
    useEffect(() => { ordersEndRef.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'}); }, [liveOrders]);
    useEffect(() => { alertsEndRef.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'}); }, [liveAlerts]);

    const handleSaveUrl = useCallback(() => {
        setApiBase(urlInput.trim());
    }, [urlInput, setApiBase]);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`;
    const heading = `text-lg font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const iconCl = 'w-5 h-5 text-cyan-500';

    // Group settings by prefix
    const settingsGroups = settings ? groupSettings(settings) : {};

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    <h1 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>System</h1>

                    {/* Connection Panel */}
                    <div className={`${card} mb-6`}>
                        <h2 className={heading}><SignalIcon className={iconCl}/>Connection</h2>
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
                            <GlobeAltIcon className="w-12 h-12 mx-auto text-gray-400 mb-4"/>
                            <p className={`text-lg ${muted}`}>API unavailable — connect to VPN to access live data</p>
                        </div>
                    )}

                    {apiAvailable && (
                        <>
                            {/* Service Versions */}
                            {system && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}><ServerStackIcon className={iconCl}/>Service Versions</h2>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className={muted}>
                                            <tr>
                                                <th className="text-left py-2 px-2 font-medium">Service</th>
                                                <th className="text-left py-2 px-2 font-medium">Commit</th>
                                                <th className="text-left py-2 px-2 font-medium">Message</th>
                                                <th className="text-left py-2 px-2 font-medium">Updated</th>
                                            </tr>
                                            </thead>
                                            <tbody className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>
                                            {system.services.map(s => (
                                                <tr key={s.service} className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-100'}`}>
                                                    <td className="py-2 px-2 font-medium flex items-center gap-2">
                                                        <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0"/>
                                                        {s.service}
                                                    </td>
                                                    <td className="py-2 px-2 font-mono text-cyan-500 text-xs">{s.sha.slice(0, 8)}</td>
                                                    <td className={`py-2 px-2 text-xs truncate max-w-xs ${muted}`}>{s.message}</td>
                                                    <td className={`py-2 px-2 text-xs ${muted}`}>
                                                        <span className="flex items-center gap-1">
                                                            <ClockIcon className="w-3.5 h-3.5"/>{dayjs(s.updated_at).fromNow()}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Database Rows */}
                            {system && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}><CircleStackIcon className={iconCl}/>Database Rows</h2>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {([
                                            ['Orders', system.database.orders],
                                            ['Alerts', system.database.alerts],
                                            ['Prices (Daily)', system.database.prices],
                                            ['Prices (15m)', system.database.prices_15m],
                                            ['Prices (1m)', system.database.prices_1m],
                                            ['Signals (Daily)', system.database.signals],
                                            ['Signals (15m)', system.database.signals_15m],
                                            ['Signals (1m)', system.database.signals_1m],
                                        ] as [string, number][]).map(([label, count]) => (
                                            <div key={label} className={`rounded-lg p-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                                <p className={`text-xs ${muted}`}>{label}</p>
                                                <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                    {count?.toLocaleString() ?? '—'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Ollama Models */}
                            {ollama?.models && ollama.models.length > 0 && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}><CpuChipIcon className={iconCl}/>Ollama Models</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {ollama.models.map(m => (
                                            <span
                                                key={m}
                                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                                                    isDarkMode ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-100 text-cyan-700'
                                                }`}
                                            >
                                                {m}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}


                            {/* Settings */}
                            {settings && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}><Cog6ToothIcon className={iconCl}/>Settings</h2>
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
                                    <h2 className={heading}>
                                        <ChartBarSquareIcon className={iconCl}/>Live Orders
                                        <span className="text-xs font-normal text-cyan-500 animate-pulse ml-1">SSE</span>
                                    </h2>
                                    <div className="max-h-96 overflow-y-auto space-y-1.5">
                                        {liveOrders.length === 0 && (
                                            <p className={`text-sm ${muted}`}>Waiting for orders...</p>
                                        )}
                                        {liveOrders.map((o, i) => (
                                            <div key={`${o.id}-${i}`} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                                                isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'
                                            }`}>
                                                <div className="flex items-center gap-2">
                                                    {o.direction === 'Long' ? (
                                                        <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-500"/>
                                                    ) : (
                                                        <ArrowTrendingDownIcon className="w-4 h-4 text-red-500"/>
                                                    )}
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
                                    <h2 className={heading}>
                                        <BellAlertIcon className={iconCl}/>Live Alerts
                                        <span className="text-xs font-normal text-cyan-500 animate-pulse ml-1">SSE</span>
                                    </h2>
                                    <div className="max-h-96 overflow-y-auto space-y-1.5">
                                        {liveAlerts.length === 0 && (
                                            <p className={`text-sm ${muted}`}>Waiting for alerts...</p>
                                        )}
                                        {liveAlerts.map((a, i) => (
                                            <div key={`${a.id}-${i}`} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                                                isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'
                                            }`}>
                                                <div className="flex items-center gap-2">
                                                    {a.direction === 'Long' ? (
                                                        <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-500"/>
                                                    ) : (
                                                        <ArrowTrendingDownIcon className="w-4 h-4 text-red-500"/>
                                                    )}
                                                    <span className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>{a.symbol.replace('_', '/')}</span>
                                                    <span className={muted}>{a.timeframe}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={muted}>{a.strategy}</span>
                                                    <span className={`font-medium ${
                                                        (a.score?.final_score ?? 0) >= 70 ? 'text-emerald-500' :
                                                        (a.score?.final_score ?? 0) >= 50 ? 'text-yellow-500' : 'text-red-500'
                                                    }`}>{(a.score?.final_score ?? 0).toFixed(1)}</span>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={alertsEndRef}/>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            {system && (
                                <p className={`text-center text-xs ${muted} flex items-center justify-center gap-1.5`}>
                                    <ClockIcon className="w-3.5 h-3.5"/>
                                    API uptime: {formatUptime(system.uptime)}
                                </p>
                            )}
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

function formatUptime(s: string): string {
    const match = s.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    if (!match) return s;
    const h = parseInt(match[1] || '0');
    const m = parseInt(match[2] || '0');
    if (h >= 24) {
        const d = Math.floor(h / 24);
        const rh = h % 24;
        return `${d}d ${rh}h`;
    }
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}
