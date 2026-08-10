// アプリの起動・タブ制御。各タブの描画は個別モジュールに委譲する。

import { loadState } from './store.js';
import { todayString } from './calc.js';
import { renderTimeline } from './timeline.js';
import { renderStats } from './stats.js';

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
  // items タブは Task 6 でここに追加する
}

export function showTab(name) {
  if (!containers[name]) return;
  activeTab = name;
  for (const [key, el] of Object.entries(containers)) el.hidden = key !== name;
  document.querySelectorAll('.tab-button').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.tab === name);
  });
  rerender();
}

document.querySelectorAll('.tab-button').forEach((b) => {
  b.addEventListener('click', () => showTab(b.dataset.tab));
});

rerender();
