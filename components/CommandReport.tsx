import React from 'react';
import {
  ResponsiveContainer,
  PieChart as RePie,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  Target,
  ShieldCheck,
  Compass,
  Banknote,
  Landmark,
  LineChart,
} from 'lucide-react';
import type { ReportSnapshot } from '../types';
import { formatCurrency } from '../lib/currency';

interface CommandReportProps {
  snapshot: ReportSnapshot;
}

const COLORS = ['#0f766e', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#84cc16'];

const CommandReport: React.FC<CommandReportProps> = ({ snapshot }) => {
  const currencyCountry = snapshot.currency;

  const introProgress = [
    { name: 'Complete', value: Math.min(100, Math.max(0, snapshot.intro.completionPct)) },
    { name: 'Remaining', value: Math.max(0, 100 - snapshot.intro.completionPct) },
  ];

  const executiveData = [
    { name: 'Assets', value: snapshot.executiveSummary.totalAssets },
    { name: 'Liabilities', value: snapshot.executiveSummary.totalLiabilities },
    { name: 'Net Worth', value: snapshot.executiveSummary.netWorth },
  ];

  const positionSplit = [
    { name: 'Investments', value: snapshot.statementOfPosition.totals.investments },
    { name: 'Other Assets', value: snapshot.statementOfPosition.totals.otherAssets },
  ];

  const liabilitiesData = snapshot.statementOfPosition.liabilities.length > 0
    ? snapshot.statementOfPosition.liabilities
    : [{ label: 'Liabilities', value: 0 }];

  const cashFlowData = [
    { name: 'Income', value: snapshot.cashFlow.monthly.income },
    { name: 'Expenses', value: snapshot.cashFlow.monthly.expenses },
    { name: 'Debt', value: snapshot.cashFlow.monthly.debt },
    { name: 'Surplus', value: snapshot.cashFlow.monthly.surplus },
  ];

  const goalGap = Math.max(0, snapshot.goals.totalTargetToday - snapshot.goals.totalCurrent);
  const goalsData = snapshot.goals.totalTargetToday > 0
    ? [
        { name: 'Funded', value: snapshot.goals.totalCurrent },
        { name: 'Gap', value: goalGap },
      ]
    : [{ name: 'No Goals', value: 1 }];

  const allocationData = [
    {
      name: 'Equity',
      current: snapshot.riskProfile.currentAllocation.equity,
      recommended: snapshot.riskProfile.recommendedAllocation.equity,
    },
    {
      name: 'Debt',
      current: snapshot.riskProfile.currentAllocation.debt,
      recommended: snapshot.riskProfile.recommendedAllocation.debt,
    },
    {
      name: 'Gold',
      current: snapshot.riskProfile.currentAllocation.gold,
      recommended: snapshot.riskProfile.recommendedAllocation.gold,
    },
    {
      name: 'Liquid',
      current: snapshot.riskProfile.currentAllocation.liquid,
      recommended: snapshot.riskProfile.recommendedAllocation.liquid,
    },
  ];

  const assumptionData = [
    { name: 'Inflation', value: snapshot.assumptions.inflation, unit: '%' },
    { name: 'Return', value: snapshot.assumptions.returnAssumption, unit: '%' },
    { name: 'Income Growth', value: snapshot.assumptions.expectedIncomeGrowth, unit: '%' },
    { name: 'Retirement Age', value: snapshot.assumptions.retirementAge, unit: 'yr' },
    { name: 'Life Expectancy', value: snapshot.assumptions.lifeExpectancy, unit: 'yr' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-slate-900 text-white rounded-2xl"><Compass size={18} /></div>
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Command Report.</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Infographic Summary</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-2xl"><Activity size={18} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Intro</p>
              <h4 className="text-sm font-black text-slate-900">Plan Pulse</h4>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <RePie data={introProgress} innerRadius={42} outerRadius={60} dataKey="value">
                  {introProgress.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#0f766e' : '#e2e8f0'} stroke="transparent" />
                  ))}
                </RePie>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <div>
                <div className="text-slate-900 text-sm">{snapshot.intro.memberCount}</div>
                Members
              </div>
              <div>
                <div className="text-slate-900 text-sm">{snapshot.intro.goalCount}</div>
                Goals
              </div>
              <div>
                <div className="text-slate-900 text-sm">{snapshot.intro.assetCount}</div>
                Assets
              </div>
              <div>
                <div className="text-slate-900 text-sm">{snapshot.intro.liabilityCount}</div>
                Liabilities
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl"><Landmark size={18} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Executive</p>
              <h4 className="text-sm font-black text-slate-900">Net Worth Snapshot</h4>
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={executiveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(val: number) => formatCurrency(val, currencyCountry)} />
                <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2xl"><ShieldCheck size={18} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk</p>
              <h4 className="text-sm font-black text-slate-900">Allocation Split</h4>
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allocationData} barGap={4} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(val: number) => `${val.toFixed(1)}%`} />
                <Bar dataKey="current" fill="#0f766e" radius={[8, 8, 0, 0]} />
                <Bar dataKey="recommended" fill="#e2e8f0" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-2xl"><Banknote size={18} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Position</p>
              <h4 className="text-sm font-black text-slate-900">Assets vs Liabilities</h4>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RePie data={positionSplit} innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                  {positionSplit.map((entry, index) => (
                    <Cell key={`pos-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                  ))}
                </RePie>
              </ResponsiveContainer>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liabilitiesData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} width={110} />
                  <Tooltip formatter={(val: number) => formatCurrency(val, currencyCountry)} />
                  <Bar dataKey="value" fill="#ef4444" radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-2xl"><LineChart size={18} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cash Flow</p>
              <h4 className="text-sm font-black text-slate-900">Monthly Balance</h4>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(val: number) => formatCurrency(val, currencyCountry)} />
                <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-2xl"><Target size={18} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Goals</p>
              <h4 className="text-sm font-black text-slate-900">Funding Coverage</h4>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <RePie data={goalsData} innerRadius={50} outerRadius={70} dataKey="value">
                  {goalsData.map((entry, index) => (
                    <Cell key={`goal-${index}`} fill={index === 0 ? '#0f766e' : '#fee2e2'} stroke="transparent" />
                  ))}
                </RePie>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <div className="text-slate-900 text-sm">{snapshot.goals.fundedCount} / {snapshot.goals.totalGoals}</div>
              Funded Goals
              {snapshot.goals.nextGoal && (
                <div className="pt-2">
                  <div className="text-slate-900 text-sm">{snapshot.goals.nextGoal.label}</div>
                  Next Target {snapshot.goals.nextGoal.year}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-2xl"><Activity size={18} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assumptions</p>
              <h4 className="text-sm font-black text-slate-900">Core Inputs</h4>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assumptionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(val: number, _name, item: any) => `${Number(val).toFixed(1)}${item?.payload?.unit ?? ''}`} />
                <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandReport;
