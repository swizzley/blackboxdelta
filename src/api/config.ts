const STORAGE_KEY = 'api_base';
const DEFAULT_BASE = 'http://genesis.aspendenver.local:8080';

export function getApiBase(): string {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE;
}

export function setApiBase(url: string) {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/+$/, ''));
}
