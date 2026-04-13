import {useCallback} from 'react';
import dayjs from 'dayjs';
import {useTheme} from '../../context/Theme';
import type {AnalysisRunApi} from '../../context/Types';
import {scopeColors, triggerColors, providerColors} from './constants';

interface Props {
    runs: AnalysisRunApi[];
    selectedRunId: string | null;
    compareRunId: string | null;
    onSelectRun: (runId: string) => void;
    onCompareRun: (runId: string | null) => void;
    scopeFilter: string;
    onScopeFilterChange: (scope: string) => void;
    providerFilter: string;
    onProviderFilterChange: (provider: string) => void;
}

export default function RunList({runs, selectedRunId, compareRunId, onSelectRun, onCompareRun, scopeFilter, onScopeFilterChange, providerFilter, onProviderFilterChange}: Props) {
    const {isDarkMode} = useTheme();
    const textMuted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';

    const filtered = runs.filter(r => {
        if (scopeFilter && r.scope !== scopeFilter) return false;
        if (providerFilter && r.provider !== providerFilter) return false;
        return true;
    });

    const renderRunRow = useCallback((run: AnalysisRunApi) => {
        const sc = scopeColors[run.scope || 'daily'] || scopeColors.daily;
        const tc = triggerColors[run.trigger || 'ad-hoc'] || triggerColors['ad-hoc'];
        const pc = providerColors[run.provider] || providerColors.ollama;
        const isActive = selectedRunId === run.run_id;
        const isCompare = compareRunId === run.run_id;
        const isSkipped = run.skipped === true;

        return (
            <div
                key={run.run_id}
                onClick={() => onSelectRun(run.run_id)}
                className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer rounded text-sm transition-colors
                    ${isActive
                        ? `${isDarkMode ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'bg-cyan-50 ring-1 ring-cyan-300'}`
                        : isCompare
                        ? `${isDarkMode ? 'bg-purple-500/10 ring-1 ring-purple-500/30' : 'bg-purple-50 ring-1 ring-purple-300'}`
                        : isSkipped
                        ? `${isDarkMode ? 'bg-gray-800/60 opacity-60' : 'bg-gray-100/80 opacity-60'}`
                        : `${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`
                    }`}
            >
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${pc.bg} ${pc.text} flex-shrink-0`}>
                    {pc.label}
                </span>
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text} flex-shrink-0`}>
                    {(run.scope || 'daily').charAt(0).toUpperCase() + (run.scope || 'daily').slice(1)}
                </span>
                {run.trigger === 'service' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${tc.bg} ${tc.text} flex-shrink-0`}>
                        {tc.label}
                    </span>
                )}
                <span className={`${isActive ? 'text-cyan-400' : isCompare ? 'text-purple-400' : isSkipped ? (isDarkMode ? 'text-gray-500' : 'text-gray-400') : textPrimary} flex-1 min-w-0 truncate`}>
                    {dayjs(run.created_at).format('MMM D, h:mm A')}
                    {isSkipped && <span className="ml-1.5 text-[10px] text-gray-500">Skipped</span>}
                </span>
                {isSkipped && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-600/40 text-gray-400 font-mono flex-shrink-0">SKIP</span>
                )}
                {!isSkipped && <span className={`text-xs ${textMuted} flex-shrink-0`}>
                    {run.order_count} orders
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
                {/* Compare button */}
                {selectedRunId && !isActive && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCompareRun(isCompare ? null : run.run_id);
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
    }, [isDarkMode, selectedRunId, compareRunId, onSelectRun, onCompareRun, textMuted, textPrimary]);

    const cardClass = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`;

    return (
        <div className={`${cardClass} lg:col-span-1 self-start lg:sticky lg:top-4`}>
            <h2 className={`text-sm font-semibold mb-3 ${textMuted}`}>
                Analysis Runs
            </h2>

            {/* Filters */}
            <div className="flex gap-2 mb-3">
                <select
                    value={scopeFilter}
                    onChange={e => onScopeFilterChange(e.target.value)}
                    className={`flex-1 px-2 py-1 rounded text-xs border ${isDarkMode ? 'bg-slate-700 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                >
                    <option value="">All Scopes</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                </select>
                <select
                    value={providerFilter}
                    onChange={e => onProviderFilterChange(e.target.value)}
                    className={`flex-1 px-2 py-1 rounded text-xs border ${isDarkMode ? 'bg-slate-700 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                >
                    <option value="">All Providers</option>
                    <option value="roundrobin">Cloud RR</option>
                    <option value="ollama">Ollama</option>
                    <option value="hybrid">Hybrid</option>
                </select>
            </div>

            <div className="space-y-0.5 -mx-2 max-h-[70vh] overflow-y-auto">
                {filtered.length === 0 && (
                    <p className={`text-center py-4 text-sm ${textMuted}`}>No runs match filters</p>
                )}
                {filtered.map(run => renderRunRow(run))}
            </div>
            <p className={`text-xs mt-2 ${textMuted}`}>{filtered.length} of {runs.length} runs</p>
        </div>
    );
}
