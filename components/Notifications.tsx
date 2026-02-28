import React, { useMemo } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Zap,
  ArrowRight,
  Trash2,
  ShieldCheck,
  Clock,
  BrainCircuit,
  Wallet,
  Target,
  HeartPulse,
} from 'lucide-react';
import { FinanceState, Notification, View } from '../types';
import { monthlyIncomeFromDetailed } from '../lib/incomeMath';
import { formatCurrency } from '../lib/currency';
import { isDataShareReminderNotification, recordDataShareDismissal } from '../lib/dataSharingReminder';

interface NotificationsProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
  setView: (view: View) => void;
}

type LiveAlert = {
  id: string;
  severity: 'critical' | 'strategy' | 'success';
  title: string;
  message: string;
  view: View;
};

const Notifications: React.FC<NotificationsProps> = ({ state, updateState, setView }) => {
  const notifications = state.notifications || [];

  const markAllRead = () => {
    updateState({ notifications: notifications.map(n => ({ ...n, read: true })) });
  };

  const clearAll = () => {
    if (notifications.some(note => isDataShareReminderNotification(note.id))) {
      recordDataShareDismissal(1);
    }
    updateState({ notifications: [] });
  };

  const removeOne = (id: string) => {
    if (isDataShareReminderNotification(id)) {
      recordDataShareDismissal(1);
    }
    updateState({ notifications: notifications.filter(n => n.id !== id) });
  };

  const liveAlerts = useMemo<LiveAlert[]>(() => {
    const list: LiveAlert[] = [];
    const monthlyIncome = monthlyIncomeFromDetailed(state.profile.income)
      + state.family
        .filter(member => member.includeIncomeInPlanning !== false)
        .reduce((sum, member) => sum + monthlyIncomeFromDetailed(member.income), 0);

    const monthlyExpenses = state.detailedExpenses.reduce((sum, item) => sum + (item.amount || 0), 0) || state.profile.monthlyExpenses || 0;
    const totalMonthlyDebt = state.loans.reduce((sum, loan) => sum + (loan.emi || 0), 0);
    const liquidAssets = state.assets
      .filter(asset => ['Liquid', 'Debt'].includes(asset.category))
      .reduce((sum, asset) => sum + (asset.currentValue || 0), 0);

    const hasFinancialNode = monthlyIncome > 0 && monthlyExpenses > 0 && state.assets.length > 0;
    const dti = monthlyIncome > 0 ? (totalMonthlyDebt / monthlyIncome) * 100 : 0;

    if (hasFinancialNode && !state.riskProfile) {
      list.push({
        id: 'live-risk-profile-missing',
        severity: 'strategy',
        title: 'Risk profile pending',
        message: 'Complete risk profile to align allocation, returns, and goal timelines.',
        view: 'risk-profile',
      });
    }

    if (dti >= 40) {
      list.push({
        id: 'live-high-dti',
        severity: 'critical',
        title: 'Debt load is high',
        message: `Current DTI is ${dti.toFixed(1)}%. Review EMI obligations and refinancing options.`,
        view: 'debt',
      });
    }

    if (monthlyExpenses > 0) {
      const emergencyTarget = monthlyExpenses * 12;
      if (liquidAssets < emergencyTarget) {
        list.push({
          id: 'live-emergency-gap',
          severity: 'critical',
          title: 'Emergency corpus gap',
          message: `Liquid + debt assets (${formatCurrency(liquidAssets, state.profile.country)}) are below 12-month expense cover (${formatCurrency(emergencyTarget, state.profile.country)}).`,
          view: 'insurance',
        });
      }
    }

    if (state.goals.length > 0) {
      const totalTarget = state.goals.reduce((sum, goal) => sum + (goal.targetAmountToday || 0), 0);
      const totalCurrent = state.goals.reduce((sum, goal) => sum + (goal.currentAmount || 0), 0);
      if (totalTarget > 0) {
        const fundedPct = (totalCurrent / totalTarget) * 100;
        if (fundedPct < 25) {
          list.push({
            id: 'live-goal-funding-gap',
            severity: 'strategy',
            title: 'Goal funding is behind plan',
            message: `Current funding is ${fundedPct.toFixed(0)}% of target corpus. Prioritize high-priority goals first.`,
            view: 'goals',
          });
        }
      }
    }

    if (state.insurance.length === 0 && (state.loans.length > 0 || state.goals.length > 0)) {
      list.push({
        id: 'live-insurance-inventory-empty',
        severity: 'strategy',
        title: 'Insurance inventory missing',
        message: 'Add term and health policies to compare current cover vs required cover and deficit.',
        view: 'insurance',
      });
    }

    return list;
  }, [state]);

  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const severityIcon = (type: Notification['type'] | LiveAlert['severity']) => {
    if (type === 'critical') return <AlertCircle size={22} />;
    if (type === 'strategy') return <Zap size={22} />;
    return <ShieldCheck size={22} />;
  };

  const severityClass = (type: Notification['type'] | LiveAlert['severity']) => {
    if (type === 'critical') return 'bg-rose-50 text-rose-600 border-rose-100';
    if (type === 'strategy') return 'bg-teal-50 text-teal-600 border-teal-100';
    return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      <div className="surface-dark p-10 md:p-14 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <Bell size={14} /> Alert Center
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">Actionable Notifications</h2>
            <p className="text-slate-300 text-sm md:text-base font-medium max-w-2xl">
              Shows live financial alerts from your current plan and your saved notification history.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={markAllRead} className="px-6 py-3 bg-white/10 border border-white/15 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">Mark All Read</button>
            <button onClick={clearAll} className="px-6 py-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all">Clear Saved</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Alerts</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{liveAlerts.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saved Notifications</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{notifications.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unread</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{notifications.filter(n => !n.read).length}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-black text-slate-900">Live Alerts From Your Plan</h3>
        {liveAlerts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-sm text-slate-500">
            No active risk or planning alerts right now.
          </div>
        ) : (
          liveAlerts.map(alert => (
            <div key={alert.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${severityClass(alert.severity)}`}>
                  {severityIcon(alert.severity)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900">{alert.title}</p>
                  <p className="text-sm text-slate-600">{alert.message}</p>
                </div>
              </div>
              <button
                onClick={() => setView(alert.view)}
                className="px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition-all"
              >
                Open <ArrowRight size={12} className="inline ml-1" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-black text-slate-900">Saved Notification History</h3>
        {sortedNotifications.length === 0 ? (
          <div className="py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4 opacity-80">
            <div className="p-5 bg-slate-50 rounded-2xl text-slate-300"><Bell size={40} /></div>
            <div>
              <h4 className="font-black text-slate-900 uppercase text-sm tracking-widest">No Saved Notifications</h4>
              <p className="text-slate-400 font-medium text-sm">You will see app-generated updates here.</p>
            </div>
          </div>
        ) : (
          sortedNotifications.map(note => (
            <div key={note.id} className={`bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between ${note.read ? 'opacity-75' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${severityClass(note.type)}`}>
                  {severityIcon(note.type)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-slate-900">{note.title}</p>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={10} /> {new Date(note.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{note.message}</p>
                </div>
              </div>
              <button onClick={() => removeOne(note.id)} className="p-3 self-start rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
