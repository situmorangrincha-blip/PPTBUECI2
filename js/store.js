/* PANDA SUKSESS — penyimpanan deck.
 * Mode "supabase": dokumen dibaca semua orang, disimpan lewat RPC berPIN (panda_save).
 * Mode "local": belum ada Supabase -> tersimpan di browser ini (IndexedDB) + bisa diunduh sebagai deck.json.
 */
(function (global) {
  'use strict';
  const C = Object.assign({ supabaseUrl: '', supabaseAnonKey: '', deckId: 'kebayoran', localPin: '2026' }, global.PANDA_CONFIG || {});
  const SB = !!(C.supabaseUrl && C.supabaseAnonKey);

  const IDB = {
    db: null,
    open() { return this.db ? Promise.resolve(this.db) : new Promise((res, rej) => { const r = indexedDB.open('panda-sukses', 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('files')) r.result.createObjectStore('files'); }; r.onsuccess = () => res((this.db = r.result)); r.onerror = () => rej(r.error); }); },
    async get(k) { try { const db = await this.open(); return await new Promise((res) => { const t = db.transaction('files').objectStore('files').get(k); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); } catch (e) { return null; } },
    async put(k, v) { try { const db = await this.open(); await new Promise((res) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* abaikan */ } },
    async del(k) { try { const db = await this.open(); await new Promise((res) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').delete(k); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* abaikan */ } },
  };

  const H = () => ({ apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + C.supabaseAnonKey, 'Content-Type': 'application/json' });
  const api = (p) => C.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + p;
  async function rpc(fn, body) {
    const r = await fetch(api('rpc/' + fn), { method: 'POST', headers: H(), body: JSON.stringify(body) });
    const t = await r.text();
    let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
    if (!r.ok) { const msg = (j && (j.message || j.hint)) || t || r.statusText; const err = new Error(msg); if (/CONFLICT/.test(msg)) err.conflict = true; if (/PIN/.test(msg)) err.pin = true; throw err; }
    return j;
  }

  const b64ToBuf = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
  const bufToB64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

  const Store = {
    cfg: C, mode: SB ? 'supabase' : 'local', IDB, b64ToBuf, bufToB64,
    // dokumen bersama / tersimpan. null = pakai content/deck.json bawaan
    async loadDoc() {
      if (SB) {
        try {
          const r = await fetch(api(`panda_decks?id=eq.${encodeURIComponent(C.deckId)}&select=doc,excel,updated_at,updated_by`), { headers: H(), cache: 'no-store' });
          if (r.ok) { const j = await r.json(); if (j[0]) return { doc: j[0].doc, excel: j[0].excel, updatedAt: j[0].updated_at, by: j[0].updated_by, source: 'supabase' }; }
          else console.warn('Supabase', r.status, await r.text());
        } catch (e) { console.warn('Supabase tidak terjangkau', e); }
        return null;
      }
      const d = await IDB.get('doc');
      return d ? { doc: d.doc, updatedAt: d.at, by: d.by, source: 'local' } : null;
    },
    async checkPin(pin) {
      if (SB) { try { return !!(await rpc('panda_check_pin', { p_id: C.deckId, p_pin: pin })); } catch (e) { throw e; } }
      return String(pin) === String(C.localPin);
    },
    async save(doc, o = {}) {
      if (SB) {
        const at = await rpc('panda_save', { p_id: C.deckId, p_pin: o.pin, p_doc: doc, p_excel: o.excel || null, p_by: o.by || null, p_base: o.force ? null : o.base || null });
        return { updatedAt: at };
      }
      const at = new Date().toISOString();
      await IDB.put('doc', { doc, at, by: o.by });
      const vs = (await IDB.get('versions')) || [];
      vs.unshift({ id: at, saved_at: at, saved_by: o.by || '', doc });
      await IDB.put('versions', vs.slice(0, 12));
      return { updatedAt: at };
    },
    async versions() {
      if (SB) {
        const r = await fetch(api(`panda_versions?deck_id=eq.${encodeURIComponent(C.deckId)}&select=id,saved_at,saved_by&order=saved_at.desc&limit=25`), { headers: H(), cache: 'no-store' });
        return r.ok ? r.json() : [];
      }
      return ((await IDB.get('versions')) || []).map((v) => ({ id: v.id, saved_at: v.saved_at, saved_by: v.saved_by }));
    },
    async loadVersion(id) {
      if (SB) { const r = await fetch(api(`panda_versions?id=eq.${id}&select=doc`), { headers: H() }); const j = await r.json(); return j[0] && j[0].doc; }
      const v = ((await IDB.get('versions')) || []).find((x) => x.id === id); return v && v.doc;
    },
    async resetLocal() { await IDB.del('doc'); await IDB.del('versions'); },
    draft: {
      put: (doc) => IDB.put('draft', { doc, at: Date.now() }),
      get: () => IDB.get('draft'),
      clear: () => IDB.del('draft'),
    },
  };
  global.Store = Store;
})(window);
