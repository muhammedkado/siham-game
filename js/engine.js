/* سهام — محرك اللعبة: الرسم، اللمس، التكبير، الحركة */
(function (root) {
  'use strict';
  const DIRS = root.Gen.DIRS;
  const FADE = 0;             // الخانات الفارغة تبدأ مثل باقي الرقعة (طيف خفيف + نقطة)
  const LINE = 0.16;          // سماكة خط السهم (بوحدة الخانة)
  const HEAD = 0.30;          // حجم رأس السهم

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const HOT = ['#3b82f6', '#9b5de5', '#ff7a1a'];   // ألوان الأسهم أثناء السلسلة
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // العناصر الخاصة: برق (ينطلق لحاله) وقنبلة (نايمة / مشتعلة / عالآخر / منفجرة)
  const ZAP = '#ffc400';
  // أبيض بحافة كهرمانية: بيتميّز عن كل ستايلات الأسهم (حتى الذهبي والحلوى يلي فيهم أصفر)
  const BOLT_C = { b: '#fffdf2', e: '#f59e0b', h: '#ffffff' }, BOLT_GLOW = '#ffc400', BOLT_INK = '#f59e0b';
  const BOMB_C = { b: '#5b5f7a', e: '#23253a', h: '#b9bdd6' }, BOMB_LIT = { b: '#be123c', e: '#4c0519', h: '#ffb3c1' };
  const BOMB_HOT = { b: '#ff5a6e', e: '#7f1028', h: '#ffe4e8' }, BURNT_C = { b: '#8d91a3', e: '#4a4d5c', h: '#c9ccd8' };
  const BOLT_GLYPH = [[13.5, 1.5], [4, 13.5], [10.5, 13.5], [9.5, 22.5], [20, 9.5], [13.2, 9.5]];

  class Engine {
    constructor(canvas, hooks) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.h = hooks || {};
      this.dpr = 1; this.cw = 1; this.ch = 1;
      this.view = { s: 20, ox: 0, oy: 0 };
      this.fitS = 20;
      this.anims = [];
      this.raf = 0;
      this.last = 0;
      this.pointers = new Map();
      this.gesture = null;
      this.theme = { bg: '#fff', cell: '#eef1f8', ink: '#1f2544', accent: '#3b82f6', danger: '#ef4444', ok: '#10b981' };
      this.L = null;
      this._bind();
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
      if (ro) ro.observe(canvas.parentElement); else root.addEventListener('resize', () => this.resize());
    }

    setTheme(t) { this.theme = Object.assign({}, this.theme, t); this.kick(); }

    // ——— تحميل مرحلة ———
    load(level, opts) {
      opts = opts || {};
      this.L = level;
      this.hd = null; this.hdBmp = null; this.hdA = 0; this.wonT = 0; this.hdSweep = false;   // النسخة الناعمة (HD) اللي تظهر بعد الفوز
      this.art = !!level.art;   // وضع "اللوحة من أسهم": كل سهم بلون الرسمة تحته
      const W = this.W = level.W, H = this.H = level.H;
      this.occ = new Int32Array(W * H).fill(-1);
      this.arrows = level.arrows.map(a => {
        const pts = a.cells.map(c => [(c % W) + 0.5, ((c / W) | 0) + 0.5]);
        return { id: a.id, cells: a.cells, dir: a.dir, pts, alive: true, busy: false, cols: a.cells.map(c => level.color[c] || '#8890a0'),
          kind: a.kind || null, lit: false, fuse: 0, boom: false };
      });
      this.bombs = this.arrows.filter(a => a.kind === 'bomb');
      this.autoQ = []; this.zapN = 0;
      const sp = level.spec || {};
      this.fuseP = { K: sp.fuseK || 5, SL: sp.fuseSlack || 1.6, EX: sp.fuseExtra == null ? 4 : sp.fuseExtra };
      for (const a of this.arrows) for (const c of a.cells) this.occ[c] = a.id;
      this.reveal = new Float32Array(W * H);
      this.target = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        // في وضع الرسم بالأسهم: الخانات القليلة بدون أسهم تظهر بلونها من البداية حتى تكتمل الرسمة
        if (level.mask[i] && this.occ[i] < 0) { const v = this.art && !level.gem ? 1 : 0; this.reveal[i] = v; this.target[i] = v; }
      }
      // الخانات اليتيمة (بدون أسهم) بالوضع العادي: كل وحدة "تابعة" لأقرب سهم وتنكشف لما يطلع،
      // أو لما يمرّ رأس سهم فوقها وهو طالع
      this.orphan = new Uint8Array(W * H);
      this.orphOf = this.arrows.map(() => []);
      if (!this.art || level.gem) {
        const near = new Int32Array(W * H).fill(-1), q = [];
        for (let i = 0; i < W * H; i++) if (this.occ[i] >= 0) { near[i] = this.occ[i]; q.push(i); }
        for (let h = 0; h < q.length; h++) {
          const c = q[h], x = c % W, y = (c / W) | 0;
          for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const n = ny * W + nx; if (near[n] < 0) { near[n] = near[c]; q.push(n); }
          }
        }
        for (let i = 0; i < W * H; i++) if (level.mask[i] && this.occ[i] < 0) {
          this.orphan[i] = 1;
          if (near[i] >= 0) this.orphOf[near[i]].push(i); else this.target[i] = 1;
        }
      }
      // مسار شكل الرقعة وحدودها (للظل والإطار)
      this.maskPath = new Path2D();
      this.edgePath = new Path2D();
      const m = (x, y) => x >= 0 && y >= 0 && x < W && y < H && level.mask[y * W + x];
      for (let i = 0; i < W * H; i++) {
        if (!level.mask[i]) continue;
        const x = i % W, y = (i / W) | 0;
        this.maskPath.rect(x - 0.01, y - 0.01, 1.02, 1.02);
        if (!m(x, y - 1)) { this.edgePath.moveTo(x, y); this.edgePath.lineTo(x + 1, y); }
        if (!m(x, y + 1)) { this.edgePath.moveTo(x, y + 1); this.edgePath.lineTo(x + 1, y + 1); }
        if (!m(x - 1, y)) { this.edgePath.moveTo(x, y); this.edgePath.lineTo(x, y + 1); }
        if (!m(x + 1, y)) { this.edgePath.moveTo(x + 1, y); this.edgePath.lineTo(x + 1, y + 1); }
      }
      this.particles = []; this.rings = []; this.sweep = null; this.popFx = null;
      this.hot = 0; this.lastExitPt = null;
      this.total = this.arrows.length;
      this.left = this.total;
      this.hearts = opts.hearts == null ? 3 : opts.hearts;
      this.zen = !!opts.zen;
      this.over = false; this.won = false; this.winT = -1; this.loseT = -1;
      this.hint = null; this.lens = null; this.lensArmed = false; this.trace = null;
      this.flash = new Map(); this.shake = 0;
      this.anims = []; this.mistakes = 0; this.time = 0;
      this.resize();
      this._ignite(true);
    }

    resize() {
      const p = this.c.parentElement;
      const w = Math.max(1, p.clientWidth), h = Math.max(1, p.clientHeight);
      this.dpr = Math.min(2, root.devicePixelRatio || 1);   // 2 كافية للوضوح، و3 تضاعف شغل الجوال
      this.cw = w; this.ch = h;
      this.c.width = Math.round(w * this.dpr); this.c.height = Math.round(h * this.dpr);
      this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
      if (this.L) this.fit(false);
      this.kick();
    }

    fit(animated) {
      if (!this.L) return;
      const pad = 14;
      const s = Math.min((this.cw - pad * 2) / this.W, (this.ch - pad * 2) / this.H);
      this.fitS = s;
      const target = { s, ox: (this.cw - this.W * s) / 2, oy: (this.ch - this.H * s) / 2 };
      if (animated) this._animView(target); else { this.view = target; this.kick(); }
    }
    get zoomed() { return this.view.s > this.fitS * 1.03; }

    zoomAt(px, py, s) {
      const v = this.view;
      s = clamp(s, this.fitS, Math.max(this.fitS * 1.01, 64));
      const bx = (px - v.ox) / v.s, by = (py - v.oy) / v.s;
      this._animView(this._clampView({ s, ox: px - bx * s, oy: py - by * s }));
    }

    _clampView(v) {
      const bw = this.W * v.s, bh = this.H * v.s;
      if (bw <= this.cw) v.ox = (this.cw - bw) / 2; else v.ox = clamp(v.ox, this.cw - bw - 20, 20);
      if (bh <= this.ch) v.oy = (this.ch - bh) / 2; else v.oy = clamp(v.oy, this.ch - bh - 20, 20);
      return v;
    }

    _animView(to) {
      const from = Object.assign({}, this.view);
      this.anims = this.anims.filter(a => a.type !== 'view');
      this.anims.push({ type: 'view', from, to, t: 0, dur: 0.28 });
      this.kick();
    }

    // ——— المنطق ———
    cellXY(i) { return [i % this.W, (i / this.W) | 0]; }

    blockOf(a) {
      const h = a.cells[a.cells.length - 1];
      const [dx, dy] = DIRS[a.dir];
      let [x, y] = this.cellXY(h); x += dx; y += dy;
      let k = 1;
      while (x >= 0 && y >= 0 && x < this.W && y < this.H) {
        const o = this.occ[y * this.W + x];
        if (o >= 0 && o !== a.id) return { id: o, dist: k };
        x += dx; y += dy; k++;
      }
      return null;
    }

    freeArrows() { return this.arrows.filter(a => a.alive && !this.blockOf(a)); }

    pick(bx, by) {
      const cx = Math.floor(bx), cy = Math.floor(by);
      const ids = new Set();
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
        if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
        const o = this.occ[y * this.W + x];
        if (o >= 0) ids.add(o);
      }
      const res = [];
      for (const id of ids) {
        const a = this.arrows[id];
        let best = Infinity;
        const p = a.pts;
        if (p.length === 1) best = Math.hypot(bx - p[0][0], by - p[0][1]);
        for (let i = 0; i < p.length - 1; i++) best = Math.min(best, segDist(bx, by, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
        const hd = DIRS[a.dir], hp = p[p.length - 1];
        best = Math.min(best, Math.hypot(bx - (hp[0] + hd[0] * 0.3), by - (hp[1] + hd[1] * 0.3)));
        res.push({ a, d: best });
      }
      res.sort((x, y) => x.d - y.d);
      return res;
    }

    /** لمسة على الرقعة بإحداثيات الشاشة */
    tapAt(px, py) {
      if (!this.L || this.over || this.won) return;
      const v = this.view;
      const bx = (px - v.ox) / v.s, by = (py - v.oy) / v.s;
      this._ring(bx, by, 6, 30, 0.42, this.theme.accent, 2, 0.45);
      const cand = this.pick(bx, by);
      const tol = Math.max(0.72, 16 / v.s);
      if (!cand.length || cand[0].d > tol) return;
      // حماية من اللمس الخاطئ: إذا كان سهمان قريبين جداً والرقعة صغيرة، نكبّر بدل المخاطرة بقلب
      // على الرقع الكبيرة كتير (خانة أصغر من 12px) الحماية شغّالة دائماً، لأن الإصبع أعرض من السهم
      if ((this.safeTap !== false ? v.s < 26 : v.s < 12) && cand.length > 1 && (cand[1].d - cand[0].d) < 0.28 && !this.lensArmed) {
        this.zoomAt(px, py, 40);
        if (this.h.onAutoZoom) this.h.onAutoZoom();
        return;
      }
      this.tapArrow(cand[0].a.id);
    }

    tapArrow(id) {
      const a = this.arrows[id];
      if (!a || !a.alive || this.over || this.won) return;
      const block = this.blockOf(a);
      if (this.lensArmed) {
        this.lensArmed = false;
        this.lens = { id, block, t: 2.6 };
        if (this.h.onLens) this.h.onLens(!block);
        this.kick();
        return;
      }
      if (this.hint && this.hint.id === id) this.hint = null;
      if (this.lens) this.lens = null;
      if (!block) this._exit(a); else this._bump(a, block);
    }

    /** كل الأسهم يلي لازم تطلع قبل هالسهم (يلي عطريقه، ويلي عطريقهم، وهكذا) */
    _ancestors(a) {
      const W = this.W, H = this.H, out = new Set(), st = [a];
      while (st.length) {
        const x = st.pop(), h = x.cells[x.cells.length - 1], [dx, dy] = DIRS[x.dir];
        for (let cx = h % W + dx, cy = ((h / W) | 0) + dy; cx >= 0 && cy >= 0 && cx < W && cy < H; cx += dx, cy += dy) {
          const o = this.occ[cy * W + cx];
          if (o >= 0 && o !== x.id && o !== a.id && !out.has(o)) { out.add(o); st.push(this.arrows[o]); }
        }
      }
      return out;
    }

    /** القنبلة النايمة بتشتعل لما يضل قدامها K أسهم أو أقل. العدّاد بيكفي دائماً للحل المثالي:
     *  (كل يلي لازم يطلع قبلها وقبل القنابل المشتعلة + القنابل نفسها) × هامش + زيادة. */
    _ignite(start) {
      if (!this.bombs.length || this.over || this.won) return;
      const P = this.fuseP;
      for (const b of this.bombs) {
        if (!b.alive || b.lit || b.boom) continue;
        const A = this._ancestors(b);
        if (A.size > P.K) continue;
        const U = new Set(A); U.add(b.id);
        for (const o of this.bombs) if (o !== b && o.alive && o.lit && o.fuse > 0) { this._ancestors(o).forEach(x => U.add(x)); U.add(o.id); }
        b.lit = true; b.fuse = Math.ceil(U.size * P.SL) + P.EX;
        if (!start) { const p = b.pts[(b.pts.length - 1) >> 1]; this._ring(p[0], p[1], 10, 80, 0.7, '#ff4d67', 4, 0.9); this._ring(p[0], p[1], 6, 46, 0.5, '#ffffff', 3, 0.7); }
        if (this.h.onIgnite) this.h.onIgnite(b, !!start);
      }
    }

    /** أسهم البرق يلي فضي طريقها بتنحط بالدور وبتنطلق لحالها ورا بعض */
    _scanBolts() {
      if (this.over || this.won) return;
      for (const a of this.arrows) {
        if (!a.alive || a.kind !== 'bolt' || a.busy || this.autoQ.some(q => q.id === a.id)) continue;
        if (!this.blockOf(a)) this.autoQ.push({ id: a.id, t: 0.26 + this.autoQ.length * 0.1 });
      }
    }

    _explode(b) {
      b.fuse = 0; b.boom = true;       // انفجرت: بتضل سهم عادي "محروق" وبتطلع متل غيرها
      if (!this.zen) this.hearts = Math.max(0, this.hearts - 1);
      this.mistakes++;
      this.flash.set(b.id, 0.9); this.shake = 0.42;
      const p = b.pts[(b.pts.length - 1) >> 1], s = this.view.s;
      const cols = ['#ff4d67', '#ff9f1c', '#ffd166', '#2b2d42', '#ffffff'];
      for (let i = 0; i < 30; i++) {
        const an = (i / 30) * Math.PI * 2 + Math.random() * 0.4, spd = (140 + Math.random() * 220) / s, life = 0.5 + Math.random() * 0.5;
        this.particles.push({ kind: i % 4 ? 'spark' : 'star', x: p[0], y: p[1], vx: Math.cos(an) * spd, vy: Math.sin(an) * spd, drag: 3, g: 30 / s,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, s: (2.5 + Math.random() * 4) / s, life, life0: life, c: cols[i % cols.length] });
      }
      this._ring(p[0], p[1], 8, 120, 0.6, '#ff4d67', 6, 0.9);
      this._ring(p[0], p[1], 4, 70, 0.45, '#ffd166', 4, 0.8);
      if (this.hearts <= 0 && !this.zen) this.over = true;
      if (this.h.onBomb) this.h.onBomb(this.hearts, b);
    }

    /** auto = سهم برق انطلق لحاله (ما بينحسب حركة على عدّاد القنابل) */
    _exit(a, auto) {
      a.alive = false;
      for (const c of a.cells) this.occ[c] = -1;
      this.left--;
      if (this.autoQ.length) this.autoQ = this.autoQ.filter(q => q.id !== a.id);
      const [dx, dy] = DIRS[a.dir];
      const hp = a.pts[a.pts.length - 1];
      // مسافة الخروج: حتى يغادر الذيل حدود الرقعة
      let toEdge = a.dir === 0 ? this.W - hp[0] : a.dir === 2 ? hp[0] : a.dir === 1 ? this.H - hp[1] : hp[1];
      const n = a.pts.length - 1;
      const dist = Math.ceil(toEdge) + n + 2;
      const E = a.pts.slice();
      for (let k = 1; k <= dist + 1; k++) E.push([hp[0] + dx * k, hp[1] + dy * k]);
      const dur = clamp(0.28 + dist * 0.016, 0.34, 0.85);
      const cols = a.cells.map(c => this.L.color[c]).filter(Boolean);
      this.lastExitPt = hp;
      const an = { type: 'exit', a, E, n, dist, t: 0, dur, revealed: 0, edgeU: toEdge, cols, hot: 0, zap: !!auto };
      this.anims.push(an);
      if (auto) this._ring(hp[0], hp[1], 6, 44, 0.4, ZAP, 4, 0.9);
      // القنابل: القنبلة يلي طلعت قبل الصفر تفكّكت، وكل حركة من اللاعب بتنقّص عدّاد الباقي
      let defused = 0;
      if (a.kind === 'bomb' && a.lit && a.fuse > 0) { defused = a.fuse; a.fuse = 0; }
      if (!auto) for (const b of this.bombs) if (b.alive && b.lit && b.fuse > 0 && --b.fuse === 0) this._explode(b);
      this.zapN = auto ? this.zapN + 1 : 0;
      if (this.h.onExit) this.h.onExit(this.left, this.total, { auto: !!auto, chain: this.zapN, defused, bomb: a.kind === 'bomb' });
      an.hot = this.hot;   // التطبيق يحدّث مستوى السلسلة داخل onExit
      this._ignite(false);
      this._scanBolts();
      this.kick();
    }

    _bump(a, block) {
      a.busy = true;
      const [dx, dy] = DIRS[a.dir];
      const hp = a.pts[a.pts.length - 1];
      const E = a.pts.slice();
      for (let k = 1; k <= block.dist + 1; k++) E.push([hp[0] + dx * k, hp[1] + dy * k]);
      const m = block.dist - 1 + 0.32;
      this.anims.push({ type: 'bump', a, E, n: a.pts.length - 1, m, t: 0, dur: clamp(0.3 + m * 0.03, 0.32, 0.6), hit: false, block });
      if (!this.zen) this.hearts = Math.max(0, this.hearts - 1);
      this.mistakes++;
      if (this.hearts <= 0 && !this.zen) this.over = true;
      this.kick();
    }

    addHearts(n) { this.hearts += n; this.over = false; this.loseT = -1; this._ignite(false); this._scanBolts(); this.kick(); }

    /** أقرب قنبلة مشتعلة للانفجار (أو null) */
    urgentBomb() {
      let best = null;
      for (const b of this.bombs) if (b.alive && b.lit && b.fuse > 0 && (!best || b.fuse < best.fuse)) best = b;
      return best;
    }

    /** الأسهم الحرة يلي بتقرّب القنبلة من الطلوع (أو القنبلة نفسها إذا صار طريقها فاضي) */
    bombMoves(b) {
      const A = this._ancestors(b);
      return this.freeArrows().filter(a => !a.busy && (a === b || A.has(a.id)));
    }

    /** ينقل الكاميرا لسهم (زر القنبلة بالشريط العلوي) */
    focusArrow(id) {
      const a = this.arrows[id];
      if (!a || !a.alive) return;
      const p = a.pts[(a.pts.length - 1) >> 1];
      const s = this.fitS >= 20 ? this.view.s : Math.max(this.view.s, 30);
      if (s > this.fitS * 1.03) this._animView(this._clampView({ s, ox: this.cw / 2 - p[0] * s, oy: this.ch / 2 - p[1] * s }));
      this._ring(p[0], p[1], 10, 70, 0.7, '#ff4d67', 4, 0.9);
    }

    // ——— حفظ المرحلة والرجوع لها ———
    snapshot() {
      const gone = [], fuse = {};
      for (const a of this.arrows) if (!a.alive) gone.push(a.id);
      for (const b of this.bombs) fuse[b.id] = [b.lit ? 1 : 0, b.fuse, b.boom ? 1 : 0];
      return { gone, fuse, hearts: this.hearts, mistakes: this.mistakes };
    }
    restore(st) {
      const W = this.W, H = this.H, gone = new Set(st.gone || []);
      for (const a of this.arrows) {
        if (!gone.has(a.id)) continue;
        a.alive = false; this.left--;
        for (const c of a.cells) { this.occ[c] = -1; this.target[c] = 1; }
        for (const c of this.orphOf[a.id] || []) this.target[c] = 1;
        const h = a.cells[a.cells.length - 1], [dx, dy] = DIRS[a.dir];
        for (let x = h % W + dx, y = ((h / W) | 0) + dy; x >= 0 && y >= 0 && x < W && y < H; x += dx, y += dy) if (this.orphan[y * W + x]) this.target[y * W + x] = 1;
      }
      for (const b of this.bombs) { const f = st.fuse && st.fuse[b.id]; if (f) { b.lit = !!f[0]; b.fuse = f[1] | 0; b.boom = !!f[2]; } }
      this.reveal.set(this.target);
      this.hearts = st.hearts; this.mistakes = st.mistakes || 0;
      if (this.hearts <= 0 && !this.zen) this.over = true;
      this._ignite(true); this._scanBolts();
      this.kick();
    }

    useHint() {
      let free = this.freeArrows().filter(a => !a.busy);
      if (!free.length) return false;
      const ub = this.urgentBomb();
      if (ub) { const bm = this.bombMoves(ub); if (bm.length) free = bm; }
      // نفضّل السهم الذي يحرّر أكبر عدد من الأسهم الأخرى
      let best = free[0], bestScore = -1;
      for (const a of free) {
        let score = 0;
        for (const b of this.arrows) {
          if (!b.alive || b === a) continue;
          const bl = this.blockOf(b);
          if (bl && bl.id === a.id) score++;
        }
        if (score > bestScore) { bestScore = score; best = a; }
      }
      this.hint = { id: best.id, t: 8 };
      // إذا كانت الرقعة مكبّرة ننقل الكاميرا للسهم
      if (this.zoomed) {
        const p = best.pts[best.pts.length - 1];
        const v = this.view;
        this._animView(this._clampView({ s: v.s, ox: this.cw / 2 - p[0] * v.s, oy: this.ch / 2 - p[1] * v.s }));
      }
      this.kick();
      return true;
    }

    armLens(on) { this.lensArmed = on; this.kick(); }

    // ——— حلقة الرسم ———
    kick() { if (!this.raf) this.raf = requestAnimationFrame(t => this._frame(t)); }

    _frame(t) {
      this.raf = 0;
      const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0.016;
      this.last = t;
      const busy = this._step(dt);
      this._draw();
      if (busy) this.kick(); else this.last = 0;
    }

    _step(dt) {
      if (!this.L) return false;
      this.time += dt;
      let busy = false, rescan = false;
      const keep = [];
      for (const an of this.anims) {
        an.t += dt;
        const p = Math.min(1, an.t / an.dur);
        if (an.type === 'view') {
          const e = easeOut(p);
          this.view = { s: an.from.s + (an.to.s - an.from.s) * e, ox: an.from.ox + (an.to.ox - an.from.ox) * e, oy: an.from.oy + (an.to.oy - an.from.oy) * e };
        } else if (an.type === 'exit') {
          const u = an.dist * (0.3 * p + 0.7 * p * p);
          an.u = u;
          while (an.revealed <= an.n && u > an.revealed + 0.35) {
            this.target[an.a.cells[an.revealed]] = 1;
            an.revealed++;
          }
          if (p >= 1) for (const c of an.a.cells) this.target[c] = 1;
          // رأس السهم يمسح الخانات اليتيمة اللي يمرّ فوقها
          if (an.pk == null) an.pk = 1;
          while (an.pk < 1e4 && u > an.pk - 0.3) {
            const hc = an.a.cells[an.a.cells.length - 1], [dx, dy] = DIRS[an.a.dir];
            const x = hc % this.W + dx * an.pk, y = ((hc / this.W) | 0) + dy * an.pk;
            if (x < 0 || y < 0 || x >= this.W || y >= this.H) { an.pk = 1e4; break; }
            if (this.orphan[y * this.W + x]) this.target[y * this.W + x] = 1;
            an.pk++;
          }
          if (p >= 1) for (const c of this.orphOf[an.a.id] || []) this.target[c] = 1;
          if (!an.burst && u >= an.edgeU) {
            an.burst = true;
            const [dx, dy] = DIRS[an.a.dir], hp = an.a.pts[an.a.pts.length - 1];
            this._sparks(hp[0] + dx * an.edgeU, hp[1] + dy * an.edgeU, an.a.dir, an.cols, an.hot ? 14 : 9);
          }
        } else if (an.type === 'bump') {
          const k = 0.42;
          an.u = p < k ? an.m * easeOut(p / k) : an.m * (1 - easeInOut((p - k) / (1 - k)));
          if (!an.hit && p >= k * 0.85) {
            an.hit = true;
            this.flash.set(an.a.id, 0.7);
            this.flash.set(an.block.id, 0.7);
            this.shake = 0.3;
            if (this.h.onMistake) this.h.onMistake(this.hearts);
          }
          if (p >= 1) { an.a.busy = false; rescan = true; }
        }
        if (p < 1) keep.push(an);
      }
      this.anims = keep;
      if (rescan) this._scanBolts();
      // أسهم البرق: كل واحد بدوره (بعد ما خلصت حلقة الحركات، لأن الخروج بيضيف حركة جديدة)
      if (this.autoQ.length && !this.over) {
        for (const q of this.autoQ) q.t -= dt;
        const due = this.autoQ.filter(q => q.t <= 0);
        if (due.length) {
          this.autoQ = this.autoQ.filter(q => q.t > 0);
          for (const q of due) { const a = this.arrows[q.id]; if (a.alive && !a.busy && !this.blockOf(a)) this._exit(a, true); }
        }
        busy = true;
      }
      if (this.anims.length) busy = true;
      // قنبلة عالآخر بتنبض ← رسم مستمر
      if (!this.won && this.bombs.length && this.bombs.some(b => b.alive && b.lit && b.fuse > 0 && b.fuse <= 3)) busy = true;

      // كشف اللوحة تدريجياً
      for (let i = 0; i < this.reveal.length; i++) {
        const r = this.reveal[i], tg = this.target[i];
        if (r !== tg) {
          const nr = r < tg ? Math.min(tg, r + dt * 3.2) : Math.max(tg, r - dt * 3.2);
          this.reveal[i] = nr; busy = true;
        }
      }
      for (const [id, v] of this.flash) { const nv = v - dt; if (nv <= 0) this.flash.delete(id); else this.flash.set(id, nv); busy = true; }
      if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt); busy = true; }
      if (this.hint) { this.hint.t -= dt; if (this.hint.t <= 0 || !this.arrows[this.hint.id].alive) this.hint = null; else busy = true; }
      if (this.lens) { this.lens.t -= dt; if (this.lens.t <= 0) this.lens = null; else busy = true; }
      if (this.lensArmed || this.trace != null) busy = true;
      // ستايلات متحركة (ذهب، حمم، قوس قزح، مجرّة، صواريخ) تحتاج رسم مستمر
      if (!this.won && !document.hidden && (this.L.gem ? (this.packSkin != null ? this.packSkin : this.L.skin) % SKINS.length === 10 : !this.art && this.trail && TRAILS[this.trail % TRAILS.length].anim)) busy = true;

      // الفوز
      const exiting = this.anims.some(a => a.type === 'exit');
      if (this.left === 0 && !this.won && !exiting) {
        this.won = true;
        for (let i = 0; i < this.target.length; i++) if (this.L.mask[i]) this.target[i] = 1;
        this.winT = this.hd ? 2.5 : 1.9; busy = true;
        this.sweep = { t: 0, dur: 1.1, a: 0.6 };
        if (!this.hd) this.popFx = { t: 0, dur: 0.55, amp: 0.045 };
        this._confetti();
      }
      if (this.won && this.hd && this.hd._ready && this.hdA < 1) {
        // البكسلات تذوب وتطلع مكانها اللوحة الحقيقية
        this.wonT += dt;
        this.hdA = clamp((this.wonT - 0.55) / 0.9, 0, 1);
        if (this.hdA > 0 && !this.hdSweep) { this.hdSweep = true; this.sweep = { t: 0, dur: 1.2, a: 0.55 }; }
        busy = true;
      }
      if (this.sweep) { this.sweep.t += dt; if (this.sweep.t > this.sweep.dur + 0.3) this.sweep = null; else busy = true; }
      if (this.popFx) { this.popFx.t += dt; if (this.popFx.t > this.popFx.dur) this.popFx = null; else busy = true; }
      if (this.rings.length) {
        for (const r of this.rings) r.t += dt;
        this.rings = this.rings.filter(r => r.t < r.dur);
        busy = true;
      }
      if (this.particles.length) {
        for (const p of this.particles) {
          if (p.kind) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.vy += (p.g || 0) * dt; }
          else p.vy += 26 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt;
        }
        this.particles = this.particles.filter(p => p.life > 0);
        busy = true;
      }
      if (this.winT > 0) { this.winT -= dt; busy = true; if (this.winT <= 0) { this.winT = -1; if (this.h.onWin) this.h.onWin(); } }
      // الخسارة
      if (this.over && this.loseT < 0 && !this.anims.some(a => a.type === 'bump')) this.loseT = 0.35;
      if (this.over && this.loseT > 0) { this.loseT -= dt; busy = true; if (this.loseT <= 0) { this.loseT = 0; if (this.h.onLose) this.h.onLose(); } }
      return busy;
    }

    _draw() {
      const ctx = this.ctx, th = this.theme;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.cw, this.ch);   // شفاف: خلفية الشاشة المرسومة تبين من ورا الرقعة
      if (!this.L) return;
      const v = this.view, W = this.W, H = this.H, L = this.L;
      const sh = this.shake > 0 ? Math.sin(this.time * 70) * 6 * (this.shake / 0.3) : 0;
      this._sh = sh;
      ctx.translate(v.ox + sh, v.oy);
      ctx.scale(v.s, v.s);
      if (this.popFx) {
        const p = Math.min(1, this.popFx.t / this.popFx.dur);
        const k = 1 + this.popFx.amp * Math.sin(Math.PI * p) * (1 - 0.4 * p);
        ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
      }

      const fade = 1 - (this.hdA || 0);
      // إذا الصورة الناعمة ظاهرة بالكامل، ما نرسم البكسلات تحتها (أسرع بكثير)
      const skipPixels = fade < 0.02;
      if (!skipPixels) {
      ctx.globalAlpha = fade;
      // ظل ناعم تحت الرقعة
      ctx.save();
      ctx.translate(0.14, 0.22);
      ctx.fillStyle = th.shadow || 'rgba(20,25,60,0.10)';
      ctx.fill(this.maskPath);
      ctx.restore();
      // أرضية الرقعة
      ctx.fillStyle = th.cell;
      ctx.fill(this.maskPath);
      // اللوحة: طيف خفيف تحت الأسهم + الخانات المكشوفة بألوانها الكاملة
      const ghost = L.gem ? 0.2 : this.art ? 0.3 : th.ghost == null ? 0.13 : th.ghost;
      for (let i = 0; i < W * H; i++) {
        if (!L.mask[i]) continue;
        const r = Math.max(ghost, this.reveal[i]);
        if (r <= 0.001) continue;
        const x = i % W, y = (i / W) | 0;
        ctx.globalAlpha = Math.min(1, r) * fade;
        ctx.fillStyle = L.color[i];
        if (r >= 0.999) {
          ctx.fillRect(x - 0.01, y - 0.01, 1.02, 1.02);   // بكسل متصل بدون فراغات
        } else if (this.reveal[i] <= ghost) {
          ctx.fillRect(x, y, 1, 1);                         // الطيف الخفيف
        } else {
          const e = easeOut((r - FADE) / (1 - FADE));
          const sz = 0.6 + 0.42 * e, off = (1 - sz) / 2;
          roundRect(ctx, x + off, y + off, sz, sz, 0.25 * sz * (1 - e));
          ctx.fill();
        }
      }
      ctx.globalAlpha = fade;
      // إطار شكل الرقعة
      ctx.strokeStyle = th.edge || th.cell;
      ctx.lineWidth = Math.max(0.06, 1.2 / v.s);
      ctx.lineCap = 'round';
      ctx.stroke(this.edgePath);
      ctx.globalAlpha = 1;
      } // end skipPixels
      if (this.hdA > 0) {
        const e = easeOut(this.hdA), k = 0.94 + 0.06 * e;
        ctx.save();
        ctx.globalAlpha = e;
        ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
        ctx.drawImage(this.hdBmp || this.hd, 0, 0, W, H);   // ImageBitmap: محفوظة على كرت الشاشة، ما بتنرفع كل فريم
        ctx.restore();
      }
      // نقاط خفيفة على الخانات الفارغة
      ctx.fillStyle = th.dot || th.ink;
      ctx.globalAlpha = 0.16;
      for (let i = 0; i < W * H; i++) {
        if (this.art || !L.mask[i] || this.occ[i] >= 0 || this.reveal[i] > FADE + 0.05) continue;
        const x = i % W, y = (i / W) | 0;
        ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, 0.07, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const lw = Math.max(LINE, 2 / v.s);
      const animIds = new Set(this.anims.filter(a => a.a).map(a => a.a.id));
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 7);

      // الأسهم الثابتة
      if (L.gem) this._gemArrows(animIds, pulse);
      else if (this.art) this._artArrows(v, animIds, pulse);
      else if (this.trail) this._trailArrows(lw, animIds, pulse);
      else for (const a of this.arrows) {
        if (!a.alive || animIds.has(a.id)) continue;
        let col = th.ink, w = lw;
        if (a.kind) { col = a.kind === 'bolt' ? BOLT_INK : this._kindCol(a).b; w = lw * 1.5; }
        if (this.flash.has(a.id)) col = th.danger;
        if (this.trace === a.id) { col = th.accent; w = lw * 1.6; }
        if (this.hint && this.hint.id === a.id) {
          ctx.strokeStyle = th.accent; ctx.globalAlpha = 0.25 + 0.3 * pulse; ctx.lineWidth = lw * 3.4;
          strokePoly(ctx, a.pts);
          ctx.globalAlpha = 1; col = th.accent;
        }
        if (this.lens && this.lens.block && this.lens.block.id === a.id) col = th.danger;
        if (this.lens && this.lens.id === a.id) col = this.lens.block ? th.danger : th.ok;
        this._arrow(a.pts, a.dir, col, w);
      }
      // الأسهم المتحركة
      for (const an of this.anims) {
        if (an.type !== 'exit' && an.type !== 'bump') continue;
        const u = an.u || 0;
        let alpha = 1;
        if (an.type === 'exit') alpha = clamp(1.6 - (u / an.dist) * 1.6 + 0.6, 0, 1);
        const hc = an.zap ? ZAP : an.hot ? HOT[Math.min(HOT.length, an.hot) - 1] : null;
        if (an.type === 'exit' && u > 0.05) {
          // ذيل حركة خلف السهم (أعرض وملوّن أثناء السلسلة)
          const L0 = hc ? 3.2 : 1.8, tw = hc ? lw * 2.2 : lw * 1.3;
          ctx.strokeStyle = hc || th.ink; ctx.lineWidth = tw;
          for (let k = 0; k < 4; k++) {
            const a0 = Math.max(0, u - L0 + (L0 * k) / 4), a1 = Math.max(0, u - L0 + (L0 * (k + 1)) / 4);
            if (a1 - a0 < 0.02) continue;
            ctx.globalAlpha = alpha * (hc ? 0.11 : 0.05) * (k + 1);
            strokePoly(ctx, subPath(an.E, a0, a1));
          }
        }
        ctx.globalAlpha = alpha;
        if (L.gem) {
          const [dx, dy] = DIRS[an.a.dir], ov = an.type === 'bump' && this.flash.has(an.a.id) ? th.danger : null;
          this._gemBatch([{ a: an.a, ox: dx * u, oy: dy * u, col: ov }]);
          ctx.globalAlpha = 1;
          continue;
        }
        if (this.art) {
          this._artMoving(an, u, v, an.type === 'bump' && this.flash.has(an.a.id) ? th.danger : null);
          ctx.globalAlpha = 1;
          continue;
        }
        const col = an.type === 'bump' && this.flash.has(an.a.id) ? th.danger : (hc || th.ink);
        const sub = subPath(an.E, u, u + an.n);
        const kc = an.a.kind ? this._kindCol(an.a) : null;
        if (this.trail) {
          const tc = col !== th.ink ? { b: col, e: edgeOf(col), h: lightOf(col) } : (kc || this._trailCol(an.a));
          this._tube(sub, an.a.dir, tc, kc ? lw * 1.12 : lw);
        } else this._arrow(sub, an.a.dir, col === th.ink && kc ? (an.a.kind === 'bolt' ? BOLT_INK : kc.b) : col, kc ? lw * 1.5 : lw);
        ctx.globalAlpha = 1;
      }
      // علامات العناصر الخاصة (برق / قنبلة) ومسار القنبلة المشتعلة
      this._specials(lw, animIds);
      // العدسة
      if (this.lens) this._drawLens(lw);
      // لمعة الفوز تمر على اللوحة (باستخدام source-atop السريع بدون قص مسارات ثقيل)
      if (this.sweep) {
        const p = Math.min(1, this.sweep.t / this.sweep.dur);
        const dx = 0.86, dy = 0.5, Lh = (W + H) * 0.75;
        const cx = W / 2 + dx * (-Lh + 2 * Lh * easeInOut(p)), cy = H / 2 + dy * (-Lh + 2 * Lh * easeInOut(p));
        const g = ctx.createLinearGradient(cx - dx * 3, cy - dy * 3, cx + dx * 3, cy + dy * 3);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,' + this.sweep.a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      // حلقات (لمسة / سلسلة)
      for (const r of this.rings) {
        const p = r.t / r.dur, e = easeOut(p);
        ctx.globalAlpha = r.a * (1 - p);
        ctx.strokeStyle = r.col; ctx.lineWidth = r.w / v.s;
        ctx.beginPath(); ctx.arc(r.x, r.y, (r.r0 + (r.r1 - r.r0) * e) / v.s, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // شرارات وقصاصات
      for (const pt of this.particles) {
        ctx.save();
        const fade = Math.min(1, pt.life / 0.4);
        ctx.globalAlpha = fade;
        ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot);
        ctx.fillStyle = pt.c;
        if (pt.kind === 'spark') {
          const r = pt.s * (0.35 + 0.65 * Math.min(1, pt.life / pt.life0));
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        } else if (pt.kind === 'star') {
          const r = pt.s * (0.4 + 0.6 * Math.min(1, pt.life / pt.life0));
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const rr = k % 2 ? r * 0.38 : r, an = (k * Math.PI) / 4;
            ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
          }
          ctx.closePath(); ctx.fill();
        } else if (pt.shape === 'heart') {
          const r = pt.s * 0.5;
          ctx.rotate(-pt.rot + Math.sin(pt.rot) * 0.4);
          ctx.beginPath();
          ctx.arc(-r * 0.48, -r * 0.15, r * 0.52, Math.PI, 0);
          ctx.arc(r * 0.48, -r * 0.15, r * 0.52, Math.PI, 0);
          ctx.lineTo(0, r * 0.95); ctx.closePath(); ctx.fill();
        } else ctx.fillRect(-pt.s / 2, -pt.s * 0.3, pt.s, pt.s * 0.6);
        ctx.restore();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /** حلقة تتوسع (أنصاف الأقطار والسماكة بالبكسل) */
    _ring(x, y, r0, r1, dur, col, w, a) { this.rings.push({ x, y, r0, r1, dur, col, w, a, t: 0 }); this.kick(); }

    /** شرارات عند خروج السهم من حافة الرقعة، بألوان الخانات التي كشفها */
    _sparks(x, y, dir, cols, n) {
      const s = this.view.s, [dx, dy] = DIRS[dir];
      const base = Math.atan2(dy, dx);
      for (let i = 0; i < n; i++) {
        const an = base + (Math.random() - 0.5) * 2.1, sp = (70 + Math.random() * 150) / s;
        const life = 0.45 + Math.random() * 0.4;
        this.particles.push({
          kind: Math.random() < 0.25 ? 'star' : 'spark', x, y,
          vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, drag: 3.2, g: 0,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
          s: (1.8 + Math.random() * 2.6) / s, life, life0: life,
          c: Math.random() < 0.2 ? '#ffffff' : (cols[(Math.random() * cols.length) | 0] || this.theme.accent),
        });
      }
      this.kick();
    }

    /** احتفال سلسلة صحيحة: نجوم وحلقات عند آخر سهم خرج + نبضة للرقعة */
    celebrate(tier) {
      if (!this.L) return;
      const p = this.lastExitPt || [this.W / 2, this.H / 2];
      const s = this.view.s;
      const cols = ['#ffd166', '#ff9f1c', '#ef476f', '#06d6a0', '#4cc9f0', '#9b5de5'];
      const n = 12 + Math.min(5, tier) * 3;
      for (let i = 0; i < n; i++) {
        const an = (i / n) * Math.PI * 2 + Math.random() * 0.3, sp = (120 + Math.random() * 120 + tier * 20) / s;
        const life = 0.6 + Math.random() * 0.4;
        this.particles.push({
          kind: i % 3 ? 'star' : 'spark', x: p[0], y: p[1],
          vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, drag: 2.6, g: 40 / s,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
          s: (3 + Math.random() * 3) / s, life, life0: life,
          c: cols[(i + tier) % cols.length],
        });
      }
      const col = HOT[Math.min(HOT.length - 1, tier >> 1)];
      this._ring(p[0], p[1], 8, 70 + tier * 10, 0.6, col, 4, 0.8);
      this._ring(p[0], p[1], 4, 40 + tier * 6, 0.5, '#ffffff', 3, 0.7);
      this.popFx = { t: 0, dur: 0.32, amp: 0.012 + Math.min(4, tier) * 0.004 };
      if (tier >= 2) this.sweep = { t: 0, dur: 0.9, a: 0.3 };
    }

    /** لمعة خفيفة تمر على الرقعة (تنبيه لطيف عند الخمول) */
    shimmer() { if (this.L && !this.won) { this.sweep = { t: 0, dur: 1.5, a: 0.32 }; this.kick(); } }

    setHot(h) { this.hot = h; }
    /** يوقف كل المؤثرات (لما تنفتح نافذة الفوز) كي ما يضل الكانفس يترسم تحتها */
    calm() { this.particles = []; this.rings = []; this.sweep = null; this.popFx = null; if (this.hd) this.hdA = 1; this.kick(); }

    _confetti() {
      const love = this.L.spec && this.L.spec.love;
      let cols = [];
      for (let i = 0; i < this.L.color.length; i++) if (this.L.color[i]) cols.push(this.L.color[i]);
      if (love) cols = ['#e5383b', '#ff4d6d', '#ff8fab', '#ffb3c1', '#c9184a'];
      const k = Math.max(this.W, this.H);
      for (let i = 0; i < 32; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = (0.5 + Math.random() * 0.7) * k * 1.1;
        this.particles.push({
          x: this.W / 2 + (Math.random() - 0.5) * this.W * 0.3, y: this.H * 0.55,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
          s: k * (love ? 0.045 + Math.random() * 0.03 : 0.025 + Math.random() * 0.025), life: 1.4 + Math.random() * 0.8,
          c: cols[(Math.random() * cols.length) | 0] || '#ffd166', shape: love ? 'heart' : null,
        });
      }
    }

    _arrow(pts, dir, col, lw) {
      const ctx = this.ctx;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
      strokePoly(ctx, pts);
      const [dx, dy] = DIRS[dir];
      const p = pts[pts.length - 1];
      const hs = Math.max(HEAD, lw * 2.1);
      const tipX = p[0] + dx * hs * 1.05, tipY = p[1] + dy * hs * 1.05;
      const bx = p[0] - dx * hs * 0.25, by = p[1] - dy * hs * 0.25;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(bx - dy * hs * 0.72, by + dx * hs * 0.72);
      ctx.lineTo(bx + dy * hs * 0.72, by - dx * hs * 0.72);
      ctx.closePath();
      ctx.lineWidth = lw * 0.6;
      ctx.fill(); ctx.stroke();
    }

    // ——— العناصر الخاصة: اللون والعلامات ———
    _kindCol(a) {
      if (a.kind === 'bolt') return BOLT_C;
      if (a.boom) return BURNT_C;
      if (!a.lit) return BOMB_C;
      return a.fuse <= 3 && Math.sin(this.time * 9) > 0 ? BOMB_HOT : BOMB_LIT;
    }
    _specials(lw, animIds) {
      const ctx = this.ctx, v = this.view;
      let any = false;
      for (const a of this.arrows) if (a.alive && a.kind && !a.boom) { any = true; break; }
      if (!any) return;
      // مسار القنبلة المشتعلة: خط أحمر منقّط لحد أول سهم سادد طريقها (اللاعب بيعرف من وين يبلّش)
      for (const b of this.bombs) {
        if (!b.alive || !b.lit || b.fuse <= 0 || animIds.has(b.id)) continue;
        const [dx, dy] = DIRS[b.dir], p = b.pts[b.pts.length - 1], bl = this.blockOf(b);
        const len = bl ? bl.dist - 0.5 : (b.dir === 0 ? this.W - p[0] : b.dir === 2 ? p[0] : b.dir === 1 ? this.H - p[1] : p[1]) + 0.5;
        ctx.globalAlpha = 0.65; ctx.strokeStyle = bl ? '#e11d48' : '#10b981'; ctx.lineWidth = Math.max(lw * 0.8, 1.6 / v.s);
        ctx.setLineDash([0.2, 0.2]);
        ctx.beginPath(); ctx.moveTo(p[0] + dx * 0.45, p[1] + dy * 0.45); ctx.lineTo(p[0] + dx * len, p[1] + dy * len); ctx.stroke();
        ctx.setLineDash([]);
        if (bl) { ctx.beginPath(); ctx.arc(p[0] + dx * (len + 0.5), p[1] + dy * (len + 0.5), 0.42, 0, 7); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      // العلامات بإحداثيات الشاشة: بتضل مقروءة حتى لو الخانة صغيرة كتير
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const a of this.arrows) {
        if (!a.alive || !a.kind || a.boom || animIds.has(a.id)) continue;
        const bomb = a.kind === 'bomb';
        const q = bomb ? a.pts[(a.pts.length - 1) >> 1] : a.pts[0];
        const x = v.ox + (this._sh || 0) + q[0] * v.s, y = v.oy + q[1] * v.s;
        if (x < -30 || y < -30 || x > this.cw + 30 || y > this.ch + 30) continue;
        if (!bomb) {
          const r = clamp(v.s * 0.36, 6, 11), k = (r * 1.5) / 24;
          ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = '#fff6c2'; ctx.fill();
          ctx.lineWidth = 1.3; ctx.strokeStyle = '#a86a00'; ctx.stroke();
          ctx.beginPath();
          BOLT_GLYPH.forEach((g, i) => { const gx = x + (g[0] - 12) * k, gy = y + (g[1] - 12) * k; if (i) ctx.lineTo(gx, gy); else ctx.moveTo(gx, gy); });
          ctx.closePath(); ctx.fillStyle = '#e08a00'; ctx.fill();
          continue;
        }
        const lit = a.lit && a.fuse > 0, hot = lit && a.fuse <= 3;
        const r = (lit ? clamp(v.s * 0.46, 9, 15) : clamp(v.s * 0.36, 6.5, 11)) * (hot ? 1 + 0.12 * Math.sin(this.time * 9) : 1);
        // فتيل القنبلة
        ctx.strokeStyle = lit ? '#7a4a12' : '#6b6f86'; ctx.lineWidth = Math.max(1.4, r * 0.18);
        ctx.beginPath(); ctx.moveTo(x + r * 0.5, y - r * 0.72); ctx.quadraticCurveTo(x + r * 0.95, y - r * 1.25, x + r * 1.15, y - r * 0.95); ctx.stroke();
        if (lit) { ctx.beginPath(); ctx.arc(x + r * 1.15, y - r * 0.95, r * (0.2 + 0.07 * Math.sin(this.time * 14)), 0, 7); ctx.fillStyle = '#ffb703'; ctx.fill(); }
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
        ctx.fillStyle = hot ? '#e11d48' : lit ? '#1c1b2e' : '#3b3f58'; ctx.fill();
        ctx.lineWidth = lit ? 2 : 1.4; ctx.strokeStyle = hot ? '#ffffff' : lit ? '#ff4d67' : 'rgba(255,255,255,.8)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(x - r * 0.34, y - r * 0.36, r * 0.2, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
        if (lit) {
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = '800 ' + (r * (a.fuse > 9 ? 1.05 : 1.3)).toFixed(1) + 'px Baloo, system-ui, sans-serif';
          ctx.fillText(String(a.fuse), x, y + r * 0.08);
        }
      }
      ctx.restore();
    }

    // ——— ستايلات أسهم المراحل (أنابيب ملوّنة لامعة بدل الخط الأسود) ———
    _trailCol(a) {
      const T = TRAILS[this.trail % TRAILS.length];
      return T.col(a.id, this.time, a);
    }
    /** أنبوب: حافة أغمق + جسم + خط لمعة فاتح + رأس مثلث */
    _tube(pts, dir, c, lw) {
      const ctx = this.ctx, T = TRAILS[this.trail % TRAILS.length];
      const bw = lw * 1.5, ew = lw * 2.25;
      if (pts.length === 1) { const [dx, dy] = DIRS[dir]; pts = [[pts[0][0] - dx * 0.3, pts[0][1] - dy * 0.3], pts[0]]; }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (T.glow) { ctx.save(); ctx.globalAlpha *= 0.28; ctx.strokeStyle = c.b; ctx.lineWidth = ew * 2.1; strokePoly(ctx, pts); ctx.restore(); }
      ctx.strokeStyle = c.e; ctx.lineWidth = ew; strokePoly(ctx, pts);
      ctx.strokeStyle = c.b; ctx.lineWidth = bw; strokePoly(ctx, pts);
      ctx.save(); ctx.globalAlpha *= 0.8; ctx.strokeStyle = c.h; ctx.lineWidth = lw * 0.48; strokePoly(ctx, pts); ctx.restore();
      this._artHead(pts[pts.length - 1], dir, bw * 1.18, (ew - bw) / 2, c.b, c.e);
    }
    _trailArrows(lw, animIds, pulse) {
      const ctx = this.ctx, th = this.theme, ln = this.lens, T = TRAILS[this.trail % TRAILS.length];
      const bw = lw * 1.5, ew = lw * 2.25;
      const groups = new Map(), heads = [], special = [], kinds = [];
      for (const a of this.arrows) {
        if (!a.alive || animIds.has(a.id)) continue;
        let col = null;
        if (this.trace === a.id || (this.hint && this.hint.id === a.id)) col = th.accent;
        if (this.flash.has(a.id)) col = th.danger;
        if (ln && ln.block && ln.block.id === a.id) col = th.danger;
        if (ln && ln.id === a.id) col = ln.block ? th.danger : th.ok;
        if (col) { special.push([a, col]); continue; }
        if (a.kind) { kinds.push(a); continue; }
        const c = this._trailCol(a), k = c.b + c.e + c.h;
        let g = groups.get(k);
        if (!g) { g = { c, p: new Path2D() }; groups.set(k, g); }
        let pts = a.pts;
        if (pts.length === 1) { const [dx, dy] = DIRS[a.dir]; pts = [[pts[0][0] - dx * 0.3, pts[0][1] - dy * 0.3], pts[0]]; }
        g.p.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.p.lineTo(pts[i][0], pts[i][1]);
        heads.push([a, c]);
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const ga = ctx.globalAlpha;
      if (T.glow) { ctx.globalAlpha = ga * 0.28; ctx.lineWidth = ew * 2.1; for (const g of groups.values()) { ctx.strokeStyle = g.c.b; ctx.stroke(g.p); } ctx.globalAlpha = ga; }
      ctx.lineWidth = ew; for (const g of groups.values()) { ctx.strokeStyle = g.c.e; ctx.stroke(g.p); }
      ctx.lineWidth = bw; for (const g of groups.values()) { ctx.strokeStyle = g.c.b; ctx.stroke(g.p); }
      ctx.globalAlpha = ga * 0.8; ctx.lineWidth = lw * 0.48; for (const g of groups.values()) { ctx.strokeStyle = g.c.h; ctx.stroke(g.p); }
      ctx.globalAlpha = ga;
      for (const [a, c] of heads) this._artHead(a.pts[a.pts.length - 1], a.dir, bw * 1.18, (ew - bw) / 2, c.b, c.e);
      for (const a of kinds) {
        const c = this._kindCol(a);
        if (a.kind === 'bolt' || (a.lit && !a.boom)) { ctx.strokeStyle = a.kind === 'bolt' ? BOLT_GLOW : c.b; ctx.globalAlpha = ga * 0.34; ctx.lineWidth = ew * 2.2; strokePoly(ctx, a.pts.length > 1 ? a.pts : [a.pts[0], a.pts[0]]); ctx.globalAlpha = ga; }
        this._tube(a.pts, a.dir, c, lw * 1.12);
      }
      for (const [a, col] of special) {
        if (this.hint && this.hint.id === a.id) {
          ctx.strokeStyle = th.accent; ctx.globalAlpha = 0.25 + 0.3 * pulse; ctx.lineWidth = lw * 4;
          strokePoly(ctx, a.pts.length > 1 ? a.pts : [a.pts[0], a.pts[0]]); ctx.globalAlpha = ga;
        }
        this._tube(a.pts, a.dir, { b: col, e: edgeOf(col), h: lightOf(col) }, lw);
      }
    }

    // ——— رسم الأسهم الملوّنة (أنبوب بلون الرسمة + حافة أغمق) ———
    // ——— الأسلوب اللامع: أسهم مستقيمة قصيرة ممتلئة بلمعة وظل (متل حبات الحلوى) ———
    _gemArrows(animIds, pulse) {
      const th = this.theme, ln = this.lens, ctx = this.ctx, items = [];
      for (const a of this.arrows) {
        if (!a.alive || animIds.has(a.id)) continue;
        let col = null;
        if (this.trace === a.id || (this.hint && this.hint.id === a.id)) col = th.accent;
        if (this.flash.has(a.id)) col = th.danger;
        if (ln && ln.block && ln.block.id === a.id) col = th.danger;
        if (ln && ln.id === a.id) col = ln.block ? th.danger : th.ok;
        if (this.hint && this.hint.id === a.id) {
          // هالة نابضة حول سهم التلميح
          const p = a.pts, [dx, dy] = DIRS[a.dir];
          ctx.strokeStyle = th.accent; ctx.globalAlpha = 0.25 + 0.3 * pulse; ctx.lineWidth = 1.05; ctx.lineCap = 'round';
          strokePoly(ctx, [[p[0][0] - dx * 0.3, p[0][1] - dy * 0.3], [p[p.length - 1][0] + dx * 0.3, p[p.length - 1][1] + dy * 0.3]]);
          ctx.globalAlpha = 1;
        }
        items.push({ a, ox: 0, oy: 0, col });
      }
      this._gemBatch(items);
    }

    /** يرسم مجموعة أسهم لامعة دفعة وحدة (مجمّعة حسب اللون لسرعة الرسم) */
    _gemBatch(items) {
      const si = this.packSkin != null ? this.packSkin : this.L.skin, sk = si ? SKINS[si % SKINS.length] : null;
      if (sk && sk.draw) {
        // ستايلات تجريبية: كل سهم يترسم لحاله بإحداثيات محلية (x على طول السهم من مركز الذيل)
        const ctx = this.ctx, ga = ctx.globalAlpha, ANG = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        for (const it of items) {
          const a = it.a, n = a.cells.length, c = it.col || a.cols[n - 1];
          ctx.save();
          ctx.translate(a.pts[0][0] + it.ox, a.pts[0][1] + it.oy);
          ctx.rotate(ANG[a.dir]);
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          sk.draw(ctx, n, c, edgeOf(c), lightOf(c), this.time);
          ctx.restore();
          ctx.globalAlpha = ga;
        }
        return;
      }
      const ctx = this.ctx, shadow = new Path2D(), gloss = new Path2D(), by = new Map();
      const grp = c => { let g = by.get(c); if (!g) { g = { body: new Path2D(), depth: new Path2D(), hi: new Path2D() }; by.set(c, g); } return g; };
      for (const it of items) {
        const a = it.a, n = a.cells.length, [dx, dy] = DIRS[a.dir];
        const [x, y] = a.pts[0], X = x + it.ox, Y = y + it.oy;
        const c = it.col || a.cols[n - 1], g = grp(c);
        const s0 = -0.4, tip = n - 1 + 0.44, hb = tip - 0.46, t = 0.25, hw = 0.46;
        const add = (path, ox, oy, k, up) => {
          // k: تصغير حول المحور، up: إزاحة لفوق (للمعة)
          const P = (aa, bb) => [X + ox + dx * aa - dy * bb * k, Y + oy + dy * aa + dx * bb * k - up];
          const pts = [P(s0 + (1 - k) * 0.25, -t), P(hb, -t), P(hb, -hw), P(tip - (1 - k) * 0.3, 0), P(hb, hw), P(hb, t), P(s0 + (1 - k) * 0.25, t)];
          path.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]); path.closePath();
        };
        add(shadow, 0.05, 0.1, 1, 0);
        add(g.depth, 0, 0.075, 1, 0);
        add(g.body, 0, 0, 1, 0);
        add(g.hi, 0, 0, 0.5, 0.075);
        // لمعة بيضا صغيرة عند الذيل
        const gx = X + dx * (s0 + 0.16), gy = Y + dy * (s0 + 0.16) - 0.12;
        gloss.moveTo(gx - Math.abs(dx) * 0.0 - 0.07, gy); gloss.lineTo(gx + 0.07, gy);
      }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 0.12;
      ctx.fillStyle = ctx.strokeStyle = 'rgba(40,20,40,0.16)'; ctx.fill(shadow); ctx.stroke(shadow);
      for (const [c, g] of by) { ctx.fillStyle = ctx.strokeStyle = edgeOf(c); ctx.fill(g.depth); ctx.stroke(g.depth); }
      for (const [c, g] of by) { ctx.fillStyle = ctx.strokeStyle = c; ctx.fill(g.body); ctx.stroke(g.body); }
      ctx.lineWidth = 0.06;
      const ga = ctx.globalAlpha;
      for (const [c, g] of by) { ctx.globalAlpha = ga * 0.7; ctx.fillStyle = ctx.strokeStyle = lightOf(c); ctx.fill(g.hi); ctx.stroke(g.hi); }
      ctx.globalAlpha = ga * 0.85; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.075; ctx.stroke(gloss);
      ctx.globalAlpha = ga;
    }

    _artW(v) { return { tw: Math.max(0.34, 2.4 / v.s), ow: Math.max(0.06, 1 / v.s) }; }

    _artArrows(v, animIds, pulse) {
      const ctx = this.ctx, th = this.theme;
      const { tw, ow } = this._artW(v);
      const fills = new Map(), edges = new Map(), special = [];
      const get = (m, k) => { let p = m.get(k); if (!p) { p = new Path2D(); m.set(k, p); } return p; };
      const seg = (c, x0, y0, x1, y1) => {
        const f = get(fills, c), e = get(edges, edgeOf(c));
        f.moveTo(x0, y0); f.lineTo(x1, y1); e.moveTo(x0, y0); e.lineTo(x1, y1);
      };
      const ln = this.lens;
      for (const a of this.arrows) {
        if (!a.alive || animIds.has(a.id)) continue;
        if (this.flash.has(a.id) || this.trace === a.id || (this.hint && this.hint.id === a.id) || (ln && (ln.id === a.id || (ln.block && ln.block.id === a.id)))) { special.push(a); continue; }
        const p = a.pts, n = p.length;
        if (n === 1) { const [dx, dy] = DIRS[a.dir]; seg(a.cols[0], p[0][0] - dx * 0.3, p[0][1] - dy * 0.3, p[0][0], p[0][1]); continue; }
        for (let i = 0; i < n; i++) {
          const [x, y] = p[i];
          if (i > 0) seg(a.cols[i], x, y, (x + p[i - 1][0]) / 2, (y + p[i - 1][1]) / 2);
          if (i < n - 1) seg(a.cols[i], x, y, (x + p[i + 1][0]) / 2, (y + p[i + 1][1]) / 2);
        }
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = tw + ow * 2;
      for (const [c, path] of edges) { ctx.strokeStyle = c; ctx.stroke(path); }
      ctx.lineWidth = tw;
      for (const [c, path] of fills) { ctx.strokeStyle = c; ctx.stroke(path); }
      const sp = new Set(special);
      for (const a of this.arrows) {
        if (!a.alive || animIds.has(a.id) || sp.has(a)) continue;
        const c = a.cols[a.cols.length - 1];
        this._artHead(a.pts[a.pts.length - 1], a.dir, tw, ow, c, edgeOf(c));
      }
      // أسهم بحالة خاصة (خطأ، تتبّع، تلميح، عدسة) بلون موحّد واضح
      for (const a of special) {
        let col = th.accent;
        if (this.flash.has(a.id)) col = th.danger;
        if (ln && ln.block && ln.block.id === a.id) col = th.danger;
        if (ln && ln.id === a.id) col = ln.block ? th.danger : th.ok;
        if (this.hint && this.hint.id === a.id) {
          ctx.strokeStyle = th.accent; ctx.globalAlpha = 0.25 + 0.3 * pulse; ctx.lineWidth = tw * 2.6;
          strokePoly(ctx, a.pts.length > 1 ? a.pts : [a.pts[0], a.pts[0]]);
          ctx.globalAlpha = 1;
        }
        this._artUniform(a.pts, a.dir, col, tw, ow);
      }
    }

    _artUniform(pts, dir, col, tw, ow) {
      const ctx = this.ctx, e = edgeOf(col);
      if (pts.length === 1) { const [dx, dy] = DIRS[dir]; pts = [[pts[0][0] - dx * 0.3, pts[0][1] - dy * 0.3], pts[0]]; }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = e; ctx.lineWidth = tw + ow * 2; strokePoly(ctx, pts);
      ctx.strokeStyle = col; ctx.lineWidth = tw; strokePoly(ctx, pts);
      this._artHead(pts[pts.length - 1], dir, tw, ow, col, e);
    }

    _artHead(p, dir, tw, ow, fill, edge) {
      const ctx = this.ctx, [dx, dy] = DIRS[dir], hs = tw * 1.3;
      const tipX = p[0] + dx * hs * 1.08, tipY = p[1] + dy * hs * 1.08;
      const bx = p[0] - dx * hs * 0.2, by = p[1] - dy * hs * 0.2;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(bx - dy * hs * 0.78, by + dx * hs * 0.78);
      ctx.lineTo(bx + dy * hs * 0.78, by - dx * hs * 0.78);
      ctx.closePath();
      ctx.lineJoin = 'round'; ctx.lineWidth = ow * 2; ctx.strokeStyle = edge; ctx.stroke();
      ctx.fillStyle = fill; ctx.fill();
    }

    /** سهم ملوّن يتحرك (خروج أو اصطدام): كل خانة تحتفظ بلونها أثناء الانزلاق */
    _artMoving(an, u, v, override) {
      const ctx = this.ctx, a = an.a, n = an.n, { tw, ow } = this._artW(v);
      const piece = i => {
        if (n === 0) return subPath(an.E, u - 0.3, u);
        const a0 = Math.max(u, u + i - 0.5), a1 = Math.min(u + n, u + i + 0.5);
        return a1 - a0 < 0.01 ? null : subPath(an.E, a0, a1);
      };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.lineWidth = pass ? tw : tw + ow * 2;
        for (let i = 0; i <= n; i++) {
          const pc = piece(i); if (!pc) continue;
          const c = override || a.cols[i];
          ctx.strokeStyle = pass ? c : edgeOf(c);
          strokePoly(ctx, pc);
        }
      }
      const c = override || a.cols[n];
      this._artHead(pointAt(an.E, u + n), a.dir, tw, ow, c, edgeOf(c));
    }

    _drawLens(lw) {
      const ctx = this.ctx, th = this.theme, ln = this.lens;
      const a = this.arrows[ln.id];
      if (!a || !a.alive) return;
      const [dx, dy] = DIRS[a.dir];
      const p = a.pts[a.pts.length - 1];
      let len;
      if (ln.block) len = ln.block.dist - 0.5;
      else len = a.dir === 0 ? this.W - p[0] + 0.5 : a.dir === 2 ? p[0] + 0.5 : a.dir === 1 ? this.H - p[1] + 0.5 : p[1] + 0.5;
      const alpha = Math.min(1, ln.t / 0.4);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ln.block ? th.danger : th.ok;
      ctx.lineWidth = lw * 0.9;
      ctx.setLineDash([0.18, 0.18]);
      ctx.beginPath();
      ctx.moveTo(p[0] + dx * 0.45, p[1] + dy * 0.45);
      ctx.lineTo(p[0] + dx * len, p[1] + dy * len);
      ctx.stroke();
      ctx.setLineDash([]);
      if (ln.block) {
        const ex = p[0] + dx * (len + 0.5), ey = p[1] + dy * (len + 0.5);
        ctx.lineWidth = lw * 1.1;
        ctx.beginPath(); ctx.arc(ex, ey, 0.42, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ——— اللمس والتكبير ———
    _bind() {
      const c = this.c;
      c.style.touchAction = 'none';
      const pos = e => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      c.addEventListener('pointerdown', e => {
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
        const p = pos(e);
        this.pointers.set(e.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y });
        if (this.pointers.size === 1) {
          const g = { type: 'tap', x0: p.x, y0: p.y, long: false };
          g.timer = setTimeout(() => this._longPress(g), 400);
          this.gesture = g;
        } else if (this.pointers.size === 2) {
          if (this.gesture && this.gesture.timer) clearTimeout(this.gesture.timer);
          this.trace = null;
          const [a, b] = [...this.pointers.values()];
          this.gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx0: (a.x + b.x) / 2, my0: (a.y + b.y) / 2, v0: Object.assign({}, this.view) };
        }
      });
      c.addEventListener('pointermove', e => {
        const pt = this.pointers.get(e.pointerId);
        if (!pt) return;
        const p = pos(e);
        const px = pt.x, py = pt.y;
        pt.x = p.x; pt.y = p.y;
        const g = this.gesture;
        if (!g) return;
        if (g.type === 'pinch' && this.pointers.size >= 2) {
          const [a, b] = [...this.pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const s = clamp(g.v0.s * d / g.d0, this.fitS * 0.9, Math.max(this.fitS, 70));
          const bx = (g.mx0 - g.v0.ox) / g.v0.s, by = (g.my0 - g.v0.oy) / g.v0.s;
          this.view = this._clampView({ s, ox: mx - bx * s, oy: my - by * s });
          this.kick();
        } else if (g.type === 'tap') {
          if (Math.hypot(p.x - g.x0, p.y - g.y0) > 9) {
            clearTimeout(g.timer);
            if (g.long) return; // أثناء التتبع
            g.type = this.zoomed ? 'pan' : 'none';
          }
        } else if (g.type === 'pan') {
          this.view = this._clampView({ s: this.view.s, ox: this.view.ox + (p.x - px), oy: this.view.oy + (p.y - py) });
          this.kick();
        }
      });
      const up = e => {
        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.delete(e.pointerId);
        const g = this.gesture;
        if (g && g.timer) clearTimeout(g.timer);
        if (g && g.type === 'tap' && !g.long && e.type === 'pointerup') this.tapAt(g.x0, g.y0);
        if (g && g.long) { this.trace = null; this.kick(); }
        if (g && g.type === 'pinch') {
          this.gesture = { type: 'none' };
          if (this.view.s < this.fitS) this.fit(true);
        }
        if (!this.pointers.size) this.gesture = null;
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', e => {
        e.preventDefault();
        const p = pos(e);
        const v = this.view;
        const s = clamp(v.s * Math.exp(-e.deltaY * 0.0015), this.fitS, Math.max(this.fitS, 70));
        const bx = (p.x - v.ox) / v.s, by = (p.y - v.oy) / v.s;
        this.view = this._clampView({ s, ox: p.x - bx * s, oy: p.y - by * s });
        this.kick();
      }, { passive: false });
    }

    _longPress(g) {
      if (!this.L || this.gesture !== g || g.type !== 'tap') return;
      const v = this.view;
      const cand = this.pick((g.x0 - v.ox) / v.s, (g.y0 - v.oy) / v.s);
      if (!cand.length || cand[0].d > Math.max(0.75, 16 / v.s)) return;
      g.long = true;
      this.trace = cand[0].a.id;
      if (this.h.onTrace) this.h.onTrace();
      this.kick();
    }
  }

  // لون حافة السهم الملوّن: أغمق من لونه، أو أفتح قليلاً إذا كان اللون داكناً جداً
  const edgeCache = {};
  function edgeOf(hex) {
    let e = edgeCache[hex];
    if (e) return e;
    const n = parseInt(String(hex).slice(1, 7), 16) || 0;
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < 70) { r += (255 - r) * 0.3; g += (255 - g) * 0.3; b += (255 - b) * 0.3; }
    else { r *= 0.66; g *= 0.66; b *= 0.68; }
    e = '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
    edgeCache[hex] = e;
    return e;
  }
  // ——— ستايلات الأسهم (تجريبية: كل لوحة بالحزمة بستايل مختلف) ———
  // كل رسمة بإحداثيات محلية: الذيل عند 0، الرأس عند n-1، والسهم يأشّر لـ +x
  const pth = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  const line = (g, x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const fillStroke = (g, f, e, w) => { g.fillStyle = f; g.fill(); if (e) { g.strokeStyle = e; g.lineWidth = w; g.stroke(); } };
  const basic = (g, n, t, hw) => { const s0 = -0.42, tip = n - 1 + 0.45, hb = tip - 0.46;
    pth(g, [[s0, -t], [hb, -t], [hb, -hw], [tip, 0], [hb, hw], [hb, t], [s0, t]]); };
  const SKINS = [
    { name: { ar: 'حلوى لامعة', en: 'Glossy candy' } },
    { name: { ar: 'سهم رماية 🏹', en: 'Archery' }, draw(g, n, c, e, lt) {
      const s0 = -0.44, tip = n - 1 + 0.47;
      g.strokeStyle = e; g.lineWidth = 0.17; line(g, s0 + 0.12, 0, tip - 0.3, 0);
      g.strokeStyle = c; g.lineWidth = 0.1; line(g, s0 + 0.12, 0, tip - 0.3, 0);
      for (const k of [-1, 1]) { pth(g, [[s0, 0], [s0 + 0.06, 0.32 * k], [s0 + 0.32, 0.3 * k], [s0 + 0.3, 0]]); fillStroke(g, lt, e, 0.045); }
      pth(g, [[tip, 0], [tip - 0.4, -0.27], [tip - 0.3, 0], [tip - 0.4, 0.27]]); fillStroke(g, c, e, 0.05);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.035; line(g, tip - 0.08, -0.03, tip - 0.3, -0.17);
    } },
    { name: { ar: 'رؤوس متتابعة ›››', en: 'Chevrons' }, draw(g, n, c, e) {
      const s0 = -0.3, tip = n - 1 + 0.38, k = n === 1 ? 2 : n * 2, step = (tip - s0) / k;
      for (let i = 0; i < k; i++) { const x = s0 + (i + 1) * step, h = i === k - 1 ? 0.36 : 0.28;
        for (const [col, w] of [[e, 0.24], [c, 0.15]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x - h * 0.75, -h); g.lineTo(x, 0); g.lineTo(x - h * 0.75, h); g.stroke(); } }
    } },
    { name: { ar: 'عيون ظريفة 👀', en: 'Cuties' }, draw(g, n, c, e) {
      const s0 = -0.42, tip = n - 1 + 0.46, r = 0.36;
      g.beginPath(); g.arc(s0 + r, 0, r, Math.PI / 2, Math.PI * 1.5); g.lineTo(tip - 0.32, -r); g.lineTo(tip, 0); g.lineTo(tip - 0.32, r); g.closePath();
      fillStroke(g, c, e, 0.06);
      g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(s0 + 0.3, -0.17, 0.1, 0.05, -0.5, 0, 7); g.fill();
      const ex = tip - 0.5;
      for (const y of [-0.14, 0.14]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, y, 0.1, 0, 7); g.fill(); g.fillStyle = '#1d1b2e'; g.beginPath(); g.arc(ex + 0.035, y, 0.055, 0, 7); g.fill(); }
    } },
    { name: { ar: 'وهج النيون ✨', en: 'Neon' }, draw(g, n, c, e, lt) {
      basic(g, n, 0.15, 0.38);
      g.strokeStyle = c; g.globalAlpha *= 0.25; g.lineWidth = 0.26; g.stroke(); g.globalAlpha /= 0.25;
      g.fillStyle = 'rgba(20,16,40,.82)'; g.fill();
      g.strokeStyle = c; g.lineWidth = 0.09; g.stroke();
      g.strokeStyle = lt; g.lineWidth = 0.03; g.stroke();
    } },
    { name: { ar: 'طوابع ملونة', en: 'Sticker' }, draw(g, n, c, e) {
      g.save(); g.translate(0.04, 0.07); basic(g, n, 0.2, 0.42); g.fillStyle = g.strokeStyle = 'rgba(30,20,50,.22)'; g.lineWidth = 0.2; g.fill(); g.stroke(); g.restore();
      basic(g, n, 0.2, 0.42); g.strokeStyle = '#fff'; g.lineWidth = 0.18; g.stroke(); g.fillStyle = c; g.fill();
    } },
    { name: { ar: 'بكسل كلاسيكي 👾', en: '8-bit' }, draw(g, n, c, e, lt) {
      const u = 0.16, s0 = -0.4, tip = n - 1 + 0.48, hb = tip - 3 * u;
      const rects = [[s0, -u, hb - s0, 2 * u]];
      for (let j = 0; j < 3; j++) rects.push([hb + j * u, -(3 - j) * u, u, 2 * (3 - j) * u]);
      g.fillStyle = e; for (const [x, y, w, h] of rects) g.fillRect(x, y + 0.06, w, h);
      g.fillStyle = c; for (const [x, y, w, h] of rects) g.fillRect(x, y, w, h);
      g.fillStyle = lt; for (const [x, y, w] of rects) g.fillRect(x, y, w, 0.05);
    } },
    { name: { ar: 'طائرة ورقية ✈️', en: 'Paper plane' }, draw(g, n, c, e, lt) {
      const s0 = -0.44, tip = n - 1 + 0.47;
      pth(g, [[tip, 0], [s0, -0.38], [s0 + 0.22, 0], [s0, 0.38]]); fillStroke(g, c, e, 0.05);
      pth(g, [[tip, 0], [s0, -0.38], [s0 + 0.22, 0]]); g.fillStyle = lt; g.fill();
      g.strokeStyle = e; g.lineWidth = 0.035; line(g, s0 + 0.22, 0, tip - 0.04, 0);
    } },
    { name: { ar: 'عصا السكاكر 🍬', en: 'Candy cane' }, draw(g, n, c, e) {
      basic(g, n, 0.22, 0.44); g.fillStyle = c; g.fill();
      g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 0.1;
      for (let x = -1; x < n + 0.6; x += 0.3) line(g, x, 0.5, x + 0.45, -0.5);
      g.restore(); basic(g, n, 0.22, 0.44); g.strokeStyle = e; g.lineWidth = 0.055; g.stroke();
    } },
    { name: { ar: 'أزرار 🔘', en: 'Buttons' }, draw(g, n, c, e, lt) {
      if (n > 1) { g.strokeStyle = e; g.lineWidth = 0.32; line(g, 0, 0, n - 1, 0); }
      for (let i = 0; i < n; i++) {
        g.beginPath(); g.arc(i, 0.05, 0.41, 0, 7); g.fillStyle = e; g.fill();
        g.beginPath(); g.arc(i, 0, 0.41, 0, 7); g.fillStyle = c; g.fill();
        g.beginPath(); g.arc(i - 0.1, -0.13, 0.13, 0, 7); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
      }
      const h = n - 1; pth(g, [[h + 0.24, 0], [h - 0.13, -0.22], [h - 0.13, 0.22]]); g.fillStyle = '#fff'; g.fill();
      for (let i = 0; i < n - 1; i++) { g.beginPath(); g.arc(i, 0, 0.08, 0, 7); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); }
    } },
    { name: { ar: 'صواريخ 🚀', en: 'Rockets' }, draw(g, n, c, e, lt, time) {
      const s0 = -0.3, tip = n - 1 + 0.47, r = 0.25;
      const fl = 0.16 + 0.05 * Math.sin(time * 18 + n);
      pth(g, [[s0 + 0.04, -0.12], [s0 - fl, 0], [s0 + 0.04, 0.12]]); g.fillStyle = '#ffb703'; g.fill();
      pth(g, [[s0 + 0.04, -0.06], [s0 - fl * 0.55, 0], [s0 + 0.04, 0.06]]); g.fillStyle = '#fff3b0'; g.fill();
      for (const k of [-1, 1]) { pth(g, [[s0, 0.12 * k], [s0 - 0.04, 0.4 * k], [s0 + 0.3, 0.2 * k]]); fillStroke(g, e, null); }
      g.beginPath(); g.moveTo(s0, -r); g.lineTo(tip - 0.36, -r); g.quadraticCurveTo(tip - 0.05, -r * 0.6, tip, 0); g.quadraticCurveTo(tip - 0.05, r * 0.6, tip - 0.36, r); g.lineTo(s0, r); g.closePath();
      fillStroke(g, c, e, 0.05);
      g.beginPath(); g.arc(tip - 0.48, 0, 0.1, 0, 7); fillStroke(g, '#bde0fe', e, 0.04);
    } },
  ];
  root.ArrowSkins = SKINS.map(k => k.name);

  // ——— ستايلات أسهم المراحل (تُشترى بالعملات من المتجر) ———
  const CANDY = ['#ff4d8d', '#ffb703', '#06d6a0', '#3a86ff', '#9b5de5', '#ff7a1a', '#00b4d8', '#e63946'];
  const hsl = (h, s, l) => 'hsl(' + Math.round(h) + ',' + s + '%,' + l + '%)';
  const fix = c => ({ b: c, e: edgeOf(c), h: lightOf(c) });
  const TRAILS = [
    { name: { ar: 'حبر كلاسيكي', en: 'Classic ink' }, sw: ['#1f2544'] },
    { name: { ar: 'أنابيب حلوى ملونة', en: 'Candy tubes' }, sw: CANDY.slice(0, 4), col: id => fix(CANDY[(id * 5) % CANDY.length]) },
    { name: { ar: 'جليد ناصع', en: 'Ice' }, sw: ['#9bdcff', '#cdeffd', '#3a86c8'], col: id => (id % 3 ? { b: '#8fd3ff', e: '#2f78c4', h: '#ffffff' } : { b: '#bfe9ff', e: '#3a86c8', h: '#ffffff' }) },
    { name: { ar: 'أطياف النيون', en: 'Neon' }, glow: true, sw: ['#ff2bd6', '#00e5ff', '#b3ff00'], col: id => { const c = ['#ff2bd6', '#00e5ff', '#b3ff00', '#ffd400'][id % 4]; return { b: c, e: '#1b1035', h: '#ffffff' }; } },
    { anim: true, name: { ar: 'بريق الذهب', en: 'Gold' }, sw: ['#f5b700', '#fff1a8', '#8a5a00'], col: (id, t) => ({ b: (Math.floor(t * 2 + id * 0.37) % 7) === 0 ? '#ffd84d' : '#f5b700', e: '#8a5a00', h: '#fff6c2' }) },
    { anim: true, name: { ar: 'حمم بركانية 🌋', en: 'Lava' }, glow: true, sw: ['#ff5400', '#ffd166', '#7a1500'], col: (id, t) => { const k = Math.floor(t * 6 + id * 1.7) % 3; return { b: ['#ff5400', '#ff7b00', '#ff3d00'][k], e: '#7a1500', h: '#ffd166' }; } },
    { anim: true, name: { ar: 'قوس قزح 🌈', en: 'Rainbow' }, sw: ['#ff4d4d', '#ffd400', '#2ecc71', '#3a86ff', '#9b5de5'], col: (id, t) => { const h = (Math.round(((id * 47 + t * 60) % 360) / 15) * 15); return { b: hsl(h, 90, 58), e: hsl(h, 70, 32), h: hsl(h, 100, 86) }; } },
    { anim: true, name: { ar: 'سديم المجرة 🌌', en: 'Galaxy' }, glow: true, sw: ['#7b2ff7', '#f107a3', '#1a0b3d'], col: (id, t) => { const h = 260 + 50 * Math.sin(t * 1.5 + id); const hq = Math.round(h / 10) * 10; return { b: hsl(hq, 85, 55), e: '#160a33', h: '#f5e1ff' }; } },
    // ——— حصرية للميداليات (لا تُشترى) ———
    { anim: true, medal: true, glow: true, name: { ar: 'ألماس نقي 💎', en: 'Diamond 💎' }, sw: ['#c9f3ff', '#ffffff', '#2f86c0'], col: (id, t) => ((Math.floor(t * 3 + id * 0.53) % 9) === 0 ? { b: '#ffffff', e: '#3aa0d8', h: '#ffffff' } : { b: id % 2 ? '#a8e8ff' : '#c9f3ff', e: '#2f86c0', h: '#ffffff' }) },
    { anim: true, medal: true, glow: true, name: { ar: 'شفق قطبي 🌠', en: 'Aurora 🌠' }, sw: ['#2bffb1', '#4cc9f0', '#b388ff'], col: (id, t) => { const h = Math.round((170 + 75 * Math.sin(t * 1.2 + id * 0.45)) / 10) * 10; return { b: hsl(h, 85, 58), e: hsl(h, 70, 24), h: hsl(h, 100, 88) }; } },
    { anim: true, medal: true, name: { ar: 'تاج ملكي 👑', en: 'Royal 👑' }, sw: ['#7b35a8', '#f5b700', '#2b0f40'], col: (id, t) => ((id + Math.floor(t * 1.5)) % 3 === 0 ? { b: '#f5b700', e: '#7a4a00', h: '#fff1a8' } : { b: '#7b35a8', e: '#2b0f40', h: '#e6c8ff' }) },
    { anim: true, medal: true, glow: true, name: { ar: 'سهم أسطوري 🔱', en: 'Legendary 🔱' }, sw: ['#00e5ff', '#ff3d7f', '#ffd166'], col: (id, t) => { const h = [190, 330, 45][Math.floor((t * 0.8 + id * 0.21) % 3)]; return { b: hsl(h, 95, 58), e: hsl(h, 80, 26), h: '#ffffff' }; } },
  ];
  root.ArrowTrails = TRAILS.map(k => ({ name: k.name, sw: k.sw }));

  const lightCache = {};
  function lightOf(hex) {
    let e = lightCache[hex];
    if (e) return e;
    const n = parseInt(String(hex).slice(1, 7), 16) || 0;
    const m = v => Math.round(v + (255 - v) * 0.42).toString(16).padStart(2, '0');
    e = '#' + m((n >> 16) & 255) + m((n >> 8) & 255) + m(n & 255);
    lightCache[hex] = e;
    return e;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l = dx * dx + dy * dy;
    let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function pointAt(E, t) {
    const i = clamp(Math.floor(t), 0, E.length - 2);
    const f = t - i;
    return [E[i][0] + (E[i + 1][0] - E[i][0]) * f, E[i][1] + (E[i + 1][1] - E[i][1]) * f];
  }
  function subPath(E, a, b) {
    const out = [pointAt(E, a)];
    for (let i = Math.ceil(a); i <= Math.floor(b); i++) if (i > a && i < b && i < E.length) out.push(E[i]);
    out.push(pointAt(E, b));
    return out;
  }
  function strokePoly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** معاينة ستايل أسهم في المتجر: kind = 'trail' | 'skin' */
  root.drawArrowPreview = function (canvas, kind, idx, time) {
    const dpr = Math.min(3, root.devicePixelRatio || 1);
    const w = canvas.clientWidth || 120, h = canvas.clientHeight || 90;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = Math.min(w / 4.4, h / 3.4);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (w - 4.4 * s) / 2 + dpr * s * 0.2, dpr * (h - 3.4 * s) / 2 + dpr * s * 0.2);
    const f = Object.create(Engine.prototype);
    f.ctx = ctx; f.time = time || 0; f.theme = { ink: '#1f2544' };
    if (kind === 'trail') {
      f.trail = idx;
      const lw = 0.2;
      const A = [
        { id: 0, pts: [[0.3, 2.6], [0.3, 0.9], [1.9, 0.9]], dir: 0 },
        { id: 1, pts: [[2.4, 2.8], [2.4, 1.9], [3.6, 1.9]], dir: 0 },
        { id: 2, pts: [[3.7, 1.3], [3.7, 0.55]], dir: 3 },
      ];
      for (const a of A) {
        if (!idx) f._arrow(a.pts, a.dir, '#1f2544', lw * 0.85);
        else f._tube(a.pts, a.dir, f._trailCol(a), lw);
      }
    } else {
      f.packSkin = idx; f.L = { skin: idx };
      const C = ['#ff5d8f', '#ffb703', '#4cc9f0', '#06d6a0', '#9b5de5'];
      const mk = (x, y, n, dir, c) => {
        const D = DIRS[dir], pts = [], cells = [], cols = [];
        for (let i = 0; i < n; i++) { pts.push([x + D[0] * i, y + D[1] * i]); cells.push(i); cols.push(c); }
        return { a: { pts, cells, cols, dir }, ox: 0, oy: 0, col: null };
      };
      f._gemBatch([mk(0.5, 0.5, 2, 0, C[0]), mk(3.4, 0.5, 2, 1, C[2]), mk(0.5, 1.6, 1, 3, C[1]), mk(1.7, 2.6, 2, 0, C[3]), mk(1.6, 1.6, 1, 0, C[4])]);
    }
  };

  root.Engine = Engine;
})(window);
