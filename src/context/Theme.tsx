// ThemeContext.tsx
import React, {createContext, useContext, useEffect, useState} from 'react';

interface ThemeContextProps {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    width: number;
    adjustWidth: (number) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const useTheme = (): ThemeContextProps => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({children}) => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Try to get the theme preference from local storage
        const storedTheme = localStorage.getItem('theme');
        return storedTheme === 'dark';
    });

    const [width, setWidth] = useState<number>(innerWidth);

    const toggleDarkMode = () => {
        setIsDarkMode((prevMode) => !prevMode);
    };

    const adjustWidth = (w:number) => {
        setWidth(w)
    };

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('bg-gray-800');
        } else {
            document.documentElement.classList.remove('bg-gray-800');
        }
        // Store the theme preference in local storage
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    return (
        <ThemeContext.Provider value={{isDarkMode, toggleDarkMode, width, adjustWidth}}>
            {children}
        </ThemeContext.Provider>
    );
};
