import type {OptimizerProfileState, OptimizerProfileStats, OptimizerAllProfilesResponse, ProfileFlat, ProfileStage, SeedRun, LHCRun} from '../../context/Types';

export function deriveStage(p: OptimizerProfileState, seedingProfiles: Set<string>, lhcProfiles: Set<string>, optimizingProfiles: Set<string>): ProfileStage {
    if (p.live && p.soaking) return 'soaking';
    if (p.live) return 'live';
    if (!p.enabled) return 'disabled';
    if (seedingProfiles.has(p.name)) return 'seeding';
    if (lhcProfiles.has(p.name)) return 'lhc';
    if (optimizingProfiles.has(p.name)) return 'optimizing';
    return 'queued';
}

export function flattenProfiles(
    data: OptimizerAllProfilesResponse,
    seedRuns: SeedRun[],
    lhcRuns?: LHCRun[],
): ProfileFlat[] {
    // Build global sets of profile names in active pipeline stages
    const seedingNames = new Set<string>();
    for (const sr of seedRuns) {
        if (sr.status === 'running' || sr.status === 'queued') {
            if (sr.profile_results) {
                for (const pr of sr.profile_results) seedingNames.add(pr.profile);
            }
            if (sr.profile_stages) {
                for (const pName of Object.keys(sr.profile_stages)) seedingNames.add(pName);
            }
        }
    }
    const lhcNames = new Set<string>();
    if (lhcRuns) {
        for (const lr of lhcRuns) {
            if (lr.status === 'queued' || lr.status === 'preloading' || lr.status === 'sweeping') {
                lhcNames.add(lr.profile_name);
            }
        }
    }
    const optimizingNames = new Set<string>(); // placeholder — API stage is authoritative

    // Flat response: data.profiles is already the full list with timeframe on each profile
    return (data.profiles ?? []).map(p => {
        let stage: ProfileStage;
        if (p.stage) {
            const apiStage = p.stage as string;
            if (apiStage === 'passed' || apiStage === 'promoted') stage = 'optimizing';
            else if (apiStage === 'stalled' || apiStage === 'failed') stage = 'disabled';
            else if (['disabled', 'queued', 'seeding', 'optimizing', 'lhc', 'soaking', 'live'].includes(apiStage)) stage = apiStage as ProfileStage;
            else stage = deriveStage(p, seedingNames, lhcNames, optimizingNames);
        } else {
            stage = deriveStage(p, seedingNames, lhcNames, optimizingNames);
        }
        return { ...p, stage };
    });
}

// Search match — name and tags only (not description, too many false positives)
export function matchesSearch(p: ProfileFlat, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) ||
        (p.tags?.some(t => t.toLowerCase().includes(q)) ?? false);
}

// Gold profile detection — matches backend CompositeScore logic
export function isGoldProfile(stats?: OptimizerProfileStats): boolean {
    if (!stats) return false;
    return stats.silence_ratio === 0 && stats.total_pnl > 0 && stats.total_trades >= 3;
}

// Pipeline stages in order
export const STAGE_ORDER: ProfileStage[] = ['disabled', 'queued', 'seeding', 'optimizing', 'lhc', 'soaking', 'live'];

export const STAGE_LABELS: Record<ProfileStage, string> = {
    disabled: 'Disabled', queued: 'Queued', seeding: 'Seeding', optimizing: 'Optimizing',
    lhc: 'LHC', soaking: 'Soaking', live: 'Live',
};

export const STAGE_COLORS: Record<ProfileStage, {bg: string; text: string; darkBg: string; darkText: string; dot: string}> = {
    disabled:   {bg: 'bg-gray-200',    text: 'text-gray-500',    darkBg: 'bg-slate-700/50',   darkText: 'text-gray-500',    dot: 'bg-gray-500'},
    queued:     {bg: 'bg-slate-100',   text: 'text-slate-600',   darkBg: 'bg-slate-600/30',   darkText: 'text-slate-400',   dot: 'bg-slate-400'},
    seeding:    {bg: 'bg-cyan-100',    text: 'text-cyan-700',    darkBg: 'bg-cyan-900/30',    darkText: 'text-cyan-400',    dot: 'bg-cyan-500'},
    optimizing: {bg: 'bg-blue-100',    text: 'text-blue-700',    darkBg: 'bg-blue-900/30',    darkText: 'text-blue-400',    dot: 'bg-blue-500'},
    lhc:        {bg: 'bg-violet-100',  text: 'text-violet-700',  darkBg: 'bg-violet-900/30',  darkText: 'text-violet-400',  dot: 'bg-violet-500'},
    soaking:    {bg: 'bg-amber-100',   text: 'text-amber-700',   darkBg: 'bg-amber-900/30',   darkText: 'text-amber-400',  dot: 'bg-amber-500'},
    live:       {bg: 'bg-green-100',   text: 'text-green-700',   darkBg: 'bg-green-900/30',   darkText: 'text-green-400',   dot: 'bg-green-500'},
};
