import {useEffect, useState, useCallback} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import LiveStream from './LiveStream';
import SignalInspector from './SignalInspector';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {useToast} from '../../context/Toast';
import {fetchNeoStatus, fetchNeoIncidents, fetchNeoSweeps, pauseNeo, resumeNeo} from '../../api/client';
import type {NeoStatus, NeoIncident, NeoSweep} from '../../context/Types';
import {
    EyeIcon, PauseCircleIcon, PlayCircleIcon, CogIcon,
    ExclamationTriangleIcon, CheckCircleIcon, SignalIcon,
    ClockIcon, ArrowTopRightOnSquareIcon, ServerStackIcon,
    BoltIcon, LinkIcon,
} from '@heroicons/react/24/outline';

const GITLAB_BASE = 'http://gitlab.aspendenver.local';
const NEO_CONFIG_URL = `${GITLAB_BASE}/dmorgan/swizzley-agent-neo/-/edit/master/config.json`;
const NEO_ISSUES_URL = `${GITLAB_BASE}/dashboard/work_items?sort=created_date&state=opened&author_username=agent-neo`;

const SEV_COLORS: Record<string, {bg: string; text: string; darkBg: string; darkText: string}> = {
    P0: {bg: 'bg-red-100', text: 'text-red-800', darkBg: 'bg-red-900/40', darkText: 'text-red-300'},
    P1: {bg: 'bg-orange-100', text: 'text-orange-800', darkBg: 'bg-orange-900/40', darkText: 'text-orange-300'},
    P2: {bg: 'bg-yellow-100', text: 'text-yellow-800', darkBg: 'bg-yellow-900/40', darkText: 'text-yellow-300'},
    P3: {bg: 'bg-blue-100', text: 'text-blue-800', darkBg: 'bg-blue-900/40', darkText: 'text-blue-300'},
    P4: {bg: 'bg-gray-100', text: 'text-gray-600', darkBg: 'bg-slate-700/40', darkText: 'text-gray-400'},
    P5: {bg: 'bg-gray-100', text: 'text-gray-600', darkBg: 'bg-slate-700/40', darkText: 'text-gray-400'},
    P6: {bg: 'bg-gray-100', text: 'text-gray-600', darkBg: 'bg-slate-700/40', darkText: 'text-gray-400'},
};

const STATUS_COLORS: Record<string, {bg: string; text: string; darkBg: string; darkText: string}> = {
    new: {bg: 'bg-cyan-100', text: 'text-cyan-700', darkBg: 'bg-cyan-900/30', darkText: 'text-cyan-400'},
    triaged: {bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'bg-blue-900/30', darkText: 'text-blue-400'},
    in_progress: {bg: 'bg-violet-100', text: 'text-violet-700', darkBg: 'bg-violet-900/30', darkText: 'text-violet-400'},
    fix_submitted: {bg: 'bg-amber-100', text: 'text-amber-700', darkBg: 'bg-amber-900/30', darkText: 'text-amber-400'},
    closed: {bg: 'bg-gray-100', text: 'text-gray-600', darkBg: 'bg-slate-700/30', darkText: 'text-gray-500'},
    verified: {bg: 'bg-green-100', text: 'text-green-700', darkBg: 'bg-green-900/30', darkText: 'text-green-400'},
};

export default function Neo() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const {toast} = useToast();

    const [status, setStatus] = useState<NeoStatus | null>(null);
    const [incidents, setIncidents] = useState<NeoIncident[]>([]);
    const [sweeps, setSweeps] = useState<NeoSweep[]>([]);
    const [incidentFilter, setIncidentFilter] = useState<'all' | 'open' | 'closed'>('open');
    const [loading, setLoading] = useState(true);
    const [statusDown, setStatusDown] = useState(false);
    const [activeTab, setActiveTab] = useState<'status' | 'live' | 'inspector'>('status');
    const [inspectorCorrelation, setInspectorCorrelation] = useState('');

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`;
    const heading = `text-lg font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const iconCl = 'w-5 h-5 text-cyan-500';

    const loadData = useCallback(async () => {
        if (!apiAvailable) return;
        const [s, i, sw] = await Promise.all([
            fetchNeoStatus(),
            fetchNeoIncidents(50, incidentFilter === 'all' ? undefined : incidentFilter),
            fetchNeoSweeps(20),
        ]);
        setStatus(s);
        setStatusDown(s === null);
        setIncidents(i ?? []);
        setSweeps(sw ?? []);
        setLoading(false);
    }, [apiAvailable, incidentFilter]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 15_000);
        return () => clearInterval(interval);
    }, [loadData]);

    const handlePauseResume = async () => {
        try {
            if (status?.paused) {
                await resumeNeo();
                toast('Neo resumed', 'success');
            } else {
                await pauseNeo();
                toast('Neo paused', 'success');
            }
            loadData();
        } catch (e: any) {
            toast(e?.message || 'Failed', 'error');
        }
    };

    const ago = (ts: string) => {
        if (!ts) return '—';
        const d = Date.now() - new Date(ts).getTime();
        if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
        if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
        if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
        return `${Math.floor(d / 86_400_000)}d ago`;
    };

    // Determine overall state
    const neoState = statusDown ? 'down' : status?.paused ? 'paused' : 'active';
    const stateColor = neoState === 'active' ? 'bg-emerald-500' : neoState === 'paused' ? 'bg-amber-500' : 'bg-red-500';
    const autonomyLabel = status?.autonomy_name ? `Level ${status.autonomy_level} (${status.autonomy_name})` : '';
    const stateLabel = neoState === 'active' ? autonomyLabel || 'Active' : neoState === 'paused' ? 'Paused' : 'Down';

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

                    {/* Status HUD */}
                    <div className={card}>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full ${stateColor} animate-pulse`}/>
                                <span className={`text-xl font-bold font-mono ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Neo Agent
                                </span>
                                <span className={`text-sm px-2 py-0.5 rounded font-medium ${
                                    neoState === 'active' ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700') :
                                    neoState === 'paused' ? (isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700') :
                                    (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700')
                                }`}>{stateLabel}</span>
                            </div>

                            {status && (
                                <div className={`flex flex-wrap gap-4 text-sm font-mono ${muted}`}>
                                    <span title="Uptime"><ClockIcon className="w-4 h-4 inline mr-1"/>{status.uptime}</span>
                                    <span title="Sweeps">Sweeps: {status.sweep_count}</span>
                                    <span title="Last sweep">Last: {ago(status.last_sweep)}</span>
                                    <span title="Observers">Observers: {status.observers_up}/{status.observers_total}</span>
                                    <span title="Open incidents">Open: {incidentFilter === 'open' ? incidents.length : status.incidents_open}</span>
                                    {status.tier3_enabled && <span className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}>T3: Claude</span>}
                                </div>
                            )}

                            <div className="ml-auto flex gap-2">
                                <button onClick={handlePauseResume}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        status?.paused
                                            ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200')
                                            : (isDarkMode ? 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50' : 'bg-amber-100 text-amber-700 hover:bg-amber-200')
                                    }`}>
                                    {status?.paused
                                        ? <><PlayCircleIcon className="w-4 h-4"/>Resume</>
                                        : <><PauseCircleIcon className="w-4 h-4"/>Pause</>
                                    }
                                </button>
                                <a href={NEO_CONFIG_URL} target="_blank" rel="noopener noreferrer"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}>
                                    <CogIcon className="w-4 h-4"/>Config
                                    <ArrowTopRightOnSquareIcon className="w-3 h-3"/>
                                </a>
                                <a href={NEO_ISSUES_URL} target="_blank" rel="noopener noreferrer"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}>
                                    <EyeIcon className="w-4 h-4"/>GitLab Issues
                                    <ArrowTopRightOnSquareIcon className="w-3 h-3"/>
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Tab bar */}
                    <div className={`flex border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                        {([
                            {key: 'status', label: 'Status', icon: <ServerStackIcon className="w-4 h-4"/>},
                            {key: 'live', label: 'Live', icon: <BoltIcon className="w-4 h-4"/>},
                            {key: 'inspector', label: 'Inspector', icon: <LinkIcon className="w-4 h-4"/>},
                        ] as const).map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.key
                                        ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                                        : `border-transparent ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
                                }`}>
                                {tab.icon}{tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Live tab */}
                    {activeTab === 'live' && (
                        <LiveStream onSelectCorrelation={(id) => {
                            setInspectorCorrelation(id);
                            setActiveTab('inspector');
                        }}/>
                    )}

                    {/* Inspector tab */}
                    {activeTab === 'inspector' && (
                        <SignalInspector initialCorrelationId={inspectorCorrelation}/>
                    )}

                    {/* Status tab — existing content */}
                    {activeTab === 'status' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Incidents — 2 cols */}
                        <div className={`lg:col-span-2 ${card}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className={heading}>
                                    <ExclamationTriangleIcon className={iconCl}/>
                                    Incidents
                                    <span className={`text-sm font-normal font-mono ${muted}`}>({incidents.length})</span>
                                </h2>
                                <div className="flex gap-1">
                                    {(['open', 'closed', 'all'] as const).map(f => (
                                        <button key={f} onClick={() => setIncidentFilter(f)}
                                            className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                                                incidentFilter === f
                                                    ? (isDarkMode ? 'bg-cyan-900/40 text-cyan-300' : 'bg-cyan-100 text-cyan-700')
                                                    : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')
                                            }`}>{f}</button>
                                    ))}
                                </div>
                            </div>
                            {loading ? (
                                <div className={`text-sm ${muted}`}>Loading...</div>
                            ) : incidents.length === 0 ? (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
                                    <CheckCircleIcon className="w-5 h-5 text-emerald-500"/>
                                    <span className={`text-sm ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>No incidents.</span>
                                </div>
                            ) : (
                                <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                                    {incidents.map(inc => {
                                        const sev = SEV_COLORS[inc.severity] ?? SEV_COLORS.P6;
                                        const st = STATUS_COLORS[inc.status] ?? STATUS_COLORS.new;
                                        return (
                                            <div key={inc.id} className={`flex flex-wrap items-start gap-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-slate-700/40 hover:bg-slate-700/60' : 'bg-gray-50 hover:bg-gray-100'} transition-colors`}>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isDarkMode ? sev.darkBg + ' ' + sev.darkText : sev.bg + ' ' + sev.text}`}>
                                                    {inc.severity}
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDarkMode ? st.darkBg + ' ' + st.darkText : st.bg + ' ' + st.text}`}>
                                                    {inc.status}
                                                </span>
                                                <span className={`text-xs font-mono font-medium ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>{inc.service}</span>
                                                <span className={`text-xs flex-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {inc.root_cause.length > 120 ? inc.root_cause.slice(0, 120) + '...' : inc.root_cause}
                                                </span>
                                                <span className={`text-[10px] font-mono ${muted}`}>{ago(inc.created_at)}</span>
                                                {inc.gitlab_url && (
                                                    <a href={inc.gitlab_url} target="_blank" rel="noopener noreferrer"
                                                        className={`text-[10px] flex items-center gap-0.5 ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}>
                                                        #{inc.gitlab_issue_iid}
                                                        <ArrowTopRightOnSquareIcon className="w-3 h-3"/>
                                                    </a>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right sidebar */}
                        <div className="space-y-6">
                            {/* Service Health */}
                            <div className={card}>
                                <h2 className={`${heading} mb-3`}>
                                    <ServerStackIcon className={iconCl}/>Services
                                </h2>
                                {status?.services?.length ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {status.services.map(svc => (
                                            <div key={svc.name} className={`flex items-center gap-2 px-2 py-1.5 rounded ${isDarkMode ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
                                                <div className={`w-2 h-2 rounded-full ${svc.healthy ? 'bg-emerald-500' : 'bg-red-500'}`}/>
                                                <span className={`text-xs font-mono truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{svc.name}</span>
                                                {svc.signals > 0 && (
                                                    <span className={`ml-auto text-[10px] font-mono ${muted}`}>{svc.signals}s</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={`text-sm ${muted}`}>{statusDown ? 'Neo is down' : 'No services'}</div>
                                )}
                            </div>

                            {/* Sweep History */}
                            <div className={card}>
                                <h2 className={`${heading} mb-3`}>
                                    <SignalIcon className={iconCl}/>Recent Sweeps
                                </h2>
                                {sweeps.length === 0 ? (
                                    <div className={`text-sm ${muted}`}>No sweep data yet</div>
                                ) : (
                                    <div className="space-y-1">
                                        {sweeps.slice(0, 10).map(sw => (
                                            <div key={sw.id} className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
                                                <span className={muted}>{ago(sw.created_at)}</span>
                                                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{sw.signals_collected}sig</span>
                                                <span className={sw.incidents_found > 0 ? (isDarkMode ? 'text-amber-400' : 'text-amber-600') : muted}>
                                                    {sw.incidents_found}inc
                                                </span>
                                                <span className={`ml-auto ${muted}`}>{sw.duration_ms}ms</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>}
                </div>
            </div>
            <Foot/>
        </>
    );
}
