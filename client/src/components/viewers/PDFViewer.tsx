import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, X } from 'lucide-react';

// PDF.js worker beállítása
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export function PDFViewer({ url, filename, onClose }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const pdfDocumentRef = useRef<{ destroy: () => Promise<void> } | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  // Cleanup PDF.js worker on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pdfDocumentRef.current) {
        pdfDocumentRef.current.destroy().catch(() => {});
      }
    };
  }, []);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-900 p-4 text-white">
        <div className="flex items-center gap-4">
          <h2 className="max-w-md truncate text-lg font-medium">{filename}</h2>
          <span className="text-sm text-gray-400">
            {pageNumber} / {numPages}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom gombok */}
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="rounded p-2 transition-colors hover:bg-gray-800"
            title="Kicsinyítés"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="px-2 text-sm">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="rounded p-2 transition-colors hover:bg-gray-800"
            title="Nagyítás"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          {/* Letöltés */}
          <button
            onClick={handleDownload}
            className="ml-2 rounded p-2 transition-colors hover:bg-gray-800"
            title="Letöltés"
          >
            <Download className="h-5 w-5" />
          </button>

          {/* Bezárás */}
          <button
            onClick={onClose}
            className="ml-2 rounded p-2 transition-colors hover:bg-gray-800"
            title="Bezárás"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* PDF tartalom */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        <Document
          file={url}
          onLoadSuccess={(pdf) => {
            pdfDocumentRef.current = pdf;
            onDocumentLoadSuccess(pdf);
          }}
          loading={
            <div className="text-center text-white">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-white"></div>
              <p>PDF betöltése...</p>
            </div>
          }
          error={
            <div className="text-center text-red-400">
              <p>Hiba a PDF betöltésekor</p>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            className="shadow-2xl"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {/* Lapozás */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-4 bg-gray-900 p-4 text-white">
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="rounded p-2 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <input
            type="number"
            min={1}
            max={numPages}
            value={pageNumber}
            onChange={(e) => {
              const page = parseInt(e.target.value, 10);
              if (!isNaN(page) && page >= 1 && page <= numPages) {
                setPageNumber(page);
              }
            }}
            className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-center"
          />

          <button
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="rounded p-2 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
