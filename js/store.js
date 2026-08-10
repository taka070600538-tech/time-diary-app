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
