declare const pdfjsLib: any;

export async function pickPDFFile(): Promise<FileSystemFileHandle | null> {
  if (!('showOpenFilePicker' in window)) {
    alert('This feature requires Chrome or Edge browser with File System Access API.');
    return null;
  }

  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{
        description: 'PDF Files',
        accept: { 'application/pdf': ['.pdf'] }
      }]
    });
    return handle;
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      console.error('Failed to pick PDF:', e);
    }
    return null;
  }
}

export async function pickMultiplePDFs(): Promise<FileSystemFileHandle[]> {
  if (!('showOpenFilePicker' in window)) {
    alert('This feature requires Chrome or Edge browser with File System Access API.');
    return [];
  }

  try {
    const handles = await (window as any).showOpenFilePicker({
      multiple: true,
      types: [{
        description: 'PDF Files',
        accept: { 'application/pdf': ['.pdf'] }
      }]
    });
    return handles;
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      console.error('Failed to pick PDFs:', e);
    }
    return [];
  }
}

export async function openPDFFromHandle(handle: FileSystemFileHandle): Promise<void> {
  try {
    const file = await handle.getFile();
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) {
    alert('Could not open PDF. The file may have been moved or permission was revoked.');
  }
}

export async function generateCoverFromPDF(
  handle: FileSystemFileHandle
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!window.pdfjsLib) {
    console.warn('PDF.js not loaded');
    return null;
  }

  try {
    const file = await handle.getFile();
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
  } catch (e) {
    console.error('Failed to generate cover:', e);
    return null;
  }
}

export async function generateCoverFromFile(
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
  } catch (e) {
    console.error('Failed to generate cover:', e);
    return null;
  }
}

// Extend window for pdfjsLib
declare global {
  interface Window {
    pdfjsLib: any;
  }
}
