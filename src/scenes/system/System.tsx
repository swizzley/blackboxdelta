import React, {useEffect, useState} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {connectMonitorStatus} from '../../api/sse';
import {getFingerprintSync} from '../../api/fingerprint';
import type {MonitorStatus, MonitorServiceInfo, MonitorAlertEvent, MonitorPairFreshness, MonitorCoverageEntry} from '../../context/Types';
import {
    ServerStackIcon, CircleStackIcon, SignalIcon, CpuChipIcon,
    ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon,
    ClockIcon, BoltIcon, ArrowPathIcon, ChartBarIcon,
    GlobeAltIcon, NewspaperIcon,
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
    const [drawerService, setDrawerService] = useState<{host: string; name: string} | null>(null);
    const [drawerOutput, setDrawerOutput] = useState<string>('');
    const [drawerLoading, setDrawerLoading] = useState(false);
    const [expandedTable, setExpandedTable] = useState<string | null>(null);

    useEffect(() => {
        if (!apiAvailable) {
            setMonitorConnected(false);
            setMonitor(null);
            return;
        }

        let cleanup: (() => void) | null = null;
        let mounted = true;

        const fp = getFingerprintSync();
        const fpParam = fp ? `?fp=${encodeURIComponent(fp)}` : '';
        fetch(`${apiBase}/api/monitor/status${fpParam}`, {signal: AbortSignal.timeout(5000)})
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

    useEffect(() => {
        if (!drawerService) return;
        setDrawerLoading(true);
        setDrawerOutput('');
        const fp2 = getFingerprintSync();
        const fpSuffix = fp2 ? `&fp=${encodeURIComponent(fp2)}` : '';
        fetch(`${apiBase}/api/monitor/service-status?host=${drawerService.host}&name=${drawerService.name}${fpSuffix}`, {signal: AbortSignal.timeout(10000)})
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setDrawerOutput(data.output ?? ''); })
            .catch(() => setDrawerOutput('Failed to load service status.'))
            .finally(() => setDrawerLoading(false));
    }, [drawerService, apiBase]);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`;
    const heading = `text-lg font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const iconCl = 'w-5 h-5 text-cyan-500';

    const allServices = monitor
        ? [...(monitor.services?.cipher || []), ...(monitor.services?.genesis || []), ...(monitor.services?.match || []), ...(monitor.services?.sage || [])]
        : [];
    const countedServices = allServices.filter(s => s.type !== 'cli');
    const activeCount = countedServices.filter(s => s.status === 'active').length;
    const alertCount = monitor?.alerts_firing?.length ?? 0;
    const criticalAlerts = monitor?.alerts_firing?.filter((a: MonitorAlertEvent) => a.status === 'critical') ?? [];
    const criticalCount = criticalAlerts.length;

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
                            <p className={`text-lg ${muted}`}>Monitor unavailable — check your connection</p>
                        </div>
                    ) : (
                        <>
                            {/* Overview KPIs */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <KPICard label="Monitor" value={monitorConnected ? 'UP' : 'DOWN'} color={monitorConnected ? 'ok' : 'critical'}
                                         icon={<SignalIcon className="w-6 h-6"/>} isDarkMode={isDarkMode}/>
                                <KPICard label="Market" value={monitor?.market_open ? 'OPEN' : 'CLOSED'} color={monitor?.market_open ? 'ok' : 'unknown'}
                                         icon={<ChartBarIcon className="w-6 h-6"/>} isDarkMode={isDarkMode}/>
                                <KPICard label="Services" value={`${activeCount}/${countedServices.length}`} color={activeCount === countedServices.length ? 'ok' : 'critical'}
                                         icon={<ServerStackIcon className="w-6 h-6"/>} isDarkMode={isDarkMode}/>
                                <KPICard label="Alerts" value={String(alertCount)} color={alertCount === 0 ? 'ok' : criticalCount > 0 ? 'critical' : 'warn'}
                                         icon={<ExclamationTriangleIcon className="w-6 h-6"/>} isDarkMode={isDarkMode}/>
                            </div>

                            {/* Firing Alerts */}
                            {criticalCount > 0 && (
                                <div className={`${isDarkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'} border rounded-lg shadow p-5 mb-6`}>
                                    <h2 className={`text-lg font-semibold mb-3 flex items-center gap-2 text-red-500`}>
                                        <ExclamationTriangleIcon className="w-5 h-5"/>Critical Alerts
                                    </h2>
                                    <div className="space-y-2">
                                        {criticalAlerts.map((a: MonitorAlertEvent) => (
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
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
                                    <ServerServices title="Cipher" host="cipher" services={monitor.services?.cipher || []} isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl} onServiceClick={(host, name) => setDrawerService({host, name})}/>
                                    <ServerServices title="Genesis" host="genesis" services={monitor.services?.genesis || []} isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl} subtitle="replica" onServiceClick={(host, name) => setDrawerService({host, name})}/>
                                    <ServerServices title="Match" host="match" services={monitor.services?.match || []} isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl} subtitle="replica" onServiceClick={(host, name) => setDrawerService({host, name})}/>
                                    <ServerServices title="Sage" host="sage" services={monitor.services?.sage || []} isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl} onServiceClick={(host, name) => setDrawerService({host, name})}/>
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
                                                <div key={table}>
                                                    <div
                                                        onClick={() => setExpandedTable(expandedTable === table ? null : table)}
                                                        className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer ${isDarkMode ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-gray-50 hover:bg-gray-100'} ${expandedTable === table ? 'rounded-b-none' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-2.5 flex-shrink-0">
                                                            <StatusDot status={statusColor(d.status)}/>
                                                            <span className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{table}</span>
                                                        </div>
                                                        <span className={`text-xs ${muted} text-right truncate ml-3`}>{d.message || '—'}</span>
                                                    </div>
                                                    {expandedTable === table && (
                                                        <div className={`px-3 py-2 rounded-b-lg text-xs font-mono ${isDarkMode ? 'bg-slate-800 text-gray-400' : 'bg-gray-100 text-gray-600'} border-t ${isDarkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                                                            {d.last_ts ? (
                                                                <span>Last record: {new Date(d.last_ts).toUTCString()}</span>
                                                            ) : (
                                                                <span>{d.message || 'No data'}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {Object.keys(monitor.data_freshness || {}).length === 0 && (
                                                <p className={`text-sm ${muted}`}>Market closed — data checks paused</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* OANDA + Massive */}
                                    <div className={card}>
                                        <h2 className={heading}><GlobeAltIcon className={iconCl}/>Broker &amp; Data Feed</h2>
                                        <div className="space-y-2">
                                            {/* OANDA row */}
                                            <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                                {monitor.oanda?.connected ? (
                                                    <CheckCircleIcon className="w-6 h-6 text-emerald-500 flex-shrink-0"/>
                                                ) : (
                                                    <XCircleIcon className="w-6 h-6 text-red-500 flex-shrink-0"/>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>OANDA</p>
                                                    <p className={`text-xs ${muted}`}>{monitor.oanda?.connected ? 'Connected' : 'Disconnected'}</p>
                                                </div>
                                            </div>
                                            {/* Massive row */}
                                            <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                                {(() => {
                                                    const st = monitor.oanda?.massive_lag_status;
                                                    const color = st === 'ok' ? 'text-emerald-500' : st === 'warn' ? 'text-yellow-400' : 'text-red-500';
                                                    const Icon = (st === 'ok' || st === 'warn') ? CheckCircleIcon : XCircleIcon;
                                                    return <Icon className={`w-6 h-6 flex-shrink-0 ${color}`}/>;
                                                })()}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Massive</p>
                                                    <p className={`text-xs ${muted}`}>collection-engine data feed</p>
                                                </div>
                                                {monitor.oanda?.massive_lag_s !== undefined && monitor.oanda.massive_lag_s >= 0 && (() => {
                                                    const lag = monitor.oanda.massive_lag_s;
                                                    const st = monitor.oanda.massive_lag_status;
                                                    const cls = st === 'ok'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                                        : st === 'warn'
                                                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                                                            : 'bg-red-500/20 text-red-400 border-red-500/40';
                                                    return (
                                                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${cls}`}>
                                                            {lag}s
                                                        </span>
                                                    );
                                                })()}
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

                            {/* Pair Freshness */}
                            {monitor && (monitor.pair_freshness?.length ?? 0) > 0 && (
                                <PairFreshnessGrid pairs={monitor.pair_freshness} isDarkMode={isDarkMode} card={card} heading={heading} iconCl={iconCl}/>
                            )}

                            {/* Signal Data Coverage */}
                            {monitor && (monitor.coverage?.length ?? 0) > 0 && (
                                <CoverageTable entries={monitor.coverage} isDarkMode={isDarkMode} card={card} heading={heading} iconCl={iconCl}/>
                            )}

                            {/* Replication Visualization */}
                            {monitor && (
                                <ReplicationViz replication={monitor.replication} database={monitor.database} isDarkMode={isDarkMode} card={card} heading={heading} iconCl={iconCl}/>
                            )}

                            {/* Infrastructure */}
                            {monitor && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
                                    <ServerResources title="Cipher" res={monitor.resources?.cipher} db={monitor.database?.cipher}
                                                     isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl}/>
                                    <ServerResources title="Genesis" res={monitor.resources?.genesis} db={monitor.database?.genesis}
                                                     isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl} subtitle="replica"/>
                                    <ServerResources title="Match" res={monitor.resources?.match} db={monitor.database?.match}
                                                     isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl} subtitle="replica"/>
                                    <ServerResources title="Sage" res={monitor.resources?.sage}
                                                     isDarkMode={isDarkMode} muted={muted} card={card} heading={heading} iconCl={iconCl}/>
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
            <ServiceDrawer
                service={drawerService}
                output={drawerOutput}
                loading={drawerLoading}
                onClose={() => setDrawerService(null)}
                isDarkMode={isDarkMode}
            />
        </>
    );
}

function PairFreshnessGrid({pairs, isDarkMode, card, heading, iconCl}: {
    pairs: MonitorPairFreshness[];
    isDarkMode: boolean; card: string; heading: string; iconCl: string;
}) {
    const [open, setOpen] = useState(false);
    const enabledCount = pairs.filter(p => p.enabled).length;
    const okCount = pairs.filter(p => p.status === 'ok').length;
    const enabledPairs = pairs.filter(p => p.enabled && p.age_secs >= 0);
    const avgDelay = enabledPairs.length > 0
        ? Math.round(enabledPairs.reduce((sum, p) => sum + p.age_secs, 0) / enabledPairs.length)
        : 0;
    const delayLabel = avgDelay >= 3600 ? `${(avgDelay / 3600).toFixed(1)}h` : avgDelay >= 60 ? `${Math.round(avgDelay / 60)}m` : `${avgDelay}s`;
    const delayColor = avgDelay > 300 ? 'text-red-400 bg-red-900/30' : avgDelay > 120 ? 'text-yellow-400 bg-yellow-900/30' : 'text-emerald-400 bg-emerald-900/30';

    return (
        <div className={`${card} mb-6`}>
            <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setOpen(!open)}>
                <GlobeAltIcon className={iconCl}/>Markets ({okCount}/{enabledCount} fresh)
                {avgDelay > 0 && <span className={`ml-2 text-xs font-mono px-1.5 py-0.5 rounded ${delayColor}`}>avg {delayLabel}</span>}
                <span className="ml-2 text-xs opacity-50">{open ? '▼' : '▶'}</span>
            </h2>
            {!open ? null : <div className="flex flex-wrap gap-2">
                {pairs.map(p => {
                    const bg = p.status === 'ok'
                        ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                        : p.status === 'warn'
                            ? (isDarkMode ? 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40' : 'bg-yellow-50 text-yellow-700 border-yellow-200')
                            : p.status === 'critical'
                                ? (isDarkMode ? 'bg-red-900/30 text-red-400 border-red-700/40' : 'bg-red-50 text-red-700 border-red-200')
                                : (isDarkMode ? 'bg-slate-700/50 text-gray-500 border-slate-600' : 'bg-gray-100 text-gray-400 border-gray-200');
                    const dot = p.status === 'ok' ? 'bg-emerald-400'
                        : p.status === 'warn' ? 'bg-yellow-400'
                            : p.status === 'critical' ? 'bg-red-500'
                                : 'bg-gray-400';
                    const ageLabel = p.status === 'disabled' ? '' : p.age_secs < 0 ? 'no data' : `${p.age_secs}s`;
                    return (
                        <span key={p.symbol} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${bg}`}
                              title={ageLabel ? `${p.symbol}: ${ageLabel}` : p.symbol}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`}/>
                            {p.symbol.replace('_', '/')}
                            {ageLabel && <span className="opacity-60">{ageLabel}</span>}
                        </span>
                    );
                })}
            </div>}
        </div>
    );
}

function CoverageTable({entries, isDarkMode, card, heading, iconCl}: {
    entries: MonitorCoverageEntry[];
    isDarkMode: boolean; card: string; heading: string; iconCl: string;
}) {
    const [open, setOpen] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const expectedYears: Record<string, number> = {scalp: 3, intraday: 5, swing: 17};

    const pctColor = (pct: number) =>
        pct >= 99 ? 'text-emerald-500' : pct >= 95 ? 'text-yellow-500' : 'text-red-500';
    const pctBg = (pct: number) =>
        pct >= 99
            ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50/60')
            : pct >= 95
                ? (isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50/60')
                : (isDarkMode ? 'bg-red-900/20' : 'bg-red-50/60');

    return (
        <div className={`${card} mb-6`}>
            <h2 className={`${heading} cursor-pointer select-none`} onClick={() => setOpen(!open)}>
                <ChartBarIcon className={iconCl}/>Signal Data Coverage
                <span className="ml-2 text-xs opacity-50">{open ? '▼' : '▶'}</span>
            </h2>
            {!open ? null : <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className={`text-left ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <th className="pb-2 pl-3 font-medium">Timeframe</th>
                            <th className="pb-2 font-medium">Expected</th>
                            <th className="pb-2 font-medium">Range</th>
                            <th className="pb-2 font-medium text-right">Days</th>
                            <th className="pb-2 font-medium text-right">Pairs</th>
                            <th className="pb-2 pr-3 font-medium text-right">Coverage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(e => (
                            <React.Fragment key={e.timeframe}>
                                <tr className={`${pctBg(e.coverage_pct)} cursor-pointer`}
                                    onClick={() => setExpanded(expanded === e.timeframe ? null : e.timeframe)}>
                                    <td className={`py-2 pl-3 font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                        <span className="mr-1.5">{expanded === e.timeframe ? '▾' : '▸'}</span>
                                        {e.timeframe}
                                    </td>
                                    <td className={`py-2 font-mono text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {expectedYears[e.timeframe] ?? '?'}y
                                    </td>
                                    <td className={`py-2 font-mono text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                        {e.data_start} — {e.data_end}
                                    </td>
                                    <td className={`py-2 text-right font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                        {e.total_days.toLocaleString()}/{e.expected_days.toLocaleString()}
                                    </td>
                                    <td className={`py-2 text-right font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{e.pair_count}</td>
                                    <td className={`py-2 pr-3 text-right font-bold font-mono ${pctColor(e.coverage_pct)}`}>
                                        {e.coverage_pct.toFixed(1)}%
                                    </td>
                                </tr>
                                {expanded === e.timeframe && e.pairs?.length > 0 && (
                                    <tr>
                                        <td colSpan={6} className={`px-3 pb-3 ${isDarkMode ? 'bg-slate-800/50' : 'bg-gray-50/80'}`}>
                                            <div className="flex flex-wrap gap-1.5 pt-2">
                                                {e.pairs.map(p => {
                                                    const bg = p.coverage_pct >= 99
                                                        ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                                                        : p.coverage_pct >= 95
                                                            ? (isDarkMode ? 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40' : 'bg-yellow-50 text-yellow-700 border-yellow-200')
                                                            : (isDarkMode ? 'bg-red-900/30 text-red-400 border-red-700/40' : 'bg-red-50 text-red-700 border-red-200');
                                                    return (
                                                        <span key={p.symbol} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono border ${bg}`}
                                                              title={`${p.symbol}: ${p.rows.toLocaleString()}/${p.expected.toLocaleString()} days (${p.coverage_pct.toFixed(1)}%)`}>
                                                            {p.symbol} <span className="opacity-70">{p.coverage_pct.toFixed(1)}%</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>}
        </div>
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

function ServerServices({title, host, services, isDarkMode, muted, card, heading, iconCl, subtitle, onServiceClick}: {
    title: string; host: string; services: MonitorServiceInfo[]; isDarkMode: boolean; muted: string; card: string; heading: string; iconCl: string; subtitle?: string;
    onServiceClick: (host: string, name: string) => void;
}) {
    return (
        <div className={card}>
            <h2 className={heading}><ServerStackIcon className={iconCl}/>{title} Services{subtitle && <span className={`text-xs font-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} ml-1`}>({subtitle})</span>}</h2>
            {services.length === 0 ? (
                <p className={`text-sm ${muted}`}>No services reported</p>
            ) : (
                <div className="space-y-2">
                    {services.map(s => (
                        <div key={s.name} onClick={() => onServiceClick(host, s.name)} className={`flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer ${isDarkMode ? 'bg-slate-700/50 hover:ring-1 hover:ring-cyan-500/40' : 'bg-gray-50 hover:ring-1 hover:ring-cyan-500/40'}`}>
                            <div className="flex items-center gap-2.5">
                                {s.status === 'active' ? (
                                    <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0"/>
                                ) : s.type === 'cli' ? (
                                    <XCircleIcon className="w-5 h-5 text-gray-400 flex-shrink-0"/>
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
    replication?: Record<string, {status?: string; message?: string; io_running?: boolean; sql_running?: boolean; seconds_behind_source?: number}>;
    database?: Record<string, {status?: string}>;
    isDarkMode: boolean; card: string; heading: string; iconCl: string;
}) {
    const replicas = Object.entries(replication || {});
    const cipherDbOk = database?.cipher?.status === 'ok';

    return (
        <div className={`${card} mb-6`}>
            <h2 className={heading}><ArrowPathIcon className={iconCl}/>Database Replication</h2>
            <div className="flex flex-col gap-6 py-4">
                {replicas.map(([label, rep]) => {
                    const isOk = rep?.status === 'ok';
                    const isBroken = rep?.status === 'critical';
                    const lineColor = isOk ? 'stroke-emerald-500' : isBroken ? 'stroke-red-500' : 'stroke-yellow-500';
                    const dotColor = isOk ? 'fill-emerald-400' : isBroken ? 'fill-red-500' : 'fill-yellow-400';
                    const glowColor = isOk ? 'text-emerald-500' : isBroken ? 'text-red-500' : 'text-yellow-500';
                    const replicaDbOk = database?.[label]?.status === 'ok' || rep?.status === 'ok';
                    const filterId = `glow-${label}`;

                    return (
                        <div key={label}>
                            <div className="flex items-center justify-center gap-0">
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
                                        <line x1="0" y1="20" x2="200" y2="20" className={`${lineColor} ${isBroken ? 'opacity-30' : 'opacity-40'}`} strokeWidth="2" strokeDasharray={isBroken ? '4 4' : 'none'}/>

                                        {isOk && (
                                            <>
                                                <line x1="0" y1="20" x2="200" y2="20" className={lineColor} strokeWidth="2" opacity="0.7"/>
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
                                                <circle r="6" className={dotColor} opacity="0.3" filter={`url(#${filterId})`}>
                                                    <animate attributeName="cx" from="0" to="200" dur="2s" repeatCount="indefinite"/>
                                                    <animate attributeName="opacity" values="0;0.3;0.3;0" dur="2s" repeatCount="indefinite"/>
                                                </circle>
                                                <defs>
                                                    <filter id={filterId}>
                                                        <feGaussianBlur stdDeviation="3" result="blur"/>
                                                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                                    </filter>
                                                </defs>
                                            </>
                                        )}

                                        {isBroken && (
                                            <>
                                                <line x1="90" y1="10" x2="110" y2="30" className="stroke-red-500" strokeWidth="3" strokeLinecap="round"/>
                                                <line x1="110" y1="10" x2="90" y2="30" className="stroke-red-500" strokeWidth="3" strokeLinecap="round"/>
                                            </>
                                        )}

                                        {!isOk && !isBroken && (
                                            <circle r="4" className="fill-yellow-400" opacity="0.7">
                                                <animate attributeName="cx" from="0" to="200" dur="4s" repeatCount="indefinite"/>
                                                <animate attributeName="opacity" values="0;0.7;0.7;0" dur="4s" repeatCount="indefinite"/>
                                            </circle>
                                        )}
                                    </svg>
                                    <p className={`text-center text-[10px] mt-0.5 ${glowColor}`}>
                                        {isOk ? 'replicating' : isBroken ? 'BROKEN' : 'degraded'}
                                    </p>
                                </div>

                                {/* Replica DB */}
                                <div className="flex flex-col items-center gap-2 w-28">
                                    <div className={`relative rounded-xl p-3 ${isDarkMode ? 'bg-slate-700/70' : 'bg-gray-100'}`}>
                                        <CircleStackIcon className={`w-10 h-10 ${replicaDbOk ? 'text-cyan-500' : 'text-red-500 animate-pulse'}`}/>
                                        <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${replicaDbOk ? 'bg-emerald-400' : 'bg-red-500 animate-ping'}`}/>
                                    </div>
                                    <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
                                    <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>replica</span>
                                </div>
                            </div>

                            {/* Status detail */}
                            {rep?.message && (
                                <div className={`flex items-center justify-center gap-2 text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <StatusDot status={statusColor(rep.status)}/>
                                    <span>{rep.message}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
                {replicas.length === 0 && (
                    <p className={`text-center text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No replication data available</p>
                )}
            </div>
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
            <h2 className={heading}><CpuChipIcon className={iconCl}/>{title}{subtitle && <span className={`text-xs font-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} ml-1`}>({subtitle})</span>}</h2>
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

function ServiceDrawer({service, output, loading, onClose}: {
    service: {host: string; name: string} | null;
    output: string;
    loading: boolean;
    onClose: () => void;
    isDarkMode: boolean;
}) {
    useEffect(() => {
        if (!service) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [service, onClose]);

    if (!service) return null;
    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose}/>
            <div className="fixed inset-y-0 right-0 w-full max-w-2xl z-50 flex flex-col bg-black border-l border-cyan-900/50 shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-900/40 bg-gray-950">
                    <div>
                        <span className="text-cyan-400 font-mono text-sm font-bold">{service.name}</span>
                        <span className="text-cyan-700 font-mono text-xs ml-2">@ {service.host}</span>
                    </div>
                    <button onClick={onClose} className="text-cyan-600 hover:text-cyan-300 text-xl font-bold leading-none">&times;</button>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-black">
                    {loading ? (
                        <p className="text-cyan-500 font-mono text-sm animate-pulse">Loading...</p>
                    ) : (
                        <pre className="text-cyan-400 text-xs font-mono whitespace-pre-wrap leading-relaxed">{output || 'No output'}</pre>
                    )}
                </div>
            </div>
        </>
    );
}

