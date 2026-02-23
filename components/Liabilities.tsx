
import React, { useState, useMemo } from 'react';
import { FinanceState, Loan, LoanType, LoanSourceType } from '../types';
import { 
  Plus, Trash2, Home, CreditCard, Car, Landmark, User, 
  ArrowUpRight, TrendingDown,
  ChevronDown, Activity, Calculator,
  ArrowDownToLine, Zap, MessageSquare,
  Lightbulb, BarChart3
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { parseNumber } from '../lib/validation';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';
import { buildAmortizationSchedule, buildYearlyAmortization } from '../lib/loanMath';

const LOAN_TYPES: { type: LoanType, icon: any }[] = [
  { type: 'Home Loan', icon: Home },
  { type: 'Car Loan', icon: Car },
  { type: 'Property Purchase', icon: Landmark },
  { type: 'Personal Loan', icon: User },
  { type: 'Credit Card EMI', icon: CreditCard },
  { type: 'OD', icon: Landmark },
];

const SOURCE_TYPES: LoanSourceType[] = ['Bank', 'NBFC', 'Friends & Family'];
const PLANNING_DETAIL_HINTS: Partial<Record<LoanType, string>> = {
  'Home Loan': 'Fixed or floating, reset frequency, prepayment intent, tax use (80C/24b), co-borrower share.',
  'Car Loan': 'Planned closure date, expected upgrades, resale intent, insurance/maintenance obligation.',
  'Personal Loan': 'Purpose of borrowing, consolidation plan, expected one-time inflows for pre-closure.',
  'Credit Card EMI': 'Promotional tenure, revolving card behavior, expected card closure/reduction plan.',
  'Property Purchase': 'Stage-linked disbursal, rental readiness, possession timeline, co-owner details.',
  'OD': 'Typical utilization %, peak months, repayment buffer strategy, linked business cashflow.',
  'Others': 'Any terms that affect future cashflow, refinancing, or prepayment decisions.',
};

const Liabilities: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [tableModeByLoan, setTableModeByLoan] = useState<Record<string, 'summary' | 'full'>>({});
  const [visibleMonthsByLoan, setVisibleMonthsByLoan] = useState<Record<string, number>>({});
  const [lumpSumInputs, setLumpSumInputs] = useState<Record<string, { year: string; amount: string }>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  
  const [newLoan, setNewLoan] = useState<Partial<Loan>>({
    type: 'Home Loan',
    sourceType: 'Bank',
    owner: 'self',
    source: 'Bank',
    sanctionedAmount: 0,
    outstandingAmount: 0,
    interestRate: 8.5,
    remainingTenure: 120,
    emi: 0,
    startYear: undefined,
    notes: '',
    lumpSumRepayments: []
  });

  const estimateOutstandingAmount = (emi: number, annualRate: number, rawTenure: number) => {
    if (emi <= 0 || annualRate <= 0 || rawTenure <= 0) return 0;
    const roundedTenure = Math.max(1, Math.round(rawTenure));
    const months = roundedTenure <= 40 ? roundedTenure * 12 : roundedTenure;
    const monthlyRate = annualRate / 12 / 100;
    if (monthlyRate <= 0) return emi * months;
    const pv = emi * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
    return Math.max(0, pv);
  };

  const handleAdd = () => {
    setFormError(null);
    setFormWarning(null);

    const planningDetails = (newLoan.notes || '').trim();
    const source = (newLoan.sourceType || 'Bank').trim();
    const sanctionedInput = parseNumber(newLoan.sanctionedAmount || 0, 0);
    const interestRate = parseNumber(newLoan.interestRate || 0, 0);
    const remainingTenure = parseNumber(newLoan.remainingTenure || 0, 0);
    const emi = parseNumber(newLoan.emi || 0, 0);
    const startYear = newLoan.startYear ? parseNumber(newLoan.startYear, new Date().getFullYear()) : undefined;
    const owner = newLoan.owner || 'self';

    if (emi <= 0) {
      setFormError('Monthly EMI is required and must be greater than 0.');
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

    const estimatedOutstanding = estimateOutstandingAmount(emi, interestRate, remainingTenure);
    if (estimatedOutstanding <= 0) {
      setFormError('Current Outstanding could not be calculated. Check EMI, interest rate, and tenure.');
      return;
    }
    const outstandingAmount = Math.round(estimatedOutstanding);
    setNotice('Current Outstanding auto-calculated from EMI, rate and tenure.');
    setTimeout(() => setNotice(null), 3000);

    const sanctionedAmount = sanctionedInput > 0 ? Math.max(sanctionedInput, outstandingAmount) : outstandingAmount;
    if (sanctionedInput > 0 && sanctionedInput < outstandingAmount) {
      setFormWarning('Sanctioned amount was lower than outstanding. It has been aligned to outstanding value.');
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
      emi,
      startYear,
      notes: planningDetails || undefined,
    } as Loan;
    updateState({ loans: [...state.loans, loan] });
    setShowAdd(false);
    setNewLoan({ type: 'Home Loan', sourceType: 'Bank', owner: 'self', source: 'Bank', sanctionedAmount: 0, outstandingAmount: 0, interestRate: 8.5, remainingTenure: 120, emi: 0, startYear: undefined, notes: '', lumpSumRepayments: [] });
  };

  const removeLoan = (id: string) => {
    const confirmed = window.confirm('Remove this loan profile? This action cannot be undone.');
    if (!confirmed) return;
    updateState({ loans: state.loans.filter(l => l.id !== id) });
  };

  const declareNoLoans = () => {
    if (state.loans.length > 0) {
      const confirmed = window.confirm('This will remove all current loan entries and mark that you do not have active loans/obligations. Continue?');
      if (!confirmed) return;
    }
    updateState({ loans: [] });
    setShowAdd(false);
    setNotice("Declaration saved: no active loans/obligations.");
    setTimeout(() => setNotice(null), 3500);
  };

  const getLumpSumInput = (loanId: string) => {
    return lumpSumInputs[loanId] ?? { year: String(new Date().getFullYear()), amount: '' };
  };

  const updateLumpSumInput = (loanId: string, field: 'year' | 'amount', value: string) => {
    setLumpSumInputs(prev => {
      const current = prev[loanId] ?? { year: String(new Date().getFullYear()), amount: '' };
      return { ...prev, [loanId]: { ...current, [field]: value } };
    });
  };

  const addLumpSum = (loanId: string) => {
    const input = getLumpSumInput(loanId);
    const amount = parseNumber(input.amount, 0);
    const year = parseNumber(input.year, 0);
    const loan = state.loans.find(l => l.id === loanId);

    if (!loan || amount <= 0 || year <= 0) {
      setNotice('Enter a valid year and amount for the additional payment.');
      setTimeout(() => setNotice(null), 3500);
      return;
    }
    const minYear = loan.startYear ?? new Date().getFullYear();
    if (year < minYear) {
      setNotice(`Additional payment year must be >= ${minYear}.`);
      setTimeout(() => setNotice(null), 3500);
      return;
    }

    updateState({
      loans: state.loans.map(l => {
        if (l.id === loanId) {
          return {
            ...l,
            lumpSumRepayments: [...(l.lumpSumRepayments || []), { year, amount }]
          };
        }
        return l;
      })
    });
    updateLumpSumInput(loanId, 'amount', '');
  };

  const removeLumpSum = (loanId: string, index: number) => {
    updateState({
      loans: state.loans.map(l => {
        if (l.id === loanId) {
          const updated = [...(l.lumpSumRepayments || [])];
          updated.splice(index, 1);
          return { ...l, lumpSumRepayments: updated };
        }
        return l;
      })
    });
  };

  const getTableMode = (loanId: string) => tableModeByLoan[loanId] ?? 'summary';

  const setTableMode = (loanId: string, mode: 'summary' | 'full') => {
    setTableModeByLoan(prev => ({ ...prev, [loanId]: mode }));
    if (mode === 'full') {
      setVisibleMonthsByLoan(prev => ({ ...prev, [loanId]: prev[loanId] ?? 24 }));
    }
  };

  const getVisibleMonths = (loanId: string) => visibleMonthsByLoan[loanId] ?? 24;

  const addVisibleMonths = (loanId: string, increment = 24) => {
    setVisibleMonthsByLoan(prev => {
      const current = prev[loanId] ?? 24;
      return { ...prev, [loanId]: current + increment };
    });
  };

  const showAllMonths = (loanId: string, totalMonths: number) => {
    setVisibleMonthsByLoan(prev => ({ ...prev, [loanId]: totalMonths }));
  };

  const totalOutstanding = state.loans.reduce((sum, l) => sum + l.outstandingAmount, 0);
  const totalEMI = state.loans.reduce((sum, l) => sum + l.emi, 0);

  // Amortization Calculator with Lump Sum Projection
  const calculateProjections = (loan: Loan) => {
    const projection = buildAmortizationSchedule(loan);
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

  const exportYearlyCsv = (loan: Loan, yearlySchedule: Array<{ yearIndex: number; openingBalance: number; interest: number; emi: number; principal: number; extraPayment: number; closingBalance: number }>) => {
    const rows = [
      ['Year', 'Opening Balance', 'Interest', 'EMI', 'Principal', 'Additional Payments', 'Closing Balance'],
      ...yearlySchedule.map(row => ([
        `Year ${row.yearIndex}`,
        row.openingBalance,
        row.interest,
        row.emi,
        row.principal,
        row.extraPayment,
        row.closingBalance,
      ]))
    ];
    const csv = rows.map(r => r.join(',')).join('\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${loan.type.replace(/\\s+/g, '-').toLowerCase()}-amortization.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportYearlyPdf = (loan: Loan, yearlySchedule: Array<{ yearIndex: number; openingBalance: number; interest: number; emi: number; principal: number; extraPayment: number; closingBalance: number }>) => {
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;
    const rowsHtml = yearlySchedule.map(row => `
      <tr>
        <td>Year ${row.yearIndex}</td>
        <td>${formatCurrency(row.openingBalance, currencyCountry)}</td>
        <td>${formatCurrency(row.interest, currencyCountry)}</td>
        <td>${formatCurrency(row.emi, currencyCountry)}</td>
        <td>${formatCurrency(row.principal, currencyCountry)}</td>
        <td>${row.extraPayment ? formatCurrency(row.extraPayment, currencyCountry) : '—'}</td>
        <td>${formatCurrency(row.closingBalance, currencyCountry)}</td>
      </tr>
    `).join('');
    popup.document.write(`
      <html>
        <head>
          <title>${loan.type} Amortization Schedule</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: right; }
            th:first-child, td:first-child { text-align: left; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${loan.type} · Yearly Amortization</h1>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Opening</th>
                <th>Interest</th>
                <th>EMI</th>
                <th>Principal</th>
                <th>Additional</th>
                <th>Closing</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
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
  const selectedLoanType = (newLoan.type || 'Home Loan') as LoanType;
  const planningDetailsPlaceholder = PLANNING_DETAIL_HINTS[selectedLoanType] || PLANNING_DETAIL_HINTS['Others'];
  const sourceAssistiveText = newLoan.sourceType === 'Bank'
    ? 'Best for refinance benchmarking and floating-rate assumptions.'
    : newLoan.sourceType === 'NBFC'
      ? 'NBFC loans may have different reset clauses and foreclosure costs.'
      : 'Capture informal terms clearly so repayment risk is modeled correctly.';
  const outstandingPreview = estimateOutstandingAmount(
    parseNumber(newLoan.emi || 0, 0),
    parseNumber(newLoan.interestRate || 0, 0),
    parseNumber(newLoan.remainingTenure || 0, 0)
  );
  const hasOutstandingPreview = outstandingPreview > 0;

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
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              onClick={declareNoLoans}
              className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-[1.5rem] transition-all font-black uppercase text-[10px] tracking-[0.2em] border border-white/20"
            >
              I Don&apos;t Have Loans/Obligations
            </button>
            <button 
              onClick={() => setShowAdd(prev => !prev)}
              className="px-12 py-8 bg-teal-600 hover:bg-teal-50 text-white hover:text-teal-600 rounded-[2.5rem] transition-all flex items-center gap-4 font-black uppercase text-sm tracking-[0.25em] shadow-2xl active:scale-95"
            >
              <Plus size={22} /> {showAdd ? 'Close Form' : 'Add Loan Profile'}
            </button>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] w-full shadow-2xl ring-1 ring-slate-200/70 overflow-hidden border border-white/20">
          <div className="p-6 sm:p-10 md:p-12 border-b border-slate-50 flex justify-between items-center bg-white/90 text-left">
              <div className="flex items-center gap-6">
              <div className="p-4 bg-teal-50 text-teal-600 rounded-[1.5rem]"><Calculator size={28}/></div>
              <div>
                 <h3 className="text-3xl font-black text-slate-900 tracking-tight">Debt Origination</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Assistive Loan Capture</p>
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
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{sourceAssistiveText}</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Outstanding</label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-black text-slate-900 min-h-[56px] flex items-center">
                    {hasOutstandingPreview
                      ? formatCurrency(Math.round(outstandingPreview), currencyCountry)
                      : 'Waiting for EMI, interest rate and tenure'}
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Auto-calculated from EMI + rate + tenure.</p>
                  {hasOutstandingPreview && (
                    <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">
                      Calculated Outstanding: {formatCurrency(Math.round(outstandingPreview), currencyCountry)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Planning Details (Optional)</label>
                  <input
                    type="text"
                    value={newLoan.notes || ''}
                    onChange={e => setNewLoan({...newLoan, notes: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                    placeholder={planningDetailsPlaceholder}
                  />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Share details that can change cashflow, risk, or prepayment strategy.</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monthly EMI (Mandatory)</label>
                  <input
                    type="number"
                    value={newLoan.emi || ''}
                    onChange={e => setNewLoan({...newLoan, emi: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                    placeholder={currencySymbol}
                  />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Required for debt servicing and cashflow planning.</p>
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
             </div>

             <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Owner</label>
                  <select value={newLoan.owner} onChange={e => setNewLoan({...newLoan, owner: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none">
                    <option value="self">Self</option>
                    {state.family.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
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

      {state.loans.length === 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-left">
          <div className="space-y-2">
            <h4 className="text-xl font-black text-slate-900">No Active Loans Captured</h4>
            <p className="text-sm font-medium text-slate-500">
              If you do not have any loans or obligations, declare it now so planning assumes zero debt servicing.
            </p>
          </div>
          <button
            onClick={declareNoLoans}
            className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-teal-600 transition-all"
          >
            Declare No Loans/Obligations
          </button>
        </div>
      )}

      {/* Loan Inventory List */}
      <div className="space-y-6">
        {state.loans.map((loan) => {
          const Icon = LOAN_TYPES.find(lt => lt.type === loan.type)?.icon || Landmark;
          const isExpanded = expandedLoanId === loan.id;
          
          const currentProj = calculateProjections(loan);
          
          const { schedule, totalInterest, monthsRemaining, fullSchedule, emi: calculatedEmi, basis } = currentProj;
          const yearlySchedule = buildYearlyAmortization(fullSchedule);
          const totalExtras = (loan.lumpSumRepayments || []).reduce((sum, ls) => sum + (ls.amount || 0), 0);

          const payoffProgress = Math.min(100, Math.round(((loan.sanctionedAmount - loan.outstandingAmount) / (loan.sanctionedAmount || 1)) * 100));
          const monthlyRate = loan.interestRate / 12 / 100;
          const effectiveEmi = loan.emi || calculatedEmi;
          const monthlyInterest = loan.outstandingAmount * monthlyRate;
          const monthlyPrincipal = Math.max(0, effectiveEmi - monthlyInterest);
          const monthlyInterestShare = effectiveEmi > 0 ? Math.min(100, (monthlyInterest / effectiveEmi) * 100) : 0;
          const isNegativeAmort = effectiveEmi > 0 && effectiveEmi <= monthlyInterest;
          const emiGap = Math.abs((loan.emi || 0) - calculatedEmi);
          const showEmiHint = loan.emi <= 0 || (emiGap > Math.max(500, calculatedEmi * 0.05));
          const payoffYear = new Date().getFullYear() + Math.ceil(monthsRemaining / 12);
          const lumpSumInput = getLumpSumInput(loan.id);
          const suggestedExtraPayments = [1, 3, 6].map(multiplier => Math.max(1000, Math.round(effectiveEmi * multiplier)));
          const previewExtraAmount = parseNumber(lumpSumInput.amount, 0);
          const previewProjection = previewExtraAmount > 0 ? buildAmortizationSchedule(loan, { extraPayment: previewExtraAmount }) : null;
          const previewInterestSaved = previewProjection ? Math.max(0, Math.round(totalInterest - previewProjection.totalInterest)) : 0;
          const previewMonthsSaved = previewProjection ? Math.max(0, monthsRemaining - previewProjection.monthsRemaining) : 0;
          const tableMode = getTableMode(loan.id);
          const visibleMonths = getVisibleMonths(loan.id);
          const monthlyRows = tableMode === 'summary' ? fullSchedule.slice(0, 12) : fullSchedule.slice(0, Math.min(visibleMonths, fullSchedule.length));
          const hasMoreMonths = tableMode === 'full' && monthlyRows.length < fullSchedule.length;

          return (
            <div key={loan.id} className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden hover:border-teal-300 transition-all">
              <div 
                className="p-6 sm:p-8 xl:p-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 xl:gap-8 cursor-pointer"
                onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
              >
                <div className="flex gap-5 sm:gap-6 flex-1 text-left min-w-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
                    <Icon size={28} />
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 px-3 py-1 rounded-lg">{loan.source}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{loan.sourceType} • {loan.type}</span>
                    </div>
                    <h4 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(loan.outstandingAmount, currencyCountry)}</h4>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 max-w-[280px]">
                      <span>Repayment Progress</span>
                      <span>{payoffProgress}%</span>
                    </div>
                    <div className="w-full max-w-[280px] h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
                       <div className="h-full bg-emerald-500" style={{ width: `${payoffProgress}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 sm:gap-6 text-left w-full xl:w-auto xl:min-w-[360px] xl:border-l border-slate-100 xl:pl-8">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">EMI</p>
                      <p className="text-lg sm:text-xl font-black text-slate-900">{formatCurrency(loan.emi || calculatedEmi, currencyCountry)}</p>
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
                      <p className="text-lg sm:text-xl font-black text-slate-900">{monthsRemaining} Mo</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{basis === 'years' ? 'Tenure in years' : 'Tenure in months'}</p>
                   </div>
                </div>

                <div className="flex gap-3 shrink-0 self-end xl:self-auto">
                  <button onClick={(e) => { e.stopPropagation(); removeLoan(loan.id); }} className="p-3 bg-rose-50 text-rose-400 hover:bg-rose-600 hover:text-white rounded-2xl transition-all"><Trash2 size={18}/></button>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-500 rounded-2xl">
                    <span className="text-[9px] font-black uppercase tracking-widest">{isExpanded ? 'Collapse' : 'Expand'}</span>
                    <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-slate-50 p-6 sm:p-8 xl:p-10 border-t border-slate-200 animate-in slide-in-from-top-4 space-y-8">
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 text-left">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Projected Interest</p>
                      <p className="text-xl font-black text-rose-500 mt-1">{formatCurrency(Math.round(totalInterest), currencyCountry)}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 text-left">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ends In</p>
                      <p className="text-xl font-black text-slate-900 mt-1">{monthsRemaining} Months</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 text-left">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">EMI Split</p>
                      <p className="text-base font-black text-slate-900 mt-1">
                        {monthlyInterestShare.toFixed(1)}% Interest / {(100 - monthlyInterestShare).toFixed(1)}% Principal
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 text-left">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Likely Payoff Year</p>
                      <p className="text-xl font-black text-teal-600 mt-1">{payoffYear}</p>
                    </div>
                  </div>

                  {isNegativeAmort && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 text-left">
                      EMI is currently below monthly interest. Increase EMI or plan additional payments to avoid balance growth.
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                    <div className="space-y-6">
                      <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5 text-left">
                        <h5 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest"><Zap size={16} className="text-amber-500"/> Additional Payments</h5>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                          Add optional lump-sum payments by year. These are applied directly to principal and can reduce tenure and interest.
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {[1, 3, 6].map((multiplier, idx) => (
                            <button
                              key={multiplier}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateLumpSumInput(loan.id, 'amount', String(suggestedExtraPayments[idx]));
                              }}
                              className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                            >
                              {multiplier} EMI
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Year</label>
                            <input
                              type="number"
                              value={lumpSumInput.year}
                              onChange={e => updateLumpSumInput(loan.id, 'year', e.target.value)}
                              min={loan.startYear ?? new Date().getFullYear()}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-teal-600"
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</label>
                            <input
                              type="number"
                              value={lumpSumInput.amount}
                              onChange={e => updateLumpSumInput(loan.id, 'amount', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-teal-600"
                              placeholder={`Amount ${currencySymbol}`}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); addLumpSum(loan.id); }}
                            className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                          >
                            Add Payment <ArrowDownToLine size={14}/>
                          </button>
                        </div>

                        {previewExtraAmount > 0 && (
                          <div className="p-3 rounded-xl bg-teal-50 border border-teal-100 text-[11px] font-bold text-teal-700">
                            If paid in next cycle, this may save {formatCurrency(previewInterestSaved, currencyCountry)} interest and reduce tenure by {previewMonthsSaved} months.
                          </div>
                        )}

                        {loan.lumpSumRepayments && loan.lumpSumRepayments.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span>Scheduled</span>
                              <span className="text-emerald-600">Total {formatCurrency(Math.round(totalExtras), currencyCountry)}</span>
                            </div>
                            <div className="space-y-2">
                              {[...loan.lumpSumRepayments].sort((a, b) => a.year - b.year).map((ls, idx) => (
                                <div key={`${ls.year}-${idx}`} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                  <div className="text-xs font-black text-slate-600">Year {ls.year}</div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-black text-slate-900">{formatCurrency(ls.amount, currencyCountry)}</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); removeLumpSum(loan.id, idx); }}
                                      className="text-[10px] font-black text-rose-500 uppercase tracking-widest"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {loan.notes && (
                        <div className="bg-teal-50 p-6 rounded-[2rem] border border-teal-100 text-left">
                          <h5 className="text-[10px] font-black text-teal-500 uppercase tracking-widest mb-2 flex items-center gap-2"><MessageSquare size={14}/> Planning Details</h5>
                          <p className="text-sm font-bold text-teal-900 leading-relaxed">{loan.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="xl:col-span-2 space-y-8">
                      <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                          <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><BarChart3 size={16}/> Repayment Curve (Next 12 Months)</h5>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400"/><span className="text-[10px] font-black text-slate-500 uppercase">Interest</span></div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400"/><span className="text-[10px] font-black text-slate-500 uppercase">Principal</span></div>
                          </div>
                        </div>
                        <div className="h-[220px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={schedule}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 800}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 800}} />
                              <Tooltip
                                contentStyle={{ borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 12px 24px rgba(15,23,42,0.12)', fontWeight: 700 }}
                                cursor={{ fill: '#f8fafc' }}
                              />
                              <Bar dataKey="interest" stackId="a" fill="#fb7185" radius={[0, 0, 0, 0]} />
                              <Bar dataKey="principal" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-slate-50 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Interest</p>
                            <p className="text-sm font-black text-rose-500 mt-1">{formatCurrency(monthlyInterest, currencyCountry)}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Principal</p>
                            <p className="text-sm font-black text-emerald-500 mt-1">{formatCurrency(monthlyPrincipal, currencyCountry)}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Extra Scheduled</p>
                            <p className="text-sm font-black text-slate-900 mt-1">{formatCurrency(totalExtras, currencyCountry)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Yearly Amortization Schedule</h5>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1 rounded-full uppercase">Annual View</span>
                            <button
                              onClick={() => exportYearlyCsv(loan, yearlySchedule)}
                              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition"
                            >
                              Export CSV
                            </button>
                            <button
                              onClick={() => exportYearlyPdf(loan, yearlySchedule)}
                              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white rounded-full hover:bg-slate-800 transition"
                            >
                              Export PDF
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto max-h-[320px] no-scrollbar">
                          <table className="w-full text-left min-w-[760px]">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                              <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Year</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Opening</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Interest</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">EMI</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Principal</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Additional</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Closing</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {yearlySchedule.map((row) => (
                                <tr key={row.year} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 text-xs font-black text-slate-700">Year {row.yearIndex}</td>
                                  <td className="px-4 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(row.openingBalance, currencyCountry)}</td>
                                  <td className="px-4 py-4 text-xs font-bold text-rose-500 text-right">{formatCurrency(row.interest, currencyCountry)}</td>
                                  <td className="px-4 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(row.emi, currencyCountry)}</td>
                                  <td className="px-4 py-4 text-xs font-bold text-emerald-500 text-right">{formatCurrency(row.principal, currencyCountry)}</td>
                                  <td className="px-4 py-4 text-xs font-bold text-slate-500 text-right">{row.extraPayment ? formatCurrency(row.extraPayment, currencyCountry) : '—'}</td>
                                  <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(row.closingBalance, currencyCountry)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Monthly Amortization</h5>
                            <p className="text-xs font-medium text-slate-500 mt-1">
                              {tableMode === 'summary'
                                ? 'Showing next 12 months for quick review.'
                                : `Showing ${monthlyRows.length} of ${fullSchedule.length} months.`}
                            </p>
                          </div>
                          <div className="inline-flex items-center p-1 bg-slate-100 rounded-full">
                            <button
                              onClick={() => setTableMode(loan.id, 'summary')}
                              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition ${tableMode === 'summary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                            >
                              Next 12
                            </button>
                            <button
                              onClick={() => setTableMode(loan.id, 'full')}
                              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition ${tableMode === 'full' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                            >
                              Full
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto max-h-[380px] no-scrollbar">
                          <table className="w-full text-left min-w-[760px]">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                              <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Month</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Opening</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Interest</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">EMI</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Principal</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Extra</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Closing</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {monthlyRows.map((row) => (
                                <tr key={row.month} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 text-xs font-black text-slate-700">Mo {row.month}</td>
                                  <td className="px-4 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(row.openingBalance, currencyCountry)}</td>
                                  <td className="px-4 py-4 text-xs font-bold text-rose-500 text-right">{formatCurrency(row.interest, currencyCountry)}</td>
                                  <td className="px-4 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(row.emi, currencyCountry)}</td>
                                  <td className="px-4 py-4 text-xs font-bold text-emerald-500 text-right">{formatCurrency(row.principal, currencyCountry)}</td>
                                  <td className="px-4 py-4 text-xs font-bold text-slate-500 text-right">{row.extraPayment ? formatCurrency(row.extraPayment, currencyCountry) : '—'}</td>
                                  <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(row.closingBalance, currencyCountry)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {tableMode === 'full' && (
                          <div className="px-6 sm:px-8 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {hasMoreMonths ? `${fullSchedule.length - monthlyRows.length} months remaining` : 'Showing complete schedule'}
                            </p>
                            {hasMoreMonths && (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => addVisibleMonths(loan.id, 24)}
                                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                                >
                                  Load 24 More
                                </button>
                                <button
                                  onClick={() => showAllMonths(loan.id, fullSchedule.length)}
                                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition"
                                >
                                  Show All
                                </button>
                              </div>
                            )}
                          </div>
                        )}
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
