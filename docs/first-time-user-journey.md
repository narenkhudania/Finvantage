# First-Time User Journey and Financial Planning Assist

## 1) Journey Goal
Help a new user reach a confident first financial plan in one guided session, then move them into a repeatable monthly planning rhythm.

Primary activation target:
- User completes setup journey to 100% (Household, Inflow, Outflow, Assets, Liabilities, Goals).
- User gets a first actionable plan from Risk Profile + Insurance + Cashflow + Action Plan.

---

## 2) End-to-End Journey (Aligned to Current App)

### Phase A: Entry and Trust (Landing -> Auth -> Onboarding)
User intent: "Can I trust this and get value quickly?"

Flow:
1. `Landing` -> user clicks `Start Free Planning`.
2. `Onboarding` auth path:
   - Identifier (email)
   - Login or Sign Up
3. Onboarding steps:
   - `Trust`
   - `Birth Date` (required)
   - `Planning Timeline` (retirement age + life expectancy; income source optional)
   - `Location` (optional, can skip/remind later)
   - `Review` (IQ score + control confirmation)

Success criteria:
- Account created or logged in.
- Required onboarding fields saved.
- User reaches dashboard with account marked registered.

---

### Phase B: Core Financial Node Setup (Gated Journey)
User intent: "Set up my real financial picture."

The app unlocks advanced planning after these 6 are complete:
1. `Family` (Household Node)
2. `Inflow` (income mapping)
3. `Outflow` (expenses/burn)
4. `Assets`
5. `Debt` (liabilities/EMIs)
6. `Goals`

Assistant guidance for each step:
- Family: "Add people who affect money decisions. Mark who is dependent and whose income should count."
- Inflow: "Enter monthly take-home first, then yearly bonus/reimbursements."
- Outflow: "Start with top 5 recurring expenses, then refine categories."
- Assets: "Add liquid + long-term assets; mark which are available for goals."
- Debt: "Add every EMI. Use accurate outstanding, rate, and tenure."
- Goals: "Create 2-3 goals first (urgent, important, long-term)."

Success criteria:
- Journey progress = 100%.
- Advanced modules become available.

---

### Phase C: Plan Generation (Advanced Modules)
User intent: "Tell me what to do now."

Recommended sequence after unlock:
1. `Risk Profile` -> establish return assumptions and allocation baseline.
2. `Insurance` -> estimate term + health cover gaps.
3. `Goal Summary` / `Goal Funding` -> quantify funding shortfall.
4. `Cashflow` -> validate surplus sustainability over time.
5. `Investment Plan` -> rebalance toward risk-aligned allocation.
6. `Monthly Savings Plan` -> convert plan into monthly allocation.
7. `Action Plan` -> prioritized actions by criticality.

Success criteria:
- User can answer: "Am I on track?", "What is my monthly gap?", "What should I do first?"

---

### Phase D: Ongoing Guidance and Behavior
User intent: "Keep me on track with minimal effort."

Operating rhythm:
- Weekly (5-10 min):
  - Check `Dashboard` alerts and notifications.
  - Update major expenses or new liabilities.
- Monthly (20-30 min):
  - Reconcile inflow/outflow changes.
  - Track progress on top 3 goals.
  - Re-run `Action Plan`.
- Quarterly (30-45 min):
  - Rebalance via `Investment Plan`.
  - Review insurance cover against new goals/debts.
- Every 6 months:
  - Retake `Risk Profile` (or sooner after major life changes).

---

## 3) First Session Playbook (What to Tell the User)

Use this guided script inside onboarding/help:

1. "We will set up your baseline in 10-15 minutes."
2. "Only a few details are required now. Optional data can be skipped."
3. "Complete these in order: Household -> Inflow -> Outflow -> Assets -> Liabilities -> Goals."
4. "Once done, we will generate your risk-aligned action plan."
5. "Your first outputs will be: monthly surplus, debt pressure, emergency runway, goal funding gap, and top 3 actions."

---

## 4) Financial Planning Framework for New Users

### Step 1: Stabilize
- Target non-negative monthly surplus.
- Keep debt-service ratio under control (reduce high-interest EMI pressure first).
- Build emergency reserve toward 6 months.

### Step 2: Protect
- Close term insurance gap (income + liabilities + goals - covered assets).
- Close health insurance gap based on family risk.

### Step 3: Grow
- Set risk profile and map target allocation.
- Rebalance assets toward recommended mix.
- Automate monthly contributions.

### Step 4: Fund Goals
- Prioritize by urgency + life impact.
- Track current corpus vs required corpus.
- Increase contributions where readiness is weak.

### Step 5: Improve Continuously
- Use monthly plan reviews to update assumptions.
- Re-run action plan after each major life or income event.

---

## 5) Ready-to-Use AI Advisor Prompts

Use these prompts to assist first-time users:

- "Based on my current data, what are my top 3 financial risks in the next 12 months?"
- "Show my retirement readiness score and what monthly contribution increase is needed."
- "If my expenses rise by 15%, which goals get delayed first?"
- "How much debt prepayment gives the best improvement in monthly surplus?"
- "Create a 90-day financial action plan from my current profile."

---

## 6) Success Metrics for This Journey

Track:
- Onboarding completion rate.
- Time to 100% journey completion.
- % users reaching risk profile completion.
- % users with at least 3 goals created.
- % users with a saved monthly surplus plan.
- 30-day return usage (monthly review behavior).

