import {getApiBase} from './config';
import type {
    ApiHealth, ApiSystem, ApiDashboard, ApiCalendarDay, ApiOrder,
    ApiAlert, ApiMarket, ApiSetting,
    OptimizerStatus, OptimizerGeneration, OptimizerTrunk, OptimizerRecommendation,
    OptimizerBranch, OptimizerTrunkDetail,
    AnalysisRunApi, AnalysisRunDetailApi, AnalysisTodoApi,
} from '../context/Types';

const TIMEOUT = 5000;

async function apiFetch<T>(path: string): Promise<T | null> {
    const base = getApiBase();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const res = await fetch(`${base}${path}`, {signal: controller.signal});
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
    limit?: number;
    offset?: number;
}

export function fetchOrders(opts: OrderOpts = {}): Promise<ApiOrder[] | null> {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    if (opts.timeframe) params.set('timeframe', opts.timeframe);
    if (opts.symbol) params.set('symbol', opts.symbol);
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

export function fetchOptimizerStatus(): Promise<OptimizerStatus | null> {
    return apiFetch('/api/optimizer/status');
}

export function fetchOptimizerGenerations(limit = 20): Promise<OptimizerGeneration[] | null> {
    return apiFetch(`/api/optimizer/generations?limit=${limit}`);
}

export function fetchOptimizerTrunks(limit = 20, timeframe?: string): Promise<OptimizerTrunk[] | null> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (timeframe) params.set('timeframe', timeframe);
    return apiFetch(`/api/optimizer/trunks?${params}`);
}

export function fetchOptimizerTrunkDetail(trunkId: number, baseId?: number): Promise<OptimizerTrunkDetail | null> {
    const qs = baseId !== undefined ? `?base_id=${baseId}` : '';
    return apiFetch(`/api/optimizer/trunks/${trunkId}${qs}`);
}

export function fetchOptimizerBranches(generationId: number): Promise<OptimizerBranch[] | null> {
    return apiFetch(`/api/optimizer/generations/${generationId}/branches`);
}

export function fetchOptimizerRecommendations(status?: string): Promise<OptimizerRecommendation[] | null> {
    const qs = status ? `?status=${status}` : '';
    return apiFetch(`/api/optimizer/recommendations${qs}`);
}

export async function apiPost(path: string, body?: any): Promise<any> {
    const base = getApiBase();
    try {
        const res = await fetch(`${base}${path}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
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

export function applyRecommendation(id: number): Promise<any> {
    return apiPost(`/api/optimizer/recommendations/${id}/apply`);
}

export function pushTrunk(id: number): Promise<any> {
    return apiPost(`/api/optimizer/trunks/${id}/push`);
}

export function revertTrunk(id: number): Promise<any> {
    return apiPost(`/api/optimizer/trunks/${id}/revert`);
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

export function triggerAnalysisRun(model: string, from: string, to: string, provider = 'ollama', anthropicModel?: string, timeframe?: string, trunkId?: number): Promise<AnalysisJob | null> {
    return apiPost('/api/analysis/run', {
        model, from, to, provider,
        ...(anthropicModel ? {anthropic_model: anthropicModel} : {}),
        ...(timeframe ? {timeframe} : {}),
        ...(trunkId ? {trunk_id: trunkId} : {}),
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
        status: string;
        opened: string;
        units: number;
        price: number;
    }>;
}

export function fetchLive(): Promise<LiveData | null> {
    return apiFetch('/api/live');
}
