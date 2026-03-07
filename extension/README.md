# Booky Chrome Extension - Standalone Ebook Library

A fully standalone Chrome extension for managing your ebook library directly in the browser. No external app or server required!

## Features

- 📚 **Full Library** - Store unlimited ebooks directly in the browser
- 🔍 **Ebook Discovery** - Automatically detect ebook links on any webpage
- ➕ **Easy Import** - Add books from files or URLs
- 📖 **Built-in Reader** - Open PDFs directly, download other formats
- 🔒 **100% Offline** - All data stays in your browser
- 🗂️ **Organized** - Search, sort, and manage your collection

## Installation

### From Source (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `extension` folder
5. The Booky icon will appear in your toolbar

### Create Icons First (if missing)

```bash
cd extension/icons
python generate_icons.py
```

## Usage

### Popup (Quick Access)

Click the Booky icon in your toolbar to:
- View your book library
- Add new books
- Scan the current page for ebook links
- Search your collection

### Full Library Page

Click the grid icon in the popup header to open the full library view with:
- All your books in a grid layout
- Detailed statistics
- Full search and filtering

### Adding Books

**From File:**
1. Click "+ Add" in the popup or library
2. Select or drag & drop ebook files

**From URL:**
1. Click "+ Add" and switch to "From URL" tab
2. Paste the direct link to an ebook file

**From Web Pages:**
1. Click the scan button to find ebook links on the current page
2. Click "Add" next to any found ebook

### Right-Click Menu

Right-click on any webpage to:
- **On ebook links**: "Add to Booky Library"
- **On any page**: "Scan page for ebooks"
- **On selected text**: Search in Booky

## Supported Formats

| Format | Read in Browser | Download |
|--------|----------------|----------|
| PDF | ✅ Yes | ✅ Yes |
| EPUB | Download only | ✅ Yes |
| MOBI | Download only | ✅ Yes |
| DJVU | Download only | ✅ Yes |
| FB2 | Download only | ✅ Yes |
| AZW/AZW3 | Download only | ✅ Yes |
| CBZ/CBR | Download only | ✅ Yes |

## Storage

Books are stored in your browser's IndexedDB database. The extension uses the `unlimitedStorage` permission, so you can store as many books as your disk space allows.

**Data Location:** All data stays local in Chrome. Nothing is sent to external servers.

## File Structure

```
extension/
├── manifest.json      # Extension configuration
├── popup.html/css/js  # Toolbar popup
├── library.html       # Full library page
├── reader.html        # Book reader page
├── db.js              # IndexedDB database module
├── background.js      # Service worker
├── content.js         # Page content script
└── icons/             # Extension icons
```

## Privacy

- **No data collection** - All books stored locally
- **No external connections** - 100% offline capable
- **No tracking** - No analytics or telemetry

## Troubleshooting

### "Cannot read properties of undefined"
Refresh the extension or reload the page.

### Books not appearing
Check that the file is a supported format. Try removing and re-adding.

### Extension not working on page
Some secure pages block content scripts. Try on regular HTTP/HTTPS pages.

## Permissions Explained

| Permission | Why Needed |
|------------|-----------|
| `storage` | Save your library settings |
| `unlimitedStorage` | Store ebook files without size limits |
| `downloads` | Download books from the web |
| `activeTab` | Scan the current page for ebook links |
| `contextMenus` | Right-click menu options |
