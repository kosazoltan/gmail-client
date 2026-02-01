import { useState } from 'react';
import { X, Download, ExternalLink, FileText, Image, FileSpreadsheet, File, Loader2 } from 'lucide-react';
import { formatFileSize } from '../../lib/utils';
import { api } from '../../lib/api';
import type { Attachment } from '../../types';
import { PDFViewer } from '../viewers/PDFViewer';
import { ImageViewer } from '../viewers/ImageViewer';
import { OfficeViewer } from '../viewers/OfficeViewer';

interface AttachmentPreviewProps {
  attachment: Attachment;
  isOpen: boolean;
  onClose: () => void;
}

// Támogatott előnézeti típusok
function canPreview(mimeType: string | undefined, filename: string): 'image' | 'pdf' | 'text' | 'office' | false {
  if (!mimeType) return false;

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

  // Office dokumentumok - Google Docs Viewer-rel
  const officeExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
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

  if (!isOpen) return null;

  const downloadUrl = api.attachments.downloadUrl(attachment.id);
  const previewType = canPreview(attachment.mimeType, attachment.filename);

  console.log('AttachmentPreview:', {
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    previewType,
    downloadUrl
  });

  // Use specialized viewers for better UX
  if (previewType === 'image') {
    return <ImageViewer url={downloadUrl} filename={attachment.filename} onClose={onClose} />;
  }

  if (previewType === 'pdf') {
    return <PDFViewer url={downloadUrl} filename={attachment.filename} onClose={onClose} />;
  }

  if (previewType === 'office') {
    return (
      <OfficeViewer
        url={downloadUrl}
        filename={attachment.filename}
        mimeType={attachment.mimeType || ''}
        onClose={onClose}
      />
    );
  }

  // Fallback for text files and unsupported types

  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
  };

  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleError = () => {
    setIsLoading(false);
    setError('A fájl nem tölthető be előnézetben');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-black/50 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3 text-white">
          <FileIcon mimeType={attachment.mimeType} className="h-5 w-5" />
          <span className="font-medium truncate max-w-md">{attachment.filename}</span>
          <span className="text-sm text-gray-400">{formatFileSize(attachment.size)}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            <Download className="h-4 w-4" />
            Letöltés
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            aria-label="Bezárás"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Preview content */}
      <div className="w-full h-full pt-14 pb-4 px-4 flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {error && (
          <div className="text-center text-white">
            <FileIcon mimeType={attachment.mimeType} className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">{error}</p>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
            >
              Letöltés helyett
            </button>
          </div>
        )}

        {previewType === 'text' && (
          <iframe
            src={downloadUrl}
            title={attachment.filename}
            className={`w-full h-full max-w-4xl bg-white rounded-lg shadow-2xl font-mono ${isLoading ? 'invisible' : ''}`}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}

        {!previewType && !error && (
          <div className="text-center text-white">
            <FileIcon mimeType={attachment.mimeType} className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Ez a fájltípus nem támogatott előnézetben</p>
            <p className="text-sm text-gray-400 mb-4">{attachment.mimeType || 'Ismeretlen típus'}</p>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
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
