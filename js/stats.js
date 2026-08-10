// 分析・グラフタブの描画。区間ごとの平均・週合計・直近7日棒グラフを表示する。
// SVGは値がすべて数値(分・M/D形式の日付)のみで組み立てるため、エスケープ不要で
// innerHTML経由で挿入する(項目ラベル等ユーザー由来の文字列はtextContent経由のみ)。

import { intervalStats, formatDuration, todayString } from './calc.js';

// 小さなDOM生成ヘルパー(timeline.jsと同じ方針)。
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

// 棒グラフ上の短縮ラベル(60分以上は "7.5h"、未満は "45m")。formatDurationとは別表記。
function barLabel(minutes) {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1).replace(/\.0$/, '')}h`;
  return `${minutes}m`;
}

function formatAxisDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 上辺のみ角丸・底辺は直角(dataviz方針: 4px rounded data-end, square baseline)。
function roundedTopRectPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, height, width / 2));
  const top = y;
  const bottom = y + height;
  const left = x;
  const right = x + width;
  if (r === 0) {
    return `M${left},${bottom} L${left},${top} L${right},${top} L${right},${bottom} Z`;
  }
  return [
    `M${left},${bottom}`,
    `L${left},${top + r}`,
    `Q${left},${top} ${left + r},${top}`,
    `L${right - r},${top}`,
    `Q${right},${top} ${right},${top + r}`,
    `L${right},${bottom}`,
    'Z',
  ].join(' ');
}

const CHART_WIDTH = 350;
const CHART_HEIGHT = 200;
const SLOT_WIDTH = CHART_WIDTH / 7;
const BAR_WIDTH = Math.min(SLOT_WIDTH * 0.6, 24); // dataviz方針: 棒は太くしすぎない(上限24px)
const BASELINE_Y = 170;
const MAX_BAR_HEIGHT = 150;

// 直近7日分の棒グラフSVG文字列を組み立てる。全日未入力ならnullを返す。
function renderChart(last7) {
  const hasData = last7.some((d) => d.minutes != null);
  if (!hasData) return null;

  const max = Math.max(...last7.map((d) => d.minutes ?? 0), 1);

  const parts = last7.map((d, i) => {
    const slotX = SLOT_WIDTH * i;
    const barX = slotX + (SLOT_WIDTH - BAR_WIDTH) / 2;
    const centerX = slotX + SLOT_WIDTH / 2;
    const dateLabelSvg =
      `<text x="${centerX}" y="${BASELINE_Y + 18}" class="chart-date-label" text-anchor="middle">${formatAxisDate(d.date)}</text>`;

    if (d.minutes == null) return dateLabelSvg;

    const barHeight = Math.max(2, (d.minutes / max) * MAX_BAR_HEIGHT);
    const barY = BASELINE_Y - barHeight;
    const path = roundedTopRectPath(barX, barY, BAR_WIDTH, barHeight, 4);
    const labelY = Math.max(barY - 6, 12);

    return [
      `<path d="${path}" class="chart-bar" />`,
      `<text x="${centerX}" y="${labelY}" class="chart-value-label" text-anchor="middle">${barLabel(d.minutes)}</text>`,
      dateLabelSvg,
    ].join('');
  });

  return (
    `<svg class="chart" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="直近7日間の推移">` +
    `<line x1="0" y1="${BASELINE_Y}" x2="${CHART_WIDTH}" y2="${BASELINE_Y}" class="chart-baseline" />` +
    parts.join('') +
    '</svg>'
  );
}

function renderIntervalCard(iv, stats) {
  const card = el('div', { class: 'stat-card' }, [el('h3', { text: iv.label })]);

  const summaryText =
    `平均 ${formatDuration(stats.avgMinutes)} ／ 今週合計 ${formatDuration(stats.weekTotalMinutes)} ／ ` +
    `記録した日数: ${stats.weekDayCount}日`;
  card.appendChild(el('p', { class: 'stat-summary', text: summaryText }));

  const chartSvg = renderChart(stats.last7);
  if (chartSvg) {
    const wrapper = el('div', { class: 'chart-wrapper' });
    wrapper.innerHTML = chartSvg;
    card.appendChild(wrapper);
  } else {
    card.appendChild(el('p', { class: 'chart-empty', text: 'まだ記録がありません' }));
  }

  return card;
}

export function renderStats(container, { state }) {
  container.textContent = '';

  if (state.intervals.length === 0) {
    container.appendChild(
      el('p', {
        class: 'empty-message',
        text: '区間が定義されていません。項目の編集タブで追加してください',
      })
    );
    return;
  }

  const today = todayString();
  for (const iv of state.intervals) {
    const stats = intervalStats(state.days, iv, today);
    container.appendChild(renderIntervalCard(iv, stats));
  }
}
