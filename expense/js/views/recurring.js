/* ── 固定支出／週期消費：每個月固定被扣掉多少錢 ─────────── */
var Recur = (function () {

  function render() {
    var s = Repo.settings();
    var all = Repo.recurrings();
    var active = all.filter(function (r) { return r.isActive; });
    var expenses = active.filter(function (r) { return r.type === 'expense'; });
    var monthly = expenses.reduce(function (a, r) { return a + Repo.monthlyEquivalent(r); }, 0);
    var incomes = active.filter(function (r) { return r.type === 'income'; });
    var monthlyIn = incomes.reduce(function (a, r) { return a + Repo.monthlyEquivalent(r); }, 0);
    var mp = U.period('month', 0, s);
    var thisMonth = active.filter(function (r) {
      return r.type === 'expense' && r.nextDueDate >= mp.from && r.nextDueDate <= mp.to;
    }).reduce(function (a, r) { return a + r.amount; }, 0);

    var h = '';

    /* 主卡 */
    h += '<div class="fixedhero">' +
      '<div class="label">每月固定支出（月均）</div>' +
      '<div class="m-xl money num">' + U.moneyR(monthly) + '</div>' +
      '<div class="split">' +
      '<div><div class="label">項目</div><div class="v num">' + expenses.length + ' 個</div></div>' +
      '<div><div class="label">本月待扣</div><div class="v num">' + U.money(thisMonth) + '</div></div>' +
      '<div><div class="label">年度總額</div><div class="v num">' + U.moneyR(monthly * 12) + '</div></div>' +
      '</div>' +
      (monthlyIn > 0 ? '<div class="tiny" style="margin-top:10px;color:rgba(255,255,255,.9)">＋ 固定收入月均 ' + U.moneyR(monthlyIn) + '</div>' : '') +
      '</div>';

    /* 到期待確認 */
    var dues = Repo.dueList();
    if (dues.length) {
      h += '<div class="card"><div class="card-h"><span>🔔</span><span class="t">' + dues.length + ' 筆待確認</span></div>' +
        dues.map(function (d) {
          var c = Repo.cat(d.categoryId);
          return '<div class="budget-row"><div class="top">' +
            '<span>' + c.emoji + '</span><span class="n">' + U.esc(d.name) + '</span>' +
            '<span class="v num">' + U.money(d.amount) + '</span></div>' +
            '<div class="tiny faint" style="margin:2px 0 8px">應扣款日 ' + U.fmtDayHeader(d.nextDueDate) + '</div>' +
            '<div style="display:flex;gap:7px">' +
            '<button class="btn sm primary" style="flex:1" data-act="due-ok" data-id="' + d.id + '">✅ 記一筆</button>' +
            '<button class="btn sm" style="flex:1" data-act="due-edit" data-id="' + d.id + '">✏️ 改金額</button>' +
            '<button class="btn sm ghost" style="flex:1;background:var(--bg-soft)" data-act="due-skip" data-id="' + d.id + '">⏭ 跳過</button>' +
            '</div></div>';
        }).join('') + '</div>';
    }

    if (!all.length) {
      h += '<div class="card">' + UI.empty('還沒有固定支出',
        '把房租、Netflix、健身房、保險加進來，<br>就能知道每個月固定被扣多少錢。') +
        '<button class="btn primary block" data-act="rec-new">➕ 新增固定支出</button></div>';
      h += examplesCard();
      return h;
    }

    /* 分類彙總（月均） */
    var byCat = {};
    expenses.forEach(function (r) {
      byCat[r.categoryId] = (byCat[r.categoryId] || 0) + Repo.monthlyEquivalent(r);
    });
    var catRows = Object.keys(byCat).map(function (id) {
      return { c: Repo.cat(id), v: byCat[id] };
    }).sort(function (a, b) { return b.v - a.v; });
    if (catRows.length) {
      h += '<div class="card"><div class="card-h"><span>📊</span><span class="t">固定支出組成（月均）</span></div>' +
        catRows.map(function (r) {
          var pc = U.pct(r.v, monthly);
          return '<div class="budget-row"><div class="top"><span>' + r.c.emoji + '</span>' +
            '<span class="n">' + U.esc(r.c.name) + '</span>' +
            '<span class="v num">' + U.moneyR(r.v) + '　' + pc + '%</span></div>' +
            '<div class="bar thin"><i style="width:' + pc + '%;background:' + r.c.color + '"></i></div></div>';
        }).join('') +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:13px;padding-top:11px;border-top:1px solid var(--line)">' +
        '<span class="b">每月固定支出</span><span class="money m-md num">' + U.moneyR(monthly) + '</span></div>' +
        '</div>';
    }

    /* 未來 30 天時間軸 */
    var up = Repo.upcoming(30);
    h += '<div class="card"><div class="card-h"><span>🗓</span><span class="t">未來 30 天將扣款</span><span class="spacer"></span>' +
      '<span class="more num">' + U.money(up.filter(function (r) { return r.type === 'expense'; }).reduce(function (a, r) { return a + r.amount; }, 0)) + '</span></div>';
    if (!up.length) {
      h += '<div class="tiny faint">未來 30 天沒有排定的扣款，可以喘口氣 🍃</div>';
    } else {
      h += '<div class="timeline">' + up.map(function (r) {
        var c = Repo.cat(r.categoryId);
        var days = U.diffDays(U.today(), r.nextDueDate);
        var cls = days === 0 ? 'today' : (days <= 3 ? 'soon' : '');
        return '<button class="tlrow ' + cls + '" data-act="rec-edit" data-id="' + r.id + '" style="width:100%;text-align:left">' +
          '<span class="d">' + U.relDay(r.nextDueDate) + '</span>' +
          '<span>' + c.emoji + '</span>' +
          '<span class="n">' + U.esc(r.name) + '</span>' +
          '<span class="a num ' + (r.type === 'income' ? 'pos' : '') + '">' + (r.type === 'income' ? '+' : '') + U.money(r.amount) + '</span>' +
          '</button>';
      }).join('') + '</div>';
    }
    h += '</div>';

    /* 全部項目 */
    h += '<div class="card"><div class="card-h"><span>🔁</span><span class="t">全部週期項目</span><span class="spacer"></span>' +
      '<button class="more" data-act="rec-new">＋ 新增</button></div>' +
      all.slice().sort(function (a, b) {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return Repo.monthlyEquivalent(b) - Repo.monthlyEquivalent(a);
      }).map(function (r) {
        var c = Repo.cat(r.categoryId);
        var days = r.isActive ? U.diffDays(U.today(), r.nextDueDate) : null;
        return '<button class="recrow ' + (r.isActive ? '' : 'off') + '" data-act="rec-edit" data-id="' + r.id + '" style="width:100%">' +
          '<span class="ava" style="background:' + U.tint(c.color, .16) + '">' + c.emoji + '</span>' +
          '<span class="mid"><span class="n">' + U.esc(r.name) + (r.autoPost ? ' ⚡' : '') + '</span>' +
          '<span class="s">' + Repo.freqLabel(r) + ' · 月均 ' + U.moneyR(Repo.monthlyEquivalent(r)) +
          (r.isActive ? '' : ' · 已暫停') + '</span></span>' +
          '<span class="right"><span class="a num ' + (r.type === 'income' ? 'pos' : '') + '" style="display:block">' +
          (r.type === 'income' ? '+' : '') + U.money(r.amount) + '</span>' +
          (r.isActive ? '<span class="nx ' + (days <= 3 ? 'soon' : '') + '">' + U.relDay(r.nextDueDate) + '扣</span>' : '<span class="nx">暫停中</span>') +
          '</span></button>';
      }).join('') + '</div>';

    h += '<div class="insight"><span class="e">⚡</span><span>標記 <b>⚡</b> 的項目會在到期日<b>自動記帳</b>；沒標記的會在首頁跳出來讓你一鍵確認，避免帳目跟實際不符。</span></div>';
    h += '<div class="insight"><span class="e">🔔</span><span>這是純本機 App，沒有背景推播。<b>每次打開 App 就會提醒</b>你即將／已到期的扣款。</span></div>';
    return h;
  }

  function examplesCard() {
    var ex = [
      { name: 'Netflix', amount: 390, unit: 'month', interval: 1, emoji: '📺', catName: '訂閱' },
      { name: '房租', amount: 20000, unit: 'month', interval: 1, emoji: '🏠', catName: '居住' },
      { name: '健身房', amount: 1200, unit: 'month', interval: 1, emoji: '🎮', catName: '娛樂' },
      { name: '保險', amount: 18000, unit: 'year', interval: 1, emoji: '🛡️', catName: '保險' }
    ];
    return '<div class="card"><div class="card-h"><span>✨</span><span class="t">常見範例（點一下就建立）</span></div>' +
      ex.map(function (e, i) {
        return '<button class="recrow" data-act="rec-example" data-i="' + i + '" style="width:100%">' +
          '<span class="ava" style="background:var(--bg-soft)">' + e.emoji + '</span>' +
          '<span class="mid"><span class="n">' + e.name + '</span>' +
          '<span class="s">' + (e.unit === 'year' ? '每年' : '每月') + ' · ' + e.catName + '</span></span>' +
          '<span class="right"><span class="a num">' + U.money(e.amount) + '</span></span></button>';
      }).join('') + '</div>';
  }
  function example(i) {
    var ex = [
      { name: 'Netflix', amount: 390, unit: 'month', catName: '訂閱' },
      { name: '房租', amount: 20000, unit: 'month', catName: '居住' },
      { name: '健身房', amount: 1200, unit: 'month', catName: '娛樂' },
      { name: '保險', amount: 18000, unit: 'year', catName: '保險' }
    ][i];
    if (!ex) return;
    var cats = Repo.cats({ type: 'expense' });
    var c = cats.filter(function (x) { return x.name === ex.catName; })[0] || cats[0];
    editSheet(null, { name: ex.name, amount: ex.amount, categoryId: c.id, freq: { unit: ex.unit, interval: 1 } });
  }


  /* 依名稱猜類別，少按一次是一次 */
  var GUESS = [
    { k: ['netflix', 'spotify', 'youtube', 'disney', 'icloud', 'apple', 'chatgpt', 'notion', 'kkbox', 'friday', '訂閱', '會員'], c: '訂閱' },
    { k: ['房租', '租金', 'rent', '房貸', '管理費', '水電', '電費', '瓦斯', '網路', 'wifi', '第四台'], c: '居住' },
    { k: ['保險', '壽險', '車險', '意外險', '醫療險', 'insurance'], c: '保險' },
    { k: ['健身', 'gym', '瑜珈', '游泳', '球場', '課程'], c: '娛樂' },
    { k: ['停車', '加油', '月票', '悠遊', '高鐵', '捷運', '機車', '汽車'], c: '交通' },
    { k: ['保母', '幼兒園', '安親', '尿布', '奶粉', '學費', '才藝'], c: '育兒' },
    { k: ['電信', '手機費', '門號'], c: '其他' },
    { k: ['薪水', '薪資', '工資', '獎金', '房租收入', '股利'], c: '薪資' }
  ];
  function guessCategory(name, type) {
    var n = String(name || '').toLowerCase();
    if (!n) return null;
    for (var i = 0; i < GUESS.length; i++) {
      for (var j = 0; j < GUESS[i].k.length; j++) {
        if (n.indexOf(GUESS[i].k[j].toLowerCase()) >= 0) {
          var c = Repo.cats({ type: type }).filter(function (x) { return x.name === GUESS[i].c; })[0];
          if (c) return c.id;
        }
      }
    }
    return null;
  }

  /* ---------- 新增／編輯 sheet ---------- */
  var FREQ_PRESETS = [
    { k: 'w1', label: '每週', unit: 'week', interval: 1 },
    { k: 'm1', label: '每月', unit: 'month', interval: 1 },
    { k: 'm3', label: '每季', unit: 'month', interval: 3 },
    { k: 'y1', label: '每年', unit: 'year', interval: 1 },
    { k: 'custom', label: '自訂', unit: 'month', interval: 2 }
  ];

  function editSheet(id, preset) {
    var r = id ? Repo.recurrings().filter(function (x) { return x.id === id; })[0] : null;
    var d = r ? JSON.parse(JSON.stringify(r)) : Object.assign({
      name: '', type: 'expense', amount: '', categoryId: (Repo.cats({ type: 'expense' })[0] || {}).id,
      paymentMethodId: Repo.settings().lastPaymentId,
      freq: { unit: 'month', interval: 1 },
      nextDueDate: U.today(), endDate: null, autoPost: false, isActive: true, note: ''
    }, preset || {});
    if (preset && preset.freq) d.freq = preset.freq;

    var api = UI.sheet({
      title: id ? '編輯固定支出' : '新增固定支出',
      body: form(d, id),
      onMount: function (a) { bind(a, d, id); }
    });

    function repaint() {
      var snap = UI.captureFocus();
      api.setBody(form(d, id));
      bind(api, d, id);
      UI.restoreFocus(snap);
    }
    editSheet._repaint = repaint;
  }

  function matchPreset(f) {
    var p = FREQ_PRESETS.filter(function (x) { return x.k !== 'custom' && x.unit === f.unit && x.interval === f.interval; })[0];
    return p ? p.k : 'custom';
  }

  function form(d, id) {
    var cats = Repo.cats({ type: d.type });
    var pk = matchPreset(d.freq);
    var h = '';
    h += '<div class="seg" style="margin-bottom:12px">' +
      '<button data-rtype="expense" class="' + (d.type === 'expense' ? 'on' : '') + '">固定支出</button>' +
      '<button data-rtype="income" class="' + (d.type === 'income' ? 'on' : '') + '">固定收入</button></div>';

    h += '<div class="field"><span class="label">名稱</span>' +
      '<input class="input" data-f="name" data-keep="rec-name" placeholder="例：Netflix、房租、健身房" value="' + U.esc(d.name) + '"></div>';

    h += '<div class="row2"><div class="field"><span class="label">金額</span>' +
      '<input class="input num" data-f="amount" data-keep="rec-amount" type="number" inputmode="decimal" placeholder="0" value="' + (d.amount === '' ? '' : d.amount) + '"></div>' +
      '<div class="field"><span class="label">下次扣款日</span>' +
      '<input class="input" data-f="nextDueDate" type="date" value="' + d.nextDueDate + '"></div></div>';

    h += '<div class="field"><span class="label">週期</span>' +
      '<div class="chips">' + FREQ_PRESETS.map(function (p) {
        return '<button class="chip ' + (pk === p.k ? 'on' : '') + '" data-freq="' + p.k + '">' + p.label + '</button>';
      }).join('') + '</div>';
    if (pk === 'custom') {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
        '<span class="small">每</span>' +
        '<input class="input num" data-f="interval" type="number" min="1" style="width:74px;padding:9px 11px" value="' + d.freq.interval + '">' +
        '<div class="seg" style="flex:1">' +
        [['day', '天'], ['week', '週'], ['month', '月'], ['year', '年']].map(function (u) {
          return '<button data-unit="' + u[0] + '" class="' + (d.freq.unit === u[0] ? 'on' : '') + '">' + u[1] + '</button>';
        }).join('') + '</div></div>';
    }
    h += '</div>';

    h += '<div class="field"><span class="label">類別</span>' +
      '<div class="catgrid" style="max-height:132px;overflow-y:auto">' + cats.map(function (c) {
        return '<button class="catcell ' + (c.id === d.categoryId ? 'on' : '') + '" data-rcat="' + c.id + '">' +
          '<span class="e">' + c.emoji + '</span><span class="n">' + U.esc(c.name) + '</span></button>';
      }).join('') + '</div></div>';

    h += '<div class="field"><span class="label">付款方式</span><div class="chips">' +
      Repo.pays().map(function (p) {
        return '<button class="chip ' + (p.id === d.paymentMethodId ? 'on' : '') + '" data-rpay="' + p.id + '">' + p.emoji + ' ' + U.esc(p.name) + '</button>';
      }).join('') + '</div></div>';

    h += '<button class="mrow" data-toggle-auto style="background:var(--card);border-radius:var(--r-md);width:100%;box-shadow:var(--sh-1);margin-bottom:11px">' +
      '<span class="e">⚡</span><span class="n">到期自動記帳<span class="tiny faint" style="display:block;font-weight:600">關閉時會在首頁讓你一鍵確認</span></span>' +
      '<span class="v">' + (d.autoPost ? '✅ 開' : '⬜ 關') + '</span></button>';

    h += '<div class="field"><span class="label">備註（選填）</span>' +
      '<input class="input" data-f="note" data-keep="rec-note" placeholder="例：家庭方案、含水電" value="' + U.esc(d.note || '') + '"></div>';

    h += '<div class="field"><span class="label">結束日（選填，到期後自動停止）</span>' +
      '<input class="input" data-f="endDate" type="date" value="' + (d.endDate || '') + '"></div>';

    if (id) {
      h += '<button class="mrow" data-toggle-active style="background:var(--card);border-radius:var(--r-md);width:100%;box-shadow:var(--sh-1);margin-bottom:11px">' +
        '<span class="e">⏸</span><span class="n">' + (d.isActive ? '暫停這個項目' : '恢復這個項目') + '</span>' +
        '<span class="v">' + (d.isActive ? '進行中' : '已暫停') + '</span></button>';
    }

    h += '<button class="btn primary block" data-rsave>' + (id ? '儲存' : '建立') + '</button>';
    if (id) h += '<button class="btn danger block" style="margin-top:9px" data-rdel>🗑 刪除</button>';
    return h;
  }


  /* 就地更新類別選取，不重繪畫面（避免輸入中焦點被打斷） */
  function highlightCat(root, catId) {
    var cells = root.querySelectorAll('[data-rcat]');
    for (var i = 0; i < cells.length; i++) {
      var on = cells[i].dataset.rcat === catId;
      cells[i].classList.toggle('on', on);
      if (on && cells[i].scrollIntoView) {
        try { cells[i].scrollIntoView({ block: 'nearest' }); } catch (e) {}
      }
    }
  }

  function bind(api, d, id) {
    var root = api.el;
    root.onclick = function (e) {
      var t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.rtype) {
        d.type = t.dataset.rtype;
        var cs = Repo.cats({ type: d.type });
        if (!cs.some(function (c) { return c.id === d.categoryId; })) d.categoryId = (cs[0] || {}).id;
        return editSheet._repaint();
      }
      if (t.dataset.freq) {
        var p = FREQ_PRESETS.filter(function (x) { return x.k === t.dataset.freq; })[0];
        if (p.k === 'custom') d.freq = { unit: d.freq.unit, interval: Math.max(2, d.freq.interval) };
        else d.freq = { unit: p.unit, interval: p.interval };
        return editSheet._repaint();
      }
      if (t.dataset.unit) { d.freq.unit = t.dataset.unit; return editSheet._repaint(); }
      if (t.dataset.rcat) { d.categoryId = t.dataset.rcat; d._catTouched = true; return editSheet._repaint(); }
      if (t.dataset.rpay) { d.paymentMethodId = t.dataset.rpay; return editSheet._repaint(); }
      if (t.hasAttribute('data-toggle-auto')) { d.autoPost = !d.autoPost; return editSheet._repaint(); }
      if (t.hasAttribute('data-toggle-active')) { d.isActive = !d.isActive; return editSheet._repaint(); }
      if (t.hasAttribute('data-rsave')) return save();
      if (t.hasAttribute('data-rdel')) return del();
    };
    root.oninput = function (e) {
      var f = e.target.dataset.f;
      if (!f) return;
      if (f === 'interval') d.freq.interval = Math.max(1, parseInt(e.target.value, 10) || 1);
      else if (f === 'amount') d.amount = e.target.value;
      else d[f] = e.target.value;
      /* 邊打名稱邊猜類別；直接改選取狀態，不重繪，才不會打斷輸入 */
      if (f === 'name' && !id && !d._catTouched) {
        var g = guessCategory(d.name, d.type);
        if (g && g !== d.categoryId) { d.categoryId = g; highlightCat(root, g); }
      }
    };

    function save() {
      if (!String(d.name).trim()) { UI.toast('取個名字吧', '✏️'); return; }
      if (!(Number(d.amount) > 0)) { UI.toast('金額要大於 0', '💰'); return; }
      var payload = {
        name: d.name, type: d.type, amount: Number(d.amount), categoryId: d.categoryId,
        paymentMethodId: d.paymentMethodId, freq: d.freq, nextDueDate: d.nextDueDate,
        endDate: d.endDate || null, autoPost: d.autoPost, isActive: d.isActive, note: d.note
      };
      if (id) { Repo.updateRecurring(id, payload); UI.toast('已更新', '✅'); }
      else { payload.startDate = d.nextDueDate; Repo.addRecurring(payload); UI.toast('固定支出建立好了', '🔁'); }
      if (payload.autoPost) Repo.processAutoPost();   /* 已到期就立刻補記 */
      api.close();
    }
    function del() {
      UI.confirm({ emoji: '🗑', title: '刪除這個固定支出？', text: '已經記下的交易不會被刪除。', okText: '刪除', danger: true })
        .then(function (ok) { if (ok) { Repo.deleteRecurring(id); UI.toast('已刪除', '🗑'); api.close(); } });
    }
  }

  /* 改金額後確認扣款 */
  function editDueAmount(id) {
    var r = Repo.recurrings().filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var api = UI.sheet({
      center: true, title: U.esc(r.name) + ' 這次扣了多少？',
      body: '<input class="input num" id="due-amt" type="number" inputmode="decimal" value="' + r.amount + '" style="text-align:center;font-size:26px;font-weight:800">' +
        '<div class="tiny faint" style="margin:8px 0 14px;text-align:center">只影響這一次，不會改掉原本設定的金額</div>' +
        '<button class="btn primary block" id="due-ok">✅ 記一筆</button>',
      onMount: function (a) {
        var input = a.el.querySelector('#due-amt');
        input.focus(); input.select();
        a.el.querySelector('#due-ok').onclick = function () {
          var v = Number(input.value);
          if (!(v > 0)) { UI.toast('金額要大於 0', '💰'); return; }
          Repo.confirmDue(id, v);
          UI.haptic(20); UI.toast('已記下 ' + U.money(v), '✅');
          a.close();
        };
      }
    });
    return api;
  }

  function topbar() {
    return '<div><h1>固定支出 🔁</h1><div class="sub">每個月被扣掉多少，一目了然</div></div>' +
      '<div class="spacer"></div><button class="iconbtn" data-act="rec-new">＋</button>';
  }

  return { render: render, topbar: topbar, editSheet: editSheet, editDueAmount: editDueAmount, example: example, guessCategory: guessCategory };
})();
