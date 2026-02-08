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
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between bg-gray-900 p-4 text-white">
        <div className="flex items-center gap-4">
          <h2 className="max-w-md truncate text-lg font-medium">{filename}</h2>
          {sheets.length > 1 && (
            <span className="text-sm text-gray-400">{sheets.length} munkalap</span>
          )}
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

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-gray-700 bg-gray-800 px-4 py-2">
          <button
            onClick={() => setActiveSheet((prev) => Math.max(0, prev - 1))}
            disabled={activeSheet === 0}
            className="rounded p-1 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4 text-gray-400" />
          </button>

          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(index)}
              className={`rounded px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
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
            className="rounded p-1 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-600 dark:text-gray-300">Táblázat betöltése...</span>
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
            <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
              Nem sikerült betölteni a táblázatot
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{error}</p>
            <button
              onClick={handleDownload}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
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
                    className={rowIndex === 0 ? 'bg-gray-100 font-semibold dark:bg-gray-800' : ''}
                  >
                    {/* Row number */}
                    <td className="sticky left-0 min-w-[40px] border border-gray-200 bg-gray-50 px-2 py-1 text-center text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      {rowIndex + 1}
                    </td>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="max-w-xs truncate border border-gray-200 px-3 py-1.5 whitespace-nowrap text-gray-900 dark:border-gray-700 dark:text-gray-100"
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
              <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
                Ez a munkalap üres
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="flex flex-shrink-0 items-center justify-between bg-gray-900 px-4 py-2 text-xs text-gray-400">
        <span>
          {currentSheet ? `${currentSheet.data.length} sor • ${currentSheet.name}` : 'Betöltés...'}
        </span>
        <span>Nyílbillentyűkkel válthat a munkalapok között • Esc a bezáráshoz</span>
      </div>
    </div>
  );
}
