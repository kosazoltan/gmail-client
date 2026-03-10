import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail } from '../../hooks/useEmails';
import { api } from '../../lib/api';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { ResizablePanels } from '../common/ResizablePanels';
import {
  Tags,
  ArrowLeft,
  Loader2,
  Briefcase,
  User,
  Newspaper,
  Bell,
  Wallet,
  Folder,
  Plus,
  Pencil,
  Trash2,
  X,
  FolderPlus,
} from 'lucide-react';
import type { Email, Category } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

const iconMap: Record<string, typeof Briefcase> = {
  briefcase: Briefcase,
  user: User,
  newspaper: Newspaper,
  bell: Bell,
  wallet: Wallet,
  folder: Folder,
};

// Available icons for picker
const ICON_OPTIONS = [
  { value: 'folder', label: '📁' },
  { value: 'briefcase', label: '💼' },
  { value: 'user', label: '👤' },
  { value: 'newspaper', label: '📰' },
  { value: 'bell', label: '🔔' },
  { value: 'wallet', label: '💰' },
];

// Available colors for picker
const COLOR_OPTIONS = [
  '#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

interface CategoryFormData {
  name: string;
  color: string;
  icon: string;
  description: string;
}

function CategoryModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CategoryFormData) => void;
  initialData?: Partial<CategoryFormData>;
  title: string;
}) {
  const [form, setForm] = useState<CategoryFormData>({
    name: initialData?.name || '',
    color: initialData?.color || '#3B82F6',
    icon: initialData?.icon || 'folder',
    description: initialData?.description || '',
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: initialData?.name || '',
        color: initialData?.color || '#3B82F6',
        icon: initialData?.icon || 'folder',
        description: initialData?.description || '',
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="dark:bg-dark-bg-secondary dark:border-dark-border w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="dark:text-dark-text text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="dark:hover:bg-dark-bg-tertiary rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="dark:text-dark-text-secondary mb-1 block text-sm font-medium text-gray-700">
              Név
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Kategória neve..."
              className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="dark:text-dark-text-secondary mb-1 block text-sm font-medium text-gray-700">
              Leírás (opcionális)
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Rövid leírás..."
              className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="dark:text-dark-text-secondary mb-2 block text-sm font-medium text-gray-700">
              Szín
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    form.color === color ? 'scale-110 border-gray-900 dark:border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <label className="dark:text-dark-text-secondary mb-2 block text-sm font-medium text-gray-700">
              Ikon
            </label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setForm((prev) => ({ ...prev, icon: opt.value }))}
                  className={`rounded-lg border px-3 py-2 text-lg transition-all ${
                    form.icon === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
                      : 'dark:border-dark-border border-gray-200 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
                  }`}
                  title={opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="dark:bg-dark-bg-tertiary dark:text-dark-text dark:hover:bg-dark-bg rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Mégse
          </button>
          <button
            onClick={() => {
              if (form.name.trim()) {
                onSave(form);
                onClose();
              }
            }}
            disabled={!form.name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Mentés
          </button>
        </div>
      </div>
    </div>
  );
}

export function CategoryView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const deleteEmail = useDeleteEmail();

  const accountId = session?.activeAccountId || undefined;

  const { data: categoryData, isLoading: loadingCategories } = useQuery({
    queryKey: ['views', 'by-category', accountId],
    queryFn: () => api.views.byCategory(),
    enabled: !!accountId,
  });

  const { data: categoryEmails, isLoading: loadingEmails } = useQuery({
    queryKey: ['views', 'by-category-emails', selectedCategory?.id],
    queryFn: () => api.views.byCategoryEmails(selectedCategory!.id),
    enabled: !!selectedCategory,
  });

  // Mutations
  const createCategory = useMutation({
    mutationFn: (data: CategoryFormData) =>
      api.categories.create({ name: data.name, color: data.color, icon: data.icon, description: data.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views', 'by-category'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CategoryFormData> }) =>
      api.categories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views', 'by-category'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const deleteCategoryMut = useMutation({
    mutationFn: (id: string) => api.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views', 'by-category'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (selectedCategory && deleteConfirmId === selectedCategory.id) {
        setSelectedCategory(null);
        setSelectedEmail(null);
      }
      setDeleteConfirmId(null);
    },
  });

  const removeEmailFromCategory = useMutation({
    mutationFn: ({ categoryId, emailId }: { categoryId: string; emailId: string }) =>
      api.categories.removeEmail(categoryId, emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views', 'by-category-emails', selectedCategory?.id] });
      queryClient.invalidateQueries({ queryKey: ['views', 'by-category'] });
    },
  });

  const categories = categoryData?.categories || [];
  const systemCategories = categories.filter((c) => c.isSystem || c.is_system);
  const userCategories = categories.filter((c) => !c.isSystem && !c.is_system);

  if (!selectedCategory) {
    return (
      <div className="h-full overflow-auto">
        <div className="dark:bg-dark-bg-tertiary dark:border-dark-border flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Tags className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
            <h2 className="dark:text-dark-text text-sm font-medium text-gray-600">Kategóriák</h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Új kategória
          </button>
        </div>

        {loadingCategories ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="p-4">
            {/* System categories */}
            {systemCategories.length > 0 && (
              <>
                <h3 className="dark:text-dark-text-muted mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  Rendszer kategóriák
                </h3>
                <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {systemCategories.map((cat) => {
                    const Icon = iconMap[cat.icon] || Folder;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat)}
                        className="dark:border-dark-border flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4 transition-all hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-500"
                      >
                        <div
                          className="rounded-lg p-2.5"
                          style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="dark:text-dark-text text-sm font-medium text-gray-900">{cat.name}</div>
                          <div className="dark:text-dark-text-muted text-xs text-gray-400">
                            {cat.emailCount || 0} levél
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* User categories */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="dark:text-dark-text-muted text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Saját kategóriák
              </h3>
              {userCategories.length > 0 && (
                <span className="dark:text-dark-text-muted text-xs text-gray-400">
                  {userCategories.length} kategória
                </span>
              )}
            </div>

            {userCategories.length === 0 ? (
              <div className="dark:border-dark-border flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12">
                <FolderPlus className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
                <p className="dark:text-dark-text-secondary mb-1 text-sm font-medium text-gray-600">
                  Még nincs saját kategóriád
                </p>
                <p className="dark:text-dark-text-muted mb-4 text-xs text-gray-400">
                  Hozz létre kategóriákat a leveleid rendszerezéséhez
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Új kategória létrehozása
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {userCategories.map((cat) => {
                  const Icon = iconMap[cat.icon] || Folder;
                  return (
                    <div
                      key={cat.id}
                      className="dark:border-dark-border group relative flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4 transition-all hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-500"
                    >
                      <div
                        onClick={() => setSelectedCategory(cat)}
                        className="flex flex-1 items-center gap-3"
                      >
                        <div
                          className="rounded-lg p-2.5"
                          style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="dark:text-dark-text text-sm font-medium text-gray-900">{cat.name}</div>
                          <div className="dark:text-dark-text-muted text-xs text-gray-400">
                            {cat.emailCount || 0} levél
                            {cat.description && ` · ${cat.description}`}
                          </div>
                        </div>
                      </div>

                      {/* Edit/Delete buttons */}
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategory(cat);
                          }}
                          className="dark:hover:bg-dark-bg-tertiary rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                          title="Szerkesztés"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {deleteConfirmId === cat.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCategoryMut.mutate(cat.id);
                              }}
                              className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                            >
                              Törlés
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(null);
                              }}
                              className="dark:bg-dark-bg-tertiary rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                            >
                              Mégse
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(cat.id);
                            }}
                            className="dark:hover:bg-dark-bg-tertiary rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                            title="Törlés"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create Modal */}
        <CategoryModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={(data) => createCategory.mutate(data)}
          title="Új kategória létrehozása"
        />

        {/* Edit Modal */}
        <CategoryModal
          isOpen={!!editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={(data) => {
            if (editingCategory) {
              updateCategory.mutate({ id: editingCategory.id, data });
            }
          }}
          initialData={editingCategory ? {
            name: editingCategory.name,
            color: editingCategory.color,
            icon: editingCategory.icon,
            description: editingCategory.description || '',
          } : undefined}
          title="Kategória szerkesztése"
        />
      </div>
    );
  }

  const emails = categoryEmails?.emails || [];
  const isUserCategory = !selectedCategory.isSystem && !selectedCategory.is_system;

  // Ref a friss emails lista eléréséhez (stale closure fix)
  const emailsRef = useRef(emails);
  useEffect(() => {
    emailsRef.current = emails;
  }, [emails]);

  const handleRemoveFromCategory = useCallback(
    (emailId: string) => {
      if (selectedCategory) {
        removeEmailFromCategory.mutate({ categoryId: selectedCategory.id, emailId });
        if (selectedEmail?.id === emailId) {
          const nextEmail = getNextEmailAfterDelete(emailsRef.current, emailId);
          setSelectedEmail(nextEmail);
        }
      }
    },
    [selectedCategory, selectedEmail, removeEmailFromCategory],
  );

  const leftPanel = (
    <>
      <div className="dark:bg-dark-bg-tertiary dark:border-dark-border flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <button
          onClick={() => {
            setSelectedCategory(null);
            setSelectedEmail(null);
          }}
          className="dark:hover:bg-dark-bg touch-manipulation rounded-lg p-2.5 hover:bg-gray-200"
          aria-label="Vissza"
        >
          <ArrowLeft className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
        </button>
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
        <span className="dark:text-dark-text text-sm font-medium text-gray-600">
          {selectedCategory.name}
        </span>
        {isUserCategory && (
          <span className="dark:bg-dark-bg dark:text-dark-text-muted ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            Saját
          </span>
        )}
      </div>
      <EmailList
        emails={emails}
        isLoading={loadingEmails}
        selectedEmailId={selectedEmail?.id || null}
        onSelectEmail={setSelectedEmail}
        onDeleteEmail={(emailId) => {
          if (isUserCategory) {
            // For user categories, remove from category instead of deleting
            handleRemoveFromCategory(emailId);
          } else {
            deleteEmail.mutate({ emailId }, {
              onSuccess: () => {
                if (selectedEmail?.id === emailId) {
                  const nextEmail = getNextEmailAfterDelete(emailsRef.current, emailId);
                  setSelectedEmail(nextEmail);
                }
              },
            });
          }
        }}
        emptyMessage="Nincsenek levelek ebben a kategóriában"
      />
    </>
  );

  const rightPanel = (
    <EmailDetail
      emailId={selectedEmail?.id || null}
      accountId={accountId}
      onBack={() => setSelectedEmail(null)}
      onReply={({ to, subject, threadId, body, fromName, date }) => {
        const originalBody = body || '';
        const replyBody = `\n\n─────────────────────────\nDátum: ${date ? new Date(date).toLocaleString('hu-HU') : ''}\nFeladó: ${fromName || to}\n\n${originalBody}`;
        navigate(
          `/compose?reply=true&to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}${threadId ? `&threadId=${threadId}` : ''}&body=${encodeURIComponent(replyBody)}`,
        );
      }}
      onForward={({ subject, body }) => {
        navigate(
          `/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        );
      }}
    />
  );

  return (
    <ResizablePanels
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      rightPanelActive={!!selectedEmail}
      storageKey="category-list-width"
    />
  );
}
