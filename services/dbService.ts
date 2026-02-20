// services/dbService.ts
// Handles all DB reads/writes for the 6 normalized finance tables.
// Called by App.tsx — no changes needed in any section component.
//
// Tables:
//   family_members   ← Household Node   (family[])
//   income_profiles  ← Inflow Profile   (profile.income + family[].income)
//   expenses         ← Burn Profile     (detailedExpenses[])
//   assets           ← Asset Inventory  (assets[])
//   loans            ← Liability Map    (loans[])
//   goals            ← Mission Targets  (goals[])

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

// ─────────────────────────────────────────────────────────────
// HELPERS — map DB rows ↔ TypeScript types
// ─────────────────────────────────────────────────────────────

/** DB row → DetailedIncome */
function rowToIncome(row: Record<string, any>): DetailedIncome {
  return {
    salary:           Number(row.salary           ?? 0),
    bonus:            Number(row.bonus             ?? 0),
    reimbursements:   Number(row.reimbursements    ?? 0),
    business:         Number(row.business          ?? 0),
    rental:           Number(row.rental            ?? 0),
    investment:       Number(row.investment        ?? 0),
    expectedIncrease: Number(row.expected_increase ?? 6),
  };
}

/** DetailedIncome → DB columns */
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

/** DB row → FamilyMember */
function rowToFamilyMember(row: Record<string, any>): FamilyMember {
  return {
    id:              row.id,
    name:            row.name,
    relation:        row.relation,
    age:             Number(row.age ?? 0),
    isDependent:     row.is_dependent,
    monthlyExpenses: Number(row.monthly_expenses ?? 0),
    income:          rowToIncome(row),
  };
}

/** DB row → ExpenseItem */
function rowToExpense(row: Record<string, any>): ExpenseItem {
  return {
    category:      row.category,
    amount:        Number(row.amount         ?? 0),
    inflationRate: Number(row.inflation_rate ?? 6),
    tenure:        Number(row.tenure         ?? 34),
    startYear:     row.start_year ?? undefined,
  };
}

/** DB row → Asset */
function rowToAsset(row: Record<string, any>): Asset {
  return {
    id:                 row.id,
    category:           row.category,
    subCategory:        row.sub_category,
    name:               row.name,
    owner:              row.owner_ref,
    currentValue:       Number(row.current_value       ?? 0),
    purchaseYear:       Number(row.purchase_year        ?? new Date().getFullYear()),
    growthRate:         Number(row.growth_rate          ?? 10),
    availableForGoals:  row.available_for_goals,
    availableFrom:      row.available_from ?? undefined,
    tenure:             row.tenure ?? undefined,
  };
}

/** DB row → Loan */
function rowToLoan(row: Record<string, any>): Loan {
  return {
    id:                 row.id,
    type:               row.type,
    owner:              row.owner_ref,
    source:             row.source,
    sourceType:         row.source_type,
    sanctionedAmount:   Number(row.sanctioned_amount  ?? 0),
    outstandingAmount:  Number(row.outstanding_amount ?? 0),
    interestRate:       Number(row.interest_rate      ?? 8.5),
    remainingTenure:    Number(row.remaining_tenure   ?? 120),
    emi:                Number(row.emi                ?? 0),
    notes:              row.notes ?? undefined,
    lumpSumRepayments:  Array.isArray(row.lump_sum_repayments)
                          ? row.lump_sum_repayments
                          : [],
  };
}

/** DB row → Goal */
function rowToGoal(row: Record<string, any>): Goal {
  return {
    id:              row.id,
    type:            row.type,
    description:     row.description,
    priority:        Number(row.priority ?? 1),
    resourceBuckets: row.resource_buckets ?? [],
    isRecurring:     row.is_recurring,
    frequency:       row.frequency ?? undefined,
    startDate:       { type: row.start_date_type, value: Number(row.start_date_value) },
    endDate:         { type: row.end_date_type,   value: Number(row.end_date_value)   },
    targetAmountToday:    Number(row.target_amount_today ?? 0),
    inflationRate:        Number(row.inflation_rate      ?? 6),
    currentAmount:        Number(row.current_amount      ?? 0),
    desiredRetirementAge:                     row.desired_retirement_age ?? undefined,
    expectedMonthlyExpensesAfterRetirement:   row.expected_monthly_expenses_after_retirement ?? undefined,
    retirementHandling:                       row.retirement_handling ?? undefined,
    detailedBreakdown:                        row.detailed_breakdown ?? undefined,
  };
}


// ─────────────────────────────────────────────────────────────
// LOAD — read all 6 tables in parallel on login / page reload
// ─────────────────────────────────────────────────────────────
export async function loadFinanceData(
  fallback: FinanceState,
): Promise<FinanceState | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch profile identity + all 6 section tables in parallel
  const [
    profileRes,
    familyRes,
    incomeRes,
    expensesRes,
    assetsRes,
    loansRes,
    goalsRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('identifier,first_name,last_name,dob,life_expectancy,retirement_age,pincode,city,state,country,income_source,iq_score,onboarding_done')
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

  // ── Build family members ──────────────────────────────────────
  const family: FamilyMember[] = (familyRes.data ?? []).map(rowToFamilyMember);

  // ── Merge income from income_profiles into the right owner ────
  const incomeRows: Record<string, any>[] = incomeRes.data ?? [];

  // Self income
  const selfIncomeRow = incomeRows.find(r => r.owner_ref === 'self');
  const selfIncome: DetailedIncome = selfIncomeRow
    ? rowToIncome(selfIncomeRow)
    : fallback.profile.income;

  // Family member income (override income pulled from family_members table)
  const familyWithIncome = family.map(member => {
    const incRow = incomeRows.find(r => r.owner_ref === member.id);
    return incRow ? { ...member, income: rowToIncome(incRow) } : member;
  });

  return {
    ...fallback,
    isRegistered: true,

    profile: {
      // Identity columns
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
      // Finance fields
      income:          selfIncome,
      monthlyExpenses: fallback.profile.monthlyExpenses,
    },

    family:           familyWithIncome,
    detailedExpenses: (expensesRes.data ?? []).map(rowToExpense),
    assets:           (assetsRes.data   ?? []).map(rowToAsset),
    loans:            (loansRes.data    ?? []).map(rowToLoan),
    goals:            (goalsRes.data    ?? []).map(rowToGoal),

    // Sections without dedicated tables — keep from fallback/localStorage
    insurance:        fallback.insurance,
    estate:           fallback.estate,
    transactions:     fallback.transactions,
    notifications:    fallback.notifications,
    riskProfile:      fallback.riskProfile,
  };
}


// ─────────────────────────────────────────────────────────────
// SAVE — diffed upserts so we only write what changed
// Called with a 1.5s debounce after every state change in App.tsx
// ─────────────────────────────────────────────────────────────
export async function saveFinanceData(state: FinanceState): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const uid = user.id;

  // Run all section saves concurrently
  const results = await Promise.allSettled([
    saveFamilyMembers(uid, state),
    saveIncomeProfiles(uid, state),
    saveExpenses(uid, state),
    saveAssets(uid, state),
    saveLoans(uid, state),
    saveGoals(uid, state),
  ]);

  // Surface any errors (non-blocking — partial saves still useful)
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const labels = ['family','income','expenses','assets','loans','goals'];
      console.error(`[dbService] ${labels[i]} save failed:`, r.reason);
    }
  });

  // If ALL sections failed, throw so App.tsx shows the error pill
  if (results.every(r => r.status === 'rejected')) {
    throw new Error('All section saves failed');
  }
}


// ── Section savers ────────────────────────────────────────────

async function saveFamilyMembers(uid: string, state: FinanceState) {
  const members = state.family;

  if (members.length === 0) {
    // Delete all existing rows if user removed everyone
    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('user_id', uid);
    if (error) throw error;
    return;
  }

  const rows = members.map(m => ({
    id:               m.id,
    user_id:          uid,
    name:             m.name,
    relation:         m.relation,
    age:              m.age,
    is_dependent:     m.isDependent,
    monthly_expenses: m.monthlyExpenses,
    ...incomeToColumns(m.income),
  }));

  const { error } = await supabase
    .from('family_members')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw error;

  // Delete rows for members that were removed
  const ids = members.map(m => m.id);
  const { error: delErr } = await supabase
    .from('family_members')
    .delete()
    .eq('user_id', uid)
    .not('id', 'in', `(${ids.join(',')})`);
  if (delErr) throw delErr;
}


async function saveIncomeProfiles(uid: string, state: FinanceState) {
  // Build one row per person: self + each family member
  const rows = [
    // Self
    {
      user_id:   uid,
      owner_ref: 'self',
      ...incomeToColumns(state.profile.income),
    },
    // Family members
    ...state.family.map(m => ({
      user_id:   uid,
      owner_ref: m.id,
      ...incomeToColumns(m.income),
    })),
  ];

  const { error } = await supabase
    .from('income_profiles')
    .upsert(rows, { onConflict: 'user_id,owner_ref' });
  if (error) throw error;

  // Clean up income rows for removed family members
  const validOwners = ['self', ...state.family.map(m => m.id)];
  const { error: delErr } = await supabase
    .from('income_profiles')
    .delete()
    .eq('user_id', uid)
    .not('owner_ref', 'in', `(${validOwners.join(',')})`);
  if (delErr) throw delErr;
}


async function saveExpenses(uid: string, state: FinanceState) {
  const expenses = state.detailedExpenses;

  if (expenses.length === 0) {
    const { error } = await supabase.from('expenses').delete().eq('user_id', uid);
    if (error) throw error;
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


async function saveAssets(uid: string, state: FinanceState) {
  const assets = state.assets;

  if (assets.length === 0) {
    const { error } = await supabase.from('assets').delete().eq('user_id', uid);
    if (error) throw error;
    return;
  }

  const rows = assets.map(a => ({
    id:                  a.id,
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

  const { error } = await supabase
    .from('assets')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw error;

  // Remove deleted assets
  const ids = assets.map(a => a.id);
  const { error: delErr } = await supabase
    .from('assets')
    .delete()
    .eq('user_id', uid)
    .not('id', 'in', `(${ids.join(',')})`);
  if (delErr) throw delErr;
}


async function saveLoans(uid: string, state: FinanceState) {
  const loans = state.loans;

  if (loans.length === 0) {
    const { error } = await supabase.from('loans').delete().eq('user_id', uid);
    if (error) throw error;
    return;
  }

  const rows = loans.map(l => ({
    id:                  l.id,
    user_id:             uid,
    type:                l.type,
    owner_ref:           l.owner,
    source:              l.source,
    source_type:         l.sourceType,
    sanctioned_amount:   l.sanctionedAmount,
    outstanding_amount:  l.outstandingAmount,
    interest_rate:       l.interestRate,
    remaining_tenure:    l.remainingTenure,
    emi:                 l.emi,
    notes:               l.notes ?? null,
    lump_sum_repayments: l.lumpSumRepayments ?? [],
  }));

  const { error } = await supabase
    .from('loans')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw error;

  const ids = loans.map(l => l.id);
  const { error: delErr } = await supabase
    .from('loans')
    .delete()
    .eq('user_id', uid)
    .not('id', 'in', `(${ids.join(',')})`);
  if (delErr) throw delErr;
}


async function saveGoals(uid: string, state: FinanceState) {
  const goals = state.goals;

  if (goals.length === 0) {
    const { error } = await supabase.from('goals').delete().eq('user_id', uid);
    if (error) throw error;
    return;
  }

  const rows = goals.map(g => ({
    id:               g.id,
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

    desired_retirement_age:                     g.desiredRetirementAge ?? null,
    expected_monthly_expenses_after_retirement:  g.expectedMonthlyExpensesAfterRetirement ?? null,
    retirement_handling:                        g.retirementHandling ?? null,
    detailed_breakdown:                         g.detailedBreakdown ?? null,
  }));

  const { error } = await supabase
    .from('goals')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw error;

  const ids = goals.map(g => g.id);
  const { error: delErr } = await supabase
    .from('goals')
    .delete()
    .eq('user_id', uid)
    .not('id', 'in', `(${ids.join(',')})`);
  if (delErr) throw delErr;
}
