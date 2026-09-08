/* ── 首頁：一打開就知道「這個月花多少、今天還能花多少」 ──── */
var Home = (function () {

  function render() {
    var s = Repo.settings();
    var mp = U.period('month', 0, s);
    var wp = U.period('week', 0, s);
    var t = Q.totals(mp);
    var bkey = Insights.budgetKey(mp);
    var b = Repo.budgetFor(bkey);
    var todayExp = Q.dayTotal(U.today(), 'expense');
    var weekExp = Q.totals(wp).expense;
    var line = Insights.homeLine(s);
    var h = '';

    /* ── 主卡：本月總覽 ── */
    var hasBudget = b.exists && b.total > 0;
    var leftLabel = hasBudget ? '預算剩餘' : '本月結餘';
    var leftVal = hasBudget ? (b.total - t.expense) : t.net;
    var usedPct = hasBudget ? U.pct(t.expense, b.total) : 0;

    h += '<div class="hero">' +
      '<div class="hero-row">' +
      '<div><div class="label">' + mp.label + ' 總支出</div>' +
      '<div class="m-xl num money">' + U.money(t.expense) + '</div></div>' +
      (hasBudget ? '<div class="hero-ring">' + Charts.ring(usedPct, { size: 62, stroke: 7 }) + '</div>' : '') +
      '</div>' +
      '<div class="hero-foot">' +
      '<div><div class="label">本月收入</div><div class="v num">' + U.money(t.income) + '</div></div>' +
      '<div><div class="label">' + leftLabel + '</div><div class="v num">' + U.money(leftVal, { signed: leftVal < 0 }) + '</div></div>' +
      '</div>' +
      '<div class="hero-note"><span>' + line.e + '</span><span>' + U.esc(line.text) + '</span></div>' +
      '</div>';

    /* ── 到期的固定支出（可一鍵補上） ── */
    var dues = Repo.dueList();
    if (dues.length) {
      var d = dues[0];
      var dc = Repo.cat(d.categoryId);
      h += '<div class="due">' +
        '<div class="top"><div class="tx-ava ava" style="width:40px;height:40px;border-radius:13px;display:grid;place-items:center;font-size:19px;background:' + U.tint(dc.color, .16) + '">' + dc.emoji + '</div>' +
        '<div style="flex:1"><div class="b">' + U.esc(d.name) + ' 該扣款了</div>' +
        '<div class="tiny faint">' + U.fmtDayHeader(d.nextDueDate) + ' · ' + Repo.freqLabel(d) + (dues.length > 1 ? ' · 還有 ' + (dues.length - 1) + ' 筆待確認' : '') + '</div></div>' +
        '<div class="money m-md">' + U.money(d.amount) + '</div></div>' +
        '<div class="acts">' +
        '<button class="btn sm primary" data-act="due-ok" data-id="' + d.id + '">✅ 記一筆</button>' +
        '<button class="btn sm" data-act="due-edit" data-id="' + d.id + '">✏️ 改金額</button>' +
        '<button class="btn sm ghost" style="background:var(--bg-soft)" data-act="due-skip" data-id="' + d.id + '">⏭ 跳過</button>' +
        '</div></div>';
    }

    /* ── 今天還能花多少（最能改變行為的數字） ── */
    var al = Insights.dailyAllowance(mp);
    if (al) {
      var ok = al.todayLeft >= 0;
      h += '<div class="allow">' +
        '<div class="e">' + (ok ? '🪙' : '🫣') + '</div>' +
        '<div style="flex:1"><div class="n">今天還能花</div>' +
        '<div class="v num" style="color:' + (ok ? 'var(--mint)' : 'var(--primary-2)') + '">' + U.moneyR(al.todayLeft) + '</div>' +
        '<div class="s">預算剩 ' + U.moneyR(al.left) + '，還有 ' + al.daysLeft + ' 天' +
        (al.spentToday ? '　·　今天已花 ' + U.money(al.spentToday) : '') + '</div></div></div>';
    } else if (!b.exists) {
      h += '<button class="card tight" data-act="go-budget" style="display:flex;align-items:center;gap:11px;width:100%;text-align:left">' +
        '<span style="font-size:22px">🎯</span>' +
        '<span style="flex:1"><span class="b" style="display:block;font-size:14px">設定每月預算</span>' +
        '<span class="tiny faint">設好之後首頁會告訴你「今天還能花多少」</span></span>' +
        '<span class="faint">›</span></button>';
    }

    /* ── 今日 / 本週 ── */
    h += '<div class="grid2" style="margin-bottom:12px">' +
      '<div class="card"><div class="label">今日支出</div>' +
      '<div class="m-lg money num" style="margin-top:2px">' + U.money(todayExp) + '</div>' +
      '<div class="tiny faint" style="margin-top:2px">' + (todayExp ? Q.list({ from: U.today(), to: U.today() }, 'expense').length + ' 筆' : '還沒有紀錄') + '</div></div>' +
      '<div class="card"><div class="label">本週支出</div>' +
      '<div class="m-lg money num" style="margin-top:2px">' + U.money(weekExp) + '</div>' +
      '<div class="tiny faint" style="margin-top:2px">' + wp.label + '</div></div>' +
      '</div>';

    /* ── 本月支出趨勢 ── */
    var cum = Q.cumulative(mp, 'expense');
    h += '<div class="card"><div class="card-h"><span>📈</span><span class="t">本月累積趨勢</span><span class="spacer"></span>' +
      '<span class="more" data-act="go-stats">統計 ›</span></div>' +
      Charts.line(cum, { height: 74, color: 'var(--primary)' }) + '</div>';

    /* ── 預算進度 ── */
    if (b.exists) {
      h += budgetCard(mp, b, t);
    }

    /* ── 預算提醒 ── */
    var msgs = Insights.budgetMessages(mp);
    if (msgs.length) {
      h += '<div class="card"><div class="card-h"><span>💌</span><span class="t">小提醒</span></div>' +
        msgs.map(function (m) {
          return '<div class="insight"><span class="e">' + m.e + '</span><span>' + m.html + '</span></div>';
        }).join('') + '</div>';
    }

    /* ── 最近幾筆 ── */
    var recent = Repo.txs().slice().sort(function (a, b2) {
      if (a.date !== b2.date) return a.date < b2.date ? 1 : -1;
      return (b2.createdAt || '') < (a.createdAt || '') ? -1 : 1;
    }).slice(0, 6);

    h += '<div class="card"><div class="card-h"><span>🧾</span><span class="t">最近消費</span><span class="spacer"></span>' +
      '<span class="more" data-act="go-list">全部 ›</span></div>';
    if (!recent.length) {
      h += UI.empty('還沒有任何紀錄', '按下方的 <b>＋</b>，3 秒記下第一筆 🎈');
    } else {
      h += recent.map(txRow).join('');
    }
    h += '</div>';

    /* ── streak + 徽章 ── */
    h += streakCard();

    return h;
  }

  function txRow(t) {
    var c = Repo.cat(t.categoryId);
    var p = Repo.pay(t.paymentMethodId);
    return '<button class="tx" data-act="edit-tx" data-id="' + t.id + '" style="width:100%;text-align:left">' +
      '<span class="ava" style="background:' + U.tint(c.color, .16) + '">' + c.emoji + '</span>' +
      '<span class="mid"><span class="n" style="display:block">' + U.esc(t.note || c.name) + '</span>' +
      '<span class="s">' + U.fmtDayHeader(t.date) + ' · ' + c.name + ' · ' + p.emoji + p.name + (t.recurringId ? ' · 🔁' : '') + '</span></span>' +
      '<span class="amt num ' + (t.type === 'income' ? 'pos' : '') + '">' +
      (t.type === 'income' ? '+' : '−') + U.money(t.amount) + '</span></button>';
  }

  function budgetCard(mp, b, t) {
    var rows = Q.byCategory(mp, 'expense').rows;
    var map = {};
    rows.forEach(function (r) { map[r.categoryId] = r.amount; });
    var h = '<div class="card"><div class="card-h"><span>🎯</span><span class="t">預算進度</span><span class="spacer"></span>' +
      '<span class="more" data-act="go-budget">調整 ›</span></div>';
    if (b.total > 0) {
      h += bRow({ name: '本月總預算', emoji: '💰', color: '#FF8A65' }, t.expense, b.total);
    }
    var catIds = Object.keys(b.categories).filter(function (k) { return b.categories[k] > 0; });
    catIds.sort(function (x, y) {
      return U.pct(map[y] || 0, b.categories[y]) - U.pct(map[x] || 0, b.categories[x]);
    });
    catIds.slice(0, 4).forEach(function (id) {
      var c = Repo.cat(id);
      h += bRow(c, map[id] || 0, b.categories[id]);
    });
    if (!b.total && !catIds.length) h += '<div class="tiny faint">還沒設定金額，點右上「調整」開始。</div>';
    return h + '</div>';
  }

  function bRow(c, used, limit) {
    var p = U.pct(used, limit);
    var color = p >= 100 ? 'var(--primary-2)' : (p >= 80 ? 'var(--yellow)' : 'var(--mint)');
    return '<div class="budget-row"><div class="top">' +
      '<span>' + c.emoji + '</span><span class="n">' + U.esc(c.name) + '</span>' +
      '<span class="v num">' + U.money(used) + ' / ' + U.money(limit) + '</span></div>' +
      '<div class="bar"><i style="width:' + Math.min(p, 100) + '%;background:' + color + '"></i></div></div>';
  }

  function streakCard() {
    var s = Repo.settings();
    var got = s.achievements || [];
    var doneToday = Repo.streakToday();
    var h = '<div class="streak">' +
      '<div class="big">' + (doneToday ? '🔥' : '🌤') + '</div>' +
      '<div style="flex:1"><div class="n">連續記帳 ' + (s.streak.count || 0) + ' 天</div>' +
      '<div class="s">最佳紀錄 ' + (s.streak.best || 0) + ' 天' + (doneToday ? '　·　今天已完成 ✅' : '　·　今天還沒記喔') + '</div></div>' +
      (doneToday ? '' : '<button class="btn sm primary" data-act="quick-add">記一筆</button>') +
      '</div>';

    h += '<div class="card"><div class="card-h"><span>🏅</span><span class="t">小成就</span><span class="spacer"></span>' +
      '<span class="more">' + got.length + ' / ' + Schema.ACHIEVEMENTS.length + '</span></div>' +
      '<div class="badges">' + Schema.ACHIEVEMENTS.map(function (a) {
        return '<div class="badge ' + (got.indexOf(a.id) >= 0 ? 'got' : '') + '">' +
          '<div class="e">' + a.emoji + '</div><div class="n">' + a.name + '</div></div>';
      }).join('') + '</div>';
    h += '<div class="insight" style="margin:12px 0 0"><span class="e">📮</span><span>' + U.esc(Insights.weekSummary(Repo.settings())) + '</span></div>';
    return h + '</div>';
  }

  function topbar() {
    var d = new Date();
    var hour = d.getHours();
    var g = hour < 5 ? ['夜深了', '🌙'] : hour < 11 ? ['早安', '☀️'] :
            hour < 14 ? ['午安', '🌤'] : hour < 18 ? ['下午好', '🌤'] : ['晚安', '🌙'];
    return '<div><h1>' + g[0] + '！' + g[1] + '</h1>' +
      '<div class="sub">' + U.fmtDateFull(U.today()) + '</div></div>' +
      '<div class="spacer"></div>' +
      '<button class="iconbtn" data-act="go-list">🔍</button>';
  }

  return { render: render, topbar: topbar, txRow: txRow, bRow: bRow };
})();
