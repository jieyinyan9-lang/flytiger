/* ============================================================
 * characters.js —— 角色系统：出战角色注册表 / 30 槽位选择 / 子弹成长
 *  - 每个角色：速度倍率 / 基础伤害 / 射速倍率 / 弹种 / 大招 / 美术资源
 *  - 30 个槽位：前 6 个为可用角色，其余预留（显示问号）
 * ============================================================ */
(function () {
  'use strict';

  const list = {
    xiaobai: {
      id: 'xiaobai', name: '小白', art: 'assets/cat.png', icon: '🐱',
      speedMul: 1, dmg: 10, fireMul: 1,
      kind: 'bolt', ult: 'wave',
      tag: '飞虎',
      trait: '标准速度 · 标准伤害 · 强光波大招',
      desc: '均衡的白猫飞虎，弹道可成长为高阶强化弹。'
    },
    xiake: {
      id: 'xiake', name: '侠客', art: 'assets/Xiake.png', icon: '🗡️',
      speedMul: 1.5, dmg: 8, fireMul: 1,
      kind: 'knife', ult: 'slash',
      tag: '疾风剑客',
      trait: '速度 +50% · 飞刀弹道（远端下落）· 前方大斩击',
      desc: '身法极快的侠猫，掷出受重力影响的飞刀；子弹可成长为翠绿大剑。大招朝前方释放大范围斩击。'
    },
    mofashi: {
      id: 'mofashi', name: '法师', art: 'assets/MoFaShi.png', icon: '✨',
      speedMul: 0.8, dmg: 7, fireMul: 1,
      kind: 'star', ult: 'shield',
      tag: '星辉法师',
      trait: '速度 -20% · 星星 S 形弹道（命中分裂）· 魔法护盾',
      desc: '神秘星辉法师，自转星星沿 S 形弧线飞行，命中分裂；子弹可成长为彩虹大星。大招展开魔法护盾。'
    },
    buliang: {
      id: 'buliang', name: '不良少年', art: 'assets/BuLiang.png', icon: '🚬',
      speedMul: 1.3, dmg: 6, fireMul: 1, bulletSpd: 0.6,
      kind: 'butt', ult: 'soundwave', bounceBase: 1,
      tag: '桀骜不良',
      trait: '速度 +30% · 烟头反弹 + 燃烧 · 声波禁锢',
      desc: '叼着烟的不良猫，烟头弹会反弹并点燃敌人，砸到地面还能震伤地下的龙；子弹可成长为烈焰火把。大招释放禁锢声波。'
    },
    jiaodoushi: {
      id: 'jiaodoushi', name: '狂战士', art: 'assets/Jiaodoushi.png', icon: '🪓',
      speedMul: 0.8, dmg: 12, fireMul: 1.25, bulletSpd: 0.6,
      kind: 'shieldSaw', ult: 'bloodrage', bounceBase: 1,
      tag: '角斗士',
      trait: '速度 -20% · 伤害 +20% · 射速 -20% · 血怒',
      desc: '披甲角斗猫，抛掷沉重的锯齿盾牌（会反弹）；子弹可成长为巨大战斧。大招开启血怒，受创越多伤害越高。'
    },
    chaoren: {
      id: 'chaoren', name: '超级小子', art: 'assets/ChaoRen.png', icon: '🦸',
      speedMul: 1.5, dmg: 11, fireMul: 1,
      kind: 'lblock', ult: 'lasers',
      tag: '超能少年',
      trait: '速度 +50% · 矩形激光块 · 五重追踪激光串',
      desc: '超能少年猫，发射矩形激光块；子弹可成长为贯穿全屏的粗激光。大招发射 5 道追踪激光串。'
    }
  };

  const ORDER = ['xiaobai', 'xiake', 'mofashi', 'buliang', 'jiaodoushi', 'chaoren'];
  const SLOTS = 30;   // 预留 30 个角色槽位（未制作显示问号）

  /** 预加载全部角色美术资源 → Sprites.charArt（id → Image） */
  const charArt = {};
  ORDER.forEach(id => {
    const c = list[id];
    const im = new Image();
    im.onload = () => { c.img = im; };
    im.onerror = () => { console.warn('[Chars] 缺少角色素材: ' + c.art); };
    im.src = c.art;
    charArt[id] = im;
  });
  if (window.Sprites) Sprites.charArt = charArt;

  function get(id) { return list[id] || null; }
  function has(id) { return !!list[id]; }
  function art(id) {
    const c = get(id);
    return c && c.img ? c.img : null;
  }

  /** 子弹最终形态名称 / 拖尾粒子配色（按角色） */
  const FINAL = {
    xiake: { name: '翠绿大剑', trail: ['#2fb37c', '#7ed46d', '#d8ffe8', '#1e6fd0'] },
    mofashi: { name: '彩虹大星', trail: ['#ff5252', '#ffd93b', '#35e0ff', '#a78bfa', '#4ade80'] },
    buliang: { name: '烈焰火把', trail: ['#ff2a0a', '#ff9d2e', '#ffd23b', '#fff5d0'] },
    jiaodoushi: { name: '巨大战斧', trail: ['#fff', '#ffd23b', '#ff9d2e', '#b8c2cc'] },
    chaoren: { name: '贯穿粗激光', trail: ['#35e0ff', '#a5f3fc', '#ffffff', '#7fe7ff'] }
  };
  const GROW_NAME = {
    xiake: '飞刀成长', mofashi: '星辰成长', buliang: '燃烧成长',
    jiaodoushi: '战盾成长', chaoren: '激光成长'
  };

  /**
   * 角色专属「子弹成长」三选一项（四种样式：初始 + 3 次成长，第 4 阶为最终形态）
   * 不良少年 / 狂战士每次成长额外 +1 次反弹
   */
  function bulletUpgrade(charId) {
    const c = list[charId];
    if (!c || charId === 'xiaobai') return null;
    const fin = FINAL[charId];
    return {
      id: 'cbullet', icon: '✦', cls: 'c-tier',
      name: GROW_NAME[charId] || '子弹成长',
      desc(p) {
        const extra = (charId === 'buliang' || charId === 'jiaodoushi') ? '、反弹 +1 次' : '';
        if (p.charBulletLv + 1 >= 3) {
          return `子弹升至最高形态「${fin.name}」，伤害 +3${extra}，附带专属拖尾！`;
        }
        return `子弹样式进化（第 ${p.charBulletLv + 1}/3 次成长）：伤害 +3${extra}`;
      },
      can(p) { return p.charBulletLv < 3; },
      apply(p) {
        p.charBulletLv++;
        p.dmg += 3;
        if (p.bounceMax !== undefined) p.bounceMax++;
        SFX.pick();
      },
      level(p) { return p.charBulletLv; }
    };
  }

  window.CHARS = { list, ORDER, SLOTS, get, has, art, bulletUpgrade, FINAL };
})();
