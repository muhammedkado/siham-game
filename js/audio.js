/* سهام — الأصوات والموسيقى (كلها مولّدة بالكود، بدون ملفات)
 * - نغمة السهم: كل سهم يخرج يعزف نغمة أعلى من اللي قبله، على عدد أسهم المرحلة،
 *   وكل ما تقدّمت تنضاف طبقات (خامسة، أوكتاف، ثالثة، لمعة) — وآخر سهم يعزف قفلة كاملة.
 * - موسيقى خلفية: هادئة (Calm) أو حماسية (Energetic) حسب المرحلة، بنفس مقام نغمات الأسهم.
 */
(function (root) {
  'use strict';
  let ctx = null, master, sfxBus, musicBus, echoIn, noiseBuf;
  let sfxOn = true, musicOn = true;
  const PENTA = [0, 2, 4, 7, 9];
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let key = 60; // جذر المقام (MIDI) — مشترك بين الموسيقى ونغمات الأسهم

  function init() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -12; master.ratio.value = 4;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    // صدى خفيف للموسيقى
    echoIn = ctx.createDelay(1.5);
    const fb = ctx.createGain(); fb.gain.value = 0.33;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
    const wet = ctx.createGain(); wet.gain.value = 0.4;
    echoIn.connect(lp); lp.connect(fb); fb.connect(echoIn); lp.connect(wet); wet.connect(musicBus);
    // ضجيج أبيض للإيقاع
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    // تطبيق أندرويد يستدعي هذه عند الخروج من التطبيق والرجوع له
    root.__appPause = () => { if (ctx) ctx.suspend(); };
    root.__appResume = () => { if (ctx && !document.hidden) ctx.resume(); };
    return ctx;
  }
  function ac() {
    const c = init();
    if (c && c.state === 'suspended' && !document.hidden) c.resume();
    return c;
  }

  /** صوت واحد: مذبذب + غلاف صوتي (+ فلتر اختياري) */
  function voice(dest, freq, t, dur, type, vol, o) {
    o = o || {};
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack || 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    if (o.sustain) g.gain.setValueAtTime(vol, t + Math.max(a, dur - o.sustain));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; f.Q.value = o.q || 0.7;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(dest);
    if (o.echo) g.connect(echoIn);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dest, t, dur, vol, type, freq) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  /** نفخة هواء صاعدة (ضجيج بفلتر يتحرّك) */
  function whoosh(t, dur, vol) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(5000, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
  }

  // ——— مؤثرات مسجّلة (Higgsfield) ———
  const bufs = {}, loading = {};
  function sample(name, vol, rate) {
    if (!sfxOn || !ac() || !root.SFX_DATA || !root.SFX_DATA[name]) return;
    const play = b => {
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = b; src.playbackRate.value = rate || 1; g.gain.value = vol == null ? 1 : vol;
      src.connect(g); g.connect(sfxBus); src.start();
    };
    if (bufs[name]) { play(bufs[name]); return; }
    if (loading[name]) { loading[name].push(play); return; }
    loading[name] = [play];
    try {
      const bin = atob(root.SFX_DATA[name]), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      ctx.decodeAudioData(arr.buffer, b => { bufs[name] = b; (loading[name] || []).forEach(f => f(b)); delete loading[name]; }, () => { delete loading[name]; });
    } catch (e) { delete loading[name]; }
  }

  // ===================== المؤثرات =====================
  const Sound = {
    setEnabled(v) { sfxOn = v; },
    unlock() { ac(); },
    coin(rate) { sample('coin', 0.8, rate); },
    coins() { sample('coins', 1.2); },
    chest() { sample('chest', 1.3); },
    reward() { sample('unlock', 0.75); },

    /** نغمة السهم رقم index من total (تبدأ من 0) */
    pop(index, total, combo) {
      if (!sfxOn) return;
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      const N = Math.max(1, total);
      // مراحل قصيرة: سلّم خماسي؛ مراحل طويلة: سلّم كبير يغطي مدى أوسع
      const scale = N <= 16 ? PENTA : MAJOR;
      const span = Math.min(N, N <= 16 ? 16 : 25);
      const deg = N <= 1 ? 0 : Math.round(index * (span - 1) / (N - 1));
      const m = key - 12 + 12 * Math.floor(deg / scale.length) + scale[deg % scale.length];
      const f = mtof(m);
      const prog = N <= 1 ? 1 : index / (N - 1);
      const layers = Math.min(6, 1 + Math.floor(prog * 4.5) + (combo >= 3 ? 1 : 0));

      voice(sfxBus, f, t, 0.26, 'triangle', 0.22, { slideTo: f * 1.01 });   // 1) الأساس
      voice(sfxBus, f * 4, t, 0.05, 'sine', 0.04);                             // نقرة خفيفة
      if (layers >= 2) voice(sfxBus, f * 1.5, t + 0.012, 0.3, 'sine', 0.08);   // 2) خامسة
      if (layers >= 3) voice(sfxBus, f * 2, t + 0.035, 0.34, 'sine', 0.07);    // 3) أوكتاف
      if (layers >= 4) voice(sfxBus, f * 2.52, t + 0.06, 0.36, 'sine', 0.05);  // 4) ثالثة فوق الأوكتاف
      if (layers >= 5) voice(sfxBus, f * 3, t + 0.085, 0.4, 'sine', 0.035);    // 5) خامسة عالية
      if (layers >= 6) voice(sfxBus, f * 4, t + 0.11, 0.45, 'sine', 0.03);     // 6) لمعة
      if (index === N - 1) {
        // قفلة: كورد كامل متصاعد
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
          voice(sfxBus, mtof(key + s), t + 0.12 + i * 0.05, 0.6, 'triangle', 0.08));
      }
    },
    bump() {
      if (!sfxOn) return;
      const c = ac(); if (!c) return; const t = c.currentTime;
      voice(sfxBus, 150, t, 0.22, 'triangle', 0.3, { slideTo: 70 });
      voice(sfxBus, 90, t + 0.02, 0.18, 'sine', 0.25, { slideTo: 50 });
      noise(sfxBus, t, 0.08, 0.12, 'lowpass', 800);
    },
    click() { if (sfxOn && ac()) voice(sfxBus, 900, ctx.currentTime, 0.04, 'sine', 0.06); },
    hint() {
      if (!sfxOn || !ac()) return; const t = ctx.currentTime;
      voice(sfxBus, mtof(key + 19), t, 0.2, 'sine', 0.1);
      voice(sfxBus, mtof(key + 24), t + 0.09, 0.25, 'sine', 0.09);
    },
    lens(ok) {
      if (!sfxOn || !ac()) return; const t = ctx.currentTime;
      if (ok) voice(sfxBus, 700, t, 0.15, 'sine', 0.12, { slideTo: 1050 });
      else voice(sfxBus, 300, t, 0.2, 'sine', 0.12, { slideTo: 200 });
    },
    win() {
      if (!sfxOn || !ac()) return; const t = ctx.currentTime + 0.1;
      [0, 4, 7, 12, 16].forEach((s, i) => voice(sfxBus, mtof(key + s), t + i * 0.09, 0.45, 'triangle', 0.14));
      [0, 7, 12, 16].forEach(s => voice(sfxBus, mtof(key + s), t + 0.5, 1.2, 'sine', 0.05, { attack: 0.05 }));
    },
    /** نغمة السلسلة: أربيجيو صاعد يطول ويعلو مع كل مستوى + لمعات + كورد ختامي */
    combo(tier) {
      if (!sfxOn || !ac()) return;
      const t = ctx.currentTime + 0.08;
      const steps = [0, 4, 7, 12, 16, 19, 24, 28, 31];
      const n = Math.min(steps.length, 4 + tier);
      const base = key + (tier >= 3 ? 12 : 0);
      const gap = Math.max(0.04, 0.062 - tier * 0.004);
      for (let i = 0; i < n; i++) {
        const f = mtof(base + steps[i]);
        voice(sfxBus, f, t + i * gap, 0.32, 'triangle', 0.07);
        voice(sfxBus, f * 2, t + i * gap + 0.01, 0.22, 'sine', 0.025);
      }
      const end = t + n * gap;
      // كورد ختامي ناعم
      [0, 7, 12, 16].forEach((s, i) => voice(sfxBus, mtof(base + 12 + s), end + i * 0.012, 0.9, 'sine', 0.04, { attack: 0.015 }));
      // لمعات عشوائية من السلّم الخماسي
      for (let i = 0; i < 3 + tier; i++) {
        const m = base + 24 + PENTA[(Math.random() * 5) | 0] + 12 * ((Math.random() * 2) | 0);
        voice(sfxBus, mtof(m), end + 0.05 + i * 0.045 + Math.random() * 0.02, 0.18, 'sine', 0.022);
      }
      if (tier >= 2) whoosh(t - 0.04, 0.45 + tier * 0.04, 0.05 + tier * 0.01);
    },
    /** قلب هدية */
    heart() {
      if (!sfxOn || !ac()) return; const t = ctx.currentTime + 0.05;
      [12, 16, 19, 24].forEach((s, i) => voice(sfxBus, mtof(key + s), t + i * 0.07, 0.4, 'sine', 0.09));
      voice(sfxBus, mtof(key + 36), t + 0.3, 0.6, 'sine', 0.03, { attack: 0.02 });
    },
    /** تنبيه لطيف عند الخمول */
    nudge() {
      if (!sfxOn || !ac()) return; const t = ctx.currentTime;
      voice(sfxBus, mtof(key + 19), t, 0.18, 'sine', 0.05);
      voice(sfxBus, mtof(key + 24), t + 0.12, 0.28, 'sine', 0.05);
    },
    /** محطة (نصف اللوحة / آخر سهم) */
    milestone() {
      if (!sfxOn || !ac()) return; const t = ctx.currentTime + 0.12;
      [7, 12, 16].forEach((s, i) => {
        const f = mtof(key + 12 + s);
        voice(sfxBus, f, t + i * 0.08, 0.5, 'sine', 0.06);
        voice(sfxBus, f * 3, t + i * 0.08, 0.2, 'sine', 0.012);
      });
    },
    lose() {
      if (!sfxOn || !ac()) return; const t = ctx.currentTime;
      [7, 4, 0].forEach((s, i) => voice(sfxBus, mtof(key + s - 12), t + i * 0.14, 0.32, 'sine', 0.12));
    },
  };

  // ===================== الموسيقى =====================
  const CALM_PROG = [0, 5, 3, 4];      // I – vi – IV – V
  const HYPE_PROG = [5, 3, 0, 4];      // vi – IV – I – V
  const noteOf = (deg, oct) => key + 12 * (oct + Math.floor(deg / 7)) + MAJOR[((deg % 7) + 7) % 7];

  const Music = {
    style: null, timer: 0, step: 0, next: 0, bpm: 80, R: Math.random, progress: 0, pending: null,

    setEnabled(v) {
      musicOn = v;
      if (!v) this.stop();
      else if (this.pending) this.start(this.pending[0], this.pending[1]);
    },
    /** style: 'calm' | 'hype' */
    start(style, seed) {
      this.pending = [style, seed];
      this._halt();
      if (!musicOn) return;
      const c = ac(); if (!c) return;
      this.R = root.Gen ? root.Gen.rng(seed >>> 0) : Math.random;
      key = 55 + Math.floor(this.R() * 9); // من G3 إلى D#4
      this.style = style;
      this.bpm = style === 'calm' ? 66 + Math.floor(this.R() * 12) : 116 + Math.floor(this.R() * 14);
      this.prog = style === 'calm' ? CALM_PROG : HYPE_PROG;
      this.step = 0; this.progress = 0;
      this.next = c.currentTime + 0.15;
      const g = musicBus.gain;
      g.cancelScheduledValues(c.currentTime);
      g.setValueAtTime(Math.max(0.0001, g.value), c.currentTime);
      g.linearRampToValueAtTime(style === 'calm' ? 0.55 : 0.45, c.currentTime + 1.5);
      this.timer = setInterval(() => this._tick(), 30);
    },
    stop() {
      this.pending = null;
      this._halt();
    },
    _halt() {
      clearInterval(this.timer); this.timer = 0; this.style = null;
      if (ctx && musicBus) {
        const g = musicBus.gain, t = ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.5);
      }
    },
    /** تقدّم المرحلة 0..1 — الموسيقى تصير أغنى كل ما تقدمت */
    setProgress(p) { this.progress = p; },

    _tick() {
      if (!ctx || !this.style) return;
      if (ctx.state !== 'running') { this.next = ctx.currentTime + 0.1; return; }
      const sixteenth = 60 / this.bpm / 4;
      while (this.next < ctx.currentTime + 0.18) {
        this._play(this.step, this.next, sixteenth);
        this.next += sixteenth;
        this.step++;
      }
    },
    _play(step, t, six) {
      const s = step % 16, bar = Math.floor(step / 16);
      const ch = this.prog[bar % 4];
      const triad = [ch, ch + 2, ch + 4];
      const R = this.R, p = this.progress, M = musicBus;
      if (this.style === 'calm') {
        if (s === 0) {
          triad.forEach((d, i) => voice(M, mtof(noteOf(d, 0)), t, six * 16 * 1.05, 'triangle', 0.035, { attack: 0.9, sustain: 0.6, filter: 1100, detune: (i - 1) * 4 }));
          voice(M, mtof(noteOf(ch, -2)), t, six * 10, 'sine', 0.11, { attack: 0.05 });
        }
        if (s === 8) voice(M, mtof(noteOf(ch + 4, -2)), t, six * 7, 'sine', 0.08, { attack: 0.05 });
        // لحن متناثر — يزيد كثافةً مع التقدّم
        if (s % 2 === 0 && R() < 0.22 + p * 0.3) {
          const d = triad[Math.floor(R() * 3)] + (R() < 0.3 ? 7 : 0);
          voice(M, mtof(noteOf(d, 1)), t, 0.9, 'triangle', 0.045, { echo: true, filter: 2600 });
        }
        // أجراس خفيفة في النصف الثاني من المرحلة
        if (p > 0.5 && s === 12 && R() < 0.6) voice(M, mtof(noteOf(triad[2], 2)), t, 1.4, 'sine', 0.02, { echo: true });
      } else {
        // طبل
        if (s % 4 === 0) { voice(M, 140, t, 0.28, 'sine', 0.42, { slideTo: 42 }); }
        if (s === 4 || s === 12) noise(M, t, 0.14, 0.16, 'bandpass', 1600);
        if (s % 2 === 1) noise(M, t, 0.035, 0.05, 'highpass', 7500);
        if (p > 0.35 && s % 4 === 2) noise(M, t, 0.09, 0.05, 'highpass', 6000);
        // باص
        if (s % 2 === 0) {
          const d = s === 14 ? ch + 4 : ch;
          voice(M, mtof(noteOf(d, -2)), t, six * 1.7, 'sawtooth', 0.1, { filter: 520, q: 4 });
        }
        // أربيجيو — يكثف مع التقدّم
        if (R() < 0.45 + p * 0.45) {
          const d = triad[s % 3] + (s >= 8 ? 7 : 0);
          voice(M, mtof(noteOf(d, 1)), t, six * 1.6, 'square', 0.022, { filter: 2400, echo: true });
        }
        if (s === 0) triad.forEach(d => voice(M, mtof(noteOf(d, 0)), t, six * 16, 'triangle', 0.018, { attack: 0.3, sustain: 0.3, filter: 1500 }));
        // لحن علوي بالنصف الثاني
        if (p > 0.6 && (s === 0 || s === 6 || s === 10) && R() < 0.7) {
          voice(M, mtof(noteOf(triad[Math.floor(R() * 3)], 2)), t, six * 3, 'triangle', 0.035, { echo: true });
        }
      }
    },
  };

  root.Sound = Sound;
  root.Music = Music;
})(window);
