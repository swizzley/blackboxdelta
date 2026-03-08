import {useEffect, useState} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {connectMonitorStatus} from '../../api/sse';
import type {MonitorStatus, MonitorServiceInfo, MonitorAlertEvent} from '../../context/Types';
import {
    ServerStackIcon, CircleStackIcon, SignalIcon, CpuChipIcon,
    ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon,
    ClockIcon, BoltIcon, ArrowPathIcon, ChartBarIcon,
    GlobeAltIcon, BeakerIcon, NewspaperIcon,
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

type StatusColor = 'ok' | 'warn' | 'critical' | 'unknown';

function statusColor(status: string | undefined): StatusColor {
    if (!status) return 'unknown';
    if (status === 'ok' || status === 'active') return 'ok';
    if (status === 'warn') return 'warn';
    if (status === 'critical' || status === 'inactive') return 'critical';
    return 'unknown';
}

export default function System() {
    const {isDarkMode} = useTheme();
    const {apiAvailable, apiBase} = useApi();
    const [monitor, setMonitor] = useState<MonitorStatus | null>(null);
    const [monitorConnected, setMonitorConnected] = useState(false);

    useEffect(() => {
        if (!apiAvailable) {
            setMonitorConnected(false);
            setMonitor(null);
            return;
        }

        let cleanup: (() => void) | null = null;
        let mounted = true;

        fetch(`${apiBase}/api/monitor/status`, {signal: AbortSignal.timeout(5000)})
            .then(res => {
                if (!res.ok || !mounted) return;
                setMonitorConnected(true);
                cleanup = connectMonitorStatus(apiBase, (status) => {
                    if (mounted) setMonitor(status);
                });
            })
            .catch(() => { if (mounted) setMonitorConnected(false); });

        return () => { mounted = false; cleanup?.(); };
    }, [apiAvailable, apiBase]);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`;
    const heading = `text-lg font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const iconCl = 'w-5 h-5 text-cyan-500';

    const allServices = monitor
        ? [...(monitor.services?.cipher || []), ...(monitor.services?.genesis || []), ...(monitor.services?.sage || [])]
        : [];
    const activeCount = allServices.filter(s => s.status === 'active').length;
    const alertCount = monitor?.alerts_firing?.length ?? 0;

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    <div className="flex items-center gap-3 mb-6">
                        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Health</h1>
                        {monitorConnected && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-900/30 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"/>LIVE
                            </span>
                        )}
                    </div>

                    {!monitorConnected && !monitor ? (
                        <div className={`${card} text-center py-16`}>
                            <SignalIcon className="w-12 h-12 mx-auto text-gray-400 mb-4"/>
                            <p className={`text-lg ${muted}`}>API unavailable — connect to VPN to view system health</p>
                        </div>
                    ) : (
                        <>
                            {/* Overview KPIs */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <KPICard label="Monitor" value={monitorConnected ? 'UP' : 'DOWN'} color={monitorConnected ? 'ok' : 'critical'}
                                         icon={<SignalIcon className="w-6 h-6"/>} isDarkMode={isDarkMode}/>
                                <KPICard label="Market" value={monitor?.market_open ? 'OPEN' : 'CLOSED'} color={monitor?.market_open ? 'ok' : 'unknown'}
                                         icon={<ChartBarIcon className="w-6 h-6"/>} isDarkMode={isDarkMode}/>
                                <KPICard label="Services" value={`${activeCount}/${allServices.length}`} color={activeCount === allServices.length ? 'ok' : 'critical'}
                                         icon={<ServerStackIcon className="w-6 h-6"/>} isDarkMode={isDarkMode}/>
                                <KPICard label="Alerts" value={String(alertCount)} color={alertCount === 0 ? 'ok' : 'critical'}
                                         icon={<ExclamationTriangleIcon className="w-6 h-6"/>} isDarkMode={isDarkMode}/>
                            </div>

                            {/* Firing Alerts */}
                            {alertCount > 0 && (
                                <div className={`${isDarkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'} border rounded-lg shadow p-5 mb-6`}>
                                    <h2 className={`text-lg font-semibold mb-3 flex items-center gap-2 text-red-500`}>
                                        <ExclamationTriangleIcon className="w-5 h-5"/>Firing Alerts
                                    </h2>
                                    <div className="space-y-2">
                                        {monitor!.alerts_firing.map((a: MonitorAlertEvent) => (
                                            <div key={a.name} className={`flex items-center justify-between rounded-lg px-3 py-2 ${isDarkMode ? 'bg-red-900/10' : 'bg-red-100/50'}`}>
                                                <div className="flex items-center gap-2.5">
                                                    <StatusDot status={a.status === 'critical' ? 'critical' : 'warn'}/>
                                                    <span className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{a.name}</span>
                                                </div>
                                                <span className={`text-xs ${muted} flex items-center gap-1`}>
                                                    <ClockIcon className="w-3.5 h-3.5"/>{dayjs(a.since).fromNow()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Services */}
                            {monitor && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                    <ServerServices title="Cipher" services={monitor.services?.cipher || []} isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl}/>
                                    <ServerServices title="Genesis" services={monitor.services?.genesis || []} isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl} subtitle="replica"/>
                                    <ServerServices title="Sage" services={monitor.services?.sage || []} isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl}/>
                                </div>
                            )}

                            {/* Data Pipeline + OANDA + Ollama */}
                            {monitor && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                    {/* Data Freshness */}
                                    <div className={card}>
                                        <h2 className={heading}><BoltIcon className={iconCl}/>Data Pipeline</h2>
                                        <div className="space-y-2">
                                            {Object.entries(monitor.data_freshness || {}).map(([table, d]) => (
                                                <div key={table} className={`flex items-center justify-between rounded-lg px-3 py-2 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                                    <div className="flex items-center gap-2.5">
                                                        <StatusDot status={statusColor(d.status)}/>
                                                        <span className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{table}</span>
                                                    </div>
                                                    <span className={`text-xs ${muted}`}>{d.message || '—'}</span>
                                                </div>
                                            ))}
                                            {Object.keys(monitor.data_freshness || {}).length === 0 && (
                                                <p className={`text-sm ${muted}`}>Market closed — data checks paused</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* OANDA */}
                                    <div className={card}>
                                        <h2 className={heading}><GlobeAltIcon className={iconCl}/>OANDA Broker</h2>
                                        <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                            {monitor.oanda?.connected ? (
                                                <CheckCircleIcon className="w-8 h-8 text-emerald-500 flex-shrink-0"/>
                                            ) : (
                                                <XCircleIcon className="w-8 h-8 text-red-500 flex-shrink-0"/>
                                            )}
                                            <div>
                                                <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                                    {monitor.oanda?.connected ? 'Connected' : 'Disconnected'}
                                                </p>
                                                {monitor.oanda?.message && (
                                                    <p className={`text-xs ${muted}`}>{monitor.oanda.message}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ollama */}
                                    <div className={card}>
                                        <h2 className={heading}><CpuChipIcon className={iconCl}/>Ollama LLM</h2>
                                        <div className={`flex items-center gap-3 rounded-lg px-4 py-3 mb-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                            {monitor.ollama?.connected ? (
                                                <CheckCircleIcon className="w-8 h-8 text-emerald-500 flex-shrink-0"/>
                                            ) : (
                                                <XCircleIcon className="w-8 h-8 text-red-500 flex-shrink-0"/>
                                            )}
                                            <div>
                                                <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                                    {monitor.ollama?.connected ? 'Connected' : 'Disconnected'}
                                                </p>
                                                {monitor.ollama?.message && (
                                                    <p className={`text-xs ${muted}`}>{monitor.ollama.message}</p>
                                                )}
                                            </div>
                                        </div>
                                        {monitor.ollama?.vram_total_mb > 0 && (
                                            <div className={`rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>VRAM</span>
                                                    <span className={`text-sm font-bold ${monitor.ollama.vram_pct > 90 ? 'text-red-500' : monitor.ollama.vram_pct > 80 ? 'text-yellow-500' : 'text-emerald-500'}`}>
                                                        {monitor.ollama.vram_used_mb}MB / {monitor.ollama.vram_total_mb}MB
                                                    </span>
                                                </div>
                                                <ProgressBar pct={monitor.ollama.vram_pct} isDarkMode={isDarkMode}/>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Replication Visualization */}
                            {monitor && (
                                <ReplicationViz replication={monitor.replication} database={monitor.database} isDarkMode={isDarkMode} card={card} heading={heading} iconCl={iconCl}/>
                            )}

                            {/* Infrastructure */}
                            {monitor && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                    <ServerResources title="Cipher" res={monitor.resources?.cipher} db={monitor.database?.cipher}
                                                     isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl}/>
                                    <ServerResources title="Genesis" res={monitor.resources?.genesis} db={monitor.database?.genesis}
                                                     isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl} subtitle="replica"/>
                                    <ServerResources title="Sage" res={monitor.resources?.sage}
                                                     isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl}/>
                                </div>
                            )}

                            {/* Optimization */}
                            {monitor?.optimization?.message && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}><BeakerIcon className={iconCl}/>Optimization Engine</h2>
                                    <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                        <StatusBadge status={monitor.optimization.status} isDarkMode={isDarkMode}/>
                                        <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                            {monitor.optimization.message}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Sentiment */}
                            {monitor?.sentiment?.message && (
                                <div className={`${card} mb-6`}>
                                    <h2 className={heading}><NewspaperIcon className={iconCl}/>Sentiment Pipeline</h2>
                                    <div className={`flex items-center gap-3 rounded-lg px-4 py-3 mb-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                        <StatusBadge status={monitor.sentiment.status} isDarkMode={isDarkMode}/>
                                        <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                            {monitor.sentiment.message}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <MiniStat label="Total Articles" value={String(monitor.sentiment.total_articles)} isDarkMode={isDarkMode}/>
                                        <MiniStat label="Recent (24h)" value={String(monitor.sentiment.recent_articles)} isDarkMode={isDarkMode}/>
                                        <MiniStat label="Pairs Covered" value={String(monitor.sentiment.pairs_covered)} isDarkMode={isDarkMode}/>
                                        <MiniStat label="Avg Score" value={monitor.sentiment.avg_score?.toFixed(3) ?? '—'} isDarkMode={isDarkMode}/>
                                    </div>
                                </div>
                            )}

                            {/* Footer timestamp */}
                            {monitor?.timestamp && (
                                <p className={`text-center text-xs ${muted} flex items-center justify-center gap-1.5`}>
                                    <ClockIcon className="w-3.5 h-3.5"/>
                                    Last check: {dayjs(monitor.timestamp).fromNow()}
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

// --- Sub-components ---

function KPICard({label, value, color, icon, isDarkMode}: {label: string; value: string; color: StatusColor; icon: React.ReactNode; isDarkMode: boolean}) {
    const colorCl = color === 'ok' ? 'text-emerald-500' : color === 'warn' ? 'text-yellow-500' : color === 'critical' ? 'text-red-500' : (isDarkMode ? 'text-gray-400' : 'text-gray-500');
    const bgAccent = color === 'ok' ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50')
        : color === 'warn' ? (isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50')
            : color === 'critical' ? (isDarkMode ? 'bg-red-900/20' : 'bg-red-50')
                : '';
    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-4 transition-colors duration-500`}>
            <div className="flex items-center justify-between mb-2">
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
                <span className={`rounded-lg p-1.5 ${bgAccent}`}>
                    <span className={colorCl}>{icon}</span>
                </span>
            </div>
            <p className={`text-2xl font-bold ${colorCl}`}>{value}</p>
        </div>
    );
}

function StatusDot({status}: {status: StatusColor | string}) {
    const bg = status === 'ok' ? 'bg-emerald-400' : status === 'warn' ? 'bg-yellow-400' : status === 'critical' ? 'bg-red-500' : 'bg-gray-400';
    return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${bg}`}/>;
}

function StatusBadge({status, isDarkMode}: {status: string; isDarkMode: boolean}) {
    const s = statusColor(status);
    const cls = s === 'ok'
        ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
        : s === 'warn'
            ? (isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700')
            : s === 'critical'
                ? (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700')
                : (isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500');
    return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function ProgressBar({pct, isDarkMode}: {pct: number; isDarkMode: boolean}) {
    const barColor = pct > 90 ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-emerald-500';
    return (
        <div className={`w-full h-2 rounded-full ${isDarkMode ? 'bg-slate-600' : 'bg-gray-200'}`}>
            <div className={`h-2 rounded-full transition-all duration-700 ${barColor}`} style={{width: `${Math.min(pct, 100)}%`}}/>
        </div>
    );
}

function ServerServices({title, services, isDarkMode, muted, card, heading, iconCl, subtitle}: {
    title: string; services: MonitorServiceInfo[]; isDarkMode: boolean; muted: string; card: string; heading: string; iconCl: string; subtitle?: string;
}) {
    return (
        <div className={card}>
            <h2 className={heading}><ServerStackIcon className={iconCl}/>{title} Services{subtitle && <span className={`text-xs font-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} ml-1`}>({subtitle})</span>}</h2>
            {services.length === 0 ? (
                <p className={`text-sm ${muted}`}>No services reported</p>
            ) : (
                <div className="space-y-2">
                    {services.map(s => (
                        <div key={s.name} className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2.5">
                                {s.status === 'active' ? (
                                    <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0"/>
                                ) : (
                                    <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0"/>
                                )}
                                <span className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{s.name}</span>
                            </div>
                            <div className={`flex items-center gap-3 text-xs ${muted}`}>
                                {s.uptime && (
                                    <span className="flex items-center gap-1">
                                        <ClockIcon className="w-3.5 h-3.5"/>{s.uptime}
                                    </span>
                                )}
                                {s.memory_mb != null && s.memory_mb > 0 && (
                                    <span className="flex items-center gap-1">
                                        <CpuChipIcon className="w-3.5 h-3.5"/>{s.memory_mb}MB
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ReplicationViz({replication, database, isDarkMode, card, heading, iconCl}: {
    replication?: {status?: string; message?: string; io_running?: boolean; sql_running?: boolean; seconds_behind_source?: number};
    database?: Record<string, {status?: string}>;
    isDarkMode: boolean; card: string; heading: string; iconCl: string;
}) {
    const isOk = replication?.status === 'ok';
    const isBroken = replication?.status === 'critical';
    const lineColor = isOk ? 'stroke-emerald-500' : isBroken ? 'stroke-red-500' : 'stroke-yellow-500';
    const dotColor = isOk ? 'fill-emerald-400' : isBroken ? 'fill-red-500' : 'fill-yellow-400';
    const glowColor = isOk ? 'text-emerald-500' : isBroken ? 'text-red-500' : 'text-yellow-500';

    const cipherDbOk = database?.cipher?.status === 'ok';
    const genesisDbOk = database?.genesis?.status === 'ok' || replication?.status === 'ok';

    return (
        <div className={`${card} mb-6`}>
            <h2 className={heading}><ArrowPathIcon className={iconCl}/>Database Replication</h2>
            <div className="flex items-center justify-center gap-0 py-4">
                {/* Cipher DB (master) */}
                <div className="flex flex-col items-center gap-2 w-28">
                    <div className={`relative rounded-xl p-3 ${isDarkMode ? 'bg-slate-700/70' : 'bg-gray-100'}`}>
                        <CircleStackIcon className={`w-10 h-10 ${cipherDbOk ? 'text-cyan-500' : 'text-red-500 animate-pulse'}`}/>
                        <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${cipherDbOk ? 'bg-emerald-400' : 'bg-red-500 animate-ping'}`}/>
                    </div>
                    <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Cipher</span>
                    <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>master</span>
                </div>

                {/* Animated connection line */}
                <div className="flex-1 max-w-xs mx-4 relative">
                    <svg viewBox="0 0 200 40" className="w-full h-10 overflow-visible">
                        {/* Base line */}
                        <line x1="0" y1="20" x2="200" y2="20" className={`${lineColor} ${isBroken ? 'opacity-30' : 'opacity-40'}`} strokeWidth="2" strokeDasharray={isBroken ? '4 4' : 'none'}/>

                        {isOk && (
                            <>
                                {/* Pulse line overlay */}
                                <line x1="0" y1="20" x2="200" y2="20" className={lineColor} strokeWidth="2" opacity="0.7"/>

                                {/* Animated data dots traveling right */}
                                <circle r="4" className={dotColor} opacity="0.9">
                                    <animate attributeName="cx" from="0" to="200" dur="2s" repeatCount="indefinite"/>
                                    <animate attributeName="opacity" values="0;0.9;0.9;0" dur="2s" repeatCount="indefinite"/>
                                </circle>
                                <circle r="4" className={dotColor} opacity="0.9">
                                    <animate attributeName="cx" from="0" to="200" dur="2s" begin="0.7s" repeatCount="indefinite"/>
                                    <animate attributeName="opacity" values="0;0.9;0.9;0" dur="2s" begin="0.7s" repeatCount="indefinite"/>
                                </circle>
                                <circle r="4" className={dotColor} opacity="0.9">
                                    <animate attributeName="cx" from="0" to="200" dur="2s" begin="1.4s" repeatCount="indefinite"/>
                                    <animate attributeName="opacity" values="0;0.9;0.9;0" dur="2s" begin="1.4s" repeatCount="indefinite"/>
                                </circle>

                                {/* Glow effect */}
                                <circle r="6" className={dotColor} opacity="0.3" filter="url(#glow)">
                                    <animate attributeName="cx" from="0" to="200" dur="2s" repeatCount="indefinite"/>
                                    <animate attributeName="opacity" values="0;0.3;0.3;0" dur="2s" repeatCount="indefinite"/>
                                </circle>
                                <defs>
                                    <filter id="glow">
                                        <feGaussianBlur stdDeviation="3" result="blur"/>
                                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                    </filter>
                                </defs>
                            </>
                        )}

                        {isBroken && (
                            <>
                                {/* X mark in the middle */}
                                <line x1="90" y1="10" x2="110" y2="30" className="stroke-red-500" strokeWidth="3" strokeLinecap="round"/>
                                <line x1="110" y1="10" x2="90" y2="30" className="stroke-red-500" strokeWidth="3" strokeLinecap="round"/>
                            </>
                        )}

                        {!isOk && !isBroken && (
                            <>
                                {/* Slow warning dots */}
                                <circle r="4" className="fill-yellow-400" opacity="0.7">
                                    <animate attributeName="cx" from="0" to="200" dur="4s" repeatCount="indefinite"/>
                                    <animate attributeName="opacity" values="0;0.7;0.7;0" dur="4s" repeatCount="indefinite"/>
                                </circle>
                            </>
                        )}
                    </svg>
                    {/* Label under line */}
                    <p className={`text-center text-[10px] mt-0.5 ${glowColor}`}>
                        {isOk ? 'replicating' : isBroken ? 'BROKEN' : 'degraded'}
                    </p>
                </div>

                {/* Genesis DB (replica) */}
                <div className="flex flex-col items-center gap-2 w-28">
                    <div className={`relative rounded-xl p-3 ${isDarkMode ? 'bg-slate-700/70' : 'bg-gray-100'}`}>
                        <CircleStackIcon className={`w-10 h-10 ${genesisDbOk ? 'text-cyan-500' : 'text-red-500 animate-pulse'}`}/>
                        <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${genesisDbOk ? 'bg-emerald-400' : 'bg-red-500 animate-ping'}`}/>
                    </div>
                    <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Genesis</span>
                    <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>replica</span>
                </div>
            </div>

            {/* Status detail */}
            {replication?.message && (
                <div className={`flex items-center justify-center gap-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <StatusDot status={statusColor(replication.status)}/>
                    <span>{replication.message}</span>
                </div>
            )}
            {!replication?.message && (
                <p className={`text-center text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No replication data available</p>
            )}
        </div>
    );
}

function ServerResources({title, res, db, isDarkMode, muted, card, heading, iconCl, subtitle}: {
    title: string;
    res?: {status?: string; message?: string};
    db?: {status?: string; message?: string};
    isDarkMode: boolean; muted: string; card: string; heading: string; iconCl: string;
    subtitle?: string;
}) {
    const msg = res?.message;
    const parts = msg?.split(' | ') ?? [];

    return (
        <div className={card}>
            <h2 className={heading}><CpuChipIcon className={iconCl}/>{title} Infrastructure{subtitle && <span className={`text-xs font-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} ml-1`}>({subtitle})</span>}</h2>
            <div className="space-y-4">
                {parts.length > 0 && (
                    <div className="grid grid-cols-1 gap-3">
                        {parts.map((part, i) => {
                            const label = metricLabel(part);
                            const val = metricValue(part);
                            const pct = parsePct(part);
                            const MetricIcon = label === 'Disk' ? CircleStackIcon : label === 'CPU Load' ? CpuChipIcon : ChartBarIcon;
                            return (
                                <div key={i} className={`rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-sm font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                            <MetricIcon className="w-4 h-4 text-cyan-500"/>{label}
                                        </span>
                                        <span className={`text-sm font-bold ${metricColor(part)}`}>{val}</span>
                                    </div>
                                    {pct !== null && <ProgressBar pct={pct} isDarkMode={isDarkMode}/>}
                                </div>
                            );
                        })}
                    </div>
                )}

                {db?.message && (
                    <div className={`flex items-center gap-2.5 rounded-lg px-4 py-2.5 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                        <CircleStackIcon className="w-5 h-5 text-cyan-500 flex-shrink-0"/>
                        <StatusDot status={statusColor(db.status)}/>
                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{db.message}</span>
                    </div>
                )}

                {!msg && !db?.message && (
                    <p className={`text-sm ${muted}`}>No data available</p>
                )}
            </div>
        </div>
    );
}

// --- Helpers ---

function metricLabel(part: string): string {
    if (part.includes('disk')) return 'Disk';
    if (part.includes('load')) return 'CPU Load';
    if (part.includes('memory')) return 'Memory';
    return part.split('=')[0] || part;
}

function metricValue(part: string): string {
    const pctMatch = part.match(/(\d+)%/);
    if (pctMatch) return `${pctMatch[1]}%`;
    const loadMatch = part.match(/load5m=([\d.]+)\s*cpus=(\d+)/);
    if (loadMatch) return `${loadMatch[1]} / ${loadMatch[2]} cores`;
    return part;
}

function parsePct(part: string): number | null {
    const pctMatch = part.match(/(\d+)%/);
    if (pctMatch) return parseInt(pctMatch[1]);
    return null;
}

function metricColor(part: string): string {
    const pctMatch = part.match(/(\d+)%/);
    if (pctMatch) {
        const pct = parseInt(pctMatch[1]);
        if (pct > 90) return 'text-red-500';
        if (pct > 80) return 'text-yellow-500';
        return 'text-emerald-500';
    }
    return 'text-emerald-500';
}

function MiniStat({label, value, isDarkMode}: {label: string; value: string; isDarkMode: boolean}) {
    return (
        <div className={`rounded-lg px-3 py-2 text-center ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
            <p className={`text-lg font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{value}</p>
        </div>
    );
}

