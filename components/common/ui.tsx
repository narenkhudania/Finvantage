import React from 'react';
import { BUTTON_CLASS, STATUS_PILL_CLASS, SURFACE_CLASS, TYPOGRAPHY_CLASS } from '../../lib/designTokens';

type ClassValue = string | false | null | undefined;

export const cx = (...classes: ClassValue[]) => classes.filter(Boolean).join(' ');

type SurfaceVariant = keyof typeof SURFACE_CLASS;
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

const SURFACE_PADDING: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6 md:p-7',
};

type SurfaceCardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
};

export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}) => (
  <div className={cx(SURFACE_CLASS[variant], SURFACE_PADDING[padding], className)} {...props}>
    {children}
  </div>
);

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: BUTTON_CLASS.sizeSm,
  md: BUTTON_CLASS.sizeMd,
  lg: BUTTON_CLASS.sizeLg,
};

const BUTTON_TONE: Record<ButtonTone, string> = {
  primary: BUTTON_CLASS.primary,
  secondary: BUTTON_CLASS.secondary,
  ghost: BUTTON_CLASS.ghost,
  danger: BUTTON_CLASS.danger,
  dark: BUTTON_CLASS.dark,
};

type AppButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  size?: ButtonSize;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
};

export const AppButton: React.FC<AppButtonProps> = ({
  tone = 'secondary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  type = 'button',
  className,
  children,
  ...props
}) => (
  <button
    type={type}
    className={cx(BUTTON_CLASS.base, BUTTON_SIZE[size], BUTTON_TONE[tone], className)}
    {...props}
  >
    {leadingIcon}
    {children}
    {trailingIcon}
  </button>
);

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  icon?: React.ReactNode;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  tone = 'neutral',
  icon,
  className,
  children,
  ...props
}) => (
  <span className={cx(STATUS_PILL_CLASS.base, STATUS_PILL_CLASS[tone], className)} {...props}>
    {icon}
    {children}
  </span>
);

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  description,
  action,
  className,
}) => (
  <div className={cx('flex flex-wrap items-start justify-between gap-3', className)}>
    <div>
      {eyebrow && <p className={TYPOGRAPHY_CLASS.eyebrow}>{eyebrow}</p>}
      <h3 className={cx(TYPOGRAPHY_CLASS.title, eyebrow ? 'mt-1.5' : '')}>{title}</h3>
      {description && <p className={cx(TYPOGRAPHY_CLASS.body, 'mt-1.5')}>{description}</p>}
    </div>
    {action}
  </div>
);
