/**
 * Booky Chrome Extension - Background Service Worker
 * Standalone ebook library manager
 */

// Ebook file extensions to detect
const EBOOK_EXTENSIONS = ['.epub', '.pdf', '.djvu', '.mobi', '.azw', '.azw3', '.fb2', '.cbz', '.cbr'];

/**
 * Create context menu items on install
 */
chrome.runtime.onInstalled.addListener(() => {
  // Context menu for ebook links
  chrome.contextMenus.create({
    id: 'addToBooky',
    title: 'Add to Booky Library',
    contexts: ['link'],
    targetUrlPatterns: EBOOK_EXTENSIONS.flatMap(ext => [
      `*://*/*${ext}`,
      `*://*/*${ext}?*`,
      `*://*/*${ext.toUpperCase()}`,
      `*://*/*${ext.toUpperCase()}?*`
    ])
  });

  // Context menu for page scanning
  chrome.contextMenus.create({
    id: 'scanPageForEbooks',
    title: 'Scan page for ebooks',
    contexts: ['page']
  });

  // Context menu for selection search
  chrome.contextMenus.create({
    id: 'searchInBooky',
    title: 'Search in Booky: "%s"',
    contexts: ['selection']
  });

  console.log('Booky extension installed - standalone mode');
});

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'addToBooky':
      // Download and add ebook to library
      try {
        const url = info.linkUrl;
        const filename = url.split('/').pop().split('?')[0] || 'ebook';
        
        // Download the file
        chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: false
        }, (downloadId) => {
          if (downloadId) {
            showNotification('Download Started', `Adding "${filename}" to library...`);
          }
        });
      } catch (error) {
        console.error('Add to library error:', error);
      }
      break;

    case 'scanPageForEbooks':
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'scanAndHighlight' });
      } catch (error) {
        console.error('Could not scan page:', error);
      }
      break;

    case 'searchInBooky':
      // Open library with search query
      const searchQuery = info.selectionText;
      chrome.tabs.create({
        url: chrome.runtime.getURL('library.html') + `?search=${encodeURIComponent(searchQuery)}`
      });
      break;
  }
});

/**
 * Show browser notification
 */
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message
  });
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadEbook') {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename || 'ebook',
      saveAs: message.saveAs || false
    }, (downloadId) => {
      sendResponse({ success: true, downloadId });
    });
    return true;
  }

  if (message.action === 'openLibrary') {
    chrome.tabs.create({ url: chrome.runtime.getURL('library.html') });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'openReader') {
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('reader.html') + `?id=${message.bookId}` 
    });
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Listen for tab updates to detect ebook pages
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;

  const url = tab.url || '';
  const isEbookUrl = EBOOK_EXTENSIONS.some(ext =>
    url.toLowerCase().includes(ext)
  );

  if (isEbookUrl) {
    chrome.action.setBadgeText({ text: '!', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#667eea', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

/**
 * Handle download completion - auto-add to library
 */
chrome.downloads.onChanged.addListener(async (delta) => {
  if (delta.state && delta.state.current === 'complete') {
    const [download] = await chrome.downloads.search({ id: delta.id });
    if (download) {
      const ext = download.filename.match(/\.[a-zA-Z0-9]+$/)?.[0]?.toLowerCase();
      if (EBOOK_EXTENSIONS.includes(ext)) {
        // Could auto-add to library here if we had access to IndexedDB
        // For now, user needs to manually add via popup
        console.log('Ebook downloaded:', download.filename);
      }
    }
  }
});
