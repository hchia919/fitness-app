/* ── 單一類別明細（從統計頁點類別進來） ─────────────────── */
var CatDetail = (function () {
  var curId = null;

  function setId(id) { curId = id; }
  function id() { return curId; }

  function render() {
    var s = Repo.settings();
    var st = Stats.getState();
    var p = U.period(st.kind, st.offset, s);
    var c = Repo.cat(curId);
    var items = Q.list(p, null).filter(function (t) { return t.categoryId === curId; });
    var total = Q.sum(items);
    var prevP = U.period(st.kind, st.offset - 1, s);
    var prevTotal = Q.sum(Q.list(prevP, null).filter(function (t) { return t.categoryId === curId; }));
    var diff = total - prevTotal;
    var all = Q.totals(p);
    var share = U.pct(total, c.type === 'income' ? all.income : all.expense);
    var h = '';

    h += '<div class="seg" style="margin-bottom:9px">' +
      [['week', '本週'], ['month', '本月'], ['quarter', '本季'], ['year', '今年']].map(function (x) {
        return '<button data-act="stats-kind" data-k="' + x[0] + '" class="' + (st.kind === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
      }).join('') + '</div>';

    h += '<div class="periodbar">' +
      '<button class="nav" data-act="stats-prev">‹</button>' +
      '<div class="now">' + p.label + '</div>' +
      '<button class="nav" data-act="stats-next" ' + (st.offset >= 0 ? 'disabled' : '') + '>›</button></div>';

    h += '<div class="card">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
      '<div class="ava" style="width:52px;height:52px;border-radius:17px;display:grid;place-items:center;font-size:26px;background:' + U.tint(c.color, .16) + '">' + c.emoji + '</div>' +
      '<div style="flex:1"><div class="label">' + p.shortLabel + ' · ' + U.esc(c.name) + '</div>' +
      '<div class="m-lg money num">' + U.money(total) + '</div></div>' +
      '<div style="text-align:right"><div class="label">佔比</div><div class="m-md money num">' + share + '%</div></div>' +
      '</div>' +
      '<div class="cmp" style="margin-top:12px">' +
      (prevTotal > 0
        ? '<span class="tag ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat') + '">比' + Insights.prevWord(st.kind) +
          (diff > 0 ? '多 ' : diff < 0 ? '少 ' : '持平 ') + U.money(Math.abs(diff)) + '</span>'
        : '<span class="tag flat">' + Insights.prevWord(st.kind) + '沒有紀錄</span>') +
      '<span class="tiny faint">' + items.length + ' 筆　·　平均每筆 ' + U.money(items.length ? total / items.length : 0) + '</span>' +
      '</div></div>';

    /* 該類別在期間內的分佈 */
    var series = (function () {
      var base = Q.barSeries(p, null);
      var out = base.map(function (b) { return { key: b.key, label: b.label, value: 0 }; });
      items.forEach(function (t) {
        for (var i = out.length - 1; i >= 0; i--) {
          if (t.date >= out[i].key) { out[i].value += t.amount; break; }
        }
      });
      return out;
    })();
    h += '<div class="card"><div class="card-h"><span>📊</span><span class="t">分佈</span></div>' +
      Charts.bars(series, { height: 88, color: c.color }) + '</div>';

    /* 備註排行（例如搜尋「星巴克」的效果） */
    var byNote = {};
    items.forEach(function (t) {
      var k = (t.note || '（未填備註）').trim();
      if (!byNote[k]) byNote[k] = { name: k, amount: 0, count: 0 };
      byNote[k].amount += t.amount; byNote[k].count++;
    });
    var noteRows = Object.keys(byNote).map(function (k) { return byNote[k]; })
      .sort(function (a, b) { return b.amount - a.amount; }).slice(0, 6);
    if (noteRows.length > 1) {
      h += '<div class="card"><div class="card-h"><span>🏷</span><span class="t">花在哪些地方</span></div>' +
        noteRows.map(function (r) {
          var pc = U.pct(r.amount, total);
          return '<div class="budget-row"><div class="top">' +
            '<span class="n">' + U.esc(r.name) + '<span class="tiny faint">　' + r.count + ' 次</span></span>' +
            '<span class="v num">' + U.money(r.amount) + '</span></div>' +
            '<div class="bar thin"><i style="width:' + pc + '%;background:' + c.color + '"></i></div></div>';
        }).join('') + '</div>';
    }

    /* 明細 */
    h += '<div class="card-h" style="margin:16px 2px 4px"><span>🧾</span><span class="t">明細</span>' +
      '<span class="spacer"></span><button class="more" data-act="cat-search" data-id="' + curId + '">在全部紀錄中搜尋 ›</button></div>';
    if (!items.length) {
      h += '<div class="card">' + UI.empty('這段期間沒有 ' + c.name + ' 的紀錄', '換個期間看看 🗓', false) + '</div>';
    } else {
      Q.groupByDay(items).forEach(function (g) {
        h += '<div class="daygroup"><div class="dh"><span>' + U.fmtDayHeader(g.date) + '</span>' +
          '<span class="num">' + U.money(g.expense + g.income) + '</span></div>' +
          '<div class="card" style="padding:6px 14px">' + g.items.map(Home.txRow).join('') + '</div></div>';
      });
    }
    return h;
  }

  function topbar() {
    var c = Repo.cat(curId);
    return '<button class="iconbtn" data-act="back">‹</button>' +
      '<div><h1>' + c.emoji + ' ' + U.esc(c.name) + '</h1><div class="sub">類別明細</div></div>';
  }

  return { render: render, topbar: topbar, setId: setId, id: id };
})();
