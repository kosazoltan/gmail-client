import { useState } from 'react';
import { FileText, Image, FileSpreadsheet, FileArchive, File, Download, Eye } from 'lucide-react';
import { formatFileSize } from '../../lib/utils';
import { api } from '../../lib/api';
import { AttachmentPreview } from './AttachmentPreview';
import type { Attachment } from '../../types';

interface AttachmentViewProps {
  attachment: Attachment;
}

function getFileColor(mimeType?: string): string {
  if (!mimeType) return 'text-blue-500 bg-blue-50 dark:bg-blue-500/20';
  if (mimeType.startsWith('image/')) return 'text-green-500 bg-green-50 dark:bg-green-500/20';
  if (mimeType.includes('pdf')) return 'text-red-500 bg-red-50 dark:bg-red-500/20';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/20';
  if (mimeType.includes('zip') || mimeType.includes('archive'))
    return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/20';
  return 'text-blue-500 bg-blue-50 dark:bg-blue-500/20';
}

function FileIcon({ mimeType, className }: { mimeType?: string; className?: string }) {
  if (!mimeType) return <File className={className} />;
  if (mimeType.startsWith('image/')) return <Image className={className} />;
  if (mimeType.includes('pdf')) return <FileText className={className} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return <FileSpreadsheet className={className} />;
  if (mimeType.includes('zip') || mimeType.includes('archive'))
    return <FileArchive className={className} />;
  return <File className={className} />;
}

// Előnézethez támogatott fájltípusok
function canPreview(mimeType: string | undefined, filename: string): boolean {
  if (!mimeType) return false;

  // Képek (SVG kivételével)
  if (mimeType.startsWith('image/') && !mimeType.includes('svg')) return true;

  // PDF
  if (mimeType === 'application/pdf') return true;

  // Szöveges fájlok
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return true;

  // Office dokumentumok
  const officeExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (officeExtensions.includes(ext)) return true;

  return false;
}

export function AttachmentView({ attachment }: AttachmentViewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const colorClass = getFileColor(attachment.mimeType);
  const hasPreview = canPreview(attachment.mimeType, attachment.filename);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = api.attachments.downloadUrl(attachment.id);
    window.open(url, '_blank');
  };

  const handlePreview = () => {
    if (hasPreview) {
      setShowPreview(true);
    } else {
      // Direct download without fake event
      const url = api.attachments.downloadUrl(attachment.id);
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <div
        onClick={handlePreview}
        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-border hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/10 cursor-pointer transition-colors group"
      >
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <FileIcon mimeType={attachment.mimeType} className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-dark-text truncate">
            {attachment.filename}
          </p>
          <p className="text-xs text-gray-400 dark:text-dark-text-muted">{formatFileSize(attachment.size)}</p>
        </div>

        <div className="flex items-center gap-1">
          {hasPreview && (
            <Eye className="h-4 w-4 text-gray-300 dark:text-dark-text-muted group-hover:text-blue-500 transition-colors" />
          )}
          <button
            onClick={handleDownload}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-bg-tertiary"
            title="Letöltés"
          >
            <Download className="h-4 w-4 text-gray-300 dark:text-dark-text-muted hover:text-blue-500 transition-colors" />
          </button>
        </div>
      </div>

      <AttachmentPreview
        attachment={attachment}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
}
