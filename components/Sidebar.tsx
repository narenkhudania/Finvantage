
import React, { useMemo } from 'react';
import { 
  LayoutDashboard, Target, ShieldCheck, 
  TrendingUp, X, Users, Calculator, 
  Landmark, BrainCircuit, ChevronRight, Zap,
  BarChartHorizontal, ClipboardList, Wallet, ListChecks, CalendarRange,
  ArrowDownRight, Receipt, CreditCard, Shield
} from 'lucide-react';
import { View, FinanceState } from '../types';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
  onClose?: () => void;
  state: FinanceState;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onClose, state }) => {
  const totalAssets = useMemo(() => state.assets.reduce((sum, a) => sum + a.currentValue, 0), [state.assets]);
  const totalLoans = useMemo(() => state.loans.reduce((sum, l) => sum + l.outstandingAmount, 0), [state.loans]);
  const netWorth = totalAssets - totalLoans;

  const navGroups = [
    {
      label: 'Main Ops',
      items: [
        { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
        { id: 'action-plan', label: 'Action Strategy', icon: ListChecks },
        { id: 'monthly-savings', label: 'Budget Matrix', icon: CalendarRange },
      ]
    },
    {
      label: 'Financial Node',
      items: [
        { id: 'family', label: 'Household', icon: Users },
        { id: 'inflow', label: 'Inflow (Income)', icon: TrendingUp },
        { id: 'outflow', label: 'Outflow (Burn)', icon: ArrowDownRight },
        { id: 'assets', label: 'Inventory', icon: Landmark },
        { id: 'debt', label: 'Liabilities', icon: CreditCard },
      ]
    },
    {
      label: 'Future Missions',
      items: [
        { id: 'goals', label: 'Life Goals', icon: Target },
        { id: 'cashflow', label: 'Wealth Radar', icon: BarChartHorizontal },
        { id: 'investment-plan', label: 'Portfolio Map', icon: Wallet },
      ]
    },
    {
      label: 'Security',
      items: [
        { id: 'risk-profile', label: 'Risk Identity', icon: BrainCircuit },
        { id: 'insurance', label: 'Shield Configuration', icon: ShieldCheck },
        { id: 'tax-estate', label: 'Tax & Compliance', icon: Shield },
      ]
    }
  ];

  return (
    <aside className="h-full w-full flex flex-col bg-[#05070a] text-white border-r border-white/5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-600/10 to-transparent pointer-events-none" />
      
      <div className="p-8 md:p-10 relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3 group cursor-pointer shrink-0" onClick={() => setView('dashboard')}>
            <div className="bg-indigo-600 p-2 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)]">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tighter italic">FinVantage<span className="text-indigo-600">.</span></span>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl lg:hidden">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Wealth Summary Block */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-4 mb-10 shadow-2xl backdrop-blur-md">
           <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Household Net Worth</p>
           <h4 className="text-base font-black text-white tracking-tight break-all">₹{netWorth.toLocaleString()}</h4>
           <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
              <div className="flex -space-x-1.5">
                 {[...Array(3)].map((_, i) => (
                   <div key={i} className="w-5 h-5 rounded-full border border-slate-900 bg-indigo-600 flex items-center justify-center text-[7px] font-black">
                      {i === 0 ? 'P' : 'S'}
                   </div>
                 ))}
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                 <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Active</span>
              </div>
           </div>
        </div>

        {/* Navigation Layers */}
        <div className="space-y-8 flex-1 overflow-y-auto no-scrollbar pb-6 pr-2">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-2">
               <h5 className="px-4 text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">{group.label}</h5>
               <nav className="space-y-1">
                 {group.items.map((item) => {
                   const Icon = item.icon;
                   const isActive = currentView === item.id;
                   return (
                     <button
                       key={item.id}
                       onClick={() => {
                         setView(item.id as View);
                         if (onClose) onClose();
                       }}
                       className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all duration-300 group ${
                         isActive 
                           ? 'bg-indigo-600 text-white shadow-xl translate-x-1' 
                           : 'text-slate-500 hover:bg-white/[0.04] hover:text-white'
                       }`}
                     >
                       <div className="flex items-center gap-3">
                          <Icon size={16} className={`${isActive ? 'scale-110' : 'group-hover:text-indigo-400'} transition-all shrink-0`} />
                          <span className="text-[11px] font-bold tracking-tight text-left leading-none">{item.label}</span>
                       </div>
                       {isActive && <ChevronRight size={10} className="opacity-40" />}
                     </button>
                   );
                 })}
               </nav>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
