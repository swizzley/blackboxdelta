// Dashboard (homepage) data
export interface DashboardData {
    generated: string;
    all_time: TimeframeStats;
    by_timeframe: TimeframeRow[];
    pl_series: PLDataPoint[];
    direction_series: DirectionDataPoint[];
    score_series: ScoreDataPoint[];
    recommendation_counts?: Record<string, number>;
    close_reason_counts?: Record<string, number>;
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
    close_reason?: string;
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
    close_reason?: string;
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
    sentiment_score: number;
    sentiment_count: number;
}

// Analysis data (from swizzley-analyzer)
export interface AnalysisData {
    runs: AnalysisRun[];
    todos: AnalysisTodo[];
}

export interface AnalysisRun {
    run_id: string;
    created_at: string;
    provider: string;
    model: string;
    order_count: number;
    todo_count: number;
    synthesis: string;
}

export interface AnalysisTodo {
    id: number;
    run_id: string;
    priority: number;
    category: string;
    title: string;
    description: string;
    expected_impact: string;
    evidence: string;
    affected_files: string[];
    complexity: string;
    status: 'open' | 'in_progress' | 'implemented' | 'wont_fix' | 'obsolete';
    implemented_at?: string;
    implemented_sha?: string;
    implemented_by?: string;
    notes?: string;
}

// API response types (from swizzley-api on genesis:8080)
export interface ApiHealth {
    status: string;
    uptime: string;
    versions: Record<string, string>;
}

export interface ApiSystem {
    status: string;
    uptime: string;
    services: ApiServiceVersion[];
    database: ApiDatabaseStats;
    markets: { total: number; enabled: number };
    sentiment?: ApiSentimentSummary;
}

export interface ApiSentimentSummary {
    total_articles: number;
    recent_articles: number;
    avg_score: number;
    pairs_covered: number;
}

export interface ApiServiceVersion {
    service: string;
    sha: string;
    message: string;
    updated_at: string;
}

export interface ApiDatabaseStats {
    orders: number;
    alerts: number;
    prices: number;
    prices_15m: number;
    prices_1m: number;
    signals: number;
    signals_15m: number;
    signals_1m: number;
}

export interface ApiDashboard {
    all_time: TimeframeStats;
    by_timeframe: TimeframeRow[];
    recommendation_counts?: Record<string, number>;
    close_reason_counts?: Record<string, number>;
    updated_at?: string;
}

export interface ApiCalendarDay {
    date: string;
    pl: number;
    winners: number;
    losers: number;
    total: number;
}

export interface ApiOrder {
    id: string;
    trade_id?: string;
    symbol: string;
    direction: string;
    timeframe: string;
    status: string;
    type: string;
    price: number;
    stop_loss: number;
    take_profit: number;
    quantity: number;
    profit: number | null;
    close_reason?: string;
    score: number | null;
    created: string;
    closed: string | null;
    alert_id?: number;
    risk_reward?: number;
}

export interface ApiAlert {
    id: number;
    time: string;
    date: string;
    symbol: string;
    strategy: string;
    timeframe: string;
    direction: string;
    score: number;
}

export interface ApiMarket {
    id: string;
    name: string;
    enabled: boolean;
}

export interface ApiSetting {
    key: string;
    value: string;
    enabled: boolean;
}

// Monitoring service types (from monitoring-service on genesis:8082)
export interface MonitorStatus {
    timestamp: string;
    market_open: boolean;
    services: Record<string, MonitorServiceInfo[]>;
    data_freshness: Record<string, MonitorDataFreshness>;
    database: Record<string, MonitorDBHealth>;
    replication: MonitorReplicationStatus;
    oanda: MonitorOandaStatus;
    ollama: MonitorOllamaStatus;
    resources: Record<string, MonitorResourceInfo>;
    optimization: MonitorOptimizationStatus;
    sentiment: MonitorSentimentStatus;
    alerts_firing: MonitorAlertEvent[];
}

export interface MonitorServiceInfo {
    name: string;
    status: string;
    uptime?: string;
    pid?: number;
    memory_mb?: number;
}

export interface MonitorDataFreshness {
    last_update: string;
    age_seconds: number;
    threshold_seconds: number;
    status: string;
    message?: string;
}

export interface MonitorDBHealth {
    connections: number;
    max_connections: number;
    lock_waits: number;
    long_queries: string[];
    disk_used_gb: number;
    status: string;
    message?: string;
}

export interface MonitorReplicationStatus {
    seconds_behind_source: number;
    io_running: boolean;
    sql_running: boolean;
    status: string;
    message?: string;
}

export interface MonitorOandaStatus {
    connected: boolean;
    balance: number;
    margin_used: number;
    margin_pct: number;
    open_trades: number;
    status: string;
    message?: string;
}

export interface MonitorOllamaStatus {
    connected: boolean;
    status: string;
    message?: string;
    models?: string[];
    vram_used_mb: number;
    vram_total_mb: number;
    vram_pct: number;
}

export interface MonitorResourceInfo {
    cpu_load_5m: number;
    cpu_count: number;
    memory_pct: number;
    disk_pct: number;
    status?: string;
    message?: string;
}

export interface MonitorOptimizationStatus {
    current_timeframe: string;
    trunk_id: number;
    generation: number;
    generation_started: string;
    branches_total: number;
    branches_complete: number;
    branches_passed: number;
    last_trunk_promotion: string;
    hours_since_promotion: number;
    status: string;
    message?: string;
}

export interface MonitorSentimentStatus {
    total_articles: number;
    recent_articles: number;
    avg_score: number;
    pairs_covered: number;
    status: string;
    message?: string;
}

export interface MonitorAlertEvent {
    name: string;
    status: string;
    message: string;
    since: string;
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
    avg_sentiment: number;
    count: number;
}
