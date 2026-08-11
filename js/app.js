// アプリの起動・タブ制御。各タブの描画は個別モジュールに委譲する。

import { loadState, saveState, parseBackupJson } from './store.js';
import { todayString } from './calc.js';
import { renderTimeline } from './timeline.js';
import { renderStats } from './stats.js';
import { renderItems } from './items.js';
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
  settings: document.getElementById('tab-settings'),
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
  // settingsは静的UIのため起動時に1回だけ描画する(renderSettings参照)。
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

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `time-diary-backup-${todayString()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function renderSettings() {
  const section = containers.settings;
  if (!section) return;
  section.textContent = '';

  // renderSyncSettingsは見出しを含む自己完結したUIを描画するため、
  // ここでは重複見出しを付けずコンテナだけを用意する。
  const syncContainer = el('div', { id: 'sync-settings' });

  const exportButton = el('button', {
    type: 'button',
    id: 'export-data',
    class: 'button-primary',
    text: 'エクスポート(JSONファイル)',
    onclick: exportData,
  });

  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const parsed = parseBackupJson(text);
    if (!parsed) {
      alert('ファイルの形式が正しくありません。時間管理ダイアリーのエクスポートファイルを選択してください。');
      return;
    }
    const ok = confirm('現在のすべてのデータをインポートした内容で上書きします。よろしいですか?');
    if (!ok) return;
    saveState(parsed);
    location.reload();
  });

  const importButton = el('button', {
    type: 'button',
    id: 'import-data',
    class: 'button-primary',
    text: 'インポート(JSONファイル)',
    onclick: () => fileInput.click(),
  });

  const dataSection = el('section', { class: 'settings-section' }, [
    el('h2', { text: 'データ管理' }),
    el('div', { class: 'settings-actions' }, [exportButton, importButton, fileInput]),
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

renderSettings(); // 起動時に1回(設定タブは非依存で常にバックアップ処理を動かす)
rerender();
