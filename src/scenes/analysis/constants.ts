export const PROVIDERS = ['roundrobin', 'ollama', 'hybrid'] as const;
export type Provider = typeof PROVIDERS[number];

export const scopeColors: Record<string, { text: string; bg: string }> = {
    yearly:  {text: 'text-purple-400', bg: 'bg-purple-500/20'},
    monthly: {text: 'text-indigo-400', bg: 'bg-indigo-500/20'},
    weekly:  {text: 'text-cyan-400',   bg: 'bg-cyan-500/20'},
    daily:   {text: 'text-emerald-400', bg: 'bg-emerald-500/20'},
};

export const triggerColors: Record<string, { text: string; bg: string; label: string }> = {
    'service': {text: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Auto'},
    'api':     {text: 'text-blue-400', bg: 'bg-blue-500/20', label: 'API'},
    'ad-hoc':  {text: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Manual'},
};

export const providerColors: Record<string, { text: string; bg: string; label: string }> = {
    anthropic:  {text: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Claude'},
    ollama:     {text: 'text-sky-400',    bg: 'bg-sky-500/20',    label: 'Ollama'},
    hybrid:     {text: 'text-violet-400', bg: 'bg-violet-500/20', label: 'Hybrid'},
    roundrobin: {text: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Cloud RR'},
};

export const priorityLabels: Record<number, { label: string; color: string; bg: string }> = {
    1: {label: 'P1 Critical', color: 'text-red-400', bg: 'bg-red-500/20'},
    2: {label: 'P2 High', color: 'text-orange-400', bg: 'bg-orange-500/20'},
    3: {label: 'P3 Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/20'},
    4: {label: 'P4 Info Gap', color: 'text-blue-400', bg: 'bg-blue-500/20'},
    5: {label: 'P5 Nice to Have', color: 'text-gray-400', bg: 'bg-gray-500/20'},
};

export const statusColors: Record<string, { text: string; bg: string; label: string }> = {
    open: {text: 'text-yellow-300', bg: 'bg-yellow-500/20', label: 'Open'},
    in_progress: {text: 'text-blue-300', bg: 'bg-blue-500/20', label: 'In Progress'},
    implemented: {text: 'text-emerald-300', bg: 'bg-emerald-500/20', label: 'Implemented'},
    wont_fix: {text: 'text-gray-400', bg: 'bg-gray-500/20', label: "Won't Fix"},
    obsolete: {text: 'text-gray-500', bg: 'bg-gray-500/20', label: 'Obsolete'},
};

export const categoryLabels: Record<string, string> = {
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

// Hardcoded known models — use Ollama tag names (name:tag format)
export const KNOWN_MODELS = [
    {name: 'qwen3.5:latest', label: 'Qwen 3.5 14B', size: '6.6 GB'},
    {name: 'qwen3:14b', label: 'Qwen 3 14B', size: '8.7 GB'},
    {name: 'qwen3-coder:30b', label: 'Qwen 3 Coder 30B', size: '18 GB'},
] as const;
