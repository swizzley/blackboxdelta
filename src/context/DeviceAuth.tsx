import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {getFingerprint, getFingerprintSync} from '../api/fingerprint';
import {getApiBase} from '../api/config';

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
    const [fingerprint, setFingerprint] = useState('');
    const [trusted, setTrusted] = useState<boolean | null>(null);
    const [role, setRole] = useState('user');

    const checkStatus = useCallback(async (fp?: string) => {
        const f = fp || getFingerprintSync();
        if (!f) return;
        try {
            const res = await fetch(`${getApiBase()}/api/devices/status?fp=${encodeURIComponent(f)}`);
            if (res.ok) {
                const data = await res.json();
                setTrusted(data.trusted);
                if (data.trusted && data.role) setRole(data.role);
            }
        } catch { /* ignore */ }
    }, []);

    const refresh = useCallback(async () => {
        await checkStatus();
    }, [checkStatus]);

    useEffect(() => {
        (async () => {
            const fp = await getFingerprint();
            setFingerprint(fp);
            await checkStatus(fp);
        })();
    }, [checkStatus]);

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
