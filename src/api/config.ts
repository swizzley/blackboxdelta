const STORAGE_KEY = 'api_base';
const DEFAULT_BASE = 'https://genesis.aspendenver.local:8080';

export function getApiBase(): string {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_BASE;
    // Auto-upgrade stale http:// entries to https://
    if (stored.startsWith('http://') && DEFAULT_BASE.startsWith('https://')) {
        const upgraded = stored.replace('http://', 'https://');
        localStorage.setItem(STORAGE_KEY, upgraded);
        return upgraded;
    }
    return stored;
}

export function setApiBase(url: string) {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/+$/, ''));
}
