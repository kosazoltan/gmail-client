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
  Calendar,
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
import { api } from '../../lib/api';
import type {
  WorkflowTriggerType as TriggerType,
  WorkflowStepType as StepType,
  WorkflowStep,
  WorkflowData,
  RunLogEntry,
} from '../../types';

interface WorkflowBuilderProps {
  externalDraft?: WorkflowData | null;
  externalDraftKey?: string | null;
  onExternalDraftConsumed?: () => void;
  onWorkflowSaved?: (workflow: WorkflowData) => void;
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
  extract_action_items: { label: 'Teendők kinyerése', icon: Scissors, color: 'text-fuchsia-500', description: 'Action itemek automatikus kinyerése az emailből' },
  detect_followup_risk: { label: 'Follow-up kockázat', icon: AlertCircle, color: 'text-rose-500', description: 'Válasz nélküli vagy kockázatos ügyek felismerése' },
  extract_calendar_event: { label: 'Naptáresemény felismerés', icon: Calendar, color: 'text-cyan-500', description: 'Meeting vagy határidő felismerése emailből' },
  create_calendar_event: { label: 'Naptáresemény létrehozás', icon: Calendar, color: 'text-sky-500', description: 'Felismert esemény automatikus naptárba írása' },
  raise_dashboard_alert: { label: 'Dashboard figyelmeztetés', icon: Bell, color: 'text-red-500', description: 'Automatikus emlékeztető és dashboard figyelmeztetés létrehozása' },
};

const TRIGGER_META: Record<TriggerType, { label: string; icon: typeof Clock }> = {
  new_email: { label: 'Új email érkezésekor', icon: Forward },
  schedule: { label: 'Ütemezett / napi batch', icon: Clock },
  manual: { label: 'Kézi indítás', icon: Play },
};

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'H' },
  { value: 2, label: 'K' },
  { value: 3, label: 'Sze' },
  { value: 4, label: 'Cs' },
  { value: 5, label: 'P' },
  { value: 6, label: 'Szo' },
  { value: 0, label: 'V' },
];

const ADDABLE_STEP_TYPES: StepType[] = [
  'filter',
  'ai_analyze',
  'label',
  'forward',
  'summarize',
  'notify',
  'extract_action_items',
  'detect_followup_risk',
  'extract_calendar_event',
  'create_calendar_event',
  'raise_dashboard_alert',
];

type StepConfigValue = string | number | boolean | string[] | number[] | null;

function parseCronToScheduleConfig(config: Record<string, unknown>): Record<string, unknown> {
  const hour = typeof config.hour === 'number' ? config.hour : Number.parseInt(String(config.hour ?? ''), 10);
  const minute = typeof config.minute === 'number' ? config.minute : Number.parseInt(String(config.minute ?? ''), 10);
  const days = Array.isArray(config.days)
    ? config.days.map((value) => Number.parseInt(String(value), 10)).filter((value) => Number.isInteger(value))
    : null;

  if (Number.isInteger(hour) && Number.isInteger(minute)) {
    return {
      hour,
      minute,
      days: days && days.length > 0 ? [...new Set(days)] : [1, 2, 3, 4, 5],
    };
  }

  const cron = typeof config.cron === 'string' ? config.cron.trim() : '';
  if (cron) {
    const parts = cron.split(/\s+/);
    if (parts.length >= 5) {
      const parsedMinute = Number.parseInt(parts[0], 10);
      const parsedHour = Number.parseInt(parts[1], 10);
      const parsedDays = parts[4] === '*' || parts[4] === '?'
        ? [1, 2, 3, 4, 5]
        : parts[4]
          .split(',')
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => Number.isInteger(value))
          .map((value) => (value === 7 ? 0 : value));
      if (Number.isInteger(parsedHour) && Number.isInteger(parsedMinute)) {
        return {
          hour: parsedHour,
          minute: parsedMinute,
          days: parsedDays.length > 0 ? [...new Set(parsedDays)] : [1, 2, 3, 4, 5],
        };
      }
    }
  }

  return { hour: 7, minute: 0, days: [1, 2, 3, 4, 5] };
}

function getDefaultStepConfig(type: StepType): Record<string, StepConfigValue> {
  switch (type) {
    case 'filter':
      return { field: 'from_email', operator: 'contains', value: '' };
    case 'notify':
      return { title: 'Workflow értesítés', body: '' };
    case 'forward':
      return { to: '' };
    case 'label':
      return { label: '' };
    case 'raise_dashboard_alert':
      return { reminderOffsetHours: 2, note: 'Workflow által létrehozott AI figyelmeztetés' };
    default:
      return {};
  }
}

function normalizeStepConfig(step: WorkflowStep): Record<string, StepConfigValue> {
  if (step.type === 'filter') {
    if (typeof step.config.field === 'string' && typeof step.config.value === 'string') {
      return step.config as Record<string, StepConfigValue>;
    }
    if (typeof step.config.sender === 'string' && step.config.sender.trim()) {
      return { field: 'from_email', operator: 'contains', value: step.config.sender.trim() };
    }
    if (typeof step.config.subject === 'string' && step.config.subject.trim()) {
      return { field: 'subject', operator: 'contains', value: step.config.subject.trim() };
    }
    return getDefaultStepConfig('filter');
  }

  if (step.type === 'notify') {
    return {
      title: typeof step.config.title === 'string' ? step.config.title : 'Workflow értesítés',
      body: typeof step.config.body === 'string'
        ? step.config.body
        : typeof step.config.message === 'string'
          ? step.config.message
          : '',
    };
  }

  return step.config as Record<string, StepConfigValue>;
}

function normalizeWorkflow(workflow: WorkflowData): WorkflowData {
  return {
    ...workflow,
    triggerConfig: workflow.triggerType === 'schedule'
      ? parseCronToScheduleConfig(workflow.triggerConfig)
      : workflow.triggerConfig,
    steps: (workflow.steps || []).map((step) => ({
      ...step,
      name: step.name ?? STEP_META[step.type].label,
      config: normalizeStepConfig(step),
    })),
  };
}

function clampNumber(rawValue: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

// --- Component ---

export function WorkflowBuilder({
  externalDraft,
  externalDraftKey,
  onExternalDraftConsumed,
  onWorkflowSaved,
}: WorkflowBuilderProps) {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [selected, setSelected] = useState<WorkflowData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<RunLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [activeLogWorkflowId, setActiveLogWorkflowId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Fetch workflows
  const loadWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.workflows.list();
      setWorkflows((data.workflows || []).map(normalizeWorkflow));
    } catch (err) {
      console.error('[WorkflowBuilder] loadWorkflows error:', err);
      setError(err instanceof Error ? err.message : 'Hiba a workflow-k betöltésekor');
      setWorkflows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  useEffect(() => {
    if (!externalDraft || !externalDraftKey) return;
    setSelected(normalizeWorkflow(externalDraft));
    setShowLogs(false);
    setActiveLogWorkflowId(null);
    onExternalDraftConsumed?.();
  }, [externalDraft, externalDraftKey, onExternalDraftConsumed]);

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
    setActiveLogWorkflowId(null);
  };

  // Save
  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload = normalizeWorkflow(selected);
      if (selected.id) {
        const updated = await api.workflows.update(selected.id, payload);
        setWorkflows((prev) => prev.map((w) => (w.id === selected.id ? normalizeWorkflow(updated.workflow) : w)));
        setSelected(normalizeWorkflow(updated.workflow));
        onWorkflowSaved?.(normalizeWorkflow(updated.workflow));
      } else {
        const created = await api.workflows.create(payload);
        setWorkflows((prev) => [...prev, normalizeWorkflow(created.workflow)]);
        setSelected(normalizeWorkflow(created.workflow));
        onWorkflowSaved?.(normalizeWorkflow(created.workflow));
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
      await api.workflows.delete(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      if (selected?.id === id) setSelected(null);
      if (activeLogWorkflowId === id) {
        setRunLogs([]);
        setShowLogs(false);
        setActiveLogWorkflowId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Törlési hiba');
    }
  };

  // Toggle active
  const handleToggleActive = async (wf: WorkflowData) => {
    if (!wf.id) return;
    try {
      const updated = await api.workflows.update(wf.id, { ...wf, isActive: !wf.isActive });
      setWorkflows((prev) => prev.map((w) => (w.id === wf.id ? normalizeWorkflow(updated.workflow) : w)));
      if (selected?.id === wf.id) setSelected(normalizeWorkflow(updated.workflow));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktiválási hiba');
    }
  };

  // Run
  const handleRun = async (id: string) => {
    try {
      await api.workflows.run(id);
      loadLogs(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Futtatási hiba');
    }
  };

  // Load logs
  const loadLogs = async (id: string) => {
    try {
      const data = await api.workflows.runs(id);
      setRunLogs(data.runs || []);
      setShowLogs(true);
      setActiveLogWorkflowId(id);
    } catch {
      setRunLogs([]);
      setShowLogs(true);
      setActiveLogWorkflowId(id);
    }
  };

  // Add step
  const handleAddStep = (type: StepType) => {
    if (!selected) return;
    const step: WorkflowStep = {
      id: crypto.randomUUID(),
      type,
      name: STEP_META[type].label,
      config: getDefaultStepConfig(type),
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
  const handleStepConfigChange = (stepId: string, key: string, value: StepConfigValue) => {
    if (!selected) return;
    setSelected({
      ...selected,
      steps: selected.steps.map((s) =>
        s.id === stepId ? { ...s, config: { ...s.config, [key]: value } } : s,
      ),
    });
  };

  const handleTriggerConfigChange = (key: string, value: StepConfigValue) => {
    if (!selected) return;
    setSelected({
      ...selected,
      triggerConfig: { ...selected.triggerConfig, [key]: value },
    });
  };

  const toggleScheduleDay = (dayValue: number) => {
    if (!selected) return;
    const current = Array.isArray(selected.triggerConfig.days)
      ? selected.triggerConfig.days.map((value) => Number(value)).filter((value) => Number.isInteger(value))
      : [1, 2, 3, 4, 5];
    const next = current.includes(dayValue)
      ? current.filter((value) => value !== dayValue)
      : [...current, dayValue];
    setSelected({
      ...selected,
      triggerConfig: {
        ...selected.triggerConfig,
        days: next.length > 0 ? next.sort((a, b) => a - b) : [1, 2, 3, 4, 5],
      },
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
                  onClick={() => { setSelected(normalizeWorkflow(wf)); setShowLogs(false); }}
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
                    onChange={(e) => {
                      const triggerType = e.target.value as TriggerType;
                      setSelected({
                        ...selected,
                        triggerType,
                        triggerConfig: triggerType === 'schedule'
                          ? parseCronToScheduleConfig(selected.triggerConfig)
                          : {},
                      });
                    }}
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
                <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-[120px_120px_minmax(0,1fr)]">
                  <div>
                    <label className="dark:text-dark-text-secondary mb-1 block text-xs font-medium text-gray-600">
                      Óra
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={String(selected.triggerConfig.hour ?? 7)}
                      onChange={(e) => handleTriggerConfigChange('hour', clampNumber(e.target.value, 0, 23, 7))}
                      className="dark:border-dark-border dark:bg-dark-bg-tertiary dark:text-dark-text w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
                    />
                  </div>
                  <div>
                    <label className="dark:text-dark-text-secondary mb-1 block text-xs font-medium text-gray-600">
                      Perc
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={String(selected.triggerConfig.minute ?? 0)}
                      onChange={(e) => handleTriggerConfigChange('minute', clampNumber(e.target.value, 0, 59, 0))}
                      className="dark:border-dark-border dark:bg-dark-bg-tertiary dark:text-dark-text w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
                    />
                  </div>
                  <div>
                    <label className="dark:text-dark-text-secondary mb-1 block text-xs font-medium text-gray-600">
                      Napok
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_OPTIONS.map((day) => {
                        const selectedDays = Array.isArray(selected.triggerConfig.days)
                          ? selected.triggerConfig.days.map((value) => Number(value))
                          : [1, 2, 3, 4, 5];
                        const isSelected = selectedDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleScheduleDay(day.value)}
                            className={cn(
                              'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                              isSelected
                                ? 'border-[#4f6ef7] bg-[#4f6ef7]/10 text-[#4f6ef7]'
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
                                <select
                                  value={String(step.config.field || 'from_email')}
                                  onChange={(e) => handleStepConfigChange(step.id, 'field', e.target.value)}
                                  className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7]"
                                >
                                  <option value="from_email">Feladó email</option>
                                  <option value="from_name">Feladó név</option>
                                  <option value="subject">Tárgy</option>
                                  <option value="to_email">Címzett</option>
                                  <option value="labels">Címkék</option>
                                  <option value="date_age_days">Levél kora (nap)</option>
                                </select>
                                <select
                                  value={String(step.config.operator || 'contains')}
                                  onChange={(e) => handleStepConfigChange(step.id, 'operator', e.target.value)}
                                  className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7]"
                                >
                                  <option value="contains">Tartalmazza</option>
                                  <option value="equals">Pontosan egyezik</option>
                                  <option value="not_contains">Nem tartalmazza</option>
                                  <option value="starts_with">Ezzel kezdődik</option>
                                  <option value="ends_with">Ezzel végződik</option>
                                  <option value="gt">Nagyobb mint</option>
                                  <option value="gte">Nagyobb vagy egyenlő</option>
                                  <option value="lt">Kisebb mint</option>
                                  <option value="lte">Kisebb vagy egyenlő</option>
                                  <option value="in_vip_list">VIP listában van</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder={step.config.operator === 'in_vip_list' ? 'VIP lista alapú szűrés' : 'Szűrési érték'}
                                  value={step.config.operator === 'in_vip_list' ? '' : String(step.config.value || '')}
                                  onChange={(e) => handleStepConfigChange(step.id, 'value', e.target.value)}
                                  disabled={step.config.operator === 'in_vip_list'}
                                  className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7] sm:col-span-2"
                                />
                              </>
                            )}
                            {step.type === 'forward' && (
                              <input
                                type="email"
                                placeholder="Továbbítás címzettje"
                                value={String(step.config.to || '')}
                                onChange={(e) => handleStepConfigChange(step.id, 'to', e.target.value)}
                                className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7] sm:col-span-2"
                              />
                            )}
                            {step.type === 'label' && (
                              <input
                                type="text"
                                placeholder="Címke neve"
                                value={String(step.config.label || '')}
                                onChange={(e) => handleStepConfigChange(step.id, 'label', e.target.value)}
                                className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7] sm:col-span-2"
                              />
                            )}
                            {step.type === 'notify' && (
                              <>
                                <input
                                  type="text"
                                  placeholder="Értesítés címe"
                                  value={String(step.config.title || '')}
                                  onChange={(e) => handleStepConfigChange(step.id, 'title', e.target.value)}
                                  className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7]"
                                />
                                <input
                                  type="text"
                                  placeholder="Értesítés szövege"
                                  value={String(step.config.body || '')}
                                  onChange={(e) => handleStepConfigChange(step.id, 'body', e.target.value)}
                                  className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#4f6ef7]"
                                />
                              </>
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
                  {ADDABLE_STEP_TYPES.map((type) => {
                    const meta = STEP_META[type];
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
                  onClick={() => { if (activeLogWorkflowId) loadLogs(activeLogWorkflowId); }}
                  disabled={!activeLogWorkflowId}
                  className="dark:text-dark-text-secondary p-1 text-gray-400 hover:text-gray-600 disabled:opacity-40"
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
