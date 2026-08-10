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
