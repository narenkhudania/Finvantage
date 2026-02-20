import { GoogleGenAI } from "@google/genai";
import type { FinanceState, DetailedIncome, RelativeDate } from "../types";

const calculateTotalMemberIncome = (income: DetailedIncome) => {
  return (
    (income.salary || 0) +
    (income.bonus || 0) +
    (income.reimbursements || 0) +
    (income.business || 0) +
    (income.rental || 0) +
    (income.investment || 0)
  );
};

const safeNumber = (value: unknown, fallback = 0) => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const resolveYear = (
  rel: RelativeDate,
  birthYear: number,
  retirementAge: number,
  lifeExpectancy: number
): number => {
  switch (rel.type) {
    case "Year":
      return rel.value;
    case "Age":
      return birthYear + rel.value;
    case "Retirement":
      return birthYear + retirementAge + rel.value;
    case "LifeExpectancy":
      return birthYear + lifeExpectancy + rel.value;
    default:
      return rel.value;
  }
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing GEMINI_API_KEY." });
    return;
  }

  const { state, prompt } = (req.body || {}) as {
    state?: FinanceState;
    prompt?: string;
  };

  if (!state || !prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Invalid request payload." });
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  const totalAssets = (state.assets || []).reduce(
    (sum, a) => sum + safeNumber(a.currentValue),
    0
  );
  const totalLoans = (state.loans || []).reduce(
    (sum, l) => sum + safeNumber(l.outstandingAmount),
    0
  );
  const netWorth = totalAssets - totalLoans;

  const householdIncome =
    calculateTotalMemberIncome(state.profile.income) +
    (state.family || []).reduce(
      (sum, f) => sum + calculateTotalMemberIncome(f.income),
      0
    );

  const householdExpenses =
    safeNumber(state.profile.monthlyExpenses) +
    (state.family || []).reduce(
      (sum, f) => sum + safeNumber(f.monthlyExpenses),
      0
    );

  const monthlySurplus = householdIncome - householdExpenses;

  const currentYear = new Date().getFullYear();
  const birthYear = state.profile.dob
    ? new Date(state.profile.dob).getFullYear()
    : currentYear - 30;

  const incomeBreakdown = (state.family || []).map((f) => ({
    name: f.name,
    relation: f.relation,
    total: calculateTotalMemberIncome(f.income),
    increase: f.income.expectedIncrease,
  }));

  const riskInfo = state.riskProfile
    ? `Risk Appetite: ${state.riskProfile.level} (Score: ${state.riskProfile.score}/100). Recommended Equity: ${state.riskProfile.recommendedAllocation.equity}%`
    : "Risk Profile: Not yet assessed.";

  const summary = {
    netWorth,
    monthlySurplus,
    activeGoals: (state.goals || []).map((g) => {
      const deadline = resolveYear(
        g.endDate,
        birthYear,
        state.profile.retirementAge,
        state.profile.lifeExpectancy
      );
      return `${g.description} (Target: $${g.targetAmountToday}, Saved: $${g.currentAmount}, Deadline: ${deadline})`;
    }),
    familySize: (state.family || []).length + 1,
    incomeBreakdown,
    riskInfo,
  };

  const systemInstruction = `
    You are FinVantage, an elite AI Financial Strategist. 
    User Context:
    - Household Net Worth: $${summary.netWorth}
    - Combined Monthly Surplus: $${summary.monthlySurplus}
    - ${summary.riskInfo}
    - Family Details: ${summary.familySize} members. Individual incomes: ${JSON.stringify(
      summary.incomeBreakdown
    )}
    - Active Goals: ${summary.activeGoals.join(", ")}

    Your Tasks:
    1. 10-Year Affordability: If a user asks "Can I afford X?", project their cash flow for the next 10 years. 
       Account for income increases (~${state.profile.income.expectedIncrease}% avg) and inflation (~4%).
       Tell them if the purchase delays retirement or educational goals.
    2. Risk-Adjusted Advice: Always factor in their ${
      state.riskProfile?.level || "Moderate"
    } risk tolerance. If they are Conservative, suggest more debt/gold. If Aggressive, suggest more equity.
    3. Retirement Timing: Be specific. Tell them how many years/months until they hit their FIRE number or sustainable drawdown.
    4. Employment Benefits: Factor in reimbursements and bonuses as "safety buffers" vs core cash flow.

    Tone: Sharp, professional, numbers-first. Use Markdown. Bold key figures.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res
      .status(200)
      .json({ text: response.text || "I'm sorry, I couldn't generate advice at this time." });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res
      .status(500)
      .json({ error: "Error: Could not reach the financial intelligence service." });
  }
}
