import React, { useMemo, useState } from 'react';
import type { Asset, AssetType, FinanceState, InvestmentFrequency } from '../types';
import {
  ResponsiveContainer,
  PieChart as RePie,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Plus,
  Trash2,
  Coins,
  TrendingUp,
  Home,
  Landmark,
  Briefcase,
  Car,
  Users,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { clampNumber, parseNumber } from '../lib/validation';
import { formatCurrency, getCurrencyConfig, getCurrencySymbol } from '../lib/currency';
import { getRiskReturnAssumption } from '../lib/financeMath';

const ASSET_CLASSES: { name: AssetType; icon: any; subCategories: string[] }[] = [
  { name: 'Liquid', icon: Landmark, subCategories: ['Savings Account', 'Cash', 'Liquid Mutual Funds', 'Overnight Funds'] },
  { name: 'Debt', icon: Briefcase, subCategories: ['Fixed Deposits', 'Bonds', 'Corporate Deposits', 'Debt Mutual Funds', 'PPF', 'EPF'] },
  { name: 'Equity', icon: TrendingUp, subCategories: ['Direct Equity', 'Equity MFs', 'ELSS (Tax Saver)', 'Index Funds', 'Small-cap Funds', 'Mid-cap Funds'] },
  { name: 'Real Estate', icon: Home, subCategories: ['Residential Property', 'Commercial Property', 'Land', 'REITs'] },
  { name: 'Gold/Silver', icon: Coins, subCategories: ['Physical Gold', 'Sovereign Gold Bonds', 'Gold ETFs', 'Silver'] },
  { name: 'Personal', icon: Car, subCategories: ['Vehicle', 'Art/Collectibles', 'Other Personal Assets'] },
];

const ASSET_TYPE_OPTIONS = ASSET_CLASSES.flatMap(group =>
  group.subCategories.map(subCategory => ({
    category: group.name,
    subCategory,
    value: `${group.name}::${subCategory}`,
    label: `${subCategory} (${group.name})`,
  })),
);

const GOLD_RATE_PER_GRAM_BY_CURRENCY: Record<string, number> = {
  INR: 7000,
  USD: 70,
  GBP: 55,
  EUR: 65,
  AED: 255,
  CAD: 95,
  AUD: 105,
  SGD: 95,
};

const CHART_COLORS = ['#0f766e', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#84cc16'];

const isVehicleAsset = (asset: Pick<Asset, 'category' | 'subCategory'> | Partial<Asset>) =>
  asset.category === 'Personal' && asset.subCategory === 'Vehicle';

const getDefaultGrowthRate = (category: AssetType, subCategory: string) => {
  if (category === 'Equity') return 10;
  if (category === 'Liquid') return 4;
  if (category === 'Debt') return 7;
  if (category === 'Real Estate') return 8;
  if (category === 'Gold/Silver') return 6;
  if (category === 'Personal' && subCategory === 'Vehicle') return -10;
  return 5;
};

const buildDefaultDraft = (): Partial<Asset> => {
  const year = new Date().getFullYear();
  return {
    category: 'Equity',
    subCategory: 'Direct Equity',
    name: '',
    owner: 'self',
    currentValue: 0,
    growthRate: 10,
    purchaseYear: year,
    availableForGoals: true,
    availableFrom: year,
    monthlyContribution: 0,
    contributionFrequency: 'Monthly',
    contributionStepUp: 0,
    contributionStartYear: year,
    contributionEndYear: year,
  };
};

const Assets: React.FC<{ state: FinanceState; updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasRegularContribution, setHasRegularContribution] = useState(false);
  const [goldGrams, setGoldGrams] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newAsset, setNewAsset] = useState<Partial<Asset>>(buildDefaultDraft());

  const currentYear = new Date().getFullYear();
  const currencyCountry = state.profile.country;
  const currencySymbol = getCurrencySymbol(currencyCountry);
  const { code: currencyCode } = getCurrencyConfig(currencyCountry);

  const isGoldAsset = newAsset.category === 'Gold/Silver';
  const isAvailableForGoals = newAsset.availableForGoals !== false;

  const goldRatePerGram = GOLD_RATE_PER_GRAM_BY_CURRENCY[currencyCode] ?? GOLD_RATE_PER_GRAM_BY_CURRENCY.INR;
  const grams = parseNumber(goldGrams, 0);
  const calculatedGoldValue = grams > 0 ? grams * goldRatePerGram : 0;

  const selectedType = `${newAsset.category || 'Equity'}::${newAsset.subCategory || 'Direct Equity'}`;

  const summary = useMemo(() => {
    const byCategory = {
      Liquid: 0,
      Debt: 0,
      Equity: 0,
      'Real Estate': 0,
      'Gold/Silver': 0,
      Personal: 0,
    } as Record<AssetType, number>;

    for (const asset of state.assets) {
      byCategory[asset.category] += parseNumber(asset.currentValue, 0);
    }

    const total = Object.values(byCategory).reduce((sum, value) => sum + value, 0);
    return { total, byCategory };
  }, [state.assets]);

  const totalLiabilities = useMemo(
    () => state.loans.reduce((sum, loan) => sum + parseNumber(loan.outstandingAmount, 0), 0),
    [state.loans],
  );

  const assetMixData = useMemo(
    () =>
      Object.entries(summary.byCategory)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value })),
    [summary.byCategory],
  );

  const netWorthSummary = useMemo(() => {
    const financial = summary.byCategory.Liquid + summary.byCategory.Debt + summary.byCategory.Equity + summary.byCategory['Gold/Silver'];
    const physical = summary.byCategory['Real Estate'];
    const personal = summary.byCategory.Personal;
    const total = financial + physical + personal;
    return {
      financial,
      physical,
      personal,
      totalAssets: total,
      liabilities: totalLiabilities,
      netWorth: total - totalLiabilities,
      pct: (value: number) => (total > 0 ? (value / total) * 100 : 0),
    };
  }, [summary.byCategory, totalLiabilities]);

  const projectedEquity = useMemo(() => {
    const assumedReturn = getRiskReturnAssumption(state.riskProfile?.level);
    const annualContribution = state.assets.reduce(
      (sum, asset) => sum + Math.max(0, parseNumber(asset.monthlyContribution, 0)) * 12,
      0,
    );
    const points: { year: number; value: number }[] = [];
    let value = netWorthSummary.netWorth;
    const year = new Date().getFullYear();
    for (let i = 0; i <= 5; i += 1) {
      points.push({ year: year + i, value: Math.round(value) });
      value = value * (1 + assumedReturn / 100) + annualContribution;
    }
    return points;
  }, [netWorthSummary.netWorth, state.assets, state.riskProfile?.level]);

  const resetDraft = () => {
    setNewAsset(buildDefaultDraft());
    setShowAdvanced(false);
    setHasRegularContribution(false);
    setGoldGrams('');
    setFormError(null);
  };

  const getOwnerName = (id: string) => {
    if (id === 'self') return state.profile.firstName || 'Self';
    return state.family.find(member => member.id === id)?.name || 'Unknown';
  };

  const getAssetNamePlaceholder = () => {
    const sub = newAsset.subCategory || '';
    const mapped: Record<string, string> = {
      'Savings Account': 'e.g. HDFC Salary Account',
      'Fixed Deposits': 'e.g. SBI 3Y Fixed Deposit',
      'Direct Equity': 'e.g. Reliance Industries Shares',
      'ELSS (Tax Saver)': 'e.g. Tax Saver Fund',
      'Residential Property': 'e.g. Apartment - Whitefield',
      'Commercial Property': 'e.g. Office Unit - BKC',
      'Physical Gold': 'e.g. Gold Jewellery',
      Vehicle: 'e.g. Hyundai Creta',
      'Other Personal Assets': 'e.g. Premium Watch Collection',
    };
    return mapped[sub] || 'e.g. Asset Name';
  };

  const handleAssetTypeChange = (value: string) => {
    const [categoryRaw, subCategoryRaw] = value.split('::');
    const category = (categoryRaw || 'Equity') as AssetType;
    const subCategory = subCategoryRaw || 'Direct Equity';

    setNewAsset(prev => ({
      ...prev,
      category,
      subCategory,
      growthRate: getDefaultGrowthRate(category, subCategory),
    }));

    if (category !== 'Gold/Silver') setGoldGrams('');
  };

  const handleAddAsset = () => {
    setFormError(null);

    const category = (newAsset.category || 'Equity') as AssetType;
    const subCategory = (newAsset.subCategory || '').trim();
    const owner = newAsset.owner || 'self';
    const name = (newAsset.name || '').trim() || subCategory || category;

    if (!subCategory) {
      setFormError('Please choose an asset type.');
      return;
    }

    if (owner !== 'self' && !state.family.find(member => member.id === owner)) {
      setFormError('Please select a valid owner.');
      return;
    }

    const growthInput = parseNumber(newAsset.growthRate, getDefaultGrowthRate(category, subCategory));
    if (!isVehicleAsset({ category, subCategory }) && (growthInput < 0 || growthInput > 30)) {
      setFormError('Expected growth should be between 0% and 30%.');
      return;
    }
    if (isVehicleAsset({ category, subCategory }) && Math.abs(growthInput) > 30) {
      setFormError('Expected depreciation should be between 0% and 30%.');
      return;
    }

    if (category === 'Gold/Silver' && grams <= 0) {
      setFormError('Enter gold/silver quantity in grams.');
      return;
    }

    const currentValue = category === 'Gold/Silver'
      ? Math.max(0, grams * goldRatePerGram)
      : Math.max(0, parseNumber(newAsset.currentValue, 0));

    if (currentValue <= 0) {
      setFormError('Current value must be greater than 0.');
      return;
    }

    const monthlyContribution = hasRegularContribution ? parseNumber(newAsset.monthlyContribution, 0) : 0;
    const contributionStepUp = hasRegularContribution ? parseNumber(newAsset.contributionStepUp, 0) : 0;
    const contributionFrequency = hasRegularContribution
      ? (newAsset.contributionFrequency || 'Monthly') as InvestmentFrequency
      : 'Monthly';
    const contributionStartYear = hasRegularContribution ? parseNumber(newAsset.contributionStartYear, currentYear) : undefined;
    const contributionEndYear = hasRegularContribution ? parseNumber(newAsset.contributionEndYear, currentYear) : undefined;

    if (hasRegularContribution && monthlyContribution <= 0) {
      setFormError('Contribution amount must be greater than 0 when regular contribution is enabled.');
      return;
    }
    if (hasRegularContribution && (contributionStepUp < 0 || contributionStepUp > 30)) {
      setFormError('Contribution step-up must be between 0% and 30%.');
      return;
    }
    if (hasRegularContribution && contributionStartYear !== undefined && contributionEndYear !== undefined && contributionStartYear > contributionEndYear) {
      setFormError('Contribution start year cannot be after contribution end year.');
      return;
    }

    const purchaseYear = parseNumber(newAsset.purchaseYear, currentYear);
    const availableForGoals = newAsset.availableForGoals !== false;
    const availableFrom = availableForGoals ? parseNumber(newAsset.availableFrom, currentYear) : undefined;

    const growthRate = isVehicleAsset({ category, subCategory })
      ? -clampNumber(Math.abs(growthInput), 0, 30)
      : clampNumber(growthInput, 0, 30);

    const nextAsset: Asset = {
      id: Math.random().toString(36).slice(2, 11),
      category,
      subCategory,
      name,
      owner,
      currentValue,
      purchaseYear,
      growthRate,
      availableForGoals,
      availableFrom,
      monthlyContribution,
      contributionFrequency,
      contributionStepUp: clampNumber(contributionStepUp, 0, 30),
      contributionStartYear,
      contributionEndYear,
    };

    updateState({ assets: [...state.assets, nextAsset] });
    setNotice('Asset added successfully.');
    setTimeout(() => setNotice(null), 3000);
    setShowAdd(false);
    resetDraft();
  };

  const removeAsset = (id: string) => {
    updateState({ assets: state.assets.filter(asset => asset.id !== id) });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest">
          {notice}
        </div>
      )}

      <div className="surface-dark p-10 md:p-14 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[340px] h-[340px] bg-teal-600/10 blur-[90px] rounded-full translate-x-1/3 -translate-y-1/3" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-3 text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <Sparkles size={14} /> Asset Inventory
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Assets & Investments</h2>
            <p className="text-slate-300 text-sm md:text-base font-medium max-w-xl">
              Add core asset details first. Advanced assumptions are optional and can be adjusted later.
            </p>
          </div>

          <button
            onClick={() => {
              setShowAdd(prev => !prev);
              if (!showAdd) resetDraft();
            }}
            className="px-8 py-5 bg-teal-600 hover:bg-teal-500 text-white rounded-[1.75rem] transition-all flex items-center gap-3 font-black uppercase text-[11px] tracking-[0.2em] shadow-xl"
          >
            <Plus size={18} />
            {showAdd ? 'Close Form' : 'Add Asset'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 sm:p-8 md:p-10 border-b border-slate-100 flex justify-between items-center bg-white/90">
            <div className="text-left">
              <h3 className="text-2xl font-black text-slate-900">Add Asset</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Minimum: Type, Value, Owner</p>
            </div>
            <button
              onClick={() => {
                setShowAdd(false);
                resetDraft();
              }}
              className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 transition-colors"
            >
              <Plus size={22} className="rotate-45" />
            </button>
          </div>

          <div className="p-6 sm:p-8 md:p-10 space-y-8 text-left">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold">
                {formError}
              </div>
            )}

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 text-slate-700 mb-2">
                <Info size={14} />
                <p className="text-[10px] font-black uppercase tracking-widest">Assistive Guidance</p>
              </div>
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                Select asset type first. Category is auto-detected. For gold/silver, enter grams and value is auto-calculated.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Type</label>
              <select
                value={selectedType}
                onChange={e => handleAssetTypeChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none"
              >
                {ASSET_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="text-[10px] font-bold text-slate-500">Category auto-detected as <span className="text-slate-900">{newAsset.category}</span>.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Name (Optional)</label>
                <input
                  type="text"
                  placeholder={getAssetNamePlaceholder()}
                  value={newAsset.name || ''}
                  onChange={e => setNewAsset(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={12} /> Owner</label>
                <select
                  value={newAsset.owner}
                  onChange={e => setNewAsset(prev => ({ ...prev, owner: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none"
                >
                  <option value="self">Self</option>
                  {state.family.map(member => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                {isGoldAsset ? (
                  <>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Coins size={12} /> Gold / Silver Quantity (grams)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={goldGrams}
                      onChange={e => setGoldGrams(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none"
                      placeholder="e.g. 25.5"
                    />
                  </>
                ) : (
                  <>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Coins size={12} /> Current Value</label>
                    <input
                      type="number"
                      min={0}
                      value={parseNumber(newAsset.currentValue, 0)}
                      onChange={e => setNewAsset(prev => ({ ...prev, currentValue: parseNumber(e.target.value, 0) }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none"
                      placeholder={currencySymbol}
                    />
                  </>
                )}
              </div>

              {isGoldAsset && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Value (Auto)</label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-black text-slate-900 min-h-[56px] flex items-center">
                    {grams > 0 ? formatCurrency(Math.round(calculatedGoldValue), currencyCountry) : 'Waiting for grams'}
                  </div>
                  <p className="text-[10px] font-bold text-slate-500">Reference rate: {formatCurrency(goldRatePerGram, currencyCountry)} per gram.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available For Goals</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNewAsset(prev => ({ ...prev, availableForGoals: true, availableFrom: prev.availableFrom || currentYear }))}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${isAvailableForGoals ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAsset(prev => ({ ...prev, availableForGoals: false, availableFrom: undefined }))}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${!isAvailableForGoals ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                  >
                    No
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-500">Yes = planner can redeem/sell/pledge this asset for goals.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Are you adding regularly?</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setHasRegularContribution(true)}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${hasRegularContribution ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasRegularContribution(false);
                      setNewAsset(prev => ({
                        ...prev,
                        monthlyContribution: 0,
                        contributionStepUp: 0,
                        contributionStartYear: undefined,
                        contributionEndYear: undefined,
                      }));
                    }}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${!hasRegularContribution ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {hasRegularContribution && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contribution Amount</label>
                  <input
                    type="number"
                    min={0}
                    value={parseNumber(newAsset.monthlyContribution, 0)}
                    onChange={e => setNewAsset(prev => ({ ...prev, monthlyContribution: parseNumber(e.target.value, 0) }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none"
                    placeholder={currencySymbol}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contribution Frequency</label>
                  <select
                    value={newAsset.contributionFrequency || 'Monthly'}
                    onChange={e => setNewAsset(prev => ({ ...prev, contributionFrequency: e.target.value as InvestmentFrequency }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Annually">Annually</option>
                    <option value="One time">One time</option>
                  </select>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowAdvanced(prev => !prev)}
              className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700"
            >
              <span className="text-[11px] font-black uppercase tracking-widest">Advanced Inputs (Optional)</span>
              {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showAdvanced && (
              <div className="space-y-6 p-5 rounded-2xl border border-slate-200 bg-slate-50/70">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {isVehicleAsset(newAsset) ? 'Expected Depreciation (%)' : 'Expected Growth (%)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={Math.abs(parseNumber(newAsset.growthRate, getDefaultGrowthRate((newAsset.category || 'Equity') as AssetType, newAsset.subCategory || '')))}
                      onChange={e => {
                        const input = parseNumber(e.target.value, 0);
                        const nextGrowth = isVehicleAsset(newAsset) ? -Math.abs(input) : input;
                        setNewAsset(prev => ({ ...prev, growthRate: nextGrowth }));
                      }}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase Year</label>
                    <input
                      type="number"
                      value={parseNumber(newAsset.purchaseYear, currentYear)}
                      onChange={e => setNewAsset(prev => ({ ...prev, purchaseYear: parseNumber(e.target.value, currentYear) }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available From Year</label>
                    <input
                      type="number"
                      disabled={!isAvailableForGoals}
                      value={parseNumber(newAsset.availableFrom, currentYear)}
                      onChange={e => setNewAsset(prev => ({ ...prev, availableFrom: parseNumber(e.target.value, currentYear) }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contribution Step-Up (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      disabled={!hasRegularContribution}
                      value={parseNumber(newAsset.contributionStepUp, 0)}
                      onChange={e => setNewAsset(prev => ({ ...prev, contributionStepUp: parseNumber(e.target.value, 0) }))}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contribution Start/End</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        disabled={!hasRegularContribution}
                        value={parseNumber(newAsset.contributionStartYear, currentYear)}
                        onChange={e => setNewAsset(prev => ({ ...prev, contributionStartYear: parseNumber(e.target.value, currentYear) }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 font-bold outline-none disabled:opacity-50"
                        placeholder="Start"
                      />
                      <input
                        type="number"
                        disabled={!hasRegularContribution}
                        value={parseNumber(newAsset.contributionEndYear, currentYear)}
                        onChange={e => setNewAsset(prev => ({ ...prev, contributionEndYear: parseNumber(e.target.value, currentYear) }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 font-bold outline-none disabled:opacity-50"
                        placeholder="End"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleAddAsset}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.15em] hover:bg-teal-600 transition-all"
            >
              Add Asset
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total Assets</p>
          <h4 className="text-3xl font-black text-emerald-900">{formatCurrency(summary.total, currencyCountry)}</h4>
        </div>
        {ASSET_CLASSES.map(group => (
          <div key={group.name} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{group.name}</p>
            <h4 className="text-lg font-black text-slate-900">{formatCurrency(summary.byCategory[group.name], currencyCountry)}</h4>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Portfolio Mix</p>
              <h3 className="text-xl font-black text-slate-900">Portfolio Mix.</h3>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {assetMixData.length} classes
            </div>
          </div>

          {assetMixData.length === 0 ? (
            <p className="text-sm text-slate-500 font-semibold">Add assets to view your mix.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-center">
              <div className="h-[220px] min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={60}>
                  <RePie>
                    <Pie data={assetMixData} dataKey="value" innerRadius={56} outerRadius={82} paddingAngle={4}>
                      {assetMixData.map((_, index) => (
                        <Cell key={`asset-mix-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                  </RePie>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {assetMixData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900">{formatCurrency(item.value, currencyCountry)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Worth Composition</p>
              <h3 className="text-xl font-black text-slate-900">Net Worth Composition.</h3>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Net: {formatCurrency(netWorthSummary.netWorth, currencyCountry)}
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="bg-slate-50/60">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Value</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">% of Assets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { label: 'Financial Assets', value: netWorthSummary.financial },
                  { label: 'Physical Assets', value: netWorthSummary.physical },
                  { label: 'Personal Assets', value: netWorthSummary.personal },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 text-xs font-black text-slate-900">{row.label}</td>
                    <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(row.value, currencyCountry)}</td>
                    <td className="px-4 py-3 text-xs font-black text-slate-500 text-right">{netWorthSummary.pct(row.value).toFixed(1)}%</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/60">
                  <td className="px-4 py-3 text-xs font-black text-slate-900">Total Assets</td>
                  <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(netWorthSummary.totalAssets, currencyCountry)}</td>
                  <td className="px-4 py-3 text-xs font-black text-slate-500 text-right">100%</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-xs font-black text-rose-600">Total Liabilities</td>
                  <td className="px-4 py-3 text-xs font-black text-rose-600 text-right">{formatCurrency(netWorthSummary.liabilities, currencyCountry)}</td>
                  <td className="px-4 py-3 text-xs font-black text-rose-400 text-right">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="surface-dark p-8 md:p-10 rounded-[3rem] border border-white/10 shadow-2xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projected Equity</p>
            <h3 className="text-2xl font-black tracking-tight">Projected Equity.</h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">5-Year Target</p>
            <p className="text-xl font-black text-emerald-400">
              {formatCurrency(projectedEquity[projectedEquity.length - 1]?.value || 0, currencyCountry)}
            </p>
          </div>
        </div>
        <div className="h-[300px] min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={60}>
            <AreaChart data={projectedEquity}>
              <defs>
                <linearGradient id="assetProjectedEquityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff12" />
              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                formatter={(value: number) => formatCurrency(value, currencyCountry)}
              />
              <Area type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={3} fill="url(#assetProjectedEquityFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {state.assets.length === 0 ? (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-left">
          <h4 className="text-xl font-black text-slate-900">No assets added yet</h4>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Add core holdings first. You can refine assumptions later from this same page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.assets.map(asset => {
            const Icon = ASSET_CLASSES.find(group => group.name === asset.category)?.icon || Landmark;
            return (
              <div key={asset.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm px-6 py-6 sm:px-8 sm:py-7 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-teal-300 transition-all">
                <div className="flex items-start gap-5 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                    <Icon size={24} />
                  </div>
                  <div className="space-y-1 min-w-0 text-left">
                    <h4 className="text-xl font-black text-slate-900 truncate">{asset.name || asset.subCategory}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{asset.category} • {asset.subCategory}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Owner: {getOwnerName(asset.owner)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 md:gap-6">
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Value</p>
                    <p className="text-2xl font-black text-slate-900">{formatCurrency(asset.currentValue, currencyCountry)}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isVehicleAsset(asset) ? 'Depreciation' : 'Growth'}</p>
                    <p className={`text-sm font-black ${isVehicleAsset(asset) ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {Math.abs(parseNumber(asset.growthRate, 0)).toFixed(1)}%
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${asset.availableForGoals ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {asset.availableForGoals ? 'For Goals' : 'Protected'}
                  </span>
                  <button
                    onClick={() => removeAsset(asset.id)}
                    className="p-3 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white transition-all"
                    aria-label={`Remove ${asset.name || asset.subCategory}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Assets;
