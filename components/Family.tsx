
import React, { useMemo, useState } from 'react';
import { Plus, Users, Trash2, Heart, User, CheckCircle2 } from 'lucide-react';
import { FamilyMember, FinanceState, Relation, DetailedIncome } from '../types';
import { monthlyIncomeFromDetailed } from '../lib/incomeMath';
import { formatCurrency } from '../lib/currency';
import PlanningAssistStrip from './common/PlanningAssistStrip';

interface FamilyProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
  setView: (view: any) => void;
}

const Family: React.FC<FamilyProps> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dependencyBufferYears, setDependencyBufferYears] = useState(5);
  const [careCostInflation, setCareCostInflation] = useState(6);
  
  const initialIncome: DetailedIncome = {
    salary: 0,
    bonus: 0,
    reimbursements: 0,
    business: 0,
    rental: 0,
    investment: 0,
    pension: 0,
    expectedIncrease: 5
  };

  const [newMember, setNewMember] = useState<Omit<FamilyMember, 'id'>>({
    name: '',
    relation: 'Spouse',
    age: 30,
    isDependent: true,
    coveredUnderPrimaryInsurance: true,
    hasSeparateInsurance: false,
    includeIncomeInPlanning: false,
    retirementAge: undefined,
    income: { ...initialIncome },
    monthlyExpenses: 0
  });
  const safeAge = Number.isFinite(newMember.age) ? newMember.age : 0;
  const defaultRetirementAge = Math.min(100, safeAge + 30);
  const safeRetirementAge = Number.isFinite(newMember.retirementAge as number)
    ? (newMember.retirementAge as number)
    : defaultRetirementAge;

  const getPrimaryAge = (): number | null => {
    if (!state.profile.dob) return null;
    const dob = new Date(state.profile.dob);
    if (Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedName = newMember.name.trim();
    const age = Number(newMember.age);
    if (trimmedName.length < 2) {
      setFormError('Name must be at least 2 characters.');
      return;
    }
    if (!Number.isFinite(age) || age < 0 || age > 110) {
      setFormError('Age must be between 0 and 110.');
      return;
    }
    const primaryAge = getPrimaryAge();
    if (primaryAge !== null) {
      if (newMember.relation === 'Spouse' && (age < primaryAge - 10 || age > primaryAge + 10)) {
        setFormError(`Spouse age should be within +/-10 years of head of household age (${primaryAge}).`);
        return;
      }
      if (newMember.relation === 'Parent' && age < primaryAge + 10) {
        setFormError(`Parent age should be at least 10 years greater than head of household age (${primaryAge}).`);
        return;
      }
    }
    if (!newMember.isDependent && (newMember.includeIncomeInPlanning ?? false)) {
      const retirementAge = Number(newMember.retirementAge);
      if (!Number.isFinite(retirementAge) || retirementAge <= age || retirementAge > 100) {
        setFormError('Retirement age must be greater than current age and <= 100 for independent members.');
        return;
      }
    }
    const member: FamilyMember = {
      ...newMember,
      coveredUnderPrimaryInsurance: newMember.coveredUnderPrimaryInsurance ?? true,
      hasSeparateInsurance: (newMember.coveredUnderPrimaryInsurance ?? true)
        ? false
        : (newMember.hasSeparateInsurance ?? false),
      includeIncomeInPlanning: newMember.isDependent ? false : (newMember.includeIncomeInPlanning ?? false),
      id: Math.random().toString(36).substr(2, 9),
    };
    if (member.isDependent && age > 25) {
      setNotice('Dependent age is over 25. Please confirm this is intended.');
      setTimeout(() => setNotice(null), 4000);
    }
    updateState({ family: [...state.family, member] });
    setShowAdd(false);
    setNewMember({
      name: '',
      relation: 'Spouse',
      age: 30,
      isDependent: true,
      coveredUnderPrimaryInsurance: true,
      hasSeparateInsurance: false,
      includeIncomeInPlanning: false,
      retirementAge: undefined,
      income: { ...initialIncome },
      monthlyExpenses: 0
    });
  };

  const removeMember = (id: string) => {
    updateState({ family: state.family.filter(m => m.id !== id) });
  };

  const currencyCountry = state.profile.country;
  const householdInsight = useMemo(() => {
    const selfAge = getPrimaryAge();
    const familyCount = state.family.length;
    const memberCount = 1 + familyCount;
    const dependents = state.family.filter(member => member.isDependent).length;
    const independents = familyCount - dependents;
    const incomeIncludedMembers = state.family.filter(member => !member.isDependent && (member.includeIncomeInPlanning ?? false)).length + 1;
    const earners = Math.max(1, incomeIncludedMembers);

    const selfIncome = monthlyIncomeFromDetailed(state.profile.income);
    const includedFamilyIncome = state.family.reduce((sum, member) => {
      if (member.isDependent) return sum;
      if (!(member.includeIncomeInPlanning ?? false)) return sum;
      return sum + monthlyIncomeFromDetailed(member.income);
    }, 0);
    const totalPlanningIncome = selfIncome + includedFamilyIncome;

    const knownHouseholdBurn = state.detailedExpenses.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0)
      + state.loans.reduce((sum, loan) => sum + Math.max(0, Number(loan.emi || 0)), 0);
    const fallbackBurn = Math.max(0, Number(state.profile.monthlyExpenses || 0))
      + state.family.reduce((sum, member) => sum + Math.max(0, Number(member.monthlyExpenses || 0)), 0);
    const monthlyBurn = knownHouseholdBurn > 0 ? knownHouseholdBurn : fallbackBurn;

    const knownDependentCost = state.family
      .filter(member => member.isDependent)
      .reduce((sum, member) => sum + Math.max(0, Number(member.monthlyExpenses || 0)), 0);
    const fallbackDependentCost = dependents * Math.max(5000, monthlyBurn > 0 ? monthlyBurn * 0.2 : totalPlanningIncome * 0.12);
    const dependentSupportMonthly = knownDependentCost > 0 ? knownDependentCost : fallbackDependentCost;

    const yearsFactor = Math.pow(1 + careCostInflation / 100, Math.max(0, dependencyBufferYears - 1) / 2);
    const dependentCorpusTarget = dependentSupportMonthly * 12 * dependencyBufferYears * yearsFactor;

    const goalReadyLiquid = state.assets
      .filter(asset => asset.availableForGoals && asset.category === 'Liquid')
      .reduce((sum, asset) => sum + Math.max(0, Number(asset.currentValue || 0)), 0);

    const coveragePct = dependentCorpusTarget > 0 ? Math.min(999, (goalReadyLiquid / dependentCorpusTarget) * 100) : 0;
    const contributionMap = [
      {
        name: state.profile.firstName || 'Self',
        relation: 'Self',
        contribution: selfIncome,
        consumption: Math.max(
          0,
          monthlyBurn - state.family.reduce((sum, member) => sum + Math.max(0, Number(member.monthlyExpenses || 0)), 0),
        ),
      },
      ...state.family.map(member => ({
        name: member.name,
        relation: member.relation,
        contribution:
          member.isDependent || !(member.includeIncomeInPlanning ?? false)
            ? 0
            : monthlyIncomeFromDetailed(member.income),
        consumption: Math.max(0, Number(member.monthlyExpenses || 0)),
      })),
    ];
    const topContributor = contributionMap
      .slice()
      .sort((a, b) => b.contribution - a.contribution)[0];
    const incomeWithoutTop = Math.max(0, totalPlanningIncome - Math.max(0, topContributor?.contribution || 0));
    const deficitAfterTopLoss = Math.max(0, monthlyBurn - incomeWithoutTop);
    const resilienceMonths = deficitAfterTopLoss > 0 ? goalReadyLiquid / deficitAfterTopLoss : 999;
    const selfRetirementBufferYears = Math.max(0, Number(state.profile.lifeExpectancy || 85) - Number(state.profile.retirementAge || 60));
    const familyRetirementBuffers = state.family
      .filter(member => Number.isFinite(member.retirementAge as number))
      .map(member => Math.max(0, Number(state.profile.lifeExpectancy || 85) - Number(member.retirementAge || 0)));
    const allRetirementBuffers = [selfRetirementBufferYears, ...familyRetirementBuffers];
    const avgRetirementBufferYears = allRetirementBuffers.length
      ? allRetirementBuffers.reduce((sum, value) => sum + value, 0) / allRetirementBuffers.length
      : selfRetirementBufferYears;
    const shortRetirementBufferCount = allRetirementBuffers.filter(value => value < 20).length;
    const lifecycleCostCurve = [1, 5, 10].map((years) => ({
      years,
      annualCost: dependentSupportMonthly * 12 * Math.pow(1 + careCostInflation / 100, years),
    }));
    const ageMix = {
      children: state.family.filter(member => member.age <= 21).length,
      working: state.family.filter(member => member.age > 21 && member.age < 60).length + (selfAge !== null && selfAge > 21 && selfAge < 60 ? 1 : 0),
      seniors: state.family.filter(member => member.age >= 60).length + (selfAge !== null && selfAge >= 60 ? 1 : 0),
    };

    return {
      memberCount,
      dependents,
      independents,
      earners,
      incomeIncludedMembers,
      totalPlanningIncome,
      monthlyBurn,
      dependentSupportMonthly,
      dependentCorpusTarget,
      goalReadyLiquid,
      coveragePct,
      topContributor,
      resilienceMonths,
      avgRetirementBufferYears,
      shortRetirementBufferCount,
      lifecycleCostCurve,
      contributionMap,
      ageMix,
      dependencyRatioPct: memberCount > 0 ? (dependents / memberCount) * 100 : 0,
      dependencyPerEarner: dependents / earners,
    };
  }, [state, dependencyBufferYears, careCostInflation]);

  const familyAssistStats = useMemo(() => {
    const resilienceTone = householdInsight.resilienceMonths >= 12 || householdInsight.resilienceMonths >= 999
      ? 'positive'
      : householdInsight.resilienceMonths >= 6
        ? 'warning'
        : 'critical';
    const coverageTone = householdInsight.coveragePct >= 100
      ? 'positive'
      : householdInsight.coveragePct >= 60
        ? 'warning'
        : 'critical';

    return [
      {
        label: 'Members',
        value: String(householdInsight.memberCount),
      },
      {
        label: 'Planning Earners',
        value: String(householdInsight.earners),
      },
      {
        label: 'Dependents / Earner',
        value: householdInsight.dependencyPerEarner.toFixed(2),
        tone: householdInsight.dependencyPerEarner <= 1 ? 'positive' : 'warning',
      },
      {
        label: 'Resilience',
        value: householdInsight.resilienceMonths >= 999 ? 'Stable' : `${householdInsight.resilienceMonths.toFixed(1)} mo`,
        tone: resilienceTone,
      },
      {
        label: 'Support Coverage',
        value: `${householdInsight.coveragePct.toFixed(1)}%`,
        tone: coverageTone,
      },
    ] as const;
  }, [householdInsight]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest">
          {notice}
        </div>
      )}

      <PlanningAssistStrip
        title="Model your family structure before funding goals"
        description="Capture dependency, income participation, and retirement alignment so downstream planning remains realistic."
        tip="Keep spouse/parent age and dependency details accurate to avoid projection drift."
        actions={(
          <button
            type="button"
            onClick={() => setShowAdd(prev => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-2xl hover:bg-teal-500 transition-colors font-black uppercase text-[10px] tracking-widest shadow-lg"
          >
            <Plus size={14} /> {showAdd ? 'Close Form' : 'Add Member'}
          </button>
        )}
        stats={familyAssistStats.map((stat) => ({
          label: stat.label,
          value: stat.value,
          tone: stat.tone,
        }))}
      />

      {showAdd && (
        <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-8 sm:p-10 border-b border-slate-100 flex justify-between items-center bg-white/90">
            <div className="text-left">
              <h3 className="text-2xl font-black text-slate-900">Add Household Member</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Basic profile + planning behavior</p>
            </div>
            <button onClick={() => setShowAdd(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
              <Plus size={24} className="rotate-45" />
            </button>
          </div>
          <form onSubmit={handleAdd} className="p-8 sm:p-10 space-y-8">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <input required type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none" placeholder="e.g. Jane Smith" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Relation</label>
                <select value={newMember.relation} onChange={e => setNewMember({...newMember, relation: e.target.value as Relation})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none">
                  <option>Spouse</option>
                  <option>Child</option>
                  <option>Parent</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                <input
                  required
                  type="number"
                  value={Number.isFinite(newMember.age) ? newMember.age : ''}
                  onChange={e => {
                    const nextAge = Number.parseInt(e.target.value, 10);
                    setNewMember({ ...newMember, age: Number.isFinite(nextAge) ? nextAge : 0 });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  const nextDependent = !newMember.isDependent;
                  setNewMember({
                    ...newMember,
                    isDependent: nextDependent,
                    includeIncomeInPlanning: nextDependent ? false : true,
                  });
                }}
                className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${newMember.isDependent ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
              >
                {newMember.isDependent ? 'Dependent' : 'Independent'}
              </button>
            </div>
            {!newMember.isDependent && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Consider Income in Planning?</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNewMember({ ...newMember, includeIncomeInPlanning: !(newMember.includeIncomeInPlanning ?? false) })}
                    className={`w-20 h-10 rounded-full transition-all relative ${(newMember.includeIncomeInPlanning ?? false) ? 'bg-teal-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-8 h-8 rounded-full bg-white transition-all shadow-md ${(newMember.includeIncomeInPlanning ?? false) ? 'left-11' : 'left-1'}`} />
                  </button>
                  <p className="text-[10px] font-bold text-slate-500">
                    {(newMember.includeIncomeInPlanning ?? false) ? 'Included in household planning calculations' : 'Excluded from planning calculations'}
                  </p>
                </div>
              </div>
            )}
            {!newMember.isDependent && (newMember.includeIncomeInPlanning ?? false) && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Retirement Age</label>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-emerald-600">{safeRetirementAge} yrs</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Planned retirement</span>
                </div>
                <input
                  required
                  type="range"
                  min={Math.max(18, safeAge + 1)}
                  max={100}
                  step={1}
                  value={safeRetirementAge}
                  onChange={e => {
                    const nextRetirement = Number.parseInt(e.target.value, 10);
                    setNewMember({ ...newMember, retirementAge: Number.isFinite(nextRetirement) ? nextRetirement : defaultRetirementAge });
                  }}
                  className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-emerald-500 cursor-pointer"
                />
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Is it covered under your insurance?
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const nextCovered = !(newMember.coveredUnderPrimaryInsurance ?? true);
                      setNewMember({
                        ...newMember,
                        coveredUnderPrimaryInsurance: nextCovered,
                        hasSeparateInsurance: nextCovered ? false : (newMember.hasSeparateInsurance ?? false),
                      });
                    }}
                    className={`w-20 h-10 rounded-full transition-all relative ${(newMember.coveredUnderPrimaryInsurance ?? true) ? 'bg-teal-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-8 h-8 rounded-full bg-white transition-all shadow-md ${(newMember.coveredUnderPrimaryInsurance ?? true) ? 'left-11' : 'left-1'}`} />
                  </button>
                  <p className="text-[10px] font-bold text-slate-500">
                    {(newMember.coveredUnderPrimaryInsurance ?? true) ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {!(newMember.coveredUnderPrimaryInsurance ?? true) && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    If no, does it have separate insurance?
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setNewMember({ ...newMember, hasSeparateInsurance: !(newMember.hasSeparateInsurance ?? false) })}
                      className={`w-20 h-10 rounded-full transition-all relative ${(newMember.hasSeparateInsurance ?? false) ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-8 h-8 rounded-full bg-white transition-all shadow-md ${(newMember.hasSeparateInsurance ?? false) ? 'left-11' : 'left-1'}`} />
                    </button>
                    <p className="text-[10px] font-bold text-slate-500">
                      {(newMember.hasSeparateInsurance ?? false) ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-lg shadow-xl shadow-slate-900/10">Add to Profile</button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2.25rem] border border-slate-200 shadow-sm relative overflow-hidden h-48 flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-2 bg-teal-600 text-[8px] font-black text-white rounded-bl-xl uppercase tracking-widest">Primary</div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600">
              <User size={28} />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-lg">{state.profile.firstName} (Self)</h4>
              <p className="text-xs font-bold text-slate-400">Head of Household</p>
            </div>
          </div>
        </div>

        {state.family.map((member) => (
          <div key={member.id} className="bg-white p-6 rounded-[2.25rem] border border-slate-200 shadow-sm group hover:border-teal-300 transition-all h-48 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                  <Users size={28} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-lg">{member.name}</h4>
                  <p className="text-xs font-bold text-slate-400">
                    {member.relation} • Age {member.age}{member.retirementAge ? ` • Retire ${member.retirementAge}` : ''}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    {(member.includeIncomeInPlanning ?? true) ? 'Income Included' : 'Income Excluded'}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    {(member.coveredUnderPrimaryInsurance ?? true)
                      ? 'Covered Under Your Insurance'
                      : ((member.hasSeparateInsurance ?? false) ? 'Separate Insurance: Yes' : 'Separate Insurance: No')}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => removeMember(member.id)}
                className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="mt-4 flex justify-start">
               <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${member.isDependent ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                 {member.isDependent ? 'Dependent' : 'Independent'}
               </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 text-left">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Household Analysis Lab</p>
              <h3 className="text-2xl font-black text-slate-900">Dependency and Support Simulation</h3>
            </div>
            <div className="px-3 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dependency ratio</p>
              <p className="text-lg font-black text-slate-900">{householdInsight.dependencyRatioPct.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Household size</p>
              <p className="text-xl font-black text-slate-900 mt-1">{householdInsight.memberCount}</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Dependents</p>
              <p className="text-xl font-black text-amber-700 mt-1">{householdInsight.dependents}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Earners</p>
              <p className="text-xl font-black text-emerald-700 mt-1">{householdInsight.earners}</p>
            </div>
            <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-teal-600">Monthly planning inflow</p>
              <p className="text-lg font-black text-teal-700 mt-1">{formatCurrency(householdInsight.totalPlanningIncome, currencyCountry)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dependency buffer years</label>
                <span className="text-sm font-black text-slate-900">{dependencyBufferYears} yrs</span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={dependencyBufferYears}
                onChange={(event) => setDependencyBufferYears(Number(event.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-teal-600 cursor-pointer"
              />
              <p className="text-[10px] font-semibold text-slate-500">
                Planning target for how long dependent support should be buffered.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Care cost inflation</label>
                <span className="text-sm font-black text-slate-900">{careCostInflation}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={15}
                step={1}
                value={careCostInflation}
                onChange={(event) => setCareCostInflation(Number(event.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-emerald-500 cursor-pointer"
              />
              <p className="text-[10px] font-semibold text-slate-500">
                Stress-tests dependent care requirement under rising costs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Estimated dependent support / month</p>
              <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(householdInsight.dependentSupportMonthly, currencyCountry)}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-rose-500">Required support corpus</p>
              <p className="text-lg font-black text-rose-600 mt-1">{formatCurrency(householdInsight.dependentCorpusTarget, currencyCountry)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Goal-ready liquid cover</p>
              <p className="text-lg font-black text-emerald-700 mt-1">{formatCurrency(householdInsight.goalReadyLiquid, currencyCountry)}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mt-1">{householdInsight.coveragePct.toFixed(1)}% coverage</p>
            </div>
          </div>
        </div>

        <div className="surface-dark p-6 md:p-8 rounded-[2.5rem] text-white space-y-5 text-left shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Household Signals</p>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Age mix</p>
              <p className="text-sm font-semibold text-white mt-1">
                Children: {householdInsight.ageMix.children} • Working: {householdInsight.ageMix.working} • Seniors: {householdInsight.ageMix.seniors}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dependency per earner</p>
              <p className="text-xl font-black text-teal-400 mt-1">
                {householdInsight.dependencyPerEarner.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Burn vs planning inflow</p>
              <p className="text-xl font-black text-teal-400 mt-1">
                {householdInsight.totalPlanningIncome > 0
                  ? `${((householdInsight.monthlyBurn / householdInsight.totalPlanningIncome) * 100).toFixed(1)}%`
                  : '0.0%'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resilience if top income stops</p>
              <p className="text-sm font-semibold text-slate-200 mt-2">
                {householdInsight.topContributor
                  ? `${householdInsight.topContributor.name} is top contributor.`
                  : 'Top contributor not available.'}
              </p>
              <p className="text-lg font-black text-teal-300 mt-1">
                {householdInsight.resilienceMonths >= 999 ? 'Stable (no immediate deficit)' : `${householdInsight.resilienceMonths.toFixed(1)} months`}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retirement alignment</p>
              <p className="text-sm font-semibold text-slate-200 mt-2">
                Avg buffer: {householdInsight.avgRetirementBufferYears.toFixed(1)} years to life expectancy.
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-300 mt-2">
                {householdInsight.shortRetirementBufferCount} member(s) below 20-year buffer
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Family lifecycle cost curve</p>
              {householdInsight.lifecycleCostCurve.map(point => (
                <div key={point.years} className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span>{point.years}Y projected dependent cost</span>
                  <span className="font-black">{formatCurrency(point.annualCost, currencyCountry)}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contribution vs consumption</p>
              {householdInsight.contributionMap.slice(0, 3).map(item => (
                <div key={`${item.name}-${item.relation}`} className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span>{item.name}</span>
                  <span className="font-black">
                    {formatCurrency(item.contribution, currencyCountry)} / {formatCurrency(item.consumption, currencyCountry)}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Insight</p>
              <p className="text-sm font-semibold text-slate-200 mt-2 leading-relaxed">
                {householdInsight.coveragePct >= 100
                  ? 'Your liquid goal-ready assets currently cover the selected dependency buffer target.'
                  : 'Dependency support target is underfunded for the selected horizon. Increase liquid reserves or update family cashflow contributions.'}
              </p>
            </div>
          </div>
        </div>
      </div>

          </div>
  );
};

export default Family;
