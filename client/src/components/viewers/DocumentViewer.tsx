import { useState, useEffect } from 'react';
import { X, Download, Loader2, AlertCircle } from 'lucide-react';
import * as mammoth from 'mammoth';
import DOMPurify from 'dompurify';

interface DocumentViewerProps {
  url: string;
  filename: string;
  mimeType: string;
  onClose: () => void;
}

export function DocumentViewer({ url, filename, mimeType, onClose }: DocumentViewerProps) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Nem sikerült letölteni a fájlt');
        }

        const arrayBuffer = await response.arrayBuffer();

        // DOCX formátum - mammoth.js-sel
        if (mimeType.includes('wordprocessingml') || filename.endsWith('.docx')) {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          // Sanitize mammoth output to prevent XSS
          const sanitized = DOMPurify.sanitize(result.value, {
            ALLOWED_TAGS: [
              'p',
              'br',
              'strong',
              'em',
              'b',
              'i',
              'u',
              'a',
              'ul',
              'ol',
              'li',
              'h1',
              'h2',
              'h3',
              'h4',
              'h5',
              'h6',
              'blockquote',
              'pre',
              'code',
              'table',
              'thead',
              'tbody',
              'tr',
              'th',
              'td',
              'div',
              'span',
              'img',
            ],
            ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height'],
          });
          setContent(sanitized);
        }
        // DOC formátum - próbáljuk mammoth-tal (nem garantált)
        else if (mimeType.includes('msword') || filename.endsWith('.doc')) {
          try {
            const result = await mammoth.convertToHtml({ arrayBuffer });
            // Sanitize mammoth output to prevent XSS
            const sanitized = DOMPurify.sanitize(result.value, {
              ALLOWED_TAGS: [
                'p',
                'br',
                'strong',
                'em',
                'b',
                'i',
                'u',
                'a',
                'ul',
                'ol',
                'li',
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'blockquote',
                'pre',
                'code',
                'table',
                'thead',
                'tbody',
                'tr',
                'th',
                'td',
                'div',
                'span',
                'img',
              ],
              ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height'],
            });
            setContent(sanitized);
          } catch {
            throw new Error(
              'A régi .doc formátum nem támogatott. Kérjük, konvertálja .docx formátumba.',
            );
          }
        }
        // ODT formátum - egyszerű szöveg kinyerés (korlátozott támogatás)
        else if (mimeType.includes('opendocument.text') || filename.endsWith('.odt')) {
          // ODT is basically a ZIP with content.xml inside
          // For now, show a message that it's not fully supported
          throw new Error(
            'Az ODT formátum előnézete jelenleg nem támogatott. Kérjük, töltse le a fájlt.',
          );
        } else {
          throw new Error('Nem támogatott dokumentum formátum');
        }
      } catch (err) {
        console.error('Dokumentum betöltési hiba:', err);
        setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt');
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [url, mimeType, filename]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between bg-gray-900 p-4 text-white">
        <div className="flex items-center gap-4">
          <h2 className="max-w-md truncate text-lg font-medium">{filename}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="rounded p-2 transition-colors hover:bg-gray-800"
            title="Letöltés"
          >
            <Download className="h-5 w-5" />
          </button>

          <button
            onClick={onClose}
            className="ml-2 rounded p-2 transition-colors hover:bg-gray-800"
            title="Bezárás (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-100">
        {isLoading && (
          <div className="flex h-full items-center justify-center bg-gray-900">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-300">Dokumentum betöltése...</span>
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center bg-gray-900 p-8 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
            <h3 className="mb-2 text-lg font-medium text-white">
              Nem sikerült betölteni a dokumentumot
            </h3>
            <p className="mb-4 text-sm text-gray-400">{error}</p>
            <button
              onClick={handleDownload}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Letöltés helyett
            </button>
          </div>
        )}

        {!isLoading && !error && content && (
          <div className="mx-auto min-h-full max-w-4xl bg-white p-8 shadow-lg">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="flex-shrink-0 bg-gray-900 px-4 py-2 text-center text-xs text-gray-400">
        Esc a bezáráshoz
      </div>
    </div>
  );
}
