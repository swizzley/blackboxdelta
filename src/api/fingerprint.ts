import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cachedFP: string | null = null;

export async function getFingerprint(): Promise<string> {
    if (cachedFP) return cachedFP;
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    cachedFP = result.visitorId;
    return cachedFP;
}

// Synchronous getter — returns cached value or empty string
export function getFingerprintSync(): string {
    return cachedFP ?? '';
}

// Initialize fingerprint eagerly on app load
export async function initFingerprint(): Promise<string> {
    return getFingerprint();
}
