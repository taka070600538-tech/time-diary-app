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
