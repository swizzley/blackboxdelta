import {useState, useEffect, useRef, useMemo} from 'react';
import {createChart, ColorType, LineStyle} from 'lightweight-charts';
import type {IChartApi, Time} from 'lightweight-charts';
import {useTheme} from '../../context/Theme';
import {fetchOrders} from '../../api/client';
import type {ApiOrder} from '../../context/Types';
import type {ProfileStats} from '../../context/Types';
import {formatDollar} from '../common/Util';
import dayjs from 'dayjs';

interface Props {
    profiles: {name: string; stats: ProfileStats}[];
}

export default function GoldenProfiles({profiles}: Props) {
    const {isDarkMode} = useTheme();
    const [expanded, setExpanded] = useState<string | null>(null);

    if (profiles.length === 0) return null;

    const muted = isDarkMode ? 'text-gray-500' : 'text-gray-400';

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 transition-colors duration-500`}>
            <div className="flex items-center gap-2 mb-4">
                <span className="text-amber-400 text-lg">&#9733;</span>
                <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Golden Profiles
                </h2>
                <span className={`text-sm font-mono ${muted}`}>({profiles.length})</span>
            </div>
            <div className="space-y-1">
                {profiles.map(p => (
                    <div key={p.name}>
                        <button
                            onClick={() => setExpanded(expanded === p.name ? null : p.name)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                                expanded === p.name
                                    ? (isDarkMode ? 'bg-amber-900/20 ring-1 ring-amber-500/30' : 'bg-amber-50 ring-1 ring-amber-300')
                                    : (isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50')
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full bg-amber-400 flex-shrink-0`}/>
                                <span className={`font-mono text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {p.name}
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`text-xs ${isDarkMode ? 'text-amber-400' : 'text-amber-600'} font-semibold`}>
                                    {p.stats.win_rate_pct.toFixed(0)}% WR
                                </span>
                                <span className={`text-xs font-mono ${muted}`}>
                                    {p.stats.total_orders}t
                                </span>
                                <span className={`text-xs font-mono font-semibold ${p.stats.total_pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {formatDollar(p.stats.total_pl)}
                                </span>
                                <span className={`text-xs ${muted} transition-transform ${expanded === p.name ? 'rotate-180' : ''}`}>
                                    &#9660;
                                </span>
                            </div>
                        </button>
                        {expanded === p.name && (
                            <GoldenDrawer profileName={p.name} isDarkMode={isDarkMode}/>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function GoldenDrawer({profileName, isDarkMode}: {profileName: string; isDarkMode: boolean}) {
    const [trades, setTrades] = useState<ApiOrder[] | null>(null);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        fetchOrders({profile: profileName, status: 'CLOSED', limit: 100}).then(orders => {
            if (orders) {
                // Sort by close time ascending
                const sorted = [...orders].sort((a, b) => (a.closed ?? '').localeCompare(b.closed ?? ''));
                setTrades(sorted);
            }
        });
    }, [profileName]);

    // Build cumulative P&L series
    const seriesData = useMemo(() => {
        if (!trades) return [];
        let cum = 0;
        let prevTime = 0;
        return trades.map((t, i) => {
            cum += t.profit ?? 0;
            let ts = Math.floor(new Date(t.closed ?? t.created).getTime() / 1000);
            if (ts <= prevTime) ts = prevTime + 1;
            prevTime = ts;
            return {time: ts as Time, value: Math.round(cum * 100) / 100, idx: i};
        });
    }, [trades]);

    // Chart tooltip state
    const [tooltip, setTooltip] = useState<{x: number; y: number; trade: ApiOrder; cum: number} | null>(null);

    // Create chart
    useEffect(() => {
        if (!containerRef.current || seriesData.length === 0) return;

        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        const bg = isDarkMode ? '#1a1a2e' : '#fefce8';
        const gridColor = isDarkMode ? '#222' : '#fef3c7';
        const textColor = isDarkMode ? '#666' : '#92400e';

        const chart = createChart(containerRef.current, {
            layout: {
                background: {type: ColorType.Solid, color: bg},
                textColor,
                fontFamily: 'Inter, system-ui, sans-serif',
            },
            grid: {vertLines: {color: gridColor}, horzLines: {color: gridColor}},
            rightPriceScale: {borderVisible: false, scaleMargins: {top: 0.1, bottom: 0.1}},
            timeScale: {borderVisible: false, timeVisible: true, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true, rightOffset: 2},
            crosshair: {
                horzLine: {visible: true, style: LineStyle.Dotted, color: isDarkMode ? '#444' : '#d97706', labelBackgroundColor: isDarkMode ? '#333' : '#fef3c7'},
                vertLine: {visible: true, style: LineStyle.Dotted, color: isDarkMode ? '#444' : '#d97706', labelBackgroundColor: isDarkMode ? '#333' : '#fef3c7'},
            },
            width: containerRef.current.clientWidth,
            height: 200,
        });
        chartRef.current = chart;

        const lineSeries = chart.addBaselineSeries({
            baseValue: {type: 'price', price: 0},
            topLineColor: '#f59e0b',
            topFillColor1: 'rgba(245,158,11,0.15)',
            topFillColor2: 'transparent',
            bottomLineColor: '#ef4444',
            bottomFillColor1: 'transparent',
            bottomFillColor2: 'rgba(239,68,68,0.08)',
            lineWidth: 2,
            lastValueVisible: true,
            priceLineVisible: false,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 3,
            crosshairMarkerBackgroundColor: '#f59e0b',
            priceFormat: {type: 'custom', formatter: (p: number) => formatDollar(p)},
        });
        lineSeries.setData(seriesData);


        // Crosshair — show tooltip and enable click
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.point || !param.seriesData || !trades) {
                setTooltip(null);
                return;
            }
            const ts = param.time as number;
            const match = seriesData.find(d => (d.time as number) === ts);
            if (!match) { setTooltip(null); return; }
            const trade = trades[match.idx];
            if (!trade) { setTooltip(null); return; }
            setTooltip({x: param.point.x, y: param.point.y, trade, cum: match.value});
        });

        // Click to select trade
        chart.subscribeClick((param) => {
            if (!param.time || !trades) return;
            const ts = param.time as number;
            const match = seriesData.find(d => (d.time as number) === ts);
            if (match) {
                setSelectedIdx(selectedIdx === match.idx ? null : match.idx);
            }
        });

        chart.timeScale().fitContent();

        const observer = new ResizeObserver(() => {
            if (containerRef.current) chart.applyOptions({width: containerRef.current.clientWidth});
        });
        observer.observe(containerRef.current);

        return () => { observer.disconnect(); chart.remove(); chartRef.current = null; };
    }, [seriesData, isDarkMode]);

    const muted = isDarkMode ? 'text-gray-500' : 'text-gray-400';

    if (!trades) {
        return (
            <div className={`mx-3 mt-2 mb-1 px-4 py-8 rounded-lg text-center text-sm ${muted} ${isDarkMode ? 'bg-slate-700/30' : 'bg-amber-50/50'}`}>
                Loading trades...
            </div>
        );
    }

    if (trades.length === 0) {
        return (
            <div className={`mx-3 mt-2 mb-1 px-4 py-4 rounded-lg text-center text-sm ${muted} ${isDarkMode ? 'bg-slate-700/30' : 'bg-amber-50/50'}`}>
                No closed trades found.
            </div>
        );
    }

    // Build trade detail table for selected point
    const selectedTrades = selectedIdx !== null && selectedIdx >= 0 && trades?.[selectedIdx] ? [trades[selectedIdx]] : [];

    return (
        <div className={`mx-3 mt-2 mb-1 rounded-lg overflow-hidden ${isDarkMode ? 'bg-[#12122a]' : 'bg-amber-50/80'}`}>
            {/* Chart */}
            <div className="relative px-3 pt-3">
                <div ref={containerRef} style={{height: '200px'}}/>
                {tooltip && (
                    <div
                        className={`absolute pointer-events-none z-10 px-3 py-2 rounded-lg border text-xs ${isDarkMode ? 'bg-[#1a1a2e] border-amber-500/20' : 'bg-white border-amber-300'}`}
                        style={{
                            left: Math.min(tooltip.x + 16, (containerRef.current?.clientWidth ?? 400) - 200),
                            top: Math.max(tooltip.y - 70, 4),
                        }}
                    >
                        <div className={muted}>{dayjs(tooltip.trade.closed ?? tooltip.trade.created).format('MMM D, HH:mm')}</div>
                        <div className="flex items-center gap-2">
                            <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{tooltip.trade.symbol.replace('_', '/')}</span>
                            <span className={`text-[10px] ${(tooltip.trade.quantity ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {(tooltip.trade.quantity ?? 0) > 0 ? 'Long' : 'Short'}
                            </span>
                        </div>
                        <div className={`font-semibold ${(tooltip.trade.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatDollar(tooltip.trade.profit ?? 0)}
                        </div>
                        <div className={`text-amber-400/60`}>Equity: {formatDollar(tooltip.cum)}</div>
                    </div>
                )}
                <style>{`a[href*="tradingview"] { display: none !important; }`}</style>
            </div>

            {/* Selected trade detail */}
            {selectedTrades.length > 0 && (
                <div className="px-3 pb-3 pt-2">
                    <div className={`text-[10px] font-medium uppercase tracking-wider mb-2 ${muted}`}>Trade Detail</div>
                    <div className={`rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-800/50' : 'bg-white'}`}>
                        {selectedTrades.map(t => {
                            const dir = (t?.quantity ?? 0) > 0 ? 'Long' : 'Short';
                            const tradeDate = dayjs(t.created);
                            const tradeUrl = `/trade/${tradeDate.format('YYYY/MM/DD')}/${t.id}`;
                            return (
                                <a
                                    key={t.id}
                                    href={tradeUrl}
                                    className={`flex items-center justify-between px-3 py-2 transition-colors ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`w-1.5 h-1.5 rounded-full ${dir === 'Long' ? 'bg-emerald-400' : 'bg-red-400'}`}/>
                                        <span className={`font-mono text-xs font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {t.symbol.replace('_', '/')}
                                        </span>
                                        <span className={`text-[10px] ${dir === 'Long' ? 'text-emerald-400' : 'text-red-400'}`}>{dir}</span>
                                        <span className={`text-[10px] ${muted}`}>{t.timeframe}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`text-[10px] ${muted}`}>
                                            {dayjs(t.closed ?? t.created).format('MMM D HH:mm')}
                                        </span>
                                        <span className={`text-xs font-mono ${t.close_reason ? muted : ''}`}>
                                            {t.close_reason ?? ''}
                                        </span>
                                        <span className={`font-mono text-xs font-semibold ${(t.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatDollar(t.profit ?? 0)}
                                        </span>
                                        <span className={`text-xs ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>&rarr;</span>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* All trades summary */}
            <div className={`px-3 pb-3 ${selectedTrades.length > 0 ? '' : 'pt-2'}`}>
                <button
                    onClick={() => setSelectedIdx(selectedIdx === -1 ? null : -1)}
                    className={`text-[10px] font-medium ${isDarkMode ? 'text-amber-400/60 hover:text-amber-400' : 'text-amber-600/60 hover:text-amber-600'}`}
                >
                    {selectedIdx === -1 ? '▲ Hide all trades' : `▼ Show all ${trades.length} trades`}
                </button>
                {selectedIdx === -1 && (
                    <div className={`mt-2 rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-800/50' : 'bg-white'} max-h-[300px] overflow-y-auto`}>
                        {trades.map(t => {
                            const dir = (t?.quantity ?? 0) > 0 ? 'Long' : 'Short';
                            const tradeDate = dayjs(t.created);
                            const tradeUrl = `/trade/${tradeDate.format('YYYY/MM/DD')}/${t.id}`;
                            return (
                                <a
                                    key={t.id}
                                    href={tradeUrl}
                                    className={`flex items-center justify-between px-3 py-1.5 transition-colors ${isDarkMode ? 'hover:bg-slate-700/50 border-b border-slate-700/30' : 'hover:bg-gray-50 border-b border-gray-100'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`w-1 h-1 rounded-full ${(t.profit ?? 0) >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}/>
                                        <span className={`font-mono text-[11px] ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {t.symbol.replace('_', '/')}
                                        </span>
                                        <span className={`text-[10px] ${dir === 'Long' ? 'text-emerald-400' : 'text-red-400'}`}>{dir}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] ${muted}`}>{dayjs(t.closed ?? t.created).format('M/D HH:mm')}</span>
                                        <span className={`font-mono text-[11px] font-medium ${(t.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatDollar(t.profit ?? 0)}
                                        </span>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
