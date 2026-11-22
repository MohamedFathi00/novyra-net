import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import { auth, db, googleProvider, isBootstrapAdminEmail } from '../services/firebase';
import { supabase, supabaseConfigured } from '../services/supabase';
import {
  DEFAULT_PLAN_CATALOG,
  getUserEntitlements,
  type ResolvedEntitlements,
} from '../services/entitlementService';
import {
  ensureUserAccountDocs,
  fetchFeatureFlags,
  fetchPlansCatalog,
  fetchUserProfileAndBilling,
} from '../services/cloudSyncService';
import { fetchMyServerSubscription } from '../services/billingClientService';
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
  user: User | SupabaseCompatibleUser | null;
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
  const [user, setUser] = useState<User | SupabaseCompatibleUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfoDoc | null>(null);
  const [subscription, setSubscription] = useState<UserSubscriptionDoc | null>(null);
  const [entitlementDoc, setEntitlementDoc] = useState<Awaited<ReturnType<typeof fetchUserProfileAndBilling>>['entitlement']>(null);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [plansCatalog, setPlansCatalog] = useState<Record<PlanId, SubscriptionPlanConfig>>(DEFAULT_PLAN_CATALOG);
  const [featureFlags, setFeatureFlags] = useState<Record<string, FeatureFlagDoc>>({});

  const refreshCatalog = useCallback(async () => {
    const [plans, flags] = await Promise.all([fetchPlansCatalog(), fetchFeatureFlags()]);
    setPlansCatalog(plans);
    setFeatureFlags(flags);
  }, []);

  const refreshUserState = useCallback(async (currentUser: User | null) => {
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

    if (supabaseConfigured) {
      const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'NOVYRA User';
      setProfile({
        uid: currentUser.uid,
        displayName,
        photoUrl: currentUser.photoURL || undefined,
        language: document.documentElement.lang === 'en' ? 'en' : 'ar',
        accountStatus: 'active',
      });
      setPrivateInfo({ uid: currentUser.uid, email: currentUser.email || '' });
      setSubscription({
        userId: currentUser.uid,
        planId: 'free',
        billingCycle: 'none',
        status: 'active',
        provider: 'supabase',
        cancelAtPeriodEnd: false,
      });
      setEntitlementDoc(null);
      setIsAdminDoc(isBootstrapAdminEmail(currentUser.email));
      return;
    }

    const isBootstrapAdmin = Boolean(
      currentUser.emailVerified && isBootstrapAdminEmail(currentUser.email),
    );

    await ensureUserAccountDocs({
      uid: currentUser.uid,
      email: currentUser.email || '',
      displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'NOVYRA User',
      photoUrl: currentUser.photoURL,
      language: document.documentElement.lang === 'en' ? 'en' : 'ar',
      isBootstrapAdmin,
    });

    const token = await currentUser.getIdToken().catch(() => null);
    const [data, serverSub] = await Promise.all([
      fetchUserProfileAndBilling(currentUser.uid),
      token ? fetchMyServerSubscription(token).catch(() => null) : Promise.resolve(null),
    ]);
    setProfile(data.profile);
    setPrivateInfo(data.privateInfo);
    if (serverSub && serverSub.status === 'active' && serverSub.planId !== 'free') {
      setSubscription(
        data.subscription ?? {
          userId: currentUser.uid,
          planId: serverSub.planId,
          billingCycle: serverSub.billingCycle,
          status: 'active',
          provider: serverSub.provider,
          cancelAtPeriodEnd: false,
        },
      );
      setEntitlementDoc(data.entitlement);
    } else {
      setSubscription(data.subscription);
      setEntitlementDoc(data.entitlement);
    }
    setIsAdminDoc(data.isAdminDoc || isBootstrapAdmin);
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
          await refreshUserState(nextUser as User | null);
        } finally {
          if (active) setLoading(false);
        }
      };
      bootstrap().catch(() => setLoading(false));
      const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, next) => {
        const nextUser = toSupabaseCompatibleUser(next?.user || null);
        setUser(nextUser);
        refreshUserState(nextUser as User | null).catch((err) => console.error('Supabase auth bootstrap error:', err));
      });
      return () => {
        active = false;
        listener.subscription.unsubscribe();
      };
    }
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      try {
        await refreshUserState(nextUser);
      } catch (err) {
        console.error('Auth state bootstrap error:', err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [refreshCatalog, refreshUserState]);

  const emailVerified = Boolean(user?.emailVerified);
  const isBootstrapAdmin = Boolean(
    user?.emailVerified && isBootstrapAdminEmail(user.email),
  );
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
    if (supabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw error;
      return;
    }
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (supabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      return;
    }
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const registerWithEmail = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
      country?: string;
      language: Language;
    }) => {
      if (supabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: params.email.trim(),
          password: params.password,
          options: { data: { display_name: params.displayName.trim().slice(0, 100) }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        return { verificationSent: !data.session };
      }
      const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
      await updateProfile(cred.user, { displayName: params.displayName.trim().slice(0, 100) });
      await sendEmailVerification(cred.user);
      return { verificationSent: true };
    },
    [],
  );

  const resendVerification = useCallback(async () => {
    if (supabaseConfigured && supabase) {
      const email = user?.email;
      if (!email) return;
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      return;
    }
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }, []);

  const reloadUser = useCallback(async () => {
    if (supabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const updated = toSupabaseCompatibleUser(data.user);
      setUser(updated);
      await refreshUserState(updated as User | null);
      return;
    }
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const updated = auth.currentUser;
    setUser(updated);
    await refreshUserState(updated);
  }, [refreshUserState]);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (supabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      return;
    }
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const logout = useCallback(async () => {
    if (supabaseConfigured && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return;
    }
    await signOut(auth);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (supabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return;
    }
    const current = auth.currentUser;
    if (!current || !current.email) throw new Error('No email-authenticated user session.');
    const cred = EmailAuthProvider.credential(current.email, currentPassword);
    await reauthenticateWithCredential(current, cred);
    await updatePassword(current, newPassword);
  }, []);

  const deleteAccountSafely = useCallback(async (currentPassword?: string) => {
    if (supabaseConfigured && supabase) {
      throw new Error('ACCOUNT_DELETE_REQUIRES_SERVER_ADMIN');
    }
    const current = auth.currentUser;
    if (!current) throw new Error('Not signed in.');
    const usesPassword = current.providerData.some((p) => p.providerId === 'password');
    if (usesPassword) {
      if (!currentPassword || !current.email) {
        throw new Error('REAUTH_PASSWORD_REQUIRED');
      }
      const cred = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, cred);
    } else {
      await reauthenticateWithPopup(current, googleProvider);
    }

    try {
      await deleteDoc(doc(db, 'users', current.uid, 'private', 'info'));
      await deleteDoc(doc(db, 'users', current.uid));
    } catch {
      // Proceed to delete auth account even if secondary docs absent
    }
    await deleteUser(current);
  }, []);

  const getIdToken = useCallback(async () => {
    if (supabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    }
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  const refreshBillingAndProfile = useCallback(async () => {
    const current = supabaseConfigured && supabase
      ? toSupabaseCompatibleUser((await supabase.auth.getUser()).data.user)
      : auth.currentUser;
    await Promise.all([refreshCatalog(), refreshUserState(current as User | null)]);
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
