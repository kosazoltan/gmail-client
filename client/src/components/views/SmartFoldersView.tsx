import { useEffect, useState } from 'react';
import {
  useSmartFolders,
  useSmartFolderEmails,
  useCreateSmartFolder,
  useGenerateSmartFolder,
  useClassifyEmails,
} from '../../hooks/useSmartFolders';
import {
  FolderSearch,
  Plus,
  Loader2,
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { toast } from '../../lib/toast';
import type { SmartFolderRule, Email, SmartFolder } from '../../types';

interface SmartFoldersViewProps {
  onEmailSelect?: (emailId: string) => void;
}

const FIELD_LABELS: Partial<Record<SmartFolderRule['field'], string>> = {
  from: 'Feladó',
  to: 'Címzett',
  subject: 'Tárgy',
  labels: 'Címke',
  has_attachments: 'Csatolmány',
  is_read: 'Olvasott',
  date_age_days: 'Kor (napok)',
  subject_or_snippet_keywords: 'Tárgy/előnézet',
  ai_tags_contains: 'AI tag',
  content_semantic: 'Tartalom (kulcsszó+AI)',
  unanswered: 'Megválaszolatlan',
};

const OPERATOR_LABELS: Partial<Record<SmartFolderRule['operator'], string>> = {
  contains: 'tartalmazza',
  equals: 'egyenlő',
  not_contains: 'nem tartalmazza',
  greater_than: 'nagyobb mint',
  less_than: 'kisebb mint',
  contains_any: 'tartalmazza bármelyiket',
};

const EMPTY_ARRAY: SmartFolder[] = [];

export function SmartFoldersView({ onEmailSelect }: SmartFoldersViewProps) {
  const { data: foldersData, isLoading } = useSmartFolders();
  const createMutation = useCreateSmartFolder();
  const generateMutation = useGenerateSmartFolder();
  const classifyMutation = useClassifyEmails();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiDescription, setAIDescription] = useState('');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: emailsData, isLoading: emailsLoading } = useSmartFolderEmails(selectedFolderId, page);

  const folders = foldersData?.folders ?? EMPTY_ARRAY;
  const requestedFolderId = searchParams.get('id');

  useEffect(() => {
    if (isLoading) return;

    if (folders.length === 0) {
      if (selectedFolderId) setSelectedFolderId(null);
      return;
    }

    const resolvedFolderId = folders.find(f => f.id === requestedFolderId)?.id ?? folders[0]?.id;
    if (!resolvedFolderId) return;

    if (selectedFolderId !== resolvedFolderId) {
      setSelectedFolderId(resolvedFolderId);
      setPage(1);
    }

    if (requestedFolderId !== resolvedFolderId) {
      setSearchParams({ id: resolvedFolderId }, { replace: true });
    }
  }, [folders, isLoading, requestedFolderId, selectedFolderId, setSearchParams]);

  // Create modal state
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📁');
  const [newRules, setNewRules] = useState<SmartFolderRule[]>([
    { field: 'subject', operator: 'contains', value: '' },
  ]);

  const handleCreate = () => {
    if (!newName.trim() || newRules.some(r => !r.value.trim())) {
      toast.error('Töltsd ki az összes mezőt');
      return;
    }
    createMutation.mutate(
      { name: newName, rules: newRules, icon: newIcon },
      {
        onSuccess: () => {
          toast.success('Smart folder létrehozva');
          setShowCreateModal(false);
          setNewName('');
          setNewIcon('📁');
          setNewRules([{ field: 'subject', operator: 'contains', value: '' }]);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Hiba történt'),
      },
    );
  };

  const handleAIGenerate = () => {
    if (!aiDescription.trim() || aiDescription.trim().length < 3) {
      toast.error('Adj meg egy leírást (legalább 3 karakter)');
      return;
    }
    generateMutation.mutate(aiDescription.trim(), {
      onSuccess: (data) => {
        const { folder } = data;
        // Auto-create the folder with AI-generated rules
        createMutation.mutate(
          { name: folder.name, rules: folder.rules, icon: folder.icon || '🤖' },
          {
            onSuccess: () => {
              toast.success(`Smart folder "${folder.name}" létrehozva AI segítségével`);
              setShowAIModal(false);
              setAIDescription('');
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : 'Hiba a mappa létrehozásakor'),
          },
        );
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'AI generálás sikertelen'),
    });
  };

  const addRule = () => {
    setNewRules([...newRules, { field: 'subject', operator: 'contains', value: '' }]);
  };

  const removeRule = (index: number) => {
    if (newRules.length > 1) {
      setNewRules(newRules.filter((_, i) => i !== index));
    }
  };

  const updateRule = (index: number, updates: Partial<SmartFolderRule>) => {
    setNewRules(newRules.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  // --- Selected folder email list ---
  if (selectedFolderId) {
    const selectedFolder = folders.find(f => f.id === selectedFolderId);
    const emails = (emailsData?.emails || []) as Email[];
    const totalPages = emailsData?.totalPages || 1;

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <button
            onClick={() => navigate('/inbox')}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5 dark:text-gray-300" />
          </button>
          <span className="text-lg">{selectedFolder?.icon || '📁'}</span>
          <h2 className="text-lg font-semibold dark:text-gray-200">
            {selectedFolder?.name || 'Smart Folder'}
          </h2>
          <span className="text-sm text-gray-500">({emailsData?.total || 0} levél)</span>
        </div>

        <div className="flex-1 overflow-auto">
          {emailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <FolderSearch className="h-12 w-12 mb-3 text-gray-300" />
              <p>Nincs email ebben a mappában</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => onEmailSelect?.(email.id)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                    !email.isRead && 'bg-blue-50/50 dark:bg-blue-500/5',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm truncate', !email.isRead && 'font-semibold dark:text-gray-200')}>
                        {email.fromName || email.from || '(ismeretlen)'}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {new Date(email.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className={cn('text-sm truncate', !email.isRead ? 'text-gray-800 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400')}>
                      {email.subject || '(nincs tárgy)'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{email.snippet}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-gray-200 dark:border-gray-700 px-4 py-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- Folder list ---
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <FolderSearch className="h-5 w-5 text-purple-500" />
          <h2 className="text-lg font-semibold dark:text-gray-200">Smart Folders</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              classifyMutation.mutate(50, {
                onSuccess: (data) => {
                  toast.success(`${data.classified} levél kategorizálva. Még ${data.unclassified} feldolgozatlan.`);
                },
                onError: () => toast.error('AI kategorizálás sikertelen'),
              })
            }
            disabled={classifyMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-violet-400 px-3 py-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors disabled:opacity-50"
            title="Levelek AI kategorizálása a tartalom alapján (Pénzügyi, Jogi stb.)"
          >
            {classifyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AI Kategorizálás
          </button>
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-3 py-2 text-sm font-medium text-white hover:from-violet-600 hover:to-purple-600 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            AI Mappa
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-purple-500 px-3 py-2 text-sm font-medium text-white hover:bg-purple-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Új mappa
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <FolderSearch className="h-12 w-12 mb-3 text-gray-300" />
            <p>Nincsenek smart folderek</p>
            <p className="text-sm">Hozz létre smart foldereket, hogy lásd a leveleket</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Hozz létre smart foldereket
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500 mb-3" />
            <p>Smart folder megnyitása…</p>
          </div>
        )}
      </div>

      {/* AI Generate Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-2xl mx-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                <h3 className="text-lg font-semibold dark:text-gray-200">AI Mappa Generálás</h3>
              </div>
              <button
                onClick={() => { setShowAIModal(false); setAIDescription(''); }}
                className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Írd le milyen mappát szeretnél, és az AI automatikusan generálja a szűrési szabályokat.
              </p>
              <textarea
                value={aiDescription}
                onChange={(e) => setAIDescription(e.target.value)}
                placeholder='pl. "MNB-vel kapcsolatos levelek" vagy "Számlák és fizetési felszólítások"'
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2.5 text-sm dark:text-gray-200 resize-none"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAIGenerate();
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-5 py-4">
              <button
                onClick={() => { setShowAIModal(false); setAIDescription(''); }}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Mégse
              </button>
              <button
                onClick={handleAIGenerate}
                disabled={generateMutation.isPending || createMutation.isPending || aiDescription.trim().length < 3}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-2 text-sm font-medium text-white hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 transition-all"
              >
                {(generateMutation.isPending || createMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <Sparkles className="h-4 w-4" />
                Generálás
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-2xl mx-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h3 className="text-lg font-semibold dark:text-gray-200">Új Smart Folder</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex gap-3">
                <div className="w-16">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ikon</label>
                  <input
                    type="text"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-center text-lg dark:text-gray-200"
                    maxLength={4}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Név</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="pl. Raiffeisen levelek"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm dark:text-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Szabályok</label>
                <div className="space-y-2">
                  {newRules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={rule.field}
                        onChange={(e) => updateRule(i, { field: e.target.value as SmartFolderRule['field'] })}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-2 text-sm dark:text-gray-200"
                      >
                        {Object.entries(FIELD_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <select
                        value={rule.operator}
                        onChange={(e) => updateRule(i, { operator: e.target.value as SmartFolderRule['operator'] })}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-2 text-sm dark:text-gray-200"
                      >
                        {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => updateRule(i, { value: e.target.value })}
                        placeholder="érték"
                        className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm dark:text-gray-200"
                      />
                      {newRules.length > 1 && (
                        <button onClick={() => removeRule(i)} className="text-red-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addRule}
                  className="mt-2 flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Új szabály
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-5 py-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Mégse
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Létrehozás
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
