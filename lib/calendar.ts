import ical from "node-ical";

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
}

// Local YYYY-MM-DD, used both for grouping events by day and for matching
// node-ical's exdate / per-occurrence override maps.
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Read-only view of the calendar behind the "Secret address in iCal format"
// URL (Google Calendar → Settings → Integrate calendar). The URL is a secret,
// so it stays server-side in PRIORITIES_ICS_URL and is never sent to the client.
// Returns [] when unset or on any parse hiccup handled by the caller.
export async function getUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  const url = process.env.PRIORITIES_ICS_URL;
  if (!url) return [];

  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + days);

  const data = await ical.async.fromURL(url);
  const out: CalendarEvent[] = [];

  for (const key of Object.keys(data)) {
    // node-ical mixes VEVENT/VTIMEZONE/etc. into one map; only events matter.
    const ev = data[key] as Record<string, unknown> & {
      type?: string;
      summary?: string;
      start?: Date;
      end?: Date;
      datetype?: string;
      rrule?: { between: (a: Date, b: Date, inc?: boolean) => Date[] };
      exdate?: Record<string, Date>;
      recurrences?: Record<string, { start: Date; end?: Date; summary?: string }>;
    };
    if (!ev || ev.type !== "VEVENT" || !ev.start) continue;

    const allDay = ev.datetype === "date";
    const durationMs = ev.end ? ev.end.getTime() - ev.start.getTime() : 0;

    const push = (start: Date, title: string) => {
      const end = durationMs ? new Date(start.getTime() + durationMs) : null;
      const effectiveEnd = end ?? start;
      // Keep anything overlapping [today, today+days) that hasn't finished.
      if (effectiveEnd < now || start >= windowEnd) return;
      out.push({ title: title || "(untitled)", start, end, allDay });
    };

    if (ev.rrule) {
      // Pad the lookup back by the event's duration so a long event that began
      // before the window but still overlaps it is caught.
      const rangeStart = new Date(windowStart.getTime() - durationMs);
      const exdate = ev.exdate ?? {};
      const overrides = ev.recurrences ?? {};
      let occurrences: Date[] = [];
      try {
        occurrences = ev.rrule.between(rangeStart, windowEnd, true);
      } catch {
        occurrences = [];
      }
      for (const occ of occurrences) {
        const k = dayKey(occ);
        if (exdate[k]) continue; // this instance was deleted
        const override = overrides[k];
        if (override) push(override.start, override.summary ?? ev.summary ?? "");
        else push(occ, ev.summary ?? "");
      }
    } else {
      push(ev.start, ev.summary ?? "");
    }
  }

  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}
