import React, { useMemo, useState } from 'react';
import { Asset, FinanceState, RiskLevel } from '../types';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Globe2,
  Info,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Scatter,
  ScatterChart,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import SafeResponsiveContainer from './common/SafeResponsiveContainer';
import { formatCurrency } from '../lib/currency';

type EngineAssetClass =
  | 'Domestic Equity'
  | 'International Equity'
  | 'Emerging Markets'
  | 'Fixed Income'
  | 'Alternatives'
  | 'Crypto'
  | 'Cash / Liquid';

type CapacityBand = 'Low' | 'Moderate' | 'High';
type FlexBand = 'Low' | 'Moderate' | 'High';

type WeightMap = Record<EngineAssetClass, number>;

type ClassAssumption = {
  expectedReturn: number;
  volatility: number;
  beta: number;
};

type ClassifiedAsset = {
  id: string;
  name: string;
  classKey: EngineAssetClass;
  value: number;
  growthRate: number;
  purchaseYear: number;
  sector: string;
  geography: 'Domestic' | 'International' | 'Emerging';
  durationBucket: '0-1Y' | '1-3Y' | '3-7Y' | '7Y+' | null;
  equityStyle: 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Blend' | null;
  taxBucket: 'short' | 'long';
};

type PortfolioMetrics = {
  expectedReturn: number;
  volatility: number;
  downsideRisk: number;
  sharpe: number;
  beta: number;
  maxDrawdown: number;
  diversificationRatio: number;
  riskContribution: WeightMap;
};

type AllocationRow = {
  classKey: EngineAssetClass;
  currentPct: number;
  targetPct: number;
  implementationPct: number;
  deviation: number;
  action: 'Buy' | 'Sell' | 'Hold';
  dollarMove: number;
  deviationBand: number;
};

type TradeInstruction = {
  action: 'Buy' | 'Sell';
  classKey: EngineAssetClass;
  instrument: string;
  amount: number;
  pctPortfolio: number;
  volatilityImpact: number;
  sharpeImpact: number;
  taxHint: string;
};

const ASSET_CLASS_ORDER: EngineAssetClass[] = [
  'Domestic Equity',
  'International Equity',
  'Emerging Markets',
  'Fixed Income',
  'Alternatives',
  'Crypto',
  'Cash / Liquid',
];

const CLASS_COLOR: Record<EngineAssetClass, string> = {
  'Domestic Equity': '#0d9488',
  'International Equity': '#0284c7',
  'Emerging Markets': '#0ea5e9',
  'Fixed Income': '#64748b',
  Alternatives: '#a16207',
  Crypto: '#7c3aed',
  'Cash / Liquid': '#16a34a',
};

const CLASS_ASSUMPTIONS: Record<EngineAssetClass, ClassAssumption> = {
  'Domestic Equity': { expectedReturn: 12.0, volatility: 20.0, beta: 1.0 },
  'International Equity': { expectedReturn: 10.5, volatility: 18.0, beta: 0.92 },
  'Emerging Markets': { expectedReturn: 13.5, volatility: 24.0, beta: 1.15 },
  'Fixed Income': { expectedReturn: 7.0, volatility: 7.0, beta: 0.2 },
  Alternatives: { expectedReturn: 8.5, volatility: 12.0, beta: 0.35 },
  Crypto: { expectedReturn: 18.0, volatility: 60.0, beta: 1.6 },
  'Cash / Liquid': { expectedReturn: 4.2, volatility: 1.2, beta: 0.03 },
};

const CORRELATION_MATRIX: Record<EngineAssetClass, Partial<Record<EngineAssetClass, number>>> = {
  'Domestic Equity': {
    'International Equity': 0.78,
    'Emerging Markets': 0.68,
    'Fixed Income': -0.18,
    Alternatives: 0.28,
    Crypto: 0.45,
    'Cash / Liquid': 0.05,
  },
  'International Equity': {
    'Emerging Markets': 0.72,
    'Fixed Income': -0.12,
    Alternatives: 0.24,
    Crypto: 0.42,
    'Cash / Liquid': 0.04,
  },
  'Emerging Markets': {
    'Fixed Income': -0.08,
    Alternatives: 0.22,
    Crypto: 0.5,
    'Cash / Liquid': 0.03,
  },
  'Fixed Income': {
    Alternatives: 0.15,
    Crypto: 0.02,
    'Cash / Liquid': 0.55,
  },
  Alternatives: {
    Crypto: 0.2,
    'Cash / Liquid': 0.12,
  },
  Crypto: {
    'Cash / Liquid': -0.04,
  },
  'Cash / Liquid': {},
};

const SAA_BY_RISK: Record<RiskLevel, WeightMap> = {
  Conservative: {
    'Domestic Equity': 20,
    'International Equity': 6,
    'Emerging Markets': 2,
    'Fixed Income': 48,
    Alternatives: 12,
    Crypto: 0,
    'Cash / Liquid': 12,
  },
  Moderate: {
    'Domestic Equity': 30,
    'International Equity': 10,
    'Emerging Markets': 5,
    'Fixed Income': 34,
    Alternatives: 10,
    Crypto: 2,
    'Cash / Liquid': 9,
  },
  Balanced: {
    'Domestic Equity': 38,
    'International Equity': 12,
    'Emerging Markets': 6,
    'Fixed Income': 25,
    Alternatives: 10,
    Crypto: 3,
    'Cash / Liquid': 6,
  },
  Aggressive: {
    'Domestic Equity': 46,
    'International Equity': 15,
    'Emerging Markets': 9,
    'Fixed Income': 16,
    Alternatives: 8,
    Crypto: 4,
    'Cash / Liquid': 2,
  },
  'Very Aggressive': {
    'Domestic Equity': 50,
    'International Equity': 17,
    'Emerging Markets': 11,
    'Fixed Income': 11,
    Alternatives: 6,
    Crypto: 4,
    'Cash / Liquid': 1,
  },
};

const DEVIATION_BANDS: Record<EngineAssetClass, number> = {
  'Domestic Equity': 5,
  'International Equity': 4,
  'Emerging Markets': 4,
  'Fixed Income': 5,
  Alternatives: 4,
  Crypto: 2,
  'Cash / Liquid': 3,
};

const RISK_LEVELS: RiskLevel[] = ['Conservative', 'Moderate', 'Balanced', 'Aggressive', 'Very Aggressive'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const emptyWeights = (): WeightMap => ({
  'Domestic Equity': 0,
  'International Equity': 0,
  'Emerging Markets': 0,
  'Fixed Income': 0,
  Alternatives: 0,
  Crypto: 0,
  'Cash / Liquid': 0,
});

const normalizeWeights = (weights: WeightMap): WeightMap => {
  const total = ASSET_CLASS_ORDER.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);
  if (total <= 0) return emptyWeights();
  const normalized = emptyWeights();
  ASSET_CLASS_ORDER.forEach((key) => {
    normalized[key] = (Math.max(0, weights[key]) / total) * 100;
  });
  return normalized;
};

const getCorrelation = (left: EngineAssetClass, right: EngineAssetClass) => {
  if (left === right) return 1;
  const direct = CORRELATION_MATRIX[left]?.[right];
  if (typeof direct === 'number') return direct;
  const reverse = CORRELATION_MATRIX[right]?.[left];
  if (typeof reverse === 'number') return reverse;
  return 0.2;
};

const getAge = (dob: string) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

const detectSector = (text: string) => {
  const normalized = text.toLowerCase();
  const rules: Array<{ sector: string; keys: string[] }> = [
    { sector: 'Technology', keys: ['tech', 'it', 'software', 'digital', 'nasdaq'] },
    { sector: 'Financials', keys: ['bank', 'finance', 'nbfc', 'financial'] },
    { sector: 'Healthcare', keys: ['health', 'pharma', 'biotech', 'medical'] },
    { sector: 'Consumer', keys: ['consumer', 'fmcg', 'retail', 'brand'] },
    { sector: 'Energy', keys: ['energy', 'oil', 'gas', 'power', 'utility'] },
    { sector: 'Industrial', keys: ['industrial', 'infra', 'infrastructure', 'capital goods'] },
    { sector: 'Real Estate', keys: ['real estate', 'reit', 'property'] },
    { sector: 'Materials', keys: ['metal', 'mining', 'cement', 'materials'] },
    { sector: 'Diversified', keys: ['index', 'flexi', 'multi', 'diversified'] },
  ];
  const matched = rules.find((rule) => rule.keys.some((key) => normalized.includes(key)));
  return matched?.sector || 'Diversified';
};

const classifyAsset = (asset: Asset, currentYear: number): ClassifiedAsset => {
  const raw = `${asset.category} ${asset.subCategory} ${asset.name}`.toLowerCase();
  const has = (keys: string[]) => keys.some((key) => raw.includes(key));

  let classKey: EngineAssetClass = 'Alternatives';
  if (asset.category === 'Liquid') classKey = 'Cash / Liquid';
  else if (asset.category === 'Debt') classKey = 'Fixed Income';
  else if (asset.category === 'Gold/Silver') classKey = 'Alternatives';
  else if (asset.category === 'Real Estate') classKey = 'Alternatives';
  else if (has(['crypto', 'bitcoin', 'ethereum', 'btc', 'eth'])) classKey = 'Crypto';
  else if (asset.category === 'Equity') {
    if (has(['emerging', 'latam', 'asean', 'china', 'brazil'])) classKey = 'Emerging Markets';
    else if (has(['international', 'global', 'us', 'usa', 'nasdaq', 's&p', 'developed'])) classKey = 'International Equity';
    else classKey = 'Domestic Equity';
  }

  const geography: ClassifiedAsset['geography'] =
    classKey === 'International Equity'
      ? 'International'
      : classKey === 'Emerging Markets'
      ? 'Emerging'
      : 'Domestic';

  const equityStyle: ClassifiedAsset['equityStyle'] =
    classKey === 'Domestic Equity'
      ? has(['large', 'bluechip'])
        ? 'Large Cap'
        : has(['mid'])
        ? 'Mid Cap'
        : has(['small', 'micro'])
        ? 'Small Cap'
        : 'Blend'
      : null;

  const durationBucket: ClassifiedAsset['durationBucket'] =
    classKey === 'Fixed Income'
      ? has(['liquid', 'money market', 'ultra short'])
        ? '0-1Y'
        : has(['short'])
        ? '1-3Y'
        : has(['gilt', 'long duration', '10y', 'long'])
        ? '7Y+'
        : '3-7Y'
      : null;

  return {
    id: asset.id,
    name: asset.name || asset.subCategory || asset.category,
    classKey,
    value: Math.max(0, asset.currentValue || 0),
    growthRate: Number.isFinite(asset.growthRate) ? asset.growthRate : CLASS_ASSUMPTIONS[classKey].expectedReturn,
    purchaseYear: asset.purchaseYear || currentYear,
    sector: detectSector(raw),
    geography,
    durationBucket,
    equityStyle,
    taxBucket: currentYear - (asset.purchaseYear || currentYear) >= 1 ? 'long' : 'short',
  };
};

const computePortfolioMetrics = (weightsPct: WeightMap): PortfolioMetrics => {
  const keys = ASSET_CLASS_ORDER;
  const weights = keys.map((key) => (weightsPct[key] || 0) / 100);

  let expectedReturn = 0;
  let beta = 0;
  let numeratorForDiversification = 0;

  keys.forEach((key, idx) => {
    expectedReturn += weights[idx] * CLASS_ASSUMPTIONS[key].expectedReturn;
    beta += weights[idx] * CLASS_ASSUMPTIONS[key].beta;
    numeratorForDiversification += weights[idx] * CLASS_ASSUMPTIONS[key].volatility;
  });

  const sigma = keys.map((left) =>
    keys.map((right) => {
      const leftVol = CLASS_ASSUMPTIONS[left].volatility;
      const rightVol = CLASS_ASSUMPTIONS[right].volatility;
      return leftVol * rightVol * getCorrelation(left, right);
    })
  );

  let variance = 0;
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = 0; j < keys.length; j += 1) {
      variance += weights[i] * weights[j] * sigma[i][j];
    }
  }

  const volatility = Math.sqrt(Math.max(variance, 0));
  const downsideRisk = volatility * 0.72;
  const sharpe = volatility > 0 ? (expectedReturn - 5.0) / volatility : 0;
  const diversificationRatio = volatility > 0 ? numeratorForDiversification / volatility : 1;
  const maxDrawdown = clamp(volatility * 2.25, 3, 75);

  const sigmaW = keys.map((_, i) => {
    let sum = 0;
    for (let j = 0; j < keys.length; j += 1) {
      sum += sigma[i][j] * weights[j];
    }
    return sum;
  });

  const riskContribution = emptyWeights();
  keys.forEach((key, idx) => {
    const contribution = variance > 0 ? (weights[idx] * sigmaW[idx]) / variance : 0;
    riskContribution[key] = contribution * 100;
  });

  return {
    expectedReturn,
    volatility,
    downsideRisk,
    sharpe,
    beta,
    maxDrawdown,
    diversificationRatio,
    riskContribution,
  };
};

const formatPct = (value: number, digits = 1) => `${value.toFixed(digits)}%`;

const formatSignedPct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

const sumBy = <T,>(rows: T[], selector: (row: T) => number) => rows.reduce((sum, row) => sum + selector(row), 0);

const drawdownToleranceFor = (risk: RiskLevel) => {
  if (risk === 'Conservative') return '8% to 12% decline comfort range';
  if (risk === 'Moderate') return '12% to 18% decline comfort range';
  if (risk === 'Balanced') return '18% to 24% decline comfort range';
  if (risk === 'Aggressive') return '24% to 35% decline comfort range';
  return '30% to 45% decline comfort range';
};

const riskScoreFromLevel = (risk: RiskLevel) => {
  if (risk === 'Conservative') return 3;
  if (risk === 'Moderate') return 5;
  if (risk === 'Balanced') return 6;
  if (risk === 'Aggressive') return 8;
  return 9;
};

const psychToleranceBand = (risk: RiskLevel): FlexBand => {
  if (risk === 'Conservative') return 'Low';
  if (risk === 'Moderate' || risk === 'Balanced') return 'Moderate';
  return 'High';
};

const timeFlexBand = (horizonYears: number): FlexBand => {
  if (horizonYears >= 18) return 'High';
  if (horizonYears >= 8) return 'Moderate';
  return 'Low';
};

const capacityBandFromInputs = (horizonYears: number, surplusRate: number, emiToIncome: number): CapacityBand => {
  const horizonScore = horizonYears >= 20 ? 4 : horizonYears >= 12 ? 3 : horizonYears >= 6 ? 2 : 1;
  const surplusScore = surplusRate >= 0.3 ? 3 : surplusRate >= 0.1 ? 2 : surplusRate >= 0 ? 1 : 0;
  const debtScore = emiToIncome <= 0.15 ? 3 : emiToIncome <= 0.3 ? 2 : emiToIncome <= 0.45 ? 1 : 0;
  const score = horizonScore + surplusScore + debtScore;
  if (score >= 8) return 'High';
  if (score >= 5) return 'Moderate';
  return 'Low';
};

const transitionWeight = (map: WeightMap, from: EngineAssetClass[], to: EngineAssetClass[], amount: number) => {
  if (amount <= 0) return;
  const sourceTotal = sumBy(from, (key) => Math.max(0, map[key]));
  if (sourceTotal <= 0) return;

  const transferable = Math.min(amount, sourceTotal);
  from.forEach((key) => {
    const sourceShare = sourceTotal > 0 ? Math.max(0, map[key]) / sourceTotal : 0;
    map[key] = Math.max(0, map[key] - transferable * sourceShare);
  });

  const targetUnit = to.length > 0 ? transferable / to.length : 0;
  to.forEach((key) => {
    map[key] += targetUnit;
  });
};

const scenarioLossPct = (shockAbsPct: number, metrics: PortfolioMetrics) => {
  const betaComponent = 0.5 * metrics.beta;
  const volComponent = 0.5 * (metrics.volatility / 20);
  const diversificationShield = clamp((metrics.diversificationRatio - 1) * 0.18, 0, 0.22);
  const raw = shockAbsPct * (betaComponent + volComponent) * (1 - diversificationShield);
  return clamp(raw, shockAbsPct * 0.35, shockAbsPct * 1.65);
};

const correlationTone = (value: number) => {
  const intensity = clamp(Math.abs(value), 0, 1);
  if (value >= 0) {
    return {
      backgroundColor: `rgba(13, 148, 136, ${0.08 + intensity * 0.3})`,
      color: intensity > 0.62 ? '#134e4a' : '#0f766e',
    };
  }
  return {
    backgroundColor: `rgba(245, 158, 11, ${0.08 + intensity * 0.26})`,
    color: intensity > 0.62 ? '#78350f' : '#92400e',
  };
};

const InvestmentPlan: React.FC<{ state: FinanceState }> = ({ state }) => {
  const currentYear = new Date().getFullYear();
  const currencyCountry = state.profile.country;

  const [riskOverride, setRiskOverride] = useState<'Auto' | RiskLevel>('Auto');
  const [growthTilt, setGrowthTilt] = useState(0);
  const [marketShock, setMarketShock] = useState(-20);

  const effectiveRisk: RiskLevel = riskOverride === 'Auto' ? state.riskProfile?.level || 'Balanced' : riskOverride;
  const effectiveRiskScore = state.riskProfile?.score || riskScoreFromLevel(effectiveRisk);

  const classifiedAssets = useMemo(
    () => state.assets.map((asset) => classifyAsset(asset, currentYear)),
    [state.assets, currentYear]
  );

  const totalPortfolioValue = useMemo(
    () => sumBy(classifiedAssets, (asset) => asset.value),
    [classifiedAssets]
  );

  const currentWeights = useMemo(() => {
    const weights = emptyWeights();
    if (totalPortfolioValue <= 0) return weights;
    classifiedAssets.forEach((asset) => {
      weights[asset.classKey] += (asset.value / totalPortfolioValue) * 100;
    });
    return normalizeWeights(weights);
  }, [classifiedAssets, totalPortfolioValue]);

  const monthlyIncome = useMemo(() => {
    const income = state.profile.income;
    const annual =
      (income.salary || 0) +
      (income.bonus || 0) +
      (income.reimbursements || 0) +
      (income.business || 0) +
      (income.rental || 0) +
      (income.investment || 0) +
      (income.pension || 0);
    return annual / 12;
  }, [state.profile.income]);

  const monthlyDebtObligation = useMemo(
    () => sumBy(state.loans, (loan) => Number(loan.emi || 0)),
    [state.loans]
  );

  const baseMonthlyExpense = Math.max(0, Number(state.profile.monthlyExpenses || 0));
  const monthlySurplus = monthlyIncome - baseMonthlyExpense - monthlyDebtObligation;
  const surplusRate = monthlyIncome > 0 ? monthlySurplus / monthlyIncome : 0;
  const emiToIncome = monthlyIncome > 0 ? monthlyDebtObligation / monthlyIncome : 0;

  const age = getAge(state.profile.dob);
  const horizonYears = age != null
    ? Math.max(1, state.profile.retirementAge - age)
    : Math.max(1, state.profile.retirementAge - 35);

  const liquidityMonths =
    effectiveRisk === 'Conservative'
      ? 9
      : effectiveRisk === 'Moderate'
      ? 8
      : effectiveRisk === 'Balanced'
      ? 6
      : effectiveRisk === 'Aggressive'
      ? 4
      : 3;

  const liquidityRequirement = baseMonthlyExpense * liquidityMonths;
  const liquidityRatio = totalPortfolioValue > 0 ? liquidityRequirement / totalPortfolioValue : 0;

  const capacityBand = capacityBandFromInputs(horizonYears, surplusRate, emiToIncome);
  const toleranceBand = psychToleranceBand(effectiveRisk);
  const timeFlex = timeFlexBand(horizonYears);

  const targetSaa = useMemo(() => {
    const seed = { ...SAA_BY_RISK[effectiveRisk] };

    if (horizonYears < 10) {
      transitionWeight(seed, ['Domestic Equity', 'International Equity', 'Emerging Markets', 'Crypto'], ['Fixed Income', 'Cash / Liquid'], horizonYears < 6 ? 10 : 6);
    }

    if (liquidityRatio > 0.18) {
      transitionWeight(seed, ['Domestic Equity', 'Emerging Markets', 'Crypto'], ['Cash / Liquid', 'Fixed Income'], 6);
    }

    if (capacityBand === 'Low' && (effectiveRisk === 'Aggressive' || effectiveRisk === 'Very Aggressive')) {
      transitionWeight(seed, ['Domestic Equity', 'International Equity', 'Emerging Markets', 'Crypto'], ['Fixed Income', 'Cash / Liquid'], 8);
    }

    if (growthTilt > 0) {
      transitionWeight(seed, ['Fixed Income', 'Cash / Liquid'], ['Domestic Equity', 'International Equity', 'Emerging Markets', 'Crypto'], Math.min(12, growthTilt));
    }

    if (growthTilt < 0) {
      transitionWeight(seed, ['Domestic Equity', 'International Equity', 'Emerging Markets', 'Crypto'], ['Fixed Income', 'Cash / Liquid'], Math.min(12, Math.abs(growthTilt)));
    }

    // cap crypto based on risk level
    const cryptoCap =
      effectiveRisk === 'Conservative'
        ? 0
        : effectiveRisk === 'Moderate'
        ? 2
        : effectiveRisk === 'Balanced'
        ? 4
        : effectiveRisk === 'Aggressive'
        ? 6
        : 8;

    if (seed.Crypto > cryptoCap) {
      const reduction = seed.Crypto - cryptoCap;
      seed.Crypto = cryptoCap;
      seed['Fixed Income'] += reduction * 0.55;
      seed['Cash / Liquid'] += reduction * 0.45;
    }

    return normalizeWeights(seed);
  }, [effectiveRisk, horizonYears, liquidityRatio, capacityBand, growthTilt]);

  const implementationWeights = useMemo(() => {
    const map = emptyWeights();
    ASSET_CLASS_ORDER.forEach((classKey) => {
      const current = currentWeights[classKey];
      const target = targetSaa[classKey];
      const band = DEVIATION_BANDS[classKey];
      map[classKey] = Math.abs(current - target) <= band ? current : target;
    });

    // keep weights coherent without forcing unnecessary turnover across all classes
    return normalizeWeights(map);
  }, [currentWeights, targetSaa]);

  const metricsBefore = useMemo(() => computePortfolioMetrics(currentWeights), [currentWeights]);
  const metricsAfter = useMemo(() => computePortfolioMetrics(implementationWeights), [implementationWeights]);

  const allocationRows: AllocationRow[] = useMemo(() => {
    return ASSET_CLASS_ORDER.map((classKey) => {
      const current = currentWeights[classKey];
      const target = targetSaa[classKey];
      const implementation = implementationWeights[classKey];
      const deviation = current - target;
      const dollarMove = ((implementation - current) / 100) * totalPortfolioValue;
      const band = DEVIATION_BANDS[classKey];
      const action: AllocationRow['action'] =
        Math.abs(implementation - current) < 0.25
          ? 'Hold'
          : implementation > current
          ? 'Buy'
          : 'Sell';
      return {
        classKey,
        currentPct: current,
        targetPct: target,
        implementationPct: implementation,
        deviation,
        action,
        dollarMove,
        deviationBand: band,
      };
    });
  }, [currentWeights, targetSaa, implementationWeights, totalPortfolioValue]);

  const grossTurnover = useMemo(
    () => sumBy(allocationRows, (row) => Math.abs(row.dollarMove)),
    [allocationRows]
  );

  const tradeInstructions = useMemo<TradeInstruction[]>(() => {
    const instructions: TradeInstruction[] = [];
    const volDelta = metricsAfter.volatility - metricsBefore.volatility;
    const sharpeDelta = metricsAfter.sharpe - metricsBefore.sharpe;

    const rowsToTrade = allocationRows.filter((row) => row.action !== 'Hold' && Math.abs(row.dollarMove) >= 1);

    rowsToTrade.forEach((row) => {
      const inClass = classifiedAssets.filter((asset) => asset.classKey === row.classKey && asset.value > 0);
      const tradeAmount = Math.abs(row.dollarMove);

      if (!inClass.length && row.action === 'Buy') {
        const weight = grossTurnover > 0 ? tradeAmount / grossTurnover : 0;
        instructions.push({
          action: 'Buy',
          classKey: row.classKey,
          instrument: `New ${row.classKey} diversified sleeve`,
          amount: tradeAmount,
          pctPortfolio: (tradeAmount / (totalPortfolioValue || 1)) * 100,
          volatilityImpact: volDelta * weight,
          sharpeImpact: sharpeDelta * weight,
          taxHint: 'Fresh capital deployment; no immediate realization tax event.',
        });
        return;
      }

      const weightedHolders = inClass
        .map((asset) => {
          const taxMultiplier = row.action === 'Sell' ? (asset.taxBucket === 'long' ? 1.2 : 0.8) : 1 / Math.max(asset.value, 1);
          return {
            ...asset,
            score: Math.max(0.0001, asset.value * taxMultiplier),
          };
        })
        .sort((a, b) => b.score - a.score);

      const scoreTotal = sumBy(weightedHolders, (asset) => asset.score);
      weightedHolders.forEach((asset) => {
        const amount = scoreTotal > 0 ? (tradeAmount * asset.score) / scoreTotal : 0;
        if (amount < 1) return;
        const weight = grossTurnover > 0 ? amount / grossTurnover : 0;
        instructions.push({
          action: row.action,
          classKey: row.classKey,
          instrument: asset.name,
          amount,
          pctPortfolio: (amount / (totalPortfolioValue || 1)) * 100,
          volatilityImpact: volDelta * weight,
          sharpeImpact: sharpeDelta * weight,
          taxHint:
            row.action === 'Sell'
              ? asset.taxBucket === 'short'
                ? 'Potential short-term gain realization. Prefer offset with loss harvesting if available.'
                : 'Likely long-term holding treatment. Tax impact may be lower than short-term exits.'
              : 'Accumulation trade. Keep transaction costs low via staged deployment.',
        });
      });
    });

    return instructions
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 14);
  }, [allocationRows, classifiedAssets, grossTurnover, metricsAfter.volatility, metricsBefore.volatility, metricsAfter.sharpe, metricsBefore.sharpe, totalPortfolioValue]);

  const topHoldings = useMemo(() => {
    return [...classifiedAssets].sort((a, b) => b.value - a.value).slice(0, 5);
  }, [classifiedAssets]);

  const top5Concentration = useMemo(
    () => (totalPortfolioValue > 0 ? (sumBy(topHoldings, (holding) => holding.value) / totalPortfolioValue) * 100 : 0),
    [topHoldings, totalPortfolioValue]
  );

  const sectorExposure = useMemo(() => {
    const map = new Map<string, number>();
    classifiedAssets.forEach((asset) => {
      map.set(asset.sector, (map.get(asset.sector) || 0) + asset.value);
    });
    return [...map.entries()]
      .map(([sector, value]) => ({ sector, pct: totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [classifiedAssets, totalPortfolioValue]);

  const geographyExposure = useMemo(() => {
    const map: Record<'Domestic' | 'International' | 'Emerging', number> = {
      Domestic: 0,
      International: 0,
      Emerging: 0,
    };
    classifiedAssets.forEach((asset) => {
      map[asset.geography] += asset.value;
    });
    return {
      Domestic: totalPortfolioValue > 0 ? (map.Domestic / totalPortfolioValue) * 100 : 0,
      International: totalPortfolioValue > 0 ? (map.International / totalPortfolioValue) * 100 : 0,
      Emerging: totalPortfolioValue > 0 ? (map.Emerging / totalPortfolioValue) * 100 : 0,
    };
  }, [classifiedAssets, totalPortfolioValue]);

  const durationExposure = useMemo(() => {
    const fixed = classifiedAssets.filter((asset) => asset.classKey === 'Fixed Income');
    const total = sumBy(fixed, (asset) => asset.value);
    const buckets: Record<'0-1Y' | '1-3Y' | '3-7Y' | '7Y+', number> = {
      '0-1Y': 0,
      '1-3Y': 0,
      '3-7Y': 0,
      '7Y+': 0,
    };
    fixed.forEach((asset) => {
      const bucket = asset.durationBucket || '3-7Y';
      buckets[bucket] += asset.value;
    });
    return {
      '0-1Y': total > 0 ? (buckets['0-1Y'] / total) * 100 : 0,
      '1-3Y': total > 0 ? (buckets['1-3Y'] / total) * 100 : 0,
      '3-7Y': total > 0 ? (buckets['3-7Y'] / total) * 100 : 0,
      '7Y+': total > 0 ? (buckets['7Y+'] / total) * 100 : 0,
    };
  }, [classifiedAssets]);

  const styleExposure = useMemo(() => {
    const domestic = classifiedAssets.filter((asset) => asset.classKey === 'Domestic Equity');
    const total = sumBy(domestic, (asset) => asset.value);
    const map: Record<'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Blend', number> = {
      'Large Cap': 0,
      'Mid Cap': 0,
      'Small Cap': 0,
      Blend: 0,
    };
    domestic.forEach((asset) => {
      const style = asset.equityStyle || 'Blend';
      map[style] += asset.value;
    });
    return {
      large: total > 0 ? (map['Large Cap'] / total) * 100 : 0,
      mid: total > 0 ? (map['Mid Cap'] / total) * 100 : 0,
      small: total > 0 ? (map['Small Cap'] / total) * 100 : 0,
      blend: total > 0 ? (map.Blend / total) * 100 : 0,
    };
  }, [classifiedAssets]);

  const behaviorSignals = useMemo(() => {
    const insights: string[] = [];
    if (top5Concentration >= 55) {
      insights.push('Overconfidence / familiarity bias signal: top 5 holdings concentration is high relative to a diversified mandate.');
    }

    const highestReturnClass = ASSET_CLASS_ORDER.reduce(
      (best, key) => (CLASS_ASSUMPTIONS[key].expectedReturn > CLASS_ASSUMPTIONS[best].expectedReturn ? key : best),
      'Domestic Equity' as EngineAssetClass
    );

    const highestClassDrift = allocationRows.find((row) => row.classKey === highestReturnClass)?.deviation || 0;
    if (highestClassDrift > 5) {
      insights.push('Recency bias signal: recent winner-style exposure is overweight versus strategic target.');
    }

    if ((currentWeights['Cash / Liquid'] + currentWeights['Fixed Income']) - (targetSaa['Cash / Liquid'] + targetSaa['Fixed Income']) > 8) {
      insights.push('Loss-aversion signal: defensive assets are above target, which may cap long-term compounding.');
    }

    if (currentWeights['International Equity'] + currentWeights['Emerging Markets'] < targetSaa['International Equity'] + targetSaa['Emerging Markets'] - 5) {
      insights.push('Home-bias signal: global diversification is below target allocation.');
    }

    if (!insights.length) {
      insights.push('Behavioral profile appears disciplined. Rebalancing still reinforces systematic decision-making under stress.');
    }

    return insights;
  }, [allocationRows, currentWeights, targetSaa, top5Concentration]);

  const taxSummary = useMemo(() => {
    const sellTrades = tradeInstructions.filter((trade) => trade.action === 'Sell');
    const shortTermSell = sumBy(
      sellTrades.filter((trade) => trade.taxHint.toLowerCase().includes('short-term')),
      (trade) => trade.amount
    );
    const longTermSell = sumBy(
      sellTrades.filter((trade) => trade.taxHint.toLowerCase().includes('long-term')),
      (trade) => trade.amount
    );

    const lossHarvestCandidates = classifiedAssets
      .filter((asset) => asset.classKey !== 'Cash / Liquid' && asset.growthRate <= 4)
      .sort((a, b) => a.growthRate - b.growthRate)
      .slice(0, 4);

    return {
      shortTermSell,
      longTermSell,
      lossHarvestCandidates,
      dividendTaxNote:
        currentWeights['Fixed Income'] >= 30
          ? 'High income allocation may increase ordinary income taxation from coupons/distributions. Prefer tax-efficient wrappers where available.'
          : 'Income allocation is moderate; maintain tax-lot tracking to reduce dividend/interest drag.',
    };
  }, [tradeInstructions, classifiedAssets, currentWeights]);

  const beforeAfterChart = useMemo(
    () =>
      ASSET_CLASS_ORDER.map((classKey) => ({
        classKey,
        Before: Number(currentWeights[classKey].toFixed(2)),
        After: Number(implementationWeights[classKey].toFixed(2)),
        Target: Number(targetSaa[classKey].toFixed(2)),
      })),
    [currentWeights, implementationWeights, targetSaa]
  );

  const currentAllocationDonut = useMemo(
    () =>
      ASSET_CLASS_ORDER.filter((classKey) => currentWeights[classKey] > 0.2).map((classKey) => ({
        name: classKey,
        value: Number(currentWeights[classKey].toFixed(2)),
      })),
    [currentWeights]
  );

  const targetAllocationDonut = useMemo(
    () =>
      ASSET_CLASS_ORDER.filter((classKey) => implementationWeights[classKey] > 0.2).map((classKey) => ({
        name: classKey,
        value: Number(implementationWeights[classKey].toFixed(2)),
      })),
    [implementationWeights]
  );

  const rebalanceGapChart = useMemo(
    () =>
      ASSET_CLASS_ORDER.map((classKey) => {
        const buyGap = Math.max(0, targetSaa[classKey] - currentWeights[classKey]);
        const sellGap = Math.max(0, currentWeights[classKey] - targetSaa[classKey]);
        return {
          classKey,
          BuyNeeded: Number(buyGap.toFixed(2)),
          SellNeeded: Number(sellGap.toFixed(2)),
        };
      }),
    [targetSaa, currentWeights]
  );

  const riskReturnCurrentBubbles = useMemo(
    () =>
      ASSET_CLASS_ORDER.map((classKey) => ({
        classKey,
        volatility: CLASS_ASSUMPTIONS[classKey].volatility,
        expectedReturn: CLASS_ASSUMPTIONS[classKey].expectedReturn,
        weight: Number(currentWeights[classKey].toFixed(2)),
      })).filter((row) => row.weight > 0.1),
    [currentWeights]
  );

  const riskReturnTargetBubbles = useMemo(
    () =>
      ASSET_CLASS_ORDER.map((classKey) => ({
        classKey,
        volatility: CLASS_ASSUMPTIONS[classKey].volatility,
        expectedReturn: CLASS_ASSUMPTIONS[classKey].expectedReturn + 0.12,
        weight: Number(implementationWeights[classKey].toFixed(2)),
      })).filter((row) => row.weight > 0.1),
    [implementationWeights]
  );

  const radarData = useMemo(
    () => [
      { metric: 'Expected Return', Before: metricsBefore.expectedReturn, After: metricsAfter.expectedReturn },
      { metric: 'Volatility', Before: metricsBefore.volatility, After: metricsAfter.volatility },
      { metric: 'Downside Risk', Before: metricsBefore.downsideRisk, After: metricsAfter.downsideRisk },
      { metric: 'Beta', Before: metricsBefore.beta * 10, After: metricsAfter.beta * 10 },
      { metric: 'Drawdown', Before: metricsBefore.maxDrawdown, After: metricsAfter.maxDrawdown },
    ],
    [metricsBefore, metricsAfter]
  );

  const shockAbs = Math.abs(marketShock);
  const scenarioBeforeLossPct = scenarioLossPct(shockAbs, metricsBefore);
  const scenarioAfterLossPct = scenarioLossPct(shockAbs, metricsAfter);

  const stressTrendChart = useMemo(
    () =>
      [-40, -35, -30, -25, -20, -15, -10, -5].map((shock) => {
        const abs = Math.abs(shock);
        return {
          shock,
          Before: Number(scenarioLossPct(abs, metricsBefore).toFixed(2)),
          After: Number(scenarioLossPct(abs, metricsAfter).toFixed(2)),
        };
      }),
    [metricsBefore, metricsAfter]
  );

  const scenarioBeforeLoss = (scenarioBeforeLossPct / 100) * totalPortfolioValue;
  const scenarioAfterLoss = (scenarioAfterLossPct / 100) * totalPortfolioValue;

  const alignmentBefore = clamp(
    100 - sumBy(ASSET_CLASS_ORDER, (classKey) => Math.abs(currentWeights[classKey] - targetSaa[classKey])) * 1.1,
    0,
    100
  );
  const alignmentAfter = clamp(
    100 - sumBy(ASSET_CLASS_ORDER, (classKey) => Math.abs(implementationWeights[classKey] - targetSaa[classKey])) * 1.1,
    0,
    100
  );

  const executiveSummary = useMemo(() => {
    const largestMisalignment = [...allocationRows]
      .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))[0];

    const returnBandLow = metricsAfter.expectedReturn - metricsAfter.volatility * 0.35;
    const returnBandHigh = metricsAfter.expectedReturn + metricsAfter.volatility * 0.35;

    return {
      largestMisalignment,
      returnBandLow,
      returnBandHigh,
      volatilityImprovement: metricsAfter.volatility - metricsBefore.volatility,
      drawdownImprovement: metricsAfter.maxDrawdown - metricsBefore.maxDrawdown,
      diversificationImprovement: metricsAfter.diversificationRatio - metricsBefore.diversificationRatio,
      sharpeImprovement: metricsAfter.sharpe - metricsBefore.sharpe,
    };
  }, [allocationRows, metricsAfter, metricsBefore]);

  const customerPlan = useMemo(() => {
    const cashLiquidValue = (currentWeights['Cash / Liquid'] / 100) * totalPortfolioValue;
    const liquidityGap = Math.max(0, liquidityRequirement - cashLiquidValue);
    const totalBuyNeed = sumBy(
      allocationRows.filter((row) => row.action === 'Buy'),
      (row) => Math.abs(row.dollarMove)
    );
    const totalSellNeed = sumBy(
      allocationRows.filter((row) => row.action === 'Sell'),
      (row) => Math.abs(row.dollarMove)
    );

    const deploymentRate =
      capacityBand === 'High'
        ? 0.8
        : capacityBand === 'Moderate'
        ? 0.7
        : 0.6;

    const recommendedMonthlyDeployment = Math.max(0, monthlySurplus * deploymentRate);
    const emergencyTopupMonthly =
      liquidityGap > 0
        ? Math.min(recommendedMonthlyDeployment * 0.35, liquidityGap / 6)
        : 0;
    const monthlyInvestable = Math.max(0, recommendedMonthlyDeployment - emergencyTopupMonthly);

    const buyRows = allocationRows
      .filter((row) => row.action === 'Buy' && Math.abs(row.dollarMove) > 1)
      .sort((a, b) => Math.abs(b.dollarMove) - Math.abs(a.dollarMove));

    const monthlyClassPlan = buyRows.map((row) => ({
      classKey: row.classKey,
      monthlyAmount:
        totalBuyNeed > 0
          ? monthlyInvestable * (Math.abs(row.dollarMove) / totalBuyNeed)
          : 0,
      targetPct: row.targetPct,
      currentPct: row.currentPct,
    }));

    const planStyle =
      effectiveRisk === 'Conservative'
        ? 'Capital Preservation + Income Stability'
        : effectiveRisk === 'Moderate' || effectiveRisk === 'Balanced'
        ? 'Balanced Growth + Downside Control'
        : 'Growth Acceleration within Risk Bands';

    const reviewCadence =
      horizonYears >= 15
        ? 'Quarterly execution review and annual strategic reset.'
        : horizonYears >= 8
        ? 'Bi-monthly drift check and quarterly risk review.'
        : 'Monthly drift check with defensive guardrails.';

    const primarySell = allocationRows
      .filter((row) => row.action === 'Sell')
      .sort((a, b) => Math.abs(b.dollarMove) - Math.abs(a.dollarMove))
      .slice(0, 2);

    const primaryBuy = buyRows.slice(0, 2);

    return {
      cashLiquidValue,
      liquidityGap,
      totalBuyNeed,
      totalSellNeed,
      recommendedMonthlyDeployment,
      emergencyTopupMonthly,
      monthlyInvestable,
      monthlyClassPlan,
      planStyle,
      reviewCadence,
      primarySell,
      primaryBuy,
    };
  }, [
    currentWeights,
    totalPortfolioValue,
    liquidityRequirement,
    allocationRows,
    capacityBand,
    monthlySurplus,
    effectiveRisk,
    horizonYears,
  ]);

  const correlationTableRows = ASSET_CLASS_ORDER.map((left) => ({
    left,
    values: ASSET_CLASS_ORDER.map((right) => getCorrelation(left, right)),
  }));

  return (
    <div className="space-y-8 md:space-y-10 pb-24 animate-in fade-in duration-700">
      <section className="surface-dark rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-teal-500/20 blur-[100px]" />
        <div className="relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-teal-200">
            <ShieldCheck size={13} /> Risk-Optimized Portfolio Rebalancing Engine
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">Investment Committee View</h2>
              <p className="mt-2 max-w-3xl text-sm md:text-base text-slate-300 font-medium">
                CIO + CFA + Quant Risk + Tax + Behavioral lens applied to your entire current portfolio. Strategic allocation is calibrated to risk tolerance,
                financial capacity, liquidity needs, and downside control.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Portfolio Value</p>
                <p className="mt-1 text-lg md:text-xl font-black">{formatCurrency(totalPortfolioValue, currencyCountry)}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Risk Score</p>
                <p className="mt-1 text-lg md:text-xl font-black">{effectiveRiskScore}/10</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Risk Level</p>
                <p className="mt-1 text-sm md:text-base font-black">{effectiveRisk}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Horizon</p>
                <p className="mt-1 text-sm md:text-base font-black">{horizonYears} years</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <Target size={16} className="text-teal-600" />
            <h3 className="text-lg md:text-xl font-black tracking-tight">1) Client Profile Analysis</h3>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Risk Capacity</p>
              <p className="mt-1 text-sm font-black text-slate-900">{capacityBand}</p>
              <p className="mt-1 text-xs text-slate-600">Based on horizon ({horizonYears}y), surplus ({formatSignedPct(surplusRate * 100)}), and debt service burden ({formatPct(emiToIncome * 100)}).</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Risk Tolerance</p>
              <p className="mt-1 text-sm font-black text-slate-900">{effectiveRisk} ({toleranceBand})</p>
              <p className="mt-1 text-xs text-slate-600">Psychological tolerance from risk profile questionnaire and target growth objective.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Liquidity Requirement</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formatCurrency(liquidityRequirement, currencyCountry)}</p>
              <p className="mt-1 text-xs text-slate-600">{liquidityMonths} months of expenses retained for flexibility and contingency.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Income Need / Drawdown Tolerance</p>
              <p className="mt-1 text-sm font-black text-slate-900">Surplus {formatCurrency(monthlySurplus, currencyCountry)} / month</p>
              <p className="mt-1 text-xs text-slate-600">{drawdownToleranceFor(effectiveRisk)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">Psychological Tolerance</p>
              <p className="text-xs font-bold text-teal-900 mt-1">{toleranceBand}</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Financial Capacity</p>
              <p className="text-xs font-bold text-sky-900 mt-1">{capacityBand}</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Time Flexibility</p>
              <p className="text-xs font-bold text-amber-900 mt-1">{timeFlex}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <RefreshCw size={16} className="text-teal-600" />
            <h3 className="text-lg md:text-xl font-black tracking-tight">User Override Controls</h3>
          </div>
          <p className="mt-2 text-xs text-slate-600">Risk profile adjustment and tactical tilt are applied to target SAA before trades are generated.</p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Risk Profile Override</label>
              <select
                value={riskOverride}
                onChange={(event) => setRiskOverride(event.target.value as 'Auto' | RiskLevel)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <option value="Auto">Auto (Questionnaire)</option>
                {RISK_LEVELS.map((risk) => (
                  <option key={risk} value={risk}>{risk}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tactical Tilt</label>
                <span className="text-xs font-black text-slate-700">{growthTilt > 0 ? '+' : ''}{growthTilt.toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={growthTilt}
                onChange={(event) => setGrowthTilt(Number(event.target.value))}
                className="mt-1 w-full accent-teal-600"
              />
              <p className="text-[11px] text-slate-500">Negative = more defensive. Positive = higher growth orientation.</p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">What If Market Drops?</label>
                <span className="text-xs font-black text-slate-700">{marketShock}%</span>
              </div>
              <input
                type="range"
                min={-40}
                max={-5}
                step={1}
                value={marketShock}
                onChange={(event) => setMarketShock(Number(event.target.value))}
                className="mt-1 w-full accent-amber-500"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Before</p>
                  <p className="text-sm font-black text-slate-900">-{formatPct(scenarioBeforeLossPct, 1)}</p>
                  <p className="text-xs text-slate-600">{formatCurrency(scenarioBeforeLoss, currencyCountry)}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">After</p>
                  <p className="text-sm font-black text-emerald-900">-{formatPct(scenarioAfterLossPct, 1)}</p>
                  <p className="text-xs text-emerald-700">{formatCurrency(scenarioAfterLoss, currencyCountry)}</p>
                </div>
              </div>
              <div className="mt-3 h-[150px] rounded-xl border border-slate-200 bg-slate-50 p-2">
                <SafeResponsiveContainer>
                  <LineChart data={stressTrendChart} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                    <XAxis dataKey="shock" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                    <Tooltip formatter={(value: number) => `-${formatPct(Number(value), 1)}`} labelFormatter={(value) => `${value}% shock`} />
                    <Legend />
                    <Line type="monotone" dataKey="Before" stroke="#94a3b8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="After" stroke="#0d9488" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </SafeResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-teal-600" />
          <h3 className="text-lg md:text-xl font-black tracking-tight text-slate-900">Executive Summary</h3>
        </div>
        <p className="mt-3 text-sm text-slate-700 leading-relaxed">
          Current portfolio is most misaligned in <span className="font-black">{executiveSummary.largestMisalignment?.classKey || 'N/A'}</span>
          {executiveSummary.largestMisalignment
            ? ` with a ${formatSignedPct(executiveSummary.largestMisalignment.deviation)} deviation from strategic target.`
            : '.'}
          {' '}Implementation target rebalances only out-of-band exposures to reduce unnecessary liquidation while improving risk alignment.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Expected Return Range</p>
            <p className="mt-1 text-sm font-black text-slate-900">{formatPct(executiveSummary.returnBandLow, 1)} to {formatPct(executiveSummary.returnBandHigh, 1)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Volatility Shift</p>
            <p className={`mt-1 text-sm font-black ${executiveSummary.volatilityImprovement <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {formatSignedPct(executiveSummary.volatilityImprovement)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Diversification Ratio</p>
            <p className={`mt-1 text-sm font-black ${executiveSummary.diversificationImprovement >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {formatSignedPct(executiveSummary.diversificationImprovement)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Alignment Score</p>
            <p className="mt-1 text-sm font-black text-slate-900">{alignmentBefore.toFixed(0)} → {alignmentAfter.toFixed(0)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-teal-600" />
            <h3 className="text-lg md:text-xl font-black tracking-tight text-slate-900">Customized Customer Investment Plan</h3>
          </div>
          <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-teal-700">
            {customerPlan.planStyle}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-700 leading-relaxed">
          {state.profile.firstName || 'Customer'}, this plan is tailored to your {effectiveRisk.toLowerCase()} risk profile, {capacityBand.toLowerCase()} financial capacity,
          {` ${horizonYears}-year`} horizon, liquidity requirement, concentration risk, tax sensitivity, and market-shock resilience.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly Deployment</p>
            <p className="mt-1 text-sm font-black text-slate-900">{formatCurrency(customerPlan.recommendedMonthlyDeployment, currencyCountry)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Emergency Buffer Gap</p>
            <p className={`mt-1 text-sm font-black ${customerPlan.liquidityGap > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {formatCurrency(customerPlan.liquidityGap, currencyCountry)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rebalance Buy Need</p>
            <p className="mt-1 text-sm font-black text-slate-900">{formatCurrency(customerPlan.totalBuyNeed, currencyCountry)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rebalance Sell Need</p>
            <p className="mt-1 text-sm font-black text-slate-900">{formatCurrency(customerPlan.totalSellNeed, currencyCountry)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">12-Month Action Strategy</p>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                1. Reserve {formatCurrency(customerPlan.emergencyTopupMonthly, currencyCountry)} per month for 6 months to close liquidity gap before full growth deployment.
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                2. Deploy {formatCurrency(customerPlan.monthlyInvestable, currencyCountry)} monthly into underweight sleeves; prioritize {customerPlan.primaryBuy.map((row) => row.classKey).join(' and ') || 'target buy classes'}.
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                3. Trim overweight sleeves gradually; prioritize {customerPlan.primarySell.map((row) => row.classKey).join(' and ') || 'classes outside drift bands'} with tax-aware sequencing.
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                4. Follow review cadence: {customerPlan.reviewCadence}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly Deployment Map</p>
            <div className="mt-3 space-y-2">
              {customerPlan.monthlyClassPlan.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  No additional buy deployment required right now. Maintain current allocation and monitor drift.
                </div>
              )}
              {customerPlan.monthlyClassPlan.slice(0, 4).map((row) => (
                <div key={`monthly-${row.classKey}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-800">{row.classKey}</p>
                    <p className="text-xs font-black text-teal-700">{formatCurrency(row.monthlyAmount, currencyCountry)}</p>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-600">
                    Allocation {formatPct(row.currentPct, 1)} → {formatPct(row.targetPct, 1)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <Layers size={16} className="text-teal-600" />
            <h3 className="text-lg md:text-xl font-black tracking-tight">Allocation Visual Navigator</h3>
          </div>
          <p className="mt-2 text-xs text-slate-600">Current mix vs implementation target, using color-consistent sleeves for quick customer interpretation.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Current Allocation</p>
              <div className="mt-2 h-[220px]">
                <SafeResponsiveContainer>
                  <PieChart>
                    <Pie data={currentAllocationDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={2}>
                      {currentAllocationDonut.map((entry) => (
                        <Cell key={`current-${entry.name}`} fill={CLASS_COLOR[entry.name as EngineAssetClass]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatPct(Number(value), 1)} />
                  </PieChart>
                </SafeResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Implementation Target</p>
              <div className="mt-2 h-[220px]">
                <SafeResponsiveContainer>
                  <PieChart>
                    <Pie data={targetAllocationDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={2}>
                      {targetAllocationDonut.map((entry) => (
                        <Cell key={`target-${entry.name}`} fill={CLASS_COLOR[entry.name as EngineAssetClass]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatPct(Number(value), 1)} />
                  </PieChart>
                </SafeResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ASSET_CLASS_ORDER.map((classKey) => (
              <div key={`legend-${classKey}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CLASS_COLOR[classKey] }} />
                  <p className="text-[11px] font-black text-slate-700">{classKey}</p>
                </div>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">
                  {formatPct(currentWeights[classKey], 1)} → {formatPct(implementationWeights[classKey], 1)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <BarChart3 size={16} className="text-teal-600" />
            <h3 className="text-lg md:text-xl font-black tracking-tight">Risk-Return Bubble Map</h3>
          </div>
          <p className="mt-2 text-xs text-slate-600">Bubble size indicates portfolio weight. Overlay compares current and proposed positioning.</p>
          <div className="mt-4 h-[320px] md:h-[360px]">
            <SafeResponsiveContainer>
              <ScatterChart margin={{ top: 16, right: 20, left: 4, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis type="number" dataKey="volatility" name="Volatility" unit="%" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                <YAxis type="number" dataKey="expectedReturn" name="Expected Return" unit="%" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                <ZAxis type="number" dataKey="weight" range={[40, 520]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value: number, key) => {
                    if (key === 'weight') return `${Number(value).toFixed(1)}%`;
                    return `${Number(value).toFixed(1)}%`;
                  }}
                  labelFormatter={() => ''}
                />
                <Legend />
                <Scatter name="Current" data={riskReturnCurrentBubbles} fill="#94a3b8" />
                <Scatter name="Target" data={riskReturnTargetBubbles} fill="#0d9488" />
              </ScatterChart>
            </SafeResponsiveContainer>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reading Guide</p>
            <p className="mt-1 text-xs text-slate-700 font-semibold">Upper-right indicates higher expected return and risk. The proposed target shifts weight without pushing the overall portfolio outside your risk profile envelope.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-900">
          <Target size={16} className="text-teal-600" />
          <h3 className="text-lg md:text-xl font-black tracking-tight">Rebalance Gap Chart</h3>
        </div>
        <p className="mt-2 text-xs text-slate-600">Bars show where capital should be added or reduced to align with strategic allocation bands.</p>
        <div className="mt-4 h-[320px] md:h-[360px]">
          <SafeResponsiveContainer>
            <BarChart data={rebalanceGapChart} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="classKey" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} interval={0} angle={-18} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
              <Tooltip formatter={(value: number) => formatPct(Number(value), 2)} />
              <Legend />
              <Bar dataKey="BuyNeeded" fill="#0d9488" radius={[6, 6, 0, 0]} />
              <Bar dataKey="SellNeeded" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </SafeResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <BarChart3 size={16} className="text-teal-600" />
            <h3 className="text-lg md:text-xl font-black tracking-tight">2) Current Portfolio Deep Analysis</h3>
          </div>
          <div className="mt-4 h-[300px] md:h-[360px]">
            <SafeResponsiveContainer>
              <BarChart data={beforeAfterChart} margin={{ top: 12, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="classKey" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} interval={0} angle={-18} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                <Legend />
                <Bar dataKey="Before" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="After" fill="#0d9488" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Target" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </SafeResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Top 5 Holding Concentration</p>
              <p className={`mt-1 text-sm font-black ${top5Concentration > 50 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatPct(top5Concentration, 1)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Geographic Mix</p>
              <p className="mt-1 text-sm font-black text-slate-900">
                Domestic {formatPct(geographyExposure.Domestic, 1)} • Intl {formatPct(geographyExposure.International, 1)} • EM {formatPct(geographyExposure.Emerging, 1)}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sector Concentration</p>
              <div className="mt-1 space-y-1">
                {sectorExposure.slice(0, 4).map((sector) => (
                  <p key={sector.sector} className="text-xs text-slate-700 font-semibold">
                    {sector.sector}: {formatPct(sector.pct, 1)}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fixed-Income Duration Profile</p>
              <div className="mt-1 space-y-1">
                <p className="text-xs text-slate-700 font-semibold">0-1Y: {formatPct(durationExposure['0-1Y'], 1)}</p>
                <p className="text-xs text-slate-700 font-semibold">1-3Y: {formatPct(durationExposure['1-3Y'], 1)}</p>
                <p className="text-xs text-slate-700 font-semibold">3-7Y: {formatPct(durationExposure['3-7Y'], 1)}</p>
                <p className="text-xs text-slate-700 font-semibold">7Y+: {formatPct(durationExposure['7Y+'], 1)}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Domestic Equity Style Mix</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">Large {formatPct(styleExposure.large, 1)} • Mid {formatPct(styleExposure.mid, 1)} • Small {formatPct(styleExposure.small, 1)} • Blend {formatPct(styleExposure.blend, 1)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Over / Under Exposure Flags</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {allocationRows
                  .filter((row) => row.action !== 'Hold')
                  .slice(0, 2)
                  .map((row) => `${row.classKey} ${row.action === 'Buy' ? 'underweight' : 'overweight'}`)
                  .join(' • ') || 'Allocation is broadly aligned to target bands.'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <Layers size={16} className="text-teal-600" />
            <h3 className="text-lg md:text-xl font-black tracking-tight">Risk Metrics Snapshot</h3>
          </div>
          <div className="mt-4 h-[250px] md:h-[320px]">
            <SafeResponsiveContainer>
              <RadarChart data={radarData} outerRadius="78%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                <PolarRadiusAxis tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                <Radar name="Before" dataKey="Before" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />
                <Radar name="After" dataKey="After" stroke="#0d9488" fill="#0d9488" fillOpacity={0.22} />
                <Legend />
              </RadarChart>
            </SafeResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Beta</p>
              <p className="mt-1 text-sm font-black text-slate-900">{metricsBefore.beta.toFixed(2)} → {metricsAfter.beta.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sharpe Ratio</p>
              <p className="mt-1 text-sm font-black text-slate-900">{metricsBefore.sharpe.toFixed(2)} → {metricsAfter.sharpe.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Volatility</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formatPct(metricsBefore.volatility, 1)} → {formatPct(metricsAfter.volatility, 1)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max Drawdown (est.)</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formatPct(metricsBefore.maxDrawdown, 1)} → {formatPct(metricsAfter.maxDrawdown, 1)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-2 text-slate-900">
          <Globe2 size={16} className="text-teal-600" />
          <h3 className="text-lg md:text-xl font-black tracking-tight">Correlation Matrix (Strategic Inputs)</h3>
        </div>
        <p className="mt-2 text-xs text-slate-600">Teal intensity indicates positive correlation. Amber intensity indicates negative correlation for diversification benefit.</p>
        <table className="mt-4 w-full min-w-[900px] text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Asset Class</th>
              {ASSET_CLASS_ORDER.map((key) => (
                <th key={key} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {correlationTableRows.map((row) => (
              <tr key={row.left} className="border-t border-slate-100">
                <td className="px-3 py-2 font-black text-slate-700">{row.left}</td>
                {row.values.map((value, idx) => {
                  const tone = correlationTone(value);
                  return (
                    <td
                      key={`${row.left}-${idx}`}
                      className="px-3 py-2 text-right font-semibold"
                      style={tone}
                    >
                      {value.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-2 text-slate-900">
          <Target size={16} className="text-teal-600" />
          <h3 className="text-lg md:text-xl font-black tracking-tight">3-4) Allocation Comparison (Current vs Target)</h3>
        </div>
        <table className="mt-4 w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Asset Class</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Current %</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Target %</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Deviation</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Band</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Risk Contr. (Before → After)</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {allocationRows.map((row) => (
              <tr key={row.classKey} className="border-t border-slate-100">
                <td className="px-4 py-3 font-black text-slate-800">{row.classKey}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatPct(row.currentPct, 1)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatPct(row.targetPct, 1)}</td>
                <td className={`px-4 py-3 text-right font-black ${row.deviation > 0 ? 'text-amber-700' : row.deviation < 0 ? 'text-teal-700' : 'text-slate-500'}`}>
                  {formatSignedPct(row.deviation)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-600">±{row.deviationBand}%</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700">
                  {formatPct(metricsBefore.riskContribution[row.classKey], 1)} → {formatPct(metricsAfter.riskContribution[row.classKey], 1)}
                </td>
                <td className="px-4 py-3">
                  {row.action === 'Hold' ? (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">Hold</span>
                  ) : row.action === 'Buy' ? (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">Buy</span>
                  ) : (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">Sell</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-900">
          <ArrowUpRight size={16} className="text-teal-600" />
          <h3 className="text-lg md:text-xl font-black tracking-tight">5) Trade Recommendation Engine</h3>
        </div>
        <p className="mt-2 text-xs text-slate-600">Trades are generated from implementation allocation, prioritizing risk alignment and minimizing unnecessary liquidation.</p>
        <div className="mt-4 space-y-2">
          {tradeInstructions.length === 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              Portfolio is within deviation bands. No forced trades are required right now.
            </div>
          )}
          {tradeInstructions.map((trade, index) => (
            <div key={`${trade.instrument}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 rounded-lg p-1.5 ${trade.action === 'Buy' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {trade.action === 'Buy' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{trade.action} {formatCurrency(trade.amount, currencyCountry)} in {trade.instrument}</p>
                    <p className="text-xs text-slate-600">{trade.classKey} • {formatPct(trade.pctPortfolio, 2)} of portfolio</p>
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-600">
                  Vol impact {trade.volatilityImpact > 0 ? '+' : ''}{trade.volatilityImpact.toFixed(2)}% • Sharpe impact {trade.sharpeImpact > 0 ? '+' : ''}{trade.sharpeImpact.toFixed(3)}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-600">Tax note: {trade.taxHint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <CheckCircle2 size={16} className="text-teal-600" />
            <h3 className="text-lg md:text-xl font-black tracking-tight">6) Risk Improvement Summary (Before vs After)</h3>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Portfolio Volatility</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formatPct(metricsBefore.volatility, 1)} → {formatPct(metricsAfter.volatility, 1)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Expected Return</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formatPct(metricsBefore.expectedReturn, 1)} → {formatPct(metricsAfter.expectedReturn, 1)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sharpe Ratio</p>
              <p className="mt-1 text-sm font-black text-slate-900">{metricsBefore.sharpe.toFixed(2)} → {metricsAfter.sharpe.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max Drawdown (est.)</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formatPct(metricsBefore.maxDrawdown, 1)} → {formatPct(metricsAfter.maxDrawdown, 1)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Beta to Benchmark</p>
              <p className="mt-1 text-sm font-black text-slate-900">{metricsBefore.beta.toFixed(2)} → {metricsAfter.beta.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Diversification Ratio</p>
              <p className="mt-1 text-sm font-black text-slate-900">{metricsBefore.diversificationRatio.toFixed(2)} → {metricsAfter.diversificationRatio.toFixed(2)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            This rebalance improves consistency with your stated risk profile by reducing hidden concentration and moving risk contribution closer to strategic limits.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <Info size={16} className="text-teal-600" />
            <h3 className="text-lg md:text-xl font-black tracking-tight">7-8) Behavioral + Tax Overlay</h3>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Behavioral Insights</p>
            {behaviorSignals.map((insight, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                {insight}
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tax & Accounting Considerations</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              Estimated short-term realization: {formatCurrency(taxSummary.shortTermSell, currencyCountry)}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              Estimated long-term realization: {formatCurrency(taxSummary.longTermSell, currencyCountry)}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              {taxSummary.dividendTaxNote}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              Loss harvesting watchlist: {taxSummary.lossHarvestCandidates.length
                ? taxSummary.lossHarvestCandidates.map((item) => item.name).join(', ')
                : 'No clear low-return candidates detected.'}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-900">
          <Layers size={16} className="text-teal-600" />
          <h3 className="text-lg md:text-xl font-black tracking-tight">10) UI/UX Implementation Notes</h3>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
            Before/after comparison charts are included for allocation and risk profile overlays.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
            Soft risk coloring is used for caution states to avoid alarm-heavy visual language.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
            Simulation slider supports market drop scenarios and highlights resilience improvements.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
            Risk profile override and tactical tilt controls allow user-level overrides before execution.
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 md:p-5">
        <div className="flex items-start gap-2 text-slate-700">
          <AlertTriangle size={15} className="mt-0.5 text-amber-600" />
          <p className="text-xs md:text-sm font-semibold leading-relaxed">
            This is a model-based recommendation aligned to your stated risk profile and long-term objectives. Expected returns, volatility, and drawdown projections are
            scenario assumptions and not guarantees. Review tax lots, transaction costs, and jurisdiction-specific capital gains rules before execution.
          </p>
        </div>
      </section>
    </div>
  );
};

export default InvestmentPlan;
