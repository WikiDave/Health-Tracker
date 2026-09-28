/* Eenvoudige lijngrafiek in SVG met referentieband, kruisdraad en tooltip. Geen externe bibliotheken. */
(function (HT) {
  'use strict';
  const { parseISO, formatDateShort, formatDate, formatNum } = HT.utils;
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function niceTicks(min, max, count) {
    const span = max - min || 1;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
    const ticks = [];
    for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(Number(t.toFixed(10)));
    return ticks;
  }

  /**
   * @param {HTMLElement} container
   * @param {{series:Array<{name:string, color:string, points:Array<{date:string,value:number}>}>,
   *          low?:number, high?:number, unit?:string, height?:number}} opts
   */
  function lineChart(container, opts) {
    const series = opts.series.filter((s) => s.points.length);
    container.innerHTML = '';
    container.classList.add('chart');
    if (!series.length) {
      container.innerHTML = '<p class="muted">Nog geen gegevens om te tonen.</p>';
      return;
    }

    const W = Math.max(280, container.clientWidth || 600);
    const H = opts.height || 220;
    const m = { top: 14, right: 16, bottom: 28, left: 44 };
    const iw = W - m.left - m.right;
    const ih = H - m.top - m.bottom;

    const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
    const t0 = parseISO(dates[0]).getTime();
    const t1 = parseISO(dates[dates.length - 1]).getTime();
    const x = (iso) => (t1 === t0 ? m.left + iw / 2 : m.left + ((parseISO(iso).getTime() - t0) / (t1 - t0)) * iw);

    const values = series.flatMap((s) => s.points.map((p) => p.value));
    if (opts.low != null) values.push(opts.low);
    if (opts.high != null) values.push(opts.high);
    let yMin = Math.min(...values);
    let yMax = Math.max(...values);
    const pad = (yMax - yMin) * 0.12 || Math.abs(yMax) * 0.1 || 1;
    yMin -= pad;
    yMax += pad;
    const ticks = niceTicks(yMin, yMax, 4);
    yMin = Math.min(yMin, ticks[0]);
    yMax = Math.max(yMax, ticks[ticks.length - 1]);
    const y = (v) => m.top + ih - ((v - yMin) / (yMax - yMin)) * ih;

    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.label || 'Grafiek' });

    // Referentieband
    if (opts.low != null || opts.high != null) {
      const top = y(opts.high != null ? opts.high : yMax);
      const bottom = y(opts.low != null ? opts.low : yMin);
      el('rect', { x: m.left, y: top, width: iw, height: Math.max(0, bottom - top), class: 'ref-band' }, svg);
      if (opts.high != null) el('line', { x1: m.left, x2: m.left + iw, y1: top, y2: top, class: 'ref-line' }, svg);
      if (opts.low != null) el('line', { x1: m.left, x2: m.left + iw, y1: bottom, y2: bottom, class: 'ref-line' }, svg);
    }

    // Rasterlijnen en y-as
    for (const t of ticks) {
      el('line', { x1: m.left, x2: m.left + iw, y1: y(t), y2: y(t), class: 'grid' }, svg);
      const lbl = el('text', { x: m.left - 8, y: y(t), class: 'axis', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg);
      lbl.textContent = formatNum(Number(t.toFixed(2)));
    }

    // x-as: eerste, laatste en (indien ruimte) middelste datum
    const xLabels = dates.length > 2 && iw > 360 ? [dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]] : [dates[0], dates[dates.length - 1]];
    [...new Set(xLabels)].forEach((d, i, arr) => {
      const anchor = arr.length === 1 ? 'middle' : i === 0 ? 'start' : i === arr.length - 1 ? 'end' : 'middle';
      const lbl = el('text', { x: x(d), y: H - 8, class: 'axis', 'text-anchor': anchor }, svg);
      lbl.textContent = formatDateShort(d);
    });

    const outOfRange = (v) => (opts.low != null && v < opts.low) || (opts.high != null && v > opts.high);

    // Lijnen en punten
    for (const s of series) {
      const pts = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1));
      if (pts.length > 1) {
        el('polyline', { points: pts.map((p) => `${x(p.date)},${y(p.value)}`).join(' '), class: 'series-line', style: `stroke:${s.color}` }, svg);
      }
      for (const p of pts) {
        el('circle', { cx: x(p.date), cy: y(p.value), r: 4, class: 'series-dot' + (outOfRange(p.value) ? ' out' : ''), style: `fill:${s.color}` }, svg);
      }
      if (series.length > 1) {
        const last = pts[pts.length - 1];
        const lbl = el('text', { x: Math.min(x(last.date) + 6, W - 2), y: y(last.value) - 8, class: 'direct-label', 'text-anchor': x(last.date) > W - 60 ? 'end' : 'start' }, svg);
        lbl.textContent = s.name;
      }
    }

    // Kruisdraad + tooltip
    const cross = el('line', { y1: m.top, y2: m.top + ih, class: 'crosshair', visibility: 'hidden' }, svg);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;

    function show(clientX) {
      const rect = svg.getBoundingClientRect();
      const px = clientX - rect.left;
      let best = dates[0];
      for (const d of dates) if (Math.abs(x(d) - px) < Math.abs(x(best) - px)) best = d;
      const cx = x(best);
      cross.setAttribute('x1', cx);
      cross.setAttribute('x2', cx);
      cross.setAttribute('visibility', 'visible');
      tip.replaceChildren();
      const head = document.createElement('div');
      head.className = 'tip-date';
      head.textContent = formatDate(best);
      tip.appendChild(head);
      for (const s of series) {
        const p = s.points.find((q) => q.date === best);
        if (!p) continue;
        const row = document.createElement('div');
        row.className = 'tip-row';
        const key = document.createElement('span');
        key.className = 'tip-key';
        key.style.background = s.color;
        const val = document.createElement('strong');
        val.textContent = `${formatNum(p.value)}${opts.unit ? ' ' + opts.unit : ''}`;
        row.append(key, val);
        if (series.length > 1) row.append(document.createTextNode(' ' + s.name));
        if (outOfRange(p.value)) {
          const flag = document.createElement('span');
          flag.className = 'flag ' + (p.value < opts.low ? 'low' : 'high');
          flag.textContent = p.value < opts.low ? '↓ laag' : '↑ hoog';
          row.append(' ', flag);
        }
        tip.appendChild(row);
      }
      tip.hidden = false;
      const left = Math.min(Math.max(cx - tip.offsetWidth / 2, 0), W - tip.offsetWidth);
      tip.style.left = `${left}px`;
    }

    function hide() {
      cross.setAttribute('visibility', 'hidden');
      tip.hidden = true;
    }

    const hit = el('rect', { x: m.left - 10, y: 0, width: iw + 20, height: H, fill: 'transparent' }, svg);
    hit.addEventListener('pointermove', (e) => show(e.clientX));
    hit.addEventListener('pointerdown', (e) => show(e.clientX));
    hit.addEventListener('pointerleave', hide);

    container.append(svg, tip);

    if (series.length > 1) {
      const legend = document.createElement('div');
      legend.className = 'legend';
      for (const s of series) {
        const item = document.createElement('span');
        const key = document.createElement('span');
        key.className = 'tip-key';
        key.style.background = s.color;
        item.append(key, document.createTextNode(s.name));
        legend.appendChild(item);
      }
      container.prepend(legend);
    }
  }

  HT.chart = { lineChart };
})(window.HT);
