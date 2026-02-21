import type { CashflowFrequency, DiscountBucket, DiscountSettings, InvestmentFrequency, RelativeDate, RiskLevel } from '../types';
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

export const getGoalIntervalYears = (frequency?: string, intervalOverride?: number) => {
  const normalized = frequency ?? '';
  if (/every/i.test(normalized) && Number.isFinite(intervalOverride ?? NaN)) {
    const rounded = Math.round(intervalOverride as number);
    if (rounded >= 2) return rounded;
  }
  if (frequency === 'Once in 10 years') return 10;
  if (frequency === 'Every 2-5 Years') return 3;
  if (frequency === 'Every 5-10 Years') return 7;
  if (frequency === 'Every 2-15 Years' || frequency === 'Every 2–15 Years') return 8;
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

export const resolveBucketRange = (
  bucket: DiscountBucket,
  retirementOffset: number,
) => {
  const start = bucket.startType === 'Retirement'
    ? retirementOffset + bucket.startOffset
    : bucket.startOffset;
  let end = Infinity;
  if (bucket.endType === 'Offset') {
    end = bucket.endOffset ?? start;
  }
  if (bucket.endType === 'Retirement') {
    end = retirementOffset + (bucket.endOffset ?? 0);
  }
  return { start, end };
};

export const getBucketRateForOffset = (
  offset: number,
  retirementOffset: number,
  settings: DiscountSettings | undefined,
  fallbackRate: number,
  rateKey: 'discountRate' | 'inflationRate',
) => {
  if (!settings || (!settings.useBuckets && rateKey === 'discountRate')) {
    return fallbackRate;
  }
  if (!settings.useBucketInflation && rateKey === 'inflationRate') {
    return fallbackRate;
  }
  const buckets = settings.buckets || [];
  const normalizedOffset = Math.max(0, offset);
  for (const bucket of buckets) {
    const { start, end } = resolveBucketRange(bucket, retirementOffset);
    if (normalizedOffset >= start && normalizedOffset <= end) {
      const rate = bucket[rateKey];
      return Number.isFinite(rate as number) ? (rate as number) : fallbackRate;
    }
  }
  return fallbackRate;
};

export const buildBucketDiscountFactors = (
  currentYearValue: number,
  endYear: number,
  retirementYear: number,
  settings: DiscountSettings | undefined,
  fallbackRate: number,
) => {
  const factors: Record<number, number> = {};
  let rollingFactor = 1;
  const retirementOffset = retirementYear - currentYearValue;
  for (let year = currentYearValue; year <= endYear; year++) {
    factors[year] = rollingFactor;
    const offset = year - currentYearValue;
    const rate = getBucketRateForOffset(offset, retirementOffset, settings, fallbackRate, 'discountRate');
    rollingFactor *= (1 + rate / 100);
  }
  return factors;
};

export const inflateByBuckets = (
  base: number,
  fromYear: number,
  toYear: number,
  currentYearValue: number,
  retirementYear: number,
  settings: DiscountSettings | undefined,
  fallbackRate: number,
) => {
  if (toYear <= fromYear) return base;
  let value = base;
  const retirementOffset = retirementYear - currentYearValue;
  for (let year = fromYear; year < toYear; year++) {
    const offset = year - currentYearValue;
    const rate = getBucketRateForOffset(offset, retirementOffset, settings, fallbackRate, 'inflationRate');
    value *= (1 + rate / 100);
  }
  return value;
};
