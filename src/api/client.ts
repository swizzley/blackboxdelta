import {getApiBase} from './config';
import {getFingerprintSync} from './fingerprint';
import type {
    ApiHealth, ApiSystem, ApiDashboard, ApiCalendarDay, ApiOrder,
    ApiAlert, ApiMarket, ApiSetting, SignalRow,
    OptimizerStatus, OptimizerGeneration, OptimizerRecommendation,
    OptimizerBranch, OptimizerWorkerConfig, SeedRun,
    OptimizerAllProfilesResponse, GenQueueResponse, PaginatedResponse,
    AnalysisRunApi, AnalysisRunDetailApi, AnalysisTodoApi,
    ApiSentimentPair, ApiSentimentArticle, ApiSentimentFeed,
    HealthStatus,
    SurgeProfile, SurgeGeneration, SurgeBranch, SurgeHistoryEntry,
    NeoStatus, NeoIncident, NeoSweep,
} from '../context/Types';

const TIMEOUT = 5000;

function authHeaders(): Record<string, string> {
    const fp = getFingerprintSync();
    return fp ? {'X-Device-FP': fp} : {};
}

async function apiFetch<T>(path: string): Promise<T | null> {
    const base = getApiBase();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const res = await fetch(`${base}${path}`, {
            signal: controller.signal,
            headers: authHeaders(),
        });
        if (!res.ok) return null;
        return await res.json() as T;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export function checkHealth(): Promise<ApiHealth | null> {
    return apiFetch('/api/health');
}

export async function checkHealthAt(base: string): Promise<ApiHealth | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const res = await fetch(`${base}/api/health`, {
            signal: controller.signal,
            headers: authHeaders(),
        });
        if (!res.ok) return null;
        return await res.json() as ApiHealth;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export function fetchDashboard(since?: string): Promise<ApiDashboard | null> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return apiFetch(`/api/dashboard${qs}`);
}

export function fetchCalendar(days = 90): Promise<ApiCalendarDay[] | null> {
    return apiFetch(`/api/calendar?days=${days}`);
}

interface OrderOpts {
    status?: string;
    timeframe?: string;
    symbol?: string;
    profile?: string;
    limit?: number;
    offset?: number;
}

export function fetchOrders(opts: OrderOpts = {}): Promise<ApiOrder[] | null> {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    if (opts.timeframe) params.set('timeframe', opts.timeframe);
    if (opts.symbol) params.set('symbol', opts.symbol);
    if (opts.profile) params.set('profile', opts.profile);
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.offset) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return apiFetch(`/api/orders${qs ? '?' + qs : ''}`);
}

export function fetchOrder(id: string): Promise<ApiOrder | null> {
    return apiFetch(`/api/orders/${id}`);
}

export function fetchAlerts(opts: {timeframe?: string; symbol?: string; limit?: number} = {}): Promise<ApiAlert[] | null> {
    const params = new URLSearchParams();
    if (opts.timeframe) params.set('timeframe', opts.timeframe);
    if (opts.symbol) params.set('symbol', opts.symbol);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return apiFetch(`/api/alerts${qs ? '?' + qs : ''}`);
}

export function fetchPrices(symbol: string, timeframe: string, limit = 500): Promise<any[] | null> {
    return apiFetch(`/api/prices/${symbol}/${timeframe}?limit=${limit}`);
}

export function fetchPricesAround(symbol: string, timeframe: string, aroundMs: number, limit = 200): Promise<any[] | null> {
    return apiFetch(`/api/prices/${symbol}/${timeframe}?around=${aroundMs}&limit=${limit}`);
}

export function fetchSignalsAround(symbol: string, timeframe: string, aroundMs: number, limit = 200): Promise<SignalRow[] | null> {
    return apiFetch(`/api/signals/${symbol}/${timeframe}?around=${aroundMs}&limit=${limit}`);
}

export function fetchDay(date: string): Promise<any | null> {
    return apiFetch(`/api/days/${date}`);
}

export function fetchMarkets(): Promise<ApiMarket[] | null> {
    return apiFetch('/api/markets');
}

export function fetchSettings(): Promise<ApiSetting[] | null> {
    return apiFetch('/api/settings');
}

export function fetchVersions(): Promise<Record<string, string> | null> {
    return apiFetch('/api/versions');
}

export function fetchSystem(): Promise<ApiSystem | null> {
    return apiFetch('/api/system');
}

export function fetchHealthStatus(): Promise<HealthStatus | null> {
    return apiFetch('/api/health/status');
}

export function fetchOptimizerStatus(): Promise<OptimizerStatus | null> {
    return apiFetch('/api/optimizer/status');
}

export function fetchOptimizerGenerations(limit = 15, profile?: string, page?: number): Promise<PaginatedResponse<OptimizerGeneration> | null> {
    const params = new URLSearchParams({limit: String(limit)});
    if (profile) params.set('profile', profile);
    if (page !== undefined) params.set('page', String(page));
    return apiFetch(`/api/optimizer/generations?${params}`);
}

export function fetchOptimizerBranches(generationId: number): Promise<OptimizerBranch[] | null> {
    return apiFetch(`/api/optimizer/generations/${generationId}/branches`);
}

export function fetchOptimizerRecommendations(status?: string, limit = 20, page?: number): Promise<PaginatedResponse<OptimizerRecommendation> | null> {
    const params = new URLSearchParams({limit: String(limit)});
    if (status) params.set('status', status);
    if (page !== undefined) params.set('page', String(page));
    return apiFetch(`/api/optimizer/recommendations?${params}`);
}

export async function apiPost(path: string, body?: any): Promise<any> {
    const base = getApiBase();
    const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', ...authHeaders()},
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const err = await res.json();
            if (err?.error) msg = err.error;
        } catch { /* no json body */ }
        throw new Error(msg);
    }
    return await res.json();
}

export function queueRecommendation(id: number): Promise<any> {
    return apiPost(`/api/optimizer/recommendations/${id}/queue`);
}

export function skipRecommendation(id: number): Promise<any> {
    return apiPost(`/api/optimizer/recommendations/${id}/skip`);
}

export function createRecommendation(mutations: Record<string, string>, rationale: string, timeframe?: string): Promise<any> {
    return apiPost('/api/optimizer/recommendations', {mutations, rationale, timeframe});
}

export function createPromptRecommendation(prompt: string, timeframe: string): Promise<any> {
    return apiPost('/api/optimizer/recommendations', {prompt, timeframe});
}

export function applyRecommendation(id: number): Promise<any> {
    return apiPost(`/api/optimizer/recommendations/${id}/apply`);
}

export function triggerSeed(timeframe: string): Promise<any> {
    return apiPost(`/api/optimizer/seed/${timeframe}`, {});
}

// Profile management
export function fetchOptimizerAllProfiles(): Promise<OptimizerAllProfilesResponse | null> {
    return apiFetch('/api/optimizer/profiles');
}

export function enableProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/enable`, {});
}

export function disableProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/disable`, {});
}

export function soakProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/soak`, {});
}

export function goLiveProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/golive`, {});
}

export function noLiveProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/nolive`, {});
}

export function deleteProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/delete`, {});
}

export function cancelSeedProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/cancel-seed`, {});
}

export function revertProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/revert`, {});
}

export function reseedProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/reseed`, {});
}

export function retrySeedProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/retry-seed`, {});
}

export function promoteProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/promote`, {});
}

export function demoteProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/profiles/${name}/demote`, {});
}

export function fetchProfileHistory(name: string, limit = 20, page?: number): Promise<import('../context/Types').ProfileHistoryResponse | null> {
    const params = new URLSearchParams({limit: String(limit)});
    if (page !== undefined) params.set('page', String(page));
    return apiFetch(`/api/optimizer/profiles/${name}/history?${params}`);
}

export function fetchProfileTimeline(name: string): Promise<import('../context/Types').ProfileTimelineResponse | null> {
    return apiFetch(`/api/optimizer/profiles/${name}/timeline`);
}

export function fetchProfileParams(name: string): Promise<import('../context/Types').ProfileParamsResponse | null> {
    return apiFetch(`/api/optimizer/profiles/${name}/params`);
}

// LHC runs
export function queueLHCRun(timeframe: string, profile: string, combos: number = 10000): Promise<any> {
    return apiPost('/api/optimizer/lhc', { timeframe, profile, combos });
}

export function fetchLHCRuns(limit = 10, page?: number): Promise<PaginatedResponse<import('../context/Types').LHCRun> | null> {
    const params = new URLSearchParams({limit: String(limit)});
    if (page !== undefined) params.set('page', String(page));
    return apiFetch(`/api/optimizer/lhc-runs?${params}`);
}

export function fetchLHCRunDetail(id: number): Promise<import('../context/Types').LHCRunDetail | null> {
    return apiFetch(`/api/optimizer/lhc-runs/${id}`);
}

export function spawnLHCProfile(runId: number, resultIndex: number): Promise<{profile_name: string; parent: string; timeframe: string} | null> {
    return apiPost(`/api/optimizer/lhc-runs/${runId}/spawn`, { result_index: resultIndex });
}

// Worker allocation
export function fetchOptimizerWorkers(): Promise<OptimizerWorkerConfig | null> {
    return apiFetch('/api/optimizer/workers');
}

export async function updateOptimizerWorkers(config: Record<string, {enabled?: boolean; priority?: number}>): Promise<any> {
    const base = getApiBase();
    try {
        const res = await fetch(`${base}/api/optimizer/workers`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json', ...authHeaders()},
            body: JSON.stringify(config),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

// Seed runs
export function fetchOptimizerSeedRuns(timeframe?: string, status?: string, limit = 10, page?: number): Promise<PaginatedResponse<SeedRun> | null> {
    const params = new URLSearchParams({limit: String(limit)});
    if (timeframe) params.set('timeframe', timeframe);
    if (status) params.set('status', status);
    if (page !== undefined) params.set('page', String(page));
    return apiFetch(`/api/optimizer/seed-runs?${params}`);
}

// Generation queue
export function fetchGenerationQueue(): Promise<GenQueueResponse | null> {
    return apiFetch('/api/optimizer/generation-queue');
}

// Seed queue (pending + claimed items for queue display)
export async function fetchSeedQueue(): Promise<import('../context/Types').SeedQueueItem[] | null> {
    const [pending, claimed] = await Promise.all([
        apiFetch<import('../context/Types').SeedQueueItem[]>(`/api/optimizer/seed-queue?status=pending&limit=2000`),
        apiFetch<import('../context/Types').SeedQueueItem[]>(`/api/optimizer/seed-queue?status=claimed&limit=200`),
    ]);
    return [...(claimed ?? []), ...(pending ?? [])];
}

export async function updateGenerationQueuePriority(id: number, priority: number): Promise<boolean> {
    const base = getApiBase();
    try {
        const res = await fetch(`${base}/api/optimizer/generation-queue/${id}/priority`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json', ...authHeaders()},
            body: JSON.stringify({ priority }),
        });
        return res.ok;
    } catch { return false; }
}

// Seed queue priority
export async function updateSeedQueuePriority(id: number, priority: number): Promise<boolean> {
    const base = getApiBase();
    try {
        const res = await fetch(`${base}/api/optimizer/seed-queue/${id}/priority`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json', ...authHeaders()},
            body: JSON.stringify({ priority }),
        });
        return res.ok;
    } catch { return false; }
}

export async function enqueueGeneration(profileName: string, priority: number, memoryCost: number): Promise<boolean> {
    try {
        await apiPost('/api/optimizer/generation-queue', { profile_name: profileName, priority, memory_cost: memoryCost });
        return true;
    } catch { return false; }
}

// Analysis
export function fetchAnalysisRuns(provider?: string, limit = 20): Promise<AnalysisRunApi[] | null> {
    const params = new URLSearchParams();
    if (provider) params.set('provider', provider);
    params.set('limit', String(limit));
    return apiFetch(`/api/analysis/runs?${params}`);
}

export function fetchAnalysisRunDetail(runId: string): Promise<AnalysisRunDetailApi | null> {
    return apiFetch(`/api/analysis/runs/${runId}`);
}

export function fetchAnalysisTodos(opts: {run_id?: string; status?: string} = {}): Promise<AnalysisTodoApi[] | null> {
    const params = new URLSearchParams();
    if (opts.run_id) params.set('run_id', opts.run_id);
    if (opts.status) params.set('status', opts.status);
    const qs = params.toString();
    return apiFetch(`/api/analysis/todos${qs ? '?' + qs : ''}`);
}

export function sendTodoToOptimizer(todoId: number): Promise<any> {
    return apiPost(`/api/analysis/todos/${todoId}/recommend`);
}

export function squashTodos(todoIds: number[]): Promise<any> {
    return apiPost('/api/analysis/todos/squash', {todo_ids: todoIds});
}

export interface OllamaModel {
    name: string;
    parameter_size: string;
    family: string;
    size_gb: number;
}

export function fetchAnalysisModels(): Promise<OllamaModel[] | null> {
    return apiFetch('/api/analysis/models');
}

export interface AnalysisJob {
    id: string;
    model: string;
    provider: string;
    from: string;
    to: string;
    status: string;
    started_at: string;
    phase: number;
    phase_name?: string;
    error?: string;
}

export function triggerAnalysisRun(model: string, from: string, to: string, provider = 'ollama', anthropicModel?: string, timeframe?: string): Promise<AnalysisJob | null> {
    return apiPost('/api/analysis/run', {
        model, from, to, provider,
        ...(anthropicModel ? {anthropic_model: anthropicModel} : {}),
        ...(timeframe ? {timeframe} : {}),
    });
}

export function fetchAnalysisJobs(): Promise<AnalysisJob[] | null> {
    return apiFetch('/api/analysis/jobs');
}

export function stopAnalysisJob(): Promise<AnalysisJob | null> {
    return apiPost('/api/analysis/stop');
}

export interface LiveData {
    total_open: number;
    open_longs: number;
    open_shorts: number;
    open_by_timeframe: Record<string, number>;
    open_pairs: string[];
    open_orders: Array<{
        id: string;
        symbol: string;
        direction: string;
        timeframe: string;
        profile: string;
        status: string;
        opened: string;
        units: number;
        price: number;
        stop_loss: number;
        take_profit: number;
        current_price?: number;
        unrealized_pl?: number;
    }>;
}

export function fetchLive(): Promise<LiveData | null> {
    return apiFetch('/api/live');
}

export function closeOrder(id: string): Promise<{status: string; order_id: string; trade_id: string} | null> {
    return apiPost(`/api/orders/${id}/close`);
}

export function closeProfitableOrders(): Promise<{queued: number} | null> {
    return apiPost('/api/orders/close-profitable');
}

// Sentiment
export function fetchSentimentPairs(): Promise<ApiSentimentPair[] | null> {
    return apiFetch('/api/sentiment/pairs');
}

export function fetchSentimentArticles(limit = 50): Promise<ApiSentimentArticle[] | null> {
    return apiFetch(`/api/sentiment/articles?limit=${limit}`);
}

export function fetchSentimentFeeds(): Promise<ApiSentimentFeed[] | null> {
    return apiFetch('/api/sentiment/feeds');
}

// Surge optimizer
export function fetchSurgeProfiles(): Promise<SurgeProfile[] | null> {
    return apiFetch('/api/optimizer/surge/profiles');
}

export function fetchSurgeGenerations(limit = 15, page?: number): Promise<PaginatedResponse<SurgeGeneration> | null> {
    const params = new URLSearchParams({limit: String(limit)});
    if (page !== undefined) params.set('page', String(page));
    return apiFetch(`/api/optimizer/surge/generations?${params}`);
}

export function fetchSurgeBranches(generationId: number): Promise<SurgeBranch[] | null> {
    return apiFetch(`/api/optimizer/surge/generations/${generationId}/branches`);
}

export function fetchSurgeProfileHistory(name: string, limit = 20, page?: number): Promise<PaginatedResponse<SurgeHistoryEntry> | null> {
    const params = new URLSearchParams({limit: String(limit)});
    if (page !== undefined) params.set('page', String(page));
    return apiFetch(`/api/optimizer/surge/profiles/${name}/history?${params}`);
}

export function enableSurgeProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/surge/profiles/${name}/enable`, {});
}

export function disableSurgeProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/surge/profiles/${name}/disable`, {});
}

export function soakSurgeProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/surge/profiles/${name}/soak`, {});
}

export function goliveSurgeProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/surge/profiles/${name}/golive`, {});
}

export function noliveSurgeProfile(name: string): Promise<any> {
    return apiPost(`/api/optimizer/surge/profiles/${name}/nolive`, {});
}

// --- Neo Agent ---
export function fetchNeoStatus(): Promise<NeoStatus | null> { return apiFetch('/api/neo/status'); }
export function fetchNeoIncidents(limit = 50, status?: string): Promise<NeoIncident[] | null> {
    const params = new URLSearchParams({limit: String(limit)});
    if (status) params.set('status', status);
    return apiFetch(`/api/neo/incidents?${params}`);
}
export function fetchNeoSweeps(limit = 20): Promise<NeoSweep[] | null> { return apiFetch(`/api/neo/sweeps?limit=${limit}`); }
export function pauseNeo(): Promise<any> { return apiPost('/api/neo/pause'); }
export function resumeNeo(): Promise<any> { return apiPost('/api/neo/resume'); }
