import React from 'react';
import { Search } from 'lucide-react';
import type { AdminPortfolioRow } from '../../../services/admin/types';
import { AppButton, SurfaceCard } from '../../common/ui';

interface AdminPortfolioModuleProps {
  portfolioRows: AdminPortfolioRow[];
  portfolioSearch: string;
  setPortfolioSearch: (value: string) => void;
  onLoadPortfolio: () => void;
  onOpenPortfolioDetail: (row: AdminPortfolioRow) => void;
  renderPill: (value: string) => React.ReactNode;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
  formatDate: (value?: string | null) => string;
}

const AdminPortfolioModule: React.FC<AdminPortfolioModuleProps> = ({
  portfolioRows,
  portfolioSearch,
  setPortfolioSearch,
  onLoadPortfolio,
  onOpenPortfolioDetail,
  renderPill,
  formatCurrency,
  formatNumber,
  formatDate,
}) => {
  return (
    <div className="space-y-5">
      <SurfaceCard variant="elevated" padding="none" className="p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
            placeholder="Search household by email/name"
            value={portfolioSearch}
            onChange={(event) => setPortfolioSearch(event.target.value)}
          />
          <AppButton tone="primary" size="sm" onClick={onLoadPortfolio} className="!py-1.5">
            Search
          </AppButton>
        </div>
      </SurfaceCard>

      <SurfaceCard variant="elevated" padding="none" className="overflow-hidden">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead className="bg-slate-50">
              <tr>
                {['Customer', 'Assets', 'Liabilities', 'Net Worth', 'Goals', 'Txns', 'Risk', 'KYC', 'Last Txn', 'Actions'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {portfolioRows.map((row) => (
                <tr key={row.userId} className="border-t border-slate-100 hover:bg-teal-50/35">
                  <td className="px-3 py-3">
                    <p className="text-sm font-black text-slate-800">{row.name}</p>
                    <p className="text-xs text-slate-500">{row.email}</p>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-700">{formatCurrency(row.totalAssets)}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-700">{formatCurrency(row.totalLiabilities)}</td>
                  <td className="px-3 py-3 text-sm font-black text-teal-700">{formatCurrency(row.netWorth)}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatNumber(row.goalsCount)}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatNumber(row.transactionsCount)}</td>
                  <td className="px-3 py-3">{renderPill(row.riskLevel || 'unknown')}</td>
                  <td className="px-3 py-3">{renderPill(row.kycStatus || 'not_started')}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(row.lastTransactionAt)}</td>
                  <td className="px-3 py-3">
                    <AppButton
                      tone="secondary"
                      size="sm"
                      onClick={() => onOpenPortfolioDetail(row)}
                      className="!px-2.5 !py-1.5"
                    >
                      Drilldown
                    </AppButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default AdminPortfolioModule;
