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

export const DeviceAuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const {apiBase, apiAvailable} = useApi();
    const [fingerprint, setFingerprint] = useState('');
    const [trusted, setTrusted] = useState<boolean | null>(null);
    const [role, setRole] = useState('user');
    const fpRef = useRef('');

    // Resolve fingerprint once on mount
    useEffect(() => {
        getFingerprint().then(fp => {
            fpRef.current = fp;
            setFingerprint(fp);
        });
    }, []);

    // Check device status whenever API becomes available or base changes
    useEffect(() => {
        if (!apiAvailable || !fpRef.current) return;
        const fp = fpRef.current;

        fetch(`${apiBase}/api/devices/status?fp=${encodeURIComponent(fp)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!data) return;
                setTrusted(data.trusted);
                if (data.trusted && data.role) setRole(data.role);
            })
            .catch(() => {});
    }, [apiBase, apiAvailable]);

    // Retry once fingerprint loads if API was already available
    useEffect(() => {
        if (!fingerprint || !apiAvailable) return;

        fetch(`${apiBase}/api/devices/status?fp=${encodeURIComponent(fingerprint)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!data) return;
                setTrusted(data.trusted);
                if (data.trusted && data.role) setRole(data.role);
            })
            .catch(() => {});
    }, [fingerprint, apiBase, apiAvailable]);

    const refresh = useCallback(async () => {
        if (!fingerprint) return;
        try {
            const res = await fetch(`${apiBase}/api/devices/status?fp=${encodeURIComponent(fingerprint)}`);
            if (res.ok) {
                const data = await res.json();
                setTrusted(data.trusted);
                if (data.trusted && data.role) setRole(data.role);
            }
        } catch {}
    }, [apiBase, fingerprint]);

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
