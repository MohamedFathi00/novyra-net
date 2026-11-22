import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from '../services/supabase';
import {
  DEFAULT_PLAN_CATALOG,
  getUserEntitlements,
  type ResolvedEntitlements,
} from '../services/entitlementService';
import type {
  FeatureFlagDoc,
  Language,
  PlanId,
  SubscriptionPlanConfig,
  UserPrivateInfoDoc,
  UserProfileDoc,
  UserSubscriptionDoc,
} from '../types/network';

interface AuthContextValue {
  user: SupabaseCompatibleUser | null;
  loading: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  profile: UserProfileDoc | null;
  privateInfo: UserPrivateInfoDoc | null;
  subscription: UserSubscriptionDoc | null;
  plansCatalog: Record<PlanId, SubscriptionPlanConfig>;
  featureFlags: Record<string, FeatureFlagDoc>;
  entitlements: ResolvedEntitlements;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (params: {
    email: string;
    password: string;
    displayName: string;
    country?: string;
    language: Language;
  }) => Promise<{ verificationSent: boolean }>;
  resendVerification: () => Promise<void>;
  reloadUser: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccountSafely: (currentPassword?: string) => Promise<void>;
  refreshBillingAndProfile: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

interface SupabaseCompatibleUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerData: Array<{ providerId: string }>;
}

function toSupabaseCompatibleUser(raw: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  identities?: Array<{ provider?: string | null }> | null;
} | null): SupabaseCompatibleUser | null {
  if (!raw) return null;
  return {
    uid: raw.id,
    email: raw.email || null,
    displayName: typeof raw.user_metadata?.display_name === 'string' ? raw.user_metadata.display_name : null,
    photoURL: typeof raw.user_metadata?.avatar_url === 'string' ? raw.user_metadata.avatar_url : null,
    emailVerified: Boolean(raw.email_confirmed_at || raw.confirmed_at),
    providerData: (raw.identities || []).map((identity) => ({ providerId: identity.provider || 'email' })),
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseCompatibleUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfoDoc | null>(null);
  const [subscription, setSubscription] = useState<UserSubscriptionDoc | null>(null);
  const [entitlementDoc, setEntitlementDoc] = useState<null>(null);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [plansCatalog, setPlansCatalog] = useState<Record<PlanId, SubscriptionPlanConfig>>(DEFAULT_PLAN_CATALOG);
  const [featureFlags, setFeatureFlags] = useState<Record<string, FeatureFlagDoc>>({});

  const refreshCatalog = useCallback(async () => {
    setPlansCatalog(DEFAULT_PLAN_CATALOG);
    setFeatureFlags({});
  }, []);

  const refreshUserState = useCallback(async (currentUser: SupabaseCompatibleUser | null) => {
    if (!currentUser) {
      setProfile(null);
      setPrivateInfo(null);
      setSubscription(null);
      setEntitlementDoc(null);
      setIsAdminDoc(false);
      return;
    }

    if (!currentUser.emailVerified) {
      setProfile(null);
      setPrivateInfo(null);
      setSubscription(null);
      setEntitlementDoc(null);
      setIsAdminDoc(false);
      return;
    }

    const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'NOVYRA User';
    setProfile({ uid: currentUser.uid, displayName, photoUrl: currentUser.photoURL || undefined, language: document.documentElement.lang === 'en' ? 'en' : 'ar', accountStatus: 'active' });
    setPrivateInfo({ uid: currentUser.uid, email: currentUser.email || '' });
    setSubscription({ userId: currentUser.uid, planId: 'free', billingCycle: 'none', status: 'active', provider: 'supabase', cancelAtPeriodEnd: false });
    setEntitlementDoc(null);
    setIsAdminDoc(currentUser.email?.trim().toLowerCase() === 'me40351@gmail.com');
  }, []);

  useEffect(() => {
    refreshCatalog().catch(() => {});
    if (supabaseConfigured && supabase) {
      const supabaseClient = supabase;
      let active = true;
      const bootstrap = async () => {
        const { data } = await supabaseClient.auth.getSession();
        if (!active) return;
        const nextUser = toSupabaseCompatibleUser(data.session?.user || null);
        setUser(nextUser);
        try {
        await refreshUserState(nextUser);
        } finally {
          if (active) setLoading(false);
        }
      };
      bootstrap().catch(() => setLoading(false));
      const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, next) => {
        const nextUser = toSupabaseCompatibleUser(next?.user || null);
        setUser(nextUser);
        refreshUserState(nextUser).catch((err) => console.error('Supabase auth bootstrap error:', err));
      });
      return () => {
        active = false;
        listener.subscription.unsubscribe();
      };
    }
    setLoading(false);
    return undefined;
  }, [refreshCatalog, refreshUserState]);

  const emailVerified = Boolean(user?.emailVerified);
  const isBootstrapAdmin = Boolean(user?.emailVerified && user.email?.trim().toLowerCase() === 'me40351@gmail.com');
  const isAdmin = Boolean(emailVerified && (isBootstrapAdmin || isAdminDoc));
  const isSuspended = !isAdmin && profile?.accountStatus === 'suspended';

  const entitlements = useMemo(
    () =>
      getUserEntitlements({
        entitlement: entitlementDoc,
        subscription,
        catalog: plansCatalog,
        isAdmin,
      }),
    [entitlementDoc, isAdmin, plansCatalog, subscription],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!supabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const registerWithEmail = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
      country?: string;
      language: Language;
    }) => {
      if (!supabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
      const { data, error } = await supabase.auth.signUp({ email: params.email.trim(), password: params.password, options: { data: { display_name: params.displayName.trim().slice(0, 100) }, emailRedirectTo: window.location.origin } });
      if (error) throw error;
      return { verificationSent: !data.session };
    },
    [],
  );

  const resendVerification = useCallback(async () => {
    if (!supabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
    const email = user?.email;
    if (!email) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  }, []);

  const reloadUser = useCallback(async () => {
    if (supabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const updated = toSupabaseCompatibleUser(data.user);
      setUser(updated);
      await refreshUserState(updated);
      return;
    }
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }, [refreshUserState]);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    if (!supabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    void currentPassword;
    if (!supabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  const deleteAccountSafely = useCallback(async (currentPassword?: string) => {
    void currentPassword;
    throw new Error('ACCOUNT_DELETE_REQUIRES_SERVER_ADMIN');
  }, []);

  const getIdToken = useCallback(async () => {
    if (!supabaseConfigured || !supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  const refreshBillingAndProfile = useCallback(async () => {
    if (!supabaseConfigured || !supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
    const current = toSupabaseCompatibleUser((await supabase.auth.getUser()).data.user);
    await Promise.all([refreshCatalog(), refreshUserState(current)]);
  }, [refreshCatalog, refreshUserState]);

  const value: AuthContextValue = {
    user,
    loading,
    emailVerified,
    isAdmin,
    isSuspended,
    profile,
    privateInfo,
    subscription,
    plansCatalog,
    featureFlags,
    entitlements,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resendVerification,
    reloadUser,
    requestPasswordReset,
    logout,
    changePassword,
    deleteAccountSafely,
    refreshBillingAndProfile,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
