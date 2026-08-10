// 時刻・日付・集計の純粋ロジック。DOMとlocalStorageには触れない。

export function diffMinutes(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function formatDuration(minutes) {
  if (minutes == null) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

export function todayString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return todayString(d);
}

export function lastNDates(endDate, n) {
  return Array.from({ length: n }, (_, i) => addDays(endDate, i - n + 1));
}

export function weekDates(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const offsetFromMonday = (d.getDay() + 6) % 7;
  const monday = addDays(dateStr, -offsetFromMonday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function intervalMinutes(day, interval) {
  if (!day || !day.times) return null;
  return diffMinutes(day.times[interval.start], day.times[interval.end]);
}

export function intervalStats(days, interval, today) {
  const recorded = Object.keys(days)
    .filter((date) => date <= today)
    .map((date) => intervalMinutes(days[date], interval))
    .filter((m) => m != null);
  const avgMinutes = recorded.length
    ? Math.round(recorded.reduce((a, b) => a + b, 0) / recorded.length)
    : null;

  const week = weekDates(today)
    .map((date) => intervalMinutes(days[date], interval))
    .filter((m) => m != null);

  const last7 = lastNDates(today, 7)
    .map((date) => ({ date, minutes: intervalMinutes(days[date], interval) }));

  return {
    avgMinutes,
    weekTotalMinutes: week.reduce((a, b) => a + b, 0),
    weekDayCount: week.length,
    last7,
  };
}
