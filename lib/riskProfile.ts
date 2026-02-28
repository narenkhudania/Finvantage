import type { RiskLevel, RiskProfile, RiskQuestionAnswer } from '../types';

export interface RiskQuestionOption {
  text: string;
  score: number;
}

export interface RiskQuestion {
  id: number;
  dimension: string;
  text: string;
  whyItMatters: string;
  options: RiskQuestionOption[];
}

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 1,
    dimension: 'Goal Priority',
    text: 'What is your primary goal for your investment portfolio?',
    whyItMatters: 'This tells us whether your portfolio should prioritize stability, income, or long-term growth.',
    options: [
      { text: 'Preserving capital with zero risk of loss', score: 5 },
      { text: 'Stable income with minimal fluctuations', score: 10 },
      { text: 'Balanced growth and capital preservation', score: 20 },
      { text: 'Maximum long-term wealth growth', score: 30 },
    ],
  },
  {
    id: 2,
    dimension: 'Time Horizon',
    text: 'When do you plan to start withdrawing significant funds?',
    whyItMatters: 'Longer horizons generally allow higher equity exposure and short-term volatility.',
    options: [
      { text: 'Within 1-2 years', score: 5 },
      { text: 'In 3-7 years', score: 15 },
      { text: 'In 7-12 years', score: 25 },
      { text: '15+ years from now', score: 35 },
    ],
  },
  {
    id: 3,
    dimension: 'Behavior Under Stress',
    text: 'If your portfolio dropped by 20% in one month, how would you react?',
    whyItMatters: 'Real behavior during market drawdowns is one of the strongest indicators of risk capacity.',
    options: [
      { text: 'Sell everything immediately', score: 5 },
      { text: 'Shift most funds to safer cash', score: 15 },
      { text: 'Do nothing and wait for recovery', score: 25 },
      { text: 'Invest more to buy the dip', score: 40 },
    ],
  },
  {
    id: 4,
    dimension: 'Volatility Comfort',
    text: 'Comfort level with fluctuations for higher returns?',
    whyItMatters: 'Comfort with volatility helps determine if aggressive allocation is sustainable for you.',
    options: [
      { text: 'None. I prefer guaranteed returns.', score: 0 },
      { text: 'Low. I can handle small, infrequent dips.', score: 15 },
      { text: 'Moderate. Ups/downs are part of the game.', score: 30 },
      { text: 'High. Volatility is an opportunity.', score: 45 },
    ],
  },
  {
    id: 5,
    dimension: 'Cashflow Capacity',
    text: 'Monthly investable income after expenses?',
    whyItMatters: 'Higher surplus can support market volatility and reduce the need to liquidate during downturns.',
    options: [
      { text: 'Less than 10%', score: 5 },
      { text: '10% to 25%', score: 15 },
      { text: '25% to 50%', score: 25 },
      { text: 'More than 50%', score: 35 },
    ],
  },
];

export const RISK_QUESTIONNAIRE_VERSION = 1;
export const MAX_RISK_SCORE = 185;

export const RISK_LEVEL_ALLOCATIONS: Record<RiskLevel, { equity: number; debt: number; gold: number; liquid: number }> = {
  Conservative: { equity: 15, debt: 60, gold: 5, liquid: 20 },
  Moderate: { equity: 35, debt: 45, gold: 10, liquid: 10 },
  Balanced: { equity: 55, debt: 30, gold: 10, liquid: 5 },
  Aggressive: { equity: 75, debt: 15, gold: 5, liquid: 5 },
  'Very Aggressive': { equity: 90, debt: 5, gold: 5, liquid: 0 },
};

export const RISK_LEVEL_CHARACTERISTICS: Record<RiskLevel, {
  volatilityBand: string;
  drawdownBand: string;
  goalImpact: string;
  returnNarrative: string;
  suitableHorizon: string;
}> = {
  Conservative: {
    volatilityBand: 'Low',
    drawdownBand: 'Low',
    goalImpact: 'Higher stability, but long-term goals may need larger monthly contributions.',
    returnNarrative: 'Lower growth with stronger downside protection.',
    suitableHorizon: '0-5 years',
  },
  Moderate: {
    volatilityBand: 'Low-Medium',
    drawdownBand: 'Low-Medium',
    goalImpact: 'Balanced for near-mid goals with moderate growth potential.',
    returnNarrative: 'Steady compounding with controlled volatility.',
    suitableHorizon: '5-8 years',
  },
  Balanced: {
    volatilityBand: 'Medium',
    drawdownBand: 'Medium',
    goalImpact: 'Often suitable for mixed horizons and diversified goal baskets.',
    returnNarrative: 'Good trade-off between growth and stability.',
    suitableHorizon: '8-12 years',
  },
  Aggressive: {
    volatilityBand: 'Medium-High',
    drawdownBand: 'High',
    goalImpact: 'Can accelerate long-term goal corpus if volatility is tolerated.',
    returnNarrative: 'Higher long-run return potential with larger swings.',
    suitableHorizon: '12-15 years',
  },
  'Very Aggressive': {
    volatilityBand: 'High',
    drawdownBand: 'Very High',
    goalImpact: 'Fastest long-term growth potential, but short-term goal risk is high.',
    returnNarrative: 'Maximum growth orientation with high drawdown sensitivity.',
    suitableHorizon: '15+ years',
  },
};

export const scoreToRiskLevel = (score: number): RiskLevel => {
  if (score < 25) return 'Conservative';
  if (score < 45) return 'Moderate';
  if (score < 70) return 'Balanced';
  if (score < 90) return 'Aggressive';
  return 'Very Aggressive';
};

export const buildRiskProfileFromAnswers = (
  answers: RiskQuestionAnswer[],
  nowIso: string = new Date().toISOString(),
): RiskProfile => {
  const totalScore = answers.reduce((sum, answer) => sum + (answer.score || 0), 0);
  const score = Math.min(100, Math.max(0, Math.round((totalScore / MAX_RISK_SCORE) * 100)));
  const level = scoreToRiskLevel(score);
  return {
    score,
    level,
    lastUpdated: nowIso,
    questionnaireVersion: RISK_QUESTIONNAIRE_VERSION,
    questionnaireAnswers: answers,
    recommendedAllocation: RISK_LEVEL_ALLOCATIONS[level],
  };
};
