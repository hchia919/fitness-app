/* ── 自繪 SVG 圖表：甜甜圈／柱狀／折線／環形進度 ─────────
   不依賴任何外部套件，離線可用、風格可控             */
var Charts = (function () {

  /* 甜甜圈圖 */
  function donut(rows, opts) {
    opts = opts || {};
    var size = opts.size || 128, sw = opts.stroke || 20;
    var r = (size - sw) / 2, c = size / 2, circ = 2 * Math.PI * r;
    var total = rows.reduce(function (a, x) { return a + x.amount; }, 0);
    if (!total) {
      return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
        '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--bg-soft)" stroke-width="' + sw + '"/></svg>';
    }
    var off = 0, segs = '';
    rows.forEach(function (x, i) {
      var frac = x.amount / total;
      var len = frac * circ;
      segs += '<circle class="dseg" data-cat="' + x.categoryId + '" cx="' + c + '" cy="' + c + '" r="' + r +
        '" fill="none" stroke="' + x.color + '" stroke-width="' + sw + '" stroke-linecap="butt"' +
        ' stroke-dasharray="' + (Math.max(len - 1.5, 0.5)) + ' ' + (circ - Math.max(len - 1.5, 0.5)) + '"' +
        ' stroke-dashoffset="' + (-off) + '"' +
        ' style="animation: dgrow .8s var(--ease) ' + (i * 0.05) + 's both">' +
        '<title>' + U.esc(x.name) + ' ' + U.money(x.amount) + '</title></circle>';
      off += len;
    });
    var mid = opts.center || '';
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '"' +
      ' style="transform:rotate(-90deg)">' + segs + '</svg>' +
      (mid ? '<div class="donut-center">' + mid + '</div>' : '');
  }

  /* 柱狀圖 */
  function bars(data, opts) {
    opts = opts || {};
    var w = 100, h = opts.height || 92;
    var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
    var n = data.length || 1;
    var gap = opts.gap == null ? 3.2 : opts.gap;
    var bw = (w - gap * (n - 1)) / n;
    var color = opts.color || 'var(--primary)';
    var soft = opts.soft || 'var(--bg-soft)';
    var todayKey = U.today();
    var bodyH = h - 18;
    var out = '<div class="chart-bars"><svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="width:100%;height:' + h + 'px;overflow:visible">';
    data.forEach(function (d, i) {
      var bh = Math.max(d.value / max * bodyH, d.value > 0 ? 2.5 : 0);
      var x = i * (bw + gap);
      var isNow = opts.highlightKey ? d.key === opts.highlightKey : (d.key === todayKey);
      out += '<rect x="' + x.toFixed(2) + '" y="0" width="' + bw.toFixed(2) + '" height="' + bodyH + '" rx="1.6" fill="' + soft + '"/>';
      if (bh > 0) {
        out += '<rect class="bseg" x="' + x.toFixed(2) + '" y="' + (bodyH - bh).toFixed(2) + '" width="' + bw.toFixed(2) +
          '" height="' + bh.toFixed(2) + '" rx="1.6" fill="' + (isNow ? 'var(--primary-2)' : color) + '"' +
          ' style="animation: bgrow .6s var(--ease) ' + (i * 0.04) + 's both; transform-origin: center bottom">' +
          '<title>' + U.esc(d.label) + ' ' + U.money(d.value) + '</title></rect>';
      }
    });
    out += '</svg><div class="chart-xlabels">' +
      data.map(function (d) {
        return '<span' + (d.key === todayKey ? ' class="on"' : '') + '>' + U.esc(d.label) + '</span>';
      }).join('') + '</div></div>';
    return out;
  }

  /* 折線／面積圖 */
  function line(data, opts) {
    opts = opts || {};
    var w = 300, h = opts.height || 74;
    var pad = 4;
    var vals = data.map(function (d) { return d.value; });
    var max = Math.max.apply(null, vals.concat([1]));
    var n = data.length;
    if (n < 2) {
      return '<div class="chart-line"><div class="empty tiny" style="padding:14px 0">資料還太少，多記幾筆就看得到趨勢 🌱</div></div>';
    }
    var pts = data.map(function (d, i) {
      var x = pad + i * (w - pad * 2) / (n - 1);
      var y = h - pad - (d.value / max) * (h - pad * 2);
      return [x, y];
    });
    /* 平滑曲線 */
    var d0 = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var p0 = pts[i - 1], p1 = pts[i];
      var cx = (p0[0] + p1[0]) / 2;
      d0 += ' C' + cx.toFixed(1) + ',' + p0[1].toFixed(1) + ' ' + cx.toFixed(1) + ',' + p1[1].toFixed(1) + ' ' + p1[0].toFixed(1) + ',' + p1[1].toFixed(1);
    }
    var area = d0 + ' L' + pts[n - 1][0].toFixed(1) + ',' + h + ' L' + pts[0][0].toFixed(1) + ',' + h + ' Z';
    var stroke = opts.color || 'var(--primary)';
    var gid = 'g' + Math.random().toString(36).slice(2, 7);
    var last = pts[n - 1];
    var out = '<div class="chart-line"><svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="width:100%;height:' + h + 'px;overflow:visible">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + stroke + '" stop-opacity=".28"/>' +
      '<stop offset="100%" stop-color="' + stroke + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path d="' + d0 + '" fill="none" stroke="' + stroke + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" class="lpath"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.4" fill="' + stroke + '" stroke="var(--card)" stroke-width="2"/>' +
      '</svg>';
    if (opts.labels !== false) {
      out += '<div class="chart-xlabels sparse">' +
        data.map(function (d, i) {
          var show = (i === 0 || i === n - 1 || i === Math.floor(n / 2));
          return '<span>' + (show ? U.esc(d.label) : '') + '</span>';
        }).join('') + '</div>';
    }
    return out + '</div>';
  }

  /* 環形進度（預算） */
  function ring(pctVal, opts) {
    opts = opts || {};
    var size = opts.size || 62, sw = opts.stroke || 7;
    var r = (size - sw) / 2, c = size / 2, circ = 2 * Math.PI * r;
    var p = U.clamp(pctVal, 0, 100);
    var color = opts.color || '#fff';
    var track = opts.track || 'rgba(255,255,255,.32)';
    return '<div class="ringwrap" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" style="transform:rotate(-90deg)">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + track + '" stroke-width="' + sw + '"/>' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + sw +
      '" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + (circ * (1 - p / 100)).toFixed(1) +
      '" style="transition: stroke-dashoffset .9s var(--ease)"/></svg>' +
      '<span class="ringtxt" style="color:' + color + '">' + Math.round(pctVal) + '<i>%</i></span></div>';
  }

  return { donut: donut, bars: bars, line: line, ring: ring };
})();
