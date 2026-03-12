import {useEffect, useRef, useState, useCallback} from 'react';
import {createChart, ColorType, CrosshairMode, LineStyle} from 'lightweight-charts';
import type {IChartApi, ISeriesApi, Time, LogicalRange} from 'lightweight-charts';
import {OrderDetail, SignalRow} from '../../context/Types';
import {findSignalDef} from './signalMapping';
import IndicatorPanel from './IndicatorPanel';
import SubPane from './SubPane';

interface Props {
    trade: OrderDetail;
    isDarkMode: boolean;
    signals?: SignalRow[] | null;
    onRequestSignals?: () => void;
}

type ZoomMode = 'full' | 'trade' | 'setup';

// Group oscillator keys by their group field for shared sub-panes
function getOscillatorGroup(key: string): string {
    const def = findSignalDef(key);
    return def?.group ?? key;
}

export default function TradeChart({trade, isDarkMode, signals, onRequestSignals}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const overlaySeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
    const [zoom, setZoom] = useState<ZoomMode>('trade');
    const [panelOpen, setPanelOpen] = useState(false);
    const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());
    const [subPaneGroups, setSubPaneGroups] = useState<string[]>([]);
    const [visibleRange, setVisibleRange] = useState<LogicalRange | null>(null);

    const candles = trade.candles!;
    const isJpy = trade.symbol.includes('JPY');
    const decimals = isJpy ? 3 : 5;

    const bars = candles.map(c => ({
        time: Math.floor(new Date(c.t).getTime() / 1000) as Time,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
    }));

    const entryTs = Math.floor(new Date(trade.created).getTime() / 1000);
    const exitTs = trade.closed ? Math.floor(new Date(trade.closed).getTime() / 1000) : null;
    const entryIdx = findNearestIdx(bars, entryTs);
    const exitIdx = exitTs !== null ? findNearestIdx(bars, exitTs) : null;

    const tvInterval = trade.timeframe === 'scalp' ? '1' : trade.timeframe === 'intraday' ? '15' : 'D';
    const tvSymbol = `FX:${trade.symbol.replace('_', '')}`;
    const tvUrl = `https://www.tradingview.com/chart/?symbol=${tvSymbol}&interval=${tvInterval}`;

    // Indicator toggle handlers
    const handleToggle = useCallback((key: string) => {
        setActiveIndicators(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const handleToggleAll = useCallback((keys: string[], on: boolean) => {
        setActiveIndicators(prev => {
            const next = new Set(prev);
            keys.forEach(k => on ? next.add(k) : next.delete(k));
            return next;
        });
    }, []);

    // Open indicator panel — triggers signal fetch on first open
    const openPanel = useCallback(() => {
        setPanelOpen(true);
        if (onRequestSignals) onRequestSignals();
    }, [onRequestSignals]);

    // Create chart
    useEffect(() => {
        if (!containerRef.current || bars.length === 0) return;

        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            candleRef.current = null;
            overlaySeriesRef.current.clear();
        }

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
            crosshair: {mode: CrosshairMode.Normal},
            rightPriceScale: {borderColor},
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

        // Broadcast range changes for sub-pane sync
        chart.timeScale().subscribeVisibleLogicalRangeChange((lr) => {
            setVisibleRange(lr);
        });

        // Candlestick series — hollow candles
        const candleSeries = chart.addCandlestickSeries({
            upColor: isDarkMode ? '#131722' : '#ffffff',
            downColor: '#ef5350',
            borderDownColor: '#ef5350',
            borderUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            wickUpColor: '#26a69a',
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

        // Spread lines — show estimated ask-side band
        if (trade.avg_spread && trade.avg_spread > 0) {
            const isShort = trade.direction === 'Short';
            const sign = isShort ? 1 : -1; // For shorts, ask = bid + spread; for longs, impact is below
            const avgAsk = trade.entry + sign * trade.avg_spread;
            candleSeries.createPriceLine({
                price: avgAsk,
                color: isDarkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.35)',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: false,
                title: `Avg Spread (${(trade.avg_spread * (isJpy ? 100 : 10000)).toFixed(1)} pips)`,
            });
        }
        if (trade.max_spread && trade.max_spread > 0) {
            const isShort = trade.direction === 'Short';
            const sign = isShort ? 1 : -1;
            const maxAsk = trade.entry + sign * trade.max_spread;
            candleSeries.createPriceLine({
                price: maxAsk,
                color: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: false,
                title: `Max Spread (${(trade.max_spread * (isJpy ? 100 : 10000)).toFixed(1)} pips)`,
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
            overlaySeriesRef.current.clear();
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
            const padBefore = 10;
            const padAfter = 10;
            const fromIdx = Math.max(0, entryIdx - padBefore);
            const toIdx = Math.min(bars.length - 1, (exitIdx ?? entryIdx) + padAfter);
            ts.setVisibleRange({
                from: bars[fromIdx].time,
                to: bars[toIdx].time,
            });
        } else if (zoom === 'setup' && entryIdx >= 0) {
            const setupBars = Math.min(60, entryIdx);
            const fromIdx = Math.max(0, entryIdx - setupBars);
            ts.setVisibleRange({
                from: bars[fromIdx].time,
                to: bars[entryIdx].time,
            });
        }
    }, [zoom, trade.id, isDarkMode]);

    // Render overlay indicators on main chart when active indicators change
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || !signals || signals.length === 0) return;

        const current = overlaySeriesRef.current;

        // Collect active overlay keys
        const activeOverlays = new Set<string>();
        const activeOscGroups = new Set<string>();

        for (const key of activeIndicators) {
            const def = findSignalDef(key);
            if (!def) continue;
            if (def.type === 'overlay') {
                activeOverlays.add(key);
            } else if (def.type === 'oscillator') {
                activeOscGroups.add(getOscillatorGroup(key));
            }
        }

        // Remove overlay series no longer active
        for (const [key, series] of current) {
            if (!activeOverlays.has(key)) {
                chart.removeSeries(series);
                current.delete(key);
            }
        }

        // Add new overlay series
        for (const key of activeOverlays) {
            if (current.has(key)) continue;
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

            const series = chart.addLineSeries({
                color: def.color,
                lineWidth: (def.lineWidth ?? 1) as 1 | 2 | 3 | 4,
                lineStyle: def.lineStyle === 'dashed' ? LineStyle.Dashed : def.lineStyle === 'dotted' ? LineStyle.Dotted : LineStyle.Solid,
                lastValueVisible: false,
                priceLineVisible: false,
            });
            series.setData(data);
            current.set(key, series);
        }

        // Update sub-pane groups
        const sortedGroups = Array.from(activeOscGroups);
        setSubPaneGroups(prev => {
            // Keep order stable, add new ones at end, remove gone ones
            const kept = prev.filter(g => sortedGroups.includes(g));
            const newGroups = sortedGroups.filter(g => !prev.includes(g));
            const result = [...kept, ...newGroups];
            // Max 4 sub-panes
            return result.slice(-4);
        });
    }, [activeIndicators, signals]);

    // Sub-pane range sync handler
    const handleSubPaneRangeChange = useCallback((lr: LogicalRange | null) => {
        if (!lr || !chartRef.current) return;
        chartRef.current.timeScale().setVisibleLogicalRange(lr);
    }, []);

    // Close a sub-pane group — deactivate all oscillators in that group
    const closeSubPane = useCallback((group: string) => {
        setSubPaneGroups(prev => prev.filter(g => g !== group));
        setActiveIndicators(prev => {
            const next = new Set(prev);
            for (const key of next) {
                const def = findSignalDef(key);
                if (def?.type === 'oscillator' && getOscillatorGroup(key) === group) {
                    next.delete(key);
                }
            }
            return next;
        });
    }, []);

    // Get active oscillator keys for a group
    const getGroupKeys = (group: string): string[] => {
        return Array.from(activeIndicators).filter(key => {
            const def = findSignalDef(key);
            return def?.type === 'oscillator' && getOscillatorGroup(key) === group;
        });
    };

    // Get group label
    const getGroupLabel = (group: string): string => {
        const key = getGroupKeys(group)[0];
        if (!key) return group;
        const def = findSignalDef(key);
        return def?.label ?? group;
    };

    const activeCount = activeIndicators.size;

    return (
        <>
            <div className={`${isDarkMode ? 'bg-[#131722]' : 'bg-white'} rounded-lg p-4 shadow mb-2 transition-colors duration-500`}>
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
                        <button
                            onClick={openPanel}
                            className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                isDarkMode
                                    ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Indicators
                            {activeCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-cyan-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                                    {activeCount > 9 ? '9+' : activeCount}
                                </span>
                            )}
                        </button>
                        <a
                            href={tvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-500 hover:text-cyan-400 ml-1"
                        >
                            TradingView &rarr;
                        </a>
                    </div>
                </div>
                <div ref={containerRef} style={{height: '500px'}}/>
            </div>

            {/* Oscillator Sub-Panes */}
            {signals && subPaneGroups.length > 0 && (
                <div className="mb-4 space-y-1">
                    {subPaneGroups.map(group => (
                        <SubPane
                            key={group}
                            signals={signals}
                            activeKeys={getGroupKeys(group)}
                            groupLabel={getGroupLabel(group)}
                            isDarkMode={isDarkMode}
                            visibleRange={visibleRange}
                            onVisibleRangeChange={handleSubPaneRangeChange}
                            onClose={() => closeSubPane(group)}
                        />
                    ))}
                </div>
            )}

            {/* Indicator Panel Drawer */}
            <IndicatorPanel
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
                isDarkMode={isDarkMode}
                score={trade.score}
                activeIndicators={activeIndicators}
                onToggle={handleToggle}
                onToggleAll={handleToggleAll}
            />
        </>
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
