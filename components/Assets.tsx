
import React, { useState } from 'react';
import { FinanceState, Asset, AssetType } from '../types';
import { Plus, Trash2, Coins, TrendingUp, Home, Landmark, Briefcase, Car, Gem, CheckCircle2, Circle, Calendar, Percent, Users } from 'lucide-react';
import { clampNumber, parseNumber } from '../lib/validation';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';

const ASSET_CLASSES: { name: AssetType, icon: any, subCategories: string[] }[] = [
  { name: 'Liquid', icon: Landmark, subCategories: ['Savings Account', 'Cash', 'Liquid Mutual Funds', 'Overnight Funds'] },
  { name: 'Debt', icon: Briefcase, subCategories: ['Fixed Deposits', 'Bonds', 'Corporate Deposits', 'Debt Mutual Funds', 'PPF', 'EPF'] },
  { name: 'Equity', icon: TrendingUp, subCategories: ['Direct Equity', 'Equity MFs', 'ELSS (Tax Saver)', 'Index Funds', 'Small-cap Funds', 'Mid-cap Funds'] },
  { name: 'Real Estate', icon: Home, subCategories: ['Residential Property', 'Commercial Property', 'Land', 'REITs'] },
  { name: 'Gold/Silver', icon: Coins, subCategories: ['Physical Gold', 'Sovereign Gold Bonds', 'Gold ETFs', 'Silver'] },
  { name: 'Personal', icon: Car, subCategories: ['Vehicle', 'Art/Collectibles', 'Other Personal Assets'] },
];

const Assets: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
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
    setNewAsset({
      ...newAsset,
      category,
      subCategory: assetClass?.subCategories[0] || '',
      growthRate: category === 'Equity' ? 10 : 5
    });
  };

  const handleAdd = () => {
    setFormError(null);
    setFormWarning(null);
    const currentYear = new Date().getFullYear();
    const name = (newAsset.name || '').trim();
    const subCategory = newAsset.subCategory || '';
    const owner = newAsset.owner || 'self';
    const purchaseYear = parseNumber(newAsset.purchaseYear || currentYear, currentYear);
    const growthRate = parseNumber(newAsset.growthRate || 0, 0);
    const currentValue = parseNumber(newAsset.currentValue || 0, 0);
    const availableFrom = newAsset.availableFrom ? parseNumber(newAsset.availableFrom, purchaseYear) : undefined;
    const monthlyContribution = parseNumber(newAsset.monthlyContribution || 0, 0);
    const contributionStepUp = parseNumber(newAsset.contributionStepUp || 0, 0);
    const contributionFrequency = newAsset.contributionFrequency || 'Monthly';
    const contributionStartYear = newAsset.contributionStartYear ? parseNumber(newAsset.contributionStartYear, purchaseYear) : undefined;
    const contributionEndYear = newAsset.contributionEndYear ? parseNumber(newAsset.contributionEndYear, purchaseYear) : undefined;

    if (subCategory.toLowerCase().includes('other') && name.length < 2) {
      setFormError('Asset name is required for custom/other categories.');
      return;
    }
    if (!owner || (owner !== 'self' && !state.family.find(f => f.id === owner))) {
      setFormError('Owner must be Self or a valid family member.');
      return;
    }
    if (purchaseYear > currentYear) {
      setFormError('Purchase year cannot be in the future.');
      return;
    }
    if (growthRate < 0 || growthRate > 30) {
      setFormError('Growth rate must be between 0% and 30%.');
      return;
    }
    if (availableFrom !== undefined && availableFrom < purchaseYear) {
      setFormError('Available-from year cannot be earlier than purchase year.');
      return;
    }
    if (monthlyContribution < 0) {
      setFormError('Monthly contribution cannot be negative.');
      return;
    }
    if (contributionStepUp < 0 || contributionStepUp > 30) {
      setFormError('Contribution step-up must be between 0% and 30%.');
      return;
    }
    if (contributionStartYear !== undefined && contributionEndYear !== undefined && contributionStartYear > contributionEndYear) {
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
      growthRate: clampNumber(growthRate, 0, 30),
      currentValue: Math.max(0, currentValue),
      availableFrom: availableFrom,
      monthlyContribution: Math.max(0, monthlyContribution),
      contributionFrequency,
      contributionStepUp: clampNumber(contributionStepUp, 0, 30),
      contributionStartYear,
      contributionEndYear,
    } as Asset;
    updateState({ assets: [...state.assets, asset] });
    setShowAdd(false);
  };

  const removeAsset = (id: string) => {
    updateState({ assets: state.assets.filter(a => a.id !== id) });
  };

  const getOwnerName = (id: string) => {
    if (id === 'self') return state.profile.firstName || 'Self';
    return state.family.find(f => f.id === id)?.name || 'Unknown';
  };

  const totalAssetsValue = state.assets.reduce((sum, a) => sum + a.currentValue, 0);

  const currencyCountry = state.profile.country;
  const currencySymbol = getCurrencySymbol(currencyCountry);

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
          <p className="text-sm font-medium text-slate-500">Log holdings with specific growth rates and purchase history.</p>
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
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub-Category</label>
                 <select 
                   value={newAsset.subCategory}
                   onChange={e => setNewAsset({...newAsset, subCategory: e.target.value})}
                   className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none"
                 >
                    {ASSET_CLASSES.find(ac => ac.name === newAsset.category)?.subCategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                 </select>
              </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Name (Custom)</label>
               <input type="text" placeholder="e.g. Parag Parikh Flexi Cap" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" />
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> Purchase Year</label>
                 <input type="number" value={newAsset.purchaseYear || ''} onChange={e => setNewAsset({...newAsset, purchaseYear: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Percent size={12}/> Exp. Growth (%)</label>
                 <input type="number" value={newAsset.growthRate || ''} onChange={e => setNewAsset({...newAsset, growthRate: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Coins size={12}/> Current Value</label>
                 <input type="number" value={newAsset.currentValue || ''} onChange={e => setNewAsset({...newAsset, currentValue: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" placeholder={currencySymbol} />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={12}/> Owner</label>
                 <select value={newAsset.owner} onChange={e => setNewAsset({...newAsset, owner: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold">
                    <option value="self">Self</option>
                    {state.family.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Contribution</label>
                <input
                  type="number"
                  value={newAsset.monthlyContribution || ''}
                  onChange={e => setNewAsset({ ...newAsset, monthlyContribution: parseFloat(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold"
                  placeholder={currencySymbol}
                />
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
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contribution Start Year</label>
                <input
                  type="number"
                  value={newAsset.contributionStartYear || ''}
                  onChange={e => setNewAsset({ ...newAsset, contributionStartYear: parseInt(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contribution End Year</label>
                <input
                  type="number"
                  value={newAsset.contributionEndYear || ''}
                  onChange={e => setNewAsset({ ...newAsset, contributionEndYear: parseInt(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available For Goals</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setNewAsset({...newAsset, availableForGoals: true})} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${newAsset.availableForGoals ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    Yes
                  </button>
                  <button type="button" onClick={() => setNewAsset({...newAsset, availableForGoals: false})} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${newAsset.availableForGoals === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    No
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available From</label>
                <input type="number" value={newAsset.availableFrom || ''} onChange={e => setNewAsset({...newAsset, availableFrom: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" />
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
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Purchased: {asset.purchaseYear} • Owner: {getOwnerName(asset.owner)}</p>
                </div>
                <div className="flex justify-between items-end">
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Current Value</p>
                      <p className="text-2xl font-black text-slate-900">{formatCurrency(asset.currentValue, currencyCountry)}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-emerald-500 uppercase">Growth: {asset.growthRate}%</p>
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
