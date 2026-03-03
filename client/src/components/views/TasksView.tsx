import { useState } from 'react';
import {
  useTaskLists,
  useTaskListItems,
  useUpdateTask,
  useCreateTask,
  useDeleteTask,
} from '../../hooks/useTasks';
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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { GoogleTask } from '../../types';

type TaskFilter = 'all' | 'open' | 'completed';

export function TasksView() {
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

  // Szűrt feladatok
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
      <div className="flex h-full items-center justify-center">
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
      <div className="flex h-full items-center justify-center">
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
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      {/* Fejléc */}
      <div className="flex items-center gap-3">
        <CheckSquare className="h-7 w-7 text-green-500" />
        <h1 className="dark:text-dark-text text-2xl font-bold text-gray-900">Feladatok</h1>
      </div>

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
        {/* Szűrő */}
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

        {/* Statisztika */}
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
            <TaskCard
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
        <div className="dark:text-dark-text-muted py-12 text-center text-sm text-gray-400">
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

function TaskCard({
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
                <span className="truncate max-w-[200px]">{task.notes}</span>
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
