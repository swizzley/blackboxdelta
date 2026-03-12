import React, {createContext, useContext, useEffect, useState, useCallback, useRef} from 'react';
import {getFingerprint} from '../api/fingerprint';
import {useApi} from './Api';

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

async function fetchDeviceStatus(base: string, fp: string): Promise<{trusted: boolean; role: string} | null> {
    try {
        const res = await fetch(`${base}/api/devices/status?fp=${encodeURIComponent(fp)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return {trusted: !!data.trusted, role: data.role || 'user'};
    } catch {
        return null;
    }
}

export const DeviceAuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const {apiBase, apiAvailable} = useApi();
    const [fingerprint, setFingerprint] = useState('');
    const [trusted, setTrusted] = useState<boolean | null>(null);
    const [role, setRole] = useState('user');
    const resolvedRef = useRef(false);

    const doCheck = useCallback(async (base: string, fp: string) => {
        const result = await fetchDeviceStatus(base, fp);
        if (result) {
            setTrusted(result.trusted);
            setRole(result.role);
            resolvedRef.current = true;
        }
    }, []);

    // Main effect: resolve fingerprint, then check status
    useEffect(() => {
        if (!apiAvailable) return;

        let active = true;
        (async () => {
            const fp = await getFingerprint();
            if (!active) return;
            setFingerprint(fp);
            await doCheck(apiBase, fp);
        })();

        return () => { active = false; };
    }, [apiBase, apiAvailable, doCheck]);

    // Safety net: if after 3s we still haven't resolved, retry
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (resolvedRef.current) return;
            const fp = await getFingerprint();
            if (!fp) return;
            setFingerprint(fp);
            // Try tunnel URL directly regardless of apiBase
            const result = await fetchDeviceStatus('https://api.blackboxdelta.com', fp);
            if (result) {
                setTrusted(result.trusted);
                setRole(result.role);
                resolvedRef.current = true;
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    const refresh = useCallback(async () => {
        if (!fingerprint) return;
        await doCheck(apiBase, fingerprint);
    }, [apiBase, fingerprint, doCheck]);

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
