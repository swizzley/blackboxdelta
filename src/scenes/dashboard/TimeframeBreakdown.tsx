import {useRef, useCallback} from 'react';
import ReactECharts from 'echarts-for-react';
import {useTheme} from '../../context/Theme';
import {TimeframeRow} from '../../context/Types';
import {formatPct} from '../common/Util';

interface TimeframeBreakdownProps {
    data: TimeframeRow[];
    selectedTimeframe: string | null;
    onTimeframeClick: (tf: string | null) => void;
}

// Map legacy names to standard TF labels and merge duplicates
const TF_LABEL: Record<string, string> = {
    'scalp': '1m', '1m': '1m',
    '5m': '5m',
    'intraday': '15m', '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    'swing': '1D', 'daily': '1D',
    'weekly': '1W', '1w': '1W',
};

const TF_ORDER = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];

function mergeTimeframes(data: TimeframeRow[]): {label: string; rawTf: string; long_pl: number; short_pl: number; total_orders: number}[] {
    const merged = new Map<string, {label: string; rawTf: string; long_pl: number; short_pl: number; total_orders: number}>();
    for (const row of data) {
        const label = TF_LABEL[row.timeframe] ?? row.timeframe;
        const existing = merged.get(label);
        if (existing) {
            existing.long_pl += row.long_pl;
            existing.short_pl += row.short_pl;
            existing.total_orders += row.total_orders;
        } else {
            merged.set(label, {label, rawTf: row.timeframe, long_pl: row.long_pl, short_pl: row.short_pl, total_orders: row.total_orders});
        }
    }
    return TF_ORDER.filter(tf => merged.has(tf)).map(tf => merged.get(tf)!);
}

export default function TimeframeBreakdown({data, selectedTimeframe, onTimeframeClick}: TimeframeBreakdownProps) {
    const {isDarkMode} = useTheme();
    const chartRef = useRef<ReactECharts>(null);

    const merged = mergeTimeframes(data);
    const labels = merged.map(d => d.label);

    const selectedLabel = selectedTimeframe ? (TF_LABEL[selectedTimeframe] ?? selectedTimeframe) : null;
    const dimOpacity = 0.25;

    const onClick = useCallback((params: any) => {
        if (params.componentType !== 'series') return;
        const clicked = merged[params.dataIndex];
        if (!clicked) return;
        const clickedLabel = clicked.label;
        onTimeframeClick(selectedLabel === clickedLabel ? null : clicked.rawTf);
    }, [merged, selectedLabel, onTimeframeClick]);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: {type: 'shadow'},
            backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
            borderColor: isDarkMode ? '#333' : '#e5e7eb',
            textStyle: {color: isDarkMode ? '#e0e0e0' : '#1f2937', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11},
            formatter: (params: any) => {
                const tf = params[0]?.axisValue ?? '';
                const idx = params[0]?.dataIndex ?? 0;
                const orders = merged[idx]?.total_orders ?? 0;
                let html = `<b>${tf}</b> (${orders} trades)`;
                let total = 0;
                for (const p of params) {
                    if (p.value === 0) continue;
                    const marker = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px;"></span>`;
                    html += `<br/>${marker}${p.seriesName}: <b>${formatPct(p.value)}</b>`;
                    total += p.value;
                }
                html += `<br/><b>Net: ${formatPct(total)}</b>`;
                return html;
            },
        },
        legend: {show: false},
        grid: {left: 0, right: 0, bottom: 0, top: 10, containLabel: true},
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: {
                color: isDarkMode ? '#666' : '#6b7280',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 11,
                fontWeight: ((_: any, index: number) =>
                    selectedLabel === labels[index] ? 'bold' : 'normal'
                ) as any,
            },
            axisLine: {lineStyle: {color: isDarkMode ? '#222' : '#d1d5db'}},
            axisTick: {show: false},
        },
        yAxis: {
            type: 'value',
            axisLabel: {color: isDarkMode ? '#555' : '#6b7280', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10, formatter: (v: number) => `$${v}`},
            splitLine: {lineStyle: {color: isDarkMode ? '#1a1a1a' : '#f3f4f6'}},
            axisLine: {show: false},
        },
        series: [
            {
                name: 'Long P&L',
                type: 'bar',
                stack: 'pl',
                data: merged.map((d, i) => ({
                    value: d.long_pl,
                    itemStyle: {
                        color: isDarkMode ? '#22d3ee' : '#ec4899',
                        opacity: selectedLabel && selectedLabel !== labels[i] ? dimOpacity : 1,
                    },
                })),
                cursor: 'pointer',
                barMaxWidth: 24,
            },
            {
                name: 'Short P&L',
                type: 'bar',
                stack: 'pl',
                data: merged.map((d, i) => ({
                    value: d.short_pl,
                    itemStyle: {
                        color: isDarkMode ? '#06b6d4' : '#f472b6',
                        opacity: selectedLabel && selectedLabel !== labels[i] ? dimOpacity : 0.7,
                    },
                })),
                cursor: 'pointer',
                barMaxWidth: 24,
            },
        ],
    };

    return (
        <ReactECharts
            ref={chartRef}
            option={option}
            style={{height: '280px'}}
            onEvents={{click: onClick}}
        />
    );
}
