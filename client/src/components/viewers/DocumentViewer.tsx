import { useState, useEffect } from 'react';
import { X, Download, Loader2, AlertCircle } from 'lucide-react';
import * as mammoth from 'mammoth';

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
          setContent(result.value);
        }
        // DOC formátum - próbáljuk mammoth-tal (nem garantált)
        else if (mimeType.includes('msword') || filename.endsWith('.doc')) {
          try {
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setContent(result.value);
          } catch {
            throw new Error('A régi .doc formátum nem támogatott. Kérjük, konvertálja .docx formátumba.');
          }
        }
        // ODT formátum - egyszerű szöveg kinyerés (korlátozott támogatás)
        else if (mimeType.includes('opendocument.text') || filename.endsWith('.odt')) {
          // ODT is basically a ZIP with content.xml inside
          // For now, show a message that it's not fully supported
          throw new Error('Az ODT formátum előnézete jelenleg nem támogatott. Kérjük, töltse le a fájlt.');
        }
        else {
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
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium truncate max-w-md">{filename}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 rounded hover:bg-gray-800 transition-colors"
            title="Letöltés"
          >
            <Download className="h-5 w-5" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-800 transition-colors ml-2"
            title="Bezárás (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-100">
        {isLoading && (
          <div className="flex items-center justify-center h-full bg-gray-900">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-300">Dokumentum betöltése...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-900">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Nem sikerült betölteni a dokumentumot
            </h3>
            <p className="text-sm text-gray-400 mb-4">{error}</p>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Letöltés helyett
            </button>
          </div>
        )}

        {!isLoading && !error && content && (
          <div className="max-w-4xl mx-auto p-8 bg-white shadow-lg min-h-full">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="bg-gray-900 text-gray-400 text-xs px-4 py-2 text-center flex-shrink-0">
        Esc a bezáráshoz
      </div>
    </div>
  );
}
