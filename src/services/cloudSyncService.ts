import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { DEFAULT_PLAN_CATALOG } from './entitlementService';
import type {
  AlertRuleDoc,
  AuditLogDoc,
  CouponDoc,
  FeatureFlagDoc,
  MonitoringSnapshotDoc,
  OrganizationActivityLogDoc,
  OrganizationDeviceDoc,
  OrganizationDoc,
  OrganizationMemberDoc,
  OrgRole,
  PaymentRecordDoc,
  PlanId,
  SpeedTestResult,
  SubscriptionPlanConfig,
  SupportTicketDoc,
  UserDeviceDoc,
  UserEntitlementDoc,
  UserPrivateInfoDoc,
  UserProfileDoc,
  UserSubscriptionDoc,
} from '../types/network';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

export async function ensureUserAccountDocs(params: {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string | null;
  language: 'en' | 'ar';
  country?: string;
  isBootstrapAdmin: boolean;
}): Promise<void> {
  const uid = params.uid;

  if (params.isBootstrapAdmin) {
    const adminRef = doc(db, 'admins', uid);
    try {
      const snap = await getDoc(adminRef);
      if (!snap.exists()) {
        await setDoc(adminRef, {
          uid,
          grantedAt: serverTimestamp(),
          grantedBy: 'bootstrap',
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${uid}`);
    }
  }

  const profileRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(profileRef);
    if (!snap.exists()) {
      await setDoc(profileRef, {
        uid,
        displayName: (params.displayName || 'NOVYRA User').slice(0, 100),
        ...(params.photoUrl ? { photoUrl: params.photoUrl.slice(0, 512) } : {}),
        language: params.language,
        accountStatus: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (params.isBootstrapAdmin && snap.data()?.accountStatus === 'suspended') {
      await updateDoc(profileRef, {
        accountStatus: 'active',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }

  const privateRef = doc(db, 'users', uid, 'private', 'info');
  try {
    const pSnap = await getDoc(privateRef);
    if (!pSnap.exists()) {
      await setDoc(privateRef, {
        uid,
        email: params.email.slice(0, 200),
        ...(params.country ? { country: params.country.slice(0, 80) } : {}),
        acceptedTermsAt: serverTimestamp(),
        marketingOptIn: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/private/info`);
  }
}

export async function fetchUserProfileAndBilling(uid: string): Promise<{
  profile: UserProfileDoc | null;
  privateInfo: UserPrivateInfoDoc | null;
  subscription: UserSubscriptionDoc | null;
  entitlement: UserEntitlementDoc | null;
  isAdminDoc: boolean;
}> {
  let profile: UserProfileDoc | null = null;
  let privateInfo: UserPrivateInfoDoc | null = null;
  let subscription: UserSubscriptionDoc | null = null;
  let entitlement: UserEntitlementDoc | null = null;
  let isAdminDoc = false;

  try {
    const pSnap = await getDoc(doc(db, 'users', uid));
    if (pSnap.exists()) profile = pSnap.data() as UserProfileDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}`);
  }

  try {
    const privSnap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    if (privSnap.exists()) privateInfo = privSnap.data() as UserPrivateInfoDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}/private/info`);
  }

  try {
    const subSnap = await getDoc(doc(db, 'users', uid, 'subscriptions', 'current'));
    if (subSnap.exists()) subscription = subSnap.data() as UserSubscriptionDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}/subscriptions/current`);
  }

  try {
    const entSnap = await getDoc(doc(db, 'users', uid, 'entitlements', 'current'));
    if (entSnap.exists()) entitlement = entSnap.data() as UserEntitlementDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}/entitlements/current`);
  }

  try {
    const admSnap = await getDoc(doc(db, 'admins', uid));
    isAdminDoc = admSnap.exists();
  } catch {
    isAdminDoc = false;
  }

  return { profile, privateInfo, subscription, entitlement, isAdminDoc };
}

export async function updateUserProfileFields(
  uid: string,
  updates: { displayName?: string; photoUrl?: string; language?: 'en' | 'ar'; country?: string; marketingOptIn?: boolean },
): Promise<void> {
  if (updates.displayName !== undefined || updates.photoUrl !== undefined || updates.language !== undefined) {
    try {
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.displayName !== undefined) payload.displayName = updates.displayName.slice(0, 100);
      if (updates.photoUrl !== undefined) payload.photoUrl = updates.photoUrl.slice(0, 512);
      if (updates.language !== undefined) payload.language = updates.language;
      await updateDoc(doc(db, 'users', uid), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  }

  if (updates.country !== undefined || updates.marketingOptIn !== undefined) {
    try {
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.country !== undefined) payload.country = updates.country.slice(0, 80);
      if (updates.marketingOptIn !== undefined) payload.marketingOptIn = updates.marketingOptIn;
      await updateDoc(doc(db, 'users', uid, 'private', 'info'), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/private/info`);
    }
  }
}

// =========================================================================
// GLOBAL CATALOG & FEATURE FLAGS
// =========================================================================
export async function fetchPlansCatalog(): Promise<Record<PlanId, SubscriptionPlanConfig>> {
  const result: Record<PlanId, SubscriptionPlanConfig> = { ...DEFAULT_PLAN_CATALOG };
  try {
    const snaps = await getDocs(collection(db, 'plans'));
    snaps.forEach((s) => {
      const d = s.data() as SubscriptionPlanConfig;
      if (d.id === 'free' || d.id === 'pro' || d.id === 'business') {
        result[d.id] = d;
      }
    });
  } catch {
    // Public fallback defaults remain accurate if catalog isn't seeded yet
  }
  return result;
}

export async function fetchFeatureFlags(): Promise<Record<string, FeatureFlagDoc>> {
  const result: Record<string, FeatureFlagDoc> = {};
  try {
    const snaps = await getDocs(collection(db, 'featureFlags'));
    snaps.forEach((s) => {
      const d = s.data() as FeatureFlagDoc;
      if (d.key) result[d.key] = d;
    });
  } catch {
    // Default flags apply
  }
  return result;
}

export async function validateCouponCode(code: string, planId: PlanId | 'any'): Promise<CouponDoc | null> {
  const cleanId = sanitizeId(code.trim().toUpperCase());
  try {
    const snap = await getDoc(doc(db, 'coupons', cleanId));
    if (!snap.exists()) return null;
    const c = snap.data() as CouponDoc;
    if (!c.active) return null;
    if (c.usedCount >= c.maxUses) return null;
    if (planId !== 'any' && c.applicablePlan !== 'all' && c.applicablePlan !== planId) return null;
    if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return null;
    return c;
  } catch {
    return null;
  }
}

// =========================================================================
// CLOUD SPEED TEST HISTORY, DEVICES, ALERTS & MONITORING
// =========================================================================
export async function fetchCloudTestHistory(uid: string, maxItems = 200): Promise<SpeedTestResult[]> {
  try {
    const q = query(
      collection(db, 'users', uid, 'testHistory'),
      where('userId', '==', uid),
      limit(maxItems),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d): SpeedTestResult => {
        const data = d.data();
        return {
          id: String(data.id),
          timestamp: String(data.timestamp),
          downloadMbps: Number(data.downloadMbps ?? 0),
          uploadMbps: Number(data.uploadMbps ?? 0),
          pingMs: Number(data.pingMs ?? 0),
          minPingMs: Number(data.minPingMs ?? data.pingMs ?? 0),
          maxPingMs: Number(data.maxPingMs ?? data.pingMs ?? 0),
          downloadLatencyMs: null,
          uploadLatencyMs: null,
          jitterMs: Number(data.jitterMs ?? 0),
          probeLossPercent: typeof data.probeLossPercent === 'number' ? data.probeLossPercent : null,
          latencyMethod: 'HTTP/TCP RTT',
          lossMethod: typeof data.probeLossPercent === 'number' ? 'HTTP Probe Loss' : 'Untested',
          serverId: String(data.serverId ?? 'novyra-core'),
          serverName: String(data.serverName ?? 'NOVYRA Speed Engine'),
          serverLocation: String(data.serverLocation ?? ''),
          connectionType: typeof data.connectionType === 'string' ? data.connectionType : null,
          effectiveType: typeof data.effectiveType === 'string' ? data.effectiveType : null,
          publicIp: typeof data.publicIp === 'string' ? data.publicIp : null,
          isp: typeof data.isp === 'string' ? data.isp : null,
          status: (data.status as SpeedTestResult['status']) ?? 'completed',
          durationSec: Number(data.durationSec ?? 0),
          bytesTransferred: Number(data.bytesTransferred ?? 0),
          notes: typeof data.notes === 'string' ? data.notes : undefined,
          deviceId: typeof data.deviceId === 'string' ? data.deviceId : undefined,
          syncedToCloud: true,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${uid}/testHistory`);
  }
}

export async function saveTestRecordToCloud(uid: string, record: SpeedTestResult): Promise<void> {
  const testId = sanitizeId(record.id);
  const path = `users/${uid}/testHistory/${testId}`;
  try {
    const payload: Record<string, unknown> = {
      id: testId,
      userId: uid,
      timestamp: record.timestamp.slice(0, 64),
      downloadMbps: Number(record.downloadMbps.toFixed(2)),
      uploadMbps: Number(record.uploadMbps.toFixed(2)),
      pingMs: Number(record.pingMs.toFixed(2)),
      minPingMs: Number(record.minPingMs.toFixed(2)),
      maxPingMs: Number(record.maxPingMs.toFixed(2)),
      jitterMs: Number(record.jitterMs.toFixed(2)),
      serverId: (record.serverId || 'novyra-core').slice(0, 80),
      serverName: (record.serverName || 'NOVYRA Speed Engine').slice(0, 120),
      status: record.status,
      durationSec: Math.max(0, Number(record.durationSec)),
      bytesTransferred: Math.max(0, Number(record.bytesTransferred)),
      createdAt: serverTimestamp(),
    };
    if (record.probeLossPercent !== null && record.probeLossPercent !== undefined) {
      payload.probeLossPercent = Math.min(100, Math.max(0, Number(record.probeLossPercent)));
    }
    if (record.serverLocation) payload.serverLocation = record.serverLocation.slice(0, 120);
    if (record.connectionType) payload.connectionType = record.connectionType.slice(0, 40);
    if (record.effectiveType) payload.effectiveType = record.effectiveType.slice(0, 40);
    if (record.publicIp) payload.publicIp = record.publicIp.slice(0, 64);
    if (record.isp) payload.isp = record.isp.slice(0, 120);
    if (record.deviceId) payload.deviceId = sanitizeId(record.deviceId);
    if (record.notes) payload.notes = record.notes.slice(0, 500);

    await setDoc(doc(db, 'users', uid, 'testHistory', testId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCloudTestRecord(uid: string, testId: string): Promise<void> {
  const clean = sanitizeId(testId);
  try {
    await deleteDoc(doc(db, 'users', uid, 'testHistory', clean));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}/testHistory/${clean}`);
  }
}

export async function syncLocalHistoryToCloud(uid: string, records: SpeedTestResult[]): Promise<number> {
  let uploaded = 0;
  for (const rec of records.slice(0, 50)) {
    const clean = sanitizeId(rec.id);
    const ref = doc(db, 'users', uid, 'testHistory', clean);
    try {
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        await saveTestRecordToCloud(uid, rec);
        uploaded += 1;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/testHistory/${clean}`);
    }
  }
  return uploaded;
}

export async function fetchUserDevices(uid: string): Promise<UserDeviceDoc[]> {
  try {
    const q = query(collection(db, 'users', uid, 'devices'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserDeviceDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${uid}/devices`);
  }
}

export async function saveUserDevice(
  uid: string,
  device: Omit<UserDeviceDoc, 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const id = sanitizeId(device.id);
  try {
    await setDoc(doc(db, 'users', uid, 'devices', id), {
      id,
      userId: uid,
      name: device.name.slice(0, 100),
      deviceType: device.deviceType,
      ...(device.browserLabel ? { browserLabel: device.browserLabel.slice(0, 120) } : {}),
      ...(device.isp ? { isp: device.isp.slice(0, 120) } : {}),
      ...(device.connectionType ? { connectionType: device.connectionType.slice(0, 40) } : {}),
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `users/${uid}/devices/${id}`);
  }
}

export async function deleteUserDevice(uid: string, deviceId: string): Promise<void> {
  const id = sanitizeId(deviceId);
  try {
    await deleteDoc(doc(db, 'users', uid, 'devices', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}/devices/${id}`);
  }
}

export async function fetchUserPayments(uid: string): Promise<PaymentRecordDoc[]> {
  try {
    const q = query(
      collection(db, 'users', uid, 'payments'),
      where('userId', '==', uid),
      limit(50),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as PaymentRecordDoc), id: d.id }))
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${uid}/payments`);
  }
}

export async function fetchAlertRules(uid: string): Promise<AlertRuleDoc[]> {
  try {
    const q = query(collection(db, 'users', uid, 'alerts'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AlertRuleDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${uid}/alerts`);
  }
}

export async function saveAlertRule(
  uid: string,
  rule: Omit<AlertRuleDoc, 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const id = sanitizeId(rule.id);
  try {
    await setDoc(doc(db, 'users', uid, 'alerts', id), {
      id,
      userId: uid,
      name: rule.name.slice(0, 100),
      metric: rule.metric,
      operator: rule.operator,
      threshold: Math.max(0, Number(rule.threshold)),
      enabled: Boolean(rule.enabled),
      channel: rule.channel,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `users/${uid}/alerts/${id}`);
  }
}

export async function toggleAlertRule(uid: string, alertId: string, enabled: boolean): Promise<void> {
  const id = sanitizeId(alertId);
  try {
    await updateDoc(doc(db, 'users', uid, 'alerts', id), {
      enabled,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/alerts/${id}`);
  }
}

export async function deleteAlertRule(uid: string, alertId: string): Promise<void> {
  const id = sanitizeId(alertId);
  try {
    await deleteDoc(doc(db, 'users', uid, 'alerts', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}/alerts/${id}`);
  }
}

export async function saveMonitoringSnapshot(
  uid: string,
  snapshot: Omit<MonitoringSnapshotDoc, 'userId' | 'createdAt'>,
): Promise<void> {
  const id = sanitizeId(snapshot.id);
  try {
    await setDoc(doc(db, 'users', uid, 'monitoringRecords', id), {
      id,
      userId: uid,
      avgLatencyMs: Math.max(0, Number(snapshot.avgLatencyMs)),
      ...(snapshot.minLatencyMs !== undefined ? { minLatencyMs: Math.max(0, Number(snapshot.minLatencyMs)) } : {}),
      ...(snapshot.maxLatencyMs !== undefined ? { maxLatencyMs: Math.max(0, Number(snapshot.maxLatencyMs)) } : {}),
      interruptions: Math.max(0, Number(snapshot.interruptions)),
      onlinePercent: Math.min(100, Math.max(0, Number(snapshot.onlinePercent))),
      sampleCount: Math.max(1, Number(snapshot.sampleCount)),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `users/${uid}/monitoringRecords/${id}`);
  }
}

export async function fetchMonitoringSnapshots(
  uid: string,
  maxItems = 25,
): Promise<MonitoringSnapshotDoc[]> {
  try {
    const q = query(
      collection(db, 'users', uid, 'monitoringRecords'),
      where('userId', '==', uid),
      limit(maxItems),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as MonitoringSnapshotDoc)
      .sort((a, b) => {
        const tsA = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
        const tsB = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
        return tsB - tsA || b.id.localeCompare(a.id);
      });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${uid}/monitoringRecords`);
  }
}

// =========================================================================
// SUPPORT TICKETS
// =========================================================================
export async function fetchUserSupportTickets(uid: string): Promise<SupportTicketDoc[]> {
  try {
    const q = query(collection(db, 'supportTickets'), where('userId', '==', uid), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as SupportTicketDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'supportTickets');
  }
}

export async function createSupportTicket(params: {
  uid: string;
  subject: string;
  category: SupportTicketDoc['category'];
  priority: SupportTicketDoc['priority'];
  message: string;
}): Promise<string> {
  const id = sanitizeId(`tkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'supportTickets', id), {
      id,
      userId: params.uid,
      subject: params.subject.trim().slice(0, 140),
      category: params.category,
      priority: params.priority,
      status: 'open',
      message: params.message.trim().slice(0, 3000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `supportTickets/${id}`);
  }
}

export async function closeOwnSupportTicket(ticketId: string): Promise<void> {
  const id = sanitizeId(ticketId);
  try {
    await updateDoc(doc(db, 'supportTickets', id), {
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${id}`);
  }
}

// =========================================================================
// BUSINESS ORGANIZATIONS
// =========================================================================
export async function fetchUserOrganizations(uid: string): Promise<OrganizationDoc[]> {
  const map = new Map<string, OrganizationDoc>();
  try {
    const ownedQ = query(collection(db, 'organizations'), where('ownerId', '==', uid));
    const ownedSnap = await getDocs(ownedQ);
    ownedSnap.forEach((d) => map.set(d.id, d.data() as OrganizationDoc));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'organizations');
  }

  try {
    const memberQ = query(collectionGroup(db, 'members'), where('userId', '==', uid));
    const memberSnap = await getDocs(memberQ);
    for (const mDoc of memberSnap.docs) {
      const mData = mDoc.data() as OrganizationMemberDoc;
      if (mData.status === 'active' && !map.has(mData.orgId)) {
        try {
          const oSnap = await getDoc(doc(db, 'organizations', mData.orgId));
          if (oSnap.exists()) map.set(oSnap.id, oSnap.data() as OrganizationDoc);
        } catch {
          // Ignore single unreadable org
        }
      }
    }
  } catch {
    // Member collectionGroup lookup optional
  }

  return Array.from(map.values());
}

export async function createOrganizationWorkspace(params: {
  ownerId: string;
  ownerDisplayName: string;
  name: string;
}): Promise<string> {
  const orgId = sanitizeId(`org_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'organizations', orgId), {
      id: orgId,
      name: params.name.trim().slice(0, 100),
      ownerId: params.ownerId,
      planId: 'business',
      status: 'active',
      maxSeats: 25,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'organizations', orgId, 'members', params.ownerId), {
      orgId,
      orgOwnerId: params.ownerId,
      userId: params.ownerId,
      displayName: params.ownerDisplayName.slice(0, 100) || 'Owner',
      role: 'owner',
      status: 'active',
      addedBy: params.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeOrgActivityLog({
      orgId,
      orgOwnerId: params.ownerId,
      actorId: params.ownerId,
      action: 'ORG_CREATED',
      target: params.name.trim().slice(0, 100),
      details: 'Initialized Business organization workspace',
    });
    return orgId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `organizations/${orgId}`);
  }
}

export async function fetchOrgMembers(orgId: string, orgOwnerId: string): Promise<OrganizationMemberDoc[]> {
  try {
    const q = query(
      collection(db, 'organizations', orgId, 'members'),
      where('orgOwnerId', '==', orgOwnerId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as OrganizationMemberDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `organizations/${orgId}/members`);
  }
}

export async function addOrUpdateOrgMember(params: {
  orgId: string;
  orgOwnerId: string;
  memberUid: string;
  displayName: string;
  role: OrgRole;
  actorId: string;
}): Promise<void> {
  const mId = sanitizeId(params.memberUid);
  try {
    await setDoc(doc(db, 'organizations', params.orgId, 'members', mId), {
      orgId: params.orgId,
      orgOwnerId: params.orgOwnerId,
      userId: mId,
      displayName: params.displayName.slice(0, 100),
      role: params.role,
      status: 'active',
      addedBy: params.actorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeOrgActivityLog({
      orgId: params.orgId,
      orgOwnerId: params.orgOwnerId,
      actorId: params.actorId,
      action: 'MEMBER_UPSERT',
      target: params.displayName.slice(0, 100),
      details: `Assigned role=${params.role} to ${mId}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `organizations/${params.orgId}/members/${mId}`);
  }
}

export async function removeOrgMember(
  orgId: string,
  memberUid: string,
  meta?: { orgOwnerId?: string; actorId?: string; targetLabel?: string },
): Promise<void> {
  const mId = sanitizeId(memberUid);
  try {
    await deleteDoc(doc(db, 'organizations', orgId, 'members', mId));
    if (meta?.orgOwnerId && meta?.actorId) {
      await writeOrgActivityLog({
        orgId,
        orgOwnerId: meta.orgOwnerId,
        actorId: meta.actorId,
        action: 'MEMBER_REMOVED',
        target: (meta.targetLabel || mId).slice(0, 120),
        details: `Removed member ${mId}`,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `organizations/${orgId}/members/${mId}`);
  }
}

export async function fetchOrgDevices(orgId: string, orgOwnerId: string): Promise<OrganizationDeviceDoc[]> {
  try {
    const q = query(
      collection(db, 'organizations', orgId, 'devices'),
      where('orgOwnerId', '==', orgOwnerId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as OrganizationDeviceDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `organizations/${orgId}/devices`);
  }
}

export async function registerOrgDevice(params: {
  orgId: string;
  orgOwnerId: string;
  actorId: string;
  name: string;
  location?: string;
  lastDownloadMbps?: number;
  lastPingMs?: number;
}): Promise<string> {
  const devId = sanitizeId(`odev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'organizations', params.orgId, 'devices', devId), {
      id: devId,
      orgId: params.orgId,
      orgOwnerId: params.orgOwnerId,
      name: params.name.trim().slice(0, 100),
      ...(params.location ? { location: params.location.trim().slice(0, 120) } : {}),
      registeredBy: params.actorId,
      status: 'online',
      ...(params.lastDownloadMbps !== undefined ? { lastDownloadMbps: params.lastDownloadMbps } : {}),
      ...(params.lastPingMs !== undefined ? { lastPingMs: params.lastPingMs } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeOrgActivityLog({
      orgId: params.orgId,
      orgOwnerId: params.orgOwnerId,
      actorId: params.actorId,
      action: 'DEVICE_REGISTERED',
      target: params.name.trim().slice(0, 100),
      details: params.location ? `Location: ${params.location.trim().slice(0, 120)}` : `Device ID: ${devId}`,
    });
    return devId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `organizations/${params.orgId}/devices/${devId}`);
  }
}

export async function updateOrgDeviceTelemetry(params: {
  orgId: string;
  orgOwnerId: string;
  actorId: string;
  deviceId: string;
  deviceName?: string;
  status: OrganizationDeviceDoc['status'];
  lastDownloadMbps?: number;
  lastPingMs?: number;
}): Promise<void> {
  const id = sanitizeId(params.deviceId);
  try {
    const payload: Record<string, unknown> = {
      status: params.status,
      updatedAt: serverTimestamp(),
    };
    if (params.lastDownloadMbps !== undefined && Number.isFinite(params.lastDownloadMbps)) {
      payload.lastDownloadMbps = Math.max(0, Number(params.lastDownloadMbps.toFixed(2)));
    }
    if (params.lastPingMs !== undefined && Number.isFinite(params.lastPingMs)) {
      payload.lastPingMs = Math.max(0, Number(params.lastPingMs.toFixed(1)));
    }
    await updateDoc(doc(db, 'organizations', params.orgId, 'devices', id), payload);
    const detailsParts = [`status=${params.status}`];
    if (params.lastDownloadMbps !== undefined) detailsParts.push(`${params.lastDownloadMbps.toFixed(1)} Mbps`);
    if (params.lastPingMs !== undefined) detailsParts.push(`${params.lastPingMs.toFixed(0)} ms`);
    await writeOrgActivityLog({
      orgId: params.orgId,
      orgOwnerId: params.orgOwnerId,
      actorId: params.actorId,
      action: 'DEVICE_TELEMETRY_UPDATED',
      target: (params.deviceName || id).slice(0, 120),
      details: detailsParts.join(' · '),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `organizations/${params.orgId}/devices/${id}`);
  }
}

export async function deleteOrgDevice(
  orgId: string,
  deviceId: string,
  meta?: { orgOwnerId?: string; actorId?: string; targetLabel?: string },
): Promise<void> {
  const id = sanitizeId(deviceId);
  try {
    await deleteDoc(doc(db, 'organizations', orgId, 'devices', id));
    if (meta?.orgOwnerId && meta?.actorId) {
      await writeOrgActivityLog({
        orgId,
        orgOwnerId: meta.orgOwnerId,
        actorId: meta.actorId,
        action: 'DEVICE_REMOVED',
        target: (meta.targetLabel || id).slice(0, 120),
        details: `Removed device ${id}`,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `organizations/${orgId}/devices/${id}`);
  }
}

export async function writeOrgActivityLog(params: {
  orgId: string;
  orgOwnerId: string;
  actorId: string;
  action: string;
  target?: string;
  details?: string;
}): Promise<void> {
  const logId = sanitizeId(`olog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'organizations', params.orgId, 'activityLogs', logId), {
      orgId: params.orgId,
      orgOwnerId: params.orgOwnerId,
      actorId: params.actorId,
      action: params.action.slice(0, 100),
      ...(params.target ? { target: params.target.slice(0, 120) } : {}),
      ...(params.details ? { details: params.details.slice(0, 400) } : {}),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking audit log write
  }
}

export async function fetchOrgActivityLogs(
  orgId: string,
  orgOwnerId: string,
  maxItems = 50,
): Promise<OrganizationActivityLogDoc[]> {
  try {
    const q = query(
      collection(db, 'organizations', orgId, 'activityLogs'),
      where('orgOwnerId', '==', orgOwnerId),
      limit(maxItems),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as OrganizationActivityLogDoc), id: d.id }))
      .sort((a, b) => {
        const tsA = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
        const tsB = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
        return tsB - tsA || b.id.localeCompare(a.id);
      });
  } catch {
    return [];
  }
}

// =========================================================================
// ADMIN OPERATIONS (PROTECTED BY FIRESTORE RULES isAdmin())
// =========================================================================
export async function adminFetchAllUsers(): Promise<UserProfileDoc[]> {
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(100)));
    return snap.docs.map((d) => d.data() as UserProfileDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }
}

export async function adminFetchUserPlanMap(uids: string[]): Promise<Record<string, PlanId>> {
  const entries = await Promise.all(
    uids.map(async (uid): Promise<[string, PlanId]> => {
      try {
        const entSnap = await getDoc(doc(db, 'users', uid, 'entitlements', 'current'));
        if (entSnap.exists()) {
          const data = entSnap.data() as Partial<UserEntitlementDoc>;
          if (data.planId === 'free' || data.planId === 'pro' || data.planId === 'business') {
            return [uid, data.planId];
          }
        }
        const subSnap = await getDoc(doc(db, 'users', uid, 'subscriptions', 'current'));
        if (subSnap.exists()) {
          const data = subSnap.data() as Partial<UserSubscriptionDoc>;
          if (data.planId === 'free' || data.planId === 'pro' || data.planId === 'business') {
            return [uid, data.planId];
          }
        }
      } catch {
        // Fallback cleanly to free if unreadable
      }
      return [uid, 'free'];
    }),
  );
  return Object.fromEntries(entries);
}

export async function adminUpdateUserStatus(params: {
  targetUid: string;
  accountStatus: 'active' | 'suspended';
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', params.targetUid), {
      accountStatus: params.accountStatus,
      updatedAt: serverTimestamp(),
    });
    await adminWriteAuditLog({
      actorId: params.actorUid,
      actorEmail: params.actorEmail,
      action: params.accountStatus === 'suspended' ? 'SUSPEND_USER' : 'RESTORE_USER',
      targetType: 'user',
      targetId: params.targetUid,
      summary: `Set user accountStatus=${params.accountStatus}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.targetUid}`);
  }
}

export async function adminGrantUserPlan(params: {
  targetUid: string;
  planId: PlanId;
  billingCycle: 'monthly' | 'annual' | 'none';
  catalog: Record<PlanId, SubscriptionPlanConfig>;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const plan = params.catalog[params.planId] ?? DEFAULT_PLAN_CATALOG[params.planId];
  const subRef = doc(db, 'users', params.targetUid, 'subscriptions', 'current');
  const entRef = doc(db, 'users', params.targetUid, 'entitlements', 'current');
  try {
    const existingSub = await getDoc(subRef);
    const subStatus = params.planId === 'free' ? 'none' : 'active';
    if (existingSub.exists()) {
      await updateDoc(subRef, {
        planId: params.planId,
        billingCycle: params.billingCycle,
        status: subStatus,
        provider: 'admin_grant',
        cancelAtPeriodEnd: false,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(subRef, {
        userId: params.targetUid,
        planId: params.planId,
        billingCycle: params.billingCycle,
        status: subStatus,
        provider: 'admin_grant',
        cancelAtPeriodEnd: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const existingEnt = await getDoc(entRef);
    const entitlementFields = {
      planId: params.planId,
      status: 'active' as const,
      aiDailyLimit: plan.maxAiRequestsPerDay,
      maxHistoryRecords: plan.maxHistoryRecords,
      maxSavedDevices: plan.maxSavedDevices,
      cloudSyncEnabled: plan.cloudSyncEnabled,
      analyticsEnabled: plan.analyticsEnabled,
      gamingModeEnabled: plan.gamingModeEnabled,
      alertsEnabled: plan.alertsEnabled,
      teamManagementEnabled: plan.teamManagementEnabled,
      updatedAt: serverTimestamp(),
    };
    if (existingEnt.exists()) {
      await updateDoc(entRef, entitlementFields);
    } else {
      await setDoc(entRef, {
        userId: params.targetUid,
        ...entitlementFields,
      });
    }

    await adminWriteAuditLog({
      actorId: params.actorUid,
      actorEmail: params.actorEmail,
      action: 'ASSIGN_PLAN',
      targetType: 'user',
      targetId: params.targetUid,
      summary: `Assigned plan ${params.planId} (${params.billingCycle})`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${params.targetUid}/entitlements/current`);
  }
}

export async function adminSavePlanConfig(
  plan: SubscriptionPlanConfig,
  actorUid: string,
  actorEmail: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'plans', plan.id), {
      id: plan.id,
      name: plan.name.slice(0, 80),
      nameAr: plan.nameAr.slice(0, 80),
      ...(plan.tagline ? { tagline: plan.tagline.slice(0, 200) } : {}),
      ...(plan.taglineAr ? { taglineAr: plan.taglineAr.slice(0, 200) } : {}),
      monthlyPriceCents: Math.max(0, Number(plan.monthlyPriceCents) || 0),
      annualPriceCents: Math.max(0, Number(plan.annualPriceCents) || 0),
      currency: (plan.currency || 'USD').slice(0, 10),
      pricingConfigured: Boolean(plan.pricingConfigured),
      active: Boolean(plan.active),
      maxHistoryRecords: Math.max(-1, Number(plan.maxHistoryRecords) || 0),
      maxSavedDevices: Math.max(0, Number(plan.maxSavedDevices) || 0),
      maxAiRequestsPerDay: Math.max(0, Number(plan.maxAiRequestsPerDay) || 0),
      maxOrgMembers: Math.max(0, Number(plan.maxOrgMembers) || 0),
      cloudSyncEnabled: Boolean(plan.cloudSyncEnabled),
      analyticsEnabled: Boolean(plan.analyticsEnabled),
      gamingModeEnabled: Boolean(plan.gamingModeEnabled),
      alertsEnabled: Boolean(plan.alertsEnabled),
      exportEnabled: Boolean(plan.exportEnabled),
      teamManagementEnabled: Boolean(plan.teamManagementEnabled),
      ...(Array.isArray(plan.features) ? { features: plan.features.slice(0, 20) } : {}),
      updatedAt: serverTimestamp(),
    });
    await adminWriteAuditLog({
      actorId: actorUid,
      actorEmail,
      action: 'UPDATE_PLAN',
      targetType: 'plan',
      targetId: plan.id,
      summary: `Updated plan ${plan.id} (${plan.monthlyPriceCents}/${plan.annualPriceCents} ${plan.currency}, configured=${plan.pricingConfigured})`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `plans/${plan.id}`);
  }
}

export async function adminSaveFeatureFlag(
  flag: Omit<FeatureFlagDoc, 'updatedAt'>,
  actorUid: string,
  actorEmail: string,
): Promise<void> {
  const key = sanitizeId(flag.key);
  try {
    await setDoc(doc(db, 'featureFlags', key), {
      key,
      enabled: flag.enabled,
      requiredPlan: flag.requiredPlan,
      ...(flag.description ? { description: flag.description.slice(0, 300) } : {}),
      updatedAt: serverTimestamp(),
    });
    await adminWriteAuditLog({
      actorId: actorUid,
      actorEmail,
      action: 'UPDATE_FEATURE_FLAG',
      targetType: 'featureFlag',
      targetId: key,
      summary: `Flag ${key} enabled=${flag.enabled}, requiredPlan=${flag.requiredPlan}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `featureFlags/${key}`);
  }
}

export async function adminCreateCoupon(
  coupon: Omit<CouponDoc, 'createdAt' | 'updatedAt' | 'usedCount'>,
  actorUid: string,
  actorEmail: string,
): Promise<void> {
  const code = sanitizeId(coupon.code.toUpperCase());
  try {
    await setDoc(doc(db, 'coupons', code), {
      code,
      discountPercent: Math.min(100, Math.max(1, Number(coupon.discountPercent))),
      applicablePlan: coupon.applicablePlan,
      active: coupon.active,
      maxUses: Math.max(1, Number(coupon.maxUses)),
      usedCount: 0,
      ...(coupon.expiresAt ? { expiresAt: coupon.expiresAt.slice(0, 64) } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await adminWriteAuditLog({
      actorId: actorUid,
      actorEmail,
      action: 'CREATE_COUPON',
      targetType: 'coupon',
      targetId: code,
      summary: `Created coupon ${code} (${coupon.discountPercent}% off ${coupon.applicablePlan})`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `coupons/${code}`);
  }
}

export async function adminFetchCoupons(): Promise<CouponDoc[]> {
  try {
    const snap = await getDocs(collection(db, 'coupons'));
    return snap.docs.map((d) => d.data() as CouponDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'coupons');
  }
}

export async function adminToggleCoupon(code: string, active: boolean, actorUid: string, actorEmail: string): Promise<void> {
  const id = sanitizeId(code);
  try {
    await updateDoc(doc(db, 'coupons', id), { active, updatedAt: serverTimestamp() });
    await adminWriteAuditLog({
      actorId: actorUid,
      actorEmail,
      action: 'TOGGLE_COUPON',
      targetType: 'coupon',
      targetId: id,
      summary: `Set coupon ${id} active=${active}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `coupons/${id}`);
  }
}

export async function adminFetchAllTickets(): Promise<SupportTicketDoc[]> {
  try {
    const snap = await getDocs(query(collection(db, 'supportTickets'), limit(100)));
    return snap.docs.map((d) => d.data() as SupportTicketDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'supportTickets');
  }
}

export async function adminRespondToTicket(params: {
  ticketId: string;
  status: SupportTicketDoc['status'];
  adminResponse: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const id = sanitizeId(params.ticketId);
  try {
    await updateDoc(doc(db, 'supportTickets', id), {
      status: params.status,
      adminResponse: params.adminResponse.slice(0, 2000),
      updatedAt: serverTimestamp(),
    });
    await adminWriteAuditLog({
      actorId: params.actorUid,
      actorEmail: params.actorEmail,
      action: 'UPDATE_TICKET',
      targetType: 'supportTicket',
      targetId: id,
      summary: `Ticket ${id} status=${params.status}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${id}`);
  }
}

export async function adminFetchAuditLogs(): Promise<AuditLogDoc[]> {
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as AuditLogDoc), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'auditLogs');
  }
}

export async function adminWriteAuditLog(params: {
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
}): Promise<void> {
  const logId = sanitizeId(`aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      actorId: params.actorId,
      actorEmail: params.actorEmail.slice(0, 200),
      action: params.action.slice(0, 100),
      targetType: params.targetType.slice(0, 60),
      targetId: params.targetId.slice(0, 128),
      summary: params.summary.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `auditLogs/${logId}`);
  }
}
