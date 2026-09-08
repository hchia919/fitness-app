/* ── 通用工具：日期、金額、ID ───────────────────────── */
var U = (function () {
  var WD = ['日', '一', '二', '三', '四', '五', '六'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromISO(s) { var a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
  function today() { return toISO(new Date()); }
  function addDays(iso, n) { var d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
  function addMonths(iso, n) {
    var d = fromISO(iso), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return toISO(d);
  }
  function addYears(iso, n) { return addMonths(iso, n * 12); }
  function diffDays(a, b) { return Math.round((fromISO(b) - fromISO(a)) / 86400000); }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  /* 顯示 */
  function fmtDate(iso) {
    var d = fromISO(iso);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }
  function fmtDateFull(iso) {
    var d = fromISO(iso);
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' (' + WD[d.getDay()] + ')';
  }
  function fmtDayHeader(iso) {
    var t = today();
    if (iso === t) return '今天';
    if (iso === addDays(t, -1)) return '昨天';
    if (iso === addDays(t, 1)) return '明天';
    var d = fromISO(iso);
    var sameYear = d.getFullYear() === new Date().getFullYear();
    return (sameYear ? '' : d.getFullYear() + '/') + (d.getMonth() + 1) + '/' + d.getDate() + ' 週' + WD[d.getDay()];
  }
  function relDay(iso) {
    var n = diffDays(today(), iso);
    if (n === 0) return '今天';
    if (n === 1) return '明天';
    if (n === -1) return '昨天';
    if (n > 0) return n + ' 天後';
    return Math.abs(n) + ' 天前';
  }

  function money(n, opt) {
    opt = opt || {};
    var v = Math.abs(Number(n) || 0);
    var s = (Math.round(v * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
    var sign = '';
    if (opt.signed) sign = (Number(n) < 0 ? '−' : '+');
    else if (Number(n) < 0) sign = '−';
    return sign + (opt.bare ? '' : '$') + s;
  }
  /* 四捨五入到整數再顯示（給平均、月均這類計算值用） */
  function moneyR(n, opt) { return money(Math.round(Number(n) || 0), opt); }

  function shortMoney(n) {
    var v = Math.abs(Number(n) || 0);
    if (v >= 10000) return (v / 10000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '') + '萬';
    if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(Math.round(v));
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 顏色：把類別色調淡當底 */
  function tint(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ── 期間計算 ──────────────────────────────────
     kind: week | month | quarter | year
     offset: 0 = 本期, -1 = 上一期
     回傳 { from, to, label, shortLabel, kind, offset }        */
  function period(kind, offset, settings) {
    settings = settings || {};
    var startDay = settings.monthStartDay || 1;
    var weekStart = settings.weekStartsOn == null ? 1 : settings.weekStartsOn;
    var now = new Date(), from, to, label, shortLabel;

    if (kind === 'week') {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var delta = (d.getDay() - weekStart + 7) % 7;
      d.setDate(d.getDate() - delta + offset * 7);
      from = toISO(d); to = addDays(from, 6);
      label = fmtDate(from) + ' – ' + fmtDate(to);
      shortLabel = offset === 0 ? '本週' : (offset === -1 ? '上週' : label);
    } else if (kind === 'month') {
      var base = monthPeriodStart(toISO(now), startDay);
      from = addMonths(base, offset);
      to = addDays(addMonths(from, 1), -1);
      var fd = fromISO(from);
      if (startDay === 1) {
        label = fd.getFullYear() + ' 年 ' + (fd.getMonth() + 1) + ' 月';
      } else {
        label = fmtDate(from) + ' – ' + fmtDate(to);
      }
      shortLabel = offset === 0 ? '本月' : (offset === -1 ? '上個月' : label);
    } else if (kind === 'quarter') {
      var qBaseMonth = Math.floor(now.getMonth() / 3) * 3;
      var qFrom = toISO(new Date(now.getFullYear(), qBaseMonth, startDay));
      if (startDay > now.getDate() && now.getMonth() === qBaseMonth) qFrom = addMonths(qFrom, -3);
      from = addMonths(qFrom, offset * 3);
      to = addDays(addMonths(from, 3), -1);
      var q = Math.floor(fromISO(from).getMonth() / 3) + 1;
      label = fromISO(from).getFullYear() + ' 年 Q' + q;
      shortLabel = offset === 0 ? '本季' : (offset === -1 ? '上一季' : label);
    } else { /* year */
      var yFrom = toISO(new Date(now.getFullYear(), 0, startDay));
      if (yFrom > toISO(now)) yFrom = addYears(yFrom, -1);
      from = addYears(yFrom, offset);
      to = addDays(addYears(from, 1), -1);
      label = fromISO(from).getFullYear() + ' 年';
      shortLabel = offset === 0 ? '今年' : label;
    }
    return { kind: kind, offset: offset, from: from, to: to, label: label, shortLabel: shortLabel };
  }

  /* 找出包含 iso 的「月週期」起始日（支援自訂月結日） */
  function monthPeriodStart(iso, startDay) {
    var d = fromISO(iso);
    var y = d.getFullYear(), m = d.getMonth();
    var s = Math.min(startDay, daysInMonth(y, m));
    if (d.getDate() < s) {
      m -= 1; if (m < 0) { m = 11; y -= 1; }
      s = Math.min(startDay, daysInMonth(y, m));
    }
    return toISO(new Date(y, m, s));
  }

  function inRange(iso, from, to) { return iso >= from && iso <= to; }

  /* 期間內剩餘天數（含今天） */
  function daysLeftIn(p) {
    var t = today();
    if (t > p.to) return 0;
    if (t < p.from) return diffDays(p.from, p.to) + 1;
    return diffDays(t, p.to) + 1;
  }

  function debounce(fn, ms) {
    var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
  }

  return {
    pad: pad, uid: uid, toISO: toISO, fromISO: fromISO, today: today,
    addDays: addDays, addMonths: addMonths, addYears: addYears, diffDays: diffDays,
    daysInMonth: daysInMonth, WD: WD,
    fmtDate: fmtDate, fmtDateFull: fmtDateFull, fmtDayHeader: fmtDayHeader, relDay: relDay,
    money: money, moneyR: moneyR, shortMoney: shortMoney, pct: pct, esc: esc, clamp: clamp, tint: tint,
    period: period, monthPeriodStart: monthPeriodStart, inRange: inRange, daysLeftIn: daysLeftIn,
    debounce: debounce
  };
})();
