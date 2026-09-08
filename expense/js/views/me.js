/* ── 我的：預算、類別、付款方式、備份、外觀 ───────────────── */
var Me = (function () {

  function render() {
    var s = Repo.settings();
    var txs = Repo.txs();
    var mp = U.period('month', 0, s);
    var b = Repo.budgetFor(Insights.budgetKey(mp));
    var firstDate = txs.length ? txs.map(function (t) { return t.date; }).sort()[0] : null;
    var days = firstDate ? U.diffDays(firstDate, U.today()) + 1 : 0;
    var h = '';

    h += '<div class="card" style="display:flex;align-items:center;gap:14px">' +
      '<div>' + UI.piggy(62) + '</div>' +
      '<div style="flex:1"><div class="b" style="font-size:16px">記帳小豬</div>' +
      '<div class="tiny faint">陪你記帳 ' + days + ' 天，累積 ' + txs.length + ' 筆紀錄</div>' +
      '<div class="tiny faint">最佳連續紀錄 ' + (s.streak.best || 0) + ' 天　·　成就 ' + (s.achievements || []).length + '/' + Schema.ACHIEVEMENTS.length + '</div>' +
      '</div></div>';

    h += '<div class="label" style="margin:16px 2px 6px">記帳設定</div><div class="menu">' +
      mrow('🎯', '每月預算', b.exists ? (b.total ? U.money(b.total) : '已設分類預算') : '未設定', 'go-budget') +
      mrow('🏷️', '類別管理', Repo.cats({}).length + ' 個', 'go-cats') +
      mrow('💳', '付款方式', Repo.pays().length + ' 種', 'go-pays') +
      mrow('🔁', '固定支出', Repo.recurrings().filter(function (r) { return r.isActive; }).length + ' 個', 'go-recur') +
      '</div>';

    h += '<div class="label" style="margin:16px 2px 6px">週期設定</div><div class="menu">' +
      mrow('📅', '每月結算起始日', s.monthStartDay === 1 ? '每月 1 號' : '每月 ' + s.monthStartDay + ' 號', 'set-monthstart') +
      mrow('🗓', '每週第一天', s.weekStartsOn === 0 ? '星期日' : '星期一', 'set-weekstart') +
      '</div>';

    h += '<div class="label" style="margin:16px 2px 6px">回顧與分析</div><div class="menu">' +
      mrow('📮', '上個月回顧', '', 'go-review') +
      mrow('📊', '統計分析', '', 'go-stats') +
      '</div>';

    h += '<div class="label" style="margin:16px 2px 6px">外觀</div>' +
      '<div class="card"><div class="seg">' +
      [['auto', '跟隨系統'], ['light', '淺色'], ['dark', '深色']].map(function (x) {
        return '<button data-act="set-theme" data-k="' + x[0] + '" class="' + (s.theme === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
      }).join('') + '</div></div>';

    h += '<div class="label" style="margin:16px 2px 6px">資料備份（重要）</div><div class="menu">' +
      mrow('📤', '匯出備份（JSON）', '', 'export-json') +
      mrow('📊', '匯出報表（CSV）', '', 'export-csv') +
      mrow('📥', '匯入備份', '', 'import-json') +
      mrow('🧹', '清除所有資料', '', 'wipe') +
      '</div>';

    h += '<div class="insight"><span class="e">🔒</span><span>所有資料只存在<b>這台裝置的瀏覽器</b>裡，不會上傳到任何伺服器。<b>換手機或清除瀏覽器資料前，記得先匯出備份。</b></span></div>';
    h += '<div class="tiny faint" style="text-align:center;padding:10px 0 6px">記帳小豬 · 純本機 PWA · 可加入主畫面離線使用</div>';
    return h;
  }

  function mrow(e, n, v, act) {
    return '<button class="mrow" data-act="' + act + '"><span class="e">' + e + '</span>' +
      '<span class="n">' + n + '</span><span class="v">' + U.esc(v) + '</span><span class="arr">›</span></button>';
  }

  /* ---------- 月結日 / 週起始 ---------- */
  function monthStartSheet() {
    var days = [];
    for (var i = 1; i <= 28; i++) days.push(i);
    UI.sheet({
      title: '每月結算起始日',
      body: '<div class="tiny faint" style="margin-bottom:12px">如果你的薪水 5 號入帳，把起始日設成 5，「本月」就會從 5 號算到下個月 4 號。</div>' +
        '<div class="catgrid" style="grid-template-columns:repeat(7,1fr)">' +
        days.map(function (d) {
          return '<button class="catcell ' + (Repo.settings().monthStartDay === d ? 'on' : '') + '" data-msd="' + d + '">' +
            '<span class="n" style="font-size:14px">' + d + '</span></button>';
        }).join('') + '</div>',
      onMount: function (a) {
        a.el.onclick = function (e) {
          var t = e.target.closest('[data-msd]');
          if (!t) return;
          Store.mutate(function (s) { s.settings.monthStartDay = parseInt(t.dataset.msd, 10); });
          UI.toast('已設為每月 ' + t.dataset.msd + ' 號', '📅');
          a.close();
        };
      }
    });
  }
  function weekStartSheet() {
    UI.sheet({
      center: true, title: '每週第一天',
      body: '<button class="btn block" style="margin-bottom:9px" data-ws="1">星期一</button>' +
        '<button class="btn block" data-ws="0">星期日</button>',
      onMount: function (a) {
        a.el.onclick = function (e) {
          var t = e.target.closest('[data-ws]');
          if (!t) return;
          Store.mutate(function (s) { s.settings.weekStartsOn = parseInt(t.dataset.ws, 10); });
          UI.toast('已更新', '🗓'); a.close();
        };
      }
    });
  }

  /* ---------- 備份 ---------- */
  function download(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: (mime || 'application/json') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1200);
      UI.toast('已匯出 ' + filename, '📤');
    } catch (e) {
      UI.toast('這個瀏覽器不支援下載，請改用複製', '⚠️');
      copySheet(text);
    }
  }
  function copySheet(text) {
    UI.sheet({
      title: '複製備份內容',
      body: '<textarea class="input" rows="10" style="font-size:11px">' + U.esc(text) + '</textarea>' +
        '<div class="tiny faint" style="margin-top:8px">全選複製後貼到記事本存起來即可。</div>'
    });
  }

  function exportJSON() {
    var data = JSON.parse(JSON.stringify(Store.get()));
    delete data._newAchievements;
    download('moneybuddy-backup-' + U.today() + '.json', JSON.stringify(data, null, 2));
  }

  function exportCSV() {
    var rows = [['日期', '收支', '金額', '類別', '付款方式', '備註', '來自週期']];
    Repo.txs().slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (t) {
      rows.push([
        t.date, t.type === 'income' ? '收入' : '支出', t.amount,
        Repo.cat(t.categoryId).name, Repo.pay(t.paymentMethodId).name,
        t.note || '', t.recurringId ? '是' : ''
      ]);
    });
    var csv = '﻿' + rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
    download('moneybuddy-' + U.today() + '.csv', csv, 'text/csv');
  }

  function importJSON() {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var data;
        try { data = JSON.parse(fr.result); } catch (e) { UI.toast('檔案格式不正確', '⚠️'); return; }
        if (!data || !Array.isArray(data.transactions)) { UI.toast('這不像是記帳備份檔', '⚠️'); return; }
        UI.confirm({
          emoji: '📥', title: '匯入備份？',
          text: '會<b>覆蓋</b>目前裝置上的所有資料（' + Repo.txs().length + ' 筆 → ' + data.transactions.length + ' 筆）。',
          okText: '匯入', danger: true
        }).then(function (ok) {
          if (!ok) return;
          Store.replaceAll(data);
          Repo.refreshStreakNow();
          Store.emit();
          UI.toast('匯入完成', '✅');
        });
      };
      fr.readAsText(f);
    };
    input.click();
  }

  function wipe() {
    UI.confirm({
      emoji: '🧹', title: '清除所有資料？',
      text: '所有交易、類別設定、預算、固定支出都會消失，<b>無法復原</b>。建議先匯出備份。',
      okText: '我確定清除', danger: true
    }).then(function (ok) {
      if (!ok) return;
      UI.confirm({ emoji: '⚠️', title: '真的要清除嗎？', text: '這是最後確認。', okText: '清除', danger: true })
        .then(function (ok2) {
          if (!ok2) return;
          Store.reset();
          UI.toast('已清除，重新開始 🌱');
          location.hash = '#/home';
        });
    });
  }

  function topbar() {
    return '<div><h1>我的 👤</h1><div class="sub">設定與備份</div></div>';
  }

  return {
    render: render, topbar: topbar, monthStartSheet: monthStartSheet, weekStartSheet: weekStartSheet,
    exportJSON: exportJSON, exportCSV: exportCSV, importJSON: importJSON, wipe: wipe
  };
})();
