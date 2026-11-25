/* PANDA SUKSESS — ornamen bergerak & interaktif.
 * fx: sway | float | pulse | spin | peek | wiggle | leaves
 * - aktif setelah objek selesai muncul
 * - parallax mengikuti kursor, "boing" saat disorot, ledakan daun/hati saat diklik
 * - daun berguguran yang menghindar dari kursor
 */
(function (global) {
  'use strict';
  const LEAF = (c) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M6 34 Q4 10 34 6 Q36 30 6 34 Z' fill='${c}'/><path d='M8 32 Q18 20 30 10' stroke='rgba(0,0,0,.18)' stroke-width='1.6' fill='none'/></svg>`)}")`;
  const LEAF_C = ['#8CCB82', '#6FB070', '#5E9C64', '#A9D99B', '#E2A33B'];
  const DEPTH = { sway: 7, float: 12, pulse: 5, spin: 9, peek: 0, wiggle: 6 };
  const leavesLive = new Set();

  function activate(root) {
    root.querySelectorAll('.obj[data-fx]').forEach((el) => {
      const fx = el.dataset.fx;
      if (fx === 'leaves') return;
      el.classList.add('fx-on', 'fx-' + fx);
      if (el._fxBound) return;
      el._fxBound = true;
      el.addEventListener('pointerenter', () => { el.classList.remove('fx-boing'); void el.offsetWidth; el.classList.add('fx-boing'); });
      el.addEventListener('animationend', (e) => { if (e.animationName === 'boing') el.classList.remove('fx-boing'); });
      if (el.classList.contains('obj-pic')) {
        el.addEventListener('click', (e) => { if (document.body.classList.contains('editing')) return; e.stopPropagation(); burst(e.clientX, e.clientY, fx === 'float' ? 'spark' : 'leaf'); });
      }
    });
  }
  function deactivate(root) { root.querySelectorAll('.obj.fx-on').forEach((el) => { el.classList.remove('fx-on', 'fx-' + el.dataset.fx); el.style.translate = ''; }); }

  // parallax
  let px = 0, py = 0, raf = 0, stageEl = null;
  function bindParallax(stage) {
    stageEl = stage;
    addEventListener('pointermove', (e) => {
      px = (e.clientX / innerWidth) * 2 - 1; py = (e.clientY / innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  }
  function tick() {
    raf = 0;
    if (!stageEl || document.body.classList.contains('editing')) return;
    stageEl.querySelectorAll('.slide.active .obj.fx-on').forEach((el) => {
      const d = DEPTH[el.dataset.fx] || 0;
      el.style.translate = `${(-px * d).toFixed(1)}px ${(-py * d).toFixed(1)}px`;
    });
    leavesLive.forEach((L) => push(L));
  }

  // daun berguguran
  function leaves(el, n = 14) {
    const box = document.createElement('div'); box.className = 'leaves';
    for (let i = 0; i < n; i++) {
      const l = document.createElement('i');
      const s = 14 + Math.random() * 16;
      l.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;background-image:${LEAF(LEAF_C[i % LEAF_C.length])};animation-duration:${9 + Math.random() * 9}s,${2.5 + Math.random() * 2}s;animation-delay:${-Math.random() * 16}s,${-Math.random() * 3}s;opacity:${0.55 + Math.random() * 0.4}`;
      const inner = document.createElement('b'); l.appendChild(inner);
      box.appendChild(l);
    }
    el.appendChild(box);
    leavesLive.add(box);
  }
  function push(box) {
    if (!box.isConnected) { leavesLive.delete(box); return; }
    if (!box.closest('.slide.active')) return;
    box.querySelectorAll('i').forEach((l) => {
      const r = l.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const mxp = (px + 1) / 2 * innerWidth, myp = (py + 1) / 2 * innerHeight;
      const dx = cx - mxp, dy = cy - myp, d = Math.hypot(dx, dy);
      if (d < 110) { const f = (110 - d) / 110 * 46; l.style.translate = `${(dx / (d || 1)) * f}px ${(dy / (d || 1)) * f}px`; }
      else if (l.style.translate) l.style.translate = '';
    });
  }

  // ledakan partikel
  let layer = null;
  function burst(x, y, kind = 'leaf', n = 9) {
    if (!layer) { layer = document.createElement('div'); layer.className = 'fx-layer'; document.body.appendChild(layer); }
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'fx-p ' + kind;
      if (kind === 'leaf') p.style.backgroundImage = LEAF(LEAF_C[i % LEAF_C.length]);
      else p.textContent = kind === 'heart' ? ['💚', '🤍', '🖤'][i % 3] : '✦';
      if (kind === 'spark') p.style.color = ['#E2A33B', '#5E9C64', '#FFFFFF'][i % 3];
      p.style.left = x + 'px'; p.style.top = y + 'px';
      layer.appendChild(p);
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6, dist = 50 + Math.random() * 60;
      p.animate([
        { transform: 'translate(-50%,-50%) scale(.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist - 20}px)) scale(1) rotate(${Math.random() * 240 - 120}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * dist * 1.2}px), calc(-50% + ${Math.sin(a) * dist + 30}px)) scale(.8) rotate(${Math.random() * 360}deg)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => p.remove();
    }
  }

  global.Fx = { activate, deactivate, bindParallax, leaves, burst };
})(window);
