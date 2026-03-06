import {useRef, useCallback} from 'react';
import ReactECharts from 'echarts-for-react';
import {useTheme} from '../../context/Theme';
import {TimeframeRow} from '../../context/Types';
import {formatDollar} from '../common/Util';

interface TimeframeBreakdownProps {
    data: TimeframeRow[];
    selectedTimeframe: string | null;
    onTimeframeClick: (tf: string | null) => void;
}

export default function TimeframeBreakdown({data, selectedTimeframe, onTimeframeClick}: TimeframeBreakdownProps) {
    const {isDarkMode} = useTheme();
    const chartRef = useRef<ReactECharts>(null);

    const timeframes = data.map(d => d.timeframe);
    const timeframeLabels = timeframes.map(d => d.charAt(0).toUpperCase() + d.slice(1));

    const dimOpacity = 0.25;

    const onClick = useCallback((params: any) => {
        if (params.componentType !== 'series') return;
        const clickedTf = timeframes[params.dataIndex];
        if (!clickedTf) return;
        onTimeframeClick(selectedTimeframe === clickedTf ? null : clickedTf);
    }, [timeframes, selectedTimeframe, onTimeframeClick]);

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
                    html += `<br/>${marker}${p.seriesName}: <b>${formatDollar(p.value)}</b>`;
                    total += p.value;
                }
                html += `<br/><b>Total: ${formatDollar(total)}</b>`;
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
            data: timeframeLabels,
            axisLabel: {
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                fontWeight: ((_: any, index: number) =>
                    selectedTimeframe === timeframes[index] ? 'bold' : 'normal'
                ) as any,
            },
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
                data: data.map((d, i) => ({
                    value: d.long_pl,
                    itemStyle: {
                        color: '#10b981',
                        opacity: selectedTimeframe && selectedTimeframe !== timeframes[i] ? dimOpacity : 1,
                    },
                })),
                cursor: 'pointer',
            },
            {
                name: 'Short P&L',
                type: 'bar',
                stack: 'pl',
                data: data.map((d, i) => ({
                    value: d.short_pl,
                    itemStyle: {
                        color: '#f59e0b',
                        opacity: selectedTimeframe && selectedTimeframe !== timeframes[i] ? dimOpacity : 1,
                    },
                })),
                cursor: 'pointer',
            },
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <div className="flex items-center justify-between mb-2">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    By Timeframe
                </h3>
                {selectedTimeframe && (
                    <button
                        onClick={() => onTimeframeClick(null)}
                        className={`text-xs px-2 py-0.5 rounded-full ${
                            isDarkMode ? 'bg-cyan-900/50 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                        }`}
                    >
                        {selectedTimeframe.charAt(0).toUpperCase() + selectedTimeframe.slice(1)} &times;
                    </button>
                )}
            </div>
            <ReactECharts
                ref={chartRef}
                option={option}
                style={{height: '350px'}}
                onEvents={{click: onClick}}
            />
        </div>
    );
}
