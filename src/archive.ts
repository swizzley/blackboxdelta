// BlackBoxDelta was retired in October 2026. The site stays up as a read-only
// archive: no API calls, every page open, every control disabled, and the data
// frozen at the last snapshot the engine published.
export const ARCHIVED = true;
export const ARCHIVE_SNAPSHOT = '2026-10-13';

// Refuse every request that would reach the (retired) API or another host.
// Same-origin static files such as /data/dashboard.json still load.
export function installArchiveGuard() {
    if (!ARCHIVED) return;
    const allowed = (url: string) => {
        try {
            const u = new URL(url, window.location.origin);
            return u.origin === window.location.origin && !u.pathname.startsWith('/api/');
        } catch {
            return false;
        }
    };
    const realFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!allowed(url)) return Promise.reject(new TypeError('archived: network disabled'));
        return realFetch(input, init);
    };
    class ArchivedEventSource {
        readyState = 2;
        onopen = null; onmessage = null; onerror = null;
        addEventListener() {}
        removeEventListener() {}
        close() {}
    }
    (window as unknown as {EventSource: unknown}).EventSource = ArchivedEventSource;
}
