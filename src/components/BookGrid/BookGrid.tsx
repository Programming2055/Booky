import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useApp } from '../../context';
import type { Book, SortOption, BookViewMode } from '../../types';
import { BookCard } from '../BookCard';
import { openPdf, verifyFilePermission, downloadFile, openFileViaPythonServer, isPythonServerRunning } from '../../services';
import './BookGrid.css';

type ViewMode = 'shelf' | 'collections';

// Constants for bookshelf layout
const BOOK_SPINE_WIDTH = 150; // px
const BOOK_SPINE_GAP = 8; // px
const SHELF_PADDING = 40; // px (20px on each side)

// Get custom order from localStorage
function getCustomOrder(): string[] {
  try {
    return JSON.parse(localStorage.getItem('bookshelf_custom_order') || '[]');
  } catch {
    return [];
  }
}

// Save custom order to localStorage
function saveCustomOrder(order: string[]): void {
  localStorage.setItem('bookshelf_custom_order', JSON.stringify(order));
}

// Helper component for collection cover preview
function CollectionCoverPreview({ book }: { book: { coverBytes: Uint8Array | null; coverMime: string | null; title: string } }) {
  const coverUrl = useMemo(() => {
    if (!book.coverBytes) return null;
    let bytes: Uint8Array;
    if (book.coverBytes instanceof Uint8Array) {
      bytes = book.coverBytes;
    } else if ((book.coverBytes as unknown) instanceof ArrayBuffer) {
      bytes = new Uint8Array(book.coverBytes as unknown as ArrayBuffer);
    } else if (typeof book.coverBytes === 'object') {
      bytes = new Uint8Array(Object.values(book.coverBytes as object));
    } else {
      return null;
    }
    const blob = new Blob([bytes as BlobPart], { type: book.coverMime || 'image/png' });
    return URL.createObjectURL(blob);
  }, [book.coverBytes, book.coverMime]);

  return (
    <div className="collection-card__cover">
      {coverUrl ? (
        <img src={coverUrl} alt={book.title} />
      ) : (
        <span className="collection-card__cover-placeholder">{book.title.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

function sortBooks(books: Book[], sort: SortOption, customOrder?: string[]): Book[] {
  const sorted = [...books];
  switch (sort) {
    case 'title_asc':
      return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    case 'author_asc':
      return sorted.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
    case 'year_desc':
      return sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
    case 'year_asc':
      return sorted.sort((a, b) => (a.year || 0) - (b.year || 0));
    case 'custom':
      if (customOrder && customOrder.length > 0) {
        return sorted.sort((a, b) => {
          const indexA = customOrder.indexOf(a.id);
          const indexB = customOrder.indexOf(b.id);
          // Books not in custom order go to the end
          const posA = indexA === -1 ? Infinity : indexA;
          const posB = indexB === -1 ? Infinity : indexB;
          return posA - posB;
        });
      }
      return sorted;
    case 'updated_desc':
    default:
      return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

// List View Item Component
interface ListBookItemProps {
  book: Book;
  activeCollection: string | null;
  allCollections: string[];
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  onToggleReadLater: (book: Book) => void;
  onAddToCollection: (bookId: string, collection: string) => void;
  onRemoveFromCollection: (bookId: string, collection: string) => void;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function ListBookItem({
  book,
  onEdit,
  onDelete,
  onToggleReadLater,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: ListBookItemProps) {
  const coverUrl = useMemo(() => {
    if (!book.coverBytes) return null;
    let bytes: Uint8Array;
    if (book.coverBytes instanceof Uint8Array) {
      bytes = book.coverBytes;
    } else if ((book.coverBytes as unknown) instanceof ArrayBuffer) {
      bytes = new Uint8Array(book.coverBytes as unknown as ArrayBuffer);
    } else if (typeof book.coverBytes === 'object') {
      bytes = new Uint8Array(Object.values(book.coverBytes as object));
    } else {
      return null;
    }
    const blob = new Blob([bytes as BlobPart], { type: book.coverMime || 'image/png' });
    return URL.createObjectURL(blob);
  }, [book.coverBytes, book.coverMime]);

  const progress = book.readingProgress?.percentage || 0;

  return (
    <div
      className={`list-item ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="list-item__cover">
        {coverUrl ? (
          <img src={coverUrl} alt={book.title} />
        ) : (
          <span className="list-item__cover-placeholder">{book.title.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="list-item__content">
        <div className="list-item__header">
          <h3 className="list-item__title">{book.title}</h3>
          {book.readLater && <span className="list-item__badge">★</span>}
        </div>
        <p className="list-item__author">{book.author || 'Unknown Author'}</p>
        <div className="list-item__meta">
          {book.year && <span>{book.year}</span>}
          {book.language && <span>{book.language}</span>}
          <span className="list-item__format">{book.format.toUpperCase()}</span>
        </div>
        {book.tags.length > 0 && (
          <div className="list-item__tags">
            {book.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="list-item__tag">{tag}</span>
            ))}
          </div>
        )}
        {progress > 0 && (
          <div className="list-item__progress">
            <div className="list-item__progress-bar" style={{ width: `${progress}%` }} />
            <span>{Math.round(progress)}%</span>
          </div>
        )}
      </div>
      <div className="list-item__actions">
        <button onClick={() => onToggleReadLater(book)} title={book.readLater ? 'Remove from Read Later' : 'Add to Read Later'}>
          {book.readLater ? '★' : '☆'}
        </button>
        <button onClick={() => onEdit(book)} title="Edit">✎</button>
        <button onClick={() => onDelete(book.id)} title="Delete">✕</button>
      </div>
    </div>
  );
}

// Bookshelf Spine Component
interface BookSpineProps {
  book: Book;
  onOpen: (book: Book) => void;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  onToggleReadLater: (book: Book) => void;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

// Generate a color based on book title
function getSpineColor(title: string): string {
  const colors = [
    '#8B4513', '#A0522D', '#D2691E', '#CD853F', '#DEB887', // Browns
    '#800000', '#8B0000', '#A52A2A', '#B22222', '#DC143C', // Reds
    '#006400', '#228B22', '#2E8B57', '#3CB371', '#20B2AA', // Greens
    '#191970', '#000080', '#00008B', '#0000CD', '#4169E1', // Blues
    '#4B0082', '#6B238E', '#800080', '#9400D3', '#8A2BE2', // Purples
    '#2F4F4F', '#696969', '#708090', '#778899', '#5F6A6A', // Grays
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function BookSpine({
  book,
  onOpen,
  onEdit,
  onDelete,
  onToggleReadLater,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: BookSpineProps) {
  const spineColor = useMemo(() => getSpineColor(book.title), [book.title]);
  const textColor = '#f5f5dc'; // Beige/cream text

  // Generate cover URL
  const coverUrl = useMemo(() => {
    if (!book.coverBytes) return null;
    let bytes: Uint8Array;
    if (book.coverBytes instanceof Uint8Array) {
      bytes = book.coverBytes;
    } else if ((book.coverBytes as unknown) instanceof ArrayBuffer) {
      bytes = new Uint8Array(book.coverBytes as unknown as ArrayBuffer);
    } else if (typeof book.coverBytes === 'object') {
      bytes = new Uint8Array(Object.values(book.coverBytes as object));
    } else {
      return null;
    }
    const blob = new Blob([bytes as BlobPart], { type: book.coverMime || 'image/png' });
    return URL.createObjectURL(blob);
  }, [book.coverBytes, book.coverMime]);

  return (
    <div
      className={`book-spine ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{ '--spine-color': spineColor } as React.CSSProperties}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => onEdit(book)}
      title={`${book.title} by ${book.author || 'Unknown'}`}
    >
      {coverUrl && (
        <div className="book-spine__cover">
          <img src={coverUrl} alt={book.title} />
        </div>
      )}
      <div className="book-spine__content" style={{ color: textColor }}>
        <span className="book-spine__title">{book.title}</span>
        <span className="book-spine__author">{book.author || ''}</span>
      </div>
      {book.readLater && <span className="book-spine__bookmark">★</span>}
      <div className="book-spine__actions">
        <button onClick={(e) => { e.stopPropagation(); onOpen(book); }} className="book-spine__open-btn" title="Open">
          ▶
        </button>
        <button onClick={(e) => { e.stopPropagation(); onToggleReadLater(book); }} title={book.readLater ? 'Remove from Read Later' : 'Read Later'}>
          {book.readLater ? '★' : '☆'}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(book.id); }} title="Delete">✕</button>
      </div>
    </div>
  );
}

export function BookGrid() {
  const {
    state,
    dispatch,
    deleteBook,
    toggleReadLater,
    addToCollection,
    removeFromCollection,
    getAllCollections,
  } = useApp();

  const [viewMode, setViewMode] = useState<ViewMode>('shelf');
  const [customOrder, setCustomOrder] = useState<string[]>(() => getCustomOrder());
  const [draggedBookId, setDraggedBookId] = useState<string | null>(null);
  const [dragOverBookId, setDragOverBookId] = useState<string | null>(null);
  const dragOverRef = useRef<string | null>(null);
  
  // Get view mode from settings
  const bookViewMode: BookViewMode = state.gridSettings.viewMode || 'grid';
  
  // Bookshelf dynamic width calculation
  const bookshelfContainerRef = useRef<HTMLDivElement>(null);
  const [booksPerShelf, setBooksPerShelf] = useState(10);
  
  // Calculate books per shelf based on container width
  useEffect(() => {
    const calculateBooksPerShelf = () => {
      if (bookshelfContainerRef.current) {
        const containerWidth = bookshelfContainerRef.current.offsetWidth - SHELF_PADDING;
        const bookSlotWidth = BOOK_SPINE_WIDTH + BOOK_SPINE_GAP;
        const count = Math.floor(containerWidth / bookSlotWidth);
        setBooksPerShelf(Math.max(count, 1));
      }
    };
    
    calculateBooksPerShelf();
    
    const resizeObserver = new ResizeObserver(calculateBooksPerShelf);
    if (bookshelfContainerRef.current) {
      resizeObserver.observe(bookshelfContainerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, [bookViewMode]);

  // Get all collections (from books + standalone)
  const allCollections = useMemo(() => getAllCollections(), [state.books, state.collections]);

  // Get all unique collections from books (for display)
  const collections = useMemo(() => {
    const set = new Set<string>();
    state.books.forEach((book) => {
      book.collections.forEach((c) => set.add(c));
    });
    // Also include standalone collections
    state.collections.forEach((col) => set.add(col.name));
    return Array.from(set).sort();
  }, [state.books, state.collections]);

  // Get book count per collection
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    state.books.forEach((book) => {
      book.collections.forEach((c) => {
        counts[c] = (counts[c] || 0) + 1;
      });
    });
    return counts;
  }, [state.books]);

  // Get first 4 books with covers for each collection
  const collectionPreviews = useMemo(() => {
    const previews: Record<string, Array<{ id: string; coverBytes: Uint8Array | null; coverMime: string | null; title: string }>> = {};
    collections.forEach((name) => {
      const booksInCollection = state.books.filter((b) => b.collections.includes(name));
      previews[name] = booksInCollection.slice(0, 4).map((b) => ({
        id: b.id,
        coverBytes: b.coverBytes,
        coverMime: b.coverMime,
        title: b.title,
      }));
    });
    return previews;
  }, [state.books, collections]);

  const handleCollectionDoubleClick = useCallback((collectionName: string) => {
    dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: collectionName });
  }, [dispatch]);

  const handleBackToAll = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: null });
  }, [dispatch]);

  const filteredAndSortedBooks = useMemo(() => {
    let filtered = state.books.filter((book) => {
      if (state.filterReadLater && !book.readLater) return false;
      if (state.activeCollection && !book.collections.includes(state.activeCollection)) return false;
      if (state.search) {
        const searchLower = state.search.toLowerCase();
        const haystack = `${book.title} ${book.author} ${book.tags.join(' ')} ${book.collections.join(' ')}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    });
    return sortBooks(filtered, state.sort, customOrder);
  }, [state.books, state.filterReadLater, state.activeCollection, state.search, state.sort, customOrder]);

  // Drag and drop handlers with live swap
  const handleDragStart = useCallback((e: React.DragEvent, bookId: string) => {
    setDraggedBookId(bookId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', bookId);
    // Add dragging class to body
    document.body.classList.add('dragging-book');
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedBookId(null);
    setDragOverBookId(null);
    dragOverRef.current = null;
    document.body.classList.remove('dragging-book');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, bookId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Live swap: when dragging over a different book, swap positions immediately
    if (draggedBookId && bookId !== draggedBookId && dragOverRef.current !== bookId) {
      dragOverRef.current = bookId;
      setDragOverBookId(bookId);
      
      // Perform live swap in custom order
      const currentBookIds = customOrder.length > 0 ? [...customOrder] : filteredAndSortedBooks.map(b => b.id);
      const sourceIndex = currentBookIds.indexOf(draggedBookId);
      const targetIndex = currentBookIds.indexOf(bookId);
      
      if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
        // Swap positions
        const newOrder = [...currentBookIds];
        newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, draggedBookId);
        
        setCustomOrder(newOrder);
        saveCustomOrder(newOrder);
        
        // Switch to custom sort if not already
        if (state.sort !== 'custom') {
          dispatch({ type: 'SET_SORT', payload: 'custom' });
        }
      }
    }
  }, [draggedBookId, customOrder, filteredAndSortedBooks, state.sort, dispatch]);

  const handleDrop = useCallback((e: React.DragEvent, _targetBookId: string) => {
    e.preventDefault();
    // Live swap already handled in handleDragOver, just clean up
    handleDragEnd();
  }, [handleDragEnd]);

  const paginatedBooks = useMemo(() => {
    const start = (state.currentPage - 1) * state.pageSize;
    return filteredAndSortedBooks.slice(start, start + state.pageSize);
  }, [filteredAndSortedBooks, state.currentPage, state.pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedBooks.length / state.pageSize));

  const handleEdit = (book: Book) => {
    dispatch({ type: 'OPEN_MODAL', payload: book });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this book?')) return;
    await deleteBook(id);
  };

  const handleOpenBook = async (book: Book) => {
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
        try {
          const file = await book.fileHandle.getFile();
          const fileUrl = URL.createObjectURL(file);
          dispatch({ type: 'OPEN_READER', payload: { book, fileUrl } });
        } catch (_e) {
          alert('Could not open file. It may have been moved or deleted.');
        }
        return;
      }
      await openPdf(book.fileHandle, 'browser');
    } else if (foliateFormats.includes(format) || format === 'djvu') {
      try {
        const file = await book.fileHandle.getFile();
        const fileUrl = URL.createObjectURL(file);
        dispatch({ type: 'OPEN_READER', payload: { book, fileUrl } });
      } catch (_e) {
        alert('Could not open file. It may have been moved or deleted.');
      }
    } else {
      await downloadFile(book.fileHandle);
    }
  };

  const handleRemoveFromCollection = async (bookId: string, collection: string) => {
    await removeFromCollection(bookId, collection);
  };

  const getFilterDescription = () => {
    const parts: string[] = [];
    if (state.activeCollection) parts.push(`Collection: ${state.activeCollection}`);
    if (state.filterReadLater) parts.push('Read Later');
    if (state.search) parts.push(`Search: "${state.search}"`);
    return parts.length ? `${parts.join(' • ')} — ${filteredAndSortedBooks.length} result(s)` : `All books — ${filteredAndSortedBooks.length} total`;
  };

  return (
    <section className="book-grid">
      <div className="book-grid__header">
        <div>
          <h2 className="book-grid__title">
            {state.activeCollection ? state.activeCollection : (viewMode === 'shelf' ? 'My Shelf' : 'Collections')}
          </h2>
          <p className="book-grid__subtitle">{getFilterDescription()}</p>
        </div>
        
        {/* View Mode Tabs - only show when not in a collection */}
        {!state.activeCollection && !state.search && (
          <div className="book-grid__tabs">
            <button
              className={`book-grid__tab ${viewMode === 'shelf' ? 'book-grid__tab--active' : ''}`}
              onClick={() => setViewMode('shelf')}
            >
              Shelf
            </button>
            <button
              className={`book-grid__tab ${viewMode === 'collections' ? 'book-grid__tab--active' : ''}`}
              onClick={() => setViewMode('collections')}
            >
              Collections ({collections.length})
            </button>
          </div>
        )}

        {/* Book View Mode Tabs */}
        {(viewMode === 'shelf' || state.activeCollection || state.search) && (
          <div className="book-grid__view-tabs">
            <button
              className={`book-grid__view-btn ${bookViewMode === 'grid' ? 'book-grid__view-btn--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_GRID_SETTINGS', payload: { viewMode: 'grid' } })}
              title="Grid View"
            >
              ⊞
            </button>
            <button
              className={`book-grid__view-btn ${bookViewMode === 'list' ? 'book-grid__view-btn--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_GRID_SETTINGS', payload: { viewMode: 'list' } })}
              title="List View"
            >
              ☰
            </button>
            <button
              className={`book-grid__view-btn ${bookViewMode === 'bookshelf' ? 'book-grid__view-btn--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_GRID_SETTINGS', payload: { viewMode: 'bookshelf' } })}
              title="Bookshelf View"
            >
              📚
            </button>
          </div>
        )}
      </div>

      {/* Show back button when inside a collection */}
      {state.activeCollection && (
        <button className="book-grid__back-btn" onClick={handleBackToAll}>
          ← Back to Collections
        </button>
      )}

      {/* Collections View */}
      {viewMode === 'collections' && !state.activeCollection && !state.search && (
        <>
          {collections.length > 0 ? (
            <div
              className="book-grid__collections-grid"
              style={{
                '--collection-card-width': `${state.gridSettings.collectionSize}px`,
                ...(state.gridSettings.collectionPerRow > 0
                  ? { gridTemplateColumns: `repeat(${state.gridSettings.collectionPerRow}, 1fr)` }
                  : {}),
              } as React.CSSProperties}
            >
              {collections.map((name) => (
                <div
                  key={name}
                  className="collection-card"
                  onDoubleClick={() => handleCollectionDoubleClick(name)}
                  title={`Double-click to open "${name}"`}
                >
                  <div className="collection-card__covers">
                    {collectionPreviews[name]?.map((book) => (
                      <CollectionCoverPreview key={book.id} book={book} />
                    ))}
                    {/* Fill empty slots */}
                    {Array.from({ length: Math.max(0, 4 - (collectionPreviews[name]?.length || 0)) }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="collection-card__cover collection-card__cover--empty" />
                    ))}
                  </div>
                  <div className="collection-card__info">
                    <span className="collection-card__name">{name}</span>
                    <span className="collection-card__count">{collectionCounts[name] || 0} books</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="book-grid__empty">
              <h3>No collections yet</h3>
              <p>Add books to collections using the "+ Col" button on each book card</p>
            </div>
          )}
        </>
      )}

      {/* Shelf View - All Books */}
      {(viewMode === 'shelf' || state.activeCollection || state.search) && (
        <>
          {paginatedBooks.length === 0 ? (
            <div className="book-grid__empty">
              <h3>No books found</h3>
              <p>Try adjusting your filters or import some PDFs</p>
              <button
                className="btn btn--primary"
                onClick={() => dispatch({ type: 'OPEN_MODAL', payload: null })}
              >
                + Add Book
              </button>
            </div>
          ) : (
            <>
              {/* Grid View */}
              {bookViewMode === 'grid' && (
                <div
                  className="book-grid__grid"
                  style={{
                    '--shelf-card-width': `${state.gridSettings.shelfWidth}px`,
                    '--shelf-card-height': `${state.gridSettings.shelfHeight}px`,
                    ...(state.gridSettings.shelfPerRow > 0
                      ? { gridTemplateColumns: `repeat(${state.gridSettings.shelfPerRow}, 1fr)` }
                      : {}),
                  } as React.CSSProperties}
                >
                  {paginatedBooks.map((book) => (
                    <div
                      key={book.id}
                      className={`book-grid__card-wrapper ${draggedBookId === book.id ? 'dragging' : ''} ${dragOverBookId === book.id && draggedBookId !== book.id ? 'drag-over' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, book.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, book.id)}
                      onDrop={(e) => handleDrop(e, book.id)}
                    >
                      <BookCard
                        book={book}
                        activeCollection={state.activeCollection}
                        allCollections={allCollections}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleReadLater={toggleReadLater}
                        onAddToCollection={addToCollection}
                        onRemoveFromCollection={handleRemoveFromCollection}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* List View */}
              {bookViewMode === 'list' && (
                <div className="book-grid__list">
                  {paginatedBooks.map((book) => (
                    <ListBookItem
                      key={book.id}
                      book={book}
                      activeCollection={state.activeCollection}
                      allCollections={allCollections}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleReadLater={toggleReadLater}
                      onAddToCollection={addToCollection}
                      onRemoveFromCollection={handleRemoveFromCollection}
                      isDragging={draggedBookId === book.id}
                      isDragOver={dragOverBookId === book.id && draggedBookId !== book.id}
                      onDragStart={(e) => handleDragStart(e, book.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, book.id)}
                      onDrop={(e) => handleDrop(e, book.id)}
                    />
                  ))}
                </div>
              )}

              {/* Bookshelf View */}
              {bookViewMode === 'bookshelf' && (
                <div className="book-grid__bookshelf" ref={bookshelfContainerRef}>
                  {Array.from({ length: Math.ceil(paginatedBooks.length / booksPerShelf) }).map((_, shelfIndex) => {
                    const shelfBooks = paginatedBooks.slice(
                      shelfIndex * booksPerShelf,
                      (shelfIndex + 1) * booksPerShelf
                    );
                    return (
                      <div key={shelfIndex} className="bookshelf-row">
                        <div className="bookshelf-row__books">
                          {shelfBooks.map((book) => (
                            <BookSpine
                              key={book.id}
                              book={book}
                              onOpen={handleOpenBook}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onToggleReadLater={toggleReadLater}
                              isDragging={draggedBookId === book.id}
                              isDragOver={dragOverBookId === book.id && draggedBookId !== book.id}
                              onDragStart={(e) => handleDragStart(e, book.id)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => handleDragOver(e, book.id)}
                              onDrop={(e) => handleDrop(e, book.id)}
                            />
                          ))}
                        </div>
                        <div className="bookshelf-row__shelf">
                          <div className="bookshelf-row__shelf-top" />
                          <div className="bookshelf-row__shelf-front" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="book-grid__pagination">
                <button
                  className="btn btn--ghost"
                  disabled={state.currentPage <= 1}
                  onClick={() => dispatch({ type: 'SET_CURRENT_PAGE', payload: state.currentPage - 1 })}
                >
                  ← Prev
                </button>
                <span className="book-grid__page-info">
                  Page <strong>{state.currentPage}</strong> of <strong>{totalPages}</strong>
                </span>
                <button
                  className="btn btn--ghost"
                  disabled={state.currentPage >= totalPages}
                  onClick={() => dispatch({ type: 'SET_CURRENT_PAGE', payload: state.currentPage + 1 })}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
