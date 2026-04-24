import React, { useCallback, useRef } from 'react';
import type { InspectionStatus } from '../types';
import { Icon } from '../../../components/muji/Icon';

interface Props {
  imagePreview: string | null;
  status: InspectionStatus;
  onFileSelect: (file: File) => void;
  onReset: () => void;
}

export const ImageUploader: React.FC<Props> = ({ imagePreview, status, onFileSelect, onReset }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState(false);
  const analyzing = status === 'analyzing';

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(true);
  }, []);

  const handleDragLeave = useCallback(() => setDrag(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) onFileSelect(file);
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  if (imagePreview) {
    return (
      <div className="anim-in" style={{
        position: 'relative',
        background: 'var(--paper-soft)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
      }}>
        <div style={{ background: 'var(--paper-dim)', position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <img
            src={imagePreview}
            alt="檢測圖片"
            style={{ width: '100%', maxHeight: 360, objectFit: 'contain', display: 'block' }}
          />
          {analyzing && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(245, 241, 234, 0.78)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 14,
              backdropFilter: 'blur(2px)',
            }}>
              <div className="soft-loader"><span/><span/><span/></div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--clay-deep)', letterSpacing: '0.15em' }}>
                解析中…
              </div>
            </div>
          )}
        </div>
        {!analyzing && (
          <button
            onClick={onReset}
            className="btn btn-ghost"
            style={{
              position: 'absolute', top: 10, right: 10,
              padding: '5px 12px', fontSize: 11,
              background: 'var(--paper-soft)',
              borderColor: 'var(--line)',
            }}
          >
            重新上傳
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={'uploader' + (drag ? ' drag' : '')}
        onClick={() => !analyzing && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Icon.Upload width={24} height={24} style={{ margin: '0 auto 14px', display: 'block', color: 'var(--clay)' }} />
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)', letterSpacing: '0.08em', marginBottom: 6 }}>
          上傳檢測圖片
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>
          點擊或將圖片拖曳至此處
        </div>
        <div className="label-en" style={{ fontSize: 9 }}>
          JPG · PNG · WEBP · 最大 10MB
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={handleChange} />
    </>
  );
};
