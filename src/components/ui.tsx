import React from 'react';
import { X, AlertCircle, CheckCircle2, Info, Loader2, Eye } from 'lucide-react';

// =================== BUTTON COMPONENT ===================
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline-dark' | 'outline-amber';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  isLoading,
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black/5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap rounded-xl tracking-tight active:scale-[0.97]';

  const sizeClasses = {
    sm: 'h-9 px-4 text-xs gap-1.5 min-w-[70px]',
    md: 'h-11 px-6 text-sm gap-2 min-w-[90px]',
    lg: 'h-13 px-8 text-base gap-2.5 min-w-[110px]'
  };

  const variantClasses = {
    primary:
      'bg-[#111111] text-white hover:bg-[#2A2A2A] border border-transparent shadow-md hover:shadow-lg',
    secondary:
      'bg-white text-[#111111] border border-[#E5E7EB] hover:border-[#111111] hover:bg-[#F9FAFB] shadow-sm',
    'outline-dark':
      'bg-transparent text-[#111111] border-2 border-[#111111] hover:bg-[#111111] hover:text-white',
    'outline-amber':
      'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100',
    ghost:
      'bg-transparent border-transparent text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111111] active:scale-100',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 border border-transparent shadow-sm',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 border border-transparent shadow-sm'
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        icon && <span className="inline-flex shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

// =================== CARD COMPONENT ===================
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  headerIcon?: React.ReactNode;
  accentBorder?: 'amber' | 'emerald' | 'red' | 'slate' | 'none';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  headerIcon,
  accentBorder = 'none',
  className = '',
  ...props
}) => {
  const accentBorderMap = {
    none: '',
    amber: 'border-r-4 border-r-[#111111]',
    emerald: 'border-r-4 border-r-[#10B981]',
    red: 'border-r-4 border-r-[#EF4444]',
    slate: 'border-r-4 border-r-[#6B7280]'
  };

  return (
    <div
      className={`bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-300 ${accentBorderMap[accentBorder]} ${className}`}
      {...props}
    >
      {(title || action || headerIcon) && (
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-3.5">
            {headerIcon && (
              <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center text-[#111111] shrink-0">
                {headerIcon}
              </div>
            )}
            <div>
              {title && <h3 className="text-[15px] font-black text-[#111111] tracking-tight">{title}</h3>}
              {subtitle && <p className="text-[12px] text-[#374151] mt-0.5 font-black">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

// =================== EMPTY STATE COMPONENT ===================
export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-12 bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] rounded-3xl my-6 ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-white border border-[#E5E7EB] text-[#111111] flex items-center justify-center mb-5 shadow-sm">
        {icon}
      </div>
      <h4 className="text-base font-black text-[#111111] mb-2">{title}</h4>
      {description && <p className="text-sm text-[#374151] max-w-sm mb-6 leading-relaxed font-black">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

// =================== MODAL COMPONENT ===================
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  allowPrint?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'lg',
  allowPrint = false
}) => {
  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-[95vw]'
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto ${allowPrint ? 'modal-print-host' : 'no-print'}`}>
      {/* Dimmed Overlay */}
      <div
        className={`fixed inset-0 bg-[#000000]/40 backdrop-blur-md transition-opacity duration-300 ${allowPrint ? 'no-print' : ''}`}
        onClick={onClose}
      />

      {/* Modal Dialog Box */}
      <div
        className={`relative w-full ${maxWidthClasses[maxWidth]} bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col my-auto max-h-[92vh] z-10 text-[#111111] animate-in fade-in zoom-in duration-200 ${allowPrint ? 'modal-print-dialog' : ''}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-8 py-6 bg-white border-b border-[#F3F4F6] ${allowPrint ? 'no-print' : ''}`}>
          <h3 className="text-lg font-black text-[#111111] tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#F9FAFB] flex items-center justify-center text-[#6B7280] hover:bg-[#111111] hover:text-white transition-all duration-200 cursor-pointer shadow-sm"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className={`p-8 overflow-y-auto flex-1 text-[#4B5563] bg-white ${allowPrint ? 'modal-print-body' : ''}`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className={`flex items-center justify-end gap-4 px-8 py-6 bg-[#F9FAFB] border-t border-[#F3F4F6] ${allowPrint ? 'no-print' : ''}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// =================== TOAST NOTIFICATION ===================
export interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'danger' | 'warning' | 'info';
  actionLabel?: string;
  onAction?: () => void;
}

export const Toast: React.FC<{ toast: ToastState; onClose: () => void }> = ({
  toast,
  onClose
}) => {
  if (!toast.show) return null;

  const bgBorderMap = {
    success: 'bg-white text-emerald-900 border-emerald-100 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.2)]',
    danger: 'bg-white text-rose-900 border-rose-100 shadow-[0_10px_30px_-10px_rgba(225,29,72,0.2)]',
    warning: 'bg-white text-amber-900 border-amber-100 shadow-[0_10px_30px_-10px_rgba(245,158,11,0.2)]',
    info: 'bg-white text-sky-900 border-sky-100 shadow-[0_10px_30px_-10px_rgba(14,165,233,0.2)]'
  };

  const iconMap = {
    success: <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" /></div>,
    danger: <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-rose-600 shrink-0" /></div>,
    warning: <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-amber-600 shrink-0" /></div>,
    info: <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center"><Info className="w-6 h-6 text-sky-600 shrink-0" /></div>
  };

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] no-print animate-in slide-in-from-top duration-300">
      <div
        className={`flex items-center gap-4 px-6 py-4 border min-w-[360px] max-w-lg rounded-2xl ${bgBorderMap[toast.type]}`}
      >
        {iconMap[toast.type]}
        <span className="text-sm font-black flex-1">{toast.message}</span>
        {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => { toast.onAction?.(); onClose(); }}
              className="mr-2 px-4 py-2 rounded-xl bg-[#111111] text-white text-xs font-black hover:bg-[#2A2A2A] transition-all"
            >
              {toast.actionLabel}
            </button>
          )}
          <button
          onClick={onClose}
          className="text-[#9CA3AF] hover:text-[#111111] transition-colors p-2 rounded-full hover:bg-[#F3F4F6]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// =================== LOADING SPINNER ===================
export const LoadingSpinner: React.FC<{ label?: string }> = ({ label = 'جاري التحميل...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-16 gap-4 text-[#6B7280]">
      <Loader2 className="w-10 h-10 animate-spin text-[#111111]" />
      <span className="text-sm font-black">{label}</span>
    </div>
  );
};

// =================== BADGE COMPONENT ===================
export interface BadgeProps {
  variant?: 'slate' | 'amber' | 'emerald' | 'red';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<{ variant?: 'slate' | 'amber' | 'emerald' | 'red'; children: React.ReactNode; className?: string }> = ({
  variant = 'slate',
  children,
  className = ''
}) => {
  const variantMap = {
    slate: 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]',
    amber: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
    emerald: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
    red: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${variantMap[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

// =================== FORM FIELD HELPERS ===================
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && <label className="block text-[13px] font-black text-[#111111] mb-2">{label}</label>}
      <div className="relative flex items-center group">
        {icon && <span className="absolute right-4 text-[#9CA3AF] group-focus-within:text-[#111111] transition-colors pointer-events-none">{icon}</span>}
        <input
          className={`w-full bg-white border-2 border-[#E5E7EB] text-[#111111] rounded-xl h-12 text-sm font-bold ${
            icon ? 'pr-11 pl-4' : 'px-4'
          } focus:outline-none focus:border-[#111111] focus:ring-4 focus:ring-[#111111]/5 placeholder:text-[#6B7280] transition-all duration-200 ${
            error ? 'border-rose-500 focus:ring-rose-500/10' : ''
          } ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs font-bold text-rose-500 mt-1.5">{error}</p>}
    </div>
  );
};

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  children,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && <label className="block text-[13px] font-black text-[#111111] mb-2">{label}</label>}
      <select
        className={`w-full bg-white border-2 border-[#E5E7EB] text-[#111111] rounded-xl h-12 text-sm font-bold px-4 focus:outline-none focus:border-[#111111] focus:ring-4 focus:ring-[#111111]/5 transition-all duration-200 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_1rem_center] bg-no-repeat ${
          error ? 'border-rose-500 focus:ring-rose-500/10' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs font-bold text-rose-500 mt-1.5">{error}</p>}
    </div>
  );
};
