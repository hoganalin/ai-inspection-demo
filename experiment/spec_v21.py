"""檢驗規範 v2.1 規則引擎（第三輪 PDCA：先修正、凍結，再以新樣本盲測）。

與 v2 的差別只在「量測」，AI 的提示、分塊、門檻、Gate 都不變：
1. 框內找實際範圍：AI 的框只當搜尋範圍（向外放寬 12 px），程式在範圍內和良品標準晶粒
   (golden die) 比對，找出和良品不同的像素（崩角、裂紋找較暗的，刮傷、污染找較亮的），以半高
   寬取實際範圍量尺寸、判區域。這是 AOI 常見的 die-to-golden 比對；標準晶粒只用開發集（舊 40 張）
   的無缺陷良品建立，凍結後不再改。
2. 程式找不到差異 → 尺寸無法確認 → Warning（送人工）。
3. 門檻附近送人工：量測值落在任一允收門檻 ±10% 內 → Warning。
4. 尺寸經程式確認、且離門檻夠遠 → 直接照 v1 允收標準判；v2 的「周邊區一律 Warning、核心線狀
   缺陷一律 Warning」是為了補 AI 量不準而加的，量測確認後不再需要。

限制：標準樣本是半合成影像，每張的底圖相同（只差光照與雜訊），比對法在這裡會比真實產線
（晶粒間有製程差異、對位誤差）更準；真實導入要以實際良品重建標準晶粒並重新驗證。

Run `python spec_v21.py` to execute the self-tests (needs experiment/samples/*.png).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

import spec_v1 as v1
import spec_v2 as v2

SPEC_VERSION = "v2.1"
PASS, WARNING, FAIL = v1.PASS, v1.WARNING, v1.FAIL
N = v1.DIE_PX
UM = v1.UM_PER_PX
HERE = Path(__file__).resolve().parent
GOLDEN_FILE = HERE / "golden" / "golden-die.png"

# frozen parameters (decided on the development set; see results/v21-dev.json)
SEARCH_MARGIN_PX = 12    # AI 的框向外放寬多少 px 當搜尋範圍
DIFF_FLOOR = 20.0        # 和良品差異的最低門檻（灰階，三通道取最大）
DIFF_SIGMA = 6.0         # 差異門檻 = max(DIFF_FLOOR, 中位數 + k × 雜訊)
BORDER_BAND = 0.10       # 量測值落在門檻 ±10% 內 → Warning
USE_BORDER_BAND = True

# 允收門檻（µm），依缺陷代碼與區域；用於「門檻附近送人工」
THRESHOLDS = {
    ("CHP", "peripheral"): (10.0, 25.0),
    ("SCR", "core"): (100.0, 300.0),
    ("SCR", "peripheral"): (300.0,),
    ("CON", "core"): (20.0, 50.0),
    ("CON", "peripheral"): (50.0,),
}


# ---------------------------------------------------------------- golden die
def build_golden(sample_dir: Path, ids: list[str]) -> np.ndarray:
    """Per-pixel median of known-good dies, each first scaled to a common brightness."""
    stack, means = [], []
    for i in ids:
        a = np.asarray(Image.open(sample_dir / f"{i}.png").convert("RGB"), dtype=np.float32)
        means.append(a.reshape(-1, 3).mean(0))
        stack.append(a / means[-1])
    # back to the dies' own brightness so nothing clips when saved as 8-bit
    return np.median(np.stack(stack), axis=0) * np.mean(means, axis=0)


def load_golden() -> np.ndarray:
    return np.asarray(Image.open(GOLDEN_FILE).convert("RGB"), dtype=np.float32)


def save_golden(g: np.ndarray):
    GOLDEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).save(GOLDEN_FILE, optimize=True)


# ---------------------------------------------------------------- refinement
# which way a defect differs from the good die: chips and cracks are dark, scratches and particles bright
# (a particle's drop shadow is dark and is deliberately left out of its size)
POLARITY = {"CHP": -1, "CRK": -1, "SCR": +1, "CON": +1}


def refine_box(img: np.ndarray, golden: np.ndarray, box, code: str | None = None) -> tuple | None:
    """AI box (global px) → tight box of the pixels that differ from the golden die, or None.

    The AI box only sets where to look (widened by SEARCH_MARGIN_PX); every component found in that window
    counts. The extent is taken at half the component's peak contrast, so anti-aliased edges and faint halos
    do not inflate the size."""
    x0, y0, x1, y1 = box
    m = SEARCH_MARGIN_PX
    wx0, wy0 = max(0, int(np.floor(x0 - m))), max(0, int(np.floor(y0 - m)))
    wx1, wy1 = min(N, int(np.ceil(x1 + m))), min(N, int(np.ceil(y1 + m)))
    if wx1 - wx0 < 3 or wy1 - wy0 < 3:
        return None
    # a wider context window for the local gain, so a large defect doesn't bias it
    cx0, cy0, cx1, cy1 = max(0, wx0 - 24), max(0, wy0 - 24), min(N, wx1 + 24), min(N, wy1 + 24)
    I = img[cy0:cy1, cx0:cx1]
    G = golden[cy0:cy1, cx0:cx1]
    gain = np.median(I.reshape(-1, 3), 0) / np.maximum(np.median(G.reshape(-1, 3), 0), 1e-3)
    S = I - G * gain
    pol = POLARITY.get(code, 0)
    D = (S * pol).max(axis=2) if pol else np.abs(S).max(axis=2)
    noise = 1.4826 * np.median(np.abs(D - np.median(D)))
    thr = max(DIFF_FLOOR, float(np.median(D)) + DIFF_SIGMA * noise)
    mask = ndimage.binary_closing(D > thr, structure=np.ones((3, 3)))
    win = np.zeros_like(mask)
    sy0, sx0 = wy0 - cy0, wx0 - cx0
    win[sy0:sy0 + (wy1 - wy0), sx0:sx0 + (wx1 - wx0)] = True
    lab, n = ndimage.label(mask & win, structure=np.ones((3, 3)))
    if n == 0:
        return None
    keep = [k for k in range(1, n + 1) if (lab == k).sum() >= 3]  # drop isolated noise pixels
    if not keep:
        return None
    sel = np.isin(lab, keep)
    peak = float(D[sel].max())
    core = sel & (D >= max(thr, 0.5 * peak))
    ys, xs = np.nonzero(core if core.any() else sel)
    return (float(xs.min() + cx0), float(ys.min() + cy0), float(xs.max() + cx0 + 1), float(ys.max() + cy0 + 1))


def near_threshold(d: dict) -> bool:
    key = (d["code"], d["zone"])
    val = d.get({"CHP": "depthUm", "SCR": "lengthUm", "CON": "diameterUm"}.get(d["code"], ""), None)
    if val is None or key not in THRESHOLDS:
        return False
    return any(abs(val - t) <= BORDER_BAND * t for t in THRESHOLDS[key])


def measure(code: str, ai_box, img: np.ndarray, golden: np.ndarray) -> dict:
    """AI box → measured defect (v1 schema) + whether the program confirmed the size."""
    tight = refine_box(img, golden, ai_box, code)
    d = v2.measure(code, tight if tight is not None else ai_box)
    d["refined"] = tight is not None
    return d


def judge_defect(d: dict) -> str:
    """Size confirmed and clear of every threshold → the v1 acceptance rule as written (v2's blanket
    safety routing is no longer needed); size not confirmed, or within ±10 % of a threshold → Warning."""
    if not d.get("refined", True):
        return WARNING  # the program could not confirm the size: a person looks
    v = v1.judge_defect(d)
    hard_rule = d["code"] == "CRK" or d.get("crossesPad") or d.get("touchesSealRing") or (
        d["code"] == "CHP" and d["zone"] == "core")
    if USE_BORDER_BAND and not hard_rule and near_threshold(d):
        return WARNING
    return v


def derive_verdict(defects: list[dict]) -> dict:
    """Same structure as spec_v2.derive_verdict, with v2.1 per-defect judging."""
    cons = [d for d in defects if d["code"] == "CON"]
    guard = len(cons) >= v2.CON_HALLUCINATION_COUNT
    verdicts, reasons = [], []
    for d in defects:
        v = judge_defect(d)
        if guard and d["code"] == "CON" and v == FAIL:
            v = WARNING
        verdicts.append(v)
        tag = "" if d.get("refined", True) else "（未確認尺寸）"
        reasons.append(f"{d['code']}@{d['zone']}{tag}→{v}")
    if guard:
        verdicts.append(WARNING)
        reasons.append(f"一次回報 {len(cons)} 顆 CON→送人工複判")
    else:
        core_points = sum(1 for d in cons if d["zone"] == "core" and d.get("diameterUm", 0) >= 20)
        if core_points >= 3:
            band = USE_BORDER_BAND and any(abs(d["diameterUm"] - 20) <= BORDER_BAND * 20
                                           for d in cons if d["zone"] == "core" and d["diameterUm"] >= 20)
            verdicts.append(WARNING if band else FAIL)
            reasons.append(f"CON 核心區計 {core_points} 點→{'Warning（門檻附近）' if band else 'Fail'}")
    return {"verdict": v1.worst(verdicts), "specVersion": SPEC_VERSION, "reasons": reasons}


def _tests():
    ref = json.loads((HERE / "samples" / "reference.json").read_text(encoding="utf-8"))["samples"]
    golden = load_golden()
    img = lambda s: np.asarray(Image.open(HERE / "samples" / f"{s}.png").convert("RGB"), dtype=np.float32)
    # a clean die: nothing differs from the golden die anywhere
    clean = next(s["id"] for s in ref if not s["defects"])
    assert refine_box(img(clean), golden, (400, 400, 460, 460)) is None
    # every injected defect is found when the AI box is the true location ± 8 px
    for s in ref:
        a = img(s["id"])
        for d in s["defects"]:
            x, y = d["location"]["x"], d["location"]["y"]
            assert refine_box(a, golden, (x - 8, y - 8, x + 8, y + 8)) is not None, (s["id"], d)
    assert near_threshold({"code": "CON", "zone": "core", "diameterUm": 48})
    assert not near_threshold({"code": "CON", "zone": "core", "diameterUm": 35})
    print("spec_v21 self-tests passed")


if __name__ == "__main__":
    _tests()
