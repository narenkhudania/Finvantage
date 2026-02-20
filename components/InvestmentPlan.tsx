
import React, { useMemo, useState } from 'react';
import { FinanceState, Asset, RiskLevel } from '../types';
import { 
  TrendingUp, BarChart3, PieChart, Wallet, 
  ArrowUpRight, Info, AlertCircle, CheckCircle2, 
  Circle, Coins, Landmark, Briefcase, Home, Activity,
  Zap, ChevronRight, ShieldCheck, Sparkles, LayoutGrid,
  ArrowRight, ArrowDownRight, RefreshCw, ListChecks
} from 'lucide-react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { formatCurrency } from '../lib/currency';

const ASSET_ICONS: Record<string, any> = {
  'Liquid': Landmark,
  'Debt': Briefcase,
  'Equity': TrendingUp,
  'Real Estate': Home,
  'Gold/Silver': Coins,
  'Personal': Activity
};

interface Recommendation {
  instrument: string;
  category: string;
  weight: number;
  reason: string;
  minThreshold?: number;
  type: 'core' | 'alpha' | 'safety';
}

const InvestmentPlan: React.FC<{ state: FinanceState }> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'strategy'>('strategy');
  const totalAssets = useMemo(() => state.assets.reduce((sum, a) => sum + a.currentValue, 0), [state.assets]);
  
  const currentAllocation = useMemo(() => {
    const groups = state.assets.reduce((acc, asset) => {
      const key = asset.category;
      if (!acc[key]) acc[key] = { value: 0, items: [] };
      acc[key].value += asset.currentValue;
      acc[key].items.push(asset);
      return acc;
    }, {} as Record<string, { value: number, items: Asset[] }>);

    // Explicitly casting Object.entries to fix "Property does not exist on type 'unknown'" errors
    return (Object.entries(groups) as [string, { value: number, items: Asset[] }][]).map(([cat, data]) => ({
      category: cat,
      value: data.value,
      allocation: (data.value / (totalAssets || 1)) * 100,
      growthRate: data.items.reduce((s, a) => s + a.growthRate, 0) / data.items.length
    }));
  }, [state.assets, totalAssets]);

  const weightedAvgReturn = currentAllocation.reduce((sum, a) => sum + (a.growthRate * (a.value / (totalAssets || 1))), 0);

  const idealAllocation = useMemo(() => {
    const risk = state.riskProfile?.level || 'Balanced';
    if (risk === 'Conservative') return { Equity: 25, Debt: 60, 'Gold/Silver': 15, Liquid: 0 };
    if (risk === 'Moderate') return { Equity: 40, Debt: 45, 'Gold/Silver': 10, Liquid: 5 };
    if (risk === 'Balanced') return { Equity: 60, Debt: 30, 'Gold/Silver': 10, Liquid: 0 };
    if (risk === 'Aggressive') return { Equity: 80, Debt: 15, 'Gold/Silver': 5, Liquid: 0 };
    if (risk === 'Very Aggressive') return { Equity: 90, Debt: 5, 'Gold/Silver': 5, Liquid: 0 };
    return { Equity: 60, Debt: 30, 'Gold/Silver': 10, Liquid: 0 };
  }, [state.riskProfile]);

  const driftData = useMemo(() => {
    const labels = ['Equity', 'Debt', 'Gold/Silver'];
    return labels.map(label => {
      const current = currentAllocation.find(a => a.category === label)?.allocation || 0;
      const ideal = (idealAllocation as any)[label] || 0;
      return { subject: label, A: ideal, B: current };
    });
  }, [currentAllocation, idealAllocation]);

  const rebalanceActions = useMemo(() => {
    const actions: { cat: string, drift: number, type: 'buy' | 'sell' }[] = [];
    const labels = ['Equity', 'Debt', 'Gold/Silver'];
    labels.forEach(label => {
      const current = currentAllocation.find(a => a.category === label)?.allocation || 0;
      const ideal = (idealAllocation as any)[label] || 0;
      const drift = current - ideal;
      if (Math.abs(drift) > 2) { // 2% threshold
        actions.push({ cat: label, drift, type: drift > 0 ? 'sell' : 'buy' });
      }
    });
    return actions;
  }, [currentAllocation, idealAllocation]);

  const recommendations = useMemo(() => {
    const risk = state.riskProfile?.level || 'Balanced';
    const nw = totalAssets;
    const recs: Recommendation[] = [];

    if (risk === 'Conservative') {
      recs.push({ instrument: 'FDs / Liquid MFs', category: 'Safety', weight: 60, type: 'safety', reason: 'Focus on capital preservation.' });
      recs.push({ instrument: 'Gold Bonds', category: 'Gold', weight: 15, type: 'safety', reason: 'Hedge against devaluation.' });
      recs.push({ instrument: 'Index Funds', category: 'Equity', weight: 25, type: 'core', reason: 'Low-cost market exposure.' });
    } else if (risk === 'Moderate') {
      recs.push({ instrument: 'Hybrid Funds', category: 'Core', weight: 40, type: 'core', reason: 'Automated rebalancing.' });
      recs.push({ instrument: 'Corporate Debt', category: 'Debt', weight: 30, type: 'safety', reason: 'Better-than-FD yields.' });
      recs.push({ instrument: 'Blue-chip Stocks', category: 'Equity', weight: 30, type: 'alpha', reason: 'Stable market growth.' });
    } else if (risk.includes('Aggressive')) {
      recs.push({ instrument: 'Direct Equity', category: 'Equity', weight: 50, type: 'alpha', reason: 'High-conviction growth.' });
      recs.push({ instrument: 'Small-cap MFs', category: 'Equity', weight: 20, type: 'alpha', reason: 'Emerging sector capture.' });
      if (nw >= 5000000) {
        recs.push({ instrument: 'PMS', category: 'Alpha', weight: 20, type: 'alpha', reason: 'Expert-led portfolio.', minThreshold: 5000000 });
      } else {
        recs.push({ instrument: 'Flexi-cap MFs', category: 'Equity', weight: 20, type: 'core', reason: 'Diversified cap growth.' });
      }
    } else {
      recs.push({ instrument: 'Flexi-cap MFs', category: 'Equity', weight: 40, type: 'core', reason: 'Balanced market exposure.' });
      recs.push({ instrument: 'Debt MFs', category: 'Debt', weight: 30, type: 'safety', reason: 'Liquidity buffer.' });
      recs.push({ instrument: 'Physical Gold', category: 'Gold', weight: 10, type: 'safety', reason: 'Stability anchor.' });
    }
    return recs;
  }, [state.riskProfile, totalAssets]);

  const currencyCountry = state.profile.country;

  return (
    <div className="space-y-6 md:space-y-12 animate-in fade-in duration-1000 pb-24">
      {/* Strategic Header */}
      <div className="surface-dark p-6 md:p-16 rounded-[2rem] md:rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-12">
          <div className="space-y-3 md:space-y-6 text-left">
            <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-teal-500/10 text-teal-300 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <PieChart size={12} className="md:w-[14px] md:h-[14px]"/> Allocation Terminal
            </div>
            <h2 className="text-3xl md:text-7xl font-black tracking-tighter leading-tight md:leading-[0.85]">Portfolio <br/><span className="text-teal-500">Mapping.</span></h2>
            <p className="text-slate-400 text-xs md:text-lg font-medium max-w-lg leading-relaxed">
              Auditing yields against <span className="text-teal-400 font-bold">{state.riskProfile?.level || 'Balanced'} DNA</span> for Ravindra Khudania.
            </p>
          </div>
          
          <div className="flex flex-col gap-4 w-full md:w-auto">
            <div className="bg-white/5 border border-white/10 p-5 md:p-10 rounded-[1.5rem] md:rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-1 md:gap-3 shadow-inner w-full md:min-w-[280px]">
               <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Yield</p>
               <h4 className="text-3xl md:text-5xl font-black text-white tracking-tighter">{weightedAvgReturn.toFixed(2)}%</h4>
            </div>
            <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl w-full">
               <button onClick={() => setActiveTab('strategy')} className={`flex-1 py-2 md:py-3 px-4 md:px-8 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'strategy' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-white'}`}>Strategy</button>
               <button onClick={() => setActiveTab('audit')} className={`flex-1 py-2 md:py-3 px-4 md:px-8 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-white'}`}>Audit</button>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'audit' ? (
        <div className="bg-white rounded-[1.5rem] md:rounded-[5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 md:px-12 py-6 md:py-10 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h3 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">Allocation Audit</h3>
                <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Asset Mix Status</p>
            </div>
            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200">
                <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase">AUM Value</p>
                <p className="text-sm md:text-lg font-black text-slate-900">{formatCurrency(totalAssets, currencyCountry)}</p>
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/30">
                      <th className="px-6 md:px-12 py-4 md:py-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                      <th className="px-4 md:px-8 py-4 md:py-8 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Value</th>
                      <th className="px-4 md:px-8 py-4 md:py-8 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Weight</th>
                      <th className="px-6 md:px-12 py-4 md:py-8 text-[9px] font-black text-teal-600 uppercase tracking-widest text-right">Expected ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentAllocation.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 md:px-12 py-4 md:py-8">
                          <div className="flex items-center gap-3">
                             <div className="p-2 md:p-3 bg-slate-100 text-slate-400 rounded-xl"><Landmark size={18}/></div>
                             <span className="text-sm font-black text-slate-900">{row.category}</span>
                          </div>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-8 text-right text-sm font-black text-slate-900">{formatCurrency(row.value, currencyCountry)}</td>
                      <td className="px-4 md:px-8 py-4 md:py-8 text-center text-sm font-black text-slate-900">{row.allocation.toFixed(1)}%</td>
                      <td className="px-6 md:px-12 py-4 md:py-8 text-right text-sm font-black text-teal-600">{row.growthRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Allocation Drift Map */}
            <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm flex flex-col h-full lg:col-span-1">
               <div className="space-y-1 mb-8">
                  <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl w-fit"><BarChart3 size={24}/></div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Allocation Drift.</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ideal Positioning</p>
               </div>

               <div className="w-full h-64 md:h-80 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={driftData}>
                      <PolarGrid stroke="#f1f5f9" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
                      <Radar name="Ideal" dataKey="A" stroke="#0f766e" strokeWidth={3} fill="#0f766e" fillOpacity={0.1} />
                      <Radar name="Current" dataKey="B" stroke="#f59e0b" strokeWidth={3} fill="#f59e0b" fillOpacity={0.15} />
                    </RadarChart>
                  </ResponsiveContainer>
               </div>
               
               <div className="mt-8 space-y-4">
                  <div className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-teal-600" />
                        <span className="text-[10px] font-black text-slate-500 uppercase">Ideal Strat</span>
                     </div>
                     <CheckCircle2 size={14} className="text-teal-600" />
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-amber-50/50 rounded-2xl border border-amber-100">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-black text-amber-600 uppercase">Current Drift</span>
                     </div>
                     <AlertCircle size={14} className="text-amber-500" />
                  </div>
               </div>
            </div>

            {/* Strategic Recommendations Feed */}
            <div className="lg:col-span-2 space-y-8">
               <div className="surface-dark p-10 rounded-[3.5rem] text-white relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full" />
                  <div className="relative z-10 space-y-8">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/10 rounded-2xl"><RefreshCw className="text-emerald-400" size={24}/></div>
                        <h3 className="text-2xl font-black italic tracking-tight">Rebalancing To-Do.</h3>
                     </div>
                     <div className="space-y-4">
                        {rebalanceActions.map((action, i) => (
                           <div key={i} className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-3xl group hover:bg-white/10 transition-all">
                              <div className="flex items-center gap-4">
                                 {action.type === 'sell' ? <ArrowDownRight className="text-rose-400" size={20}/> : <ArrowUpRight className="text-emerald-400" size={20}/>}
                                 <div>
                                    <p className="text-base font-black capitalize">{action.type === 'sell' ? 'Reduce' : 'Increase'} {action.cat}</p>
                                    <p className="text-[9px] font-black text-slate-500 uppercase">Recommended Shift: {Math.abs(action.drift).toFixed(1)}% of Portfolio</p>
                                 </div>
                              </div>
                              <div className="px-4 py-2 bg-white/5 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10">Execute Move</div>
                           </div>
                        ))}
                        {rebalanceActions.length === 0 && <p className="text-sm text-slate-500 italic">Portfolio is perfectly aligned with your risk DNA.</p>}
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:border-teal-400 transition-all flex flex-col justify-between group">
                       <div className="space-y-6">
                          <div className="flex justify-between items-start">
                             <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                               rec.type === 'alpha' ? 'bg-teal-50 text-teal-600 border-teal-100' :
                               rec.type === 'safety' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                               'bg-slate-50 text-slate-600 border-slate-100'
                             }`}>
                                {rec.category}
                             </div>
                             <h4 className="text-2xl font-black text-slate-900">{rec.weight}%</h4>
                          </div>
                          <div className="space-y-2">
                             <h5 className="text-xl font-black text-slate-900 leading-tight group-hover:text-teal-600 transition-colors">{rec.instrument}</h5>
                             <p className="text-sm font-medium text-slate-500 leading-relaxed">{rec.reason}</p>
                          </div>
                       </div>
                       
                       <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
                          <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-teal-600 transition-colors">
                             View Options <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestmentPlan;
