import { useCallback, useState } from 'react';

export interface DragEmailPayload {
  emailId: string;
  accountId?: string;
}

const DRAG_TYPE = 'application/x-zmail-email';

export function setDraggedEmail(dataTransfer: DataTransfer, payload: DragEmailPayload) {
  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
  dataTransfer.setData('text/plain', payload.emailId);
}

export function getDraggedEmail(dataTransfer: DataTransfer): DragEmailPayload | null {
  const raw = dataTransfer.getData(DRAG_TYPE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragEmailPayload;
  } catch {
    return null;
  }
}

export function useDragDrop() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggingOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  }, []);

  const resetDragState = useCallback(() => setIsDraggingOver(false), []);

  return {
    isDraggingOver,
    onDragOver,
    onDragLeave,
    resetDragState,
  };
}
