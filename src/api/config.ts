const STORAGE_KEY = 'api_base';
const DEFAULT_BASE = 'https://cipher.aspendenver.local:8080';

export function getApiBase(): string {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_BASE;
    // Migrate genesis → cipher (genesis is offline)
    if (stored.includes('genesis.aspendenver.local')) {
        const migrated = stored.replace('genesis.aspendenver.local', 'cipher.aspendenver.local');
        localStorage.setItem(STORAGE_KEY, migrated);
        return migrated;
    }
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
