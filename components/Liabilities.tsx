
import React, { useState, useMemo } from 'react';
import { FinanceState, Loan, LoanType, LoanSourceType } from '../types';
import { 
  Plus, Trash2, Home, CreditCard, Car, Landmark, User, 
  Calendar, Percent, ArrowUpRight, TrendingDown, Info, 
  ChevronRight, ChevronDown, Activity, ShieldCheck, Calculator,
  ExternalLink, ArrowDownToLine, Zap, History, MessageSquare,
  AlertTriangle, Lightbulb, BarChart3
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';
import { parseNumber } from '../lib/validation';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';
import { buildAmortizationSchedule, calculateEmi, inferTenureMonths } from '../lib/loanMath';

const LOAN_TYPES: { type: LoanType, icon: any }[] = [
  { type: 'Home Loan', icon: Home },
  { type: 'Car Loan', icon: Car },
  { type: 'Property Purchase', icon: Landmark },
  { type: 'Personal Loan', icon: User },
  { type: 'Credit Card EMI', icon: CreditCard },
  { type: 'OD', icon: Landmark },
];

const SOURCE_TYPES: LoanSourceType[] = ['Bank', 'NBFC', 'Friends & Family'];

const Liabilities: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [lumpSumAmount, setLumpSumAmount] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  
  const [newLoan, setNewLoan] = useState<Partial<Loan>>({
    type: 'Home Loan',
    sourceType: 'Bank',
    owner: 'self',
    source: '',
    sanctionedAmount: 0,
    outstandingAmount: 0,
    interestRate: 8.5,
    remainingTenure: 120,
    emi: 0,
    startYear: new Date().getFullYear(),
    notes: '',
    lumpSumRepayments: []
  });

  const handleAdd = () => {
    setFormError(null);
    setFormWarning(null);

    const source = (newLoan.source || '').trim();
    const sanctionedAmount = parseNumber(newLoan.sanctionedAmount || 0, 0);
    const outstandingAmount = parseNumber(newLoan.outstandingAmount || 0, 0);
    const interestRate = parseNumber(newLoan.interestRate || 0, 0);
    const remainingTenure = parseNumber(newLoan.remainingTenure || 0, 0);
    const emi = parseNumber(newLoan.emi || 0, 0);
    const startYear = newLoan.startYear ? parseNumber(newLoan.startYear, new Date().getFullYear()) : undefined;
    const owner = newLoan.owner || 'self';

    if (!source) {
      setFormError('Loan source is required.');
      return;
    }
    if (sanctionedAmount < outstandingAmount) {
      setFormError('Sanctioned amount must be >= outstanding amount.');
      return;
    }
    if (interestRate <= 0 || interestRate > 40) {
      setFormError('Interest rate must be between 1% and 40%.');
      return;
    }
    if (remainingTenure <= 0) {
      setFormError('Remaining tenure must be greater than 0.');
      return;
    }
    if (!owner || (owner !== 'self' && !state.family.find(f => f.id === owner))) {
      setFormError('Owner must be Self or a valid family member.');
      return;
    }
    if (sanctionedAmount === 0 && outstandingAmount > 0) {
      setFormWarning('Sanctioned amount is 0 but outstanding is set.');
      setNotice('Loan saved with 0 sanctioned amount. Consider updating for accuracy.');
      setTimeout(() => setNotice(null), 4000);
    }
    if (startYear && (startYear < 1900 || startYear > new Date().getFullYear() + 50)) {
      setFormError('Start year looks invalid.');
      return;
    }

    let finalEmi = emi;
    if (finalEmi <= 0) {
      const tempLoan = {
        id: 'tmp',
        type: newLoan.type || 'Home Loan',
        owner,
        source,
        sourceType: newLoan.sourceType || 'Bank',
        sanctionedAmount,
        outstandingAmount,
        interestRate,
        remainingTenure,
        emi: 0,
        startYear,
        lumpSumRepayments: [],
      } as Loan;
      const inferred = inferTenureMonths(tempLoan);
      finalEmi = Math.round(calculateEmi(outstandingAmount, interestRate, inferred.months));
      setNotice('EMI auto-calculated from rate and tenure.');
      setTimeout(() => setNotice(null), 4000);
    }

    const loan = {
      ...newLoan,
      id: Math.random().toString(36).substr(2, 9),
      source,
      owner,
      sanctionedAmount,
      outstandingAmount,
      interestRate,
      remainingTenure,
      emi: finalEmi,
      startYear,
    } as Loan;
    updateState({ loans: [...state.loans, loan] });
    setShowAdd(false);
    setNewLoan({ type: 'Home Loan', sourceType: 'Bank', owner: 'self', source: '', sanctionedAmount: 0, outstandingAmount: 0, interestRate: 8.5, remainingTenure: 120, emi: 0, startYear: new Date().getFullYear(), notes: '', lumpSumRepayments: [] });
  };

  const removeLoan = (id: string) => {
    updateState({ loans: state.loans.filter(l => l.id !== id) });
  };

  const addLumpSum = (loanId: string) => {
    const amount = parseFloat(lumpSumAmount);
    if (isNaN(amount) || amount <= 0) return;

    updateState({
      loans: state.loans.map(l => {
        if (l.id === loanId) {
          const newOutstanding = Math.max(0, l.outstandingAmount - amount);
          return {
            ...l,
            outstandingAmount: newOutstanding,
            lumpSumRepayments: [...(l.lumpSumRepayments || []), { year: new Date().getFullYear(), amount }]
          };
        }
        return l;
      })
    });
    setLumpSumAmount('');
  };

  const totalOutstanding = state.loans.reduce((sum, l) => sum + l.outstandingAmount, 0);
  const totalEMI = state.loans.reduce((sum, l) => sum + l.emi, 0);

  // Amortization Calculator with Lump Sum Projection
  const calculateProjections = (loan: Loan, simulateExtra: number = 0) => {
    const projection = buildAmortizationSchedule(loan, { extraPayment: simulateExtra });
    const schedule = projection.schedule.slice(0, 12).map((row, i) => ({
      month: `Mo ${i + 1}`,
      interest: row.interest,
      principal: row.principal,
      balance: row.closingBalance,
    }));
    return { 
      schedule,
      fullSchedule: projection.schedule,
      totalInterest: projection.totalInterest,
      monthsRemaining: projection.monthsRemaining,
      emi: projection.emi,
      basis: projection.basis,
    };
  };

  // Consolidation suggestions
  const consolidationInsights = useMemo(() => {
    const highInterestLoans = state.loans.filter(l => l.interestRate > 11 && l.outstandingAmount > 50000);
    const lowInterestLoans = state.loans.filter(l => l.interestRate < 9.5);
    
    const insights = [];
    if (highInterestLoans.length > 0 && lowInterestLoans.some(l => l.type === 'Home Loan')) {
      const homeLoan = lowInterestLoans.find(l => l.type === 'Home Loan')!;
      insights.push({
        type: 'Consolidation',
        text: `High interest debt detected (${highInterestLoans.map(l => l.type).join(', ')}). Consider consolidating into a Top-up on your ${homeLoan.source} Home Loan to save ~${(highInterestLoans[0].interestRate - homeLoan.interestRate).toFixed(1)}% in interest.`,
        priority: 'high'
      });
    }

    const personalLoans = state.loans.filter(l => l.type === 'Personal Loan' && l.interestRate > 12);
    if (personalLoans.length > 0) {
      insights.push({
        type: 'Refinancing',
        text: `Your ${personalLoans[0].source} Personal Loan at ${personalLoans[0].interestRate}% is above market average. Check balance transfer options to reduce rates to 10.5%.`,
        priority: 'medium'
      });
    }

    return insights;
  }, [state.loans]);

  const currencyCountry = state.profile.country;
  const currencySymbol = getCurrencySymbol(currencyCountry);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest">
          {notice}
        </div>
      )}
      {/* Header Strategy Block */}
      <div className="surface-dark p-12 md:p-16 rounded-[4rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-12 text-left">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <Activity size={14}/> Liability Architecture
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">Debt <br/><span className="text-teal-500">Inventory.</span></h2>
            <p className="text-slate-400 text-lg font-medium max-w-lg leading-relaxed">
              Monitoring <span className="text-white font-bold">{state.loans.length} active lines</span> for <span className="text-white font-bold">{state.profile.firstName} {state.profile.lastName}</span>.
            </p>
          </div>
          <button 
            onClick={() => setShowAdd(prev => !prev)}
            className="px-12 py-8 bg-teal-600 hover:bg-teal-50 text-white hover:text-teal-600 rounded-[2.5rem] transition-all flex items-center gap-4 font-black uppercase text-sm tracking-[0.25em] shadow-2xl active:scale-95 shrink-0"
          >
            <Plus size={22} /> {showAdd ? 'Close Form' : 'Add Loan Profile'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] w-full shadow-2xl ring-1 ring-slate-200/70 overflow-hidden border border-white/20">
          <div className="p-6 sm:p-10 md:p-12 border-b border-slate-50 flex justify-between items-center bg-white/90 text-left">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-teal-50 text-teal-600 rounded-[1.5rem]"><Calculator size={28}/></div>
              <div>
                 <h3 className="text-3xl font-black text-slate-900 tracking-tight">Debt Origination</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Institutional Credit Profile</p>
              </div>
            </div>
            <button onClick={() => setShowAdd(false)} className="p-4 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 rounded-3xl text-slate-400 transition-all"><Plus size={32} className="rotate-45" /></button>
          </div>
          
          <div className="p-6 sm:p-10 md:p-12 space-y-8 text-left bg-white/70">
             {formError && (
               <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold">
                 {formError}
               </div>
             )}
             {formWarning && (
               <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-bold">
                 {formWarning}
               </div>
             )}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Loan Type</label>
                  <select 
                    value={newLoan.type}
                    onChange={e => setNewLoan({...newLoan, type: e.target.value as LoanType})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                  >
                     {LOAN_TYPES.map(lt => <option key={lt.type}>{lt.type}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Source Type</label>
                  <select 
                    value={newLoan.sourceType}
                    onChange={e => setNewLoan({...newLoan, sourceType: e.target.value as LoanSourceType})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                  >
                     {SOURCE_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Institution Name / Source</label>
                <input type="text" value={newLoan.source} onChange={e => setNewLoan({...newLoan, source: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none" placeholder="HDFC, SBI, NBFC Name, etc." />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sanctioned Amount</label>
                  <input type="number" value={newLoan.sanctionedAmount || ''} onChange={e => setNewLoan({...newLoan, sanctionedAmount: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none" placeholder={currencySymbol} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Outstanding</label>
                  <input type="number" value={newLoan.outstandingAmount || ''} onChange={e => setNewLoan({...newLoan, outstandingAmount: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none" placeholder={currencySymbol} />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monthly EMI (Optional)</label>
                  <input type="number" value={newLoan.emi || ''} onChange={e => setNewLoan({...newLoan, emi: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none" />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Leave blank to auto-calculate</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Interest Rate (%)</label>
                  <input type="number" step="0.1" value={newLoan.interestRate || ''} onChange={e => setNewLoan({...newLoan, interestRate: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remaining Tenure</label>
                  <input type="number" value={newLoan.remainingTenure || ''} onChange={e => setNewLoan({...newLoan, remainingTenure: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none" />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Enter years or months — system auto-detects using EMI</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Year</label>
                  <input type="number" value={newLoan.startYear || ''} onChange={e => setNewLoan({...newLoan, startYear: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none" />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Owner</label>
                  <select value={newLoan.owner} onChange={e => setNewLoan({...newLoan, owner: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none">
                    <option value="self">Self</option>
                    {state.family.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Loan Notes</label>
                  <input type="text" value={newLoan.notes || ''} onChange={e => setNewLoan({...newLoan, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none" placeholder="Any special notes" />
                </div>
             </div>

             <button onClick={handleAdd} className="w-full py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-lg hover:bg-teal-600 transition-all shadow-2xl flex items-center justify-center gap-6">Secure Credit Record <ArrowUpRight size={32}/></button>
          </div>
        </div>
      )}

      {/* Insights Section */}
      {consolidationInsights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Lightbulb className="text-amber-500" size={18} />
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Smart Debt Optimization</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {consolidationInsights.map((insight, i) => (
              <div key={i} className={`p-6 rounded-[2.5rem] border flex gap-4 items-start bg-white shadow-sm transition-all hover:shadow-md ${insight.priority === 'high' ? 'border-amber-200 bg-amber-50/30' : 'border-teal-100 bg-teal-50/30'}`}>
                <div className={`p-3 rounded-2xl ${insight.priority === 'high' ? 'bg-amber-100 text-amber-600' : 'bg-teal-100 text-teal-600'}`}>
                  <Zap size={20} />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">{insight.type}</p>
                  <p className="text-sm font-bold text-slate-800 leading-relaxed">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</p>
          <h4 className="text-3xl font-black text-rose-600 tracking-tighter">{formatCurrency(totalOutstanding, currencyCountry)}</h4>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly EMI Load</p>
          <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(totalEMI, currencyCountry)}</h4>
        </div>
        <div className="surface-dark p-8 rounded-[2.5rem] text-white flex flex-col justify-center relative overflow-hidden group text-left">
           <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingDown size={80}/></div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Debt-to-Income</p>
           <h4 className="text-3xl font-black text-teal-400 tracking-tighter">
             {state.profile.income.salary > 0 ? ((totalEMI / state.profile.income.salary) * 100).toFixed(1) : 0}%
           </h4>
        </div>
        <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100 flex flex-col justify-center text-left">
           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Status</p>
           <h4 className="text-2xl font-black text-emerald-700 tracking-tighter">Serviceable</h4>
           <p className="text-[9px] font-bold text-emerald-500 uppercase mt-1">Within Safe Limits</p>
        </div>
      </div>

      {/* Loan Inventory List */}
      <div className="space-y-6">
        {state.loans.map((loan) => {
          const Icon = LOAN_TYPES.find(lt => lt.type === loan.type)?.icon || Landmark;
          const isExpanded = expandedLoanId === loan.id;
          
          const currentProj = calculateProjections(loan);
          const simulatedExtra = parseFloat(lumpSumAmount) || 0;
          const simulatedProj = calculateProjections(loan, simulatedExtra);
          
          const { schedule, totalInterest, monthsRemaining, fullSchedule, emi: calculatedEmi, basis } = currentProj;
          const interestSaved = Math.max(0, currentProj.totalInterest - simulatedProj.totalInterest);
          const tenureSaved = Math.max(0, currentProj.monthsRemaining - simulatedProj.monthsRemaining);

          const payoffProgress = Math.min(100, Math.round(((loan.sanctionedAmount - loan.outstandingAmount) / (loan.sanctionedAmount || 1)) * 100));
          const monthlyRate = loan.interestRate / 12 / 100;
          const monthlyInterest = loan.outstandingAmount * monthlyRate;
          const isNegativeAmort = loan.emi > 0 && loan.emi <= monthlyInterest;
          const emiGap = Math.abs((loan.emi || 0) - calculatedEmi);
          const showEmiHint = loan.emi <= 0 || (emiGap > Math.max(500, calculatedEmi * 0.05));

          return (
            <div key={loan.id} className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden hover:border-teal-300 transition-all">
              <div 
                className="p-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 cursor-pointer"
                onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
              >
                <div className="flex gap-8 flex-1 text-left">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
                    <Icon size={28} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 px-3 py-1 rounded-lg">{loan.source}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{loan.sourceType} • {loan.type}</span>
                    </div>
                    <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(loan.outstandingAmount, currencyCountry)}</h4>
                    <div className="w-full max-w-[240px] h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                       <div className="h-full bg-emerald-500" style={{ width: `${payoffProgress}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 text-center shrink-0 border-l border-slate-100 pl-8">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">EMI</p>
                      <p className="text-lg font-black text-slate-900">{formatCurrency(loan.emi || calculatedEmi, currencyCountry)}</p>
                      {showEmiHint && (
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Calc: {formatCurrency(Math.round(calculatedEmi), currencyCountry)}</p>
                      )}
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Rate</p>
                      <p className="text-lg font-black text-teal-600">{loan.interestRate}%</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ends In</p>
                      <p className="text-lg font-black text-slate-900">{monthsRemaining} Mo</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{basis === 'years' ? 'Tenure in years' : 'Tenure in months'}</p>
                   </div>
                </div>

                <div className="flex gap-3 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); removeLoan(loan.id); }} className="p-3 bg-rose-50 text-rose-400 hover:bg-rose-600 hover:text-white rounded-2xl transition-all"><Trash2 size={18}/></button>
                  <div className={`p-3 bg-slate-50 text-slate-400 rounded-2xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={18}/></div>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-slate-50 p-10 border-t border-slate-200 animate-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                     <div className="space-y-8">
                        {/* Simulation Module */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 text-left">
                           <h5 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest"><Zap size={16} className="text-amber-500"/> Lump-sum Simulator</h5>
                           <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Make an extra payment to see how it slashes your tenure and total interest.</p>
                           <div className="space-y-4">
                              <input 
                                 type="number" 
                                 value={lumpSumAmount} 
                                 onChange={e => setLumpSumAmount(e.target.value)} 
                                 className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-lg outline-none focus:border-teal-600" 
                                 placeholder={`Amount ${currencySymbol}`}
                                 onClick={e => e.stopPropagation()}
                              />
                              <button 
                                 onClick={(e) => { e.stopPropagation(); addLumpSum(loan.id); }}
                                 className="w-full py-4 bg-teal-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                              >
                                 Record Payment <ArrowDownToLine size={14}/>
                              </button>
                           </div>

                           {simulatedExtra > 0 && (
                             <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in zoom-in-95">
                               <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2"><Lightbulb size={12}/> Projected Savings</p>
                               <div className="space-y-1">
                                 <div className="flex justify-between text-xs font-bold text-slate-600"><span>Interest Saved:</span><span className="text-emerald-700">{formatCurrency(Math.round(interestSaved), currencyCountry)}</span></div>
                                 <div className="flex justify-between text-xs font-bold text-slate-600"><span>Tenure Saved:</span><span className="text-emerald-700">-{tenureSaved} Months</span></div>
                               </div>
                             </div>
                           )}
                        </div>

                        {/* Notes Section */}
                        {loan.notes && (
                          <div className="bg-teal-50 p-8 rounded-[2.5rem] border border-teal-100 text-left">
                            <h5 className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-3 flex items-center gap-2"><MessageSquare size={14}/> Internal Notes</h5>
                            <p className="text-sm font-bold text-teal-900 italic leading-relaxed">"{loan.notes}"</p>
                          </div>
                        )}

                        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-4 text-left">
                           <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-500 uppercase">Projected Total Interest</span><span className="text-sm font-black text-rose-400">{formatCurrency(Math.round(totalInterest), currencyCountry)}</span></div>
                           <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-500 uppercase">Current Ends In</span><span className="text-sm font-black text-emerald-400">{monthsRemaining} Months</span></div>
                           {isNegativeAmort && (
                             <div className="p-3 bg-rose-500/10 border border-rose-400/20 rounded-xl text-[10px] font-bold text-rose-300">
                               EMI is below monthly interest. Balance will grow unless EMI is increased.
                             </div>
                           )}
                        </div>
                     </div>

                     <div className="lg:col-span-2 space-y-10">
                        {/* Visualization: 12 Month Chart */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                           <div className="flex justify-between items-center mb-8">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><BarChart3 size={16}/> Repayment Curve (Next 12 Mo)</h5>
                              <div className="flex gap-4">
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400"/><span className="text-[9px] font-black text-slate-400 uppercase">Interest</span></div>
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400"/><span className="text-[9px] font-black text-slate-400 uppercase">Principal</span></div>
                              </div>
                           </div>
                           <div className="h-[200px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={schedule}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                                  <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                    cursor={{ fill: '#f8fafc' }}
                                  />
                                  <Bar dataKey="interest" stackId="a" fill="#fb7185" radius={[0, 0, 0, 0]} />
                                  <Bar dataKey="principal" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                           </div>
                        </div>

                        {/* Amortization Table */}
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                           <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detailed Amortization Node</h5>
                              <span className="text-[9px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full uppercase">12 Month Window</span>
                           </div>
                           <div className="overflow-x-auto max-h-[300px] no-scrollbar">
                              <table className="w-full text-left min-w-[520px]">
                                 <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr>
                                       <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase">Period</th>
                                       <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Interest</th>
                                       <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Principal</th>
                                       <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Bal. End</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-50">
                                    {schedule.map((row, i) => (
                                       <tr key={i} className="hover:bg-slate-50 transition-colors">
                                          <td className="px-8 py-4 text-[10px] font-black text-slate-600">{row.month}</td>
                                          <td className="px-4 py-4 text-[10px] font-bold text-rose-500 text-right">{formatCurrency(row.interest, currencyCountry)}</td>
                                          <td className="px-4 py-4 text-[10px] font-bold text-emerald-500 text-right">{formatCurrency(row.principal, currencyCountry)}</td>
                                          <td className="px-8 py-4 text-[10px] font-black text-slate-900 text-right">{formatCurrency(row.balance, currencyCountry)}</td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </div>

                        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                           <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Amortization Schedule</h5>
                              <span className="text-[9px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full uppercase">Monthly</span>
                           </div>
                           <div className="overflow-x-auto max-h-[360px] no-scrollbar">
                              <table className="w-full text-left min-w-[760px]">
                                 <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr>
                                       <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Month</th>
                                       <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Opening</th>
                                       <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Interest</th>
                                       <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase text-right">EMI</th>
                                       <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Principal</th>
                                       <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Extra</th>
                                       <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Closing</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-50">
                                    {fullSchedule.map((row) => (
                                       <tr key={row.month} className="hover:bg-slate-50 transition-colors">
                                          <td className="px-6 py-4 text-[10px] font-black text-slate-600">Mo {row.month}</td>
                                          <td className="px-4 py-4 text-[10px] font-bold text-slate-600 text-right">{formatCurrency(row.openingBalance, currencyCountry)}</td>
                                          <td className="px-4 py-4 text-[10px] font-bold text-rose-500 text-right">{formatCurrency(row.interest, currencyCountry)}</td>
                                          <td className="px-4 py-4 text-[10px] font-bold text-slate-600 text-right">{formatCurrency(row.emi, currencyCountry)}</td>
                                          <td className="px-4 py-4 text-[10px] font-bold text-emerald-500 text-right">{formatCurrency(row.principal, currencyCountry)}</td>
                                          <td className="px-4 py-4 text-[10px] font-bold text-slate-500 text-right">{row.extraPayment ? formatCurrency(row.extraPayment, currencyCountry) : '—'}</td>
                                          <td className="px-6 py-4 text-[10px] font-black text-slate-900 text-right">{formatCurrency(row.closingBalance, currencyCountry)}</td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default Liabilities;
