/* PANDA SUKSESS — editor ala Canva.
 * Pilih, geser, ubah ukuran, putar, snapping, edit teks langsung, panel properti, tambah objek & slide,
 * urut ulang slide, undo/redo, salin-tempel, simpan bersama (PIN), import & export PPT.
 */
(function (global) {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const P = () => global.PANDA;
  const M = global.Model;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r1 = (n) => Math.round(n * 10) / 10;
  const STICKERS = ['panda_v2', 'panda_peek', 'panda_galih', 'paw', 'paw_amber', 'bamboo_green', 'bamboo_light', 'brush', 'brush_green', 'dezzy_head', 'asep_head', 'iktiar_head', 'maesyaroh_head', 'prayogo_head', 'panda_galih_head'];
  const ICONS = ['FaStar', 'FaRoute', 'FaBoxes', 'FaChartLine', 'FaStore', 'FaUsers', 'FaBullseye', 'FaLightbulb', 'FaTrophy', 'FaRocket', 'FaCoins', 'FaHandshake', 'FaCheckCircle', 'FaHeart', 'FaClock', 'FaMapMarkerAlt', 'FaShoppingCart', 'FaMoneyBillWave', 'FaArrowUp', 'FaArrowDown', 'FaExclamationTriangle', 'FaGraduationCap', 'FaTruck', 'FaCalendarAlt'];
  const ICOL = { k: 'Hitam', g: 'Hijau', a: 'Amber', r: 'Merah', w: 'Putih' };
  const SWATCH = ['#1E1F22', '#6B6F76', '#FFFFFF', '#F7F6F2', '#EFEDE6', '#E3E1DA', '#5E9C64', '#3F7449', '#E4EFE2', '#E2A33B', '#FBEFD8', '#C2504A', '#F6E1DF', '#B5B8BD'];
  const FXS = [['', 'Diam'], ['sway', 'Bergoyang'], ['float', 'Melayang'], ['pulse', 'Berdenyut'], ['spin', 'Berputar pelan'], ['wiggle', 'Bergetar'], ['peek', 'Mengintip'], ['leaves', 'Hujan daun']];

  const E = { on: false, doc: null, si: 0, sel: [], hist: [], fut: [], dirty: false, pin: null, base: null, scale: 1, clip: null, editing: null, excelChanged: false };

  // ---------------------------------------------------------------- dialog kecil
  function ask(title, msg, buttons) {
    return new Promise((res) => {
      const d = document.createElement('div'); d.className = 'modal on ed-dialog';
      d.innerHTML = `<div class="modal-card" style="width:min(440px,calc(100vw - 32px))"><div class="modal-head"><h2>${esc(title)}</h2></div><p>${msg}</p><div class="modal-actions">${buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : b.danger ? 'danger' : 'ghost'}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
      document.body.appendChild(d);
      d.querySelectorAll('button').forEach((b) => (b.onclick = () => { d.remove(); res(buttons[+b.dataset.i].value); }));
    });
  }

  // ---------------------------------------------------------------- PIN & masuk
  async function enter() {
    if (E.on) return;
    if (!E.pin) {
      const ok = await pinPrompt();
      if (!ok) return;
    }
    const S = P().S;
    E.doc = M.clone(S.doc);
    E.base = S.meta && S.meta.updatedAt;
    E.si = Math.min(Math.max(0, S.vis.length ? S.doc.slides.indexOf(S.vis[S.idx]) : 0), E.doc.slides.length - 1);
    E.sel = []; E.hist = []; E.fut = []; E.dirty = false; E.excelChanged = false;
    const dr = await Store.draft.get();
    if (dr && dr.doc && (!E.base || dr.at > new Date(E.base).getTime()) && JSON.stringify(dr.doc) !== JSON.stringify(E.doc)) {
      const v = await ask('Ada draft belum disimpan', `Draft terakhir dari ${new Date(dr.at).toLocaleString('id-ID')} belum disimpan. Pulihkan?`, [{ label: 'Pulihkan draft', value: 1, primary: true }, { label: 'Abaikan', value: 0 }]);
      if (v) { E.doc = dr.doc; E.dirty = true; } else Store.draft.clear();
    }
    build();
    E.on = true;
    document.body.classList.add('editing');
    $('#editor').classList.add('on');
    Panda.corner.present(false);
    renderAll();
    status();
  }
  function pinPrompt() {
    return new Promise((res) => {
      const d = document.createElement('div'); d.className = 'modal on ed-dialog';
      const local = Store.mode === 'local';
      d.innerHTML = `<div class="modal-card pin-card"><img src="img/stickers/panda_v2.png" class="pin-panda" alt=""><div class="modal-head"><h2>Masuk mode edit</h2><button class="x" aria-label="Tutup">×</button></div>
        <p class="muted">${local ? 'Supabase belum diisi, jadi hasil edit tersimpan di <b>browser ini saja</b>. Isi <code>js/config.js</code> supaya tersimpan untuk semua orang.' : 'Hasil edit disimpan untuk semua orang yang membuka web ini.'}</p>
        <label class="fld">Nama kamu <input id="pName" placeholder="mis. Dezzy" value="${esc(localStorage.getItem('panda-editor') || '')}"></label>
        <label class="fld">PIN edit <input id="pPin" type="password" inputmode="numeric" autocomplete="off" placeholder="••••"></label>
        <div class="pin-err" hidden>PIN salah, coba lagi.</div>
        <div class="modal-actions"><button class="btn primary" id="pGo">Mulai edit</button></div></div>`;
      document.body.appendChild(d);
      const pin = $('#pPin', d); setTimeout(() => (localStorage.getItem('panda-editor') ? pin : $('#pName', d)).focus(), 50);
      const done = (v) => { d.remove(); res(v); };
      $('.x', d).onclick = () => done(false);
      const go = async () => {
        const btn = $('#pGo', d); btn.disabled = true; btn.textContent = 'Memeriksa…';
        try {
          const ok = await Store.checkPin(pin.value);
          if (ok) { E.pin = pin.value; try { localStorage.setItem('panda-editor', $('#pName', d).value.trim()); } catch (e) { /* abaikan */ } done(true); return; }
          $('.pin-err', d).hidden = false; $('.modal-card', d).classList.remove('shake'); void d.offsetWidth; $('.modal-card', d).classList.add('shake');
        } catch (e) { $('.pin-err', d).hidden = false; $('.pin-err', d).textContent = 'Gagal cek PIN: ' + e.message; }
        btn.disabled = false; btn.textContent = 'Mulai edit';
      };
      $('#pGo', d).onclick = go;
      d.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') done(false); });
    });
  }
  async function exit() {
    commitText();
    if (E.dirty) {
      const v = await ask('Simpan perubahan?', 'Ada perubahan yang belum disimpan.', [{ label: 'Simpan & keluar', value: 'save', primary: true }, { label: 'Buang perubahan', value: 'drop', danger: true }, { label: 'Batal', value: 'cancel' }]);
      if (v === 'cancel') return;
      if (v === 'save') { const ok = await save(); if (!ok) return; }
      if (v === 'drop') { Store.draft.clear(); }
    }
    E.on = false;
    document.body.classList.remove('editing');
    $('#editor').classList.remove('on');
    destroyCanvasCharts();
    if (!E.dirty || E.savedOnce) P().setDoc(P().S.doc);
    const idx = P().S.vis.findIndex((s) => s.id === (E.doc.slides[E.si] || {}).id);
    if (idx >= 0) P().go(idx, 1, true);
  }

  // ---------------------------------------------------------------- UI
  function build() {
    if ($('#editor')) return;
    const ed = document.createElement('section');
    ed.id = 'editor'; ed.className = 'editor';
    const ins = [['text', 'Teks', 'T'], ['heading', 'Judul', 'H'], ['kpi', 'KPI', '#'], ['pill', 'Chip', '◖'], ['rect', 'Kartu', '▢'], ['circle', 'Lingkaran', '◯'], ['line', 'Garis', '—'], ['note', 'Catatan', '✎'], ['table', 'Tabel', '▦'], ['chart', 'Grafik', '▮'], ['image', 'Gambar', '🖼'], ['sticker', 'Stiker', '★'], ['panda', 'Panda', '🐼']];
    ed.innerHTML = `
      <header class="ed-top">
        <div class="ed-brand"><img src="img/paw.png" alt=""><b>PANDA SUKSESS</b><span class="ed-badge">EDIT</span></div>
        <div class="ed-grp"><button class="eb" data-a="undo" title="Undo (Ctrl+Z)">↶</button><button class="eb" data-a="redo" title="Redo (Ctrl+Y)">↷</button></div>
        <div class="ed-ins">${ins.map(([k, l, i]) => `<button class="ins" data-ins="${k}" title="Tambah ${l}"><i>${i}</i><span>${l}</span></button>`).join('')}</div>
        <div class="ed-right">
          <span class="ed-status" id="edStatus"></span>
          <div class="ed-menu"><button class="eb wide" data-a="menu">File ▾</button>
            <div class="ed-drop" id="edFile">
              <button data-a="import">Import PPT (.pptx)</button>
              <button data-a="export">Export ke PowerPoint</button>
              <button data-a="json">Unduh deck.json (untuk GitHub)</button>
              <button data-a="excel">Ganti Excel data</button>
              <button data-a="history">Riwayat versi</button>
              <button data-a="reset">Kembali ke isi bawaan</button>
            </div></div>
          <button class="eb wide primary" data-a="save" title="Simpan (Ctrl+S)">Simpan</button>
          <button class="eb wide" data-a="exit">Selesai</button>
        </div>
      </header>
      <aside class="ed-slides"><div class="ed-slist" id="edList"></div>
        <div class="ed-add"><button data-add="blank">+ Slide kosong</button><button data-add="chrome">+ Slide dengan header</button><button data-add="dup">⧉ Duplikat slide ini</button></div></aside>
      <main class="ed-canvas" id="edCanvas"><div class="ed-stage" id="edStage"></div><div class="ed-zoom"><span id="edPage"></span></div></main>
      <aside class="ed-props" id="edProps"></aside>
      <input type="file" id="edImg" accept="image/*" hidden><input type="file" id="edPptx" accept=".pptx" hidden><input type="file" id="edXlsx" accept=".xlsx" hidden>
      <div class="ed-pop" id="edStick" hidden></div>`;
    document.body.appendChild(ed);
    ed.addEventListener('click', onTopClick);
    $('#edImg').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) insertImage(f); };
    $('#edPptx').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importPptx(f); };
    $('#edXlsx').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const buf = await f.arrayBuffer(); try { PandaData.parseExcel(buf); P().S.data = PandaData.parseExcel(buf); P().S.excelB64 = Store.bufToB64(buf); E.excelChanged = true; markDirty(); P().toast('Excel dimuat, ikut tersimpan saat Simpan'); } catch (er) { P().toast('Excel tidak terbaca: ' + er.message, true); } };
    bindCanvas();
    window.addEventListener('resize', () => { if (E.on) fitCanvas(); });
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('paste', onPaste);
  }

  function onTopClick(e) {
    const b = e.target.closest('button'); if (!b) { if (!e.target.closest('.ed-menu')) $('#edFile').classList.remove('on'); return; }
    if (!b.closest('.ed-menu')) $('#edFile').classList.remove('on');
    if (b.dataset.ins) return insert(b.dataset.ins, b);
    if (b.dataset.add) return addSlide(b.dataset.add);
    const a = b.dataset.a;
    if (!a) return;
    ({
      undo, redo, save, exit,
      menu: () => $('#edFile').classList.toggle('on'),
      import: () => $('#edPptx').click(),
      export: () => PandaExport.toPptx(E.doc, (E.doc.title || 'PANDA_SUKSESS') + '.pptx'),
      json: downloadJson,
      excel: () => $('#edXlsx').click(),
      history: showHistory,
      reset: resetToDefault,
    }[a] || (() => {}))();
  }

  function status(msg) {
    const s = $('#edStatus'); if (!s) return;
    s.className = 'ed-status ' + (E.dirty ? 'dirty' : 'ok');
    s.textContent = msg || (E.dirty ? 'Belum disimpan' : Store.mode === 'local' ? 'Tersimpan di browser ini' : 'Tersimpan');
  }
  function markDirty(msg) { E.dirty = true; status(msg); clearTimeout(E.dt); E.dt = setTimeout(() => Store.draft.put(E.doc), 800); }

  // ---------------------------------------------------------------- history
  function snapshot() { return JSON.stringify({ slides: E.doc.slides, si: E.si }); }
  function push() { E.hist.push(E.last || snapshot()); if (E.hist.length > 60) E.hist.shift(); E.fut = []; }
  function commit(opts = {}) {
    push();
    E.last = snapshot();
    markDirty();
    if (opts.render !== false) renderCanvas();
    if (opts.props !== false) renderProps();
    refreshThumb(E.si, opts.list);
  }
  function restore(snap) { const o = JSON.parse(snap); E.doc.slides = o.slides; E.si = Math.min(o.si, E.doc.slides.length - 1); E.sel = E.sel.filter((id) => cur().items.some((it) => it.id === id)); E.last = snap; markDirty(); renderAll(); }
  function undo() { commitText(); if (!E.hist.length) return; E.fut.push(snapshot()); restore(E.hist.pop()); }
  function redo() { if (!E.fut.length) return; E.hist.push(snapshot()); restore(E.fut.pop()); }

  // ---------------------------------------------------------------- render
  const cur = () => E.doc.slides[E.si];
  const items = () => cur().items;
  const byId = (id) => items().find((it) => it.id === id);
  const selItems = () => E.sel.map(byId).filter(Boolean);
  function renderAll() { E.last = snapshot(); renderList(); renderCanvas(); renderProps(); }
  let canvasCharts = [];
  function destroyCanvasCharts() { canvasCharts.forEach((c) => c.inst && c.inst.destroy()); canvasCharts = []; }
  function renderCanvas() {
    destroyCanvasCharts();
    const st = $('#edStage');
    st.innerHTML = '';
    const vis = E.doc.slides.filter((s) => !s.hidden);
    const r = Render.renderSlide(cur(), E.doc, { interactive: false, n: Math.max(1, vis.indexOf(cur()) + 1), total: vis.length });
    st.appendChild(r.root);
    r.charts.forEach((c) => { const cfg = c.cfg(); cfg.options.animation = false; c.inst = new Chart(c.canvas.getContext('2d'), cfg); canvasCharts.push(c); });
    const ov = document.createElement('div'); ov.className = 'ed-ov'; ov.id = 'edOv';
    st.appendChild(ov);
    E.root = r.root;
    fitCanvas();
    drawSel();
    $('#edPage').textContent = `Slide ${E.si + 1} / ${E.doc.slides.length}${cur().hidden ? ' · disembunyikan' : ''}`;
  }
  function fitCanvas() {
    const cv = $('#edCanvas'), st = $('#edStage');
    const { w, h } = E.doc.size;
    const sc = Math.min((cv.clientWidth - 48) / w, (cv.clientHeight - 64) / h);
    E.scale = sc;
    st.style.width = w + 'px'; st.style.height = h + 'px';
    st.style.transform = `translate(-50%,-50%) scale(${sc})`;
    st.style.setProperty('--inv', 1 / sc);
  }
  function elOf(id) { return E.root && E.root.querySelector(`.obj[data-id="${id}"]`); }

  function drawSel() {
    const ov = $('#edOv'); if (!ov) return;
    ov.innerHTML = '';
    const its = selItems();
    its.forEach((it) => {
      const b = document.createElement('div'); b.className = 'sel-box' + (its.length === 1 ? ' one' : '');
      Object.assign(b.style, { left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px', rotate: (it.rot || 0) + 'deg' });
      if (its.length === 1 && E.editing !== it.id) {
        ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach((h) => { const d = document.createElement('i'); d.className = 'hd h-' + h; d.dataset.h = h; b.appendChild(d); });
        const rt = document.createElement('i'); rt.className = 'hd h-rot'; rt.dataset.h = 'rot'; rt.title = 'Putar'; b.appendChild(rt);
        const tag = document.createElement('span'); tag.className = 'sel-tag'; tag.textContent = `${it.name || it.kind}${it.step ? ' · klik ' + it.step : ''}${it.dd ? ' · ' + it.dd : ''}${it.fx ? ' · ' + it.fx : ''}`; b.appendChild(tag);
      }
      ov.appendChild(b);
    });
  }

  // ---------------------------------------------------------------- slide list
  function renderList() {
    const L = $('#edList'); L.innerHTML = '';
    const total = E.doc.slides.length;
    E.doc.slides.forEach((s, i) => {
      const row = document.createElement('div'); row.className = 'ed-th' + (i === E.si ? ' on' : '') + (s.hidden ? ' hid' : ''); row.draggable = true; row.dataset.i = i;
      row.innerHTML = `<span class="no">${i + 1}</span><div class="fr"></div><div class="ops"><button data-o="dup" title="Duplikat">⧉</button><button data-o="hide" title="${s.hidden ? 'Tampilkan' : 'Sembunyikan'}">${s.hidden ? '◌' : '◉'}</button><button data-o="del" title="Hapus">🗑</button></div>`;
      L.appendChild(row);
      P().thumb(s, $('.fr', row), i + 1, total);
      row.onclick = (e) => {
        const o = e.target.closest('button');
        if (o) { e.stopPropagation(); return slideOp(o.dataset.o, i); }
        commitText(); E.si = i; E.sel = []; renderList(); renderCanvas(); renderProps();
      };
      row.ondragstart = (e) => { e.dataTransfer.setData('text/plain', i); row.classList.add('drag'); };
      row.ondragend = () => row.classList.remove('drag');
      row.ondragover = (e) => { e.preventDefault(); row.classList.add('over'); };
      row.ondragleave = () => row.classList.remove('over');
      row.ondrop = (e) => { e.preventDefault(); row.classList.remove('over'); const from = +e.dataTransfer.getData('text/plain'); if (from === i) return; push(); const [s2] = E.doc.slides.splice(from, 1); E.doc.slides.splice(i, 0, s2); E.si = i; E.last = snapshot(); markDirty(); renderAll(); };
    });
    const on = L.children[E.si]; if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function refreshThumb(i, full) {
    if (full) return renderList();
    clearTimeout(E.tt);
    E.tt = setTimeout(() => { const row = $(`#edList .ed-th[data-i="${i}"]`); if (!row) return renderList(); const fr = $('.fr', row); fr.innerHTML = ''; P().thumb(E.doc.slides[i], fr, i + 1, E.doc.slides.length); }, 250);
  }
  async function slideOp(o, i) {
    if (o === 'dup') { push(); E.doc.slides.splice(i + 1, 0, M.cloneSlide(E.doc.slides[i])); E.si = i + 1; }
    if (o === 'hide') { push(); E.doc.slides[i].hidden = !E.doc.slides[i].hidden; }
    if (o === 'del') {
      if (E.doc.slides.length <= 1) return P().toast('Minimal harus ada 1 slide', true);
      const v = await ask('Hapus slide?', `Slide ${i + 1} akan dihapus. Bisa dibatalkan dengan Undo.`, [{ label: 'Hapus', value: 1, danger: true }, { label: 'Batal', value: 0 }]);
      if (!v) return;
      push(); E.doc.slides.splice(i, 1); E.si = Math.min(E.si, E.doc.slides.length - 1);
    }
    E.sel = []; E.last = snapshot(); markDirty(); renderAll();
  }
  function addSlide(kind) {
    commitText(); push();
    const s = kind === 'dup' ? M.cloneSlide(cur()) : M.blankSlide(kind === 'chrome', E.doc.slides.find((x) => x.items.some((it) => /^Tab /.test(it.name || ''))) || cur());
    E.doc.slides.splice(E.si + 1, 0, s); E.si++; E.sel = [];
    E.last = snapshot(); markDirty(); renderAll();
  }

  // ---------------------------------------------------------------- canvas interaksi
  function toSlide(e) { const r = $('#edStage').getBoundingClientRect(); return { x: (e.clientX - r.left) / E.scale, y: (e.clientY - r.top) / E.scale }; }
  function bindCanvas() {
    const cv = $('#edCanvas');
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('dblclick', onDbl);
    cv.addEventListener('contextmenu', (e) => { if (e.target.closest('.ed-stage')) e.preventDefault(); });
  }
  function hitItems(e) {
    return document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest && el.closest('#edStage .obj')).filter(Boolean)
      .filter((el, i, a) => a.indexOf(el) === i).map((el) => byId(el.dataset.id)).filter((it) => it && !it.locked && it.fx !== 'leaves');
  }
  let drag = null;
  function onDown(e) {
    if (e.button !== 0) return;
    if (E.editing && e.target.closest('[contenteditable="true"]')) return;
    const h = e.target.closest('.hd');
    const p = toSlide(e);
    if (h) { startHandle(e, h.dataset.h, p); return; }
    if (E.editing) commitText();
    const hits = hitItems(e);
    let it = hits[0];
    if (!e.target.closest('.ed-stage') && !hits.length) { if (e.target.closest('.ed-canvas')) { E.sel = []; drawSel(); renderProps(); } return; }
    if (it && E.sel.length === 1 && E.sel[0] === it.id && hits.length > 1) {
      drag = { cycle: hits, x0: p.x, y0: p.y }; // klik tanpa geser = pilih objek di bawahnya
    }
    if (!it) { // marquee
      if (!e.shiftKey) E.sel = [];
      drag = { marq: true, x0: p.x, y0: p.y, base: E.sel.slice() };
      const m = document.createElement('div'); m.className = 'marq'; $('#edOv').appendChild(m); drag.el = m;
      e.target.setPointerCapture && $('#edCanvas').setPointerCapture(e.pointerId);
      drawSel(); renderProps();
      return;
    }
    if (e.shiftKey) { E.sel = E.sel.includes(it.id) ? E.sel.filter((x) => x !== it.id) : E.sel.concat(it.id); drawSel(); renderProps(); return; }
    if (!E.sel.includes(it.id)) { E.sel = [it.id]; drawSel(); renderProps(); }
    drag = Object.assign(drag || {}, { move: true, x0: p.x, y0: p.y, orig: selItems().map((x) => ({ id: x.id, x: x.x, y: x.y })), moved: false });
    $('#edCanvas').setPointerCapture(e.pointerId);
  }
  function startHandle(e, h, p) {
    const it = selItems()[0]; if (!it) return;
    drag = { handle: h, x0: p.x, y0: p.y, o: { x: it.x, y: it.y, w: it.w, h: it.h, rot: it.rot || 0 }, it, moved: false };
    $('#edCanvas').setPointerCapture(e.pointerId);
  }
  document.addEventListener('pointermove', (e) => {
    if (!drag || !E.on) return;
    const p = toSlide(e);
    let dx = p.x - drag.x0, dy = p.y - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) * E.scale < 3) return;
    drag.moved = true;
    if (drag.marq) {
      const x = Math.min(p.x, drag.x0), y = Math.min(p.y, drag.y0), w = Math.abs(dx), hh = Math.abs(dy);
      Object.assign(drag.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
      const inside = items().filter((it) => it.fx !== 'leaves' && it.x >= x && it.y >= y && it.x + it.w <= x + w && it.y + it.h <= y + hh).map((it) => it.id);
      E.sel = [...new Set(drag.base.concat(inside))];
      $$('.sel-box', $('#edOv')).forEach((b) => b.remove());
      selItems().forEach((it) => { const b = document.createElement('div'); b.className = 'sel-box'; Object.assign(b.style, { left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px' }); $('#edOv').appendChild(b); });
      return;
    }
    if (drag.move) {
      const sel = selItems();
      const bb = bbox(drag.orig.map((o) => Object.assign({}, byId(o.id), { x: o.x, y: o.y })));
      const snap = e.altKey ? { dx: 0, dy: 0, gx: [], gy: [] } : snapMove(bb, dx, dy);
      dx += snap.dx; dy += snap.dy;
      sel.forEach((it) => { const o = drag.orig.find((q) => q.id === it.id); it.x = r1(o.x + dx); it.y = r1(o.y + dy); const el = elOf(it.id); if (el) { el.style.left = it.x + 'px'; el.style.top = it.y + 'px'; } });
      drawSel(); guides(snap.gx, snap.gy);
      return;
    }
    if (drag.handle) {
      const it = drag.it, o = drag.o, h = drag.handle;
      if (h === 'rot') {
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
        let a = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
        if (!e.altKey) { const sn = Math.round(a / 15) * 15; if (Math.abs(sn - a) < 4) a = sn; }
        it.rot = Math.round(((a % 360) + 360) % 360); if (it.rot === 0 || it.rot === 360) delete it.rot;
      } else {
        let { x, y, w, h: hh } = o;
        const keep = e.shiftKey || ((it.kind === 'pic' || it.kind === 'panda') && h.length === 2);
        if (h.includes('e')) w = Math.max(8, o.w + dx);
        if (h.includes('s')) hh = Math.max(4, o.h + dy);
        if (h.includes('w')) { w = Math.max(8, o.w - dx); x = o.x + o.w - w; }
        if (h.includes('n')) { hh = Math.max(4, o.h - dy); y = o.y + o.h - hh; }
        if (keep && h.length === 2) { const r = o.w / o.h; if (w / hh > r) w = hh * r; else hh = w / r; if (h.includes('w')) x = o.x + o.w - w; if (h.includes('n')) y = o.y + o.h - hh; }
        const sn = e.altKey ? null : snapEdges({ x, y, w, h: hh }, h, it.id);
        if (sn) ({ x, y, w, h: hh } = sn.r);
        Object.assign(it, { x: r1(x), y: r1(y), w: r1(w), h: r1(hh) });
        if (sn) guides(sn.gx, sn.gy);
      }
      const el = elOf(it.id);
      if (el) { Object.assign(el.style, { left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px', rotate: (it.rot || 0) + 'deg' }); if (it.prst === 'roundRect') el.style.borderRadius = Math.min(it.w, it.h) * (it.adj == null ? 0.16667 : it.adj) + 'px'; }
      drawSel();
    }
  });
  document.addEventListener('pointerup', () => {
    if (!drag || !E.on) return;
    const d = drag; drag = null;
    guides([], []);
    if (d.marq) { d.el.remove(); drawSel(); renderProps(); return; }
    if (d.cycle && !d.moved) { const i = d.cycle.findIndex((x) => x.id === E.sel[0]); E.sel = [d.cycle[(i + 1) % d.cycle.length].id]; drawSel(); renderProps(); return; }
    if (d.moved) commit({ render: d.handle && d.it.kind === 'chart' || d.handle === 'rot' ? true : !!d.handle });
  });

  // snapping
  function bbox(list) { const x = Math.min(...list.map((i) => i.x)), y = Math.min(...list.map((i) => i.y)); return { x, y, w: Math.max(...list.map((i) => i.x + i.w)) - x, h: Math.max(...list.map((i) => i.y + i.h)) - y }; }
  function targets(excl) {
    const W = E.doc.size.w, H = E.doc.size.h;
    const xs = [0, W / 2, W], ys = [0, H / 2, H];
    items().forEach((it) => { if (excl.includes(it.id) || it.fx === 'leaves' || (it.w > W * 0.9 && it.h > H * 0.9)) return; xs.push(it.x, it.x + it.w / 2, it.x + it.w); ys.push(it.y, it.y + it.h / 2, it.y + it.h); });
    return { xs, ys };
  }
  function snapMove(bb, dx, dy) {
    const T = targets(E.sel), th = 6 / E.scale;
    const best = (vals, cands) => { let b = null; vals.forEach((v) => cands.forEach((c) => { const d = c - v; if (Math.abs(d) < th && (!b || Math.abs(d) < Math.abs(b.d))) b = { d, c }; })); return b; };
    const bx = best([bb.x + dx, bb.x + dx + bb.w / 2, bb.x + dx + bb.w], T.xs), by = best([bb.y + dy, bb.y + dy + bb.h / 2, bb.y + dy + bb.h], T.ys);
    return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, gx: bx ? [bx.c] : [], gy: by ? [by.c] : [] };
  }
  function snapEdges(r, h, id) {
    const T = targets([id]), th = 6 / E.scale; const gx = [], gy = [];
    const near = (v, cs) => cs.reduce((b, c) => (Math.abs(c - v) < th && (!b || Math.abs(c - v) < Math.abs(b - v)) ? c : b), null);
    if (h.includes('e')) { const c = near(r.x + r.w, T.xs); if (c != null) { r.w = c - r.x; gx.push(c); } }
    if (h.includes('w')) { const c = near(r.x, T.xs); if (c != null) { r.w += r.x - c; r.x = c; gx.push(c); } }
    if (h.includes('s')) { const c = near(r.y + r.h, T.ys); if (c != null) { r.h = c - r.y; gy.push(c); } }
    if (h.includes('n')) { const c = near(r.y, T.ys); if (c != null) { r.h += r.y - c; r.y = c; gy.push(c); } }
    return { r, gx, gy };
  }
  function guides(gx, gy) {
    const ov = $('#edOv'); if (!ov) return;
    $$('.guide', ov).forEach((g) => g.remove());
    gx.forEach((x) => { const g = document.createElement('i'); g.className = 'guide v'; g.style.left = x + 'px'; ov.appendChild(g); });
    gy.forEach((y) => { const g = document.createElement('i'); g.className = 'guide h'; g.style.top = y + 'px'; ov.appendChild(g); });
  }

  // ---------------------------------------------------------------- edit teks
  function onDbl(e) {
    const it = hitItems(e)[0]; if (!it) return;
    if (it.kind === 'shape') startText(it);
    else if (it.kind === 'table') startTable(it);
    else if (it.kind === 'chart') { E.sel = [it.id]; renderProps(); const g = $('#edProps .chart-grid'); if (g) g.scrollIntoView({ behavior: 'smooth' }); }
    else if (it.kind === 'pic') { E.sel = [it.id]; replaceImage(); }
  }
  function startText(it) {
    if (!it.text) { it.text = { anchor: 'ctr', pad: [6, 10, 6, 10], wrap: true, paras: [{ align: 'ctr', runs: [{ text: 'Teks', size: 14, color: '#1E1F22' }] }] }; renderCanvas(); }
    const el = elOf(it.id); const t = el && $('.txt', el); if (!t) return;
    E.editing = it.id; E.sel = [it.id];
    el.classList.add('editing');
    t.contentEditable = 'true'; t.spellcheck = false;
    t.focus();
    const rg = document.createRange(); rg.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
    document.execCommand('styleWithCSS', false, true);
    drawSel(); renderProps();
  }
  function startTable(it) {
    const el = elOf(it.id); if (!el) return;
    E.editing = it.id; E.sel = [it.id]; el.classList.add('editing');
    $$('.cell', el).forEach((c) => { c.contentEditable = 'true'; c.spellcheck = false; });
    const first = $('.cell', el); first && first.focus();
    document.execCommand('styleWithCSS', false, true);
    drawSel(); renderProps();
  }
  const rgbHex = (c) => { const m = String(c).match(/\d+(\.\d+)?/g); if (!m) return '#1E1F22'; const h = '#' + m.slice(0, 3).map((x) => Math.round(+x).toString(16).padStart(2, '0')).join('').toUpperCase(); return m[3] != null && +m[3] < 1 ? h + Math.round(+m[3] * 255).toString(16).padStart(2, '0').toUpperCase() : h; };
  function domToParas(box, fallback) {
    const paras = [];
    const blocks = [];
    let loose = null;
    Array.from(box.childNodes).forEach((n) => {
      if (n.nodeType === 1 && /^(DIV|P)$/.test(n.tagName)) { loose = null; blocks.push(n); }
      else { if (!loose) { loose = document.createElement('div'); loose._virtual = []; blocks.push(loose); } loose._virtual.push(n); }
    });
    blocks.forEach((b) => {
      const kids = b._virtual || Array.from(b.childNodes);
      const align = b.dataset && b.dataset.align || ({ left: 'l', center: 'ctr', right: 'r', justify: 'just' }[(b.style && b.style.textAlign) || ''] || (b._virtual ? 'l' : fallback.align || 'l'));
      const para = { align, runs: [] };
      const walk = (n) => {
        if (n.nodeType === 3) {
          if (!n.textContent) return;
          const pe = n.parentElement && n.parentElement.closest('[contenteditable]') ? n.parentElement : b;
          const cs = getComputedStyle(pe.nodeType === 1 ? pe : box);
          let u = false; for (let a = pe; a && a !== box; a = a.parentElement) if (/underline/.test(getComputedStyle(a).textDecorationLine)) u = true;
          const r = { text: n.textContent.replace(/ /g, ' '), size: Math.round((parseFloat(cs.fontSize) * 72) / 96 * 2) / 2 };
          if (+cs.fontWeight >= 600) r.bold = true; if (cs.fontStyle === 'italic') r.italic = true; if (u) r.underline = true;
          const ls = parseFloat(cs.letterSpacing); if (ls) r.spc = r1((ls * 72) / 96);
          r.color = rgbHex(cs.color);
          para.runs.push(r);
        } else if (n.nodeType === 1) {
          if (n.tagName === 'BR') { if (n.nextSibling) para.runs.push({ br: true }); return; }
          if (/^(DIV|P)$/.test(n.tagName)) { // blok bersarang
            if (para.runs.length) para.runs.push({ br: true });
          }
          Array.from(n.childNodes).forEach(walk);
        }
      };
      kids.forEach(walk);
      // gabung run bergaya sama
      const out = [];
      para.runs.forEach((r) => { const l = out[out.length - 1]; if (l && !l.br && !r.br && ['size', 'bold', 'italic', 'underline', 'spc', 'color'].every((k) => l[k] === r[k])) l.text += r.text; else out.push(r); });
      para.runs = out;
      if (!out.length) para.endSize = parseFloat(b.dataset && b.dataset.size) || fallback.size || 12;
      paras.push(para);
    });
    if (!paras.length) paras.push({ align: fallback.align || 'l', runs: [], endSize: fallback.size || 12 });
    return paras;
  }
  function commitText() {
    if (!E.editing) return;
    const it = byId(E.editing); const el = elOf(E.editing);
    E.editing = null;
    if (!it || !el) return;
    if (it.kind === 'shape' && it.text) {
      const t = $('.txt', el);
      const fr = (it.text.paras[0] && it.text.paras[0].runs.find((r) => !r.br)) || { size: 14 };
      const paras = domToParas(t, { align: it.text.paras[0] ? it.text.paras[0].align : 'l', size: fr.size });
      paras.forEach((p, i) => { const o = it.text.paras[i]; if (o && o.lnSpc) p.lnSpc = o.lnSpc; });
      const empty = paras.every((p) => !p.runs.some((r) => r.text && r.text.trim()));
      if (empty && !it.fill && !it.line) { const i = items().indexOf(it); items().splice(i, 1); E.sel = []; }
      else it.text.paras = paras;
    } else if (it.kind === 'table') {
      $$('td', el).forEach((td) => {
        const c = it.table.rows[+td.dataset.r].cells[+td.dataset.c];
        const fr = c.body && c.body.paras[0] && c.body.paras[0].runs.find((r) => !r.br) || { size: 11 };
        const paras = domToParas($('.cell', td), { align: c.body && c.body.paras[0] ? c.body.paras[0].align : 'l', size: fr.size });
        c.body = Object.assign(c.body || { anchor: c.anchor, pad: c.pad, wrap: true }, { paras });
      });
    }
    getSelection().removeAllRanges();
    commit();
  }

  // ---------------------------------------------------------------- keyboard & clipboard
  function onKey(e) {
    if (!E.on) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    const inField = e.target.matches('input, select, textarea');
    if (E.editing) {
      if (k === 'Escape') { e.preventDefault(); commitText(); drawSel(); }
      else if (mod && /^[biu]$/i.test(k)) { e.preventDefault(); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[k.toLowerCase()]); }
      e.stopPropagation();
      return;
    }
    if (inField) { if (mod && k.toLowerCase() === 's') { e.preventDefault(); save(); } return; }
    if ($('.ed-dialog')) return;
    e.stopPropagation();
    if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (mod && k.toLowerCase() === 'a') { e.preventDefault(); E.sel = items().filter((it) => it.fx !== 'leaves').map((it) => it.id); drawSel(); renderProps(); return; }
    if (mod && k.toLowerCase() === 'c') { if (E.sel.length) { E.clip = selItems().map(M.clone); E.clipFrom = cur().id; P().toast(`${E.clip.length} objek disalin`); } return; }
    if (mod && k.toLowerCase() === 'x') { if (E.sel.length) { E.clip = selItems().map(M.clone); E.clipFrom = null; del(); } return; }
    if (mod && k.toLowerCase() === 'v') { if (E.clip) { e.preventDefault(); pasteItems(E.clip); } return; }
    if (mod && k.toLowerCase() === 'd') { e.preventDefault(); if (E.sel.length) pasteItems(selItems().map(M.clone)); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); del(); return; }
    if (k === 'Escape') { E.sel = []; drawSel(); renderProps(); return; }
    if (k === 'Enter' && E.sel.length === 1) { const it = selItems()[0]; if (it.kind === 'shape') { e.preventDefault(); startText(it); } return; }
    if (k.startsWith('Arrow') && E.sel.length) {
      e.preventDefault();
      const s = e.shiftKey ? 10 : 1; const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[k];
      selItems().forEach((it) => { it.x = r1(it.x + d[0]); it.y = r1(it.y + d[1]); const el = elOf(it.id); if (el) { el.style.left = it.x + 'px'; el.style.top = it.y + 'px'; } });
      drawSel(); clearTimeout(E.nt); E.nt = setTimeout(() => commit({ render: false }), 300);
      return;
    }
    if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); E.si = Math.max(0, Math.min(E.doc.slides.length - 1, E.si + (k === 'PageDown' ? 1 : -1))); E.sel = []; renderList(); renderCanvas(); renderProps(); }
  }
  function onPaste(e) {
    if (!E.on || E.editing || e.target.matches('input, textarea')) return;
    const f = Array.from(e.clipboardData.files || []).find((x) => /^image\//.test(x.type));
    if (f) { e.preventDefault(); insertImage(f); }
  }
  function pasteItems(list) {
    const off = E.clipFrom === cur().id || !E.clipFrom ? 16 : 0;
    const neu = list.map((it) => { const c = M.cloneItem(it); c.x += off; c.y += off; return c; });
    items().push(...neu); E.sel = neu.map((x) => x.id); E.clip = neu.map(M.clone); E.clipFrom = cur().id;
    commit();
  }
  function del() { if (!E.sel.length) return; cur().items = items().filter((it) => !E.sel.includes(it.id)); E.sel = []; commit(); }

  // ---------------------------------------------------------------- tambah objek
  function center(w, h) { return { x: (E.doc.size.w - w) / 2, y: (E.doc.size.h - h) / 2 }; }
  function add(it) { items().push(it); E.sel = [it.id]; commit(); }
  function insert(k, btn) {
    commitText();
    if (k === 'image') return $('#edImg').click();
    if (k === 'sticker') return stickerPicker(btn);
    const t = M.tpl[k];
    if (!t) return;
    const probe = t(0, 0);
    const c = center(probe.w, probe.h);
    const it = t(c.x, c.y);
    add(it);
    if (k === 'text' || k === 'heading') setTimeout(() => startText(it), 30);
  }
  function stickerPicker(btn) {
    const pop = $('#edStick');
    if (!pop.hidden) { pop.hidden = true; return; }
    pop.innerHTML = `<div class="pop-h">Stiker & avatar</div><div class="stk">${STICKERS.map((s) => `<button data-s="img/stickers/${s}.png" title="${s}"><img src="img/stickers/${s}.png" alt=""></button>`).join('')}</div>
      <div class="pop-h">Ikon <select id="icCol">${Object.entries(ICOL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><div class="stk ic" id="icList"></div>`;
    const fillIc = async () => {
      const c = $('#icCol').value;
      if (!E.icons) E.icons = await (await fetch('img/icons.json')).json();
      const hex = { k: '#1E1F22', g: '#5E9C64', a: '#E2A33B', r: '#C2504A', w: '#FFFFFF' }[c];
      $('#icList').innerHTML = ICONS.filter((n) => E.icons[n]).map((n) => { const ic = E.icons[n]; const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ic.vb}" fill="${hex}">${ic.d}</svg>`); return `<button data-s="${url}" data-ic="1" title="${n}" class="${c === 'w' ? 'dark' : ''}"><img src="${url}" alt=""></button>`; }).join('');
    };
    fillIc(); $('#icCol').onchange = fillIc;
    const r = btn.getBoundingClientRect(); pop.style.left = Math.min(innerWidth - 340, r.left) + 'px'; pop.style.top = r.bottom + 6 + 'px';
    pop.hidden = false;
    pop.onclick = (e) => {
      const b = e.target.closest('button[data-s]'); if (!b) return;
      const im = $('img', b);
      const w = b.dataset.ic ? 48 : 160, h = b.dataset.ic ? 48 : Math.round(160 * (im.naturalHeight / im.naturalWidth || 1));
      const c = center(w, h); pop.hidden = true;
      add(M.tpl.pic(c.x, c.y, b.dataset.s, w, h));
    };
  }
  document.addEventListener('pointerdown', (e) => { const p = $('#edStick'); if (p && !p.hidden && !e.target.closest('#edStick') && !e.target.closest('[data-ins="sticker"]')) p.hidden = true; });
  function readImage(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const mx = 1400, s = Math.min(1, mx / Math.max(img.width, img.height));
          const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          const url = /svg/.test(file.type) ? fr.result : cv.toDataURL('image/webp', 0.86);
          res({ url, w: cv.width, h: cv.height });
        };
        img.onerror = rej; img.src = fr.result;
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  async function insertImage(file) {
    try {
      const im = await readImage(file);
      if (E.replace) { const it = byId(E.replace); E.replace = null; if (it) { it.src = im.url; it.h = r1(it.w * (im.h / im.w)); commit(); } return; }
      const w = Math.min(480, im.w), h = w * (im.h / im.w); const c = center(w, h);
      add(M.tpl.pic(c.x, c.y, im.url, r1(w), r1(h)));
    } catch (e) { P().toast('Gambar tidak terbaca', true); }
  }
  function replaceImage() { E.replace = E.sel[0]; $('#edImg').click(); }

  // ---------------------------------------------------------------- panel properti
  const field = (label, html, cls = '') => `<label class="pf ${cls}"><span>${label}</span>${html}</label>`;
  const num = (k, v, step = 1, extra = '') => `<input type="number" data-k="${k}" value="${v == null ? '' : r1(v)}" step="${step}" ${extra}>`;
  function colorField(label, k, val, allowNone = true) {
    const c = M.splitCol(val) || { hex: 'FFFFFF', alpha: 1 };
    return `<div class="pf col"><span>${label}</span><div class="colrow"><input type="color" data-c="${k}" value="#${c.hex}" ${!val ? 'data-none="1"' : ''}>
      ${allowNone ? `<button class="cnone ${!val ? 'on' : ''}" data-cnone="${k}" title="Tanpa warna">∅</button>` : ''}
      <input type="range" min="0" max="100" data-ca="${k}" value="${Math.round(c.alpha * 100)}" title="Transparansi"></div>
      <div class="sw">${SWATCH.map((s) => `<i style="background:${s}" data-sw="${k}" data-v="${s}"></i>`).join('')}</div></div>`;
  }
  function renderProps() {
    const box = $('#edProps'); if (!box) return;
    const its = selItems();
    if (!its.length) return slideProps(box);
    if (its.length > 1) return multiProps(box, its);
    const it = its[0];
    const kindN = { shape: it.text ? 'Teks / bentuk' : 'Bentuk', pic: 'Gambar', chart: 'Grafik', table: 'Tabel', panda: 'Panda interaktif' }[it.kind];
    let h = `<div class="ph"><b>${kindN}</b><input class="nm" data-k="name" value="${esc(it.name || '')}" placeholder="Nama objek"></div>`;
    h += `<div class="ps"><div class="g4">${field('X', num('x', it.x))}${field('Y', num('y', it.y))}${field('L', num('w', it.w))}${field('T', num('h', it.h))}</div>
      <div class="g4">${field('Putar°', num('rot', it.rot || 0))}<div class="pf"><span>Lapisan</span><div class="btns"><button data-z="top" title="Paling depan">⤒</button><button data-z="up" title="Maju">↑</button><button data-z="down" title="Mundur">↓</button><button data-z="bottom" title="Paling belakang">⤓</button></div></div></div>
      <div class="btns wide"><button data-act="dup">⧉ Duplikat</button><button data-act="copy">Salin</button><button data-act="del" class="danger">Hapus</button></div></div>`;
    if (it.kind === 'shape') {
      h += `<div class="ps"><div class="pt">Bentuk</div><div class="g2">${field('Tipe', `<select data-k="prst">${[['rect', 'Kotak'], ['roundRect', 'Kotak bulat'], ['ellipse', 'Lingkaran/oval']].map(([v, l]) => `<option value="${v}" ${it.prst === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}${it.prst === 'roundRect' ? field('Lengkung', `<input type="range" min="0" max="50" data-k="adj" data-scale="100" value="${Math.round((it.adj == null ? 0.16667 : it.adj) * 100)}">`) : '<span></span>'}</div>
        ${colorField('Isi', 'fill', it.fill)}${colorField('Garis tepi', 'line', it.line && it.line.color)}
        <div class="g2">${field('Tebal garis', num('lineW', it.line ? it.line.w : 0, 0.5, 'min="0"'))}<label class="pf chk"><input type="checkbox" data-k="shadow" ${it.shadow ? 'checked' : ''}> Bayangan</label></div></div>`;
      h += textProps(it);
    }
    if (it.kind === 'pic') h += `<div class="ps"><div class="pt">Gambar</div><div class="btns wide"><button data-act="replace">Ganti gambar</button><button data-act="flip">Balik ↔</button><button data-act="ratio">Rasio asli</button></div>${field('Opasitas', `<input type="range" min="10" max="100" data-k="opacity" data-scale="100" value="${Math.round((it.opacity == null ? 1 : it.opacity) * 100)}">`)}</div>`;
    if (it.kind === 'panda') h += `<div class="ps"><div class="pt">Panda interaktif</div><p class="hint">Saat presentasi: matanya mengikuti kursor, berkedip, telinga goyang saat disorot, dan melambai + lompat kalau diklik.</p></div>`;
    if (it.kind === 'chart') h += chartProps(it);
    if (it.kind === 'table') h += tableProps(it);
    h += interactProps(it);
    box.innerHTML = h;
    bindProps(box, it);
  }
  function textProps(it) {
    const r = it.text ? (it.text.paras.flatMap((p) => p.runs).find((x) => !x.br) || {}) : {};
    const p0 = it.text ? it.text.paras[0] || {} : {};
    return `<div class="ps"><div class="pt">Teks ${E.editing === it.id ? '<em>· pilih kata untuk format sebagian</em>' : '<em>· klik 2x objek untuk mengetik</em>'}</div>
      <div class="g3">${field('Ukuran', num('fsize', r.size || 14, 0.5, 'min="4"'))}${field('Spasi huruf', num('spc', r.spc || 0, 0.5))}${field('Spasi baris', num('lnSpc', p0.lnSpc || 1, 0.1, 'min="0.5"'))}</div>
      <div class="btns fmt"><button data-f="bold" class="${r.bold ? 'on' : ''}"><b>B</b></button><button data-f="italic" class="${r.italic ? 'on' : ''}"><i>I</i></button><button data-f="underline" class="${r.underline ? 'on' : ''}"><u>U</u></button>
        <span class="gap"></span>${[['l', '⯇'], ['ctr', '≡'], ['r', '⯈']].map(([a, i]) => `<button data-al="${a}" class="${p0.align === a ? 'on' : ''}" title="Rata ${a}">${i}</button>`).join('')}
        <span class="gap"></span>${[['t', '⤒'], ['ctr', '⇕'], ['b', '⤓']].map(([a, i]) => `<button data-va="${a}" class="${it.text && it.text.anchor === a ? 'on' : ''}" title="Vertikal ${a}">${i}</button>`).join('')}</div>
      ${colorField('Warna teks', 'tcolor', r.color || '#1E1F22', false)}
      <div class="g4">${['t', 'r', 'b', 'l'].map((s, i) => field('Pad ' + s.toUpperCase(), num('pad' + i, it.text ? it.text.pad[i] : 0, 1, 'min="0"'))).join('')}</div></div>`;
  }
  function interactProps(it) {
    const vis = E.doc.slides;
    const link = it.link || {};
    const lv = link.sid ? 'sid:' + link.sid : link.rel ? 'rel:' + link.rel : link.url ? 'url' : '';
    return `<div class="ps"><div class="pt">Animasi & interaksi</div>
      <div class="g2">${field('Muncul saat klik ke-', num('step', it.step || 0, 1, 'min="0" max="30" title="0 = langsung muncul"'))}${field('Gerak ornamen', `<select data-k="fx">${FXS.map(([v, l]) => `<option value="${v}" ${(it.fx || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
      ${field('Klik membuka breakdown', `<select data-k="dd">${Drill.DD_LIST.map(([v, l]) => `<option value="${v}" ${(it.dd || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${field('Klik pindah ke', `<select data-k="link"><option value="">— tidak ada —</option><option value="rel:1" ${lv === 'rel:1' ? 'selected' : ''}>Slide berikutnya</option><option value="rel:-1" ${lv === 'rel:-1' ? 'selected' : ''}>Slide sebelumnya</option>${vis.map((s, i) => `<option value="sid:${s.id}" ${lv === 'sid:' + s.id ? 'selected' : ''}>${esc(P().slideTitle(s, i).slice(0, 48))}</option>`).join('')}<option value="url" ${lv === 'url' ? 'selected' : ''}>Tautan web…</option></select>`)}
      ${lv === 'url' ? field('URL', `<input data-k="url" value="${esc(link.url || '')}" placeholder="https://">`) : ''}</div>`;
  }
  function flat(ch) { return ch.groups.flatMap((g) => g.series.map((s) => ({ s, line: g.type === 'line' }))); }
  function rebuildChart(ch, fl, o) {
    const bars = fl.filter((x) => !x.line).map((x) => x.s), lines = fl.filter((x) => x.line).map((x) => x.s);
    const g0 = ch.groups.find((g) => g.type === 'bar') || { dir: 'col', grouping: 'clustered', gap: 60 };
    ch.groups = [];
    if (bars.length) ch.groups.push({ type: 'bar', dir: o.dir || g0.dir, grouping: o.grouping || g0.grouping, gap: g0.gap == null ? 60 : g0.gap, series: bars });
    if (lines.length) ch.groups.push({ type: 'line', dir: 'col', grouping: 'standard', gap: 150, series: lines });
  }
  function chartProps(it) {
    const ch = it.chart, fl = flat(ch);
    const cats = (fl[0] && fl[0].s.cats) || [];
    const bar = ch.groups.find((g) => g.type === 'bar');
    const mode = !bar ? 'line' : bar.dir === 'bar' ? 'hbar' : /stacked/.test(bar.grouping) ? 'stack' : 'bar';
    const ax = ch.axes || {};
    return `<div class="ps"><div class="pt">Grafik</div>
      <div class="g2">${field('Jenis', `<select data-ch="mode">${[['bar', 'Batang'], ['stack', 'Batang tumpuk'], ['hbar', 'Batang horizontal'], ['line', 'Garis']].map(([v, l]) => `<option value="${v}" ${mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}${field('Legenda', `<select data-ch="legend"><option value="">Sembunyi</option>${[['b', 'Bawah'], ['t', 'Atas'], ['r', 'Kanan']].map(([v, l]) => `<option value="${v}" ${ch.legend && ch.legendPos === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
      <div class="g3">${field('Sumbu min', `<input type="number" data-ax="valMin" value="${ax.valMin ?? ''}" placeholder="auto">`)}${field('Sumbu max', `<input type="number" data-ax="valMax" value="${ax.valMax ?? ''}" placeholder="auto">`)}<label class="pf chk"><input type="checkbox" data-ax="valHidden" ${ax.valHidden ? 'checked' : ''}> Sembunyikan sumbu</label></div>
      <div class="pt sm">Data <em>· ketik langsung, Tab untuk pindah sel</em></div>
      <div class="chart-grid"><table><thead><tr><th>Kategori</th>${fl.map((x, j) => `<th><input data-sn="${j}" value="${esc(x.s.name)}"><div class="sh"><input type="color" data-scol="${j}" value="${(x.s.color || '#1E1F22').slice(0, 7)}"><select data-stype="${j}"><option value="">▮</option><option value="line" ${x.line ? 'selected' : ''}>╱</option></select><label title="Tampilkan angka"><input type="checkbox" data-sval="${j}" ${x.s.showVal ? 'checked' : ''}>123</label><button data-sdel="${j}" title="Hapus seri">×</button></div></th>`).join('')}</tr></thead>
      <tbody>${cats.map((c, i) => `<tr><td><input data-cat="${i}" value="${esc(c)}"></td>${fl.map((x, j) => `<td><input data-v="${j}:${i}" value="${x.s.vals[i] == null ? '' : x.s.vals[i]}" inputmode="decimal"></td>`).join('')}<td class="rdel"><button data-cdel="${i}" title="Hapus baris">×</button></td></tr>`).join('')}</tbody></table></div>
      <div class="btns wide"><button data-cha="row">+ Baris</button><button data-cha="ser">+ Seri</button><button data-cha="paste">Tempel dari Excel</button></div>
      <div class="pt sm">Isi otomatis dari data Excel</div>
      <div class="g2">${field('Indikator', `<select id="cfK">${[['ca', 'CA'], ['caprod', 'CA Prod'], ['ec', 'EC'], ['camss', 'CA MSS'], ['cont', 'Kontribusi MSS'], ['full', 'Omset (Rp jt)']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`)}${field('Susunan', `<select id="cfL"><option value="route">Per rute: before/after/update</option><option value="month">Per bulan: total tim</option><option value="growth">Per rute: % tumbuh</option></select>`)}</div>
      <div class="btns wide"><button data-cha="fill" class="primary">Isi grafik dari data</button></div></div>`;
  }
  function tableProps(it) {
    return `<div class="ps"><div class="pt">Tabel <em>· klik 2x untuk mengetik di sel</em></div>
      <div class="btns wide"><button data-ta="row">+ Baris</button><button data-ta="col">+ Kolom</button><button data-ta="delrow">− Baris</button><button data-ta="delcol">− Kolom</button></div>
      ${colorField('Warna baris judul', 'thead', (it.table.rows[0].cells[0] || {}).fill, false)}</div>`;
  }
  function slideProps(box) {
    const s = cur();
    box.innerHTML = `<div class="ph"><b>Slide ${E.si + 1}</b><span class="muted">${s.items.length} objek</span></div>
      <div class="ps">${colorField('Latar slide', 'bg', s.bg, false)}<label class="pf chk"><input type="checkbox" data-sk="hidden" ${s.hidden ? 'checked' : ''}> Sembunyikan saat presentasi</label></div>
      <div class="ps"><div class="pt">Catatan pembicara</div><textarea data-sk="notes" rows="4" placeholder="Muncul saat tekan N di presentasi">${esc(s.notes || '')}</textarea></div>
      <div class="ps"><div class="pt">Objek di slide ini <em>· klik untuk memilih</em></div><div class="layers">${s.items.slice().reverse().map((it) => `<button data-pick="${it.id}"><i>${{ shape: it.text ? 'T' : '▢', pic: '🖼', chart: '▮', table: '▦', panda: '🐼' }[it.kind]}</i>${esc(it.name || it.kind)}${it.step ? ` <em>klik ${it.step}</em>` : ''}${it.fx ? ` <em>${it.fx}</em>` : ''}</button>`).join('')}</div></div>
      <div class="ps tips"><div class="pt">Tips</div><ul><li>Klik 2x teks untuk mengetik, Esc untuk selesai.</li><li>Shift+klik atau tarik area untuk pilih banyak. Klik lagi objek terpilih untuk memilih objek di bawahnya.</li><li>Alt saat menggeser = tanpa snapping. Panah = geser 1px, Shift+panah = 10px.</li><li>Ctrl+C / V / D / Z / Y / S.</li><li>Tempel gambar langsung dengan Ctrl+V.</li></ul></div>`;
    bindSlideProps(box);
  }
  function multiProps(box, its) {
    box.innerHTML = `<div class="ph"><b>${its.length} objek dipilih</b></div>
      <div class="ps"><div class="pt">Ratakan</div><div class="btns wide">${[['l', 'Kiri'], ['c', 'Tengah'], ['r', 'Kanan'], ['t', 'Atas'], ['m', 'Tengah ↕'], ['b', 'Bawah']].map(([k, l]) => `<button data-al2="${k}">${l}</button>`).join('')}</div>
      <div class="btns wide"><button data-dist="h">Ratakan jarak ↔</button><button data-dist="v">Ratakan jarak ↕</button></div></div>
      <div class="ps"><div class="pt">Animasi</div>${field('Muncul saat klik ke- (semua)', num('step', its[0].step || 0, 1, 'min="0"'))}</div>
      <div class="btns wide"><button data-act="dup">⧉ Duplikat</button><button data-act="del" class="danger">Hapus</button></div>`;
    box.querySelectorAll('[data-al2]').forEach((b) => (b.onclick = () => {
      const bb = bbox(its), k = b.dataset.al2;
      its.forEach((it) => { if (k === 'l') it.x = bb.x; if (k === 'r') it.x = bb.x + bb.w - it.w; if (k === 'c') it.x = bb.x + bb.w / 2 - it.w / 2; if (k === 't') it.y = bb.y; if (k === 'b') it.y = bb.y + bb.h - it.h; if (k === 'm') it.y = bb.y + bb.h / 2 - it.h / 2; it.x = r1(it.x); it.y = r1(it.y); });
      commit();
    }));
    box.querySelectorAll('[data-dist]').forEach((b) => (b.onclick = () => {
      const v = b.dataset.dist === 'v', A = v ? 'y' : 'x', L = v ? 'h' : 'w';
      const s = its.slice().sort((a, c) => a[A] - c[A]); if (s.length < 3) return;
      const span = s[s.length - 1][A] + s[s.length - 1][L] - s[0][A], tot = s.reduce((t, x) => t + x[L], 0), gap = (span - tot) / (s.length - 1);
      let p = s[0][A]; s.forEach((x) => { x[A] = r1(p); p += x[L] + gap; });
      commit();
    }));
    const st = $('[data-k="step"]', box); st.onchange = () => { its.forEach((it) => { const v = +st.value || 0; if (v) it.step = v; else delete it.step; }); commit(); };
    box.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => (b.dataset.act === 'del' ? del() : pasteItems(its.map(M.clone)))));
  }
  function bindSlideProps(box) {
    const s = cur();
    bindColors(box, (k, v) => { s.bg = v || '#FFFFFF'; });
    $$('[data-sk]', box).forEach((el) => (el.onchange = () => { if (el.dataset.sk === 'hidden') s.hidden = el.checked || undefined; else s.notes = el.value; commit({ props: el.dataset.sk === 'hidden', list: el.dataset.sk === 'hidden' }); }));
    $$('[data-pick]', box).forEach((b) => (b.onclick = () => { E.sel = [b.dataset.pick]; drawSel(); renderProps(); }));
  }
  function bindColors(box, set) {
    $$('[data-c]', box).forEach((inp) => {
      const k = inp.dataset.c;
      const alpha = () => { const a = $(`[data-ca="${k}"]`, box); return a ? a.value / 100 : 1; };
      inp.oninput = () => { set(k, M.joinCol(inp.value, alpha())); quickPaint(); };
      inp.onchange = () => commit();
    });
    $$('[data-ca]', box).forEach((r) => { r.oninput = () => { const inp = $(`[data-c="${r.dataset.ca}"]`, box); set(r.dataset.ca, M.joinCol(inp.value, r.value / 100)); quickPaint(); }; r.onchange = () => commit(); });
    $$('[data-cnone]', box).forEach((b) => (b.onclick = () => { set(b.dataset.cnone, null); commit(); }));
    $$('[data-sw]', box).forEach((i) => (i.onclick = () => { set(i.dataset.sw, i.dataset.v); commit(); }));
  }
  let qp = 0;
  function quickPaint() { if (qp) return; qp = requestAnimationFrame(() => { qp = 0; renderCanvas(); }); }

  function applyRuns(it, fn) {
    if (it.text) it.text.paras.forEach((p) => { p.runs.forEach((r) => { if (!r.br) fn(r); }); if (!p.runs.length) { const r = { size: p.endSize || 12 }; fn(r); p.endSize = r.size; } });
    if (it.kind === 'table') it.table.rows.forEach((row) => row.cells.forEach((c) => c.body && c.body.paras.forEach((p) => p.runs.forEach((r) => { if (!r.br) fn(r); }))));
  }
  function bindProps(box, it) {
    $$('input[data-k], select[data-k]', box).forEach((inp) => {
      const k = inp.dataset.k;
      const ev = inp.type === 'range' || inp.type === 'number' ? 'input' : 'change';
      inp.addEventListener(ev, () => {
        let v = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' || inp.type === 'range' ? parseFloat(inp.value) : inp.value;
        if (inp.dataset.scale) v = v / +inp.dataset.scale;
        if (['x', 'y', 'w', 'h'].includes(k)) { if (!isNaN(v)) it[k] = v; }
        else if (k === 'rot') { if (v) it.rot = v; else delete it.rot; }
        else if (k === 'name') it.name = v;
        else if (k === 'prst') it.prst = v;
        else if (k === 'adj') it.adj = v;
        else if (k === 'shadow') it.shadow = v || undefined;
        else if (k === 'lineW') { if (v > 0) it.line = { color: it.line ? it.line.color : '#E3E1DA', w: v }; else delete it.line; }
        else if (k === 'opacity') it.opacity = v;
        else if (k === 'fsize') { if (v > 0) { if (E.editing) { document.execCommand('fontSize', false, 7); $$('#edStage [style*="xxx-large"], #edStage font[size="7"]').forEach((f) => { f.removeAttribute('size'); f.style.fontSize = (v * 96) / 72 + 'px'; }); return; } applyRuns(it, (r) => (r.size = v)); } }
        else if (k === 'spc') applyRuns(it, (r) => { if (v) r.spc = v; else delete r.spc; });
        else if (k === 'lnSpc') { if (it.text) it.text.paras.forEach((p) => { if (v && v !== 1) p.lnSpc = v; else delete p.lnSpc; }); }
        else if (/^pad\d$/.test(k)) { if (it.text) it.text.pad[+k[3]] = v || 0; }
        else if (k === 'step') { if (v > 0) it.step = Math.round(v); else delete it.step; }
        else if (k === 'fx') { if (v) it.fx = v; else delete it.fx; }
        else if (k === 'dd') { if (v) it.dd = v; else delete it.dd; }
        else if (k === 'link') { if (!v) delete it.link; else if (v === 'url') it.link = { url: (it.link && it.link.url) || 'https://' }; else { const [a, b] = v.split(':'); it.link = a === 'sid' ? { sid: b } : { rel: +b }; } }
        else if (k === 'url') it.link = { url: v };
        if (ev === 'input' && inp.type !== 'checkbox') { clearTimeout(E.pt); E.pt = setTimeout(() => commit({ props: false }), 350); quickPaint(); }
        else commit({ props: ['prst', 'link', 'lineW', 'fx', 'dd', 'step', 'shadow'].includes(k) });
      });
    });
    bindColors(box, (k, v) => {
      if (k === 'fill') it.fill = v;
      else if (k === 'line') { if (v) it.line = { color: v, w: it.line ? it.line.w : 1 }; else delete it.line; }
      else if (k === 'tcolor') { if (E.editing) { document.execCommand('foreColor', false, v ? v.slice(0, 7) : '#1E1F22'); return; } applyRuns(it, (r) => (r.color = v)); }
      else if (k === 'thead') it.table.rows[0].cells.forEach((c) => (c.fill = v));
    });
    $$('[data-f]', box).forEach((b) => (b.onmousedown = (e) => { e.preventDefault(); const f = b.dataset.f; if (E.editing) { document.execCommand(f); return; } const r0 = it.text && it.text.paras.flatMap((p) => p.runs).find((r) => !r.br) || {}; const on = !r0[f]; applyRuns(it, (r) => { if (on) r[f] = true; else delete r[f]; }); commit(); }));
    $$('[data-al]', box).forEach((b) => (b.onmousedown = (e) => { e.preventDefault(); if (E.editing) commitText(); if (it.text) { it.text.paras.forEach((p) => (p.align = b.dataset.al)); commit(); } }));
    $$('[data-va]', box).forEach((b) => (b.onclick = () => { if (it.text) { it.text.anchor = b.dataset.va; commit(); } }));
    $$('[data-z]', box).forEach((b) => (b.onclick = () => {
      const arr = items(), i = arr.indexOf(it); arr.splice(i, 1);
      const z = b.dataset.z; const j = z === 'top' ? arr.length : z === 'bottom' ? 0 : z === 'up' ? Math.min(arr.length, i + 1) : Math.max(0, i - 1);
      arr.splice(j, 0, it); commit();
    }));
    $$('[data-act]', box).forEach((b) => (b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'del') del(); else if (a === 'dup') pasteItems([M.clone(it)]); else if (a === 'copy') { E.clip = [M.clone(it)]; E.clipFrom = cur().id; P().toast('Objek disalin, tempel di slide mana pun dengan Ctrl+V'); }
      else if (a === 'replace') replaceImage(); else if (a === 'flip') { it.flipH = !it.flipH || undefined; commit(); }
      else if (a === 'ratio') { const im = new Image(); im.onload = () => { it.h = r1(it.w * (im.naturalHeight / im.naturalWidth)); commit(); }; im.src = it.src; }
    }));
    if (it.kind === 'chart') bindChart(box, it);
    if (it.kind === 'table') bindTable(box, it);
  }
  function bindChart(box, it) {
    const ch = it.chart;
    const fl = () => flat(ch);
    const recommit = (props) => { clearTimeout(E.ct); E.ct = setTimeout(() => commit({ props }), 300); };
    $$('[data-ch]', box).forEach((s) => (s.onchange = () => {
      if (s.dataset.ch === 'legend') { ch.legend = !!s.value; if (s.value) ch.legendPos = s.value; }
      else { const v = s.value; const f = fl(); if (v === 'line') f.forEach((x) => (x.line = true)); else { f.forEach((x) => { if (x.line && f.some((y) => !y.line)) return; x.line = false; }); if (f.every((x) => x.line)) f.forEach((x) => (x.line = false)); } rebuildChart(ch, f, { dir: v === 'hbar' ? 'bar' : 'col', grouping: v === 'stack' ? 'stacked' : 'clustered' }); if (v === 'stack') ch.groups.forEach((g) => { if (g.type === 'bar') g.gap = 40; }); }
      commit();
    }));
    $$('[data-ax]', box).forEach((inp) => (inp.onchange = () => { ch.axes = ch.axes || {}; const k = inp.dataset.ax; ch.axes[k] = inp.type === 'checkbox' ? inp.checked : inp.value === '' ? null : +inp.value; commit({ props: false }); }));
    $$('[data-sn]', box).forEach((inp) => (inp.oninput = () => { fl()[+inp.dataset.sn].s.name = inp.value; recommit(false); }));
    $$('[data-scol]', box).forEach((inp) => (inp.oninput = () => { fl()[+inp.dataset.scol].s.color = inp.value.toUpperCase(); recommit(false); }));
    $$('[data-sval]', box).forEach((inp) => (inp.onchange = () => { const s = fl()[+inp.dataset.sval].s; s.showVal = inp.checked; if (inp.checked && !s.fmt) s.fmt = '#,##0'; commit({ props: false }); }));
    $$('[data-stype]', box).forEach((sel) => (sel.onchange = () => { const f = fl(); f[+sel.dataset.stype].line = sel.value === 'line'; rebuildChart(ch, f, {}); commit(); }));
    $$('[data-sdel]', box).forEach((b) => (b.onclick = () => { const f = fl(); if (f.length <= 1) return; f.splice(+b.dataset.sdel, 1); rebuildChart(ch, f, {}); commit(); }));
    $$('[data-cat]', box).forEach((inp) => (inp.oninput = () => { fl().forEach((x) => (x.s.cats[+inp.dataset.cat] = inp.value)); recommit(false); }));
    $$('[data-v]', box).forEach((inp) => (inp.oninput = () => { const [j, i] = inp.dataset.v.split(':').map(Number); const v = inp.value.replace(/\./g, '').replace(',', '.'); fl()[j].s.vals[i] = inp.value === '' ? null : +v; recommit(false); }));
    $$('[data-cdel]', box).forEach((b) => (b.onclick = () => { const i = +b.dataset.cdel; fl().forEach((x) => { x.s.cats.splice(i, 1); x.s.vals.splice(i, 1); }); commit(); }));
    $$('[data-cha]', box).forEach((b) => (b.onclick = async () => {
      const a = b.dataset.cha, f = fl();
      if (a === 'row') { f.forEach((x) => { x.s.cats.push('Baru'); x.s.vals.push(0); }); commit(); }
      if (a === 'ser') { const base = f[0].s; const pal = ['#5E9C64', '#E2A33B', '#C2504A', '#B5B8BD', '#1E1F22']; f.push({ s: { name: 'Seri ' + (f.length + 1), cats: base.cats.slice(), vals: base.cats.map(() => 0), color: pal[f.length % pal.length], showVal: true, fmt: '#,##0', lblPos: 'outEnd', lblSize: 9 }, line: false }); rebuildChart(ch, f, {}); commit(); }
      if (a === 'paste') {
        let t = ''; try { t = await navigator.clipboard.readText(); } catch (e) { t = prompt('Tempel data dari Excel (baris pertama = nama seri):') || ''; }
        const rows = t.trim().split(/\r?\n/).map((r) => r.split('\t')); if (rows.length < 2 || rows[0].length < 2) return P().toast('Salin tabel dari Excel dulu (kolom 1 = kategori, baris 1 = nama seri)', true);
        const names = rows[0].slice(1), cats = rows.slice(1).map((r) => r[0]);
        const old = f;
        const nf2 = names.map((n, j) => ({ s: Object.assign({ name: n, color: (old[j] && old[j].s.color) || ['#B5B8BD', '#1E1F22', '#E2A33B', '#5E9C64'][j % 4], showVal: old[j] ? old[j].s.showVal : true, fmt: (old[j] && old[j].s.fmt) || '#,##0', lblPos: 'outEnd', lblSize: 9 }, { cats: cats.slice(), vals: rows.slice(1).map((r) => { const v = String(r[j + 1] || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'); return v === '' ? null : +v; }) }), line: old[j] ? old[j].line : false }));
        rebuildChart(ch, nf2, {}); commit();
      }
      if (a === 'fill') fillFromData(it, $('#cfK').value, $('#cfL').value);
    }));
  }
  function fillFromData(it, k, lay) {
    const D = P().S.data; if (!D) return P().toast('Data Excel belum termuat', true);
    if (k === 'ec' && !D.ec) return P().toast('Sheet DATA_EC tidak ada', true);
    const sc = k === 'full' ? 1e6 : 1, dec = k === 'cont' || k === 'ec' ? 1 : 0;
    const rd = (v) => Math.round((v / sc) * Math.pow(10, dec)) / Math.pow(10, dec);
    const routes = k === 'ec' ? PandaData.ecRoutes(D) : PandaData.byRoute(D, k);
    const short = routes.map((r) => String(r.name).split(' ')[0]);
    const lbl = { b: 'Before', a: 'After', u: D.label[D.U] };
    const ser = (name, cats, vals, color, fmt) => ({ name, cats, vals, color, showVal: true, fmt: fmt || (dec ? '0.0' : '#,##0'), lblPos: 'outEnd', lblSize: 8 });
    let groups;
    if (lay === 'route') groups = [{ type: 'bar', dir: 'col', grouping: 'clustered', gap: 55, series: [ser(lbl.b, short, routes.map((r) => rd(r.before)), '#B5B8BD'), ser(lbl.a, short, routes.map((r) => rd(r.after)), '#1E1F22'), ser(lbl.u, short, routes.map((r) => rd(r.upd)), '#E2A33B')] }];
    else if (lay === 'growth') groups = [{ type: 'bar', dir: 'bar', grouping: 'clustered', gap: 40, series: [ser(k === 'cont' ? 'Δ poin' : '% tumbuh', short, routes.map((r) => Math.round((r.growth || 0) * 10) / 10), '#5E9C64', '+0.0')] }];
    else {
      const t = k === 'ec' ? PandaData.ecTotal(D) : PandaData.total(D, k);
      const cats = D.months.map((m) => m.label);
      const pick = (f) => t.series.map((v, i) => (f(D.months[i]) ? rd(v) : 0));
      groups = [{ type: 'bar', dir: 'col', grouping: 'stacked', gap: 40, series: [ser('Before', cats, pick((m) => m.period === 'BEFORE'), '#B5B8BD', '[>0]' + (dec ? '0.0' : '#,##0') + ';""'), ser('Lainnya', cats, pick((m) => m.period === 'SKIP'), '#DEDCD5', '[>0]' + (dec ? '0.0' : '#,##0') + ';""'), ser('After', cats, pick((m) => m.period === 'AFTER' && !m.update), '#1E1F22', '[>0]' + (dec ? '0.0' : '#,##0') + ';""'), ser(lbl.u, cats, pick((m) => m.update), '#E2A33B', '[>0]' + (dec ? '0.0' : '#,##0') + ';""')] }];
    }
    it.chart.groups = groups;
    it.chart.legend = true; it.chart.legendPos = 'b';
    it.chart.axes = Object.assign(it.chart.axes || {}, { valMin: lay === 'growth' ? null : 0, valMax: null, valMajor: null, catReverse: lay === 'growth' });
    commit();
    P().toast('Grafik diisi dari Excel');
  }
  function bindTable(box, it) {
    const T = it.table;
    $$('[data-ta]', box).forEach((b) => (b.onclick = () => {
      const a = b.dataset.ta;
      if (a === 'row') { const last = T.rows[T.rows.length - 1]; const nr = M.clone(last); nr.cells.forEach((c) => c.body && c.body.paras.forEach((p) => p.runs.forEach((r) => { if (!r.br) r.text = ''; }))); T.rows.push(nr); it.h = r1(it.h + nr.h); }
      if (a === 'delrow' && T.rows.length > 1) { const r = T.rows.pop(); it.h = r1(it.h - r.h); }
      if (a === 'col') { const w = T.cols[T.cols.length - 1]; T.cols.push(w); T.rows.forEach((r) => { const c = M.clone(r.cells[r.cells.length - 1]); c.body && c.body.paras.forEach((p) => p.runs.forEach((x) => { if (!x.br) x.text = ''; })); r.cells.push(c); }); it.w = r1(it.w + w); }
      if (a === 'delcol' && T.cols.length > 1) { const w = T.cols.pop(); T.rows.forEach((r) => r.cells.pop()); it.w = r1(it.w - w); }
      const sum = T.cols.reduce((x, y) => x + y, 0); T.cols = T.cols.map((c) => r1((c / sum) * it.w));
      commit();
    }));
  }

  // ---------------------------------------------------------------- simpan, import, export
  async function save() {
    commitText();
    status('Menyimpan…');
    try {
      const S = P().S;
      const by = localStorage.getItem('panda-editor') || '';
      const res = await Store.save(E.doc, { pin: E.pin, excel: E.excelChanged ? S.excelB64 : null, by, base: E.base });
      E.base = res.updatedAt; E.dirty = false; E.excelChanged = false; E.savedOnce = true;
      S.doc = M.clone(E.doc); S.meta = { updatedAt: res.updatedAt, by, source: Store.mode === 'local' ? 'local' : 'supabase' };
      Store.draft.clear();
      P().updateSaveInfo();
      status(); P().toast(Store.mode === 'local' ? 'Tersimpan di browser ini 🐼' : 'Tersimpan untuk semua orang 🐼');
      return true;
    } catch (e) {
      console.error(e);
      if (e.conflict) {
        const v = await ask('Ada versi lebih baru', 'Orang lain sudah menyimpan setelah kamu mulai edit. Timpa dengan versi kamu?', [{ label: 'Timpa', value: 1, danger: true }, { label: 'Batal', value: 0 }]);
        if (v) { E.base = null; return save(); }
      } else if (e.pin) { E.pin = null; P().toast('PIN tidak valid lagi, masuk edit ulang', true); }
      else P().toast('Gagal menyimpan: ' + e.message, true);
      status('Gagal menyimpan');
      return false;
    }
  }
  function downloadJson() {
    const blob = new Blob([JSON.stringify(E.doc)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'deck.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    P().toast('Ganti content/deck.json di GitHub dengan file ini');
  }
  async function importPptx(file) {
    try {
      P().toast('Membaca PPT…');
      const parsed = await PPTX.parsePptx(await file.arrayBuffer());
      const deck = M.fromParsed(parsed);
      const cache = {};
      for (const s of deck.slides) for (const it of s.items) if (it.src && it.src.startsWith('blob:')) {
        if (!cache[it.src]) { const b = await (await fetch(it.src)).blob(); cache[it.src] = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
        it.src = cache[it.src];
      }
      const v = await ask('Import PPT', `${deck.slides.length} slide terbaca dari <b>${esc(file.name)}</b>.`, [{ label: 'Ganti semua slide', value: 'all', danger: true }, { label: 'Tambahkan di akhir', value: 'add', primary: true }, { label: 'Batal', value: 0 }]);
      if (!v) return;
      push();
      if (v === 'all') { E.doc.slides = deck.slides; E.doc.size = deck.size; E.si = 0; }
      else { E.doc.slides.push(...deck.slides); E.si = E.doc.slides.length - deck.slides.length; }
      E.sel = []; E.last = snapshot(); markDirty(); renderAll();
      P().toast('PPT diimport. Jangan lupa Simpan');
    } catch (e) { console.error(e); P().toast('PPT tidak terbaca: ' + e.message, true); }
  }
  async function showHistory() {
    const list = await Store.versions();
    const d = document.createElement('div'); d.className = 'modal on ed-dialog';
    d.innerHTML = `<div class="modal-card"><div class="modal-head"><h2>Riwayat versi</h2><button class="x">×</button></div>
      ${list.length ? `<div class="hist">${list.map((v) => `<button data-id="${v.id}"><b>${new Date(v.saved_at).toLocaleString('id-ID')}</b><span>${esc(v.saved_by || '—')}</span></button>`).join('')}</div><p class="muted">Klik versi untuk membukanya di editor. Belum tersimpan sampai kamu klik Simpan.</p>` : '<p class="muted">Belum ada versi tersimpan.</p>'}</div>`;
    document.body.appendChild(d);
    $('.x', d).onclick = () => d.remove();
    $$('[data-id]', d).forEach((b) => (b.onclick = async () => { const doc = await Store.loadVersion(isNaN(b.dataset.id) ? b.dataset.id : +b.dataset.id); d.remove(); if (!doc) return; push(); E.doc = doc; E.si = 0; E.sel = []; E.last = snapshot(); markDirty(); renderAll(); P().toast('Versi dibuka. Klik Simpan untuk memakainya'); }));
  }
  async function resetToDefault() {
    const v = await ask('Kembali ke isi bawaan?', 'Isi editor diganti dengan content/deck.json dari repo. Bisa di-Undo, dan belum tersimpan sampai klik Simpan.', [{ label: 'Ganti', value: 1, danger: true }, { label: 'Batal', value: 0 }]);
    if (!v) return;
    const doc = await (await fetch('content/deck.json', { cache: 'no-cache' })).json();
    push(); E.doc = doc; E.si = 0; E.sel = []; E.last = snapshot(); markDirty(); renderAll();
  }

  global.Editor = { enter, exit, markDirty, state: E, domToParas };
})(window);
