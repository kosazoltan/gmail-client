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
    <div className="mx-auto max-w-6xl p-6">
      <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Fejléc */}
        <div className="dark:border-dark-border flex items-center gap-3 border-b border-gray-200 px-6 py-4">
          <Database className="h-6 w-6 text-blue-600" />
          <h1 className="dark:text-dark-text text-xl font-semibold text-gray-800">
            Adatbázis kezelő
          </h1>
        </div>

        {/* Tabok */}
        <div className="dark:border-dark-border flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'stats'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'dark:text-dark-text-secondary dark:hover:text-dark-text text-gray-500 hover:text-gray-700'
            }`}
          >
            Statisztikák
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'emails'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'dark:text-dark-text-secondary dark:hover:text-dark-text text-gray-500 hover:text-gray-700'
            }`}
          >
            Emailek kezelése
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'backups'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'dark:text-dark-text-secondary dark:hover:text-dark-text text-gray-500 hover:text-gray-700'
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
  const [showResyncConfirm, setShowResyncConfirm] = useState(false);
  const [resyncAccountId, setResyncAccountId] = useState<string | null>(null);

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

  const resyncMutation = useMutation({
    mutationFn: (accountId: string) => api.accounts.resync(accountId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setShowResyncConfirm(false);
      setResyncAccountId(null);
      alert(`Újraszinkronizálás kész! ${data.messagesProcessed} email feldolgozva.`);
    },
    onError: (error) => {
      alert(`Hiba történt: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`);
    },
  });

  const fixEncodingMutation = useMutation({
    mutationFn: () => api.contacts.fixEncoding(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-infinite'] });
      alert(data.message);
    },
    onError: (error) => {
      alert(`Hiba történt: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`);
    },
  });

  if (isLoading) {
    return (
      <div className="dark:text-dark-text-secondary py-8 text-center text-gray-500">
        Betöltés...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dark:text-dark-text-secondary py-8 text-center text-gray-500">Nincs adat</div>
    );
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Mail} label="Emailek" value={stats.totalEmails.toLocaleString()} />
        <StatCard
          icon={Paperclip}
          label="Csatolmányok"
          value={stats.totalAttachments.toLocaleString()}
        />
        <StatCard
          icon={HardDrive}
          label="Adatbázis méret"
          value={formatBytes(stats.databaseSizeBytes)}
        />
        <StatCard icon={Database} label="Kontaktok" value={stats.totalContacts.toLocaleString()} />
      </div>

      {/* Időszak */}
      <div className="dark:bg-dark-bg-tertiary rounded-lg bg-gray-50 p-4">
        <h3 className="dark:text-dark-text mb-2 text-sm font-medium text-gray-700">
          Email időszak
        </h3>
        <p className="dark:text-dark-text-secondary text-sm text-gray-600">
          {formatDate(stats.oldestEmail)} - {formatDate(stats.newestEmail)}
        </p>
      </div>

      {/* Fiókonkénti statisztika */}
      {stats.emailsByAccount.length > 0 && (
        <div className="dark:bg-dark-bg-tertiary rounded-lg bg-gray-50 p-4">
          <h3 className="dark:text-dark-text mb-3 text-sm font-medium text-gray-700">
            Emailek fiókonként
          </h3>
          <div className="space-y-2">
            {stats.emailsByAccount.map((account) => (
              <div key={account.accountId} className="flex items-center justify-between text-sm">
                <span className="dark:text-dark-text-secondary text-gray-600">{account.email}</span>
                <div className="flex items-center gap-3">
                  <span className="dark:text-dark-text font-medium">
                    {account.count.toLocaleString()}
                  </span>
                  <button
                    onClick={() => {
                      setResyncAccountId(account.accountId);
                      setShowResyncConfirm(true);
                    }}
                    className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20"
                    title="Teljes újraszinkronizálás (karakterkódolás javítása)"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Karbantartás */}
      <div className="dark:bg-dark-bg-tertiary rounded-lg bg-gray-50 p-4">
        <h3 className="dark:text-dark-text mb-3 text-sm font-medium text-gray-700">Karbantartás</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => vacuumMutation.mutate()}
            disabled={vacuumMutation.isPending}
            className="dark:bg-dark-bg-secondary dark:border-dark-border dark:hover:bg-dark-bg dark:text-dark-text flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${vacuumMutation.isPending ? 'animate-spin' : ''}`} />
            Adatbázis tömörítés
          </button>
          <button
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
            className="dark:bg-dark-bg-secondary dark:border-dark-border dark:hover:bg-dark-bg dark:text-dark-text flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Árva rekordok törlése
          </button>
          <button
            onClick={() => fixEncodingMutation.mutate()}
            disabled={fixEncodingMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
            title="Magyar ékezetes karakterek javítása a kontaktok és emailek neveiben"
          >
            <RefreshCw
              className={`h-4 w-4 ${fixEncodingMutation.isPending ? 'animate-spin' : ''}`}
            />
            Karakterkódolás javítása
          </button>
        </div>
      </div>

      {/* Újraszinkronizálás megerősítése */}
      {showResyncConfirm && resyncAccountId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border mx-4 w-full max-w-md rounded-xl bg-white p-6 dark:border">
            <div className="mb-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <h3 className="dark:text-dark-text text-lg font-semibold">
                Teljes újraszinkronizálás
              </h3>
            </div>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-600">
              Ez a művelet törli az összes emailt, kontaktot és kapcsolódó adatot ehhez a fiókhoz,
              majd újraszinkronizálja a Gmail-ből.
            </p>
            <p className="dark:text-dark-text-muted mb-4 text-sm text-gray-500">
              Használd ezt, ha a karakterkódolás nem megfelelő a nevek megjelenítésénél.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowResyncConfirm(false);
                  setResyncAccountId(null);
                }}
                className="dark:text-dark-text-secondary dark:hover:text-dark-text px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Mégse
              </button>
              <button
                onClick={() => resyncMutation.mutate(resyncAccountId)}
                disabled={resyncMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${resyncMutation.isPending ? 'animate-spin' : ''}`}
                />
                {resyncMutation.isPending ? 'Szinkronizálás...' : 'Újraszinkronizálás'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="dark:bg-dark-bg-tertiary rounded-lg bg-gray-50 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="dark:text-dark-text-muted h-4 w-4 text-gray-400" />
        <span className="dark:text-dark-text-secondary text-xs text-gray-500">{label}</span>
      </div>
      <p className="dark:text-dark-text text-xl font-semibold text-gray-800">{value}</p>
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
        <div className="min-w-[200px] flex-1">
          <div className="relative">
            <Search className="dark:text-dark-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Keresés..."
              className="dark:border-dark-border dark:bg-dark-bg-tertiary dark:text-dark-text w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-sm"
            />
          </div>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'from' | 'subject' | 'size')}
          className="dark:border-dark-border dark:bg-dark-bg-tertiary dark:text-dark-text rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="date">Dátum</option>
          <option value="from">Feladó</option>
          <option value="subject">Tárgy</option>
          <option value="size">Méret</option>
        </select>

        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="dark:border-dark-border dark:text-dark-text rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {sortOrder === 'desc' ? '↓ Csökkenő' : '↑ Növekvő'}
        </button>

        {selectedIds.size > 0 && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Törlés ({selectedIds.size})
          </button>
        )}

        <button
          onClick={() => setShowDeleteOldConfirm(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700"
        >
          <Calendar className="h-4 w-4" />
          Régi emailek törlése
        </button>
      </div>

      {/* Táblázat */}
      {isLoading ? (
        <div className="dark:text-dark-text-secondary py-8 text-center text-gray-500">
          Betöltés...
        </div>
      ) : !data || data.emails.length === 0 ? (
        <div className="dark:text-dark-text-secondary py-8 text-center text-gray-500">
          Nincs email
        </div>
      ) : (
        <>
          <div className="dark:border-dark-border overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="dark:bg-dark-bg-tertiary bg-gray-50">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === data.emails.length && data.emails.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="dark:text-dark-text-secondary px-3 py-2 text-left font-medium text-gray-600">
                    Feladó
                  </th>
                  <th className="dark:text-dark-text-secondary px-3 py-2 text-left font-medium text-gray-600">
                    Tárgy
                  </th>
                  <th className="dark:text-dark-text-secondary px-3 py-2 text-left font-medium text-gray-600">
                    Dátum
                  </th>
                  <th className="dark:text-dark-text-secondary px-3 py-2 text-left font-medium text-gray-600">
                    Méret
                  </th>
                  <th className="w-16 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="dark:divide-dark-border divide-y divide-gray-200">
                {data.emails.map((email) => (
                  <tr
                    key={email.id}
                    className={
                      selectedIds.has(email.id)
                        ? 'bg-blue-50 dark:bg-blue-500/20'
                        : 'dark:hover:bg-dark-bg-tertiary hover:bg-gray-50'
                    }
                  >
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
                          <MailOpen className="dark:text-dark-text-muted h-4 w-4 text-gray-400" />
                        ) : (
                          <Mail className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="dark:text-dark-text max-w-[200px] truncate">
                          {email.from_name || email.from_email || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="dark:text-dark-text max-w-[300px] truncate">
                          {email.subject || '(nincs tárgy)'}
                        </span>
                        {email.has_attachments === 1 && (
                          <Paperclip className="dark:text-dark-text-muted h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="dark:text-dark-text-secondary px-3 py-2 text-gray-600">
                      {formatDate(email.date)}
                    </td>
                    <td className="dark:text-dark-text-secondary px-3 py-2 text-gray-600">
                      {formatSize(email.body_size)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => {
                          setSelectedIds(new Set([email.id]));
                          setShowDeleteConfirm(true);
                        }}
                        className="dark:text-dark-text-muted p-1 text-gray-400 hover:text-red-500"
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
            <span className="dark:text-dark-text-secondary text-sm text-gray-600">
              {data.total.toLocaleString()} email, {page}/{data.totalPages} oldal
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="dark:border-dark-border dark:text-dark-text rounded-lg border border-gray-300 p-2 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                disabled={page >= data.totalPages}
                className="dark:border-dark-border dark:text-dark-text rounded-lg border border-gray-300 p-2 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border mx-4 w-full max-w-md rounded-xl bg-white p-6 dark:border">
            <div className="mb-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <h3 className="dark:text-dark-text text-lg font-semibold">Régi emailek törlése</h3>
            </div>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-600">
              Add meg, hány napnál régebbi emaileket szeretnél törölni:
            </p>
            <input
              type="number"
              value={deleteOldDays}
              onChange={(e) => setDeleteOldDays(e.target.value)}
              className="dark:border-dark-border dark:bg-dark-bg-tertiary dark:text-dark-text mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              min="30"
            />
            <p className="dark:text-dark-text-muted mb-4 text-sm text-gray-500">
              Ez törli az összes {deleteOldDays} napnál régebbi emailt. A művelet nem vonható
              vissza!
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteOldConfirm(false)}
                className="dark:text-dark-text-secondary dark:hover:text-dark-text px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Mégse
              </button>
              <button
                onClick={() => deleteOldMutation.mutate(parseInt(deleteOldDays, 10))}
                disabled={deleteOldMutation.isPending}
                className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
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
  const { data, isLoading } = useQuery({
    queryKey: ['database-backups'],
    queryFn: () => api.database.listBackups(),
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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        A jelenlegi Neon PostgreSQL környezetben a biztonsági mentéseket a platform kezeli, ezért a
        fájlos backup létrehozás, letöltés és törlés itt nem érhető el.
      </div>

      {/* Backup lista */}
      {isLoading ? (
        <div className="dark:text-dark-text-secondary py-8 text-center text-gray-500">
          Betöltés...
        </div>
      ) : !data || data.backups.length === 0 ? (
        <div className="dark:text-dark-text-secondary py-8 text-center text-gray-500">
          Nincs biztonsági mentés
        </div>
      ) : (
        <div className="dark:border-dark-border overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="dark:bg-dark-bg-tertiary bg-gray-50">
              <tr>
                <th className="dark:text-dark-text-secondary px-4 py-2 text-left font-medium text-gray-600">
                  Fájlnév
                </th>
                <th className="dark:text-dark-text-secondary px-4 py-2 text-left font-medium text-gray-600">
                  Létrehozva
                </th>
                <th className="dark:text-dark-text-secondary px-4 py-2 text-left font-medium text-gray-600">
                  Méret
                </th>
                <th className="w-24 px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="dark:divide-dark-border divide-y divide-gray-200">
              {data.backups.map((backup) => (
                <tr
                  key={backup.filename}
                  className="dark:hover:bg-dark-bg-tertiary hover:bg-gray-50"
                >
                  <td className="dark:text-dark-text px-4 py-3 font-mono text-xs">
                    {backup.filename}
                  </td>
                  <td className="dark:text-dark-text-secondary px-4 py-3 text-gray-600">
                    {formatDate(backup.createdAt)}
                  </td>
                  <td className="dark:text-dark-text-secondary px-4 py-3 text-gray-600">
                    {formatBytes(backup.size)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400 dark:text-gray-500">Platform kezeli</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="dark:bg-dark-bg-secondary dark:border-dark-border mx-4 w-full max-w-md rounded-xl bg-white p-6 dark:border">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <h3 className="dark:text-dark-text text-lg font-semibold">{title}</h3>
        </div>
        <p className="dark:text-dark-text-secondary mb-6 text-gray-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="dark:text-dark-text-secondary dark:hover:text-dark-text px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Mégse
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Törlés...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
