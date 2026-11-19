/* سهام — محرك اللعبة: الرسم، اللمس، التكبير، الحركة */
(function (root) {
  'use strict';
  const DIRS = root.Gen.DIRS;
  const FADE = 0;             // الخانات الفارغة تبدأ مثل باقي الرقعة (طيف خفيف + نقطة)
  const LINE = 0.16;          // سماكة خط السهم (بوحدة الخانة)
  const HEAD = 0.30;          // حجم رأس السهم

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
      const W = this.W = level.W, H = this.H = level.H;
      this.occ = new Int32Array(W * H).fill(-1);
      this.arrows = level.arrows.map(a => {
        const pts = a.cells.map(c => [(c % W) + 0.5, ((c / W) | 0) + 0.5]);
        return { id: a.id, cells: a.cells, dir: a.dir, pts, alive: true, busy: false };
      });
      for (const a of this.arrows) for (const c of a.cells) this.occ[c] = a.id;
      this.reveal = new Float32Array(W * H);
      this.target = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        if (level.mask[i] && this.occ[i] < 0) { this.reveal[i] = 0; this.target[i] = 0; }
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
      this.particles = []; this.winFx = null;
      this.total = this.arrows.length;
      this.left = this.total;
      this.hearts = opts.hearts == null ? 3 : opts.hearts;
      this.zen = !!opts.zen;
      this.over = false; this.won = false; this.winT = -1; this.loseT = -1;
      this.hint = null; this.lens = null; this.lensArmed = false; this.trace = null;
      this.flash = new Map(); this.shake = 0;
      this.anims = []; this.mistakes = 0; this.time = 0;
      this.resize();
    }

    resize() {
      const p = this.c.parentElement;
      const w = Math.max(1, p.clientWidth), h = Math.max(1, p.clientHeight);
      this.dpr = Math.min(3, root.devicePixelRatio || 1);
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
      const cand = this.pick(bx, by);
      const tol = Math.max(0.72, 16 / v.s);
      if (!cand.length || cand[0].d > tol) return;
      // حماية من اللمس الخاطئ: إذا كان سهمان قريبين جداً والرقعة صغيرة، نكبّر بدل المخاطرة بقلب
      if (this.safeTap !== false && cand.length > 1 && v.s < 26 && (cand[1].d - cand[0].d) < 0.28 && !this.lensArmed) {
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

    _exit(a) {
      a.alive = false;
      for (const c of a.cells) this.occ[c] = -1;
      this.left--;
      const [dx, dy] = DIRS[a.dir];
      const hp = a.pts[a.pts.length - 1];
      // مسافة الخروج: حتى يغادر الذيل حدود الرقعة
      let toEdge = a.dir === 0 ? this.W - hp[0] : a.dir === 2 ? hp[0] : a.dir === 1 ? this.H - hp[1] : hp[1];
      const n = a.pts.length - 1;
      const dist = Math.ceil(toEdge) + n + 2;
      const E = a.pts.slice();
      for (let k = 1; k <= dist + 1; k++) E.push([hp[0] + dx * k, hp[1] + dy * k]);
      const dur = clamp(0.28 + dist * 0.016, 0.34, 0.85);
      this.anims.push({ type: 'exit', a, E, n, dist, t: 0, dur, revealed: 0 });
      if (this.h.onExit) this.h.onExit(this.left, this.total);
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

    addHearts(n) { this.hearts += n; this.over = false; this.loseT = -1; this.kick(); }

    useHint() {
      const free = this.freeArrows().filter(a => !a.busy);
      if (!free.length) return false;
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
      let busy = false;
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
          if (p >= 1) an.a.busy = false;
        }
        if (p < 1) keep.push(an);
      }
      this.anims = keep;
      if (this.anims.length) busy = true;

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

      // الفوز
      const exiting = this.anims.some(a => a.type === 'exit');
      if (this.left === 0 && !this.won && !exiting) {
        this.won = true;
        for (let i = 0; i < this.target.length; i++) if (this.L.mask[i]) this.target[i] = 1;
        this.winT = 1.9; busy = true;
        this.winFx = { t: 0 };
        this._confetti();
      }
      if (this.winFx) { this.winFx.t += dt; if (this.winFx.t > 1.4) this.winFx = null; else busy = true; }
      if (this.particles.length) {
        for (const p of this.particles) { p.vy += 26 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt; }
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
      ctx.fillStyle = th.bg;
      ctx.fillRect(0, 0, this.cw, this.ch);
      if (!this.L) return;
      const v = this.view, W = this.W, H = this.H, L = this.L;
      const sh = this.shake > 0 ? Math.sin(this.time * 70) * 6 * (this.shake / 0.3) : 0;
      ctx.translate(v.ox + sh, v.oy);
      ctx.scale(v.s, v.s);

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
      const ghost = th.ghost == null ? 0.13 : th.ghost;
      for (let i = 0; i < W * H; i++) {
        if (!L.mask[i]) continue;
        const r = Math.max(ghost, this.reveal[i]);
        const x = i % W, y = (i / W) | 0;
        ctx.globalAlpha = Math.min(1, r);
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
      ctx.globalAlpha = 1;
      // إطار شكل الرقعة
      ctx.strokeStyle = th.edge || th.cell;
      ctx.lineWidth = Math.max(0.06, 1.2 / v.s);
      ctx.lineCap = 'round';
      ctx.stroke(this.edgePath);
      // نقاط خفيفة على الخانات الفارغة
      ctx.fillStyle = th.dot || th.ink;
      ctx.globalAlpha = 0.16;
      for (let i = 0; i < W * H; i++) {
        if (!L.mask[i] || this.occ[i] >= 0 || this.reveal[i] > FADE + 0.05) continue;
        const x = i % W, y = (i / W) | 0;
        ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, 0.07, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const lw = Math.max(LINE, 2 / v.s);
      const animIds = new Set(this.anims.filter(a => a.a).map(a => a.a.id));
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 7);

      // الأسهم الثابتة
      for (const a of this.arrows) {
        if (!a.alive || animIds.has(a.id)) continue;
        let col = th.ink, w = lw;
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
        ctx.globalAlpha = alpha;
        const col = an.type === 'bump' && this.flash.has(an.a.id) ? th.danger : th.ink;
        const sub = subPath(an.E, u, u + an.n);
        this._arrow(sub, an.a.dir, col, lw);
        ctx.globalAlpha = 1;
      }
      // العدسة
      if (this.lens) this._drawLens(lw);
      // لمعة الفوز تمر على اللوحة
      if (this.winFx) {
        const p = Math.min(1, this.winFx.t / 1.1);
        const dx = 0.86, dy = 0.5, Lh = (W + H) * 0.75;
        const cx = W / 2 + dx * (-Lh + 2 * Lh * easeInOut(p)), cy = H / 2 + dy * (-Lh + 2 * Lh * easeInOut(p));
        const g = ctx.createLinearGradient(cx - dx * 3, cy - dy * 3, cx + dx * 3, cy + dy * 3);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save(); ctx.clip(this.maskPath); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
      // قصاصات الاحتفال
      for (const pt of this.particles) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, pt.life / 0.4);
        ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot);
        ctx.fillStyle = pt.c;
        ctx.fillRect(-pt.s / 2, -pt.s * 0.3, pt.s, pt.s * 0.6);
        ctx.restore();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    _confetti() {
      const cols = [];
      for (let i = 0; i < this.L.color.length; i++) if (this.L.color[i]) cols.push(this.L.color[i]);
      const k = Math.max(this.W, this.H);
      for (let i = 0; i < 70; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = (0.5 + Math.random() * 0.7) * k * 1.1;
        this.particles.push({
          x: this.W / 2 + (Math.random() - 0.5) * this.W * 0.3, y: this.H * 0.55,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
          s: k * (0.025 + Math.random() * 0.025), life: 1.4 + Math.random() * 0.8,
          c: cols[(Math.random() * cols.length) | 0] || '#ffd166',
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

  root.Engine = Engine;
})(window);
