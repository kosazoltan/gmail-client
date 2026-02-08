import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttachments } from '../../hooks/useAttachments';
import { api } from '../../lib/api';
import { formatFileSize, formatRelativeTime } from '../../lib/utils';
import {
  Paperclip,
  Download,
  Search,
  Loader2,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  Presentation,
  Archive,
  File,
  Mail,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { AttachmentWithEmail } from '../../types';
import { EmptyState } from '../common/EmptyState';

const typeFilters = [
  { id: 'all', label: 'Összes', icon: Paperclip },
  { id: 'image', label: 'Képek', icon: FileImage },
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'document', label: 'Dokumentumok', icon: FileText },
  { id: 'spreadsheet', label: 'Táblázatok', icon: FileSpreadsheet },
  { id: 'presentation', label: 'Prezentációk', icon: Presentation },
  { id: 'video', label: 'Videók', icon: FileVideo },
  { id: 'audio', label: 'Hangok', icon: FileAudio },
  { id: 'archive', label: 'Archívumok', icon: Archive },
  { id: 'other', label: 'Egyéb', icon: File },
];

const sortOptions = [
  { value: 'date', label: 'Dátum' },
  { value: 'size', label: 'Méret' },
  { value: 'name', label: 'Név' },
];

function getTypeIcon(type: string) {
  switch (type) {
    case 'image':
      return FileImage;
    case 'pdf':
      return FileText;
    case 'document':
      return FileText;
    case 'spreadsheet':
      return FileSpreadsheet;
    case 'presentation':
      return Presentation;
    case 'video':
      return FileVideo;
    case 'audio':
      return FileAudio;
    case 'archive':
      return Archive;
    default:
      return File;
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'image':
      return 'text-green-500 bg-green-50 dark:bg-green-500/20';
    case 'pdf':
      return 'text-red-500 bg-red-50 dark:bg-red-500/20';
    case 'document':
      return 'text-blue-500 bg-blue-50 dark:bg-blue-500/20';
    case 'spreadsheet':
      return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/20';
    case 'presentation':
      return 'text-orange-500 bg-orange-50 dark:bg-orange-500/20';
    case 'video':
      return 'text-purple-500 bg-purple-50 dark:bg-purple-500/20';
    case 'audio':
      return 'text-pink-500 bg-pink-50 dark:bg-pink-500/20';
    case 'archive':
      return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-500/20';
    default:
      return 'text-gray-500 bg-gray-50 dark:bg-gray-500/20';
  }
}

export function AttachmentsView() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<'date' | 'size' | 'name'>('date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAttachments({
    type: selectedType === 'all' ? undefined : selectedType,
    search: searchQuery || undefined,
    sort,
    order,
    page,
    limit: 50,
  });

  const handleDownload = (attachment: AttachmentWithEmail) => {
    window.open(api.attachments.downloadUrl(attachment.id), '_blank');
  };

  const handleOpenEmail = (emailId: string) => {
    navigate(`/?emailId=${emailId}`);
  };

  const toggleOrder = () => {
    setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Fejléc */}
      <div className="dark:bg-dark-bg-tertiary dark:border-dark-border border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="mb-3 flex items-center gap-2">
          <Paperclip className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
          <h2 className="dark:text-dark-text text-sm font-medium text-gray-600">
            Mellékletek
            {data && (
              <span className="dark:text-dark-text-muted ml-1 text-gray-400">
                ({data.total} db)
              </span>
            )}
          </h2>
        </div>

        {/* Keresés és rendezés */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="dark:text-dark-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Keresés fájlnév vagy tárgy szerint..."
              className="dark:bg-dark-bg dark:border-dark-border dark:text-dark-text w-full rounded-lg border border-gray-200 bg-white py-1.5 pr-3 pl-9 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 dark:focus:border-blue-500 dark:focus:ring-blue-500"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'date' | 'size' | 'name')}
            className="dark:bg-dark-bg dark:border-dark-border dark:text-dark-text rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={toggleOrder}
            className="dark:hover:bg-dark-bg dark:text-dark-text-secondary rounded-lg p-1.5 text-gray-500 hover:bg-gray-200"
            title={order === 'asc' ? 'Növekvő' : 'Csökkenő'}
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Típus szűrők */}
      <div className="dark:bg-dark-bg-secondary dark:border-dark-border flex items-center gap-1 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2">
        {typeFilters.map((filter) => {
          const Icon = filter.icon;
          const count = data?.typeStats[filter.id] || 0;
          const isActive = selectedType === filter.id;

          return (
            <button
              key={filter.id}
              onClick={() => {
                setSelectedType(filter.id);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-50 font-medium text-[#4f6ef7] dark:bg-blue-500/10 dark:text-blue-400'
                  : 'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{filter.label}</span>
              {count > 0 && (
                <span
                  className={`text-xs ${
                    isActive
                      ? 'text-[#4f6ef7] dark:text-blue-400'
                      : 'dark:text-dark-text-muted text-gray-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : !data?.attachments.length ? (
          <EmptyState
            icon={Paperclip}
            title="Nincsenek mellékletek"
            description="A levélmellékletek itt jelennek meg."
          />
        ) : (
          <div className="dark:divide-dark-border divide-y divide-gray-100">
            {data.attachments.map((attachment) => {
              const TypeIcon = getTypeIcon(attachment.type);
              const typeColor = getTypeColor(attachment.type);

              return (
                <div
                  key={attachment.id}
                  className="dark:hover:bg-dark-bg-tertiary flex items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  {/* Ikon */}
                  <div className={`rounded-lg p-2.5 ${typeColor}`}>
                    <TypeIcon className="h-5 w-5" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
                      {attachment.filename}
                    </div>
                    <div className="dark:text-dark-text-secondary mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatFileSize(attachment.size)}</span>
                      <span>-</span>
                      <span>{formatRelativeTime(attachment.emailDate)}</span>
                    </div>
                    {attachment.emailSubject && (
                      <div className="dark:text-dark-text-muted mt-0.5 truncate text-xs text-gray-400">
                        {attachment.emailSubject}
                      </div>
                    )}
                  </div>

                  {/* Műveletek */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEmail(attachment.emailId)}
                      className="dark:hover:bg-dark-bg dark:text-dark-text-secondary rounded-lg p-2 text-gray-500 hover:bg-gray-200"
                      title="Email megnyitása"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(attachment)}
                      className="rounded-lg p-2 text-[#4f6ef7] hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                      title="Letöltés"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lapozás */}
      {data && data.totalPages > 1 && (
        <div className="dark:border-dark-border dark:bg-dark-bg-secondary flex items-center justify-center gap-2 border-t border-gray-200 bg-white p-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="dark:text-dark-text-secondary text-sm text-gray-500">
            {page} / {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
