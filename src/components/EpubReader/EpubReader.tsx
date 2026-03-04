import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { ReactReader, ReactReaderStyle } from 'react-reader';
import type { Rendition, Contents, NavItem } from 'epubjs';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { useApp } from '../../context';
import './EpubReader.css';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

interface EpubReaderProps {
  fileUrl: string;
  bookId: string;
  fileName?: string;
  initialCfi?: string;
  onClose: () => void;
}

type ReaderTheme = 'light' | 'sepia' | 'dark';
type FlowMode = 'paginated' | 'scrolled';
type SpreadMode = 'none' | 'auto';

interface Highlight {
  cfi: string;
  text: string;
  color: string;
}

const THEMES: Record<ReaderTheme, { body: CSSProperties; readerBg: string; headerBg: string; headerFg: string; border: string }> = {
  light: {
    body: { color: '#1a1a1a', background: '#ffffff' },
    readerBg: '#f5f5f5',
    headerBg: '#ffffff',
    headerFg: '#1a1a1a',
    border: '#e0e0e0',
  },
  sepia: {
    body: { color: '#5b4636', background: '#f4ecd8' },
    readerBg: '#ede0c8',
    headerBg: '#f4ecd8',
    headerFg: '#5b4636',
    border: '#d4c4a8',
  },
  dark: {
    body: { color: '#e0e0e0', background: '#1e1e1e' },
    readerBg: '#121212',
    headerBg: '#1e1e1e',
    headerFg: '#e0e0e0',
    border: '#333',
  },
};

const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 28, 32];

const EPUB_FONTS = [
  { name: 'Default', value: '' },
  { name: 'Literata', value: "'Literata', Georgia, serif" },
  { name: 'Merriweather', value: "'Merriweather', Georgia, serif" },
  { name: 'Lora', value: "'Lora', Georgia, serif" },
  { name: 'Source Serif', value: "'Source Serif 4', Georgia, serif" },
  { name: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
  { name: 'Inter', value: "'Inter', system-ui, sans-serif" },
  { name: 'Nunito', value: "'Nunito', system-ui, sans-serif" },
];

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: 'rgba(255,235,59,0.4)' },
  { name: 'Green', value: 'rgba(76,175,80,0.35)' },
  { name: 'Blue', value: 'rgba(33,150,243,0.3)' },
  { name: 'Pink', value: 'rgba(233,30,99,0.3)' },
  { name: 'Orange', value: 'rgba(255,152,0,0.35)' },
];

/* ------------------------------------------------------------------ */
/*  EPUB entity fixer – preprocesses EPUB to fix &nbsp; etc.           */
/* ------------------------------------------------------------------ */

const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: '&#160;', copy: '&#169;', reg: '&#174;', trade: '&#8482;',
  mdash: '&#8212;', ndash: '&#8211;', laquo: '&#171;', raquo: '&#187;',
  hellip: '&#8230;', bull: '&#8226;', ldquo: '&#8220;', rdquo: '&#8221;',
  lsquo: '&#8216;', rsquo: '&#8217;', deg: '&#176;', sect: '&#167;',
  para: '&#182;', micro: '&#181;', cent: '&#162;', pound: '&#163;',
  yen: '&#165;', euro: '&#8364;', frac14: '&#188;', frac12: '&#189;',
  frac34: '&#190;', times: '&#215;', divide: '&#247;', plusmn: '&#177;',
  sup1: '&#185;', sup2: '&#178;', sup3: '&#179;', acute: '&#180;',
  cedil: '&#184;', uml: '&#168;', ordf: '&#170;', ordm: '&#186;',
  not: '&#172;', macr: '&#175;', iquest: '&#191;', iexcl: '&#161;',
  shy: '&#173;', middot: '&#183;', thinsp: '&#8201;', ensp: '&#8194;',
  emsp: '&#8195;', zwnj: '&#8204;', zwj: '&#8205;', lrm: '&#8206;',
  rlm: '&#8207;',
};

const ENTITY_NAMES = Object.keys(HTML_ENTITY_MAP);
const ENTITY_REGEX = new RegExp(`&(${ENTITY_NAMES.join('|')});`, 'gi');

async function fixEpubEntities(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    let modified = false;
    for (const [path, file] of Object.entries(zip.files)) {
      if (file.dir || !/\.(x?html?|xml|opf|ncx)$/i.test(path)) continue;
      const content = await file.async('string');
      if (ENTITY_REGEX.test(content)) {
        ENTITY_REGEX.lastIndex = 0;
        const fixed = content.replace(ENTITY_REGEX, (_, entity: string) =>
          HTML_ENTITY_MAP[entity.toLowerCase()] || `&${entity};`
        );
        zip.file(path, fixed);
        modified = true;
      }
    }
    return modified ? await zip.generateAsync({ type: 'arraybuffer' }) : buffer;
  } catch {
    return buffer;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EpubReader({
  fileUrl,
  bookId,
  fileName,
  initialCfi,
  onClose,
}: EpubReaderProps) {
  const { saveReadingProgress, state } = useApp();

  const [location, setLocation] = useState<string | number>(initialCfi || 0);
  const [theme, setTheme] = useState<ReaderTheme>(state.theme === 'dark' ? 'dark' : 'light');
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('');
  const [flowMode, setFlowMode] = useState<FlowMode>('paginated');
  const [spreadMode, setSpreadMode] = useState<SpreadMode>('none');
  const [showSettings, setShowSettings] = useState(false);
  const [showHighlightPanel, setShowHighlightPanel] = useState(false);
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [epubData, setEpubData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [showTocPanel, setShowTocPanel] = useState(false);
  const [readerKey, setReaderKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const renditionRef = useRef<Rendition | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const tocPanelRef = useRef<HTMLDivElement>(null);
  const highlightPanelRef = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef<string>('');
  const highlightColorRef = useRef(highlightColor);
  useEffect(() => { highlightColorRef.current = highlightColor; }, [highlightColor]);

  const bookFileName = fileName || state.books.find(b => b.id === bookId)?.fileName || 'book.epub';
  const title = bookFileName.replace(/\.[^/.]+$/, '');
  const t = THEMES[theme];
  const fontIdx = FONT_SIZES.indexOf(fontSize);

  /* ---- Load & preprocess EPUB ---- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(fileUrl)
      .then(res => res.arrayBuffer())
      .then(buf => fixEpubEntities(buf))
      .then(buf => { if (!cancelled) { setEpubData(buf); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err.message || 'Failed to load EPUB'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [fileUrl]);

  /* ---- Theme + font ---- */
  const applyRenditionStyles = useCallback((rendition: Rendition) => {
    const th = THEMES[theme];
    rendition.themes.override('color', th.body.color as string);
    rendition.themes.override('background', th.body.background as string);
    rendition.themes.override('font-size', `${fontSize}px`);
    rendition.themes.override('line-height', '1.7');
    rendition.themes.override('word-spacing', '0.05em');
    rendition.themes.override('letter-spacing', '0.01em');
    if (fontFamily) {
      rendition.themes.override('font-family', fontFamily);
    }
  }, [theme, fontSize, fontFamily]);

  const handleGetRendition = useCallback((rendition: Rendition) => {
    renditionRef.current = rendition;
    applyRenditionStyles(rendition);
    rendition.spread(spreadMode === 'auto' ? 'auto' : 'none');
    highlights.forEach(h => {
      try {
        rendition.annotations.highlight(h.cfi, {}, undefined, 'epub-hl',
          { fill: h.color, 'fill-opacity': '0.35', 'mix-blend-mode': 'multiply' });
      } catch { /* skip */ }
    });
  }, [applyRenditionStyles, spreadMode, highlights]);

  useEffect(() => {
    if (renditionRef.current) applyRenditionStyles(renditionRef.current);
  }, [applyRenditionStyles]);

  useEffect(() => {
    if (renditionRef.current) renditionRef.current.spread(spreadMode === 'auto' ? 'auto' : 'none');
  }, [spreadMode]);

  const handleFlowChange = useCallback((flow: FlowMode) => {
    setFlowMode(flow);
    setReaderKey(k => k + 1);
  }, []);

  const handleLocationChanged = useCallback((cfi: string) => {
    setLocation(cfi);
    if (cfi && cfi !== lastSavedRef.current) {
      lastSavedRef.current = cfi;
      saveReadingProgress(bookId, { cfi, percentage: 0 });
    }
  }, [bookId, saveReadingProgress]);

  const handleTocChanged = useCallback((items: NavItem[]) => setToc(items), []);

  const handleTextSelected = useCallback((cfiRange: string, contents: Contents) => {
    if (!renditionRef.current) return;
    const color = highlightColorRef.current;
    renditionRef.current.annotations.highlight(cfiRange, {}, undefined, 'epub-hl',
      { fill: color, 'fill-opacity': '0.35', 'mix-blend-mode': 'multiply' });
    const text = contents.window?.getSelection()?.toString() || '';
    setHighlights(prev => [...prev, { cfi: cfiRange, text: text.slice(0, 200), color }]);
    contents.window?.getSelection()?.removeAllRanges();
  }, []);

  const goToHighlight = useCallback((cfi: string) => { setLocation(cfi); setShowHighlightPanel(false); }, []);

  /* ---- Export EPUB to PDF ---- */
  const exportEpubToPdf = useCallback(async () => {
    if (!renditionRef.current || exporting) return;
    setExporting(true);
    try {
      const book = renditionRef.current.book;
      const spine = book.spine as any;
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', putOnlyUsedFonts: true });
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();
      const margin = 50;
      const maxW = pW - margin * 2;
      let y = margin;
      let firstPage = true;

      const addNewPage = () => { pdf.addPage(); y = margin; };

      for (const section of spine.items || spine.spineItems || []) {
        try {
          const doc = await book.load(section.href);
          const body = (doc as any)?.body || (doc as any)?.documentElement?.querySelector?.('body');
          if (!body) continue;
          const text = body.textContent || '';
          if (!text.trim()) continue;

          const lines = pdf.splitTextToSize(text, maxW);
          for (const line of lines) {
            if (y + 14 > pH - margin) {
              addNewPage();
            }
            if (firstPage) { firstPage = false; } else if (y === margin && pdf.getNumberOfPages() === 1) { /* skip */ }
            pdf.setFontSize(11);
            pdf.text(line, margin, y);
            y += 14;
          }
          y += 10; // gap between chapters
        } catch { continue; }
      }
      pdf.save(`${title}.pdf`);
    } catch (e) {
      console.error('Export to PDF failed:', e);
    } finally {
      setExporting(false);
    }
  }, [exporting, title]);
  const removeHighlight = useCallback((cfi: string) => {
    renditionRef.current?.annotations.remove(cfi, 'highlight');
    setHighlights(prev => prev.filter(h => h.cfi !== cfi));
  }, []);
  const goToTocItem = useCallback((href: string) => { setLocation(href); setShowTocPanel(false); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!showSettings && !showTocPanel && !showHighlightPanel) return;
    const handleClick = (e: MouseEvent) => {
      const tgt = e.target as Node;
      if (showSettings && settingsRef.current && !settingsRef.current.contains(tgt)) setShowSettings(false);
      if (showTocPanel && tocPanelRef.current && !tocPanelRef.current.contains(tgt)) setShowTocPanel(false);
      if (showHighlightPanel && highlightPanelRef.current && !highlightPanelRef.current.contains(tgt)) setShowHighlightPanel(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSettings, showTocPanel, showHighlightPanel]);

  const readerStyles: typeof ReactReaderStyle = {
    ...ReactReaderStyle,
    container: { ...ReactReaderStyle.container, background: t.readerBg },
    readerArea: { ...ReactReaderStyle.readerArea, background: t.readerBg, transition: 'background 0.3s' },
    arrow: { ...ReactReaderStyle.arrow, color: theme === 'dark' ? '#aaa' : '#555' },
    arrowHover: { ...ReactReaderStyle.arrowHover, color: theme === 'dark' ? '#fff' : '#000' },
    tocArea: { ...ReactReaderStyle.tocArea, background: t.headerBg, color: t.headerFg },
    tocButton: { ...ReactReaderStyle.tocButton, color: theme === 'dark' ? '#aaa' : '#555' },
    tocButtonExpanded: { ...ReactReaderStyle.tocButtonExpanded, background: t.headerBg },
    toc: { ...ReactReaderStyle.toc, color: t.headerFg },
    tocBackground: { ...ReactReaderStyle.tocBackground },
  };

  const closeAllPanels = () => { setShowSettings(false); setShowTocPanel(false); setShowHighlightPanel(false); };

  /* ================================================================ */
  return (
    <div className="epub-reader-overlay">
      {/* ---- Top bar ---- */}
      <div className="epub-reader-topbar" style={{ background: t.headerBg, color: t.headerFg, borderBottom: `1px solid ${t.border}` }}>
        <div className="epub-reader-topbar-title" title={title}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          <span>{title}</span>
        </div>

        <div className="epub-reader-topbar-actions">
          {/* Flow mode */}
          <div className="epub-toolbar-group">
            <button className={`epub-toolbar-btn${flowMode === 'paginated' ? ' active' : ''}`} onClick={() => handleFlowChange('paginated')} title="Paginated (horizontal)" style={{ color: t.headerFg }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></svg>
            </button>
            <button className={`epub-toolbar-btn${flowMode === 'scrolled' ? ' active' : ''}`} onClick={() => handleFlowChange('scrolled')} title="Vertical scroll" style={{ color: t.headerFg }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="1" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></svg>
            </button>
          </div>

          {/* Spread mode */}
          <div className="epub-toolbar-group">
            <button className={`epub-toolbar-btn${spreadMode === 'none' ? ' active' : ''}`} onClick={() => setSpreadMode('none')} title="Single page" style={{ color: t.headerFg }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="3" width="14" height="18" rx="2" /></svg>
            </button>
            <button className={`epub-toolbar-btn${spreadMode === 'auto' ? ' active' : ''}`} onClick={() => setSpreadMode('auto')} title="Two pages" style={{ color: t.headerFg }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="9" height="18" rx="1" /><rect x="13" y="3" width="9" height="18" rx="1" /></svg>
            </button>
          </div>

          {/* TOC */}
          <button className={`epub-toolbar-btn${showTocPanel ? ' active' : ''}`} onClick={() => { closeAllPanels(); setShowTocPanel(v => !v); }} title="Table of Contents" style={{ color: t.headerFg }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>

          {/* Highlights */}
          <button className={`epub-toolbar-btn${showHighlightPanel ? ' active' : ''}`} onClick={() => { closeAllPanels(); setShowHighlightPanel(v => !v); }} title="Highlights" style={{ color: t.headerFg }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
            {highlights.length > 0 && <span className="epub-badge">{highlights.length}</span>}
          </button>

          {/* Export to PDF */}
          <button className="epub-toolbar-btn" onClick={exportEpubToPdf} disabled={exporting} title="Export to PDF" style={{ color: t.headerFg }}>
            {exporting ? (
              <div className="epub-spinner" style={{ width: 14, height: 14 }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            )}
          </button>

          {/* Settings */}
          <button className="epub-toolbar-btn" onClick={() => { closeAllPanels(); setShowSettings(v => !v); }} title="Settings" style={{ color: t.headerFg }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" /></svg>
          </button>

          {/* Close */}
          <button className="epub-toolbar-btn" onClick={onClose} title="Close (Esc)" style={{ color: t.headerFg }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* ---- Settings panel ---- */}
        {showSettings && (
          <div className="epub-reader-panel epub-reader-settings" ref={settingsRef} style={{ background: t.headerBg, borderColor: t.border }}>
            <div className="epub-settings-group">
              <label>Theme</label>
              <div className="epub-settings-row">
                {(['light', 'sepia', 'dark'] as ReaderTheme[]).map(th => (
                  <button key={th} className={`epub-theme-btn epub-theme-${th}${theme === th ? ' active' : ''}`} onClick={() => setTheme(th)}>{th.charAt(0).toUpperCase() + th.slice(1)}</button>
                ))}
              </div>
            </div>
            <div className="epub-settings-group">
              <label>Font Size: {fontSize}px</label>
              <div className="epub-settings-row">
                <button className="epub-font-btn" disabled={fontIdx <= 0} onClick={() => setFontSize(FONT_SIZES[Math.max(0, fontIdx - 1)])}>A−</button>
                <span className="epub-font-preview" style={{ fontSize: `${Math.min(fontSize, 24)}px` }}>Aa</span>
                <button className="epub-font-btn" disabled={fontIdx >= FONT_SIZES.length - 1} onClick={() => setFontSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, fontIdx + 1)])}>A+</button>
              </div>
            </div>
            <div className="epub-settings-group">
              <label>Highlight Color</label>
              <div className="epub-settings-row epub-highlight-colors">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c.name} className={`epub-color-swatch${highlightColor === c.value ? ' active' : ''}`} style={{ background: c.value }} onClick={() => setHighlightColor(c.value)} title={c.name} />
                ))}
              </div>
            </div>
            <div className="epub-settings-group">
              <label>Font</label>
              <div className="epub-font-family-list">
                {EPUB_FONTS.map(f => (
                  <button key={f.name} className={`epub-font-family-btn${fontFamily === f.value ? ' active' : ''}`} onClick={() => { setFontFamily(f.value); }} style={f.value ? { fontFamily: f.value } : {}}>
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---- TOC panel ---- */}
        {showTocPanel && (
          <div className="epub-reader-panel epub-reader-toc-panel" ref={tocPanelRef} style={{ background: t.headerBg, borderColor: t.border, color: t.headerFg }}>
            <div className="epub-panel-header">Table of Contents</div>
            <div className="epub-toc-list">
              {toc.length === 0 && <div className="epub-toc-empty">No table of contents</div>}
              {toc.map((item, i) => (
                <button key={i} className="epub-toc-item" onClick={() => goToTocItem(item.href)} title={item.label}>{item.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* ---- Highlights panel ---- */}
        {showHighlightPanel && (
          <div className="epub-reader-panel epub-reader-highlight-panel" ref={highlightPanelRef} style={{ background: t.headerBg, borderColor: t.border, color: t.headerFg }}>
            <div className="epub-panel-header">Highlights ({highlights.length})<span className="epub-panel-hint">Select text to highlight</span></div>
            <div className="epub-highlight-list">
              {highlights.length === 0 && <div className="epub-toc-empty">No highlights yet</div>}
              {highlights.map((h, i) => (
                <div key={i} className="epub-highlight-item">
                  <div className="epub-highlight-color-bar" style={{ background: h.color }} />
                  <button className="epub-highlight-text" onClick={() => goToHighlight(h.cfi)}>{h.text || '(highlight)'}</button>
                  <button className="epub-highlight-remove" onClick={() => removeHighlight(h.cfi)} title="Remove">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- Reader body ---- */}
      <div className="epub-reader-body" style={{ background: t.readerBg }}>
        {loading && (
          <div className="epub-reader-loading" style={{ color: t.headerFg }}>
            <div className="epub-spinner" />
            <span>Loading EPUB…</span>
          </div>
        )}
        {error && <div className="epub-reader-error" style={{ color: '#e74c3c' }}><span>Failed to load EPUB: {error}</span></div>}
        {epubData && !loading && !error && (
          <ReactReader
            key={readerKey}
            url={epubData}
            location={location}
            locationChanged={handleLocationChanged}
            title={title}
            showToc={false}
            readerStyles={readerStyles}
            getRendition={handleGetRendition}
            handleTextSelected={handleTextSelected}
            tocChanged={handleTocChanged}
            epubOptions={{ flow: flowMode === 'scrolled' ? 'scrolled-doc' : 'paginated', allowPopups: true }}
          />
        )}
      </div>
    </div>
  );
}
