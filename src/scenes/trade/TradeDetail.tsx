import {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import StatCard from '../common/StatCard';
import {useTheme} from '../../context/Theme';
import {formatDollar} from '../common/Util';
import {useApi} from '../../context/Api';
import {fetchOrder as apiFetchOrder} from '../../api/client';
import {OrderDetail, Score} from '../../context/Types';
import dayjs from 'dayjs';

export default function TradeDetail() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const {year, month, day, id} = useParams();
    const [trade, setTrade] = useState<OrderDetail | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!id) return;
        const staticUrl = `/data/trades/${year}/${month}/${day}/${id}.json`;

        // Try static first (has full detail + candles), then supplement with API
        axios.get(staticUrl)
            .then(r => {
                setTrade(r.data);
                // If API available, overlay with fresher data for non-candle fields
                if (apiAvailable) {
                    apiFetchOrder(id).then(apiOrder => {
                        if (apiOrder) {
                            setTrade(prev => prev ? {
                                ...prev,
                                status: apiOrder.status,
                                profit: apiOrder.profit,
                                stop_loss: apiOrder.stop_loss,
                                take_profit: apiOrder.take_profit,
                                closed: apiOrder.closed ?? prev.closed,
                            } : prev);
                        }
                    });
                }
            })
            .catch(() => {
                // Static failed — try API as sole source
                if (apiAvailable) {
                    apiFetchOrder(id).then(apiOrder => {
                        if (apiOrder) {
                            setTrade({
                                id: apiOrder.id,
                                trade_id: apiOrder.trade_id,
                                symbol: apiOrder.symbol,
                                direction: apiOrder.direction,
                                timeframe: apiOrder.timeframe,
                                status: apiOrder.status,
                                type: apiOrder.type,
                                entry: apiOrder.price,
                                stop_loss: apiOrder.stop_loss,
                                take_profit: apiOrder.take_profit,
                                quantity: apiOrder.quantity,
                                profit: apiOrder.profit,
                                created: apiOrder.created,
                                closed: apiOrder.closed,
                                duration_mins: null,
                                alert_id: apiOrder.alert_id,
                                risk_reward: apiOrder.risk_reward,
                            });
                        } else {
                            setError(true);
                        }
                    });
                } else {
                    setError(true);
                }
            });
    }, [year, month, day, id, apiAvailable]);

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    {/* Breadcrumb */}
                    <nav className="mb-4">
                        <ol className={`flex text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <li><a href="/" className="hover:text-cyan-500">Dashboard</a></li>
                            <li className="mx-2">/</li>
                            <li><a href="/history" className="hover:text-cyan-500">History</a></li>
                            <li className="mx-2">/</li>
                            <li>Trade #{id}</li>
                        </ol>
                    </nav>

                    {error ? (
                        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-12 shadow text-center`}>
                            <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Trade not found.</p>
                        </div>
                    ) : !trade ? (
                        <p className={`text-center py-20 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="flex flex-wrap items-center gap-4 mb-6">
                                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {trade.symbol.replace('_', '/')}
                                </h1>
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                                    trade.direction === 'Long'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                    {trade.direction}
                                </span>
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${isDarkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                    {trade.timeframe}
                                </span>
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                                    trade.status === 'CLOSED' ? (isDarkMode ? 'bg-slate-600 text-gray-300' : 'bg-gray-100 text-gray-700') :
                                        trade.status === 'FILLED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                                }`}>
                                    {trade.status}
                                </span>
                            </div>

                            {/* Stat Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <StatCard
                                    label="P&L"
                                    value={trade.profit !== null ? formatDollar(trade.profit) : 'Open'}
                                    color={trade.profit !== null ? (trade.profit >= 0 ? 'green' : 'red') : 'default'}
                                />
                                <StatCard label="Quantity" value={`${trade.quantity > 0 ? '+' : ''}${trade.quantity}`}/>
                                <StatCard
                                    label="Duration"
                                    value={trade.duration_mins !== null ? formatDuration(trade.duration_mins) : 'Open'}
                                />
                                <StatCard
                                    label="Risk/Reward"
                                    value={trade.risk_reward !== undefined ? trade.risk_reward.toFixed(2) : 'N/A'}
                                />
                            </div>

                            {/* Candlestick Chart */}
                            {trade.candles && trade.candles.length > 0 && (
                                <TradeChart trade={trade} isDarkMode={isDarkMode}/>
                            )}

                            {/* Score Section */}
                            {trade.score && <ScoreSection score={trade.score} isDarkMode={isDarkMode}/>}

                            {/* Price Levels + Timeline side by side */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                                <PriceLevels trade={trade} isDarkMode={isDarkMode}/>
                                <Timeline trade={trade} isDarkMode={isDarkMode}/>
                            </div>

                            {/* Detail Grid */}
                            <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-4 transition-colors duration-500`}>
                                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Details</h3>
                                <dl className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[
                                        ['Order ID', trade.id],
                                        ['Trade ID', trade.trade_id ?? '-'],
                                        ['Type', trade.type],
                                        ['Alert ID', trade.alert_id !== undefined ? String(trade.alert_id) : '-'],
                                        ['Created', dayjs(trade.created).format('YYYY-MM-DD HH:mm:ss')],
                                        ['Closed', trade.closed ? dayjs(trade.closed).format('YYYY-MM-DD HH:mm:ss') : '-'],
                                    ].map(([label, value]) => (
                                        <div key={label}>
                                            <dt className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</dt>
                                            <dd className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>

                            {/* Service Versions */}
                            {trade.versions && Object.keys(trade.versions).length > 0 && (
                                <VersionLinks versions={trade.versions} isDarkMode={isDarkMode}/>
                            )}
                        </>
                    )}
                </div>
            </div>
            <Foot/>
        </>
    );
}

function tradingViewUrl(symbol: string, interval: string): string {
    const tvSymbol = `FX:${symbol.replace('_', '')}`;
    return `https://www.tradingview.com/chart/?symbol=${tvSymbol}&interval=${interval}`;
}

function TradeChart({trade, isDarkMode}: { trade: OrderDetail; isDarkMode: boolean }) {
    const candles = trade.candles!;
    const tvInterval = trade.timeframe === 'scalp' ? '1' : trade.timeframe === 'intraday' ? '15' : 'D';
    const tvUrl = tradingViewUrl(trade.symbol, tvInterval);

    // Format time labels — include date for longer trades
    const spanHours = (new Date(candles[candles.length - 1].t).getTime() - new Date(candles[0].t).getTime()) / 3600000;
    const timeFmt = spanHours > 24 ? 'MM/DD HH:mm' : 'HH:mm';
    const times = candles.map(c => dayjs(c.t).format(timeFmt));

    // Find candle indices closest to entry/exit
    const entryIdx = findClosestIndex(candles.map(c => c.t), trade.created);
    const exitIdx = trade.closed ? findClosestIndex(candles.map(c => c.t), trade.closed) : null;

    // Color-code entry/exit candles: purple for entry, amber for exit, pink for same-candle
    // ECharts candlestick: [open, close, low, high]
    const entryColor = '#8b5cf6';  // purple
    const exitColor = '#f59e0b';   // amber
    const sameColor = '#e11d48';   // pink — entry & exit on same candle
    const isSameCandle = exitIdx !== null && entryIdx === exitIdx;
    const ohlc = candles.map((c, i) => {
        const item: any = {value: [c.o, c.c, c.l, c.h]};
        if (isSameCandle && i === entryIdx) {
            item.itemStyle = {color: sameColor, borderColor: sameColor, color0: sameColor, borderColor0: sameColor};
        } else if (i === entryIdx) {
            item.itemStyle = {color: entryColor, borderColor: entryColor, color0: entryColor, borderColor0: entryColor};
        } else if (exitIdx !== null && i === exitIdx) {
            item.itemStyle = {color: exitColor, borderColor: exitColor, color0: exitColor, borderColor0: exitColor};
        }
        return item;
    });

    // Horizontal lines for SL, TP, entry
    const markLineData: any[] = [
        {
            name: 'Entry',
            yAxis: trade.entry,
            lineStyle: {color: entryColor, type: 'solid', width: 1.5},
            label: {formatter: 'Entry {c}', position: 'insideEndTop', color: entryColor, fontSize: 10},
        },
        {
            name: 'Stop Loss',
            yAxis: trade.stop_loss,
            lineStyle: {color: '#ef4444', type: 'dashed', width: 1.5},
            label: {formatter: 'SL {c}', position: 'insideEndTop', color: '#ef4444', fontSize: 10},
        },
        {
            name: 'Take Profit',
            yAxis: trade.take_profit,
            lineStyle: {color: '#10b981', type: 'dashed', width: 1.5},
            label: {formatter: 'TP {c}', position: 'insideEndTop', color: '#10b981', fontSize: 10},
        },
    ];

    if (trade.exit !== undefined) {
        markLineData.push({
            name: 'Exit',
            yAxis: trade.exit,
            lineStyle: {color: exitColor, type: 'dotted', width: 1.5},
            label: {formatter: 'Exit {c}', position: 'insideEndBottom', color: exitColor, fontSize: 10},
        });
    }

    // Compute y-axis range: encompass SL, TP, and all candle data with padding
    const allPrices = [
        trade.entry, trade.stop_loss, trade.take_profit,
        ...(trade.exit !== undefined ? [trade.exit] : []),
        ...candles.flatMap(c => [c.h, c.l]),
    ];
    const priceMin = Math.min(...allPrices);
    const priceMax = Math.max(...allPrices);
    const padding = (priceMax - priceMin) * 0.15;

    const option = {
        backgroundColor: 'transparent',
        animation: false,
        tooltip: {
            trigger: 'axis',
            axisPointer: {type: 'cross'},
            formatter: (params: any) => {
                const d = params[0];
                if (!d || !d.data) return '';
                const v = Array.isArray(d.data) ? d.data : d.data.value;
                if (!v) return '';
                const [o, c, l, h] = v;
                return `${d.axisValue}<br/>O: ${o.toFixed(5)}<br/>H: ${h.toFixed(5)}<br/>L: ${l.toFixed(5)}<br/>C: ${c.toFixed(5)}`;
            },
        },
        grid: {
            left: '1%',
            right: '1%',
            bottom: '10%',
            top: '5%',
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            data: times,
            axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 10},
            axisLine: {lineStyle: {color: isDarkMode ? '#374151' : '#d1d5db'}},
        },
        yAxis: {
            type: 'value',
            min: (priceMin - padding).toFixed(5),
            max: (priceMax + padding).toFixed(5),
            scale: true,
            axisLabel: {
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                formatter: (v: number) => v.toFixed(trade.symbol.includes('JPY') ? 3 : 5),
            },
            splitLine: {lineStyle: {color: isDarkMode ? '#374151' : '#e5e7eb'}},
        },
        dataZoom: [
            {type: 'inside', start: 0, end: 100},
            {type: 'slider', start: 0, end: 100, height: 20, bottom: 5},
        ],
        series: [
            {
                type: 'candlestick',
                data: ohlc,
                itemStyle: {
                    color: '#10b981',
                    color0: '#ef4444',
                    borderColor: '#10b981',
                    borderColor0: '#ef4444',
                },
                markLine: {
                    symbol: 'none',
                    data: markLineData,
                    animation: false,
                },
            },
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow mb-6 transition-colors duration-500`}>
            <div className="flex items-center justify-between mb-2">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {trade.symbol.replace('_', '/')} &middot; {trade.timeframe === 'scalp' ? '1m' : trade.timeframe === 'intraday' ? '15m' : 'Daily'}
                </h3>
                <a
                    href={tvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-500 hover:text-cyan-400"
                >
                    Open in TradingView &rarr;
                </a>
            </div>
            <div>
                <ReactECharts option={option} style={{height: '500px'}}/>
            </div>
            <div className={`flex items-center gap-5 mt-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {isSameCandle ? (
                    <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{background: '#e11d48'}}/> Entry + Exit candle</span>
                ) : (
                    <>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{background: '#8b5cf6'}}/> Entry candle</span>
                        {exitIdx !== null && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{background: '#f59e0b'}}/> Exit candle</span>}
                    </>
                )}
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{background: '#10b981'}}/> Bullish</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{background: '#ef4444'}}/> Bearish</span>
            </div>
        </div>
    );
}

function findClosestIndex(timestamps: string[], target: string): number {
    const targetMs = new Date(target).getTime();
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < timestamps.length; i++) {
        const diff = Math.abs(new Date(timestamps[i]).getTime() - targetMs);
        if (diff < minDiff) {
            minDiff = diff;
            closest = i;
        }
    }
    return closest;
}

function PriceLevels({trade, isDarkMode}: { trade: OrderDetail; isDarkMode: boolean }) {
    const levels = [
        {label: 'Take Profit', value: trade.take_profit, color: 'text-emerald-500', dot: 'bg-emerald-500'},
        {label: 'Entry', value: trade.entry, color: 'text-indigo-500', dot: 'bg-indigo-500'},
        ...(trade.exit !== undefined ? [{label: 'Exit', value: trade.exit, color: 'text-amber-500', dot: 'bg-amber-500'}] : []),
        {label: 'Stop Loss', value: trade.stop_loss, color: 'text-red-500', dot: 'bg-red-500'},
    ];

    const pipMultiplier = trade.symbol.includes('JPY') ? 100 : 10000;

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Price Levels</h3>
            <div className="space-y-3">
                {levels.map(l => {
                    const pipsFromEntry = ((l.value - trade.entry) * pipMultiplier);
                    return (
                        <div key={l.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${l.dot}`}/>
                                <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{l.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-xs ${pipsFromEntry >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {l.label !== 'Entry' ? `${pipsFromEntry >= 0 ? '+' : ''}${pipsFromEntry.toFixed(1)} pips` : ''}
                                </span>
                                <span className={`text-sm font-mono font-medium ${l.color}`}>{l.value.toFixed(5)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Timeline({trade, isDarkMode}: { trade: OrderDetail; isDarkMode: boolean }) {
    const events = [
        {label: 'Created', time: trade.created, color: 'bg-cyan-500'},
        ...(trade.status !== 'PENDING' && trade.status !== 'CANCELLED'
            ? [{label: 'Filled', time: trade.created, color: 'bg-blue-500'}]
            : []),
        ...(trade.closed
            ? [{label: 'Closed', time: trade.closed, color: trade.profit !== null && trade.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}]
            : []),
    ];

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Timeline</h3>
            <div className="space-y-4">
                {events.map((e, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${e.color} flex-shrink-0`}/>
                        <div>
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{e.label}</p>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                {dayjs(e.time).format('YYYY-MM-DD HH:mm:ss')}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ScoreSection({score, isDarkMode}: { score: Score; isDarkMode: boolean }) {
    const components: { label: string; key: keyof Score; color: string }[] = [
        {label: 'Trend', key: 'trend_score', color: '#6366f1'},
        {label: 'MA', key: 'ma_score', color: '#8b5cf6'},
        {label: 'Crossover', key: 'crossover_score', color: '#a78bfa'},
        {label: 'Oscillator', key: 'oscillator_score', color: '#f59e0b'},
        {label: 'Volatility', key: 'volatility_score', color: '#ef4444'},
        {label: 'Volume', key: 'volume_score', color: '#3b82f6'},
        {label: 'Fib Stack', key: 'fib_stack_score', color: '#14b8a6'},
        {label: 'Momentum', key: 'momentum_projection_score', color: '#f97316'},
        {label: 'Structure', key: 'structure_score', color: '#ec4899'},
        {label: 'Cycle', key: 'cycle_score', color: '#84cc16'},
        {label: 'Pattern', key: 'pattern_score', color: '#06b6d4'},
    ];

    const recColor = score.recommendation.includes('Buy')
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : score.recommendation.includes('Sell')
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

    const barOption = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: {type: 'shadow'},
        },
        grid: {
            left: '3%',
            right: '5%',
            bottom: '3%',
            top: '5%',
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            data: components.map(c => c.label),
            axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11, rotate: 35},
            axisLine: {lineStyle: {color: isDarkMode ? '#374151' : '#d1d5db'}},
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLabel: {color: isDarkMode ? '#9ca3af' : '#6b7280'},
            splitLine: {lineStyle: {color: isDarkMode ? '#1e293b' : '#f3f4f6'}},
        },
        series: [
            {
                type: 'bar',
                data: components.map(c => ({
                    value: score[c.key] as number,
                    itemStyle: {color: c.color},
                })),
                barWidth: '60%',
                label: {
                    show: true,
                    position: 'top',
                    color: isDarkMode ? '#d1d5db' : '#374151',
                    fontSize: 11,
                    formatter: (p: any) => p.value.toFixed(1),
                },
            },
            {
                type: 'line',
                data: components.map(() => score.final_score),
                lineStyle: {color: '#10b981', width: 2, type: 'dashed'},
                symbol: 'none',
                tooltip: {show: false},
            },
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow mb-6 transition-colors duration-500`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Signal Score
                    </h3>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${recColor}`}>
                        {score.recommendation}
                    </span>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Final Score</span>
                        <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {score.final_score.toFixed(1)}
                        </p>
                    </div>
                    <div className="text-right">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Confidence</span>
                        <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {(score.confidence * 100).toFixed(0)}%
                        </p>
                    </div>
                </div>
            </div>
            <ReactECharts option={barOption} style={{height: '350px'}}/>
        </div>
    );
}

function formatDuration(mins: number): string {
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
}

const GITLAB_BASE = 'http://gitlab.aspendenver.local/dmorgan';

function VersionLinks({versions, isDarkMode}: { versions: Record<string, { sha: string; message: string }>; isDarkMode: boolean }) {
    const services = Object.entries(versions);
    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-4 mt-6 transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Service Versions</h3>
            <div className="space-y-2">
                {services.map(([name, v]) => (
                    <div key={name} className="flex items-start gap-3">
                        <span className={`text-xs font-medium w-28 shrink-0 pt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {name}
                        </span>
                        <a
                            href={`${GITLAB_BASE}/${name}/commit/${v.sha}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-500 hover:text-cyan-400 font-mono"
                        >
                            {v.sha.slice(0, 8)}
                        </a>
                        <span className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {v.message}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
