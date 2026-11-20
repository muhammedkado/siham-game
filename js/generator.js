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
  function buildBoard(pic, size, mirror, soft) {
    if (pic.shapes || pic.grid) return PICS.rasterize(pic, Math.max(6, Math.round(size)), mirror, soft);
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

    // لوضع "السلسلة": مين من الأسهم طريقه بيمر بكل خانة، ومين لسا ما في شي سادد طريقه
    const rayOwners = params.chain ? Array.from({ length: W * H }, () => []) : null;
    const blocked = [];
    function commit(cells, ray, d) {
      const id = arrows.length;
      for (const c of cells) {
        occ[c] = id;
        if (rayOwners) for (const o of rayOwners[c]) blocked[o] = 1;
      }
      for (const c of ray) { rayMax[c] = id; if (rayOwners) rayOwners[c].push(id); }
      arrows.push({ id, cells, dir: d });
      blocked[id] = 0;
      return true;
    }
    function tryPlace(h, d, targetLen, allowSingle) {
      const p = plan(h, d, targetLen, allowSingle);
      return p ? commit(p.cells, p.ray, d) : false;
    }
    function plan(h, d, targetLen, allowSingle) {
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
        return { cells: [h], ray };
      }
      const path = [h, b];
      const used = new Set(path);
      let px = bx, py = by, wd = (d + 2) % 4;
      while (path.length < targetLen) {
        const left = (wd + 3) % 4, right = (wd + 1) % 4;
        const lr = R() < 0.5 ? [left, right] : [right, left];
        const order = params.straightOnly ? [wd] : R() < params.straight ? [wd, lr[0], lr[1]] : [lr[0], lr[1], wd];
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
      return { cells: path.slice().reverse(), ray }; // من الذيل إلى الرأس
    }

    /* وضع السلسلة (التحدي اليومي الصعب): كل سهم جديد يُختار بحيث يسدّ طريق أكبر عدد من الأسهم
     * "الحرة" حتى الآن. بما إن الحل = عكس ترتيب الوضع، اللاعب يلاقي بأي لحظة سهم أو سهمين بس يقدر يحركهم. */
    function chainFill() {
      const k = params.chain;            // قوة السلسلة: عدد المرشحين لكل سهم
      for (let guard = 0; guard < W * H; guard++) {
        const free = [];
        for (let a = 0; a < arrows.length; a++) if (!blocked[a]) free.push(a);
        const targets = [];
        for (const a of free) { const h = arrows[a].cells[arrows[a].cells.length - 1], [dx, dy] = DIRS[arrows[a].dir];
          let x = h % W + dx, y = ((h / W) | 0) + dy;
          while (inG(x, y)) { const i = y * W + x; if (mask[i] && occ[i] < 0) targets.push(i); x += dx; y += dy; } }
        const empty = cells.filter(c => occ[c] < 0);
        if (!empty.length) break;
        let best = null, tried = 0;
        // رؤوس مرشحة: كل خانات طرق الأسهم الحرة وجيرانها + عيّنة عشوائية
        const heads = new Set(targets);
        for (const c of targets) { const x = c % W, y = (c / W) | 0;
          for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (inG(nx, ny) && mask[ny * W + nx] && occ[ny * W + nx] < 0) heads.add(ny * W + nx); } }
        const pool = shuffle(empty.slice(), R);
        for (let t = 0; t < Math.min(pool.length, k); t++) heads.add(pool[t]);
        const tries = [];
        for (const h of heads) for (let d = 0; d < 4; d++) for (let r = 0; r < 2; r++) tries.push([h, d]);
        for (const [h, d] of tries) {
          {
            const p = plan(h, d, params.chainLen ? 2 + Math.floor(R() * (params.chainLen - 1)) : sampleLen(), false);
            if (!p) continue;
            const hit = new Set();
            for (const c of p.cells) for (const o of rayOwners[c]) if (!blocked[o]) hit.add(o);
            // طريقه لازم يمرّ بخانات فاضية من الرسمة، وإلا بيضل حر للأبد (رأسه عالحافة لبرّا)
            // سقف الأسهم الحرة: سهم بيزيدهم فوق السقف ما بينحط (الخانات الباقية بتكبر فيها ذيول الأسهم)
            if (params.cap && free.length - hit.size + 1 > params.cap) continue;
            const own = new Set(p.cells); let open = 0;
            for (const c of p.ray) if (mask[c] && occ[c] < 0 && !own.has(c)) open++;
            if (params.cap && !open && free.length - hit.size >= 1) continue;   // حر للأبد + في غيره حر = ممنوع
            // الأفضل: يسد كل الحرّين (يبقى هو الحر الوحيد)، وطريقه قابل للسد، وبعدين الأطول
            const sc = hit.size * 10 - (free.length - hit.size) * 25 - (open ? 0 : 60) + Math.min(open, 12) * 1.5 + p.cells.length * 0.3 + R() * 2;
            tried++;
            if (!best || sc > best.sc) best = { sc, p, d };
          }
        }
        if (!best) break;
        commit(best.p.cells, best.p.ray, best.d);
      }
    }

    /* مدّ ذيل سهم موجود إلى خانة فارغة مجاورة.
     * آمن للحل: السهم A يُزال بعد كل الأسهم الموضوعة بعده، فيكفي ألا يمر طريق أي سهم لاحق بالخانة. */
    const maxExt = params.maxExt ? params.maxExt : params.chain ? 30 : Math.max(params.maxLen + 4, Math.round(params.maxLen * 1.6));
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
          if (a.cells.length >= maxExt) continue;
          // ذيل: آمن إذا ما في سهم لاحق طريقه بيمر بالخانة
          const tl = a.cells[0];
          // بالأسهم المستقيمة: الذيل يكبر بنفس الخط بس
          const inLine = !params.straightOnly || (cx === nx - DIRS[a.dir][0] && cy === ny - DIRS[a.dir][1]);
          if (tl === ny * W + nx && inLine && rayMax[c] < o && same(c, tl)) opts.push([a, 0]);
          // رأس: السهم يتقدم خانة لقدام بطريقه، آمن إذا ما في سهم لاحق طريقه بيمر فيها
          const hd = a.cells[a.cells.length - 1];
          if (params.head !== false && hd === ny * W + nx && cx === nx + DIRS[a.dir][0] && cy === ny + DIRS[a.dir][1] && rayMax[c] === o && same(c, hd)) opts.push([a, 1]);
        }
        if (!opts.length) continue;
        const [a, isHead] = opts[Math.floor(R() * opts.length)];
        if (isHead) a.cells.push(c); else a.cells.unshift(c);
        occ[c] = a.id; grown++;
      }
      return grown;
    }

    const cells = [];
    for (let i = 0; i < W * H; i++) if (mask[i]) cells.push(i);
    if (params.chain) {
      chainFill();
      for (let e = 0; e < 40; e++) if (!extendPass()) break;
      return arrows;
    }
    // من الداخل للخارج: الخانات العميقة تاخد أسهمها أولاً (طرقها لسا فاضية)، فالرسمة تتعبى كلها
    let depth = null;
    if (params.inside) {
      depth = new Float32Array(W * H).fill(-1); const q = [];
      for (const c of cells) { const x = c % W, y = (c / W) | 0;
        if (DIRS.some(([dx, dy]) => !inG(x + dx, y + dy) || !mask[(y + dy) * W + x + dx])) { depth[c] = 0; q.push(c); } }
      for (let k = 0; k < q.length; k++) { const c = q[k], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (!inG(nx, ny)) continue; const n = ny * W + nx;
          if (mask[n] && depth[n] < 0) { depth[n] = depth[c] + 1; q.push(n); } } }
      for (const c of cells) depth[c] += R() * params.inside;
    }
    for (let pass = 0; pass < 14; pass++) {
      shuffle(cells, R);
      if (depth) cells.sort((a, b) => depth[b] - depth[a]);
      let placed = 0;
      for (const h of cells) {
        if (occ[h] >= 0) continue;
        const dirs = shuffle([0, 1, 2, 3], R);
        const L = pass < 3 ? sampleLen() : 2 + Math.floor(R() * 3);
        let ok = false;
        for (const d of dirs) { if (tryPlace(h, d, L, false)) { placed++; ok = true; break; } }
        if (!ok && params.single && pass >= (params.singleFrom == null ? 2 : params.singleFrom)) for (const d of dirs) { if (tryPlace(h, d, 1, true)) { placed++; break; } }
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

  /** ضغط اللعب: كم سهم حر بكل لحظة لو اللاعب شال سهم حر وحدة وحدة */
  function pressure(level, seed) {
    const { W, H, arrows } = level, R = rng(seed || 1);
    const occ = new Int32Array(W * H).fill(-1);
    arrows.forEach(a => a.cells.forEach(c => { occ[c] = a.id; }));
    let alive = arrows.slice(), sum = 0, max = 0, steps = 0, ones = 0;
    while (alive.length) {
      const free = alive.filter(a => !firstBlock(W, H, occ, a));
      if (!free.length) return null;
      sum += free.length; steps++; if (free.length > max) max = free.length; if (free.length <= 2) ones++;
      const a = free[Math.floor(R() * free.length)];
      a.cells.forEach(c => { occ[c] = -1; });
      alive = alive.filter(x => x !== a);
    }
    return { avg: sum / steps, max, tight: ones / steps };
  }

  function makeLevel(spec) {
    const pic = spec.board ? null : (PICS.PICTURES.find(p => p.id === spec.pic) || PICS.PICTURES[0]);
    let board = spec.board || buildBoard(pic, spec.w || spec.f, spec.mirror, spec.gem);
    // الأسلوب اللامع: كل خانة سهم، حتى الحدود والعيون
    if (spec.gem && board.fixed) board = Object.assign({}, board, { fixed: null });
    const cellsInMask = Math.max(1, board.mask.reduce((s, v, i) => s + (v && !(spec.lock && board.fixed && board.fixed[i]) ? 1 : 0), 0));
    let best = null;
    const tries = spec.tries || 8;
    for (let t = 0; t < tries; t++) {
      const seed = (spec.seed + t * 7919) >>> 0;
      const arrows = fill(board, spec, seed);
      const covered = arrows.reduce((s, a) => s + a.cells.length, 0);
      const lvl = { W: board.W, H: board.H, arrows };
      const an = analyze(lvl);
      if (!an.solvable) continue; // لا يحدث نظرياً
      const fillRatio = covered / cellsInMask;
      const freeRatio = an.firstFree / arrows.length;
      let score = fillRatio * 2 - freeRatio + an.layers * 0.02;
      if (spec.chain) { const pr = pressure(lvl, seed); score = fillRatio * 2 - pr.avg * 0.6 + pr.tight; }
      if (!best || score > best.score) best = { score, arrows, fillRatio, an };
    }
    return {
      W: board.W, H: board.H, mask: board.mask, color: board.color, fixed: board.fixed,
      arrows: best.arrows, pic: pic ? pic.id : spec.id, picName: pic ? pic.name : spec.name, art: !!spec.art, gem: !!spec.gem, skin: spec.skin || 0,
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
    // صعب جداً ويصعب كل يوم: الرقعة تكبر، الأسهم أطول، وبأي لحظة سهم أو سهمين بس قابلين للحركة
    const day = dailyIndex(dateStr);
    const w = Math.min(36, 24 + Math.floor(day / 2) + Math.floor(R() * 3));
    const chainLen = Math.min(9, 5 + Math.floor(day / 5));
    return Object.assign({ daily: dateStr, day, pic: pic.id, w, mirror: R() < 0.5, seed, tries: 6 }, arrowParams(w, 30),
      { chain: 40, cap: 2, chainLen, maxExt: 16 + chainLen * 2 });
  }
  /** رقم اليوم منذ إطلاق التحدي اليومي الصعب (20 نوفمبر 2026 = اليوم 1) */
  function dailyIndex(dateStr) {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    return Math.max(0, Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 10, 20)) / 864e5));
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
  // الأسلوب اللامع (متل صورة الفطر والتفاحة): أسهم قصيرة مستقيمة، كل خانة بلون اللوحة مع تظليلها
  const gemParams = () => ({ inside: 1.5, minLen: 2, maxLen: 2, straight: 1, straightOnly: true, lenBias: 1, lock: true, single: true, art: true, gem: true, maxExt: 2, singleFrom: 0 });
  // الحزمة: الحيوانات أولاً ثم كل لوحات الرحلة، كلها بالأسلوب اللامع
  const PACKS = ['animals', 'sea', 'sweets'];
  function packPics() { return PACKS.reduce((a, k) => a.concat(PICS.packPics(k)), []).concat(PICS.mainPics()); }
  /** أقسام شاشة اللوحات: [{key, start, count}] */
  function packGroups() {
    const out = []; let i = 0;
    for (const k of PACKS.concat(['classic'])) { const n = k === 'classic' ? PICS.mainPics().length : PICS.packPics(k).length; out.push({ key: k, start: i, count: n }); i += n; }
    return out;
  }
  // عرض اللوحة: أكبر شي لحد 18 خانة بشرط ما تزيد الخانات عن ~300 (كي ما يصير عدد الأسهم كبير كتير)
  const packWCache = {};
  const packW = pic => {
    if (packWCache[pic.id]) return packWCache[pic.id];
    let w = Math.min(pic.w || 18, 18);
    while (w > 12 && buildBoard(pic, w, false, true).mask.reduce((a, v) => a + v, 0) > 300) w--;
    return (packWCache[pic.id] = w);
  };
  function packBoard(i) { const pic = packPics()[i]; return Object.assign({}, buildBoard(pic, packW(pic), false, true), { fixed: null }); }
  function packSpec(i) {
    const pic = packPics()[i];
    // ستايل الأسهم يختاره اللاعب من المتجر (engine.packSkin)
    return Object.assign({ pack: i, pic: pic.id, w: packW(pic), seed: hashStr('siham-gem-' + pic.id), tries: 3, skin: 0 }, gemParams());
  }
  /** خريطة خاصة من رابط هدية: الرقعة جاهزة */
  function customSpec(g) {
    return Object.assign({ custom: g.id, id: g.id, name: { ar: g.name, en: g.name }, board: g.board, seed: hashStr('siham-gift-' + g.id), tries: 3, love: true }, artParams(g.board.W));
  }

  const api = { DIRS, rng, hashStr, buildBoard, fill, firstBlock, analyze, pressure, makeLevel, levelSpec, dailySpec, dailyIndex, zenSpec, difficultyOf, mainPics, packPics, packGroups, packBoard, packSpec, customSpec };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Gen = api;
})(typeof window !== 'undefined' ? window : globalThis);
