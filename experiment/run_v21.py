"""第三輪 PDCA：檢驗規範 v2.1 的開發、凍結與盲測。

AI 端完全沿用 v2（同提示、同 36 張分塊、同 3 位模擬評估者、同模型、temperature 1.0）；v2.1 只改
程式端的量測（spec_v21.py）。流程：

  python experiment/run_v21.py golden                 # 用開發集無缺陷良品建立標準晶粒
  python experiment/run_v21.py dev                    # 開發集：v2 已存回覆，v2 量測 vs v2.1 量測（不呼叫 API）
  python experiment/run_v21.py blind-samples          # 凍結後：產生盲測集（種子取自凍結 commit）
  python experiment/run_v21.py run --trials 2         # 盲測集呼叫 API（從快取續跑，有花費上限）
  python experiment/run_v21.py analyze                # 盲測集：v2 量測 vs v2.1 量測 → results/v21-blind.json

開發集 = experiment/samples（舊 40 張，v2.1 依它設計）；盲測集 = experiment/samples_blind（凍結後才產生）。
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

import run_v2
import spec_v1 as v1
import spec_v2 as v2
import spec_v21 as v21
from analyze_msa import defect_recognition, fleiss_kappa, judgment_rates
from run_msa import APPRAISERS

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
RES = HERE / "results"
DEV = HERE / "samples"
BLIND = HERE / "samples_blind"
BLIND_CACHE = RAW / "v21_blind.jsonl"
BLIND_LEDGER = RAW / "v21_blind_cost_ledger.json"
BUDGET_USD = 15.0
LABELS = ["Pass", "Warning", "Fail"]


def load_ref(sample_dir: Path) -> dict:
    return {s["id"]: s for s in json.loads((sample_dir / "reference.json").read_text(encoding="utf-8"))["samples"]}


def load_jsonl(path: Path) -> dict:
    out = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                out[r["key"]] = r
    return out


# ---------------------------------------------------------------- judging
class Judge:
    """Reply text → verdict, with either the v2 (AI box) or the v2.1 (refined) measurement."""

    def __init__(self, sample_dir: Path):
        self.dir = sample_dir
        self.golden = v21.load_golden()
        self.imgs = {}

    def img(self, sample):
        if sample not in self.imgs:
            self.imgs[sample] = np.asarray(Image.open(self.dir / f"{sample}.png").convert("RGB"), dtype=np.float32)
        return self.imgs[sample]

    def v2(self, text):
        return run_v2.judge_reply(text)

    def v21(self, text, sample):
        items = run_v2.parse_reply(text)
        if items is None:
            return {"verdict": v1.WARNING, "defects": [], "reasons": ["AI 回覆無法解析，送人工複判"], "unparseable": True}
        defects = [v21.measure(code, box, self.img(sample), self.golden) for code, box in run_v2.merge(items)]
        r = v21.derive_verdict(defects)
        return {"verdict": r["verdict"], "defects": defects, "reasons": r["reasons"], "unparseable": False}


def metrics(ref: dict, J: dict) -> dict:
    """Same metric definitions as analyze_v2 (trial 1 headline, trial 1 vs 2 repeatability)."""
    ids = sorted(ref)
    trials = [t for t in (1, 2) if all((a, i, t) in J for a in APPRAISERS for i in ids)]
    if 1 not in trials:
        raise SystemExit(f"trial 1 incomplete: {sum((a, i, 1) in J for a in APPRAISERS for i in ids)}/{3 * len(ids)}")
    V = {k: v["verdict"] for k, v in J.items()}
    refv = {i: ref[i]["referenceVerdict"] for i in ids}
    rates = lambda ts: judgment_rates([(refv[i], V[(a, i, t)]) for t in ts for a in APPRAISERS for i in ids])

    def confusion(ts):
        c = {r: {v: 0 for v in LABELS} for r in LABELS}
        for t in ts:
            for a in APPRAISERS:
                for i in ids:
                    c[refv[i]][V[(a, i, t)]] += 1
        return c

    m1 = rates([1])
    m1["betweenAppraisersPerTrial"] = sum(len({V[(a, i, 1)] for a in APPRAISERS}) == 1 for i in ids) / len(ids)
    m1["fleissKappa"] = fleiss_kappa([[sum(V[(a, i, 1)] == c for a in APPRAISERS) for c in LABELS] for i in ids])
    m1["confusion"] = confusion([1])
    m1["unparseable"] = sum(J[(a, i, 1)]["unparseable"] for a in APPRAISERS for i in ids)
    out = {"trialsComplete": trials, "trial1": m1}
    if 2 in trials:
        rep = {a: sum(V[(a, i, 1)] == V[(a, i, 2)] for i in ids) / len(ids) for a in APPRAISERS}
        out["repeatability"] = sum(rep.values()) / len(rep)
        out["repeatabilityByAppraiser"] = rep
        out["pooled"] = {**rates([1, 2]), "confusion": confusion([1, 2])}
    out["missesTrial1"] = sorted(f"{i}/{a}" for a in APPRAISERS for i in ids if refv[i] == "Fail" and V[(a, i, 1)] == "Pass")
    out["falseCallsTrial1"] = sorted(f"{i}/{a}" for a in APPRAISERS for i in ids if refv[i] == "Pass" and V[(a, i, 1)] == "Fail")
    rows = [{"condition": "after", "sample": i, "refDefects": ref[i]["defects"], "aiDefects": J[(a, i, 1)]["defects"]}
            for a in APPRAISERS for i in ids]
    rec = defect_recognition(rows, set(ids))
    out["defectRecognition"] = {c: {k: v for k, v in d.items() if k != "pairs"} for c, d in rec.items()}
    return out


def judge_all(cache: dict, sample_dir: Path, mode: str) -> dict:
    j = Judge(sample_dir)
    J = {}
    for r in cache.values():
        res = j.v2(r["text"]) if mode == "v2" else j.v21(r["text"], r["sample"])
        J[(r["appraiser"], r["sample"], r["trial"])] = {**res, "costUsd": r["costUsd"], "seconds": r.get("seconds")}
    return J


def summary_line(label, m):
    t = m["trial1"]
    pct = lambda x: "—" if x is None else f"{x:.1%}"
    return (f"{label:<14} 一致率 {pct(t['accuracy'])}  漏判 {pct(t['missRate'])}  誤判 {pct(t['falseCallRate'])}  "
            f"複判 {pct(t['warningRate'])}（標準答案 {pct(t['referenceWarningRate'])}）  評估者間 {pct(t['betweenAppraisersPerTrial'])}  "
            f"重複性 {pct(m.get('repeatability'))}")


GATE = {"missRate": ("≤", 0.05), "repeatability": ("≥", 0.90), "warningRate": ("≤", 0.30),
        "betweenAppraisersPerTrial": ("≥", 0.90), "accuracy": ("≥", 0.90), "falseCallRate": ("≤", 0.03)}


def gate_check(m) -> dict:
    out = {}
    for k, (op, th) in GATE.items():
        v = m.get("repeatability") if k == "repeatability" else m["trial1"].get(k)
        out[k] = {"value": v, "target": f"{op} {th:.0%}", "pass": v is not None and (v <= th if op == "≤" else v >= th)}
    return out


# ---------------------------------------------------------------- commands
def cmd_golden(_):
    ref = load_ref(DEV)
    clean = sorted(i for i, s in ref.items() if not s["defects"])
    g = v21.build_golden(DEV, clean)
    v21.save_golden(g)
    print(f"golden die from {len(clean)} clean development samples: {', '.join(clean)} → {v21.GOLDEN_FILE}")


def cmd_dev(args):
    ref = load_ref(DEV)
    cache = run_v2.load_cache()
    out = {"set": "development (experiment/samples, 40)", "replies": len(cache)}
    for band in (False, True):
        v21.USE_BORDER_BAND = band
        J = judge_all(cache, DEV, "v21")
        out[f"v21_band_{'on' if band else 'off'}"] = m = metrics(ref, J)
        m["gate"] = gate_check(m)
        print(summary_line(f"v2.1 band {'on' if band else 'off'}", m))
        print("   誤判:", m["falseCallsTrial1"], " 漏判:", m["missesTrial1"])
    m = metrics(ref, judge_all(cache, DEV, "v2"))
    m["gate"] = gate_check(m)
    out["v2"] = m
    print(summary_line("v2（框量測）", m))
    for mode in ("v2", "v21_band_on"):
        print(mode, {c: (round(d["measBiasUm"], 1) if d["measBiasUm"] is not None else None)
                     for c, d in out[mode]["defectRecognition"].items() if c != "_clean"}, "µm bias")
    if args.write:
        RES.mkdir(exist_ok=True)
        (RES / "v21-dev.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print("wrote results/v21-dev.json")


def cmd_blind_samples(args):
    commit = args.commit or subprocess.check_output(["git", "rev-parse", "spec-v2.1-frozen^{commit}"], cwd=HERE,
                                                    text=True).strip()
    seed = int(commit[:8], 16)
    subprocess.check_call([sys.executable, str(HERE / "generate_samples.py"), "--out", str(BLIND),
                           "--seed", str(seed), "--size-jitter", "0.15", "--frozen-commit", commit], cwd=HERE)


class BlindRunner(run_v2.Runner):
    """run_v2.Runner pointed at the blind set and its own cache."""

    def content(self, sample):
        if sample not in self.tiles:
            img = Image.open(BLIND / f"{sample}.png").convert("RGB")
            import base64
            import io
            out = []
            for _, box, zoom in run_v2.PLAN:
                t = img.crop(box)
                t = t.resize((t.width * zoom, t.height * zoom), Image.NEAREST)
                buf = io.BytesIO()
                t.save(buf, format="PNG", optimize=True)
                out.append(base64.standard_b64encode(buf.getvalue()).decode())
            self.tiles[sample] = out
        return super().content(sample)


def cmd_run(args):
    run_v2.CACHE_FILE = BLIND_CACHE
    run_v2.LEDGER = BLIND_LEDGER
    ref = load_ref(BLIND)
    ids = list(ref) if args.images == "all" else args.images.split(",")
    r = BlindRunner(args.budget)
    jobs = [(a, s, t) for t in range(1, args.trials + 1) for a in APPRAISERS for s in ids]
    todo = [j for j in jobs if run_v2.key_of(*j) not in r.cache]
    t0, n0 = run_v2.spent(r.cache)
    print(f"blind jobs={len(jobs)} todo={len(todo)} spent so far=${t0:.4f} ({n0} calls) budget=${args.budget}", flush=True)
    from concurrent.futures import ThreadPoolExecutor, as_completed
    stats, done = Counter(), 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(r.call, *j) for j in todo]
        for f in as_completed(futs):
            stats[f.result()] += 1
            done += 1
            if done % 10 == 0 or done == len(todo):
                t, n = run_v2.spent(r.cache)
                print(f"  {done}/{len(todo)} total=${t:.4f} calls={n} {dict(stats)}", flush=True)
    print(json.dumps(run_v2.write_ledger(r.cache, args.budget), ensure_ascii=False))
    if r.aborted:
        print("BUDGET GUARD: stopped scheduling new calls; cached results kept.")


def cmd_analyze(_):
    ref = load_ref(BLIND)
    cache = load_jsonl(BLIND_CACHE)
    out = {"set": "blind (experiment/samples_blind, generated after the freeze)",
           "frozenCommit": json.loads((BLIND / "reference.json").read_text(encoding="utf-8")).get("frozenCommit")}
    for mode in ("v21", "v2"):
        J = judge_all(cache, BLIND, mode)
        m = metrics(ref, J)
        m["gate"] = gate_check(m)
        out[mode] = m
        print(summary_line({"v21": "v2.1（凍結）", "v2": "v2 量測（對照）"}[mode], m))
        print("   誤判:", m["falseCallsTrial1"], " 漏判:", m["missesTrial1"])
    costs = [r["costUsd"] for r in cache.values()]
    secs = [r["seconds"] for r in cache.values() if r.get("seconds")]
    out["spendUsd"], out["apiCalls"] = sum(costs), len(costs)
    out["meanSecondsPerCall"] = sum(secs) / len(secs) if secs else None
    out["referenceVerdicts"] = dict(Counter(s["referenceVerdict"] for s in ref.values()))
    (RES / "v21-blind.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"spend ${out['spendUsd']:.2f} over {out['apiCalls']} calls → results/v21-blind.json")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("golden").set_defaults(func=cmd_golden)
    d = sub.add_parser("dev")
    d.add_argument("--write", action="store_true")
    d.set_defaults(func=cmd_dev)
    b = sub.add_parser("blind-samples")
    b.add_argument("--commit", default=None, help="frozen commit hash (default: tag spec-v2.1-frozen)")
    b.set_defaults(func=cmd_blind_samples)
    r = sub.add_parser("run")
    r.add_argument("--images", default="all")
    r.add_argument("--trials", type=int, default=2)
    r.add_argument("--workers", type=int, default=3)
    r.add_argument("--budget", type=float, default=BUDGET_USD)
    r.set_defaults(func=cmd_run)
    sub.add_parser("analyze").set_defaults(func=cmd_analyze)
    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
