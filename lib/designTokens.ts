export const DESIGN_TOKENS = {
  spacing: {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-5',
    xl: 'gap-6',
  },
  radius: {
    sm: 'rounded-xl',
    md: 'rounded-2xl',
    lg: 'rounded-3xl',
  },
  motion: {
    fast: 'duration-200',
    base: 'duration-300',
  },
} as const;

export const SURFACE_CLASS = {
  default: 'app-panel rounded-3xl border border-slate-200 bg-white shadow-sm',
  elevated: 'app-panel rounded-3xl border border-teal-100 bg-white/90 shadow-[0_25px_50px_-35px_rgba(15,118,110,0.55)]',
  muted: 'rounded-3xl border border-slate-200 bg-slate-50 shadow-sm',
  dark: 'rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-xl',
} as const;

export const BUTTON_CLASS = {
  base: 'inline-flex items-center justify-center gap-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-45',
  sizeSm: 'px-2.5 py-1.5',
  sizeMd: 'px-3.5 py-2',
  sizeLg: 'px-4 py-2.5',
  primary: 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100',
  secondary: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
  danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  dark: 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700',
} as const;

export const STATUS_PILL_CLASS = {
  base: 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  info: 'border-teal-200 bg-teal-50 text-teal-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
} as const;

export const TYPOGRAPHY_CLASS = {
  eyebrow: 'text-[10px] font-black uppercase tracking-[0.16em] text-slate-500',
  title: 'text-xl font-black tracking-tight text-slate-900',
  titleLg: 'text-2xl md:text-3xl font-black tracking-tight',
  body: 'text-sm font-medium text-slate-600',
} as const;

export const CHART_COLORS = ['#0d9488', '#14b8a6', '#f43f5e', '#eab308', '#6366f1', '#8b5cf6', '#84cc16', '#0ea5e9'] as const;
