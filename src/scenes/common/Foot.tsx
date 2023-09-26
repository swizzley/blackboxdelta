import {useTheme} from "../../context/Theme";


export default function Foot() {
    const { isDarkMode } = useTheme();
    return (
        <footer className={`${isDarkMode ? 'bg-dark' : 'bg-light'} transition-colors duration-500 fixed bottom-0 w-full`}>
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
                <div className="border-t border-gray-300 py-8 text-center text-sm text-gray-300 sm:text-left">
                    <span className="block sm:inline">&copy; 2023 Black Box Delta LLC</span>{' '}
                    <span className="block sm:inline">All rights reserved.</span>
                </div>
            </div>
        </footer>
    );
}
