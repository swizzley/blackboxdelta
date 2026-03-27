import type {OptimizerProfileState, OptimizerAllProfilesResponse, ProfileFlat, ProfileStage, SeedRun, LHCRun} from '../../context/Types';

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
    const result: ProfileFlat[] = [];
    for (const [tf, resp] of Object.entries(data)) {
        // Build sets of profile names in active pipeline stages
        const seedingNames = new Set<string>();
        for (const sr of seedRuns) {
            if (sr.timeframe === tf && (sr.status === 'running' || sr.status === 'queued')) {
                if (sr.profile_results) {
                    for (const pr of sr.profile_results) seedingNames.add(pr.profile);
                }
                // Also check profile_stages
                if (sr.profile_stages) {
                    for (const pName of Object.keys(sr.profile_stages)) seedingNames.add(pName);
                }
            }
        }
        const lhcNames = new Set<string>();
        if (lhcRuns) {
            for (const lr of lhcRuns) {
                if (lr.timeframe === tf && (lr.status === 'queued' || lr.status === 'preloading' || lr.status === 'sweeping')) {
                    lhcNames.add(lr.profile_name);
                }
            }
        }
        // For "optimizing" vs "queued", we'd need active generation data.
        // For now, treat all enabled non-seed/non-lhc as "optimizing"
        // since the API stage field handles the distinction when available.
        const optimizingNames = new Set<string>(); // placeholder — API stage is authoritative

        for (const p of resp.profiles) {
            // Map API stage values to new pipeline stages
            let stage: ProfileStage;
            if (p.stage) {
                const apiStage = p.stage as string;
                if (apiStage === 'passed' || apiStage === 'promoted') stage = 'optimizing'; // promoted is legacy, fold into optimizing
                else if (apiStage === 'stalled' || apiStage === 'failed') stage = 'disabled'; // fold into disabled
                else if (['disabled', 'queued', 'seeding', 'optimizing', 'lhc', 'soaking', 'live'].includes(apiStage)) stage = apiStage as ProfileStage;
                else stage = deriveStage(p, seedingNames, lhcNames, optimizingNames);
            } else {
                stage = deriveStage(p, seedingNames, lhcNames, optimizingNames);
            }
            result.push({
                ...p,
                timeframe: tf,
                stage,
            });
        }
    }
    return result;
}

// Search match — name and tags only (not description, too many false positives)
export function matchesSearch(p: ProfileFlat, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) ||
        (p.tags?.some(t => t.toLowerCase().includes(q)) ?? false);
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
