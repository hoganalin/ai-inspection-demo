import React, { useRef, useCallback } from 'react';
import { useComparison } from '../hooks/useComparison';
import type { InspectionResult, ComparisonDefect } from '../types';

interface Props {
  customCriteria?: string;
}

const STATUS_CFG = {
  pass:    { label: 'PASS',    color: 'var(--success)', icon: '✓' },
  fail:    { label: 'FAIL',    color: 'var(--danger)',  icon: '✕' },
  warning: { label: 'WARN',   color: 'var(--warning)', icon: '!' },
};

const SEV_COLOR: Record<string, string> = {
  low: 'var(--warning)', medium: '#f97316', high: 'var(--danger)',
};

const FOUND_IN_CFG = {
  A:    { label: '僅 A', bg: 'rgba(79,124,255,0.15)', color: 'var(--primary)' },
  B:    { label: '僅 B', bg: 'rgba(34,211,238,0.15)', color: 'var(--accent)' },
  both: { label: 'A+B',  bg: 'rgba(245,158,11,0.15)', color: 'var(--warning)' },
};

/* ── Image Drop Zone ── */
const DropZone: React.FC<{
  label: string;
  preview: string | null;
  color: string;
  onFile: (f: File) => void;
  disabled?: boolean;
}> = ({ label, preview, color, onFile, disabled }) => {
  const ref = useRef<HTMLInputElement>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) onFile(f);
  }, [onFile]);

  return (
    <div
      onClick={() => !disabled && ref.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        flex: 1, minWidth: 0,
        border: `2px dashed ${preview ? color : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        background: preview ? 'transparent' : 'rgba(255,255,255,0.02)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        overflow: 'hidden',
        position: 'relative',
        aspectRatio: '4/3',
        transition: 'border-color 0.2s',
      }}
    >
      {preview ? (
        <>
          <img src={preview} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: color, color: '#fff',
            fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
          }}>
            圖片 {label}
          </div>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 28, opacity: 0.4 }}>🖼</span>
          <span style={{ fontSize: 12, fontWeight: 700, color, opacity: 0.8 }}>圖片 {label}</span>
          <span style={{ fontSize: 10, color: 'var(--subtext)' }}>點擊或拖放</span>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
};

/* ── Mini Result Card ── */
const MiniResult: React.FC<{ label: string; result: InspectionResult; color: string }> = ({ label, result, color }) => {
  const cfg = STATUS_CFG[result.status];
  return (
    <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '0.05em' }}>圖片 {label}</span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 800,
          color: cfg.color, background: `${cfg.color}18`,
          padding: '2px 8px', borderRadius: 5,
        }}>{cfg.icon} {cfg.label}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>信心度</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, fontFamily: 'monospace' }}>{result.confidence}%</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>瑕疵數</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: result.defects.length > 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'monospace' }}>{result.defects.length}</div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--subtext)', lineHeight: 1.5 }}>{result.summary}</p>
    </div>
  );
};

/* ── Difference Row ── */
const DiffRow: React.FC<{ diff: ComparisonDefect; index: number }> = ({ diff, index }) => {
  const fi = FOUND_IN_CFG[diff.foundIn];
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={{ padding: '10px 14px', color: 'var(--subtext)', fontSize: 12, width: 32 }}>
        {String(index + 1).padStart(2, '0')}
      </td>
      <td style={{ padding: '10px 14px' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 5,
          background: fi.bg, color: fi.color,
        }}>{fi.label}</span>
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#fff', fontWeight: 500 }}>{diff.location}</td>
      <td style={{ padding: '10px 14px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: SEV_COLOR[diff.severity], background: `${SEV_COLOR[diff.severity]}15`, padding: '2px 7px', borderRadius: 4 }}>
          {diff.severity}
        </span>
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--subtext)', lineHeight: 1.4 }}>{diff.description}</td>
    </tr>
  );
};

/* ── Main Component ── */
export const ComparisonPanel: React.FC<Props> = ({ customCriteria }) => {
  const { status, result, previewA: hookPreviewA, previewB: hookPreviewB, compare, reset } = useComparison();
  const [fileA, setFileA] = React.useState<File | null>(null);
  const [fileB, setFileB] = React.useState<File | null>(null);
  const [localPreviewA, setLocalPreviewA] = React.useState<string | null>(null);
  const [localPreviewB, setLocalPreviewB] = React.useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = React.useState(false);

  // Use hook previews (during/after compare) or local previews (after file select/demo load)
  const previewA = hookPreviewA ?? localPreviewA;
  const previewB = hookPreviewB ?? localPreviewB;

  const canCompare = !!fileA && !!fileB && status !== 'analyzing';

  const handleCompare = () => {
    if (fileA && fileB) compare(fileA, fileB, customCriteria);
  };

  const handleReset = () => {
    reset();
    setFileA(null);
    setFileB(null);
    if (localPreviewA) { URL.revokeObjectURL(localPreviewA); setLocalPreviewA(null); }
    if (localPreviewB) { URL.revokeObjectURL(localPreviewB); setLocalPreviewB(null); }
  };

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      const makePCBPass = (): Promise<File> => new Promise(resolve => {
        const W = 600, H = 450;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        // PCB substrate — dark green with slight texture
        ctx.fillStyle = '#1a3a1e';
        ctx.fillRect(0, 0, W, H);
        // Subtle noise texture
        for (let i = 0; i < 4000; i++) {
          const x = Math.random() * W, y = Math.random() * H;
          ctx.fillStyle = `rgba(${Math.random()>0.5?60:20},${Math.random()>0.5?80:40},${Math.random()>0.5?30:15},0.15)`;
          ctx.fillRect(x, y, 2, 2);
        }
        // PCB edge border
        ctx.strokeStyle = '#2d5c32'; ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, W-6, H-6);
        ctx.strokeStyle = '#1e4422'; ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, W-20, H-20);

        // Mounting holes
        [[20,20],[W-20,20],[20,H-20],[W-20,H-20]].forEach(([x,y]) => {
          ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2);
          ctx.fillStyle = '#0a1a0c'; ctx.fill();
          ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 2; ctx.stroke();
        });

        // Copper traces (gold/amber)
        const drawTrace = (pts: number[][], w = 4) => {
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
          pts.slice(1).forEach(([x,y]) => ctx.lineTo(x, y));
          ctx.strokeStyle = '#b8860b'; ctx.lineWidth = w;
          ctx.shadowColor = '#d4a017'; ctx.shadowBlur = 3; ctx.stroke(); ctx.shadowBlur = 0;
        };
        drawTrace([[80,100],[200,100],[200,160],[340,160],[340,100],[460,100]]);
        drawTrace([[80,200],[150,200],[150,260],[200,260]]);
        drawTrace([[340,260],[400,260],[400,200],[480,200]]);
        drawTrace([[80,320],[460,320]]);
        drawTrace([[200,100],[200,60],[300,60],[300,100]]);
        drawTrace([[160,160],[160,320]],3);
        drawTrace([[380,160],[380,320]],3);
        drawTrace([[300,60],[300,200],[340,200]]);
        drawTrace([[200,260],[200,320]],3);
        drawTrace([[400,200],[400,320]],3);

        // IC chip (large)
        const icX = 195, icY = 155, icW = 150, icH = 110;
        ctx.fillStyle = '#1a1a2e'; ctx.fillRect(icX, icY, icW, icH);
        ctx.strokeStyle = '#404060'; ctx.lineWidth = 2; ctx.strokeRect(icX, icY, icW, icH);
        // IC label
        ctx.fillStyle = '#888aaa'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
        ctx.fillText('IC-MCU', icX+icW/2, icY+icH/2-6);
        ctx.font = '9px monospace'; ctx.fillText('STM32F4', icX+icW/2, icY+icH/2+8);
        // IC pins
        for (let i = 0; i < 6; i++) {
          const px = icX - 10, py = icY + 15 + i * 16;
          ctx.fillStyle = '#c8a800'; ctx.fillRect(px, py, 10, 6);
          const px2 = icX + icW, py2 = icY + 15 + i * 16;
          ctx.fillRect(px2, py2, 10, 6);
        }
        for (let i = 0; i < 5; i++) {
          const px = icX + 15 + i * 25, py = icY - 10;
          ctx.fillRect(px, py, 8, 10);
          const py2 = icY + icH;
          ctx.fillRect(px, py2, 8, 10);
        }

        // Capacitors (cylinders)
        const drawCap = (x: number, y: number) => {
          ctx.fillStyle = '#2a2a4a'; ctx.fillRect(x-10, y-14, 20, 28);
          ctx.strokeStyle = '#555588'; ctx.lineWidth = 1.5; ctx.strokeRect(x-10, y-14, 20, 28);
          ctx.fillStyle = '#888aaa'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
          ctx.fillText('100µF', x, y+4);
          ctx.fillStyle = '#b8860b'; ctx.fillRect(x-10, y-14, 20, 5);
        };
        drawCap(100, 200); drawCap(430, 200); drawCap(100, 310); drawCap(430, 310);

        // Resistors (small SMD)
        const drawRes = (x: number, y: number, val: string) => {
          ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x-12, y-6, 24, 12);
          ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1; ctx.strokeRect(x-12, y-6, 24, 12);
          ctx.fillStyle = '#b8860b'; ctx.fillRect(x-16, y-4, 4, 8); ctx.fillRect(x+12, y-4, 4, 8);
          ctx.fillStyle = '#ccc'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
          ctx.fillText(val, x, y+3);
        };
        drawRes(160, 130, '10K'); drawRes(380, 130, '4K7');
        drawRes(160, 290, '100R'); drawRes(380, 290, '1K');
        drawRes(250, 80, '22R'); drawRes(300, 340, '470R');

        // Solder pads — clean, shiny silver
        const pads: [number,number][] = [[80,100],[80,200],[80,320],[460,100],[460,200],[460,320],[300,60]];
        pads.forEach(([px,py]) => {
          const g = ctx.createRadialGradient(px,py,1,px,py,10);
          g.addColorStop(0,'#e8e8d0'); g.addColorStop(0.5,'#c0b870'); g.addColorStop(1,'#8a7a30');
          ctx.beginPath(); ctx.arc(px,py,10,0,Math.PI*2);
          ctx.fillStyle = g; ctx.fill();
          ctx.strokeStyle = '#a09040'; ctx.lineWidth = 1.5; ctx.stroke();
          // Center hole
          ctx.beginPath(); ctx.arc(px,py,3,0,Math.PI*2);
          ctx.fillStyle = '#0a0a0a'; ctx.fill();
        });

        // Silkscreen labels
        ctx.fillStyle = 'rgba(220,220,200,0.6)'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
        ctx.fillText('C1', 90, 195); ctx.fillText('C2', 440, 195);
        ctx.fillText('R1', 168, 125); ctx.fillText('R2', 388, 125);
        ctx.fillText('PCB-REV-2.1', 200, 430); ctx.fillText('DEMO PASS SAMPLE', 350, 430);

        // PASS badge
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(14, 14, 110, 34);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(16, 16, 106, 30);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
        ctx.fillText('✓  PASS', 69, 36);

        canvas.toBlob(blob => resolve(new File([blob!], 'demo-pass-pcb.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.92);
      });

      const makePCBFail = (): Promise<File> => new Promise(resolve => {
        const W = 600, H = 450;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        // Same PCB substrate but slightly discolored
        ctx.fillStyle = '#1c3820';
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 4000; i++) {
          const x = Math.random() * W, y = Math.random() * H;
          ctx.fillStyle = `rgba(${Math.random()>0.5?70:25},${Math.random()>0.5?60:30},${Math.random()>0.5?20:10},0.18)`;
          ctx.fillRect(x, y, 2, 2);
        }
        ctx.strokeStyle = '#2d5c32'; ctx.lineWidth = 6; ctx.strokeRect(3,3,W-6,H-6);
        ctx.strokeStyle = '#1e4422'; ctx.lineWidth = 2; ctx.strokeRect(10,10,W-20,H-20);

        // Mounting holes (same)
        [[20,20],[W-20,20],[20,H-20],[W-20,H-20]].forEach(([x,y]) => {
          ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2);
          ctx.fillStyle = '#0a1a0c'; ctx.fill();
          ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 2; ctx.stroke();
        });

        // Traces — some degraded/discolored
        const drawTrace = (pts: number[][], w = 4, color = '#9a6e08') => {
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
          pts.slice(1).forEach(([x,y]) => ctx.lineTo(x,y));
          ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
        };
        drawTrace([[80,100],[200,100],[200,160],[340,160],[340,100],[460,100]]);
        drawTrace([[80,200],[150,200],[150,260],[200,260]], 4, '#7a5006');
        drawTrace([[340,260],[400,260],[400,200],[480,200]]);
        drawTrace([[80,320],[460,320]]);
        drawTrace([[200,100],[200,60],[300,60],[300,100]]);
        drawTrace([[160,160],[160,320]],3);
        drawTrace([[380,160],[380,320]],3);
        drawTrace([[300,60],[300,200],[340,200]]);
        drawTrace([[200,260],[200,320]],3);
        drawTrace([[400,200],[400,320]],3);

        // IC chip (same base)
        const icX = 195, icY = 155, icW = 150, icH = 110;
        ctx.fillStyle = '#1e1e30'; ctx.fillRect(icX, icY, icW, icH);
        ctx.strokeStyle = '#505070'; ctx.lineWidth = 2; ctx.strokeRect(icX, icY, icW, icH);
        ctx.fillStyle = '#888aaa'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
        ctx.fillText('IC-MCU', icX+icW/2, icY+icH/2-6);
        ctx.font = '9px monospace'; ctx.fillText('STM32F4', icX+icW/2, icY+icH/2+8);
        for (let i = 0; i < 6; i++) {
          const px = icX-10, py = icY+15+i*16;
          ctx.fillStyle = i===2 ? '#3a2a0a' : '#c8a800'; ctx.fillRect(px,py,10,6);
          const px2 = icX+icW, py2 = icY+15+i*16;
          ctx.fillStyle = '#c8a800'; ctx.fillRect(px2,py2,10,6);
        }
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = '#c8a800';
          ctx.fillRect(icX+15+i*25, icY-10, 8, 10);
          ctx.fillRect(icX+15+i*25, icY+icH, 8, 10);
        }

        // Capacitors
        const drawCap = (x: number, y: number) => {
          ctx.fillStyle = '#2a2a4a'; ctx.fillRect(x-10,y-14,20,28);
          ctx.strokeStyle = '#555588'; ctx.lineWidth = 1.5; ctx.strokeRect(x-10,y-14,20,28);
          ctx.fillStyle = '#888aaa'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
          ctx.fillText('100µF', x, y+4);
          ctx.fillStyle = '#b8860b'; ctx.fillRect(x-10,y-14,20,5);
        };
        drawCap(100,200); drawCap(430,200); drawCap(100,310); drawCap(430,310);

        const drawRes = (x: number, y: number, val: string) => {
          ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x-12,y-6,24,12);
          ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1; ctx.strokeRect(x-12,y-6,24,12);
          ctx.fillStyle = '#b8860b'; ctx.fillRect(x-16,y-4,4,8); ctx.fillRect(x+12,y-4,4,8);
          ctx.fillStyle = '#ccc'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
          ctx.fillText(val, x, y+3);
        };
        drawRes(160,130,'10K'); drawRes(380,130,'4K7');
        drawRes(160,290,'100R'); drawRes(380,290,'1K');
        drawRes(250,80,'22R'); drawRes(300,340,'470R');

        // DEFECT 1: Corrosion / rust patches on pads
        const pads: [number,number,boolean][] = [[80,100,false],[80,200,true],[80,320,false],[460,100,false],[460,200,false],[460,320,true],[300,60,false]];
        pads.forEach(([px,py,corroded]) => {
          if (corroded) {
            // Corroded pad — brown/orange with rough texture
            const g = ctx.createRadialGradient(px,py,1,px,py,14);
            g.addColorStop(0,'#8b4513'); g.addColorStop(0.4,'#a0522d'); g.addColorStop(1,'#4a2008');
            ctx.beginPath(); ctx.arc(px,py,12,0,Math.PI*2);
            ctx.fillStyle = g; ctx.fill();
            // Rust specks
            for (let i = 0; i < 12; i++) {
              const angle = Math.random()*Math.PI*2, r = Math.random()*10;
              ctx.beginPath(); ctx.arc(px+Math.cos(angle)*r, py+Math.sin(angle)*r, Math.random()*3+1, 0, Math.PI*2);
              ctx.fillStyle = `rgba(${160+Math.random()*60},${60+Math.random()*30},0,0.8)`; ctx.fill();
            }
          } else {
            const g = ctx.createRadialGradient(px,py,1,px,py,10);
            g.addColorStop(0,'#e8e8d0'); g.addColorStop(0.5,'#c0b870'); g.addColorStop(1,'#8a7a30');
            ctx.beginPath(); ctx.arc(px,py,10,0,Math.PI*2);
            ctx.fillStyle = g; ctx.fill();
            ctx.strokeStyle = '#a09040'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.beginPath(); ctx.arc(px,py,3,0,Math.PI*2);
            ctx.fillStyle = '#0a0a0a'; ctx.fill();
          }
        });

        // DEFECT 2: Solder bridge between two traces (near R1)
        ctx.beginPath();
        ctx.moveTo(148, 126); ctx.quadraticCurveTo(160, 118, 172, 126);
        ctx.strokeStyle = '#d4d0a0'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
        ctx.lineCap = 'butt';
        // Solder blob highlight
        ctx.beginPath(); ctx.arc(160, 122, 5, 0, Math.PI*2);
        ctx.fillStyle = '#e8e4b8'; ctx.fill();

        // DEFECT 3: Burn mark / char near bottom right
        const burnX = 400, burnY = 300;
        const burnGrad = ctx.createRadialGradient(burnX,burnY,0,burnX,burnY,35);
        burnGrad.addColorStop(0,'rgba(10,5,0,0.95)');
        burnGrad.addColorStop(0.4,'rgba(40,20,5,0.8)');
        burnGrad.addColorStop(0.7,'rgba(80,40,10,0.5)');
        burnGrad.addColorStop(1,'rgba(60,30,0,0)');
        ctx.beginPath(); ctx.ellipse(burnX,burnY,38,28,0.3,0,Math.PI*2);
        ctx.fillStyle = burnGrad; ctx.fill();
        // Char cracks
        ctx.strokeStyle = 'rgba(20,10,0,0.9)'; ctx.lineWidth = 1.5;
        [[burnX-10,burnY-8,burnX+5,burnY+10],[burnX+8,burnY-12,burnX-4,burnY+6],[burnX-5,burnY+4,burnX+12,burnY-2]].forEach(([x1,y1,x2,y2]) => {
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        });

        // DEFECT 4: Missing solder on a via / cold joint
        ctx.beginPath(); ctx.arc(340, 100, 9, 0, Math.PI*2);
        ctx.fillStyle = '#1a3a1e'; ctx.fill(); // bare PCB color — solder missing
        ctx.strokeStyle = '#4a6a4e'; ctx.lineWidth = 1.5; ctx.setLineDash([3,2]); ctx.stroke(); ctx.setLineDash([]);
        // Label it
        ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
        ctx.fillText('COLD', 340, 116);

        // DEFECT 5: Hairline crack on trace
        ctx.save();
        ctx.strokeStyle = '#0e2410'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(200, 95); ctx.lineTo(210, 105); ctx.stroke();
        ctx.strokeStyle = '#0a1a0c'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(201,95); ctx.lineTo(211,105); ctx.stroke();
        ctx.restore();

        // Silkscreen labels
        ctx.fillStyle = 'rgba(220,220,200,0.6)'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
        ctx.fillText('C1', 90,195); ctx.fillText('C2', 440,195);
        ctx.fillText('R1', 168,125); ctx.fillText('R2', 388,125);
        ctx.fillText('PCB-REV-2.1', 200,430); ctx.fillText('DEMO FAIL SAMPLE', 350,430);

        // FAIL badge
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(14,14,110,34);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(16,16,106,30);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
        ctx.fillText('✕  FAIL', 69, 36);

        // Defect callout labels
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(430,240,138,80);
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1; ctx.strokeRect(430,240,138,80);
        ctx.fillStyle = '#ef4444'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left';
        ctx.fillText('⚠ DEFECTS FOUND:', 436, 255);
        ctx.fillStyle = '#ffaaaa'; ctx.font = '8px monospace';
        ctx.fillText('• Pad corrosion ×2', 436, 270);
        ctx.fillText('• Solder bridge', 436, 282);
        ctx.fillText('• Burn mark', 436, 294);
        ctx.fillText('• Cold joint / crack', 436, 306);

        canvas.toBlob(blob => resolve(new File([blob!], 'demo-fail-pcb.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.92);
      });

      const [fa, fb] = await Promise.all([makePCBPass(), makePCBFail()]);

      if (status === 'done') reset();
      if (localPreviewA) URL.revokeObjectURL(localPreviewA);
      if (localPreviewB) URL.revokeObjectURL(localPreviewB);
      setLocalPreviewA(URL.createObjectURL(fa));
      setLocalPreviewB(URL.createObjectURL(fb));
      setFileA(fa);
      setFileB(fb);
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Demo loader */}
      <button
        onClick={handleLoadDemo}
        disabled={loadingDemo || status === 'analyzing'}
        className="btn-ghost"
        style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: loadingDemo ? 0.5 : 1 }}
      >
        {loadingDemo
          ? <><span className="spin" style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block' }} /> 載入中…</>
          : <>🧪 載入 PCB 示範圖片（Pass vs 鏽蝕）</>
        }
      </button>

      {/* Upload Row */}
      <div style={{ display: 'flex', gap: 12 }}>
        <DropZone label="A" preview={previewA} color="var(--primary)"
          onFile={f => { setFileA(f); if (localPreviewA) URL.revokeObjectURL(localPreviewA); setLocalPreviewA(URL.createObjectURL(f)); if (status === 'done') reset(); }}
          disabled={status === 'analyzing'} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ width: 1, flex: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--subtext)', letterSpacing: '0.05em' }}>VS</span>
          <div style={{ width: 1, flex: 1, background: 'var(--border)' }} />
        </div>
        <DropZone label="B" preview={previewB} color="var(--accent)"
          onFile={f => { setFileB(f); if (localPreviewB) URL.revokeObjectURL(localPreviewB); setLocalPreviewB(URL.createObjectURL(f)); if (status === 'done') reset(); }}
          disabled={status === 'analyzing'} />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleCompare}
          disabled={!canCompare}
          className="btn-primary"
          style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700, opacity: canCompare ? 1 : 0.4 }}
        >
          {status === 'analyzing' ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span className="spin" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block' }} />
              Claude 比對中…
            </span>
          ) : '🔍 開始 A/B 比對'}
        </button>
        {(previewA || previewB) && (
          <button onClick={handleReset} className="btn-ghost" style={{ padding: '10px 16px', fontSize: 12 }}>
            重置
          </button>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Similarity Bar */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>相似度</span>
              <span style={{
                fontSize: 24, fontWeight: 800, fontFamily: 'monospace',
                color: result.similarity >= 70 ? 'var(--success)' : result.similarity >= 40 ? 'var(--warning)' : 'var(--danger)',
              }}>
                {result.similarity}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: result.similarity >= 70 ? 'var(--success)' : result.similarity >= 40 ? 'var(--warning)' : 'var(--danger)',
                width: `${result.similarity}%`,
                transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
          </div>

          {/* Two mini result cards */}
          <div style={{ display: 'flex', gap: 12 }}>
            <MiniResult label="A" result={result.imageA} color="var(--primary)" />
            <MiniResult label="B" result={result.imageB} color="var(--accent)" />
          </div>

          {/* Differences Table */}
          {result.differences.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="section-label">差異明細</span>
                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  {result.differences.length}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['#', '來源', '位置', '嚴重度', '描述'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.differences.map((d, i) => <DiffRow key={i} diff={d} index={i} />)}
                </tbody>
              </table>
            </div>
          )}

          {result.differences.length === 0 && (
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700 }}>兩張圖片無明顯差異</p>
            </div>
          )}

          {/* Verdict */}
          <div style={{ padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'rgba(79,124,255,0.08)', border: '1px solid rgba(79,124,255,0.2)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              AI 比對結論
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>{result.verdict}</p>
          </div>

        </div>
      )}

      {status === 'error' && (
        <div className="card" style={{ padding: '20px', textAlign: 'center', borderColor: 'rgba(239,68,68,0.3)' }}>
          <p style={{ fontSize: 13, color: 'var(--danger)' }}>比對失敗，請稍後再試或檢查伺服器設定。</p>
        </div>
      )}

    </div>
  );
};
