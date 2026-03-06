import type { BookFormat, PdfReaderMode } from '../types';

// Python ebook server configuration
const PYTHON_SERVER_URL = 'http://127.0.0.1:5050';

// Type for global libraries
declare global {
  interface Window {
    pdfjsLib: any;
    ePub: any;
  }
}

// Verify file handle permission, request if needed
export async function verifyFilePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'read'
): Promise<boolean> {
  const options = { mode };
  
  // Check current permission
  if ((await (handle as any).queryPermission(options)) === 'granted') {
    return true;
  }
  
  // Request permission
  if ((await (handle as any).requestPermission(options)) === 'granted') {
    return true;
  }
  
  return false;
}

// File format detection
export function detectFormat(fileName: string): BookFormat {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'epub': return 'epub';
    case 'djvu': return 'djvu';
    case 'mobi': return 'mobi';
    case 'fb2': return 'fb2';
    case 'cbz': return 'cbz';
    case 'azw3':
    case 'azw': return 'azw3';
    case 'pdf':
    default: return 'pdf';
  }
}

// Get supported file types for file picker
export function getSupportedFileTypes() {
  return [
    {
      description: 'eBooks',
      accept: {
        'application/pdf': ['.pdf'],
        'application/epub+zip': ['.epub'],
        'image/vnd.djvu': ['.djvu'],
        'application/x-mobipocket-ebook': ['.mobi', '.azw', '.azw3'],
        'application/x-fictionbook+xml': ['.fb2'],
        'application/vnd.comicbook+zip': ['.cbz'],
      },
    },
  ];
}

// Pick multiple ebook files
export async function pickEbookFiles(): Promise<FileSystemFileHandle[]> {
  if (!('showOpenFilePicker' in window)) {
    alert('This feature requires Chrome or Edge browser with File System Access API.');
    return [];
  }

  try {
    const handles = await (window as any).showOpenFilePicker({
      multiple: true,
      types: getSupportedFileTypes(),
    });
    return handles;
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      console.error('Failed to pick files:', e);
    }
    return [];
  }
}

// Pick single ebook file
export async function pickEbookFile(): Promise<FileSystemFileHandle | null> {
  if (!('showOpenFilePicker' in window)) {
    alert('This feature requires Chrome or Edge browser with File System Access API.');
    return null;
  }

  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: getSupportedFileTypes(),
    });
    return handle;
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      console.error('Failed to pick file:', e);
    }
    return null;
  }
}

// Generate cover from ebook
export async function generateCover(
  handle: FileSystemFileHandle,
  format: BookFormat
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const file = await handle.getFile();
    
    switch (format) {
      case 'pdf':
        return generatePDFCover(file);
      case 'epub':
        return generateEPUBCover(file);
      case 'djvu':
        return generateDJVUCover(file);
      case 'mobi':
        return generateMOBICover(file);
      default:
        return null;
    }
  } catch (e) {
    console.error('Failed to generate cover:', e);
    return null;
  }
}

// PDF cover generation
async function generatePDFCover(
  file: File
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!window.pdfjsLib) {
    console.warn('PDF.js not loaded');
    return null;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    return canvasToPNG(canvas);
  } catch (e) {
    console.error('Failed to generate PDF cover:', e);
    return null;
  }
}

// EPUB cover extraction
async function generateEPUBCover(
  file: File
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  // Try to extract cover from EPUB metadata
  try {
    const arrayBuffer = await file.arrayBuffer();
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Try common cover locations
    const coverPaths = [
      'cover.jpeg', 'cover.jpg', 'cover.png',
      'OEBPS/cover.jpeg', 'OEBPS/cover.jpg', 'OEBPS/cover.png',
      'OEBPS/images/cover.jpeg', 'OEBPS/images/cover.jpg', 'OEBPS/images/cover.png',
      'OPS/cover.jpeg', 'OPS/cover.jpg', 'OPS/cover.png',
      'images/cover.jpeg', 'images/cover.jpg', 'images/cover.png',
    ];
    
    // Also check content.opf for cover reference
    const opfFiles = Object.keys(zip.files).filter(f => f.endsWith('.opf'));
    if (opfFiles.length > 0) {
      const opfContent = await zip.file(opfFiles[0])?.async('text');
      if (opfContent) {
        // Parse OPF to find cover item
        const coverMatch = opfContent.match(/content="([^"]+)" name="cover"/i) ||
                          opfContent.match(/name="cover" content="([^"]+)"/i);
        if (coverMatch) {
          const coverId = coverMatch[1];
          const hrefMatch = opfContent.match(new RegExp(`id="${coverId}"[^>]*href="([^"]+)"`, 'i'));
          if (hrefMatch) {
            const basePath = opfFiles[0].substring(0, opfFiles[0].lastIndexOf('/') + 1);
            coverPaths.unshift(basePath + hrefMatch[1]);
          }
        }
        // Also look for cover-image property
        const coverImageMatch = opfContent.match(/properties="cover-image"[^>]*href="([^"]+)"/i) ||
                               opfContent.match(/href="([^"]+)"[^>]*properties="cover-image"/i);
        if (coverImageMatch) {
          const basePath = opfFiles[0].substring(0, opfFiles[0].lastIndexOf('/') + 1);
          coverPaths.unshift(basePath + coverImageMatch[1]);
        }
      }
    }
    
    // Try each potential cover location
    for (const path of coverPaths) {
      const file = zip.file(path) || zip.file(path.toLowerCase());
      if (file) {
        const bytes = await file.async('uint8array');
        const mime = path.endsWith('.png') ? 'image/png' : 'image/jpeg';
        return { bytes, mime };
      }
    }
    
    // If no cover found, look for any image in the archive
    const imageFiles = Object.keys(zip.files).filter(f => 
      /\.(jpg|jpeg|png)$/i.test(f) && !f.includes('__MACOSX')
    );
    if (imageFiles.length > 0) {
      // Sort to prefer files with "cover" in name
      imageFiles.sort((a, b) => {
        const aIsCover = a.toLowerCase().includes('cover') ? 0 : 1;
        const bIsCover = b.toLowerCase().includes('cover') ? 0 : 1;
        return aIsCover - bIsCover;
      });
      const file = zip.file(imageFiles[0]);
      if (file) {
        const bytes = await file.async('uint8array');
        const mime = imageFiles[0].endsWith('.png') ? 'image/png' : 'image/jpeg';
        return { bytes, mime };
      }
    }
    
    return null;
  } catch (e) {
    console.error('Failed to extract EPUB cover:', e);
    return null;
  }
}

// DJVU cover - render first page
async function generateDJVUCover(
  _file: File
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  // DJVU requires djvu.js library - for now return null
  // Future: implement using djvu.js
  console.warn('DJVU cover generation not yet implemented');
  return null;
}

// MOBI cover extraction
async function generateMOBICover(
  _file: File
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  // MOBI cover extraction is complex - for now return null
  // MOBI files store covers in a binary format within the file
  console.warn('MOBI cover generation not yet implemented');
  return null;
}

// Helper to convert canvas to PNG bytes
function canvasToPNG(canvas: HTMLCanvasElement): Promise<{ bytes: Uint8Array; mime: string } | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const buffer = await blob.arrayBuffer();
        resolve({ bytes: new Uint8Array(buffer), mime: 'image/png' });
      },
      'image/png',
      0.9
    );
  });
}

// Open PDF file
export async function openPdf(
  handle: FileSystemFileHandle,
  mode: PdfReaderMode = 'browser'
): Promise<void> {
  try {
    const file = await handle.getFile();
    const url = URL.createObjectURL(file);
    
    if (mode === 'system') {
      // Download the file so user can open with their default PDF app
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      // Open in browser tab
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (_e) {
    alert('Could not open file. It may have been moved or deleted.');
  }
}

// Check if Python ebook server is running
export async function isPythonServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_SERVER_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Open file using Python server (for DJVU, MOBI, and PDF system mode)
export async function openWithPythonServer(filePath: string): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_SERVER_URL}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });
    
    if (response.ok) {
      return true;
    }
    
    const data = await response.json();
    console.error('Python server error:', data.error);
    return false;
  } catch (e) {
    console.error('Failed to connect to Python server:', e);
    return false;
  }
}

// Send file data to Python server which saves temp file and opens with system app
export async function openFileViaPythonServer(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    const file = await handle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    
    // Convert to base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    const response = await fetch(`${PYTHON_SERVER_URL}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: base64, filename: file.name }),
    });
    
    if (response.ok) {
      return true;
    }
    
    const data = await response.json();
    console.error('Python server error:', data.error);
    return false;
  } catch (e) {
    console.error('Failed to send file to Python server:', e);
    return false;
  }
}

// Download file (fallback when Python server is not available)
export async function downloadFile(handle: FileSystemFileHandle): Promise<void> {
  try {
    const file = await handle.getFile();
    const url = URL.createObjectURL(file);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (_e) {
    alert('Could not download file. It may have been moved or deleted.');
  }
}
