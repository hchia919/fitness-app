/* ── 路由、事件委派、初始化 ─────────────────────────── */
var App = (function () {
  var route = { name: 'home', param: null };

  var VIEWS = {
    home:  { render: function () { return Home.render(); },      topbar: function () { return Home.topbar(); } },
    stats: { render: function () { return Stats.render(); },     topbar: function () { return Stats.topbar(); } },
    recur: { render: function () { return Recur.render(); },     topbar: function () { return Recur.topbar(); } },
    me:    { render: function () { return Me.render(); },        topbar: function () { return Me.topbar(); } },
    list:  { render: function () { return TxList.render(); },    topbar: function () { return TxList.topbar(); } },
    cat:   { render: function () { return CatDetail.render(); }, topbar: function () { return CatDetail.topbar(); } }
  };

  /* ---------- 路由 ---------- */
  function parseHash() {
    var raw = (location.hash || '#/home').replace(/^#\/?/, '');
    var parts = raw.split('/');
    var name = parts[0] || 'home';
    if (!VIEWS[name]) name = 'home';
    return { name: name, param: parts[1] || null };
  }

  function onHashChange() {
    route = parseHash();
    if (route.name === 'cat') {
      if (route.param) CatDetail.setId(route.param);
      if (!CatDetail.id()) { location.hash = '#/stats'; return; }
    }
    window.scrollTo(0, 0);
    rerender();
    paintTabs();
  }

  function go(name, param) {
    location.hash = '#/' + name + (param ? '/' + param : '');
  }

  /* ---------- 繪製 ---------- */
  function rerender() {
    var y = window.scrollY;
    var v = VIEWS[route.name] || VIEWS.home;
    document.getElementById('topbar').innerHTML = v.topbar();
    var el = document.getElementById('view');
    el.innerHTML = v.render();
    if (route.name === 'list') TxList.bindInputs(el);
    window.scrollTo(0, y);
  }

  function paintTabs() {
    var tabs = document.querySelectorAll('#tabbar .tab');
    for (var i = 0; i < tabs.length; i++) {
      var n = tabs[i].dataset.route;
      var on = n === route.name ||
        (route.name === 'cat' && n === 'stats') ||
        (route.name === 'list' && n === 'home');
      tabs[i].classList.toggle('on', !!on);
    }
  }

  /* ---------- 事件委派 ---------- */
  var ACTIONS = {
    'go-home':  function () { go('home'); },
    'go-stats': function () { go('stats'); },
    'go-recur': function () { go('recur'); },
    'go-me':    function () { go('me'); },
    'go-list':  function () { go('list'); },
    'back':     function () { if (history.length > 1) history.back(); else go('home'); },

    'quick-add': function () { Entry.open(); },
    'edit-tx': function (d) {
      var t = Repo.txs().filter(function (x) { return x.id === d.id; })[0];
      if (t) Entry.open({ tx: t });
    },

    'due-ok': function (d) {
      Repo.confirmDue(d.id);
      UI.haptic(20);
      UI.toast('已記下這筆固定支出', '✅');
      var na = Repo.takeNewAchievements();
      if (na.length) setTimeout(function () { Achieve.show(na); }, 500);
    },
    'due-edit': function (d) { Recur.editDueAmount(d.id); },
    'due-skip': function (d) {
      UI.confirm({ emoji: '⏭', title: '跳過這次扣款？', text: '不會產生紀錄，下次到期時會再提醒你。', okText: '跳過' })
        .then(function (ok) { if (ok) { Repo.skipDue(d.id); UI.toast('已跳過', '⏭'); } });
    },

    'rec-new':     function () { Recur.editSheet(null); },
    'rec-edit':    function (d) { Recur.editSheet(d.id); },
    'rec-example': function (d) { Recur.example(parseInt(d.i, 10)); },

    'stats-kind': function (d) { Stats.setKind(d.k); rerender(); },
    'stats-prev': function () { Stats.state.offset--; rerender(); },
    'stats-next': function () { if (Stats.state.offset < 0) { Stats.state.offset++; rerender(); } },
    'stats-type': function (d) { Stats.state.type = d.k; rerender(); },

    'go-cat': function (d) { go('cat', d.id); },
    'cat-search': function (d) {
      var c = Repo.cat(d.id);
      TxList.reset();
      TxList.setFilter({ categoryIds: [d.id] });
      UI.toast('已篩選：' + c.name, c.emoji);
      go('list');
    },

    'go-budget': function () { Manage.budgetSheet(); },
    'go-cats':   function () { Manage.categorySheet(); },
    'go-pays':   function () { Manage.paymentSheet(); },
    'go-review': function () { Review.show(-1); },

    'set-theme':      function (d) { setTheme(d.k); },
    'set-monthstart': function () { Me.monthStartSheet(); },
    'set-weekstart':  function () { Me.weekStartSheet(); },
    'export-json':    function () { Me.exportJSON(); },
    'export-csv':     function () { Me.exportCSV(); },
    'import-json':    function () { Me.importJSON(); },
    'wipe':           function () { Me.wipe(); }
  };

  function bindGlobal() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var act = el.dataset.act;
      if (ACTIONS[act]) { ACTIONS[act](el.dataset, el); return; }
      /* 交易列表的搜尋／篩選動作 */
      if (TxList.handle(act, el.dataset.k, el)) { rerender(); return; }
    });

    document.getElementById('tabbar').addEventListener('click', function (e) {
      var fab = e.target.closest('.fab');
      if (fab) { UI.haptic(14); Entry.open(); return; }
      var tab = e.target.closest('.tab[data-route]');
      if (tab) go(tab.dataset.route);
    });

    /* 返回鍵先關 sheet */
    window.addEventListener('popstate', function () {
      if (UI.hasSheet()) UI.closeTop();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && UI.hasSheet()) UI.closeTop();
    });

    window.addEventListener('hashchange', onHashChange);

    /* 跨分頁同步（同一台裝置開兩個分頁時） */
    window.addEventListener('storage', function (e) {
      if (e.key === Store.KEY) { Store.load(); Repo.refreshStreakNow(); rerender(); }
    });

    /* 回到前景時重新檢查到期／換日 */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        Repo.refreshStreakNow();
        Repo.processAutoPost();
        rerender();
      }
    });
  }

  function setTheme(t) {
    Store.mutate(function (s) { s.settings.theme = t; });
    applyTheme();
    UI.toast('外觀已更新', t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '🌗');
  }
  function applyTheme() {
    var t = Repo.settings().theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  function tabbarHTML() {
    var items = [
      { r: 'home', i: '🏠', n: '首頁' },
      { r: 'stats', i: '📊', n: '統計' },
      null,
      { r: 'recur', i: '🔁', n: '固定支出' },
      { r: 'me', i: '👤', n: '我的' }
    ];
    return items.map(function (x) {
      if (!x) return '<div class="tab tab-fab"><button class="fab" aria-label="記一筆">＋</button></div>';
      return '<button class="tab" data-route="' + x.r + '"><span class="ico">' + x.i + '</span><span>' + x.n + '</span></button>';
    }).join('');
  }

  /* ---------- 啟動 ---------- */
  function init() {
    Store.load();
    applyTheme();
    document.getElementById('tabbar').innerHTML = tabbarHTML();
    Repo.refreshStreakNow();
    Repo.processAutoPost();

    Store.subscribe(function () { rerender(); });

    route = parseHash();
    if (route.name === 'cat' && route.param) CatDetail.setId(route.param);
    if (route.name === 'cat' && !CatDetail.id()) route = { name: 'stats', param: null };
    rerender();
    paintTabs();
    bindGlobal();

    Review.maybeShow();

    /* 換日時自動刷新 */
    setInterval(function () {
      if (App._day !== U.today()) { App._day = U.today(); Repo.refreshStreakNow(); Repo.processAutoPost(); rerender(); }
    }, 60000);
    App._day = U.today();

    /* PWA */
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    document.body.classList.add('ready');
  }

  return { init: init, rerender: rerender, go: go, route: function () { return route; } };
})();

document.addEventListener('DOMContentLoaded', App.init);
