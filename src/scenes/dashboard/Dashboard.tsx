import {useEffect, useMemo, useState} from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import StatCard from '../common/StatCard';
import PLChart from './PLChart';
import TimeframeBreakdown from './TimeframeBreakdown';
import CalendarHeatmap from './CalendarHeatmap';
import WinRateChart from './WinRateChart';
import ScoreTrendChart from './ScoreTrendChart';
import RecommendationRadar from './RecommendationRadar';
import TimeframeRadar from './TimeframeRadar';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {fetchDashboard as apiFetchDashboard, fetchCalendar as apiFetchCalendar} from '../../api/client';
import {DashboardData, CalendarData, PLDataPoint, ScoreDataPoint, DirectionDataPoint, ApiCalendarDay} from '../../context/Types';

type Period = '1H' | '4H' | '12H' | '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'All';

const PERIODS: Period[] = ['1H', '4H', '12H', '1D', '1W', '1M', '3M', 'YTD', '1Y', 'All'];

function periodCutoff(period: Period): string | null {
    const now = dayjs();
    switch (period) {
        case '1H':  return now.subtract(1, 'hour').format('YYYY-MM-DD');
        case '4H':  return now.subtract(4, 'hour').format('YYYY-MM-DD');
        case '12H': return now.subtract(12, 'hour').format('YYYY-MM-DD');
        case '1D':  return now.subtract(1, 'day').format('YYYY-MM-DD');
        case '1W':  return now.subtract(7, 'day').format('YYYY-MM-DD');
        case '1M':  return now.subtract(1, 'month').format('YYYY-MM-DD');
        case '3M':  return now.subtract(3, 'month').format('YYYY-MM-DD');
        case 'YTD': return `${now.year()}-01-01`;
        case '1Y':  return now.subtract(1, 'year').format('YYYY-MM-DD');
        case 'All': return null;
    }
}

function filterByDate<T extends { date: string }>(data: T[], cutoff: string | null): T[] {
    if (!cutoff) return data;
    return data.filter(d => d.date >= cutoff);
}

export default function Dashboard() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [calendar, setCalendar] = useState<CalendarData | null>(null);
    const [period, setPeriod] = useState<Period>('All');
    const [liveStats, setLiveStats] = useState(false);

    useEffect(() => {
        // Always load static dashboard (has chart series the API doesn't serve)
        axios.get('/data/dashboard.json').then(r => setDashboard(r.data)).catch(console.error);

        if (apiAvailable) {
            // API for live stats overlay
            apiFetchDashboard().then(apiData => {
                if (apiData) {
                    setDashboard(prev => prev
                        ? {...prev, all_time: {...prev.all_time, ...apiData.all_time}, by_timeframe: apiData.by_timeframe}
                        : prev
                    );
                    setLiveStats(true);
                }
            });
            // API for calendar
            apiFetchCalendar(365).then(apiCal => {
                if (apiCal) {
                    const record: CalendarData = {};
                    for (const day of apiCal as ApiCalendarDay[]) {
                        record[day.date] = {pl: day.pl, winners: day.winners, losers: day.losers, total: day.total};
                    }
                    setCalendar(record);
                } else {
                    axios.get('/data/calendar.json').then(r => setCalendar(r.data)).catch(console.error);
                }
            });
        } else {
            setLiveStats(false);
            axios.get('/data/calendar.json').then(r => setCalendar(r.data)).catch(console.error);
        }
    }, [apiAvailable]);

    const cutoff = useMemo(() => periodCutoff(period), [period]);

    const filteredPL = useMemo<PLDataPoint[]>(() => {
        if (!dashboard) return [];
        const filtered = filterByDate(dashboard.pl_series, cutoff);
        // Recalculate cumulative P&L from filtered data
        let cum = 0;
        return filtered.map(d => {
            cum += d.daily_pl;
            return {...d, cumulative_pl: Math.round(cum * 100) / 100};
        });
    }, [dashboard, cutoff]);

    const filteredDirection = useMemo<DirectionDataPoint[]>(() => {
        if (!dashboard?.direction_series) return [];
        return filterByDate(dashboard.direction_series, cutoff);
    }, [dashboard, cutoff]);

    const filteredScores = useMemo<ScoreDataPoint[]>(() => {
        if (!dashboard?.score_series) return [];
        return filterByDate(dashboard.score_series, cutoff);
    }, [dashboard, cutoff]);

    const filteredCalendar = useMemo<CalendarData | null>(() => {
        if (!calendar || !cutoff) return calendar;
        const filtered: CalendarData = {};
        for (const [date, day] of Object.entries(calendar)) {
            if (date >= cutoff) filtered[date] = day;
        }
        return filtered;
    }, [calendar, cutoff]);

    // Recompute stats from filtered data
    const filteredStats = useMemo(() => {
        if (!dashboard) return null;
        if (period === 'All') return dashboard.all_time;

        // Recompute from filtered calendar data (per-day wins/losses/totals)
        if (filteredCalendar && Object.keys(filteredCalendar).length > 0) {
            let winners = 0, losers = 0, total = 0;
            for (const day of Object.values(filteredCalendar)) {
                winners += day.winners;
                losers += day.losers;
                total += day.total;
            }
            const breakeven = total - winners - losers;
            const totalPL = filteredPL.reduce((sum, d) => sum + d.daily_pl, 0);
            const winRate = total > 0 ? Math.round((winners / total) * 10000) / 100 : null;
            return {
                ...dashboard.all_time,
                total_pl: Math.round(totalPL * 100) / 100,
                total_orders: total,
                closed_orders: total,
                winners,
                losers,
                breakeven,
                win_rate_pct: winRate,
            };
        }

        const totalPL = filteredPL.reduce((sum, d) => sum + d.daily_pl, 0);
        return {
            ...dashboard.all_time,
            total_pl: Math.round(totalPL * 100) / 100,
        };
    }, [dashboard, period, filteredPL, filteredCalendar]);

    if (!dashboard || !filteredStats) {
        return (
            <>
                <Nav/>
                <div className={`min-h-screen ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                        <p className={`text-center py-20 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Loading dashboard...
                        </p>
                    </div>
                </div>
                <Foot/>
            </>
        );
    }

    const stats = filteredStats;
    const plColor = stats.total_pl >= 0 ? 'green' : 'red';
    const plDisplay = `${stats.total_pl >= 0 ? '+' : '-'}$${Math.abs(stats.total_pl).toFixed(2)}`;

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    {/* Period Selector */}
                    <div className="flex items-center justify-end gap-1 mb-4">
                        {PERIODS.map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                    period === p
                                        ? 'bg-cyan-500 text-white'
                                        : `${isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    {/* Win Rate Chart — full width, most prominent */}
                    {filteredCalendar && Object.keys(filteredCalendar).length > 0 && (
                        <WinRateChart data={filteredCalendar} direction={filteredDirection}/>
                    )}

                    {/* Stat Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <StatCard label="Total P&L" value={plDisplay} color={plColor} live={liveStats}/>
                        <StatCard
                            label="Win Rate"
                            value={stats.win_rate_pct !== null ? `${stats.win_rate_pct}%` : 'N/A'}
                            subtitle={`${stats.winners}W / ${stats.losers}L / ${stats.breakeven}BE`}
                            live={liveStats}
                        />
                        <StatCard
                            label="Total Trades"
                            value={stats.total_orders}
                            subtitle={`${stats.closed_orders} closed`}
                            live={liveStats}
                        />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        <PLChart data={filteredPL}/>
                        <TimeframeBreakdown data={dashboard.by_timeframe}/>
                    </div>

                    {/* Recommendation + Timeframe Radar */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        {dashboard.recommendation_counts && <RecommendationRadar data={dashboard.recommendation_counts}/>}
                        <TimeframeRadar data={dashboard.by_timeframe}/>
                    </div>

                    {/* Score Trend (needs 2+ days of data) */}
                    {filteredScores.length > 1 && (
                        <div className="mb-6">
                            <ScoreTrendChart data={filteredScores}/>
                        </div>
                    )}

                    {/* More Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <StatCard
                            label="Avg Win"
                            value={stats.avg_win != null ? `+$${stats.avg_win.toFixed(2)}` : 'N/A'}
                            color="green"
                        />
                        <StatCard
                            label="Avg Loss"
                            value={stats.avg_loss != null ? `-$${Math.abs(stats.avg_loss).toFixed(2)}` : 'N/A'}
                            color="red"
                        />
                        <StatCard
                            label="W/L Ratio"
                            value={stats.win_loss_ratio != null ? stats.win_loss_ratio.toFixed(2) : 'N/A'}
                        />
                        <StatCard
                            label="Avg Trade Duration"
                            value={stats.avg_time_in_trade_mins != null ? formatDuration(stats.avg_time_in_trade_mins) : 'N/A'}
                        />
                    </div>

                    {/* Calendar */}
                    {filteredCalendar && <CalendarHeatmap data={filteredCalendar}/>}
                </div>
            </div>
            <Foot/>
        </>
    );
}

function formatDuration(mins: number): string {
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
}
