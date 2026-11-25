/* PANDA SUKSESS — data breakdown dari Excel (sheet DATA_OUTLET, DATA_SKU, DATA_CR, MASTER_RUTE, SETTING). */
(function (global) {
  'use strict';
  const num = (v) => (v == null || v === '' ? 0 : Number(v));

  function readSheet(wb, name) {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error(`Sheet "${name}" tidak ditemukan di Excel.`);
    return XLSX.utils.sheet_to_json(ws, { defval: null });
  }

  function parseExcel(buf) {
    const wb = XLSX.read(buf, { type: 'array' });
    const setting = readSheet(wb, 'SETTING').filter((r) => r['Bulan'] != null && !isNaN(Number(r['Bulan'])));
    // sheet SETTING punya judul di atas tabel: cari ulang mulai dari header "Bulan"
    let months = setting.map((r) => ({ m: Number(r['Bulan']), label: String(r['Label']), period: String(r['Periode'] || '').toUpperCase(), update: Number(r['Update'] || 0) === 1 }));
    if (!months.length) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['SETTING'], { header: 1, defval: null });
      const h = rows.findIndex((r) => r && r[0] === 'Bulan');
      months = rows.slice(h + 1).filter((r) => r && r[0] != null && !isNaN(Number(r[0]))).map((r) => ({ m: Number(r[0]), label: String(r[1]), period: String(r[2] || '').toUpperCase(), update: Number(r[3] || 0) === 1 }));
    }
    const routes = readSheet(wb, 'MASTER_RUTE').map((r) => ({ key: r['Kode'], label: r['Rute'], name: r['Nama (pemegang terbaru)'], type: r['Tipe'], threshold: num(r['Ambang CA Prod (Rp)']), hist: r['Riwayat pemegang'] || '' }));
    const outlet = readSheet(wb, 'DATA_OUTLET').map((r) => ({ rt: r['Rute'], id: String(r['ID Outlet']), nama: r['Nama Outlet'], m: num(r['Bulan']), net: num(r['Omset']), mss: num(r['Omset MSS']) }));
    const sku = readSheet(wb, 'DATA_SKU').map((r) => ({ sku: r['SKU'], rt: r['Rute'], m: num(r['Bulan']), ca: num(r['CA MSS']), om: num(r['Omset MSS']) }));
    const cr = readSheet(wb, 'DATA_CR').map((r) => ({ rt: r['Rute'], m: num(r['Bulan']), cr: num(r['CR']) }));
    const opt = (name) => (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null }) : null);
    const extra = {};
    const ec = opt('DATA_EC'); if (ec) extra.ec = ec.map((r) => ({ rt: r['Rute'], m: num(r['Bulan']), ec: num(r['EC per hari']), std: num(r['STD EC']) }));
    const pick = (row, pre) => Object.keys(row).filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length));
    const onc = opt('DATA_ONC');
    if (onc && onc.length) { const ms = pick(onc[0], 'Omset '); extra.oncMonths = ms; extra.onc = onc.map((r) => ({ id: String(r['ID Outlet']), nama: r['Nama Outlet'], sm: r['Salesman ONC'], bulan: r['Bulan ONC'], net: ms.map((m) => num(r['Omset ' + m])) })); }
    const par = opt('DATA_PARETO');
    if (par && par.length) { const ms = pick(par[0], 'Aktual '); extra.parMonths = ms; extra.pareto = par.map((r) => ({ no: r['No'], nama: r['Nama Toko'], ch: r['Channel'], hp: r['Status'], target: num(r['Target / bln']), act: ms.map((m) => num(r['Aktual ' + m])) })); }
    const itg = opt('DATA_ITG');
    if (itg && itg.length) { const ms = pick(itg[0], 'Target '); extra.itgMonths = ms; extra.itg = itg.map((r) => ({ prog: r['Program'], nama: r['Nama Toko'], sm: r['Salesman'], t: ms.map((m) => num(r['Target ' + m])), a: ms.map((m) => num(r['Aktual ' + m])) })); }
    const tg = opt('DATA_TARGET'); if (tg) extra.target = tg.map((r) => ({ rt: r['Rute'], m: r['Bulan'], t: num(r['Target omset']), a: num(r['Aktual omset']) }));
    const nine = opt('DATA_9SUPER'); if (nine) extra.nine = nine.map((r) => ({ rt: r['Rute'], g: r['Grup'], a: r['Aktivitas'], s: r['Status'] }));
    return build(Object.assign({ months, routes, outlet, sku, cr }, extra));
  }

  function build(raw) {
    const B = raw.months.filter((x) => x.period === 'BEFORE').map((x) => x.m);
    const A = raw.months.filter((x) => x.period === 'AFTER').map((x) => x.m);
    const U = (raw.months.find((x) => x.update) || raw.months[raw.months.length - 1]).m;
    const label = Object.fromEntries(raw.months.map((x) => [x.m, x.label]));
    const thr = Object.fromEntries(raw.routes.map((r) => [r.key, r.threshold]));
    const rname = Object.fromEntries(raw.routes.map((r) => [r.key, r.name]));
    return Object.assign(raw, { B, A, U, label, thr, rname });
  }

  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  // metrik bulanan untuk filter outlet tertentu
  function monthly(D, rows) {
    const out = {};
    for (const x of D.months) out[x.m] = { ca: 0, caprod: 0, camss: 0, full: 0, mss: 0 };
    for (const r of rows) {
      const o = out[r.m]; if (!o) continue;
      if (r.net > 0) o.ca++;
      if (r.net >= (D.thr[r.rt] || 200000)) o.caprod++;
      if (r.mss > 0) o.camss++;
      o.full += r.net; o.mss += r.mss;
    }
    return out;
  }
  function period(D, mon, key) {
    if (key === 'cont') {
      const s = (ms, k) => ms.reduce((t, m) => t + (mon[m] ? mon[m][k] : 0), 0);
      const share = (ms) => (s(ms, 'full') ? (s(ms, 'mss') / s(ms, 'full')) * 100 : 0);
      const b = share(D.B), a = share(D.A), u = share([D.U]);
      return { before: b, after: a, upd: u, growth: Math.round(a * 10) / 10 - Math.round(b * 10) / 10, unit: 'pt' };
    }
    const b = avg(D.B.map((m) => mon[m][key])), a = avg(D.A.map((m) => mon[m][key])), u = mon[D.U][key];
    return { before: b, after: a, upd: u, growth: b ? (a / b - 1) * 100 : null, unit: '%' };
  }

  function byRoute(D, key) {
    return D.routes.map((r) => {
      const mon = monthly(D, D.outlet.filter((x) => x.rt === r.key));
      return Object.assign({ key: r.key, name: r.name, label: r.label, type: r.type, hist: r.hist, series: D.months.map((x) => (key === 'cont' ? (mon[x.m].full ? (mon[x.m].mss / mon[x.m].full) * 100 : 0) : mon[x.m][key])) }, period(D, mon, key));
    });
  }
  function total(D, key, rt) {
    const mon = monthly(D, rt ? D.outlet.filter((x) => x.rt === rt) : D.outlet);
    return Object.assign({ series: D.months.map((x) => (key === 'cont' ? (mon[x.m].full ? (mon[x.m].mss / mon[x.m].full) * 100 : 0) : mon[x.m][key])) }, period(D, mon, key));
  }

  function bySku(D, key, rt) {
    const rows = rt ? D.sku.filter((x) => x.rt === rt) : D.sku;
    const map = {};
    for (const r of rows) {
      const o = (map[r.sku] = map[r.sku] || {});
      o[r.m] = o[r.m] || { ca: 0, om: 0 }; o[r.m].ca += r.ca; o[r.m].om += r.om;
    }
    let fullB = 0, fullA = 0, fullU = 0;
    if (key === 'cont') {
      const mon = monthly(D, rt ? D.outlet.filter((x) => x.rt === rt) : D.outlet);
      fullB = D.B.reduce((t, m) => t + mon[m].full, 0); fullA = D.A.reduce((t, m) => t + mon[m].full, 0); fullU = mon[D.U].full;
    }
    return Object.entries(map).map(([sku, o]) => {
      const g = (m, k) => (o[m] ? o[m][k] : 0);
      if (key === 'cont') {
        const b = fullB ? (D.B.reduce((t, m) => t + g(m, 'om'), 0) / fullB) * 100 : 0;
        const a = fullA ? (D.A.reduce((t, m) => t + g(m, 'om'), 0) / fullA) * 100 : 0;
        const u = fullU ? (g(D.U, 'om') / fullU) * 100 : 0;
        return { sku, before: b, after: a, upd: u, growth: a - b, unit: 'pt', extra: avg(D.A.map((m) => g(m, 'om'))) };
      }
      const b = avg(D.B.map((m) => g(m, 'ca'))), a = avg(D.A.map((m) => g(m, 'ca'))), u = g(D.U, 'ca');
      return { sku, before: b, after: a, upd: u, growth: b ? (a / b - 1) * 100 : null, unit: '%', extra: avg(D.A.map((m) => g(m, 'om'))) };
    }).sort((x, y) => y.after - x.after);
  }

  function byOutlet(D, key, rt) {
    const rows = rt ? D.outlet.filter((x) => x.rt === rt) : D.outlet;
    const map = {};
    for (const r of rows) {
      const o = (map[r.id] = map[r.id] || { id: r.id, nama: r.nama, rts: {}, m: {} });
      o.rts[r.rt] = (o.rts[r.rt] || 0) + r.net;
      o.m[r.m] = { net: r.net, mss: r.mss, rt: r.rt };
    }
    const hit = (o, m) => {
      const x = o.m[m]; if (!x) return 0;
      if (key === 'ca') return x.net > 0 ? 1 : 0;
      if (key === 'caprod') return x.net >= (D.thr[x.rt] || 200000) ? 1 : 0;
      return x.mss > 0 ? 1 : 0;
    };
    return Object.values(map).map((o) => {
      const rtMain = Object.entries(o.rts).sort((a, b) => b[1] - a[1])[0][0];
      const sum = (ms, k) => ms.reduce((t, m) => t + (o.m[m] ? o.m[m][k] : 0), 0);
      const hb = D.B.reduce((t, m) => t + hit(o, m), 0), ha = D.A.reduce((t, m) => t + hit(o, m), 0), hu = hit(o, D.U);
      const status = hb === 0 && ha > 0 ? 'Baru' : hb > 0 && ha === 0 ? 'Hilang' : hb === 0 && ha === 0 ? 'Belum' : 'Lanjut';
      const base = { id: o.id, nama: o.nama, rt: rtMain, rname: D.rname[rtMain] || rtMain, hb, ha, hu, status,
        netB: sum(D.B, 'net') / D.B.length, netA: sum(D.A, 'net') / D.A.length, netU: o.m[D.U] ? o.m[D.U].net : 0 };
      if (key === 'cont') {
        const sh = (ms) => { const f = sum(ms, 'net'); return f > 0 ? (sum(ms, 'mss') / f) * 100 : 0; };
        Object.assign(base, { before: sh(D.B), after: sh(D.A), upd: sh([D.U]), mssA: sum(D.A, 'mss') / D.A.length });
        base.growth = base.after - base.before;
      }
      return base;
    }).filter((x) => (key === 'cont' ? x.netA > 0 || x.netB > 0 : x.hb + x.ha + x.hu > 0));
  }

  // EC per rute (rata² per hari) dan total tim (rata² 5 rute)
  function ecRoutes(D) {
    if (!D.ec) return null;
    return D.routes.map((r) => {
      const rows = D.ec.filter((x) => x.rt === r.key);
      const by = Object.fromEntries(rows.map((x) => [x.m, x.ec]));
      const std = rows[0] ? rows[0].std : 0;
      const b = avg(D.B.map((m) => by[m] || 0)), a = avg(D.A.map((m) => by[m] || 0)), u = by[D.U] || 0;
      return { key: r.key, name: r.name, label: r.label, type: r.type, hist: r.hist, std, series: D.months.map((x) => by[x.m] || 0), before: b, after: a, upd: u, growth: b ? (a / b - 1) * 100 : null, unit: '%' };
    });
  }
  function ecTotal(D) {
    const rs = ecRoutes(D); if (!rs) return null;
    const series = D.months.map((_, i) => avg(rs.map((r) => r.series[i])));
    const b = avg(rs.map((r) => r.before)), a = avg(rs.map((r) => r.after)), u = avg(rs.map((r) => r.upd));
    return { series, before: b, after: a, upd: u, growth: b ? (a / b - 1) * 100 : null, unit: '%', std: avg(rs.map((r) => r.std)) };
  }

  global.PandaData = { parseExcel, byRoute, bySku, byOutlet, total, ecRoutes, ecTotal, avg };
})(window);
