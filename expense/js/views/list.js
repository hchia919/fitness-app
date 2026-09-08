/* ── 交易列表：搜尋 + 篩選 ─────────────────────────── */
var TxList = (function () {
  var f = { keyword: '', type: '', categoryIds: [], paymentIds: [], from: '', to: '', min: '', max: '' };
  var showFilter = false;

  function setFilter(patch) { Object.assign(f, patch); }
  function reset() {
    f = { keyword: '', type: '', categoryIds: [], paymentIds: [], from: '', to: '', min: '', max: '' };
  }
  function activeCount() {
    var n = 0;
    if (f.type) n++;
    if (f.categoryIds.length) n++;
    if (f.paymentIds.length) n++;
    if (f.from || f.to) n++;
    if (f.min !== '' || f.max !== '') n++;
    return n;
  }

  function render() {
    var rows = Q.search(f);
    var exp = 0, inc = 0;
    rows.forEach(function (t) { if (t.type === 'income') inc += t.amount; else exp += t.amount; });
    var n = activeCount();
    var h = '';

    h += '<div class="searchbar">' +
      '<span>🔍</span>' +
      '<input data-keep="search" data-search placeholder="搜尋備註、類別、金額…" value="' + U.esc(f.keyword) + '">' +
      (f.keyword ? '<button class="iconbtn" style="width:26px;height:26px;font-size:12px" data-act="list-clear-kw">✕</button>' : '') +
      '<button class="chip ' + (n ? 'on' : '') + '" data-act="list-toggle-filter">篩選' + (n ? ' ' + n : '') + '</button>' +
      '</div>';

    if (showFilter) h += filterPanel();

    h += '<div class="card tight" style="display:flex;gap:14px;align-items:center">' +
      '<div style="flex:1"><div class="label">支出</div><div class="m-md money num">' + U.money(exp) + '</div></div>' +
      '<div style="flex:1"><div class="label">收入</div><div class="m-md money num pos">' + U.money(inc) + '</div></div>' +
      '<div style="flex:1"><div class="label">筆數</div><div class="m-md money num">' + rows.length + '</div></div>' +
      '</div>';

    if (!rows.length) {
      h += '<div class="card">' + UI.empty(f.keyword || n ? '找不到符合的紀錄' : '還沒有任何紀錄',
        f.keyword || n ? '換個關鍵字或清掉篩選條件看看' : '按下方 ＋ 開始記帳吧') +
        (n || f.keyword ? '<button class="btn block" data-act="list-reset">清除條件</button>' : '') + '</div>';
      return h;
    }

    Q.groupByDay(rows).forEach(function (g) {
      h += '<div class="daygroup"><div class="dh"><span>' + U.fmtDayHeader(g.date) + '</span>' +
        '<span class="num">' + (g.income ? '+' + U.money(g.income) + '　' : '') + (g.expense ? '−' + U.money(g.expense) : '') + '</span></div>' +
        '<div class="card" style="padding:6px 14px">' + g.items.map(Home.txRow).join('') + '</div></div>';
    });
    return h;
  }

  function filterPanel() {
    var h = '<div class="filterpanel">';
    h += '<div class="field"><span class="label">收支</span><div class="chips">' +
      [['', '全部'], ['expense', '支出'], ['income', '收入']].map(function (x) {
        return '<button class="chip ' + (f.type === x[0] ? 'on' : '') + '" data-act="f-type" data-k="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</div></div>';

    h += '<div class="field"><span class="label">日期</span><div class="chips">' +
      [['', '不限'], ['7', '近 7 天'], ['30', '近 30 天'], ['m', '本月'], ['lm', '上個月']].map(function (x) {
        return '<button class="chip" data-act="f-dpreset" data-k="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="row2" style="margin-top:8px">' +
      '<input class="input" type="date" data-act="f-from" data-f="from" value="' + f.from + '">' +
      '<input class="input" type="date" data-act="f-to" data-f="to" value="' + f.to + '">' +
      '</div></div>';

    h += '<div class="field"><span class="label">金額範圍</span><div class="row2">' +
      '<input class="input num" data-f="min" data-keep="fmin" type="number" inputmode="decimal" placeholder="最低" value="' + f.min + '">' +
      '<input class="input num" data-f="max" data-keep="fmax" type="number" inputmode="decimal" placeholder="最高" value="' + f.max + '">' +
      '</div></div>';

    h += '<div class="field"><span class="label">類別（可多選）</span><div class="chips" style="flex-wrap:wrap;overflow:visible">' +
      Repo.cats({ withArchived: true }).map(function (c) {
        return '<button class="chip ' + (f.categoryIds.indexOf(c.id) >= 0 ? 'on' : '') + '" data-act="f-cat" data-k="' + c.id + '">' + c.emoji + ' ' + U.esc(c.name) + '</button>';
      }).join('') + '</div></div>';

    h += '<div class="field"><span class="label">付款方式（可多選）</span><div class="chips" style="flex-wrap:wrap;overflow:visible">' +
      Repo.pays(true).map(function (p) {
        return '<button class="chip ' + (f.paymentIds.indexOf(p.id) >= 0 ? 'on' : '') + '" data-act="f-pay" data-k="' + p.id + '">' + p.emoji + ' ' + U.esc(p.name) + '</button>';
      }).join('') + '</div></div>';

    h += '<button class="btn block" data-act="list-reset">清除全部條件</button></div>';
    return h;
  }

  /* 事件（由 app.js 的委派轉進來） */
  function handle(act, key, target) {
    var s = Repo.settings();
    if (act === 'list-toggle-filter') { showFilter = !showFilter; return true; }
    if (act === 'list-clear-kw') { f.keyword = ''; return true; }
    if (act === 'list-reset') { reset(); return true; }
    if (act === 'f-type') { f.type = key; return true; }
    if (act === 'f-cat') { toggle(f.categoryIds, key); return true; }
    if (act === 'f-pay') { toggle(f.paymentIds, key); return true; }
    if (act === 'f-dpreset') {
      if (!key) { f.from = ''; f.to = ''; }
      else if (key === '7') { f.from = U.addDays(U.today(), -6); f.to = U.today(); }
      else if (key === '30') { f.from = U.addDays(U.today(), -29); f.to = U.today(); }
      else if (key === 'm') { var p = U.period('month', 0, s); f.from = p.from; f.to = p.to; }
      else if (key === 'lm') { var q = U.period('month', -1, s); f.from = q.from; f.to = q.to; }
      return true;
    }
    return false;
  }
  function toggle(arr, v) {
    var i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1); else arr.push(v);
  }

  function bindInputs(root) {
    var si = root.querySelector('[data-search]');
    if (si) {
      si.oninput = U.debounce(function () { f.keyword = si.value; App.rerender(); }, 220);
    }
    root.querySelectorAll('[data-f]').forEach(function (el) {
      el.oninput = U.debounce(function () { f[el.dataset.f] = el.value; App.rerender(); }, 260);
      if (el.type === 'date') el.onchange = function () { f[el.dataset.f] = el.value; App.rerender(); };
    });
  }

  function topbar() {
    return '<div><h1>所有紀錄 🧾</h1><div class="sub">搜尋、篩選、隨時修改</div></div>' +
      '<div class="spacer"></div><button class="iconbtn" data-act="go-home">🏠</button>';
  }

  return { render: render, topbar: topbar, handle: handle, bindInputs: bindInputs, setFilter: setFilter, reset: reset };
})();
