import {useEffect, useRef, useState, useMemo} from 'react';
import {createChart, ColorType, LineStyle} from 'lightweight-charts';
import type {IChartApi, Time} from 'lightweight-charts';
import {useTheme} from '../../context/Theme';
import {formatDollar} from '../common/Util';
import type {EquityPoint} from '../../context/Types';

interface Props {
    data: EquityPoint[];
}

export default function EquityCurve({data}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const {isDarkMode} = useTheme();
    const [tooltip, setTooltip] = useState<{date: string; cum: number; x: number; y: number} | null>(null);

    const accent = isDarkMode ? '#22d3ee' : '#ec4899';
    const accentFaded = isDarkMode ? 'rgba(34,211,238,0.12)' : 'rgba(236,72,153,0.12)';
    const bg = isDarkMode ? '#111111' : '#ffffff';
    const gridColor = isDarkMode ? '#1a1a1a' : '#f3f4f6';
    const textColor = isDarkMode ? '#555555' : '#94a3b8';

    // Deduplicate timestamps (multiple trades can close in the same second)
    const seriesData = useMemo(() => {
        let prevTime = 0;
        return data.map(d => {
            let t = Math.floor(new Date(d.t).getTime() / 1000);
            if (t <= prevTime) t = prevTime + 1;
            prevTime = t;
            return {time: t as Time, value: d.p, rawTime: d.t};
        });
    }, [data]);

    useEffect(() => {
        if (!containerRef.current || seriesData.length === 0) return;

        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        const chart = createChart(containerRef.current, {
            layout: {
                background: {type: ColorType.Solid, color: bg},
                textColor,
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            },
            grid: {vertLines: {color: gridColor}, horzLines: {color: gridColor}},
            rightPriceScale: {borderVisible: false, scaleMargins: {top: 0.1, bottom: 0.1}},
            timeScale: {
                borderVisible: false,
                timeVisible: true,
                secondsVisible: false,
                fixLeftEdge: true,
                fixRightEdge: true,
                rightOffset: 2,
            },
            crosshair: {
                horzLine: {visible: true, style: LineStyle.Dotted, color: isDarkMode ? '#333333' : '#cbd5e1', labelBackgroundColor: isDarkMode ? '#222222' : '#f1f5f9'},
                vertLine: {visible: true, style: LineStyle.Dotted, color: isDarkMode ? '#333333' : '#cbd5e1', labelBackgroundColor: isDarkMode ? '#222222' : '#f1f5f9'},
            },
            width: containerRef.current.clientWidth,
            height: 300,
        });
        chartRef.current = chart;

        const baselineSeries = chart.addBaselineSeries({
            baseValue: {type: 'price', price: 0},
            topLineColor: accent,
            topFillColor1: accentFaded,
            topFillColor2: 'transparent',
            bottomLineColor: '#ef4444',
            bottomFillColor1: 'transparent',
            bottomFillColor2: 'rgba(239,68,68,0.08)',
            lineWidth: 2,
            lastValueVisible: true,
            priceLineVisible: false,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 3,
            crosshairMarkerBackgroundColor: accent,
            priceFormat: {type: 'custom', formatter: (price: number) => formatDollar(price)},
        });
        baselineSeries.setData(seriesData);

        // Zero line
        baselineSeries.createPriceLine({
            price: 0,
            color: isDarkMode ? '#222222' : '#e5e7eb',
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: false,
            title: '',
        });

        // Tooltip
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.point || !param.seriesData) {
                setTooltip(null);
                return;
            }
            const cumData = param.seriesData.get(baselineSeries) as {value?: number} | undefined;
            const cum = cumData?.value ?? 0;
            const ts = param.time as number;
            const match = seriesData.find(d => (d.time as number) === ts);
            const dateStr = match?.rawTime
                ? new Date(match.rawTime).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})
                : '';
            setTooltip({date: dateStr, cum, x: param.point.x, y: param.point.y});
        });

        chart.timeScale().fitContent();

        const observer = new ResizeObserver(() => {
            if (containerRef.current) chart.applyOptions({width: containerRef.current.clientWidth});
        });
        observer.observe(containerRef.current);

        return () => { observer.disconnect(); chart.remove(); chartRef.current = null; };
    }, [seriesData, isDarkMode]);

    const tooltipBg = isDarkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200';
    const tooltipMuted = isDarkMode ? 'text-[#666]' : 'text-gray-400';

    return (
        <div className="relative" style={{height: '300px'}}>
            <div ref={containerRef} style={{height: '300px'}}/>
            {tooltip && (
                <div
                    className={`absolute pointer-events-none z-10 px-3 py-2 rounded-lg border text-xs font-sans ${tooltipBg}`}
                    style={{
                        left: Math.min(tooltip.x + 16, (containerRef.current?.clientWidth ?? 600) - 160),
                        top: Math.max(tooltip.y - 50, 4),
                    }}
                >
                    <div className={tooltipMuted}>{tooltip.date}</div>
                    <div className={`font-semibold ${tooltip.cum >= 0 ? (isDarkMode ? 'text-cyan-400' : 'text-pink-500') : 'text-red-400'}`}>
                        {formatDollar(tooltip.cum)}
                    </div>
                </div>
            )}
            <style>{`a[href*="tradingview"] { display: none !important; }`}</style>
        </div>
    );
}
