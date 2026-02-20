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
  Asset,
  Loan,
  Goal,
  IncomeSource,
} from '../types';

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
    inflationRate:       Number(row.inflation_rate      ?? 6),
    currentAmount:       Number(row.current_amount      ?? 0),
    desiredRetirementAge:                    row.desired_retirement_age ?? undefined,
    expectedMonthlyExpensesAfterRetirement:  row.expected_monthly_expenses_after_retirement ?? undefined,
    retirementHandling:                      row.retirement_handling ?? undefined,
    detailedBreakdown:                       row.detailed_breakdown  ?? undefined,
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
    expensesRes, assetsRes, loansRes, goalsRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('identifier,first_name,last_name,dob,life_expectancy,retirement_age,pincode,city,state,country,income_source,iq_score')
      .eq('id', user.id)
      .single(),
    supabase.from('family_members').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('income_profiles').select('*').eq('user_id', user.id),
    supabase.from('expenses').select('*').eq('user_id', user.id).order('category'),
    supabase.from('assets').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('loans').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('goals').select('*').eq('user_id', user.id).order('priority'),
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
    assets:           (assetsRes.data   ?? []).map(rowToAsset),
    loans:            (loansRes.data    ?? []).map(rowToLoan),
    goals:            (goalsRes.data    ?? []).map(rowToGoal),
    insurance:        fallback.insurance,
    estate:           fallback.estate,
    transactions:     fallback.transactions,
    notifications:    fallback.notifications,
    riskProfile:      fallback.riskProfile,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

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
  const [expensesRes, assetsRes, loansRes, goalsRes] = await Promise.allSettled([
    saveExpenses(uid, state.detailedExpenses),
    saveAssets(uid, state.assets),
    saveLoans(uid, state.loans),
    saveGoals(uid, state.goals),
  ]);

  if (assetsRes.status === 'fulfilled' && assetsRes.value) dbUpdates.assets = assetsRes.value;
  if (loansRes.status === 'fulfilled' && loansRes.value)   dbUpdates.loans  = loansRes.value;
  if (goalsRes.status === 'fulfilled' && goalsRes.value)   dbUpdates.goals  = goalsRes.value;

  ['expenses','assets','loans','goals'].forEach((label, i) => {
    const r = [expensesRes, assetsRes, loansRes, goalsRes][i];
    if (r.status === 'rejected')
      console.error(`[dbService] ${label} save failed:`, (r as PromiseRejectedResult).reason);
  });

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
  }));
  const { error } = await supabase
    .from('expenses')
    .upsert(rows, { onConflict: 'user_id,category' });
  if (error) throw error;
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
    inflation_rate:        g.inflationRate,
    current_amount:        g.currentAmount,
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
