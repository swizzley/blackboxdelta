import {useTheme} from '../../context/Theme';

interface StatCardProps {
    label: string;
    value: string | number;
    subtitle?: string;
    color?: 'green' | 'red' | 'default';
    live?: boolean;
}

export default function StatCard({label, value, subtitle, color = 'default', live}: StatCardProps) {
    const {isDarkMode} = useTheme();

    const valueColor =
        color === 'green' ? 'text-emerald-500' :
            color === 'red' ? 'text-red-500' :
                isDarkMode ? 'text-white' : 'text-gray-900';

    return (
        <div
            className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {label}
                {live && <span className="ml-1.5 inline-flex items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">LIVE</span>}
            </p>
            <p className={`mt-1 text-2xl font-semibold ${valueColor}`}>{value}</p>
            {subtitle && (
                <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{subtitle}</p>
            )}
        </div>
    );
}
