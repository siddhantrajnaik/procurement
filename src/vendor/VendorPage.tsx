import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, FlaskConical, ListChecks, Mail, Package, RefreshCw, Reply, Search, Tag, UserPlus, X } from 'lucide-react';

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

function quoteHref(email: string, item?: Item): string {
  const subject = item
    ? `Quotation: ${item.title}${item.catalogNumber ? ` (Cat. ${item.catalogNumber})` : ''}`
    : 'Quotation for MB Lab';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

export function VendorPage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [form, setForm] = useState<FormKind | null>(null);
  const [query, setQuery] = useState('');

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
  const items = useMemo(() => (load.state === 'ready' ? load.items : []), [load]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => [i.title, i.catalogNumber, i.brand].some((v) => v?.toLowerCase().includes(q)));
  }, [items, query]);

  return (
    <div className="min-h-dvh relative overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full opacity-[0.16] blur-3xl"
        style={{ background: 'radial-gradient(circle, #FF6B4A 0%, transparent 65%)' }}
      />
      <main className="relative max-w-3xl mx-auto px-4 pt-8 pb-16 flex flex-col gap-8">
        <header className="flex flex-col gap-5">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
              <FlaskConical className="w-5 h-5 text-white" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">MB Lab</span>
              <span className="block text-[11px] text-muted">Structural Virology Lab · IIT Delhi</span>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-[34px] sm:text-[44px] leading-[1.05] font-extrabold tracking-tight">
              What we need<span className="text-accent">.</span>
            </h1>
            <p className="text-[15px] text-muted max-w-md">
              Items the lab is buying right now. Pick one, send your best price, and we'll get back to you.
            </p>
          </div>
        </header>

        <ol className="grid grid-cols-3 gap-2 text-center" aria-label="How to quote">
          {[
            { icon: ListChecks, label: 'Pick an item' },
            { icon: Mail, label: 'Email your quote' },
            { icon: Reply, label: 'We reply' },
          ].map(({ icon: Icon, label }, i) => (
            <li key={label} className="rounded-xl border border-line bg-card/60 px-2 py-3 flex flex-col items-center gap-1.5">
              <span className="relative">
                <Icon className="w-5 h-5 text-accent" />
                <span className="absolute -top-2 -right-3 text-[10px] font-bold text-muted tabular-nums">{i + 1}</span>
              </span>
              <span className="text-[12px] font-semibold leading-tight">{label}</span>
            </li>
          ))}
        </ol>

        <section aria-labelledby="needs" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="needs" className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Open requirements</h2>
            {items.length > 6 && (
              <label className="relative">
                <span className="sr-only">Filter items</span>
                <Search className="w-4 h-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter…"
                  className="w-40 min-h-9 pl-8 pr-2 rounded-lg border border-line bg-card text-sm focus:outline-none focus:border-accent"
                />
              </label>
            )}
          </div>

          {load.state === 'loading' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-busy="true" aria-label="Loading">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[190px] rounded-2xl bg-card border border-line animate-pulse" />
              ))}
            </div>
          )}

          {load.state === 'error' && (
            <div role="alert" className="rounded-2xl border border-line bg-card p-5 flex flex-col items-start gap-3">
              <p className="text-sm">The list couldn't be loaded. Check your connection and try again.</p>
              <button
                type="button"
                onClick={() => void fetchBoard()}
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-accent text-white hover:bg-orange-600 text-sm font-semibold"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}

          {load.state === 'ready' && items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
              <Package className="w-8 h-8 text-muted mx-auto mb-3" />
              <p className="text-sm font-semibold">Nothing open right now.</p>
              <p className="text-sm text-muted mt-1">Check back soon, or register below so we can reach you.</p>
            </div>
          )}

          {items.length > 0 && shown.length === 0 && (
            <p className="text-sm text-muted">Nothing matches "{query.trim()}".</p>
          )}

          {shown.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shown.map((item, i) => (
                <Slip key={`${item.title}-${i}`} item={item} quoteEmail={quoteEmail} />
              ))}
            </ul>
          )}
        </section>

        {quoteEmail && (
          <section aria-labelledby="quote" className="rounded-2xl bg-accent-soft border border-accent/25 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h2 id="quote" className="text-base font-bold">Quoting for several items?</h2>
              <p className="text-sm text-muted mt-0.5">Send one email. Put the catalogue numbers in it so we can match them quickly.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={quoteHref(quoteEmail)}
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-accent text-white hover:bg-orange-600 text-sm font-semibold break-all"
              >
                <Mail className="w-4 h-4 shrink-0" /> {quoteEmail}
              </a>
              <CopyButton text={quoteEmail} label="Copy email" />
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Tile icon={UserPlus} title="Register as a vendor" sub="Get on our supplier list" onClick={() => setForm('register')} />
          <Tile icon={Tag} title="Share an offer" sub="Discounts, new products, promotions" onClick={() => setForm('offer')} />
        </section>
      </main>

      {form && <FormSheet kind={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function Tile({ icon: Icon, title, sub, onClick }: { icon: typeof Tag; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 min-h-16 px-4 py-3 rounded-2xl bg-card border border-line text-left hover:border-accent/50 transition-colors"
    >
      <span className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-accent" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
      <span className="text-muted group-hover:text-accent transition-colors" aria-hidden>→</span>
    </button>
  );
}

/** A requisition slip: what we want on top, the catalogue number on the tear-off stub. */
function Slip({ item, quoteEmail }: { item: Item; quoteEmail: string | null }) {
  return (
    <li className="rounded-2xl bg-card border border-line hover:border-accent/40 transition-colors flex flex-col">
      <div className="p-4 pb-3 flex flex-col gap-3 flex-1">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-paper border border-line px-2 py-0.5 text-[11px] font-semibold">
            <Package className="w-3 h-3 text-accent" /> {item.quantity}
          </span>
          {item.brand && (
            <span className="inline-flex items-center rounded-full bg-paper border border-line px-2 py-0.5 text-[11px] text-muted">
              {item.brand}
            </span>
          )}
        </div>
        <p className="text-[17px] font-bold leading-snug break-words">{item.title}</p>
      </div>

      <div className="relative h-0 border-t border-dashed border-line mx-3" aria-hidden>
        <span className="absolute -left-[21px] -top-[8px] w-4 h-4 rounded-full bg-paper border border-line" style={{ clipPath: 'inset(0 0 0 50%)' }} />
        <span className="absolute -right-[21px] -top-[8px] w-4 h-4 rounded-full bg-paper border border-line" style={{ clipPath: 'inset(0 50% 0 0)' }} />
      </div>

      <div className="p-4 pt-3 flex flex-col gap-3">
        {item.catalogNumber ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted shrink-0">Cat. no.</span>
            <span className="font-mono text-[13px] min-w-0 flex-1 break-all line-clamp-2">{item.catalogNumber}</span>
            <CopyButton text={item.catalogNumber} label={`Copy catalogue number ${item.catalogNumber}`} compact />
          </div>
        ) : (
          <p className="text-[12px] text-muted">No catalogue number. Quote your closest match.</p>
        )}
        {quoteEmail && (
          <a
            href={quoteHref(quoteEmail, item)}
            className="inline-flex items-center justify-center gap-2 min-h-10 rounded-lg border border-accent/40 text-accent text-sm font-semibold hover:bg-accent hover:text-white transition-colors"
          >
            <Mail className="w-4 h-4" /> Quote this item
          </a>
        )}
      </div>
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
  const input = 'w-full min-h-11 px-3 rounded-lg border border-line bg-paper text-[16px] focus:outline-none focus:border-accent';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-card border border-line rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">Thanks — we'll be in touch.</p>
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-accent text-white hover:bg-orange-600 text-sm font-semibold">
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
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
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
