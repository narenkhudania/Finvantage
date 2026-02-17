
import { GoogleGenAI } from "@google/genai";
import { FinanceState, DetailedIncome, RelativeDate } from "../types";

const calculateTotalMemberIncome = (income: DetailedIncome) => {
  return (income.salary || 0) + (income.bonus || 0) + (income.reimbursements || 0) + 
         (income.business || 0) + (income.rental || 0) + (income.investment || 0);
};

export const getFinancialAdvice = async (state: FinanceState, userPrompt: string) => {
  // Always initialize client within the function to ensure up-to-date environment variables
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const totalAssets = state.assets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalLoans = state.loans.reduce((sum, l) => sum + l.outstandingAmount, 0);
  const netWorth = totalAssets - totalLoans;
  
  const householdIncome = calculateTotalMemberIncome(state.profile.income) + 
                          state.family.reduce((sum, f) => sum + calculateTotalMemberIncome(f.income), 0);
  const householdExpenses = state.profile.monthlyExpenses + state.family.reduce((sum, f) => sum + f.monthlyExpenses, 0);
  const monthlySurplus = householdIncome - householdExpenses;

  const currentYear = new Date().getFullYear();
  const birthYear = state.profile.dob ? new Date(state.profile.dob).getFullYear() : currentYear - 30;

  const resolveYear = (rel: RelativeDate): number => {
    switch (rel.type) {
      case 'Year': return rel.value;
      case 'Age': return birthYear + rel.value;
      case 'Retirement': return birthYear + state.profile.retirementAge + rel.value;
      case 'LifeExpectancy': return birthYear + state.profile.lifeExpectancy + rel.value;
      default: return rel.value;
    }
  };

  const incomeBreakdown = state.family.map(f => ({
    name: f.name,
    relation: f.relation,
    total: calculateTotalMemberIncome(f.income),
    increase: f.income.expectedIncrease
  }));

  const riskInfo = state.riskProfile 
    ? `Risk Appetite: ${state.riskProfile.level} (Score: ${state.riskProfile.score}/100). Recommended Equity: ${state.riskProfile.recommendedAllocation.equity}%`
    : "Risk Profile: Not yet assessed.";

  const summary = {
    netWorth,
    monthlySurplus,
    activeGoals: state.goals.map(g => `${g.description} (Target: $${g.targetAmountToday}, Saved: $${g.currentAmount}, Deadline: ${resolveYear(g.endDate)})`),
    familySize: state.family.length + 1,
    incomeBreakdown,
    riskInfo
  };

  const systemInstruction = `
    You are FinVantage, an elite AI Financial Strategist. 
    User Context:
    - Household Net Worth: $${summary.netWorth}
    - Combined Monthly Surplus: $${summary.monthlySurplus}
    - ${summary.riskInfo}
    - Family Details: ${summary.familySize} members. Individual incomes: ${JSON.stringify(summary.incomeBreakdown)}
    - Active Goals: ${summary.activeGoals.join(', ')}

    Your Tasks:
    1. 10-Year Affordability: If a user asks "Can I afford X?", project their cash flow for the next 10 years. 
       Account for income increases (~${state.profile.income.expectedIncrease}% avg) and inflation (~4%).
       Tell them if the purchase delays retirement or educational goals.
    2. Risk-Adjusted Advice: Always factor in their ${state.riskProfile?.level || 'Moderate'} risk tolerance. If they are Conservative, suggest more debt/gold. If Aggressive, suggest more equity.
    3. Retirement Timing: Be specific. Tell them how many years/months until they hit their FIRE number or sustainable drawdown.
    4. Employment Benefits: Factor in reimbursements and bonuses as "safety buffers" vs core cash flow.

    Tone: Sharp, professional, numbers-first. Use Markdown. Bold key figures.
  `;

  try {
    // Upgrading to gemini-3-pro-preview for complex financial math and strategy tasks
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "I'm sorry, I couldn't generate advice at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error: Could not reach the financial intelligence service.";
  }
};
