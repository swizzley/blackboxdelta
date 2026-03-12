import {useEffect, useRef} from 'react';
import {createChart, ColorType, LineStyle} from 'lightweight-charts';
import type {IChartApi, ISeriesApi, Time, LogicalRange} from 'lightweight-charts';
import type {SignalRow} from '../../context/Types';
import {findSignalDef} from './signalMapping';

interface Props {
    signals: SignalRow[];
    activeKeys: string[];
    groupLabel: string;
    range?: [number, number];
    isDarkMode: boolean;
    onVisibleRangeChange?: (range: LogicalRange | null) => void;
    visibleRange?: LogicalRange | null;
    onClose: () => void;
}

export default function SubPane({signals, activeKeys, groupLabel, range, isDarkMode, onVisibleRangeChange, visibleRange, onClose}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
    const syncingRef = useRef(false);

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
                });
                series.setData(data);
                current.set(key, series);
            }
        }

        // Add reference lines for known ranges
        if (range) {
            // Price lines would need a series — skip for now, the range is visual from data
        }
    }, [activeKeys, signals]);

    return (
        <div className={`relative rounded-lg overflow-hidden mb-2 ${isDarkMode ? 'bg-[#131722]' : 'bg-white'}`}>
            <div className="absolute top-1 left-2 z-10 flex items-center gap-2">
                <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {groupLabel}
                </span>
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
