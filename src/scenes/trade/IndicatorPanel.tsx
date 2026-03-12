import {useState, useMemo} from 'react';
import {COMPONENTS, type ComponentDef, type SignalDef} from './signalMapping';
import type {Score, SignalRow} from '../../context/Types';

interface Props {
    open: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    score?: Score;
    activeIndicators: Set<string>;
    onToggle: (key: string) => void;
    onToggleAll: (keys: string[], on: boolean) => void;
    signals?: SignalRow[] | null;
    tradeTime?: string;
}

export default function IndicatorPanel({open, onClose, isDarkMode, score, activeIndicators, onToggle, onToggleAll, signals, tradeTime}: Props) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    if (!open) return null;

    // Sort components by score contribution (highest first) when score exists
    const sorted = [...COMPONENTS];
    if (score) {
        sorted.sort((a, b) => {
            const aVal = Math.abs((score[a.scoreKey] as number) ?? 0);
            const bVal = Math.abs((score[b.scoreKey] as number) ?? 0);
            return bVal - aVal;
        });
    }

    // Compute top contributor per component from signal data at trade time
    const topContributors = useMemo(() => {
        const tops = new Map<string, string>(); // component key → signal key
        if (!signals || signals.length === 0 || !tradeTime) return tops;

        // Find the signal row closest to trade entry time
        const tradeMs = new Date(tradeTime).getTime();
        let closest = signals[0];
        let minDiff = Infinity;
        for (const row of signals) {
            const t = typeof row.t === 'number' ? row.t : new Date(row.t as string).getTime();
            const diff = Math.abs(t - tradeMs);
            if (diff < minDiff) {
                minDiff = diff;
                closest = row;
            }
        }

        for (const comp of COMPONENTS) {
            let bestKey = '';
            let bestAbs = 0;
            for (const sig of comp.signals) {
                const v = closest[sig.key];
                if (typeof v !== 'number' || v === 0) continue;
                // For overlays/oscillators, use absolute value. For events, any nonzero is meaningful.
                const magnitude = sig.type === 'event' ? Math.abs(v) : Math.abs(v);
                if (magnitude > bestAbs) {
                    bestAbs = magnitude;
                    bestKey = sig.key;
                }
            }
            if (bestKey) tops.set(comp.key, bestKey);
        }
        return tops;
    }, [signals, tradeTime]);

    const toggleSection = (key: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const activeCount = activeIndicators.size;

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/30" />
            <div
                className={`relative w-80 max-w-full h-full overflow-y-auto shadow-2xl ${
                    isDarkMode ? 'bg-slate-900 text-gray-200' : 'bg-white text-gray-800'
                }`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`sticky top-0 z-10 px-4 py-3 border-b ${
                    isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
                }`}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold">Indicators</h2>
                        <div className="flex items-center gap-2">
                            {activeCount > 0 && (
                                <span className="text-xs bg-cyan-600 text-white rounded-full px-2 py-0.5">
                                    {activeCount}
                                </span>
                            )}
                            <button
                                onClick={onClose}
                                className={`text-lg leading-none px-1 rounded hover:${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}
                            >
                                &times;
                            </button>
                        </div>
                    </div>
                </div>

                {/* Score Influence Bar */}
                {score && <ScoreInfluenceBar score={score} isDarkMode={isDarkMode} onClickComponent={(key) => {
                    // Expand and toggle all for that component
                    setExpanded(prev => new Set([...prev, key]));
                    const comp = COMPONENTS.find(c => c.key === key);
                    if (comp) {
                        const keys = comp.signals.map(s => s.key);
                        const allActive = keys.every(k => activeIndicators.has(k));
                        onToggleAll(keys, !allActive);
                    }
                }}/>}

                {/* Component Sections */}
                <div className="px-3 py-2 space-y-1">
                    {sorted.map(comp => (
                        <ComponentSection
                            key={comp.key}
                            comp={comp}
                            isDarkMode={isDarkMode}
                            score={score}
                            expanded={expanded.has(comp.key)}
                            onToggleSection={() => toggleSection(comp.key)}
                            activeIndicators={activeIndicators}
                            onToggle={onToggle}
                            onToggleAll={onToggleAll}
                            topContributor={topContributors.get(comp.key)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function ScoreInfluenceBar({score, isDarkMode, onClickComponent}: {
    score: Score;
    isDarkMode: boolean;
    onClickComponent: (key: string) => void;
}) {
    const segments = COMPONENTS
        .map(c => ({
            key: c.key,
            label: c.label,
            color: c.color,
            value: (score[c.scoreKey] as number) ?? 0,
        }))
        .filter(s => s.value !== 0)
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    const totalAbs = segments.reduce((sum, s) => sum + Math.abs(s.value), 0);
    if (totalAbs === 0) return null;

    return (
        <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
            <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Score Influence</p>
            <div className="flex h-5 rounded overflow-hidden cursor-pointer">
                {segments.map(s => (
                    <div
                        key={s.key}
                        style={{width: `${(Math.abs(s.value) / totalAbs) * 100}%`, backgroundColor: s.color}}
                        className="relative group"
                        title={`${s.label}: ${s.value.toFixed(1)}`}
                        onClick={() => onClickComponent(s.key)}
                    >
                        <div className="absolute inset-0 opacity-0 hover:opacity-20 bg-white transition-opacity" />
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {segments.slice(0, 5).map(s => (
                    <span key={s.key} className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full inline-block" style={{backgroundColor: s.color}} />
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                            {s.label} {s.value > 0 ? '+' : ''}{s.value.toFixed(0)}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
}

function ComponentSection({comp, isDarkMode, score, expanded, onToggleSection, activeIndicators, onToggle, onToggleAll, topContributor}: {
    comp: ComponentDef;
    isDarkMode: boolean;
    score?: Score;
    expanded: boolean;
    onToggleSection: () => void;
    activeIndicators: Set<string>;
    onToggle: (key: string) => void;
    onToggleAll: (keys: string[], on: boolean) => void;
    topContributor?: string;
}) {
    const scoreVal = score ? (score[comp.scoreKey] as number) : undefined;
    const allKeys = comp.signals.map(s => s.key);
    const activeInSection = allKeys.filter(k => activeIndicators.has(k)).length;
    const allActive = activeInSection === allKeys.length && allKeys.length > 0;

    return (
        <div className={`rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
            {/* Section Header */}
            <button
                onClick={onToggleSection}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:${
                    isDarkMode ? 'bg-slate-700/50' : 'bg-gray-100'
                } transition-colors`}
            >
                <span className="text-xs" style={{color: comp.color}}>
                    {expanded ? '\u25BC' : '\u25B6'}
                </span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: comp.color}} />
                <span className={`text-sm font-medium flex-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    {comp.label}
                </span>
                {scoreVal !== undefined && (
                    <span className={`text-xs font-mono ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {scoreVal.toFixed(1)}
                    </span>
                )}
                {activeInSection > 0 && (
                    <span className="text-xs bg-cyan-600/80 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                        {activeInSection}
                    </span>
                )}
            </button>

            {/* Expanded Content */}
            {expanded && (
                <div className={`px-3 pb-3 pt-1 border-t ${isDarkMode ? 'border-slate-700/50' : 'border-gray-200/50'}`}>
                    {/* Toggle All */}
                    <button
                        onClick={() => onToggleAll(allKeys, !allActive)}
                        className={`text-xs mb-2 px-2 py-1 rounded ${
                            allActive
                                ? 'bg-cyan-600 text-white'
                                : isDarkMode
                                    ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        } transition-colors`}
                    >
                        {allActive ? 'Hide All' : 'Show All'}
                    </button>

                    {/* Signal Toggles */}
                    <div className="grid grid-cols-2 gap-1">
                        {comp.signals.map(sig => (
                            <SignalToggle
                                key={sig.key}
                                signal={sig}
                                active={activeIndicators.has(sig.key)}
                                onToggle={() => onToggle(sig.key)}
                                isDarkMode={isDarkMode}
                                isTopContributor={sig.key === topContributor}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SignalToggle({signal, active, onToggle, isDarkMode, isTopContributor}: {
    signal: SignalDef;
    active: boolean;
    onToggle: () => void;
    isDarkMode: boolean;
    isTopContributor?: boolean;
}) {
    return (
        <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left transition-colors ${
                active
                    ? 'bg-cyan-600/20 text-cyan-400'
                    : isDarkMode
                        ? 'text-gray-400 hover:bg-slate-700/50'
                        : 'text-gray-500 hover:bg-gray-100'
            } ${isTopContributor ? (isDarkMode ? 'ring-1 ring-amber-500/50' : 'ring-1 ring-amber-400/60') : ''}`}
            title={isTopContributor ? 'Strongest signal in this group at trade entry' : undefined}
        >
            <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? '' : 'opacity-40'}`}
                style={{backgroundColor: signal.color}}
            />
            <span className="truncate">{signal.label}</span>
            {isTopContributor && <span className="text-amber-400 flex-shrink-0 ml-auto text-[10px]">&#9733;</span>}
        </button>
    );
}
