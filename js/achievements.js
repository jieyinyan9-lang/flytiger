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
    chaoren: '超级小子 —— 全场C位',
    meiying: '魅影 —— 幽冥来客'
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

    /* ============ 👻 魅影 —— 幽冥来客 ============ */
    { id: 'my_soul',    cat: 'meiying', icon: '👻', name: '「幽魂引路」',   desc: '使用幽魂弹累计击杀30个敌人' },
    { id: 'my_pierce',  cat: 'meiying', icon: '🔮', name: '「一弹三魂」',   desc: '一发幽魂弹连续穿透击杀3个敌人' },
    { id: 'my_night',   cat: 'meiying', icon: '🌙', name: '「百鬼夜行」',   desc: '首次释放百鬼夜行' },
    { id: 'my_night20', cat: 'meiying', icon: '💀', name: '「群鬼盛宴」',   desc: '一次百鬼夜行击杀20个以上敌人' },
    { id: 'my_boss',    cat: 'meiying', icon: '⚰️', name: '「阎王三更」',   desc: '百鬼夜行期间击败Boss' },
    { id: 'my_round10', cat: 'meiying', icon: '🌌', name: '「冥界漫步」',   desc: '使用魅影到达第10轮' },

    /* ============ ✨ 英雄觉醒子弹成就 ============ */
    { id: 'aw_first',    cat: 'awaken', icon: '✨', name: '「觉醒！」',       desc: '首次完成英雄子弹风格觉醒' },
    { id: 'aw_form2',    cat: 'awaken', icon: '🔷', name: '「形态跃迁」',     desc: '任意风格成长至第2形态' },
    { id: 'aw_form4',    cat: 'awaken', icon: '🔶', name: '「终极形态」',     desc: '任意风格成长至第4形态' },
    { id: 'aw_max',      cat: 'awaken', icon: '💠', name: '「风格圆满」',     desc: '单条风格线12次成长全部完成' },
    { id: 'aw_styles5',  cat: 'awaken', icon: '🎭', name: '「风格鉴赏家」',   desc: '累计觉醒5种不同的子弹风格' },
    { id: 'aw_allheroes',cat: 'awaken', icon: '🌟', name: '「全员觉醒」',     desc: '7名英雄全部完成过风格觉醒' },
    { id: 'aw_boss',     cat: 'awaken', icon: '💥', name: '「觉醒之威」',     desc: '风格觉醒后击败Boss' },

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

  /* ============ 🏆 全Boss讨伐成就（24 只逐一讨伐 + 总览） ============
   * 数据：[类名, 显示名, 评级]；评级决定图标，顺序同 Boss 挑战面板 */
  const RATING_ICON = { 'B+': '🥉', 'A': '🥈', 'A+': '🥇', 'S': '🏅', 'SS': '🔱', 'SSS': '👑' };
  const BOSS_DEFEAT_LIST = [
    ['PigKing', '火焰飞猪王', 'B+'], ['ThunderBehemoth', '雷公巨兽', 'B+'],
    ['GiantPheasant', '火鸡王', 'A+'], ['DogKing', '飞天狗王', 'B+'],
    ['SwordEagle', '铁鹰', 'SS'], ['Samurai', '赤鬼', 'S'],
    ['SkullKing', '亡灵骷髅王', 'A'], ['Stranger', '怪客', 'A'],
    ['MadHyena', '癫狂鬣狗', 'A'], ['SandWalker', '沙之行者', 'A'],
    ['FrogKing', '蛙哥', 'A+'], ['BossMan', '斧王', 'S'],
    ['Homelander', '怒星使', 'A+'], ['NiuMo', '牛魔', 'SSS'],
    ['CaptainGeorge', '乔治船长', 'A+'], ['FireBlind', '火遮眼', 'A+'],
    ['CraneSage', '鹤仙', 'S'], ['Sphinx', '狮身人面像', 'SSS'],
    ['RaccoonRover', '浣熊漫游者', 'A+'], ['PurpleHand', '紫手', 'A+'],
    ['BoneDragonKing', '巨型骨龙王', 'SSS'], ['SeaBully', '深海恶霸', 'A+'],
    ['SnowWitch', '雪巫', 'A+'], ['CrowCount', '鸦伯爵', 'A+']
  ];
  BOSS_DEFEAT_LIST.forEach(([cls, nm, rt]) => {
    DEFS.push({
      id: 'bk_' + cls, cat: 'bosses', icon: RATING_ICON[rt],
      name: `讨伐 · ${nm}`, desc: `在正常游戏中击败 ${nm}（${rt} 级Boss）；挑战Boss界面中击败不计`
    });
  });
  DEFS.push(
    { id: 'bk_sss',      cat: 'bosses', icon: '👑', name: '「神之壁垒」',   desc: '在正常游戏中击败任意一只 SSS 级Boss；挑战Boss界面中击败不计' },
    { id: 'bk_ten',      cat: 'bosses', icon: '🏯', name: '「十路诸侯」',   desc: '在正常游戏中累计击败 10 种不同的Boss；挑战Boss界面中击败不计' },
    { id: 'bk_challenge',cat: 'bosses', icon: '⚔️', name: '「委托猎人」',   desc: '在 Boss 挑战模式中成功讨伐' },
    { id: 'bk_all',      cat: 'bosses', icon: '🌈', name: '「全Boss制霸」', desc: `在正常游戏中击败全部 ${BOSS_DEFEAT_LIST.length} 种Boss；挑战Boss界面中击败不计` }
  );

  /* ============ 🌟 14 条觉醒路线专精成就（每路线 5 个 = 70） ============
   * [风格id, 英雄id, 短名, 路线名, 第4形态名, 初醒成就名, 终态成就名] */
  const ROUTES = [
    ['ice',     'xiaobai',   '冰皇', '冰晶弹',   '冰皇穿心', '冰晶初醒喵', '冰皇终态喵'],
    ['holy',    'xiaobai',   '天罚', '圣光弹',   '天罚圣枪', '圣光初醒喵', '天罚终态喵'],
    ['qinglong','xiake',     '青龙', '青龙重剑', '青龙天剑', '青龙初醒喵', '青龙天剑终态喵'],
    ['liuyun',  'xiake',     '流云', '流云飞剑', '万剑流云', '流云初醒喵', '万剑流云终态喵'],
    ['sun',     'mofashi',   '太阳', '太阳星',   '天照星爆', '太阳初醒喵', '天照终态喵'],
    ['rainbow', 'mofashi',   '彩虹', '彩虹星群', '彩虹星河', '彩虹初醒喵', '彩虹星河终态喵'],
    ['demon',   'buliang',   '炎魔', '炎魔火炬', '炎魔之心', '炎魔初醒喵', '炎魔之心终态喵'],
    ['burst',   'buliang',   '爆裂', '爆裂火炬', '炎爆核心', '爆裂初醒喵', '炎爆核心终态喵'],
    ['berserk', 'jiaodoushi','狂战', '狂战巨斧', '灭世巨斧', '狂战初醒喵', '灭世终态喵'],
    ['quake',   'jiaodoushi','裂地', '裂地战斧', '裂地神斧', '裂地初醒喵', '裂地神斧终态喵'],
    ['cannon',  'chaoren',   '毁灭', '毁灭光炮', '终焉光炮', '毁灭初醒喵', '终焉终态喵'],
    ['rift',    'chaoren',   '裂空', '裂空光束', '裂空光阵', '裂空初醒喵', '裂空光阵终态喵'],
    ['king',    'meiying',   '鬼王', '鬼王',     '幽冥帝君', '鬼王初醒喵', '幽冥帝君终态喵'],
    ['hundred', 'meiying',   '百鬼', '百鬼',     '百鬼夜行', '百鬼初醒喵', '百鬼夜行终态喵']
  ];
  const ROUTE_HERO = {};
  ROUTES.forEach(([sid, hero]) => { ROUTE_HERO[sid] = hero; });
  ROUTES.forEach(([sid, hero, sh, rname, f4, firstNm, f4Nm]) => {
    DEFS.push(
      { id: `rl_${sid}_first`, cat: 'routes', icon: '🔹', name: `「${firstNm}」`, desc: `首次选择${rname}路线` },
      { id: `rl_${sid}_f4`,    cat: 'routes', icon: '🔶', name: `「${f4Nm}」`,    desc: `单局进化到${f4}` },
      { id: `rl_${sid}_life`,  cat: 'routes', icon: '🐾', name: `「${sh}一命喵」`, desc: `用${rname}路线一条命击败任意Boss` },
      { id: `rl_${sid}_low`,   cat: 'routes', icon: '❤️\u200d🔥', name: `「${sh}残血喵」`, desc: `用${rname}路线生命≤20%击败任意Boss` },
      { id: `rl_${sid}_safe`,  cat: 'routes', icon: '🛡️', name: `「${sh}无伤喵」`, desc: `用${rname}路线无伤击败任意Boss` }
    );
  });

  /* ============ ✨ 觉醒总览补充成就（9 个，并入 awaken 组） ============ */
  DEFS.push(
    { id: 'aw_pick',   cat: 'awaken', icon: '🌗', name: '「觉醒选边喵」', desc: '首次触发风格觉醒二选一' },
    { id: 'aw_grow12', cat: 'awaken', icon: '🔟', name: '「十二层猫猫」', desc: '单局把任意一条觉醒路线强度成长堆到12次' },
    { id: 'aw_dual',   cat: 'awaken', icon: '🔀', name: '「双线猫猫」',   desc: '同一英雄A/B两条路线都进化到第4形态' },
    { id: 'aw_7pick',  cat: 'awaken', icon: '🐱', name: '「七猫全觉喵」', desc: '7名英雄均至少完成一次风格觉醒二选一' },
    { id: 'aw_f14',    cat: 'awaken', icon: '🏆', name: '「十四终态喵」', desc: '14条觉醒路线全部进化到第4形态' },
    { id: 'aw_naked',  cat: 'awaken', icon: '🥚', name: '「裸弹猫猫」',   desc: '不使用觉醒风格，仅用基础弹击败任意A+级以上Boss' },
    { id: 'aw_slife',  cat: 'awaken', icon: '💪', name: '「觉醒一命喵」', desc: '用任意觉醒路线一条命击败任意S级以上Boss' },
    { id: 'aw_slow',   cat: 'awaken', icon: '🩸', name: '「觉醒残血喵」', desc: '用任意觉醒路线生命≤20%击败任意S级以上Boss' },
    { id: 'aw_ssafe',  cat: 'awaken', icon: '✨', name: '「觉醒无伤喵」', desc: '用任意觉醒路线无伤击败任意S级以上Boss' }
  );

  /* ============ ⚔ Boss 极限挑战成就（按评级 2/3/4/6 个，共 100） ============
   * life/low/safe/speed/hit 为各 Boss 的定制成就名；可解锁种类由评级决定：
   * B+：一命+无伤；A：+残血；A+：+90秒速杀；S：+90秒+限伤1+不复活；
   * SS：速杀120秒+限伤1+不复活；SSS：速杀120秒+限伤2+不复活 */
  const RT_RANK = { 'B+': 1, 'A': 2, 'A+': 3, 'S': 4, 'SS': 5, 'SSS': 6 };
  const BOSS_RT_MAP = {};
  BOSS_DEFEAT_LIST.forEach(([cls, , rt]) => { BOSS_RT_MAP[cls] = rt; });
  const BOSS_EXTRA = [
    { cls: 'PigKing',         life: '喵命一条',       safe: '无伤猫步' },
    { cls: 'ThunderBehemoth', life: '雷声不怕喵',     safe: '避雷猫爪' },
    { cls: 'DogKing',         life: '狗狗追不上猫',   safe: '空中猫步' },
    { cls: 'MadHyena',        life: '鬣狗追不上猫',   low: '残血猫爪',     safe: '无伤猫步' },
    { cls: 'SandWalker',      life: '沙里藏猫',       low: '残血踏沙喵',   safe: '无伤踏沙' },
    { cls: 'SkullKing',       life: '骨头吓不到猫',   low: '残血超度喵',   safe: '无伤猫步' },
    { cls: 'Stranger',        life: '怪招不中猫',     low: '残血猫爪',     safe: '无伤猫眼' },
    { cls: 'RaccoonRover',    life: '浣熊别偷喵',     low: '残血反偷喵',   safe: '无伤猫步', speed: '速爪抓浣熊' },
    { cls: 'CaptainGeorge',   life: '船长追不上猫',   low: '残血炮下喵',   safe: '无伤躲炮喵', speed: '速爪打船长' },
    { cls: 'FireBlind',       life: '火大不烧猫',     low: '残血火中喵',   safe: '无伤猫步', speed: '速爪灭火喵' },
    { cls: 'PurpleHand',      life: '仙术不迷猫',     low: '残血破阵喵',   safe: '无伤猫眼', speed: '速爪破阵喵' },
    { cls: 'SeaBully',        life: '海底猫猫',       low: '残血潜水喵',   safe: '无伤猫步', speed: '速爪打恶霸' },
    { cls: 'SnowWitch',       life: '冻不住猫',       low: '残血破冰喵',   safe: '无伤猫步', speed: '速爪融冰喵' },
    { cls: 'CrowCount',       life: '鸦鸦抓不到猫',   low: '残血弹幕喵',   safe: '无伤猫步', speed: '速爪拔羽喵' },
    { cls: 'GiantPheasant',   life: '火鸡追不上猫',   low: '残血火鸡爪',   safe: '无伤猫步', speed: '速爪抓火鸡' },
    { cls: 'Homelander',      life: '星星不惹猫',     low: '残血怒喵',     safe: '无伤猫步', speed: '速爪惹星喵' },
    { cls: 'FrogKing',        life: '蛙哥跳不过猫',   low: '残血踩蛙喵',   safe: '无伤猫步', speed: '速爪抓蛙喵' },
    { cls: 'Samurai',         life: '赤鬼怕猫爪',     low: '残血斗鬼喵',   safe: '无伤猫步', speed: '速爪退鬼喵', hit: '稳爪斗鬼喵' },
    { cls: 'BossMan',         life: '斧头砍不到猫',   low: '残血躲斧喵',   safe: '无伤猫步', speed: '速爪过斧喵', hit: '稳爪躲斧喵' },
    { cls: 'CraneSage',       life: '仙鹤追不上猫',   low: '残血戏鹤喵',   safe: '无伤猫步', speed: '速爪戏鹤喵', hit: '稳爪戏鹤喵' },
    { cls: 'SwordEagle',      life: '铁鹰抓不到猫',   low: '残血拔羽喵',   safe: '无伤猫步', speed: '速爪拔羽喵', hit: '稳爪拔羽喵' },
    { cls: 'NiuMo',           life: '牛角不碰猫',     low: '残血斗牛喵',   safe: '无伤猫步', speed: '速爪降牛喵', hit: '稳爪斗牛喵' },
    { cls: 'Sphinx',          life: '谜题难不倒猫',   low: '残血解谜喵',   safe: '无伤猫步', speed: '速爪破谜喵', hit: '稳爪解谜喵' },
    { cls: 'BoneDragonKing',  life: '骨头龙怕猫',     low: '残血拆骨喵',   safe: '无伤猫步', speed: '速爪拆骨喵', hit: '稳爪拆骨喵' }
  ];
  BOSS_EXTRA.forEach(item => {
    const nm = (BOSS_DEFEAT_LIST.find(x => x[0] === item.cls) || [])[1] || item.cls;
    const rank = RT_RANK[BOSS_RT_MAP[item.cls]] || 0;
    const push = (kind, icon, an, desc) => DEFS.push({ id: `bx_${item.cls}_${kind}`, cat: 'bossx', icon, name: `「${an}」`, desc });
    push('life', '🐾', item.life, `一条命击败${nm}`);
    push('safe', '🛡️', item.safe, `无伤击败${nm}`);
    if (rank >= 2) push('low', '❤️\u200d🔥', item.low, `生命 ≤20% 时击败${nm}`);
    if (rank >= 3) {
      const sec = rank >= 5 ? 120 : 90;
      push('speed', '⏱️', item.speed, `${sec}秒内击败${nm}`);
    }
    if (rank >= 4) {
      const hitN = rank >= 6 ? 2 : 1;
      push('hit', '🎯', item.hit, `受伤 ≤${hitN} 次击败${nm}`);
      push('norevive', '🚫', '不复活喵', `不使用复活击败${nm}`);
    }
  });

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
      arenaRounds: 0,      // 角斗场累计完成轮数（击败Boss数）
      styleSeen: {},       // 已觉醒过的风格 id -> true（跨局累计）
      heroStyleSeen: {},   // 已觉醒过的英雄 id -> true（跨局累计）
      bossDefeated: {},    // 已击败过的 Boss 类名 -> true（跨局累计）
      routeF4: {}          // 曾进化到第4形态的路线 id -> true（跨局累计）
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
      soulKills: 0,            // 幽魂弹击杀（魅影）
      knifeHits: 0,            // 飞刀连续命中
      confuseKills: 0,         // 困惑敌人击杀（单次护盾窗口）
      bossDmgTaken: 0,         // 本轮Boss战承伤
      bossHits: 0,             // 本轮Boss战受击次数（无伤/限伤判定）
      bossStartT: 0,           // 本轮Boss出场时的游戏时间（速杀计时）
      bossRevived: false,      // 本轮Boss战期间是否使用过复活
      reviveUsed: false,       // 本局是否使用过复活
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
          // 小白：子弹达到最高阶（bulletTier 6 = 高阶穿透弹）
          if (run.charId === 'xiaobai' && p && p.bulletTier >= 6) unlock('xb_tier');
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
          if (run.charId === 'meiying') unlock('my_round10');
        }
        break;
      }

      /* ===== Boss 出场 ===== */
      case 'bossSpawn': {
        if (d.name === 'Sphinx' || d.name === 'NiuMo' || d.name === 'BoneDragonKing') {
          unlock('h_special');
        }
        if (run) {
          run.bossDmgTaken = 0;
          run.bossHits = 0;
          run.bossRevived = false;
          run.bossStartT = run.time;
        }
        break;
      }

      /* ===== Boss 被击败 ===== */
      case 'bossDefeated': {
        unlock('g_boss');
        const clsName = d.boss ? d.boss.constructor.name : '';
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
        // 魅影：百鬼夜行期间击败Boss
        if (run.charId === 'meiying' && run.ultKind === 'phantom' && run.ultT > 0) unlock('my_boss');
        // 觉醒子弹：风格觉醒后击败Boss
        if (p.bulletStyleId) unlock('aw_boss');
        // —— 全Boss讨伐：登记类名 → 个体成就 + 总览成就（仅正常游戏，挑战Boss界面不计）——
        if (clsName && !g.challengeMode) {
          saved.stats.bossDefeated[clsName] = true;
          unlock('bk_' + clsName);
          const hit = BOSS_DEFEAT_LIST.find(x => x[0] === clsName);
          if (hit && hit[2] === 'SSS') unlock('bk_sss');
          const bn = Object.keys(saved.stats.bossDefeated).length;
          if (bn >= 10) unlock('bk_ten');
          if (bn >= BOSS_DEFEAT_LIST.length) unlock('bk_all');
          save();
        }
        // Boss 挑战模式中成功讨伐（与上面的正常游戏讨伐互不相通）
        if (g.challengeMode) unlock('bk_challenge');

        /* —— 🌟 觉醒路线专精 + ⚔ Boss 极限挑战（正常游戏/挑战模式均生效）—— */
        const rt2 = BOSS_RT_MAP[clsName];
        const rank2 = RT_RANK[rt2] || 0;
        const tUsed = Math.max(0, run.time - run.bossStartT);
        const oneLife = run.deaths === 0;
        const lowHp2 = ratio <= 0.2;
        const safe2 = run.bossHits === 0;
        const sid2 = p.bulletStyleId;
        // 当前所用路线的一命/残血/无伤
        if (sid2) {
          if (oneLife) unlock(`rl_${sid2}_life`);
          if (lowHp2) unlock(`rl_${sid2}_low`);
          if (safe2) unlock(`rl_${sid2}_safe`);
        }
        // 裸弹：无觉醒风格击败 A+ 级以上
        if (!sid2 && rank2 >= 3) unlock('aw_naked');
        // 任意觉醒路线击败 S 级以上：一命/残血/无伤
        if (sid2 && rank2 >= 4) {
          if (oneLife) unlock('aw_slife');
          if (lowHp2) unlock('aw_slow');
          if (safe2) unlock('aw_ssafe');
        }
        // 该 Boss 的极限成就（种类按评级，id 不存在时 unlock 自动忽略）
        if (clsName) {
          if (oneLife) unlock(`bx_${clsName}_life`);
          if (safe2) unlock(`bx_${clsName}_safe`);
          if (rank2 >= 2 && lowHp2) unlock(`bx_${clsName}_low`);
          if (rank2 >= 3 && tUsed <= (rank2 >= 5 ? 120 : 90)) unlock(`bx_${clsName}_speed`);
          if (rank2 >= 4) {
            if (run.bossHits <= (rank2 >= 6 ? 2 : 1)) unlock(`bx_${clsName}_hit`);
            if (!run.bossRevived) unlock(`bx_${clsName}_norevive`);
          }
        }
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
        // 魅影幽魂弹：累计击杀 + 单发穿透计数（bullet 上累计，同一发杀≥3 即「一弹三魂」）
        if (d.kind === 'soul') {
          run.soulKills++;
          if (run.charId === 'meiying' && run.soulKills >= 30) unlock('my_soul');
          if (d.bullet) {
            d.bullet._achSoulKills = (d.bullet._achSoulKills || 0) + 1;
            if (run.charId === 'meiying' && d.bullet._achSoulKills >= 3) unlock('my_pierce');
          }
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
        if (g.bosses && g.bosses.length > 0) run.bossHits++;
        // 残血连击窗口：血量跌到 25% 以下开启 10s
        if (p.maxHp && p.hp / p.maxHp <= 0.25 && run.lowHpT <= 0) {
          run.lowHpT = 10;
          run.lowHpKillsWindow = 0;
        }
        break;
      }

      /* ===== 玩家阵亡（掉一条命） ===== */
      case 'playerDeath': {
        if (run) {
          run.deaths++;
          run.reviveUsed = true;
          if (g.bosses && g.bosses.length > 0) run.bossRevived = true;
        }
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

      /* ===== [魅影] 百鬼夜行释放（n=本次大招击杀小怪数） ===== */
      case 'ultPhantom': {
        unlock('my_night');
        if (!run) break;
        if ((d.n || 0) >= 20) unlock('my_night20');
        break;
      }

      /* ===== 风格觉醒二选一面板弹出 ===== */
      case 'stylePrompt': {
        unlock('aw_pick');
        break;
      }

      /* ===== 英雄子弹风格觉醒（styleId/heroId/倍率） ===== */
      case 'styleAwaken': {
        unlock('aw_first');
        if (d.styleId) {
          saved.stats.styleSeen[d.styleId] = true;
          if (Object.keys(saved.stats.styleSeen).length >= 5) unlock('aw_styles5');
          unlock(`rl_${d.styleId}_first`);
        }
        if (d.heroId) {
          saved.stats.heroStyleSeen[d.heroId] = true;
          if (Object.keys(saved.stats.heroStyleSeen).length >= 7) {
            unlock('aw_allheroes');
            unlock('aw_7pick');
          }
        }
        save();
        break;
      }

      /* ===== 英雄子弹风格成长（growth 1-12 / formUp / newForm） ===== */
      case 'styleGrowth': {
        if (d.formUp && d.newForm >= 2) unlock('aw_form2');
        if (d.formUp && d.newForm >= 4) unlock('aw_form4');
        if ((d.growth || 0) >= 12) {
          unlock('aw_max');
          unlock('aw_grow12');
        }
        // 路线终态：登记该路线，检查十四终态与同英雄双线
        if (d.formUp && d.newForm >= 4 && p && p.bulletStyleId) {
          const fsid = p.bulletStyleId;
          unlock(`rl_${fsid}_f4`);
          saved.stats.routeF4[fsid] = true;
          if (Object.keys(saved.stats.routeF4).length >= ROUTES.length) unlock('aw_f14');
          const fhero = ROUTE_HERO[fsid];
          const pair = ROUTES.filter(r => r[1] === fhero).map(r => r[0]);
          if (pair.length === 2 && pair.every(s => saved.stats.routeF4[s])) unlock('aw_dual');
          save();
        }
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
      { key: 'meiying', title: '👻 魅影 —— 幽冥来客' },
      { key: 'awaken', title: '✨ 英雄觉醒子弹成就' },
      { key: 'routes', title: '🌟 觉醒路线专精成就' },
      { key: 'bosses', title: '🏆 全Boss讨伐成就' },
      { key: 'bossx', title: '⚔ Boss 极限挑战成就' },
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
