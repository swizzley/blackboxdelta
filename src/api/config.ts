const STORAGE_KEY = 'api_base';
import {ARCHIVED} from '../archive';

// The API is retired; in archive mode nothing points at it.
export const DEFAULT_BASE = '';
export const FALLBACK_BASE = '';

export function getApiBase(): string {
    if (ARCHIVED) return DEFAULT_BASE;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_BASE;
    return stored;
}

export function setApiBase(url: string) {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/+$/, ''));
}
