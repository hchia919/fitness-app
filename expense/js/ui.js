/* ── UI 基礎元件：sheet、toast、confirm、吉祥物、動畫 ────── */
var UI = (function () {
  var sheetStack = [];

  /* ---------- Toast ---------- */
  function toast(msg, emoji) {
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = (emoji ? '<span>' + emoji + '</span>' : '') + '<span>' + U.esc(msg) + '</span>';
    root.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 300);
    }, 2100);
  }

  function haptic(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) {}
  }

  /* 記帳完成：金額往上飛 */
  function flyAmount(text, x, y) {
    var el = document.createElement('div');
    el.className = 'flyamt';
    el.textContent = text;
    el.style.left = (x || window.innerWidth / 2) + 'px';
    el.style.top = (y || window.innerHeight * 0.62) + 'px';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 900);
  }

  /* ---------- Sheet ---------- */
  /* open({ title, body, center, onMount, onClose }) */
  function sheet(cfg) {
    var mask = document.createElement('div');
    mask.className = 'sheet-mask' + (cfg.center ? ' mid' : '');
    var inner = document.createElement('div');
    inner.className = 'sheet' + (cfg.center ? ' center' : '') + (cfg.flex ? ' flexsheet' : '');
    inner.innerHTML =
      (cfg.center ? '' : '<div class="grab"></div>') +
      (cfg.title ? '<div class="sheet-h"><div class="t">' + cfg.title + '</div>' +
        (cfg.hideClose ? '' : '<button class="iconbtn" data-sheet-close>✕</button>') + '</div>' : '') +
      '<div class="sheet-body">' + (cfg.body || '') + '</div>';
    mask.appendChild(inner);
    document.getElementById('sheet-root').appendChild(mask);
    document.body.style.overflow = 'hidden';

    var api = {
      el: inner, mask: mask,
      close: function () { closeSheet(api); },
      setBody: function (html) { inner.querySelector('.sheet-body').innerHTML = html; },
      body: function () { return inner.querySelector('.sheet-body'); }
    };
    api._onClose = cfg.onClose;
    sheetStack.push(api);

    mask.addEventListener('click', function (e) {
      if (e.target === mask && cfg.dismissible !== false) api.close();
      var c = e.target.closest && e.target.closest('[data-sheet-close]');
      if (c) api.close();
    });
    if (cfg.onMount) cfg.onMount(api);
    return api;
  }

  function closeSheet(api) {
    var i = sheetStack.indexOf(api);
    if (i >= 0) sheetStack.splice(i, 1);
    api.mask.style.animation = 'fadeIn .18s var(--ease) reverse forwards';
    api.el.style.animation = 'sheetUp .22s var(--ease) reverse forwards';
    setTimeout(function () { api.mask.remove(); }, 200);
    if (!sheetStack.length) document.body.style.overflow = '';
    if (api._onClose) api._onClose();
  }

  function closeTop() {
    if (sheetStack.length) sheetStack[sheetStack.length - 1].close();
    return sheetStack.length > 0;
  }
  function hasSheet() { return sheetStack.length > 0; }

  /* ---------- Confirm ---------- */
  function confirm(cfg) {
    return new Promise(function (resolve) {
      var done = false;
      function settle(v) { if (done) return; done = true; resolve(v); }
      var s = sheet({
        center: true,
        body:
          '<div style="text-align:center;padding:8px 4px 2px">' +
          '<div style="font-size:38px">' + (cfg.emoji || '🤔') + '</div>' +
          '<div style="font-size:17px;font-weight:800;margin-top:6px">' + U.esc(cfg.title || '確定嗎？') + '</div>' +
          (cfg.text ? '<div class="small muted" style="margin-top:6px;line-height:1.5">' + cfg.text + '</div>' : '') +
          '<div style="display:flex;gap:9px;margin-top:18px">' +
          '<button class="btn ghost" style="flex:1;background:var(--bg-soft)" data-no>' + U.esc(cfg.cancelText || '取消') + '</button>' +
          '<button class="btn ' + (cfg.danger ? 'danger' : 'primary') + '" style="flex:1" data-yes>' + U.esc(cfg.okText || '確定') + '</button>' +
          '</div></div>',
        onMount: function (api) {
          api.el.querySelector('[data-no]').onclick = function () { settle(false); api.close(); };
          api.el.querySelector('[data-yes]').onclick = function () { settle(true); api.close(); };
        },
        onClose: function () { settle(false); }
      });
      return s;
    });
  }

  /* ---------- 保留輸入焦點（重繪時不打斷打字） ---------- */
  function captureFocus() {
    var a = document.activeElement;
    if (!a || !a.dataset || !a.dataset.keep) return null;
    return { key: a.dataset.keep, start: a.selectionStart, end: a.selectionEnd };
  }
  function restoreFocus(snap) {
    if (!snap) return;
    var el = document.querySelector('[data-keep="' + snap.key + '"]');
    if (!el) return;
    el.focus();
    try { el.setSelectionRange(snap.start, snap.end); } catch (e) {}
  }


  /* ---------- 長按 ----------
     在 root 上做事件委派，長按符合 selector 的元素就觸發 fn(el)。
     回傳 { consumed() }：長按觸發後的那一次 click 要用它擋掉。   */
  function longPress(root, selector, fn, ms) {
    var timer = null, pressTimer = null, fired = false, cur = null, sx = 0, sy = 0;

    function clearPressing() {
      clearTimeout(pressTimer); pressTimer = null;
      if (cur) { cur.classList.remove('pressing'); cur = null; }
    }
    function cancel() { clearTimeout(timer); timer = null; clearPressing(); }

    function start(e) {
      var el = e.target.closest && e.target.closest(selector);
      if (!el) return;
      /* 滑鼠只認左鍵 */
      if (e.button != null && e.button !== 0 && !e.touches) return;
      cancel();
      fired = false; cur = el;
      var t = e.touches ? e.touches[0] : e;
      sx = t.clientX; sy = t.clientY;
      pressTimer = setTimeout(function () { if (cur) cur.classList.add('pressing'); }, 130);
      timer = setTimeout(function () {
        timer = null; fired = true;
        clearPressing();
        haptic(28);
        fn(el);
      }, ms || 480);
    }
    function move(e) {
      if (!timer) return;
      var t = e.touches ? e.touches[0] : e;
      if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) cancel();
    }

    root.addEventListener('touchstart', start, { passive: true });
    root.addEventListener('touchmove', move, { passive: true });
    root.addEventListener('touchend', cancel);
    root.addEventListener('touchcancel', cancel);
    root.addEventListener('mousedown', start);
    root.addEventListener('mousemove', move);
    root.addEventListener('mouseup', cancel);
    root.addEventListener('mouseleave', cancel);
    root.addEventListener('contextmenu', function (e) {
      if (e.target.closest && e.target.closest(selector)) e.preventDefault();
    });

    return { consumed: function () { var f = fired; fired = false; return f; } };
  }


  /* ---------- 類別格高度自動對齊整排 ----------
     依照裝置剩餘空間，算出最多能完整放幾排，絕不切一半排。 */
  function fitGridRows(container, selector, minRows, useClientHeight) {
    if (!container) return;
    var grid = container.querySelector(selector);
    if (!grid) return;
    var cell = grid.children[0];
    if (!cell) return;
    var gap = parseFloat(getComputedStyle(grid).rowGap || '8') || 8;
    var rowH = cell.getBoundingClientRect().height + gap;
    if (!(rowH > gap)) return;

    var prev = grid.style.maxHeight;
    grid.style.maxHeight = '0px';
    var base = container.scrollHeight;               /* 扣掉類別格以後的內容高度 */
    var totalRows = Math.max(1, Math.round((grid.scrollHeight + gap) / rowH));
    var box = useClientHeight ? container.clientHeight : window.innerHeight * 0.92;
    var rows = Math.floor((box - base + gap) / rowH);
    rows = Math.max(minRows || 2, Math.min(totalRows, rows));
    if (!isFinite(rows) || rows < 1) { grid.style.maxHeight = prev; return; }
    grid.style.maxHeight = (rows * rowH - gap) + 'px';
  }

  /* ---------- 吉祥物（存錢筒） ---------- */
  function piggy(size) {
    size = size || 96;
    return '<svg viewBox="0 0 120 120" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<ellipse cx="60" cy="104" rx="34" ry="6" fill="rgba(0,0,0,.06)"/>' +
      '<path d="M22 62c0-19 17-32 38-32s38 13 38 32-17 34-38 34S22 81 22 62z" fill="#FFC0CB"/>' +
      '<path d="M30 40c-4-9-2-14 1-15 4-1 10 4 13 9z" fill="#FFAEBC"/>' +
      '<path d="M90 40c4-9 2-14-1-15-4-1-10 4-13 9z" fill="#FFAEBC"/>' +
      '<rect x="50" y="34" width="20" height="5" rx="2.5" fill="#F48FB1"/>' +
      '<ellipse cx="96" cy="63" rx="11" ry="9" fill="#FFAEBC"/>' +
      '<circle cx="93" cy="61" r="2" fill="#E57392"/><circle cx="99" cy="65" r="2" fill="#E57392"/>' +
      '<circle cx="76" cy="56" r="3.2" fill="#4A3B45"/>' +
      '<path d="M64 70c4 4 11 4 15 0" stroke="#E57392" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<rect x="34" y="92" width="9" height="12" rx="4" fill="#FFAEBC"/>' +
      '<rect x="62" y="92" width="9" height="12" rx="4" fill="#FFAEBC"/>' +
      '<circle cx="52" cy="26" r="9" fill="#FFC95C"/>' +
      '<text x="52" y="30" font-size="10" font-weight="700" text-anchor="middle" fill="#fff">$</text>' +
      '</svg>';
  }

  function empty(title, sub, withPiggy) {
    return '<div class="empty">' + (withPiggy === false ? '<div style="font-size:40px">🍃</div>' : piggy(92)) +
      '<div class="t">' + U.esc(title) + '</div>' +
      (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
  }

  return {
    toast: toast, haptic: haptic, flyAmount: flyAmount,
    sheet: sheet, closeTop: closeTop, hasSheet: hasSheet, confirm: confirm, longPress: longPress,
    captureFocus: captureFocus, restoreFocus: restoreFocus, fitGridRows: fitGridRows,
    piggy: piggy, empty: empty
  };
})();
