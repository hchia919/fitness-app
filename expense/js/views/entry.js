/* ── ＋記帳 sheet：3 次觸碰完成一筆 ─────────────────────
   任何頁面都能呼出，不佔用底部導航                    */
var Entry = (function () {
  var st = null;   /* 目前編輯狀態 */
  var api = null;
  var lp = null;   /* 類別長按控制器 */

  function sortedCats(type) {
    var arr = Repo.cats({ type: type });
    if (Repo.settings().catSort === 'custom') return arr;
    return arr.slice().sort(function (a, b) {
      var d = (b.usageCount || 0) - (a.usageCount || 0);
      return d !== 0 ? d : (a.order - b.order);
    });
  }

  function open(opts) {
    opts = opts || {};
    var tx = opts.tx || null;
    var cats;
    st = {
      editId: tx ? tx.id : null,
      type: tx ? tx.type : (opts.type || 'expense'),
      buf: tx ? String(tx.amount) : '',
      acc: [],
      categoryId: tx ? tx.categoryId : (opts.categoryId || null),
      paymentMethodId: tx ? tx.paymentMethodId : (opts.paymentMethodId || Repo.settings().lastPaymentId),
      date: tx ? tx.date : (opts.date || U.today()),
      note: tx ? tx.note : (opts.note || ''),
      showMore: !!(tx && (tx.note || tx.date !== U.today())),
      recurringId: tx ? tx.recurringId : null
    };
    if (!st.categoryId) {
      cats = sortedCats(st.type);
      st.categoryId = cats.length ? cats[0].id : null;
    }
    api = UI.sheet({
      flex: true,
      title: st.editId ? '編輯這筆' : '記一筆',
      body: render(),
      onMount: function (a) { bind(a); attachLongPress(a); fit(a.el); },
      onClose: function () { st = null; api = null; lp = null; }
    });
  }

  /* ---------- 金額計算 ---------- */
  function value() {
    var s = st.acc.reduce(function (a, x) { return a + x; }, 0);
    return s + (st.buf === '' ? 0 : (parseFloat(st.buf) || 0));
  }
  function exprText() {
    if (!st.acc.length) return '';
    return st.acc.map(function (x) { return U.money(x, { bare: true }); }).join(' + ') + (st.buf ? ' + ' + st.buf : ' +');
  }

  function press(k) {
    UI.haptic(8);
    if (k === 'del') {
      if (st.buf) st.buf = st.buf.slice(0, -1);
      else if (st.acc.length) st.buf = String(st.acc.pop());
    } else if (k === 'plus') {
      if (st.buf !== '') { st.acc.push(parseFloat(st.buf) || 0); st.buf = ''; }
    } else if (k === '.') {
      if (st.buf.indexOf('.') < 0) st.buf = (st.buf === '' ? '0' : st.buf) + '.';
    } else if (k === '00') {
      if (st.buf !== '' && st.buf !== '0') st.buf = capped(st.buf + '00');
    } else {
      if (st.buf === '0') st.buf = k; else st.buf = capped(st.buf + k);
    }
    paintAmount();
  }
  function capped(s) {
    var parts = s.split('.');
    if (parts[0].length > 9) return s.slice(0, -1);
    if (parts[1] && parts[1].length > 2) return s.slice(0, -1);
    return s;
  }

  function paintAmount() {
    var v = value();
    var d = api.el.querySelector('[data-amt]');
    var e = api.el.querySelector('[data-expr]');
    var go = api.el.querySelector('[data-go]');
    if (d) {
      d.textContent = st.buf && !st.acc.length
        ? U.money(st.buf, { bare: true })
        : U.money(v, { bare: true });
      d.classList.toggle('zero', !v);
    }
    if (e) e.textContent = exprText();
    if (go) go.disabled = !(v > 0) || !st.categoryId;
  }

  /* ---------- 畫面 ---------- */
  function render() {
    var cats = sortedCats(st.type);
    var pays = Repo.pays();
    var combos = st.editId ? [] : Q.quickCombos(3, st.type);
    var v = value();

    var h = '<div class="entry-scroll">';

    /* 快速組合：1 次觸碰完成 */
    if (combos.length) {
      st._combos = combos;
      h += '<div class="quick">' + combos.map(function (t, i) {
        var c = Repo.cat(t.categoryId);
        return '<button class="quickpill" data-combo="' + i + '">' +
          '<span class="e">' + c.emoji + '</span>' +
          '<span>' + U.esc(t.note || c.name) + '</span>' +
          '<span class="a">' + U.money(t.amount) + '</span></button>';
      }).join('') + '</div>';
    }

    /* 收支切換 */
    h += '<div class="seg" style="margin-bottom:6px">' +
      '<button data-type="expense" class="' + (st.type === 'expense' ? 'on' : '') + '">支出</button>' +
      '<button data-type="income" class="' + (st.type === 'income' ? 'on' : '') + '">收入</button></div>';

    /* 金額 */
    h += '<div class="amount-display"><span class="cur">$</span>' +
      '<span class="v num ' + (v ? '' : 'zero') + '" data-amt>' + U.money(v, { bare: true }) + '</span></div>' +
      '<div class="amount-expr num" data-expr>' + exprText() + '</div>';

    /* 類別 */
    h += '<div class="cathint">' +
      '<span class="tiny faint">長按類別可改名稱／圖示</span>' +
      '<button class="more" data-managecats>✏️ 管理類別</button></div>';
    h += '<div class="catgrid" style="margin:2px 0 4px;max-height:172px;overflow-y:auto;scroll-snap-type:y proximity">' +
      cats.map(function (c) {
        return '<button class="catcell ' + (c.id === st.categoryId ? 'on' : '') + '" data-cat="' + c.id + '">' +
          '<span class="e">' + c.emoji + '</span><span class="n">' + U.esc(c.name) + '</span></button>';
      }).join('') +
      '<button class="catcell" data-newcat><span class="e">➕</span><span class="n">新類別</span></button>' +
      '</div>';

    /* 日期／付款／備註（可選，不擋路） */
    h += '<div class="entry-extra">';
    if (st.showMore) {
      h += '<div style="margin-top:6px">' +
        '<div class="chips" style="margin-bottom:7px">' +
        '<button class="chip ' + (st.date === U.today() ? 'on' : '') + '" data-date="' + U.today() + '">今天</button>' +
        '<button class="chip ' + (st.date === U.addDays(U.today(), -1) ? 'on' : '') + '" data-date="' + U.addDays(U.today(), -1) + '">昨天</button>' +
        '<button class="chip ' + (st.date === U.addDays(U.today(), -2) ? 'on' : '') + '" data-date="' + U.addDays(U.today(), -2) + '">前天</button>' +
        '<input class="chip" type="date" data-datepick value="' + st.date + '" style="padding:5px 10px">' +
        '</div>' +
        '<div class="chips" style="margin-bottom:7px">' +
        pays.map(function (p) {
          return '<button class="chip ' + (p.id === st.paymentMethodId ? 'on' : '') + '" data-pay="' + p.id + '">' + p.emoji + ' ' + U.esc(p.name) + '</button>';
        }).join('') + '</div>' +
        '<input class="input" data-note data-keep="entry-note" placeholder="備註（例：星巴克、小七早餐）" value="' + U.esc(st.note) + '">' +
        '</div>';
    }


    h += '</div></div><div class="entry-foot">';
    h += '<button class="chip" data-toggle-more style="width:100%;text-align:center;margin:6px 0 2px;background:transparent;color:var(--text-3)">' +
      (st.showMore ? '收合 ▴' : U.fmtDate(st.date) + ' · ' + Repo.pay(st.paymentMethodId).name + (st.note ? ' · ' + U.esc(st.note) : '') + '  ▾') + '</button>';

    /* 數字鍵盤固定在下方，永遠看得到「完成」 */
    h += '<div class="keypad">' +
      key('7') + key('8') + key('9') + opKey('del', '⌫') +
      key('4') + key('5') + key('6') + opKey('plus', '＋') +
      key('1') + key('2') + key('3') +
      '<button class="key go" data-go ' + (v > 0 && st.categoryId ? '' : 'disabled') + '>' + (st.editId ? '儲存' : '完成') + '</button>' +
      key('0') + key('00') + key('.') +
      '</div>';

    if (st.editId) {
      h += '<button class="btn danger block" style="margin-top:10px" data-del>🗑 刪除這筆</button>';
    }
    return h + '</div>';
  }
  function key(k) { return '<button class="key num" data-k="' + k + '">' + k + '</button>'; }
  function opKey(k, label) { return '<button class="key op" data-k="' + k + '">' + label + '</button>'; }

  function repaint() {
    if (!api || !st) return;          /* 面板已經關掉就不用重繪 */
    var cs = sortedCats(st.type);
    if (!cs.some(function (c) { return c.id === st.categoryId; })) {
      st.categoryId = cs.length ? cs[0].id : null;
    }
    var snap = UI.captureFocus();
    api.setBody(render());
    bind(api);
    fit();
    UI.restoreFocus(snap);
  }

  /* 類別格只顯示完整的整排，不切一半：
     依這支手機還剩多少高度，算出最多能放幾整排 */
  function fit(root) {
    root = root || (api && api.el);
    if (!root) return;
    var scroll = root.querySelector('.entry-scroll');
    var grid = root.querySelector('.catgrid');
    var foot = root.querySelector('.entry-foot');
    if (!scroll || !grid || !grid.children[0]) return;

    var gap = parseFloat(getComputedStyle(grid).rowGap || '8') || 8;
    var rowH = grid.children[0].getBoundingClientRect().height + gap;
    if (!(rowH > gap)) return;

    grid.style.maxHeight = '0px';
    var totalRows = Math.max(1, Math.round((grid.scrollHeight + gap) / rowH));

    var cs = getComputedStyle(root);
    var base = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    Array.prototype.forEach.call(root.children, function (ch) {
      if (!ch.classList.contains('sheet-body')) base += ch.offsetHeight;   /* 把手、標題列 */
    });
    base += scroll.scrollHeight + (foot ? foot.offsetHeight : 0);

    var avail = window.innerHeight * 0.92 - base;
    var rows = Math.max(2, Math.min(totalRows, Math.floor((avail + gap) / rowH)));
    grid.style.maxHeight = (rows * rowH - gap) + 'px';
  }

  /* 長按類別 → 直接編輯（改名、換 emoji、換顏色、刪除） */
  function attachLongPress(a) {
    lp = UI.longPress(a.el, '[data-cat]', function (el) {
      Manage.editCategorySheet(el.dataset.cat, function () { repaint(); });
    });
  }

  /* ---------- 事件 ---------- */
  function bind(a) {
    var root = a.el;
    root.onclick = function (e) {
      var t = e.target.closest('button, input');
      if (!t) return;

      if (t.dataset.k != null) { press(t.dataset.k); return; }
      if (t.dataset.type) {
        if (st.type === t.dataset.type) return;
        st.type = t.dataset.type;
        var cs = sortedCats(st.type);
        if (!cs.some(function (c) { return c.id === st.categoryId; })) st.categoryId = cs.length ? cs[0].id : null;
        repaint(); return;
      }
      if (t.dataset.cat) {
        if (lp && lp.consumed()) return;            /* 長按剛開了編輯視窗，別再選取 */
        st.categoryId = t.dataset.cat; UI.haptic(10); repaint(); return;
      }
      if (t.hasAttribute('data-managecats')) { Manage.categorySheet(repaint); return; }
      if (t.hasAttribute('data-newcat')) { Manage.newCategorySheet(st.type, function (id) { st.categoryId = id; repaint(); }); return; }
      if (t.dataset.date) { st.date = t.dataset.date; repaint(); return; }
      if (t.dataset.pay) { st.paymentMethodId = t.dataset.pay; repaint(); return; }
      if (t.hasAttribute('data-toggle-more')) {
        st.showMore = !st.showMore; repaint();
        if (st.showMore) {                       /* 展開後自動捲到日期／付款那一區 */
          var sc = api && api.el.querySelector('.entry-scroll');
          if (sc) sc.scrollTop = sc.scrollHeight;
        }
        return;
      }
      if (t.dataset.combo) { applyCombo(t.dataset.combo); return; }
      if (t.hasAttribute('data-go')) { save(t); return; }
      if (t.hasAttribute('data-del')) { removeTx(); return; }
    };
    var note = root.querySelector('[data-note]');
    if (note) note.oninput = function () { st.note = note.value; };
    var dp = root.querySelector('[data-datepick]');
    if (dp) dp.onchange = function () { if (dp.value) { st.date = dp.value; repaint(); } };
  }

  function applyCombo(idx) {
    var t = (st._combos || [])[parseInt(idx, 10)];
    if (!t) return;
    Repo.addTx({
      type: t.type, amount: t.amount, categoryId: t.categoryId,
      paymentMethodId: t.paymentMethodId, date: U.today(), note: t.note
    });
    celebrate(t.amount, t.type);
    api.close();
  }

  function save(btn) {
    var v = value();
    if (!(v > 0)) { UI.toast('先輸入金額喔', '✏️'); return; }
    if (!st.categoryId) { UI.toast('選一個類別', '🏷️'); return; }
    var payload = {
      type: st.type, amount: v, categoryId: st.categoryId,
      paymentMethodId: st.paymentMethodId, date: st.date, note: st.note
    };
    if (st.editId) {
      Repo.updateTx(st.editId, payload);
      UI.toast('已更新', '✅');
    } else {
      Repo.addTx(payload);
      var r = btn.getBoundingClientRect();
      celebrate(v, st.type, r.left + r.width / 2, r.top);
    }
    api.close();
  }

  function celebrate(amount, type, x, y) {
    UI.haptic(24);
    UI.flyAmount((type === 'income' ? '+' : '−') + U.money(amount), x, y);
    var s = Repo.settings();
    var newAch = Repo.takeNewAchievements();
    var msg = '🎉 記好了！';
    if (s.streak.count > 1) msg = '🎉 記好了！連續 ' + s.streak.count + ' 天';
    UI.toast(msg);
    if (newAch.length) {
      setTimeout(function () { Achieve.show(newAch); }, 700);
    }
  }

  function removeTx() {
    var id = st.editId;
    UI.confirm({ emoji: '🗑', title: '刪除這筆紀錄？', text: '刪掉之後就找不回來了。', okText: '刪除', danger: true })
      .then(function (ok) {
        if (!ok) return;
        Repo.deleteTx(id);
        UI.toast('已刪除', '🗑');
        if (api) api.close();
      });
  }

  return { open: open };
})();
