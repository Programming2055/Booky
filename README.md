# Bookshelf React

A React-based ebook library manager with support for multiple ebook formats.

## Features

- **Multi-format support**: PDF, EPUB, MOBI, FB2, CBZ, AZW3, DJVU
- **Cover generation**: Automatic cover extraction from PDFs
- **Collections**: Organize books into custom collections
- **Built-in reader**: Read EPUB, MOBI, FB2, CBZ directly in the browser (powered by foliate-js)
- **System app integration**: Open DJVU/PDF with your system's default apps via Python server

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.8+ (optional, for DJVU and PDF "System App" mode)
- Flask (`pip install flask flask-cors`)

### Installation

```bash
npm install
pip install flask flask-cors  # optional, for system app integration
```

### Running the App

**Option 1: One command (recommended)**
```bash
npm start
```
Or double-click `start.bat` (Windows)

This starts both the React dev server and Python server together.

**Option 2: Separate terminals**
```bash
# Terminal 1 - React app
npm run dev

# Terminal 2 - Python server (optional)
python server/ebook_server.py
```

## Reader Support

| Format | Reader |
|--------|--------|
| PDF    | Browser tab or System app |
| EPUB   | Built-in reader (foliate-js) |
| MOBI   | Built-in reader (foliate-js) |
| FB2    | Built-in reader (foliate-js) |
| CBZ    | Built-in reader (foliate-js) |
| AZW3   | Built-in reader (foliate-js) |
| DJVU   | System app (via Python server) |

## PDF Tools (Stirling-PDF Integration)

The app includes integration with [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) for advanced PDF manipulation features:

- **Compress** - Reduce PDF file size
- **Rotate** - Rotate pages 90°, 180°, 270°
- **Extract Pages** - Extract specific pages from PDF
- **OCR** - Make scanned PDFs searchable
- **Add Watermark** - Add text watermark to pages
- **Add Page Numbers** - Number all pages
- **Remove Blank Pages** - Clean up documents
- **Repair PDF** - Fix corrupted PDFs
- **Flatten** - Remove interactive elements
- **Convert to Images** - Export pages as PNG/JPEG

### Setup Stirling-PDF

**Using Docker (recommended):**
```bash
docker run -d -p 8080:8080 --name stirling-pdf frooodle/s-pdf:latest
```

**Using Docker Compose:**
```yaml
services:
  stirling-pdf:
    image: frooodle/s-pdf:latest
    ports:
      - "8080:8080"
    restart: unless-stopped
```

Once running, click the **🔧 Tools** button in the PDF reader to access all manipulation features.

> **Note:** Stirling-PDF runs as a separate service. If it's not running, the Tools panel will show instructions to start it.

---

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
