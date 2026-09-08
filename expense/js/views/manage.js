/* ── 管理：類別、付款方式、預算 ─────────────────────────── */
var Manage = (function () {

  var EMOJIS = ('🍚 🍜 🍔 🍱 ☕ 🧋 🍺 🍎 🛍️ 👕 👟 💄 🚗 🚕 🚈 ⛽ 🏠 💡 🚿 🧻 💊 🏥 🦷 🧘 ' +
    '🎮 🎬 🎤 🎳 ✈️ 🏖️ 🏨 🎡 💰 🎁 📈 🧾 👦🏻 🍼 🎒 🐶 🚬 🎰 📺 📱 ☁️ 🎧 🛡️ 📚 ' +
    '💳 🏦 🎓 💐 🧸 🔧 ✂️ 🪴 🧼 🎀 ⚽ 🚲 🧳 🍰').split(' ');

  var COLORS = ['#FF8A65', '#F48FB1', '#BA68C8', '#9B8CFF', '#7986CB', '#64B5F6', '#4DD0E1',
    '#3FC79A', '#9CCC65', '#FFC95C', '#FFB74D', '#A1887F', '#90A4AE', '#BDBDBD'];

  /* ---------- 類別管理 ---------- */
  function categorySheet() {
    var api = UI.sheet({ title: '類別管理', body: catBody(), onMount: bindCat });
    categorySheet._api = api;
  }
  function repaintCat() {
    var api = categorySheet._api;
    if (!api) return;
    api.setBody(catBody());
    bindCat(api);
  }
  function catBody() {
    var s = Repo.settings();
    var h = '<div class="seg" style="margin-bottom:12px">' +
      '<button data-catsort="usage" class="' + (s.catSort === 'usage' ? 'on' : '') + '">常用優先</button>' +
      '<button data-catsort="custom" class="' + (s.catSort === 'custom' ? 'on' : '') + '">自訂順序</button></div>' +
      '<div class="tiny faint" style="margin:-6px 0 12px">記帳時類別的排列方式。選「自訂順序」可用 ↑↓ 自己排。</div>';

    ['expense', 'income'].forEach(function (type) {
      var list = Repo.cats({ type: type, withArchived: true });
      h += '<div class="label" style="margin:14px 0 4px">' + (type === 'expense' ? '支出類別' : '收入類別') + '</div>';
      h += '<div class="card" style="margin-bottom:8px">' + list.map(function (c, i) {
        return '<div class="catmanage-row ' + (c.isArchived ? 'arch' : '') + '">' +
          '<span class="ava" style="background:' + U.tint(c.color, .16) + '">' + c.emoji + '</span>' +
          '<span class="n">' + U.esc(c.name) +
          (c.isArchived ? '<span class="tiny faint">　已封存</span>' : '') +
          '<span class="tiny faint" style="display:block;font-weight:600">' + Repo.countTxOfCat(c.id) + ' 筆紀錄</span></span>' +
          (s.catSort === 'custom' && !c.isArchived
            ? '<button class="iconbtn" style="width:30px;height:30px" data-moveup="' + c.id + '" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
              '<button class="iconbtn" style="width:30px;height:30px" data-movedn="' + c.id + '" ' + (i === list.length - 1 ? 'disabled' : '') + '>↓</button>'
            : '') +
          '<button class="iconbtn" data-editcat="' + c.id + '">✏️</button>' +
          '</div>';
      }).join('') + '</div>';
      h += '<button class="btn block sm" data-newcat="' + type + '">➕ 新增' + (type === 'expense' ? '支出' : '收入') + '類別</button>';
    });
    return h;
  }
  function bindCat(api) {
    api.el.onclick = function (e) {
      var t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.catsort) {
        Store.mutate(function (s) { s.settings.catSort = t.dataset.catsort; });
        return repaintCat();
      }
      if (t.dataset.newcat) return newCategorySheet(t.dataset.newcat, repaintCat);
      if (t.dataset.editcat) return editCategorySheet(t.dataset.editcat, repaintCat);
      if (t.dataset.moveup) return move(t.dataset.moveup, -1);
      if (t.dataset.movedn) return move(t.dataset.movedn, 1);
    };
  }
  function move(id, dir) {
    Store.mutate(function (s) {
      var c = s.categories.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      var sib = s.categories.filter(function (x) { return x.type === c.type && !x.isArchived; })
        .sort(function (a, b) { return a.order - b.order; });
      var i = sib.indexOf(c), j = i + dir;
      if (j < 0 || j >= sib.length) return;
      var o = sib[i].order; sib[i].order = sib[j].order; sib[j].order = o;
    });
    repaintCat();
  }

  /* 新增／編輯單一類別 */
  function newCategorySheet(type, cb) {
    catForm(null, { type: type || 'expense', emoji: '🏷️', color: COLORS[0], name: '' }, cb);
  }
  function editCategorySheet(id, cb) {
    var c = Store.get().categories.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    catForm(id, JSON.parse(JSON.stringify(c)), cb);
  }

  function catForm(id, d, cb) {
    var api = UI.sheet({ title: id ? '編輯類別' : '新增類別', body: body(), onMount: bind });

    function body() {
      var h = '<div style="text-align:center;margin-bottom:12px">' +
        '<div class="ava" style="width:64px;height:64px;border-radius:21px;display:inline-grid;place-items:center;font-size:32px;background:' + U.tint(d.color, .18) + '">' + d.emoji + '</div></div>';
      h += '<div class="field"><span class="label">名稱</span>' +
        '<input class="input" data-keep="cat-name" data-cf="name" placeholder="類別名稱" value="' + U.esc(d.name) + '"></div>';
      h += '<div class="field"><span class="label">圖示</span>' +
        '<div class="catgrid" style="grid-template-columns:repeat(8,1fr);max-height:132px;overflow-y:auto">' +
        EMOJIS.map(function (e) {
          return '<button class="catcell ' + (e === d.emoji ? 'on' : '') + '" data-cemoji="' + e + '" style="padding:6px 0"><span class="e">' + e + '</span></button>';
        }).join('') + '</div>' +
        '<input class="input" data-cf="emoji" data-keep="cat-emoji" placeholder="也可以直接貼上任何 emoji" value="' + U.esc(d.emoji) + '" style="margin-top:8px;text-align:center"></div>';
      h += '<div class="field"><span class="label">顏色</span><div class="chips">' +
        COLORS.map(function (c) {
          return '<button data-ccolor="' + c + '" style="flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:' + c +
            ';border:3px solid ' + (c === d.color ? 'var(--text)' : 'transparent') + '"></button>';
        }).join('') + '</div></div>';
      h += '<div class="field"><span class="label">類型</span><div class="seg">' +
        '<button data-ctype="expense" class="' + (d.type === 'expense' ? 'on' : '') + '">支出</button>' +
        '<button data-ctype="income" class="' + (d.type === 'income' ? 'on' : '') + '">收入</button>' +
        '<button data-ctype="both" class="' + (d.type === 'both' ? 'on' : '') + '">兩者</button></div></div>';
      h += '<button class="btn primary block" data-csave>' + (id ? '儲存' : '建立') + '</button>';
      if (id) {
        var used = Repo.countTxOfCat(id);
        h += '<button class="btn danger block" style="margin-top:9px" data-cdel>' +
          (used ? '🗄 封存或移轉（有 ' + used + ' 筆紀錄）' : '🗑 刪除類別') + '</button>';
        if (d.isArchived) h += '<button class="btn block" style="margin-top:9px" data-cunarch>♻️ 取消封存</button>';
      }
      return h;
    }
    function repaint() {
      var snap = UI.captureFocus();
      api.setBody(body()); bind(api); UI.restoreFocus(snap);
    }
    function bind(a) {
      a.el.onclick = function (e) {
        var t = e.target.closest('button');
        if (!t) return;
        if (t.dataset.cemoji) { d.emoji = t.dataset.cemoji; return repaint(); }
        if (t.dataset.ccolor) { d.color = t.dataset.ccolor; return repaint(); }
        if (t.dataset.ctype) { d.type = t.dataset.ctype; return repaint(); }
        if (t.hasAttribute('data-csave')) return save();
        if (t.hasAttribute('data-cdel')) return remove();
        if (t.hasAttribute('data-cunarch')) { Repo.updateCat(id, { isArchived: false }); a.close(); if (cb) cb(); return; }
      };
      a.el.oninput = function (e) {
        var k = e.target.dataset.cf;
        if (k) d[k] = e.target.value;
      };
    }
    function save() {
      if (!String(d.name).trim()) { UI.toast('取個名字吧', '✏️'); return; }
      if (!String(d.emoji).trim()) d.emoji = '🏷️';
      if (id) { Repo.updateCat(id, { name: d.name.trim(), emoji: d.emoji, color: d.color, type: d.type }); UI.toast('已更新', '✅'); api.close(); if (cb) cb(); }
      else {
        var newId = Repo.addCat(d);
        UI.toast('類別建好了', '🏷️'); api.close();
        if (cb) cb(newId);
      }
    }
    function remove() {
      var used = Repo.countTxOfCat(id);
      if (!used) {
        UI.confirm({ emoji: '🗑', title: '刪除「' + d.name + '」？', okText: '刪除', danger: true }).then(function (ok) {
          if (!ok) return;
          Repo.deleteCat(id); UI.toast('已刪除', '🗑'); api.close(); if (cb) cb();
        });
        return;
      }
      /* 有紀錄 → 讓使用者選擇移轉或封存，舊帳不會變孤兒 */
      var others = Repo.cats({ type: d.type }).filter(function (c) { return c.id !== id; });
      UI.sheet({
        title: '「' + U.esc(d.name) + '」有 ' + used + ' 筆紀錄',
        body: '<div class="tiny faint" style="margin-bottom:12px">為了不讓舊紀錄變成「未分類」，請選一種處理方式：</div>' +
          '<button class="btn block" data-arch>🗄 封存（保留紀錄，記帳時不再出現）</button>' +
          '<div class="label" style="margin:16px 0 6px">或把紀錄搬到別的類別後刪除</div>' +
          '<div class="card" style="padding:6px 14px">' + others.map(function (c) {
            return '<button class="catmanage-row" style="width:100%;text-align:left" data-moveto="' + c.id + '">' +
              '<span class="ava" style="background:' + U.tint(c.color, .16) + '">' + c.emoji + '</span>' +
              '<span class="n">搬到「' + U.esc(c.name) + '」</span><span class="faint">›</span></button>';
          }).join('') + '</div>',
        onMount: function (a2) {
          a2.el.onclick = function (e) {
            var t = e.target.closest('button');
            if (!t) return;
            if (t.hasAttribute('data-arch')) {
              Repo.updateCat(id, { isArchived: true });
              UI.toast('已封存', '🗄'); a2.close(); api.close(); if (cb) cb();
            } else if (t.dataset.moveto) {
              Repo.deleteCat(id, t.dataset.moveto);
              UI.toast('已搬移並刪除', '✅'); a2.close(); api.close(); if (cb) cb();
            }
          };
        }
      });
    }
  }

  /* ---------- 付款方式 ---------- */
  function paymentSheet() {
    var api = UI.sheet({ title: '付款方式', body: body(), onMount: bind });
    function body() {
      return '<div class="card" style="margin-bottom:10px">' + Repo.pays(true).map(function (p) {
        return '<div class="catmanage-row ' + (p.isArchived ? 'arch' : '') + '">' +
          '<span class="ava" style="background:var(--bg-soft)">' + p.emoji + '</span>' +
          '<span class="n">' + U.esc(p.name) + (p.isArchived ? '<span class="tiny faint">　已封存</span>' : '') + '</span>' +
          '<button class="iconbtn" data-editpay="' + p.id + '">✏️</button></div>';
      }).join('') + '</div>' +
        '<button class="btn block sm" data-newpay>➕ 新增付款方式</button>';
    }
    function repaint() { api.setBody(body()); bind(api); }
    function bind(a) {
      a.el.onclick = function (e) {
        var t = e.target.closest('button');
        if (!t) return;
        if (t.hasAttribute('data-newpay')) return payForm(null, repaint);
        if (t.dataset.editpay) return payForm(t.dataset.editpay, repaint);
      };
    }
  }
  function payForm(id, cb) {
    var p = id ? JSON.parse(JSON.stringify(Store.get().payments.filter(function (x) { return x.id === id; })[0])) : { name: '', emoji: '💠', kind: 'cash' };
    var PE = ['💵', '💳', '📱', '🏦', '🚈', '🎫', '🪙', '🧾', '💰', '🏧'];
    var api = UI.sheet({
      title: id ? '編輯付款方式' : '新增付款方式',
      body: body(), onMount: bind
    });
    function body() {
      var h = '<div class="field"><span class="label">名稱</span>' +
        '<input class="input" data-keep="pay-name" data-pf="name" placeholder="例：國泰 CUBE 卡" value="' + U.esc(p.name) + '"></div>' +
        '<div class="field"><span class="label">圖示</span><div class="chips">' +
        PE.map(function (e) { return '<button class="chip ' + (e === p.emoji ? 'on' : '') + '" data-pemoji="' + e + '">' + e + '</button>'; }).join('') +
        '</div></div>' +
        '<button class="btn primary block" data-psave>' + (id ? '儲存' : '建立') + '</button>';
      if (id) h += '<button class="btn danger block" style="margin-top:9px" data-pdel>🗑 刪除</button>';
      return h;
    }
    function repaint() { var s = UI.captureFocus(); api.setBody(body()); bind(api); UI.restoreFocus(s); }
    function bind(a) {
      a.el.onclick = function (e) {
        var t = e.target.closest('button');
        if (!t) return;
        if (t.dataset.pemoji) { p.emoji = t.dataset.pemoji; return repaint(); }
        if (t.hasAttribute('data-psave')) {
          if (!String(p.name).trim()) { UI.toast('取個名字吧', '✏️'); return; }
          if (id) Repo.updatePay(id, { name: p.name.trim(), emoji: p.emoji });
          else Repo.addPay(p);
          UI.toast('已儲存', '✅'); a.close(); if (cb) cb(); return;
        }
        if (t.hasAttribute('data-pdel')) {
          UI.confirm({ emoji: '🗑', title: '刪除「' + p.name + '」？', text: '若已有紀錄使用，會改為封存。', okText: '刪除', danger: true })
            .then(function (ok) {
              if (!ok) return;
              var r = Repo.deletePay(id);
              UI.toast(r === 'archived' ? '已封存（有紀錄使用中）' : '已刪除', '🗑');
              a.close(); if (cb) cb();
            });
        }
      };
      a.el.oninput = function (e) { if (e.target.dataset.pf) p[e.target.dataset.pf] = e.target.value; };
    }
  }

  /* ---------- 預算 ---------- */
  function budgetSheet() {
    var s = Repo.settings();
    var mp = U.period('month', 0, s);
    var key = Insights.budgetKey(mp);
    var existing = Repo.budgetFor(key);
    var d = {
      total: existing.total || '',
      categories: Object.assign({}, existing.categories),
      applyDefault: existing.inherited || !existing.exists
    };
    var api = UI.sheet({ title: '每月預算 🎯', body: body(), onMount: bind });

    function body() {
      var cats = Repo.cats({ type: 'expense' });
      var used = Q.byCategory(mp, 'expense');
      var usedMap = {}; used.rows.forEach(function (r) { usedMap[r.categoryId] = r.amount; });
      var catSum = Object.keys(d.categories).reduce(function (a, k) { return a + (Number(d.categories[k]) || 0); }, 0);
      var total = Number(d.total) || 0;

      var h = '<div class="tiny faint" style="margin-bottom:12px">設定 ' + mp.label + ' 的預算。設好之後首頁會出現「今天還能花多少」。</div>';

      h += '<div class="field"><span class="label">本月總預算</span>' +
        '<input class="input num" data-keep="b-total" data-bf="total" type="number" inputmode="decimal" placeholder="例：60000" value="' + d.total + '" style="font-size:22px;font-weight:800"></div>';

      h += '<button class="mrow" data-toggle-default style="background:var(--card);border-radius:var(--r-md);width:100%;box-shadow:var(--sh-1);margin-bottom:14px">' +
        '<span class="e">🔁</span><span class="n">每個月沿用這組預算' +
        '<span class="tiny faint" style="display:block;font-weight:600">關閉時只套用在 ' + mp.label + '</span></span>' +
        '<span class="v">' + (d.applyDefault ? '✅ 開' : '⬜ 關') + '</span></button>';

      h += '<div class="label" style="margin-bottom:6px">分類預算（留空 = 不限制）</div>';
      h += '<div class="card">' + cats.map(function (c) {
        var v = d.categories[c.id] == null ? '' : d.categories[c.id];
        var u = usedMap[c.id] || 0;
        return '<div class="catmanage-row">' +
          '<span class="ava" style="background:' + U.tint(c.color, .16) + '">' + c.emoji + '</span>' +
          '<span class="n">' + U.esc(c.name) + '<span class="tiny faint" style="display:block;font-weight:600">本月已花 ' + U.money(u) + '</span></span>' +
          '<input class="input num" data-keep="bc-' + c.id + '" data-bcat="' + c.id + '" type="number" inputmode="decimal" placeholder="—" value="' + v + '" style="width:96px;text-align:right;padding:9px 11px">' +
          '</div>';
      }).join('') + '</div>';

      h += '<div class="insight" style="margin-top:12px"><span class="e">🧮</span><span>分類預算合計 <b>' + U.money(catSum) + '</b>' +
        (total ? '，總預算 <b>' + U.money(total) + '</b>' + (catSum > total ? '（分類合計超過總預算了）' : '，還有 ' + U.money(total - catSum) + ' 沒分配') : '') +
        '</span></div>';

      h += '<button class="btn primary block" style="margin-top:6px" data-bsave>儲存預算</button>';
      if (existing.exists) h += '<button class="btn danger block" style="margin-top:9px" data-bclear>清除本月預算</button>';
      return h;
    }
    function repaint() { var s2 = UI.captureFocus(); api.setBody(body()); bind(api); UI.restoreFocus(s2); }
    function bind(a) {
      a.el.onclick = function (e) {
        var t = e.target.closest('button');
        if (!t) return;
        if (t.hasAttribute('data-toggle-default')) { d.applyDefault = !d.applyDefault; return repaint(); }
        if (t.hasAttribute('data-bsave')) {
          var cats = {};
          Object.keys(d.categories).forEach(function (k) {
            var v = Number(d.categories[k]);
            if (v > 0) cats[k] = v;
          });
          var payload = { total: Number(d.total) || 0, categories: cats };
          if (d.applyDefault) { Repo.setBudget('default', payload); Repo.clearBudget(key); }
          else Repo.setBudget(key, payload);
          UI.toast('預算設定好了', '🎯');
          var na = Repo.takeNewAchievements();
          a.close();
          if (na.length) setTimeout(function () { Achieve.show(na); }, 500);
          return;
        }
        if (t.hasAttribute('data-bclear')) {
          UI.confirm({ emoji: '🧹', title: '清除預算設定？', okText: '清除', danger: true }).then(function (ok) {
            if (!ok) return;
            Repo.clearBudget(key); Repo.clearBudget('default');
            UI.toast('已清除', '🧹'); a.close();
          });
        }
      };
      a.el.oninput = U.debounce(function (e) {
        if (e.target.dataset.bf) { d.total = e.target.value; repaintSummaryOnly(); }
        else if (e.target.dataset.bcat) {
          var v = e.target.value;
          if (v === '') delete d.categories[e.target.dataset.bcat];
          else d.categories[e.target.dataset.bcat] = v;
          repaintSummaryOnly();
        }
      }, 320);
      function repaintSummaryOnly() {
        var catSum = Object.keys(d.categories).reduce(function (acc, k) { return acc + (Number(d.categories[k]) || 0); }, 0);
        var total = Number(d.total) || 0;
        var box = a.el.querySelector('.insight span:last-child');
        if (box) {
          box.innerHTML = '分類預算合計 <b>' + U.money(catSum) + '</b>' +
            (total ? '，總預算 <b>' + U.money(total) + '</b>' + (catSum > total ? '（分類合計超過總預算了）' : '，還有 ' + U.money(total - catSum) + ' 沒分配') : '');
        }
      }
    }
  }

  return {
    categorySheet: categorySheet, newCategorySheet: newCategorySheet,
    editCategorySheet: editCategorySheet, paymentSheet: paymentSheet, budgetSheet: budgetSheet,
    EMOJIS: EMOJIS, COLORS: COLORS
  };
})();
