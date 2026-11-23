import { useEffect, useState } from 'react';

// The card takes turns showing three things: a quote and a word of the day.
// Each changes at midnight India time. The art behind it has a quotation mark at the top left and a short line at
// the bottom left; the words go between.

const THOUGHTS = [
  'A negative result is still a result. Write it down.',
  'Label the tube now. Future you will not remember.',
  'Good science is mostly careful repetition.',
  'Every great structure began as a blurry blob.',
  'Slow is smooth, and smooth is reproducible.',
  'Ask the question the data is actually answering.',
  'Clean the bench before you leave. Someone else begins where you stop.',
  'One more control is cheaper than one more retraction.',
  'Patience is a technique.',
  'The grid you screen today is the structure you solve next month.',
  'Share the protocol, share the credit, share the reagents.',
  'Curiosity is the only reagent that never runs out.',
  'If it worked the first time, check it again.',
  'Notes you cannot read tomorrow are notes you did not take.',
  'Small steady progress beats a heroic last-minute week.',
  'A good question is worth ten quick answers.',
  'Done carefully, a boring experiment is a beautiful one.',
  'Resolution improves with patience, and so do people.',
  'Troubleshooting is just curiosity under pressure.',
  'Write the methods as if a stranger will repeat them. One will.',
  'Rest is part of the experiment.',
  'Every expert once misloaded a gel.',
  "Today's failed prep teaches you what tomorrow's good one needs.",
  'Read one paper outside your field this week.',
  'Check the buffer pH. Then check it again.',
  'Teamwork turns a long protocol into a short week.',
  'Be generous with the pipette and with the explanation.',
  'Question the figure, then trust the replicate.',
  'Progress is invisible until you plot it.',
  'Tidy data, tidy mind.',
  'Not every day needs a result. Some days build the road to one.',
  'The quietest weeks often hold the preparation for the loudest results.',
  'Instruments rest so experiments can run well.',
  "Today's small step is next month's figure.",
  'Measure twice, pipette once.',
  'Enthusiasm is a reagent. Replenish it often.',
  'Ask for help early. It is the fastest protocol.',
  'A well-kept notebook is a gift to your future self.',
  'Science moves at the speed of careful people.',
  'Respect the freezer inventory, and it will respect you back.',
];

interface Word { w: string; en: string; hi: string }
const WORDS: Word[] = [
  { w: 'serendipity', en: 'finding something good without looking for it', hi: 'सुखद संयोग' },
  { w: 'ephemeral', en: 'lasting for a very short time', hi: 'क्षणभंगुर' },
  { w: 'ubiquitous', en: 'found everywhere at once', hi: 'सर्वव्यापी' },
  { w: 'meticulous', en: 'showing great care about every detail', hi: 'बारीकी से सावधान' },
  { w: 'perseverance', en: 'steady effort despite difficulty', hi: 'लगन' },
  { w: 'lucid', en: 'clear and easy to understand', hi: 'स्पष्ट' },
  { w: 'tenacious', en: 'holding firmly on and not giving up', hi: 'दृढ़' },
  { w: 'rigorous', en: 'careful, exact and thorough', hi: 'सटीक और कड़ा' },
  { w: 'diligent', en: 'working hard and carefully', hi: 'परिश्रमी' },
  { w: 'resilient', en: 'able to recover quickly from trouble', hi: 'लचीला' },
  { w: 'eloquent', en: 'speaking or writing clearly and persuasively', hi: 'वाक्पटु' },
  { w: 'pragmatic', en: 'sensible and focused on what works', hi: 'व्यावहारिक' },
  { w: 'ineffable', en: 'too great to be put into words', hi: 'अवर्णनीय' },
  { w: 'empirical', en: 'based on experiment and observation', hi: 'प्रयोग-आधारित' },
  { w: 'nuance', en: 'a subtle difference in meaning or detail', hi: 'सूक्ष्म भेद' },
  { w: 'catalyst', en: 'something that speeds up a change', hi: 'उत्प्रेरक' },
  { w: 'paradigm', en: 'a model or pattern of how things are understood', hi: 'प्रतिमान' },
  { w: 'equanimity', en: 'calmness of mind under stress', hi: 'समभाव' },
  { w: 'fortitude', en: 'courage in pain or adversity', hi: 'धैर्य' },
  { w: 'ebullient', en: 'cheerful and full of energy', hi: 'उत्साह से भरा' },
  { w: 'luminous', en: 'giving off light, bright', hi: 'दीप्तिमान' },
  { w: 'pensive', en: 'deep in thought', hi: 'चिंतनशील' },
  { w: 'halcyon', en: 'calm, happy and peaceful', hi: 'सुखद और शांत' },
  { w: 'quintessential', en: 'the perfect example of something', hi: 'सर्वोत्कृष्ट उदाहरण' },
  { w: 'ameliorate', en: 'to make something better', hi: 'सुधारना' },
  { w: 'assiduous', en: 'working with constant, careful attention', hi: 'लगनशील' },
  { w: 'candid', en: 'honest and straightforward', hi: 'स्पष्टवादी' },
  { w: 'gregarious', en: 'fond of company, sociable', hi: 'मिलनसार' },
  { w: 'laconic', en: 'using very few words', hi: 'कम शब्दों वाला' },
  { w: 'mellifluous', en: 'sweet and smooth to hear', hi: 'मधुर' },
  { w: 'sagacious', en: 'wise and good at judging', hi: 'बुद्धिमान' },
  { w: 'cogent', en: 'clear, logical and convincing', hi: 'ठोस और प्रभावी' },
  { w: 'conundrum', en: 'a confusing puzzle or problem', hi: 'पहेली' },
  { w: 'acumen', en: 'a sharp ability to judge and decide', hi: 'सूझ-बूझ' },
  { w: 'zeal', en: 'great energy for a cause or goal', hi: 'उत्साह' },
  { w: 'humility', en: 'a modest view of your own importance', hi: 'विनम्रता' },
];

/** Whole days since 1970 in India time, so the picks change at midnight there. */
export function istDayNumber(d = new Date()): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d).map((x) => [x.type, x.value])
  );
  return Math.floor(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / 86_400_000);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Today's word from Wiktionary's own "word of the day" page (free), with a Hindi gloss from MyMemory (free). */
async function fetchWord(now: Date): Promise<Word | null> {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now).map((x) => [x.type, x.value])
  );
  const page = `Wiktionary:Word_of_the_day/${p.year}/${MONTHS[Number(p.month) - 1]}_${Number(p.day)}`;
  const res = await fetch(`https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&origin=*`);
  if (!res.ok) return null;
  const html = ((await res.json()) as { parse?: { text?: { '*': string } } }).parse?.text?.['*'];
  if (!html) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const w = doc.querySelector('.mf-wotd a[title]')?.getAttribute('title')?.trim();
  const li = doc.querySelector('ol li');
  if (!w || !li) return null;
  const c = li.cloneNode(true) as HTMLElement;
  c.querySelectorAll('ul, ol, dl, .h-usage-example').forEach((e) => e.remove());
  let en = (c.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/^\([^)]*\)\s*/, '').split(';')[0].trim();
  if (en.length > 110) en = `${en.slice(0, 107).trimEnd()}…`;
  if (!en) return null;
  let hi = '';
  try {
    const t = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(w)}&langpair=en%7Chi`);
    if (t.ok) {
      const tj = (await t.json()) as { responseData?: { translatedText?: string }; quotaFinished?: boolean };
      const text = tj.responseData?.translatedText?.trim() ?? '';
      if (text && !tj.quotaFinished && text.toLowerCase() !== w.toLowerCase() && /[\u0900-\u097F]/.test(text)) hi = text;
    }
  } catch { /* English only */ }
  return { w, en: en.charAt(0).toLowerCase() + en.slice(1), hi };
}

const SLIDE_MS = 20_000;
type Mode = 'quote' | 'word';
const LABEL: Record<Mode, string> = { quote: 'Quote', word: 'Word of the day' };

/** A famous quote from the feed (or one of the lab's own lines), then a couplet, then a word. */
export function Thought({ now, quote }: { now: Date; quote: { text: string; author: string } | null }) {
  const day = istDayNumber(now);
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), SLIDE_MS);
    return () => clearInterval(id);
  }, []);
  const mode: Mode = (['quote', 'word'] as const)[n % 2];
  const own = THOUGHTS[day % THOUGHTS.length];
  // Today's word from the web; my own list is the fallback.
  const [online, setOnline] = useState<Word | null>(() => {
    try {
      const hit = JSON.parse(localStorage.getItem('mb.wall.wotd') ?? 'null') as { day: number; word: Word } | null;
      return hit && hit.day === day ? hit.word : null;
    } catch { return null; }
  });
  useEffect(() => {
    let live = true;
    try {
      const hit = JSON.parse(localStorage.getItem('mb.wall.wotd') ?? 'null') as { day: number; word: Word } | null;
      if (hit && hit.day === day) { setOnline(hit.word); return; }
    } catch { /* fetch it */ }
    setOnline(null);
    fetchWord(now)
      .then((w) => {
        if (!live || !w) return;
        setOnline(w);
        try { localStorage.setItem('mb.wall.wotd', JSON.stringify({ day, word: w })); } catch { /* private mode */ }
      })
      .catch(() => { /* keep my own list */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);
  const wd = online ?? WORDS[day % WORDS.length];

  return (
    <section
      className="relative rounded-3xl border border-line overflow-hidden bg-card bg-cover bg-center min-w-0 min-h-0"
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}wall-quote-bg.webp)`, perspective: '1100px' }}
      aria-label="Thought of the day"
    >
      {/* a slow drifting glow behind the words, for a little depth */}
      <span className="thought-glow pointer-events-none absolute -right-[10%] -top-[40%] w-[60%] h-[140%] rounded-full" aria-hidden />

      {/* each slide turns in on its own, like a card being flipped up */}
      <div key={mode} className="thought-flip absolute inset-0">
        <p className="absolute right-[3%] top-[5%] text-[0.8rem] font-bold uppercase tracking-[0.14em] text-muted/60">{LABEL[mode]}</p>

        {mode === 'quote' && (
          <>
            <p className="absolute left-[16%] right-[4%] top-[12%] bottom-[24%] flex items-center text-[1.5rem] font-bold leading-snug text-ink">
              <span className="line-clamp-4">{quote ? quote.text : own}</span>
            </p>
            {quote && <p className="absolute left-[16%] right-[4%] bottom-[7%] text-[1.15rem] text-muted truncate">{'—'} {quote.author}</p>}
          </>
        )}

        {mode === 'word' && (
          <>
            <div className="absolute left-[16%] right-[4%] top-[12%] bottom-[24%] flex flex-col justify-center gap-[0.3rem]">
              <p className="text-[2rem] font-extrabold leading-none tracking-tight text-ink">{wd.w}</p>
              <p className="text-[1.2rem] leading-snug text-muted line-clamp-2">{wd.en}</p>
            </div>
            {wd.hi && <p lang="hi" className="absolute left-[16%] right-[4%] bottom-[7%] text-[1.15rem] text-accent truncate">{wd.hi}</p>}
          </>
        )}
      </div>

      {mode === 'quote' && quote && <p className="absolute right-[3%] bottom-[5%] text-[0.75rem] text-muted/50">ZenQuotes.io</p>}
    </section>
  );
}
