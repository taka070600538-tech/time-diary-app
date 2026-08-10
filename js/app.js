// アプリの起動・タブ制御。各タブの描画は個別モジュールに委譲する。

import { loadState, saveState, resetState } from './store.js';
import { todayString } from './calc.js';
import { renderTimeline } from './timeline.js';
import { renderStats } from './stats.js';
import { renderItems } from './items.js';
import { generateCsv } from './csv.js';
import { el } from './dom.js';

// 共有GitHub自動バックアップ基盤(app-sync)。オフライン・基盤障害時は
// importが失敗するので、その場合は静かにスキップしアプリ本体は壊さない。
const SYNC_URL = 'https://taka070600538-tech.github.io/app-sync/v1/sync.js';

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
      onDateChange(next) {
        currentDate = next;
        rerender();
      },
    });
  }
  if (activeTab === 'stats') renderStats(containers.stats, { state });
  if (activeTab === 'items') renderItems(containers.items, { state, onChanged: rerender });
}

export function showTab(name) {
  if (!containers[name]) return;
  activeTab = name;
  for (const [key, pane] of Object.entries(containers)) pane.hidden = key !== name;
  document.querySelectorAll('.tab-button').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.tab === name);
  });
  rerender();
}

document.querySelectorAll('.tab-button').forEach((b) => {
  b.addEventListener('click', () => showTab(b.dataset.tab));
});

function downloadCsv() {
  const blob = new Blob([generateCsv(state)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `time-diary-${todayString()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function renderSettings() {
  const section = document.getElementById('settings');
  if (!section) return;
  section.textContent = '';

  // renderSyncSettingsは見出しを含む自己完結したUIを描画するため、
  // ここでは重複見出しを付けずコンテナだけを用意する。
  const syncContainer = el('div', { id: 'sync-settings' });

  const csvButton = el('button', {
    type: 'button',
    id: 'csv-download',
    class: 'button-primary',
    text: 'CSV形式でダウンロード',
    onclick: downloadCsv,
  });

  const resetButton = el('button', {
    type: 'button',
    id: 'reset-all',
    class: 'button-danger',
    text: '全データを初期化',
    onclick: () => {
      const ok = confirm('すべての記録と項目設定を削除し、初期状態に戻します。よろしいですか?');
      if (!ok) return;
      resetState();
      location.reload();
    },
  });

  const dataSection = el('section', { class: 'settings-section' }, [
    el('h2', { text: 'データ管理' }),
    el('div', { class: 'settings-actions' }, [csvButton, resetButton]),
  ]);

  section.appendChild(syncContainer);
  section.appendChild(dataSection);

  // app-sync基盤(GitHubバックアップ共有モジュール)を動的importで読み込む。
  // オフラインや基盤側の障害でimportが失敗しても、catchで握りつぶし
  // アプリ本体(タイムライン等)の動作には影響させない。
  import(SYNC_URL)
    .then((sync) => {
      sync.initDailyBackup({
        appId: 'time-diary',
        collect: async () => state,
        restore: async (data) => saveState(data),
      });
      sync.renderSyncSettings(syncContainer);
    })
    .catch(() => {});
}

renderSettings(); // 起動時に1回(設定エリアはタブ非依存で常に表示)
rerender();
