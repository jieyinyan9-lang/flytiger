/* ============================================================
 * config.js —— 数值配置 / 敌人表 / 强化表 / 轮次节奏
 * ============================================================ */
(function () {
  'use strict';

  const CFG = {
    W: 960,
    H: 540,
    GROUND_Y: 470,          // 草原地面高度（天空活动区下界）
    TOP_Y: 40,

    player: {
      speed: 260,           // px/s
      baseHp: 100,
      baseDmg: 12,
      fireInterval: 0.12,   // 秒/发
      bulletSpeed: 620,     // px/s
      radius: 20,            // 碰撞半径基础值
      meleeDuration: 0.45,  // 近战持续
      meleeCooldown: 3.0,   // 近战冷却
      meleeDmg: 46,
      meleeRange: 78,
      invincibleTime: 0.9,  // 受击无敌
      maxSizeMul: 3.0       // 生命强化最大体型
    },

    /** 升级所需能量：无冷却锁，改为数值门槛递增 —— 线性 + 二次项，每次成长越来越难 */
    xpNeed(level) {
      return 14 + Math.floor(level * 4.5 + level * level * 0.35);
    },

    /** 轮次规则：击败 1 个 Boss = 通过 1 轮（round = bossCount + 1，见 game.js） */

    /** 自爆骷髅 */
    skeleton: {
      rushSpeed: 340,      // 入场冲刺速度
      chaseSpeed: 120,     // 降速后追击速度
      blastR: 92,          // 爆炸半径
      triggerD: 60         // 触发距离（接触玩家即爆）
    },

    /** 闪电子弹（闪电链） */
    chain: {
      range: 180,          // 链接搜索半径
      maxJumps: 6,         // 链接次数上限
      baseMul: 0.65,       // 首跳伤害系数（占子弹伤害）
      dmgPerLv: 0.25       // 每级"闪电强化"提升伤害系数
    },

    /** 防护刀刃（环绕光剑） */
    blade: {
      orbitR: 56,          // 环绕半径
      spin: 2.6,           // 角速度 rad/s
      hitR: 30,            // 刀刃碰撞半径
      blockR: 24,          // 挡弹判定半径
      blockChance: 0.5,    // 格挡概率
      maxBlades: 10,       // 光剑数量上限
      baseDmg: 26,         // 基础接触伤害
      dmgPerLv: 14         // 每级"刀刃强化"提升伤害
    },

    /** 敌人基础表（随轮次/时间由 spawner 再缩放）
     *  minBossKills：解锁所需击败 Boss 数 —— 初始仅蝙蝠/飞鹰，每击败 1 只 Boss 解锁 1 种新小怪 */
    enemies: {
      eagle: {
        name: '飞鹰', hp: 26, speed: 150, contact: 12,
        xp: 5, score: 10, radius: 16, weight: 10, minBossKills: 0, elite: false
      },
      bat: {
        name: '蝙蝠', hp: 14, speed: 190, contact: 8,
        xp: 3, score: 6, radius: 13, weight: 12, minBossKills: 0, elite: false
      },
      demon: {
        name: '飞天恶魔', hp: 40, speed: 95, contact: 14,
        bulletDmg: 10, xp: 7, score: 16, radius: 18, weight: 8, minBossKills: 1, elite: false
      },
      skeleton: {
        name: '自爆骷髅', hp: 22, speed: 340, contact: 20,
        xp: 6, score: 14, radius: 14, weight: 9, minBossKills: 1, elite: false, bomber: true
      },
      archer: {
        name: '小弓箭手', hp: 46, speed: 75, contact: 10,
        bulletDmg: 11, xp: 8, score: 18, radius: 15, weight: 7, minBossKills: 2, elite: false, ground: true
      },
      leigong: {
        name: '雷公', hp: 130, speed: 70, contact: 18,
        bulletDmg: 20, xp: 18, score: 40, radius: 26, weight: 4, minBossKills: 3, elite: true
      },
      pig: {
        name: '火焰飞猪', hp: 110, speed: 80, contact: 16,
        bulletDmg: 16, xp: 16, score: 36, radius: 26, weight: 4, minBossKills: 4, elite: true
      }
    },

    /** 强化选项表 */
    upgrades: [
      {
        id: 'life', icon: '❤', cls: 'c-life', name: '生命强化',
        desc: '最大生命 +30 并回复 30，飞虎体型成长（上限 3 倍）',
        can(p) { return true; },
        apply(p) {
          p.maxHp += 30;
          p.hp = Math.min(p.maxHp, p.hp + 30);
          if (p.sizeMul < 3.0) p.sizeMul = Math.min(3.0, +(p.sizeMul + 0.12).toFixed(2));
          p.lifeLv++;
        },
        level(p) { return p.lifeLv; }
      },
      {
        id: 'atk', icon: '⚔', cls: 'c-atk', name: '攻击强化',
        desc: '子弹伤害 +6，击杀效率提升',
        can() { return true; },
        apply(p) { p.dmg += 6; p.atkLv++; },
        level(p) { return p.atkLv; }
      },
      {
        id: 'way', icon: '※', cls: 'c-way', name: '弹道强化',
        desc: '子弹数量 +1，形成散射 / 多方向弹幕（上限 7 发）',
        can(p) { return p.bulletCount < 7; },
        apply(p) { p.bulletCount = Math.min(7, p.bulletCount + 1); p.wayLv++; },
        level(p) { return p.wayLv; }
      },
      {
        id: 'spd', icon: '➤', cls: 'c-spd', name: '弹速强化',
        desc: '子弹飞行速度 +15%，远距离压制力增强',
        can(p) { return p.bulletSpeedMul < 2.2; },
        apply(p) { p.bulletSpeedMul = +(p.bulletSpeedMul + 0.15).toFixed(2); p.spdLv++; },
        level(p) { return p.spdLv; }
      },
      {
        id: 'tier', icon: '✦', cls: 'c-tier', name: '子弹升级',
        desc: '普通弹升级为高阶强化弹：更大、更亮、附带穿透（共 3 阶）',
        can(p) { return p.bulletTier < 3; },
        apply(p) { p.bulletTier++; p.tierLv++; p.dmg += 4; },
        level(p) { return p.tierLv; }
      },
      {
        id: 'bomb', icon: '✺', cls: 'c-bomb', name: '爆炸弹',
        desc: '子弹命中后爆炸，对周围敌人造成范围伤害（范围/伤害递增）',
        can(p) { return p.bombLv < 6; },
        apply(p) { p.bombLv++; },
        level(p) { return p.bombLv; }
      },
      {
        id: 'heal', icon: '✚', cls: 'c-life', name: '回复体力',
        desc: '立即回复 60% 生命，重振虎威',
        can() { return true; },
        apply(p) { p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.6)); },
        level(p) { return -1; }
      },
      {
        id: 'magnet', icon: '◎', cls: 'c-spd', name: '引力领域',
        desc: '飞虎引力范围 +70，掉落能量会自动被吸纳（可叠加）',
        can(p) { return p.magnetRange < 460; },
        apply(p) { p.magnetRange += 70; p.magnetLv++; },
        level(p) { return p.magnetLv; }
      },
      {
        id: 'tail', icon: '◀', cls: 'c-way', name: '尾部弹道',
        desc: '解锁尾部炮管：额外增加一条向后射击的弹道',
        can(p) { return !p.tailWay; },
        apply(p) { p.tailWay = true; },
        level(p) { return p.tailWay ? 1 : 0; }
      },
      {
        id: 'down', icon: '▼', cls: 'c-spd', name: '下部弹道',
        desc: '解锁下部炮管：额外增加一条向下射击的弹道',
        can(p) { return !p.downWay; },
        apply(p) { p.downWay = true; },
        level(p) { return p.downWay ? 1 : 0; }
      },
      /* —— 第三轮后出现：闪电子弹（闪电链） —— */
      {
        id: 'chain', icon: '⚡', cls: 'c-way', name: '闪电子弹',
        desc: '解锁闪电子弹：子弹命中后释放闪电链，主动跳跃攻击附近敌人；再次选择提升闪电伤害',
        can(p, g) { return g && g.round >= 4; },
        apply(p) {
          if (!p.chainJumps) p.chainJumps = 1;
          p.chainDmgLv++;
        },
        level(p) { return p.chainDmgLv; }
      },
      {
        id: 'chainN', icon: '⛓', cls: 'c-way', name: '闪电链接',
        desc: '闪电链可链接的敌人数量 +1（在敌人间连续跳跃）',
        can(p, g) { return g && g.round >= 4 && p.chainJumps >= 1 && p.chainJumps < CFG.chain.maxJumps; },
        apply(p) { p.chainJumps++; },
        level(p) { return p.chainJumps; }
      },
      /* —— 第三轮后出现：防护刀刃（环绕光剑） —— */
      {
        id: 'blade', icon: '†', cls: 'c-spd', name: '防护刀刃',
        desc: '召唤一把光剑持续环绕飞虎：50% 概率格挡敌方子弹，并对接触敌人造成伤害；再次选择提升刀刃伤害',
        can(p, g) { return g && g.round >= 4; },
        apply(p) {
          if (!p.blades) p.blades = 1;
          p.bladeDmgLv++;
        },
        level(p) { return p.bladeDmgLv; }
      },
      {
        id: 'bladeN', icon: '‡', cls: 'c-spd', name: '刀刃环绕',
        desc: '环绕光剑数量 +1（最高 10 把），格挡与杀伤范围全面覆盖',
        can(p, g) { return g && g.round >= 4 && p.blades >= 1 && p.blades < CFG.blade.maxBlades; },
        apply(p) { p.blades++; },
        level(p) { return p.blades; }
      }
    ],

    /** 大招：强光波（击杀积累怒气，满槽释放） */
    ultimate: {
      rageMax: 100,
      rageNormal: 4,      // 普通小怪击杀怒气
      rageElite: 8,       // 精英小怪击杀怒气
      rageBoss: 25,       // 击杀 Boss 怒气
      bossDmgRatio: 0.2   // 对 Boss 造成其 20% 最大生命的伤害
    },

    boss: {
      warnTime: 2.6,
      firstMin: 38, firstMax: 60,      // 首个 Boss 出现时间（秒）
      nextMin: 45, nextMax: 75,       // 后续 Boss 间隔
      hpGrow: 0.05,                   // 每次 Boss 生命 +5%
      atkGrow: 0.05,                  // 每次 Boss 攻击 +5%
      roundHpMul: 0.09,               // 每轮额外血量系数
      /** 第 ord 只 Boss 的目标交战时长（秒）：20/30/40/50，第 5 只起 60-80 */
      fightTime(ord) {
        if (ord <= 4) return 10 + ord * 10;
        return 60 + Math.random() * 20;
      }
    }
  };

  window.CFG = CFG;
})();
