import { useState, useCallback } from 'react';
import * as pdfTools from '../../services/pdfTools';
import './PdfTools.css';

interface PdfToolsProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
  onProcessed?: (url: string) => void;
}

export function PdfTools({ fileUrl, fileName, onClose, onProcessed }: PdfToolsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Tool states
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [pageNumPosition, setPageNumPosition] = useState<'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center'>('bottom-center');
  const [pageNumFormat, setPageNumFormat] = useState('{n}');

  const handleAction = useCallback(async (
    action: string,
    processor: () => Promise<Uint8Array>
  ) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await processor();
      
      // Download result
      const outputName = `${fileName.replace('.pdf', '')}_${action}.pdf`;
      pdfTools.downloadPdfFile(result, outputName);
      
      setSuccess(`Done! File downloaded as "${outputName}"`);
      
      // Optionally provide URL for preview
      if (onProcessed) {
        const url = pdfTools.pdfToUrl(result);
        onProcessed(url);
      }
    } catch (e: any) {
      console.error(`${action} failed:`, e);
      setError(e.message || `Failed to ${action}`);
    } finally {
      setIsProcessing(false);
    }
  }, [fileName, onProcessed]);

  const handleRotate = () => handleAction(`rotated_${rotateAngle}`,
    () => pdfTools.rotatePdf(fileUrl, rotateAngle)
  );

  const handleAddPageNumbers = () => handleAction('numbered',
    () => pdfTools.addPageNumbers(fileUrl, {
      position: pageNumPosition,
      format: pageNumFormat,
      fontSize: 12,
    })
  );

  return (
    <div className="pdf-tools">
      <div className="pdf-tools__header">
        <h3>PDF Tools</h3>
        <span className="pdf-tools__badge">Client-side</span>
        <button className="pdf-tools__close" onClick={onClose}>✕</button>
      </div>

      {/* Messages */}
      {error && (
        <div className="pdf-tools__message pdf-tools__message--error">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}
      {success && (
        <div className="pdf-tools__message pdf-tools__message--success">
          {success}
          <button onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="pdf-tools__processing">
          <div className="pdf-tools__spinner" />
          <span>Processing PDF...</span>
        </div>
      )}

      <div className="pdf-tools__content">
        {/* Rotate */}
        <div className="pdf-tools__tool">
          <label>Rotate All Pages</label>
          <div className="pdf-tools__row">
            <select 
              value={rotateAngle} 
              onChange={e => setRotateAngle(Number(e.target.value) as 90 | 180 | 270)}
              disabled={isProcessing}
            >
              <option value={90}>90° Clockwise</option>
              <option value={180}>180°</option>
              <option value={270}>90° Counter-clockwise</option>
            </select>
            <button onClick={handleRotate} disabled={isProcessing}>
              Rotate
            </button>
          </div>
        </div>

        {/* Page Numbers */}
        <div className="pdf-tools__tool">
          <label>Add Page Numbers</label>
          <div className="pdf-tools__row">
            <select 
              value={pageNumPosition} 
              onChange={e => setPageNumPosition(e.target.value as any)}
              disabled={isProcessing}
            >
              <option value="bottom-center">Bottom Center</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="top-center">Top Center</option>
            </select>
          </div>
          <div className="pdf-tools__row">
            <select 
              value={pageNumFormat} 
              onChange={e => setPageNumFormat(e.target.value)}
              disabled={isProcessing}
            >
              <option value="{n}">1, 2, 3...</option>
              <option value="Page {n}">Page 1, Page 2...</option>
              <option value="{n} / {total}">1 / 10, 2 / 10...</option>
              <option value="Page {n} of {total}">Page 1 of 10...</option>
            </select>
            <button onClick={handleAddPageNumbers} disabled={isProcessing}>
              Add Numbers
            </button>
          </div>
        </div>
      </div>

      <div className="pdf-tools__footer">
        <span>📄 {fileName}</span>
        <span className="pdf-tools__info">No server needed - runs in browser</span>
      </div>
    </div>
  );
}
