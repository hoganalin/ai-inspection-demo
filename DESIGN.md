---
name: 晶粒外觀檢查改善專案
description: Die micrograph plate system — calibrated plates, ruled tables, and verdict colours that appear only once a rule derives them.
colors:
  si-950: "#10152B"
  si-900: "#161C38"
  si-800: "#1B2140"
  si-700: "#283057"
  si-600: "#384273"
  si-400: "#6C76A8"
  si-300: "#A3ABD3"
  si-200: "#CDD2EC"
  si-100: "#E6E9F7"
  ground: "#F3F5F8"
  ground-2: "#E8ECF2"
  surface: "#FFFFFF"
  rule: "#D3D9E3"
  rule-strong: "#A9B1C2"
  ink: "#10131C"
  ink-2: "#3B4255"
  ink-3: "#5D6579"
  pass: "#2F8F5B"
  pass-ink: "#23744A"
  pass-tint: "#E2F1E8"
  warn: "#D89B12"
  warn-ink: "#855700"
  warn-tint: "#FBEFD0"
  fail: "#B4235A"
  fail-ink: "#9C1C4C"
  fail-tint: "#F7E1E9"
  accent: "#3552D6"
  accent-ink: "#2A43B5"
  accent-tint: "#E4E9FC"
  anno: "rgba(255, 255, 255, 0.94)"
  anno-soft: "rgba(205, 210, 236, 0.75)"
typography:
  verdict:
    fontFamily: "Archivo, Noto Sans TC, Microsoft JhengHei, PingFang TC, system-ui, sans-serif"
    fontSize: "3.4rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 88"
  display:
    fontFamily: "Archivo, Noto Sans TC, Microsoft JhengHei, PingFang TC, system-ui, sans-serif"
    fontSize: "2.1333rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 92"
  headline-num:
    fontFamily: "Archivo, Noto Sans TC, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 800
    lineHeight: 1.1
    fontFeature: "\"tnum\" 1"
    fontVariation: "\"wdth\" 88"
  headline:
    fontFamily: "Archivo, Noto Sans TC, Microsoft JhengHei, PingFang TC, system-ui, sans-serif"
    fontSize: "1.3333rem"
    fontWeight: 800
    lineHeight: 1.3
    fontVariation: "\"wdth\" 94"
  readout:
    fontFamily: "Archivo, Noto Sans TC, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    fontFeature: "\"tnum\" 1"
  title:
    fontFamily: "Archivo, Noto Sans TC, Microsoft JhengHei, PingFang TC, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.6
  body:
    fontFamily: "Archivo, Noto Sans TC, Microsoft JhengHei, PingFang TC, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    fontVariation: "\"wdth\" 100"
  small:
    fontFamily: "Archivo, Noto Sans TC, system-ui, sans-serif"
    fontSize: "0.8667rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo, Noto Sans TC, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  none: "0px"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  gutter: "32px"
  section-gap: "40px"
  section: "48px"
  work-gap: "64px"
  rail: "240px"
components:
  button-primary:
    backgroundColor: "{colors.si-800}"
    textColor: "{colors.surface}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.si-600}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "38px"
  button-secondary-hover:
    backgroundColor: "{colors.ground}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "38px"
  button-quiet-hover:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ink}"
  button-sm:
    padding: "0 10px"
    height: "30px"
  button-disabled:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ink-3}"
  segment-active:
    backgroundColor: "{colors.si-800}"
    textColor: "{colors.surface}"
    padding: "7px 14px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 10px"
  field-tentative:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
  chip-pass:
    backgroundColor: "{colors.pass-tint}"
    textColor: "{colors.pass-ink}"
    typography: "{typography.small}"
    padding: "1px 8px"
  chip-warning:
    backgroundColor: "{colors.warn-tint}"
    textColor: "{colors.warn-ink}"
    padding: "1px 8px"
  chip-fail:
    backgroundColor: "{colors.fail-tint}"
    textColor: "{colors.fail-ink}"
    padding: "1px 8px"
  chip-out-of-control:
    backgroundColor: "{colors.fail}"
    textColor: "{colors.surface}"
    padding: "1px 8px"
  chip-warning-signal:
    backgroundColor: "{colors.warn}"
    textColor: "{colors.si-950}"
    padding: "1px 8px"
  chip-line:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    padding: "1px 8px"
  rail:
    backgroundColor: "{colors.si-800}"
    textColor: "{colors.si-200}"
    width: "{spacing.rail}"
  rail-link-active:
    backgroundColor: "{colors.si-100}"
    textColor: "{colors.si-900}"
    padding: "10px 12px"
  plate:
    backgroundColor: "{colors.si-900}"
    rounded: "{rounded.none}"
  plate-tag-reported:
    backgroundColor: "{colors.anno}"
    textColor: "{colors.si-950}"
    typography: "{typography.label}"
    padding: "2px 6px"
  plate-tag-zone:
    backgroundColor: "rgba(16, 21, 43, 0.82)"
    textColor: "{colors.si-100}"
    padding: "2px 6px"
  plate-tag-pass:
    backgroundColor: "{colors.pass-ink}"
    textColor: "{colors.surface}"
  plate-tag-warning:
    backgroundColor: "{colors.warn}"
    textColor: "{colors.si-950}"
  plate-tag-fail:
    backgroundColor: "{colors.fail}"
    textColor: "{colors.surface}"
  row-number:
    backgroundColor: "{colors.si-800}"
    textColor: "{colors.surface}"
    typography: "{typography.mono}"
    size: "22px"
  table-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-3}"
    typography: "{typography.label}"
    padding: "8px 12px"
  table-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "10px 12px"
  table-row-selected:
    backgroundColor: "{colors.accent-tint}"
  note-warning:
    backgroundColor: "{colors.warn-tint}"
    textColor: "{colors.ink}"
    padding: "10px 14px"
  note-simulation:
    backgroundColor: "{colors.si-100}"
    textColor: "{colors.si-900}"
    padding: "10px 14px"
---

# Design System: 晶粒外觀檢查改善專案

## Overview

**Creative North Star: "The Calibrated Plate"**

Every die is shown as a calibrated micrograph plate, the way a lab report or a metallurgy atlas sets a specimen: true scale, zone boundaries drawn in µm, a scale bar computed from 5 µm/px, a figure number (圖 n) and a caption. The plate sits dark on a silicon-indigo ground; everything around it is a cool optical-white working sheet divided by 1 px rules. Leader lines run from each defect on the plate to its numbered row in the 判定明細, so the chain AI 回報 → 規範條文 → 判定 is drawn rather than asserted.

Colour is evidence, not decoration. The shell and plates share the silicon-indigo family of the die itself; the three oxide-interference state colours (Pass green, Warning/預警 gold, Fail/異常 red-violet) appear only where a verdict or a lot signal has been derived, and one royal blue marks selection, links and focus. AI output is set in tentative ink (dashed underline or dashed frame) until a rule or a named person commits it. The density is that of an engineering document: tight ruled tables, tabular numerals, mono codes, and no cards, shadows, or rounded panels.

The system rejects the dark AI-vision dashboard (bounding boxes plus confidence %), the KPI-card SaaS shell, and the literary-magazine look (cream paper, serif display, terracotta).

**Key Characteristics:**
- Silicon-indigo rail and plates on a cool white ground (never cream).
- Square everywhere: 0 px radius, 1 px rules, flat surfaces.
- State colours reserved for derived state; one blue for selection.
- Narrow-width Archivo 800 for headings and the verdict word; hierarchy by scale contrast.
- JetBrains Mono for defect codes, sample IDs, readouts and chart ticks.
- Tentative ink for anything the AI reported; solid ink once committed.
- Real-scale instruments: plate geometry in µm, scale bars, pixel-honest insets, width-aware charts.

## Colors

A cool, instrument-grade palette: silicon indigo for the shell, optical white for the work, near-black ink, and three thin-film interference colours that only ever mean state.

### Primary
- **Silicon Indigo** (si-800): the rail background, the primary button, the active segment, row-number squares, done-phase rules, the meter fill and checkbox accent. Its darker steps carry the plate itself (si-900) and dark text on gold or white annotation (si-950); its lighter steps carry rail text (si-200), the active rail link (si-100) and the simulation note.
- **Silicon Indigo ramp** (si-950 → si-100): a single hue family used as the shell's tonal scale. si-700 is rail dividers and hover; si-600 is primary-button hover and rail counts; si-400/si-300 are muted rail text and DieMark strokes.

### Secondary
- **Royal Selection Blue** (accent): focus outlines, selected sample cells, the selected point ring on the p-chart, the 實測批 divider, the active rail icon, the drag-over dropzone border. **Accent Ink** is link and edited-tag text; **Accent Tint** is selected table rows, text selection, info notes and the drag-over fill.

### Tertiary (state only)
- **Pass Green** (pass / pass-ink / pass-tint): Verdict Pass. Leader lines and scale-bar edges use pass; the Pass plate tag uses pass-ink so white text holds contrast; chips use the tint with ink text.
- **Warning Gold** (warn / warn-ink / warn-tint): Verdict Warning at die level and 預警 at lot level. warn fills marks, leader lines, the +2σ line, the 預警 chip and rail count, and the held-phase rule; warn-ink carries every piece of gold text; warn-tint fills chips, notes and the held phase.
- **Fail Red-Violet** (fail / fail-ink / fail-tint): Verdict Fail and 異常. fail fills the 異常 chip, rail count, UCL line, Fail plate tag and leader lines; fail-ink is red-violet text (including worsened MSA numbers such as 漏判率); fail-tint fills chips and notes.

### Neutral
- **Optical White Ground** (ground): page background, button hover, tentative-field fill. **Ground 2** is disabled fills, quiet-button hover, the meter track and the Phase I band on the p-chart.
- **Surface White** (surface): tables, notes, headline panels, fields, buttons, the action-plan column.
- **Rule** (rule) and **Strong Rule** (rule-strong): 1 px dividers between rows, frames and readouts; rule-strong is control borders, table header underline, chart axes and the dashed dropzone/tentative frames.
- **Ink** (ink), **Ink 2** (ink-2), **Ink 3** (ink-3): primary text; secondary text, quiet buttons, AI-reported text; captions-level metadata, table headers, chart ticks, placeholders.
- **Annotation White** (anno) and **Annotation Soft** (anno-soft): marks drawn on the dark plate: reported tags, the 1 mm scale bar, inset frames, and the resting zone boundaries.

### Named Rules
**The Gold Never Speaks Rule.** `--warn` is never a text colour. Gold text, in HTML or SVG, uses warn-ink; warn is only a fill, stroke or background (with si-950 text on it).

**The State-Only Rule.** Pass, Warning/預警 and Fail/異常 colours appear only where a verdict or lot signal exists. Destructive actions (刪除紀錄, 全部清除, 清除清單) stay neutral quiet buttons with a trash icon and a confirm dialog; they never borrow red-violet.

**The Derived Colour Rule.** A plate tag is white (anno) while it is 「AI 回報」 and takes the derived verdict colour once judgeDie has ruled. Zone tags (周邊區, 核心區) follow the same rule on every page: neutral indigo at rest, the most severe derived verdict colour when a defect is reported in that zone.

**The One Blue Rule.** Royal blue means "selected, focused, or a link". It is never a state colour and never decoration.

## Typography

**Display Font:** Archivo variable (wdth 62–125, wght 400–800), with Noto Sans TC, Microsoft JhengHei, PingFang TC, system-ui
**Body Font:** Archivo with Noto Sans TC for CJK (same stack)
**Label/Mono Font:** JetBrains Mono (400, 600), with ui-monospace, SFMono-Regular, Consolas

**Character:** A workhorse grotesque whose width axis is pulled in for headings, so heavy 800 headlines read condensed and technical, paired with a plain CJK sans and a technical mono for anything that is a code, an ID or a measurement. The root size is 15 px.

### Hierarchy
- **Verdict** (800, 3.4rem / 51 px, line-height 0.95, wdth 88, -0.02em): the derived verdict word (Pass / Warning / Fail) in the 判定 row, set in the verdict colour. 2.6rem below 900 px.
- **Display** (800, 2.1333rem / 32 px, line-height 1.15, wdth 92, -0.015em): page titles only. 1.5333rem below 900 px.
- **Headline number** (800, 1.6rem, first row 2.2rem, wdth 88, tabular): the MSA before/after figures.
- **Headline** (800, 1.3333rem / 20 px, line-height 1.3, wdth 94): section titles.
- **Readout** (700, 1.2rem, tabular): values in readout strips.
- **Title** (700, 1rem): block titles and step names in the derivation chain.
- **Body** (400, 15 px, line-height 1.6): running text; page subtitles cap at 68ch, overview prose at 80ch.
- **Small** (13 px, line-height 1.55): captions, section notes, chips, field labels (600).
- **Label** (600, 12 px): table headers, plate tags, readout terms, rail counts.
- **Mono** (JetBrains Mono, 11–12 px, 600 for IDs): defect codes (SCR…), sample IDs (S25), lot IDs, chart ticks, scale-bar numbers, inset labels.

### Named Rules
**The Width-Axis Rule.** Hierarchy is carried by scale and width contrast within one family: 800 weight with wdth 88–94 for headings and numbers, wdth 100 for body. No second display face.

**The No-Eyebrow Rule.** No eyebrow or kicker labels above headings. A status belongs on the heading line as a trailing mark (e.g. phase state 完成 / 未達門檻 / 規劃 after the phase name), and section context goes in a trailing section note.

**The Mono-Is-Measurement Rule.** Codes, IDs, µm values and chart ticks are mono with tabular numerals; prose is never mono.

**The Chart Text Never Scales Rule.** SVG charts set viewBox to the measured layout width, so ticks stay 12 px and labels 13 px at every size, on a projector and at 390 px. Margins are computed from content (the bottom margin from the longest 45°-rotated lot label), never by shrinking type.

## Layout

A two-column shell: a fixed 240 px silicon-indigo rail (208 px below 1180 px) and a fluid main column. Pages pad 28 px top, a 32 px gutter at the sides (24 px below 1180, 16 px below 900) and 64 px bottom, capped at 1480 px. A page head ends in a 1 px rule with 24 px below it; sections are separated by 48 px; two-column section splits use a 40 px gap.

The inspection work area is plate-left, detail-right (0.9fr / 1fr) with a 64 px gutter (48 px below 1180) left empty on purpose: it is the channel the leader lines turn in. The plate column is sticky at 20 px. The 管制看板 splits chart and Pareto against a sticky 400 px 異常處置單 column.

Spacing rhythm is small and ruled: 4, 6, 8, 10, 12, 14, 16, 18, 24 px inside components, then 28, 32, 40, 48, 64 px between blocks.

Responsive steps: 1180 px (narrower rail and gutter, sample grid 20 → 10 columns); 1100 px (control split and overview splits stack, phases 4 → 2 columns); 1000 px (work area stacks, plate capped at 520 px); 900 px (rail becomes a sticky top bar with a horizontally scrolling nav, rail foot replaced by a one-line simulation note, leader lines hidden, phases single column, sample grid 8 columns); 600 px (ruled tables stack).

### Named Rules
**The Stack-Below-600 Rule.** Data tables carry `tbl-stack` and `data-label` on every cell: below 600 px the header hides and each row becomes a block of label/value pairs. Wide tables that must not stack set a 560 px minimum width inside a scrolling frame.

**The Gutter-Is-For-Leaders Rule.** The gap between plate and detail is not padding to be reclaimed; when the layout is too narrow for leaders to run plate-to-row, leaders are hidden rather than drawn across content.

## Elevation & Depth

Flat. There are no elevation shadows anywhere. Depth comes from tone (dark indigo plate on white ground, indigo rail against the sheet), 1 px rules and frames, and sticky positioning. The only box-shadows in the build are hairline rings that act as strokes (the scan line's 1 px ring, the offline status dot's inset outline, the inset 2 px mismatch ring on a sample cell), not lift.

### Named Rules
**The Flat Plate Rule.** Surfaces never lift. If something needs separation, give it a 1 px rule, a tint, or a tonal step, never a drop shadow.

## Shapes

Square and ruled. Every radius is 0: buttons, fields, chips, notes, tables, plates, scrollbar thumbs, status dots and loading dots. Containers are drawn with 1 px rules (rule or rule-strong); dashed rules mean something specific: tentative (AI) ink in UI, and boundaries or limits in instruments (seal ring, 標準答案 diamond markers, UCL and +2σ lines). Recurring geometry: square row-number tiles, the square-capped mitred line icons (1.6 stroke), the ○ △ ✕ verdict marks drawn as SVG so verdict never depends on colour alone, and the DieMark logo (a die plan with seal ring and pads).

## Components

### Buttons
Plain, square and confident; weight 600, 15 px label (`0.9333rem`).
- **Shape:** square corners (0 px), 38 px minimum height, 16 px side padding, 8 px icon gap.
- **Primary:** silicon indigo fill with white text; hover steps to si-600. The main forward action of a view (e.g. 用標準樣本試判定 →, running a judgment, drafting the 異常處置單, creating a lot).
- **Secondary:** white surface, 1 px rule-strong border, ink text; hover darkens the border to ink-2 and fills with ground.
- **Quiet:** transparent, ink-2 text, 10 px padding; hover fills ground-2. Destructive actions use quiet + trash icon + confirm.
- **Small:** 30 px height, 10 px padding, 13 px text.
- **Disabled:** ground-2 fill, ink-3 text, rule border, not-allowed cursor.
- **Focus:** 2 px accent outline, 2 px offset (global `:focus-visible`). Transitions 0.15 s ease on background, border and colour.

### Segmented control
A ruled strip of options inside a 1 px rule-strong frame, internal dividers in rule; the pressed option fills silicon indigo with white 600 text; hover on others fills ground-2.

### Chips
- **Style:** square, 1 px 8 px padding, 13 px 600, VerdictMark at 12 px in currentColor before the name.
- **Verdict chips:** tint fill + ink text (Pass / Warning / Fail, optionally with 處置 放行 / 送人工複判 / 退件).
- **Lot-signal chips:** solid fill: 異常 is fail with white text; 預警 is warn with si-950 text. The solid/tint difference separates lot signals from die verdicts.
- **Line chip:** transparent with rule-strong border, ink-2, 500 weight, for neutral metadata (規範 v1, 導入階段 ② PoC 驗證).

### Cards / Containers
There are no cards. Containers are ruled frames: white surface, 1 px rule border, 0 px radius, 12–16 px padding (headline panel 12/14 px, phase cells 14/16 px). The phase strip uses a 4 px top rule as state: rule (planned), si-800 (done), warn with warn-tint fill (held).

### Notes
Full-width ruled bars, 10/14 px padding, 15 px text (0.9rem), leading icon. Variants: info (accent tint), warn (warn tint), fail (fail tint), simulation (si-100 fill, si-900 text) for the persistent 情境與數據皆為模擬 disclosure.

### Inputs / Fields
- **Style:** white surface, 1 px rule-strong border, 0 radius, 8/10 px padding, 15 px text, ink-3 placeholder. Field labels are 13 px 600 ink-2, 6 px above.
- **Focus:** 2 px accent outline at -1 px offset and an accent border.
- **Tentative:** AI-drafted fields carry a dashed rule-strong border on a ground fill; on focus the fill turns white; once a person edits, the field drops the tentative style and its tag turns from 「AI 草稿」 (dashed ink-3) to 「已修改」 (solid accent).

### Tables
Ruled and dense: 15 px body, 12 px 600 ink-3 headers on a rule-strong underline, 10/12 px cells divided by 1 px rule, numerals right-aligned and tabular, inside a 1 px rule frame. Row hover fills ground; the selected row fills accent-tint. Stacks below 600 px (see Layout).

### Navigation
The rail: si-800 column with the DieMark and project name at top (si-700 divider), nav links with line icons (15 px, 10/12 px padding, 12 px icon gap) in si-200; hover fills si-700 with white text; the current page fills si-100 with si-900 600 text and an accent icon. Counts sit right in mono on si-600, turning fail (異常) or warn with si-950 text (預警). The foot holds 判定依據, AI 服務 status (a 7 px square dot) and the simulation disclosure on si-900. Below 900 px the rail becomes a sticky top bar with a horizontally scrolling nav and the disclosure collapses to a one-line note.

### Calibrated Plate (signature)
The die image on an si-900 square with an SVG overlay whose coordinate unit is µm, so geometry is true at any rendered size: the seal ring (dashed) and core boundary (solid) in anno-soft, brightening to white when a defect is reported in that zone; a 1 mm scale bar in anno; 標準答案 positions as dashed diamonds. Plate tags are 12 px 600 square labels: white while reported, verdict colour once derived; zone tags sit on the right edge in translucent indigo and follow the same derived-colour rule. A pixel-honest inset magnifies by an integer factor so one visible cell is one image pixel (每格＝5 µm), labelled in mono. Every plate has a figcaption beginning with a bold 圖 n.

### Leader lines (signature)
An SVG layer measures live layout boxes and draws orthogonal leaders from each detail row to its plate anchor, snapped to the half-pixel and drawn `crispEdges`, turning in the plate/detail gutter. Each has a 4 px white halo so it reads across the dark die. Reported state: 1 px ink-3 dashed (4 3), fading in over 0.2 s with the ease-out curve; after 420 ms it re-draws as a 1.5 px solid line in the derived verdict colour, ending in a 4 × 6 px tick. Reduced motion skips straight to the derived state. Hidden below 900 px or when the detail is not to the right of the plate.

### Scale Bar
A 260 × 34 instrument per measured defect: the acceptance bands from 0 µm drawn in verdict tints with a 1 px verdict-colour edge, limit ticks in ink-3 with 11 px mono labels, and the measured value as a 2 px verdict-colour needle with a caret. Length is the measurement.

### p 管制圖 (chart)
Hand-rolled SVG whose viewBox equals the measured layout width. Phase I lots sit on a ground-2 band; centre line ink-2 1.4 px; UCL fail dashed 8 5; +2σ warn dotted 2 4; the series ink 1.6 px. Points are ○ (normal, white fill), filled square for 預警, filled triangle for 異常; the selected point gets a 2 px accent square ring. Right-edge limit labels are mono 12 px in fail-ink, warn-ink and ink-2 (UCL / CL short forms when narrow). X labels are placed greedily, signal lots first, never overlapping; rotated 45° when crowded.

### Tentative AI ink
AI-reported text in prose and tables uses ink-2 with a dashed ink-3 underline (4 px offset); AI drafts sit in a dashed-frame tentative block. Committed text is plain ink. This is the visual contract that the AI reports and the rule (or a person) decides.

### Motion
One meaningful motion per state: the scan line sweeping the plate during AI 回報缺陷中 (1.8 s ease-out loop, hidden for reduced motion), three blinking square dots for loading, the meter's 0.3 s ease-out fill, and the leader draw. Hover transitions are 0.15 s ease. Reduced motion collapses all of it.

## Do's and Don'ts

### Do:
- **Do** set gold text in warn-ink (#855700); use warn (#D89B12) only as fill, stroke or background with si-950 text.
- **Do** keep plate tags white until the rule derives a verdict, then give them (and the zone tag the defect sits in) the verdict colour, on every page that shows a plate.
- **Do** give every die image the full plate treatment: µm geometry, 1 mm scale bar, 圖 n figcaption.
- **Do** put status on the heading line as a trailing mark and context in a trailing section note.
- **Do** mark every data table `tbl-stack` with `data-label` cells so it stacks below 600 px.
- **Do** size SVG charts by viewBox = layout width and grow margins from content, keeping tick text 12 px and labels 13 px.
- **Do** render anything the AI reported in tentative ink (dashed underline or dashed frame) until a rule or a person commits it.
- **Do** pair every verdict colour with its ○ △ ✕ mark so state never depends on colour alone.
- **Do** use mono with tabular numerals for codes, IDs, µm values and readouts.

### Don't:
- **Don't** use `--warn` as text colour, in HTML or SVG.
- **Don't** colour destructive buttons red-violet or any state colour; state colours are reserved for state.
- **Don't** add eyebrow or kicker labels above headings.
- **Don't** round corners, add drop shadows, or wrap content in cards; use 1 px rules and tints.
- **Don't** use cream or warm paper grounds, serif display faces, or terracotta; the ground is cool optical white.
- **Don't** show AI confidence percentages or bounding-box overlays; the plate shows reported defects and derived verdicts only.
- **Don't** call 預警 just "warning" in UI copy, and don't style a lot-level 預警 like a die-level Warning chip (solid vs tint).
- **Don't** let chart text scale with the chart or let rotated labels clip; compute the margin.
- **Don't** use royal blue for anything except selection, focus and links.
