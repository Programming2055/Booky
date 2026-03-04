import { useState, useEffect } from 'react';
import { useApp } from '../../context';
import type { Theme, GridSettings, ReaderSettings, PdfReaderMode } from '../../types';
import './SettingsModal.css';

const THEMES: { id: Theme; name: string; color: string }[] = [
  { id: 'light', name: 'Light', color: '#f8f9fc' },
  { id: 'dark', name: 'Dark', color: '#1a1a1e' },
  { id: 'blue', name: 'Blue', color: '#dbeafe' },
  { id: 'rose', name: 'Rose', color: '#ffe4e6' },
  { id: 'sketch', name: 'Sketch', color: '#fdf6e3' },
];

const PER_ROW_OPTIONS = [
  { value: 0, label: 'Auto' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
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
  const [localPageSize, setLocalPageSize] = useState<number>(state.pageSize);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset local state when modal opens
  useEffect(() => {
    if (state.settingsOpen) {
      setLocalTheme(state.theme);
      setLocalGridSettings(state.gridSettings);
      setLocalReaderSettings(state.readerSettings);
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
      localPageSize !== state.pageSize;
    setHasChanges(changed);
  }, [localTheme, localGridSettings, localReaderSettings, localPageSize, state]);

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
    dispatch({ type: 'SET_READER_SETTINGS', payload: localReaderSettings });
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
                <div
                  className="settings-modal__theme-preview"
                  style={{ background: theme.color }}
                />
                <span className="settings-modal__theme-name">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Shelf Grid Section */}
        <div className="settings-modal__section">
          <h3 className="settings-modal__section-title">Shelf Grid</h3>
          <div className="settings-modal__group">
            <div className="settings-modal__field">
              <label className="settings-modal__label">Card Size</label>
              <div className="settings-modal__range-row">
                <input
                  type="range"
                  className="settings-modal__range"
                  min="140"
                  max="300"
                  step="10"
                  value={localGridSettings.shelfSize}
                  onChange={(e) =>
                    setLocalGridSettings((prev) => ({ ...prev, shelfSize: Number(e.target.value) }))
                  }
                />
                <span className="settings-modal__range-value">{localGridSettings.shelfSize}px</span>
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
              <span className="settings-modal__reader-info">Built-in Reader (foliate-js)</span>
            </div>
            <div className="settings-modal__reader-row settings-modal__reader-row--info">
              <span className="settings-modal__format-label">DJVU</span>
              <span className="settings-modal__reader-info">Built-in Reader (DjVu.js)</span>
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
