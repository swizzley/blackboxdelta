import {useEffect, useState, type ReactNode} from 'react';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import dayjs from 'dayjs';
import {useTheme} from '../../context/Theme';
import Tooltip from '../common/Tooltip';
import {CalendarData, CalendarDay, DayData} from '../../context/Types';

interface WinRateChartProps {
    data: CalendarData;
    period?: string;
    breakevenTooltip?: ReactNode;
}

export default function WinRateChart({data, period, breakevenTooltip}: WinRateChartProps) {
    const {isDarkMode} = useTheme();
    const [hourlyData, setHourlyData] = useState<{labels: string[], entries: CalendarDay[]} | null>(null);

    const isHourPeriod = period === '1H' || period === '4H' || period === '12H' || period === '1D';

    // Fetch hourly data from day files when an hour period is selected.
    // For periods that span midnight (e.g. 12H at 8am), fetch yesterday too.
    useEffect(() => {
        if (!isHourPeriod) {
            setHourlyData(null);
            return;
        }
        const now = dayjs();
        let hoursBack = 24;
        if (period === '1H') hoursBack = 1;
        else if (period === '4H') hoursBack = 4;
        else if (period === '12H') hoursBack = 12;

        const cutoff = now.subtract(hoursBack, 'hour');
        const today = now.format('YYYY/MM/DD');
        const yesterday = now.subtract(1, 'day').format('YYYY/MM/DD');
        const needYesterday = cutoff.format('YYYY-MM-DD') < now.format('YYYY-MM-DD');

        const fetches: Promise<DayData | null>[] = [];
        if (needYesterday) fetches.push(axios.get<DayData>(`/data/days/${yesterday}.json`).then(r => r.data).catch(() => null));
        fetches.push(axios.get<DayData>(`/data/days/${today}.json`).then(r => r.data).catch(() => null));

        Promise.all(fetches).then(results => {
            interface HourEntry { dayLabel: string; hour: number; summary: typeof results[0] extends DayData | null ? NonNullable<typeof results[0]>['hours'][0]['summary'] : never }
            const allHours: HourEntry[] = [];

            for (const dayData of results) {
                if (!dayData?.hours) continue;
                for (const h of dayData.hours) {
                    const hourTime = dayjs(`${dayData.date}T${String(h.hour).padStart(2, '0')}:00:00`);
                    if (hourTime.isBefore(cutoff) || hourTime.isAfter(now)) continue;
                    allHours.push({dayLabel: dayData.date, hour: h.hour, summary: h.summary});
                }
            }

            if (allHours.length === 0) {
                setHourlyData(null);
                return;
            }

            const labels = allHours.map(h => {
                // Show date prefix if data spans multiple days
                return needYesterday
                    ? `${h.dayLabel.slice(5)} ${String(h.hour).padStart(2, '0')}:00`
                    : `${String(h.hour).padStart(2, '0')}:00`;
            });
            const entries: CalendarDay[] = allHours.map(h => ({
                pl: h.summary.total_pl,
                winners: h.summary.winners,
                losers: h.summary.losers,
                total: h.summary.total_orders,
            }));
            setHourlyData({labels, entries});
        });
    }, [isHourPeriod, period]);

    // Use hourly data for hour periods, daily data otherwise
    const useHourly = isHourPeriod && hourlyData && hourlyData.entries.length > 0;

    const labels: string[] = useHourly
        ? hourlyData!.labels
        : Object.keys(data).sort().map(d => {
            const dt = dayjs(d);
            const dateCount = Object.keys(data).length;
            if (dateCount <= 7) return dt.format('ddd M/D');
            if (dateCount <= 90) return dt.format('M/D');
            return dt.format("MMM 'YY");
        });

    const entries: CalendarDay[] = useHourly
        ? hourlyData!.entries
        : Object.keys(data).sort().map(d => data[d]);

    const rawDates = Object.keys(data).sort();

    // Compute rolling win rates and cumulative breakeven
    let cumWins = 0, cumTotal = 0;
    let cumWinPL = 0, cumLossPL = 0;
    let cumWinners = 0, cumLosers = 0;

    const pointWinRate: (number | null)[] = [];
    const rollingWinRate: (number | null)[] = [];
    const breakevenWR: (number | null)[] = [];
    const winCounts: number[] = [];
    const lossCounts: number[] = [];

    for (const entry of entries) {
        const closed = entry.winners + entry.losers;
        cumWins += entry.winners;
        cumTotal += closed;
        cumWinners += entry.winners;
        cumLosers += entry.losers;
        cumWinPL += entry.win_pl ?? 0;
        cumLossPL += entry.loss_pl ?? 0;
        winCounts.push(entry.winners);
        lossCounts.push(entry.losers);
        pointWinRate.push(closed > 0 ? Math.round(entry.winners / closed * 1000) / 10 : null);
        rollingWinRate.push(cumTotal > 0 ? Math.round(cumWins / cumTotal * 1000) / 10 : null);

        // Breakeven WR = 1 / (1 + R:R) * 100, where R:R = avg_win / |avg_loss|
        if (cumWinners > 0 && cumLosers > 0 && cumLossPL !== 0) {
            const avgWin = cumWinPL / cumWinners;
            const avgLoss = Math.abs(cumLossPL / cumLosers);
            const rr = avgWin / avgLoss;
            breakevenWR.push(Math.round((1 / (1 + rr)) * 1000) / 10);
        } else {
            breakevenWR.push(null);
        }
    }

    const hasBreakeven = breakevenWR.some(v => v !== null);

    const labelCount = labels.length;
    const pointLabel = useHourly ? 'Hourly Win Rate' : 'Daily Win Rate';

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
                const idx = params[0]?.dataIndex ?? 0;
                const header = useHourly ? labels[idx] : (rawDates[idx] ?? labels[idx]);
                let html = `<b>${header}</b>`;
                for (const p of params) {
                    if (p.value === null || p.value === undefined) continue;
                    const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:4px;"></span>`;
                    if (p.seriesName === 'Winners' || p.seriesName === 'Losers') {
                        html += `<br/>${marker}${p.seriesName}: <b>${p.value}</b>`;
                    } else {
                        html += `<br/>${marker}${p.seriesName}: <b>${p.value}%</b>`;
                    }
                }
                return html;
            },
        },
        legend: {
            type: 'scroll',
            data: [
                {name: pointLabel, itemStyle: {color: {type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{offset: 0, color: '#10b981'}, {offset: 0.5, color: '#10b981'}, {offset: 0.5, color: '#ef4444'}, {offset: 1, color: '#ef4444'}]}}},
                'Cumulative', ...(hasBreakeven ? ['Breakeven'] : []), 'Winners', 'Losers',
            ],
            textStyle: {color: isDarkMode ? '#9ca3af' : '#374151', fontSize: 11},
            pageTextStyle: {color: isDarkMode ? '#9ca3af' : '#374151'},
            pageIconColor: isDarkMode ? '#9ca3af' : '#374151',
            pageIconInactiveColor: isDarkMode ? '#475569' : '#d1d5db',
            top: 0,
        },
        grid: {
            left: '3%',
            right: '3%',
            bottom: '3%',
            top: '15%',
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: {
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                rotate: labelCount > 30 ? 45 : 0,
                fontSize: labelCount > 60 ? 10 : 12,
            },
            axisLine: {lineStyle: {color: isDarkMode ? '#374151' : '#d1d5db'}},
        },
        yAxis: [
            {
                type: 'value',
                name: 'Win Rate %',
                min: 0,
                max: 100,
                axisLabel: {
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    formatter: (v: number) => `${v}%`,
                },
                splitLine: {lineStyle: {color: isDarkMode ? '#1e293b' : '#f3f4f6'}},
            },
            {
                type: 'value',
                name: 'Trades',
                axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280'},
                splitLine: {show: false},
            },
        ],
        series: [
            // Winners bar (stacked)
            {
                name: 'Winners',
                type: 'bar',
                stack: 'trades',
                yAxisIndex: 1,
                data: winCounts,
                itemStyle: {color: isDarkMode ? 'rgba(16,185,129,0.4)' : 'rgba(16,185,129,0.35)'},
                barMaxWidth: 20,
                z: 0,
            },
            // Losers bar (stacked)
            {
                name: 'Losers',
                type: 'bar',
                stack: 'trades',
                yAxisIndex: 1,
                data: lossCounts,
                itemStyle: {color: isDarkMode ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.35)'},
                barMaxWidth: 20,
                z: 0,
            },
            // Per-point win rate scatter
            {
                name: pointLabel,
                type: 'scatter',
                data: pointWinRate,
                symbolSize: 6,
                itemStyle: {
                    color: (params: any) => {
                        if (params.value === null) return 'transparent';
                        const be = breakevenWR[params.dataIndex];
                        const threshold = be ?? 50;
                        return params.value >= threshold ? '#10b981' : '#ef4444';
                    },
                },
                z: 2,
            },
            // Cumulative win rate
            {
                name: 'Cumulative',
                type: 'line',
                data: rollingWinRate,
                smooth: true,
                lineStyle: {width: 3, color: '#06b6d4'},
                itemStyle: {color: '#06b6d4'},
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            {offset: 0, color: 'rgba(6,182,212,0.15)'},
                            {offset: 1, color: 'rgba(6,182,212,0)'},
                        ],
                    },
                },
                z: 1,
                connectNulls: true,
                markLine: {
                    silent: true,
                    lineStyle: {color: isDarkMode ? '#475569' : '#cbd5e1', type: 'dashed'},
                    data: [{yAxis: 50, label: {formatter: '50%', position: 'insideEndTop', color: isDarkMode ? '#64748b' : '#94a3b8'}}],
                },
            },
            // Cumulative breakeven win rate
            ...(hasBreakeven ? [{
                name: 'Breakeven',
                type: 'line',
                data: breakevenWR,
                smooth: true,
                lineStyle: {width: 2, color: '#f97316', type: 'dotted' as const},
                itemStyle: {color: '#f97316'},
                symbol: 'none',
                z: 1,
                connectNulls: true,
            }] : []),
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow mb-6 transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {breakevenTooltip ? <Tooltip content={breakevenTooltip}><span>Win Rate</span></Tooltip> : 'Win Rate'}
            </h3>
            <ReactECharts option={option} style={{height: '300px'}}/>
        </div>
    );
}
