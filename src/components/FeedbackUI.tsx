import React from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import type { ToastMessage } from '../types/network';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#263650] bg-white dark:bg-[#121D32] p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              destructive
                ? 'bg-[#F06478]/15 text-[#DF475E] dark:text-[#F06478]'
                : 'bg-[#6555FF]/15 text-[#5848F5] dark:text-[#6555FF]'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-[#F4F7FF]">{title}</h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-[#9EACC4] leading-relaxed">
              {description}
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-[#263650] text-slate-700 dark:text-[#9EACC4] hover:bg-slate-100 dark:hover:bg-[#192640] transition-colors whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-xl text-white transition-colors whitespace-nowrap ${
              destructive
                ? 'bg-[#DF475E] hover:bg-[#c8394f]'
                : 'bg-[#6555FF] hover:bg-[#5343eb]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ToastNotificationsProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastNotifications: React.FC<ToastNotificationsProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 end-4 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100%-2rem)] pointer-events-none no-print">
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'warning'
              ? AlertTriangle
              : toast.type === 'error'
                ? AlertCircle
                : Info;
        const iconColor =
          toast.type === 'success'
            ? 'text-[#16A36D] dark:text-[#22C58B]'
            : toast.type === 'warning'
              ? 'text-[#D99B1E] dark:text-[#F5B942]'
              : toast.type === 'error'
                ? 'text-[#DF475E] dark:text-[#F06478]'
                : 'text-[#069FC7] dark:text-[#08C8F0]';

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 dark:border-[#263650] bg-white/95 dark:bg-[#121D32]/95 backdrop-blur-md p-3.5 shadow-xl"
          >
            <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-[#F4F7FF]">
                {toast.title}
              </div>
              {toast.description && (
                <div className="mt-0.5 text-xs text-slate-600 dark:text-[#9EACC4]">
                  {toast.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-300 dark:border-[#263650] bg-slate-50/70 dark:bg-[#0E1628]/60 px-6 py-12">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6555FF]/10 text-[#5848F5] dark:text-[#08C8F0] mb-4">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-slate-900 dark:text-[#F4F7FF]">{title}</h3>
    <p className="mt-1.5 max-w-md text-sm text-slate-600 dark:text-[#9EACC4]">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-5 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-[#08C8F0] to-[#6555FF] text-white hover:opacity-95 transition-opacity whitespace-nowrap"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

interface ErrorStateProps {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  retryLabel,
  onRetry,
}) => (
  <div className="flex items-start gap-3 rounded-xl border border-[#DF475E]/30 bg-[#DF475E]/10 p-4">
    <AlertCircle className="h-5 w-5 text-[#DF475E] dark:text-[#F06478] shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-[#DF475E] dark:text-[#F06478]">{title}</div>
      <div className="mt-1 text-xs text-slate-700 dark:text-[#F4F7FF]/90">{message}</div>
      {retryLabel && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#DF475E] text-white hover:opacity-90 transition-opacity"
        >
          {retryLabel}
        </button>
      )}
    </div>
  </div>
);
