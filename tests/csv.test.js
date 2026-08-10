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
  assert.ok(csv.startsWith('﻿'));
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
