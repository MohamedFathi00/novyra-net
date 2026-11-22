# NOVYRA Net — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership & Verified Users**: All user-owned cloud writes require an authenticated user (`request.auth != null`) with `request.auth.token.email_verified == true`. No user can create, read, update, or delete another user's private PII, test history, devices, monitoring snapshots, alerts, payments, subscriptions, or entitlements.
2. **PII Isolation**: Emails, countries, and marketing preferences live strictly inside `/users/{userId}/private/info` and are readable only by the owning UID or a verified Admin. `/users/{userId}` holds only non-PII display preferences and status.
3. **No Self-Privilege Escalation**: Users CANNOT create or modify their own `accountStatus: 'suspended'`, admin membership (`/admins/{uid}`), paid `subscriptions`, paid `payments`, `entitlements`, global `plans`, `featureFlags`, or `coupons`. Only a verified Admin (`isAdmin()`, verifying `request.auth.token.email == 'me40351@gmail.com' && request.auth.token.email_verified == true` OR `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`) may write billing, entitlements, plans, coupons, feature flags, or audit logs.
4. **Master Gate Organizational Isolation**: Organization members, devices, and activity logs under `/organizations/{orgId}/...` verify active membership on `/organizations/{orgId}` / `/organizations/{orgId}/members/{uid}`. Business entitlement is checked via `/users/{uid}/entitlements/current` or verified admin override when creating an organization.
5. **Immutable Audit Trails & Timestamps**: `createdAt`, `userId`, `ownerId`, and `orgId` are immutable once written. `createdAt == request.time` on creation and `updatedAt == request.time` on update where present. All document IDs are validated against `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and every string and list field enforces explicit `.size()` bounds.
6. **Terminal State Locking**: Closed/resolved `supportTickets` cannot be reopened or mutated by regular users (only Admins can adjust terminal ticket status). Immutable `auditLogs`, `payments`, and `organizations/{orgId}/activityLogs` cannot be modified or deleted by clients.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Unauthenticated Write**: `setDoc(doc(db, 'users', 'u1'), { ... })` with `auth == null`.
2. **Unverified Email Write**: `setDoc(doc(db, 'users', 'u1', 'testHistory', 't1'), { ... })` where `email_verified == false`.
3. **Cross-User PII Snooping**: `getDoc(doc(db, 'users', 'victim', 'private', 'info'))` authenticated as `attacker`.
4. **Admin Email Spoof**: `setDoc(doc(db, 'plans', 'pro'), { ... })` where `token.email == 'me40351@gmail.com'` but `token.email_verified == false`.
5. **Self-Granted Pro Subscription**: `setDoc(doc(db, 'users', 'u1', 'subscriptions', 'current'), { userId: 'u1', planId: 'pro', status: 'active', ... })` as non-admin `u1`.
6. **Self-Granted Entitlements**: `updateDoc(doc(db, 'users', 'u1', 'entitlements', 'current'), { planId: 'business', aiDailyLimit: 9999 })` as non-admin `u1`.
7. **Shadow Field Injection**: `setDoc(doc(db, 'users', 'u1'), { uid: 'u1', displayName: 'Bob', accountStatus: 'active', isAdmin: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })`.
8. **ID Poisoning Attack**: `setDoc(doc(db, 'users', 'u1', 'devices', 'bad/../../id$' + 'a'.repeat(300)), { ... })`.
9. **Immutable Ownership Hijack**: `updateDoc(doc(db, 'supportTickets', 't1'), { userId: 'otherUser', updatedAt: serverTimestamp() })`.
10. **Terminal Ticket Bypass**: Regular user updating `/supportTickets/t1` where existing `status == 'closed'` back to `'open'`.
11. **Backdated Timestamp Spoof**: Creating `/users/u1/testHistory/t1` with `createdAt: Timestamp.fromMillis(0)` instead of `request.time`.
12. **Blanket Collection Scrape**: `getDocs(collection(db, 'supportTickets'))` without `where('userId', '==', auth.uid)` as a non-admin user.
