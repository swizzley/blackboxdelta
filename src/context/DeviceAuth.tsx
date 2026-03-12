import React, {createContext, useContext, useEffect, useState, useCallback, useRef} from 'react';
import {getFingerprint} from '../api/fingerprint';
import {getApiBase, DEFAULT_BASE, FALLBACK_BASE} from '../api/config';

interface DeviceAuthContextProps {
    fingerprint: string;
    trusted: boolean | null;
    role: string;
    isAdmin: boolean;
    refresh: () => Promise<void>;
}

const DeviceAuthContext = createContext<DeviceAuthContextProps | undefined>(undefined);

export const useDeviceAuth = (): DeviceAuthContextProps => {
    const ctx = useContext(DeviceAuthContext);
    if (!ctx) throw new Error('useDeviceAuth must be used within DeviceAuthProvider');
    return ctx;
};

async function probe(fp: string, base: string): Promise<{trusted: boolean; role: string} | null> {
    try {
        const res = await fetch(`${base}/api/devices/status?fp=${encodeURIComponent(fp)}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {trusted: !!data.trusted, role: data.role || 'user'};
    } catch {
        return null;
    }
}

export const DeviceAuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const [fingerprint, setFingerprint] = useState('');
    const [trusted, setTrusted] = useState<boolean | null>(null);
    const [role, setRole] = useState('user');
    const checkedRef = useRef(false);

    // One-shot: resolve fingerprint, then try every URL until one works
    useEffect(() => {
        if (checkedRef.current) return;

        (async () => {
            const fp = await getFingerprint();
            setFingerprint(fp);
            if (!fp) return;

            // Try stored/default URL first, then both known URLs
            const urls = [getApiBase(), DEFAULT_BASE, FALLBACK_BASE];
            const unique = [...new Set(urls)];

            for (const base of unique) {
                const result = await probe(fp, base);
                if (result) {
                    setTrusted(result.trusted);
                    setRole(result.role);
                    checkedRef.current = true;
                    return;
                }
            }
        })();
    }, []);

    const refresh = useCallback(async () => {
        const fp = fingerprint || await getFingerprint();
        if (!fp) return;
        const urls = [getApiBase(), DEFAULT_BASE, FALLBACK_BASE];
        const unique = [...new Set(urls)];
        for (const base of unique) {
            const result = await probe(fp, base);
            if (result) {
                setTrusted(result.trusted);
                setRole(result.role);
                return;
            }
        }
    }, [fingerprint]);

    return (
        <DeviceAuthContext.Provider value={{
            fingerprint,
            trusted,
            role,
            isAdmin: role === 'admin',
            refresh,
        }}>
            {children}
        </DeviceAuthContext.Provider>
    );
};
