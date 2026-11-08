import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, FlaskConical, Mail, MessageCircle, Phone, RefreshCw, Search, ShieldCheck, Smartphone, Tag, X, ZoomIn } from 'lucide-react';
import { useInstallPrompt } from '../lib/useInstallPrompt';

// Only the project URL is referenced here — never the client or its key.
const FEED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-board`;

interface Item {
  title: string;
  catalogNumber: string | null;
  quantity: string;
  brand: string | null;
  photoUrl: string | null;
}

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; items: Item[]; quoteEmail: string | null; whatsappNumber: string | null };
type FormKind = 'register' | 'offer';
type Lang = 'hi' | 'en';

// ---------------------------------------------------------------- words
// Written the way we would say it to a vendor standing in front of us.

const T = {
  en: {
    brand: 'MB Lab',
    lab: 'IIT Delhi',
    hello: 'Namaste',
    welcomeTitle: "This is our lab's shopping list",
    welcomeBody: 'We are the Structural Virology Lab at IIT Delhi. We put up the things we need to buy here. If you sell any of them, send us your rate.',
    safe: ['No login, no sign-up', 'No payment on this page', 'Your rate comes straight to us on WhatsApp or email'],
    showList: 'Show me the list',
    saveHint: "Save this page on your phone. Next time just tap the icon, you won't need to scan.",
    saveBtn: 'Save to phone',
    notNow: 'Not now',
    listTitle: 'What we need right now',
    listHintWa: 'Tap the green button on an item to send us your rate.',
    listHintMail: "Tap 'Send rate' on an item to email us your rate.",
    qty: 'Quantity',
    brandLabel: 'Brand',
    cat: 'Cat. no.',
    noCat: 'No catalogue number. Send the rate for the closest match.',
    tapPhoto: 'Tap to see bigger',
    photoExpired: 'Photo has expired. Open the page again to see it.',
    sendWa: 'Send rate on WhatsApp',
    sendMail: 'Send rate by email',
    empty: 'Nothing to buy right now. Please check again in a few days.',
    loadError: "The list didn't open. Check your internet and try again.",
    retry: 'Try again',
    search: 'Search the list',
    noMatch: 'Nothing found for',
    callUs: 'Want us to call you for future orders?',
    leaveNumber: 'Leave your number',
    offer: 'Have a discount or a new product? Tell us',
    what: 'What is this page?',
    iosTitle: 'Save to your iPhone',
    iosSteps: ['Tap the Share button at the bottom (the box with an arrow).', "Scroll down and tap 'Add to Home Screen'.", "Tap 'Add'. The MB Lab icon is now on your phone."],
    otherTitle: 'Save to your phone',
    otherSteps: ['Tap the ⋮ menu at the top right of your browser.', "Tap 'Add to Home screen' or 'Install app'.", 'The MB Lab icon is now on your phone.'],
    ok: 'OK',
    copied: 'Copied',
    copy: 'Copy',
    copyCat: 'Copy catalogue number',
    close: 'Close',
    registerTitle: 'Leave your number',
    offerTitle: 'Tell us about an offer',
    name: 'Your name',
    company: 'Shop / company',
    phone: 'Phone',
    email: 'Email',
    supply: 'What do you sell? (optional)',
    supplyEg: 'e.g. Sigma, Merck, Thermo chemicals',
    offerMsg: 'The offer',
    offerEg: 'e.g. 20% off on Sigma chemicals till 31st',
    needContact: 'Please give a phone number or an email.',
    send: 'Send',
    sending: 'Sending…',
    thanks: 'Thank you. We will get in touch with you.',
    sendFail: "Couldn't send. Check your internet and try again.",
    privacy: 'We use your number only to contact you about lab orders.',
  },
  hi: {
    brand: 'एमबी लैब',
    lab: 'आईआईटी दिल्ली',
    hello: 'नमस्ते',
    welcomeTitle: 'यह हमारी लैब की खरीद की लिस्ट है',
    welcomeBody: 'हम आईआईटी दिल्ली की स्ट्रक्चरल वायरोलॉजी लैब हैं। जो सामान हमें खरीदना होता है, वो हम यहाँ डालते हैं। अगर आप इनमें से कुछ बेचते हैं, तो हमें अपना रेट भेजिए।',
    safe: ['कोई लॉगिन या साइन-अप नहीं', 'इस पेज पर कोई पेमेंट नहीं', 'आपका रेट सीधे हमें WhatsApp या ईमेल पर आता है'],
    showList: 'लिस्ट दिखाइए',
    saveHint: 'इस पेज को फ़ोन में सेव कर लीजिए। अगली बार बस आइकन दबाइए, स्कैन नहीं करना पड़ेगा।',
    saveBtn: 'फ़ोन में सेव करें',
    notNow: 'अभी नहीं',
    listTitle: 'हमें अभी क्या चाहिए',
    listHintWa: 'जिस सामान का रेट देना है, उसका हरा बटन दबाइए।',
    listHintMail: "जिस सामान का रेट देना है, उस पर 'ईमेल से रेट भेजें' दबाइए।",
    qty: 'मात्रा',
    brandLabel: 'ब्रांड',
    cat: 'कैट. नंबर',
    noCat: 'कैटलॉग नंबर नहीं है। सबसे मिलते-जुलते सामान का रेट भेजिए।',
    tapPhoto: 'बड़ा देखने के लिए दबाइए',
    photoExpired: 'फ़ोटो पुरानी हो गई। पेज दोबारा खोलिए।',
    sendWa: 'WhatsApp पर रेट भेजें',
    sendMail: 'ईमेल से रेट भेजें',
    empty: 'अभी कुछ खरीदना नहीं है। कुछ दिन बाद फिर देखिए।',
    loadError: 'लिस्ट नहीं खुली। इंटरनेट देखकर दोबारा कोशिश कीजिए।',
    retry: 'दोबारा कोशिश करें',
    search: 'लिस्ट में खोजें',
    noMatch: 'कुछ नहीं मिला:',
    callUs: 'आगे के ऑर्डर के लिए हम आपको कॉल करें?',
    leaveNumber: 'अपना नंबर दीजिए',
    offer: 'कोई छूट या नया प्रोडक्ट है? बताइए',
    what: 'यह पेज क्या है?',
    iosTitle: 'iPhone में सेव करें',
    iosSteps: ['नीचे शेयर बटन दबाइए (तीर वाला डिब्बा)।', "नीचे जाकर 'Add to Home Screen' दबाइए।", "'Add' दबाइए। एमबी लैब का आइकन आपके फ़ोन में आ जाएगा।"],
    otherTitle: 'फ़ोन में सेव करें',
    otherSteps: ['ब्राउज़र में ऊपर दाईं ओर ⋮ मेन्यू दबाइए।', "'Add to Home screen' या 'Install app' दबाइए।", 'एमबी लैब का आइकन आपके फ़ोन में आ जाएगा।'],
    ok: 'ठीक है',
    copied: 'कॉपी हो गया',
    copy: 'कॉपी',
    copyCat: 'कैटलॉग नंबर कॉपी करें',
    close: 'बंद करें',
    registerTitle: 'अपना नंबर दीजिए',
    offerTitle: 'ऑफ़र के बारे में बताइए',
    name: 'आपका नाम',
    company: 'दुकान / कंपनी',
    phone: 'फ़ोन',
    email: 'ईमेल',
    supply: 'आप क्या बेचते हैं? (ज़रूरी नहीं)',
    supplyEg: 'जैसे Sigma, Merck, Thermo के केमिकल',
    offerMsg: 'ऑफ़र',
    offerEg: 'जैसे Sigma के केमिकल पर 31 तारीख तक 20% छूट',
    needContact: 'फ़ोन नंबर या ईमेल दीजिए।',
    send: 'भेजें',
    sending: 'भेज रहे हैं…',
    thanks: 'धन्यवाद। हम आपसे संपर्क करेंगे।',
    sendFail: 'नहीं भेज पाए। इंटरनेट देखकर दोबारा कोशिश कीजिए।',
    privacy: 'आपका नंबर सिर्फ़ लैब के ऑर्डर के लिए इस्तेमाल होगा।',
  },
} as const;
type Words = (typeof T)['en'] | (typeof T)['hi'];

const LANG_KEY = 'mb.vendor.lang';
const WELCOMED_KEY = 'mb.vendor.welcomed';
const SAVE_DISMISSED_KEY = 'mb.vendor.save.dismissed';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

const isStandalone = () => {
  try { return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true; } catch { return false; }
};
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// ---------------------------------------------------------------- links

const itemLine = (item: Item) => `${item.title}${item.catalogNumber ? ` (Cat. ${item.catalogNumber})` : ''}`;

function whatsappHref(number: string, item: Item): string {
  const text = `Namaste, MB Lab IIT Delhi.\nMy rate for: ${itemLine(item)}${item.quantity ? `, ${item.quantity}` : ''}\nRate: \nName / shop: `;
  return `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

function mailHref(email: string, item: Item): string {
  const subject = `Rate for ${itemLine(item)}`;
  const body = `Namaste,\n\nMy rate for ${itemLine(item)}${item.quantity ? `, ${item.quantity}` : ''}:\n\nRate: \nName / shop: \nPhone: \n`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ---------------------------------------------------------------- page

export function VendorPage() {
  const [lang, setLangState] = useState<Lang>(() => (read(LANG_KEY) === 'en' ? 'en' : 'hi'));
  const t: Words = T[lang];
  const setLang = (l: Lang) => { setLangState(l); write(LANG_KEY, l); };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const [welcome, setWelcome] = useState(() => !read(WELCOMED_KEY) && !isStandalone());
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [form, setForm] = useState<FormKind | null>(null);
  const [query, setQuery] = useState('');
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);
  const [steps, setSteps] = useState<'ios' | 'other' | null>(null);
  const [saveDismissed, setSaveDismissed] = useState(() => read(SAVE_DISMISSED_KEY) === '1');
  const installer = useInstallPrompt();

  const fetchBoard = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      const res = await fetch(FEED_URL);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setLoad({ state: 'ready', items: data.items ?? [], quoteEmail: data.quoteEmail ?? null, whatsappNumber: data.whatsappNumber ?? null });
    } catch {
      setLoad({ state: 'error' });
    }
  }, []);

  useEffect(() => { void fetchBoard(); }, [fetchBoard]);

  const quoteEmail = load.state === 'ready' ? load.quoteEmail : null;
  const whatsappNumber = load.state === 'ready' ? load.whatsappNumber : null;
  const items = useMemo(() => (load.state === 'ready' ? load.items : []), [load]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => [i.title, i.catalogNumber, i.brand].some((v) => v?.toLowerCase().includes(q)));
  }, [items, query]);

  // Android Chrome gives us a real install button; iPhone and others get the steps.
  const save = () => {
    if (installer.canInstall) void installer.install();
    else setSteps(isIos() ? 'ios' : 'other');
  };
  const offerSave = !isStandalone();
  const showSaveBanner = offerSave && !saveDismissed && !welcome;
  const dismissSave = () => { setSaveDismissed(true); write(SAVE_DISMISSED_KEY, '1'); };

  const enter = () => { setWelcome(false); write(WELCOMED_KEY, '1'); window.scrollTo(0, 0); };

  const langSwitch = (
    <div className="inline-flex rounded-full border border-line bg-card p-0.5 text-[13px] font-semibold" role="group" aria-label="Language">
      {(['hi', 'en'] as Lang[]).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`min-h-9 px-3 rounded-full transition-colors ${lang === l ? 'bg-accent text-white' : 'text-muted'}`}>
          {l === 'hi' ? 'हिंदी' : 'English'}
        </button>
      ))}
    </div>
  );

  if (welcome) {
    return (
      <div className="min-h-dvh flex flex-col">
        <main className="flex-1 max-w-md w-full mx-auto px-5 pt-6 pb-8 flex flex-col gap-7">
          <div className="flex items-center justify-between">
            <Logo t={t} />
            {langSwitch}
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <p className="text-[18px] font-semibold text-accent">{t.hello}</p>
            <h1 className="text-[30px] leading-tight font-extrabold tracking-tight">{t.welcomeTitle}</h1>
            <p className="text-[17px] leading-relaxed text-muted">{t.welcomeBody}</p>
          </div>

          <ul className="flex flex-col gap-3">
            {t.safe.map((line) => (
              <li key={line} className="flex items-start gap-3 text-[16px]">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-col gap-3 pt-4">
            <button type="button" onClick={enter} className="min-h-14 rounded-xl bg-accent text-white text-[18px] font-bold hover:bg-orange-600">
              {t.showList}
            </button>
            {offerSave && (
              <button type="button" onClick={save} className="min-h-12 rounded-xl border border-line bg-card text-[16px] font-semibold inline-flex items-center justify-center gap-2">
                <Smartphone className="w-5 h-5 text-accent" /> {t.saveBtn}
              </button>
            )}
          </div>
        </main>
        {steps && <SaveSteps kind={steps} t={t} onClose={() => setSteps(null)} />}
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <main className="max-w-xl mx-auto px-4 pt-5 pb-16 flex flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <Logo t={t} />
          {langSwitch}
        </header>

        {showSaveBanner && (
          <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Smartphone className="w-6 h-6 text-accent shrink-0 mt-0.5" />
              <p className="text-[16px] leading-snug">{t.saveHint}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={save} className="flex-1 min-h-12 rounded-lg bg-accent text-white text-[16px] font-bold">{t.saveBtn}</button>
              <button type="button" onClick={dismissSave} className="min-h-12 px-4 rounded-lg text-[15px] text-muted">{t.notNow}</button>
            </div>
          </div>
        )}

        <section aria-labelledby="needs" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 id="needs" className="text-[26px] leading-tight font-extrabold tracking-tight">{t.listTitle}</h1>
            {items.length > 0 && <p className="text-[16px] text-muted">{whatsappNumber ? t.listHintWa : t.listHintMail}</p>}
          </div>

          {items.length > 6 && (
            <label className="relative">
              <span className="sr-only">{t.search}</span>
              <Search className="w-5 h-5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search}
                className="w-full min-h-12 pl-10 pr-3 rounded-xl border border-line bg-card text-[16px] focus:outline-none focus:border-accent" />
            </label>
          )}

          {load.state === 'loading' && (
            <div className="flex flex-col gap-3" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="h-[220px] rounded-2xl bg-card border border-line animate-pulse" />)}
            </div>
          )}

          {load.state === 'error' && (
            <div role="alert" className="rounded-2xl border border-line bg-card p-5 flex flex-col items-start gap-3">
              <p className="text-[16px]">{t.loadError}</p>
              <button type="button" onClick={() => void fetchBoard()} className="inline-flex items-center gap-2 min-h-12 px-5 rounded-lg bg-accent text-white text-[16px] font-semibold">
                <RefreshCw className="w-5 h-5" /> {t.retry}
              </button>
            </div>
          )}

          {load.state === 'ready' && items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
              <p className="text-[17px]">{t.empty}</p>
            </div>
          )}

          {items.length > 0 && shown.length === 0 && <p className="text-[16px] text-muted">{t.noMatch} "{query.trim()}"</p>}

          {shown.length > 0 && (
            <ul className="flex flex-col gap-4">
              {shown.map((item, i) => (
                <ItemCard key={`${item.title}-${i}`} item={item} t={t} quoteEmail={quoteEmail} whatsappNumber={whatsappNumber} onPhoto={setViewer} />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 flex flex-col gap-3">
          <p className="text-[17px] font-semibold">{t.callUs}</p>
          <button type="button" onClick={() => setForm('register')} className="min-h-12 rounded-lg bg-paper border border-line text-[16px] font-semibold inline-flex items-center justify-center gap-2">
            <Phone className="w-5 h-5 text-accent" /> {t.leaveNumber}
          </button>
          <button type="button" onClick={() => setForm('offer')} className="min-h-11 text-[15px] text-muted inline-flex items-center justify-center gap-2 hover:text-ink">
            <Tag className="w-4 h-4" /> {t.offer}
          </button>
        </section>

        <div className="flex flex-col items-center gap-3 pb-2">
          {offerSave && !showSaveBanner && (
            <button type="button" onClick={save} className="min-h-11 px-4 text-[15px] text-accent font-semibold inline-flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> {t.saveBtn}
            </button>
          )}
          <button type="button" onClick={() => setWelcome(true)} className="min-h-11 px-4 text-[14px] text-muted underline underline-offset-4">
            {t.what}
          </button>
        </div>
      </main>

      {form && <FormSheet kind={form} t={t} onClose={() => setForm(null)} />}
      {viewer && <PhotoViewer url={viewer.url} title={viewer.title} t={t} onClose={() => setViewer(null)} />}
      {steps && <SaveSteps kind={steps} t={t} onClose={() => setSteps(null)} />}
    </div>
  );
}

function Logo({ t }: { t: Words }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
        <FlaskConical className="w-5 h-5 text-white" />
      </span>
      <span className="leading-tight min-w-0">
        <span className="block text-[15px] font-bold truncate">{t.brand}</span>
        <span className="block text-[12px] text-muted truncate">{t.lab}</span>
      </span>
    </div>
  );
}

function ItemCard({ item, t, quoteEmail, whatsappNumber, onPhoto }: {
  item: Item;
  t: Words;
  quoteEmail: string | null;
  whatsappNumber: string | null;
  onPhoto: (p: { url: string; title: string }) => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <li className="rounded-2xl bg-card border border-line flex flex-col overflow-hidden">
      {item.photoUrl && !broken && (
        <button type="button" onClick={() => onPhoto({ url: item.photoUrl!, title: item.title })} aria-label={`${t.tapPhoto}: ${item.title}`}
          className="relative block w-full aspect-[4/3] bg-paper border-b border-line">
          <img src={item.photoUrl} alt={item.title} loading="lazy" onError={() => setBroken(true)} className="w-full h-full object-contain" />
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[12px] font-semibold text-white">
            <ZoomIn className="w-4 h-4" /> {t.tapPhoto}
          </span>
        </button>
      )}
      {item.photoUrl && broken && <p className="px-4 pt-3 text-[14px] text-muted">{t.photoExpired}</p>}

      <div className="p-4 flex flex-col gap-3">
        <p className="text-[20px] font-bold leading-snug break-words">{item.title}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[16px]">
          <dt className="text-muted">{t.qty}</dt>
          <dd className="font-semibold break-words">{item.quantity}</dd>
          {item.brand && (
            <>
              <dt className="text-muted">{t.brandLabel}</dt>
              <dd className="break-words">{item.brand}</dd>
            </>
          )}
          {item.catalogNumber && (
            <>
              <dt className="text-muted">{t.cat}</dt>
              <dd className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-[15px] break-all line-clamp-2">{item.catalogNumber}</span>
                <CopyButton text={item.catalogNumber} label={t.copyCat} t={t} />
              </dd>
            </>
          )}
        </dl>
        {!item.catalogNumber && <p className="text-[14px] text-muted">{t.noCat}</p>}

        <div className="flex flex-col gap-2 pt-1">
          {whatsappNumber && (
            <a href={whatsappHref(whatsappNumber, item)} target="_blank" rel="noopener"
              className="inline-flex items-center justify-center gap-2 min-h-14 rounded-xl bg-[#25D366] text-black text-[17px] font-bold hover:brightness-110 transition">
              <MessageCircle className="w-6 h-6" /> {t.sendWa}
            </a>
          )}
          {quoteEmail && (
            <a href={mailHref(quoteEmail, item)}
              className={`inline-flex items-center justify-center gap-2 rounded-xl text-[16px] font-semibold transition-colors ${
                whatsappNumber ? 'min-h-12 border border-line text-muted hover:text-ink' : 'min-h-14 bg-accent text-white hover:bg-orange-600 text-[17px] font-bold'
              }`}>
              <Mail className="w-5 h-5" /> {t.sendMail}
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function SaveSteps({ kind, t, onClose }: { kind: 'ios' | 'other'; t: Words; onClose: () => void }) {
  const steps = kind === 'ios' ? t.iosSteps : t.otherSteps;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={kind === 'ios' ? t.iosTitle : t.otherTitle}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-line rounded-t-2xl sm:rounded-2xl p-6 pb-[calc(24px+env(safe-area-inset-bottom))] flex flex-col gap-5">
        <h2 className="text-[22px] font-bold">{kind === 'ios' ? t.iosTitle : t.otherTitle}</h2>
        <ol className="flex flex-col gap-4">
          {steps.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-[17px] leading-snug">
              <span className="w-8 h-8 rounded-full bg-accent text-white font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className="min-h-12 rounded-xl bg-accent text-white text-[17px] font-bold">{t.ok}</button>
      </div>
    </div>
  );
}

function PhotoViewer({ url, title, t, onClose }: { url: string; title: string; t: Words; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-[16px] font-semibold text-white truncate">{title}</p>
        <button type="button" onClick={onClose} aria-label={t.close} className="w-12 h-12 -mr-2 inline-flex items-center justify-center rounded-lg text-white hover:bg-white/10">
          <X className="w-7 h-7" />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-2" style={{ touchAction: 'pinch-zoom' }}>
        <img src={url} alt={title} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}

function CopyButton({ text, label, t }: { text: string; label: string; t: Words }) {
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
    <button type="button" onClick={() => void copy()} aria-label={label}
      className="shrink-0 min-w-9 h-9 px-2 inline-flex items-center justify-center gap-1 rounded-md text-muted hover:text-ink hover:bg-paper text-[13px]">
      {done ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
      <span>{done ? t.copied : t.copy}</span>
    </button>
  );
}

function FormSheet({ kind, t, onClose }: { kind: FormKind; t: Words; onClose: () => void }) {
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
      setError(t.needContact);
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
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError(t.sendFail);
    } finally {
      setSending(false);
    }
  };

  const title = kind === 'register' ? t.registerTitle : t.offerTitle;
  const input = 'w-full min-h-12 px-3 rounded-lg border border-line bg-paper text-[16px] focus:outline-none focus:border-accent';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-card border border-line rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t.close} className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink">
            <X className="w-6 h-6" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="text-[17px]">{t.thanks}</p>
            <button type="button" onClick={onClose} className="min-h-12 rounded-lg bg-accent text-white hover:bg-orange-600 text-[16px] font-semibold">{t.ok}</button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3" noValidate>
            <Field label={t.name} required>
              <input className={input} value={fields.name} onChange={set('name')} required maxLength={120} autoComplete="name" />
            </Field>
            <Field label={t.phone}>
              <input className={input} value={fields.phone} onChange={set('phone')} maxLength={40} type="tel" inputMode="tel" autoComplete="tel" />
            </Field>
            <Field label={t.company}>
              <input className={input} value={fields.company} onChange={set('company')} maxLength={120} autoComplete="organization" />
            </Field>
            <Field label={t.email}>
              <input className={input} value={fields.email} onChange={set('email')} maxLength={160} type="email" inputMode="email" autoComplete="email" />
            </Field>
            <Field label={kind === 'offer' ? t.offerMsg : t.supply} required={kind === 'offer'}>
              <textarea className={`${input} py-2 min-h-24 resize-y`} value={fields.message} onChange={set('message')} maxLength={2000}
                placeholder={kind === 'offer' ? t.offerEg : t.supplyEg} />
            </Field>
            {/* Honeypot — hidden from people, filled by bots. */}
            <input type="text" name="website" value={fields.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true"
              className="absolute -left-[9999px] w-px h-px opacity-0" />
            {error && <p role="alert" className="text-[15px] text-red-400">{error}</p>}
            <button type="submit" disabled={sending || !fields.name.trim() || (kind === 'offer' && !fields.message.trim())}
              className="min-h-14 rounded-lg bg-accent text-white text-[17px] font-bold disabled:opacity-40">
              {sending ? t.sending : t.send}
            </button>
            <p className="text-[13px] text-muted">{t.privacy}</p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[14px] font-semibold text-muted">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {children}
    </label>
  );
}
