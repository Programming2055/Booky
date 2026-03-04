import { useState, useEffect } from 'react';
import { useApp } from '../../context';
import type { Theme, GridSettings, ReaderSettings, PdfReaderMode, BookViewMode, SketchStyle } from '../../types';
import './SettingsModal.css';

const THEMES: { id: Theme; name: string; colors: string[] }[] = [
  { id: 'light', name: 'Light', colors: ['#f5f7fa', '#4f6ef7', '#ffffff'] },
  { id: 'dark', name: 'Dark', colors: ['#0d0f12', '#6c8cff', '#16181d'] },
  { id: 'midnight', name: 'Midnight', colors: ['#0c1525', '#4da6ff', '#162035'] },
  { id: 'ocean', name: 'Ocean', colors: ['#eef5fa', '#0a8ed9', '#e3eff8'] },
  { id: 'forest', name: 'Forest', colors: ['#edf5f0', '#27ae60', '#e0f0e6'] },
  { id: 'sunset', name: 'Sunset', colors: ['#fef8f3', '#f57c00', '#fff0e5'] },
  { id: 'royal', name: 'Royal', colors: ['#f8f5fc', '#9b59b6', '#f0e9f8'] },
  { id: 'rosegold', name: 'Rose Gold', colors: ['#fcf5f5', '#e06666', '#faeaea'] },
  { id: 'slate', name: 'Slate', colors: ['#f4f6f8', '#5a7fb8', '#ebeef2'] },
  { id: 'coffee', name: 'Coffee', colors: ['#f9f6f3', '#a67c52', '#f3ebe4'] },
  { id: 'nord', name: 'Nord', colors: ['#eceff4', '#5e81ac', '#d8dee9'] },
];

const SKETCH_STYLES: { id: SketchStyle; name: string; desc: string }[] = [
  { id: 'none', name: 'None', desc: 'No sketch effect' },
  { id: 'hand-drawn', name: 'Hand-drawn', desc: 'Pencil & paper feel' },
];

const PER_ROW_OPTIONS = [
  { value: 0, label: 'Auto' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
];

const VIEW_MODE_OPTIONS: { id: BookViewMode; label: string; icon: string }[] = [
  { id: 'grid', label: 'Grid', icon: '⊞' },
  { id: 'list', label: 'List', icon: '☰' },
  { id: 'bookshelf', label: 'Bookshelf', icon: '📚' },
];

const PDF_READER_MODES: { id: PdfReaderMode; label: string; desc: string }[] = [
  { id: 'browser', label: 'Browser Tab', desc: 'Open PDF in browser\'s built-in viewer' },
  { id: 'builtin', label: 'Built-in Reader', desc: 'Open with built-in reader (highlights, annotations, bookmarks)' },
  { id: 'system', label: 'System App', desc: 'Open with system default app (requires Python server)' },
];

export function SettingsModal() {
  const { state, dispatch } = useApp();

  // Local state for all settings
  const [localTheme, setLocalTheme] = useState<Theme>(state.theme);
  const [localGridSettings, setLocalGridSettings] = useState<GridSettings>(state.gridSettings);
  const [localReaderSettings, setLocalReaderSettings] = useState<ReaderSettings>(state.readerSettings);
  const [localSketchStyle, setLocalSketchStyle] = useState<SketchStyle>(state.readerSettings.sketchStyle ?? 'none');
  const [localUiFont, setLocalUiFont] = useState<string>(state.readerSettings.uiFont ?? 'system-ui');
  const [localPageSize, setLocalPageSize] = useState<number>(state.pageSize);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset local state when modal opens
  useEffect(() => {
    if (state.settingsOpen) {
      setLocalTheme(state.theme);
      setLocalGridSettings(state.gridSettings);
      setLocalReaderSettings(state.readerSettings);
      setLocalSketchStyle(state.readerSettings.sketchStyle ?? 'none');
      setLocalUiFont(state.readerSettings.uiFont ?? 'system-ui');
      setLocalPageSize(state.pageSize);
      setHasChanges(false);
    }
  }, [state.settingsOpen, state.theme, state.gridSettings, state.readerSettings, state.pageSize]);

  // Check for changes
  useEffect(() => {
    const changed =
      localTheme !== state.theme ||
      JSON.stringify(localGridSettings) !== JSON.stringify(state.gridSettings) ||
      JSON.stringify(localReaderSettings) !== JSON.stringify(state.readerSettings) ||
      localSketchStyle !== (state.readerSettings.sketchStyle ?? 'none') ||
      localUiFont !== (state.readerSettings.uiFont ?? 'system-ui') ||
      localPageSize !== state.pageSize;
    setHasChanges(changed);
  }, [localTheme, localGridSettings, localReaderSettings, localSketchStyle, localUiFont, localPageSize, state]);

  if (!state.settingsOpen) return null;

  const handleClose = () => {
    dispatch({ type: 'CLOSE_SETTINGS' });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleSave = () => {
    dispatch({ type: 'SET_THEME', payload: localTheme });
    dispatch({ type: 'SET_GRID_SETTINGS', payload: localGridSettings });
    dispatch({ type: 'SET_READER_SETTINGS', payload: { ...localReaderSettings, sketchStyle: localSketchStyle, uiFont: localUiFont } });
    dispatch({ type: 'SET_PAGE_SIZE', payload: localPageSize });
    handleClose();
  };

  return (
    <div className="settings-modal" onClick={handleOverlayClick}>
      <div className="settings-modal__overlay" />
      <div className="settings-modal__content">
        <div className="settings-modal__header">
          <h2 className="settings-modal__title">Settings</h2>
          <button className="settings-modal__close" onClick={handleClose}>
            ✕
          </button>
        </div>

        {/* Theme Section */}
        <div className="settings-modal__section">
          <h3 className="settings-modal__section-title">Theme</h3>
          <div className="settings-modal__themes">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                className={`settings-modal__theme-btn ${localTheme === theme.id ? 'settings-modal__theme-btn--active' : ''}`}
                onClick={() => setLocalTheme(theme.id)}
              >
                <div className="settings-modal__theme-preview">
                  <div className="settings-modal__theme-colors">
                    {theme.colors.map((color, idx) => (
                      <div key={idx} style={{ background: color }} />
                    ))}
                  </div>
                </div>
                <span className="settings-modal__theme-name">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sketch Style Section */}
        <div className="settings-modal__section">
          <h3 className="settings-modal__section-title">Sketch Style <span className="settings-modal__hint-inline">(overlay)</span></h3>
          <div className="settings-modal__sketch-styles">
            {SKETCH_STYLES.map((style) => (
              <button
                key={style.id}
                className={`settings-modal__sketch-btn ${localSketchStyle === style.id ? 'settings-modal__sketch-btn--active' : ''}`}
                onClick={() => setLocalSketchStyle(style.id)}
                title={style.desc}
              >
                {style.name}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Section */}
        <div className="settings-modal__section">
          <h3 className="settings-modal__section-title">Default View</h3>
          <div className="settings-modal__view-modes">
            {VIEW_MODE_OPTIONS.map((mode) => (
              <button
                key={mode.id}
                className={`settings-modal__view-btn ${localGridSettings.viewMode === mode.id ? 'settings-modal__view-btn--active' : ''}`}
                onClick={() => setLocalGridSettings((prev) => ({ ...prev, viewMode: mode.id }))}
              >
                <span className="settings-modal__view-icon">{mode.icon}</span>
                <span className="settings-modal__view-label">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-modal__section">
          <h3 className="settings-modal__section-title">UI Font</h3>
          <select className="settings-modal__select" value={localUiFont} onChange={e => setLocalUiFont(e.target.value)}>
            <option value="system-ui">System Default</option>
            <option value="sans-serif">Sans Serif</option>
            <option value="serif">Serif</option>
            <option value="monospace">Monospace</option>
            <option value="Roboto, Arial, sans-serif">Roboto</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="Inter, Arial, sans-serif">Inter</option>
          </select>
        </div>

        {/* Shelf Grid Section */}
        <div className="settings-modal__section">
          <h3 className="settings-modal__section-title">Shelf Grid</h3>
          <div className="settings-modal__group">
            <div className="settings-modal__field">
              <label className="settings-modal__label">Card Width</label>
              <div className="settings-modal__range-row">
                <input
                  type="range"
                  className="settings-modal__range"
                  min="120"
                  max="280"
                  step="10"
                  value={localGridSettings.shelfWidth}
                  onChange={(e) =>
                    setLocalGridSettings((prev) => ({ ...prev, shelfWidth: Number(e.target.value) }))
                  }
                />
                <span className="settings-modal__range-value">{localGridSettings.shelfWidth}px</span>
              </div>
            </div>
            <div className="settings-modal__field">
              <label className="settings-modal__label">Card Height</label>
              <div className="settings-modal__range-row">
                <input
                  type="range"
                  className="settings-modal__range"
                  min="160"
                  max="400"
                  step="10"
                  value={localGridSettings.shelfHeight}
                  onChange={(e) =>
                    setLocalGridSettings((prev) => ({ ...prev, shelfHeight: Number(e.target.value) }))
                  }
                />
                <span className="settings-modal__range-value">{localGridSettings.shelfHeight}px</span>
              </div>
            </div>
            <div className="settings-modal__field">
              <label className="settings-modal__label">Items Per Row</label>
              <div className="settings-modal__row-options">
                {PER_ROW_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`settings-modal__row-btn ${localGridSettings.shelfPerRow === opt.value ? 'settings-modal__row-btn--active' : ''}`}
                    onClick={() =>
                      setLocalGridSettings((prev) => ({ ...prev, shelfPerRow: opt.value }))
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Collections Grid Section */}
        <div className="settings-modal__section">
          <h3 className="settings-modal__section-title">Collections Grid</h3>
          <div className="settings-modal__group">
            <div className="settings-modal__field">
              <label className="settings-modal__label">Card Size</label>
              <div className="settings-modal__range-row">
                <input
                  type="range"
                  className="settings-modal__range"
                  min="100"
                  max="250"
                  step="10"
                  value={localGridSettings.collectionSize}
                  onChange={(e) =>
                    setLocalGridSettings((prev) => ({ ...prev, collectionSize: Number(e.target.value) }))
                  }
                />
                <span className="settings-modal__range-value">{localGridSettings.collectionSize}px</span>
              </div>
            </div>
            <div className="settings-modal__field">
              <label className="settings-modal__label">Items Per Row</label>
              <div className="settings-modal__row-options">
                {PER_ROW_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`settings-modal__row-btn ${localGridSettings.collectionPerRow === opt.value ? 'settings-modal__row-btn--active' : ''}`}
                    onClick={() =>
                      setLocalGridSettings((prev) => ({ ...prev, collectionPerRow: opt.value }))
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reader Settings Section */}
        <div className="settings-modal__section">
          <h3 className="settings-modal__section-title">Reader Settings</h3>
          <p className="settings-modal__hint">
            Configure how different ebook formats are opened when you click a book.
          </p>
          <div className="settings-modal__reader-grid">
            <div className="settings-modal__reader-row">
              <span className="settings-modal__format-label">PDF</span>
              <div className="settings-modal__reader-options">
                {PDF_READER_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    className={`settings-modal__reader-btn ${localReaderSettings.pdf === mode.id ? 'settings-modal__reader-btn--active' : ''}`}
                    onClick={() =>
                      setLocalReaderSettings((prev) => ({ ...prev, pdf: mode.id }))
                    }
                    title={mode.desc}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-modal__reader-row settings-modal__reader-row--info">
              <span className="settings-modal__format-label">EPUB / MOBI / FB2 / CBZ</span>
              <span className="settings-modal__reader-info">Built-in Reader</span>
            </div>
            <div className="settings-modal__reader-row settings-modal__reader-row--info">
              <span className="settings-modal__format-label">DJVU</span>
              <span className="settings-modal__reader-info">Built-in Reader</span>
            </div>
          </div>

          {localReaderSettings.pdf === 'system' && (
            <p className="settings-modal__hint" style={{ marginTop: '8px' }}>
              ⚠️ Requires Python server. Run: <code>python server/ebook_server.py</code>
            </p>
          )}
        </div>

        {/* Pagination Section */}
        <div className="settings-modal__section">
          <h3 className="settings-modal__section-title">Pagination</h3>
          <div className="settings-modal__field">
            <label className="settings-modal__label">Books Per Page</label>
            <select
              className="settings-modal__select"
              value={localPageSize}
              onChange={(e) => setLocalPageSize(Number(e.target.value))}
            >
              <option value="12">12</option>
              <option value="24">24</option>
              <option value="48">48</option>
              <option value="96">96</option>
            </select>
          </div>
        </div>

        {/* Footer with Save Button */}
        <div className="settings-modal__footer">
          <button className="settings-modal__cancel-btn" onClick={handleClose}>
            Cancel
          </button>
          <button
            className={`settings-modal__save-btn ${hasChanges ? 'settings-modal__save-btn--active' : ''}`}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
