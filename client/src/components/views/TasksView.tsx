import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useTaskLists,
  useTaskListItems,
  useUpdateTask,
  useCreateTask,
  useDeleteTask,
} from '../../hooks/useTasks';
import {
  useDetectedTasks,
  useDetectedTaskStats,
  useScanStream,
  useUpdateDetectedTask,
  useDeleteDetectedTask,
  useSnoozeDetectedTask,
} from '../../hooks/useDetectedTasks';
import { api } from '../../lib/api';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import {
  CheckSquare,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  StickyNote,
  Filter,
  RefreshCw,
  Mail,
  Clock,
  Reply,
  X,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from '../../lib/toast';
import { DailyBriefView } from '../ai/DailyBriefView';
import type { GoogleTask, DetectedTask } from '../../types';

type TaskFilter = 'all' | 'open' | 'completed';
type DetectedTaskPriorityFilter = 'all' | 'high' | 'medium' | 'low';
type TabType = 'detected' | 'google' | 'brief';

export function TasksView() {
  const [activeTab, setActiveTab] = useState<TabType>('detected');

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      {/* Fejléc */}
      <div className="flex items-center gap-3">
        <CheckSquare className="h-7 w-7 text-green-500" />
        <h1 className="dark:text-dark-text text-2xl font-bold text-gray-900">Feladatok</h1>
      </div>

      {/* Tab rendszer */}
      <div className="dark:bg-dark-bg-tertiary flex rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab('detected')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'detected'
              ? 'bg-white text-[#4f6ef7] shadow-sm dark:bg-dark-bg-secondary dark:text-[#6d8cff]'
              : 'dark:text-dark-text-secondary text-gray-600 hover:text-gray-900',
          )}
        >
          <span className="flex items-center justify-center gap-2">
            <Mail className="h-4 w-4" />
            Email Feladatok
          </span>
        </button>
        <button
          onClick={() => setActiveTab('google')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'google'
              ? 'bg-white text-[#4f6ef7] shadow-sm dark:bg-dark-bg-secondary dark:text-[#6d8cff]'
              : 'dark:text-dark-text-secondary text-gray-600 hover:text-gray-900',
          )}
        >
          <span className="flex items-center justify-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Google Tasks
          </span>
        </button>
        <button
          onClick={() => setActiveTab('brief')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'brief'
              ? 'bg-white text-[#4f6ef7] shadow-sm dark:bg-dark-bg-secondary dark:text-[#6d8cff]'
              : 'dark:text-dark-text-secondary text-gray-600 hover:text-gray-900',
          )}
        >
          <span className="flex items-center justify-center gap-2">
            <Calendar className="h-4 w-4" />
            Napi Áttekintés
          </span>
        </button>
      </div>

      {activeTab === 'detected' ? <DetectedTasksTab /> : activeTab === 'google' ? <GoogleTasksTab /> : <DailyBriefView />}
    </div>
  );
}

// ==================== DETECTED TASKS TAB ====================

function DetectedTasksTab() {
  const [priorityFilter, setPriorityFilter] = useState<DetectedTaskPriorityFilter>('all');
  const { data: statsData } = useDetectedTaskStats();
  const { data: tasksData, isLoading } = useDetectedTasks({
    status: 'open',
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
  });
  const { scanState, startScan } = useScanStream();
  const hasAutoScanned = useRef(false);

  // Auto-scan: ha nincs task és stats mind 0 → első scan 180 nap
  useEffect(() => {
    if (
      statsData &&
      statsData.open === 0 &&
      !hasAutoScanned.current &&
      !scanState.isScanning
    ) {
      hasAutoScanned.current = true;
      startScan(180);
    }
  }, [statsData, scanState.isScanning, startScan]);

  const handleScan = () => {
    // Kézi frissítés: MINDIG 30 nap (aktuális hónap)
    startScan(30);
  };

  return (
    <div className="space-y-4">
      {/* SSE Scan progress bar */}
      {scanState.isScanning && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/30">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              {scanState.phase === 'loading' && '📨 Emailek betöltése...'}
              {scanState.phase === 'scanning' && `🔍 Elemzés: ${scanState.processed}/${scanState.total} email`}
              {scanState.phase === 'updating' && '📊 Prioritások frissítése...'}
            </span>
            <span className="text-blue-600 dark:text-blue-400">
              {scanState.found} feladat találva
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-blue-200 dark:bg-blue-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{
                width: scanState.total > 0
                  ? `${(scanState.processed / scanState.total) * 100}%`
                  : '0%',
              }}
            />
          </div>
          <div className="mt-1 text-xs text-blue-500">
            {scanState.total > 0
              ? `${Math.round((scanState.processed / scanState.total) * 100)}%`
              : 'Betöltés...'}
          </div>
        </div>
      )}

      {/* Statisztika sáv */}
      {statsData && (
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <span className="flex items-center gap-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="font-medium text-red-600 dark:text-red-400">{statsData.high}</span>
            <span className="dark:text-dark-text-muted text-gray-500">sürgős</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            <span className="font-medium text-yellow-600 dark:text-yellow-400">{statsData.medium}</span>
            <span className="dark:text-dark-text-muted text-gray-500">közepes</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="font-medium text-green-600 dark:text-green-400">{statsData.low}</span>
            <span className="dark:text-dark-text-muted text-gray-500">alacsony</span>
          </span>
          <span className="dark:text-dark-text-muted ml-auto text-xs text-gray-400">
            Összesen: {statsData.open} nyitott
          </span>
        </div>
      )}

      {/* Szűrő + Scan gomb */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="dark:text-dark-text-muted h-4 w-4 text-gray-400" />
          <div className="dark:bg-dark-bg-tertiary flex rounded-lg bg-gray-100 p-1">
            {([
              { key: 'all', label: 'Mind' },
              { key: 'high', label: 'Sürgős' },
              { key: 'medium', label: 'Közepes' },
              { key: 'low', label: 'Alacsony' },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setPriorityFilter(f.key)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  priorityFilter === f.key
                    ? 'bg-white text-[#4f6ef7] shadow-sm dark:bg-dark-bg-secondary dark:text-[#6d8cff]'
                    : 'dark:text-dark-text-secondary text-gray-600 hover:text-gray-900',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleScan}
          disabled={scanState.isScanning}
          className="flex items-center gap-2 rounded-lg bg-[#4f6ef7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
        >
          {scanState.isScanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          🔄 Frissítés (aktuális hónap)
        </button>
      </div>

      {/* Task lista */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#4f6ef7]" />
        </div>
      ) : tasksData?.tasks && tasksData.tasks.length > 0 ? (
        <div className="space-y-2">
          {tasksData.tasks.map((task) => (
            <DetectedTaskCard key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <div className="dark:text-dark-text-muted flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-gray-500">
          {scanState.isScanning ? (
            // Progress bar fentebb mutatja a státuszt
            <span>Átvizsgálás folyamatban... ⏳</span>
          ) : hasAutoScanned.current || scanState.phase === 'done' ? (
            <span>Nincs megválaszolatlan email. Minden rendben! 🎉</span>
          ) : (
            <span>Kattints a &apos;Frissítés&apos; gombra az emailek átvizsgálásához</span>
          )}
        </div>
      )}
    </div>
  );
}

function DetectedTaskCard({ task }: { task: DetectedTask }) {
  const navigate = useNavigate();
  const updateTask = useUpdateDetectedTask();
  const deleteDetectedTask = useDeleteDetectedTask();
  const snoozeTask = useSnoozeDetectedTask();
  const [showSnooze, setShowSnooze] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const priorityColor = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  }[task.priority];

  const priorityLabel = {
    high: 'Sürgős',
    medium: 'Közepes',
    low: 'Alacsony',
  }[task.priority];

  const handleReply = () => {
    const to = task.fromEmail ?? '';
    if (!to) {
      toast.error('Nincs feladó email');
      return;
    }
    const subject = (task.subject ?? '').startsWith('Re:') ? task.subject! : `Re: ${task.subject ?? '(nincs tárgy)'}`;
    const threadId = task.threadId || '';
    navigate(
      `/compose?reply=true&to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}${threadId ? `&threadId=${threadId}` : ''}`,
    );
  };

  const handleDone = () => {
    updateTask.mutate({ id: task.id, data: { status: 'done' } });
  };

  const handleDismiss = () => {
    updateTask.mutate({ id: task.id, data: { status: 'dismissed' } });
  };

  const handleDeleteEmail = async () => {
    try {
      // Tényleges email törlés (Gmail trash-be teszi)
      await api.emails.delete(task.emailId);
      // Majd a detected task törlése
      deleteDetectedTask.mutate(task.id);
      toast.success('Email törölve');
    } catch {
      toast.error('Hiba az email törlésekor');
    }
    setShowDeleteConfirm(false);
  };

  const handleSnooze = (days: number) => {
    snoozeTask.mutate({ id: task.id, days });
    setShowSnooze(false);
  };

  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border group rounded-xl border border-gray-200 bg-white shadow-sm transition-all">
      <div className="flex">
        {/* Prioritás indikátor */}
        <div className={cn('w-1 flex-shrink-0 rounded-l-xl', priorityColor)} />

        <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start">
          {/* Fő tartalom */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-0.5 inline-flex flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                  task.priority === 'high'
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                    : task.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
                )}
              >
                {priorityLabel}
              </span>
              <div className="min-w-0 flex-1">
                <p className="dark:text-dark-text truncate text-sm font-semibold text-gray-900">
                  {task.fromName ?? 'Ismeretlen'}{' '}
                  <span className="dark:text-dark-text-muted font-normal text-gray-500">
                    &lt;{task.fromEmail ?? ''}&gt;
                  </span>
                </p>
                <p className="dark:text-dark-text-secondary mt-0.5 truncate text-sm text-gray-700">
                  {task.subject ?? '(nincs tárgy)'}
                </p>
                <p className="dark:text-dark-text-muted mt-1 text-xs text-gray-500 italic">
                  {task.reason ?? ''}
                </p>
                <div className="dark:text-dark-text-muted mt-1 flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  {task.emailDate ? formatRelativeDate(task.emailDate) : 'Ismeretlen dátum'}
                </div>
              </div>
            </div>
          </div>

          {/* Akció gombok */}
          <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
            {/* Válasz */}
            <button
              onClick={handleReply}
              className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
              title="Válasz"
            >
              <Reply className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Válasz</span>
            </button>

            {/* Kész */}
            <button
              onClick={handleDone}
              disabled={updateTask.isPending}
              className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
              title="Kész"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Kész</span>
            </button>

            {/* Szundi */}
            <div className="relative">
              <button
                onClick={() => setShowSnooze(!showSnooze)}
                className="flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20"
                title="Szundi"
              >
                <Clock className="h-3.5 w-3.5" />
                <ChevronDown className="h-3 w-3" />
              </button>
              {showSnooze && (
                <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => handleSnooze(1)}
                    className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50"
                  >
                    1 nap
                  </button>
                  <button
                    onClick={() => handleSnooze(3)}
                    className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50"
                  >
                    3 nap
                  </button>
                  <button
                    onClick={() => handleSnooze(7)}
                    className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50"
                  >
                    1 hét
                  </button>
                </div>
              )}
            </div>

            {/* Elvetés */}
            <button
              onClick={handleDismiss}
              disabled={updateTask.isPending}
              className="flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-500/10 dark:text-gray-400 dark:hover:bg-gray-500/20"
              title="Elvetés"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Email törlés */}
            <div className="relative">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                  title="Email törlés"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDeleteEmail}
                    className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                  >
                    Törlés
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="dark:bg-dark-bg-tertiary dark:text-dark-text rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                  >
                    Nem
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== GOOGLE TASKS TAB ====================

function GoogleTasksTab() {
  const { data: listsData, isLoading: listsLoading, error: listsError } = useTaskLists();
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const currentListId = activeListId || listsData?.lists?.[0]?.id || null;

  const showCompleted = filter !== 'open';
  const {
    data: tasksData,
    isLoading: tasksLoading,
  } = useTaskListItems(currentListId, showCompleted);

  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();

  const filteredTasks = (tasksData?.tasks || []).filter((task: GoogleTask) => {
    if (filter === 'open') return task.status === 'needsAction';
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  const handleToggleTask = (task: GoogleTask) => {
    if (!currentListId) return;
    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    updateTask.mutate({
      listId: currentListId,
      taskId: task.id,
      data: { status: newStatus },
    });
  };

  const handleCreateTask = () => {
    if (!currentListId || !newTaskTitle.trim()) return;
    createTask.mutate(
      {
        listId: currentListId,
        data: { title: newTaskTitle.trim() },
      },
      {
        onSuccess: () => setNewTaskTitle(''),
      },
    );
  };

  const handleDeleteTask = (taskId: string) => {
    if (!currentListId) return;
    deleteTask.mutate({ listId: currentListId, taskId });
  };

  if (listsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#4f6ef7]" />
          <p className="dark:text-dark-text-secondary text-sm text-gray-500">
            Feladatok betöltése...
          </p>
        </div>
      </div>
    );
  }

  if (listsError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="dark:text-dark-text-secondary text-sm text-gray-500">
            A feladatok betöltése sikertelen. Lehet, hogy újra kell jelentkezned.
          </p>
        </div>
      </div>
    );
  }

  const lists = listsData?.lists || [];

  return (
    <div className="space-y-4">
      {/* Lista tab-ok */}
      {lists.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => setActiveListId(list.id)}
              className={cn(
                'flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                currentListId === list.id
                  ? 'bg-[#4f6ef7] text-white shadow-sm'
                  : 'dark:bg-dark-bg-tertiary dark:text-dark-text-secondary dark:hover:bg-dark-bg bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {list.title}
            </button>
          ))}
        </div>
      )}

      {/* Szűrő + Új feladat */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="dark:text-dark-text-muted h-4 w-4 text-gray-400" />
          <div className="dark:bg-dark-bg-tertiary flex rounded-lg bg-gray-100 p-1">
            {(['all', 'open', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  filter === f
                    ? 'bg-white text-[#4f6ef7] shadow-sm dark:bg-dark-bg-secondary dark:text-[#6d8cff]'
                    : 'dark:text-dark-text-secondary text-gray-600 hover:text-gray-900',
                )}
              >
                {f === 'all' ? 'Összes' : f === 'open' ? 'Nyitott' : 'Kész'}
              </button>
            ))}
          </div>
        </div>

        <p className="dark:text-dark-text-muted text-xs text-gray-400">
          {filteredTasks.length} feladat
          {filter === 'all' && tasksData?.tasks
            ? ` (${tasksData.tasks.filter((t: GoogleTask) => t.status === 'needsAction').length} nyitott)`
            : ''}
        </p>
      </div>

      {/* Új feladat hozzáadása */}
      <div className="dark:bg-dark-bg-secondary dark:border-dark-border flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <Plus className="dark:text-dark-text-muted h-5 w-5 flex-shrink-0 text-gray-400" />
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateTask();
          }}
          placeholder="Új feladat hozzáadása..."
          className="dark:bg-dark-bg-secondary dark:text-dark-text dark:placeholder-dark-text-muted min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        <button
          onClick={handleCreateTask}
          disabled={!newTaskTitle.trim() || createTask.isPending}
          className="flex-shrink-0 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createTask.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Hozzáadás'
          )}
        </button>
      </div>

      {/* Feladatok listája */}
      {tasksLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#4f6ef7]" />
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-2">
          {filteredTasks.map((task: GoogleTask) => (
            <GoogleTaskCard
              key={task.id}
              task={task}
              onToggle={() => handleToggleTask(task)}
              onDelete={() => handleDeleteTask(task.id)}
              isUpdating={updateTask.isPending}
              isDeleting={deleteTask.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="dark:text-dark-text-muted py-12 text-center text-sm text-gray-500">
          {filter === 'open'
            ? 'Minden feladat kész — szép munka! ✅'
            : filter === 'completed'
              ? 'Még nincs kész feladat'
              : 'Nincs feladat ebben a listában'}
        </div>
      )}
    </div>
  );
}

function GoogleTaskCard({
  task,
  onToggle,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  task: GoogleTask;
  onToggle: () => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const isCompleted = task.status === 'completed';
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div
      className={cn(
        'dark:bg-dark-bg-secondary dark:border-dark-border group rounded-xl border bg-white p-4 shadow-sm transition-all',
        isCompleted
          ? 'border-gray-100 opacity-60 dark:opacity-50'
          : 'border-gray-200',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          disabled={isUpdating}
          className={cn(
            'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors',
            isCompleted
              ? 'border-green-500 bg-green-500 text-white'
              : 'border-gray-300 hover:border-green-400 dark:border-gray-600 dark:hover:border-green-500',
          )}
          aria-label={isCompleted ? 'Feladat visszaállítása' : 'Feladat készre jelölése'}
        >
          {isCompleted && (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6L5 9L10 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {/* Tartalom */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'dark:text-dark-text text-sm font-medium text-gray-900',
              isCompleted && 'text-gray-400 line-through dark:text-gray-500',
            )}
          >
            {task.title}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {task.due && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs',
                  !isCompleted && isOverdue(task.due)
                    ? 'font-medium text-red-500 dark:text-red-400'
                    : 'dark:text-dark-text-muted text-gray-500',
                )}
              >
                <Calendar className="h-3 w-3" />
                {formatDueDate(task.due)}
              </div>
            )}
            {task.notes && (
              <div className="dark:text-dark-text-muted flex items-center gap-1 text-xs text-gray-500">
                <StickyNote className="h-3 w-3" />
                <span className="max-w-[200px] truncate">{task.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Törlés */}
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            aria-label="Feladat törlése"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex flex-shrink-0 gap-1">
            <button
              onClick={() => {
                onDelete();
                setShowConfirm(false);
              }}
              disabled={isDeleting}
              className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
            >
              Igen
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="dark:bg-dark-bg-tertiary dark:text-dark-text rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
            >
              Nem
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== UTILITY FUNCTIONS ====================

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return 'most';
  if (minutes < 60) return `${minutes} perce`;
  if (hours < 24) return `${hours} órája`;
  if (days === 1) return 'tegnap';
  if (days < 7) return `${days} napja`;
  if (weeks === 1) return '1 hete';
  if (weeks < 4) return `${weeks} hete`;
  return format(new Date(timestamp), 'yyyy. MMM d.', { locale: hu });
}

function formatDueDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);

  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);

  if (diff < 0) return `${Math.abs(diff)} napja lejárt`;
  if (diff === 0) return 'Ma';
  if (diff === 1) return 'Holnap';
  return format(date, 'MMM d.', { locale: hu });
}

function isOverdue(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}
