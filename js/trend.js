/* سهام — خرائط "ترند اليوم" من الإنترنت (بدون تحديث التطبيق)
 * التطبيق يقرأ daily/index.json من موقع اللعبة: بيانات رسومات فقط (أشكال أو شبكات)، ما فيها أي كود.
 * كل خريطة نتحقق منها بدقة قبل ما تنضاف، ونحفظها بالجهاز فتشتغل بدون إنترنت.
 */
(function (root) {
  'use strict';
  const FEED = 'https://muhammedkado.github.io/siham-game/daily/';
  const KEY = 'siham.trend.v1', MAX_KEEP = 400;

  // ——— التحقق: ننسخ فقط الحقول المعروفة وبحدود معقولة ———
  const num = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
  const str = (v, max) => typeof v === 'string' && v.length >= 1 && v.length <= max;
  const HEX = /^#[0-9a-f]{6}$/i;
  const SHAPE_NUM = { c: ['x', 'y', 'r'], e: ['x', 'y', 'rx', 'ry', 'a'], r: ['x', 'y', 'w', 'h', 'r'], p: [], l: ['w'] };
  function cleanShape(s, palette) {
    if (!s || typeof s !== 'object' || !SHAPE_NUM[s.t]) return null;
    const o = { t: s.t };
    for (const k of SHAPE_NUM[s.t]) {
      const v = s[k] == null && (k === 'a' || (k === 'r' && s.t === 'r')) ? 0 : s[k];
      if (!num(v, -400, 400)) return null;
      o[k] = v;
    }
    if (s.t === 'p' || s.t === 'l') {
      if (!Array.isArray(s.p) || s.p.length < 4 || s.p.length > 240 || s.p.length % 2 || !s.p.every(v => num(v, -400, 400))) return null;
      o.p = s.p.slice();
    }
    if (s.cut === true) o.cut = true;
    else if (typeof s.c === 'string' && /^[A-Za-z]$/.test(s.c) && (palette[s.c] || (root.PALETTE && root.PALETTE[s.c]))) o.c = s.c;
    else return null;
    if (s.sh === 'n') o.sh = 'n';
    if (num(s.pri, 0, 9)) o.pri = s.pri;
    if (s.ol === true) o.ol = true;
    if (typeof s.g === 'string' && /^[a-z0-9]{1,12}$/i.test(s.g)) o.g = s.g;
    return o;
  }
  function cleanGrid(g) {
    if (!g || !num(g.W, 6, 64) || !num(g.H, 6, 90) || g.W % 1 || g.H % 1) return null;
    if (typeof g.pal !== 'string' || !/^([0-9a-f]{6}){1,40}$/i.test(g.pal)) return null;
    if (typeof g.data !== 'string' || !/^[A-Za-z0-9_-]+$/.test(g.data)) return null;
    try {
      const bin = atob(g.data.replace(/-/g, '+').replace(/_/g, '/'));
      if (bin.length !== g.W * g.H) return null;
    } catch (e) { return null; }
    return { W: g.W, H: g.H, pal: g.pal.toLowerCase(), data: g.data };
  }
  /** خريطة من الإنترنت → لوحة جاهزة للعبة، أو null إذا فيها أي شي غلط */
  function clean(m) {
    if (!m || typeof m !== 'object') return null;
    if (typeof m.id !== 'string' || !/^t-[a-z0-9-]{2,40}$/.test(m.id)) return null;
    if (!m.name || !str(m.name.ar, 30) || !str(m.name.en, 30)) return null;
    const o = { id: m.id, pack: 'trend', name: { ar: m.name.ar, en: m.name.en }, remote: true };
    if (typeof m.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.d)) o.d = m.d;
    if (num(m.w, 10, 30)) o.w = Math.round(m.w);
    if (num(m.ratio, 0.5, 3)) o.ratio = m.ratio;
    if (m.flat) o.flat = 1;
    if (m.palette != null) {
      if (typeof m.palette !== 'object') return null;
      const pal = {};
      for (const k of Object.keys(m.palette)) {
        if (!/^[A-Za-z]$/.test(k) || !HEX.test(m.palette[k])) return null;
        pal[k] = m.palette[k].toLowerCase();
      }
      o.palette = pal;
    }
    if (Array.isArray(m.shapes)) {
      if (m.shapes.length < 1 || m.shapes.length > 200) return null;
      if (m.view != null && !(Array.isArray(m.view) && m.view.length === 2 && num(m.view[0], 10, 400) && num(m.view[1], 10, 400))) return null;
      if (m.view) o.view = [m.view[0], m.view[1]];
      o.shapes = [];
      for (const s of m.shapes) { const c = cleanShape(s, o.palette || {}); if (!c) return null; o.shapes.push(c); }
    } else if (Array.isArray(m.grids)) {
      if (m.grids.length < 1 || m.grids.length > 6) return null;
      o.grids = [];
      for (const g of m.grids) { const c = cleanGrid(g); if (!c) return null; o.grids.push(c); }
      o.grids.sort((a, b) => a.W - b.W);
      if (typeof m.hd === 'string' && /^hd\/[a-z0-9-]{2,60}\.webp$/.test(m.hd)) o.hd = FEED + m.hd;
    } else return null;
    return o;
  }

  // ——— التخزين بالجهاز ———
  let cache = { order: [], maps: {} };
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && Array.isArray(c.order) && c.maps && typeof c.maps === 'object') cache = c;
  } catch (e) { /* ignore */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* ignore */ } };

  const added = {};
  /** نضيف اللوحة لقائمة اللوحات (مرة وحدة)؛ ترتيب الإضافة ثابت فما بتتغير أرقام الحزم القديمة */
  function attach(raw) {
    const p = clean(raw);
    if (!p || added[p.id] || (root.PICTURES || []).some(x => x.id === p.id)) return null;
    root.PICTURES.push(p); added[p.id] = 1;
    return p;
  }
  cache.order.forEach(id => attach(cache.maps[id]));

  /** الخرائط الجديدة: الأحدث أولاً */
  function list() { return (root.PICTURES || []).filter(p => p.pack === 'trend').slice().reverse(); }

  /** نجيب آخر الخرائط من الإنترنت؛ keep(): معرّفات لازم تضل محفوظة (مستعملة بمراحل اللاعب) */
  let busy = null;
  function refresh(keep) {
    if (busy) return busy;
    if (typeof fetch !== 'function' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return Promise.resolve([]);
    busy = fetch(FEED + 'index.json', { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const fresh = [];
        if (!j || j.v !== 1 || !Array.isArray(j.maps)) return fresh;
        for (const m of j.maps.slice(0, 120)) {
          if (!m || typeof m.id !== 'string' || cache.maps[m.id]) continue;
          const p = attach(m);
          if (!p) continue;
          cache.maps[m.id] = m; cache.order.push(m.id); fresh.push(p);
        }
        if (fresh.length) {
          // نحد الحجم: نشيل الأقدم إلا اللي مستعمل بمراحل اللاعب
          const hold = new Set((keep && keep()) || []);
          while (cache.order.length > MAX_KEEP) {
            const i = cache.order.findIndex(id => !hold.has(id));
            if (i < 0) break;
            delete cache.maps[cache.order[i]]; cache.order.splice(i, 1);
          }
          persist();
        }
        return fresh;
      })
      .catch(() => [])
      .then(f => { busy = null; return f; });
    return busy;
  }

  const api = { FEED, clean, list, refresh, _shape: cleanShape, _grid: cleanGrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Trend = api;
})(typeof window !== 'undefined' ? window : globalThis);
