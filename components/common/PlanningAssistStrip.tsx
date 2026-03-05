import React from 'react';
import { Sparkles } from 'lucide-react';

export type PlanningAssistTone = 'neutral' | 'positive' | 'warning' | 'critical';

export interface PlanningAssistStat {
  label: string;
  value: string;
  tone?: PlanningAssistTone;
}

interface PlanningAssistStripProps {
  title: string;
  description: string;
  stats: PlanningAssistStat[];
  tip?: string;
  actions?: React.ReactNode;
}

const toneClassMap: Record<PlanningAssistTone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-900',
  positive: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-100 bg-amber-50 text-amber-700',
  critical: 'border-rose-100 bg-rose-50 text-rose-700',
};

const PlanningAssistStrip: React.FC<PlanningAssistStripProps> = ({
  title,
  description,
  stats,
  tip,
  actions,
}) => {
  const visibleStats = stats.filter((stat) => stat && stat.label && stat.value).slice(0, 5);

  return (
    <section className="bg-white/90 border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="text-left space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Planning Assist</p>
          <h3 className="text-lg md:text-xl font-black text-slate-900 leading-tight">{title}</h3>
          <p className="text-sm font-medium text-slate-600">{description}</p>
        </div>
        {(tip || actions) ? (
          <div className="flex flex-col items-start lg:items-end gap-2.5">
            {tip ? (
              <div className="inline-flex items-start gap-2 rounded-2xl border border-teal-100 bg-teal-50 px-3.5 py-2.5 text-left">
                <Sparkles size={14} className="mt-0.5 text-teal-600 shrink-0" />
                <span className="text-xs font-semibold text-teal-700 leading-relaxed">{tip}</span>
              </div>
            ) : null}
            {actions ? <div className="w-full lg:w-auto">{actions}</div> : null}
          </div>
        ) : null}
      </div>

      {visibleStats.length > 0 && (
        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {visibleStats.map((stat) => {
            const tone = stat.tone || 'neutral';
            return (
              <div
                key={`${stat.label}-${stat.value}`}
                className={`rounded-2xl border px-3.5 py-3 ${toneClassMap[tone]}`}
              >
                <p className="text-[9px] font-black uppercase tracking-widest opacity-75">{stat.label}</p>
                <p className="mt-1 text-sm md:text-base font-black leading-snug">{stat.value}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PlanningAssistStrip;
