/*!
 * equity-curve.js — één consistente equity-curve voor je trade journal.
 * Framework-vrij. Geen dependencies. Werkt in elke lokale HTML-file.
 *
 * GEBRUIK
 *   <div id="chart" style="width:100%;height:360px"></div>
 *   <script src="equity-curve.js"></script>
 *   <script>
 *     const chart = EquityCurve('#chart', {
 *       data: [{ t:'2024-11-18', v:0 }, { t:'2024-11-20', v:120 }, ...], // v = cumulatieve P&L of saldo
 *       size: 'large',        // 'large' | 'panel' | 'mini'
 *       drawdown: true,       // toon de aparte underwater-strip (OPTIONEEL — dit is jouw toggle)
 *       movingAverage: 14,    // false of een venster (aantal punten)
 *       ranges: true,         // toon 1W/1M/3M/YTD/All knoppen
 *       currency: '$',
 *       title: 'EQUITY CURVE · USD',
 *     });
 *
 *     // later aanpasbaar:
 *     chart.setDrawdown(false);     // strip uit
 *     chart.setData(newArray);      // nieuwe data
 *     chart.setRange('3M');         // programmatisch filteren
 *     chart.destroy();
 *
 * DATA-FORMATEN die geaccepteerd worden:
 *   [{t, v}]  ·  [{date, value}]  ·  [[t, v], ...]  ·  [number, ...] (index als x)
 *   t/date mag een Date, ISO-string of timestamp zijn.
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // ---- standaard thema (overschrijfbaar via opts.theme) ----
  var THEME = {
    line:       '#34d8a0',
    lineBright: '#4ee8b0',
    fillTop:    'rgba(52,216,160,0.34)',
    fillBot:    'rgba(52,216,160,0)',
    down:       '#f6566f',
    downFillTop:'rgba(246,86,111,0.42)',
    downFillBot:'rgba(246,86,111,0.05)',
    hwm:        'rgba(224,179,65,0.55)',   // high-water mark
    ma:         'rgba(224,179,65,0.55)',   // moving average
    grid:       'rgba(120,140,160,0.10)',
    gridStrong: 'rgba(120,140,160,0.16)',
    axis:       '#56657a',
    axisDim:    '#3a4658',
    text:       '#c9d3e0',
    textDim:    '#8995a6',
    panelBg:    '#0e151d',
    tooltipBg:  'rgba(10,15,21,0.96)',
    mono:       "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
    sans:       "system-ui, -apple-system, 'Segoe UI', sans-serif"
  };

  // sizing per maat
  var SIZES = {
    large: { padL:58, padR:16, padT:18, padB:30, stripH:78, stripGap:16, yTicks:5, xTicks:6, lineW:2.0, font:11, dot:3.6, axes:true,  pill:true },
    panel: { padL:48, padR:14, padT:14, padB:26, stripH:58, stripGap:12, yTicks:4, xTicks:5, lineW:1.9, font:10.5, dot:3.2, axes:true, pill:true },
    mini:  { padL:2,  padR:2,  padT:4,  padB:4,  stripH:0,  stripGap:0,  yTicks:0, xTicks:0, lineW:1.6, font:9,   dot:2.6, axes:false, pill:false }
  };

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function num(v){ return typeof v === 'number' && isFinite(v); }

  // ---- normaliseer willekeurige invoer naar [{t:Date|null, v:Number}] ----
  function normalize(data) {
    if (!data || !data.length) return [];
    return data.map(function (d, i) {
      var t, v;
      if (Array.isArray(d)) { t = d[0]; v = d[1]; }
      else if (d && typeof d === 'object') {
        v = d.v != null ? d.v : (d.value != null ? d.value : d.equity);
        t = d.t != null ? d.t : (d.date != null ? d.date : d.time);
      } else { v = d; t = i; }
      var dt = null;
      if (t instanceof Date) dt = t;
      else if (typeof t === 'number') dt = (t > 1e11) ? new Date(t) : null; // groot getal = timestamp
      else if (typeof t === 'string') { var p = new Date(t); if (!isNaN(p)) dt = p; }
      return { t: dt, v: +v, _raw: t };
    }).filter(function (d) { return num(d.v); });
  }

  function computeDD(pts) {
    var peak = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i].v > peak) peak = pts[i].v;
      pts[i].peak = peak;
      pts[i].dd = pts[i].v - peak;
      pts[i].ddPct = peak > 0 ? pts[i].dd / peak : 0;
    }
    return pts;
  }

  // ---- number / date formatters ----
  function abbr(v, cur) {
    var s = v < 0 ? '-' : '+', a = Math.abs(v);
    if (a >= 1000) return s + cur + (a / 1000).toFixed(a >= 10000 ? 0 : 1) + 'k';
    return s + cur + Math.round(a);
  }
  function full(v, cur) {
    var s = v < 0 ? '-' : '+';
    return s + cur + Math.abs(Math.round(v)).toLocaleString('en-US');
  }
  function fmtDate(d) {
    if (!d) return '';
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---- range filter ----
  function filterRange(pts, range) {
    if (!range || range === 'All' || !pts.length) return pts;
    var last = pts[pts.length - 1].t;
    if (!last) return pts; // geen datums → kan niet filteren
    var from;
    if (range === 'YTD') from = new Date(last.getFullYear(), 0, 1);
    else {
      var days = { '1W': 7, '1M': 30, '3M': 90, '6M': 182, '1Y': 365 }[range] || 0;
      from = new Date(last.getTime() - days * 864e5);
    }
    var out = pts.filter(function (p) { return p.t && p.t >= from; });
    return out.length > 1 ? out : pts;
  }

  // =====================================================================
  function Chart(target, opts) {
    if (!(this instanceof Chart)) return new Chart(target, opts);
    this.host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.host) throw new Error('EquityCurve: container niet gevonden');
    this.o = Object.assign({
      size: 'large', drawdown: true, movingAverage: false, ranges: false,
      smooth: false, currency: '$', title: null, hwm: true, theme: {},
      // SyncJournal patch (2026-06-04): callback voor custom value formatting.
      // Signature: formatValue(v, mode) waar mode = 'abbr' (y-axis tick) of 'full' (tooltip).
      // Standaard null = component-defaults (abbr/full helpers).
      // Use-case: privacy-mode masking → return '$***' wanneer priv aan staat.
      formatValue: null
    }, opts || {});
    this.t = Object.assign({}, THEME, this.o.theme);
    this.range = this.o.defaultRange || 'All';
    this.uid = 'ec' + Math.random().toString(36).slice(2, 8);
    this._all = computeDD(normalize(this.o.data || []));
    this._build();
    var self = this;
    if (global.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self._render(); });
      this._ro.observe(this.host);
    } else {
      this._onResize = function () { self._render(); };
      global.addEventListener('resize', this._onResize);
    }
  }

  Chart.prototype._build = function () {
    var t = this.t, o = this.o, S = SIZES[o.size] || SIZES.large;
    this.host.style.position = 'relative';
    this.host.innerHTML = '';

    // optionele range-knoppen
    if (o.ranges && S.axes) {
      var bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;margin-bottom:8px;font-family:' + t.sans;
      var ranges = o.rangeOptions || ['1W', '1M', '3M', 'YTD', 'All'];
      var self = this;
      ranges.forEach(function (r) {
        var b = document.createElement('button');
        b.textContent = r;
        b.dataset.range = r;
        b.style.cssText = 'cursor:pointer;font:600 11px ' + t.sans + ';padding:4px 9px;border-radius:6px;background:transparent;border:1px solid ' + t.gridStrong + ';color:' + t.textDim + ';transition:.15s';
        b.onclick = function () { self.setRange(r); };
        bar.appendChild(b);
      });
      this.host.appendChild(bar);
      this._rangeBar = bar;
    }

    // svg-laag
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100%;flex:1;min-height:0;' +
      (this._rangeBar ? 'height:calc(100% - 34px);' : 'height:100%;');
    this.host.appendChild(wrap);
    this.wrap = wrap;

    this.svg = el('svg', { width: '100%', height: '100%', preserveAspectRatio: 'none' });
    this.svg.style.display = 'block';
    wrap.appendChild(this.svg);

    // tooltip
    if (S.axes || o.tooltip !== false) {
      var tip = document.createElement('div');
      tip.style.cssText = 'position:absolute;pointer-events:none;opacity:0;transition:opacity .12s;white-space:nowrap;' +
        'background:' + t.tooltipBg + ';border:1px solid ' + t.gridStrong + ';border-radius:8px;padding:7px 10px;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.5);backdrop-filter:blur(6px);z-index:5;';
      wrap.appendChild(tip);
      this.tip = tip;
    }

    // hover events
    var self2 = this;
    wrap.addEventListener('mousemove', function (e) { self2._hover(e); });
    wrap.addEventListener('mouseleave', function () { self2._hideHover(); });
    wrap.addEventListener('touchmove', function (e) { if (e.touches[0]) self2._hover(e.touches[0]); }, { passive: true });
    wrap.addEventListener('touchend', function () { self2._hideHover(); });

    this._render();
  };

  Chart.prototype._render = function () {
    var t = this.t, o = this.o, S = SIZES[o.size] || SIZES.large;
    var rect = this.wrap.getBoundingClientRect();
    var W = Math.max(40, rect.width), H = Math.max(30, rect.height);
    this.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    // actieve range knop markeren
    if (this._rangeBar) {
      var self = this;
      Array.prototype.forEach.call(this._rangeBar.children, function (b) {
        var on = b.dataset.range === self.range;
        b.style.color = on ? t.lineBright : t.textDim;
        b.style.borderColor = on ? 'rgba(52,216,160,0.5)' : t.gridStrong;
        b.style.background = on ? 'rgba(52,216,160,0.08)' : 'transparent';
      });
    }

    var pts = filterRange(this._all, this.range);
    this._view = pts;
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    if (pts.length < 2) return;

    var showDD = !!o.drawdown && S.stripH > 0;
    var stripH = showDD ? S.stripH : 0;
    var stripGap = showDD ? S.stripGap : 0;
    var x0 = S.padL, y0 = S.padT;
    var w = W - S.padL - S.padR;
    var h = H - S.padT - S.padB - stripH - stripGap;
    if (h < 20) { h = Math.max(20, H - S.padT - S.padB); showDD = false; stripH = 0; stripGap = 0; }

    var vals = pts.map(function (p) { return p.v; });
    var peaks = pts.map(function (p) { return p.peak; });
    var lo = Math.min(0, Math.min.apply(null, vals));
    var hi = Math.max.apply(null, peaks);
    var pad = (hi - lo) * 0.06; hi += pad; lo -= pad * 0.4;
    var span = (hi - lo) || 1;
    var n = pts.length;
    var X = function (i) { return x0 + (i / (n - 1)) * w; };
    var Y = function (v) { return y0 + h - ((v - lo) / span) * h; };

    var G = pts.map(function (p, i) { return { x: X(i), y: Y(p.v), yp: Y(p.peak), p: p }; });
    this._geom = { G: G, x0: x0, y0: y0, w: w, h: h, W: W, H: H, S: S, showDD: showDD,
                   stripTop: y0 + h + stripGap, stripH: stripH };

    var lineD = o.smooth ? smooth(G) : sharp(G);
    var defs = el('defs');
    defs.appendChild(grad(this.uid + 'g', [[0, t.fillTop], [60, mid(t.fillTop)], [100, t.fillBot]]));
    defs.appendChild(grad(this.uid + 'r', [[0, t.downFillTop], [100, t.downFillBot]]));
    this.svg.appendChild(defs);

    // grid + y-as
    if (S.axes) {
      for (var k = 0; k <= S.yTicks; k++) {
        var tv = lo + span * (k / S.yTicks), yy = Y(tv);
        var ln = el('line', { x1: x0, x2: x0 + w, y1: yy, y2: yy, stroke: t.grid, 'stroke-width': 1 });
        if (!o.smooth) ln.setAttribute('stroke-dasharray', '4 6');
        this.svg.appendChild(ln);
        // SyncJournal patch: formatValue callback wint van interne abbr().
        var tickLabel = o.formatValue ? o.formatValue(Math.round(tv), 'abbr') : abbr(Math.round(tv), o.currency);
        this.svg.appendChild(text(x0 - 10, yy + 3.5, tickLabel, { fill: t.axis, 'font-size': S.font, 'text-anchor': 'end', 'font-family': t.mono }));
      }
    }

    // groene area + lijn
    this.svg.appendChild(el('path', { d: lineD + areaTail(G, y0 + h), fill: 'url(#' + this.uid + 'g)' }));

    // inline underwater (mini, of als strip uit staat maar drawdown aan) — toont risico in de curve zelf
    if (!showDD && o.drawdown) {
      this.svg.appendChild(el('path', { d: underwater(G), fill: 'url(#' + this.uid + 'r)' }));
    }

    // high-water mark
    if (o.hwm && S.axes) {
      this.svg.appendChild(el('path', { d: 'M ' + G.map(function (g) { return f(g.x) + ' ' + f(g.yp); }).join(' L '),
        fill: 'none', stroke: t.hwm, 'stroke-width': 1, 'stroke-dasharray': '2 5' }));
    }

    // moving average
    if (o.movingAverage) {
      var maD = movavg(G, o.movingAverage, o.smooth);
      if (maD) this.svg.appendChild(el('path', { d: maD, fill: 'none', stroke: t.ma, 'stroke-width': 1.4, 'stroke-dasharray': '2 4' }));
    }

    // hoofd-lijn
    this.svg.appendChild(el('path', { d: lineD, fill: 'none', stroke: t.line, 'stroke-width': S.lineW, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    // eindpunt
    var last = G[n - 1];
    this.svg.appendChild(el('circle', { cx: last.x, cy: last.y, r: S.dot, fill: t.lineBright }));

    // x-as
    if (S.axes) {
      for (var xi = 0; xi <= S.xTicks; xi++) {
        var idx = Math.round((xi / S.xTicks) * (n - 1));
        var anchor = xi === 0 ? 'start' : (xi === S.xTicks ? 'end' : 'middle');
        this.svg.appendChild(text(X(idx), H - 8, pts[idx].t ? fmtDate(pts[idx].t) : String(idx), { fill: t.axis, 'font-size': S.font, 'text-anchor': anchor, 'font-family': t.mono }));
      }
    }

    // ---- drawdown strip (de optionele "B/Split") ----
    if (showDD) {
      var ddMin = Math.min.apply(null, pts.map(function (p) { return p.ddPct; }));
      ddMin = Math.min(ddMin, -0.0001);
      var st = y0 + h + stripGap;
      var SY = function (pct) { return st + (-pct / -ddMin) * stripH; };
      this.svg.appendChild(el('line', { x1: x0, x2: x0 + w, y1: st, y2: st, stroke: t.gridStrong, 'stroke-width': 1 }));
      var ddLine = 'M ' + pts.map(function (p, i) { return f(X(i)) + ' ' + f(SY(p.ddPct)); }).join(' L ');
      this.svg.appendChild(el('path', { d: ddLine + ' L ' + f(X(n - 1)) + ' ' + f(st) + ' L ' + f(X(0)) + ' ' + f(st) + ' Z', fill: 'url(#' + this.uid + 'r)' }));
      this.svg.appendChild(el('path', { d: ddLine, fill: 'none', stroke: t.down, 'stroke-width': 1.5 }));
      this.svg.appendChild(text(x0 - 10, st + 4, '0%', { fill: t.axis, 'font-size': S.font - 1, 'text-anchor': 'end', 'font-family': t.mono }));
      this.svg.appendChild(text(x0 - 10, st + stripH, Math.round(ddMin * 100) + '%', { fill: t.down, 'font-size': S.font - 1, 'text-anchor': 'end', 'font-family': t.mono }));
      this.svg.appendChild(text(x0 + w, st + stripH, 'DRAWDOWN', { fill: t.axisDim, 'font-size': S.font - 1, 'text-anchor': 'end', 'font-family': t.sans, 'letter-spacing': '0.08em' }));
    }

    // crosshair-laag (apart, voor snelle hover-updates)
    this._cross = el('g', { opacity: 0 });
    this._cl = el('line', { y1: y0, y2: y0 + h, stroke: 'rgba(180,200,220,0.25)', 'stroke-width': 1 });
    this._cdd = el('line', { stroke: t.down, 'stroke-width': 1.4, 'stroke-dasharray': '2 3' });
    this._cd = el('circle', { r: 5, fill: t.panelBg, stroke: t.lineBright, 'stroke-width': 2 });
    this._cross.appendChild(this._cl); this._cross.appendChild(this._cdd); this._cross.appendChild(this._cd);
    this.svg.appendChild(this._cross);
  };

  Chart.prototype._hover = function (e) {
    var g = this._geom; if (!g || !this._view || this._view.length < 2) return;
    var r = this.wrap.getBoundingClientRect();
    var sx = (e.clientX - r.left) * (g.W / r.width);
    var n = g.G.length;
    var i = Math.round(((sx - g.x0) / g.w) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    var pt = g.G[i], p = pt.p;
    this._cross.setAttribute('opacity', 1);
    this._cl.setAttribute('x1', pt.x); this._cl.setAttribute('x2', pt.x);
    this._cd.setAttribute('cx', pt.x); this._cd.setAttribute('cy', pt.y);
    if (p.dd < 0) { this._cdd.setAttribute('opacity', 1); this._cdd.setAttribute('x1', pt.x); this._cdd.setAttribute('x2', pt.x); this._cdd.setAttribute('y1', pt.yp); this._cdd.setAttribute('y2', pt.y); }
    else this._cdd.setAttribute('opacity', 0);
    if (this.tip) {
      var t = this.t, o = this.o;
      var ddRow = p.dd < 0
        ? '<div style="font-size:11.5px;color:' + t.down + ';font-family:' + t.mono + ';margin-top:2px">▼ ' + (p.ddPct * 100).toFixed(1) + '% onder piek</div>'
        : '<div style="font-size:11.5px;color:' + t.line + ';font-family:' + t.mono + ';margin-top:2px">● nieuwe piek</div>';
      // SyncJournal patch: formatValue callback wint van interne full().
      var tipValue = o.formatValue ? o.formatValue(p.v, 'full') : full(p.v, o.currency);
      this.tip.innerHTML = '<div style="font-size:11px;color:' + t.axis + ';font-family:' + t.mono + ';letter-spacing:.04em">' + (p.t ? fmtDate(p.t) : ('#' + i)) + '</div>' +
        '<div style="font-size:15px;font-weight:700;color:' + t.lineBright + ';font-family:' + t.mono + ';margin-top:1px">' + tipValue + '</div>' + ddRow;
      this.tip.style.opacity = 1;
      var px = (pt.x / g.W) * 100, py = (pt.y / g.H) * 100;
      this.tip.style.left = px + '%';
      this.tip.style.top = py + '%';
      this.tip.style.transform = 'translate(' + (pt.x > g.W * 0.7 ? '-110%' : '12px') + ',-130%)';
    }
  };
  Chart.prototype._hideHover = function () {
    if (this._cross) this._cross.setAttribute('opacity', 0);
    if (this.tip) this.tip.style.opacity = 0;
  };

  // ---- publieke API ----
  Chart.prototype.setData = function (data) { this._all = computeDD(normalize(data)); this._render(); return this; };
  Chart.prototype.setDrawdown = function (on) { this.o.drawdown = !!on; this._render(); return this; };
  Chart.prototype.setMovingAverage = function (win) { this.o.movingAverage = win; this._render(); return this; };
  Chart.prototype.setRange = function (r) { this.range = r; this._render(); return this; };
  Chart.prototype.setTheme = function (th) { this.t = Object.assign({}, this.t, th); this._render(); return this; };
  Chart.prototype.stats = function () {
    var p = this._all; if (!p.length) return null;
    var maxdd = p.reduce(function (m, x) { return x.ddPct < m ? x.ddPct : m; }, 0);
    return { end: p[p.length - 1].v, high: Math.max.apply(null, p.map(function (x) { return x.v; })), maxDrawdownPct: maxdd };
  };
  Chart.prototype.destroy = function () {
    if (this._ro) this._ro.disconnect();
    if (this._onResize) global.removeEventListener('resize', this._onResize);
    this.host.innerHTML = '';
  };

  // ---- geometrie-helpers ----
  function f(v) { return v.toFixed(2); }
  function sharp(G) { return 'M ' + G.map(function (g) { return f(g.x) + ' ' + f(g.y); }).join(' L '); }
  function smooth(G) {
    if (G.length < 2) return '';
    var d = 'M ' + f(G[0].x) + ' ' + f(G[0].y);
    for (var i = 0; i < G.length - 1; i++) {
      var p0 = G[i - 1] || G[i], p1 = G[i], p2 = G[i + 1], p3 = G[i + 2] || G[i + 1];
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C ' + f(c1x) + ' ' + f(c1y) + ' ' + f(c2x) + ' ' + f(c2y) + ' ' + f(p2.x) + ' ' + f(p2.y);
    }
    return d;
  }
  function areaTail(G, base) { return ' L ' + f(G[G.length - 1].x) + ' ' + f(base) + ' L ' + f(G[0].x) + ' ' + f(base) + ' Z'; }
  function underwater(G) {
    var fwd = G.map(function (g) { return f(g.x) + ' ' + f(g.yp); }).join(' L ');
    var back = G.slice().reverse().map(function (g) { return f(g.x) + ' ' + f(g.y); }).join(' L ');
    return 'M ' + fwd + ' L ' + back + ' Z';
  }
  function movavg(G, k, sm) {
    if (G.length < 2) return null;
    var out = [];
    for (var i = 0; i < G.length; i++) {
      var s = 0, c = 0;
      for (var j = Math.max(0, i - k); j <= i; j++) { s += G[j].y; c++; }
      out.push({ x: G[i].x, y: s / c });
    }
    return sm ? smooth(out) : sharp(out);
  }
  function grad(id, stops) {
    var lg = el('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 });
    stops.forEach(function (s) { lg.appendChild(el('stop', { offset: s[0] + '%', 'stop-color': s[1] })); });
    return lg;
  }
  function mid(rgba) { // halveer alpha voor de middenstop
    var m = rgba.match(/rgba?\(([^)]+)\)/); if (!m) return rgba;
    var p = m[1].split(',').map(function (x) { return x.trim(); });
    var a = p.length > 3 ? parseFloat(p[3]) : 1;
    return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + (a * 0.32).toFixed(3) + ')';
  }
  function text(x, y, str, attrs) {
    var e = el('text', Object.assign({ x: x, y: y }, attrs));
    e.textContent = str; return e;
  }

  global.EquityCurve = Chart;
})(window);
