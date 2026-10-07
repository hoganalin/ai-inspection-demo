"""第二輪一致性分析 runner：檢驗規範 v2（分塊放大判讀＋框選換算尺寸＋安全路由）。

與第一輪「改善後」相同：同 40 張樣本、同 3 位模擬評估者（只差一行角色）、同模型、temperature 1.0、
每組 2 次判定。差別只在規範：每顆晶粒改送 36 張放大圖（四邊各 8 段 ×4、核心 4 象限 ×2），
AI 只回報缺陷代碼與在該張影像上的框選範圍；尺寸、區域、是否經過 pad 由 spec_v2.py 換算，
判定依 spec_v2.derive_verdict 推導。

  python experiment/run_v2.py run --images S25,S38,S16 --appraisers 甲 --trials 1   # 前導測試
  python experiment/run_v2.py run --trials 2                                        # 正式（從快取續跑）
  python experiment/run_v2.py cost

原始回覆寫入 raw/v2.jsonl（以 v2|評估者|樣本|次 為鍵，已有的不會重打）；花費上限只算第二輪
（預設 US$12，每次呼叫前依實際 usage × 牌價檢查）。
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

import spec_v1 as v1
import spec_v2 as v2
from run_msa import APPRAISERS, MODEL, PERSONA, PRICE, json_objects, load_api_key, usage_cost

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
SAMPLES = HERE / "samples"
CACHE_FILE = RAW / "v2.jsonl"
LEDGER = RAW / "v2_cost_ledger.json"
BUDGET_USD = 12.0
BAND = 60  # periphery band depth (px): edge 0–20, seal ring 20–24, pads 40–56
SEG = 125  # 8 segments per side
N = v1.DIE_PX


def tile_plan():
    """[(label, crop box (x0,y0,x1,y1), zoom)] in the order the AI sees them (images 1–36)."""
    plan = []
    for k in range(8):
        plan.append((f"上緣帶第 {k + 1} 段（晶粒 x {SEG * k}–{SEG * (k + 1)} px，y 0–{BAND} px；影像上邊＝晶粒外緣）",
                     (SEG * k, 0, SEG * (k + 1), BAND), 4))
    for k in range(8):
        plan.append((f"右緣帶第 {k + 1} 段（晶粒 y {SEG * k}–{SEG * (k + 1)} px，x {N - BAND}–{N} px；影像右邊＝晶粒外緣）",
                     (N - BAND, SEG * k, N, SEG * (k + 1)), 4))
    for k in range(8):
        plan.append((f"下緣帶第 {k + 1} 段（晶粒 x {SEG * k}–{SEG * (k + 1)} px，y {N - BAND}–{N} px；影像下邊＝晶粒外緣）",
                     (SEG * k, N - BAND, SEG * (k + 1), N), 4))
    for k in range(8):
        plan.append((f"左緣帶第 {k + 1} 段（晶粒 y {SEG * k}–{SEG * (k + 1)} px，x 0–{BAND} px；影像左邊＝晶粒外緣）",
                     (0, SEG * k, BAND, SEG * (k + 1)), 4))
    for name, box in (("左上", (0, 0, 500, 500)), ("右上", (500, 0, 1000, 500)),
                      ("左下", (0, 500, 500, 1000)), ("右下", (500, 500, 1000, 1000))):
        plan.append((f"{name}象限（晶粒 x {box[0]}–{box[2]}、y {box[1]}–{box[3]} px，放大 2 倍）", box, 2))
    return plan


PLAN = tile_plan()


def tiles_b64(sample: str) -> list[str]:
    img = Image.open(SAMPLES / f"{sample}.png").convert("RGB")
    out = []
    for _, box, zoom in PLAN:
        t = img.crop(box)
        t = t.resize((t.width * zoom, t.height * zoom), Image.NEAREST)
        buf = io.BytesIO()
        t.save(buf, format="PNG", optimize=True)
        out.append(base64.standard_b64encode(buf.getvalue()).decode())
    return out


SYSTEM = (
    "你在封裝廠「晶粒外觀檢查」站工作，依檢驗規範 v2 判讀。你會收到同一顆晶粒的 36 張放大影像：\n"
    "- 影像 1–8：上緣帶（晶粒最上方 60 px 高的長條，由左到右每段 125 px，放大 4 倍，每張 500×240）\n"
    "- 影像 9–16：右緣帶（由上到下，每張 240×500）\n"
    "- 影像 17–24：下緣帶（由左到右，每張 500×240）\n"
    "- 影像 25–32：左緣帶（由上到下，每張 240×500）\n"
    "- 影像 33–36：核心區四個象限（左上、右上、左下、右下），每張是晶粒的四分之一，放大 2 倍成 1000×1000\n"
    "每張影像前都有一行文字說明它是哪一段。邊緣帶影像中，晶粒外緣在說明寫的那一邊；"
    "由外緣往內依序是：周邊區（原尺寸 0–20 px）、seal ring 亮色細環（20–24 px）、核心區，"
    "核心區靠外緣處有一排淺米色方塊 pad。\n\n"
    "=== 要找的缺陷 ===\n"
    "- CHP 崩角：晶粒邊緣被咬掉的缺口，缺口內是黑色或深色，邊緣可能有一道淡亮的破裂紋。只會出現在晶粒外緣。\n"
    "- CRK 裂紋：細而曲折、顏色很深的線，常帶分岔或轉折；比刮傷更黑、更彎。\n"
    "- SCR 刮傷：平順的淡白／淺灰色細線，直線或微弧，可能劃過 pad。\n"
    "- CON 污染：米白、淺灰或棕色的小圓點或不規則顆粒，常帶一點陰影；每一顆各列一筆。\n"
    "=== 不是缺陷 ===\n"
    "電路區塊的規則紋路、平行細線、矩形色塊；pad 本身及 pad 中央的小灰點（探針痕）；seal ring 亮線；pad 引出的導線。\n\n"
    "=== 你只做一件事 ===\n"
    "找出所有可見缺陷，回報缺陷代碼，以及缺陷在「你看到它的那張影像」上的框選範圍 box = [x0, y0, x1, y1]"
    "（該張影像的像素座標，左上角為 0,0）。框要緊貼缺陷：崩角框住整個缺口，線狀缺陷框住整條線的兩端，污染框住整顆。\n"
    "不要量尺寸、不要判斷區域、不要給判定：尺寸、區域、是否經過 pad 都由系統依框選範圍換算，判定由規則推導。\n"
    "同一個缺陷若在多張影像都看得到，都可以回報，系統會合併；即使缺陷很小也要回報。沒有缺陷就回傳空陣列。\n\n"
    "=== 輸出格式 ===\n"
    "可先用最多 100 字簡述觀察，接著在最後一行只輸出一個 JSON 物件（不要 markdown）：\n"
    '{"defects":[{"image":<1-36>,"code":"CHP|CRK|SCR|CON","box":[x0,y0,x1,y1]}]}'
)
USER_TEXT = "請回報這顆晶粒的缺陷清單（框選範圍用各張影像自己的像素座標）。"


# ---------------------------------------------------------------- parsing (also used by analyze_v2.py)
def parse_reply(text: str):
    """Last JSON object carrying a defects list → list of raw items, or None if unparseable/invalid."""
    for o in reversed(json_objects(text)):
        if isinstance(o.get("defects"), list):
            items = o["defects"]
            for it in items:
                if not isinstance(it, dict) or it.get("code") not in v1.CODES:
                    return None
                img, box = it.get("image"), it.get("box")
                if not isinstance(img, int) or not 1 <= img <= len(PLAN):
                    return None
                if not (isinstance(box, list) and len(box) == 4 and all(isinstance(b, (int, float)) for b in box)):
                    return None
            return items
    return None


def to_global(item) -> tuple:
    _, (ox, oy, ox1, oy1), zoom = PLAN[item["image"] - 1]
    x0, y0, x1, y1 = item["box"]
    gx0, gx1 = sorted((ox + x0 / zoom, ox + x1 / zoom))
    gy0, gy1 = sorted((oy + y0 / zoom, oy + y1 / zoom))
    # clamp to the tile that was actually shown
    return (max(ox, gx0), max(oy, gy0), min(ox1, gx1), min(oy1, gy1))


def merge(items) -> list[tuple]:
    """Same code + overlapping (or touching within 3 px) global boxes → one defect (union box)."""
    boxes = [(it["code"], to_global(it)) for it in items]
    merged = []
    for code, b in boxes:
        for i, (c2, m) in enumerate(merged):
            if c2 == code and b[0] <= m[2] + 3 and m[0] <= b[2] + 3 and b[1] <= m[3] + 3 and m[1] <= b[3] + 3:
                merged[i] = (code, (min(b[0], m[0]), min(b[1], m[1]), max(b[2], m[2]), max(b[3], m[3])))
                break
        else:
            merged.append((code, b))
    return merged


def judge_reply(text: str) -> dict:
    """reply text → {verdict, defects (measured), reasons, unparseable}."""
    items = parse_reply(text)
    if items is None:
        return {"verdict": v1.WARNING, "defects": [], "reasons": ["AI 回覆無法解析，送人工複判"], "unparseable": True}
    defects = [v2.measure(code, box) for code, box in merge(items)]
    r = v2.derive_verdict(defects)
    return {"verdict": r["verdict"], "defects": defects, "reasons": r["reasons"], "unparseable": False}


# ---------------------------------------------------------------- cache / ledger
def key_of(appraiser, sample, trial):
    return f"v2|{appraiser}|{sample}|{trial}"


def load_cache() -> dict:
    out = {}
    if CACHE_FILE.exists():
        for line in CACHE_FILE.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                out[r["key"]] = r
    return out


def spent(cache) -> tuple[float, int]:
    return sum(r["costUsd"] for r in cache.values()), len(cache)


def write_ledger(cache, budget):
    total, n = spent(cache)
    led = {"model": MODEL, "priceUsdPerMTok": PRICE, "budgetUsd": budget, "totalUsd": round(total, 4),
           "calls": n, "updatedAt": datetime.now(timezone.utc).isoformat()}
    LEDGER.write_text(json.dumps(led, ensure_ascii=False, indent=2), encoding="utf-8")
    return led


class Runner:
    def __init__(self, budget):
        import anthropic
        self.anthropic = anthropic
        self.client = anthropic.Anthropic(api_key=load_api_key(), max_retries=6, timeout=300)
        self.budget = budget
        self.lock = threading.Lock()
        self.cache = load_cache()
        self.reserved = 0.0
        self.max_seen = max([r["costUsd"] for r in self.cache.values()] or [0.0])
        self.tiles = {}
        self.aborted = False

    def est(self):
        return self.max_seen * 1.2 if self.max_seen > 0 else 0.08  # conservative until observed

    def try_reserve(self):
        with self.lock:
            total, _ = spent(self.cache)
            e = self.est()
            if total + self.reserved + e > self.budget:
                self.aborted = True
                return None
            self.reserved += e
            return e

    def content(self, sample):
        if sample not in self.tiles:
            self.tiles[sample] = tiles_b64(sample)
        blocks = []
        for i, ((label, _, _), data) in enumerate(zip(PLAN, self.tiles[sample]), start=1):
            blocks.append({"type": "text", "text": f"影像 {i}：{label}"})
            blocks.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": data}})
        blocks.append({"type": "text", "text": USER_TEXT})
        return blocks

    def call(self, appraiser, sample, trial):
        k = key_of(appraiser, sample, trial)
        if k in self.cache:
            return "cached"
        res = self.try_reserve()
        if res is None:
            return "budget"
        t0 = time.time()
        try:
            system = [{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}},
                      {"type": "text", "text": PERSONA[appraiser]}]
            for attempt in range(4):
                try:
                    msg = self.client.messages.create(
                        model=MODEL, max_tokens=1200, system=system, extra_body={"temperature": 1.0},
                        messages=[{"role": "user", "content": self.content(sample)}])
                    break
                except (self.anthropic.RateLimitError, self.anthropic.InternalServerError,
                        self.anthropic.APIConnectionError) as e:
                    wait = 15 * (attempt + 1)
                    print(f"  retry {k} after {type(e).__name__}, sleeping {wait}s", flush=True)
                    time.sleep(wait)
            else:
                return "error"
            text = "".join(b.text for b in msg.content if b.type == "text")
            u = msg.usage
            usage = {"input_tokens": u.input_tokens, "output_tokens": u.output_tokens,
                     "cache_creation_input_tokens": u.cache_creation_input_tokens or 0,
                     "cache_read_input_tokens": u.cache_read_input_tokens or 0}
            cost = usage_cost(usage)
            rec = {"key": k, "condition": "v2", "appraiser": appraiser, "sample": sample, "trial": trial,
                   "model": msg.model, "stopReason": msg.stop_reason, "text": text, "usage": usage,
                   "costUsd": cost, "seconds": round(time.time() - t0, 1),
                   "at": datetime.now(timezone.utc).isoformat()}
            with self.lock:
                with open(CACHE_FILE, "a", encoding="utf-8") as f:
                    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                self.cache[k] = rec
                self.max_seen = max(self.max_seen, cost)
            return "ok"
        except self.anthropic.APIStatusError as e:
            print(f"  API error {k}: {e.status_code} {str(e)[:200]}", flush=True)
            return "error"
        finally:
            with self.lock:
                self.reserved -= res


def cmd_run(args):
    RAW.mkdir(parents=True, exist_ok=True)
    ref = {s["id"]: s for s in json.loads((SAMPLES / "reference.json").read_text(encoding="utf-8"))["samples"]}
    ids = list(ref) if args.images == "all" else args.images.split(",")
    apps = APPRAISERS if args.appraisers == "all" else args.appraisers.split(",")
    r = Runner(args.budget)
    jobs = [(a, s, t) for t in range(1, args.trials + 1) for a in apps for s in ids]
    todo = [j for j in jobs if key_of(*j) not in r.cache]
    total0, n0 = spent(r.cache)
    print(f"jobs={len(jobs)} cached={len(jobs) - len(todo)} todo={len(todo)} v2 spent so far=${total0:.4f} ({n0} calls)",
          flush=True)
    stats, done = {}, 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(r.call, *j): j for j in todo}
        for f in as_completed(futs):
            st = f.result()
            stats[st] = stats.get(st, 0) + 1
            done += 1
            if done % 10 == 0 or done == len(todo):
                t, n = spent(r.cache)
                print(f"  {done}/{len(todo)} v2 total=${t:.4f} calls={n} {stats}", flush=True)
    led = write_ledger(r.cache, args.budget)
    print(json.dumps(led, ensure_ascii=False))
    if r.aborted:
        print("BUDGET GUARD: stopped scheduling new calls; cached results kept.")
    if args.show:
        for a, s, t in jobs:
            rec = r.cache.get(key_of(a, s, t))
            if not rec:
                continue
            j = judge_reply(rec["text"])
            print(f"\n{s} {a} 第{t}次  標準答案 {ref[s]['referenceVerdict']} → v2 判定 {j['verdict']}"
                  f"  (${rec['costUsd']:.4f}, {rec.get('seconds')} s, in={rec['usage']['input_tokens']} out={rec['usage']['output_tokens']})")
            print("  標準答案缺陷：", [{k: d[k] for k in d if k != 'location'} for d in ref[s]["defects"]])
            for d in j["defects"]:
                print("  AI→程式量測：", d)
            print("  理由：", j["reasons"])


def cmd_cost(_):
    c = load_cache()
    print(json.dumps(write_ledger(c, BUDGET_USD), ensure_ascii=False, indent=2))
    if c:
        cs = [r["costUsd"] for r in c.values()]
        secs = [r.get("seconds", 0) for r in c.values()]
        print(f"v2: n={len(c)} mean=${sum(cs) / len(cs):.4f} max=${max(cs):.4f} mean {sum(secs) / len(secs):.1f} s")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--images", default="all")
    r.add_argument("--appraisers", default="all")
    r.add_argument("--trials", type=int, default=2)
    r.add_argument("--workers", type=int, default=3)
    r.add_argument("--budget", type=float, default=BUDGET_USD)
    r.add_argument("--show", action="store_true", help="print parsed results per call")
    r.set_defaults(func=cmd_run)
    c = sub.add_parser("cost")
    c.set_defaults(func=cmd_cost)
    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
