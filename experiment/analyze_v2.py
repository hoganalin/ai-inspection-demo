"""第二輪（檢驗規範 v2）一致性分析計算，與第一輪「改善後（v1）」用同一套指標定義。

讀 raw/v2.jsonl（run_v2.py 寫入），每筆回覆經 run_v2.judge_reply 換算尺寸、推導判定，輸出
results/v2-metrics.json。主要指標用第 1 次判定（每條件 120 筆，與第一輪相同）；重複性用第 1、2 次
配對；兩次合計另列。標準答案沿用 samples/reference.json（實際該放行／送複判／退件的判定）。

Usage: python experiment/analyze_v2.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from analyze_msa import defect_recognition, fleiss_kappa, judgment_rates
from run_msa import APPRAISERS
from run_v2 import judge_reply, load_cache

HERE = Path(__file__).resolve().parent
RES = HERE / "results"
LABELS = ["Pass", "Warning", "Fail"]


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ref = {s["id"]: s for s in json.loads((HERE / "samples" / "reference.json").read_text(encoding="utf-8"))["samples"]}
    cache = load_cache()
    J = {}  # (appraiser, sample, trial) -> judged
    for r in cache.values():
        J[(r["appraiser"], r["sample"], r["trial"])] = {**judge_reply(r["text"]), "costUsd": r["costUsd"],
                                                       "seconds": r.get("seconds")}
    ids = sorted(ref)
    complete = all((a, i, 1) in J for a in APPRAISERS for i in ids)
    if not complete:
        raise SystemExit(f"trial 1 incomplete: {sum((a, i, 1) in J for a in APPRAISERS for i in ids)}/120")
    trials = [t for t in (1, 2) if all((a, i, t) in J for a in APPRAISERS for i in ids)]
    V = {k: v["verdict"] for k, v in J.items()}
    refv = {i: ref[i]["referenceVerdict"] for i in ids}

    def rates(ts):
        return judgment_rates([(refv[i], V[(a, i, t)]) for t in ts for a in APPRAISERS for i in ids])

    def confusion(ts):
        c = {r: {v: 0 for v in LABELS} for r in LABELS}
        for t in ts:
            for a in APPRAISERS:
                for i in ids:
                    c[refv[i]][V[(a, i, t)]] += 1
        return c

    m1 = rates([1])
    m1["betweenAppraisersPerTrial"] = sum(len({V[(a, i, 1)] for a in APPRAISERS}) == 1 for i in ids) / len(ids)
    m1["allVsStandard"] = sum(all(V[(a, i, 1)] == refv[i] for a in APPRAISERS) for i in ids) / len(ids)
    m1["fleissKappa"] = fleiss_kappa([[sum(V[(a, i, 1)] == c for a in APPRAISERS) for c in LABELS] for i in ids])
    m1["confusion"] = confusion([1])
    m1["unparseable"] = sum(J[(a, i, 1)]["unparseable"] for a in APPRAISERS for i in ids)
    out = {"specVersion": "v2", "trialsComplete": trials, "trial1": m1}
    if 2 in trials:
        rep ={a: sum(V[(a, i, 1)] == V[(a, i, 2)] for i in ids) / len(ids) for a in APPRAISERS}
        out["repeatability"] = sum(rep.values()) / len(rep)
        out["repeatabilityN"] = len(APPRAISERS) * len(ids)
        out["repeatabilityByAppraiser"] = rep
        out["trial2"] = rates([2])
        out["pooled"] = {**rates([1, 2]), "confusion": confusion([1, 2])}
        # why do the two trials disagree?
        why = Counter()
        for a in APPRAISERS:
            for i in ids:
                d1, d2 = J[(a, i, 1)], J[(a, i, 2)]
                if d1["verdict"] == d2["verdict"]:
                    continue
                c1 = sorted(d["code"] for d in d1["defects"])
                c2 = sorted(d["code"] for d in d2["defects"])
                z1 = sorted((d["code"], d["zone"]) for d in d1["defects"])
                z2 = sorted((d["code"], d["zone"]) for d in d2["defects"])
                why["detect" if c1 != c2 else "zone" if z1 != z2 else "measure"] += 1
        out["repeatabilityDisagreements"] = dict(why)
    # per-appraiser
    out["byAppraiser"] = {a: judgment_rates([(refv[i], V[(a, i, 1)]) for i in ids]) for a in APPRAISERS}
    # misses on trial 1, by sample
    out["missesTrial1"] = sorted(f"{i}/{a}" for a in APPRAISERS for i in ids if refv[i] == "Fail" and V[(a, i, 1)] == "Pass")
    out["falseCallsTrial1"] = sorted(f"{i}/{a}" for a in APPRAISERS for i in ids if refv[i] == "Pass" and V[(a, i, 1)] == "Fail")
    # defect recognition (trial 1), same matcher as round 1
    rows = [{"condition": "after", "sample": i, "refDefects": ref[i]["defects"], "aiDefects": J[(a, i, 1)]["defects"]}
            for a in APPRAISERS for i in ids]
    rec = defect_recognition(rows, set(ids))
    out["defectRecognition"] = {c: {k: v for k, v in d.items() if k != "pairs"} for c, d in rec.items()}
    costs = [v["costUsd"] for v in J.values()]
    secs = [v["seconds"] for v in J.values() if v.get("seconds")]
    out["spendUsd"] = sum(costs)
    out["apiCalls"] = len(costs)
    out["meanSecondsPerCall"] = sum(secs) / len(secs) if secs else None
    out["judgments"] = [{"appraiser": a, "sample": i, "trial": t, "verdict": V[(a, i, t)],
                         "defects": J[(a, i, t)]["defects"]} for (a, i, t) in sorted(J)]
    (RES / "v2-metrics.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    v1 = json.loads((RES / "msa-metrics.json").read_text(encoding="utf-8"))["metrics"]["after"]
    pct = lambda x: "—" if x is None else f"{x:.1%}"
    print("指標（第 1 次判定，各 120 筆）      v1 → v2")
    for label, key in (("對標準答案一致率", "accuracy"), ("漏判率", "missRate"), ("誤判率", "falseCallRate"),
                       ("人工複判率", "warningRate"), ("評估者間一致率", "betweenAppraisersPerTrial")):
        print(f"  {label:<14} {pct(v1.get(key))} → {pct(m1.get(key))}")
    print(f"  Fleiss' kappa      {v1['fleissKappa']:.2f} → {m1['fleissKappa']:.2f}")
    if "repeatability" in out:
        print(f"  重複性             {pct(v1['repeatability'])} → {pct(out['repeatability'])}  不一致原因 {out['repeatabilityDisagreements']}")
        p = out["pooled"]
        print(f"  兩次合計：一致率 {pct(p['accuracy'])} 漏判 {pct(p['missRate'])} 誤判 {pct(p['falseCallRate'])} 複判 {pct(p['warningRate'])}")
    print("  confusion trial1:", m1["confusion"])
    print("  misses:", out["missesTrial1"])
    print("  false calls:", out["falseCallsTrial1"])
    for c in ("CHP", "CRK", "SCR", "CON"):
        d = out["defectRecognition"][c]
        print(f"  {c}: recall {pct(d['recall'])} (relevant {pct(d['recallRelevant'])}) precision {pct(d['precision'])}"
              f" bias {d['measBiasUm'] if d['measBiasUm'] is None else round(d['measBiasUm'], 1)} µm rel {pct(d['measRelBias'])}")
    print(f"  spend ${out['spendUsd']:.2f} over {out['apiCalls']} calls; unparseable {m1['unparseable']}")


if __name__ == "__main__":
    main()
