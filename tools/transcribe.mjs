// app-data/time-diary/backup.json を読み、Obsidianデイリーノートに転記する。
// マーカー区間を冪等にupsertするため、再実行のたびに最新内容へ自己修復される。
// 日本語パスはこのファイル(UTF-8)内に持つ(.ps1に書くと文字化けするため)。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { intervalMinutes, formatDuration, todayString } from '../js/calc.js';

const START = '<!-- time-diary:start -->';
const END = '<!-- time-diary:end -->';
const DEFAULT_BACKUP = String.raw`D:\Obsidian Vault for Claude Code\Git\app-data\time-diary\backup.json`;
const DEFAULT_DIARY_DIR = String.raw`D:\Obsidian Vault for Claude Code\01_日記`;

export function buildDaySection(state, date) {
  const day = state.days[date];
  if (!day) return null;
  const rows = state.items
    .filter((i) => day.times?.[i.id])
    .map((i) => `| ${i.label} | ${day.times[i.id]} |`);
  const summary = state.intervals
    .map((iv) => ({ iv, minutes: intervalMinutes(day, iv) }))
    .filter(({ minutes }) => minutes != null)
    .map(({ iv, minutes }) => `**${iv.label}**: ${formatDuration(minutes)}`)
    .join(' ／ ');
  const parts = ['## 時間管理ダイアリー'];
  if (rows.length) parts.push(['| 項目 | 時刻 |', '| --- | --- |', ...rows].join('\n'));
  if (summary) parts.push(summary);
  if (day.note) parts.push(`### 特記事項\n${day.note}`);
  return parts.join('\n\n');
}

// contentの改行スタイルを保ちながら、マーカー区間を冪等に置換(無ければ末尾に追記)する。
// 日記本文の他の部分には一切触れない。
export function upsertSection(content, section) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const block = `${START}${eol}${section.replaceAll('\n', eol)}${eol}${END}${eol}`;
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);
  if (startIdx !== -1 && endIdx !== -1) {
    return content.slice(0, startIdx) + block + content.slice(endIdx + END.length).replace(/^\r?\n/, '');
  }
  if (content === '') return block;
  const sep = content.endsWith(eol) ? eol : eol + eol;
  return content + sep + block;
}

export function datesToTranscribe(state, today) {
  return Object.keys(state.days).filter((d) => d < today).sort();
}

// diaryDir配下の各日付ファイルへ、backup.json記載の内容をupsertする。
// action: 'created'(新規ファイル) / 'updated'(内容変更あり) / 'unchanged'(差分なし) / 'error'
export function runTranscription({ state, diaryDir, today }) {
  const results = [];
  for (const date of datesToTranscribe(state, today)) {
    const section = buildDaySection(state, date);
    if (!section) continue;
    const path = join(diaryDir, `${date}.md`);
    try {
      const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
      const next = upsertSection(existing, section);
      if (existing === next) {
        results.push({ date, action: 'unchanged' });
      } else {
        writeFileSync(path, next, 'utf8');
        results.push({ date, action: existing === '' ? 'created' : 'updated' });
      }
    } catch (err) {
      results.push({ date, action: 'error', message: err.message });
    }
  }
  return results;
}

function main() {
  const backupPath = process.argv[2] || DEFAULT_BACKUP;
  const diaryDir = process.argv[3] || DEFAULT_DIARY_DIR;
  if (!existsSync(backupPath)) {
    console.log('backup.jsonがまだありません。スキップします');
    return;
  }
  let state;
  try {
    state = JSON.parse(readFileSync(backupPath, 'utf8'));
  } catch (err) {
    console.log(`backup.jsonを読めません (${err.message})`);
    return;
  }
  mkdirSync(diaryDir, { recursive: true });
  const results = runTranscription({ state, diaryDir, today: todayString() });
  for (const r of results) {
    console.log(r.action === 'error' ? `${r.date}: ERROR (${r.message})` : `${r.date}: ${r.action}`);
  }
  if (results.length === 0) console.log('転記対象なし');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
