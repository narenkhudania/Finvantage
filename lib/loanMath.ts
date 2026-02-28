import type { DayCountDenominator, InstallmentType, Loan } from '../types';

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

type RepriceStrategy = 'keep-emi' | 'keep-tenure';
type RateAdjustment = { fromMonth: number; annualRate: number };
type DueDayMode = 'fixed' | 'month-end';

type ScheduleOptions = {
  extraPayment?: number;
  extraPaymentMonth?: number;
  overrideMonths?: number;
  dayCountDenominator?: DayCountDenominator;
  dueDay?: number;
  dueDayMode?: DueDayMode;
  installmentType?: InstallmentType;
  brokenInterestCharged?: boolean;
  repriceStrategy?: RepriceStrategy;
  rateAdjustments?: RateAdjustment[];
};

const MS_PER_DAY = 86_400_000;

const clampDay = (day: number) => Math.min(31, Math.max(1, Math.round(day)));

const monthEndDay = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const formatIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveDueDate = (baseDate: Date, monthOffset: number, dueDayMode: DueDayMode, dueDay: number) => {
  const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const day = dueDayMode === 'month-end'
    ? monthEndDay(year, month)
    : Math.min(clampDay(dueDay), monthEndDay(year, month));
  return new Date(year, month, day);
};

const getAnnualRateForMonth = (baseRate: number, month: number, adjustments: RateAdjustment[]) => {
  let rate = baseRate;
  for (const adjustment of adjustments) {
    if (adjustment.fromMonth <= month) rate = adjustment.annualRate;
    else break;
  }
  return rate;
};

export const buildAmortizationSchedule = (
  loan: Loan,
  options?: ScheduleOptions
) => {
  const { months, basis } = inferTenureMonths(loan);
  const totalMonths = Math.max(1, options?.overrideMonths ?? months);
  const emi = loan.emi > 0 ? loan.emi : calculateEmi(loan.outstandingAmount, loan.interestRate, totalMonths);
  const startYear = loan.startYear ?? new Date().getFullYear();
  const startDate = new Date(startYear, 0, 1);
  const dueDayMode: DueDayMode = options?.dueDayMode ?? (loan.dueDayMode === 'Month End' ? 'month-end' : 'fixed');
  const dueDay = options?.dueDay ?? loan.dueDay ?? 5;
  const dayCountDenominator = options?.dayCountDenominator ?? loan.dayCountDenominator ?? 365;
  const installmentType: InstallmentType = options?.installmentType ?? loan.installmentType ?? 'EMI';
  const brokenInterestCharged = options?.brokenInterestCharged ?? loan.brokenInterestCharged ?? true;
  const repriceStrategy = options?.repriceStrategy ?? 'keep-emi';
  const rateAdjustments = (options?.rateAdjustments || [])
    .filter(r => Number.isFinite(r?.annualRate) && Number.isFinite(r?.fromMonth) && r.fromMonth >= 1)
    .sort((a, b) => a.fromMonth - b.fromMonth);

  const firstDueCandidate = resolveDueDate(startDate, 0, dueDayMode, dueDay);
  const firstDueOffset = firstDueCandidate <= startDate ? 1 : 0;

  const lumpSumMap = (loan.lumpSumRepayments || []).reduce((acc, ls) => {
    if (!ls || typeof ls.year !== 'number') return acc;
    if (ls.year < startYear) return acc;
    acc[ls.year] = (acc[ls.year] || 0) + (ls.amount || 0);
    return acc;
  }, {} as Record<number, number>);

  const schedule: Array<{
    month: number;
    installmentNo: number;
    year: number;
    dueDate: string;
    daysInPeriod: number;
    annualRate: number;
    effectiveAnnualRate: number;
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

  let scheduledEmi = emi;
  const equalPrincipalAmount = loan.outstandingAmount / totalMonths;
  while (balance > 0 && monthIndex < totalMonths + 600) {
    monthIndex += 1;
    const dueDate = resolveDueDate(startDate, firstDueOffset + monthIndex - 1, dueDayMode, dueDay);
    const previousDueDate = monthIndex === 1
      ? startDate
      : resolveDueDate(startDate, firstDueOffset + monthIndex - 2, dueDayMode, dueDay);
    const rawDays = Math.max(1, Math.round((dueDate.getTime() - previousDueDate.getTime()) / MS_PER_DAY));
    const daysInPeriod = monthIndex === 1 && !brokenInterestCharged ? 30 : rawDays;
    const annualRate = getAnnualRateForMonth(loan.interestRate, monthIndex, rateAdjustments);
    const periodicRate = (annualRate / 100) * (daysInPeriod / dayCountDenominator);

    if (installmentType === 'EMI' && repriceStrategy === 'keep-tenure') {
      const previousAnnualRate = getAnnualRateForMonth(loan.interestRate, Math.max(1, monthIndex - 1), rateAdjustments);
      const hasRateResetAtStart = monthIndex === 1 && rateAdjustments.some(item => item.fromMonth === 1);
      if (hasRateResetAtStart || (monthIndex > 1 && Math.abs(previousAnnualRate - annualRate) > 0.0001)) {
        const remainingMonths = Math.max(1, totalMonths - monthIndex + 1);
        scheduledEmi = calculateEmi(balance, annualRate, remainingMonths);
      }
    }

    const year = dueDate.getFullYear();
    const opening = balance;
    const interest = opening * periodicRate;
    let principal = installmentType === 'Equal Principal'
      ? Math.min(opening, equalPrincipalAmount)
      : Math.max(0, scheduledEmi - interest);
    let installment = installmentType === 'Equal Principal'
      ? (interest + principal)
      : scheduledEmi;
    if (principal > opening) {
      principal = opening;
      installment = interest + principal;
    }
    const adjustedBalance = Math.max(0, opening + interest - installment);

    const monthOfYear = dueDate.getMonth() + 1;
    let extra = monthOfYear === 1 ? (lumpSumMap[year] || 0) : 0;
    if (options?.extraPayment && options.extraPayment > 0 && (options.extraPaymentMonth ?? 1) === monthIndex) {
      extra += options.extraPayment;
    }
    const closing = Math.max(0, adjustedBalance - extra);

    schedule.push({
      month: monthIndex,
      installmentNo: monthIndex,
      year,
      dueDate: formatIsoDate(dueDate),
      daysInPeriod,
      annualRate: Number(annualRate.toFixed(4)),
      effectiveAnnualRate: Number(annualRate.toFixed(4)),
      openingBalance: Math.max(0, Math.round(opening)),
      interest: Math.round(interest),
      emi: Math.round(installment),
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
