import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppSettings,
  ConnectionInfo,
  DiagnosticTab,
  LiveSample,
  NavSection,
  NotificationItem,
  ServerNode,
  SpeedTestProgress,
  SpeedTestResult,
  ToastMessage,
} from './types/network';
import { getTranslations } from './i18n/translations';
import {
  appendTestRecord,
  clearHistoryStorage,
  deleteTestRecord,
  loadHistory,
  loadSettings,
  saveHistory,
  saveSettings,
} from './services/storageService';
import { executeRealSpeedTest } from './services/speedTestService';
import { gatherConnectionInformation, readBrowserConnectionSnapshot } from './services/networkInformationService';
import { fetchConfiguredServers, probeAllServers } from './services/diagnosticsService';
import { analyzeConnectionQuality } from './services/qualityService';
import { fetchAiStatus } from './services/aiAdvisorService';
import {
  deleteCloudTestRecord,
  fetchAlertRules,
  fetchCloudTestHistory,
  saveTestRecordToCloud,
} from './services/cloudSyncService';
import { canUseFeature } from './services/entitlementService';
import { useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './components/Dashboard';
import { SpeedTestConsole } from './components/SpeedTestConsole';
import { NetworkMonitorView } from './components/NetworkMonitorView';
import { NetworkDiagnosticsView } from './components/NetworkDiagnosticsView';
import { NetworkInfoView } from './components/NetworkInfoView';
import { DnsToolsView } from './components/DnsToolsView';
import { TestHistoryView } from './components/TestHistoryView';
import { AnalyticsView } from './components/AnalyticsView';
import { AIAdvisorView } from './components/AIAdvisorView';
import { SettingsView } from './components/SettingsView';
import { AboutView } from './components/AboutView';
import { NovyraAppsView } from './components/NovyraAppsView';
import { ToastNotifications } from './components/FeedbackUI';
import { type AuthViewMode } from './components/AuthViews';
import { PricingView } from './components/PricingView';
import { LegalSupportViews, type SupportLegalTab } from './components/LegalSupportViews';
import { AccountDashboardView } from './components/AccountDashboardView';
import { AlertsRulesView, GamingModeView } from './components/PremiumIntelligenceViews';
import { BusinessWorkspaceView } from './components/BusinessWorkspaceView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { UpgradeModal } from './components/PremiumFeatureLock';

const INITIAL_PROGRESS: SpeedTestProgress = {
  phase: 'idle',
  progressPercent: 0,
  currentSpeedMbps: 0,
  downloadMbps: null,
  uploadMbps: null,
  downloadSamples: [],
  uploadSamples: [],
  idlePingMs: null,
  minPingMs: null,
  maxPingMs: null,
  downloadLatencyMs: null,
  uploadLatencyMs: null,
  jitterMs: null,
  probeLossPercent: null,
  probeCount: 0,
};

export default function App() {
  const {
    user,
    emailVerified,
    isAdmin,
    isSuspended,
    profile,
    plansCatalog,
    featureFlags,
    entitlements,
    getIdToken,
    logout,
  } = useAuth();

  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [history, setHistory] = useState<SpeedTestResult[]>(() => loadHistory().data);

  const [authMode, setAuthMode] = useState<AuthViewMode>('login');
  const [activeSection, setActiveSection] = useState<NavSection>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout')) return 'pricing';
    return 'overview';
  });
  const [pendingAuthReturnSection, setPendingAuthReturnSection] = useState<NavSection | null>(null);
  const [supportTab, setSupportTab] = useState<SupportLegalTab>('support');
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; plan?: 'pro' | 'business'; reason?: string }>({
    open: false,
  });

  const [diagTab, setDiagTab] = useState<DiagnosticTab>('ping');
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [servers, setServers] = useState<ServerNode[]>([
    {
      id: 'novyra-core',
      name: 'NOVYRA Speed Engine (Active Node)',
      nameAr: 'محرك NOVYRA للسرعة (الخادم النشط)',
      location: 'Application Host Region',
      locationAr: 'منطقة خادم التطبيق',
      host: 'self',
      capabilities: ['download', 'upload', 'latency', 'probe-loss'],
      isPrimaryBenchmark: true,
      status: 'online',
      latencyMs: null,
    },
  ]);
  const [selectedServerId, setSelectedServerId] = useState<string>(settings.preferredServerId || 'novyra-core');
  const [probingServers, setProbingServers] = useState(false);

  const [progress, setProgress] = useState<SpeedTestProgress>(INITIAL_PROGRESS);
  const [latestCompletedTest, setLatestCompletedTest] = useState<SpeedTestResult | null>(
    () => loadHistory().data[0] ?? null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>(() => {
    const snap = readBrowserConnectionSnapshot();
    return {
      online: snap.online ?? true,
      connectionType: snap.connectionType ?? null,
      effectiveType: snap.effectiveType ?? null,
      downlinkEstimateMbps: snap.downlinkEstimateMbps ?? null,
      rttEstimateMs: snap.rttEstimateMs ?? null,
      saveData: snap.saveData ?? null,
      publicIpv4: null,
      publicIpv6: null,
      localIp: null,
      isp: null,
      asn: null,
      city: null,
      country: null,
      timezone: null,
      serverObservedIp: null,
      dnsServers: null,
      lastUpdated: null,
      isLoadingPublicIp: true,
    };
  });

  const [liveSamples, setLiveSamples] = useState<LiveSample[]>([]);
  const [monitoringActive, setMonitoringActive] = useState(true);
  const [interruptionsCount, setInterruptionsCount] = useState(0);

  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const raw = localStorage.getItem('novyra_notifications_v1');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
    } catch {
      return [];
    }
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const progressRef = useRef(progress);
  progressRef.current = progress;

  const t = getTranslations(settings.language);

  useEffect(() => {
    try {
      localStorage.setItem('novyra_notifications_v1', JSON.stringify(notifications.slice(0, 30)));
    } catch {
      // Ignore storage quota errors
    }
  }, [notifications]);

  const addToast = useCallback((type: ToastMessage['type'], title: string, description?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const pushNotification = useCallback(
    (severity: NotificationItem['severity'], title: string, message: string) => {
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          severity,
          title,
          message,
          read: false,
        },
        ...prev.slice(0, 29),
      ]);
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted' &&
        severity !== 'info'
      ) {
        try {
          new window.Notification(title, { body: message });
        } catch {
          // Ignore browser desktop notification restrictions inside iframe
        }
      }
    },
    [],
  );

  const handleRequestBrowserNotifications = useCallback(async () => {
    const isAr = settings.language === 'ar';
    if (typeof window === 'undefined' || !('Notification' in window)) {
      addToast(
        'warning',
        isAr ? 'إشعارات المتصفح غير مدعومة هنا' : 'Browser notifications not supported here',
      );
      return;
    }
    if (window.Notification.permission === 'granted') {
      const title = isAr ? 'إشعارات NOVYRA Net مفعّلة' : 'NOVYRA Net Alerts Active';
      const body = isAr
        ? 'تم إرسال إشعار تجريبي للتأكد من عمل التنبيهات بنجاح.'
        : 'Test desktop notification delivered successfully.';
      try {
        new window.Notification(title, { body });
      } catch {
        // Fallback to in-app notification
      }
      pushNotification('info', title, body);
      addToast('success', title);
      return;
    }
    if (window.Notification.permission === 'denied') {
      addToast(
        'warning',
        isAr ? 'تم حظر الإشعارات من المتصفح' : 'Browser notifications blocked',
        isAr
          ? 'اسمح بالإشعارات من إعدادات أذونات الموقع في المتصفح ثم أعد المحاولة.'
          : 'Allow notifications in your browser site permissions and retry.',
      );
      return;
    }
    const perm = await window.Notification.requestPermission();
    if (perm === 'granted') {
      const title = isAr ? 'تم تفعيل إشعارات المتصفح' : 'Desktop Notifications Enabled';
      const body = isAr
        ? 'ستصلك تنبيهات فورية عند انقطاع الاتصال أو تجاوز حدود السرعة والبنج.'
        : 'You will receive alerts for disconnects and threshold breaches.';
      try {
        new window.Notification(title, { body });
      } catch {
        // Fallback
      }
      pushNotification('info', title, body);
      addToast('success', title);
    } else {
      addToast(
        'info',
        isAr ? 'لم يتم منح إذن إشعارات المتصفح' : 'Browser notification permission dismissed',
      );
    }
  }, [addToast, pushNotification, settings.language]);

  // Lock dark theme & sync RTL/LTR direction on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    root.dataset.theme = 'dark';
    root.lang = settings.language;
    root.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
  }, [settings.language]);

  const handleUpdateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  useEffect(() => {
    const res = loadHistory();
    if (res.corrupted) {
      addToast(
        'warning',
        settings.language === 'ar' ? 'تم اكتشاف تلف في التخزين' : 'Corrupted storage detected',
        settings.language === 'ar'
          ? 'تم حفظ البيانات السابقة التالفة بأمان في نسخة احتياطية.'
          : 'Previous malformed history was preserved safely in backup.',
      );
    }
  }, [addToast, settings.language]);

  // Conflict-safe merge of cloud history when signed in & cloud sync enabled
  const mergeCloudRecords = useCallback((cloudRecords: SpeedTestResult[]) => {
    setHistory((prevLocal) => {
      const map = new Map<string, SpeedTestResult>();
      for (const r of cloudRecords) map.set(r.id, { ...r, syncedToCloud: true });
      for (const r of prevLocal) {
        if (!map.has(r.id)) map.set(r.id, r);
      }
      const merged = Array.from(map.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 500);
      saveHistory(merged);
      if (merged[0]) setLatestCompletedTest(merged[0]);
      return merged;
    });
  }, []);

  useEffect(() => {
    if (user && emailVerified && canUseFeature('cloud_sync', entitlements, featureFlags)) {
      fetchCloudTestHistory(user.uid, 200)
        .then((recs) => {
          if (recs.length > 0) mergeCloudRecords(recs);
        })
        .catch(() => {});
    }
  }, [emailVerified, entitlements, featureFlags, mergeCloudRecords, user]);

  // Return user to intended feature section after signing in & verifying inside the app
  useEffect(() => {
    if (user && emailVerified && pendingAuthReturnSection) {
      setActiveSection(pendingAuthReturnSection);
      setPendingAuthReturnSection(null);
    }
  }, [emailVerified, pendingAuthReturnSection, user]);

  const refreshConnectionInfo = useCallback(async () => {
    setConnectionInfo((prev) => ({ ...prev, isLoadingPublicIp: true }));
    const info = await gatherConnectionInformation(settings.enablePublicIpLookup);
    setConnectionInfo(info);
  }, [settings.enablePublicIpLookup]);

  const handleProbeServers = useCallback(async () => {
    setProbingServers(true);
    try {
      const probed = await probeAllServers();
      setServers(probed);
      if (settings.autoSelectServer) {
        const fastestPrimary = probed
          .filter((s) => s.isPrimaryBenchmark && s.status === 'online' && s.latencyMs !== null)
          .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))[0];
        if (fastestPrimary) {
          setSelectedServerId(fastestPrimary.id);
        }
      }
    } catch {
      addToast('error', settings.language === 'ar' ? 'فشل فحص الخوادم' : 'Server probe failed');
    } finally {
      setProbingServers(false);
    }
  }, [addToast, settings.autoSelectServer, settings.language]);

  useEffect(() => {
    fetchConfiguredServers()
      .then((list) => {
        if (list.length) setServers(list);
      })
      .catch(() => {});
    handleProbeServers().catch(() => {});
    refreshConnectionInfo();
    getIdToken()
      .then((token) => fetchAiStatus(token))
      .then((status) => setAiConfigured(status.configured))
      .catch(() => setAiConfigured(false));
  }, [getIdToken, handleProbeServers, refreshConnectionInfo]);

  useEffect(() => {
    const onOnline = () => {
      setConnectionInfo((prev) => ({ ...prev, online: true }));
      refreshConnectionInfo();
      pushNotification(
        'info',
        settings.language === 'ar' ? 'تمت استعادة الاتصال' : 'Connection Restored',
        t.topbar.online,
      );
    };
    const onOffline = () => {
      setConnectionInfo((prev) => ({ ...prev, online: false }));
      setInterruptionsCount((c) => c + 1);
      if (settings.alerts.onDisconnect) {
        pushNotification('error', t.dashboard.disconnected, t.topbar.offline);
        addToast('error', t.dashboard.disconnected);
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [addToast, pushNotification, refreshConnectionInfo, settings.alerts.onDisconnect, t.dashboard.disconnected, t.topbar.offline]);

  useEffect(() => {
    if (!monitoringActive) return;
    let cancelled = false;

    const sampleOnce = async () => {
      if (cancelled) return;
      if (!navigator.onLine) {
        setLiveSamples((prev) => [
          ...prev.slice(-360),
          {
            timestamp: Date.now(),
            latencyMs: null,
            downloadActivityMbps: 0,
            uploadActivityMbps: 0,
            online: false,
            interrupted: true,
          },
        ]);
        return;
      }

      const start = performance.now();
      let latencyMs: number | null = null;
      let interrupted = false;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      try {
        const res = await fetch(`/api/speedtest/ping?m=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (res.ok) {
          latencyMs = Number((performance.now() - start).toFixed(1));
        } else {
          interrupted = true;
        }
      } catch {
        interrupted = true;
      } finally {
        clearTimeout(timer);
      }

      if (cancelled) return;
      if (interrupted) setInterruptionsCount((c) => c + 1);

      const cur = progressRef.current;
      setLiveSamples((prev) => [
        ...prev.slice(-360),
        {
          timestamp: Date.now(),
          latencyMs,
          downloadActivityMbps: cur.phase === 'download' ? cur.currentSpeedMbps : 0,
          uploadActivityMbps: cur.phase === 'upload' ? cur.currentSpeedMbps : 0,
          online: !interrupted,
          interrupted,
        },
      ]);
    };

    sampleOnce();
    const id = setInterval(sampleOnce, settings.monitoringIntervalSec * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [monitoringActive, settings.monitoringIntervalSec]);

  const isTesting =
    progress.phase === 'ping' || progress.phase === 'download' || progress.phase === 'upload';

  const handleStopTest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleStartTest = useCallback(async () => {
    if (isTesting) return;

    const chosenServer =
      servers.find((s) => s.id === selectedServerId && s.isPrimaryBenchmark) ??
      servers.find((s) => s.isPrimaryBenchmark) ??
      servers[0];

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await executeRealSpeedTest({
        server: chosenServer,
        settings,
        connectionInfo,
        signal: controller.signal,
        onProgress: (next) => setProgress(next),
      });

      setLatestCompletedTest(result);

      if (settings.autoSaveHistory) {
        const nextHistory = appendTestRecord(result);
        setHistory(nextHistory);

        if (user && emailVerified && canUseFeature('cloud_sync', entitlements, featureFlags)) {
          saveTestRecordToCloud(user.uid, result)
            .then(() => {
              setHistory((cur) => cur.map((r) => (r.id === result.id ? { ...r, syncedToCloud: true } : r)));
            })
            .catch(() => {});
        }
      }

      if (result.downloadMbps < settings.alerts.lowDownloadThresholdMbps) {
        pushNotification(
          'warning',
          settings.language === 'ar' ? 'تنبيه انخفاض سرعة التحميل' : 'Low Download Speed Alert',
          settings.language === 'ar'
            ? `${result.downloadMbps.toFixed(1)} Mbps أقل من الحد المضبوط (${settings.alerts.lowDownloadThresholdMbps} Mbps).`
            : `${result.downloadMbps.toFixed(1)} Mbps is below your ${settings.alerts.lowDownloadThresholdMbps} Mbps threshold.`,
        );
      }
      if (result.pingMs > settings.alerts.highLatencyThresholdMs) {
        pushNotification(
          'warning',
          settings.language === 'ar' ? 'تنبيه ارتفاع زمن الاستجابة' : 'High Latency Alert',
          settings.language === 'ar'
            ? `${result.pingMs.toFixed(1)} ms يتجاوز الحد المضبوط (${settings.alerts.highLatencyThresholdMs} ms).`
            : `${result.pingMs.toFixed(1)} ms exceeds your ${settings.alerts.highLatencyThresholdMs} ms threshold.`,
        );
      }

      // Evaluate custom cloud alert rules when unlocked
      if (user && emailVerified && canUseFeature('custom_alerts', entitlements, featureFlags)) {
        fetchAlertRules(user.uid)
          .then((rules) => {
            for (const rule of rules.filter((r) => r.enabled)) {
              const actual =
                rule.metric === 'download_mbps'
                  ? result.downloadMbps
                  : rule.metric === 'upload_mbps'
                    ? result.uploadMbps
                    : rule.metric === 'ping_ms'
                      ? result.pingMs
                      : rule.metric === 'jitter_ms'
                        ? result.jitterMs
                        : (result.probeLossPercent ?? 0);
              const triggered = rule.operator === 'lt' ? actual < rule.threshold : actual > rule.threshold;
              if (triggered) {
                pushNotification(
                  'warning',
                  settings.language === 'ar' ? `قاعدة التنبيه: ${rule.name}` : `Alert Rule: ${rule.name}`,
                  `${rule.metric} = ${actual.toFixed(1)} (${rule.operator === 'lt' ? '<' : '>'} ${rule.threshold})`,
                );
              }
            }
          })
          .catch(() => {});
      }

      pushNotification(
        'info',
        t.dashboard.testComplete,
        `↓ ${result.downloadMbps.toFixed(1)} Mbps · ↑ ${result.uploadMbps.toFixed(1)} Mbps · ${result.pingMs.toFixed(0)} ms`,
      );

      addToast(
        'success',
        t.dashboard.testComplete,
        `↓ ${result.downloadMbps.toFixed(1)} Mbps · ↑ ${result.uploadMbps.toFixed(1)} Mbps · ${result.pingMs.toFixed(0)} ms`,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setProgress((prev) => ({
          ...prev,
          phase: 'cancelled',
          progressPercent: 0,
        }));
        addToast('info', t.dashboard.testCancelled);
      } else {
        const message = err instanceof Error ? err.message : t.dashboard.testError;
        setProgress((prev) => ({
          ...prev,
          phase: 'error',
          errorMessage: message,
        }));
        addToast('error', t.dashboard.testError, message);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    addToast,
    connectionInfo,
    emailVerified,
    entitlements,
    featureFlags,
    isTesting,
    pushNotification,
    selectedServerId,
    servers,
    settings,
    t.dashboard.testCancelled,
    t.dashboard.testComplete,
    t.dashboard.testError,
    user,
  ]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const quality = useMemo(() => {
    const source = latestCompletedTest
      ? {
          downloadMbps: latestCompletedTest.downloadMbps,
          uploadMbps: latestCompletedTest.uploadMbps,
          pingMs: latestCompletedTest.pingMs,
          jitterMs: latestCompletedTest.jitterMs,
          probeLossPercent: latestCompletedTest.probeLossPercent,
        }
      : null;
    return analyzeConnectionQuality(source);
  }, [latestCompletedTest]);

  const handleNavigate = useCallback((section: NavSection, dTab?: DiagnosticTab) => {
    setActiveSection(section);
    if (dTab) setDiagTab(dTab);
  }, []);

  const openInAppAuth = useCallback((returnTo?: NavSection, mode: AuthViewMode = 'login') => {
    setAuthMode(mode);
    setPendingAuthReturnSection(returnTo ?? null);
    setActiveSection('account');
  }, []);

  const handleToggleLanguage = () => {
    handleUpdateSettings({
      ...settings,
      language: settings.language === 'en' ? 'ar' : 'en',
    });
  };

  const isLatestSaved = Boolean(
    latestCompletedTest && history.some((h) => h.id === latestCompletedTest.id),
  );

  return (
    <div className="nv-app-frame min-h-screen p-1 sm:p-2 text-[#eef0ff]">
      <div
        className={`nv-shell max-w-[1500px] mx-auto rounded-[14px] p-1.5 sm:p-2.5 flex flex-col ${
          settings.animationsEnabled ? '' : 'nv-animations-off'
        }`}
      >
        <TopBar
          activeSection={activeSection}
          online={connectionInfo.online}
          isTesting={isTesting}
          onQuickTest={() => {
            if (activeSection !== 'overview' && activeSection !== 'speedtest') {
              setActiveSection('overview');
            }
            handleStartTest();
          }}
          onStopTest={handleStopTest}
          language={settings.language}
          onToggleLanguage={handleToggleLanguage}
          onOpenSettings={() => setActiveSection('settings')}
          onOpenHelp={() => {
            setSupportTab('support');
            setActiveSection('support');
          }}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          notifications={notifications}
          onMarkAllRead={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
          }
          onMarkRead={(id) =>
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
          }
          onClearNotifications={() => setNotifications([])}
          onOpenAlerts={() => setActiveSection('alerts')}
          onRequestBrowserNotifications={handleRequestBrowserNotifications}
          isSignedIn={Boolean(user && emailVerified)}
          userDisplayName={profile?.displayName || user?.displayName}
          planId={entitlements.planId}
          onOpenAccount={() => setActiveSection('account')}
          onOpenAuth={() => openInAppAuth()}
          onOpenPricing={() => setActiveSection('pricing')}
          animationsEnabled={settings.animationsEnabled}
          animationStyle={settings.animationStyle}
        />

        {/* Unverified Email or Suspended Account Notice */}
        {user && !emailVerified && (
          <div className="mb-3 rounded-xl border border-[#f5b942]/45 bg-[#f5b942]/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              {settings.language === 'ar'
                ? 'حسابك بانتظار تأكيد البريد الإلكتروني لتفعيل المزامنة السحابية والفواتير.'
                : 'Email verification is pending before cloud sync and billing unlock.'}
            </span>
            <button
              type="button"
              onClick={() => setActiveSection('account')}
              className="rounded-lg nv-btn-primary px-3 py-1 font-bold"
            >
              {settings.language === 'ar' ? 'تأكيد الآن' : 'Verify Email'}
            </button>
          </div>
        )}

        {isSuspended && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#f06478]/45 bg-[#f06478]/10 px-4 py-2.5 text-xs text-[#f06478] font-semibold">
            <span>
              {settings.language === 'ar'
                ? 'هذا الحساب موقوف حالياً من الإدارة. تواصل مع الدعم الفني أو بدّل الحساب.'
                : 'This account has been suspended by an administrator. Contact Support or switch accounts.'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSection('support')}
                className="rounded-lg border border-[#f06478]/45 px-2.5 py-1 text-[11px] font-bold hover:bg-[#f06478]/15"
              >
                {settings.language === 'ar' ? 'الدعم' : 'Support'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void logout().then(() => {
                    setAuthMode('login');
                    setActiveSection('account');
                  });
                }}
                className="rounded-lg bg-[#f06478] text-white px-2.5 py-1 text-[11px] font-bold hover:opacity-90"
              >
                {settings.language === 'ar' ? 'تبديل الحساب' : 'Switch Account'}
              </button>
            </div>
          </div>
        )}

        <div className="nv-workspace flex flex-1 gap-2.5 items-stretch min-w-0">
          <Sidebar
            activeSection={activeSection}
            onSelectSection={(sec) => {
              setPendingAuthReturnSection(null);
              setActiveSection(sec);
            }}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
            language={settings.language}
            isAdmin={isAdmin}
            animationsEnabled={settings.animationsEnabled}
            animationStyle={settings.animationStyle}
          />

          <main className="nv-content flex-1 min-w-0">
            {activeSection === 'overview' && (
              <Dashboard
                language={settings.language}
                servers={servers}
                selectedServerId={selectedServerId}
                onSelectServer={setSelectedServerId}
                progress={progress}
                isTesting={isTesting}
                onStartTest={handleStartTest}
                onStopTest={handleStopTest}
                latestTest={latestCompletedTest}
                history={history}
                connectionInfo={connectionInfo}
                onRefreshConnectionInfo={refreshConnectionInfo}
                quality={quality}
                liveSamples={liveSamples}
                aiConfigured={aiConfigured}
                aiSummary={aiSummary}
                onNavigate={handleNavigate}
                animationsEnabled={settings.animationsEnabled}
              />
            )}

            {activeSection === 'speedtest' && (
              <SpeedTestConsole
                language={settings.language}
                servers={servers}
                selectedServerId={selectedServerId}
                onSelectServer={setSelectedServerId}
                probingServers={probingServers}
                onProbeServers={handleProbeServers}
                progress={progress}
                isTesting={isTesting}
                onStartTest={handleStartTest}
                onStopTest={handleStopTest}
                latestTest={latestCompletedTest}
                isSavedInHistory={isLatestSaved}
                onSaveToHistory={(rec) => {
                  setHistory(appendTestRecord(rec));
                  if (user && emailVerified && canUseFeature('cloud_sync', entitlements, featureFlags)) {
                    saveTestRecordToCloud(user.uid, rec).catch(() => {});
                  }
                  addToast('success', t.speedtestPage.savedToHistory);
                }}
                connectionInfo={connectionInfo}
                quality={quality}
                animationsEnabled={settings.animationsEnabled}
              />
            )}

            {activeSection === 'monitoring' && (
              <NetworkMonitorView
                language={settings.language}
                samples={liveSamples}
                monitoringActive={monitoringActive}
                onToggleMonitoring={() => setMonitoringActive((v) => !v)}
                onClearSamples={() => setLiveSamples([])}
                interruptionsCount={interruptionsCount}
                onUpgrade={() => setActiveSection('pricing')}
                onRequireAuth={() => openInAppAuth('monitoring')}
                onNotify={(type, title, desc) => addToast(type, title, desc)}
              />
            )}

            {activeSection === 'diagnostics' && (
              <NetworkDiagnosticsView
                language={settings.language}
                activeTab={diagTab}
                onChangeTab={setDiagTab}
                connectionInfo={connectionInfo}
                onRefreshConnectionInfo={refreshConnectionInfo}
              />
            )}

            {activeSection === 'info' && (
              <NetworkInfoView
                language={settings.language}
                connectionInfo={connectionInfo}
                onRefresh={refreshConnectionInfo}
              />
            )}

            {activeSection === 'dns' && (
              <DnsToolsView
                language={settings.language}
                servers={servers}
                probingServers={probingServers}
                onProbeServers={handleProbeServers}
              />
            )}

            {activeSection === 'history' && (
              <TestHistoryView
                language={settings.language}
                history={history}
                maxHistoryRecords={entitlements.maxHistoryRecords}
                onUpgrade={() => setActiveSection('pricing')}
                settings={settings}
                onDeleteRecord={(id) => {
                  setHistory(deleteTestRecord(id));
                  if (user && emailVerified) {
                    deleteCloudTestRecord(user.uid, id).catch(() => {});
                  }
                  addToast('info', settings.language === 'ar' ? 'تم حذف السجل' : 'Record deleted');
                }}
                onClearAll={() => {
                  clearHistoryStorage();
                  setHistory([]);
                  setLatestCompletedTest(null);
                  addToast('info', settings.language === 'ar' ? 'تم مسح السجل' : 'History cleared');
                }}
                onCompareSelected={(idA, idB) => {
                  setCompareIds([idA, idB]);
                  setActiveSection('analytics');
                }}
                onStartTest={() => {
                  setActiveSection('speedtest');
                  handleStartTest();
                }}
              />
            )}

            {activeSection === 'analytics' && (
              <AnalyticsView
                language={settings.language}
                history={history}
                quality={quality}
                initialCompareIds={compareIds}
                onStartTest={() => {
                  setActiveSection('speedtest');
                  handleStartTest();
                }}
              />
            )}

            {activeSection === 'gaming' && (
              <GamingModeView
                language={settings.language}
                latestTest={latestCompletedTest ?? history[0] ?? null}
                history={history}
                servers={servers}
                connectionInfo={connectionInfo}
                onStartTest={() => {
                  setActiveSection('speedtest');
                  handleStartTest();
                }}
                onUpgrade={() => setActiveSection('pricing')}
                onRequireAuth={() => openInAppAuth('gaming')}
              />
            )}

            {activeSection === 'alerts' && (
              <AlertsRulesView
                language={settings.language}
                onUpgrade={() => setActiveSection('pricing')}
                onRequireAuth={() => openInAppAuth('alerts')}
                onNotify={(type, title) => addToast(type, title)}
              />
            )}

            {activeSection === 'ai' && (
              <AIAdvisorView
                language={settings.language}
                aiConfigured={aiConfigured}
                latestTest={latestCompletedTest ?? history[0] ?? null}
                previousTest={history[1] ?? null}
                connectionInfo={connectionInfo}
                onSummaryUpdated={setAiSummary}
                onUpgrade={() => setActiveSection('pricing')}
              />
            )}

            {activeSection === 'account' && (
              <AccountDashboardView
                language={settings.language}
                localHistory={history}
                connectionInfo={connectionInfo}
                initialAuthMode={authMode}
                onAuthComplete={() => {
                  if (pendingAuthReturnSection) {
                    setActiveSection(pendingAuthReturnSection);
                    setPendingAuthReturnSection(null);
                  }
                }}
                onOpenLegal={(tab) => {
                  setSupportTab(tab);
                  setActiveSection('support');
                }}
                onMergeCloudHistory={mergeCloudRecords}
                onGoToPricing={() => setActiveSection('pricing')}
                onNotify={(type, title, desc) => addToast(type, title, desc)}
              />
            )}

            {activeSection === 'pricing' && (
              <PricingView
                language={settings.language}
                onRequireAuth={() => openInAppAuth('pricing')}
                onNotify={(type, title, desc) => addToast(type, title, desc)}
              />
            )}

            {activeSection === 'business' && (
              <BusinessWorkspaceView
                language={settings.language}
                latestTest={latestCompletedTest ?? history[0] ?? null}
                onUpgrade={() => setActiveSection('pricing')}
                onRequireAuth={() => openInAppAuth('business')}
                onNotify={(type, title) => addToast(type, title)}
              />
            )}

            {activeSection === 'support' && (
              <LegalSupportViews
                language={settings.language}
                initialTab={supportTab}
                onRequireAuth={() => openInAppAuth('support')}
                onNotify={(type, title) => addToast(type, title)}
              />
            )}

            {activeSection === 'admin' && (
              <AdminDashboardView
                language={settings.language}
                onNotify={(type, title) => addToast(type, title)}
              />
            )}

            {activeSection === 'settings' && (
              <SettingsView
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                history={history}
                onImportBackup={(importedHistory, importedSettings) => {
                  saveHistory(importedHistory);
                  setHistory(importedHistory);
                  if (importedHistory[0]) setLatestCompletedTest(importedHistory[0]);
                  if (importedSettings) handleUpdateSettings(importedSettings);
                }}
                onClearHistory={() => {
                  clearHistoryStorage();
                  setHistory([]);
                  setLatestCompletedTest(null);
                }}
                onNotify={(type, title) => addToast(type, title)}
              />
            )}

            {activeSection === 'about' && <AboutView language={settings.language} />}

            {activeSection === 'apps' && (
              <NovyraAppsView
                language={settings.language}
                aiConfigured={aiConfigured}
                onNavigate={handleNavigate}
              />
            )}
          </main>
        </div>
      </div>

      <UpgradeModal
        open={upgradeModal.open}
        language={settings.language}
        requiredPlan={upgradeModal.plan}
        reason={upgradeModal.reason}
        onClose={() => setUpgradeModal({ open: false })}
        onGoToPricing={() => setActiveSection('pricing')}
      />

      <ToastNotifications
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))}
      />
    </div>
  );
}
