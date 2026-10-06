"""產生評估者訓練用的「缺陷示範圖」（不屬於標準樣本集 S01–S40）。

用 generate_samples.py 同一套畫法與底圖，但換亂數種子與缺陷尺寸，
讓人工評估者在判定前先認得四種缺陷長什麼樣子，而不會先看到測試樣本的答案。

輸出 experiment/examples/：
- E0_無缺陷.png … E4_CON.png：原尺寸影像（1000 px，5 µm/px），可用小畫家練習量測
- 示範圖卡.png：每類一格——整顆縮圖（紅框標位置）＋ 5 倍放大＋判讀重點

Usage: python experiment/make_examples.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import generate_samples as g
import spec_v1 as spec

HERE = Path(__file__).resolve().parent
OUT = HERE / "examples"
FONT_PATH = "C:/Windows/Fonts/msjh.ttc"  # 微軟正黑體（Windows 內建）

# (檔名, 標題, 判讀重點, 缺陷計畫, 放大視窗 px)
EXAMPLES = [
    ("E0_無缺陷", "無缺陷：只有規則的電路方塊與 pad",
     ["電路方塊本身的色塊、橫線紋路都不是缺陷。",
      "實驗中 AI 曾把類比區塊的矩形色塊誤報成污染，判讀時要特別小心。"],
     [], 96),
    ("E1_CHP", "CHP 崩角：晶粒邊緣缺了一塊",
     ["黑色缺口從邊緣往內凹，缺口邊緣有一道亮色的破裂紋。",
      "量「從晶粒邊緣往內最深處」的深度；碰到 seal ring 或進入核心區直接 Fail。"],
     [("CHP", None, 30)], 64),
    ("E2_CRK", "CRK 裂紋：細而曲折的黑線",
     ["比刮傷更黑、更彎折，旁邊帶一點淡灰色亮邊。",
      "只要看到裂紋就是 Fail，不必量長度。"],
     [("CRK", "core", 300)], 110),
    ("E3_SCR", "SCR 刮傷：平順的淡白色細線",
     ["比裂紋直、顏色偏亮白，通常是一條平順的弧線。",
      "量整條長度；注意有沒有經過 pad（米色小方塊），經過 pad 直接 Fail。"],
     [("SCR", "core", 220)], 110),
    ("E4_CON", "CON 污染：一顆圓形小點",
     ["棕色或米白色的小圓點，右下帶陰影、左上有亮點。",
      "量直徑；核心區要數點數，三點以上 Fail。"],
     [("CON", "core", 45)], 48),
]

ZOOM = 5
THUMB = 300
PANEL_W, PANEL_H = 860, 600


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size)


def place(img, rng, code, zone, size):
    if code == "CHP":
        return g.place_chp(img, rng, size)
    if code == "SCR":
        return g.place_scr_core(img, rng, size) if zone == "core" else g.place_scr_peripheral(img, rng, size)
    if code == "CRK":
        return g.place_crk(img, rng, size, zone)
    return g.place_con(img, rng, size, zone, [])


def describe(d: dict) -> str:
    zone = "核心區" if d["zone"] == "core" else "周邊區"
    if d["code"] == "CHP":
        return f"CHP 崩角・{zone}・深度 {d['depthUm']:.0f} µm（約 {d['depthUm'] / spec.UM_PER_PX:.0f} px）"
    if d["code"] == "SCR":
        return f"SCR 刮傷・{zone}・長度 {d['lengthUm']:.0f} µm（約 {d['lengthUm'] / spec.UM_PER_PX:.0f} px）"
    if d["code"] == "CRK":
        return f"CRK 裂紋・{zone}・長度約 {d['lengthUm']:.0f} µm"
    return f"CON 污染・{zone}・直徑 {d['diameterUm']:.0f} µm（約 {d['diameterUm'] / spec.UM_PER_PX:.0f} px）"


def panel(img: np.ndarray, title: str, tips: list[str], defects: list[dict], win: int) -> Image.Image:
    full = Image.fromarray(img.astype(np.uint8))
    p = Image.new("RGB", (PANEL_W, PANEL_H), (243, 245, 248))
    d = ImageDraw.Draw(p)
    d.text((24, 18), title, font=font(26), fill=(16, 19, 28))

    # 整顆縮圖＋紅框
    thumb = full.resize((THUMB, THUMB), Image.LANCZOS)
    p.paste(thumb, (24, 70))
    if defects:
        cx, cy = defects[0]["location"]["x"], defects[0]["location"]["y"]
    else:
        cx, cy = 300, 300  # 無缺陷：放大一塊有電路紋路的區域
    x0 = int(np.clip(cx - win / 2, 0, g.N - win)); y0 = int(np.clip(cy - win / 2, 0, g.N - win))
    s = THUMB / g.N
    d.rectangle([24 + x0 * s, 70 + y0 * s, 24 + (x0 + win) * s, 70 + (y0 + win) * s], outline=(200, 30, 60), width=3)
    d.text((24, 70 + THUMB + 8), "整顆晶粒（5 mm），紅框＝放大位置", font=font(15), fill=(60, 66, 85))

    # 5 倍放大（最近鄰，看得到像素）
    crop = full.crop((x0, y0, x0 + win, y0 + win)).resize((win * ZOOM, win * ZOOM), Image.NEAREST)
    side = 470
    crop = crop.resize((side, side), Image.NEAREST)
    zx, zy = 360, 70
    p.paste(crop, (zx, zy))
    d.rectangle([zx, zy, zx + side, zy + side], outline=(200, 30, 60), width=3)
    # 比例尺：10 px = 50 µm
    bar = 10 * side / win
    d.rectangle([zx + 16, zy + side - 28, zx + 16 + bar, zy + side - 22], fill=(255, 255, 255))
    d.text((zx + 22 + bar, zy + side - 36), "10 px＝50 µm", font=font(15), fill=(255, 255, 255))
    d.text((zx, zy + side + 8), f"放大約 {side / win:.1f} 倍", font=font(15), fill=(60, 66, 85))

    # 判讀重點與標註
    ty = 70 + THUMB + 44
    for line in ([describe(x) for x in defects] or ["標準答案：無缺陷 → Pass"]):
        d.text((24, ty), line, font=font(16), fill=(35, 116, 74) if not defects else (156, 28, 76))
        ty += 26
    if defects:
        v = spec.derive_verdict(defects)
        d.text((24, ty), f"規則推導：{v['verdict']}", font=font(16), fill=(16, 19, 28)); ty += 30
    for tip in tips:
        for line in wrap(tip, font(15), 312):
            d.text((24, ty), line, font=font(15), fill=(59, 66, 85)); ty += 22
        ty += 4
    return p


def wrap(text: str, f: ImageFont.FreeTypeFont, width: int) -> list[str]:
    """依實際字寬換行；英數字詞不拆開，標點不放行首。"""
    import re
    tokens = re.findall(r"[A-Za-z0-9.µ%]+|\s+|.", text)
    lines, cur = [], ""
    for tok in tokens:
        if cur and f.getlength(cur + tok) > width and tok not in "，。、；：）":
            lines.append(cur.rstrip()); cur = tok.lstrip()
        else:
            cur += tok
    if cur:
        lines.append(cur)
    return lines


PERI = (216, 155, 18)    # 周邊區：金
RING = (180, 35, 90)     # seal ring：紅紫
CORE = (53, 82, 214)     # 核心區：藍


def zone_overlay(size: int, scale: float, x0: int = 0, y0: int = 0) -> Image.Image:
    """在 size×size 的畫布上畫出區域色塊；座標以原圖 px 計、乘 scale、減去 (x0, y0)。"""
    ov = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    t = lambda v: v * scale  # noqa: E731
    n, a, b = g.N, spec.SEAL_RING_OUTER_PX, spec.SEAL_RING_INNER_PX
    box = lambda m: [t(m - x0), t(m - y0), t(n - m - x0), t(n - m - y0)]  # noqa: E731
    d.rectangle(box(0), fill=PERI + (120,))
    d.rectangle(box(a), fill=RING + (235,))
    d.rectangle(box(b), fill=CORE + (60,))
    for (px0, py0, px1, py1) in g.PADS:
        d.rectangle([t(px0 - x0), t(py0 - y0), t(px1 - x0), t(py1 - y0)], outline=(255, 255, 255, 255), width=max(1, int(scale)))
    return ov


def zone_map(img: np.ndarray) -> Image.Image:
    W, H = 1220, 900
    p = Image.new("RGB", (W, H), (243, 245, 248))
    d = ImageDraw.Draw(p)
    d.text((24, 18), "檢驗區域怎麼分：從晶粒邊緣往內量距離", font=font(28), fill=(16, 19, 28))
    full = Image.fromarray(img.astype(np.uint8)).convert("RGBA")

    # 左：整顆晶粒塗色
    S = 560
    left = full.resize((S, S), Image.LANCZOS)
    left = Image.alpha_composite(left, zone_overlay(S, S / g.N))
    p.paste(left.convert("RGB"), (24, 76))
    zx0, zy0, win = 150, 0, 96  # 放大上緣一段
    s = S / g.N
    d.rectangle([24 + zx0 * s, 76 + zy0 * s, 24 + (zx0 + win) * s, 76 + (zy0 + win) * s], outline=(16, 19, 28), width=3)
    d.text((24, 76 + S + 8), "整顆晶粒 5 mm × 5 mm（1000 px）；黑框＝右邊放大的位置", font=font(16), fill=(60, 66, 85))

    # 右：上緣放大（每格像素看得見）＋刻度
    Z = 480
    zs = Z / win
    crop = full.crop((zx0, zy0, zx0 + win, zy0 + win)).resize((Z, Z), Image.NEAREST)
    crop = Image.alpha_composite(crop, zone_overlay(Z, zs, zx0, zy0))
    rx, ry = 620, 76
    p.paste(crop.convert("RGB"), (rx, ry))
    d.rectangle([rx, ry, rx + Z, ry + Z], outline=(16, 19, 28), width=3)
    d.text((rx, ry - 26), "↑ 晶粒邊緣（上緣放大 5 倍）", font=font(16), fill=(16, 19, 28))
    for v, label in [(0, "0"), (20, "20 px"), (24, "24 px"), (40, "40 px"), (56, "56 px")]:
        yy = ry + v * zs
        d.line([rx + Z, yy, rx + Z + 14, yy], fill=(16, 19, 28), width=2)
        d.text((rx + Z + 18, yy - 10), label, font=font(14), fill=(16, 19, 28))
    # 區域標籤（放在放大圖內側）
    tag = lambda y, text, col: d.text((rx + 12, ry + y), text, font=font(17), fill=col, stroke_width=3, stroke_fill=(255, 255, 255))  # noqa: E731
    tag(20 * zs / 2 - 12, "周邊區 0–20 px", (120, 80, 0))
    tag(24 * zs + 8, "核心區（超過 24 px）", (20, 40, 150))
    tag(48 * zs - 10, "pad（40–56 px，屬核心區）", (16, 19, 28))
    d.text((rx, ry + Z + 8), "紅紫細帶＝seal ring（20–24 px）", font=font(16), fill=RING)

    # 下：圖例與規則
    ly = 76 + S + 50
    items = [
        (PERI, "周邊區：距晶粒邊緣 0–20 px（0–100 µm）"),
        (RING, "seal ring：距邊緣 20–24 px（100–120 µm），保護環"),
        (CORE, "核心區：距邊緣超過 24 px（超過 120 µm）；pad 在 40–56 px，屬於核心區"),
    ]
    for k, (col, text) in enumerate(items):
        y = ly + k * 30
        d.rectangle([24, y + 3, 44, y + 21], fill=col)
        d.text((54, y), text, font=font(17), fill=(16, 19, 28))
    ny = ly + len(items) * 30 + 8
    for text in ["缺陷屬於哪一區，看它「最深入晶粒的那一點」離邊緣多遠（用小畫家看座標：x 或 y 離最近的邊有幾 px）。",
                 "CHP 崩角只要碰到 seal ring（深入 20 px 以上）就判 Fail；進入核心區也一律 Fail。"]:
        for line in wrap(text, font(16), W - 60):
            d.text((24, ny), line, font=font(16), fill=(59, 66, 85)); ny += 24
    return p


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    base = g.make_base_die()
    panels = []
    for k, (name, title, tips, plan, win) in enumerate(EXAMPLES):
        rng = np.random.default_rng(9000 + k)  # 與 S01–S40（1000+idx）不同的種子
        img = base.copy()
        defects = [place(img, rng, *item) for item in plan]
        img = g.apply_lighting(img, rng)
        raw = OUT / f"{name}.png"
        if not raw.exists():  # 固定種子、內容不變；已存在就不重寫（可能正被小畫家開著）
            Image.fromarray(img.astype(np.uint8)).save(raw, optimize=True)
        panels.append(panel(img, title, tips, defects, win))
        if not plan:
            zone_map(img).save(OUT / "區域分布圖.png", optimize=True)
        print(name, [describe(x) for x in defects])
    sheet = Image.new("RGB", (PANEL_W, PANEL_H * len(panels)), (255, 255, 255))
    for i, pn in enumerate(panels):
        sheet.paste(pn, (0, i * PANEL_H))
    try:
        sheet.save(OUT / "示範圖卡.png", optimize=True)
        print("wrote", OUT / "示範圖卡.png")
    except OSError:
        print("skip 示範圖卡.png（檔案正被開啟，關閉後重跑即可更新）")


if __name__ == "__main__":
    main()
