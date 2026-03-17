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
    win_pl?: number;
    loss_pl?: number;
    dur_sum?: number;
    dur_count?: number;
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
    spread?: number;
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
    spread?: number;
    avg_spread?: number;
    max_spread?: number;
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
    v?: number;  // volume (tick count)
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

// API response types (from swizzley-api on cipher:8080)
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

export interface ApiSentimentPair {
    pair: string;
    cumulative_score: number;
    avg_score: number;
    article_count: number;
    last_updated: string;
}

export interface ApiSentimentArticle {
    id: number;
    site_name: string;
    headline: string;
    url: string;
    language: string;
    final_score: number | null;
    score_method: string;
    scraped_at: string;
    pairs: string[];
}

export interface ApiSentimentFeed {
    site_name: string;
    last_scraped_at: string | null;
    last_article_count: number;
    last_error: string | null;
    consecutive_fails: number;
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
    profile: string;
    status: string;
    type: string;
    price: number;
    stop_loss: number;
    take_profit: number;
    quantity: number;
    profit: number | null;
    close_reason?: string;
    score?: Score | null;
    created: string;
    closed: string | null;
    alert_id?: number;
    risk_reward?: number;
    spread?: number;
    avg_spread?: number;
    max_spread?: number;
}

// Dynamic signal row — all ~190 signal columns as keys
export type SignalRow = Record<string, number | string>;

export interface ApiAlertScore {
    final_score: number;
}

export interface ApiAlert {
    id: number;
    time: string;
    date: string;
    symbol: string;
    strategy: string;
    timeframe: string;
    direction: string;
    score?: ApiAlertScore;
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

// Monitoring service types (from monitoring-service on cipher:8082)
export interface MonitorPairFreshness {
    symbol: string;
    enabled: boolean;
    age_secs: number;
    status: string; // "ok" | "warn" | "critical" | "disabled"
}

export interface MonitorCoverageEntry {
    timeframe: string;
    data_start: string;
    data_end: string;
    total_days: number;
    expected_days: number;
    coverage_pct: number;
    pair_count: number;
    pairs: MonitorPairCoverage[];
    status: string;
}

export interface MonitorPairCoverage {
    symbol: string;
    rows: number;
    expected: number;
    coverage_pct: number;
    status: string;
}

export interface MonitorStatus {
    timestamp: string;
    market_open: boolean;
    services: Record<string, MonitorServiceInfo[]>;
    data_freshness: Record<string, MonitorDataFreshness>;
    pair_freshness: MonitorPairFreshness[];
    coverage: MonitorCoverageEntry[];
    database: Record<string, MonitorDBHealth>;
    replication: Record<string, MonitorReplicationStatus>;
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
    type?: string;
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
    last_ts?: number;
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
    label?: string;
}

export interface MonitorOandaStatus {
    connected: boolean;
    balance: number;
    margin_used: number;
    margin_pct: number;
    open_trades: number;
    status: string;
    message?: string;
    massive_lag_s?: number;
    massive_lag_status?: string;
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

// Optimizer types
export interface OptimizerStatus {
    current_trunks: OptimizerTrunk[];
    active_generations: OptimizerGeneration[];
    total_generations: number;
    total_trunks: number;
}

export interface OptimizerTrunk {
    id: number;
    generation: number;
    timeframe: string;
    param_count?: number;
    oos_result?: OptimizerResult;
    oos_days?: number;
    ai_score: number;
    promoted_at: string;
    pushed_at?: string;
    promoted_from_branch_id?: number;
    promoted_from_recommendation_id?: number;
    promoted_rec_source?: string;
    revert_reason?: string;
    reverted_to_trunk_id?: number;
}

export interface OptimizerTrunkDetail {
    trunk: OptimizerTrunk;
    params: Record<string, string>;
    diffs: OptimizerParamDiff[];
    diff_base_id?: number;
    directive?: string;
}

export interface OptimizerParamDiff {
    key: string;
    old_value?: string;
    new_value?: string;
    removed?: boolean;
}

export interface OptimizerResult {
    total_trades: number;
    wins: number;
    losses: number;
    win_rate: number;
    total_pnl: number;
    profit_factor: number;
    avg_win: number;
    avg_loss: number;
    max_drawdown: number;
    sharpe_ratio: number;
    breakeven_wr: number;
    ProfileBreakdown?: Record<string, OptimizerResult>;
}

export interface OptimizerGeneration {
    id: number;
    trunk_id: number;
    timeframe: string;
    status: string;
    claimed_by?: string;
    branch_count: number;
    started_at: string;
    completed_at?: string;
    winner_branch_id?: number;
    passed?: number;
    failed?: number;
    running?: number;
    consecutive_failures?: number;
}

export interface OptimizerRecommendation {
    id: number;
    source: string;
    source_id?: string;
    timeframe?: string;
    rationale?: string;
    prompt?: string;
    mutations: Record<string, string>;
    status: string;
    is_result?: OptimizerResult;
    oos_result?: OptimizerResult;
    trunk_id?: number;
    created_at: string;
    executed_at?: string;
}

export interface OptimizerBranch {
    id: number;
    generation_id: number;
    trunk_id: number;
    exploration_directive?: string;
    status: string;
    is_result?: OptimizerResult;
    oos_result?: OptimizerResult;
    total_trades: number;
    win_rate: number;
    profit_factor: number;
    sharpe_ratio: number;
    max_drawdown: number;
    failure_reason?: string;
    is_start?: string;
    is_end?: string;
    oos_start?: string;
    oos_end?: string;
    param_diffs?: OptimizerParamDiff[];
    created_at: string;
    completed_at?: string;
}

// Worker allocation types (from /api/optimizer/workers)
export interface OptimizerWorkerTimeframe {
    enabled: boolean;
    priority: number;
    label: string;
    workers: number;
    mem_cost: number;
}

export interface OptimizerWorkerConfig {
    max_memory_units: number;
    memory_used: number;
    cpu_cores: number;
    total_workers: number;
    active_hosts?: string[];
    host_count?: number;
    timeframes: Record<string, OptimizerWorkerTimeframe>;
}

// Seed run types (from /api/optimizer/seed-runs)
export interface SeedComponentResult {
    component: string;
    sharpe: number;
    trades: number;
    win_rate: number;
    weight: number;
}

export interface SeedVariantResult {
    label: string;
    sharpe: number;
    trades: number;
    winner?: boolean;
}

export interface SeedFilterResult {
    filter: string;
    sharpe: number;
    trades: number;
    helps: boolean;
}

export interface SeedStageBResult {
    baseline_sharpe: number;
    filters: SeedFilterResult[];
    kept: string[];
}

export interface SeedStageCResult {
    with_dampeners: number;
    without_dampeners: number;
    with_trades: number;
    without_trades: number;
    with_wr: number;
    without_wr: number;
    winner: string;
}

export interface SeedStageEResult {
    calibrated_sharpe: number;
    calibrated_wr: number;
    calibrated_trades: number;
    seed_sharpe: number;
    seed_wr: number;
    seed_trades: number;
    winner: string;
}

export interface Tier2Summary {
    rounds: number;
    improvements: number;
    start_sharpe: number;
    end_sharpe: number;
    best_trades: number;
}

export interface Tier3Summary {
    window_tests: number;
    random_tests: number;
    best_cal_sharpe: number;
    best_random_sharpe: number;
    random_beat_calibrated: boolean;
    best_trades: number;
}

export interface SymbolDiag {
    s: string;
    n: number;
    w: number;
    pnl: number;
    sr: number;
}

export interface HourDiag {
    h: number;
    n: number;
    w: number;
    pnl: number;
}

export interface DirectionDiag {
    d: string;
    n: number;
    w: number;
    pf: number;
    pnl: number;
}

export interface ExitReasonDiag {
    r: string;
    n: number;
    avg: number;
}

export interface SeedDiagnostics {
    best_sharpe: number;
    best_trades: number;
    configs_tested: number;
    tier1_sharpe: number;
    tier2_sharpe: number;
    tier3_sharpe: number;
    random_beat_calibrated: boolean;
    is_vs_oos_gap: number;
    per_symbol: SymbolDiag[];
    per_hour: HourDiag[];
    per_direction: DirectionDiag[];
    per_exit: ExitReasonDiag[];
    score_dist: Record<string, number>;
    conf_dist: Record<string, number>;
    components: { component: string; signal: number; }[];
}

export interface SeedRun {
    id: number;
    timeframe: string;
    trigger_reason: string;
    status: string;
    current_stage: string;
    started_at: string;
    completed_at?: string;
    // Stage results are profile-keyed: {"profileName": data, ...}
    // For old (pre-profile) runs, data is flat (legacy compat handled by getProfileStageData helper)
    stage0_results?: Record<string, SeedComponentResult[]>;
    stagea_results?: Record<string, SeedVariantResult[]>;
    stageb_results?: Record<string, SeedStageBResult>;
    stagec_results?: Record<string, SeedStageCResult>;
    staged_results?: Record<string, SeedVariantResult[]>;
    stagee_results?: Record<string, SeedStageEResult>;
    trunk_id?: number;
    error_message?: string;
    staged2_results?: Record<string, SeedVariantResult[]>;
    staged3_results?: Record<string, SeedVariantResult[]>;
    staged4_results?: Record<string, SeedVariantResult[]>;
    tier: number;
    tier2_results?: Record<string, Tier2Summary>;
    tier3_results?: Record<string, Tier3Summary>;
    diagnostics?: Record<string, SeedDiagnostics>;
    configs_tested: number;
    best_sharpe?: number;
    claimed_by?: string;
    staged5_results?: Record<string, SeedVariantResult[]>;
    profile_results?: SeedProfileResult[];
    profile_stages?: Record<string, string>;
}

// Per-profile seed result
export interface SeedProfileResult {
    profile: string;
    passed: boolean;
    tier: number;
    sharpe: number;
    trades: number;
    win_rate: number;
    configs_tested: number;
    error?: string;
}

// Profile management types (from /api/optimizer/profiles)
export interface OptimizerProfileStats {
    total_trades: number;
    wins: number;
    losses: number;
    win_rate: number;
    total_pnl: number;
    profit_factor: number;
    avg_win: number;
    avg_loss: number;
    max_drawdown: number;
    sharpe_ratio: number;
    breakeven_wr: number;
}

export interface OptimizerProfileState {
    name: string;
    enabled: boolean;
    stats?: OptimizerProfileStats;
}

export interface ProfileProbeEntry {
    profile: string;
    status: string;
    generation_id: number;
}

export interface OptimizerProfilesResponse {
    profiles: OptimizerProfileState[];
    aggregate?: OptimizerProfileStats;
    probe_history?: ProfileProbeEntry[];
}

// Analysis API types (from /api/analysis/*)
export interface AnalysisRunApi {
    run_id: string;
    created_at: string;
    provider: string;
    model: string;
    scope: string; // hourly, daily, weekly, monthly, yearly, trunk
    trigger: string; // service, api, ad-hoc
    order_count: number;
    todo_count: number;
    tested_todo_count: number;
    synthesis: string;
    data_start?: string;
    data_end?: string;
    skipped?: boolean;
    timeframe?: string;
    trunk_id?: number;
}

export interface AnalysisTodoApi {
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
    mutations?: Record<string, string>;
    current_values?: Record<string, string>;
    status: 'open' | 'in_progress' | 'implemented' | 'wont_fix' | 'obsolete';
    implemented_at?: string;
    implemented_sha?: string;
    implemented_by?: string;
    notes?: string;
    recommendation_id?: number;
    recommendation_status?: string;
}

export interface AnalysisRunDetailApi {
    run: AnalysisRunApi;
    todos: AnalysisTodoApi[];
}
