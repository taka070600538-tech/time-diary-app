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
