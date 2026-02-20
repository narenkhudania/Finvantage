// services/dbService.ts
// Fixed: components use short random IDs (not UUIDs).
// Strategy: never send client IDs to DB. Delete + reinsert each time.
//           DB generates proper UUIDs. saveFinanceData() returns the
//           DB-assigned IDs so App.tsx can sync state immediately.

import { supabase } from './supabase';
import type {
  FinanceState,
  FamilyMember,
  DetailedIncome,
  ExpenseItem,
  CashflowItem,
  InvestmentCommitment,
  Asset,
  Loan,
  Goal,
  IncomeSource,
  Insurance,
  Transaction,
  Notification,
  RiskProfile,
  InsuranceAnalysisConfig,
} from '../types';
import { buildReportSnapshot } from '../lib/report';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string) => UUID_REGEX.test(value);

// ─────────────────────────────────────────────────────────────
// ROW ↔ TYPE MAPPERS
// ─────────────────────────────────────────────────────────────

function rowToIncome(row: Record<string, any>): DetailedIncome {
  return {
    salary:           Number(row.salary            ?? 0),
    bonus:            Number(row.bonus              ?? 0),
    reimbursements:   Number(row.reimbursements     ?? 0),
    business:         Number(row.business           ?? 0),
    rental:           Number(row.rental             ?? 0),
    investment:       Number(row.investment         ?? 0),
    expectedIncrease: Number(row.expected_increase  ?? 6),
  };
}

function incomeToColumns(inc: DetailedIncome) {
  return {
    salary:            inc.salary,
    bonus:             inc.bonus,
    reimbursements:    inc.reimbursements,
    business:          inc.business,
    rental:            inc.rental,
    investment:        inc.investment,
    expected_increase: inc.expectedIncrease,
  };
}

function rowToFamilyMember(row: Record<string, any>): FamilyMember {
  return {
    id:              row.id,                          // DB UUID — replaces client short ID
    name:            row.name,
    relation:        row.relation,
    age:             Number(row.age              ?? 0),
    isDependent:     Boolean(row.is_dependent),
    retirementAge:   row.retirement_age ?? undefined,
    monthlyExpenses: Number(row.monthly_expenses ?? 0),
    income:          rowToIncome(row),
  };
}

function rowToExpense(row: Record<string, any>): ExpenseItem {
  return {
    category:      row.category,
    amount:        Number(row.amount          ?? 0),
    inflationRate: Number(row.inflation_rate  ?? 6),
    tenure:        Number(row.tenure          ?? 34),
    startYear:     row.start_year ?? undefined,
    endYear:       row.end_year ?? undefined,
    frequency:     row.frequency ?? undefined,
    notes:         row.notes ?? undefined,
  };
}

function rowToAsset(row: Record<string, any>): Asset {
  return {
    id:                row.id,                        // DB UUID
    category:          row.category,
    subCategory:       row.sub_category,
    name:              row.name,
    owner:             row.owner_ref,
    currentValue:      Number(row.current_value       ?? 0),
    purchaseYear:      Number(row.purchase_year       ?? new Date().getFullYear()),
    growthRate:        Number(row.growth_rate         ?? 10),
    availableForGoals: Boolean(row.available_for_goals),
    availableFrom:     row.available_from ?? undefined,
    tenure:            row.tenure         ?? undefined,
    monthlyContribution:   row.monthly_contribution ?? undefined,
    contributionFrequency: row.contribution_frequency ?? undefined,
    contributionStepUp:    row.contribution_step_up ?? undefined,
    contributionStartYear: row.contribution_start_year ?? undefined,
    contributionEndYear:   row.contribution_end_year ?? undefined,
  };
}

function rowToLoan(row: Record<string, any>): Loan {
  return {
    id:                row.id,                        // DB UUID
    type:              row.type,
    owner:             row.owner_ref,
    source:            row.source,
    sourceType:        row.source_type,
    sanctionedAmount:  Number(row.sanctioned_amount   ?? 0),
    outstandingAmount: Number(row.outstanding_amount  ?? 0),
    interestRate:      Number(row.interest_rate       ?? 8.5),
    remainingTenure:   Number(row.remaining_tenure    ?? 120),
    emi:               Number(row.emi                 ?? 0),
    notes:             row.notes ?? undefined,
    startYear:         row.start_year ?? undefined,
    lumpSumRepayments: Array.isArray(row.lump_sum_repayments)
                         ? row.lump_sum_repayments : [],
  };
}

function rowToGoal(row: Record<string, any>): Goal {
  return {
    id:              row.id,                          // DB UUID
    type:            row.type,
    description:     row.description,
    priority:        Number(row.priority         ?? 1),
    resourceBuckets: row.resource_buckets         ?? [],
    isRecurring:     Boolean(row.is_recurring),
    frequency:       row.frequency ?? undefined,
    startDate:       { type: row.start_date_type, value: Number(row.start_date_value) },
    endDate:         { type: row.end_date_type,   value: Number(row.end_date_value)   },
    targetAmountToday:   Number(row.target_amount_today ?? 0),
    startGoalAmount:     row.start_goal_amount ?? undefined,
    inflationRate:       Number(row.inflation_rate      ?? 6),
    currentAmount:       Number(row.current_amount      ?? 0),
    loan:                row.loan_details ?? undefined,
    desiredRetirementAge:                    row.desired_retirement_age ?? undefined,
    expectedMonthlyExpensesAfterRetirement:  row.expected_monthly_expenses_after_retirement ?? undefined,
    retirementHandling:                      row.retirement_handling ?? undefined,
    detailedBreakdown:                       row.detailed_breakdown  ?? undefined,
  };
}

function rowToInsurance(row: Record<string, any>): Insurance {
  return {
    id: row.id,
    category: row.category,
    type: row.type,
    proposer: row.proposer,
    insured: row.insured,
    sumAssured: Number(row.sum_assured ?? 0),
    premium: Number(row.premium ?? 0),
    beginYear: row.begin_year ?? undefined,
    pptEndYear: row.ppt_end_year ?? undefined,
    maturityType: row.maturity_type ?? undefined,
    annualPremiumsLeft: row.annual_premiums_left ?? undefined,
    premiumEndYear: row.premium_end_year ?? undefined,
    maturityDate: row.maturity_date ?? undefined,
    isMoneyBack: Boolean(row.is_money_back),
    moneyBackYears: Array.isArray(row.money_back_years) ? row.money_back_years : [],
    moneyBackAmounts: Array.isArray(row.money_back_amounts) ? row.money_back_amounts : [],
    incomeFrom: row.income_from ?? undefined,
    incomeTo: row.income_to ?? undefined,
    incomeGrowth: row.income_growth ?? undefined,
    incomeType: row.income_type ?? undefined,
    incomeYear1: row.income_year_1 ?? undefined,
    incomeYear2: row.income_year_2 ?? undefined,
    incomeYear3: row.income_year_3 ?? undefined,
    incomeYear4: row.income_year_4 ?? undefined,
    sumInsured: row.sum_insured ?? undefined,
    deductible: row.deductible ?? undefined,
    thingsCovered: row.things_covered ?? undefined,
  };
}

function rowToCashflow(row: Record<string, any>): CashflowItem {
  return {
    id: row.id,
    owner: row.owner_ref,
    label: row.label,
    amount: Number(row.amount ?? 0),
    frequency: row.frequency,
    growthRate: Number(row.growth_rate ?? 0),
    startYear: Number(row.start_year ?? new Date().getFullYear()),
    endYear: Number(row.end_year ?? new Date().getFullYear()),
    notes: row.notes ?? undefined,
    flowType: row.flow_type ?? undefined,
  };
}

function rowToInvestmentCommitment(row: Record<string, any>): InvestmentCommitment {
  return {
    id: row.id,
    owner: row.owner_ref,
    label: row.label,
    amount: Number(row.amount ?? 0),
    frequency: row.frequency,
    stepUp: Number(row.step_up ?? 0),
    startYear: Number(row.start_year ?? new Date().getFullYear()),
    endYear: Number(row.end_year ?? new Date().getFullYear()),
    notes: row.notes ?? undefined,
  };
}

function rowToTransaction(row: Record<string, any>): Transaction {
  const dateValue = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;
  return {
    id: row.id,
    date: dateValue,
    description: row.description,
    amount: Number(row.amount ?? 0),
    category: row.category,
    type: row.type,
  };
}

function rowToNotification(row: Record<string, any>): Notification {
  const timestampValue = row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp;
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    read: Boolean(row.read),
    timestamp: timestampValue,
  };
}

function rowToRiskProfile(row: Record<string, any>): RiskProfile {
  return {
    score: Number(row.score ?? 0),
    level: row.level,
    lastUpdated: row.last_updated instanceof Date
      ? row.last_updated.toISOString()
      : row.last_updated,
    recommendedAllocation: {
      equity: Number(row.equity ?? 0),
      debt: Number(row.debt ?? 0),
      gold: Number(row.gold ?? 0),
      liquid: Number(row.liquid ?? 0),
    },
  };
}

function rowToEstateFlags(row: Record<string, any>) {
  return {
    hasWill: Boolean(row.has_will),
    nominationsUpdated: Boolean(row.nominations_updated),
  };
}

function rowToInsuranceAnalysis(row: Record<string, any>): InsuranceAnalysisConfig {
  return {
    inflation: Number(row.inflation ?? 0),
    investmentRate: Number(row.investment_rate ?? 0),
    replacementYears: Number(row.replacement_years ?? 0),
    immediateNeeds: Number(row.immediate_needs ?? 0),
    financialAssetDiscount: Number(row.financial_asset_discount ?? 0),
  };
}


// ─────────────────────────────────────────────────────────────
// LOAD — parallel fetch from all 6 tables on login / reload
// ─────────────────────────────────────────────────────────────
export async function loadFinanceData(
  fallback: FinanceState,
): Promise<FinanceState | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    profileRes, familyRes, incomeRes,
    expensesRes, cashflowsRes, commitmentsRes, assetsRes, loansRes, goalsRes,
    insuranceRes, transactionsRes, notificationsRes,
    riskProfileRes, estateRes, insuranceAnalysisRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('identifier,first_name,last_name,dob,life_expectancy,retirement_age,pincode,city,state,country,income_source,iq_score')
      .eq('id', user.id)
      .single(),
    supabase.from('family_members').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('income_profiles').select('*').eq('user_id', user.id),
    supabase.from('expenses').select('*').eq('user_id', user.id).order('category'),
    supabase.from('cashflows').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('investment_commitments').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('assets').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('loans').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('goals').select('*').eq('user_id', user.id).order('priority'),
    supabase.from('insurances').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('notifications').select('*').eq('user_id', user.id).order('timestamp', { ascending: false }),
    supabase.from('risk_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('estate_flags').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('insurance_analysis_config').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  if (profileRes.error || !profileRes.data) {
    console.error('[dbService] profile load failed:', profileRes.error?.message);
    return null;
  }

  const p          = profileRes.data as Record<string, any>;
  const identifier = (p.identifier as string) ?? '';
  const isMobile   = !identifier.includes('@') ||
                     identifier.includes('@auth.finvantage.app');

  // Build family with DB UUIDs
  const family: FamilyMember[] = (familyRes.data ?? []).map(rowToFamilyMember);

  // Merge income_profiles into family members (matched by owner_ref = DB UUID)
  const incomeRows = incomeRes.data ?? [];
  const selfIncomeRow = incomeRows.find((r: any) => r.owner_ref === 'self');
  const selfIncome = selfIncomeRow ? rowToIncome(selfIncomeRow) : fallback.profile.income;

  const familyWithIncome = family.map(member => {
    const incRow = incomeRows.find((r: any) => r.owner_ref === member.id);
    return incRow ? { ...member, income: rowToIncome(incRow) } : member;
  });

  return {
    ...fallback,
    isRegistered: true,
    profile: {
      firstName:      (p.first_name      as string) || fallback.profile.firstName,
      lastName:       (p.last_name       as string) || fallback.profile.lastName,
      dob:            (p.dob             as string) || fallback.profile.dob,
      email:          isMobile ? '' : identifier,
      mobile:         isMobile ? identifier : '',
      lifeExpectancy: (p.life_expectancy as number) || fallback.profile.lifeExpectancy,
      retirementAge:  (p.retirement_age  as number) || fallback.profile.retirementAge,
      pincode:        (p.pincode         as string) || fallback.profile.pincode,
      city:           (p.city            as string) || fallback.profile.city,
      state:          (p.state           as string) || fallback.profile.state,
      country:        (p.country         as string) || fallback.profile.country,
      incomeSource:   ((p.income_source  as string) || fallback.profile.incomeSource) as IncomeSource,
      iqScore:        (p.iq_score        as number) || fallback.profile.iqScore,
      income:          selfIncome,
      monthlyExpenses: fallback.profile.monthlyExpenses,
    },
    family:           familyWithIncome,
    detailedExpenses: (expensesRes.data ?? []).map(rowToExpense),
    cashflows:        (cashflowsRes.data ?? []).map(rowToCashflow),
    investmentCommitments: (commitmentsRes.data ?? []).map(rowToInvestmentCommitment),
    assets:           (assetsRes.data   ?? []).map(rowToAsset),
    loans:            (loansRes.data    ?? []).map(rowToLoan),
    goals:            (goalsRes.data    ?? []).map(rowToGoal),
    insurance:        (insuranceRes.data ?? []).map(rowToInsurance),
    insuranceAnalysis: insuranceAnalysisRes.data
      ? rowToInsuranceAnalysis(insuranceAnalysisRes.data)
      : fallback.insuranceAnalysis,
    transactions:     (transactionsRes.data ?? []).map(rowToTransaction),
    notifications:    (notificationsRes.data ?? []).map(rowToNotification),
    riskProfile:      riskProfileRes.data ? rowToRiskProfile(riskProfileRes.data) : fallback.riskProfile,
    estate:           estateRes.data ? rowToEstateFlags(estateRes.data) : fallback.estate,
  };
}


// ─────────────────────────────────────────────────────────────
// SAVE — returns DB-assigned UUIDs so App.tsx can sync state
//
// WHY DELETE + REINSERT:
//   Components generate short random IDs like "abc123def" (not UUIDs).
//   Postgres UUID columns reject those. Attempting upsert on conflict=id
//   with a non-UUID value causes a 400 Bad Request.
//
//   Solution: always delete existing rows then insert fresh ones.
//   Postgres assigns proper UUIDs. We return them so the app state
//   gets updated — subsequent saves then have real UUIDs.
//
// WHY SEQUENTIAL (not parallel):
//   income_profiles.owner_ref references family member UUIDs.
//   We must have the new family UUIDs before saving income_profiles.
// ─────────────────────────────────────────────────────────────
export async function saveFinanceData(
  state: FinanceState,
): Promise<Partial<FinanceState>> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('No active auth session.');

  const uid = user.id;
  const dbUpdates: Partial<FinanceState> = {};

  // ── Step 1: family_members (must be first — income_profiles needs UUIDs)
  try {
    const savedFamily = await saveFamilyMembers(uid, state.family);
    if (savedFamily) dbUpdates.family = savedFamily;
  } catch (err) {
    console.error('[dbService] family save failed:', err);
    throw err; // family failure is fatal — block income save below
  }

  // ── Step 2: income_profiles (uses family UUIDs from step 1)
  const familyForIncome = dbUpdates.family ?? state.family;
  try {
    await saveIncomeProfiles(uid, state.profile.income, familyForIncome);
  } catch (err) {
    console.error('[dbService] income save failed:', err);
  }

  // ── Steps 3–6: independent tables, run in parallel
  const [
    expensesRes, cashflowsRes, commitmentsRes, assetsRes, loansRes, goalsRes,
    insuranceRes, transactionsRes, notificationsRes,
    riskProfileRes, estateRes, insuranceAnalysisRes, reportSnapshotRes,
  ] = await Promise.allSettled([
    saveExpenses(uid, state.detailedExpenses),
    saveCashflows(uid, state.cashflows),
    saveInvestmentCommitments(uid, state.investmentCommitments),
    saveAssets(uid, state.assets),
    saveLoans(uid, state.loans),
    saveGoals(uid, state.goals),
    saveInsurances(uid, state.insurance),
    saveTransactions(uid, state.transactions),
    saveNotifications(uid, state.notifications ?? []),
    saveRiskProfile(uid, state.riskProfile),
    saveEstateFlags(uid, state.estate),
    saveInsuranceAnalysis(uid, state.insuranceAnalysis),
    saveReportSnapshot(uid, state),
  ]);

  if (cashflowsRes.status === 'fulfilled' && cashflowsRes.value)  dbUpdates.cashflows     = cashflowsRes.value;
  if (commitmentsRes.status === 'fulfilled' && commitmentsRes.value) dbUpdates.investmentCommitments = commitmentsRes.value;
  if (assetsRes.status === 'fulfilled' && assetsRes.value)        dbUpdates.assets        = assetsRes.value;
  if (loansRes.status === 'fulfilled' && loansRes.value)          dbUpdates.loans         = loansRes.value;
  if (goalsRes.status === 'fulfilled' && goalsRes.value)          dbUpdates.goals         = goalsRes.value;
  if (insuranceRes.status === 'fulfilled' && insuranceRes.value)  dbUpdates.insurance     = insuranceRes.value;
  if (transactionsRes.status === 'fulfilled' && transactionsRes.value) dbUpdates.transactions = transactionsRes.value;
  if (notificationsRes.status === 'fulfilled' && notificationsRes.value) dbUpdates.notifications = notificationsRes.value;

  ['expenses','cashflows','investmentCommitments','assets','loans','goals','insurances','transactions','notifications','riskProfile','estateFlags','insuranceAnalysis','reportSnapshot'].forEach((label, i) => {
    const r = [
      expensesRes, cashflowsRes, commitmentsRes, assetsRes, loansRes, goalsRes,
      insuranceRes, transactionsRes, notificationsRes,
      riskProfileRes, estateRes, insuranceAnalysisRes, reportSnapshotRes,
    ][i];
    if (r.status === 'rejected')
      console.error(`[dbService] ${label} save failed:`, (r as PromiseRejectedResult).reason);
  });

  const failures = [
    expensesRes, cashflowsRes, commitmentsRes, assetsRes, loansRes, goalsRes,
    insuranceRes, transactionsRes, notificationsRes,
    riskProfileRes, estateRes, insuranceAnalysisRes, reportSnapshotRes,
  ].filter(r => r.status === 'rejected').length;

  if (failures > 0) {
    throw new Error('One or more save operations failed.');
  }

  return dbUpdates; // App.tsx merges these back into state
}


// ─────────────────────────────────────────────────────────────
// SECTION SAVERS
// Each returns the fresh DB rows (with proper UUIDs) or void.
// ─────────────────────────────────────────────────────────────

async function saveFamilyMembers(
  uid: string,
  family: FamilyMember[],
): Promise<FamilyMember[] | null> {
  if (family.length === 0) {
    const { error: delErr } = await supabase
      .from('family_members')
      .delete()
      .eq('user_id', uid);
    if (delErr) throw delErr;
    return null;
  }

  const hasOnlyUuidIds = family.every(m => isUuid(m.id));

  const rows = family.map(m => ({
    id:               hasOnlyUuidIds ? m.id : undefined,
    user_id:          uid,
    name:             m.name,
    relation:         m.relation,
    age:              m.age,
    is_dependent:     m.isDependent,
    retirement_age:   m.retirementAge ?? null,
    monthly_expenses: m.monthlyExpenses,
    ...incomeToColumns(m.income),
  }));

  if (hasOnlyUuidIds) {
    const { error } = await supabase
      .from('family_members')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    const ids = family.map(m => m.id);
    await supabase
      .from('family_members')
      .delete()
      .eq('user_id', uid)
      .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

    return null;
  }

  // Non-UUID ids found — reset to DB-generated UUIDs
  const { error: delErr } = await supabase
    .from('family_members')
    .delete()
    .eq('user_id', uid);
  if (delErr) throw delErr;

  const { data, error } = await supabase
    .from('family_members')
    .insert(rows.map(({ id, ...rest }) => rest))
    .select();
  if (error) throw error;

  return (data ?? []).map(rowToFamilyMember);
}


async function saveIncomeProfiles(
  uid: string,
  selfIncome: DetailedIncome,
  family: FamilyMember[], // use DB UUIDs from saveFamilyMembers result
): Promise<void> {
  const rows = [
    { user_id: uid, owner_ref: 'self', ...incomeToColumns(selfIncome) },
    ...family.map(m => ({
      user_id:   uid,
      owner_ref: m.id,           // now a real UUID
      ...incomeToColumns(m.income),
    })),
  ];

  // UPSERT by unique(user_id, owner_ref) — safe because 'self' never changes
  // and family UUIDs are now real DB UUIDs
  const { error } = await supabase
    .from('income_profiles')
    .upsert(rows, { onConflict: 'user_id,owner_ref' });
  if (error) throw error;

  // Clean up stale entries for removed family members
  if (family.length > 0) {
    const validRefs = ['self', ...family.map(m => m.id)];
    await supabase
      .from('income_profiles')
      .delete()
      .eq('user_id', uid)
      .not('owner_ref', 'in', `(${validRefs.map(r => `"${r}"`).join(',')})`);
  }
}


async function saveExpenses(
  uid: string,
  expenses: ExpenseItem[],
): Promise<void> {
  // Upsert by (user_id, category) — safe, category is a stable string key
  if (expenses.length === 0) {
    await supabase.from('expenses').delete().eq('user_id', uid);
    return;
  }
  const rows = expenses.map(e => ({
    user_id:        uid,
    category:       e.category,
    amount:         e.amount,
    inflation_rate: e.inflationRate,
    tenure:         e.tenure,
    start_year:     e.startYear ?? null,
    end_year:       e.endYear ?? null,
    frequency:      e.frequency ?? null,
    notes:          e.notes ?? null,
  }));
  const { error } = await supabase
    .from('expenses')
    .upsert(rows, { onConflict: 'user_id,category' });
  if (error) throw error;
}

async function saveCashflows(
  uid: string,
  cashflows: CashflowItem[],
): Promise<CashflowItem[] | null> {
  if (cashflows.length === 0) {
    await supabase.from('cashflows').delete().eq('user_id', uid);
    return null;
  }

  const hasOnlyUuidIds = cashflows.every(c => isUuid(c.id));

  const rows = cashflows.map(c => ({
    id:         hasOnlyUuidIds ? c.id : undefined,
    user_id:    uid,
    owner_ref:  c.owner,
    label:      c.label,
    amount:     c.amount,
    frequency:  c.frequency,
    growth_rate: c.growthRate,
    start_year: c.startYear,
    end_year:   c.endYear,
    notes:      c.notes ?? null,
    flow_type:  c.flowType ?? null,
  }));

  if (hasOnlyUuidIds) {
    const { error } = await supabase
      .from('cashflows')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    const ids = cashflows.map(c => c.id);
    await supabase
      .from('cashflows')
      .delete()
      .eq('user_id', uid)
      .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

    return null;
  }

  await supabase.from('cashflows').delete().eq('user_id', uid);

  const { data, error } = await supabase
    .from('cashflows')
    .insert(rows.map(({ id, ...rest }) => rest))
    .select();
  if (error) throw error;
  return (data ?? []).map(rowToCashflow);
}

async function saveInvestmentCommitments(
  uid: string,
  commitments: InvestmentCommitment[],
): Promise<InvestmentCommitment[] | null> {
  if (commitments.length === 0) {
    await supabase.from('investment_commitments').delete().eq('user_id', uid);
    return null;
  }

  const hasOnlyUuidIds = commitments.every(c => isUuid(c.id));

  const rows = commitments.map(c => ({
    id:         hasOnlyUuidIds ? c.id : undefined,
    user_id:    uid,
    owner_ref:  c.owner,
    label:      c.label,
    amount:     c.amount,
    frequency:  c.frequency,
    step_up:    c.stepUp,
    start_year: c.startYear,
    end_year:   c.endYear,
    notes:      c.notes ?? null,
  }));

  if (hasOnlyUuidIds) {
    const { error } = await supabase
      .from('investment_commitments')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    const ids = commitments.map(c => c.id);
    await supabase
      .from('investment_commitments')
      .delete()
      .eq('user_id', uid)
      .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

    return null;
  }

  await supabase.from('investment_commitments').delete().eq('user_id', uid);

  const { data, error } = await supabase
    .from('investment_commitments')
    .insert(rows.map(({ id, ...rest }) => rest))
    .select();
  if (error) throw error;
  return (data ?? []).map(rowToInvestmentCommitment);
}


async function saveAssets(
  uid: string,
  assets: Asset[],
): Promise<Asset[] | null> {
  if (assets.length === 0) {
    await supabase.from('assets').delete().eq('user_id', uid);
    return null;
  }

  const hasOnlyUuidIds = assets.every(a => isUuid(a.id));

  const rows = assets.map(a => ({
    id:                  hasOnlyUuidIds ? a.id : undefined,
    user_id:             uid,
    category:            a.category,
    sub_category:        a.subCategory,
    name:                a.name,
    owner_ref:           a.owner,
    current_value:       a.currentValue,
    purchase_year:       a.purchaseYear,
    growth_rate:         a.growthRate,
    available_for_goals: a.availableForGoals,
    available_from:      a.availableFrom ?? null,
    tenure:              a.tenure ?? null,
    monthly_contribution:    a.monthlyContribution ?? null,
    contribution_frequency:  a.contributionFrequency ?? null,
    contribution_step_up:    a.contributionStepUp ?? null,
    contribution_start_year: a.contributionStartYear ?? null,
    contribution_end_year:   a.contributionEndYear ?? null,
  }));

  if (hasOnlyUuidIds) {
    const { error } = await supabase
      .from('assets')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    const ids = assets.map(a => a.id);
    await supabase
      .from('assets')
      .delete()
      .eq('user_id', uid)
      .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

    return null;
  }

  await supabase.from('assets').delete().eq('user_id', uid);

  const { data, error } = await supabase
    .from('assets')
    .insert(rows.map(({ id, ...rest }) => rest))
    .select();
  if (error) throw error;
  return (data ?? []).map(rowToAsset);
}


async function saveLoans(
  uid: string,
  loans: Loan[],
): Promise<Loan[] | null> {
  if (loans.length === 0) {
    await supabase.from('loans').delete().eq('user_id', uid);
    return null;
  }

  const hasOnlyUuidIds = loans.every(l => isUuid(l.id));

  const rows = loans.map(l => ({
    id:                 hasOnlyUuidIds ? l.id : undefined,
    user_id:            uid,
    type:               l.type,
    owner_ref:          l.owner,
    source:             l.source,
    source_type:        l.sourceType,
    sanctioned_amount:  l.sanctionedAmount,
    outstanding_amount: l.outstandingAmount,
    interest_rate:      l.interestRate,
    remaining_tenure:   l.remainingTenure,
    emi:                l.emi,
    notes:              l.notes ?? null,
    start_year:         l.startYear ?? null,
    lump_sum_repayments: l.lumpSumRepayments ?? [],
  }));

  if (hasOnlyUuidIds) {
    const { error } = await supabase
      .from('loans')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    const ids = loans.map(l => l.id);
    await supabase
      .from('loans')
      .delete()
      .eq('user_id', uid)
      .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

    return null;
  }

  await supabase.from('loans').delete().eq('user_id', uid);

  const { data, error } = await supabase
    .from('loans')
    .insert(rows.map(({ id, ...rest }) => rest))
    .select();
  if (error) throw error;
  return (data ?? []).map(rowToLoan);
}


async function saveGoals(
  uid: string,
  goals: Goal[],
): Promise<Goal[] | null> {
  if (goals.length === 0) {
    await supabase.from('goals').delete().eq('user_id', uid);
    return null;
  }

  const hasOnlyUuidIds = goals.every(g => isUuid(g.id));

  const rows = goals.map(g => ({
    id:               hasOnlyUuidIds ? g.id : undefined,
    user_id:          uid,
    type:             g.type,
    description:      g.description,
    priority:         g.priority,
    resource_buckets: g.resourceBuckets,
    is_recurring:     g.isRecurring,
    frequency:        g.frequency ?? null,
    start_date_type:  g.startDate.type,
    start_date_value: g.startDate.value,
    end_date_type:    g.endDate.type,
    end_date_value:   g.endDate.value,
    target_amount_today:   g.targetAmountToday,
    start_goal_amount:     g.startGoalAmount ?? null,
    inflation_rate:        g.inflationRate,
    current_amount:        g.currentAmount,
    loan_details:          g.loan ?? null,
    desired_retirement_age:                    g.desiredRetirementAge ?? null,
    expected_monthly_expenses_after_retirement: g.expectedMonthlyExpensesAfterRetirement ?? null,
    retirement_handling:                       g.retirementHandling ?? null,
    detailed_breakdown:                        g.detailedBreakdown  ?? null,
  }));

  if (hasOnlyUuidIds) {
    const { error } = await supabase
      .from('goals')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    const ids = goals.map(g => g.id);
    await supabase
      .from('goals')
      .delete()
      .eq('user_id', uid)
      .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

    return null;
  }

  await supabase.from('goals').delete().eq('user_id', uid);

  const { data, error } = await supabase
    .from('goals')
    .insert(rows.map(({ id, ...rest }) => rest))
    .select();
  if (error) throw error;
  return (data ?? []).map(rowToGoal);
}

async function saveInsurances(
  uid: string,
  policies: Insurance[],
): Promise<Insurance[] | null> {
  if (policies.length === 0) {
    await supabase.from('insurances').delete().eq('user_id', uid);
    return null;
  }

  const hasOnlyUuidIds = policies.every(p => isUuid(p.id));

  const rows = policies.map(p => ({
    id:                 hasOnlyUuidIds ? p.id : undefined,
    user_id:            uid,
    category:           p.category,
    type:               p.type,
    proposer:           p.proposer,
    insured:            p.insured,
    sum_assured:        p.sumAssured,
    premium:            p.premium,
    begin_year:         p.beginYear ?? null,
    ppt_end_year:       p.pptEndYear ?? null,
    maturity_type:      p.maturityType ?? null,
    annual_premiums_left: p.annualPremiumsLeft ?? null,
    premium_end_year:   p.premiumEndYear ?? null,
    maturity_date:      p.maturityDate ?? null,
    is_money_back:      p.isMoneyBack,
    money_back_years:   p.moneyBackYears ?? [],
    money_back_amounts: p.moneyBackAmounts ?? [],
    income_from:        p.incomeFrom ?? null,
    income_to:          p.incomeTo ?? null,
    income_growth:      p.incomeGrowth ?? null,
    income_type:        p.incomeType ?? null,
    income_year_1:      p.incomeYear1 ?? null,
    income_year_2:      p.incomeYear2 ?? null,
    income_year_3:      p.incomeYear3 ?? null,
    income_year_4:      p.incomeYear4 ?? null,
    sum_insured:        p.sumInsured ?? null,
    deductible:         p.deductible ?? null,
    things_covered:     p.thingsCovered ?? null,
  }));

  if (hasOnlyUuidIds) {
    const { error } = await supabase
      .from('insurances')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    const ids = policies.map(p => p.id);
    await supabase
      .from('insurances')
      .delete()
      .eq('user_id', uid)
      .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

    return null;
  }

  await supabase.from('insurances').delete().eq('user_id', uid);

  const { data, error } = await supabase
    .from('insurances')
    .insert(rows.map(({ id, ...rest }) => rest))
    .select();
  if (error) throw error;
  return (data ?? []).map(rowToInsurance);
}

async function saveTransactions(
  uid: string,
  transactions: Transaction[],
): Promise<Transaction[] | null> {
  if (transactions.length === 0) {
    await supabase.from('transactions').delete().eq('user_id', uid);
    return null;
  }

  const hasOnlyUuidIds = transactions.every(t => isUuid(t.id));

  const rows = transactions.map(t => ({
    id:          hasOnlyUuidIds ? t.id : undefined,
    user_id:     uid,
    date:        t.date,
    description: t.description,
    amount:      t.amount,
    category:    t.category,
    type:        t.type,
  }));

  if (hasOnlyUuidIds) {
    const { error } = await supabase
      .from('transactions')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    const ids = transactions.map(t => t.id);
    await supabase
      .from('transactions')
      .delete()
      .eq('user_id', uid)
      .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

    return null;
  }

  await supabase.from('transactions').delete().eq('user_id', uid);

  const { data, error } = await supabase
    .from('transactions')
    .insert(rows.map(({ id, ...rest }) => rest))
    .select();
  if (error) throw error;
  return (data ?? []).map(rowToTransaction);
}

async function saveNotifications(
  uid: string,
  notifications: Notification[],
): Promise<Notification[] | null> {
  if (notifications.length === 0) {
    await supabase.from('notifications').delete().eq('user_id', uid);
    return null;
  }

  const hasOnlyUuidIds = notifications.every(n => isUuid(n.id));

  const rows = notifications.map(n => ({
    id:         hasOnlyUuidIds ? n.id : undefined,
    user_id:    uid,
    title:      n.title,
    message:    n.message,
    type:       n.type,
    read:       n.read,
    timestamp:  n.timestamp,
  }));

  if (hasOnlyUuidIds) {
    const { error } = await supabase
      .from('notifications')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    const ids = notifications.map(n => n.id);
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', uid)
      .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

    return null;
  }

  await supabase.from('notifications').delete().eq('user_id', uid);

  const { data, error } = await supabase
    .from('notifications')
    .insert(rows.map(({ id, ...rest }) => rest))
    .select();
  if (error) throw error;
  return (data ?? []).map(rowToNotification);
}

async function saveRiskProfile(
  uid: string,
  riskProfile?: RiskProfile,
): Promise<void> {
  if (!riskProfile) {
    await supabase.from('risk_profiles').delete().eq('user_id', uid);
    return;
  }

  const { error } = await supabase
    .from('risk_profiles')
    .upsert({
      user_id: uid,
      score: riskProfile.score,
      level: riskProfile.level,
      last_updated: riskProfile.lastUpdated,
      equity: riskProfile.recommendedAllocation.equity,
      debt: riskProfile.recommendedAllocation.debt,
      gold: riskProfile.recommendedAllocation.gold,
      liquid: riskProfile.recommendedAllocation.liquid,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function saveEstateFlags(
  uid: string,
  estate: FinanceState['estate'],
): Promise<void> {
  const { error } = await supabase
    .from('estate_flags')
    .upsert({
      user_id: uid,
      has_will: estate.hasWill,
      nominations_updated: estate.nominationsUpdated,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function saveInsuranceAnalysis(
  uid: string,
  config: InsuranceAnalysisConfig,
): Promise<void> {
  const { error } = await supabase
    .from('insurance_analysis_config')
    .upsert({
      user_id: uid,
      inflation: config.inflation,
      investment_rate: config.investmentRate,
      replacement_years: config.replacementYears,
      immediate_needs: config.immediateNeeds,
      financial_asset_discount: config.financialAssetDiscount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function saveReportSnapshot(
  uid: string,
  state: FinanceState,
): Promise<void> {
  const payload = buildReportSnapshot(state);
  const { error } = await supabase
    .from('report_snapshots')
    .upsert({
      user_id: uid,
      payload,
      generated_at: payload.generatedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw error;
}
