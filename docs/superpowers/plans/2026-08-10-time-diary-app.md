# 時間管理ダイアリーPWA 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイムライン式の時刻入力・自動計算・分析グラフを備え、項目と計算区間を編集でき、GitHub自動保存＋Obsidianデイリーノート転記まで行うPWAを作る。

**Architecture:** ビルド不要の静的PWA（ES Modules）。データはlocalStorageに即時保存し、既存のapp-sync基盤（`https://taka070600538-tech.github.io/app-sync/v1/sync.js` を動的import）で `app-data/time-diary/backup.json` に1日1回自動バックアップ。PC側は既存の日次pullタスクに転記ステップ（Node製 `tools/transcribe.mjs`）を追加し、`01_日記/YYYY-MM-DD.md` に追記する。

**Tech Stack:** Vanilla JS (ES Modules) / node:test / GitHub Pages / GitHub Contents API（app-sync経由） / PowerShell（タスクスケジューラ）

**Spec:** `docs/superpowers/specs/2026-08-10-time-diary-app-design.md`

## Global Constraints

- リポジトリ: `D:\Obsidian Vault for Claude Code\Git\time-diary-app`（作成済み・ローカルのみ）。リモートは `taka070600538-tech/time-diary-app`（Task 9で作成）
- ビルド工程なし。`index.html` を直接開ける構成（ES Modulesのため動作確認はhttpサーバー経由）
- 外部ライブラリ禁止（グラフはインラインSVG手描き）
- appId は `'time-diary'`、localStorageキーは `'time-diary:state'`
- `sw.js` のキャッシュに app-sync の `sync.js` を**含めない**
- テストは `node:test`（`npm test` = `node --test tests/`）。Node標準機能のみ使用
- UI文言はすべて日本語
- コミットメッセージ末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- `.ps1` を編集したら BOM付きUTF-8 で保存し直す（`$c = Get-Content -Raw -Encoding UTF8 $path; Set-Content -Path $path -Value $c -Encoding UTF8`）
- 日本語を含むパス文字列は `.ps1` に書かず、`.mjs`（UTF-8）側に持たせる

## ファイル構成（最終形）

```
time-diary-app/
├── index.html          # シェル。3タブ＋設定エリア
├── style.css           # 全スタイル（frontend-designの意匠に従う）
├── manifest.json       # PWAマニフェスト
├── sw.js               # Service Worker（自アセットのみキャッシュ）
├── .nojekyll
├── package.json        # {"type":"module", "scripts":{"test":"node --test tests/"}}
├── icons/              # icon.svg, icon-192.png, icon-512.png, icon-maskable.png
├── js/
│   ├── calc.js         # 純粋ロジック: 時刻差・整形・日付・集計
│   ├── store.js        # データモデル・プリセット・localStorage・CRUD
│   ├── csv.js          # CSV生成（純粋関数）
│   ├── timeline.js     # タブ1: タイムライン入力
│   ├── stats.js        # タブ2: 分析・グラフ
│   ├── items.js        # タブ3: 項目の編集
│   └── app.js          # 起動・タブ切替・設定エリア・sync統合
├── tools/
│   └── transcribe.mjs  # PC側: backup.json → デイリーノート転記
└── tests/
    ├── calc.test.js
    ├── store.test.js
    ├── csv.test.js
    ├── transcribe.test.js
    └── assets.test.js  # manifest/icons/sw.js整合性
```

---

### Task 1: プロジェクト骨格と calc.js（純粋ロジック）

**Files:**
- Create: `package.json`
- Create: `js/calc.js`
- Test: `tests/calc.test.js`

**Interfaces:**
- Produces:
  - `diffMinutes(start: string|undefined, end: string|undefined) => number|null` — "HH:MM"同士の差分（分）。どちらか欠けたらnull。end<startは+24h（日付跨ぎ）
  - `formatDuration(minutes: number|null) => string` — `450`→`"7時間30分"`、`60`→`"1時間"`、`45`→`"45分"`、`null`→`"--"`
  - `todayString(now?: Date) => "YYYY-MM-DD"`（ローカル日付）
  - `addDays(dateStr: string, n: number) => string`
  - `lastNDates(endDate: string, n: number) => string[]`（endDateを末尾に昇順でn日分）
  - `weekDates(dateStr: string) => string[]`（その日を含む月曜起点の7日分）
  - `intervalMinutes(day: {times: object}|undefined, interval: {start, end}) => number|null`
  - `intervalStats(days: object, interval, today: string) => { avgMinutes: number|null, weekTotalMinutes: number, weekDayCount: number, last7: {date: string, minutes: number|null}[] }`

- [ ] **Step 1: package.json を作成**

```json
{
  "name": "time-diary-app",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: 失敗するテストを書く（tests/calc.test.js）**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffMinutes, formatDuration, todayString, addDays,
  lastNDates, weekDates, intervalMinutes, intervalStats,
} from '../js/calc.js';

test('diffMinutes: 通常の差分', () => {
  assert.equal(diffMinutes('06:30', '07:15'), 45);
});

test('diffMinutes: 日付跨ぎは+24時間', () => {
  assert.equal(diffMinutes('22:30', '06:30'), 480);
});

test('diffMinutes: 同時刻は0', () => {
  assert.equal(diffMinutes('10:00', '10:00'), 0);
});

test('diffMinutes: 片側未入力はnull', () => {
  assert.equal(diffMinutes(undefined, '07:00'), null);
  assert.equal(diffMinutes('07:00', ''), null);
});

test('formatDuration: 時間と分', () => {
  assert.equal(formatDuration(450), '7時間30分');
  assert.equal(formatDuration(60), '1時間');
  assert.equal(formatDuration(45), '45分');
  assert.equal(formatDuration(0), '0分');
  assert.equal(formatDuration(null), '--');
});

test('todayString: ローカル日付をYYYY-MM-DDで返す', () => {
  assert.equal(todayString(new Date(2026, 7, 10, 23, 59)), '2026-08-10');
});

test('addDays: 月跨ぎ・年跨ぎ', () => {
  assert.equal(addDays('2026-08-10', 1), '2026-08-11');
  assert.equal(addDays('2026-08-01', -1), '2026-07-31');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('lastNDates: 末尾が指定日の昇順n日', () => {
  assert.deepEqual(lastNDates('2026-08-10', 3),
    ['2026-08-08', '2026-08-09', '2026-08-10']);
});

test('weekDates: 月曜起点の7日（2026-08-10は月曜）', () => {
  assert.equal(weekDates('2026-08-10')[0], '2026-08-10');
  assert.equal(weekDates('2026-08-16')[0], '2026-08-10'); // 日曜→同じ週
  assert.equal(weekDates('2026-08-09')[0], '2026-08-03'); // 前週の日曜
});

test('intervalMinutes: dayのtimesから区間を計算', () => {
  const interval = { start: 'a', end: 'b' };
  assert.equal(intervalMinutes({ times: { a: '10:00', b: '12:30' } }, interval), 150);
  assert.equal(intervalMinutes({ times: { a: '10:00' } }, interval), null);
  assert.equal(intervalMinutes(undefined, interval), null);
});

test('intervalStats: 平均・週合計・直近7日', () => {
  const interval = { id: 'x', start: 'a', end: 'b' };
  const days = {
    '2026-08-03': { times: { a: '10:00', b: '11:00' } }, // 前週月曜 60分
    '2026-08-10': { times: { a: '10:00', b: '12:00' } }, // 今週月曜 120分
    '2026-08-11': { times: { a: '10:00' } },             // 未完了 → 集計外
  };
  const s = intervalStats(days, interval, '2026-08-11');
  assert.equal(s.avgMinutes, 90);        // (60+120)/2
  assert.equal(s.weekTotalMinutes, 120); // 今週分のみ
  assert.equal(s.weekDayCount, 1);
  assert.equal(s.last7.length, 7);
  assert.deepEqual(s.last7.at(-2), { date: '2026-08-10', minutes: 120 });
  assert.deepEqual(s.last7.at(-1), { date: '2026-08-11', minutes: null });
});

test('intervalStats: 記録ゼロなら平均はnull', () => {
  const s = intervalStats({}, { id: 'x', start: 'a', end: 'b' }, '2026-08-11');
  assert.equal(s.avgMinutes, null);
  assert.equal(s.weekTotalMinutes, 0);
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `Set-Location "D:\Obsidian Vault for Claude Code\Git\time-diary-app"; npm test`
Expected: FAIL（`Cannot find module ... js/calc.js`）

- [ ] **Step 4: js/calc.js を実装**

```js
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
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全テスト）

- [ ] **Step 6: コミット**

```powershell
git add package.json js/calc.js tests/calc.test.js
git commit -m "feat: 時刻差分・日付・区間集計の純粋ロジックを追加"
```

---

### Task 2: store.js（データモデル・プリセット・localStorage・CRUD）

**Files:**
- Create: `js/store.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Consumes: なし（calc.jsとは独立）
- Produces:
  - `DEFAULT_ITEMS: {id, label}[]`（16項目）, `DEFAULT_INTERVALS: {id, label, start, end}[]`（4区間）
  - `defaultState() => state`
  - `loadState(storage?) => state` / `saveState(state, storage?)` — キー `'time-diary:state'`。storage省略時は `globalThis.localStorage`
  - `getDay(state, date) => {times, note}`（未記録日は空オブジェクトを返すだけで作らない）
  - `setTime(state, date, itemId, value, storage?)` — 空文字なら削除。日が空になったら `days[date]` ごと削除。呼ぶたびに `saveState`
  - `setNote(state, date, note, storage?)` — 同上
  - `addItem(state, label, storage?) => item`（`crypto.randomUUID()`でID発行）
  - `renameItem(state, id, label, storage?)`
  - `moveItem(state, id, delta, storage?)`（delta=-1|+1。端では何もしない）
  - `removeItem(state, id, storage?)`（この項目を使う区間も削除。`days`の時刻値は残す）
  - `addInterval(state, label, start, end, storage?) => interval|null`（start===endならnullを返し追加しない）
  - `updateInterval(state, id, {label, start, end}, storage?) => boolean`（start===endならfalseで変更しない）
  - `removeInterval(state, id, storage?)`
  - `resetState(storage?) => state`（プリセットに戻して保存）

- [ ] **Step 1: 失敗するテストを書く（tests/store.test.js）**

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ITEMS, DEFAULT_INTERVALS, defaultState, loadState, saveState,
  getDay, setTime, setNote, addItem, renameItem, moveItem, removeItem,
  addInterval, updateInterval, removeInterval, resetState,
} from '../js/store.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

let storage;
beforeEach(() => { storage = memoryStorage(); });

test('プリセット: 16項目・4区間', () => {
  assert.equal(DEFAULT_ITEMS.length, 16);
  assert.equal(DEFAULT_ITEMS[0].label, '前日の就寝');
  assert.equal(DEFAULT_ITEMS.at(-1).label, '就寝');
  assert.equal(DEFAULT_INTERVALS.length, 4);
  const sleep = DEFAULT_INTERVALS[0];
  assert.equal(sleep.label, '睡眠時間');
  assert.equal(sleep.start, 'prev-sleep');
  assert.equal(sleep.end, 'wake');
});

test('loadState: 初回はプリセット、保存後は復元', () => {
  const s1 = loadState(storage);
  assert.equal(s1.version, 1);
  assert.equal(s1.items.length, 16);
  setTime(s1, '2026-08-10', 'wake', '06:30', storage);
  const s2 = loadState(storage);
  assert.equal(s2.days['2026-08-10'].times.wake, '06:30');
});

test('loadState: 壊れたJSONはプリセットに戻す', () => {
  storage.setItem('time-diary:state', '{broken');
  assert.equal(loadState(storage).items.length, 16);
});

test('setTime: 空文字で削除、日が空になればdaysから消える', () => {
  const s = loadState(storage);
  setTime(s, '2026-08-10', 'wake', '06:30', storage);
  setTime(s, '2026-08-10', 'wake', '', storage);
  assert.equal(s.days['2026-08-10'], undefined);
});

test('setNote: メモだけの日も保持される', () => {
  const s = loadState(storage);
  setNote(s, '2026-08-10', '良い一日', storage);
  assert.equal(getDay(s, '2026-08-10').note, '良い一日');
});

test('getDay: 未記録日は空を返すがdaysには作らない', () => {
  const s = loadState(storage);
  assert.deepEqual(getDay(s, '2026-01-01'), { times: {}, note: '' });
  assert.equal(s.days['2026-01-01'], undefined);
});

test('addItem/renameItem: 追加と名前変更', () => {
  const s = loadState(storage);
  const item = addItem(s, '昼寝開始', storage);
  assert.equal(s.items.at(-1).id, item.id);
  renameItem(s, item.id, '昼寝スタート', storage);
  assert.equal(s.items.at(-1).label, '昼寝スタート');
});

test('moveItem: 並べ替えと端の無視', () => {
  const s = loadState(storage);
  moveItem(s, 'wake', -1, storage);
  assert.equal(s.items[0].id, 'wake');
  moveItem(s, 'wake', -1, storage); // 先頭からさらに上→無視
  assert.equal(s.items[0].id, 'wake');
});

test('removeItem: 項目を使う区間も消えるが、daysの値は残る', () => {
  const s = loadState(storage);
  setTime(s, '2026-08-10', 'wake', '06:30', storage);
  removeItem(s, 'wake', storage);
  assert.equal(s.items.find((i) => i.id === 'wake'), undefined);
  assert.equal(s.intervals.find((iv) => iv.end === 'wake'), undefined);
  assert.equal(s.days['2026-08-10'].times.wake, '06:30');
});

test('addInterval: start===endは拒否', () => {
  const s = loadState(storage);
  assert.equal(addInterval(s, 'ダメな区間', 'wake', 'wake', storage), null);
  const iv = addInterval(s, '外出時間', 'leave-home', 'return-home', storage);
  assert.equal(s.intervals.at(-1).id, iv.id);
});

test('updateInterval: 変更とstart===end拒否', () => {
  const s = loadState(storage);
  assert.equal(updateInterval(s, 'sleep-duration', { start: 'wake', end: 'wake' }, storage), false);
  assert.equal(updateInterval(s, 'sleep-duration', { label: '睡眠' }, storage), true);
  assert.equal(s.intervals[0].label, '睡眠');
});

test('removeInterval / resetState', () => {
  const s = loadState(storage);
  removeInterval(s, 'sleep-duration', storage);
  assert.equal(s.intervals.length, 3);
  const fresh = resetState(storage);
  assert.equal(fresh.intervals.length, 4);
  assert.equal(loadState(storage).intervals.length, 4);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`Cannot find module ... js/store.js`）

- [ ] **Step 3: js/store.js を実装**

```js
// データモデルとlocalStorage永続化。DOMには触れない。
// storage引数はテスト用で、ブラウザでは省略してlocalStorageを使う。

const KEY = 'time-diary:state';

export const DEFAULT_ITEMS = [
  { id: 'prev-sleep', label: '前日の就寝' },
  { id: 'wake', label: '起床' },
  { id: 'run-start', label: '朝の運動開始' },
  { id: 'run-end', label: '朝の運動終了' },
  { id: 'bf-prep-start', label: '朝食準備開始' },
  { id: 'bf-prep-end', label: '朝食準備終了' },
  { id: 'bf-end', label: '朝食終了' },
  { id: 'leave-home', label: '外出' },
  { id: 'study-start', label: '勉強開始' },
  { id: 'lunch-end', label: '昼食終了' },
  { id: 'study-end', label: '勉強終了' },
  { id: 'return-home', label: '帰宅' },
  { id: 'bath-end', label: '入浴終了' },
  { id: 'dinner-end', label: '夕食終了' },
  { id: 'sleep-prep', label: '就寝準備' },
  { id: 'sleep', label: '就寝' },
];

export const DEFAULT_INTERVALS = [
  { id: 'sleep-duration', label: '睡眠時間', start: 'prev-sleep', end: 'wake' },
  { id: 'run-duration', label: '朝の運動時間', start: 'run-start', end: 'run-end' },
  { id: 'bf-prep-duration', label: '朝食準備', start: 'bf-prep-start', end: 'bf-prep-end' },
  { id: 'study-duration', label: '勉強時間', start: 'study-start', end: 'study-end' },
];

export function defaultState() {
  return {
    version: 1,
    items: structuredClone(DEFAULT_ITEMS),
    intervals: structuredClone(DEFAULT_INTERVALS),
    days: {},
  };
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return defaultState();
    const state = JSON.parse(raw);
    if (!Array.isArray(state.items) || !Array.isArray(state.intervals)) return defaultState();
    state.days ??= {};
    return state;
  } catch {
    return defaultState();
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  storage.setItem(KEY, JSON.stringify(state));
}

export function getDay(state, date) {
  const day = state.days[date];
  return { times: { ...(day?.times ?? {}) }, note: day?.note ?? '' };
}

function pruneDay(state, date) {
  const day = state.days[date];
  if (day && Object.keys(day.times).length === 0 && !day.note) delete state.days[date];
}

export function setTime(state, date, itemId, value, storage) {
  state.days[date] ??= { times: {}, note: '' };
  if (value) state.days[date].times[itemId] = value;
  else delete state.days[date].times[itemId];
  pruneDay(state, date);
  saveState(state, storage);
}

export function setNote(state, date, note, storage) {
  state.days[date] ??= { times: {}, note: '' };
  state.days[date].note = note;
  pruneDay(state, date);
  saveState(state, storage);
}

export function addItem(state, label, storage) {
  const item = { id: crypto.randomUUID(), label };
  state.items.push(item);
  saveState(state, storage);
  return item;
}

export function renameItem(state, id, label, storage) {
  const item = state.items.find((i) => i.id === id);
  if (item) { item.label = label; saveState(state, storage); }
}

export function moveItem(state, id, delta, storage) {
  const index = state.items.findIndex((i) => i.id === id);
  const to = index + delta;
  if (index < 0 || to < 0 || to >= state.items.length) return;
  const [item] = state.items.splice(index, 1);
  state.items.splice(to, 0, item);
  saveState(state, storage);
}

export function removeItem(state, id, storage) {
  state.items = state.items.filter((i) => i.id !== id);
  state.intervals = state.intervals.filter((iv) => iv.start !== id && iv.end !== id);
  saveState(state, storage);
}

export function addInterval(state, label, start, end, storage) {
  if (start === end) return null;
  const interval = { id: crypto.randomUUID(), label, start, end };
  state.intervals.push(interval);
  saveState(state, storage);
  return interval;
}

export function updateInterval(state, id, patch, storage) {
  const interval = state.intervals.find((iv) => iv.id === id);
  if (!interval) return false;
  const next = { ...interval, ...patch };
  if (next.start === next.end) return false;
  Object.assign(interval, next);
  saveState(state, storage);
  return true;
}

export function removeInterval(state, id, storage) {
  state.intervals = state.intervals.filter((iv) => iv.id !== id);
  saveState(state, storage);
}

export function resetState(storage) {
  const state = defaultState();
  saveState(state, storage);
  return state;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（calc・store両方）

- [ ] **Step 5: コミット**

```powershell
git add js/store.js tests/store.test.js
git commit -m "feat: データモデル・プリセット・項目/区間CRUDを追加"
```

---

### Task 3: csv.js（CSV生成）

**Files:**
- Create: `js/csv.js`
- Test: `tests/csv.test.js`

**Interfaces:**
- Consumes: `intervalMinutes` (calc.js)
- Produces: `generateCsv(state) => string` — 先頭にBOM(`\uFEFF`)。ヘッダーは `日付, <各項目label>..., <各区間label>(分)..., 特記事項`。行は日付昇順。区間は分の数値（計算不能は空欄）。カンマ・改行・引用符を含むセルはRFC4180形式でエスケープ

- [ ] **Step 1: 失敗するテストを書く（tests/csv.test.js）**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCsv } from '../js/csv.js';

const state = {
  version: 1,
  items: [
    { id: 'a', label: '起床' },
    { id: 'b', label: '就寝' },
  ],
  intervals: [{ id: 'iv', label: '活動時間', start: 'a', end: 'b' }],
  days: {
    '2026-08-10': { times: { a: '06:30', b: '22:00' }, note: 'メモ,カンマ入り' },
    '2026-08-09': { times: { a: '07:00' }, note: '' },
  },
};

test('generateCsv: BOM・ヘッダー・日付昇順・エスケープ', () => {
  const csv = generateCsv(state);
  assert.ok(csv.startsWith('\uFEFF'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], '日付,起床,就寝,活動時間(分),特記事項');
  assert.equal(lines[1], '2026-08-09,07:00,,,');       // 未入力と計算不能は空欄
  assert.equal(lines[2], '2026-08-10,06:30,22:00,930,"メモ,カンマ入り"');
});

test('generateCsv: 改行と引用符のエスケープ', () => {
  const s = { ...state, days: { '2026-08-10': { times: {}, note: '1行目\n"引用"' } } };
  const csv = generateCsv(s);
  assert.ok(csv.includes('"1行目\n""引用"""'));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`Cannot find module ... js/csv.js`）

- [ ] **Step 3: js/csv.js を実装**

```js
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
      ...state.items.map((i) => day.times[i.id] ?? ''),
      ...state.intervals.map((iv) => intervalMinutes(day, iv) ?? ''),
      day.note ?? '',
    ];
  });
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(','));
  return '\uFEFF' + lines.join('\r\n');
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: コミット**

```powershell
git add js/csv.js tests/csv.test.js
git commit -m "feat: CSV生成を追加"
```

---

### Task 4: HTMLシェル・タイムライン入力タブ・スタイル

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `js/app.js`
- Create: `js/timeline.js`

**Interfaces:**
- Consumes: `loadState, getDay, setTime, setNote` (store.js), `diffMinutes, formatDuration, todayString, addDays` (calc.js)
- Produces:
  - `renderTimeline(container: HTMLElement, ctx: { state, date: string, onDateChange(date) })` (timeline.js) — 入力タブ全体を描画
  - app.js のグローバル状態: `const state = loadState()` を1つ作り各タブに渡す。タブ切替関数 `showTab(name: 'timeline'|'stats'|'items')`
  - DOM構造: `<main id="tab-timeline">` `<main id="tab-stats">` `<main id="tab-items">`、ヘッダーにタブボタン `.tab-button[data-tab]`、設定エリア `<section id="settings">`（Task 8で使用）

- [ ] **Step 1: frontend-designスキルを読み込み、意匠を決める**

`frontend-design:frontend-design` スキルを invoke し、このアプリ（毎日使う時間記録・落ち着いた和風/ミニマル系が候補）に合う配色・タイポグラフィ・signature要素を決めてから style.css に反映する。ダークトーン強制はしない。**モバイル(375px幅)最優先**でデザインする。

- [ ] **Step 2: index.html を作成**

構造（意匠クラス名はfrontend-designの決定に従い読み替え可）:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#1a1a2e">
  <title>時間管理ダイアリー</title>
  <link rel="stylesheet" href="style.css">
  <link rel="manifest" href="manifest.json">
  <link rel="icon" href="icons/icon.svg" type="image/svg+xml">
</head>
<body>
  <header class="app-header">
    <h1>時間管理ダイアリー</h1>
    <nav class="tabs">
      <button class="tab-button is-active" data-tab="timeline" type="button">タイムライン入力</button>
      <button class="tab-button" data-tab="stats" type="button">分析・グラフ</button>
      <button class="tab-button" data-tab="items" type="button">項目の編集</button>
    </nav>
  </header>
  <main id="tab-timeline"></main>
  <main id="tab-stats" hidden></main>
  <main id="tab-items" hidden></main>
  <section id="settings"></section>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

manifest.json と icons はTask 7で作るため、この時点で404になるのは許容（コンソールエラーは無視してよい）。

- [ ] **Step 3: js/timeline.js を実装**

要件:
- 日付ナビ: 「前日」「翌日」ボタン、`<input type="date">`、「今日」ボタン。曜日つき表示（例: `2026年8月10日 (月)`）
- `state.items` 順に1行ずつ: ラベル、`<input type="time">`（`getDay`の値）、「現在」ボタン（`todayString`と同形式のHH:MMをセットし`setTime`）
- 各区間について、`interval.end` の項目行の**直後**に自動計算行を挿入: `ラベル ／ HH:MM → HH:MM ／ formatDuration(diffMinutes(...))`。時刻未入力部分は `--:--`。入力のたびに再計算
- 特記事項 `<textarea>`（`input`イベントで`setNote`）
- すべての変更は即時保存（store.jsの関数が保存まで行う）

実装の骨子:

```js
import { getDay, setTime, setNote } from './store.js';
import { diffMinutes, formatDuration, todayString, addDays } from './calc.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function formatDateHeading(date) {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${WEEKDAYS[d.getDay()]})`;
}

function currentTimeHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function renderTimeline(container, ctx) {
  const { state, date, onDateChange } = ctx;
  const day = getDay(state, date);
  const intervalsByEnd = new Map();
  for (const iv of state.intervals) {
    if (!intervalsByEnd.has(iv.end)) intervalsByEnd.set(iv.end, []);
    intervalsByEnd.get(iv.end).push(iv);
  }
  // ...日付ナビ・行・区間行・textareaをcontainerに構築(createElement or innerHTML+listener)
  // 「前日」= onDateChange(addDays(date, -1)) / 「翌日」= +1 / 「今日」= onDateChange(todayString())
  // time inputのchange → setTime(state, date, item.id, input.value) → 区間行だけ再計算更新
  // 「現在」ボタン → input.value = currentTimeHHMM() をセットしてchange相当処理
}
```

- [ ] **Step 4: js/app.js を実装**

```js
import { loadState } from './store.js';
import { todayString } from './calc.js';
import { renderTimeline } from './timeline.js';

const state = loadState();
let currentDate = todayString();
let activeTab = 'timeline';

const containers = {
  timeline: document.getElementById('tab-timeline'),
  stats: document.getElementById('tab-stats'),
  items: document.getElementById('tab-items'),
};

export function rerender() {
  if (activeTab === 'timeline') {
    renderTimeline(containers.timeline, {
      state,
      date: currentDate,
      onDateChange(next) { currentDate = next; rerender(); },
    });
  }
  // stats / items タブは Task 5 / 6 でここに追加する
}

function showTab(name) {
  activeTab = name;
  for (const [key, el] of Object.entries(containers)) el.hidden = key !== name;
  document.querySelectorAll('.tab-button').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.tab === name));
  rerender();
}

document.querySelectorAll('.tab-button').forEach((b) =>
  b.addEventListener('click', () => showTab(b.dataset.tab)));

rerender();
```

- [ ] **Step 5: style.css を作成**

frontend-designで決めた意匠に従い、少なくとも以下を整える:
モバイル1カラム、タブバー、時刻入力行（ラベル・input・現在ボタンの3列グリッド）、
自動計算行（グレー地・イタリックなしで区別）、日付ナビ、textarea、後続タスクで使う
`.stat-card` `.chart` `.item-row` `.settings-*` の基本クラス。

- [ ] **Step 6: ブラウザで動作確認**

```powershell
Set-Location "D:\Obsidian Vault for Claude Code\Git\time-diary-app"; npx serve -l 8321 .
```

（`npx serve`が無ければ `python -m http.server 8321`。それも無ければ `.claude/launch.json` を作りpreview_startを使う）

Browserパネルで `http://localhost:8321` を開き、以下を確認:
1. 16項目が順に表示される
2. 時刻を入れると区間行（睡眠時間など）が即計算される（22:30→06:30で「8時間」）
3. 「現在」ボタンで現在時刻が入る
4. 前日/翌日/今日ナビが機能し、日付ごとに別データになる
5. リロードしても値が残る（localStorage）
6. 特記事項が保存される
7. モバイル幅(375px)でレイアウトが崩れない（`resize_window` presetで確認）

- [ ] **Step 7: コミット**

```powershell
git add index.html style.css js/app.js js/timeline.js
git commit -m "feat: タイムライン入力タブとアプリシェルを実装"
```

---

### Task 5: 分析・グラフタブ（stats.js）

**Files:**
- Create: `js/stats.js`
- Modify: `js/app.js`（rerenderにstatsタブ分岐を追加）
- Modify: `style.css`（カード・グラフ用スタイル）

**Interfaces:**
- Consumes: `intervalStats, formatDuration, todayString` (calc.js)
- Produces: `renderStats(container: HTMLElement, ctx: { state })` (stats.js)

- [ ] **Step 1: datavizスキルを読む**

`dataviz` スキルを invoke し、色・軸・棒グラフ仕様を確認してから実装する。

- [ ] **Step 2: js/stats.js を実装**

要件（区間ごとに1セクション、`state.intervals` の定義に自動追従）:
- 統計カード: `formatDuration(avgMinutes)`（記録のある全日程の平均）、今週合計 `formatDuration(weekTotalMinutes)` と「記録した日数: N日」
- 直近7日の棒グラフ: インラインSVG。`intervalStats(...).last7` を使い、X軸に `M/D` ラベル、棒の上に `formatDuration` の短縮表示（60分以上は `7.5h` 形式、未満は `45m` 形式）。データなし日は棒を描かない。全日nullなら「まだ記録がありません」と表示
- 区間が0個なら「区間が定義されていません。項目の編集タブで追加してください」と表示

実装の骨子:

```js
import { intervalStats, formatDuration, todayString } from './calc.js';

function barLabel(minutes) {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1).replace(/\.0$/, '')}h`;
  return `${minutes}m`;
}

function renderChart(last7) {
  const max = Math.max(...last7.map((d) => d.minutes ?? 0), 1);
  // viewBox="0 0 350 200" 固定。棒幅=350/7*0.6。高さ=minutes/max*150
  // <svg>文字列を組み立てて返す(値はすべて数値なのでエスケープ不要、日付ラベルはM/D形式)
}

export function renderStats(container, { state }) {
  const today = todayString();
  // state.intervals.map(iv => intervalStats(state.days, iv, today)) からDOM構築
}
```

- [ ] **Step 3: js/app.js の rerender に追加**

```js
import { renderStats } from './stats.js';
// rerender()内:
if (activeTab === 'stats') renderStats(containers.stats, { state });
```

- [ ] **Step 4: ブラウザで動作確認**

数日分のダミーデータ（前日・前々日を日付ナビで開いて入力）を作り、確認:
1. 4区間ぶんのカードとグラフが出る
2. 平均・今週合計・日数が手計算と一致する
3. 棒グラフのラベル・高さが正しい。未入力日は棒なし
4. モバイル幅で横スクロールが出ない

- [ ] **Step 5: コミット**

```powershell
git add js/stats.js js/app.js style.css
git commit -m "feat: 分析・グラフタブを実装"
```

---

### Task 6: 項目の編集タブ（items.js）

**Files:**
- Create: `js/items.js`
- Modify: `js/app.js`（rerenderにitemsタブ分岐を追加）
- Modify: `style.css`（編集行用スタイル）

**Interfaces:**
- Consumes: `addItem, renameItem, moveItem, removeItem, addInterval, updateInterval, removeInterval` (store.js)
- Produces: `renderItems(container: HTMLElement, ctx: { state, onChanged() })` — onChangedは編集後の再描画用コールバック（app.jsの`rerender`を渡す）

- [ ] **Step 1: js/items.js を実装**

要件:
- **時刻項目リスト**: 各行 = ラベルの`<input type="text">`（changeで`renameItem`）+「↑」「↓」ボタン（`moveItem`）+「削除」ボタン。削除は `confirm('「<ラベル>」を削除します。この項目を使う自動計算区間も削除されます。よろしいですか?')` で確認してから`removeItem`
- 「＋項目を追加」ボタン: `prompt('項目名を入力してください')` → 空でなければ`addItem`
- **自動計算区間リスト**: 各行 = ラベル`<input type="text">` + 開始`<select>` + 「→」+ 終了`<select>`（選択肢は`state.items`）+「削除」ボタン（confirm付き`removeInterval`）。select変更で`updateInterval`。falseが返ったら `alert('開始と終了に同じ項目は選べません')` して元の値に戻す
- 「＋区間を追加」ボタン: `prompt`で名前 → 先頭2項目を初期値に`addInterval`（項目が2未満なら`alert('項目が2つ以上必要です')`）
- 編集操作のたびに `onChanged()` を呼ぶ

- [ ] **Step 2: js/app.js の rerender に追加**

```js
import { renderItems } from './items.js';
// rerender()内:
if (activeTab === 'items') renderItems(containers.items, { state, onChanged: rerender });
```

- [ ] **Step 3: ブラウザで動作確認**

1. 項目名を変更 → タイムラインタブに反映され、過去の時刻データが残っている
2. 並べ替え → タイムラインの行順が変わる
3. 項目を追加 → タイムライン末尾に行が増える
4. 「朝の運動開始」を削除 → 確認後、「朝の運動時間」区間も消える。分析タブも3区間になる
5. 区間を追加（例: 外出時間 = 外出→帰宅）→ タイムラインに自動計算行、分析タブにグラフが増える
6. 開始と終了に同じ項目を選ぶとalertが出て戻る

- [ ] **Step 4: コミット**

```powershell
git add js/items.js js/app.js style.css
git commit -m "feat: 項目・区間の編集タブを実装"
```

---

### Task 7: PWA化（manifest / Service Worker / アイコン / 整合性テスト）

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Create: `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable.png`
- Create: `.nojekyll`
- Modify: `index.html`（SW登録スクリプト追記）
- Test: `tests/assets.test.js`

**Interfaces:**
- Consumes: なし
- Produces: インストール可能なPWA。`CACHE_NAME = 'time-diary-v1'`（アセット変更のたびに末尾の数字を上げる運用）

- [ ] **Step 1: icons/icon.svg を作成**

時計＋日記帳をモチーフにしたシンプルな1枚SVG（`viewBox="0 0 512 512"`、`width="512" height="512"`属性を必ず付ける）。配色はfrontend-designで決めたアプリ配色に合わせる。

- [ ] **Step 2: PNGアイコン3種を生成**

「スマホアプリ作成とGitHub自動保存」スキルの手順どおり、Browserパネルでアプリを開き `javascript_tool` でcanvasラスタライズする:
1. `fetch('icons/icon.svg')` でSVG文字列取得 → `width="512" height="512"` を確認/注入 → `Image`+`canvas`で192px・512px・maskable(512px)を描画
2. maskable版は背景色で全面を塗り、図柄を中央80%に縮小して描く
3. `canvas.toDataURL('image/png').split(',')[1]` のbase64を1回の呼び出しでまとめて返す（戻り値が大きいとファイル退避される。その場合は `JSON.parse` を2回かけて取り出す）
4. Node（`node -e`）で `Buffer.from(b64,'base64')` → `icons/icon-192.png` 等に書き出し、PNGヘッダー（オフセット16-19=width、20-23=height）で実寸検証

- [ ] **Step 3: manifest.json を作成**

```json
{
  "name": "時間管理ダイアリー",
  "short_name": "時間ダイアリー",
  "description": "1日のタイムラインを記録し、睡眠・運動・勉強時間を自動計算するダイアリー",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a2e",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`background_color`と`theme_color`はstyle.cssの実際の配色に合わせて置き換える。

- [ ] **Step 4: sw.js を作成**

```js
const CACHE_NAME = 'time-diary-v1';
const ASSETS = [
  './', './index.html', './style.css', './manifest.json',
  './js/app.js', './js/calc.js', './js/store.js', './js/csv.js',
  './js/timeline.js', './js/stats.js', './js/items.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 自アセットのみキャッシュ優先。共有基盤のsync.js等は素通し(キャッシュしない)
// 注意: このファイルに「app-」+「sync」を連結した文字列を書かないこと(assets.test.jsが検査する)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const scopePath = new URL('./', self.location).pathname;
  const relative = './' + url.pathname.slice(scopePath.length);
  const isAsset = url.origin === self.location.origin &&
    (ASSETS.includes(relative) || url.pathname === scopePath);
  if (!isAsset) return;
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});
```

- [ ] **Step 5: index.html にSW登録を追記**

`</body>`直前に:

```html
<script>
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
</script>
```

- [ ] **Step 6: 失敗するテストを書く（tests/assets.test.js）**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

function pngSize(path) {
  const buf = readFileSync(path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const sw = readFileSync('sw.js', 'utf8');
const assets = [...sw.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]);

test('manifestの全アイコンが存在し実寸が一致する', () => {
  for (const icon of manifest.icons) {
    assert.ok(existsSync(icon.src), `${icon.src} がない`);
    const [w, h] = icon.sizes.split('x').map(Number);
    const actual = pngSize(icon.src);
    assert.equal(actual.width, w, `${icon.src} width`);
    assert.equal(actual.height, h, `${icon.src} height`);
  }
});

test('maskableはmaskable版だけに付いている', () => {
  const maskables = manifest.icons.filter((i) => i.purpose === 'maskable');
  assert.equal(maskables.length, 1);
  assert.ok(maskables[0].src.includes('maskable'));
});

test('sw.jsのASSETSに主要ファイルが含まれ、実在する', () => {
  for (const icon of manifest.icons) assert.ok(assets.includes('./' + icon.src));
  for (const js of readdirSync('js')) assert.ok(assets.includes(`./js/${js}`), `./js/${js}`);
  for (const path of assets) {
    if (path === './') continue;
    assert.ok(existsSync(path), `${path} がASSETSにあるが実在しない`);
  }
});

test('sw.jsはapp-syncのsync.jsをキャッシュしない', () => {
  assert.ok(!sw.includes('app-sync'));
});
```

- [ ] **Step 7: テスト実行**

Run: `npm test`
Expected: PASS（アイコン生成が正しければ通る。失敗したらアイコン実寸/ASSETS抜けを直す）

- [ ] **Step 8: ブラウザで動作確認**

httpサーバー経由で開き、DevToolsなしでも次を確認:
1. コンソールにSW登録エラーが出ない（`read_console_messages`）
2. リロード2回目以降もアプリが表示される

- [ ] **Step 9: コミット**

```powershell
git add manifest.json sw.js icons .nojekyll index.html tests/assets.test.js
git commit -m "feat: PWA化(manifest/SW/アイコン)とアセット整合性テストを追加"
```

---

### Task 8: 設定エリア（app-sync統合・CSVダウンロード・全データ初期化）

**Files:**
- Modify: `js/app.js`
- Modify: `js/store.js`（collect/restore用のエクスポート追加）
- Modify: `style.css`（設定エリア）

**Interfaces:**
- Consumes: `initDailyBackup({appId, collect, restore}), renderSyncSettings(container)`（app-sync v1 sync.js）、`generateCsv` (csv.js)、`loadState, saveState, resetState` (store.js)
- Produces: `#settings` セクションに「バックアップ(GitHub)」共有UI＋「CSV形式でダウンロード」＋「全データを初期化」

- [ ] **Step 1: js/app.js に設定エリアを実装**

```js
import { generateCsv } from './csv.js';
import { saveState, resetState } from './store.js';

const SYNC_URL = 'https://taka070600538-tech.github.io/app-sync/v1/sync.js';

function downloadCsv() {
  const blob = new Blob([generateCsv(state)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `time-diary-${todayString()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function renderSettings() {
  const section = document.getElementById('settings');
  section.innerHTML = `
    <div id="sync-settings"></div>
    <div class="settings-actions">
      <button type="button" id="csv-download">CSV形式でダウンロード</button>
      <button type="button" id="reset-all">全データを初期化</button>
    </div>
  `;
  section.querySelector('#csv-download').addEventListener('click', downloadCsv);
  section.querySelector('#reset-all').addEventListener('click', () => {
    if (!confirm('すべての記録と項目設定を削除し、初期状態に戻します。よろしいですか?')) return;
    resetState();
    location.reload();
  });
  import(SYNC_URL).then((sync) => {
    sync.initDailyBackup({
      appId: 'time-diary',
      collect: async () => state,
      restore: async (data) => saveState(data),
    });
    sync.renderSyncSettings(section.querySelector('#sync-settings'));
  }).catch(() => {}); // オフライン等では静かにスキップ
}

renderSettings(); // 起動時に1回
```

（`state`と`todayString`はapp.jsの既存importを使う）

- [ ] **Step 2: ブラウザで動作確認**

1. 設定エリアに「バックアップ(GitHub)」UI（トークン設定・今すぐ保存・復元）が出る
2. CSVダウンロードで全日程入りのCSVが落ち、Excelで文字化けしない（BOM確認）
3. 全データ初期化で確認→リロード→プリセットに戻る
4. localhost起動でもsync.jsのimportに失敗してアプリ本体が壊れない（catchが効く）

※実バックアップの疎通はTask 9のPages公開後にスマホ/PC実機で確認する（localhostでもPAT設定済みなら動くが必須にしない）。

- [ ] **Step 3: コミット**

```powershell
git add js/app.js style.css
git commit -m "feat: GitHubバックアップ・CSVダウンロード・初期化の設定エリアを追加"
```

---

### Task 9: GitHubリポジトリ作成・Pages公開・実機確認

**Files:**
- なし（リモート設定とREADME.mdのみ）
- Create: `README.md`

**Interfaces:**
- Produces: 公開URL `https://taka070600538-tech.github.io/time-diary-app/`

- [ ] **Step 1: README.md を作成**

アプリ概要・公開URL・データの流れ（localStorage → app-data/time-diary/backup.json → デイリーノート転記）・開発コマンド（`npm test`）を簡潔に記載。

```powershell
git add README.md
git commit -m "docs: READMEを追加"
```

- [ ] **Step 2: リモートリポジトリを作成してpush**

```powershell
gh auth status
```

- `gh` が使えれば: `gh repo create taka070600538-tech/time-diary-app --public --source . --push`
- 使えなければ: ユーザーに https://github.com/new で公開リポジトリ `time-diary-app`（README等なし）を作ってもらい、
  `git remote add origin https://github.com/taka070600538-tech/time-diary-app.git; git push -u origin master:main`
  （Git Credential Managerのブラウザ認証に任せる。トークンをチャットに貼らせない）

- [ ] **Step 3: GitHub Pagesを有効化**

- `gh` があれば: `gh api -X POST repos/taka070600538-tech/time-diary-app/pages -f "source[branch]=main" -f "source[path]=/"`
- なければユーザーに: Settings → Pages → Source: Deploy from a branch → main / (root)
- 初回デプロイは数十秒〜1分待つ（404が出ても慌てない）

- [ ] **Step 4: 公開URLで動作確認**

Browserパネルで `https://taka070600538-tech.github.io/time-diary-app/` を開き:
1. アプリが表示・入力できる
2. 設定エリアのバックアップUIが「トークン設定済み」になっている（既存アプリのPATが同一オリジンで効いているか。**このPCブラウザで**既存アプリのPAT設定をしたことがなければ「未設定」でも正常）
3. 「今すぐ保存」→「保存しました」→ `app-data` リポジトリに `time-diary/backup.json` ができている（`git -C "D:\Obsidian Vault for Claude Code\Git\app-data" pull` して確認）
4. デプロイ直後のキャッシュ問題が出たら `fetch(url, {cache:'reload'})` で強制再検証してから確認

- [ ] **Step 5: ユーザーにスマホでの確認を依頼**

スマホのブラウザで公開URLを開き、「ホーム画面に追加」でインストール。
既存アプリでPAT設定済みの端末なら追加設定なしでバックアップが効くことを伝える。

- [ ] **Step 6: コミット（残変更があれば）とpush**

```powershell
git push
```

---

### Task 10: PC側転記（transcribe.mjs + 日次タスク組み込み）

**Files:**
- Create: `tools/transcribe.mjs`
- Test: `tests/transcribe.test.js`
- Modify: `D:\Obsidian Vault for Claude Code\Git\app-sync\tools\app-data-pull.ps1`

**Interfaces:**
- Consumes: `intervalMinutes, formatDuration, addDays, todayString` (js/calc.js — tools側からも相対importできる)
- Produces:
  - `buildDaySection(state, date) => string|null` — その日の転記Markdown（`## 時間管理ダイアリー`見出し込み）。記録がなければnull
  - `needsTranscription(noteContent: string) => boolean` — `'## 時間管理ダイアリー'` を含まなければtrue
  - `datesToTranscribe(state, today: string) => string[]` — 記録がある `today` **より前**の日付（昇順）
  - `runTranscription({ state, diaryDir, today }) => {date, action: 'created'|'appended'|'skipped'}[]`
  - CLI: `node tools/transcribe.mjs` — `app-data/time-diary/backup.json` を読んで実行、結果を1行ずつstdoutに出す

- [ ] **Step 1: 失敗するテストを書く（tests/transcribe.test.js）**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDaySection, needsTranscription, datesToTranscribe,
} from '../tools/transcribe.mjs';

const state = {
  version: 1,
  items: [
    { id: 'prev-sleep', label: '前日の就寝' },
    { id: 'wake', label: '起床' },
    { id: 'study-start', label: '勉強開始' },
  ],
  intervals: [
    { id: 'sleep-duration', label: '睡眠時間', start: 'prev-sleep', end: 'wake' },
    { id: 'x', label: '未完区間', start: 'wake', end: 'study-start' },
  ],
  days: {
    '2026-08-09': {
      times: { 'prev-sleep': '22:30', wake: '06:00' },
      note: '調子が良い',
    },
    '2026-08-10': { times: { wake: '07:00' }, note: '' },
  },
};

test('buildDaySection: 表・区間まとめ・特記事項', () => {
  const md = buildDaySection(state, '2026-08-09');
  assert.ok(md.startsWith('## 時間管理ダイアリー\n'));
  assert.ok(md.includes('| 前日の就寝 | 22:30 |'));
  assert.ok(md.includes('| 起床 | 06:00 |'));
  assert.ok(!md.includes('| 勉強開始 |'));        // 未入力項目は表から省略
  assert.ok(md.includes('**睡眠時間**: 7時間30分'));
  assert.ok(!md.includes('未完区間'));             // 計算不能な区間は省略
  assert.ok(md.includes('### 特記事項\n調子が良い'));
});

test('buildDaySection: 特記事項なしなら節ごと省略、記録なしはnull', () => {
  const md = buildDaySection(state, '2026-08-10');
  assert.ok(!md.includes('特記事項'));
  assert.equal(buildDaySection(state, '2026-01-01'), null);
});

test('needsTranscription: 見出しの有無で判定', () => {
  assert.equal(needsTranscription('# 日記\n本文'), true);
  assert.equal(needsTranscription('本文\n## 時間管理ダイアリー\n...'), false);
});

test('datesToTranscribe: 今日より前の記録日だけ昇順', () => {
  assert.deepEqual(datesToTranscribe(state, '2026-08-10'), ['2026-08-09']);
  assert.deepEqual(datesToTranscribe(state, '2026-08-11'), ['2026-08-09', '2026-08-10']);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`Cannot find module ... tools/transcribe.mjs`）

- [ ] **Step 3: tools/transcribe.mjs を実装**

```js
// app-data/time-diary/backup.json を読み、Obsidianデイリーノートに転記する。
// 日本語パスはこのファイル(UTF-8)内に持つ(.ps1に書くと文字化けするため)。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
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
```

※CLI判定(`import.meta.url`と`process.argv[1]`の比較)はWindowsパスで壊れやすい。
テスト実行時にCLI部分が動かないことを`npm test`で必ず確認し、壊れていたら
`process.argv[1]`を`pathToFileURL(process.argv[1]).href`（`node:url`）と比較する形に直す。

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全スイート）

- [ ] **Step 5: 実データで手動実行して確認**

```powershell
git -C "D:\Obsidian Vault for Claude Code\Git\app-data" pull; node "D:\Obsidian Vault for Claude Code\Git\time-diary-app\tools\transcribe.mjs"
```

Task 9でバックアップ済みなら前日以前分が転記される（当日分しか無ければ「転記対象なし」でOK。
その場合はbackup.jsonに手で前日の日付データを一時追加→実行→`01_日記/`に追記されるのを確認→
`git -C ... checkout .`で戻す、まで行う）。
確認事項: 見出し・表・区間まとめ・特記事項の形式が設計書どおりか、2回目の実行で `skipped` になるか（二重追記されないか)。

- [ ] **Step 6: app-data-pull.ps1 に転記ステップを追加**

`D:\Obsidian Vault for Claude Code\Git\app-sync\tools\app-data-pull.ps1` の `git pull` 成功後に追記（パスはすべてASCIIなので直書き可）:

```powershell
    $transcribe = "D:\Obsidian Vault for Claude Code\Git\time-diary-app\tools\transcribe.mjs"
    if (Test-Path $transcribe) {
        $tOut = node $transcribe | Out-String
        Add-Content -Path $log -Value "[$stamp] TRANSCRIBE: $($tOut.Trim())" -Encoding UTF8
    }
```

編集後、BOM付きUTF-8で保存し直す:

```powershell
$p = "D:\Obsidian Vault for Claude Code\Git\app-sync\tools\app-data-pull.ps1"; $c = Get-Content -Raw -Encoding UTF8 $p; Set-Content -Path $p -Value $c -Encoding UTF8; (Get-Content $p -TotalCount 1 -Encoding Byte)[0..2] -join ','
```

Expected: 末尾の出力が `239,187,191`（BOMあり）

- [ ] **Step 7: タスク全体を手動実行して疎通確認**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\Obsidian Vault for Claude Code\Git\app-sync\tools\app-data-pull.ps1"; Get-Content "D:\Obsidian Vault for Claude Code\Git\app-data\pull-log.txt" -Tail 3
```

Expected: `OK:` 行と `TRANSCRIBE:` 行がログに追記される

- [ ] **Step 8: コミット（両リポジトリ）**

```powershell
Set-Location "D:\Obsidian Vault for Claude Code\Git\time-diary-app"; git add tools/transcribe.mjs tests/transcribe.test.js; git commit -m "feat: デイリーノート転記スクリプトを追加"; git push
Set-Location "D:\Obsidian Vault for Claude Code\Git\app-sync"; git add tools/app-data-pull.ps1; git commit -m "feat: 日次pullに時間管理ダイアリーの転記ステップを追加"; git push
```

---

## 完了条件（受け入れチェック）

- [ ] スマホで公開URLからインストールでき、参考アプリ同等の入力・自動計算・グラフが動く
- [ ] 項目・区間を編集でき、タイムライン/グラフ/CSVが追従する
- [ ] `app-data/time-diary/backup.json` に自動バックアップされる
- [ ] 日次タスク実行で前日分がデイリーノートに転記され、再実行しても二重追記されない
- [ ] `npm test` が全て通る
