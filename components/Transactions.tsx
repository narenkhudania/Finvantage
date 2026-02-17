
import React, { useState } from 'react';
import { Plus, Search, Filter, Download } from 'lucide-react';
import { Transaction, TransactionType } from '../types';

interface TransactionsProps {
  transactions: Transaction[];
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
}

const Transactions: React.FC<TransactionsProps> = ({ transactions, onAddTransaction }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTx, setNewTx] = useState({
    description: '',
    amount: '',
    category: 'Groceries',
    type: 'expense' as TransactionType,
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTransaction({
      ...newTx,
      amount: parseFloat(newTx.amount),
    });
    setShowAddModal(false);
    setNewTx({ description: '', amount: '', category: 'Groceries', type: 'expense', date: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            Add Transaction
          </button>
          <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl flex items-center gap-2 font-medium hover:bg-slate-50 transition-colors">
            <Download size={18} />
            Export
          </button>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Filter list..."
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-500 text-sm">Date</th>
              <th className="px-6 py-4 font-semibold text-slate-500 text-sm">Description</th>
              <th className="px-6 py-4 font-semibold text-slate-500 text-sm">Category</th>
              <th className="px-6 py-4 font-semibold text-slate-500 text-sm">Type</th>
              <th className="px-6 py-4 font-semibold text-slate-500 text-sm text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">{t.description}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                    {t.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {t.type}
                  </span>
                </td>
                <td className={`px-6 py-4 text-sm font-bold text-right ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {t.type === 'income' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Add Transaction</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input 
                  required
                  type="text" 
                  value={newTx.description}
                  onChange={(e) => setNewTx({...newTx, description: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Starbucks"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={newTx.amount}
                    onChange={(e) => setNewTx({...newTx, amount: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select 
                    value={newTx.type}
                    onChange={(e) => setNewTx({...newTx, type: e.target.value as TransactionType})}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select 
                  value={newTx.category}
                  onChange={(e) => setNewTx({...newTx, category: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option>Groceries</option>
                  <option>Entertainment</option>
                  <option>Rent/Utilities</option>
                  <option>Salary</option>
                  <option>Shopping</option>
                  <option>Dining</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input 
                  type="date" 
                  value={newTx.date}
                  onChange={(e) => setNewTx({...newTx, date: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors mt-4"
              >
                Create Transaction
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
