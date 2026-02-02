import { useState } from 'react';
import { X, Download, ExternalLink, AlertCircle } from 'lucide-react';

interface OfficeViewerProps {
  url: string;
  filename: string;
  mimeType: string;
  onClose: () => void;
}

export function OfficeViewer({ url, filename, mimeType, onClose }: OfficeViewerProps) {
  const [viewerError, setViewerError] = useState(false);
  const [useGoogleViewer, setUseGoogleViewer] = useState(true);

  // Támogatott formátumok ellenőrzése
  const isSupportedFormat =
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('opendocument') ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/msword';

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const handleOpenInNewTab = () => {
    window.open(url, '_blank');
  };

  // Google Docs Viewer URL (publikus dokumentumokhoz)
  // Alternatíva: Microsoft Office Online Viewer
  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  const microsoftViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

  const viewerUrl = useGoogleViewer ? googleViewerUrl : microsoftViewerUrl;

  if (!isSupportedFormat) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="bg-white dark:bg-dark-bg-secondary rounded-lg p-6 max-w-md mx-4">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="h-6 w-6 text-yellow-500 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-dark-text mb-2">
                Nem támogatott formátum
              </h3>
              <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                Ez a fájltípus nem jeleníthető meg böngészőben. Kérjük, töltsd le a megtekintéshez.
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary dark:text-dark-text"
            >
              Bezárás
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Letöltés
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium truncate max-w-md">{filename}</h2>
          {viewerError && (
            <span className="text-sm text-yellow-400">
              Viewer hiba - próbáld meg letölteni
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Viewer váltás */}
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={() => setUseGoogleViewer(true)}
              className={`px-3 py-1 text-xs rounded ${
                useGoogleViewer
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Google
            </button>
            <button
              onClick={() => setUseGoogleViewer(false)}
              className={`px-3 py-1 text-xs rounded ${
                !useGoogleViewer
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Microsoft
            </button>
          </div>

          {/* Új lapon megnyitás */}
          <button
            onClick={handleOpenInNewTab}
            className="p-2 rounded hover:bg-gray-800 transition-colors"
            title="Megnyitás új lapon"
          >
            <ExternalLink className="h-5 w-5" />
          </button>

          {/* Letöltés */}
          <button
            onClick={handleDownload}
            className="p-2 rounded hover:bg-gray-800 transition-colors"
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

      {/* Dokumentum megjelenítő iframe */}
      <div className="flex-1 relative">
        <iframe
          src={viewerUrl}
          className="w-full h-full border-0"
          title={filename}
          sandbox="allow-scripts allow-same-origin allow-popups"
          onError={() => setViewerError(true)}
        />

        {viewerError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="text-center text-white max-w-md p-6">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-400" />
              <h3 className="text-lg font-medium mb-2">
                Nem sikerült megjeleníteni a dokumentumot
              </h3>
              <p className="text-sm text-gray-300 mb-4">
                A fájl lehet, hogy nem elérhető publikusan, vagy a viewer nem támogatja.
                Próbáld meg letölteni és helyi alkalmazással megnyitni.
              </p>
              <button
                onClick={handleDownload}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Letöltés
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="bg-gray-900 text-gray-400 text-xs px-4 py-2 text-center">
        {useGoogleViewer ? 'Google Docs Viewer' : 'Microsoft Office Online Viewer'} használatával
        {' • '}
        Ha nem jelenik meg, próbáld meg a másik viewert vagy töltsd le a fájlt
      </div>
    </div>
  );
}
