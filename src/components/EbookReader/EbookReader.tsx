import { useState, useEffect, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { useApp } from '../../context';
import './EbookReader.css';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

declare global {
  interface Window { DjVu: any }
}

interface EbookReaderProps {
  fileUrl: string;
  bookId: string;
  fileName?: string;
  initialPage?: number;
  initialCfi?: string;
  onClose: () => void;
}

type ViewMode = 'single' | 'two-page' | 'scroll';
type ReaderTheme = 'light' | 'sepia' | 'dark';

interface TocItem { label: string; href: string; subitems?: TocItem[] }

const THEMES: Record<ReaderTheme, { bg: string; fg: string; bar: string; border: string }> = {
  light: { bg: '#f5f5f5', fg: '#1a1a1a', bar: '#fff', border: '#e0e0e0' },
  sepia: { bg: '#ede0c8', fg: '#5b4636', bar: '#f4ecd8', border: '#d4c4a8' },
  dark: { bg: '#121212', fg: '#e0e0e0', bar: '#1e1e1e', border: '#333' },
};

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/* ------------------------------------------------------------------ */
/*  Helper: get foliate-js CSS for themes                              */
/* ------------------------------------------------------------------ */
function getFoliateCss(theme: ReaderTheme, fontSize: number) {
  const t = THEMES[theme];
  return `
    @namespace epub "http://www.idpf.org/2007/ops";
    html { color-scheme: ${theme === 'dark' ? 'dark' : 'light'}; background: ${t.bg}; color: ${t.fg}; }
    body { font-size: ${fontSize}px !important; line-height: 1.6; }
    p, li, blockquote, dd { line-height: 1.6; text-align: justify; -webkit-hyphens: auto; hyphens: auto; }
    pre { white-space: pre-wrap !important; }
    img { max-width: 100% !important; height: auto !important; }
  `;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EbookReader({ fileUrl, bookId, fileName, initialPage, initialCfi, onClose }: EbookReaderProps) {
  const { saveReadingProgress, state } = useApp();
  const isDjvu = /\.djvu$/i.test(fileName || '');

  /* -- Common state -- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ReaderTheme>(state.theme === 'dark' ? 'dark' : 'light');
  const [fontSize, setFontSize] = useState(18);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [exporting, setExporting] = useState(false);

  /* -- DJVU state -- */
  const djvuDocRef = useRef<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [pageInput, setPageInput] = useState(String(initialPage || 1));
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderedPagesRef = useRef<Set<number>>(new Set());

  /* -- Foliate state -- */
  const foliateRef = useRef<any>(null);
  const foliateContainerRef = useRef<HTMLDivElement>(null);
  const [fraction, setFraction] = useState(0);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  const settingsRef = useRef<HTMLDivElement>(null);
  const tocPanelRef = useRef<HTMLDivElement>(null);

  const bookFileName = fileName || state.books.find(b => b.id === bookId)?.fileName || 'book';
  const title = bookFileName.replace(/\.[^/.]+$/, '');
  const t = THEMES[theme];
  const zoomIdx = ZOOM_LEVELS.indexOf(zoom);

  /* ================================================================ */
  /*  DJVU loading                                                     */
  /* ================================================================ */

  useEffect(() => {
    if (!isDjvu) return;
    let cancelled = false;
    setLoading(true);
    fetch(fileUrl)
      .then(r => r.arrayBuffer())
      .then(buf => {
        if (cancelled) return;
        if (!window.DjVu) throw new Error('DjVu.js not loaded');
        const doc = new window.DjVu.Document(buf);
        djvuDocRef.current = doc;
        setTotalPages(doc.pages.length);
        setLoading(false);
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [isDjvu, fileUrl]);

  /* ---- Render a DJVU page to a canvas (high-DPI) ---- */
  const renderDjvuPage = useCallback((pageNum: number, canvas: HTMLCanvasElement, forExport = false) => {
    const doc = djvuDocRef.current;
    if (!doc || pageNum < 1 || pageNum > doc.pages.length) return;
    try {
      const page = doc.pages[pageNum - 1];
      const imageData = page.getImageData();
      const scale = forExport ? 1 : (window.devicePixelRatio || 1);
      const w = imageData.width;
      const h = imageData.height;

      // Create a temporary canvas at native resolution
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      const tmpCtx = tmpCanvas.getContext('2d')!;
      tmpCtx.putImageData(imageData, 0, 0);

      // Set display canvas to scaled resolution
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.scale(scale, scale);
      ctx.drawImage(tmpCanvas, 0, 0);
    } catch (e) {
      console.error(`Error rendering DJVU page ${pageNum}:`, e);
    }
  }, []);

  /* ---- Single & two-page mode rendering ---- */
  useEffect(() => {
    if (!isDjvu || loading || !djvuDocRef.current) return;
    if (viewMode === 'scroll') return;
    if (canvasRef.current) renderDjvuPage(currentPage, canvasRef.current);
    if (viewMode === 'two-page' && canvas2Ref.current && currentPage + 1 <= totalPages) {
      renderDjvuPage(currentPage + 1, canvas2Ref.current);
    }
  }, [isDjvu, loading, currentPage, viewMode, renderDjvuPage, totalPages]);

  /* ---- Scroll mode: lazy rendering via IntersectionObserver ---- */
  useEffect(() => {
    if (!isDjvu || viewMode !== 'scroll' || !djvuDocRef.current || loading) return;
    renderedPagesRef.current.clear();
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const pg = parseInt(entry.target.getAttribute('data-page') || '0');
        if (pg > 0 && !renderedPagesRef.current.has(pg)) {
          renderedPagesRef.current.add(pg);
          const canvas = document.createElement('canvas');
          renderDjvuPage(pg, canvas);
          const wrapper = entry.target as HTMLElement;
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          wrapper.innerHTML = '';
          wrapper.appendChild(canvas);
        }
      });
    }, { root: container, rootMargin: '400px' });

    container.querySelectorAll('.ebook-scroll-page').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [isDjvu, viewMode, loading, renderDjvuPage, totalPages, zoom]);

  /* ---- Save DJVU progress ---- */
  useEffect(() => {
    if (!isDjvu || !totalPages) return;
    saveReadingProgress(bookId, { currentPage, totalPages, percentage: Math.round((currentPage / totalPages) * 100) });
  }, [isDjvu, bookId, currentPage, totalPages, saveReadingProgress]);

  const djvuGoTo = useCallback((p: number) => {
    const page = Math.max(1, Math.min(p, totalPages));
    setCurrentPage(page);
    setPageInput(String(page));
  }, [totalPages]);

  const djvuPrev = useCallback(() => djvuGoTo(viewMode === 'two-page' ? currentPage - 2 : currentPage - 1), [currentPage, viewMode, djvuGoTo]);
  const djvuNext = useCallback(() => djvuGoTo(viewMode === 'two-page' ? currentPage + 2 : currentPage + 1), [currentPage, viewMode, djvuGoTo]);

  /* ---- Handle view mode change (preserve page) ---- */
  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    if (newMode === 'two-page') {
      // Snap to odd page so left page is always odd
      setCurrentPage(prev => (prev % 2 === 0 ? Math.max(1, prev - 1) : prev));
    }
    setViewMode(newMode);
  }, []);

  /* ---- Export DJVU to PDF ---- */
  const exportDjvuToPdf = useCallback(async () => {
    const doc = djvuDocRef.current;
    if (!doc || exporting) return;
    setExporting(true);
    try {
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      let firstPage = true;
      for (let i = 0; i < doc.pages.length; i++) {
        const page = doc.pages[i];
        const imageData = page.getImageData();
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = imageData.width;
        tmpCanvas.height = imageData.height;
        const ctx = tmpCanvas.getContext('2d')!;
        ctx.putImageData(imageData, 0, 0);
        const imgData = tmpCanvas.toDataURL('image/jpeg', 0.92);

        const pWidth = pdf.internal.pageSize.getWidth();
        const pHeight = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pWidth / imageData.width, pHeight / imageData.height);
        const imgW = imageData.width * ratio;
        const imgH = imageData.height * ratio;
        const x = (pWidth - imgW) / 2;
        const y = (pHeight - imgH) / 2;

        if (!firstPage) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);
        firstPage = false;
      }
      pdf.save(`${title}.pdf`);
    } catch (e) {
      console.error('Export to PDF failed:', e);
    } finally {
      setExporting(false);
    }
  }, [exporting, title]);

  /* ================================================================ */
  /*  Foliate-js loading (MOBI, FB2, CBZ etc.)                         */
  /* ================================================================ */

  useEffect(() => {
    if (isDjvu || !foliateContainerRef.current) return;
    let cancelled = false;

    const initFoliate = async () => {
      try {
        setLoading(true);
        // Load foliate-js as a runtime script (not bundled by Vite)
        if (!customElements.get('foliate-view')) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'module';
            script.src = '/foliate-js/view.js';
            script.onload = () => {
              // Wait for custom element to be actually defined
              customElements.whenDefined('foliate-view').then(() => resolve());
            };
            script.onerror = () => reject(new Error('Failed to load foliate-js'));
            document.head.appendChild(script);
          });
        }
        const res = await fetch(fileUrl);
        const blob = await res.blob();
        const file = new File([blob], fileName || 'book', { type: blob.type });
        if (cancelled) return;

        const view = document.createElement('foliate-view') as any;
        view.style.cssText = 'display:block;width:100%;height:100%;';
        foliateContainerRef.current!.innerHTML = '';
        foliateContainerRef.current!.appendChild(view);
        foliateRef.current = view;

        await view.open(file);

        // Apply styles
        view.renderer?.setStyles?.(getFoliateCss(theme, fontSize));
        if (viewMode === 'scroll') view.renderer?.setAttribute('flow', 'scrolled');

        // Init navigation
        if (initialCfi) await view.init({ lastLocation: initialCfi });
        else await view.init({ showTextStart: true });

        // TOC
        if (view.book?.toc) setTocItems(flattenToc(view.book.toc));

        // Events
        view.addEventListener('relocate', (e: any) => {
          const { fraction: frac, cfi } = e.detail;
          setFraction(frac || 0);
          if (cfi) saveReadingProgress(bookId, { cfi, percentage: Math.round((frac || 0) * 100) });
        });

        setLoading(false);
      } catch (e: any) {
        if (!cancelled) { setError(e.message || 'Failed to load'); setLoading(false); }
      }
    };

    initFoliate();
    return () => {
      cancelled = true;
      foliateRef.current?.close?.();
      foliateRef.current?.remove?.();
      foliateRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDjvu, fileUrl]);

  /* ---- Apply foliate theme/font changes ---- */
  useEffect(() => {
    if (isDjvu || !foliateRef.current) return;
    foliateRef.current.renderer?.setStyles?.(getFoliateCss(theme, fontSize));
  }, [isDjvu, theme, fontSize]);

  /* ---- Apply foliate flow mode ---- */
  useEffect(() => {
    if (isDjvu || !foliateRef.current) return;
    foliateRef.current.renderer?.setAttribute('flow', viewMode === 'scroll' ? 'scrolled' : 'paginated');
  }, [isDjvu, viewMode]);

  const foliateNav = useCallback((dir: 'prev' | 'next') => {
    const v = foliateRef.current;
    if (!v) return;
    dir === 'prev' ? v.prev() : v.next();
  }, []);

  const foliateGoTo = useCallback((href: string) => {
    foliateRef.current?.goTo(href)?.catch((e: any) => console.error(e));
    setShowToc(false);
  }, []);

  /* ================================================================ */
  /*  Shared helpers                                                   */
  /* ================================================================ */

  function flattenToc(items: any[], depth = 0): TocItem[] {
    return items.flatMap((item: any) => [
      { label: '  '.repeat(depth) + (item.label || 'Untitled'), href: item.href },
      ...(item.subitems ? flattenToc(item.subitems, depth + 1) : []),
    ]);
  }

  /* ---- Keyboard ---- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') isDjvu ? djvuPrev() : foliateNav('prev');
      if (e.key === 'ArrowRight') isDjvu ? djvuNext() : foliateNav('next');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, isDjvu, djvuPrev, djvuNext, foliateNav]);

  /* ---- Close panels on outside click ---- */
  useEffect(() => {
    if (!showSettings && !showToc) return;
    const h = (e: MouseEvent) => {
      const tgt = e.target as Node;
      if (showSettings && settingsRef.current && !settingsRef.current.contains(tgt)) setShowSettings(false);
      if (showToc && tocPanelRef.current && !tocPanelRef.current.contains(tgt)) setShowToc(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showSettings, showToc]);

  const closeAllPanels = () => { setShowSettings(false); setShowToc(false); };

  /* ---- Page sizes for DJVU scroll mode ---- */
  const djvuPageSizes = useRef<{ w: number; h: number }[]>([]);
  useEffect(() => {
    if (!isDjvu || !djvuDocRef.current) return;
    const doc = djvuDocRef.current;
    const sizes: { w: number; h: number }[] = [];
    for (let i = 0; i < doc.pages.length; i++) {
      const p = doc.pages[i];
      try { sizes.push({ w: p.getWidth(), h: p.getHeight() }); }
      catch { sizes.push({ w: 800, h: 1000 }); }
    }
    djvuPageSizes.current = sizes;
  }, [isDjvu, totalPages]);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="ebook-reader-overlay">
      {/* ---- Top bar ---- */}
      <div className="ebook-reader-topbar" style={{ background: t.bar, color: t.fg, borderBottom: `1px solid ${t.border}` }}>
        <div className="ebook-reader-topbar-title" title={title}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
          <span>{title}</span>
        </div>

        <div className="ebook-reader-topbar-actions">
          {/* View mode */}
          <div className="ebook-toolbar-group">
            <button className={`ebook-toolbar-btn${viewMode === 'single' ? ' active' : ''}`} onClick={() => handleViewModeChange('single')} title="Single page" style={{ color: t.fg }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="3" width="14" height="18" rx="2" /></svg>
            </button>
            <button className={`ebook-toolbar-btn${viewMode === 'two-page' ? ' active' : ''}`} onClick={() => handleViewModeChange('two-page')} title="Two pages" style={{ color: t.fg }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="9" height="18" rx="1" /><rect x="13" y="3" width="9" height="18" rx="1" /></svg>
            </button>
            <button className={`ebook-toolbar-btn${viewMode === 'scroll' ? ' active' : ''}`} onClick={() => handleViewModeChange('scroll')} title="Vertical scroll" style={{ color: t.fg }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="1" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></svg>
            </button>
          </div>

          {/* DJVU: Zoom */}
          {isDjvu && (
            <div className="ebook-toolbar-group">
              <button className="ebook-toolbar-btn" onClick={() => setZoom(ZOOM_LEVELS[Math.max(0, zoomIdx - 1)])} disabled={zoomIdx <= 0} title="Zoom out" style={{ color: t.fg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="7" y1="11" x2="15" y2="11" /></svg>
              </button>
              <span className="ebook-zoom-label">{Math.round(zoom * 100)}%</span>
              <button className="ebook-toolbar-btn" onClick={() => setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1)])} disabled={zoomIdx >= ZOOM_LEVELS.length - 1} title="Zoom in" style={{ color: t.fg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="11" y1="7" x2="11" y2="15" /><line x1="7" y1="11" x2="15" y2="11" /></svg>
              </button>
            </div>
          )}

          {/* DJVU: Export to PDF */}
          {isDjvu && totalPages > 0 && (
            <button className="ebook-toolbar-btn" onClick={exportDjvuToPdf} disabled={exporting} title="Export to PDF" style={{ color: t.fg }}>
              {exporting ? (
                <div className="ebook-spinner" style={{ width: 14, height: 14 }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              )}
            </button>
          )}

          {/* DJVU: Page nav */}
          {isDjvu && totalPages > 0 && viewMode !== 'scroll' && (
            <div className="ebook-page-nav">
              <button className="ebook-toolbar-btn" onClick={djvuPrev} disabled={currentPage <= 1} title="Previous" style={{ color: t.fg }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <input className="ebook-page-input" value={pageInput} onChange={e => setPageInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(pageInput); if (n >= 1 && n <= totalPages) djvuGoTo(n); } }}
                onBlur={() => setPageInput(String(currentPage))} style={{ color: t.fg, borderColor: t.border }} />
              <span className="ebook-page-total">/ {totalPages}</span>
              <button className="ebook-toolbar-btn" onClick={djvuNext} disabled={currentPage >= totalPages} title="Next" style={{ color: t.fg }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          )}

          {/* Foliate: progress */}
          {!isDjvu && !loading && (
            <span className="ebook-progress-label">{Math.round(fraction * 100)}%</span>
          )}

          {/* TOC */}
          {!isDjvu && tocItems.length > 0 && (
            <button className={`ebook-toolbar-btn${showToc ? ' active' : ''}`} onClick={() => { closeAllPanels(); setShowToc(v => !v); }} title="Table of Contents" style={{ color: t.fg }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
          )}

          {/* Settings */}
          <button className="ebook-toolbar-btn" onClick={() => { closeAllPanels(); setShowSettings(v => !v); }} title="Settings" style={{ color: t.fg }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" /></svg>
          </button>

          {/* Close */}
          <button className="ebook-toolbar-btn" onClick={onClose} title="Close (Esc)" style={{ color: t.fg }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* ---- Settings panel ---- */}
        {showSettings && (
          <div className="ebook-reader-panel ebook-reader-settings" ref={settingsRef} style={{ background: t.bar, borderColor: t.border, color: t.fg }}>
            <div className="ebook-settings-group">
              <label>Theme</label>
              <div className="ebook-settings-row">
                {(['light', 'sepia', 'dark'] as ReaderTheme[]).map(th => (
                  <button key={th} className={`ebook-theme-btn ebook-theme-${th}${theme === th ? ' active' : ''}`} onClick={() => setTheme(th)}>{th.charAt(0).toUpperCase() + th.slice(1)}</button>
                ))}
              </div>
            </div>
            {!isDjvu && (
              <div className="ebook-settings-group">
                <label>Font Size: {fontSize}px</label>
                <div className="ebook-settings-row">
                  <button className="ebook-font-btn" disabled={fontSize <= 12} onClick={() => setFontSize(f => Math.max(12, f - 2))}>A−</button>
                  <span className="ebook-font-preview" style={{ fontSize: `${Math.min(fontSize, 24)}px` }}>Aa</span>
                  <button className="ebook-font-btn" disabled={fontSize >= 32} onClick={() => setFontSize(f => Math.min(32, f + 2))}>A+</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- TOC panel ---- */}
        {showToc && (
          <div className="ebook-reader-panel ebook-reader-toc-panel" ref={tocPanelRef} style={{ background: t.bar, borderColor: t.border, color: t.fg }}>
            <div className="ebook-panel-header">Table of Contents</div>
            <div className="ebook-toc-list">
              {tocItems.map((item, i) => (
                <button key={i} className="ebook-toc-item" onClick={() => foliateGoTo(item.href)} title={item.label}>{item.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- Reader body ---- */}
      <div className="ebook-reader-body" style={{ background: t.bg }}>
        {loading && (
          <div className="ebook-reader-loading" style={{ color: t.fg }}>
            <div className="ebook-spinner" />
            <span>Loading…</span>
          </div>
        )}
        {error && <div className="ebook-reader-error"><span>Failed to load: {error}</span></div>}

        {/* ---- DJVU: Single page ---- */}
        {isDjvu && !loading && !error && viewMode === 'single' && (
          <div className="ebook-djvu-container" onClick={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 3) djvuPrev();
            else if (x > rect.width * 2 / 3) djvuNext();
          }}>
            <canvas ref={canvasRef} className="ebook-djvu-canvas" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }} />
          </div>
        )}

        {/* ---- DJVU: Two-page ---- */}
        {isDjvu && !loading && !error && viewMode === 'two-page' && (
          <div className="ebook-djvu-container ebook-djvu-two-page" onClick={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 3) djvuPrev();
            else if (x > rect.width * 2 / 3) djvuNext();
          }}>
            <canvas ref={canvasRef} className="ebook-djvu-canvas" style={{ transform: `scale(${zoom})`, transformOrigin: 'top right' }} />
            {currentPage + 1 <= totalPages && (
              <canvas ref={canvas2Ref} className="ebook-djvu-canvas" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }} />
            )}
          </div>
        )}

        {/* ---- DJVU: Scroll ---- */}
        {isDjvu && !loading && !error && viewMode === 'scroll' && (
          <div className="ebook-djvu-scroll" ref={scrollRef}>
            {Array.from({ length: totalPages }, (_, i) => {
              const size = djvuPageSizes.current[i] || { w: 800, h: 1000 };
              const displayWidth = size.w * zoom;
              const displayHeight = size.h * zoom;
              return (
                <div key={i} className="ebook-scroll-page" data-page={i + 1}
                  style={{ width: displayWidth, height: displayHeight, maxWidth: '100%', aspectRatio: `${size.w}/${size.h}` }}>
                  <div className="ebook-scroll-page-num">{i + 1}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---- Foliate: click navigation zones ---- */}
        {!isDjvu && !loading && !error && viewMode !== 'scroll' && (
          <>
            <div className="ebook-foliate-nav ebook-foliate-nav-left" onClick={() => foliateNav('prev')} />
            <div className="ebook-foliate-nav ebook-foliate-nav-right" onClick={() => foliateNav('next')} />
          </>
        )}

        {/* ---- Foliate container ---- */}
        {!isDjvu && <div ref={foliateContainerRef} className="ebook-foliate-container" style={{ display: loading || error ? 'none' : 'block' }} />}
      </div>
    </div>
  );
}
