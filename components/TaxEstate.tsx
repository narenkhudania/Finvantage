
import React, { useState, useMemo } from 'react';
import { FinanceState } from '../types';
import { 
  Calculator, Scroll, UserCheck, ShieldPlus, AlertCircle, ArrowRight, 
  TrendingUp, Info, ArrowUpRight, DollarSign, Wallet, Landmark,
  ArrowDownRight, CheckCircle2, RefreshCw, BarChart3, PieChart, Zap
} from 'lucide-react';

const TaxEstate: React.FC<{ state: FinanceState }> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'estate'>('calculator');
  
  const salaryData = { basic: 1551000, hra: 775500, allowances: 775500, total: 3102000, rentPaid: 600000, isMetro: true };
  const deductions = { sec80C: 407326, sec80CCD1B: 50000, sec80CCD2: 136800, sec80D: 75000, sec24: 475390, sec80TTA: 5000 };
  const otherIncome = { interest: 5000, dividend: 1000 };

  const taxComparison = useMemo(() => {
    const grossIncome = salaryData.total + otherIncome.interest + otherIncome.dividend;
    const hraExemption = Math.min(salaryData.hra, Math.max(0, salaryData.rentPaid - (0.1 * salaryData.basic)), 0.5 * salaryData.basic);
    const oldDeductions = 50000 + Math.min(150000, deductions.sec80C) + Math.min(50000, deductions.sec80CCD1B) + deductions.sec80CCD2 + deductions.sec80D + Math.min(200000, deductions.sec24) + Math.min(10000, deductions.sec80TTA);
    const oldNetIncome = grossIncome - hraExemption - oldDeductions;
    const calculateOldTax = (income: number) => {
      let tax = 0;
      if (income > 250000) tax += Math.min(250000, income - 250000) * 0.05;
      if (income > 500000) tax += Math.min(500000, income - 500000) * 0.20;
      if (income > 1000000) tax += (income - 1000000) * 0.30;
      return tax;
    };
    const totalOldTax = calculateOldTax(oldNetIncome) * 1.04;
    const newNetIncome = grossIncome - 75000;
    const calculateNewTax = (income: number) => {
      let tax = 0;
      if (income > 300000) tax += Math.min(400000, income - 300000) * 0.05;
      if (income > 700000) tax += Math.min(300000, income - 700000) * 0.10;
      if (income > 1000000) tax += Math.min(200000, income - 1000000) * 0.15;
      if (income > 1200000) tax += Math.min(300000, income - 1200000) * 0.20;
      if (income > 1500000) tax += (income - 1500000) * 0.30;
      return tax;
    };
    const totalNewTax = calculateNewTax(newNetIncome) * 1.04;
    return { grossIncome, old: { netIncome: oldNetIncome, tax: totalOldTax }, new: { netIncome: newNetIncome, tax: totalNewTax }, winner: totalNewTax > totalOldTax ? 'Old Regime' : 'New Regime', diff: Math.abs(totalNewTax - totalOldTax) };
  }, []);

  return (
    <div className="space-y-8 md:space-y-10 animate-in fade-in duration-700 pb-24">
      {/* Header */}
      <div className="bg-[#0b0f1a] p-8 md:p-16 rounded-[2.5rem] md:rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-12">
          <div className="space-y-4 md:space-y-6">
            <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-indigo-500/10 text-indigo-300 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
              <Calculator size={14}/> Tax Compliance Node
            </div>
            <h2 className="text-3xl md:text-7xl font-black tracking-tighter leading-tight md:leading-[0.85]">Strategic <br/><span className="text-indigo-500">Tax Ops.</span></h2>
          </div>
          <div className="bg-white/5 border border-white/10 p-8 md:p-10 rounded-[2rem] md:rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-2 w-full md:w-auto md:min-w-[280px]">
             <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Optimized Choice</p>
             <h4 className="text-3xl md:text-4xl font-black text-white text-center">{taxComparison.winner}</h4>
             <div className="flex items-center gap-2 mt-1 md:mt-2 text-[9px] md:text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 md:px-4 py-1 md:py-1.5 rounded-full border border-emerald-500/20">
                Saves ₹{Math.round(taxComparison.diff).toLocaleString()}
             </div>
          </div>
        </div>
      </div>

      <div className="flex p-1.5 bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-200 w-full md:w-fit mx-auto shadow-sm">
        <button onClick={() => setActiveTab('calculator')} className={`flex-1 md:flex-none px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-[2rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'calculator' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>Calculator</button>
        <button onClick={() => setActiveTab('estate')} className={`flex-1 md:flex-none px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-[2rem] text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'estate' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>Estate</button>
      </div>

      {activeTab === 'calculator' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10 animate-in slide-in-from-bottom-6">
           {/* Regime Cards */}
           {[
             { name: 'Old Regime', data: taxComparison.old, winner: taxComparison.winner === 'Old Regime' },
             { name: 'New Regime', data: taxComparison.new, winner: taxComparison.winner === 'New Regime' }
           ].map((r, i) => (
             <div key={i} className={`bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4.5rem] border-2 md:border-4 transition-all ${r.winner ? 'border-indigo-600 shadow-xl' : 'border-slate-100 opacity-90'}`}>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-6 md:mb-10">{r.name}</h3>
                <div className="space-y-4 border-y border-slate-50 py-6 md:py-8">
                   <div className="flex justify-between text-xs md:text-sm font-bold"><span className="text-slate-400 uppercase text-[9px] md:text-[10px]">Net Income</span><span className="text-slate-900">₹{Math.round(r.data.netIncome).toLocaleString()}</span></div>
                </div>
                <div className="pt-6 md:pt-8">
                   <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase mb-1">Effective Tax</p>
                   <h4 className={`text-3xl md:text-5xl font-black ${r.winner ? 'text-indigo-600' : 'text-slate-900'}`}>₹{Math.round(r.data.tax).toLocaleString()}</h4>
                </div>
             </div>
           ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-xl md:text-2xl font-black text-slate-900">Compliance Audit</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 md:gap-4 p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl hover:bg-white hover:border-indigo-300 border border-transparent transition-all">
                <UserCheck className="text-emerald-500 shrink-0" size={20} md:size={24} />
                <div className="min-w-0"><h4 className="text-sm font-black text-slate-800">Account Nominations</h4><p className="text-[11px] md:text-xs text-slate-500 mt-1 leading-relaxed">Beneficiaries updated for all registered bank nodes.</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxEstate;
