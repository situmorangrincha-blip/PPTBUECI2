/* PANDA SUKSESS — export model deck ke PowerPoint (pptxgenjs) + animasi per klik & transisi. */
(function (global) {
  'use strict';
  const IN = 96; // px per inci
  const i = (px) => Math.round((px / IN) * 1000) / 1000;
  const hx = (c) => (c ? c.replace('#', '').slice(0, 6).toUpperCase() : null);
  const tr = (c) => { if (!c) return 0; const h = c.replace('#', ''); return h.length >= 8 ? Math.round((1 - parseInt(h.slice(6, 8), 16) / 255) * 100) : 0; };
  const FONT = 'Quicksand';

  async function toDataUrl(src, cache) {
    if (!src) return null;
    if (src.startsWith('data:image/svg')) { // PowerPoint lebih aman dengan PNG
      if (cache[src]) return cache[src];
      cache[src] = await new Promise((res) => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'); const k = 512 / Math.max(im.width || 512, im.height || 512); cv.width = Math.round((im.width || 512) * k); cv.height = Math.round((im.height || 512) * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/png')); }; im.onerror = () => res(null); im.src = src; });
      return cache[src];
    }
    if (src.startsWith('data:')) return src;
    if (cache[src]) return cache[src];
    const b = await (await fetch(src)).blob();
    cache[src] = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
    return cache[src];
  }
  let pandaPng = null;

  function runsOf(body, ctx) {
    const out = [];
    body.paras.forEach((p, pi) => {
      const runs = p.runs.filter((r) => r.br || r.text);
      if (!runs.length) out.push({ text: '', options: { fontSize: p.endSize || 12, breakLine: pi < body.paras.length - 1, align: al(p.align) } });
      runs.forEach((r, ri) => {
        if (r.br) { out.push({ text: '', options: { breakLine: true } }); return; }
        const o = { fontSize: r.size || 12, bold: !!r.bold, italic: !!r.italic, color: hx(r.color) || '1E1F22', fontFace: FONT, align: al(p.align) };
        if (r.underline) o.underline = { style: 'sng' };
        if (r.spc) o.charSpacing = r.spc;
        if (p.lnSpc) o.lineSpacingMultiple = p.lnSpc;
        if (ri === runs.length - 1 && pi < body.paras.length - 1) o.breakLine = true;
        out.push({ text: String(r.text).replace(/\{\{n\}\}/g, ctx.n).replace(/\{\{total\}\}/g, ctx.total), options: o });
      });
    });
    return out;
  }
  const al = (a) => ({ l: 'left', ctr: 'center', r: 'right', just: 'justify' }[a] || 'left');
  const va = (a) => ({ t: 'top', ctr: 'middle', b: 'bottom' }[a] || 'top');

  async function toPptx(doc, fileName) {
    if (!global.PptxGenJS) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'js/vendor/pptxgen.bundle.js'; sc.onload = res; sc.onerror = () => rej(new Error('Library export gagal dimuat')); document.head.appendChild(sc); });
    global.PANDA && global.PANDA.toast('Menyiapkan PowerPoint…');
    const pres = new global.PptxGenJS();
    pres.defineLayout({ name: 'PANDA', width: i(doc.size.w), height: i(doc.size.h) });
    pres.layout = 'PANDA';
    pres.title = doc.title || 'PANDA SUKSESS';
    pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
    const cache = {};
    if (!pandaPng) pandaPng = await toDataUrl('img/panda_v2.png', cache);
    const vis = doc.slides.filter((s) => !s.hidden);
    const idxOf = (sid) => vis.findIndex((s) => s.id === sid);
    for (let si = 0; si < vis.length; si++) {
      const s = vis[si];
      const sl = pres.addSlide();
      sl.background = { color: hx(s.bg) || 'FFFFFF' };
      const ctx = { n: si + 1, total: vis.length };
      for (const it of s.items) {
        const base = { x: i(it.x), y: i(it.y), w: i(it.w), h: i(it.h), objectName: Model.exportName(it) };
        if (it.rot) base.rotate = it.rot;
        let link = null;
        if (it.link) {
          if (it.link.sid) { const k = idxOf(it.link.sid); if (k >= 0) link = { slide: k + 1 }; }
          else if (it.link.rel) { const k = si + it.link.rel; if (k >= 0 && k < vis.length) link = { slide: k + 1 }; }
          else if (it.link.url) link = { url: it.link.url };
        }
        if (it.kind === 'shape') {
          const shape = it.prst === 'ellipse' ? pres.shapes.OVAL : it.prst === 'roundRect' ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE;
          const o = Object.assign({}, base, { shape, fill: it.fill ? { color: hx(it.fill), transparency: tr(it.fill) } : { type: 'none' }, line: it.line ? { color: hx(it.line.color), width: (it.line.w * 72) / IN } : { type: 'none' } });
          if (it.prst === 'roundRect') o.rectRadius = Math.min(i(it.w), i(it.h)) * (it.adj == null ? 0.16667 : it.adj);
          if (it.shadow) o.shadow = { type: 'outer', color: '1E1F22', opacity: 0.08, blur: 10, offset: 2, angle: 90 };
          if (!it.fill) o.fill = { color: 'FFFFFF', transparency: 100 };
          if (link) o.hyperlink = link;
          if (it.text) {
            Object.assign(o, { valign: va(it.text.anchor), margin: it.text.pad.map((p) => (p * 72) / IN), fontFace: FONT });
            o.margin = [o.margin[3], o.margin[1], o.margin[2], o.margin[0]]; // pptxgenjs: [kiri, kanan, bawah, atas]
            sl.addText(runsOf(it.text, ctx), o);
          } else sl.addShape(shape, o);
        } else if (it.kind === 'pic' || it.kind === 'panda') {
          const data = it.kind === 'panda' ? pandaPng : await toDataUrl(it.src, cache);
          if (!data) continue;
          const o = Object.assign({}, base, { data, altText: it.name || '' });
          if (it.flipH) o.flipH = true;
          if (it.opacity != null && it.opacity < 1) o.transparency = Math.round((1 - it.opacity) * 100);
          if (link) o.hyperlink = link;
          sl.addImage(o);
        } else if (it.kind === 'chart') {
          const ch = it.chart, ax = ch.axes || {};
          const bar = ch.groups.find((g) => g.type === 'bar');
          const opt = Object.assign({}, base, {
            showLegend: !!ch.legend, legendPos: ch.legendPos || 'b', legendFontFace: FONT, legendFontSize: 10, legendColor: '6B6F76',
            catAxisLabelColor: '6B6F76', valAxisLabelColor: '6B6F76', catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, catAxisLabelFontSize: ax.catSize || 10, valAxisLabelFontSize: 9,
            valGridLine: ax.valGrid === false || ax.valHidden ? { style: 'none' } : { color: 'E8E6DF', size: 0.75 }, catGridLine: { style: 'none' }, valAxisHidden: !!ax.valHidden, catAxisHidden: !!ax.catHidden,
            catAxisOrientation: ax.catReverse ? 'maxMin' : 'minMax', dataLabelFontFace: FONT,
          });
          if (ax.valMin != null) opt.valAxisMinVal = ax.valMin; if (ax.valMax != null) opt.valAxisMaxVal = ax.valMax; if (ax.valMajor) opt.valAxisMajorUnit = ax.valMajor;
          if (bar) { opt.barDir = bar.dir === 'bar' ? 'bar' : 'col'; opt.barGrouping = /stacked/.test(bar.grouping) ? 'stacked' : 'clustered'; }
          const types = ch.groups.map((g) => {
            const s0 = g.series[0] || {};
            return {
              type: g.type === 'line' ? pres.charts.LINE : pres.charts.BAR,
              data: g.series.map((s) => ({ name: s.name, labels: s.cats.map(String), values: s.vals.map((v) => (v == null ? 0 : +v)) })),
              options: Object.assign({ chartColors: g.series.map((s) => hx(s.color) || '1E1F22'), showValue: !!s0.showVal, dataLabelFormatCode: s0.fmt || '#,##0', dataLabelPosition: g.type === 'line' ? (['t', 'b', 'l', 'r', 'ctr'].includes(s0.lblPos) ? s0.lblPos : 't') : /stacked/.test(g.grouping) ? (['ctr', 'inEnd', 'inBase'].includes(s0.lblPos) ? s0.lblPos : 'ctr') : (s0.lblPos || 'outEnd'), dataLabelFontSize: s0.lblSize || 9, dataLabelColor: hx(s0.lblColor) || '1E1F22' },
                g.type === 'line' ? { lineSize: 2, lineDataSymbol: s0.marker && s0.marker !== 'none' ? 'circle' : 'none', lineDash: s0.dash && s0.dash !== 'solid' ? 'dash' : 'solid' } : { barGrouping: /stacked/.test(g.grouping) ? 'stacked' : 'clustered', barDir: g.dir === 'bar' ? 'bar' : 'col', barGapWidthPct: g.gap == null ? 150 : g.gap }),
            };
          });
          if (types.length === 1) { const t = types[0]; sl.addChart(t.type, t.data, Object.assign(opt, t.options)); }
          else sl.addChart(types, opt);
        } else if (it.kind === 'table') {
          const rows = it.table.rows.map((r) => r.cells.filter((c) => !c.hMerge && !c.vMerge).map((c) => ({
            text: c.body ? runsOf(c.body, ctx) : '',
            options: Object.assign({ fill: c.fill ? { color: hx(c.fill) } : undefined, valign: va(c.anchor), margin: [(c.pad[3] * 72) / IN, (c.pad[1] * 72) / IN, (c.pad[2] * 72) / IN, (c.pad[0] * 72) / IN], fontFace: FONT },
              c.span > 1 ? { colspan: c.span } : {}, c.rowSpan > 1 ? { rowspan: c.rowSpan } : {}),
          })));
          sl.addTable(rows, Object.assign({}, base, { colW: it.table.cols.map(i), rowH: it.table.rows.map((r) => i(r.h)), border: { type: 'solid', pt: 0.5, color: 'E3E1DA' }, fontFace: FONT }));
        }
      }
      if (s.notes) sl.addNotes(s.notes);
    }
    const buf = await pres.write({ outputType: 'arraybuffer' });
    const out = await animate(buf);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
    a.download = fileName || 'PANDA_SUKSESS.pptx'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    global.PANDA && global.PANDA.toast('PowerPoint terunduh');
  }

  // transisi fade + animasi masuk per klik untuk objek bernama |s=n (port dari ppt_anim.py)
  async function animate(buf) {
    const zip = await JSZip.loadAsync(buf);
    const TRANS = '<p:transition spd="med"><p:fade/></p:transition>';
    for (const name of Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
      let s = await zip.file(name).async('string');
      const groups = {}, textIds = new Set();
      const re = /<p:(sp|pic|graphicFrame)>([\s\S]*?)<\/p:\1>/g; let m;
      while ((m = re.exec(s))) {
        const c = /<p:cNvPr id="(\d+)" name="([^"]*)"/.exec(m[2]); if (!c) continue;
        const st = /\|s=(\d+)/.exec(c[2]); if (!st) continue;
        (groups[+st[1]] = groups[+st[1]] || []).push(c[1]);
        if (m[1] === 'sp' && m[2].indexOf('<p:txBody>') >= 0) textIds.add(c[1]);
      }
      let add = TRANS;
      const keys = Object.keys(groups).map(Number).sort((a, b) => a - b);
      if (keys.length) {
        let id = 2; const n = () => ++id;
        let seq = '';
        keys.forEach((k) => {
          let inner = '';
          groups[k].forEach((sp, j) => {
            const grp = textIds.has(sp) ? ' grpId="0"' : '';
            inner += `<p:par><p:cTn id="${n()}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold"${grp} nodeType="${j ? 'withEffect' : 'clickEffect'}"><p:stCondLst><p:cond delay="${j * 60}"/></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="${n()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${sp}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set><p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${n()}" dur="450"/><p:tgtEl><p:spTgt spid="${sp}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>`;
          });
          seq += `<p:par><p:cTn id="${n()}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${n()}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${inner}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
        });
        const all = new Set(keys.flatMap((k) => groups[k]));
        const bld = [...textIds].filter((x) => all.has(x)).sort((a, b) => a - b).map((x) => `<p:bldP spid="${x}" grpId="0" animBg="1"/>`).join('');
        add += `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${seq}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>${bld ? '<p:bldLst>' + bld + '</p:bldLst>' : ''}</p:timing>`;
      }
      s = s.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + add);
      zip.file(name, s);
    }
    Object.keys(zip.files).forEach((n) => { if (zip.files[n] && zip.files[n].dir) delete zip.files[n]; });
    return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  }

  global.PandaExport = { toPptx, animate };
})(window);
