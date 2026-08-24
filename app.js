/* 我的運動紀錄 — 純前端 PWA，資料儲存於 localStorage */
(() => {
  'use strict';

  const STORAGE_KEY = 'fitness-records-v1';
  const GOAL_KEY = 'fitness-goal-v1';

  // cat: 'main' = 運動（計入目標/連續天數）, 'recover' = 伸展恢復（單獨統計）
  const SPORT_TYPES = [
    { name: '跑步', emoji: '🏃', cat: 'main' },
    { name: '健走', emoji: '🚶', cat: 'main' },
    { name: '自行車', emoji: '🚴', cat: 'main' },
    { name: '游泳', emoji: '🏊', cat: 'main' },
    { name: '重訓', emoji: '🏋️', cat: 'main' },
    { name: '核心', emoji: '🎯', cat: 'main' },
    { name: '腹部', emoji: '🤸', cat: 'main' },
    { name: '臀腿', emoji: '🦵', cat: 'main' },
    { name: '胸', emoji: '🎽', cat: 'main' },
    { name: '瑜珈', emoji: '🧘', cat: 'main' },
    { name: '籃球', emoji: '⛹️', cat: 'main' },
    { name: '羽球', emoji: '🏸', cat: 'main' },
    { name: '登山健行', emoji: '🥾', cat: 'main' },
    { name: '其他', emoji: '💪', cat: 'main' },
    { name: '拉伸', emoji: '🙆', cat: 'recover' },
  ];
  const isRecoveryType = (t) =>
    (SPORT_TYPES.find((x) => x.name === t) || {}).cat === 'recover';
  // 至少含一種「運動」類型才算一次運動；純拉伸為恢復紀錄
  const isWorkout = (r) => (r.types || []).some((t) => !isRecoveryType(t));
  const emojiOf = (type) =>
    (SPORT_TYPES.find((t) => t.name === type) || { emoji: '💪' }).emoji;
  const INTENSITY_EMOJI = { 輕鬆: '😌', 適中: '🙂', 激烈: '🥵' };
  const PRAISES = ['太棒了！🎉', '超讚的！✨', '繼續保持！🔥', '你最棒了！💖', '離目標又近一步！🚀'];
  const praise = () => PRAISES[Math.floor(Math.random() * PRAISES.length)];

  /* ---------- 資料存取 ---------- */
  let records = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) return [];
      // 舊資料相容：單一 type 轉為 types 陣列
      return data.map((r) => ({
        ...r,
        types: Array.isArray(r.types) && r.types.length ? r.types : r.type ? [r.type] : ['其他'],
      }));
    } catch {
      return [];
    }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function loadGoal() {
    const n = Number(localStorage.getItem(GOAL_KEY));
    return n >= 1 && n <= 7 ? n : 3;
  }
  function saveGoal(n) {
    localStorage.setItem(GOAL_KEY, String(n));
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
    if (dateStr === t) return '今天 🌟';
    if (dateStr === addDays(t, -1)) return '昨天 ⭐';
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
        .toggle('hidden', !['page-home', 'page-records'].includes(tab.dataset.page));
      if (tab.dataset.page === 'page-stats') renderStats();
      if (tab.dataset.page === 'page-home') renderHome();
    });
  });

  /* ---------- 首頁 ---------- */
  const QUOTES = [
    '運動是給自己最好的禮物 🎁',
    '慢慢來，比較快 🐢',
    '流的汗不會背叛你 💦',
    '今天的你比昨天更強 💪',
    '動起來，煩惱就少一點 ☁️',
    '不必完美，只要開始 ✨',
    '身體會記得你的努力 🌟',
    '休息也是訓練的一部分 😌',
    '小步前進也是前進 👣',
    '你值得一個健康的自己 💖',
  ];

  // 本週運動「天數」：同一天不論記幾筆都只算 1 次
  function weekCount() {
    const ws = weekStart();
    const t = todayStr();
    return new Set(
      records
        .filter((r) => isWorkout(r) && r.date >= ws && r.date <= t)
        .map((r) => r.date)
    ).size;
  }

  const RING_CIRC = 2 * Math.PI * 52;

  function renderHome() {
    // 問候語（依時段）
    const hour = new Date().getHours();
    const greet =
      hour < 5 ? '夜貓子好 🌙' :
      hour < 11 ? '早安 ☀️' :
      hour < 14 ? '午安 🌤️' :
      hour < 18 ? '下午好 🌇' : '晚安 🌙';
    document.getElementById('hero-greet').textContent = greet;

    // 每日金句（依日期固定）
    const d = new Date();
    const qi = (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % QUOTES.length;
    document.getElementById('hero-slogan').textContent = QUOTES[qi];
    document.getElementById('daily-quote').textContent =
      QUOTES[(qi + 3) % QUOTES.length];

    // 目標進度環
    const goal = loadGoal();
    const count = weekCount();
    const pct = Math.min(1, count / goal);
    document.getElementById('ring-count').textContent = count;
    document.getElementById('ring-goal').textContent = `/ ${goal} 天`;
    const ringFill = document.getElementById('ring-fill');
    ringFill.style.strokeDasharray = RING_CIRC;
    ringFill.style.strokeDashoffset = RING_CIRC * (1 - pct);
    ringFill.classList.toggle('done', count >= goal);

    // 快速數據（只算運動）
    const ws = weekStart();
    const t = todayStr();
    const weekWorkouts = records.filter(
      (r) => isWorkout(r) && r.date >= ws && r.date <= t
    );
    document.getElementById('home-streak').textContent = streak();
    document.getElementById('home-week-min').textContent =
      weekWorkouts.reduce((s, r) => s + r.minutes, 0);

    // 打氣語
    const cheer = document.getElementById('cheer-line');
    const s = streak();
    const hasWorkoutToday = records.some((r) => isWorkout(r) && r.date === t);
    const hasStretchToday = records.some((r) => !isWorkout(r) && r.date === t);
    if (count >= goal) {
      cheer.textContent = '本週目標達成，你超棒的！🏆✨';
    } else if (hasWorkoutToday) {
      cheer.textContent = `今天已打卡！連續 ${s} 天，繼續保持 🔥`;
    } else if (hasStretchToday) {
      cheer.textContent = '今天做了伸展，很好的照顧自己 🧘 要不要再動一下？';
    } else if (s > 0) {
      cheer.textContent = `已連續 ${s} 天，今天動一下就不中斷囉 🔥`;
    } else if (count > 0) {
      cheer.textContent = `本週還差 ${goal - count} 天，找個喜歡的運動吧 🌱`;
    } else {
      cheer.textContent = '新的一週，從一個小小的開始就好 🌱';
    }

    renderWeekStrip();
    renderTodaySummary();
  }

  // 本週打卡點點（週一～週日）
  function renderWeekStrip() {
    const strip = document.getElementById('week-strip');
    strip.innerHTML = '';
    const ws = weekStart();
    const t = todayStr();
    const workoutDays = new Set(records.filter(isWorkout).map((r) => r.date));
    const recoverDays = new Set(
      records.filter((r) => !isWorkout(r)).map((r) => r.date)
    );
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    for (let i = 0; i < 7; i++) {
      const dateStr = addDays(ws, i);
      const item = document.createElement('div');
      item.className = 'strip-day';
      const dot = document.createElement('div');
      dot.className = 'strip-dot';
      if (workoutDays.has(dateStr)) {
        dot.classList.add('done');
        dot.textContent = '✓';
      } else if (recoverDays.has(dateStr)) {
        dot.classList.add('recover');
        dot.textContent = '🧘';
      }
      if (dateStr === t) dot.classList.add('today');
      if (dateStr > t) dot.classList.add('future');
      const label = document.createElement('span');
      label.textContent = labels[i];
      item.appendChild(dot);
      item.appendChild(label);
      strip.appendChild(item);
    }
  }

  // 今日狀態
  function renderTodaySummary() {
    const box = document.getElementById('today-summary');
    box.innerHTML = '';
    const todays = records.filter((r) => r.date === todayStr());
    if (todays.length === 0) {
      const p = document.createElement('p');
      p.className = 'today-empty';
      p.textContent = '今天還沒有紀錄，動一下吧！';
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = '＋ 記錄今天的運動';
      btn.addEventListener('click', () => openForm(null));
      box.appendChild(p);
      box.appendChild(btn);
      return;
    }
    const workouts = todays.filter(isWorkout);
    const stretches = todays.filter((r) => !isWorkout(r));
    const types = [...new Set(todays.flatMap((r) => r.types || []))];
    const emojis = document.createElement('p');
    emojis.className = 'today-emojis';
    emojis.textContent = types.map(emojiOf).join(' ') + ' 🎉';
    box.appendChild(emojis);
    if (workouts.length) {
      const p = document.createElement('p');
      p.className = 'today-done';
      const wTypes = [...new Set(workouts.flatMap((r) => r.types || []))]
        .filter((t) => !isRecoveryType(t));
      p.textContent =
        `運動 ${workouts.reduce((s, r) => s + r.minutes, 0)} 分鐘：${wTypes.join('、')}`;
      box.appendChild(p);
    }
    if (stretches.length) {
      const p = document.createElement('p');
      p.className = 'today-done today-recover';
      p.textContent = `伸展 ${stretches.reduce((s, r) => s + r.minutes, 0)} 分鐘 🧘`;
      box.appendChild(p);
    }
  }

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
      const heading = document.createElement('div');
      heading.className = 'date-heading';
      const dayTotal = items.reduce((s, r) => s + r.minutes, 0);
      const title = document.createElement('h3');
      title.textContent = dateLabel(date);
      const sub = document.createElement('span');
      sub.textContent = `共 ${dayTotal} 分鐘`;
      heading.appendChild(title);
      heading.appendChild(sub);
      group.appendChild(heading);

      for (const r of items) {
        const types = r.types || ['其他'];
        const meta = [`⏱️ ${r.minutes} 分`];
        if (r.distance) meta.push(`🗺️ ${r.distance} km`);
        if (r.calories) meta.push(`🔥 ${r.calories} 大卡`);
        if (r.intensity) meta.push(`${INTENSITY_EMOJI[r.intensity] || ''} ${r.intensity}`.trim());

        const card = document.createElement('div');
        card.className = 'record-card' + (isWorkout(r) ? '' : ' recover');
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
        card.querySelector('.record-emoji').textContent = emojiOf(types[0]);
        const typeEl = card.querySelector('.record-type');
        typeEl.textContent = types.join('、');
        if (!isWorkout(r)) {
          const tag = document.createElement('span');
          tag.className = 'tag-recover';
          tag.textContent = '恢復';
          typeEl.appendChild(tag);
        }
        const metaEl = card.querySelector('.record-meta');
        meta.forEach((m) => {
          const pill = document.createElement('span');
          pill.className = 'meta-pill';
          pill.textContent = m;
          metaEl.appendChild(pill);
        });
        if (r.note) {
          const noteEl = card.querySelector('.record-note');
          noteEl.textContent = r.note;
          noteEl.classList.remove('hidden');
        }
        card.querySelector('[data-act="edit"]').addEventListener('click', () => openForm(r));
        card.querySelector('[data-act="del"]').addEventListener('click', () => {
          if (confirm(`確定要刪除這筆「${types.join('、')}」紀錄嗎？`)) {
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
    renderHome();
  }

  /* ---------- 表單 ---------- */
  const modal = document.getElementById('modal');
  const form = document.getElementById('record-form');
  const formTitle = document.getElementById('form-title');
  let editingId = null;

  const typePicker = document.getElementById('type-picker');
  [
    { label: '運動（計入目標與連續天數）', cat: 'main' },
    { label: '伸展・恢復（單獨統計，不算次數）', cat: 'recover' },
  ].forEach((g) => {
    const groupLabel = document.createElement('div');
    groupLabel.className = 'type-group-label';
    groupLabel.textContent = g.label;
    typePicker.appendChild(groupLabel);
    const row = document.createElement('div');
    row.className = 'type-group';
    SPORT_TYPES.filter((t) => t.cat === g.cat).forEach((t) => {
      const chip = document.createElement('label');
      chip.className = 'type-chip';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.value = t.name;
      const text = document.createElement('span');
      text.textContent = `${t.emoji} ${t.name}`;
      chip.appendChild(box);
      chip.appendChild(text);
      row.appendChild(chip);
    });
    typePicker.appendChild(row);
  });
  const typeBoxes = () => [...typePicker.querySelectorAll('input[type="checkbox"]')];

  function openForm(record) {
    editingId = record ? record.id : null;
    formTitle.textContent = record ? '✏️ 編輯紀錄' : '✨ 新增紀錄';
    form.reset();
    form.elements.date.value = record ? record.date : todayStr();
    const selected = record ? record.types || [] : [];
    typeBoxes().forEach((box) => {
      box.checked = selected.includes(box.value);
    });
    if (record) {
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
    const types = typeBoxes().filter((b) => b.checked).map((b) => b.value);
    if (types.length === 0) {
      toast('請至少勾選一種運動類型 🙏');
      return;
    }
    const data = {
      date: f.date.value,
      types,
      minutes: Number(f.minutes.value),
      distance: f.distance.value ? Number(f.distance.value) : null,
      calories: f.calories.value ? Number(f.calories.value) : null,
      intensity: f.intensity.value,
      note: f.note.value.trim(),
    };
    if (editingId !== null) {
      const idx = records.findIndex((r) => r.id === editingId);
      if (idx >= 0) records[idx] = { ...records[idx], ...data };
      toast('已更新 ✅');
    } else {
      const before = weekCount();
      records.push({ id: Date.now(), ...data });
      const goal = loadGoal();
      if (before < goal && weekCount() >= goal) {
        toast('🎉 本週目標達成！你太強了！🏆');
      } else {
        toast(praise());
      }
    }
    save();
    closeForm();
    renderList();
    // 從統計頁的日期明細開啟編輯時，儲存後即時更新統計畫面
    if (document.getElementById('page-stats').classList.contains('active')) {
      renderStats();
    }
  });

  /* ---------- 統計 ---------- */
  function renderStats() {
    const ws = weekStart();
    const weekRecords = records.filter(
      (r) => isWorkout(r) && r.date >= ws && r.date <= todayStr()
    );
    document.getElementById('stat-week-count').textContent = new Set(
      weekRecords.map((r) => r.date)
    ).size;
    document.getElementById('stat-week-minutes').textContent =
      weekRecords.reduce((s, r) => s + r.minutes, 0);
    document.getElementById('stat-week-distance').textContent =
      Math.round(weekRecords.reduce((s, r) => s + (r.distance || 0), 0) * 10) / 10;
    document.getElementById('stat-streak').textContent = streak();

    renderWeekChart();
    renderTypeChart();
    renderCalendar();
    renderCalDetail();
    renderBadges();
  }

  /* ---- 打卡月曆 ---- */
  let calMonth = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  })();

  function renderCalendar() {
    const cal = document.getElementById('calendar');
    cal.innerHTML = '';
    document.getElementById('cal-title').textContent =
      `📅 ${calMonth.getFullYear()} 年 ${calMonth.getMonth() + 1} 月`;

    const workoutDays = new Set(records.filter(isWorkout).map((r) => r.date));
    const recoverDays = new Set(
      records.filter((r) => !isWorkout(r)).map((r) => r.date)
    );
    const t = todayStr();

    ['一', '二', '三', '四', '五', '六', '日'].forEach((w) => {
      const head = document.createElement('div');
      head.className = 'cal-weekday';
      head.textContent = w;
      cal.appendChild(head);
    });

    const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // 週一開頭
    for (let i = 0; i < offset; i++) {
      cal.appendChild(document.createElement('div'));
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = fmtDate(new Date(calMonth.getFullYear(), calMonth.getMonth(), day));
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = day;
      if (workoutDays.has(dateStr)) cell.classList.add('workout');
      else if (recoverDays.has(dateStr)) cell.classList.add('recover');
      if (dateStr === t) cell.classList.add('today');
      if (dateStr > t) cell.classList.add('future');
      if (dateStr === selectedDate) cell.classList.add('selected');
      cell.addEventListener('click', () => {
        selectedDate = dateStr;
        renderCalendar();
        renderCalDetail();
      });
      cal.appendChild(cell);
    }
  }

  /* ---- 點日期看當天紀錄 ---- */
  let selectedDate = todayStr();

  function renderCalDetail() {
    const box = document.getElementById('cal-detail');
    box.innerHTML = '';
    if (!selectedDate) return;

    const title = document.createElement('h3');
    title.textContent = `${dateLabel(selectedDate)} 的紀錄`;
    box.appendChild(title);

    const items = records
      .filter((r) => r.date === selectedDate)
      .sort((a, b) => b.id - a.id);

    if (items.length === 0) {
      const p = document.createElement('p');
      p.className = 'cal-empty';
      p.textContent = '這天沒有紀錄 🌙';
      box.appendChild(p);
      return;
    }

    for (const r of items) {
      const types = r.types || ['其他'];
      const meta = [`⏱️ ${r.minutes} 分`];
      if (r.distance) meta.push(`🗺️ ${r.distance} km`);
      if (r.calories) meta.push(`🔥 ${r.calories} 大卡`);
      if (r.intensity) meta.push(`${INTENSITY_EMOJI[r.intensity] || ''} ${r.intensity}`.trim());

      const card = document.createElement('div');
      card.className = 'mini-record';
      card.innerHTML = `
        <span class="mini-emoji"></span>
        <div class="mini-main">
          <div class="mini-type"></div>
          <div class="mini-meta"></div>
          <div class="mini-note hidden"></div>
        </div>
        <button class="icon-btn" aria-label="編輯">✏️</button>`;
      card.querySelector('.mini-emoji').textContent = emojiOf(types[0]);
      const typeEl = card.querySelector('.mini-type');
      typeEl.textContent = types.join('、');
      if (!isWorkout(r)) {
        const tag = document.createElement('span');
        tag.className = 'tag-recover';
        tag.textContent = '恢復';
        typeEl.appendChild(tag);
      }
      card.querySelector('.mini-meta').textContent = meta.join(' · ');
      if (r.note) {
        const noteEl = card.querySelector('.mini-note');
        noteEl.textContent = r.note;
        noteEl.classList.remove('hidden');
      }
      card.querySelector('button').addEventListener('click', () => openForm(r));
      box.appendChild(card);
    }
  }

  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  /* ---- 成就徽章 ---- */
  const BADGES = [
    { emoji: '🐣', name: '第一步', desc: '完成第 1 筆紀錄', earned: (s) => s.totalDays >= 1 },
    { emoji: '🔥', name: '連續 3 天', desc: '連續運動 3 天', earned: (s) => s.maxStreak >= 3 },
    { emoji: '⚡', name: '連續 7 天', desc: '連續運動 7 天', earned: (s) => s.maxStreak >= 7 },
    { emoji: '🌈', name: '連續 14 天', desc: '連續運動 14 天', earned: (s) => s.maxStreak >= 14 },
    { emoji: '🏅', name: '累積 10 天', desc: '累積運動 10 天', earned: (s) => s.totalDays >= 10 },
    { emoji: '💎', name: '累積 50 天', desc: '累積運動 50 天', earned: (s) => s.totalDays >= 50 },
    { emoji: '⏰', name: '500 分鐘', desc: '累積運動 500 分鐘', earned: (s) => s.totalMinutes >= 500 },
    { emoji: '👑', name: '2000 分鐘', desc: '累積運動 2000 分鐘', earned: (s) => s.totalMinutes >= 2000 },
  ];

  function maxStreak() {
    const days = [...new Set(records.filter(isWorkout).map((r) => r.date))].sort();
    let best = 0;
    let run = 0;
    let prev = null;
    for (const d of days) {
      run = prev && addDays(prev, 1) === d ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    return best;
  }

  function renderBadges() {
    const workouts = records.filter(isWorkout);
    const stats = {
      totalDays: new Set(workouts.map((r) => r.date)).size,
      totalMinutes: workouts.reduce((s, r) => s + r.minutes, 0),
      maxStreak: maxStreak(),
    };
    const box = document.getElementById('badges');
    box.innerHTML = '';
    BADGES.forEach((b) => {
      const earned = b.earned(stats);
      const tile = document.createElement('div');
      tile.className = 'badge' + (earned ? '' : ' locked');
      tile.title = b.desc;
      tile.innerHTML = '<span class="badge-emoji"></span><span class="badge-name"></span>';
      tile.querySelector('.badge-emoji').textContent = earned ? b.emoji : '🔒';
      tile.querySelector('.badge-name').textContent = b.name;
      box.appendChild(tile);
    });
  }

  // 連續運動天數（含今天或到昨天為止；只算運動，不含純拉伸）
  function streak() {
    const days = new Set(records.filter(isWorkout).map((r) => r.date));
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
        .filter((r) => isWorkout(r) && r.date === date)
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
      .forEach((r) =>
        (r.types || []).forEach((t) => totals.set(t, (totals.get(t) || 0) + r.minutes))
      );
    const items = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, minutes]) => ({
        label: type,
        value: minutes,
        tooltip: `${type}：${minutes} 分鐘`,
      }));
    if (items.length === 0) {
      container.innerHTML = '<p class="chart-empty">🌱 最近 30 天還沒有紀錄</p>';
      return;
    }
    drawBarChart(container, items);
  }

  /* 單一系列直向長條圖（SVG，含 hover 提示） */
  function drawBarChart(container, items) {
    container.innerHTML = '';
    if (items.every((it) => it.value === 0)) {
      container.innerHTML = '<p class="chart-empty">🌱 這段期間還沒有紀錄</p>';
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
        (r) =>
          r &&
          typeof r.date === 'string' &&
          (typeof r.type === 'string' || Array.isArray(r.types)) &&
          r.minutes > 0
      );
      const existing = new Set(records.map((r) => r.id));
      let added = 0;
      valid.forEach((r) => {
        if (!existing.has(r.id)) {
          const types =
            Array.isArray(r.types) && r.types.length ? r.types : r.type ? [r.type] : ['其他'];
          records.push({ ...r, types, id: r.id ?? Date.now() + added });
          added++;
        }
      });
      save();
      renderList();
      toast(`已匯入 ${added} 筆紀錄 🎒`);
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

  /* ---------- 每週目標設定 ---------- */
  const goalInput = document.getElementById('goal-input');
  goalInput.value = loadGoal();
  document.getElementById('btn-save-goal').addEventListener('click', () => {
    const n = Number(goalInput.value);
    if (!(n >= 1 && n <= 7)) {
      toast('目標請設定 1～7 天 🙏');
      return;
    }
    saveGoal(n);
    renderHome();
    toast('目標已更新 🎯 加油！');
  });

  /* ---------- 初始化 ---------- */
  document.getElementById('today-label').textContent = dateLabel(todayStr());
  renderList();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // 新版 Service Worker 接手時自動重新載入，讓使用者拿到最新版
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  }
})();
