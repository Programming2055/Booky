import { useState, useEffect, useRef, useMemo, type FormEvent } from 'react';
import { useApp } from '../../context';
import type { Book, BookFormData, BookFormat } from '../../types';
import { pickEbookFile, generateCover, detectFormat } from '../../services';
import './BookFormModal.css';

function generateId(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fileToBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

async function fetchBookInfo(query: string): Promise<Partial<BookFormData> | null> {
  const trimmed = query.trim();
  const isbnMatch = trimmed.replace(/[-\s]/g, '').match(/^(\d{10}|\d{13})$/);
  
  try {
    let url: string;
    
    if (isbnMatch) {
      url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbnMatch[0]}&format=json&jscmd=data`;
    } else {
      url = `https://openlibrary.org/search.json?title=${encodeURIComponent(trimmed)}&limit=1`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (isbnMatch) {
      const key = `ISBN:${isbnMatch[0]}`;
      if (data[key]) {
        return {
          title: data[key].title || '',
          author: data[key].authors?.[0]?.name || '',
          year: data[key].publish_date ? String(parseInt(data[key].publish_date) || '') : '',
        };
      }
    } else if (data.docs?.length > 0) {
      const doc = data.docs[0];
      return {
        title: doc.title || '',
        author: doc.author_name?.[0] || '',
        year: doc.first_publish_year ? String(doc.first_publish_year) : '',
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

export function BookFormModal() {
  const { state, dispatch, addBook, updateBook, deleteBook } = useApp();
  const dialogRef = useRef<HTMLDialogElement>(null);
  
  const [formData, setFormData] = useState<BookFormData>({
    title: '',
    author: '',
    year: '',
    language: '',
    tags: '',
    collections: '',
    readLater: false,
    notes: '',
  });
  
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileFormat, setFileFormat] = useState<BookFormat>('pdf');
  const [coverBytes, setCoverBytes] = useState<Uint8Array | null>(null);
  const [coverMime, setCoverMime] = useState<string | null>(null);
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetchStatus, setFetchStatus] = useState<{ type: 'success' | 'error' | 'loading' | null; message: string }>({ type: null, message: '' });
  const [saving, setSaving] = useState(false);
  
  const isEditing = !!state.editingBook;

  // Open/close dialog based on state
  useEffect(() => {
    if (state.modalOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [state.modalOpen]);

  // Initialize form when editing or creating
  useEffect(() => {
    if (state.editingBook) {
      setFormData({
        id: state.editingBook.id,
        title: state.editingBook.title,
        author: state.editingBook.author,
        year: state.editingBook.year?.toString() || '',
        language: state.editingBook.language,
        tags: state.editingBook.tags.join(', '),
        collections: state.editingBook.collections.join(', '),
        readLater: state.editingBook.readLater,
        notes: state.editingBook.notes,
      });
      setFileHandle(state.editingBook.fileHandle);
      setFileName(state.editingBook.fileName);
      setFileFormat(state.editingBook.format || 'pdf');
      setCoverBytes(state.editingBook.coverBytes);
      setCoverMime(state.editingBook.coverMime);
    } else {
      // Reset form and auto-add active collection for new books
      setFormData({
        title: '',
        author: '',
        year: '',
        language: '',
        tags: '',
        collections: state.activeCollection || '',
        readLater: false,
        notes: '',
      });
      setFileHandle(null);
      setFileName(null);
      setFileFormat('pdf');
      setCoverBytes(null);
      setCoverMime(null);
      setFetchUrl('');
      setFetchStatus({ type: null, message: '' });
    }
  }, [state.editingBook, state.modalOpen, state.activeCollection]);

  const handleClose = () => {
    dispatch({ type: 'CLOSE_MODAL' });
  };

  const handleFetch = async () => {
    if (!fetchUrl.trim()) return;
    
    setFetchStatus({ type: 'loading', message: 'Fetching...' });
    const info = await fetchBookInfo(fetchUrl);
    
    if (info) {
      setFormData(prev => ({ ...prev, ...info }));
      setFetchStatus({ type: 'success', message: 'Info retrieved!' });
    } else {
      setFetchStatus({ type: 'error', message: 'No results found' });
    }
  };

  const handlePickFile = async () => {
    const handle = await pickEbookFile();
    if (!handle) return;
    
    setFileHandle(handle);
    const file = await handle.getFile();
    setFileName(file.name);
    const format = detectFormat(file.name);
    setFileFormat(format);
    
    // Auto-fill title if empty
    if (!formData.title) {
      setFormData(prev => ({ ...prev, title: file.name.replace(/\.(pdf|epub|djvu|mobi)$/i, '') }));
    }
    
    // Generate cover
    setFetchStatus({ type: 'loading', message: 'Generating cover...' });
    const cover = await generateCover(handle, format);
    if (cover) {
      setCoverBytes(cover.bytes);
      setCoverMime(cover.mime);
      setFetchStatus({ type: 'success', message: 'File linked with cover!' });
    } else {
      setFetchStatus({ type: 'success', message: 'File linked (no cover generated)' });
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const bytes = await fileToBytes(file);
    setCoverBytes(bytes);
    setCoverMime(file.type || 'image/jpeg');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!fileHandle && !isEditing) {
      alert('Please link a file.');
      return;
    }
    
    setSaving(true);
    
    try {
      const now = Date.now();
      const book: Book = {
        id: formData.id || generateId(),
        title: formData.title.trim(),
        author: formData.author.trim(),
        year: formData.year ? parseInt(formData.year) : null,
        language: formData.language.trim(),
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        collections: formData.collections.split(',').map(c => c.trim()).filter(Boolean),
        readLater: formData.readLater,
        notes: formData.notes.trim(),
        coverBytes,
        coverMime,
        fileHandle: fileHandle || state.editingBook?.fileHandle || null,
        fileName: fileName || state.editingBook?.fileName || null,
        filePath: state.editingBook?.filePath || null,
        format: fileFormat || state.editingBook?.format || 'pdf',
        createdAt: state.editingBook?.createdAt || now,
        updatedAt: now,
      };
      
      if (isEditing) {
        await updateBook(book);
      } else {
        await addBook(book);
      }
      
      handleClose();
    } catch (error) {
      console.error('Failed to save book:', error);
      alert('Failed to save book. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!state.editingBook) return;
    if (!confirm('Delete this book?')) return;
    
    await deleteBook(state.editingBook.id);
    handleClose();
  };

  const coverPreviewUrl = useMemo(() => {
    if (!coverBytes) return null;
    // Handle different formats that might come from IndexedDB
    let bytes: Uint8Array;
    if (coverBytes instanceof Uint8Array) {
      bytes = coverBytes;
    } else if ((coverBytes as unknown) instanceof ArrayBuffer) {
      bytes = new Uint8Array(coverBytes as unknown as ArrayBuffer);
    } else if (typeof coverBytes === 'object') {
      bytes = new Uint8Array(Object.values(coverBytes as object));
    } else {
      return null;
    }
    const blob = new Blob([bytes as BlobPart], { type: coverMime || 'image/png' });
    return URL.createObjectURL(blob);
  }, [coverBytes, coverMime]);

  return (
    <dialog ref={dialogRef} className="modal" onClose={handleClose}>
      <form className="modal__card" onSubmit={handleSubmit}>
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{isEditing ? 'Edit Book' : 'Add Book'}</h2>
            <p className="modal__subtitle">Link PDF and manage book details</p>
          </div>
          <button type="button" className="modal__close" onClick={handleClose}>
            ✕
          </button>
        </header>

        <div className="modal__body">
          {/* Quick Add Section */}
          <div className="modal__fetch">
            <label className="modal__fetch-label">
              Quick Add: Enter ISBN, title, or pick PDF
            </label>
            <div className="modal__fetch-row">
              <input
                type="text"
                className="input"
                placeholder="ISBN or book title..."
                value={fetchUrl}
                onChange={(e) => setFetchUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFetch())}
              />
              <button type="button" className="btn btn--ghost" onClick={handleFetch}>
                Fetch
              </button>
              <button type="button" className="btn btn--primary" onClick={handlePickFile}>
                Pick File
              </button>
            </div>
            {fetchStatus.type && (
              <p className={`modal__fetch-status modal__fetch-status--${fetchStatus.type}`}>
                {fetchStatus.message}
              </p>
            )}
          </div>

          {/* Cover Image Row */}
          <div className="modal__cover-row">
            <div className="modal__cover-preview">
              {coverPreviewUrl ? (
                <img src={coverPreviewUrl} alt="Cover preview" />
              ) : (
                <span className="modal__cover-placeholder">📘</span>
              )}
            </div>
            <div className="modal__cover-info">
              <label className="form-label">Cover Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="input input--file"
              />
              <p className="form-hint">Auto-generated from file if not provided</p>
              {fileName && <div className="modal__pdf-chip">{fileName}</div>}
            </div>
          </div>

          {/* Form Fields */}
          <div className="modal__form-fields">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                type="text"
                className="input"
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Book title"
              />
              </div>

              <div className="form-group">
                <label className="form-label">Author</label>
                <input
                  type="text"
                  className="input"
                  value={formData.author}
                  onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Author name"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    max="3000"
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
                    placeholder="2024"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Language</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.language}
                    onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                    placeholder="en"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tags</label>
                <input
                  type="text"
                  className="input"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="AI, Programming, Tutorial"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Collections</label>
                <input
                  type="text"
                  className="input"
                  value={formData.collections}
                  onChange={(e) => setFormData(prev => ({ ...prev, collections: e.target.value }))}
                  placeholder="Read Later, Work, Personal"
                />
              </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="input textarea"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes..."
                rows={3}
              />
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={formData.readLater}
                onChange={(e) => setFormData(prev => ({ ...prev, readLater: e.target.checked }))}
              />
              <span>Mark as Read Later</span>
            </label>
          </div>
        </div>

        <footer className="modal__footer">
          {isEditing && (
            <button type="button" className="btn btn--danger" onClick={handleDelete}>
              Delete
            </button>
          )}
          <div className="modal__footer-spacer" />
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
