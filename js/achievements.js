/* ============================================================
 * achievements.js —— 喵咪成就系统
 *  - 通用成就 / 英雄专属成就 / 隐藏成就
 *  - localStorage 持久化解锁记录与跨局统计
 *  - 局内事件驱动：game.js / entities.js 在关键节点调用 Ach.evt(...)
 *  - 解锁时局内炫彩提示（canvas 绘制，彩虹渐变横幅 + 音效）
 *  - 主菜单「喵咪成就」面板（DOM）
 * ============================================================ */
(function () {
  'use strict';

  const STORE_KEY = 'flytiger_ach_v1';

  /* ---------------- 成就定义 ----------------
   * cat: general 通用 / <charId> 英雄专属 / hidden 隐藏
   * hidden: 未解锁时面板显示 ??? */
  const CHAR_TITLE = {
    xiaobai: '小白 —— 重炮狂魔',
    xiake: '侠客 —— 一击必杀',
    mofashi: '法师 —— 掌控全局',
    buliang: '不良少年 —— 街头混混',
    jiaodoushi: '狂战士 —— 越挨打越兴奋',
    chaoren: '超级小子 —— 全场C位'
  };

  const DEFS = [
    /* ============ 🐱 通用成就 ============ */
    { id: 'g_debut',   cat: 'general', icon: '🐱', name: '猫猫出道啦',     desc: '首次进入战斗' },
    { id: 'g_fish',    cat: 'general', icon: '🐟', name: '第一口鱼干',     desc: '首次获得强化' },
    { id: 'g_boss',    cat: 'general', icon: '🏆', name: '有点东西喵',     desc: '首次击败Boss' },
    { id: 'g_round3',  cat: 'general', icon: '🥉', name: '越打越上头',     desc: '到达第3轮' },
    { id: 'g_round5',  cat: 'general', icon: '🥈', name: '已经很熟练了喵', desc: '到达第5轮' },
    { id: 'g_round7',  cat: 'general', icon: '🥇', name: '猫猫还能打！',   desc: '到达第7轮' },
    { id: 'g_round10', cat: 'general', icon: '👑', name: '十轮？小意思！', desc: '到达第10轮' },
    { id: 'g_flawless',cat: 'general', icon: '🛡️', name: '不掉一根猫毛',   desc: '单局无死亡到达第10轮' },
    { id: 'g_lowboss', cat: 'general', icon: '❤️‍🔥', name: '残血也要赢',   desc: '低生命值击败Boss' },
    { id: 'g_kills',   cat: 'general', icon: '💥', name: '满屏都是我的！', desc: '单局击杀200个敌人' },
    { id: 'g_dodge',   cat: 'general', icon: '💨', name: '这也能躲？',     desc: '连续躲避50发弹幕' },
    { id: 'g_bulletbath', cat: 'general', icon: '🌊', name: '弹幕里洗澡', desc: '在高密度弹幕中存活' },
    { id: 'g_nohit',   cat: 'general', icon: '✨', name: '今天手感超好',   desc: '单局连续无伤击杀30个敌人' },
    { id: 'g_fishfarm',cat: 'general', icon: '🐠', name: '鱼干管够！',     desc: '累计获得100次成长' },

    /* ============ 🐱 小白 —— 重炮狂魔 ============ */
    { id: 'xb_wave',   cat: 'xiaobai', icon: '🌊', name: '「乖乖站好！」',       desc: '一次强光波击杀12个以上敌人' },
    { id: 'xb_tier',   cat: 'xiaobai', icon: '🎆', name: '「满屏都是我的烟花！」', desc: '单局子弹达到最高阶' },
    { id: 'xb_aoe',    cat: 'xiaobai', icon: '🎯', name: '「诶嘿~打偏了！」',   desc: '一发爆炸弹同时击中5个以上目标' },
    { id: 'xb_turret', cat: 'xiaobai', icon: '🏰', name: '「移动炮台」',         desc: '拥有4条以上弹道时击败Boss' },

    /* ============ 🐱 侠客 —— 一击必杀 ============ */
    { id: 'xk_dodge',  cat: 'xiake', icon: '💨', name: '「你慢了。」',           desc: '连续闪避15发弹幕后感击杀敌' },
    { id: 'xk_knife',  cat: 'xiake', icon: '🗡️', name: '「我的飞刀，从不失手。」', desc: '飞刀连续命中10次' },
    { id: 'xk_slash',  cat: 'xiake', icon: '⚔️', name: '「刀入鞘，恩怨了。」',   desc: '使用疾风斩后击败Boss' },
    { id: 'xk_burst',  cat: 'xiake', icon: '⚡', name: '「一瞬之间。」',         desc: '3秒内连续击杀15个敌人' },

    /* ============ 🐱 法师 —— 掌控全局 ============ */
    { id: 'mf_star',   cat: 'mofashi', icon: '⭐', name: '「别急嘛~」',           desc: '单局星星弹击杀40个敌人' },
    { id: 'mf_confuse',cat: 'mofashi', icon: '😵‍💫', name: '「你看，我说什么来着？」', desc: '护盾持续期间连续击杀5个困惑敌人' },
    { id: 'mf_shield', cat: 'mofashi', icon: '🔮', name: '「来呀，打我呀！」',     desc: '开启魔法护盾后击败Boss' },
    { id: 'mf_field',  cat: 'mofashi', icon: '🌟', name: '「这里都是我的地盘。」', desc: '场上同时存在12颗以上星星弹' },

    /* ============ 🐱 不良少年 —— 街头混混 ============ */
    { id: 'bl_freeze8',  cat: 'buliang', icon: '📢', name: '「全都给我站好！」', desc: '一次禁锢声波禁锢8个以上敌人' },
    { id: 'bl_butt',     cat: 'buliang', icon: '🚬', name: '「你管我？」',       desc: '使用烟头弹击杀敌人' },
    { id: 'bl_freeze15', cat: 'buliang', icon: '🔇', name: '「一嗓子全控。」',   desc: '一次声波控制15个以上敌人' },
    { id: 'bl_bounce',   cat: 'buliang', icon: '🧱', name: '「爷就喜欢弹墙。」', desc: '利用反弹后的烟头连续击杀5个敌人' },

    /* ============ 🐱 狂战士 —— 越挨打越兴奋 ============ */
    { id: 'js_lowhp',  cat: 'jiaodoushi', icon: '🩸', name: '「不够！还不够！」', desc: '低生命状态下击杀30个敌人' },
    { id: 'js_tank',   cat: 'jiaodoushi', icon: '🛡️', name: '「再用力点！」',   desc: 'Boss战中承受大量伤害后击败Boss' },
    { id: 'js_rage',   cat: 'jiaodoushi', icon: '😤', name: '「血怒开了！」',     desc: '血怒状态下击杀Boss' },
    { id: 'js_fight',  cat: 'jiaodoushi', icon: '🔥', name: '「这才叫战斗！」',   desc: '残血状态击败Boss完成一轮' },

    /* ============ 🐱 超级小子 —— 全场C位 ============ */
    { id: 'cr_five',   cat: 'chaoren', icon: '5️⃣', name: '「看我表演！」',       desc: '五重激光同时命中4个以上敌人' },
    { id: 'cr_ult',    cat: 'chaoren', icon: '💫', name: '「帅不帅？」',         desc: '使用大招后击败Boss' },
    { id: 'cr_replay', cat: 'chaoren', icon: '🎬', name: '「我要上精彩回放！」', desc: '单次激光串击杀12个以上敌人' },
    { id: 'cr_god',    cat: 'chaoren', icon: '🦸', name: '「全场唯一真神」',     desc: '使用超级小子到达第10轮' },

    /* ============ 🏟️ 角斗场专属成就 ============ */
    { id: 'ar_enter',    cat: 'arena', icon: '🏟️', name: '「谁把我扔进来的喵？」', desc: '首次进入罗马角斗场' },
    { id: 'ar_kills100', cat: 'arena', icon: '⚔️', name: '「这里挺热闹嘛~」',     desc: '在角斗场累计击败100名敌人' },
    { id: 'ar_melee',    cat: 'arena', icon: '👊', name: '「喵喵拳！」',           desc: '角斗场中近距离连续击杀10名敌人' },
    { id: 'ar_swarm',    cat: 'arena', icon: '🌀', name: '「别贴这么近啊！」',     desc: '角斗场中被大量敌人包围后成功脱身' },
    { id: 'ar_flawless', cat: 'arena', icon: '🛡️', name: '「猫猫灵活得很！」',     desc: '不受伤完成一轮角斗场战斗' },
    { id: 'ar_burst',    cat: 'arena', icon: '⚡', name: '「一个都别跑！」',       desc: '角斗场中3秒内连续击杀20名敌人' },
    { id: 'ar_lowhp',    cat: 'arena', icon: '❤️‍🔥', name: '「残血？问题不大。」',   desc: '低生命值完成角斗场一轮战斗' },
    { id: 'ar_rounds3',  cat: 'arena', icon: '🏅', name: '「这里我说了算！」',     desc: '单局角斗场连续完成3轮战斗' },
    { id: 'ar_streak',   cat: 'arena', icon: '🔥', name: '「全场都是我的！」',     desc: '单局角斗场无伤连杀60名敌人' },
    { id: 'ar_round15',  cat: 'arena', icon: '👑', name: '「猫猫还没打够！」',     desc: '角斗场累计完成15轮战斗' },

    /* ============ ❓ 隐藏成就 ============ */
    { id: 'h_idle',    cat: 'hidden', icon: '😴', name: '「猫猫不想动」',   desc: '长时间不移动仍然存活', hidden: true },
    { id: 'h_die',     cat: 'hidden', icon: '💀', name: '「我就试一下」',   desc: '第一次死亡', hidden: true },
    { id: 'h_restart', cat: 'hidden', icon: '🔄', name: '「再来亿局」',     desc: '连续重新开始多局', hidden: true },
    { id: 'h_nofish',  cat: 'hidden', icon: '🥣', name: '「鱼干呢？」',     desc: '一局没有获得任何成长', hidden: true },
    { id: 'h_sametype',cat: 'hidden', icon: '🎰', name: '「这不是运气！」', desc: '连续获得相同类型强化', hidden: true },
    { id: 'h_samekill',cat: 'hidden', icon: '😾', name: '「你礼貌吗？」',   desc: '被同一种敌人连续击杀', hidden: true },
    { id: 'h_angry',   cat: 'hidden', icon: '😡', name: '「猫猫生气了！」', desc: '残血后连续击杀大量敌人', hidden: true },
    { id: 'h_special', cat: 'hidden', icon: '❓', name: '「喵喵喵？」',     desc: '触发一个特殊/隐藏事件', hidden: true },
    { id: 'h_passby',  cat: 'hidden', icon: '🚶', name: '「我真的只是路过」', desc: '不攻击敌人存活一段时间', hidden: true },
    { id: 'h_allwant', cat: 'hidden', icon: '🎒', name: '「全都要！」',     desc: '单局获得8种以上不同强化', hidden: true }
  ];

  const DEF_MAP = {};
  DEFS.forEach(d => { DEF_MAP[d.id] = d; });

  /* ---------------- 持久化数据 ---------------- */
  let saved = {
    unlocked: {},          // id -> 解锁时间戳
    stats: {
      totalLevels: 0,      // 累计成长次数
      runs: 0,             // 总局数
      everDied: false,     // 是否曾经阵亡过
      lastDeathKey: '',    // 上一局击杀来源
      deathSame: 0,        // 被同一敌人连续击杀次数
      lastRunAt: 0,        // 上一次开局时间戳
      restartStreak: 0,    // 快速连续开局次数
      arenaKills: 0,       // 角斗场累计击杀
      arenaRounds: 0       // 角斗场累计完成轮数（击败Boss数）
    }
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          saved.unlocked = Object.assign({}, data.unlocked);
          saved.stats = Object.assign(saved.stats, data.stats || {});
        }
      }
    } catch (e) { /* 存档损坏：静默使用默认值 */ }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch (e) {}
  }
  load();

  /* ---------------- 单局统计状态 ---------------- */
  let run = null;
  function newRun(charId) {
    run = {
      charId: charId || 'xiaobai',
      t0: performance.now(),
      time: 0,
      kills: 0,
      levels: 0,
      deaths: 0,
      round: 1,
      upgradeIds: [],          // 本局获得过的成长 id（有序）
      upgradeStreakId: '',     // 连续相同成长
      upgradeStreak: 0,
      distinct: {},            // id -> 次数
      noHurtStreak: 0,         // 连续无伤击杀
      dodgeStreak: 0,          // 连续闪避
      denseT: 0,               // 高密度弹幕存活累计时间
      lowHpKills: 0,           // 低生命击杀数
      killTimes: [],           // 击杀时间戳（瞬杀判定）
      starKills: 0,            // 星星弹击杀
      buttKills: 0,            // 烟头弹击杀
      bounceButtKills: 0,      // 反弹烟头击杀
      knifeHits: 0,            // 飞刀连续命中
      confuseKills: 0,         // 困惑敌人击杀（单次护盾窗口）
      bossDmgTaken: 0,         // 本轮Boss战承伤
      ultKind: '',             // 最近释放的大招
      ultT: 0,                 // 大招判定窗口剩余
      waveKills: 0,            // 本次强光波击杀
      laserTargets: null,      // 本次激光串命中目标集合
      laserKills: 0,           // 本次激光串击杀
      lowHpT: 0,               // 残血连击窗口
      lowHpKillsWindow: 0,
      lastKillT: -99,          // 上次击杀的游戏时间
      passbyFired: false,
      /* —— 角斗场专属 —— */
      arena: false,            // 本局是否在罗马角斗场
      arenaMeleeStreak: 0,     // 近距离连续击杀
      arenaRounds: 0,          // 本局角斗场完成轮数
      arenaRoundHurt: false,   // 本轮是否受过伤
      swarmT: 0,               // 被包围持续时间
      swarmArmed: false        // 已确认被包围（待脱身）
    };
  }

  /* ---------------- 解锁 & 通知队列 ---------------- */
  const queue = [];          // 待播放通知 [{def, t, max}]
  let cur = null;            // 正在播放的通知
  const NOTI_TIME = 4.2;

  function unlock(id) {
    if (!DEF_MAP[id] || saved.unlocked[id]) return;
    saved.unlocked[id] = Date.now();
    save();
    queue.push({ def: DEF_MAP[id], t: NOTI_TIME, max: NOTI_TIME });
    // 音效（SFX 可能尚未加载，做防御）
    try { if (window.SFX && SFX.achievement) SFX.achievement(); } catch (e) {}
    // 面板开着时实时刷新
    if (panelBuilt && panelEl && !panelEl.classList.contains('hidden')) renderPanel();
  }

  /** 每帧调用：通知队列推进 */
  function tick(dt) {
    if (!cur && queue.length) cur = queue.shift();
    if (cur) {
      cur.t -= dt;
      if (cur.t <= 0) cur = queue.length ? queue.shift() : null;
      if (cur) cur.t = cur.t > 0 ? cur.t : NOTI_TIME;
    }
  }

  /* ---------------- 事件入口 ---------------- */
  function evt(name, d) {
    d = d || {};
    const g = d.g;
    const p = g && g.player;
    switch (name) {
      /* ===== 开局 ===== */
      case 'runStart': {
        const now = Date.now();
        if (saved.stats.lastRunAt && now - saved.stats.lastRunAt < 60000) {
          saved.stats.restartStreak++;
        } else saved.stats.restartStreak = 1;
        saved.stats.lastRunAt = now;
        saved.stats.runs++;
        // 角斗场：标记本局地图
        if (run && g && g.mapId === 'colosseum') {
          run.arena = true;
          unlock('ar_enter');
        }
        save();
        unlock('g_debut');
        if (saved.stats.restartStreak >= 3) unlock('h_restart');
        break;
      }

      /* ===== 获得成长 ===== */
      case 'upgrade': {
        unlock('g_fish');
        saved.stats.totalLevels++;
        if (saved.stats.totalLevels >= 100) unlock('g_fishfarm');
        if (run) {
          run.levels++;
          run.upgradeIds.push(d.id);
          run.distinct[d.id] = (run.distinct[d.id] || 0) + 1;
          if (run.upgradeStreakId === d.id) run.upgradeStreak++;
          else { run.upgradeStreakId = d.id; run.upgradeStreak = 1; }
          if (run.upgradeStreak >= 3) unlock('h_sametype');
          if (Object.keys(run.distinct).length >= 8) unlock('h_allwant');
          // 小白：子弹达到最高阶（bulletTier 3 = 高阶穿透弹）
          if (run.charId === 'xiaobai' && p && p.bulletTier >= 3) unlock('xb_tier');
        }
        save();
        break;
      }

      /* ===== 轮次推进 ===== */
      case 'round': {
        if (!run) break;
        run.round = d.round;
        if (d.round >= 3) unlock('g_round3');
        if (d.round >= 5) unlock('g_round5');
        if (d.round >= 7) unlock('g_round7');
        if (d.round >= 10) {
          unlock('g_round10');
          if (run.deaths === 0) unlock('g_flawless');
          if (run.charId === 'chaoren') unlock('cr_god');
        }
        break;
      }

      /* ===== Boss 出场 ===== */
      case 'bossSpawn': {
        if (d.name === 'Sphinx' || d.name === 'NiuMo' || d.name === 'BoneDragonKing') {
          unlock('h_special');
        }
        if (run) run.bossDmgTaken = 0;
        break;
      }

      /* ===== Boss 被击败 ===== */
      case 'bossDefeated': {
        unlock('g_boss');
        if (!run || !p) break;
        const ratio = p.maxHp ? p.hp / p.maxHp : 1;
        if (ratio <= 0.25) unlock('g_lowboss');
        // 小白：移动炮台（4 条以上弹道）
        if (run.charId === 'xiaobai' && p.bulletCount >= 4) unlock('xb_turret');
        // 侠客：疾风斩后击败Boss（大招窗口 4.5s）
        if (run.charId === 'xiake' && run.ultKind === 'slash' && run.ultT > 0) unlock('xk_slash');
        // 法师：护盾期间击败Boss
        if (run.charId === 'mofashi' && p.magicShieldT > 0) unlock('mf_shield');
        // 狂战士：血怒状态击败Boss
        if (run.charId === 'jiaodoushi' && p.bloodRageT > 0) unlock('js_rage');
        // 狂战士：承伤后击败Boss（本轮Boss战承伤 ≥ 80）
        if (run.charId === 'jiaodoushi' && run.bossDmgTaken >= 80) unlock('js_tank');
        // 狂战士：残血完成一轮
        if (run.charId === 'jiaodoushi' && ratio <= 0.3) unlock('js_fight');
        // 超级小子：大招后击败Boss
        if (run.charId === 'chaoren' && run.ultKind === 'lasers' && run.ultT > 0) unlock('cr_ult');
        // —— 角斗场：完成一轮结算 ——
        if (run.arena) {
          run.arenaRounds++;
          saved.stats.arenaRounds++;
          if (!run.arenaRoundHurt) unlock('ar_flawless');        // 本轮未受伤
          if (ratio <= 0.3) unlock('ar_lowhp');                 // 残血完成一轮
          if (run.arenaRounds >= 3) unlock('ar_rounds3');       // 单局连过3轮
          if (saved.stats.arenaRounds >= 15) unlock('ar_round15'); // 累计15轮
          run.arenaRoundHurt = false;                           // 新一轮重置受伤标记
          save();
        }
        run.bossDmgTaken = 0;
        break;
      }

      /* ===== 敌人死亡（小怪） ===== */
      case 'enemyDie': {
        if (!run || !p) break;
        run.kills++;
        run.noHurtStreak++;
        run.lastKillT = run.time;
        run.killTimes.push(run.time);
        if (run.noHurtStreak >= 30) unlock('g_nohit');
        if (run.kills >= 200) unlock('g_kills');
        // 残血连击窗口
        if (run.lowHpT > 0) {
          run.lowHpKillsWindow++;
          if (run.lowHpKillsWindow >= 15) unlock('h_angry');
        }
        // 低生命击杀（狂战士）
        if (p.maxHp && p.hp / p.maxHp <= 0.3) {
          run.lowHpKills++;
          if (run.charId === 'jiaodoushi' && run.lowHpKills >= 30) unlock('js_lowhp');
        }
        // 困惑敌人击杀（法师护盾窗口内）
        if (d.e && d.e.confuseT > 0) {
          run.confuseKills++;
          if (run.charId === 'mofashi' && run.confuseKills >= 5) unlock('mf_confuse');
        }
        // 侠客：闪避后击杀
        if (run.charId === 'xiake' && run.dodgeStreak >= 15) unlock('xk_dodge');
        // 侠客：3秒15杀
        const recent = run.killTimes.filter(t => run.time - t <= 3);
        run.killTimes = recent;
        if (run.charId === 'xiake' && recent.length >= 15) unlock('xk_burst');
        // —— 角斗场专属击杀统计 ——
        if (run.arena) {
          saved.stats.arenaKills++;
          if (saved.stats.arenaKills >= 100) unlock('ar_kills100');
          // 无伤连杀60
          if (run.noHurtStreak >= 60) unlock('ar_streak');
          // 3秒内连杀20
          if (recent.length >= 20) unlock('ar_burst');
          // 近距离（110px 内）连续击杀10
          const ex = d.e ? d.e.x : p.x, ey = d.e ? d.e.y : p.y;
          if (Math.hypot(ex - p.x, ey - p.y) <= 110) {
            run.arenaMeleeStreak++;
            if (run.arenaMeleeStreak >= 10) unlock('ar_melee');
          } else run.arenaMeleeStreak = 0;
          save();
        }
        break;
      }

      /* ===== 我方子弹击杀归因 ===== */
      case 'bulletKill': {
        if (!run) break;
        if (d.kind === 'star') {
          run.starKills++;
          if (run.charId === 'mofashi' && run.starKills >= 40) unlock('mf_star');
        }
        if (d.kind === 'butt') {
          run.buttKills++;
          if (run.charId === 'buliang') unlock('bl_butt');
          if (d.bounced) {
            run.bounceButtKills++;
            if (run.charId === 'buliang' && run.bounceButtKills >= 5) unlock('bl_bounce');
          }
        }
        if (d.ult) {
          run.laserKills++;
          if (run.charId === 'chaoren' && run.laserKills >= 12) unlock('cr_replay');
        }
        break;
      }

      /* ===== 飞刀命中 / 落空 ===== */
      case 'knifeHit': {
        if (!run) break;
        run.knifeHits++;
        if (run.charId === 'xiake' && run.knifeHits >= 10) unlock('xk_knife');
        break;
      }
      case 'knifeMiss': {
        if (run) run.knifeHits = 0;
        break;
      }

      /* ===== 闪避（弹幕擦身） ===== */
      case 'dodge': {
        if (!run) break;
        run.dodgeStreak++;
        if (run.dodgeStreak >= 50) unlock('g_dodge');
        break;
      }

      /* ===== 高密度弹幕 ===== */
      case 'dense': {
        if (!run) break;
        run.denseT += d.dt || 0;
        if (run.denseT >= 4) unlock('g_bulletbath');
        break;
      }

      /* ===== 玩家长时间不移动 ===== */
      case 'idleLong': {
        unlock('h_idle');
        break;
      }

      /* ===== 不击杀存活 ===== */
      case 'passby': {
        unlock('h_passby');
        break;
      }

      /* ===== 玩家受伤 ===== */
      case 'playerHurt': {
        if (!run || !p) break;
        run.noHurtStreak = 0;
        run.dodgeStreak = 0;
        if (run.arena) run.arenaRoundHurt = true;   // 角斗场：本轮受伤，无伤轮失效
        if (g.bossActive) run.bossDmgTaken += d.amt || 0;
        // 残血连击窗口：血量跌到 25% 以下开启 10s
        if (p.maxHp && p.hp / p.maxHp <= 0.25 && run.lowHpT <= 0) {
          run.lowHpT = 10;
          run.lowHpKillsWindow = 0;
        }
        break;
      }

      /* ===== 玩家阵亡（掉一条命） ===== */
      case 'playerDeath': {
        if (run) run.deaths++;
        if (!saved.stats.everDied) {
          saved.stats.everDied = true;
          save();
          unlock('h_die');
        }
        break;
      }

      /* ===== 游戏结束 ===== */
      case 'gameOver': {
        if (run) {
          if (run.levels === 0) unlock('h_nofish');
        }
        // 被同一种敌人连续击杀
        const key = (d.src && d.src.key) ? d.src.key : 'unknown';
        if (saved.stats.lastDeathKey && key === saved.stats.lastDeathKey) {
          saved.stats.deathSame++;
        } else saved.stats.deathSame = 1;
        saved.stats.lastDeathKey = key;
        if (saved.stats.deathSame >= 2) unlock('h_samekill');
        save();
        break;
      }

      /* ===== 释放大招 ===== */
      case 'ult': {
        if (!run) break;
        run.ultKind = d.ult;
        run.ultT = 4.5;
        if (d.ult === 'lasers') {
          run.laserTargets = new Set();
          run.laserKills = 0;
        }
        if (d.ult === 'shield') {
          run.confuseKills = 0;   // 新一次护盾窗口
        }
        break;
      }
      case 'ultWaveKills': {
        if (!run) break;
        run.waveKills = d.n || 0;
        if (run.charId === 'xiaobai' && run.waveKills >= 12) unlock('xb_wave');
        break;
      }
      case 'ultSoundwave': {
        if (!run) break;
        const n = d.n || 0;
        if (run.charId === 'buliang') {
          if (n >= 8) unlock('bl_freeze8');
          if (n >= 15) unlock('bl_freeze15');
        }
        break;
      }
      case 'ultLaserHit': {
        if (!run || !run.laserTargets) break;
        run.laserTargets.add(d.target);
        if (run.charId === 'chaoren' && run.laserTargets.size >= 4) unlock('cr_five');
        break;
      }
      case 'aoeHits': {
        if (!run) break;
        if (run.charId === 'xiaobai' && (d.n || 0) >= 5) unlock('xb_aoe');
        break;
      }
      case 'starField': {
        if (!run) break;
        if (run.charId === 'mofashi' && (d.n || 0) >= 12) unlock('mf_field');
        break;
      }
    }
  }

  /** 局内每帧调用（playing 状态）：推进窗口计时器与待机/路过判定 */
  function frame(dt, g) {
    if (!run) return;
    run.time += dt;
    if (run.ultT > 0) run.ultT -= dt;
    if (run.lowHpT > 0) run.lowHpT -= dt;
    // 不击杀存活：开局 35 秒内没有任何击杀
    if (!run.passbyFired && run.time >= 35 && run.time - run.lastKillT >= 35) {
      run.passbyFired = true;
      unlock('h_passby');
    }
    // 角斗场：被大量敌人包围（130px 内 ≥8 个）后成功脱身（≤3 个）
    if (run.arena && g && g.player && g.enemies) {
      const pl = g.player;
      let near = 0;
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - pl.x, e.y - pl.y) <= 130) near++;
      }
      if (near >= 8) {
        run.swarmT += dt;
        if (run.swarmT >= 0.6) run.swarmArmed = true;   // 包围持续 0.6s 才算数
      } else {
        run.swarmT = 0;
        if (run.swarmArmed && near <= 3) {              // 包围圈消散 = 脱身成功
          run.swarmArmed = false;
          unlock('ar_swarm');
        }
      }
    }
  }

  /* ---------------- 局内炫彩通知渲染（canvas） ---------------- */
  function render(ctx) {
    if (!cur) return;
    const def = cur.def;
    const age = cur.max - cur.t;              // 已播放时间
    const fadeIn = Math.min(1, age / 0.35);
    const fadeOut = Math.min(1, cur.t / 0.45);
    const a = Math.min(fadeIn, fadeOut);
    const W = 460, H = 78;
    const x = (960 - W) / 2;
    let y = 64 - (1 - fadeIn) * 40;          // 从上方滑入
    const hueShift = (performance.now() / 8) % 360;

    ctx.save();
    ctx.globalAlpha = a;

    // 背板
    ctx.fillStyle = 'rgba(12, 10, 32, 0.92)';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, W, H, 14);
    ctx.fill();
    // 彩虹流光描边
    ctx.save();
    roundRect(ctx, x, y, W, H, 14);
    ctx.clip();
    const lg = ctx.createLinearGradient(x, y, x + W, y);
    for (let i = 0; i <= 6; i++) {
      lg.addColorStop(i / 6, 'hsl(' + ((hueShift + i * 60) % 360) + ', 100%, 62%)');
    }
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = lg;
    ctx.fillRect(x, y - 4, W, 6);
    ctx.fillRect(x, y + H - 2, W, 6);
    ctx.restore();
    roundRect(ctx, x, y, W, H, 14);
    ctx.stroke();

    // 旋转彩虹图标底
    const ix = x + 44, iy = y + H / 2;
    ctx.save();
    ctx.translate(ix, iy);
    const rot = Math.sin(performance.now() / 300) * 0.12;
    ctx.rotate(rot);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 30 - i * 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = 'hsla(' + ((hueShift + i * 50) % 360) + ', 100%, 65%, ' + (0.55 - i * 0.07) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.font = '30px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, 0, 2);
    ctx.restore();

    // 文字
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    // 「成就解锁」彩虹文字
    const titleText = '🏅 成就解锁！';
    for (let i = 0; i < titleText.length; i++) {
      ctx.fillStyle = 'hsl(' + ((hueShift + i * 28) % 360) + ', 100%, 70%)';
      ctx.fillText(titleText[i], x + 78 + ctx.measureText(titleText.slice(0, i)).width, y + 22);
    }
    ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'hsl(' + hueShift + ', 100%, 60%)';
    ctx.shadowBlur = 12;
    ctx.fillText(def.name, x + 78, y + 48);
    ctx.shadowBlur = 0;

    // 闪烁星光
    for (let i = 0; i < 5; i++) {
      const st = (performance.now() / 1000 * 1.4 + i * 0.7) % (NOTI_TIME / 2);
      const sx = x + 20 + Math.sin(i * 2.4 + performance.now() / 400) * (W / 2 - 30) + W / 2 - 80;
      const sy = y + H - 8 - Math.abs(Math.sin(performance.now() / 350 + i)) * 14;
      ctx.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(st * 3)));
      ctx.fillStyle = 'hsl(' + ((hueShift + i * 70) % 360) + ', 100%, 75%)';
      ctx.fillRect(sx, sy, 3, 3);
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- 成就面板（DOM） ---------------- */
  let panelEl = null, listEl = null, progEl = null;
  let panelBuilt = false;

  function buildPanel() {
    panelEl = document.getElementById('ach-panel');
    if (!panelEl) return;
    listEl = document.getElementById('ach-list');
    progEl = document.getElementById('ach-progress');
    const back = document.getElementById('ach-back-btn');
    if (back) back.addEventListener('click', closePanel);
    panelBuilt = true;
  }

  function openPanel() {
    if (!panelBuilt) buildPanel();
    if (!panelEl) return;
    renderPanel();
    panelEl.classList.remove('hidden');
    try { if (window.SFX && SFX.pick) SFX.pick(); } catch (e) {}
  }
  function closePanel() {
    if (panelEl) panelEl.classList.add('hidden');
    try { if (window.SFX && SFX.hit) SFX.hit(); } catch (e) {}
  }

  function renderPanel() {
    if (!listEl) return;
    const total = DEFS.length;
    const got = DEFS.filter(d => saved.unlocked[d.id]).length;
    if (progEl) progEl.textContent = `已解锁 ${got} / ${total}`;

    const groups = [
      { key: 'general', title: '🐱 通用成就' },
      { key: 'xiaobai', title: '🐱 小白 —— 重炮狂魔' },
      { key: 'xiake', title: '🐱 侠客 —— 一击必杀' },
      { key: 'mofashi', title: '🐱 法师 —— 掌控全局' },
      { key: 'buliang', title: '🐱 不良少年 —— 街头混混' },
      { key: 'jiaodoushi', title: '🐱 狂战士 —— 越挨打越兴奋' },
      { key: 'chaoren', title: '🐱 超级小子 —— 全场C位' },
      { key: 'arena', title: '🏟️ 角斗场专属成就' },
      { key: 'hidden', title: '❓ 隐藏成就' }
    ];
    listEl.innerHTML = '';
    groups.forEach(grp => {
      const sec = document.createElement('div');
      sec.className = 'ach-sec';
      const h = document.createElement('div');
      h.className = 'ach-sec-title';
      const items = DEFS.filter(d => d.cat === grp.key);
      const gotN = items.filter(d => saved.unlocked[d.id]).length;
      h.textContent = `${grp.title}　${gotN}/${items.length}`;
      sec.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'ach-grid';
      items.forEach(d => {
        const unlocked = !!saved.unlocked[d.id];
        const card = document.createElement('div');
        card.className = 'ach-card' + (unlocked ? ' unlocked' : ' locked') + (d.hidden ? ' secret' : '');
        if (unlocked) {
          card.innerHTML =
            `<div class="ach-icon">${d.icon}</div>` +
            `<div class="ach-info"><div class="ach-name">${d.name}</div>` +
            `<div class="ach-desc">${d.desc}</div></div>` +
            `<div class="ach-mark">✓</div>`;
        } else if (d.hidden) {
          card.innerHTML =
            `<div class="ach-icon">❓</div>` +
            `<div class="ach-info"><div class="ach-name">？？？</div>` +
            `<div class="ach-desc">隐藏成就，等待猫猫发现…</div></div>`;
        } else {
          card.innerHTML =
            `<div class="ach-icon">🔒</div>` +
            `<div class="ach-info"><div class="ach-name">${d.name}</div>` +
            `<div class="ach-desc">${d.desc}</div></div>`;
        }
        grid.appendChild(card);
      });
      sec.appendChild(grid);
      listEl.appendChild(sec);
    });
  }

  /* ---------------- 导出 ---------------- */
  window.Ach = {
    beginRun: newRun,
    evt,
    frame,
    tick,
    render,
    openPanel,
    closePanel,
    isUnlocked: id => !!saved.unlocked[id],
    unlockedCount: () => DEFS.filter(d => saved.unlocked[d.id]).length,
    defs: DEFS
  };
})();
