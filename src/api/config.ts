const STORAGE_KEY = 'api_base';
export const DEFAULT_BASE = 'https://api.blackboxdelta.com';
export const FALLBACK_BASE = 'http://10.0.0.21:8080';

export function getApiBase(): string {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_BASE;
    // Migrate old local hostnames to Cloudflare Tunnel
    if (stored.includes('cipher.aspendenver.local') || stored.includes('genesis.aspendenver.local')) {
        localStorage.setItem(STORAGE_KEY, DEFAULT_BASE);
        return DEFAULT_BASE;
    }
    return stored;
}

export function setApiBase(url: string) {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/+$/, ''));
}
