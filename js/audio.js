/* ============================================================
 * audio.js —— WebAudio 合成音效（无外部资源）
 * ============================================================ */
(function () {
  'use strict';

  let ctx = null;
  let muted = false;
  let lastShoot = 0;

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, when) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const n = c.sampleRate * dur;
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start();
  }

  const SFX = {
    unlock() { ac(); },
    setMuted(m) { muted = m; },
    isMuted() { return muted; },

    shoot() {
      const now = performance.now();
      if (now - lastShoot < 45) return;   // 节流
      lastShoot = now;
      tone(880 + Math.random() * 120, 0.07, 'square', 0.035, 420);
    },
    enemyShoot() { tone(300, 0.12, 'sawtooth', 0.04, 160); },
    hit() { tone(240, 0.05, 'square', 0.05, 140); },
    melee() {
      noise(0.18, 0.22, 2600);
      tone(520, 0.16, 'sawtooth', 0.09, 110);
    },
    explode(big) {
      noise(big ? 0.6 : 0.3, big ? 0.4 : 0.2, big ? 700 : 1100);
      tone(big ? 120 : 200, big ? 0.5 : 0.25, 'sawtooth', big ? 0.18 : 0.1, 40);
    },
    shock() { noise(0.35, 0.3, 400); tone(90, 0.4, 'sawtooth', 0.14, 30); },
    hurt() { tone(320, 0.25, 'sawtooth', 0.14, 90); },
    levelup() {
      tone(523, 0.1, 'square', 0.09);
      tone(659, 0.1, 'square', 0.09, null, ac ? 0.09 : 0);
      const c = ac();
      if (c) { tone(784, 0.12, 'square', 0.1, null, c.currentTime + 0.18); tone(1046, 0.22, 'square', 0.1, null, c.currentTime + 0.28); }
    },
    pick() { tone(1200 + Math.random() * 300, 0.06, 'sine', 0.05, 1800); },
    warn() {
      tone(440, 0.25, 'square', 0.12);
      const c = ac();
      if (c) tone(330, 0.35, 'square', 0.12, null, c.currentTime + 0.3);
    },
    bossDie() {
      noise(1.0, 0.5, 500);
      tone(100, 0.9, 'sawtooth', 0.2, 30);
      const c = ac();
      if (c) { tone(523, 0.15, 'square', 0.1, null, c.currentTime + 0.5); tone(784, 0.3, 'square', 0.1, null, c.currentTime + 0.65); }
    },
    dash() { tone(180, 0.4, 'sawtooth', 0.1, 600); },
    /** 闪电链跳跃：高频噼啪 */
    zap() {
      const now = performance.now();
      if (now - (SFX._lastZap || 0) < 70) return;
      SFX._lastZap = now;
      noise(0.08, 0.12, 3800);
      tone(1400 + Math.random() * 500, 0.09, 'square', 0.05, 300);
    },
    /** 获得/强化「闪电子弹」：电流升腾，高频上行琶音 + 电弧噪声 */
    chainGet() {
      tone(660, 0.09, 'square', 0.09, 1320);
      tone(990, 0.1, 'square', 0.09, 1760, 0.07);
      tone(1320, 0.14, 'sawtooth', 0.08, 2200, 0.15);
      noise(0.28, 0.1, 4200);
      tone(1760, 0.22, 'sine', 0.07, 2640, 0.22);
    },
    /** 获得/强化「防护刀刃」：金属出鞘，明亮剑刃共鸣 + 高频扫噪 */
    bladeGet() {
      noise(0.22, 0.16, 5200);
      tone(2100, 0.28, 'sawtooth', 0.07, 1050);
      tone(2800, 0.16, 'square', 0.05, 1900, 0.02);
      tone(1568, 0.3, 'triangle', 0.09, 1568, 0.1);
      tone(2093, 0.34, 'triangle', 0.07, 2093, 0.18);
    },
    /** 大招：强光波 */
    ultimate() {
      if (muted) return;
      tone(160, 0.7, 'sawtooth', 0.16, 1500);
      tone(700, 0.55, 'square', 0.1, 160);
      noise(0.7, 0.28, 3200);
      const c = ac();
      if (c) {
        tone(1046, 0.3, 'square', 0.1, null, c.currentTime + 0.22);
        tone(1568, 0.45, 'square', 0.09, null, c.currentTime + 0.38);
      }
    }
  };

  window.SFX = SFX;
})();
