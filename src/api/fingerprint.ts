const STORAGE_KEY = 'bbdelta_device_id';

function generateId(): string {
    // crypto.randomUUID() produces a stable, unique device token
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    // fallback for older browsers
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function getOrCreateDeviceId(): string {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
        id = generateId();
        localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
}

// Cached in-memory for fast synchronous access
let cachedFP: string | null = null;

export async function getFingerprint(): Promise<string> {
    if (!cachedFP) cachedFP = getOrCreateDeviceId();
    return cachedFP;
}

// Synchronous getter — returns cached value or empty string
export function getFingerprintSync(): string {
    if (!cachedFP) cachedFP = getOrCreateDeviceId();
    return cachedFP;
}

// Initialize fingerprint eagerly on app load
export async function initFingerprint(): Promise<string> {
    return getFingerprint();
}
