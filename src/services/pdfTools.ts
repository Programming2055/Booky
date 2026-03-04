/**
 * Client-side PDF manipulation using pdf-lib
 * No server required - runs entirely in browser
 */

import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

/**
 * Load PDF from URL or File
 */
export async function loadPdf(source: string | File | Blob): Promise<PDFDocument> {
  let arrayBuffer: ArrayBuffer;
  
  if (typeof source === 'string') {
    const response = await fetch(source);
    arrayBuffer = await response.arrayBuffer();
  } else {
    arrayBuffer = await source.arrayBuffer();
  }
  
  return PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
}

/**
 * Rotate all pages in PDF
 */
export async function rotatePdf(
  source: string | File | Blob,
  angle: 90 | 180 | 270
): Promise<Uint8Array> {
  const pdfDoc = await loadPdf(source);
  const pages = pdfDoc.getPages();
  
  for (const page of pages) {
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees(currentRotation + angle));
  }
  
  return pdfDoc.save();
}

/**
 * Rotate specific pages
 */
export async function rotatePages(
  source: string | File | Blob,
  pageNumbers: number[],
  angle: 90 | 180 | 270
): Promise<Uint8Array> {
  const pdfDoc = await loadPdf(source);
  const pages = pdfDoc.getPages();
  
  for (const pageNum of pageNumbers) {
    if (pageNum >= 1 && pageNum <= pages.length) {
      const page = pages[pageNum - 1];
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(currentRotation + angle));
    }
  }
  
  return pdfDoc.save();
}

/**
 * Add page numbers to PDF
 */
export async function addPageNumbers(
  source: string | File | Blob,
  options: {
    position?: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right';
    fontSize?: number;
    startNumber?: number;
    format?: string; // e.g., "Page {n} of {total}" or just "{n}"
    margin?: number;
  } = {}
): Promise<Uint8Array> {
  const {
    position = 'bottom-center',
    fontSize = 12,
    startNumber = 1,
    format = '{n}',
    margin = 30,
  } = options;

  const pdfDoc = await loadPdf(source);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const pageNum = startNumber + i;
    
    // Format the page number text
    const text = format
      .replace('{n}', pageNum.toString())
      .replace('{total}', totalPages.toString());
    
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    
    // Calculate position
    let x: number;
    let y: number;
    
    const isTop = position.startsWith('top');
    const isLeft = position.endsWith('left');
    const isRight = position.endsWith('right');
    
    if (isLeft) {
      x = margin;
    } else if (isRight) {
      x = width - textWidth - margin;
    } else {
      x = (width - textWidth) / 2;
    }
    
    y = isTop ? height - margin : margin;
    
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  
  return pdfDoc.save();
}

/**
 * Extract specific pages from PDF
 */
export async function extractPages(
  source: string | File | Blob,
  pageNumbers: number[]
): Promise<Uint8Array> {
  const srcDoc = await loadPdf(source);
  const newDoc = await PDFDocument.create();
  
  // Convert to zero-indexed and filter valid pages
  const validIndices = pageNumbers
    .map(n => n - 1)
    .filter(i => i >= 0 && i < srcDoc.getPageCount());
  
  const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
  
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }
  
  return newDoc.save();
}

/**
 * Merge multiple PDFs
 */
export async function mergePdfs(
  sources: (string | File | Blob)[]
): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();
  
  for (const source of sources) {
    const srcDoc = await loadPdf(source);
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    
    for (const page of copiedPages) {
      mergedDoc.addPage(page);
    }
  }
  
  return mergedDoc.save();
}

/**
 * Add text watermark to PDF
 */
export async function addWatermark(
  source: string | File | Blob,
  options: {
    text: string;
    fontSize?: number;
    opacity?: number;
    rotation?: number;
    color?: { r: number; g: number; b: number };
  }
): Promise<Uint8Array> {
  const {
    text,
    fontSize = 60,
    opacity = 0.2,
    rotation = 45,
    color = { r: 0.5, g: 0.5, b: 0.5 },
  } = options;

  const pdfDoc = await loadPdf(source);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    
    // Center the watermark
    const x = (width - textWidth) / 2;
    const y = height / 2;
    
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity,
      rotate: degrees(rotation),
    });
  }
  
  return pdfDoc.save();
}

/**
 * Get PDF info
 */
export async function getPdfInfo(source: string | File | Blob): Promise<{
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}> {
  const pdfDoc = await loadPdf(source);
  
  return {
    pageCount: pdfDoc.getPageCount(),
    title: pdfDoc.getTitle(),
    author: pdfDoc.getAuthor(),
    subject: pdfDoc.getSubject(),
    creator: pdfDoc.getCreator(),
    producer: pdfDoc.getProducer(),
    creationDate: pdfDoc.getCreationDate(),
    modificationDate: pdfDoc.getModificationDate(),
  };
}

/**
 * Delete specific pages from PDF
 */
export async function deletePages(
  source: string | File | Blob,
  pageNumbers: number[]
): Promise<Uint8Array> {
  const pdfDoc = await loadPdf(source);
  
  // Sort in descending order to remove from end first
  const sortedPages = [...new Set(pageNumbers)].sort((a, b) => b - a);
  
  for (const pageNum of sortedPages) {
    const index = pageNum - 1;
    if (index >= 0 && index < pdfDoc.getPageCount()) {
      pdfDoc.removePage(index);
    }
  }
  
  return pdfDoc.save();
}

/**
 * Download helper - saves Uint8Array as file
 */
export function downloadPdfFile(data: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert Uint8Array to Blob URL for viewing
 */
export function pdfToUrl(data: Uint8Array): string {
  const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}
