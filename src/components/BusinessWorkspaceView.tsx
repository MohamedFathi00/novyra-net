import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Download,
  Laptop,
  Plus,
  Printer,
  ScrollText,
  Trash2,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import type {
  Language,
  OrganizationActivityLogDoc,
  OrganizationDeviceDoc,
  OrganizationDoc,
  OrganizationMemberDoc,
  OrgRole,
  SpeedTestResult,
} from '../types/network';
import { useAuth } from '../context/AuthContext';
import { canUseFeature } from '../services/entitlementService';
import {
  addOrUpdateOrgMember,
  createOrganizationWorkspace,
  deleteOrgDevice,
  fetchOrgActivityLogs,
  fetchOrgDevices,
  fetchOrgMembers,
  fetchUserOrganizations,
  registerOrgDevice,
  removeOrgMember,
  updateOrgDeviceTelemetry,
} from '../services/cloudSyncService';
import { printNetworkReport } from '../services/exportService';
import { PremiumFeatureLock } from './PremiumFeatureLock';

interface BusinessWorkspaceViewProps {
  language: Language;
  latestTest?: SpeedTestResult | null;
  onUpgrade: () => void;
  onRequireAuth: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string) => void;
}

export const BusinessWorkspaceView: React.FC<BusinessWorkspaceViewProps> = ({
  language,
  latestTest,
  onUpgrade,
  onRequireAuth,
  onNotify,
}) => {
  const isAr = language === 'ar';
  const { user, emailVerified, profile, entitlements, featureFlags } = useAuth();
  const allowed = canUseFeature('team_workspaces', entitlements, featureFlags);

  const [orgs, setOrgs] = useState<OrganizationDoc[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrganizationMemberDoc[]>([]);
  const [orgDevices, setOrgDevices] = useState<OrganizationDeviceDoc[]>([]);
  const [activityLogs, setActivityLogs] = useState<OrganizationActivityLogDoc[]>([]);

  const [newOrgName, setNewOrgName] = useState('');
  const [memberUidInput, setMemberUidInput] = useState('');
  const [memberNameInput, setMemberNameInput] = useState('');
  const [memberRoleInput, setMemberRoleInput] = useState<OrgRole>('viewer');

  const [devName, setDevName] = useState('');
  const [devLoc, setDevLoc] = useState('');
  const [updatingDeviceId, setUpdatingDeviceId] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    if (!user || !emailVerified || !allowed) return;
    const list = await fetchUserOrganizations(user.uid);
    setOrgs(list);
    if (list.length > 0 && !selectedOrgId) {
      setSelectedOrgId(list[0].id);
    }
  }, [allowed, emailVerified, selectedOrgId, user]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const activeOrg = orgs.find((o) => o.id === selectedOrgId) ?? orgs[0] ?? null;

  const loadOrgDetails = useCallback(async () => {
    if (!activeOrg) return;
    const [m, d, logs] = await Promise.all([
      fetchOrgMembers(activeOrg.id, activeOrg.ownerId).catch(() => []),
      fetchOrgDevices(activeOrg.id, activeOrg.ownerId).catch(() => []),
      fetchOrgActivityLogs(activeOrg.id, activeOrg.ownerId, 40).catch(() => []),
    ]);
    setMembers(m);
    setOrgDevices(d);
    setActivityLogs(logs);
  }, [activeOrg]);

  useEffect(() => {
    loadOrgDetails();
  }, [loadOrgDetails]);

  const currentMemberRole: OrgRole = useMemo(() => {
    if (!activeOrg || !user) return 'viewer';
    if (activeOrg.ownerId === user.uid) return 'owner';
    return members.find((m) => m.userId === user.uid)?.role ?? 'viewer';
  }, [activeOrg, members, user]);

  const canManageMembers = currentMemberRole === 'owner' || currentMemberRole === 'admin';
  const canManageDevices =
    currentMemberRole === 'owner' || currentMemberRole === 'admin' || currentMemberRole === 'manager';
  const canDeleteDevices = currentMemberRole === 'owner' || currentMemberRole === 'admin';

  const fleetTelemetry = useMemo(() => {
    const online = orgDevices.filter((d) => d.status === 'online').length;
    const degraded = orgDevices.filter((d) => d.status === 'degraded').length;
    const offline = orgDevices.filter((d) => d.status === 'offline').length;
    const withDl = orgDevices.filter((d) => typeof d.lastDownloadMbps === 'number');
    const withPing = orgDevices.filter((d) => typeof d.lastPingMs === 'number');
    const avgDl = withDl.length
      ? withDl.reduce((sum, d) => sum + (d.lastDownloadMbps ?? 0), 0) / withDl.length
      : null;
    const avgPing = withPing.length
      ? withPing.reduce((sum, d) => sum + (d.lastPingMs ?? 0), 0) / withPing.length
      : null;
    return { online, degraded, offline, avgDl, avgPing };
  }, [orgDevices]);

  const handleExportFleetCsv = () => {
    if (!activeOrg) return;
    const header = ['Org', 'Device ID', 'Device Name', 'Location', 'Status', 'Last Download Mbps', 'Last Ping ms'];
    const rows = orgDevices.map((d) => [
      `"${activeOrg.name.replace(/"/g, '""')}"`,
      d.id,
      `"${d.name.replace(/"/g, '""')}"`,
      `"${(d.location || '').replace(/"/g, '""')}"`,
      d.status,
      d.lastDownloadMbps ?? '',
      d.lastPingMs ?? '',
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `novyra-fleet-${activeOrg.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!allowed) {
    return (
      <PremiumFeatureLock
        language={language}
        featureTitle="NOVYRA Business — Organizations & Multi-Role Fleet"
        featureTitleAr="مساحات عمل الأعمال (NOVYRA Business) وإدارة الفرق والأجهزة"
        description="Manage company organizations, assign Owner / Admin / Manager / Viewer member roles, centralize fleet telemetry, and track organization activity audit logs."
        descriptionAr="أنشئ مؤسسات عمل، وزّع صلاحيات الأعضاء (Owner / Admin / Manager / Viewer)، وراقب قياسات أجهزة الفروع مركزياً مع سجلات نشاط المؤسسة."
        requiredPlan="business"
        currentPlan={entitlements.planId}
        isSignedIn={Boolean(user)}
        onUpgrade={onUpgrade}
        onSignIn={onRequireAuth}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2 text-[#eef0ff]">
            <Building2 className="h-5 w-5 text-[#f5b942]" />
            <span>{isAr ? 'مساحة عمل المؤسسات والفرق' : 'Business Organizations & Team Workspace'}</span>
          </h2>
          <p className="text-xs text-[#9aa0d6] mt-0.5">
            {isAr
              ? 'إدارة الأعضاء بصلاحيات محددة، الأجهزة المعتمدة، القياس المركزي، وسجلات نشاط المؤسسة.'
              : 'Manage organization roles (Owner / Admin / Manager / Viewer), centralized branch telemetry, and audit logs.'}
          </p>
        </div>

        {activeOrg && (
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={handleExportFleetCsv}
              disabled={orgDevices.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#262a6b] bg-[#0d1033] px-3 py-2 text-xs font-bold text-[#eef0ff] hover:border-[#18c8ff] disabled:opacity-45"
            >
              <Download className="h-3.5 w-3.5 text-[#18c8ff]" />
              <span>{isAr ? 'تصدير تقرير الأسطول CSV' : 'Export Fleet CSV'}</span>
            </button>
            <button
              type="button"
              onClick={printNetworkReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#262a6b] bg-[#0d1033] px-3 py-2 text-xs font-bold text-[#eef0ff] hover:border-[#18c8ff]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{isAr ? 'طباعة' : 'Print'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Create or Switch Organization */}
      <div className="nv-card p-5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelectedOrgId(o.id)}
              className={`rounded-xl px-3.5 py-2 font-bold ${
                activeOrg?.id === o.id
                  ? 'nv-btn-primary'
                  : 'border border-[#262a6b] bg-[#0d1033] text-[#cfd3ff]'
              }`}
            >
              {o.name}
            </button>
          ))}
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!user || newOrgName.trim().length < 2) return;
            const id = await createOrganizationWorkspace({
              ownerId: user.uid,
              ownerDisplayName: profile?.displayName || user.displayName || 'Owner',
              name: newOrgName.trim(),
            });
            setNewOrgName('');
            setSelectedOrgId(id);
            onNotify('success', isAr ? 'تم إنشاء المؤسسة' : 'Organization workspace created');
            await loadOrgs();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder={isAr ? 'اسم مؤسسة جديدة' : 'New organization name'}
            className="rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-xl nv-btn-primary px-3.5 py-2 font-bold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isAr ? 'إنشاء' : 'Create'}</span>
          </button>
        </form>
      </div>

      {activeOrg && (
        <>
          {/* Centralized Team Telemetry Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
            <div className="nv-card p-4">
              <div className="text-[#9aa0d6]">{isAr ? 'دورك في المؤسسة' : 'Your Org Role'}</div>
              <div className="font-display text-lg font-bold text-[#f5b942] uppercase mt-1">
                {isAr
                  ? currentMemberRole === 'owner'
                    ? 'مالك'
                    : currentMemberRole === 'admin'
                      ? 'مسؤول'
                      : currentMemberRole === 'manager'
                        ? 'مدير تشغيل'
                        : 'مشاهد'
                  : currentMemberRole}
              </div>
            </div>
            <div className="nv-card p-4">
              <div className="text-[#9aa0d6]">{isAr ? 'المقاعد المستخدمة' : 'Seats Used'}</div>
              <div className="font-display text-lg font-bold font-mono-tabular text-[#eef0ff] mt-1">
                {members.length} / {activeOrg.maxSeats}
              </div>
            </div>
            <div className="nv-card p-4">
              <div className="text-[#9aa0d6]">{isAr ? 'حالة أجهزة الأسطول' : 'Fleet Status'}</div>
              <div className="font-mono-tabular font-bold mt-1 flex items-center gap-2 text-sm">
                <span className="text-[#22e06b]">{fleetTelemetry.online} {isAr ? 'متصل' : 'ON'}</span>
                <span className="text-[#f5b942]">{fleetTelemetry.degraded} {isAr ? 'متدهور' : 'DEG'}</span>
                <span className="text-[#f06478]">{fleetTelemetry.offline} {isAr ? 'متوقف' : 'OFF'}</span>
              </div>
            </div>
            <div className="nv-card p-4">
              <div className="text-[#9aa0d6]">{isAr ? 'متوسط تحميل الفروع' : 'Avg Fleet Download'}</div>
              <div className="font-display text-lg font-bold font-mono-tabular text-[#18c8ff] mt-1">
                {fleetTelemetry.avgDl !== null ? `${fleetTelemetry.avgDl.toFixed(1)} Mbps` : '—'}
              </div>
            </div>
            <div className="nv-card p-4">
              <div className="text-[#9aa0d6]">{isAr ? 'متوسط Ping الأسطول' : 'Avg Fleet Ping'}</div>
              <div className="font-display text-lg font-bold font-mono-tabular text-[#a855f7] mt-1">
                {fleetTelemetry.avgPing !== null ? `${fleetTelemetry.avgPing.toFixed(1)} ms` : '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
            {/* Organization Members */}
            <div className="nv-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#18c8ff]" />
                  <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                    {isAr ? 'أعضاء المؤسسة والصلاحيات' : 'Organization Members'}
                  </h3>
                </div>
                <span className="font-mono-tabular text-[#9aa0d6]">
                  {members.length} / {activeOrg.maxSeats}
                </span>
              </div>

              {canManageMembers && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!user || !memberUidInput.trim() || !memberNameInput.trim()) return;
                    await addOrUpdateOrgMember({
                      orgId: activeOrg.id,
                      orgOwnerId: activeOrg.ownerId,
                      memberUid: memberUidInput.trim(),
                      displayName: memberNameInput.trim(),
                      role: memberRoleInput,
                      actorId: user.uid,
                    });
                    setMemberUidInput('');
                    setMemberNameInput('');
                    onNotify('success', isAr ? 'تمت إضافة العضو' : 'Member updated');
                    await loadOrgDetails();
                  }}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-2"
                >
                  <input
                    type="text"
                    required
                    value={memberUidInput}
                    onChange={(e) => setMemberUidInput(e.target.value)}
                    placeholder="Firebase UID"
                    className="rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 font-mono-tabular text-[#eef0ff]"
                  />
                  <input
                    type="text"
                    required
                    value={memberNameInput}
                    onChange={(e) => setMemberNameInput(e.target.value)}
                    placeholder={isAr ? 'الاسم' : 'Display Name'}
                    className="rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
                  />
                  <select
                    value={memberRoleInput}
                    onChange={(e) => setMemberRoleInput(e.target.value as OrgRole)}
                    className="rounded-xl border border-[#262a6b] bg-[#0a0d33] px-2.5 py-2 text-[#eef0ff]"
                  >
                    <option value="viewer">{isAr ? 'مشاهد' : 'Viewer'}</option>
                    <option value="manager">{isAr ? 'مدير تشغيل' : 'Manager'}</option>
                    <option value="admin">{isAr ? 'مسؤول' : 'Admin'}</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1 rounded-xl nv-btn-primary py-2 font-bold"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>{isAr ? 'إضافة' : 'Add'}</span>
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.userId} className="nv-inner px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-[#eef0ff]">{m.displayName}</div>
                      <div className="text-[11px] font-mono-tabular text-[#9aa0d6]">
                        {m.userId} ·{' '}
                        <span className="text-[#18c8ff] uppercase">
                          {isAr
                            ? m.role === 'owner'
                              ? 'مالك'
                              : m.role === 'admin'
                                ? 'مسؤول'
                                : m.role === 'manager'
                                  ? 'مدير'
                                  : 'مشاهد'
                            : m.role}
                        </span>
                      </div>
                    </div>
                    {canManageMembers && m.userId !== activeOrg.ownerId && (
                      <button
                        type="button"
                        onClick={async () => {
                          await removeOrgMember(activeOrg.id, m.userId, {
                            orgOwnerId: activeOrg.ownerId,
                            actorId: user?.uid,
                            targetLabel: m.displayName,
                          });
                          await loadOrgDetails();
                        }}
                        className="text-[#9aa0d6] hover:text-[#f06478]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Organization Devices & Telemetry Updates */}
            <div className="nv-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-[#a855f7]" />
                  <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                    {isAr ? 'أجهزة المؤسسة والقياس المركزي' : 'Authorized Fleet Devices & Telemetry'}
                  </h3>
                </div>
                <span className="font-mono-tabular text-[#9aa0d6]">{orgDevices.length}</span>
              </div>

              {canManageDevices && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!user || !devName.trim()) return;
                    await registerOrgDevice({
                      orgId: activeOrg.id,
                      orgOwnerId: activeOrg.ownerId,
                      actorId: user.uid,
                      name: devName.trim(),
                      location: devLoc.trim() || undefined,
                      ...(latestTest
                        ? {
                            lastDownloadMbps: Number(latestTest.downloadMbps.toFixed(2)),
                            lastPingMs: Number(latestTest.pingMs.toFixed(1)),
                          }
                        : {}),
                    });
                    setDevName('');
                    setDevLoc('');
                    onNotify('success', isAr ? 'تم تسجيل جهاز المؤسسة' : 'Organization device added');
                    await loadOrgDetails();
                  }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  <input
                    type="text"
                    required
                    value={devName}
                    onChange={(e) => setDevName(e.target.value)}
                    placeholder={isAr ? 'اسم الجهاز / الفرع' : 'Branch Router / Node'}
                    className="rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
                  />
                  <input
                    type="text"
                    value={devLoc}
                    onChange={(e) => setDevLoc(e.target.value)}
                    placeholder={isAr ? 'الموقع' : 'Location (e.g. Cairo HQ)'}
                    className="rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1 rounded-xl nv-btn-primary py-2 font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isAr ? 'تسجيل' : 'Register'}</span>
                  </button>
                </form>
              )}

              {orgDevices.length === 0 ? (
                <div className="py-6 text-center text-[#9aa0d6]">
                  {isAr ? 'لا توجد أجهزة مسجلة لهذه المؤسسة.' : 'No organization devices yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {orgDevices.map((d) => {
                    const statusColor =
                      d.status === 'online'
                        ? 'text-[#22e06b]'
                        : d.status === 'degraded'
                          ? 'text-[#f5b942]'
                          : 'text-[#f06478]';
                    const nextStatus: OrganizationDeviceDoc['status'] =
                      d.status === 'online' ? 'degraded' : d.status === 'degraded' ? 'offline' : 'online';
                    return (
                      <div key={d.id} className="nv-inner px-3.5 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-[#eef0ff]">{d.name}</div>
                            <div className="text-[11px] text-[#9aa0d6]">
                              {d.location || '—'} ·{' '}
                              <span className={`uppercase font-bold ${statusColor}`}>
                                {isAr
                                  ? d.status === 'online'
                                    ? 'متصل'
                                    : d.status === 'degraded'
                                      ? 'متدهور'
                                      : 'غير متصل'
                                  : d.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-mono-tabular">
                            {d.lastDownloadMbps !== undefined && (
                              <span className="text-[#18c8ff] font-bold">
                                ↓ {d.lastDownloadMbps.toFixed(1)} Mbps
                              </span>
                            )}
                            {d.lastPingMs !== undefined && (
                              <span className="text-[#a855f7]">{d.lastPingMs.toFixed(0)} ms</span>
                            )}
                          </div>
                        </div>

                        {canManageDevices && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#262a6b]/50">
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={updatingDeviceId === d.id}
                                onClick={async () => {
                                  if (!user) return;
                                  setUpdatingDeviceId(d.id);
                                  try {
                                    await updateOrgDeviceTelemetry({
                                      orgId: activeOrg.id,
                                      orgOwnerId: activeOrg.ownerId,
                                      actorId: user.uid,
                                      deviceId: d.id,
                                      deviceName: d.name,
                                      status: nextStatus,
                                    });
                                    await loadOrgDetails();
                                  } finally {
                                    setUpdatingDeviceId(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#262a6b] bg-[#0a0d33] px-2.5 py-1 text-[11px] font-semibold text-[#cfd3ff] hover:border-[#18c8ff]"
                              >
                                <Activity className="h-3 w-3 text-[#18c8ff]" />
                                <span>{isAr ? 'تبديل الحالة' : 'Cycle Status'}</span>
                              </button>

                              {latestTest && (
                                <button
                                  type="button"
                                  disabled={updatingDeviceId === d.id}
                                  onClick={async () => {
                                    if (!user) return;
                                    setUpdatingDeviceId(d.id);
                                    try {
                                      await updateOrgDeviceTelemetry({
                                        orgId: activeOrg.id,
                                        orgOwnerId: activeOrg.ownerId,
                                        actorId: user.uid,
                                        deviceId: d.id,
                                        deviceName: d.name,
                                        status: latestTest.pingMs > 120 ? 'degraded' : 'online',
                                        lastDownloadMbps: latestTest.downloadMbps,
                                        lastPingMs: latestTest.pingMs,
                                      });
                                      onNotify(
                                        'success',
                                        isAr
                                          ? `تم تسجيل آخر قياس (${latestTest.downloadMbps.toFixed(1)} Mbps) للجهاز ${d.name}`
                                          : `Synced benchmark to ${d.name}`,
                                      );
                                      await loadOrgDetails();
                                    } finally {
                                      setUpdatingDeviceId(null);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#7a6bff]/50 bg-[#6555FF]/15 px-2.5 py-1 text-[11px] font-semibold text-[#eef0ff] hover:border-[#18c8ff]"
                                >
                                  <Zap className="h-3 w-3 text-[#22e06b]" />
                                  <span>{isAr ? 'تسجيل أحدث قياس سرعة' : 'Sync Latest Benchmark'}</span>
                                </button>
                              )}
                            </div>

                            {canDeleteDevices && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteOrgDevice(activeOrg.id, d.id, {
                                    orgOwnerId: activeOrg.ownerId,
                                    actorId: user?.uid,
                                    targetLabel: d.name,
                                  });
                                  await loadOrgDetails();
                                }}
                                className="text-[#9aa0d6] hover:text-[#f06478]"
                                aria-label="Remove device"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Organization Activity Audit Logs */}
          <div className="nv-card p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-[#18c8ff]" />
                <h3 className="font-display text-sm font-bold text-[#eef0ff]">
                  {isAr ? 'سجل نشاط المؤسسة والتدقيق' : 'Organization Activity Audit Logs'}
                </h3>
              </div>
              <span className="font-mono-tabular text-[#9aa0d6]">{activityLogs.length}</span>
            </div>

            {activityLogs.length === 0 ? (
              <p className="text-[#9aa0d6]">
                {isAr
                  ? 'ستظهر هنا سجلات إنشاء المؤسسة وتحديثات الأعضاء والأجهزة فور تنفيذ أي إجراء.'
                  : 'Member additions, device registrations, and telemetry updates appear here automatically.'}
              </p>
            ) : (
              <div className="space-y-2 font-mono-tabular">
                {activityLogs.slice(0, 20).map((log) => {
                  const sec = (log.createdAt as { seconds?: number } | undefined)?.seconds;
                  const timeLabel = sec ? new Date(sec * 1000).toLocaleString() : '—';
                  return (
                    <div
                      key={log.id}
                      className="nv-inner px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#18c8ff]/15 px-2 py-0.5 text-[10px] font-bold text-[#18c8ff]">
                          {log.action}
                        </span>
                        {log.target && <span className="font-sans font-bold text-[#eef0ff]">{log.target}</span>}
                        {log.details && <span className="font-sans text-[#cfd3ff]">· {log.details}</span>}
                      </div>
                      <span className="text-[11px] text-[#9aa0d6]">{timeLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
