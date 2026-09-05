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

  /** 带起始偏移 + 扫频的噪声打击（when 为相对当前时间的秒数，供音效序列调度） */
  function noiseAt(when, dur, vol, type, f0, f1) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime + (when || 0);
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.setValueAtTime(f0 || 1200, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
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
    /** Boss 预警警报：三轮递进汽笛（音高/音量/亮度逐轮升高）+ 低鼓重击，配合 2.6s 预警 */
    bossWarn() {
      if (muted) return;
      for (let i = 0; i < 3; i++) {
        const t0 = i * 0.82;
        const base = 330 + i * 75;
        // 不和谐音簇（减五度）+ 警笛式上滑，紧张感逐轮抬升
        tone(base, 0.6, 'sawtooth', 0.07 + i * 0.02, base * 1.5, t0);
        tone(base * 1.42, 0.6, 'square', 0.045 + i * 0.015, base * 2.0, t0 + 0.02);
        tone(92, 0.4, 'sine', 0.2, 36, t0);          // 低鼓重击
        if (i === 2) noiseAt(t0, 0.75, 0.16, 'highpass', 3200, 6500);  // 末轮镲噪
      }
    },
    /** Boss 登场咆哮：次低频砸地 + 不和谐管风琴音簇下滑 + 轰鸣噪声 */
    bossRoar() {
      if (muted) return;
      tone(115, 1.0, 'sine', 0.3, 32);                // 次低频砸地
      tone(158, 1.15, 'sawtooth', 0.12, 92);          // 咆哮下滑
      tone(167, 1.15, 'sawtooth', 0.09, 97, 0.03);    // 小二度音簇（不和谐）
      tone(78, 1.25, 'square', 0.07, 48, 0.06);       // 低沉管风底
      noiseAt(0, 0.9, 0.28, 'lowpass', 2600, 320);    // 轰鸣
    },
    /** Boss 阶段转换（解体/变身）：1s 电流上行 riser + 末端爆点 */
    phaseRise() {
      if (muted) return;
      tone(175, 1.0, 'sawtooth', 0.1, 940);           // 电流式上行
      tone(118, 1.0, 'square', 0.06, 630, 0.05);
      noiseAt(0, 1.0, 0.13, 'bandpass', 480, 4200);   // 噪声扫频
      tone(72, 0.55, 'sine', 0.26, 30, 1.0);          // 末端爆点
      noiseAt(1.0, 0.45, 0.22, 'lowpass', 1800, 280);
    },
    /** Boss 危险招式蓄力（掷刀/冲刺/旋风/飞刀）：两声急促尖锐警报 + 短 riser，约 0.6s */
    bossCharge() {
      if (muted) return;
      const now = performance.now();
      if (now - (SFX._lastCharge || 0) < 400) return;  // 节流：防止同帧多招式叠加
      SFX._lastCharge = now;
      tone(1319, 0.075, 'square', 0.1);               // 嘀！
      tone(1760, 0.13, 'square', 0.11, null, 0.12);   // 嘀——！
      tone(240, 0.55, 'sawtooth', 0.07, 760);         // 蓄力上行
      tone(62, 0.2, 'sine', 0.18, 34);                // 低频心跳
    },
    /** Boss 低血量狂暴（每只仅一次）：三连尖锐上行警报 + 怒吼下滑 + 轰鸣 */
    bossEnrage() {
      if (muted) return;
      tone(880, 0.12, 'square', 0.11);
      tone(1046, 0.12, 'square', 0.11, null, 0.16);
      tone(1319, 0.3, 'square', 0.12, null, 0.32);
      tone(150, 1.1, 'sawtooth', 0.14, 55);           // 怒吼下滑
      tone(75, 1.2, 'square', 0.08, 46, 0.05);        // 低沉底
      tone(1760, 0.4, 'square', 0.07, 1250, 0.95);    // 末端长啸
      noiseAt(0, 1.0, 0.2, 'lowpass', 2400, 300);
      tone(95, 0.5, 'sine', 0.24, 32, 0.05);          // 重击
    },
    /** 大王登场：3秒震撼登场 —— 万人齐吼"好！好！好！"（人声堆叠+旷野回声）+ 低沉战鼓 + 远处号角 */
    bossArmy() {
      if (muted) return;
      const c = ac(); if (!c) return;
      const now = c.currentTime;
      // 空间感：反馈延迟回声总线（模拟旷野齐声回荡）
      const echo = c.createDelay(0.6); echo.delayTime.value = 0.17;
      const fb = c.createGain(); fb.gain.value = 0.34;
      const wet = c.createGain(); wet.gain.value = 0.38;
      echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(c.destination);

      // 一声万人齐吼"好！"：多个失谐锯齿/方波"人声"经带通共鸣腔，起扬后降调
      const shout = (t, base) => {
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.06);
        g.gain.setValueAtTime(0.5, t + 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 0.7;
        g.connect(bp); bp.connect(c.destination); bp.connect(echo);
        for (let i = 0; i < 8; i++) {
          const o = c.createOscillator();
          o.type = i % 3 ? 'sawtooth' : 'square';
          const f = base * (1 + (Math.random() - 0.5) * 0.14);
          o.frequency.setValueAtTime(f * 1.14, t);
          o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.55);
          const vg = c.createGain(); vg.gain.value = (0.4 + Math.random() * 0.6) / 8;
          o.connect(vg); vg.connect(g);
          o.start(t + Math.random() * 0.04); o.stop(t + 0.7);
        }
        // 群体气声
        const n = Math.floor(c.sampleRate * 0.4);
        const buf = c.createBuffer(1, n, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const ns = c.createBufferSource(); ns.buffer = buf;
        const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1300;
        const ng = c.createGain();
        ng.gain.setValueAtTime(0.09, t);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        ns.connect(nf); nf.connect(ng); ng.connect(g);
        ns.start(t);
      };
      // 三声"好！好！好！"：每声前战鼓重击，音高逐声抬升（朝拜气势层层推进）
      for (let i = 0; i < 3; i++) {
        const dt0 = i * 1.0;
        tone(72, 0.5, 'sine', 0.32, 30, dt0);                    // 战鼓
        tone(45, 0.4, 'sine', 0.2, 24, dt0 + 0.02);
        noiseAt(dt0, 0.22, 0.13, 'lowpass', 600, 130);
        shout(now + dt0 + 0.16, 196 + i * 22);                   // G3 → A3 → B3
      }
      // 远处号角：低音铜管长鸣两遍（渐强）
      tone(87, 1.7, 'sawtooth', 0.055, 82, 0.1);
      tone(131, 1.5, 'sawtooth', 0.04, 124, 0.2);
      tone(98, 1.5, 'sawtooth', 0.06, 92, 1.55);
      tone(147, 1.3, 'sawtooth', 0.045, 139, 1.65);
      noiseAt(0, 2.8, 0.045, 'lowpass', 420, 160);               // 旷野空气底
    },
    /** 大王变身：3秒黑暗蜕变 —— 痛苦嘶吼悲号（人兽混声）+ 次声震动 + 能量爆裂 */
    bossDarkTransform() {
      if (muted) return;
      const c = ac(); if (!c) return;
      const now = c.currentTime;
      // 次声震动（身体崩坏的低频颤抖）
      const sub = c.createOscillator(); sub.type = 'sine';
      sub.frequency.setValueAtTime(36, now);
      sub.frequency.linearRampToValueAtTime(48, now + 1.5);
      sub.frequency.linearRampToValueAtTime(28, now + 2.9);
      const sg = c.createGain();
      sg.gain.setValueAtTime(0.001, now);
      sg.gain.exponentialRampToValueAtTime(0.3, now + 0.5);
      sg.gain.setValueAtTime(0.3, now + 2.1);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
      sub.connect(sg); sg.connect(c.destination);
      sub.start(now); sub.stop(now + 3.0);
      // 兽性嘶吼：锯齿 + 7.5Hz 痛苦颤音，持续下滑
      const roar = c.createOscillator(); roar.type = 'sawtooth';
      roar.frequency.setValueAtTime(215, now + 0.25);
      roar.frequency.exponentialRampToValueAtTime(150, now + 1.4);
      roar.frequency.exponentialRampToValueAtTime(66, now + 2.6);
      const lfo = c.createOscillator(); lfo.frequency.value = 7.5;
      const lg = c.createGain(); lg.gain.value = 26;
      lfo.connect(lg); lg.connect(roar.frequency);
      const rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 680;
      const rg = c.createGain();
      rg.gain.setValueAtTime(0.0001, now + 0.25);
      rg.gain.exponentialRampToValueAtTime(0.22, now + 0.5);
      rg.gain.setValueAtTime(0.22, now + 2.0);
      rg.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
      roar.connect(rf); rf.connect(rg); rg.connect(c.destination);
      roar.start(now + 0.25); roar.stop(now + 2.6);
      lfo.start(now + 0.25); lfo.stop(now + 2.6);
      // 人性悲号：三角波哭腔三段呜咽下滑
      tone(659, 0.75, 'triangle', 0.085, 415, 0.35);
      tone(523, 0.85, 'triangle', 0.075, 294, 1.2);
      tone(440, 0.6, 'triangle', 0.06, 233, 2.0);
      // 能量聚集（噪声上行扫频 + 高频电流躁动）→ 末端爆裂
      noiseAt(0.1, 1.9, 0.1, 'bandpass', 280, 3600);
      noiseAt(0.15, 2.0, 0.05, 'highpass', 3800, 8200);
      noiseAt(2.1, 0.85, 0.3, 'lowpass', 2600, 140);
      tone(50, 0.95, 'sine', 0.34, 24, 2.1);          // 爆点重击
      tone(1661, 0.55, 'sawtooth', 0.055, 5230, 2.1); // 能量尖啸迸发
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
