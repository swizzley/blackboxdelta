import React, {createContext, useContext, useEffect, useState, useCallback, useRef} from 'react';
import {checkHealth, checkHealthAt} from '../api/client';
import {getApiBase, setApiBase as persistApiBase, DEFAULT_BASE, FALLBACK_BASE} from '../api/config';

interface ApiContextProps {
    apiAvailable: boolean;
    apiBase: string;
    checking: boolean;
    setApiBase: (url: string) => void;
}

const ApiContext = createContext<ApiContextProps | undefined>(undefined);

export const useApi = (): ApiContextProps => {
    const ctx = useContext(ApiContext);
    if (!ctx) throw new Error('useApi must be used within ApiProvider');
    return ctx;
};

export const ApiProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const [apiAvailable, setApiAvailable] = useState(false);
    const [apiBase, setApiBaseState] = useState(getApiBase);
    const [checking, setChecking] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval>>();

    const probe = useCallback(async () => {
        const result = await checkHealth();
        if (result !== null) {
            setApiAvailable(true);
            setChecking(false);
            return;
        }
        // Primary URL unreachable — try the other endpoint (handles VPN ↔ tunnel switching)
        const current = getApiBase();
        const alt = current === FALLBACK_BASE ? DEFAULT_BASE : FALLBACK_BASE;
        const altResult = await checkHealthAt(alt);
        if (altResult !== null) {
            persistApiBase(alt);
            setApiBaseState(alt);
            setApiAvailable(true);
        } else {
            setApiAvailable(false);
        }
        setChecking(false);
    }, []);

    useEffect(() => {
        probe();
        intervalRef.current = setInterval(probe, 30_000);
        return () => clearInterval(intervalRef.current);
    }, [probe]);

    const setApiBase = useCallback((url: string) => {
        persistApiBase(url);
        setApiBaseState(url.replace(/\/+$/, ''));
        setChecking(true);
        // Re-probe immediately after changing URL
        checkHealth().then(r => {
            setApiAvailable(r !== null);
            setChecking(false);
        });
    }, []);

    return (
        <ApiContext.Provider value={{apiAvailable, apiBase, checking, setApiBase}}>
            {children}
        </ApiContext.Provider>
    );
};
