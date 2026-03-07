import {getApiBase} from './config';
import type {
    ApiHealth, ApiSystem, ApiDashboard, ApiCalendarDay, ApiOrder,
    ApiAlert, ApiMarket, ApiSetting,
    OptimizerStatus, OptimizerGeneration, OptimizerTrunk, OptimizerRecommendation,
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

export function fetchOptimizerTrunks(limit = 20): Promise<OptimizerTrunk[] | null> {
    return apiFetch(`/api/optimizer/trunks?limit=${limit}`);
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

export function createRecommendation(mutations: Record<string, string>, rationale: string): Promise<any> {
    return apiPost('/api/optimizer/recommendations', {mutations, rationale});
}
