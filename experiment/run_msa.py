"""Step 2 — 一致性分析 (Attribute Agreement Analysis) runner.

Before：3 位評估者各依不同「口述標準」直接判定 Pass/Warning/Fail。
After ：3 位評估者依同一份檢驗規範 v1 只回報缺陷清單，判定由 spec_v1.py 推導。

Subcommands
  python experiment/run_msa.py run --images S01,S02 --trials 1     # smoke test
  python experiment/run_msa.py run --trials 2                       # full run (resumes from cache)
  python experiment/run_msa.py cost                                 # spend so far
  (analysis/excel output: python experiment/analyze_msa.py)

Every raw response is appended to experiment/raw/<condition>.jsonl keyed by
(condition, appraiser, sample, trial); cached keys are never re-requested.
A hard budget (default US$5.00, total across ALL runs incl. smoke test) is
enforced before every call using actual `usage` × list price.
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
RAW = HERE / "raw"
SAMPLES = HERE / "samples"
SPEC_MD = REPO / "docs" / "spec" / "inspection-spec-v1.md"

MODEL = "claude-sonnet-4-6"
# claude-sonnet-4-6 list price, USD per 1M tokens (claude-api skill model table, cached 2026-09-25;
# cache write 5-min TTL = 1.25x input, cache read = 0.1x input).
PRICE = {"input": 3.00, "output": 15.00, "cache_write": 3.75, "cache_read": 0.30}
BUDGET_USD = 5.00
DEFAULT_EST_CALL_USD = 0.02  # conservative reservation until real costs are observed

APPRAISERS = ["甲", "乙", "丙"]
CONDITIONS = ["before", "after"]

VERBAL = {
    "甲": "有明顯缺角或任何刮痕就退",
    "乙": "邊緣破損都要注意，看起來怪怪的就標 warning",
    "丙": "不影響功能就放行",
}
PERSONA = {
    "甲": "你是日班檢驗員。",
    "乙": "你是夜班檢驗員。",
    "丙": "你是假日班檢驗員。",
}


# ---------------------------------------------------------------- prompts
# Identical output rule for both conditions (fairness: same room to "look" before answering).
OUTPUT_RULE = (
    "回答格式：可先用最多 100 字簡述你的觀察，接著在最後一行只輸出一個 JSON 物件（不要 markdown），格式為："
)

def before_system(appraiser: str) -> str:
    return (
        "你是封裝廠「晶粒外觀檢查」站的檢驗員。你會看到一張晶粒 (die) 俯視顯微影像，晶粒填滿整個畫面。\n"
        f"主管口頭交代的判定標準是：「{VERBAL[appraiser]}」\n"
        "請依這個標準對這顆晶粒做出判定，判定只能是 pass、warning、fail 其中之一"
        "（warning 代表送人工複判）。\n"
        + OUTPUT_RULE + '{"verdict":"pass|warning|fail"}'
    )


def after_system_cached() -> str:
    spec_text = SPEC_MD.read_text(encoding="utf-8")
    return (
        "你在封裝廠「晶粒外觀檢查」站工作。你會看到一張晶粒 (die) 俯視顯微影像，"
        "請依下列檢驗規範 v1 找出影像中所有可見的外觀缺陷，並量測其尺寸。\n\n"
        "=== 檢驗規範 v1（全文）===\n"
        f"{spec_text}\n"
        "=== 影像判讀補充 ===\n"
        "- 影像為 1000 × 1000 px，左上角為 (0,0)，5 µm/px；晶粒四邊即影像四邊。\n"
        "- 周邊區：距影像邊緣 0–20 px 的灰色帶。Seal ring：距邊緣 20–24 px 的亮色細環（亮線）。"
        "核心區：seal ring 以內。\n"
        "- Pad：核心區內沿四邊排列的淺米色方塊（16 × 16 px，距邊緣 40 px）；pad 中央的小灰點是正常探針痕，不是缺陷。\n"
        "- 電路區塊的規則紋路、細線、矩形色塊是正常圖案，不是缺陷。\n"
        "- 量測請換算成 µm（px × 5）。CHP 量自晶粒邊緣向內的最大深度；SCR／CRK 量全長；CON 量單點直徑。\n"
        "- 即使缺陷小於允收門檻也要回報（由系統決定是否計入）；沒有缺陷就回傳空陣列。\n\n"
        "=== 輸出格式 ===\n"
        "你只負責回報缺陷，不要給判定。" + OUTPUT_RULE +
        '{"defects":[{"code":"CHP|CRK|SCR|CON","zone":"core|peripheral",'
        '"depthUm":<CHP 才填>,"lengthUm":<SCR/CRK 才填>,"diameterUm":<CON 才填>,'
        '"crossesPad":<SCR 才填 true/false>,"touchesSealRing":<CHP 才填 true/false>}]}\n'
        "每個 CON 顆粒各列一筆。"
    )


USER_TEXT = {
    "before": "請判定這顆晶粒。",
    "after": "請回報這顆晶粒的缺陷清單。",
}


# ---------------------------------------------------------------- utils
def load_api_key() -> str:
    env = REPO / ".env.local"
    for line in env.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*ANTHROPIC_API_KEY\s*=\s*(.*)\s*$", line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    raise SystemExit("ANTHROPIC_API_KEY not found in .env.local")


def usage_cost(u: dict) -> float:
    return (
        u.get("input_tokens", 0) * PRICE["input"]
        + u.get("output_tokens", 0) * PRICE["output"]
        + u.get("cache_creation_input_tokens", 0) * PRICE["cache_write"]
        + u.get("cache_read_input_tokens", 0) * PRICE["cache_read"]
    ) / 1e6


def key_of(cond, appraiser, sample, trial):
    return f"{cond}|{appraiser}|{sample}|{trial}"


def load_cache() -> dict:
    cache = {}
    for cond in CONDITIONS:
        p = RAW / f"{cond}.jsonl"
        if p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    rec = json.loads(line)
                    cache[rec["key"]] = rec
    return cache


def pilot_records() -> list[dict]:
    """Calls made with an earlier prompt version (raw/pilot/); not analysed, but they cost money."""
    d = RAW / "pilot"
    out = []
    for p in sorted(d.glob("*.jsonl")) if d.exists() else []:
        out += [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
    return out


_PILOT_COST = None


def spent(cache: dict) -> tuple[float, int]:
    """Total spend across ALL calls ever made for this experiment (pilot + current cache)."""
    global _PILOT_COST
    if _PILOT_COST is None:
        pil = pilot_records()
        _PILOT_COST = (sum(r["costUsd"] for r in pil), len(pil))
    return sum(r["costUsd"] for r in cache.values()) + _PILOT_COST[0], len(cache) + _PILOT_COST[1]


def write_ledger(cache, extra=None):
    total, n = spent(cache)
    led = {"model": MODEL, "priceUsdPerMTok": PRICE, "budgetUsd": BUDGET_USD,
           "totalUsd": round(total, 4), "calls": n,
           "updatedAt": datetime.now(timezone.utc).isoformat()}
    if extra:
        led.update(extra)
    (RAW / "cost_ledger.json").write_text(json.dumps(led, ensure_ascii=False, indent=2), encoding="utf-8")
    return led


def json_objects(text: str) -> list[dict]:
    """All top-level balanced {...} substrings that parse as JSON objects, in order."""
    objs, depth, start, in_str, esc = [], 0, None, False, False
    for i, ch in enumerate(text):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"' and depth > 0:
            in_str = True
        elif ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and depth > 0:
            depth -= 1
            if depth == 0:
                try:
                    o = json.loads(text[start:i + 1])
                    if isinstance(o, dict):
                        objs.append(o)
                except Exception:
                    pass
    return objs


def parse_before(text: str):
    """Final answer = LAST JSON object carrying a valid verdict."""
    for o in reversed(json_objects(text)):
        v = str(o.get("verdict", "")).strip().lower()
        if v in ("pass", "warning", "fail"):
            return v.capitalize()
    return None


def parse_after(text: str):
    """Final answer = LAST JSON object carrying a defects list."""
    for o in reversed(json_objects(text)):
        if isinstance(o.get("defects"), list):
            return o["defects"]
    return None


# ---------------------------------------------------------------- runner
class Runner:
    def __init__(self, budget):
        import anthropic  # local import so `cost` works without the SDK
        self.anthropic = anthropic
        self.client = anthropic.Anthropic(api_key=load_api_key(), max_retries=6, timeout=120)
        self.budget = budget
        self.lock = threading.Lock()
        self.cache = load_cache()
        self.reserved = 0.0
        self.max_seen = max([r["costUsd"] for r in self.cache.values()] or [0.0])
        self.after_sys = after_system_cached()
        self.images = {}
        self.aborted = False

    def image_b64(self, sample):
        if sample not in self.images:
            self.images[sample] = base64.standard_b64encode((SAMPLES / f"{sample}.png").read_bytes()).decode()
        return self.images[sample]

    def est(self):
        return self.max_seen * 1.2 if self.max_seen > 0 else DEFAULT_EST_CALL_USD

    def try_reserve(self):
        with self.lock:
            total, _ = spent(self.cache)
            e = self.est()
            if total + self.reserved + e > self.budget:
                self.aborted = True
                return None
            self.reserved += e
            return e

    def call(self, cond, appraiser, sample, trial):
        k = key_of(cond, appraiser, sample, trial)
        if k in self.cache:
            return "cached"
        res = self.try_reserve()
        if res is None:
            return "budget"
        try:
            if cond == "before":
                system = [{"type": "text", "text": before_system(appraiser)}]
                max_tokens = 600
            else:
                system = [
                    {"type": "text", "text": self.after_sys, "cache_control": {"type": "ephemeral"}},
                    {"type": "text", "text": PERSONA[appraiser]},
                ]
                max_tokens = 600
            for attempt in range(4):
                try:
                    msg = self.client.messages.create(
                        model=MODEL, max_tokens=max_tokens, system=system,
                        # SDK 1.x dropped the kwarg; Sonnet 4.6 still accepts it (1.0 = API default)
                        extra_body={"temperature": 1.0},
                        messages=[{"role": "user", "content": [
                            {"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                                         "data": self.image_b64(sample)}},
                            {"type": "text", "text": USER_TEXT[cond]},
                        ]}],
                    )
                    break
                except (self.anthropic.RateLimitError, self.anthropic.InternalServerError,
                        self.anthropic.APIConnectionError) as e:
                    wait = 10 * (attempt + 1)
                    print(f"  retry {k} after {type(e).__name__}, sleeping {wait}s", flush=True)
                    time.sleep(wait)
            else:
                return "error"
            text = "".join(b.text for b in msg.content if b.type == "text")
            u = msg.usage
            usage = {
                "input_tokens": u.input_tokens, "output_tokens": u.output_tokens,
                "cache_creation_input_tokens": u.cache_creation_input_tokens or 0,
                "cache_read_input_tokens": u.cache_read_input_tokens or 0,
            }
            cost = usage_cost(usage)
            rec = {"key": k, "condition": cond, "appraiser": appraiser, "sample": sample, "trial": trial,
                   "model": msg.model, "stopReason": msg.stop_reason, "text": text, "usage": usage,
                   "costUsd": cost, "at": datetime.now(timezone.utc).isoformat()}
            with self.lock:
                with open(RAW / f"{cond}.jsonl", "a", encoding="utf-8") as f:
                    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                self.cache[k] = rec
                self.max_seen = max(self.max_seen, cost)
            return "ok"
        except self.anthropic.APIStatusError as e:
            print(f"  API error {k}: {e.status_code}", flush=True)
            return "error"
        finally:
            with self.lock:
                self.reserved -= res


def cmd_run(args):
    RAW.mkdir(parents=True, exist_ok=True)
    ref = json.loads((SAMPLES / "reference.json").read_text(encoding="utf-8"))
    all_ids = [s["id"] for s in ref["samples"]]
    ids = all_ids if args.images in (None, "all") else args.images.split(",")
    r = Runner(args.budget)
    conds = args.conditions.split(",")
    jobs = [(c, a, s, t) for t in range(1, args.trials + 1) for c in conds for a in APPRAISERS for s in ids]
    todo = [j for j in jobs if key_of(*j) not in r.cache]
    total0, n0 = spent(r.cache)
    print(f"jobs={len(jobs)} cached={len(jobs) - len(todo)} todo={len(todo)} spent_so_far=${total0:.4f} ({n0} calls)")
    stats = {}
    with ThreadPoolExecutor(max_workers=min(4, args.workers)) as ex:
        futs = {ex.submit(r.call, *j): j for j in todo}
        done = 0
        for f in as_completed(futs):
            st = f.result()
            stats[st] = stats.get(st, 0) + 1
            done += 1
            if done % 20 == 0 or done == len(todo):
                t, n = spent(r.cache)
                print(f"  {done}/{len(todo)} total=${t:.4f} calls={n} {stats}", flush=True)
    led = write_ledger(r.cache)
    print(json.dumps(led, ensure_ascii=False))
    if r.aborted:
        print("BUDGET GUARD: stopped scheduling new calls; cached results kept.")
    # per-call cost summary
    for c in CONDITIONS:
        cs = [x["costUsd"] for x in r.cache.values() if x["condition"] == c]
        if cs:
            print(f"{c}: n={len(cs)} mean=${sum(cs) / len(cs):.5f} max=${max(cs):.5f}")


def cmd_cost(_):
    cache = load_cache()
    print(json.dumps(write_ledger(cache), ensure_ascii=False, indent=2))
    for c in CONDITIONS:
        rs = [x for x in cache.values() if x["condition"] == c]
        if rs:
            cs = [x["costUsd"] for x in rs]
            agg = {k: sum(x["usage"][k] for x in rs) for k in rs[0]["usage"]}
            print(c, len(rs), f"mean=${sum(cs) / len(cs):.5f}", agg)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("run")
    p.add_argument("--images", default="all", help="comma list of sample ids, or 'all'")
    p.add_argument("--trials", type=int, default=2)
    p.add_argument("--conditions", default="before,after")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--budget", type=float, default=BUDGET_USD)
    p.set_defaults(fn=cmd_run)
    sub.add_parser("cost").set_defaults(fn=cmd_cost)
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args.fn(args)


if __name__ == "__main__":
    main()
