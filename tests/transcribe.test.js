import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildDaySection, upsertSection, datesToTranscribe, runTranscription,
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

test('datesToTranscribe: 今日より前の記録日だけ昇順', () => {
  assert.deepEqual(datesToTranscribe(state, '2026-08-10'), ['2026-08-09']);
  assert.deepEqual(datesToTranscribe(state, '2026-08-11'), ['2026-08-09', '2026-08-10']);
});

test('upsertSection: マーカーが無ければ末尾に追記', () => {
  const result = upsertSection('既存の日記本文', 'セクション内容');
  assert.ok(result.startsWith('既存の日記本文\n\n<!-- time-diary:start -->\n'));
  assert.ok(result.includes('セクション内容'));
  assert.ok(result.trim().endsWith('<!-- time-diary:end -->'));
});

test('upsertSection: マーカーがあれば区間だけ置換し、前後は変えない', () => {
  const before = '前書き\n\n<!-- time-diary:start -->\n古い内容\n<!-- time-diary:end -->\n\n後書き';
  const result = upsertSection(before, '新しい内容');
  assert.ok(result.includes('前書き'));
  assert.ok(result.includes('後書き'));
  assert.ok(result.includes('新しい内容'));
  assert.ok(!result.includes('古い内容'));
});

test('upsertSection: CRLFの改行スタイルを保つ', () => {
  const before = '本文\r\n\r\n<!-- time-diary:start -->\r\n旧\r\n<!-- time-diary:end -->\r\n';
  const result = upsertSection(before, '新');
  assert.ok(result.includes('\r\n新\r\n'));
  assert.ok(!result.includes('\n新\n'.replace('\r', '')) || result.includes('\r\n')); // CRLF優位であることの簡易確認
});

test('runTranscription: 新規作成・冪等な再実行・内容変更時の更新', () => {
  const dir = mkdtempSync(join(tmpdir(), 'time-diary-test-'));
  try {
    const state = {
      version: 1,
      items: [{ id: 'wake', label: '起床' }],
      intervals: [],
      days: { '2026-08-09': { times: { wake: '06:00' }, note: '' } },
    };
    // 1回目: 新規作成
    let results = runTranscription({ state, diaryDir: dir, today: '2026-08-10' });
    assert.deepEqual(results, [{ date: '2026-08-09', action: 'created' }]);
    const path = join(dir, '2026-08-09.md');
    assert.ok(existsSync(path));
    const firstContent = readFileSync(path, 'utf8');

    // 2回目: 同じデータで再実行 → unchanged(二重追記されない)
    results = runTranscription({ state, diaryDir: dir, today: '2026-08-10' });
    assert.deepEqual(results, [{ date: '2026-08-09', action: 'unchanged' }]);
    assert.equal(readFileSync(path, 'utf8'), firstContent);

    // 既存の日記本文がある状態に、後からデータが完成した場合 → updatedで自己修復
    writeFileSync(path, '前書きメモ\n\n' + firstContent);
    const completedState = {
      ...state,
      days: { '2026-08-09': { times: { wake: '06:00' }, note: '完成した記録' } },
    };
    results = runTranscription({ state: completedState, diaryDir: dir, today: '2026-08-10' });
    assert.deepEqual(results, [{ date: '2026-08-09', action: 'updated' }]);
    const updated = readFileSync(path, 'utf8');
    assert.ok(updated.startsWith('前書きメモ'));       // 既存の手書きメモは保持される
    assert.ok(updated.includes('完成した記録'));         // 新しい内容に更新される
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
