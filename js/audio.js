/* سهام — أصوات مولّدة (بدون ملفات) */
(function (root) {
  'use strict';
  let ctx = null;
  let enabled = true;
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // سلم خماسي

  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  const Sound = {
    setEnabled(v) { enabled = v; },
    unlock() { if (enabled) ac(); },
    pop(combo) {
      if (!enabled) return;
      const step = SCALE[Math.min(SCALE.length - 1, combo || 0)];
      const f = 440 * Math.pow(2, step / 12);
      tone(f, 0.16, 'sine', 0.18, f * 1.5);
      tone(f * 2, 0.08, 'triangle', 0.05);
    },
    bump() {
      if (!enabled) return;
      tone(150, 0.22, 'triangle', 0.3, 70);
      tone(90, 0.18, 'sine', 0.25, 50, 0.02);
    },
    click() { if (enabled) tone(900, 0.04, 'sine', 0.06); },
    hint() { if (enabled) { tone(660, 0.18, 'sine', 0.12); tone(990, 0.22, 'sine', 0.1, null, 0.09); } },
    lens(ok) { if (enabled) ok ? tone(700, 0.15, 'sine', 0.12, 1050) : tone(300, 0.2, 'sine', 0.12, 200); },
    win() {
      if (!enabled) return;
      [0, 4, 7, 12, 16].forEach((s, i) => tone(523.25 * Math.pow(2, s / 12), 0.35, 'triangle', 0.14, null, i * 0.09));
    },
    lose() { if (enabled) [7, 4, 0].forEach((s, i) => tone(330 * Math.pow(2, s / 12), 0.3, 'sine', 0.12, null, i * 0.14)); },
  };
  root.Sound = Sound;
})(window);
