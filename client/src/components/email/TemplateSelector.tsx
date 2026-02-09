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
        className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
      >
        <FileText className="h-4 w-4" />
        <span>Sablonok</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Háttér kattintás bezáráshoz */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute top-full left-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {templates.length === 0 ? (
              <div className="dark:text-dark-text-muted p-4 text-center text-sm text-gray-500">
                <p className="mb-2">Még nincsenek sablonok</p>
                {onManage && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onManage();
                    }}
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
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
                      className="dark:hover:bg-dark-bg-tertiary dark:border-dark-border w-full border-b border-gray-100 px-3 py-2 text-left transition-colors last:border-0 hover:bg-gray-50"
                    >
                      <div className="dark:text-dark-text text-sm font-medium text-gray-900">
                        {template.name}
                      </div>
                      {template.subject && (
                        <div className="dark:text-dark-text-secondary mt-0.5 truncate text-xs text-gray-500">
                          Tárgy: {template.subject}
                        </div>
                      )}
                      <div className="dark:text-dark-text-muted mt-0.5 truncate text-xs text-gray-400">
                        {template.body.substring(0, 50)}
                        {template.body.length > 50 ? '...' : ''}
                      </div>
                    </button>
                  ))}
                </div>

                {onManage && (
                  <div className="dark:border-dark-border border-t border-gray-200 p-2">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onManage();
                      }}
                      className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
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
