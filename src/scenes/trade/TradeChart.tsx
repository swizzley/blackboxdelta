import {useEffect, useRef, useState} from 'react';
import {createChart, ColorType, CrosshairMode, LineStyle} from 'lightweight-charts';
import type {IChartApi, ISeriesApi, Time} from 'lightweight-charts';
import {OrderDetail} from '../../context/Types';

interface Props {
    trade: OrderDetail;
    isDarkMode: boolean;
}

type ZoomMode = 'full' | 'trade' | 'setup';

export default function TradeChart({trade, isDarkMode}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const [zoom, setZoom] = useState<ZoomMode>('trade');

    const candles = trade.candles!;
    const isJpy = trade.symbol.includes('JPY');
    const decimals = isJpy ? 3 : 5;

    // Convert ISO timestamps to unix seconds
    const bars = candles.map(c => ({
        time: Math.floor(new Date(c.t).getTime() / 1000) as Time,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
    }));

    // Find entry/exit bar indices
    const entryTs = Math.floor(new Date(trade.created).getTime() / 1000);
    const exitTs = trade.closed ? Math.floor(new Date(trade.closed).getTime() / 1000) : null;
    const entryIdx = findNearestIdx(bars, entryTs);
    const exitIdx = exitTs !== null ? findNearestIdx(bars, exitTs) : null;

    const tvInterval = trade.timeframe === 'scalp' ? '1' : trade.timeframe === 'intraday' ? '15' : 'D';
    const tvSymbol = `FX:${trade.symbol.replace('_', '')}`;
    const tvUrl = `https://www.tradingview.com/chart/?symbol=${tvSymbol}&interval=${tvInterval}`;

    // Create chart
    useEffect(() => {
        if (!containerRef.current || bars.length === 0) return;

        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            candleRef.current = null;
        }

        const bgColor = isDarkMode ? '#1e293b' : '#ffffff';
        const textColor = isDarkMode ? '#9ca3af' : '#6b7280';
        const gridColor = isDarkMode ? '#1f293780' : '#e5e7eb80';
        const borderColor = isDarkMode ? '#374151' : '#d1d5db';

        const chart = createChart(containerRef.current, {
            layout: {
                background: {type: ColorType.Solid, color: bgColor},
                textColor,
            },
            grid: {
                vertLines: {color: gridColor},
                horzLines: {color: gridColor},
            },
            crosshair: {mode: CrosshairMode.Normal},
            rightPriceScale: {
                borderColor,
            },
            timeScale: {
                borderColor,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 5,
            },
            width: containerRef.current.clientWidth,
            height: 500,
        });
        chartRef.current = chart;

        // Candlestick series
        const candleSeries = chart.addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderDownColor: '#ef4444',
            borderUpColor: '#22c55e',
            wickDownColor: '#ef444490',
            wickUpColor: '#22c55e90',
            priceFormat: {
                type: 'price',
                precision: decimals,
                minMove: isJpy ? 0.001 : 0.00001,
            },
        });
        candleSeries.setData(bars);
        candleRef.current = candleSeries;

        // Price lines: entry, SL, TP, exit
        candleSeries.createPriceLine({
            price: trade.entry,
            color: '#8b5cf6',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: 'Entry',
        });
        candleSeries.createPriceLine({
            price: trade.stop_loss,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'SL',
        });
        candleSeries.createPriceLine({
            price: trade.take_profit,
            color: '#10b981',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'TP',
        });
        if (trade.exit !== undefined) {
            candleSeries.createPriceLine({
                price: trade.exit,
                color: '#f59e0b',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: 'Exit',
            });
        }

        // Markers for entry and exit
        const markers: any[] = [];
        if (entryIdx >= 0) {
            const isLong = trade.direction === 'Long';
            markers.push({
                time: bars[entryIdx].time,
                position: isLong ? 'belowBar' : 'aboveBar',
                shape: isLong ? 'arrowUp' : 'arrowDown',
                color: '#8b5cf6',
                text: `Entry ${trade.entry.toFixed(decimals)}`,
                size: 2,
            });
        }
        if (exitIdx !== null && exitIdx >= 0) {
            const isWin = trade.profit !== null && trade.profit >= 0;
            markers.push({
                time: bars[exitIdx].time,
                position: trade.direction === 'Long' ? 'aboveBar' : 'belowBar',
                shape: isWin ? 'circle' : 'square',
                color: isWin ? '#10b981' : '#ef4444',
                text: `Exit ${trade.exit !== undefined ? trade.exit.toFixed(decimals) : ''}`,
                size: 2,
            });
        }
        if (markers.length > 0) {
            markers.sort((a, b) => (a.time as number) - (b.time as number));
            candleSeries.setMarkers(markers);
        }

        // Resize observer
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
            candleRef.current = null;
        };
    }, [trade.id, isDarkMode]);

    // Apply zoom mode
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || bars.length === 0) return;

        const ts = chart.timeScale();

        if (zoom === 'full') {
            ts.fitContent();
        } else if (zoom === 'trade' && entryIdx >= 0) {
            // Show from a few bars before entry to a few bars after exit (or end of data)
            const padBefore = 10;
            const padAfter = 10;
            const fromIdx = Math.max(0, entryIdx - padBefore);
            const toIdx = Math.min(bars.length - 1, (exitIdx ?? entryIdx) + padAfter);
            ts.setVisibleRange({
                from: bars[fromIdx].time,
                to: bars[toIdx].time,
            });
        } else if (zoom === 'setup' && entryIdx >= 0) {
            // Show candles leading up to entry, with entry at the far right
            // Use rightOffset to push entry to the right edge
            const setupBars = Math.min(60, entryIdx);
            const fromIdx = Math.max(0, entryIdx - setupBars);
            ts.setVisibleRange({
                from: bars[fromIdx].time,
                to: bars[entryIdx].time,
            });
        }
    }, [zoom, trade.id, isDarkMode]);

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow mb-6 transition-colors duration-500`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {trade.symbol.replace('_', '/')} &middot; {trade.timeframe === 'scalp' ? '1m' : trade.timeframe === 'intraday' ? '15m' : 'Daily'}
                </h3>
                <div className="flex items-center gap-2">
                    <div className={`inline-flex rounded-md shadow-sm ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                        <ZoomBtn label="All" active={zoom === 'full'} onClick={() => setZoom('full')} isDarkMode={isDarkMode} pos="left"/>
                        <ZoomBtn label="Trade" active={zoom === 'trade'} onClick={() => setZoom('trade')} isDarkMode={isDarkMode} pos="mid"/>
                        <ZoomBtn label="Setup" active={zoom === 'setup'} onClick={() => setZoom('setup')} isDarkMode={isDarkMode} pos="right"/>
                    </div>
                    <a
                        href={tvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-500 hover:text-cyan-400 ml-2"
                    >
                        TradingView &rarr;
                    </a>
                </div>
            </div>
            <div ref={containerRef} style={{height: '500px'}}/>
            <div className={`flex items-center gap-5 mt-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{background: '#8b5cf6'}}/>
                    Entry
                </span>
                {trade.exit !== undefined && (
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{background: '#f59e0b'}}/>
                        Exit
                    </span>
                )}
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{background: '#10b981'}}/>
                    TP
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{background: '#ef4444'}}/>
                    SL
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{background: '#22c55e'}}/>
                    Bullish
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{background: '#ef4444'}}/>
                    Bearish
                </span>
            </div>
        </div>
    );
}

function ZoomBtn({label, active, onClick, isDarkMode, pos}: {
    label: string;
    active: boolean;
    onClick: () => void;
    isDarkMode: boolean;
    pos: 'left' | 'mid' | 'right';
}) {
    const rounded = pos === 'left' ? 'rounded-l-md' : pos === 'right' ? 'rounded-r-md' : '';
    const border = pos !== 'left' ? (isDarkMode ? 'border-l border-slate-600' : 'border-l border-gray-200') : '';
    const bg = active
        ? 'bg-cyan-600 text-white'
        : isDarkMode
            ? 'text-gray-300 hover:bg-slate-600'
            : 'text-gray-600 hover:bg-gray-200';

    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 text-xs font-medium ${rounded} ${border} ${bg} transition-colors`}
        >
            {label}
        </button>
    );
}

function findNearestIdx(bars: {time: Time}[], targetUnix: number): number {
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < bars.length; i++) {
        const diff = Math.abs((bars[i].time as number) - targetUnix);
        if (diff < minDiff) {
            minDiff = diff;
            closest = i;
        }
    }
    return closest;
}
