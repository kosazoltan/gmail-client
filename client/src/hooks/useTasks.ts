import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useTaskLists() {
  return useQuery({
    queryKey: ['tasks', 'lists'],
    queryFn: () => api.tasks.lists(),
    staleTime: 60000,
  });
}

export function useTaskListItems(listId: string | null, showCompleted = true) {
  return useQuery({
    queryKey: ['tasks', 'list', listId, showCompleted],
    queryFn: () => api.tasks.listTasks(listId!, showCompleted),
    enabled: !!listId,
    staleTime: 30000,
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      listId,
      taskId,
      data,
    }: {
      listId: string;
      taskId: string;
      data: { status?: string; title?: string; notes?: string; due?: string };
    }) => api.tasks.updateTask(listId, taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      listId,
      data,
    }: {
      listId: string;
      data: { title: string; notes?: string; due?: string };
    }) => api.tasks.createTask(listId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listId, taskId }: { listId: string; taskId: string }) =>
      api.tasks.deleteTask(listId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
