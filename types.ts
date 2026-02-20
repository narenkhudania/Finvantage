
export type TransactionType = 'income' | 'expense';
export type IncomeSource = 'salaried' | 'business';
export type AssetType = 'Liquid' | 'Debt' | 'Equity' | 'Real Estate' | 'Personal' | 'Gold/Silver';
export type Relation = 'Spouse' | 'Child' | 'Parent' | 'Other';
export type InsuranceCategory = 'Life Insurance' | 'General Insurance';
export type InsuranceType = 'Term' | 'Endowment' | 'Money Back' | 'ULIP' | 'Annuity' | 'Health' | 'Critical Illness' | 'Personal Accident' | 'Home' | 'Car' | 'Others';

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
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: Relation;
  age: number;
  isDependent: boolean;
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
  lumpSumRepayments: { year: number; amount: number }[];
}

export type RelativeDateType = 'Year' | 'Age' | 'Retirement' | 'LifeExpectancy';

export interface RelativeDate {
  type: RelativeDateType;
  value: number; 
}

export interface Goal {
  id: string;
  type: GoalType;
  description: string;
  priority: number;
  resourceBuckets: ResourceBucket[];
  isRecurring: boolean;
  frequency?: 'Monthly' | 'Yearly' | 'Every 2-5 Years' | 'Every 5-10 Years' | 'Every 2-15 Years';
  startDate: RelativeDate;
  endDate: RelativeDate;
  targetAmountToday: number;
  inflationRate: number;
  currentAmount: number;
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
  premiumEndYear?: number;
  maturityDate?: string;
  isMoneyBack: boolean;
  moneyBackYears: number[];
  moneyBackAmounts: number[];
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
