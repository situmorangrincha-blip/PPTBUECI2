/* PANDA SUKSESS — render model deck ke DOM (dipakai mode presentasi, editor, thumbnail). */
(function (global) {
  'use strict';
  const PX = 96;
  const FONT = 'Quicksand, system-ui, sans-serif';

  const FMT = (v, code) => {
    if (v == null || isNaN(v)) return '';
    code = code || 'General';
    if (/^\[>=?([\d.]+)\]/.test(code)) {
      const m = code.match(/^\[(>=?)([\d.]+)\]([^;]*);/);
      if (m) { const ok = m[1] === '>=' ? v >= Number(m[2]) : v > Number(m[2]); if (!ok) return ''; code = m[3]; }
    }
    const pctSign = /"%"/.test(code) || /%$/.test(code.replace(/"[^"]*"/g, ''));
    const dec = (code.split('.')[1] || '').replace(/[^0#]/g, '').length;
    const plus = /^\+/.test(code);
    const val = /%$/.test(code.replace(/"[^"]*"/g, '')) && !/"%"/.test(code) ? v * 100 : v;
    const s = Number(val).toLocaleString('id-ID', { minimumFractionDigits: code === 'General' ? 0 : dec, maximumFractionDigits: code === 'General' ? 2 : dec });
    return (plus && v > 0 ? '+' : '') + s + (pctSign ? '%' : '');
  };

  function radius(it) {
    if (it.prst === 'ellipse') return '50%';
    if (it.prst === 'roundRect') return Math.min(it.w, it.h) * (it.adj == null ? 0.16667 : it.adj) + 'px';
    return '0';
  }

  function tok(t, ctx) { return ctx && t && t.indexOf('{{') >= 0 ? t.replace(/\{\{n\}\}/g, ctx.n).replace(/\{\{total\}\}/g, ctx.total) : t; }

  function renderText(body, el, ctx, opt = {}) {
    el.style.display = 'flex'; el.style.flexDirection = 'column';
    el.style.justifyContent = { t: 'flex-start', ctr: 'center', b: 'flex-end' }[body.anchor] || 'flex-start';
    el.style.padding = (body.pad || [0, 0, 0, 0]).map((p) => p + 'px').join(' ');
    const counters = [];
    for (const p of body.paras) {
      const d = document.createElement('div');
      d.className = 'pp';
      d.dataset.align = p.align || 'l';
      d.style.textAlign = { l: 'left', ctr: 'center', r: 'right', just: 'justify' }[p.align] || 'left';
      const sizes = p.runs.filter((r) => !r.br).map((r) => r.size || 12);
      const maxSize = Math.max(p.endSize || 0, ...sizes, 1);
      d.style.fontSize = (maxSize || 12) * PX / 72 + 'px';
      d.style.lineHeight = p.lnSpc ? String(1.2 * p.lnSpc) : '1.2';
      if (!p.runs.length || p.runs.every((r) => !r.br && !r.text)) { d.innerHTML = '<br>'; if (p.runs[0]) Object.assign(d.dataset, { size: p.runs[0].size }); }
      for (const r of p.runs) {
        if (r.br) { d.appendChild(document.createElement('br')); continue; }
        if (!r.text) continue;
        const s = document.createElement('span');
        s.textContent = tok(r.text, ctx);
        s.style.fontSize = (r.size || 12) * PX / 72 + 'px';
        if (r.bold) s.style.fontWeight = '700';
        if (r.italic) s.style.fontStyle = 'italic';
        if (r.spc) s.style.letterSpacing = r.spc * PX / 72 + 'px';
        s.style.color = r.color || '#1E1F22';
        if (r.underline) s.style.textDecoration = 'underline';
        if (opt.count && (r.size || 0) >= 16 && /\d/.test(r.text) && r.text.indexOf('{{') < 0) counters.push(s);
        d.appendChild(s);
      }
      el.appendChild(d);
    }
    return counters;
  }

  function renderTable(t, el, ctx) {
    const tb = document.createElement('table');
    tb.className = 'pp-table';
    const cg = document.createElement('colgroup');
    t.cols.forEach((w) => { const c = document.createElement('col'); c.style.width = w + 'px'; cg.appendChild(c); });
    tb.appendChild(cg);
    t.rows.forEach((r, ri) => {
      const tr = document.createElement('tr'); tr.style.height = r.h + 'px';
      r.cells.forEach((c, ci) => {
        if (c.hMerge || c.vMerge) return;
        const td = document.createElement('td');
        td.dataset.r = ri; td.dataset.c = ci;
        if (c.span > 1) td.colSpan = c.span;
        if (c.rowSpan > 1) td.rowSpan = c.rowSpan;
        if (c.fill) td.style.background = c.fill;
        td.style.borderColor = c.border || '#E3E1DA';
        td.style.verticalAlign = { t: 'top', ctr: 'middle', b: 'bottom' }[c.anchor] || 'middle';
        const inner = document.createElement('div'); inner.className = 'cell';
        if (c.body) renderText(Object.assign({}, c.body, { pad: c.pad, anchor: c.anchor }), inner, ctx);
        td.appendChild(inner); tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    el.appendChild(tb);
  }

  function chartConfig(ch, font) {
    font = font || FONT;
    const groups = ch.groups;
    const first = groups[0];
    const horizontal = first && first.type === 'bar' && first.dir === 'bar';
    const cats = (first && first.series[0] && first.series[0].cats) || [];
    const datasets = [];
    let stacked = false;
    groups.forEach((g) => {
      if (g.type === 'bar' && /stacked/i.test(g.grouping)) stacked = true;
      g.series.forEach((s) => {
        const isLine = g.type === 'line';
        datasets.push({
          type: isLine ? 'line' : 'bar',
          label: s.name,
          data: cats.map((_, i) => (s.vals[i] == null || s.vals[i] === '' ? null : Number(s.vals[i]))),
          backgroundColor: s.color, borderColor: s.color,
          borderWidth: isLine ? Math.max(1.5, s.lineW || 2) : 0,
          borderDash: isLine && s.dash && s.dash !== 'solid' ? [6, 5] : undefined,
          pointRadius: isLine ? (s.marker && s.marker !== 'none' ? 3.5 : 0) : undefined,
          pointBackgroundColor: s.color,
          borderRadius: isLine ? 0 : 3,
          categoryPercentage: isLine ? undefined : Math.max(0.35, 1 - (g.gap == null ? 150 : g.gap) / 260),
          barPercentage: isLine ? undefined : 0.92,
          stack: isLine ? 'line' : stacked ? 'bars' : undefined,
          order: isLine ? 0 : 1,
          tension: 0.3,
          datalabels: s.showVal ? {
            display: (ctx) => FMT(ctx.dataset.data[ctx.dataIndex], s.fmt) !== '' && ctx.dataset.data[ctx.dataIndex] !== 0,
            formatter: (v) => FMT(v, s.fmt), color: s.lblColor || '#1E1F22',
            anchor: s.lblPos === 'inEnd' || s.lblPos === 'ctr' ? (s.lblPos === 'ctr' ? 'center' : 'end') : s.lblPos === 'inBase' ? 'start' : 'end',
            align: s.lblPos === 'inEnd' ? 'start' : s.lblPos === 'ctr' ? 'center' : s.lblPos === 'inBase' ? 'end' : horizontal ? 'right' : 'top',
            offset: 1, clamp: true, font: { family: font, size: (s.lblSize || 9) * PX / 72 + 1, weight: '600' },
          } : { display: false },
        });
      });
    });
    const ax = ch.axes || {};
    const valScale = {
      stacked, display: !ax.valHidden, min: ax.valMin ?? undefined, max: ax.valMax ?? undefined,
      grid: { display: ax.valGrid && !ax.valHidden, color: '#ECEAE3', drawTicks: false }, border: { display: false },
      ticks: { stepSize: ax.valMajor || undefined, color: '#6B6F76', font: { family: font, size: 11 }, callback: (v) => FMT(v, ax.valFmt && ax.valFmt !== 'General' ? ax.valFmt : '#,##0') },
    };
    const catScale = {
      stacked, display: !ax.catHidden, reverse: ax.catReverse, grid: { display: false }, border: { color: '#D6D3CA' },
      ticks: { color: '#6B6F76', font: { family: font, size: (ax.catSize || 10) * PX / 72 + 1, weight: '600' }, maxRotation: ax.catRot ? 90 : 0, minRotation: ax.catRot && Number(ax.catRot) !== 0 ? 90 : 0, autoSkip: false },
    };
    return {
      type: 'bar',
      data: { labels: cats, datasets },
      options: {
        indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart', delay: (c) => (c.type === 'data' ? c.dataIndex * 45 + c.datasetIndex * 90 : 0) },
        layout: { padding: { top: 18, right: 8, left: 4, bottom: 0 } },
        plugins: {
          legend: { display: !!ch.legend, position: { b: 'bottom', t: 'top', r: 'right', l: 'left' }[ch.legendPos] || 'bottom', labels: { boxWidth: 12, boxHeight: 8, color: '#6B6F76', font: { family: font, size: 11 } } },
          tooltip: { backgroundColor: '#1E1F22', titleFont: { family: font }, bodyFont: { family: font }, padding: 10, cornerRadius: 8, callbacks: { label: (c) => ` ${c.dataset.label}: ${Number(c.raw).toLocaleString('id-ID', { maximumFractionDigits: 1 })}` } },
        },
        scales: horizontal ? { x: valScale, y: catScale } : { x: catScale, y: valScale },
      },
    };
  }

  function renderItem(it, ctx = {}) {
    const el = document.createElement('div');
    el.className = 'obj obj-' + it.kind;
    el.dataset.id = it.id;
    Object.assign(el.style, { left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px' });
    if (it.rot) { el.style.rotate = it.rot + 'deg'; el.style.setProperty('--r', it.rot + 'deg'); }
    if (it.step) el.dataset.step = it.step;
    if (it.dd) { el.dataset.dd = it.dd; el.classList.add('dd'); }
    if (it.fx) el.dataset.fx = it.fx;
    if (it.link) { el.classList.add('link'); el.dataset.link = JSON.stringify(it.link); }
    let chart = null;
    if (it.kind === 'shape') {
      if (it.fill) el.style.background = it.fill;
      if (it.line) el.style.boxShadow = `inset 0 0 0 ${it.line.w}px ${it.line.color}`;
      if (it.shadow) el.classList.add('shadow');
      el.style.borderRadius = radius(it);
      if (it.text) {
        const t = document.createElement('div'); t.className = 'txt';
        el._counters = renderText(it.text, t, ctx, { count: true });
        el.appendChild(t);
      }
      if (!it.fill && !it.line && !it.text && it.link) el.classList.add('hotspot');
    } else if (it.kind === 'pic') {
      if (it.src) { const im = document.createElement('img'); im.src = it.src; im.alt = it.name || ''; im.draggable = false; if (it.flipH) im.style.transform = 'scaleX(-1)'; if (it.opacity != null) im.style.opacity = it.opacity; el.appendChild(im); }
    } else if (it.kind === 'panda') {
      if (global.Panda) global.Panda.mount(el, { interactive: !!ctx.interactive, variant: it.variant });
    } else if (it.kind === 'chart') {
      const cv = document.createElement('canvas'); el.appendChild(cv);
      chart = { el, canvas: cv, item: it, cfg: () => chartConfig(it.chart, ctx.font) };
    } else if (it.kind === 'table') {
      renderTable(it.table, el, ctx);
    }
    if (it.fx === 'leaves' && global.Fx && ctx.interactive) global.Fx.leaves(el);
    return { el, chart };
  }

  function renderSlide(slide, deck, opts = {}) {
    const root = document.createElement('div');
    root.className = 'slide';
    root.dataset.sid = slide.id;
    root.style.width = deck.size.w + 'px'; root.style.height = deck.size.h + 'px';
    root.style.background = slide.bg || '#FFFFFF';
    const ctx = Object.assign({ font: FONT, n: opts.n || 1, total: opts.total || deck.slides.length }, opts);
    const charts = [];
    const steps = new Set();
    slide.items.forEach((it) => {
      if (it.hidden) return;
      const { el, chart } = renderItem(it, ctx);
      if (chart) charts.push(chart);
      if (it.step) steps.add(it.step);
      root.appendChild(el);
    });
    return { root, charts, steps: Array.from(steps).sort((a, b) => a - b) };
  }

  global.Render = { renderSlide, renderItem, renderText, chartConfig, FMT, PX, FONT };
})(window);
