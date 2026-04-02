import React, {useEffect, useState, useMemo} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {fetchHealthStatus} from '../../api/client';
import type {HealthStatus, ServiceHealth, DataFreshness, OandaStatus} from '../../context/Types';
import {
    ServerStackIcon, SignalIcon, CpuChipIcon,
    ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon,
    ClockIcon, BoltIcon, ChevronDownIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const POLL_INTERVAL = 30_000;

interface TaggedService extends ServiceHealth {
    host: string;
}

export default function System() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [lastPoll, setLastPoll] = useState<Date | null>(null);
    const [infraOpen, setInfraOpen] = useState(false);

    useEffect(() => {
        if (!apiAvailable) return;

        let mounted = true;
        const poll = () => {
            fetchHealthStatus().then(data => {
                if (mounted && data) {
                    setHealth(data);
                    setLastPoll(new Date());
                }
            });
        };

        poll();
        const id = setInterval(poll, POLL_INTERVAL);
        return () => { mounted = false; clearInterval(id); };
    }, [apiAvailable]);

    // Flatten all services with host tag, group by role
    const groups = useMemo(() => {
        if (!health?.hosts) return null;
        const all: TaggedService[] = [];
        for (const [host, hs] of Object.entries(health.hosts)) {
            for (const svc of hs.services) {
                all.push({...svc, host});
            }
        }
        const map: Record<string, TaggedService[]> = {};
        for (const s of all) {
            if (!map[s.role]) map[s.role] = [];
            map[s.role].push(s);
        }
        return map;
    }, [health]);

    const isLive = lastPoll && (Date.now() - lastPoll.getTime()) < 60_000;

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`;
    const heading = `text-lg font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const iconCl = 'w-5 h-5 text-cyan-500';

    const summary = health?.summary;
    const tradingServices = groups?.trading || [];
    const optimizerServices = groups?.optimizer || [];
    const llmServices = groups?.llm || [];
    const infraServices = groups?.infra || [];
    const discoveredServices = groups?.discovered || [];
    const optimizerActive = optimizerServices.filter(s => s.active).length;
    const allServices = groups ? Object.values(groups).flat() : [];
    const criticalDown = allServices.filter(s => !s.active && !s.optional);
    const optionalDown = allServices.filter(s => !s.active && s.optional);

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    <div className="flex items-center gap-3 mb-6">
                        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Health</h1>
                        {isLive && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-900/30 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"/>LIVE
                            </span>
                        )}
                    </div>

                    {!health ? (
                        <div className={`${card} text-center py-16`}>
                            <SignalIcon className="w-12 h-12 mx-auto text-gray-400 mb-4"/>
                            <p className={`text-lg ${muted}`}>{apiAvailable ? 'Loading health data...' : 'API unavailable'}</p>
                        </div>
                    ) : (
                        <>
                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <KPICard
                                    label="Services"
                                    value={`${summary?.active ?? 0}/${summary?.total ?? 0}`}
                                    color={summary && summary.active === summary.total ? 'ok' : summary && summary.inactive > 3 ? 'critical' : 'warn'}
                                    icon={<ServerStackIcon className="w-6 h-6"/>}
                                    isDarkMode={isDarkMode}
                                />
                                <KPICard
                                    label="Trading"
                                    value={`${tradingServices.filter(s => s.active).length}/${tradingServices.length}`}
                                    color={tradingServices.every(s => s.active) ? 'ok' : 'critical'}
                                    icon={<BoltIcon className="w-6 h-6"/>}
                                    isDarkMode={isDarkMode}
                                />
                                <KPICard
                                    label="Optimizers"
                                    value={`${optimizerActive}/${optimizerServices.length}`}
                                    color={optimizerActive === optimizerServices.length ? 'ok' : optimizerActive === 0 ? 'critical' : 'warn'}
                                    icon={<CpuChipIcon className="w-6 h-6"/>}
                                    isDarkMode={isDarkMode}
                                />
                                <KPICard
                                    label="Down"
                                    value={String(criticalDown.length)}
                                    color={criticalDown.length === 0 ? 'ok' : criticalDown.length > 3 ? 'critical' : 'warn'}
                                    icon={<ExclamationTriangleIcon className="w-6 h-6"/>}
                                    isDarkMode={isDarkMode}
                                />
                            </div>

                            {/* Critical services down banner */}
                            {criticalDown.length > 0 && (
                                <div className={`${isDarkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'} border rounded-lg shadow p-5 mb-6`}>
                                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-red-500">
                                        <ExclamationTriangleIcon className="w-5 h-5"/>{criticalDown.length} Service{criticalDown.length > 1 ? 's' : ''} Down
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        {criticalDown.map(s => (
                                            <span key={`${s.host}-${s.name}`}
                                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${isDarkMode ? 'bg-red-900/30 text-red-400 border-red-700/40' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"/>
                                                {s.name}
                                                <span className="opacity-50">@{s.host}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Optional services down — subtle note */}
                            {optionalDown.length > 0 && criticalDown.length === 0 && (
                                <div className={`${isDarkMode ? 'bg-yellow-900/10 border-yellow-800/30' : 'bg-yellow-50/50 border-yellow-200'} border rounded-lg shadow px-5 py-3 mb-6`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm ${muted}`}>
                                            {optionalDown.map(s => `${s.name}@${s.host}`).join(', ')} — optional, not critical
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Data Pipeline & Broker */}
                            <DataPipelineCard
                                freshness={health.data_freshness}
                                oanda={health.oanda}
                                isDarkMode={isDarkMode}
                                card={card}
                                heading={heading}
                                muted={muted}
                                iconCl={iconCl}
                            />

                            {/* Trading Pipeline */}
                            <ServiceGroupCard
                                title="Trading Pipeline"
                                icon={<BoltIcon className={iconCl}/>}
                                services={tradingServices}
                                isDarkMode={isDarkMode}
                                card={card}
                                heading={heading}
                                muted={muted}
                            />

                            {/* Optimizer Pool */}
                            <OptimizerPoolCard
                                services={optimizerServices}
                                isDarkMode={isDarkMode}
                                card={card}
                                heading={heading}
                                muted={muted}
                                iconCl={iconCl}
                            />

                            {/* LLM & AI */}
                            <ServiceGroupCard
                                title="LLM & AI"
                                icon={<CpuChipIcon className={iconCl}/>}
                                services={llmServices}
                                isDarkMode={isDarkMode}
                                card={card}
                                heading={heading}
                                muted={muted}
                            />

                            {/* Infrastructure (collapsible) */}
                            {infraServices.length > 0 && (
                                <div className={`${card} mb-6`}>
                                    <h2
                                        className={`${heading} cursor-pointer select-none`}
                                        onClick={() => setInfraOpen(!infraOpen)}
                                    >
                                        <ServerStackIcon className={iconCl}/>
                                        Infrastructure
                                        <span className={`text-xs font-normal ml-1 ${muted}`}>
                                            ({infraServices.filter(s => s.active).length}/{infraServices.length})
                                        </span>
                                        {infraOpen
                                            ? <ChevronDownIcon className="w-4 h-4 ml-auto opacity-50"/>
                                            : <ChevronRightIcon className="w-4 h-4 ml-auto opacity-50"/>
                                        }
                                    </h2>
                                    {infraOpen && (
                                        <InfraGrid services={infraServices} isDarkMode={isDarkMode}/>
                                    )}
                                </div>
                            )}

                            {/* Discovered (auto-detected from Prometheus, not in canonical map) */}
                            {discoveredServices.length > 0 && (
                                <ServiceGroupCard
                                    title="Discovered"
                                    icon={<SignalIcon className={iconCl}/>}
                                    services={discoveredServices}
                                    isDarkMode={isDarkMode}
                                    card={card}
                                    heading={heading}
                                    muted={muted}
                                />
                            )}

                            {/* Footer timestamp */}
                            {health.timestamp && (
                                <p className={`text-center text-xs ${muted} flex items-center justify-center gap-1.5`}>
                                    <ClockIcon className="w-3.5 h-3.5"/>
                                    Last check: {dayjs(health.timestamp).fromNow()}
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

type StatusColor = 'ok' | 'warn' | 'critical' | 'unknown';

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


function ServiceGroupCard({title, icon, services, isDarkMode, card, heading, muted}: {
    title: string; icon: React.ReactNode; services: TaggedService[];
    isDarkMode: boolean; card: string; heading: string; muted: string;
}) {
    if (services.length === 0) return null;
    const activeCount = services.filter(s => s.active).length;

    return (
        <div className={`${card} mb-6`}>
            <h2 className={heading}>
                {icon}{title}
                <span className={`text-xs font-normal ml-1 ${muted}`}>({activeCount}/{services.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {services.map(s => (
                    <ServiceRow key={`${s.host}-${s.name}`} service={s} isDarkMode={isDarkMode} muted={muted}/>
                ))}
            </div>
        </div>
    );
}

function ServiceRow({service, isDarkMode, muted}: {service: TaggedService; isDarkMode: boolean; muted: string}) {
    return (
        <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2.5">
                {service.active
                    ? <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0"/>
                    : <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0"/>
                }
                <span className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{service.name}</span>
            </div>
            <span className={`text-xs ${muted}`}>{service.host}</span>
        </div>
    );
}

function OptimizerPoolCard({services, isDarkMode, card, heading, muted, iconCl}: {
    services: TaggedService[];
    isDarkMode: boolean; card: string; heading: string; muted: string; iconCl: string;
}) {
    if (services.length === 0) return null;
    const activeCount = services.filter(s => s.active).length;
    const sorted = [...services].sort((a, b) => a.host.localeCompare(b.host));

    return (
        <div className={`${card} mb-6`}>
            <h2 className={heading}>
                <CpuChipIcon className={iconCl}/>Optimizer Pool
                <span className={`text-xs font-normal ml-1 ${muted}`}>({activeCount}/{services.length})</span>
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {sorted.map(s => {
                    const borderColor = s.active ? 'border-emerald-500/30' : 'border-red-500/30';
                    return (
                        <div key={s.host}
                             className={`${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'} rounded-lg border ${borderColor} p-3 text-center`}>
                            <div className="flex items-center justify-center gap-2 mb-1">
                                {s.active
                                    ? <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"/>
                                    : <span className="w-2.5 h-2.5 rounded-full bg-red-500"/>
                                }
                                <span className={`font-semibold text-sm capitalize ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{s.host}</span>
                            </div>
                            <p className={`text-xs ${muted}`}>{s.active ? 'running' : 'down'}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function InfraGrid({services, isDarkMode}: {services: TaggedService[]; isDarkMode: boolean}) {
    // Group infra services by name for compact display
    const byName: Record<string, TaggedService[]> = {};
    for (const s of services) {
        if (!byName[s.name]) byName[s.name] = [];
        byName[s.name].push(s);
    }

    return (
        <div className="space-y-3">
            {Object.entries(byName).sort(([a], [b]) => a.localeCompare(b)).map(([name, svcs]) => {
                const activeCount = svcs.filter(s => s.active).length;
                const allActive = activeCount === svcs.length;
                return (
                    <div key={name} className={`rounded-lg px-4 py-2.5 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                {allActive
                                    ? <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0"/>
                                    : <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0"/>
                                }
                                <span className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-mono ${allActive ? 'text-emerald-500' : 'text-yellow-500'}`}>
                                    {activeCount}/{svcs.length}
                                </span>
                                <div className="flex gap-1">
                                    {svcs.sort((a, b) => a.host.localeCompare(b.host)).map(s => (
                                        <span key={s.host}
                                              title={`${s.host}: ${s.active ? 'active' : 'inactive'}`}
                                              className={`w-2 h-2 rounded-full ${s.active ? 'bg-emerald-400' : 'bg-red-500'}`}/>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function fmtAge(secs: number): string {
    if (secs < 0) return '—';
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return `${Math.floor(secs / 86400)}d`;
}

function statusColor(status: string, isDarkMode: boolean): string {
    if (status === 'ok') return 'text-emerald-500';
    if (status === 'warn') return 'text-yellow-500';
    if (status === 'critical') return 'text-red-500';
    return isDarkMode ? 'text-gray-500' : 'text-gray-400';
}

function statusDot(status: string): string {
    if (status === 'ok') return 'bg-emerald-400';
    if (status === 'warn') return 'bg-yellow-400';
    if (status === 'critical') return 'bg-red-500';
    return 'bg-gray-400';
}

function DataPipelineCard({freshness, oanda, isDarkMode, card, heading, muted, iconCl}: {
    freshness?: DataFreshness[]; oanda?: OandaStatus;
    isDarkMode: boolean; card: string; heading: string; muted: string; iconCl: string;
}) {
    if (!freshness && !oanda) return null;

    // Group freshness by kind (prices vs signals)
    const prices = freshness?.filter(f => f.label.startsWith('prices')) ?? [];
    const signals = freshness?.filter(f => f.label.startsWith('signals')) ?? [];
    const worstData = freshness?.reduce((worst, f) =>
        f.status === 'critical' ? 'critical' : f.status === 'warn' && worst !== 'critical' ? 'warn' : worst
    , 'ok' as string) ?? 'ok';

    const rowCl = `flex items-center justify-between rounded px-3 py-2 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`;
    const labelCl = `text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`;

    return (
        <div className={`${card} mb-6`}>
            <h2 className={heading}>
                <SignalIcon className={iconCl}/>Data Pipeline
                <span className={`w-2 h-2 rounded-full ml-2 ${statusDot(worstData)}`}/>
                {oanda && (
                    <span className={`ml-auto text-xs font-normal ${muted}`}>
                        OANDA: <span className={statusColor(oanda.status, isDarkMode)}>
                            {oanda.connected ? `${oanda.pairs} pairs` : 'disconnected'}
                            {oanda.age_secs !== undefined && oanda.connected ? ` (${fmtAge(oanda.age_secs)})` : ''}
                        </span>
                    </span>
                )}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Prices */}
                <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${muted}`}>Candle Data</p>
                    <div className="space-y-1">
                        {prices.map(f => (
                            <div key={f.table} className={rowCl}>
                                <div className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(f.status)}`}/>
                                    <span className={labelCl}>{f.label.replace('prices ', '')}</span>
                                </div>
                                <span className={`text-xs font-mono ${statusColor(f.status, isDarkMode)}`}>
                                    {f.status === 'no_data' ? 'no data' : fmtAge(f.age_secs)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Signals */}
                <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${muted}`}>Signal Data</p>
                    <div className="space-y-1">
                        {signals.map(f => (
                            <div key={f.table} className={rowCl}>
                                <div className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(f.status)}`}/>
                                    <span className={labelCl}>{f.label.replace('signals ', '')}</span>
                                </div>
                                <span className={`text-xs font-mono ${statusColor(f.status, isDarkMode)}`}>
                                    {f.status === 'no_data' ? 'no data' : fmtAge(f.age_secs)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
