#!/usr/bin/env python3
"""Build public/data/archive/system.json from the forex MySQL on beast.

Read-only aggregates only: counts, ranges, and distributions. No settings,
devices, accounts, URLs, article text, or commit messages leave the database.
Run: python3 scripts/extract-archive.py
"""
import json, subprocess, datetime, os, re

SKIP = {"trader_settings", "scoring_settings", "trusted_devices", "pending_devices",
        "accounts", "backtest_settings", "close_requests"}

def q(sql):
    # SQL goes over stdin so the remote shell never parses it.
    out = subprocess.run(["ssh", "-o", "BatchMode=yes", "beast", "sudo -n mysql forex -B"],
                         input=sql, capture_output=True, text=True, check=True).stdout
    lines = [l.split("\t") for l in out.strip().split("\n") if l]
    if not lines: return []
    head, rows = lines[0], lines[1:]
    def conv(v):
        # Only plain decimals become numbers; a commit SHA like "3e1234ab" stays a string.
        if v == "NULL": return None
        if re.fullmatch(r"-?\d+", v): return int(v)
        if re.fullmatch(r"-?\d+\.\d+", v): return float(v)
        return v
    return [dict(zip(head, map(conv, r))) for r in rows]

def one(sql): r = q(sql); return r[0] if r else {}

out = {"snapshot": datetime.date.today().isoformat()}

tables = q("SELECT table_name AS name, table_rows AS rows_est, ROUND((data_length+index_length)/1024/1024) AS mb "
           "FROM information_schema.tables WHERE table_schema='forex' ORDER BY (data_length+index_length) DESC")
out["tables"] = [t for t in tables if t["name"] not in SKIP]
out["db"] = {"tables": len(tables), "gb": round(sum(t["mb"] or 0 for t in tables) / 1024),
             "rows_est": sum(t["rows_est"] or 0 for t in tables)}

out["indicators_per_candle"] = one("SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema='forex' "
                                   "AND table_name='signals_1m' AND column_name NOT IN ('Symbol','T','Date')")["n"]
out["markets"] = one("SELECT COUNT(DISTINCT Symbol) n FROM signals_4h")["n"]
out["timeframes"] = [t["name"].split("_")[1] for t in tables if t["name"].startswith("prices_")]
out["price_range"] = one("SELECT MIN(Date) first, MAX(Date) last FROM prices_4h")

out["orders"] = one("SELECT COUNT(*) total, ROUND(SUM(Profit),2) net_pl, SUM(Profit>0) wins, SUM(Profit<0) losses, "
                    "SUM(Profit=0 OR Profit IS NULL) breakeven, MIN(Created) first, MAX(Created) last, "
                    "COUNT(DISTINCT Symbol) symbols, COUNT(DISTINCT Profile) profiles FROM orders")
out["orders_by_timeframe"] = q("SELECT Timeframe tf, COUNT(*) n, ROUND(SUM(Profit),2) pl FROM orders GROUP BY Timeframe ORDER BY n DESC")
out["orders_by_close"] = q("SELECT COALESCE(NULLIF(CloseReason,''),'(no close reason)') reason, COUNT(*) n FROM orders GROUP BY CloseReason ORDER BY n DESC LIMIT 8")
out["orders_by_symbol"] = q("SELECT Symbol symbol, COUNT(*) n, ROUND(SUM(Profit),2) pl FROM orders GROUP BY Symbol ORDER BY n DESC LIMIT 12")

out["alerts"] = one("SELECT COUNT(*) total, COUNT(DISTINCT Strategy) strategies, MIN(NULLIF(Date, '1970-01-01 00:00:00')) first, MAX(Date) last FROM alerts WHERE Date > '2000-01-01'")
out["alerts_by_timeframe"] = q("SELECT Timeframe tf, COUNT(*) n FROM alerts GROUP BY Timeframe ORDER BY n DESC")
out["scores"] = one("SELECT COUNT(*) total, ROUND(AVG(FinalScore),3) avg_final, ROUND(AVG(Confidence),3) avg_conf FROM scores")
out["score_components"] = [c["col"] for c in q("SELECT column_name AS col FROM information_schema.columns WHERE table_schema='forex' "
                           "AND table_name='scores' AND column_name LIKE '%Score' AND column_name<>'FinalScore' ORDER BY ordinal_position")]
out["recommendations"] = q("SELECT COALESCE(Recommendation,'(none)') rec, COUNT(*) n FROM scores GROUP BY Recommendation ORDER BY n DESC")

out["optimizer"] = {
    "generations": one("SELECT COUNT(*) n, MIN(started_at) first, MAX(started_at) last FROM optimize_generations"),
    "generations_by_status": q("SELECT COALESCE(status,'(none)') status, COUNT(*) n FROM optimize_generations GROUP BY status ORDER BY n DESC"),
    "branches_est": next(t["rows_est"] for t in tables if t["name"] == "optimize_branches"),
    "param_stats_est": next(t["rows_est"] for t in tables if t["name"] == "optimize_param_stats"),
    "verification_queue_est": next(t["rows_est"] for t in tables if t["name"] == "optimize_verification_queue"),
    "profiles": one("SELECT COUNT(*) total, SUM(enabled) enabled, SUM(is_live) live, COUNT(DISTINCT pipeline_type) pipelines FROM optimize_profiles"),
    "profiles_by_tier": q("SELECT COALESCE(tier,'(none)') tier, COUNT(*) n FROM optimize_profiles GROUP BY tier ORDER BY n DESC"),
    "profiles_by_timeframe": q("SELECT COALESCE(base_timeframe,'(none)') tf, COUNT(*) n FROM optimize_profiles GROUP BY base_timeframe ORDER BY n DESC"),
    "mutations": one("SELECT COUNT(*) n FROM optimize_profile_mutations")["n"],
    "blacklisted_mutations": one("SELECT COUNT(*) n FROM optimize_mutation_blacklist")["n"],
    "seed_runs": one("SELECT COUNT(*) n FROM optimize_seed_runs")["n"],
    "lhc_runs": one("SELECT COUNT(*) n FROM optimize_lhc_runs")["n"],
    "surge": one("SELECT (SELECT COUNT(*) FROM surge_generations) generations, (SELECT COUNT(*) FROM surge_branches) branches, "
                 "(SELECT COUNT(*) FROM surge_mutations) mutations"),
}
out["sentiment"] = {
    "articles": one("SELECT COUNT(*) n, MIN(published_at) first, MAX(published_at) last, SUM(llm_used) llm_scored FROM sentdex_articles"),
    "sites": one("SELECT COUNT(*) n FROM sentdex_sites")["n"],
    "by_method": q("SELECT COALESCE(score_method,'(none)') method, COUNT(*) n FROM sentdex_articles GROUP BY score_method ORDER BY n DESC"),
    "pair_links": one("SELECT COUNT(*) n FROM sentdex_article_pairs")["n"],
}
out["analysis"] = {
    "runs": one("SELECT COUNT(*) n, SUM(order_count) orders_reviewed, MIN(created_at) first, MAX(created_at) last FROM analysis_runs"),
    "by_model": q("SELECT CONCAT(provider,' / ',model) model, COUNT(*) n FROM analysis_runs GROUP BY provider, model ORDER BY n DESC LIMIT 8"),
    "todos": one("SELECT COUNT(*) n FROM analysis_todos")["n"],
    "phases": one("SELECT COUNT(*) n FROM analysis_phases")["n"],
}
out["neo"] = {
    "incidents": one("SELECT COUNT(*) n FROM neo_incidents")["n"],
    "by_status": q("SELECT COALESCE(status,'(none)') status, COUNT(*) n FROM neo_incidents GROUP BY status ORDER BY n DESC"),
    "by_severity": q("SELECT COALESCE(severity,'(none)') severity, COUNT(*) n FROM neo_incidents GROUP BY severity ORDER BY n DESC"),
    "by_category": q("SELECT COALESCE(category,'(none)') category, COUNT(*) n FROM neo_incidents GROUP BY category ORDER BY n DESC LIMIT 8"),
    "sweeps": one("SELECT COUNT(*) n FROM neo_sweeps")["n"],
    "signals": one("SELECT COUNT(*) n FROM neo_signals")["n"],
    "patterns": one("SELECT COUNT(*) n FROM neo_patterns")["n"],
}
out["code_graph"] = {
    "nodes": one("SELECT COUNT(*) n, COUNT(DISTINCT submodule) modules FROM code_nodes"),
    "by_kind": q("SELECT kind, COUNT(*) n FROM code_nodes GROUP BY kind ORDER BY n DESC"),
    "edges": one("SELECT COUNT(*) n FROM code_edges")["n"],
}
out["services"] = q("SELECT service, LEFT(sha,8) sha, DATE(updated_at) updated FROM service_versions ORDER BY service")

os.makedirs("public/data/archive", exist_ok=True)
json.dump(out, open("public/data/archive/system.json", "w"), indent=1, default=str, allow_nan=False)
print("wrote public/data/archive/system.json")
