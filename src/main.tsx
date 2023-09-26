import React from 'react';
import { createRoot } from 'react-dom/client'; // Update the import path
import App from './App';
import { ThemeProvider } from './context/Theme';
import './index.css';

const root = createRoot(document.getElementById('root'));

root.render(
    <React.StrictMode>
        <ThemeProvider>
            <App />
        </ThemeProvider>
    </React.StrictMode>
);
