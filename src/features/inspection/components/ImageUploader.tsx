import React, { useCallback, useRef } from 'react';
import type { InspectionStatus } from '../types';

interface Props {
  imagePreview: string | null;
  status: InspectionStatus;
  onFileSelect: (file: File) => void;
  onReset: () => void;
}

export const ImageUploader: React.FC<Props> = ({ imagePreview, status, onFileSelect, onReset }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isAnalyzing = status === 'analyzing';

  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) onFileSelect(file);
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  if (imagePreview) {
    return (
      <div className="card anim-in" style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: '#000',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      }}>
        <img
          src={imagePreview}
          alt="檢測圖片"
          style={{ width: '100%', maxHeight: 320, objectFit: 'contain', display: 'block' }}
        />

        {/* Scan overlay */}
        {isAnalyzing && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(79,124,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}>
            <div className="status-badge" style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid var(--primary)', color: 'var(--primary)', gap: 8, padding: '10px 20px', fontSize: 14 }}>
               <span className="spin" style={{ width: 14, height: 14, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
               智慧掃描分析中...
            </div>
          </div>
        )}

        {/* Reset button */}
        {!isAnalyzing && (
          <button
            onClick={onReset}
            className="btn-ghost"
            style={{
              position: 'absolute', top: 12, right: 12,
              padding: '6px 12px', fontSize: 11,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            ✕ 重新上傳
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        onClick={() => !isAnalyzing && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="upload-box anim-in"
        style={{
          borderColor: isDragging ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
          background: isDragging 
            ? 'radial-gradient(circle at top, rgba(79,124,255,0.15), transparent), rgba(0,0,0,0.2)' 
            : 'var(--bg-elevated)',
          transform: isDragging ? 'scale(1.01)' : 'none',
          boxShadow: isDragging ? '0 0 30px rgba(79,124,255,0.1)' : 'none',
          borderStyle: isDragging ? 'solid' : 'dashed',
          padding: '40px 20px',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: isDragging 
            ? 'var(--primary)' 
            : 'rgba(255,255,255,0.03)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, margin: '0 auto 16px',
          transition: 'all 0.2s',
        }}>
          <svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke={isDragging ? '#fff' : 'var(--primary)'} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            {isDragging ? '準備開始分析' : '上傳待測樣本圖片'}
          </h3>
          <p style={{ fontSize: 11, color: 'var(--neutral-400)', fontWeight: 600, marginBottom: 12 }}>
            點擊或將圖片拖曳至此處
          </p>
          
          <div style={{ 
            display: 'inline-flex', gap: 12, padding: '6px 12px', 
            background: 'rgba(255,255,255,0.03)', borderRadius: 8,
            fontSize: 9, color: 'var(--neutral-600)', fontWeight: 700,
            letterSpacing: '0.1em'
          }}>
            <span>JPG</span><span>PNG</span><span>WEBP</span>
          </div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={handleChange} />
    </>
  );
};
