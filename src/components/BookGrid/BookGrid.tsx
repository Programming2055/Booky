import { useMemo, useCallback, useState } from 'react';
import { useApp } from '../../context';
import type { Book, SortOption } from '../../types';
import { BookCard } from '../BookCard';
import './BookGrid.css';

type ViewMode = 'shelf' | 'collections';

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

function sortBooks(books: Book[], sort: SortOption): Book[] {
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
    case 'updated_desc':
    default:
      return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export function BookGrid() {
  const {
    state,
    dispatch,
    deleteBook,
    toggleReadLater,
    addToCollection,
    removeFromCollection,
  } = useApp();

  const [viewMode, setViewMode] = useState<ViewMode>('shelf');

  // Get all unique collections from books
  const collections = useMemo(() => {
    const set = new Set<string>();
    state.books.forEach((book) => {
      book.collections.forEach((c) => set.add(c));
    });
    return Array.from(set).sort();
  }, [state.books]);

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
    return sortBooks(filtered, state.sort);
  }, [state.books, state.filterReadLater, state.activeCollection, state.search, state.sort]);

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
              <div
                className="book-grid__grid"
                style={{
                  '--shelf-card-width': `${state.gridSettings.shelfSize}px`,
                  ...(state.gridSettings.shelfPerRow > 0
                    ? { gridTemplateColumns: `repeat(${state.gridSettings.shelfPerRow}, 1fr)` }
                    : {}),
                } as React.CSSProperties}
              >
                {paginatedBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    activeCollection={state.activeCollection}
                    allCollections={collections}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleReadLater={toggleReadLater}
                    onAddToCollection={addToCollection}
                    onRemoveFromCollection={handleRemoveFromCollection}
                  />
                ))}
              </div>

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
