/* 我的運動紀錄 — 純前端 PWA，資料儲存於 localStorage */
(() => {
  'use strict';

  const STORAGE_KEY = 'fitness-records-v1';

  const SPORT_TYPES = [
    { name: '跑步', emoji: '🏃' },
    { name: '健走', emoji: '🚶' },
    { name: '自行車', emoji: '🚴' },
    { name: '游泳', emoji: '🏊' },
    { name: '重訓', emoji: '🏋️' },
    { name: '瑜珈', emoji: '🧘' },
    { name: '籃球', emoji: '⛹️' },
    { name: '羽球', emoji: '🏸' },
    { name: '登山健行', emoji: '🥾' },
    { name: '其他', emoji: '💪' },
  ];
  const emojiOf = (type) =>
    (SPORT_TYPES.find((t) => t.name === type) || { emoji: '💪' }).emoji;

  /* ---------- 資料存取 ---------- */
  let records = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  /* ---------- 日期工具 ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => fmtDate(new Date());

  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  }
  // 本週起點（週一）
  function weekStart() {
    const d = new Date();
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return fmtDate(d);
  }
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  function dateLabel(dateStr) {
    const t = todayStr();
    if (dateStr === t) return '今天';
    if (dateStr === addDays(t, -1)) return '昨天';
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
  }

  /* ---------- 分頁切換 ---------- */
  const pages = document.querySelectorAll('.page');
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      pages.forEach((p) => p.classList.toggle('active', p.id === tab.dataset.page));
      document.getElementById('fab').classList
        .toggle('hidden', tab.dataset.page !== 'page-records');
      if (tab.dataset.page === 'page-stats') renderStats();
    });
  });

  /* ---------- 紀錄列表 ---------- */
  const listEl = document.getElementById('record-list');
  const emptyHint = document.getElementById('empty-hint');

  function renderList() {
    listEl.innerHTML = '';
    emptyHint.classList.toggle('hidden', records.length > 0);

    const byDate = new Map();
    [...records]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
      .forEach((r) => {
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        byDate.get(r.date).push(r);
      });

    for (const [date, items] of byDate) {
      const group = document.createElement('div');
      group.className = 'date-group';
      const heading = document.createElement('h3');
      heading.className = 'date-heading';
      heading.textContent = dateLabel(date);
      group.appendChild(heading);

      for (const r of items) {
        const meta = [`${r.minutes} 分鐘`];
        if (r.distance) meta.push(`${r.distance} 公里`);
        if (r.calories) meta.push(`${r.calories} 大卡`);
        if (r.intensity) meta.push(r.intensity);

        const card = document.createElement('div');
        card.className = 'record-card';
        card.innerHTML = `
          <span class="record-emoji"></span>
          <div class="record-main">
            <div class="record-type"></div>
            <div class="record-meta"></div>
            <div class="record-note hidden"></div>
          </div>
          <div class="record-actions">
            <button class="icon-btn" data-act="edit" aria-label="編輯">✏️</button>
            <button class="icon-btn" data-act="del" aria-label="刪除">🗑️</button>
          </div>`;
        card.querySelector('.record-emoji').textContent = emojiOf(r.type);
        card.querySelector('.record-type').textContent = r.type;
        card.querySelector('.record-meta').textContent = meta.join(' · ');
        if (r.note) {
          const noteEl = card.querySelector('.record-note');
          noteEl.textContent = r.note;
          noteEl.classList.remove('hidden');
        }
        card.querySelector('[data-act="edit"]').addEventListener('click', () => openForm(r));
        card.querySelector('[data-act="del"]').addEventListener('click', () => {
          if (confirm(`確定要刪除這筆「${r.type}」紀錄嗎？`)) {
            records = records.filter((x) => x.id !== r.id);
            save();
            renderList();
            toast('已刪除');
          }
        });
        group.appendChild(card);
      }
      listEl.appendChild(group);
    }
  }

  /* ---------- 表單 ---------- */
  const modal = document.getElementById('modal');
  const form = document.getElementById('record-form');
  const formTitle = document.getElementById('form-title');
  let editingId = null;

  const typeSelect = form.elements.type;
  SPORT_TYPES.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.name;
    opt.textContent = `${t.emoji} ${t.name}`;
    typeSelect.appendChild(opt);
  });

  function openForm(record) {
    editingId = record ? record.id : null;
    formTitle.textContent = record ? '編輯紀錄' : '新增紀錄';
    form.reset();
    form.elements.date.value = record ? record.date : todayStr();
    if (record) {
      form.elements.type.value = record.type;
      form.elements.minutes.value = record.minutes;
      form.elements.distance.value = record.distance ?? '';
      form.elements.calories.value = record.calories ?? '';
      form.elements.intensity.value = record.intensity || '適中';
      form.elements.note.value = record.note || '';
    }
    modal.classList.remove('hidden');
    form.elements.minutes.focus();
  }
  function closeForm() {
    modal.classList.add('hidden');
    editingId = null;
  }

  document.getElementById('fab').addEventListener('click', () => openForm(null));
  document.getElementById('btn-cancel').addEventListener('click', closeForm);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeForm);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements;
    const data = {
      date: f.date.value,
      type: f.type.value,
      minutes: Number(f.minutes.value),
      distance: f.distance.value ? Number(f.distance.value) : null,
      calories: f.calories.value ? Number(f.calories.value) : null,
      intensity: f.intensity.value,
      note: f.note.value.trim(),
    };
    if (editingId !== null) {
      const idx = records.findIndex((r) => r.id === editingId);
      if (idx >= 0) records[idx] = { ...records[idx], ...data };
      toast('已更新');
    } else {
      records.push({ id: Date.now(), ...data });
      toast('已新增 💪');
    }
    save();
    closeForm();
    renderList();
  });

  /* ---------- 統計 ---------- */
  function renderStats() {
    const ws = weekStart();
    const weekRecords = records.filter((r) => r.date >= ws && r.date <= todayStr());
    document.getElementById('stat-week-count').textContent = weekRecords.length;
    document.getElementById('stat-week-minutes').textContent =
      weekRecords.reduce((s, r) => s + r.minutes, 0);
    document.getElementById('stat-week-distance').textContent =
      Math.round(weekRecords.reduce((s, r) => s + (r.distance || 0), 0) * 10) / 10;
    document.getElementById('stat-streak').textContent = streak();

    renderWeekChart();
    renderTypeChart();
  }

  // 連續運動天數（含今天或到昨天為止）
  function streak() {
    const days = new Set(records.map((r) => r.date));
    let d = todayStr();
    if (!days.has(d)) d = addDays(d, -1);
    let count = 0;
    while (days.has(d)) {
      count++;
      d = addDays(d, -1);
    }
    return count;
  }

  /* ---- 近 7 天長條圖 ---- */
  function renderWeekChart() {
    const container = document.getElementById('chart-week');
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = addDays(todayStr(), -i);
      const minutes = records
        .filter((r) => r.date === date)
        .reduce((s, r) => s + r.minutes, 0);
      const d = new Date(date + 'T00:00:00');
      days.push({ date, minutes, label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}` });
    }
    drawBarChart(container, days.map((d) => ({
      label: d.label,
      value: d.minutes,
      tooltip: `${dateLabel(d.date)}：${d.minutes} 分鐘`,
    })));
  }

  /* ---- 近 30 天類型長條圖 ---- */
  function renderTypeChart() {
    const container = document.getElementById('chart-types');
    const since = addDays(todayStr(), -29);
    const totals = new Map();
    records
      .filter((r) => r.date >= since)
      .forEach((r) => totals.set(r.type, (totals.get(r.type) || 0) + r.minutes));
    const items = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, minutes]) => ({
        label: type,
        value: minutes,
        tooltip: `${type}：${minutes} 分鐘`,
      }));
    if (items.length === 0) {
      container.innerHTML = '<p class="chart-empty">最近 30 天還沒有紀錄</p>';
      return;
    }
    drawBarChart(container, items);
  }

  /* 單一系列直向長條圖（SVG，含 hover 提示） */
  function drawBarChart(container, items) {
    container.innerHTML = '';
    if (items.every((it) => it.value === 0)) {
      container.innerHTML = '<p class="chart-empty">這段期間還沒有紀錄</p>';
      return;
    }

    const W = 320;
    const H = 170;
    const padTop = 10;
    const padBottom = 24;
    const padLeft = 30;
    const padRight = 6;
    const plotW = W - padLeft - padRight;
    const plotH = H - padTop - padBottom;
    const max = Math.max(...items.map((it) => it.value));
    // 取整齊的軸上限
    const niceMax = niceCeil(max);

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');

    const cssVar = (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const seriesColor = cssVar('--series-1');
    const mutedColor = cssVar('--text-muted');
    const gridColor = cssVar('--gridline');
    const baselineColor = cssVar('--baseline');

    // 格線與 y 軸刻度（0、一半、最大）
    [0, 0.5, 1].forEach((t) => {
      const y = padTop + plotH - plotH * t;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', padLeft);
      line.setAttribute('x2', W - padRight);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', t === 0 ? baselineColor : gridColor);
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const tick = document.createElementNS(ns, 'text');
      tick.setAttribute('x', padLeft - 6);
      tick.setAttribute('y', y + 3.5);
      tick.setAttribute('text-anchor', 'end');
      tick.setAttribute('font-size', '10');
      tick.setAttribute('fill', mutedColor);
      tick.textContent = Math.round(niceMax * t);
      svg.appendChild(tick);
    });

    const n = items.length;
    const slot = plotW / n;
    const barW = Math.min(34, slot * 0.6);

    items.forEach((it, i) => {
      const cx = padLeft + slot * i + slot / 2;
      const h = niceMax > 0 ? (it.value / niceMax) * plotH : 0;
      const y = padTop + plotH - h;

      if (it.value > 0) {
        // 長條：底部貼齊基準線，只圓角頂端（4px）
        const r = Math.min(4, h);
        const x = cx - barW / 2;
        const path = document.createElementNS(ns, 'path');
        path.setAttribute(
          'd',
          `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`
        );
        path.setAttribute('fill', seriesColor);
        svg.appendChild(path);
      }

      // x 軸標籤
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', cx);
      label.setAttribute('y', H - 8);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', mutedColor);
      label.textContent = it.label;
      svg.appendChild(label);

      // hover 命中區（比長條更寬）
      const hit = document.createElementNS(ns, 'rect');
      hit.setAttribute('x', padLeft + slot * i);
      hit.setAttribute('y', padTop);
      hit.setAttribute('width', slot);
      hit.setAttribute('height', plotH);
      hit.setAttribute('fill', 'transparent');
      hit.addEventListener('pointerenter', () => showTooltip(container, it.tooltip, cx / W, y / H));
      hit.addEventListener('pointerleave', () => hideTooltip(container));
      svg.appendChild(hit);
    });

    container.appendChild(svg);
  }

  function niceCeil(v) {
    if (v <= 10) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const steps = [1, 2, 2.5, 5, 10];
    for (const s of steps) {
      if (v <= s * mag) return s * mag;
    }
    return 10 * mag;
  }

  function showTooltip(container, text, fx, fy) {
    hideTooltip(container);
    const tip = document.createElement('div');
    tip.className = 'chart-tooltip';
    tip.textContent = text;
    const rect = container.getBoundingClientRect();
    tip.style.left = `${fx * rect.width}px`;
    tip.style.top = `${Math.max(fy * rect.height - 8, 20)}px`;
    container.appendChild(tip);
  }
  function hideTooltip(container) {
    const tip = container.querySelector('.chart-tooltip');
    if (tip) tip.remove();
  }

  /* ---------- 匯出／匯入／清除 ---------- */
  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `運動紀錄-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('已匯出');
  });

  const importFile = document.getElementById('import-file');
  document.getElementById('btn-import').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const file = importFile.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error();
      const valid = data.filter(
        (r) => r && typeof r.date === 'string' && typeof r.type === 'string' && r.minutes > 0
      );
      const existing = new Set(records.map((r) => r.id));
      let added = 0;
      valid.forEach((r) => {
        if (!existing.has(r.id)) {
          records.push({ ...r, id: r.id ?? Date.now() + added });
          added++;
        }
      });
      save();
      renderList();
      toast(`已匯入 ${added} 筆紀錄`);
    } catch {
      toast('匯入失敗：檔案格式不正確');
    }
    importFile.value = '';
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('確定要刪除「全部」紀錄嗎？此動作無法復原。')) {
      records = [];
      save();
      renderList();
      toast('已清除全部紀錄');
    }
  });

  /* ---------- 提示訊息 ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2000);
  }

  /* ---------- 初始化 ---------- */
  document.getElementById('today-label').textContent = dateLabel(todayStr());
  renderList();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
