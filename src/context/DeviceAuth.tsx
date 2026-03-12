import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {getFingerprint, getFingerprintSync} from '../api/fingerprint';
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

    const checkStatus = useCallback(async (fp?: string) => {
        const f = fp || getFingerprintSync();
        if (!f) return;
        try {
            const res = await fetch(`${apiBase}/api/devices/status?fp=${encodeURIComponent(f)}`);
            if (res.ok) {
                const data = await res.json();
                setTrusted(data.trusted);
                if (data.trusted && data.role) setRole(data.role);
            }
        } catch { /* ignore */ }
    }, [apiBase]);

    const refresh = useCallback(async () => {
        await checkStatus();
    }, [checkStatus]);

    // Initial fingerprint load
    useEffect(() => {
        (async () => {
            const fp = await getFingerprint();
            setFingerprint(fp);
        })();
    }, []);

    // Re-check device status whenever apiBase changes or API becomes available
    useEffect(() => {
        if (!apiAvailable) return;
        const fp = getFingerprintSync();
        if (fp) checkStatus(fp);
    }, [apiBase, apiAvailable, checkStatus]);

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
