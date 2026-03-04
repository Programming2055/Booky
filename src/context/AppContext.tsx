import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Book, SortOption, Theme, GridSettings, Collection, ReaderSettings, ReadingBook, ReadingProgress } from '../types';
import { getAllBooks, saveBook, deleteBook as deleteBookFromDB } from '../services';

interface AppState {
  books: Book[];
  collections: Collection[];
  loading: boolean;
  search: string;
  sort: SortOption;
  activeCollection: string | null;
  filterReadLater: boolean;
  theme: Theme;
  panelVisible: boolean;
  gridSettings: GridSettings;
  readerSettings: ReaderSettings;
  pageSize: number;
  currentPage: number;
  modalOpen: boolean;
  editingBook: Book | null;
  settingsOpen: boolean;
  readingBook: ReadingBook | null;
}

type Action =
  | { type: 'SET_BOOKS'; payload: Book[] }
  | { type: 'ADD_BOOK'; payload: Book }
  | { type: 'UPDATE_BOOK'; payload: Book }
  | { type: 'DELETE_BOOK'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_SORT'; payload: SortOption }
  | { type: 'SET_ACTIVE_COLLECTION'; payload: string | null }
  | { type: 'SET_FILTER_READ_LATER'; payload: boolean }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'SET_GRID_SETTINGS'; payload: Partial<GridSettings> }
  | { type: 'SET_READER_SETTINGS'; payload: Partial<ReaderSettings> }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'OPEN_MODAL'; payload: Book | null }
  | { type: 'CLOSE_MODAL' }
  | { type: 'SET_COLLECTIONS'; payload: Collection[] }
  | { type: 'ADD_COLLECTION'; payload: Collection }
  | { type: 'REMOVE_COLLECTION'; payload: string }
  | { type: 'OPEN_SETTINGS' }
  | { type: 'CLOSE_SETTINGS' }
  | { type: 'OPEN_READER'; payload: ReadingBook }
  | { type: 'CLOSE_READER' }
  | { type: 'UPDATE_READING_PROGRESS'; payload: { bookId: string; progress: ReadingProgress } };

const initialState: AppState = {
  books: [],
  collections: [],
  loading: true,
  search: '',
  sort: 'updated_desc',
  activeCollection: null,
  filterReadLater: false,
  theme: 'light',
  panelVisible: true,
  gridSettings: {
    shelfWidth: 120,
    shelfHeight: 350,
    shelfPerRow: 4,
    collectionSize: 160,
    collectionPerRow: 4,
    viewMode: 'grid',
  },
  readerSettings: {
    pdf: 'builtin',
    libraryPath: '',
    pdfViewer: {
      zoom: 1,
      sidebarVisible: true,
      highlightColor: '#ffff00',
    },
    conversion: {
      pageSize: 'a4',
      orientation: 'portrait',
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 20,
      marginRight: 20,
      fontSize: 12,
      fontFamily: 'serif',
      lineHeight: 1.5,
      includeImages: true,
      includeToc: true,
    },
    uiFont: 'system-ui',
    sketchStyle: 'none',
  },
  pageSize: 24,
  currentPage: 1,
  modalOpen: false,
  editingBook: null,
  settingsOpen: false,
  readingBook: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_BOOKS':
      return { ...state, books: action.payload, loading: false };
    case 'ADD_BOOK':
      return { ...state, books: [action.payload, ...state.books] };
    case 'UPDATE_BOOK':
      return {
        ...state,
        books: state.books.map((b) =>
          b.id === action.payload.id ? action.payload : b
        ),
      };
    case 'DELETE_BOOK':
      return {
        ...state,
        books: state.books.filter((b) => b.id !== action.payload),
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_SEARCH':
      return { ...state, search: action.payload, currentPage: 1 };
    case 'SET_SORT':
      return { ...state, sort: action.payload, currentPage: 1 };
    case 'SET_ACTIVE_COLLECTION':
      return { ...state, activeCollection: action.payload, currentPage: 1 };
    case 'SET_FILTER_READ_LATER':
      return { ...state, filterReadLater: action.payload, currentPage: 1 };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'TOGGLE_PANEL':
      return { ...state, panelVisible: !state.panelVisible };
    case 'SET_GRID_SETTINGS':
      return { ...state, gridSettings: { ...state.gridSettings, ...action.payload } };
    case 'SET_READER_SETTINGS':
      return { ...state, readerSettings: { ...state.readerSettings, ...action.payload } };
    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.payload, currentPage: 1 };
    case 'SET_CURRENT_PAGE':
      return { ...state, currentPage: action.payload };
    case 'OPEN_MODAL':
      return { ...state, modalOpen: true, editingBook: action.payload };
    case 'CLOSE_MODAL':
      return { ...state, modalOpen: false, editingBook: null };
    case 'SET_COLLECTIONS':
      return { ...state, collections: action.payload };
    case 'ADD_COLLECTION':
      return { ...state, collections: [...state.collections, action.payload] };
    case 'REMOVE_COLLECTION':
      return { ...state, collections: state.collections.filter((c) => c.name !== action.payload) };
    case 'OPEN_SETTINGS':
      return { ...state, settingsOpen: true };
    case 'CLOSE_SETTINGS':
      return { ...state, settingsOpen: false };
    case 'OPEN_READER':
      return { ...state, readingBook: action.payload };
    case 'CLOSE_READER':
      if (state.readingBook?.fileUrl) {
        URL.revokeObjectURL(state.readingBook.fileUrl);
      }
      return { ...state, readingBook: null };
    case 'UPDATE_READING_PROGRESS': {
      const { bookId, progress } = action.payload;
      return {
        ...state,
        books: state.books.map((b) =>
          b.id === bookId ? { ...b, readingProgress: { ...b.readingProgress, ...progress, lastRead: Date.now() } } : b
        ),
      };
    }
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addBook: (book: Book) => Promise<void>;
  updateBook: (book: Book) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  toggleReadLater: (book: Book) => Promise<void>;
  addToCollection: (bookId: string, collection: string) => Promise<void>;
  removeFromCollection: (bookId: string, collection: string) => Promise<void>;
  createCollection: (name: string) => void;
  deleteCollection: (collection: string) => Promise<void>;
  renameCollection: (oldName: string, newName: string) => Promise<void>;
  mergeCollections: (source: string, target: string) => Promise<void>;
  getAllCollections: () => string[];
  saveReadingProgress: (bookId: string, progress: ReadingProgress) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const books = await getAllBooks();
        dispatch({ type: 'SET_BOOKS', payload: books });
      } catch (error) {
        console.error('Failed to load books:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    // Load preferences from localStorage
    const prefs = JSON.parse(localStorage.getItem('bookshelf_prefs') || '{}');
    if (prefs.theme) dispatch({ type: 'SET_THEME', payload: prefs.theme });
    if (prefs.panelVisible !== undefined && !prefs.panelVisible) dispatch({ type: 'TOGGLE_PANEL' });
    if (prefs.gridSettings) dispatch({ type: 'SET_GRID_SETTINGS', payload: prefs.gridSettings });
    if (prefs.readerSettings) {
      // Sanitize legacy sketch styles that have been removed
      const validSketchStyles = ['none', 'hand-drawn'];
      if (prefs.readerSettings.sketchStyle && !validSketchStyles.includes(prefs.readerSettings.sketchStyle)) {
        prefs.readerSettings.sketchStyle = 'none';
      }
      dispatch({ type: 'SET_READER_SETTINGS', payload: prefs.readerSettings });
    }
    if (prefs.pageSize) dispatch({ type: 'SET_PAGE_SIZE', payload: prefs.pageSize });
    
    // Load collections from localStorage
    const collections = JSON.parse(localStorage.getItem('bookshelf_collections') || '[]');
    if (collections.length > 0) {
      dispatch({ type: 'SET_COLLECTIONS', payload: collections });
    }

    loadData();
  }, []);

  // Save preferences
  useEffect(() => {
    const prefs = {
      theme: state.theme,
      panelVisible: state.panelVisible,
      gridSettings: state.gridSettings,
      readerSettings: state.readerSettings,
      pageSize: state.pageSize,
    };
    localStorage.setItem('bookshelf_prefs', JSON.stringify(prefs));
  }, [state.theme, state.panelVisible, state.gridSettings, state.readerSettings, state.pageSize]);

  // Save collections
  useEffect(() => {
    localStorage.setItem('bookshelf_collections', JSON.stringify(state.collections));
  }, [state.collections]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  // Apply sketch style overlay
  useEffect(() => {
    const validSketchStyles = ['none', 'hand-drawn'];
    const sketchStyle = state.readerSettings.sketchStyle || 'none';
    if (sketchStyle !== 'none' && validSketchStyles.includes(sketchStyle)) {
      document.documentElement.setAttribute('data-sketch', sketchStyle);
    } else {
      document.documentElement.removeAttribute('data-sketch');
    }
  }, [state.readerSettings.sketchStyle]);

  // Apply UI font
  useEffect(() => {
    const font = state.readerSettings.uiFont || 'system-ui';
    document.documentElement.style.setProperty('--ui-font', font);
  }, [state.readerSettings.uiFont]);

  // Apply grid size
  useEffect(() => {
    document.documentElement.style.setProperty('--shelf-card-width', `${state.gridSettings.shelfWidth}px`);
    document.documentElement.style.setProperty('--shelf-card-height', `${state.gridSettings.shelfHeight}px`);
    document.documentElement.style.setProperty('--collection-card-width', `${state.gridSettings.collectionSize}px`);
  }, [state.gridSettings]);

  const addBook = async (book: Book) => {
    await saveBook(book);
    dispatch({ type: 'ADD_BOOK', payload: book });
  };

  const updateBook = async (book: Book) => {
    await saveBook(book);
    dispatch({ type: 'UPDATE_BOOK', payload: book });
  };

  const deleteBook = async (id: string) => {
    await deleteBookFromDB(id);
    dispatch({ type: 'DELETE_BOOK', payload: id });
  };

  const toggleReadLater = async (book: Book) => {
    const updated = { ...book, readLater: !book.readLater, updatedAt: Date.now() };
    await updateBook(updated);
  };

  const addToCollection = async (bookId: string, collection: string) => {
    const book = state.books.find((b) => b.id === bookId);
    if (!book) return;
    if (book.collections.includes(collection)) return; // Already in collection
    const updated = {
      ...book,
      collections: [...book.collections, collection],
      updatedAt: Date.now(),
    };
    await saveBook(updated);
    dispatch({ type: 'UPDATE_BOOK', payload: updated });
  };

  const removeFromCollection = async (bookId: string, collection: string) => {
    const book = state.books.find((b) => b.id === bookId);
    if (!book) return;
    const updated = {
      ...book,
      collections: book.collections.filter((c) => c !== collection),
      updatedAt: Date.now(),
    };
    await updateBook(updated);
  };

  const deleteCollection = async (collection: string) => {
    for (const book of state.books) {
      if (book.collections.includes(collection)) {
        const updated = {
          ...book,
          collections: book.collections.filter((c) => c !== collection),
          updatedAt: Date.now(),
        };
        await saveBook(updated);
        dispatch({ type: 'UPDATE_BOOK', payload: updated });
      }
    }
    // Remove from standalone collections
    dispatch({ type: 'REMOVE_COLLECTION', payload: collection });
    if (state.activeCollection === collection) {
      dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: null });
    }
  };

  const createCollection = (name: string) => {
    const exists = state.collections.some((c) => c.name === name) ||
      state.books.some((b) => b.collections.includes(name));
    if (exists) return;
    dispatch({ type: 'ADD_COLLECTION', payload: { name, createdAt: Date.now() } });
  };

  const renameCollection = async (oldName: string, newName: string): Promise<void> => {
    if (oldName === newName) return;
    
    // Update all books with the old collection name
    for (const book of state.books) {
      if (book.collections.includes(oldName)) {
        const newCollections = book.collections.map((c) => c === oldName ? newName : c);
        const updated = { ...book, collections: newCollections, updatedAt: Date.now() };
        await saveBook(updated);
        dispatch({ type: 'UPDATE_BOOK', payload: updated });
      }
    }
    
    // Update standalone collection if exists
    const standaloneCol = state.collections.find((c) => c.name === oldName);
    if (standaloneCol) {
      dispatch({ type: 'REMOVE_COLLECTION', payload: oldName });
      dispatch({ type: 'ADD_COLLECTION', payload: { name: newName, createdAt: standaloneCol.createdAt } });
    }
    
    if (state.activeCollection === oldName) {
      dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: newName });
    }
  };

  const mergeCollections = async (source: string, target: string): Promise<void> => {
    for (const book of state.books) {
      if (book.collections.includes(source)) {
        const newCollections = book.collections.filter((c) => c !== source);
        if (!newCollections.includes(target)) {
          newCollections.push(target);
        }
        const updated = { ...book, collections: newCollections, updatedAt: Date.now() };
        await saveBook(updated);
        dispatch({ type: 'UPDATE_BOOK', payload: updated });
      }
    }
    // Remove source from standalone collections
    dispatch({ type: 'REMOVE_COLLECTION', payload: source });
    if (state.activeCollection === source) {
      dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: target });
    }
  };

  const getAllCollections = (): string[] => {
    const set = new Set<string>();
    // Add collections from books
    state.books.forEach((book) => {
      book.collections.forEach((c) => set.add(c));
    });
    // Add standalone collections
    state.collections.forEach((col) => set.add(col.name));
    return Array.from(set).sort();
  };

  const saveReadingProgress = async (bookId: string, progress: ReadingProgress): Promise<void> => {
    const book = state.books.find((b) => b.id === bookId);
    if (!book) return;
    
    const updatedProgress = {
      ...book.readingProgress,
      ...progress,
      lastRead: Date.now(),
    };
    
    dispatch({ type: 'UPDATE_READING_PROGRESS', payload: { bookId, progress: updatedProgress } });
    
    // Save to IndexedDB (debounced to avoid too many saves)
    const updated = { ...book, readingProgress: updatedProgress };
    await saveBook(updated);
  };

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        addBook,
        updateBook,
        deleteBook,
        toggleReadLater,
        addToCollection,
        removeFromCollection,
        createCollection,
        deleteCollection,
        renameCollection,
        mergeCollections,
        getAllCollections,
        saveReadingProgress,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
