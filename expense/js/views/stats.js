/* ── 統計：本週／本月／本季／今年自由切換 ──────────────── */
var Stats = (function () {
  var state = { kind: 'month', offset: 0, type: 'expense' };

  function cur() { return U.period(state.kind, state.offset, Repo.settings()); }
  function getState() { return state; }
  function setKind(k) { state.kind = k; state.offset = 0; }

  function render() {
    var s = Repo.settings();
    var p = cur();
    var t = Q.totals(p);
    var c = Insights.compare(p, s);
    var amount = state.type === 'income' ? t.income : t.expense;
    var prevAmount = state.type === 'income' ? c.prev.income : c.prev.expense;
    var diff = amount - prevAmount;
    var h = '';

    /* 期間切換 */
    h += '<div class="seg" style="margin-bottom:9px">' +
      [['week', '本週'], ['month', '本月'], ['quarter', '本季'], ['year', '今年']].map(function (x) {
        return '<button data-act="stats-kind" data-k="' + x[0] + '" class="' + (state.kind === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
      }).join('') + '</div>';

    h += '<div class="periodbar">' +
      '<button class="nav" data-act="stats-prev">‹</button>' +
      '<div class="now">' + p.label + (state.offset === 0 ? '' : '') + '</div>' +
      '<button class="nav" data-act="stats-next" ' + (state.offset >= 0 ? 'disabled' : '') + '>›</button>' +
      '</div>';

    /* 總額 + 比較 */
    h += '<div class="card">' +
      '<div class="seg" style="margin-bottom:12px">' +
      '<button data-act="stats-type" data-k="expense" class="' + (state.type === 'expense' ? 'on' : '') + '">支出</button>' +
      '<button data-act="stats-type" data-k="income" class="' + (state.type === 'income' ? 'on' : '') + '">收入</button>' +
      '</div>' +
      '<div class="label">' + p.shortLabel + (state.type === 'income' ? '收入' : '花費') + '</div>' +
      '<div class="cmp" style="margin-top:2px">' +
      '<div class="m-xl money num">' + U.money(amount) + '</div>' +
      (prevAmount > 0
        ? '<span class="tag ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat') + '">' +
          (diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : '＝ ') + U.money(Math.abs(diff)) +
          (prevAmount ? '（' + (diff > 0 ? '+' : '') + Math.round(diff / prevAmount * 100) + '%）' : '') + '</span>'
        : '') +
      '</div>' +
      (prevAmount > 0 ? '<div class="tiny faint" style="margin-top:4px">' + Insights.prevWord(state.kind) + '：' + U.money(prevAmount) + '</div>' : '') +
      '<div style="margin-top:14px">' +
      '<div class="label" style="margin-bottom:7px">' + (state.kind === 'week' ? '每日' : state.kind === 'month' ? '每週' : '每月') + (state.type === 'income' ? '收入' : '支出') + '</div>' +
      Charts.bars(Q.barSeries(p, state.type), { height: 96, color: state.type === 'income' ? 'var(--mint)' : 'var(--primary)' }) +
      '</div></div>';

    /* 甜甜圈 + 圖例 */
    var bc = Q.byCategory(p, state.type);
    h += '<div class="card"><div class="card-h"><span>🍩</span><span class="t">類別佔比</span></div>';
    if (!bc.rows.length) {
      h += UI.empty('這段期間還沒有紀錄', '換個期間看看，或按 ＋ 記一筆', false);
    } else {
      var top = bc.rows.slice(0, 6);
      var rest = bc.rows.slice(6);
      var legendRows = top.slice();
      if (rest.length) {
        legendRows.push({
          categoryId: '__rest', name: '其他 ' + rest.length + ' 類', color: '#CFCACA',
          amount: rest.reduce(function (a, x) { return a + x.amount; }, 0),
          pct: rest.reduce(function (a, x) { return a + x.pct; }, 0)
        });
      }
      h += '<div class="donutwrap">' +
        '<div class="donutpos">' + Charts.donut(legendRows, {
          size: 132, stroke: 21,
          center: '<div class="a num">' + U.shortMoney(bc.total) + '</div><div class="l">' + p.shortLabel + '</div>'
        }) + '</div>' +
        '<div class="legend">' + legendRows.map(function (r) {
          return '<button class="leg"' + (r.categoryId !== '__rest' ? ' data-act="go-cat" data-id="' + r.categoryId + '"' : '') + '>' +
            '<span class="dot" style="background:' + r.color + '"></span>' +
            '<span class="n">' + U.esc(r.name) + '</span>' +
            '<span class="p">' + r.pct.toFixed(0) + '%</span></button>';
        }).join('') + '</div></div>';
    }
    h += '</div>';

    /* 類別排行 */
    if (bc.rows.length) {
      var prevRows = Q.byCategory(U.period(state.kind, state.offset - 1, s), state.type).rows;
      var pm = {}; prevRows.forEach(function (x) { pm[x.categoryId] = x.amount; });
      h += '<div class="card"><div class="card-h"><span>🏆</span><span class="t">類別排行</span><span class="spacer"></span><span class="more">點擊看明細</span></div>' +
        bc.rows.map(function (r, i) {
          var d = r.amount - (pm[r.categoryId] || 0);
          return '<button class="rank" data-act="go-cat" data-id="' + r.categoryId + '">' +
            '<span class="ava" style="background:' + U.tint(r.color, .16) + '">' + r.emoji + '</span>' +
            '<span class="mid"><span class="n">' + (i < 3 ? ['🥇', '🥈', '🥉'][i] + ' ' : '') + U.esc(r.name) + '</span>' +
            '<span class="pct">' + r.pct.toFixed(0) + '%　·　' + r.count + ' 筆</span></span>' +
            '<span class="right"><span class="amt num" style="display:block">' + U.money(r.amount) + '</span>' +
            (pm[r.categoryId] != null && d !== 0
              ? '<span class="delta ' + (d > 0 ? 'trend-up' : 'trend-down') + '">' + (d > 0 ? '▲' : '▼') + U.shortMoney(d) + '</span>'
              : (prevRows.length && pm[r.categoryId] == null ? '<span class="delta faint">新增</span>' : '')) +
            '</span></button>';
        }).join('') +
        '<div class="bar thin" style="margin-top:12px;display:flex;background:transparent;gap:2px">' +
        bc.rows.map(function (r) {
          return '<i style="width:' + r.pct + '%;background:' + r.color + '"></i>';
        }).join('') + '</div></div>';
    }

    /* 洞察 */
    var ins = Insights.forPeriod(p, s);
    if (ins.length && state.type === 'expense') {
      h += '<div class="card"><div class="card-h"><span>🔍</span><span class="t">這段期間的觀察</span></div>' +
        ins.map(function (m) { return '<div class="insight"><span class="e">' + m.e + '</span><span>' + m.html + '</span></div>'; }).join('') +
        '</div>';
    }

    /* 月支出趨勢（近 6 個月） */
    var tr = Q.monthlyTrend(6, s);
    h += '<div class="card"><div class="card-h"><span>📉</span><span class="t">近 6 個月支出趨勢</span></div>' +
      Charts.bars(tr, { height: 92, color: 'var(--lav)', highlightKey: U.period('month', 0, s).from }) + '</div>';

    /* 付款方式 */
    var bp = Q.byPayment(p, state.type);
    if (bp.length) {
      var ptotal = bp.reduce(function (a, x) { return a + x.amount; }, 0);
      h += '<div class="card"><div class="card-h"><span>💳</span><span class="t">付款方式</span></div>' +
        bp.map(function (r) {
          var pc = U.pct(r.amount, ptotal);
          return '<div class="budget-row"><div class="top"><span>' + r.emoji + '</span>' +
            '<span class="n">' + U.esc(r.name) + '</span>' +
            '<span class="v num">' + U.money(r.amount) + '　' + pc + '%</span></div>' +
            '<div class="bar thin"><i style="width:' + pc + '%;background:var(--blue)"></i></div></div>';
        }).join('') + '</div>';
    }

    return h;
  }

  function topbar() {
    return '<div><h1>統計分析 📊</h1><div class="sub">看清楚錢花去哪裡</div></div>' +
      '<div class="spacer"></div><button class="iconbtn" data-act="go-list">🔍</button>';
  }

  return { render: render, topbar: topbar, getState: getState, setKind: setKind, cur: cur, state: state };
})();
