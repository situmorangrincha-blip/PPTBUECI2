/* PANDA SUKSESS — pembaca PPTX ringan.
 * Mengubah file .pptx menjadi model slide (shape, teks, gambar, chart, tabel). Render ada di render.js.
 * Konvensi nama objek:  "<label>|s=<langkah klik>|dd=<metrik drill-down>"
 */
(function (global) {
  'use strict';
  const EMU = 914400;          // EMU per inci
  const PX = 96;               // px per inci di stage
  const NS = {
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    c: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  };
  const px = (emu) => (Number(emu) / EMU) * PX;

  // ---------- util XML ----------
  const parseXml = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const kids = (el, ns, name) => (el ? Array.from(el.childNodes).filter((n) => n.nodeType === 1 && n.localName === name && (!ns || n.namespaceURI === NS[ns])) : []);
  const kid = (el, ns, name) => kids(el, ns, name)[0] || null;
  const desc = (el, ns, name) => (el ? Array.from(el.getElementsByTagNameNS(NS[ns], name)) : []);
  const desc1 = (el, ns, name) => desc(el, ns, name)[0] || null;
  const attr = (el, n) => (el ? el.getAttribute(n) : null);
  const rAttr = (el, n) => (el ? el.getAttributeNS(NS.r, n) || el.getAttribute('r:' + n) : null);

  function resolvePath(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/'); parts.pop();
    for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
    return parts.join('/');
  }
  async function readRels(zip, path) {
    const dir = path.substring(0, path.lastIndexOf('/'));
    const file = path.substring(path.lastIndexOf('/') + 1);
    const relPath = `${dir}/_rels/${file}.rels`;
    const f = zip.file(relPath);
    const map = {};
    if (!f) return map;
    const doc = parseXml(await f.async('string'));
    for (const r of Array.from(doc.getElementsByTagName('Relationship'))) {
      map[r.getAttribute('Id')] = { target: r.getAttribute('TargetMode') === 'External' ? r.getAttribute('Target') : resolvePath(path, r.getAttribute('Target')), type: r.getAttribute('Type'), external: r.getAttribute('TargetMode') === 'External' };
    }
    return map;
  }

  // ---------- warna ----------
  let THEME = {};
  function hexToRgb(h) { const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h, s, l];
  }
  function hslToRgb([h, s, l]) {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  function colorOf(el) {
    // el = elemen pembungkus fill (solidFill dsb). Return {rgb:[..], a:0-1} atau null
    if (!el) return null;
    const c = Array.from(el.childNodes).find((n) => n.nodeType === 1 && ['srgbClr', 'schemeClr', 'sysClr', 'prstClr'].includes(n.localName));
    if (!c) return null;
    let hex = '000000';
    if (c.localName === 'srgbClr') hex = attr(c, 'val');
    else if (c.localName === 'sysClr') hex = attr(c, 'lastClr') || '000000';
    else if (c.localName === 'schemeClr') {
      const map = { tx1: 'dk1', tx2: 'dk2', bg1: 'lt1', bg2: 'lt2' };
      const v = attr(c, 'val'); hex = THEME[map[v] || v] || '000000';
    } else if (c.localName === 'prstClr') hex = { black: '000000', white: 'FFFFFF' }[attr(c, 'val')] || '000000';
    let rgb = hexToRgb(hex), a = 1;
    for (const m of Array.from(c.childNodes).filter((n) => n.nodeType === 1)) {
      const v = Number(attr(m, 'val')) / 100000;
      if (m.localName === 'alpha') a = v;
      else if (m.localName === 'lumMod' || m.localName === 'lumOff') { const hsl = rgbToHsl(rgb); hsl[2] = m.localName === 'lumMod' ? hsl[2] * v : Math.min(1, hsl[2] + v); rgb = hslToRgb(hsl); }
      else if (m.localName === 'tint') { rgb = rgb.map((x) => x + (255 - x) * (1 - v)); }
      else if (m.localName === 'shade') { rgb = rgb.map((x) => x * v); }
    }
    return { rgb: rgb.map((x) => Math.round(x)), a };
  }
  const css = (col) => (col ? `rgba(${col.rgb.join(',')},${col.a})` : 'transparent');
  const hexOf = (col) => (col ? '#' + col.rgb.map((x) => x.toString(16).padStart(2, '0')).join('') : null);

  // ---------- nama objek ----------
  function parseName(n) {
    const out = { label: n || '', step: 0, dd: '', fx: '', w: '' };
    const parts = (n || '').split('|');
    out.label = parts[0];
    for (const p of parts.slice(1)) {
      const [k, v] = p.split('=');
      if (k === 's') out.step = Number(v) || 0;
      if (k === 'dd') out.dd = v || '';
      if (k === 'fx') out.fx = v || '';
      if (k === 'w') out.w = v || '';
    }
    return out;
  }

  // ---------- teks ----------
  function parseTxBody(tx) {
    if (!tx) return null;
    const bp = kid(tx, 'a', 'bodyPr');
    const ins = (n, d) => (attr(bp, n) != null ? px(attr(bp, n)) : d);
    const body = {
      anchor: attr(bp, 'anchor') || 't',
      pad: [ins('tIns', 4.8), ins('rIns', 9.6), ins('bIns', 4.8), ins('lIns', 9.6)],
      wrap: attr(bp, 'wrap') !== 'none',
      paras: [],
    };
    for (const p of kids(tx, 'a', 'p')) {
      const pPr = kid(p, 'a', 'pPr');
      const para = { align: attr(pPr, 'algn') || 'l', runs: [], lnSpc: null };
      const lnPct = desc1(kid(pPr, 'a', 'lnSpc'), 'a', 'spcPct');
      if (lnPct) para.lnSpc = Number(attr(lnPct, 'val')) / 100000;
      const end = kid(p, 'a', 'endParaRPr');
      para.endSize = end && attr(end, 'sz') ? Number(attr(end, 'sz')) / 100 : null;
      for (const r of Array.from(p.childNodes).filter((n) => n.nodeType === 1)) {
        if (r.localName === 'br') { para.runs.push({ br: true }); continue; }
        if (r.localName !== 'r' && r.localName !== 'fld') continue;
        const rPr = kid(r, 'a', 'rPr');
        const t = kid(r, 'a', 't');
        para.runs.push({
          text: t ? t.textContent : '',
          size: rPr && attr(rPr, 'sz') ? Number(attr(rPr, 'sz')) / 100 : 18,
          bold: rPr && attr(rPr, 'b') === '1',
          italic: rPr && attr(rPr, 'i') === '1',
          underline: rPr && attr(rPr, 'u') && attr(rPr, 'u') !== 'none',
          spc: rPr && attr(rPr, 'spc') ? Number(attr(rPr, 'spc')) / 100 : 0,
          color: colorOf(kid(rPr, 'a', 'solidFill')),
          font: attr(kid(rPr, 'a', 'latin'), 'typeface'),
        });
      }
      body.paras.push(para);
    }
    return body;
  }

  // ---------- geometri & isi ----------
  function parseXfrm(spPr, tag) {
    const x = kid(spPr, tag === 'p' ? 'p' : 'a', 'xfrm') || desc1(spPr, 'a', 'xfrm');
    const off = kid(x, 'a', 'off'), ext = kid(x, 'a', 'ext');
    return { x: px(attr(off, 'x') || 0), y: px(attr(off, 'y') || 0), w: px(attr(ext, 'cx') || 0), h: px(attr(ext, 'cy') || 0), rot: x && attr(x, 'rot') ? Number(attr(x, 'rot')) / 60000 : 0, flipH: x && attr(x, 'flipH') === '1' };
  }
  function parseSpPr(spPr) {
    const geom = kid(spPr, 'a', 'prstGeom');
    const prst = attr(geom, 'prst') || 'rect';
    const gd = desc1(geom, 'a', 'gd');
    const adj = gd ? Number((attr(gd, 'fmla') || 'val 16667').split(' ')[1]) / 100000 : prst === 'roundRect' ? 0.16667 : 0;
    const fillEl = kid(spPr, 'a', 'solidFill');
    const ln = kid(spPr, 'a', 'ln');
    let line = null;
    if (ln && !kid(ln, 'a', 'noFill')) {
      const lc = colorOf(kid(ln, 'a', 'solidFill'));
      if (lc) line = { color: lc, w: Math.max(0.75, px(attr(ln, 'w') || 9525)) };
    }
    const sh = desc1(spPr, 'a', 'outerShdw');
    return { prst, adj, fill: kid(spPr, 'a', 'noFill') ? null : colorOf(fillEl), line, shadow: !!sh };
  }

  // ---------- chart ----------
  function numCacheOf(el) {
    const cache = desc1(el, 'c', 'numCache') || desc1(el, 'c', 'numLit');
    const out = [];
    if (!cache) return out;
    for (const pt of desc(cache, 'c', 'pt')) out[Number(attr(pt, 'idx'))] = Number(desc1(pt, 'c', 'v').textContent);
    return out;
  }
  function strCacheOf(el) {
    if (!el) return [];
    const lvl = desc1(el, 'c', 'lvl');
    const cache = lvl || desc1(el, 'c', 'strCache') || desc1(el, 'c', 'numCache') || desc1(el, 'c', 'strLit');
    const out = [];
    if (!cache) return out;
    for (const pt of kids(cache, 'c', 'pt')) out[Number(attr(pt, 'idx'))] = desc1(pt, 'c', 'v').textContent;
    return out;
  }
  async function parseChart(zip, path) {
    const f = zip.file(path); if (!f) return null;
    const doc = parseXml(await f.async('string'));
    const plot = desc1(doc, 'c', 'plotArea');
    const chart = { groups: [], legend: !!desc1(doc, 'c', 'legend'), legendPos: 'b', axes: {} };
    const lg = desc1(doc, 'c', 'legend'); if (lg) chart.legendPos = attr(desc1(lg, 'c', 'legendPos'), 'val') || 'b';
    for (const g of Array.from(plot.childNodes).filter((n) => n.nodeType === 1 && /Chart$/.test(n.localName))) {
      const grp = { type: g.localName.replace('Chart', ''), dir: attr(kid(g, 'c', 'barDir'), 'val') || 'col', grouping: attr(kid(g, 'c', 'grouping'), 'val') || 'clustered', gap: Number(attr(kid(g, 'c', 'gapWidth'), 'val') || 150), series: [] };
      for (const s of kids(g, 'c', 'ser')) {
        const sp = kid(s, 'c', 'spPr');
        const lnEl = kid(sp, 'a', 'ln');
        const dl = kid(s, 'c', 'dLbls') || kid(g, 'c', 'dLbls');
        grp.series.push({
          name: strCacheOf(kid(s, 'c', 'tx'))[0] || '',
          cats: strCacheOf(kid(s, 'c', 'cat')),
          vals: numCacheOf(kid(s, 'c', 'val')),
          color: hexOf(colorOf(kid(sp, 'a', 'solidFill'))) || hexOf(colorOf(kid(lnEl, 'a', 'solidFill'))) || '#1E1F22',
          lineW: lnEl && attr(lnEl, 'w') ? px(attr(lnEl, 'w')) : 2,
          dash: lnEl ? attr(desc1(lnEl, 'a', 'prstDash'), 'val') : null,
          marker: attr(desc1(kid(s, 'c', 'marker'), 'c', 'symbol'), 'val') || 'none',
          showVal: dl ? attr(kid(dl, 'c', 'showVal'), 'val') === '1' : false,
          fmt: dl ? attr(kid(dl, 'c', 'numFmt'), 'formatCode') : null,
          lblPos: dl ? attr(kid(dl, 'c', 'dLblPos'), 'val') : null,
          lblColor: dl ? hexOf(colorOf(desc1(kid(dl, 'c', 'txPr'), 'a', 'solidFill'))) : null,
          lblSize: dl && desc1(kid(dl, 'c', 'txPr'), 'a', 'defRPr') ? Number(attr(desc1(kid(dl, 'c', 'txPr'), 'a', 'defRPr'), 'sz') || 900) / 100 : 9,
        });
      }
      chart.groups.push(grp);
    }
    const vax = desc1(plot, 'c', 'valAx'), cax = desc1(plot, 'c', 'catAx');
    const sc = kid(vax, 'c', 'scaling');
    chart.axes = {
      valMin: kid(sc, 'c', 'min') ? Number(attr(kid(sc, 'c', 'min'), 'val')) : null,
      valMax: kid(sc, 'c', 'max') ? Number(attr(kid(sc, 'c', 'max'), 'val')) : null,
      valMajor: kid(vax, 'c', 'majorUnit') ? Number(attr(kid(vax, 'c', 'majorUnit'), 'val')) : null,
      valHidden: attr(kid(vax, 'c', 'delete'), 'val') === '1',
      valGrid: !!kid(vax, 'c', 'majorGridlines') && !desc1(kid(vax, 'c', 'majorGridlines'), 'a', 'noFill'),
      valFmt: attr(kid(vax, 'c', 'numFmt'), 'formatCode'),
      catReverse: attr(desc1(kid(cax, 'c', 'scaling'), 'c', 'orientation'), 'val') === 'maxMin',
      catHidden: attr(kid(cax, 'c', 'delete'), 'val') === '1',
      catSize: desc1(kid(cax, 'c', 'txPr'), 'a', 'defRPr') ? Number(attr(desc1(kid(cax, 'c', 'txPr'), 'a', 'defRPr'), 'sz') || 1000) / 100 : 10,
      catRot: attr(desc1(kid(cax, 'c', 'txPr'), 'a', 'bodyPr'), 'rot'),
    };
    return chart;
  }

  // ---------- tabel ----------
  function parseTable(tbl) {
    const cols = desc(kid(tbl, 'a', 'tblGrid'), 'a', 'gridCol').map((g) => px(attr(g, 'w')));
    const rows = kids(tbl, 'a', 'tr').map((tr) => ({
      h: px(attr(tr, 'h')),
      cells: kids(tr, 'a', 'tc').map((tc) => {
        const pr = kid(tc, 'a', 'tcPr');
        return {
          body: parseTxBody(kid(tc, 'a', 'txBody')),
          fill: colorOf(kid(pr, 'a', 'solidFill')),
          border: colorOf(desc1(kid(pr, 'a', 'lnB') || kid(pr, 'a', 'lnL'), 'a', 'solidFill')),
          anchor: attr(pr, 'anchor') || 't',
          pad: [px(attr(pr, 'marT') || 45720), px(attr(pr, 'marR') || 91440), px(attr(pr, 'marB') || 45720), px(attr(pr, 'marL') || 91440)],
          span: Number(attr(tc, 'gridSpan') || 1), hMerge: attr(tc, 'hMerge') === '1', vMerge: attr(tc, 'vMerge') === '1', rowSpan: Number(attr(tc, 'rowSpan') || 1),
        };
      }),
    }));
    return { cols, rows };
  }

  // ---------- slide ----------
  async function parseSlide(zip, path, slideIndexByPath, media) {
    const doc = parseXml(await zip.file(path).async('string'));
    const rels = await readRels(zip, path);
    const slide = { path, bg: null, items: [], notes: '' };
    const bgPr = desc1(doc, 'p', 'bgPr');
    if (bgPr) slide.bg = colorOf(kid(bgPr, 'a', 'solidFill'));
    const tree = desc1(doc, 'p', 'spTree');
    let z = 0;
    const linkOf = (cNvPr) => {
      const h = kid(cNvPr, 'a', 'hlinkClick');
      if (!h) return null;
      const rel = rels[rAttr(h, 'id')];
      const action = attr(h, 'action') || '';
      if (rel && /slide/.test(rel.type || '') && !rel.external) return { slide: slideIndexByPath[rel.target] };
      if (/nextslide/.test(action)) return { rel: 1 };
      if (/previousslide/.test(action)) return { rel: -1 };
      if (/firstslide/.test(action)) return { slide: 0 };
      if (rel && rel.external) return { url: rel.target };
      return null;
    };
    async function walk(node, offset) {
      for (const el of Array.from(node.childNodes).filter((n) => n.nodeType === 1)) {
        const ln = el.localName;
        if (ln === 'sp') {
          const cNvPr = desc1(el, 'p', 'cNvPr');
          const spPr = kid(el, 'p', 'spPr');
          const x = parseXfrm(spPr);
          slide.items.push(Object.assign({ kind: 'shape', z: z++, id: attr(cNvPr, 'id'), name: attr(cNvPr, 'name'), meta: parseName(attr(cNvPr, 'name')), link: linkOf(cNvPr), text: parseTxBody(kid(el, 'p', 'txBody')) }, offsetBox(x, offset), parseSpPr(spPr)));
        } else if (ln === 'pic') {
          const cNvPr = desc1(el, 'p', 'cNvPr');
          const blip = desc1(el, 'a', 'blip');
          const rel = rels[rAttr(blip, 'embed')];
          let src = null;
          if (rel) { if (!media[rel.target]) { const mf = zip.file(rel.target); if (mf) media[rel.target] = URL.createObjectURL(await mf.async('blob')); } src = media[rel.target]; }
          const x = parseXfrm(kid(el, 'p', 'spPr'));
          const alphaEl = desc1(blip, 'a', 'alphaModFix');
          slide.items.push(Object.assign({ kind: 'pic', z: z++, id: attr(cNvPr, 'id'), name: attr(cNvPr, 'name'), meta: parseName(attr(cNvPr, 'name')), link: linkOf(cNvPr), src, opacity: alphaEl ? Number(attr(alphaEl, 'amt')) / 100000 : 1 }, offsetBox(x, offset)));
        } else if (ln === 'graphicFrame') {
          const cNvPr = desc1(el, 'p', 'cNvPr');
          const x = parseXfrm(el, 'p');
          const chartEl = desc1(el, 'c', 'chart');
          const tbl = desc1(el, 'a', 'tbl');
          const base = { z: z++, id: attr(cNvPr, 'id'), name: attr(cNvPr, 'name'), meta: parseName(attr(cNvPr, 'name')), link: linkOf(cNvPr) };
          if (chartEl) {
            const rel = rels[rAttr(chartEl, 'id')];
            const chart = rel ? await parseChart(zip, rel.target) : null;
            if (chart) slide.items.push(Object.assign({ kind: 'chart', chart }, base, offsetBox(x, offset)));
          } else if (tbl) {
            slide.items.push(Object.assign({ kind: 'table', table: parseTable(tbl) }, base, offsetBox(x, offset)));
          }
        } else if (ln === 'grpSp') {
          const gx = desc1(kid(el, 'p', 'grpSpPr'), 'a', 'xfrm');
          const off = kid(gx, 'a', 'off'), ext = kid(gx, 'a', 'ext'), cOff = kid(gx, 'a', 'chOff'), cExt = kid(gx, 'a', 'chExt');
          const o2 = {
            dx: px(attr(off, 'x')) - px(attr(cOff, 'x')) * (px(attr(ext, 'cx')) / (px(attr(cExt, 'cx')) || 1)),
            dy: px(attr(off, 'y')) - px(attr(cOff, 'y')) * (px(attr(ext, 'cy')) / (px(attr(cExt, 'cy')) || 1)),
            sx: px(attr(ext, 'cx')) / (px(attr(cExt, 'cx')) || 1), sy: px(attr(ext, 'cy')) / (px(attr(cExt, 'cy')) || 1),
          };
          await walk(el, compose(offset, o2));
        }
      }
    }
    await walk(tree, null);
    // catatan pembicara
    const nRel = Object.values(rels).find((r) => /notesSlide/.test(r.type || ''));
    if (nRel && zip.file(nRel.target)) {
      const nd = parseXml(await zip.file(nRel.target).async('string'));
      const bodies = desc(nd, 'p', 'sp').filter((sp) => { const ph = desc1(sp, 'p', 'ph'); return ph && attr(ph, 'type') === 'body'; });
      slide.notes = bodies.map((b) => desc(b, 'a', 't').map((t) => t.textContent).join('')).join('\n');
    }
    return slide;
  }
  function offsetBox(x, o) {
    if (!o) return x;
    return { x: o.dx + x.x * o.sx, y: o.dy + x.y * o.sy, w: x.w * o.sx, h: x.h * o.sy, rot: x.rot, flipH: x.flipH };
  }
  function compose(a, b) { if (!a) return b; return { dx: a.dx + b.dx * a.sx, dy: a.dy + b.dy * a.sy, sx: a.sx * b.sx, sy: a.sy * b.sy }; }

  async function parsePptx(buf) {
    const zip = await JSZip.loadAsync(buf);
    // tema
    THEME = {};
    const th = Object.keys(zip.files).find((n) => /^ppt\/theme\/theme\d+\.xml$/.test(n));
    if (th) {
      const td = parseXml(await zip.file(th).async('string'));
      const cs = desc1(td, 'a', 'clrScheme');
      if (cs) for (const c of Array.from(cs.childNodes).filter((n) => n.nodeType === 1)) {
        const v = kid(c, 'a', 'srgbClr') || kid(c, 'a', 'sysClr');
        if (v) THEME[c.localName] = attr(v, 'val') === 'windowText' ? '000000' : attr(v, 'val') === 'window' ? 'FFFFFF' : attr(v, 'lastClr') || attr(v, 'val');
      }
    }
    const pres = parseXml(await zip.file('ppt/presentation.xml').async('string'));
    const prels = await readRels(zip, 'ppt/presentation.xml');
    const sz = desc1(pres, 'p', 'sldSz');
    const size = { w: px(attr(sz, 'cx')), h: px(attr(sz, 'cy')) };
    const paths = desc(pres, 'p', 'sldId').map((s) => prels[rAttr(s, 'id')].target);
    const idx = {}; paths.forEach((p, i) => (idx[p] = i));
    const media = {};
    const slides = [];
    for (const p of paths) slides.push(await parseSlide(zip, p, idx, media));
    const core = zip.file('docProps/core.xml');
    let title = 'Presentasi';
    if (core) { const cd = parseXml(await core.async('string')); const t = cd.getElementsByTagName('dc:title')[0]; if (t && t.textContent) title = t.textContent; }
    return { size, slides, title, media };
  }

  global.PPTX = { parsePptx, css, hexOf };
})(window);
