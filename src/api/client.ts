import {getApiBase} from './config';
import type {
    ApiHealth, ApiDashboard, ApiCalendarDay, ApiOrder,
    ApiAlert, ApiMarket, ApiSetting,
} from '../context/Types';

const TIMEOUT = 5000;

async function apiFetch<T>(path: string): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const res = await fetch(`${getApiBase()}${path}`, {signal: controller.signal});
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

export function fetchDashboard(): Promise<ApiDashboard | null> {
    return apiFetch('/api/dashboard');
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
