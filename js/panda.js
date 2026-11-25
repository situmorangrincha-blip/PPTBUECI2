/* PANDA SUKSESS — maskot panda interaktif (SVG inline).
 * Mata mengikuti kursor, berkedip, telinga goyang saat disorot, melambai + lompat saat diklik,
 * dan maskot pojok yang membacakan poin penjelasan slide aktif.
 */
(function (global) {
  'use strict';
  let SVG = null, loading = null;
  const live = new Set();
  const PHRASES = ['Semangat, tim! 🐼', 'Coverage naik, mantap!', 'EC makin efektif!', 'MSS jangan lupa ya!', 'Klik grafiknya, ada breakdown!', 'Panda suka angka hijau 💚', 'Yuk lanjut slide berikutnya!'];

  function load() {
    if (SVG) return Promise.resolve(SVG);
    if (!loading) loading = fetch('img/panda_v2.svg').then((r) => r.text()).then((t) => (SVG = t.replace(/ id="p-/g, ' class="p-').replace(/ width="400" height="470"/, ' preserveAspectRatio="xMidYMid meet"')));
    return loading;
  }

  function mount(el, opt = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'panda-wrap' + (opt.interactive ? ' live' : '');
    el.appendChild(wrap);
    const fill = () => {
      wrap.innerHTML = SVG;
      if (!opt.interactive) return;
      const P = { el, wrap, svg: wrap.querySelector('svg'), pl: wrap.querySelector('.p-pupil-l'), pr: wrap.querySelector('.p-pupil-r'), opt };
      el._panda = P;
      live.add(P);
      scheduleBlink(P);
      wrap.addEventListener('pointerenter', () => wrap.classList.add('hover'));
      wrap.addEventListener('pointerleave', () => wrap.classList.remove('hover'));
      if (!opt.quiet) wrap.addEventListener('click', (e) => { e.stopPropagation(); poke(P, e); });
    };
    if (SVG) fill(); else load().then(fill);
    return wrap;
  }

  function scheduleBlink(P) {
    clearTimeout(P.bt);
    P.bt = setTimeout(() => {
      if (!P.wrap.isConnected) { live.delete(P); return; }
      P.wrap.classList.add('blink');
      setTimeout(() => P.wrap.classList.remove('blink'), 170);
      if (Math.random() < 0.25) setTimeout(() => { P.wrap.classList.add('blink'); setTimeout(() => P.wrap.classList.remove('blink'), 150); }, 320);
      scheduleBlink(P);
    }, 2200 + Math.random() * 3200);
  }

  // mata mengikuti kursor
  let mx = innerWidth / 2, my = innerHeight / 2, raf = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(track); }, { passive: true });
  function track() {
    raf = 0;
    live.forEach((P) => {
      if (!P.wrap.isConnected) { live.delete(P); return; }
      const r = P.svg.getBoundingClientRect();
      if (!r.width) return;
      const s = r.width / 400;
      const eyeY = r.top + 186 * s;
      [[P.pl, 142], [P.pr, 258]].forEach(([pu, cx]) => {
        if (!pu) return;
        const ex = r.left + cx * s;
        const dx = mx - ex, dy = my - eyeY, d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 260) * 8;
        pu.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`;
      });
      const hd = P.wrap.querySelector('.p-head');
      if (hd) { const cx = r.left + r.width / 2; const tilt = Math.max(-6, Math.min(6, (mx - cx) / 60)); hd.style.setProperty('--look', tilt + 'deg'); }
    });
  }

  function say(P, text, ms = 1800) {
    let b = P.el.querySelector(':scope > .panda-say');
    if (!b) { b = document.createElement('div'); b.className = 'panda-say'; P.el.appendChild(b); }
    b.textContent = text;
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('on'), ms);
  }

  function poke(P, e) {
    const w = P.wrap;
    w.classList.remove('happy', 'wave', 'hop'); void w.offsetWidth;
    w.classList.add('happy', 'wave', 'hop');
    clearTimeout(P.ht); P.ht = setTimeout(() => w.classList.remove('happy', 'wave', 'hop'), 1500);
    P.n = (P.n || 0) + 1;
    if (!P.opt.quiet) say(P, P.n % 5 === 0 ? 'Hihi, geli! 🤭' : PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    if (global.Fx && e) global.Fx.burst(e.clientX, e.clientY, 'heart');
  }

  function hopAll() {
    live.forEach((P) => { if (!P.wrap.isConnected) return; P.wrap.classList.remove('hop'); void P.wrap.offsetWidth; P.wrap.classList.add('hop'); setTimeout(() => P.wrap.classList.remove('hop'), 900); });
  }
  function cheer(on) { live.forEach((P) => P.wrap.classList.toggle('happy', !!on)); }

  // ---------------------------------------------------------------- maskot pojok
  const corner = {
    el: null, tips: [], k: 0, hidden: false,
    init(host) {
      const m = document.createElement('div');
      m.id = 'mascot'; m.className = 'mascot';
      m.innerHTML = '<div class="m-bubble"><span class="m-step"></span><div class="m-text"></div><div class="m-hint">klik panda untuk poin berikutnya</div></div><div class="m-body"></div><button class="m-x" title="Sembunyikan panda" aria-label="Sembunyikan panda">×</button>';
      host.appendChild(m);
      this.el = m;
      const body = m.querySelector('.m-body');
      mount(body, { interactive: true, quiet: true });
      try { const p = JSON.parse(localStorage.getItem('panda-mascot') || 'null'); if (p) { m.style.left = p.x + 'px'; m.style.top = p.y + 'px'; m.style.bottom = 'auto'; } this.hidden = localStorage.getItem('panda-mascot-off') === '1'; } catch (e) { /* abaikan */ }
      m.classList.toggle('off', this.hidden);
      m.querySelector('.m-x').onclick = (e) => { e.stopPropagation(); this.toggle(false); };
      // drag
      let d = null;
      m.addEventListener('pointerdown', (e) => { if (e.target.closest('.m-x')) return; d = { x: e.clientX, y: e.clientY, l: m.offsetLeft, t: m.offsetTop, moved: false }; m.setPointerCapture(e.pointerId); });
      m.addEventListener('pointermove', (e) => {
        if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 6) return;
        d.moved = true; m.classList.add('drag');
        m.style.left = Math.max(0, Math.min(innerWidth - 90, d.l + dx)) + 'px'; m.style.top = Math.max(0, Math.min(innerHeight - 90, d.t + dy)) + 'px'; m.style.bottom = 'auto';
      });
      m.addEventListener('pointerup', () => {
        if (d && d.moved) { try { localStorage.setItem('panda-mascot', JSON.stringify({ x: m.offsetLeft, y: m.offsetTop })); } catch (e) { /* abaikan */ } m.classList.remove('drag'); m._justDragged = true; setTimeout(() => (m._justDragged = false), 50); }
        d = null;
      });
      m.addEventListener('click', (e) => {
        e.stopPropagation();
        if (m._justDragged || e.target.closest('.m-x') || e.target.closest('.m-bubble')) return;
        if (body._panda) poke(body._panda, e);
        this.next();
      });
      m.querySelector('.m-bubble').addEventListener('click', (e) => { e.stopPropagation(); this.next(); });
    },
    setTips(tips, k = 0, auto = true) {
      this.tips = tips || []; this.k = k;
      if (auto && this.tips.length) this.show(k); else this.el.classList.remove('talk');
    },
    show(k) {
      if (!this.tips.length || this.hidden) return;
      this.k = (k + this.tips.length) % this.tips.length;
      const t = this.tips[this.k];
      this.say(t.tag + (this.tips.length > 1 ? ` · ${this.k + 1}/${this.tips.length}` : ''), t.text, 9000, true);
    },
    say(tag, text, ms = 3000, hint) {
      if (this.hidden || this.el.classList.contains('away')) return;
      this.el.querySelector('.m-step').textContent = tag;
      this.el.querySelector('.m-text').textContent = text;
      this.el.querySelector('.m-hint').textContent = hint ? 'klik panda untuk poin berikutnya' : 'klik panda untuk penjelasan slide ini';
      this.el.classList.remove('talk'); void this.el.offsetWidth; this.el.classList.add('talk');
      clearTimeout(this._t); this._t = setTimeout(() => this.el.classList.remove('talk'), ms);
    },
    next() { if (this.tips.length) this.show(this.k + 1); else this.say('🐼', 'Slide ini tidak punya poin penjelasan.', 2500); },
    toggle(on) {
      this.hidden = on === undefined ? !this.hidden : !on;
      this.el.classList.toggle('off', this.hidden);
      try { localStorage.setItem('panda-mascot-off', this.hidden ? '1' : '0'); } catch (e) { /* abaikan */ }
      if (!this.hidden) this.say('🐼', 'Halo! Klik aku untuk penjelasan slide ini.', 3000);
      return !this.hidden;
    },
    present(on) { if (this.el) this.el.classList.toggle('away', !on); },
  };

  global.Panda = { load, mount, hopAll, cheer, corner, say };
})(window);
