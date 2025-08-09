import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);

    // Auto-remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertCircle,
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={clsx(
        'min-w-72 max-w-md p-4 rounded-lg shadow-lg border backdrop-blur-sm',
        'bg-plex-gray-800/90 border-plex-gray-700',
        'transform transition-all duration-300 ease-in-out',
        'animate-in slide-in-from-right'
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={clsx('w-5 h-5 mt-0.5 flex-shrink-0', {
            'text-green-400': toast.type === 'success',
            'text-red-400': toast.type === 'error',
            'text-blue-400': toast.type === 'info',
            'text-yellow-400': toast.type === 'warning',
          })}
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-plex-gray-100">{toast.title}</h4>
          {toast.description && (
            <p className="text-sm text-plex-gray-300 mt-1">{toast.description}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 text-plex-gray-400 hover:text-plex-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Export a simple Toaster component that includes the provider
export const Toaster: React.FC = () => {
  return null; // The actual toasts are rendered by ToastProvider
};