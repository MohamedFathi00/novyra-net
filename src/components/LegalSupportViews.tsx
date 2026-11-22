import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  HelpCircle,
  LifeBuoy,
  Send,
  Shield,
} from 'lucide-react';
import type { Language, SupportTicketDoc } from '../types/network';
import { useAuth } from '../context/AuthContext';
import {
  closeOwnSupportTicket,
  createSupportTicket,
  fetchUserSupportTickets,
} from '../services/cloudSyncService';

export type SupportLegalTab = 'support' | 'terms' | 'privacy' | 'subscription' | 'refund';

interface LegalSupportViewsProps {
  language: Language;
  initialTab?: SupportLegalTab;
  onRequireAuth: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string) => void;
}

export const LegalSupportViews: React.FC<LegalSupportViewsProps> = ({
  language,
  initialTab = 'support',
  onRequireAuth,
  onNotify,
}) => {
  const isAr = language === 'ar';
  const { user, emailVerified } = useAuth();
  const [tab, setTab] = useState<SupportLegalTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [tickets, setTickets] = useState<SupportTicketDoc[]>([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicketDoc['category']>('technical');
  const [priority, setPriority] = useState<SupportTicketDoc['priority']>('medium');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!user || !emailVerified) return;
    try {
      const list = await fetchUserSupportTickets(user.uid);
      setTickets(list);
    } catch {
      // Ignore transient query errors
    }
  }, [emailVerified, user]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !emailVerified) {
      onRequireAuth();
      return;
    }
    if (subject.trim().length < 3 || message.trim().length < 5) {
      onNotify('error', isAr ? 'يرجى كتابة عنوان وتفاصيل كافية.' : 'Please enter a valid subject and message.');
      return;
    }

    setSubmitting(true);
    try {
      await createSupportTicket({
        uid: user.uid,
        subject,
        category,
        priority,
        message,
      });
      setSubject('');
      setMessage('');
      onNotify('success', isAr ? 'تم إرسال تذكرة الدعم بنجاح.' : 'Support ticket submitted.');
      await loadTickets();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">
            {isAr ? 'مركز الدعم والسياسات القانونية' : 'Support Center & Legal Policies'}
          </h2>
          <p className="text-sm text-[#4c538c] dark:text-[#cfd3ff] mt-0.5">
            {isAr
              ? 'إدارة تذاكر الدعم الفني ومراجعة شروط الاستخدام والخصوصية.'
              : 'Submit verified support requests and review platform legal templates.'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'support', label: isAr ? 'تذاكر الدعم' : 'Support Tickets', icon: LifeBuoy },
            { id: 'terms', label: isAr ? 'شروط الاستخدام' : 'Terms of Service', icon: FileText },
            { id: 'privacy', label: isAr ? 'سياسة الخصوصية' : 'Privacy Policy', icon: Shield },
            { id: 'subscription', label: isAr ? 'الاشتراك والإلغاء' : 'Subscription Terms', icon: HelpCircle },
            { id: 'refund', label: isAr ? 'سياسة الاسترداد' : 'Refund Policy', icon: FileText },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                active
                  ? 'nv-btn-primary'
                  : 'border border-[#262a6b] bg-[#0d1033] text-[#cfd3ff]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'support' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleSubmit} className="nv-card p-5 lg:col-span-5 space-y-4 text-xs">
            <h3 className="font-display text-sm font-bold text-[#eef0ff]">
              {isAr ? 'فتح تذكرة دعم جديدة' : 'Submit a Support Ticket'}
            </h3>

            {!user || !emailVerified ? (
              <div className="nv-inner p-4 space-y-3">
                <p className="text-[#cfd3ff]">
                  {isAr
                    ? 'يرجى تسجيل الدخول بحساب مؤكد لإنشاء ومتابعة تذاكر الدعم.'
                    : 'Sign in with a verified account to submit and track support tickets.'}
                </p>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="rounded-xl nv-btn-primary px-4 py-2 font-bold"
                >
                  {isAr ? 'تسجيل الدخول' : 'Sign In'}
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block mb-1 text-[#9aa0d6]">
                    {isAr ? 'الموضوع' : 'Subject'}
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={isAr ? 'وصف مختصر للمشكلة' : 'Brief summary of your issue'}
                    className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-[#9aa0d6]">
                      {isAr ? 'التصنيف' : 'Category'}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as SupportTicketDoc['category'])}
                      className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
                    >
                      <option value="technical">{isAr ? 'فني' : 'Technical'}</option>
                      <option value="billing">{isAr ? 'الفواتير' : 'Billing'}</option>
                      <option value="account">{isAr ? 'الحساب' : 'Account'}</option>
                      <option value="business">{isAr ? 'الأعمال' : 'Business'}</option>
                      <option value="bug">{isAr ? 'خلل برمجي' : 'Bug Report'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-[#9aa0d6]">
                      {isAr ? 'الأولوية' : 'Priority'}
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as SupportTicketDoc['priority'])}
                      className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
                    >
                      <option value="low">{isAr ? 'منخفضة' : 'Low'}</option>
                      <option value="medium">{isAr ? 'متوسطة' : 'Medium'}</option>
                      <option value="high">{isAr ? 'عالية' : 'High'}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-[#9aa0d6]">
                    {isAr ? 'الرسالة' : 'Message'}
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={isAr ? 'اكتب تفاصيل المشكلة أو الاستفسار...' : 'Describe your question or issue...'}
                    className="w-full rounded-xl border border-[#262a6b] bg-[#0a0d33] px-3 py-2 text-[#eef0ff]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl nv-btn-primary px-4 py-2.5 font-bold disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : isAr ? 'إرسال التذكرة' : 'Submit Ticket'}</span>
                </button>
              </>
            )}
          </form>

          <div className="nv-card p-5 lg:col-span-7 space-y-3 text-xs">
            <h3 className="font-display text-sm font-bold">
              {isAr ? 'تذاكر الدعم الخاصة بك' : 'Your Support Tickets'}
            </h3>
            {tickets.length === 0 ? (
              <div className="py-10 text-center text-[#5a6099] dark:text-[#9aa0d6]">
                {isAr ? 'لا توجد تذاكر دعم مسجلة بعد.' : 'No support tickets submitted yet.'}
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((tkt) => (
                  <div key={tkt.id} className="nv-inner p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-sm">{tkt.subject}</span>
                      <span className="rounded-lg bg-[#6555FF]/15 border border-[#7a6bff]/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                        {isAr
                          ? tkt.status === 'open'
                            ? 'مفتوحة'
                            : tkt.status === 'in_progress'
                              ? 'قيد المعالجة'
                              : tkt.status === 'resolved'
                                ? 'تم الحل'
                                : 'مغلقة'
                          : tkt.status}
                      </span>
                    </div>
                    <p className="text-[#4c538c] dark:text-[#cfd3ff]">{tkt.message}</p>
                    {tkt.adminResponse && (
                      <div className="rounded-xl border border-[#22e06b]/30 bg-[#22e06b]/10 p-3 text-[#0a9a45] dark:text-[#22e06b]">
                        <div className="font-bold flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{isAr ? 'رد فريق الدعم:' : 'Support Response:'}</span>
                        </div>
                        <p>{tkt.adminResponse}</p>
                      </div>
                    )}
                    {tkt.status !== 'closed' && tkt.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await closeOwnSupportTicket(tkt.id);
                          await loadTickets();
                        }}
                        className="text-[11px] text-[#f06478] hover:underline"
                      >
                        {isAr ? 'إغلاق التذكرة' : 'Close Ticket'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="nv-card p-6 space-y-4 text-xs leading-relaxed text-[#4c538c] dark:text-[#cfd3ff]">
          <div className="rounded-xl border border-[#f5b942]/40 bg-[#f5b942]/10 p-3 text-[#d97706] dark:text-[#f5b942] font-semibold">
            {isAr
              ? 'ملاحظة امتثال: هذا النص قالب قانوني قياسي ويتطلب استكمال بيانات الكيان التجاري المسجل وعنوان التواصل القانوني الرسمي قبل الإطلاق التجاري العام.'
              : 'Compliance Template Notice: Update legal business registration details, jurisdiction, and official legal contact email before commercial public launch.'}
          </div>

          {tab === 'terms' && (
            <>
              <h3 className="font-display text-lg font-bold text-[#141847] dark:text-[#eef0ff]">
                {isAr ? 'شروط استخدام NOVYRA Net' : 'NOVYRA Net — Terms of Service'}
              </h3>
              <p>
                {isAr
                  ? 'يوفر NOVYRA Net أدوات اختبار سرعة الإنترنت، قياس البنج، تشخيص DNS والمسار، والتحليل الذكي للأفراد والمؤسسات. يلتزم المستخدم باستخدام أدوات الفحص الشبكي للأغراض المشروعة فقط وعلى الشبكات المصرح بفحصها.'
                  : 'NOVYRA Net provides internet speed benchmarking, RTT diagnostics, DNS tools, and AI advisory strictly for legitimate diagnostics on authorized domains and networks.'}
              </p>
              <p>
                {isAr
                  ? 'قد تعتمد قياسات المتصفح على ظروف المتصفح والجهاز ومزود الخدمة، ولا يضمن NOVYRA Net نتائج مزود الإنترنت الخارجي.'
                  : 'Browser measurements reflect actual HTTP/TCP transfer performance between your device and active endpoints and do not alter ISP routing agreements.'}
              </p>
            </>
          )}

          {tab === 'privacy' && (
            <>
              <h3 className="font-display text-lg font-bold text-[#141847] dark:text-[#eef0ff]">
                {isAr ? 'سياسة الخصوصية وحماية البيانات' : 'NOVYRA Net — Privacy Policy'}
              </h3>
              <p>
                {isAr
                  ? 'يخزن NOVYRA Net بيانات التعريف الشخصية الحساسة (البريد الإلكتروني والدولة) في مستندات معزولة ومحمية بقواعد Firestore لا يقرأها سوى صاحب الحساب أو المسؤول المصرح له.'
                  : 'Personal identifiable fields (email, country) are isolated inside owner-scoped Firestore private documents protected by zero-trust security rules.'}
              </p>
              <p>
                {isAr
                  ? 'يمكنك تصدير نسخة احتياطية كاملة من اختباراتك أو حذف حسابك نهائياً من صفحة إعدادات الحساب.'
                  : 'You may export your test history anytime or permanently delete your account and associated profile records from Account Security settings.'}
              </p>
            </>
          )}

          {tab === 'subscription' && (
            <>
              <h3 className="font-display text-lg font-bold text-[#141847] dark:text-[#eef0ff]">
                {isAr ? 'شروط الاشتراك والإلغاء' : 'Subscription & Cancellation Terms'}
              </h3>
              <p>
                {isAr
                  ? 'تتجدد الباقات المدفوعة حسب دورة الفوترة المختارة (شهرياً أو سنوياً) عند ربط مزود الدفع Stripe، ويمكن إلغاء التجديد التلقائي قبل نهاية الفترة الجارية دون رسوم إضافية.'
                  : 'Paid plans renew on the selected monthly or annual billing interval once Stripe billing is configured, and renewal may be canceled prior to period end.'}
              </p>
            </>
          )}

          {tab === 'refund' && (
            <>
              <h3 className="font-display text-lg font-bold text-[#141847] dark:text-[#eef0ff]">
                {isAr ? 'سياسة الاسترداد' : 'Refund Policy'}
              </h3>
              <p>
                {isAr
                  ? 'تُراجع طلبات الاسترداد الخاصة بأخطاء الفوترة أو التكرار خلال 14 يوماً عبر تذاكر الدعم أو بوابة الدفع الرسمية المعتمدة للنشاط التجاري.'
                  : 'Refund requests for duplicate charges or verified billing issues are reviewed via Support Tickets or your Stripe customer billing portal.'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
