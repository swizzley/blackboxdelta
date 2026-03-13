import {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import StatCard from '../common/StatCard';
import HourBlock from './HourBlock';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {DayData} from '../../context/Types';
import {formatDollar} from '../common/Util';
import {fetchDay} from '../../api/client';
import dayjs from 'dayjs';

export default function DayDetail() {
    const {isDarkMode} = useTheme();
    const {apiAvailable, checking} = useApi();
    const {year, month, day} = useParams();
    const [data, setData] = useState<DayData | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (checking) return;
        if (!apiAvailable) {
            setError(true);
            return;
        }
        setError(false);
        fetchDay(`${year}-${month}-${day}`)
            .then(r => {
                if (r) setData(r);
                else setError(true);
            })
            .catch(() => setError(true));
    }, [year, month, day, apiAvailable, checking]);

    const dateDisplay = dayjs(`${year}-${month}-${day}`).format('dddd, MMMM D, YYYY');

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    {/* Breadcrumb */}
                    <nav className="mb-4">
                        <ol className={`flex text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <li><a href="/" className="hover:text-cyan-500">Dashboard</a></li>
                            <li className="mx-2">/</li>
                            <li>{dateDisplay}</li>
                        </ol>
                    </nav>

                    {error ? (
                        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-12 shadow text-center`}>
                            <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {apiAvailable ? 'No data for this day.' : 'Day detail requires VPN access.'}
                            </p>
                            {!apiAvailable && (
                                <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Connect to VPN to view daily order breakdowns.
                                </p>
                            )}
                        </div>
                    ) : !data ? (
                        <p className={`text-center py-20 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
                    ) : (
                        <>
                            {/* Day Summary */}
                            <h1 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {dateDisplay}
                            </h1>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <StatCard
                                    label="Day P&L"
                                    value={formatDollar(data.summary.total_pl)}
                                    color={data.summary.total_pl >= 0 ? 'green' : 'red'}
                                />
                                <StatCard
                                    label="Win Rate"
                                    value={data.summary.win_rate_pct !== null ? `${data.summary.win_rate_pct}%` : 'N/A'}
                                    subtitle={`${data.summary.winners}W / ${data.summary.losers}L`}
                                    tooltip={data.summary.avg_win && data.summary.avg_loss ? `R:R ${Math.abs(data.summary.avg_win / data.summary.avg_loss).toFixed(2)}:1 · Breakeven WR: ${((1 / (1 + Math.abs(data.summary.avg_win / data.summary.avg_loss))) * 100).toFixed(1)}%` : undefined}
                                />
                                <StatCard
                                    label="Total Trades"
                                    value={data.summary.total_orders}
                                />
                                <StatCard
                                    label="Avg Duration"
                                    value={data.summary.avg_time_in_trade_mins !== null ? `${data.summary.avg_time_in_trade_mins}m` : 'N/A'}
                                />
                            </div>

                            {/* Timeframe breakdown for the day */}
                            {data.summary.by_timeframe && data.summary.by_timeframe.length > 0 && (
                                <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow mb-6 transition-colors duration-500`}>
                                    <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>By Timeframe</h3>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        {data.summary.by_timeframe.map(tf => (
                                            <div key={tf.timeframe}>
                                                <p className={`text-xs uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{tf.timeframe}</p>
                                                <p className={`text-lg font-semibold ${tf.total_pl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {formatDollar(tf.total_pl)}
                                                </p>
                                                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {tf.total_orders} trades | {tf.win_rate_pct ?? 0}% WR
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Hourly breakdown */}
                            <h2 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                Hourly Breakdown
                            </h2>
                            <div className="space-y-3">
                                {data.hours.map(h => (
                                    <HourBlock key={h.hour} data={h}/>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Foot/>
        </>
    );
}
