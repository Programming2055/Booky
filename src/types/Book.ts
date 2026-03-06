export type BookFormat = 'pdf' | 'epub' | 'djvu' | 'mobi' | 'fb2' | 'cbz' | 'azw3' | 'azw';

// Reading progress for different formats
export interface ReadingProgress {
  // For page-based formats (PDF, DJVU)
  currentPage?: number;
  totalPages?: number;
  // For EPUB/MOBI (CFI-based location)
  cfi?: string;
  // For all formats
  percentage?: number;
  lastRead?: number; // timestamp
}

// PDF Annotations
export interface PdfAnnotation {
  id: string;
  page: number;
  type: 'highlight' | 'comment' | 'underline';
  color?: string;
  text?: string; // The highlighted/annotated text
  comment?: string; // User's comment
  rects?: { x: number; y: number; width: number; height: number }[];
  createdAt: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number | null;
  language: string;
  tags: string[];
  collections: string[];
  readLater: boolean;
  notes: string;
  coverBytes: Uint8Array | null;
  coverMime: string | null;
  fileHandle: FileSystemFileHandle | null;
  fileName: string | null;
  filePath: string | null; // Absolute file path for system app opening
  format: BookFormat;
  createdAt: number;
  updatedAt: number;
  // Reading progress
  readingProgress?: ReadingProgress;
  // PDF annotations
  annotations?: PdfAnnotation[];
}

export interface BookFormData {
  id?: string;
  title: string;
  author: string;
  year: string;
  language: string;
  tags: string;
  collections: string;
  readLater: boolean;
  notes: string;
}

export type SortOption = 
  | 'updated_desc' 
  | 'title_asc' 
  | 'author_asc' 
  | 'year_desc' 
  | 'year_asc'
  | 'custom';

export type Theme = 
  | 'light' 
  | 'dark' 
  | 'midnight'
  | 'ocean' 
  | 'forest' 
  | 'sunset' 
  | 'royal' 
  | 'rosegold'
  | 'slate'
  | 'coffee'
  | 'nord';

export type SketchStyle = 'none' | 'hand-drawn';

export type BookViewMode = 'grid' | 'list' | 'bookshelf';

export interface GridSettings {
  shelfWidth: number;
  shelfHeight: number;
  shelfPerRow: number;
  collectionSize: number;
  collectionPerRow: number;
  viewMode: BookViewMode;
}

export interface Collection {
  name: string;
  createdAt: number;
}

export type PdfReaderMode = 'browser' | 'system' | 'builtin';

export interface PdfReaderSettings {
  zoom: number;
  sidebarVisible: boolean;
  highlightColor: string;
}

export interface ReaderSettings {
  pdf: PdfReaderMode;
  libraryPath: string; // Folder where ebooks are stored, for system app opening
  pdfViewer: PdfReaderSettings;
  uiFont: string;
  sketchStyle: SketchStyle;
}

export interface ReadingBook {
  book: Book;
  fileUrl: string;
}
