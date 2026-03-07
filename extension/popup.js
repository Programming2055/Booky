/**
 * Booky Chrome Extension - Standalone Popup Script
 * Full ebook library management in the browser
 */

// Ebook file extensions
const EBOOK_EXTENSIONS = ['.epub', '.pdf', '.djvu', '.mobi', '.azw', '.azw3', '.fb2', '.cbz', '.cbr'];

// DOM Elements
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// State
let currentBooks = [];
let selectedBook = null;

/**
 * Initialize the popup
 */
async function init() {
  await loadLibrary();
  setupEventListeners();
}

/**
 * Load and display the library
 */
async function loadLibrary() {
  try {
    currentBooks = await BookyDB.getAllBooks();
    renderBooks(currentBooks);
    updateStats();
  } catch (error) {
    console.error('Failed to load library:', error);
    showToast('Failed to load library', 'error');
  }
}

/**
 * Render books grid
 */
function renderBooks(books) {
  const grid = $('#booksGrid');
  const emptyState = $('#emptyState');

  if (books.length === 0) {
    grid.innerHTML = '';
    grid.appendChild(createEmptyState());
    return;
  }

  grid.innerHTML = books.map(book => `
    <div class="book-card" data-id="${book.id}" title="${book.title}">
      <div class="book-cover">
        ${book.cover ? `<img src="${book.cover}" alt="">` : book.type.toUpperCase()}
      </div>
      <div class="book-info">
        <div class="book-title">${escapeHtml(book.title)}</div>
        <div class="book-author">${escapeHtml(book.author)}</div>
      </div>
    </div>
  `).join('');

  // Add click handlers
  $$('.book-card').forEach(card => {
    card.addEventListener('click', (e) => openBook(card.dataset.id));
    card.addEventListener('contextmenu', (e) => showContextMenu(e, card.dataset.id));
  });
}

/**
 * Create empty state element
 */
function createEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.id = 'emptyState';
  div.innerHTML = `
    <div class="empty-icon">📚</div>
    <p>No books yet</p>
    <button class="btn btn-primary" id="addFirstBook">Add your first book</button>
  `;
  div.querySelector('#addFirstBook').addEventListener('click', showAddModal);
  return div;
}

/**
 * Update stats display
 */
async function updateStats() {
  const stats = await BookyDB.getStats();
  $('#bookCount').textContent = stats.totalBooks;
  $('#bookSize').textContent = (stats.totalSize / (1024 * 1024)).toFixed(1);
}

/**
 * Open a book
 */
async function openBook(bookId) {
  const book = await BookyDB.getBook(bookId);
  if (!book) return;

  // Update last read
  await BookyDB.updateBook(bookId, { lastRead: Date.now() });

  // Get the file blob
  const blob = await BookyDB.getBookFile(bookId);
  if (!blob) {
    showToast('Book file not found', 'error');
    return;
  }

  // Create object URL and open in new tab
  const url = URL.createObjectURL(blob);
  
  if (book.type === 'pdf') {
    // Open PDF directly in browser
    chrome.tabs.create({ url });
  } else if (book.type === 'epub') {
    // Open EPUB in reader
    const readerUrl = chrome.runtime.getURL('reader.html') + `?id=${bookId}`;
    chrome.tabs.create({ url: readerUrl });
  } else {
    // Download other formats
    chrome.downloads.download({
      url,
      filename: `${book.title}.${book.type}`,
      saveAs: false
    });
    showToast('Opening in system viewer...', 'success');
  }
}

/**
 * Show context menu
 */
function showContextMenu(e, bookId) {
  e.preventDefault();
  selectedBook = bookId;

  const menu = $('#contextMenu');
  menu.style.display = 'block';
  menu.style.left = `${Math.min(e.clientX, 380 - 150)}px`;
  menu.style.top = `${Math.min(e.clientY, 500 - 120)}px`;
}

/**
 * Hide context menu
 */
function hideContextMenu() {
  $('#contextMenu').style.display = 'none';
  selectedBook = null;
}

/**
 * Handle context menu action
 */
async function handleContextAction(action) {
  if (!selectedBook) return;

  const book = await BookyDB.getBook(selectedBook);
  if (!book) return;

  switch (action) {
    case 'read':
      openBook(selectedBook);
      break;

    case 'download':
      const blob = await BookyDB.getBookFile(selectedBook);
      if (blob) {
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
          url,
          filename: `${book.title}.${book.type}`,
          saveAs: true
        });
      }
      break;

    case 'delete':
      if (confirm(`Delete "${book.title}"?`)) {
        await BookyDB.deleteBook(selectedBook);
        await loadLibrary();
        showToast('Book deleted', 'success');
      }
      break;
  }

  hideContextMenu();
}

/**
 * Show add book modal
 */
function showAddModal() {
  $('#addModal').style.display = 'flex';
}

/**
 * Hide add book modal
 */
function hideAddModal() {
  $('#addModal').style.display = 'none';
  $('#fileInput').value = '';
  $('#urlInput').value = '';
}

/**
 * Handle file selection
 */
async function handleFileSelect(file) {
  if (!file) return;

  const ext = getExtension(file.name);
  if (!EBOOK_EXTENSIONS.includes(ext)) {
    showToast('Unsupported file format', 'error');
    return;
  }

  showToast('Adding book...', 'loading');

  try {
    const book = await BookyDB.addBook({
      title: file.name.replace(/\.[^.]+$/, ''),
      author: 'Unknown',
      type: ext.replace('.', ''),
      sourceUrl: null
    }, file);

    await loadLibrary();
    hideAddModal();
    showToast('Book added!', 'success');
  } catch (error) {
    console.error('Add book error:', error);
    showToast('Failed to add book', 'error');
  }
}

/**
 * Handle URL fetch
 */
async function handleUrlFetch() {
  const url = $('#urlInput').value.trim();
  if (!url) return;

  const ext = getExtension(url);
  if (!EBOOK_EXTENSIONS.some(e => url.toLowerCase().includes(e))) {
    showToast('URL does not appear to be an ebook', 'error');
    return;
  }

  showToast('Downloading...', 'loading');

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const filename = url.split('/').pop().split('?')[0] || 'book';

    const book = await BookyDB.addBook({
      title: filename.replace(/\.[^.]+$/, ''),
      author: 'Unknown',
      type: ext.replace('.', '') || 'unknown',
      sourceUrl: url
    }, blob);

    await loadLibrary();
    hideAddModal();
    showToast('Book added!', 'success');
  } catch (error) {
    console.error('Fetch error:', error);
    showToast('Failed to download book', 'error');
  }
}

/**
 * Scan current page for ebooks
 */
async function scanPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.tabs.sendMessage(tab.id, { action: 'scanForEbooks' });

    if (results && results.ebooks && results.ebooks.length > 0) {
      displayFoundEbooks(results.ebooks);
    } else {
      showToast('No ebooks found on this page', 'info');
    }
  } catch (error) {
    showToast('Could not scan page', 'error');
  }
}

/**
 * Display found ebooks
 */
function displayFoundEbooks(ebooks) {
  const section = $('#foundSection');
  const list = $('#foundList');

  section.style.display = 'block';
  list.innerHTML = ebooks.slice(0, 5).map((ebook, i) => {
    const ext = getExtension(ebook.url).replace('.', '').toUpperCase() || 'FILE';
    return `
      <div class="found-item">
        <span class="type-badge">${ext}</span>
        <span class="name" title="${ebook.name}">${ebook.name}</span>
        <button class="btn-add" data-index="${i}">Add</button>
      </div>
    `;
  }).join('');

  // Add click handlers
  list.querySelectorAll('.btn-add').forEach((btn, i) => {
    btn.addEventListener('click', () => addFromUrl(ebooks[i].url, ebooks[i].name));
  });
}

/**
 * Add book from URL
 */
async function addFromUrl(url, name) {
  showToast('Downloading...', 'loading');

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const ext = getExtension(url);

    await BookyDB.addBook({
      title: name.replace(/\.[^.]+$/, ''),
      author: 'Unknown',
      type: ext.replace('.', '') || 'unknown',
      sourceUrl: url
    }, blob);

    await loadLibrary();
    showToast('Book added!', 'success');
  } catch (error) {
    showToast('Failed to add book', 'error');
  }
}

/**
 * Search books
 */
async function searchBooks(query) {
  if (!query) {
    renderBooks(currentBooks);
    return;
  }

  const results = await BookyDB.searchBooks(query);
  renderBooks(results);
}

/**
 * Open full library page
 */
function openLibrary() {
  chrome.tabs.create({ url: chrome.runtime.getURL('library.html') });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Header buttons
  $('#scanPage').addEventListener('click', scanPage);
  $('#openLibrary').addEventListener('click', openLibrary);

  // Search
  $('#searchInput').addEventListener('input', (e) => searchBooks(e.target.value));

  // Add book buttons
  $('#addBook').addEventListener('click', showAddModal);
  
  // Modal
  $('#closeModal').addEventListener('click', hideAddModal);
  $('#addModal').addEventListener('click', (e) => {
    if (e.target.id === 'addModal') hideAddModal();
  });

  // Tabs
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      $$('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $(`#tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // File input
  const fileInput = $('#fileInput');
  const fileDrop = $('#fileDrop');

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
  });

  fileDrop.addEventListener('click', () => fileInput.click());
  fileDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDrop.classList.add('dragover');
  });
  fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
  fileDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDrop.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  });

  // URL fetch
  $('#fetchUrl').addEventListener('click', handleUrlFetch);

  // Context menu
  $$('.context-item').forEach(item => {
    item.addEventListener('click', () => handleContextAction(item.dataset.action));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) hideContextMenu();
  });

  // Found section
  $('#hideFound')?.addEventListener('click', () => {
    $('#foundSection').style.display = 'none';
  });
}

/**
 * Utility: Get file extension
 */
function getExtension(str) {
  const match = str.match(/\.[a-zA-Z0-9]+(?:\?|$|#)/);
  return match ? match[0].replace(/[?#]/, '').toLowerCase() : '';
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Utility: Show toast
 */
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  if (type !== 'loading') {
    setTimeout(() => toast.remove(), 3000);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', init);
