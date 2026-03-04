import ReactECharts from 'echarts-for-react';
import {useTheme} from '../../context/Theme';
import {CalendarData} from '../../context/Types';

interface WinRateChartProps {
    data: CalendarData;
}

export default function WinRateChart({data}: WinRateChartProps) {
    const {isDarkMode} = useTheme();

    // Build sorted daily series from calendar data
    const dates = Object.keys(data).sort();

    // Compute rolling win rate and daily win rate
    let cumWins = 0;
    let cumTotal = 0;

    const dailyWinRate: (number | null)[] = [];
    const rollingWinRate: (number | null)[] = [];
    const dailyTrades: number[] = [];

    for (const d of dates) {
        const day = data[d];
        const closed = day.winners + day.losers;
        cumWins += day.winners;
        cumTotal += closed;

        dailyTrades.push(day.total);

        if (closed > 0) {
            dailyWinRate.push(Math.round(day.winners / closed * 1000) / 10);
        } else {
            dailyWinRate.push(null);
        }

        if (cumTotal > 0) {
            rollingWinRate.push(Math.round(cumWins / cumTotal * 1000) / 10);
        } else {
            rollingWinRate.push(null);
        }
    }

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
                const date = params[0]?.axisValue ?? '';
                let html = `<b>${date}</b>`;
                for (const p of params) {
                    if (p.value !== null && p.value !== undefined) {
                        const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:4px;"></span>`;
                        if (p.seriesName === 'Trades') {
                            html += `<br/>${marker}${p.seriesName}: <b>${p.value}</b>`;
                        } else {
                            html += `<br/>${marker}${p.seriesName}: <b>${p.value}%</b>`;
                        }
                    }
                }
                return html;
            },
        },
        legend: {
            data: ['Daily Win Rate', 'Cumulative Win Rate', 'Trades'],
            textStyle: {color: isDarkMode ? '#9ca3af' : '#374151'},
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
            {
                name: 'Trades',
                type: 'bar',
                yAxisIndex: 1,
                data: dailyTrades,
                itemStyle: {color: isDarkMode ? 'rgba(100,116,139,0.3)' : 'rgba(148,163,184,0.3)'},
                barMaxWidth: 20,
                z: 0,
            },
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
            {
                name: 'Cumulative Win Rate',
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
                            {offset: 0, color: 'rgba(6,182,212,0.2)'},
                            {offset: 1, color: 'rgba(6,182,212,0)'},
                        ],
                    },
                },
                z: 1,
                connectNulls: true,
                // 50% reference line
                markLine: {
                    silent: true,
                    lineStyle: {color: isDarkMode ? '#475569' : '#cbd5e1', type: 'dashed'},
                    data: [{yAxis: 50, label: {formatter: '50%', position: 'insideEndTop', color: isDarkMode ? '#64748b' : '#94a3b8'}}],
                },
            },
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
