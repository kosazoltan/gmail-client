import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Loader2,
} from 'lucide-react';
import { formatFileSize } from '../../lib/utils';
import { api } from '../../lib/api';
import type { Attachment } from '../../types';

const PDFViewer = lazy(() =>
  import('../viewers/PDFViewer').then((module) => ({
    default: module.PDFViewer,
  })),
);
const ImageViewer = lazy(() =>
  import('../viewers/ImageViewer').then((module) => ({
    default: module.ImageViewer,
  })),
);
const OfficeViewer = lazy(() =>
  import('../viewers/OfficeViewer').then((module) => ({
    default: module.OfficeViewer,
  })),
);
const SpreadsheetViewer = lazy(() =>
  import('../viewers/SpreadsheetViewer').then((module) => ({
    default: module.SpreadsheetViewer,
  })),
);
const DocumentViewer = lazy(() =>
  import('../viewers/DocumentViewer').then((module) => ({
    default: module.DocumentViewer,
  })),
);

interface AttachmentPreviewProps {
  attachment: Attachment;
  isOpen: boolean;
  onClose: () => void;
}

// Támogatott előnézeti típusok
function canPreview(
  mimeType: string | undefined,
  filename: string,
): 'image' | 'pdf' | 'text' | 'office' | 'spreadsheet' | 'document' | false {
  if (!mimeType) return false;

  // FIX: Handle files without extension
  const lastDotIndex = filename.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? filename.toLowerCase().substring(lastDotIndex) : '';

  // Képek
  if (mimeType.startsWith('image/') && !mimeType.includes('svg')) {
    return 'image';
  }

  // PDF
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }

  // Szöveges fájlok
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return 'text';
  }

  // Táblázatok - natív xlsx könyvtárral
  const spreadsheetExtensions = ['.xls', '.xlsx', '.ods', '.csv'];
  if (
    spreadsheetExtensions.includes(ext) ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return 'spreadsheet';
  }

  // Word dokumentumok - mammoth.js-sel
  const documentExtensions = ['.doc', '.docx'];
  if (
    documentExtensions.includes(ext) ||
    mimeType.includes('wordprocessingml') ||
    mimeType === 'application/msword'
  ) {
    return 'document';
  }

  // Prezentációk és egyéb Office dokumentumok - Google/Microsoft Viewer-rel
  const officeExtensions = ['.ppt', '.pptx', '.odt', '.odp'];
  if (officeExtensions.includes(ext)) {
    return 'office';
  }

  return false;
}

function FileIcon({ mimeType, className }: { mimeType?: string; className?: string }) {
  if (!mimeType) return <File className={className} />;
  if (mimeType.startsWith('image/')) return <Image className={className} />;
  if (mimeType.includes('pdf')) return <FileText className={className} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return <FileSpreadsheet className={className} />;
  return <File className={className} />;
}

export function AttachmentPreview({ attachment, isOpen, onClose }: AttachmentPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Track mount status to prevent state updates after unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!isOpen) return null;

  const downloadUrl = api.attachments.downloadUrl(attachment.id);
  const previewType = canPreview(attachment.mimeType, attachment.filename);

  const fallback = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  );

  // Use specialized viewers for better UX
  if (previewType === 'image') {
    return (
      <Suspense fallback={fallback}>
        <ImageViewer url={downloadUrl} filename={attachment.filename} onClose={onClose} />
      </Suspense>
    );
  }

  if (previewType === 'pdf') {
    return (
      <Suspense fallback={fallback}>
        <PDFViewer url={downloadUrl} filename={attachment.filename} onClose={onClose} />
      </Suspense>
    );
  }

  if (previewType === 'office') {
    return (
      <Suspense fallback={fallback}>
        <OfficeViewer
          url={downloadUrl}
          filename={attachment.filename}
          mimeType={attachment.mimeType || ''}
          onClose={onClose}
        />
      </Suspense>
    );
  }

  if (previewType === 'spreadsheet') {
    return (
      <Suspense fallback={fallback}>
        <SpreadsheetViewer url={downloadUrl} filename={attachment.filename} onClose={onClose} />
      </Suspense>
    );
  }

  if (previewType === 'document') {
    return (
      <Suspense fallback={fallback}>
        <DocumentViewer
          url={downloadUrl}
          filename={attachment.filename}
          mimeType={attachment.mimeType || ''}
          onClose={onClose}
        />
      </Suspense>
    );
  }

  // Fallback for text files and unsupported types

  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
  };

  const handleLoad = () => {
    if (!mountedRef.current) return;
    setIsLoading(false);
    setError(null);
  };

  const handleError = () => {
    if (!mountedRef.current) return;
    setIsLoading(false);
    setError('A fájl nem tölthető be előnézetben');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="absolute top-0 right-0 left-0 z-10 flex h-14 items-center justify-between bg-black/50 px-4">
        <div className="flex items-center gap-3 text-white">
          <FileIcon mimeType={attachment.mimeType} className="h-5 w-5" />
          <span className="max-w-md truncate font-medium">{attachment.filename}</span>
          <span className="text-sm text-gray-400">{formatFileSize(attachment.size)}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
          >
            <Download className="h-4 w-4" />
            Letöltés
          </button>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white transition-colors hover:bg-white/10"
            aria-label="Bezárás"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Preview content */}
      <div className="flex h-full w-full items-center justify-center px-4 pt-14 pb-4">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {error && (
          <div className="text-center text-white">
            <FileIcon
              mimeType={attachment.mimeType}
              className="mx-auto mb-4 h-16 w-16 opacity-50"
            />
            <p className="mb-2 text-lg">{error}</p>
            <button
              onClick={handleDownload}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm transition-colors hover:bg-blue-700"
            >
              Letöltés helyett
            </button>
          </div>
        )}

        {previewType === 'text' && (
          <iframe
            src={downloadUrl}
            title={attachment.filename}
            className={`h-full w-full max-w-4xl rounded-lg bg-white font-mono shadow-2xl ${
              isLoading ? 'invisible' : ''
            }`}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}

        {!previewType && !error && (
          <div className="text-center text-white">
            <FileIcon
              mimeType={attachment.mimeType}
              className="mx-auto mb-4 h-16 w-16 opacity-50"
            />
            <p className="mb-2 text-lg">Ez a fájltípus nem támogatott előnézetben</p>
            <p className="mb-4 text-sm text-gray-400">
              {attachment.mimeType || 'Ismeretlen típus'}
            </p>
            <button
              onClick={handleDownload}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm transition-colors hover:bg-blue-700"
            >
              Letöltés
            </button>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
