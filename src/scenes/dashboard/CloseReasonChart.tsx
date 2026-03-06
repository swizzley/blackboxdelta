import ReactECharts from 'echarts-for-react';
import {useTheme} from '../../context/Theme';

const COLORS: Record<string, string> = {
    'TP': '#10b981',
    'SL': '#ef4444',
    'TRAILING_SL': '#f59e0b',
    'MOMENTUM_FADE': '#8b5cf6',
    'MAX_AGE': '#3b82f6',
    'RECONCILE': '#6b7280',
};

const LABELS: Record<string, string> = {
    'TP': 'Take Profit',
    'SL': 'Stop Loss',
    'TRAILING_SL': 'Trailing SL',
    'MOMENTUM_FADE': 'Momentum Fade',
    'MAX_AGE': 'Max Age',
    'RECONCILE': 'Reconcile',
};

const ORDER = ['TP', 'SL', 'TRAILING_SL', 'MOMENTUM_FADE', 'MAX_AGE', 'RECONCILE'];

interface CloseReasonChartProps {
    data: Record<string, number>;
}

export default function CloseReasonChart({data}: CloseReasonChartProps) {
    const {isDarkMode} = useTheme();

    const keys = [...ORDER.filter(k => (data[k] ?? 0) > 0), ...Object.keys(data).filter(k => !ORDER.includes(k) && data[k] > 0)];
    const total = keys.reduce((s, k) => s + data[k], 0);
    if (total === 0) return null;

    const pieces = keys.map(k => ({
        value: data[k],
        name: LABELS[k] ?? k,
        itemStyle: {color: COLORS[k] ?? '#06b6d4'},
    }));

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: (p: any) => `${p.name}: <b>${p.value}</b> (${p.percent}%)`,
        },
        legend: {
            bottom: 0,
            textStyle: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11},
            itemWidth: 12,
            itemHeight: 12,
        },
        series: [
            {
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['50%', '45%'],
                avoidLabelOverlap: true,
                itemStyle: {borderRadius: 6, borderColor: isDarkMode ? '#1e293b' : '#fff', borderWidth: 2},
                label: {
                    show: true,
                    formatter: '{b}\n{c}',
                    color: isDarkMode ? '#d1d5db' : '#374151',
                    fontSize: 11,
                },
                emphasis: {
                    label: {show: true, fontSize: 13, fontWeight: 'bold'},
                },
                data: pieces,
            },
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Close Reasons
            </h3>
            <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {total} closed trades
            </p>
            <ReactECharts option={option} style={{height: '300px'}}/>
        </div>
    );
}
