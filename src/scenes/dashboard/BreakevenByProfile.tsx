import ReactECharts from 'echarts-for-react';
import {useTheme} from '../../context/Theme';
import {ProfileStats} from '../../context/Types';

interface Props {
    profiles: ProfileStats[];
}

export default function BreakevenByProfile({profiles}: Props) {
    const {isDarkMode} = useTheme();

    // Show all profiles with at least 1 decided trade, sorted by margin above breakeven
    const valid = profiles
        .filter(p => (p.winners + p.losers) >= 1)
        .sort((a, b) => (b.win_rate_pct - (b.breakeven_pct ?? 50)) - (a.win_rate_pct - (a.breakeven_pct ?? 50)));

    if (valid.length === 0) return null;

    const labels = valid.map(p => p.profile);
    const winRates = valid.map(p => Math.round(p.win_rate_pct * 10) / 10);
    const breakevens = valid.map(p => p.breakeven_pct != null ? Math.round(p.breakeven_pct * 10) / 10 : null);
    const margins = valid.map(p => p.breakeven_pct != null
        ? Math.round((p.win_rate_pct - p.breakeven_pct) * 10) / 10
        : null);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
                const idx = params[0]?.dataIndex ?? 0;
                const p = valid[idx];
                const margin = margins[idx];
                const be = breakevens[idx];
                const decided = p.winners + p.losers;
                let html = `<b>${p.profile}</b> (${p.timeframe})`
                    + `<br/>Win Rate: <b>${winRates[idx]}%</b> (${p.winners}W/${p.losers}L of ${decided})`;
                if (be != null && margin != null) {
                    const marginColor = margin >= 0 ? '#10b981' : '#ef4444';
                    const marginLabel = margin >= 0 ? 'Above BE' : 'Below BE';
                    html += `<br/>Breakeven: <b>${be}%</b>`
                        + `<br/><span style="color:${marginColor}">${marginLabel}: <b>${Math.abs(margin).toFixed(1)}%</b></span>`;
                } else {
                    html += `<br/>Breakeven: <i>needs wins & losses</i>`;
                }
                if (p.avg_win != null && p.avg_loss != null)
                    html += `<br/>R:R: <b>${(Math.abs(p.avg_win / (p.avg_loss || 1))).toFixed(2)}:1</b>`;
                html += `<br/>P&L: <b>$${p.total_pl.toFixed(2)}</b>`;
                return html;
            },
        },
        legend: {
            data: ['Win Rate', 'Breakeven'],
            textStyle: {color: isDarkMode ? '#9ca3af' : '#374151', fontSize: 11},
            top: 0,
        },
        grid: {
            left: '3%',
            right: '3%',
            bottom: '3%',
            top: '15%',
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: {
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                rotate: labels.length > 8 ? 30 : 0,
                fontSize: 11,
            },
            axisLine: {lineStyle: {color: isDarkMode ? '#374151' : '#d1d5db'}},
        },
        yAxis: {
            type: 'value',
            name: '%',
            min: 0,
            max: 100,
            axisLabel: {
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                formatter: (v: number) => `${v}%`,
            },
            splitLine: {lineStyle: {color: isDarkMode ? '#1e293b' : '#f3f4f6'}},
        },
        series: [
            {
                name: 'Win Rate',
                type: 'bar',
                data: winRates.map((wr, i) => ({
                    value: wr,
                    itemStyle: {color: margins[i] == null ? '#6b7280' : margins[i]! >= 0 ? '#10b981' : '#ef4444'},
                })),
                barMaxWidth: 30,
                z: 1,
            },
            {
                name: 'Breakeven',
                type: 'scatter',
                data: breakevens,
                symbol: 'diamond',
                symbolSize: 12,
                itemStyle: {color: '#f97316', borderColor: isDarkMode ? '#1e293b' : '#fff', borderWidth: 2},
                z: 2,
            },
        ],
    };

    return (
        <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow mb-6 transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Breakeven by Profile
            </h3>
            <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Green = above breakeven, Red = below. Diamond = breakeven WR% needed.
            </p>
            <ReactECharts option={option} style={{height: '280px'}}/>
        </div>
    );
}
