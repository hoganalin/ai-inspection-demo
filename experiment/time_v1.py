"""補量第一輪（規範 v1，「改善後」條件）AI 每顆判讀時間。

第一輪（run_msa.py, 2026-10-05）沒有記錄每次呼叫的秒數；第二輪起 run_v2.py 才記錄
（time.time() 包住 messages.create，含重試，取全部呼叫平均）。本程式用第一輪完全相同的
模型、系統提示（規範 v1 全文＋影像補充）、角色一行、影像與 temperature 1.0，對開發集 40 張
各呼叫一次（三個角色輪流），用與第二輪相同的方式計時。只量時間：回覆不進入一致性分析，
不寫入 raw/after.jsonl，不影響任何既有指標。

    python experiment/time_v1.py            # 量 40 次（約 US$0.3），結果寫入 results/v1-timing.json
"""
import base64
import json
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run_msa import (  # noqa: E402
    APPRAISERS, MODEL, PERSONA, SAMPLES, USER_TEXT, after_system_cached, load_api_key, usage_cost,
)

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw" / "v1_timing.jsonl"
OUT = HERE / "results" / "v1-timing.json"
BUDGET_USD = 0.60


def main():
    import anthropic
    client = anthropic.Anthropic(api_key=load_api_key(), max_retries=6, timeout=120)
    ref = json.loads((SAMPLES / "reference.json").read_text(encoding="utf-8"))
    ids = [s["id"] for s in ref["samples"]]
    jobs = [(APPRAISERS[k % len(APPRAISERS)], sid) for k, sid in enumerate(ids)]
    system_text = after_system_cached()
    lock = threading.Lock()
    spent = [0.0]
    recs = []

    def call(appraiser, sample):
        with lock:
            if spent[0] > BUDGET_USD - 0.02:
                return None
        img = base64.standard_b64encode((SAMPLES / f"{sample}.png").read_bytes()).decode()
        system = [{"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}},
                  {"type": "text", "text": PERSONA[appraiser]}]
        t0 = time.time()
        for attempt in range(4):
            try:
                msg = client.messages.create(
                    model=MODEL, max_tokens=600, system=system, extra_body={"temperature": 1.0},
                    messages=[{"role": "user", "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img}},
                        {"type": "text", "text": USER_TEXT["after"]},
                    ]}])
                break
            except (anthropic.RateLimitError, anthropic.InternalServerError, anthropic.APIConnectionError):
                time.sleep(10 * (attempt + 1))
        else:
            return None
        seconds = round(time.time() - t0, 1)
        u = msg.usage
        usage = {"input_tokens": u.input_tokens, "output_tokens": u.output_tokens,
                 "cache_creation_input_tokens": u.cache_creation_input_tokens or 0,
                 "cache_read_input_tokens": u.cache_read_input_tokens or 0}
        rec = {"condition": "v1-timing", "appraiser": appraiser, "sample": sample, "model": msg.model,
               "seconds": seconds, "usage": usage, "costUsd": usage_cost(usage),
               "at": datetime.now(timezone.utc).isoformat()}
        with lock:
            spent[0] += rec["costUsd"]
            recs.append(rec)
            with open(RAW, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(f"  {sample}/{appraiser}: {seconds} s (${rec['costUsd']:.4f})", flush=True)
        return rec

    RAW.parent.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as ex:  # 與第一、二輪相同：4 個請求同時跑
        list(ex.map(lambda j: call(*j), jobs))

    secs = [r["seconds"] for r in recs]
    out = {
        "what": "規範 v1（改善後條件）AI 每次呼叫的回應時間，事後補量",
        "measuredAt": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "method": "與 run_v2.py 相同：time.time() 包住 messages.create（含重試），4 個請求同時跑；開發集 40 張各 1 次，三個角色輪流",
        "calls": len(secs),
        "meanSecondsPerCall": round(statistics.mean(secs), 2) if secs else None,
        "medianSecondsPerCall": statistics.median(secs) if secs else None,
        "minSeconds": min(secs) if secs else None,
        "maxSeconds": max(secs) if secs else None,
        "spendUsd": round(spent[0], 4),
        "note": "第一輪原始實驗（2026-10-05）未記錄秒數；此為 2026-10-15 以相同設定補量，只量時間，不影響一致性分析指標。",
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
