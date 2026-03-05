import { GoogleGenAI } from "@google/genai";
import { withBillingAuth } from "./billing/_auth";
import { BILLING_POLICY } from "./billing/_config";
import { computeAccessStateRule } from "../lib/billingRules.mjs";

const DEFAULT_MODEL = process.env.AI_ADVISOR_MODEL || "gemini-3-pro-preview";
const MAX_PROMPT_CHARS = 2400;
const MAX_BODY_CHARS = 200_000;
const MAX_REQUEST_ID_CHARS = 120;
const DEFAULT_RATE_LIMIT_MINUTE = Number(process.env.AI_ADVISOR_RATE_LIMIT_MINUTE || 8);
const DEFAULT_RATE_LIMIT_DAILY = Number(process.env.AI_ADVISOR_RATE_LIMIT_DAILY || 120);

const safeNumber = (value: unknown, fallback = 0) => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const readHeader = (req: any, name: string): string => {
  const direct = req?.headers?.[name] ?? req?.headers?.[name.toLowerCase()];
  const value = Array.isArray(direct) ? direct[0] : direct;
  return typeof value === "string" ? value.trim() : "";
};

const setNoStoreHeaders = (res: any) => {
  if (typeof res?.setHeader !== "function") return;
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
};

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
};

const getAllowedOrigins = () => {
  const configured = [
    process.env.APP_BASE_URL,
    process.env.PUBLIC_APP_URL,
    process.env.VITE_API_BASE_URL,
    process.env.WEBHOOK_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]
    .map((origin) => normalizeOrigin(origin || ""))
    .filter(Boolean);
  return new Set(configured);
};

const isAllowedOrigin = (originHeader: string) => {
  if (!originHeader) return true;
  const origin = normalizeOrigin(originHeader);
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.has(origin);
};

const isJsonContentType = (req: any) => {
  const contentType = readHeader(req, "content-type").toLowerCase();
  return contentType.includes("application/json");
};

const getBodyChars = (body: unknown) => {
  try {
    return JSON.stringify(body || {}).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const toMonthlyAmount = (amount: unknown, frequency: unknown) => {
  const value = safeNumber(amount, 0);
  const freq = String(frequency || "monthly").toLowerCase();
  if (freq.includes("annual") || freq.includes("year")) return value / 12;
  if (freq.includes("quarter")) return value / 3;
  if (freq.includes("week")) return (value * 52) / 12;
  if (freq.includes("day")) return value * 30;
  return value;
};

const sumIncomeFields = (row: Record<string, any> | null | undefined) => {
  if (!row) return 0;
  return (
    safeNumber(row.salary, 0) +
    safeNumber(row.bonus, 0) +
    safeNumber(row.reimbursements, 0) +
    safeNumber(row.business, 0) +
    safeNumber(row.rental, 0) +
    safeNumber(row.investment, 0) +
    safeNumber(row.pension, 0)
  );
};

const resolveGoalYear = (
  endDateType: unknown,
  endDateValue: unknown,
  birthYear: number,
  retirementAge: number,
  lifeExpectancy: number
) => {
  const goalType = String(endDateType || "year").toLowerCase();
  const value = safeNumber(endDateValue, birthYear + 5);
  if (goalType === "age") return birthYear + value;
  if (goalType === "retirement") return birthYear + retirementAge + value;
  if (goalType === "lifeexpectancy" || goalType === "life_expectancy") {
    return birthYear + lifeExpectancy + value;
  }
  return value;
};

const redactSensitiveTokens = (text: string) => {
  return text
    .replace(/\bAIza[0-9A-Za-z\-_]{20,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bsk-[A-Za-z0-9]{20,}\b/g, "[REDACTED_SECRET]")
    .replace(/\bsb_(?:publishable|secret)_[A-Za-z0-9\-_]+\b/g, "[REDACTED_SUPABASE_KEY]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_TOKEN]");
};

const getClientIp = (req: any) => {
  const forwarded = readHeader(req, "x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  const realIp = readHeader(req, "x-real-ip");
  return realIp || null;
};

const resolveAdvisorBillingAccess = async (client: any, userId: string) => {
  const [subscriptionRes, overrideRes, billingProfileRes] = await Promise.all([
    client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("billing_admin_overrides")
      .select("ends_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .gt("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("user_billing_profiles")
      .select("trial_end_at,trial_consumed")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (subscriptionRes.error) throw new Error(subscriptionRes.error.message || "Billing subscription check failed.");
  if (overrideRes.error) throw new Error(overrideRes.error.message || "Billing override check failed.");
  if (billingProfileRes.error) throw new Error(billingProfileRes.error.message || "Billing profile check failed.");

  const trialEnd = billingProfileRes.data?.trial_end_at
    ? new Date(String(billingProfileRes.data.trial_end_at)).getTime()
    : null;
  const trialActive =
    Boolean(trialEnd && trialEnd > Date.now()) &&
    billingProfileRes.data?.trial_consumed !== true;

  if (trialActive) {
    return { allowed: true, accessState: "active", reason: "trial_active" };
  }

  const access = computeAccessStateRule(
    subscriptionRes.data || null,
    overrideRes.data?.ends_at ? String(overrideRes.data.ends_at) : null,
    BILLING_POLICY
  );
  return {
    allowed: access.accessState !== "blocked",
    accessState: access.accessState,
    reason: access.reason,
  };
};

const loadCanonicalAdvisorContext = async (client: any, userId: string) => {
  const [
    profileRes,
    incomeRes,
    familyRes,
    assetsRes,
    loansRes,
    goalsRes,
    riskRes,
    expensesRes,
  ] = await Promise.all([
    client.from("profiles").select("*").eq("id", userId).maybeSingle(),
    client.from("income_profiles").select("*").eq("user_id", userId),
    client.from("family_members").select("*").eq("user_id", userId),
    client.from("assets").select("*").eq("user_id", userId),
    client.from("loans").select("*").eq("user_id", userId),
    client.from("goals").select("*").eq("user_id", userId),
    client.from("risk_profiles").select("*").eq("user_id", userId).maybeSingle(),
    client.from("expenses").select("*").eq("user_id", userId),
  ]);

  if (profileRes.error || !profileRes.data) {
    throw new Error(profileRes.error?.message || "Profile is unavailable.");
  }
  if (incomeRes.error) throw new Error(incomeRes.error.message || "Income data is unavailable.");
  if (familyRes.error) throw new Error(familyRes.error.message || "Family data is unavailable.");
  if (assetsRes.error) throw new Error(assetsRes.error.message || "Asset data is unavailable.");
  if (loansRes.error) throw new Error(loansRes.error.message || "Loan data is unavailable.");
  if (goalsRes.error) throw new Error(goalsRes.error.message || "Goal data is unavailable.");
  if (riskRes.error) throw new Error(riskRes.error.message || "Risk profile is unavailable.");
  if (expensesRes.error) throw new Error(expensesRes.error.message || "Expense data is unavailable.");

  const profile = profileRes.data as Record<string, any>;
  const incomeRows = (incomeRes.data || []) as Record<string, any>[];
  const familyRows = (familyRes.data || []) as Record<string, any>[];
  const assetsRows = (assetsRes.data || []) as Record<string, any>[];
  const loanRows = (loansRes.data || []) as Record<string, any>[];
  const goalRows = (goalsRes.data || []) as Record<string, any>[];
  const expenseRows = (expensesRes.data || []) as Record<string, any>[];
  const riskRow = (riskRes.data || null) as Record<string, any> | null;

  const totalAssets = assetsRows.reduce((sum, row) => sum + safeNumber(row.current_value, 0), 0);
  const totalLoans = loanRows.reduce((sum, row) => sum + safeNumber(row.outstanding_amount, 0), 0);
  const netWorth = totalAssets - totalLoans;

  const selfIncomeRow =
    incomeRows.find((row) => String(row.owner_ref || "").toLowerCase() === "self") ||
    incomeRows[0] ||
    null;
  const selfIncome = sumIncomeFields(selfIncomeRow);
  const familyIncome = familyRows.reduce((sum, row) => {
    const includeIncome = row.include_income_in_planning !== false && row.is_dependent !== true;
    if (!includeIncome) return sum;
    return sum + sumIncomeFields(row);
  }, 0);
  const householdIncome = selfIncome + familyIncome;

  const baseExpenses = expenseRows.reduce(
    (sum, row) => sum + toMonthlyAmount(row.amount, row.frequency),
    0
  );
  const familyExpenses = familyRows.reduce(
    (sum, row) => sum + safeNumber(row.monthly_expenses, 0),
    0
  );
  const householdExpenses = baseExpenses + familyExpenses;
  const monthlySurplus = householdIncome - householdExpenses;

  const currentYear = new Date().getFullYear();
  const birthYear = profile.dob ? new Date(profile.dob).getFullYear() : currentYear - 30;
  const retirementAge = safeNumber(profile.retirement_age, 60);
  const lifeExpectancy = safeNumber(profile.life_expectancy, 85);

  const incomeBreakdown = familyRows.map((row) => ({
    name: String(row.name || "Family Member"),
    relation: String(row.relation || "Other"),
    total: sumIncomeFields(row),
    increase: safeNumber(row.expected_increase, 0),
  }));

  const activeGoals = goalRows.slice(0, 20).map((goal) => {
    const deadline = resolveGoalYear(
      goal.end_date_type,
      goal.end_date_value,
      birthYear,
      retirementAge,
      lifeExpectancy
    );
    return `${String(goal.description || goal.type || "Goal")} (Target: ₹${safeNumber(
      goal.target_amount_today,
      0
    )}, Saved: ₹${safeNumber(goal.current_amount, 0)}, Deadline: ${deadline})`;
  });

  const riskInfo = riskRow
    ? `Risk Appetite: ${String(riskRow.level || "Unknown")} (Score: ${safeNumber(
        riskRow.score,
        0
      )}/100). Recommended Equity: ${safeNumber(riskRow.equity, 0)}%`
    : "Risk Profile: Not yet assessed.";

  const summary = {
    netWorth,
    monthlySurplus,
    activeGoals,
    familySize: familyRows.length + 1,
    incomeBreakdown,
    riskInfo,
  };

  const assumptionSnapshot = {
    inflationRatePct: 4,
    incomeGrowthRatePct: safeNumber(selfIncomeRow?.expected_increase, 0),
    retirementAge,
    lifeExpectancy,
  };

  const suitabilityInputs = {
    netWorth,
    monthlySurplus,
    householdIncome,
    householdExpenses,
    householdMembers: summary.familySize,
    activeGoalsCount: goalRows.length,
    riskLevel: riskRow?.level || "pending",
    riskScore: riskRow?.score ?? null,
  };

  const disclosureSnapshot = {
    generatedAt: new Date().toISOString(),
    jurisdiction: profile.country || "India",
    advisoryType: "educational_decision_support",
    executionSupport: false,
    disclosures: [
      "Output is generated from server-side financial records and model assumptions.",
      "This is not legal, tax, or regulated investment execution advice.",
      "Market returns, inflation, and cashflow projections are uncertain and may differ materially.",
      "Review recommendations with a licensed advisor before executing transactions.",
    ],
    assumptions: assumptionSnapshot,
    suitabilityInputs,
  };

  const advisoryInputSnapshot = {
    source: "server_db",
    profile: {
      country: profile.country || "India",
      retirementAge,
      lifeExpectancy,
      incomeExpectedIncreasePct: safeNumber(selfIncomeRow?.expected_increase, 0),
    },
    household: {
      memberCount: summary.familySize,
      incomeBreakdown,
    },
    portfolio: {
      totalAssets,
      totalLoans,
      netWorth,
    },
    cashflow: {
      monthlyIncome: householdIncome,
      monthlyExpenses: householdExpenses,
      monthlySurplus,
    },
    goals: goalRows.map((goal) => ({
      type: goal.type,
      description: goal.description,
      isRecurring: goal.is_recurring,
      targetAmountToday: safeNumber(goal.target_amount_today, 0),
      currentAmount: safeNumber(goal.current_amount, 0),
      endDateType: goal.end_date_type,
      endDateValue: goal.end_date_value,
    })),
    riskProfile: riskRow
      ? {
          level: riskRow.level,
          score: safeNumber(riskRow.score, 0),
          recommendedAllocation: {
            equity: safeNumber(riskRow.equity, 0),
            debt: safeNumber(riskRow.debt, 0),
            gold: safeNumber(riskRow.gold, 0),
            liquid: safeNumber(riskRow.liquid, 0),
          },
        }
      : null,
  };

  return {
    profile,
    summary,
    assumptionSnapshot,
    suitabilityInputs,
    disclosureSnapshot,
    advisoryInputSnapshot,
    riskRow,
  };
};

export default async function handler(req: any, res: any) {
  setNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  if (!isJsonContentType(req)) {
    res.status(415).json({ error: "Unsupported Content-Type. Use application/json." });
    return;
  }

  if (getBodyChars(req.body) > MAX_BODY_CHARS) {
    res.status(413).json({ error: "Request payload is too large." });
    return;
  }

  const origin = readHeader(req, "origin");
  if (!isAllowedOrigin(origin)) {
    res.status(403).json({ error: "Origin is not allowed for this endpoint." });
    return;
  }

  const ctx = await withBillingAuth(req, res);
  if (!ctx) return;

  try {
    const billingAccess = await resolveAdvisorBillingAccess(ctx.client, ctx.user.id);
    if (!billingAccess.allowed) {
      res.status(402).json({
        error: "AI advisor requires an active subscription.",
        code: "BILLING_PAYWALL_REQUIRED",
        accessState: billingAccess.accessState,
        reason: billingAccess.reason,
        action: {
          cta: "Subscribe Now",
          href: "/pricing",
        },
      });
      return;
    }
  } catch (billingErr) {
    console.error("AI billing gate check failed:", billingErr);
    res.status(503).json({
      error: "AI advisor is temporarily unavailable. Please retry.",
      code: "AI_BILLING_GATE_UNAVAILABLE",
    });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "AI service is not configured." });
    return;
  }

  const { prompt, requestId } = (req.body || {}) as {
    prompt?: string;
    requestId?: string;
  };

  if (typeof prompt !== "string") {
    res.status(400).json({ error: "Invalid request payload." });
    return;
  }

  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }
  if (normalizedPrompt.length > MAX_PROMPT_CHARS) {
    res.status(400).json({ error: `Prompt exceeds ${MAX_PROMPT_CHARS} characters.` });
    return;
  }

  const sanitizedPrompt = redactSensitiveTokens(normalizedPrompt);

  const ai = new GoogleGenAI({ apiKey });

  try {
    const { data: quotaRaw, error: quotaError } = await ctx.client.rpc(
      "ai_advice_consume_quota",
      {
        p_user_id: ctx.user.id,
        p_minute_limit: Math.max(1, safeNumber(DEFAULT_RATE_LIMIT_MINUTE, 8)),
        p_daily_limit: Math.max(1, safeNumber(DEFAULT_RATE_LIMIT_DAILY, 120)),
      }
    );

    if (quotaError) {
      const message = quotaError.message || "";
      if (message.toLowerCase().includes("ai_advice_consume_quota")) {
        res
          .status(500)
          .json({ error: "AI security controls are not initialized. Run latest migrations." });
        return;
      }
      throw quotaError;
    }

    const quota =
      quotaRaw && typeof quotaRaw === "object"
        ? (quotaRaw as Record<string, any>)
        : {};

    if (!quota.allowed) {
      res.status(429).json({
        error: "AI advisor request limit reached. Please retry shortly.",
        reason: quota.reason || "rate_limited",
        minuteRemaining: safeNumber(quota.minuteRemaining, 0),
        dailyRemaining: safeNumber(quota.dailyRemaining, 0),
      });
      return;
    }

    const advisorContext = await loadCanonicalAdvisorContext(ctx.client, ctx.user.id);

    const systemInstruction = `
      You are FinVantage, an AI financial planning assistant.
      Use only the provided user context and avoid generic outputs.
      You must:
      1. Explain key tradeoffs in plain language first.
      2. Present numeric estimates with assumptions.
      3. Include downside risks and what can invalidate the recommendation.
      4. Avoid guaranteeing returns or outcomes.
      5. Never request passwords, API keys, OTPs, or sensitive credentials.

      User Context:
      - Household Net Worth: ₹${advisorContext.summary.netWorth}
      - Combined Monthly Surplus: ₹${advisorContext.summary.monthlySurplus}
      - ${advisorContext.summary.riskInfo}
      - Family Details: ${advisorContext.summary.familySize} members.
      - Active Goals: ${advisorContext.summary.activeGoals.join(", ") || "None"}
      - Income Growth Assumption: ${advisorContext.assumptionSnapshot.incomeGrowthRatePct}%
      - Inflation Assumption: ${advisorContext.assumptionSnapshot.inflationRatePct}%

      Response format:
      - Summary
      - Recommendation
      - Tradeoffs
      - Next action
    `;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: sanitizedPrompt,
      config: {
        systemInstruction,
        temperature: 0.45,
      },
    });

    const adviceText =
      response.text || "I'm sorry, I couldn't generate advice at this time.";

    const advisoryRationale = {
      method: "server_canonical_context_v1",
      recommendationBasis: advisorContext.suitabilityInputs,
      dataCoverage: {
        hasRiskProfile: Boolean(advisorContext.riskRow),
        goalsIncluded: advisorContext.summary.activeGoals.length > 0,
        familyIncluded: advisorContext.summary.familySize > 1,
      },
      assumptions: advisorContext.assumptionSnapshot,
      rateLimits: {
        minuteRemaining: safeNumber(quota.minuteRemaining, 0),
        dailyRemaining: safeNumber(quota.dailyRemaining, 0),
      },
      limitations: [
        "Advice is sensitive to completeness and accuracy of stored user data.",
        "Forward-looking projections can diverge under market volatility or income shocks.",
      ],
    };

    const normalizedRequestId =
      typeof requestId === "string" && requestId.trim().length > 0
        ? requestId.trim().slice(0, MAX_REQUEST_ID_CHARS)
        : null;

    const clientIp = getClientIp(req);

    const { data: eventId, error: eventError } = await ctx.client.rpc(
      "insert_advice_recommendation_event",
      {
        p_user_id: ctx.user.id,
        p_request_id: normalizedRequestId,
        p_advice_channel: "ai_advisor",
        p_user_prompt: sanitizedPrompt,
        p_input_snapshot: advisorContext.advisoryInputSnapshot,
        p_disclosure_snapshot: advisorContext.disclosureSnapshot,
        p_recommendation_text: adviceText,
        p_recommendation_rationale: advisoryRationale,
        p_model_provider: "google",
        p_model_name: DEFAULT_MODEL,
        p_model_version: null,
        p_temperature: 0.45,
        p_metadata: {
          app: "finvantage",
          source: "api/ai-advice",
          origin: normalizeOrigin(origin),
          clientIp,
        },
      }
    );

    if (eventError || !eventId) {
      console.error("Advice compliance trail write failed:", eventError?.message || eventError);
      res
        .status(500)
        .json({ error: "Could not persist advisory compliance trail. Please retry." });
      return;
    }

    void ctx.client.from("activity_events").insert({
      user_id: ctx.user.id,
      event_name: "ai_advice.generated",
      source: "api.ai-advice",
      metadata: {
        adviceEventId: eventId,
        model: DEFAULT_MODEL,
        minuteRemaining: safeNumber(quota.minuteRemaining, 0),
        dailyRemaining: safeNumber(quota.dailyRemaining, 0),
      },
      event_time: new Date().toISOString(),
    });

    res.status(200).json({
      text: adviceText,
      adviceEventId: eventId,
      disclosureSnapshot: advisorContext.disclosureSnapshot,
      rateLimit: {
        minuteRemaining: safeNumber(quota.minuteRemaining, 0),
        dailyRemaining: safeNumber(quota.dailyRemaining, 0),
      },
    });
  } catch (error) {
    console.error(
      "AI advice request failed:",
      error instanceof Error ? error.message : String(error)
    );
    res
      .status(500)
      .json({ error: "Error: Could not reach the financial intelligence service." });
  }
}
