import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '../utils/cn';

/** Extensões/MIME alinhados ao `storage.allowedMimeTypes` da API (quando não há override por env). */
export const DEFAULT_FILE_UPLOAD_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/heic',
  'image/heif',
  '.heic',
  '.heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
].join(',');

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  maxSize?: number; // em MB
  className?: string;
}

export const FileUpload = ({
  onFileSelect,
  accept = DEFAULT_FILE_UPLOAD_ACCEPT,
  maxSize = 25,
  className,
}: FileUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxBytes = maxSize * 1024 * 1024;

  const applyFile = useCallback(
    (file: File | null) => {
      setError(null);
      if (!file) return;

      if (file.size > maxBytes) {
        setError(`Arquivo muito grande. Máximo ${maxSize}MB.`);
        return;
      }

      setSelectedFile(file);
      onFileSelect(file);
    },
    [maxBytes, maxSize, onFileSelect],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    applyFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    onFileSelect(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    applyFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isImage = selectedFile?.type.startsWith('image/');

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Anexar comprovante: clique ou largue um ficheiro aqui"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/5 p-6 transition-all duration-200 outline-none hover:border-accent/40 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
          selectedFile && 'border-accent/30 bg-accent/5',
          error && 'border-destructive/40 bg-destructive/5',
          isDragging && 'border-accent/50 bg-accent/10 scale-[1.01]',
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={accept}
          className="hidden"
        />

        {!selectedFile ? (
          <>
            <div className="mb-2 rounded-full bg-accent/10 p-2 text-accent">
              <Upload className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-xs font-medium text-foreground/80">Clique ou arraste o comprovante</p>
            <p className="mt-1 max-w-[16rem] text-center text-[10px] text-muted-foreground">
              Imagens (PNG, JPG, WebP, GIF, AVIF, TIFF, HEIC) · PDF · Word · Excel · CSV · até {maxSize}
              MB
            </p>
          </>
        ) : (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
                {isImage ? (
                  <ImageIcon className="h-5 w-5" aria-hidden />
                ) : (
                  <FileText className="h-5 w-5" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-xs font-semibold text-foreground">{selectedFile.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFile();
              }}
              className="rounded-full bg-white/10 p-1.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
              aria-label="Remover ficheiro"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-[10px] font-medium text-destructive ml-1">{error}</p>}
    </div>
  );
};
