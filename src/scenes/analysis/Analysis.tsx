import {useEffect, useState} from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {AnalysisData, AnalysisTodo} from '../../context/Types';

dayjs.extend(relativeTime);

interface RunDetail {
    generated: string;
    run_id: string;
    provider: string;
    model: string;
    data_range: [string, string];
    order_count: number;
    phases: { phase: number; name: string; content: string }[];
    todos: AnalysisTodo[];
    synthesis: string;
}

const PROVIDERS = ['anthropic', 'ollama'] as const;
type Provider = typeof PROVIDERS[number];

const priorityLabels: Record<number, { label: string; color: string; bg: string }> = {
    1: {label: 'P1 Critical', color: 'text-red-400', bg: 'bg-red-500/20'},
    2: {label: 'P2 High', color: 'text-orange-400', bg: 'bg-orange-500/20'},
    3: {label: 'P3 Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/20'},
    4: {label: 'P4 Info Gap', color: 'text-blue-400', bg: 'bg-blue-500/20'},
    5: {label: 'P5 Nice to Have', color: 'text-gray-400', bg: 'bg-gray-500/20'},
};

const statusColors: Record<string, { text: string; bg: string; label: string }> = {
    open: {text: 'text-yellow-300', bg: 'bg-yellow-500/20', label: 'Open'},
    in_progress: {text: 'text-blue-300', bg: 'bg-blue-500/20', label: 'In Progress'},
    implemented: {text: 'text-emerald-300', bg: 'bg-emerald-500/20', label: 'Implemented'},
    wont_fix: {text: 'text-gray-400', bg: 'bg-gray-500/20', label: "Won't Fix"},
    obsolete: {text: 'text-gray-500', bg: 'bg-gray-500/20', label: 'Obsolete'},
};

const categoryLabels: Record<string, string> = {
    scoring_weights: 'Scoring Weights',
    scoring_thresholds: 'Scoring Thresholds',
    scoring_logic: 'Scoring Logic',
    risk_guardrails: 'Risk Guardrails',
    settings: 'Settings',
    indicator_tuning: 'Indicator Tuning',
    position_sizing: 'Position Sizing',
    pips_table: 'Pips Table',
    information_gap: 'Info Gap',
    code_quality: 'Code Quality',
    forex_insight: 'Forex Insight',
};

export default function Analysis() {
    const {isDarkMode} = useTheme();
    const [providerData, setProviderData] = useState<Record<Provider, AnalysisData | null>>({anthropic: null, ollama: null});
    const [activeProvider, setActiveProvider] = useState<Provider>('anthropic');
    const [loading, setLoading] = useState(true);
    const [expandedTodo, setExpandedTodo] = useState<number | null>(null);
    const [filterPriority, setFilterPriority] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    useEffect(() => {
        setLoading(true);
        let loaded = 0;
        const results: Record<Provider, AnalysisData | null> = {anthropic: null, ollama: null};

        PROVIDERS.forEach(p => {
            axios.get(`/data/analysis/${p}.json`)
                .then(r => { results[p] = r.data; })
                .catch(() => { /* provider may not have data yet */ })
                .finally(() => {
                    loaded++;
                    if (loaded === PROVIDERS.length) {
                        setProviderData(results);
                        // Default to whichever provider has data (prefer anthropic)
                        if (!results.anthropic && results.ollama) {
                            setActiveProvider('ollama');
                        }
                        setLoading(false);
                    }
                });
        });
    }, []);

    const fetchRunDetail = (run: { run_id: string; created_at: string }, provider: Provider) => {
        // run_id format: YYYYMMDD-HHMMSS — extract date components directly
        const yyyy = run.run_id.substring(0, 4);
        const mm = run.run_id.substring(4, 6);
        const dd = run.run_id.substring(6, 8);

        setLoadingDetail(true);
        setExpandedTodo(null);
        axios.get(`/data/analysis/${provider}/${yyyy}/${mm}/${dd}.json`)
            .then(r => setRunDetail(r.data))
            .catch(() => {
                // Historical file not available for this run
                setRunDetail(null);
            })
            .finally(() => setLoadingDetail(false));
    };

    const data = providerData[activeProvider];

    if (loading) {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
                <Nav/>
                <main className="-mt-24 pb-12">
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 pt-8">
                        <p className={`text-center py-20 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Loading analysis data...
                        </p>
                    </div>
                </main>
                <Foot/>
            </div>
        );
    }

    const anyData = providerData.anthropic || providerData.ollama;
    if (!anyData) {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
                <Nav/>
                <main className="-mt-24 pb-12">
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 pt-8">
                        <p className={`text-center py-20 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            No analysis runs yet. Run <code className="font-mono text-cyan-400">swizzley-analyzer</code> to generate your first report.
                        </p>
                    </div>
                </main>
                <Foot/>
            </div>
        );
    }

    const latestRun = data?.runs?.[0];
    const viewingHistorical = runDetail !== null;
    const todos = viewingHistorical ? (runDetail.todos || []) : (data?.todos || []);

    // Compute stats from whichever todos list is active
    const totalOpen = todos.filter(t => t.status === 'open').length;
    const totalInProgress = todos.filter(t => t.status === 'in_progress').length;
    const totalImplemented = todos.filter(t => t.status === 'implemented').length;
    const totalP1 = todos.filter(t => t.priority === 1).length;

    // Apply filters
    const filteredTodos = todos.filter(t => {
        if (filterPriority !== null && t.priority !== filterPriority) return false;
        if (filterStatus !== null && t.status !== filterStatus) return false;
        return true;
    });

    // Group by priority
    const groupedByPriority = filteredTodos.reduce<Record<number, AnalysisTodo[]>>((acc, t) => {
        if (!acc[t.priority]) acc[t.priority] = [];
        acc[t.priority].push(t);
        return acc;
    }, {});

    const cardClass = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`;
    const textMuted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
            <Nav/>
            <main className="-mt-24 pb-16">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 pt-8">

                    {/* Header */}
                    <div className="mb-6">
                        <h1 className={`text-2xl font-bold ${textPrimary}`}>AI Trade Analysis</h1>
                        {viewingHistorical ? (
                            <p className={`mt-1 text-sm ${textMuted}`}>
                                <span className="text-cyan-400 font-medium">Viewing run {runDetail.run_id}</span> &middot; {runDetail.provider} / {runDetail.model} &middot; {runDetail.order_count} orders &middot; {runDetail.todos?.length || 0} recommendations
                            </p>
                        ) : latestRun ? (
                            <p className={`mt-1 text-sm ${textMuted}`}>
                                Last run: {dayjs(latestRun.created_at).fromNow()} ({latestRun.model}) &middot; {latestRun.order_count} orders analyzed &middot; {latestRun.todo_count} recommendations
                            </p>
                        ) : null}
                    </div>

                    {/* Provider Tab Bar */}
                    <div className="flex gap-1 mb-6">
                        {PROVIDERS.map(p => {
                            const hasData = !!providerData[p];
                            const isActive = activeProvider === p;
                            return (
                                <button
                                    key={p}
                                    onClick={() => {
                                        setActiveProvider(p);
                                        setRunDetail(null);
                                        setExpandedTodo(null);
                                    }}
                                    disabled={!hasData}
                                    className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors
                                        ${isActive
                                            ? `${isDarkMode ? 'bg-slate-800 text-cyan-400' : 'bg-white text-cyan-600'} border-b-2 border-cyan-400`
                                            : hasData
                                                ? `${isDarkMode ? 'bg-slate-700/50 text-gray-400 hover:text-gray-200' : 'bg-gray-200 text-gray-600 hover:text-gray-800'}`
                                                : `${isDarkMode ? 'bg-slate-800/30 text-gray-600' : 'bg-gray-100 text-gray-400'} cursor-not-allowed`
                                        }`}
                                >
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                    {!hasData && <span className="ml-1 text-xs">(no data)</span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Run Detail View */}
                    {runDetail && (
                        <div className={`${cardClass} mb-6`}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className={`text-lg font-semibold ${textPrimary}`}>
                                    Run Detail: {runDetail.run_id}
                                </h2>
                                <button
                                    onClick={() => { setRunDetail(null); setExpandedTodo(null); }}
                                    className={`px-3 py-1 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                    Back to Latest
                                </button>
                            </div>
                            <div className={`text-sm ${textMuted} mb-4`}>
                                <span>{runDetail.provider} / {runDetail.model}</span>
                                <span className="mx-2">&middot;</span>
                                <span>{runDetail.order_count} orders</span>
                                <span className="mx-2">&middot;</span>
                                <span>{runDetail.data_range[0]} to {runDetail.data_range[1]}</span>
                            </div>

                            {/* Synthesis */}
                            {runDetail.synthesis && (
                                <div className="mb-4">
                                    <h3 className={`text-sm font-semibold mb-2 ${textMuted}`}>Executive Summary</h3>
                                    <div className={`text-sm ${textPrimary} whitespace-pre-wrap`}>{runDetail.synthesis}</div>
                                </div>
                            )}

                            {/* Phases */}
                            {runDetail.phases?.map(phase => (
                                <details key={phase.phase} className={`mb-2 border rounded ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                    <summary className={`px-3 py-2 cursor-pointer text-sm font-medium ${textPrimary} ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}>
                                        Phase {phase.phase}: {phase.name}
                                    </summary>
                                    <div className={`px-3 py-2 text-sm ${textPrimary} whitespace-pre-wrap border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                        {phase.content}
                                    </div>
                                </details>
                            ))}
                        </div>
                    )}

                    {loadingDetail && (
                        <div className={`${cardClass} mb-6 text-center`}>
                            <p className={textMuted}>Loading run detail...</p>
                        </div>
                    )}

                    {!data || !latestRun ? (
                        <p className={`text-center py-12 ${textMuted}`}>
                            No analysis data for {activeProvider}. Run <code className="font-mono text-cyan-400">swizzley-analyzer --provider {activeProvider}</code> to generate.
                        </p>
                    ) : (
                        <>
                            {/* Stat Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className={cardClass}>
                                    <p className={`text-sm font-medium ${textMuted}`}>Open</p>
                                    <p className="mt-1 text-2xl font-semibold text-yellow-400">{totalOpen}</p>
                                </div>
                                <div className={cardClass}>
                                    <p className={`text-sm font-medium ${textMuted}`}>In Progress</p>
                                    <p className="mt-1 text-2xl font-semibold text-blue-400">{totalInProgress}</p>
                                </div>
                                <div className={cardClass}>
                                    <p className={`text-sm font-medium ${textMuted}`}>Implemented</p>
                                    <p className="mt-1 text-2xl font-semibold text-emerald-400">{totalImplemented}</p>
                                </div>
                                <div className={cardClass}>
                                    <p className={`text-sm font-medium ${textMuted}`}>Critical (P1)</p>
                                    <p className="mt-1 text-2xl font-semibold text-red-400">{totalP1}</p>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className={`${cardClass} mb-6`}>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className={`text-sm font-medium ${textMuted} mr-2`}>Filter:</span>

                                    {/* Priority filters */}
                                    {[1, 2, 3, 4, 5].map(p => {
                                        const pl = priorityLabels[p];
                                        const active = filterPriority === p;
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setFilterPriority(active ? null : p)}
                                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                                                    ${active ? `${pl.bg} ${pl.color} ring-1 ring-current` : `${isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-600'} hover:opacity-80`}`}
                                            >
                                                {pl.label}
                                            </button>
                                        );
                                    })}

                                    <span className={`${textMuted} mx-1`}>|</span>

                                    {/* Status filters */}
                                    {['open', 'in_progress', 'implemented', 'wont_fix'].map(s => {
                                        const sc = statusColors[s];
                                        const active = filterStatus === s;
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => setFilterStatus(active ? null : s)}
                                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                                                    ${active ? `${sc.bg} ${sc.text} ring-1 ring-current` : `${isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-600'} hover:opacity-80`}`}
                                            >
                                                {sc.label}
                                            </button>
                                        );
                                    })}

                                    {(filterPriority !== null || filterStatus !== null) && (
                                        <button
                                            onClick={() => {
                                                setFilterPriority(null);
                                                setFilterStatus(null);
                                            }}
                                            className="px-3 py-1 rounded-full text-xs font-medium text-gray-400 hover:text-white"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* TODO List grouped by priority */}
                            {Object.keys(groupedByPriority).sort((a, b) => Number(a) - Number(b)).map(pStr => {
                                const p = Number(pStr);
                                const items = groupedByPriority[p];
                                const pl = priorityLabels[p] || {label: `P${p}`, color: 'text-gray-400', bg: 'bg-gray-500/20'};

                                return (
                                    <div key={p} className="mb-6">
                                        <h2 className={`text-lg font-semibold mb-3 ${pl.color}`}>
                                            {pl.label}
                                            <span className={`ml-2 text-sm font-normal ${textMuted}`}>({items.length})</span>
                                        </h2>

                                        <div className="space-y-2">
                                            {items.map(todo => {
                                                const sc = statusColors[todo.status] || statusColors.open;
                                                const isExpanded = expandedTodo === todo.id;

                                                return (
                                                    <div key={todo.id}
                                                         className={`${cardClass} cursor-pointer hover:ring-1 hover:ring-cyan-500/30 transition-all`}
                                                         onClick={() => setExpandedTodo(isExpanded ? null : todo.id)}
                                                    >
                                                        {/* Header row */}
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text}`}>
                                                                        {sc.label}
                                                                    </span>
                                                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${isDarkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                                                        {categoryLabels[todo.category] || todo.category}
                                                                    </span>
                                                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                                                        {todo.complexity}
                                                                    </span>
                                                                </div>
                                                                <p className={`mt-1.5 font-medium ${textPrimary}`}>{todo.title}</p>
                                                                {!isExpanded && (
                                                                    <p className={`mt-0.5 text-sm ${textMuted} truncate`}>
                                                                        {todo.expected_impact}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <svg className={`w-5 h-5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''} ${textMuted}`}
                                                                 fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
                                                            </svg>
                                                        </div>

                                                        {/* Expanded detail */}
                                                        {isExpanded && (
                                                            <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                                                <div className="space-y-3 text-sm">
                                                                    <div>
                                                                        <p className={`font-medium ${textMuted}`}>Description</p>
                                                                        <p className={textPrimary}>{todo.description}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className={`font-medium ${textMuted}`}>Expected Impact</p>
                                                                        <p className="text-emerald-400">{todo.expected_impact}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className={`font-medium ${textMuted}`}>Evidence</p>
                                                                        <p className={textPrimary}>{todo.evidence}</p>
                                                                    </div>
                                                                    {todo.affected_files.length > 0 && (
                                                                        <div>
                                                                            <p className={`font-medium ${textMuted}`}>Affected Files</p>
                                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                                {todo.affected_files.map((f, i) => (
                                                                                    <code key={i}
                                                                                          className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-700 text-cyan-300' : 'bg-gray-100 text-cyan-700'}`}>
                                                                                        {f}
                                                                                    </code>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {todo.status === 'implemented' && (
                                                                        <div className={`p-3 rounded ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                                                                            <p className="font-medium text-emerald-400">Implemented</p>
                                                                            {todo.implemented_at && (
                                                                                <p className={`text-xs ${textMuted}`}>
                                                                                    {dayjs(todo.implemented_at).format('MMM D, YYYY h:mm A')}
                                                                                    {todo.implemented_by && ` by ${todo.implemented_by}`}
                                                                                </p>
                                                                            )}
                                                                            {todo.implemented_sha && (
                                                                                <code className="text-xs text-cyan-400 mt-1 block">{todo.implemented_sha}</code>
                                                                            )}
                                                                            {todo.notes && (
                                                                                <p className={`text-xs mt-1 ${textMuted}`}>{todo.notes}</p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredTodos.length === 0 && (
                                <p className={`text-center py-12 ${textMuted}`}>
                                    No TODO items match the current filters.
                                </p>
                            )}

                            {/* Run History */}
                            {data.runs.length > 0 && (
                                <div className={`${cardClass} mt-8`}>
                                    <h2 className={`text-lg font-semibold mb-3 ${textPrimary}`}>Run History</h2>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                            <tr className={textMuted}>
                                                <th className="text-left py-2 pr-4">Run ID</th>
                                                <th className="text-left py-2 pr-4">Date</th>
                                                <th className="text-left py-2 pr-4">Provider</th>
                                                <th className="text-left py-2 pr-4">Model</th>
                                                <th className="text-right py-2 pr-4">Orders</th>
                                                <th className="text-right py-2">TODOs</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {data.runs.map((run, i) => (
                                                <tr key={run.run_id}
                                                    onClick={() => fetchRunDetail(run, activeProvider)}
                                                    className={`cursor-pointer ${i === 0 ? 'text-cyan-400' : textPrimary} border-t ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                    <td className="py-2 pr-4 font-mono text-xs">{run.run_id}</td>
                                                    <td className="py-2 pr-4">{dayjs(run.created_at).format('MMM D, YYYY h:mm A')}</td>
                                                    <td className="py-2 pr-4">
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${isDarkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                                            {run.provider || activeProvider}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 pr-4">{run.model.replace('claude-', '').replace(/-\d+$/, '')}</td>
                                                    <td className="py-2 pr-4 text-right">{run.order_count}</td>
                                                    <td className="py-2 text-right">{run.todo_count}</td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                </div>
            </main>
            <Foot/>
        </div>
    );
}
