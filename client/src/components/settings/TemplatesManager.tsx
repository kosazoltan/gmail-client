import { useState } from 'react';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '../../hooks/useTemplates';
import { X, Plus, Edit2, Trash2, FileText, Loader2 } from 'lucide-react';
import type { Template } from '../../types';

interface TemplatesManagerProps {
  onClose: () => void;
}

export function TemplatesManager({ onClose }: TemplatesManagerProps) {
  const { data: templatesData, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formShortcut, setFormShortcut] = useState('');

  const templates = templatesData?.templates || [];

  const resetForm = () => {
    setFormName('');
    setFormSubject('');
    setFormBody('');
    setFormShortcut('');
    setEditingTemplate(null);
    setIsCreating(false);
  };

  const startEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormSubject(template.subject || '');
    setFormBody(template.body);
    setFormShortcut(template.shortcut || '');
    setIsCreating(false);
  };

  const startCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formBody.trim()) return;

    if (editingTemplate) {
      updateTemplate.mutate(
        {
          id: editingTemplate.id,
          data: {
            name: formName.trim(),
            subject: formSubject.trim() || undefined,
            body: formBody.trim(),
            shortcut: formShortcut.trim() || undefined,
          },
        },
        { onSuccess: resetForm },
      );
    } else {
      createTemplate.mutate(
        {
          name: formName.trim(),
          subject: formSubject.trim() || undefined,
          body: formBody.trim(),
          shortcut: formShortcut.trim() || undefined,
        },
        { onSuccess: resetForm },
      );
    }
  };

  const handleDelete = (id: string) => {
    deleteTemplate.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="dark:bg-dark-bg-secondary flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Fejléc */}
        <div className="dark:border-dark-border flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-500" />
            <h2 className="dark:text-dark-text text-lg font-semibold text-gray-900">
              Sablonok kezelése
            </h2>
          </div>
          <button
            onClick={onClose}
            className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tartalom */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Sablon lista */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="dark:text-dark-text-secondary font-medium text-gray-700">
                  Meglévő sablonok
                </h3>
                <button
                  onClick={startCreate}
                  className="flex items-center gap-1 text-sm text-[#4f6ef7] hover:underline dark:text-blue-400"
                >
                  <Plus className="h-4 w-4" />
                  Új sablon
                </button>
              </div>

              {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : templates.length === 0 ? (
                <div className="dark:text-dark-text-muted py-8 text-center text-gray-400">
                  <FileText className="mx-auto mb-2 h-10 w-10 opacity-50" />
                  <p className="text-sm">Még nincsenek sablonok</p>
                </div>
              ) : (
                <div className="max-h-80 space-y-2 overflow-auto">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        editingTemplate?.id === template.id
                          ? 'border-blue-300 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10'
                          : 'dark:border-dark-border border-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="dark:text-dark-text text-sm font-medium text-gray-900">
                            {template.name}
                          </div>
                          {template.subject && (
                            <div className="dark:text-dark-text-secondary truncate text-xs text-gray-500">
                              Tárgy: {template.subject}
                            </div>
                          )}
                          <div className="dark:text-dark-text-muted mt-1 truncate text-xs text-gray-400">
                            {template.body.substring(0, 60)}
                            {template.body.length > 60 ? '...' : ''}
                          </div>
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-1">
                          <button
                            onClick={() => startEdit(template)}
                            className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded p-1.5 text-gray-500 hover:bg-gray-100"
                            title="Szerkesztés"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(template.id)}
                            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                            title="Törlés"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Törlés megerősítés */}
                      {deleteConfirmId === template.id && (
                        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 dark:border-red-500/30 dark:bg-red-500/10">
                          <p className="mb-2 text-xs text-red-600 dark:text-red-400">
                            Biztosan törlöd ezt a sablont?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(template.id)}
                              disabled={deleteTemplate.isPending}
                              className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                            >
                              Igen, törlöm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="dark:bg-dark-bg-tertiary dark:text-dark-text dark:hover:bg-dark-bg rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                            >
                              Mégse
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Szerkesztő / Létrehozó form */}
            {(isCreating || editingTemplate) && (
              <div className="space-y-4">
                <h3 className="dark:text-dark-text-secondary font-medium text-gray-700">
                  {editingTemplate ? 'Sablon szerkesztése' : 'Új sablon'}
                </h3>

                <div>
                  <label className="dark:text-dark-text-secondary mb-1 block text-sm text-gray-600">
                    Sablon neve *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="pl. Köszönő válasz"
                    className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-300 dark:focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="dark:text-dark-text-secondary mb-1 block text-sm text-gray-600">
                    Tárgy (opcionális)
                  </label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="Levél tárgya"
                    className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-300 dark:focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="dark:text-dark-text-secondary mb-1 block text-sm text-gray-600">
                    Sablon szövege *
                  </label>
                  <textarea
                    value={formBody}
                    onChange={(e) => setFormBody(e.target.value)}
                    placeholder="Írd ide a sablon szövegét..."
                    rows={6}
                    className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-300 dark:focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={!formName.trim() || !formBody.trim() || isSaving}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#4f6ef7] px-4 py-2 text-white transition-colors hover:bg-[#3d5ce5] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingTemplate ? 'Mentés' : 'Létrehozás'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary rounded-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    Mégse
                  </button>
                </div>
              </div>
            )}

            {/* Üres állapot - nincs szerkesztés */}
            {!isCreating && !editingTemplate && templates.length > 0 && (
              <div className="dark:text-dark-text-muted flex h-64 items-center justify-center text-gray-400">
                <div className="text-center">
                  <Edit2 className="mx-auto mb-2 h-10 w-10 opacity-50" />
                  <p className="text-sm">Válassz egy sablont a szerkesztéshez</p>
                  <p className="text-xs">vagy hozz létre egy újat</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lábléc */}
        <div className="dark:bg-dark-bg-tertiary dark:border-dark-border border-t border-gray-200 bg-gray-50 px-6 py-3">
          <p className="dark:text-dark-text-muted text-center text-xs text-gray-400">
            A sablonok segítségével gyorsan beszúrhatsz előre megírt szövegeket a leveleidbe.
          </p>
        </div>
      </div>
    </div>
  );
}
