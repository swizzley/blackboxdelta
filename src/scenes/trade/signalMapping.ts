import {Score} from '../../context/Types';

export interface SignalDef {
    key: string;
    label: string;
    type: 'overlay' | 'oscillator' | 'event';
    range?: [number, number];
    group?: string;
    color: string;
    lineWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface ComponentDef {
    key: string;
    label: string;
    color: string;
    scoreKey: keyof Score;
    signals: SignalDef[];
}

// Helper to generate MA signals for a family — thin and transparent to not obscure candles
function maFamily(prefix: string, label: string, color: string, periods: number[]): SignalDef[] {
    // Convert hex color to rgba with low opacity
    const toRgba = (hex: string, alpha: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };
    return periods.map((p) => ({
        key: `${prefix.toLowerCase()}_${p}`,
        label: `${label} ${p}`,
        type: 'overlay' as const,
        color: toRgba(color, 0.35),
        lineWidth: 1,
    }));
}

export const COMPONENTS: ComponentDef[] = [
    {
        key: 'trend', label: 'Trend', color: '#6366f1', scoreKey: 'trend_score',
        signals: [
            {key: 'adx_value', label: 'ADX', type: 'oscillator', range: [0, 100], group: 'adx', color: '#a78bfa'},
            {key: 'adx_diplus', label: 'ADX +DI', type: 'oscillator', range: [0, 100], group: 'adx', color: '#22c55e'},
            {key: 'adx_diminus', label: 'ADX -DI', type: 'oscillator', range: [0, 100], group: 'adx', color: '#ef4444'},
            {key: 'aroon', label: 'Aroon', type: 'oscillator', range: [-100, 100], color: '#818cf8'},
            {key: 'linreg_angle', label: 'LinReg Angle', type: 'oscillator', color: '#c4b5fd'},
            {key: 'linreg_slope', label: 'LinReg Slope', type: 'oscillator', color: '#ddd6fe'},
            {key: 'macd_value', label: 'MACD', type: 'oscillator', group: 'macd', color: '#3b82f6'},
            {key: 'macd_signal', label: 'MACD Signal', type: 'oscillator', group: 'macd', color: '#f97316'},
            {key: 'macd_histogram', label: 'MACD Hist', type: 'oscillator', group: 'macd', color: '#64748b'},
            {key: 'momentum', label: 'Momentum', type: 'oscillator', color: '#8b5cf6'},
            {key: 'roc_value', label: 'ROC', type: 'oscillator', color: '#a855f7'},
            {key: 'mama', label: 'MAMA', type: 'overlay', color: '#7c3aed'},
            {key: 'fama', label: 'FAMA', type: 'overlay', color: '#c084fc'},
            {key: 'ht_trendline', label: 'HT Trendline', type: 'overlay', color: '#a78bfa'},
            {key: 'trix', label: 'TRIX', type: 'oscillator', color: '#6d28d9'},
            {key: 'ema_55', label: 'EMA 55', type: 'overlay', color: '#818cf8'},
            {key: 'ema_200', label: 'EMA 200', type: 'overlay', color: '#6366f1', lineWidth: 2},
            {key: 'sma_200', label: 'SMA 200', type: 'overlay', color: '#4f46e5', lineWidth: 2},
        ],
    },
    {
        key: 'ma', label: 'Moving Averages', color: '#8b5cf6', scoreKey: 'ma_score',
        signals: [
            ...maFamily('ema', 'EMA', '#f59e0b', [3, 5, 8, 13, 21, 55, 100, 200]),
            ...maFamily('dema', 'DEMA', '#06b6d4', [3, 5, 8, 13, 21, 55, 100, 200]),
            ...maFamily('tema', 'TEMA', '#10b981', [3, 5, 8, 13, 21, 55, 100, 200]),
            ...maFamily('kama', 'KAMA', '#ec4899', [3, 5, 8, 13, 21, 55, 100, 200]),
            ...maFamily('t3', 'T3', '#f97316', [3, 5, 8, 13, 21, 55, 100, 200]),
            ...maFamily('trima', 'TRIMA', '#14b8a6', [3, 5, 8, 13, 21, 55, 100, 200]),
            ...maFamily('wma', 'WMA', '#a855f7', [3, 5, 8, 13, 21, 55, 100, 200]),
            ...maFamily('sma', 'SMA', '#e2e8f0', [5, 10, 15, 50, 100, 200]),
        ],
    },
    {
        key: 'crossover', label: 'Crossover', color: '#a78bfa', scoreKey: 'crossover_score',
        signals: [
            // Crossover is computed from comparing adjacent bars — no dedicated columns.
            // Show the underlying indicators used for crossover detection.
            {key: 'avg', label: 'Avg Price', type: 'overlay', color: '#d4d4d8'},
            {key: 'sma_100', label: 'SMA 100', type: 'overlay', color: '#a1a1aa', lineWidth: 2},
            {key: 'sma_200', label: 'SMA 200', type: 'overlay', color: '#71717a', lineWidth: 2},
            {key: 'ema_100', label: 'EMA 100', type: 'overlay', color: '#fbbf24', lineWidth: 2},
            {key: 'ema_200', label: 'EMA 200', type: 'overlay', color: '#f59e0b', lineWidth: 2},
            {key: 'ht_sine', label: 'HT Sine', type: 'oscillator', range: [-1, 1], group: 'ht_sine', color: '#c084fc'},
            {key: 'ht_leadsine', label: 'HT Lead Sine', type: 'oscillator', range: [-1, 1], group: 'ht_sine', color: '#e879f9'},
        ],
    },
    {
        key: 'oscillator', label: 'Oscillator', color: '#f59e0b', scoreKey: 'oscillator_score',
        signals: [
            {key: 'rsi', label: 'RSI', type: 'oscillator', range: [0, 100], group: 'rsi', color: '#06b6d4'},
            {key: 'stoch_krsi', label: 'Stoch RSI K', type: 'oscillator', range: [0, 100], group: 'rsi', color: '#22d3ee'},
            {key: 'stoch_drsi', label: 'Stoch RSI D', type: 'oscillator', range: [0, 100], group: 'rsi', color: '#67e8f9'},
            {key: 'stoch_k', label: 'Stoch K', type: 'oscillator', range: [0, 100], group: 'stoch', color: '#3b82f6'},
            {key: 'stoch_d', label: 'Stoch D', type: 'oscillator', range: [0, 100], group: 'stoch', color: '#60a5fa'},
            {key: 'stoch_kfast', label: 'Stoch Fast K', type: 'oscillator', range: [0, 100], group: 'stoch', color: '#93c5fd'},
            {key: 'stoch_dfast', label: 'Stoch Fast D', type: 'oscillator', range: [0, 100], group: 'stoch', color: '#bfdbfe'},
            {key: 'cci', label: 'CCI', type: 'oscillator', group: 'cci', color: '#f59e0b'},
            {key: 'willr', label: 'Williams %R', type: 'oscillator', range: [-100, 0], group: 'willr', color: '#ef4444'},
            {key: 'mfi', label: 'MFI', type: 'oscillator', range: [0, 100], group: 'mfi', color: '#10b981'},
            {key: 'cmo', label: 'CMO', type: 'oscillator', range: [-100, 100], group: 'cmo', color: '#8b5cf6'},
            {key: 'apo', label: 'APO', type: 'oscillator', group: 'apo', color: '#ec4899'},
            {key: 'ppo', label: 'PPO', type: 'oscillator', group: 'ppo', color: '#f472b6'},
            {key: 'bop', label: 'BOP', type: 'oscillator', range: [-1, 1], group: 'bop', color: '#14b8a6'},
            {key: 'ultosc', label: 'Ultimate Osc', type: 'oscillator', range: [0, 100], group: 'ultosc', color: '#a855f7'},
        ],
    },
    {
        key: 'volatility', label: 'Volatility', color: '#ef4444', scoreKey: 'volatility_score',
        signals: [
            {key: 'bollinger_top', label: 'BB Upper', type: 'overlay', color: '#3b82f680', lineStyle: 'dashed'},
            {key: 'bollinger_mid', label: 'BB Mid', type: 'overlay', color: '#3b82f640', lineStyle: 'dotted'},
            {key: 'bollinger_bottom', label: 'BB Lower', type: 'overlay', color: '#3b82f680', lineStyle: 'dashed'},
            {key: 'atr', label: 'ATR', type: 'oscillator', group: 'atr', color: '#ef4444'},
            {key: 'natr', label: 'NATR', type: 'oscillator', group: 'natr', color: '#f87171'},
            {key: 'stddev', label: 'StdDev', type: 'oscillator', group: 'stddev', color: '#fca5a5'},
            {key: 'sar', label: 'SAR', type: 'overlay', color: '#facc15'},
            {key: 'sar_ext', label: 'SAR Ext', type: 'overlay', color: '#fde047'},
            {key: 'linreg_value', label: 'LinReg', type: 'overlay', color: '#fb923c'},
        ],
    },
    {
        key: 'volume', label: 'Volume', color: '#3b82f6', scoreKey: 'volume_score',
        signals: [
            {key: 'obv', label: 'OBV', type: 'oscillator', group: 'volume', color: '#3b82f6'},
            {key: 'chainosc', label: 'Chaikin Osc', type: 'oscillator', group: 'volume', color: '#60a5fa'},
            {key: 'adl', label: 'A/D Line', type: 'oscillator', group: 'volume', color: '#93c5fd'},
        ],
    },
    {
        key: 'fib_stack', label: 'Fib Stack', color: '#14b8a6', scoreKey: 'fib_stack_score',
        signals: [
            // Fib-period MAs (3,5,8,13,21,55) — uses same columns as MA component
            ...maFamily('tema', 'TEMA', '#10b981', [3, 5, 8, 13, 21, 55]),
            ...maFamily('dema', 'DEMA', '#06b6d4', [3, 5, 8, 13, 21, 55]),
            ...maFamily('ema', 'EMA', '#f59e0b', [3, 5, 8, 13, 21, 55]),
            ...maFamily('t3', 'T3', '#f97316', [3, 5, 8, 13, 21, 55]),
            ...maFamily('kama', 'KAMA', '#ec4899', [3, 5, 8, 13, 21]),
            ...maFamily('wma', 'WMA', '#a855f7', [3, 5, 8, 13, 21]),
        ],
    },
    {
        key: 'momentum_projection', label: 'Momentum Projection', color: '#f97316', scoreKey: 'momentum_projection_score',
        signals: [
            {key: 'tsf', label: 'TSF', type: 'overlay', color: '#f97316'},
            {key: 'ema_3', label: 'EMA 3', type: 'overlay', color: '#fb923c'},
            {key: 'tema_3', label: 'TEMA 3', type: 'overlay', color: '#fdba74'},
            {key: 'linreg_slope', label: 'LinReg Slope', type: 'oscillator', color: '#c2410c'},
            {key: 'mama', label: 'MAMA', type: 'overlay', color: '#7c3aed'},
            {key: 'fama', label: 'FAMA', type: 'overlay', color: '#c084fc'},
            {key: 'macdfix_value', label: 'MACD Fix', type: 'oscillator', group: 'macdfix', color: '#ea580c'},
            {key: 'macdfix_signal', label: 'MACD Fix Signal', type: 'oscillator', group: 'macdfix', color: '#fb923c'},
            {key: 'macdfix_histogram', label: 'MACD Fix Hist', type: 'oscillator', group: 'macdfix', color: '#64748b'},
        ],
    },
    {
        key: 'structure', label: 'Structure', color: '#ec4899', scoreKey: 'structure_score',
        signals: [
            {key: 'support_major', label: 'Support Major', type: 'overlay', color: '#22c55e', lineWidth: 2, lineStyle: 'dashed'},
            {key: 'support_minor', label: 'Support Minor', type: 'overlay', color: '#22c55e80', lineStyle: 'dotted'},
            {key: 'resistance_major', label: 'Resistance Major', type: 'overlay', color: '#ef4444', lineWidth: 2, lineStyle: 'dashed'},
            {key: 'resistance_minor', label: 'Resistance Minor', type: 'overlay', color: '#ef444480', lineStyle: 'dotted'},
            {key: 'linreg_value', label: 'LinReg Value', type: 'overlay', color: '#fb923c'},
            {key: 'linreg_intercept', label: 'LinReg Intercept', type: 'overlay', color: '#fdba74'},
        ],
    },
    {
        key: 'cycle', label: 'Cycle', color: '#84cc16', scoreKey: 'cycle_score',
        signals: [
            {key: 'ht_dcphase', label: 'HT Phase', type: 'oscillator', group: 'ht_cycle', color: '#84cc16'},
            {key: 'ht_dcperiod', label: 'HT Period', type: 'oscillator', group: 'ht_period', color: '#a3e635'},
            {key: 'ht_sine', label: 'HT Sine', type: 'oscillator', range: [-1, 1], group: 'ht_sine', color: '#bef264'},
            {key: 'ht_leadsine', label: 'HT Lead Sine', type: 'oscillator', range: [-1, 1], group: 'ht_sine', color: '#d9f99d'},
        ],
    },
    {
        key: 'pattern', label: 'Candle Patterns', color: '#06b6d4', scoreKey: 'pattern_score',
        signals: [
            // Tier 3 (weight 3)
            {key: 'cdl_abandonedbaby', label: 'Abandoned Baby', type: 'event', color: '#06b6d4'},
            {key: 'cdl_concealbabyswallow', label: 'Conceal Baby Swallow', type: 'event', color: '#06b6d4'},
            {key: 'cdl_uniquethreeriver', label: 'Unique Three River', type: 'event', color: '#06b6d4'},
            {key: 'cdl_threestarsinSouth', label: 'Three Stars South', type: 'event', color: '#06b6d4'},
            {key: 'cdl_kicking', label: 'Kicking', type: 'event', color: '#06b6d4'},
            {key: 'cdl_kickingbylength', label: 'Kicking By Length', type: 'event', color: '#06b6d4'},
            // Tier 2 (weight 2)
            {key: 'cdl_morningstar', label: 'Morning Star', type: 'event', color: '#22d3ee'},
            {key: 'cdl_eveningstar', label: 'Evening Star', type: 'event', color: '#22d3ee'},
            {key: 'cdl_morningdojistar', label: 'Morning Doji Star', type: 'event', color: '#22d3ee'},
            {key: 'cdl_eveningdojistar', label: 'Evening Doji Star', type: 'event', color: '#22d3ee'},
            {key: 'cdl_breakaway', label: 'Breakaway', type: 'event', color: '#22d3ee'},
            {key: 'cdl_mathold', label: 'Mat Hold', type: 'event', color: '#22d3ee'},
            {key: 'cdl_risefall3methods', label: 'Rise/Fall 3 Methods', type: 'event', color: '#22d3ee'},
            {key: 'cdl_threesoldierscrows', label: 'Three Soldiers/Crows', type: 'event', color: '#22d3ee'},
            {key: 'cdl_identicalthreecrows', label: 'Identical Three Crows', type: 'event', color: '#22d3ee'},
            {key: 'cdl_ladderbottom', label: 'Ladder Bottom', type: 'event', color: '#22d3ee'},
            {key: 'cdl_advanceblock', label: 'Advance Block', type: 'event', color: '#22d3ee'},
            {key: 'cdl_tristar', label: 'Tristar', type: 'event', color: '#22d3ee'},
            {key: 'cdl_threeinside', label: 'Three Inside', type: 'event', color: '#22d3ee'},
            {key: 'cdl_threeoutside', label: 'Three Outside', type: 'event', color: '#22d3ee'},
            {key: 'cdl_threelinestrike', label: 'Three Line Strike', type: 'event', color: '#22d3ee'},
            // Tier 1 (weight 1)
            {key: 'cdl_engulfing', label: 'Engulfing', type: 'event', color: '#67e8f9'},
            {key: 'cdl_harami', label: 'Harami', type: 'event', color: '#67e8f9'},
            {key: 'cdl_haramicross', label: 'Harami Cross', type: 'event', color: '#67e8f9'},
            {key: 'cdl_darkcloudcover', label: 'Dark Cloud Cover', type: 'event', color: '#67e8f9'},
            {key: 'cdl_piercing', label: 'Piercing', type: 'event', color: '#67e8f9'},
            {key: 'cdl_hammer', label: 'Hammer', type: 'event', color: '#67e8f9'},
            {key: 'cdl_hangingman', label: 'Hanging Man', type: 'event', color: '#67e8f9'},
            {key: 'cdl_invertedhammer', label: 'Inverted Hammer', type: 'event', color: '#67e8f9'},
            {key: 'cdl_shootingstar', label: 'Shooting Star', type: 'event', color: '#67e8f9'},
            {key: 'cdl_doji', label: 'Doji', type: 'event', color: '#67e8f9'},
            {key: 'cdl_dojistar', label: 'Doji Star', type: 'event', color: '#67e8f9'},
            {key: 'cdl_dragonflydoji', label: 'Dragonfly Doji', type: 'event', color: '#67e8f9'},
            {key: 'cdl_gravestonedoji', label: 'Gravestone Doji', type: 'event', color: '#67e8f9'},
            {key: 'cdl_longleggeddoji', label: 'Long Legged Doji', type: 'event', color: '#67e8f9'},
            {key: 'cdl_rickshawman', label: 'Rickshaw Man', type: 'event', color: '#67e8f9'},
            {key: 'cdl_spinningtop', label: 'Spinning Top', type: 'event', color: '#67e8f9'},
            {key: 'cdl_highwave', label: 'High Wave', type: 'event', color: '#67e8f9'},
            {key: 'cdl_marubozu', label: 'Marubozu', type: 'event', color: '#67e8f9'},
            {key: 'cdl_matchinglow', label: 'Matching Low', type: 'event', color: '#67e8f9'},
            {key: 'cdl_homingpigeon', label: 'Homing Pigeon', type: 'event', color: '#67e8f9'},
            {key: 'cdl_belthold', label: 'Belt Hold', type: 'event', color: '#67e8f9'},
            {key: 'cdl_counterattack', label: 'Counterattack', type: 'event', color: '#67e8f9'},
            {key: 'cdl_stalledpattern', label: 'Stalled Pattern', type: 'event', color: '#67e8f9'},
            {key: 'cdl_takuri', label: 'Takuri', type: 'event', color: '#67e8f9'},
            {key: 'cdl_twocrows', label: 'Two Crows', type: 'event', color: '#67e8f9'},
            {key: 'cdl_upsidegap2crows', label: 'Upside Gap 2 Crows', type: 'event', color: '#67e8f9'},
            {key: 'cdl_gapsideSidewhite', label: 'Gap Side White', type: 'event', color: '#67e8f9'},
            {key: 'cdl_tasukigap', label: 'Tasuki Gap', type: 'event', color: '#67e8f9'},
            {key: 'cdl_thrusting', label: 'Thrusting', type: 'event', color: '#67e8f9'},
            {key: 'cdl_inneck', label: 'In Neck', type: 'event', color: '#67e8f9'},
            {key: 'cdl_onneck', label: 'On Neck', type: 'event', color: '#67e8f9'},
            {key: 'cdl_separatinglines', label: 'Separating Lines', type: 'event', color: '#67e8f9'},
            {key: 'cdl_hikkake', label: 'Hikkake', type: 'event', color: '#67e8f9'},
            {key: 'cdl_hikkakemod', label: 'Hikkake Mod', type: 'event', color: '#67e8f9'},
            {key: 'cdl_shortline', label: 'Short Line', type: 'event', color: '#67e8f9'},
            {key: 'cdl_longline', label: 'Long Line', type: 'event', color: '#67e8f9'},
            {key: 'cdl_sticksandwich', label: 'Stick Sandwich', type: 'event', color: '#67e8f9'},
        ],
    },
];

// Lookup: signal key → component for quick reference
export const SIGNAL_TO_COMPONENT = new Map<string, string>();
for (const comp of COMPONENTS) {
    for (const sig of comp.signals) {
        if (!SIGNAL_TO_COMPONENT.has(sig.key)) {
            SIGNAL_TO_COMPONENT.set(sig.key, comp.key);
        }
    }
}

// All unique signal keys (deduped across components)
export const ALL_SIGNAL_KEYS = new Set<string>();
for (const comp of COMPONENTS) {
    for (const sig of comp.signals) {
        ALL_SIGNAL_KEYS.add(sig.key);
    }
}

// Find a signal def by key (returns first match across components)
export function findSignalDef(key: string): SignalDef | undefined {
    for (const comp of COMPONENTS) {
        const found = comp.signals.find(s => s.key === key);
        if (found) return found;
    }
    return undefined;
}

// Find the parent component for a signal key
export function findComponentForSignal(key: string): ComponentDef | undefined {
    for (const comp of COMPONENTS) {
        if (comp.signals.some(s => s.key === key)) return comp;
    }
    return undefined;
}
