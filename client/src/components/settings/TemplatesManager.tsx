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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Fejléc */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
              Sablonok kezelése
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tartalom */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sablon lista */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-700 dark:text-dark-text-secondary">
                  Meglévő sablonok
                </h3>
                <button
                  onClick={startCreate}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Új sablon
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-dark-text-muted">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Még nincsenek sablonok</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        editingTemplate?.id === template.id
                          ? 'border-blue-300 dark:border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 dark:text-dark-text">
                            {template.name}
                          </div>
                          {template.subject && (
                            <div className="text-xs text-gray-500 dark:text-dark-text-secondary truncate">
                              Tárgy: {template.subject}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 dark:text-dark-text-muted truncate mt-1">
                            {template.body.substring(0, 60)}
                            {template.body.length > 60 ? '...' : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => startEdit(template)}
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary"
                            title="Szerkesztés"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(template.id)}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                            title="Törlés"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Törlés megerősítés */}
                      {deleteConfirmId === template.id && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-500/10 rounded border border-red-200 dark:border-red-500/30">
                          <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                            Biztosan törlöd ezt a sablont?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(template.id)}
                              disabled={deleteTemplate.isPending}
                              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                            >
                              Igen, törlöm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-bg-tertiary text-gray-700 dark:text-dark-text rounded hover:bg-gray-200 dark:hover:bg-dark-bg"
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
                <h3 className="font-medium text-gray-700 dark:text-dark-text-secondary">
                  {editingTemplate ? 'Sablon szerkesztése' : 'Új sablon'}
                </h3>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-dark-text-secondary mb-1">
                    Sablon neve *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="pl. Köszönő válasz"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:border-blue-300 dark:focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-dark-text-secondary mb-1">
                    Tárgy (opcionális)
                  </label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="Levél tárgya"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:border-blue-300 dark:focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-dark-text-secondary mb-1">
                    Sablon szövege *
                  </label>
                  <textarea
                    value={formBody}
                    onChange={(e) => setFormBody(e.target.value)}
                    placeholder="Írd ide a sablon szövegét..."
                    rows={6}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:border-blue-300 dark:focus:border-blue-500 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={!formName.trim() || !formBody.trim() || isSaving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingTemplate ? 'Mentés' : 'Létrehozás'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
                  >
                    Mégse
                  </button>
                </div>
              </div>
            )}

            {/* Üres állapot - nincs szerkesztés */}
            {!isCreating && !editingTemplate && templates.length > 0 && (
              <div className="flex items-center justify-center h-64 text-gray-400 dark:text-dark-text-muted">
                <div className="text-center">
                  <Edit2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Válassz egy sablont a szerkesztéshez</p>
                  <p className="text-xs">vagy hozz létre egy újat</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lábléc */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-t border-gray-200 dark:border-dark-border">
          <p className="text-xs text-gray-400 dark:text-dark-text-muted text-center">
            A sablonok segítségével gyorsan beszúrhatsz előre megírt szövegeket a leveleidbe.
          </p>
        </div>
      </div>
    </div>
  );
}
