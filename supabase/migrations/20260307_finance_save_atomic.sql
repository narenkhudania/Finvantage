begin;

create or replace function public.save_finance_data_atomic(
  p_user_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_actor uuid := auth.uid();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_risk jsonb := v_payload->'risk_profile';
  v_estate jsonb := v_payload->'estate_flags';
  v_insurance_cfg jsonb := v_payload->'insurance_analysis_config';
  v_discount_cfg jsonb := v_payload->'discount_settings';
  v_report_snapshot jsonb := v_payload->'report_snapshot';
begin
  if p_user_id is null then
    raise exception 'Missing user id.';
  end if;

  if v_actor is null then
    raise exception 'Not authenticated.';
  end if;

  if v_actor <> p_user_id and not coalesce(public.is_admin_user(v_actor), false) then
    raise exception 'Unauthorized finance save target.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  delete from public.family_members where user_id = p_user_id;
  insert into public.family_members (
    id,
    user_id,
    name,
    relation,
    age,
    is_dependent,
    include_income_in_planning,
    monthly_expenses,
    salary,
    bonus,
    reimbursements,
    business,
    rental,
    investment,
    pension,
    expected_increase,
    retirement_age,
    updated_at
  )
  select
    coalesce(row_data.id, gen_random_uuid()),
    p_user_id,
    coalesce(row_data.name, ''),
    coalesce(row_data.relation, 'Other'),
    coalesce(row_data.age, 0),
    coalesce(row_data.is_dependent, true),
    coalesce(row_data.include_income_in_planning, true),
    coalesce(row_data.monthly_expenses, 0),
    coalesce(row_data.salary, 0),
    coalesce(row_data.bonus, 0),
    coalesce(row_data.reimbursements, 0),
    coalesce(row_data.business, 0),
    coalesce(row_data.rental, 0),
    coalesce(row_data.investment, 0),
    coalesce(row_data.pension, 0),
    coalesce(row_data.expected_increase, 0),
    row_data.retirement_age,
    v_now
  from jsonb_to_recordset(coalesce(v_payload->'family_members', '[]'::jsonb)) as row_data(
    id uuid,
    name text,
    relation text,
    age integer,
    is_dependent boolean,
    include_income_in_planning boolean,
    monthly_expenses numeric,
    salary numeric,
    bonus numeric,
    reimbursements numeric,
    business numeric,
    rental numeric,
    investment numeric,
    pension numeric,
    expected_increase numeric,
    retirement_age integer
  );

  delete from public.income_profiles where user_id = p_user_id;
  insert into public.income_profiles (
    user_id,
    owner_ref,
    salary,
    bonus,
    reimbursements,
    business,
    rental,
    investment,
    pension,
    expected_increase,
    updated_at
  )
  select
    p_user_id,
    coalesce(row_data.owner_ref, 'self'),
    coalesce(row_data.salary, 0),
    coalesce(row_data.bonus, 0),
    coalesce(row_data.reimbursements, 0),
    coalesce(row_data.business, 0),
    coalesce(row_data.rental, 0),
    coalesce(row_data.investment, 0),
    coalesce(row_data.pension, 0),
    coalesce(row_data.expected_increase, 0),
    v_now
  from jsonb_to_recordset(coalesce(v_payload->'income_profiles', '[]'::jsonb)) as row_data(
    owner_ref text,
    salary numeric,
    bonus numeric,
    reimbursements numeric,
    business numeric,
    rental numeric,
    investment numeric,
    pension numeric,
    expected_increase numeric
  );

  delete from public.expenses where user_id = p_user_id;
  insert into public.expenses (
    user_id,
    category,
    amount,
    inflation_rate,
    tenure,
    start_year,
    end_year,
    frequency,
    notes,
    updated_at
  )
  select
    p_user_id,
    coalesce(row_data.category, 'General'),
    coalesce(row_data.amount, 0),
    coalesce(row_data.inflation_rate, 0),
    coalesce(row_data.tenure, 0),
    row_data.start_year,
    row_data.end_year,
    row_data.frequency,
    row_data.notes,
    v_now
  from jsonb_to_recordset(coalesce(v_payload->'expenses', '[]'::jsonb)) as row_data(
    category text,
    amount numeric,
    inflation_rate numeric,
    tenure integer,
    start_year integer,
    end_year integer,
    frequency text,
    notes text
  );

  delete from public.cashflows where user_id = p_user_id;
  insert into public.cashflows (
    id,
    user_id,
    owner_ref,
    label,
    amount,
    frequency,
    growth_rate,
    start_year,
    end_year,
    notes,
    flow_type
  )
  select
    coalesce(row_data.id, gen_random_uuid()),
    p_user_id,
    coalesce(row_data.owner_ref, 'self'),
    coalesce(row_data.label, 'Cashflow'),
    coalesce(row_data.amount, 0),
    coalesce(row_data.frequency, 'Monthly'),
    coalesce(row_data.growth_rate, 0),
    coalesce(row_data.start_year, extract(year from v_now)::integer),
    coalesce(row_data.end_year, extract(year from v_now)::integer),
    row_data.notes,
    row_data.flow_type
  from jsonb_to_recordset(coalesce(v_payload->'cashflows', '[]'::jsonb)) as row_data(
    id uuid,
    owner_ref text,
    label text,
    amount numeric,
    frequency text,
    growth_rate numeric,
    start_year integer,
    end_year integer,
    notes text,
    flow_type text
  );

  delete from public.investment_commitments where user_id = p_user_id;
  insert into public.investment_commitments (
    id,
    user_id,
    owner_ref,
    label,
    amount,
    frequency,
    step_up,
    start_year,
    end_year,
    notes
  )
  select
    coalesce(row_data.id, gen_random_uuid()),
    p_user_id,
    coalesce(row_data.owner_ref, 'self'),
    coalesce(row_data.label, 'Commitment'),
    coalesce(row_data.amount, 0),
    coalesce(row_data.frequency, 'Monthly'),
    coalesce(row_data.step_up, 0),
    coalesce(row_data.start_year, extract(year from v_now)::integer),
    coalesce(row_data.end_year, extract(year from v_now)::integer),
    row_data.notes
  from jsonb_to_recordset(coalesce(v_payload->'investment_commitments', '[]'::jsonb)) as row_data(
    id uuid,
    owner_ref text,
    label text,
    amount numeric,
    frequency text,
    step_up numeric,
    start_year integer,
    end_year integer,
    notes text
  );

  delete from public.assets where user_id = p_user_id;
  insert into public.assets (
    id,
    user_id,
    category,
    sub_category,
    name,
    owner_ref,
    current_value,
    purchase_year,
    growth_rate,
    available_for_goals,
    available_from,
    tenure,
    monthly_contribution,
    contribution_frequency,
    contribution_step_up,
    contribution_start_year,
    contribution_end_year,
    updated_at
  )
  select
    coalesce(row_data.id, gen_random_uuid()),
    p_user_id,
    coalesce(row_data.category, 'Liquid'),
    coalesce(row_data.sub_category, ''),
    coalesce(row_data.name, ''),
    coalesce(row_data.owner_ref, 'self'),
    coalesce(row_data.current_value, 0),
    coalesce(row_data.purchase_year, extract(year from v_now)::integer),
    coalesce(row_data.growth_rate, 0),
    coalesce(row_data.available_for_goals, true),
    row_data.available_from,
    row_data.tenure,
    row_data.monthly_contribution,
    row_data.contribution_frequency,
    row_data.contribution_step_up,
    row_data.contribution_start_year,
    row_data.contribution_end_year,
    v_now
  from jsonb_to_recordset(coalesce(v_payload->'assets', '[]'::jsonb)) as row_data(
    id uuid,
    category text,
    sub_category text,
    name text,
    owner_ref text,
    current_value numeric,
    purchase_year integer,
    growth_rate numeric,
    available_for_goals boolean,
    available_from integer,
    tenure integer,
    monthly_contribution numeric,
    contribution_frequency text,
    contribution_step_up numeric,
    contribution_start_year integer,
    contribution_end_year integer
  );

  delete from public.loans where user_id = p_user_id;
  insert into public.loans (
    id,
    user_id,
    type,
    owner_ref,
    source,
    source_type,
    sanctioned_amount,
    outstanding_amount,
    interest_rate,
    remaining_tenure,
    emi,
    notes,
    start_year,
    lump_sum_repayments,
    updated_at
  )
  select
    coalesce(row_data.id, gen_random_uuid()),
    p_user_id,
    coalesce(row_data.type, 'Others'),
    coalesce(row_data.owner_ref, 'self'),
    coalesce(row_data.source, ''),
    coalesce(row_data.source_type, 'Bank'),
    coalesce(row_data.sanctioned_amount, 0),
    coalesce(row_data.outstanding_amount, 0),
    coalesce(row_data.interest_rate, 0),
    coalesce(row_data.remaining_tenure, 0),
    coalesce(row_data.emi, 0),
    row_data.notes,
    row_data.start_year,
    coalesce(row_data.lump_sum_repayments, '[]'::jsonb),
    v_now
  from jsonb_to_recordset(coalesce(v_payload->'loans', '[]'::jsonb)) as row_data(
    id uuid,
    type text,
    owner_ref text,
    source text,
    source_type text,
    sanctioned_amount numeric,
    outstanding_amount numeric,
    interest_rate numeric,
    remaining_tenure integer,
    emi numeric,
    notes text,
    start_year integer,
    lump_sum_repayments jsonb
  );

  delete from public.goals where user_id = p_user_id;
  insert into public.goals (
    id,
    user_id,
    type,
    description,
    priority,
    resource_buckets,
    is_recurring,
    frequency,
    frequency_interval_years,
    start_date_type,
    start_date_value,
    end_date_type,
    end_date_value,
    target_amount_today,
    start_goal_amount,
    inflation_rate,
    current_amount,
    loan_details,
    desired_retirement_age,
    expected_monthly_expenses_after_retirement,
    retirement_handling,
    detailed_breakdown,
    updated_at
  )
  select
    coalesce(row_data.id, gen_random_uuid()),
    p_user_id,
    coalesce(row_data.type, 'Others'),
    coalesce(row_data.description, ''),
    coalesce(row_data.priority, 1),
    coalesce(row_data.resource_buckets, '{}'::text[]),
    coalesce(row_data.is_recurring, false),
    row_data.frequency,
    row_data.frequency_interval_years,
    coalesce(row_data.start_date_type, 'Year'),
    coalesce(row_data.start_date_value, extract(year from v_now)::integer),
    coalesce(row_data.end_date_type, 'Year'),
    coalesce(row_data.end_date_value, extract(year from v_now)::integer),
    coalesce(row_data.target_amount_today, 0),
    row_data.start_goal_amount,
    coalesce(row_data.inflation_rate, 0),
    coalesce(row_data.current_amount, 0),
    row_data.loan_details,
    row_data.desired_retirement_age,
    row_data.expected_monthly_expenses_after_retirement,
    row_data.retirement_handling,
    row_data.detailed_breakdown,
    v_now
  from jsonb_to_recordset(coalesce(v_payload->'goals', '[]'::jsonb)) as row_data(
    id uuid,
    type text,
    description text,
    priority integer,
    resource_buckets text[],
    is_recurring boolean,
    frequency text,
    frequency_interval_years integer,
    start_date_type text,
    start_date_value integer,
    end_date_type text,
    end_date_value integer,
    target_amount_today numeric,
    start_goal_amount numeric,
    inflation_rate numeric,
    current_amount numeric,
    loan_details jsonb,
    desired_retirement_age integer,
    expected_monthly_expenses_after_retirement numeric,
    retirement_handling text,
    detailed_breakdown jsonb
  );

  delete from public.insurances where user_id = p_user_id;
  insert into public.insurances (
    id,
    user_id,
    category,
    type,
    proposer,
    insured,
    sum_assured,
    premium,
    premium_end_year,
    maturity_date,
    is_money_back,
    money_back_years,
    money_back_amounts
  )
  select
    coalesce(row_data.id, gen_random_uuid()),
    p_user_id,
    coalesce(row_data.category, 'General Insurance'),
    coalesce(row_data.type, 'Others'),
    coalesce(row_data.proposer, 'Self'),
    coalesce(row_data.insured, 'Self'),
    coalesce(row_data.sum_assured, 0),
    coalesce(row_data.premium, 0),
    row_data.premium_end_year,
    row_data.maturity_date,
    coalesce(row_data.is_money_back, false),
    coalesce(row_data.money_back_years, '{}'::integer[]),
    coalesce(row_data.money_back_amounts, '{}'::numeric[])
  from jsonb_to_recordset(coalesce(v_payload->'insurances', '[]'::jsonb)) as row_data(
    id uuid,
    category text,
    type text,
    proposer text,
    insured text,
    sum_assured numeric,
    premium numeric,
    premium_end_year integer,
    maturity_date date,
    is_money_back boolean,
    money_back_years integer[],
    money_back_amounts numeric[]
  );

  delete from public.transactions where user_id = p_user_id;
  insert into public.transactions (
    id,
    user_id,
    date,
    description,
    amount,
    category,
    type
  )
  select
    coalesce(row_data.id, gen_random_uuid()),
    p_user_id,
    coalesce(row_data.date, v_now::date),
    coalesce(row_data.description, ''),
    coalesce(row_data.amount, 0),
    coalesce(row_data.category, 'General'),
    coalesce(row_data.type, 'expense')
  from jsonb_to_recordset(coalesce(v_payload->'transactions', '[]'::jsonb)) as row_data(
    id uuid,
    date date,
    description text,
    amount numeric,
    category text,
    type text
  );

  delete from public.notifications where user_id = p_user_id;
  insert into public.notifications (
    id,
    user_id,
    title,
    message,
    type,
    read,
    timestamp
  )
  select
    coalesce(row_data.id, gen_random_uuid()),
    p_user_id,
    coalesce(row_data.title, ''),
    coalesce(row_data.message, ''),
    coalesce(row_data.type, 'strategy'),
    coalesce(row_data.read, false),
    coalesce(row_data.timestamp, v_now)
  from jsonb_to_recordset(coalesce(v_payload->'notifications', '[]'::jsonb)) as row_data(
    id uuid,
    title text,
    message text,
    type text,
    read boolean,
    timestamp timestamptz
  );

  if jsonb_typeof(v_risk) = 'object' then
    insert into public.risk_profiles (
      user_id,
      score,
      level,
      last_updated,
      equity,
      debt,
      gold,
      liquid,
      updated_at
    )
    values (
      p_user_id,
      coalesce((v_risk->>'score')::integer, 0),
      coalesce(v_risk->>'level', 'Moderate'),
      coalesce((v_risk->>'last_updated')::timestamptz, v_now),
      coalesce((v_risk->>'equity')::integer, 0),
      coalesce((v_risk->>'debt')::integer, 0),
      coalesce((v_risk->>'gold')::integer, 0),
      coalesce((v_risk->>'liquid')::integer, 0),
      v_now
    )
    on conflict (user_id) do update
    set
      score = excluded.score,
      level = excluded.level,
      last_updated = excluded.last_updated,
      equity = excluded.equity,
      debt = excluded.debt,
      gold = excluded.gold,
      liquid = excluded.liquid,
      updated_at = excluded.updated_at;
  else
    delete from public.risk_profiles where user_id = p_user_id;
  end if;

  if jsonb_typeof(v_estate) = 'object' then
    insert into public.estate_flags (
      user_id,
      has_will,
      nominations_updated,
      updated_at
    )
    values (
      p_user_id,
      coalesce((v_estate->>'has_will')::boolean, false),
      coalesce((v_estate->>'nominations_updated')::boolean, false),
      v_now
    )
    on conflict (user_id) do update
    set
      has_will = excluded.has_will,
      nominations_updated = excluded.nominations_updated,
      updated_at = excluded.updated_at;
  end if;

  if jsonb_typeof(v_insurance_cfg) = 'object' then
    insert into public.insurance_analysis_config (
      user_id,
      inflation,
      immediate_needs,
      existing_insurance,
      liability_covers,
      goal_covers,
      asset_covers,
      inheritance_value,
      updated_at
    )
    values (
      p_user_id,
      coalesce((v_insurance_cfg->>'inflation')::numeric, 0),
      coalesce((v_insurance_cfg->>'immediate_needs')::numeric, 0),
      coalesce((v_insurance_cfg->>'existing_insurance')::numeric, 0),
      coalesce(v_insurance_cfg->'liability_covers', '{}'::jsonb),
      coalesce(v_insurance_cfg->'goal_covers', '{}'::jsonb),
      coalesce(v_insurance_cfg->'asset_covers', '{"financial":50,"personal":0,"inheritance":100}'::jsonb),
      coalesce((v_insurance_cfg->>'inheritance_value')::numeric, 0),
      v_now
    )
    on conflict (user_id) do update
    set
      inflation = excluded.inflation,
      immediate_needs = excluded.immediate_needs,
      existing_insurance = excluded.existing_insurance,
      liability_covers = excluded.liability_covers,
      goal_covers = excluded.goal_covers,
      asset_covers = excluded.asset_covers,
      inheritance_value = excluded.inheritance_value,
      updated_at = excluded.updated_at;
  end if;

  if jsonb_typeof(v_discount_cfg) = 'object' then
    insert into public.discount_settings (
      user_id,
      use_buckets,
      default_discount_rate,
      use_bucket_inflation,
      default_inflation_rate,
      buckets,
      updated_at
    )
    values (
      p_user_id,
      coalesce((v_discount_cfg->>'use_buckets')::boolean, false),
      coalesce((v_discount_cfg->>'default_discount_rate')::numeric, 0),
      coalesce((v_discount_cfg->>'use_bucket_inflation')::boolean, false),
      coalesce((v_discount_cfg->>'default_inflation_rate')::numeric, 0),
      coalesce(v_discount_cfg->'buckets', '[]'::jsonb),
      v_now
    )
    on conflict (user_id) do update
    set
      use_buckets = excluded.use_buckets,
      default_discount_rate = excluded.default_discount_rate,
      use_bucket_inflation = excluded.use_bucket_inflation,
      default_inflation_rate = excluded.default_inflation_rate,
      buckets = excluded.buckets,
      updated_at = excluded.updated_at;
  end if;

  if jsonb_typeof(v_report_snapshot) = 'object' and jsonb_typeof(v_report_snapshot->'payload') = 'object' then
    insert into public.report_snapshots (
      user_id,
      payload,
      generated_at,
      updated_at
    )
    values (
      p_user_id,
      v_report_snapshot->'payload',
      coalesce((v_report_snapshot->'payload'->>'generatedAt')::timestamptz, v_now),
      v_now
    )
    on conflict (user_id) do update
    set
      payload = excluded.payload,
      generated_at = excluded.generated_at,
      updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object(
    'saved', true,
    'saved_at', v_now
  );
end;
$$;

revoke all on function public.save_finance_data_atomic(uuid, jsonb) from public;
grant execute on function public.save_finance_data_atomic(uuid, jsonb) to authenticated;
grant execute on function public.save_finance_data_atomic(uuid, jsonb) to service_role;

commit;
