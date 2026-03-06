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

// Rect relative to page
interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionData {
  x: number;
  y: number;
  text: string;
  page: number;
  rects: HighlightRect[];
}

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
  const { saveReadingProgress, state, updateBook } = useApp();
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
  const [selectionPopup, setSelectionPopup] = useState<SelectionData | null>(null);
  const highlightPanelRef = useRef<HTMLDivElement>(null);
  const iframeDocRef = useRef<Document | null>(null);

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
        /* Selection styling */
        .textLayer ::selection {
          background: rgba(66, 133, 244, 0.35) !important;
        }
        /* Custom highlight overlays */
        .pdf-highlight-overlay {
          position: absolute;
          pointer-events: none;
          border-radius: 2px;
          opacity: 0.4;
          mix-blend-mode: multiply;
          z-index: 1;
        }
        /* Hide the annotationLayer default highlights */
        .annotationLayer .highlightAnnotation {
          display: none !important;
        }
        /* Hide the pdfjs annotation editor toolbar entirely */
        #editorModeButtons,
        .editorParamsToolbar,
        #editorHighlight,
        #editorFreeText,
        #editorInk,
        #editorStamp,
        .secondaryToolbarButtonContainer button[id^="editor"],
        [data-element="editorModeButtons"],
        .annotationEditorLayer {
          display: none !important;
        }
      `);
    };
    el.addEventListener('initialized', injectStyles, { once: true });
    return () => el.removeEventListener('initialized', injectStyles);
  }, []);

  // Helper: render highlight overlays in the iframe
  const renderHighlightOverlays = useCallback((iframeDoc: Document, highlightsToRender?: PdfAnnotation[]) => {
    const toRender = highlightsToRender ?? highlights;
    // Remove existing overlays
    iframeDoc.querySelectorAll('.pdf-highlight-overlay').forEach(el => el.remove());
    
    // Add overlays for each highlight
    toRender.forEach(h => {
      if (!h.rects || h.rects.length === 0) return;
      const pageEl = iframeDoc.querySelector(`.page[data-page-number="${h.page}"]`);
      if (!pageEl) return;
      
      h.rects.forEach((rect) => {
        const overlay = iframeDoc.createElement('div');
        overlay.className = 'pdf-highlight-overlay';
        overlay.dataset.highlightId = h.id;
        overlay.style.cssText = `
          left: ${rect.x}px;
          top: ${rect.y}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background: ${h.color};
        `;
        pageEl.appendChild(overlay);
      });
    });
  }, [highlights]);

  // Listen for text selection inside the PDF iframe
  useEffect(() => {
    const el = viewerRef.current as any;
    if (!el) return;

    const setupSelectionListener = () => {
      const iframe = el.querySelector?.('iframe') || el.shadowRoot?.querySelector?.('iframe');
      if (!iframe?.contentDocument) return;
      const iframeDoc = iframe.contentDocument;
      iframeDocRef.current = iframeDoc;

      // Render existing highlights
      renderHighlightOverlays(iframeDoc);

      const handleMouseUp = () => {
        const sel = iframeDoc.getSelection?.();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setSelectionPopup(null);
          return;
        }
        const text = sel.toString().trim();
        if (!text) return;

        // Get page element and page number
        const range = sel.getRangeAt(0);
        const pageEl = range.startContainer?.parentElement?.closest?.('.page') as HTMLElement;
        if (!pageEl) {
          setSelectionPopup(null);
          return;
        }
        const pageNum = parseInt(pageEl.getAttribute('data-page-number') || '1');

        // Get rects relative to page
        const pageRect = pageEl.getBoundingClientRect();
        const clientRects = range.getClientRects();
        const rects: HighlightRect[] = [];
        
        for (let i = 0; i < clientRects.length; i++) {
          const r = clientRects[i];
          // Only include rects within this page
          if (r.width > 0 && r.height > 0) {
            rects.push({
              x: r.left - pageRect.left,
              y: r.top - pageRect.top,
              width: r.width,
              height: r.height,
            });
          }
        }

        if (rects.length === 0) {
          setSelectionPopup(null);
          return;
        }

        // Position popup near selection (in viewport coords)
        const firstRect = clientRects[0];
        const iframeRect = iframe.getBoundingClientRect();
        
        setSelectionPopup({
          x: iframeRect.left + firstRect.left + firstRect.width / 2,
          y: iframeRect.top + firstRect.top - 50,
          text: text.slice(0, 500),
          page: pageNum,
          rects,
        });
      };

      // Re-render highlights when pages change
      const handlePageChange = () => {
        setTimeout(() => renderHighlightOverlays(iframeDoc), 100);
      };
      
      iframeDoc.addEventListener('mouseup', handleMouseUp);
      iframeDoc.addEventListener('scroll', handlePageChange);
      
      return () => {
        iframeDoc.removeEventListener('mouseup', handleMouseUp);
        iframeDoc.removeEventListener('scroll', handlePageChange);
      };
    };

    // Retry since iframe may not be ready immediately
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => { cleanup = setupSelectionListener(); }, 1500);
    return () => { clearTimeout(timer); cleanup?.(); };
  }, [renderHighlightOverlays]);

  // Add a highlight from selection
  const addHighlight = useCallback(async (color: string) => {
    if (!selectionPopup) return;
    
    const newAnnotation: PdfAnnotation = {
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      page: selectionPopup.page,
      type: 'highlight',
      color: color,
      text: selectionPopup.text,
      rects: selectionPopup.rects,
      createdAt: Date.now(),
    };
    
    const book = state.books.find(b => b.id === bookId);
    if (book) {
      const updated = [...(book.annotations || []), newAnnotation];
      const newHighlights = updated.filter(a => a.type === 'highlight');
      setHighlights(newHighlights);
      await updateBook({ ...book, annotations: updated, updatedAt: Date.now() });
      
      // Immediately render the new highlight, passing new highlights to avoid closure issues
      if (iframeDocRef.current) {
        iframeDocRef.current.getSelection?.()?.removeAllRanges();
        renderHighlightOverlays(iframeDocRef.current, newHighlights);
      }
    }
    
    setSelectionPopup(null);
  }, [selectionPopup, bookId, state.books, updateBook, renderHighlightOverlays]);

  const removeHighlight = useCallback(async (id: string) => {
    const book = state.books.find(b => b.id === bookId);
    if (book) {
      const updated = (book.annotations || []).filter(h => h.id !== id);
      const newHighlights = updated.filter(a => a.type === 'highlight');
      setHighlights(newHighlights);
      await updateBook({ ...book, annotations: updated, updatedAt: Date.now() });
      
      // Re-render highlights, passing new highlights to avoid closure issues
      if (iframeDocRef.current) {
        renderHighlightOverlays(iframeDocRef.current, newHighlights);
      }
    }
  }, [bookId, state.books, updateBook, renderHighlightOverlays]);

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
            className={`pdf-reader-topbar-btn pdf-highlight-btn${showHighlightPanel ? ' active' : ''}`}
            onClick={() => setShowHighlightPanel(v => !v)}
            title="Highlights"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              onClick={() => addHighlight(c.value)}
              title={c.name}
            />
          ))}
          <button className="pdf-popup-close" onClick={() => setSelectionPopup(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
