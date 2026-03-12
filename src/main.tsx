import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/Theme';
import { ApiProvider } from './context/Api';
import { DeviceAuthProvider } from './context/DeviceAuth';
import { initFingerprint } from './api/fingerprint';
import './index.css';

// Eagerly initialize device fingerprint (cached for all subsequent API calls)
initFingerprint();

const rootElement = document.getElementById('root');

if (rootElement) {
    const root = createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <ThemeProvider>
                <ApiProvider>
                    <DeviceAuthProvider>
                        <App/>
                    </DeviceAuthProvider>
                </ApiProvider>
            </ThemeProvider>
        </React.StrictMode>
    );
} else {
    console.error("The 'root' element with ID 'root' was not found in the document.");
}
