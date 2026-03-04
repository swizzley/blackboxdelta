import ReactECharts from 'echarts-for-react';
import {useTheme} from '../../context/Theme';
import {TimeframeRow} from '../../context/Types';

interface TimeframeBreakdownProps {
    data: TimeframeRow[];
}

export default function TimeframeBreakdown({data}: TimeframeBreakdownProps) {
    const {isDarkMode} = useTheme();

    const timeframes = data.map(d => d.timeframe.charAt(0).toUpperCase() + d.timeframe.slice(1));

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: {type: 'shadow'},
        },
        legend: {
            data: ['P&L', 'Win Rate %'],
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
            data: timeframes,
            axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280'},
            axisLine: {lineStyle: {color: isDarkMode ? '#374151' : '#d1d5db'}},
        },
        yAxis: [
            {
                type: 'value',
                name: 'P&L',
                axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', formatter: (v: number) => `$${v}`},
                splitLine: {lineStyle: {color: isDarkMode ? '#1e293b' : '#f3f4f6'}},
            },
            {
                type: 'value',
                name: 'Win %',
                max: 100,
                axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280'},
                splitLine: {show: false},
            },
        ],
        series: [
            {
                name: 'P&L',
                type: 'bar',
                data: data.map(d => d.total_pl),
                itemStyle: {
                    color: (params: any) => params.value >= 0 ? '#10b981' : '#ef4444',
                    borderRadius: [4, 4, 0, 0],
                },
            },
            {
                name: 'Win Rate %',
                type: 'bar',
                yAxisIndex: 1,
                data: data.map(d => d.win_rate_pct ?? 0),
                itemStyle: {
                    color: '#6366f1',
                    borderRadius: [4, 4, 0, 0],
                },
            },
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                By Timeframe
            </h3>
            <ReactECharts option={option} style={{height: '350px'}}/>
        </div>
    );
}
