import { FileText, Image, FileSpreadsheet, FileArchive, File, Download } from 'lucide-react';
import { formatFileSize } from '../../lib/utils';
import { api } from '../../lib/api';
import type { Attachment } from '../../types';

interface AttachmentViewProps {
  attachment: Attachment;
}

function getFileColor(mimeType?: string): string {
  if (!mimeType) return 'text-blue-500 bg-blue-50';
  if (mimeType.startsWith('image/')) return 'text-green-500 bg-green-50';
  if (mimeType.includes('pdf')) return 'text-red-500 bg-red-50';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return 'text-emerald-500 bg-emerald-50';
  if (mimeType.includes('zip') || mimeType.includes('archive'))
    return 'text-yellow-500 bg-yellow-50';
  return 'text-blue-500 bg-blue-50';
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

export function AttachmentView({ attachment }: AttachmentViewProps) {
  const colorClass = getFileColor(attachment.mimeType);

  const handleDownload = () => {
    const url = api.attachments.downloadUrl(attachment.id);
    window.open(url, '_blank');
  };

  return (
    <div
      onClick={handleDownload}
      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-colors group"
    >
      <div className={`p-2 rounded-lg ${colorClass}`}>
        <FileIcon mimeType={attachment.mimeType} className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">
          {attachment.filename}
        </p>
        <p className="text-xs text-gray-400">{formatFileSize(attachment.size)}</p>
      </div>

      <Download className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
    </div>
  );
}
