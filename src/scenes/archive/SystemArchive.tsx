import {useEffect, useState, type ReactNode} from 'react';
import axios from 'axios';
import Nav from '../common/Nav';
import StatCard from '../common/StatCard';
import {useTheme} from '../../context/Theme';

// Frozen view of the whole system, built from read-only aggregates of the
// production database (scripts/extract-archive.py). Each gated tab opens on
// its own section; the rest of the system follows below it.

type Row = Record<string, string | number | null>;
type Archive = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Focus = 'history' | 'profiles' | 'analysis' | 'system' | 'optimizer' | 'health';

const fmt = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString());
const day = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : '—');
const money = (n: number | null | undefined) => (n == null ? '—' : `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`);

function Section({id, title, blurb, children}: {id: string; title: string; blurb: string; children: ReactNode}) {
    const {isDarkMode} = useTheme();
    return (
        <section id={id} className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow p-5 sm:p-6 mb-6 transition-colors duration-500`}>
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
            <p className={`mt-1 mb-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{blurb}</p>
            {children}
        </section>
    );
}

function Stats({items}: {items: [string, string, string?][]}) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {items.map(([label, value, sub]) => <StatCard key={label} label={label} value={value} subtitle={sub}/>)}
        </div>
    );
}

function Table({rows, cols}: {rows: Row[]; cols: [string, string][]}) {
    const {isDarkMode} = useTheme();
    const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr>{cols.map(([, h]) => <th key={h} className={`text-left font-medium py-1.5 pr-4 ${muted}`}>{h}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} className={isDarkMode ? 'border-t border-slate-700' : 'border-t border-gray-100'}>
                            {cols.map(([k]) => (
                                <td key={k} className={`py-1.5 pr-4 font-mono text-xs ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {typeof r[k] === 'number' ? (r[k] as number).toLocaleString() : (r[k] ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function SystemArchive({focus}: {focus: Focus}) {
    const {isDarkMode} = useTheme();
    const [a, setA] = useState<Archive | null>(null);
    useEffect(() => { axios.get('/data/archive/system.json').then(r => setA(r.data)).catch(console.error); }, []);

    if (!a) return <><Nav/><div className="mx-auto max-w-7xl px-4 py-10 text-gray-500">Loading the archive…</div></>;

    const o = a.optimizer;
    const sections: Record<Focus, ReactNode> = {
        system: (
            <Section id="system" title="The whole system" key="system"
                     blurb={`${a.services.length} services and libraries feeding one MySQL database: ${a.db.tables} tables, about ${a.db.gb} GB and ${fmt(a.db.rows_est)} rows when it was shut down. Prices came in, every candle got ${a.indicators_per_candle} indicators, a scoring engine turned those into alerts, the trader acted on them, and an optimizer kept evolving the strategy profiles.`}>
                <Stats items={[
                    ['Markets', fmt(a.markets), a.timeframes.join(' · ')],
                    ['Indicators per candle', fmt(a.indicators_per_candle), 'on every timeframe'],
                    ['Price history', `${day(a.price_range.first).slice(0, 4)}–${day(a.price_range.last).slice(0, 4)}`, `${day(a.price_range.first)} to ${day(a.price_range.last)}`],
                    ['Database', `${a.db.gb} GB`, `${a.db.tables} tables`],
                ]}/>
                <Table rows={a.tables.slice(0, 15)} cols={[['name', 'Table'], ['rows_est', 'Rows (approx.)'], ['mb', 'MB']]}/>
                <h3 className={`mt-5 mb-2 text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Services at shutdown</h3>
                <Table rows={a.services} cols={[['service', 'Service'], ['sha', 'Commit'], ['updated', 'Last deploy']]}/>
            </Section>
        ),
        history: (
            <Section id="history" title="Every trade it placed" key="history"
                     blurb={`${fmt(a.orders.total)} orders across ${a.orders.symbols} instruments and ${a.orders.profiles} strategy profiles, from ${day(a.orders.first)} to ${day(a.orders.last)}. Net result: ${money(a.orders.net_pl)}. That number is why it's an archive. (The dashboard's figures come from the engine's last published snapshot, so they differ slightly from the database totals here.)`}>
                <Stats items={[
                    ['Orders', fmt(a.orders.total)],
                    ['Net P/L', money(a.orders.net_pl)],
                    ['Wins / losses', `${fmt(a.orders.wins)} / ${fmt(a.orders.losses)}`, `${fmt(a.orders.breakeven)} breakeven`],
                    ['Profiles that traded', fmt(a.orders.profiles)],
                ]}/>
                <div className="grid lg:grid-cols-2 gap-6">
                    <Table rows={a.orders_by_symbol} cols={[['symbol', 'Instrument'], ['n', 'Orders'], ['pl', 'P/L $']]}/>
                    <div>
                        <Table rows={a.orders_by_timeframe} cols={[['tf', 'Timeframe'], ['n', 'Orders'], ['pl', 'P/L $']]}/>
                        <div className="mt-4"><Table rows={a.orders_by_close} cols={[['reason', 'Close reason'], ['n', 'Orders']]}/></div>
                    </div>
                </div>
            </Section>
        ),
        optimizer: (
            <Section id="optimizer" title="The optimizer" key="optimizer"
                     blurb={`A genetic search over strategy parameters, validated out of sample before anything went live. It ran ${fmt(o.generations.n)} generations between ${day(o.generations.first)} and ${day(o.generations.last)}, and most of them failed, which is mostly what optimizers do.`}>
                <Stats items={[
                    ['Generations', fmt(o.generations.n)],
                    ['Branches tested', `~${fmt(o.branches_est)}`],
                    ['Parameter stats', `~${fmt(o.param_stats_est)}`],
                    ['Mutations blacklisted', fmt(o.blacklisted_mutations)],
                ]}/>
                <div className="grid lg:grid-cols-2 gap-6">
                    <Table rows={o.generations_by_status} cols={[['status', 'Generation outcome'], ['n', 'Count']]}/>
                    <Table rows={[
                        {k: 'Seed runs', v: o.seed_runs}, {k: 'Latin-hypercube runs', v: o.lhc_runs},
                        {k: 'Verification queue (approx.)', v: o.verification_queue_est}, {k: 'Surge generations', v: o.surge.generations},
                        {k: 'Surge branches', v: o.surge.branches}, {k: 'Profile mutations', v: o.mutations},
                    ]} cols={[['k', 'Search machinery'], ['v', 'Count']]}/>
                </div>
            </Section>
        ),
        profiles: (
            <Section id="profiles" title="Strategy profiles" key="profiles"
                     blurb={`${fmt(o.profiles.total)} strategy profiles across ${o.profiles.pipelines} pipeline types. Each one is a full set of parameters the optimizer evolved; ${fmt(o.profiles.live)} were promoted to live trading at some point.`}>
                <Stats items={[
                    ['Profiles', fmt(o.profiles.total)],
                    ['Ever promoted live', fmt(o.profiles.live)],
                    ['Enabled at shutdown', fmt(o.profiles.enabled)],
                    ['Pipeline types', fmt(o.profiles.pipelines)],
                ]}/>
                <div className="grid lg:grid-cols-2 gap-6">
                    <Table rows={o.profiles_by_tier} cols={[['tier', 'Tier'], ['n', 'Profiles']]}/>
                    <Table rows={o.profiles_by_timeframe} cols={[['tf', 'Base timeframe'], ['n', 'Profiles']]}/>
                </div>
            </Section>
        ),
        analysis: (
            <Section id="analysis" title="Analysis and alerts" key="analysis"
                     blurb={`The scoring engine combined ${a.score_components.length} component scores into one recommendation per setup, and an LLM analysis engine reviewed batches of trades and wrote up what to fix.`}>
                <Stats items={[
                    ['Alerts', fmt(a.alerts.total), `${a.alerts.strategies} strategies`],
                    ['Scored setups', fmt(a.scores.total)],
                    ['Analysis runs', fmt(a.analysis.runs.n), `${fmt(a.analysis.runs.orders_reviewed)} orders reviewed`],
                    ['Follow-up todos', fmt(a.analysis.todos)],
                ]}/>
                <div className="grid lg:grid-cols-2 gap-6">
                    <Table rows={a.recommendations} cols={[['rec', 'Recommendation'], ['n', 'Setups']]}/>
                    <div>
                        <Table rows={a.analysis.by_model} cols={[['model', 'Analysis model'], ['n', 'Runs']]}/>
                        <p className={`mt-3 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Score components: {a.score_components.join(', ')}</p>
                    </div>
                </div>
                <h3 className={`mt-5 mb-2 text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>News sentiment</h3>
                <Stats items={[
                    ['Articles scored', fmt(a.sentiment.articles.n)],
                    ['News sites', fmt(a.sentiment.sites)],
                    ['Article ↔ pair links', fmt(a.sentiment.pair_links)],
                    ['Since', day(a.sentiment.articles.first)],
                ]}/>
            </Section>
        ),
        health: (
            <Section id="health" title="Health and self-monitoring" key="health"
                     blurb={`Agent Neo watched this system: ${fmt(a.neo.incidents)} incidents raised from ${fmt(a.neo.signals)} signals over ${fmt(a.neo.sweeps)} sweeps. It also kept a code graph of the whole codebase: ${fmt(a.code_graph.nodes.n)} symbols in ${a.code_graph.nodes.modules} modules.`}>
                <Stats items={[
                    ['Incidents', fmt(a.neo.incidents)],
                    ['Monitoring sweeps', fmt(a.neo.sweeps)],
                    ['Code symbols', fmt(a.code_graph.nodes.n)],
                    ['Call-graph edges', fmt(a.code_graph.edges)],
                ]}/>
                <div className="grid lg:grid-cols-3 gap-6">
                    <Table rows={a.neo.by_category} cols={[['category', 'Incident category'], ['n', 'Count']]}/>
                    <Table rows={a.neo.by_severity} cols={[['severity', 'Severity'], ['n', 'Count']]}/>
                    <Table rows={a.code_graph.by_kind} cols={[['kind', 'Symbol kind'], ['n', 'Count']]}/>
                </div>
            </Section>
        ),
    };
    const order: Focus[] = [focus, ...(['system', 'history', 'optimizer', 'profiles', 'analysis', 'health'] as Focus[]).filter(f => f !== focus)];

    return (
        <>
            <Nav/>
            <div className={`min-h-screen pb-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} transition-colors duration-500`}>
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20">
                    <p className={`mb-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        This tab showed live data from the engine. Here's what was behind it, read from the production database as it was left at shutdown (last activity {day(a.orders.last)}).
                    </p>
                    {order.map(f => sections[f])}
                </div>
            </div>
        </>
    );
}
