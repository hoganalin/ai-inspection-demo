"""檢驗規範 v1 規則引擎（docs/spec/inspection-spec-v1.md）。

AI 只回報缺陷清單；判定 (Verdict) 由本模組依允收標準推導（ADR-0001）。
所有閾值為規範中的假設值。邊界值歸屬依規範第 3 節：「<」「>」為嚴格不等式，「≥」含等號，
「a–b」區間含兩端（例：CHP 周邊區 10 µm → Warning，25 µm → Warning，25.1 µm → Fail）。

Run `python spec_v1.py` to execute the self-tests.
"""
from __future__ import annotations

SPEC_VERSION = "v1"

# Geometry (spec §1)
UM_PER_PX = 5.0
DIE_PX = 1000
SEAL_RING_OUTER_PX = 20  # 100 µm from edge
SEAL_RING_INNER_PX = 24  # 120 µm from edge
PAD_SIZE_PX = 16
PAD_OFFSET_PX = 40  # pad outer edge 200 µm from die edge

PASS, WARNING, FAIL = "Pass", "Warning", "Fail"
_RANK = {PASS: 0, WARNING: 1, FAIL: 2}
CODES = ("CHP", "CRK", "SCR", "CON")
ZONES = ("core", "peripheral")


def worst(verdicts) -> str:
    out = PASS
    for v in verdicts:
        if _RANK[v] > _RANK[out]:
            out = v
    return out


def _num(d: dict, key: str) -> float:
    v = d.get(key)
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def judge_defect(d: dict) -> str:
    """Verdict for a single defect, ignoring the CON core point-count rule
    (which needs the whole list; see derive_verdict)."""
    code = d.get("code")
    zone = d.get("zone", "core")
    if code == "CRK":
        return FAIL
    if code == "CHP":
        depth = _num(d, "depthUm")
        if zone == "core" or d.get("touchesSealRing"):
            return FAIL
        if depth < 10:
            return PASS
        if depth <= 25:
            return WARNING
        return FAIL
    if code == "SCR":
        length = _num(d, "lengthUm")
        if zone == "peripheral":
            return PASS if length < 300 else WARNING
        if d.get("crossesPad"):
            return FAIL
        if length < 100:
            return PASS
        if length <= 300:
            return WARNING
        return FAIL
    if code == "CON":
        dia = _num(d, "diameterUm")
        if zone == "peripheral":
            return PASS if dia < 50 else WARNING
        if dia > 50:
            return FAIL
        return WARNING if dia >= 20 else PASS  # count rule handled in derive_verdict
    return PASS  # unknown code: ignored (logged by callers)


def derive_verdict(defects: list[dict]) -> dict:
    """Return {verdict, specVersion, reasons:[...]} for a die."""
    reasons = []
    verdicts = []
    for d in defects:
        v = judge_defect(d)
        verdicts.append(v)
        reasons.append(f"{d.get('code')}@{d.get('zone')}→{v}")
    core_con_points = sum(
        1 for d in defects
        if d.get("code") == "CON" and d.get("zone", "core") == "core" and _num(d, "diameterUm") >= 20
    )
    if core_con_points >= 3:
        verdicts.append(FAIL)
        reasons.append(f"CON 核心區計 {core_con_points} 點→Fail")
    return {"verdict": worst(verdicts), "specVersion": SPEC_VERSION, "reasons": reasons}


def _tests():
    V = lambda ds: derive_verdict(ds)["verdict"]
    assert V([]) == PASS
    # CHP peripheral boundaries
    chp = lambda depth, **kw: {"code": "CHP", "zone": "peripheral", "depthUm": depth, **kw}
    assert V([chp(9.9)]) == PASS
    assert V([chp(10)]) == WARNING
    assert V([chp(25)]) == WARNING
    assert V([chp(25.1)]) == FAIL
    assert V([chp(5, touchesSealRing=True)]) == FAIL
    assert V([{"code": "CHP", "zone": "core", "depthUm": 150}]) == FAIL
    # CRK
    assert V([{"code": "CRK", "zone": "peripheral", "lengthUm": 50}]) == FAIL
    # SCR
    scr = lambda z, L, pad=False: {"code": "SCR", "zone": z, "lengthUm": L, "crossesPad": pad}
    assert V([scr("peripheral", 299)]) == PASS
    assert V([scr("peripheral", 300)]) == WARNING
    assert V([scr("peripheral", 2000)]) == WARNING
    assert V([scr("core", 99)]) == PASS
    assert V([scr("core", 100)]) == WARNING
    assert V([scr("core", 300)]) == WARNING
    assert V([scr("core", 301)]) == FAIL
    assert V([scr("core", 50, pad=True)]) == FAIL
    # CON
    con = lambda z, dia: {"code": "CON", "zone": z, "diameterUm": dia}
    assert V([con("peripheral", 49)]) == PASS
    assert V([con("peripheral", 50)]) == WARNING
    assert V([con("core", 19)]) == PASS
    assert V([con("core", 20)]) == WARNING
    assert V([con("core", 20), con("core", 30)]) == WARNING
    assert V([con("core", 20), con("core", 30), con("core", 25)]) == FAIL
    assert V([con("core", 15), con("core", 15), con("core", 30)]) == WARNING
    assert V([con("core", 50)]) == WARNING
    assert V([con("core", 50.5)]) == FAIL
    # worst wins
    assert V([chp(5), scr("core", 150), con("core", 60)]) == FAIL
    assert V([chp(5), scr("core", 150)]) == WARNING
    print("spec_v1 self-tests passed")


if __name__ == "__main__":
    _tests()
