import {useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef} from 'react';
import {createChart, ColorType, CrosshairMode, LineStyle} from 'lightweight-charts';
import type {IChartApi, ISeriesApi, Time, LogicalRange} from 'lightweight-charts';
import {OrderDetail, SignalRow} from '../../context/Types';
import {findSignalDef, findComponentForSignal} from './signalMapping';
import IndicatorPanel from './IndicatorPanel';
import SubPane from './SubPane';

export interface TradeChartHandle {
    clickComponent: (componentKey: string) => void;
}

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

const TradeChart = forwardRef<TradeChartHandle, Props>(function TradeChart({trade, isDarkMode, signals, onRequestSignals}, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const overlaySeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
    const baseMarkersRef = useRef<any[]>([]);
    const mainSyncingRef = useRef(false);
    const [zoom, setZoom] = useState<ZoomMode>('trade');
    const [panelOpen, setPanelOpen] = useState(false);
    // Ref for programmatic component click (used by score bar click)
    const pendingComponentClickRef = useRef<string | null>(null);
    const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());
    const [subPaneGroups, setSubPaneGroups] = useState<string[]>([]);
    const [visibleRange, setVisibleRange] = useState<LogicalRange | null>(null);
    const [overlayLegend, setOverlayLegend] = useState<{label: string; color: string; value: string}[]>([]);

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

    const handleClearAll = useCallback(() => {
        setActiveIndicators(new Set());
        setSubPaneGroups([]);
    }, []);

    // Open indicator panel — triggers signal fetch on first open
    const openPanel = useCallback(() => {
        setPanelOpen(true);
        if (onRequestSignals) onRequestSignals();
    }, [onRequestSignals]);

    // Expose clickComponent for external callers (e.g. score bar chart click)
    useImperativeHandle(ref, () => ({
        clickComponent: (componentKey: string) => {
            pendingComponentClickRef.current = componentKey;
            openPanel();
        },
    }), [openPanel]);

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

        // Broadcast range changes for sub-pane sync (guarded to prevent feedback loop)
        chart.timeScale().subscribeVisibleLogicalRangeChange((lr) => {
            if (!mainSyncingRef.current) {
                setVisibleRange(lr);
            }
        });

        // Crosshair move — update overlay legend with current values
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.seriesData) {
                setOverlayLegend([]);
                return;
            }
            const entries: {label: string; color: string; value: string}[] = [];
            for (const [key, series] of overlaySeriesRef.current) {
                const data = param.seriesData.get(series) as {value?: number; close?: number} | undefined;
                if (!data) continue;
                const val = data.value ?? data.close;
                if (val === undefined) continue;
                const def = findSignalDef(key);
                entries.push({
                    label: def?.label ?? key,
                    color: def?.color ?? '#787b86',
                    value: val.toFixed(decimals),
                });
            }
            setOverlayLegend(entries);
        });

        // Candlestick series — hollow candles
        // Y-axis auto-scaled to a pip range derived from the pair's avg_spread × TF multiplier.
        // This gives each pair+TF a natural viewing window proportional to its volatility.
        const tfPipMultiplier: Record<string, number> = {
            '1m': 5, 'scalp': 5,
            '5m': 10,
            '15m': 18, 'intraday': 18,
            '1h': 35,
            '4h': 70,
            'daily': 150, 'weekly': 300,
        };
        const pip = isJpy ? 0.01 : 0.0001;
        const spreadPips = trade.avg_spread ?? 10;
        const tfMult = tfPipMultiplier[trade.timeframe] ?? 18;
        const viewRangePips = spreadPips * tfMult;
        const viewRangePrice = viewRangePips * pip;

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
            autoscaleInfoProvider: (original: () => any) => {
                const res = original();
                if (res !== null && res.priceRange) {
                    // Clamp the visible range to the TF×spread pip window centered on entry
                    const mid = trade.entry;
                    const lo = mid - viewRangePrice / 2;
                    const hi = mid + viewRangePrice / 2;
                    res.priceRange.minValue = Math.max(res.priceRange.minValue, lo);
                    res.priceRange.maxValue = Math.min(res.priceRange.maxValue, hi);
                    // If candle data is entirely within our window, use it as-is with margin
                    if (res.priceRange.minValue >= res.priceRange.maxValue) {
                        res.priceRange.minValue = lo;
                        res.priceRange.maxValue = hi;
                    }
                }
                return res;
            },
        });
        candleSeries.setData(bars);
        candleRef.current = candleSeries;

        // Volume histogram (on separate price scale, bottom 20% of chart)
        const hasVolume = candles.some(c => c.v && c.v > 0);
        if (hasVolume) {
            const volumeSeries = chart.addHistogramSeries({
                color: '#26a69a',
                priceFormat: {type: 'volume'},
                priceScaleId: 'volume',
                lastValueVisible: false,
                priceLineVisible: false,
            });
            chart.priceScale('volume').applyOptions({
                scaleMargins: {top: 0.8, bottom: 0},
            });
            volumeSeries.setData(
                candles.map(c => ({
                    time: Math.floor(new Date(c.t).getTime() / 1000) as Time,
                    value: c.v ?? 0,
                    color: c.c >= c.o ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
                }))
            );
        }

        // Price lines on an invisible helper series — keeps them off the candle autoscale.
        // The helper series returns null from autoscaleInfoProvider so it never affects the y-axis.
        const priceLinesHelper = chart.addLineSeries({
            color: 'transparent',
            lineVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
            priceScaleId: 'trade-levels',
            autoscaleInfoProvider: () => null,
        });
        // Mirror the right price scale formatting but hide the scale itself
        chart.priceScale('trade-levels').applyOptions({
            visible: false,
            autoScale: false,
        });
        // Give it a single invisible data point so lightweight-charts accepts price lines
        priceLinesHelper.setData([{time: bars[0].time, value: trade.entry}]);

        priceLinesHelper.createPriceLine({
            price: trade.entry,
            color: '#8b5cf6',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: '',
        });
        priceLinesHelper.createPriceLine({
            price: trade.stop_loss,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'SL',
        });
        if (trade.take_profit && trade.take_profit > 0) {
            priceLinesHelper.createPriceLine({
                price: trade.take_profit,
                color: '#10b981',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: 'TP',
            });
        }
        if (trade.exit !== undefined) {
            priceLinesHelper.createPriceLine({
                price: trade.exit,
                color: '#f59e0b',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: 'Exit',
            });
        }

        // Spread lines
        const pipSize = isJpy ? 0.01 : 0.0001;
        if (trade.avg_spread && trade.avg_spread > 0) {
            const isShort = trade.direction === 'Short';
            const sign = isShort ? 1 : -1;
            const avgSpreadPrice = trade.avg_spread * pipSize;
            const avgAsk = trade.entry + sign * avgSpreadPrice;
            priceLinesHelper.createPriceLine({
                price: avgAsk,
                color: isDarkMode ? 'rgba(251, 191, 36, 0.5)' : 'rgba(245, 158, 11, 0.5)',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: `Spd ${trade.avg_spread.toFixed(1)}p`,
            });
        }
        if (trade.max_spread && trade.max_spread > 0) {
            const isShort = trade.direction === 'Short';
            const sign = isShort ? 1 : -1;
            const maxSpreadPrice = trade.max_spread * pipSize;
            const maxAsk = trade.entry + sign * maxSpreadPrice;
            priceLinesHelper.createPriceLine({
                price: maxAsk,
                color: isDarkMode ? 'rgba(251, 191, 36, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: false,
                title: `Max ${trade.max_spread.toFixed(1)}p`,
            });
        }

        // Entry/exit markers — set initially, will be rebuilt by pattern marker effect
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
        baseMarkersRef.current = markers;

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

            if (def.render === 'dots') {
                // SAR-style dot rendering — hide line, show only point markers
                const series = chart.addLineSeries({
                    color: def.color,
                    lineVisible: false,
                    lastValueVisible: false,
                    priceLineVisible: false,
                    pointMarkersVisible: true,
                    pointMarkersRadius: 2,
                    crosshairMarkerVisible: false,
                });
                series.setData(data);
                current.set(key, series);
            } else if (def.render === 'area-fill') {
                // Bollinger Band fill — area series with transparent line, shaded fill
                const isUpper = key === 'bollinger_top';
                const series = chart.addAreaSeries({
                    topColor: isUpper ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    bottomColor: isUpper ? 'transparent' : 'rgba(59, 130, 246, 0.08)',
                    lineColor: def.color,
                    lineWidth: 1,
                    lineStyle: LineStyle.Dashed,
                    lastValueVisible: false,
                    priceLineVisible: false,
                    invertFilledArea: !isUpper,
                });
                series.setData(data);
                current.set(key, series as any);
            } else {
                // Standard line series
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
        }

        // Update sub-pane groups
        const sortedGroups = Array.from(activeOscGroups);
        setSubPaneGroups(prev => {
            // Keep order stable, add new ones at end, remove gone ones
            const kept = prev.filter(g => sortedGroups.includes(g));
            const newGroups = sortedGroups.filter(g => !prev.includes(g));
            const result = [...kept, ...newGroups];
            return result;
        });
    }, [activeIndicators, signals]);

    // Render candle pattern markers on main chart when event-type indicators are toggled
    // TradingView style: small markers with short abbreviation text labels
    // Bullish = green below bar, Bearish = red above bar
    useEffect(() => {
        const candle = candleRef.current;
        if (!candle || !signals || signals.length === 0) {
            if (candle && baseMarkersRef.current.length > 0) {
                candle.setMarkers([...baseMarkersRef.current].sort((a, b) => (a.time as number) - (b.time as number)));
            }
            return;
        }

        // Collect active event keys
        const activeEvents: string[] = [];
        for (const key of activeIndicators) {
            const def = findSignalDef(key);
            if (def?.type === 'event') activeEvents.push(key);
        }

        if (activeEvents.length === 0) {
            const sorted = [...baseMarkersRef.current].sort((a, b) => (a.time as number) - (b.time as number));
            candle.setMarkers(sorted);
            return;
        }

        const patternMarkers: any[] = [];

        for (const row of signals) {
            const ts = (typeof row.t === 'number' ? Math.floor(row.t / 1000) : Math.floor(new Date(row.t as string).getTime() / 1000)) as Time;

            const bullish: {abbrev: string; tier: number}[] = [];
            const bearish: {abbrev: string; tier: number}[] = [];

            for (const key of activeEvents) {
                const v = row[key];
                if (v === undefined || v === null || v === 0 || typeof v !== 'number') continue;
                const def = findSignalDef(key);
                const abbrev = def?.abbrev ?? def?.label?.slice(0, 3) ?? key.slice(4);
                const tier = def?.tier ?? 1;
                if (v > 0) bullish.push({abbrev, tier});
                else bearish.push({abbrev, tier});
            }

            // Bullish patterns: green arrow-up below bar with abbreviation text
            if (bullish.length > 0) {
                const maxTier = Math.max(...bullish.map(b => b.tier));
                const text = bullish.map(b => b.abbrev).join(' ');
                patternMarkers.push({
                    time: ts,
                    position: 'belowBar',
                    shape: 'arrowUp',
                    color: maxTier >= 3 ? '#16a34a' : maxTier >= 2 ? '#22c55e' : '#4ade80',
                    text,
                    size: 1,
                });
            }
            // Bearish patterns: red arrow-down above bar with abbreviation text
            if (bearish.length > 0) {
                const maxTier = Math.max(...bearish.map(b => b.tier));
                const text = bearish.map(b => b.abbrev).join(' ');
                patternMarkers.push({
                    time: ts,
                    position: 'aboveBar',
                    shape: 'arrowDown',
                    color: maxTier >= 3 ? '#dc2626' : maxTier >= 2 ? '#ef4444' : '#f87171',
                    text,
                    size: 1,
                });
            }
        }

        const allMarkers = [...baseMarkersRef.current, ...patternMarkers];
        allMarkers.sort((a, b) => (a.time as number) - (b.time as number));
        candle.setMarkers(allMarkers);
    }, [activeIndicators, signals]);

    // Sub-pane range sync handler (guarded to prevent feedback loop)
    const handleSubPaneRangeChange = useCallback((lr: LogicalRange | null) => {
        if (!lr || !chartRef.current) return;
        mainSyncingRef.current = true;
        chartRef.current.timeScale().setVisibleLogicalRange(lr);
        requestAnimationFrame(() => { mainSyncingRef.current = false; });
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

    // Get the parent component color for a sub-pane group
    const getGroupColor = (group: string): string | undefined => {
        const key = getGroupKeys(group)[0];
        if (!key) return undefined;
        return findComponentForSignal(key)?.color;
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
                <div className="relative">
                    <div ref={containerRef} style={{height: '500px'}}/>
                    {overlayLegend.length > 0 && (
                        <div className="absolute top-1 left-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 pointer-events-none max-w-[80%]">
                            {overlayLegend.map(e => (
                                <span key={e.label} className="flex items-center gap-1 text-[10px]">
                                    <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{backgroundColor: e.color}}/>
                                    <span style={{color: e.color}}>{e.label}</span>
                                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{e.value}</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Oscillator Sub-Panes */}
            {signals && subPaneGroups.length > 0 && (
                <div className="mb-4 space-y-1">
                    {/* Sub-pane navigation */}
                    {subPaneGroups.length > 2 && (
                        <div className={`flex items-center justify-between px-2 py-1 rounded-md text-xs ${
                            isDarkMode ? 'bg-slate-800 text-gray-400' : 'bg-gray-100 text-gray-500'
                        }`}>
                            <span>{subPaneGroups.length} oscillator panes</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        const el = document.getElementById('subpane-0');
                                        el?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
                                    }}
                                    className={`px-2 py-0.5 rounded ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                                >
                                    &#9650; First
                                </button>
                                <button
                                    onClick={() => {
                                        const el = document.getElementById(`subpane-${subPaneGroups.length - 1}`);
                                        el?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
                                    }}
                                    className={`px-2 py-0.5 rounded ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                                >
                                    &#9660; Last
                                </button>
                            </div>
                        </div>
                    )}
                    {subPaneGroups.map((group, i) => (
                        <div key={group} id={`subpane-${i}`}>
                        <SubPane
                            signals={signals}
                            activeKeys={getGroupKeys(group)}
                            groupLabel={getGroupLabel(group)}
                            groupColor={getGroupColor(group)}
                            isDarkMode={isDarkMode}
                            visibleRange={visibleRange}
                            onVisibleRangeChange={handleSubPaneRangeChange}
                            onClose={() => closeSubPane(group)}
                        />
                        </div>
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
                onClearAll={handleClearAll}
                signals={signals}
                tradeTime={trade.created}
                pendingComponentClick={pendingComponentClickRef}
            />
        </>
    );
});

export default TradeChart;

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
