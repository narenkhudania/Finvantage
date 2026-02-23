import type { DetailedIncome } from '../types';

const MONTHS_IN_YEAR = 12;

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

// Normalized monthly view:
// - bonus, reimbursements and investment/dividends are stored as yearly values.
// - planning uses monthly cashflow, so yearly values are divided by 12.
export const monthlyIncomeBreakdown = (income?: Partial<DetailedIncome>) => {
  const salary = toNumber(income?.salary);
  const bonus = toNumber(income?.bonus) / MONTHS_IN_YEAR;
  const reimbursements = toNumber(income?.reimbursements) / MONTHS_IN_YEAR;
  const rental = toNumber(income?.rental);
  const investment = toNumber(income?.investment) / MONTHS_IN_YEAR;
  const business = toNumber(income?.business);
  const pension = toNumber(income?.pension);

  return {
    salary,
    bonus,
    reimbursements,
    rental,
    investment,
    business,
    pension,
    total: salary + bonus + reimbursements + rental + investment + business + pension,
  };
};

export const monthlyIncomeFromDetailed = (income?: Partial<DetailedIncome>) => {
  return monthlyIncomeBreakdown(income).total;
};

export const annualIncomeFromDetailed = (income?: Partial<DetailedIncome>) => {
  return monthlyIncomeFromDetailed(income) * MONTHS_IN_YEAR;
};

