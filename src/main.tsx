import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/Theme';
import './index.css';
const rootElement = document.getElementById('root');

if (rootElement) {
    const root = createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <ThemeProvider>
                <App/>
            </ThemeProvider>
        </React.StrictMode>
    );
} else {
    console.error("The 'root' element with ID 'root' was not found in the document.");
}
