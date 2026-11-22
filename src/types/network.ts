export type Language = 'en' | 'ar';
export type ThemeMode = 'dark';
export type AccentTheme = 'electric' | 'cyan' | 'emerald';
export type AnimationStyle = 'cyber' | 'aurora' | 'matrix' | 'warp' | 'minimal' | 'off';

export type NavSection =
  | 'overview'
  | 'speedtest'
  | 'monitoring'
  | 'diagnostics'
  | 'info'
  | 'dns'
  | 'history'
  | 'analytics'
  | 'gaming'
  | 'alerts'
  | 'ai'
  | 'account'
  | 'pricing'
  | 'business'
  | 'support'
  | 'admin'
  | 'settings'
  | 'about'
  | 'apps';

export type DiagnosticTab = 'ping' | 'dns' | 'ip' | 'traceroute' | 'ports' | 'router';

export type SpeedTestPhase =
  | 'idle'
  | 'ping'
  | 'download'
  | 'upload'
  | 'complete'
  | 'cancelled'
  | 'error';

export interface ServerNode {
  id: string;
  name: string;
  nameAr: string;
  location: string;
  locationAr: string;
  host: string;
  capabilities: string[];
  isPrimaryBenchmark: boolean;
  status: 'online' | 'unreachable' | 'unchecked';
  latencyMs: number | null;
  checkedAt?: string;
  error?: string;
}

export interface SpeedTestProgress {
  phase: SpeedTestPhase;
  progressPercent: number;
  currentSpeedMbps: number;
  downloadMbps: number | null;
  uploadMbps: number | null;
  downloadSamples: number[];
  uploadSamples: number[];
  idlePingMs: number | null;
  minPingMs: number | null;
  maxPingMs: number | null;
  downloadLatencyMs: number | null;
  uploadLatencyMs: number | null;
  jitterMs: number | null;
  probeLossPercent: number | null;
  probeCount: number;
  errorMessage?: string;
}

export interface SpeedTestResult {
  id: string;
  timestamp: string;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  minPingMs: number;
  maxPingMs: number;
  downloadLatencyMs: number | null;
  uploadLatencyMs: number | null;
  jitterMs: number;
  probeLossPercent: number | null;
  latencyMethod: 'HTTP/TCP RTT';
  lossMethod: 'HTTP Probe Loss' | 'Untested';
  serverId: string;
  serverName: string;
  serverLocation: string;
  connectionType: string | null;
  effectiveType: string | null;
  publicIp: string | null;
  isp: string | null;
  status: 'completed' | 'partial' | 'cancelled' | 'failed';
  durationSec: number;
  bytesTransferred: number;
  downloadSamples?: number[];
  uploadSamples?: number[];
  notes?: string;
  deviceId?: string;
  syncedToCloud?: boolean;
}

export interface LiveSample {
  timestamp: number;
  latencyMs: number | null;
  downloadActivityMbps: number;
  uploadActivityMbps: number;
  online: boolean;
  interrupted: boolean;
}

export interface ConnectionInfo {
  online: boolean;
  connectionType: string | null;
  effectiveType: string | null;
  downlinkEstimateMbps: number | null;
  rttEstimateMs: number | null;
  saveData: boolean | null;
  publicIpv4: string | null;
  publicIpv6: string | null;
  localIp: string | null;
  isp: string | null;
  asn: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  serverObservedIp: string | null;
  dnsServers: string | null;
  lastUpdated: string | null;
  lookupError?: string | null;
  isLoadingPublicIp?: boolean;
}

export interface DnsLookupResult {
  domain: string;
  durationMs: number;
  records: Partial<Record<'A' | 'AAAA' | 'MX' | 'TXT' | 'CNAME' | 'NS', unknown[]>>;
  errors: Partial<Record<'A' | 'AAAA' | 'MX' | 'TXT' | 'CNAME' | 'NS', string>>;
}

export interface TcpPingAttempt {
  seq: number;
  success: boolean;
  rttMs: number | null;
  error?: string;
}

export interface TcpPingResult {
  host: string;
  resolvedIp: string;
  port: number;
  method: string;
  attempts: TcpPingAttempt[];
  summary: {
    sent: number;
    succeeded: number;
    failed: number;
    lossPercent: number;
    minMs: number | null;
    avgMs: number | null;
    maxMs: number | null;
    jitterMs: number | null;
  };
}

export interface PortCheckResult {
  host: string;
  resolvedIp: string;
  port: number;
  status: 'open' | 'closed' | 'timeout';
  rttMs: number | null;
  detail: string;
}

export interface TracerouteHop {
  hop: number;
  ip: string | null;
  hostname: string | null;
  rttMs: number | null;
  timedOut: boolean;
  raw?: string;
}

export interface TracerouteResult {
  supported: boolean;
  host: string;
  resolvedIp: string;
  reason: string;
  hops: TracerouteHop[];
}

export type ActivityRating = 'excellent' | 'good' | 'fair' | 'poor' | 'insufficient';

export interface QualityCategoryAssessment {
  id: 'browsing' | 'gaming' | 'videocalls' | 'hdStreaming' | 'uhdStreaming' | 'largeDownloads';
  rating: ActivityRating;
  score: number;
  reasons: string[];
  reasonsAr: string[];
}

export interface QualityAssessment {
  overallRating: ActivityRating;
  overallScore: number;
  categories: QualityCategoryAssessment[];
  thresholdsNote: string;
}

export interface AppSettings {
  version: number;
  language: Language;
  theme: ThemeMode;
  accent: AccentTheme;
  animationsEnabled: boolean;
  animationStyle: AnimationStyle;
  autoSelectServer: boolean;
  preferredServerId: string;
  testDurationSec: 5 | 10 | 15;
  maxPayloadMb: 8 | 16 | 32;
  autoSaveHistory: boolean;
  enablePublicIpLookup: boolean;
  monitoringIntervalSec: 3 | 5 | 10;
  alerts: {
    onDisconnect: boolean;
    lowDownloadThresholdMbps: number;
    highLatencyThresholdMs: number;
    enableBrowserNotifications: boolean;
  };
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description?: string;
}

// =========================================================================
// COMMERCIAL SAAS, AUTH, BILLING, ORGS & ADMIN DOMAIN TYPES
// =========================================================================

export type PlanId = 'free' | 'pro' | 'business';
export type BillingCycle = 'monthly' | 'annual' | 'none';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'none';
export type OrgRole = 'owner' | 'admin' | 'manager' | 'viewer';

export interface SubscriptionPlanConfig {
  id: PlanId;
  name: string;
  nameAr: string;
  tagline?: string;
  taglineAr?: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  currency: string;
  pricingConfigured: boolean;
  active: boolean;
  maxHistoryRecords: number;
  maxSavedDevices: number;
  maxAiRequestsPerDay: number;
  maxOrgMembers: number;
  cloudSyncEnabled: boolean;
  analyticsEnabled: boolean;
  gamingModeEnabled: boolean;
  alertsEnabled: boolean;
  exportEnabled: boolean;
  teamManagementEnabled: boolean;
  features?: string[];
}

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  photoUrl?: string;
  language?: Language;
  accountStatus: 'active' | 'suspended';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateInfoDoc {
  uid: string;
  email: string;
  country?: string;
  acceptedTermsAt?: unknown;
  marketingOptIn?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserSubscriptionDoc {
  userId: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  provider: string;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserEntitlementDoc {
  userId: string;
  planId: PlanId;
  status: 'active' | 'suspended' | 'canceled';
  aiDailyLimit: number;
  maxHistoryRecords: number;
  maxSavedDevices: number;
  cloudSyncEnabled: boolean;
  analyticsEnabled: boolean;
  gamingModeEnabled: boolean;
  alertsEnabled: boolean;
  teamManagementEnabled: boolean;
  updatedAt?: unknown;
}

export interface PaymentRecordDoc {
  id: string;
  userId: string;
  planId: PlanId;
  amountCents: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  provider: string;
  providerSessionId?: string;
  invoiceUrl?: string;
  createdAt?: unknown;
}

export interface UserDeviceDoc {
  id: string;
  userId: string;
  name: string;
  deviceType: 'desktop' | 'laptop' | 'mobile' | 'router' | 'other';
  browserLabel?: string;
  isp?: string;
  connectionType?: string;
  lastSeenAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AlertRuleDoc {
  id: string;
  userId: string;
  name: string;
  metric: 'download_mbps' | 'upload_mbps' | 'ping_ms' | 'jitter_ms' | 'packet_loss';
  operator: 'lt' | 'gt';
  threshold: number;
  enabled: boolean;
  channel: 'in_app' | 'browser';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MonitoringSnapshotDoc {
  id: string;
  userId: string;
  avgLatencyMs: number;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  interruptions: number;
  onlinePercent: number;
  sampleCount: number;
  createdAt?: unknown;
}

export interface OrganizationDoc {
  id: string;
  name: string;
  ownerId: string;
  planId: 'business';
  status: 'active' | 'suspended';
  maxSeats: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrganizationMemberDoc {
  orgId: string;
  orgOwnerId: string;
  userId: string;
  displayName: string;
  role: OrgRole;
  status: 'active' | 'invited' | 'revoked';
  addedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrganizationDeviceDoc {
  id: string;
  orgId: string;
  orgOwnerId: string;
  name: string;
  location?: string;
  registeredBy: string;
  status: 'online' | 'offline' | 'degraded';
  lastDownloadMbps?: number;
  lastPingMs?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrganizationActivityLogDoc {
  id: string;
  orgId: string;
  orgOwnerId: string;
  actorId: string;
  action: string;
  target?: string;
  details?: string;
  createdAt?: unknown;
}

export interface SupportTicketDoc {
  id: string;
  userId: string;
  subject: string;
  category: 'technical' | 'billing' | 'account' | 'business' | 'bug';
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  message: string;
  adminResponse?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FeatureFlagDoc {
  key: string;
  enabled: boolean;
  requiredPlan: PlanId;
  description?: string;
  updatedAt?: unknown;
}

export interface CouponDoc {
  code: string;
  discountPercent: number;
  applicablePlan: 'all' | 'pro' | 'business';
  active: boolean;
  maxUses: number;
  usedCount: number;
  expiresAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogDoc {
  id: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt?: unknown;
}

export interface AiQuotaInfo {
  planId: PlanId | 'guest';
  used: number;
  limit: number;
  remaining: number;
  dateKey: string;
}

