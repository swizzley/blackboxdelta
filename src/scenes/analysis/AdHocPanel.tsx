import {useState, useEffect} from 'react';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {triggerAnalysisRun, fetchAnalysisJobs, stopAnalysisJob, createPromptRecommendation, type AnalysisJob} from '../../api/client';
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

    // Hypothesis testing
    const [optPrompt, setOptPrompt] = useState('');
    const [optPromptTf, setOptPromptTf] = useState('daily');
    const [optPromptSending, setOptPromptSending] = useState(false);
    const [optPromptResult, setOptPromptResult] = useState<{ok: boolean; msg: string} | null>(null);

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

    const submitHypothesis = () => {
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
    };

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

            {/* Optimizer Hypothesis */}
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
                            placeholder="e.g. try daily with trailing stop of 1.0, or loosen 1m min_confidence to 0.45"
                            className={`w-full px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600 placeholder-slate-500' : 'bg-white text-gray-900 border-gray-300 placeholder-gray-400'}`}
                            onKeyDown={e => { if (e.key === 'Enter') submitHypothesis(); }}
                        />
                    </div>
                    <div className="min-w-[100px]">
                        <select
                            value={optPromptTf}
                            onChange={e => setOptPromptTf(e.target.value)}
                            className={`w-full px-3 py-1.5 rounded text-sm border ${isDarkMode ? 'bg-slate-800 text-gray-200 border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                        >
                            <option value="1m">1m</option>
                            <option value="5m">5m</option>
                            <option value="15m">15m</option>
                            <option value="1h">1h</option>
                            <option value="4h">4h</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                        </select>
                    </div>
                    <button
                        onClick={submitHypothesis}
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
        </>
    );
}
