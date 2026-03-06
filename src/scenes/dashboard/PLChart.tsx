import ReactECharts from 'echarts-for-react';
import {useTheme} from '../../context/Theme';
import {PLDataPoint} from '../../context/Types';
import {formatDollar} from '../common/Util';

interface PLChartProps {
    data: PLDataPoint[];
}

export default function PLChart({data}: PLChartProps) {
    const {isDarkMode} = useTheme();

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
                const p = params[0];
                const d = params[1];
                return `${p.axisValue}<br/>
                    Cumulative P&L: <b>${formatDollar(p.value)}</b><br/>
                    Daily P&L: <b>${formatDollar(d.value)}</b>`;
            },
        },
        legend: {
            data: ['Cumulative P&L', 'Daily P&L'],
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
            data: data.map(d => d.date),
            axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280'},
            axisLine: {lineStyle: {color: isDarkMode ? '#374151' : '#d1d5db'}},
        },
        yAxis: [
            {
                type: 'value',
                name: 'Cumulative',
                axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', formatter: (v: number) => `$${v}`},
                splitLine: {lineStyle: {color: isDarkMode ? '#1e293b' : '#f3f4f6'}},
            },
            {
                type: 'value',
                name: 'Daily',
                axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', formatter: (v: number) => `$${v}`},
                splitLine: {show: false},
            },
        ],
        series: [
            {
                name: 'Cumulative P&L',
                type: 'line',
                data: data.map(d => d.cumulative_pl),
                smooth: true,
                lineStyle: {width: 2},
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            {offset: 0, color: 'rgba(16,185,129,0.3)'},
                            {offset: 1, color: 'rgba(16,185,129,0)'},
                        ],
                    },
                },
                itemStyle: {color: '#10b981'},
            },
            {
                name: 'Daily P&L',
                type: 'bar',
                yAxisIndex: 1,
                data: data.map(d => d.daily_pl),
                itemStyle: {
                    color: (params: any) => params.value >= 0 ? '#10b981' : '#ef4444',
                },
            },
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Profit & Loss
            </h3>
            <ReactECharts option={option} style={{height: '350px'}}/>
        </div>
    );
}
