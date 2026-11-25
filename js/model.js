/* PANDA SUKSESS — model deck (JSON). Web memakai model ini sebagai master; PPT hanya untuk import/export. */
(function (global) {
  'use strict';
  const uid = () => Math.random().toString(36).slice(2, 9);
  const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
  function colHex(c) {
    if (!c) return null;
    const h = '#' + c.rgb.map(hex2).join('');
    return c.a < 0.999 ? h + hex2(c.a * 255) : h;
  }
  // '#RRGGBB' / '#RRGGBBAA' -> {hex:'RRGGBB', alpha:0..1}
  function splitCol(s) {
    if (!s) return null;
    const h = s.replace('#', '');
    return { hex: h.slice(0, 6).toUpperCase(), alpha: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  function joinCol(hex, alpha) {
    hex = (hex || '#000000').replace('#', '').slice(0, 6).toUpperCase();
    return '#' + hex + (alpha == null || alpha >= 0.999 ? '' : hex2(Math.max(0, alpha) * 255));
  }
  const r2 = (n) => Math.round(n * 100) / 100;

  function normText(body) {
    if (!body) return null;
    return {
      anchor: body.anchor || 't', pad: (body.pad || [0, 0, 0, 0]).map(r2), wrap: body.wrap !== false,
      paras: body.paras.map((p) => {
        const o = { align: p.align || 'l', runs: p.runs.map((r) => {
          if (r.br) return { br: true };
          const x = { text: r.text, size: r.size };
          if (r.bold) x.bold = true; if (r.italic) x.italic = true; if (r.underline) x.underline = true;
          if (r.spc) x.spc = r.spc; if (r.color) x.color = colHex(r.color);
          return x;
        }) };
        if (p.lnSpc) o.lnSpc = p.lnSpc; if (p.endSize) o.endSize = p.endSize;
        return o;
      }),
    };
  }

  function normItem(it) {
    const m = it.meta || {};
    const o = { id: uid(), kind: it.kind, name: m.label || it.name || '', x: r2(it.x), y: r2(it.y), w: r2(it.w), h: r2(it.h) };
    if (it.rot) o.rot = it.rot; if (it.flipH) o.flipH = true;
    if (m.step) o.step = m.step; if (m.dd) o.dd = m.dd; if (m.fx) o.fx = m.fx;
    if (it.link) o.link = it.link;
    if (it.kind === 'shape') {
      o.prst = it.prst; if (it.prst === 'roundRect') o.adj = r2(it.adj);
      o.fill = colHex(it.fill); if (it.line) o.line = { color: colHex(it.line.color), w: r2(it.line.w) };
      if (it.shadow) o.shadow = true;
      const t = normText(it.text);
      if (t && t.paras.some((p) => p.runs.some((r) => r.text && r.text.trim()))) o.text = t;
    } else if (it.kind === 'pic') {
      o.src = it.src; if (it.opacity != null && it.opacity < 1) o.opacity = it.opacity;
      if (m.w === 'panda') { o.kind = 'panda'; delete o.src; o.variant = 'v2'; }
    } else if (it.kind === 'chart') {
      o.chart = it.chart;
    } else if (it.kind === 'table') {
      o.table = { cols: it.table.cols.map(r2), rows: it.table.rows.map((r) => ({ h: r2(r.h), cells: r.cells.map((c) => {
        const x = { body: normText(c.body), anchor: c.anchor, pad: c.pad.map(r2) };
        if (c.fill) x.fill = colHex(c.fill); if (c.border) x.border = colHex(c.border);
        if (c.span > 1) x.span = c.span; if (c.rowSpan > 1) x.rowSpan = c.rowSpan; if (c.hMerge) x.hMerge = true; if (c.vMerge) x.vMerge = true;
        return x;
      }) })) };
    }
    return o;
  }

  // parsed (dari PPTX.parsePptx) -> deck model
  function fromParsed(p) {
    const slides = p.slides.map((s) => ({ id: uid(), bg: colHex(s.bg) || '#FFFFFF', notes: s.notes || '', items: s.items.slice().sort((a, b) => a.z - b.z).map(normItem) }));
    slides.forEach((s, si) => s.items.forEach((it) => {
      const nm = it.name || '';
      if (/Sebelumnya$/.test(nm) && it.link) it.link = { rel: -1 };
      else if (/Berikutnya$/.test(nm) && it.link) it.link = { rel: 1 };
      else if (it.link && it.link.slide != null) it.link = slides[it.link.slide] ? { sid: slides[it.link.slide].id } : null;
      if (nm === 'Nomor halaman' && it.text) { it.text.paras[0].runs = [Object.assign({}, it.text.paras[0].runs[0], { text: '{{n}} / {{total}}' })]; }
      if (!it.link) delete it.link;
    }));
    return { version: 1, title: p.title || 'Presentasi', size: p.size, slides };
  }

  // ---------- helper ----------
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function cloneItem(it) { const c = clone(it); c.id = uid(); return c; }
  function cloneSlide(s) { const c = clone(s); c.id = uid(); c.items.forEach((it) => (it.id = uid())); return c; }
  function plainText(it) {
    const b = it.text || (it.kind === 'table' ? null : null);
    if (!b) return '';
    return b.paras.map((p) => p.runs.map((r) => (r.br ? '\n' : r.text || '')).join('')).join('\n');
  }
  function exportName(it) {
    return (it.name || it.kind) + (it.step ? `|s=${it.step}` : '') + (it.dd ? `|dd=${it.dd}` : '') + (it.fx ? `|fx=${it.fx}` : '') + (it.kind === 'panda' ? '|w=panda' : '');
  }
  const K = { ink: '#1E1F22', mute: '#6B6F76', green: '#5E9C64', greenD: '#3F7449', greenL: '#E4EFE2', amber: '#E2A33B', amberL: '#FBEFD8', red: '#C2504A', redL: '#F6E1DF', soft: '#EFEDE6', card: '#FFFFFF', line: '#E3E1DA', bg: '#F7F6F2' };
  const run = (text, size, o = {}) => Object.assign({ text, size }, o);
  const body = (paras, o = {}) => Object.assign({ anchor: 't', pad: [0, 0, 0, 0], wrap: true, paras }, o);

  const tpl = {
    text: (x, y) => ({ id: uid(), kind: 'shape', name: 'Teks', x, y, w: 420, h: 60, prst: 'rect', fill: null, text: body([{ align: 'l', runs: [run('Ketik teks di sini', 20, { color: K.ink })] }]) }),
    heading: (x, y) => ({ id: uid(), kind: 'shape', name: 'Judul', x, y, w: 900, h: 60, prst: 'rect', fill: null, text: body([{ align: 'l', runs: [run('Judul slide', 25, { bold: true, color: K.ink })] }], { anchor: 'ctr' }) }),
    rect: (x, y) => ({ id: uid(), kind: 'shape', name: 'Kotak', x, y, w: 260, h: 160, prst: 'roundRect', adj: 0.08, fill: K.card, shadow: true }),
    pill: (x, y) => ({ id: uid(), kind: 'shape', name: 'Chip', x, y, w: 130, h: 27, prst: 'roundRect', adj: 0.5, fill: K.greenL, text: body([{ align: 'ctr', runs: [run('+12,5%', 10.5, { bold: true, color: K.greenD })] }], { anchor: 'ctr' }) }),
    circle: (x, y) => ({ id: uid(), kind: 'shape', name: 'Lingkaran', x, y, w: 140, h: 140, prst: 'ellipse', fill: K.green }),
    line: (x, y) => ({ id: uid(), kind: 'shape', name: 'Garis', x, y, w: 300, h: 3, prst: 'rect', fill: K.line }),
    kpi: (x, y) => ({ id: uid(), kind: 'shape', name: 'KPI', x, y, w: 200, h: 110, prst: 'roundRect', adj: 0.1, fill: K.soft,
      text: body([{ align: 'l', runs: [run('LABEL KPI', 9.5, { bold: true, color: K.mute, spc: 1 })] }, { align: 'l', runs: [run('1.234', 26, { bold: true, color: K.ink })] }, { align: 'l', runs: [run('+12,5% vs before', 10, { bold: true, color: K.greenD })] }], { pad: [12, 14, 12, 14], anchor: 'ctr' }) }),
    note: (x, y) => ({ id: uid(), kind: 'shape', name: 'Catatan', x, y, w: 300, h: 120, prst: 'roundRect', adj: 0.08, fill: K.amberL,
      text: body([{ align: 'l', runs: [run('CATATAN', 9.5, { bold: true, color: '#9A6A14', spc: 1 })] }, { align: 'l', runs: [run('Tulis poin penting di sini.', 12, { color: K.ink })] }], { pad: [12, 14, 12, 14] }) }),
    pic: (x, y, src, w, h) => ({ id: uid(), kind: 'pic', name: 'Gambar', x, y, w: w || 240, h: h || 240, src }),
    panda: (x, y) => ({ id: uid(), kind: 'panda', name: 'Maskot panda', x, y, w: 240, h: 282, variant: 'v2' }),
    chart: (x, y) => ({ id: uid(), kind: 'chart', name: 'Grafik', x, y, w: 520, h: 300, chart: {
      legend: true, legendPos: 'b', axes: { valMin: 0, valMax: null, valMajor: null, valHidden: false, valGrid: true, valFmt: '#,##0', catReverse: false, catHidden: false, catSize: 10, catRot: null },
      groups: [{ type: 'bar', dir: 'col', grouping: 'clustered', gap: 60, series: [
        { name: 'Before', cats: ['Rute A', 'Rute B', 'Rute C'], vals: [120, 90, 140], color: '#B5B8BD', showVal: true, fmt: '#,##0', lblPos: 'outEnd', lblSize: 9 },
        { name: 'After', cats: ['Rute A', 'Rute B', 'Rute C'], vals: [150, 110, 170], color: '#1E1F22', showVal: true, fmt: '#,##0', lblPos: 'outEnd', lblSize: 9 }] }] } }),
    table: (x, y) => {
      const cell = (t, head) => ({ body: body([{ align: head ? 'ctr' : 'l', runs: [run(t, head ? 10 : 11, head ? { bold: true, color: '#FFFFFF' } : { color: K.ink })] }], { anchor: 'ctr' }), anchor: 'ctr', pad: [4, 7, 4, 7], fill: head ? K.ink : K.card, border: K.line });
      return { id: uid(), kind: 'table', name: 'Tabel', x, y, w: 480, h: 120, table: { cols: [200, 140, 140], rows: [
        { h: 30, cells: [cell('Kolom 1', 1), cell('Kolom 2', 1), cell('Kolom 3', 1)] }, { h: 45, cells: [cell('Isi'), cell('0'), cell('0')] }, { h: 45, cells: [cell('Isi'), cell('0'), cell('0')] }] } };
    },
  };
  function blankSlide(withChrome, from) {
    const s = { id: uid(), bg: K.bg, notes: '', items: [] };
    if (withChrome && from) {
      const keep = /^(Logo jejak panda|Wordmark|Tab |Link Ke |Nav |Link |Nomor halaman)/;
      s.items = from.items.filter((it) => keep.test(it.name || '') && !/Mulai/.test(it.name || '')).map(cloneItem);
      s.items.forEach((it) => { if (/^Tab /.test(it.name)) { /* reset tab aktif */ if (it.fill && it.fill.toUpperCase().startsWith('#1E1F22')) { it.fill = '#FFFFFF'; it.line = { color: K.line, w: 1 }; it.text.paras.forEach((p) => p.runs.forEach((r) => (r.color = K.mute))); } } });
      s.items.push(tpl.heading(48, 69));
    }
    return s;
  }

  global.Model = { uid, colHex, splitCol, joinCol, fromParsed, clone, cloneItem, cloneSlide, plainText, exportName, tpl, blankSlide, K };
})(window);
