import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { LucideIcon } from 'lucide-react';
import {
  Database,
  HardDrive,
  Trash2,
  Download,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Paperclip,
  Mail,
  MailOpen,
  Archive,
  AlertTriangle,
} from 'lucide-react';

export function DatabaseManager() {
  const [activeTab, setActiveTab] = useState<'stats' | 'emails' | 'backups'>('stats');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Fejléc */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
          <Database className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-800">Adatbázis kezelő</h1>
        </div>

        {/* Tabok */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'stats'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Statisztikák
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'emails'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Emailek kezelése
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'backups'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Biztonsági mentések
          </button>
        </div>

        {/* Tartalom */}
        <div className="p-6">
          {activeTab === 'stats' && <StatsTab />}
          {activeTab === 'emails' && <EmailsTab />}
          {activeTab === 'backups' && <BackupsTab />}
        </div>
      </div>
    </div>
  );
}

// Statisztikák tab
function StatsTab() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['database-stats'],
    queryFn: () => api.database.getStats(),
  });

  const vacuumMutation = useMutation({
    mutationFn: () => api.database.vacuum(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: () => api.database.cleanup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Betöltés...</div>;
  }

  if (!stats) {
    return <div className="text-center py-8 text-gray-500">Nincs adat</div>;
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleDateString('hu-HU');
  };

  return (
    <div className="space-y-6">
      {/* Fő statisztikák */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Mail} label="Emailek" value={stats.totalEmails.toLocaleString()} />
        <StatCard icon={Paperclip} label="Csatolmányok" value={stats.totalAttachments.toLocaleString()} />
        <StatCard icon={HardDrive} label="Adatbázis méret" value={formatBytes(stats.databaseSizeBytes)} />
        <StatCard icon={Database} label="Kontaktok" value={stats.totalContacts.toLocaleString()} />
      </div>

      {/* Időszak */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Email időszak</h3>
        <p className="text-sm text-gray-600">
          {formatDate(stats.oldestEmail)} - {formatDate(stats.newestEmail)}
        </p>
      </div>

      {/* Fiókonkénti statisztika */}
      {stats.emailsByAccount.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Emailek fiókonként</h3>
          <div className="space-y-2">
            {stats.emailsByAccount.map((account) => (
              <div key={account.accountId} className="flex justify-between text-sm">
                <span className="text-gray-600">{account.email}</span>
                <span className="font-medium">{account.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Karbantartás */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Karbantartás</h3>
        <div className="flex gap-3">
          <button
            onClick={() => vacuumMutation.mutate()}
            disabled={vacuumMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${vacuumMutation.isPending ? 'animate-spin' : ''}`} />
            Adatbázis tömörítés
          </button>
          <button
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Árva rekordok törlése
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-semibold text-gray-800">{value}</p>
    </div>
  );
}

// Emailek kezelése tab
function EmailsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'from' | 'subject' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteOldDays, setDeleteOldDays] = useState('365');
  const [showDeleteOldConfirm, setShowDeleteOldConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['database-emails', page, search, sortBy, sortOrder],
    queryFn: () =>
      api.database.listEmails({
        page,
        limit: 50,
        sortBy,
        sortOrder,
        search: search || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (emailIds: string[]) => api.database.deleteEmails(emailIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-emails'] });
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    },
  });

  const deleteOldMutation = useMutation({
    mutationFn: (days: number) => api.database.deleteOldEmails(days),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['database-emails'] });
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
      setShowDeleteOldConfirm(false);
      alert(`${data.deletedCount} email törölve.`);
    },
  });

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selectedIds.size === data.emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.emails.map((e) => e.id)));
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Eszközsáv */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Keresés..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="date">Dátum</option>
          <option value="from">Feladó</option>
          <option value="subject">Tárgy</option>
          <option value="size">Méret</option>
        </select>

        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {sortOrder === 'desc' ? '↓ Csökkenő' : '↑ Növekvő'}
        </button>

        {selectedIds.size > 0 && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Törlés ({selectedIds.size})
          </button>
        )}

        <button
          onClick={() => setShowDeleteOldConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700"
        >
          <Calendar className="h-4 w-4" />
          Régi emailek törlése
        </button>
      </div>

      {/* Táblázat */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Betöltés...</div>
      ) : !data || data.emails.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Nincs email</div>
      ) : (
        <>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === data.emails.length && data.emails.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Feladó</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Tárgy</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Dátum</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Méret</th>
                  <th className="w-16 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.emails.map((email) => (
                  <tr key={email.id} className={selectedIds.has(email.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(email.id)}
                        onChange={() => toggleSelect(email.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {email.is_read ? (
                          <MailOpen className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Mail className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="truncate max-w-[200px]">
                          {email.from_name || email.from_email || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[300px]">{email.subject || '(nincs tárgy)'}</span>
                        {email.has_attachments === 1 && <Paperclip className="h-4 w-4 text-gray-400" />}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{formatDate(email.date)}</td>
                    <td className="px-3 py-2 text-gray-600">{formatSize(email.body_size)}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => {
                          setSelectedIds(new Set([email.id]));
                          setShowDeleteConfirm(true);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lapozás */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {data.total.toLocaleString()} email, {page}/{data.totalPages} oldal
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                disabled={page >= data.totalPages}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Törlés megerősítés */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Emailek törlése"
          message={`Biztosan törölni szeretnéd a kiválasztott ${selectedIds.size} emailt? Ez a művelet nem vonható vissza!`}
          confirmText="Törlés"
          onConfirm={() => deleteMutation.mutate(Array.from(selectedIds))}
          onCancel={() => setShowDeleteConfirm(false)}
          isLoading={deleteMutation.isPending}
        />
      )}

      {/* Régi emailek törlése megerősítés */}
      {showDeleteOldConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <h3 className="text-lg font-semibold">Régi emailek törlése</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Add meg, hány napnál régebbi emaileket szeretnél törölni:
            </p>
            <input
              type="number"
              value={deleteOldDays}
              onChange={(e) => setDeleteOldDays(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              min="30"
            />
            <p className="text-sm text-gray-500 mb-4">
              Ez törli az összes {deleteOldDays} napnál régebbi emailt. A művelet nem vonható vissza!
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteOldConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Mégse
              </button>
              <button
                onClick={() => deleteOldMutation.mutate(parseInt(deleteOldDays))}
                disabled={deleteOldMutation.isPending}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {deleteOldMutation.isPending ? 'Törlés...' : 'Törlés'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Biztonsági mentések tab
function BackupsTab() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['database-backups'],
    queryFn: () => api.database.listBackups(),
  });

  const createBackupMutation = useMutation({
    mutationFn: () => api.database.createBackup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-backups'] });
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (filename: string) => api.database.deleteBackup(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-backups'] });
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('hu-HU');
  };

  return (
    <div className="space-y-4">
      {/* Új backup létrehozása */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Készíts biztonsági mentést az adatbázisról. A mentések letölthetők és törölhetők.
        </p>
        <button
          onClick={() => createBackupMutation.mutate()}
          disabled={createBackupMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Archive className={`h-4 w-4 ${createBackupMutation.isPending ? 'animate-pulse' : ''}`} />
          {createBackupMutation.isPending ? 'Mentés...' : 'Új biztonsági mentés'}
        </button>
      </div>

      {/* Backup lista */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Betöltés...</div>
      ) : !data || data.backups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Nincs biztonsági mentés</div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Fájlnév</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Létrehozva</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Méret</th>
                <th className="w-24 px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.backups.map((backup) => (
                <tr key={backup.filename} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{backup.filename}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(backup.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatBytes(backup.size)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <a
                        href={api.database.downloadBackupUrl(backup.filename)}
                        download
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Letöltés"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => {
                          if (confirm('Biztosan törlöd ezt a mentést?')) {
                            deleteBackupMutation.mutate(backup.filename);
                          }
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Törlés"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Megerősítő dialógus
function ConfirmDialog({
  title,
  message,
  confirmText,
  onConfirm,
  onCancel,
  isLoading,
}: {
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Mégse
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Törlés...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
