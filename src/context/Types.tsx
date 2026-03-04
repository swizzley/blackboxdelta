// Dashboard (homepage) data
export interface DashboardData {
    generated: string;
    all_time: TimeframeStats;
    by_timeframe: TimeframeRow[];
    pl_series: PLDataPoint[];
    direction_series: DirectionDataPoint[];
    score_series: ScoreDataPoint[];
    recommendation_counts?: Record<string, number>;
}

export interface DirectionDataPoint {
    date: string;
    long_wins: number;
    long_losses: number;
    short_wins: number;
    short_losses: number;
    long_pl: number;
    short_pl: number;
}

export interface TimeframeStats {
    total_orders: number;
    pending: number;
    open_positions: number;
    closed_orders: number;
    total_pl: number;
    winners: number;
    losers: number;
    breakeven: number;
    win_loss_ratio: number | null;
    win_rate_pct: number | null;
    avg_win: number | null;
    avg_loss: number | null;
    avg_time_in_trade_mins: number | null;
    long_pl: number;
    short_pl: number;
}

export interface TimeframeRow extends TimeframeStats {
    timeframe: string;
}

export interface PLDataPoint {
    date: string;
    cumulative_pl: number;
    daily_pl: number;
}

// Calendar index
export interface CalendarDay {
    pl: number;
    winners: number;
    losers: number;
    total: number;
}

export type CalendarData = Record<string, CalendarDay>;

// Day detail
export interface DayData {
    date: string;
    summary: TimeframeStats & { by_timeframe: TimeframeRow[] };
    hours: HourBlock[];
}

export interface HourBlock {
    hour: number;
    summary: TimeframeStats;
    orders: OrderDetail[];
}

// Order (list view)
export interface OrderSummary {
    id: string;
    symbol: string;
    direction: string;
    timeframe: string;
    status: string;
    profit: number | null;
    created: string;
    closed: string | null;
}

// Order (full detail)
export interface OrderDetail {
    id: string;
    trade_id?: string;
    symbol: string;
    direction: string;
    timeframe: string;
    status: string;
    type: string;
    entry: number;
    exit?: number;
    stop_loss: number;
    take_profit: number;
    quantity: number;
    profit: number | null;
    created: string;
    closed: string | null;
    duration_mins: number | null;
    alert_id?: number;
    risk_reward?: number;
    candles?: Candle[];
    score?: Score;
    versions?: Record<string, { sha: string; message: string }>;
}

export interface Candle {
    t: string;   // ISO timestamp
    o: number;
    h: number;
    l: number;
    c: number;
}

// Score from the 11-component SQL scoring pipeline
export interface Score {
    trend_score: number;
    ma_score: number;
    crossover_score: number;
    oscillator_score: number;
    volatility_score: number;
    volume_score: number;
    fib_stack_score: number;
    momentum_projection_score: number;
    structure_score: number;
    cycle_score: number;
    pattern_score: number;
    final_score: number;
    confidence: number;
    entry_price: number;
    stop_price: number;
    tp_price: number;
    risk_reward: number;
    recommendation: string;
}

// Daily-aggregated score averages for dashboard chart
export interface ScoreDataPoint {
    date: string;
    avg_final_score: number;
    avg_confidence: number;
    avg_trend: number;
    avg_ma: number;
    avg_crossover: number;
    avg_oscillator: number;
    avg_volatility: number;
    avg_volume: number;
    avg_fib_stack: number;
    avg_momentum_projection: number;
    avg_structure: number;
    avg_cycle: number;
    avg_pattern: number;
    count: number;
}
