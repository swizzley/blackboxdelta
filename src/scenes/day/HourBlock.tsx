import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '../../context/Theme';
import {HourBlock as HourBlockType} from '../../context/Types';
import {ChevronDownIcon, ChevronRightIcon} from '@heroicons/react/20/solid';
import dayjs from 'dayjs';

interface HourBlockProps {
    data: HourBlockType;
}

export default function HourBlock({data}: HourBlockProps) {
    const {isDarkMode} = useTheme();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(true);

    const s = data.summary;
    const plStr = `${s.total_pl >= 0 ? '+' : '-'}$${Math.abs(s.total_pl).toFixed(2)}`;
    const plColor = s.total_pl > 0 ? 'text-emerald-500' : s.total_pl < 0 ? 'text-red-500' : (isDarkMode ? 'text-gray-300' : 'text-gray-600');

    const td = `px-3 py-1.5 text-sm whitespace-nowrap`;

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow transition-colors duration-500`}>
            <button
                onClick={() => setExpanded(!expanded)}
                className={`w-full flex items-center justify-between p-4 ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'} rounded-lg`}
            >
                <div className="flex items-center gap-3">
                    {expanded
                        ? <ChevronDownIcon className="h-5 w-5 text-gray-400"/>
                        : <ChevronRightIcon className="h-5 w-5 text-gray-400"/>
                    }
                    <span className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {String(data.hour).padStart(2, '0')}:00
                    </span>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {s.total_orders} trade{s.total_orders !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {s.winners}W / {s.losers}L
                    </span>
                    <span className={`font-semibold ${plColor}`}>{plStr}</span>
                </div>
            </button>

            {expanded && (
                <div className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-100'}`}>
                    {/* Mini stats row */}
                    <div className={`grid grid-cols-4 gap-2 p-3 text-center text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        <div>Win Rate: <span className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>{s.win_rate_pct !== null ? `${s.win_rate_pct}%` : 'N/A'}</span></div>
                        <div>Avg Win: <span className="text-emerald-500">{s.avg_win !== null ? `+${s.avg_win.toFixed(2)}` : 'N/A'}</span></div>
                        <div>Avg Loss: <span className="text-red-500">{s.avg_loss !== null ? s.avg_loss.toFixed(2) : 'N/A'}</span></div>
                        <div>Avg Duration: <span className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>{s.avg_time_in_trade_mins !== null ? `${s.avg_time_in_trade_mins}m` : 'N/A'}</span></div>
                    </div>

                    {/* Orders table */}
                    <table className="w-full">
                        <thead className={isDarkMode ? 'bg-slate-700/30' : 'bg-gray-50'}>
                        <tr className={`text-xs uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            <th className="px-3 py-1.5 text-left">Time</th>
                            <th className="px-3 py-1.5 text-left">Symbol</th>
                            <th className="px-3 py-1.5 text-left">Dir</th>
                            <th className="px-3 py-1.5 text-left">TF</th>
                            <th className="px-3 py-1.5 text-left">Status</th>
                            <th className="px-3 py-1.5 text-right">P&L</th>
                        </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700/50' : 'divide-gray-50'}`}>
                        {data.orders.map(o => (
                            <tr
                                key={o.id}
                                onClick={() => navigate(`/trade/${o.created.slice(0,10).replace(/-/g,'/')}/${o.id}`)}
                                className={`cursor-pointer ${isDarkMode ? 'hover:bg-slate-700/50 text-gray-200' : 'hover:bg-gray-50 text-gray-700'}`}
                            >
                                <td className={td}>{dayjs(o.created).format('HH:mm:ss')}</td>
                                <td className={`${td} font-medium`}>{o.symbol.replace('_', '/')}</td>
                                <td className={td}>
                                    <span className={o.direction === 'Long' ? 'text-emerald-500' : 'text-red-500'}>{o.direction}</span>
                                </td>
                                <td className={td}>{o.timeframe}</td>
                                <td className={td}>{o.status}</td>
                                <td className={`${td} text-right font-medium ${
                                    o.profit === null ? '' :
                                        o.profit > 0 ? 'text-emerald-500' :
                                            o.profit < 0 ? 'text-red-500' : ''
                                }`}>
                                    {o.profit !== null ? `${o.profit >= 0 ? '+' : '-'}$${Math.abs(o.profit).toFixed(2)}` : '-'}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
