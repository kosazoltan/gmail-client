// Toast notification rendszer
type ToastType = 'success' | 'error' | 'info' | 'warning' | 'undo';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onUndo?: () => void;
  progress?: number; // 0-100 közötti érték az undo visszaszámláláshoz
}

type ToastListener = (toasts: Toast[]) => void;

class ToastManager {
  private toasts: Toast[] = [];
  private listeners: Set<ToastListener> = new Set();
  private progressIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  private add(type: ToastType, message: string, duration = 3000, onUndo?: () => void) {
    const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const toast: Toast = { id, type, message, duration, onUndo, progress: type === 'undo' ? 100 : undefined };

    this.toasts.push(toast);
    this.notify();

    if (duration > 0) {
      // Undo típusnál progress bar animáció
      if (type === 'undo') {
        const startTime = Date.now();
        const interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
          this.updateProgress(id, remaining);
          if (remaining <= 0) {
            clearInterval(interval);
            this.progressIntervals.delete(id);
          }
        }, 50);
        this.progressIntervals.set(id, interval);
      }

      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  private updateProgress(id: string, progress: number) {
    const toast = this.toasts.find((t) => t.id === id);
    if (toast) {
      toast.progress = progress;
      this.notify();
    }
  }

  dismiss(id: string) {
    // Progress interval törlése ha van
    const interval = this.progressIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.progressIntervals.delete(id);
    }
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  // Undo toast visszavonása és callback hívása
  undo(id: string) {
    const toast = this.toasts.find((t) => t.id === id);
    if (toast?.onUndo) {
      toast.onUndo();
    }
    this.dismiss(id);
  }

  success(message: string, duration?: number) {
    return this.add('success', message, duration);
  }

  error(message: string, duration?: number) {
    return this.add('error', message, duration);
  }

  info(message: string, duration?: number) {
    return this.add('info', message, duration);
  }

  warning(message: string, duration?: number) {
    return this.add('warning', message, duration);
  }

  // Visszavonható művelet (undo send stb.)
  undoable(message: string, onUndo: () => void, duration = 5000) {
    return this.add('undo', message, duration, onUndo);
  }
}

export const toast = new ToastManager();
export type { Toast, ToastType };
