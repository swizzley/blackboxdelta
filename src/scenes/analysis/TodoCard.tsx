import dayjs from 'dayjs';
import {useTheme} from '../../context/Theme';
import type {AnalysisTodoApi} from '../../context/Types';
import {priorityLabels, statusColors, categoryLabels} from './constants';

function buildTodoPrompt(todo: AnalysisTodoApi): string {
    let prompt = `## Analysis TODO: ${todo.title}\n\n`;
    prompt += `**Priority:** ${priorityLabels[todo.priority]?.label || `P${todo.priority}`}\n`;
    prompt += `**Category:** ${categoryLabels[todo.category] || todo.category}\n`;
    prompt += `**Complexity:** ${todo.complexity}\n\n`;
    prompt += `**Description:** ${todo.description}\n\n`;
    prompt += `**Expected Impact:** ${todo.expected_impact}\n\n`;
    prompt += `**Evidence:** ${todo.evidence}\n\n`;
    if (todo.affected_files.length > 0) {
        prompt += `**Affected Files:** ${todo.affected_files.join(', ')}\n\n`;
    }
    if (todo.mutations && Object.keys(todo.mutations).length > 0) {
        prompt += `**Proposed Changes:**\n`;
        for (const [k, v] of Object.entries(todo.mutations).sort(([a], [b]) => a.localeCompare(b))) {
            const old = todo.current_values?.[k];
            if (old != null) prompt += `- ${k}: ${old} → ${v}\n`;
            else prompt += `- ${k} = ${v}\n`;
        }
    }
    return prompt;
}

interface Props {
    todo: AnalysisTodoApi;
    isExpanded: boolean;
    onToggleExpand: () => void;
    isSending: boolean;
    isSent: boolean;
    isSelectedForSquash: boolean;
    onSend: () => void;
    onToggleSquash: () => void;
    copiedId: number | null;
    onCopy: (id: number) => void;
}

export default function TodoCard({todo, isExpanded, onToggleExpand, isSending, isSent, isSelectedForSquash, onSend, onToggleSquash, copiedId, onCopy}: Props) {
    const {isDarkMode} = useTheme();
    const textMuted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
    const cardClass = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`;

    const sc = statusColors[todo.status] || statusColors.open;
    const isTestedOrQueued = !!(todo.recommendation_status || isSent);

    return (
        <div className={`${cardClass} transition-all ${isTestedOrQueued ? 'opacity-50' : ''}`}>
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 cursor-pointer hover:opacity-80"
                 onClick={onToggleExpand}>
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
                        {(todo.recommendation_status === 'pending' || isSent) && !['passed','failed','running','queued'].includes(todo.recommendation_status ?? '') && (
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
                        {/* Copy as Prompt — for code-change TODOs without mutations */}
                        {(!todo.mutations || Object.keys(todo.mutations).length === 0) && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const prompt = buildTodoPrompt(todo);
                                        navigator.clipboard.writeText(prompt).then(() => onCopy(todo.id));
                                    }}
                                    className="px-3 py-1 rounded text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white"
                                >
                                    {copiedId === todo.id ? 'Copied!' : 'Copy as Prompt'}
                                </button>
                                <span className={`text-xs ${textMuted}`}>Paste into Claude Code to implement</span>
                            </div>
                        )}
                        {todo.mutations && Object.keys(todo.mutations).length > 0 && (
                            <div className={`mt-3 rounded overflow-hidden border ${isDarkMode ? 'border-slate-600' : 'border-gray-300'}`}>
                                <div className={`px-3 py-1.5 text-xs font-medium flex items-center justify-between ${isDarkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                    <span>Proposed Changes</span>
                                    {!todo.recommendation_status && !isSent && (
                                        <label className="flex items-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelectedForSquash}
                                                onChange={onToggleSquash}
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
                                    ) : isSent || todo.recommendation_status === 'pending' ? (
                                        <span className="text-xs text-blue-400">Queued for backtest</span>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSend();
                                            }}
                                            disabled={isSending}
                                            className="px-3 py-1 rounded text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSending ? 'Sending...' : 'Queue for Backtest'}
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
}
