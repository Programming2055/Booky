import { useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context';
import './PdfReader.css';

interface PdfReaderProps {
  fileUrl: string;
  bookId: string;
  fileName?: string;
  initialPage?: number;
  onClose: () => void;
}

export function PdfReader({
  fileUrl,
  bookId,
  initialPage = 1,
  onClose,
}: PdfReaderProps) {
  const { saveReadingProgress } = useApp();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval>>(undefined);

  const basePath = import.meta.env.BASE_URL || '/';
  const viewerUrl = `${basePath}pdfjs/web/viewer.html?file=${encodeURIComponent(fileUrl)}#page=${initialPage}`;

  // Poll the iframe's pdf.js viewer for page info to save reading progress
  const startProgressTracking = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);

    progressInterval.current = setInterval(() => {
      try {
        const iframeWindow = iframeRef.current?.contentWindow as any;
        if (!iframeWindow?.PDFViewerApplication?.pdfViewer) return;

        const viewer = iframeWindow.PDFViewerApplication.pdfViewer;
        const currentPage = viewer.currentPageNumber;
        const totalPages = iframeWindow.PDFViewerApplication.pagesCount;

        if (currentPage && totalPages) {
          const percentage = Math.round((currentPage / totalPages) * 100);
          saveReadingProgress(bookId, { currentPage, totalPages, percentage });
        }
      } catch {
        // iframe not ready or cross-origin — ignore
      }
    }, 2000);
  }, [bookId, saveReadingProgress]);

  useEffect(() => {
    startProgressTracking();
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [startProgressTracking]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="pdf-reader-overlay">
      <div className="pdf-reader-topbar">
        <button className="pdf-close-btn" onClick={onClose} title="Close (Esc)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <iframe
        ref={iframeRef}
        className="pdf-viewer-iframe"
        src={viewerUrl}
        title="PDF Viewer"
      />
    </div>
  );
}
