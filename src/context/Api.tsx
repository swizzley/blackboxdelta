import React, {createContext, useContext, useEffect, useState, useCallback, useRef} from 'react';
import {checkHealth} from '../api/client';
import {getApiBase, setApiBase as persistApiBase} from '../api/config';

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
        setApiAvailable(result !== null);
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
