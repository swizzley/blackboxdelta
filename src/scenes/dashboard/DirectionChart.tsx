import ReactECharts from 'echarts-for-react';
import {useTheme} from '../../context/Theme';
import {DirectionDataPoint} from '../../context/Types';

interface DirectionChartProps {
    data: DirectionDataPoint[];
}

export default function DirectionChart({data}: DirectionChartProps) {
    const {isDarkMode} = useTheme();

    const dates = data.map(d => d.date);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: {type: 'shadow'},
            formatter: (params: any) => {
                const date = params[0]?.axisValue ?? '';
                // Find the data point for totals
                const dp = data.find(d => d.date === date);
                if (!dp) return date;

                const longTotal = dp.long_wins + dp.long_losses;
                const shortTotal = dp.short_wins + dp.short_losses;
                const longWR = longTotal > 0 ? Math.round(dp.long_wins / longTotal * 100) : 0;
                const shortWR = shortTotal > 0 ? Math.round(dp.short_wins / shortTotal * 100) : 0;

                let html = `<b>${date}</b>`;
                html += `<br/><span style="color:#10b981">Long</span>: ${longTotal} trades (${longWR}% win) &nbsp; <b>${dp.long_pl >= 0 ? '+' : ''}$${dp.long_pl.toFixed(2)}</b>`;
                html += `<br/><span style="color:#f59e0b">Short</span>: ${shortTotal} trades (${shortWR}% win) &nbsp; <b>${dp.short_pl >= 0 ? '+' : ''}$${dp.short_pl.toFixed(2)}</b>`;
                return html;
            },
        },
        legend: {
            data: ['Long Wins', 'Long Losses', 'Short Wins', 'Short Losses'],
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
        yAxis: {
            type: 'value',
            axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280'},
            splitLine: {lineStyle: {color: isDarkMode ? '#1e293b' : '#f3f4f6'}},
        },
        series: [
            {
                name: 'Long Wins',
                type: 'bar',
                stack: 'long',
                data: data.map(d => d.long_wins),
                itemStyle: {color: '#10b981'},
                barMaxWidth: 24,
            },
            {
                name: 'Long Losses',
                type: 'bar',
                stack: 'long',
                data: data.map(d => d.long_losses),
                itemStyle: {color: '#ef4444'},
                barMaxWidth: 24,
            },
            {
                name: 'Short Wins',
                type: 'bar',
                stack: 'short',
                data: data.map(d => -d.short_wins),
                itemStyle: {color: '#f59e0b'},
                barMaxWidth: 24,
            },
            {
                name: 'Short Losses',
                type: 'bar',
                stack: 'short',
                data: data.map(d => -d.short_losses),
                itemStyle: {color: '#8b5cf6'},
                barMaxWidth: 24,
            },
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Long / Short
            </h3>
            <ReactECharts option={option} style={{height: '350px'}}/>
        </div>
    );
}
