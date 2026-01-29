import { useState } from 'react';
import { useTemplates, useIncrementTemplateUsage } from '../../hooks/useTemplates';
import { FileText, ChevronDown, Plus, Settings } from 'lucide-react';
import type { Template } from '../../types';

interface TemplateSelectorProps {
  onSelect: (template: Template) => void;
  onManage?: () => void;
}

export function TemplateSelector({ onSelect, onManage }: TemplateSelectorProps) {
  const { data: templatesData, isLoading } = useTemplates();
  const incrementUsage = useIncrementTemplateUsage();
  const [isOpen, setIsOpen] = useState(false);

  const templates = templatesData?.templates || [];

  const handleSelect = (template: Template) => {
    incrementUsage.mutate(template.id);
    onSelect(template);
    setIsOpen(false);
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary text-gray-600 dark:text-dark-text-secondary transition-colors"
      >
        <FileText className="h-4 w-4" />
        <span>Sablonok</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Háttér kattintás bezáráshoz */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-20 overflow-hidden">
            {templates.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-dark-text-muted">
                <p className="mb-2">Még nincsenek sablonok</p>
                {onManage && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onManage();
                    }}
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Sablon létrehozása
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="max-h-64 overflow-auto">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelect(template)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary border-b border-gray-100 dark:border-dark-border last:border-0 transition-colors"
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-dark-text">
                        {template.name}
                      </div>
                      {template.subject && (
                        <div className="text-xs text-gray-500 dark:text-dark-text-secondary truncate mt-0.5">
                          Tárgy: {template.subject}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 dark:text-dark-text-muted truncate mt-0.5">
                        {template.body.substring(0, 50)}
                        {template.body.length > 50 ? '...' : ''}
                      </div>
                    </button>
                  ))}
                </div>

                {onManage && (
                  <div className="border-t border-gray-200 dark:border-dark-border p-2">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onManage();
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Sablonok kezelése
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
