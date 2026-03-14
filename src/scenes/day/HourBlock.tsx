import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '../../context/Theme';
import {HourBlock as HourBlockType} from '../../context/Types';
import {ChevronDownIcon, ChevronRightIcon} from '@heroicons/react/20/solid';
import {formatDollar} from '../common/Util';
import dayjs from 'dayjs';

interface HourBlockProps {
    data: HourBlockType;
}

/** Tiny inline SVG donut showing W/L/BE split. */
function MiniDonut({wins, losses, breakeven, size = 32}: {wins: number; losses: number; breakeven: number; size?: number}) {
    const total = wins + losses + breakeven;
    if (total === 0) return null;

    const r = 12;
    const circumference = 2 * Math.PI * r;

    const winPct = wins / total;
    const lossPct = losses / total;

    const winLen = winPct * circumference;
    const lossLen = lossPct * circumference;

    return (
        <svg width={size} height={size} viewBox="0 0 32 32">
            <circle cx="16" cy="16" r={r} fill="none" stroke="#475569" strokeWidth="5" />
            {/* Win arc (green) */}
            <circle cx="16" cy="16" r={r} fill="none"
                stroke="#10b981" strokeWidth="5"
                strokeDasharray={`${winLen} ${circumference - winLen}`}
                strokeDashoffset="0"
                transform="rotate(-90 16 16)"
            />
            {/* Loss arc (red) */}
            <circle cx="16" cy="16" r={r} fill="none"
                stroke="#ef4444" strokeWidth="5"
                strokeDasharray={`${lossLen} ${circumference - lossLen}`}
                strokeDashoffset={`${-winLen}`}
                transform="rotate(-90 16 16)"
            />
            {/* Breakeven arc uses the base gray — already visible */}
        </svg>
    );
}

export default function HourBlock({data}: HourBlockProps) {
    const {isDarkMode} = useTheme();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);

    const s = data.summary;
    const plStr = formatDollar(s.total_pl);
    const plColor = s.total_pl > 0 ? 'text-emerald-500' : s.total_pl < 0 ? 'text-red-500' : (isDarkMode ? 'text-gray-300' : 'text-gray-600');

    // Derived stats from orders
    const closed = data.orders.filter(o => o.profit !== null && o.status === 'CLOSED');
    const bestTrade = closed.length > 0 ? closed.reduce((a, b) => (a.profit ?? 0) > (b.profit ?? 0) ? a : b) : null;
    const worstTrade = closed.length > 0 ? closed.reduce((a, b) => (a.profit ?? 0) < (b.profit ?? 0) ? a : b) : null;

    const longs = data.orders.filter(o => o.direction === 'Long').length;
    const shorts = data.orders.length - longs;

    // Duration stats from orders that have it
    const durations = closed.filter(o => o.duration_mins !== null).map(o => o.duration_mins!).sort((a, b) => a - b);
    const minDur = durations.length > 0 ? durations[0] : null;
    const maxDur = durations.length > 0 ? durations[durations.length - 1] : null;
    const medDur = durations.length > 0
        ? durations.length % 2 === 1
            ? durations[Math.floor(durations.length / 2)]
            : Math.round((durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2)
        : null;

    // Avg P&L per closed trade
    const avgPL = closed.length > 0 ? closed.reduce((sum, o) => sum + (o.profit ?? 0), 0) / closed.length : null;

    const td = `px-3 py-1.5 text-sm whitespace-nowrap`;

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow transition-colors duration-500`}>
            <button
                onClick={() => setExpanded(!expanded)}
                className={`w-full flex items-center justify-between p-4 ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'} rounded-lg`}
            >
                {/* Left side: chevron, time, donut, trade count */}
                <div className="flex items-center gap-3">
                    {expanded
                        ? <ChevronDownIcon className="h-5 w-5 text-gray-400"/>
                        : <ChevronRightIcon className="h-5 w-5 text-gray-400"/>
                    }
                    <span className={`text-lg font-semibold tabular-nums ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {String(data.hour).padStart(2, '0')}:00
                    </span>
                    <MiniDonut wins={s.winners} losses={s.losers} breakeven={s.breakeven} />
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {s.total_orders} trade{s.total_orders !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Right side: stats chips */}
                <div className="flex items-center gap-4 text-sm">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                        {s.winners}W / {s.losers}L
                        {s.win_rate_pct !== null && <span className="ml-1 text-xs">({s.win_rate_pct}%)</span>}
                    </span>
                    <span className={`hidden sm:inline text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {longs}L/{shorts}S
                    </span>
                    {medDur !== null && (
                        <span className={`hidden md:inline text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} title={`Duration: ${minDur}m / ${medDur}m / ${maxDur}m (min/med/max)`}>
                            {minDur}–{maxDur}m
                        </span>
                    )}
                    {avgPL !== null && (
                        <span className={`hidden md:inline text-xs ${avgPL > 0 ? 'text-emerald-500' : avgPL < 0 ? 'text-red-500' : (isDarkMode ? 'text-gray-500' : 'text-gray-400')}`} title="Avg P&L per trade">
                            avg {formatDollar(avgPL)}
                        </span>
                    )}
                    {bestTrade && bestTrade.profit !== null && bestTrade.profit > 0 && (
                        <span className="hidden lg:inline text-xs text-emerald-500" title={`Best: ${bestTrade.symbol.replace('_','/')}`}>
                            ▲ {formatDollar(bestTrade.profit)}
                        </span>
                    )}
                    {worstTrade && worstTrade.profit !== null && worstTrade.profit < 0 && (
                        <span className="hidden lg:inline text-xs text-red-500" title={`Worst: ${worstTrade.symbol.replace('_','/')}`}>
                            ▼ {formatDollar(worstTrade.profit)}
                        </span>
                    )}
                    <span className={`font-semibold ${plColor}`}>{plStr}</span>
                </div>
            </button>

            {expanded && (
                <div className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-100'}`}>
                    {/* Mini stats row */}
                    <div className={`grid grid-cols-4 gap-2 p-3 text-center text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        <div>Win Rate: <span className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>{s.win_rate_pct !== null ? `${s.win_rate_pct}%` : 'N/A'}</span></div>
                        <div>Avg Win: <span className="text-emerald-500">{s.avg_win !== null ? s.avg_win.toFixed(5) : 'N/A'}</span></div>
                        <div>Avg Loss: <span className="text-red-500">{s.avg_loss !== null ? s.avg_loss.toFixed(5) : 'N/A'}</span></div>
                        <div>Duration: <span className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>{minDur !== null ? `${minDur}/${medDur}/${maxDur}m` : 'N/A'}</span></div>
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
                            <th className="px-3 py-1.5 text-left">Reason</th>
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
                                <td className={`${td} text-xs`}>{o.close_reason ?? '-'}</td>
                                <td className={`${td} text-right font-medium ${
                                    o.profit === null ? '' :
                                        o.profit > 0 ? 'text-emerald-500' :
                                            o.profit < 0 ? 'text-red-500' : ''
                                }`}>
                                    {o.profit !== null ? formatDollar(o.profit) : '-'}
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
