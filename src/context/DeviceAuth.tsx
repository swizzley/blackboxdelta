import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
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

export const DeviceAuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const {apiBase, apiAvailable} = useApi();
    const [fingerprint, setFingerprint] = useState('');
    const [trusted, setTrusted] = useState<boolean | null>(null);
    const [role, setRole] = useState('user');

    const checkStatus = useCallback(async (base: string, fp: string) => {
        if (!fp) return;
        try {
            const res = await fetch(`${base}/api/devices/status?fp=${encodeURIComponent(fp)}`);
            if (res.ok) {
                const data = await res.json();
                setTrusted(data.trusted);
                if (data.trusted && data.role) setRole(data.role);
            }
        } catch { /* ignore */ }
    }, []);

    // Load fingerprint once, then check status whenever apiBase/apiAvailable changes
    useEffect(() => {
        if (!apiAvailable) return;
        let cancelled = false;

        (async () => {
            const fp = await getFingerprint();
            if (cancelled) return;
            setFingerprint(fp);
            await checkStatus(apiBase, fp);
        })();

        return () => { cancelled = true; };
    }, [apiBase, apiAvailable, checkStatus]);

    const refresh = useCallback(async () => {
        if (fingerprint) await checkStatus(apiBase, fingerprint);
    }, [apiBase, fingerprint, checkStatus]);

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
