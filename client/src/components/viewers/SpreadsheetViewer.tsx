import { useState, useEffect } from 'react';
import { X, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SpreadsheetViewerProps {
  url: string;
  filename: string;
  onClose: () => void;
}

interface SheetData {
  name: string;
  data: string[][];
}

export function SpreadsheetViewer({ url, filename, onClose }: SpreadsheetViewerProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSpreadsheet = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Nem sikerült letölteni a fájlt');
        }

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const loadedSheets: SheetData[] = workbook.SheetNames.map((name) => {
          const worksheet = workbook.Sheets[name];
          const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
            header: 1,
            defval: '',
          });
          return {
            name,
            data: jsonData as string[][],
          };
        });

        setSheets(loadedSheets);
        setActiveSheet(0);
      } catch (err) {
        console.error('Spreadsheet betöltési hiba:', err);
        setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt');
      } finally {
        setIsLoading(false);
      }
    };

    loadSpreadsheet();
  }, [url]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const currentSheet = sheets[activeSheet];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && activeSheet > 0) {
        setActiveSheet((prev) => prev - 1);
      } else if (e.key === 'ArrowRight' && activeSheet < sheets.length - 1) {
        setActiveSheet((prev) => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, activeSheet, sheets.length]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium truncate max-w-md">{filename}</h2>
          {sheets.length > 1 && (
            <span className="text-sm text-gray-400">
              {sheets.length} munkalap
            </span>
          )}
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

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 bg-gray-800 border-b border-gray-700 overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setActiveSheet((prev) => Math.max(0, prev - 1))}
            disabled={activeSheet === 0}
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4 text-gray-400" />
          </button>

          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(index)}
              className={`px-3 py-1.5 text-sm rounded whitespace-nowrap transition-colors ${
                index === activeSheet
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {sheet.name}
            </button>
          ))}

          <button
            onClick={() => setActiveSheet((prev) => Math.min(sheets.length - 1, prev + 1))}
            disabled={activeSheet === sheets.length - 1}
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-600 dark:text-gray-300">Táblázat betöltése...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Nem sikerült betölteni a táblázatot
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Letöltés helyett
            </button>
          </div>
        )}

        {!isLoading && !error && currentSheet && (
          <div className="min-w-full">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {currentSheet.data.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={rowIndex === 0 ? 'bg-gray-100 dark:bg-gray-800 font-semibold' : ''}
                  >
                    {/* Row number */}
                    <td className="sticky left-0 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 text-center min-w-[40px]">
                      {rowIndex + 1}
                    </td>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 whitespace-nowrap max-w-xs truncate"
                        title={String(cell)}
                      >
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {currentSheet.data.length === 0 && (
              <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                Ez a munkalap üres
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="bg-gray-900 text-gray-400 text-xs px-4 py-2 flex items-center justify-between flex-shrink-0">
        <span>
          {currentSheet
            ? `${currentSheet.data.length} sor • ${currentSheet.name}`
            : 'Betöltés...'}
        </span>
        <span>Nyílbillentyűkkel válthat a munkalapok között • Esc a bezáráshoz</span>
      </div>
    </div>
  );
}
