import {useCallback, useEffect, useMemo, useState} from 'react';
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
import CloseReasonChart from './CloseReasonChart';
import TimeframeRadar from './TimeframeRadar';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {formatDollar} from '../common/Util';
import {fetchDashboard as apiFetchDashboard, fetchCalendar as apiFetchCalendar} from '../../api/client';
import {DashboardData, CalendarData, PLDataPoint, ScoreDataPoint, DirectionDataPoint, TimeframeStats, TimeframeRow, ApiCalendarDay, DayData} from '../../context/Types';

type Period = '1H' | '4H' | '12H' | '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'All';

const PERIODS: Period[] = ['1H', '4H', '12H', '1D', '1W', '1M', '3M', 'YTD', '1Y', 'All'];

// ─── Period cutoff helpers ───────────────────────────────────────────────────
//
// periodCutoffISO returns a full ISO-8601 timestamp for the API (sub-day precision).
// periodCutoffDate returns a YYYY-MM-DD date string for filtering daily chart series.
//
// These are intentionally separate: the API needs sub-day precision to correctly
// compute stats for periods like 4H, while chart series (pl_series, calendar) are
// daily granularity and only need date filtering.

// When the market is closed (latest data > 2h old), anchor periods to the last
// data point so "1H" means "last hour of trading" instead of "1 hour ago from now".
function periodCutoffISO(period: Period, anchor?: dayjs.Dayjs): string | null {
    const ref = anchor ?? dayjs();
    switch (period) {
        case '1H':  return ref.subtract(1, 'hour').toISOString();
        case '4H':  return ref.subtract(4, 'hour').toISOString();
        case '12H': return ref.subtract(12, 'hour').toISOString();
        case '1D':  return ref.subtract(1, 'day').toISOString();
        case '1W':  return ref.subtract(7, 'day').toISOString();
        case '1M':  return ref.subtract(1, 'month').toISOString();
        case '3M':  return ref.subtract(3, 'month').toISOString();
        case 'YTD': return `${ref.year()}-01-01T00:00:00.000Z`;
        case '1Y':  return ref.subtract(1, 'year').toISOString();
        case 'All': return null;
    }
}

function periodCutoffDate(period: Period, anchor?: dayjs.Dayjs): string | null {
    const ref = anchor ?? dayjs();
    switch (period) {
        case '1H':  return ref.subtract(1, 'hour').format('YYYY-MM-DD');
        case '4H':  return ref.subtract(4, 'hour').format('YYYY-MM-DD');
        case '12H': return ref.subtract(12, 'hour').format('YYYY-MM-DD');
        case '1D':  return ref.subtract(1, 'day').format('YYYY-MM-DD');
        case '1W':  return ref.subtract(7, 'day').format('YYYY-MM-DD');
        case '1M':  return ref.subtract(1, 'month').format('YYYY-MM-DD');
        case '3M':  return ref.subtract(3, 'month').format('YYYY-MM-DD');
        case 'YTD': return `${ref.year()}-01-01`;
        case '1Y':  return ref.subtract(1, 'year').format('YYYY-MM-DD');
        case 'All': return null;
    }
}

function filterByDate<T extends { date: string }>(data: T[], cutoff: string | null): T[] {
    if (!cutoff) return data;
    return data.filter(d => d.date >= cutoff);
}

// ─── Stats computation from order-level data ─────────────────────────────────
//
// STAT INTEGRITY CONTRACT (frontend side):
//
// Every stat card value MUST come from ONE of these sources, never a mix:
//   1. API /api/dashboard?since=... (preferred — live, server-computed, sub-day precision)
//   2. Static day files aggregated client-side (fallback — covers API-down scenarios)
//   3. "All" period: dashboard.all_time (from API overlay or static dashboard.json)
//
// If neither source 1 nor 2 can provide a stat for the selected period, show "N/A".
// NEVER spread all-time stats and partially override — that mixes time windows and
// produces misleading numbers (e.g. all-time avg_win shown alongside 4H win rate).
//
// Win rate formula: winners / (winners + losers) — breakeven excluded.
// This matches the API. The static dashboard.json from alerts-engine uses
// winners / (winners + losers + breakeven) — a more conservative formula.
// When the API is live, its values take precedence.
//
// Future considerations:
// - Commissions/fees: if added, avg_win/avg_loss become net-of-fees. The API will
//   handle this; no frontend changes needed as long as the field semantics don't change.
// - Multi-currency: conversion must happen server-side before aggregation.
// - New order statuses: API handles classification; frontend just displays.
// - Partial fills: API treats each fill as a P&L event; frontend is unaffected.

interface OrderForStats {
    profit: number | null;
    created: string;
    closed: string | null;
    direction: string;
    status: string;
}

function computeStatsFromOrders(orders: OrderForStats[]): TimeframeStats {
    let totalPL = 0, longPL = 0, shortPL = 0;
    let winners = 0, losers = 0, breakeven = 0;
    let winSum = 0, lossSum = 0;
    let durSum = 0, durCount = 0;
    let closed = 0, pending = 0, open = 0;

    for (const o of orders) {
        if (o.status === 'PENDING') { pending++; continue; }
        if (o.status === 'FILLED') { open++; continue; }
        if (o.status !== 'CLOSED') continue;
        closed++;

        const p = o.profit ?? 0;
        totalPL += p;
        if (o.direction === 'Long') longPL += p;
        else shortPL += p;

        if (o.profit !== null && o.profit > 0) { winners++; winSum += p; }
        else if (o.profit !== null && o.profit < 0) { losers++; lossSum += p; }
        else breakeven++;

        if (o.created && o.closed) {
            const dur = (new Date(o.closed).getTime() - new Date(o.created).getTime()) / 60000;
            if (dur >= 0) { durSum += dur; durCount++; }
        }
    }

    const decided = winners + losers;
    const winRate = decided > 0 ? Math.round((winners / decided) * 10000) / 100 : null;
    const winLossRatio = losers > 0 ? Math.round((winners / losers) * 100) / 100 : null;
    const avgWin = winners > 0 ? Math.round((winSum / winners) * 100) / 100 : null;
    const avgLoss = losers > 0 ? Math.round((lossSum / losers) * 100) / 100 : null;
    const avgDur = durCount > 0 ? Math.round(durSum / durCount) : null;

    return {
        total_orders: orders.length,
        pending,
        open_positions: open,
        closed_orders: closed,
        total_pl: Math.round(totalPL * 100) / 100,
        winners,
        losers,
        breakeven,
        win_rate_pct: winRate,
        win_loss_ratio: winLossRatio,
        avg_win: avgWin,
        avg_loss: avgLoss,
        avg_time_in_trade_mins: avgDur,
        long_pl: Math.round(longPL * 100) / 100,
        short_pl: Math.round(shortPL * 100) / 100,
    };
}

export default function Dashboard() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [calendar, setCalendar] = useState<CalendarData | null>(null);
    const [period, setPeriod] = useState<Period>('All');
    const [liveStats, setLiveStats] = useState(false);
    const [selectedTimeframe, setSelectedTimeframe] = useState<string | null>(null);
    // API-computed stats for the selected period (null = not yet fetched or API unavailable)
    const [periodStats, setPeriodStats] = useState<TimeframeStats | null>(null);
    const [periodByTimeframe, setPeriodByTimeframe] = useState<TimeframeRow[] | null>(null);
    const [periodRecCounts, setPeriodRecCounts] = useState<Record<string, number> | null>(null);
    const [periodCloseReasonCounts, setPeriodCloseReasonCounts] = useState<Record<string, number> | null>(null);
    const [periodStatsKey, setPeriodStatsKey] = useState<string>('');

    useEffect(() => {
        // Always load static dashboard (has chart series the API doesn't serve)
        axios.get('/data/dashboard.json').then(r => setDashboard(r.data)).catch(console.error);

        if (apiAvailable) {
            // API for live stats overlay (all-time)
            apiFetchDashboard().then(apiData => {
                if (apiData) {
                    setDashboard(prev => prev
                        ? {
                            ...prev,
                            all_time: {...prev.all_time, ...apiData.all_time},
                            by_timeframe: apiData.by_timeframe,
                            recommendation_counts: apiData.recommendation_counts ?? prev.recommendation_counts,
                            close_reason_counts: apiData.close_reason_counts ?? prev.close_reason_counts,
                        }
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
                        const dateKey = day.date.length > 10 ? day.date.slice(0, 10) : day.date;
                        record[dateKey] = {pl: day.pl, winners: day.winners, losers: day.losers, total: day.total};
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

    // Detect market closed: if latest PL data point is >2h old, anchor to it.
    // This makes "1H" mean "last hour of trading" instead of "1 hour from now".
    const anchor = useMemo<dayjs.Dayjs | undefined>(() => {
        if (!dashboard?.pl_series?.length) return undefined;
        const lastDate = dashboard.pl_series[dashboard.pl_series.length - 1].date;
        const last = dayjs(lastDate).endOf('day');
        if (dayjs().diff(last, 'hour') > 2) return last;
        return undefined;
    }, [dashboard]);

    // Fetch period-filtered stats from the API when period changes.
    // This gives us server-computed, sub-day-accurate stats for all fields.
    useEffect(() => {
        if (period === 'All' || !apiAvailable) {
            setPeriodStats(null);
            setPeriodByTimeframe(null);
            setPeriodRecCounts(null);
            setPeriodCloseReasonCounts(null);
            setPeriodStatsKey('');
            return;
        }
        const since = periodCutoffISO(period, anchor);
        if (!since) return;

        const key = `${period}:${since}`;
        apiFetchDashboard(since).then(apiData => {
            if (apiData) {
                setPeriodStats(apiData.all_time as TimeframeStats);
                setPeriodByTimeframe(apiData.by_timeframe ?? null);
                setPeriodRecCounts(apiData.recommendation_counts ?? null);
                setPeriodCloseReasonCounts(apiData.close_reason_counts ?? null);
                setPeriodStatsKey(key);
            }
        });
    }, [period, apiAvailable, anchor]);

    const handleTimeframeClick = useCallback((tf: string | null) => {
        setSelectedTimeframe(tf);
    }, []);

    const dateCutoff = useMemo(() => periodCutoffDate(period, anchor), [period, anchor]);

    const filteredPL = useMemo<PLDataPoint[]>(() => {
        if (!dashboard) return [];
        const filtered = filterByDate(dashboard.pl_series, dateCutoff);
        let cum = 0;
        return filtered.map(d => {
            cum += d.daily_pl;
            return {...d, cumulative_pl: Math.round(cum * 100) / 100};
        });
    }, [dashboard, dateCutoff]);

    const filteredDirection = useMemo<DirectionDataPoint[]>(() => {
        if (!dashboard?.direction_series) return [];
        return filterByDate(dashboard.direction_series, dateCutoff);
    }, [dashboard, dateCutoff]);

    const filteredScores = useMemo<ScoreDataPoint[]>(() => {
        if (!dashboard?.score_series) return [];
        return filterByDate(dashboard.score_series, dateCutoff);
    }, [dashboard, dateCutoff]);

    const filteredCalendar = useMemo<CalendarData | null>(() => {
        if (!calendar || !dateCutoff) return calendar;
        const filtered: CalendarData = {};
        for (const [date, day] of Object.entries(calendar)) {
            if (date >= dateCutoff) filtered[date] = day;
        }
        return filtered;
    }, [calendar, dateCutoff]);

    // ─── Stats resolution ────────────────────────────────────────────────
    //
    // Priority order (highest to lowest):
    //   1. Timeframe filter selected → use that timeframe row from API/dashboard data
    //   2. Period == 'All' → use dashboard.all_time (API-overlaid if available)
    //   3. Period != 'All' + API available → use periodStats (API-computed for exact window)
    //   4. Period != 'All' + API unavailable → compute from static day files
    //
    // Rules:
    //   - NEVER spread all-time stats as a base and selectively override. Every stat
    //     in the result must come from the same time window.
    //   - If a source can't provide a field, that field must be null (shown as N/A).
    const filteredStats = useMemo<TimeframeStats | null>(() => {
        if (!dashboard) return null;

        // Timeframe filter: use the period-appropriate by_timeframe data
        if (selectedTimeframe) {
            const source = (period !== 'All' && periodByTimeframe && periodStatsKey.startsWith(period + ':'))
                ? periodByTimeframe
                : dashboard.by_timeframe;
            const tfRow = source.find(t => t.timeframe === selectedTimeframe);
            if (tfRow) return tfRow;
        }

        // All-time: use the dashboard all_time stats (API-overlaid when live)
        if (period === 'All') return dashboard.all_time;

        // Period filter with API: use server-computed stats (sub-day accurate, all fields)
        if (periodStats && periodStatsKey.startsWith(period + ':')) {
            return periodStats;
        }

        // Fallback: compute from static day files for the relevant date range.
        // This covers API-down scenarios. For sub-day periods this uses full-day
        // granularity from the day file (best available without the API).
        return computeStatsFromDayFiles(dateCutoff, period);
    }, [dashboard, period, selectedTimeframe, periodStats, periodByTimeframe, periodStatsKey, dateCutoff]);

    // Active by_timeframe data: period-filtered from API when available, otherwise all-time.
    // Sorted in a fixed order (scalp, intraday, swing) so chart colors/positions are stable.
    const TF_ORDER = ['scalp', 'intraday', 'swing'];
    const sortTf = (data: TimeframeRow[]) =>
        [...data].sort((a, b) => TF_ORDER.indexOf(a.timeframe) - TF_ORDER.indexOf(b.timeframe));

    const activeByTimeframe = useMemo(() => {
        const allTime = dashboard?.by_timeframe ?? [];
        if (period === 'All' || !periodByTimeframe || !periodStatsKey.startsWith(period + ':')) {
            return sortTf(allTime);
        }
        return sortTf(periodByTimeframe);
    }, [dashboard, period, periodByTimeframe, periodStatsKey]);

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
    const plDisplay = formatDollar(stats.total_pl);

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    {/* Period Selector + Active Filters */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                            {selectedTimeframe && (
                                <button
                                    onClick={() => setSelectedTimeframe(null)}
                                    className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                        isDarkMode
                                            ? 'bg-cyan-900/60 text-cyan-300 hover:bg-cyan-800/60'
                                            : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-cyan-400"/>
                                    {selectedTimeframe.charAt(0).toUpperCase() + selectedTimeframe.slice(1)}
                                    <span className="ml-1">&times;</span>
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                            {PERIODS.map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                        period === p
                                            ? 'bg-cyan-500 text-white'
                                            : `${isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Win Rate Chart — full width, most prominent */}
                    {filteredCalendar && Object.keys(filteredCalendar).length > 0 && (
                        <WinRateChart data={filteredCalendar} direction={filteredDirection} period={period}/>
                    )}

                    {/* Stat Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <StatCard label="Total P&L" value={plDisplay} color={plColor} live={liveStats && !selectedTimeframe && period === 'All'}/>
                        <StatCard
                            label="Win Rate"
                            value={stats.win_rate_pct != null ? `${Number(stats.win_rate_pct).toFixed(2)}%` : 'N/A'}
                            subtitle={`${stats.winners}W / ${stats.losers}L / ${stats.breakeven}BE`}
                            live={liveStats && !selectedTimeframe && period === 'All'}
                        />
                        <StatCard
                            label="Total Trades"
                            value={stats.total_orders}
                            subtitle={`${stats.closed_orders} closed`}
                            live={liveStats && !selectedTimeframe && period === 'All'}
                        />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        <PLChart data={filteredPL}/>
                        <TimeframeBreakdown
                            data={activeByTimeframe}
                            selectedTimeframe={selectedTimeframe}
                            onTimeframeClick={handleTimeframeClick}
                        />
                    </div>

                    {/* Recommendation + Close Reasons + Timeframe Radar */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                        {(() => {
                            const recData = (period !== 'All' && periodRecCounts && periodStatsKey.startsWith(period + ':'))
                                ? periodRecCounts
                                : dashboard.recommendation_counts;
                            return recData ? <RecommendationRadar data={recData}/> : null;
                        })()}
                        {(() => {
                            const crData = (period !== 'All' && periodCloseReasonCounts && periodStatsKey.startsWith(period + ':'))
                                ? periodCloseReasonCounts
                                : dashboard.close_reason_counts;
                            return crData ? <CloseReasonChart data={crData}/> : null;
                        })()}
                        <TimeframeRadar
                            data={activeByTimeframe}
                            selectedTimeframe={selectedTimeframe}
                            onTimeframeClick={handleTimeframeClick}
                        />
                    </div>

                    {/* Score Trend */}
                    {filteredScores.length > 0 && (
                        <div className="mb-6">
                            <ScoreTrendChart data={filteredScores} period={period}/>
                        </div>
                    )}

                    {/* More Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <StatCard
                            label="Avg Win"
                            value={stats.avg_win != null ? formatDollar(stats.avg_win) : 'N/A'}
                            color="green"
                        />
                        <StatCard
                            label="Avg Loss"
                            value={stats.avg_loss != null ? formatDollar(stats.avg_loss) : 'N/A'}
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

                    {/* Calendar — always shows full unfiltered data, not affected by period */}
                    {calendar && <CalendarHeatmap data={calendar}/>}
                </div>
            </div>
            <Foot/>
        </>
    );
}

// ─── Static day file fallback ────────────────────────────────────────────────
//
// When the API is unavailable, we compute period stats from the static day files
// that alerts-engine publishes. These contain per-hour blocks with individual
// order details, giving us enough granularity for accurate stats.
//
// For sub-day periods, we filter orders by their created timestamp within the
// hourly blocks. This gives approximate sub-hour precision (hour-level bucketing).

// Cache to avoid re-fetching day files on every render
const dayFileCache = new Map<string, DayData>();

async function fetchDayFile(date: string): Promise<DayData | null> {
    if (dayFileCache.has(date)) return dayFileCache.get(date)!;
    try {
        const [year, month, day] = date.split('-');
        const resp = await axios.get<DayData>(`/data/days/${year}/${month}/${day}.json`);
        dayFileCache.set(date, resp.data);
        return resp.data;
    } catch {
        return null;
    }
}

// Synchronous version that returns cached data or null (used in useMemo).
// The async fetch is triggered by the effect below.
function computeStatsFromDayFiles(dateCutoff: string | null, period: string): TimeframeStats | null {
    if (!dateCutoff) return null;

    // Determine which dates to load (today and possibly yesterday for sub-day periods)
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const dates = dateCutoff >= today ? [today] : dateCutoff >= yesterday ? [yesterday, today] : null;

    // For longer periods, we don't have a good synchronous fallback from day files
    // (would need to load many files). Return null to show N/A.
    if (!dates) return null;

    const isoCutoff = periodCutoffISO(period as Period);
    const orders: OrderForStats[] = [];

    for (const date of dates) {
        const dayData = dayFileCache.get(date);
        if (!dayData) {
            // Trigger async fetch for next render
            fetchDayFile(date);
            return null;
        }
        for (const hour of dayData.hours) {
            for (const o of hour.orders) {
                // For sub-day precision: filter by created timestamp
                if (isoCutoff && o.created < isoCutoff) continue;
                orders.push({
                    profit: o.profit,
                    created: o.created,
                    closed: o.closed,
                    direction: o.direction,
                    status: o.status,
                });
            }
        }
    }

    if (orders.length === 0) return null;
    return computeStatsFromOrders(orders);
}

function formatDuration(mins: number): string {
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
}
