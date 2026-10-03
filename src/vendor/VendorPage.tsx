import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Mail, RefreshCw, Tag, UserPlus, X } from 'lucide-react';

// Only the project URL is referenced here — never the client or its key.
const FEED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-board`;

interface Item {
  title: string;
  catalogNumber: string | null;
  quantity: string;
  brand: string | null;
}

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; items: Item[]; quoteEmail: string | null };
type FormKind = 'register' | 'offer';

export function VendorPage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [form, setForm] = useState<FormKind | null>(null);

  const fetchBoard = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      const res = await fetch(FEED_URL);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setLoad({ state: 'ready', items: data.items ?? [], quoteEmail: data.quoteEmail ?? null });
    } catch {
      setLoad({ state: 'error' });
    }
  }, []);

  useEffect(() => { void fetchBoard(); }, [fetchBoard]);

  const quoteEmail = load.state === 'ready' ? load.quoteEmail : null;

  return (
    <div className="min-h-dvh">
      <main className="max-w-xl mx-auto px-4 pt-8 pb-16 flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">MB Lab · IIT Delhi</p>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">What we need</h1>
          <p className="text-sm text-muted">Structural Virology Lab. Items we're looking to buy right now.</p>
        </header>

        <section aria-labelledby="needs" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="needs" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Open requirements
            </h2>
            {load.state === 'ready' && load.items.length > 0 && (
              <span className="text-xs text-muted tabular-nums">{load.items.length} item{load.items.length === 1 ? '' : 's'}</span>
            )}
          </div>

          {load.state === 'loading' && (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[88px] rounded-xl bg-card border border-line animate-pulse" />
              ))}
            </div>
          )}

          {load.state === 'error' && (
            <div role="alert" className="rounded-xl border border-line bg-card p-5 flex flex-col items-start gap-3">
              <p className="text-sm">The list couldn't be loaded. Check your connection and try again.</p>
              <button
                type="button"
                onClick={() => void fetchBoard()}
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-ink text-white text-sm font-semibold"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}

          {load.state === 'ready' && load.items.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-card p-6 text-center">
              <p className="text-sm font-medium">Nothing open right now.</p>
              <p className="text-sm text-muted mt-1">Check back soon, or register below so we can reach you.</p>
            </div>
          )}

          {load.state === 'ready' && load.items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {load.items.map((item, i) => (
                <ItemRow key={`${item.title}-${i}`} item={item} />
              ))}
            </ul>
          )}
        </section>

        {quoteEmail && (
          <section aria-labelledby="quote" className="rounded-xl bg-accent-soft border border-accent/20 p-5 flex flex-col gap-3">
            <h2 id="quote" className="text-base font-bold">Send your quotation</h2>
            <p className="text-sm text-muted">Mention the catalogue number in the subject so we can match it quickly.</p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`mailto:${quoteEmail}?subject=${encodeURIComponent('Quotation for MB Lab')}`}
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-accent text-white text-sm font-semibold break-all"
              >
                <Mail className="w-4 h-4 shrink-0" /> {quoteEmail}
              </a>
              <CopyButton text={quoteEmail} label="Copy email" />
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm('register')}
            className="flex items-center gap-3 min-h-14 px-4 rounded-xl bg-card border border-line text-left hover:border-accent/50 transition-colors"
          >
            <UserPlus className="w-5 h-5 text-accent shrink-0" />
            <span>
              <span className="block text-sm font-semibold">Register as a vendor</span>
              <span className="block text-xs text-muted">Get on our supplier list</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setForm('offer')}
            className="flex items-center gap-3 min-h-14 px-4 rounded-xl bg-card border border-line text-left hover:border-accent/50 transition-colors"
          >
            <Tag className="w-5 h-5 text-accent shrink-0" />
            <span>
              <span className="block text-sm font-semibold">Share an offer</span>
              <span className="block text-xs text-muted">Discounts, new products, promotions</span>
            </span>
          </button>
        </section>
      </main>

      {form && <FormSheet kind={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function ItemRow({ item }: { item: Item }) {
  return (
    <li className="rounded-xl bg-card border border-line p-4 flex flex-col gap-2">
      <p className="text-[15px] font-semibold leading-snug break-words">{item.title}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {item.catalogNumber && (
          <>
            <dt className="text-muted">Cat. no.</dt>
            <dd className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-[13px] bg-paper border border-line rounded px-1.5 py-0.5 break-all">
                {item.catalogNumber}
              </span>
              <CopyButton text={item.catalogNumber} label={`Copy catalogue number ${item.catalogNumber}`} compact />
            </dd>
          </>
        )}
        <dt className="text-muted">Quantity</dt>
        <dd className="break-words">{item.quantity}</dd>
        {item.brand && (
          <>
            <dt className="text-muted">Brand</dt>
            <dd className="break-words">{item.brand}</dd>
          </>
        )}
      </dl>
    </li>
  );
}

function CopyButton({ text, label, compact }: { text: string; label: string; compact?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard blocked — the text is on screen to select by hand */
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={label}
      className={
        compact
          ? 'shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-paper'
          : 'inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-line bg-card text-sm'
      }
    >
      {done ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
      {!compact && (done ? 'Copied' : 'Copy')}
      <span className="sr-only" aria-live="polite">{done ? 'Copied' : ''}</span>
    </button>
  );
}

function FormSheet({ kind, onClose }: { kind: FormKind; onClose: () => void }) {
  const [fields, setFields] = useState({ name: '', company: '', phone: '', email: '', message: '', website: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!fields.phone.trim() && !fields.email.trim()) {
      setError('Please give a phone number or an email.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(FEED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ...fields }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send. Please try again.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Could not send. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const title = kind === 'register' ? 'Register as a vendor' : 'Share an offer';
  const input = 'w-full min-h-11 px-3 rounded-lg border border-line bg-card text-[16px] focus:outline-none focus:border-accent';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-paper rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">Thanks — we'll be in touch.</p>
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-ink text-white text-sm font-semibold">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3" noValidate>
            <Field label="Your name" required>
              <input className={input} value={fields.name} onChange={set('name')} required maxLength={120} autoComplete="name" />
            </Field>
            <Field label="Company">
              <input className={input} value={fields.company} onChange={set('company')} maxLength={120} autoComplete="organization" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Phone">
                <input className={input} value={fields.phone} onChange={set('phone')} maxLength={40} type="tel" inputMode="tel" autoComplete="tel" />
              </Field>
              <Field label="Email">
                <input className={input} value={fields.email} onChange={set('email')} maxLength={160} type="email" inputMode="email" autoComplete="email" />
              </Field>
            </div>
            <Field label={kind === 'offer' ? 'The offer' : 'What you supply (optional)'} required={kind === 'offer'}>
              <textarea
                className={`${input} py-2 min-h-24 resize-y`}
                value={fields.message}
                onChange={set('message')}
                maxLength={2000}
                placeholder={kind === 'offer' ? 'e.g. 20% off Sigma reagents until 31 Oct' : 'e.g. Sigma, Merck and Thermo reagents; Delhi NCR'}
              />
            </Field>
            {/* Honeypot — hidden from people, filled by bots. */}
            <input
              type="text"
              name="website"
              value={fields.website}
              onChange={set('website')}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] w-px h-px opacity-0"
            />
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={sending || !fields.name.trim() || (kind === 'offer' && !fields.message.trim())}
              className="min-h-12 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
            <p className="text-xs text-muted">We'll only use these details to contact you about lab purchases.</p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {children}
    </label>
  );
}
