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
            formatter: (params: any) => {
                const tf = params[0]?.axisValue ?? '';
                let html = `<b>${tf}</b>`;
                let total = 0;
                for (const p of params) {
                    if (p.value === 0) continue;
                    const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:4px;"></span>`;
                    const sign = p.value >= 0 ? '+' : '-';
                    html += `<br/>${marker}${p.seriesName}: <b>${sign}$${Math.abs(p.value).toFixed(2)}</b>`;
                    total += p.value;
                }
                const totalSign = total >= 0 ? '+' : '-';
                html += `<br/><b>Total: ${totalSign}$${Math.abs(total).toFixed(2)}</b>`;
                return html;
            },
        },
        legend: {
            data: ['Long P&L', 'Short P&L'],
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
        yAxis: {
            type: 'value',
            name: 'P&L',
            axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', formatter: (v: number) => `$${v}`},
            splitLine: {lineStyle: {color: isDarkMode ? '#1e293b' : '#f3f4f6'}},
        },
        series: [
            {
                name: 'Long P&L',
                type: 'bar',
                stack: 'pl',
                data: data.map(d => d.long_pl),
                itemStyle: {color: '#10b981'},
            },
            {
                name: 'Short P&L',
                type: 'bar',
                stack: 'pl',
                data: data.map(d => d.short_pl),
                itemStyle: {color: '#f59e0b'},
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
