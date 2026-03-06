import {useEffect, useState} from 'react';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import dayjs from 'dayjs';
import {useTheme} from '../../context/Theme';
import {ScoreDataPoint, DayData, Score} from '../../context/Types';

interface ScoreTrendChartProps {
    data: ScoreDataPoint[];
    period?: string;
}

const COMPONENT_LINES: { key: keyof ScoreDataPoint; label: string; color: string }[] = [
    {key: 'avg_trend', label: 'Trend', color: '#6366f1'},
    {key: 'avg_ma', label: 'MA', color: '#8b5cf6'},
    {key: 'avg_crossover', label: 'Crossover', color: '#a78bfa'},
    {key: 'avg_oscillator', label: 'Oscillator', color: '#f59e0b'},
    {key: 'avg_volatility', label: 'Volatility', color: '#ef4444'},
    {key: 'avg_volume', label: 'Volume', color: '#3b82f6'},
    {key: 'avg_fib_stack', label: 'Fib Stack', color: '#14b8a6'},
    {key: 'avg_momentum_projection', label: 'Momentum', color: '#f97316'},
    {key: 'avg_structure', label: 'Structure', color: '#ec4899'},
    {key: 'avg_cycle', label: 'Cycle', color: '#84cc16'},
    {key: 'avg_pattern', label: 'Pattern', color: '#06b6d4'},
];

// Aggregate scores from orders into an hourly ScoreDataPoint
function aggregateScores(label: string, scores: Score[]): ScoreDataPoint {
    const n = scores.length;
    const sum = (fn: (s: Score) => number) => scores.reduce((a, s) => a + fn(s), 0) / n;
    return {
        date: label,
        avg_final_score: sum(s => s.final_score),
        avg_confidence: sum(s => s.confidence),
        avg_trend: sum(s => s.trend_score),
        avg_ma: sum(s => s.ma_score),
        avg_crossover: sum(s => s.crossover_score),
        avg_oscillator: sum(s => s.oscillator_score),
        avg_volatility: sum(s => s.volatility_score),
        avg_volume: sum(s => s.volume_score),
        avg_fib_stack: sum(s => s.fib_stack_score),
        avg_momentum_projection: sum(s => s.momentum_projection_score),
        avg_structure: sum(s => s.structure_score),
        avg_cycle: sum(s => s.cycle_score),
        avg_pattern: sum(s => s.pattern_score),
        count: n,
    };
}

export default function ScoreTrendChart({data, period}: ScoreTrendChartProps) {
    const {isDarkMode} = useTheme();
    const [showComponents, setShowComponents] = useState(false);
    const [hourlyScores, setHourlyScores] = useState<ScoreDataPoint[] | null>(null);

    const isHourPeriod = period === '1H' || period === '4H' || period === '12H' || period === '1D';

    // For sub-day periods, compute hourly score aggregates from day files
    useEffect(() => {
        if (!isHourPeriod) {
            setHourlyScores(null);
            return;
        }
        const now = dayjs();
        let hoursBack = 24;
        if (period === '1H') hoursBack = 1;
        else if (period === '4H') hoursBack = 4;
        else if (period === '12H') hoursBack = 12;

        const cutoff = now.subtract(hoursBack, 'hour');
        const today = now.format('YYYY/MM/DD');
        const yesterday = now.subtract(1, 'day').format('YYYY/MM/DD');
        const needYesterday = cutoff.format('YYYY-MM-DD') < now.format('YYYY-MM-DD');

        const fetches: Promise<DayData | null>[] = [];
        if (needYesterday) fetches.push(axios.get<DayData>(`/data/days/${yesterday}.json`).then(r => r.data).catch(() => null));
        fetches.push(axios.get<DayData>(`/data/days/${today}.json`).then(r => r.data).catch(() => null));

        Promise.all(fetches).then(results => {
            const points: ScoreDataPoint[] = [];
            for (const dayData of results) {
                if (!dayData?.hours) continue;
                for (const h of dayData.hours) {
                    const hourTime = dayjs(`${dayData.date}T${String(h.hour).padStart(2, '0')}:00:00`);
                    if (hourTime.isBefore(cutoff) || hourTime.isAfter(now)) continue;
                    const scores = h.orders.filter(o => o.score).map(o => o.score!);
                    if (scores.length === 0) continue;
                    const label = needYesterday
                        ? `${dayData.date.slice(5)} ${String(h.hour).padStart(2, '0')}:00`
                        : `${String(h.hour).padStart(2, '0')}:00`;
                    points.push(aggregateScores(label, scores));
                }
            }
            setHourlyScores(points.length > 0 ? points : null);
        });
    }, [isHourPeriod, period]);

    const effectiveData = (isHourPeriod && hourlyScores) ? hourlyScores : data;

    if (!effectiveData || effectiveData.length === 0) return null;

    const dates = effectiveData.map(d => d.date);

    const series: any[] = [
        {
            name: 'Final Score',
            type: 'line',
            data: effectiveData.map(d => d.avg_final_score),
            smooth: true,
            lineStyle: {width: 3},
            itemStyle: {color: '#10b981'},
            z: 10,
        },
        {
            name: 'Confidence',
            type: 'line',
            yAxisIndex: 1,
            data: effectiveData.map(d => d.avg_confidence),
            smooth: true,
            lineStyle: {width: 2, type: 'dashed'},
            itemStyle: {color: '#06b6d4'},
            z: 9,
        },
    ];

    if (showComponents) {
        for (const comp of COMPONENT_LINES) {
            series.push({
                name: comp.label,
                type: 'line',
                data: effectiveData.map(d => d[comp.key] as number),
                smooth: true,
                lineStyle: {width: 1, opacity: 0.7},
                itemStyle: {color: comp.color},
                symbol: 'none',
            });
        }
    }

    const option = {
        backgroundColor: 'transparent',
        tooltip: {trigger: 'axis'},
        legend: {
            data: ['Final Score', 'Confidence', ...(showComponents ? COMPONENT_LINES.map(c => c.label) : [])],
            textStyle: {color: isDarkMode ? '#9ca3af' : '#374151', fontSize: 11},
            top: 0,
            type: 'scroll',
        },
        grid: {
            left: '3%',
            right: '3%',
            bottom: '3%',
            top: showComponents ? '18%' : '15%',
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
                name: 'Score',
                axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280'},
                splitLine: {lineStyle: {color: isDarkMode ? '#1e293b' : '#f3f4f6'}},
            },
            {
                type: 'value',
                name: 'Confidence',
                min: 0,
                max: 1,
                axisLabel: {
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
                },
                splitLine: {show: false},
            },
        ],
        series,
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <div className="flex items-center justify-between mb-2">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Score Trend
                </h3>
                <button
                    onClick={() => setShowComponents(!showComponents)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        showComponents
                            ? 'bg-cyan-500 text-white border-cyan-500'
                            : `${isDarkMode ? 'border-gray-600 text-gray-400 hover:text-gray-300' : 'border-gray-300 text-gray-500 hover:text-gray-700'}`
                    }`}
                >
                    {showComponents ? 'Hide Components' : 'Show Components'}
                </button>
            </div>
            <ReactECharts option={option} style={{height: '350px'}}/>
        </div>
    );
}
