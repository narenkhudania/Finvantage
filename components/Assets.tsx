
import React, { useState } from 'react';
import { FinanceState, Asset, AssetType } from '../types';
import { Plus, Trash2, Coins, TrendingUp, Home, Landmark, Briefcase, Car, CheckCircle2, Circle, Percent, Users, Info } from 'lucide-react';
import { clampNumber, parseNumber } from '../lib/validation';
import { formatCurrency, getCurrencyConfig, getCurrencySymbol } from '../lib/currency';

const ASSET_CLASSES: { name: AssetType, icon: any, subCategories: string[] }[] = [
  { name: 'Liquid', icon: Landmark, subCategories: ['Savings Account', 'Cash', 'Liquid Mutual Funds', 'Overnight Funds'] },
  { name: 'Debt', icon: Briefcase, subCategories: ['Fixed Deposits', 'Bonds', 'Corporate Deposits', 'Debt Mutual Funds', 'PPF', 'EPF'] },
  { name: 'Equity', icon: TrendingUp, subCategories: ['Direct Equity', 'Equity MFs', 'ELSS (Tax Saver)', 'Index Funds', 'Small-cap Funds', 'Mid-cap Funds'] },
  { name: 'Real Estate', icon: Home, subCategories: ['Residential Property', 'Commercial Property', 'Land', 'REITs'] },
  { name: 'Gold/Silver', icon: Coins, subCategories: ['Physical Gold', 'Sovereign Gold Bonds', 'Gold ETFs', 'Silver'] },
  { name: 'Personal', icon: Car, subCategories: ['Vehicle', 'Art/Collectibles', 'Other Personal Assets'] },
];

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

const Assets: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [hasRegularContribution, setHasRegularContribution] = useState(false);
  const [goldGrams, setGoldGrams] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newAsset, setNewAsset] = useState<Partial<Asset>>({
    category: 'Equity',
    subCategory: 'Direct Equity',
    owner: 'self',
    currentValue: 0,
    purchaseYear: new Date().getFullYear(),
    growthRate: 10,
    availableForGoals: true,
    availableFrom: new Date().getFullYear(),
    name: '',
    monthlyContribution: 0,
    contributionFrequency: 'Monthly',
    contributionStepUp: 0,
    contributionStartYear: new Date().getFullYear(),
    contributionEndYear: new Date().getFullYear(),
  });

  const handleCategoryChange = (category: AssetType) => {
    const assetClass = ASSET_CLASSES.find(ac => ac.name === category);
    const nextSubCategory = assetClass?.subCategories[0] || '';
    const defaultGrowthRate =
      category === 'Equity'
        ? 10
        : (category === 'Personal' && nextSubCategory === 'Vehicle' ? -10 : 5);
    setNewAsset({
      ...newAsset,
      category,
      subCategory: nextSubCategory,
      growthRate: defaultGrowthRate
    });
    if (category !== 'Gold/Silver') setGoldGrams('');
  };

  const handleAdd = () => {
    setFormError(null);
    setFormWarning(null);
    const currentYear = new Date().getFullYear();
    const isGoldAsset = newAsset.category === 'Gold/Silver';
    const isVehicleAsset = newAsset.category === 'Personal' && newAsset.subCategory === 'Vehicle';
    const name = (newAsset.name || '').trim();
    const subCategory = newAsset.subCategory || '';
    const owner = newAsset.owner || 'self';
    const purchaseYear = parseNumber(newAsset.purchaseYear || currentYear, currentYear);
    const growthRate = parseNumber(newAsset.growthRate || 0, 0);
    const { code } = getCurrencyConfig(state.profile.country);
    const goldRatePerGram = GOLD_RATE_PER_GRAM_BY_CURRENCY[code] ?? GOLD_RATE_PER_GRAM_BY_CURRENCY.INR;
    const grams = parseNumber(goldGrams, 0);
    const currentValue = isGoldAsset
      ? Math.max(0, grams * goldRatePerGram)
      : parseNumber(newAsset.currentValue || 0, 0);
    const availableFrom = newAsset.availableFrom ? parseNumber(newAsset.availableFrom, currentYear) : undefined;
    const monthlyContribution = hasRegularContribution ? parseNumber(newAsset.monthlyContribution || 0, 0) : 0;
    const contributionStepUp = hasRegularContribution ? parseNumber(newAsset.contributionStepUp || 0, 0) : 0;
    const contributionFrequency = hasRegularContribution ? (newAsset.contributionFrequency || 'Monthly') : 'Monthly';
    const contributionStartYear = hasRegularContribution
      ? (newAsset.contributionStartYear ? parseNumber(newAsset.contributionStartYear, currentYear) : undefined)
      : undefined;
    const contributionEndYear = hasRegularContribution
      ? (newAsset.contributionEndYear ? parseNumber(newAsset.contributionEndYear, currentYear) : undefined)
      : undefined;

    if (subCategory.toLowerCase().includes('other') && name.length < 2) {
      setFormError('Asset name is required for custom/other categories.');
      return;
    }
    if (!owner || (owner !== 'self' && !state.family.find(f => f.id === owner))) {
      setFormError('Owner must be Self or a valid family member.');
      return;
    }
    if (!isVehicleAsset && (growthRate < 0 || growthRate > 30)) {
      setFormError('Growth rate must be between 0% and 30%.');
      return;
    }
    if (isVehicleAsset && Math.abs(growthRate) > 30) {
      setFormError('Depreciation rate must be between 0% and 30%.');
      return;
    }
    if (isGoldAsset && grams <= 0) {
      setFormError('Enter gold quantity in grams to auto-calculate current value.');
      return;
    }
    if (hasRegularContribution && monthlyContribution <= 0) {
      setFormError('Contribution amount must be greater than 0 when regular contribution is enabled.');
      return;
    }
    if (hasRegularContribution && monthlyContribution < 0) {
      setFormError('Monthly contribution cannot be negative.');
      return;
    }
    if (hasRegularContribution && (contributionStepUp < 0 || contributionStepUp > 30)) {
      setFormError('Contribution step-up must be between 0% and 30%.');
      return;
    }
    if (hasRegularContribution && contributionStartYear !== undefined && contributionEndYear !== undefined && contributionStartYear > contributionEndYear) {
      setFormError('Contribution start year must be before end year.');
      return;
    }
    if (currentValue <= 0) {
      setFormWarning('Current value is 0. Consider entering a positive value.');
      setNotice('Asset saved with 0 current value. Consider updating for accuracy.');
      setTimeout(() => setNotice(null), 4000);
    }

    const asset = {
      ...newAsset,
      id: Math.random().toString(36).substr(2, 9),
      name,
      owner,
      purchaseYear: purchaseYear,
      growthRate: isVehicleAsset ? -clampNumber(Math.abs(growthRate), 0, 30) : clampNumber(growthRate, 0, 30),
      currentValue: Math.max(0, currentValue),
      availableFrom: availableFrom,
      monthlyContribution: Math.max(0, monthlyContribution),
      contributionFrequency,
      contributionStepUp: clampNumber(contributionStepUp, 0, 30),
      contributionStartYear,
      contributionEndYear,
    } as Asset;
    updateState({ assets: [...state.assets, asset] });
    setHasRegularContribution(false);
    setGoldGrams('');
    setShowAdd(false);
  };

  const removeAsset = (id: string) => {
    updateState({ assets: state.assets.filter(a => a.id !== id) });
  };

  const getOwnerName = (id: string) => {
    if (id === 'self') return state.profile.firstName || 'Self';
    return state.family.find(f => f.id === id)?.name || 'Unknown';
  };

  const getAssetNamePlaceholder = () => {
    const category = newAsset.category || 'Equity';
    const subCategory = newAsset.subCategory || '';

    const bySubCategory: Record<string, string> = {
      'Savings Account': 'e.g. HDFC Salary Account',
      'Cash': 'e.g. Emergency Cash Reserve',
      'Liquid Mutual Funds': 'e.g. Nippon India Liquid Fund',
      'Overnight Funds': 'e.g. SBI Overnight Fund',
      'Fixed Deposits': 'e.g. SBI 3Y Fixed Deposit',
      'Bonds': 'e.g. GOI 2033 Bond',
      'Corporate Deposits': 'e.g. Bajaj Finance Corporate Deposit',
      'Debt Mutual Funds': 'e.g. HDFC Corporate Bond Fund',
      'PPF': 'e.g. PPF Account',
      'EPF': 'e.g. EPF Corpus',
      'Direct Equity': 'e.g. Reliance Industries Shares',
      'Equity MFs': 'e.g. Parag Parikh Flexi Cap Fund',
      'ELSS (Tax Saver)': 'e.g. Mirae Asset Tax Saver Fund',
      'Index Funds': 'e.g. Nifty 50 Index Fund',
      'Small-cap Funds': 'e.g. SBI Small Cap Fund',
      'Mid-cap Funds': 'e.g. Kotak Emerging Equity Fund',
      'Residential Property': 'e.g. Apartment - Whitefield',
      'Commercial Property': 'e.g. Office Unit - BKC',
      'Land': 'e.g. Plot - Jaipur',
      'REITs': 'e.g. Embassy Office Parks REIT',
      'Physical Gold': 'e.g. Gold Jewellery',
      'Sovereign Gold Bonds': 'e.g. SGB 2028 Series',
      'Gold ETFs': 'e.g. Nippon Gold ETF',
      'Silver': 'e.g. Silver Coins',
      'Vehicle': 'e.g. Hyundai Creta',
      'Art/Collectibles': 'e.g. Contemporary Art Collection',
      'Other Personal Assets': 'e.g. Luxury Watch Collection',
    };

    if (bySubCategory[subCategory]) return bySubCategory[subCategory];

    const byCategory: Record<AssetType, string> = {
      Liquid: 'e.g. Emergency Fund Account',
      Debt: 'e.g. Income Instrument',
      Equity: 'e.g. Growth Portfolio Holding',
      'Real Estate': 'e.g. Property Holding',
      'Gold/Silver': 'e.g. Bullion Holding',
      Personal: 'e.g. Personal Asset',
    };

    return byCategory[category] || 'e.g. Asset Name';
  };

  const isAvailableForGoals = newAsset.availableForGoals !== false;
  const goalAvailabilityHint = isAvailableForGoals
    ? 'Included in goal funding. Planner can use this asset by redemption/sale/pledge when needed.'
    : 'Excluded from goal funding. Planner will keep this asset protected and not use it for goals.';

  const totalAssetsValue = state.assets.reduce((sum, a) => sum + a.currentValue, 0);

  const currencyCountry = state.profile.country;
  const currencySymbol = getCurrencySymbol(currencyCountry);
  const currencyCode = getCurrencyConfig(currencyCountry).code;
  const isGoldAsset = newAsset.category === 'Gold/Silver';
  const goldRatePerGram = GOLD_RATE_PER_GRAM_BY_CURRENCY[currencyCode] ?? GOLD_RATE_PER_GRAM_BY_CURRENCY.INR;
  const goldGramsValue = parseNumber(goldGrams, 0);
  const calculatedGoldValue = goldGramsValue > 0 ? goldGramsValue * goldRatePerGram : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest">
          {notice}
        </div>
      )}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-slate-900">Step 5: Asset Inventory</h3>
          <p className="text-sm font-medium text-slate-500">Log holdings with growth assumptions and ownership for planning.</p>
        </div>
        <button 
          onClick={() => setShowAdd(prev => !prev)}
          className="px-10 py-6 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-2xl"
        >
          <Plus size={20} /> {showAdd ? 'Close Form' : 'Add Asset'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-10 border-b border-slate-100 flex justify-between items-center bg-white/90">
            <h3 className="text-2xl font-black text-slate-900">Add Holding</h3>
            <button onClick={() => setShowAdd(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-900">
              <Plus size={24} className="rotate-45" />
            </button>
          </div>
          <div className="p-6 sm:p-10 space-y-6">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold">
                {formError}
              </div>
            )}
            {formWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-bold">
                {formWarning}
              </div>
            )}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2">
              <div className="flex items-center gap-2 text-slate-700">
                <Info size={14} />
                <p className="text-[10px] font-black uppercase tracking-widest">Assistive Guidance</p>
              </div>
              <p className="text-xs font-semibold text-slate-600">Fill class, type and owner first. For Gold/Silver, enter grams and value is auto-calculated.</p>
              <p className="text-xs font-semibold text-slate-600">Use “Available For Goals” = Yes only for assets you are comfortable using for future goals.</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                 <select 
                   value={newAsset.category}
                   onChange={e => handleCategoryChange(e.target.value as AssetType)}
                   className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none"
                 >
                    {ASSET_CLASSES.map(ac => <option key={ac.name} value={ac.name}>{ac.name}</option>)}
                 </select>
                 <p className="text-[10px] font-bold text-slate-500">Choose the broad asset class first.</p>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub-Category</label>
                 <select 
                   value={newAsset.subCategory}
                   onChange={e => {
                     const nextSubCategory = e.target.value;
                     const currentGrowth = parseNumber(newAsset.growthRate || 0, 0);
                     const nextGrowthRate =
                       newAsset.category === 'Personal' && nextSubCategory === 'Vehicle'
                         ? -(Math.abs(currentGrowth) || 10)
                         : (currentGrowth <= 0 ? 5 : currentGrowth);
                     setNewAsset({ ...newAsset, subCategory: nextSubCategory, growthRate: nextGrowthRate });
                   }}
                   className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none"
                 >
                    {ASSET_CLASSES.find(ac => ac.name === newAsset.category)?.subCategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                 </select>
                 <p className="text-[10px] font-bold text-slate-500">Pick the closest instrument type for better planning assumptions.</p>
              </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Name (Custom)</label>
               <input
                 type="text"
                 placeholder={getAssetNamePlaceholder()}
                 value={newAsset.name}
                 onChange={e => setNewAsset({...newAsset, name: e.target.value})}
                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold"
               />
               <p className="text-[10px] font-bold text-slate-500">Use a name you can recognize instantly in reports (example changes with your selected type).</p>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Percent size={12}/>
                 {newAsset.category === 'Personal' && newAsset.subCategory === 'Vehicle' ? 'Exp. Depreciation (%)' : 'Exp. Growth (%)'}
               </label>
               <input
                 type="number"
                 min={0}
                 max={30}
                 value={
                   newAsset.category === 'Personal' && newAsset.subCategory === 'Vehicle'
                     ? Math.abs(parseNumber(newAsset.growthRate || 0, 0))
                     : (newAsset.growthRate || '')
                 }
                 onChange={e => {
                   const parsed = parseFloat(e.target.value);
                   if (newAsset.category === 'Personal' && newAsset.subCategory === 'Vehicle') {
                     setNewAsset({ ...newAsset, growthRate: Number.isFinite(parsed) ? -Math.abs(parsed) : 0 });
                     return;
                   }
                   setNewAsset({ ...newAsset, growthRate: parsed });
                 }}
                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold"
               />
               <p className="text-[10px] font-bold text-slate-500">
                 {newAsset.category === 'Personal' && newAsset.subCategory === 'Vehicle'
                   ? 'Expected yearly depreciation used in projection (0% to 30%).'
                   : 'Expected yearly return for projection (0% to 30%).'}
               </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                 {isGoldAsset ? (
                   <>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Coins size={12}/> Gold Quantity (grams)</label>
                     <input
                       type="number"
                       min={0}
                       step="0.01"
                       value={goldGrams}
                       onChange={e => setGoldGrams(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold"
                       placeholder="e.g. 25.5"
                     />
                     <p className="text-[10px] font-bold text-slate-500">Enter total grams and planner will auto-calculate current value.</p>
                   </>
                 ) : (
                   <>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Coins size={12}/> Current Value</label>
                     <input type="number" value={newAsset.currentValue || ''} onChange={e => setNewAsset({...newAsset, currentValue: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" placeholder={currencySymbol} />
                     <p className="text-[10px] font-bold text-slate-500">Enter today’s market value, not original purchase amount.</p>
                   </>
                 )}
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={12}/> Owner</label>
                 <select value={newAsset.owner} onChange={e => setNewAsset({...newAsset, owner: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold">
                    <option value="self">Self</option>
                    {state.family.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                 </select>
                 <p className="text-[10px] font-bold text-slate-500">Select who legally owns this asset.</p>
               </div>
            </div>

            {isGoldAsset && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Coins size={12}/> Current Value (Auto)</label>
                <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-black text-slate-900 min-h-[56px] flex items-center">
                  {goldGramsValue > 0 ? formatCurrency(Math.round(calculatedGoldValue), currencyCountry) : 'Waiting for grams'}
                </div>
                <p className="text-[10px] font-bold text-slate-500">
                  Auto-calculated at reference rate {formatCurrency(goldRatePerGram, currencyCountry)} per gram for planning.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Do You Add To This Asset Regularly?</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setHasRegularContribution(true);
                      setNewAsset({
                        ...newAsset,
                        contributionFrequency: newAsset.contributionFrequency || 'Monthly',
                        contributionStartYear: newAsset.contributionStartYear || new Date().getFullYear(),
                        contributionEndYear: newAsset.contributionEndYear || new Date().getFullYear(),
                      });
                    }}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${hasRegularContribution ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                  >
                    Yes, I Add Regularly
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasRegularContribution(false);
                      setNewAsset({
                        ...newAsset,
                        monthlyContribution: 0,
                        contributionStepUp: 0,
                        contributionStartYear: undefined,
                        contributionEndYear: undefined,
                      });
                    }}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${!hasRegularContribution ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                  >
                    No, One-Time Only
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-500">If yes, we will ask contribution amount, frequency, step-up, and years.</p>
              </div>
            </div>

            {hasRegularContribution && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contribution Amount</label>
                    <input
                      type="number"
                      value={newAsset.monthlyContribution || ''}
                      onChange={e => setNewAsset({ ...newAsset, monthlyContribution: parseFloat(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold"
                      placeholder={currencySymbol}
                    />
                    <p className="text-[10px] font-bold text-slate-500">Amount per selected frequency. Must be greater than 0.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contribution Frequency</label>
                    <select
                      value={newAsset.contributionFrequency || 'Monthly'}
                      onChange={e => setNewAsset({ ...newAsset, contributionFrequency: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annually">Annually</option>
                      <option value="One time">One time</option>
                    </select>
                    <p className="text-[10px] font-bold text-slate-500">How often this contribution amount is added.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step-Up %</label>
                    <input
                      type="number"
                      value={newAsset.contributionStepUp || ''}
                      onChange={e => setNewAsset({ ...newAsset, contributionStepUp: parseFloat(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold"
                    />
                    <p className="text-[10px] font-bold text-slate-500">Optional annual increase % in contribution.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contribution Start Year</label>
                    <input
                      type="number"
                      value={newAsset.contributionStartYear || ''}
                      onChange={e => setNewAsset({ ...newAsset, contributionStartYear: parseInt(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold"
                    />
                    <p className="text-[10px] font-bold text-slate-500">Optional start year for recurring contribution.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contribution End Year</label>
                    <input
                      type="number"
                      value={newAsset.contributionEndYear || ''}
                      onChange={e => setNewAsset({ ...newAsset, contributionEndYear: parseInt(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold"
                    />
                    <p className="text-[10px] font-bold text-slate-500">Optional end year for recurring contribution.</p>
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available For Goals</label>
                <p className="text-[10px] font-bold text-slate-500">
                  If Yes, this asset can be used to fund goals by withdrawal/sale/pledge.
                  If No, the planner keeps it excluded.
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setNewAsset({...newAsset, availableForGoals: true, availableFrom: newAsset.availableFrom || new Date().getFullYear()})} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${newAsset.availableForGoals ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    Yes, Use For Goals
                  </button>
                  <button type="button" onClick={() => setNewAsset({...newAsset, availableForGoals: false, availableFrom: undefined})} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${newAsset.availableForGoals === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    No, Keep Protected
                  </button>
                </div>
                <div className={`p-3 rounded-xl border text-xs font-semibold leading-relaxed ${isAvailableForGoals ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  {goalAvailabilityHint}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available From</label>
                <input
                  type="number"
                  value={newAsset.availableFrom || ''}
                  onChange={e => setNewAsset({...newAsset, availableFrom: parseInt(e.target.value)})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="e.g. 2028"
                  disabled={!isAvailableForGoals}
                />
                <p className="text-[10px] font-bold text-slate-500">
                  {isAvailableForGoals
                    ? 'Year from which this asset can be used for goals.'
                    : 'Not required when asset is kept protected.'}
                </p>
              </div>
            </div>

            <button onClick={handleAdd} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-lg shadow-xl hover:bg-teal-600 transition-all">Secure Asset Record</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex flex-col justify-center">
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Assets</p>
          <h4 className="text-3xl font-black text-emerald-900">{formatCurrency(totalAssetsValue, currencyCountry)}</h4>
        </div>
        {ASSET_CLASSES.map(ac => {
          const val = state.assets.filter(a => a.category === ac.name).reduce((sum, a) => sum + a.currentValue, 0);
          return (
            <div key={ac.name} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{ac.name}</p>
              <h4 className="text-lg font-black text-slate-900">{formatCurrency(val, currencyCountry)}</h4>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {state.assets.map((asset) => (
          <div key={asset.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm group hover:border-emerald-400 transition-all">
             <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all`}>
                  {ASSET_CLASSES.find(ac => ac.name === asset.category)?.icon && React.createElement(ASSET_CLASSES.find(ac => ac.name === asset.category)!.icon, { size: 24 })}
                </div>
                <div className="flex gap-2">
                  {asset.availableForGoals ? (
                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">For Goals</span>
                  ) : (
                    <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-rose-100">Personal</span>
                  )}
                  <button onClick={() => removeAsset(asset.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
             </div>
             <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-black text-slate-900">{asset.name || asset.subCategory}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{asset.category} • {asset.subCategory}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Owner: {getOwnerName(asset.owner)}</p>
                </div>
                <div className="flex justify-between items-end">
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Current Value</p>
                      <p className="text-2xl font-black text-slate-900">{formatCurrency(asset.currentValue, currencyCountry)}</p>
                   </div>
                   <div className="text-right">
                      <p className={`text-[10px] font-black uppercase ${asset.category === 'Personal' && asset.subCategory === 'Vehicle' ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {asset.category === 'Personal' && asset.subCategory === 'Vehicle'
                          ? `Depreciation: ${Math.abs(asset.growthRate)}%`
                          : `Growth: ${asset.growthRate}%`}
                      </p>
                   </div>
                </div>
             </div>
          </div>
        ))}
      </div>

          </div>
  );
};

export default Assets;
