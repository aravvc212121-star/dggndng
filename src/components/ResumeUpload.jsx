import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, Loader } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function ResumeUpload({ onParsed, existingProfile }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState(existingProfile ? 'resume uploaded' : null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const extractText = useCallback(async (file) => {
    setError(null);
    setUploading(true);
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        text += pageText + '\n';
      }

      if (!text.trim()) {
        throw new Error('Could not extract text from this PDF. It might be image-based.');
      }

      onParsed(text.trim());
    } catch (err) {
      setError(err.message || 'Failed to read PDF');
      setFileName(null);
    } finally {
      setUploading(false);
    }
  }, [onParsed]);

  function handleFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB)');
      return;
    }
    extractText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  function handleChange(e) {
    const file = e.target.files[0];
    handleFile(file);
  }

  function handleClear() {
    setFileName(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div id="resume-upload">
      <div
        className={`drop-zone flex flex-col items-center justify-center p-8 cursor-pointer ${
          dragOver ? 'drag-over' : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
        />

        {uploading ? (
          <>
            <Loader size={24} strokeWidth={1.5} className="text-[var(--color-text-tertiary)] animate-spin mb-2" />
            <span className="text-sm text-[var(--color-text-secondary)]">reading resume...</span>
          </>
        ) : fileName ? (
          <>
            <FileText size={24} strokeWidth={1.5} className="text-[var(--color-accent)] mb-2" />
            <span className="text-sm text-[var(--color-text-primary)] font-medium">{fileName}</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] bg-transparent border-0 cursor-pointer transition-default"
            >
              <X size={12} strokeWidth={1.5} />
              remove
            </button>
          </>
        ) : (
          <>
            <Upload size={24} strokeWidth={1.5} className="text-[var(--color-text-tertiary)] mb-2" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              drop your resume PDF here, or click to browse
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)] mt-1">PDF only, max 10MB</span>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-[var(--color-danger)] mt-2 m-0">{error}</p>
      )}
    </div>
  );
}
