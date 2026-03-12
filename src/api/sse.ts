import type {ApiOrder, ApiAlert, MonitorStatus} from '../context/Types';
import {getFingerprintSync} from './fingerprint';

interface SSEOptions<T> {
    url: string;
    onMessage: (data: T) => void;
    eventName?: string;
}

function connectSSE<T>({url, onMessage, eventName}: SSEOptions<T>): () => void {
    let es: EventSource | null = null;
    let backoff = 1000;
    let stopped = false;

    function connect() {
        if (stopped) return;
        // Append fingerprint as query param (EventSource doesn't support custom headers)
        const fp = getFingerprintSync();
        const sep = url.includes('?') ? '&' : '?';
        const authUrl = fp ? `${url}${sep}fp=${encodeURIComponent(fp)}` : url;
        es = new EventSource(authUrl);
        es.onopen = () => { backoff = 1000; };

        const handler = (e: MessageEvent) => {
            try {
                const data = JSON.parse(e.data) as T;
                onMessage(data);
            } catch { /* ignore parse errors */ }
        };

        if (eventName) {
            es.addEventListener(eventName, handler);
        } else {
            es.onmessage = handler;
        }

        es.onerror = () => {
            es?.close();
            if (!stopped) {
                setTimeout(connect, backoff);
                backoff = Math.min(backoff * 2, 30000);
            }
        };
    }

    connect();

    return () => {
        stopped = true;
        es?.close();
    };
}

export function connectOrders(baseUrl: string, onOrder: (order: ApiOrder) => void): () => void {
    return connectSSE({url: `${baseUrl}/api/stream/orders`, onMessage: onOrder, eventName: 'order'});
}

export function connectAlerts(baseUrl: string, onAlert: (alert: ApiAlert) => void): () => void {
    return connectSSE({url: `${baseUrl}/api/stream/alerts`, onMessage: onAlert, eventName: 'alert'});
}

export function connectMonitorStatus(monitorBase: string, onStatus: (status: MonitorStatus) => void): () => void {
    return connectSSE({url: `${monitorBase}/api/monitor/stream`, onMessage: onStatus, eventName: 'status'});
}
