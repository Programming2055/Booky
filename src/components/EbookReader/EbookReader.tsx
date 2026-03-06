import { useState, useEffect, useCallback, useRef } from 'react';
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

type ReaderTheme = 'light' | 'sepia' | 'dark';
type DjvuViewMode = 'single' | 'continuous';
type ZoomMode = 'custom' | 'fit-width' | 'fit-page';
interface TocItem { label: string; href: string; subitems?: TocItem[] }

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

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

  /* -- Common state -- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ReaderTheme>(state.theme === 'dark' ? 'dark' : 'light');
  const [fontSize, setFontSize] = useState(18);
  const [showSidebar, setShowSidebar] = useState(false);

  /* -- DJVU state -- */
  const djvuDocRef = useRef<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [pageInput, setPageInput] = useState(String(initialPage || 1));
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderedPagesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [djvuViewMode, setDjvuViewMode] = useState<DjvuViewMode>('continuous');
  const [zoom, setZoom] = useState(1);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit-width');
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  /* -- Foliate state -- */
  const foliateRef = useRef<any>(null);
  const foliateContainerRef = useRef<HTMLDivElement>(null);
  const [fraction, setFraction] = useState(0);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  const bookFileName = fileName || state.books.find(b => b.id === bookId)?.fileName || 'book';
  const title = bookFileName.replace(/\.[^/.]+$/, '');

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
        
        // Collect page sizes upfront
        const sizes: { w: number; h: number }[] = [];
        for (let i = 0; i < doc.pages.length; i++) {
          try {
            const p = doc.pages[i];
            sizes.push({ w: p.getWidth(), h: p.getHeight() });
          } catch {
            sizes.push({ w: 800, h: 1000 }); // fallback
          }
        }
        setPageSizes(sizes);
        setLoading(false);
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [isDjvu, fileUrl]);

  /* ---- Calculate effective zoom based on mode ---- */
  const calculateEffectiveZoom = useCallback(() => {
    if (!containerRef.current || pageSizes.length === 0) return zoom;
    const containerWidth = containerRef.current.clientWidth - 48; // padding
    const containerHeight = containerRef.current.clientHeight - 48;
    
    // Get max page dimensions
    const maxPageWidth = Math.max(...pageSizes.map(s => s.w), 800);
    const maxPageHeight = Math.max(...pageSizes.map(s => s.h), 1000);
    
    if (zoomMode === 'fit-width') {
      return Math.min(containerWidth / maxPageWidth, 3);
    } else if (zoomMode === 'fit-page') {
      const widthRatio = containerWidth / maxPageWidth;
      const heightRatio = containerHeight / maxPageHeight;
      return Math.min(widthRatio, heightRatio, 3);
    }
    return zoom;
  }, [zoom, zoomMode, pageSizes]);

  /* ---- Render a DJVU page to a canvas with zoom ---- */
  const renderDjvuPage = useCallback((pageNum: number, canvas: HTMLCanvasElement, zoomLevel: number) => {
    const doc = djvuDocRef.current;
    if (!doc || pageNum < 1 || pageNum > doc.pages.length) return { width: 0, height: 0 };
    try {
      const page = doc.pages[pageNum - 1];
      const imageData = page.getImageData();
      const dpr = window.devicePixelRatio || 1;
      const w = imageData.width;
      const h = imageData.height;
      
      // Apply zoom to display size
      const displayW = Math.round(w * zoomLevel);
      const displayH = Math.round(h * zoomLevel);

      // Create temp canvas for original image
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      const tmpCtx = tmpCanvas.getContext('2d')!;
      tmpCtx.putImageData(imageData, 0, 0);

      // Set canvas size for high-DPI display
      canvas.width = Math.round(displayW * dpr);
      canvas.height = Math.round(displayH * dpr);
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.scale(dpr, dpr);
      ctx.drawImage(tmpCanvas, 0, 0, displayW, displayH);
      
      return { width: displayW, height: displayH };
    } catch (e) {
      console.error(`Error rendering DJVU page ${pageNum}:`, e);
      return { width: 0, height: 0 };
    }
  }, []);

  /* ---- Continuous scroll mode: lazy render pages ---- */
  useEffect(() => {
    if (!isDjvu || !djvuDocRef.current || loading || djvuViewMode !== 'continuous') return;
    
    const effectZoom = calculateEffectiveZoom();
    renderedPagesRef.current.clear();
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pg = parseInt(entry.target.getAttribute('data-page') || '0');
        if (pg <= 0) return;
        
        if (entry.isIntersecting) {
          // Render page if not already rendered at current zoom
          const cached = renderedPagesRef.current.get(pg);
          if (!cached) {
            const canvas = document.createElement('canvas');
            renderDjvuPage(pg, canvas, effectZoom);
            const wrapper = entry.target as HTMLElement;
            wrapper.innerHTML = '';
            wrapper.appendChild(canvas);
            renderedPagesRef.current.set(pg, canvas);
          }
        }
      });
    }, { root: scrollRef.current, rootMargin: '600px 0px' });

    // Observe all page containers
    pageRefs.current.forEach((el) => observer.observe(el));
    
    return () => observer.disconnect();
  }, [isDjvu, loading, renderDjvuPage, totalPages, djvuViewMode, calculateEffectiveZoom, zoom, zoomMode, pageSizes]);

  /* ---- Re-render all visible pages when zoom changes ---- */
  useEffect(() => {
    if (!isDjvu || loading || djvuViewMode !== 'continuous') return;
    
    const effectZoom = calculateEffectiveZoom();
    // Clear cache and re-render visible pages
    renderedPagesRef.current.forEach((canvas, pg) => {
      renderDjvuPage(pg, canvas, effectZoom);
    });
  }, [isDjvu, loading, djvuViewMode, calculateEffectiveZoom, renderDjvuPage]);

  /* ---- Single page mode: render current page ---- */
  useEffect(() => {
    if (!isDjvu || loading || djvuViewMode !== 'single' || !djvuDocRef.current) return;
    
    const effectZoom = calculateEffectiveZoom();
    const wrapper = pageRefs.current.get(1);
    if (wrapper) {
      const canvas = document.createElement('canvas');
      renderDjvuPage(currentPage, canvas, effectZoom);
      wrapper.innerHTML = '';
      wrapper.appendChild(canvas);
    }
  }, [isDjvu, loading, djvuViewMode, currentPage, calculateEffectiveZoom, renderDjvuPage]);

  /* ---- Track current page on scroll ---- */
  useEffect(() => {
    if (!isDjvu || djvuViewMode !== 'continuous' || !scrollRef.current) return;
    
    const handleScroll = () => {
      const container = scrollRef.current;
      if (!container) return;
      
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const midPoint = scrollTop + containerHeight / 3;
      
      // Find which page is at the midpoint
      let cumHeight = 0;
      const effectZoom = calculateEffectiveZoom();
      for (let i = 0; i < pageSizes.length; i++) {
        const pageH = pageSizes[i].h * effectZoom + 16; // include gap
        if (cumHeight + pageH > midPoint) {
          if (currentPage !== i + 1) {
            setCurrentPage(i + 1);
            setPageInput(String(i + 1));
          }
          break;
        }
        cumHeight += pageH;
      }
    };
    
    const container = scrollRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isDjvu, djvuViewMode, pageSizes, currentPage, calculateEffectiveZoom]);

  /* ---- Save DJVU progress ---- */
  useEffect(() => {
    if (!isDjvu || !totalPages) return;
    saveReadingProgress(bookId, { currentPage, totalPages, percentage: Math.round((currentPage / totalPages) * 100) });
  }, [isDjvu, bookId, currentPage, totalPages, saveReadingProgress]);

  /* ---- Navigation functions ---- */
  const djvuGoTo = useCallback((p: number) => {
    const page = Math.max(1, Math.min(p, totalPages));
    setCurrentPage(page);
    setPageInput(String(page));
    
    // Scroll to page in continuous mode
    if (djvuViewMode === 'continuous' && scrollRef.current && pageSizes.length > 0) {
      const effectZoom = calculateEffectiveZoom();
      let scrollTop = 0;
      for (let i = 0; i < page - 1; i++) {
        scrollTop += pageSizes[i].h * effectZoom + 16; // include gap
      }
      scrollRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  }, [totalPages, djvuViewMode, pageSizes, calculateEffectiveZoom]);

  const djvuPrev = useCallback(() => djvuGoTo(currentPage - 1), [currentPage, djvuGoTo]);
  const djvuNext = useCallback(() => djvuGoTo(currentPage + 1), [currentPage, djvuGoTo]);

  /* ---- Zoom controls for DJVU ---- */
  const handleZoomIn = useCallback(() => {
    setZoomMode('custom');
    const currentIdx = ZOOM_PRESETS.findIndex(z => z >= zoom);
    const nextIdx = Math.min(currentIdx + 1, ZOOM_PRESETS.length - 1);
    setZoom(ZOOM_PRESETS[nextIdx]);
  }, [zoom]);

  const handleZoomOut = useCallback(() => {
    setZoomMode('custom');
    const currentIdx = ZOOM_PRESETS.findIndex(z => z >= zoom);
    const prevIdx = Math.max(currentIdx - 1, 0);
    setZoom(ZOOM_PRESETS[prevIdx]);
  }, [zoom]);

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
            script.src = '/foliate-js/view.js';
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
      // Zoom shortcuts for DJVU
      if (isDjvu && (e.ctrlKey || e.metaKey)) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); handleZoomIn(); }
        if (e.key === '-') { e.preventDefault(); handleZoomOut(); }
        if (e.key === '0') { e.preventDefault(); setZoomMode('fit-width'); }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, isDjvu, djvuPrev, djvuNext, foliateNav, handleZoomIn, handleZoomOut]);

  /* ================================================================ */
  /*  Render - Adobe Reader Style                                      */
  /* ================================================================ */

  const themeClass = theme === 'dark' ? 'reader--dark' : theme === 'sepia' ? 'reader--sepia' : 'reader--light';
  const displayZoom = zoomMode === 'custom' ? zoom : calculateEffectiveZoom();

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
          {/* DJVU View Mode Toggle */}
          {isDjvu && (
            <div className="reader-toolbar-group">
              <button 
                className={`reader-btn reader-btn--icon ${djvuViewMode === 'single' ? 'active' : ''}`} 
                onClick={() => setDjvuViewMode('single')} 
                title="Single page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="3" width="14" height="18" rx="2"/>
                </svg>
              </button>
              <button 
                className={`reader-btn reader-btn--icon ${djvuViewMode === 'continuous' ? 'active' : ''}`} 
                onClick={() => setDjvuViewMode('continuous')} 
                title="Continuous scroll"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="8" rx="1"/>
                  <rect x="5" y="14" width="14" height="8" rx="1"/>
                </svg>
              </button>
            </div>
          )}

          {/* Zoom Controls - DJVU */}
          {isDjvu && (
            <div className="reader-toolbar-group djvu-zoom-controls">
              <button className="reader-btn reader-btn--icon" onClick={handleZoomOut} disabled={zoom <= ZOOM_PRESETS[0]} title="Zoom out (Ctrl+-)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="7" y1="11" x2="15" y2="11"/></svg>
              </button>
              <select 
                className="reader-zoom-select" 
                value={zoomMode === 'custom' ? String(zoom) : zoomMode}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'fit-width' || val === 'fit-page') {
                    setZoomMode(val);
                  } else {
                    setZoomMode('custom');
                    setZoom(parseFloat(val));
                  }
                }}
              >
                <option value="fit-width">Fit Width</option>
                <option value="fit-page">Fit Page</option>
                <optgroup label="Custom Zoom">
                  {ZOOM_PRESETS.map(z => (
                    <option key={z} value={z}>{Math.round(z * 100)}%</option>
                  ))}
                </optgroup>
              </select>
              <span className="reader-zoom-display">{Math.round(displayZoom * 100)}%</span>
              <button className="reader-btn reader-btn--icon" onClick={handleZoomIn} disabled={zoom >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1]} title="Zoom in (Ctrl++)">
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
        <div className="reader-document" ref={containerRef}>
          {loading && (
            <div className="reader-loading">
              <div className="reader-spinner" />
              <span>Loading document…</span>
            </div>
          )}
          {error && <div className="reader-error">Failed to load: {error}</div>}

          {/* DJVU Document - Continuous Scroll Mode */}
          {isDjvu && !loading && !error && djvuViewMode === 'continuous' && (
            <div className="djvu-scroll-container" ref={scrollRef}>
              <div className="djvu-pages-wrapper">
                {Array.from({ length: totalPages }, (_, i) => {
                  const pageNum = i + 1;
                  const size = pageSizes[i] || { w: 800, h: 1000 };
                  const effectZoom = calculateEffectiveZoom();
                  const displayW = size.w * effectZoom;
                  const displayH = size.h * effectZoom;
                  return (
                    <div
                      key={pageNum}
                      className="djvu-page-wrapper"
                      data-page={pageNum}
                      ref={el => { if (el) pageRefs.current.set(pageNum, el); }}
                      style={{
                        width: displayW,
                        height: displayH,
                        minHeight: displayH,
                      }}
                    >
                      <div className="djvu-page-placeholder">
                        <span>Page {pageNum}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DJVU Document - Single Page Mode */}
          {isDjvu && !loading && !error && djvuViewMode === 'single' && (
            <div className="djvu-single-container">
              <div
                className="djvu-page-wrapper djvu-page-single"
                data-page={currentPage}
                ref={el => { if (el) pageRefs.current.set(1, el); }}
              />
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
    </div>
  );
}
