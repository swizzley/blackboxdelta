import {useEffect, useState, useCallback} from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isoWeek from 'dayjs/plugin/isoWeek';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import type {AnalysisRunApi, AnalysisTodoApi, AnalysisRunDetailApi} from '../../context/Types';
import {fetchAnalysisRuns, fetchAnalysisRunDetail, sendTodoToOptimizer, squashTodos,
    fetchAnalysisModels, triggerAnalysisRun, fetchAnalysisJobs, type OllamaModel, type AnalysisJob} from '../../api/client';

dayjs.extend(relativeTime);
dayjs.extend(isoWeek);

const PROVIDERS = ['anthropic', 'ollama', 'hybrid'] as const;
type Provider = typeof PROVIDERS[number];

const SCOPE_ORDER = ['yearly', 'monthly', 'weekly', 'daily', 'hourly'] as const;
type Scope = typeof SCOPE_ORDER[number];

const scopeColors: Record<string, { text: string; bg: string }> = {
    yearly:  {text: 'text-purple-400', bg: 'bg-purple-500/20'},
    monthly: {text: 'text-indigo-400', bg: 'bg-indigo-500/20'},
    weekly:  {text: 'text-cyan-400',   bg: 'bg-cyan-500/20'},
    daily:   {text: 'text-emerald-400', bg: 'bg-emerald-500/20'},
    hourly:  {text: 'text-gray-400',   bg: 'bg-gray-500/20'},
};

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

// Group runs into a hierarchy: yearly > monthly > weekly > daily > hourly
interface RunGroup {
    key: string;        // e.g. "2026", "2026-03", "2026-W10", "2026-03-07"
    label: string;      // display label
    scope: Scope;       // the scope level of this group
    run?: AnalysisRunApi; // the summary run at this level (if exists)
    children: RunGroup[];
    hourlyRuns: AnalysisRunApi[]; // leaf hourly runs
}

function buildRunTree(runs: AnalysisRunApi[]): RunGroup[] {
    // Separate by scope
    const byScope: Record<string, AnalysisRunApi[]> = {};
    for (const r of runs) {
        const s = r.scope || 'hourly';
        if (!byScope[s]) byScope[s] = [];
        byScope[s].push(r);
    }

    // Build day groups from hourly runs
    const hourlyByDay: Record<string, AnalysisRunApi[]> = {};
    for (const r of (byScope['hourly'] || [])) {
        const day = dayjs(r.created_at).format('YYYY-MM-DD');
        if (!hourlyByDay[day]) hourlyByDay[day] = [];
        hourlyByDay[day].push(r);
    }

    // Build day nodes
    const dayNodes: Record<string, RunGroup> = {};
    // First from daily runs
    for (const r of (byScope['daily'] || [])) {
        const day = r.data_start || dayjs(r.created_at).format('YYYY-MM-DD');
        dayNodes[day] = {
            key: day, label: dayjs(day).format('ddd, MMM D'), scope: 'daily',
            run: r, children: [], hourlyRuns: hourlyByDay[day] || [],
        };
    }
    // Then from hourly runs that don't have a daily summary
    for (const [day, hrs] of Object.entries(hourlyByDay)) {
        if (!dayNodes[day]) {
            dayNodes[day] = {
                key: day, label: dayjs(day).format('ddd, MMM D'), scope: 'daily',
                children: [], hourlyRuns: hrs,
            };
        }
    }

    // Build week groups
    const weekNodes: Record<string, RunGroup> = {};
    for (const r of (byScope['weekly'] || [])) {
        const d = dayjs(r.created_at);
        const wk = d.format('YYYY') + '-W' + String(d.isoWeek()).padStart(2, '0');
        const start = r.data_start ? dayjs(r.data_start).format('MMM D') : '';
        const end = r.data_end ? dayjs(r.data_end).format('MMM D') : '';
        weekNodes[wk] = {
            key: wk, label: `Week ${d.isoWeek()}${start ? ` (${start} - ${end})` : ''}`,
            scope: 'weekly', run: r, children: [], hourlyRuns: [],
        };
    }

    // Assign day nodes to weeks
    for (const [day, node] of Object.entries(dayNodes)) {
        const d = dayjs(day);
        const wk = d.format('YYYY') + '-W' + String(d.isoWeek()).padStart(2, '0');
        if (!weekNodes[wk]) {
            weekNodes[wk] = {
                key: wk, label: `Week ${d.isoWeek()}`,
                scope: 'weekly', children: [], hourlyRuns: [],
            };
        }
        weekNodes[wk].children.push(node);
    }
    // Sort days within each week (newest first)
    for (const wk of Object.values(weekNodes)) {
        wk.children.sort((a, b) => b.key.localeCompare(a.key));
    }

    // Build month groups
    const monthNodes: Record<string, RunGroup> = {};
    for (const r of (byScope['monthly'] || [])) {
        const mo = r.data_start ? r.data_start.slice(0, 7) : dayjs(r.created_at).format('YYYY-MM');
        monthNodes[mo] = {
            key: mo, label: dayjs(mo + '-01').format('MMMM YYYY'),
            scope: 'monthly', run: r, children: [], hourlyRuns: [],
        };
    }

    // Assign weeks to months (use the month of the week's Monday)
    for (const [wk, node] of Object.entries(weekNodes)) {
        // Parse YYYY-Wnn
        const year = parseInt(wk.slice(0, 4));
        const week = parseInt(wk.slice(6));
        const monday = dayjs().year(year).isoWeek(week).startOf('isoWeek');
        const mo = monday.format('YYYY-MM');
        if (!monthNodes[mo]) {
            monthNodes[mo] = {
                key: mo, label: dayjs(mo + '-01').format('MMMM YYYY'),
                scope: 'monthly', children: [], hourlyRuns: [],
            };
        }
        monthNodes[mo].children.push(node);
    }
    for (const mo of Object.values(monthNodes)) {
        mo.children.sort((a, b) => b.key.localeCompare(a.key));
    }

    // Build year groups
    const yearNodes: Record<string, RunGroup> = {};
    for (const r of (byScope['yearly'] || [])) {
        const yr = r.data_start ? r.data_start.slice(0, 4) : dayjs(r.created_at).format('YYYY');
        yearNodes[yr] = {
            key: yr, label: yr, scope: 'yearly',
            run: r, children: [], hourlyRuns: [],
        };
    }
    for (const [mo, node] of Object.entries(monthNodes)) {
        const yr = mo.slice(0, 4);
        if (!yearNodes[yr]) {
            yearNodes[yr] = {
                key: yr, label: yr, scope: 'yearly',
                children: [], hourlyRuns: [],
            };
        }
        yearNodes[yr].children.push(node);
    }
    for (const yr of Object.values(yearNodes)) {
        yr.children.sort((a, b) => b.key.localeCompare(a.key));
    }

    return Object.values(yearNodes).sort((a, b) => b.key.localeCompare(a.key));
}

// Forex market is open Sun 5pm ET – Fri 5pm ET (Mon-Fri UTC, plus Sun evening)
function defaultMarketDay(): string {
    const now = dayjs();
    const day = now.day(); // 0=Sun, 6=Sat
    if (day >= 1 && day <= 5) return now.format('YYYY-MM-DD'); // Mon-Fri: today
    // Sat/Sun: last Friday
    let d = now;
    while (d.day() === 0 || d.day() === 6) d = d.subtract(1, 'day');
    return d.format('YYYY-MM-DD');
}

export default function Analysis() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const [runs, setRuns] = useState<Record<Provider, AnalysisRunApi[]>>({anthropic: [], ollama: [], hybrid: []});
    const [activeProvider, setActiveProvider] = useState<Provider>('anthropic');
    const [loading, setLoading] = useState(true);
    const [runDetail, setRunDetail] = useState<AnalysisRunDetailApi | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [expandedTodo, setExpandedTodo] = useState<number | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [sendingTodo, setSendingTodo] = useState<number | null>(null);
    const [sentTodos, setSentTodos] = useState<Set<number>>(new Set());
    const [selectedForSquash, setSelectedForSquash] = useState<Set<number>>(new Set());
    const [squashing, setSquashing] = useState(false);

    // Ad-hoc run controls
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [runFrom, setRunFrom] = useState(() => defaultMarketDay());
    const [runTo, setRunTo] = useState(() => defaultMarketDay());
    const [runningJob, setRunningJob] = useState<AnalysisJob | null>(null);

    // Load models
    useEffect(() => {
        if (!apiAvailable) return;
        fetchAnalysisModels().then(data => {
            if (data) {
                setModels(data);
                if (!selectedModel && data.length > 0) {
                    // Default to qwen2.5:14b if available, otherwise first
                    const def = data.find(m => m.name === 'qwen2.5:14b');
                    setSelectedModel(def ? def.name : data[0].name);
                }
            }
        });
    }, [apiAvailable]);

    // Check for running jobs on mount
    useEffect(() => {
        if (!apiAvailable) return;
        fetchAnalysisJobs().then(jobs => {
            const running = jobs?.find(j => j.status === 'running');
            if (running) setRunningJob(running);
        });
    }, [apiAvailable]);

    // Poll for job progress + completion
    useEffect(() => {
        if (!runningJob || runningJob.status !== 'running') return;
        const interval = setInterval(() => {
            fetchAnalysisJobs().then(jobs => {
                const j = jobs?.find(j => j.id === runningJob.id);
                if (j) {
                    setRunningJob(j);
                    if (j.status === 'completed') {
                        reloadRuns();
                    }
                }
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [runningJob]);

    const reloadRuns = useCallback(() => {
        const runResults: Record<Provider, AnalysisRunApi[]> = {anthropic: [], ollama: [], hybrid: []};
        let loaded = 0;
        PROVIDERS.forEach(p => {
            fetchAnalysisRuns(p, 100).then(data => {
                runResults[p] = data ?? [];
            }).catch(() => {}).finally(() => {
                loaded++;
                if (loaded === PROVIDERS.length) {
                    setRuns(runResults);
                }
            });
        });
    }, []);

    useEffect(() => {
        if (!apiAvailable) return;
        setLoading(true);
        let loaded = 0;
        const runResults: Record<Provider, AnalysisRunApi[]> = {anthropic: [], ollama: [], hybrid: []};

        PROVIDERS.forEach(p => {
            fetchAnalysisRuns(p, 100).then(data => {
                runResults[p] = data ?? [];
            }).catch(() => {}).finally(() => {
                loaded++;
                if (loaded === PROVIDERS.length) {
                    setRuns(runResults);
                    // Pick the provider with the most recent data
                    const best = PROVIDERS.reduce((a, b) => {
                        const aRuns = runResults[a];
                        const bRuns = runResults[b];
                        if (aRuns.length === 0) return b;
                        if (bRuns.length === 0) return a;
                        return aRuns[0].created_at > bRuns[0].created_at ? a : b;
                    });
                    if (runResults[best].length > 0) {
                        setActiveProvider(best);
                    }
                    // Auto-expand the most recent group and load latest run
                    for (const p of PROVIDERS) {
                        const tree = buildRunTree(runResults[p]);
                        if (tree.length > 0) {
                            const yr = tree[0];
                            const expanded = new Set<string>([yr.key]);
                            if (yr.children.length > 0) {
                                expanded.add(yr.children[0].key);
                                if (yr.children[0].children.length > 0) {
                                    expanded.add(yr.children[0].children[0].key);
                                    if (yr.children[0].children[0].children.length > 0) {
                                        expanded.add(yr.children[0].children[0].children[0].key);
                                    }
                                }
                            }
                            setExpandedGroups(expanded);
                            break;
                        }
                    }
                    // Auto-load the latest run for the active provider
                    const latestRuns = runResults[best];
                    if (latestRuns.length > 0) {
                        loadRunDetail(latestRuns[0].run_id);
                    }
                    setLoading(false);
                }
            });
        });
    }, [apiAvailable]);

    const toggleGroup = useCallback((key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

    const loadRunDetail = useCallback((runId: string) => {
        setLoadingDetail(true);
        setExpandedTodo(null);
        fetchAnalysisRunDetail(runId).then(data => {
            setRunDetail(data ?? null);
        }).finally(() => setLoadingDetail(false));
    }, []);

    const providerRuns = runs[activeProvider];
    const runTree = buildRunTree(providerRuns);
    const todos: AnalysisTodoApi[] = runDetail?.todos || [];

    const cardClass = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`;
    const textMuted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';

    if (!apiAvailable) {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
                <Nav/>
                <main className="-mt-24 pb-12">
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 pt-8">
                        <p className={`text-center py-20 ${textMuted}`}>Analysis requires VPN connection.</p>
                    </div>
                </main>
                <Foot/>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
                <Nav/>
                <main className="-mt-24 pb-12">
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 pt-8">
                        <p className={`text-center py-20 ${textMuted}`}>Loading analysis data...</p>
                    </div>
                </main>
                <Foot/>
            </div>
        );
    }

    // Render a run row (clickable to load detail)
    const renderRunRow = (run: AnalysisRunApi, indent: number) => {
        const sc = scopeColors[run.scope || 'hourly'] || scopeColors.hourly;
        const isActive = runDetail?.run.run_id === run.run_id;
        return (
            <div
                key={run.run_id}
                onClick={() => loadRunDetail(run.run_id)}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded text-sm transition-colors
                    ${isActive
                        ? `${isDarkMode ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'bg-cyan-50 ring-1 ring-cyan-300'}`
                        : `${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`
                    }`}
                style={{paddingLeft: `${indent * 16 + 12}px`}}
            >
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text} flex-shrink-0`}>
                    {(run.scope || 'hourly').charAt(0).toUpperCase() + (run.scope || 'hourly').slice(1)}
                </span>
                <span className={`${isActive ? 'text-cyan-400' : textPrimary} flex-1 min-w-0 truncate`}>
                    {dayjs(run.created_at).format('h:mm A')}
                </span>
                <span className={`text-xs ${textMuted} flex-shrink-0`}>
                    {run.order_count} orders &middot; {run.todo_count} TODOs
                </span>
            </div>
        );
    };

    // Render a group node (collapsible)
    const renderGroup = (group: RunGroup, depth: number): JSX.Element => {
        const isExpanded = expandedGroups.has(group.key);
        const sc = scopeColors[group.scope] || scopeColors.hourly;
        const hasContent = group.children.length > 0 || group.hourlyRuns.length > 0;
        const totalRuns = countRuns(group);

        return (
            <div key={group.key}>
                <div
                    onClick={() => toggleGroup(group.key)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded text-sm transition-colors
                        ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`}
                    style={{paddingLeft: `${depth * 16 + 12}px`}}
                >
                    {hasContent && (
                        <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''} ${textMuted}`}
                             fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                        </svg>
                    )}
                    <span className={`font-medium ${sc.text}`}>{group.label}</span>
                    {group.run && (
                        <span
                            onClick={(e) => { e.stopPropagation(); loadRunDetail(group.run!.run_id); }}
                            className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text} cursor-pointer hover:opacity-80`}
                        >
                            {group.scope} report
                        </span>
                    )}
                    <span className={`text-xs ${textMuted} ml-auto`}>{totalRuns} run{totalRuns !== 1 ? 's' : ''}</span>
                </div>
                {isExpanded && (
                    <div>
                        {group.children.map(child => renderGroup(child, depth + 1))}
                        {group.hourlyRuns.map(run => renderRunRow(run, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // Render a TODO card
    const renderTodoCard = (todo: AnalysisTodoApi) => {
        const sc = statusColors[todo.status] || statusColors.open;
        const isExpanded = expandedTodo === todo.id;

        return (
            <div key={todo.id} className={`${cardClass} transition-all`}>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 cursor-pointer hover:opacity-80"
                     onClick={() => setExpandedTodo(isExpanded ? null : todo.id)}>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text}`}>
                                {sc.label}
                            </span>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${priorityLabels[todo.priority]?.bg || 'bg-gray-500/20'} ${priorityLabels[todo.priority]?.color || 'text-gray-400'}`}>
                                {priorityLabels[todo.priority]?.label || `P${todo.priority}`}
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
                            <p className={`mt-0.5 text-sm ${textMuted} truncate`}>{todo.expected_impact}</p>
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
                                            <code key={i} className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-700 text-cyan-300' : 'bg-gray-100 text-cyan-700'}`}>
                                                {f}
                                            </code>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {todo.mutations && Object.keys(todo.mutations).length > 0 && (
                                <div className={`mt-3 rounded overflow-hidden border ${isDarkMode ? 'border-slate-600' : 'border-gray-300'}`}>
                                    <div className={`px-3 py-1.5 text-xs font-medium flex items-center justify-between ${isDarkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                        <span>Proposed Changes</span>
                                        {!todo.recommendation_status && !sentTodos.has(todo.id) && (
                                            <label className="flex items-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedForSquash.has(todo.id)}
                                                    onChange={() => setSelectedForSquash(prev => {
                                                        const next = new Set(prev);
                                                        next.has(todo.id) ? next.delete(todo.id) : next.add(todo.id);
                                                        return next;
                                                    })}
                                                    className="rounded border-gray-500"
                                                />
                                                <span className="text-xs">Select for squash</span>
                                            </label>
                                        )}
                                    </div>
                                    <div className={`font-mono text-xs ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
                                        {Object.entries(todo.mutations).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => {
                                            const oldVal = todo.current_values?.[key];
                                            return (
                                                <div key={key}>
                                                    {oldVal != null && (
                                                        <div className="flex bg-red-500/10 border-l-2 border-red-500">
                                                            <span className="select-none w-6 text-center text-red-400 py-0.5 flex-shrink-0">-</span>
                                                            <span className="py-0.5 text-red-300">{key} = {oldVal}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex bg-emerald-500/10 border-l-2 border-emerald-500">
                                                        <span className="select-none w-6 text-center text-emerald-400 py-0.5 flex-shrink-0">+</span>
                                                        <span className="py-0.5 text-emerald-300">{key} = {value}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className={`px-3 py-2 flex items-center gap-3 ${isDarkMode ? 'bg-slate-800' : 'bg-gray-50'} border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                        {todo.recommendation_status === 'passed' ? (
                                            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded">Backtest Passed</span>
                                        ) : todo.recommendation_status === 'failed' ? (
                                            <span className="text-xs font-medium text-red-400 bg-red-500/20 px-2 py-1 rounded">Backtest Failed</span>
                                        ) : todo.recommendation_status === 'running' ? (
                                            <span className="text-xs font-medium text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded">Backtest Running...</span>
                                        ) : todo.recommendation_status === 'queued' ? (
                                            <span className="text-xs font-medium text-blue-400 bg-blue-500/20 px-2 py-1 rounded">Queued for Backtest</span>
                                        ) : todo.recommendation_status === 'applied' ? (
                                            <span className="text-xs font-medium text-cyan-400 bg-cyan-500/20 px-2 py-1 rounded">Applied to Trunk</span>
                                        ) : sentTodos.has(todo.id) || todo.recommendation_status === 'pending' ? (
                                            <span className="text-xs text-blue-400">Sent to Optimizer (pending queue)</span>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSendingTodo(todo.id);
                                                    sendTodoToOptimizer(todo.id).then(() => {
                                                        setSentTodos(prev => new Set(prev).add(todo.id));
                                                    }).catch(err => {
                                                        alert(`Failed: ${err.message || err}`);
                                                    }).finally(() => setSendingTodo(null));
                                                }}
                                                disabled={sendingTodo === todo.id}
                                                className="px-3 py-1 rounded text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {sendingTodo === todo.id ? 'Sending...' : 'Queue for Backtest'}
                                            </button>
                                        )}
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
    };

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
            <Nav/>
            <main className={`-mt-24 ${selectedForSquash.size >= 2 ? 'pb-28' : 'pb-16'}`}>
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 pt-8">

                    {/* Header */}
                    <div className="mb-6">
                        <h1 className={`text-2xl font-bold ${textPrimary}`}>AI Trade Analysis</h1>
                        <p className={`mt-1 text-sm ${textMuted}`}>
                            {providerRuns.length} runs &middot; {activeProvider}
                        </p>
                    </div>

                    {/* Provider Tab Bar */}
                    <div className="flex gap-1 mb-6">
                        {PROVIDERS.map(p => {
                            const hasData = runs[p].length > 0;
                            const isActive = activeProvider === p;
                            return (
                                <button
                                    key={p}
                                    onClick={() => {
                                        setActiveProvider(p);
                                        setRunDetail(null);
                                        setExpandedTodo(null);
                                    }}
                                    className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors
                                        ${isActive
                                            ? `${isDarkMode ? 'bg-slate-800 text-cyan-400' : 'bg-white text-cyan-600'} border-b-2 border-cyan-400`
                                            : `${isDarkMode ? 'bg-slate-700/50 text-gray-400 hover:text-gray-200' : 'bg-gray-200 text-gray-600 hover:text-gray-800'}`
                                        }`}
                                >
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                    {hasData && <span className="ml-1 text-xs opacity-60">({runs[p].length})</span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Ad-hoc Run Controls */}
                    <div className={`${cardClass} mb-6`}>
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[200px]">
                                <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Model</label>
                                {activeProvider === 'anthropic' ? (
                                    <select
                                        value={selectedModel}
                                        onChange={e => setSelectedModel(e.target.value)}
                                        className={`w-full px-3 py-1.5 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border`}
                                    >
                                        <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                                        <option value="claude-opus-4-20250514">Claude Opus 4</option>
                                    </select>
                                ) : activeProvider === 'hybrid' ? (
                                    <select
                                        value={selectedModel}
                                        onChange={e => setSelectedModel(e.target.value)}
                                        className={`w-full px-3 py-1.5 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border`}
                                    >
                                        {models.map(m => (
                                            <option key={m.name} value={m.name}>
                                                {m.name} + Claude Sonnet ({m.parameter_size})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <select
                                        value={selectedModel}
                                        onChange={e => setSelectedModel(e.target.value)}
                                        className={`w-full px-3 py-1.5 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border`}
                                    >
                                        {models.map(m => (
                                            <option key={m.name} value={m.name}>
                                                {m.name} ({m.parameter_size}, {m.size_gb.toFixed(1)}GB)
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className={`block text-xs font-medium mb-1 ${textMuted}`}>From</label>
                                <input
                                    type="date"
                                    value={runFrom}
                                    onChange={e => setRunFrom(e.target.value)}
                                    className={`px-3 py-1.5 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border`}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-medium mb-1 ${textMuted}`}>To</label>
                                <input
                                    type="date"
                                    value={runTo}
                                    onChange={e => setRunTo(e.target.value)}
                                    className={`px-3 py-1.5 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border`}
                                />
                            </div>
                            <div>
                                {runningJob?.status === 'running' ? (
                                    <div className="flex flex-col gap-1.5">
                                        <div className="px-4 py-1.5 rounded text-sm font-medium bg-yellow-500/20 text-yellow-400 flex items-center gap-2">
                                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                            </svg>
                                            {runningJob.phase > 0
                                                ? `Phase ${runningJob.phase}/6: ${runningJob.phase_name || '...'}`
                                                : `Starting (${runningJob.model})...`}
                                        </div>
                                        {runningJob.phase > 0 && (
                                            <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-gray-200'}`}>
                                                <div
                                                    className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                                                    style={{width: `${Math.round((runningJob.phase / 6) * 100)}%`}}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            triggerAnalysisRun(selectedModel, runFrom, runTo, activeProvider).then(job => {
                                                if (job) setRunningJob(job);
                                            }).catch(err => alert(`Failed: ${err.message || err}`));
                                        }}
                                        disabled={!selectedModel || !runFrom || !runTo}
                                        className="px-4 py-1.5 rounded text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Run Analysis
                                    </button>
                                )}
                            </div>
                        </div>
                        {runningJob && runningJob.status !== 'running' && (
                            <div className={`mt-2 text-xs ${runningJob.status === 'completed' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {runningJob.status === 'completed'
                                    ? `Completed: ${runningJob.model} (${runningJob.from} to ${runningJob.to})`
                                    : `Failed: ${runningJob.error || 'unknown error'}`
                                }
                            </div>
                        )}
                    </div>

                    {providerRuns.length === 0 ? (
                        <p className={`text-center py-12 ${textMuted}`}>
                            No analysis data for {activeProvider}. Select a model above and click Run Analysis.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left: Run Tree */}
                            <div className={`${cardClass} lg:col-span-1 self-start lg:sticky lg:top-4`}>
                                <h2 className={`text-sm font-semibold mb-3 ${textMuted}`}>Run History</h2>
                                <div className="space-y-0.5 -mx-2">
                                    {runTree.map(group => renderGroup(group, 0))}
                                </div>
                            </div>

                            {/* Right: Run Detail + TODOs */}
                            <div className="lg:col-span-2 space-y-4">
                                {loadingDetail && (
                                    <div className={`${cardClass} text-center`}>
                                        <p className={textMuted}>Loading run detail...</p>
                                    </div>
                                )}

                                {runDetail && (
                                    <>
                                        {/* Run Header */}
                                        <div className={cardClass}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <h2 className={`text-lg font-semibold ${textPrimary}`}>
                                                        {(runDetail.run.scope || 'hourly').charAt(0).toUpperCase() + (runDetail.run.scope || 'hourly').slice(1)} Report
                                                    </h2>
                                                    {(() => {
                                                        const rsc = scopeColors[runDetail.run.scope || 'hourly'] || scopeColors.hourly;
                                                        return (
                                                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${rsc.bg} ${rsc.text}`}>
                                                                {runDetail.run.scope || 'hourly'}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <button
                                                    onClick={() => { setRunDetail(null); setExpandedTodo(null); }}
                                                    className={`px-3 py-1 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                                >
                                                    Close
                                                </button>
                                            </div>
                                            <div className={`text-sm ${textMuted} space-y-1`}>
                                                <p>
                                                    <span>{runDetail.run.provider} / {runDetail.run.model}</span>
                                                    <span className="mx-2">&middot;</span>
                                                    <span>{dayjs(runDetail.run.created_at).format('MMM D, YYYY h:mm A')}</span>
                                                    <span className="mx-2">&middot;</span>
                                                    <span>{runDetail.run.order_count} orders</span>
                                                    <span className="mx-2">&middot;</span>
                                                    <span>{todos.length} TODOs</span>
                                                </p>
                                                {runDetail.run.data_start && runDetail.run.data_end && (
                                                    <p className="text-xs">
                                                        Data range: {runDetail.run.data_start} to {runDetail.run.data_end}
                                                    </p>
                                                )}
                                            </div>

                                        </div>

                                        {/* TODOs */}
                                        {todos.length > 0 && (
                                            <div className="space-y-2">
                                                {todos
                                                    .sort((a, b) => a.priority - b.priority)
                                                    .map(todo => renderTodoCard(todo))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {!runDetail && !loadingDetail && (
                                    <div className={`${cardClass} text-center py-12`}>
                                        <p className={textMuted}>Select a run from the tree to view its report and recommendations.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </main>
            <Foot/>

            {/* Squash Action Bar */}
            {selectedForSquash.size >= 2 && (
                <div className={`fixed bottom-0 left-0 right-0 z-50 border-t shadow-lg ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'}`}>
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className={`text-sm font-medium ${textPrimary}`}>
                                {selectedForSquash.size} TODOs selected
                            </span>
                            <span className={`text-xs ${textMuted}`}>
                                {(() => {
                                    const merged: Record<string, string> = {};
                                    todos.filter(t => selectedForSquash.has(t.id) && t.mutations).forEach(t => {
                                        Object.assign(merged, t.mutations);
                                    });
                                    return `${Object.keys(merged).length} param changes`;
                                })()}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => setSelectedForSquash(new Set())}
                                className={`px-3 py-1.5 rounded text-xs font-medium ${isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => {
                                    setSquashing(true);
                                    squashTodos(Array.from(selectedForSquash)).then(() => {
                                        const ids = selectedForSquash;
                                        setSentTodos(prev => {
                                            const next = new Set(prev);
                                            ids.forEach(id => next.add(id));
                                            return next;
                                        });
                                        setSelectedForSquash(new Set());
                                    }).catch(err => {
                                        alert(`Squash failed: ${err.message || err}`);
                                    }).finally(() => setSquashing(false));
                                }}
                                disabled={squashing}
                                className="px-4 py-1.5 rounded text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {squashing ? 'Squashing...' : 'Squash & Queue for Backtest'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function countRuns(group: RunGroup): number {
    let n = group.hourlyRuns.length + (group.run ? 1 : 0);
    for (const child of group.children) {
        n += countRuns(child);
    }
    return n;
}
