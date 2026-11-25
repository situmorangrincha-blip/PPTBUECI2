/* PANDA SUKSESS — panel breakdown (klik objek ber-dd). Data dari Excel. */
(function (global) {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const nf = (n, d = 0) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const sg = (n, d = 1, unit = '%') => (n == null || isNaN(n) || !isFinite(n) ? '–' : (n > 0 ? '+' : n < 0 ? '−' : '') + nf(Math.abs(n), d) + unit);
  const jt = (v, d = 1) => 'Rp' + nf(v / 1e6, d) + ' jt';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let getData = () => null, toast = () => {};

  const MET = {
    ca: { name: 'CA', desc: 'Outlet yang belanja minimal 1x per bulan', tabs: ['rute', 'outlet'] },
    caprod: { name: 'CA Prod', desc: 'Outlet belanja min. Rp200 rb (retail) atau Rp1 jt (grosir)', tabs: ['rute', 'outlet'] },
    camss: { name: 'CA MSS', desc: 'Outlet yang membeli minimal 1 SKU MSS', tabs: ['rute', 'sku', 'outlet'] },
    cont: { name: 'Kontribusi MSS', desc: 'Omset MSS dibagi omset total', tabs: ['rute', 'sku', 'outlet'] },
    ec: { name: 'EC', desc: 'Effective call rata² per hari (STD retail 27, grosir 18)', tabs: ['rute', 'bulan'] },
    full: { name: 'Omset', desc: 'Omset semua principle per bulan', tabs: ['rute', 'outlet', 'target'] },
    onc: { name: 'ONC', desc: 'Outlet hasil ONC dan omsetnya', tabs: ['outlet', 'salesman'] },
    pareto: { name: '30 Toko Pareto', desc: 'Aktual vs target per toko pareto', tabs: ['toko'] },
    itg: { name: 'ITG', desc: 'Achievement program toko Supercup, GPPJ, Keju', tabs: ['SUPERCUP', 'GPPJ', 'KEJU'] },
  };
  const ALIAS = { omset: 'full' };
  const TABN = { rute: 'Per rute', sku: 'Per SKU', outlet: 'Per outlet', ring: 'Ringkasan', bulan: 'Per bulan', target: 'Vs target', salesman: 'Per salesman', toko: 'Per toko', SUPERCUP: 'Supercup', GPPJ: 'GPPJ', KEJU: 'Keju' };
  const fmtV = (v, key) => (key === 'cont' ? nf(v, 1) + '%' : key === 'ec' ? nf(v, 1) : key === 'full' ? jt(v) : nf(v, 0));
  const gChip = (g, unit) => `<span class="g ${g == null || !isFinite(g) ? 'flat' : g > 0.05 ? 'up' : g < -0.05 ? 'down' : 'flat'}">${unit === 'pt' ? sg(g, 1, ' pt') : sg(g, 1)}</span>`;
  const achChip = (v) => `<span class="g ${v == null ? 'flat' : v >= 100 ? 'up' : 'down'}">${v == null ? '–' : nf(v, 0) + '%'}</span>`;
  let DR = {};

  function totalOf(D, k, rt) {
    if (k === 'ec') { if (rt) { const r = PandaData.ecRoutes(D); return r && r.find((x) => x.key === rt); } return PandaData.ecTotal(D); }
    return PandaData.total(D, k, rt);
  }

  function open(dd) {
    const D = getData();
    if (!D) { toast('Data Excel belum termuat', true); return; }
    dd = ALIAS[dd] || dd;
    if (dd.startsWith('route:')) {
      const key = dd.split(':')[1];
      const r = D.routes.find((x) => x.key === key); if (!r) return;
      DR = { mode: 'route', rt: key, key: 'ca', tab: 'ring', filter: 'Semua', q: '', limit: 80 };
      $('#dKicker').textContent = `${r.label.toUpperCase()} · ${String(r.type).toUpperCase()}`;
      $('#dTitle').textContent = r.name;
    } else {
      if (!MET[dd]) return;
      if (dd === 'ec' && !D.ec || dd === 'onc' && !D.onc || dd === 'pareto' && !D.pareto || dd === 'itg' && !D.itg) { toast('Sheet data untuk ' + MET[dd].name + ' tidak ada di Excel', true); return; }
      DR = { mode: 'metric', key: dd, tab: MET[dd].tabs[0], rt: '', filter: 'Semua', q: '', limit: 80 };
      $('#dKicker').textContent = 'BREAKDOWN · ' + MET[dd].desc.toUpperCase();
      $('#dTitle').textContent = MET[dd].name;
    }
    renderSummary(); renderTabs(); renderBody();
    $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false');
  }
  function close() { $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); if (DR.spark) { DR.spark.destroy(); DR.spark = null; } }

  function sumBox(label, val, cls = '', sub = '') { return `<div class="sum ${cls}"><small>${label}</small><b>${val}</b>${sub ? `<div class="muted" style="font-size:11.5px">${sub}</div>` : ''}</div>`; }

  function renderSummary() {
    const D = getData(), box = $('#dSummary');
    if (DR.spark) { DR.spark.destroy(); DR.spark = null; }
    const uLabel = D.label[D.U];
    if (DR.mode === 'route') {
      const ks = ['ca', 'caprod', 'camss', 'cont'];
      box.innerHTML = ks.map((k) => { const t = totalOf(D, k, DR.rt); return sumBox(MET[k].name, fmtV(t.after, k), t.growth >= 0 ? 'up' : 'down', `before ${fmtV(t.before, k)} · ${t.unit === 'pt' ? sg(t.growth, 1, ' pt') : sg(t.growth)}`); }).join('') + '<div class="spark"><canvas></canvas></div>';
      const r = D.routes.find((x) => x.key === DR.rt);
      sparkline(box.querySelector('canvas'), totalOf(D, 'ca', DR.rt).series, 'CA', 'ca', r.hist);
      return;
    }
    const k = DR.key;
    if (k === 'onc') {
      const n = D.onc.length, tr = D.onc.filter((x) => x.net.some((v) => v > 0)).length, ac = D.onc.filter((x) => x.net[x.net.length - 1] > 0).length;
      const series = D.oncMonths.map((_, i) => D.onc.reduce((t, x) => t + x.net[i], 0));
      box.innerHTML = sumBox('OUTLET ONC', nf(n)) + sumBox('SUDAH TRANSAKSI', nf(tr), 'up', nf(tr / n * 100) + '%') + sumBox('AKTIF ' + D.oncMonths[D.oncMonths.length - 1].toUpperCase(), nf(ac), 'upd') + sumBox('OMSET / BLN', jt(series.reduce((a, b) => a + b, 0) / D.A.length), 'up', `rata² ${D.label[D.A[0]]}-${D.label[D.A[D.A.length - 1]]}`) + '<div class="spark"><canvas></canvas></div>';
      sparkSimple(box.querySelector('canvas'), D.oncMonths, series.map((v) => v / 1e6), 'Omset ONC (Rp jt)', 1);
      return;
    }
    if (k === 'pareto') {
      const p = D.pareto.filter((x) => x.no !== 'SMD');
      const T = p.reduce((t, x) => t + x.target, 0), A = D.parMonths.map((_, i) => p.reduce((t, x) => t + x.act[i], 0));
      const good = p.filter((x) => x.hp === 'GOOD').length;
      box.innerHTML = sumBox('TARGET / BLN', jt(T, 0)) + sumBox('AKTUAL RATA²', jt(PandaData.avg(A), 0), 'up', nf(PandaData.avg(A) / T * 100) + '% target') + sumBox('GOOD', nf(good), 'up') + sumBox('BAD', nf(p.length - good), 'down') + '<div class="spark"><canvas></canvas></div>';
      sparkSimple(box.querySelector('canvas'), D.parMonths, A.map((v) => (v / T) * 100), 'Ach pareto (%)', 0, '%');
      return;
    }
    if (k === 'itg') {
      const progs = ['SUPERCUP', 'GPPJ', 'KEJU'];
      box.innerHTML = progs.map((g) => { const rows = D.itg.filter((x) => x.prog === g); const t = rows.reduce((s, x) => s + x.t.reduce((a, b) => a + b, 0), 0), a = rows.reduce((s, x) => s + x.a.reduce((p, q) => p + q, 0), 0); const ach = t ? (a / t) * 100 : 0; return sumBox(g, nf(ach) + '%', ach >= 100 ? 'up' : 'down', rows.length + ' toko'); }).join('') + sumBox('PERIODE', D.itgMonths[0] + '-' + D.itgMonths[D.itgMonths.length - 1], 'upd') + '<div class="spark"><canvas></canvas></div>';
      const ach = D.itgMonths.map((_, i) => { const rows = D.itg.filter((x) => x.prog === (DR.tab || 'SUPERCUP')); const t = rows.reduce((s, x) => s + x.t[i], 0); return t ? rows.reduce((s, x) => s + x.a[i], 0) / t * 100 : 0; });
      sparkSimple(box.querySelector('canvas'), D.itgMonths, ach, 'Ach ' + (DR.tab || 'SUPERCUP') + ' (%)', 0, '%');
      return;
    }
    const t = totalOf(D, k);
    box.innerHTML = sumBox('BEFORE', fmtV(t.before, k)) + sumBox('AFTER', fmtV(t.after, k)) + sumBox('UPDATE · ' + uLabel.toUpperCase(), fmtV(t.upd, k), 'upd') + sumBox(t.unit === 'pt' ? 'PERUBAHAN' : 'TUMBUH', t.unit === 'pt' ? sg(t.growth, 1, ' pt') : sg(t.growth), t.growth >= 0 ? 'up' : 'down') + '<div class="spark"><canvas></canvas></div>';
    sparkline(box.querySelector('canvas'), t.series, MET[k].name, k);
  }
  function sparkline(cv, series, name, key, sub) {
    const D = getData();
    const col = D.months.map((m) => (m.update ? '#E2A33B' : m.period === 'BEFORE' ? '#B5B8BD' : m.period === 'SKIP' ? '#DEDCD5' : '#1E1F22'));
    const sc = key === 'full' ? 1e6 : 1;
    DR.spark = new Chart(cv.getContext('2d'), {
      type: 'bar',
      data: { labels: D.months.map((m) => m.label), datasets: [{ data: series.map((v) => Math.round((v / sc) * 10) / 10), backgroundColor: col, borderRadius: 4, barPercentage: 0.7, datalabels: { anchor: 'end', align: 'top', offset: 0, font: { size: 9.5, weight: '700' }, color: '#6B6F76', formatter: (v) => (key === 'cont' ? nf(v, 0) + '%' : key === 'ec' ? nf(v, 1) : nf(v, 0)) } }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 800, delay: (c) => c.dataIndex * 40 }, layout: { padding: { top: 14 } },
        plugins: { legend: { display: false }, title: { display: !!sub || key === 'full', text: sub || (key === 'full' ? 'Rp juta' : ''), font: { size: 10.5 }, color: '#6B6F76', align: 'start' }, tooltip: { callbacks: { label: (c) => `${name}: ${nf(c.raw, 1)}` } } },
        scales: { y: { display: false, beginAtZero: true }, x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10.5, weight: '600' } } } } },
    });
  }
  function sparkSimple(cv, labels, vals, title, d = 0, suf = '') {
    const last = labels.length - 1;
    DR.spark = new Chart(cv.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ data: vals, backgroundColor: labels.map((_, i) => (i === last ? '#E2A33B' : '#1E1F22')), borderRadius: 4, barPercentage: 0.6, datalabels: { anchor: 'end', align: 'top', offset: 0, font: { size: 9.5, weight: '700' }, color: '#6B6F76', formatter: (v) => nf(v, d) + suf } }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 800, delay: (c) => c.dataIndex * 50 }, layout: { padding: { top: 14 } }, plugins: { legend: { display: false }, title: { display: true, text: title, font: { size: 10.5 }, color: '#6B6F76', align: 'start' } }, scales: { y: { display: false, beginAtZero: true }, x: { grid: { display: false }, border: { display: false } } } },
    });
  }
  function renderTabs() {
    const tabs = DR.mode === 'route' ? ['ring', 'outlet', 'sku'] : MET[DR.key].tabs;
    $('#dTabs').innerHTML = tabs.map((t) => `<button class="tab ${t === DR.tab ? 'on' : ''}" data-t="${t}">${t === 'sku' && DR.mode === 'route' ? 'SKU MSS' : TABN[t]}</button>`).join('');
    $('#dTabs').querySelectorAll('.tab').forEach((b) => (b.onclick = () => { DR.tab = b.dataset.t; DR.limit = 80; DR.filter = 'Semua'; DR.q = ''; renderTabs(); if (DR.key === 'itg') renderSummary(); renderBody(); }));
  }
  function tools(html) { $('#dTools').innerHTML = html; }
  function routeSelect() {
    if (DR.mode === 'route') return '';
    return `<select id="tRt"><option value="">Semua rute</option>${getData().routes.map((r) => `<option value="${r.key}" ${DR.rt === r.key ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`;
  }
  function bindRt() { const s = $('#tRt'); if (s) s.onchange = () => { DR.rt = s.value; DR.limit = 80; renderBody(); }; }
  const tbl = (head, rows) => `<table class="tbl"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
  const tr = (i, cells, attrs = '') => `<tr style="animation-delay:${Math.min(i, 15) * 30}ms" ${attrs}>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  const nm = (a, b) => `<span class="nm">${esc(a)}</span>${b ? `<span class="sub">${esc(b)}</span>` : ''}`;
  function searchTool(ph, fn) { const q = $('#tQ'); if (q) q.oninput = () => { DR.q = q.value; DR.limit = 80; fn(); }; }
  function chipsTool(list) { return list.map((s) => `<button class="chipf ${DR.filter === s ? 'on' : ''}" data-f="${s}">${s}</button>`).join(''); }
  function bindChips() { $('#dTools').querySelectorAll('.chipf').forEach((b) => (b.onclick = () => { DR.filter = b.dataset.f; DR.limit = 80; renderBody(); })); }

  function renderBody() {
    const D = getData(), body = $('#dBody');
    const uL = D.label[D.U];
    const k = DR.key;
    if (DR.tab === 'ring') {
      tools('');
      const ks = ['ca', 'caprod', 'ec', 'camss', 'cont', 'full'].filter((x) => x !== 'ec' || D.ec);
      const rows = ks.map((x) => Object.assign({ k: x }, totalOf(D, x, DR.rt)));
      let extra = '';
      if (D.nine) {
        const items = D.nine.filter((x) => x.rt === DR.rt);
        if (items.length) extra += `<div class="nine"><b>9 Super · ${items.filter((x) => x.s === 'STRONG').length}/${items.length} strong</b><div>${items.map((x) => `<span class="nine-i ${x.s === 'STRONG' ? 'ok' : 'weak'}">${esc(x.a)}</span>`).join('')}</div></div>`;
      }
      if (D.target) {
        const t = D.target.filter((x) => x.rt === DR.rt);
        if (t.length) { const T = t.reduce((s, x) => s + x.t, 0), A = t.reduce((s, x) => s + x.a, 0); extra += `<div class="nine"><b>Omset vs target ${esc(t[0].m)}-${esc(t[t.length - 1].m)} · ach ${nf(A / T * 100)}%</b><div>${t.map((x) => `<span class="nine-i ${x.a >= x.t ? 'ok' : 'weak'}">${esc(x.m)} ${nf(x.a / x.t * 100)}%</span>`).join('')}</div></div>`; }
      }
      body.innerHTML = tbl(['Indikator', 'Before', 'After', uL, 'Tumbuh'], rows.map((r, i) => tr(i, [nm(MET[r.k].name, MET[r.k].desc), fmtV(r.before, r.k), `<b>${fmtV(r.after, r.k)}</b>`, fmtV(r.upd, r.k), gChip(r.growth, r.unit)]))) + extra +
        '<p class="muted" style="font-size:12px">Klik tab <b>Per outlet</b> untuk melihat outlet baru aktif, lanjut, dan hilang di rute ini.</p>';
      return;
    }
    if (DR.tab === 'rute') {
      tools('');
      const rows = k === 'ec' ? PandaData.ecRoutes(D) : PandaData.byRoute(D, k);
      const mx = Math.max(...rows.map((r) => r.after)) || 1;
      body.innerHTML = tbl(['Rute', 'Before', 'After', uL, 'Tumbuh'], rows.map((r, i) => tr(i, [`${nm(r.name, r.label + ' · ' + (k === 'ec' ? `STD ${r.std} · after ${nf(r.after / r.std * 100)}% STD` : r.hist))}<div class="bar"><span style="width:${(r.after / mx) * 100}%;animation-delay:${i * 60}ms"></span></div>`, fmtV(r.before, k), `<b>${fmtV(r.after, k)}</b>`, fmtV(r.upd, k), gChip(r.growth, r.unit)], `data-rt="${r.key}"`))) +
        '<p class="muted" style="font-size:12px">Klik baris rute untuk melihat detail rutenya.</p>';
      body.querySelectorAll('tr[data-rt]').forEach((t) => { t.style.cursor = 'pointer'; t.onclick = () => open('route:' + t.dataset.rt); });
      return;
    }
    if (DR.tab === 'bulan') {
      tools('');
      const rs = PandaData.ecRoutes(D);
      body.innerHTML = tbl(['Bulan', ...rs.map((r) => esc(r.name.split(' ')[0])), 'Tim'], D.months.map((m, i) => tr(i, [`<span class="nm">${m.label}</span><span class="sub">${m.period}</span>`, ...rs.map((r) => `<span style="color:${r.series[i] >= r.std ? '#3F7449' : 'inherit'}">${nf(r.series[i], 1)}</span>`), `<b>${nf(PandaData.avg(rs.map((r) => r.series[i])), 1)}</b>`])));
      return;
    }
    if (DR.tab === 'target') {
      tools('');
      if (!D.target) { body.innerHTML = '<div class="empty">Sheet DATA_TARGET tidak ada.</div>'; return; }
      const ms = [...new Set(D.target.map((x) => x.m))];
      body.innerHTML = tbl(['Rute', ...ms, 'Total'], D.routes.map((r, i) => { const t = D.target.filter((x) => x.rt === r.key); const T = t.reduce((s, x) => s + x.t, 0), A = t.reduce((s, x) => s + x.a, 0); return tr(i, [nm(r.name, r.label), ...ms.map((m) => { const x = t.find((y) => y.m === m); return x ? achChip(x.a / x.t * 100) : '–'; }), `<b>${nf(A / T * 100)}%</b><span class="sub">${jt(A / t.length)}/bln</span>`]); })) + '<p class="muted" style="font-size:12px">Ach = aktual omset ÷ target (sheet Sales Performance).</p>';
      return;
    }
    if (DR.tab === 'sku') {
      const key = DR.mode === 'route' ? 'camss' : k;
      tools(routeSelect() + `<input id="tQ" placeholder="Cari SKU…" value="${esc(DR.q)}">`);
      bindRt();
      const list = () => {
        let rows = PandaData.bySku(D, key, DR.rt);
        if (DR.q) rows = rows.filter((r) => r.sku.toLowerCase().includes(DR.q.toLowerCase()));
        const isC = key === 'cont';
        body.innerHTML = rows.length ? tbl(['SKU MSS', isC ? 'Share before' : 'CA before', isC ? 'Share after' : 'CA after', uL, isC ? 'Δ' : 'Tumbuh'], rows.map((r, i) => tr(i, [nm(r.sku, `Omset MSS rata² after Rp${nf(r.extra / 1e6, 1)} jt/bln`), isC ? nf(r.before, 1) + '%' : nf(r.before), `<b>${isC ? nf(r.after, 1) + '%' : nf(r.after)}</b>`, isC ? nf(r.upd, 1) + '%' : nf(r.upd), gChip(r.growth, r.unit)]))) : '<div class="empty">Tidak ada SKU yang cocok.</div>';
      };
      searchTool('', list); list();
      return;
    }
    if (DR.tab === 'salesman') {
      tools('');
      const by = {};
      D.onc.forEach((x) => { const o = (by[x.sm] = by[x.sm] || { n: 0, tr: 0, ac: 0, net: 0 }); o.n++; if (x.net.some((v) => v > 0)) o.tr++; if (x.net[x.net.length - 1] > 0) o.ac++; o.net += x.net.reduce((a, b) => a + b, 0) / D.A.length; });
      body.innerHTML = tbl(['Salesman', 'Outlet ONC', 'Transaksi', 'Aktif ' + D.oncMonths[D.oncMonths.length - 1], 'Omset/bln'], Object.entries(by).sort((a, b) => b[1].n - a[1].n).map(([s, o], i) => tr(i, [nm(s), `<b>${o.n}</b>`, o.tr, o.ac, jt(o.net)])));
      return;
    }
    if (DR.tab === 'toko') {
      tools(`<input id="tQ" placeholder="Cari toko…" value="${esc(DR.q)}">` + chipsTool(['Semua', 'GOOD', 'BAD', 'SMD']));
      bindChips();
      const ms = D.parMonths;
      const list = () => {
        let rows = D.pareto.slice();
        if (DR.filter === 'SMD') rows = rows.filter((x) => x.no === 'SMD'); else { rows = rows.filter((x) => x.no !== 'SMD'); if (DR.filter !== 'Semua') rows = rows.filter((x) => x.hp === DR.filter); }
        if (DR.q) rows = rows.filter((x) => String(x.nama).toLowerCase().includes(DR.q.toLowerCase()));
        body.innerHTML = rows.length ? tbl(['Toko', 'Target', ...ms, 'Status'], rows.map((x, i) => tr(i, [nm(x.nama, `#${x.no} · ${x.ch}`), jt(x.target), ...ms.map((_, j) => `<span class="mini ${x.act[j] >= x.target ? 'ok' : 'weak'}">${nf(x.act[j] / 1e6, 0)}</span>`), `<span class="st ${x.hp === 'GOOD' ? 'Baru' : 'Hilang'}">${esc(x.hp)}</span>`]))) + '<p class="muted" style="font-size:12px">Angka bulanan dalam Rp juta. Hijau = di atas target.</p>' : '<div class="empty">Tidak ada toko yang cocok.</div>';
      };
      searchTool('', list); list();
      return;
    }
    if (k === 'itg') {
      tools(`<input id="tQ" placeholder="Cari toko…" value="${esc(DR.q)}">`);
      const ms = D.itgMonths;
      const list = () => {
        let rows = D.itg.filter((x) => x.prog === DR.tab);
        if (DR.q) rows = rows.filter((x) => String(x.nama).toLowerCase().includes(DR.q.toLowerCase()));
        body.innerHTML = rows.length ? tbl(['Toko', ...ms, 'Total'], rows.map((x, i) => { const T = x.t.reduce((a, b) => a + b, 0), A = x.a.reduce((a, b) => a + b, 0); return tr(i, [nm(x.nama, x.sm), ...ms.map((_, j) => (x.t[j] ? `<span class="mini ${x.a[j] >= x.t[j] ? 'ok' : 'weak'}">${nf(x.a[j] / x.t[j] * 100)}%</span>` : '–')), achChip(T ? A / T * 100 : null)]); })) : '<div class="empty">Tidak ada toko yang cocok.</div>';
      };
      searchTool('', list); list();
      return;
    }
    if (k === 'onc') {
      const sms = [...new Set(D.onc.map((x) => x.sm))];
      tools(`<select id="tSm"><option value="">Semua salesman</option>${sms.map((s) => `<option ${DR.sm === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select><input id="tQ" placeholder="Cari outlet…" value="${esc(DR.q)}">` + chipsTool(['Semua', 'Aktif', 'Tidak aktif', 'Belum transaksi']));
      bindChips(); $('#tSm').onchange = (e) => { DR.sm = e.target.value; list(); };
      const ms = D.oncMonths;
      const list = () => {
        let rows = D.onc.slice();
        if (DR.sm) rows = rows.filter((x) => x.sm === DR.sm);
        if (DR.filter === 'Aktif') rows = rows.filter((x) => x.net[x.net.length - 1] > 0);
        if (DR.filter === 'Tidak aktif') rows = rows.filter((x) => x.net.some((v) => v > 0) && !(x.net[x.net.length - 1] > 0));
        if (DR.filter === 'Belum transaksi') rows = rows.filter((x) => !x.net.some((v) => v > 0));
        if (DR.q) { const s = DR.q.toLowerCase(); rows = rows.filter((x) => String(x.nama).toLowerCase().includes(s) || x.id.includes(s)); }
        rows.sort((a, b) => b.net.reduce((p, q) => p + q, 0) - a.net.reduce((p, q) => p + q, 0));
        const shown = rows.slice(0, DR.limit);
        body.innerHTML = `<div class="legend-mini">${nf(rows.length)} outlet · titik = transaksi per bulan ${ms[0]}-${ms[ms.length - 1]}</div>` + (shown.length ? tbl(['Outlet', 'ONC', 'Transaksi', 'Omset/bln'], shown.map((x, i) => tr(i, [nm(x.nama, `${x.sm} · ${x.id}`), esc(x.bulan), `<span class="dots">${x.net.map((v, j) => `<i class="${v > 0 ? (j === x.net.length - 1 ? 'u' : 'a') : 'off'}" title="${ms[j]}: ${jt(v)}"></i>`).join('')}</span>`, jt(x.net.reduce((a, b) => a + b, 0) / D.A.length, 2)]))) : '<div class="empty">Tidak ada outlet yang cocok.</div>') + (rows.length > DR.limit ? '<button class="more" id="more">Tampilkan lagi</button>' : '');
        const m = $('#more'); if (m) m.onclick = () => { DR.limit += 80; list(); };
      };
      searchTool('', list); list();
      return;
    }
    // ---------- outlet ----------
    const key = DR.mode === 'route' ? DR.key : k;
    const isC = key === 'cont', isF = key === 'full';
    const metSel = DR.mode === 'route' ? `<select id="tMet">${['ca', 'caprod', 'camss', 'full'].map((x) => `<option value="${x}" ${DR.key === x ? 'selected' : ''}>${MET[x].name}</option>`).join('')}</select>` : '';
    tools(metSel + routeSelect() + `<input id="tQ" placeholder="Cari nama / ID outlet…" value="${esc(DR.q)}">` + (isC || isF ? '' : chipsTool(['Semua', 'Baru', 'Lanjut', 'Hilang'])));
    bindRt(); bindChips();
    if ($('#tMet')) $('#tMet').onchange = (e) => { DR.key = e.target.value; DR.limit = 80; renderBody(); };
    const all = PandaData.byOutlet(D, isF ? 'ca' : key, DR.rt);
    const nB = D.B.length, nA = D.A.length;
    const list = () => {
      let rows = all;
      if (DR.filter !== 'Semua' && !isC && !isF) rows = rows.filter((r) => r.status === DR.filter);
      if (DR.q) { const s = DR.q.toLowerCase(); rows = rows.filter((r) => (r.nama || '').toLowerCase().includes(s) || r.id.includes(s)); }
      rows = rows.slice().sort((a, b) => (isC ? b.mssA - a.mssA : b.netA - a.netA));
      const cnt = { Baru: 0, Lanjut: 0, Hilang: 0 }; all.forEach((r) => cnt[r.status] != null && cnt[r.status]++);
      const head = isC || isF
        ? `<div class="legend-mini">${nf(rows.length)} outlet · diurutkan dari omset ${isC ? 'MSS ' : ''}terbesar</div>`
        : `<div class="legend-mini">${nf(rows.length)} outlet · <span><b>${nf(cnt.Baru)}</b> baru</span><span><b>${nf(cnt.Lanjut)}</b> lanjut</span><span><b>${nf(cnt.Hilang)}</b> hilang</span><span class="dots"><i class="b"></i></span>before <span class="dots"><i class="a"></i></span>after <span class="dots"><i class="u"></i></span>${uL}</div>`;
      const shown = rows.slice(0, DR.limit);
      let html;
      if (isF) html = tbl(['Outlet', 'Before', 'After', uL, 'Tumbuh'], shown.map((r, i) => tr(i, [nm(r.nama, r.rname + ' · ' + r.id), jt(r.netB, 2), `<b>${jt(r.netA, 2)}</b>`, jt(r.netU, 2), gChip(r.netB ? (r.netA / r.netB - 1) * 100 : null)])));
      else if (isC) html = tbl(['Outlet', 'Before', 'After', uL, 'Δ'], shown.map((r, i) => tr(i, [nm(r.nama, `${r.rname} · MSS Rp${nf(r.mssA / 1e6, 2)} jt/bln`), nf(r.before, 0) + '%', `<b>${nf(r.after, 0)}%</b>`, nf(r.upd, 0) + '%', gChip(r.growth, 'pt')])));
      else html = tbl(['Outlet', 'Bulan masuk', 'Omset/bln after', 'Status'], shown.map((r, i) => {
        const dots = `<span class="dots">${Array.from({ length: nB }, (_, j) => `<i class="${j < r.hb ? 'b' : 'off'}"></i>`).join('')}</span> <span class="dots">${Array.from({ length: nA }, (_, j) => `<i class="${j < r.ha ? 'a' : 'off'}"></i>`).join('')}</span> <span class="dots"><i class="${r.hu ? 'u' : 'off'}"></i></span>`;
        return tr(i, [nm(r.nama, r.rname + ' · ' + r.id), `${dots}<span class="sub">${r.hb}/${nB} · ${r.ha}/${nA}</span>`, jt(r.netA), `<span class="st ${r.status}">${r.status}</span>`]);
      }));
      body.innerHTML = head + (shown.length ? html : '<div class="empty">Tidak ada outlet yang cocok.</div>') + (rows.length > DR.limit ? `<button class="more" id="more">Tampilkan ${nf(Math.min(80, rows.length - DR.limit))} lagi</button>` : '');
      const m = $('#more'); if (m) m.onclick = () => { DR.limit += 80; list(); };
    };
    searchTool('', list); list();
  }

  const isOpen = () => $('#drawer').classList.contains('on');
  const DD_LIST = [['', '— tidak ada —'], ['ca', 'CA'], ['caprod', 'CA Prod'], ['ec', 'EC'], ['camss', 'CA MSS'], ['cont', 'Kontribusi MSS'], ['omset', 'Omset'], ['onc', 'ONC'], ['pareto', 'Pareto'], ['itg', 'ITG'], ['route:R1', 'Rute 1'], ['route:R2', 'Rute 2'], ['route:R3', 'Rute 3'], ['route:R4', 'Rute 4'], ['route:R5', 'Rute 5']];
  global.Drill = { open, close, isOpen, init(o) { getData = o.getData; toast = o.toast; }, DD_LIST };
})(window);
