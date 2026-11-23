// One short thought a day, the same for everyone, changing at midnight India time.
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

/** Whole days since 1970 in India time, so the pick changes at midnight there. */
export function istDayNumber(d = new Date()): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d).map((x) => [x.type, x.value])
  );
  return Math.floor(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / 86_400_000);
}

/** A famous quote of the day from the feed; if it is not available, one of the lab's own lines above. */
export function Thought({ now, quote }: { now: Date; quote: { text: string; author: string } | null }) {
  const own = THOUGHTS[istDayNumber(now) % THOUGHTS.length];
  // The card art has a coral quotation mark at the top left and a short line at the bottom left; the words go between.
  return (
    <section
      className="relative rounded-3xl border border-line overflow-hidden bg-card bg-cover bg-center min-w-0 min-h-0"
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}wall-quote-bg.webp)` }}
      aria-label="Thought of the day"
    >
      <p className="absolute left-[16%] right-[4%] top-[12%] bottom-[24%] flex items-center text-[1.5rem] font-bold leading-snug text-ink">
        <span className="line-clamp-4">{quote ? quote.text : own}</span>
      </p>
      {quote && (
        <p className="absolute left-[16%] right-[4%] bottom-[7%] text-[1.15rem] text-muted truncate">{'—'} {quote.author}</p>
      )}
      {quote && <p className="absolute right-[3%] top-[5%] text-[0.75rem] text-muted/50">ZenQuotes.io</p>}
    </section>
  );
}
