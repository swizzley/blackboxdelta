const STORAGE_KEY = 'api_base';
const DEFAULT_BASE = 'https://api.blackboxdelta.com';

export function getApiBase(): string {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_BASE;
    // Migrate old local URLs to Cloudflare Tunnel
    if (stored.includes('cipher.aspendenver.local') || stored.includes('genesis.aspendenver.local')) {
        localStorage.setItem(STORAGE_KEY, DEFAULT_BASE);
        return DEFAULT_BASE;
    }
    return stored;
}

export function setApiBase(url: string) {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/+$/, ''));
}
