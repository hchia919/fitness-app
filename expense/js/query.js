/* ── 彙總引擎：期間統計、分類佔比、趨勢、搜尋篩選 ───────── */
var Q = (function () {

  function inP(t, p) { return t.date >= p.from && t.date <= p.to; }

  function list(p, type) {
    return Repo.txs().filter(function (t) {
      return inP(t, p) && (!type || t.type === type);
    });
  }

  function sum(arr) {
    return arr.reduce(function (a, t) { return a + (Number(t.amount) || 0); }, 0);
  }

  function totals(p) {
    var all = Repo.txs().filter(function (t) { return inP(t, p); });
    var expense = 0, income = 0;
    all.forEach(function (t) { if (t.type === 'income') income += t.amount; else expense += t.amount; });
    return { expense: expense, income: income, net: income - expense, count: all.length };
  }

  function dayTotal(iso, type) {
    return sum(Repo.txs().filter(function (t) { return t.date === iso && t.type === (type || 'expense'); }));
  }

  /* 分類佔比（大→小） */
  function byCategory(p, type) {
    var map = {};
    list(p, type || 'expense').forEach(function (t) {
      if (!map[t.categoryId]) map[t.categoryId] = { categoryId: t.categoryId, amount: 0, count: 0 };
      map[t.categoryId].amount += t.amount;
      map[t.categoryId].count++;
    });
    var arr = Object.keys(map).map(function (k) { return map[k]; });
    var total = arr.reduce(function (a, x) { return a + x.amount; }, 0);
    arr.forEach(function (x) {
      var c = Repo.cat(x.categoryId);
      x.name = c.name; x.emoji = c.emoji; x.color = c.color;
      x.pct = total ? x.amount / total * 100 : 0;
    });
    arr.sort(function (a, b) { return b.amount - a.amount; });
    return { rows: arr, total: total };
  }

  /* 付款方式佔比 */
  function byPayment(p, type) {
    var map = {};
    list(p, type || 'expense').forEach(function (t) {
      var k = t.paymentMethodId || 'none';
      if (!map[k]) map[k] = { id: k, amount: 0, count: 0 };
      map[k].amount += t.amount; map[k].count++;
    });
    return Object.keys(map).map(function (k) {
      var pm = Repo.pay(k);
      return Object.assign(map[k], { name: pm.name, emoji: pm.emoji });
    }).sort(function (a, b) { return b.amount - a.amount; });
  }

  /* 每日序列（給趨勢圖用） */
  function dailySeries(p, type) {
    var out = [], cur = p.from;
    var map = {};
    list(p, type || 'expense').forEach(function (t) { map[t.date] = (map[t.date] || 0) + t.amount; });
    var guard = 0;
    while (cur <= p.to && guard++ < 800) {
      out.push({ key: cur, label: U.fromISO(cur).getDate(), value: map[cur] || 0 });
      cur = U.addDays(cur, 1);
    }
    return out;
  }

  /* 給柱狀圖：回傳 [{label, value, key?}] */
  function barSeries(p, type) {
    type = type || 'expense';
    var items = list(p, type);
    var out = [];
    if (p.kind === 'week') {
      var cur = p.from;
      for (var i = 0; i < 7; i++) {
        var d = U.fromISO(cur);
        out.push({ key: cur, label: '週' + U.WD[d.getDay()], value: 0 });
        cur = U.addDays(cur, 1);
      }
      items.forEach(function (t) {
        var idx = U.diffDays(p.from, t.date);
        if (out[idx]) out[idx].value += t.amount;
      });
    } else if (p.kind === 'month') {
      var starts = [];
      var c = p.from, n = 0;
      while (c <= p.to && n < 6) { starts.push(c); c = U.addDays(c, 7); n++; }
      starts.forEach(function (s, i) {
        out.push({ key: s, label: '第' + (i + 1) + '週', value: 0 });
      });
      items.forEach(function (t) {
        var idx = Math.floor(U.diffDays(p.from, t.date) / 7);
        if (out[idx]) out[idx].value += t.amount;
      });
    } else {
      /* 季 / 年 → 每月 */
      var m = p.from, guard = 0;
      while (m <= p.to && guard++ < 24) {
        out.push({ key: m, label: (U.fromISO(m).getMonth() + 1) + '月', value: 0 });
        m = U.addMonths(m, 1);
      }
      items.forEach(function (t) {
        for (var i = out.length - 1; i >= 0; i--) {
          if (t.date >= out[i].key) { out[i].value += t.amount; break; }
        }
      });
    }
    return out;
  }

  /* 近 N 個月的支出趨勢（折線） */
  function monthlyTrend(n, settings) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var p = U.period('month', -i, settings);
      var t = totals(p);
      out.push({ key: p.from, label: (U.fromISO(p.from).getMonth() + 1) + '月', value: t.expense, period: p });
    }
    return out;
  }

  /* 累積曲線：本期每天的累積支出（首頁迷你趨勢） */
  function cumulative(p, type) {
    var d = dailySeries(p, type), acc = 0;
    var today = U.today();
    return d.filter(function (x) { return x.key <= today; }).map(function (x) {
      acc += x.value; return { key: x.key, label: x.label, value: acc };
    });
  }

  /* 花最多的一天 */
  function topDay(p, type) {
    var d = dailySeries(p, type);
    var best = null;
    d.forEach(function (x) { if (!best || x.value > best.value) best = x; });
    return best && best.value > 0 ? best : null;
  }

  /* 最大單筆 */
  function topTx(p, type) {
    var arr = list(p, type || 'expense').slice().sort(function (a, b) { return b.amount - a.amount; });
    return arr[0] || null;
  }

  /* 搜尋 + 篩選 */
  function search(f) {
    f = f || {};
    var kw = (f.keyword || '').trim().toLowerCase();
    return Repo.txs().filter(function (t) {
      if (f.type && t.type !== f.type) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (f.categoryIds && f.categoryIds.length && f.categoryIds.indexOf(t.categoryId) < 0) return false;
      if (f.paymentIds && f.paymentIds.length && f.paymentIds.indexOf(t.paymentMethodId) < 0) return false;
      if (f.min != null && f.min !== '' && t.amount < Number(f.min)) return false;
      if (f.max != null && f.max !== '' && t.amount > Number(f.max)) return false;
      if (kw) {
        var c = Repo.cat(t.categoryId), pm = Repo.pay(t.paymentMethodId);
        var hay = (t.note + ' ' + c.name + ' ' + pm.name + ' ' + t.amount + ' ' + t.date).toLowerCase();
        if (hay.indexOf(kw) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || '') < (a.createdAt || '') ? -1 : 1;
    });
  }

  /* 依日期分組 */
  function groupByDay(arr) {
    var map = {}, order = [];
    arr.forEach(function (t) {
      if (!map[t.date]) { map[t.date] = []; order.push(t.date); }
      map[t.date].push(t);
    });
    order.sort(function (a, b) { return a < b ? 1 : -1; });
    return order.map(function (d) {
      var items = map[d];
      var exp = 0, inc = 0;
      items.forEach(function (t) { if (t.type === 'income') inc += t.amount; else exp += t.amount; });
      return { date: d, items: items, expense: exp, income: inc };
    });
  }

  /* 常用組合（讓記帳從 3 秒變 1 秒）
     以「類別 + 備註」分群，金額取最常出現的那個 */
  function quickCombos(limit, type) {
    var since = U.addDays(U.today(), -60);
    var map = {};
    Repo.txs().forEach(function (t) {
      if (t.date < since || t.recurringId) return;
      if (type && t.type !== type) return;
      var k = t.type + '|' + t.categoryId + '|' + (t.note || '').trim();
      if (!map[k]) map[k] = { count: 0, amounts: {}, last: t };
      map[k].count++;
      map[k].amounts[t.amount] = (map[k].amounts[t.amount] || 0) + 1;
      if ((t.createdAt || '') > (map[k].last.createdAt || '')) map[k].last = t;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (x) { return x.count >= 2; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, limit || 3)
      .map(function (x) {
        /* 金額用出現次數最多的；同票時取最近一次 */
        var best = null;
        Object.keys(x.amounts).forEach(function (a) {
          if (!best || x.amounts[a] > x.amounts[best]) best = a;
        });
        var t = x.last;
        return {
          id: t.id, type: t.type, amount: Number(best),
          categoryId: t.categoryId, paymentMethodId: t.paymentMethodId,
          note: t.note, count: x.count
        };
      });
  }

  return {
    list: list, sum: sum, totals: totals, dayTotal: dayTotal,
    byCategory: byCategory, byPayment: byPayment,
    dailySeries: dailySeries, barSeries: barSeries, monthlyTrend: monthlyTrend,
    cumulative: cumulative, topDay: topDay, topTx: topTx,
    search: search, groupByDay: groupByDay, quickCombos: quickCombos
  };
})();
