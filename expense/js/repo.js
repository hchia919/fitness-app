/* ── 資料存取層（CRUD）：未來要換 IndexedDB／雲端只改這裡 ── */
var Repo = (function () {

  /* ---------- 讀取 ---------- */
  function txs() { return Store.get().transactions; }
  function cats(opts) {
    opts = opts || {};
    return Store.get().categories.filter(function (c) {
      if (!opts.withArchived && c.isArchived) return false;
      if (opts.type && c.type !== 'both' && c.type !== opts.type) return false;
      return true;
    }).sort(function (a, b) { return a.order - b.order; });
  }
  function cat(id) {
    var c = Store.get().categories.filter(function (x) { return x.id === id; })[0];
    return c || { id: id, name: '未分類', emoji: '❓', color: '#BDBDBD', type: 'expense' };
  }
  function pays(withArchived) {
    return Store.get().payments.filter(function (p) { return withArchived || !p.isArchived; });
  }
  function pay(id) {
    var p = Store.get().payments.filter(function (x) { return x.id === id; })[0];
    return p || { id: id, name: '—', emoji: '💠', kind: 'cash' };
  }
  function recurrings() { return Store.get().recurrings; }
  function settings() { return Store.get().settings; }

  /* ---------- 交易 ---------- */
  function addTx(t) {
    var now = new Date().toISOString();
    var tx = {
      id: U.uid('tx'),
      type: t.type === 'income' ? 'income' : 'expense',
      amount: Math.round((Number(t.amount) || 0) * 100) / 100,
      categoryId: t.categoryId,
      subId: t.subId || null,
      paymentMethodId: t.paymentMethodId || null,
      date: t.date || U.today(),
      note: (t.note || '').trim(),
      recurringId: t.recurringId || null,
      createdAt: now, updatedAt: now
    };
    Store.mutate(function (s) {
      s.transactions.push(tx);
      var c = s.categories.filter(function (x) { return x.id === tx.categoryId; })[0];
      if (c) {
        c.usageCount = (c.usageCount || 0) + 1;
        if (tx.subId) {
          var sb = (c.subs || []).filter(function (x) { return x.id === tx.subId; })[0];
          if (sb) sb.usageCount = (sb.usageCount || 0) + 1;
        }
      }
      if (tx.paymentMethodId) s.settings.lastPaymentId = tx.paymentMethodId;
      refreshStreak(s);
      checkAchievements(s);
    });
    return tx;
  }

  function updateTx(id, patch) {
    Store.mutate(function (s) {
      var t = s.transactions.filter(function (x) { return x.id === id; })[0];
      if (!t) return;
      if (patch.amount != null) patch.amount = Math.round(Number(patch.amount) * 100) / 100;
      Object.assign(t, patch, { updatedAt: new Date().toISOString() });
      if (t.subId) {                       /* 細項必須屬於目前的類別 */
        var cc = s.categories.filter(function (x) { return x.id === t.categoryId; })[0];
        var ok = cc && (cc.subs || []).some(function (x) { return x.id === t.subId; });
        if (!ok) t.subId = null;
      }
      if (t.paymentMethodId) s.settings.lastPaymentId = t.paymentMethodId;
      refreshStreak(s);
    });
  }

  function deleteTx(id) {
    Store.mutate(function (s) {
      s.transactions = s.transactions.filter(function (x) { return x.id !== id; });
      refreshStreak(s);
    });
  }

  /* ---------- 類別 ---------- */
  function addCat(c) {
    var id = U.uid('cat');
    Store.mutate(function (s) {
      var max = s.categories.reduce(function (m, x) { return Math.max(m, x.order || 0); }, 0);
      s.categories.push({
        id: id, name: (c.name || '新類別').trim(), emoji: c.emoji || '🏷️',
        color: c.color || '#FF8A65', type: c.type || 'expense',
        order: max + 1, isArchived: false, isSystem: false, usageCount: 0
      });
    });
    return id;
  }
  function updateCat(id, patch) {
    Store.mutate(function (s) {
      var c = s.categories.filter(function (x) { return x.id === id; })[0];
      if (c) Object.assign(c, patch);
    });
  }
  /* 刪除類別：有交易時要指定搬去哪，或改為封存（不讓舊帳變孤兒） */
  function deleteCat(id, moveToId) {
    var used = txs().filter(function (t) { return t.categoryId === id; }).length;
    Store.mutate(function (s) {
      if (used && moveToId) {
        s.transactions.forEach(function (t) {
          if (t.categoryId === id) { t.categoryId = moveToId; t.subId = null; }
        });
        s.recurrings.forEach(function (r) {
          if (r.categoryId === id) { r.categoryId = moveToId; r.subId = null; }
        });
      }
      if (used && !moveToId) {
        var c = s.categories.filter(function (x) { return x.id === id; })[0];
        if (c) c.isArchived = true;
        return;
      }
      s.categories = s.categories.filter(function (x) { return x.id !== id; });
      Object.keys(s.budgets).forEach(function (k) {
        if (s.budgets[k] && s.budgets[k].categories) delete s.budgets[k].categories[id];
      });
    });
    return used && !moveToId ? 'archived' : 'deleted';
  }
  function countTxOfCat(id) {
    return txs().filter(function (t) { return t.categoryId === id; }).length;
  }


  /* ---------- 細項（類別的第二層） ---------- */
  function subsOf(catId, withArchived) {
    var c = Store.get().categories.filter(function (x) { return x.id === catId; })[0];
    if (!c || !Array.isArray(c.subs)) return [];
    return c.subs.filter(function (x) { return withArchived || !x.isArchived; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function sub(catId, subId) {
    if (!subId) return null;
    var c = Store.get().categories.filter(function (x) { return x.id === catId; })[0];
    if (!c) return null;
    return (c.subs || []).filter(function (x) { return x.id === subId; })[0] || null;
  }
  /* 交易上的細項名稱（找不到就回空字串） */
  function subName(t) {
    var sb = t && sub(t.categoryId, t.subId);
    return sb ? sb.name : '';
  }
  function addSub(catId, name) {
    name = String(name || '').trim();
    if (!name) return null;
    var id = U.uid('sub');
    Store.mutate(function (s) {
      var c = s.categories.filter(function (x) { return x.id === catId; })[0];
      if (!c) return;
      if (!Array.isArray(c.subs)) c.subs = [];
      var dup = c.subs.filter(function (x) { return x.name === name; })[0];
      if (dup) { dup.isArchived = false; id = dup.id; return; }
      var max = c.subs.reduce(function (m, x) { return Math.max(m, x.order || 0); }, -1);
      c.subs.push({ id: id, name: name, order: max + 1, isArchived: false, usageCount: 0 });
    });
    return id;
  }
  function updateSub(catId, subId, patch) {
    Store.mutate(function (s) {
      var c = s.categories.filter(function (x) { return x.id === catId; })[0];
      if (!c) return;
      var sb = (c.subs || []).filter(function (x) { return x.id === subId; })[0];
      if (sb) Object.assign(sb, patch);
    });
  }
  /* 刪除細項：用到的交易改回「只有大類別」，不會變成孤兒 */
  function deleteSub(catId, subId) {
    var used = txs().filter(function (t) { return t.subId === subId; }).length;
    Store.mutate(function (s) {
      var c = s.categories.filter(function (x) { return x.id === catId; })[0];
      if (!c) return;
      c.subs = (c.subs || []).filter(function (x) { return x.id !== subId; });
      s.transactions.forEach(function (t) { if (t.subId === subId) t.subId = null; });
      s.recurrings.forEach(function (r) { if (r.subId === subId) r.subId = null; });
    });
    return used;
  }
  function countTxOfSub(subId) {
    return txs().filter(function (t) { return t.subId === subId; }).length;
  }
  function moveSub(catId, subId, dir) {
    Store.mutate(function (s) {
      var c = s.categories.filter(function (x) { return x.id === catId; })[0];
      if (!c) return;
      var list = (c.subs || []).filter(function (x) { return !x.isArchived; })
        .sort(function (a, b) { return a.order - b.order; });
      var i = list.findIndex(function (x) { return x.id === subId; });
      var j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      var o = list[i].order; list[i].order = list[j].order; list[j].order = o;
    });
  }

  /* ---------- 付款方式 ---------- */
  function addPay(p) {
    var id = U.uid('pay');
    Store.mutate(function (s) {
      s.payments.push({ id: id, name: (p.name || '新方式').trim(), emoji: p.emoji || '💠', kind: p.kind || 'cash', isArchived: false });
    });
    return id;
  }
  function updatePay(id, patch) {
    Store.mutate(function (s) {
      var p = s.payments.filter(function (x) { return x.id === id; })[0];
      if (p) Object.assign(p, patch);
    });
  }
  function deletePay(id) {
    var used = txs().filter(function (t) { return t.paymentMethodId === id; }).length;
    Store.mutate(function (s) {
      if (used) {
        var p = s.payments.filter(function (x) { return x.id === id; })[0];
        if (p) p.isArchived = true;
      } else {
        s.payments = s.payments.filter(function (x) { return x.id !== id; });
      }
    });
    return used ? 'archived' : 'deleted';
  }

  /* ---------- 預算 ---------- */
  /* budgets['YYYY-MM'] 優先，沒有就用 budgets.default（每月沿用） */
  function budgetFor(monthKey) {
    var b = Store.get().budgets;
    var src = b[monthKey] || b['default'] || null;
    if (!src) return { total: 0, categories: {}, inherited: !!b['default'], exists: false };
    return {
      total: Number(src.total) || 0,
      categories: Object.assign({}, src.categories || {}),
      inherited: !b[monthKey] && !!b['default'],
      exists: true
    };
  }
  function setBudget(monthKey, data) {
    Store.mutate(function (s) {
      s.budgets[monthKey] = {
        total: Number(data.total) || 0,
        categories: data.categories || {}
      };
      checkAchievements(s);
    });
  }
  function clearBudget(monthKey) {
    Store.mutate(function (s) { delete s.budgets[monthKey]; });
  }

  /* ---------- 週期支出 ---------- */
  function normalizeFreq(f) {
    return {
      unit: f.unit || 'month',
      interval: Math.max(1, Number(f.interval) || 1),
      dayOfMonth: f.dayOfMonth || null,
      weekday: f.weekday == null ? null : Number(f.weekday)
    };
  }
  function addRecurring(r) {
    var id = U.uid('rec');
    var freq = normalizeFreq(r.freq || {});
    var start = r.startDate || U.today();
    Store.mutate(function (s) {
      s.recurrings.push({
        id: id,
        name: (r.name || '固定支出').trim(),
        type: r.type === 'income' ? 'income' : 'expense',
        amount: Math.round((Number(r.amount) || 0) * 100) / 100,
        categoryId: r.categoryId,
        subId: r.subId || null,
        paymentMethodId: r.paymentMethodId || s.settings.lastPaymentId,
        freq: freq,
        startDate: start,
        endDate: r.endDate || null,
        nextDueDate: r.nextDueDate || start,
        autoPost: !!r.autoPost,
        isActive: r.isActive === false ? false : true,
        note: (r.note || '').trim(),
        lastPostedDate: null,
        createdAt: new Date().toISOString()
      });
      checkAchievements(s);
    });
    return id;
  }
  function updateRecurring(id, patch) {
    Store.mutate(function (s) {
      var r = s.recurrings.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      if (patch.freq) patch.freq = normalizeFreq(patch.freq);
      if (patch.amount != null) patch.amount = Math.round(Number(patch.amount) * 100) / 100;
      Object.assign(r, patch);
    });
  }
  function deleteRecurring(id) {
    Store.mutate(function (s) {
      s.recurrings = s.recurrings.filter(function (x) { return x.id !== id; });
    });
  }

  function advance(iso, freq) {
    var f = freq;
    if (f.unit === 'day') return U.addDays(iso, f.interval);
    if (f.unit === 'week') return U.addDays(iso, 7 * f.interval);
    if (f.unit === 'year') return U.addYears(iso, f.interval);
    return U.addMonths(iso, f.interval); /* month（每季 = interval 3） */
  }

  /* 已到期、等你確認的項目 */
  function dueList() {
    var t = U.today();
    return recurrings().filter(function (r) {
      return r.isActive && r.nextDueDate <= t && (!r.endDate || r.nextDueDate <= r.endDate);
    }).sort(function (a, b) { return a.nextDueDate < b.nextDueDate ? -1 : 1; });
  }

  /* 未來 N 天內將扣款 */
  function upcoming(days) {
    var t = U.today(), end = U.addDays(t, days);
    return recurrings().filter(function (r) {
      return r.isActive && r.nextDueDate >= t && r.nextDueDate <= end;
    }).sort(function (a, b) { return a.nextDueDate < b.nextDueDate ? -1 : 1; });
  }

  /* 確認扣款 → 產生交易並推進下一次 */
  function confirmDue(id, amountOverride) {
    var r = recurrings().filter(function (x) { return x.id === id; })[0];
    if (!r) return null;
    var due = r.nextDueDate;
    var tx = addTx({
      type: r.type,
      amount: amountOverride != null ? amountOverride : r.amount,
      categoryId: r.categoryId,
      subId: r.subId || null,
      paymentMethodId: r.paymentMethodId,
      date: due,
      note: r.name,
      recurringId: r.id
    });
    Store.mutate(function (s) {
      var rr = s.recurrings.filter(function (x) { return x.id === id; })[0];
      if (!rr) return;
      rr.lastPostedDate = due;
      rr.nextDueDate = advance(due, rr.freq);
      if (rr.endDate && rr.nextDueDate > rr.endDate) rr.isActive = false;
    });
    return tx;
  }

  function skipDue(id) {
    Store.mutate(function (s) {
      var r = s.recurrings.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      r.nextDueDate = advance(r.nextDueDate, r.freq);
      if (r.endDate && r.nextDueDate > r.endDate) r.isActive = false;
    });
  }

  /* 開 App 時跑一次：autoPost 的自動補記（不會重複） */
  function processAutoPost() {
    var posted = 0, guard = 0;
    var t = U.today();
    var list = recurrings().filter(function (r) { return r.isActive && r.autoPost; });
    list.forEach(function (r) {
      while (r.isActive && r.nextDueDate <= t && guard++ < 400) {
        confirmDue(r.id);
        posted++;
        r = recurrings().filter(function (x) { return x.id === r.id; })[0];
        if (!r) break;
      }
    });
    return posted;
  }

  /* 月均固定支出：把週／季／年攤平成每月 */
  function monthlyEquivalent(r) {
    var f = r.freq, a = Number(r.amount) || 0;
    if (f.unit === 'day') return a * (365 / 12) / f.interval;
    if (f.unit === 'week') return a * (52 / 12) / f.interval;
    if (f.unit === 'year') return a / (12 * f.interval);
    return a / f.interval;
  }
  /* 固定收入用「入帳」，固定支出用「扣款」 */
  function isIncome(r) { return !!r && r.type === 'income'; }
  function dueVerb(r) { return isIncome(r) ? '入帳' : '扣款'; }
  function kindLabel(r) { return isIncome(r) ? '固定收入' : '固定支出'; }
  /* 一串待確認項目的統稱 */
  function kindLabelOf(list) {
    var inc = list.filter(isIncome).length;
    if (!inc) return '固定支出';
    return inc === list.length ? '固定收入' : '固定收支';
  }

  function freqLabel(r) {
    var f = r.freq, i = f.interval;
    if (f.unit === 'day') return i === 1 ? '每天' : '每 ' + i + ' 天';
    if (f.unit === 'week') return i === 1 ? '每週' : '每 ' + i + ' 週';
    if (f.unit === 'year') return i === 1 ? '每年' : '每 ' + i + ' 年';
    if (i === 3) return '每季';
    if (i === 6) return '每半年';
    return i === 1 ? '每月' : '每 ' + i + ' 個月';
  }

  /* ---------- 連續記帳天數 ---------- */
  function refreshStreak(s) {
    var set = {};
    s.transactions.forEach(function (t) { set[t.date] = 1; });
    var t = U.today();
    var cursor = set[t] ? t : (set[U.addDays(t, -1)] ? U.addDays(t, -1) : null);
    var n = 0;
    while (cursor && set[cursor]) { n++; cursor = U.addDays(cursor, -1); }
    s.settings.streak.count = n;
    s.settings.streak.best = Math.max(s.settings.streak.best || 0, n);
    s.settings.streak.lastDate = set[t] ? t : (s.settings.streak.lastDate || null);
    return n;
  }
  /* 開 App／匯入資料後重算（換日、匯入備份都需要） */
  function refreshStreakNow() {
    Store.mutate(function (s) { refreshStreak(s); checkAchievements(s); }, { silent: true });
  }
  function streakToday() {
    var s = Store.get();
    return s.transactions.some(function (t) { return t.date === U.today(); });
  }

  /* ---------- 成就 ---------- */
  function grant(s, id) {
    if (s.settings.achievements.indexOf(id) < 0) { s.settings.achievements.push(id); return true; }
    return false;
  }
  function checkAchievements(s) {
    var got = [];
    var n = s.transactions.length;
    if (n >= 1 && grant(s, 'first')) got.push('first');
    if (n >= 50 && grant(s, 'tx50')) got.push('tx50');
    if (n >= 200 && grant(s, 'tx200')) got.push('tx200');
    var st = s.settings.streak.count || 0;
    if (st >= 3 && grant(s, 'streak3')) got.push('streak3');
    if (st >= 7 && grant(s, 'streak7')) got.push('streak7');
    if (st >= 30 && grant(s, 'streak30')) got.push('streak30');
    if (Object.keys(s.budgets).length && grant(s, 'budgetset')) got.push('budgetset');
    if (s.recurrings.length && grant(s, 'recurring')) got.push('recurring');
    var used = {}; s.transactions.forEach(function (t) { used[t.categoryId] = 1; });
    if (Object.keys(used).length >= 8 && grant(s, 'allcat')) got.push('allcat');
    if (new Date().getHours() < 9 && n >= 1 && grant(s, 'earlybird')) got.push('earlybird');
    s._newAchievements = got;
    return got;
  }
  function takeNewAchievements() {
    var s = Store.get();
    var g = s._newAchievements || [];
    s._newAchievements = [];
    return g;
  }
  function grantMonthly(id) {
    var r = false;
    Store.mutate(function (s) { r = grant(s, id); }, { silent: true });
    return r;
  }

  return {
    txs: txs, cats: cats, cat: cat, pays: pays, pay: pay, recurrings: recurrings, settings: settings,
    addTx: addTx, updateTx: updateTx, deleteTx: deleteTx,
    addCat: addCat, updateCat: updateCat, deleteCat: deleteCat, countTxOfCat: countTxOfCat,
    subsOf: subsOf, sub: sub, subName: subName, addSub: addSub, updateSub: updateSub,
    deleteSub: deleteSub, countTxOfSub: countTxOfSub, moveSub: moveSub,
    addPay: addPay, updatePay: updatePay, deletePay: deletePay,
    budgetFor: budgetFor, setBudget: setBudget, clearBudget: clearBudget,
    addRecurring: addRecurring, updateRecurring: updateRecurring, deleteRecurring: deleteRecurring,
    dueList: dueList, upcoming: upcoming, confirmDue: confirmDue, skipDue: skipDue,
    processAutoPost: processAutoPost, advance: advance,
    monthlyEquivalent: monthlyEquivalent, freqLabel: freqLabel,
    isIncome: isIncome, dueVerb: dueVerb, kindLabel: kindLabel, kindLabelOf: kindLabelOf,
    streakToday: streakToday, refreshStreakNow: refreshStreakNow, takeNewAchievements: takeNewAchievements, grantMonthly: grantMonthly
  };
})();
