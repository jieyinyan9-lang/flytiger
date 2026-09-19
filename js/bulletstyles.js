/* ============================================================
 * bulletstyles.js —— 英雄子弹风格系统
 *  - 每个英雄 2 条专属风格路线（A/B），选定后替换全部基础弹道
 *  - 每条风格 4 个形态（12 次风格强度成长，每 3 次升一阶）
 *  - 本文件提供：风格数据 + 14 种风格【形态1-4】的程序化绘制资源
 *    + 风格二选一界面（?styleui=1 预览，?styleui=英雄id 直达）
 *  - 对外：window.BStyle
 *      STYLES[heroId] = { a:{...}, b:{...} }
 *      draw(ctx, styleId, form, x, y, ang, t, r)  供 Bullet.render 复用
 * ============================================================ */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  /* ============================================================
   * 一、风格数据（名称 / 定位 / 四形态 / 描述 / 强调色）
   * ============================================================ */
  const STYLES = {
    xiaobai: {
      base: '高阶强化弹·白',
      a: {
        id: 'ice', key: 'A', name: '冰晶弹', accent: '#7fd4ff', speed: 1.00,
        pos: ['穿透', '控制'],
        forms: ['冰晶弹', '寒霜棱弹', '极寒冰矛', '冰皇穿心'],
        f1: '六角冰晶弹体，两侧生出短冰棱，蓝白冷光流转，弹尾不断掉落冰晶碎片。'
      },
      b: {
        id: 'holy', key: 'B', name: '圣光弹', accent: '#ffd970', speed: 1.12,
        pos: ['单体', '爆发'],
        forms: ['圣光弹', '圣辉长矛', '裁决圣枪', '天罚圣枪'],
        f1: '白金色光矛凝聚成形，中央十字光芯炽燃，弹尾拖出四道光束，飞行带明显光环。'
      }
    },
    xiake: {
      base: '翠绿大剑',
      a: {
        id: 'qinglong', key: 'A', name: '青龙重剑', accent: '#4ade80', speed: 0.82,
        pos: ['重剑', '爆发'],
        forms: ['青龙重剑', '龙牙巨剑', '苍龙斩', '青龙天剑'],
        f1: '剑身明显加宽，剑尖化作龙首，剑柄缠绕青绿装饰，拖出粗重厚实的绿色剑气。'
      },
      b: {
        id: 'liuyun', key: 'B', name: '流云飞剑', accent: '#7fe7e0', speed: 1.35,
        pos: ['高速', '多段覆盖'],
        forms: ['流云飞剑', '三曜飞剑', '流云剑阵', '万剑流云'],
        f1: '剑身变细变长，两柄副剑环绕周身流转，青白流光，飞行留下弧形剑痕。'
      }
    },
    mofashi: {
      base: '彩虹大星',
      a: {
        id: 'sun', key: 'A', name: '太阳星', accent: '#ff9d3c', speed: 0.92,
        pos: ['集中', '爆炸'],
        forms: ['太阳星', '耀阳星', '烈日星核', '天照星爆'],
        f1: '五角星化为六芒太阳轮，中央巨型炽燃核心，外圈光环持续旋转，金红灼目。'
      },
      b: {
        id: 'rainbow', key: 'B', name: '彩虹星群', accent: '#c98bff', speed: 1.20,
        pos: ['范围', '清场'],
        forms: ['彩虹星群', '七曜星群', '星海', '彩虹星河'],
        f1: '主星缩小，四枚彩虹小星环绕自转，颜色层层分层，命中爆出缤纷星屑。'
      }
    },
    buliang: {
      base: '烈焰火把',
      a: {
        id: 'demon', key: 'A', name: '炎魔火炬', accent: '#ff5a2e', speed: 0.85,
        pos: ['燃烧', 'DoT'],
        forms: ['炎魔火炬', '炎兽火炬', '魔焰巨炬', '炎魔之心'],
        f1: '火把头明显变大，火焰凝成恶魔兽首轮廓，橙红→暗红→白焰层层递进，拖出长火焰尾。'
      },
      b: {
        id: 'burst', key: 'B', name: '爆裂火炬', accent: '#ff8a3d', speed: 1.00,
        pos: ['反弹', '爆炸'],
        forms: ['爆裂火炬', '火星炸弹', '烈焰爆弹', '炎爆核心'],
        f1: '火把变短粗，火焰缩成球状火团，数颗小火球环绕飞旋，反弹时溅出明显火星。'
      }
    },
    jiaodoushi: {
      base: '巨大战斧',
      a: {
        id: 'berserk', key: 'A', name: '狂战巨斧', accent: '#ff4d4d', speed: 0.80,
        pos: ['重击'],
        forms: ['狂战巨斧', '血刃巨斧', '狂神战斧', '灭世巨斧'],
        f1: '斧刃扩大约三成，厚重双刃挟风声旋转，中央裂纹透出红光，旋出红色斩击弧。'
      },
      b: {
        id: 'quake', key: 'B', name: '裂地战斧', accent: '#d2a85e', speed: 0.80,
        pos: ['对地', '反弹'],
        forms: ['裂地战斧', '断岳战斧', '崩山巨斧', '裂地神斧'],
        f1: '斧柄变长，斧刃化作钩状，飞旋间带起土黄色碎石，落地拖出裂地痕迹。'
      }
    },
    chaoren: {
      base: '贯穿粗激光',
      a: {
        id: 'cannon', key: 'A', name: '毁灭光炮', accent: '#ff2e88', speed: 1.45,
        pos: ['Boss', '单体'],
        forms: ['毁灭光炮', '重型光炮', '歼星光炮', '终焉光炮'],
        f1: '光束变粗、白芯扩大，外层套着旋转光环，尾部压出大型炮口与压缩能量环。'
      },
      b: {
        id: 'rift', key: 'B', name: '裂空光束', accent: '#d06bff', speed: 1.32,
        pos: ['多目标', '清屏'],
        forms: ['裂空光束', '三叉裂光', '六芒裂空', '裂空光阵'],
        f1: '主光束变细，上下分裂出两道副光束，三道光束呈三叉结构，粉紫光刃交错。'
      }
    },
    meiying: {
      base: '幽冥鬼王',
      a: {
        id: 'king', key: 'A', name: '鬼王', accent: '#b57bff', speed: 0.85,
        pos: ['大型', '穿透重弹'],
        forms: ['鬼王', '鬼王怨面', '冥界鬼王', '幽冥帝君'],
        f1: '鬼脸明显变大，巨大弯角向后张开，鬼火化为紫黑色，尾焰拖长，双眼惨白高亮。'
      },
      b: {
        id: 'hundred', key: 'B', name: '百鬼', accent: '#c084fc', speed: 1.10,
        pos: ['群体攻击'],
        forms: ['百鬼', '五鬼', '鬼群', '百鬼夜行'],
        f1: '主鬼脸缩小，三个小鬼魂绕主弹旋转飞行，青白鬼火时隐时现，聚成鬼魂群。'
      }
    }
  };

  /* ============================================================
   * 二、绘制小工具
   * ============================================================ */
  function poly(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
  }
  /** 五角星路径（中心 0,0；最外点朝上由 rot 控制） */
  function star5(ctx, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a1 = -Math.PI / 2 + (TAU / 5) * i + (rot || 0);
      const a2 = a1 + TAU / 10;
      ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
      ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
    }
    ctx.closePath();
  }
  /** 六芒放射尖（n 道外伸三角芒，第 0 道朝右） */
  function rays(ctx, n, rIn, rOut, width, rot) {
    for (let i = 0; i < n; i++) {
      const a = (TAU / n) * i + (rot || 0);
      const ca = Math.cos(a), sa = Math.sin(a);
      const px = -sa, py = ca;                       // 切向
      ctx.beginPath();
      ctx.moveTo(ca * rIn + px * width, sa * rIn + py * width);
      ctx.lineTo(ca * rOut, sa * rOut);
      ctx.lineTo(ca * rIn - px * width, sa * rIn - py * width);
      ctx.closePath();
      ctx.fill();
    }
  }
  /** 柔光圆 */
  function glow(ctx, r, inner, outer) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  }

  /* ============================================================
   * 三、14 种风格 · 形态1 绘制（弹体统一朝 +x 方向，r 为基准半径）
   * ============================================================ */

  /* —— 小白 A：冰晶弹（六角冰晶 + 冰棱/晶刃/冰矛/冰皇穿心） —— */
  function drawIce(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save(); ctx.scale(s, s);
    const fl = 1 + Math.sin(t * 6) * 0.05;
    glow(ctx, r * 2.0 * fl, 'rgba(150,215,255,0.55)', 'rgba(120,190,255,0)');
    // 形态4：外围旋转冰环
    if (form >= 4) {
      ctx.save(); ctx.rotate(t * 2.2);
      ctx.strokeStyle = 'rgba(180,225,255,0.65)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.95, r * 1.0, a, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
    // 两侧冰棱（形态2+ 延长为十字晶刃）
    ctx.fillStyle = '#cfeaff';
    ctx.strokeStyle = '#5aa9e6'; ctx.lineWidth = 1.6;
    const wY = form >= 2 ? r * 0.54 : r * 0.48;
    const wTip = form >= 2 ? r * 1.48 : r * 1.18;
    poly(ctx, [[-r * 0.35, -wY], [r * 0.28, -wY], [-r * 0.02, -wTip]]); ctx.fill(); ctx.stroke();
    poly(ctx, [[-r * 0.35, wY], [r * 0.28, wY], [-r * 0.02, wTip]]); ctx.fill(); ctx.stroke();
    // 形态3+：展开对称冰翼
    if (form >= 3) {
      ctx.fillStyle = 'rgba(180,225,255,0.85)'; ctx.strokeStyle = '#6fb4ec';
      poly(ctx, [[r * 0.2, -r * 0.5], [r * 1.05, -r * 0.98], [r * 0.45, -r * 0.3]]); ctx.fill(); ctx.stroke();
      poly(ctx, [[r * 0.2, r * 0.5], [r * 1.05, r * 0.98], [r * 0.45, r * 0.3]]); ctx.fill(); ctx.stroke();
    }
    // 弹体：六角冰晶；形态3+ 拉长为冰矛
    const el = form >= 3 ? 1.55 : 1;
    const body = [[r * 1.55 * el, 0], [r * 0.5, -r * 0.78], [-r * 0.95, -r * 0.6], [-r * 1.25, 0], [-r * 0.95, r * 0.6], [r * 0.5, r * 0.78]];
    const g = ctx.createLinearGradient(-r * 1.2, 0, r * 1.5 * el, 0);
    g.addColorStop(0, '#b8dcff'); g.addColorStop(0.55, '#e8f6ff'); g.addColorStop(1, '#c9e8ff');
    poly(ctx, body); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#4d97d8'; ctx.lineWidth = 2; ctx.stroke();
    // 内部棱面
    poly(ctx, body.map(p => [p[0] * 0.62 - r * 0.05, p[1] * 0.62]));
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    // 形态2+：内部旋转冰核
    if (form >= 2) {
      ctx.save(); ctx.rotate(t * 3.2);
      ctx.fillStyle = 'rgba(220,240,255,0.85)';
      rays(ctx, 6, r * 0.18, r * 0.5, r * 0.06, 0);
      ctx.restore();
    }
    // 形态4：前端多层尖锐晶锥
    if (form >= 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = '#8fc4ef';
      poly(ctx, [[r * 1.55 * el, 0], [r * 1.1 * el, -r * 0.3], [r * 1.1 * el, r * 0.3]]); ctx.fill(); ctx.stroke();
      poly(ctx, [[r * 1.7 * el, 0], [r * 1.3 * el, -r * 0.16], [r * 1.3 * el, r * 0.16]]); ctx.fillStyle = '#dff0ff'; ctx.fill();
    }
    // 中央亮轴
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 1.0, 0); ctx.lineTo(r * 1.32 * el, 0); ctx.stroke();
    // 流动光点
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(Math.sin(t * 3) * r * 0.62, -r * 0.22, r * 0.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* —— 小白 B：圣光弹（长矛/圣辉长矛/裁决圣枪/天罚圣枪） —— */
  function drawHoly(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save(); ctx.scale(s, s);
    glow(ctx, r * 2.1, 'rgba(255,232,160,0.5)', 'rgba(255,210,110,0)');
    const el = form >= 2 ? 1.35 : 1;
    // 四道尾光 / 形态4 十字光翼
    const tails = [[-r * 2.2 * el, -r * 0.42], [-r * 2.0 * el, -r * 0.98], [-r * 2.2 * el, r * 0.42], [-r * 2.0 * el, r * 0.98]];
    tails.forEach((p, i) => {
      if (form >= 4) {
        // 十字光翼
        ctx.fillStyle = 'rgba(255,240,190,0.55)';
        const wy = (i < 2 ? -1 : 1) * r * 0.55;
        poly(ctx, [[-r * 1.0, 0], [p[0], p[1]], [-r * 1.0, wy * 0.5]]); ctx.fill();
      } else if (form >= 2) {
        // 四片光刃
        ctx.fillStyle = i % 2 ? 'rgba(255,236,170,0.6)' : 'rgba(255,216,120,0.85)';
        const w = r * (i % 2 ? 0.08 : 0.14);
        poly(ctx, [[-r * 1.0, -w], [p[0], p[1] - w * 0.6], [p[0], p[1] + w * 0.6], [-r * 1.0, w]]); ctx.fill();
      } else {
        ctx.strokeStyle = i % 2 ? 'rgba(255,236,170,0.55)' : 'rgba(255,216,120,0.85)';
        ctx.lineWidth = i % 2 ? 2 : 3.4;
        ctx.beginPath(); ctx.moveTo(-r * 1.05, 0); ctx.lineTo(p[0], p[1]); ctx.stroke();
      }
    });
    // 形态4：十字形光轮包裹
    if (form >= 4) {
      ctx.save(); ctx.rotate(t * 1.2);
      ctx.strokeStyle = 'rgba(255,236,170,0.7)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-r * 1.8, 0); ctx.lineTo(r * 1.8, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -r * 1.5); ctx.lineTo(0, r * 1.5); ctx.stroke();
      ctx.restore();
    }
    // 旋转光环（形态2+ 增加第二层金色光环）
    ctx.save();
    ctx.rotate(t * 1.6);
    ctx.strokeStyle = 'rgba(255,214,110,0.85)'; ctx.lineWidth = 2;
    ctx.setLineDash([r * 0.5, r * 0.32]);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.12 * el, r * 0.72, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,246,214,0.4)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3 * el, r * 0.86, 0, 0, TAU); ctx.stroke();
    if (form >= 2) {
      ctx.strokeStyle = 'rgba(255,200,80,0.75)'; ctx.lineWidth = 2;
      ctx.setLineDash([r * 0.35, r * 0.25]);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.55 * el, r * 1.0, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    // 矛身（形态3+ 巨型圣枪）
    const bl = form >= 3 ? 1.4 : 1;
    poly(ctx, [[r * 1.95 * bl, 0], [r * 0.7, -r * 0.34], [-r * 1.2 * el, -r * 0.24], [-r * 1.2 * el, r * 0.24], [r * 0.7, r * 0.34]]);
    ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.strokeStyle = '#d8a83c'; ctx.lineWidth = 2; ctx.stroke();
    poly(ctx, [[r * 1.7 * bl, 0], [r * 0.66, -r * 0.18], [-r * 1.0 * el, -r * 0.12], [-r * 1.0 * el, r * 0.12], [r * 0.66, r * 0.18]]);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    // 形态3+：枪尖双层光刃
    if (form >= 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = '#e8c050';
      poly(ctx, [[r * 1.95 * bl, 0], [r * 1.5 * bl, -r * 0.28], [r * 1.5 * bl, r * 0.28]]); ctx.fill(); ctx.stroke();
      poly(ctx, [[r * 2.25 * bl, 0], [r * 1.75 * bl, -r * 0.12], [r * 1.75 * bl, r * 0.12]]); ctx.fillStyle = '#fff8e0'; ctx.fill();
    }
    // 形态4：枪尖耀眼白色核心
    if (form >= 4) {
      glow(ctx, r * 0.6, 'rgba(255,255,255,0.95)', 'rgba(255,240,180,0)');
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(r * 1.95 * bl, 0, r * 0.28, 0, TAU); ctx.fill();
    }
    // 十字光芯（形态2+ 扩大；形态3+ 高速旋转）
    const cf = 1 + Math.sin(t * 8) * 0.14;
    const cx = form >= 2 ? r * 0.05 : r * 0.05;
    const cw = form >= 2 ? r * 0.18 : r * 0.14;
    const ch = form >= 2 ? r * 1.15 * cf : r * 0.92 * cf;
    ctx.save();
    if (form >= 3) ctx.rotate(t * 6);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(cx, -ch / 2, cw, ch);
    ctx.fillRect(-r * 0.4 * (form >= 2 ? 1.15 : 1), -cw / 2, r * 0.92 * (form >= 2 ? 1.15 : 1), cw);
    ctx.restore();
    ctx.restore();
  }

  /* —— 侠客 A：青龙重剑（龙牙巨剑/苍龙斩/青龙天剑） —— */
  function drawQinglong(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save(); ctx.scale(s, s);
    const pulse = 1 + Math.sin(t * 9) * 0.12;
    ctx.lineCap = 'round';
    // 剑气（形态2+ 双层；形态4 龙形轮廓）
    const layers = form >= 4 ? 3 : (form >= 2 ? 2 : 1);
    for (let l = 0; l < layers; l++) {
      const off = l * r * 0.22;
      ctx.strokeStyle = l === 0 ? 'rgba(47,179,124,0.22)' : (l === 1 ? 'rgba(126,212,109,0.18)' : 'rgba(180,255,180,0.14)');
      ctx.lineWidth = (r * 0.5 - l * r * 0.12) * pulse;
      ctx.beginPath(); ctx.moveTo(-r * 1.1, -r * 0.62 - off); ctx.lineTo(r * 1.15, -r * 0.78 - off * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 1.1, r * 0.62 + off); ctx.lineTo(r * 1.15, r * 0.78 + off * 0.6); ctx.stroke();
    }
    // 剑柄 / 柄首 / 护手
    ctx.fillStyle = '#0c2417'; ctx.fillRect(-r * 1.62, -r * 0.26, r * 0.62, r * 0.52);
    ctx.fillStyle = '#2fb37c';
    for (let i = 0; i < 3; i++) ctx.fillRect(-r * 1.55 + i * r * 0.18, -r * 0.26, r * 0.07, r * 0.52);
    ctx.fillStyle = '#d9b14a'; ctx.beginPath(); ctx.arc(-r * 1.68, 0, r * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0e5c34'; ctx.fillRect(-r * 1.06, -r * 0.44, r * 0.16, r * 0.88);
    // 加宽剑身（形态3+ 巨大化）
    const widen = form >= 3 ? 1.2 : (form >= 2 ? 1.08 : 1);
    poly(ctx, [[-r * 0.9, -r * 0.5 * widen], [r * 0.72, -r * 0.42 * widen], [r * 1.12, 0], [r * 0.72, r * 0.42 * widen], [-r * 0.9, r * 0.5 * widen]]);
    ctx.fillStyle = '#0f4d2a'; ctx.fill();
    poly(ctx, [[-r * 0.82, -r * 0.36 * widen], [r * 0.66, -r * 0.3 * widen], [r * 0.98, 0], [r * 0.66, r * 0.3 * widen], [-r * 0.82, r * 0.36 * widen]]);
    ctx.fillStyle = '#2fb37c'; ctx.fill();
    // 形态3+ 青色能量刃边
    if (form >= 3) {
      ctx.strokeStyle = 'rgba(140,255,190,0.85)'; ctx.lineWidth = r * 0.08; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r * 0.82, -r * 0.36 * widen); ctx.lineTo(r * 0.98, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.82, r * 0.36 * widen); ctx.lineTo(r * 0.98, 0); ctx.stroke();
    }
    ctx.fillStyle = '#bff3d0';
    ctx.fillRect(-r * 0.7, -r * 0.07, r * 1.3, r * 0.14);
    // 形态4 中央发光龙纹
    if (form >= 4) {
      ctx.save(); ctx.translate(r * 0.1, 0); ctx.scale(1, 0.5);
      ctx.fillStyle = 'rgba(255,255,200,0.8)';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * 0.6;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.07, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // 剑刃上下高光边
    ctx.strokeStyle = 'rgba(190,255,215,0.9)'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.78, -r * 0.42 * widen); ctx.lineTo(r * 0.6, -r * 0.35 * widen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.78, r * 0.42 * widen); ctx.lineTo(r * 0.6, r * 0.35 * widen); ctx.stroke();
    // 形态2+ 剑刃连续龙鳞
    if (form >= 2) {
      ctx.fillStyle = 'rgba(126,212,109,0.5)';
      for (let i = 0; i < 5; i++) {
        const sx = -r * 0.55 + i * r * 0.28;
        poly(ctx, [[sx, -r * 0.34 * widen], [sx + r * 0.14, -r * 0.18 * widen], [sx, -r * 0.04 * widen]]); ctx.fill();
        poly(ctx, [[sx, r * 0.34 * widen], [sx + r * 0.14, r * 0.18 * widen], [sx, r * 0.04 * widen]]); ctx.fill();
      }
    }
    // 颈背鬃鳞
    ctx.fillStyle = '#1f7a48';
    for (let i = 0; i < (form >= 2 ? 5 : 4); i++) {
      const bx = r * (0.55 - i * 0.26), by = -r * (0.36 + i * 0.04);
      poly(ctx, [[bx, by], [bx - r * 0.16, by - r * 0.2], [bx - r * 0.3, by - r * 0.02]]); ctx.fill();
    }
    // 龙首（剑尖）：棱角分明的上颚（形态3+ 完全包覆）
    const headW = form >= 3 ? 1.3 : 1;
    poly(ctx, [[r * 0.8, -r * 0.34 * headW], [r * 1.06, -r * 0.4 * headW], [r * 1.98, -r * 0.12 * headW], [r * 2.02, r * 0.0], [r * 1.5, r * 0.06 * headW], [r * 0.86, -r * 0.04]]);
    ctx.fillStyle = '#2f9e5f'; ctx.fill();
    ctx.strokeStyle = '#0f4d2a'; ctx.lineWidth = 1.6; ctx.stroke();
    // 下颚（短；形态4 张口效果）
    const jawOpen = form >= 4 ? 0.5 : 0.16;
    poly(ctx, [[r * 0.84, r * 0.3], [r * 1.72, r * jawOpen], [r * 1.46, r * 0.0], [r * 0.9, r * 0.04]]);
    ctx.fillStyle = '#278a50'; ctx.fill(); ctx.stroke();
    // 形态4 张口内焰
    if (form >= 4) {
      ctx.fillStyle = 'rgba(255,200,80,0.8)';
      poly(ctx, [[r * 1.3, r * 0.02], [r * 1.7, r * 0.3], [r * 1.5, r * 0.0]]); ctx.fill();
    }
    // 眉脊
    poly(ctx, [[r * 1.1, -r * 0.33 * headW], [r * 1.52, -r * 0.28 * headW], [r * 1.46, -r * 0.18 * headW], [r * 1.12, -r * 0.22 * headW]]);
    ctx.fillStyle = '#7ed46d'; ctx.fill();
    // 龙角（后掠）
    ctx.strokeStyle = '#5cbf62'; ctx.lineWidth = r * 0.15; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r * 0.98, -r * 0.32 * headW); ctx.quadraticCurveTo(r * 0.7, -r * 0.78, r * 0.36, -r * 0.96); ctx.stroke();
    // 龙眼 / 鼻孔 / 牙
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.ellipse(r * 1.32, -r * 0.22 * headW, r * 0.1, r * 0.07, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#101018';
    ctx.beginPath(); ctx.ellipse(r * 1.35, -r * 0.22 * headW, r * 0.03, r * 0.06, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#21402c';
    ctx.beginPath(); ctx.ellipse(r * 1.82, -r * 0.04, r * 0.035, r * 0.025, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    poly(ctx, [[r * 1.5, r * 0.06], [r * 1.6, r * 0.05], [r * 1.56, -r * 0.03]]); ctx.fill();
    ctx.restore();
  }

  /* —— 侠客 B：流云飞剑（三曜飞剑/流云剑阵/万剑流云） —— */
  function drawLiuyun(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.18;
    ctx.save(); ctx.scale(s, s);
    // 副剑数量：2 → 3 → 5 → 8
    const subCount = form >= 4 ? 8 : (form >= 3 ? 5 : (form >= 2 ? 3 : 2));
    const orbit = form >= 2 ? r * 1.18 : r * 1.08;
    // 多重弧形剑痕（形态3+）
    const trail = form >= 3 ? 3 : 1;
    for (let l = 0; l < trail; l++) {
      ctx.strokeStyle = l === 0 ? 'rgba(150,235,240,0.28)' : (l === 1 ? 'rgba(120,220,200,0.18)' : 'rgba(180,255,230,0.12)');
      ctx.lineWidth = 2 - l * 0.5;
      ctx.beginPath(); ctx.arc(-r * 0.2 - l * r * 0.15, 0, r * (1.5 + l * 0.18), -0.7, 0.5); ctx.stroke();
    }
    // 主剑（形态3+ 缩小为核心剑）
    const mainScale = form >= 3 ? 0.82 : 1;
    ctx.fillStyle = '#2b6f8c';
    ctx.fillRect(-r * 1.55 * mainScale, -r * 0.1, r * 0.28, r * 0.2);
    ctx.fillStyle = '#d9b14a'; ctx.fillRect(-r * 1.3 * mainScale, -r * 0.17, r * 0.08, r * 0.34);
    poly(ctx, [[r * 1.75 * mainScale, 0], [r * 1.4 * mainScale, -r * 0.11], [-r * 1.22 * mainScale, -r * 0.11], [-r * 1.22 * mainScale, r * 0.11], [r * 1.4 * mainScale, r * 0.11]]);
    const g = ctx.createLinearGradient(0, -r * 0.11, 0, r * 0.11);
    g.addColorStop(0, '#eafdff'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#9fe9f0');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#5ab8cc'; ctx.lineWidth = 1.4; ctx.stroke();
    // 形态2+ 剑身流云纹
    if (form >= 2) {
      ctx.strokeStyle = 'rgba(120,210,220,0.7)'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const yy = -r * 0.06 + i * r * 0.06;
        ctx.beginPath(); ctx.moveTo(-r * 0.6, yy); ctx.quadraticCurveTo(r * 0.1, yy - r * 0.04, r * 0.8, yy); ctx.stroke();
      }
    }
    // 副剑（环绕）
    for (let k = 0; k < subCount; k++) {
      const a = t * (form >= 4 ? 3.6 : 2.8) + k * TAU / subCount;
      const ghost = form >= 4 && k % 2 === 1;   // 幻影飞剑（半透明）
      ctx.save();
      ctx.translate(Math.cos(a) * orbit, Math.sin(a) * orbit);
      ctx.rotate(a + Math.PI / 2 + Math.sin(t * 3 + k) * 0.15);
      const ss = 0.55 * (ghost ? 0.6 : 1);
      ctx.globalAlpha = ghost ? 0.4 : 1;
      ctx.fillStyle = '#2b6f8c'; ctx.fillRect(-r * 0.7 * ss, -r * 0.09, r * 0.22 * ss, r * 0.18);
      poly(ctx, [[r * 1.5 * ss, 0], [r * 1.2 * ss, -r * 0.1], [-r * 0.5 * ss, -r * 0.1], [-r * 0.5 * ss, r * 0.1], [r * 1.2 * ss, r * 0.1]]);
      ctx.fillStyle = '#d6faff'; ctx.fill();
      ctx.strokeStyle = '#67c6da'; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // 形态4：整体青绿色剑流光晕
    if (form >= 4) {
      glow(ctx, r * 1.6, 'rgba(120,255,200,0.25)', 'rgba(120,255,200,0)');
    }
    // 流萤光点
    ctx.fillStyle = 'rgba(220,255,255,0.9)';
    ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.55, r * 0.07, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* —— 法师 A：太阳星（耀阳星/烈日星核/天照星爆） —— */
  function drawSun(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save(); ctx.scale(s, s);
    const fl = 1 + Math.sin(t * 7) * 0.06;
    glow(ctx, r * (form >= 3 ? 2.3 : 2.05) * fl, 'rgba(255,170,60,0.55)', 'rgba(255,120,20,0)');
    // 多层旋转外环（形态2+ 第二层；形态3+ 多层太阳环）
    const ringCount = form >= 4 ? 3 : (form >= 3 ? 2 : (form >= 2 ? 2 : 1));
    for (let ri = 0; ri < ringCount; ri++) {
      const rr = r * (1.32 + ri * 0.28);
      const sp = (ri % 2 === 0 ? 1 : -1) * (1.4 + ri * 0.4);
      ctx.save(); ctx.rotate(t * sp);
      ctx.strokeStyle = ri === 0 ? 'rgba(255,170,60,0.8)' : 'rgba(255,120,40,0.65)';
      ctx.lineWidth = 2.4 - ri * 0.4;
      ctx.setLineDash([r * (0.42 - ri * 0.06), r * (0.3 - ri * 0.04)]);
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,220,140,0.7)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 12; i++) {
        const a = TAU / 12 * i;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (rr + r * 0.1), Math.sin(a) * (rr + r * 0.1));
        ctx.lineTo(Math.cos(a) * (rr + r * 0.23), Math.sin(a) * (rr + r * 0.23));
        ctx.stroke();
      }
      ctx.restore();
    }
    // 六芒外圈（橙红；形态4 六道太阳刃向外延伸）
    ctx.fillStyle = '#ff7a1c';
    rays(ctx, 6, r * 0.42, r * (form >= 4 ? 1.45 : 1.18) * fl, r * 0.2, 0);
    if (form >= 4) {
      ctx.fillStyle = '#ffb02e';
      rays(ctx, 6, r * 1.3, r * 1.85, r * 0.12, t * 0.5);
    }
    ctx.strokeStyle = '#c43a06'; ctx.lineWidth = 1.2;
    // 内六芒（金；形态3+ 高亮能量包裹）
    ctx.fillStyle = form >= 3 ? '#ffe07a' : '#ffd23b';
    rays(ctx, 6, r * 0.26, r * 0.78, r * 0.16, 0);
    // 中央炽燃核心（形态2+ 双层光核；形态3+ 明显增大；形态4 白色高亮星核）
    const coreR = form >= 3 ? r * 0.34 : r * 0.26;
    if (form >= 2) {
      glow(ctx, r * 0.7 * fl, 'rgba(255,200,80,0.6)', 'rgba(255,150,30,0)');
      ctx.fillStyle = '#ff8a1c';
      ctx.beginPath(); ctx.arc(0, 0, coreR * 1.5 * fl, 0, TAU); ctx.fill();
    }
    glow(ctx, r * 0.62 * fl, 'rgba(255,255,255,0.98)', 'rgba(255,180,40,0.15)');
    ctx.fillStyle = form >= 4 ? '#ffffff' : '#fffbe8';
    ctx.beginPath(); ctx.arc(0, 0, coreR * fl, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* —— 法师 B：彩虹星群（七曜星群/星海/彩虹星河） —— */
  function drawRainbow(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.18;
    ctx.save(); ctx.scale(s, s);
    const COLS = ['#ff5b6e', '#ff9d3c', '#ffd23b', '#4ade80', '#38bdf8', '#60a5fa', '#c084fc'];
    // 环绕星数量：4 → 7 → 11 → 16
    const starCount = form >= 4 ? 16 : (form >= 3 ? 11 : (form >= 2 ? 7 : 4));
    const orbit = form >= 2 ? r * 1.28 : r * 1.08;
    // 彩虹圆环（分段；形态4 螺旋结构）
    ctx.lineWidth = form >= 3 ? 4 : 3;
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = COLS[i];
      ctx.globalAlpha = 0.5 + Math.sin(t * 4 + i) * 0.18;
      ctx.beginPath();
      ctx.arc(0, 0, orbit + r * 0.2, -Math.PI / 2 + (TAU / 7) * i + t * (form >= 4 ? 0.8 : 0.25), -Math.PI / 2 + (TAU / 7) * (i + 0.82) + t * (form >= 4 ? 0.8 : 0.25));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 形态4：第二层螺旋星环
    if (form >= 4) {
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = COLS[i];
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(0, 0, orbit + r * 0.55, -Math.PI / 2 + (TAU / 7) * i - t * 0.5, -Math.PI / 2 + (TAU / 7) * (i + 0.7) - t * 0.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // 环绕小星（形态2+ 大小分层；形态3+ 轨道交错）
    for (let k = 0; k < starCount; k++) {
      const layer = form >= 3 ? (k % 2) : 0;
      const a = t * (2.1 + layer * 0.4) + k * TAU / starCount;
      const oo = orbit + (layer ? r * 0.45 : 0) + Math.sin(t * 1.5 + k) * r * 0.08;
      const sx = Math.cos(a) * oo, sy = Math.sin(a) * oo;
      const sr = r * (form >= 2 ? (0.22 + (k % 3) * 0.06) : 0.3);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(a * 2);
      star5(ctx, sr, 0);
      ctx.fillStyle = COLS[k % 7]; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-sr * 0.16, -sr * 0.2, sr * 0.22, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // 主星（形态3+ 缩小为彩虹核心星）
    const mainR = form >= 3 ? r * 0.42 : r * 0.52;
    glow(ctx, r * 0.85, 'rgba(255,250,220,0.55)', 'rgba(255,240,180,0)');
    ctx.save(); ctx.rotate(t * 3);
    star5(ctx, mainR, 0);
    ctx.fillStyle = form >= 4 ? '#ffffff' : '#fff7d6'; ctx.fill();
    ctx.strokeStyle = '#ffd93b'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-mainR * 0.17, -mainR * 0.19, mainR * 0.17, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* —— 浪客 A：炎魔火炬（炎兽火炬/魔焰巨炬/炎魔之心） —— */
  function drawDemon(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save(); ctx.scale(s, s);
    const flick = 1 + Math.sin(t * 20) * 0.14;
    // 长火焰尾（形态3+ 长距离火焰流）
    const tailLen = form >= 3 ? 2.6 : 2.2;
    ctx.fillStyle = 'rgba(120,26,8,0.75)';
    poly(ctx, [[-r * 0.4, -r * 0.5], [-r * tailLen * flick, -r * 0.18], [-r * 0.4, r * 0.1]]); ctx.fill();
    ctx.fillStyle = 'rgba(255,90,26,0.85)';
    poly(ctx, [[-r * 0.4, -r * 0.28], [-r * (tailLen - 0.35) * flick, 0], [-r * 0.4, r * 0.34]]); ctx.fill();
    ctx.fillStyle = 'rgba(255,180,50,0.85)';
    poly(ctx, [[-r * 0.4, -r * 0.1], [-r * (tailLen - 0.8) * flick, r * 0.05], [-r * 0.4, r * 0.18]]); ctx.fill();
    // 木柄
    ctx.fillStyle = '#4a2a12'; ctx.fillRect(-r * 1.42, -r * 0.18, r * 1.25, r * 0.36);
    ctx.fillStyle = '#6b4220'; ctx.fillRect(-r * 1.36, -r * 0.1, r * 1.12, r * 0.08);
    // 形态4：两侧火焰翼
    if (form >= 4) {
      ctx.fillStyle = 'rgba(255,90,26,0.7)';
      poly(ctx, [[r * 0.2, -r * 0.2], [r * 0.5, -r * 0.9], [r * 0.1, -r * 0.1]]); ctx.fill();
      poly(ctx, [[r * 0.2, r * 0.2], [r * 0.5, r * 0.9], [r * 0.1, r * 0.1]]); ctx.fill();
    }
    // 外层火焰（兽首轮廓，含两根焰角；形态3+ 完整炎魔轮廓）
    const fScale = form >= 3 ? 1.3 : 1;
    const fOuter = (sx, dir) => {
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, -r * 0.5 * fScale);
      ctx.quadraticCurveTo(r * 0.05, -r * 1.05 * flick * fScale, r * 0.42 + sx, -r * 1.18 * flick * fScale);
      ctx.quadraticCurveTo(r * 0.34, -r * 0.62 * fScale, r * 0.62, -r * 0.42 * fScale);
      ctx.quadraticCurveTo(r * 0.86, -r * 1.02 * flick * fScale, r * 1.08 + sx, -r * 0.86 * flick * fScale);
      ctx.quadraticCurveTo(r * 1.04, -r * 0.2 * fScale, r * 1.45 * dir * fScale, 0);
      ctx.quadraticCurveTo(r * 1.05, r * 0.5 * fScale, r * 0.66, r * 0.5 * fScale);
      ctx.quadraticCurveTo(r * 0.1, r * 0.78 * flick * fScale, -r * 0.2, r * 0.42 * fScale);
      ctx.quadraticCurveTo(-r * 0.42, 0, -r * 0.25, -r * 0.5 * fScale);
      ctx.closePath();
    };
    fOuter(0, 1);
    ctx.fillStyle = '#8c1a08'; ctx.fill();
    // 中层火焰
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.34 * fScale);
    ctx.quadraticCurveTo(r * 0.22, -r * 0.72 * fScale, r * 0.5, -r * 0.62 * fScale);
    ctx.quadraticCurveTo(r * 0.72, -r * 0.3 * fScale, r * 1.05 * fScale, 0);
    ctx.quadraticCurveTo(r * 0.72, r * 0.34 * fScale, r * 0.46, r * 0.36 * fScale);
    ctx.quadraticCurveTo(r * 0.12, r * 0.52 * fScale, -r * 0.08, r * 0.3 * fScale);
    ctx.quadraticCurveTo(-r * 0.24, 0, -r * 0.1, -r * 0.34 * fScale);
    ctx.closePath();
    ctx.fillStyle = '#ff5a1a'; ctx.fill();
    // 内层金焰 + 白焰芯（形态3+ 白焰核心扩大；形态4 巨大白焰核心）
    const coreScale = form >= 4 ? 1.6 : (form >= 3 ? 1.3 : 1);
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 0.2 * fScale);
    ctx.quadraticCurveTo(r * 0.45, -r * 0.4 * fScale, r * 0.78 * coreScale, 0);
    ctx.quadraticCurveTo(r * 0.5, r * 0.26 * fScale, r * 0.25, r * 0.24 * fScale);
    ctx.quadraticCurveTo(r * 0.05, r * 0.08 * fScale, r * 0.05, -r * 0.2 * fScale);
    ctx.closePath();
    ctx.fillStyle = '#ffb52e'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.28, -r * 0.08 * fScale);
    ctx.quadraticCurveTo(r * 0.56, -r * 0.12 * fScale, r * 0.66 * coreScale, 0);
    ctx.quadraticCurveTo(r * 0.5, r * 0.14 * fScale, r * 0.34, r * 0.1 * fScale);
    ctx.closePath();
    ctx.fillStyle = '#fff3d0'; ctx.fill();
    // 恶魔脸：怒眉 + 惨白双眼 + 锯齿嘴（形态4 更狰狞）
    ctx.fillStyle = '#5a0f04';
    poly(ctx, [[r * 0.3, -r * 0.34 * fScale], [r * 0.52, -r * 0.26 * fScale], [r * 0.48, -r * 0.18 * fScale], [r * 0.28, -r * 0.26 * fScale]]); ctx.fill();
    poly(ctx, [[r * 0.72, -r * 0.3 * fScale], [r * 0.94, -r * 0.36 * fScale], [r * 0.92, -r * 0.26 * fScale], [r * 0.72, -r * 0.2 * fScale]]); ctx.fill();
    ctx.fillStyle = form >= 4 ? '#ffffff' : '#fff3b0';
    ctx.beginPath(); ctx.ellipse(r * 0.42, -r * 0.13 * fScale, r * 0.09, r * 0.07, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.82, -r * 0.14 * fScale, r * 0.09, r * 0.07, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a0802';
    poly(ctx, [[r * 0.36, r * 0.12 * fScale], [r * 0.88, r * 0.1 * fScale], [r * 0.82, r * 0.26 * fScale], [r * 0.62, r * 0.18 * fScale], [r * 0.44, r * 0.28 * fScale]]); ctx.fill();
    ctx.restore();
  }

  /* —— 浪客 B：爆裂火炬（火星炸弹/烈焰爆弹/炎爆核心） —— */
  function drawBurst(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save(); ctx.scale(s, s);
    const flick = 1 + Math.sin(t * 22) * 0.1;
    // 短粗木柄 + 铁箍
    ctx.fillStyle = '#3a2412'; ctx.fillRect(-r * 1.15, -r * 0.26, r * 1.05, r * 0.52);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-r * 1.1, -r * 0.2, r * 0.92, r * 0.1);
    ctx.fillStyle = '#6b7280'; ctx.fillRect(-r * 0.32, -r * 0.3, r * 0.12, r * 0.6);
    // 球状主火团（形态3+ 不规则火球；形态4 巨型核心）
    const ballR = form >= 4 ? 1.2 : (form >= 3 ? 1.05 : (form >= 2 ? 0.96 : 0.86));
    glow(ctx, r * (form >= 3 ? 1.5 : 1.25) * flick, 'rgba(255,120,30,0.5)', 'rgba(255,60,10,0)');
    const ball = (rad, col) => {
      ctx.beginPath(); ctx.arc(r * 0.32, 0, rad, 0, TAU);
      ctx.fillStyle = col; ctx.fill();
    };
    ball(r * ballR * flick, '#7a1e08');
    ball(r * (ballR - 0.18) * flick, '#ff5a1a');
    ball(r * (ballR - 0.4) * flick, '#ffb02e');
    ball(r * (ballR - 0.66) * flick, '#fff0b0');
    // 表面裂纹（形态2+ 增加；形态4 持续爆裂纹）
    const crackCount = form >= 4 ? 6 : (form >= 3 ? 5 : (form >= 2 ? 4 : 2));
    ctx.strokeStyle = '#4a0e04'; ctx.lineWidth = 2;
    for (let i = 0; i < crackCount; i++) {
      const a = i * TAU / crackCount + t * (form >= 4 ? 1.2 : 0);
      const rr = r * ballR * 0.92;
      ctx.beginPath();
      ctx.moveTo(r * 0.32 + Math.cos(a) * rr * 0.5, Math.sin(a) * rr * 0.5);
      ctx.lineTo(r * 0.32 + Math.cos(a) * rr, Math.sin(a) * rr);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,240,180,0.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.36); ctx.lineTo(r * 0.3, -r * 0.06); ctx.stroke();
    // 形态3+ 内部高亮爆炸核心
    if (form >= 3) {
      glow(ctx, r * 0.4, 'rgba(255,255,200,0.9)', 'rgba(255,180,60,0)');
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(r * 0.32, 0, r * 0.18 * (1 + Math.sin(t * 12) * 0.2), 0, TAU); ctx.fill();
    }
    // 环绕火球：3 → 5 → 8 → 12
    const fireCount = form >= 4 ? 12 : (form >= 3 ? 8 : (form >= 2 ? 5 : 3));
    for (let k = 0; k < fireCount; k++) {
      const a = t * (form >= 4 ? 3.2 : 2.4) + k * TAU / fireCount;
      const orbit = form >= 2 ? r * 1.4 : r * 1.28;
      const fx = r * 0.32 + Math.cos(a) * orbit, fy = Math.sin(a) * r * 0.95;
      const ff = 1 + Math.sin(t * 18 + k * 2) * 0.2;
      ctx.beginPath(); ctx.arc(fx, fy, r * (form >= 2 ? 0.24 : 0.2) * ff, 0, TAU);
      ctx.fillStyle = '#ff5a1a'; ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy, r * 0.1 * ff, 0, TAU);
      ctx.fillStyle = '#ffe066'; ctx.fill();
    }
    ctx.restore();
  }

  /* —— 战狂 A：狂战巨斧（血刃巨斧/狂神战斧/灭世巨斧） —— */
  function drawBerserk(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save();
    ctx.rotate(t * 5.5);
    ctx.scale(s, s);
    // 斩击弧（形态2+ 双重；形态4 完整圆形斩击光环）
    const arcLayers = form >= 4 ? 2 : (form >= 2 ? 2 : 1);
    for (let l = 0; l < arcLayers; l++) {
      const rr = r * (1.55 + l * 0.35);
      ctx.strokeStyle = l === 0 ? 'rgba(255,60,50,0.22)' : 'rgba(255,120,90,0.18)';
      ctx.lineWidth = r * (0.34 - l * 0.1);
      ctx.beginPath(); ctx.arc(0, 0, rr, -0.5, 0.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, rr, Math.PI - 0.5, Math.PI + 0.7); ctx.stroke();
    }
    // 形态4：完整圆形斩击光环
    if (form >= 4) {
      ctx.strokeStyle = 'rgba(255,60,50,0.5)'; ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.arc(0, 0, r * 2.1, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,180,150,0.3)'; ctx.lineWidth = r * 0.06;
      ctx.beginPath(); ctx.arc(0, 0, r * 2.35, 0, TAU); ctx.stroke();
    }
    // 斧柄
    ctx.fillStyle = '#1a1018'; ctx.fillRect(-r * 1.7, -r * 0.11, r * 3.4, r * 0.22);
    ctx.fillStyle = '#5a3416'; ctx.fillRect(-r * 1.62, -r * 0.05, r * 3.24, r * 0.1);
    const bladeW = form >= 3 ? 1.25 : (form >= 2 ? 1.1 : 1);
    const blade = (dir) => {
      // 厚重双刃（比常规斧宽约 30%）
      ctx.beginPath();
      ctx.moveTo(dir * r * 0.5, -r * 0.16);
      ctx.quadraticCurveTo(dir * r * 1.5 * bladeW, -r * 0.72, dir * r * 1.92 * bladeW, -r * 0.62);
      ctx.quadraticCurveTo(dir * r * 1.55, 0, dir * r * 1.92 * bladeW, r * 0.62);
      ctx.quadraticCurveTo(dir * r * 1.5 * bladeW, r * 0.72, dir * r * 0.5, r * 0.16);
      ctx.closePath();
      ctx.fillStyle = '#14141c'; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(dir * r * 0.62, -r * 0.1);
      ctx.quadraticCurveTo(dir * r * 1.36 * bladeW, -r * 0.52, dir * r * 1.68 * bladeW, -r * 0.44);
      ctx.quadraticCurveTo(dir * r * 1.42, 0, dir * r * 1.68 * bladeW, r * 0.44);
      ctx.quadraticCurveTo(dir * r * 1.36 * bladeW, r * 0.52, dir * r * 0.62, r * 0.1);
      ctx.closePath();
      ctx.fillStyle = form >= 3 ? '#b83838' : '#9aa6b8'; ctx.fill();
      ctx.beginPath();
      ctx.ellipse(dir * r * 1.42 * bladeW, 0, r * 0.24, r * 0.34, 0, 0, TAU);
      ctx.fillStyle = '#e8eef5'; ctx.fill();
    };
    blade(1); blade(-1);
    // 形态2+ 斧刃边缘红色能量刃
    if (form >= 2) {
      ctx.strokeStyle = 'rgba(255,60,50,0.85)'; ctx.lineWidth = r * 0.08; ctx.lineCap = 'round';
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(dir * r * 1.2 * bladeW, 0, r * 1.0 * bladeW, -0.55, 0.55); ctx.stroke();
      }
    }
    // 形态4 斧面血红纹路
    if (form >= 4) {
      ctx.strokeStyle = 'rgba(180,20,20,0.7)'; ctx.lineWidth = 1.5;
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const yy = -r * 0.4 + i * r * 0.32;
          ctx.beginPath(); ctx.moveTo(dir * r * 0.7, yy); ctx.lineTo(dir * r * 1.6 * bladeW, yy + (i - 1) * r * 0.08); ctx.stroke();
        }
      }
    }
    // 中央红色裂纹核心（形态2+ 延伸至整个斧面；形态3+ 持续发光）
    const cf = 1 + Math.sin(t * 10) * 0.18;
    glow(ctx, r * (form >= 3 ? 0.55 : 0.42) * cf, 'rgba(255,60,40,0.7)', 'rgba(255,40,30,0)');
    ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2.2;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * r * 0.2, 0); ctx.lineTo(dir * r * (form >= 2 ? 1.1 : 0.62), -r * 0.18);
      ctx.moveTo(dir * r * 0.2, 0); ctx.lineTo(dir * r * (form >= 2 ? 1.15 : 0.66), r * 0.12);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd23b';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* —— 战狂 B：裂地战斧（断岳战斧/崩山巨斧/裂地神斧） —— */
  function drawQuake(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save();
    ctx.rotate(t * 2.1);
    ctx.scale(s, s);
    // 碎石（形态2+ 明显增加）
    const rockBase = [[-1.45, 0.7, 0.32], [1.35, 0.85, 0.26], [1.5, -0.72, 0.34], [-1.1, -0.9, 0.24]];
    const extraRocks = form >= 4 ? [[0.5, 1.2, 0.2], [-0.6, -1.15, 0.22], [1.8, 0.2, 0.18], [-1.7, 0.3, 0.2]] :
                        form >= 3 ? [[0.5, 1.2, 0.2], [-0.6, -1.15, 0.22]] :
                        form >= 2 ? [[0.6, 1.1, 0.18]] : [];
    const rocks = rockBase.concat(extraRocks);
    rocks.forEach((p, i) => {
      const a = -t * 1.2 + i * 2.1;
      const rx = p[0] * r + Math.cos(a) * r * 0.1, ry = p[1] * r + Math.sin(a) * r * 0.1;
      ctx.save(); ctx.translate(rx, ry); ctx.rotate(a * 1.5);
      const ss = p[2] * r;
      ctx.fillStyle = form >= 4 ? '#8c7346' : '#9c8456';
      poly(ctx, [[ss, -ss * 0.2], [ss * 0.3, -ss], [-ss * 0.7, -ss * 0.8], [-ss, ss * 0.1], [-ss * 0.3, ss * 0.9], [ss * 0.6, ss * 0.6]]);
      ctx.fill();
      ctx.strokeStyle = '#5e4f38'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(230,205,150,0.5)';
      poly(ctx, [[ss * 0.3, -ss * 0.55], [-ss * 0.3, -ss * 0.6], [0, -ss * 0.15]]); ctx.fill();
      ctx.restore();
    });
    // 长斧柄（形态3+ 加长）
    const handleLen = form >= 3 ? 1.15 : 1;
    ctx.fillStyle = '#241710'; ctx.fillRect(-r * 1.95 * handleLen, -r * 0.09, r * 3.1 * handleLen, r * 0.18);
    ctx.fillStyle = '#6b4a24'; ctx.fillRect(-r * 1.86 * handleLen, -r * 0.03, r * 2.92 * handleLen, r * 0.06);
    // 钩状斧刃（前端；形态2+ 双层钩刃；形态4 断裂山岩状）
    const bladeScale = form >= 3 ? 1.3 : (form >= 2 ? 1.12 : 1);
    ctx.beginPath();
    ctx.moveTo(r * 0.85, -r * 0.12);
    ctx.quadraticCurveTo(r * 1.35 * bladeScale, -r * 0.95, r * 1.95 * bladeScale, -r * 0.55);
    ctx.quadraticCurveTo(r * 1.62, -r * 0.3, r * 1.35, -r * 0.12);
    ctx.quadraticCurveTo(r * 1.5, r * 0.18, r * 1.18, r * 0.34);
    ctx.quadraticCurveTo(r * 1.05, r * 0.12, r * 0.85, r * 0.12);
    ctx.closePath();
    ctx.fillStyle = form >= 4 ? '#6b5a36' : '#6f5c38'; ctx.fill();
    ctx.strokeStyle = '#3a2e18'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 1.1, -r * 0.22);
    ctx.quadraticCurveTo(r * 1.45 * bladeScale, -r * 0.62, r * 1.72 * bladeScale, -r * 0.48);
    ctx.quadraticCurveTo(r * 1.45, -r * 0.3, r * 1.28, -r * 0.16);
    ctx.closePath();
    ctx.fillStyle = '#d9c08a'; ctx.fill();
    // 形态2+ 第二层钩刃
    if (form >= 2) {
      ctx.beginPath();
      ctx.moveTo(r * 1.0, r * 0.18);
      ctx.quadraticCurveTo(r * 1.5 * bladeScale, r * 0.5, r * 1.85 * bladeScale, r * 0.28);
      ctx.quadraticCurveTo(r * 1.55, r * 0.1, r * 1.2, r * 0.12);
      ctx.closePath();
      ctx.fillStyle = '#8a7448'; ctx.fill();
      ctx.strokeStyle = '#3a2e18'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // 形态4 断裂山岩纹理
    if (form >= 4) {
      ctx.strokeStyle = 'rgba(60,46,24,0.7)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const yy = -r * 0.3 + i * r * 0.2;
        ctx.beginPath(); ctx.moveTo(r * 1.0, yy); ctx.lineTo(r * 1.7 * bladeScale, yy + r * 0.1); ctx.stroke();
      }
    }
    // 尾端配重锤
    ctx.fillStyle = '#4a3a22';
    ctx.fillRect(-r * 2.05 * handleLen, -r * 0.26, r * 0.3, r * 0.52);
    ctx.fillStyle = '#8a744a';
    ctx.fillRect(-r * 2.0 * handleLen, -r * 0.18, r * 0.2, r * 0.36);
    ctx.restore();
  }

  /* —— 超猫 A：毁灭光炮（重型光炮/歼星光炮/终焉光炮） —— */
  function drawCannon(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save(); ctx.scale(s, s);
    const pulse = 1 + Math.sin(t * 16) * 0.08;
    glow(ctx, r * (form >= 3 ? 1.9 : 1.55) * pulse, 'rgba(255,46,136,0.4)', 'rgba(255,46,136,0)');
    // 尾部压缩能量环（逐圈扩散；形态3+ 更多层）
    const ringN = form >= 3 ? 3 : 2;
    for (let i = 0; i < ringN; i++) {
      const ph = (t * 1.6 + i * (1 / ringN)) % 1;
      ctx.strokeStyle = `rgba(255,120,190,${0.5 * (1 - ph)})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(-r * 1.62 - ph * r * 0.4, 0, r * (0.2 + ph * 0.22), r * (0.5 + ph * 0.55), 0, 0, TAU);
      ctx.stroke();
    }
    // 大型炮口（尾部侧视大环；形态2+ 大型玫红炮口；形态4 环形炮台）
    const muzzleScale = form >= 4 ? 1.35 : (form >= 2 ? 1.15 : 1);
    ctx.beginPath(); ctx.ellipse(-r * 1.5, 0, r * 0.24 * muzzleScale, r * 0.66 * muzzleScale, 0, 0, TAU);
    ctx.fillStyle = '#3c0a22'; ctx.fill();
    ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-r * 1.5, 0, r * 0.13 * muzzleScale, r * 0.42 * muzzleScale, 0, 0, TAU);
    ctx.strokeStyle = '#ffa3cf'; ctx.lineWidth = 2; ctx.stroke();
    // 形态4 炮台外环
    if (form >= 4) {
      ctx.strokeStyle = 'rgba(255,120,190,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(-r * 1.5, 0, r * 0.34 * muzzleScale, r * 0.88 * muzzleScale, 0, 0, TAU); ctx.stroke();
    }
    // 粗光束主体（形态2+ 加粗；形态3+ 巨型能量柱）
    const beamW = form >= 3 ? 1.35 : (form >= 2 ? 1.15 : 1);
    const beam = (x0, x1, half, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x0, -half);
      ctx.lineTo(x1 - half, -half);
      ctx.arc(x1 - half, 0, half, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x0, half);
      ctx.closePath(); ctx.fill();
    };
    beam(-r * 1.28, r * 1.72, r * 0.62 * pulse * beamW, 'rgba(255,46,136,0.35)');
    beam(-r * 1.22, r * 1.68, r * 0.46 * beamW, '#7a0e3c');
    beam(-r * 1.16, r * 1.62, r * 0.34 * beamW, '#ff2e88');
    beam(-r * 1.1, r * 1.55, r * 0.19 * beamW, '#ffb0d4');
    // 白芯（形态2+ 双层；形态3+ 高亮白色核心；形态4 巨型白色核心）
    if (form >= 2) {
      beam(-r * 1.08, r * 1.5, r * 0.13 * beamW, 'rgba(255,200,230,0.9)');
      beam(-r * 1.05, r * 1.45, r * 0.07 * beamW, '#ffffff');
    } else {
      beam(-r * 1.04, r * 1.5, r * 0.1, '#ffffff');
    }
    // 旋转光环（环绕束身；形态2+ 第二层；形态3+ 多层）
    const ringCount = form >= 3 ? 3 : (form >= 2 ? 2 : 1);
    for (let ri = 0; ri < ringCount; ri++) {
      ctx.save(); ctx.translate(-r * 0.15, 0);
      ctx.rotate(t * (4 + ri * 1.5) * (ri % 2 ? -1 : 1));
      ctx.strokeStyle = ri === 0 ? 'rgba(255,190,225,0.9)' : 'rgba(255,120,190,0.7)';
      ctx.lineWidth = 2 - ri * 0.3;
      ctx.beginPath(); ctx.arc(0, 0, r * (0.86 + ri * 0.18), 0, 1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * (0.86 + ri * 0.18), Math.PI + 0.2, Math.PI + 1.7); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(-r * 0.15, 0, r * 0.98, 1.8, 2.8); ctx.stroke();
    // 形态4 光束边缘能量碎片
    if (form >= 4) {
      for (let i = 0; i < 6; i++) {
        const fx = -r * 0.8 + (i / 5) * r * 2.4;
        const fy = (i % 2 ? 1 : -1) * (r * 0.7 * beamW + r * 0.1);
        ctx.fillStyle = 'rgba(255,180,220,0.8)';
        ctx.beginPath(); ctx.arc(fx, fy, r * 0.06, 0, TAU); ctx.fill();
      }
    }
    // 前端亮头
    glow(ctx, r * 0.4 * pulse, 'rgba(255,255,255,0.9)', 'rgba(255,150,200,0)');
    ctx.restore();
  }

  /* —— 超猫 B：裂空光束（三叉裂光/六芒裂空/裂空光阵） —— */
  function drawRift(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save(); ctx.scale(s, s);
    const pulse = 1 + Math.sin(t * 18) * 0.1;
    const shaft = (x0, y0, x1, y1, w0, w1) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * w0, ny = dx / len * w0;
      const tx = -dy / len * w1, ty = dx / len * w1;
      const layers = [
        [1.5, 'rgba(208,107,255,0.4)'],
        [1.05, '#a02ee0'],
        [0.62, '#e08bff'],
        [0.28, '#ffffff']
      ];
      layers.forEach(L => {
        ctx.fillStyle = L[1];
        ctx.beginPath();
        ctx.moveTo(x0 + nx * L[0], y0 + ny * L[0]);
        ctx.lineTo(x1 + tx * L[0], y1 + ty * L[0]);
        ctx.lineTo(x1 - tx * L[0], y1 - ty * L[0]);
        ctx.lineTo(x0 - nx * L[0], y0 - ny * L[0]);
        ctx.closePath(); ctx.fill();
      });
    };
    glow(ctx, r * (form >= 3 ? 1.8 : 1.4), 'rgba(208,107,255,0.3)', 'rgba(208,107,255,0)');
    // 形态4：大型扇形光阵（多层副光束）
    if (form >= 4) {
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const ang = i * 0.16;
        shaft(-r * 1.5, 0, r * 1.6, Math.sin(ang) * r * 1.4, r * 0.12, r * 0.06);
      }
    }
    // 副光束（自尾部张开；形态2+ 角度张开；形态3+ 分裂为六道）
    const spread = form >= 2 ? 1.15 : 1;
    const subAng = r * 1.02 * pulse * spread;
    if (form >= 3) {
      // 六道交错光束
      shaft(-r * 1.5, 0, r * 1.05, -subAng * 1.3, r * 0.16, r * 0.1);
      shaft(-r * 1.5, 0, r * 1.05, -subAng * 0.6, r * 0.14, r * 0.08);
      shaft(-r * 1.5, 0, r * 1.05, subAng * 0.6, r * 0.14, r * 0.08);
      shaft(-r * 1.5, 0, r * 1.05, subAng * 1.3, r * 0.16, r * 0.1);
    } else {
      shaft(-r * 1.5, 0, r * 1.05, -subAng, r * 0.2, r * 0.12);
      shaft(-r * 1.5, 0, r * 1.05, subAng, r * 0.2, r * 0.12);
    }
    // 主光束（形态3+ 粗主光束保留）
    const mainW = form >= 3 ? r * 0.42 : r * 0.36;
    shaft(-r * 1.55, 0, r * 1.85, 0, mainW, r * 0.2);
    // 形态3+ 中央六芒能量核心
    if (form >= 3) {
      ctx.save(); ctx.rotate(t * 3);
      ctx.fillStyle = 'rgba(255,200,255,0.8)';
      rays(ctx, 6, r * 0.12, r * 0.4, r * 0.08, 0);
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
    }
    // 能量连接丝（形态2+ 更明显）
    ctx.strokeStyle = 'rgba(240,190,255,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.36); ctx.lineTo(-r * 0.1, -r * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.36); ctx.lineTo(-r * 0.1, r * 0.2); ctx.stroke();
    if (form >= 2) {
      ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.3); ctx.lineTo(r * 0.3, -r * 0.12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.2, r * 0.3); ctx.lineTo(r * 0.3, r * 0.12); ctx.stroke();
    }
    // 前亮端
    const tips = form >= 3
      ? [[r * 1.85, 0], [r * 1.05, -subAng * 1.3], [r * 1.05, subAng * 1.3]]
      : [[r * 1.85, 0], [r * 1.05, -subAng], [r * 1.05, subAng]];
    tips.forEach(p => {
      ctx.fillStyle = 'rgba(255,240,255,0.95)';
      ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.12, 0, TAU); ctx.fill();
    });
    ctx.restore();
  }

  /* —— 魅影 A：鬼王（鬼王怨面/冥界鬼王/幽冥帝君） —— */
  function drawKing(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.20;
    ctx.save(); ctx.scale(s, s);
    const flick = 1 + Math.sin(t * 16) * 0.12;
    // 双带长尾焰（形态3+ 长距离；形态4 巨大鬼焰）
    const tailLen = form >= 4 ? 2.8 : (form >= 3 ? 2.6 : 2.4);
    ctx.fillStyle = '#2e1260';
    poly(ctx, [[-r * 0.3, -r * 0.55], [-r * tailLen * flick, -r * 0.3], [-r * 0.3, -r * 0.05]]); ctx.fill();
    poly(ctx, [[-r * 0.3, r * 0.55], [-r * (tailLen - 0.2) * flick, r * 0.34], [-r * 0.3, r * 0.08]]); ctx.fill();
    ctx.fillStyle = 'rgba(255,123,213,0.6)';
    poly(ctx, [[-r * 0.5, -r * 0.22], [-r * (tailLen - 0.5) * flick, 0], [-r * 0.5, r * 0.2]]); ctx.fill();
    // 巨大弯角（形态2+ 变长；形态4 向两侧展开）
    ctx.lineCap = 'round';
    const hornLen = form >= 4 ? 1.85 : (form >= 2 ? 1.78 : 1.7);
    ctx.strokeStyle = '#b69af2'; ctx.lineWidth = r * 0.4;
    ctx.beginPath(); ctx.moveTo(-r * 0.12, -r * 0.7); ctx.quadraticCurveTo(-r * 0.95, -r * 1.15, -r * 0.95, -r * hornLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.7); ctx.quadraticCurveTo(-r * 0.05, -r * 1.35, r * 0.45, -r * hornLen); ctx.stroke();
    ctx.strokeStyle = '#6d3fd0'; ctx.lineWidth = r * 0.26;
    ctx.beginPath(); ctx.moveTo(-r * 0.12, -r * 0.72); ctx.quadraticCurveTo(-r * 0.78, -r * 1.1, -r * 0.8, -r * (hornLen - 0.18)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.28, -r * 0.72); ctx.quadraticCurveTo(0, -r * 1.22, r * 0.36, -r * (hornLen - 0.18)); ctx.stroke();
    // 鬼头（形态3+ 巨大头颅）
    const headR = form >= 3 ? 1.18 : 1.02;
    glow(ctx, r * 1.5 * flick, 'rgba(140,80,240,0.5)', 'rgba(110,50,200,0)');
    ctx.fillStyle = '#3a1a66';
    ctx.beginPath(); ctx.arc(0, 0, r * headR, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6d3fd0';
    ctx.beginPath(); ctx.arc(0, 0, r * (headR - 0.2), 0, TAU); ctx.fill();
    ctx.fillStyle = '#a87ee8';
    ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.12, r * 0.5, 0, TAU); ctx.fill();
    // 形态3+ 周围环绕紫黑鬼火；形态4 旋转鬼火环
    if (form >= 3) {
      ctx.save(); ctx.rotate(t * (form >= 4 ? 1.8 : 1.0));
      for (let i = 0; i < (form >= 4 ? 8 : 5); i++) {
        const a = i * TAU / (form >= 4 ? 8 : 5);
        const fx = Math.cos(a) * r * 1.5, fy = Math.sin(a) * r * 1.5;
        ctx.fillStyle = 'rgba(140,60,220,0.7)';
        ctx.beginPath(); ctx.arc(fx, fy, r * 0.16, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(180,120,255,0.8)';
        ctx.beginPath(); ctx.arc(fx, fy, r * 0.08, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // 惨白高亮双眼 + 怒眉（形态4 纯白能量核心）
    ctx.fillStyle = '#1a0b33';
    poly(ctx, [[r * 0.02, -r * 0.5], [r * 0.34, -r * 0.42], [r * 0.3, -r * 0.32], [0, -r * 0.4]]); ctx.fill();
    poly(ctx, [[r * 0.42, -r * 0.4], [r * 0.74, -r * 0.48], [r * 0.72, -r * 0.36], [r * 0.44, -r * 0.28]]); ctx.fill();
    ctx.fillStyle = form >= 4 ? '#ffffff' : '#f4ecff';
    if (form >= 4) {
      glow(ctx, r * 0.5, 'rgba(255,255,255,0.8)', 'rgba(200,180,255,0)');
    }
    ctx.beginPath(); ctx.ellipse(r * 0.18, -r * 0.28, r * 0.13, r * 0.08, -0.15, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.58, -r * 0.28, r * 0.13, r * 0.08, -0.15, 0, TAU); ctx.fill();
    // 嘴 + 獠牙（形态2+ 裂开更明显）
    const mouthW = form >= 2 ? 0.24 : 0.2;
    ctx.fillStyle = '#1a0b33';
    ctx.beginPath(); ctx.ellipse(r * 0.38, r * 0.24, r * mouthW, r * 0.16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    poly(ctx, [[r * 0.28, r * 0.12], [r * 0.36, r * 0.12], [r * 0.32, r * 0.26]]); ctx.fill();
    poly(ctx, [[r * 0.48, r * 0.12], [r * 0.56, r * 0.14], [r * 0.5, r * 0.28]]); ctx.fill();
    ctx.restore();
  }

  /* —— 魅影 B：百鬼（小主鬼脸 + 3 个环绕小鬼魂 + 鬼火环） —— */
  function littleGhost(ctx, r, body, hi) {
    // 圆头 + 波浪下摆
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.55);
    ctx.arc(0, -r * 0.1, r, Math.PI, 0, false);
    ctx.lineTo(r, r * 0.55);
    ctx.quadraticCurveTo(r * 0.55, r * 0.32, r * 0.25, r * 0.58);
    ctx.quadraticCurveTo(0, r * 0.34, -r * 0.25, r * 0.58);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.32, -r, r * 0.55);
    ctx.closePath();
    ctx.fillStyle = body; ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.2, r * 0.42, 0, TAU);
    ctx.fillStyle = hi; ctx.fill();
    ctx.fillStyle = '#1a0b33';
    ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.16, r * 0.09, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.18, -r * 0.16, r * 0.09, 0, TAU); ctx.fill();
  }
  /* —— 魅影 B：百鬼（五鬼/鬼群/百鬼夜行） —— */
  function drawHundred(ctx, r, t, form) {
    form = form || 1;
    const s = 1 + (form - 1) * 0.18;
    ctx.save(); ctx.scale(s, s);
    // 鬼火环（形态2+ 更明显；形态4 多层螺旋）
    ctx.save(); ctx.rotate(t * 0.8);
    ctx.strokeStyle = 'rgba(168,116,255,0.4)'; ctx.lineWidth = 1.6;
    ctx.setLineDash([r * 0.18, r * 0.22]);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.18, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (form >= 4) {
      ctx.save(); ctx.rotate(-t * 0.5);
      ctx.strokeStyle = 'rgba(140,80,220,0.3)'; ctx.lineWidth = 1.2;
      ctx.setLineDash([r * 0.12, r * 0.18]);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // 环绕小鬼魂：3 → 5 → 9 → 14（形态3+ 多层）
    const ghostCount = form >= 4 ? 14 : (form >= 3 ? 9 : (form >= 2 ? 5 : 3));
    const orbit = form >= 2 ? r * 1.25 : r * 1.08;
    for (let k = 0; k < ghostCount; k++) {
      const layer = form >= 3 ? (k % 2) : 0;
      const a = t * (2.6 + layer * 0.5) + k * TAU / ghostCount;
      const oo = orbit + (layer ? r * 0.5 : 0);
      ctx.save();
      ctx.translate(Math.cos(a) * oo, Math.sin(a) * oo * (form >= 3 ? 0.96 : 1));
      const gr = r * (form >= 4 ? (0.22 + (k % 3) * 0.06) : 0.3);
      littleGhost(ctx, gr, '#8b55e0', '#c39bff');
      ctx.restore();
    }
    // 形态3+ 多条紫色鬼焰拖尾
    if (form >= 3) {
      ctx.fillStyle = 'rgba(180,120,255,0.35)';
      for (let i = 0; i < 3; i++) {
        const yy = -r * 0.3 + i * r * 0.3;
        poly(ctx, [[-r * 0.4, yy], [-r * (1.4 + i * 0.15) * (1 + Math.sin(t * 8 + i) * 0.12), yy * 0.4], [-r * 0.4, yy + r * 0.12]]); ctx.fill();
      }
    }
    // 主鬼脸（形态3+ 作为核心；形态4 进一步缩小）
    const mainR = form >= 4 ? r * 0.4 : (form >= 3 ? r * 0.46 : r * 0.52);
    glow(ctx, r * 0.8, 'rgba(150,90,240,0.45)', 'rgba(120,60,210,0)');
    ctx.fillStyle = '#5a2fb8';
    ctx.beginPath(); ctx.arc(0, 0, mainR, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a87ee8';
    ctx.beginPath(); ctx.arc(-mainR * 0.13, -mainR * 0.13, mainR * 0.58, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0b33';
    ctx.fillRect(mainR * 0.04, -mainR * 0.38, mainR * 0.23, mainR * 0.3);
    ctx.fillRect(mainR * 0.42, -mainR * 0.33, mainR * 0.23, mainR * 0.3);
    ctx.fillRect(mainR * 0.27, mainR * 0.19, mainR * 0.15, mainR * 0.23);
    // 尾焰小尖
    ctx.fillStyle = 'rgba(255,123,213,0.7)';
    poly(ctx, [[-mainR * 0.58, -mainR * 0.38], [-mainR * 1.83 * (1 + Math.sin(t * 14) * 0.15), 0], [-mainR * 0.58, mainR * 0.38]]); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
   * 三、风格强度计算与成长辅助
   * ============================================================ */

  /** 由风格成长次数推算当前形态：growth 1-3→形1，4-6→形2，7-9→形3，10-12→形4 */
  function getForm(growth) {
    if (growth < 1) return 1;
    return Math.min(4, Math.ceil(growth / 3));
  }

  /** 查找风格数据（返回 {name, accent, speed, forms, ...}） */
  function findStyle(styleId) {
    for (const hid in STYLES) {
      const g = STYLES[hid];
      if (g.a.id === styleId) return g.a;
      if (g.b.id === styleId) return g.b;
    }
    return null;
  }

  /** 首次风格化的强度倍率（近2倍；速度越快倍率越低，越慢越高）
   *  normal speed=1.0 → ~1.9x；slow 0.8 → 2.0x；fast 1.45 → 1.68x */
  function firstBoostMul(styleId) {
    const st = findStyle(styleId);
    const sp = st ? st.speed : 1.0;
    return Math.round((2.4 - sp * 0.5) * 100) / 100;
  }

  /** 首次风格化：写入风格状态 + 应用强度提升（伤害倍率，含速度补偿）
   *  并给予弹体体积/穿透的小幅成长 */
  function applyFirstStyle(p, styleId) {
    p.bulletStyleId = styleId;
    p.bulletStyleGrowth = 0;
    const mul = firstBoostMul(styleId);
    p.dmg = Math.round(p.dmg * mul);
    // 弹体随形态略增（基础放大系数）
    p.bulletStyleSize = 1.0;
    // 专属弹道合并：正面/尾部/下部每向只射 1 发风格弹（尾/下炮管解锁状态保留，元素弹不受影响）
    // 后续可通过「弹道强化」成长卡重新堆叠每向弹数
    p.bulletCount = 1;
    p.wayLv = 0;
    return mul;
  }

  /** 单次风格成长：累计成长次数 + 强度提升
   *  - 形态跃迁点（growth达到4/7/10 → 形2/3/4）：较大提升（伤害+8~10，弹体放大）
   *  - 形态内成长：较小提升（伤害+4）
   *  返回 {formUp: 是否形态跃迁, dmgBoost} */
  function applyStyleGrowth(p) {
    if (!p.bulletStyleId || p.bulletStyleGrowth >= 12) return null;
    p.bulletStyleGrowth++;
    const newGrowth = p.bulletStyleGrowth;
    const oldForm = getForm(newGrowth - 1);
    const newForm = getForm(newGrowth);
    const formUp = newForm > oldForm;
    let dmgBoost;
    if (formUp) {
      // 形态跃迁：较大提升；最后一次（形4）更大
      dmgBoost = newForm === 4 ? 11 : (newForm === 3 ? 9 : 8);
      p.bulletStyleSize = (p.bulletStyleSize || 1.0) + 0.10;
    } else {
      dmgBoost = 4;
      p.bulletStyleSize = (p.bulletStyleSize || 1.0) + 0.03;
    }
    p.dmg += dmgBoost;
    return { formUp, dmgBoost, newForm, newGrowth };
  }

  /** 获取玩家当前风格形态（无风格返回 0） */
  function playerForm(p) {
    if (!p.bulletStyleId) return 0;
    return getForm(p.bulletStyleGrowth);
  }

  const DRAWERS = {
    ice: drawIce, holy: drawHoly,
    qinglong: drawQinglong, liuyun: drawLiuyun,
    sun: drawSun, rainbow: drawRainbow,
    demon: drawDemon, burst: drawBurst,
    berserk: drawBerserk, quake: drawQuake,
    cannon: drawCannon, rift: drawRift,
    king: drawKing, hundred: drawHundred
  };

  /**
   * 统一风格弹绘制（供 Bullet.render / 预览界面共用）
   * @param styleId 风格 id（如 'ice'）  @param form 形态 1-4
   * @param x,y 中心  @param ang 朝向  @param t 存活时间  @param r 基准半径
   */
  function draw(ctx, styleId, form, x, y, ang, t, r) {
    const fn = DRAWERS[styleId] || drawIce;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    fn(ctx, r || 12, t || 0, Math.min(4, Math.max(1, form || 1)));
    ctx.restore();
  }

  /* ============================================================
   * 四、风格二选一界面（?styleui=1 预览）
   * ============================================================ */
  const W = 322, H = 132;
  let previews = [];
  let curHero = 'xiaobai';
  let curForm = 1;             // 当前预览的形态 1-4
  let root = null, cardsEl = null, titleEl = null, baseEl = null, avatarEl = null, heroNameEl = null;
  let picked = 0;          // 0 未选 / 1 / 2
  let rafOn = false;

  function heroIds() {
    return (window.CHARS && CHARS.ORDER) || ['xiaobai', 'xiake', 'mofashi', 'buliang', 'jiaodoushi', 'chaoren', 'meiying'];
  }

  function buildPanel() {
    root = document.getElementById('stylepick');
    if (!root) return;
    cardsEl = document.getElementById('sp-cards');
    titleEl = document.getElementById('sp-title');
    baseEl = document.getElementById('sp-base');
    avatarEl = document.getElementById('sp-avatar');
    heroNameEl = document.getElementById('sp-hero-name');
    document.getElementById('sp-prev').addEventListener('click', () => switchHero(-1));
    document.getElementById('sp-next').addEventListener('click', () => switchHero(1));
    document.getElementById('sp-close').addEventListener('click', () => { if (!realMode) hide(); });
    document.addEventListener('keydown', (e) => {
      if (!root || root.classList.contains('hidden')) return;
      if (e.repeat) return;
      if (e.key === 'ArrowLeft') switchHero(-1);
      else if (e.key === 'ArrowRight') switchHero(1);
      else if (e.key === 'q' || e.key === 'Q') setForm(curForm - 1);
      else if (e.key === 'e' || e.key === 'E') setForm(curForm + 1);
      else if (e.key === '1') flashPick(1);
      else if (e.key === '2') flashPick(2);
      else if (e.key === 'Escape') { if (!realMode) hide(); }
    });
  }

  function switchHero(d) {
    const ids = heroIds();
    let i = ids.indexOf(curHero);
    if (i < 0) i = 0;
    curHero = ids[(i + d + ids.length) % ids.length];
    picked = 0;
    renderHero();
  }

  function setForm(f) {
    f = Math.min(4, Math.max(1, f | 0));
    if (f === curForm) return;
    curForm = f;
    renderHero();
  }

  function renderHero() {
    const c = CHARS.get(curHero);
    const grp = STYLES[curHero];
    if (!c || !grp) return;
    titleEl.textContent = c.name + ' · 风格觉醒';
    heroNameEl.textContent = c.name;
    baseEl.textContent = grp.base;
    avatarEl.src = c.face || c.art;
    cardsEl.innerHTML = '';
    previews = [];
    [grp.a, grp.b].forEach((s, idx) => {
      const card = document.createElement('div');
      card.className = 'sp-card';
      card.style.setProperty('--ac', s.accent);
      card.innerHTML =
        '<div class="sp-badge">' + s.key + '</div>' +
        '<canvas class="sp-canvas" width="' + W + '" height="' + H + '"></canvas>' +
        '<div class="sp-form-tag">形态 ' + curForm + ' · ' + s.forms[curForm - 1] + '</div>' +
        '<div class="sp-name">' + s.name + '</div>' +
        '<div class="sp-pos">' + s.pos.map(p => '<span>' + p + '</span>').join('') + '</div>' +
        '<div class="sp-f1">' + s.f1 + '</div>' +
        '<div class="sp-road" data-idx="' + idx + '">' +
          s.forms.map((f, i) =>
            '<div class="sp-node' + (i === curForm - 1 ? ' on' : '') + '" data-form="' + (i + 1) + '"><b>' + (i + 1) + '</b>' + f + '</div>' +
            (i < 3 ? '<div class="sp-link"></div>' : '')
          ).join('') +
        '</div>' +
        '<div class="sp-choose">选择此风格</div>' +
        '<div class="sp-picked">✓ 已锁定此风格</div>';
      card.addEventListener('click', (e) => {
        const node = e.target.closest('.sp-node');
        if (node) { setForm(parseInt(node.dataset.form, 10)); return; }
        flashPick(idx + 1);
      });
      cardsEl.appendChild(card);
      const cv = card.querySelector('.sp-canvas');
      previews.push({ cv, ctx: cv.getContext('2d'), id: s.id, seed: idx * 3.7 });
      sizeCanvas(cv);
    });
    if (!rafOn) { rafOn = true; requestAnimationFrame(loop); }
  }

  function sizeCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let realMode = false;       // true=游戏内真实二选一（点击即选定）；false=预览模式（仅高亮反馈）
  let pickCallback = null;

  function flashPick(n) {
    picked = n;
    cardsEl.classList.add('has-pick');
    const all = cardsEl.children;
    for (let i = 0; i < all.length; i++) all[i].classList.toggle('sp-sel', i === n - 1);
    if (window.SFX && SFX.pick) SFX.pick();
    if (realMode && pickCallback) {
      const grp = STYLES[curHero];
      const sid = n === 1 ? grp.a.id : grp.b.id;
      const cb = pickCallback;
      pickCallback = null;
      realMode = false;
      setTimeout(() => { hide(); cb && cb(sid); }, 260);
    }
  }

  /* 预览画布：深色星域背景 + 弹体循环飞越 + 残影 */
  const stars = Array.from({ length: 26 }, (_, i) => ({
    y: (i * 53 % H), sp: 20 + (i * 37 % 60), r: 0.6 + (i % 3) * 0.5, a: 0.15 + (i % 4) * 0.1
  }));
  let last = 0;
  function loop(now) {
    if (!root || root.classList.contains('hidden')) { rafOn = false; return; }
    const t = now / 1000;
    const dt = Math.min(0.05, t - (last || t)); last = t;
    previews.forEach(p => drawFrame(p, t, dt));
    requestAnimationFrame(loop);
  }

  function drawFrame(p, t, dt) {
    const ctx = p.ctx;
    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1230'); bg.addColorStop(0.55, '#0d1738'); bg.addColorStop(1, '#080f26');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // 流动星尘
    stars.forEach((s, i) => {
      const x = ((i * 97 + t * s.sp * (1 + p.seed * 0.07)) % (W + 20)) - 10;
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#bfe3ff';
      ctx.fillRect(x, s.y, s.r * 2.4, s.r * 0.7);
    });
    ctx.globalAlpha = 1;
    // 双弹错相飞越（任意时刻画面内至少有一发）
    const cyc = 2.8, span = W + 96;
    const br = 13 + (curForm - 1) * 1.6;   // 形态越高弹体越大
    for (let k = 0; k < 2; k++) {
      const u = (((t * 0.72 + p.seed) % cyc) / cyc + k * 0.5) % 1;
      const x = -48 + u * span;
      const cy = H / 2 + Math.sin(t * 2 + p.seed + k * Math.PI) * 7;
      for (let i = 5; i >= 1; i--) {
        const f = i / 5;
        const px = x - f * 58;
        if (px < -60 || px > W + 30) continue;
        ctx.globalAlpha = (1 - f) * 0.08;
        draw(ctx, p.id, curForm, px, cy + f * 2, 0, t - f * 0.05, br);
      }
      ctx.globalAlpha = 1;
      draw(ctx, p.id, curForm, x, cy, 0, t + k * 1.3, br);
    }
  }

  function show(heroId, opts) {
    if (!root) buildPanel();
    if (heroIds().includes(heroId)) curHero = heroId;
    picked = 0;
    realMode = !!(opts && opts.real);
    pickCallback = (opts && opts.onPick) || null;
    // 真实选择模式：锁定英雄、隐藏切换/关闭按钮
    const sw = document.getElementById('sp-switch');
    const cl = document.getElementById('sp-close');
    if (sw) sw.style.display = realMode ? 'none' : '';
    if (cl) cl.style.display = realMode ? 'none' : '';
    renderHero();
    root.classList.remove('hidden');
  }
  function hide() { if (root) root.classList.add('hidden'); }

  window.BStyle = {
    STYLES, draw, show, hide,
    getForm, findStyle, firstBoostMul, applyFirstStyle, applyStyleGrowth, playerForm
  };

  // —— 预览入口：?styleui=1 或 ?styleui=英雄id ——
  window.addEventListener('load', () => {
    buildPanel();
    const q = new URLSearchParams(location.search).get('styleui');
    if (q !== null) show(q && q !== '1' ? q : 'xiaobai');
  });
})();
