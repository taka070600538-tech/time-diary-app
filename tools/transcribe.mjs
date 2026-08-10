// app-data/time-diary/backup.json を読み、Obsidianデイリーノートに転記する。
// 日本語パスはこのファイル(UTF-8)内に持つ(.ps1に書くと文字化けするため)。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { intervalMinutes, formatDuration, todayString } from '../js/calc.js';

const HEADING = '## 時間管理ダイアリー';
const BACKUP_PATH = 'D:/Obsidian Vault for Claude Code/Git/app-data/time-diary/backup.json';
const DIARY_DIR = 'D:/Obsidian Vault for Claude Code/01_日記';

export function buildDaySection(state, date) {
  const day = state.days[date];
  if (!day) return null;
  const rows = state.items
    .filter((i) => day.times[i.id])
    .map((i) => `| ${i.label} | ${day.times[i.id]} |`);
  const summary = state.intervals
    .map((iv) => ({ iv, minutes: intervalMinutes(day, iv) }))
    .filter(({ minutes }) => minutes != null)
    .map(({ iv, minutes }) => `**${iv.label}**: ${formatDuration(minutes)}`)
    .join(' ／ ');
  const parts = [HEADING];
  if (rows.length) parts.push(['| 項目 | 時刻 |', '| --- | --- |', ...rows].join('\n'));
  if (summary) parts.push(summary);
  if (day.note) parts.push(`### 特記事項\n${day.note}`);
  return parts.join('\n\n');
}

export function needsTranscription(noteContent) {
  return !noteContent.includes(HEADING);
}

export function datesToTranscribe(state, today) {
  return Object.keys(state.days).filter((d) => d < today).sort();
}

export function runTranscription({ state, diaryDir, today }) {
  const results = [];
  for (const date of datesToTranscribe(state, today)) {
    const section = buildDaySection(state, date);
    if (!section) continue;
    const path = join(diaryDir, `${date}.md`);
    if (!existsSync(path)) {
      writeFileSync(path, section + '\n', 'utf8');
      results.push({ date, action: 'created' });
    } else {
      const content = readFileSync(path, 'utf8');
      if (!needsTranscription(content)) { results.push({ date, action: 'skipped' }); continue; }
      const sep = content.endsWith('\n') ? '\n' : '\n\n';
      writeFileSync(path, content + sep + section + '\n', 'utf8');
      results.push({ date, action: 'appended' });
    }
  }
  return results;
}

// CLIとして直接実行されたときだけ動く(テストのimportでは動かない)
// Windowsパスは大文字小文字やスラッシュ表記のズレでURL文字列比較が壊れやすいため、
// process.argv[1]をpathToFileURLでURL化してimport.meta.urlと比較する。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(BACKUP_PATH)) {
    console.log('backup.jsonがまだありません。スキップします');
  } else {
    mkdirSync(DIARY_DIR, { recursive: true });
    const state = JSON.parse(readFileSync(BACKUP_PATH, 'utf8'));
    const results = runTranscription({ state, diaryDir: DIARY_DIR, today: todayString() });
    for (const r of results) console.log(`${r.date}: ${r.action}`);
    if (results.length === 0) console.log('転記対象なし');
  }
}
