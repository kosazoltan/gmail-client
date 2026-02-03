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
  const pdfDocumentRef = useRef<any>(null);

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
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium truncate max-w-md">{filename}</h2>
          <span className="text-sm text-gray-400">
            {pageNumber} / {numPages}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom gombok */}
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            className="p-2 rounded hover:bg-gray-800 transition-colors"
            title="Kicsinyítés"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-sm px-2">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(3, s + 0.25))}
            className="p-2 rounded hover:bg-gray-800 transition-colors"
            title="Nagyítás"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          {/* Letöltés */}
          <button
            onClick={handleDownload}
            className="p-2 rounded hover:bg-gray-800 transition-colors ml-2"
            title="Letöltés"
          >
            <Download className="h-5 w-5" />
          </button>

          {/* Bezárás */}
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-800 transition-colors ml-2"
            title="Bezárás"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* PDF tartalom */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <Document
          file={url}
          onLoadSuccess={(pdf) => {
            pdfDocumentRef.current = pdf;
            onDocumentLoadSuccess(pdf);
          }}
          loading={
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>PDF betöltése...</p>
            </div>
          }
          error={
            <div className="text-red-400 text-center">
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
        <div className="flex items-center justify-center gap-4 p-4 bg-gray-900 text-white">
          <button
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="p-2 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
            className="w-16 px-2 py-1 text-center bg-gray-800 border border-gray-700 rounded"
          />

          <button
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="p-2 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
