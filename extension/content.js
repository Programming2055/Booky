/**
 * Booky Chrome Extension - Content Script
 * Scans pages for ebook links and provides highlighting
 */

// Ebook file extensions
const EBOOK_EXTENSIONS = ['.epub', '.pdf', '.djvu', '.mobi', '.azw', '.azw3', '.fb2', '.cbz', '.cbr'];

// MIME types for ebooks
const EBOOK_MIME_TYPES = [
  'application/epub+zip',
  'application/pdf',
  'application/x-mobipocket-ebook',
  'image/vnd.djvu',
  'application/x-fictionbook+xml'
];

/**
 * Scan the page for ebook links
 */
function scanForEbooks() {
  const ebooks = [];
  const seen = new Set();
  
  // Find all links
  const links = document.querySelectorAll('a[href]');
  
  links.forEach(link => {
    const href = link.href || '';
    const hrefLower = href.toLowerCase();
    
    // Check if link points to an ebook file
    const isEbook = EBOOK_EXTENSIONS.some(ext => {
      // Check URL path
      if (hrefLower.includes(ext)) return true;
      
      // Check download attribute
      const download = (link.getAttribute('download') || '').toLowerCase();
      if (download.endsWith(ext)) return true;
      
      return false;
    });
    
    if (isEbook && !seen.has(href)) {
      seen.add(href);
      
      // Extract filename
      let name = link.getAttribute('download') || '';
      if (!name) {
        try {
          const url = new URL(href);
          name = decodeURIComponent(url.pathname.split('/').pop() || '');
        } catch {
          name = href.split('/').pop() || 'Unknown';
        }
      }
      
      // Clean up name
      name = name.replace(/[?#].*$/, ''); // Remove query params
      
      ebooks.push({
        url: href,
        name: name || 'Unknown ebook',
        element: link
      });
    }
  });
  
  // Also check for download buttons without href
  const buttons = document.querySelectorAll('button[data-download], [onclick*="download"]');
  buttons.forEach(btn => {
    const dataUrl = btn.getAttribute('data-url') || btn.getAttribute('data-download');
    if (dataUrl && !seen.has(dataUrl)) {
      const isEbook = EBOOK_EXTENSIONS.some(ext => dataUrl.toLowerCase().includes(ext));
      if (isEbook) {
        seen.add(dataUrl);
        ebooks.push({
          url: dataUrl,
          name: btn.textContent.trim() || 'Download',
          element: btn
        });
      }
    }
  });
  
  return ebooks;
}

/**
 * Highlight ebook links on the page
 */
function highlightEbooks(ebooks) {
  // Remove existing highlights
  document.querySelectorAll('.booky-highlight').forEach(el => {
    el.classList.remove('booky-highlight');
    el.style.removeProperty('box-shadow');
    el.style.removeProperty('background-color');
  });
  
  // Add highlights
  ebooks.forEach(ebook => {
    if (ebook.element) {
      ebook.element.classList.add('booky-highlight');
      ebook.element.style.boxShadow = '0 0 0 3px #667eea, 0 0 10px rgba(102, 126, 234, 0.5)';
      ebook.element.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
      ebook.element.style.borderRadius = '4px';
    }
  });
  
  // Show notification
  showNotification(`Found ${ebooks.length} ebook${ebooks.length !== 1 ? 's' : ''} on this page`);
}

/**
 * Show a temporary notification on the page
 */
function showNotification(message) {
  // Remove existing notification
  const existing = document.getElementById('booky-notification');
  if (existing) existing.remove();
  
  // Create notification
  const notification = document.createElement('div');
  notification.id = 'booky-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      z-index: 999999;
      animation: bookySlideIn 0.3s ease;
      display: flex;
      align-items: center;
      gap: 10px;
    ">
      <span style="font-size: 18px;">📚</span>
      <span>${message}</span>
    </div>
    <style>
      @keyframes bookySlideIn {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    </style>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

/**
 * Listen for messages from popup/background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scanForEbooks') {
    const ebooks = scanForEbooks();
    // Return without element references (can't be serialized)
    sendResponse({
      ebooks: ebooks.map(e => ({ url: e.url, name: e.name }))
    });
    return true;
  }
  
  if (message.action === 'scanAndHighlight') {
    const ebooks = scanForEbooks();
    highlightEbooks(ebooks);
    sendResponse({ count: ebooks.length });
    return true;
  }
  
  if (message.action === 'clearHighlights') {
    document.querySelectorAll('.booky-highlight').forEach(el => {
      el.classList.remove('booky-highlight');
      el.style.removeProperty('box-shadow');
      el.style.removeProperty('background-color');
    });
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Auto-detect ebooks on page load if enabled
 */
async function autoDetect() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (response && response.autoDetect) {
      const ebooks = scanForEbooks();
      if (ebooks.length > 0) {
        // Notify background script
        chrome.runtime.sendMessage({
          action: 'ebooksDetected',
          count: ebooks.length,
          url: window.location.href
        });
      }
    }
  } catch (error) {
    // Extension context may not be available
  }
}

// Run auto-detect after page loads
if (document.readyState === 'complete') {
  autoDetect();
} else {
  window.addEventListener('load', autoDetect);
}
