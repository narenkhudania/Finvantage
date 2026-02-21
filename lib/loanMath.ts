import type { Loan } from '../types';

export const calculateEmi = (principal: number, annualRate: number, months: number) => {
  if (months <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const r = annualRate / 12 / 100;
  const pow = Math.pow(1 + r, months);
  return principal * r * pow / (pow - 1);
};

export const inferTenureMonths = (loan: Loan) => {
  const raw = Math.max(1, Math.round(loan.remainingTenure || 0));
  const assumeMonths = raw;
  const assumeYears = raw * 12;

  if (loan.emi > 0 && loan.outstandingAmount > 0 && loan.interestRate > 0) {
    const emiMonths = calculateEmi(loan.outstandingAmount, loan.interestRate, assumeMonths);
    const emiYears = calculateEmi(loan.outstandingAmount, loan.interestRate, assumeYears);
    const diffMonths = Math.abs(emiMonths - loan.emi);
    const diffYears = Math.abs(emiYears - loan.emi);
    if (diffYears < diffMonths * 0.6) return { months: assumeYears, basis: 'years' as const };
    if (diffMonths < diffYears * 0.6) return { months: assumeMonths, basis: 'months' as const };
  }

  if (raw <= 40) return { months: assumeYears, basis: 'years' as const };
  return { months: assumeMonths, basis: 'months' as const };
};

type LumpSum = { year: number; amount: number };

export const buildAmortizationSchedule = (
  loan: Loan,
  options?: { extraPayment?: number; overrideMonths?: number }
) => {
  const { months, basis } = inferTenureMonths(loan);
  const totalMonths = Math.max(1, options?.overrideMonths ?? months);
  const monthlyRate = loan.interestRate / 12 / 100;
  const emi = loan.emi > 0 ? loan.emi : calculateEmi(loan.outstandingAmount, loan.interestRate, totalMonths);
  const startYear = loan.startYear ?? new Date().getFullYear();

  const lumpSumMap = (loan.lumpSumRepayments || []).reduce((acc, ls) => {
    if (!ls || typeof ls.year !== 'number') return acc;
    if (ls.year < startYear) return acc;
    acc[ls.year] = (acc[ls.year] || 0) + (ls.amount || 0);
    return acc;
  }, {} as Record<number, number>);

  const schedule: Array<{
    month: number;
    year: number;
    openingBalance: number;
    interest: number;
    emi: number;
    principal: number;
    extraPayment: number;
    closingBalance: number;
  }> = [];

  let balance = loan.outstandingAmount;
  let totalInterest = 0;
  let monthIndex = 0;

  let extraApplied = false;
  while (balance > 0 && monthIndex < totalMonths + 600) {
    monthIndex += 1;
    const year = startYear + Math.floor((monthIndex - 1) / 12);
    const monthOfYear = ((monthIndex - 1) % 12) + 1;
    const opening = balance;

    const interest = opening * monthlyRate;
    let principal = emi - interest;
    let adjustedBalance = opening + interest - emi;

    if (principal < 0) {
      principal = 0;
      adjustedBalance = opening + interest - emi;
    }

    let extra = monthOfYear === 1 ? (lumpSumMap[year] || 0) : 0;
    if (!extraApplied && options?.extraPayment && options.extraPayment > 0) {
      extra += options.extraPayment;
      extraApplied = true;
    }
    const closing = Math.max(0, adjustedBalance - extra);

    schedule.push({
      month: monthIndex,
      year,
      openingBalance: Math.max(0, Math.round(opening)),
      interest: Math.round(interest),
      emi: Math.round(emi),
      principal: Math.round(Math.min(opening, principal)),
      extraPayment: Math.round(extra),
      closingBalance: Math.round(closing),
    });

    totalInterest += interest;
    balance = closing;

    if (monthIndex >= totalMonths && balance <= 0) break;
  }

  return {
    schedule,
    totalInterest,
    monthsRemaining: schedule.length,
    emi,
    basis,
  };
};

export const buildYearlyAmortization = (
  schedule: Array<{
    year: number;
    openingBalance: number;
    interest: number;
    emi: number;
    principal: number;
    extraPayment: number;
    closingBalance: number;
  }>
) => {
  const yearMap = new Map<number, {
    year: number;
    openingBalance: number;
    interest: number;
    emi: number;
    principal: number;
    extraPayment: number;
    closingBalance: number;
  }>();

  schedule.forEach((row) => {
    const existing = yearMap.get(row.year);
    if (!existing) {
      yearMap.set(row.year, {
        year: row.year,
        openingBalance: row.openingBalance,
        interest: row.interest,
        emi: row.emi,
        principal: row.principal,
        extraPayment: row.extraPayment,
        closingBalance: row.closingBalance,
      });
      return;
    }
    existing.interest += row.interest;
    existing.emi += row.emi;
    existing.principal += row.principal;
    existing.extraPayment += row.extraPayment;
    existing.closingBalance = row.closingBalance;
  });

  const rows = Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
  return rows.map((row, index) => ({
    yearIndex: index + 1,
    ...row,
  }));
};
