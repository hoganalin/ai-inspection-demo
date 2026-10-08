# -*- coding: utf-8 -*-
"""產生「導入計畫」Excel 工作簿（晶粒外觀檢查改善專案，模擬情境）。

用法：
    python build_rollout_plan.py
需要 openpyxl。輸出：同資料夾下的 導入計畫.xlsx
用詞依專案根目錄 CONTEXT.md。
"""
from __future__ import annotations

import copy
import datetime as dt
import re
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT = Path(__file__).with_name("導入計畫.xlsx")

FONT = "微軟正黑體"
PROJECT_START = dt.date(2026, 11, 2)  # W1 週一
N_WEEKS = 33  # 原 26 週；② v1 未通過 Gate，加入規範 v2 與 ② 重跑後順延 7 週
EXP = "experiment/results/msa-summary.md"  # 一致性分析數據來源（模擬）

# ---------- 色票 ----------
NAVY = "1F3864"
GREY_HDR = "D9E1F2"
LIGHT = "F2F2F2"
PHASE_COLORS = {  # (Gantt 實色, 列底淺色)
    "①": ("4472C4", "DDEBF7"),
    "②": ("70AD47", "E2EFDA"),
    "③": ("ED7D31", "FCE4D6"),
    "④": ("7030A0", "E4DFEC"),
}
GATE_COLOR = "C00000"

thin = Side(style="thin", color="A6A6A6")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
WRAP = Alignment(wrap_text=True, vertical="center")
WRAP_TOP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)


def fill(hex_):
    return PatternFill("solid", start_color=hex_, end_color=hex_)


def title(ws, text, sub=None, span=10):
    ws["A1"] = text
    ws["A1"].font = Font(name=FONT, size=16, bold=True, color=NAVY)
    ws.row_dimensions[1].height = 28
    if sub:
        ws["A2"] = sub
        ws["A2"].font = Font(name=FONT, size=9, italic=True, color="7F7F7F")


def header_row(ws, row, headers, col=1, color=NAVY):
    for i, h in enumerate(headers):
        c = ws.cell(row=row, column=col + i, value=h)
        c.font = Font(name=FONT, bold=True, color="FFFFFF", size=10)
        c.fill = fill(color)
        c.alignment = CENTER
        c.border = BORDER
    ws.row_dimensions[row].height = 32


def body_cell(ws, row, col, value, align=WRAP, bold=False, color=None, bg=None):
    c = ws.cell(row=row, column=col, value=value)
    c.font = Font(name=FONT, size=10, bold=bold, color=color)
    c.alignment = align
    c.border = BORDER
    if bg:
        c.fill = fill(bg)
    return c


def section(ws, row, text, span):
    c = ws.cell(row=row, column=1, value=text)
    c.font = Font(name=FONT, size=12, bold=True, color="FFFFFF")
    c.fill = fill(NAVY)
    c.alignment = Alignment(vertical="center")
    for col in range(2, span + 1):
        ws.cell(row=row, column=col).fill = fill(NAVY)
    ws.row_dimensions[row].height = 22


def widths(ws, ws_widths):
    for k, v in ws_widths.items():
        ws.column_dimensions[k].width = v


def print_setup(ws, title_rows=None, paper="A4", fit_tall=False):
    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize = ws.PAPERSIZE_A3 if paper == "A3" else ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1 if fit_tall else 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.page_margins.top = ws.page_margins.bottom = 0.5
    ws.oddFooter.center.text = "&A　第 &P / &N 頁"
    ws.oddFooter.right.text = "模擬情境・非實際導入紀錄"
    if title_rows:
        ws.print_title_rows = title_rows


# =====================================================================
# 0. 封面
# =====================================================================
def build_cover(wb):
    ws = wb.active
    ws.title = "封面"
    ws.sheet_view.showGridLines = False
    widths(ws, {"A": 3, "B": 28, "C": 70, "D": 26})

    ws["B2"] = "晶粒外觀檢查改善專案"
    ws["B2"].font = Font(name=FONT, size=20, bold=True, color=NAVY)
    ws["B3"] = "導入計畫（Rollout Plan）"
    ws["B3"].font = Font(name=FONT, size=14, bold=True, color="404040")
    ws.row_dimensions[2].height = 34
    ws.row_dimensions[3].height = 24

    # 揭露聲明
    ws.merge_cells("B5:D7")
    c = ws["B5"]
    c.value = (
        "⚠ 本文件為「模擬情境」之導入計畫，非實際產線導入紀錄。\n"
        "・情境、數據與組織皆為假設；痛點來源為作者過去的目檢經驗（產線有檢驗規範，但判讀靠人眼）；人工基準線為作者本人照規範判兩輪（79 筆，真實）。\n"
        "・導入階段 ② PoC 已於模擬情境以檢驗規範 v1 執行（40 張半合成影像、3 位模擬 AI 評估者）："
        "結果「未通過」Gate ②→③（漏判率 37.0%，目標 ≤ 5%；改善後重複性 77.5%，目標 ≥ 90%）。\n"
        "・規範 v2 已於作品中重跑一次（2026-10-07，同樣本、同評估者、240 筆）：漏判率 0%、重複性 92.5%、人工複判率 25.8% 達標；評估者間一致率 82.5%、誤判率 7.6% 未達，預警提早尚未以 v2 重驗 → Gate ②→③（v2）尚未通過。③ 單線試行、④ 擴線與 MES 介接仍為「規劃」。"
        f"數據出處：{EXP}"
    )
    c.font = Font(name=FONT, size=10.5, bold=True, color="9C0006")
    c.fill = fill("FFF2CC")
    c.alignment = WRAP_TOP
    for r in range(5, 8):
        for col in range(2, 5):
            ws.cell(row=r, column=col).border = Border(
                left=Side(style="medium", color="BF8F00") if col == 2 else None,
                right=Side(style="medium", color="BF8F00") if col == 4 else None,
                top=Side(style="medium", color="BF8F00") if r == 5 else None,
                bottom=Side(style="medium", color="BF8F00") if r == 7 else None,
            )
    for r in (5, 6, 7):
        ws.row_dimensions[r].height = 34

    r = 9
    header_row(ws, r, ["文件資訊", "內容"], col=2)
    meta = [
        ("文件編號", "PRJ-DVI-RP-001"),
        ("版本", "v0.5（草案）"),
        ("建立日期", dt.date(2026, 10, 5)),
        ("撰寫人", "專案專員（作者）"),
        ("適用站點", "封裝段 晶粒外觀檢查站（Die Sorter 挑揀後 AOI 複判）"),
        ("專案期間（規劃）", f"{PROJECT_START:%Y-%m-%d} 起，共 {N_WEEKS} 週（約 7.5 個月；原 26 週，因 ② 重跑順延 7 週）"),
        ("相關文件", f"CONTEXT.md（用詞）、docs/spec/inspection-spec-v1.md（檢驗規範 v1）、docs/adr/0001、0002、{EXP}（一致性分析結果）"),
    ]
    for i, (k, v) in enumerate(meta, start=1):
        body_cell(ws, r + i, 2, k, bold=True, bg=GREY_HDR)
        cc = body_cell(ws, r + i, 3, v)
        if isinstance(v, dt.date):
            cc.number_format = "yyyy-mm-dd"
            cc.alignment = Alignment(horizontal="left", vertical="center")
    r = r + len(meta) + 2

    header_row(ws, r, ["導入階段", "內容", "作品執行狀態"], col=2)
    phases = [
        ("① 現況 MSA 與規範制定", "盤點現行人工目檢、建立標準樣本集與基準線、發行檢驗規範", "模擬示範（規範 v1、人工基準線：作者照規範判兩輪）"),
        ("② PoC 驗證", "AI 辨識缺陷分類＋規則推導判定；一致性分析、p 管制圖預警。v1 漏判率 37.0%（CHP 偵出率 14.8%、CRK 0%、尺寸系統偏差）→ 規範 v2 重跑：漏判率 0%、重複性 92.5%，但誤判率 7.6%", "v1 未通過 Gate；v2 已重跑・Gate 未通過"),
        ("③ 單線試行（與人工並行比對）", "單一產線 AI 判定與人工目檢並行，不影響放行", "規劃・未執行"),
        ("④ 擴線與 MES 介接", "機台差異驗證、規範文管、判定結果上拋 MES", "規劃・未執行"),
    ]
    status_colors = {"未通過": "FFC7CE", "已完成": "C6EFCE", "模擬": "DDEBF7", "規劃": "F2F2F2"}
    for i, (p, d, s) in enumerate(phases, start=1):
        body_cell(ws, r + i, 2, p, bold=True, bg=PHASE_COLORS["①②③④"[i - 1]][1])
        body_cell(ws, r + i, 3, d)
        bg = next(v for k, v in status_colors.items() if k in s)
        body_cell(ws, r + i, 4, s, align=CENTER, bold=True, bg=bg)
        ws.row_dimensions[r + i].height = 30
    r = r + len(phases) + 2

    header_row(ws, r, ["工作表", "用途"], col=2)
    toc = [
        ("專案章程", "背景痛點、目標 KPI、範圍與不做什麼、主要假設、專案成員與角色"),
        ("時程表", "四導入階段 WBS、前置任務、Gate 標準與週別甘特圖（條件式格式自動著色）"),
        ("RACI", "各單位於關鍵活動之 R / A / C / I 分工，含每列唯一 A 檢核"),
        ("風險清單", "風險值＝機率×影響（公式）、等級、觸發指標、對策與負責單位"),
        ("週會追蹤表", "卡關項目、負責人、預計交付日、狀態與升級層級（下拉選單）"),
    ]
    for i, (s, d) in enumerate(toc, start=1):
        cc = body_cell(ws, r + i, 2, s, bold=True, color="0563C1")
        cc.hyperlink = f"#'{s}'!A1"
        cc.font = Font(name=FONT, size=10, bold=True, color="0563C1", underline="single")
        body_cell(ws, r + i, 3, d)
    r = r + len(toc) + 2

    header_row(ws, r, ["修訂日期", "修訂內容", "版本"], col=2)
    body_cell(ws, r + 1, 2, dt.date(2026, 10, 5)).number_format = "yyyy-mm-dd"
    body_cell(ws, r + 1, 3, "初版：依 PoC（模擬情境）結果擬定導入計畫草案")
    body_cell(ws, r + 1, 4, "v0.1", align=CENTER)
    body_cell(ws, r + 2, 2, dt.date(2026, 10, 5)).number_format = "yyyy-mm-dd"
    body_cell(ws, r + 2, 3, "回填一致性分析（模擬）結果；② v1 未通過 Gate，新增規範 v2 修訂與 ② 重跑，③④ 順延 7 週；風險與週會追蹤表同步更新")
    body_cell(ws, r + 2, 4, "v0.2", align=CENTER)
    ws.row_dimensions[r + 2].height = 30
    body_cell(ws, r + 3, 2, dt.date(2026, 10, 6)).number_format = "yyyy-mm-dd"
    body_cell(ws, r + 3, 3, "回填 v1 第 2 次判定（補跑 169 次）：改善後重複性 77.5%，未達 ≥ 90% 門檻；KPI、Gate 紀錄、風險 R01／R12 與週會追蹤表同步更新")
    body_cell(ws, r + 3, 4, "v0.3", align=CENTER)
    ws.row_dimensions[r + 3].height = 30
    body_cell(ws, r + 4, 2, dt.date(2026, 10, 7)).number_format = "yyyy-mm-dd"
    body_cell(ws, r + 4, 3, "回填規範 v2 重跑結果（240 次、US$9.55）：漏判率 0%、重複性 92.5%、人工複判率 25.8% 達標；評估者間一致率 82.5%、誤判率 7.6% 未達，Gate（v2）未通過；新增 v2.1 對策")
    body_cell(ws, r + 4, 4, "v0.4", align=CENTER)
    ws.row_dimensions[r + 4].height = 30
    body_cell(ws, r + 5, 2, dt.date(2026, 10, 8)).number_format = "yyyy-mm-dd"
    body_cell(ws, r + 5, 3, "定位調整：痛點改為「有規範但判讀靠人眼」；KPI 基準線改為人眼＋規範（作者本人兩輪），新增每顆判讀時間（34.9 秒 → AI 8.2 秒）；任務 1.5 改為依現行規範的人工一致性分析")
    body_cell(ws, r + 5, 4, "v0.5", align=CENTER)
    ws.row_dimensions[r + 5].height = 30
    print_setup(ws, fit_tall=True)


# =====================================================================
# 1. 專案章程
# =====================================================================
def build_charter(wb):
    ws = wb.create_sheet("專案章程")
    ws.sheet_view.showGridLines = False
    widths(ws, {"A": 22, "B": 34, "C": 22, "D": 22, "E": 30, "F": 26})
    span = 6
    title(ws, "專案章程｜晶粒外觀檢查 AI 輔助判定導入", f"模擬情境；用詞依 CONTEXT.md。KPI 實測值出自 {EXP}（40 張半合成影像、3 位模擬 AI 評估者，每條件 120 筆判定）。")

    r = 4
    section(ws, r, "1. 專案基本資料", span)
    basics = [
        ("專案名稱", "晶粒外觀檢查改善專案（AI 輔助判定導入）"),
        ("專案發起人", "製造處 處長（假設）"),
        ("專案經理", "智慧製造專案專員"),
        ("改善站點", "封裝段 晶粒外觀檢查站（Die Sorter 挑揀後 AOI 複判之人工目檢）"),
        ("專案期間", f"{PROJECT_START:%Y-%m-%d} ～ {PROJECT_START + dt.timedelta(weeks=N_WEEKS) - dt.timedelta(days=3):%Y-%m-%d}（{N_WEEKS} 週）"),
        ("專案類型", "製程品質改善／智慧製造（PDCA）"),
    ]
    for i, (k, v) in enumerate(basics, start=1):
        body_cell(ws, r + i, 1, k, bold=True, bg=GREY_HDR)
        ws.merge_cells(start_row=r + i, start_column=2, end_row=r + i, end_column=span)
        body_cell(ws, r + i, 2, v)
        for col in range(3, span + 1):
            ws.cell(row=r + i, column=col).border = BORDER
    r += len(basics) + 2

    section(ws, r, "2. 背景與痛點", span)
    pains = [
        ("判讀靠人眼、速度慢", "產線有檢驗規範，但每顆都要人眼找缺陷、量尺寸、對條文；作者照規範實測每顆 34.9 秒，檢驗站產能受限於人力。"),
        ("小缺陷漏看、量測因人而異", "人會疲勞，微小崩角、裂紋易漏看；門檻附近的量測不同人、不同次結果不同（作者照規範判兩輪：漏判率 23.5%、重複性 87.2%）。"),
        ("判定依據不可追溯", "人工目檢僅記錄 Pass/Fail，缺陷分類與尺寸未結構化，客訴時無法回答「為什麼放行」。"),
        ("異常發現滯後", "批不良率多於超出 UCL 或客退後才被注意，缺少趨勢型預警；處置依賴值班工程師個人經驗。"),
        ("數據無法彙總", "缺陷描述為自由文字，無法做缺陷分類柏拉圖與跨批趨勢分析。"),
    ]
    header_row(ws, r + 1, ["痛點", "現況描述"], col=1)
    ws.merge_cells(start_row=r + 1, start_column=2, end_row=r + 1, end_column=span)
    for i, (k, v) in enumerate(pains, start=2):
        body_cell(ws, r + i, 1, k, bold=True)
        ws.merge_cells(start_row=r + i, start_column=2, end_row=r + i, end_column=span)
        body_cell(ws, r + i, 2, v)
        for col in range(3, span + 1):
            ws.cell(row=r + i, column=col).border = BORDER
        ws.row_dimensions[r + i].height = 30
    r += len(pains) + 3

    section(ws, r, "3. 目標 KPI", span)
    header_row(ws, r + 1, ["指標", "定義", "基準線\n（人眼＋規範：作者實測）", "PoC 實測\n（規範 v1 → v2）", "目標（Gate 門檻）", "量測方式／資料來源"])
    # (指標, 定義, 基準線, 實測, 實測是否達標 True/False/None, 目標, 量測方式)
    kpis = [
        ("每顆判讀時間", "每顆晶粒完成判定所需時間（AI 為回應時間，不含取像）", "34.9 秒（作者實測）", "v2：8.2 秒\n比人工快約 4 倍", True, "≤ 人工判讀時間", "計時；試行期並行比對"),
        ("漏判率", "應 Fail 卻放行之比例", "23.5%（4/17）", "37.0% → 0.0%（0/27）\nv2 達標", True, "≤ 5%", "一致性分析；試行期並行比對"),
        ("重複性", "同一評估者對同一樣本兩次判定一致之比例", "87.2%（39 組配對）", "77.5% → 92.5%（120 組配對）\nv2 達標", True, "≥ 90%", "一致性分析（≥ 2 次判定）"),
        ("人工複判率", "判定 Warning 送人工複判之比例", "25.3%", "23.3% → 25.8%（標準答案 22.5%）\nv2 達標", True, "≤ 30%（規範 v2 提案門檻）", "一致性分析；試行線週別統計"),
        ("評估者間一致率（再現性）", "三位評估者判定相同之樣本比例", "—（人工組僅 1 人）", "60.0% → 82.5%\nv2 未達標", False, "≥ 90%", "一致性分析（計數值 MSA）"),
        ("對標準答案一致率", "判定與標準答案相符之比例（逐筆）", "70.9%", "60.8% → 75.8%\nv2 未達標", False, "≥ 90%", "一致性分析"),
        ("誤判率", "應 Pass 卻退件之比例", "2.3%（1/43）", "3.0% → 7.6%（5/66）\nv2 未達標", False, "≤ 3%（假設值，待 QA 核定）", "一致性分析；試行期並行比對"),
        ("異常提早發現批數", "首次預警批 較 首次超出 UCL 批 提早之批數", "0 批（超出 UCL 才處理）", "v1：0 批（L24 預警＝異常；完美判定亦未提早）\nv2：尚未重新驗證", False, "提早 ≥ 2 批", "p 管制圖判異規則（25 批漂移情境模擬）"),
        ("異常處置單確認時效", "預警觸發至處置單經人確認送出之時間", "未量測", "未量測（PoC 未實作）", None, "≤ 4 小時（假設值）", "系統時間戳記"),
    ]
    for i, (name, dfn, base, meas, ok, tgt, how) in enumerate(kpis, start=2):
        rr = r + i
        body_cell(ws, rr, 1, name, bold=True)
        body_cell(ws, rr, 2, dfn)
        body_cell(ws, rr, 3, base, align=CENTER)
        mc = body_cell(ws, rr, 4, meas, align=CENTER, bold=ok is not None)
        if ok is False:
            mc.fill = fill("FFC7CE"); mc.font = Font(name=FONT, size=10, bold=True, color="9C0006")
        elif ok is True:
            mc.fill = fill("C6EFCE"); mc.font = Font(name=FONT, size=10, bold=True, color="006100")
        body_cell(ws, rr, 5, tgt, align=CENTER, bold=True)
        body_cell(ws, rr, 6, how)
        ws.row_dimensions[rr].height = 48
    r += len(kpis) + 2
    kpi_notes = [
        "判讀（照實）：規範 v1 的 AI 漏判率 37.0%，比人工 23.5% 還高，② Gate（v1）未通過；規範 v2 重跑後 AI 每顆 8.2 秒（人工 34.9 秒）、漏判率 0%、重複性 92.5%、人工複判率 25.8% 達標，但評估者間一致率 82.5%、誤判率 7.6%（人工 2.3%）未達，預警提早尚未重驗 → Gate（v2）尚未通過。",
        "・基準線為作者本人照規範判兩輪（79 筆，真實），只有一人且為規範撰寫者；試行期須以 3 位檢驗員重測。另一對照：只給 AI 口述標準時評估者間一致率 57.5%、人工複判率 42.5%，說明 AI 必須搭配規則。",
        "・漏判主因是 AI「看不到」：CHP 偵出率 14.8%、CRK 0%；尺寸量測有系統性偏差（CHP 深度 −65%、CON 直徑 −57%、SCR 長度 +47%）。",
        "・Fleiss' kappa 0.43 → 0.39（v1）→ 0.82（v2）；樣本少（每類 Fail 2–3 張），v1 漏判 10/27 之 95% 信賴區間約 22–56%，v2 漏判 0/27 之上界約 13%。",
        "・規範 v2（邊緣分塊放大檢查、以框選範圍換算尺寸、不確定一律送人工複判）已執行；新問題是 AI 框選過鬆、尺寸高估（CHP 深度 +147%），5 筆誤判全來自 S24、S31 兩張好晶粒。",
        "・下一輪 v2.1：程式在框內找缺陷實際邊緣再量測、量測值落在門檻 ±10% 內送人工複判、以 v2 實測誤差重跑管制圖模擬（時程表 2.11）。",
    ]
    for k, t in enumerate(kpi_notes):
        ws.merge_cells(start_row=r + k, start_column=1, end_row=r + k, end_column=span)
        c = ws.cell(row=r + k, column=1, value=t)
        c.font = Font(name=FONT, size=9.5, bold=(k == 0), color="9C0006" if k == 0 else "404040")
        c.alignment = Alignment(wrap_text=True, vertical="center")
        ws.row_dimensions[r + k].height = 18
    r += len(kpi_notes) + 2

    section(ws, r, "4. 範圍", span)
    scope_in = [
        "僅限封裝段「晶粒外觀檢查站」；試行階段僅一條產線、一台取像站",
        "缺陷分類依檢驗規範：CHP 崩角、CRK 裂紋、SCR 刮傷、CON 污染（後續版本可擴充）",
        "AI 僅辨識缺陷分類、尺寸與檢驗區域；判定由系統依允收標準推導並記錄規範版本（ADR-0001）",
        "判定 Warning 送人工複判之流程與紀錄",
        "批不良率 p 管制圖、判異規則預警、AI 草擬異常處置單（經人確認後送出）",
        "④ 階段：判定結果、缺陷代碼、規範版本與批號上拋 MES",
    ]
    scope_out = [
        "不取代既有 AOI 機台或 Die Sorter；不改機台程式",
        "不擴及其他站點（晶圓前段、Bump、Wire bond、成品外觀）",
        "不由 AI 直接給出判定，不讓 AI 自動放行或退件",
        "不自行訓練／標註深度學習模型（若 ③ 結果需要，另案評估）",
        "不修改客戶出貨規格；檢驗規範僅能等於或嚴於客戶規格",
        "不由系統自動 Hold 批（MES Hold 仍由人依異常處置單執行）",
        "不作為作業員績效考核依據",
    ]
    header_row(ws, r + 1, ["範圍內（In Scope）", "", "", "不做什麼（Out of Scope）", "", ""])
    ws.merge_cells(start_row=r + 1, start_column=1, end_row=r + 1, end_column=3)
    ws.merge_cells(start_row=r + 1, start_column=4, end_row=r + 1, end_column=6)
    for i in range(max(len(scope_in), len(scope_out))):
        rr = r + 2 + i
        ws.merge_cells(start_row=rr, start_column=1, end_row=rr, end_column=3)
        ws.merge_cells(start_row=rr, start_column=4, end_row=rr, end_column=6)
        body_cell(ws, rr, 1, f"・{scope_in[i]}" if i < len(scope_in) else None)
        body_cell(ws, rr, 4, f"✕ {scope_out[i]}" if i < len(scope_out) else None)
        for col in (2, 3, 5, 6):
            ws.cell(row=rr, column=col).border = BORDER
        ws.row_dimensions[rr].height = 30
    r += max(len(scope_in), len(scope_out)) + 3

    section(ws, r, "5. 主要假設與限制", span)
    assumptions = [
        ("A1", "試行線可加裝固定光源治具與取像站，影像解析度可達 5 µm/px（檢驗規範 v1 換算基準）"),
        ("A2", "QA 可自產線挑選標準樣本並經量測確認標準答案；稀少缺陷（如 CRK）收集期可能延長"),
        ("A3", "資安單位核可影像送外部 AI 服務（去識別化後）或核撥地端方案預算"),
        ("A4", "③ 試行期間人工目檢照常執行，AI 判定不影響放行，僅作並行比對"),
        ("A5", "IT/MES 於第 19 週起可投入介接規格與開發資源（約 7 週）"),
        ("A6", "PoC 之一致性分析以半合成樣本與模擬評估者完成（ADR-0002）；實際導入須以產線樣本與真人作業員重做"),
        ("A7", "規範 v2 重跑之 API 預算可獲核准（v2 已於作品中重跑：實際 US$9.55／240 次呼叫，原估 US$3–4 低估；v1 第 2 次判定補跑 US$1.17）"),
    ]
    header_row(ws, r + 1, ["編號", "假設內容", "", "", "", "驗證時點"])
    ws.merge_cells(start_row=r + 1, start_column=2, end_row=r + 1, end_column=5)
    checks = ["W3 取像條件定義", "W4 樣本收集", "W5 資安評估", "W19 試行啟動", "W19 介接規格", "① 階段 MSA", "W14 預算核准"]
    for i, (k, v) in enumerate(assumptions, start=2):
        body_cell(ws, r + i, 1, k, align=CENTER, bold=True)
        ws.merge_cells(start_row=r + i, start_column=2, end_row=r + i, end_column=5)
        body_cell(ws, r + i, 2, v)
        for col in (3, 4, 5):
            ws.cell(row=r + i, column=col).border = BORDER
        body_cell(ws, r + i, 6, checks[i - 2], align=CENTER)
        ws.row_dimensions[r + i].height = 30
    r += len(assumptions) + 3

    section(ws, r, "6. 專案成員與角色", span)
    header_row(ws, r + 1, ["角色", "單位", "主要職責", "", "投入比例（預估）", "備註"])
    ws.merge_cells(start_row=r + 1, start_column=3, end_row=r + 1, end_column=4)
    members = [
        ("專案發起人", "製造處", "核定章程與資源、Gate 審查最終簽核、跨部門議題裁決", "5%", "跨部門主管會議主席"),
        ("專案經理（專案專員）", "智慧製造", "時程與週會追蹤、PoC 建置、一致性分析、風險與升級管理", "80%", "本文件撰寫人"),
        ("品質代表", "QA/品保", "標準樣本與標準答案、檢驗規範審查與發行、漏判風險把關", "30%", "規範 Owner"),
        ("製程代表", "製程工程", "允收標準技術依據、p 管制圖判異規則、異常處置單內容", "20%", ""),
        ("設備代表", "設備工程", "光源治具與取像站、µm/px 校正、機台差異驗證", "20%", "治具請購協同採購"),
        ("系統代表", "IT/MES", "資安評估、PoC 環境、MES 介接開發與上線", "20%（④ 階段 50%）", ""),
        ("產線代表", "生產/製造", "目檢站作業員調度、並行比對執行、人工複判紀錄", "15%", "目檢站班長"),
        ("生管代表", "生管", "試行期產能與人力影響評估、批排程配合", "10%", ""),
    ]
    for i, row in enumerate(members, start=2):
        rr = r + i
        body_cell(ws, rr, 1, row[0], bold=True)
        body_cell(ws, rr, 2, row[1], align=CENTER)
        ws.merge_cells(start_row=rr, start_column=3, end_row=rr, end_column=4)
        body_cell(ws, rr, 3, row[2])
        ws.cell(row=rr, column=4).border = BORDER
        body_cell(ws, rr, 5, row[3], align=CENTER)
        body_cell(ws, rr, 6, row[4])
        ws.row_dimensions[rr].height = 30
    r += len(members) + 3

    section(ws, r, "7. 簽核", span)
    header_row(ws, r + 1, ["簽核角色", "單位", "姓名", "日期", "意見", ""])
    ws.merge_cells(start_row=r + 1, start_column=5, end_row=r + 1, end_column=6)
    for i, (k, u) in enumerate([("專案發起人", "製造處"), ("品質主管", "QA/品保"), ("專案經理", "智慧製造")], start=2):
        body_cell(ws, r + i, 1, k, bold=True)
        body_cell(ws, r + i, 2, u, align=CENTER)
        for col in range(3, 7):
            body_cell(ws, r + i, col, None)
        ws.merge_cells(start_row=r + i, start_column=5, end_row=r + i, end_column=6)
        ws.row_dimensions[r + i].height = 26

    ws.freeze_panes = "A4"
    print_setup(ws)


# =====================================================================
# 2. 時程表
# =====================================================================
# (WBS, 階段, 任務, 類型, 負責單位, 開始週, 週數, 前置任務, 交付物/Gate 標準)
TASKS = [
    ("1.1", "①", "專案啟動會議、章程與 KPI 簽核", "任務", "專案專員", 1, 1, "—", "專案章程 v1.0 簽核"),
    ("1.2", "①", "現行人工目檢流程盤點（站點、班別、OI、判定紀錄方式）", "任務", "生產/製造", 2, 2, "1.1", "現況流程圖、判定紀錄樣本"),
    ("1.3", "①", "QA 自產線挑選標準樣本並量測確認標準答案（≥ 50 顆，含邊界樣本）", "任務", "QA/品保", 2, 3, "1.1", "標準樣本集清單＋標準答案（含缺陷分類、尺寸、檢驗區域）"),
    ("1.4", "①", "缺陷分類表與允收標準草案（對齊客戶規格）", "任務", "QA/品保", 4, 2, "1.2", "檢驗規範草案"),
    ("1.5", "①", "現況人工判讀一致性分析（3 位檢驗員 × 2 輪，依現行規範）", "任務", "QA/品保", 5, 1, "1.3", "人工基準線。PoC 以作者本人照規範判兩輪示範（79 筆）：每顆 34.9 秒、漏判率 23.5%、對標準答案一致率 70.9%、重複性 87.2%、誤判率 2.3%（實際導入須以 3 位檢驗員重測）"),
    ("1.6", "①", "影像擷取條件定義（光源、倍率、5 µm/px 校正）＋光源治具請購", "任務", "設備工程", 3, 3, "1.1", "取像條件規格書、治具請購單"),
    ("1.7", "①", "Gate ①→②：規範審查會議與檢驗規範 v1 發行", "Gate", "專案專員", 6, 1, "1.4, 1.5", "Gate 標準：檢驗規範 v1 經 QA/製程/製造簽核發行；現況 MSA 基準線建立；標準樣本集經 QA 簽核"),
    ("2.1", "②", "資安評估：影像去識別化、雲端 AI 服務資料留存條款／地端方案比較", "任務", "IT/MES", 2, 4, "1.1", "資安評估報告與核准紀錄"),
    ("2.2", "②", "PoC 環境建置（AI 辨識缺陷分類＋規則推導判定、記錄規範版本）", "任務", "專案專員", 6, 2, "1.6, 2.1", "可離線執行之 PoC；判定附推導依據與 specVersion"),
    ("2.3", "②", "標準樣本集 AI 一致性分析（規範 v1）", "任務", "專案專員", 8, 1, "2.2, 1.7", "結果（模擬，120 筆）：漏判率 37.0%、評估者間一致率 60.0%、對標準答案一致率 60.8%、誤判率 3.0%、人工複判率 23.3%；第 2 次判定補跑後重複性 77.5%（改善前 85.8%）→ 未達標"),
    ("2.4", "②", "判讀差異檢討與根因分析（PDCA Check）", "任務", "QA/品保", 9, 1, "2.3", "根因為 AI 偵測能力，非標準不一：CHP 偵出率 14.8%、CRK 0%（被報成 SCR/CHP）；尺寸系統偏差（CHP −65%、CON −57%、SCR +47%）"),
    ("2.5", "②", "p 管制圖判異規則驗證（25 批漂移情境模擬）", "任務", "製程工程", 8, 2, "2.2", "結果：首次預警＝首次異常＝L24，提早 0 批（目標 ≥ 2 批，未達標）；無人工複判時漂移完全未被偵出"),
    ("2.6", "②", "異常處置單範本與 AI 草擬流程（人確認後送出、通知名單）", "任務", "製程工程", 10, 1, "2.5", "異常處置單範本、通知矩陣"),
    ("2.7", "②", "Gate ②→③（規範 v1）：PoC 審查", "Gate", "專案專員", 11, 1, "2.4, 2.6", "結果：未通過。漏判率 37.0%（目標 ≤ 5%）、重複性 77.5%（目標 ≥ 90%）、預警提早 0 批。決議：不進入 ③；修訂規範 v2 並重跑 ②，③④ 順延 7 週"),
    ("2.8", "②", "檢驗規範 v2 修訂（PDCA Act）：邊緣分塊放大檢查、以框選範圍換算尺寸、不確定一律送人工複判", "任務", "QA/品保", 12, 2, "2.7", "檢驗規範 v2（周邊區每邊 8 段 × 4 倍放大、核心區 4 象限；AI 只回缺陷代碼＋框選座標；線狀缺陷取嚴、≥ 4 顆 CON 送複判）"),
    ("2.9", "②", "v2 PoC 調整與成本重估（每顆約 36 次呼叫）、API 預算核准", "任務", "專案專員", 14, 1, "2.8", "v2 PoC、預算核准單"),
    ("2.10", "②", "② 重跑：規範 v2 一致性分析（≥ 2 次判定，量測重複性）；作者本人兩輪判定已於 v1 完成，v2 沿用同一表單再做", "任務", "專案專員", 15, 2, "2.9", "結果（作品，240 筆）：漏判率 0%、重複性 92.5%、人工複判率 25.8% 達標；評估者間一致率 82.5%、對標準答案一致率 75.8%、誤判率 7.6% 未達；Fleiss' kappa 0.82。作者本人 v2 判定尚未重做"),
    ("2.11", "②", "判異規則檢討與管制圖以 v2 實測誤差重新驗證", "任務", "製程工程", 16, 2, "2.10 SS+1", "判異規則修訂、預警提早批數"),
    ("2.12", "②", "Gate ②→③（規範 v2）：PoC 重審", "Gate", "專案專員", 18, 1, "2.10, 2.11", "Gate 標準：漏判率 ≤ 5%；重複性 ≥ 90%；人工複判率 ≤ 30%；評估者間一致率 ≥ 90%；預警提早 ≥ 2 批；資安核准；發起人簽核。作品現況：評估者間一致率 82.5%、誤判率 7.6% 未達、預警提早未重驗 → 未通過，轉規範 v2.1"),
    ("3.1", "③", "試行線光源治具／取像站安裝與 µm/px 校正", "任務", "設備工程", 9, 3, "1.6", "取像站驗收紀錄（治具交期約 6 週，W3 請購；實際延遲見週會追蹤表）"),
    ("3.2", "③", "作業員教育訓練與試行 SOP（含人工複判流程）", "任務", "生產/製造", 19, 1, "2.12", "試行 SOP、訓練簽到紀錄"),
    ("3.3", "③", "單線並行比對：AI 判定 vs 人工目檢（不影響放行）", "任務", "生產/製造", 20, 6, "3.1, 3.2", "並行比對紀錄"),
    ("3.4", "③", "週別 KPI 追蹤：漏判率、一致率、人工複判率", "任務", "專案專員", 20, 6, "3.3 SS", "週報＋週會追蹤表"),
    ("3.5", "③", "預警與異常處置單實際運作（處置時效統計）", "任務", "製程工程", 21, 5, "3.3 SS+1", "處置單紀錄、確認時效統計"),
    ("3.6", "③", "產能／人力影響評估（判定節拍、複判工時）", "任務", "生管", 23, 3, "3.3 SS+3", "產能影響評估報告"),
    ("3.7", "③", "Gate ③→④：試行結案審查", "Gate", "專案專員", 26, 1, "3.3, 3.4, 3.5, 3.6", "Gate 標準：連續 4 週漏判率 ≤ 5%；評估者間一致率 ≥ 90%；人工複判率 ≤ 30%；無 AI 漏判造成之客退"),
    ("4.1", "④", "MES 介接規格（判定、缺陷代碼、規範版本、批號上拋；預警通知）", "任務", "IT/MES", 19, 3, "2.12", "介接規格書（W21 凍結）"),
    ("4.2", "④", "MES 介接開發與測試環境驗證", "任務", "IT/MES", 22, 4, "4.1", "測試報告"),
    ("4.3", "④", "擴線機台差異驗證（每台對標準樣本集做一致性分析）", "任務", "設備工程", 27, 3, "3.7", "機台間一致率差 ≤ 5%（假設值）"),
    ("4.4", "④", "檢驗規範納入文管（DCC）、OI/SOP 正式發行", "任務", "QA/品保", 27, 2, "3.7", "受控文件發行"),
    ("4.5", "④", "MES 上線切換（UAT、並行一週、回退方案）", "任務", "IT/MES", 30, 2, "4.2, 4.3", "上線核准單、回退演練紀錄"),
    ("4.6", "④", "擴線成效追蹤與 Owner 移交（製造／QA）", "任務", "專案專員", 32, 1, "4.5", "移交清單"),
    ("4.7", "④", "專案結案報告與效益確認", "Gate", "專案專員", 33, 1, "4.6", "結案報告：KPI 達成狀況、後續擴站建議"),
]

PHASE_NAMES = {
    "①": "① 現況 MSA 與規範制定",
    "②": "② PoC 驗證（v1 未通過 → 規範 v2 重跑）",
    "③": "③ 單線試行（與人工並行比對）",
    "④": "④ 擴線與 MES 介接",
}
PHASE_STATUS = {"①": "模擬示範（部分）", "②": "v1 未通過・v2 已重跑（Gate 未通過）", "③": "規劃・未執行", "④": "規劃・未執行"}
# 各任務在本作品（模擬情境）中的實際狀態；未列者＝規劃・未執行
TASK_STATUS = {
    "1.3": "模擬示範（半合成樣本）",
    "1.4": "模擬示範（規範 v1）",
    "1.5": "模擬示範（作者本人）",
    "1.7": "模擬示範（規範 v1）",
    "2.2": "已完成（模擬）",
    "2.3": "完成・未達標",
    "2.4": "已完成（模擬）",
    "2.5": "完成・未達標",
    "2.7": "未通過",
    "2.8": "已完成（作品，2026-10-07）",
    "2.9": "已完成（實際 US$9.55）",
    "2.10": "完成・部分達標",
    "2.12": "作品現況：未通過",
}
STATUS_STYLE = [  # (關鍵字, 底色, 字色)
    ("未通過", "FFC7CE", "9C0006"),
    ("未達標", "FFC7CE", "9C0006"),
    ("已完成", "C6EFCE", "006100"),
    ("模擬", "DDEBF7", "1F3864"),
    ("提案", "FFEB9C", "9C5700"),
    ("部分達標", "FFEB9C", "9C5700"),
]


def task_status(wbs):
    return TASK_STATUS.get(wbs, "規劃・未執行")


def style_status(cell):
    for kw, bg, fg in STATUS_STYLE:
        if kw in str(cell.value):
            cell.fill = fill(bg)
            cell.font = Font(name=FONT, size=10, bold=True, color=fg)
            return


def check_dependencies():
    idx = {t[0]: t for t in TASKS}
    for wbs, _, _, _, _, s, d, pred, _ in TASKS:
        if pred == "—":
            continue
        for p in [x.strip() for x in pred.split(",")]:
            m = re.match(r"^(\d\.\d+)(?:\s*SS(?:\+(\d+))?)?$", p)
            assert m, p
            pt = idx[m.group(1)]
            if "SS" in p:
                lag = int(m.group(2) or 0)
                assert s >= pt[5] + lag, f"{wbs} SS 違反 {p}"
            else:
                assert s >= pt[5] + pt[6], f"{wbs} 早於前置 {p} 完成"
        assert s + d - 1 <= N_WEEKS, wbs


def build_schedule(wb):
    check_dependencies()
    ws = wb.create_sheet("時程表")
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 85
    WK0 = 12  # 第一個週欄 (L)
    last_wk_col = WK0 + N_WEEKS - 1
    COL_DELIV = last_wk_col + 1
    COL_STAT = last_wk_col + 2

    title(ws, "時程表｜四導入階段 WBS 與甘特圖")
    ws["A2"] = "專案起始日（W1 週一）"
    ws["A2"].font = Font(name=FONT, size=10, bold=True)
    ws.merge_cells("A2:B2")
    ws["C2"] = PROJECT_START
    ws["C2"].number_format = "yyyy-mm-dd"
    ws["C2"].font = Font(name=FONT, size=10, bold=True, color="0000FF")
    ws["C2"].fill = fill("FFF2CC")
    ws["C2"].border = BORDER
    ws["C2"].alignment = Alignment(horizontal="left")
    # legend
    ws["D2"] = "圖例"
    ws["D2"].font = Font(name=FONT, size=9, bold=True)
    ws["D2"].alignment = Alignment(horizontal="right")
    lc = 5
    for ph, (solid, _) in PHASE_COLORS.items():
        c = ws.cell(row=2, column=lc, value=ph)
        c.fill = fill(solid)
        c.font = Font(name=FONT, size=9, bold=True, color="FFFFFF")
        c.alignment = CENTER
        lc += 1
    c = ws.cell(row=2, column=lc, value="◆ Gate")
    c.fill = fill(GATE_COLOR)
    c.font = Font(name=FONT, size=9, bold=True, color="FFFFFF")
    c.alignment = CENTER

    hdr = ["WBS", "階段", "任務名稱", "類型", "負責單位", "開始週", "週數", "結束週", "開始日", "結束日", "前置任務"]
    header_row(ws, 4, hdr)
    for i in range(1, 12):
        ws.merge_cells(start_row=3, start_column=i, end_row=4, end_column=i)
        ws.cell(row=3, column=i).value = hdr[i - 1]
        ws.cell(row=3, column=i).font = Font(name=FONT, bold=True, color="FFFFFF")
        ws.cell(row=3, column=i).fill = fill(NAVY)
        ws.cell(row=3, column=i).alignment = CENTER
    for n in range(1, N_WEEKS + 1):
        col = WK0 + n - 1
        L = get_column_letter(col)
        d = ws.cell(row=3, column=col, value=f"=$C$2+({L}4-1)*7")
        d.number_format = "m/d"
        d.font = Font(name=FONT, size=8, color="FFFFFF")
        d.fill = fill("2F5597")
        d.alignment = Alignment(horizontal="center", vertical="center", text_rotation=90)
        d.border = BORDER
        w = ws.cell(row=4, column=col, value=n)
        w.number_format = '"W"0'
        w.font = Font(name=FONT, size=8, bold=True, color="FFFFFF")
        w.fill = fill(NAVY)
        w.alignment = CENTER
        w.border = BORDER
        ws.column_dimensions[L].width = 5
    ws.row_dimensions[3].height = 34
    for col, text in ((COL_DELIV, "交付物／里程碑・Gate 標準"), (COL_STAT, "作品執行狀態")):
        ws.merge_cells(start_row=3, start_column=col, end_row=4, end_column=col)
        c = ws.cell(row=3, column=col, value=text)
        c.font = Font(name=FONT, bold=True, color="FFFFFF")
        c.fill = fill(NAVY)
        c.alignment = CENTER
        c.border = BORDER
    # 春節週標示（2027 春節約 2/6，落在 W14 末～W15）
    cny_week = 15
    cny = ws.cell(row=2, column=WK0 + cny_week - 1, value="春節")
    cny.font = Font(name=FONT, size=8, bold=True, color="C00000")
    cny.alignment = CENTER

    r = 5
    first_row = r
    for ph in "①②③④":
        children = [t for t in TASKS if t[1] == ph]
        pr = r
        c0, c1 = pr + 1, pr + len(children)
        bg = PHASE_COLORS[ph][1]
        body_cell(ws, pr, 1, ph, align=CENTER, bold=True, bg=bg)
        body_cell(ws, pr, 2, ph, align=CENTER, bold=True, bg=bg)
        body_cell(ws, pr, 3, PHASE_NAMES[ph], bold=True, bg=bg)
        body_cell(ws, pr, 4, "階段", align=CENTER, bold=True, bg=bg)
        body_cell(ws, pr, 5, "專案專員", align=CENTER, bold=True, bg=bg)
        body_cell(ws, pr, 6, f"=MIN(F{c0}:F{c1})", align=CENTER, bold=True, bg=bg)
        body_cell(ws, pr, 8, f"=MAX(H{c0}:H{c1})", align=CENTER, bold=True, bg=bg)
        body_cell(ws, pr, 7, f"=H{pr}-F{pr}+1", align=CENTER, bold=True, bg=bg)
        body_cell(ws, pr, 9, f"=$C$2+(F{pr}-1)*7", align=CENTER, bold=True, bg=bg).number_format = "yyyy-mm-dd"
        body_cell(ws, pr, 10, f"=$C$2+(H{pr}-1)*7+4", align=CENTER, bold=True, bg=bg).number_format = "yyyy-mm-dd"
        body_cell(ws, pr, 11, "", bg=bg)
        body_cell(ws, pr, COL_DELIV, "", bg=bg)
        sc = body_cell(ws, pr, COL_STAT, PHASE_STATUS[ph], align=CENTER, bold=True, bg=bg)
        style_status(sc)
        r += 1
        for t in children:
            wbs, _, name, typ, owner, s, d, pred, deliv = t
            is_gate = typ == "Gate"
            body_cell(ws, r, 1, wbs, align=CENTER)
            body_cell(ws, r, 2, ph, align=CENTER)
            body_cell(ws, r, 3, name, bold=is_gate, color=GATE_COLOR if is_gate else None)
            body_cell(ws, r, 4, typ, align=CENTER, bold=is_gate, color=GATE_COLOR if is_gate else None)
            body_cell(ws, r, 5, owner, align=CENTER)
            body_cell(ws, r, 6, s, align=CENTER, color="0000FF")
            body_cell(ws, r, 7, d, align=CENTER, color="0000FF")
            body_cell(ws, r, 8, f"=F{r}+G{r}-1", align=CENTER)
            body_cell(ws, r, 9, f"=$C$2+(F{r}-1)*7", align=CENTER).number_format = "yyyy-mm-dd"
            body_cell(ws, r, 10, f"=$C$2+(H{r}-1)*7+4", align=CENTER).number_format = "yyyy-mm-dd"
            body_cell(ws, r, 11, pred, align=CENTER)
            dc = body_cell(ws, r, COL_DELIV, deliv)
            st = task_status(wbs)
            if "未通過" in st or "未達標" in st:
                dc.font = Font(name=FONT, size=10, bold=True, color="9C0006")
            elif is_gate:
                dc.font = Font(name=FONT, size=10, bold=True)
            style_status(body_cell(ws, r, COL_STAT, st, align=CENTER))
            if is_gate:
                for n in range(N_WEEKS):
                    L = get_column_letter(WK0 + n)
                    ws.cell(row=r, column=WK0 + n, value=f'=IF({L}$4=$H{r},"◆","")')
            ws.row_dimensions[r].height = max(42 if is_gate else 30, 14 * -(-len(deliv) // 26) + 8)
            r += 1
    last_row = r - 1

    # 週欄格線與置中
    for rr in range(first_row, last_row + 1):
        for n in range(N_WEEKS):
            c = ws.cell(row=rr, column=WK0 + n)
            c.border = BORDER
            c.alignment = CENTER
            c.font = Font(name=FONT, size=10, bold=True, color="FFFFFF")

    # 條件式格式：甘特
    first_L = get_column_letter(WK0)
    last_L = get_column_letter(last_wk_col)
    rng = f"{first_L}{first_row}:{last_L}{last_row}"
    in_bar = f"AND({first_L}$4>=$F{first_row},{first_L}$4<=$H{first_row})"
    ws.conditional_formatting.add(
        rng,
        FormulaRule(formula=[f'AND($D{first_row}="Gate",{in_bar})'], fill=fill(GATE_COLOR), stopIfTrue=True),
    )
    ws.conditional_formatting.add(
        rng,
        FormulaRule(formula=[f'AND($D{first_row}="階段",{in_bar})'], fill=fill("404040"), stopIfTrue=True),
    )
    for ph, (solid, _) in PHASE_COLORS.items():
        ws.conditional_formatting.add(
            rng,
            FormulaRule(formula=[f'AND($B{first_row}="{ph}",{in_bar})'], fill=fill(solid), stopIfTrue=True),
        )
    # 春節週淺灰底
    cny_L = get_column_letter(WK0 + cny_week - 1)
    ws.conditional_formatting.add(
        f"{cny_L}{first_row}:{cny_L}{last_row}",
        FormulaRule(formula=["TRUE"], fill=fill("EDEDED")),
    )

    # 附註
    note_r = last_row + 2
    notes = [
        "附註：",
        "1. 前置任務預設為「完成→開始」(FS)；「SS」表示與前置任務同步開始，「SS+n」表示前置任務開始 n 週後開始。",
        "2. 修改 C2 專案起始日即全表日期連動；開始週、週數（藍字）為輸入值；結束週、開始日、結束日、階段列彙總與甘特著色皆為公式／條件式格式。",
        "3. 階段 ① 與 ③④ 部分任務刻意平行（資安評估、治具請購、MES 規格提前啟動），以壓縮長交期項目對要徑之影響。",
        "4. 版本 v0.2：② 以規範 v1 執行之 PoC 未通過 Gate（2.7），新增 2.8–2.12（規範 v2 修訂與 ② 重跑），③④ 整體順延 7 週（原 W26 結案 → W33）。",
        "5. 2027 春節（約 2/6 起）落在 W14 末～W15，與 ② 重跑（離線作業）重疊，不影響產線並行比對。",
        f"6. ①② 之數據皆為模擬（半合成樣本、模擬 AI 評估者），出處 {EXP}；③④ 與 ② 重跑為規劃，尚未執行。",
    ]
    for i, t in enumerate(notes):
        c = ws.cell(row=note_r + i, column=1, value=t)
        c.font = Font(name=FONT, size=9, bold=(i == 0), color="404040")

    widths(ws, {"A": 6, "B": 5, "C": 46, "D": 6, "E": 11, "F": 6, "G": 5, "H": 6, "I": 12.5, "J": 12.5, "K": 11})
    ws.column_dimensions[get_column_letter(COL_DELIV)].width = 60
    ws.column_dimensions[get_column_letter(COL_STAT)].width = 21
    ws.freeze_panes = ws.cell(row=5, column=4)
    ws.auto_filter.ref = f"A4:K{last_row}"
    print_setup(ws, title_rows="3:4", paper="A3")


# =====================================================================
# 3. RACI
# =====================================================================
UNITS = ["生產/製造", "QA/品保", "製程工程", "設備工程", "IT/MES", "生管", "專案專員"]
RACI = [
    ("①", "專案章程與 KPI 訂定", ["C", "C", "C", "I", "I", "C", "A/R"]),
    ("①", "現行人工目檢流程盤點", ["R", "C", "I", "I", "I", "I", "A"]),
    ("①", "標準樣本挑選與標準答案確認", ["C", "A/R", "C", "I", "", "", "I"]),
    ("①", "現況一致性分析（人工目檢 MSA）", ["R", "A", "I", "", "", "", "R"]),
    ("①", "檢驗規範制定、審查與版本發行", ["C", "A", "R", "I", "", "", "C"]),
    ("①", "影像擷取條件與光源治具", ["I", "C", "C", "A/R", "", "", "C"]),
    ("②", "資安評估與 AI 服務選型", ["", "I", "", "", "A/R", "", "C"]),
    ("②", "PoC 建置與 AI 一致性分析", ["I", "C", "C", "C", "C", "", "A/R"]),
    ("②", "p 管制圖判異規則與預警門檻", ["I", "C", "A/R", "", "", "I", "C"]),
    ("②", "異常處置單流程（AI 草擬、人確認）", ["C", "C", "A", "C", "C", "I", "R"]),
    ("②", "規範 v2 修訂與 ② 重跑（v1 未通過 Gate 後）", ["C", "A", "C", "C", "C", "", "R"]),
    ("③", "單線並行比對執行", ["R", "A", "C", "C", "", "I", "R"]),
    ("③", "人工複判執行與紀錄", ["R", "A", "I", "", "", "", "I"]),
    ("③", "產能與人力影響評估", ["C", "", "I", "", "", "A/R", "C"]),
    ("④", "MES 介接規格、開發與上線", ["I", "C", "C", "", "A/R", "C", "C"]),
    ("④", "擴線機台差異驗證", ["C", "A", "C", "R", "", "", "C"]),
    ("④", "檢驗規範文管發行與教育訓練", ["R", "A", "C", "I", "", "", "C"]),
    ("全程", "Gate 審查與週會追蹤、升級管理", ["C", "C", "C", "C", "C", "C", "A/R"]),
]


def build_raci(wb):
    ws = wb.create_sheet("RACI")
    ws.sheet_view.showGridLines = False
    title(ws, "RACI 責任分工矩陣", "R＝執行（Responsible）　A＝當責（Accountable，每列唯一）　C＝諮詢（Consulted）　I＝告知（Informed）；A/R＝當責兼執行")
    hdr = ["No.", "階段", "關鍵活動"] + UNITS + ["A 數檢核"]
    header_row(ws, 4, hdr)
    dv = DataValidation(type="list", formula1='"R,A,C,I,A/R"', allow_blank=True, showErrorMessage=True,
                        errorTitle="RACI", error="請輸入 R、A、C、I 或 A/R")
    ws.add_data_validation(dv)
    first = 5
    for i, (ph, act, vals) in enumerate(RACI):
        r = first + i
        assert sum(v.startswith("A") for v in vals) == 1, act
        bg = PHASE_COLORS[ph][1] if ph in PHASE_COLORS else LIGHT
        body_cell(ws, r, 1, i + 1, align=CENTER)
        body_cell(ws, r, 2, ph, align=CENTER, bg=bg)
        body_cell(ws, r, 3, act)
        for j, v in enumerate(vals):
            c = body_cell(ws, r, 4 + j, v or None, align=CENTER, bold=True)
        U0, U1 = get_column_letter(4), get_column_letter(3 + len(UNITS))
        body_cell(ws, r, 4 + len(UNITS), f'=IF(COUNTIF({U0}{r}:{U1}{r},"A*")=1,"OK","需修正")', align=CENTER)
        ws.row_dimensions[r].height = 24
    last = first + len(RACI) - 1
    U0, U1 = get_column_letter(4), get_column_letter(3 + len(UNITS))
    dv.add(f"{U0}{first}:{U1}{last}")
    rng = f"{U0}{first}:{U1}{last}"
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'LEFT({U0}{first},1)="A"'], fill=fill("C00000"), font=Font(color="FFFFFF", bold=True), stopIfTrue=True))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"R"'], fill=fill("F8CBAD")))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"C"'], fill=fill("DDEBF7")))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"I"'], fill=fill("F2F2F2")))
    chk = get_column_letter(4 + len(UNITS))
    ws.conditional_formatting.add(f"{chk}{first}:{chk}{last}", CellIsRule(operator="equal", formula=['"需修正"'], fill=fill("FFC7CE"), font=Font(color="9C0006", bold=True)))

    # 各單位負荷統計
    sr = last + 2
    body_cell(ws, sr, 3, "R 數（執行負荷）", bold=True, bg=GREY_HDR)
    body_cell(ws, sr + 1, 3, "A 數（當責項目）", bold=True, bg=GREY_HDR)
    for j in range(len(UNITS)):
        L = get_column_letter(4 + j)
        body_cell(ws, sr, 4 + j, f'=COUNTIF({L}{first}:{L}{last},"*R")', align=CENTER)
        body_cell(ws, sr + 1, 4 + j, f'=COUNTIF({L}{first}:{L}{last},"A*")', align=CENTER)
    c = ws.cell(row=sr + 3, column=1, value="註：章程與 Gate 審查之最終簽核由專案發起人（製造處處長）執行；表中「專案專員 A」代表對文件與流程之當責。")
    c.font = Font(name=FONT, size=9, color="404040")

    widths(ws, {"A": 5, "B": 6, "C": 38})
    for j in range(len(UNITS)):
        ws.column_dimensions[get_column_letter(4 + j)].width = 11
    ws.column_dimensions[get_column_letter(4 + len(UNITS))].width = 11
    ws.freeze_panes = "D5"
    print_setup(ws, title_rows="4:4", fit_tall=True)


# =====================================================================
# 4. 風險清單
# =====================================================================
RISKS = [
    ("技術", "AI 判讀不穩／辨識能力不足：看不到小缺陷、缺陷分類混淆、尺寸量測偏差", 5, 5, "【已觸發】PoC v1（模擬）：漏判率 37.0%（10/27）；CHP 偵出率 14.8%、CRK 0%（被報成 SCR/CHP）；尺寸偏差 CHP 深度 −65%、CON 直徑 −57%、SCR 長度 +47%；Fleiss' kappa 0.39；重複性 77.5%（兩次不一致的 27 組中 15 組為量測跨過門檻、12 組為一次看到一次沒看到）。原觸發條件：漏判率 > 5% 或重複性 < 90%", "AI 只回缺陷分類、判定由規則推導（ADR-0001）；規範 v2：邊緣分塊放大檢查、尺寸改由框選範圍換算、不確定一律送人工複判（已執行：漏判率 0%、重複性 92.5%，但框選過鬆使誤判率升至 7.6%）", "② Gate（v1、v2）皆未通過、不進入 ③；規範 v2.1：框內找實際邊緣再量測、門檻 ±10% 送人工複判", "專案專員", "②③"),
    ("技術", "影像品質／光源變異造成尺寸量測偏差", 4, 4, "每班標準片灰階值或 µm/px 校正值超出管制範圍", "固定光源治具與遮光罩；每班開線前標準片點檢；校正紀錄納入 OI", "當班影像標記不採用，改人工目檢；設備工程 4 小時內排除", "設備工程", "①③④"),
    ("組織", "現場抗拒：作業員擔心被取代或增加雙軌工作量", 3, 3, "並行比對紀錄漏填率 > 5%；人工複判單積壓 > 1 班", "定位為「輔助判定」；邀作業員參與規範制定與試行檢討；可視化回饋其複判貢獻", "由班長一對一溝通；必要時升級製造部主管調整排班", "生產/製造", "③"),
    ("組織", "規範爭議：QA／製程／製造對允收標準看法不一", 4, 3, "規範審查會後未結議題 > 2 項；規範發行延遲 > 1 週", "以客戶規格為底線；爭議項暫列判定 Warning 送人工複判並蒐集數據；檢驗規範版本控管", "升級跨部門主管會議裁決", "QA/品保", "①②"),
    ("時程", "MES 介接延誤（IT 資源被其他專案佔用）", 3, 4, "介接規格未於 W16 凍結；開發進度落後 > 1 週", "④ 規格提前於 W14 啟動；介接欄位最小化（判定、缺陷代碼、規範版本、批號）", "過渡期以檔案拋轉（CSV）匯入；上線順延不影響 ③ 成效", "IT/MES", "④"),
    ("資料", "標準樣本不足（CRK 等稀少缺陷、邊界樣本不足）", 4, 4, "任一缺陷分類樣本 < 5 顆或邊界樣本 < 3 顆", "延長收集期；納入客退品與工程片；不足處以半合成樣本補足並明確標示（ADR-0002）", "該缺陷分類於試行期一律判定 Warning 送人工複判", "QA/品保", "①②"),
    ("技術", "機台差異：擴線後各取像站結果不一致", 3, 4, "機台間對標準樣本集一致率差 > 5%", "每台上線前做一致性分析；統一治具規格與校正程序", "差異機台暫不上線，設備工程比對光學條件", "設備工程", "④"),
    ("資安", "資安／資料外流：晶粒影像送雲端 AI 服務", 2, 5, "資安審查未通過；客戶 NDA 限制影像外傳", "影像去識別化（裁切、移除批號與條碼）；企業合約確認不留存、不用於訓練；同步評估地端方案", "暫停雲端呼叫，切換地端方案或延後 ③", "IT/MES", "②③④"),
    ("品質", "AI 漏判造成不良品流出", 3, 5, "PoC v1 模擬漏判率 37.0% 已顯示風險升高；試行期觸發：並行比對中「AI Pass／人工 Fail」件數 > 0（Fail 類缺陷）", "試行期 AI 不影響放行；CRK 任何長度一律 Fail；漏判案例 24 小時內檢討並回饋規範", "啟動異常處置單、追溯同批晶粒、通知 QA 主管", "QA/品保", "③④"),
    ("營運", "雙軌作業造成目檢站人力負荷與產出下降", 4, 2, "目檢站加班時數 > 基準 20%；站點 WIP 高於管制量", "並行比對改抽樣（如每批 50 顆）；生管預先調整排程", "縮小抽樣比例或延長試行期", "生管", "③"),
    ("技術", "預警誤報過多，造成處置疲乏", 2, 3, "預警批中經確認非真異常比例 > 50%", "判異規則分級（僅超 UCL 強制處置、趨勢型先通知）；試行後依數據調整", "暫停趨勢型預警通知，僅保留超出 UCL", "製程工程", "③"),
    ("成本", "AI 服務費用／API 額度不足，影響驗證完整性與節拍", 4, 3, "【已觸發】PoC v1 執行中 API 額度耗盡（335 次呼叫、US$2.28），第 2 次判定中斷；加值後從快取補跑完成（共 504 次、US$3.46）；v2 重跑（240 次、US$9.55，原估 US$3–4）中再遇帳戶餘額不足與每月用量上限，兩次皆從快取續跑、無重複呼叫", "實驗前依前導測試估算成本並設預算上限；v2 先以小樣本估成本；量產僅送 AOI 疑似片或灰色地帶影像", "申請預算加值後從快取續跑；評估較小模型或地端方案", "專案專員", "②③④"),
    ("時程", "光源治具交期延遲，影響試行線取像站安裝", 4, 3, "W8 前未取得供應商出貨確認", "W3 即請購（長交期項目提前）；向供應商取得書面交期", "借用研發治具過渡；升級採購主管催料", "設備工程", "③"),
    ("技術", "預警未能提早：判異規則敏感度不足、AI 漏判掩蓋漂移", 4, 4, "【已觸發】25 批漂移情境模擬：首次預警＝首次異常＝L24，提早 0 批（完美判定亦未提早）；無人工複判時漂移完全未被偵出；基準期 L10 誤警報", "AI 判 Warning 之晶粒必送人工複判；以 v2 實測誤差重新驗證判異規則（2.11）", "預警提早批數未達 ≥ 2 批前，不以「提早預警」作為導入效益宣稱", "製程工程", "②③"),
    ("組織", "關鍵人員異動或春節長假造成進度中斷", 3, 2, "核心成員異動；春節前 2 週未完成交接", "每項任務指定代理人；文件化；春節週排程預留緩衝", "專案專員暫代並向發起人報告", "專案專員", "全程"),
]


def build_risks(wb):
    ws = wb.create_sheet("風險清單")
    ws.sheet_view.showGridLines = False
    title(ws, "風險清單（Risk Register）", "機率、影響：1（極低）～5（極高）；風險值＝機率×影響；等級：≥ 15 高、8–14 中、≤ 7 低。")
    hdr = ["編號", "類別", "風險描述", "機率\n(1-5)", "影響\n(1-5)", "風險值", "等級", "觸發指標", "預防對策", "應變措施（觸發後）", "負責單位", "對應階段", "狀態"]
    header_row(ws, 4, hdr)
    dv_score = DataValidation(type="whole", operator="between", formula1="1", formula2="5", showErrorMessage=True, error="請輸入 1–5 整數")
    dv_stat = DataValidation(type="list", formula1='"監控中,已觸發,已關閉"', allow_blank=True)
    ws.add_data_validation(dv_score)
    ws.add_data_validation(dv_stat)
    first = 5
    for i, (cat, desc, p, im, trig, pre, resp, owner, ph) in enumerate(RISKS):
        r = first + i
        body_cell(ws, r, 1, f"R{i + 1:02d}", align=CENTER)
        body_cell(ws, r, 2, cat, align=CENTER)
        body_cell(ws, r, 3, desc)
        body_cell(ws, r, 4, p, align=CENTER, color="0000FF")
        body_cell(ws, r, 5, im, align=CENTER, color="0000FF")
        body_cell(ws, r, 6, f"=D{r}*E{r}", align=CENTER, bold=True)
        body_cell(ws, r, 7, f'=IF(F{r}>=15,"高",IF(F{r}>=8,"中","低"))', align=CENTER, bold=True)
        body_cell(ws, r, 8, trig)
        body_cell(ws, r, 9, pre)
        body_cell(ws, r, 10, resp)
        body_cell(ws, r, 11, owner, align=CENTER)
        body_cell(ws, r, 12, ph, align=CENTER)
        body_cell(ws, r, 13, "已觸發" if desc.startswith(("AI 判讀不穩", "光源治具", "規範爭議", "AI 服務費用", "預警未能提早")) else "監控中", align=CENTER)
        ws.row_dimensions[r].height = 58
    last = first + len(RISKS) - 1
    dv_score.add(f"D{first}:E{last}")
    dv_stat.add(f"M{first}:M{last}")
    for col in ("F", "G"):
        rng = f"{col}{first}:{col}{last}"
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f"$F{first}>=15"], fill=fill("FFC7CE"), font=Font(color="9C0006", bold=True), stopIfTrue=True))
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f"$F{first}>=8"], fill=fill("FFEB9C"), font=Font(color="9C5700", bold=True), stopIfTrue=True))
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f"$F{first}<8"], fill=fill("C6EFCE"), font=Font(color="006100", bold=True)))

    # 風險矩陣（機率 × 影響 → 風險數）
    mr = last + 2
    MC = 15  # 矩陣起始欄 O
    c = ws.cell(row=mr, column=MC, value="風險矩陣（各格為風險數，公式統計）")
    c.font = Font(name=FONT, size=11, bold=True, color=NAVY)
    body_cell(ws, mr + 1, MC, "機率＼影響", align=CENTER, bold=True, bg=GREY_HDR)
    for im in range(1, 6):
        body_cell(ws, mr + 1, MC + im, im, align=CENTER, bold=True, bg=GREY_HDR)
    for k, p in enumerate(range(5, 0, -1)):
        rr = mr + 2 + k
        body_cell(ws, rr, MC, p, align=CENTER, bold=True, bg=GREY_HDR)
        for im in range(1, 6):
            score = p * im
            bg = "FFC7CE" if score >= 15 else ("FFEB9C" if score >= 8 else "C6EFCE")
            body_cell(ws, rr, MC + im, f'=COUNTIFS($D${first}:$D${last},{p},$E${first}:$E${last},{im})', align=CENTER, bold=True, bg=bg)
    sr = mr + 9
    body_cell(ws, sr, MC, "等級", align=CENTER, bold=True, bg=GREY_HDR)
    body_cell(ws, sr, MC + 1, "數量", align=CENTER, bold=True, bg=GREY_HDR)
    for k, lv in enumerate(["高", "中", "低"]):
        body_cell(ws, sr + 1 + k, MC, lv, align=CENTER, bold=True)
        body_cell(ws, sr + 1 + k, MC + 1, f'=COUNTIF($G${first}:$G${last},"{lv}")', align=CENTER)

    widths(ws, {"A": 6, "B": 7, "C": 34, "D": 7, "E": 7, "F": 7, "G": 6, "H": 30, "I": 42, "J": 30, "K": 11, "L": 9, "M": 9, "N": 3, "O": 11, "P": 5, "Q": 5, "R": 5, "S": 5, "T": 5})
    ws.freeze_panes = "D5"
    ws.auto_filter.ref = f"A4:M{last}"
    print_setup(ws, title_rows="4:4", paper="A3", fit_tall=True)


# =====================================================================
# 5. 週會追蹤表
# =====================================================================
TRACK = [
    ("Gate ②→③（v1）審查結果", "②", "規範 v1 PoC：漏判率 37.0%（目標 ≤ 5%）、重複性 77.5%（目標 ≥ 90%）、預警提早 0 批 → 未通過", "專案專員", dt.date(2027, 1, 15), "已完成", "跨部門主管會議", None, "1/15 Gate 會議決議：不進入 ③；修訂規範 v2 並重跑 ②，③④ 順延 7 週（時程表 v0.2 已更新）"),
    ("② v2 一致性分析重跑", "②", "v1 第 2 次判定已補跑完成（改善後重複性 77.5%）；v2 分塊放大後每顆約 36 次呼叫，需重估預算", "專案專員", dt.date(2027, 2, 5), "已完成", "直屬主管", dt.date(2027, 1, 27), "作品中已執行（2026-10-07）：36 張放大圖合併為每顆 1 次呼叫，實際 US$9.55；漏判率 0%、重複性 92.5%、誤判率 7.6% → Gate（v2）未通過，轉 v2.1"),
    ("檢驗規範 v2 路由規則", "②", "「核心區線狀缺陷不分 SCR／CRK 一律至少 Warning」：製造擔心人工複判量回升，與 QA 意見不一", "QA/品保（規範 Owner）", dt.date(2027, 1, 29), "卡關", "部門主管", dt.date(2027, 1, 28), "以 v1 實測 CRK 偵出率 0% 為依據提部門主管裁決；同步確認人工複判率門檻 ≤ 30%"),
    ("CRK／CHP 標準樣本補足", "②", "每類 Fail 樣本僅 2–3 張，比率信賴區間過寬（漏判 10/27 之 95% CI 約 22–56%）", "QA/品保（品保工程師）", dt.date(2027, 2, 5), "進行中", "直屬主管", dt.date(2027, 2, 1), "已向客服調閱客退品；不足部分以半合成補足並標示（ADR-0002）"),
    ("作者本人兩輪判定", "②", "人 vs AI 對照尚未進行", "專案專員", dt.date(2027, 2, 12), "進行中", "負責人", dt.date(2027, 2, 1), "依規範判定兩輪，打亂順序、隔天進行"),
    ("判異規則檢討", "②", "v1 模擬實測預警提早 0 批（完美判定亦未提早）；基準期 L10 誤警報", "製程工程（製程工程師）", dt.date(2027, 2, 19), "進行中", "負責人", dt.date(2027, 2, 1), "併入 2.11，以 v2 實測誤差重新模擬"),
    ("試行線取像站安裝", "③", "光源治具未到料：供應商交期由 1/15 延至 2/26", "設備工程（治具負責人）／採購", dt.date(2027, 1, 15), "延遲", "直屬主管", dt.date(2027, 2, 1), "③ 已順延至 W19（3/15），治具延遲暫不在要徑上，但緩衝僅約 2 週；持續催料"),
    ("影像去識別化流程", "②", "—", "IT/MES（資安窗口）", dt.date(2027, 1, 15), "已完成", "負責人", None, "裁切批號／條碼區域後再送 AI，資安核准單已歸檔"),
    ("異常處置單通知名單", "②", "夜班值班主管名單未提供", "製程工程／生產/製造", dt.date(2027, 1, 22), "延遲", "直屬主管", dt.date(2027, 1, 27), "已請製造部提供夜班輪值表；未取得前由專案專員代為通知"),
    ("MES 介接人力承諾", "④", "IT 人力被 ERP 升級專案佔用；4.1 順延至 W19 後仍需於 3/5 前承諾人力", "IT/MES（系統分析師）", dt.date(2027, 3, 5), "進行中", "負責人", dt.date(2027, 2, 8), "③④ 順延後壓力下降；持續追蹤"),
]


def build_tracker(wb):
    ws = wb.create_sheet("週會追蹤表")
    ws.sheet_view.showGridLines = False
    title(ws, "週會追蹤表")
    ws["B2"] = dt.date(2027, 1, 25)
    ws["B2"].number_format = '"週會日期："yyyy-mm-dd'
    ws["B2"].font = Font(name=FONT, size=10, bold=True, color="0000FF")
    ws["B2"].alignment = Alignment(horizontal="left")
    ws["B2"].fill = fill("FFF2CC")
    ws["B2"].border = BORDER
    ws["C2"] = "（W13，② 規範 v2 修訂期）　升級原則：同一卡關項目追蹤 2 次未解 → 升一級；影響 Gate 或跨部門資源 → 直接提跨部門主管會議"
    ws["C2"].font = Font(name=FONT, size=9, italic=True, color="7F7F7F")

    hdr = ["No.", "項目", "所屬階段", "卡關項目", "負責人（單位）", "預計交付日", "目前狀態", "升級層級", "下次追蹤日", "逾期天數", "備註"]
    HR = 8
    header_row(ws, HR, hdr)
    first = HR + 1
    n_rows = 25
    last = first + n_rows - 1

    # 狀態彙總（公式）
    body_cell(ws, 4, 2, "狀態彙總", bold=True, bg=GREY_HDR)
    for k, st in enumerate(["進行中", "卡關", "延遲", "已完成"]):
        body_cell(ws, 5, 2 + k * 2, st, align=CENTER, bold=True, bg=GREY_HDR)
        body_cell(ws, 5, 3 + k * 2, f'=COUNTIF($G${first}:$G${last},"{st}")', align=CENTER, bold=True)
    body_cell(ws, 6, 2, "升級至部門主管以上", bold=True, bg=GREY_HDR)
    body_cell(ws, 6, 3, f'=COUNTIFS($H${first}:$H${last},"部門主管",$G${first}:$G${last},"<>已完成")+COUNTIFS($H${first}:$H${last},"跨部門主管會議",$G${first}:$G${last},"<>已完成")', align=CENTER, bold=True, color="C00000")

    dv_status = DataValidation(type="list", formula1='"進行中,卡關,已完成,延遲"', allow_blank=True, showErrorMessage=True, errorTitle="目前狀態", error="請由下拉選單選擇")
    dv_esc = DataValidation(type="list", formula1='"負責人,直屬主管,部門主管,跨部門主管會議"', allow_blank=True, showErrorMessage=True, errorTitle="升級層級", error="請由下拉選單選擇")
    dv_phase = DataValidation(type="list", formula1='"①,②,③,④,全程"', allow_blank=True)
    for dv in (dv_status, dv_esc, dv_phase):
        ws.add_data_validation(dv)
    dv_status.add(f"G{first}:G{last}")
    dv_esc.add(f"H{first}:H{last}")
    dv_phase.add(f"C{first}:C{last}")

    for i in range(n_rows):
        r = first + i
        row = TRACK[i] if i < len(TRACK) else None
        body_cell(ws, r, 1, i + 1, align=CENTER)
        vals = list(row) if row else [None] * 9
        item, ph, block, owner, due, stat, esc, nxt, note = vals
        body_cell(ws, r, 2, item)
        body_cell(ws, r, 3, ph, align=CENTER)
        body_cell(ws, r, 4, block)
        body_cell(ws, r, 5, owner)
        body_cell(ws, r, 6, due, align=CENTER).number_format = "yyyy-mm-dd"
        body_cell(ws, r, 7, stat, align=CENTER, bold=True)
        body_cell(ws, r, 8, esc, align=CENTER)
        body_cell(ws, r, 9, nxt, align=CENTER).number_format = "yyyy-mm-dd"
        body_cell(ws, r, 10, f'=IF(OR(F{r}="",G{r}="已完成"),"",MAX(0,$B$2-F{r}))', align=CENTER)
        body_cell(ws, r, 11, note)
        ws.row_dimensions[r].height = 46 if row else 22

    data_rng = f"A{first}:K{last}"
    ws.conditional_formatting.add(data_rng, FormulaRule(formula=[f'$G{first}="延遲"'], fill=fill("FFC7CE"), font=Font(color="9C0006"), stopIfTrue=True))
    ws.conditional_formatting.add(data_rng, FormulaRule(formula=[f'$G{first}="卡關"'], fill=fill("FFEB9C"), font=Font(color="9C5700"), stopIfTrue=True))
    ws.conditional_formatting.add(data_rng, FormulaRule(formula=[f'$G{first}="已完成"'], font=Font(color="808080"), stopIfTrue=True))
    ws.conditional_formatting.add(f"H{first}:H{last}", FormulaRule(formula=[f'AND(OR($H{first}="部門主管",$H{first}="跨部門主管會議"),$G{first}<>"已完成")'], font=Font(color="C00000", bold=True)))
    ws.conditional_formatting.add(f"F{first}:F{last}", FormulaRule(formula=[f'AND($F{first}<>"",$F{first}<$B$2,$G{first}<>"已完成")'], font=Font(color="C00000", bold=True, underline="single")))
    ws.conditional_formatting.add(f"J{first}:J{last}", CellIsRule(operator="greaterThan", formula=["0"], font=Font(color="C00000", bold=True)))

    widths(ws, {"A": 5, "B": 22, "C": 7, "D": 40, "E": 22, "F": 12, "G": 10, "H": 14, "I": 12, "J": 8, "K": 44})
    ws.freeze_panes = ws.cell(row=first, column=3)
    ws.auto_filter.ref = f"A{HR}:K{last}"
    print_setup(ws, title_rows=f"{HR}:{HR}", fit_tall=True)


# =====================================================================
def apply_font_everywhere(wb):
    """把仍為預設字型（Calibri）的儲存格改為微軟正黑體，保留其他屬性。"""
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for c in row:
                if c.font is None or c.font.name != FONT:
                    f = copy.copy(c.font)
                    f.name = FONT
                    c.font = f


def build():
    wb = Workbook()
    build_cover(wb)
    build_charter(wb)
    build_schedule(wb)
    build_raci(wb)
    build_risks(wb)
    build_tracker(wb)
    apply_font_everywhere(wb)
    wb.properties.title = "晶粒外觀檢查改善專案 導入計畫（模擬情境）"
    wb.properties.creator = "專案專員"
    wb.save(OUT)
    return OUT


def verify(path):
    wb = load_workbook(path)
    expect = ["封面", "專案章程", "時程表", "RACI", "風險清單", "週會追蹤表"]
    assert wb.sheetnames == expect, wb.sheetnames
    n_formula = {}
    for ws in wb.worksheets:
        n_formula[ws.title] = sum(
            1 for row in ws.iter_rows() for c in row if isinstance(c.value, str) and c.value.startswith("=")
        )
    assert wb["風險清單"]["F5"].value == "=D5*E5"
    assert wb["時程表"]["H6"].value == "=F6+G6-1"
    assert len(wb["時程表"].conditional_formatting) > 0
    assert len(wb["週會追蹤表"].data_validations.dataValidation) >= 2
    leftover = [f"{ws.title}!{c.coordinate}" for ws in wb.worksheets for row in ws.iter_rows() for c in row
                if isinstance(c.value, str) and "實驗後回填" in c.value]
    assert not leftover, leftover
    print("驗證通過：", path)
    for k, v in n_formula.items():
        print(f"  {k}: 公式 {v} 個")
    print("  時程表任務數：", len(TASKS), "　風險數：", len(RISKS), "　追蹤列（範例）：", len(TRACK))


if __name__ == "__main__":
    verify(build())
