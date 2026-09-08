/* ── 成就彈窗 + 月底回顧 ─────────────────────────────── */
var Achieve = (function () {
  function show(ids) {
    var list = Schema.ACHIEVEMENTS.filter(function (a) { return ids.indexOf(a.id) >= 0; });
    if (!list.length) return;
    UI.haptic(30);
    UI.sheet({
      center: true, hideClose: true,
      body: '<div style="text-align:center;padding:6px 2px">' +
        '<div class="tiny b" style="color:var(--text-3);letter-spacing:2px">ACHIEVEMENT</div>' +
        '<div style="font-size:52px;margin:8px 0 2px">' + list.map(function (a) { return a.emoji; }).join(' ') + '</div>' +
        '<div style="font-size:19px;font-weight:800">' + list.map(function (a) { return U.esc(a.name); }).join('・') + '</div>' +
        '<div class="small muted" style="margin-top:6px">' + U.esc(Insights.cheer()) + '</div>' +
        '<button class="btn primary block" style="margin-top:18px" data-sheet-close>太好了 🎉</button>' +
        '</div>'
    });
  }
  return { show: show };
})();

var Review = (function () {
  /* 月底回顧：每月第一次打開就跳一次（可關） */
  function maybeShow() {
    var s = Repo.settings();
    var lastP = U.period('month', -1, s);
    var key = Insights.budgetKey(lastP);
    if (s.lastReviewMonth === key) return false;
    var t = Q.totals(lastP);
    if (!t.count) {                       /* 上個月沒紀錄就不打擾 */
      Store.mutate(function (st) { st.settings.lastReviewMonth = key; }, { silent: true });
      return false;
    }
    Store.mutate(function (st) { st.settings.lastReviewMonth = key; }, { silent: true });
    setTimeout(function () { show(-1); }, 600);
    return true;
  }

  function show(offset) {
    var s = Repo.settings();
    var p = U.period('month', offset == null ? -1 : offset, s);
    var r = Insights.monthlyReview(p, s);
    var cats = r.topCats;
    if (!r.totals.count) {
      UI.sheet({
        center: true,
        body: '<div style="text-align:center;padding:6px 2px">' + UI.piggy(76) +
          '<div style="font-size:17px;font-weight:800;margin-top:6px">' + p.label + '沒有紀錄</div>' +
          '<div class="small muted" style="margin-top:6px">等這個月記滿一輪，月底就會有專屬回顧囉 🌱</div>' +
          '<button class="btn primary block" style="margin-top:18px" data-sheet-close>好</button></div>'
      });
      return;
    }
    UI.sheet({
      title: '', hideClose: false,
      body: '<div class="review">' +
        '<div class="cap">MONTHLY REVIEW</div>' +
        '<h2>' + p.label + ' 回顧</h2>' +
        '<div class="small faint">' + U.fmtDate(p.from) + ' – ' + U.fmtDate(p.to) + '</div>' +
        '<div style="margin-top:14px">' + UI.piggy(76) + '</div>' +
        '<div class="label">總支出</div>' +
        '<div class="big num">' + U.money(r.totals.expense) + '</div>' +
        (r.compare.prev.expense > 0
          ? '<div class="small ' + (r.compare.diff <= 0 ? 'pos' : 'neg') + '" style="font-weight:800;margin-top:4px">' +
            (r.compare.diff <= 0 ? '比前一個月少花 ' + U.money(-r.compare.diff) : '比前一個月多花 ' + U.money(r.compare.diff)) + '</div>'
          : '') +
        '<div class="insight" style="margin-top:16px;text-align:left"><span class="e">' + r.verdict.e + '</span><span>' + U.esc(r.verdict.text) + '</span></div>' +
        '<div class="reviewstats">' +
        '<div><div class="label">總收入</div><div class="v num">' + U.money(r.totals.income) + '</div></div>' +
        '<div><div class="label">結餘</div><div class="v num">' + U.money(r.totals.net, { signed: r.totals.net < 0 }) + '</div></div>' +
        '<div><div class="label">記帳天數</div><div class="v num">' + r.recordedDays + ' 天</div></div>' +
        '<div><div class="label">最佳連續</div><div class="v num">' + r.streakBest + ' 天</div></div>' +
        '</div>' +
        (cats.length ? '<div class="reviewtop"><div class="label" style="margin-bottom:4px">花最多的三個類別</div>' +
          cats.map(function (c, i) {
            return '<div class="budget-row"><div class="top"><span>' + ['🥇', '🥈', '🥉'][i] + '</span>' +
              '<span class="n">' + c.emoji + ' ' + U.esc(c.name) + '</span>' +
              '<span class="v num">' + U.money(c.amount) + '　' + c.pct.toFixed(0) + '%</span></div>' +
              '<div class="bar thin"><i style="width:' + c.pct + '%;background:' + c.color + '"></i></div></div>';
          }).join('') + '</div>' : '') +
        (r.topDay ? '<div class="insight" style="margin-top:12px;text-align:left"><span class="e">📅</span>' +
          '<span>花最多的一天是 <b>' + U.fmtDate(r.topDay.key) + '</b>，' + U.money(r.topDay.value) + '</span></div>' : '') +
        '<button class="btn primary block" style="margin-top:16px" data-sheet-close>看完了，繼續加油 💪</button>' +
        '<div class="tiny faint" style="margin-top:8px">想再看？「我的 › 月底回顧」隨時可以打開</div>' +
        '</div>'
    });
  }
  return { maybeShow: maybeShow, show: show };
})();
