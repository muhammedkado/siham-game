/* سهام — واجهة التطبيق: الشاشات، الحفظ، الأوضاع */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'siham.v1';

  // ——— الحفظ ———
  const DEFAULT = {
    level: 1, stars: {}, hints: 3, lenses: 3, pics: {},
    daily: { last: null, streak: 0 },
    set: { theme: 'light', sound: true, music: true, vibe: true, lang: 'ar', safe: true },
    seen: {},
  };
  let S;
  try { S = Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = Object.assign({}, DEFAULT); }
  S.set = Object.assign({}, DEFAULT.set, S.set);
  S.daily = Object.assign({}, DEFAULT.daily, S.daily);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

  const t = k => (I18N[S.set.lang] || I18N.ar)[k] || I18N.ar[k] || k;

  // ——— أدوات ———
  function vibrate(ms) { if (S.set.vibe && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  let toastTimer = 0;
  function toast(msg, ms) {
    const el = $('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2200);
  }
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
    if (id === 'game') requestAnimationFrame(() => engine.resize());
    else Music.stop();
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
    drawPic(cv, Gen.buildBoard(PICTURES.find(p => p.id === spec.pic), spec.w || spec.f, spec.mirror), 'silhouette');
    $('h-daily').innerHTML = S.daily.last === today() ? t('dailyDone') : (S.daily.streak > 0 && S.daily.last === yesterday() ? icon('i-fire') + ' ' + t('streak') + ' ' + S.daily.streak : '+1 💡 +1 🔍');
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
    requestAnimationFrame(() => g.querySelectorAll('canvas').forEach(c => drawPic(c, picBoard(c.dataset.p), S.pics[c.dataset.p] ? 'full' : 'silhouette')));
  }

  // ——— الإعدادات ———
  function renderSettings() {
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
  $('set-vibe').addEventListener('change', e => { S.set.vibe = e.target.checked; save(); vibrate(20); });
  $('set-safe').addEventListener('change', e => { S.set.safe = e.target.checked; save(); engine.safeTap = S.set.safe; });
  $('set-reset').addEventListener('click', () => {
    modal(`<h3>⚠️</h3><p>${t('resetConfirm')}</p><div class="m-actions"><button class="btn" data-a="yes" style="color:var(--danger)">${t('yes')}</button><button class="btn primary" data-a="no">${t('no')}</button></div>`, {
      yes: () => { const set = S.set; S = JSON.parse(JSON.stringify(DEFAULT)); S.set = set; save(); closeModal(); show('home'); },
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
  const G = { mode: 'journey', n: 1, level: null, usedChance: false, combo: 0, lastExit: 0, coachStep: 0 };
  const engine = new Engine($('board'), {
    onExit(left, total) {
      const now = performance.now();
      G.combo = now - G.lastExit < 1400 ? G.combo + 1 : 0;
      G.lastExit = now;
      Sound.pop(total - left - 1, total, G.combo);
      Music.setProgress(1 - left / total);
      vibrate(10);
      updateHud();
      hideCoach();
    },
    onMistake(hearts) {
      Sound.bump(); vibrate([40, 30, 60]);
      G.combo = 0;
      updateHud(true);
      if (G.mode === 'journey' && G.n === 1 && !S.seen.coach2) { S.seen.coach2 = 1; save(); coach(t('coach2')); }
    },
    onWin, onLose,
    onLens(ok) { Sound.lens(ok); toast(ok ? t('lensClear') : t('lensBlocked')); if (G.mode !== 'zen') { S.lenses--; save(); } setLensUI(false); updateTools(); },
    onAutoZoom() { toast(t('autoZoom')); vibrate(15); },
    onTrace() { vibrate(15); hideCoach(); },
  });
  engine.safeTap = S.set.safe;

  function startLevel(n) {
    G.mode = 'journey'; G.n = n;
    launch(Gen.makeLevel(Gen.levelSpec(n)), 3);
    $('g-title').textContent = t('level') + ' ' + n;
    const tips = { 1: 'coach1', 3: 'coach3', 4: 'coach4', 5: 'coach5' };
    if (tips[n] && !S.seen[tips[n]]) { S.seen[tips[n]] = 1; save(); setTimeout(() => coach(t(tips[n])), 350); }
  }
  function startDaily() {
    G.mode = 'daily'; G.n = 0;
    launch(Gen.makeLevel(Gen.dailySpec(today())), 3);
    $('g-title').textContent = t('daily');
  }
  function startZen() {
    G.mode = 'zen'; G.n = 0;
    launch(Gen.makeLevel(Gen.zenSpec((Math.random() * 1e9) >>> 0)), 0, true);
    $('g-title').textContent = t('zen');
  }
  function launch(level, hearts, zen) {
    G.level = level; G.usedChance = false; G.combo = 0;
    hideCoach(); closeModal(); setLensUI(false);
    show('game');
    engine.load(level, { hearts, zen });
    const cells = level.mask.reduce((a, b) => a + b, 0);
    const diff = Gen.difficultyOf(cells);
    $('g-diff').textContent = zen ? '🍃' : t(diff);
    // موسيقى هادئة أو حماسية حسب المرحلة
    G.style = zen ? 'calm'
      : G.mode === 'daily' ? 'hype'
      : (diff === 'hard' || diff === 'expert' || (G.n > 3 && G.n % 5 === 0)) ? 'hype' : 'calm';
    G.seed = level.spec.seed;
    Music.start(G.style, G.seed);
    updateHud(); updateTools();
  }
  function restart() {
    if (G.mode === 'journey') startLevel(G.n);
    else if (G.mode === 'daily') startDaily();
    else launch(G.level, 0, true);
  }

  function updateHud(lost) {
    $('g-left').textContent = engine.left;
    const hb = $('g-hearts');
    if (engine.zen) hb.innerHTML = '<span class="inf">∞</span>';
    else {
      const max = Math.max(3, engine.hearts);
      let h = '';
      for (let i = 0; i < max; i++) h += icon('i-heart', i < engine.hearts ? '' : 'lost' + (lost && i === engine.hearts ? ' breaking' : ''));
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

  $('t-hint').addEventListener('click', () => {
    if (engine.over || engine.won) return;
    if (G.mode !== 'zen' && S.hints <= 0) { toast(t('noHints')); return; }
    if (!engine.useHint()) { toast(t('noFree')); return; }
    Sound.hint(); vibrate(10);
    if (G.mode !== 'zen') { S.hints--; save(); }
    updateTools();
  });
  $('t-lens').addEventListener('click', () => {
    if (engine.over || engine.won) return;
    if (engine.lensArmed) { setLensUI(false); return; }
    if (G.mode !== 'zen' && S.lenses <= 0) { toast(t('noLens')); return; }
    setLensUI(true); Sound.click(); toast(t('lensArmed'));
  });
  $('t-fit').addEventListener('click', () => { engine.fit(true); Sound.click(); });
  $('g-restart').addEventListener('click', () => { Sound.click(); restart(); });
  $('g-back').addEventListener('click', () => { Sound.click(); confirmQuit(); });
  $('btn-play').addEventListener('click', () => { Sound.unlock(); startLevel(S.level); });
  $('btn-daily').addEventListener('click', () => { Sound.unlock(); startDaily(); });
  $('btn-zen').addEventListener('click', () => { Sound.unlock(); startZen(); });

  function confirmQuit() {
    if (engine.left === engine.total || engine.won) { show(G.mode === 'journey' && prevScreen === 'levels' ? 'levels' : 'home'); return; }
    modal(`<h3>🤔</h3><h3 style="font-size:20px">${t('quit')}</h3><p>${t('quitSub')}</p><div class="m-actions"><button class="btn primary" data-a="stay">${t('no')}</button><button class="btn" data-a="go">${t('home')}</button></div>`,
      { stay: closeModal, go: () => { closeModal(); show('home'); } });
  }

  function onWin() {
    Music.stop();
    Sound.win(); vibrate([20, 40, 20, 40, 60]);
    const stars = G.mode === 'zen' ? 3 : G.usedChance ? 1 : Math.max(1, engine.hearts);
    S.pics[G.level.pic] = 1;
    const rewards = [];
    if (G.mode === 'journey') {
      S.stars[G.n] = Math.max(S.stars[G.n] || 0, stars);
      if (G.n === S.level) {
        S.level = G.n + 1;
        if (G.n % 3 === 0) { S.hints++; rewards.push('+1 💡'); }
        if (G.n % 2 === 0) { S.lenses++; rewards.push('+1 🔍'); }
      }
    } else if (G.mode === 'daily' && S.daily.last !== today()) {
      S.daily.streak = S.daily.last === yesterday() ? S.daily.streak + 1 : 1;
      S.daily.last = today();
      S.hints++; S.lenses++; rewards.push('+1 💡', '+1 🔍', '🔥 ' + S.daily.streak);
    }
    save(); updateTools();
    const name = G.level.picName[S.set.lang];
    const sub = G.mode === 'daily' ? t('dailyWin') : `${t('winSub')}: <b>${name}</b>`;
    const flawless = G.mode !== 'zen' && engine.mistakes === 0 ? `<p style="color:var(--ok);font-weight:700;margin-top:-6px">${t('perfect')}</p>` : '';
    const nextBtn = G.mode === 'journey' ? `<button class="btn primary" data-a="next">${t('next')} ➜</button>` : G.mode === 'zen' ? `<button class="btn primary" data-a="zen">${t('newZen')}</button>` : '';
    modal(`<h3>${t('winTitle')}</h3><p>${sub}</p>
      <canvas id="m-pic"></canvas>
      ${G.mode === 'zen' ? '' : `<div class="m-stars">${[1, 2, 3].map(i => icon('i-star', i <= stars ? 'on' : '')).join('')}</div>`}
      ${flawless}
      ${rewards.length ? `<div class="m-reward">${t('reward')}: ${rewards.join(' ')}</div>` : ''}
      <div class="m-actions">${nextBtn}<button class="btn" data-a="home">${t('home')}</button></div>`,
    { next: () => startLevel(G.n + 1), zen: startZen, home: () => { closeModal(); show('home'); } });
    document.querySelectorAll('.m-stars .ico.on').forEach((el, i) => { el.style.animationDelay = (0.15 + i * 0.18) + 's'; });
    requestAnimationFrame(() => drawPic($('m-pic'), G.level, 'full'));
  }

  function onLose() {
    Music.stop();
    Sound.lose();
    const chance = !G.usedChance ? `<button class="btn heart" data-a="chance">${t('secondChance')}</button>` : '';
    modal(`<h3>💔</h3><h3 style="font-size:22px">${t('loseTitle')}</h3><p>${t('loseSub')}</p><div class="m-actions">${chance}<button class="btn primary" data-a="retry">${t('tryAgain')}</button><button class="btn" data-a="home">${t('home')}</button></div>`,
      {
        chance: () => { G.usedChance = true; closeModal(); engine.addHearts(1); updateHud(); Music.start(G.style, G.seed); Music.setProgress(1 - engine.left / engine.total); },
        retry: restart,
        home: () => { closeModal(); show('home'); },
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

  // للاختبار
  window.__siham = { engine, G, S, startLevel, startDaily, startZen };

  applyI18n(); applyTheme(); show('home');
})();
