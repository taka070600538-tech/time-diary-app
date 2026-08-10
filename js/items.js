// 「項目の編集」タブの描画。時刻項目の並べ替え・改名・追加・削除と、
// 自動計算区間の追加・編集・削除を担当する。永続化はstore.jsに委譲する。

import {
  addItem,
  renameItem,
  moveItem,
  removeItem,
  addInterval,
  updateInterval,
  removeInterval,
} from './store.js';
import { el } from './dom.js';

function buildItemSelect(items, selectedId, ariaLabel) {
  const select = el('select', { class: 'interval-select', 'aria-label': ariaLabel });
  for (const item of items) {
    const option = el('option', { value: item.id, text: item.label });
    if (item.id === selectedId) option.selected = true;
    select.appendChild(option);
  }
  return select;
}

function renderItemRow(item, index, itemCount, ctx) {
  const { state, onChanged } = ctx;

  const labelInput = el('input', {
    type: 'text',
    class: 'item-label-input',
    value: item.label,
    'aria-label': '項目名',
  });
  labelInput.addEventListener('change', () => {
    const label = labelInput.value.trim();
    if (!label) {
      labelInput.value = item.label;
      return;
    }
    renameItem(state, item.id, label);
    onChanged();
  });

  const upButton = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': '上へ移動',
    text: '↑',
    disabled: index === 0 ? '' : null,
    onclick: () => {
      moveItem(state, item.id, -1);
      onChanged();
    },
  });

  const downButton = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': '下へ移動',
    text: '↓',
    disabled: index === itemCount - 1 ? '' : null,
    onclick: () => {
      moveItem(state, item.id, 1);
      onChanged();
    },
  });

  const deleteButton = el('button', {
    type: 'button',
    class: 'button-danger',
    text: '削除',
    onclick: () => {
      const ok = confirm(
        `「${item.label}」を削除します。この項目を使う自動計算区間も削除されます。よろしいですか?`
      );
      if (!ok) return;
      removeItem(state, item.id);
      onChanged();
    },
  });

  const actions = el('div', { class: 'item-actions' }, [upButton, downButton, deleteButton]);
  return el('div', { class: 'item-row' }, [labelInput, actions]);
}

function renderIntervalRow(interval, ctx) {
  const { state, onChanged } = ctx;

  const labelInput = el('input', {
    type: 'text',
    class: 'item-label-input',
    value: interval.label,
    'aria-label': '区間名',
  });
  labelInput.addEventListener('change', () => {
    const label = labelInput.value.trim();
    if (!label) {
      labelInput.value = interval.label;
      return;
    }
    updateInterval(state, interval.id, { label });
    onChanged();
  });

  const startSelect = buildItemSelect(state.items, interval.start, '開始項目');
  startSelect.addEventListener('change', () => {
    const previous = interval.start;
    const ok = updateInterval(state, interval.id, { start: startSelect.value });
    if (!ok) {
      alert('開始と終了に同じ項目は選べません');
      startSelect.value = previous;
      return;
    }
    onChanged();
  });

  const endSelect = buildItemSelect(state.items, interval.end, '終了項目');
  endSelect.addEventListener('change', () => {
    const previous = interval.end;
    const ok = updateInterval(state, interval.id, { end: endSelect.value });
    if (!ok) {
      alert('開始と終了に同じ項目は選べません');
      endSelect.value = previous;
      return;
    }
    onChanged();
  });

  const deleteButton = el('button', {
    type: 'button',
    class: 'button-danger',
    text: '削除',
    onclick: () => {
      const ok = confirm(`「${interval.label}」の区間を削除します。よろしいですか?`);
      if (!ok) return;
      removeInterval(state, interval.id);
      onChanged();
    },
  });

  const controls = el('div', { class: 'interval-edit-controls' }, [
    startSelect,
    el('span', { class: 'interval-arrow', text: '→' }),
    endSelect,
    deleteButton,
  ]);

  return el('div', { class: 'interval-edit-row' }, [labelInput, controls]);
}

export function renderItems(container, ctx) {
  const { state, onChanged } = ctx;

  container.textContent = '';

  // --- 時刻項目 ---
  const itemsSection = el('section', { class: 'settings-section' }, [
    el('h2', { text: '時刻項目' }),
  ]);

  if (state.items.length === 0) {
    itemsSection.appendChild(el('p', { class: 'empty-message', text: '項目がありません' }));
  } else {
    state.items.forEach((item, index) => {
      itemsSection.appendChild(renderItemRow(item, index, state.items.length, ctx));
    });
  }

  const addItemButton = el('button', {
    type: 'button',
    class: 'settings-add-button',
    text: '＋項目を追加',
    onclick: () => {
      const label = prompt('項目名を入力してください');
      if (!label || !label.trim()) return;
      addItem(state, label.trim());
      onChanged();
    },
  });
  itemsSection.appendChild(addItemButton);

  // --- 自動計算区間 ---
  const intervalsSection = el('section', { class: 'settings-section' }, [
    el('h2', { text: '自動計算区間' }),
  ]);

  if (state.intervals.length === 0) {
    intervalsSection.appendChild(el('p', { class: 'empty-message', text: '区間がありません' }));
  } else {
    for (const interval of state.intervals) {
      intervalsSection.appendChild(renderIntervalRow(interval, ctx));
    }
  }

  const addIntervalButton = el('button', {
    type: 'button',
    class: 'settings-add-button',
    text: '＋区間を追加',
    onclick: () => {
      if (state.items.length < 2) {
        alert('項目が2つ以上必要です');
        return;
      }
      const label = prompt('区間名を入力してください');
      if (!label || !label.trim()) return;
      addInterval(state, label.trim(), state.items[0].id, state.items[1].id);
      onChanged();
    },
  });
  intervalsSection.appendChild(addIntervalButton);

  container.appendChild(itemsSection);
  container.appendChild(intervalsSection);
}
