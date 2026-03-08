// @ts-expect-error pdf-parse types use export= incompatible with NodeNext ESM
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import logger from '../utils/logger.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface ParsedDocument {
  text: string;
  pageCount?: number;
  mimeType: string;
}

/**
 * Szöveg kinyerése mellékletből (PDF, DOCX, plaintext).
 * Max 10MB fájlméret.
 */
export async function parseDocument(
  data: Buffer,
  mimeType: string,
  filename: string,
): Promise<ParsedDocument> {
  if (data.length > MAX_FILE_SIZE) {
    throw new Error(`A fájl túl nagy (${(data.length / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB`);
  }

  // PDF
  if (mimeType === 'application/pdf') {
    return parsePdf(data, mimeType);
  }

  // DOCX
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    filename.endsWith('.docx') ||
    filename.endsWith('.doc')
  ) {
    return parseDocx(data, mimeType);
  }

  // Plaintext (text/plain, text/csv, text/html, application/json, stb.)
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return parsePlaintext(data, mimeType);
  }

  throw new Error(`Nem támogatott fájltípus: ${mimeType}`);
}

async function parsePdf(data: Buffer, mimeType: string): Promise<ParsedDocument> {
  try {
    const result = await pdfParse(data);
    return {
      text: result.text.trim(),
      pageCount: result.numpages,
      mimeType,
    };
  } catch (error) {
    logger.error('PDF feldolgozási hiba:', error);
    throw new Error('Nem sikerült feldolgozni a PDF fájlt');
  }
}

async function parseDocx(data: Buffer, mimeType: string): Promise<ParsedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer: data });
    return {
      text: result.value.trim(),
      mimeType,
    };
  } catch (error) {
    logger.error('DOCX feldolgozási hiba:', error);
    throw new Error('Nem sikerült feldolgozni a DOCX fájlt');
  }
}

function parsePlaintext(data: Buffer, mimeType: string): ParsedDocument {
  return {
    text: data.toString('utf-8').trim(),
    mimeType,
  };
}

/**
 * Ellenőrzi, hogy a melléklet elemezhető-e.
 */
export function isAnalyzable(mimeType: string, filename: string): boolean {
  if (mimeType === 'application/pdf') return true;
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    filename.endsWith('.docx') ||
    filename.endsWith('.doc')
  )
    return true;
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return true;
  return false;
}
