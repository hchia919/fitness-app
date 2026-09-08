/* ── 洞察文案：把數字翻成人看得懂的一句話 ───────────────── */
var Insights = (function () {

  function prevPeriod(p, settings) {
    return U.period(p.kind, p.offset - 1, settings);
  }

  function compare(p, settings) {
    var cur = Q.totals(p), prev = Q.totals(prevPeriod(p, settings));
    var diff = cur.expense - prev.expense;
    var rate = prev.expense ? (diff / prev.expense * 100) : null;
    return { cur: cur, prev: prev, diff: diff, rate: rate };
  }

  function periodWord(kind) {
    return { week: '週', month: '月', quarter: '季', year: '年' }[kind] || '期';
  }
  function prevWord(kind) {
    return { week: '上週', month: '上個月', quarter: '上一季', year: '去年' }[kind] || '上一期';
  }

  /* 統計頁的洞察卡片 */
  function forPeriod(p, settings) {
    var out = [];
    var c = compare(p, settings);
    var w = prevWord(p.kind);

    if (c.prev.expense > 0) {
      if (c.diff > 0) {
        out.push({ e: '📈', html: '比' + w + '<b>多花了 ' + U.money(c.diff) + '</b>' + (c.rate != null ? '（+' + Math.round(c.rate) + '%）' : '') + '，注意一下節奏。' });
      } else if (c.diff < 0) {
        out.push({ e: '🎉', html: '比' + w + '<b>少花了 ' + U.money(-c.diff) + '</b>' + (c.rate != null ? '（' + Math.round(c.rate) + '%）' : '') + '，做得不錯！' });
      } else {
        out.push({ e: '⚖️', html: '跟' + w + '幾乎一樣，很穩定。' });
      }
    }

    /* 類別變化最大者 */
    var curCat = Q.byCategory(p, 'expense').rows;
    var prevCat = Q.byCategory(prevPeriod(p, settings), 'expense').rows;
    var prevMap = {};
    prevCat.forEach(function (x) { prevMap[x.categoryId] = x.amount; });
    var maxUp = null, maxDown = null;
    curCat.forEach(function (x) {
      var d = x.amount - (prevMap[x.categoryId] || 0);
      if (d > 0 && (!maxUp || d > maxUp.d)) maxUp = { row: x, d: d };
      if (d < 0 && (!maxDown || d < maxDown.d)) maxDown = { row: x, d: d };
    });
    prevCat.forEach(function (x) {
      var stillThere = curCat.some(function (y) { return y.categoryId === x.categoryId; });
      if (!stillThere && (!maxDown || -x.amount < maxDown.d)) maxDown = { row: x, d: -x.amount };
    });
    if (maxUp && maxUp.d >= 100) {
      out.push({ e: maxUp.row.emoji, html: '<b>' + U.esc(maxUp.row.name) + '</b>比' + w + '多了 <b>' + U.money(maxUp.d) + '</b>，是增加最多的類別。' });
    }
    if (maxDown && -maxDown.d >= 100) {
      out.push({ e: '💚', html: '<b>' + U.esc(maxDown.row.name) + '</b>比' + w + '少了 <b>' + U.money(-maxDown.d) + '</b>，控制得很好！' });
    }

    /* 花最多的一天 */
    var td = Q.topDay(p, 'expense');
    if (td) {
      out.push({ e: '📅', html: '花最多的是 <b>' + U.fmtDayHeader(td.key) + '</b>，共 <b>' + U.money(td.value) + '</b>。' });
    }
    /* 最大單筆 */
    var tt = Q.topTx(p, 'expense');
    if (tt && tt.amount > 0) {
      var tc = Repo.cat(tt.categoryId);
      out.push({ e: '💥', html: '最大一筆是 ' + tc.emoji + ' <b>' + U.esc(tt.note || tc.name) + ' ' + U.money(tt.amount) + '</b>（' + U.fmtDate(tt.date) + '）。' });
    }
    /* 日均 */
    var days = U.diffDays(p.from, p.to) + 1;
    var elapsed = Math.min(days, Math.max(1, U.diffDays(p.from, U.today()) + 1));
    if (c.cur.expense > 0) {
      out.push({ e: '🧮', html: '這' + periodWord(p.kind) + '平均一天 <b>' + U.moneyR(c.cur.expense / elapsed) + '</b>。' });
    }
    return out;
  }

  /* 首頁一句摘要（久沒開 App 也能秒懂） */
  function homeLine(settings) {
    var t = U.today();
    var st = Repo.settings().streak;
    var dues = Repo.dueList().length;
    var lastTx = Repo.txs().slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];

    if (!Repo.txs().length) return { e: '🐷', text: '歡迎！按下方的 ＋ 記下第一筆，只要 3 秒。' };
    if (dues) return { e: '🔔', text: '有 ' + dues + ' 筆固定支出等你確認，一鍵就能補上。' };
    if (lastTx) {
      var gap = U.diffDays(lastTx.date, t);
      if (gap >= 3) return { e: '👋', text: '你有 ' + gap + ' 天沒記帳了，補一下就跟上囉！' };
    }
    if (Repo.streakToday()) {
      if (st.count >= 7) return { e: '🔥', text: '今天記好了，連續 ' + st.count + ' 天，超強！' };
      return { e: '✅', text: '今天已經記帳了，連續 ' + st.count + ' 天，繼續保持！' };
    }
    return { e: '☀️', text: '今天還沒記帳，想想早餐花了多少？' };
  }

  /* 預算提醒（可愛但清楚，不用嚴肅紅字） */
  function budgetMessages(monthPeriod) {
    var key = budgetKey(monthPeriod);
    var b = Repo.budgetFor(key);
    var msgs = [];
    if (!b.exists) return msgs;
    var t = Q.totals(monthPeriod);
    if (b.total > 0) {
      var p = U.pct(t.expense, b.total);
      if (p >= 100) {
        msgs.push({ e: '🫣', level: 'over', html: '本月預算已經用完，超出 <b>' + U.money(t.expense - b.total) + '</b>。剩下的日子溫柔一點就好～' });
      } else if (p >= 80) {
        msgs.push({ e: '⏳', level: 'warn', html: '本月預算用掉 <b>' + p + '%</b>，還剩 <b>' + U.money(b.total - t.expense) + '</b>。' });
      }
    }
    var byCat = Q.byCategory(monthPeriod, 'expense').rows;
    byCat.forEach(function (row) {
      var lim = b.categories[row.categoryId];
      if (!lim) return;
      var p = U.pct(row.amount, lim);
      if (p >= 100) {
        msgs.push({ e: row.emoji, level: 'over', html: '<b>' + U.esc(row.name) + '</b>預算超出 <b>' + U.money(row.amount - lim) + '</b>，下個月一起加油 💪' });
      } else if (p >= 80) {
        msgs.push({ e: row.emoji, level: 'warn', html: '<b>' + U.esc(row.name) + '</b>預算已經用掉 <b>' + p + '%</b> 囉！' });
      }
    });
    return msgs.slice(0, 3);
  }

  function budgetKey(monthPeriod) {
    var d = U.fromISO(monthPeriod.from);
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1);
  }

  /* 今天還能花多少（最能改變行為的一個數字） */
  function dailyAllowance(monthPeriod) {
    var b = Repo.budgetFor(budgetKey(monthPeriod));
    if (!b.exists || !b.total) return null;
    var t = Q.totals(monthPeriod);
    var left = b.total - t.expense;
    var daysLeft = Math.max(1, U.daysLeftIn(monthPeriod));
    var spentToday = Q.dayTotal(U.today(), 'expense');
    var perDay = left / daysLeft;
    return {
      budget: b.total, spent: t.expense, left: left,
      daysLeft: daysLeft, perDay: perDay,
      todayLeft: perDay - spentToday, spentToday: spentToday
    };
  }

  /* 每週小結 */
  function weekSummary(settings) {
    var p = U.period('week', 0, settings);
    var c = compare(p, settings);
    var top = Q.byCategory(p, 'expense').rows[0];
    if (!c.cur.expense) {
      return c.prev.expense > 0
        ? '這週還沒有支出紀錄，上週是 ' + U.money(c.prev.expense) + '。'
        : '這週還沒有支出紀錄，開個張吧 🌱';
    }
    var out = '這週花了 ' + U.money(c.cur.expense);
    if (top) out += '，最多花在' + top.emoji + top.name;
    out += '。';
    if (c.prev.expense > 0 && c.rate != null) {
      out += c.diff <= 0
        ? ' 比上週少 ' + Math.abs(Math.round(c.rate)) + '%，做得不錯！'
        : ' 比上週多 ' + Math.round(c.rate) + '%，注意一下節奏。';
    }
    return out;
  }

  /* 月底回顧 */
  function monthlyReview(p, settings) {
    var t = Q.totals(p);
    var c = compare(p, settings);
    var cats = Q.byCategory(p, 'expense').rows.slice(0, 3);
    var days = {};
    Q.list(p, 'expense').forEach(function (x) { days[x.date] = 1; });
    var recordedDays = Object.keys(days).length;
    var td = Q.topDay(p, 'expense');
    var b = Repo.budgetFor(budgetKey(p));
    var verdict;
    if (b.exists && b.total) {
      verdict = t.expense <= b.total
        ? { e: '🏆', text: '預算守住了！剩下 ' + U.money(b.total - t.expense) + '，值得給自己一個獎勵。' }
        : { e: '🫧', text: '這個月超出預算 ' + U.money(t.expense - b.total) + '，下個月我們調整一下節奏。' };
    } else if (c.prev.expense > 0) {
      verdict = c.diff <= 0
        ? { e: '🌟', text: '比' + prevWord(p.kind) + '少花 ' + U.money(-c.diff) + '，進步很明顯！' }
        : { e: '🌱', text: '比' + prevWord(p.kind) + '多花 ' + U.money(c.diff) + '，知道花在哪就是好的開始。' };
    } else {
      verdict = { e: '🌱', text: '第一個完整月份，之後就能互相比較了！' };
    }
    return {
      period: p, totals: t, compare: c, topCats: cats,
      recordedDays: recordedDays, topDay: td, verdict: verdict,
      streakBest: Repo.settings().streak.best || 0
    };
  }

  var CHEERS = [
    '記帳完成，今天的你很自律 ✨',
    '一筆一筆，錢就會愈來愈清楚 💡',
    '有記錄的人，才有選擇權 🌿',
    '存錢的第一步是看清楚，你已經做到了 🐷',
    '很棒！保持這個節奏 🎈',
    '小小的習慣，會變成大大的自由 🚀'
  ];
  function cheer() { return CHEERS[Math.floor(Math.random() * CHEERS.length)]; }

  return {
    compare: compare, forPeriod: forPeriod, homeLine: homeLine,
    budgetMessages: budgetMessages, budgetKey: budgetKey,
    dailyAllowance: dailyAllowance, weekSummary: weekSummary,
    monthlyReview: monthlyReview, cheer: cheer, prevWord: prevWord, periodWord: periodWord
  };
})();
