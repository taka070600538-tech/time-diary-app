import { intervalMinutes } from './calc.js';

function escapeCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function generateCsv(state) {
  const header = [
    '日付',
    ...state.items.map((i) => i.label),
    ...state.intervals.map((iv) => `${iv.label}(分)`),
    '特記事項',
  ];
  const rows = Object.keys(state.days).sort().map((date) => {
    const day = state.days[date];
    return [
      date,
      ...state.items.map((i) => day.times?.[i.id] ?? ''),
      ...state.intervals.map((iv) => intervalMinutes(day, iv) ?? ''),
      day.note ?? '',
    ];
  });
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(','));
  return '\uFEFF' + lines.join('\r\n');
}
