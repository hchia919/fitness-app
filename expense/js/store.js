/* ── 單一狀態源 + localStorage 持久化 + 發布訂閱 ────────
   任何頁面改資料 → 廣播 → 所有畫面重繪（頁面間資料同步）  */
var Store = (function () {
  var KEY = 'moneybuddy.v1';
  var state = null;
  var subs = [];
  var saveTimer = null;

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* 隱私模式 */ }
    var data = null;
    if (raw) { try { data = JSON.parse(raw); } catch (e) { data = null; } }
    state = Schema.migrate(data);
    return state;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('無法寫入 localStorage', e); }
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 120);
  }

  function get() { return state; }

  /* mutate(fn) → 改狀態、存檔、通知所有訂閱者 */
  function mutate(fn, opts) {
    var r = fn(state);
    save();
    if (!(opts && opts.silent)) emit();
    return r;
  }

  function emit() {
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](state); } catch (e) { console.error(e); }
    }
  }

  function subscribe(fn) {
    subs.push(fn);
    return function () { subs = subs.filter(function (f) { return f !== fn; }); };
  }

  function replaceAll(data) {
    state = Schema.migrate(data);
    persist();
    emit();
  }

  function reset() {
    state = Schema.blank();
    persist();
    emit();
  }

  function flush() { clearTimeout(saveTimer); persist(); }

  return {
    KEY: KEY, load: load, get: get, mutate: mutate, subscribe: subscribe,
    emit: emit, replaceAll: replaceAll, reset: reset, flush: flush
  };
})();
