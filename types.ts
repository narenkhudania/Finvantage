
export type TransactionType = 'income' | 'expense';
export type IncomeSource = 'salaried' | 'business';
export type AssetType = 'Liquid' | 'Debt' | 'Equity' | 'Real Estate' | 'Personal' | 'Gold/Silver';
export type Relation = 'Spouse' | 'Child' | 'Parent' | 'Other';
export type InsuranceCategory = 'Life Insurance' | 'General Insurance';
export type InsuranceType = 'Term' | 'Endowment' | 'Money Back' | 'ULIP' | 'Annuity' | 'Health' | 'Critical Illness' | 'Personal Accident' | 'Home' | 'Car' | 'Others';
export type CashflowFrequency = 'Monthly' | 'Quarterly' | 'Annually' | 'One time';
export type InvestmentFrequency = 'Monthly' | 'Quarterly' | 'Annually' | 'One time';

export interface Notification {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: 'critical' | 'strategy' | 'success';
  read: boolean;
}

export type LoanSourceType = 'Bank' | 'NBFC' | 'Friends & Family';
export type LoanType = 'Home Loan' | 'Personal Loan' | 'Credit Card EMI' | 'OD' | 'Car Loan' | 'Property Purchase' | 'Others';
export type RiskLevel = 'Conservative' | 'Moderate' | 'Balanced' | 'Aggressive' | 'Very Aggressive';

export type GoalType = 
  | 'Retirement' 
  | 'Child Education' 
  | 'Child Marriage' 
  | 'Vacation' 
  | 'Car' 
  | 'Land / Home' 
  | 'Commercial' 
  | 'Home Renovation' 
  | 'Holiday Home' 
  | 'Corpus for Start-up' 
  | 'Charity / Philanthropy' 
  | 'Child-birth Expenses' 
  | 'Big Purchases' 
  | 'Estate for Children' 
  | 'Others';

export type ResourceBucket = 'Equity & MF' | 'Bank Balance' | 'NPS & EPF' | 'Cashflow Surplus' | 'Insurance Payouts';

export interface RiskProfile {
  score: number;
  level: RiskLevel;
  lastUpdated: string;
  recommendedAllocation: {
    equity: number;
    debt: number;
    gold: number;
    liquid: number;
  };
}

export interface DetailedIncome {
  salary: number;
  bonus: number;
  reimbursements: number;
  business: number;
  rental: number;
  investment: number;
  expectedIncrease: number;
}

export interface ExpenseItem {
  category: string;
  amount: number;
  inflationRate: number;
  tenure: number;
  startYear?: number;
  endYear?: number;
  frequency?: CashflowFrequency;
  notes?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: Relation;
  age: number;
  isDependent: boolean;
  retirementAge?: number;
  income: DetailedIncome;
  monthlyExpenses: number;
}

export interface Asset {
  id: string;
  category: AssetType;
  subCategory: string;
  name: string;
  owner: string;
  currentValue: number;
  purchaseYear: number;
  growthRate: number;
  availableForGoals: boolean;
  availableFrom?: number;
  tenure?: number;
  monthlyContribution?: number;
  contributionFrequency?: InvestmentFrequency;
  contributionStepUp?: number;
  contributionStartYear?: number;
  contributionEndYear?: number;
}

export interface Loan {
  id: string;
  type: LoanType;
  owner: string;
  source: string; 
  sourceType: LoanSourceType;
  sanctionedAmount: number;
  outstandingAmount: number;
  interestRate: number;
  remainingTenure: number; 
  emi: number;
  notes?: string;
  startYear?: number;
  lumpSumRepayments: { year: number; amount: number }[];
}

export type RelativeDateType = 'Year' | 'Age' | 'Retirement' | 'LifeExpectancy';

export interface RelativeDate {
  type: RelativeDateType;
  value: number; 
}

export interface GoalLoan {
  enabled: boolean;
  loanId?: string;
  percent?: number;
  value?: number;
  tenure?: number;
  roi?: number;
  emi?: number;
}

export interface Goal {
  id: string;
  type: GoalType;
  description: string;
  priority: number;
  resourceBuckets: ResourceBucket[];
  isRecurring: boolean;
  frequency?: 'Monthly' | 'Yearly' | 'Every 2-5 Years' | 'Every 5-10 Years' | 'Every 2-15 Years' | 'Once in 10 years';
  startDate: RelativeDate;
  endDate: RelativeDate;
  targetAmountToday: number;
  startGoalAmount?: number;
  inflationRate: number;
  currentAmount: number;
  loan?: GoalLoan;
  desiredRetirementAge?: number;
  expectedMonthlyExpensesAfterRetirement?: number;
  retirementHandling?: 'CurrentExpenses' | 'Estimate' | 'Detailed';
  detailedBreakdown?: ExpenseItem[];
}

export interface InsuranceAnalysisConfig {
  inflation: number;
  investmentRate: number;
  replacementYears: number;
  immediateNeeds: number;
  financialAssetDiscount: number;
}

export interface AllocationBreakdown {
  equity: number;
  debt: number;
  gold: number;
  liquid: number;
}

export interface ReportValueItem {
  label: string;
  value: number;
}

export interface ReportSnapshot {
  generatedAt: string;
  asOf: string;
  currency: string;
  intro: {
    completionPct: number;
    memberCount: number;
    goalCount: number;
    assetCount: number;
    liabilityCount: number;
  };
  executiveSummary: {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
    monthlySurplus: number;
    savingsRatePct: number;
    dtiPct: number;
    riskLevel?: RiskLevel;
  };
  statementOfPosition: {
    investments: ReportValueItem[];
    otherAssets: ReportValueItem[];
    liabilities: ReportValueItem[];
    totals: {
      investments: number;
      otherAssets: number;
      assets: number;
      liabilities: number;
      netWorth: number;
      debtToAssets: number;
    };
    majorAssets: string[];
    majorLiabilities: string[];
  };
  cashFlow: {
    monthly: {
      income: number;
      expenses: number;
      debt: number;
      surplus: number;
    };
    annual: {
      income: number;
      expenses: number;
      debt: number;
      surplus: number;
    };
  };
  goals: {
    totalGoals: number;
    fundedCount: number;
    totalTargetToday: number;
    totalCurrent: number;
    nextGoal?: {
      label: string;
      year?: number;
      amount?: number;
    };
  };
  riskProfile: {
    score: number;
    level?: RiskLevel;
    recommendedAllocation: AllocationBreakdown;
    currentAllocation: AllocationBreakdown;
  };
  assumptions: {
    inflation: number;
    investmentRate: number;
    expectedIncomeGrowth: number;
    retirementAge: number;
    lifeExpectancy: number;
    returnAssumption: number;
  };
}

export interface FinanceState {
  isRegistered: boolean;
  onboardingStep: number;
  profile: {
    firstName: string;
    lastName: string;
    dob: string;
    mobile: string;
    email: string;
    lifeExpectancy: number;
    retirementAge: number;
    pincode: string;
    city: string;
    state: string;
    country: string;
    incomeSource: IncomeSource;
    income: DetailedIncome;
    monthlyExpenses: number;
    iqScore?: number;
  };
  riskProfile?: RiskProfile;
  family: FamilyMember[];
  detailedExpenses: ExpenseItem[];
  cashflows: CashflowItem[];
  investmentCommitments: InvestmentCommitment[];
  assets: Asset[];
  loans: Loan[];
  insurance: Insurance[];
  insuranceAnalysis: InsuranceAnalysisConfig;
  goals: Goal[];
  estate: {
    hasWill: boolean;
    nominationsUpdated: boolean;
  };
  transactions: Transaction[];
  notifications?: Notification[];
}

export type Insurance = {
  id: string;
  category: InsuranceCategory;
  type: InsuranceType;
  proposer: string;
  insured: string;
  sumAssured: number;
  premium: number;
  beginYear?: number;
  pptEndYear?: number;
  maturityType?: string;
  annualPremiumsLeft?: number;
  premiumEndYear?: number;
  maturityDate?: string;
  isMoneyBack: boolean;
  moneyBackYears: number[];
  moneyBackAmounts: number[];
  incomeFrom?: number;
  incomeTo?: number;
  incomeGrowth?: number;
  incomeType?: string;
  incomeYear1?: number;
  incomeYear2?: number;
  incomeYear3?: number;
  incomeYear4?: number;
  sumInsured?: number;
  deductible?: number;
  thingsCovered?: string;
};

export type View = 
  | 'dashboard' 
  | 'transactions' 
  | 'goals' 
  | 'goal-summary' 
  | 'tax-estate' 
  | 'projections' 
  | 'ai-advisor' 
  | 'family' 
  | 'inflow' 
  | 'outflow' 
  | 'assets' 
  | 'debt' 
  | 'risk-profile' 
  | 'cashflow' 
  | 'investment-plan' 
  | 'action-plan' 
  | 'monthly-savings' 
  | 'settings' 
  | 'notifications' 
  | 'benefits' 
  | 'scenarios'
  | 'insurance';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
}

export interface CashflowItem {
  id: string;
  owner: string;
  label: string;
  amount: number;
  frequency: CashflowFrequency;
  growthRate: number;
  startYear: number;
  endYear: number;
  notes?: string;
  flowType?: 'Income' | 'Expense';
}

export interface InvestmentCommitment {
  id: string;
  owner: string;
  label: string;
  amount: number;
  frequency: InvestmentFrequency;
  stepUp: number;
  startYear: number;
  endYear: number;
  notes?: string;
}
