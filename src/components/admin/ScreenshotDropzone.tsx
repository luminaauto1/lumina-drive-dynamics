import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

interface ScreenshotDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Hint label shown inside the dropzone. */
  hint?: string;
}

/**
 * Minimal dark dropzone supporting click-to-select, drag-and-drop,
 * and clipboard paste (Cmd/Ctrl+V). Single image only.
 */
const ScreenshotDropzone = ({ file, onFileChange, hint }: ScreenshotDropzoneProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Global paste listener — only active while mounted.
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const named = new File([blob], `pasted-${Date.now()}.png`, { type: blob.type });
            onFileChange(named);
            e.preventDefault();
            return;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFileChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith('image/')) onFileChange(dropped);
  }, [onFileChange]);

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={[
          'relative cursor-pointer border border-dashed rounded-md transition-colors',
          'flex items-center justify-center text-center px-4 py-8',
          dragOver
            ? 'border-white/40 bg-white/5'
            : 'border-white/10 bg-black/40 hover:border-white/20 hover:bg-white/5',
        ].join(' ')}
      >
        {preview ? (
          <div className="relative w-full">
            <img src={preview} alt="Screenshot preview" className="max-h-48 mx-auto rounded border border-white/10" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFileChange(null); }}
              className="absolute -top-2 -right-2 bg-zinc-900 border border-white/20 rounded-full p-1 hover:bg-zinc-800"
              aria-label="Remove screenshot"
            >
              <X className="w-3 h-3 text-white/70" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 text-white/50">
            <Upload className="w-6 h-6 mx-auto" />
            <p className="text-sm text-white/70">
              {hint || 'Drop, click, or paste a screenshot'}
            </p>
            <p className="text-[11px] text-white/40">PNG · JPG · WebP</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileChange(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};

export default ScreenshotDropzone;
