import {useEffect, useState, useCallback} from 'react';

import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import type {AnalysisRunApi, AnalysisRunDetailApi} from '../../context/Types';
import {fetchAnalysisRuns, fetchAnalysisRunDetail} from '../../api/client';
import {PROVIDERS} from './constants';
import RunList from './RunList';
import RunDetail from './RunDetail';
import AdHocPanel from './AdHocPanel';

export default function Analysis() {
    const {isDarkMode} = useTheme();
    const {apiAvailable} = useApi();
    const textMuted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';

    const [allRuns, setAllRuns] = useState<AnalysisRunApi[]>([]);
    const [loading, setLoading] = useState(true);
    const [runDetail, setRunDetail] = useState<AnalysisRunDetailApi | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [compareDetail, setCompareDetail] = useState<AnalysisRunDetailApi | null>(null);

    // Filters
    const [scopeFilter, setScopeFilter] = useState('');
    const [providerFilter, setProviderFilter] = useState('');

    const loadAllRuns = useCallback(() => {
        return Promise.all(PROVIDERS.map(p => fetchAnalysisRuns(p, 100).catch(() => null)))
            .then(results => {
                const merged = results.flatMap((r, i) => (r ?? []).map(run => ({...run, provider: run.provider || PROVIDERS[i]})));
                merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
                setAllRuns(merged);
                return merged;
            });
    }, []);

    const loadRunDetail = useCallback((runId: string) => {
        setLoadingDetail(true);
        setCompareDetail(null);
        fetchAnalysisRunDetail(runId).then(data => {
            setRunDetail(data ?? null);
        }).finally(() => setLoadingDetail(false));
    }, []);

    const loadCompareRun = useCallback((runId: string | null) => {
        if (!runId) {
            setCompareDetail(null);
            return;
        }
        fetchAnalysisRunDetail(runId).then(data => {
            setCompareDetail(data ?? null);
        });
    }, []);

    // Initial load
    useEffect(() => {
        if (!apiAvailable) return;
        setLoading(true);
        loadAllRuns().then(merged => {
            if (merged.length > 0) {
                loadRunDetail(merged[0].run_id);
            }
            setLoading(false);
        });
    }, [apiAvailable, loadAllRuns, loadRunDetail]);

    if (!apiAvailable) {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
                <Nav/>
                <main className="-mt-24 pb-12">
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 pt-8">
                        <p className={`text-center py-20 ${textMuted}`}>Analysis requires VPN connection.</p>
                    </div>
                </main>
                <Foot/>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
                <Nav/>
                <main className="-mt-24 pb-12">
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 pt-8">
                        <p className={`text-center py-20 ${textMuted}`}>Loading analysis data...</p>
                    </div>
                </main>
                <Foot/>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
            <Nav/>
            <main className="-mt-24 pb-16">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 pt-8">

                    {/* Header */}
                    <div className="mb-6">
                        <h1 className={`text-2xl font-bold ${textPrimary}`}>AI Trade Analysis</h1>
                        <p className={`mt-1 text-sm ${textMuted}`}>
                            {allRuns.length} runs
                        </p>
                    </div>

                    {/* Ad-hoc Controls + Hypothesis */}
                    <AdHocPanel onRunComplete={() => {
                        loadAllRuns().then(merged => {
                            if (merged.length > 0) loadRunDetail(merged[0].run_id);
                        });
                    }} />

                    {allRuns.length === 0 ? (
                        <p className={`text-center py-12 ${textMuted}`}>
                            No analysis data. Select a provider and model above and click Run Analysis.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left: Run List */}
                            <RunList
                                runs={allRuns}
                                selectedRunId={runDetail?.run.run_id ?? null}
                                compareRunId={compareDetail?.run.run_id ?? null}
                                onSelectRun={loadRunDetail}
                                onCompareRun={loadCompareRun}
                                scopeFilter={scopeFilter}
                                onScopeFilterChange={setScopeFilter}
                                providerFilter={providerFilter}
                                onProviderFilterChange={setProviderFilter}
                            />

                            {/* Right: Detail */}
                            {loadingDetail && (
                                <div className={`lg:col-span-2 ${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow text-center`}>
                                    <p className={textMuted}>Loading...</p>
                                </div>
                            )}

                            {runDetail && !loadingDetail && (
                                <RunDetail
                                    detail={runDetail}
                                    compareDetail={compareDetail}
                                    onClose={() => { setRunDetail(null); setCompareDetail(null); }}
                                    onExitCompare={() => setCompareDetail(null)}
                                />
                            )}

                            {!runDetail && !loadingDetail && (
                                <div className={`lg:col-span-2 ${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow text-center py-12`}>
                                    <p className={textMuted}>Select a run to view its report and recommendations.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
            <Foot/>
        </div>
    );
}
