import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header, Sidebar, BookGrid, BookFormModal, SettingsModal, EbookReader, EpubReader, PdfReader } from './components';
import { pickEbookFiles, generateCover, detectFormat } from './services';
import type { Book } from './types';
import './index.css';

function generateId(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function AppContent() {
  const { dispatch, addBook, state } = useApp();
  const [importing, setImporting] = useState(false);

  const handleAddBook = () => {
    dispatch({ type: 'OPEN_MODAL', payload: null });
  };

  const handleImportBooks = async () => {
    const handles = await pickEbookFiles();
    if (handles.length === 0) return;

    setImporting(true);
    let imported = 0;

    for (const handle of handles) {
      try {
        const file = await handle.getFile();
        const format = detectFormat(file.name);
        const title = file.name.replace(/\.(pdf|epub|djvu|mobi)$/i, '');
        
        // Generate cover from first page or embedded cover
        const cover = await generateCover(handle, format);
        
        const now = Date.now();
        const book: Book = {
          id: generateId(),
          title,
          author: '',
          year: null,
          language: '',
          tags: [],
          collections: state.activeCollection ? [state.activeCollection] : [],
          readLater: false,
          notes: '',
          coverBytes: cover?.bytes || null,
          coverMime: cover?.mime || null,
          fileHandle: handle,
          fileName: file.name,
          filePath: null,
          format,
          createdAt: now,
          updatedAt: now,
        };

        await addBook(book);
        imported++;
      } catch (error) {
        console.error(`Failed to import ${handle.name}:`, error);
      }
    }

    setImporting(false);
    if (imported > 0) {
      alert(`Successfully imported ${imported} book(s)`);
    }
  };

  const closeReader = () => {
    dispatch({ type: 'CLOSE_READER' });
  };

  // Determine which reader to use based on format
  const readingBook = state.readingBook;
  const bookFormat = readingBook?.book.format;

  const renderReader = () => {
    if (!readingBook) return null;

    if (bookFormat === 'pdf') {
      return (
        <PdfReader
          fileUrl={readingBook.fileUrl}
          bookId={readingBook.book.id}
          fileName={readingBook.book.fileName || undefined}
          initialPage={readingBook.book.readingProgress?.currentPage}
          onClose={closeReader}
        />
      );
    }

    if (bookFormat === 'epub') {
      return (
        <EpubReader
          fileUrl={readingBook.fileUrl}
          bookId={readingBook.book.id}
          fileName={readingBook.book.fileName || undefined}
          initialCfi={readingBook.book.readingProgress?.cfi}
          onClose={closeReader}
        />
      );
    }

    // MOBI, FB2, CBZ, DJVU, AZW3 etc → EbookReader (foliate-js + djvu.js)
    return (
      <EbookReader
        fileUrl={readingBook.fileUrl}
        bookId={readingBook.book.id}
        fileName={readingBook.book.fileName || undefined}
        initialPage={readingBook.book.readingProgress?.currentPage}
        initialCfi={readingBook.book.readingProgress?.cfi}
        onClose={closeReader}
      />
    );
  };

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Header 
          onAddBook={handleAddBook} 
          onImportPDFs={handleImportBooks}
          importing={importing}
        />
        <BookGrid />
      </main>
      <BookFormModal />
      <SettingsModal />
      
      {/* Reader Modal */}
      {readingBook && renderReader()}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
