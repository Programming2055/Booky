import { useMemo, useState, useRef, useEffect } from 'react';
import type { Book } from '../../types';
import { openPdf, verifyFilePermission, downloadFile, openFileViaPythonServer, isPythonServerRunning } from '../../services';
import { useApp } from '../../context';
import './BookCard.css';

interface BookCardProps {
  book: Book;
  activeCollection: string | null;
  allCollections: string[];
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  onToggleReadLater: (book: Book) => void;
  onAddToCollection: (bookId: string, collection: string) => void;
  onRemoveFromCollection: (bookId: string, collection: string) => void;
}

export function BookCard({
  book,
  activeCollection,
  allCollections,
  onEdit,
  onDelete,
  onToggleReadLater,
  onAddToCollection,
  onRemoveFromCollection,
}: BookCardProps) {
  const { state, dispatch } = useApp();
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const coverUrl = useMemo(() => {
    if (!book.coverBytes) return null;
    // Handle different formats that might come from IndexedDB
    let bytes: Uint8Array;
    if (book.coverBytes instanceof Uint8Array) {
      bytes = book.coverBytes;
    } else if ((book.coverBytes as unknown) instanceof ArrayBuffer) {
      bytes = new Uint8Array(book.coverBytes as unknown as ArrayBuffer);
    } else if (typeof book.coverBytes === 'object') {
      // IndexedDB sometimes returns plain objects for Uint8Array
      bytes = new Uint8Array(Object.values(book.coverBytes as object));
    } else {
      return null;
    }
    const blob = new Blob([bytes as BlobPart], { type: book.coverMime || 'image/png' });
    return URL.createObjectURL(blob);
  }, [book.coverBytes, book.coverMime]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCollectionMenu(false);
      }
    };
    if (showCollectionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCollectionMenu]);

  const handleAddToNewCollection = () => {
    const name = prompt('Enter new collection name:');
    if (name?.trim()) {
      onAddToCollection(book.id, name.trim());
    }
    setShowCollectionMenu(false);
  };
  
  const handleRemoveFromCollection = () => {
    if (!activeCollection) return;
    const confirmed = confirm(
      `Remove "${book.title}" from "${activeCollection}"?\n\n` +
      `The book will still be available in your library.`
    );
    if (confirmed) {
      onRemoveFromCollection(book.id, activeCollection);
    }
  };

  const handleOpen = async () => {
    if (!book.fileHandle) {
      alert('No file linked. Edit the book to link a file.');
      return;
    }
    
    const format = book.format || 'pdf';
    
    // Verify permission first
    const hasPermission = await verifyFilePermission(book.fileHandle);
    if (!hasPermission) {
      alert('Permission denied. Please grant access to the file when prompted.');
      return;
    }

    // Formats supported by foliate-js (built-in reader)
    const foliateFormats = ['epub', 'mobi', 'fb2', 'cbz', 'azw3', 'azw'];
    
    if (format === 'pdf') {
      if (state.readerSettings.pdf === 'system') {
        // Use Python server to open with system default PDF app
        const serverRunning = await isPythonServerRunning();
        if (serverRunning) {
          const opened = await openFileViaPythonServer(book.fileHandle);
          if (opened) return;
          alert('Could not open file with system app.');
        } else {
          alert('Python server not running.\n\nRun: npm run server\nor: python server/ebook_server.py');
        }
        return;
      } else if (state.readerSettings.pdf === 'builtin') {
        // Use built-in PDF reader with annotations
        try {
          const file = await book.fileHandle.getFile();
          const fileUrl = URL.createObjectURL(file);
          dispatch({ type: 'OPEN_READER', payload: { book, fileUrl } });
        } catch (_e) {
          alert('Could not open file. It may have been moved or deleted.');
        }
        return;
      }
      // Browser tab mode (default)
      await openPdf(book.fileHandle, 'browser');
    } else if (foliateFormats.includes(format) || format === 'djvu') {
      // Use built-in reader (foliate-js for EPUB/MOBI/etc, DjVu.js for DJVU)
      try {
        const file = await book.fileHandle.getFile();
        const fileUrl = URL.createObjectURL(file);
        dispatch({ type: 'OPEN_READER', payload: { book, fileUrl } });
      } catch (_e) {
        alert('Could not open file. It may have been moved or deleted.');
      }
    } else {
      // Unknown format - try to download
      await downloadFile(book.fileHandle);
    }
  };

  // Format badge text
  const formatBadge = book.format?.toUpperCase() || 'PDF';

  return (
    <article className="book-card">
      <div className={`book-card__cover ${coverUrl ? '' : 'book-card__cover--placeholder'}`}>
        {coverUrl ? (
          <img src={coverUrl} alt={`Cover of ${book.title}`} />
        ) : (
          <>
            <span className="book-card__cover-icon">📖</span>
            <span className="book-card__cover-title">{book.title || 'Untitled'}</span>
          </>
        )}
        <span className="book-card__format-badge">{formatBadge}</span>
        <button
          className="book-card__delete"
          onClick={() => onDelete(book.id)}
          title="Delete book"
        >
          ✕
        </button>
      </div>

      <div className="book-card__info">
        <h3 className="book-card__title">{book.title || 'Untitled'}</h3>
      </div>

      {/* Side action buttons - appear on hover */}
      <div className="book-card__side-actions">
        <button
          className="book-card__side-btn book-card__side-btn--primary"
          onClick={handleOpen}
          title="Open"
        >
          ▶
        </button>
        <button
          className="book-card__side-btn"
          onClick={() => onEdit(book)}
          title="Edit"
        >
          ✎
        </button>
        <div className="book-card__collection-wrapper" ref={menuRef}>
          <button
            className="book-card__side-btn"
            onClick={() => setShowCollectionMenu(!showCollectionMenu)}
            title="Add to collection"
          >
            +
          </button>
          {showCollectionMenu && (
            <div className="book-card__collection-menu">
              <div className="book-card__collection-menu-header">Add to Collection</div>
              {allCollections.filter(c => !book.collections.includes(c)).map((col) => (
                <button
                  key={col}
                  className="book-card__collection-menu-item"
                  onClick={() => {
                    onAddToCollection(book.id, col);
                    setShowCollectionMenu(false);
                  }}
                >
                  {col}
                </button>
              ))}
              <button
                className="book-card__collection-menu-item book-card__collection-menu-item--new"
                onClick={handleAddToNewCollection}
              >
                + New Collection
              </button>
            </div>
          )}
        </div>
        <button
          className="book-card__side-btn"
          onClick={() => onToggleReadLater(book)}
          title={book.readLater ? 'Remove from Read Later' : 'Read Later'}
        >
          {book.readLater ? '★' : '☆'}
        </button>

        {activeCollection && (
          <button
            className="book-card__side-btn book-card__side-btn--danger"
            onClick={handleRemoveFromCollection}
            title={`Remove from ${activeCollection}`}
          >
            ✕
          </button>
        )}
      </div>

    </article>
  );
}
