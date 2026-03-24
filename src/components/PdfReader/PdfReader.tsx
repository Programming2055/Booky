import { useEffect, useRef, useCallback, useState } from 'react';
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
  fileName,
  initialPage = 1,
  onClose,
}: PdfReaderProps) {
  const { saveReadingProgress, state } = useApp();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval>>(undefined);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const basePath = import.meta.env.BASE_URL || '/';
  const viewerUrl = `${basePath}pdfjs/web/viewer.html?file=${encodeURIComponent(fileUrl)}#page=${initialPage}`;

  const bookFileName = fileName || state.books.find(b => b.id === bookId)?.fileName || 'document.pdf';
  const title = bookFileName.replace(/\.[^/.]+$/, '');

  // Poll the iframe's pdf.js viewer for page info to save reading progress
  const startProgressTracking = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);

    progressInterval.current = setInterval(() => {
      try {
        const iframeWindow = iframeRef.current?.contentWindow as any;
        if (!iframeWindow?.PDFViewerApplication?.pdfViewer) return;

        const viewer = iframeWindow.PDFViewerApplication.pdfViewer;
        const current = viewer.currentPageNumber;
        const total = iframeWindow.PDFViewerApplication.pagesCount;

        if (current && total) {
          setCurrentPage(current);
          setTotalPages(total);
          setIsLoading(false);
          const percentage = Math.round((current / total) * 100);
          saveReadingProgress(bookId, { currentPage: current, totalPages: total, percentage });
        }
      } catch {
        // iframe not ready or cross-origin — ignore
      }
    }, 1500);
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
        <div className="pdf-reader-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="pdf-title" title={title}>{title}</span>
          {!isLoading && totalPages > 0 && (
            <span className="pdf-page-info">
              Page {currentPage} of {totalPages} ({Math.round((currentPage / totalPages) * 100)}%)
            </span>
          )}
        </div>
        <button className="pdf-close-btn" onClick={onClose} title="Close (Esc)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {isLoading && (
        <div className="pdf-loading-indicator">
          <div className="pdf-spinner" />
          <span>Loading PDF...</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="pdf-viewer-iframe"
        src={viewerUrl}
        title="PDF Viewer"
      />
    </div>
  );
}
