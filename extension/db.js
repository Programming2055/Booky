/**
 * Booky Extension - IndexedDB Database Module
 * Stores ebooks directly in the browser
 */

const DB_NAME = 'BookyLibrary';
const DB_VERSION = 1;
const BOOKS_STORE = 'books';
const FILES_STORE = 'files';

let db = null;

/**
 * Initialize the database
 */
function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Books metadata store
      if (!database.objectStoreNames.contains(BOOKS_STORE)) {
        const booksStore = database.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
        booksStore.createIndex('title', 'title', { unique: false });
        booksStore.createIndex('author', 'author', { unique: false });
        booksStore.createIndex('addedAt', 'addedAt', { unique: false });
        booksStore.createIndex('type', 'type', { unique: false });
      }

      // Files blob store (separate for large files)
      if (!database.objectStoreNames.contains(FILES_STORE)) {
        database.createObjectStore(FILES_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Generate unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Add a book to the library
 */
async function addBook(bookData, fileBlob) {
  const database = await initDB();
  const id = generateId();

  const book = {
    id,
    title: bookData.title || 'Untitled',
    author: bookData.author || 'Unknown',
    type: bookData.type || 'unknown',
    size: fileBlob ? fileBlob.size : 0,
    addedAt: Date.now(),
    lastRead: null,
    progress: 0,
    sourceUrl: bookData.sourceUrl || null,
    cover: bookData.cover || null
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([BOOKS_STORE, FILES_STORE], 'readwrite');

    transaction.onerror = () => reject(transaction.error);

    // Store book metadata
    const booksStore = transaction.objectStore(BOOKS_STORE);
    booksStore.add(book);

    // Store file blob
    if (fileBlob) {
      const filesStore = transaction.objectStore(FILES_STORE);
      filesStore.add({ id, blob: fileBlob });
    }

    transaction.oncomplete = () => resolve(book);
  });
}

/**
 * Get all books
 */
async function getAllBooks() {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BOOKS_STORE, 'readonly');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Sort by addedAt descending
      const books = request.result.sort((a, b) => b.addedAt - a.addedAt);
      resolve(books);
    };
  });
}

/**
 * Get a book by ID
 */
async function getBook(id) {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BOOKS_STORE, 'readonly');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get book file blob
 */
async function getBookFile(id) {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILES_STORE, 'readonly');
    const store = transaction.objectStore(FILES_STORE);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result ? request.result.blob : null);
    };
  });
}

/**
 * Update book metadata
 */
async function updateBook(id, updates) {
  const database = await initDB();
  const book = await getBook(id);

  if (!book) throw new Error('Book not found');

  const updatedBook = { ...book, ...updates };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BOOKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.put(updatedBook);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updatedBook);
  });
}

/**
 * Delete a book
 */
async function deleteBook(id) {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([BOOKS_STORE, FILES_STORE], 'readwrite');

    transaction.onerror = () => reject(transaction.error);

    transaction.objectStore(BOOKS_STORE).delete(id);
    transaction.objectStore(FILES_STORE).delete(id);

    transaction.oncomplete = () => resolve(true);
  });
}

/**
 * Search books
 */
async function searchBooks(query) {
  const books = await getAllBooks();
  const lowerQuery = query.toLowerCase();

  return books.filter(book =>
    book.title.toLowerCase().includes(lowerQuery) ||
    book.author.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get library statistics
 */
async function getStats() {
  const books = await getAllBooks();

  const stats = {
    totalBooks: books.length,
    totalSize: books.reduce((sum, b) => sum + (b.size || 0), 0),
    byType: {},
    recentlyAdded: books.slice(0, 5)
  };

  books.forEach(book => {
    const type = book.type || 'unknown';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
  });

  return stats;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.BookyDB = {
    initDB,
    addBook,
    getAllBooks,
    getBook,
    getBookFile,
    updateBook,
    deleteBook,
    searchBooks,
    getStats
  };
}
