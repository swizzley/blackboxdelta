import {useEffect, useRef, useState} from 'react';
import {createChart, ColorType, LineStyle} from 'lightweight-charts';
import type {IChartApi, ISeriesApi, Time, LogicalRange} from 'lightweight-charts';
import type {SignalRow} from '../../context/Types';
import {findSignalDef} from './signalMapping';

interface Props {
    signals: SignalRow[];
    activeKeys: string[];
    groupLabel: string;
    groupColor?: string;
    isDarkMode: boolean;
    onVisibleRangeChange?: (range: LogicalRange | null) => void;
    visibleRange?: LogicalRange | null;
    onClose: () => void;
}

interface LegendEntry {
    label: string;
    color: string;
    value: string;
}

export default function SubPane({signals, activeKeys, groupLabel, groupColor, isDarkMode, onVisibleRangeChange, visibleRange, onClose}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
    const syncingRef = useRef(false);
    const [legend, setLegend] = useState<LegendEntry[]>([]);

    // Create chart
    useEffect(() => {
        if (!containerRef.current) return;

        const bgColor = isDarkMode ? '#131722' : '#ffffff';
        const gridColor = isDarkMode ? '#1e222d' : '#e0e3eb';
        const borderColor = isDarkMode ? '#2a2e39' : '#e0e3eb';

        const chart = createChart(containerRef.current, {
            layout: {
                background: {type: ColorType.Solid, color: bgColor},
                textColor: '#787b86',
            },
            grid: {
                vertLines: {color: gridColor},
                horzLines: {color: gridColor},
            },
            rightPriceScale: {borderColor},
            timeScale: {
                borderColor,
                timeVisible: true,
                secondsVisible: false,
                visible: true,
            },
            width: containerRef.current.clientWidth,
            height: 150,
            crosshair: {mode: 0},
        });
        chartRef.current = chart;

        // Crosshair move — update legend with values for each series
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.seriesData) {
                setLegend([]);
                return;
            }
            const entries: LegendEntry[] = [];
            for (const [key, series] of seriesRef.current) {
                const data = param.seriesData.get(series) as {value?: number} | undefined;
                if (!data || data.value === undefined) continue;
                const def = findSignalDef(key);
                entries.push({
                    label: def?.label ?? key,
                    color: def?.color ?? '#787b86',
                    value: data.value.toFixed(4),
                });
            }
            setLegend(entries);
        });

        // Emit range changes for sync
        chart.timeScale().subscribeVisibleLogicalRangeChange((lr) => {
            if (!syncingRef.current && onVisibleRangeChange) {
                onVisibleRangeChange(lr);
            }
        });

        const observer = new ResizeObserver(() => {
            if (containerRef.current) {
                chart.applyOptions({width: containerRef.current.clientWidth});
            }
        });
        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
            chart.remove();
            chartRef.current = null;
            seriesRef.current.clear();
        };
    }, [isDarkMode]);

    // Sync visible range from parent
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || !visibleRange) return;
        syncingRef.current = true;
        chart.timeScale().setVisibleLogicalRange(visibleRange);
        syncingRef.current = false;
    }, [visibleRange]);

    // Update series when active keys or signals change
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const current = seriesRef.current;

        // Remove series no longer active
        for (const [key, series] of current) {
            if (!activeKeys.includes(key)) {
                chart.removeSeries(series);
                current.delete(key);
            }
        }

        // Add or update active series
        for (const key of activeKeys) {
            const def = findSignalDef(key);
            if (!def) continue;

            const data = signals
                .filter(row => {
                    const v = row[key];
                    return v !== undefined && v !== null && v !== 0 && typeof v === 'number';
                })
                .map(row => ({
                    time: (typeof row.t === 'number' ? Math.floor(row.t / 1000) : Math.floor(new Date(row.t as string).getTime() / 1000)) as Time,
                    value: row[key] as number,
                }));

            if (data.length === 0) continue;

            if (current.has(key)) {
                current.get(key)!.setData(data);
            } else {
                const series = chart.addLineSeries({
                    color: def.color,
                    lineWidth: (def.lineWidth ?? 1) as 1 | 2 | 3 | 4,
                    lineStyle: def.lineStyle === 'dashed' ? LineStyle.Dashed : def.lineStyle === 'dotted' ? LineStyle.Dotted : LineStyle.Solid,
                    priceScaleId: 'right',
                    lastValueVisible: false,
                    priceLineVisible: false,
                });
                series.setData(data);
                current.set(key, series);
            }
        }
    }, [activeKeys, signals]);

    return (
        <div className={`relative rounded-lg overflow-hidden mb-2 ${isDarkMode ? 'bg-[#131722]' : 'bg-white'}`}>
            {/* Header: group label + legend values */}
            <div className="absolute top-1 left-2 z-10 flex items-center gap-3 pointer-events-none">
                <span className="text-xs font-medium" style={{color: groupColor ?? (isDarkMode ? '#9ca3af' : '#6b7280')}}>
                    {groupLabel}
                </span>
                {legend.length > 0 && legend.map(e => (
                    <span key={e.label} className="flex items-center gap-1 text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{backgroundColor: e.color}} />
                        <span style={{color: e.color}}>{e.label}</span>
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{e.value}</span>
                    </span>
                ))}
            </div>
            <button
                onClick={onClose}
                className={`absolute top-1 right-2 z-10 text-xs w-5 h-5 rounded flex items-center justify-center ${
                    isDarkMode ? 'text-gray-500 hover:text-gray-300 hover:bg-slate-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
            >
                &times;
            </button>
            <div ref={containerRef} style={{height: '150px'}} />
        </div>
    );
}
