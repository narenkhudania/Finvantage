
import React, { useState, useMemo } from 'react';
import { FinanceState, Insurance, InsuranceCategory, InsuranceType } from '../types';
import { 
  ShieldCheck, Plus, Trash2, User, Activity, AlertCircle, 
  ChevronDown, Calculator, TrendingUp, Wallet, ArrowUpRight,
  ShieldAlert, CheckCircle2, Info, Landmark, BarChart3, ArrowRight
} from 'lucide-react';

const Insurances: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'analysis'>('analysis');
  const [analysisConfig, setAnalysisConfig] = useState({
    inflation: 6,
    investmentRate: 11.5,
    replacementYears: 20,
    immediateNeeds: 1000000,
    financialAssetDiscount: 50
  });

  const [newPolicy, setNewPolicy] = useState<Partial<Insurance>>({
    category: 'Life Insurance',
    type: 'Term',
    proposer: 'self',
    insured: 'self',
    sumAssured: 0,
    premium: 0,
    isMoneyBack: false,
    moneyBackYears: [],
    moneyBackAmounts: []
  });

  const handleAdd = () => {
    const policy = { ...newPolicy, id: Math.random().toString(36).substr(2, 9) } as Insurance;
    updateState({ insurance: [...state.insurance, policy] });
    setShowAdd(false);
  };

  const removePolicy = (id: string) => {
    updateState({ insurance: state.insurance.filter(p => p.id !== id) });
  };

  const getMemberName = (id: string) => {
    if (id === 'self') return state.profile.firstName || 'Self';
    return state.family.find(f => f.id === id)?.name || 'Unknown';
  };

  const hlvData = useMemo(() => {
    const realRate = ((1 + analysisConfig.investmentRate / 100) / (1 + analysisConfig.inflation / 100)) - 1;
    const annualExpenses = (state.detailedExpenses.reduce((s, e) => s + e.amount, 0) || state.profile.monthlyExpenses) * 12;
    const pvFactor = (1 - Math.pow(1 + realRate, -analysisConfig.replacementYears)) / realRate;
    const expenseReplacement = annualExpenses * pvFactor;
    const totalDebt = state.loans.reduce((sum, l) => sum + l.outstandingAmount, 0);
    const goalRequirements = state.goals.reduce((sum, g) => sum + (g.targetAmountToday * (g.type === 'Retirement' ? 0.6 : 1)), 0);
    const totalExistingInsurance = state.insurance.filter(p => p.category === 'Life Insurance').reduce((sum, p) => sum + p.sumAssured, 0);
    const liquidAssets = state.assets.filter(a => ['Liquid', 'Equity', 'Debt'].includes(a.category)).reduce((sum, a) => sum + a.currentValue, 0);
    const usableAssets = liquidAssets * (analysisConfig.financialAssetDiscount / 100);
    const totalRequirement = analysisConfig.immediateNeeds + expenseReplacement + totalDebt + goalRequirements;
    const totalAvailable = totalExistingInsurance + usableAssets;
    const gap = totalRequirement - totalAvailable;

    return { expenseReplacement, totalDebt, goalRequirements, totalExistingInsurance, usableAssets, totalRequirement, totalAvailable, gap, safetyScore: Math.min(100, Math.round((totalAvailable / (totalRequirement || 1)) * 100)) };
  }, [state, analysisConfig]);

  return (
    <div className="space-y-8 md:space-y-10 animate-in fade-in duration-700 pb-24">
      {/* Dynamic Header */}
      <div className="bg-[#0b0f1a] p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-12">
          <div className="space-y-4 md:space-y-6">
            <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-indigo-500/10 text-indigo-300 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
              <ShieldCheck size={14}/> Risk Protection Node
            </div>
            <h2 className="text-3xl md:text-7xl font-black tracking-tighter leading-tight md:leading-[0.85]">Shield <br/><span className="text-indigo-500">Security.</span></h2>
            <p className="text-slate-400 text-sm md:text-lg font-medium max-w-lg leading-relaxed">
              Auditing <span className="text-white font-bold">Human Life Value</span> against debt liabilities.
            </p>
          </div>
          
          <div className="bg-white/5 border border-white/10 p-8 md:p-10 rounded-[2rem] md:rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-2 shadow-inner w-full md:w-auto md:min-w-[280px]">
             <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Protection Status</p>
             <h4 className={`text-4xl md:text-5xl font-black tracking-tighter ${hlvData.gap > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
               {hlvData.safetyScore}%
             </h4>
          </div>
        </div>
      </div>

      {/* Tabs - Better for mobile */}
      <div className="flex p-1.5 bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-200 w-full md:w-fit mx-auto shadow-sm">
        <button onClick={() => setActiveTab('analysis')} className={`flex-1 md:flex-none px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-[2rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>Analysis</button>
        <button onClick={() => setActiveTab('inventory')} className={`flex-1 md:flex-none px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-[2rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inventory' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>Inventory</button>
      </div>

      {activeTab === 'analysis' ? (
        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
              <div className="lg:col-span-2 space-y-6 md:space-y-10">
                 <div className="bg-white p-8 md:p-12 rounded-[2rem] md:rounded-[4rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-8 md:mb-10">Parameters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                       <div className="space-y-6">
                          <div className="space-y-3">
                             <div className="flex justify-between items-center"><label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Inflation</label><span className="text-lg md:text-xl font-black text-indigo-600">{analysisConfig.inflation}%</span></div>
                             <input type="range" min="3" max="12" step="0.5" value={analysisConfig.inflation} onChange={e => setAnalysisConfig({...analysisConfig, inflation: parseFloat(e.target.value)})} className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-indigo-600" />
                          </div>
                       </div>
                    </div>
                 </div>
                 {/* Audit Table Scrollable */}
                 <div className="bg-white rounded-[2rem] md:rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                       <h3 className="text-lg md:text-xl font-black text-slate-900">Audit Waterfall</h3>
                    </div>
                    <div className="p-6 md:p-10 overflow-x-auto">
                       <div className="min-w-[400px] space-y-6">
                          <div className="grid grid-cols-2 gap-8">
                             <div className="space-y-3">
                                <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Requirements</p>
                                <div className="flex justify-between text-xs md:text-sm font-bold"><span className="text-slate-500">Debt Repayment</span><span className="text-slate-900">₹{Math.round(hlvData.totalDebt).toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs md:text-sm font-bold"><span className="text-slate-500">Income Replace</span><span className="text-slate-900">₹{Math.round(hlvData.expenseReplacement).toLocaleString()}</span></div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {state.insurance.map((policy) => (
                <div key={policy.id} className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm group transition-all flex flex-col justify-between min-h-[200px]">
                   <div className="flex justify-between items-start">
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${policy.category === 'Life Insurance' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}><ShieldCheck size={24} md:size={28} /></div>
                      <button onClick={() => removePolicy(policy.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                   </div>
                   <div className="mt-4 md:mt-6">
                      <h4 className="text-xl md:text-2xl font-black text-slate-900">₹{policy.sumAssured.toLocaleString()}</h4>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">{policy.type} • {getMemberName(policy.insured)}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default Insurances;
