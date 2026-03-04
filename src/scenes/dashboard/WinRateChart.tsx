import ReactECharts from 'echarts-for-react';
import {useTheme} from '../../context/Theme';
import {CalendarData, DirectionDataPoint} from '../../context/Types';

interface WinRateChartProps {
    data: CalendarData;
    direction?: DirectionDataPoint[];
}

export default function WinRateChart({data, direction}: WinRateChartProps) {
    const {isDarkMode} = useTheme();

    const dates = Object.keys(data).sort();

    // Index direction data by date for quick lookup
    const dirMap = new Map<string, DirectionDataPoint>();
    if (direction) {
        for (const d of direction) dirMap.set(d.date, d);
    }

    // Compute rolling win rates: overall, long, short
    let cumWins = 0, cumTotal = 0;
    let cumLongWins = 0, cumLongTotal = 0;
    let cumShortWins = 0, cumShortTotal = 0;

    const dailyWinRate: (number | null)[] = [];
    const rollingWinRate: (number | null)[] = [];
    const rollingLongWR: (number | null)[] = [];
    const rollingShortWR: (number | null)[] = [];
    const longTrades: number[] = [];
    const shortTrades: number[] = [];

    for (const d of dates) {
        const day = data[d];
        const closed = day.winners + day.losers;
        cumWins += day.winners;
        cumTotal += closed;

        // Direction breakdown
        const dir = dirMap.get(d);
        const dayLong = dir ? dir.long_wins + dir.long_losses : 0;
        const dayShort = dir ? dir.short_wins + dir.short_losses : 0;
        longTrades.push(dayLong);
        shortTrades.push(dayShort);

        if (dir) {
            cumLongWins += dir.long_wins;
            cumLongTotal += dayLong;
            cumShortWins += dir.short_wins;
            cumShortTotal += dayShort;
        }

        dailyWinRate.push(closed > 0 ? Math.round(day.winners / closed * 1000) / 10 : null);
        rollingWinRate.push(cumTotal > 0 ? Math.round(cumWins / cumTotal * 1000) / 10 : null);
        rollingLongWR.push(cumLongTotal > 0 ? Math.round(cumLongWins / cumLongTotal * 1000) / 10 : null);
        rollingShortWR.push(cumShortTotal > 0 ? Math.round(cumShortWins / cumShortTotal * 1000) / 10 : null);
    }

    const hasDirection = dirMap.size > 0;

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
                const date = params[0]?.axisValue ?? '';
                let html = `<b>${date}</b>`;
                for (const p of params) {
                    if (p.value === null || p.value === undefined) continue;
                    const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:4px;"></span>`;
                    if (p.seriesName === 'Long' || p.seriesName === 'Short') {
                        html += `<br/>${marker}${p.seriesName}: <b>${Math.abs(p.value)}</b>`;
                    } else if (p.seriesName === 'Trades') {
                        html += `<br/>${marker}${p.seriesName}: <b>${p.value}</b>`;
                    } else {
                        html += `<br/>${marker}${p.seriesName}: <b>${p.value}%</b>`;
                    }
                }
                return html;
            },
        },
        legend: {
            data: [
                'Daily Win Rate', 'Cumulative',
                ...(hasDirection ? ['Long WR', 'Short WR', 'Long', 'Short'] : ['Trades']),
            ],
            textStyle: {color: isDarkMode ? '#9ca3af' : '#374151', fontSize: 11},
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
            data: dates,
            axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280'},
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
            // Background trade bars — split into long/short if available
            ...(hasDirection ? [
                {
                    name: 'Long',
                    type: 'bar',
                    stack: 'trades',
                    yAxisIndex: 1,
                    data: longTrades,
                    itemStyle: {color: isDarkMode ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.2)'},
                    barMaxWidth: 20,
                    z: 0,
                },
                {
                    name: 'Short',
                    type: 'bar',
                    stack: 'trades',
                    yAxisIndex: 1,
                    data: shortTrades,
                    itemStyle: {color: isDarkMode ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.2)'},
                    barMaxWidth: 20,
                    z: 0,
                },
            ] : [
                {
                    name: 'Trades',
                    type: 'bar',
                    yAxisIndex: 1,
                    data: dates.map(d => data[d].total),
                    itemStyle: {color: isDarkMode ? 'rgba(100,116,139,0.3)' : 'rgba(148,163,184,0.3)'},
                    barMaxWidth: 20,
                    z: 0,
                },
            ]),
            // Daily win rate scatter
            {
                name: 'Daily Win Rate',
                type: 'scatter',
                data: dailyWinRate,
                symbolSize: 6,
                itemStyle: {
                    color: (params: any) => {
                        if (params.value === null) return 'transparent';
                        return params.value >= 50 ? '#10b981' : '#ef4444';
                    },
                },
                z: 2,
            },
            // Cumulative win rate — overall
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
            // Long cumulative win rate
            ...(hasDirection ? [{
                name: 'Long WR',
                type: 'line',
                data: rollingLongWR,
                smooth: true,
                lineStyle: {width: 2, color: '#10b981', type: 'dashed' as const},
                itemStyle: {color: '#10b981'},
                symbol: 'none',
                z: 1,
                connectNulls: true,
            }] : []),
            // Short cumulative win rate
            ...(hasDirection ? [{
                name: 'Short WR',
                type: 'line',
                data: rollingShortWR,
                smooth: true,
                lineStyle: {width: 2, color: '#f59e0b', type: 'dashed' as const},
                itemStyle: {color: '#f59e0b'},
                symbol: 'none',
                z: 1,
                connectNulls: true,
            }] : []),
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow mb-6 transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Win Rate
            </h3>
            <ReactECharts option={option} style={{height: '300px'}}/>
        </div>
    );
}
