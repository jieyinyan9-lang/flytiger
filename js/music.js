/* ============================================================
 * music.js —— 程序化芯片背景音乐引擎（Web Audio 合成，无外部资源）
 * 6 首曲目按场景自动切换，交叉淡入淡出：
 *   casual   日常休闲（菜单 / 局内打小怪）
 *   tide     慷慨激昂（怪物潮轮次打小怪）
 *   boss     快节奏战斗（通用 Boss 战）
 *   pheasant 鸡叫融合电音（巨型野鸡王）
 *   eagle    广州鼓点 + 鹰叫（咬剑鹰）
 *   hero     军乐 + 电磁声（祖国人）
 * ============================================================ */
(function () {
  'use strict';

  let ctx = null, bus = null, master = null, timer = null, noiseBuf = null;
  let current = null;
  let runners = [];          // 并存调度的播放实例（新曲淡入期间旧曲继续演奏）
  let muted = false;

  const FADE_IN = 1.7;       // 新曲淡入时长（秒）
  const FADE_OUT = 1.6;      // 旧曲淡出时长（秒）
  const BAR_WAIT_CAP = 1.4;  // 入场对齐小节边界的最长等待，超过则退到下一拍

  /* ---------------- 音频上下文 / 总线 ---------------- */
  function ac() {
    if (ctx) {
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      return ctx;
    }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { ctx = null; return null; }
    master = ctx.createGain();
    master.gain.value = muted ? 0.0001 : 0.85;
    master.connect(ctx.destination);
    bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(master);
    if (!timer) timer = setInterval(tick, 40);
    return ctx;
  }

  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /** MIDI 音符号 → 频率（60 = C4） */
  function mf(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* ---------------- 基础乐器 ---------------- */
  /** 普通音符：type 支持 square/triangle/sawtooth/sine/brass（铜管=双锯齿叠奏） */
  function tone(type, f, t, dur, vol, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    let o2 = null, g2 = null;
    if (type === 'brass') {
      o.type = 'sawtooth'; o.detune.value = -8;
      o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 8;
      g2 = ctx.createGain(); g2.gain.value = 0.55;
      o2.connect(g2); g2.connect(g);
    } else {
      o.type = type;
    }
    o.frequency.setValueAtTime(Math.max(30, f), t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
    g.gain.setValueAtTime(Math.max(0.0002, vol), t + Math.max(0.02, dur * 0.55));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    if (o2) { o2.frequency.setValueAtTime(Math.max(30, f), t); o2.start(t); o2.stop(t + dur + 0.05); }
  }

  /** 噪声打击：t 起点，dur 时长，type 滤波类型，f0→f1 扫频 */
  function noiseHit(t, dur, vol, type, f0, f1, dest) {
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t); src.stop(t + dur + 0.02);
  }

  /** 底鼓：150→45Hz 正弦下坠 */
  function kick(t, v, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
    g.gain.setValueAtTime(0.5 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.2);
  }

  /** 太鼓 / 战鼓：低沉长鸣 + 鼓皮噪声 click；small=高音小鼓 */
  function taiko(t, v, small, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(small ? 180 : 130, t);
    o.frequency.exponentialRampToValueAtTime(small ? 80 : 55, t + 0.16);
    g.gain.setValueAtTime(0.55 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (small ? 0.18 : 0.28));
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.32);
    noiseHit(t, 0.05, 0.16 * v, 'highpass', 3000, 3000, dest);
  }

  /** 军鼓 / 边击：噪声 + 短低音；ghost=弱音滚奏 */
  function snare(t, v, ghost, dest) {
    noiseHit(t, 0.13, (ghost ? 0.1 : 0.28) * v, 'bandpass', 1800, 1200, dest);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    g.gain.setValueAtTime((ghost ? 0.09 : 0.2) * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.12);
  }

  /** 踩镲：open=开镲长音 */
  function hat(t, v, open, dest) {
    noiseHit(t, open ? 0.12 : 0.035, (open ? 0.15 : 0.09) * v, 'highpass', 7500, 7500, dest);
  }

  /** 锣：低通噪声长扫 + 低频共鸣 */
  function gong(t, v, dest) {
    noiseHit(t, 0.9, 0.2 * v, 'lowpass', 1400, 300, dest);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    g.gain.setValueAtTime(0.28 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 1.05);
  }

  /* ---------------- 特殊音效（合成"真实"声音元素） ---------------- */
  /** 母鸡咯咯叫：两下鼻音方波下坠 */
  function cluck(t, dest) {
    [0, 0.13].forEach((off, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'square';
      o.frequency.setValueAtTime(i ? 900 : 750, t + off);
      o.frequency.exponentialRampToValueAtTime(i ? 420 : 380, t + off + 0.07);
      f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.exponentialRampToValueAtTime(0.15, t + off + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.09);
      o.connect(f); f.connect(g); g.connect(dest);
      o.start(t + off); o.stop(t + off + 0.12);
    });
  }

  /** 公鸡打鸣：cock-a-doodle-doo 三段上行 + 长音抖音 + 滑稽下滑 */
  function crow(t, dest) {
    const segs = [[620, 0.0, 0.12], [780, 0.12, 0.12], [1000, 0.24, 0.14], [1300, 0.38, 0.34]];
    segs.forEach(([f, t0, dur]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(f, t + t0);
      if (t0 >= 0.38) {
        o.frequency.linearRampToValueAtTime(f * 1.06, t + t0 + 0.12);
        o.frequency.linearRampToValueAtTime(f, t + t0 + 0.24);
        o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.82);
      }
      g.gain.setValueAtTime(0.0001, t + t0);
      g.gain.exponentialRampToValueAtTime(0.12, t + t0 + 0.02);
      g.gain.setValueAtTime(0.12, t + t0 + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + t0 + dur + 0.04);
      o.connect(g); g.connect(dest);
      o.start(t + t0); o.stop(t + t0 + dur + 0.12);
    });
    noiseHit(t + 0.38, 0.3, 0.045, 'highpass', 5000, 5000, dest);
  }

  /** 故障电子音：方波急坠 + 噪声下扫 */
  function glitch(t, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1800, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.07);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.1);
    noiseHit(t, 0.08, 0.09, 'bandpass', 6000, 900, dest);
  }

  /** 雄鹰长鸣：锯齿+五度方波，1500→2700→1150Hz 呼啸 */
  function eagleCry(t, dest) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o2.type = 'square';
    o2.detune.value = 700;   // 上方纯五度泛音
    [o, o2].forEach(oo => {
      oo.frequency.setValueAtTime(1500, t);
      oo.frequency.exponentialRampToValueAtTime(2700, t + 0.18);
      oo.frequency.linearRampToValueAtTime(2500, t + 0.34);
      oo.frequency.exponentialRampToValueAtTime(1150, t + 0.6);
    });
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.05);
    g.gain.setValueAtTime(0.09, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    o.connect(g); o2.connect(g); g.connect(dest);
    o.start(t); o2.start(t);
    o.stop(t + 0.66); o2.stop(t + 0.66);
    noiseHit(t, 0.5, 0.035, 'highpass', 4000, 6000, dest);
  }

  /** 电磁充能 → 能量爆发：锯齿上行 + 颤音 + 噪声扫频 + 峰值电击 */
  function emCharge(t, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(1300, t + 0.8);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 18; lg.gain.value = 40;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.15);
    g.gain.setValueAtTime(0.06, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.95);
    lfo.start(t); lfo.stop(t + 0.95);
    noiseHit(t, 0.8, 0.05, 'bandpass', 500, 5200, dest);
    // 爆发电击
    const z = ctx.createOscillator(), zg = ctx.createGain();
    z.type = 'square';
    z.frequency.setValueAtTime(2100, t + 0.82);
    z.frequency.exponentialRampToValueAtTime(900, t + 1.0);
    zg.gain.setValueAtTime(0.11, t + 0.82);
    zg.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
    z.connect(zg); zg.connect(dest);
    z.start(t + 0.82); z.stop(t + 1.1);
    noiseHit(t + 0.82, 0.25, 0.14, 'highpass', 3000, 800, dest);
  }

  /** 电磁脉冲：高频正弦 ping */
  function emPing(t, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 1568;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.2);
  }

  /* ---------------- 曲目数据（4 小节循环，每小节 16 个 16 分音符步） ---------------- */
  const R = (arr) => arr;   // 可读性别名

  const TRACKS = {
    /* 1. 日常休闲：C 大调温暖慢板，柔和方波旋律 + 三角钢琴琶音 + 轻柔打击 */
    casual: {
      bpm: 88,
      lead: {
        wave: 'square', vol: 0.1,
        bars: [
          R([64, 0, 0, 0, 67, 0, 0, 69, 67, 0, 64, 0, 62, 0, 0, 0]),
          R([64, 0, 0, 0, 69, 0, 0, 0, 72, 0, 0, 71, 69, 0, 0, 0]),
          R([67, 0, 69, 0, 72, 0, 0, 74, 72, 0, 69, 0, 67, 0, 0, 0]),
          R([65, 0, 67, 0, 69, 0, 0, 67, 64, 0, 0, 0, 60, 0, 0, 0])
        ]
      },
      bass: {
        wave: 'triangle', vol: 0.16,
        bars: [
          R([36, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0]),
          R([33, 0, 0, 0, 0, 0, 0, 0, 40, 0, 0, 0, 0, 0, 0, 0]),
          R([41, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0]),
          R([43, 0, 0, 0, 0, 0, 0, 0, 50, 0, 0, 0, 0, 0, 0, 0])
        ]
      },
      arp: {
        vol: 0.05,
        bars: [
          R([60, 0, 64, 0, 67, 0, 72, 0, 67, 0, 64, 0, 60, 0, 64, 0]),
          R([57, 0, 60, 0, 64, 0, 69, 0, 64, 0, 60, 0, 57, 0, 64, 0]),
          R([53, 0, 57, 0, 60, 0, 65, 0, 60, 0, 57, 0, 53, 0, 57, 0]),
          R([55, 0, 59, 0, 62, 0, 67, 0, 62, 0, 59, 0, 55, 0, 62, 0])
        ]
      },
      drum: {
        vol: 0.85,
        bars: [
          R(['K', '.', '.', '.', '.', '.', 'h', '.', '.', '.', 'S', '.', 'h', '.', '.', 'h']),
          R(['K', '.', '.', '.', '.', '.', 'h', '.', '.', '.', '.', '.', 'h', '.', '.', 'h']),
          R(['K', '.', '.', '.', '.', '.', 'h', '.', 'S', '.', '.', '.', 'h', '.', '.', 'h']),
          R(['K', '.', '.', '.', '.', 'h', '.', '.', '.', '.', 'S', '.', '.', 'h', '.', 'h'])
        ]
      }
    },

    /* 2. 怪物潮：D 大调英雄主题，前两小节铺垫、后两小节爆发（节奏缓急对比） */
    tide: {
      bpm: 132,
      lead: {
        wave: 'square', vol: 0.1, vel: [0.7, 0.85, 1.3, 1.35],
        bars: [
          R([62, 0, 0, 0, 66, 0, 0, 0, 69, 0, 0, 0, 66, 0, 0, 0]),
          R([69, 0, 0, 71, 74, 0, 0, 0, 73, 0, 71, 0, 69, 0, 0, 0]),
          R([74, 0, 74, 0, 78, 0, 76, 0, 74, 0, 73, 0, 71, 0, 74, 0]),
          R([81, 0, 78, 0, 76, 0, 74, 0, 73, 0, 71, 0, 69, 0, 0, 73])
        ]
      },
      bass: {
        wave: 'triangle', vol: 0.17,
        bars: [
          R([38, 0, 0, 0, 0, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 0]),
          R([35, 0, 0, 0, 0, 0, 0, 0, 42, 0, 0, 0, 0, 0, 0, 0]),
          R([38, 0, 38, 0, 38, 0, 50, 0, 38, 0, 38, 0, 38, 0, 50, 0]),
          R([33, 0, 33, 0, 33, 0, 45, 0, 33, 0, 33, 0, 40, 0, 45, 0])
        ]
      },
      drum: {
        vol: 0.95,
        bars: [
          R(['K', '.', '.', '.', '.', '.', '.', '.', 'h', '.', '.', '.', '.', '.', 'h', '.']),
          R(['K', '.', '.', '.', '.', '.', 'h', '.', 'h', '.', '.', '.', 'S', '.', 'h', '.']),
          R(['K', '.', 'h', '.', 'S', '.', 'h', '.', 'K', '.', 'h', '.', 'S', '.', 'h', '.']),
          R(['K', '.', 'h', '.', 'S', '.', 'h', '.', 'K', '.', 'h', '.', 'S', 'r', 'r', 'r'])
        ]
      }
    },

    /* 3. 通用 Boss 战：A 小调高速 16 分琶音 + 推进低音 + 密集鼓点，紧张刺激 */
    boss: {
      bpm: 150,
      lead: {
        wave: 'square', vol: 0.08,
        bars: [
          R([69, 72, 76, 81, 76, 72, 69, 72, 69, 72, 76, 81, 84, 81, 76, 72]),
          R([65, 69, 72, 77, 72, 69, 65, 69, 72, 77, 84, 77, 72, 69, 65, 69]),
          R([62, 65, 69, 74, 69, 65, 62, 65, 62, 65, 69, 74, 77, 74, 69, 65]),
          R([64, 68, 71, 76, 71, 68, 64, 68, 69, 72, 76, 81, 76, 72, 69, 72])
        ]
      },
      bass: {
        wave: 'triangle', vol: 0.19,
        bars: [
          R([33, 33, 45, 33, 33, 33, 45, 33, 33, 33, 45, 33, 36, 36, 40, 36]),
          R([29, 29, 41, 29, 29, 29, 41, 29, 29, 29, 41, 29, 33, 33, 36, 33]),
          R([26, 26, 38, 26, 26, 26, 38, 26, 26, 26, 38, 26, 31, 31, 34, 31]),
          R([28, 28, 40, 28, 28, 28, 40, 28, 28, 28, 40, 28, 33, 33, 40, 40])
        ]
      },
      drum: {
        vol: 1.0,
        bars: [
          R(['K', 'h', 'h', 'h', 'S', 'h', 'h', 'K', 'K', 'h', 'h', 'h', 'S', 'h', 'h', 'h']),
          R(['K', 'h', 'h', 'h', 'S', 'h', 'h', 'K', 'K', 'h', 'h', 'h', 'S', 'h', 'h', 'h']),
          R(['K', 'h', 'h', 'h', 'S', 'h', 'h', 'K', 'K', 'h', 'h', 'h', 'S', 'h', 'h', 'h']),
          R(['K', 'h', 'h', 'h', 'S', 'h', 'h', 'K', 'K', 'h', 'h', 'h', 'S', 'h', 'K', 'h'])
        ]
      }
    },

    /* 4. 野鸡王：高速电音，锯齿贝斯 16 分跳动 + 四踩底鼓，鸡叫/打鸣/故障电音贯穿 */
    pheasant: {
      bpm: 164,
      lead: {
        wave: 'square', vol: 0.09,
        bars: [
          R([69, 0, 72, 76, 0, 79, 76, 0, 72, 0, 69, 0, 72, 76, 79, 81]),
          R([81, 0, 0, 79, 76, 0, 79, 0, 81, 0, 84, 0, 81, 79, 76, 0]),
          R([69, 72, 69, 76, 0, 0, 79, 76, 72, 76, 79, 81, 0, 84, 81, 0]),
          R([76, 79, 81, 84, 81, 79, 76, 0, 74, 72, 74, 76, 79, 81, 84, 88])
        ]
      },
      bass: {
        wave: 'sawtooth', vol: 0.11,
        bars: [
          R([33, 45, 33, 45, 33, 45, 33, 45, 33, 45, 33, 45, 36, 48, 36, 48]),
          R([33, 45, 33, 45, 31, 43, 31, 43, 31, 43, 31, 43, 29, 41, 29, 41]),
          R([29, 41, 29, 41, 31, 43, 31, 43, 33, 45, 33, 45, 33, 45, 33, 45]),
          R([36, 48, 36, 48, 38, 50, 38, 50, 33, 45, 33, 45, 33, 45, 33, 45])
        ]
      },
      drum: {
        vol: 1.0,
        bars: [
          R(['K', 'h', 'h', 'h', 'K', 'h', 'h', 'h', 'K', 'h', 'h', 'h', 'K', 'h', 'S', 'h']),
          R(['K', 'h', 'h', 'h', 'K', 'h', 'h', 'h', 'K', 'h', 'h', 'h', 'K', 'h', 'S', 'h']),
          R(['K', 'h', 'h', 'h', 'K', 'h', 'h', 'h', 'K', 'h', 'h', 'h', 'K', 'h', 'h', 'S']),
          R(['K', 'h', 'h', 'h', 'K', 'h', 'S', 'h', 'K', 'h', 'h', 'h', 'K', 'h', 'S', 'h'])
        ]
      },
      /** 鸡叫节奏元素：每小节 1 次故障电音；偶数小节咯咯叫；循环开头公鸡打鸣 */
      onBar(bar, t, spb, dest) {
        glitch(t + spb * 7, dest);
        if (bar === 0) crow(t + spb * 2, dest);
        if (bar % 2 === 0) cluck(t + spb * 11, dest);
      }
    },

    /* 5. 咬剑鹰：E 宫五声音阶东方旋律 + 密集广州战鼓（太鼓/锣）+ 雄鹰长鸣 */
    eagle: {
      bpm: 140,
      lead: {
        wave: 'square', vol: 0.1,
        bars: [
          R([64, 0, 0, 67, 69, 0, 0, 0, 71, 0, 0, 74, 71, 0, 69, 0]),
          R([69, 0, 0, 0, 71, 0, 74, 0, 76, 0, 0, 74, 71, 0, 0, 0]),
          R([67, 0, 0, 69, 71, 0, 0, 0, 74, 0, 0, 71, 69, 0, 67, 0]),
          R([64, 0, 67, 0, 69, 0, 71, 0, 74, 0, 76, 0, 74, 0, 0, 0])
        ]
      },
      bass: {
        wave: 'triangle', vol: 0.17,
        bars: [
          R([28, 0, 0, 0, 0, 0, 0, 0, 35, 0, 0, 0, 0, 0, 0, 0]),
          R([33, 0, 0, 0, 0, 0, 0, 0, 40, 0, 0, 0, 0, 0, 0, 0]),
          R([31, 0, 0, 0, 0, 0, 0, 0, 38, 0, 0, 0, 0, 0, 0, 0]),
          R([28, 0, 0, 0, 0, 0, 0, 0, 35, 0, 0, 0, 0, 0, 0, 0])
        ]
      },
      drum: {
        vol: 1.0,
        bars: [
          R(['g', 'T', '.', 't', 'T', '.', 't', '.', 'T', 't', '.', 'T', '.', 't', 'T', '.']),
          R(['T', '.', 't', 'T', '.', 'T', 't', '.', 'T', 't', 'T', '.', 't', 'T', '.', 't']),
          R(['T', 't', '.', 'T', '.', 't', 'T', '.', 'T', '.', 'T', 't', '.', 'T', 't', 'T']),
          R(['T', '.', 't', 'T', '.', 'T', 't', '.', 'T', 't', 'T', 't', 'T', 't', 'T', 't'])
        ]
      },
      /** 鹰啸：循环开头锣后一声长鸣，第 3 小节再鸣一声 */
      onBar(bar, t, spb, dest) {
        if (bar === 0) eagleCry(t + spb * 6, dest);
        if (bar === 2) eagleCry(t + spb * 10, dest);
      }
    },

    /* 6. 祖国人：进行曲节拍 + 明亮铜管号角 + 电磁充能/脉冲，英雄登场气质 */
    hero: {
      bpm: 120,
      lead: {
        wave: 'brass', vol: 0.085,
        bars: [
          R([62, 0, 0, 0, 62, 0, 0, 0, 69, 0, 0, 0, 66, 0, 0, 0]),
          R([74, 0, 0, 0, 73, 0, 0, 0, 71, 0, 0, 74, 73, 0, 0, 0]),
          R([74, 0, 0, 0, 78, 0, 0, 0, 76, 0, 0, 0, 81, 0, 0, 0]),
          R([86, 0, 0, 0, 81, 0, 0, 0, 78, 0, 76, 0, 74, 0, 0, 0])
        ]
      },
      bass: {
        wave: 'triangle', vol: 0.18,
        bars: [
          R([38, 0, 0, 0, 45, 0, 0, 0, 38, 0, 0, 0, 45, 0, 0, 0]),
          R([33, 0, 0, 0, 40, 0, 0, 0, 33, 0, 0, 0, 40, 0, 0, 0]),
          R([31, 0, 0, 0, 38, 0, 0, 0, 31, 0, 0, 0, 50, 0, 0, 0]),
          R([38, 0, 0, 0, 45, 0, 0, 0, 33, 0, 0, 0, 38, 0, 0, 0])
        ]
      },
      drum: {
        vol: 1.0,
        bars: [
          R(['K', '.', '.', '.', 'S', '.', '.', '.', 'K', '.', '.', '.', 'S', '.', '.', '.']),
          R(['K', '.', 'h', '.', 'S', '.', 'h', '.', 'K', '.', 'h', '.', 'S', '.', 'h', '.']),
          R(['K', '.', 'h', '.', 'S', '.', 'h', 'K', 'K', '.', 'h', '.', 'S', '.', 'h', '.']),
          R(['K', '.', 'h', '.', 'S', '.', 'h', '.', 'K', '.', 'h', 'r', 'r', 'r', 'r', 'r'])
        ]
      },
      /** 电磁声：每小节两记脉冲 ping；第 4 小节末尾充能，在循环强拍爆发 */
      onBar(bar, t, spb, dest) {
        emPing(t + spb * 4, dest);
        emPing(t + spb * 12, dest);
        if (bar === 3) emCharge(t + spb * 12, dest);
      }
    }
  };

  /* ---------------- 调度器（前瞻 lookahead，多实例交叉调度） ---------------- */
  function drumHit(c, t, v, dest) {
    switch (c) {
      case 'K': kick(t, v, dest); break;
      case 'T': taiko(t, v, false, dest); break;
      case 't': taiko(t, v * 0.7, true, dest); break;
      case 'S': snare(t, v, false, dest); break;
      case 'r': snare(t, v, true, dest); break;
      case 'h': hat(t, v, false, dest); break;
      case 'H': hat(t, v, true, dest); break;
      case 'g': gong(t, v, dest); break;
    }
  }

  function scheduleStep(r, t) {
    const d = r.def, spb = 60 / d.bpm / 4;
    const bar = r.bar, step = r.step;

    if (d.lead) {
      const n = d.lead.bars[bar][step];
      if (n) {
        const vel = d.lead.vel ? d.lead.vel[bar] : 1;
        tone(d.lead.wave, mf(n), t, spb * 1.7, d.lead.vol * vel, r.gain);
      }
    }
    if (d.bass) {
      const n = d.bass.bars[bar][step];
      if (n) tone(d.bass.wave, mf(n), t, spb * 1.3, d.bass.vol, r.gain);
    }
    if (d.arp) {
      const n = d.arp.bars[bar][step];
      if (n) tone('triangle', mf(n), t, spb * 0.8, d.arp.vol, r.gain);
    }
    if (d.drum) {
      const c = d.drum.bars[bar][step];
      if (c && c !== '.') drumHit(c, t, d.drum.vol, r.gain);
    }
    if (step === 0 && d.onBar) d.onBar(bar, t, spb, r.gain);

    r.step++;
    if (r.step >= 16) { r.step = 0; r.bar = (r.bar + 1) % d.lead.bars.length; }
    r.nextT += spb;
  }

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    for (const r of runners) {
      if (r.dead) continue;
      // 标签页挂起恢复后防止补播堆积：落后超过 0.1s 直接对齐当前时间
      if (r.nextT < ctx.currentTime - 0.1) r.nextT = ctx.currentTime + 0.02;
      let guard = 0;
      while (r.nextT < ctx.currentTime + 0.18 && guard++ < 64) {
        if (r.nextT >= r.stopAt) break;    // 淡出后段不再排新音，余音自然衰减
        scheduleStep(r, r.nextT);
      }
      // 淡出结束：断开节点并标记回收
      if (!r.dead && ctx.currentTime > r.cleanupAt) {
        r.dead = true;
        try { r.gain.disconnect(); } catch (e) {}
        try { r.filter.disconnect(); } catch (e) {}
      }
    }
    if (runners.some(r => r.dead)) runners = runners.filter(r => !r.dead);
  }

  /** 旧曲下一个可切入的音乐边界：优先小节开头（乐句完整交接），等待过久则退到下一拍 */
  function entryBoundary(old, nowC) {
    const spb = 60 / old.def.bpm / 4;
    const stepsToBar = old.step === 0 ? 0 : 16 - old.step;
    const barT = old.nextT + stepsToBar * spb;
    if (barT - nowC <= BAR_WAIT_CAP) return barT;
    const stepsToBeat = (4 - (old.step % 4)) % 4;
    return old.nextT + stepsToBeat * spb;
  }

  /* ---------------- 对外接口 ---------------- */
  window.Music = {
    /** 用户手势内调用：创建/恢复音频上下文 */
    unlock() { ac(); },

    /**
     * 按场景切歌（同名不重复）：
     * 新曲在旧曲的小节/节拍边界上进入，1.7s 低通滤波扫开 + 两段式淡入；
     * 旧曲继续演奏并同步滤波渐暗、1.6s 淡出，后段停排新音、节点自动回收。
     */
    play(name) {
      const c = ac();
      if (!c) return;
      const def = TRACKS[name];
      if (!def) return;
      if (current && current.defKey === name && !current.dead) return;

      const nowC = c.currentTime;

      // 新曲链路：osc → gain → lowpass → bus（淡入时滤波从闷到亮）
      const g = c.createGain();
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      g.gain.value = 0.0001;
      g.connect(f); f.connect(bus);

      const runner = {
        def, defKey: name, step: 0, bar: 0,
        nextT: 0, gain: g, filter: f,
        dead: false, stopAt: Infinity, cleanupAt: Infinity
      };

      // 入场时刻：对齐旧曲音乐边界；无旧曲或上下文未运行时立即轻起
      const old = (current && !current.dead) ? current : null;
      const entryT = (old && c.state === 'running') ? entryBoundary(old, nowC) : nowC + 0.12;
      runner.nextT = entryT;

      // 新曲自动化：先快速到半亮半响，再缓慢铺满（避免中段音量凹陷）
      g.gain.setValueAtTime(0.0001, nowC);
      g.gain.setValueAtTime(0.0001, entryT);
      g.gain.exponentialRampToValueAtTime(0.5, entryT + 0.55);
      g.gain.exponentialRampToValueAtTime(1.0, entryT + FADE_IN);
      f.frequency.setValueAtTime(420, nowC);
      f.frequency.setValueAtTime(420, entryT);
      f.frequency.exponentialRampToValueAtTime(2800, entryT + 0.55);
      f.frequency.exponentialRampToValueAtTime(15000, entryT + FADE_IN);

      // 所有在播旧曲：从新曲入场前一刻开始交叉淡出（滤波渐暗 + 音量两段式淡出）
      for (const r of runners) {
        if (r === runner || r.dead) continue;
        const exitAt = Math.max(nowC + 0.02, entryT - 0.2);
        r.stopAt = exitAt + FADE_OUT * 0.55;
        r.cleanupAt = exitAt + FADE_OUT + 0.4;
        try {
          r.gain.gain.cancelScheduledValues(nowC);
          r.filter.frequency.cancelScheduledValues(nowC);
          const gv = Math.max(0.0002, r.gain.gain.value);
          const fv = Math.max(100, r.filter.frequency.value);
          r.gain.gain.setValueAtTime(gv, nowC);
          r.filter.frequency.setValueAtTime(fv, nowC);
          r.gain.gain.setValueAtTime(gv, exitAt);
          r.filter.frequency.setValueAtTime(fv, exitAt);
          r.gain.gain.exponentialRampToValueAtTime(Math.max(0.3, gv * 0.4), exitAt + 0.5);
          r.gain.gain.exponentialRampToValueAtTime(0.0001, exitAt + FADE_OUT);
          r.filter.frequency.exponentialRampToValueAtTime(900, exitAt + 0.5);
          r.filter.frequency.exponentialRampToValueAtTime(380, exitAt + FADE_OUT);
        } catch (e) {}
      }

      runners.push(runner);
      current = runner;
    },

    /** 暂停/界面压低音乐音量（0.4s 平滑过渡） */
    setDuck(v) {
      if (!bus || !ctx) return;
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), ctx.currentTime);
      bus.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), ctx.currentTime + 0.4);
    },

    setMuted(m) {
      muted = m;
      if (master && ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(m ? 0.0001 : 0.85, ctx.currentTime + 0.35);
      }
    },

    current() { return current ? current.defKey : null; },
    /** 调试：当前并存的播放实例数（交叉淡化期间为 2） */
    activeCount() { return runners.length; }
  };
})();
