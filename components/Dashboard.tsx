
import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PieChart as RePie, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  AreaChart, Area, CartesianGrid
} from 'recharts';
import { 
  TrendingUp, Target, Activity, Calculator,
  Zap, Wallet, Landmark, BrainCircuit,
  ArrowRight, ShieldCheck, CheckCircle2, 
  ChevronRight, ArrowUpRight, ShieldAlert, Sparkles,
  Receipt, Briefcase, AlertCircle, Car, CreditCard,
  LayoutGrid, ArrowDownRight, Users, ListChecks,
  PieChart, BarChart3, LineChart, RefreshCw
} from 'lucide-react';
import { FinanceState, DetailedIncome, View, Asset, Loan } from '../types';
import { getJourneyProgress } from '../lib/journey';
import { getRiskReturnAssumption } from '../lib/financeMath';
import { formatCurrency } from '../lib/currency';
import { buildReportSnapshot } from '../lib/report';
import CommandReport from './CommandReport';
import Cashflow from './Cashflow';
import InvestmentPlan from './InvestmentPlan';

interface DashboardProps {
  state: FinanceState;
  setView: (view: View) => void;
}

const COLORS = ['#0f766e', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#84cc16'];

const Dashboard: React.FC<DashboardProps> = ({ state, setView }) => {
  const todayLabel = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  const calculateTotalMemberIncome = (income: DetailedIncome) => {
    return (income.salary || 0) + (income.bonus || 0) + (income.reimbursements || 0) + 
           (income.business || 0) + (income.rental || 0) + (income.investment || 0);
  };

  const totalAssets = useMemo(() => state.assets.reduce((sum, a) => sum + a.currentValue, 0), [state.assets]);
  const totalLoans = useMemo(() => state.loans.reduce((sum, l) => sum + l.outstandingAmount, 0), [state.loans]);
  const netWorth = totalAssets - totalLoans;

  const householdIncome = useMemo(() => {
    const selfIncome = calculateTotalMemberIncome(state.profile.income);
    const familyIncome = state.family.reduce((sum, f) => sum + calculateTotalMemberIncome(f.income), 0);
    return selfIncome + familyIncome;
  }, [state.profile, state.family]);

  const householdExpenses = useMemo(() => {
    return state.detailedExpenses.reduce((sum, e) => sum + e.amount, 0) || state.profile.monthlyExpenses;
  }, [state.detailedExpenses, state.profile.monthlyExpenses]);

  const totalMonthlyDebt = state.loans.reduce((sum, l) => sum + l.emi, 0);
  const surplusValue = householdIncome - householdExpenses - totalMonthlyDebt;
  const savingsRate = householdIncome > 0 ? (surplusValue / householdIncome) * 100 : 0;
  const dtiRatio = householdIncome > 0 ? ((totalMonthlyDebt * 12) / (householdIncome * 12)) * 100 : 0;

  // Chart Data: Asset Mix
  const assetMixData = useMemo(() => {
    const groups = state.assets.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + a.currentValue;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [state.assets]);

  const netWorthSummary = useMemo(() => {
    const financialSet = new Set(['Liquid', 'Debt', 'Equity', 'Gold/Silver']);
    const physicalSet = new Set(['Real Estate']);
    const personalSet = new Set(['Personal']);

    const financial = state.assets
      .filter(a => financialSet.has(a.category))
      .reduce((sum, a) => sum + a.currentValue, 0);
    const physical = state.assets
      .filter(a => physicalSet.has(a.category))
      .reduce((sum, a) => sum + a.currentValue, 0);
    const personal = state.assets
      .filter(a => personalSet.has(a.category))
      .reduce((sum, a) => sum + a.currentValue, 0);

    const total = financial + physical + personal;
    const liabilities = totalLoans;
    const net = total - liabilities;

    return {
      financial,
      physical,
      personal,
      totalAssets: total,
      liabilities,
      netWorth: net,
      pct: (value: number) => (total > 0 ? (value / total) * 100 : 0),
      pctLiabilities: (value: number) => (liabilities > 0 ? (value / liabilities) * 100 : 0),
    };
  }, [state.assets, totalLoans]);

  const statementData = useMemo(() => {
    const financialSet = new Set(['Liquid', 'Debt', 'Equity', 'Gold/Silver']);

    const isResidentialAsset = (asset: Asset) => {
      const label = `${asset.subCategory || ''} ${asset.name || ''}`.toLowerCase();
      return /residential|home|house|apartment|villa|bungalow/.test(label);
    };

    const formatAssetLabel = (asset: Asset) => {
      const name = (asset.name || '').trim();
      const sub = (asset.subCategory || '').trim();
      if (asset.category === 'Gold/Silver') return name ? `Gold (${name})` : 'Gold / Silver';
      if (asset.category === 'Equity') return 'Portfolio (Equity & Mutual Fund)';
      if (asset.category === 'Liquid') return sub ? `Cash in Hand (${sub})` : 'Cash in Hand (Bank Balance)';
      if (asset.category === 'Debt') {
        const combo = `${sub} ${name}`.toLowerCase();
        if (/nps|epf|gpf|dsop/.test(combo)) return 'Other Govt. Schemes (NPS & EPF)';
        return sub || 'Debt Instruments';
      }
      if (asset.category === 'Real Estate') {
        const label = name || sub || 'Property';
        return isResidentialAsset(asset) ? `Residential Property (${label})` : `Investment Property (${label})`;
      }
      if (asset.category === 'Personal') {
        const label = name || sub || 'Personal Asset';
        if (/car|bike|vehicle|two wheeler|two-wheeler/.test(label.toLowerCase())) {
          return `Car / Two Wheeler (${label})`;
        }
        if (/house|home|residential/.test(label.toLowerCase())) {
          return `Residential Property (${label})`;
        }
        return `House Contents (${label})`;
      }
      return name || sub || asset.category;
    };

    const addRow = (map: Record<string, number>, label: string, value: number) => {
      map[label] = (map[label] || 0) + value;
    };

    const investmentsMap: Record<string, number> = {};
    const otherMap: Record<string, number> = {};

    state.assets.forEach(asset => {
      const label = formatAssetLabel(asset);
      const isInvestment = financialSet.has(asset.category) || (asset.category === 'Real Estate' && !isResidentialAsset(asset));
      if (isInvestment) addRow(investmentsMap, label, asset.currentValue);
      else addRow(otherMap, label, asset.currentValue);
    });

    const investments = Object.entries(investmentsMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    const otherAssets = Object.entries(otherMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const totalInvestments = investments.reduce((sum, a) => sum + a.value, 0);
    const totalOtherAssets = otherAssets.reduce((sum, a) => sum + a.value, 0);
    const totalAssets = totalInvestments + totalOtherAssets;

    const liabilities = state.loans
      .map((loan: Loan) => ({ label: `${loan.owner === 'self' ? state.profile.firstName : 'Member'}'s ${loan.type}`.replace("Self's", `${state.profile.firstName}'s`), value: loan.outstandingAmount }))
      .filter(l => l.value > 0)
      .sort((a, b) => b.value - a.value);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.value, 0);
    const netWorth = totalAssets - totalLiabilities;
    const debtToAssets = totalAssets > 0 ? totalLiabilities / totalAssets : 0;

    const majorAssets = [...state.assets]
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, 3)
      .map(a => formatAssetLabel(a));
    const majorLiabilities = [...state.loans]
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
      .slice(0, 2)
      .map(l => `${l.type}`);

    return {
      investments,
      otherAssets,
      liabilities,
      totalInvestments,
      totalOtherAssets,
      totalAssets,
      totalLiabilities,
      netWorth,
      debtToAssets,
      majorAssets,
      majorLiabilities,
    };
  }, [state.assets, state.loans, state.profile.firstName]);

  // Chart Data: Budget Partition
  const budgetData = useMemo(() => [
    { name: 'Survival', value: householdExpenses, color: '#f59e0b' },
    { name: 'Servicing', value: totalMonthlyDebt, color: '#ef4444' },
    { name: 'Success', value: Math.max(0, surplusValue), color: '#0f766e' }
  ], [householdExpenses, totalMonthlyDebt, surplusValue]);

  // Chart Data: Wealth Trajectory (5 Years)
  const trajectoryData = useMemo(() => {
    const data = [];
    let currentNW = netWorth;
    const year = new Date().getFullYear();
    const assumedReturn = getRiskReturnAssumption(state.riskProfile?.level);
    for (let i = 0; i < 6; i++) {
      data.push({ year: year + i, nw: Math.round(currentNW) });
      currentNW = (currentNW * (1 + assumedReturn / 100)) + (surplusValue * 12);
    }
    return data;
  }, [netWorth, surplusValue, state.riskProfile?.level]);

  const journey = useMemo(() => getJourneyProgress(state), [state]);
  const reportSnapshot = useMemo(() => buildReportSnapshot(state), [state]);
  const stepIcons: Record<string, any> = {
    family: Users,
    inflow: TrendingUp,
    outflow: ArrowDownRight,
    assets: Landmark,
    debt: CreditCard,
    goals: Target,
  };
  const initializationSteps = useMemo(() => (
    journey.steps.map(step => ({
      id: step.id,
      label: step.label,
      isComplete: step.complete,
      icon: stepIcons[step.id],
      view: step.view,
    }))
  ), [journey.steps]);

  const completionPct = journey.completionPct;
  const isFullyInitialized = completionPct === 100;
  const gateUnlocked = isFullyInitialized;

  const wellnessData = useMemo(() => {
    const riskScore = state.riskProfile?.score || 20;
    const insuranceScore = state.insurance.length > 0 ? 80 : 20;
    const debtScore = totalLoans === 0 && totalAssets > 0 ? 100 : Math.max(0, 100 - (totalLoans / (totalAssets || 1) * 100));
    const savingsScore = Math.min(100, savingsRate * 3);
    const goalScore = state.goals.length > 0 ? 85 : 20;

    return [
      { subject: 'Risk', A: riskScore, fullMark: 100 },
      { subject: 'Shield', A: insuranceScore, fullMark: 100 },
      { subject: 'Debt', A: debtScore, fullMark: 100 },
      { subject: 'Savings', A: savingsScore, fullMark: 100 },
      { subject: 'Goals', A: goalScore, fullMark: 100 },
    ];
  }, [state, totalAssets, totalLoans, savingsRate]);

  const currencyCountry = state.profile.country;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-24">
      
      {/* Onboarding Directive */}
      {!isFullyInitialized && (
        <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal-50 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-teal-100">
                <Zap size={14} className="animate-pulse"/> Initialization Required
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">Your Strategy Terminal <br/><span className="text-teal-600 underline decoration-teal-100 underline-offset-8">is Offline.</span></h2>
              <div className="space-y-2 pt-2">
                 <div className="flex justify-between items-end px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress to Synchronization</span>
                    <span className="text-2xl font-black text-slate-900">{completionPct}%</span>
                 </div>
                 <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                    <div className="h-full bg-teal-600 transition-all duration-1000" style={{ width: `${completionPct}%` }} />
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               {initializationSteps.map((step) => (
                 <button 
                   key={step.id}
                   onClick={() => setView(step.view)}
                   className={`flex items-center gap-4 p-4 rounded-3xl transition-all border text-left group ${
                     step.isComplete 
                       ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                       : 'bg-slate-50 border-slate-100 text-slate-900 hover:border-teal-300 hover:bg-white'
                   }`}
                 >
                    <div className={`p-2.5 rounded-2xl shrink-0 ${step.isComplete ? 'bg-emerald-500 text-white' : 'bg-white text-slate-300 group-hover:text-teal-600 transition-colors shadow-sm'}`}>
                       <step.icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                       <h4 className="text-xs font-black tracking-tight">{step.label}</h4>
                    </div>
                    {step.isComplete ? <CheckCircle2 size={16} /> : <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1" />}
                 </button>
               ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Stats Node */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Household Equity', value: formatCurrency(netWorth, currencyCountry), sub: 'Net Worth Node', icon: Landmark, color: 'teal' },
          { label: 'Net Monthly Surplus', value: formatCurrency(surplusValue, currencyCountry), sub: `${Math.round(savingsRate)}% Savings Rate`, icon: Wallet, color: 'emerald' },
          { label: 'Debt Service Load', value: `${dtiRatio.toFixed(1)}%`, sub: 'Income-to-Debt Ratio', icon: CreditCard, color: dtiRatio > 40 ? 'rose' : 'slate' },
          { label: 'Asset Capacity', value: formatCurrency(totalAssets, currencyCountry), sub: 'Total Capital Holdings', icon: TrendingUp, color: 'amber' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
            <div className={`w-12 h-12 mb-6 rounded-2xl flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-600 group-hover:bg-${stat.color}-600 group-hover:text-white transition-all`}>
              <stat.icon size={22}/>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</h4>
            <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase flex items-center gap-1.5">
               <span className={`w-1 h-1 rounded-full bg-${stat.color}-500`} /> {stat.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Trajectory Insight */}
        <div className="lg:col-span-2 surface-dark p-10 md:p-14 rounded-[4rem] text-white relative overflow-hidden shadow-2xl border border-white/5">
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[150px] rounded-full translate-x-1/4 -translate-y-1/4 pointer-events-none" />
           <div className="relative z-10 flex flex-col h-full space-y-10">
              <div className="flex justify-between items-start">
                 <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 text-teal-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                       <LineChart size={14}/> Wealth Velocity
                    </div>
                    <h3 className="text-4xl font-black tracking-tight">Projected <span className="text-teal-500">Equity.</span></h3>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">5-Year Target</p>
                    <p className="text-2xl font-black text-emerald-400">{formatCurrency(trajectoryData[trajectoryData.length-1].nw, currencyCountry)}</p>
                 </div>
              </div>

              <div className="flex-1 min-h-[300px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trajectoryData}>
                       <defs>
                          <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3}/>
                             <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                       <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 900}} />
                       <YAxis hide />
                       <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', padding: '12px', fontWeight: 'bold' }}
                          formatter={(val: number) => formatCurrency(val, currencyCountry)}
                       />
                       <Area type="monotone" dataKey="nw" stroke="#0f766e" strokeWidth={4} fillOpacity={1} fill="url(#nwGradient)" />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        {/* Holistic Wellness Radar */}
        <div className="bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm flex flex-col justify-between h-full">
           <div className="space-y-2">
              <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl w-fit"><BrainCircuit size={24}/></div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight italic">Node Health.</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actuarial Calibration</p>
           </div>

           <div className="w-full h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="80%" data={wellnessData}>
                   <PolarGrid stroke="#f1f5f9" />
                   <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
                   <Radar name="Status" dataKey="A" stroke="#0f766e" strokeWidth={3} fill="#0f766e" fillOpacity={0.15} />
                 </RadarChart>
              </ResponsiveContainer>
           </div>

           <button onClick={() => setView('risk-profile')} className="w-full py-5 bg-slate-50 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">
              Recalibrate Risk DNA
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         
         {/* Portfolio Asset Mix Report */}
         <div className="bg-white p-10 md:p-12 rounded-[4rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-10">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><PieChart size={24}/></div>
                  <div>
                     <h3 className="text-xl font-black text-slate-900 tracking-tight">Portfolio Mix.</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Classification</p>
                  </div>
               </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-8">
               <div className="w-56 h-56 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                     <RePie data={assetMixData} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                        {assetMixData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                        ))}
                     </RePie>
                  </ResponsiveContainer>
               </div>
               <div className="flex-1 space-y-4 w-full">
                  {assetMixData.length > 0 ? assetMixData.map((item, i) => (
                     <div key={item.name} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                           <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{item.name}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900">{formatCurrency(item.value, currencyCountry)}</span>
                     </div>
                  )) : (
                     <p className="text-xs text-slate-400 italic">No assets registered to display mix.</p>
                  )}
               </div>
            </div>
         </div>

         {/* Net Worth Summary */}
         <div className="bg-white p-10 md:p-12 rounded-[4rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl"><Landmark size={24}/></div>
                  <div>
                     <h3 className="text-xl font-black text-slate-900 tracking-tight">Net Worth Composition.</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial vs Physical vs Personal</p>
                  </div>
               </div>
               <div className="bg-slate-50 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500">
                 Net Worth: {formatCurrency(netWorthSummary.netWorth, currencyCountry)}
               </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
               <table className="w-full text-left min-w-[520px]">
                  <thead>
                    <tr className="bg-slate-50/50">
                       <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                       <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Value</th>
                       <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">% of Assets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { label: 'Financial Assets', value: netWorthSummary.financial },
                      { label: 'Physical Assets', value: netWorthSummary.physical },
                      { label: 'Personal Assets', value: netWorthSummary.personal },
                    ].map(row => (
                      <tr key={row.label}>
                        <td className="px-6 py-4 text-xs font-black text-slate-900">{row.label}</td>
                        <td className="px-6 py-4 text-right text-xs font-black text-slate-900">{formatCurrency(row.value, currencyCountry)}</td>
                        <td className="px-6 py-4 text-right text-xs font-black text-slate-500">{netWorthSummary.pct(row.value).toFixed(1)}%</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/60">
                      <td className="px-6 py-4 text-xs font-black text-slate-900">Total Assets</td>
                      <td className="px-6 py-4 text-right text-xs font-black text-slate-900">{formatCurrency(netWorthSummary.totalAssets, currencyCountry)}</td>
                      <td className="px-6 py-4 text-right text-xs font-black text-slate-500">100%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-xs font-black text-rose-600">Total Liabilities</td>
                      <td className="px-6 py-4 text-right text-xs font-black text-rose-600">{formatCurrency(netWorthSummary.liabilities, currencyCountry)}</td>
                      <td className="px-6 py-4 text-right text-xs font-black text-rose-400">—</td>
                    </tr>
                  </tbody>
               </table>
            </div>
         </div>

         {/* Strategic Action Feed */}
         <div className="bg-white p-10 md:p-12 rounded-[4rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-center mb-10">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl"><RefreshCw size={24}/></div>
                  <div>
                     <h3 className="text-xl font-black text-slate-900 tracking-tight italic">Rebalancing Alert.</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strategy Corrections</p>
                  </div>
               </div>
            </div>

            <div className="flex-1 space-y-4">
               <div className="p-6 bg-amber-50 border border-amber-100 rounded-[2.5rem] flex items-start gap-4">
                  <AlertCircle size={20} className="text-amber-500 shrink-0 mt-1"/>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Asset Drift Detected</h4>
                    <p className="text-xs font-medium text-slate-600 mt-1">Your Equity allocation has drifted 8.2% above your target Moderate risk profile. Suggested: Liquidate {formatCurrency(1420000, currencyCountry)} and migrate to Debt Core.</p>
                  </div>
               </div>
               <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2.5rem] flex items-start gap-4">
                  <ShieldCheck size={20} className="text-emerald-500 shrink-0 mt-1"/>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Priority Goal Funding</h4>
                    <p className="text-xs font-medium text-slate-600 mt-1">Goal #1 (Retirement) is 74% funded. Redirecting current monthly surplus to this mission is advised.</p>
                  </div>
               </div>
            </div>

            <button onClick={() => setView('investment-plan')} className="mt-8 py-5 bg-slate-900 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-teal-600 transition-all flex items-center justify-center gap-2">
               Execute Portfolio Rebalance <ArrowRight size={14}/>
            </button>
         </div>

      </div>

      <CommandReport snapshot={reportSnapshot} onOpen={setView} />

      {gateUnlocked && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Wealth Radar</p>
              <h3 className="text-2xl font-black text-slate-900">Cashflow + Projection Grid</h3>
            </div>
            <button
              onClick={() => setView('cashflow')}
              className="px-4 py-2 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition"
            >
              Open Full View
            </button>
          </div>
          <Cashflow state={state} />
        </div>
      )}

      {gateUnlocked && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Portfolio Map</p>
              <h3 className="text-2xl font-black text-slate-900">Current vs Recommended Allocation</h3>
            </div>
            <button
              onClick={() => setView('investment-plan')}
              className="px-4 py-2 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition"
            >
              Open Full View
            </button>
          </div>
          <InvestmentPlan state={state} />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
