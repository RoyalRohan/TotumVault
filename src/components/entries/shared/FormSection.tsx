import React from 'react';

interface FormSectionProps {
  title?: string;
  icon?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  icon,
  description,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-3 pt-2 ${className}`}>
      {title && (
        <div className="border-b border-theme-border pb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <span className="text-theme-text-muted">{icon}</span>}
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">
              {title}
            </h3>
          </div>
          {description && (
            <span className="text-[11px] text-theme-text-dim">{description}</span>
          )}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
};
