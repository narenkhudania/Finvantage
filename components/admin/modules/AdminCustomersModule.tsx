import React from 'react';
import { Download, Search } from 'lucide-react';
import type { AdminCustomer } from '../../../services/admin/types';
import { AppButton, SurfaceCard } from '../../common/ui';

interface AdminCustomersModuleProps {
  customers: AdminCustomer[];
  customerSearch: string;
  customerKycFilter: string;
  selectedCustomerIds: Record<string, boolean>;
  selectedCustomerList: AdminCustomer[];
  busy: boolean;
  setCustomerSearch: (value: string) => void;
  setCustomerKycFilter: (value: string) => void;
  setSelectedCustomerIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onLoadCustomers: () => void;
  onExportCustomersCsv: () => void;
  onOpenTimeline: (customer: AdminCustomer) => void;
  onCustomerAction: (
    action: 'block' | 'unblock' | 'force_logout',
    userIds: string[],
    reason?: string
  ) => void;
  renderPill: (value: string) => React.ReactNode;
  formatDate: (value?: string | null) => string;
}

const AdminCustomersModule: React.FC<AdminCustomersModuleProps> = ({
  customers,
  customerSearch,
  customerKycFilter,
  selectedCustomerIds,
  selectedCustomerList,
  busy,
  setCustomerSearch,
  setCustomerKycFilter,
  setSelectedCustomerIds,
  onLoadCustomers,
  onExportCustomersCsv,
  onOpenTimeline,
  onCustomerAction,
  renderPill,
  formatDate,
}) => {
  return (
    <div className="space-y-5">
      <SurfaceCard variant="elevated" padding="none" className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
              placeholder="Search by email, name, or UUID"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <select
              value={customerKycFilter}
              onChange={(event) => setCustomerKycFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              <option value="">All KYC</option>
              <option value="not_started">Not Started</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <AppButton tone="primary" size="md" onClick={onLoadCustomers}>
              Apply
            </AppButton>

            <AppButton
              tone="secondary"
              size="md"
              onClick={onExportCustomersCsv}
              leadingIcon={<Download size={13} />}
            >
              CSV
            </AppButton>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard variant="elevated" padding="none" className="overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[620px] xl:min-w-[880px] 2xl:min-w-[1050px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={customers.length > 0 && selectedCustomerList.length === customers.length}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      const map: Record<string, boolean> = {};
                      if (checked) customers.forEach((item) => (map[item.user_id] = true));
                      setSelectedCustomerIds(map);
                    }}
                  />
                </th>
                {['Customer', 'Country', 'Risk', 'KYC', 'Plan', 'Blocked', 'Updated', 'Actions'].map((header) => (
                  <th
                    key={header}
                    className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.user_id} className="border-t border-slate-100 hover:bg-teal-50/35">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedCustomerIds[customer.user_id])}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelectedCustomerIds((prev) => {
                          const next = { ...prev };
                          if (checked) next[customer.user_id] = true;
                          else delete next[customer.user_id];
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm font-black text-slate-800">{customer.first_name} {customer.last_name || ''}</p>
                    <p className="text-xs text-slate-500">{customer.email}</p>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{customer.country || '-'}</td>
                  <td className="px-3 py-3">{renderPill(customer.risk_level || 'unknown')}</td>
                  <td className="px-3 py-3">{renderPill(customer.kyc_status || 'not_started')}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{customer.plan_code || '-'}</td>
                  <td className="px-3 py-3">{renderPill(customer.blocked ? 'blocked' : 'active')}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(customer.updated_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <AppButton
                        tone="secondary"
                        size="sm"
                        onClick={() => onOpenTimeline(customer)}
                        className="!px-2.5 !py-1.5"
                      >
                        Timeline
                      </AppButton>
                      <AppButton
                        tone={customer.blocked ? 'primary' : 'danger'}
                        size="sm"
                        onClick={() =>
                          onCustomerAction(
                            customer.blocked ? 'unblock' : 'block',
                            [customer.user_id],
                            customer.blocked ? undefined : 'Manual risk action'
                          )
                        }
                        className="!px-2.5 !py-1.5"
                      >
                        {customer.blocked ? 'Unblock' : 'Block'}
                      </AppButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <SurfaceCard variant="elevated" padding="none" className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <AppButton
            tone="danger"
            size="md"
            disabled={!selectedCustomerList.length || busy}
            onClick={() =>
              onCustomerAction('block', selectedCustomerList.map((item) => item.user_id), 'Bulk risk action')
            }
          >
            Block ({selectedCustomerList.length})
          </AppButton>
          <AppButton
            tone="primary"
            size="md"
            disabled={!selectedCustomerList.length || busy}
            onClick={() => onCustomerAction('unblock', selectedCustomerList.map((item) => item.user_id))}
          >
            Unblock
          </AppButton>
          <AppButton
            tone="secondary"
            size="md"
            disabled={!selectedCustomerList.length || busy}
            onClick={() =>
              onCustomerAction(
                'force_logout',
                selectedCustomerList.map((item) => item.user_id),
                'Session reset requested by operations'
              )
            }
          >
            Force Logout
          </AppButton>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default AdminCustomersModule;
