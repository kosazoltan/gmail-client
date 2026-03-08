import { useState, useEffect, useCallback } from 'react';
import {
  Workflow,
  Plus,
  Trash2,
  Play,
  Save,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Power,
  PowerOff,
  Loader2,
  Clock,
  Filter,
  Bot,
  Tag,
  Forward,
  FileText,
  Scissors,
  Bell,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { API_BASE } from '../../lib/api';
import type {
  WorkflowTriggerType as TriggerType,
  WorkflowStepType as StepType,
  WorkflowStep,
  WorkflowData,
} from '../../types';

// --- Types ---

interface RunLogEntry {
  id: string;
  workflowId: string;
  accountId: string;
  status: 'running' | 'completed' | 'failed';
  triggerEmailId: string | null;
  stepsCompleted: number;
  result: Record<string, unknown>;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
}

// --- Constants ---

const STEP_META: Record<StepType, { label: string; icon: typeof Filter; color: string; description: string }> = {
  filter: { label: 'Szűrés', icon: Filter, color: 'text-blue-500', description: 'Emailek szűrése feltételek alapján' },
  ai_analyze: { label: 'AI Elemzés', icon: Bot, color: 'text-purple-500', description: 'AI-alapú email elemzés' },
  categorize: { label: 'Kategorizálás', icon: Tag, color: 'text-green-500', description: 'Automatikus kategória hozzárendelés' },
  label: { label: 'Címkézés', icon: Tag, color: 'text-yellow-500', description: 'Címke hozzáadása' },
  forward: { label: 'Továbbítás', icon: Forward, color: 'text-orange-500', description: 'Email továbbítása' },
  summarize: { label: 'Összefoglalás', icon: FileText, color: 'text-indigo-500', description: 'Email tartalom összefoglalása' },
  extract: { label: 'Kinyerés', icon: Scissors, color: 'text-pink-500', description: 'Adatok kinyerése emailből' },
  notify: { label: 'Értesítés', icon: Bell, color: 'text-red-500', description: 'Értesítés küldése' },
  group: { label: 'Csoportosítás', icon: Filter, color: 'text-teal-500', description: 'Emailek csoportosítása mező alapján' },
  save_report: { label: 'Riport mentés', icon: FileText, color: 'text-emerald-500', description: 'Eredmény mentése riportként' },
  ai_reply: { label: 'AI Válasz', icon: Bot, color: 'text-violet-500', description: 'AI-alapú válasz tervezet készítése' },
  condition: { label: 'Feltétel', icon: AlertCircle, color: 'text-amber-500', description: 'Feltételes elágazás' },
};

const TRIGGER_META: Record<TriggerType, { label: string; icon: typeof Clock }> = {
  new_email: { label: 'Új email érkezésekor', icon: Forward },
  schedule: { label: 'Ütemezett', icon: Clock },
  manual: { label: 'Kézi indítás', icon: Play },
};

// --- Helper ---

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Component ---

export function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [selected, setSelected] = useState<WorkflowData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<RunLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Fetch workflows
  const loadWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ workflows: WorkflowData[] }>('/workflows');
      setWorkflows(data.workflows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba a workflow-k betöltésekor');
      setWorkflows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // New workflow
  const handleNew = () => {
    const newWf: WorkflowData = {
      name: 'Új Workflow',
      triggerType: 'new_email',
      triggerConfig: {},
      steps: [],
      isActive: false,
    };
    setSelected(newWf);
    setShowLogs(false);
  };

  // Save
  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    setError(null);
    try {
      if (selected.id) {
        const updated = await apiFetch<{ workflow: WorkflowData }>(`/workflows/${selected.id}`, {
          method: 'PUT',
          body: JSON.stringify(selected),
        });
        setWorkflows((prev) => prev.map((w) => (w.id === selected.id ? updated.workflow : w)));
        setSelected(updated.workflow);
      } else {
        const created = await apiFetch<{ workflow: WorkflowData }>('/workflows', {
          method: 'POST',
          body: JSON.stringify(selected),
        });
        setWorkflows((prev) => [...prev, created.workflow]);
        setSelected(created.workflow);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mentési hiba');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/workflows/${id}`, { method: 'DELETE' });
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Törlési hiba');
    }
  };

  // Toggle active
  const handleToggleActive = async (wf: WorkflowData) => {
    if (!wf.id) return;
    try {
      const updated = await apiFetch<{ workflow: WorkflowData }>(`/workflows/${wf.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...wf, isActive: !wf.isActive }),
      });
      setWorkflows((prev) => prev.map((w) => (w.id === wf.id ? updated.workflow : w)));
      if (selected?.id === wf.id) setSelected(updated.workflow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktiválási hiba');
    }
  };

  // Run
  const handleRun = async (id: string) => {
    try {
      await apiFetch(`/workflows/${id}/run`, { method: 'POST' });
      loadLogs(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Futtatási hiba');
    }
  };

  // Load logs
  const loadLogs = async (id: string) => {
    try {
      const data = await apiFetch<{ runs: RunLogEntry[] }>(`/workflows/${id}/runs`);
      setRunLogs(data.runs || []);
      setShowLogs(true);
    } catch {
      setRunLogs([]);
      setShowLogs(true);
    }
  };

  // Add step
  const handleAddStep = (type: StepType) => {
    if (!selected) return;
    const step: WorkflowStep = {
      id: crypto.randomUUID(),
      type,
      config: {},
    };
    setSelected({ ...selected, steps: [...selected.steps, step] });
  };

  // Remove step
  const handleRemoveStep = (stepId: string) => {
    if (!selected) return;
    setSelected({ ...selected, steps: selected.steps.filter((s) => s.id !== stepId) });
  };

  // Move step
  const handleMoveStep = (fromIdx: number, toIdx: number) => {
    if (!selected) return;
    const steps = [...selected.steps];
    const [moved] = steps.splice(fromIdx, 1);
    steps.splice(toIdx, 0, moved);
    setSelected({ ...selected, steps });
  };

  // Update step config
  const handleStepConfigChange = (stepId: string, key: string, value: string) => {
    if (!selected) return;
    setSelected({
      ...selected,
      steps: selected.steps.map((s) =>
        s.id === stepId ? { ...s, config: { ...s.config, [key]: value } } : s,
      ),
    });
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="dark:text-dark-text flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Workflow className="h-7 w-7 text-[#4f6ef7]" />
            Workflow Builder
          </h1>
          <p className="dark:text-dark-text-secondary mt-1 text-sm text-gray-500">
            Automatizáld az email feldolgozást vizuális workflow-kkal
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 rounded-xl bg-[#4f6ef7] px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#3d5ce5]"
        >
          <Plus className="h-4 w-4" />
          Új Workflow
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Workflow list */}
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="dark:text-dark-text mb-3 text-sm font-semibold text-gray-800">Workflow-k</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#4f6ef7]" />
            </div>
          ) : workflows.length === 0 ? (
            <p className="dark:text-dark-text-muted py-8 text-center text-sm text-gray-400">
              Még nincs workflow. Hozz létre egyet!
            </p>
          ) : (
            <div className="space-y-2">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => { setSelected(wf); setShowLogs(false); }}
                  className={cn(
                    'dark:border-dark-border dark:hover:bg-dark-bg-tertiary cursor-pointer rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50',
                    selected?.id === wf.id && 'border-[#4f6ef7]/30 bg-[#4f6ef7]/5 dark:border-[#4f6ef7]/20 dark:bg-[#4f6ef7]/5',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="dark:text-dark-text text-sm font-medium text-gray-800">
                      {wf.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {wf.isActive ? (
                        <Power className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <PowerOff className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="dark:text-dark-text-muted text-xs text-gray-400">
                      {TRIGGER_META[wf.triggerType]?.label || wf.triggerType}
                    </span>
                    <span className="dark:text-dark-text-muted text-xs text-gray-300">•</span>
                    <span className="dark:text-dark-text-muted text-xs text-gray-400">
                      {wf.steps.length} lépés
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); if (wf.id) handleRun(wf.id); }}
                      className="rounded bg-green-50 p-1 text-green-600 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
                      title="Futtatás"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (wf.id) loadLogs(wf.id); }}
                      className="rounded bg-blue-50 p-1 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
                      title="Napló"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(wf); }}
                      className="rounded bg-gray-50 p-1 text-gray-600 hover:bg-gray-100 dark:bg-gray-500/10 dark:text-gray-400 dark:hover:bg-gray-500/20"
                      title={wf.isActive ? 'Deaktiválás' : 'Aktiválás'}
                    >
                      {wf.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (wf.id) handleDelete(wf.id); }}
                      className="rounded bg-red-50 p-1 text-red-500 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                      title="Törlés"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5">
              {/* Name & trigger */}
              <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="dark:text-dark-text-secondary mb-1 block text-xs font-medium text-gray-600">
                    Workflow neve
                  </label>
                  <input
                    type="text"
                    value={selected.name}
                    onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                    className="dark:border-dark-border dark:bg-dark-bg-tertiary dark:text-dark-text w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
                  />
                </div>
                <div>
                  <label className="dark:text-dark-text-secondary mb-1 block text-xs font-medium text-gray-600">
                    Trigger
                  </label>
                  <select
                    value={selected.triggerType}
                    onChange={(e) => setSelected({ ...selected, triggerType: e.target.value as TriggerType })}
                    className="dark:border-dark-border dark:bg-dark-bg-tertiary dark:text-dark-text w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
                  >
                    {(Object.entries(TRIGGER_META) as [TriggerType, typeof TRIGGER_META[TriggerType]][]).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Schedule config */}
              {selected.triggerType === 'schedule' && (
                <div className="mb-5">
                  <label className="dark:text-dark-text-secondary mb-1 block text-xs font-medium text-gray-600">
                    Cron kifejezés (pl. 0 9 * * *)
                  </label>
                  <input
                    type="text"
                    value={selected.triggerConfig.cron || ''}
                    onChange={(e) =>
                      setSelected({ ...selected, triggerConfig: { ...selected.triggerConfig, cron: e.target.value } })
                    }
                    placeholder="0 9 * * *"
                    className="dark:border-dark-border dark:bg-dark-bg-tertiary dark:text-dark-text w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
                  />
                </div>
              )}

              {/* Steps */}
              <div className="mb-4">
                <h3 className="dark:text-dark-text mb-3 text-sm font-semibold text-gray-800">
                  Lépések ({selected.steps.length})
                </h3>

                {selected.steps.length === 0 ? (
                  <div className="dark:border-dark-border dark:text-dark-text-muted rounded-lg border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                    Adj hozzá lépéseket az alábbi gombokkal
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selected.steps.map((step, idx) => {
                      const meta = STEP_META[step.type];
                      const Icon = meta.icon;
                      return (
                        <div
                          key={step.id}
                          draggable
                          onDragStart={() => setDragIdx(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragIdx !== null && dragIdx !== idx) handleMoveStep(dragIdx, idx);
                            setDragIdx(null);
                          }}
                          className={cn(
                            'dark:border-dark-border dark:bg-dark-bg-tertiary rounded-lg border border-gray-100 bg-gray-50 p-3',
                            dragIdx === idx && 'opacity-50',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 cursor-grab text-gray-300" />
                            <span className="dark:text-dark-text-muted text-xs font-bold text-gray-400">
                              {idx + 1}.
                            </span>
                            <Icon className={cn('h-4 w-4', meta.color)} />
                            <span className="dark:text-dark-text text-sm font-medium text-gray-700">
                              {meta.label}
                            </span>
                            <span className="dark:text-dark-text-muted ml-1 text-xs text-gray-400">
                              — {meta.description}
                            </span>
                            <div className="ml-auto flex gap-1">
                              {idx > 0 && (
                                <button onClick={() => handleMoveStep(idx, idx - 1)} className="p-1 text-gray-400 hover:text-gray-600">
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {idx < selected.steps.length - 1 && (
                                <button onClick={() => handleMoveStep(idx, idx + 1)} className="p-1 text-gray-400 hover:text-gray-600">
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button onClick={() => handleRemoveStep(step.id)} className="p-1 text-red-400 hover:text-red-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Step config */}
                          <div className="mt-2 grid grid-cols-1 gap-2 pl-8 sm:grid-cols-2">
                            {step.type === 'filter' && (
                              <>
                                <input
                                  type="text"
                                  placeholder="Feladó (pl. *@company.com)"
                                  value={step.config.sender || ''}
                                  onChange={(e) => handleStepConfigChange(step.id, 'sender', e.target.value)}
                                  className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7]"
                                />
                                <input
                                  type="text"
                                  placeholder="Tárgy tartalmazza"
                                  value={step.config.subject || ''}
                                  onChange={(e) => handleStepConfigChange(step.id, 'subject', e.target.value)}
                                  className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7]"
                                />
                              </>
                            )}
                            {step.type === 'forward' && (
                              <input
                                type="email"
                                placeholder="Továbbítás címzettje"
                                value={step.config.to || ''}
                                onChange={(e) => handleStepConfigChange(step.id, 'to', e.target.value)}
                                className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7] sm:col-span-2"
                              />
                            )}
                            {step.type === 'label' && (
                              <input
                                type="text"
                                placeholder="Címke neve"
                                value={step.config.label || ''}
                                onChange={(e) => handleStepConfigChange(step.id, 'label', e.target.value)}
                                className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7] sm:col-span-2"
                              />
                            )}
                            {step.type === 'notify' && (
                              <input
                                type="text"
                                placeholder="Értesítés szövege"
                                value={step.config.message || ''}
                                onChange={(e) => handleStepConfigChange(step.id, 'message', e.target.value)}
                                className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7] sm:col-span-2"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add step buttons */}
              <div className="mb-5">
                <p className="dark:text-dark-text-secondary mb-2 text-xs font-medium text-gray-500">
                  Lépés hozzáadása:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(STEP_META) as [StepType, typeof STEP_META[StepType]][]).map(([type, meta]) => {
                    const Icon = meta.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => handleAddStep(type)}
                        className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs transition-colors hover:bg-gray-50"
                      >
                        <Icon className={cn('h-3.5 w-3.5', meta.color)} />
                        <span className="dark:text-dark-text-secondary text-gray-600">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !selected.name.trim()}
                  className="flex items-center gap-2 rounded-lg bg-[#4f6ef7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Mentés
                </button>
                {selected.id && (
                  <button
                    onClick={() => handleRun(selected.id!)}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                  >
                    <Play className="h-4 w-4" />
                    Futtatás
                  </button>
                )}
                <button
                  onClick={() => setSelected(null)}
                  className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary rounded-lg px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100"
                >
                  Mégse
                </button>
              </div>
            </div>
          ) : (
            <div className="dark:bg-dark-bg-secondary dark:border-dark-border flex items-center justify-center rounded-xl border border-gray-200 bg-white py-20">
              <div className="text-center">
                <Workflow className="dark:text-dark-text-muted mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="dark:text-dark-text-secondary text-sm text-gray-500">
                  Válassz egy workflow-t a listából vagy hozz létre újat
                </p>
              </div>
            </div>
          )}

          {/* Run logs */}
          {showLogs && (
            <div className="dark:bg-dark-bg-secondary dark:border-dark-border mt-4 rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="dark:text-dark-text flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Clock className="h-4 w-4 text-[#4f6ef7]" />
                  Futtatási napló
                </h3>
                <button
                  onClick={() => { if (selected?.id) loadLogs(selected.id); }}
                  className="dark:text-dark-text-secondary p-1 text-gray-400 hover:text-gray-600"
                  title="Frissítés"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {runLogs.length === 0 ? (
                <p className="dark:text-dark-text-muted py-4 text-center text-xs text-gray-400">
                  Még nincs futtatási napló
                </p>
              ) : (
                <div className="space-y-2">
                  {runLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="dark:border-dark-border flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
                      {log.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {log.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                      {log.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      <div className="min-w-0 flex-1">
                        <span className="dark:text-dark-text text-xs text-gray-700">
                          {new Date(log.startedAt).toLocaleString('hu-HU')}
                        </span>
                        {log.stepsCompleted > 0 && (
                          <span className="dark:text-dark-text-muted ml-2 text-xs text-gray-400">
                            {log.stepsCompleted} lépés végrehajtva
                          </span>
                        )}
                        {log.error && (
                          <p className="mt-0.5 text-xs text-red-500">{log.error}</p>
                        )}
                      </div>
                      {log.completedAt && (
                        <span className="dark:text-dark-text-muted text-[10px] text-gray-400">
                          {Math.round((log.completedAt - log.startedAt) / 1000)}s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
