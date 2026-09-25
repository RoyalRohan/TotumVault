import React from 'react';
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react';
import { useVault } from '../context/VaultContext';

export const Toast: React.FC = () => {
  const { toast } = useVault();
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 stroke-[1.75] text-emerald-600 dark:text-emerald-400 shrink-0" />,
    error: <XCircle className="w-5 h-5 stroke-[1.75] text-rose-600 dark:text-rose-400 shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 stroke-[1.75] text-amber-700 dark:text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 stroke-[1.75] text-purple-600 dark:text-purple-400 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/30 bg-emerald-50 text-emerald-900 dark:bg-[#171a20] dark:border-[#3fb950]/40 dark:text-[#f3f4f6] shadow-lg',
    error: 'border-rose-500/30 bg-rose-50 text-rose-900 dark:bg-[#171a20] dark:border-[#f85149]/40 dark:text-[#f3f4f6] shadow-lg',
    warning: 'border-amber-300 bg-amber-50 text-amber-950 dark:bg-[#171a20] dark:border-[#d29922]/40 dark:text-[#f3f4f6] shadow-lg',
    info: 'border-purple-500/30 bg-purple-50 text-purple-900 dark:bg-[#171a20] dark:border-purple-500/40 dark:text-[#f3f4f6] shadow-lg',
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
