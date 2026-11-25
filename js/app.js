/* PANDA SUKSESS — mode presentasi (membaca model deck JSON). */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage');
  Chart.register(ChartDataLabels);
  Chart.defaults.font.family = 'Quicksand, system-ui, sans-serif';
  Chart.defaults.color = '#6B6F76';

  const S = { doc: null, meta: null, data: null, dataName: '', rendered: [], vis: [], idx: -1, step: 0, thumbsBuilt: false, excelB64: null };
  const nf = (n, d = 0) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }));

  function toast(msg, err) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : '');
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = 'toast'), 3400);
  }

  async function fetchBuf(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error('Gagal memuat ' + url); return r.arrayBuffer(); }
  async function fetchJson(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error('Gagal memuat ' + url); return r.json(); }
  function loadData(buf, name) { S.data = PandaData.parseExcel(buf); S.dataName = name || 'data.xlsx'; }

  async function init() {
    Panda.load();
    Drill.init({ getData: () => S.data, toast });
    Fx.bindParallax(stage);
    Panda.corner.init(document.body);
    $('#btnPanda').classList.toggle('on', !Panda.corner.hidden);
    try {
      const saved = await Store.loadDoc();
      S.doc = saved ? saved.doc : await fetchJson('content/deck.json');
      S.meta = saved ? { updatedAt: saved.updatedAt, by: saved.by, source: saved.source } : { source: 'bawaan' };
      try {
        const lx = await Store.IDB.get('xlsx');
        if (lx) loadData(lx.buf, lx.name);
        else if (saved && saved.excel) { S.excelB64 = saved.excel; loadData(Store.b64ToBuf(saved.excel), 'Excel tersimpan'); }
        else loadData(await fetchBuf('content/data.xlsx'), 'data.xlsx');
        $('#nXlsx').textContent = 'Aktif: ' + S.dataName;
      } catch (e) { console.warn(e); toast('Excel tidak terbaca: ' + e.message, true); }
      document.title = 'PANDA SUKSESS · ' + (S.doc.title || 'Presentasi');
      buildSlides();
      const h = parseInt((location.hash.match(/\d+/) || [1])[0], 10) - 1;
      go(Math.max(0, Math.min(S.rendered.length - 1, h)), 1, true);
      updateSaveInfo();
    } catch (e) {
      console.error(e);
      $('.loader-text').textContent = 'Gagal memuat presentasi: ' + e.message;
      return;
    }
    setTimeout(() => $('#loader').classList.add('done'), 300);
    if (/[?&]edit/.test(location.search)) setTimeout(() => Editor.enter(), 500);
  }
  function updateSaveInfo() {
    const m = S.meta || {};
    $('#saveInfo').textContent = m.source === 'supabase' ? `Versi bersama · disimpan ${new Date(m.updatedAt).toLocaleString('id-ID')}${m.by ? ' oleh ' + m.by : ''}` : m.source === 'local' ? `Versi lokal browser ini · ${new Date(m.updatedAt).toLocaleString('id-ID')}` : 'Isi bawaan (content/deck.json)';
  }

  // ---------------------------------------------------------------- render
  function destroyCharts() { S.rendered.forEach((r) => r.charts.forEach((c) => { if (c.inst) { c.inst.destroy(); c.inst = null; } })); }
  function buildSlides(keepIdx) {
    destroyCharts();
    stage.innerHTML = '';
    S.vis = S.doc.slides.filter((s) => !s.hidden);
    const total = S.vis.length;
    S.rendered = S.vis.map((sl, i) => {
      const r = Render.renderSlide(sl, S.doc, { interactive: true, n: i + 1, total });
      r.root.dataset.index = i;
      r.slide = sl;
      stage.appendChild(r.root);
      return r;
    });
    S.idx = -1; S.thumbsBuilt = false;
    $('#tot').textContent = total;
    fit();
    if (keepIdx != null) go(Math.min(keepIdx, total - 1), 1, true);
  }
  function fit() {
    if (!S.doc) return;
    const { w, h } = S.doc.size;
    const sc = Math.min(window.innerWidth / w, (window.innerHeight - 8) / h) * 0.965;
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    stage.style.transform = `translate(-50%, -50%) scale(${sc})`;
    S.scale = sc;
  }
  window.addEventListener('resize', fit);

  const COUNT_RE = /^[+−-]?(Rp)?\s?[\d.,]+\s?(%|jt|M|pt| poin| outlet)?$/;
  function countUp(span, delay) {
    const txt = span.textContent.trim();
    if (!COUNT_RE.test(txt) || txt.length > 16) return;
    const m = txt.match(/[\d.,]+/); if (!m) return;
    const raw = m[0];
    const dec = raw.includes(',') ? raw.split(',')[1].length : 0;
    const target = Number(raw.replace(/\./g, '').replace(',', '.'));
    if (!isFinite(target) || target === 0) return;
    const pre = txt.slice(0, m.index), post = txt.slice(m.index + raw.length);
    const t0 = performance.now() + delay, dur = 1100;
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = 1 - Math.pow(1 - p, 3);
      span.textContent = pre + nf(target * e, dec) + post;
      if (p < 1) requestAnimationFrame(tick); else span.textContent = txt;
    };
    span.textContent = pre + nf(0, dec) + post;
    requestAnimationFrame(tick);
  }

  function revealObj(el, delay, mode) {
    el.classList.remove('pre', 'pop', 'pop-pic', 'step-hidden', 'step-show', 'fx-on');
    void el.offsetWidth;
    el.style.animationDelay = delay + 'ms';
    el.classList.add(mode === 'step' ? 'step-show' : el.classList.contains('obj-pic') || el.classList.contains('obj-panda') ? 'pop-pic' : 'pop');
    if (el._counters) el._counters.forEach((s) => countUp(s, delay + 120));
    const r = S.rendered[S.idx];
    if (r) r.charts.filter((c) => c.el === el).forEach((c) => setTimeout(() => makeChart(c), delay + 80));
    if (el.dataset.fx && el.dataset.fx !== 'leaves') setTimeout(() => { if (!el.isConnected) return; el.classList.remove('pop', 'pop-pic', 'step-show'); el.style.animationDelay = ''; Fx.activate(el.parentNode); }, delay + 950);
  }
  function makeChart(c) { if (!c.inst && c.el.isConnected) c.inst = new Chart(c.canvas.getContext('2d'), c.cfg()); }

  // ---------------------------------------------------------------- navigasi
  function go(i, dir, instant) {
    if (i < 0 || i >= S.rendered.length || i === S.idx) return;
    const prev = S.rendered[S.idx];
    const next = S.rendered[i];
    if (prev) {
      prev.root.classList.remove('active', 'enter-next', 'enter-prev');
      prev.root.classList.add('leaving', dir > 0 ? 'leave-next' : 'leave-prev');
      const pr = prev;
      setTimeout(() => { pr.root.classList.remove('leaving', 'leave-next', 'leave-prev'); pr.charts.forEach((c) => { if (c.inst) { c.inst.destroy(); c.inst = null; } }); Fx.deactivate(pr.root); }, 620);
    }
    S.idx = i;
    next.root.classList.remove('leaving', 'leave-next', 'leave-prev');
    next.root.classList.add('active');
    if (!instant) next.root.classList.add(dir > 0 ? 'enter-next' : 'enter-prev');
    const objs = Array.from(next.root.querySelectorAll(':scope > .obj'));
    const showAll = dir < 0;
    S.step = showAll ? next.steps.length : 0;
    let k = 0;
    objs.forEach((el) => {
      const st = Number(el.dataset.step || 0);
      if (st && !showAll) { el.classList.remove('pop', 'pop-pic', 'step-show', 'fx-on'); el.classList.add('step-hidden'); return; }
      const big = el.offsetWidth * el.offsetHeight > 0.6 * S.doc.size.w * S.doc.size.h;
      revealObj(el, big ? 0 : Math.min(900, 120 + k++ * 22));
    });
    Panda.hopAll();
    mascotFor(next, showAll);
    updateUI();
  }
  function revealStep(n) {
    const r = S.rendered[S.idx];
    const st = r.steps[n - 1];
    const els = Array.from(r.root.querySelectorAll(`:scope > .obj[data-step="${st}"]`));
    els.forEach((el, j) => revealObj(el, j * 40, 'step'));
  }
  function hideStep(n) {
    const r = S.rendered[S.idx];
    const st = r.steps[n - 1];
    r.root.querySelectorAll(`:scope > .obj[data-step="${st}"]`).forEach((el) => {
      el.classList.remove('step-show', 'pop', 'pop-pic', 'fx-on'); el.classList.add('step-hidden');
      r.charts.filter((c) => c.el === el).forEach((c) => { if (c.inst) { c.inst.destroy(); c.inst = null; } });
    });
  }
  function next() {
    if (anyOverlay()) return;
    const r = S.rendered[S.idx];
    if (r && S.step < r.steps.length) { S.step++; revealStep(S.step); updateUI(); return; }
    go(S.idx + 1, 1);
  }
  function prev() {
    if (anyOverlay()) return;
    if (S.step > 0) { hideStep(S.step); S.step--; updateUI(); return; }
    go(S.idx - 1, -1);
  }
  function updateUI() {
    $('#cur').textContent = S.idx + 1;
    $('#progress span').style.width = ((S.idx + 1) / S.rendered.length) * 100 + '%';
    const r = S.rendered[S.idx];
    $('#stepHint').hidden = !(r && S.step < r.steps.length);
    history.replaceState(null, '', location.search + '#' + (S.idx + 1));
    $('#notesText').textContent = (r.slide.notes || 'Tidak ada catatan untuk slide ini.');
  }
  const anyOverlay = () => ['#drawer', '#grid', '#files'].some((s) => $(s).classList.contains('on')) || document.body.classList.contains('editing');

  // panda pojok: bacakan overview + urutan penjelasan
  function tipsOf(slide) {
    const txt = (it) => Model.plainText(it).replace(/\s+/g, ' ').trim();
    const tips = [];
    const ov = slide.items.find((it) => it.name === 'Overview');
    if (ov) tips.push({ tag: 'OVERVIEW', text: txt(ov), step: 0 });
    slide.items.filter((it) => /^Poin \d+$/.test(it.name || '')).sort((a, b) => parseInt(a.name.slice(5)) - parseInt(b.name.slice(5)))
      .forEach((it) => tips.push({ tag: 'POIN ' + it.name.slice(5), text: txt(it), step: it.step || 0 }));
    const strip = slide.items.find((it) => it.name === 'Overview strip');
    if (strip) tips.push({ tag: 'INTINYA', text: txt(strip), step: strip.step || 0 });
    if (!tips.length && slide.notes) tips.push({ tag: 'CATATAN', text: slide.notes.slice(0, 220), step: 0 });
    return tips;
  }
  function mascotFor(r, showAll) {
    r.tips = tipsOf(r.slide);
    const hasPanda = r.slide.items.some((it) => it.kind === 'panda');
    Panda.corner.present(!hasPanda);
    if (hasPanda) return;
    Panda.corner.setTips(r.tips, -1, false);
    if (!S.greeted && r.tips.length) { S.greeted = true; setTimeout(() => Panda.corner.say('HALO 🐼', 'Klik aku kapan saja untuk dengar poin penjelasan slide ini. Aku bisa digeser.', 4200), 900); }
  }

  // ---------------------------------------------------------------- input
  function followLink(l) {
    if (l.sid) { const i = S.vis.findIndex((s) => s.id === l.sid); if (i >= 0) go(i, i > S.idx ? 1 : -1); return true; }
    if (l.slide != null) { go(l.slide, l.slide > S.idx ? 1 : -1); return true; }
    if (l.rel) { l.rel > 0 ? next() : prev(); return true; }
    if (l.url) { window.open(l.url, '_blank', 'noopener'); return true; }
    return false;
  }
  stage.addEventListener('click', (e) => {
    if (document.body.classList.contains('editing')) return;
    const obj = e.target.closest('.obj');
    if (obj && obj.dataset.dd && !obj.classList.contains('step-hidden')) { badge.classList.remove('on'); Drill.open(obj.dataset.dd); return; }
    const link = e.target.closest('.obj.link');
    if (link && followLink(JSON.parse(link.dataset.link))) return;
    next();
  });
  const badge = document.createElement('div'); badge.className = 'dd-badge'; badge.textContent = 'Klik untuk breakdown'; document.body.appendChild(badge);
  stage.addEventListener('mousemove', (e) => {
    const obj = e.target.closest('.obj.dd');
    if (obj && !obj.classList.contains('step-hidden') && !document.body.classList.contains('editing')) { badge.classList.add('on'); badge.style.left = e.clientX + 14 + 'px'; badge.style.top = e.clientY + 14 + 'px'; }
    else badge.classList.remove('on');
  });
  stage.addEventListener('mouseleave', () => badge.classList.remove('on'));

  document.addEventListener('keydown', (e) => {
    if (document.body.classList.contains('editing')) return;
    if (e.target.matches('input, select, textarea, [contenteditable="true"]')) return;
    const k = e.key;
    if (k === 'Escape') { closeAll(); return; }
    if (anyOverlay()) return;
    if (['ArrowRight', 'PageDown', ' ', 'Enter', 'ArrowDown'].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp', 'Backspace', 'ArrowUp'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0, -1);
    else if (k === 'End') go(S.rendered.length - 1, 1);
    else if (k === 'f' || k === 'F') toggleFull();
    else if (k === 'o' || k === 'O') openGrid();
    else if (k === 'n' || k === 'N') toggleNotes();
    else if (k === 'p' || k === 'P') togglePanda();
    else if (k === 'e' || k === 'E') Editor.enter();
  });
  let sx = null;
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  stage.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 60 && e.pointerType !== 'mouse' && !document.body.classList.contains('editing')) { e.stopPropagation(); dx < 0 ? next() : prev(); } });

  $('#btnNext').onclick = next; $('#btnPrev').onclick = prev;
  $('#btnFull').onclick = toggleFull; $('#btnGrid').onclick = openGrid; $('#btnNotes').onclick = toggleNotes;
  $('#btnPanda').onclick = togglePanda;
  $('#btnEdit').onclick = () => Editor.enter();
  $('#btnFiles').onclick = () => $('#files').classList.add('on');
  $('#fClose').onclick = () => $('#files').classList.remove('on');
  $('#gClose').onclick = () => $('#grid').classList.remove('on');
  $('#dClose').onclick = Drill.close; $('#scrim').onclick = Drill.close;
  function togglePanda() { const on = Panda.corner.toggle(); $('#btnPanda').classList.toggle('on', on); toast(on ? 'Panda pemandu muncul 🐼' : 'Panda pemandu disembunyikan'); }
  function toggleFull() { if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); else document.exitFullscreen(); }
  function toggleNotes() { $('#notes').classList.toggle('on'); $('#btnNotes').classList.toggle('on'); }
  function closeAll() { Drill.close(); $('#grid').classList.remove('on'); $('#files').classList.remove('on'); }
  let idleT;
  const wake = () => { $('#toolbar').classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!anyOverlay()) $('#toolbar').classList.add('idle'); }, 2800); };
  document.addEventListener('mousemove', wake); document.addEventListener('keydown', wake); wake();

  // ---------------------------------------------------------------- overview
  function slideTitle(sl, i) {
    const t = sl.items.find((x) => x.name === 'Judul' || x.name === 'Judul cover');
    return `${i + 1}. ${t ? Model.plainText(t).replace(/\s+/g, ' ') : 'Slide ' + (i + 1)}`;
  }
  function thumb(sl, host, n, total) {
    const r = Render.renderSlide(sl, S.doc, { interactive: false, n, total });
    host.appendChild(r.root);
    requestAnimationFrame(() => {
      const sc = host.clientWidth / S.doc.size.w; r.root.style.transform = `scale(${sc})`;
      r.charts.forEach((c) => { const cfg = c.cfg(); cfg.options.animation = false; cfg.options.plugins.tooltip = { enabled: false }; c.inst = new Chart(c.canvas.getContext('2d'), cfg); });
    });
    return r;
  }
  function openGrid() {
    const list = $('#gList');
    if (!S.thumbsBuilt) {
      list.innerHTML = '';
      S.vis.forEach((sl, i) => {
        const b = document.createElement('button'); b.className = 'thumb'; b.style.transitionDelay = i * 30 + 'ms';
        const fr = document.createElement('div'); fr.className = 'frame';
        b.appendChild(fr);
        const sp = document.createElement('span'); sp.className = 'cap'; sp.textContent = slideTitle(sl, i);
        b.appendChild(sp);
        b.onclick = () => { $('#grid').classList.remove('on'); go(i, i > S.idx ? 1 : -1); };
        list.appendChild(b);
        thumb(sl, fr, i + 1, S.vis.length);
      });
      S.thumbsBuilt = true;
    }
    Array.from(list.children).forEach((b, i) => b.classList.toggle('cur', i === S.idx));
    $('#grid').classList.add('on');
  }

  // ---------------------------------------------------------------- Excel
  async function handleXlsx(file) {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      loadData(buf, file.name);
      if (document.body.classList.contains('editing')) { S.excelB64 = Store.bufToB64(buf); Editor.markDirty('Excel baru ikut tersimpan saat Simpan'); }
      else await Store.IDB.put('xlsx', { name: file.name, buf });
      $('#nXlsx').textContent = 'Aktif: ' + file.name;
      toast('Excel berhasil dimuat: ' + file.name);
      setTimeout(() => $('#files').classList.remove('on'), 700);
    } catch (e) { console.error(e); toast('Excel tidak terbaca: ' + e.message, true); }
  }
  $('#inXlsx').onchange = (e) => handleXlsx(e.target.files[0]);
  document.querySelectorAll('.drop').forEach((d) => {
    d.addEventListener('dragover', (e) => { e.preventDefault(); d.classList.add('over'); });
    d.addEventListener('dragleave', () => d.classList.remove('over'));
    d.addEventListener('drop', (e) => { e.preventDefault(); d.classList.remove('over'); if (d.dataset.kind === 'xlsx') handleXlsx(e.dataTransfer.files[0]); });
  });
  $('#btnResetX').onclick = async () => {
    await Store.IDB.del('xlsx');
    loadData(S.excelB64 ? Store.b64ToBuf(S.excelB64) : await fetchBuf('content/data.xlsx'), S.excelB64 ? 'Excel tersimpan' : 'data.xlsx');
    $('#nXlsx').textContent = 'Aktif: ' + S.dataName; toast('Excel kembali ke versi bersama');
  };

  window.PANDA = {
    S, go, next, prev, toast, fit, buildSlides, thumb, slideTitle, updateSaveInfo, followLink,
    openDrawer: (dd) => Drill.open(dd),
    setDoc(doc, meta) { S.doc = doc; if (meta) S.meta = meta; buildSlides(Math.max(0, S.idx)); updateSaveInfo(); },
  };
  init();
})();
