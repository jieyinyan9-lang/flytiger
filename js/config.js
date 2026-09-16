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
      baseDmg: 10,          // 小白基础伤害（其他角色按此基准增减）
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

    /** 升级所需能量：无冷却锁，数值门槛递增 —— 前紧后松曲线。
     *  前 3 级 40/49/60（首只 Boss 前约可升 3 次，避免开局快速成型）；
     *  累计到 23 级约 5800 经验，对齐一局（约 10 轮）可获取的能量，全程成长 22~25 次。 */
    xpNeed(level) {
      return 40 + Math.floor(level * 9 + level * level * 0.55);
    },

    /** 轮次规则：击败 1 个 Boss = 通过 1 轮（round = bossCount + 1，见 game.js） */

    /** 自爆骷髅（小黑骷髅）：接近玩家后停步预警，大范围自爆 */
    skeleton: {
      rushSpeed: 340,      // 入场冲刺速度
      chaseSpeed: 120,     // 降速后追击速度
      blastR: 132,         // 爆炸半径（大范围爆炸）
      triggerD: 150,       // 触发距离（接近即停步预警）
      windup: 0.9          // 引爆前原地预警时长（秒）
    },

    /** 防护罩：受伤概率激活；激活期间完全抵挡若干次伤害，破碎时释放金色冲击波 */
    shield: {
      baseChance: 0.30,     // 初始触发概率 30%
      maxChance: 0.70,      // 概率上限 70%
      activeTime: 8,        // 护罩激活后持续时间（秒，超时自动消散）
      /** 护罩强化 10 级成长表（索引即等级）：
       *  blocks：抵挡次数；wave：破碎冲击波 {kb 击退力, slow 减速秒, dmg 伤害}；
       *  radius：冲击波范围倍率；spd：护罩存在期间自身移速加成 */
      levels: [
        null,
        { blocks: 1 },                                                          // Lv1
        { blocks: 1, wave: { kb: 150 } },                                       // Lv2 破碎冲击波
        { blocks: 2, wave: { kb: 210 } },                                       // Lv3 抵挡+1、击退小幅提升
        { blocks: 2, wave: { kb: 210, slow: 1.0 } },                            // Lv4 冲击波减速 1s
        { blocks: 2, wave: { kb: 210, slow: 1.0 }, spd: 0.10 },                 // Lv5 护罩期间移速 +10%
        { blocks: 3, wave: { kb: 210, slow: 1.5 } },                            // Lv6 抵挡+1、减速 1.5s
        { blocks: 3, wave: { kb: 210, slow: 1.5 }, radius: 1.25 },              // Lv7 冲击波范围扩大
        { blocks: 3, wave: { kb: 210, slow: 1.5 }, radius: 1.25, spd: 0.15 },   // Lv8 移速加成 15%
        { blocks: 3, wave: { kb: 300, slow: 1.5 }, radius: 1.25, spd: 0.15 },   // Lv9 击退中幅提升
        { blocks: 3, wave: { kb: 300, slow: 2.0, dmg: 10 }, radius: 1.25, spd: 0.15 } // Lv10 减速 2s + 微量伤害
      ]
    },

    /** 炮师（地面抛射炮兵） */
    cannoneer: {
      shellG: 420,          // 炮弹重力
      blastR: 96,           // 爆炸半径
      blastDmg: 18          // 爆炸伤害
    },

    /** 斗兽场地面小怪（5 种专属单位）调参 */
    arena: {
      // 投掷奴
      javelin: {
        walkSpd: 70,        // 接近行走速度
        sprintSpd: 300,     // 锁定后助跑冲刺速度
        aimTime: 0.7,       // 助跑/瞄准时长
        cdMin: 3.4, cdMax: 4.6,  // 投枪间隔（低频）
        spearSpd: 430,      // 标枪速度
        spearR: 13,         // 标枪判定半径
        downTime: 1.0       // 击落玩家坠落时长（秒）
      },
      // 羊头斗士
      ram: {
        walkSpd: 92,
        sprintSpd: 250,     // 锁定助跑速度
        windup: 0.55,       // 起跳前助跑/下蹲时长
        leapUpV: 700,       // 起跳垂直初速（更高：apex≈163px）
        grav: 1500,         // 跳跃重力
        leapSpd: 260,       // 空中水平速度（跨距≈243px，慢而可预判）
        leapDmg: 30         // 空中撞击高额伤害
      },
      // 盾奴
      shieldSlave: {
        walkSpd: 52,
        stopRange: 420,     // 距玩家多远停下开始抛盾
        throwCd: 1.5,       // 抛盾间隔（持续投掷）
        shieldG: 360,       // 塔盾抛射重力
        shieldSpd: 300,     // 塔盾初速
        shieldR: 20         // 塔盾判定（大号）
      },
      // 皮影客
      puppet: {
        moveSpd: 135,       // 下方左右移动速度（对齐玩家 x）
        groundOff: 70,      // 在地面上方活动的高度偏移
        knifeCd: 0.55,      // 朝上投飞刀间隔
        knifeSpd: 430,      // 飞刀上投速度
        knifeR: 10          // 飞刀判定（更大）
      },
      // 自爆囚
      bomb: {
        walkSpd: 46,        // 缓慢行走
        midX: 0.5,          // 移向屏幕中线（比例）
        windup: 0.6,        // 起跳前蓄力（闪红预警）
        leapUpV: 520,
        grav: 1300,
        leapSpd: 330,       // 空中速度偏快但可预判
        blastR: 120,        // 自爆半径
        blastHpFrac: 0.4    // 命中玩家造成其最大生命 40% 的爆炸伤害
      }
    },

    /** 斧王召唤·西装斧头兵（bossOnly：仅斧王开场锁血期间召唤；高弧慢抛斧，死亡旋转飞天落地爆炸） */
    axeMinion: {
      count: 12,              // 开场召唤总数（一大批）
      lockTime: 6,            // 斧王开场锁血时长（秒）
      spawnGap: 0.38,         // 逐个错峰召唤间隔（秒）
      walkSpd: 52,            // 地面行进步速
      throwWind: 0.42,        // 抡斧前摇时长（秒）
      throwCdMin: 2.6, throwCdMax: 3.6,   // 抛斧间隔（慢节奏）
      axeSpd: 150,            // 水平参考速度（慢→飞行时间长）
      axeG: 480,              // 抛斧重力（大→弧线高）
      tMin: 1.1, tMax: 2.2,   // 飞行时间钳制（保证飞得高、到得慢）
      axeR: 9,                // 斧头判定半径
      blastR: 96,             // 死亡落地爆炸半径
      blastDmg: 12,           // 落地爆炸伤害（低）
      upV: 780,               // 死亡旋转飞天初速
      deathG: 1500,           // 死亡飞行重力
      spinSpd: 13             // 死亡自转角速度
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
      maxBlades: 4,        // 光剑数量上限
      maxLenLv: 2,         // 剑刃延展等级上限（2 级 = 3 倍长度）
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
      skull: {
        name: '飞天骷髅', hp: 34, speed: 110, contact: 12,
        bulletDmg: 12, xp: 8, score: 20, radius: 17, weight: 8, minBossKills: 1, elite: false
      },
      archer: {
        name: '小弓箭手', hp: 46, speed: 75, contact: 10,
        bulletDmg: 11, xp: 8, score: 18, radius: 30, weight: 7, minBossKills: 2, elite: false, ground: true
      },
      cannoneer: {
        name: '炮师', hp: 62, speed: 60, contact: 12,
        bulletDmg: 16, xp: 12, score: 26, radius: 36, weight: 7, minBossKills: 3, elite: false, ground: true
      },
      /* —— 斗兽场专属地面小怪（arenaOnly，仅斗兽场地图刷新；按 1~5 轮依次解锁） —— */
      // 1轮：投掷奴——锁定助跑后投出倒刺铁头标枪（击落玩家 1s），低频，动态血量 3s
      javelinSlave: {
        name: '投掷奴', hp: 60, speed: 80, contact: 12,
        bulletDmg: 14, xp: 14, score: 30, radius: 30, weight: 7, minBossKills: 0, elite: false,
        ground: true, arenaOnly: true, noKnockback: true,
        dynamicHp: true, fightTime: [3, 3]
      },
      // 2轮：羊头斗士——锁定助跑后跳跃撞击（高额伤害），落回中线再跳，白气拖尾，慢而可预判，动态血量 5s
      ramFighter: {
        name: '羊头斗士', hp: 90, speed: 95, contact: 12,
        xp: 18, score: 38, radius: 30, weight: 7, minBossKills: 1, elite: false,
        ground: true, arenaOnly: true, noKnockback: true,
        dynamicHp: true, fightTime: [5, 5]
      },
      // 3轮：盾奴——持续抛射大号塔盾（中等伤害、抛射弹道），动态血量 6s
      shieldSlave: {
        name: '盾奴', hp: 120, speed: 55, contact: 12,
        bulletDmg: 15, xp: 20, score: 42, radius: 34, weight: 7, minBossKills: 2, elite: false,
        ground: true, arenaOnly: true, noKnockback: true,
        dynamicHp: true, fightTime: [6, 6]
      },
      // 4轮：皮影客——下方左右移动对齐玩家，持续朝正上方投飞刀，动态血量 4s
      puppet: {
        name: '皮影客', hp: 70, speed: 130, contact: 10,
        bulletDmg: 11, xp: 16, score: 34, radius: 26, weight: 7, minBossKills: 3, elite: false,
        ground: true, arenaOnly: true, noKnockback: true,
        dynamicHp: true, fightTime: [4, 4]
      },
      // 5轮：自爆囚——移向中线后跳起撞击，命中闪红自爆（40%爆炸伤害），死亡/空中爆炸均波及周围敌人，动态血量 7s
      bombPrisoner: {
        name: '自爆囚', hp: 150, speed: 48, contact: 18,
        xp: 26, score: 56, radius: 34, weight: 7, minBossKills: 4, elite: false,
        ground: true, arenaOnly: true, bomber: true, noKnockback: true,
        dynamicHp: true, fightTime: [7, 7]
      },
      // 斧王专属：西装斧头兵（bossOnly，仅斧王开场锁血时召唤）——低血量，高弧慢速抛斧低伤；死亡旋转飞天、落地爆炸
      axeMinion: {
        name: '斧头兵', hp: 26, speed: 52, contact: 8,
        bulletDmg: 8, xp: 6, score: 14, radius: 22, weight: 0, minBossKills: 0, elite: false,
        ground: true, bossOnly: true, noKnockback: true
      },
      superboy: {
        name: '小超人', hp: 52, speed: 105, contact: 14,
        bulletDmg: 13, xp: 10, score: 24, radius: 24, weight: 6, minBossKills: 2, elite: false
      },
      leigong: {
        name: '雷公', hp: 130, speed: 70, contact: 18,
        bulletDmg: 20, xp: 18, score: 40, radius: 26, weight: 4, minBossKills: 3, elite: true
      },
      pig: {
        name: '火焰飞猪', hp: 330, speed: 80, contact: 16,
        bulletDmg: 16, xp: 16, score: 36, radius: 36, weight: 4, minBossKills: 4, elite: true
      },
      bigbat: {
        name: '大型蝙蝠', hp: 90, speed: 100, contact: 18,
        bulletDmg: 12, xp: 18, score: 42, radius: 30, weight: 4, minBossKills: 3, elite: true,
        dynamicHp: true, fightTime: [6, 8]   // 动态血量：锁血已移除、全程可承伤，反推血量保证墙钟交战 6-8 秒
      },
      grassdragon: {
        name: '草龙', hp: 26, speed: 150, contact: 16,
        bulletDmg: 12, xp: 3, score: 80, radius: 14, weight: 5, minBossKills: 1, elite: true,
        oncePerRound: true   // 每轮至多出现一次（第 2 轮起解锁）
      },
      /* —— 飞行弹幕类敌人：通过指定关卡后，每轮 30% 概率解锁其中 1 只 —— */
      // 弱型｜基础弹幕（通过第 2 关后解锁，动态血量保证至少 7s 击杀，占本轮 20%）
      spikebird: {
        name: '刺羽鸟', hp: 1, speed: 115, contact: 10,
        bulletDmg: 8, xp: 9, score: 20, radius: 16, weight: 7, minBossKills: 2, elite: false,
        flyer: true, flyerTier: 'weak', group: 5
        // 玻璃大炮：不再使用动态血量，生命固定为 1，基本一触即死
      },
      eyefly: {
        name: '魔眼飞虫', hp: 40, speed: 135, contact: 8,
        bulletDmg: 9, xp: 9, score: 20, radius: 15, weight: 7, minBossKills: 2, elite: false,
        flyer: true, flyerTier: 'weak',
        dynamicHp: true, fightTime: [7, 7]
      },
      // 中型｜强化弹幕（通过第 3 关后解锁，动态血量保证至少 10s 击杀，占本轮 10%）
      stonebeetle: {
        name: '魔石甲虫', hp: 72, speed: 95, contact: 14,
        bulletDmg: 15, xp: 15, score: 32, radius: 22, weight: 4, minBossKills: 3, elite: false,
        flyer: true, flyerTier: 'medium',
        dynamicHp: true, fightTime: [10, 10]
      },
      floatflower: {
        name: '浮空魔花', hp: 78, speed: 70, contact: 12,
        bulletDmg: 12, xp: 15, score: 32, radius: 24, weight: 4, minBossKills: 3, elite: false,
        flyer: true, flyerTier: 'medium',
        dynamicHp: true, fightTime: [10, 10]
      },
      stormfish: {
        name: '风暴飞鱼', hp: 70, speed: 105, contact: 13,
        bulletDmg: 12, xp: 15, score: 32, radius: 22, weight: 4, minBossKills: 3, elite: false,
        flyer: true, flyerTier: 'medium',
        dynamicHp: true, fightTime: [10, 10]
      },
      // 强型｜特殊弹幕（通过第 4 关后解锁，动态血量保证至少 18s 击杀，占本轮 20%）
      twinsnake: {
        name: '双头飞蛇', hp: 135, speed: 82, contact: 18,
        bulletDmg: 14, xp: 24, score: 55, radius: 28, weight: 6, minBossKills: 4, elite: true,
        flyer: true, flyerTier: 'strong',
        dynamicHp: true, fightTime: [18, 18]
      },
      owl: {
        name: '预言猫头鹰', hp: 125, speed: 78, contact: 16,
        bulletDmg: 13, xp: 24, score: 55, radius: 26, weight: 6, minBossKills: 4, elite: true,
        flyer: true, flyerTier: 'strong', noKnockback: true,
        dynamicHp: true, fightTime: [18, 18]
      }
    },

    /** 强化选项表 */
    upgrades: [
      {
        id: 'life', icon: '❤', cls: 'c-life', name: '生命强化',
        desc: '最大生命 +30 并回复 30，飞喵体型成长（上限 3 倍）',
        can(p) { return true; },
        apply(p) {
          p.maxHp += 30;
          p.hp = Math.min(p.maxHp, p.hp + 30);
          if (p.sizeMul < 3.0) {
            p.sizeMul = Math.min(3.0, +(p.sizeMul + 0.12).toFixed(2));
          }
          p.lifeLv++;
        },
        level(p) { return p.lifeLv; }
      },
      {
        id: 'atk', icon: '⚔', cls: 'c-atk', name: '攻击强化',
        desc: '子弹伤害 +6，击杀效率提升（上限 12 级）',
        can(p) { return (p.atkLv || 0) < 12; },
        apply(p) { p.dmg += 6; p.atkLv++; },
        level(p) { return p.atkLv; }
      },
      {
        id: 'way', icon: '※', cls: 'c-way', name: '弹道强化',
        desc(p, g) {
          const cap = g ? this.wayCap(g.round) : 20;
          return `子弹数量 +1，形成散射 / 多方向弹幕（本轮上限 ${cap} 发，最终上限 20 发）`;
        },
        wayCap(round) { return round <= 4 ? 7 : (round <= 7 ? 12 : 20); },
        can(p, g) {
          const cap = g ? this.wayCap(g.round) : 20;   // 无游戏上下文（如外部预览）时按最终上限
          return p.bulletCount < cap;
        },
        apply(p) { p.bulletCount++; p.wayLv++; },
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
        id: 'tier', icon: '✦', cls: 'c-tier', name: '子弹升级', charOnly: 'xiaobai',
        desc: '普通弹升级为高阶强化弹：更大、更亮、附带穿透（3 阶，分别在第 1/3/5 轮出现）',
        can(p, g) {
          if (p.bulletTier >= 3) return false;
          // 下一阶要求轮次：1阶第1轮、2阶第3轮、3阶第5轮
          const needRound = p.bulletTier === 0 ? 1 : (p.bulletTier === 1 ? 3 : 5);
          return !g || g.round >= needRound;
        },
        apply(p) { p.bulletTier++; p.tierLv++; p.dmg += 4; },
        level(p) { return p.tierLv; }
      },
      {
        id: 'bomb', icon: '✺', cls: 'c-bomb', name: '爆炸弹',
        desc: '子弹命中后爆炸，对周围敌人造成范围伤害（范围/伤害递增；第 2 轮起每轮可升 1 阶，共 6 阶）',
        can(p, g) {
          if (p.bombLv >= 6) return false;
          // 第 bombLv 阶需在第 (2+bombLv) 轮才出现：2/3/4/5/6/7 轮各 1 阶
          return !g || g.round >= 2 + p.bombLv;
        },
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
        desc: '飞喵引力范围 +70，掉落能量会自动被吸纳（可叠加）',
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
        desc: '闪电链可链接的敌人数量 +2（在敌人间连续跳跃）',
        can(p, g) { return g && g.round >= 4 && p.chainJumps >= 1 && p.chainJumps < CFG.chain.maxJumps; },
        apply(p) { p.chainJumps = Math.min(CFG.chain.maxJumps, p.chainJumps + 2); },
        level(p) { return p.chainJumps; }
      },
      /* —— 第三轮后出现：防护刀刃（环绕光剑） —— */
      {
        id: 'blade', icon: '†', cls: 'c-spd', name: '防护刀刃',
        desc: '召唤一把光剑持续环绕飞喵：50% 概率格挡敌方子弹，并对接触敌人造成伤害；再次选择提升刀刃伤害',
        can(p, g) { return g && g.round >= 4; },
        apply(p) {
          if (!p.blades) p.blades = 1;
          p.bladeDmgLv++;
        },
        level(p) { return p.bladeDmgLv; }
      },
      {
        id: 'bladeN', icon: '‡', cls: 'c-spd', name: '刀刃环绕',
        desc: '环绕光剑数量 +1（最高 4 把），格挡与杀伤范围全面覆盖',
        can(p, g) { return g && g.round >= 4 && p.blades >= 1 && p.blades < CFG.blade.maxBlades; },
        apply(p) { p.blades++; },
        level(p) { return p.blades; }
      },
      {
        id: 'bladeL', icon: '╏', cls: 'c-spd', name: '剑刃延展',
        desc: '环绕光剑长度翻倍（最长 3 倍），杀伤与格挡距离大幅延伸',
        can(p, g) { return g && g.round >= 4 && p.blades >= 1 && (p.bladeLenLv || 0) < CFG.blade.maxLenLv; },
        apply(p) { p.bladeLenLv = (p.bladeLenLv || 0) + 1; },
        level(p) { return p.bladeLenLv || 0; }
      },
      /* —— 移动速度强化 —— */
      {
        id: 'spdMove', icon: '»', cls: 'c-spd', name: '移动速度',
        desc: '飞喵飞行速度 +12%，机动性大幅提升（最高 +60%）',
        can(p) { return (p.moveSpdLv || 0) < 5; },
        apply(p) { p.moveSpdLv = (p.moveSpdLv || 0) + 1; },
        level(p) { return p.moveSpdLv || 0; }
      },
      /* —— 防护罩：解锁 + 两条成长线 —— */
      {
        id: 'shield', icon: '◈', cls: 'c-life', name: '防护罩',
        desc: '受到伤害时 30% 概率激活金色护罩：完全抵挡 1 次伤害；可通过护罩强化成长',
        can(p) { return !p.shieldLv; },
        apply(p) {
          p.shieldLv = 1;
          p.shieldChance = CFG.shield.baseChance;
          p.shieldRLv = 1;       // 解锁即 1 级（抵挡 1 次）
        },
        level(p) { return p.shieldLv; }
      },
      {
        id: 'shieldC', icon: '◉', cls: 'c-life', name: '护罩感应',
        desc: '防护罩触发概率 +10%（最高 70%）',
        can(p) { return p.shieldLv >= 1 && p.shieldChance < CFG.shield.maxChance - 0.001; },
        apply(p) { p.shieldChance = Math.min(CFG.shield.maxChance, p.shieldChance + 0.10); },
        level(p) { return Math.round(p.shieldChance * 100 / 10) - 3; }
      },
      {
        id: 'shieldR', icon: '⬢', cls: 'c-life', name: '护罩强化',
        desc(p) {
          const lv = Math.min(10, (p.shieldRLv || 1) + 1);
          const L = CFG.shield.levels[lv] || {};
          let s = `护罩强化 ${lv}/10 级：抵挡 ${L.blocks} 次伤害`;
          if (L.wave) {
            s += '；破碎冲击波击退小怪';
            if (L.wave.slow) s += `并减速 ${L.wave.slow}s`;
            if (L.wave.dmg) s += `、造成 ${L.wave.dmg} 点伤害`;
          }
          if (L.radius) s += '；冲击波范围扩大';
          if (L.spd) s += `；护罩期间移速 +${Math.round(L.spd * 100)}%`;
          return s;
        },
        can(p) { return p.shieldLv >= 1 && (p.shieldRLv || 1) < 10; },
        apply(p) { p.shieldRLv = Math.min(10, (p.shieldRLv || 1) + 1); },
        level(p) { return p.shieldRLv || 0; }
      },
      /* —— 额外生命 —— */
      {
        id: 'lifeUp', icon: '✦', cls: 'c-life', name: '额外生命',
        desc: '生命条数 +1（上限 3 条），阵亡时消耗一条原地重生',
        can(p) { return p.lives < 3; },
        apply(p) { p.lives++; },
        level(p) { return p.lives; }
      },
      /* —— 元素弹道（击败 Boss 后解锁，总最多 3 条，FIFO 替换最早获得的） —— */
      // 选新弹道时如果已有 3 条，移除最早获得的那条（队首），新弹道加入队尾
      // 某种弹道已有 3 条（即队列全是它）时，该成长项不再出现
      {
        id: 'flame', icon: '🔥', cls: 'c-atk', name: '火焰弹道',
        desc: '额外增加一条火焰弹道。命中后 3s 持续伤害，1s 破解敌人无敌。满 3 条时替换最早弹道',
        can(p, g) {
          const cnt = p.elementWay.filter(x => x === 'flame').length;
          if (cnt >= 3) return false;       // 队列全是火焰，不再出现
          if (cnt === 0) return true;
          return Math.random() < 0.20;      // 中低概率
        },
        apply(p) {
          if (p.elementWay.length >= 3) p.elementWay.shift();  // 满三条时销毁最早获得的一条
          p.elementWay.push('flame');
        },
        level(p) { return p.elementWay.filter(x => x === 'flame').length; },
        guaranteed(p, g) { return g.bossCount >= 1 && p.elementWay.indexOf('flame') < 0; }
      },
      {
        id: 'poison', icon: '☠', cls: 'c-atk', name: '毒液弹道',
        desc: '额外增加一条毒液弹道。命中后 6s 持续伤害，3s 破解敌人无敌。满 3 条时替换最早弹道',
        can(p, g) {
          const cnt = p.elementWay.filter(x => x === 'poison').length;
          if (cnt >= 3) return false;
          if (cnt === 0) return true;
          return Math.random() < 0.20;
        },
        apply(p) {
          if (p.elementWay.length >= 3) p.elementWay.shift();
          p.elementWay.push('poison');
        },
        level(p) { return p.elementWay.filter(x => x === 'poison').length; },
        guaranteed(p, g) { return g.round >= 2 && p.elementWay.indexOf('poison') < 0; }
      },
      {
        id: 'ice', icon: '❄', cls: 'c-spd', name: '寒冰弹道',
        desc: '额外增加一条寒冰弹道。命中后 2s 持续伤害，冻结敌人 4s。满 3 条时替换最早弹道',
        can(p, g) {
          const cnt = p.elementWay.filter(x => x === 'ice').length;
          if (cnt >= 3) return false;
          if (cnt === 0) return true;
          return Math.random() < 0.20;
        },
        apply(p) {
          if (p.elementWay.length >= 3) p.elementWay.shift();
          p.elementWay.push('ice');
        },
        level(p) { return p.elementWay.filter(x => x === 'ice').length; },
        guaranteed(p, g) { return g.round >= 4 && p.elementWay.indexOf('ice') < 0; }
      },
      /* —— 元素精通（需先拥有对应元素弹道；异常流 build 的独立成长线） —— */
      {
        id: 'flameM', icon: '🔥', cls: 'c-atk', name: '烈焰精通',
        desc(p) {
          const lv = p.elemLv.flame || 0;
          const pct = Math.round((0.40 + 0.15 * lv) * 100);
          return `火焰异常强化 ${lv}/3：灼烧秒伤提升至子弹伤害的 ${pct}%，持续 ${3 + 0.5 * lv}s；重复命中可叠层（最多5层）`;
        },
        can(p) { return p.elementWay.indexOf('flame') >= 0 && (p.elemLv.flame || 0) < 3; },
        apply(p) { p.elemLv.flame = (p.elemLv.flame || 0) + 1; },
        level(p) { return p.elemLv.flame || 0; }
      },
      {
        id: 'poisonM', icon: '☠', cls: 'c-atk', name: '剧毒精通',
        desc(p) {
          const lv = p.elemLv.poison || 0;
          const pct = Math.round((0.25 + 0.10 * lv) * 100);
          return `毒液异常强化 ${lv}/3：中毒秒伤提升至子弹伤害的 ${pct}%，持续 ${6 + lv}s；重复命中可叠层（最多5层）`;
        },
        can(p) { return p.elementWay.indexOf('poison') >= 0 && (p.elemLv.poison || 0) < 3; },
        apply(p) { p.elemLv.poison = (p.elemLv.poison || 0) + 1; },
        level(p) { return p.elemLv.poison || 0; }
      },
      {
        id: 'iceM', icon: '❄', cls: 'c-spd', name: '寒冰精通',
        desc(p) {
          const lv = p.elemLv.ice || 0;
          const pct = Math.round((0.30 + 0.10 * lv) * 100);
          return `寒冰异常强化 ${lv}/3：冰晶秒伤提升至子弹伤害的 ${pct}%，冻结延长至 ${4 + 0.5 * lv}s；重复命中可叠层（最多5层）`;
        },
        can(p) { return p.elementWay.indexOf('ice') >= 0 && (p.elemLv.ice || 0) < 3; },
        apply(p) { p.elemLv.ice = (p.elemLv.ice || 0) + 1; },
        level(p) { return p.elemLv.ice || 0; }
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
      atkGrow: 0.05,                  // 每次 Boss 攻击 +5%
      /** 第 ord 只 Boss 的目标交战时长（秒）：30s 起步，每只 +3.2s，58s 封顶 */
      fightTime(ord) {
        return Math.min(58, Math.round(30 + (ord - 1) * 3.2));
      },
      /** 参考 DPS 曲线：设计预期玩家在第 ord 只 Boss 时"正常成长"应有的理论秒伤
       *  （口径含 0.55 命中率折减，与 playerDps() 一致；为固定设计值，不读玩家实际强度）。
       *  Boss 血量以该曲线为锚，不再按玩家 DPS 1:1 反推——玩家堆成长→击杀更快，成长有体感。 */
      refDps: [90, 230, 385, 550, 725, 905, 1090, 1280, 1475, 1675],
      refDpsAt(ord) {
        const t = this.refDps;
        const i = Math.max(1, ord) - 1;
        if (i < t.length) return t[i];
        // 无尽模式（第 10 只之后）：参考 DPS 每只 +12%
        return t[t.length - 1] * Math.pow(1.12, i - t.length + 1);
      },
      /** 软追赶系数：玩家 DPS 偏离参考值时，血量只追赶 45%。
       *  ratio=1（正常成长）=>1；ratio=2（双倍养成）=>1.405（实际击杀≈0.70×目标时长）；
       *  ratio=0.5（没养成）=>0.775（实际击杀≈1.55×目标时长，吃力但不会完全打不动） */
      hpSoftMul(ratio) {
        const r = Math.max(0.45, Math.min(1.9, ratio));
        return 0.55 + 0.45 * r;
      },
      /** 逐轮刷怪段节奏 [Tmin, Tmax, K]：
       *  本轮刷怪时间 ≥ Tmin 且累计击杀 ≥ K → 提前召唤 Boss（清怪越快出得越早）；
       *  到 Tmax 仍未达标则强制召唤（防空转卡死）。时长分层由此实现：
       *  高手压 Tmin、中手落在 Tmin~Tmax、慢手吃满 Tmax 且 Boss 战更久。 */
      roundSchedule: [
        [45, 75, 14],    // 第1轮
        [55, 90, 18],    // 第2轮
        [65, 105, 22],   // 第3轮
        [75, 120, 26],   // 第4轮
        [90, 140, 30],   // 第5轮
        [90, 140, 34],   // 第6轮
        [100, 155, 38],  // 第7轮（进攻手段大致在本轮前后拉满 ≈ 全程70%）
        [100, 155, 42],  // 第8轮
        [110, 170, 46],  // 第9轮
        [110, 170, 50]   // 第10轮
      ],
      roundSchedAt(round) {
        const t = this.roundSchedule;
        const r = Math.max(1, round);
        if (r <= t.length) return t[r - 1];
        // 无尽模式（10轮之后）：间隔与击杀门槛微增，封顶防空转
        const ex = r - t.length;
        const last = t[t.length - 1];
        return [Math.min(200, last[0] + ex * 6), Math.min(260, last[1] + ex * 8), Math.min(70, last[2] + ex * 2)];
      }
    },

    /** 元素精通成长：元素弹命中后 DoT 秒伤 = 子弹命中伤害 × (dpsBase + dpsPerLv×精通等级)
     *  精通等级 0-3（通过三选一「元素精通」卡成长）；同种异常可叠层 5 层（每层 +12%，见 game.applyElement） */
    elementMaster: {
      flame:  { dpsBase: 0.40, dpsPerLv: 0.15, durBase: 3, durPerLv: 0.5 },
      poison: { dpsBase: 0.25, dpsPerLv: 0.10, durBase: 6, durPerLv: 1 },
      ice:    { dpsBase: 0.30, dpsPerLv: 0.10, durBase: 2, durPerLv: 0.5, freezeBase: 4, freezePerLv: 0.5 }
    },

    /** 地图表：每次进入游戏随机刷新一张；阻碍特性与草地相同（撞击掉 30% 生命并碎裂 / 地面单位免疫 / 可被炮弹炸毁）
     *  colosseum 罗马角斗场为特殊地图：不参与随机抽取（仅主界面主动选择进入），
     *  死亡复活不会离开角斗场、其它地图死亡也不会随机进来 */
    maps: [
      { id: 'grassland', name: '飞喵草原', icon: '🌿' },
      { id: 'desert',    name: '沙漠',       icon: '🏜️', obs: ['cactusT', 'cactusM', 'cactusL'] },
      { id: 'snow',      name: '雪地',       icon: '❄️', obs: ['iceWall', 'iceSpire', 'iceT', 'iceM', 'iceL'], obsTop: ['icicleXL', 'icicleT', 'icicleM', 'icicleL'], gap: [2.3, 3.6], haz: { type: 'blizzard', n: [3, 4] } },
      { id: 'volcano',   name: '火焰山',     icon: '🌋', obs: ['vrockT', 'vrockM', 'vrockL'], crater: true },
      { id: 'wasteland', name: '紫色荒地',   icon: '🌆', obs: ['treeT', 'treeM', 'treeL'] },
      { id: 'cyber',     name: '霓虹喵都',   icon: '🏙️', obs: ['poleT', 'boothL', 'buildM'], scrollMul: 2 },
      { id: 'ocean',     name: '大海',       icon: '🌊', obs: ['reefT', 'reefM', 'coralL'], sea: true },
      { id: 'colosseum', name: '罗马角斗场', icon: '⚔️', obs: ['spikeT', 'spikeM', 'spikeL'], arena: true },
      // —— 新版图：障碍物上下交错（obs 地面 / obsTop 顶部悬挂），Boss 与怪物潮期间障碍降密度、机关停用 ——
      // 1 丛林：墨绿潮湿密林，扭曲巨树/藤帘/蕨丛；无机关
      { id: 'jungle',    name: '丛林',       icon: '🌴', obs: ['jTrunkXL', 'jTrunkT', 'jTrunkM', 'jLeafL'], obsTop: ['jVineXL', 'jVineT', 'jVineM', 'jVineL'], gap: [1.9, 3.0] },
      // 2 海底：深蓝通透水下；纵向下行水流（每轮 2-3 次，可逆向游动对抗）
      { id: 'seabed',    name: '海底',       icon: '🐠', obs: ['sbReefXL', 'sbReefT', 'sbReefM', 'sbCoralL'], obsTop: ['sbKelpXL', 'sbKelpT', 'sbKelpM', 'sbKelpL'], gap: [2.3, 3.6], haz: { type: 'current', n: [2, 3] } },
      // 4 城堡：夕阳金城，规整石墙塔楼/尖锥巨塔；破碎障碍=军事塔楼（每轮 72% 概率 1 座，20 击爆）
      { id: 'castle',    name: '城堡',       icon: '🏰', obs: ['cwXL', 'cwT', 'cwM', 'cwL'], obsTop: ['cwTopXL', 'cwTopT', 'cwTopM', 'cwTopL'], gap: [1.5, 2.5],
        brk: [{ id: 'bkTower', n: [1, 1], p: 0.72 }] },
      // 5 天空：阴沉雷云，浮石断柱/巨型浮岛；地面为起伏云海（cloudSea，会上升）；斜向落雷（每轮 2-3 次，途径者损失一半当前生命，可躲避）
      // 破碎障碍=巨大建筑残骸（每轮 1-2 座，漂浮屏中，20 击爆）
      { id: 'sky',       name: '天空',       icon: '🌩️', obs: ['flXL', 'flT', 'flM', 'flL'], obsTop: ['flTopXL', 'flTopT', 'flTopM', 'flTopL'], gap: [2.4, 3.8], cloudSea: true, haz: { type: 'lightning', n: [2, 3] },
        brk: [{ id: 'bkWreck', n: [1, 2] }] },
      // 6 仙人洞：冷灰几何洞天；移动方石沿固定路线环行（每轮 2-3 次）
      // 破碎障碍=持续转动白色魔方（每轮 2-3 座，漂浮屏中，25 击爆）
      { id: 'cave',      name: '仙人洞',     icon: '🤍', obs: ['cbXL', 'cbT', 'cbM', 'cbL'], obsTop: ['cbTopXL', 'cbTopT', 'cbTopM', 'cbTopL'], gap: [2.0, 3.1], haz: { type: 'caveblock', n: [2, 3] },
        brk: [{ id: 'bkCube', n: [2, 3] }] },
      // 7 群山：青灰苍茫，尖峰/双峰/平顶山台/石笋/迎客松；无地平线、无地面敌人、无斧王；无机关
      // 破碎障碍：巨大尖锐山峰（每轮 75% 概率 1 座，25 击爆）+ 低矮宽阔山峰（每轮 2-3 座，20 击爆）
      { id: 'mountains', name: '群山',       icon: '⛰️', obs: ['mtPeak', 'mtTwin', 'mtPine', 'mtMesa', 'mtSpire'], obsTop: ['mtTopPeak', 'mtTopTwin', 'mtTopMesa', 'mtTopSpire'], gap: [3.0, 4.8],
        brk: [{ id: 'bkPeak', n: [1, 1], p: 0.75 }, { id: 'bkMesa', n: [2, 3] }] },
      // 8 魔窟：黑蓝深紫洞窟，钟乳石/石笋/妖火；无机关
      // 破碎障碍=幽蓝荧光枯木（3 样式随机，每轮 2-3 株，30 击爆）
      { id: 'demoncave', name: '魔窟',       icon: '🔮', obs: ['dcXL', 'dcT', 'dcM', 'dcL'], obsTop: ['dcTopXL', 'dcTopT', 'dcTopM', 'dcTopL'], gap: [2.4, 3.7],
        brk: [{ id: 'bkWood', n: [2, 3], styles: 3 }] },
      // 9 矩阵：黑底荧光绿数据空间；移动数据墙实体(红)/虚拟交替（每轮 1-2 次，实体接触损失 80% 当前生命）
      { id: 'matrix',    name: '矩阵',       icon: '💾', obs: ['mxXL', 'mxT', 'mxM', 'mxL'], obsTop: ['mxTopXL', 'mxTopT', 'mxTopM', 'mxTopL'], gap: [1.9, 3.0], haz: { type: 'datawall', n: [1, 2] } },
      // 月痕沙海：特殊关卡（不参与随机抽取，仅可从「发现秘境」面板进入，通关后入口消失）；夜晚玫红沙漠、缺角月亮漏沙、金字塔与骸骨
      { id: 'moondesert', name: '月痕沙海', icon: '🌙', obs: ['cactusT', 'cactusM', 'cactusL'], stage: true, desert: true }
    ],

    /** 月痕沙海关卡参数 */
    moondesert: {
      duration: 360,          // 关卡总时长 6 分钟
      waveCount: 2,           // 中途怪物潮次数
      waveDur: 30,            // 每次怪物潮 30 秒
      waveTime: [120, 240],   // 第 2 分钟 / 第 4 分钟触发怪物潮
      boss: 'Sphinx',         // 最终 Boss：狮身人面像
      // 按关卡时间解锁的小怪：到点保底刷出（horde 只一次群体），之后加入随机池
      spawnSchedule: [
        { t: 30,  type: 'demon' },        // 飞天恶魔
        { t: 60,  type: 'archer' },       // 小弓箭手
        { t: 90,  type: 'eyefly' },       // 魔眼飞虫
        { t: 120, type: 'puppet' },       // 皮影客（与第 1 次怪物潮同时）
        { t: 200, type: 'owl' },          // 预言猫头鹰
        { t: 230, type: 'ramFighter', horde: 8 }   // 大量羊头斗士蜂拥而来
      ]
    },

    /** 地图特殊机制参数 */
    map: {
      craterInterval: 5.0,    // 火山口喷发间隔（秒）
      craterRumble: 0.9,      // 喷发前蓄力预警时长
      lavaR: 20,              // 巨大火焰子弹半径
      lavaDmg: 20,            // 火焰子弹基础伤害（随 atkScale 成长）
      lavaBlastR: 108,        // 落地爆炸半径
      seaSurgeInterval: 10.0, // 大海波动触发间隔（秒）
      seaSurgeDur: 4.0,       // 波动持续时长
      seaRise: 56,            // 波动期间海平面上升高度
      seaAmp: 6,              // 平时波浪幅度
      seaSurgeAmp: 22,        // 波动期间波浪幅度
      seaDmg: 5,              // 接触海水掉血量（很少）
      seaTick: 0.5,           // 海水掉血间隔（秒）
      // 天空·云海地面（cloudSea）参数
      cloudSurgeInterval: 12.0, // 云涌触发间隔（秒）
      cloudSurgeDur: 5.0,       // 云涌持续时长
      cloudRise: 70,            // 云涌期间云层整体上升高度
      cloudAmp: 10,             // 平时云面起伏幅度
      cloudSurgeAmp: 26,        // 云涌期间云面翻滚幅度
      // 罗马角斗场专属规则
      arenaBossTimeMul: 0.5,  // Boss 出现间隔减半
      arenaGroundWeight: 3,   // 地面类小怪（弓箭手/炮师）刷出权重 ×3
      arenaTideTime: 60,      // 怪物潮时长（普通地图 30s 的 2 倍），每过 1 轮触发一次
      // —— 新地图机关（Boss/怪物潮期间不触发，已出现的移动机关立即撤除）——
      haz: {
        current:   { warn: 1.2, dur: 3.4, w: 130, fy: 205 },                 // 海底纵向下行水流
        blizzard:  { warn: 1.0, dur: 4.4, vx: 300, fx: -125, fy: 185 },      // 雪地斜向暴风雪（右上→左下）
        lightning: { warn: 1.3, strike: 0.32, band: 38, ratio: 0.5 },        // 天空斜向落雷：一半当前生命
        caveblock: { loop: 6.5 },                                            // 仙人洞方石环行周期
        datawall:  { warn: 1.0, vx: 64, w: 66, gap: 152, phase: 2, ratio: 0.8 } // 矩阵数据墙实体/虚拟各 2s
      },
      bossRockGap: [4.5, 8.0]   // Boss/怪物潮期间障碍刷出间隔（大幅降低密度）
    }
  };

  window.CFG = CFG;
})();
