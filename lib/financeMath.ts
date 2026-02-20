import type { CashflowFrequency, InvestmentFrequency, RelativeDate, RiskLevel } from '../types';
import { isValidDate } from './validation';

export const currentYear = () => new Date().getFullYear();

export const annualizeAmount = (amount: number, frequency: CashflowFrequency | InvestmentFrequency) => {
  const multiplier = frequency === 'Monthly'
    ? 12
    : frequency === 'Quarterly'
      ? 4
      : 1;
  return amount * multiplier;
};

export const computeInflatedAmount = (base: number, inflationRate: number, years: number) => {
  if (years <= 0) return base;
  return base * Math.pow(1 + inflationRate / 100, years);
};

export const getTotalYears = (startYear: number, endYear: number) => {
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return 0;
  return Math.max(0, endYear - startYear + 1);
};

export const getBirthYear = (dob?: string) => {
  if (!dob || !isValidDate(dob)) return null;
  return new Date(dob).getFullYear();
};

export const getRetirementYear = (dob: string | undefined, retirementAge: number) => {
  const birthYear = getBirthYear(dob);
  return birthYear ? birthYear + retirementAge : null;
};

export const getLifeExpectancyYear = (dob: string | undefined, lifeExpectancy: number) => {
  const birthYear = getBirthYear(dob);
  return birthYear ? birthYear + lifeExpectancy : null;
};

export const resolveRelativeYear = (
  rel: RelativeDate,
  dob: string | undefined,
  retirementAge: number,
  lifeExpectancy: number,
) => {
  const birthYear = getBirthYear(dob) ?? currentYear() - 30;
  switch (rel.type) {
    case 'Year':
      return rel.value;
    case 'Age':
      return birthYear + rel.value;
    case 'Retirement':
      return birthYear + retirementAge + rel.value;
    case 'LifeExpectancy':
      return birthYear + lifeExpectancy + rel.value;
    default:
      return rel.value;
  }
};

export const getRiskReturnAssumption = (risk?: RiskLevel) => {
  switch (risk) {
    case 'Conservative':
      return 8.8;
    case 'Moderate':
      return 9.5;
    case 'Balanced':
      return 10.15;
    case 'Aggressive':
      return 13.2;
    case 'Very Aggressive':
      return 14.5;
    default:
      return 10.15;
  }
};

export const getGoalIntervalYears = (frequency?: string) => {
  if (frequency === 'Once in 10 years') return 10;
  if (frequency === 'Every 2-5 Years') return 3;
  if (frequency === 'Every 5-10 Years') return 7;
  if (frequency === 'Every 2-15 Years') return 8;
  return 1;
};

export const getReturnRateForYear = (
  year: number,
  currentYearValue: number,
  retirementYear: number,
  baseReturn: number,
) => {
  const earlyBase = Math.min(baseReturn, 7);
  const midBase = Math.min(baseReturn, 10);
  const postRetirement = Math.min(baseReturn, 11.5);
  if (year <= currentYearValue + 2) return earlyBase;
  if (year <= currentYearValue + 4) return midBase;
  if (year >= retirementYear) return postRetirement;
  return baseReturn;
};

export const buildDiscountFactors = (
  currentYearValue: number,
  endYear: number,
  retirementYear: number,
  baseReturn: number,
) => {
  const factors: Record<number, number> = {};
  let rollingFactor = 1;
  for (let year = currentYearValue; year <= endYear; year++) {
    factors[year] = rollingFactor;
    const rate = getReturnRateForYear(year, currentYearValue, retirementYear, baseReturn);
    rollingFactor *= (1 + rate / 100);
  }
  return factors;
};
