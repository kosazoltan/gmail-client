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
    <div className="flex flex-col h-full">
      {/* Fejléc */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center gap-2 mb-3">
          <Paperclip className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
          <h2 className="text-sm font-medium text-gray-600 dark:text-dark-text">
            Mellékletek
            {data && (
              <span className="text-gray-400 dark:text-dark-text-muted ml-1">
                ({data.total} db)
              </span>
            )}
          </h2>
        </div>

        {/* Keresés és rendezés */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-dark-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Keresés fájlnév vagy tárgy szerint..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg text-sm text-gray-900 dark:text-dark-text focus:border-blue-300 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-500 outline-none"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'date' | 'size' | 'name')}
            className="px-3 py-1.5 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg text-sm text-gray-700 dark:text-dark-text"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={toggleOrder}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-bg text-gray-500 dark:text-dark-text-secondary"
            title={order === 'asc' ? 'Növekvő' : 'Csökkenő'}
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Típus szűrők */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-dark-bg-secondary border-b border-gray-200 dark:border-dark-border overflow-x-auto">
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{filter.label}</span>
              {count > 0 && (
                <span
                  className={`text-xs ${
                    isActive
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-gray-400 dark:text-dark-text-muted'
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
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : !data?.attachments.length ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-dark-text-muted">
            <Paperclip className="h-12 w-12 mb-3" />
            <p>Nincs melléklet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {data.attachments.map((attachment) => {
              const TypeIcon = getTypeIcon(attachment.type);
              const typeColor = getTypeColor(attachment.type);

              return (
                <div
                  key={attachment.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary transition-colors"
                >
                  {/* Ikon */}
                  <div className={`p-2.5 rounded-lg ${typeColor}`}>
                    <TypeIcon className="h-5 w-5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-dark-text text-sm truncate">
                      {attachment.filename}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-text-secondary mt-0.5">
                      <span>{formatFileSize(attachment.size)}</span>
                      <span>-</span>
                      <span>{formatRelativeTime(attachment.emailDate)}</span>
                    </div>
                    {attachment.emailSubject && (
                      <div className="text-xs text-gray-400 dark:text-dark-text-muted mt-0.5 truncate">
                        {attachment.emailSubject}
                      </div>
                    )}
                  </div>

                  {/* Műveletek */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEmail(attachment.emailId)}
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-bg text-gray-500 dark:text-dark-text-secondary"
                      title="Email megnyitása"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(attachment)}
                      className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400"
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
        <div className="flex items-center justify-center gap-2 p-3 border-t border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg-secondary">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-500 dark:text-dark-text-secondary">
            {page} / {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
