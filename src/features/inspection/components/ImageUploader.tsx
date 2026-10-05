import React, { useCallback, useRef, useState } from 'react';
import { Icon } from '../../../components/ui/icons';

interface Props {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  title: React.ReactNode;
  hint?: React.ReactNode;
}

/** 晶粒影像上傳區：點擊或拖曳；只接受圖片。 */
export const ImageUploader: React.FC<Props> = ({ onFiles, multiple = false, disabled = false, title, hint }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const take = useCallback((list: FileList | null) => {
    if (!list || disabled) return;
    const files = Array.from(list).filter(f => f.type.startsWith('image/'));
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  }, [disabled, multiple, onFiles]);

  return (
    <>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        className={'dropzone' + (drag ? ' is-drag' : '')}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
      >
        <Icon.Upload width={24} height={24} style={{ color: 'var(--si-600)' }} />
        <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
        {hint && <div className="small">{hint}</div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={e => { take(e.target.files); e.target.value = ''; }}
      />
    </>
  );
};
