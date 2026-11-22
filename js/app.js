/* سهام — واجهة التطبيق: الشاشات، الحفظ، الأوضاع */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'siham.v1';

  // ——— الحفظ ———
  const DEFAULT = {
    level: 1, stars: {}, hints: 3, lenses: 3, pics: {}, pack: {}, gifts: [], ad: { wins: 0, last: 0 },
    daily: { last: null, streak: 0 },
    set: { theme: 'light', sound: true, music: true, vibe: true, lang: 'ar', safe: false },
    seen: {},
    // اقتصاد اللعبة: عملات + ستايلات أسهم + صندوق كنز + هدية يومية
    coins: 50, own: { trail: [0, 1], skin: [0] }, eq: { trail: 1, skin: 0 }, chest: 0, chestReady: 0,
    login: { last: null, day: 0 },
    // إحصائيات: أفضل نتيجة لكل مرحلة + عدد مراحل اليوم
    rec: {}, today: { d: null, n: 0 }, wins: 0,
    // الحساب ولوحة الصدارة: الاسم والصورة + نقاط هذا الأسبوع
    prof: { n: '', a: -1, t: 0 }, wk: { id: '', s: 0 },
    // الميداليات: الدرجة المحققة لكل ميدالية + عدّادات التقدم
    med: {}, mp: {},
  };
  const fresh = () => JSON.parse(JSON.stringify(DEFAULT));
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  // v3.2: «حماية اللمس الذكي» صارت مغلقة افتراضياً — مرة واحدة فقط للاعبين الحاليين (بعدها اختيارهم محفوظ)
  if (!S.seen) S.seen = {};
  if (!S.seen.safeOff) { S.seen.safeOff = 1; S.set = Object.assign({}, S.set, { safe: false }); }
  S.set = Object.assign({}, DEFAULT.set, S.set);
  S.daily = Object.assign({}, DEFAULT.daily, S.daily);
  S.own = Object.assign(fresh().own, S.own); S.eq = Object.assign(fresh().eq, S.eq); S.login = Object.assign(fresh().login, S.login);
  S.prof = Object.assign(fresh().prof, S.prof);
  if (S.prof.a < 0) S.prof.a = Math.floor(Math.random() * 24);
  let cloudOn = false, cloudT = 0;
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    if (cloudOn) { clearTimeout(cloudT); cloudT = setTimeout(() => cloudPush(), 4000); }
  };

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
    if (id === 'ranks') renderRanks();
    if (id === 'medals') renderMedals();
    coinUI();
    Ads.banner(id !== 'game');
    if (id === 'game') requestAnimationFrame(() => engine.resize());
    else { Music.stop(); idleStop(); }
    if (id === 'home') setTimeout(() => { maybeLogin(); setTimeout(maybeMedals, 250); setTimeout(maybeAskAccount, 900); }, 350);
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
    $('set-acc-sub').textContent = accLabel();
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
  $('set-account').addEventListener('click', () => { Sound.click(); accountModal(); });
  $('set-privacy').addEventListener('click', () => { try { NATIVE.privacyOptions(); } catch (e) { /* ignore */ } });
  $('set-vibe').addEventListener('change', e => { S.set.vibe = e.target.checked; save(); vibrate(20); });
  $('set-safe').addEventListener('change', e => { S.set.safe = e.target.checked; save(); engine.safeTap = S.set.safe; });
  $('set-reset').addEventListener('click', () => {
    modal(`<h3>⚠️</h3><p>${t('resetConfirm')}</p><div class="m-actions"><button class="btn" data-a="yes" style="color:var(--danger)">${t('yes')}</button><button class="btn primary" data-a="no">${t('no')}</button></div>`, {
      yes: () => { const set = S.set, gf = S.gifts, pf = S.prof; S = fresh(); S.set = set; S.gifts = gf; S.prof = pf; save(); applyStyle(); closeModal(); show('home'); },
      no: closeModal,
    });
  });

  // ——— النوافذ ———
  let modalOpen = null;
  function modal(html, actions, opts) {
    $('modal-card').className = 'modal-card' + (opts && opts.cls ? ' ' + opts.cls : '');
    $('modal-card').scrollTop = 0;
    $('modal-card').innerHTML = html;
    $('modal').classList.remove('hidden');
    modalOpen = Object.assign({ actions }, opts || {});
    $('modal-card').querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => { Sound.click(); actions[b.dataset.a](); }));
  }
  function closeModal() { $('modal').classList.add('hidden'); modalOpen = null; if (current === 'home') setTimeout(maybeMedals, 450); }

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
      if (left === 0) engine.fit(true);   // آخر سهم: رجّع الزوم لوضعه الطبيعي
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
    onLens(ok) { G.lensUsed = (G.lensUsed || 0) + 1; Sound.lens(ok); toast(ok ? t('lensClear') : t('lensBlocked')); if (G.mode !== 'zen') { S.lenses--; save(); } setLensUI(false); updateTools(); },
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
    else if (G.level.spec.boss) setTimeout(() => { if (current === 'game' && G.mode === 'journey' && G.n === n) nudgeShow(t('bossLv'), '🔥', true); }, 400);
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
    G.streak = 0; G.best = 0; G.miss = 0; G.nudge = 0; G.calmShown = false; G.adHearts = 0; G.coinHearts = 0; G.bonus = 0;
    G.t0 = Date.now(); G.hidAt = 0; G.hintsUsed = 0; G.lensUsed = 0; G.misses = 0;
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
    const diff = (level.spec && level.spec.diff) || Gen.difficultyOf(level.art ? level.arrows.length * 3.5 : cells);
    $('g-diff').textContent = zen ? '🍃' : t(diff);
    G.diff = zen ? null : diff;
    // موسيقى هادئة أو حماسية حسب المرحلة
    G.style = zen || G.mode === 'pack' || G.mode === 'gift' ? 'calm'
      : G.mode === 'daily' ? 'hype'
      : (diff === 'hard' || diff === 'expert' || diff === 'insane' || (G.n > 3 && G.n % 5 === 0)) ? 'hype' : 'calm';
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
    G.dailyNew = false;
    Music.stop(); idleStop(); engine.calm();
    if (engine.zoomed) engine.fit(true);
    Sound.win(); vibrate([20, 40, 20, 40, 60]);
    const stars = G.mode === 'zen' ? 3 : G.usedChance ? 1 : Math.max(1, 3 - engine.mistakes);
    if (G.mode !== 'pack' && G.mode !== 'gift') S.pics[G.level.pic] = 1;
    const packId = G.mode === 'pack' ? Gen.packPics()[G.pk].id : G.mode === 'gift' ? G.gift.id : null;
    G.packFirst = !!packId && !S.pack[packId];
    // ——— العملات (انظر ECON) ———
    // أول مرة: مكافأة ثابتة + نجوم + بدون خطأ + سلسلة (بسقف). الإعادة: فقط على التحسّن (نجمة جديدة / رقم قياسي)
    const rewards = [], earn = [];
    const prevStars = G.mode === 'journey' ? (S.stars[G.n] || 0) : packId ? (S.pack[packId] || 0) : 0;
    const firstClear = (G.mode === 'journey' && G.n === S.level) || ((G.mode === 'pack' || G.mode === 'gift') && G.packFirst);
    if (packId) S.pack[packId] = Math.max(S.pack[packId] || 0, stars);
    const streakCoins = Math.min(ECON.streakCap, Math.floor(G.best / ECON.streakPer));
    if (firstClear) {
      earn.push([t('cFirst'), G.mode === 'journey' ? ECON.level : ECON.pack], [t('cStars'), stars * ECON.star]);
      if (engine.mistakes === 0) earn.push([t('cPerfect'), ECON.perfect]);
      if (streakCoins) earn.push([t('cStreak'), streakCoins]);
    } else if (G.mode !== 'zen' && G.mode !== 'daily' && stars > prevStars) earn.push([t('cStars'), (stars - prevStars) * ECON.star]);
    if (G.mode === 'journey') {
      S.stars[G.n] = Math.max(S.stars[G.n] || 0, stars);
      if (G.n === S.level) {
        S.chest = (S.chest || 0) + 1;
        if (S.chest >= CHEST_EVERY) { S.chest = 0; S.chestReady = (S.chestReady || 0) + 1; }
        S.level = G.n + 1;
        if (G.n % ECON.freeHintEvery === 0) { S.hints++; rewards.push('+1 💡'); }
        if (G.n % ECON.freeLensEvery === 0) { S.lenses++; rewards.push('+1 🔍'); }
      }
    } else if (G.mode === 'daily' && S.daily.last !== today()) {
      S.daily.streak = S.daily.last === yesterday() ? S.daily.streak + 1 : 1;
      S.daily.last = today(); G.dailyNew = true;
      S.hints++; S.lenses++; rewards.push('+1 💡', '+1 🔍', '🔥 ' + S.daily.streak);
      earn.push([t('cDaily'), ECON.daily + ECON.dailyStreak * Math.min(5, S.daily.streak)]);
    }
    // ——— إحصائيات الجولة ———
    const ms = Math.max(1000, Date.now() - G.t0), secs = ms / 1000, total = engine.total;
    const acc = Math.round(100 * total / (total + G.misses));
    const score = G.mode === 'zen' ? 0 : Math.max(total * 5, Math.round(total * 10 + stars * 100 + G.best * 5
      + Math.max(0, (total * 2.5 - secs) * 4) - G.hintsUsed * 25));
    const td = today();
    if (S.today.d !== td) S.today = { d: td, n: 0 };
    S.today.n++; S.wins = (S.wins || 0) + 1;
    const wid = window.Cloud ? Cloud.weekId() : '';
    if (!S.wk || S.wk.id !== wid) S.wk = { id: wid, s: 0 };
    S.wk.s += score;
    const rk = G.mode === 'journey' ? 'j' + G.n : G.mode === 'daily' ? 'd' + td : packId ? 'p' + packId : null;
    const prev = rk && S.rec[rk];
    const newScore = !!rk && !!prev && score > prev.s, newTime = !!rk && !!prev && ms < prev.t;
    if (rk) S.rec[rk] = { s: Math.max(score, prev ? prev.s : 0), t: Math.min(ms, prev ? prev.t : ms) };
    if (!firstClear && G.mode !== 'daily' && (newScore || newTime)) earn.push([t('cRecord'), ECON.record]);
    const coinsWon = earn.reduce((a, e) => a + e[1], 0);
    S.coins += coinsWon;
    save(); updateTools();
    medalWin(ms);
    const newMedals = medalCheck();
    let bonusDone = false, coinTotal = coinsWon;
    // نعرضها كدالة: بعد فتح الصندوق نرجّع نافذة الفوز بدل ما تبقى الشاشة بلا أزرار
    const showWin = again => {
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
    const bonusBtn = !love && !bonusDone && Ads.ready() ? `<button class="btn ad-btn" data-a="bonus">${coinsWon ? t('adDouble') : t('adBonus')}</button>` : '';
    const hasNextPack = G.mode === 'pack' && G.pk + 1 < Gen.packPics().length;
    const nextBtn = G.mode === 'journey' || hasNextPack ? `<button class="btn primary" data-a="next">${t('next')} ➜</button>` : G.mode === 'zen' ? `<button class="btn primary" data-a="zen">${t('newZen')}</button>` : '';
    const homeBtn = G.mode === 'pack' || G.mode === 'gift' ? `<button class="btn" data-a="pack">${t('more')} 🐾</button>` : `<button class="btn" data-a="home">${t('home')}</button>`;
    modal(`<h3>${love ? '❤️' : t('winTitle')}</h3><p>${sub}</p>
      <canvas id="m-pic"></canvas>
      ${G.mode === 'zen' ? '' : `<div class="m-stars">${[1, 2, 3].map(i => icon('i-star', i <= stars ? 'on' : '')).join('')}</div>`}
      ${flawless}
      ${statsHtml}
      ${coinsWon ? `<div class="m-coins"><div class="mc-rows">${earn.filter(e => e[1]).map(e => `<span>${esc(e[0])}<b dir="ltr">+${e[1]}</b></span>`).join('')}</div><div class="mc-total">${icon('i-coin')}<b id="m-coin-n" dir="ltr">+0</b></div></div>` : ''}
      ${rewards.length ? `<div class="m-reward">${t('reward')}: ${rewards.join(' ')}</div>` : ''}
      ${G.mode === 'zen' || love ? '' : nearHtml()}
      ${path}
      <div class="m-actions">${S.chestReady ? `<button class="btn chest-btn" data-a="chest">${icon('i-chest')} ${t('openChest')}</button>` : ''}${nextBtn}${bonusBtn}${homeBtn}</div>`,
    {
      chest: () => openChest(false, () => showWin(true)),
      next: () => { G.mode === 'pack' ? startPack(G.pk + 1) : startLevel(G.n + 1); Ads.afterWin(); },
      zen: () => { startZen(); Ads.afterWin(); },
      home: () => { closeModal(); show('home'); Ads.afterWin(); },
      pack: () => { closeModal(); show('pack'); Ads.afterWin(); },
      bonus: () => Ads.reward('bonus', () => {
        bonusDone = true;
        if (coinsWon) { S.coins += coinsWon; coinTotal = coinsWon * 2; Sound.coins(); countUp($('m-coin-n'), coinTotal, 600); }
        else { S.hints++; S.lenses++; Sound.hint(); }
        save(); updateTools(); coinUI();
        const b = document.querySelector('#modal [data-a=bonus]');
        if (b) { b.disabled = true; b.textContent = coinsWon ? t('adDoubleDone') : t('adBonusDone'); }
      }),
       }, { cls: 'win' });
    document.querySelectorAll('.m-stars .ico.on').forEach((el, i) => { el.style.animationDelay = (0.15 + i * 0.18) + 's'; });
    if (coinsWon) { if (again) $('m-coin-n').textContent = '+' + coinTotal; else countUp($('m-coin-n'), coinsWon, 700); }
    const scEl = $('m-score');
    if (scEl && again) scEl.textContent = score;
    else if (scEl) { const s0 = performance.now(); const tick = now => { const p = Math.min(1, (now - s0) / 900); scEl.textContent = Math.round(score * (1 - Math.pow(1 - p, 3))); if (p < 1 && scEl.isConnected) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    if (!again && (newScore || newTime)) setTimeout(() => { Sound.reward && Sound.reward(); vibrate([15, 30, 15]); }, 900);
    coinUI();
    const sp = G.level.spec || {};
    requestAnimationFrame(() => drawArt($('m-pic'), G.mode === 'gift' ? null : sp.pic, sp.w || sp.f, sp.mirror, 'full', G.level));
    };
    if (newMedals.length) medalCeremony(newMedals, () => showWin(false)); else showWin(false);
  }

  function onLose() {
    medalLose();
    Music.stop(); idleStop();
    Sound.lose();
    const hp = ECON.heart * ((G.coinHearts || 0) + 1);
    const chance = !G.usedChance ? `<button class="btn heart" data-a="chance">${t('secondChance')}</button>`
      : (Ads.ready() && (G.adHearts || 0) < 3 ? `<button class="btn heart" data-a="adheart">${t('adHeart')}</button>` : '')
        + `<button class="btn heart ${S.coins < hp ? 'poor' : ''}" data-a="coinheart">${t('coinHeart').replace('{n}', `${icon('i-coin')} ${hp}`)}</button>`;
    const resume = () => { closeModal(); engine.addHearts(1); updateHud(false, true); Music.start(G.style, G.seed); Music.setProgress(1 - engine.left / engine.total); idleArm(); };
    modal(`<h3>💔</h3><h3 style="font-size:22px">${t('loseTitle')}</h3><p>${t('loseSub')}</p><div class="m-actions">${chance}<button class="btn primary" data-a="retry">${t('tryAgain')}</button><button class="btn" data-a="home">${t('home')}</button></div>`,
      {
        chance: () => { G.usedChance = true; resume(); },
        adheart: () => Ads.reward('heart', () => { G.adHearts = (G.adHearts || 0) + 1; resume(); }),
        coinheart: () => {
          if (S.coins < hp) { Sound.bump(); toast(t('notEnough').replace('{n}', hp - S.coins)); return; }
          S.coins -= hp; G.coinHearts = (G.coinHearts || 0) + 1; save(); coinUI(); Sound.coin(1); resume();
        },
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
  // ——— ميزان الاقتصاد ———
  // الهدف: ~30–45 عملة لكل مرحلة جديدة، فيشتري اللاعب شيئاً صغيراً كل يوم لعب تقريباً،
  // ويحتاج أسابيع لجمع كل الستايلات. الإعادة لا تعطي إلا على التحسّن، والسلاسل لها سقف.
  const ECON = {
    level: 10, pack: 15, star: 5, perfect: 5, streakPer: 3, streakCap: 10, record: 5,
    daily: 50, dailyStreak: 10, freeHintEvery: 5, freeLensEvery: 4,
    adCoins: 30, adCoinsPerDay: 5, heart: 60,
    hints: { n: 3, p: 120 }, lenses: { n: 3, p: 100 },
  };
  const TRAIL_PRICE = [0, 0, 300, 500, 800, 1200, 1600, 2200];
  const SKIN_PRICE = [0, 200, 250, 300, 400, 500, 600, 750, 900, 1100, 1500];
  const CHEST_EVERY = 5;
  const RANKS = [0, 15, 40, 90, 160, 260];
  const LOGIN = [{ c: 20 }, { h: 1 }, { c: 30 }, { l: 1 }, { c: 50 }, { h: 1, l: 1 }, { chest: 1 }];
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
    const r = { c: (big ? 80 : 30) + Math.floor(Math.random() * 5) * 5 };
    if (Math.random() < (big ? 0.8 : 0.4)) r.h = 1;
    if (Math.random() < (big ? 0.6 : 0.3)) r.l = 1;
    // فرصة نادرة لستايل أسهم جديد (من الرخيصين فقط)
    if (Math.random() < (big ? 0.5 : 0.08)) {
      const pool = [];
      TRAIL_PRICE.forEach((p, i) => { if (p && p <= 500 && !S.own.trail.includes(i)) pool.push({ kind: 'trail', i }); });
      SKIN_PRICE.forEach((p, i) => { if (p && p <= 400 && !S.own.skin.includes(i)) pool.push({ kind: 'skin', i }); });
      if (pool.length) r.style = pool[(Math.random() * pool.length) | 0];
    }
    return r;
  }
  /** صندوق كنز مفصّل: الغطاء ينفصل عند الفتح ويظهر الضوء والكنز */
  function chestSvg() {
    return `<svg class="cm-svg" viewBox="0 0 200 180" aria-hidden="true"><defs>
      <linearGradient id="cb-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cf8030"/><stop offset="1" stop-color="#7d4112"/></linearGradient>
      <linearGradient id="cb-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3ad52"/><stop offset="1" stop-color="#bf6c22"/></linearGradient>
      <linearGradient id="cb-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b5"/><stop offset=".55" stop-color="#ffc82e"/><stop offset="1" stop-color="#e09400"/></linearGradient>
      <radialGradient id="cb-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#ffd65a"/><stop offset="1" stop-color="#ffb800" stop-opacity="0"/></radialGradient>
      <clipPath id="cb-dome"><path d="M20 98C20 44 180 44 180 98z"/></clipPath></defs>
      <ellipse cx="100" cy="166" rx="84" ry="9" fill="#000" opacity=".28"/>
      <g class="cm-body">
        <rect x="24" y="94" width="152" height="68" rx="11" fill="url(#cb-w)"/>
        <path d="M70 96v64M100 96v64M130 96v64" stroke="#000" stroke-opacity=".14" stroke-width="1.6"/>
        <rect x="35" y="94" width="17" height="68" fill="url(#cb-g)" stroke="#b97500" stroke-width="1"/>
        <rect x="148" y="94" width="17" height="68" fill="url(#cb-g)" stroke="#b97500" stroke-width="1"/>
        <rect x="24" y="151" width="152" height="12" rx="6" fill="url(#cb-g)" stroke="#b97500" stroke-width="1"/>
        <g fill="#b46d00"><circle cx="43.5" cy="106" r="2.6"/><circle cx="43.5" cy="140" r="2.6"/><circle cx="156.5" cy="106" r="2.6"/><circle cx="156.5" cy="140" r="2.6"/></g>
        <rect x="90" y="98" width="20" height="14" rx="3" fill="#6b3509"/>
        <ellipse cx="100" cy="95" rx="73" ry="11" fill="#2a1104" class="cm-hole"/>
        <ellipse cx="100" cy="95" rx="73" ry="11" fill="url(#cb-glow)" class="cm-inner"/>
        <g class="cm-pile"><ellipse cx="70" cy="93" rx="14" ry="6" fill="url(#cb-g)"/><ellipse cx="100" cy="90" rx="16" ry="7" fill="url(#cb-g)"/><ellipse cx="132" cy="93" rx="14" ry="6" fill="url(#cb-g)"/><circle cx="86" cy="88" r="6" fill="#ff5d8f"/><circle cx="118" cy="87" r="5" fill="#4cc9f0"/></g>
      </g>
      <g class="cm-lid">
        <path d="M20 98C20 44 180 44 180 98z" fill="url(#cb-l)"/>
        <g clip-path="url(#cb-dome)"><rect x="35" y="40" width="17" height="64" fill="url(#cb-g)" stroke="#b97500" stroke-width="1"/><rect x="148" y="40" width="17" height="64" fill="url(#cb-g)" stroke="#b97500" stroke-width="1"/></g>
        <path d="M44 74c10-16 32-24 56-24" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round" fill="none"/>
        <rect x="18" y="90" width="164" height="14" rx="7" fill="url(#cb-g)" stroke="#b97500" stroke-width="1"/>
        <rect x="88" y="86" width="24" height="28" rx="7" fill="url(#cb-g)" stroke="#b97500" stroke-width="1.2"/>
        <circle cx="100" cy="97" r="4.2" fill="#6b3509"/><path d="M98 99h4l1.6 8h-7.2z" fill="#6b3509"/>
        <g fill="#b46d00"><circle cx="43.5" cy="84" r="2.4"/><circle cx="156.5" cy="84" r="2.4"/></g>
      </g></svg>`;
  }
  function lootTiles(r) {
    const tiles = [];
    if (r.c) tiles.push({ ic: icon('i-coin'), n: r.c, cnt: 1, lb: t('coins') });
    if (r.h) tiles.push({ ic: `<svg class="ico" style="color:#ffb703"><use href="#i-bulb"/></svg>`, n: '+' + r.h, lb: t('hint') });
    if (r.l) tiles.push({ ic: `<svg class="ico" style="color:#8ecbff"><use href="#i-lens"/></svg>`, n: '+' + r.l, lb: t('lens') });
    if (r.style) tiles.push({ ic: '<span class="cm-emo">✨</span>', n: esc(styleName(r.style.kind, r.style.i)[S.set.lang] || ''), lb: t('rareLoot'), rare: 1 });
    return tiles;
  }
  function openChest(big, after) {
    if (!big) { if (!(S.chestReady > 0)) return; S.chestReady--; save(); }
    const r = rollChest(big);
    modal(`<div class="cm-fx" id="cm-fx"></div><h3>${t('chest')}</h3>
      <div class="cm-stage" id="chest-big"><i class="cm-rays"></i><i class="cm-beam"></i>${chestSvg()}</div>
      <div class="cm-zone"><p class="cm-tap" id="cm-tap">${t('tapOpen')}</p><div class="cm-loot hidden" id="chest-loot"></div></div>
      <div class="m-actions"><button class="btn primary hidden" data-a="ok">${t('collect')}</button></div>`, {
      ok: () => { closeModal(); if (current === 'home') renderHome(); if (r.style) offerTry(r.style, after); else if (after) after(); },
    }, { locked: true, cls: ' chestm' });
    Sound.unlock();
    const box = $('chest-big');
    let opened = false;
    const burst = () => {
      const fx = $('cm-fx'); if (!fx) return;
      const cx = fx.clientWidth / 2, cy = box.offsetTop + box.offsetHeight * 0.42;
      let h = '';
      for (let i = 0; i < 26; i++) {
        const ang = (-0.15 - Math.random() * 0.7) * Math.PI + (Math.random() < 0.5 ? 0 : 0);
        const side = (i / 26) * 2 - 1;
        const dx = side * 140 + (Math.random() - 0.5) * 40, dy = -(90 + Math.random() * 110);
        const kind = i % 3 === 0 ? 'c' : i % 3 === 1 ? 's' : 'g';
        h += `<b class="cm-p ${kind}" style="left:${cx}px;top:${cy}px;--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--rot:${(Math.random() * 720 - 360).toFixed(0)}deg;--dl:${(Math.random() * 0.18).toFixed(2)}s;--sz:${(14 + Math.random() * 12).toFixed(0)}px">${kind === 'c' ? icon('i-coin') : kind === 's' ? '✦' : '★'}</b>`;
      }
      fx.innerHTML = h;
    };
    const open = () => {
      if (opened) return; opened = true;
      $('cm-tap').classList.add('hidden');
      box.classList.add('shake');
      vibrate([15, 30, 15]);
      setTimeout(() => {
        box.classList.remove('shake'); box.classList.add('open');
        Sound.chest(); vibrate([20, 40, 30, 40, 80]);
        burst();
        const card = $('modal-card'); if (card) { card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 700); }
      }, 480);
      setTimeout(() => {
        const lines = grant(r); void lines;
        const loot = $('chest-loot'); if (!loot) return;
        loot.innerHTML = lootTiles(r).map((x, i) => `<div class="cm-card${x.rare ? ' rare' : ''}" style="animation-delay:${i * 0.2}s"><div class="cm-ic">${x.ic}</div><b dir="ltr"${x.cnt ? ` data-cnt="${x.n}"` : ''}>${x.cnt ? '+0' : x.n}</b><small>${x.lb}</small></div>`).join('');
        loot.classList.remove('hidden');
        loot.querySelectorAll('[data-cnt]').forEach(el => {
          const to = +el.dataset.cnt, t0 = performance.now();
          const step = now => { const k = Math.min(1, (now - t0) / 800); el.textContent = '+' + Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
          setTimeout(() => requestAnimationFrame(step), 300);
        });
        setTimeout(() => { Sound.reward(); }, 150);
        const ok = document.querySelector('#modal [data-a=ok]');
        setTimeout(() => { if (ok) ok.classList.remove('hidden'); }, 250 + lootTiles(r).length * 200);
      }, 480 + 650);
    };
    box.addEventListener('click', open);
    setTimeout(open, 2600);
  }
  // ===================== الميداليات =====================
  // ميداليات بدرجات (برونز/فضة/ذهب) + سرية + أسطورية. المراحل الصغيرة (<30 سهماً) لا تُحسب
  // في السلاسل حتى لا تُستغل بإعادة مرحلة سهلة.
  const MEDAL_TRAIL0 = 8;               // ستايلات الأسهم 8..10 للذهبيات، 11 للأسطورية (لا تُشترى)
  const MEDAL_GOLD_TRAILS = [8, 9, 10], MEDAL_LEGEND_TRAIL = 11;
  const mp = k => S.mp[k] || 0;
  const MEDALS = [
    { id: 'flaw', ic: '✨', tiers: [5, 15, 30], v: () => mp('flawBest'), cur: () => mp('flawRun') },
    { id: 'sniper', ic: '🎯', tiers: [20, 35, 50], v: () => mp('arrowBest') },
    { id: 'loyal', ic: '🔥', tiers: [7, 30, 100], v: () => Math.max(mp('dailyBest'), S.daily.last === today() || S.daily.last === yesterday() ? S.daily.streak || 0 : 0) },
    { id: 'mind', ic: '🧠', tiers: [5, 20, 50], v: () => mp('noHelp') },
    { id: 'bolt', ic: '⚡', tiers: [1, 5, 20], v: () => mp('bolt') },
    { id: 'travel', ic: '🗺️', tiers: [50, 150, 300], v: () => S.level - 1 },
    { id: 'perfect', ic: '⭐', tiers: [30, 100, 250], v: () => Object.values(S.stars).filter(x => x >= 3).length },
    { id: 'collect', ic: '🖼️', tiers: [10, 25, 0], v: () => picCount() + Gen.packPics().filter(p => S.pack[p.id]).length },
    { id: 'owl', ic: '🌙', secret: 1, goal: 1, v: () => mp('owl') },
    { id: 'stubborn', ic: '💪', secret: 1, goal: 1, v: () => mp('stub') },
    { id: 'edge', ic: '❤️', secret: 1, goal: 10, v: () => mp('edge') },
    { id: 'dperf', ic: '👑', secret: 1, goal: 7, v: () => mp('dperf') },
    { id: 'legend', ic: '💎', legend: 1, goal: 8, v: () => MEDALS.filter(m => m.tiers && (S.med[m.id] || 0) >= 3).length },
  ];
  const tiersOf = m => m.tiers.map(x => x || (Gen.mainPics().length + Gen.packPics().length));
  const mName = m => (t('md')[m.id] || [m.id])[0];
  const mDesc = m => (t('md')[m.id] || ['', ''])[1];
  const tierName = tr => t('medalTiers')[tr - 1] || '';
  const tierRank = tr => [0, 1, 2, 4, 3, 5][tr];          // السرية بين الفضية والذهبية
  // ——— رسم الميدالية (SVG): حافة مسنّنة معدنية + حلقة + مينا ملوّنة لكل ميدالية + رمز أبيض ———
  const MD_COL = { flaw: '#0fa89a', sniper: '#e5484d', loyal: '#f2621a', mind: '#cf3d97', bolt: '#3e63dd', travel: '#2f9e64', perfect: '#ee9b00', collect: '#6e56cf', owl: '#2c2a73', stubborn: '#a15c28', edge: '#e2366f', dperf: '#8e4ec6', legend: '#17123f' };
  const MD_ROSETTE = (() => { let d = ''; const n = 22; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? 44.8 : 49.2, a = Math.PI * i / n - Math.PI / 2; d += (i ? 'L' : 'M') + (50 + r * Math.cos(a)).toFixed(1) + ' ' + (50 + r * Math.sin(a)).toFixed(1); } return d + 'Z'; })();
  const mixHex = (h, to, k) => { const a = parseInt(h.slice(1), 16), b = parseInt(to.slice(1), 16); const c = sh => Math.round(((a >> sh) & 255) * (1 - k) + ((b >> sh) & 255) * k); return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1); };
  function medalSvg(m, tier, locked, o) {
    o = o || {};
    const unknown = !o.g && m.secret && locked;
    const metal = locked ? 0 : tier;
    let col = o.col || (unknown ? '#454a66' : MD_COL[m.id] || '#666');
    if (locked && !unknown) col = mixHex(col, '#b9bdcc', 0.55);
    const g = o.g || (unknown ? 'q' : m.id);
    return `<svg class="md-svg${metal === 5 ? ' prism' : ''}" viewBox="0 0 100 100" aria-hidden="true" style="color:${col}">
      <path d="${MD_ROSETTE}" fill="url(#mdm${metal})" stroke="rgba(0,0,0,.22)" stroke-width="1"/>
      <circle cx="50" cy="50" r="41.5" fill="url(#mdm${metal})" stroke="rgba(0,0,0,.3)" stroke-width="1.4"/>
      <circle cx="50" cy="50" r="38.6" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.3" stroke-dasharray="1.6 2.4"/>
      <circle cx="50" cy="50" r="34" fill="${col}"/><circle cx="50" cy="50" r="34" fill="url(#mdshade)"/>
      <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(0,0,0,.32)" stroke-width="2.2"/>
      <svg x="26" y="26" width="48" height="48" viewBox="0 0 24 24" opacity="${locked && !unknown ? 0.8 : 1}"><use href="#mg-${g}"/></svg>
      <path d="M25 43a26 26 0 0 1 36-24" stroke="#fff" stroke-opacity=".38" stroke-width="5" stroke-linecap="round" fill="none"/>
      ${locked && !unknown && !o.nolock ? '<g><circle cx="79" cy="79" r="14" fill="#2b2d42" stroke="#fff" stroke-width="3"/><rect x="72.5" y="78" width="13" height="9.5" rx="2" fill="#fff"/><path d="M75.2 78v-3.2a3.8 3.8 0 0 1 7.6 0V78" stroke="#fff" stroke-width="2.4" fill="none"/></g>' : ''}
    </svg>`;
  }
  function medalDisc(m, tier, cls, locked) {
    return `<span class="md-disc ${cls || ''}${locked ? ' lockd' : ''}">${medalSvg(m, tier, locked)}</span>`;
  }
  function medalMedal(m, tier) {
    const locked = !tier, col = locked ? '#9aa0b4' : MD_COL[m.id] || '#888';
    return `<div class="md-medal" style="--rbc:${col}"><i class="rb l"></i><i class="rb r"></i>${medalDisc(m, tier || 1, 'big', locked)}</div>`;
  }
  // ——— الميداليات في لوحة الصدارة ———
  /** ما يُنشر: m = {id: درجة} للميداليات المحققة فقط، f = رقم الميدالية المعروضة (-1 لا شيء) */
  function medalPub() {
    const m = {};
    MEDALS.forEach(x => { if (S.med[x.id]) m[x.id] = S.med[x.id]; });
    return { m, f: showIdx(m) };
  }
  const medTier = (x, lv) => x.tiers ? lv : lv ? (x.legend ? 5 : 4) : 0;
  function showIdx(m) {
    const pick = S.prof.f;
    if (pick != null && pick >= 0 && MEDALS[pick] && m[MEDALS[pick].id]) return pick;
    let best = -1, br = 0;
    MEDALS.forEach((x, i) => { const r = tierRank(medTier(x, m[x.id] || 0)); if (r > br) { br = r; best = i; } });
    return best;
  }
  function rkMedal(r) {
    const m = r && r.m; if (!m || typeof m !== 'object') return '';
    const n = Object.keys(m).filter(k => MEDALS.some(x => x.id === k)).length; if (!n) return '';
    const x = MEDALS[r.f] && m[MEDALS[r.f].id] ? MEDALS[r.f] : null;
    return `<span class="rk-md">${x ? `<span class="md-disc xs">${medalSvg(x, medTier(x, m[x.id]), false)}</span>` : ''}<i dir="ltr">${n}</i></span>`;
  }
  /** خزانة لاعب من لوحة الصدارة */
  function playerCard(r) {
    const m = (r.m && typeof r.m === 'object') ? r.m : {};
    const n = MEDALS.filter(x => m[x.id]).length;
    const cells = MEDALS.map((x, i) => {
      const lv = m[x.id] || 0, tr = medTier(x, lv);
      return `<span class="pc-md${i === r.f && lv ? ' fav' : ''}" title="${esc(lv || !x.secret ? mName(x) : t('medalSecret'))}"><span class="md-disc sm${tr ? '' : ' lockd'}">${medalSvg(x, tr || (x.legend ? 5 : x.secret ? 4 : 1), !tr, { nolock: 1 })}</span>${tr ? `<i class="t${tr}"></i>` : ''}</span>`;
    }).join('');
    const golds = MEDALS.filter(x => x.tiers && m[x.id] >= 3).length;
    modal(`<div class="pc-head"><span class="rk-av big">${av(r.a)}</span><h3>${esc(r.n || t('player'))}</h3>${r.l ? `<small>${t('level')} ${r.l}</small>` : ''}</div>
      <div class="pc-sum"><span><b dir="ltr">${n}</b> / ${MEDALS.length} ${t('medals')}</span>${golds ? `<span><span class="md-disc xs">${medalSvg({}, 3, false, { col: '#e0a100', g: 'perfect' })}</span><b dir="ltr">${golds}</b></span>` : ''}</div>
      ${n || r.m ? `<div class="pc-grid">${cells}</div>` : `<p class="sub">${t('noMedals')}</p>`}
      <div class="m-actions"><button class="btn primary" data-a="ok">${t('ok')}</button></div>`, { ok: closeModal }, { cls: ' pcard' });
  }
  /** نسبة اللاعبين اللي معهم ميدالية بدرجة معينة (من لوحة "الكل")، مع ذاكرة ساعة */
  const rarCache = {};
  async function medalRarity(x, lv) {
    if (!window.Cloud || !Cloud.ok || navigator.onLine === false) return null;
    const key = x.id + lv, now = Date.now();
    if (rarCache[key] && now - rarCache[key].at < 3600e3) return rarCache[key].p;
    if (!rarCache.den || now - rarCache.den.at > 3600e3) rarCache.den = { at: now, p: await Cloud.count('f', 'GREATER_THAN_OR_EQUAL', -1) };
    const den = rarCache.den.p; if (!den) return null;
    const own = await Cloud.count('m.' + x.id, 'GREATER_THAN_OR_EQUAL', lv);
    const p = Math.min(100, 100 * own / den);
    rarCache[key] = { at: now, p };
    return p;
  }
  const fmtPct = p => p == null ? '' : (p < 1 ? (p === 0 ? '0' : '<1') : p < 10 ? p.toFixed(1).replace(/\.0$/, '') : Math.round(p)) + '%';
  function fillRarity(el, x, lv) {
    if (!el) return;
    medalRarity(x, lv).then(p => { if (p == null || !el.isConnected) return; el.innerHTML = `🌍 ${t('rarity').replace('{p}', `<b dir="ltr">${fmtPct(p)}</b>`)}`; el.classList.add('on'); }).catch(() => {});
  }
  /** يحدّث العدّادات بعد الفوز */
  function medalWin(ms) {
    if (G.mode === 'zen' || G.mode === 'gift') return;
    const M = S.mp, flawless = engine.mistakes === 0 && !G.usedChance, big = engine.total >= 30;
    const hard = G.diff === 'hard' || G.diff === 'expert' || G.diff === 'insane';
    if (G.mode === 'journey' || G.mode === 'daily') M.arrowBest = Math.max(M.arrowBest || 0, G.best || 0);
    if (big) {
      if (flawless) { M.flawRun = (M.flawRun || 0) + 1; M.flawBest = Math.max(M.flawBest || 0, M.flawRun); }
      else M.flawRun = 0;
      if (engine.hearts === 1) M.edge = (M.edge || 0) + 1;
    }
    if (hard && !G.hintsUsed && !G.lensUsed) M.noHelp = (M.noHelp || 0) + 1;
    if (hard && flawless && ms / engine.total <= 1250) M.bolt = (M.bolt || 0) + 1;
    if (new Date().getHours() < 4) M.owl = 1;
    const key = medalKey();
    if (M.lz && M.lz.k === key && M.lz.c >= 5) M.stub = 1;
    M.lz = null;
    if (G.mode === 'daily' && G.dailyNew && flawless) M.dperf = (M.dperf || 0) + 1;
    M.dailyBest = Math.max(M.dailyBest || 0, S.daily.streak || 0);
  }
  function medalLose() {
    if (G.mode === 'zen' || G.mode === 'gift') return;
    const M = S.mp, key = medalKey();
    M.flawRun = 0;
    if (G.mode === 'journey' || G.mode === 'daily') M.arrowBest = Math.max(M.arrowBest || 0, G.best || 0);
    M.lz = M.lz && M.lz.k === key ? { k: key, c: M.lz.c + 1 } : { k: key, c: 1 };
    save();
  }
  const medalKey = () => G.mode === 'journey' ? 'j' + G.n : G.mode === 'daily' ? 'd' + today() : 'p' + G.pk;

  /** يمنح الدرجات الجديدة وجوائزها ويرجع قائمتها */
  function medalCheck() {
    const out = [];
    const give = (m, tier) => {
      const r = { m, tier, c: [0, 50, 150, 400, 150, 1000][tier], chest: tier === 2 || tier === 4 ? 1 : 0, trail: null };
      if (tier === 3) { const tr = MEDAL_GOLD_TRAILS.find(i => !S.own.trail.includes(i)); if (tr != null) r.trail = tr; else r.chest = 1; }
      if (tier === 5 && !S.own.trail.includes(MEDAL_LEGEND_TRAIL)) r.trail = MEDAL_LEGEND_TRAIL;
      S.coins += r.c; if (r.chest) S.chestReady = (S.chestReady || 0) + r.chest;
      if (r.trail != null) S.own.trail.push(r.trail);
      out.push(r);
    };
    for (const m of MEDALS) {
      const had = S.med[m.id] || 0, v = m.v();
      if (m.tiers) {
        const got = tiersOf(m).filter(x => v >= x).length;
        for (let tr = had + 1; tr <= got; tr++) give(m, tr);
        if (got > had) S.med[m.id] = got;
      } else if (!had && v >= m.goal) { S.med[m.id] = 1; give(m, m.legend ? 5 : 4); }
    }
    if (out.length) { S.medT = Date.now(); save(); updateTools(); }
    return out;
  }
  function maybeMedals() {
    if (current !== 'home' || modalOpen) return;
    const nw = medalCheck();
    if (nw.length) medalCeremony(nw);
  }

  /** مشهد الفوز بميدالية (أو عدة ميداليات) */
  function medalCeremony(list, after) {
    const top = list.reduce((a, b) => tierRank(b.tier) > tierRank(a.tier) ? b : a);
    const hi = {}; list.forEach(x => { if (!hi[x.m.id] || x.tier > hi[x.m.id].tier) hi[x.m.id] = x; });
    const rest = Object.values(hi).filter(x => x.m !== top.m);
    const coins = list.reduce((a, x) => a + x.c, 0), chests = list.reduce((a, x) => a + x.chest, 0), trails = list.filter(x => x.trail != null);
    const need = top.m.tiers ? tiersOf(top.m)[top.tier - 1] : top.m.goal;
    modal(`<div class="cm-fx" id="cm-fx"></div><h3>${list.length > 1 ? t('medalNew2') : t('medalNew')}</h3>
      <div class="md-stage" id="md-stage"><i class="md-rays"></i>${medalMedal(top.m, top.tier)}</div>
      <span class="md-tier t${top.tier}">${tierName(top.tier)}</span>
      <h3 class="md-name">${mName(top.m)}</h3>
      <p class="md-desc">${mDesc(top.m)}${top.m.tiers || top.m.goal > 1 ? ` · <b dir="ltr">${need}</b>` : ''}</p>
      <p class="md-rar" id="md-rar"></p>
      ${rest.length ? `<div class="md-more">${rest.map(x => `<span title="${esc(mName(x.m))}">${medalDisc(x.m, x.tier, 'sm')}</span>`).join('')}</div>` : ''}
      <div class="md-rew">${coins ? `<span>${icon('i-coin')}<b dir="ltr">+${coins}</b></span>` : ''}${chests ? `<span>${icon('i-chest')}<b dir="ltr">+${chests}</b></span>` : ''}${trails.map(x => `<span class="rare">✨ ${esc(styleName('trail', x.trail)[S.set.lang] || '')}</span>`).join('')}</div>
      <div class="m-actions"><button class="btn primary" data-a="ok">${t('medalCont')}</button></div>`,
    { ok: () => { closeModal(); coinUI(); if (current === 'home') renderHome(); if (after) after(); } }, { locked: true, cls: ' chestm medalm' });
    Sound.unlock(); setTimeout(() => Sound.chest(), 250); setTimeout(() => Sound.reward(), 900);
    if (cloudOn) { cloudPush().then(() => fillRarity($('md-rar'), top.m, top.m.tiers ? top.tier : 1)); }
    vibrate([20, 40, 30, 40, 80]);
    setTimeout(() => {
      const fx = $('cm-fx'), st = $('md-stage'); if (!fx || !st) return;
      const cx = fx.clientWidth / 2, cy = st.offsetTop + st.offsetHeight / 2;
      let h = '';
      for (let i = 0; i < 24; i++) {
        const dx = ((i / 24) * 2 - 1) * 150 + (Math.random() - 0.5) * 40, dy = -(70 + Math.random() * 120), k = i % 3;
        h += `<b class="cm-p ${k ? 's' : 'g'}" style="left:${cx}px;top:${cy}px;--dx:${dx | 0}px;--dy:${dy | 0}px;--rot:${(Math.random() * 720 - 360) | 0}deg;--dl:${(Math.random() * 0.2).toFixed(2)}s;--sz:${(13 + Math.random() * 12) | 0}px">${k === 2 ? '★' : '✦'}</b>`;
      }
      fx.innerHTML = h;
    }, 650);
  }

  /** أقرب ميدالية لشاشة الفوز: "باقي 2 لميدالية بلا غلطة الفضية" */
  function medalNear() {
    let best = null;
    for (const m of MEDALS) {
      if (!m.tiers) continue;
      const e = S.med[m.id] || 0; if (e >= 3) continue;
      const need = tiersOf(m)[e], v = m.cur ? m.cur() : m.v(), left = need - v;
      if (v <= 0 || left <= 0 || left > Math.max(2, Math.ceil(need * 0.1))) continue;
      const r = v / need;
      if (!best || r > best.r) best = { m, left, tier: e + 1, r };
    }
    return best;
  }
  function nearHtml() {
    const n = medalNear(); if (!n) return '';
    return `<div class="m-near">${medalDisc(n.m, n.tier, 'xs')}<span>${t('medalNear').replace('{n}', `<b dir="ltr">${n.left}</b>`)} <b>${mName(n.m)}</b> ${t('medalTiersAl')[n.tier - 1]}</span></div>`;
  }

  /** صفحة الميداليات */
  function renderMedals() {
    const cnt = tr => MEDALS.filter(m => m.tiers && (S.med[m.id] || 0) >= tr).length;
    const sec = MEDALS.filter(m => m.secret && S.med[m.id]).length, nSec = MEDALS.filter(m => m.secret).length;
    $('md-sum').innerHTML = (S.med.legend ? `<span class="legend">💎 ${t('legendTitle')}</span>` : '')
      + [[3, cnt(3), '#e0a100'], [2, cnt(2), '#8d99ad'], [1, cnt(1), '#b4692f']].map(([tr, n, c]) => `<span><span class="md-disc xs">${medalSvg({}, tr, false, { col: c, g: 'perfect' })}</span><b>${n}</b></span>`).join('')
      + `<span><span class="md-disc xs">${medalSvg({}, 4, false, { col: '#5b2fb0', g: 'q' })}</span><b dir="ltr">${sec}/${nSec}</b></span>`;
    $('md-grid').innerHTML = MEDALS.map((m, i) => {
      const e = S.med[m.id] || 0;
      const tierShow = m.tiers ? e : e ? (m.legend ? 5 : 4) : 0;
      let prog = '';
      if (m.tiers) {
        if (e >= 3) prog = `<small class="done">✓ ${t('medalDone')}</small>`;
        else { const need = tiersOf(m)[e], v = Math.min(need, m.cur ? m.cur() : m.v()); prog = `<small dir="ltr" class="num">${v} / ${need}</small>`; }
        prog = `<span class="md-pips">${[1, 2, 3].map(k => `<i class="${e >= k ? 'on p' + k : ''}"></i>`).join('')}</span>` + prog;
      } else if (e) prog = `<small class="done">✓ ${tierName(tierShow)}</small>`;
      else if (m.secret) prog = `<small>${t('medalSecretSub')}</small>`;
      else { const v = Math.min(m.goal, m.v()); prog = `<span class="md-bar"><i style="width:${Math.round(100 * v / m.goal)}%"></i></span><small dir="ltr" class="num">${v} / ${m.goal}</small>`; }
      const nm = m.secret && !e ? t('medalSecret') : mName(m);
      let pct = 0, rc = '';
      if (m.tiers && e < 3) { const need = tiersOf(m)[e], v = m.cur ? m.cur() : m.v(); pct = Math.min(100, Math.round(100 * v / need)); rc = ['#cf8a4c', '#9aa6b8', '#f2b400'][e]; }
      else if (m.legend && !e) { pct = Math.round(100 * Math.min(m.goal, m.v()) / m.goal); rc = '#c98bff'; }
      const disc = medalDisc(m, tierShow || (m.legend ? 5 : m.secret ? 4 : 1), '', !tierShow);
      return `<button class="md-card ${tierShow ? 'got t' + tierShow : ''} ${m.legend ? 'legend' : ''}" data-md="${i}"><span class="md-ring${rc ? '' : ' none'}" style="--p:${pct};--rc:${rc || 'transparent'}">${disc}</span><b>${nm}</b>${prog}</button>`;
    }).join('');
    $('md-grid').querySelectorAll('[data-md]').forEach(b => b.addEventListener('click', () => { Sound.click(); medalInfo(MEDALS[+b.dataset.md]); }));
  }
  function medalInfo(m) {
    const e = S.med[m.id] || 0;
    if (m.secret && !e) { modal(`${medalMedal(m, 0)}<h3>${t('medalSecret')}</h3><p>${t('medalSecretSub')}</p><div class="m-actions"><button class="btn primary" data-a="ok">${t('ok')}</button></div>`, { ok: closeModal }, { cls: ' mdinfo' }); return; }
    const rewards = ['', `${icon('i-coin')} 50`, `${icon('i-coin')} 150 + ${icon('i-chest')}`, `${icon('i-coin')} 400 + ✨`];
    let rows = '';
    if (m.tiers) {
      rows = `<div class="md-rows">${tiersOf(m).map((x, k) => `<div class="${e > k ? 'on' : ''}">${medalDisc(m, k + 1, 'xs')}<span>${tierName(k + 1)}<em class="rar" dir="ltr" data-rt="${k + 1}"></em></span><b dir="ltr">${x}</b><small>${rewards[k + 1]}</small>${e > k ? '<em>✓</em>' : ''}</div>`).join('')}</div>`;
      const v = m.v();
      rows += `<p class="md-now">${m.cur ? `${t('medalNow')}: <b dir="ltr">${m.cur()}</b> · ${t('medalBest')}: <b dir="ltr">${v}</b>` : `${t('medalNow')}: <b dir="ltr">${v}</b>`}</p>`;
    } else {
      rows = `<div class="md-rows"><div class="${e ? 'on' : ''}">${medalDisc(m, m.legend ? 5 : 4, 'xs')}<span>${tierName(m.legend ? 5 : 4)}</span><b dir="ltr">${Math.min(m.goal, m.v())}/${m.goal}</b><small>${m.legend ? `${icon('i-coin')} 1000 + ✨` : rewards[2]}</small>${e ? '<em>✓</em>' : ''}</div></div>`;
    }
    const idx = MEDALS.indexOf(m), shown = e && showIdx(medalPub().m) === idx;
    const showBtn = e ? `<button class="btn${shown ? ' on' : ''}" data-a="show" ${shown ? 'disabled' : ''}>${shown ? '✓ ' + t('showcased') : '📌 ' + t('showcase')}</button>` : '';
    modal(`${medalMedal(m, m.tiers ? e : e ? (m.legend ? 5 : 4) : 0)}<h3>${mName(m)}</h3><p class="md-desc">${mDesc(m)}</p><p class="md-rar" id="md-rar"></p>${rows}<div class="m-actions"><button class="btn primary" data-a="ok">${t('ok')}</button>${showBtn}</div>`, {
      ok: closeModal,
      show: () => { S.prof.f = idx; S.prof.t = Date.now(); save(); toast('📌 ' + t('showcased')); medalInfo(m); },
    }, { cls: ' mdinfo' });
    if (e) fillRarity($('md-rar'), m, m.tiers ? e : 1);
    document.querySelectorAll('#modal .rar[data-rt]').forEach(el => medalRarity(m, +el.dataset.rt).then(p => { if (p != null && el.isConnected) el.textContent = fmtPct(p); }).catch(() => {}));
  }

  function offerTry(st, after) {
    modal(`<h3>✨</h3><h3 style="font-size:22px">${t('newStyle')}</h3><canvas class="m-prev" id="m-prev"></canvas><p><b>${esc(styleName(st.kind, st.i)[S.set.lang] || '')}</b></p>
      <div class="m-actions"><button class="btn primary" data-a="use">${t('tryStyle')}</button><button class="btn" data-a="no">${t('later')}</button></div>`,
    { use: () => { S.eq[st.kind] = st.i; save(); applyStyle(); closeModal(); toast(t('equipped')); if (after) after(); }, no: () => { closeModal(); if (after) after(); } });
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
  const adLeft = () => ECON.adCoinsPerDay - (S.ad.cd && S.ad.cd.d === today() ? S.ad.cd.n : 0);
  function renderShop() {
    document.querySelectorAll('#shop-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === shopTab));
    const g = $('shop-grid');
    if (shopTab === 'tools') {
      const tools = [{ k: 'h', n: ECON.hints.n, p: ECON.hints.p, ic: '💡', lbl: t('buyHints'), have: S.hints }, { k: 'l', n: ECON.lenses.n, p: ECON.lenses.p, ic: '🔍', lbl: t('buyLenses'), have: S.lenses }];
      g.innerHTML = tools.map((x, i) => `<div class="sh-card tool-card"><div class="sh-ic">${x.ic}<i>${x.have}</i></div><b>${x.lbl}</b><button class="sh-btn buy" data-tool="${i}">${icon('i-coin')} ${x.p}</button></div>`).join('')
        + (Ads.ready() ? `<div class="sh-card tool-card"><div class="sh-ic">🎬</div><b>+${ECON.adCoins} ${t('coins')}</b><button class="sh-btn buy" data-adcoins="1" ${adLeft() ? '' : 'disabled'}>${adLeft() ? t('watchAd') + ` (${adLeft()})` : t('adLimit')}</button></div>` : '');
      g.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
        const x = tools[+b.dataset.tool];
        if (S.coins < x.p) { Sound.bump(); toast(t('notEnough').replace('{n}', x.p - S.coins)); return; }
        S.coins -= x.p; if (x.k === 'h') S.hints += x.n; else S.lenses += x.n;
        save(); updateTools(); Sound.reward(); toast(x.ic + ' +' + x.n); renderShop(); coinUI();
      }));
      g.querySelectorAll('[data-adcoins]').forEach(b => b.addEventListener('click', () => { if (!adLeft()) return; Ads.reward('coins', () => {
        if (!S.ad.cd || S.ad.cd.d !== today()) S.ad.cd = { d: today(), n: 0 };
        S.ad.cd.n++; S.coins += ECON.adCoins; save(); coinUI(); Sound.coins(); renderShop();
      }); }));
      cancelAnimationFrame(shopRaf);
      return;
    }
    const kind = shopTab, list = kind === 'trail' ? window.ArrowTrails : window.ArrowSkins.map(n => ({ name: n }));
    g.innerHTML = list.map((it, i) => {
      const own = S.own[kind].includes(i), on = S.eq[kind] === i, p = priceOf(kind, i);
      const btn = !own && kind === 'trail' && i >= MEDAL_TRAIL0 ? `<button class="sh-btn medal" disabled>🏅 ${t('medalOnly')}</button>` : on ? `<button class="sh-btn on" disabled>${t('equipped')}</button>` : own ? `<button class="sh-btn" data-eq="${i}">${t('equip')}</button>` : `<button class="sh-btn buy ${p > S.coins ? 'poor' : ''}" data-buy="${i}">${icon('i-coin')} ${p}</button>`;
      return `<div class="sh-card ${on ? 'on' : ''} ${own ? '' : 'locked'}"><canvas data-i="${i}"></canvas><b>${esc(it.name[S.set.lang])}</b>${btn}</div>`;
    }).join('');
    g.querySelectorAll('[data-eq]').forEach(b => b.addEventListener('click', () => { Sound.click(); S.eq[kind] = +b.dataset.eq; save(); applyStyle(); renderShop(); }));
    g.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.buy, p = priceOf(kind, i);
      if (kind === 'trail' && i >= MEDAL_TRAIL0) return;
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

  // ——— الحساب والسحابة ولوحة الصدارة ———
  const AVATARS = ['🐰', '🦊', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🐧', '🐨', '🐵', '🐱', '🐶', '🐻', '🐮', '🐷', '🐳', '🦋', '🐢', '🦉', '🐝', '🦀', '🐬', '🦒'];
  const av = i => AVATARS[((i % AVATARS.length) + AVATARS.length) % AVATARS.length];
  const CU = () => (window.Cloud && Cloud.ok ? Cloud.user : null);
  function myName() {
    if (S.prof.n) return S.prof.n;
    const u = CU();
    if (u && u.name) return u.name.split(' ')[0].slice(0, 16);
    return t('player') + ' ' + (u ? u.uid.slice(-4).toUpperCase() : '');
  }
  const accLabel = () => { const u = CU(); return !u || u.anon ? t('guest') + ' · ' + t('saveProgress') : (u.email || 'Google'); };
  const totalScore = () => Object.values(S.rec || {}).reduce((a, r) => a + (r.s || 0), 0) + 50 * totalStars();
  const SKIP = { set: 1, gifts: 1, ad: 1 };
  const mx = (a, b) => { const r = Object.assign({}, a); for (const k in b || {}) r[k] = Math.max(r[k] || 0, b[k] || 0); return r; };
  const uni = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort((x, y) => x - y);
  const newer = (a, b, k) => ((b && b[k]) || '') > ((a && a[k]) || '') ? b : a;
  /** دمج التقدم المحلي مع المحفوظ في السحابة: نأخذ الأفضل من الاثنين فلا يضيع شيء */
  function mergeSave(a, b) {
    const o = Object.assign({}, b, a);
    o.level = Math.max(a.level || 1, b.level || 1);
    o.stars = mx(a.stars, b.stars); o.pics = mx(a.pics, b.pics); o.pack = mx(a.pack, b.pack);
    for (const k of ['coins', 'hints', 'lenses', 'chestReady', 'wins']) o[k] = Math.max(a[k] || 0, b[k] || 0);
    o.own = { trail: uni(a.own && a.own.trail, b.own && b.own.trail), skin: uni(a.own && a.own.skin, b.own && b.own.skin) };
    o.rec = Object.assign({}, b.rec);
    for (const k in a.rec || {}) { const x = a.rec[k], y = o.rec[k]; o.rec[k] = y ? { s: Math.max(x.s, y.s), t: Math.min(x.t, y.t) } : x; }
    o.daily = newer(a.daily, b.daily, 'last'); o.login = newer(a.login, b.login, 'last');
    o.today = a.today && b.today && a.today.d === b.today.d ? { d: a.today.d, n: Math.max(a.today.n, b.today.n) } : newer(a.today, b.today, 'd');
    o.wk = a.wk && b.wk && a.wk.id === b.wk.id ? { id: a.wk.id, s: Math.max(a.wk.s, b.wk.s) } : newer(a.wk, b.wk, 'id');
    o.seen = Object.assign({}, b.seen, a.seen);
    o.med = mx(a.med, b.med); o.mp = Object.assign({}, b.mp, a.mp);
    for (const k in (b.mp || {})) if (typeof b.mp[k] === 'number' && typeof (a.mp || {})[k] === 'number') o.mp[k] = Math.max(a.mp[k], b.mp[k]);
    o.prof = ((b.prof && b.prof.t) || 0) > ((a.prof && a.prof.t) || 0) ? b.prof : a.prof;
    return o;
  }
  let lastPub = '', pushing = null, mdRulesOk = true;
  function cloudPush() {
    if (!CU() || navigator.onLine === false) return Promise.resolve();
    if (pushing) return pushing.then(() => cloudPush());
    const data = {}; for (const k in S) if (!SKIP[k]) data[k] = S[k];
    const who = { n: myName(), a: S.prof.a % AVATARS.length }, td = today(), dr = S.rec['d' + td], sc = totalScore();
    const md = medalPub();
    const pub = JSON.stringify([who, sc, S.level, S.wk, dr && dr.t, md]);
    pushing = (async () => {
      await Cloud.save(JSON.stringify(data));
      if (pub !== lastPub) {
        const jobs = [];
        // الميداليات مع الصف العام؛ إذا القواعد القديمة رفضتها نرسل بدونها (وما نعيد المحاولة بهالجلسة)
        const pubRow = (fn, row) => jobs.push((mdRulesOk ? fn(Object.assign({}, row, md)) : Promise.reject(0)).catch(() => { mdRulesOk = false; return fn(row); }));
        if (sc > 0) pubRow(Cloud.board, Object.assign({ s: sc, l: S.level }, who));
        if (S.wk && S.wk.id === Cloud.weekId() && S.wk.s > 0) pubRow(Cloud.week, Object.assign({ s: S.wk.s }, who));
        if (dr && dr.t >= 3000) pubRow(Cloud.day, Object.assign({ t: Math.round(dr.t) }, who));
        await Promise.all(jobs);
        lastPub = pub;
        for (const k in rkCache) delete rkCache[k];
      }
    })().catch(e => console.warn('cloud', e.message)).finally(() => { pushing = null; });
    return pushing;
  }
  let cloudUid = null;
  async function onCloudUser(u) {
    cloudOn = true;
    if (u.uid !== cloudUid) {
      cloudUid = u.uid; lastPub = '';
      try {
        const raw = await Cloud.load();
        if (raw) {
          const keep = { set: S.set, gifts: S.gifts, ad: S.ad };
          S = Object.assign(mergeSave(S, JSON.parse(raw)), keep);
          if (!S.own.trail.includes(S.eq.trail)) S.eq.trail = 1;
          if (!S.own.skin.includes(S.eq.skin)) S.eq.skin = 0;
          try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
          applyStyle(); coinUI(); updateTools();
          if (current !== 'game') show(current);
        }
      } catch (e) { console.warn('cloud load', e.message); }
    }
    if (current === 'settings') renderSettings();
    if (current === 'ranks') renderRanksHead();
    if (modalOpen && modalOpen.acct) accountModal();
    cloudPush();
  }

  const AE = { 'auth/invalid-email': 'aeEmail', 'auth/missing-email': 'aeEmail', 'auth/wrong-password': 'aePass', 'auth/invalid-credential': 'aePass', 'auth/invalid-login-credentials': 'aePass', 'auth/user-not-found': 'aePass', 'auth/missing-password': 'aeWeak', 'auth/email-already-in-use': 'aeExists', 'auth/weak-password': 'aeWeak', 'auth/network-request-failed': 'aeNet', 'auth/too-many-requests': 'aeMany', 'auth/operation-not-allowed': 'aeOff', 'auth/unauthorized-domain': 'aeOff', 'auth/popup-blocked': 'aePopup' };
  function accountModal(intro) {
    const u = CU(), on = !!(window.Cloud && Cloud.ok);
    const guestUser = !u || u.anon;
    const avs = AVATARS.map((e, i) => `<button class="av ${i === S.prof.a % AVATARS.length ? 'on' : ''}" data-av="${i}">${e}</button>`).join('');
    const prof = `<div class="ac-prof"><div class="ac-me"><span class="ac-av" id="ac-av">${av(S.prof.a)}</span><input id="ac-name" maxlength="16" value="${esc(myName())}" placeholder="${t('namePh')}"></div><div class="av-row">${avs}</div><small class="sub">${t('profile')}</small></div>`;
    const google = on && Cloud.canGoogle() ? `<button class="btn g-btn" data-a="google"><svg viewBox="0 0 48 48" width="22" height="22"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg><span>${t('withGoogle')}</span></button><div class="ac-or"><span>${t('or')}</span></div>` : '';
    const body = !on ? `<p class="sub">${t('needOnline')}</p>`
      : guestUser ? `${google}<input id="ac-email" type="email" dir="ltr" autocomplete="email" placeholder="${t('email')}"><input id="ac-pass" type="password" dir="ltr" autocomplete="current-password" placeholder="${t('password')}">
        <p class="ac-err" id="ac-err"></p>
        <div class="ac-two"><button class="btn primary" data-a="in">${t('signIn')}</button><button class="btn" data-a="up">${t('signUp')}</button></div>
        <button class="ac-link" data-a="forgot">${t('forgot')}</button>`
      : `<div class="ac-who">${u.google ? '🟢 Google' : '✉️'} <b dir="ltr">${esc(u.email)}</b><small>${t('progressSafe')}</small></div><p class="ac-err" id="ac-err"></p>`;
    modal(`<h3>${guestUser ? t('saveProgress') : t('account')}</h3>
      ${guestUser ? `<p>${intro ? t('saveNudge') : t('saveProgressSub')}</p>` : ''}
      ${prof}${body}
      <div class="m-actions">${guestUser ? '' : `<button class="btn" data-a="out" style="color:var(--danger)">${t('signOut')}</button>`}<button class="btn" data-a="close">${guestUser ? t('later') : t('done')}</button></div>`, {
      close: () => { saveProf(); closeModal(); },
      google: () => run(() => Cloud.google()),
      in: () => creds(Cloud.signIn),
      up: () => creds(Cloud.signUp),
      forgot: () => { const e = ($('ac-email').value || '').trim(); if (!e) return err('aeEmail'); run(() => Cloud.reset(e), () => toast(t('resetSent'), 3500)); },
      out: () => modal(`<h3>👋</h3><p>${t('signOutQ')}</p><div class="m-actions"><button class="btn" data-a="yes" style="color:var(--danger)">${t('signOut')}</button><button class="btn primary" data-a="no">${t('no')}</button></div>`, {
        no: () => accountModal(),
        yes: async () => {
          await cloudPush();
          const set = S.set, gf = S.gifts; S = fresh(); S.set = set; S.gifts = gf; S.prof.a = Math.floor(Math.random() * 24);
          cloudUid = null; lastPub = '';
          try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
          await Cloud.signOut().catch(() => {});
          applyStyle(); closeModal(); show('home');
        },
      }),
    }, { acct: 1 });
    const card = $('modal-card');
    card.querySelectorAll('[data-av]').forEach(b => b.addEventListener('click', () => {
      Sound.click(); S.prof.a = +b.dataset.av; S.prof.t = Date.now();
      card.querySelectorAll('[data-av]').forEach(x => x.classList.toggle('on', x === b)); $('ac-av').textContent = av(S.prof.a); save();
    }));
    function saveProf() {
      const el = $('ac-name'); if (!el) return;
      const n = el.value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
      if (n && n !== myName()) { S.prof.n = n; S.prof.t = Date.now(); save(); }
    }
    function err(k) { const e = $('ac-err'); if (e) { e.textContent = t(k); e.classList.add('show'); } else toast(t(k)); Sound.bump(); }
    function creds(fn) {
      const e = ($('ac-email').value || '').trim(), p = $('ac-pass').value || '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return err('aeEmail');
      if (p.length < 6) return err('aeWeak');
      run(() => fn(e, p));
    }
    function run(job, done) {
      if (navigator.onLine === false) return err('aeNet');
      saveProf();
      card.querySelectorAll('button,input').forEach(b => { b.disabled = true; });
      card.classList.add('busy');
      job().then(() => {
        card.classList.remove('busy');
        if (done) { done(); card.querySelectorAll('button,input').forEach(b => { b.disabled = false; }); return; }
        closeModal(); Sound.reward(); toast(t('welcomeBack'), 3000);
        if (current === 'ranks') renderRanks();
      }).catch(e => {
        card.classList.remove('busy');
        card.querySelectorAll('button,input').forEach(b => { b.disabled = false; });
        if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return;
        console.warn('auth', e && e.code, e && e.message);
        err(AE[e && e.code] || 'aeGen');
      });
    }
  }
  /** بعد عدة مراحل كضيف: نذكّر مرة واحدة بحفظ التقدم */
  function maybeAskAccount() {
    const u = CU();
    if (current !== 'home' || modalOpen || !u || !u.anon || S.level < 8 || S.seen.acct) return;
    S.seen.acct = 1; save();
    accountModal(true);
  }

  let rkTab = 'week';
  const rkCache = {};
  function renderRanksHead() {
    const u = CU();
    $('rk-acc').innerHTML = `<span class="ac-av">${av(S.prof.a)}</span><span class="rk-acc-t"><b>${esc(myName())}</b><small>${esc(accLabel())}</small></span><i>${!u || u.anon ? t('saveProgress') : '✎'}</i>`;
    $('rk-acc').classList.toggle('guest', !u || u.anon);
  }
  async function renderRanks(force) {
    renderRanksHead();
    document.querySelectorAll('#rk-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === rkTab));
    const days = 7 - ((new Date().getUTCDay() + 6) % 7);
    $('rk-note').textContent = rkTab === 'week' ? t('rkWeekNote').replace('{n}', days) : rkTab === 'all' ? t('rkAllNote') : t('rkDayNote');
    const list = $('rk-list'), me = $('rk-me'), tab = rkTab;
    if (!window.Cloud || !Cloud.ok || navigator.onLine === false) { list.innerHTML = `<p class="rk-empty">📡<br>${t('rkOffline')}</p>`; me.innerHTML = ''; return; }
    const c = rkCache[tab];
    if (!c) list.innerHTML = `<p class="rk-empty">${t('rkLoading')}</p>`;
    try {
      if (!c || force || Date.now() - c.at > 30000) {
        await cloudPush();
        rkCache[tab] = { at: Date.now(), rows: await Cloud.top(tab, 50) };
      }
      if (tab !== rkTab || current !== 'ranks') return;
      const rows = rkCache[tab].rows, u = CU(), uid = u && u.uid;
      const val = r => tab === 'day' ? fmtT(r.t) : r.s.toLocaleString('en');
      const medal = i => i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1;
      list.innerHTML = rows.length ? rows.map((r, i) => `<div class="rk-row ${r.id === uid ? 'me' : ''} ${i < 3 ? 'top' : ''}" data-rk="${i}"><span class="rk-n">${medal(i)}</span><span class="rk-av">${av(r.a)}</span><b class="rk-name">${esc(r.n)}</b>${rkMedal(r.id === uid ? medalPub() : r)}<span class="rk-v">${val(r)}</span></div>`).join('')
        : `<p class="rk-empty">🏆<br>${t('rkEmpty')}</p>`;
      list.querySelectorAll('[data-rk]').forEach(el => el.addEventListener('click', () => { const r = rows[+el.dataset.rk]; Sound.click(); playerCard(r.id === uid ? Object.assign({}, r, medalPub(), { n: myName(), a: S.prof.a }) : r); }));
      const mine = tab === 'all' ? totalScore() : tab === 'week' ? (S.wk && S.wk.id === Cloud.weekId() ? S.wk.s : 0) : (S.rec['d' + today()] || {}).t;
      const inTop = rows.findIndex(r => r.id === uid);
      if (!mine) { me.innerHTML = `<div class="rk-row me"><span class="rk-n">–</span><span class="rk-av">${av(S.prof.a)}</span><b class="rk-name">${esc(myName())}</b><span class="rk-v small">${tab === 'day' ? t('rkPlayDaily') : t('rkPlay')}</span></div>`; return; }
      const pos = inTop >= 0 ? inTop + 1 : await Cloud.rank(tab, mine);
      if (tab !== rkTab) return;
      me.innerHTML = `<div class="rk-row me" data-me="1"><span class="rk-n">${pos}</span><span class="rk-av">${av(S.prof.a)}</span><b class="rk-name">${esc(myName())} <small>(${t('rkYou')})</small></b>${rkMedal(medalPub())}<span class="rk-v">${tab === 'day' ? fmtT(mine) : mine.toLocaleString('en')}</span></div>`;
      me.querySelector('[data-me]').addEventListener('click', () => { Sound.click(); playerCard(Object.assign({ n: myName(), a: S.prof.a, l: S.level }, medalPub())); });
    } catch (e) {
      console.warn('ranks', e.message);
      if (!rkCache[tab]) list.innerHTML = `<p class="rk-empty">📡<br>${t('rkOffline')}</p>`;
    }
  }
  const fmtT = ms => { const v = Math.round(ms / 1000); return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); };
  document.querySelectorAll('#rk-tabs button').forEach(b => b.addEventListener('click', () => { Sound.click(); rkTab = b.dataset.v; renderRanks(); }));
  $('rk-acc').addEventListener('click', () => { Sound.click(); accountModal(); });
  if (window.Cloud && Cloud.ok) { Cloud.onUser(onCloudUser); Cloud.start(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden && cloudOn) { clearTimeout(cloudT); cloudPush(); } });

  // للاختبار
  window.__siham = { engine, G, S: () => S, startLevel, startDaily, startZen, idleNudge, startPack, startGift, decodeGift, openChest, maybeLogin, show, accountModal, mergeSave };

  applyI18n(); applyTheme(); applyStyle(); show('home');
  checkGift();
  window.addEventListener('hashchange', checkGift);
})();
