// タイムライン入力タブの描画。DOM構築とイベント配線のみを担当し、
// データの計算は calc.js、永続化は store.js に委譲する。

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

// 小さなDOM生成ヘルパー。ユーザー入力由来の文字列(項目名等)はtextContent経由でのみ
// 挿入するため、HTMLインジェクションの心配がない。
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function renderTimeline(container, ctx) {
  const { state, date, onDateChange } = ctx;
  const day = getDay(state, date);

  // itemId -> このitemを終了項目とする区間(表示位置=直後に挿入する対象)
  const intervalsByEnd = new Map();
  // itemId -> このitemを開始/終了いずれかに使う区間(時刻変更時に再計算が必要な対象)
  const intervalsByItem = new Map();
  for (const iv of state.intervals) {
    if (!intervalsByEnd.has(iv.end)) intervalsByEnd.set(iv.end, []);
    intervalsByEnd.get(iv.end).push(iv);
    for (const key of [iv.start, iv.end]) {
      if (!intervalsByItem.has(key)) intervalsByItem.set(key, []);
      intervalsByItem.get(key).push(iv);
    }
  }

  container.textContent = '';

  // --- 日付ナビゲーション ---
  const dateInput = el('input', {
    type: 'date',
    class: 'date-nav-input',
    value: date,
    'aria-label': '日付を選択',
  });
  dateInput.addEventListener('change', () => {
    if (dateInput.value) onDateChange(dateInput.value);
  });

  const heading = el('span', { class: 'date-heading', text: formatDateHeading(date) });

  const dateNav = el('div', { class: 'date-nav' }, [
    el('button', {
      type: 'button',
      class: 'date-nav-button',
      text: '前日',
      onclick: () => onDateChange(addDays(date, -1)),
    }),
    el('div', { class: 'date-nav-current' }, [dateInput, heading]),
    el('button', {
      type: 'button',
      class: 'date-nav-button',
      text: '翌日',
      onclick: () => onDateChange(addDays(date, 1)),
    }),
    el('button', {
      type: 'button',
      class: 'date-nav-today',
      text: '今日',
      onclick: () => onDateChange(todayString()),
    }),
  ]);

  // --- タイムライン本体 ---
  const list = el('ol', { class: 'timeline-list' });
  const intervalRowEls = new Map(); // intervalId -> 更新対象のtextノード

  function intervalText(iv) {
    const startVal = day.times[iv.start] || null;
    const endVal = day.times[iv.end] || null;
    const startDisp = startVal || '--:--';
    const endDisp = endVal || '--:--';
    const minutes = diffMinutes(startVal, endVal);
    return `${iv.label} ／ ${startDisp} → ${endDisp} ／ ${formatDuration(minutes)}`;
  }

  function updateIntervalRow(iv) {
    const textEl = intervalRowEls.get(iv.id);
    if (textEl) textEl.textContent = intervalText(iv);
  }

  for (const item of state.items) {
    const inputId = `time-${item.id}`;
    const timeInput = el('input', {
      type: 'time',
      id: inputId,
      class: 'timeline-time',
      value: day.times[item.id] || '',
    });

    const commit = () => {
      if (timeInput.value) day.times[item.id] = timeInput.value;
      else delete day.times[item.id];
      setTime(state, date, item.id, timeInput.value);
      for (const iv of intervalsByItem.get(item.id) || []) updateIntervalRow(iv);
    };
    timeInput.addEventListener('input', commit);

    const nowButton = el('button', {
      type: 'button',
      class: 'now-button',
      text: '現在',
      onclick: () => {
        timeInput.value = currentTimeHHMM();
        commit();
      },
    });

    const row = el('li', { class: 'timeline-row' }, [
      el('label', { class: 'timeline-label', for: inputId, text: item.label }),
      timeInput,
      nowButton,
    ]);
    list.appendChild(row);

    for (const iv of intervalsByEnd.get(item.id) || []) {
      const textEl = el('span', { class: 'interval-text', text: intervalText(iv) });
      const ivRow = el('li', { class: 'interval-row' }, [textEl]);
      list.appendChild(ivRow);
      intervalRowEls.set(iv.id, textEl);
    }
  }

  // --- 特記事項 ---
  const noteId = 'day-note';
  const noteLabel = el('label', { class: 'note-label', for: noteId, text: '特記事項' });
  const noteArea = el('textarea', { id: noteId, class: 'note-textarea', rows: '4' });
  noteArea.value = day.note || '';
  noteArea.addEventListener('input', () => {
    setNote(state, date, noteArea.value);
  });
  const noteSection = el('div', { class: 'note-area' }, [noteLabel, noteArea]);

  container.appendChild(dateNav);
  container.appendChild(list);
  container.appendChild(noteSection);
}
