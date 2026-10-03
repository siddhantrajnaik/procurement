import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, ExternalLink, Mail, Phone, Store, X, UserPlus, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as api from '../lib/api';
import { useUI } from '../context/UIContext';
import { timeAgo } from '../lib/format';
import { VendorSubmission } from '../types';
import { AddVendorModal } from './AddVendorModal';

const VENDOR_PAGE_URL =
  typeof window !== 'undefined' ? new URL(`${import.meta.env.BASE_URL}vendor.html`, window.location.origin).href : '';

let channelSeq = 0;

export const VendorPagePanel: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const { showToast } = useUI();
  const [submissions, setSubmissions] = useState<VendorSubmission[]>([]);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [adding, setAdding] = useState<VendorSubmission | null>(null);
  const seq = useRef(0);
  const prefill = useMemo(
    () =>
      adding && {
        name: adding.company || adding.name,
        contact: [adding.phone, adding.email].filter(Boolean).join(' · '),
        comment: [adding.company ? `Contact: ${adding.name}` : '', adding.message ?? ''].filter(Boolean).join('\n'),
      },
    [adding]
  );

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    const [subs, mail] = await Promise.allSettled([api.fetchVendorSubmissions(), api.fetchQuoteEmail()]);
    if (mine !== seq.current) return;
    if (subs.status === 'fulfilled') setSubmissions(subs.value);
    if (mail.status === 'fulfilled') setSavedEmail(mail.value);
    setLoadError(subs.status === 'rejected' || mail.status === 'rejected');
  }, []);

  useEffect(() => {
    void reload();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const queue = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => { pending = null; void reload(); }, 250);
    };
    const channel = supabase
      .channel(`vendor-page-${++channelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_submissions' }, queue)
      .subscribe();
    return () => {
      if (pending) clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  useEffect(() => { setEmail(savedEmail ?? ''); }, [savedEmail]);

  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailDirty = email.trim() !== (savedEmail ?? '');

  const saveEmail = async () => {
    if (!emailValid || savingEmail) return;
    setSavingEmail(true);
    try {
      await api.setQuoteEmail(email.trim() || null);
      setSavedEmail(email.trim() || null);
      showToast(email.trim() ? 'Quotation email saved.' : 'Quotation email removed from the vendor page.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the email.', 'error');
    } finally {
      setSavingEmail(false);
    }
  };

  const setStatus = async (s: VendorSubmission, status: 'added' | 'dismissed') => {
    setSubmissions((list) => list.filter((x) => x.id !== s.id));
    try {
      await api.setVendorSubmissionStatus(s.id, status);
    } catch {
      showToast('Could not update it. Try again.', 'error');
      void reload();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(VENDOR_PAGE_URL);
      showToast('Vendor page link copied.', 'success');
    } catch {
      showToast(VENDOR_PAGE_URL, 'info');
    }
  };

  return (
    <section className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4 text-emerald-400 shrink-0" />
        <h2 className="text-sm font-bold text-white flex-1">Vendor page</h2>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-gray-300 bg-[#2A2A2A] hover:text-white"
        >
          <Copy className="w-3.5 h-3.5" /> Copy link
        </button>
        <a
          href={VENDOR_PAGE_URL}
          target="_blank"
          rel="noopener"
          aria-label="Open vendor page"
          className="p-1.5 rounded-md text-gray-400 bg-[#2A2A2A] hover:text-white"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <p className="text-[11px] text-gray-400">
        Vendors see requests marked "Show to vendors" until they're ordered. Make the QR code from the link.
      </p>

      {loadError && (
        <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
          Could not load vendor page data. If this is new, run migration 0033.
        </p>
      )}

      <div>
        <label htmlFor="quote-email" className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Quotations go to
        </label>
        <div className="flex gap-2">
          <input
            id="quote-email"
            type="email"
            inputMode="email"
            value={email}
            disabled={readOnly}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Not set — hidden from vendors"
            className="flex-1 min-w-0 px-3 py-2 bg-[#161616] border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary disabled:opacity-60"
          />
          {!readOnly && emailDirty && (
            <button
              type="button"
              onClick={() => void saveEmail()}
              disabled={!emailValid || savingEmail}
              className="shrink-0 px-3 rounded-md text-xs font-semibold bg-primary text-white disabled:opacity-40"
            >
              {savingEmail ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
        {!emailValid && <p className="text-[11px] text-red-400 mt-1">That email address doesn't look right.</p>}
      </div>

      {submissions.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            From the vendor page · {submissions.length}
          </p>
          {submissions.map((s) => (
            <article key={s.id} className="bg-[#161616] border border-[#2A2A2A] rounded-lg p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <span
                  className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    s.kind === 'offer'
                      ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                      : 'text-blue-300 bg-blue-500/10 border-blue-500/20'
                  }`}
                >
                  {s.kind === 'offer' ? <Tag className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                  {s.kind === 'offer' ? 'Offer' : 'Sign-up'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white break-words">
                    {s.company || s.name}
                    {s.company && <span className="text-gray-400 font-normal"> · {s.name}</span>}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-0.5">
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 hover:text-white">
                        <Phone className="w-3 h-3" /> {s.phone}
                      </a>
                    )}
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 hover:text-white break-all">
                        <Mail className="w-3 h-3" /> {s.email}
                      </a>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] text-gray-500">{timeAgo(s.createdAt)}</span>
              </div>
              {s.message && (
                <p className="text-xs text-gray-300 whitespace-pre-line break-words bg-[#1E1E1E] rounded-md p-2 border border-[#2A2A2A]">
                  {s.message}
                </p>
              )}
              {!readOnly && (
                <div className="flex justify-end gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => void setStatus(s, 'dismissed')}
                    className="inline-flex items-center gap-1 min-h-9 px-3 rounded-md text-xs text-gray-400 hover:text-white hover:bg-[#2A2A2A]"
                  >
                    <X className="w-3.5 h-3.5" /> Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdding(s)}
                    className="inline-flex items-center gap-1 min-h-9 px-3 rounded-md text-xs font-semibold text-white bg-primary hover:bg-orange-600"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Add to directory
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <AddVendorModal
        open={!!adding}
        onClose={() => setAdding(null)}
        editVendor={null}
        prefill={prefill}
        onSaved={() => { if (adding) void setStatus(adding, 'added'); }}
      />
    </section>
  );
};
