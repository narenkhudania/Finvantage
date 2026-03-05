import React, { useEffect } from 'react';
import { Coins, Sparkles, Wallet } from 'lucide-react';

export interface RewardCelebrationPayload {
  id: number;
  eventType: string;
  points: number;
}

const EVENT_LABELS: Record<string, string> = {
  daily_login: 'Daily Login',
  profile_completion: 'Profile Completion',
  risk_profile_completed: 'Risk Profile Completed',
  goal_added: 'Goal Added',
  report_generated: 'Report Generated',
  subscription_payment_success: 'Subscription Payment Success',
};

const RewardCelebration: React.FC<{
  reward: RewardCelebrationPayload | null;
  onDone: () => void;
}> = ({ reward, onDone }) => {
  useEffect(() => {
    if (!reward) return;
    const timer = window.setTimeout(() => onDone(), 1900);
    return () => window.clearTimeout(timer);
  }, [reward, onDone]);

  if (!reward) return null;

  const eventLabel = EVENT_LABELS[reward.eventType] || 'Milestone Completed';
  const coins = Array.from({ length: 10 }, (_, index) => {
    const tx = -110 + index * 24;
    const ty = -92 - (index % 4) * 16;
    const delay = index * 0.05;
    return {
      id: `${reward.id}-coin-${index}`,
      style: {
        ['--tx' as any]: `${tx}px`,
        ['--ty' as any]: `${ty}px`,
        ['--delay' as any]: `${delay}s`,
      } as React.CSSProperties,
    };
  });

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[85] md:right-6 md:top-20">
      <div className="reward-toast-pop relative w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-amber-200 bg-white/95 p-4 shadow-[0_24px_50px_-26px_rgba(15,23,42,0.5)] backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <Coins size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">Points Earned</p>
            <p className="mt-1 text-sm font-black text-slate-900">{eventLabel}</p>
            <p className="text-xs font-semibold text-slate-600">Reward added to your wallet.</p>
          </div>
          <div className="rounded-xl bg-teal-600 px-3 py-2 text-right text-white shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-teal-100">+ Points</p>
            <p className="text-lg font-black leading-none">+{reward.points}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-1 text-[11px] font-semibold text-slate-600">
          <Wallet size={12} className="text-teal-600" />
          Wallet updated
          <Sparkles size={11} className="text-amber-500" />
        </div>

        <div className="reward-coins-layer">
          {coins.map((coin) => (
            <span key={coin.id} style={coin.style} className="reward-coin-flight" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RewardCelebration;
