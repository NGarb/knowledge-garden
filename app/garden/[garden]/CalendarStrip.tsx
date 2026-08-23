import { getUpcomingEvents, dayKey, type CalendarEvent } from "@/lib/calendar";
import { log, errMessage } from "@/lib/log";

function dayLabel(d: Date): string {
  const today = new Date();
  const todayKey = dayKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const k = dayKey(d);
  if (k === todayKey) return "Today";
  if (k === dayKey(tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function timeLabel(ev: CalendarEvent): string {
  if (ev.allDay) return "All day";
  return ev.start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

// Read-only calendar strip fed by the Google ICS feed (PRIORITIES_ICS_URL).
// Renders nothing when the feed is unset or empty, so it stays invisible until
// configured and never breaks the garden if the feed hiccups.
export async function CalendarStrip() {
  let events: CalendarEvent[];
  try {
    events = await getUpcomingEvents(7);
  } catch (e) {
    log.warn("calendar", `ICS load failed: ${errMessage(e)}`);
    return null;
  }
  if (events.length === 0) return null;

  // Group by day, preserving the already-sorted order.
  const groups: { key: string; date: Date; events: CalendarEvent[] }[] = [];
  for (const ev of events) {
    const k = dayKey(ev.start);
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.events.push(ev);
    else groups.push({ key: k, date: ev.start, events: [ev] });
  }

  return (
    <section className="mx-4 mt-2 mb-4 rounded-2xl bg-white border border-zinc-100 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-100">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Upcoming
        </h2>
      </div>
      <div className="divide-y divide-zinc-100">
        {groups.map((group) => (
          <div key={group.key} className="flex gap-3 px-4 py-3">
            <div className="w-24 shrink-0 text-xs font-medium text-zinc-500 pt-0.5">
              {dayLabel(group.date)}
            </div>
            <ul className="flex-1 flex flex-col gap-1.5 min-w-0">
              {group.events.map((ev, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="w-14 shrink-0 tabular-nums text-zinc-400">
                    {timeLabel(ev)}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-zinc-800">
                    {ev.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
