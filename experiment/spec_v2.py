"""檢驗規範 v2 規則引擎（docs/spec/inspection-spec-v2.md）。

與 v1 的差別（PDCA 的 Act，依 results/msa-summary.md 的 v2 提案）：
1. 影像改為分塊放大判讀（切塊在 run_v2.py）；AI 只回報缺陷代碼與框選範圍 (bbox)。
2. 尺寸、檢驗區域、是否經過 pad、是否觸及 seal ring 全部由本模組依 bbox 換算（5 µm/px），
   AI 不估尺寸、不判區域。
3. 安全偏向的路由：周邊區任何 CHP／CRK／CON 至少 Warning；核心區線狀缺陷（SCR／CRK）至少
   Warning；一次回報 ≥ 4 顆 CON 時，CON 只送人工複判、不直接 Fail（幻覺的典型型態）。
允收門檻沿用 v1（spec_v1.judge_defect），判定仍由規則推導（ADR-0001）。

Run `python spec_v2.py` to execute the self-tests.
"""
from __future__ import annotations

import spec_v1 as v1

SPEC_VERSION = "v2"
PASS, WARNING, FAIL = v1.PASS, v1.WARNING, v1.FAIL
N = v1.DIE_PX
PAD_CENTERS = [100 + 48 * k for k in range(18)]  # same layout as generate_samples.py
CON_HALLUCINATION_COUNT = 4


def pad_rects():
    s, o = v1.PAD_SIZE_PX, v1.PAD_OFFSET_PX
    rects = []
    for c in PAD_CENTERS:
        a, b = c - s / 2, c + s / 2
        rects += [(a, o, b, o + s), (a, N - o - s, b, N - o), (o, a, o + s, b), (N - o - s, a, N - o, b)]
    return rects


PADS = pad_rects()


def _overlaps(a, b) -> bool:
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def depth_from_edge_px(box) -> float:
    """How far the box reaches into the die from its nearest edge (px)."""
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    edge = min(("top", cy), ("bottom", N - cy), ("left", cx), ("right", N - cx), key=lambda t: t[1])[0]
    return {"top": y1, "bottom": N - y0, "left": x1, "right": N - x0}[edge]


def innermost_px(box) -> float:
    """Distance from the die edge of the box point deepest inside the die (px)."""
    x0, y0, x1, y1 = box
    # the deepest point of the box: farthest from all four edges
    best = 0.0
    for x in (x0, x1, (x0 + x1) / 2):
        for y in (y0, y1, (y0 + y1) / 2):
            best = max(best, min(x, y, N - x, N - y))
    return best


def measure(code: str, box) -> dict:
    """bbox (global px, x0,y0,x1,y1) → defect dict in the v1 schema, measured by the program."""
    x0, y0, x1, y1 = [float(v) for v in box]
    x0, x1 = sorted((max(0.0, x0), min(N, x1)))
    y0, y1 = sorted((max(0.0, y0), min(N, y1)))
    w, h = x1 - x0, y1 - y0
    um = v1.UM_PER_PX
    deep = innermost_px((x0, y0, x1, y1))
    zone = "peripheral" if deep <= v1.SEAL_RING_OUTER_PX else "core"
    d = {"code": code, "zone": zone, "bbox": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)]}
    if code == "CHP":
        depth = depth_from_edge_px((x0, y0, x1, y1))
        d["depthUm"] = round(depth * um, 1)
        d["touchesSealRing"] = depth > v1.SEAL_RING_OUTER_PX
        d["zone"] = "core" if depth > v1.SEAL_RING_INNER_PX else "peripheral"
    elif code in ("SCR", "CRK"):
        d["lengthUm"] = round((w * w + h * h) ** 0.5 * um, 1)
        if code == "SCR":
            d["crossesPad"] = any(_overlaps((x0, y0, x1, y1), p) for p in PADS)
    elif code == "CON":
        d["diameterUm"] = round(max(w, h) * um, 1)
    return d


def judge_defect(d: dict) -> str:
    v = v1.judge_defect(d)
    if d["zone"] == "peripheral" and d["code"] in ("CHP", "CRK", "CON"):
        v = v1.worst([v, WARNING])
    if d["zone"] == "core" and d["code"] in ("SCR", "CRK"):
        v = v1.worst([v, WARNING])
    return v


def derive_verdict(defects: list[dict]) -> dict:
    """defects already measured by `measure`. Returns {verdict, specVersion, reasons}."""
    cons = [d for d in defects if d["code"] == "CON"]
    hallucination_guard = len(cons) >= CON_HALLUCINATION_COUNT
    verdicts, reasons = [], []
    for d in defects:
        v = judge_defect(d)
        if hallucination_guard and d["code"] == "CON" and v == FAIL:
            v = WARNING
        verdicts.append(v)
        reasons.append(f"{d['code']}@{d['zone']}→{v}")
    if hallucination_guard:
        verdicts.append(WARNING)
        reasons.append(f"一次回報 {len(cons)} 顆 CON→送人工複判")
    else:
        core_points = sum(1 for d in cons if d["zone"] == "core" and d.get("diameterUm", 0) >= 20)
        if core_points >= 3:
            verdicts.append(FAIL)
            reasons.append(f"CON 核心區計 {core_points} 點→Fail")
    return {"verdict": v1.worst(verdicts), "specVersion": SPEC_VERSION, "reasons": reasons}


def _tests():
    V = lambda items: derive_verdict([measure(c, b) for c, b in items])["verdict"]
    assert V([]) == PASS
    # CHP: depth from the nearest edge; 40 µm = 8 px deep at the bottom edge → Fail
    m = measure("CHP", (360, 992, 378, 1000))
    assert m["depthUm"] == 40 and m["zone"] == "peripheral" and not m["touchesSealRing"]
    assert V([("CHP", (360, 992, 378, 1000))]) == FAIL
    # tiny peripheral chip (v1 Pass) is routed to Warning in v2
    assert V([("CHP", (720, 0, 726, 1))]) == WARNING
    # chip reaching past the seal ring → Fail
    assert measure("CHP", (950, 700, 1000, 750))["touchesSealRing"] is True
    assert V([("CHP", (950, 700, 1000, 750))]) == FAIL
    # SCR in core, 450 µm diagonal → Fail; 70 µm (v1 Pass) → Warning in v2
    assert V([("SCR", (300, 300, 363.6, 363.6))]) == FAIL
    assert V([("SCR", (730, 140, 740, 150))]) == WARNING
    # SCR crossing a pad (pad centred at x=484, y 40–56) → Fail
    assert measure("SCR", (480, 30, 500, 70))["crossesPad"] is True
    # peripheral SCR keeps v1 rule (no peripheral escalation for SCR)
    assert V([("SCR", (2, 400, 12, 440))]) == PASS
    # CRK anywhere → Fail
    assert V([("CRK", (0, 540, 15, 570))]) == FAIL
    # CON: three ≥20 µm core points → Fail; 4+ reported → Warning (hallucination guard)
    con = lambda x, y, s: ("CON", (x, y, x + s, y + s))
    assert V([con(240, 300, 5), con(360, 580, 6), con(660, 790, 7)]) == FAIL
    assert V([con(100 * k + 100, 500, 12) for k in range(6)]) == WARNING
    # peripheral CON below 50 µm (v1 Pass) → Warning in v2
    assert V([con(165, 982, 7)]) == WARNING
    print("spec_v2 self-tests passed")


if __name__ == "__main__":
    _tests()
