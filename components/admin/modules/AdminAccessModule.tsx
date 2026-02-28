import React from 'react';
import type {
  AdminPermissionDefinition,
  AdminRole,
  AdminSecuritySession,
  AdminTwoFactorSetup,
  AdminTwoFactorStatus,
  AdminUserAccount,
} from '../../../services/admin/types';
import { AppButton, SurfaceCard } from '../../common/ui';

export interface AdminAccessFormState {
  userId: string;
  roleId: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
}

interface AdminAccessModuleProps {
  busy: boolean;
  adminUsers: AdminUserAccount[];
  adminRoles: AdminRole[];
  adminPermissions: AdminPermissionDefinition[];
  adminForm: AdminAccessFormState;
  setAdminForm: React.Dispatch<React.SetStateAction<AdminAccessFormState>>;
  twoFactorStatus: AdminTwoFactorStatus | null;
  twoFactorSetup: AdminTwoFactorSetup | null;
  totpCode: string;
  setTotpCode: (value: string) => void;
  secondFactorCode: string;
  setSecondFactorCode: (value: string) => void;
  recoveryCodesDraft: string;
  setRecoveryCodesDraft: (value: string) => void;
  sessionTargetUserId: string;
  setSessionTargetUserId: (value: string) => void;
  securitySessions: AdminSecuritySession[];
  renderPill: (value: string) => React.ReactNode;
  formatDate: (value?: string | null) => string;
  formatNumber: (value: number) => string;
  onToggleActive: (admin: AdminUserAccount) => void;
  onToggleTwoFactorRequirement: (admin: AdminUserAccount) => void;
  onSaveMembership: () => void;
  onGenerateTotpSetup: () => void;
  onDisableTwoFactor: () => void;
  onVerifyEnableTwoFactor: () => void;
  onVerifyCurrentSession: () => void;
  onSaveRecoveryCodes: () => void;
  onRefreshSessions: () => void;
  onRevokeSession: (session: AdminSecuritySession) => void;
}

const AdminAccessModule: React.FC<AdminAccessModuleProps> = ({
  busy,
  adminUsers,
  adminRoles,
  adminPermissions,
  adminForm,
  setAdminForm,
  twoFactorStatus,
  twoFactorSetup,
  totpCode,
  setTotpCode,
  secondFactorCode,
  setSecondFactorCode,
  recoveryCodesDraft,
  setRecoveryCodesDraft,
  sessionTargetUserId,
  setSessionTargetUserId,
  securitySessions,
  renderPill,
  formatDate,
  formatNumber,
  onToggleActive,
  onToggleTwoFactorRequirement,
  onSaveMembership,
  onGenerateTotpSetup,
  onDisableTwoFactor,
  onVerifyEnableTwoFactor,
  onVerifyCurrentSession,
  onSaveRecoveryCodes,
  onRefreshSessions,
  onRevokeSession,
}) => {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black tracking-tight text-slate-900">Workspace Users & Roles</h3>
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">{adminUsers.length} members</span>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[620px] xl:min-w-[880px] 2xl:min-w-[980px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['User', 'Role', '2FA Required', '2FA Enabled', 'Active', 'Last Login', 'Actions'].map((header) => (
                    <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((admin) => (
                  <tr key={admin.userId} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <p className="font-black text-slate-800">{admin.name || admin.email}</p>
                      <p className="text-xs text-slate-500">{admin.email}</p>
                    </td>
                    <td className="px-3 py-3">{renderPill(admin.roleName)}</td>
                    <td className="px-3 py-3">{renderPill(admin.twoFactorRequired ? 'required' : 'optional')}</td>
                    <td className="px-3 py-3">{renderPill(admin.twoFactorEnabled ? 'enabled' : 'disabled')}</td>
                    <td className="px-3 py-3">{renderPill(admin.isActive ? 'active' : 'inactive')}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{formatDate(admin.lastLoginAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <AppButton
                          tone={admin.isActive ? 'danger' : 'primary'}
                          size="sm"
                          className="!px-2.5 !py-1.5"
                          onClick={() => onToggleActive(admin)}
                          disabled={busy}
                        >
                          {admin.isActive ? 'Deactivate' : 'Activate'}
                        </AppButton>
                        <AppButton
                          tone="secondary"
                          size="sm"
                          className="!px-2.5 !py-1.5"
                          onClick={() => onToggleTwoFactorRequirement(admin)}
                          disabled={busy}
                        >
                          {admin.twoFactorRequired ? 'Make Optional' : 'Require 2FA'}
                        </AppButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <SurfaceCard variant="elevated" padding="none" className="h-fit p-5">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Add / Update Workspace User</h3>
          <p className="mt-2 text-xs font-semibold text-slate-500">Assign one of: Admin, Manager, Analyst, Support.</p>

          <div className="mt-4 space-y-3">
            <input
              value={adminForm.userId}
              onChange={(event) => setAdminForm((prev) => ({ ...prev, userId: event.target.value }))}
              placeholder="Workspace User UUID"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <select
              value={adminForm.roleId}
              onChange={(event) => setAdminForm((prev) => ({ ...prev, roleId: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {adminRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.displayName}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600">
              <input
                type="checkbox"
                checked={adminForm.isActive}
                onChange={(event) => setAdminForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Active
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600">
              <input
                type="checkbox"
                checked={adminForm.twoFactorRequired}
                onChange={(event) =>
                  setAdminForm((prev) => ({
                    ...prev,
                    twoFactorRequired: event.target.checked,
                    twoFactorEnabled: event.target.checked,
                  }))
                }
              />
              Require 2FA
            </label>
          </div>

          <AppButton tone="primary" size="md" className="mt-4" onClick={onSaveMembership} disabled={busy}>
            Save Membership
          </AppButton>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Role Permission Matrix</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Route + service/data layer checks use this workspace mapping.</p>
          <div className="mt-4 space-y-3">
            {adminRoles.map((role) => (
              <div key={role.roleKey} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-900">{role.displayName}</p>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {(role.permissionKeys || []).length} permissions
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{role.description || 'No description'}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(role.permissionKeys || []).slice(0, 10).map((permission) => (
                    <span key={`${role.roleKey}-${permission}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
                      {permission}
                    </span>
                  ))}
                  {(role.permissionKeys || []).length > 10 && (
                    <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500">
                      +{(role.permissionKeys || []).length - 10} more
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!adminRoles.length && <p className="text-xs font-semibold text-slate-500">No role data available.</p>}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Defined Permissions</p>
            <p className="mt-1 text-lg font-black text-slate-900">{formatNumber(adminPermissions.length)}</p>
          </div>
        </SurfaceCard>

        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Security Settings (Your Account)</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">2FA Status</p>
              <p className="mt-1 text-sm font-black text-slate-900">{twoFactorStatus?.status || 'disabled'}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recovery Codes Left</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formatNumber(twoFactorStatus?.recoveryCodesRemaining || 0)}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <AppButton tone="primary" size="md" onClick={onGenerateTotpSetup} disabled={busy}>
              Generate TOTP Setup
            </AppButton>
            <AppButton tone="danger" size="md" onClick={onDisableTwoFactor} disabled={busy}>
              Disable 2FA
            </AppButton>
          </div>

          {twoFactorSetup && (
            <div className="mt-4 space-y-2 rounded-2xl border border-teal-100 bg-teal-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">TOTP Secret</p>
              <p className="break-all text-sm font-black text-teal-900">{twoFactorSetup.secret}</p>
              <a href={twoFactorSetup.otpAuthUrl} className="text-xs font-semibold text-teal-700 underline">
                Open in authenticator URI handler
              </a>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <input
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              placeholder="Enter 6-digit code to enable 2FA"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <AppButton tone="primary" size="md" onClick={onVerifyEnableTwoFactor} disabled={busy}>
              Verify & Enable 2FA
            </AppButton>
          </div>

          <div className="mt-4 space-y-2">
            <input
              value={secondFactorCode}
              onChange={(event) => setSecondFactorCode(event.target.value)}
              placeholder="Verify current session using TOTP or recovery code"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <AppButton tone="secondary" size="md" onClick={onVerifyCurrentSession} disabled={busy}>
              Verify Current Session
            </AppButton>
          </div>

          <div className="mt-4">
            <textarea
              value={recoveryCodesDraft}
              onChange={(event) => setRecoveryCodesDraft(event.target.value)}
              rows={5}
              placeholder="Recovery codes (one per line)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            />
            <AppButton tone="secondary" size="md" className="mt-2" onClick={onSaveRecoveryCodes} disabled={busy}>
              Save Recovery Codes
            </AppButton>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard variant="elevated" padding="none" className="p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Session Monitoring</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={sessionTargetUserId}
              onChange={(event) => setSessionTargetUserId(event.target.value)}
              placeholder="Filter by user UUID (optional)"
              className="min-w-[180px] sm:min-w-[280px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            />
            <AppButton tone="primary" size="md" onClick={onRefreshSessions} disabled={busy}>
              Refresh Sessions
            </AppButton>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[620px] xl:min-w-[900px] 2xl:min-w-[1080px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['User', 'Role', 'Device', 'IP', 'Started', 'Last Seen', '2FA Verified', 'State', 'Actions'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {securitySessions.map((session) => (
                <tr key={session.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <p className="font-black text-slate-800">{session.fullName || session.email || session.userId}</p>
                    <p className="text-xs text-slate-500">{session.email || session.userId}</p>
                  </td>
                  <td className="px-3 py-3">{renderPill(session.roleKey || '-')}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{session.deviceName || '-'}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{session.ipAddress || '-'}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(session.startedAt)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(session.lastSeenAt)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(session.twoFactorVerifiedAt)}</td>
                  <td className="px-3 py-3">{renderPill(session.revokedAt ? 'revoked' : 'active')}</td>
                  <td className="px-3 py-3">
                    <AppButton
                      tone="danger"
                      size="sm"
                      className="!px-2.5 !py-1.5"
                      disabled={Boolean(session.revokedAt) || busy}
                      onClick={() => onRevokeSession(session)}
                    >
                      Revoke
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

export default AdminAccessModule;
