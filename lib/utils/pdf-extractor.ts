/**
 * PDF Text Extractor
 *
 * Utility to extract text and metadata from PDF files
 */

import { PDFDocument } from 'pdf-lib';

export interface PDFExtractResult {
  text: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<PDFExtractResult> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    // Extract metadata
    const title = pdfDoc.getTitle();
    const author = pdfDoc.getAuthor();
    const subject = pdfDoc.getSubject();
    const creator = pdfDoc.getCreator();
    const producer = pdfDoc.getProducer();
    const creationDate = pdfDoc.getCreationDate();
    const modificationDate = pdfDoc.getModificationDate();

    // Note: pdf-lib doesn't have native text extraction
    // We'll need to use a different approach or library for actual text extraction
    // For now, we'll return a placeholder and suggest using pdfjs-dist or pdf-parse

    const metadata = {
      title: title || undefined,
      author: author || undefined,
      subject: subject || undefined,
      creator: creator || undefined,
      producer: producer || undefined,
      creationDate: creationDate || undefined,
      modificationDate: modificationDate || undefined,
    };

    return {
      text: '', // Will be populated by backend extraction
      pageCount,
      metadata,
    };
  } catch (error) {
    console.error('Error extracting PDF:', error);
    throw new Error('Failed to extract PDF content');
  }
}

/**
 * Convert PDF file to base64 for API transmission
 */
export async function pdfToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get PDF file info without full extraction
 */
export async function getPDFInfo(pdfBuffer: ArrayBuffer): Promise<{
  pageCount: number;
  fileSize: number;
  metadata: PDFExtractResult['metadata'];
}> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();

  return {
    pageCount,
    fileSize: pdfBuffer.byteLength,
    metadata: {
      title: pdfDoc.getTitle() || undefined,
      author: pdfDoc.getAuthor() || undefined,
      subject: pdfDoc.getSubject() || undefined,
      creator: pdfDoc.getCreator() || undefined,
      producer: pdfDoc.getProducer() || undefined,
      creationDate: pdfDoc.getCreationDate() || undefined,
      modificationDate: pdfDoc.getModificationDate() || undefined,
    },
  };
}
