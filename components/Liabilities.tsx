
import React, { useEffect, useMemo, useState } from 'react';
import {
  AnchorType,
  DayCountDenominator,
  DueDayMode,
  FinanceState,
  InstallmentType,
  InterestRateType,
  Loan,
  LoanSourceType,
  LoanType,
} from '../types';
import { 
  Plus, Trash2, Home, CreditCard, Car, Landmark, User, 
  ArrowUpRight, TrendingDown,
  ChevronDown, Calculator,
  Zap, MessageSquare,
  Lightbulb, BarChart3, Search, Columns3, Wand2, ArrowLeft, ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { parseNumber } from '../lib/validation';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';
import { buildAmortizationSchedule, buildYearlyAmortization } from '../lib/loanMath';
import { monthlyIncomeFromDetailed } from '../lib/incomeMath';
import { getRiskReturnAssumption } from '../lib/financeMath';
import SafeResponsiveContainer from './common/SafeResponsiveContainer';
import PlanningAssistStrip from './common/PlanningAssistStrip';

const LOAN_TYPES: { type: LoanType, icon: any }[] = [
  { type: 'Home Loan', icon: Home },
  { type: 'Car Loan', icon: Car },
  { type: 'Property Purchase', icon: Landmark },
  { type: 'Personal Loan', icon: User },
  { type: 'Credit Card EMI', icon: CreditCard },
  { type: 'OD', icon: Landmark },
];

const SOURCE_TYPES: LoanSourceType[] = ['Bank', 'NBFC', 'Friends & Family'];
const INTEREST_RATE_TYPES: InterestRateType[] = ['Fixed', 'Floating'];
const ANCHOR_TYPES: AnchorType[] = ['Repo', 'MCLR', 'External Benchmark', 'Custom'];
const INSTALLMENT_TYPES: InstallmentType[] = ['EMI', 'Equal Principal'];
const DUE_DAY_MODES: DueDayMode[] = ['Fixed Day', 'Month End'];
const DAY_COUNT_OPTIONS: DayCountDenominator[] = [365, 360];
const NO_OBLIGATIONS_FLAG_KEY = 'finvantage-no-obligations';
const PLANNING_DETAIL_HINTS: Partial<Record<LoanType, string>> = {
  'Home Loan': 'Fixed or floating, reset frequency, prepayment intent, tax use (80C/24b), co-borrower share.',
  'Car Loan': 'Planned closure date, expected upgrades, resale intent, insurance/maintenance obligation.',
  'Personal Loan': 'Purpose of borrowing, consolidation plan, expected one-time inflows for pre-closure.',
  'Credit Card EMI': 'Promotional tenure, revolving card behavior, expected card closure/reduction plan.',
  'Property Purchase': 'Stage-linked disbursal, rental readiness, possession timeline, co-owner details.',
  'OD': 'Typical utilization %, peak months, repayment buffer strategy, linked business cashflow.',
  'Others': 'Any terms that affect future cashflow, refinancing, or prepayment decisions.',
};

type RepriceStrategy = 'keep-emi' | 'keep-tenure';

type ColumnKey =
  | 'month'
  | 'dueDate'
  | 'openingBalance'
  | 'interest'
  | 'emi'
  | 'principal'
  | 'extraPayment'
  | 'daysInPeriod'
  | 'effectiveAnnualRate'
  | 'closingBalance';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  month: 'Month',
  dueDate: 'Due Date',
  openingBalance: 'Opening',
  interest: 'Interest',
  emi: 'Installment',
  principal: 'Principal',
  extraPayment: 'Extra',
  daysInPeriod: 'Days',
  effectiveAnnualRate: 'Rate',
  closingBalance: 'Closing',
};

const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  month: true,
  dueDate: true,
  openingBalance: true,
  interest: true,
  emi: true,
  principal: true,
  extraPayment: true,
  daysInPeriod: true,
  effectiveAnnualRate: true,
  closingBalance: true,
};

type ScenarioInput = {
  prepaymentAmount: string;
  prepaymentMonth: string;
  applyRateChange: boolean;
  revisedRate: string;
  revisedRateMonth: string;
  repriceStrategy: RepriceStrategy;
  installmentType: InstallmentType;
  dueDayMode: DueDayMode;
  dueDay: string;
  dayCountDenominator: DayCountDenominator;
};

const Liabilities: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [tableModeByLoan, setTableModeByLoan] = useState<Record<string, 'summary' | 'full'>>({});
  const [scheduleSearchByLoan, setScheduleSearchByLoan] = useState<Record<string, string>>({});
  const [schedulePageByLoan, setSchedulePageByLoan] = useState<Record<string, number>>({});
  const [schedulePageSizeByLoan, setSchedulePageSizeByLoan] = useState<Record<string, number>>({});
  const [visibleColumnsByLoan, setVisibleColumnsByLoan] = useState<Record<string, Record<ColumnKey, boolean>>>({});
  const [scenarioInputsByLoan, setScenarioInputsByLoan] = useState<Record<string, ScenarioInput>>({});
  const [lumpSumInputs, setLumpSumInputs] = useState<Record<string, { year: string; amount: string }>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [portfolioRateShockPct, setPortfolioRateShockPct] = useState(1);
  const [portfolioPrepayBudget, setPortfolioPrepayBudget] = useState(0);
  const [declaredNoObligations, setDeclaredNoObligations] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(NO_OBLIGATIONS_FLAG_KEY) === '1';
  });
  
  const [newLoan, setNewLoan] = useState<Partial<Loan>>({
    type: 'Home Loan',
    sourceType: 'Bank',
    owner: 'self',
    source: 'Bank',
    interestRateType: 'Fixed',
    anchorType: 'Repo',
    anchorRate: 0,
    spreadRate: 0,
    installmentType: 'EMI',
    dueDayMode: 'Fixed Day',
    dueDay: 5,
    dayCountDenominator: 365,
    brokenInterestCharged: true,
    repaymentFrequency: 'Monthly',
    tenureUnit: 'Months',
    sanctionedAmount: 0,
    outstandingAmount: 0,
    interestRate: 8.5,
    remainingTenure: 120,
    emi: 0,
    startYear: undefined,
    notes: '',
    lumpSumRepayments: []
  });

  const estimateOutstandingAmount = (
    emi: number,
    annualRate: number,
    rawTenure: number,
    tenureUnit?: 'Months' | 'Years'
  ) => {
    if (emi <= 0 || annualRate <= 0 || rawTenure <= 0) return 0;
    const roundedTenure = Math.max(1, Math.round(rawTenure));
    const months = tenureUnit === 'Years'
      ? roundedTenure * 12
      : tenureUnit === 'Months'
        ? roundedTenure
        : (roundedTenure <= 40 ? roundedTenure * 12 : roundedTenure);
    const monthlyRate = annualRate / 12 / 100;
    if (monthlyRate <= 0) return emi * months;
    const pv = emi * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
    return Math.max(0, pv);
  };

  const estimateEmiFromOutstanding = (principal: number, annualRate: number, months: number) => {
    if (principal <= 0 || months <= 0) return 0;
    const monthlyRate = annualRate / 12 / 100;
    if (monthlyRate <= 0) return principal / months;
    const factor = Math.pow(1 + monthlyRate, months);
    return principal * monthlyRate * factor / (factor - 1);
  };

  const buildScenarioDefaults = (loan: Loan): ScenarioInput => ({
    prepaymentAmount: '',
    prepaymentMonth: '1',
    applyRateChange: false,
    revisedRate: String(loan.interestRate || 0),
    revisedRateMonth: '1',
    repriceStrategy: 'keep-emi',
    installmentType: loan.installmentType || 'EMI',
    dueDayMode: loan.dueDayMode || 'Fixed Day',
    dueDay: String(loan.dueDay || 5),
    dayCountDenominator: loan.dayCountDenominator || 365,
  });

  const getScenarioInput = (loan: Loan) => scenarioInputsByLoan[loan.id] ?? buildScenarioDefaults(loan);

  const updateScenarioInput = (loan: Loan, patch: Partial<ScenarioInput>) => {
    setScenarioInputsByLoan(prev => {
      const current = prev[loan.id] ?? buildScenarioDefaults(loan);
      return { ...prev, [loan.id]: { ...current, ...patch } };
    });
  };

  const getScheduleSearch = (loanId: string) => scheduleSearchByLoan[loanId] ?? '';
  const setScheduleSearch = (loanId: string, value: string) => {
    setScheduleSearchByLoan(prev => ({ ...prev, [loanId]: value }));
    setSchedulePageByLoan(prev => ({ ...prev, [loanId]: 1 }));
  };

  const getSchedulePage = (loanId: string) => schedulePageByLoan[loanId] ?? 1;
  const setSchedulePage = (loanId: string, page: number) => {
    setSchedulePageByLoan(prev => ({ ...prev, [loanId]: Math.max(1, page) }));
  };

  const getSchedulePageSize = (loanId: string) => schedulePageSizeByLoan[loanId] ?? 12;
  const setSchedulePageSize = (loanId: string, size: number) => {
    setSchedulePageSizeByLoan(prev => ({ ...prev, [loanId]: size }));
    setSchedulePageByLoan(prev => ({ ...prev, [loanId]: 1 }));
  };

  const getVisibleColumns = (loanId: string) => visibleColumnsByLoan[loanId] ?? DEFAULT_VISIBLE_COLUMNS;
  const toggleColumnVisibility = (loanId: string, column: ColumnKey) => {
    setVisibleColumnsByLoan(prev => {
      const current = prev[loanId] ?? DEFAULT_VISIBLE_COLUMNS;
      const nextValue = !current[column];
      if (!nextValue) {
        const visibleCount = Object.values(current).filter(Boolean).length;
        if (visibleCount <= 1) return prev;
      }
      return { ...prev, [loanId]: { ...current, [column]: nextValue } };
    });
  };

  const handleAdd = () => {
    setFormError(null);
    setFormWarning(null);
    if (declaredNoObligations) {
      setFormError('Loan capture is locked. First confirm that you have obligations.');
      return;
    }

    const planningDetails = (newLoan.notes || '').trim();
    const source = (newLoan.sourceType || 'Bank').trim();
    const sanctionedInput = parseNumber(newLoan.sanctionedAmount || 0, 0);
    const interestRateType = (newLoan.interestRateType || 'Fixed') as InterestRateType;
    const anchorType = (newLoan.anchorType || 'Repo') as AnchorType;
    const anchorRate = parseNumber(newLoan.anchorRate || 0, 0);
    const spreadRate = parseNumber(newLoan.spreadRate || 0, 0);
    const fixedRate = parseNumber(newLoan.interestRate || 0, 0);
    const interestRate = interestRateType === 'Floating' ? (anchorRate + spreadRate) : fixedRate;
    const remainingTenure = parseNumber(newLoan.remainingTenure || 0, 0);
    const emi = parseNumber(newLoan.emi || 0, 0);
    const startYear = newLoan.startYear ? parseNumber(newLoan.startYear, new Date().getFullYear()) : undefined;
    const owner = newLoan.owner || 'self';
    const installmentType = (newLoan.installmentType || 'EMI') as InstallmentType;
    const dueDayMode = (newLoan.dueDayMode || 'Fixed Day') as DueDayMode;
    const dueDay = parseNumber(newLoan.dueDay || 5, 5);
    const dayCountDenominator = (newLoan.dayCountDenominator || 365) as DayCountDenominator;
    const brokenInterestCharged = newLoan.brokenInterestCharged !== false;
    const tenureUnit = (newLoan.tenureUnit || 'Months') as ('Months' | 'Years');

    if (emi <= 0) {
      setFormError('Monthly EMI is required and must be greater than 0.');
      return;
    }
    if (interestRateType === 'Floating' && (anchorRate <= 0 || spreadRate < 0)) {
      setFormError('For floating rate, enter valid anchor rate and spread.');
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
    if (dueDayMode === 'Fixed Day' && (dueDay < 1 || dueDay > 31)) {
      setFormError('Due day must be between 1 and 31.');
      return;
    }

    const estimatedOutstanding = estimateOutstandingAmount(emi, interestRate, remainingTenure, tenureUnit);
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
      interestRateType,
      anchorType: interestRateType === 'Floating' ? anchorType : undefined,
      anchorRate: interestRateType === 'Floating' ? anchorRate : undefined,
      spreadRate: interestRateType === 'Floating' ? spreadRate : undefined,
      installmentType,
      dueDayMode,
      dueDay: dueDayMode === 'Fixed Day' ? dueDay : undefined,
      dayCountDenominator,
      brokenInterestCharged,
      tenureUnit,
      repaymentFrequency: 'Monthly',
      startYear,
      notes: planningDetails || undefined,
    } as Loan;
    updateState({ loans: [...state.loans, loan] });
    setShowAdd(false);
    setNewLoan({
      type: 'Home Loan',
      sourceType: 'Bank',
      owner: 'self',
      source: 'Bank',
      interestRateType: 'Fixed',
      anchorType: 'Repo',
      anchorRate: 0,
      spreadRate: 0,
      installmentType: 'EMI',
      dueDayMode: 'Fixed Day',
      dueDay: 5,
      dayCountDenominator: 365,
      brokenInterestCharged: true,
      repaymentFrequency: 'Monthly',
      tenureUnit: 'Months',
      sanctionedAmount: 0,
      outstandingAmount: 0,
      interestRate: 8.5,
      remainingTenure: 120,
      emi: 0,
      startYear: undefined,
      notes: '',
      lumpSumRepayments: [],
    });
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
    setDeclaredNoObligations(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(NO_OBLIGATIONS_FLAG_KEY, '1');
    }
    setNotice("Declaration saved: no active loans/obligations.");
    setTimeout(() => setNotice(null), 3500);
  };

  const confirmHasObligations = () => {
    setDeclaredNoObligations(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(NO_OBLIGATIONS_FLAG_KEY);
    }
    setNotice('Loan capture unlocked. You can now add obligations.');
    setTimeout(() => setNotice(null), 3500);
  };

  useEffect(() => {
    if (state.loans.length > 0 && declaredNoObligations) {
      setDeclaredNoObligations(false);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(NO_OBLIGATIONS_FLAG_KEY);
      }
    }
  }, [state.loans.length, declaredNoObligations]);

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
    setSchedulePageByLoan(prev => ({ ...prev, [loanId]: 1 }));
  };

  const totalOutstanding = state.loans.reduce((sum, l) => sum + l.outstandingAmount, 0);
  const totalEMI = state.loans.reduce((sum, l) => sum + l.emi, 0);
  const totalAssets = state.assets.reduce((sum, asset) => sum + Math.max(0, Number(asset.currentValue || 0)), 0);
  const totalPlanningIncome = monthlyIncomeFromDetailed(state.profile.income)
    + state.family.reduce((sum, member) => {
      if (member.isDependent) return sum;
      if (!(member.includeIncomeInPlanning ?? false)) return sum;
      return sum + monthlyIncomeFromDetailed(member.income);
    }, 0);

  const getLoanScheduleOptions = (loan: Loan) => ({
    installmentType: loan.installmentType || 'EMI',
    dayCountDenominator: loan.dayCountDenominator || 365,
    dueDayMode: loan.dueDayMode === 'Month End' ? 'month-end' : 'fixed',
    dueDay: loan.dueDay || 5,
    brokenInterestCharged: loan.brokenInterestCharged !== false,
  });

  const liabilityAnalysis = useMemo(() => {
    if (state.loans.length === 0) {
      return {
        weightedRate: 0,
        nearTermOutstanding: 0,
        shockedTotalEmi: 0,
        deltaEmi: 0,
        estimatedInterestDelta: 0,
        currentDti: 0,
        shockedDti: 0,
        annualInterestBurden: 0,
        debtToAssetRatio: 0,
        baseWeightedMonths: 0,
        projectedClosureMonths: 0,
        closureGainMonths: 0,
        investmentReturnAssumption: getRiskReturnAssumption(state.riskProfile?.level),
        estimatedPrepayBenefitAnnual: 0,
        estimatedInvestBenefitAnnual: 0,
        prepayVsInvestDelta: 0,
      };
    }

    const weightedRateNumerator = state.loans.reduce(
      (sum, loan) => sum + Math.max(0, Number(loan.outstandingAmount || 0)) * Math.max(0, Number(loan.interestRate || 0)),
      0,
    );
    const weightedRate = totalOutstanding > 0 ? weightedRateNumerator / totalOutstanding : 0;
    const annualInterestBurden = (totalOutstanding * weightedRate) / 100;
    const debtToAssetRatio = totalAssets > 0 ? (totalOutstanding / totalAssets) * 100 : 0;
    const baseWeightedMonths = totalOutstanding > 0
      ? state.loans.reduce((sum, loan) => {
          const months = (loan.tenureUnit || 'Months') === 'Years'
            ? Math.max(1, Math.round(Number(loan.remainingTenure || 0) * 12))
            : Math.max(1, Math.round(Number(loan.remainingTenure || 0)));
          const weight = Math.max(0, Number(loan.outstandingAmount || 0));
          return sum + months * weight;
        }, 0) / totalOutstanding
      : 0;
    const prepayImpactFactor = totalOutstanding > 0 ? Math.min(0.6, (portfolioPrepayBudget / totalOutstanding) * 0.8) : 0;
    const projectedClosureMonths = baseWeightedMonths > 0 ? baseWeightedMonths * (1 - prepayImpactFactor) : 0;
    const closureGainMonths = Math.max(0, baseWeightedMonths - projectedClosureMonths);
    const investmentReturnAssumption = getRiskReturnAssumption(state.riskProfile?.level);
    const estimatedPrepayBenefitAnnual = (portfolioPrepayBudget * weightedRate) / 100;
    const estimatedInvestBenefitAnnual = (portfolioPrepayBudget * investmentReturnAssumption) / 100;
    const prepayVsInvestDelta = estimatedPrepayBenefitAnnual - estimatedInvestBenefitAnnual;

    let nearTermOutstanding = 0;
    let shockedTotalEmi = 0;
    let baseTotalEmi = 0;
    let baseEstimatedInterest = 0;
    let stressedEstimatedInterest = 0;

    state.loans.forEach((loan) => {
      const tenureMonths = (loan.tenureUnit || 'Months') === 'Years'
        ? Math.max(1, Math.round(Number(loan.remainingTenure || 0) * 12))
        : Math.max(1, Math.round(Number(loan.remainingTenure || 0)));
      if (tenureMonths <= 36) nearTermOutstanding += Math.max(0, Number(loan.outstandingAmount || 0));

      const outstanding = Math.max(0, Number(loan.outstandingAmount || 0));
      const baseRate = Math.max(0, Number(loan.interestRate || 0));
      const baseEmi = loan.emi > 0 ? Number(loan.emi) : estimateEmiFromOutstanding(outstanding, baseRate, tenureMonths);
      baseTotalEmi += baseEmi;
      baseEstimatedInterest += Math.max(0, baseEmi * tenureMonths - outstanding);

      const shockedRate = Math.min(45, baseRate + portfolioRateShockPct);
      const allocatedPrepay = totalOutstanding > 0 ? portfolioPrepayBudget * (outstanding / totalOutstanding) : 0;
      const shockedOutstanding = Math.max(0, outstanding - allocatedPrepay);
      const shockedEmi = estimateEmiFromOutstanding(shockedOutstanding, shockedRate, tenureMonths);
      shockedTotalEmi += shockedEmi;
      stressedEstimatedInterest += Math.max(0, shockedEmi * tenureMonths - shockedOutstanding);
    });

    const deltaEmi = shockedTotalEmi - baseTotalEmi;
    const estimatedInterestDelta = stressedEstimatedInterest - baseEstimatedInterest;

    return {
      weightedRate,
      nearTermOutstanding,
      shockedTotalEmi,
      deltaEmi,
      estimatedInterestDelta,
      currentDti: totalPlanningIncome > 0 ? (baseTotalEmi / totalPlanningIncome) * 100 : 0,
      shockedDti: totalPlanningIncome > 0 ? (shockedTotalEmi / totalPlanningIncome) * 100 : 0,
      annualInterestBurden,
      debtToAssetRatio,
      baseWeightedMonths,
      projectedClosureMonths,
      closureGainMonths,
      investmentReturnAssumption,
      estimatedPrepayBenefitAnnual,
      estimatedInvestBenefitAnnual,
      prepayVsInvestDelta,
    };
  }, [state.loans, totalOutstanding, totalPlanningIncome, totalAssets, portfolioRateShockPct, portfolioPrepayBudget, state.riskProfile?.level]);

  // Amortization Calculator with Lump Sum Projection
  const calculateProjections = (loan: Loan) => {
    const projection = buildAmortizationSchedule(loan, getLoanScheduleOptions(loan));
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
  const effectiveInterestRateForInput = newLoan.interestRateType === 'Floating'
    ? parseNumber(newLoan.anchorRate || 0, 0) + parseNumber(newLoan.spreadRate || 0, 0)
    : parseNumber(newLoan.interestRate || 0, 0);
  const outstandingPreview = estimateOutstandingAmount(
    parseNumber(newLoan.emi || 0, 0),
    effectiveInterestRateForInput,
    parseNumber(newLoan.remainingTenure || 0, 0),
    (newLoan.tenureUnit || 'Months') as ('Months' | 'Years')
  );
  const hasOutstandingPreview = outstandingPreview > 0;

  const liabilityAssistStats = useMemo(() => {
    const dtiTone = liabilityAnalysis.currentDti <= 30
      ? 'positive'
      : liabilityAnalysis.currentDti <= 45
        ? 'warning'
        : 'critical';
    const debtAssetTone = liabilityAnalysis.debtToAssetRatio <= 25
      ? 'positive'
      : liabilityAnalysis.debtToAssetRatio <= 45
        ? 'warning'
        : 'critical';

    return [
      {
        label: 'Active Loans',
        value: String(state.loans.length),
      },
      {
        label: 'Total EMI',
        value: formatCurrency(totalEMI, currencyCountry),
        tone: dtiTone,
      },
      {
        label: 'Current DTI',
        value: `${liabilityAnalysis.currentDti.toFixed(1)}%`,
        tone: dtiTone,
      },
      {
        label: 'Weighted Rate',
        value: `${liabilityAnalysis.weightedRate.toFixed(2)}%`,
        tone: liabilityAnalysis.weightedRate <= 9 ? 'positive' : 'warning',
      },
      {
        label: 'Debt / Asset',
        value: `${liabilityAnalysis.debtToAssetRatio.toFixed(1)}%`,
        tone: debtAssetTone,
      },
    ] as const;
  }, [state.loans.length, totalEMI, currencyCountry, liabilityAnalysis]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest">
          {notice}
        </div>
      )}

      <PlanningAssistStrip
        title="Control debt pressure before it impacts goals"
        description="Review obligation load, interest exposure, and repayment sustainability at portfolio level."
        tip="If DTI rises above 40%, prioritize refinance or prepayment before increasing discretionary goals."
        actions={(
          <div className="flex flex-col sm:flex-row gap-2.5">
            {state.loans.length === 0 && !declaredNoObligations && (
              <button
                type="button"
                onClick={declareNoLoans}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-2xl hover:border-slate-300 transition-colors font-black uppercase text-[10px] tracking-widest"
              >
                I Don&apos;t Have Loans
              </button>
            )}
            <button
              type="button"
              disabled={declaredNoObligations}
              onClick={() => setShowAdd(prev => !prev)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-colors font-black uppercase text-[10px] tracking-widest shadow-lg ${
                declaredNoObligations
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-600 text-white hover:bg-teal-500'
              }`}
            >
              <Plus size={14} /> {showAdd ? 'Close Form' : 'Add Loan Profile'}
            </button>
          </div>
        )}
        stats={liabilityAssistStats.map((stat) => ({
          label: stat.label,
          value: stat.value,
          tone: stat.tone,
        }))}
      />

      {declaredNoObligations && state.loans.length === 0 && (
        <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl px-6 py-4 text-left flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-300">No Obligations Declared</p>
            <p className="text-sm font-medium text-slate-200">Loan entry is locked to avoid accidental additions. Confirm if this has changed.</p>
          </div>
          <button
            onClick={confirmHasObligations}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            I Have Obligations
          </button>
        </div>
      )}

      {showAdd && !declaredNoObligations && (
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
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Interest Rate Model</label>
                 <select
                   value={newLoan.interestRateType || 'Fixed'}
                   onChange={e => setNewLoan({ ...newLoan, interestRateType: e.target.value as InterestRateType })}
                   className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                 >
                   {INTEREST_RATE_TYPES.map(model => <option key={model}>{model}</option>)}
                 </select>
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Installment Type</label>
                 <select
                   value={newLoan.installmentType || 'EMI'}
                   onChange={e => setNewLoan({ ...newLoan, installmentType: e.target.value as InstallmentType })}
                   className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                 >
                   {INSTALLMENT_TYPES.map(item => <option key={item}>{item}</option>)}
                 </select>
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
                {newLoan.interestRateType === 'Floating' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Anchor Type</label>
                      <select
                        value={newLoan.anchorType || 'Repo'}
                        onChange={e => setNewLoan({ ...newLoan, anchorType: e.target.value as AnchorType })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                      >
                        {ANCHOR_TYPES.map(anchor => <option key={anchor}>{anchor}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Derived Rate (%)</label>
                      <div className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-black text-teal-700 min-h-[56px] flex items-center">
                        {effectiveInterestRateForInput.toFixed(2)}%
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Interest Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newLoan.interestRate || ''}
                        onChange={e => setNewLoan({ ...newLoan, interestRate: parseFloat(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tenure Unit</label>
                      <select
                        value={newLoan.tenureUnit || 'Months'}
                        onChange={e => setNewLoan({ ...newLoan, tenureUnit: e.target.value as ('Months' | 'Years') })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                      >
                        <option value="Months">Months</option>
                        <option value="Years">Years</option>
                      </select>
                    </div>
                  </>
                )}
             </div>

             {newLoan.interestRateType === 'Floating' && (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Anchor Rate (%)</label>
                   <input
                     type="number"
                     step="0.01"
                     value={newLoan.anchorRate || ''}
                     onChange={e => setNewLoan({ ...newLoan, anchorRate: parseFloat(e.target.value) })}
                     className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Spread (%)</label>
                   <input
                     type="number"
                     step="0.01"
                     value={newLoan.spreadRate || ''}
                     onChange={e => setNewLoan({ ...newLoan, spreadRate: parseFloat(e.target.value) })}
                     className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tenure Unit</label>
                   <select
                     value={newLoan.tenureUnit || 'Months'}
                     onChange={e => setNewLoan({ ...newLoan, tenureUnit: e.target.value as ('Months' | 'Years') })}
                     className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                   >
                     <option value="Months">Months</option>
                     <option value="Years">Years</option>
                   </select>
                 </div>
               </div>
             )}

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remaining Tenure</label>
                  <input type="number" value={newLoan.remainingTenure || ''} onChange={e => setNewLoan({...newLoan, remainingTenure: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none" />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Enter years or months — system auto-detects using EMI</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Repayment Frequency</label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-black text-slate-900 min-h-[56px] flex items-center">
                    Monthly
                  </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Due Day Mode</label>
                  <select
                    value={newLoan.dueDayMode || 'Fixed Day'}
                    onChange={e => setNewLoan({ ...newLoan, dueDayMode: e.target.value as DueDayMode })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                  >
                    {DUE_DAY_MODES.map(mode => <option key={mode}>{mode}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Due Day</label>
                  <input
                    type="number"
                    value={newLoan.dueDay || ''}
                    disabled={newLoan.dueDayMode === 'Month End'}
                    onChange={e => setNewLoan({ ...newLoan, dueDay: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none disabled:opacity-40"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Day Count</label>
                  <select
                    value={newLoan.dayCountDenominator || 365}
                    onChange={e => setNewLoan({ ...newLoan, dayCountDenominator: Number(e.target.value) as DayCountDenominator })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 font-bold outline-none"
                  >
                    {DAY_COUNT_OPTIONS.map(option => <option key={option} value={option}>Actual/{option}</option>)}
                  </select>
                </div>
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
             {liabilityAnalysis.currentDti.toFixed(1)}%
           </h4>
        </div>
        <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100 flex flex-col justify-center text-left">
           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Status</p>
           <h4 className="text-2xl font-black text-emerald-700 tracking-tighter">
             {liabilityAnalysis.currentDti > 45 ? 'Stressed' : liabilityAnalysis.currentDti > 30 ? 'Watchlist' : 'Serviceable'}
           </h4>
           <p className="text-[9px] font-bold text-emerald-500 uppercase mt-1">
             {liabilityAnalysis.currentDti > 45 ? 'High Debt Load' : liabilityAnalysis.currentDti > 30 ? 'Monitor Closely' : 'Within Safe Limits'}
           </p>
        </div>
      </div>

      {state.loans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Debt-to-asset ratio</p>
            <p className={`text-2xl font-black mt-1 ${liabilityAnalysis.debtToAssetRatio > 40 ? 'text-rose-600' : liabilityAnalysis.debtToAssetRatio > 25 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {liabilityAnalysis.debtToAssetRatio.toFixed(1)}%
            </p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Annual interest burden</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {formatCurrency(liabilityAnalysis.annualInterestBurden, currencyCountry)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Closure timeline</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {liabilityAnalysis.projectedClosureMonths > 0 ? `${Math.round(liabilityAnalysis.projectedClosureMonths)} mo` : 'N/A'}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mt-1">
              {liabilityAnalysis.closureGainMonths > 0 ? `~${Math.round(liabilityAnalysis.closureGainMonths)} mo faster` : 'No reduction yet'}
            </p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prepay vs invest (1Y)</p>
            <p className={`text-2xl font-black mt-1 ${liabilityAnalysis.prepayVsInvestDelta >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {liabilityAnalysis.prepayVsInvestDelta >= 0 ? '+' : ''}{formatCurrency(liabilityAnalysis.prepayVsInvestDelta, currencyCountry)}
            </p>
            <p className="text-[10px] font-semibold text-slate-500 mt-1">
              Prepay @{liabilityAnalysis.weightedRate.toFixed(2)}% vs invest @{liabilityAnalysis.investmentReturnAssumption.toFixed(1)}%.
            </p>
          </div>
        </div>
      )}

      {state.loans.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-6">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Portfolio Debt Analysis</p>
                <h3 className="text-2xl font-black text-slate-900">Rate and Prepay Simulator</h3>
              </div>
              <div className="px-3 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Weighted rate</p>
                <p className="text-lg font-black text-slate-900">{liabilityAnalysis.weightedRate.toFixed(2)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rate shock</label>
                  <span className="text-sm font-black text-slate-900">+{portfolioRateShockPct.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.1}
                  value={portfolioRateShockPct}
                  onChange={(event) => setPortfolioRateShockPct(Number(event.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-rose-500 cursor-pointer"
                />
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">One-time prepay budget</label>
                  <span className="text-sm font-black text-slate-900">{formatCurrency(portfolioPrepayBudget, currencyCountry)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1000, Math.round(totalOutstanding * 0.25))}
                  step={1000}
                  value={portfolioPrepayBudget}
                  onChange={(event) => setPortfolioPrepayBudget(Number(event.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-teal-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Near-term maturity (≤36m)</p>
                <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(liabilityAnalysis.nearTermOutstanding, currencyCountry)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Scenario EMI</p>
                <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(liabilityAnalysis.shockedTotalEmi, currencyCountry)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">EMI delta</p>
                <p className={`text-lg font-black mt-1 ${liabilityAnalysis.deltaEmi <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(liabilityAnalysis.deltaEmi, currencyCountry)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Scenario DTI</p>
                <p className={`text-lg font-black mt-1 ${liabilityAnalysis.shockedDti > 45 ? 'text-rose-600' : liabilityAnalysis.shockedDti > 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {liabilityAnalysis.shockedDti.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="surface-dark p-6 md:p-8 rounded-[2.5rem] text-white space-y-5 shadow-xl text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Portfolio Signal</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimated lifetime interest impact</p>
              <p className={`text-xl font-black mt-1 ${liabilityAnalysis.estimatedInterestDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {liabilityAnalysis.estimatedInterestDelta <= 0 ? 'Save ' : 'Add '}
                {formatCurrency(Math.abs(liabilityAnalysis.estimatedInterestDelta), currencyCountry)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Action cue</p>
              <p className="text-sm font-semibold text-slate-200 mt-2">
                {liabilityAnalysis.shockedDti > 45
                  ? 'Scenario DTI is stressed. Prioritize high-rate loan prepayment or refinance to restore debt capacity.'
                  : 'Debt load remains manageable in this scenario. Use per-loan what-if blocks below for execution planning.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {state.loans.length === 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-left">
          <div className="space-y-2">
            <h4 className="text-xl font-black text-slate-900">No Active Loans Captured</h4>
            <p className="text-sm font-medium text-slate-500">
              If you do not have any loans or obligations, declare it now so planning assumes zero debt servicing.
            </p>
          </div>
          {!declaredNoObligations && (
            <button
              onClick={declareNoLoans}
              className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-teal-600 transition-all"
            >
              Declare No Loans/Obligations
            </button>
          )}
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
          const previewProjection = previewExtraAmount > 0
            ? buildAmortizationSchedule(loan, { ...getLoanScheduleOptions(loan), extraPayment: previewExtraAmount, extraPaymentMonth: 1 })
            : null;
          const previewInterestSaved = previewProjection ? Math.max(0, Math.round(totalInterest - previewProjection.totalInterest)) : 0;
          const previewMonthsSaved = previewProjection ? Math.max(0, monthsRemaining - previewProjection.monthsRemaining) : 0;
          const scenarioInput = getScenarioInput(loan);
          const scenarioPrepayAmount = parseNumber(scenarioInput.prepaymentAmount, 0);
          const scenarioPrepayMonth = Math.max(1, Math.round(parseNumber(scenarioInput.prepaymentMonth, 1)));
          const scenarioRate = parseNumber(scenarioInput.revisedRate, loan.interestRate);
          const scenarioRateMonth = Math.max(1, Math.round(parseNumber(scenarioInput.revisedRateMonth, 1)));
          const scenarioDueDay = Math.max(1, Math.min(31, Math.round(parseNumber(scenarioInput.dueDay, loan.dueDay || 5))));
          const scenarioProjection = buildAmortizationSchedule(loan, {
            ...getLoanScheduleOptions(loan),
            installmentType: scenarioInput.installmentType,
            dayCountDenominator: scenarioInput.dayCountDenominator,
            dueDayMode: scenarioInput.dueDayMode === 'Month End' ? 'month-end' : 'fixed',
            dueDay: scenarioInput.dueDayMode === 'Month End' ? undefined : scenarioDueDay,
            repriceStrategy: scenarioInput.repriceStrategy,
            extraPayment: scenarioPrepayAmount > 0 ? scenarioPrepayAmount : undefined,
            extraPaymentMonth: scenarioPrepayAmount > 0 ? scenarioPrepayMonth : undefined,
            rateAdjustments: scenarioInput.applyRateChange
              ? [{ fromMonth: scenarioRateMonth, annualRate: scenarioRate }]
              : undefined,
          });
          const scenarioInterestDelta = Math.round(totalInterest - scenarioProjection.totalInterest);
          const scenarioMonthsDelta = monthsRemaining - scenarioProjection.monthsRemaining;
          const tableMode = getTableMode(loan.id);
          const scheduleSearch = getScheduleSearch(loan.id).trim().toLowerCase();
          const pageSize = getSchedulePageSize(loan.id);
          const requestedPage = getSchedulePage(loan.id);
          const visibleColumns = getVisibleColumns(loan.id);
          const filteredRows = tableMode === 'summary'
            ? fullSchedule.slice(0, 12)
            : fullSchedule.filter((row) => {
                if (!scheduleSearch) return true;
                const rowText = `mo ${row.month} ${row.year} ${row.dueDate || ''} ${row.effectiveAnnualRate ?? ''}`;
                return rowText.toLowerCase().includes(scheduleSearch);
              });
          const totalRows = filteredRows.length;
          const totalPages = tableMode === 'summary' ? 1 : Math.max(1, Math.ceil(totalRows / pageSize));
          const currentPage = tableMode === 'summary' ? 1 : Math.min(requestedPage, totalPages);
          const pageStart = tableMode === 'summary' ? 0 : (currentPage - 1) * pageSize;
          const monthlyRows = tableMode === 'summary'
            ? filteredRows
            : filteredRows.slice(pageStart, pageStart + pageSize);
          const visibleTotals = monthlyRows.reduce(
            (acc, row) => {
              acc.interest += row.interest;
              acc.emi += row.emi;
              acc.principal += row.principal;
              acc.extra += row.extraPayment;
              return acc;
            },
            { interest: 0, emi: 0, principal: 0, extra: 0 }
          );

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

                  <div className="bg-white rounded-[2rem] border border-slate-200 p-6 sm:p-8 space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="text-left">
                        <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Wand2 size={16} /> What-if Loan Planner</h5>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          Preview restructuring and prepayment impact before execution.
                        </p>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest bg-teal-50 text-teal-600 px-3 py-1 rounded-full">Preview</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prepay Amount</label>
                        <input
                          type="number"
                          value={scenarioInput.prepaymentAmount}
                          onChange={e => updateScenarioInput(loan, { prepaymentAmount: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-600"
                          placeholder={`${currencySymbol}0`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prepay Month</label>
                        <input
                          type="number"
                          min={1}
                          value={scenarioInput.prepaymentMonth}
                          onChange={e => updateScenarioInput(loan, { prepaymentMonth: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-600"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Installment Strategy</label>
                        <select
                          value={scenarioInput.repriceStrategy}
                          onChange={e => updateScenarioInput(loan, { repriceStrategy: e.target.value as RepriceStrategy })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-600"
                        >
                          <option value="keep-emi">Keep EMI (reduce tenure)</option>
                          <option value="keep-tenure">Keep tenure (adjust EMI)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Installment Type</label>
                        <select
                          value={scenarioInput.installmentType}
                          onChange={e => updateScenarioInput(loan, { installmentType: e.target.value as InstallmentType })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-600"
                        >
                          {INSTALLMENT_TYPES.map(item => <option key={item}>{item}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Day Mode</label>
                        <select
                          value={scenarioInput.dueDayMode}
                          onChange={e => updateScenarioInput(loan, { dueDayMode: e.target.value as DueDayMode })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-600"
                        >
                          {DUE_DAY_MODES.map(mode => <option key={mode}>{mode}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Day</label>
                        <input
                          type="number"
                          disabled={scenarioInput.dueDayMode === 'Month End'}
                          value={scenarioInput.dueDay}
                          onChange={e => updateScenarioInput(loan, { dueDay: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-600 disabled:opacity-40"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Day Count</label>
                        <select
                          value={scenarioInput.dayCountDenominator}
                          onChange={e => updateScenarioInput(loan, { dayCountDenominator: Number(e.target.value) as DayCountDenominator })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-600"
                        >
                          {DAY_COUNT_OPTIONS.map(option => <option key={option} value={option}>Actual/{option}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={scenarioInput.applyRateChange}
                            onChange={e => updateScenarioInput(loan, { applyRateChange: e.target.checked })}
                          />
                          Apply Rate Change
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!scenarioInput.applyRateChange}
                          value={scenarioInput.revisedRate}
                          onChange={e => updateScenarioInput(loan, { revisedRate: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-600 disabled:opacity-40"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate Change Month</label>
                        <input
                          type="number"
                          min={1}
                          disabled={!scenarioInput.applyRateChange}
                          value={scenarioInput.revisedRateMonth}
                          onChange={e => updateScenarioInput(loan, { revisedRateMonth: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-600 disabled:opacity-40"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Interest Impact</p>
                        <p className={`text-sm font-black mt-1 ${scenarioInterestDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {scenarioInterestDelta >= 0 ? 'Save ' : 'Add '}
                          {formatCurrency(Math.abs(scenarioInterestDelta), currencyCountry)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tenure Impact</p>
                        <p className={`text-sm font-black mt-1 ${scenarioMonthsDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {scenarioMonthsDelta >= 0 ? `${scenarioMonthsDelta} months earlier` : `${Math.abs(scenarioMonthsDelta)} months longer`}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Projected End</p>
                        <p className="text-sm font-black mt-1 text-slate-900">
                          {new Date().getFullYear() + Math.ceil(scenarioProjection.monthsRemaining / 12)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                    <div className="space-y-6">
                      <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm text-left overflow-hidden">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                              <Zap size={16} className="text-amber-500" />
                            </div>
                            <div>
                              <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest">Additional Payments</h5>
                              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1 max-w-[28ch]">
                                Add optional lump-sum payments by year to reduce total interest and tenure.
                              </p>
                            </div>
                          </div>
                          <div className="hidden sm:block text-right bg-teal-50 border border-teal-100 rounded-2xl px-4 py-3">
                            <p className="text-[9px] font-black uppercase tracking-widest text-teal-600">Scheduled Total</p>
                            <p className="text-sm font-black text-teal-700 mt-1">{formatCurrency(totalExtras, currencyCountry)}</p>
                          </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quick Add</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {[1, 3, 6].map((multiplier, idx) => (
                              <button
                                key={multiplier}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateLumpSumInput(loan.id, 'amount', String(suggestedExtraPayments[idx]));
                                }}
                                className="px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-600 hover:border-teal-200 hover:text-teal-700 hover:bg-teal-50 transition"
                              >
                                {multiplier} EMI
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
                            <div className="space-y-2 sm:col-span-2">
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
                            <div className="space-y-2 sm:col-span-2">
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
                              className="w-full sm:col-span-2 py-3.5 bg-teal-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                            >
                              Add Payment <Plus size={14} />
                            </button>
                          </div>
                        </div>

                        {previewExtraAmount > 0 && (
                          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">Projected Benefit</p>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="rounded-xl bg-white/80 border border-teal-100 px-3 py-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-teal-500">Interest Saved</p>
                                <p className="text-sm font-black text-teal-700 mt-1">{formatCurrency(previewInterestSaved, currencyCountry)}</p>
                              </div>
                              <div className="rounded-xl bg-white/80 border border-teal-100 px-3 py-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-teal-500">Tenure Reduced</p>
                                <p className="text-sm font-black text-teal-700 mt-1">{previewMonthsSaved} months</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {loan.lumpSumRepayments && loan.lumpSumRepayments.length > 0 && (
                          <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span>Scheduled Payments</span>
                              <span className="text-emerald-600">{loan.lumpSumRepayments.length} entries</span>
                            </div>
                            <div className="space-y-2 max-h-[192px] overflow-y-auto pr-1">
                              {[...loan.lumpSumRepayments]
                                .map((ls, originalIndex) => ({ ...ls, originalIndex }))
                                .sort((a, b) => a.year - b.year)
                                .map((ls) => (
                                  <div key={`${ls.year}-${ls.originalIndex}`} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                    <div>
                                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Year</p>
                                      <p className="text-sm font-black text-slate-900 mt-1">{ls.year}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-black text-teal-700">{formatCurrency(ls.amount, currencyCountry)}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); removeLumpSum(loan.id, ls.originalIndex); }}
                                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                                        aria-label={`Remove payment for year ${ls.year}`}
                                      >
                                        <Trash2 size={14} />
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
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
                          <div>
                            <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <BarChart3 size={16} /> Repayment Curve (Next 12 Months)
                            </h5>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                              Understand how each installment splits between interest and principal.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 bg-rose-50 border border-rose-100 px-3 py-1 rounded-full">
                              <span className="w-2 h-2 rounded-full bg-rose-400" />
                              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Interest</span>
                            </span>
                            <span className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Principal</span>
                            </span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3 sm:p-4">
                          <div className="h-[250px] w-full">
                            <SafeResponsiveContainer>
                              <BarChart data={schedule}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 800 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 800 }} />
                                <Tooltip
                                  contentStyle={{ borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 12px 24px rgba(15,23,42,0.12)', fontWeight: 700 }}
                                  cursor={{ fill: '#f8fafc' }}
                                />
                                <Bar dataKey="interest" stackId="a" fill="#fb7185" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="principal" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </SafeResponsiveContainer>
                          </div>
                        </div>
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                          <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Monthly Interest</p>
                            <p className="text-sm font-black text-rose-600 mt-1">{formatCurrency(monthlyInterest, currencyCountry)}</p>
                          </div>
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Monthly Principal</p>
                            <p className="text-sm font-black text-emerald-600 mt-1">{formatCurrency(monthlyPrincipal, currencyCountry)}</p>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Interest Share</p>
                            <p className="text-sm font-black text-slate-800 mt-1">{monthlyInterestShare.toFixed(1)}%</p>
                          </div>
                          <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Total Extra Scheduled</p>
                            <p className="text-sm font-black text-teal-700 mt-1">{formatCurrency(totalExtras, currencyCountry)}</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <span>Interest</span>
                            <span>Principal</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-white border border-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-rose-400 rounded-full"
                              style={{ width: `${Math.max(0, Math.min(100, monthlyInterestShare))}%` }}
                            />
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
                        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex flex-col gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                              <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Monthly Amortization Drilldown</h5>
                              <p className="text-xs font-medium text-slate-500 mt-1">
                                {tableMode === 'summary'
                                  ? 'Showing next 12 months for quick review.'
                                  : `Showing ${monthlyRows.length} of ${totalRows} filtered months.`}
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

                          {tableMode === 'full' && (
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                              <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                <Search size={15} className="text-slate-400" />
                                <input
                                  value={getScheduleSearch(loan.id)}
                                  onChange={e => setScheduleSearch(loan.id, e.target.value)}
                                  placeholder="Search month, year or due date"
                                  className="w-full bg-transparent outline-none text-xs font-semibold text-slate-800"
                                />
                              </label>
                              <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rows</span>
                                <select
                                  value={pageSize}
                                  onChange={e => setSchedulePageSize(loan.id, Number(e.target.value))}
                                  className="ml-auto bg-transparent outline-none text-xs font-black text-slate-700"
                                >
                                  {[12, 24, 48].map(size => <option key={size} value={size}>{size}</option>)}
                                </select>
                              </label>
                              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <Columns3 size={14} />
                                Columns
                              </div>
                            </div>
                          )}

                          {tableMode === 'full' && (
                            <div className="flex flex-wrap gap-2">
                              {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                                <button
                                  key={key}
                                  onClick={() => toggleColumnVisibility(loan.id, key)}
                                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition ${
                                    visibleColumns[key]
                                      ? 'bg-teal-50 text-teal-700 border border-teal-100'
                                      : 'bg-slate-100 text-slate-500 border border-transparent'
                                  }`}
                                >
                                  {COLUMN_LABELS[key]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="overflow-x-auto max-h-[420px] no-scrollbar">
                          <table className="w-full text-left min-w-[980px]">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                              <tr>
                                {visibleColumns.month && <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Month</th>}
                                {visibleColumns.dueDate && <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase">Due Date</th>}
                                {visibleColumns.openingBalance && <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Opening</th>}
                                {visibleColumns.interest && <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Interest</th>}
                                {visibleColumns.emi && <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Installment</th>}
                                {visibleColumns.principal && <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Principal</th>}
                                {visibleColumns.extraPayment && <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Extra</th>}
                                {visibleColumns.daysInPeriod && <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Days</th>}
                                {visibleColumns.effectiveAnnualRate && <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Rate</th>}
                                {visibleColumns.closingBalance && <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Closing</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {monthlyRows.length === 0 && (
                                <tr>
                                  <td colSpan={10} className="px-6 py-6 text-xs font-bold text-slate-500 text-center">
                                    No schedule rows match this search.
                                  </td>
                                </tr>
                              )}
                              {monthlyRows.map((row) => (
                                <tr key={`${loan.id}-${row.month}`} className="hover:bg-slate-50 transition-colors">
                                  {visibleColumns.month && <td className="px-6 py-4 text-xs font-black text-slate-700">Mo {row.month}</td>}
                                  {visibleColumns.dueDate && <td className="px-4 py-4 text-xs font-bold text-slate-700">{row.dueDate || '—'}</td>}
                                  {visibleColumns.openingBalance && <td className="px-4 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(row.openingBalance, currencyCountry)}</td>}
                                  {visibleColumns.interest && <td className="px-4 py-4 text-xs font-bold text-rose-500 text-right">{formatCurrency(row.interest, currencyCountry)}</td>}
                                  {visibleColumns.emi && <td className="px-4 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(row.emi, currencyCountry)}</td>}
                                  {visibleColumns.principal && <td className="px-4 py-4 text-xs font-bold text-emerald-500 text-right">{formatCurrency(row.principal, currencyCountry)}</td>}
                                  {visibleColumns.extraPayment && <td className="px-4 py-4 text-xs font-bold text-slate-500 text-right">{row.extraPayment ? formatCurrency(row.extraPayment, currencyCountry) : '—'}</td>}
                                  {visibleColumns.daysInPeriod && <td className="px-4 py-4 text-xs font-bold text-slate-700 text-right">{row.daysInPeriod || '—'}</td>}
                                  {visibleColumns.effectiveAnnualRate && <td className="px-4 py-4 text-xs font-bold text-slate-700 text-right">{Number(row.effectiveAnnualRate || loan.interestRate).toFixed(2)}%</td>}
                                  {visibleColumns.closingBalance && <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(row.closingBalance, currencyCountry)}</td>}
                                </tr>
                              ))}
                            </tbody>
                            {monthlyRows.length > 0 && (
                              <tfoot className="bg-slate-50/70">
                                <tr>
                                  {visibleColumns.month && (
                                    <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                      Visible Totals
                                    </td>
                                  )}
                                  {visibleColumns.dueDate && <td />}
                                  {visibleColumns.openingBalance && <td />}
                                  {visibleColumns.interest && <td className="px-4 py-4 text-[11px] font-black text-rose-600 text-right">{formatCurrency(visibleTotals.interest, currencyCountry)}</td>}
                                  {visibleColumns.emi && <td className="px-4 py-4 text-[11px] font-black text-slate-800 text-right">{formatCurrency(visibleTotals.emi, currencyCountry)}</td>}
                                  {visibleColumns.principal && <td className="px-4 py-4 text-[11px] font-black text-emerald-600 text-right">{formatCurrency(visibleTotals.principal, currencyCountry)}</td>}
                                  {visibleColumns.extraPayment && <td className="px-4 py-4 text-[11px] font-black text-slate-700 text-right">{formatCurrency(visibleTotals.extra, currencyCountry)}</td>}
                                  {visibleColumns.daysInPeriod && <td />}
                                  {visibleColumns.effectiveAnnualRate && <td />}
                                  {visibleColumns.closingBalance && <td />}
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>

                        {tableMode === 'full' && (
                          <div className="px-6 sm:px-8 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Page {currentPage} of {totalPages}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSchedulePage(loan.id, Math.max(1, currentPage - 1))}
                                disabled={currentPage <= 1}
                                className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                              >
                                <ArrowLeft size={13} /> Prev
                              </button>
                              <button
                                onClick={() => setSchedulePage(loan.id, Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage >= totalPages}
                                className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                              >
                                Next <ArrowRight size={13} />
                              </button>
                            </div>
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
