// The whole month as one slim strip of dates: today ringed, Sundays tinted, days gone by dimmed.
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Year, month (1-12) and day of month in India time, whatever the TV's own clock says. */
function istYmd(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d).map((x) => [x.type, x.value])
  );
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

export function MonthStrip({ now }: { now: Date }) {
  const { y, m, d: today } = istYmd(now);
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const title = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 1)));

  return (
    <div className="flex items-center gap-[1.1rem] pt-[0.8rem] border-t border-line" aria-label={`Calendar, ${title}`}>
      <p className="shrink-0 text-[1rem] font-bold uppercase tracking-[0.16em] text-muted w-[9.5rem] leading-tight">{title}</p>
      <div className="flex-1 min-w-0 grid gap-x-[0.15rem] text-center tabular-nums" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
        {Array.from({ length }, (_, i) => {
          const day = i + 1;
          const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
          const isToday = day === today;
          const past = day < today;
          const sunday = dow === 0;
          return (
            <div key={day} className="flex flex-col items-center leading-none">
              <span className={`text-[0.7rem] font-bold mb-[0.2rem] ${sunday ? 'text-red-300/70' : 'text-muted/70'}`}>{LETTERS[dow]}</span>
              <span
                className={`w-[1.7rem] h-[1.7rem] flex items-center justify-center rounded-full text-[0.95rem] ${
                  isToday ? 'bg-accent text-white font-extrabold' : past ? 'text-muted/45' : sunday ? 'text-red-300 font-semibold' : 'text-ink font-semibold'
                }`}
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
