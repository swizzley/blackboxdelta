import ReactECharts from 'echarts-for-react';
import {useTheme} from '../../context/Theme';
import {TimeframeRow} from '../../context/Types';

const TF_COLORS: Record<string, string> = {
    scalp: '#06b6d4',
    intraday: '#8b5cf6',
    swing: '#f59e0b',
};

const AXES = [
    {key: 'win_rate', label: 'Win Rate %'},
    {key: 'wl_ratio', label: 'W/L Ratio'},
    {key: 'avg_win', label: 'Avg Win'},
    {key: 'avg_loss', label: 'Avg Loss (abs)'},
    {key: 'trade_count', label: 'Trade Count'},
];

interface TimeframeRadarProps {
    data: TimeframeRow[];
}

export default function TimeframeRadar({data}: TimeframeRadarProps) {
    const {isDarkMode} = useTheme();
    if (data.length === 0) return null;

    // Extract raw values per axis per timeframe
    const raw = data.map(tf => ({
        name: tf.timeframe.charAt(0).toUpperCase() + tf.timeframe.slice(1),
        key: tf.timeframe,
        values: [
            tf.win_rate_pct ?? 0,
            tf.win_loss_ratio ?? 0,
            tf.avg_win ?? 0,
            Math.abs(tf.avg_loss ?? 0),
            tf.total_orders,
        ],
    }));

    // Max per axis for normalization
    const maxPerAxis = AXES.map((_, i) => Math.max(...raw.map(r => r.values[i]), 0.01));

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: (p: any) => {
                const tf = raw.find(r => r.name === p.name);
                if (!tf) return '';
                return `<b>${tf.name}</b><br/>` + AXES.map((a, i) =>
                    `${a.label}: ${tf.values[i].toFixed(a.key === 'trade_count' ? 0 : 2)}`
                ).join('<br/>');
            },
        },
        legend: {
            bottom: 0,
            data: raw.map(r => r.name),
            textStyle: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11},
            itemWidth: 12,
            itemHeight: 12,
        },
        radar: {
            indicator: AXES.map((a, i) => ({name: a.label, max: maxPerAxis[i] * 1.15})),
            shape: 'polygon',
            axisName: {
                color: isDarkMode ? '#d1d5db' : '#374151',
                fontSize: 11,
            },
            splitArea: {
                areaStyle: {color: isDarkMode ? ['#1e293b', '#0f172a'] : ['#f9fafb', '#f3f4f6']},
            },
            splitLine: {
                lineStyle: {color: isDarkMode ? '#334155' : '#d1d5db'},
            },
            axisLine: {
                lineStyle: {color: isDarkMode ? '#334155' : '#d1d5db'},
            },
        },
        series: [
            {
                type: 'radar',
                data: raw.map(r => ({
                    value: r.values,
                    name: r.name,
                    areaStyle: {color: TF_COLORS[r.key] + '20'},
                    lineStyle: {color: TF_COLORS[r.key], width: 2},
                    itemStyle: {color: TF_COLORS[r.key]},
                    symbol: 'circle',
                    symbolSize: 5,
                })),
            },
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Timeframe Comparison
            </h3>
            <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Performance profile by strategy
            </p>
            <ReactECharts option={option} style={{height: '300px'}}/>
        </div>
    );
}
