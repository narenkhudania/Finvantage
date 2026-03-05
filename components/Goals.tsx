
import React, { useState, useMemo } from 'react';
import { 
  Target, Calendar, Plus, Trash2, Home, Car, GraduationCap, Heart, 
  Rocket, Coffee, Sparkles, ChevronRight, Zap, Plane, 
  Map, Building, Baby, Gift, Scroll, ListTree, Calculator, 
  ArrowLeft, RefreshCw, Hammer, ShoppingCart, Clock, CheckCircle2,
  TrendingUp, AlertCircle, ArrowUpRight, ArrowRight, Edit3, Eye,
  Info, DollarSign, User, Percent, LayoutGrid, Layers,
  BarChart3, Settings2
} from 'lucide-react';
import { Goal, GoalType, FinanceState, RelativeDate, RelativeDateType, ResourceBucket, ExpenseItem, LoanType } from '../types';
import { parseNumber } from '../lib/validation';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';
import { annualIncomeFromDetailed } from '../lib/incomeMath';

const GOAL_ICONS: Record<GoalType, any> = {
  'Retirement': Coffee,
  'Child Education': GraduationCap,
  'Child Marriage': Heart,
  'Vacation': Plane,
  'Vacation - Domestic': Plane,
  'Vacation - International': Plane,
  'Asset Purchase': Home,
  'Asset': Home,
  'Car': Car,
  'Land / Home': Home,
  'Commercial': Building,
  'Home Renovation': Hammer,
  'Holiday Home': Map,
  'Corpus for Start-up': Rocket,
  'Charity / Philanthropy': Gift,
  'Child-birth Expenses': Baby,
  'Big Purchases': ShoppingCart,
  'Estate for Children': Scroll,
  'Others': Target
};

const GOAL_TYPE_OPTIONS = (Object.keys(GOAL_ICONS) as GoalType[]).filter(
  type => type !== 'Vacation' && type !== 'Asset'
);

const RETIREMENT_EXPENSE_CATEGORIES = [
  'Food & Grocery',
  'House Rent / Maintenance / Repair',
  'Conveyance, Fuel & Maintenance',
  'Medicines / Doctor / Healthcare',
  'Electricity / Water / Labour / AMCs',
  'Mobile / Telephone / Internet',
  'Household Expenses',
  'Clothes & Accessories',
  'Shopping, Gifts, Whitegoods, Gadgets',
  'Dining / Movies / Sports',
  'Personal Care / Others',
  'Travel & Annual Vacations',
  'Lifestyle Expenses',
  "Children's Schooling/College Expenses",
  'Contribution to Parents, Siblings etc',
  'Dependent Expenses',
  'Life Insurance (Term)',
  'Mediclaim/PA/CI',
  'Motor Insurance',
  'Pure Insurance Premiums',
  'Home Loan EMIs',
  'Vehicle Loan EMIs',
  'Personal Loan EMIs',
  'Loan Servicing',
  'Net Outflows',
  'Savings (Inflows-Outflows)',
  'PPF',
  'Recurring Deposits (RDs)',
  'Insurance Premiums (Investments)',
  'Mutual Fund SIPs',
  'Regular Monthly Investments',
  'Surplus (Savings-Investments)',
];

const normalizeGoalIdentityText = (value?: string) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const Goals: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFamilyGoalMemberId, setSelectedFamilyGoalMemberId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  
  const currentYear = new Date().getFullYear();
  const birthYear = state.profile.dob ? new Date(state.profile.dob).getFullYear() : currentYear - 30;
  const currentLivingMonthly = useMemo(() => {
    const total = state.detailedExpenses.reduce((sum, e) => sum + e.amount, 0);
    return total > 0 ? total : state.profile.monthlyExpenses;
  }, [state.detailedExpenses, state.profile.monthlyExpenses]);
  const getDefaultTimelineDates = () => {
    const retirementAge = Number.isFinite(state.profile.retirementAge) && state.profile.retirementAge > 0
      ? state.profile.retirementAge
      : 60;
    const lifeExpectancy = Number.isFinite(state.profile.lifeExpectancy) && state.profile.lifeExpectancy > retirementAge
      ? state.profile.lifeExpectancy
      : retirementAge + 25;

    return {
      startDate: { type: 'Age' as RelativeDateType, value: retirementAge },
      endDate: { type: 'Age' as RelativeDateType, value: lifeExpectancy },
    };
  };

  const resolveYear = (rel: RelativeDate): number => {
    switch (rel.type) {
      case 'Year': return rel.value;
      case 'Age': return birthYear + rel.value;
      case 'Retirement': return birthYear + state.profile.retirementAge + rel.value;
      case 'LifeExpectancy': return birthYear + state.profile.lifeExpectancy + rel.value;
      default: return rel.value;
    }
  };

  const deriveSingleMilestoneYear = (goal: Partial<Goal>) => {
    if (goal.startDate) return resolveYear(goal.startDate);
    if (goal.endDate) return resolveYear(goal.endDate);
    return currentYear + 1;
  };

  const initialNewGoal: Partial<Goal> = {
    type: 'Retirement',
    description: '',
    priority: state.goals.length + 1,
    resourceBuckets: ['Equity & MF', 'Cashflow Surplus'],
    isRecurring: true,
    frequency: 'Yearly',
    frequencyIntervalYears: undefined,
    ...getDefaultTimelineDates(),
    targetAmountToday: 0,
    inflationRate: 6,
    currentAmount: 0,
    loan: { enabled: false },
    retirementHandling: 'CurrentExpenses',
  };

  const [newGoal, setNewGoal] = useState<Partial<Goal>>(initialNewGoal);

  const isRetirementGoal = newGoal.type === 'Retirement';
  const isChildEducationGoal = newGoal.type === 'Child Education';
  const isWeddingGoal = newGoal.type === 'Child Marriage';
  const isRecurringGoal = isRetirementGoal ? true : Boolean(newGoal.isRecurring);
  const singleMilestoneYear = deriveSingleMilestoneYear(newGoal);
  const needsFamilyMemberSelection = isChildEducationGoal || isWeddingGoal;
  const retirementMode = newGoal.retirementHandling ?? 'CurrentExpenses';
  const retirementRows = newGoal.detailedBreakdown ?? [];
  const goalFamilyMembers = state.family;
  const retirementMonthlyFromDetails = retirementRows.reduce((sum, row) => sum + parseNumber(row.amount || 0, 0), 0);
  const retirementMonthlyEstimate = parseNumber(newGoal.expectedMonthlyExpensesAfterRetirement || 0, 0);
  const retirementMonthlyTarget = retirementMode === 'CurrentExpenses'
    ? currentLivingMonthly
    : retirementMode === 'Detailed'
      ? retirementMonthlyFromDetails
      : retirementMonthlyEstimate;
  const retirementAnnualTarget = retirementMonthlyTarget * 12;

  const stepGuidance = useMemo(() => {
    if (step === 1) {
      return [
        'Select goal type and set a unique goal name/description.',
        'Set priority rank (1 = highest urgency).',
        'Choose recurring vs one-time and set frequency.',
      ];
    }
    if (step === 2) {
      return [
        'Select start and end timeline (or one year for one-time goals).',
        'Set realistic inflation rate (0% to 15%).',
        'Verify dates are in the correct sequence.',
      ];
    }
    if (isRetirementGoal) {
      return [
        'Choose retirement expense method (current, estimate, or detailed).',
        'Select at least one funding source bucket.',
        'Optional: enable loan bridge and provide loan details.',
      ];
    }
    return [
      'Enter target amount in today’s value.',
      'Select at least one funding source bucket.',
      'Optional: enable loan bridge and provide loan details.',
    ];
  }, [step, isRetirementGoal]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNewGoal({...initialNewGoal, priority: state.goals.length + 1});
    setSelectedFamilyGoalMemberId('');
    setStep(1);
    setShowAdd(true);
  };

  const handleEdit = (goal: Goal) => {
    const normalizedGoalType = goal.type === 'Vacation'
      ? 'Vacation - Domestic'
      : goal.type === 'Asset'
        ? 'Asset Purchase'
        : goal.type;
    setEditingId(goal.id);
    setNewGoal({
      ...goal,
      type: normalizedGoalType,
      isRecurring: goal.type === 'Retirement' ? true : goal.isRecurring,
      loan: goal.loan ?? { enabled: false },
    });
    if (goal.type === 'Child Marriage' || goal.type === 'Child Education') {
      const matchedMember = state.family.find(member => {
        const lowerDescription = (goal.description || '').trim().toLowerCase();
        const lowerName = member.name.trim().toLowerCase();
        return lowerDescription === lowerName
          || lowerDescription === `wedding - ${lowerName}`
          || lowerDescription === `education - ${lowerName}`;
      });
      setSelectedFamilyGoalMemberId(matchedMember?.id ?? '');
    } else {
      setSelectedFamilyGoalMemberId('');
    }
    setStep(1);
    setShowAdd(true);
  };

  const getMissionHandlePlaceholder = (goalType?: GoalType) => {
    switch (goalType) {
      case 'Car': return 'e.g. SUV Upgrade 2028';
      case 'Land / Home':
      case 'Home Renovation':
      case 'Holiday Home':
      case 'Commercial':
      case 'Asset':
      case 'Asset Purchase':
        return 'e.g. New Home in Bengaluru';
      case 'Vacation - Domestic':
        return 'e.g. Kerala Family Trip';
      case 'Vacation - International':
        return 'e.g. Europe Summer Tour';
      case 'Corpus for Start-up':
        return 'e.g. Startup Launch Corpus';
      case 'Charity / Philanthropy':
        return 'e.g. Education Trust Fund';
      case 'Big Purchases':
        return 'e.g. Premium Home Theatre';
      case 'Estate for Children':
        return 'e.g. Legacy Corpus Plan';
      case 'Others':
        return 'e.g. Mission Alpha 2030';
      default:
        return 'e.g. Goal Mission 2030';
    }
  };

  const getRecurringHint = (goalType?: GoalType) => {
    switch (goalType) {
      case 'Retirement':
        return 'Retirement is treated as a recurring annual need by default.';
      case 'Vacation - Domestic':
      case 'Vacation - International':
        return 'Mark true for repeat trips like annual holidays.';
      case 'Car':
        return 'Mark true if you plan periodic upgrades or replacements.';
      case 'Child Education':
        return 'Mark true for recurring fees like annual tuition or term payments.';
      case 'Child Marriage':
        return 'Usually one-time. Keep off unless planning multiple ceremonies/events.';
      case 'Asset Purchase':
      case 'Land / Home':
      case 'Commercial':
      case 'Holiday Home':
      case 'Home Renovation':
        return 'Usually one-time. Mark true only for phased or periodic purchases.';
      case 'Big Purchases':
        return 'Mark true for repeat purchases at planned intervals.';
      case 'Charity / Philanthropy':
        return 'Mark true for yearly donations or pledge programs.';
      default:
        return 'Mark true if this milestone repeats on a planned schedule.';
    }
  };

  const addRetirementRow = () => {
    const nextRows = [
      ...(newGoal.detailedBreakdown || []),
      {
        category: '',
        amount: 0,
        inflationRate: newGoal.inflationRate ?? 6,
        tenure: 0,
        frequency: 'Monthly',
      } as ExpenseItem,
    ];
    setNewGoal(prev => ({ ...prev, detailedBreakdown: nextRows }));
  };

  const updateRetirementRow = (index: number, patch: Partial<ExpenseItem>) => {
    const rows = [...(newGoal.detailedBreakdown || [])];
    rows[index] = { ...rows[index], ...patch };
    setNewGoal(prev => ({ ...prev, detailedBreakdown: rows }));
  };

  const removeRetirementRow = (index: number) => {
    const rows = [...(newGoal.detailedBreakdown || [])];
    rows.splice(index, 1);
    setNewGoal(prev => ({ ...prev, detailedBreakdown: rows }));
  };

  const computeEmi = (principal: number, annualRate: number, years: number) => {
    if (principal <= 0 || annualRate <= 0 || years <= 0) return 0;
    const monthlyRate = annualRate / 12 / 100;
    const months = years * 12;
    const factor = Math.pow(1 + monthlyRate, months);
    return Math.round((principal * monthlyRate * factor) / (factor - 1));
  };

  const annualize = (amount: number, frequency?: 'Monthly' | 'Quarterly' | 'Annually' | 'One time') => {
    if (!Number.isFinite(amount)) return 0;
    if (frequency === 'Quarterly') return amount * 4;
    if (frequency === 'Annually' || frequency === 'One time') return amount;
    return amount * 12;
  };

  const computeAutomatedCurrentAmount = (goalTargetToday: number, existingCurrentAmount: number, isEditing: boolean) => {
    if (isEditing) return Math.max(0, existingCurrentAmount);

    const incomeMembers = [
      state.profile.income,
      ...state.family
        .filter(member => member.includeIncomeInPlanning !== false)
        .map(member => member.income),
    ];
    const annualIncome = incomeMembers.reduce((sum, income) => {
      return sum + annualIncomeFromDetailed(income);
    }, 0);

    const annualExpenses = state.detailedExpenses.length > 0
      ? state.detailedExpenses.reduce((sum, item) => sum + annualize(item.amount || 0, item.frequency), 0)
      : (state.profile.monthlyExpenses || 0) * 12;

    const annualDebtServicing = state.loans.reduce((sum, loan) => sum + ((loan.emi || 0) * 12), 0);
    const annualCommitments = state.investmentCommitments.reduce((sum, commitment) => {
      return sum + annualize(commitment.amount || 0, commitment.frequency);
    }, 0);
    const annualSurplus = Math.max(0, annualIncome - annualExpenses - annualDebtServicing - annualCommitments);

    const currentYearValue = new Date().getFullYear();
    const sellableAssetsToday = state.assets
      .filter(asset => asset.availableForGoals && (asset.availableFrom == null || asset.availableFrom <= currentYearValue))
      .reduce((sum, asset) => sum + (asset.currentValue || 0), 0);

    const totalFundingCapacity = annualSurplus + sellableAssetsToday;
    const alreadyAllocated = state.goals.reduce((sum, goal) => sum + (goal.currentAmount || 0), 0);
    const availableForThisGoal = Math.max(0, totalFundingCapacity - alreadyAllocated);
    return Math.round(Math.min(goalTargetToday, availableForThisGoal));
  };

  const handleSave = () => {
    setFormError(null);
    setFormWarning(null);

    const description = (newGoal.description || '').trim();
    const selectedFamilyMember = goalFamilyMembers.find(member => member.id === selectedFamilyGoalMemberId);
    const effectiveDescription = isWeddingGoal
      ? `Wedding - ${selectedFamilyMember?.name ?? ''}`.trim()
      : isChildEducationGoal
        ? `Education - ${selectedFamilyMember?.name ?? ''}`.trim()
        : description;
    const targetAmount = parseNumber(newGoal.targetAmountToday || 0, 0);
    const existingCurrentAmount = parseNumber(newGoal.currentAmount || 0, 0);
    const inflationRate = parseNumber(newGoal.inflationRate || 0, 0);
    const resourceBuckets = newGoal.resourceBuckets || [];
    const isRecurring = newGoal.type === 'Retirement' ? true : Boolean(newGoal.isRecurring);
    const proposedFrequency = isRecurring ? (newGoal.frequency ?? 'Yearly') : 'One time';
    const proposedIntervalYears = proposedFrequency === 'Once in 10 years'
      ? 10
      : (proposedFrequency === 'Every 2–15 Years' || proposedFrequency === 'Every 2-15 Years')
        ? parseNumber(newGoal.frequencyIntervalYears ?? 0, 0)
        : 0;
    let startDate = newGoal.startDate;
    let endDate = newGoal.endDate;

    if (!isRecurring) {
      const singleYear = deriveSingleMilestoneYear(newGoal);
      startDate = { type: 'Year', value: singleYear };
      endDate = { type: 'Year', value: singleYear };
    }

    if (description.length < 2 && newGoal.type === 'Others') {
      setFormError('Description is required for custom goals.');
      return;
    }
    if (needsFamilyMemberSelection && !selectedFamilyMember) {
      setFormError(isChildEducationGoal ? 'Select a family member for the education goal.' : 'Select a family member for the wedding goal.');
      return;
    }
    if (newGoal.type !== 'Retirement' && targetAmount <= 0) {
      setFormError('Target amount must be greater than 0.');
      return;
    }
    if (inflationRate < 0 || inflationRate > 15) {
      setFormError('Inflation rate must be between 0% and 15%.');
      return;
    }
    if (!startDate || !endDate) {
      setFormError('Start and end dates are required.');
      return;
    }
    if ((startDate.type === 'Retirement' || startDate.type === 'LifeExpectancy') && (startDate.value < -5 || startDate.value > 5)) {
      setFormError('Retirement/Life Expectancy offsets must be between -5 and +5 years.');
      return;
    }
    if ((endDate.type === 'Retirement' || endDate.type === 'LifeExpectancy') && (endDate.value < -5 || endDate.value > 5)) {
      setFormError('Retirement/Life Expectancy offsets must be between -5 and +5 years.');
      return;
    }
    const startYear = resolveYear(startDate);
    const endYear = resolveYear(endDate);
    if (startYear > endYear) {
      setFormError('Start date must be before end date.');
      return;
    }
    if (isRecurring && !newGoal.frequency) {
      setFormError('Frequency is required for recurring goals.');
      return;
    }
    if (isRecurring && (newGoal.frequency === 'Every 2–15 Years' || newGoal.frequency === 'Every 2-15 Years')) {
      const intervalYears = parseNumber(newGoal.frequencyIntervalYears ?? 0, 0);
      if (intervalYears < 2 || intervalYears > 15) {
        setFormError('Recurring interval must be between 2 and 15 years.');
        return;
      }
    }
    const normalizedDescription = normalizeGoalIdentityText(
      effectiveDescription.length > 0 ? effectiveDescription : (newGoal.type || 'Goal')
    );
    const duplicateGoal = state.goals.find(goal => {
      if (editingId && goal.id === editingId) return false;
      const goalStartYear = resolveYear(goal.startDate);
      const goalEndYear = resolveYear(goal.endDate);
      const goalRecurring = goal.type === 'Retirement' ? true : Boolean(goal.isRecurring);
      const goalFrequency = goalRecurring ? (goal.frequency ?? 'Yearly') : 'One time';
      const goalIntervalYears = goalRecurring ? parseNumber(goal.frequencyIntervalYears ?? 0, 0) : 0;
      const goalDescription = normalizeGoalIdentityText(goal.description || goal.type);

      return (
        goal.type === newGoal.type &&
        goalDescription === normalizedDescription &&
        goalStartYear === startYear &&
        goalEndYear === endYear &&
        goalRecurring === isRecurring &&
        goalFrequency === proposedFrequency &&
        goalIntervalYears === proposedIntervalYears
      );
    });
    if (duplicateGoal) {
      setFormError('Duplicate goal detected. Change name, timeline, or frequency before saving.');
      return;
    }
    if (resourceBuckets.length === 0) {
      setFormError('Select at least one resource bucket.');
      return;
    }
    let effectiveTargetAmount = targetAmount;
    let expectedMonthlyExpensesAfterRetirement = newGoal.expectedMonthlyExpensesAfterRetirement;
    let retirementHandling = newGoal.retirementHandling;
    let detailedBreakdown = newGoal.detailedBreakdown;
    let frequencyIntervalYears = newGoal.frequencyIntervalYears;

    if (newGoal.type === 'Retirement') {
      if (!retirementHandling) retirementHandling = 'CurrentExpenses';
      if (retirementHandling === 'CurrentExpenses') {
        if (currentLivingMonthly <= 0) {
          setFormError('Current living expenses are required for retirement.');
          return;
        }
        expectedMonthlyExpensesAfterRetirement = currentLivingMonthly;
        effectiveTargetAmount = currentLivingMonthly * 12;
      }
      if (retirementHandling === 'Estimate') {
        const estimate = parseNumber(expectedMonthlyExpensesAfterRetirement || 0, 0);
        if (estimate <= 0) {
          setFormError('Estimated monthly retirement expense is required.');
          return;
        }
        expectedMonthlyExpensesAfterRetirement = estimate;
        effectiveTargetAmount = estimate * 12;
      }
      if (retirementHandling === 'Detailed') {
        const rows = (detailedBreakdown || []).filter(r => parseNumber(r.amount || 0, 0) > 0);
        if (rows.length === 0) {
          setFormError('Add at least one detailed retirement expense.');
          return;
        }
        const monthlyTotal = rows.reduce((sum, r) => sum + parseNumber(r.amount || 0, 0), 0);
        expectedMonthlyExpensesAfterRetirement = monthlyTotal;
        effectiveTargetAmount = monthlyTotal * 12;
      }
    }

    if (isRecurring) {
      if (newGoal.frequency === 'Once in 10 years') {
        frequencyIntervalYears = 10;
      } else if (newGoal.frequency?.toLowerCase().includes('every')) {
        frequencyIntervalYears = frequencyIntervalYears;
      } else {
        frequencyIntervalYears = undefined;
      }
    } else {
      frequencyIntervalYears = undefined;
    }

    const yearsToStart = Math.max(0, startYear - currentYear);
    const startGoalAmount = effectiveTargetAmount * Math.pow(1 + (inflationRate / 100), yearsToStart);
    const currentAmount = computeAutomatedCurrentAmount(effectiveTargetAmount, existingCurrentAmount, Boolean(editingId));

    const mapGoalLoanType = (goalType: GoalType): LoanType => {
      if (goalType === 'Car') return 'Car Loan';
      if (goalType === 'Land / Home' || goalType === 'Holiday Home' || goalType === 'Home Renovation' || goalType === 'Commercial') return 'Property Purchase';
      return 'Personal Loan';
    };

    let loan = newGoal.loan;
    let updatedLoans = state.loans;
    let loanNotice: string | null = null;
    if (loan?.enabled) {
      const loanPercent = parseNumber(loan.percent ?? 0, 0);
      const loanValueInput = parseNumber(loan.value ?? 0, 0);
      const loanValue = loanValueInput > 0 ? loanValueInput : (loanPercent > 0 ? (startGoalAmount * loanPercent) / 100 : 0);
      const roi = parseNumber(loan.roi ?? 0, 0);
      const tenure = parseNumber(loan.tenure ?? 0, 0);

      if (loanValue <= 0) {
        setFormError('Loan percent or value is required when loan is enabled.');
        return;
      }
      if (roi <= 0 || tenure <= 0) {
        setFormError('Loan ROI and tenure are required when loan is enabled.');
        return;
      }

      const emi = computeEmi(loanValue, roi, tenure);
      const percent = loanPercent > 0 ? loanPercent : (startGoalAmount > 0 ? (loanValue / startGoalAmount) * 100 : undefined);
      const loanId = loan.loanId;
      const loanRecord = {
        id: loanId || Math.random().toString(36).substr(2, 9),
        type: mapGoalLoanType(newGoal.type || 'Others'),
        owner: 'self',
        source: 'Goal Financing',
        sourceType: 'Bank',
        sanctionedAmount: Math.round(loanValue),
        outstandingAmount: Math.round(loanValue),
        interestRate: roi,
        remainingTenure: Math.round(tenure * 12),
        emi,
        startYear: startYear,
        notes: `Auto-created from goal: ${effectiveDescription || description || (newGoal.type || 'Goal')}`,
        lumpSumRepayments: [],
      };

      if (loanId && state.loans.some(l => l.id === loanId)) {
        updatedLoans = state.loans.map(l => l.id === loanId ? { ...l, ...loanRecord } : l);
        loanNotice = 'Loan record updated in Liabilities.';
      } else {
        updatedLoans = [...state.loans, loanRecord];
        loanNotice = 'Loan record created in Liabilities.';
      }

      loan = {
        enabled: true,
        loanId: loanRecord.id,
        percent: percent ? Number(percent.toFixed(2)) : undefined,
        value: Math.round(loanValue),
        tenure,
        roi,
        emi,
      };
    } else if (newGoal.loan?.loanId) {
      updatedLoans = state.loans.filter(l => l.id !== newGoal.loan?.loanId);
      loan = { enabled: false };
      loanNotice = 'Loan record removed from Liabilities.';
    }

    const sanitizedGoal = {
      ...newGoal,
      description: effectiveDescription.length > 0 ? effectiveDescription : (newGoal.type || 'Goal'),
      isRecurring,
      startDate,
      endDate,
      frequency: newGoal.frequency ?? (isRecurring ? 'Yearly' : undefined),
      targetAmountToday: Math.round(effectiveTargetAmount),
      startGoalAmount: Math.round(startGoalAmount),
      currentAmount: Math.max(0, currentAmount),
      inflationRate,
      loan,
      expectedMonthlyExpensesAfterRetirement,
      retirementHandling,
      detailedBreakdown,
      frequencyIntervalYears,
    } as Goal;

    if (editingId) {
      updateState({
        goals: state.goals.map(g => g.id === editingId ? { ...sanitizedGoal, id: editingId } as Goal : g),
        loans: updatedLoans,
      });
    } else {
      const goal = { ...sanitizedGoal, id: Math.random().toString(36).substr(2, 9) } as Goal;
      updateState({ goals: [...state.goals, goal], loans: updatedLoans });
    }
    setShowAdd(false);
    setEditingId(null);
    if (loanNotice) {
      setNotice(loanNotice);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const removeGoal = (id: string) => {
    updateState({ goals: state.goals.filter(g => g.id !== id) });
  };

  const RelativeDateInput = ({ label, value, onChange }: { label: string, value: RelativeDate, onChange: (v: RelativeDate) => void }) => {
    const types: RelativeDateType[] = ['Year', 'Age', 'Retirement', 'LifeExpectancy'];
    
    // Preset offsets for +/- 5 years requirement
    const presets = [-5, -2, 0, 2, 5];
    const clampOffset = (val: number, type: RelativeDateType) => {
      if (type === 'Retirement' || type === 'LifeExpectancy') {
        return Math.max(-5, Math.min(5, val));
      }
      return val;
    };

    return (
      <div className="space-y-4 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] hover:border-teal-300 transition-all shadow-sm">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1 text-left">{label}</label>
        <div className="space-y-4">
          <div className="flex p-1 bg-slate-200/50 rounded-2xl overflow-x-auto no-scrollbar gap-1">
            {types.map(t => (
              <button 
                key={t} 
                type="button" 
                onClick={() => onChange({ ...value, type: t, value: clampOffset(value.value, t) })} 
                className={`flex-1 min-w-[80px] py-2.5 text-[9px] font-black uppercase tracking-tight rounded-xl transition-all ${value.type === t ? 'bg-white text-teal-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t}
              </button>
            ))}
          </div>
          
          {(value.type === 'Retirement' || value.type === 'LifeExpectancy') && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {presets.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange({ ...value, value: p })}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black border transition-all ${value.value === p ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-400 border-slate-100'}`}
                >
                  {p === 0 ? 'Exact' : (p > 0 ? `+${p}y` : `${p}y`)}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
             <input 
               type="number" 
               value={value.value} 
               onChange={(e) => {
                 const nextVal = parseInt(e.target.value) || 0;
                 onChange({ ...value, value: clampOffset(nextVal, value.type) });
               }} 
               className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-2xl font-black outline-none focus:ring-4 focus:ring-teal-600/5 focus:border-teal-600 shadow-sm" 
               placeholder="n" 
             />
             <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-[9px] uppercase tracking-widest pointer-events-none">
               {value.type === 'Year' ? 'Year Value' : 'Value/Offset'}
             </div>
          </div>
        </div>
      </div>
    );
  };

  const currencyCountry = state.profile.country;
  const currencySymbol = getCurrencySymbol(currencyCountry);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-24">
      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest">
          {notice}
        </div>
      )}
      {/* Strategic Header */}
      <div className="surface-dark p-12 md:p-20 rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-600/10 blur-[150px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <Target size={14}/> Goal Intelligence
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">Strategic <br/><span className="text-teal-500">Missions.</span></h2>
            <p className="text-slate-400 text-lg font-medium max-w-lg leading-relaxed">
              Consolidated life targets for <span className="text-white font-bold">{state.profile.firstName || 'User'}</span> with actuarial precision.
            </p>
          </div>
          <button 
            onClick={() => (showAdd ? setShowAdd(false) : handleOpenAdd())}
            className="px-12 py-8 bg-teal-600 hover:bg-teal-50 text-white hover:text-teal-600 rounded-[2.5rem] transition-all flex items-center gap-4 font-black uppercase text-sm tracking-[0.25em] shadow-2xl active:scale-95 shrink-0"
          >
            <Plus size={22} /> {showAdd ? 'Close Form' : 'New Milestone'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-[2.5rem] md:rounded-[5rem] w-full shadow-2xl ring-1 ring-slate-200/70 overflow-hidden animate-in slide-in-from-top-3 duration-300 border border-white/20">
          <div className="p-6 sm:p-10 md:p-12 border-b border-slate-50 flex justify-between items-center bg-white/90 gap-4">
             <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-teal-200 transition-all shrink-0"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="text-left min-w-0">
                   <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">{editingId ? 'Mission Calibration' : 'Mission Configurator'}</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Step {step} of 3</p>
                </div>
             </div>
             <button onClick={() => setShowAdd(false)} className="p-4 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 rounded-3xl text-slate-400 transition-all shrink-0"><Plus size={32} className="rotate-45" /></button>
          </div>

          <div className="p-6 sm:p-10 md:p-12 space-y-12 bg-white/70">
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
             <div className="p-4 sm:p-6 rounded-[1.5rem] border border-teal-100 bg-teal-50/50 space-y-3 text-left">
               <div className="flex items-center justify-between gap-3">
                 <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest flex items-center gap-2">
                   <Info size={14} /> Input Checklist
                 </p>
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Step {step}/3</span>
               </div>
               <div className="w-full h-1.5 bg-teal-100 rounded-full overflow-hidden">
                 <div className="h-full bg-teal-600 transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                 {stepGuidance.map((item) => (
                   <div key={item} className="rounded-xl bg-white border border-teal-100 px-3 py-2 text-[11px] font-semibold text-slate-700 flex items-start gap-2">
                     <CheckCircle2 size={13} className="text-teal-600 mt-0.5 shrink-0" />
                     <span>{item}</span>
                   </div>
                 ))}
               </div>
             </div>
             {step === 1 && (
               <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     <div className="space-y-4 text-left">
                        <label className="text-[12px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={18} className="text-teal-600"/> Goal Topology</label>
                        <select
                          value={newGoal.type}
                          onChange={e => {
                            const nextType = e.target.value as GoalType;
                            if (nextType === 'Retirement') {
                              setNewGoal(prev => ({
                                ...prev,
                                type: nextType,
                                isRecurring: true,
                                frequency: 'Yearly',
                                ...getDefaultTimelineDates(),
                                retirementHandling: prev.retirementHandling ?? 'CurrentExpenses',
                              }));
                              return;
                            }
                            setNewGoal(prev => ({ ...prev, type: nextType }));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-[2rem] px-8 py-6 text-xl font-black outline-none focus:ring-8 focus:ring-teal-600/5 focus:border-teal-600 shadow-sm"
                        >
                           {GOAL_TYPE_OPTIONS.map(type => <option key={type}>{type}</option>)}
                        </select>
                     </div>
                     <div className="space-y-4 text-left">
                        <label className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Priority Rank</label>
                        <div className="relative">
                          <input type="number" min="1" max="20" value={newGoal.priority} onChange={e => setNewGoal({...newGoal, priority: parseInt(e.target.value)})} className="w-full bg-white border border-slate-200 rounded-[2rem] px-8 py-5 text-4xl font-black outline-none focus:ring-8 focus:ring-teal-600/5 shadow-sm" />
                          <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-xs uppercase tracking-widest">Rank</div>
                        </div>
                     </div>
                  </div>

                  {!isRetirementGoal && !needsFamilyMemberSelection && (
                    <div className="space-y-4 text-left">
                       <label className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Mission Handle</label>
                       <input
                         type="text"
                         value={newGoal.description}
                         onChange={e => setNewGoal({...newGoal, description: e.target.value})}
                         className="w-full bg-white border border-slate-200 rounded-[2.5rem] px-10 py-7 text-2xl font-black outline-none focus:ring-8 focus:ring-teal-600/5 shadow-sm"
                         placeholder={getMissionHandlePlaceholder(newGoal.type)}
                       />
                    </div>
                  )}

                  {needsFamilyMemberSelection && (
                    <div className="space-y-4 text-left">
                       <label className="text-[12px] font-black text-slate-900 uppercase tracking-widest">
                         {isChildEducationGoal ? 'Family Member (Child Education)' : 'Family Member (Wedding)'}
                       </label>
                       <select
                         value={selectedFamilyGoalMemberId}
                         onChange={e => setSelectedFamilyGoalMemberId(e.target.value)}
                         className="w-full bg-white border border-slate-200 rounded-[2rem] px-8 py-6 text-xl font-black outline-none focus:ring-8 focus:ring-teal-600/5 focus:border-teal-600 shadow-sm"
                       >
                         <option value="">Select family member</option>
                         {goalFamilyMembers.map(member => (
                           <option key={member.id} value={member.id}>{member.name} ({member.relation})</option>
                         ))}
                       </select>
                       {selectedFamilyGoalMemberId && (
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           Mission handle: {isChildEducationGoal ? 'Education' : 'Wedding'} - {goalFamilyMembers.find(member => member.id === selectedFamilyGoalMemberId)?.name}
                         </p>
                       )}
                       {goalFamilyMembers.length === 0 && (
                         <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                           Add a family member first in Family section.
                         </p>
                       )}
                    </div>
                  )}

                  <div className="p-8 bg-white rounded-[3rem] border border-slate-200 space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="text-left space-y-1">
                           <h4 className="text-xl font-black text-slate-900 italic">Is this a Recurring Milestone?</h4>
                           <p className="text-xs font-medium text-slate-400">{getRecurringHint(newGoal.type)}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (isRetirementGoal) return;
                            setNewGoal(prev => {
                              const nextRecurring = !Boolean(prev.isRecurring);
                              if (!nextRecurring) {
                                const year = deriveSingleMilestoneYear(prev);
                                return {
                                  ...prev,
                                  isRecurring: false,
                                  frequency: undefined,
                                  frequencyIntervalYears: undefined,
                                  startDate: { type: 'Year', value: year },
                                  endDate: { type: 'Year', value: year },
                                };
                              }
                              return {
                                ...prev,
                                isRecurring: true,
                                frequency: prev.frequency ?? 'Yearly',
                              };
                            });
                          }}
                          className={`w-20 h-10 rounded-full transition-all relative ${isRecurringGoal ? 'bg-teal-600' : 'bg-slate-200'} ${isRetirementGoal ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                           <div className={`absolute top-1 w-8 h-8 rounded-full bg-white transition-all shadow-md ${isRecurringGoal ? 'left-11' : 'left-1'}`} />
                        </button>
                     </div>
                     {isRecurringGoal && (
                        isRetirementGoal ? (
                          <div className="p-4 bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100">
                            Retirement expenses are modeled annually by default.
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in slide-in-from-top-4 text-left">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Milestone Frequency Strategy</label>
                             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {['Monthly', 'Yearly', 'Every 2–15 Years', 'Once in 10 years'].map(f => (
                                  <button
                                    key={f}
                                    type="button"
                                    onClick={() => {
                                      const next: Partial<Goal> = { ...newGoal, frequency: f as any };
                                      if (f === 'Once in 10 years') {
                                        next.frequencyIntervalYears = 10;
                                      } else if (f === 'Every 2–15 Years' || f === 'Every 2-15 Years') {
                                        next.frequencyIntervalYears = newGoal.frequencyIntervalYears ?? 5;
                                      } else {
                                        next.frequencyIntervalYears = undefined;
                                      }
                                      setNewGoal(next);
                                    }}
                                    className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-tight border transition-all ${newGoal.frequency === f ? 'bg-teal-600 text-white border-teal-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-teal-200'}`}
                                  >
                                    {f}
                                  </button>
                                ))}
                             </div>
                             {(newGoal.frequency === 'Every 2–15 Years' || newGoal.frequency === 'Every 2-15 Years') && (
                               <div className="mt-4">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Interval (Years)</label>
                                 <div className="flex items-center gap-3">
                                   <input
                                     type="number"
                                     min={2}
                                     max={15}
                                     value={newGoal.frequencyIntervalYears ?? ''}
                                     onChange={e => setNewGoal(prev => ({ ...prev, frequencyIntervalYears: parseInt(e.target.value) || 0 }))}
                                     className="w-32 bg-white border border-slate-200 rounded-2xl px-4 py-3 font-black outline-none"
                                   />
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2 to 15 years</span>
                                 </div>
                               </div>
                             )}
                          </div>
                        )
                     )}
                  </div>
                  
                  <button onClick={() => setStep(2)} className="w-full py-8 bg-slate-900 text-white rounded-[3rem] font-black uppercase tracking-[0.3em] hover:bg-teal-600 transition-all flex items-center justify-center gap-4 shadow-xl">Temporal Alignment <ChevronRight size={20}/></button>
               </div>
             )}

             {step === 2 && (
               <div className="space-y-12 animate-in fade-in duration-500">
                  {isRecurringGoal ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <RelativeDateInput label="Temporal Origin (Start)" value={newGoal.startDate!} onChange={v => setNewGoal({...newGoal, startDate: v})} />
                      <RelativeDateInput label="Milestone Horizon (End)" value={newGoal.endDate!} onChange={v => setNewGoal({...newGoal, endDate: v})} />
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-[2rem] space-y-4 text-left">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Goal Year (Single Milestone)</label>
                      <input
                        type="number"
                        value={singleMilestoneYear}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          const year = Number.isFinite(parsed) ? parsed : currentYear + 1;
                          setNewGoal(prev => ({
                            ...prev,
                            startDate: { type: 'Year', value: year },
                            endDate: { type: 'Year', value: year },
                          }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-2xl font-black outline-none focus:ring-4 focus:ring-teal-600/5 focus:border-teal-600 shadow-sm"
                        placeholder="e.g. 2032"
                      />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Non-recurring goals use one execution year only.
                      </p>
                    </div>
                  )}
                  
                  <div className="p-8 bg-teal-600 rounded-[3rem] text-white flex flex-col sm:flex-row items-center justify-between gap-6">
                     <div className="text-left space-y-1 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Inflation Index</p>
                        <p className="text-xs font-bold leading-relaxed">Standard India rate for life missions is 6%. Adjust based on category inflation.</p>
                     </div>
                     <div className="flex items-center gap-6 shrink-0">
                        <input type="range" min="0" max="15" step="0.5" value={newGoal.inflationRate} onChange={e => setNewGoal({...newGoal, inflationRate: parseFloat(e.target.value)})} className="w-48 h-1.5 bg-teal-400 rounded-full appearance-none accent-white" />
                        <span className="text-4xl font-black min-w-[70px]">{newGoal.inflationRate}%</span>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-full py-6 bg-white border border-slate-200 text-slate-700 rounded-[2rem] font-black uppercase tracking-[0.2em] hover:border-teal-200 hover:text-teal-700 transition-all flex items-center justify-center gap-3"
                    >
                      <ArrowLeft size={16}/> Back
                    </button>
                    <button onClick={() => setStep(3)} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-teal-600 transition-all flex items-center justify-center gap-3 shadow-xl">Actuarial Calibration <ChevronRight size={18}/></button>
                  </div>
               </div>
             )}

             {step === 3 && (
               <div className="space-y-12 animate-in fade-in duration-500">
                  {isRetirementGoal && (
                    <div className="space-y-6 p-10 bg-white rounded-[3.5rem] border border-slate-200 shadow-sm text-left">
                      <div className="flex items-center justify-between gap-6">
                        <div>
                          <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Use Current Living Expenses for Retirement?</p>
                          <p className="text-xs font-medium text-slate-400">Toggle off to provide an estimate or a detailed breakdown.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewGoal(prev => ({
                            ...prev,
                            retirementHandling: retirementMode === 'CurrentExpenses' ? 'Estimate' : 'CurrentExpenses'
                          }))}
                          className={`w-20 h-10 rounded-full transition-all relative ${retirementMode === 'CurrentExpenses' ? 'bg-teal-600' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 w-8 h-8 rounded-full bg-white transition-all shadow-md ${retirementMode === 'CurrentExpenses' ? 'left-11' : 'left-1'}`} />
                        </button>
                      </div>

                      {retirementMode === 'CurrentExpenses' && (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Monthly Living</p>
                            <p className="text-xl font-black text-slate-900">{formatCurrency(currentLivingMonthly, currencyCountry)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Annual Retirement Need (Today)</p>
                            <p className="text-xl font-black text-emerald-600">{formatCurrency(Math.round(currentLivingMonthly * 12), currencyCountry)}</p>
                          </div>
                        </div>
                      )}

                      {retirementMode !== 'CurrentExpenses' && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-3">
                            {['Estimate', 'Detailed'].map(mode => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setNewGoal(prev => ({ ...prev, retirementHandling: mode as any }))}
                                className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-tight border transition-all ${retirementMode === mode ? 'bg-teal-600 text-white border-teal-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-teal-200'}`}
                              >
                                {mode === 'Estimate' ? 'Set Estimate' : 'Detailed Breakdown'}
                              </button>
                            ))}
                          </div>

                          {retirementMode === 'Estimate' && (
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimated Monthly Expense (Today)</label>
                              <input
                                type="number"
                                value={newGoal.expectedMonthlyExpensesAfterRetirement ?? ''}
                                onChange={e => setNewGoal(prev => ({ ...prev, expectedMonthlyExpensesAfterRetirement: parseFloat(e.target.value) }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none"
                                placeholder={`${currencySymbol} 0`}
                              />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Annual: {formatCurrency(Math.round(retirementAnnualTarget), currencyCountry)}</p>
                            </div>
                          )}

                          {retirementMode === 'Detailed' && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detailed Expense Breakup</p>
                                  <p className="text-xs font-medium text-slate-400">Add multiple expense lines with optional date range.</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={addRetirementRow}
                                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest"
                                >
                                  + Add Expense
                                </button>
                              </div>
                              {retirementRows.length === 0 ? (
                                <div className="p-4 bg-slate-50 rounded-2xl text-[10px] font-bold text-slate-400">No expense lines added yet.</div>
                              ) : (
                                retirementRows.map((row, index) => (
                                  <div key={`retirement-row-${index}`} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="md:col-span-2 space-y-1">
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                                      <input
                                        list="retirement-categories"
                                        value={row.category}
                                        onChange={e => updateRetirementRow(index, { category: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none"
                                        placeholder="Select or type"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monthly Amount</label>
                                      <input
                                        type="number"
                                        value={row.amount ?? ''}
                                        onChange={e => updateRetirementRow(index, { amount: parseFloat(e.target.value) })}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Year</label>
                                      <input
                                        type="number"
                                        value={row.startYear ?? ''}
                                        onChange={e => updateRetirementRow(index, { startYear: parseInt(e.target.value) || undefined })}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 font-bold outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End Year</label>
                                      <div className="flex gap-2 items-center">
                                        <input
                                          type="number"
                                          value={row.endYear ?? ''}
                                          onChange={e => updateRetirementRow(index, { endYear: parseInt(e.target.value) || undefined })}
                                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 font-bold outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeRetirementRow(index)}
                                          className="p-3 bg-rose-50 text-rose-500 rounded-xl"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                              <datalist id="retirement-categories">
                                {RETIREMENT_EXPENSE_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat} />
                                ))}
                              </datalist>
                              <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                <span className="text-slate-400">Monthly Total</span>
                                <span className="text-slate-900">{formatCurrency(Math.round(retirementMonthlyFromDetails), currencyCountry)}</span>
                                <span className="text-slate-400">Annual</span>
                                <span className="text-emerald-600">{formatCurrency(Math.round(retirementAnnualTarget), currencyCountry)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {isRetirementGoal ? (
                    <div className="surface-dark p-16 rounded-[4rem] text-white space-y-10 relative overflow-hidden shadow-2xl">
                      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/10 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2" />
                      <div className="relative z-10 text-left space-y-2">
                        <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.3em]">Annual Retirement Requirement (Today)</p>
                        <div className="text-4xl md:text-7xl font-black text-teal-500">
                          {formatCurrency(Math.round(retirementAnnualTarget || 0), currencyCountry)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="surface-dark p-16 rounded-[4rem] text-white space-y-10 relative overflow-hidden shadow-2xl">
                       <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/10 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2" />
                       <div className="relative z-10 text-left">
                          <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Capital Requirement (Today's Cost)</p>
                          <div className="flex items-center gap-6">
                             <span className="text-4xl md:text-7xl font-black tracking-tighter text-teal-500">{currencySymbol}</span>
                             <input 
                                type="number" 
                                value={newGoal.targetAmountToday || ''} 
                                onChange={e => setNewGoal({...newGoal, targetAmountToday: parseFloat(e.target.value)})} 
                                className="w-full bg-transparent text-4xl md:text-7xl font-black outline-none focus:text-teal-400 placeholder:text-white/10" 
                                placeholder="0.00"
                             />
                          </div>
                       </div>
                    </div>
                  )}

                  <div className="space-y-6 p-10 bg-white rounded-[3.5rem] border border-slate-200 shadow-sm text-left">
                     <div className="flex items-center justify-between gap-6">
                        <div>
                           <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Loan Bridge</p>
                           <p className="text-xs font-medium text-slate-400">Enable if part of the goal will be funded via a loan.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewGoal(prev => ({ ...prev, loan: { ...(prev.loan || { enabled: false }), enabled: !prev.loan?.enabled } }))}
                          className={`w-20 h-10 rounded-full transition-all relative ${newGoal.loan?.enabled ? 'bg-teal-600' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 w-8 h-8 rounded-full bg-white transition-all shadow-md ${newGoal.loan?.enabled ? 'left-11' : 'left-1'}`} />
                        </button>
                     </div>

                     {newGoal.loan?.enabled && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loan % of Goal</label>
                           <input
                             type="number"
                             value={newGoal.loan?.percent ?? ''}
                             onChange={e => setNewGoal(prev => ({ ...prev, loan: { ...(prev.loan || { enabled: true }), percent: parseFloat(e.target.value) } }))}
                             className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none"
                             placeholder="e.g. 55"
                           />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loan Value</label>
                           <input
                             type="number"
                             value={newGoal.loan?.value ?? ''}
                             onChange={e => setNewGoal(prev => ({ ...prev, loan: { ...(prev.loan || { enabled: true }), value: parseFloat(e.target.value) } }))}
                             className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none"
                             placeholder={`${currencySymbol} 0`}
                           />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tenure (Years)</label>
                           <input
                             type="number"
                             value={newGoal.loan?.tenure ?? ''}
                             onChange={e => setNewGoal(prev => ({ ...prev, loan: { ...(prev.loan || { enabled: true }), tenure: parseFloat(e.target.value) } }))}
                             className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none"
                           />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ROI (%)</label>
                           <input
                             type="number"
                             value={newGoal.loan?.roi ?? ''}
                             onChange={e => setNewGoal(prev => ({ ...prev, loan: { ...(prev.loan || { enabled: true }), roi: parseFloat(e.target.value) } }))}
                             className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none"
                           />
                         </div>
                         <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimated EMI</p>
                           <p className="text-lg font-black text-slate-900">
                             {formatCurrency(
                               computeEmi(
                                 Number(newGoal.loan?.value || 0),
                                 Number(newGoal.loan?.roi || 0),
                                 Number(newGoal.loan?.tenure || 0)
                               ),
                               currencyCountry
                             )}
                           </p>
                         </div>
                       </div>
                     )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="w-full py-6 bg-white border border-slate-200 text-slate-700 rounded-[2rem] font-black uppercase tracking-[0.2em] hover:border-teal-200 hover:text-teal-700 transition-all flex items-center justify-center gap-3"
                    >
                      <ArrowLeft size={16}/> Back
                    </button>
                    <button onClick={handleSave} className="w-full py-6 bg-teal-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-teal-500 transition-all shadow-2xl flex items-center justify-center gap-3">
                       {editingId ? 'Update Mission' : 'Deploy Mission'} <Rocket size={20}/>
                    </button>
                  </div>
               </div>
             )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {state.goals.length === 0 ? (
          <div className="lg:col-span-2 py-32 bg-white rounded-[5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-6 opacity-60">
             <div className="p-8 bg-slate-50 rounded-[3rem] text-slate-300 shadow-inner"><Target size={64} /></div>
             <div><h4 className="font-black text-slate-900 uppercase text-sm tracking-widest">No Active Missions</h4><p className="text-slate-400 font-medium">Define your goals to enable wealth trajectory tracking.</p></div>
          </div>
        ) : (
          state.goals.sort((a,b) => a.priority - b.priority).map((goal) => {
            const Icon = GOAL_ICONS[goal.type] || Target;
            const startYear = resolveYear(goal.startDate);
            const yearsToStart = Math.max(0, startYear - currentYear);
            
            // Calc Inflation Adjusted Target (Start Year)
            const targetFV = goal.targetAmountToday * Math.pow(1 + (goal.inflationRate / 100), yearsToStart);
            const startGoalAmount = goal.startGoalAmount ?? targetFV;
            const progressPct = startGoalAmount > 0 ? Math.min(100, (goal.currentAmount / startGoalAmount) * 100) : 0;

            return (
              <div key={goal.id} className="bg-white p-10 md:p-12 rounded-[4.5rem] border border-slate-200 shadow-sm hover:border-teal-400 transition-all flex flex-col gap-8 relative overflow-hidden group">
                 <div className="flex gap-8 items-start mt-4 text-left">
                    <div className={`w-20 h-20 bg-slate-50 text-teal-600 rounded-[2rem] flex items-center justify-center shrink-0 shadow-sm group-hover:bg-teal-600 group-hover:text-white transition-all`}>
                       <Icon size={32}/>
                    </div>
                    <div className="flex-1 space-y-2">
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest px-3 py-1 bg-teal-50 rounded-full">{goal.type}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority Rank #{goal.priority}</span>
                       </div>
                       <h4 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{goal.description || goal.type}</h4>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Horizon: {startYear} ({yearsToStart}y remaining)</p>
                    </div>
                 </div>

                 {/* Progress Bar with Projections */}
                 <div className="space-y-4">
                    <div className="flex justify-between items-end">
                       <div className="text-left">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Funding Pct (FV)</p>
                          <h5 className="text-2xl font-black text-slate-900">{progressPct.toFixed(1)}%</h5>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">Start Goal Amount</p>
                          <h5 className="text-lg font-black text-teal-600">{formatCurrency(Math.round(startGoalAmount), currencyCountry)}</h5>
                       </div>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                       <div className="h-full bg-teal-600 transition-all duration-1000 ease-out" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                       <span>Saved: {formatCurrency(goal.currentAmount, currencyCountry)}</span>
                       <span>Today's Value: {formatCurrency(goal.targetAmountToday, currencyCountry)}</span>
                    </div>
                    {goal.loan?.enabled && (
                      <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span>Loan EMI: {formatCurrency(goal.loan.emi || 0, currencyCountry)}</span>
                        <span>Loan %: {goal.loan.percent ? `${goal.loan.percent}%` : '—'}</span>
                      </div>
                    )}
                 </div>

                 <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-slate-50">
                    <button onClick={() => handleEdit(goal)} className="p-4 bg-teal-50 text-teal-600 rounded-2xl hover:bg-teal-600 hover:text-white transition-all shadow-sm flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
                       <Edit3 size={16}/> Edit Calibration
                    </button>
                    <button onClick={() => removeGoal(goal.id)} className="p-4 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                       <Trash2 size={16}/>
                    </button>
                 </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default Goals;
