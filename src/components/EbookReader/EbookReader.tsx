import { useState, useEffect, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { useApp } from '../../context';
import { ConvertModal } from '../ConvertModal';
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

type ReaderTheme = 'light' | 'sepia' | 'dark';
interface TocItem { label: string; href: string; subitems?: TocItem[] }

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/* ------------------------------------------------------------------ */
/*  Helper: get foliate-js CSS for themes                              */
/* ------------------------------------------------------------------ */
function getFoliateCss(theme: ReaderTheme, fontSize: number) {
  const bg = theme === 'dark' ? '#2d2d2d' : theme === 'sepia' ? '#f8f4e8' : '#ffffff';
  const fg = theme === 'dark' ? '#e8e8e8' : theme === 'sepia' ? '#5c4b37' : '#1a1a1a';
  return `
    @namespace epub "http://www.idpf.org/2007/ops";
    html { color-scheme: ${theme === 'dark' ? 'dark' : 'light'}; background: ${bg}; color: ${fg}; }
    body { font-size: ${fontSize}px !important; line-height: 1.7; font-family: 'Segoe UI', 'Source Serif 4', Georgia, serif; padding: 20px 40px; }
    p, li, blockquote, dd { line-height: 1.7; text-align: justify; }
    pre { white-space: pre-wrap !important; }
    img { max-width: 100% !important; height: auto !important; }
    h1, h2, h3, h4, h5, h6 { font-weight: 600; line-height: 1.3; }
  `;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EbookReader({ fileUrl, bookId, fileName, initialPage, initialCfi, onClose }: EbookReaderProps) {
  const { saveReadingProgress, state } = useApp();
  const isDjvu = /\.djvu$/i.test(fileName || '');
  const currentBook = state.books.find(b => b.id === bookId);

  /* -- Common state -- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ReaderTheme>(state.theme === 'dark' ? 'dark' : 'light');
  const [fontSize, setFontSize] = useState(18);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(1);

  /* -- DJVU state -- */
  const djvuDocRef = useRef<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [pageInput, setPageInput] = useState(String(initialPage || 1));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderedPagesRef = useRef<Set<number>>(new Set());

  /* -- Foliate state -- */
  const foliateRef = useRef<any>(null);
  const foliateContainerRef = useRef<HTMLDivElement>(null);
  const [fraction, setFraction] = useState(0);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  const bookFileName = fileName || state.books.find(b => b.id === bookId)?.fileName || 'book';
  const title = bookFileName.replace(/\.[^/.]+$/, '');
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

  /* ---- Render a DJVU page to a canvas ---- */
  const renderDjvuPage = useCallback((pageNum: number, canvas: HTMLCanvasElement) => {
    const doc = djvuDocRef.current;
    if (!doc || pageNum < 1 || pageNum > doc.pages.length) return;
    try {
      const page = doc.pages[pageNum - 1];
      const imageData = page.getImageData();
      const scale = (window.devicePixelRatio || 1);
      const w = imageData.width;
      const h = imageData.height;

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      const tmpCtx = tmpCanvas.getContext('2d')!;
      tmpCtx.putImageData(imageData, 0, 0);

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

  /* ---- Render current page ---- */
  useEffect(() => {
    if (!isDjvu || loading || !djvuDocRef.current) return;
    if (canvasRef.current) renderDjvuPage(currentPage, canvasRef.current);
  }, [isDjvu, loading, currentPage, renderDjvuPage]);

  /* ---- Scroll mode: lazy rendering ---- */
  useEffect(() => {
    if (!isDjvu || !djvuDocRef.current || loading) return;
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

    container.querySelectorAll('.reader-scroll-page').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [isDjvu, loading, renderDjvuPage, totalPages, zoom]);

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

  const djvuPrev = useCallback(() => djvuGoTo(currentPage - 1), [currentPage, djvuGoTo]);
  const djvuNext = useCallback(() => djvuGoTo(currentPage + 1), [currentPage, djvuGoTo]);

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
  /*  Foliate-js loading                                               */
  /* ================================================================ */

  useEffect(() => {
    if (isDjvu || !foliateContainerRef.current) return;
    let cancelled = false;

    const initFoliate = async () => {
      try {
        setLoading(true);
        if (!customElements.get('foliate-view')) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'module';
            script.src = `${import.meta.env.BASE_URL}foliate-js/view.js`;
            script.onload = () => {
              customElements.whenDefined('foliate-view').then(() => resolve());
            };
            script.onerror = () => reject(new Error('Failed to load reader'));
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
        view.renderer?.setStyles?.(getFoliateCss(theme, fontSize));

        if (initialCfi) await view.init({ lastLocation: initialCfi });
        else await view.init({ showTextStart: true });

        if (view.book?.toc) setTocItems(flattenToc(view.book.toc));

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

  useEffect(() => {
    if (isDjvu || !foliateRef.current) return;
    foliateRef.current.renderer?.setStyles?.(getFoliateCss(theme, fontSize));
  }, [isDjvu, theme, fontSize]);

  const foliateNav = useCallback((dir: 'prev' | 'next') => {
    const v = foliateRef.current;
    if (!v) return;
    dir === 'prev' ? v.prev() : v.next();
  }, []);

  const foliateGoTo = useCallback((href: string) => {
    foliateRef.current?.goTo(href)?.catch((e: any) => console.error(e));
    setShowSidebar(false);
  }, []);

  /* ================================================================ */
  /*  Helpers                                                          */
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
  /*  Render - Adobe Reader Style                                      */
  /* ================================================================ */

  const themeClass = theme === 'dark' ? 'reader--dark' : theme === 'sepia' ? 'reader--sepia' : 'reader--light';

  return (
    <div className={`reader-overlay ${themeClass}`}>
      {/* ---- Header Toolbar ---- */}
      <header className="reader-header">
        <div className="reader-header__left">
          <button className="reader-btn reader-btn--icon" onClick={() => setShowSidebar(!showSidebar)} title="Toggle sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          <span className="reader-header__title" title={title}>{title}</span>
        </div>
        
        <div className="reader-header__center">
          {/* Zoom Controls - Only for DJVU */}
          {isDjvu && (
            <div className="reader-toolbar-group">
              <button className="reader-btn reader-btn--icon" onClick={() => setZoom(ZOOM_LEVELS[Math.max(0, zoomIdx - 1)])} disabled={zoomIdx <= 0} title="Zoom out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="7" y1="11" x2="15" y2="11"/></svg>
              </button>
              <span className="reader-zoom-display">{Math.round(zoom * 100)}%</span>
              <button className="reader-btn reader-btn--icon" onClick={() => setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1)])} disabled={zoomIdx >= ZOOM_LEVELS.length - 1} title="Zoom in">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="11" y1="7" x2="11" y2="15"/><line x1="7" y1="11" x2="15" y2="11"/></svg>
              </button>
            </div>
          )}
        </div>

        <div className="reader-header__right">
          {/* Theme toggle */}
          <div className="reader-toolbar-group">
            <button className={`reader-btn reader-btn--icon ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} title="Light theme">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </button>
            <button className={`reader-btn reader-btn--icon ${theme === 'sepia' ? 'active' : ''}`} onClick={() => setTheme('sepia')} title="Sepia theme">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
            </button>
            <button className={`reader-btn reader-btn--icon ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} title="Dark theme">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            </button>
          </div>

          {/* Font size (for ebooks) */}
          {!isDjvu && (
            <div className="reader-toolbar-group">
              <button className="reader-btn reader-btn--icon" onClick={() => setFontSize(f => Math.max(12, f - 2))} disabled={fontSize <= 12} title="Smaller text">
                <span style={{ fontSize: '12px', fontWeight: 600 }}>A−</span>
              </button>
              <button className="reader-btn reader-btn--icon" onClick={() => setFontSize(f => Math.min(32, f + 2))} disabled={fontSize >= 32} title="Larger text">
                <span style={{ fontSize: '16px', fontWeight: 600 }}>A+</span>
              </button>
            </div>
          )}

          {/* Export DJVU to PDF */}
          {isDjvu && totalPages > 0 && (
            <button className="reader-btn reader-btn--icon" onClick={exportDjvuToPdf} disabled={exporting} title="Export to PDF">
              {exporting ? <div className="reader-spinner" style={{ width: 14, height: 14 }} /> : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              )}
            </button>
          )}

          {/* Convert to PDF */}
          {currentBook && currentBook.format && currentBook.format !== 'pdf' && (
            <button className="reader-btn reader-btn--icon" onClick={() => setShowConvertModal(true)} title="Convert to PDF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </button>
          )}

          {/* Close */}
          <button className="reader-btn reader-btn--close" onClick={onClose} title="Close (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </header>

      {/* ---- Main Content Area ---- */}
      <div className="reader-main">
        {/* Sidebar */}
        <aside className={`reader-sidebar ${showSidebar ? 'reader-sidebar--open' : ''}`}>
          <div className="reader-sidebar__header">
            <span>Contents</span>
            <button className="reader-btn reader-btn--icon" onClick={() => setShowSidebar(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="reader-sidebar__content">
            {tocItems.length > 0 ? (
              <ul className="reader-toc">
                {tocItems.map((item, i) => (
                  <li key={i}>
                    <button className="reader-toc__item" onClick={() => foliateGoTo(item.href)}>{item.label}</button>
                  </li>
                ))}
              </ul>
            ) : isDjvu && totalPages > 0 ? (
              <ul className="reader-toc">
                {Array.from({ length: Math.min(totalPages, 50) }, (_, i) => (
                  <li key={i}>
                    <button className={`reader-toc__item ${currentPage === i + 1 ? 'active' : ''}`} onClick={() => djvuGoTo(i + 1)}>Page {i + 1}</button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="reader-sidebar__empty">No contents available</div>
            )}
          </div>
        </aside>

        {/* Document Area */}
        <div className="reader-document">
          {loading && (
            <div className="reader-loading">
              <div className="reader-spinner" />
              <span>Loading document…</span>
            </div>
          )}
          {error && <div className="reader-error">Failed to load: {error}</div>}

          {/* DJVU Document */}
          {isDjvu && !loading && !error && (
            <div className="reader-page-container" ref={scrollRef}>
              <div className="reader-page" style={{ transform: `scale(${zoom})` }}>
                <canvas ref={canvasRef} />
              </div>
            </div>
          )}

          {/* Foliate Document */}
          {!isDjvu && (
            <div 
              ref={foliateContainerRef} 
              className="reader-foliate-container"
              style={{ display: loading || error ? 'none' : 'flex' }}
            />
          )}

          {/* Navigation zones for foliate */}
          {!isDjvu && !loading && !error && (
            <>
              <div className="reader-nav-zone reader-nav-zone--left" onClick={() => foliateNav('prev')} />
              <div className="reader-nav-zone reader-nav-zone--right" onClick={() => foliateNav('next')} />
            </>
          )}
        </div>
      </div>

      {/* ---- Footer Toolbar ---- */}
      <footer className="reader-footer">
        <div className="reader-footer__left">
          {isDjvu ? (
            <span className="reader-footer__info">{totalPages} pages</span>
          ) : (
            <span className="reader-footer__info">{Math.round(fraction * 100)}% complete</span>
          )}
        </div>

        <div className="reader-footer__center">
          {isDjvu ? (
            <div className="reader-page-nav">
              <button className="reader-btn reader-btn--nav" onClick={djvuPrev} disabled={currentPage <= 1} title="Previous page">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className="reader-page-indicator">
                <input 
                  type="text" 
                  className="reader-page-input" 
                  value={pageInput} 
                  onChange={e => setPageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(pageInput); if (n >= 1 && n <= totalPages) djvuGoTo(n); } }}
                  onBlur={() => setPageInput(String(currentPage))}
                />
                <span className="reader-page-total">/ {totalPages}</span>
              </div>
              <button className="reader-btn reader-btn--nav" onClick={djvuNext} disabled={currentPage >= totalPages} title="Next page">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          ) : (
            <div className="reader-page-nav">
              <button className="reader-btn reader-btn--nav" onClick={() => foliateNav('prev')} title="Previous">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className="reader-progress-bar">
                <div className="reader-progress-fill" style={{ width: `${fraction * 100}%` }} />
              </div>
              <button className="reader-btn reader-btn--nav" onClick={() => foliateNav('next')} title="Next">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
        </div>

        <div className="reader-footer__right">
          {isDjvu && (
            <span className="reader-footer__page">Page {currentPage}</span>
          )}
        </div>
      </footer>

      {/* Convert Modal */}
      {showConvertModal && currentBook && (
        <ConvertModal book={currentBook} onClose={() => setShowConvertModal(false)} />
      )}
    </div>
  );
}
