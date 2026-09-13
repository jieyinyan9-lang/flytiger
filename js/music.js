/* ============================================================
 * music.js —— 音频文件背景音乐引擎（assets/BGM/*.mp3，160kbps）
 * 曲目按需懒加载、循环播放，切歌默认交叉淡入淡出（约 1.6s）。
 *
 * 场景曲目：
 *   bgm-zhujiemian   主界面 / 局外
 *   bgm-mingliang    草原 / 沙漠 / 大海
 *   bgm-yinan        火焰山 / 荒地
 *   bgm-saibopengke  赛博朋克都市（霓虹喵都）
 *   bgm-jiaodouchang 角斗场
 *   bgm-anheishamo   月痕沙海
 *   bgm-guaiwuchao   怪物潮
 * Boss 曲目：
 *   boss-1  火焰飞猪王 / 雷公巨兽 / 飞天狗王 / 巨型野鸡王
 *   boss-2  亡灵骷髅王 / 祖国人 / 怪客 / 蛙哥
 *   boss-niumowang 牛魔王  boss-shishenrenmian 狮身人面像
 *   boss-gulongwang 巨型骨龙王  boss-hexian 鹤仙
 *   boss-fuwang 大王  boss-ying 咬剑鹰  boss-wushi 飞天日本武士
 *
 * 对外接口（与旧程序化引擎保持一致）：
 *   Music.unlock() / play(name) / setDuck(v) /
 *   setMuted(m) / isMuted() / current() / activeCount()
 * ============================================================ */
(function () {
  'use strict';

  var DIR = 'assets/BGM/';
  var FADE = 1.6;          // 淡入 / 淡出时长（秒）
  var BASE_VOL = 0.85;     // BGM 基础音量

  // 曲目键 → 文件名（boss-shenmi.mp3 暂未使用）
  var FILES = {
    'bgm-zhujiemian': 'bgm-zhujiemian.mp3',
    'bgm-mingliang': 'bgm-mingliang.mp3',
    'bgm-yinan': 'bgm-yinan.mp3',
    'bgm-saibopengke': 'bgm-saibopengke.mp3',
    'bgm-jiaodouchang': 'bgm-jiaodouchang.mp3',
    'bgm-anheishamo': 'bgm-anheishamo.mp3',
    'bgm-guaiwuchao': 'bgm-guaiwuchao.mp3',
    'boss-1': 'boss-1.mp3',
    'boss-2': 'boss-2.mp3',
    'boss-fuwang': 'boss-fuwang.mp3',
    'boss-gulongwang': 'boss-gulongwang.mp3',
    'boss-hexian': 'boss-hexian.mp3',
    'boss-niumowang': 'boss-niumowang.mp3',
    'boss-shishenrenmian': 'boss-shishenrenmian.mp3',
    'boss-wushi': 'boss-wushi.mp3',
    'boss-ying': 'boss-ying.mp3'
  };

  // 背景音乐开关：localStorage 持久化（'0' = 关，其余/缺省 = 开）
  var muted = (function () {
    try { return localStorage.getItem('flytiger_bgm') === '0'; } catch (e) { return false; }
  })();

  // 旧版程序化引擎曲目键 → 新音频文件键（兼容旧调用点，防止外部回退旧代码时播不出音乐）
  var ALIASES = {
    tide: 'bgm-guaiwuchao',          // 怪物潮
    boss: 'boss-1',                  // 通用 Boss 兜底
    eagle: 'boss-ying',              // 咬剑鹰
    pheasant: 'boss-1',              // 巨型野鸡王
    hero: 'boss-2',                  // 祖国人
    imperial: 'boss-fuwang',         // 大王
    crane: 'boss-hexian',            // 鹤仙
    sphinx: 'boss-shishenrenmian',   // 狮身人面像
    niumo: 'boss-niumowang'          // 牛魔
  };

  /** 旧键 'casual' 按游戏实时状态解析：局外→主界面曲，局内→当前地图曲 */
  function resolveCasual() {
    var g = window.game;
    if (g && g.state === 'playing' && g.mapId) {
      switch (g.mapId) {
        case 'volcano':
        case 'wasteland': return 'bgm-yinan';
        case 'cyber': return 'bgm-saibopengke';
        case 'colosseum': return 'bgm-jiaodouchang';
        case 'moondesert': return 'bgm-anheishamo';
        default: return 'bgm-mingliang';   // grassland / desert / ocean
      }
    }
    return 'bgm-zhujiemian';
  }

  /** 把任意（新旧）曲目键解析成 FILES 中存在的键，无法识别返回 null */
  function resolveKey(name) {
    if (FILES[name]) return name;
    if (name === 'casual') return resolveCasual();
    return ALIASES[name] || null;
  }

  var unlocked = false;      // 浏览器自动播放策略：首次用户手势解锁前只记录期望曲目
  var desired = null;        // 当前希望播放的曲目键
  var pool = {};             // key → { el, level, fade, active }
  var master = muted ? 0 : 1;  // 静音总线乘子（0.35s 平滑）
  var duck = 1;              // 暂停压低乘子（0.4s 平滑）
  var duckTarget = 1;
  var timer = null;
  var lastTick = 0;

  function now() { return performance.now() / 1000; }

  function ensureTimer() {
    if (timer) return;
    lastTick = now();
    timer = setInterval(tick, 50);
  }

  /** 懒取曲目播放实例（首次切到才发起音频下载） */
  function getEntry(key) {
    var e = pool[key];
    if (e) return e;
    var el = new Audio(DIR + FILES[key]);
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.addEventListener('error', function () { /* 文件缺失时静默，不抛错 */ });
    e = { el: el, level: 0, fade: null, active: false };
    pool[key] = e;
    return e;
  }

  function startFade(e, to) {
    e.fade = { from: e.level, to: to, t0: now(), dur: FADE };
  }

  /** 实际起播某曲目（unlock 之后），其余在播曲目交叉淡出 */
  function startTrack(key) {
    var e = getEntry(key);
    if (e.active) return;
    ensureTimer();
    e.active = true;
    try { e.el.currentTime = 0; } catch (err) {}
    try {
      var pr = e.el.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (err) {}
    startFade(e, 1);
    for (var k in pool) {
      var o = pool[k];
      if (o === e || !o.active) continue;
      o.active = false;
      startFade(o, 0);
    }
  }

  function tick() {
    var t = now();
    var dt = Math.min(0.25, t - lastTick);
    lastTick = t;

    // 静音 / 暂停压低：指数平滑（时间常数约 0.25s）
    var k = 1 - Math.exp(-dt / 0.25);
    master += ((muted ? 0 : 1) - master) * k;
    duck += (duckTarget - duck) * k;

    for (var key in pool) {
      var e = pool[key];
      if (e.fade) {
        var p = Math.min(1, (t - e.fade.t0) / e.fade.dur);
        var x = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;  // easeInOutQuad
        e.level = e.fade.from + (e.fade.to - e.fade.from) * x;
        if (p >= 1) {
          e.level = e.fade.to;
          e.fade = null;
          if (!e.active) { try { e.el.pause(); } catch (err) {} }
        }
      }
      if (e.active || e.level > 0.0005) {
        var v = e.level * master * duck * BASE_VOL;
        e.el.volume = v < 0 ? 0 : (v > 1 ? 1 : v);
      }
    }
  }

  /* ---------------- 对外接口 ---------------- */
  window.Music = {
    /** 首次用户手势内调用：解锁自动播放，并起播已选定的曲目 */
    unlock: function () {
      if (unlocked) return;
      unlocked = true;
      if (desired) startTrack(desired);
    },

    /** 按场景切歌（同名不重复）：新曲 1.6s 淡入，旧曲 1.6s 交叉淡出；兼容新旧曲目键 */
    play: function (name) {
      var key = resolveKey(name);
      if (!key) return;
      desired = key;
      if (!unlocked) return;   // 等待首次手势 unlock
      startTrack(key);
    },

    /** 暂停/界面压低音乐音量（平滑过渡，1 = 正常） */
    setDuck: function (v) {
      duckTarget = v;
      ensureTimer();
    },

    /** 背景音乐开关：0.35s 平滑淡出/淡入，并持久化到 localStorage */
    setMuted: function (m) {
      muted = m;
      try { localStorage.setItem('flytiger_bgm', m ? '0' : '1'); } catch (e) {}
      ensureTimer();
    },

    isMuted: function () { return muted; },

    current: function () { return desired; },

    /** 调试：当前仍在发声（含淡出尾段）的曲目数，交叉淡化期间为 2 */
    activeCount: function () {
      var n = 0;
      for (var k in pool) { if (pool[k].active || pool[k].level > 0.01) n++; }
      return n;
    }
  };
})();
