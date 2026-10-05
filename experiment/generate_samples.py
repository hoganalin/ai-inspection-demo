"""Step 1 — 標準樣本集產生器。

程序化 (procedural) 產生晶粒俯視底圖，依檢驗規範 v1 幾何注入已知尺寸的缺陷，
輸出 40 張 PNG 與 reference.json（標準答案，判定由 spec_v1.py 推導）。

Usage:  python experiment/generate_samples.py
Deterministic (fixed seeds) — rerunning reproduces identical images.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

import spec_v1 as spec

HERE = Path(__file__).resolve().parent
OUT = HERE / "samples"
N = spec.DIE_PX
SS = 4  # supersampling factor for anti-aliased drawing
UM = spec.UM_PER_PX
PAD_CENTERS = [100 + 48 * k for k in range(18)]  # 100..916 px along each edge


# ---------------------------------------------------------------- geometry
def pad_rects():
    s, o = spec.PAD_SIZE_PX, spec.PAD_OFFSET_PX
    rects = []
    for p in PAD_CENTERS:
        h = s // 2
        rects.append((p - h, o, p + h, o + s))  # top
        rects.append((p - h, N - o - s, p + h, N - o))  # bottom
        rects.append((o, p - h, o + s, p + h))  # left
        rects.append((N - o - s, p - h, N - o, p + h))  # right
    return rects


PADS = pad_rects()


def edge_dist(x, y):
    return min(x, y, N - 1 - x, N - 1 - y)


def zone_of_points(pts):
    deepest = max(edge_dist(x, y) for x, y in pts)
    if deepest < spec.SEAL_RING_OUTER_PX:
        return "peripheral", deepest
    if deepest > spec.SEAL_RING_INNER_PX:
        return "core", deepest
    return "sealring", deepest


def polyline_length(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def dense(pts, step=0.5):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(math.dist((x0, y0), (x1, y1)) / step))
        for i in range(n):
            t = i / n
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    out.append(pts[-1])
    return out


def crosses_pad(pts, margin=0.0):
    for x, y in dense(pts):
        for (x0, y0, x1, y1) in PADS:
            if x0 - margin <= x <= x1 + margin and y0 - margin <= y <= y1 + margin:
                return True
    return False


# ---------------------------------------------------------------- drawing helpers
def new_mask():
    return Image.new("L", (N * SS, N * SS), 0)


def mask_to_alpha(mask):
    small = mask.resize((N, N), Image.Resampling.BOX)
    return np.asarray(small, dtype=np.float32) / 255.0


def blend(img, alpha, color, strength=1.0):
    a = (alpha * strength)[..., None]
    img[:] = img * (1 - a) + np.asarray(color, dtype=np.float32) * a


def S(pts):
    return [(x * SS, y * SS) for x, y in pts]


# ---------------------------------------------------------------- base die
def make_base_die(seed=7):
    rng = np.random.default_rng(seed)
    img = np.zeros((N, N, 3), dtype=np.float32)
    img[:] = (46, 52, 66)  # passivated silicon, bluish dark
    img += rng.normal(0, 2.0, (N, N, 1))

    # core functional blocks
    core0, core1 = 76, N - 76
    block_specs = []
    y = core0
    while y < core1 - 40:
        h = int(rng.integers(90, 200))
        h = min(h, core1 - y)
        x = core0
        while x < core1 - 40:
            w = int(rng.integers(110, 260))
            w = min(w, core1 - x)
            block_specs.append((x + 4, y + 4, x + w - 4, y + h - 4, int(rng.integers(0, 4))))
            x += w
        y += h
    for (x0, y0, x1, y1, kind) in block_specs:
        if kind == 0:  # memory array: fine periodic grid
            tint = np.array((60, 70, 92))
            yy, xx = np.mgrid[y0:y1, x0:x1]
            pat = ((xx % 4) < 2) ^ ((yy % 6) < 3)
            img[y0:y1, x0:x1] = tint + pat[..., None] * 8
        elif kind == 1:  # standard-cell logic: random rows
            tint = np.array((55, 62, 78))
            region = tint + rng.normal(0, 5, (y1 - y0, x1 - x0, 1))
            rows = (np.arange(y1 - y0) % 7 == 0)[:, None, None]
            region = region + rows * 10
            img[y0:y1, x0:x1] = region
        elif kind == 2:  # analog / large devices: few bright rectangles
            img[y0:y1, x0:x1] = (50, 56, 70)
            for _ in range(int(rng.integers(3, 8))):
                bx0 = int(rng.integers(x0, x1 - 12)); by0 = int(rng.integers(y0, y1 - 12))
                bw = int(rng.integers(10, max(11, (x1 - x0) // 3))); bh = int(rng.integers(10, max(11, (y1 - y0) // 3)))
                img[by0:min(y1, by0 + bh), bx0:min(x1, bx0 + bw)] = (78, 84, 96)
        else:  # routing channel: thin metal lines
            img[y0:y1, x0:x1] = (48, 54, 68)
            for yy_ in range(y0, y1, 5):
                if rng.random() < 0.6:
                    img[yy_, x0:x1] = (82, 86, 92)
        # block outline
        img[y0:y1, x0] = img[y0:y1, x1 - 1] = (70, 76, 90)
        img[y0, x0:x1] = img[y1 - 1, x0:x1] = (70, 76, 90)

    # peripheral (scribe side) zone 0..20 px: rougher, slightly lighter
    per = np.zeros((N, N), bool)
    per[:20, :] = per[-20:, :] = per[:, :20] = per[:, -20:] = True
    img[per] = np.array((70, 72, 78)) + rng.normal(0, 4, (per.sum(), 1))
    # seal ring 20..24 px: bright metal band with a dark centre line
    for d, col in ((20, (165, 160, 145)), (21, (185, 180, 162)), (22, (120, 118, 110)), (23, (180, 175, 158))):
        img[d, d:N - d] = col; img[N - 1 - d, d:N - d] = col
        img[d:N - d, d] = col; img[d:N - d, N - 1 - d] = col
    # inner guard band 24..40 px stays dark silicon
    # pads with traces into the core
    for (x0, y0, x1, y1) in PADS:
        img[y0:y1, x0:x1] = (196, 188, 166)
        img[y0, x0:x1] = img[y1 - 1, x0:x1] = (150, 144, 128)
        img[y0:y1, x0] = img[y0:y1, x1 - 1] = (150, 144, 128)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        # probe mark (normal, not a defect)
        img[cy - 1:cy + 1, cx - 2:cx + 1] = (165, 158, 140)
        # trace from pad towards core
        if y0 == spec.PAD_OFFSET_PX:
            img[y1:76, cx - 1:cx + 1] = (95, 98, 104)
        elif y1 == N - spec.PAD_OFFSET_PX:
            img[N - 76:y0, cx - 1:cx + 1] = (95, 98, 104)
        elif x0 == spec.PAD_OFFSET_PX:
            img[cy - 1:cy + 1, x1:76] = (95, 98, 104)
        else:
            img[cy - 1:cy + 1, N - 76:x0] = (95, 98, 104)
    # very subtle die-edge highlight (cleaved edge)
    img[0, :] += 25; img[-1, :] += 25; img[:, 0] += 25; img[:, -1] += 25
    return np.clip(img, 0, 255)


def apply_lighting(img, rng):
    gain = rng.uniform(0.9, 1.1)
    gx, gy = rng.uniform(-0.07, 0.07, 2)
    yy, xx = np.mgrid[0:N, 0:N] / N - 0.5
    field = gain * (1 + gx * xx + gy * yy)
    tint = rng.uniform(0.96, 1.04, 3)
    out = img * field[..., None] * tint + rng.normal(0, rng.uniform(2.0, 4.0), (N, N, 1))
    return np.clip(out, 0, 255)


# ---------------------------------------------------------------- defects
EDGES = ("top", "bottom", "left", "right")


def to_xy(edge, along, depth):
    """Map (position along edge, depth from edge) to image xy."""
    if edge == "top":
        return (along, depth)
    if edge == "bottom":
        return (along, N - 1 - depth)
    if edge == "left":
        return (depth, along)
    return (N - 1 - depth, along)


def draw_chp(img, rng, depth_px, edge=None, along=None):
    edge = edge or EDGES[rng.integers(4)]
    along = along if along is not None else float(rng.uniform(150, 850))
    width = max(10.0, depth_px * rng.uniform(2.2, 3.2))
    n = 40
    ts = np.linspace(-1, 1, n)
    prof = (1 - np.abs(ts) ** rng.uniform(1.3, 2.2))  # 0 at ends, 1 in middle
    prof = prof * (1 + rng.normal(0, 0.12, n))
    prof = np.clip(prof, 0, None)
    prof = prof / prof.max() * depth_px  # max depth exactly depth_px
    poly = [to_xy(edge, along + t * width / 2, -3) for t in (-1.0,)]
    pts = [to_xy(edge, along + t * width / 2, float(p)) for t, p in zip(ts, prof)]
    poly = poly + pts + [to_xy(edge, along + width / 2, -3)]
    m = new_mask(); ImageDraw.Draw(m).polygon(S(poly), fill=255)
    rim = new_mask(); ImageDraw.Draw(rim).line(S(pts), fill=255, width=int(1.3 * SS))
    blend(img, mask_to_alpha(rim), (215, 210, 195), 0.9)  # bright conchoidal fracture rim
    blend(img, mask_to_alpha(m), (14, 14, 16), 1.0)  # missing material
    deepest = pts[int(np.argmax(prof))]
    return pts, deepest


def random_walk(rng, start, heading, length_px, step, jitter):
    pts = [start]
    total = 0.0
    while total < length_px:
        heading += rng.normal(0, jitter)
        s = min(step, length_px - total)
        x, y = pts[-1]
        pts.append((x + s * math.cos(heading), y + s * math.sin(heading)))
        total += s
    return pts


def draw_crk(img, rng, pts):
    m = new_mask(); ImageDraw.Draw(m).line(S(pts), fill=255, width=int(1.1 * SS), joint="curve")
    halo = new_mask(); ImageDraw.Draw(halo).line(S([(x + 0.8, y - 0.8) for x, y in pts]), fill=255, width=int(0.9 * SS))
    blend(img, mask_to_alpha(halo), (140, 140, 140), 0.5)
    blend(img, mask_to_alpha(m), (8, 8, 10), 0.95)


def draw_scr(img, rng, pts):
    m = new_mask(); ImageDraw.Draw(m).line(S(pts), fill=255, width=int(1.2 * SS), joint="curve")
    blend(img, mask_to_alpha(m), (215, 218, 222), 0.75)


def draw_con(img, rng, center, dia_px):
    cx, cy = center
    r = dia_px / 2
    k = 36
    th = np.linspace(0, 2 * np.pi, k, endpoint=False)
    ph = rng.uniform(0, 2 * np.pi, 3)
    rr = r * (1 + 0.10 * np.sin(2 * th + ph[0]) + 0.06 * np.sin(3 * th + ph[1]) + 0.04 * np.sin(5 * th + ph[2]))
    rr = rr / rr.max() * r  # max extent = r so diameter ≈ dia_px
    poly = [(cx + a * math.cos(t), cy + a * math.sin(t)) for a, t in zip(rr, th)]
    shadow = new_mask(); ImageDraw.Draw(shadow).polygon(S([(x + 1.2, y + 1.2) for x, y in poly]), fill=255)
    blend(img, mask_to_alpha(shadow), (10, 10, 12), 0.5)
    body = new_mask(); ImageDraw.Draw(body).polygon(S(poly), fill=255)
    color = (118, 92, 60) if rng.random() < 0.6 else (205, 200, 185)
    blend(img, mask_to_alpha(body), color, 1.0)
    hl = new_mask(); ImageDraw.Draw(hl).ellipse(S([(cx - r * 0.45, cy - r * 0.55), (cx - r * 0.05, cy - r * 0.15)]), fill=255)
    blend(img, mask_to_alpha(hl), (235, 230, 215), 0.6)
    return poly


# ---------------------------------------------------------------- placement
def core_point(rng, margin_from_pads=True):
    """Random point well inside the core, away from pads (>= 80 px from edge)."""
    lo, hi = 90, N - 90
    return (float(rng.uniform(lo, hi)), float(rng.uniform(lo, hi)))


def place_chp(img, rng, depth_um, edge=None):
    depth_px = depth_um / UM
    pts, deepest = draw_chp(img, rng, depth_px, edge=edge)
    zone, dd = zone_of_points(pts)
    touches = dd >= spec.SEAL_RING_OUTER_PX
    if zone == "sealring":
        zone = "peripheral"  # deepest point inside the seal ring band; touchesSealRing → Fail
    return {"code": "CHP", "zone": zone, "depthUm": round(depth_um, 1), "touchesSealRing": bool(touches),
            "location": {"x": round(deepest[0]), "y": round(deepest[1])}}


def place_scr_core(img, rng, length_um, cross_pad=False):
    L = length_um / UM
    for _ in range(500):
        if cross_pad:
            px0, py0, px1, py1 = PADS[int(rng.integers(len(PADS)))]
            pcx, pcy = (px0 + px1) / 2, (py0 + py1) / 2
            ang = rng.uniform(0, 2 * np.pi)
            start = (pcx - math.cos(ang) * L * rng.uniform(0.3, 0.6), pcy - math.sin(ang) * L * rng.uniform(0.3, 0.6))
        else:
            start = core_point(rng); ang = rng.uniform(0, 2 * np.pi)
        pts = random_walk(rng, start, ang, L, step=8, jitter=0.03)
        zone, dd = zone_of_points(pts)
        if zone != "core" or min(edge_dist(x, y) for x, y in pts) <= spec.SEAL_RING_INNER_PX + 1:
            continue
        cp = crosses_pad(pts)
        if cp != cross_pad or (not cross_pad and crosses_pad(pts, margin=6)):
            continue
        draw_scr(img, rng, pts)
        mid = pts[len(pts) // 2]
        return {"code": "SCR", "zone": "core", "lengthUm": round(polyline_length(pts) * UM, 1), "crossesPad": cp,
                "location": {"x": round(mid[0]), "y": round(mid[1])}}
    raise RuntimeError("could not place core scratch")


def place_scr_peripheral(img, rng, length_um):
    L = length_um / UM
    edge = EDGES[rng.integers(4)]
    along0 = rng.uniform(150, 850 - L)
    d0 = rng.uniform(7, 13)
    amp = rng.uniform(-2.0, 2.0)  # one gentle bow per scratch
    n = max(2, int(L / 6))
    pts = []
    for i in range(n + 1):
        a = along0 + L * i / n
        d = d0 + amp * math.sin(i / n * math.pi)
        pts.append(to_xy(edge, a, d))
    zone, _ = zone_of_points(pts)
    assert zone == "peripheral", zone
    draw_scr(img, rng, pts)
    mid = pts[len(pts) // 2]
    return {"code": "SCR", "zone": "peripheral", "lengthUm": round(polyline_length(pts) * UM, 1), "crossesPad": False,
            "location": {"x": round(mid[0]), "y": round(mid[1])}}


def place_crk(img, rng, length_um, zone):
    L = length_um / UM
    for _ in range(500):
        if zone == "core":
            start = core_point(rng); ang = rng.uniform(0, 2 * np.pi)
            pts = random_walk(rng, start, ang, L, step=3, jitter=0.35)
        else:
            edge = EDGES[rng.integers(4)]
            a0 = rng.uniform(150, 800)
            n = max(2, int(L / 3))
            pts, d = [], rng.uniform(4, 9)
            for i in range(n + 1):
                d = float(np.clip(d + rng.normal(0, 1.2), 2, 16))
                pts.append(to_xy(edge, a0 + L * i / n, d))
        z, _ = zone_of_points(pts)
        if z != zone or crosses_pad(pts, margin=3):
            continue
        draw_crk(img, rng, pts)
        mid = pts[len(pts) // 2]
        return {"code": "CRK", "zone": zone, "lengthUm": round(polyline_length(pts) * UM, 1),
                "location": {"x": round(mid[0]), "y": round(mid[1])}}
    raise RuntimeError("could not place crack")


def place_con(img, rng, dia_um, zone, taken):
    D = dia_um / UM
    for _ in range(1000):
        if zone == "core":
            c = core_point(rng)
        else:
            edge = EDGES[rng.integers(4)]
            # whole particle must stay < 20 px from edge
            c = to_xy(edge, float(rng.uniform(150, 850)), float(rng.uniform(D / 2 + 2, 19 - D / 2)))
        if any(math.dist(c, t) < 60 for t in taken):
            continue
        poly = draw_con(img, rng, c, D)
        z, _ = zone_of_points(poly + [c])
        assert z == zone, (z, zone, dia_um)
        taken.append(c)
        return {"code": "CON", "zone": zone, "diameterUm": round(dia_um, 1),
                "location": {"x": round(c[0]), "y": round(c[1])}}
    raise RuntimeError("could not place particle")


# ---------------------------------------------------------------- sample plan
# group: good / defective (ADR-0002 plan: 20 良品 + 20 缺陷品)
PLAN = (
    [("good", "clean", [])] * 13
    + [
        ("good", "sub-threshold CON core 12µm", [("CON", "core", 12)]),
        ("good", "sub-threshold CON core 15µm×2", [("CON", "core", 15), ("CON", "core", 15)]),
        ("good", "sub-threshold CON peripheral 35µm", [("CON", "peripheral", 35)]),
        ("good", "sub-threshold SCR core 70µm", [("SCR", "core", 70)]),
        ("good", "sub-threshold CHP 5µm", [("CHP", None, 5)]),
        ("good", "sub-threshold SCR peripheral 150µm", [("SCR", "peripheral", 150)]),
        ("good", "sub-threshold CON core 15µm + CHP 6µm", [("CON", "core", 15), ("CHP", None, 6)]),
        # defective but Pass (near the Pass/Warning boundary)
        ("defective", "boundary CHP 8µm (Pass)", [("CHP", None, 8)]),
        ("defective", "boundary SCR peripheral 250µm (Pass)", [("SCR", "peripheral", 250)]),
        # Warning
        ("defective", "CHP 12µm", [("CHP", None, 12)]),
        ("defective", "CHP 20µm", [("CHP", None, 20)]),
        ("defective", "boundary CHP 25µm (Warning)", [("CHP", None, 25)]),
        ("defective", "SCR core 150µm", [("SCR", "core", 150)]),
        ("defective", "boundary SCR core 280µm", [("SCR", "core", 280)]),
        ("defective", "SCR peripheral 400µm", [("SCR", "peripheral", 400)]),
        ("defective", "CON core 1pt 30µm", [("CON", "core", 30)]),
        ("defective", "CON core 2pt 25/40µm", [("CON", "core", 25), ("CON", "core", 40)]),
        ("defective", "CON peripheral 60µm", [("CON", "peripheral", 60)]),
        # Fail
        ("defective", "CHP 40µm", [("CHP", None, 40)]),
        ("defective", "CHP touches seal ring 105µm", [("CHP", None, 105)]),
        ("defective", "CHP into core 150µm", [("CHP", None, 150)]),
        ("defective", "CRK core 400µm", [("CRK", "core", 400)]),
        ("defective", "CRK peripheral 150µm", [("CRK", "peripheral", 150)]),
        ("defective", "SCR core 450µm", [("SCR", "core", 450)]),
        ("defective", "SCR core 180µm crosses pad", [("SCR", "core-pad", 180)]),
        ("defective", "CON core 3pt 25/30/35µm", [("CON", "core", 25), ("CON", "core", 30), ("CON", "core", 35)]),
        ("defective", "CON core 70µm", [("CON", "core", 70)]),
    ]
)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    base = make_base_die()
    order = np.random.default_rng(2026).permutation(len(PLAN))  # shuffle so file id doesn't reveal class
    records = []
    for idx, plan_i in enumerate(order):
        group, note, defs = PLAN[plan_i]
        sid = f"S{idx + 1:02d}"
        rng = np.random.default_rng(1000 + idx)
        img = base.copy()
        taken = []
        defects = []
        for code, zone, size in defs:
            if code == "CHP":
                defects.append(place_chp(img, rng, size))
            elif code == "SCR" and zone == "peripheral":
                defects.append(place_scr_peripheral(img, rng, size))
            elif code == "SCR":
                defects.append(place_scr_core(img, rng, size, cross_pad=(zone == "core-pad")))
            elif code == "CRK":
                defects.append(place_crk(img, rng, size, zone))
            elif code == "CON":
                defects.append(place_con(img, rng, size, zone, taken))
        img = apply_lighting(img, rng)
        fname = f"{sid}.png"
        Image.fromarray(img.astype(np.uint8)).save(OUT / fname, optimize=True)
        verdict = spec.derive_verdict(defects)
        records.append({
            "id": sid, "file": fname, "group": group, "note": note,
            "defects": defects, "referenceVerdict": verdict["verdict"],
            "reasons": verdict["reasons"], "specVersion": spec.SPEC_VERSION,
        })
    ref = {
        "specVersion": spec.SPEC_VERSION,
        "generator": "experiment/generate_samples.py (procedural base die + injected defects, synthetic)",
        "geometry": {"diePx": N, "umPerPx": UM, "sealRingPx": [20, 24], "padSizePx": 16, "padOffsetPx": 40},
        "samples": records,
    }
    (OUT / "reference.json").write_text(json.dumps(ref, ensure_ascii=False, indent=2), encoding="utf-8")
    from collections import Counter
    print(Counter(r["referenceVerdict"] for r in records), Counter(r["group"] for r in records))
    for r in records:
        print(r["id"], r["referenceVerdict"], r["note"])


if __name__ == "__main__":
    main()
