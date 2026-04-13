import {useState} from 'react';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import {useTheme} from '../../context/Theme';
import type {AnalysisRunDetailApi, AnalysisTodoApi} from '../../context/Types';
import {scopeColors, triggerColors} from './constants';
import {sendTodoToOptimizer, squashTodos} from '../../api/client';
import {detectTodoTimeframe} from './TodoList';
import TodoList from './TodoList';

interface Props {
    detail: AnalysisRunDetailApi;
    compareDetail: AnalysisRunDetailApi | null;
    onClose: () => void;
    onExitCompare: () => void;
}

export default function RunDetail({detail, compareDetail, onClose, onExitCompare}: Props) {
    const {isDarkMode} = useTheme();
    const textMuted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
    const cardClass = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`;

    const [summaryOpen, setSummaryOpen] = useState(false);
    const [phasesOpen, setPhasesOpen] = useState<Set<number>>(new Set());
    const [queueingAll, setQueueingAll] = useState(false);

    const todos = detail.todos || [];
    const phases = detail.phases || [];

    const togglePhase = (phase: number) => {
        setPhasesOpen(prev => {
            const next = new Set(prev);
            next.has(phase) ? next.delete(phase) : next.add(phase);
            return next;
        });
    };

    // Comparison mode
    if (compareDetail) {
        return <CompareView a={detail} b={compareDetail} onExit={onExitCompare} />;
    }

    const sc = scopeColors[detail.run.scope || 'daily'] || scopeColors.daily;
    const tc = triggerColors[detail.run.trigger || 'ad-hoc'] || triggerColors['ad-hoc'];

    return (
        <div className="lg:col-span-2 space-y-4">
            {/* Run Header */}
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <h2 className={`text-lg font-semibold ${textPrimary}`}>
                            {`${(detail.run.scope || 'daily').charAt(0).toUpperCase() + (detail.run.scope || 'daily').slice(1)} Report`}
                        </h2>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text}`}>
                            {detail.run.scope || 'daily'}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${tc.bg} ${tc.text}`}>
                            {tc.label}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className={`px-3 py-1 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        Close
                    </button>
                </div>
                <div className={`text-sm ${textMuted} space-y-1`}>
                    <p>
                        <span>{detail.run.provider} / {detail.run.model}</span>
                        <span className="mx-2">&middot;</span>
                        <span>{dayjs(detail.run.created_at).format('MMM D, YYYY h:mm A')}</span>
                        <span className="mx-2">&middot;</span>
                        <span>{detail.run.order_count} orders</span>
                        <span className="mx-2">&middot;</span>
                        <span>{todos.length} TODOs</span>
                        {detail.run.todo_count > 0 && detail.run.tested_todo_count > 0 && (
                            <>
                                <span className="mx-2">&middot;</span>
                                {detail.run.tested_todo_count >= detail.run.todo_count ? (
                                    <span className="text-emerald-400 font-medium">Fully Tested</span>
                                ) : (
                                    <span className="text-yellow-400 font-medium">{detail.run.tested_todo_count}/{detail.run.todo_count} Tested</span>
                                )}
                            </>
                        )}
                    </p>
                    {detail.run.data_start && detail.run.data_end && (
                        <p className="text-xs">
                            Data range: {detail.run.data_start} to {detail.run.data_end}
                        </p>
                    )}
                </div>

                {/* Executive Summary Drawer */}
                {detail.run.synthesis && (
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
                                    <ReactMarkdown>{detail.run.synthesis}</ReactMarkdown>
                                </div>

                                {/* Queue All button */}
                                {(() => {
                                    const queueable = todos.filter(t =>
                                        t.status === 'open' && t.mutations && Object.keys(t.mutations).length > 0
                                        && !t.recommendation_status
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
                                                    for (const group of Object.values(byTf)) {
                                                        if (group.length >= 2) {
                                                            calls.push(squashTodos(group.map(t => t.id)));
                                                        } else {
                                                            calls.push(sendTodoToOptimizer(group[0].id));
                                                        }
                                                    }
                                                    Promise.all(calls)
                                                        .catch(err => alert(`Failed to queue all: ${err.message || err}`))
                                                        .finally(() => setQueueingAll(false));
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

                {/* Phase Details */}
                {phases.length > 0 && (
                    <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                        <p className={`text-sm font-semibold mb-2 ${textPrimary}`}>Phase Details</p>
                        <div className="space-y-1">
                            {phases.map(phase => (
                                <div key={phase.phase}>
                                    <button
                                        onClick={() => togglePhase(phase.phase)}
                                        className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-sm hover:opacity-80 ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`}
                                    >
                                        <span className={textMuted}>
                                            <span className="font-mono text-xs mr-2">{phase.phase}</span>
                                            {phase.name}
                                        </span>
                                        <svg className={`w-3.5 h-3.5 transition-transform ${phasesOpen.has(phase.phase) ? 'rotate-180' : ''} ${textMuted}`}
                                             fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                                        </svg>
                                    </button>
                                    {phasesOpen.has(phase.phase) && (
                                        <div className={`px-2 py-2 mb-2 rounded text-sm ${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                                            <div className={`prose prose-sm max-w-none ${isDarkMode ? 'prose-invert' : ''}`}>
                                                <ReactMarkdown>{phase.content}</ReactMarkdown>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* TODOs */}
            <TodoList todos={todos} />
        </div>
    );
}

// Comparison view — side-by-side two runs
function CompareView({a, b, onExit}: {a: AnalysisRunDetailApi; b: AnalysisRunDetailApi; onExit: () => void}) {
    const {isDarkMode} = useTheme();
    const textMuted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
    const cardClass = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`;

    const details = [a, b];

    return (
        <div className="lg:col-span-2 space-y-4">
            {/* Comparison Header */}
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-3">
                    <h2 className={`text-lg font-semibold ${textPrimary}`}>Run Comparison</h2>
                    <button onClick={onExit} className={`px-3 py-1 rounded text-sm ${isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                        Exit Comparison
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {details.map((detail, idx) => {
                        const sc = scopeColors[detail.run.scope || 'daily'] || scopeColors.daily;
                        const tc = triggerColors[detail.run.trigger || 'ad-hoc'] || triggerColors['ad-hoc'];
                        const borderColor = idx === 0 ? 'border-cyan-500/30' : 'border-purple-500/30';
                        const labelColor = idx === 0 ? 'text-cyan-400' : 'text-purple-400';
                        return (
                            <div key={detail.run.run_id} className={`p-3 rounded border ${borderColor} ${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className={`text-xs font-bold ${labelColor}`}>{idx === 0 ? 'A' : 'B'}</span>
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text}`}>
                                        {detail.run.scope || 'daily'}
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
            {(a.run.synthesis || b.run.synthesis) && (
                <div className={cardClass}>
                    <h3 className={`text-sm font-semibold mb-3 ${textMuted}`}>Executive Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {details.map((detail, idx) => {
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
                    {details.map((detail, idx) => {
                        const borderColor = idx === 0 ? 'border-l-cyan-500' : 'border-l-purple-500';
                        const labelColor = idx === 0 ? 'text-cyan-400' : 'text-purple-400';
                        const dtodos = [...detail.todos].sort((a, b) => a.priority - b.priority);
                        return (
                            <div key={detail.run.run_id} className={`border-l-2 ${borderColor} pl-3`}>
                                <p className={`text-xs font-bold mb-2 ${labelColor}`}>
                                    {idx === 0 ? 'A' : 'B'}: {dtodos.length} TODOs
                                </p>
                                <div className="space-y-2">
                                    {dtodos.map(todo => {
                                        const prio = {
                                            1: {label: 'P1', color: 'text-red-400', bg: 'bg-red-500/20'},
                                            2: {label: 'P2', color: 'text-orange-400', bg: 'bg-orange-500/20'},
                                            3: {label: 'P3', color: 'text-yellow-400', bg: 'bg-yellow-500/20'},
                                            4: {label: 'P4', color: 'text-blue-400', bg: 'bg-blue-500/20'},
                                            5: {label: 'P5', color: 'text-gray-400', bg: 'bg-gray-500/20'},
                                        }[todo.priority] || {label: `P${todo.priority}`, color: 'text-gray-400', bg: 'bg-gray-500/20'};
                                        return (
                                            <div key={todo.id} className={`p-2 rounded ${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${prio.bg} ${prio.color}`}>
                                                        {prio.label}
                                                    </span>
                                                </div>
                                                <p className={`text-sm font-medium ${textPrimary}`}>{todo.title}</p>
                                                <p className={`text-xs mt-0.5 ${textMuted}`}>{todo.expected_impact}</p>
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
        </div>
    );
}
