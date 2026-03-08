import { useState } from 'react';
import {
  FileText,
  Image,
  FileSpreadsheet,
  FileArchive,
  File,
  Download,
  Eye,
  Sparkles,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatFileSize } from '../../lib/utils';
import { api } from '../../lib/api';
import { AttachmentPreview } from './AttachmentPreview';
import type { Attachment, AttachmentAnalysis } from '../../types';

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
  const officeExtensions = [
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.odt',
    '.ods',
    '.odp',
  ];
  // FIX: Handle files without extension
  const lastDotIndex = filename.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? filename.toLowerCase().substring(lastDotIndex) : '';
  if (ext && officeExtensions.includes(ext)) return true;

  return false;
}

// AI elemzéshez támogatott fájltípusok
function canAnalyze(mimeType: string | undefined, filename: string): boolean {
  if (!mimeType) return false;
  if (mimeType === 'application/pdf') return true;
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    filename.endsWith('.docx') ||
    filename.endsWith('.doc')
  )
    return true;
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return true;
  return false;
}

// Helper függvény a fájl letöltéshez
function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function AttachmentView({ attachment }: AttachmentViewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [analysis, setAnalysis] = useState<AttachmentAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const colorClass = getFileColor(attachment.mimeType);
  const hasPreview = canPreview(attachment.mimeType, attachment.filename);
  const analyzable = canAnalyze(attachment.mimeType, attachment.filename);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadFile(api.attachments.downloadUrl(attachment.id), attachment.filename);
  };

  const handlePreview = () => {
    if (hasPreview) {
      setShowPreview(true);
    } else {
      downloadFile(api.attachments.downloadUrl(attachment.id), attachment.filename);
    }
  };

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (analysis) {
      setShowAnalysis(!showAnalysis);
      return;
    }
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await api.attachments.analyze(attachment.id);
      setAnalysis(result);
      setShowAnalysis(true);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Elemzés sikertelen');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <>
      <div className="dark:border-dark-border rounded-lg border border-gray-200">
        <div
          onClick={handlePreview}
          className="group flex cursor-pointer items-center gap-3 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:hover:border-blue-500 dark:hover:bg-blue-500/10"
        >
          <div className={`rounded-lg p-2 ${colorClass}`}>
            <FileIcon mimeType={attachment.mimeType} className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="dark:text-dark-text truncate text-sm font-medium text-gray-700">
              {attachment.filename}
            </p>
            <p className="dark:text-dark-text-muted text-xs text-gray-400">
              {formatFileSize(attachment.size)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {analyzable && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="dark:hover:bg-dark-bg-tertiary flex items-center gap-1 rounded p-1 text-amber-500 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                title={analysis ? 'Elemzés mutatása/elrejtése' : 'AI Elemzés'}
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </button>
            )}
            {hasPreview && (
              <Eye className="dark:text-dark-text-muted h-4 w-4 text-gray-300 transition-colors group-hover:text-blue-500" />
            )}
            <button
              onClick={handleDownload}
              className="dark:hover:bg-dark-bg-tertiary rounded p-1 hover:bg-gray-200"
              title="Letöltés"
            >
              <Download className="dark:text-dark-text-muted h-4 w-4 text-gray-300 transition-colors hover:text-blue-500" />
            </button>
          </div>
        </div>

        {/* Elemzési hiba */}
        {analysisError && (
          <div className="flex items-center gap-2 border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            <span className="flex-1">{analysisError}</span>
            <button onClick={() => setAnalysisError(null)}>
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Elemzés panel */}
        {analysis && showAnalysis && (
          <div className="dark:border-dark-border dark:bg-dark-bg-tertiary border-t border-gray-100 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  AI Elemzés
                </span>
                <span className="dark:bg-dark-bg rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                  {analysis.documentType}
                </span>
                {analysis.pageCount && (
                  <span className="text-[10px] text-gray-400">
                    {analysis.pageCount} oldal
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAnalysis(false);
                }}
                className="dark:text-dark-text-muted text-gray-400 hover:text-gray-600"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="dark:text-dark-text-secondary mb-2 text-xs leading-relaxed text-gray-600">
              {analysis.summary}
            </p>

            {analysis.keyPoints.length > 0 && (
              <ul className="space-y-1">
                {analysis.keyPoints.map((point, i) => (
                  <li
                    key={i}
                    className="dark:text-dark-text-muted flex items-start gap-1.5 text-xs text-gray-500"
                  >
                    <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-amber-400" />
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Összecsukott elemzés jelző */}
        {analysis && !showAnalysis && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAnalysis(true);
            }}
            className="dark:border-dark-border flex w-full items-center gap-1.5 border-t border-gray-100 px-3 py-1.5 text-[10px] text-amber-500 hover:bg-amber-50/50 dark:text-amber-400 dark:hover:bg-amber-500/5"
          >
            <Sparkles className="h-3 w-3" />
            <span>Elemzés: {analysis.documentType}</span>
            <ChevronDown className="ml-auto h-3 w-3" />
          </button>
        )}
      </div>

      <AttachmentPreview
        attachment={attachment}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
}
