import React from 'react';
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react';
import { useVault } from '../context/VaultContext';

export const Toast: React.FC = () => {
  const { toast } = useVault();
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-purple-400 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/30 bg-emerald-50 text-emerald-900 dark:bg-[#161b22] dark:border-[#3fb950]/40 dark:text-[#f0f6fc] shadow-lg',
    error: 'border-rose-500/30 bg-rose-50 text-rose-900 dark:bg-[#161b22] dark:border-[#f85149]/40 dark:text-[#f0f6fc] shadow-lg',
    warning: 'border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-[#161b22] dark:border-[#d29922]/40 dark:text-[#f0f6fc] shadow-lg',
    info: 'border-purple-500/30 bg-purple-50 text-purple-900 dark:bg-[#161b22] dark:border-purple-500/40 dark:text-[#f0f6fc] shadow-lg',
  };

  const type = toast.type || 'info';

  return (
    <div className="fixed bottom-5 right-5 z-55 animate-toast-slide-in max-w-sm pointer-events-none">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl ${borders[type]}`}>
        {icons[type]}
        <span className="text-xs font-semibold tracking-wide">{toast.message}</span>
      </div>
    </div>
  );
};
