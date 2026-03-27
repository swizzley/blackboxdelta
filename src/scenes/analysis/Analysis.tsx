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
    fetchAnalysisModels, triggerAnalysisRun, fetchAnalysisJobs, stopAnalysisJob,
    createPromptRecommendation,
    type OllamaModel, type AnalysisJob} from '../../api/client';
import ReactMarkdown from 'react-markdown';

dayjs.extend(relativeTime);
dayjs.extend(isoWeek);

const PROVIDERS = ['ollama', 'hybrid'] as const;
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

const triggerColors: Record<string, { text: string; bg: string; label: string }> = {
    'service': {text: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Auto'},
    'api':     {text: 'text-blue-400', bg: 'bg-blue-500/20', label: 'API'},
    'ad-hoc':  {text: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Manual'},
};

const providerColors: Record<string, { text: string; bg: string; label: string }> = {
    anthropic: {text: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Claude'},
    ollama:    {text: 'text-sky-400',    bg: 'bg-sky-500/20',    label: 'Ollama'},
    hybrid:    {text: 'text-violet-400', bg: 'bg-violet-500/20', label: 'Hybrid'},
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
    scheduled?: boolean; // if true, render full 24-hour grid with skipped slots for missing hours
}

// Returns true for days the forex market is fully closed (Saturday only).
// Sunday is included — the market reopens Sunday ~22:00 UTC.
function isMarketClosed(d: dayjs.Dayjs): boolean {
    return d.day() === 6; // 6=Saturday
}

function buildRunTree(runs: AnalysisRunApi[]): RunGroup[] {
    // Separate by scope
    const byScope: Record<string, AnalysisRunApi[]> = {};
    for (const r of runs) {
        const s = r.scope || 'hourly';
        if (!byScope[s]) byScope[s] = [];
        byScope[s].push(r);
    }

    // Build hourly run lookup: day -> hour -> run
    const knownScopes = new Set(['hourly', 'daily', 'weekly', 'monthly', 'yearly']);
    const leafRuns = [
        ...(byScope['hourly'] || []),
        ...Object.entries(byScope).filter(([s]) => !knownScopes.has(s)).flatMap(([, rs]) => rs),
    ];
    const hourlyByDay: Record<string, Record<number, AnalysisRunApi>> = {};
    for (const r of leafRuns) {
        const day = dayjs(r.created_at).format('YYYY-MM-DD');
        const h = dayjs(r.created_at).hour();
        if (!hourlyByDay[day]) hourlyByDay[day] = {};
        hourlyByDay[day][h] = r;
    }

    // Daily run lookup: day -> runs
    const dailyByDay: Record<string, AnalysisRunApi[]> = {};
    for (const r of (byScope['daily'] || [])) {
        const day = dayjs(r.created_at).format('YYYY-MM-DD');
        if (!dailyByDay[day]) dailyByDay[day] = [];
        dailyByDay[day].push(r);
    }

    // Scheduled = has hourly runs (service-triggered). Ad-hoc = daily/weekly/etc only.
    const isScheduled = (byScope['hourly']?.length ?? 0) > 0;

    // Determine calendar range: from oldest run to today
    const today = dayjs();
    let startDate = today.startOf('day');
    for (const r of runs) {
        const d = dayjs(r.created_at).startOf('day');
        if (d.isBefore(startDate)) startDate = d;
    }

    // Build day nodes
    const dayNodes: Record<string, RunGroup> = {};

    if (isScheduled) {
        // Generate ALL market-open days from startDate to today (full calendar with skipped slots)
        let d = startDate;
        while (d.isBefore(today) || d.isSame(today, 'day')) {
            if (!isMarketClosed(d)) {
                const day = d.format('YYYY-MM-DD');
                const hourlyRuns = Object.values(hourlyByDay[day] || {});
                const dailyRuns = dailyByDay[day] || [];
                if (dailyRuns.length === 1) {
                    dayNodes[day] = {
                        key: day, label: d.format('ddd, MMM D'), scope: 'daily',
                        run: dailyRuns[0], children: [], hourlyRuns, scheduled: true,
                    };
                } else if (dailyRuns.length > 1) {
                    dayNodes[day] = {
                        key: day, label: d.format('ddd, MMM D'), scope: 'daily',
                        children: [], hourlyRuns: [...dailyRuns, ...hourlyRuns], scheduled: true,
                    };
                } else {
                    dayNodes[day] = {
                        key: day, label: d.format('ddd, MMM D'), scope: 'daily',
                        children: [], hourlyRuns, scheduled: true,
                    };
                }
            }
            d = d.add(1, 'day');
        }
    } else {
        // Ad-hoc: only create day nodes for days that have actual runs (no skipped slots)
        const allDays = new Set([
            ...Object.keys(hourlyByDay),
            ...Object.keys(dailyByDay),
        ]);
        for (const day of allDays) {
            const d = dayjs(day);
            const hourlyRuns = Object.values(hourlyByDay[day] || {});
            const dailyRuns = dailyByDay[day] || [];
            if (dailyRuns.length === 1) {
                dayNodes[day] = {
                    key: day, label: d.format('ddd, MMM D'), scope: 'daily',
                    run: dailyRuns[0], children: [], hourlyRuns,
                };
            } else {
                dayNodes[day] = {
                    key: day, label: d.format('ddd, MMM D'), scope: 'daily',
                    children: [], hourlyRuns: [...dailyRuns, ...hourlyRuns],
                };
            }
        }
    }

    // Build week nodes — all day nodes assigned to their ISO week
    const weekNodes: Record<string, RunGroup> = {};
    // Group weekly runs by ISO week first, so multiple runs in the same week are handled correctly
    const weeklyByWk: Record<string, AnalysisRunApi[]> = {};
    for (const r of (byScope['weekly'] || [])) {
        const rd = dayjs(r.created_at);
        const wk = rd.format('YYYY') + '-W' + String(rd.isoWeek()).padStart(2, '0');
        if (!weeklyByWk[wk]) weeklyByWk[wk] = [];
        weeklyByWk[wk].push(r);
    }
    for (const [wk, wkRuns] of Object.entries(weeklyByWk)) {
        const rd = dayjs(wkRuns[0].created_at);
        const newest = wkRuns[wkRuns.length - 1];
        const start = newest.data_start ? dayjs(newest.data_start).format('MMM D') : '';
        const end = newest.data_end ? dayjs(newest.data_end).format('MMM D') : '';
        if (wkRuns.length === 1) {
            weekNodes[wk] = {
                key: wk, label: `Week ${rd.isoWeek()}${start ? ` (${start} - ${end})` : ''}`,
                scope: 'weekly', run: wkRuns[0], children: [], hourlyRuns: [],
            };
        } else {
            // Multiple weekly runs in the same week: show newest as primary, rest accessible via hourlyRuns
            weekNodes[wk] = {
                key: wk, label: `Week ${rd.isoWeek()}${start ? ` (${start} - ${end})` : ''}`,
                scope: 'weekly', run: newest, children: [], hourlyRuns: wkRuns.slice(0, -1),
            };
        }
    }
    for (const [day, node] of Object.entries(dayNodes)) {
        const rd = dayjs(day);
        const wk = rd.format('YYYY') + '-W' + String(rd.isoWeek()).padStart(2, '0');
        if (!weekNodes[wk]) {
            weekNodes[wk] = { key: wk, label: `Week ${rd.isoWeek()}`, scope: 'weekly', children: [], hourlyRuns: [] };
        }
        weekNodes[wk].children.push(node);
    }
    for (const wk of Object.values(weekNodes)) {
        wk.children.sort((a, b) => b.key.localeCompare(a.key));
    }

    // Build month nodes
    const monthNodes: Record<string, RunGroup> = {};
    for (const r of (byScope['monthly'] || [])) {
        const mo = dayjs(r.created_at).format('YYYY-MM');
        monthNodes[mo] = {
            key: mo, label: dayjs(mo + '-01').format('MMMM YYYY'),
            scope: 'monthly', run: r, children: [], hourlyRuns: [],
        };
    }
    for (const [wk, node] of Object.entries(weekNodes)) {
        const year = parseInt(wk.slice(0, 4));
        const week = parseInt(wk.slice(6));
        const monday = dayjs().year(year).isoWeek(week).startOf('isoWeek');
        const mo = monday.format('YYYY-MM');
        if (!monthNodes[mo]) {
            monthNodes[mo] = { key: mo, label: dayjs(mo + '-01').format('MMMM YYYY'), scope: 'monthly', children: [], hourlyRuns: [] };
        }
        monthNodes[mo].children.push(node);
    }
    for (const mo of Object.values(monthNodes)) {
        mo.children.sort((a, b) => b.key.localeCompare(a.key));
    }

    // Build year nodes
    const yearNodes: Record<string, RunGroup> = {};
    for (const r of (byScope['yearly'] || [])) {
        const yr = dayjs(r.created_at).format('YYYY');
        yearNodes[yr] = { key: yr, label: yr, scope: 'yearly', run: r, children: [], hourlyRuns: [] };
    }
    for (const [mo, node] of Object.entries(monthNodes)) {
        const yr = mo.slice(0, 4);
        if (!yearNodes[yr]) {
            yearNodes[yr] = { key: yr, label: yr, scope: 'yearly', children: [], hourlyRuns: [] };
        }
        yearNodes[yr].children.push(node);
    }
    for (const yr of Object.values(yearNodes)) {
        yr.children.sort((a, b) => b.key.localeCompare(a.key));
    }

    return Object.values(yearNodes).sort((a, b) => b.key.localeCompare(a.key));
}

// Build a Claude Code prompt from a TODO item
function buildTodoPrompt(todo: AnalysisTodoApi): string {
    const parts = [
        `## Analysis Finding: ${todo.title}`,
        '',
        `**Priority:** P${todo.priority} | **Category:** ${todo.category} | **Complexity:** ${todo.complexity}`,
        '',
        `### Description`,
        todo.description,
        '',
        `### Expected Impact`,
        todo.expected_impact,
        '',
        `### Evidence`,
        todo.evidence,
    ];
    if (todo.affected_files.length > 0) {
        parts.push('', `### Affected Files`, ...todo.affected_files.map(f => `- ${f}`));
    }
    if (todo.mutations && Object.keys(todo.mutations).length > 0) {
        parts.push('', `### Proposed Parameter Changes`);
        for (const [k, v] of Object.entries(todo.mutations).sort(([a], [b]) => a.localeCompare(b))) {
            const old = todo.current_values?.[k];
            parts.push(`- ${k}: ${old != null ? `${old} → ` : ''}${v}`);
        }
    }
    parts.push(
        '',
        '---',
        'Investigate the files listed above. Implement the changes described, following existing code conventions. Show me what you plan to change before making edits.'
    );
    return parts.join('\n');
}

// Curated model list: recommended + runners-up only
const CURATED_MODELS: { name: string; label: string }[] = [
    {name: 'qwen3:14b', label: 'qwen3:14b (recommended)'},
    {name: 'deepseek-r1:14b', label: 'deepseek-r1:14b (reasoning runner-up)'},
    {name: 'phi4:14b', label: 'phi4:14b (math runner-up)'},
    {name: 'qwen2.5:14b', label: 'qwen2.5:14b (baseline)'},
];

function curatedModels(available: OllamaModel[]): { name: string; label: string; size: string }[] {
    const avail = new Set(available.map(m => m.name));
    return CURATED_MODELS
        .filter(c => avail.has(c.name))
        .map(c => {
            const m = available.find(a => a.name === c.name)!;
            return {name: c.name, label: c.label, size: m.parameter_size};
        });
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

// Mirrors Go's detectTimeframeFromKeys: returns the first timeframe suffix found in mutation keys.
function detectTodoTimeframe(todo: AnalysisTodoApi): string {
    if (!todo.mutations) return '';
    for (const key of Object.keys(todo.mutations)) {
        if (key.endsWith('.scalp')) return 'scalp';
        if (key.endsWith('.intraday')) return 'intraday';
        if (key.endsWith('.swing')) return 'swing';
    }
    return '';
}

export default function Analysis() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const [allRuns, setAllRuns] = useState<AnalysisRunApi[]>([]);
    const [runProvider, setRunProvider] = useState<Provider>('ollama');
    const [hybridAnthropicModel, setHybridAnthropicModel] = useState('claude-sonnet-4-20250514');
    const [loading, setLoading] = useState(true);
    const [runDetail, setRunDetail] = useState<AnalysisRunDetailApi | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [expandedTodo, setExpandedTodo] = useState<number | null>(null);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [sendingTodo, setSendingTodo] = useState<number | null>(null);
    const [sentTodos, setSentTodos] = useState<Set<number>>(new Set());
    const [selectedForSquash, setSelectedForSquash] = useState<Set<number>>(new Set());
    const [squashing, setSquashing] = useState(false);
    const [queueingAll, setQueueingAll] = useState(false);
    const [copiedTodo, setCopiedTodo] = useState<number | null>(null);

    // Comparison mode
    const [compareDetail, setCompareDetail] = useState<AnalysisRunDetailApi | null>(null);
    const [loadingCompare, setLoadingCompare] = useState(false);

    // Ad-hoc run controls
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [runFrom, setRunFrom] = useState(() => defaultMarketDay());
    const [runTo, setRunTo] = useState(() => defaultMarketDay());
    const [runningJob, setRunningJob] = useState<AnalysisJob | null>(null);

    const [runTimeframe, setRunTimeframe] = useState('');

    // Optimizer prompt recommendation
    const [optPrompt, setOptPrompt] = useState('');
    const [optPromptTf, setOptPromptTf] = useState('swing');
    const [optPromptSending, setOptPromptSending] = useState(false);
    const [optPromptResult, setOptPromptResult] = useState<{ok: boolean; msg: string} | null>(null);

    // Load models
    useEffect(() => {
        if (!apiAvailable) return;
        fetchAnalysisModels().then(data => {
            if (data) {
                setModels(data);
                if (!selectedModel && data.length > 0) {
                    // Default to qwen3:14b if available, then qwen2.5:14b, otherwise first
                    const def = data.find(m => m.name === 'qwen3:14b') || data.find(m => m.name === 'qwen2.5:14b');
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
                        // Reload all runs and auto-select the newest one
                        Promise.all(PROVIDERS.map(p => fetchAnalysisRuns(p, 100)))
                            .then(results => {
                                const merged = results.flatMap((r, i) => (r ?? []).map(run => ({...run, provider: run.provider || PROVIDERS[i]})));
                                merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
                                setAllRuns(merged);
                                if (merged.length > 0) loadRunDetail(merged[0].run_id);
                            });
                    }
                }
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [runningJob]);


    useEffect(() => {
        if (!apiAvailable) return;
        setLoading(true);
        Promise.all(PROVIDERS.map(p => fetchAnalysisRuns(p, 100).catch(() => null)))
            .then(results => {
                const merged = results.flatMap((r, i) => (r ?? []).map(run => ({...run, provider: run.provider || PROVIDERS[i]})));
                merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
                setAllRuns(merged);

                // Auto-expand the most recent group and load latest run
                const tree = buildRunTree(merged);
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
                }
                if (merged.length > 0) {
                    loadRunDetail(merged[0].run_id);
                }
                setLoading(false);
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
        setSummaryOpen(false);
        fetchAnalysisRunDetail(runId).then(data => {
            setRunDetail(data ?? null);
        }).finally(() => setLoadingDetail(false));
    }, []);

    const loadCompareDetail = useCallback((runId: string) => {
        setLoadingCompare(true);
        fetchAnalysisRunDetail(runId).then(data => {
            setCompareDetail(data ?? null);
        }).finally(() => setLoadingCompare(false));
    }, []);

    const runTree = buildRunTree(allRuns.filter(r => r.provider === runProvider));
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
        const tc = triggerColors[run.trigger || 'ad-hoc'] || triggerColors['ad-hoc'];
        const pc = providerColors[run.provider] || providerColors.ollama;
        const isActive = runDetail?.run.run_id === run.run_id;
        const isCompare = compareDetail?.run.run_id === run.run_id;
        const isSkipped = run.skipped === true;
        return (
            <div
                key={run.run_id}
                onClick={() => loadRunDetail(run.run_id)}
                className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer rounded text-sm transition-colors
                    ${isActive
                        ? `${isDarkMode ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'bg-cyan-50 ring-1 ring-cyan-300'}`
                        : isCompare
                        ? `${isDarkMode ? 'bg-purple-500/10 ring-1 ring-purple-500/30' : 'bg-purple-50 ring-1 ring-purple-300'}`
                        : isSkipped
                        ? `${isDarkMode ? 'bg-gray-800/60 opacity-60' : 'bg-gray-100/80 opacity-60'}`
                        : `${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`
                    }`}
                style={{paddingLeft: `${indent * 16 + 12}px`}}
            >
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${pc.bg} ${pc.text} flex-shrink-0`}>
                    {pc.label}
                </span>
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text} flex-shrink-0`}>
                    {(run.scope || 'hourly').charAt(0).toUpperCase() + (run.scope || 'hourly').slice(1)}
                </span>
                {run.timeframe && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-600/30 text-slate-300 flex-shrink-0">
                        {run.timeframe}
                    </span>
                )}
                {run.provider === 'ollama' && run.trigger === 'service' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${tc.bg} ${tc.text} flex-shrink-0`}>
                        {tc.label}
                    </span>
                )}
                <span className={`${isActive ? 'text-cyan-400' : isCompare ? 'text-purple-400' : isSkipped ? (isDarkMode ? 'text-gray-500' : 'text-gray-400') : textPrimary} flex-1 min-w-0 truncate`}>
                    {dayjs(run.created_at).format('h:mm A')}
                    {isSkipped && <span className="ml-1.5 text-[10px] text-gray-500">Skipped — 0 trades in window</span>}
                </span>
                {isSkipped && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-600/40 text-gray-400 font-mono flex-shrink-0">SKIPPED</span>
                )}
                {!isSkipped && <span className={`text-xs ${textMuted} flex-shrink-0`}>
                    {run.order_count}
                </span>}
                {run.todo_count > 0 && run.tested_todo_count >= run.todo_count && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 flex-shrink-0" title="All TODOs tested">
                        Tested
                    </span>
                )}
                {run.todo_count > 0 && run.tested_todo_count > 0 && run.tested_todo_count < run.todo_count && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 flex-shrink-0"
                          title={`${run.tested_todo_count}/${run.todo_count} TODOs tested`}>
                        {run.tested_todo_count}/{run.todo_count}
                    </span>
                )}
                {/* Compare button: show when a run is selected and this isn't it */}
                {runDetail && !isActive && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isCompare) {
                                setCompareDetail(null);
                            } else {
                                loadCompareDetail(run.run_id);
                            }
                        }}
                        className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 transition-colors
                            ${isCompare
                                ? 'bg-purple-600 text-white'
                                : `${isDarkMode ? 'bg-slate-700 text-gray-400 hover:bg-purple-600 hover:text-white' : 'bg-gray-200 text-gray-500 hover:bg-purple-500 hover:text-white'}`
                            }`}
                        title={isCompare ? 'Remove from comparison' : 'Compare with selected run'}
                    >
                        {isCompare ? 'VS' : 'vs'}
                    </button>
                )}
            </div>
        );
    };

    // Render a placeholder row for an hour with no run
    const renderSkippedSlot = (hourLabel: string, indent: number) => (
        <div
            key={`skipped-${hourLabel}`}
            className={`flex items-center gap-1.5 px-3 py-2 rounded text-sm opacity-40 select-none`}
            style={{paddingLeft: `${indent * 16 + 12}px`}}
        >
            <span className={`flex-1 min-w-0 truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {hourLabel}
                <span className="ml-1.5 text-[10px]">— 0 trades in window</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-600/40 text-gray-400 font-mono flex-shrink-0">SKIPPED</span>
        </div>
    );

    // Render a group node (collapsible)
    const renderGroup = (group: RunGroup, depth: number): JSX.Element => {
        const isExpanded = expandedGroups.has(group.key);
        const sc = scopeColors[group.scope] || scopeColors.hourly;
        // Scheduled day nodes always have content (24 hour slots, even if all skipped)
        const hasContent = group.scheduled || group.children.length > 0 || group.hourlyRuns.length > 0;
        const totalRuns = countRuns(group);

        // For scheduled day nodes: fill all hours 0-maxHour, skipped where no run exists
        let hourSlots: JSX.Element[] = [];
        if (group.scheduled) {
            const day = group.key;
            const now = dayjs();
            const isToday = day === now.format('YYYY-MM-DD');
            const maxHour = isToday ? now.hour() : 23;

            const runByHour: Record<number, AnalysisRunApi> = {};
            for (const run of group.hourlyRuns) {
                if ((run.scope || 'hourly') === 'hourly') {
                    runByHour[dayjs(run.created_at).hour()] = run;
                }
            }

            for (let h = maxHour; h >= 0; h--) {
                if (runByHour[h]) {
                    hourSlots.push(<div key={runByHour[h].run_id}>{renderRunRow(runByHour[h], depth + 1)}</div>);
                } else {
                    const label = dayjs(day + 'T' + String(h).padStart(2, '0') + ':00').format('h:mm A');
                    hourSlots.push(renderSkippedSlot(label, depth + 1));
                }
            }
        }

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
                        {hourSlots.length > 0
                            ? hourSlots
                            : group.hourlyRuns.map(run => renderRunRow(run, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // Render a TODO card
    const renderTodoCard = (todo: AnalysisTodoApi) => {
        const sc = statusColors[todo.status] || statusColors.open;
        const isExpanded = expandedTodo === todo.id;
        const isTestedOrQueued = !!(todo.recommendation_status || sentTodos.has(todo.id));

        return (
            <div key={todo.id} className={`${cardClass} transition-all ${isTestedOrQueued ? 'opacity-50' : ''}`}>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 cursor-pointer hover:opacity-80"
                     onClick={() => setExpandedTodo(isExpanded ? null : todo.id)}>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text}`}>
                                {sc.label}
                            </span>
                            {todo.recommendation_status === 'passed' && (
                                <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400">PASS</span>
                            )}
                            {todo.recommendation_status === 'failed' && (
                                <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400">FAIL</span>
                            )}
                            {(todo.recommendation_status === 'running' || todo.recommendation_status === 'queued') && (
                                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 animate-pulse">TESTING</span>
                            )}
                            {(todo.recommendation_status === 'pending' || sentTodos.has(todo.id)) && !['passed','failed','running','queued'].includes(todo.recommendation_status ?? '') && (
                                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">QUEUED</span>
                            )}
                            {todo.recommendation_status === 'applied' && (
                                <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-cyan-500/20 text-cyan-400">APPLIED</span>
                            )}
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
                            {/* Copy as Prompt — for code-change TODOs without mutations, or any TODO */}
                            {(!todo.mutations || Object.keys(todo.mutations).length === 0) && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const prompt = buildTodoPrompt(todo);
                                            navigator.clipboard.writeText(prompt).then(() => {
                                                setCopiedTodo(todo.id);
                                                setTimeout(() => setCopiedTodo(null), 2000);
                                            });
                                        }}
                                        className="px-3 py-1 rounded text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white"
                                    >
                                        {copiedTodo === todo.id ? 'Copied!' : 'Copy as Prompt'}
                                    </button>
                                    <span className={`text-xs ${textMuted}`}>Paste into Claude Code to implement</span>
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
                                            <span className="text-xs font-medium text-cyan-400 bg-cyan-500/20 px-2 py-1 rounded">Applied to Baseline</span>
                                        ) : sentTodos.has(todo.id) || todo.recommendation_status === 'pending' ? (
                                            <span className="text-xs text-blue-400">Queued for backtest</span>
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
                            {allRuns.length} runs
                        </p>
                    </div>

                    {/* Ad-hoc Run Controls */}
                    <div className={`${cardClass} mb-6`}>
                        {/* Row 1: Timeframe */}
                        <div className="flex flex-wrap items-end gap-3 mb-3">
                            <div className="min-w-[120px]">
                                <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Timeframe</label>
                                <select
                                    value={runTimeframe}
                                    onChange={e => setRunTimeframe(e.target.value)}
                                    className={`w-full px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                                >
                                    <option value="">All</option>
                                    <option value="scalp">Scalp</option>
                                    <option value="intraday">Intraday</option>
                                    <option value="swing">Swing</option>
                                </select>
                            </div>
                        </div>
                        {/* Row 2: Provider, Model, Dates, Run */}
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="min-w-[120px]">
                                <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Provider</label>
                                <select
                                    value={runProvider}
                                    onChange={e => setRunProvider(e.target.value as Provider)}
                                    className={`w-full px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                                >
                                    {PROVIDERS.map(p => (
                                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Model</label>
                                <select
                                    value={selectedModel}
                                    onChange={e => setSelectedModel(e.target.value)}
                                    className={`w-full px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                                >
                                    {curatedModels(models).map(m => (
                                        <option key={m.name} value={m.name}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                            {runProvider === 'hybrid' && (
                                <div className="flex-1 min-w-[160px]">
                                    <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Claude Model</label>
                                    <select
                                        value={hybridAnthropicModel}
                                        onChange={e => setHybridAnthropicModel(e.target.value)}
                                        className={`w-full px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                                    >
                                        <option value="claude-sonnet-4-20250514">Sonnet 4</option>
                                        <option value="claude-opus-4-20250514">Opus 4</option>
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className={`block text-xs font-medium mb-1 ${textMuted}`}>From</label>
                                <input
                                    type="date"
                                    value={runFrom}
                                    onChange={e => setRunFrom(e.target.value)}
                                    className={`px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-medium mb-1 ${textMuted}`}>To</label>
                                <input
                                    type="date"
                                    value={runTo}
                                    onChange={e => setRunTo(e.target.value)}
                                    className={`px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                                />
                            </div>
                            <div>
                                {runningJob?.status === 'running' ? (
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="px-4 py-1.5 rounded text-sm font-medium bg-yellow-500/20 text-yellow-400 flex items-center gap-2">
                                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                                </svg>
                                                {runningJob.phase > 0
                                                    ? `Phase ${runningJob.phase}/6: ${runningJob.phase_name || '...'}`
                                                    : `Starting (${runningJob.model})...`}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    stopAnalysisJob().then(j => {
                                                        if (j) setRunningJob(j);
                                                    });
                                                }}
                                                className="px-3 py-1.5 rounded text-sm font-medium bg-red-600 hover:bg-red-500 text-white"
                                            >
                                                Stop
                                            </button>
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
                                            triggerAnalysisRun(
                                                selectedModel,
                                                runFrom,
                                                runTo,
                                                runProvider,
                                                runProvider === 'hybrid' ? hybridAnthropicModel : undefined,
                                                runTimeframe || undefined,
                                            ).then(job => {
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
                            <div className={`mt-2 text-xs ${runningJob.status === 'completed' ? 'text-emerald-400' : runningJob.status === 'stopped' ? 'text-yellow-400' : 'text-red-400'}`}>
                                {runningJob.status === 'completed'
                                    ? `Completed: ${runningJob.model} (${runningJob.from} to ${runningJob.to})`
                                    : runningJob.status === 'stopped'
                                    ? `Stopped at phase ${runningJob.phase}`
                                    : `Failed: ${runningJob.error || 'unknown error'}`
                                }
                            </div>
                        )}
                    </div>

                    {/* Optimizer Prompt — submit a natural language hypothesis for verification */}
                    <div className={`${cardClass} mb-6`}>
                        <div className="flex items-center gap-2 mb-3">
                            <svg className={`w-5 h-5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
                            <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Test Optimizer Hypothesis</h2>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[280px]">
                                <input
                                    type="text"
                                    value={optPrompt}
                                    onChange={e => { setOptPrompt(e.target.value); setOptPromptResult(null); }}
                                    placeholder="e.g. try swing with trailing stop of 1.0, or loosen scalp min_confidence to 0.45"
                                    className={`w-full px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600 placeholder-slate-500' : 'bg-white text-gray-900 border-gray-300 placeholder-gray-400'}`}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && optPrompt.trim() && !optPromptSending) {
                                            setOptPromptSending(true);
                                            setOptPromptResult(null);
                                            createPromptRecommendation(optPrompt.trim(), optPromptTf).then(res => {
                                                if (res) {
                                                    setOptPromptResult({ok: true, msg: `Queued as recommendation #${res.id} (${optPromptTf})`});
                                                    setOptPrompt('');
                                                } else {
                                                    setOptPromptResult({ok: false, msg: 'Failed to submit'});
                                                }
                                            }).catch(() => setOptPromptResult({ok: false, msg: 'Failed to submit'}))
                                              .finally(() => setOptPromptSending(false));
                                        }
                                    }}
                                />
                            </div>
                            <div className="min-w-[100px]">
                                <select
                                    value={optPromptTf}
                                    onChange={e => setOptPromptTf(e.target.value)}
                                    className={`w-full px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                                >
                                    <option value="scalp">Scalp</option>
                                    <option value="intraday">Intraday</option>
                                    <option value="swing">Swing</option>
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    if (!optPrompt.trim() || optPromptSending) return;
                                    setOptPromptSending(true);
                                    setOptPromptResult(null);
                                    createPromptRecommendation(optPrompt.trim(), optPromptTf).then(res => {
                                        if (res) {
                                            setOptPromptResult({ok: true, msg: `Queued as recommendation #${res.id} (${optPromptTf})`});
                                            setOptPrompt('');
                                        } else {
                                            setOptPromptResult({ok: false, msg: 'Failed to submit'});
                                        }
                                    }).catch(() => setOptPromptResult({ok: false, msg: 'Failed to submit'}))
                                      .finally(() => setOptPromptSending(false));
                                }}
                                disabled={!optPrompt.trim() || optPromptSending}
                                className="px-4 py-1.5 rounded text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {optPromptSending ? 'Submitting...' : 'Test Hypothesis'}
                            </button>
                        </div>
                        {optPromptResult && (
                            <p className={`mt-2 text-xs ${optPromptResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                {optPromptResult.msg}
                            </p>
                        )}
                        <p className={`mt-2 text-xs ${textMuted}`}>
                            Describe a parameter change in plain English. The optimizer AI translates it to mutations and runs IS+OOS verification with full guardrails.
                        </p>
                    </div>

                    {allRuns.length === 0 ? (
                        <p className={`text-center py-12 ${textMuted}`}>
                            No analysis data. Select a provider and model above and click Run Analysis.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left: Run Tree */}
                            <div className={`${cardClass} lg:col-span-1 self-start lg:sticky lg:top-4`}>
                                <h2 className={`text-sm font-semibold mb-3 ${textMuted}`}>
                                    Live Orders History
                                </h2>
                                <div className="space-y-0.5 -mx-2">
                                    {runTree.map(group => renderGroup(group, 0))}
                                </div>
                            </div>

                            {/* Right: Run Detail + TODOs (or Comparison View) */}
                            <div className="lg:col-span-2 space-y-4">
                                {(loadingDetail || loadingCompare) && (
                                    <div className={`${cardClass} text-center`}>
                                        <p className={textMuted}>Loading...</p>
                                    </div>
                                )}

                                {/* Comparison View */}
                                {runDetail && compareDetail && (
                                    <>
                                        {/* Comparison Header */}
                                        <div className={cardClass}>
                                            <div className="flex items-center justify-between mb-3">
                                                <h2 className={`text-lg font-semibold ${textPrimary}`}>Run Comparison</h2>
                                                <button
                                                    onClick={() => setCompareDetail(null)}
                                                    className={`px-3 py-1 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                                >
                                                    Exit Comparison
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                {[runDetail, compareDetail].map((detail, idx) => {
                                                    const sc = scopeColors[detail.run.scope || 'hourly'] || scopeColors.hourly;
                                                    const tc = triggerColors[detail.run.trigger || 'ad-hoc'] || triggerColors['ad-hoc'];
                                                    const borderColor = idx === 0 ? 'border-cyan-500/30' : 'border-purple-500/30';
                                                    const labelColor = idx === 0 ? 'text-cyan-400' : 'text-purple-400';
                                                    return (
                                                        <div key={detail.run.run_id} className={`p-3 rounded border ${borderColor} ${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                <span className={`text-xs font-bold ${labelColor}`}>{idx === 0 ? 'A' : 'B'}</span>
                                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text}`}>
                                                                    {detail.run.scope || 'hourly'}
                                                                </span>
                                                                <span className={`text-xs px-1.5 py-0.5 rounded ${tc.bg} ${tc.text}`}>
                                                                    {tc.label}
                                                                </span>
                                                            </div>
                                                            <p className={`text-sm font-medium ${textPrimary}`}>{detail.run.model}</p>
                                                            <p className={`text-xs ${textMuted}`}>
                                                                {dayjs(detail.run.created_at).format('MMM D, h:mm A')}
                                                                <span className="mx-1">&middot;</span>
                                                                {detail.run.order_count} orders
                                                                <span className="mx-1">&middot;</span>
                                                                {detail.todos.length} TODOs
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Side-by-side Syntheses */}
                                        {(runDetail.run.synthesis || compareDetail.run.synthesis) && (
                                            <div className={cardClass}>
                                                <h3 className={`text-sm font-semibold mb-3 ${textMuted}`}>Executive Summary</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {[runDetail, compareDetail].map((detail, idx) => {
                                                        const borderColor = idx === 0 ? 'border-l-cyan-500' : 'border-l-purple-500';
                                                        const labelColor = idx === 0 ? 'text-cyan-400' : 'text-purple-400';
                                                        return (
                                                            <div key={detail.run.run_id} className={`border-l-2 ${borderColor} pl-3`}>
                                                                <p className={`text-xs font-bold mb-2 ${labelColor}`}>
                                                                    {idx === 0 ? 'A' : 'B'}: {detail.run.model}
                                                                </p>
                                                                {detail.run.synthesis ? (
                                                                    <div className={`prose prose-sm max-w-none ${isDarkMode ? 'prose-invert' : ''} text-sm`}>
                                                                        <ReactMarkdown>{detail.run.synthesis}</ReactMarkdown>
                                                                    </div>
                                                                ) : (
                                                                    <p className={`text-sm italic ${textMuted}`}>No synthesis available</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Side-by-side TODOs */}
                                        <div className={cardClass}>
                                            <h3 className={`text-sm font-semibold mb-3 ${textMuted}`}>TODO Comparison</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                {[runDetail, compareDetail].map((detail, idx) => {
                                                    const borderColor = idx === 0 ? 'border-l-cyan-500' : 'border-l-purple-500';
                                                    const labelColor = idx === 0 ? 'text-cyan-400' : 'text-purple-400';
                                                    const dtodos = detail.todos.sort((a, b) => a.priority - b.priority);
                                                    return (
                                                        <div key={detail.run.run_id} className={`border-l-2 ${borderColor} pl-3`}>
                                                            <p className={`text-xs font-bold mb-2 ${labelColor}`}>
                                                                {idx === 0 ? 'A' : 'B'}: {dtodos.length} TODOs
                                                            </p>
                                                            <div className="space-y-2">
                                                                {dtodos.map(todo => {
                                                                    const prio = priorityLabels[todo.priority] || {label: `P${todo.priority}`, color: 'text-gray-400', bg: 'bg-gray-500/20'};
                                                                    return (
                                                                        <div key={todo.id} className={`p-2 rounded ${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                                                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${prio.bg} ${prio.color}`}>
                                                                                    {prio.label}
                                                                                </span>
                                                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs ${isDarkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                                                                                    {categoryLabels[todo.category] || todo.category}
                                                                                </span>
                                                                            </div>
                                                                            <p className={`text-sm font-medium ${textPrimary}`}>{todo.title}</p>
                                                                            <p className={`text-xs mt-0.5 ${textMuted}`}>{todo.expected_impact}</p>
                                                                            {todo.mutations && Object.keys(todo.mutations).length > 0 && (
                                                                                <div className={`mt-1.5 font-mono text-xs rounded overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
                                                                                    {Object.entries(todo.mutations).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                                                                                        <div key={key} className="flex bg-emerald-500/10 border-l-2 border-emerald-500 px-1.5 py-0.5">
                                                                                            <span className="text-emerald-300">{key} = {value}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                                {dtodos.length === 0 && (
                                                                    <p className={`text-sm italic ${textMuted}`}>No TODOs</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Normal Detail View (no comparison) */}
                                {runDetail && !compareDetail && (
                                    <>
                                        {/* Run Header */}
                                        <div className={cardClass}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <h2 className={`text-lg font-semibold ${textPrimary}`}>
                                                        {`${(runDetail.run.scope || 'hourly').charAt(0).toUpperCase() + (runDetail.run.scope || 'hourly').slice(1)} Report`}
                                                    </h2>
                                                    {(() => {
                                                        const rsc = scopeColors[runDetail.run.scope || 'hourly'] || scopeColors.hourly;
                                                        const rtc = triggerColors[runDetail.run.trigger || 'ad-hoc'] || triggerColors['ad-hoc'];
                                                        return (
                                                            <>
                                                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${rsc.bg} ${rsc.text}`}>
                                                                    {runDetail.run.scope || 'hourly'}
                                                                </span>
                                                                <span className={`text-xs px-1.5 py-0.5 rounded ${rtc.bg} ${rtc.text}`}>
                                                                    {rtc.label}
                                                                </span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                                <button
                                                    onClick={() => { setRunDetail(null); setCompareDetail(null); setExpandedTodo(null); }}
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
                                                    {runDetail.run.todo_count > 0 && runDetail.run.tested_todo_count > 0 && (
                                                        <>
                                                            <span className="mx-2">&middot;</span>
                                                            {runDetail.run.tested_todo_count >= runDetail.run.todo_count ? (
                                                                <span className="text-emerald-400 font-medium">Fully Tested</span>
                                                            ) : (
                                                                <span className="text-yellow-400 font-medium">{runDetail.run.tested_todo_count}/{runDetail.run.todo_count} Tested</span>
                                                            )}
                                                        </>
                                                    )}
                                                </p>
                                                {runDetail.run.data_start && runDetail.run.data_end && (
                                                    <p className="text-xs">
                                                        Data range: {runDetail.run.data_start} to {runDetail.run.data_end}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Executive Summary Drawer */}
                                            {runDetail.run.synthesis && (
                                                <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                                    <button
                                                        onClick={() => setSummaryOpen(!summaryOpen)}
                                                        className={`w-full flex items-center justify-between text-left ${textPrimary}`}
                                                    >
                                                        <span className="text-sm font-semibold">Executive Summary</span>
                                                        <svg className={`w-4 h-4 transition-transform ${summaryOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>
                                                    {summaryOpen && (
                                                        <div className="mt-3">
                                                            <div className={`prose prose-sm max-w-none ${isDarkMode ? 'prose-invert' : ''}`}>
                                                                <ReactMarkdown>{runDetail.run.synthesis}</ReactMarkdown>
                                                            </div>

                                                            {/* Queue All button */}
                                                            {(() => {
                                                                const queueable = todos.filter(t =>
                                                                    t.status === 'open' && t.mutations && Object.keys(t.mutations).length > 0
                                                                    && !sentTodos.has(t.id) && !t.recommendation_status
                                                                );
                                                                if (queueable.length === 0) return null;
                                                                return (
                                                                    <div className={`mt-4 pt-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                                                        <button
                                                                            onClick={() => {
                                                                                setQueueingAll(true);
                                                                                const byTf: Record<string, AnalysisTodoApi[]> = {};
                                                                                const skipped: string[] = [];
                                                                                for (const t of queueable) {
                                                                                    const tf = detectTodoTimeframe(t);
                                                                                    if (!tf) { skipped.push(t.title); continue; }
                                                                                    if (!byTf[tf]) byTf[tf] = [];
                                                                                    byTf[tf].push(t);
                                                                                }
                                                                                if (skipped.length > 0) {
                                                                                    alert(`Skipped ${skipped.length} TODO(s) with no timeframe suffix:\n${skipped.join('\n')}`);
                                                                                }
                                                                                const calls: Promise<any>[] = [];
                                                                                const allIds: number[] = [];
                                                                                for (const group of Object.values(byTf)) {
                                                                                    if (group.length >= 2) {
                                                                                        calls.push(squashTodos(group.map(t => t.id)));
                                                                                    } else {
                                                                                        calls.push(sendTodoToOptimizer(group[0].id));
                                                                                    }
                                                                                    group.forEach(t => allIds.push(t.id));
                                                                                }
                                                                                Promise.all(calls).then(() => {
                                                                                    setSentTodos(prev => {
                                                                                        const next = new Set(prev);
                                                                                        allIds.forEach(id => next.add(id));
                                                                                        return next;
                                                                                    });
                                                                                }).catch(err => {
                                                                                    alert(`Failed to queue all: ${err.message || err}`);
                                                                                }).finally(() => setQueueingAll(false));
                                                                            }}
                                                                            disabled={queueingAll}
                                                                            className="px-3 py-1.5 rounded text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            {queueingAll ? 'Queueing...' : `Queue All ${queueable.length} Parameter TODOs for Backtest`}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

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
