import { FinanceState, DetailedIncome, View } from '../types';

export interface JourneyStep {
  id: View;
  label: string;
  view: View;
  complete: boolean;
}

const sumIncome = (income?: Partial<DetailedIncome>) => (
  (income?.salary || 0) +
  (income?.bonus || 0) +
  (income?.reimbursements || 0) +
  (income?.business || 0) +
  (income?.rental || 0) +
  (income?.investment || 0)
);

export const getJourneySteps = (state: FinanceState): JourneyStep[] => {
  const profileIncome = state.profile?.income;
  const family = state.family || [];
  const detailedExpenses = state.detailedExpenses || [];

  const householdIncome =
    sumIncome(profileIncome) +
    family.reduce((sum, member) => sum + sumIncome(member?.income), 0);

  const hasOutflow =
    detailedExpenses.length > 0 ||
    (state.profile?.monthlyExpenses || 0) > 0;

  return [
    {
      id: 'family',
      label: 'Household Node',
      view: 'family',
      complete: (state.family || []).length > 0 || (state.profile?.firstName || '') !== '',
    },
    {
      id: 'inflow',
      label: 'Inflow Profile',
      view: 'inflow',
      complete: householdIncome > 0,
    },
    {
      id: 'outflow',
      label: 'Burn Profile',
      view: 'outflow',
      complete: hasOutflow,
    },
    {
      id: 'assets',
      label: 'Asset Inventory',
      view: 'assets',
      complete: (state.assets || []).length > 0,
    },
    {
      id: 'debt',
      label: 'Liability Map',
      view: 'debt',
      complete: (state.loans || []).length > 0,
    },
    {
      id: 'goals',
      label: 'Mission Targets',
      view: 'goals',
      complete: (state.goals || []).length > 0,
    },
  ];
};

export const getJourneyProgress = (state: FinanceState) => {
  const steps = getJourneySteps(state);
  const completionPct = Math.round(
    (steps.filter(step => step.complete).length / steps.length) * 100
  );
  const nextStep = steps.find(step => !step.complete);

  return { steps, completionPct, nextStep };
};
