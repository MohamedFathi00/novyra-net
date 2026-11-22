import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LogIn,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { Language } from '../types/network';
import { useAuth } from '../context/AuthContext';
import { NovyraLogo } from './NovyraLogo';

export type AuthViewMode = 'login' | 'register' | 'forgot';

interface AuthViewsProps {
  language: Language;
  initialMode?: AuthViewMode;
  onBack?: () => void;
  onSuccess: () => void;
  onOpenLegal: (tab: 'terms' | 'privacy') => void;
}

function mapFirebaseAuthError(err: unknown, isAr: boolean): string {
  const code = (err as { code?: string })?.code || '';
  if (err instanceof Error && err.message === 'SUPABASE_NOT_CONFIGURED') {
    return isAr
      ? 'تسجيل الدخول السحابي غير مُعدّ بعد. أضف VITE_SUPABASE_ANON_KEY في إعدادات Vercel.'
      : 'Cloud sign-in is not configured yet. Add VITE_SUPABASE_ANON_KEY in Vercel project settings.';
  }
  if (code.includes('operation-not-allowed')) {
    return isAr
      ? 'مزود البريد وكلمة المرور غير مفعّل بعد في Firebase Console. يمكنك تسجيل الدخول فوراً عبر Google أو تفعيل Email/Password من إعدادات Authentication في Firebase.'
      : 'Email/Password sign-in is not yet enabled in Firebase Authentication Console. You can sign in immediately with Google, or enable Email/Password in Firebase Console.';
  }
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.';
  }
  if (code.includes('email-already-in-use')) {
    return isAr ? 'هذا البريد مسجل مسبقاً. جرّب تسجيل الدخول.' : 'An account with this email already exists.';
  }
  if (code.includes('weak-password')) {
    return isAr ? 'كلمة المرور ضعيفة جداً (استخدم 8 أحرف على الأقل).' : 'Password must be at least 8 characters.';
  }
  if (code.includes('popup-closed-by-user')) {
    return isAr ? 'تم إغلاق نافذة تسجيل الدخول عبر Google.' : 'Google sign-in popup was closed.';
  }
  if (code.includes('too-many-requests')) {
    return isAr ? 'تم إرسال عدة محاولات متكررة. يرجى الانتظار قليلاً.' : 'Too many attempts. Please wait briefly before retrying.';
  }
  return err instanceof Error ? err.message : isAr ? 'تعذر إتمام العملية.' : 'Authentication error.';
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  language,
  initialMode = 'login',
  onBack,
  onSuccess,
  onOpenLegal,
}) => {
  const isAr = language === 'ar';
  const {
    user,
    emailVerified,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    requestPasswordReset,
    resendVerification,
    reloadUser,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<AuthViewMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  // Signed-in but unverified email gate inside the app shell
  if (user && !emailVerified) {
    return (
      <div className="max-w-lg mx-auto py-4">
        <div className="nv-card w-full p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5b942]/15 text-[#f5b942]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">
                {isAr ? 'تأكيد البريد الإلكتروني مطلوب' : 'Verify Your Email Address'}
              </h2>
              <p className="text-xs text-[#5a6099] dark:text-[#9aa0d6] font-mono-tabular">{user.email}</p>
            </div>
          </div>

          <p className="text-xs text-[#4c538c] dark:text-[#cfd3ff] leading-relaxed">
            {isAr
              ? 'أرسلنا رابط التفعيل إلى بريدك الإلكتروني. يجب تأكيد البريد لتفعيل الحفظ السحابي والاشتراكات والتذاكر لحماية حسابك.'
              : 'We sent a verification link to your inbox. Email verification is enforced before cloud storage, billing, or support writes unlock.'}
          </p>

          {infoMsg && (
            <div className="rounded-xl border border-[#22e06b]/40 bg-[#22e06b]/10 p-3 text-xs text-[#0a9a45] dark:text-[#22e06b]">
              {infoMsg}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-[#f06478]/40 bg-[#f06478]/10 p-3 text-xs text-[#dc2626] dark:text-[#f06478]">
              {error}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await reloadUser();
                  onSuccess();
                } catch (e) {
                  setError(mapFirebaseAuthError(e, isAr));
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl nv-btn-primary py-2.5 text-xs font-bold"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              <span>{isAr ? 'تم التأكيد — تحديث الحالة' : 'I Verified My Email (Continue)'}</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await resendVerification();
                  setInfoMsg(isAr ? 'تم إعادة إرسال رابط التأكيد.' : 'Verification email resent.');
                } catch (e) {
                  setError(mapFirebaseAuthError(e, isAr));
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] py-2.5 text-xs font-semibold hover:border-[#18c8ff]"
            >
              {isAr ? 'إعادة إرسال رابط التفعيل' : 'Resend Verification Email'}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              {onBack ? (
                <button type="button" onClick={onBack} className="text-[#0891b2] dark:text-[#18c8ff] hover:underline">
                  {isAr ? 'العودة إلى لوحة التحكم' : 'Return to Dashboard'}
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => logout()}
                className="text-[#f06478] hover:underline"
              >
                {isAr ? 'تسجيل الخروج' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    setInfoMsg(null);
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (e) {
      setError(mapFirebaseAuthError(e, isAr));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);

    if (mode === 'forgot') {
      if (!email.trim()) return;
      setBusy(true);
      try {
        await requestPasswordReset(email);
        setInfoMsg(
          isAr
            ? 'إذا كان البريد مسجلاً لدينا فسيصلك رابط إعادة تعيين كلمة المرور.'
            : 'If an account matches this email, a password reset link has been sent.',
        );
      } catch (err) {
        setError(mapFirebaseAuthError(err, isAr));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'login') {
      setBusy(true);
      try {
        await signInWithEmail(email, password);
        onSuccess();
      } catch (err) {
        setError(mapFirebaseAuthError(err, isAr));
      } finally {
        setBusy(false);
      }
      return;
    }

    // Register validation
    if (!displayName.trim()) {
      setError(isAr ? 'يرجى إدخال الاسم الكامل.' : 'Please enter your full name.');
      return;
    }
    if (password.length < 8) {
      setError(isAr ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' : 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      setError(isAr ? 'يجب الموافقة على الشروط وسياسة الخصوصية.' : 'Please accept the Terms and Privacy Policy.');
      return;
    }

    setBusy(true);
    try {
      await registerWithEmail({
        email,
        password,
        displayName,
        country: country.trim() || undefined,
        language,
      });
      setInfoMsg(
        isAr
          ? 'تم إنشاء الحساب وإرسال رسالة تأكيد البريد الإلكتروني.'
          : 'Account created. Verification link sent to your email.',
      );
    } catch (err) {
      setError(mapFirebaseAuthError(err, isAr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-2">
      <div className="nv-card w-full p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5a6099] dark:text-[#9aa0d6] hover:text-[#18c8ff]"
            >
              <ArrowLeft className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
              <span>{isAr ? 'العودة للوحة الرئيسية' : 'Back to Dashboard'}</span>
            </button>
          ) : (
            <span className="text-xs font-semibold text-[#0891b2] dark:text-[#18c8ff]">
              {isAr ? 'حساب NOVYRA السحابي' : 'NOVYRA Cloud Account'}
            </span>
          )}
          <NovyraLogo size={32} />
        </div>

        <div>
          <h2 className="font-display text-xl font-bold">
            {mode === 'login'
              ? isAr
                ? 'تسجيل الدخول إلى NOVYRA Net'
                : 'Sign In to NOVYRA Net'
              : mode === 'register'
                ? isAr
                  ? 'إنشاء حساب NOVYRA Net جديد'
                  : 'Create Your NOVYRA Net Account'
                : isAr
                  ? 'استعادة كلمة المرور'
                  : 'Reset Your Password'}
          </h2>
          <p className="text-xs text-[#5a6099] dark:text-[#9aa0d6] mt-1">
            {isAr
              ? 'احفظ نتائجك سحابياً وراقب أجهزتك عبر كل أجهزتك.'
              : 'Sync test telemetry, register devices, and manage your plan.'}
          </p>
        </div>

        {/* Mode Tabs */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#c4cbf2] dark:border-[#262a6b] p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`rounded-lg py-2 text-xs font-bold ${mode === 'login' ? 'nv-btn-primary' : ''}`}
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`rounded-lg py-2 text-xs font-bold ${mode === 'register' ? 'nv-btn-primary' : ''}`}
            >
              {isAr ? 'حساب جديد' : 'Create Account'}
            </button>
          </div>
        )}

        {/* Primary Google OAuth */}
        {mode !== 'forgot' && (
          <button
            type="button"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[#262a6b] bg-[#10134a]/80 py-2.5 text-xs font-bold text-[#eef0ff] hover:border-[#18c8ff] transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-[#18c8ff]" />
            <span>{isAr ? 'المتابعة باستخدام Google (موثق فوراً)' : 'Continue with Google (Instant Verified)'}</span>
          </button>
        )}

        {mode !== 'forgot' && (
          <div className="flex items-center gap-3 text-[11px] text-[#9aa0d6]">
            <div className="h-px flex-1 bg-[#262a6b]" />
            <span>{isAr ? 'أو بالبريد الإلكتروني' : 'or with email'}</span>
            <div className="h-px flex-1 bg-[#262a6b]" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-[#f06478]/40 bg-[#f06478]/10 p-3 text-xs text-[#f06478] flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {infoMsg && (
          <div className="rounded-xl border border-[#22e06b]/40 bg-[#22e06b]/10 p-3 text-xs text-[#22e06b] flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {mode === 'register' && (
            <div>
              <label className="block mb-1 text-[#9aa0d6]">
                {isAr ? 'الاسم الكامل' : 'Full Name'}
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={isAr ? 'مثال: محمد حسن' : 'Alex Mercer'}
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3.5 py-2.5 text-[#eef0ff]"
              />
            </div>
          )}

          <div>
            <label className="block mb-1 text-[#9aa0d6]">
              {isAr ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3.5 py-2.5 text-[#eef0ff]"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="block mb-1 text-[#9aa0d6]">
                {isAr ? 'كلمة المرور' : 'Password'}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3.5 py-2.5 text-[#eef0ff]"
              />
              {mode === 'register' && password.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-1 flex-1 rounded-full ${
                        passwordStrength >= lvl
                          ? passwordStrength >= 3
                            ? 'bg-[#22e06b]'
                            : 'bg-[#f5b942]'
                          : 'bg-[#262a6b]/40'
                      }`}
                    />
                  ))}
                  <span className="text-[10px] text-[#9aa0d6]">
                    {passwordStrength >= 3 ? (isAr ? 'قوية' : 'Strong') : isAr ? 'متوسطة' : 'Weak'}
                  </span>
                </div>
              )}
            </div>
          )}

          {mode === 'register' && (
            <>
              <div>
                <label className="block mb-1 text-[#9aa0d6]">
                  {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3.5 py-2.5 text-[#eef0ff]"
                />
              </div>

              <div>
                <label className="block mb-1 text-[#9aa0d6]">
                  {isAr ? 'الدولة (اختياري)' : 'Country (Optional)'}
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder={isAr ? 'مصر / السعودية / ...' : 'Egypt / UAE / USA'}
                  className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3.5 py-2.5 text-[#eef0ff]"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#6555FF]"
                />
                <span className="text-[11px] text-[#4c538c] dark:text-[#cfd3ff]">
                  {isAr ? 'أوافق على ' : 'I agree to the '}
                  <button
                    type="button"
                    onClick={() => onOpenLegal('terms')}
                    className="text-[#18c8ff] hover:underline"
                  >
                    {isAr ? 'شروط الاستخدام' : 'Terms'}
                  </button>
                  {isAr ? ' و ' : ' and '}
                  <button
                    type="button"
                    onClick={() => onOpenLegal('privacy')}
                    className="text-[#18c8ff] hover:underline"
                  >
                    {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
                  </button>
                </span>
              </label>
            </>
          )}

          {mode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError(null);
                  setInfoMsg(null);
                }}
                className="text-[11px] text-[#0891b2] dark:text-[#18c8ff] hover:underline"
              >
                {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl nv-btn-primary py-2.5 text-xs font-bold disabled:opacity-50"
          >
            {mode === 'login' ? (
              <LogIn className="h-4 w-4" />
            ) : mode === 'register' ? (
              <UserPlus className="h-4 w-4" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            <span>
              {busy
                ? isAr
                  ? 'جاري التنفيذ...'
                  : 'Processing...'
                : mode === 'login'
                  ? isAr
                    ? 'تسجيل الدخول'
                    : 'Sign In'
                  : mode === 'register'
                    ? isAr
                      ? 'إنشاء الحساب'
                      : 'Create Account'
                    : isAr
                      ? 'إرسال رابط الاستعادة'
                      : 'Send Reset Link'}
            </span>
          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setInfoMsg(null);
              }}
              className="w-full text-center text-xs text-[#5a6099] dark:text-[#9aa0d6] hover:underline pt-1"
            >
              {isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
