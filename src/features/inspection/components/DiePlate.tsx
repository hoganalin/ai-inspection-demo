import React, { useLayoutEffect, useRef, useState } from 'react';
import { DIE_GEOMETRY, ZONE_LABEL, type DefectClass, type InspectionZone, type Verdict } from '../spec/inspectionSpecV1';

/** 標準答案缺陷在影像上的位置（px，以 1000 px 影像為準）。 */
export interface PlateMarker {
  n: number;
  x: number;
  y: number;
  code: DefectClass;
  /** 規則推導後的判定：標籤改用判定色（未推導時維持白色＝暫定） */
  verdict?: Verdict;
}

interface Props {
  src: string;
  alt: string;
  /** 影像寬度對應的像素數；標準樣本為 1000 px（5 µm/px）。 */
  imagePx?: number;
  markers?: PlateMarker[];
  /** 有缺陷被回報在這些區域時，區域標籤改用該區最嚴重判定的顏色，並作為引線端點。 */
  zoneVerdicts?: Partial<Record<InspectionZone, Verdict>>;
  /** 放大插圖的中心（px）。null 時不顯示。 */
  inset?: { x: number; y: number } | null;
  busy?: boolean;
  busyLabel?: string;
  /** anchor 名稱的前綴，供同頁多張圖版時區分。 */
  anchorPrefix?: string;
}

const DIE_UM = DIE_GEOMETRY.dieSizeUm;
const INSET_MAG = 6;

/**
 * 校準圖版：晶粒影像＋依規範 v1 幾何畫出的區域界線（seal ring、核心區）、
 * 比例尺（1 mm）與標準答案位置。SVG 座標單位就是 µm，所以任何顯示尺寸下比例都正確。
 */
export const DiePlate: React.FC<Props> = ({
  src, alt, imagePx = DIE_GEOMETRY.imagePx, markers = [], zoneVerdicts = {}, inset = null,
  busy = false, busyLabel = 'AI 回報缺陷中…', anchorPrefix = 'plate',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const umPerPx = DIE_UM / imagePx;
  const { sealRingFromUm: ringA, sealRingToUm: ringB } = DIE_GEOMETRY;
  const hot = (z: InspectionZone) => zoneVerdicts[z] !== undefined;
  const zoneClass = (z: InspectionZone) => (zoneVerdicts[z] ? ` is-${zoneVerdicts[z]}` : '');

  // 放大插圖：固定為圖版寬度 30%，每個影像像素放大成 INSET_MAG 個 CSS px 的整數倍
  const insetW = Math.round(width * 0.3);
  const scale = width ? (width / imagePx) * INSET_MAG : 0;
  const pxMag = Math.max(1, Math.round(scale)); // 整數倍：一格像素就是 5 µm
  const insetNative = insetW / pxMag;            // 插圖涵蓋的影像像素數
  const insetCorner = inset && inset.x < imagePx / 2 ? { right: '3%' } : { left: '3%' };
  const insetVertical = inset && inset.y < imagePx / 2 ? { bottom: '9%' } : { top: '3%' };

  return (
    <div className="plate" ref={ref}>
      <img src={src} alt={alt} draggable={false} />

      <svg className="plate-svg" viewBox={`0 0 ${DIE_UM} ${DIE_UM}`} preserveAspectRatio="none" aria-hidden="true">
        {/* seal ring：距邊緣 100–120 µm；內緣以內為核心區 */}
        <rect x={ringA} y={ringA} width={DIE_UM - 2 * ringA} height={DIE_UM - 2 * ringA}
          fill="none" stroke={hot('peripheral') ? 'rgba(255,255,255,0.9)' : 'var(--anno-soft)'} strokeWidth="1"
          vectorEffect="non-scaling-stroke" strokeDasharray="6 4" />
        <rect x={ringB} y={ringB} width={DIE_UM - 2 * ringB} height={DIE_UM - 2 * ringB}
          fill="none" stroke={hot('core') ? 'rgba(255,255,255,0.9)' : 'var(--anno-soft)'} strokeWidth="1"
          vectorEffect="non-scaling-stroke" />

        {/* 比例尺：1 mm */}
        <g>
          <rect x="260" y={DIE_UM - 330} width="1000" height="44" fill="var(--anno)" />
          <rect x="260" y={DIE_UM - 352} width="10" height="88" fill="var(--anno)" />
          <rect x="1250" y={DIE_UM - 352} width="10" height="88" fill="var(--anno)" />
        </g>

        {/* 標準答案位置 */}
        {markers.map(m => {
          const cx = m.x * umPerPx;
          const cy = m.y * umPerPx;
          const r = 150;
          return (
            <g key={m.n}>
              <path d={`M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`}
                fill="none" stroke="var(--anno)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
            </g>
          );
        })}

        {/* 放大插圖的取樣框 */}
        {inset && width > 0 && (
          <rect
            x={(inset.x - insetNative / 2) * umPerPx} y={(inset.y - insetNative / 2) * umPerPx}
            width={insetNative * umPerPx} height={insetNative * umPerPx}
            fill="none" stroke="var(--anno)" strokeWidth="1" vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* 區域標籤：貼在右緣，作為引線端點 */}
      <span
        className={'plate-tag is-zone' + zoneClass('peripheral')}
        style={{ right: 0, top: '18%' }}
        data-anchor={`${anchorPrefix}-zone-peripheral`}
      >
        {ZONE_LABEL.peripheral}・0–100 µm
      </span>
      <span
        className={'plate-tag is-zone' + zoneClass('core')}
        style={{ right: '9%', top: '46%' }}
        data-anchor={`${anchorPrefix}-zone-core`}
      >
        {ZONE_LABEL.core}・&gt;120 µm
      </span>

      {markers.map(m => (
        <span
          key={m.n}
          className={'plate-tag' + (m.verdict ? ` is-${m.verdict}` : '')}
          style={{ left: `${(m.x / imagePx) * 100 + 3.5}%`, top: `${(m.y / imagePx) * 100 - 2.2}%` }}
          data-anchor={`${anchorPrefix}-ref-${m.n}`}
        >
          標準答案 {m.n}・<span className="mono">{m.code}</span>
        </span>
      ))}

      <span className="plate-tag" style={{ left: '5.2%', bottom: '7.6%', background: 'transparent', color: 'var(--anno)', padding: 0 }}>
        1 mm
      </span>

      {inset && width > 0 && (
        <div
          className="plate-inset"
          aria-hidden="true"
          style={{
            width: insetW,
            ...insetCorner,
            ...insetVertical,
            backgroundImage: `url("${src}")`,
            backgroundSize: `${imagePx * pxMag}px ${imagePx * pxMag}px`,
            backgroundPosition: `${insetW / 2 - inset.x * pxMag}px ${insetW / 2 - inset.y * pxMag}px`,
          }}
        >
          <span className="plate-inset-label">×{(pxMag * imagePx / width).toFixed(1)}・每格＝{umPerPx} µm</span>
        </div>
      )}

      {busy && (
        <div className="plate-busy" role="status">
          <span className="scanline" />
          <span className="dots"><i /><i /><i /></span>
          {busyLabel}
        </div>
      )}
    </div>
  );
};
