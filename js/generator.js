/* سهام — مولّد المراحل
 * يبني مراحل قابلة للحل دائماً عن طريق "التوليد العكسي":
 * كل سهم جديد يُوضع بحيث يكون طريق خروجه (من رأسه إلى حافة الرقعة) خالياً من كل الأسهم الموضوعة قبله.
 * إذاً ترتيب الحل = عكس ترتيب الوضع، والمرحلة مضمونة الحل 100%.
 */
(function (root) {
  'use strict';
  const PICS = (typeof module !== 'undefined' && module.exports) ? require('./pictures.js') : root;

  // اتجاهات: 0 يمين، 1 تحت، 2 يسار، 3 فوق
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function shuffle(a, R) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /** يحوّل اللوحة إلى رقعة: لوحات الأشكال تُرسم بعرض size خانة، ولوحات البكسل اليدوي تُكبَّر بالمعامل size */
  function buildBoard(pic, size, mirror) {
    if (pic.shapes || pic.grid) return PICS.rasterize(pic, Math.max(6, Math.round(size)), mirror);
    const f = size;
    const th = pic.art.length;
    const tw = Math.max.apply(null, pic.art.map(r => r.length));
    const W = Math.max(2, Math.round(tw * f));
    const H = Math.max(2, Math.round(th * f));
    const mask = new Uint8Array(W * H);
    const color = new Array(W * H).fill(null);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sx = Math.min(tw - 1, Math.floor((x + 0.5) * tw / W));
        const sy = Math.min(th - 1, Math.floor((y + 0.5) * th / H));
        if (mirror) sx = tw - 1 - sx;
        const ch = pic.art[sy][sx] || '.';
        if (ch !== '.' && ch !== ' ') {
          mask[y * W + x] = 1;
          color[y * W + x] = PICS.colorOf(pic, ch);
        }
      }
    }
    return { W, H, mask, color };
  }

  /** يملأ الرقعة بالأسهم */
  function fill(board, params, seed) {
    const { W, H } = board;
    const col = board.color;
    // في وضع الرسم بالأسهم: الحدود والتفاصيل ثابتة، والأسهم تملأ المساحات الملوّنة فقط
    const mask = params.lock && board.fixed ? board.mask.map((m, i) => m && !board.fixed[i] ? 1 : 0) : board.mask;
    // وضع "اللوحة من أسهم": كل سهم بلون واحد فقط، فالأسهم نفسها ترسم الصورة
    const same = params.lock ? (a, b) => col[a] === col[b] : () => true;
    const R = rng(seed);
    const occ = new Int32Array(W * H).fill(-1);
    // rayMax[c] = أكبر رقم سهم يمر طريق خروجه بالخانة c
    const rayMax = new Int32Array(W * H).fill(-1);
    const arrows = [];
    const inG = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

    function sampleLen() {
      const { minLen, maxLen } = params;
      // انحياز نحو الأطوال الأطول في المراحل الصعبة
      const u = Math.pow(R(), params.lenBias || 1);
      return minLen + Math.floor(u * (maxLen - minLen + 1));
    }

    function tryPlace(h, d, targetLen, allowSingle) {
      const hx = h % W, hy = (h / W) | 0;
      const [dx, dy] = DIRS[d];
      // 1) طريق الخروج يجب أن يكون خالياً
      const ray = new Set();
      let cx = hx + dx, cy = hy + dy;
      while (inG(cx, cy)) {
        const i = cy * W + cx;
        if (occ[i] >= 0) return false;
        ray.add(i);
        cx += dx; cy += dy;
      }
      // 2) الخانة خلف الرأس مباشرة
      const bx = hx - dx, by = hy - dy;
      const b = by * W + bx;
      if (!inG(bx, by) || !mask[b] || occ[b] >= 0 || !same(b, h)) {
        if (!allowSingle) return false;
        // سهم من خانة واحدة (لتفاصيل صغيرة مثل العيون)
        const id = arrows.length;
        occ[h] = id;
        for (const c of ray) rayMax[c] = id;
        arrows.push({ id, cells: [h], dir: d });
        return true;
      }
      const path = [h, b];
      const used = new Set(path);
      let px = bx, py = by, wd = (d + 2) % 4;
      while (path.length < targetLen) {
        const left = (wd + 3) % 4, right = (wd + 1) % 4;
        const lr = R() < 0.5 ? [left, right] : [right, left];
        const order = R() < params.straight ? [wd, lr[0], lr[1]] : [lr[0], lr[1], wd];
        let moved = false;
        for (const nd of order) {
          const nx = px + DIRS[nd][0], ny = py + DIRS[nd][1];
          if (!inG(nx, ny)) continue;
          const ni = ny * W + nx;
          if (!mask[ni] || occ[ni] >= 0 || used.has(ni) || ray.has(ni) || !same(ni, h)) continue;
          path.push(ni); used.add(ni); px = nx; py = ny; wd = nd; moved = true;
          break;
        }
        if (!moved) break;
      }
      const id = arrows.length;
      const cells = path.slice().reverse(); // من الذيل إلى الرأس
      for (const c of cells) occ[c] = id;
      for (const c of ray) rayMax[c] = id;
      arrows.push({ id, cells, dir: d });
      return true;
    }

    /* مدّ ذيل سهم موجود إلى خانة فارغة مجاورة.
     * آمن للحل: السهم A يُزال بعد كل الأسهم الموضوعة بعده، فيكفي ألا يمر طريق أي سهم لاحق بالخانة. */
    const maxExt = Math.max(params.maxLen + 4, Math.round(params.maxLen * 1.6));
    function extendPass() {
      let grown = 0;
      shuffle(cells, R);
      for (const c of cells) {
        if (occ[c] >= 0) continue;
        const cx = c % W, cy = (c / W) | 0;
        const opts = [];
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (!inG(nx, ny)) continue;
          const o = occ[ny * W + nx];
          if (o < 0) continue;
          const a = arrows[o];
          if (a.cells[0] !== ny * W + nx || a.cells.length >= maxExt || rayMax[c] >= o || !same(c, a.cells[0])) continue;
          opts.push(a);
        }
        if (!opts.length) continue;
        const a = opts[Math.floor(R() * opts.length)];
        a.cells.unshift(c); occ[c] = a.id; grown++;
      }
      return grown;
    }

    const cells = [];
    for (let i = 0; i < W * H; i++) if (mask[i]) cells.push(i);
    for (let pass = 0; pass < 14; pass++) {
      shuffle(cells, R);
      let placed = 0;
      for (const h of cells) {
        if (occ[h] >= 0) continue;
        const dirs = shuffle([0, 1, 2, 3], R);
        const L = pass < 3 ? sampleLen() : 2 + Math.floor(R() * 3);
        let ok = false;
        for (const d of dirs) { if (tryPlace(h, d, L, false)) { placed++; ok = true; break; } }
        if (!ok && params.single && pass >= 2) for (const d of dirs) { if (tryPlace(h, d, 1, true)) { placed++; break; } }
      }
      const grown = pass >= 1 ? extendPass() + extendPass() : 0;
      if (!placed && !grown) break;
    }
    return arrows;
  }

  /** أول خانة مشغولة في طريق خروج السهم، أو -1 */
  function firstBlock(W, H, occ, arrow) {
    const h = arrow.cells[arrow.cells.length - 1];
    const [dx, dy] = DIRS[arrow.dir];
    let x = h % W + dx, y = ((h / W) | 0) + dy, k = 1;
    while (x >= 0 && y >= 0 && x < W && y < H) {
      const o = occ[y * W + x];
      if (o >= 0 && o !== arrow.id) return { id: o, dist: k, cell: y * W + x };
      x += dx; y += dy; k++;
    }
    return null;
  }

  /** حلّ بالطبقات: يعيد عدد الطبقات وهل الحل ممكن */
  function analyze(level) {
    const { W, H, arrows } = level;
    const occ = new Int32Array(W * H).fill(-1);
    arrows.forEach(a => a.cells.forEach(c => { occ[c] = a.id; }));
    let alive = arrows.slice();
    let layers = 0, firstFree = 0;
    while (alive.length) {
      const free = alive.filter(a => !firstBlock(W, H, occ, a));
      if (!free.length) return { solvable: false, layers, firstFree };
      if (layers === 0) firstFree = free.length;
      free.forEach(a => a.cells.forEach(c => { occ[c] = -1; }));
      const fs = new Set(free);
      alive = alive.filter(a => !fs.has(a));
      layers++;
    }
    return { solvable: true, layers, firstFree };
  }

  function makeLevel(spec) {
    const pic = spec.board ? null : (PICS.PICTURES.find(p => p.id === spec.pic) || PICS.PICTURES[0]);
    const board = spec.board || buildBoard(pic, spec.w || spec.f, spec.mirror);
    const cellsInMask = Math.max(1, board.mask.reduce((s, v, i) => s + (v && !(spec.lock && board.fixed && board.fixed[i]) ? 1 : 0), 0));
    let best = null;
    const tries = spec.tries || 4;
    for (let t = 0; t < tries; t++) {
      const seed = (spec.seed + t * 7919) >>> 0;
      const arrows = fill(board, spec, seed);
      const covered = arrows.reduce((s, a) => s + a.cells.length, 0);
      const lvl = { W: board.W, H: board.H, arrows };
      const an = analyze(lvl);
      if (!an.solvable) continue; // لا يحدث نظرياً
      const fillRatio = covered / cellsInMask;
      const freeRatio = an.firstFree / arrows.length;
      const score = fillRatio * 2 - freeRatio + an.layers * 0.02;
      if (!best || score > best.score) best = { score, arrows, fillRatio, an };
    }
    return {
      W: board.W, H: board.H, mask: board.mask, color: board.color, fixed: board.fixed,
      arrows: best.arrows, pic: pic ? pic.id : spec.id, picName: pic ? pic.name : spec.name, art: !!spec.art,
      fillRatio: best.fillRatio, layers: best.an.layers, spec,
    };
  }

  // ——— تقدّم المراحل ———
  function mainPics() { return PICS.mainPics(); }

  function difficultyOf(cells) {
    if (cells < 90) return 'easy';
    if (cells < 220) return 'normal';
    if (cells < 420) return 'hard';
    return 'expert';
  }

  /** طول الأسهم يكبر مع حجم الرقعة حتى تصير المتاهة متشابكة وأجمل */
  function arrowParams(w, k) {
    return {
      minLen: 2,
      maxLen: Math.min(18, Math.max(4, Math.round(w * 0.42 + Math.min(k, 30) * 0.1))),
      straight: Math.max(0.35, 0.6 - k * 0.005),
      lenBias: Math.max(0.55, 0.95 - k * 0.01),
    };
  }

  function levelSpec(n) {
    const seed = hashStr('siham-level-' + n);
    if (n === 1) return { n, pic: 'gem', f: 1, minLen: 2, maxLen: 3, straight: 0.8, seed, tries: 6 };
    if (n === 2) return { n, pic: 'leaf', f: 1, minLen: 2, maxLen: 4, straight: 0.6, seed, tries: 6 };
    if (n === 3) return { n, pic: 'smile', f: 1, minLen: 2, maxLen: 5, straight: 0.6, seed, tries: 6 };
    const pics = mainPics();
    const k = n - 4;
    const round = Math.floor(k / pics.length);
    const pic = pics[k % pics.length];
    // الدقة (عرض الرقعة بالخانات) تكبر تدريجياً: 12 ← 30
    let w = Math.min(30, Math.round(16 + k * 0.4));
    if (round >= 2) w = 26 + (seed % 5);
    return Object.assign({ n, pic: pic.id, w, mirror: round % 2 === 1, seed }, arrowParams(w, k));
  }

  function dailySpec(dateStr) {
    const seed = hashStr('siham-daily-' + dateStr);
    const R = rng(seed);
    const pics = mainPics();
    const pic = pics[Math.floor(R() * pics.length)];
    const w = 22 + Math.floor(R() * 6);
    return Object.assign({ daily: dateStr, pic: pic.id, w, mirror: R() < 0.5, seed }, arrowParams(w, 30));
  }

  function zenSpec(seedNum) {
    const R = rng(seedNum);
    const pics = mainPics();
    const pic = pics[Math.floor(R() * pics.length)];
    const w = 17 + Math.floor(R() * 8);
    return Object.assign({ zen: true, pic: pic.id, w, mirror: R() < 0.5, seed: seedNum }, arrowParams(w, 8));
  }

  // ——— حزمة "حيوانات من أسهم": الأسهم ملوّنة وترسم الحيوان بنفسها ———
  const artParams = w => ({ minLen: 2, maxLen: Math.min(16, Math.round(w * 0.5)), straight: 0.45, lenBias: 0.7, lock: true, single: true, art: true });
  function packPics() { return PICS.packPics('animals'); }
  function packSpec(i) {
    const pic = packPics()[i];
    const w = pic.w || 24;
    return Object.assign({ pack: i, pic: pic.id, w, seed: hashStr('siham-pack-' + pic.id), tries: 3 }, artParams(w));
  }
  /** خريطة خاصة من رابط هدية: الرقعة جاهزة */
  function customSpec(g) {
    return Object.assign({ custom: g.id, id: g.id, name: { ar: g.name, en: g.name }, board: g.board, seed: hashStr('siham-gift-' + g.id), tries: 3, love: true }, artParams(g.board.W));
  }

  const api = { DIRS, rng, hashStr, buildBoard, fill, firstBlock, analyze, makeLevel, levelSpec, dailySpec, zenSpec, difficultyOf, mainPics, packPics, packSpec, customSpec };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Gen = api;
})(typeof window !== 'undefined' ? window : globalThis);
