import { useState } from 'react';
import { useApp } from '../../context';
import type { Book, PdfConversionSettings } from '../../types';
import { convertToPdf, downloadPdf, isPythonServerRunning } from '../../services';
import './ConvertModal.css';

interface ConvertModalProps {
  book: Book;
  settings?: PdfConversionSettings;
  onClose: () => void;
}

const PAGE_SIZES = [
  { id: 'a4', label: 'A4 (210×297mm)', width: 210, height: 297 },
  { id: 'letter', label: 'Letter (8.5×11")', width: 216, height: 279 },
  { id: 'a5', label: 'A5 (148×210mm)', width: 148, height: 210 },
  { id: 'legal', label: 'Legal (8.5×14")', width: 216, height: 356 },
] as const;

const FONT_FAMILIES = [
  { id: 'serif', label: 'Serif (Georgia)' },
  { id: 'sans-serif', label: 'Sans-serif (Arial)' },
  { id: 'monospace', label: 'Monospace (Courier)' },
];

export function ConvertModal({ book, onClose }: ConvertModalProps) {
  const { state } = useApp();
  const defaultSettings = state.readerSettings.conversion;

  const [settings, setSettings] = useState<PdfConversionSettings>({
    pageSize: defaultSettings.pageSize || 'a4',
    orientation: defaultSettings.orientation || 'portrait',
    marginTop: defaultSettings.marginTop || 20,
    marginBottom: defaultSettings.marginBottom || 20,
    marginLeft: defaultSettings.marginLeft || 20,
    marginRight: defaultSettings.marginRight || 20,
    fontSize: defaultSettings.fontSize || 12,
    fontFamily: defaultSettings.fontFamily || 'serif',
    lineHeight: defaultSettings.lineHeight || 1.5,
    includeImages: defaultSettings.includeImages ?? true,
    includeToc: defaultSettings.includeToc ?? true,
  });

  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleConvert = async () => {
    if (!book.fileHandle) {
      setError('No file linked to this book');
      return;
    }

    setIsConverting(true);
    setError(null);
    setProgress(0);
    
    try {
      // Check if Python server is running
      const serverRunning = await isPythonServerRunning();
      if (!serverRunning) {
        throw new Error('Python server not running. Run: npm run server');
      }

      setProgress(5);
      
      // Perform conversion
      const result = await convertToPdf(book.fileHandle, settings, setProgress);
      
      if (!result.success) {
        throw new Error(result.error || 'Conversion failed');
      }

      // Download the converted PDF
      if (result.pdfData && result.filename) {
        downloadPdf(result.pdfData, result.filename);
      }

      onClose();
    } catch (e: any) {
      setError(e.message || 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="convert-modal" onClick={handleOverlayClick}>
      <div className="convert-modal__overlay" />
      <div className="convert-modal__content">
        <div className="convert-modal__header">
          <h2 className="convert-modal__title">Convert to PDF</h2>
          <button className="convert-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="convert-modal__book-info">
          <span className="convert-modal__book-format">{book.format?.toUpperCase()}</span>
          <span className="convert-modal__book-title">{book.title}</span>
        </div>

        {error && (
          <div className="convert-modal__error">
            ⚠️ {error}
          </div>
        )}

        <div className="convert-modal__body">
          {/* Page Settings */}
          <div className="convert-modal__section">
            <h3 className="convert-modal__section-title">Page Settings</h3>
            
            <div className="convert-modal__row">
              <div className="convert-modal__field">
                <label className="convert-modal__label">Page Size</label>
                <select
                  className="convert-modal__select"
                  value={settings.pageSize}
                  onChange={(e) => setSettings(s => ({ ...s, pageSize: e.target.value as any }))}
                >
                  {PAGE_SIZES.map(size => (
                    <option key={size.id} value={size.id}>{size.label}</option>
                  ))}
                </select>
              </div>

              <div className="convert-modal__field">
                <label className="convert-modal__label">Orientation</label>
                <div className="convert-modal__btn-group">
                  <button
                    className={`convert-modal__btn ${settings.orientation === 'portrait' ? 'convert-modal__btn--active' : ''}`}
                    onClick={() => setSettings(s => ({ ...s, orientation: 'portrait' }))}
                  >
                    Portrait
                  </button>
                  <button
                    className={`convert-modal__btn ${settings.orientation === 'landscape' ? 'convert-modal__btn--active' : ''}`}
                    onClick={() => setSettings(s => ({ ...s, orientation: 'landscape' }))}
                  >
                    Landscape
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Margins */}
          <div className="convert-modal__section">
            <h3 className="convert-modal__section-title">Margins (mm)</h3>
            <div className="convert-modal__margins">
              <div className="convert-modal__margin-field">
                <label>Top</label>
                <input
                  type="number"
                  className="convert-modal__input"
                  value={settings.marginTop}
                  onChange={(e) => setSettings(s => ({ ...s, marginTop: Number(e.target.value) }))}
                  min={0}
                  max={100}
                />
              </div>
              <div className="convert-modal__margin-field">
                <label>Bottom</label>
                <input
                  type="number"
                  className="convert-modal__input"
                  value={settings.marginBottom}
                  onChange={(e) => setSettings(s => ({ ...s, marginBottom: Number(e.target.value) }))}
                  min={0}
                  max={100}
                />
              </div>
              <div className="convert-modal__margin-field">
                <label>Left</label>
                <input
                  type="number"
                  className="convert-modal__input"
                  value={settings.marginLeft}
                  onChange={(e) => setSettings(s => ({ ...s, marginLeft: Number(e.target.value) }))}
                  min={0}
                  max={100}
                />
              </div>
              <div className="convert-modal__margin-field">
                <label>Right</label>
                <input
                  type="number"
                  className="convert-modal__input"
                  value={settings.marginRight}
                  onChange={(e) => setSettings(s => ({ ...s, marginRight: Number(e.target.value) }))}
                  min={0}
                  max={100}
                />
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="convert-modal__section">
            <h3 className="convert-modal__section-title">Typography</h3>
            
            <div className="convert-modal__row">
              <div className="convert-modal__field">
                <label className="convert-modal__label">Font Family</label>
                <select
                  className="convert-modal__select"
                  value={settings.fontFamily}
                  onChange={(e) => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
                >
                  {FONT_FAMILIES.map(font => (
                    <option key={font.id} value={font.id}>{font.label}</option>
                  ))}
                </select>
              </div>

              <div className="convert-modal__field">
                <label className="convert-modal__label">Font Size (pt)</label>
                <input
                  type="number"
                  className="convert-modal__input"
                  value={settings.fontSize}
                  onChange={(e) => setSettings(s => ({ ...s, fontSize: Number(e.target.value) }))}
                  min={8}
                  max={24}
                />
              </div>

              <div className="convert-modal__field">
                <label className="convert-modal__label">Line Height</label>
                <input
                  type="number"
                  className="convert-modal__input"
                  value={settings.lineHeight}
                  onChange={(e) => setSettings(s => ({ ...s, lineHeight: Number(e.target.value) }))}
                  min={1}
                  max={3}
                  step={0.1}
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="convert-modal__section">
            <h3 className="convert-modal__section-title">Options</h3>
            
            <div className="convert-modal__checkboxes">
              <label className="convert-modal__checkbox">
                <input
                  type="checkbox"
                  checked={settings.includeImages}
                  onChange={(e) => setSettings(s => ({ ...s, includeImages: e.target.checked }))}
                />
                <span>Include images</span>
              </label>

              <label className="convert-modal__checkbox">
                <input
                  type="checkbox"
                  checked={settings.includeToc}
                  onChange={(e) => setSettings(s => ({ ...s, includeToc: e.target.checked }))}
                />
                <span>Include table of contents</span>
              </label>
            </div>
          </div>
        </div>

        <div className="convert-modal__footer">
          <p className="convert-modal__note">
            ⚠️ Conversion requires Python server with Calibre installed.
            <br />
            Run: <code>pip install calibre</code> then <code>python server/ebook_server.py</code>
          </p>
          <div className="convert-modal__actions">
            <button className="convert-modal__cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className="convert-modal__convert"
              onClick={handleConvert}
              disabled={isConverting}
            >
              {isConverting ? `Converting... ${progress}%` : 'Convert to PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
