/* سهام — واجهة التطبيق: الشاشات، الحفظ، الأوضاع */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'siham.v1';

  // ——— الحفظ ———
  const DEFAULT = {
    level: 1, stars: {}, hints: 3, lenses: 3, pics: {}, pack: {}, gifts: [], ad: { wins: 0, last: 0 },
    daily: { last: null, streak: 0 },
    set: { theme: 'light', sound: true, music: true, vibe: true, lang: 'ar', safe: true },
    seen: {},
    // اقتصاد اللعبة: عملات + ستايلات أسهم + صندوق كنز + هدية يومية
    coins: 150, own: { trail: [0, 1], skin: [0] }, eq: { trail: 1, skin: 0 }, chest: 0, chestReady: 0,
    login: { last: null, day: 0 },
    // إحصائيات: أفضل نتيجة لكل مرحلة + عدد مراحل اليوم
    rec: {}, today: { d: null, n: 0 }, wins: 0,
  };
  const fresh = () => JSON.parse(JSON.stringify(DEFAULT));
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  S.set = Object.assign({}, DEFAULT.set, S.set);
  S.daily = Object.assign({}, DEFAULT.daily, S.daily);
  S.own = Object.assign(fresh().own, S.own); S.eq = Object.assign(fresh().eq, S.eq); S.login = Object.assign(fresh().login, S.login);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

  const t = k => (I18N[S.set.lang] || I18N.ar)[k] || I18N.ar[k] || k;

  // ——— أدوات ———
  // داخل تطبيق أندرويد: الاهتزاز ولون الأشرطة عبر جسر التطبيق (AndroidBridge)
  const NATIVE = window.AndroidBridge || null;
  // ——— الإعلانات (داخل تطبيق أندرويد فقط) ———
  // بانر في شاشات القوائم فقط، إعلان بين المراحل بحد أقصى مرة كل 3 مراحل ودقيقتين،
  // وإعلانات بمكافأة يختارها اللاعب بنفسه (تلميحات، عدسات، قلب إضافي، هدية الفوز)
  const ADS = (() => { try { return !!(NATIVE && NATIVE.adsOn && NATIVE.adsOn()); } catch (e) { return false; } })();
  const Ads = {
    cbs: {},
    banner(on) { if (ADS) try { NATIVE.setBanner(!!on); } catch (e) { /* ignore */ } },
    ready() { if (!ADS) return false; try { return !!NATIVE.rewardedReady(); } catch (e) { return false; } },
    reward(tag, cb) { if (!ADS) return; Ads.cbs[tag] = cb; try { NATIVE.showRewarded(tag); } catch (e) { delete Ads.cbs[tag]; } },
    /** يُستدعى عند مغادرة شاشة الفوز */
    afterWin() {
      if (!ADS || G.mode === 'gift') return;
      S.ad.wins = (S.ad.wins || 0) + 1; save();
      if (S.level < 5 || S.ad.wins < 3 || Date.now() - (S.ad.last || 0) < 120000) return;
      try { if (NATIVE.interReady()) { NATIVE.interstitial(); S.ad.wins = 0; S.ad.last = Date.now(); save(); } } catch (e) { /* ignore */ }
    },
  };
  window.__adEvent = function (type, tag) {
    const cb = Ads.cbs[tag];
    delete Ads.cbs[tag];
    if (type === 'reward') { S.ad.last = Date.now(); save(); if (cb) cb(); }
    else if (type === 'failed') toast(t('adFail'));
  };

  function vibrate(ms) {
    if (!S.set.vibe) return;
    try {
      if (NATIVE) NATIVE.vibrate(String([].concat(ms)));
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* ignore */ }
  }
  let toastTimer = 0;
  function toast(msg, ms, html) {
    const el = $('toast');
    if (html) el.innerHTML = msg; else el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2200);
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls) => `<svg class="ico ${cls || ''}"><use href="#${id}"/></svg>`;
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const yesterday = () => { const d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();

  /** يرسم لوحة (من فن البكسل أو من رقعة مرحلة) على canvas */
  function drawPic(canvas, src, mode) {
    // src: {W,H,mask,color} ؛ mode: 'full' | 'silhouette'
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const size = canvas.clientWidth || canvas.width;
    canvas.width = size * dpr; canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const s = size / Math.max(src.W, src.H);
    const ox = (size - src.W * s) / 2, oy = (size - src.H * s) / 2;
    const sil = cssVar('--cell');
    for (let i = 0; i < src.W * src.H; i++) {
      if (!src.mask[i]) continue;
      const x = i % src.W, y = (i / src.W) | 0;
      ctx.fillStyle = mode === 'silhouette' ? sil : src.color[i];
      ctx.fillRect(Math.floor(ox + x * s), Math.floor(oy + y * s), Math.ceil(s) + 0.5, Math.ceil(s) + 0.5);
    }
  }
  const picBoard = id => Gen.buildBoard(PICTURES.find(p => p.id === id), 32, false);
  /** النسخة الناعمة (HD) من لوحة — null إذا ما إلها نسخة (لوحات التعليم والهدايا) */
  function picHD(id, size, mirror, cb, k) {
    const pic = PICTURES.find(p => p.id === id);
    if (!pic || !(pic.shapes || pic.hd)) return null;
    return hdCanvas(pic, Math.max(6, Math.round(size || 20)), !!mirror, k || 32, false, cb);
  }
  /** يرسم لوحة بنسختها الناعمة إذا موجودة، وإلا بالبكسل */
  function drawArt(canvas, id, size, mirror, mode, fallback) {
    const hd = id ? picHD(id, size, mirror, () => drawArt(canvas, id, size, mirror, mode, fallback)) : null;
    if (!hd || !hd._ready) { if (fallback) drawPic(canvas, fallback, mode); return; }
    const dpr = Math.min(3, window.devicePixelRatio || 1), sz = canvas.clientWidth || canvas.width;
    canvas.width = sz * dpr; canvas.height = sz * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, sz, sz);
    const s = Math.min(sz / hd.width, sz / hd.height) * 0.96, w = hd.width * s, h = hd.height * s;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(hd, (sz - w) / 2, (sz - h) / 2, w, h);
    if (mode === 'silhouette') { ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = cssVar('--cell'); ctx.fillRect(0, 0, sz, sz); ctx.globalCompositeOperation = 'source-over'; }
  }
  const picCount = () => Gen.mainPics().filter(p => S.pics[p.id]).length;

  // ——— الشاشات ———
  let current = 'home', prevScreen = 'home';
  function show(id) {
    if (id === 'back') id = prevScreen === 'settings' ? 'home' : prevScreen;
    if (id !== current) prevScreen = current;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    current = id;
    if (id === 'home') renderHome();
    if (id === 'levels') renderLevels();
    if (id === 'gallery') renderGallery();
    if (id === 'settings') renderSettings();
    if (id === 'pack') renderPack();
    if (id === 'shop') renderShop();
    coinUI();
    Ads.banner(id !== 'game');
    if (id === 'game') requestAnimationFrame(() => engine.resize());
    else { Music.stop(); idleStop(); }
    if (id === 'home') setTimeout(maybeLogin, 350);
  }
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { Sound.click(); show(b.dataset.go); }));

  function applyI18n() {
    document.documentElement.lang = S.set.lang;
    document.documentElement.dir = S.set.lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  }
  function applyTheme() {
    document.body.dataset.theme = S.set.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = cssVar('--bg');
    if (NATIVE) try { NATIVE.setBars(cssVar('--bg'), S.set.theme === 'dark'); } catch (e) { /* ignore */ }
    engine.setTheme({ bg: cssVar('--bg'), cell: cssVar('--cell'), ink: cssVar('--ink'), dot: cssVar('--sub'), accent: cssVar('--accent'), danger: cssVar('--danger'), ok: cssVar('--ok'), edge: cssVar('--edge'), shadow: cssVar('--board-shadow'), ghost: parseFloat(cssVar('--ghost')) || 0.13 });
    Sound.setEnabled(S.set.sound);
    Music.setEnabled(S.set.music);
  }

  // ——— الرئيسية ———
  function totalStars() { return Object.values(S.stars).reduce((a, b) => a + b, 0); }
  function renderHome() {
    $('h-stars').textContent = totalStars();
    $('h-pics').textContent = picCount() + '/' + Gen.mainPics().length;
    $('h-level').textContent = t('level') + ' ' + S.level;
    const spec = Gen.levelSpec(S.level);
    const cv = $('h-mystery');
    drawArt(cv, spec.pic, spec.w || spec.f, spec.mirror, 'silhouette', Gen.buildBoard(PICTURES.find(p => p.id === spec.pic), spec.w || spec.f, spec.mirror));
    $('h-pack').textContent = Gen.packPics().filter(p => S.pack[p.id]).length + '/' + Gen.packPics().length;
    renderRank(); renderChestBar();
    $('h-daily').innerHTML = S.daily.last === today() ? t('dailyDone') : (S.daily.streak > 0 && S.daily.last === yesterday() ? icon('i-fire') + ' ' + t('streak') + ' ' + S.daily.streak : t('dailyHard').replace('{n}', Gen.dailyIndex(today()) + 1));
  }

  // ——— المراحل ———
  function renderLevels() {
    const g = $('level-grid');
    const max = Math.max(S.level + 15, 40);
    let h = '';
    for (let n = 1; n <= max; n++) {
      if (n > S.level) { h += `<button class="lv locked" disabled>${icon('i-lock')}</button>`; continue; }
      const st = S.stars[n] || 0;
      h += `<button class="lv ${n === S.level ? 'cur' : ''}" data-n="${n}">${n}<span class="st">${[1, 2, 3].map(i => icon('i-star', i <= st ? 'on' : '')).join('')}</span></button>`;
    }
    g.innerHTML = h;
    g.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => startLevel(+b.dataset.n)));
    const cur = g.querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
  }

  // ——— المعرض ———
  function renderGallery() {
    const g = $('gal-grid');
    const pics = Gen.mainPics();
    $('gal-count').textContent = picCount() + '/' + pics.length;
    g.innerHTML = pics.map(p => `<div class="gal ${S.pics[p.id] ? '' : 'locked'}"><canvas data-p="${p.id}"></canvas><span>${S.pics[p.id] ? p.name[S.set.lang] : '؟'}</span></div>`).join('');
    requestAnimationFrame(() => g.querySelectorAll('canvas').forEach(c => drawArt(c, c.dataset.p, 24, false, S.pics[c.dataset.p] ? 'full' : 'silhouette', picBoard(c.dataset.p))));
  }

  // ——— حيوانات من أسهم + الخرائط الخاصة (هدايا عبر رابط) ———
  /** الرابط يحمل الرقعة كاملة بعد # : الاسم~العرض~الطول~الألوان~البيانات */
  function decodeGift(raw) {
    try {
      const [nm, w, h, pal, data] = String(raw).split('~');
      const W = +w, H = +h;
      if (!(W > 1 && H > 1 && W <= 64 && H <= 90) || !data) return null;
      const cols = (pal.match(/[0-9a-fA-F]{6}/g) || []).map(c => '#' + c.toLowerCase());
      const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
      if (bin.length !== W * H) return null;
      const mask = new Uint8Array(W * H), color = new Array(W * H).fill(null), fixed = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const v = bin.charCodeAt(i), k = v & 127;
        if (k && cols[k - 1]) { mask[i] = 1; color[i] = cols[k - 1]; fixed[i] = v & 128 ? 1 : 0; }
      }
      return { id: 'g' + Gen.hashStr(String(raw)).toString(36), name: decodeURIComponent(nm).slice(0, 40), board: { W, H, mask, color, fixed } };
    } catch (e) { return null; }
  }
  const gifts = () => S.gifts.map(decodeGift).filter(Boolean);

  function renderPack() {
    const g = $('pack-grid'), pics = Gen.packPics(), gl = gifts();
    $('pack-count').textContent = pics.filter(p => S.pack[p.id]).length + '/' + pics.length;
    const stars = st => `<span class="st">${[1, 2, 3].map(i => icon('i-star', i <= st ? 'on' : '')).join('')}</span>`;
    const GN = { animals: 'packAnimals', sea: 'packSea', sweets: 'packSweets', classic: 'packClassic' };
    g.innerHTML = gl.map(x => `<button class="pk love" data-k="g:${x.id}"><canvas></canvas><span>${esc(x.name)}</span>${stars(S.pack[x.id] || 0)}</button>`).join('')
      + Gen.packGroups().map(gr => {
        const done = pics.slice(gr.start, gr.start + gr.count).filter(p => S.pack[p.id]).length;
        const isNew = gr.key === 'sea' || gr.key === 'sweets';
        return `<h4 class="pk-head">${t(GN[gr.key])}${isNew ? `<i class="new">${t('newBadge')}</i>` : ''}<small>${done}/${gr.count}</small></h4>`
          + pics.slice(gr.start, gr.start + gr.count).map((p, j) => `<button class="pk" data-k="p:${gr.start + j}"><canvas></canvas><span>${esc(p.name[S.set.lang])}</span>${stars(S.pack[p.id] || 0)}</button>`).join('');
      }).join('');
    g.querySelectorAll('.pk').forEach(b => b.addEventListener('click', () => {
      Sound.unlock(); Sound.click();
      const k = b.dataset.k;
      if (k[0] === 'g') startGift(k.slice(2)); else startPack(+k.slice(2));
    }));
    requestAnimationFrame(() => g.querySelectorAll('.pk').forEach(b => {
      const k = b.dataset.k;
      if (k[0] === 'g') { drawPic(b.querySelector('canvas'), gl.find(x => x.id === k.slice(2)).board, 'full'); return; }
      const i = +k.slice(2), pic = Gen.packPics()[i];
      drawArt(b.querySelector('canvas'), pic.id, 20, false, 'full', Gen.packBoard(i));
    }));
  }

  function checkGift() {
    const m = /[#&]gift=([^&]+)/.exec(location.hash || '');
    if (!m) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    const g = decodeGift(m[1]);
    if (!g) return;
    if (!gifts().some(x => x.id === g.id)) { S.gifts.unshift(m[1]); save(); }
    modal(`<h3>🎁</h3><p>${t('giftTitle')}</p><h3 class="gift-name">${esc(g.name)}</h3><canvas id="m-pic"></canvas>
      <div class="m-actions"><button class="btn primary" data-a="play">${t('giftPlay')}</button><button class="btn" data-a="later">${t('later')}</button></div>`,
    { play: () => { closeModal(); startGift(g.id); }, later: () => { closeModal(); show('pack'); } });
    requestAnimationFrame(() => drawPic($('m-pic'), g.board, 'full'));
  }

  // ——— الإعدادات ———
  function renderSettings() {
    let priv = false;
    try { priv = ADS && NATIVE.privacyRequired(); } catch (e) { /* ignore */ }
    $('set-privacy').classList.toggle('hidden', !priv);
    $('set-apk').classList.toggle('hidden', !!NATIVE || location.protocol === 'file:');
    document.querySelectorAll('#set-theme button').forEach(b => b.classList.toggle('on', b.dataset.v === S.set.theme));
    document.querySelectorAll('#set-lang button').forEach(b => b.classList.toggle('on', b.dataset.v === S.set.lang));
    $('set-music').checked = S.set.music;
    $('set-sound').checked = S.set.sound; $('set-vibe').checked = S.set.vibe; $('set-safe').checked = S.set.safe;
  }
  document.querySelectorAll('#set-theme button').forEach(b => b.addEventListener('click', () => { S.set.theme = b.dataset.v; save(); applyTheme(); renderSettings(); }));
  document.querySelectorAll('#set-lang button').forEach(b => b.addEventListener('click', () => { S.set.lang = b.dataset.v; save(); applyI18n(); renderSettings(); }));
  $('set-sound').addEventListener('change', e => { S.set.sound = e.target.checked; save(); Sound.setEnabled(S.set.sound); });
  $('set-music').addEventListener('change', e => {
    S.set.music = e.target.checked; save();
    Music.setEnabled(S.set.music);
  });
  $('set-privacy').addEventListener('click', () => { try { NATIVE.privacyOptions(); } catch (e) { /* ignore */ } });
  $('set-vibe').addEventListener('change', e => { S.set.vibe = e.target.checked; save(); vibrate(20); });
  $('set-safe').addEventListener('change', e => { S.set.safe = e.target.checked; save(); engine.safeTap = S.set.safe; });
  $('set-reset').addEventListener('click', () => {
    modal(`<h3>⚠️</h3><p>${t('resetConfirm')}</p><div class="m-actions"><button class="btn" data-a="yes" style="color:var(--danger)">${t('yes')}</button><button class="btn primary" data-a="no">${t('no')}</button></div>`, {
      yes: () => { const set = S.set, gf = S.gifts; S = fresh(); S.set = set; S.gifts = gf; save(); applyStyle(); closeModal(); show('home'); },
      no: closeModal,
    });
  });

  // ——— النوافذ ———
  let modalOpen = null;
  function modal(html, actions, opts) {
    $('modal-card').innerHTML = html;
    $('modal').classList.remove('hidden');
    modalOpen = Object.assign({ actions }, opts || {});
    $('modal-card').querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => { Sound.click(); actions[b.dataset.a](); }));
  }
  function closeModal() { $('modal').classList.add('hidden'); modalOpen = null; }

  // ——— اللعب ———
  const G = { mode: 'journey', n: 1, level: null, usedChance: false, combo: 0, lastExit: 0, coachStep: 0, streak: 0, best: 0, miss: 0, nudge: 0 };
  const engine = new Engine($('board'), {
    onExit(left, total) {
      const now = performance.now();
      G.combo = now - G.lastExit < 1400 ? G.combo + 1 : 0;
      G.lastExit = now;
      G.streak++; G.best = Math.max(G.best, G.streak); G.miss = 0; G.nudge = 0;
      engine.setHot(G.streak >= 12 ? 3 : G.streak >= 8 ? 2 : G.streak >= 5 ? 1 : 0);
      Sound.pop(total - left - 1, total, G.combo);
      Music.setProgress(1 - left / total);
      vibrate(10);
      updateHud();
      hideCoach(); hideNudge();
      idleArm();
      streakFx(left, total);
    },
    onMistake(hearts) {
      Sound.bump(); vibrate([40, 30, 60]);
      G.combo = 0;
      if (G.streak >= 3) { const sb = $('g-streak'); sb.classList.remove('bump'); sb.classList.add('broke'); }
      G.streak = 0; engine.setHot(0);
      G.miss++; G.misses++;
      updateHud(true);
      if (G.mode === 'journey' && G.n === 1 && !S.seen.coach2) { S.seen.coach2 = 1; save(); coach(t('coach2')); }
      else if (G.miss >= 2 && !G.calmShown && (engine.zen || hearts > 0)) {
        G.calmShown = true;
        nudgeShow(G.mode === 'zen' || S.lenses > 0 ? t('calmLens') : t('calm'), '😌', true);
      }
    },
    onWin, onLose,
    onLens(ok) { Sound.lens(ok); toast(ok ? t('lensClear') : t('lensBlocked')); if (G.mode !== 'zen') { S.lenses--; save(); } setLensUI(false); updateTools(); },
    onAutoZoom() { toast(t('autoZoom')); vibrate(15); },
    onTrace() { vibrate(15); hideCoach(); },
  });
  engine.safeTap = S.set.safe;

  // الوقت لا يُحسب والتطبيق في الخلفية
  document.addEventListener('visibilitychange', () => {
    if (!G.t0) return;
    if (document.hidden) G.hidAt = Date.now();
    else if (G.hidAt) { G.t0 += Date.now() - G.hidAt; G.hidAt = 0; }
  });

  function startLevel(n) {
    G.mode = 'journey'; G.n = n;
    launch(Gen.makeLevel(Gen.levelSpec(n)), 3);
    $('g-title').textContent = t('level') + ' ' + n;
    const tips = { 1: 'coach1', 3: 'coach3', 4: 'coach4', 5: 'coach5' };
    if (tips[n] && !S.seen[tips[n]]) { S.seen[tips[n]] = 1; save(); setTimeout(() => coach(t(tips[n])), 350); }
  }
  function startPack(i) {
    const pic = Gen.packPics()[i];
    if (!pic) { show('pack'); return; }
    G.mode = 'pack'; G.n = 0; G.pk = i;
    const lv = Gen.makeLevel(Gen.packSpec(i));
    launch(lv, 3);
    $('g-title').textContent = pic.name[S.set.lang];
  }
  function startGift(id) {
    const g = gifts().find(x => x.id === id);
    if (!g) { show('pack'); return; }
    G.mode = 'gift'; G.n = 0; G.gift = g;
    launch(Gen.makeLevel(Gen.customSpec(g)), 3);
    $('g-title').textContent = g.name;
  }
  function startDaily() {
    G.mode = 'daily'; G.n = 0;
    launch(Gen.makeLevel(Gen.dailySpec(today())), 3);
    $('g-title').textContent = t('dailyDay').replace('{n}', Gen.dailyIndex(today()) + 1);
    $('g-diff').textContent = t('insane');
  }
  function startZen() {
    G.mode = 'zen'; G.n = 0;
    launch(Gen.makeLevel(Gen.zenSpec((Math.random() * 1e9) >>> 0)), 0, true);
    $('g-title').textContent = t('zen');
  }
  function launch(level, hearts, zen) {
    G.level = level; G.usedChance = false; G.combo = 0;
    G.streak = 0; G.best = 0; G.miss = 0; G.nudge = 0; G.calmShown = false; G.adHearts = 0; G.bonus = 0;
    G.t0 = Date.now(); G.hidAt = 0; G.hintsUsed = 0; G.misses = 0;
    applyStyle();
    hideCoach(); hideNudge(true); closeModal(); setLensUI(false); clearFx();
    show('game');
    engine.load(level, { hearts, zen });
    // نجهّز النسخة الناعمة من اللوحة (تظهر مكان البكسلات لحظة الفوز)
    const sp = level.spec || {};
    if (sp.pic && G.mode !== 'gift') setTimeout(() => {
      if (engine.L !== level) return;
      const pic = PICTURES.find(p => p.id === sp.pic);
      if (!pic || !(pic.shapes || pic.hd)) return;
      const sz = Math.max(6, Math.round(sp.w || sp.f)), r = rasterize(pic, sz, !!sp.mirror);
      if (r.W !== level.W || r.H !== level.H) return;
      let bmpDone = false;
      const toBmp = cv => { if (bmpDone || engine.L !== level || !window.createImageBitmap) return; bmpDone = true; createImageBitmap(cv).then(bm => { if (engine.L === level) engine.hdBmp = bm; }).catch(() => {}); };
      engine.hd = picHD(sp.pic, sz, sp.mirror, toBmp, 32);
      if (engine.hd && engine.hd._ready) toBmp(engine.hd);
    }, 450);
    idleArm();
    const cells = level.mask.reduce((a, b) => a + b, 0);
    const diff = Gen.difficultyOf(level.art ? level.arrows.length * 3.5 : cells);
    $('g-diff').textContent = zen ? '🍃' : t(diff);
    G.diff = zen ? null : diff;
    // موسيقى هادئة أو حماسية حسب المرحلة
    G.style = zen || G.mode === 'pack' || G.mode === 'gift' ? 'calm'
      : G.mode === 'daily' ? 'hype'
      : (diff === 'hard' || diff === 'expert' || (G.n > 3 && G.n % 5 === 0)) ? 'hype' : 'calm';
    G.seed = level.spec.seed;
    Music.start(G.style, G.seed);
    updateHud(); updateTools();
  }
  function restart() {
    if (G.mode === 'journey') startLevel(G.n);
    else if (G.mode === 'daily') startDaily();
    else if (G.mode === 'pack') startPack(G.pk);
    else if (G.mode === 'gift') startGift(G.gift.id);
    else launch(G.level, 0, true);
  }

  function updateHud(lost, gained) {
    $('g-left').textContent = engine.left;
    const hb = $('g-hearts');
    if (engine.zen) hb.innerHTML = '<span class="inf">∞</span>';
    else {
      const max = Math.max(3, engine.hearts);
      let h = '';
      for (let i = 0; i < max; i++) h += icon('i-heart', i < engine.hearts ? (gained && i === engine.hearts - 1 ? 'gain' : '') : 'lost' + (lost && i === engine.hearts ? ' breaking' : ''));
      hb.innerHTML = h;
    }
    const pct = Math.round(100 * (1 - engine.left / engine.total));
    $('g-bar').style.width = pct + '%';
    $('g-pct').textContent = pct + '% ' + t('revealed');
  }
  function updateTools() {
    const zen = G.mode === 'zen';
    const bh = $('b-hint'), bl = $('b-lens');
    bh.textContent = zen ? '∞' : S.hints; bh.classList.toggle('zero', !zen && S.hints <= 0);
    bl.textContent = zen ? '∞' : S.lenses; bl.classList.toggle('zero', !zen && S.lenses <= 0);
  }
  function setLensUI(on) { engine.armLens(on); $('t-lens').classList.toggle('armed', on); }

  let coachTimer = 0;
  function coach(txt) { const c = $('coach'); c.textContent = txt; c.classList.remove('hidden'); clearTimeout(coachTimer); coachTimer = setTimeout(hideCoach, 6500); }
  function hideCoach() { $('coach').classList.add('hidden'); }

  // ——— التواصل مع اللاعب ———
  // 1) كلمات طائرة (سلسلة / محطات) — بالدور حتى لا تتراكب
  const FX = { queue: [], timer: 0 };
  function floater(html, cls) {
    // كلمة سلسلة جديدة تلغي كلمة سلسلة أقدم ما زالت تنتظر دورها
    if (cls !== 'info') FX.queue = FX.queue.filter(q => q.cls === 'info');
    FX.queue.push({ html, cls });
    if (!FX.timer) nextFloater();
  }
  function nextFloater() {
    const it = FX.queue.shift();
    if (!it) { FX.timer = 0; return; }
    $('fx').querySelectorAll('.floater').forEach(o => o.classList.add('gone'));
    const el = document.createElement('div');
    el.className = 'floater ' + (it.cls || '');
    el.innerHTML = it.html;
    $('fx').appendChild(el);
    setTimeout(() => el.remove(), 1900);
    FX.timer = setTimeout(nextFloater, 720);
  }
  function clearFx() {
    FX.queue = []; clearTimeout(FX.timer); FX.timer = 0; $('fx').innerHTML = '';
    $('g-streak').className = 'streak'; $('glow').classList.remove('on');
  }
  function glow(col) { const g = $('glow'); g.style.setProperty('--gc', col); g.classList.remove('on'); void g.offsetWidth; g.classList.add('on'); }

  // 2) السلسلة: أسهم صحيحة على التوالي بدون خطأ
  const TIERS = [3, 5, 8, 12, 16, 20, 25, 30];
  const TCOL = ['#10b981', '#3b82f6', '#9b5de5', '#f43f5e', '#f59e0b', '#ef476f'];
  function tierOf(n) {
    const i = TIERS.indexOf(n);
    if (i >= 0) return i;
    return n > 30 && n % 10 === 0 ? TIERS.length - 1 + (n - 30) / 10 : -1;
  }
  function streakFx(left, total) {
    const n = G.streak;
    if (n >= 3) {
      const sb = $('g-streak');
      sb.innerHTML = '<bdi dir="ltr">🔥 ×' + n + '</bdi>';
      sb.className = 'streak show'; void sb.offsetWidth; sb.classList.add('bump');
    }
    if (left === 0) return;   // الفوز له احتفاله الخاص
    let fired = false;
    const tier = tierOf(n);
    if (tier >= 0) {
      fired = true;
      const k = Math.min(5, tier), words = t('combo');
      floater(`<b>${words[Math.min(words.length - 1, tier)]}</b><small>${n} ${t('inRow')}</small>`, 't' + k);
      Sound.combo(Math.min(6, tier));
      if (!engine.zen) { G.bonus += 2 * (tier + 1); setTimeout(() => Sound.coin(1 + tier * 0.06), 260); }
      engine.celebrate(tier);
      glow(TCOL[k]);
      vibrate([12, 40, 18]);
      if (n === 5 && !S.seen.streak && !engine.zen) { S.seen.streak = 1; save(); setTimeout(() => nudgeShow(t('coachStreak'), '🔥', true), 900); }
    }
    // كل 10 على التوالي ترجع قلباً ضائعاً
    if (!engine.zen && n % 10 === 0 && engine.hearts < 3) {
      engine.addHearts(1); updateHud(false, true);
      floater(`<b>${t('heartGift')}</b>`, 'info');
      setTimeout(() => Sound.heart(), fired ? 720 : 0);
      fired = true;
    }
    // محطات: نصف اللوحة، آخر سهم
    const pct = 1 - left / total, prev = 1 - (left + 1) / total;
    let ms = null;
    if (total >= 8 && prev < 0.5 && pct >= 0.5) ms = t('half');
    else if (left === 1 && total >= 5) ms = t('lastOne');
    if (ms) { floater(`<b>${ms}</b>`, 'info'); setTimeout(() => Sound.milestone(), fired ? 720 : 0); }
  }

  // 3) تلميح نصي لطيف عند الخمول — يتدرّج: عام ← منطقة ← اتجاه ← اقتراح التلميح
  let idleTimer = 0, nudgeTimer = 0, nudgeSticky = false;
  function idleArm() {
    clearTimeout(idleTimer);
    if (current !== 'game' || !engine.L || engine.won || engine.over) return;
    const base = G.mode === 'journey' && G.n <= 2 ? 7000 : G.mode === 'zen' ? 18000 : 11000;
    idleTimer = setTimeout(idleNudge, base + Math.min(3, G.nudge) * 3500);
  }
  function idleStop() { clearTimeout(idleTimer); hideNudge(true); }
  function idleNudge() {
    if (current !== 'game' || engine.won || engine.over) return;
    if (modalOpen || document.hidden || !$('coach').classList.contains('hidden') || engine.anims.length || engine.trace != null) { idleTimer = setTimeout(idleNudge, 2500); return; }
    const m = nudgeText();
    if (m) {
      nudgeShow(m.txt, m.ic);
      engine.shimmer();
      if (m.tool) callTool(m.tool);
    }
    G.nudge++;
    idleArm();
  }
  function nudgeTarget(free) {
    const keep = free.find(a => a.id === G.nudgeId);
    if (keep) return keep;
    let best = free[0], bs = -1;
    for (const a of free) {
      let sc = 0;
      for (const b of engine.arrows) { if (b.alive && b !== a) { const bl = engine.blockOf(b); if (bl && bl.id === a.id) sc++; } }
      if (sc > bs) { bs = sc; best = a; }
    }
    G.nudgeId = best.id;
    return best;
  }
  function nudgeText() {
    const free = engine.freeArrows().filter(a => !a.busy);
    if (!free.length) return null;
    const st = G.nudge;
    if (st === 0) {
      if (free.length === 1) return { txt: t('nudgeOne'), ic: '🔎' };
      if (free.length === 2) return { txt: t('nudgeTwo'), ic: '👀' };
      G.tipFlip = !G.tipFlip;
      if (G.tipFlip) return { txt: t('nudgeCount').replace('{n}', free.length), ic: '👀' };
      const tips = t('tips');
      S.tipIdx = ((S.tipIdx || 0) + 1) % tips.length;
      return { txt: tips[S.tipIdx], ic: '💡' };
    }
    const a = nudgeTarget(free);
    const p = a.pts[a.pts.length - 1];
    const fx = p[0] / engine.W, fy = p[1] / engine.H;
    const col = fx < 0.36 ? 0 : fx > 0.64 ? 2 : 1, row = fy < 0.36 ? 0 : fy > 0.64 ? 2 : 1;
    const r = t('regions')[row * 3 + col];
    if (st === 1) return { txt: t('nudgeArea').replace('{r}', r), ic: '🧭' };
    if (st === 3) {
      if (G.mode === 'zen' || S.hints > 0) return { txt: t('nudgeHint'), ic: '💡', tool: 't-hint' };
      return { txt: t('nudgeRest'), ic: '😌' };
    }
    return { txt: t('nudgeDir').replace('{r}', r).replace('{d}', t('dirs')[a.dir]), ic: '🎯' };
  }
  function nudgeShow(txt, ic, sticky) {
    const n = $('nudge');
    $('nudge-t').textContent = txt;
    n.querySelector('.nudge-ic').textContent = ic || '💡';
    n.classList.remove('hidden');
    n.style.animation = 'none'; void n.offsetWidth; n.style.animation = '';
    nudgeSticky = !!sticky;
    Sound.nudge();
    clearTimeout(nudgeTimer); nudgeTimer = setTimeout(() => hideNudge(true), sticky ? 6500 : 7500);
  }
  function hideNudge(force) { if (force || !nudgeSticky) { $('nudge').classList.add('hidden'); nudgeSticky = false; } }
  function callTool(id) { const b = $(id); b.classList.remove('call'); void b.offsetWidth; b.classList.add('call'); setTimeout(() => b.classList.remove('call'), 3200); }
  // أي لمسة = نشاط: نخفي التنبيه ونعيد العدّ
  $('board').addEventListener('pointerdown', () => { hideNudge(); idleArm(); });
  document.querySelector('#game .tools').addEventListener('pointerdown', () => { hideNudge(true); idleArm(); });
  $('nudge').addEventListener('click', () => { hideNudge(true); idleArm(); });

  /** عرض اختياري: شاهد إعلاناً واحصل على أداتين */
  function offerAd(kind) {
    modal(`<h3>🎬</h3><p>${t(kind === 'hint' ? 'adHintQ' : 'adLensQ')}</p><div class="m-actions"><button class="btn primary" data-a="watch">${t('watchAd')}</button><button class="btn" data-a="no">${t('no')}</button></div>`, {
      watch: () => {
        closeModal();
        Ads.reward(kind, () => {
          if (kind === 'hint') S.hints += 2; else S.lenses += 2;
          save(); updateTools(); Sound.hint();
          toast(t('adThanks') + (kind === 'hint' ? ' +2 💡' : ' +2 🔍'));
        });
      },
      no: closeModal,
    });
  }

  $('t-hint').addEventListener('click', () => {
    if (engine.over || engine.won) return;
    if (G.mode !== 'zen' && S.hints <= 0) { if (Ads.ready()) offerAd('hint'); else toast(t('noHints')); return; }
    if (!engine.useHint()) { toast(t('noFree')); return; }
    Sound.hint(); vibrate(10); G.hintsUsed++;
    if (G.mode !== 'zen') { S.hints--; save(); }
    updateTools();
  });
  $('t-lens').addEventListener('click', () => {
    if (engine.over || engine.won) return;
    if (engine.lensArmed) { setLensUI(false); return; }
    if (G.mode !== 'zen' && S.lenses <= 0) { if (Ads.ready()) offerAd('lens'); else toast(t('noLens')); return; }
    setLensUI(true); Sound.click(); toast(t('lensArmed'));
  });
  $('t-fit').addEventListener('click', () => { engine.fit(true); Sound.click(); });
  $('g-restart').addEventListener('click', () => { Sound.click(); restart(); });
  $('g-back').addEventListener('click', () => { Sound.click(); confirmQuit(); });
  $('btn-play').addEventListener('click', () => { Sound.unlock(); startLevel(S.level); });
  $('btn-daily').addEventListener('click', () => { Sound.unlock(); startDaily(); });
  $('btn-zen').addEventListener('click', () => { Sound.unlock(); startZen(); });
  $('btn-pack').addEventListener('click', () => { Sound.unlock(); Sound.click(); show('pack'); });

  const exitTo = () => G.mode === 'pack' || G.mode === 'gift' ? 'pack' : G.mode === 'journey' && prevScreen === 'levels' ? 'levels' : 'home';
  function confirmQuit() {
    if (engine.left === engine.total || engine.won) { show(exitTo()); return; }
    modal(`<h3>🤔</h3><h3 style="font-size:20px">${t('quit')}</h3><p>${t('quitSub')}</p><div class="m-actions"><button class="btn primary" data-a="stay">${t('no')}</button><button class="btn" data-a="go">${t('home')}</button></div>`,
      { stay: closeModal, go: () => { closeModal(); show(exitTo()); } });
  }

  function onWin() {
    Music.stop(); idleStop(); engine.calm();
    Sound.win(); vibrate([20, 40, 20, 40, 60]);
    const stars = G.mode === 'zen' ? 3 : G.usedChance ? 1 : Math.max(1, 3 - engine.mistakes);
    if (G.mode !== 'pack' && G.mode !== 'gift') S.pics[G.level.pic] = 1;
    const packId = G.mode === 'pack' ? Gen.packPics()[G.pk].id : G.mode === 'gift' ? G.gift.id : null;
    G.packFirst = !!packId && !S.pack[packId];
    if (packId) S.pack[packId] = Math.max(S.pack[packId] || 0, stars);
    const rewards = [], earn = [];
    if (G.mode === 'journey') {
      S.stars[G.n] = Math.max(S.stars[G.n] || 0, stars);
      if (G.n === S.level) {
        earn.push([t('cFirst'), 15], [t('cStars'), stars * 5]);
        if (engine.mistakes === 0) earn.push([t('cPerfect'), 10]);
        S.chest = (S.chest || 0) + 1;
        if (S.chest >= CHEST_EVERY) { S.chest = 0; S.chestReady = (S.chestReady || 0) + 1; }
      } else earn.push([t('cReplay'), 4 + stars * 2]);
      if (G.n === S.level) {
        S.level = G.n + 1;
        if (G.n % 3 === 0) { S.hints++; rewards.push('+1 💡'); }
        if (G.n % 2 === 0) { S.lenses++; rewards.push('+1 🔍'); }
      }
    } else if (G.mode === 'daily' && S.daily.last !== today()) {
      S.daily.streak = S.daily.last === yesterday() ? S.daily.streak + 1 : 1;
      S.daily.last = today();
      S.hints++; S.lenses++; rewards.push('+1 💡', '+1 🔍', '🔥 ' + S.daily.streak);
      earn.push([t('cDaily'), 100 + 10 * Math.min(10, S.daily.streak)]);
    } else if (G.mode === 'pack' || G.mode === 'gift') {
      earn.push(G.packFirst ? [t('cFirst'), 25] : [t('cReplay'), 8], [t('cStars'), stars * (G.packFirst ? 5 : 1)]);
    } else if (G.mode === 'zen') earn.push([t('cFirst'), 10]);
    if (G.bonus) earn.push([t('cStreak'), G.bonus]);
    const coinsWon = earn.reduce((a, e) => a + e[1], 0);
    // ——— إحصائيات الجولة ———
    const ms = Math.max(1000, Date.now() - G.t0), secs = ms / 1000, total = engine.total;
    const acc = Math.round(100 * total / (total + G.misses));
    const score = G.mode === 'zen' ? 0 : Math.max(total * 5, Math.round(total * 10 + stars * 100 + G.best * 5
      + Math.max(0, (total * 2.5 - secs) * 4) - G.hintsUsed * 25));
    const td = today();
    if (S.today.d !== td) S.today = { d: td, n: 0 };
    S.today.n++; S.wins = (S.wins || 0) + 1;
    const rk = G.mode === 'journey' ? 'j' + G.n : G.mode === 'daily' ? 'd' + td : packId ? 'p' + packId : null;
    const prev = rk && S.rec[rk];
    const newScore = !!rk && !!prev && score > prev.s, newTime = !!rk && !!prev && ms < prev.t;
    if (rk) S.rec[rk] = { s: Math.max(score, prev ? prev.s : 0), t: Math.min(ms, prev ? prev.t : ms) };
    S.coins += coinsWon;
    save(); updateTools();
    const name = esc(G.level.picName[S.set.lang]);
    const love = G.mode === 'gift';
    const sub = G.mode === 'daily' ? t('dailyWin') : love ? `${t('loveWin')}: <b style="color:#e5383b">${name}</b>` : `${t('winSub')}: <b>${name}</b>`;
    const flawless = G.mode !== 'zen' && engine.mistakes === 0 ? `<p style="color:var(--ok);font-weight:700;margin-top:-6px">${t('perfect')}</p>` : '';
    const mmss = x => { const v = Math.round(x / 1000); return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); };
    const recB = on => on ? ` <i class="st-rec">${t('newRecord')}</i>` : '';
    const statsHtml = `<div class="m-stats">
        ${G.diff ? `<div><span>${t('stDiff')}</span><b>${t(G.diff)}</b></div>` : ''}
        <div><span>${t('stTime')}</span><b>${recB(newTime)}${mmss(ms)}</b></div>
        ${G.mode === 'zen' ? '' : `<div><span>${t('stScore')}</span><b>${recB(newScore)}<em id="m-score">0</em></b></div>`}
        <div><span>${t('stToday')}</span><b>${S.today.n}</b></div>
      </div>
      <div class="m-chips">
        <span title="${t('stAcc')}">${icon('i-target')}<b>${acc}%</b></span>
        <span title="${t('stMiss')}">${icon('i-x')}<b>${G.misses}</b></span>
        <span title="${t('stHints')}">${icon('i-bulb')}<b>${G.hintsUsed}</b></span>
        ${G.best >= 3 ? `<span title="${t('bestStreak')}">${icon('i-fire')}<b>${G.best}</b></span>` : ''}
      </div>`;
    const path = G.mode === 'journey' ? `<div class="m-path">${[0, 1, 2, 3, 4].map(i => {
      const n = G.n + i, cls = i === 0 ? 'cur' : n < S.level ? 'done' : n === S.level ? 'next' : '';
      return `<span class="${cls}">${n}</span>`;
    }).join('')}</div>` : '';
    const bonusBtn = !love && Ads.ready() ? `<button class="btn ad-btn" data-a="bonus">${t('adBonus')}</button>` : '';
    const hasNextPack = G.mode === 'pack' && G.pk + 1 < Gen.packPics().length;
    const nextBtn = G.mode === 'journey' || hasNextPack ? `<button class="btn primary" data-a="next">${t('next')} ➜</button>` : G.mode === 'zen' ? `<button class="btn primary" data-a="zen">${t('newZen')}</button>` : '';
    const homeBtn = G.mode === 'pack' || G.mode === 'gift' ? `<button class="btn" data-a="pack">${t('more')} 🐾</button>` : `<button class="btn" data-a="home">${t('home')}</button>`;
    modal(`<h3>${love ? '❤️' : t('winTitle')}</h3><p>${sub}</p>
      <canvas id="m-pic"></canvas>
      ${G.mode === 'zen' ? '' : `<div class="m-stars">${[1, 2, 3].map(i => icon('i-star', i <= stars ? 'on' : '')).join('')}</div>`}
      ${flawless}
      ${statsHtml}
      ${coinsWon ? `<div class="m-coins"><div class="mc-rows">${earn.filter(e => e[1]).map(e => `<span>${esc(e[0])}<b>+${e[1]}</b></span>`).join('')}</div><div class="mc-total">${icon('i-coin')}<b id="m-coin-n">+0</b></div></div>` : ''}
      ${rewards.length ? `<div class="m-reward">${t('reward')}: ${rewards.join(' ')}</div>` : ''}
      ${path}
      <div class="m-actions">${S.chestReady ? `<button class="btn chest-btn" data-a="chest">${icon('i-chest')} ${t('openChest')}</button>` : ''}${nextBtn}${bonusBtn}${homeBtn}</div>`,
    {
      chest: () => openChest(),
      next: () => { G.mode === 'pack' ? startPack(G.pk + 1) : startLevel(G.n + 1); Ads.afterWin(); },
      zen: () => { startZen(); Ads.afterWin(); },
      home: () => { closeModal(); show('home'); Ads.afterWin(); },
      pack: () => { closeModal(); show('pack'); Ads.afterWin(); },
      bonus: () => Ads.reward('bonus', () => {
        S.hints++; S.lenses++; save(); updateTools(); Sound.hint();
        const b = document.querySelector('#modal [data-a=bonus]');
        if (b) { b.disabled = true; b.textContent = t('adBonusDone'); }
      }),
    });
    document.querySelectorAll('.m-stars .ico.on').forEach((el, i) => { el.style.animationDelay = (0.15 + i * 0.18) + 's'; });
    if (coinsWon) countUp($('m-coin-n'), coinsWon, 700);
    const scEl = $('m-score');
    if (scEl) { const s0 = performance.now(); const tick = now => { const p = Math.min(1, (now - s0) / 900); scEl.textContent = Math.round(score * (1 - Math.pow(1 - p, 3))); if (p < 1 && scEl.isConnected) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    if (newScore || newTime) setTimeout(() => { Sound.reward && Sound.reward(); vibrate([15, 30, 15]); }, 900);
    coinUI();
    const sp = G.level.spec || {};
    requestAnimationFrame(() => drawArt($('m-pic'), G.mode === 'gift' ? null : sp.pic, sp.w || sp.f, sp.mirror, 'full', G.level));
  }

  function onLose() {
    Music.stop(); idleStop();
    Sound.lose();
    const chance = !G.usedChance ? `<button class="btn heart" data-a="chance">${t('secondChance')}</button>`
      : (Ads.ready() && (G.adHearts || 0) < 3 ? `<button class="btn heart" data-a="adheart">${t('adHeart')}</button>` : '');
    const resume = () => { closeModal(); engine.addHearts(1); updateHud(false, true); Music.start(G.style, G.seed); Music.setProgress(1 - engine.left / engine.total); idleArm(); };
    modal(`<h3>💔</h3><h3 style="font-size:22px">${t('loseTitle')}</h3><p>${t('loseSub')}</p><div class="m-actions">${chance}<button class="btn primary" data-a="retry">${t('tryAgain')}</button><button class="btn" data-a="home">${t('home')}</button></div>`,
      {
        chance: () => { G.usedChance = true; resume(); },
        adheart: () => Ads.reward('heart', () => { G.adHearts = (G.adHearts || 0) + 1; resume(); }),
        retry: restart,
        home: () => { closeModal(); show(exitTo()); },
      }, { locked: true });
  }

  // زر الرجوع في أندرويد: يعيد true إذا عالجه التطبيق
  let lastBack = 0;
  window.__onBack = function () {
    if (modalOpen) { if (!modalOpen.locked) closeModal(); return true; }
    if (current === 'game') { confirmQuit(); return true; }
    if (current !== 'home') { show('home'); return true; }
    const now = Date.now();
    if (now - lastBack < 2000) return false;
    lastBack = now; toast(t('exitApp'));
    return true;
  };

  // ——— الاقتصاد: عملات، متجر، صندوق كنز، هدية يومية ———
  const TRAIL_PRICE = [0, 0, 150, 250, 400, 550, 700, 900];
  const SKIN_PRICE = [0, 120, 150, 180, 220, 260, 300, 350, 400, 450, 600];
  const CHEST_EVERY = 4;
  const RANKS = [0, 15, 40, 90, 160, 260];
  const LOGIN = [{ c: 30 }, { h: 1 }, { c: 50 }, { l: 1 }, { c: 80 }, { h: 2, l: 1 }, { chest: 1 }];
  const priceOf = (kind, i) => (kind === 'trail' ? TRAIL_PRICE : SKIN_PRICE)[i] || 0;
  const styleName = (kind, i) => ((kind === 'trail' ? window.ArrowTrails : window.ArrowSkins)[i] || {}).name || ((window.ArrowSkins || [])[i]) || {};

  function applyStyle() { engine.trail = S.eq.trail || 0; engine.packSkin = S.eq.skin || 0; engine.kick(); }
  function coinUI() {
    ['h-coins', 's-coins'].forEach(id => { const el = $(id); if (el) el.textContent = S.coins; });
    // نقطة على زر المتجر إذا في شي بتقدر تشتريه
    let can = false;
    ['trail', 'skin'].forEach(k => (k === 'trail' ? TRAIL_PRICE : SKIN_PRICE).forEach((p, i) => { if (p && p <= S.coins && !S.own[k].includes(i)) can = true; }));
    const d = $('shop-dot'); if (d) d.classList.toggle('hidden', !can);
  }
  function countUp(el, n, ms) {
    if (!el) return;
    const t0 = performance.now();
    Sound.coin(1.1);
    let ticks = 0;
    const step = now => {
      const p = Math.min(1, (now - t0) / ms), v = Math.round(n * (1 - Math.pow(1 - p, 3)));
      el.textContent = '+' + v;
      if (Math.floor(p * 6) > ticks) { ticks = Math.floor(p * 6); if (ticks < 6) Sound.coin(1 + ticks * 0.07); }
      if (p < 1) requestAnimationFrame(step); else { el.parentElement.classList.add('done'); Sound.coins(); }
    };
    requestAnimationFrame(step);
  }
  function renderRank() {
    const st = totalStars(); let r = 0;
    while (r + 1 < RANKS.length && st >= RANKS[r + 1]) r++;
    const next = RANKS[r + 1];
    $('h-rank').innerHTML = `<b>${esc(t('rank')[r])}</b>` + (next ? `<span class="rk-track"><span style="width:${Math.round(100 * (st - RANKS[r]) / (next - RANKS[r]))}%"></span></span><small>${st}/${next} ★</small>` : '');
  }
  function renderChestBar() {
    const ready = S.chestReady > 0, n = S.chest || 0;
    $('h-chest').classList.toggle('ready', ready);
    $('h-chest-fill').style.width = (ready ? 100 : Math.round(100 * n / CHEST_EVERY)) + '%';
    $('h-chest-txt').textContent = ready ? t('chestReady') : t('chestIn').replace('{n}', CHEST_EVERY - n);
  }
  $('h-chest').addEventListener('click', () => { Sound.unlock(); if (S.chestReady > 0) openChest(); else { Sound.click(); toast(t('chestIn').replace('{n}', CHEST_EVERY - (S.chest || 0))); } });

  /** يعطي جوائز ويرجع سطور العرض */
  function grant(r) {
    const out = [];
    if (r.c) { S.coins += r.c; out.push(`${icon('i-coin')} +${r.c}`); }
    if (r.h) { S.hints += r.h; out.push(`💡 +${r.h}`); }
    if (r.l) { S.lenses += r.l; out.push(`🔍 +${r.l}`); }
    if (r.style) { S.own[r.style.kind].push(r.style.i); out.push(`✨ ${esc(styleName(r.style.kind, r.style.i)[S.set.lang] || '')}`); }
    save(); updateTools(); coinUI();
    return out;
  }
  function rollChest(big) {
    const r = { c: (big ? 120 : 60) + Math.floor(Math.random() * 9) * 10 };
    if (Math.random() < 0.55) r.h = 1 + (Math.random() < 0.35 ? 1 : 0);
    if (Math.random() < 0.4) r.l = 1 + (Math.random() < 0.3 ? 1 : 0);
    // فرصة ستايل أسهم جديد (من الرخيصين والمتوسطين)
    if (Math.random() < (big ? 0.6 : 0.3)) {
      const pool = [];
      TRAIL_PRICE.forEach((p, i) => { if (p && p <= 400 && !S.own.trail.includes(i)) pool.push({ kind: 'trail', i }); });
      SKIN_PRICE.forEach((p, i) => { if (p && p <= 300 && !S.own.skin.includes(i)) pool.push({ kind: 'skin', i }); });
      if (pool.length) r.style = pool[(Math.random() * pool.length) | 0];
    }
    return r;
  }
  function openChest(big, after) {
    if (!big) { if (!(S.chestReady > 0)) return; S.chestReady--; save(); }
    const r = rollChest(big);
    modal(`<h3>${t('chest')}</h3><div class="chest-big" id="chest-big"><svg class="ico"><use href="#i-chest"/></svg><i class="rays"></i></div><p class="chest-tap">👆</p><div class="chest-loot hidden" id="chest-loot"></div>
      <div class="m-actions"><button class="btn primary hidden" data-a="ok">${t('collect')}</button></div>`, {
      ok: () => { closeModal(); if (current === 'home') renderHome(); if (after) after(); if (r.style) offerTry(r.style); },
    }, { locked: true });
    Sound.unlock();
    const box = $('chest-big');
    let opened = false;
    const open = () => {
      if (opened) return; opened = true;
      box.classList.add('open'); Sound.chest(); vibrate([20, 40, 30, 40, 80]);
      setTimeout(() => {
        const lines = grant(r);
        const loot = $('chest-loot'); loot.innerHTML = `<small>${t('chestGot')}</small>` + lines.map((l, i) => `<span style="animation-delay:${i * 0.15}s">${l}</span>`).join('');
        loot.classList.remove('hidden');
        document.querySelector('#modal [data-a=ok]').classList.remove('hidden');
        document.querySelector('#modal .chest-tap').classList.add('hidden');
        Sound.reward();
      }, 650);
    };
    box.addEventListener('click', open);
    setTimeout(open, 1600);
  }
  function offerTry(st) {
    modal(`<h3>✨</h3><h3 style="font-size:22px">${t('newStyle')}</h3><canvas class="m-prev" id="m-prev"></canvas><p><b>${esc(styleName(st.kind, st.i)[S.set.lang] || '')}</b></p>
      <div class="m-actions"><button class="btn primary" data-a="use">${t('tryStyle')}</button><button class="btn" data-a="no">${t('later')}</button></div>`,
    { use: () => { S.eq[st.kind] = st.i; save(); applyStyle(); closeModal(); toast(t('equipped')); }, no: closeModal });
    requestAnimationFrame(() => drawArrowPreview($('m-prev'), st.kind, st.i, 0));
  }

  // هدية الدخول اليومية (7 أيام وبعدين ترجع)
  function maybeLogin() {
    if (current !== 'home' || modalOpen || S.level < 2 || S.login.last === today()) return;
    const idx = (S.login.last === yesterday() ? S.login.day : 0) % LOGIN.length;
    const lbl = r => r.chest ? icon('i-chest') : r.c ? `${icon('i-coin')}<b>${r.c}</b>` : `${r.h ? '💡' + r.h : ''}${r.l ? ' 🔍' + r.l : ''}`;
    modal(`<h3>🎁 ${t('loginTitle')}</h3><p>${t('loginSub')}</p><div class="login-grid">${LOGIN.map((r, i) => `<div class="ld ${i < idx ? 'got' : i === idx ? 'today' : ''} ${r.chest ? 'big' : ''}"><small>${t('loginDay').replace('{n}', i + 1)}</small><span>${lbl(r)}</span></div>`).join('')}</div>
      <div class="m-actions"><button class="btn primary" data-a="claim">${t('claim')}</button></div>`, {
      claim: () => {
        S.login = { last: today(), day: idx + 1 };
        const r = LOGIN[idx];
        if (r.chest) { save(); openChest(true); return; }
        const lines = grant(r);
        closeModal(); Sound.reward(); toast(lines.join(' &nbsp; '), 2600, true); renderHome();
      },
    }, { locked: true });
  }

  // ——— المتجر ———
  let shopTab = 'trail', shopRaf = 0;
  document.querySelectorAll('#shop-tabs button').forEach(b => b.addEventListener('click', () => { Sound.click(); shopTab = b.dataset.v; renderShop(); }));
  function renderShop() {
    document.querySelectorAll('#shop-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === shopTab));
    const g = $('shop-grid');
    if (shopTab === 'tools') {
      const tools = [{ k: 'h', n: 3, p: 90, ic: '💡', lbl: t('buyHints'), have: S.hints }, { k: 'l', n: 3, p: 90, ic: '🔍', lbl: t('buyLenses'), have: S.lenses }];
      g.innerHTML = tools.map((x, i) => `<div class="sh-card tool-card"><div class="sh-ic">${x.ic}<i>${x.have}</i></div><b>${x.lbl}</b><button class="sh-btn buy" data-tool="${i}">${icon('i-coin')} ${x.p}</button></div>`).join('')
        + (Ads.ready() ? `<div class="sh-card tool-card"><div class="sh-ic">🎬</div><b>+50 ${t('coins')}</b><button class="sh-btn buy" data-adcoins="1">${t('watchAd')}</button></div>` : '');
      g.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
        const x = tools[+b.dataset.tool];
        if (S.coins < x.p) { Sound.bump(); toast(t('notEnough').replace('{n}', x.p - S.coins)); return; }
        S.coins -= x.p; if (x.k === 'h') S.hints += x.n; else S.lenses += x.n;
        save(); updateTools(); Sound.reward(); toast(x.ic + ' +' + x.n); renderShop(); coinUI();
      }));
      g.querySelectorAll('[data-adcoins]').forEach(b => b.addEventListener('click', () => Ads.reward('coins', () => { S.coins += 50; save(); coinUI(); Sound.coins(); renderShop(); })));
      cancelAnimationFrame(shopRaf);
      return;
    }
    const kind = shopTab, list = kind === 'trail' ? window.ArrowTrails : window.ArrowSkins.map(n => ({ name: n }));
    g.innerHTML = list.map((it, i) => {
      const own = S.own[kind].includes(i), on = S.eq[kind] === i, p = priceOf(kind, i);
      const btn = on ? `<button class="sh-btn on" disabled>${t('equipped')}</button>` : own ? `<button class="sh-btn" data-eq="${i}">${t('equip')}</button>` : `<button class="sh-btn buy ${p > S.coins ? 'poor' : ''}" data-buy="${i}">${icon('i-coin')} ${p}</button>`;
      return `<div class="sh-card ${on ? 'on' : ''} ${own ? '' : 'locked'}"><canvas data-i="${i}"></canvas><b>${esc(it.name[S.set.lang])}</b>${btn}</div>`;
    }).join('');
    g.querySelectorAll('[data-eq]').forEach(b => b.addEventListener('click', () => { Sound.click(); S.eq[kind] = +b.dataset.eq; save(); applyStyle(); renderShop(); }));
    g.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.buy, p = priceOf(kind, i);
      if (S.coins < p) { Sound.bump(); vibrate(30); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); toast(t('notEnough').replace('{n}', p - S.coins)); return; }
      S.coins -= p; S.own[kind].push(i); S.eq[kind] = i; save(); applyStyle();
      Sound.reward(); vibrate([15, 30, 15]); toast(t('bought'));
      renderShop(); coinUI();
      const card = g.querySelector(`canvas[data-i="${i}"]`); if (card) card.parentElement.classList.add('pop');
    }));
    const cvs = [...g.querySelectorAll('canvas')];
    cancelAnimationFrame(shopRaf);
    const t0 = performance.now();
    const loop = now => {
      if (current !== 'shop' || shopTab !== kind) return;
      for (const c of cvs) drawArrowPreview(c, kind, +c.dataset.i, (now - t0) / 1000);
      shopRaf = requestAnimationFrame(loop);
    };
    requestAnimationFrame(() => { for (const c of cvs) drawArrowPreview(c, kind, +c.dataset.i, 0); shopRaf = requestAnimationFrame(loop); });
  }

  // للاختبار
  window.__siham = { engine, G, S: () => S, startLevel, startDaily, startZen, idleNudge, startPack, startGift, decodeGift, openChest, maybeLogin, show };

  applyI18n(); applyTheme(); applyStyle(); show('home');
  checkGift();
  window.addEventListener('hashchange', checkGift);
})();
