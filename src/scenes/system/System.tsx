import {useEffect, useState} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {fetchSystem} from '../../api/client';
import type {ApiSystem} from '../../context/Types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function System() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const [system, setSystem] = useState<ApiSystem | null>(null);

    useEffect(() => {
        if (!apiAvailable) { setSystem(null); return; }
        fetchSystem().then(setSystem);
        const interval = setInterval(() => fetchSystem().then(setSystem), 15_000);
        return () => clearInterval(interval);
    }, [apiAvailable]);

    const card = `${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-4 transition-colors duration-500`;
    const heading = `text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const labelCl = `text-sm ${muted}`;
    const valCl = `text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`;

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    <h1 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>System Health</h1>

                    {!apiAvailable ? (
                        <div className={`${card} text-center py-12`}>
                            <p className={`text-lg ${muted}`}>API unavailable — connect to VPN to view system health</p>
                        </div>
                    ) : !system ? (
                        <p className={`text-center py-20 ${muted}`}>Loading...</p>
                    ) : (
                        <>
                            {/* Overview Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className={card}>
                                    <p className={labelCl}>API Status</p>
                                    <p className={`text-2xl font-bold text-emerald-500`}>{system.status.toUpperCase()}</p>
                                </div>
                                <div className={card}>
                                    <p className={labelCl}>Uptime</p>
                                    <p className={valCl}>{formatUptime(system.uptime)}</p>
                                </div>
                                <div className={card}>
                                    <p className={labelCl}>Markets</p>
                                    <p className={valCl}>{system.markets.enabled}<span className={`text-sm font-normal ${muted}`}>/{system.markets.total}</span></p>
                                </div>
                                <div className={card}>
                                    <p className={labelCl}>Services</p>
                                    <p className={valCl}>{system.services.length}</p>
                                </div>
                            </div>

                            {/* Services */}
                            <div className={`${card} mb-6`}>
                                <h2 className={heading}>Services</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                                        <tr>
                                            <th className="text-left py-2 px-2 font-medium">Service</th>
                                            <th className="text-left py-2 px-2 font-medium">Commit</th>
                                            <th className="text-left py-2 px-2 font-medium">Message</th>
                                            <th className="text-left py-2 px-2 font-medium">Updated</th>
                                        </tr>
                                        </thead>
                                        <tbody className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>
                                        {system.services.map(s => (
                                            <tr key={s.service} className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-100'}`}>
                                                <td className="py-2 px-2 font-medium">{s.service}</td>
                                                <td className="py-2 px-2 font-mono text-cyan-500 text-xs">{s.sha.slice(0, 8)}</td>
                                                <td className={`py-2 px-2 text-xs truncate max-w-xs ${muted}`}>{s.message}</td>
                                                <td className={`py-2 px-2 text-xs ${muted}`}>{dayjs(s.updated_at).fromNow()}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Database Stats */}
                            <div className={`${card} mb-6`}>
                                <h2 className={heading}>Database</h2>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {([
                                        ['Orders', system.database.orders],
                                        ['Alerts', system.database.alerts],
                                        ['Prices (Daily)', system.database.prices],
                                        ['Prices (15m)', system.database.prices_15m],
                                        ['Prices (1m)', system.database.prices_1m],
                                        ['Signals (Daily)', system.database.signals],
                                        ['Signals (15m)', system.database.signals_15m],
                                        ['Signals (1m)', system.database.signals_1m],
                                    ] as [string, number][]).map(([label, count]) => (
                                        <div key={label} className={`rounded-lg p-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                                            <p className={`text-xs ${muted}`}>{label}</p>
                                            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                {count.toLocaleString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Foot/>
        </>
    );
}

function formatUptime(s: string): string {
    // Go duration string like "2h30m15s" or "1h0m0s"
    const match = s.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    if (!match) return s;
    const h = parseInt(match[1] || '0');
    const m = parseInt(match[2] || '0');
    if (h >= 24) {
        const d = Math.floor(h / 24);
        const rh = h % 24;
        return `${d}d ${rh}h`;
    }
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}
