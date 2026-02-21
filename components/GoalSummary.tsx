
import React, { useMemo, useState } from 'react';
import { 
  ClipboardList, Target, Calculator, TrendingUp, 
  Calendar, ArrowUpRight, Info, AlertCircle, Sparkles,
  Layers, CheckCircle2, Circle, ArrowRight, Wallet,
  PieChart, RefreshCw, Zap, Activity, ShieldCheck, Edit3
} from 'lucide-react';
import { FinanceState, Goal, RelativeDate } from '../types';
import { formatCurrency } from '../lib/currency';
import { buildBucketDiscountFactors, getGoalIntervalYears, getLifeExpectancyYear, getRiskReturnAssumption, inflateByBuckets } from '../lib/financeMath';

const GoalSummary: React.FC<{ state: FinanceState }> = ({ state }) => {
  const [hoveredGoalId, setHoveredGoalId] = useState<string | null>(null);
  
  const currentYear = new Date().getFullYear();
  const birthYear = state.profile.dob ? new Date(state.profile.dob).getFullYear() : currentYear - 30;

  const resolveYear = (rel: RelativeDate): number => {
    switch (rel.type) {
      case 'Year': return rel.value;
      case 'Age': return birthYear + rel.value;
      case 'Retirement': return birthYear + state.profile.retirementAge + rel.value;
      case 'LifeExpectancy': return birthYear + state.profile.lifeExpectancy + rel.value;
      default: return rel.value;
    }
  };

  const goalsData = useMemo(() => {
    const baseReturn = getRiskReturnAssumption(state.riskProfile?.level);
    const discountSettings = state.discountSettings;
    const discountFallback = discountSettings?.defaultDiscountRate ?? baseReturn;
    const retirementYear = state.profile.dob
      ? new Date(state.profile.dob).getFullYear() + state.profile.retirementAge
      : (currentYear + 30);

    const maxGoalYear = state.goals.reduce((maxYear, goal) => {
      return Math.max(maxYear, resolveYear(goal.endDate));
    }, currentYear + 1);
    const endYear = Math.max(
      maxGoalYear,
      getLifeExpectancyYear(state.profile.dob, state.profile.lifeExpectancy) ?? (currentYear + 35),
    );

    const discountFactors = buildBucketDiscountFactors(currentYear, endYear, retirementYear, discountSettings, discountFallback);
    const inflateFromCurrent = (amount: number, fromYear: number, toYear: number, rate: number) => {
      if (toYear <= fromYear) return amount;
      if (!discountSettings?.useBucketInflation) {
        const years = Math.max(0, toYear - fromYear);
        return amount * Math.pow(1 + (rate / 100), years);
      }
      return inflateByBuckets(amount, fromYear, toYear, currentYear, retirementYear, discountSettings, rate);
    };

    return state.goals
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((goal, idx) => {
        const sYear = resolveYear(goal.startDate);
        const eYear = resolveYear(goal.endDate);
        const yearsToStart = Math.max(0, sYear - currentYear);
        const inflationFallback = discountSettings?.defaultInflationRate ?? goal.inflationRate;
        const fvAtStart = discountSettings?.useBucketInflation
          ? inflateByBuckets(goal.targetAmountToday, currentYear, sYear, currentYear, retirementYear, discountSettings, inflationFallback)
          : (goal.startGoalAmount ?? (goal.targetAmountToday * Math.pow(1 + (goal.inflationRate / 100), yearsToStart)));

        let sumCorpus = 0;
        let currentCorpusRequired = 0;
        let corpusToday = 0;
        for (let year = sYear; year <= eYear; year++) {
          const nominal = (() => {
            if (!goal.isRecurring) {
              return year === eYear ? fvAtStart : 0;
            }
            const yearsFromStart = Math.max(0, year - sYear);
            const baseAmount = discountSettings?.useBucketInflation
              ? inflateByBuckets(fvAtStart, sYear, year, currentYear, retirementYear, discountSettings, inflationFallback)
              : fvAtStart * Math.pow(1 + (goal.inflationRate / 100), yearsFromStart);
            const interval = getGoalIntervalYears(goal.frequency, goal.frequencyIntervalYears);
            if (interval > 1 && (year - sYear) % interval !== 0) {
              return 0;
            }
            if (goal.frequency === 'Monthly') {
              return baseAmount * 12;
            }
            return baseAmount;
          })();

          if (nominal <= 0) continue;
          sumCorpus += nominal;
          const factor = discountFactors[year] || 1;
          currentCorpusRequired += nominal / factor;
        }

        if (!goal.isRecurring) {
          corpusToday = inflateFromCurrent(goal.targetAmountToday, currentYear, eYear, inflationFallback);
        } else {
          for (let year = sYear; year <= eYear; year++) {
            const interval = getGoalIntervalYears(goal.frequency, goal.frequencyIntervalYears);
            if (interval > 1 && (year - sYear) % interval !== 0) continue;
            const baseAmount = inflateFromCurrent(goal.targetAmountToday, currentYear, year, inflationFallback);
            corpusToday += goal.frequency === 'Monthly' ? baseAmount * 12 : baseAmount;
          }
        }

        const progressPct = sumCorpus > 0 ? Math.min(100, (goal.currentAmount / sumCorpus) * 100) : 0;

        return {
          ...goal,
          srNo: idx + 1,
          startYear: sYear,
          endYear: eYear,
          corpusAtStart: fvAtStart,
          corpusToday,
          sumCorpus,
          currentCorpusRequired,
          progressPct
        };
      });
  }, [state.goals, state.profile, state.riskProfile, state.discountSettings, currentYear, birthYear]);

  const totalCorpusToday = goalsData.reduce((acc, g) => acc + (g.corpusToday || 0), 0);
  const totalCurrentCorpus = goalsData.reduce((acc, g) => acc + g.currentCorpusRequired, 0);
  const totalSumCorpus = goalsData.reduce((acc, g) => acc + g.sumCorpus, 0);
  const totalSpent = goalsData.reduce((acc, g) => acc + (g.currentAmount || 0), 0);

  const categoryDefaultReturns: Record<string, number> = {
    Equity: 15,
    Debt: 8,
    'Gold/Silver': 7,
    Liquid: 3,
    'Real Estate': 5,
  };
  const availableAssets = state.assets.filter(a => a.availableForGoals);
  const assetPool = availableAssets.length > 0 ? availableAssets : state.assets;
  const totalAssetValue = assetPool.reduce((sum, a) => sum + a.currentValue, 0);
  const currentAvailableReturn = totalAssetValue > 0
    ? assetPool.reduce((sum, a) => {
        const fallback = categoryDefaultReturns[a.category] ?? 0;
        const rate = Number.isFinite(a.growthRate as number) ? (a.growthRate as number) : fallback;
        return sum + (a.currentValue * rate);
      }, 0) / totalAssetValue
    : 0;

  const fallbackRecommended = (() => {
    const risk = state.riskProfile?.level || 'Balanced';
    if (risk === 'Conservative') return { equity: 25, debt: 60, gold: 15, liquid: 0 };
    if (risk === 'Moderate') return { equity: 40, debt: 45, gold: 10, liquid: 5 };
    if (risk === 'Balanced') return { equity: 60, debt: 30, gold: 10, liquid: 0 };
    if (risk === 'Aggressive') return { equity: 80, debt: 15, gold: 5, liquid: 0 };
    if (risk === 'Very Aggressive') return { equity: 90, debt: 5, gold: 5, liquid: 0 };
    return { equity: 60, debt: 30, gold: 10, liquid: 0 };
  })();
  const recommendedAllocation = state.riskProfile?.recommendedAllocation ?? fallbackRecommended;
  const recommendedReturn = (
    (recommendedAllocation.equity || 0) * categoryDefaultReturns.Equity +
    (recommendedAllocation.debt || 0) * categoryDefaultReturns.Debt +
    (recommendedAllocation.gold || 0) * categoryDefaultReturns['Gold/Silver'] +
    (recommendedAllocation.liquid || 0) * categoryDefaultReturns.Liquid
  ) / 100;

  const currencyCountry = state.profile.country;

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-24">
      {/* Header Strategy Node */}
      <div className="surface-dark p-12 md:p-16 rounded-[5rem] text-white relative overflow-hidden shadow-2xl shadow-teal-900/30">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <Layers size={14}/> Goal Funding Terminal
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">Funding <br/><span className="text-teal-500">Summary.</span></h2>
          </div>
          
          <div className="bg-white/5 border border-white/10 p-10 rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-3 shadow-inner">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Corpus (Nominal)</p>
             <h4 className="text-4xl md:text-5xl font-black text-white tracking-tighter">{formatCurrency(totalSumCorpus, currencyCountry, { maximumFractionDigits: 0 })}</h4>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Corpus Required Today</p>
             <h4 className="text-xl md:text-2xl font-black text-emerald-300 tracking-tight">{formatCurrency(totalCorpusToday, currencyCountry, { maximumFractionDigits: 0 })}</h4>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-100">
          <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Goal Cost Summary</h3>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-2">Inflation-adjusted requirement, original start corpus, and total contributed so far.</p>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Sr No</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Summary</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Corpus Required Today</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Corpus Required at Start</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Total Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {goalsData.map(goal => (
                <tr key={`${goal.id}-cost`} className="hover:bg-teal-50/30 transition-colors">
                  <td className="px-6 py-4 text-xs font-black text-slate-900">{goal.srNo}</td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-700">{goal.type}</td>
                  <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(goal.corpusToday || 0), currencyCountry)}</td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600 text-right">
                    {formatCurrency(Math.round(goal.corpusAtStart || 0), currencyCountry)}
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(goal.currentAmount || 0), currencyCountry)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50/60">
                <td className="px-6 py-4 text-xs font-black text-slate-500" colSpan={2}>Total</td>
                <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(totalCorpusToday), currencyCountry)}</td>
                <td className="px-6 py-4 text-xs font-black text-slate-500 text-right">—</td>
                <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(totalSpent), currencyCountry)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={18} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current</p>
              <h4 className="text-sm font-black text-slate-900">Available Asset Return</h4>
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">{currentAvailableReturn.toFixed(2)}%</div>
          <div className="w-full h-2 bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, currentAvailableReturn)}%` }} />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-2xl"><ShieldCheck size={18} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Planner</p>
              <h4 className="text-sm font-black text-slate-900">Recommended Allocation Return</h4>
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">{recommendedReturn.toFixed(2)}%</div>
          <div className="w-full h-2 bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-slate-700" style={{ width: `${Math.min(100, recommendedReturn)}%` }} />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-2xl"><Activity size={18} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delta</p>
              <h4 className="text-sm font-black text-slate-900">Return Gap</h4>
            </div>
          </div>
          <div className={`text-3xl font-black ${currentAvailableReturn >= recommendedReturn ? 'text-emerald-600' : 'text-rose-600'}`}>
            {(currentAvailableReturn - recommendedReturn).toFixed(2)}%
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">
            {currentAvailableReturn >= recommendedReturn ? 'Above target' : 'Below target'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-100">
          <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Goal Funding Summary</h3>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-2">Current corpus is discounted by the year-specific return curve.</p>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[1100px] text-left">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Sr No</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Summary</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Current Value</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Inflation</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Occurrence</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Start Year</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">End Year</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Current Corpus Required</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Corpus Required at Start</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Sum of Corpus Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {goalsData.map(goal => (
                <tr key={goal.id} className="hover:bg-teal-50/30 transition-colors">
                  <td className="px-6 py-4 text-xs font-black text-slate-900">{goal.srNo}</td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-700">{goal.type}</td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(Math.round(goal.targetAmountToday), currencyCountry)}</td>
                  <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">{goal.inflationRate}%</td>
                  <td className="px-4 py-4 text-[11px] font-bold text-slate-600">
                    {goal.isRecurring
                      ? (goal.frequencyIntervalYears && goal.frequency?.toLowerCase().includes('every')
                        ? `Every ${goal.frequencyIntervalYears} Years`
                        : (goal.frequency || 'Yearly'))
                      : 'One time'}
                  </td>
                  <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">{goal.startYear}</td>
                  <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">{goal.endYear}</td>
                  <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(goal.currentCorpusRequired), currencyCountry)}</td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600 text-right">
                    {goal.isRecurring ? '—' : formatCurrency(Math.round(goal.corpusAtStart), currencyCountry)}
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(goal.sumCorpus), currencyCountry)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50/60">
                <td className="px-6 py-4 text-xs font-black text-slate-500" colSpan={7}>Total</td>
                <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(totalCurrentCorpus), currencyCountry)}</td>
                <td className="px-6 py-4 text-xs font-black text-slate-500 text-right">—</td>
                <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(totalSumCorpus), currencyCountry)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {goalsData.map((goal) => (
          <div 
            key={goal.id} 
            className="bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-teal-400 transition-all flex flex-col justify-between min-h-[420px]"
            onMouseEnter={() => setHoveredGoalId(goal.id)}
            onMouseLeave={() => setHoveredGoalId(null)}
          >
             {/* Actuarial Tooltip Overlay */}
             <div className={`absolute inset-0 bg-slate-900/95 backdrop-blur-md p-10 text-white z-20 transition-all duration-500 flex flex-col justify-center gap-6 ${hoveredGoalId === goal.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
                <div className="flex items-center gap-4 text-teal-400 border-b border-white/10 pb-4">
                   <Zap size={24}/>
                   <h5 className="text-xl font-black uppercase tracking-tight">Actuarial Forecast</h5>
                </div>
                <div className="space-y-3 text-left">
                   <div className="flex justify-between text-xs font-bold"><span className="opacity-70 uppercase tracking-widest">Inflation Burden</span><span className="text-rose-400">+{goal.inflationRate}% p.a.</span></div>
                   <div className="flex justify-between text-xs font-bold"><span className="opacity-70 uppercase tracking-widest">Projected FV (Year {goal.startYear})</span><span className="text-teal-400">{formatCurrency(Math.round(goal.corpusAtStart), currencyCountry)}</span></div>
                   <div className="flex justify-between text-xs font-bold"><span className="opacity-70 uppercase tracking-widest">Current Corpus Required</span><span className="text-teal-400">{formatCurrency(Math.round(goal.currentCorpusRequired), currencyCountry)}</span></div>
                   <div className="flex justify-between text-xs font-bold"><span className="opacity-70 uppercase tracking-widest">Global Sum Required</span><span className="text-teal-400">{formatCurrency(Math.round(goal.sumCorpus), currencyCountry)}</span></div>
                   <div className="flex justify-between text-xs font-bold border-t border-white/10 pt-4"><span className="opacity-70 uppercase tracking-widest">Funding Deficit</span><span className="text-emerald-400">{formatCurrency(Math.max(0, Math.round(goal.sumCorpus - goal.currentAmount)), currencyCountry)}</span></div>
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed mt-4">Simulated with priority rank {goal.priority}. Cross-asset dependencies applied.</p>
             </div>

             <div className="flex justify-between items-start mb-8 text-left">
                <div className="flex items-center gap-6">
                   <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl">
                      {goal.priority}
                   </div>
                   <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{goal.description || goal.type}</h3>
                      <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mt-1">{goal.startYear} — {goal.endYear}</p>
                   </div>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-teal-50 transition-colors">
                  <Edit3 size={18} className="text-slate-300 group-hover:text-teal-600" />
                </div>
             </div>

             <div className="space-y-8 flex-1 text-left">
                <div className="space-y-3">
                   <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Funding Progress (vs FV Target)</span>
                      <span className="text-xl font-black text-slate-900">{goal.progressPct.toFixed(1)}%</span>
                   </div>
                   <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative">
                      <div className={`h-full bg-teal-600 transition-all duration-1000 ease-out`} style={{ width: `${goal.progressPct}%` }} />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saved to Date</p>
                      <h4 className="text-2xl font-black text-slate-900">{formatCurrency(goal.currentAmount, currencyCountry)}</h4>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Future Target (FV)</p>
                      <h4 className="text-2xl font-black text-teal-600">{formatCurrency(Math.round(goal.sumCorpus), currencyCountry)}</h4>
                   </div>
                </div>
             </div>

             <div className="mt-10 pt-8 border-t border-slate-50 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Strategic Resource Waterfall</p>
                <div className="flex flex-wrap gap-2">
                   {goal.resourceBuckets.map(rb => (
                      <span key={rb} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                         <CheckCircle2 size={12}/> {rb}
                      </span>
                   ))}
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoalSummary;
