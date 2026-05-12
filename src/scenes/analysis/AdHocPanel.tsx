import {useState, useEffect} from 'react';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {triggerAnalysisRun, fetchAnalysisJobs, stopAnalysisJob, type AnalysisJob} from '../../api/client';
import {PROVIDERS, KNOWN_MODELS, type Provider} from './constants';

function defaultMarketDay(): string {
    const d = new Date();
    // Walk back to the most recent weekday
    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() - 1);
    }
    return d.toISOString().slice(0, 10);
}

interface Props {
    onRunComplete: () => void;
}

export default function AdHocPanel({onRunComplete}: Props) {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const textMuted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const cardClass = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`;

    const [runProvider, setRunProvider] = useState<Provider>('roundrobin');
    const [selectedModel, setSelectedModel] = useState<string>(KNOWN_MODELS[0].name);
    const [hybridAnthropicModel, setHybridAnthropicModel] = useState('claude-sonnet-4-20250514');
    const [runFrom, setRunFrom] = useState(() => defaultMarketDay());
    const [runTo, setRunTo] = useState(() => defaultMarketDay());
    const [runTimeframe, setRunTimeframe] = useState('');
    const [runningJob, setRunningJob] = useState<AnalysisJob | null>(null);

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
                        onRunComplete();
                    }
                }
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [runningJob, onRunComplete]);

    return (
        <>
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
                            <option value="1m">1m</option>
                            <option value="5m">5m</option>
                            <option value="15m">15m</option>
                            <option value="1h">1h</option>
                            <option value="4h">4h</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
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
                    {runProvider !== 'roundrobin' && (
                        <div className="flex-1 min-w-[200px]">
                            <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Model</label>
                            <select
                                value={selectedModel}
                                onChange={e => setSelectedModel(e.target.value)}
                                className={`w-full px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                            >
                                {KNOWN_MODELS.map(m => (
                                    <option key={m.name} value={m.name}>{m.label} ({m.size})</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {runProvider === 'roundrobin' && (
                        <div className="flex-1 min-w-[200px]">
                            <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Model</label>
                            <div className={`px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-400 border-slate-600' : 'bg-gray-50 text-gray-500 border-gray-300'}`}>
                                Cloud RR (8 providers, 70B-class)
                            </div>
                        </div>
                    )}
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
                                        runProvider === 'roundrobin' ? 'roundrobin' : selectedModel,
                                        runFrom,
                                        runTo,
                                        runProvider,
                                        runProvider === 'hybrid' ? hybridAnthropicModel : undefined,
                                        runTimeframe || undefined,
                                    ).then(job => {
                                        if (job) setRunningJob(job);
                                    }).catch(err => alert(`Failed: ${err.message || err}`));
                                }}
                                disabled={(!selectedModel && runProvider !== 'roundrobin') || !runFrom || !runTo}
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

        </>
    );
}
