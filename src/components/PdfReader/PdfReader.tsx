import { useEffect, useRef, useCallback, useState } from 'react';
import { useApp } from '../../context';
import type { PdfAnnotation } from '../../types';
import 'pdfjs-viewer-element';
import './PdfReader.css';

type SpreadMode = 'none' | 'odd' | 'even';

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#ffeb3b' },
  { name: 'Green', value: '#4caf50' },
  { name: 'Blue', value: '#2196f3' },
  { name: 'Pink', value: '#e91e63' },
  { name: 'Orange', value: '#ff9800' },
];

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
  const { saveReadingProgress, state, dispatch } = useApp();
  const viewerRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSavedPageRef = useRef(initialPage);
  const appRef = useRef<any>(null);
  const [spreadMode, setSpreadMode] = useState<SpreadMode>('none');
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [highlights, setHighlights] = useState<PdfAnnotation[]>(() => {
    const book = state.books.find(b => b.id === bookId);
    return book?.annotations?.filter(a => a.type === 'highlight') || [];
  });
  const [showHighlightPanel, setShowHighlightPanel] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string; page: number } | null>(null);
  const highlightPanelRef = useRef<HTMLDivElement>(null);

  const bookFileName = fileName || state.books.find(b => b.id === bookId)?.fileName || 'document.pdf';
  const title = bookFileName.replace(/\.pdf$/i, '');

  // Determine theme
  const getViewerTheme = useCallback(() => {
    return state.theme === 'dark' ? 'DARK' : 'LIGHT';
  }, [state.theme]);

  // Save progress
  const handleSaveProgress = useCallback(async (page: number, total: number) => {
    if (page === lastSavedPageRef.current) return;
    lastSavedPageRef.current = page;
    const percentage = total > 0 ? Math.round((page / total) * 100) : 0;
    await saveReadingProgress(bookId, {
      currentPage: page,
      totalPages: total,
      percentage,
    });
  }, [bookId, saveReadingProgress]);

  // Wire up viewer events
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;

    const handleInitialized = (e: Event) => {
      const { viewerApp } = (e as CustomEvent).detail;
      appRef.current = viewerApp;

      viewerApp.eventBus?.on?.('pagechanging', (evt: { pageNumber: number }) => {
        const page = evt.pageNumber;
        const total = viewerApp.pagesCount || 0;
        handleSaveProgress(page, total);
      });
    };

    el.addEventListener('initialized', handleInitialized);
    return () => el.removeEventListener('initialized', handleInitialized);
  }, [handleSaveProgress]);

  // Theme sync
  useEffect(() => {
    viewerRef.current?.setAttribute('viewer-css-theme', getViewerTheme());
  }, [getViewerTheme]);

  // Spread mode toggle
  useEffect(() => {
    if (!appRef.current) return;
    const spreadMap: Record<SpreadMode, number> = { none: 0, odd: 1, even: 2 };
    appRef.current.pdfViewer?.spreadMode !== undefined &&
      (appRef.current.pdfViewer.spreadMode = spreadMap[spreadMode]);
  }, [spreadMode]);

  // Inject custom CSS for better highlights and text selection
  useEffect(() => {
    const el = viewerRef.current as any;
    if (!el) return;
    const injectStyles = () => {
      el.injectViewerStyles?.(`
        /* Improved text selection */
        .textLayer ::selection {
          background: rgba(0, 100, 200, 0.3) !important;
          mix-blend-mode: multiply;
        }
        /* Highlight annotation colors */
        .annotationLayer .highlightAnnotation {
          mix-blend-mode: multiply;
        }
        /* Smooth text layer readability */
        .textLayer {
          opacity: 0.25;
          transition: opacity 0.3s ease;
        }
        .textLayer:hover {
          opacity: 0.6;
        }
        .textLayer span {
          cursor: text;
        }
        /* Custom highlight overlays */
        .pdf-custom-highlight {
          position: absolute;
          mix-blend-mode: multiply;
          pointer-events: none;
          border-radius: 2px;
          opacity: 0.4;
        }
      `);
    };
    el.addEventListener('initialized', injectStyles, { once: true });
    return () => el.removeEventListener('initialized', injectStyles);
  }, []);

  // Listen for text selection inside the PDF iframe
  useEffect(() => {
    const el = viewerRef.current as any;
    if (!el) return;

    const setupSelectionListener = () => {
      const iframe = el.querySelector?.('iframe') || el.shadowRoot?.querySelector?.('iframe');
      if (!iframe?.contentDocument) return;
      const iframeDoc = iframe.contentDocument;

      const handleMouseUp = () => {
        const sel = iframeDoc.getSelection?.();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setSelectionPopup(null);
          return;
        }
        const text = sel.toString().trim();
        if (!text) return;

        // Get page number from the selection
        const range = sel.getRangeAt(0);
        const pageEl = range.startContainer?.parentElement?.closest?.('.page');
        const pageNum = pageEl ? parseInt(pageEl.getAttribute('data-page-number') || '1') : 1;

        // Position popup near selection
        const rect = range.getBoundingClientRect();
        const iframeRect = iframe.getBoundingClientRect();
        setSelectionPopup({
          x: iframeRect.left + rect.left + rect.width / 2,
          y: iframeRect.top + rect.top - 40,
          text: text.slice(0, 500),
          page: pageNum,
        });
      };

      iframeDoc.addEventListener('mouseup', handleMouseUp);
      return () => iframeDoc.removeEventListener('mouseup', handleMouseUp);
    };

    // Retry since iframe may not be ready immediately
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => { cleanup = setupSelectionListener(); }, 1500);
    return () => { clearTimeout(timer); cleanup?.(); };
  }, []);

  // Add a highlight from selection
  const addHighlight = useCallback(() => {
    if (!selectionPopup) return;
    const newAnnotation: PdfAnnotation = {
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      page: selectionPopup.page,
      type: 'highlight',
      color: highlightColor,
      text: selectionPopup.text,
      createdAt: Date.now(),
    };
    setHighlights(prev => {
      const updated = [...prev, newAnnotation];
      // Save to book annotations
      const book = state.books.find(b => b.id === bookId);
      if (book) {
        dispatch({ type: 'UPDATE_BOOK', payload: { ...book, annotations: updated } });
      }
      return updated;
    });
    setSelectionPopup(null);
  }, [selectionPopup, highlightColor, bookId, state.books]);

  const removeHighlight = useCallback((id: string) => {
    setHighlights(prev => {
      const updated = prev.filter(h => h.id !== id);
      const book = state.books.find(b => b.id === bookId);
      if (book) {
        dispatch({ type: 'UPDATE_BOOK', payload: { ...book, annotations: updated } });
      }
      return updated;
    });
  }, [bookId, state.books]);

  // Close panels on outside click
  useEffect(() => {
    if (!showHighlightPanel) return;
    const handleClick = (e: MouseEvent) => {
      if (highlightPanelRef.current && !highlightPanelRef.current.contains(e.target as Node)) {
        setShowHighlightPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showHighlightPanel]);

  // Esc to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="pdf-reader-overlay" ref={containerRef}>
      <div className="pdf-reader-topbar">
        <div className="pdf-reader-topbar-title" title={title}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>{title}</span>
        </div>
        <div className="pdf-reader-topbar-actions">
          {/* Spread / two-page mode */}
          <div className="pdf-reader-spread-group">
            <button
              className={`pdf-reader-topbar-btn${spreadMode === 'none' ? ' active' : ''}`}
              onClick={() => setSpreadMode('none')}
              title="Single page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="3" width="14" height="18" rx="2" />
              </svg>
            </button>
            <button
              className={`pdf-reader-topbar-btn${spreadMode === 'odd' ? ' active' : ''}`}
              onClick={() => setSpreadMode('odd')}
              title="Two pages (odd)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="9" height="18" rx="1" />
                <rect x="13" y="3" width="9" height="18" rx="1" />
              </svg>
            </button>
            <button
              className={`pdf-reader-topbar-btn${spreadMode === 'even' ? ' active' : ''}`}
              onClick={() => setSpreadMode('even')}
              title="Two pages (even)"
            >
              <svg width="18" height="16" viewBox="0 0 26 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="3" width="9" height="18" rx="1" />
                <rect x="12" y="5" width="9" height="14" rx="1" />
                <rect x="16" y="3" width="9" height="18" rx="1" />
              </svg>
            </button>
          </div>

          {/* Highlights */}
          <button
            className={`pdf-reader-topbar-btn${showHighlightPanel ? ' active' : ''}`}
            onClick={() => setShowHighlightPanel(v => !v)}
            title="Highlights"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
            {highlights.length > 0 && <span className="pdf-badge">{highlights.length}</span>}
          </button>

          <button className="pdf-reader-topbar-close" onClick={onClose} title="Close (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Highlights panel */}
        {showHighlightPanel && (
          <div className="pdf-reader-panel pdf-highlight-panel" ref={highlightPanelRef}>
            <div className="pdf-panel-header">
              <span>Highlights ({highlights.length})</span>
              <span className="pdf-panel-hint">Select text to highlight</span>
            </div>
            <div className="pdf-panel-section">
              <label>Highlight Color</label>
              <div className="pdf-color-row">
                {HIGHLIGHT_COLORS.map(c => (
                  <button
                    key={c.name}
                    className={`pdf-color-swatch${highlightColor === c.value ? ' active' : ''}`}
                    style={{ background: c.value }}
                    onClick={() => setHighlightColor(c.value)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
            <div className="pdf-highlight-list">
              {highlights.length === 0 && <div className="pdf-highlight-empty">No highlights yet</div>}
              {highlights.map(h => (
                <div key={h.id} className="pdf-highlight-item">
                  <div className="pdf-highlight-color-bar" style={{ background: h.color }} />
                  <div className="pdf-highlight-content">
                    <span className="pdf-highlight-page">Page {h.page}</span>
                    <span className="pdf-highlight-text">{h.text}</span>
                  </div>
                  <button className="pdf-highlight-remove" onClick={() => removeHighlight(h.id)} title="Remove">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="pdf-reader-body">
        {/* @ts-expect-error - custom element with valid attributes */}
        <pdfjs-viewer-element
          ref={viewerRef as React.RefObject<any>}
          src={fileUrl}
          page={String(initialPage)}
          viewer-css-theme={getViewerTheme()}
          pagemode="none"
          iframe-title={`PDF: ${title}`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {/* Selection popup for highlighting */}
      {selectionPopup && (
        <div
          className="pdf-selection-popup"
          style={{ left: selectionPopup.x, top: selectionPopup.y }}
        >
          <span className="pdf-popup-label">Highlight:</span>
          {HIGHLIGHT_COLORS.map(c => (
            <button
              key={c.name}
              className="pdf-popup-color"
              style={{ background: c.value }}
              onClick={() => { setHighlightColor(c.value); addHighlight(); }}
              title={c.name}
            />
          ))}
          <button className="pdf-popup-close" onClick={() => setSelectionPopup(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
