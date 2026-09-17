/* ============================================================
 * entities.js —— 玩家 / 子弹 / 敌人 / 粒子 / 宝石 / 闪电
 * ============================================================ */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /* 击杀者归因：敌人/Boss 更新期间发射的弹丸/闪电/光束自动记录来源（死法文案用）。
   * game.js 在逐个更新敌人/Boss 时 setShooter(e) → 更新完 clearShooter()。 */
  let curShooter = null;
  function shooterSrc() { return curShooter ? curShooter.dsrc : null; }

  /* 居中绘制精灵（sx/sy 为像素放大倍数） */
  function drawSprite(ctx, spr, x, y, sx, sy, angle, flash) {
    sy = sy || sx;
    const w = spr.width * sx, h = spr.height * sy;
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    if (flash > 0) ctx.filter = 'brightness(2.6)';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /* 单色染色精灵（用于受伤闪红等）：离屏 canvas 叠加 source-atop 纯色 */
  let tintCv = null;
  function drawSpriteTinted(ctx, spr, x, y, w, h, angle, color, alpha) {
    if (!tintCv) tintCv = document.createElement('canvas');
    if (tintCv.width < spr.width) tintCv.width = spr.width;
    if (tintCv.height < spr.height) tintCv.height = spr.height;
    const tc = tintCv.getContext('2d');
    tc.clearRect(0, 0, tintCv.width, tintCv.height);
    tc.drawImage(spr, 0, 0);
    tc.globalCompositeOperation = 'source-atop';
    tc.fillStyle = color;
    tc.fillRect(0, 0, spr.width, spr.height);
    tc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tintCv, 0, 0, spr.width, spr.height, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /* ---------------- 粒子（像素方块） ---------------- */
  class Particle {
    constructor(x, y, vx, vy, life, size, color, grav) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.life = life; this.maxLife = life;
      this.size = size; this.color = color;
      this.grav = grav || 0; this.dead = false;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      this.vy += this.grav * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
    }
    render(ctx) {
      const a = clamp(this.life / this.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = this.color;
      const s = this.size * (a > 0.5 ? 1 : a * 1.6);
      ctx.fillRect(this.x - s / 2, this.y - s / 2, s, s);
      ctx.globalAlpha = 1;
    }
  }

  function burst(g, x, y, n, colors, speed, size, life, grav) {
    // 全局粒子兜底：场景粒子过多时削减本次数量，防止特效爆炸帧卡顿
    if (g.particles.length > 500) n = Math.max(1, Math.floor(n * 0.3));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(speed * 0.3, speed);
      g.particles.push(new Particle(
        x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        rand(life * 0.5, life), rand(size * 0.6, size * 1.4),
        colors[randi(0, colors.length - 1)], grav || 0));
    }
  }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }

  /* ---------------- 能量宝石 ---------------- */
  class Gem {
    /** homed：Boss 掉落能量 —— 无视地形，直接飞向玩家 */
    constructor(x, y, value, homed) {
      this.x = x; this.y = y;
      this.vx = rand(-80, -20); this.vy = rand(-110, -40);
      this.t = rand(0, TAU); this.value = value; this.dead = false;
      this.size = value >= 30 ? 7 : 5;
      this.bounce = 0;
      this.homed = !!homed;
    }
    update(dt, g) {
      this.t += dt * 4;
      const p = g.player;
      const d = dist(this, p);
      const range = p.magnetRange || 150;
      if (this.homed) {
        // Boss 掉落：强力追踪，不受引力范围/地形限制
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.vx += Math.cos(a) * 2600 * dt;
        this.vy += Math.sin(a) * 2600 * dt;
        this.vx *= 0.90; this.vy *= 0.90;
      } else if (d < range) {                          // 飞虎引力吸收范围
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        const pull = 1000 * (1 - d / (range * 1.15));
        this.vx += Math.cos(a) * pull * dt * 5;
        this.vy += Math.sin(a) * pull * dt * 5;
        this.vx *= 0.90; this.vy *= 0.90;
      } else {
        // 落地后持续向左漂移（战场卷轴方向）
        this.vx += (-105 - this.vx) * dt * 1.4;
        this.vy += 300 * dt;
      }
      const prevY = this.y;
      this.x += this.vx * dt; this.y += this.vy * dt;
      // 落地面：地面 / 海平面 / 山石顶部（homed 能量不受地形影响，直飞玩家）
      if (!this.homed) {
        let floorY = (g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y) - 8;
        if (this.vy >= 0) {
          for (const r of g.rocks) {
            if (this.x > r.left - 2 && this.x < r.left + r.w + 2 && prevY <= r.top + 12) {
              const rf = r.top - 7;
              if (rf < floorY) floorY = rf;
            }
          }
        }
        if (this.y > floorY) {
          this.y = floorY;
          if (this.vy > 40) this.vy *= -0.45;
          else this.vy = 0;
        }
      }
      if (d < p.radius + 12) {
        this.dead = true;
        g.gainXp(this.value);
        SFX.pick();
      }
      if (this.x < -30 && !this.homed) this.dead = true;
    }
    render(ctx) {
      const s = this.size + Math.sin(this.t) * 1.2;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.sin(this.t * 0.6) * 0.3);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-s / 2, -s, s, s * 2);
      ctx.fillStyle = '#74e0ff';
      ctx.fillRect(-s, -s / 2, s * 2, s);
      ctx.fillStyle = '#e6fbff';
      ctx.fillRect(-1.5, -s * 0.6, 3, 3);
      ctx.restore();
    }
  }

  /* ---------------- 子弹 ---------------- */
  const BULLET_STYLE = {
    bolt0: { color: '#ffd93b', edge: '#ff9d2e', r: 4, len: 14 },
    bolt1: { color: '#5ee7ff', edge: '#1b8fc9', r: 6, len: 18 },
    bolt2: { color: '#e59bff', edge: '#8b3fd0', r: 7, len: 22 },
    bolt3: { color: '#ffffff', edge: '#5ee7ff', r: 10, len: 28 }
  };

  /** 龙系怪物专属刺弹：机制与草龙龙鳞刺一致（高速直线、触地入土），外形按地图主题区分 */
  const SPIKE_KINDS = { spike: 1, sandspike: 1, blackscale: 1, lavafang: 1, boneshard: 1, gear: 1, seaspike: 1 };
  const SPIKE_FX = {
    spike: ['#2fb37c', '#6b4a2a', '#7ed46d'],
    sandspike: ['#c9a05a', '#8a6a36', '#e0c384'],
    blackscale: ['#1c1c26', '#8e1b2b', '#ff4a4a'],
    lavafang: ['#ff7b2e', '#c94a1e', '#ffd23b'],
    boneshard: ['#e8e4d8', '#cfc9b8', '#ffffff'],
    gear: ['#35e0ff', '#b87333', '#2a3040'],
    seaspike: ['#1f6fb8', '#9fd9f5', '#d8f2ff']
  };

  /** 鸦伯爵宝石配色池（随机彩色宝石：主色/亮切面/暗切面） */
  const GEM_COLS = [
    { main: '#ff4a6a', lite: '#ffc0cc', dark: '#7a0f28' },   // 红宝石
    { main: '#ffb13b', lite: '#ffe6b0', dark: '#8a5208' },   // 黄玉
    { main: '#35e0ff', lite: '#c8f6ff', dark: '#0a5a78' },   // 海蓝宝
    { main: '#a855f7', lite: '#e2c8ff', dark: '#4a1278' },   // 紫晶
    { main: '#4aff9e', lite: '#c8ffdf', dark: '#0a6a3a' }    // 翡翠
  ];

  /* ============================================================
   * 元素弹像素造型：三层圆形火球 / 墨绿粘稠液团 / 六棱冰锥
   * 格子以弹速方向为 +x（局部坐标），u 为单像素块边长
   * ============================================================ */
  /** 稳定伪随机：同一格子每帧形状一致（火焰跳动只作用于火舌/明灭格） */
  function pxHash(i, j, s) {
    const x = Math.sin(i * 127.1 + j * 311.7 + (s || 0) * 74.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /** 圆形像素火球（放大后重绘：13×13 细密网格，7 层色阶 + 外发光 + 白热芯 + 双层火舌尾） */
  function drawPxFireball(ctx, x, y, r, t, vx, vy) {
    const u = r / 6;
    const a = Math.atan2(vy || 0, vx === 0 && vy === 0 ? 1 : vx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    // —— 外发光：径向橙红光晕（实心不飘） ——
    const glow = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 1.35);
    glow.addColorStop(0, 'rgba(255,150,40,0.5)');
    glow.addColorStop(0.55, 'rgba(255,90,20,0.18)');
    glow.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.35, 0, TAU); ctx.fill();
    const cell = (i, j, col) => { ctx.fillStyle = col; ctx.fillRect((i - 0.5) * u, (j - 0.5) * u, u + 0.6, u + 0.6); };
    const flick = Math.floor(t * 14);
    // —— 球体：7 层色阶（外壳只留少量跳空 → 弹体更实） ——
    for (let j = -6; j <= 6; j++) {
      for (let i = -6; i <= 6; i++) {
        const d = Math.hypot(i, j);
        if (d > 6.15) continue;
        const h = pxHash(i, j, 3);
        if (d > 5.2 && h < 0.16) continue;                              // 外壳仅 16% 锯齿跳空
        if (d > 5.2 && ((flick + i * 3 + j * 5) % 9 === 0) && h < 0.55) continue;  // 个别格明灭
        let col;
        if (d > 5.2) col = h < 0.45 ? '#7a1602' : '#a82a06';           // 1 暗红外壳
        else if (d > 4.3) col = h < 0.4 ? '#c23408' : '#e8430f';       // 2 深红
        else if (d > 3.3) col = h < 0.4 ? '#ff5a1a' : '#ff7123';       // 3 橙红
        else if (d > 2.3) col = h < 0.35 ? '#ff7b2e' : '#ff932e';      // 4 亮橙
        else if (d > 1.3) col = h < 0.4 ? '#ffb02e' : '#ffc84d';       // 5 金黄
        else col = h < 0.3 ? '#ffd23b' : '#ffe94d';                    // 6 亮黄芯
        cell(i, j, col);
      }
    }
    // —— 球内光影：下半部压暗、上半部提亮（圆形裁剪内的柔光层） ——
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(80,12,0,0.2)';
    ctx.fillRect(-r, r * 0.12, r * 2, r);
    ctx.fillStyle = 'rgba(255,240,160,0.14)';
    ctx.fillRect(-r, -r, r * 2, -r * 0.18);
    ctx.restore();
    // —— 白热点：前上方 3 像素 ——
    cell(1, -1, '#fff6b0'); cell(0, -1, '#fff0a0'); cell(2, 0, '#fff3a8');
    // —— 外圈火星：沿壳缓慢公转的 6 颗小火星 ——
    for (let s = 0; s < 6; s++) {
      const ang = pxHash(s, 7, 11) * TAU + t * (0.8 + pxHash(s, 2, 5) * 0.8);
      const rr = r * (1.02 + pxHash(s, 3, 7) * 0.25);
      const ex = Math.cos(ang) * rr / u, ey = Math.sin(ang) * rr / u;
      if (pxHash(s, 1, flick) > 0.35) cell(ex, ey, pxHash(s, 4, flick) > 0.5 ? '#ffd23b' : '#ff9d2e');
    }
    // —— 双层火舌尾：宽短内焰 + 细长外焰，逐帧跳动 ——
    const tail = (i, w, cols, seed) => {
      for (let j = -w; j <= w; j++) {
        const hh = pxHash(i, j, flick + seed);
        if (hh < 0.22 && j !== 0) continue;
        cell(i, j, cols[j === 0 ? 0 : (hh > 0.6 ? 1 : 2)]);
      }
    };
    tail(-7, 2, ['#ff9d2e', '#ff5a1a', '#c23408'], 2);
    tail(-8, 1, ['#ff7b2e', '#ff5a1a', '#a82a06'], 5);
    if (pxHash(9, 0, flick) > 0.30) cell(-9, 0, '#ff7b2e');
    if (pxHash(9, 1, flick + 2) > 0.45) cell(-9, 1, '#ff5a1a');
    if (pxHash(10, 0, flick) > 0.42) cell(-10, 0, '#ffd23b');
    if (pxHash(11, 0, flick + 3) > 0.55) cell(-11, 0, '#ffe94d');
    ctx.restore();
  }

  /** 墨绿粘稠液团：表面亮绿、内部深绿，边缘滴落，飞行拉出粘稠丝线（丝线主要靠粒子拖尾） */
  function drawPxPoison(ctx, x, y, r, t, vx, vy) {
    const u = r / 3.3;
    const a = Math.atan2(vy || 0, vx === 0 && vy === 0 ? 1 : vx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const cell = (i, j, col) => { ctx.fillStyle = col; ctx.fillRect((i - 0.5) * u, (j - 0.5) * u, u + 0.5, u + 0.5); };
    const drip = Math.floor(t * 6);
    for (let j = -3; j <= 3; j++) {
      for (let i = -4; i <= 3; i++) {
        const d = Math.hypot(i, j);
        if (d > 3.5) continue;
        const h = pxHash(i, j, 13);
        if (d > 2.7 && h < 0.28) continue;           // 不规则粘稠边缘
        if (d <= 1.4) cell(i, j, '#0a3a0a');          // 内部深绿（墨绿芯）
        else if (d <= 2.4) cell(i, j, h > 0.55 ? '#166534' : '#0f5320');
        else cell(i, j, h > 0.72 ? '#4ade80' : '#2dd44a');   // 表面亮绿
      }
    }
    // 亮绿表面高光（前上方）
    cell(2, -1, '#86efac'); cell(1, -2, '#4ade80');
    // 边缘滴落：下沿/尾端的滴状像素缓慢伸缩
    if (pxHash(0, 4, drip) > 0.30) cell(0, 4, '#2dd44a');
    if (pxHash(0, 5, drip) > 0.55) cell(0, 5, '#166534');
    if (pxHash(-2, 4, drip + 3) > 0.42) cell(-2, 4, '#2dd44a');
    // 尾端粘稠丝线连接像素
    cell(-4, 0, '#14532d');
    ctx.restore();
  }

  /** 六棱冰锥（放大后重绘：9 行细密棱面 + 径向冷光 + 冷白晶芯 + 分叉霜纹 + 侧边碎晶） */
  function drawPxIce(ctx, x, y, r, t, vx, vy) {
    const u = r / 4.6;
    const a = Math.atan2(vy || 0, vx === 0 && vy === 0 ? 1 : vx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    // —— 径向冷光（三层：核心青白 → 浅蓝 → 透明） ——
    const glow = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.7);
    glow.addColorStop(0, 'rgba(220,245,255,0.55)');
    glow.addColorStop(0.45, 'rgba(150,220,255,0.28)');
    glow.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, TAU); ctx.fill();
    const cell = (i, j, col) => { ctx.fillStyle = col; ctx.fillRect((i - 0.5) * u, (j - 0.5) * u, u + 0.6, u + 0.6); };
    // 棱面行表：尖锥收于前方 +5，六棱平头收尾于 -4
    const rows = [
      { j: -4, a: -1, b: 0 }, { j: -3, a: -3, b: 2 },
      { j: -2, a: -4, b: 3 }, { j: -1, a: -4, b: 4 },
      { j: 0, a: -4, b: 5 },
      { j: 1, a: -4, b: 4 }, { j: 2, a: -4, b: 3 },
      { j: 3, a: -3, b: 2 }, { j: 4, a: -1, b: 0 }
    ];
    const flick = Math.floor(t * 10);
    rows.forEach(row => {
      for (let i = row.a; i <= row.b; i++) {
        const edge = (i === row.a || i === row.b || Math.abs(row.j) === 4);
        const h = pxHash(i, row.j, 9);
        let col;
        if (edge) col = h > 0.5 ? '#0d3f66' : '#1a5a8a';                    // 棱边深蓝
        else if (i >= row.b - 1) col = '#ffffff';                            // 前缘切白（受光刃口）
        else if (Math.abs(row.j) <= 1 && i >= -3) {
          col = h > 0.45 ? '#ffffff' : '#eaf7ff';                            // 中央冷白晶芯
        } else if (row.j < 0) col = h > 0.5 ? '#a8e4ff' : '#7fd4ff';         // 上棱面亮
        else col = h > 0.5 ? '#4ab8ff' : '#2f93e0';                          // 下棱面暗
        cell(i, row.j, col);
      }
    });
    // —— 分叉霜纹：6 道白色细纹沿晶面向前分叉 ——
    cell(-3, -2, '#ffffff'); cell(-2, -3, '#dff4ff');
    cell(-1, 2, '#ffffff'); cell(1, 2, '#dff4ff');
    cell(-3, 1, '#dff4ff'); cell(2, -1, '#ffffff');
    // —— 尾端深色晶座 + 上下小尾鳍 ——
    cell(-4, 0, '#0d3f66');
    cell(-3, 4, '#1a5a8a'); cell(-3, -4, '#1a5a8a');
    // —— 侧边碎晶：2 颗小冰粒绕锥尖缓慢漂浮、明灭闪烁 ——
    for (let s = 0; s < 2; s++) {
      const jj = s ? 3.4 : -3.4;
      const ii = 1.6 + Math.sin(t * 4 + s * 2.4) * 0.8;
      if ((flick + s * 3) % 2 === 0) { cell(ii, jj, '#dff4ff'); }
    }
    // —— 锥尖高光点 ——
    cell(5, 0, '#ffffff');
    ctx.restore();
  }

  /* ============================================================
   * 元素异常：命中火花 / 灼烧裂纹 / 冰霜加厚 / 腐蚀斑块 / 死亡爆发
   * 小怪（Enemy）与 Boss 共用同一套数据与渲染（Boss 由 game 中央驱动）
   * ============================================================ */
  const ELEM_HIT_COLS = {
    flame:  ['#ff7b2e', '#ff5a1a', '#ffd23b', '#c23408'],
    poison: ['#2dd44a', '#7dff6a', '#4ade80', '#0a3a0a'],
    ice:    ['#bfe9ff', '#eaf7ff', '#7fc6ef']
  };

  /** 命中瞬间：受击点一小圈火花/冰屑/毒液飞散 + 敌人身上留下对应异常像素标记。
   *  mul：受击效果范围倍率（火球为基础 ×6 / 冰弹 ×3.6 → 火花飞散、灼烧/冰霜覆盖同步放大） */
  function elemHitFx(ent, type, hx, hy, g, mul) {
    mul = mul || 1;
    if (!ent) return;
    const R = ent.radius || 20;
    const ox = clamp(hx - ent.x, -R, R), oy = clamp(hy - ent.y, -R, R);
    if (type === 'flame') {
      // 大火球重炮命中：成簇橙红火花（数量/飞散/颗粒随弹体放大，封顶避免过量）
      burst(g, hx, hy, Math.round(10 + 6 * mul), ELEM_HIT_COLS.flame, 100 + 40 * mul, 2.2 + 1.1 * mul, 0.38, 30 + 14 * mul);
      // 中心白热亮斑：少量白炽颗粒
      burst(g, hx, hy, Math.round(3 + 2 * mul), ['#fff3a8', '#ffe94d', '#ffd23b'], 70 + 20 * mul, 1.6 + 0.7 * mul, 0.26, 20 + 8 * mul);
      if (!ent.burnMarks) ent.burnMarks = [];
      let bm = ent.burnMarks.find(m => Math.hypot(m.ox - ox, m.oy - oy) < R * 0.7);
      if (bm) { bm.t = 0; bm.sm = Math.max(bm.sm || 1, mul); }   // 续烧：重新引燃 + 保持厚度
      else {
        ent.burnMarks.push({ ox, oy, seed: rand(0, TAU), t: 0, life: 3.6, sm: mul });
        if (ent.burnMarks.length > 6) ent.burnMarks.shift();
      }
    } else if (type === 'ice') {
      burst(g, hx, hy, Math.round(10 * mul), ELEM_HIT_COLS.ice, 150 * mul, 2.6 * mul, 0.36, 40);
      if (!ent.frostPts) ent.frostPts = [];
      // 同一区域反复命中 → 合并到同一冰斑（逐渐加厚）
      let fp = ent.frostPts.find(p => Math.hypot(p.ox - ox, p.oy - oy) < R * 0.7 && p.melt < 0.3);
      if (!fp) {
        fp = { ox, oy, t: 0, melt: 0, dead: false, sm: mul };
        ent.frostPts.push(fp);
        if (ent.frostPts.length > 5) ent.frostPts.shift();
      } else { fp.t = Math.max(fp.t, 0.4); fp.sm = Math.max(fp.sm || 1, mul); }   // 续冻：保持厚度
    } else if (type === 'poison') {
      burst(g, hx, hy, 10, ELEM_HIT_COLS.poison, 120, 3, 0.34, 90);
      if (!ent.poisonPts) ent.poisonPts = [];
      ent.poisonPts.push({ ox, oy, seed: rand(0, TAU), t: 0, life: 7.2 });
      if (ent.poisonPts.length > 6) ent.poisonPts.shift();
    }
  }

  /** 标记年龄推进 / 过期清理（异常结束后冰霜快速消融，其余按 life 淡出） */
  function elemMarksTick(ent, dt) {
    if (ent.burnMarks && ent.burnMarks.length) {
      ent.burnMarks.forEach(m => { m.t += dt; });
      ent.burnMarks = ent.burnMarks.filter(m => m.t < m.life);
    }
    if (ent.poisonPts && ent.poisonPts.length) {
      ent.poisonPts.forEach(m => { m.t += dt; });
      ent.poisonPts = ent.poisonPts.filter(m => m.t < m.life);
    }
    if (ent.frostPts && ent.frostPts.length) {
      ent.frostPts.forEach(p => {
        p.t += dt;
        if (ent.dotType !== 'ice' || ent.dotT <= 0) p.melt += dt * 2.0;   // 异常结束：快速消融
        if (p.melt >= 1 || p.t > 7) p.dead = true;
      });
      ent.frostPts = ent.frostPts.filter(p => !p.dead);
    }
  }

  /** 异常持续期间：身体随机位置冒出小火苗 / 绿色毒泡像素 */
  function elemAmbient(ent, dt, g) {
    if (!ent.dotType || ent.dotT <= 0) return;
    ent._ambT = (ent._ambT || 0) - dt;
    if (ent._ambT > 0) return;
    ent._ambT = 0.13;
    const R = ent.radius || 20;
    const px = ent.x + rand(-R * 0.75, R * 0.75);
    const py = ent.y + rand(-R * 0.8, R * 0.45);
    if (ent.dotType === 'flame') {
      g.particles.push(new Particle(px, py, rand(-16, 16), -rand(34, 82),
        rand(0.25, 0.45), rand(2, 3.6), Math.random() < 0.5 ? '#ff7b2e' : '#ffd23b'));
    } else if (ent.dotType === 'poison') {
      g.particles.push(new Particle(px, py, rand(-12, 12), -rand(20, 48),
        rand(0.35, 0.6), rand(1.8, 3.4), Math.random() < 0.5 ? '#7dff6a' : '#2dd44a'));
    }
  }

  /** 灼烧死亡圆形小火球爆炸 / 中毒死亡毒云爆发（纯视觉，无伤害） */
  function elemDeathFx(x, y, type, g, R) {
    R = R || 22;
    if (type === 'flame') {
      burst(g, x, y, 20, ['#ff7b2e', '#ff5a1a', '#ffd23b', '#c23408', '#8f1d04'], 150, 4, 0.4, 60);
      if (g.addElemFx) g.addElemFx({ kind: 'fireboom', x, y, t: 0, life: 0.45, r: R });
    } else if (type === 'poison') {
      burst(g, x, y, 14, ['#2dd44a', '#7dff6a', '#0a3a0a', '#4ade80'], 90, 4, 0.5);
      if (g.addElemFx) g.addElemFx({ kind: 'pcloud', x, y, t: 0, life: 1.3, r: R });
    }
  }

  /** 身上的异常像素标记渲染（世界坐标，小怪/Boss 通用） */
  function renderElemMarks(ctx, ent) {
    const R = ent.radius || 20;
    const cs = clamp(R * 0.10, 2.5, 6);    // 单像素块尺寸随敌体缩放
    const tt = ent.t || 0;
    // —— 灼烧：暗红裂纹（自命中点发散的短折线段）+ 边缘细小火焰像素（尺寸随弹体 sm 放大） ——
    (ent.burnMarks || []).forEach(m => {
      const fade = m.t > m.life - 0.8 ? (m.life - m.t) / 0.8 : 1;
      ctx.globalAlpha = clamp(fade, 0, 1);
      const bsm = m.sm || 1;
      const mcs = Math.min(cs * 2.4, cs * (0.8 + bsm * 0.28));   // 焦痕像素块随弹体放大、封顶
      const lm = 0.9 + bsm * 0.12;                                 // 裂纹长度倍率
      const x0 = ent.x + m.ox, y0 = ent.y + m.oy;
      for (let s = 0; s < 4; s++) {
        const ang = m.seed + s * (TAU / 4) + (pxHash(s, 0, m.seed) - 0.5) * 0.9;
        const len = (5 + pxHash(s, 1, m.seed) * R * 0.55) * lm;
        const steps = 3 + Math.floor(pxHash(s, 2, m.seed) * 2);
        for (let q = 1; q <= steps; q++) {
          const d = len * q / steps;
          const jx = (pxHash(q, s, m.seed) - 0.5) * 4 * mcs / cs;
          ctx.fillStyle = q === steps ? '#8f1d04' : '#c23408';
          ctx.fillRect(x0 + Math.cos(ang) * d + jx - mcs / 2, y0 + Math.sin(ang) * d - mcs / 2, mcs, mcs);
        }
      }
      // 边缘小火苗：2 处，按身体时间跳动（大弹体额外多 1 处）
      const flames = bsm > 2 ? 3 : 2;
      for (let s = 0; s < flames; s++) {
        if (Math.floor(tt * 10 + m.seed * 3 + s) % 3 === 0) {
          const fr = (6 + R * 0.25) * lm;
          const fx = x0 + Math.cos(m.seed + s * 2.4) * fr;
          const fy = y0 + Math.sin(m.seed + s * 2.4) * fr;
          ctx.fillStyle = s ? '#ffd23b' : '#ff7b2e';
          ctx.fillRect(fx - mcs / 2, fy - mcs / 2, mcs, mcs);
        }
      }
    });
    ctx.globalAlpha = 1;
    // —— 腐蚀斑块：墨绿像素块 + 周期性冒起的绿色毒泡 ——
    (ent.poisonPts || []).forEach(m => {
      const fade = m.t > m.life - 1.0 ? (m.life - m.t) : 1;
      ctx.globalAlpha = clamp(fade, 0, 1);
      const x0 = ent.x + m.ox, y0 = ent.y + m.oy;
      for (let s = 0; s < 8; s++) {
        const ang = pxHash(s, 0, m.seed) * TAU;
        const d = pxHash(s, 1, m.seed) * R * 0.6;
        ctx.fillStyle = pxHash(s, 2, m.seed) > 0.5 ? '#0a3a0a' : '#14532d';
        const bs = cs * (0.9 + pxHash(s, 3, m.seed) * 0.6);
        ctx.fillRect(x0 + Math.cos(ang) * d - bs / 2, y0 + Math.sin(ang) * d - bs / 2, bs, bs);
      }
      // 毒泡：斑块上周期性鼓出的亮绿像素
      if (Math.floor(tt * 3.5 + m.seed * 9) % 3 === 0) {
        const bx = x0 + (pxHash(7, 0, m.seed) - 0.5) * R * 0.7;
        const by = y0 + (pxHash(7, 1, m.seed) - 0.5) * R * 0.7;
        ctx.fillStyle = '#7dff6a';
        ctx.fillRect(bx - cs / 2, by - cs / 2, cs * 0.8, cs * 0.8);
      }
    });
    ctx.globalAlpha = 1;
    // —— 冰霜：从命中点向外覆盖、逐渐加厚（先浅蓝底冰，厚度上来后压冷白霜层） ——
    (ent.frostPts || []).forEach(p => {
      const k = clamp(p.t / 1.2, 0, 1) * (1 - clamp(p.melt, 0, 1));
      if (k <= 0.02) return;
      const x0 = ent.x + p.ox, y0 = ent.y + p.oy;
      const rad = (5 + k * R * 0.8) * (p.sm || 1);
      ctx.globalAlpha = 0.8 * k;
      for (let s = 0; s < 11; s++) {
        const ang = pxHash(s, 0, p.ox + p.oy) * TAU;
        const d = pxHash(s, 1, p.ox - p.oy) * rad;
        ctx.fillStyle = '#9fd8ff';
        ctx.fillRect(x0 + Math.cos(ang) * d - cs / 2, y0 + Math.sin(ang) * d - cs / 2, cs, cs);
      }
      if (k > 0.45) {
        ctx.globalAlpha = (k - 0.45) * 1.3;
        for (let s = 0; s < 6; s++) {
          const ang = pxHash(s, 4, p.ox * 2) * TAU;
          const d = pxHash(s, 5, p.oy * 2) * rad * 0.6;
          ctx.fillStyle = '#eaf7ff';
          ctx.fillRect(x0 + Math.cos(ang) * d - cs / 2, y0 + Math.sin(ang) * d - cs / 2, cs, cs);
        }
      }
    });
    ctx.globalAlpha = 1;
  }

  class Bullet {
    /** kind: bolt / orb / shuriken / feather / whirl / flame / fireball / katana / spark / shell / missile / float / apple / cross / knife / axe */
    constructor(x, y, vx, vy, opts) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.kind = opts.kind || 'orb';
      this.friendly = !!opts.friendly;
      this.dmg = opts.dmg || 10;
      this.r = opts.r || 5;
      this.life = opts.life || 6;
      this.dead = false;
      this.t = 0;
      this.bounces = 0;             // 红苹果触地弹跳次数（弹一次后碎裂）
      this.pierce = opts.pierce || 0;
      this.hitSet = null;
      this.bombLv = opts.bombLv || 0;
      this.spdTrail = opts.spdTrail || 0;     // 弹速强化等级：>0 时弹尾拉出速度线（视觉反馈）
      this.tier = opts.tier || 0;
      this.dmgScale = opts.dmgScale || 1;   // 敌人子弹伤害系数（Boss成长）
      this.grav = opts.grav || 0;           // 重力（抛射弹道）
      this.spin = rand(0, TAU);
      this.spinRate = opts.spinRate || 9;   // 自转角速度（斧头弹等持续旋转）
      this.p3spr = !!opts.p3spr;            // 斧王阶段3 飞斧：使用 dawang_3futou 精灵渲染
      this.onExpire = opts.onExpire || null;
      this.onPlayerHit = opts.onPlayerHit || null;   // 命中玩家时回调（怪客十字弹吸血等）
      this.trail = 0;
      this.neutralized = false;   // Boss 死亡后弹幕失效
      this.fade = 1;             // 失效后逐渐淡出
      this.volatile = !!opts.volatile;        // 炮弹：被我方子弹击中也会引爆
      this.rockBreak = !!opts.rockBreak;      // 该弹可破坏障碍山石
      this.homing = !!opts.homing;            // 追踪导弹 / 漂浮弹
      this.turnRate = opts.turnRate || 2.2;   // 转向速率
      this.hp = opts.hp || 0;                 // 可被击爆的弹：承受命中次数（>0 生效）
      this.hitFlash = 0;                       // 被击中闪白
      this.hitCd = 0;                          // 被我方子弹命中的间隔（防穿透弹一帧多次计数）
      this.bscale = opts.bscale || 1;          // 弹体缩放（大型导弹等）
      this.invuln = opts.invuln || 0;          // 发射后无敌时间（期间我方子弹/旋转剑无法命中）
      this.element = opts.element || '';       // 元素属性：'flame'/'poison'/'ice'（友方弹专用）
      this.elemPow = opts.elemPow || 0;       // 元素精通等级 0-3（决定元素弹 DoT 系数/持续/冻结）
      this.color = opts.color || '';           // 自定义弹体颜色（敌方 orb 等）
      this.sineWave = opts.sine || null;       // S 形弹道：{ amp, freq, phase }（飞刀线性 S 走向）
      this.fireTrail = !!opts.fireTrail;       // 火焰弹：飞行时喷射火焰粒子拖尾 + 火焰分层渲染
      this.pxFire = !!opts.pxFire;             // 像素火球（火鸡王火焰弹）：圆形三层像素火球新样式，尺寸不变
      this.brTrail = !!opts.brTrail;           // 超猫前3阶段玫红激光块：简单蓝红粒子拖尾
      this.trailCols = opts.trailCols || null; // 自定义拖尾粒子配色（紫焰苹果等），设置后即启用拖尾
      /* —— 大型波形式弹幕（火遮眼火焰斩等）：沿速度方向的旋转矩形判定盒 —— */
      this.boxW = opts.boxW || 0;              // 判定盒沿飞行方向全长（0=退化为圆形判定）
      this.boxH = opts.boxH || 0;              // 判定盒垂直飞行方向全宽
      this.boxOff = opts.boxOff || 0;          // 判定盒中心沿飞行方向的前移偏移
      this.slashR = opts.slashR || 150;        // 火焰斩弧形半径（渲染几何）
      this.slashSpan = opts.slashSpan || 1.02; // 火焰斩弧形张角半角（弧度）
      /* —— 角色专属弹种扩展 —— */
      this.glv = opts.glv || 0;                // 角色子弹样式阶段（0-3）
      this.gmax = !!opts.gmax;                 // 最终形态
      this.dropX = opts.dropX || 0;            // 飞抵该 x 后开始受重力下落（侠客飞刀/战狂盾牌）
      this.dropGrav = opts.dropGrav || 0;
      this.bouncesLeft = opts.bouncesLeft || 0;   // 剩余反弹次数（烟头/锯齿盾/最终激光）
      this.bounceSpd = opts.bounceSpd || 0;       // 反弹后速度保留倍率（0=走默认 0.5；浪客烟头更慢）
      this.noDieOnHit = !!opts.noDieOnHit;     // 命中敌人后不消失（反弹类）
      this.rockReact = !!opts.rockReact;       // 与障碍物交互（分裂/反弹）
      this.burnOnHit = !!opts.burnOnHit;       // 命中点燃（持续燃烧）
      this.groundSlam = !!opts.groundSlam;     // 触地震伤地下龙类
      this.splitN = opts.splitN || 0;          // 死亡分裂数量（法师星星）
      this.edgeBounce = !!opts.edgeBounce;     // 屏幕边缘反弹（超猫最终激光）
      this.len = opts.len || 0;                // 矩形激光块长度（最终形态长至屏右）
      this.bossDmgRatio = opts.bossDmgRatio || 0;   // 对 Boss 按最大生命百分比造成伤害
      this.ultraKill = !!opts.ultraKill;       // 秒杀小怪（含地下龙类）
      this.onHitEnemy = opts.onHitEnemy || null;    // 命中敌人回调（反弹逻辑）
      this.target = opts.target || null;       // 追踪目标（超猫激光串）
      this.straightT = opts.straightT || 0;    // 初射直线飞行时间（超猫五重激光：先分向直射，飞满后才索敌）
      this._sought = false;                    // 初射段结束后是否已执行首次索敌
      this.ultPts = null;                      // 五重激光飞行轨迹点（玫红光带缎带数据源）
      this.trailLite = !!opts.trailLite;       // 轻量化拖尾（角色最终形态：少而小的粒子，避免遮挡战场）
      this.whiteStar = !!opts.whiteStar;       // 法师护盾碎星：纯白色五角星
      /* —— 飞行弹幕小怪能量弹（纯亮矢量样式 + 能量光带拖尾） —— */
      this.eb = opts.eb || '';                 // 能量弹样式：leaf/eyeball/flame/spikeball/whiteorb/diamond/cone
      this.ebTrail = opts.ebTrail || 0;        // 拖尾强度：0 无（弱）/ 1 微弱（中）/ 2 清晰（强）
      this.ebPts = null;                       // 拖尾轨迹点（{x,y}[]）
      /* —— 深海恶霸专属弹种（wshark 追踪水鲨 / wbomb 铁壳炸弹 / whook 巨型铁钩） —— */
      this.noTouch = !!opts.noTouch;           // 跳过通用玩家圆形碰撞（炸弹/铁钩在 update 中自管伤害）
      this.enr = !!opts.enr;                   // 狂暴强化（速度/转向/波次）
      if (this.kind === 'wshark') {
        this.swim = 0;                         // 游摆计时（鱼尾摆动）
        this.cruiseT = CFG.seaBully.sharkCruise;   // 出嘴后弧线直游倒计时，归零进入惯性追踪
        this.turnEase = 0;                     // 追踪转向速率渐强系数（明显弧线、不瞬转）
        this._bubT = 0;
        this.angle = Math.atan2(vy, vx);
      }
      if (this.kind === 'wbomb') {
        this.exT = -1;                         // 爆炸阶段计时（<0=飞行中）
        this.tx = opts.tx || 0;                // 出手时锁定的落点（飞行不追踪）
        this.ty = opts.ty || 0;
        this.coreHit = false;                  // 爆炸中心只结算一次
        this.ringHit = [false, false, false];  // 三道冲击波各结算一次
        this.smokeT = 0;
        this.spin = rand(0, TAU);
      }
      if (this.kind === 'whook') {
        this.hkDir = opts.hkDir || 1;          // 唯一一次转向：1=向下 -1=向上（出手时定死）
        this.hkSpd = opts.hkSpd || CFG.seaBully.hookSpd;
        this.hkTurnT = opts.hkTurnT || CFG.seaBully.hookTurnT;
        this.hkAnchor = opts.hkAnchor || { x: 0, y: 0 };   // 铁链锚点（Boss 手部，逐帧跟随）
        this.hkPhase = 'out';                  // out→turn→fly2→retract
        this.hkT = 0;
        this.hkStraight = false;               // 铁链是否已完全展开绷直（绷直才有伤害）
        this.hkAngle = Math.PI;                // 钩头朝向（初始朝左）
        this.hkPts = null;                     // 铁链逐节坐标
        this.hkCd = 0;                         // 铁钩本体伤害节流
        this.hkGrabbed = false;                // 本钩是否已钩中过人（每钩只钩一次）
        this.hkGrab = null;                    // 拖拽中：{p,dist,ox,oy} 玩家挂在钩尖的局部偏移与累计行程
      }
      /* —— 鸦伯爵专属弹种（gem 菱形彩色宝石：本体有伤害、拖尾无伤害） —— */
      if (this.kind === 'gem') {
        this.gemTier = opts.gemTier || 0;      // 尺寸档：0=小0.5x / 1=中1.5x / 2=大2x
        this.gemMode = opts.gemMode || 'throw';// throw 飞掷前慢后快 / fwd 高潮前飞 / ret 去程回程
        this.gPhase = this.gemMode === 'ret' ? 'out' : 'fly';  // ret: out→pause→back
        this.gT = 0;
        this.gemV0 = opts.gemV0 || 0;          // 飞掷前段速度（慢）
        this.gemV1 = opts.gemV1 || 0;          // 飞掷后段速度（突然加速）
        this.aimOffX = opts.aimOffX || 0;      // 追踪目标相对玩家的固定偏移（每弹不同点位→弹道分离不叠加）
        this.aimOffY = opts.aimOffY || 0;
        this.gemSx = x; this.gemSy = y;        // 出膛点（按飞行距离触发加速/折返，Boss全屏瞬移后方向无关）
        this.foldDir = opts.foldDir || -1;     // 回旋去程方向：-1 朝玩家所在左侧 / +1 朝右
        this.foldDist = opts.foldDist || 0;    // 去程折返距离（飞出枪口这么远后急停掉头）
        this.pauseT = opts.pauseT || 0;        // 急停时长
        this.outA = Math.atan2(vy, vx);        // 去程方向（回旋折返按此反向）
        this.backA = 0;                        // 回程方向（折返瞬间算出）
        this.pOld = null;                      // 折返瞬间玩家旧位置（回程偏折目标）
        this.gemPts = [];                      // 拖尾轨迹点
        this.glintT = 0;
        this.gemCol = opts.gemCol !== undefined ? opts.gemCol : randi(0, GEM_COLS.length - 1);
      }
      /* —— 雪巫专属弹种（icicle 六角冰晶 / icering 空心冰环） —— */
      if (this.kind === 'icicle') {
        this.mistT = 0;                        // 白蓝冰雾拖尾节流（拖尾仅视觉、无伤害）
      }
      if (this.kind === 'icering') {
        this.irOuter = opts.irOuter || 50;     // 环带外缘（冰刺尖在此之外）
        this.irInner = opts.irInner || 30;     // 环带内缘（以内为安全区）
        this.irCd = 0;                         // 环带接触伤害节流
        this.irGrow = 0;                       // 生成展开动画进度 0→1
      }
      /* —— 击杀者归因：显式 opts.src 优先，否则继承发射时刻的当前敌人/Boss —— */
      this.src = opts.src || shooterSrc();
    }
    /** Boss 死亡：弹幕无效化，减速并逐渐消失 */
    neutralize() {
      if (this.neutralized) return;
      this.neutralized = true;
      this.onExpire = null;      // 火球等不再触发爆炸
    }
    /** 激光串目标死亡后重定：屏幕内最近的敌人 / 龙类露出节 */
    pickRetarget(g) {
      let best = null, bestD = Infinity;
      const scan = (x, y, t) => {
        const d = (x - this.x) ** 2 + (y - this.y) ** 2;
        if (d < bestD) { bestD = d; best = t; }
      };
      for (const e of g.targets()) {
        if (e.dead || e.dying) continue;
        if (e.isBoss && (e.state === 'enter' || e.state === 'trans' || e.state === 'phaseTrans')) continue;
        if (e.segments) {
          const ne = e.nearestExposed(this.x, this.y);
          if (ne) scan(ne.x, ne.y, ne);
        } else scan(e.x, e.y, e);
      }
      return best;
    }
    /** 烟头/火把触地：震伤埋在地下的龙类小段（含地下部分） */
    groundSlamHit(g, gy) {
      for (const e of g.targets()) {
        if (e.dead || !e.segments || !e.isMini) continue;
        for (let i = 0; i < e.segments.length; i++) {
          const s = e.segments[i];
          if (s.dead) continue;
          if (Math.abs(s.x - this.x) < 110 && s.y > gy - 16) {
            e.damageSegment(i, Math.round(this.dmg * 1.5), g, null, '');
            burst(g, s.x, s.y, 3, ['#ff7b2e', '#ffd23b'], 90, 3, 0.25);
          }
        }
      }
    }
    /** 法师星星分裂：死亡时原地散射 3 颗小星 */
    splitStars(g) {
      if (this.splitDone) return;
      this.splitDone = true;
      for (let i = 0; i < this.splitN; i++) {
        const a = -Math.PI + (Math.PI / Math.max(1, this.splitN - 1)) * i + rand(-0.12, 0.12);
        const sp = 100;   // 分裂小星速度（随基础弹速同步降低 3 倍，原 300）
        g.bullets.push(new Bullet(this.x, this.y,
          Math.cos(a) * sp, Math.sin(a) * sp - 60, {
            kind: 'star', friendly: true,
            dmg: Math.max(1, Math.round(this.dmg * 0.5)),
            r: Math.max(3, this.r * 0.5), life: 0.9, spinRate: 16
          }));
      }
      burst(g, this.x, this.y, 8, ['#ffd93b', '#fff', '#7fe7ff'], 160, 3, 0.3);
    }
    update(dt, g) {
      this.t += dt; this.life -= dt;
      this.spin += dt * this.spinRate;
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.hitCd = Math.max(0, this.hitCd - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      if (this.neutralized) {
        this.fade = Math.max(0, this.fade - dt * 1.15);
        this.vx *= (1 - dt * 2.2); this.vy *= (1 - dt * 2.2);
        if (this.fade <= 0) { this.dead = true; return; }
      }
      // 环绕弹（旋羽领域等）：绕枢轴旋转、半径渐增；枢轴失效后沿切线飞出
      if (this.orbit && !this.neutralized) {
        const c = this.orbit.pivot();
        if (c) {
          this.orbit.ang += this.orbit.angSpd * dt;
          this.orbit.radius += (this.orbit.grow || 0) * dt;
          this.x = c.x + Math.cos(this.orbit.ang) * this.orbit.radius;
          this.y = c.y + Math.sin(this.orbit.ang) * this.orbit.radius;
          this.vx = -Math.sin(this.orbit.ang) * this.orbit.angSpd * this.orbit.radius;   // 记录切线速度
          this.vy = Math.cos(this.orbit.ang) * this.orbit.angSpd * this.orbit.radius;
          if (this.life <= 0) { if (this.onExpire) this.onExpire(g, this); this.dead = true; }
          return;
        }
        this.orbit = null;
      }
      if (this.grav) { this.vy += this.grav * dt; }
      // 角色弹种（侠客飞刀/战狂盾牌）：飞抵屏幕右侧 90%（dropX）后开始受重力下落
      if (this.dropGrav && this.x >= this.dropX) {
        this.vy += this.dropGrav * dt;
        this.angle = Math.atan2(this.vy, this.vx);
      }
      // S 形弹道：飞行方向绕基准角正弦摆动（飞刀线性 S 走向）
      if (this.sineWave && !this.neutralized) {
        const s = this.sineWave;
        if (!s.inited) { s.inited = true; s.baseA = Math.atan2(this.vy, this.vx); }
        const spd = Math.hypot(this.vx, this.vy);
        const a = s.baseA + Math.sin(this.t * s.freq + s.phase) * s.amp;
        this.vx = Math.cos(a) * spd; this.vy = Math.sin(a) * spd;
        this.angle = a;
      }
      // 超猫五重激光串：先沿各自固定方向直线初射（不索敌、不转向），飞满 straightT 后才开始索敌追踪最近目标
      if (this.kind === 'ultlaser' && this.homing && !this.neutralized) {
        if (this.straightT > 0) {
          this.straightT = Math.max(0, this.straightT - dt);
          if (this.straightT <= 0) { this._sought = true; this.target = this.pickRetarget(g); }
        } else {
          let tgt = this.target;
          if (!tgt || tgt.dead) { tgt = this.pickRetarget(g); this.target = tgt; }
          if (tgt) {
            const ta = Math.atan2(tgt.y - this.y, tgt.x - this.x);
            let cur = Math.atan2(this.vy, this.vx);
            let d = ta - cur;
            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;
            cur += clamp(d, -this.turnRate * dt, this.turnRate * dt);
            const sp = Math.hypot(this.vx, this.vy);
            this.vx = Math.cos(cur) * sp; this.vy = Math.sin(cur) * sp;
            this.angle = cur;
          }
        }
      }
      // 追踪导弹 / 漂浮弹：按转向速率缓慢修正朝向目标（默认玩家）；超猫激光串走上方专属分支
      if (this.homing && !this.neutralized && this.kind !== 'ultlaser') {
        let p = this.target ? (this.target.dead ? this.pickRetarget(g) : this.target) : g.player;
        if (p) {
        const ta = Math.atan2(p.y - this.y, p.x - this.x);
        let cur = Math.atan2(this.vy, this.vx);
        let d = ta - cur;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        cur += clamp(d, -this.turnRate * dt, this.turnRate * dt);
        const sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(cur) * sp; this.vy = Math.sin(cur) * sp;
        this.angle = cur;
        // 尾焰仅导弹有：尾部密集喷射红橙黄白火焰粒子（随弹体缩放，尾迹粗长）
        if (this.kind === 'missile') {
          this.trail += dt;
          if (this.trail > 0.03) {
            this.trail = 0;
            const ms = this.bscale || 1;
            const bx = Math.cos(cur), by = Math.sin(cur);
            const tx = this.x - bx * 14 * ms, ty = this.y - by * 14 * ms;
            const fireCols = ['#ff2a0a', '#ff5a1a', '#ff9d2e', '#ffd23b', '#fff5d0'];
            for (let i = 0; i < 3; i++) {
              const ja = cur + Math.PI + rand(-0.6, 0.6);
              g.particles.push(new Particle(
                tx + rand(-4, 4) * ms, ty + rand(-4, 4) * ms,
                Math.cos(ja) * rand(70, 170) + rand(-30, 30),
                Math.sin(ja) * rand(70, 170) + rand(-30, 30),
                rand(0.3, 0.6), rand(3, 6) * ms,
                fireCols[randi(0, fireCols.length - 1)]));
            }
          }
        }
        }
      }
      if (this.kind === 'arrow') {
        this.vy += 520 * dt;              // 抛射：重力
        this.angle = Math.atan2(this.vy, this.vx);
        if (this.y > CFG.GROUND_Y - 4) { this.dead = true; burst(g, this.x, CFG.GROUND_Y - 6, 4, ['#8a5a2b', '#6b4a2a'], 90, 3, 0.3); }
      }
      // 龙系刺弹（草龙龙鳞刺 / 沙晶锥刺 / 黑炎龙鳞 / 熔岩龙牙 / 骨刺 / 齿轮弹 / 深海水晶刺）：高速直线，触地（海）即消；被山石障碍阻挡
      if (SPIKE_KINDS[this.kind] && !this.dead) {
        const gy = g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y;
        if (this.y > gy - 4) {
          this.dead = true;
          burst(g, this.x, gy - 4, 4, SPIKE_FX[this.kind] || SPIKE_FX.spike, 100, 3, 0.3);
        } else {
          for (const r of g.rocks) {
            if (r.dead) continue;
            if (r.contains(this.x, this.y, this.r + 2)) {
              this.dead = true;
              burst(g, this.x, this.y, 4, SPIKE_FX[this.kind] || SPIKE_FX.spike, 100, 3, 0.3);
              break;
            }
          }
        }
      }
      // 炮弹：触地 / 触山石即引爆
      if (this.kind === 'shell' && !this.dead) {
        if (this.y > CFG.GROUND_Y - 8) {
          this.dead = true;
          if (this.onExpire) this.onExpire(g, this);
        } else {
          for (const r of g.rocks) {
            if (r.dead) continue;
            const cx = clamp(this.x, r.left, r.left + r.w);
            const cy = clamp(this.y, r.top, r.baseY);
            if ((this.x - cx) ** 2 + (this.y - cy) ** 2 < (this.r + 4) ** 2) {
              this.dead = true;
              if (this.onExpire) this.onExpire(g, this);
              break;
            }
          }
        }
      }
      // 火山口巨大火焰弹（lava）：抛物线抛射，触地 / 触障碍即爆炸
      if (this.kind === 'lava' && !this.dead) {
        const gy = g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y;
        if (this.y > gy - this.r * 0.5) {
          this.dead = true;
          if (this.onExpire) this.onExpire(g, this);
        } else {
          for (const r of g.rocks) {
            if (r.dead) continue;
            const cx = clamp(this.x, r.left, r.left + r.w);
            const cy = clamp(this.y, r.top, r.baseY);
            if ((this.x - cx) ** 2 + (this.y - cy) ** 2 < (this.r + 4) ** 2) {
              this.dead = true;
              if (this.onExpire) this.onExpire(g, this);
              break;
            }
          }
        }
      }
      // 斧王酒壶炸弹（potbomb）：抛物线，触地 / 触障碍即爆炸
      if (this.kind === 'potbomb' && !this.dead) {
        const gy = g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y;
        if (this.y > gy - this.r * 0.5) {
          this.y = gy - this.r * 0.5;
          this.dead = true;
          if (this.onExpire) this.onExpire(g, this);
        } else {
          for (const r of g.rocks) {
            if (r.dead) continue;
            const cx = clamp(this.x, r.left, r.left + r.w);
            const cy = clamp(this.y, r.top, r.baseY);
            if ((this.x - cx) ** 2 + (this.y - cy) ** 2 < (this.r + 4) ** 2) {
              this.dead = true;
              if (this.onExpire) this.onExpire(g, this);
              break;
            }
          }
        }
      }
      if (this.kind === 'fireball') {
        this.trail += dt;
        if (this.trail > 0.05) {
          this.trail = 0;
          g.particles.push(new Particle(this.x, this.y,
            rand(-30, 30), rand(-50, -10), 0.4, rand(3, 6),
            Math.random() < 0.5 ? '#ff7b2e' : '#ffd23b'));
        }
      }
      // 斧王飞斧雷电拖尾：青蓝色分叉闪电粒子 + 电弧感
      if (this.kind === 'axe' && !this.friendly && !this.neutralized) {
        this._axeT = (this._axeT || 0) + dt;
        if (this._axeT > 0.025) {
          this._axeT = 0;
          const spd = Math.hypot(this.vx, this.vy) || 1;
          const bx = -this.vx / spd, by = -this.vy / spd;
          const cols = ['#7fd8ff', '#a5f3fc', '#ffffff', '#3a8f9e'];
          for (let i = 0; i < 3; i++) {
            const jx = rand(-6, 6), jy = rand(-6, 6);
            g.particles.push(new Particle(
              this.x + bx * this.r + jx, this.y + by * this.r + jy,
              bx * rand(40, 180) + rand(-30, 30),
              by * rand(40, 180) + rand(-30, 30),
              rand(0.12, 0.3), rand(1.5, 3.5),
              cols[randi(0, cols.length - 1)]));
          }
        }
      }
      // 火焰弹拖尾：沿飞行反方向持续喷射火焰粒子（弹体越大粒子越粗）；trailCols 可自定义配色（紫焰苹果）
      // trailLite（角色最终形态）：稀疏、细小、短命的微粒，仅作点缀不遮挡战场
      // pxFire（火鸡王像素火球）不走大块火焰，改走下方「火星向上飘散」像素拖尾
      if ((this.fireTrail || this.trailCols) && !this.pxFire && !this.neutralized) {
        this.trail += dt;
        const tick = this.trailLite ? 0.11 : 0.03;
        if (this.trail > tick) {
          this.trail = 0;
          const spd = Math.hypot(this.vx, this.vy);
          const bx = spd > 1 ? this.vx / spd : -1, by = spd > 1 ? this.vy / spd : 0;
          const fireCols = this.trailCols || ['#ff2a0a', '#ff5a1a', '#ff9d2e', '#ffd23b', '#fff5d0'];
          const nP = this.trailLite ? 1 : 3;
          for (let i = 0; i < nP; i++) {
            const ja = rand(0, TAU), jr = rand(10, 60);
            const psize = this.trailLite ? rand(this.r * 0.08, this.r * 0.18) : rand(this.r * 0.35, this.r * 0.8);
            const jit = this.trailLite ? 0.2 : 0.4;
            g.particles.push(new Particle(
              this.x + rand(-this.r * jit, this.r * jit),
              this.y + rand(-this.r * jit, this.r * jit),
              (-bx * rand(50, 140) + Math.cos(ja) * jr) * (this.trailLite ? 0.35 : 1),
              (-by * rand(50, 140) + Math.sin(ja) * jr - 30) * (this.trailLite ? 0.35 : 1),
              this.trailLite ? rand(0.14, 0.26) : rand(0.35, 0.7), psize,
              fireCols[randi(0, fireCols.length - 1)]));
          }
        }
      }
      // 像素火球（玩家火焰弹 / 火鸡王火焰弹）：球后拖出成簇火星像素，火星向上飘散（尺寸随弹体放大）
      if ((this.pxFire || (this.friendly && this.element === 'flame')) && !this.neutralized) {
        this.trail += dt;
        if (this.trail > 0.045) {
          this.trail = 0;
          const spd = Math.hypot(this.vx, this.vy) || 1;
          const bx = this.vx / spd, by = this.vy / spd;
          const sf = 0.7 + this.r / 14;                    // 粒子尺寸随弹体（r=42 → ×3.7）
          for (let i = 0; i < 3; i++) {
            g.particles.push(new Particle(
              this.x - bx * this.r * 0.95 + rand(-3, 3) * sf,
              this.y - by * this.r * 0.95 + rand(-3, 3) * sf,
              -bx * rand(30, 90) * sf + rand(-18, 18) * sf,
              -by * rand(20, 60) * sf - rand(28, 70) * sf,  // 火星固定向上飘散
              rand(0.24, 0.46), rand(1.8, 3.6) * sf,
              Math.random() < 0.45 ? '#ffd23b' : (Math.random() < 0.65 ? '#ff9d2e' : '#ff5a1a')));
          }
          // 偶发白热亮芯火星（更亮更大）
          if (Math.random() < 0.5) g.particles.push(new Particle(
            this.x - bx * this.r * 0.8, this.y - by * this.r * 0.8 + rand(-2, 2) * sf,
            -bx * rand(20, 50) * sf, -by * rand(10, 40) * sf - rand(20, 50) * sf,
            rand(0.18, 0.3), rand(1.4, 2.4) * sf, '#fff3a8'));
        }
      }
      // 寒冰弹拖尾：成簇冰晶像素轨迹（冷白/浅蓝/深蓝三色，向后缓飘，尺寸随弹体放大）
      if (this.friendly && this.element === 'ice' && !this.neutralized) {
        this.trail += dt;
        if (this.trail > 0.05) {
          this.trail = 0;
          const spd = Math.hypot(this.vx, this.vy) || 1;
          const bx = this.vx / spd, by = this.vy / spd;
          const sf = 0.7 + this.r / 12;                    // 粒子尺寸随弹体（r=21.6 → ×2.5）
          for (let i = 0; i < 2; i++) {
            g.particles.push(new Particle(
              this.x - bx * this.r + rand(-3, 3) * sf, this.y - by * this.r + rand(-3, 3) * sf,
              -bx * rand(20, 70) * sf + rand(-14, 14) * sf, -by * rand(20, 70) * sf + rand(-14, 14) * sf,
              rand(0.28, 0.5), rand(1.8, 3.2) * sf,
              Math.random() < 0.4 ? '#eaf7ff' : (Math.random() < 0.6 ? '#bfe9ff' : '#7fc6ef')));
          }
          // 偶发碎白晶（细小亮片）
          if (Math.random() < 0.55) g.particles.push(new Particle(
            this.x - bx * this.r * 0.7, this.y - by * this.r * 0.7,
            -bx * rand(10, 40) * sf + rand(-20, 20) * sf, -by * rand(10, 40) * sf + rand(-20, 20) * sf,
            rand(0.3, 0.55), rand(1.2, 2.2) * sf, '#ffffff'));
        }
      }
      // 毒液弹拖尾：粘稠丝线像素 + 滴落毒液像素点（向下坠落）；穿过障碍时在墙上留腐蚀痕
      if (this.friendly && this.element === 'poison' && !this.neutralized) {
        this.trail += dt;
        if (this.trail > 0.05) {
          this.trail = 0;
          const spd = Math.hypot(this.vx, this.vy) || 1;
          const bx = this.vx / spd, by = this.vy / spd;
          // 粘稠丝线：浅绿短像素，悬在弹道上
          g.particles.push(new Particle(
            this.x - bx * this.r, this.y - by * this.r,
            -bx * rand(10, 40), -by * rand(10, 40),
            rand(0.18, 0.3), rand(1.6, 2.6), '#7dff6a'));
          // 滴落毒液：深绿颗粒，带向下初速
          if (Math.random() < 0.7) {
            g.particles.push(new Particle(
              this.x - bx * this.r * 0.6 + rand(-3, 3), this.y - by * this.r * 0.6 + rand(-3, 3),
              -bx * rand(10, 40) + rand(-12, 12), -by * rand(0, 20) + rand(20, 60),
              rand(0.25, 0.45), rand(2, 3.6), Math.random() < 0.5 ? '#14532d' : '#2dd44a', 220));
          }
        }
        // 命中墙壁（山石/破碎障碍）：留下绿色腐蚀痕迹，每面墙只留一次（离开后重置）
        if (g.addPoisonStain) {
          let wall = null;
          for (const rk of g.rocks) {
            if (!rk.dead && rk.contains && rk.contains(this.x, this.y, this.r)) { wall = rk; break; }
          }
          if (!wall) {
            for (const k of g.breakables) {
              if (!k.dead && k.onScreen && k.contains(this.x, this.y, this.r)) { wall = k; break; }
            }
          }
          if (wall) {
            if (this._stainWall !== wall) { this._stainWall = wall; g.addPoisonStain(this.x, this.y); }
          } else this._stainWall = null;
        }
      }
      // 超猫前3阶段玫红激光块：简单蓝红粒子拖尾（蓝/红交替小颗粒，向后缓散）
      if (this.brTrail && !this.neutralized) {
        this._brT = (this._brT || 0) + dt;
        if (this._brT > 0.03) {
          this._brT = 0;
          const spd = Math.hypot(this.vx, this.vy) || 1;
          const bx = this.vx / spd, by = this.vy / spd;
          g.particles.push(new Particle(
            this.x - bx * this.r * 1.4 + rand(-2, 2),
            this.y - by * this.r * 1.4 + rand(-2, 2),
            -bx * rand(30, 90) + rand(-16, 16),
            -by * rand(30, 90) + rand(-16, 16),
            rand(0.18, 0.34), rand(1.5, 2.8),
            Math.random() < 0.5 ? '#3b8bff' : '#ff3b5c'));
        }
      }
      // 超猫五重激光串：明显玫红拖尾 —— 每帧记录轨迹点（光带缎带数据源）+ 高频浓密玫红粒子
      if (this.kind === 'ultlaser' && !this.neutralized) {
        if (!this.ultPts) this.ultPts = [];
        this.ultPts.push({ x: this.x, y: this.y });
        if (this.ultPts.length > 18) this.ultPts.shift();
        this._ultT = (this._ultT || 0) + dt;
        if (this._ultT > 0.018) {
          this._ultT = 0;
          const spd = Math.hypot(this.vx, this.vy) || 1;
          const bx = this.vx / spd, by = this.vy / spd;
          const cols = ['#ff2e88', '#ff6fb0', '#ffb0d4', '#ffe0ef', '#ffffff'];
          for (let i = 0; i < 2; i++) {
            g.particles.push(new Particle(
              this.x - bx * this.r * 1.3 + rand(-3, 3),
              this.y - by * this.r * 1.3 + rand(-3, 3),
              -bx * rand(40, 150) + rand(-42, 42),
              -by * rand(40, 150) + rand(-42, 42),
              rand(0.22, 0.44), rand(2, 5.2),
              cols[randi(0, cols.length - 1)]));
          }
        }
      }
      // 弹速强化速度线：我方弹弹尾拉出青白速度线，等级越高越长越密（纯视觉反馈；超猫蓝红拖尾弹不走青白）
      if (this.friendly && this.spdTrail > 0 && !this.neutralized && !this.brTrail) {
        this._spdT = (this._spdT || 0) + dt;
        if (this._spdT > 0.035) {
          this._spdT = 0;
          const spd = Math.hypot(this.vx, this.vy) || 1;
          const bx = this.vx / spd, by = this.vy / spd;
          const nP = this.spdTrail >= 6 ? 2 : 1;
          for (let i = 0; i < nP; i++) {
            g.particles.push(new Particle(
              this.x - bx * this.r * 1.5 + rand(-2, 2),
              this.y - by * this.r * 1.5 + rand(-2, 2),
              -bx * rand(40, 110) + rand(-14, 14),
              -by * rand(40, 110) + rand(-14, 14),
              0.1 + this.spdTrail * 0.03,
              rand(1.4, 2 + this.spdTrail * 0.3),
              Math.random() < 0.45 ? '#ffffff' : '#a5f3fc'));
          }
        }
      }
      // 亡灵骷髅王小骷髅弹：记录飞行轨迹点（弧线拖尾数据源）+ 蓝绿色魂火粒子
      if (this.kind === 'skull' && !this.dead) {
        if (!this.skullPts) this.skullPts = [];
        this.skullPts.push({ x: this.x, y: this.y });
        if (this.skullPts.length > 14) this.skullPts.shift();
        if (!this.neutralized) {
          this.trail += dt;
          if (this.trail > 0.045) {
            this.trail = 0;
            const spd = Math.hypot(this.vx, this.vy) || 1;
            const bx = this.vx / spd, by = this.vy / spd;
            const cols = ['#35e0ff', '#2ee6a8', '#7ff5d8', '#b8fff0'];
            g.particles.push(new Particle(
              this.x - bx * 12 + rand(-3, 3), this.y - by * 12 + rand(-3, 3),
              -bx * rand(35, 90) + rand(-28, 28),
              -by * rand(35, 90) + rand(-28, 28) - 18,
              rand(0.25, 0.5), rand(2, 4.5),
              cols[randi(0, cols.length - 1)]));
          }
        }
      }
      // 沙之行者沙之刺：记录飞行轨迹点（长沙尘拖尾数据源）+ 沙尘粒子
      if (this.kind === 'sandSpike' && !this.dead) {
        if (!this.sandPts) this.sandPts = [];
        this.sandPts.push({ x: this.x, y: this.y });
        if (this.sandPts.length > 22) this.sandPts.shift();
        if (!this.neutralized) {
          this.trail += dt;
          if (this.trail > 0.03) {
            this.trail = 0;
            const spd = Math.hypot(this.vx, this.vy) || 1;
            const bx = this.vx / spd, by = this.vy / spd;
            g.particles.push(new Particle(
              this.x - bx * 10 + rand(-5, 5), this.y - by * 10 + rand(-5, 5),
              -bx * rand(20, 70) + rand(-20, 20),
              -by * rand(20, 70) + rand(-20, 20) - 8,
              rand(0.25, 0.55), rand(2, 5),
              Math.random() < 0.5 ? '#d8a86a' : '#f5e3b8'));
          }
        }
      }
      // 乔治船长重型炮弹：记录飞行轨迹点（橙黄色长拖尾数据源）+ 余烬/黑烟粒子
      if (this.kind === 'capShell' && !this.dead) {
        if (!this.capPts) this.capPts = [];
        this.capPts.push({ x: this.x, y: this.y });
        if (this.capPts.length > 28) this.capPts.shift();
        if (!this.neutralized) {
          this.trail += dt;
          if (this.trail > 0.028) {
            this.trail = 0;
            const spd = Math.hypot(this.vx, this.vy) || 1;
            const bx = this.vx / spd, by = this.vy / spd;
            const cols = ['#ff8a2a', '#ffd23b', '#fff0b0', '#6a4a3a'];
            g.particles.push(new Particle(
              this.x - bx * 13 + rand(-5, 5), this.y - by * 13 + rand(-5, 5),
              -bx * rand(20, 80) + rand(-26, 26),
              -by * rand(20, 80) + rand(-26, 26) - 12,
              rand(0.3, 0.62), rand(2.5, 6),
              cols[randi(0, cols.length - 1)]));
          }
        }
      }
      // 火遮眼火焰斩：周期性留下斩击残影（月牙刃渐隐副本）+ 通体燃烧的火焰粒子
      if (this.kind === 'fireSlash' && !this.dead) {
        if (!this.slashGhosts) this.slashGhosts = [];
        for (const gh of this.slashGhosts) gh.age += dt;
        this.slashGhosts = this.slashGhosts.filter(gh => gh.age < 0.3);
        this.trail += dt;
        if (this.trail > 0.06) {
          this.trail = 0;
          this.slashGhosts.push({ x: this.x, y: this.y, age: 0 });
          if (this.slashGhosts.length > 5) this.slashGhosts.shift();
        }
        if (!this.neutralized && Math.random() < 0.78) {
          const R = this.slashR, span = this.slashSpan;
          const ang = Math.atan2(this.vy, this.vx);
          // 在月牙刃通体（弧向均匀、径向带厚度）随机取点火苗
          const aa = rand(-span, span);
          const rr = R + rand(-30, 28);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const lx0 = Math.cos(aa) * rr, ly0 = Math.sin(aa) * rr;
          const px = this.x + ca * lx0 - sa * ly0;
          const py = this.y + sa * lx0 + ca * ly0;
          const ra = ang + aa;                        // 该点朝外径向
          const cols = ['#ff3b08', '#ff7a1a', '#ffb13b', '#ffd23b', '#fff3c0'];
          g.particles.push(new Particle(
            px + rand(-3, 3), py + rand(-3, 3),
            Math.cos(ra) * rand(18, 85) + rand(-22, 22),
            Math.sin(ra) * rand(18, 85) + rand(-22, 22) - 28,
            rand(0.3, 0.64), rand(2.2, 5.5),
            cols[randi(0, cols.length - 1)], -42));
        }
      }
      // 紫手狐火弹：记录轨迹点（紫色火焰短缎带数据源）
      if (this.kind === 'foxFire' && !this.dead) {
        if (!this.foxPts) this.foxPts = [];
        this.foxPts.push({ x: this.x, y: this.y });
        if (this.foxPts.length > 12) this.foxPts.shift();
      }
      // 紫手巨型飞牌：自转弧线飞行时洒落紫色魔光微粒
      if (this.kind === 'pCard' && !this.dead && !this.neutralized && Math.random() < 0.5) {
        g.particles.push(new Particle(
          this.x + rand(-16, 16), this.y + rand(-20, 20),
          rand(-40, 10), rand(-36, 20),
          rand(0.25, 0.5), rand(1.8, 4),
          Math.random() < 0.6 ? '#c06bff' : '#ff5ad0'));
      }
      // 怪客巨型十字弹：快速自转；先高速追踪玩家，逼近后绕天空区域边缘转一圈再碎裂
      if (this.kind === 'cross' && !this.neutralized && !this.dead) {
        const xL = 60, xR = CFG.W - 60, yTop = 70, yBot = CFG.GROUND_Y - 40, rc = 40;  // 绕场路径：贴天空边缘，底边沿地面上方
        const Ltop = xR - xL - 2 * rc;             // 顶/底直边长度
        const Lside = yBot - yTop - 2 * rc;        // 左/右直边长度
        const arc = Math.PI / 2 * rc;              // 单个圆角弧长
        const P = 2 * Ltop + 2 * Lside + 4 * arc;  // 圆角矩形总周长
        // 周长参数 s → 边缘路径坐标（顺时针，s=0 在顶边左段起点）
        const edgePt = (s) => {
          s = ((s % P) + P) % P;
          if (s < Ltop) return { x: xL + rc + s, y: yTop };
          s -= Ltop;
          if (s < arc) { const a = -Math.PI / 2 + s / rc; return { x: xR - rc + Math.cos(a) * rc, y: yTop + rc + Math.sin(a) * rc }; }
          s -= arc;
          if (s < Lside) return { x: xR, y: yTop + rc + s };
          s -= Lside;
          if (s < arc) { const a = s / rc; return { x: xR - rc + Math.cos(a) * rc, y: yBot - rc + Math.sin(a) * rc }; }
          s -= arc;
          if (s < Ltop) return { x: xR - rc - s, y: yBot };
          s -= Ltop;
          if (s < arc) { const a = Math.PI / 2 + s / rc; return { x: xL + rc + Math.cos(a) * rc, y: yBot - rc + Math.sin(a) * rc }; }
          s -= arc;
          if (s < Lside) return { x: xL, y: yBot - rc - s };
          s -= Lside;
          const a = Math.PI + s / rc; return { x: xL + rc + Math.cos(a) * rc, y: yTop + rc + Math.sin(a) * rc };
        };
        if (!this.crossMode) { this.crossMode = 'chase'; this.crossSpd = Math.max(260, Math.hypot(this.vx, this.vy)); }
        if (this.crossMode === 'chase') {
          const pl = g.player;
          const ta = Math.atan2(pl.y - this.y, pl.x - this.x);
          let cur = Math.atan2(this.vy, this.vx);
          let d = ta - cur;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          cur += clamp(d, -3.8 * dt, 3.8 * dt);       // 快速转向，高速逼近
          this.vx = Math.cos(cur) * this.crossSpd; this.vy = Math.sin(cur) * this.crossSpd;
          this.angle = cur;
          if (Math.hypot(pl.x - this.x, pl.y - this.y) < 150 || this.t > 2.6) {
            // 取离当前位置最近的边缘路径点作为绕圈起点
            let bestS = 0, bestD = Infinity;
            for (let i = 0; i < 180; i++) {
              const pt = edgePt(P * i / 180);
              const dd = (pt.x - this.x) ** 2 + (pt.y - this.y) ** 2;
              if (dd < bestD) { bestD = dd; bestS = P * i / 180; }
            }
            this.crossMode = 'toEdge';
            this.edgeS0 = bestS; this.edgeTravel = 0;
          }
        } else if (this.crossMode === 'toEdge') {
          const tgt = edgePt(this.edgeS0);
          const dx = tgt.x - this.x, dy = tgt.y - this.y, dd = Math.hypot(dx, dy) || 1;
          const sp = 360;
          this.vx = dx / dd * sp; this.vy = dy / dd * sp;
          this.angle = Math.atan2(dy, dx);
          if (dd < 28) { this.crossMode = 'edge'; this.x = tgt.x; this.y = tgt.y; }
        } else {
          // 沿屏幕边缘顺时针绕行一整圈，完成后碎裂
          const sp = 380;
          this.edgeTravel += sp * dt;
          const pt = edgePt(this.edgeS0 + this.edgeTravel);
          this.x = pt.x; this.y = pt.y;
          this.vx = 0; this.vy = 0;
          if (this.edgeTravel >= P) {
            this.dead = true;
            burst(g, this.x, this.y, 14, ['#e0453a', '#ffd23b', '#101018'], 200, 5, 0.5);
          }
        }
      }
      /* ================= 深海恶霸弹种（运动控制，统一在通用位移前算出 vx/vy） ================= */
      if (this.kind === 'whook' && !this.neutralized) {
        const P = CFG.seaBully;
        this.hkCd = Math.max(0, this.hkCd - dt);
        const ox = this.x, oy = this.y;
        if (this.hkPhase === 'out') {
          // 第一段：水平高速直线飞向屏幕中部
          this.vx = -this.hkSpd; this.vy = 0; this.hkAngle = Math.PI;
          if (this.x <= P.hookMidX) { this.hkPhase = 'turn'; this.hkT = 0; SFX.sweep(); g.shake(4); }
        } else if (this.hkPhase === 'turn') {
          // 唯一一次 90° 圆弧转向：减速 → 钩头向上/下猛甩；出手方向已定死，不追踪玩家
          this.hkT += dt;
          const k = clamp(this.hkT / this.hkTurnT, 0, 1);
          const e = k * k * (3 - 2 * k);                       // smoothstep
          // 向下转 π→π/2；向上转 π→3π/2（若用 -π/2 会走 270° 长路径，钩头先下探再回上）
          const tgt = this.hkDir > 0 ? Math.PI / 2 : 3 * Math.PI / 2;
          let a = Math.PI + (tgt - Math.PI) * e;               // 唯一一次 90° 转向
          const f = 1 - 0.45 * Math.sin(k * Math.PI);          // 转向中减速，甩直后重新加速
          this.vx = Math.cos(a) * this.hkSpd * f;
          this.vy = Math.sin(a) * this.hkSpd * f;
          this.hkAngle = a;
          // 转向圆弧沿屏内左缘完成：钩头不漂出屏幕，保证 90° 转后的垂直横扫全程可见
          const EDGE = 78;
          if (this.x + this.vx * dt < EDGE) this.vx = Math.max(0, (EDGE - this.x) / dt);
          if (Math.random() < 0.5) {                           // 甩链灰白残影
            g.particles.push(new Particle(this.x + rand(-16, 16), this.y + rand(-16, 16),
              rand(-80, 80), rand(-80, 80), rand(0.18, 0.34), rand(2, 4.5),
              Math.random() < 0.5 ? 'rgba(200,210,225,0.5)' : 'rgba(120,130,150,0.55)'));
          }
          if (k >= 1) { this.hkPhase = 'fly2'; this.hkT = 0; this.hkStraight = false; }
        } else if (this.hkPhase === 'fly2') {
          // 转向后继续高速飞出；链条甩动波浪传播完、重新绷直后链条恢复伤害
          this.hkT += dt;
          const a = this.hkDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          this.vx = 0; this.vy = Math.sin(a) * this.hkSpd; this.hkAngle = a;
          if (this.hkT > (this.enr ? 0.18 : 0.27)) this.hkStraight = true;
          if (this.y < -64 || this.y > CFG.H + 64 || this.hkT > 0.62) { this.hkPhase = 'retract'; this.hkT = 0; }
        } else if (this.hkPhase === 'retract') {
          // 飞出屏幕后快速收回（无伤害）：直接朝锚点回缩，速度折算给通用位移
          const dx = this.hkAnchor.x - this.x, dy = this.hkAnchor.y - this.y;
          const dd = Math.hypot(dx, dy) || 1;
          const mv = Math.min(dd, 1050 * dt);
          this.vx = dx / dd * mv / dt; this.vy = dy / dd * mv / dt;
          if (dd < 30) this.dead = true;
        }
        this._ox = ox; this._oy = oy;
      }
      /* —— 鸦伯爵宝石（运动控制，统一在通用位移前算出 vx/vy）：三拍循环中段各自加速 / 抛物线抛掷 / 去程回程反转 —— */
      if (this.kind === 'gem' && !this.neutralized) {
        const P = CFG.crowCount;
        const mul = P.gemSpdMul[this.gemTier] * (this.enr ? P.enrSpdMul : 1);
        this.gT += dt;
        if (this.gemMode === 'throw' || this.gemMode === 'fwd') {
          if (this.gPhase === 'fly') {
            // 前段慢：弧线飞向各自的瞄准点（玩家+固定偏移），飞行中逐渐修正（throw 修正强 / fwd 修正弱）
            const turn = this.gemMode === 'throw' ? P.throwTurn : P.fwdTurn;
            const sp = this.gemV0 * mul;
            const ta = Math.atan2(g.player.y + this.aimOffY - this.y, g.player.x + this.aimOffX - this.x);
            let d = ta - this.outA;
            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;
            this.outA += clamp(d, -turn * dt, turn * dt);
            this.vx = Math.cos(this.outA) * sp; this.vy = Math.sin(this.outA) * sp;
            if (Math.hypot(this.x - this.gemSx, this.y - this.gemSy) >= P.accDist) this.gPhase = 'dash';   // 飞离枪口约屏幕中段各自加速
          } else {
            const sp = this.gemV1;                        // 加速目标为绝对值：强拍最猛
            this.vx = Math.cos(this.outA) * sp; this.vy = Math.sin(this.outA) * sp;
          }
        } else if (this.gemMode === 'lob') {
          // 抛掷：重力抛物线，从上方落下封走位（触地碎裂在位移后统一处理）
          this.vy += P.lobG * dt;
        } else {
          // 回旋：直线前飞 → 指定点急停 → 瞬间掉头180°沿原路折返（轻微偏向玩家旧位置）
          if (this.gPhase === 'out') {
            const sp = P.retSpd * mul;
            this.vx = Math.cos(this.outA) * sp; this.vy = Math.sin(this.outA) * sp;
            if ((this.x - this.gemSx) * this.foldDir >= this.foldDist) {   // 朝玩家一侧飞出指定距离后折返（左右皆可）
              this.gPhase = 'pause'; this.gT = 0;
              this.pOld = { x: g.player.x, y: g.player.y };
              const C0 = GEM_COLS[this.gemCol];
              burst(g, this.x, this.y, 9, [C0.main, C0.lite, '#fff'], 190, 4, 0.3);
            }
          } else if (this.gPhase === 'pause') {
            this.vx = 0; this.vy = 0;
            if (this.gT >= this.pauseT) {
              this.gPhase = 'back';
              let aBack = this.outA + Math.PI;                    // 瞬间掉头 180°
              const aP = Math.atan2(this.pOld.y - this.y, this.pOld.x - this.x);
              let d = aP - aBack;
              while (d > Math.PI) d -= TAU;
              while (d < -Math.PI) d += TAU;
              aBack += d * P.retBias;                             // 折返轻微偏向玩家旧位置（身后危险成立）
              this.backA = aBack;
              const sp = P.retSpd * mul * P.retBackMul;           // 回程快
              this.vx = Math.cos(aBack) * sp; this.vy = Math.sin(aBack) * sp;
            }
          } else {
            const sp = P.retSpd * mul * P.retBackMul;
            this.vx = Math.cos(this.backA) * sp; this.vy = Math.sin(this.backA) * sp;
          }
        }
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      /* ============== 深海恶霸弹种（位移后：水鲨追踪 / 炸弹起爆 / 铁链模拟伤害） ============== */
      if (this.kind === 'wshark' && !this.dead && !this.neutralized) {
        const P = CFG.seaBully;
        this.swim += dt;
        this.cruiseT -= dt;
        if (this.cruiseT <= 0) {
          // 惯性追踪：朝玩家转向但有明显角速度限制，追踪初期转向速率渐强（天然弧线）
          const p = g.player;
          const ta = Math.atan2(p.y - this.y, p.x - this.x);
          let cur = Math.atan2(this.vy, this.vx);
          let d = ta - cur;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          this.turnEase = Math.min(1, this.turnEase + dt / 0.7);
          const maxTurn = (this.enr ? P.sharkTurnEnr : P.sharkTurn) * (0.3 + 0.7 * this.turnEase);
          cur += clamp(d, -maxTurn * dt, maxTurn * dt);
          const sp = this.enr ? P.sharkSpdEnr : P.sharkSpd;
          this.vx = Math.cos(cur) * sp; this.vy = Math.sin(cur) * sp;
          this.angle = cur;
        }
        // 连续细小气泡拖尾（仅视觉，气泡无伤害）
        this._bubT -= dt;
        if (this._bubT <= 0) {
          this._bubT = 0.05;
          const spd = Math.hypot(this.vx, this.vy) || 1;
          const bx = -this.vx / spd, by = -this.vy / spd;
          for (let i = 0; i < 2; i++) {
            g.particles.push(new Particle(
              this.x + bx * 24 + rand(-4, 4), this.y + by * 20 + rand(-5, 5),
              bx * rand(20, 60) + rand(-24, 24), by * rand(20, 60) + rand(-30, 6),
              rand(0.3, 0.7), rand(1.4, 3.2),
              Math.random() < 0.5 ? 'rgba(150,210,255,0.75)' : 'rgba(214,240,255,0.85)'));
          }
        }
        if (this.x < -70 || this.x > CFG.W + 70 || this.y < -70 || this.y > CFG.H + 50) this.dead = true;
      }
      if (this.kind === 'wbomb' && !this.dead) {
        const P = CFG.seaBully;
        if (this.exT < 0) {
          if (!this.neutralized) {
            // 断续团状黑烟（非连续直线）：随机间隔、成团喷出
            this.smokeT -= dt;
            if (this.smokeT <= 0) {
              this.smokeT = rand(0.07, 0.13);
              if (Math.random() < 0.85) {
                for (let i = 0; i < 3; i++) {
                  g.particles.push(new Particle(this.x + rand(-8, 8), this.y - 10 + rand(-4, 4),
                    rand(-34, 18), rand(-48, -8), rand(0.4, 0.75), rand(4, 8.5),
                    Math.random() < 0.5 ? '#3a3a44' : '#22222a'));
                }
              }
            }
            // 到达锁定落点即爆（下降段越过 y，或水平抵达）
            if ((this.vy > 0 && this.y >= this.ty) || (this.vx < 0 && this.x <= this.tx)) {
              if (this.vy > 0 && this.y >= this.ty) this.y = this.ty;
              this.exT = 0;
              this.grav = 0;
              this.vx = 0; this.vy = 0;
              // 深红黑芯 + 外围橙红火焰
              burst(g, this.x, this.y, 26, ['#1a0505', '#7a1208', '#c62f14', '#ff6a1a', '#ffb13b', '#fff3c8'], 360, 8, 0.6, 110);
              for (let i = 0; i < 12; i++) {
                g.particles.push(new Particle(this.x, this.y, rand(-260, 260), rand(-260, -40),
                  rand(0.4, 0.9), rand(4, 9), Math.random() < 0.5 ? '#2a2a32' : '#4a4a54'));
              }
              SFX.explode(true); g.shake(11);
            }
          }
        } else if (!this.neutralized) {
          this.exT += dt;
          const p = g.player;
          // 爆炸中心伤害（一次）
          if (!this.coreHit) {
            this.coreHit = true;
            if (Math.hypot(p.x - this.x, p.y - this.y) < P.coreR + p.radius) p.hurt(this.dmg, g, this.src);
          }
          // 三道深色环形冲击波：依次扩散，环带内各结算一次
          const dur = this.enr ? P.ringDurEnr : P.ringDur;
          for (let i = 0; i < 3; i++) {
            const rt = this.exT - P.ringDelay[i];
            if (rt >= 0 && !this.ringHit[i]) {
              const kk = Math.min(1, rt / dur);
              const ee = 1 - Math.pow(1 - kk, 3);
              const rr = ee * P.ringMax[i];
              if (Math.abs(Math.hypot(p.x - this.x, p.y - this.y) - rr) < P.ringBand + p.radius) {
                this.ringHit[i] = true;
                p.hurt(this.dmg, g, this.src);
              }
              if (kk >= 1) this.ringHit[i] = true;
            }
          }
          if (Math.random() < 0.4) {
            g.particles.push(new Particle(this.x + rand(-40, 40), this.y + rand(-30, 30),
              rand(-60, 60), rand(-90, -20), rand(0.3, 0.7), rand(2.5, 6),
              Math.random() < 0.55 ? '#ff7b2e' : '#3a3a44'));
          }
          if (this.exT > P.ringDelay[2] + dur + 0.16) this.dead = true;
        }
      }
      if (this.kind === 'whook' && !this.dead) {
        // 铁链逐节模拟（head 端=钩头，尾端=锚点；双向约束形成甩链波浪）
        const P = CFG.seaBully;
        if (!this.hkPts) {
          const n = Math.floor(P.chainLen / P.linkGap) + 1;
          this.hkPts = [];
          for (let i = 0; i < n; i++) this.hkPts.push({ x: this.hkAnchor.x, y: this.hkAnchor.y });
        }
        const pts = this.hkPts;
        if (!this.neutralized) {
          pts[0].x = this.x; pts[0].y = this.y;
          for (let i = 1; i < pts.length; i++) {
            let dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
            const d = Math.hypot(dx, dy) || 0.001;
            if (d > P.linkGap) { pts[i].x = pts[i - 1].x + dx / d * P.linkGap; pts[i].y = pts[i - 1].y + dy / d * P.linkGap; }
          }
          const a = this.hkAnchor;
          pts[pts.length - 1].x += (a.x - pts[pts.length - 1].x) * Math.min(1, dt * 12);
          pts[pts.length - 1].y += (a.y - pts[pts.length - 1].y) * Math.min(1, dt * 12);
          for (let i = pts.length - 2; i >= 0; i--) {
            let dx = pts[i].x - pts[i + 1].x, dy = pts[i].y - pts[i + 1].y;
            const d = Math.hypot(dx, dy) || 0.001;
            if (d > P.linkGap) { pts[i].x = pts[i + 1].x + dx / d * P.linkGap; pts[i].y = pts[i + 1].y + dy / d * P.linkGap; }
          }
          this.x = pts[0].x; this.y = pts[0].y;
          // 钩头朝向跟随实际位移（绷直后被链条牵引会走弧线/回收时朝锚点）
          const mvx = this.x - this._ox, mvy = this.y - this._oy;
          if ((this.hkPhase === 'fly2' || this.hkPhase === 'retract') && Math.hypot(mvx, mvy) > 0.3) {
            this.hkAngle = Math.atan2(mvy, mvx);
          }
          // 完全展开判定：链条 6 成长度已沿横跨路线拉开后，绷直段有伤害
          const headD = Math.hypot(this.x - a.x, this.y - a.y);
          if (this.hkPhase === 'out' && headD >= P.chainLen * 0.6) this.hkStraight = true;
          const p = g.player;
          const mSpd = Math.hypot(mvx, mvy);
          // —— 钩中玩家：钩住并拖走（每钩只钩一次；回收阶段不钩；已被别的钩拖着不重复钩） ——
          if (!this.hkGrabbed && !p.hookedBy && this.hkPhase !== 'retract' &&
              Math.hypot(p.x - this.x, p.y - this.y) < P.hookW + p.radius * 0.7) {
            this.hkGrabbed = true;
            // 玩家挂在钩尖：钩头局部坐标偏移（放大后钩尖约在局部 (-34,42)）
            this.hkGrab = { p, dist: 0, ox: -14, oy: 40 };
            p.hookedBy = this;
            p.vx = 0; p.vy = 0;
            p.hurt(this.dmg, g, this.src);   // 钩中瞬间结算一次伤害（无敌期仍会被钩走）
            if (window.SFX) SFX.hit(true);   // 被钩中为关键受击反馈：强制播放，不受突发抑制影响
            g.shake(7);
            burst(g, p.x, p.y, 10, ['#9aa3b2', '#d7dde8', '#2a2e38'], 170, 4, 0.4);
          }
          // —— 拖拽中：玩家贴钩尖跟随移动，累计行程满半屏宽度后脱钩 ——
          if (this.hkGrab) {
            const gr = this.hkGrab;
            gr.dist += mSpd;
            const cs = Math.cos(this.hkAngle), sn = Math.sin(this.hkAngle);
            const nx = this.x + cs * gr.ox - sn * gr.oy;
            const ny = this.y + sn * gr.ox + cs * gr.oy;
            const gyD = g.groundYAt ? g.groundYAt(nx) : CFG.GROUND_Y;
            p.x = clamp(nx, 40, CFG.W - 60);
            p.y = clamp(ny, CFG.TOP_Y, gyD - p.radius * 0.5);
            p.vx = 0; p.vy = 0;
            if (gr.dist >= P.hookGrabDist || this.hkPhase === 'retract') {
              p.hookedBy = null;
              this.hkGrab = null;
            }
          }
          // 钩头接触伤害（尚未钩住任何人时才有；钩中瞬间伤害已在上方结算）
          if (!this.hkGrabbed && this.hkPhase !== 'retract' && this.hkCd <= 0 &&
              Math.hypot(p.x - this.x, p.y - this.y) < P.hookW + p.radius * 0.7) {
            if (p.hurt(this.dmg, g, this.src)) this.hkCd = 0.3;
          }
          // 绷直链条伤害（转向弯曲/回收无伤害；已被钩住拖着的玩家不再吃链条伤害）
          const chainHurts = !this.hkGrab &&
            ((this.hkPhase === 'out' && this.hkStraight) || (this.hkPhase === 'fly2' && this.hkStraight));
          if (chainHurts) {
            const cw = P.chainW * 1.5 + p.radius * 0.8;
            for (let i = 0; i < pts.length - 1; i++) {
              const A = pts[i], B = pts[i + 1];
              const vx = B.x - A.x, vy = B.y - A.y;
              const len2 = vx * vx + vy * vy || 1;
              const t = clamp(((p.x - A.x) * vx + (p.y - A.y) * vy) / len2, 0, 1);
              const cx = A.x + vx * t, cy = A.y + vy * t;
              if (Math.hypot(p.x - cx, p.y - cy) < cw) { p.hurt(this.dmg, g, this.src); break; }
            }
          }
        }
      }

      /* —— 鸦伯爵宝石（位移后：彩色拖尾轨迹点 / 触地碎裂；拖尾仅视觉、无伤害） —— */
      if (this.kind === 'gem' && !this.dead) {
        this.gemPts.push({ x: this.x, y: this.y });
        if (this.gemPts.length > 18) this.gemPts.shift();
        if (!this.neutralized) {
          this.glintT -= dt;
          if (this.glintT <= 0) {
            this.glintT = 0.06;
            const C1 = GEM_COLS[this.gemCol];
            g.particles.push(new Particle(
              this.x + rand(-this.r * 0.4, this.r * 0.4), this.y + rand(-this.r * 0.4, this.r * 0.4),
              rand(-26, 26) - this.vx * 0.06, rand(-40, 4) - this.vy * 0.06,
              rand(0.28, 0.55), rand(2, 4.6) * Math.max(0.6, this.r / 30),
              Math.random() < 0.5 ? C1.main : C1.lite));
          }
        }
        // 触地碎裂
        const gyG = g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y;
        if (this.y > gyG - this.r * 0.35) {
          const C2 = GEM_COLS[this.gemCol];
          this.dead = true;
          burst(g, this.x, gyG - 4, 8, [C2.main, C2.lite, '#fff'], 150, 4, 0.35);
        }
      }

      /* ================= 雪巫弹种（位移后：冰晶冰雾拖尾/触地碎散；冰环环带自管伤害） ================= */
      if (this.kind === 'icicle' && !this.dead && !this.neutralized) {
        // 白蓝冰雾拖尾（仅视觉，无伤害）：向上飘散的冷雾微粒
        this.mistT -= dt;
        if (this.mistT <= 0) {
          this.mistT = 0.07;
          for (let i = 0; i < 2; i++) {
            g.particles.push(new Particle(
              this.x + rand(-4, 4), this.y + rand(2, 10),
              -this.vx * 0.12 + rand(-26, 26), rand(-56, -14),
              rand(0.3, 0.62), rand(2, 5),
              Math.random() < 0.5 ? 'rgba(214,238,255,0.8)' : 'rgba(150,205,255,0.6)'));
          }
        }
        // 触地碎散成冰粉
        const gyI = g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y;
        if (this.y > gyI - 4) {
          this.y = gyI - 4;
          this.dead = true;
          burst(g, this.x, gyI - 4, 5, ['#eaf6ff', '#9fd4ff', '#cfe8ff'], 110, 3, 0.3);
        }
      }
      if (this.kind === 'icering' && !this.dead) {
        this.irCd = Math.max(0, this.irCd - dt);
        this.irGrow = Math.min(1, this.irGrow + dt / 0.18);
        if (!this.neutralized) {
          // 环形伤害：仅环带（inner~outer 之间）与玩家圆重叠才受伤——环心安全、环外安全
          const p = g.player;
          const d = Math.hypot(p.x - this.x, p.y - this.y);
          const pr = p.radius * 0.85;
          if (this.irCd <= 0 && d < this.irOuter + pr && d > this.irInner - pr) {
            if (p.hurt(this.dmg, g, this.src)) {
              this.irCd = 0.4;
              burst(g, p.x, p.y, 8, ['#cfeaff', '#7fc4ff', '#ffffff'], 150, 3, 0.35);
            }
          }
        }
      }

      if (this.eb && this.ebTrail > 0 && !this.neutralized) {
        if (!this.ebPts) this.ebPts = [];
        this.ebPts.push({ x: this.x, y: this.y });
        const maxPts = this.ebTrail >= 2 ? 12 : 7;
        if (this.ebPts.length > maxPts) this.ebPts.shift();
      }
      // 怪客红苹果：受重力下坠，触地向上弹起一段距离，二次触地碎裂
      if (this.kind === 'apple' && !this.neutralized && !this.dead) {
        const gy = CFG.GROUND_Y - this.r * 0.7;
        if (this.y >= gy && this.vy >= 0) {
          if (this.bounces < 1) {
            this.bounces = 1;
            this.y = gy;
            this.vy = -430;          // 固定弹起速度，弹起约一段距离后再落下
            this.vx *= 0.45;
            burst(g, this.x, CFG.GROUND_Y - 4, 4, ['#8a5a2b', '#caa06a'], 90, 3, 0.25);
          } else {
            this.dead = true;
            burst(g, this.x, CFG.GROUND_Y - 6, 10, ['#e02b1e', '#7a1208', '#3f9e3a', '#fff5d0'], 150, 4, 0.4);
          }
        }
      }
      // —— 角色专属弹种行为（友方） ——
      if (this.friendly && !this.dead && !this.neutralized) {
        const gy = g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y;
        // 超猫最终激光：屏幕上缘 / 地面反弹（每次反弹速度减半，且反射角大幅偏折）
        if (this.edgeBounce && this.bouncesLeft > 0) {
          const deflect = () => {
            // 反射后速度减半、伤害减半，并随机偏转 ±0.9 rad（≈±51°），反弹角度更夸张
            this.vx *= 0.5; this.vy *= 0.5;
            this.dmg = Math.max(1, Math.round(this.dmg * 0.5));
            const dev = rand(-0.9, 0.9);
            const cs = Math.cos(dev), sn = Math.sin(dev);
            const nvx = this.vx * cs - this.vy * sn;
            const nvy = this.vx * sn + this.vy * cs;
            this.vx = nvx; this.vy = nvy;
            this.angle = Math.atan2(this.vy, this.vx);
          };
          if (this.y < CFG.TOP_Y + this.r && this.vy < 0) {
            this.y = CFG.TOP_Y + this.r;
            this.vy = Math.abs(this.vy); this.bouncesLeft--;
            deflect();
            this.vy = Math.abs(this.vy);            // 强制朝下，避免贴边立即二次反弹
            this.angle = Math.atan2(this.vy, this.vx);
            burst(g, this.x, this.y, 6, ['#35e0ff', '#fff'], 150, 3, 0.3);
          } else if (this.y > gy - this.r && this.vy > 0) {
            this.y = gy - this.r;
            this.vy = -Math.abs(this.vy); this.bouncesLeft--;
            deflect();
            this.vy = -Math.abs(this.vy);           // 强制朝上
            this.angle = Math.atan2(this.vy, this.vx);
            burst(g, this.x, this.y, 6, ['#35e0ff', '#fff'], 150, 3, 0.3);
          }
        }
        // 地面交互：烟头/火把触地震伤地下龙类小段；下落类弹种（飞刀/盾牌）触地消亡
        if (!this.edgeBounce && this.y > gy - this.r * 0.6 && this.vy > 0) {
          if (this.groundSlam) {
            this.groundSlamHit(g, gy);
            this.dead = true;
            burst(g, this.x, gy - 6, 12, ['#ff7b2e', '#ffd23b', '#8a5a2b', '#fff5d0'], 180, 4, 0.45);
          } else if (this.kind === 'knife' || this.kind === 'shieldSaw') {
            this.dead = true;
            burst(g, this.x, gy - 6, 7, ['#dfe6ee', '#8d96a3', '#fff'], 130, 3, 0.32);
          }
        }
      }
      if (this.life <= 0 && !this.dead) {
        if (this.onExpire) this.onExpire(g, this);
        this.dead = true;
      }
      if (this.kind !== 'wshark' && this.kind !== 'wbomb' && this.kind !== 'whook' &&
          (this.x < -80 || this.x > CFG.W + 80 || this.y < -80 || this.y > CFG.H + 80)) {
        if (this.onExpire && (this.kind === 'fireball' || this.kind === 'lava')) this.onExpire(g, this);
        this.dead = true;
      }
    }
    render(ctx) {
      if (this.neutralized) {
        if (this.fade <= 0) return;
        ctx.globalAlpha = this.fade;
        this._renderBody(ctx);
        ctx.globalAlpha = 1;
      } else {
        this._renderBody(ctx);
      }
    }
    /** 飞行弹幕小怪能量弹：纯亮矢量弹体 + 按强度分层的能量光带拖尾 */
    renderEnergy(ctx) {
      const r = this.r, x = this.x, y = this.y, t = this.t;
      const baseAlpha = ctx.globalAlpha;
      const ang = Math.atan2(this.vy, this.vx);
      const TRAIL_COL = { flame: '#ff9a3c', spikeball: '#e6eeff', whiteorb: '#ffffff', diamond: '#c078ff', cone: '#ffd84d' };

      // ── 能量拖尾：沿飞行轨迹的渐细渐隐光带（中强微弱 / 高强清晰）──
      const pts = this.ebPts;
      if (pts && pts.length > 1 && this.ebTrail > 0) {
        const strong = this.ebTrail >= 2;
        const maxW = strong ? r * 1.7 : r * 0.85;
        const maxA = strong ? 0.6 : 0.22;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = TRAIL_COL[this.eb] || '#ffffff';
        for (let i = 1; i < pts.length; i++) {
          const f = i / pts.length;          // 0=尾端 1=弹体端
          ctx.globalAlpha = baseAlpha * maxA * f;
          ctx.lineWidth = Math.max(0.6, maxW * f);
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
        ctx.globalAlpha = baseAlpha;
      }

      switch (this.eb) {
        /* 刺羽鸟：叶片形状绿色（沿飞行方向尖叶 + 亮叶轴） */
        case 'leaf': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
          ctx.shadowColor = 'rgba(64,255,96,0.9)'; ctx.shadowBlur = 9;
          ctx.fillStyle = '#1f9e3a';
          ctx.beginPath(); ctx.moveTo(-r * 1.25, 0);
          ctx.quadraticCurveTo(0, -r * 1.15, r * 1.55, 0);
          ctx.quadraticCurveTo(0, r * 1.15, -r * 1.25, 0); ctx.fill();
          ctx.fillStyle = '#46e067';
          ctx.beginPath(); ctx.moveTo(-r * 0.95, 0);
          ctx.quadraticCurveTo(0, -r * 0.85, r * 1.3, 0);
          ctx.quadraticCurveTo(0, r * 0.85, -r * 0.95, 0); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#eaffef'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 1.15, 0); ctx.stroke();
          ctx.restore();
          break;
        }
        /* 魔眼飞虫：圆形红色眼珠（红虹膜 + 黑瞳孔 + 高光） */
        case 'eyeball': {
          ctx.shadowColor = 'rgba(255,40,40,0.95)'; ctx.shadowBlur = 11;
          ctx.fillStyle = '#7a0d0d';
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ff2424';
          ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ff5a5a';
          ctx.beginPath(); ctx.arc(x, y, r * 0.56, 0, TAU); ctx.fill();
          ctx.fillStyle = '#160000';
          ctx.beginPath(); ctx.arc(x, y, r * 0.34, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(x - r * 0.22, y - r * 0.24, r * 0.17, 0, TAU); ctx.fill();
          break;
        }
        /* 魔石甲虫：火焰圆形（红→橙→金→白芯，跳动膨胀） */
        case 'flame': {
          const f = 1 + Math.sin(t * 16) * 0.12;
          const rr = r * f;
          ctx.shadowColor = 'rgba(255,90,20,0.95)'; ctx.shadowBlur = 12;
          ctx.fillStyle = '#ff3b1e'; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ff7b2e'; ctx.beginPath(); ctx.arc(x, y, rr * 0.78, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffb43b'; ctx.beginPath(); ctx.arc(x, y, rr * 0.52, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd23b'; ctx.beginPath(); ctx.arc(x, y, rr * 0.34, 0, TAU); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#fff7da'; ctx.beginPath(); ctx.arc(x, y, rr * 0.16, 0, TAU); ctx.fill();
          break;
        }
        /* 浮空魔花：高亮尖刺圆（旋转白色尖刺 + 白亮核心） */
        case 'spikeball': {
          ctx.save(); ctx.translate(x, y);
          ctx.shadowColor = 'rgba(235,242,255,0.95)'; ctx.shadowBlur = 12;
          ctx.fillStyle = '#ffffff';
          ctx.save(); ctx.rotate(this.spin * 0.5);
          for (let i = 0; i < 10; i++) {
            const a0 = (TAU / 10) * i;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a0 - 0.13) * r * 0.92, Math.sin(a0 - 0.13) * r * 0.92);
            ctx.lineTo(Math.cos(a0) * r * 1.7, Math.sin(a0) * r * 1.7);
            ctx.lineTo(Math.cos(a0 + 0.13) * r * 0.92, Math.sin(a0 + 0.13) * r * 0.92);
            ctx.closePath(); ctx.fill();
          }
          ctx.restore();
          ctx.fillStyle = '#dce7ff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        }
        /* 风暴飞鱼：高亮白色圆形（冰蓝外晕 → 纯白核心） */
        case 'whiteorb': {
          ctx.shadowColor = 'rgba(190,222,255,0.95)'; ctx.shadowBlur = 15;
          ctx.fillStyle = '#bcd4ff'; ctx.beginPath(); ctx.arc(x, y, r * 1.02, 0, TAU); ctx.fill();
          ctx.fillStyle = '#eef4ff'; ctx.beginPath(); ctx.arc(x, y, r * 0.76, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, TAU); ctx.fill();
          break;
        }
        /* 双头飞蛇：高亮紫色菱形（旋转棱面宝石 + 高光面） */
        case 'diamond': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(this.spin);
          ctx.shadowColor = 'rgba(176,102,255,0.95)'; ctx.shadowBlur = 12;
          ctx.fillStyle = '#5b179e';
          ctx.beginPath(); ctx.moveTo(0, -r * 1.4); ctx.lineTo(r * 1.1, 0); ctx.lineTo(0, r * 1.4); ctx.lineTo(-r * 1.1, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#a855f7';
          ctx.beginPath(); ctx.moveTo(0, -r * 1.08); ctx.lineTo(r * 0.84, 0); ctx.lineTo(0, r * 1.08); ctx.lineTo(-r * 0.84, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#c98bff';
          ctx.beginPath(); ctx.moveTo(0, -r * 1.08); ctx.lineTo(r * 0.84, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#8e3fd6';
          ctx.beginPath(); ctx.moveTo(0, r * 1.08); ctx.lineTo(r * 0.84, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#f2e6ff';
          ctx.beginPath(); ctx.moveTo(0, -r * 1.0); ctx.lineTo(r * 0.3, -r * 0.25); ctx.lineTo(0, -r * 0.12); ctx.lineTo(-r * 0.3, -r * 0.25); ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
        /* 预言猫头鹰：亮黄色锥形（沿飞行方向飞镖锥 + 亮锥尖） */
        case 'cone': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
          ctx.shadowColor = 'rgba(255,200,30,0.95)'; ctx.shadowBlur = 10;
          ctx.fillStyle = '#a97600';
          ctx.beginPath(); ctx.moveTo(r * 1.55, 0); ctx.lineTo(-r * 1.05, -r * 0.98); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r * 1.05, r * 0.98); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffd23b';
          ctx.beginPath(); ctx.moveTo(r * 1.38, 0); ctx.lineTo(-r * 0.88, -r * 0.8); ctx.lineTo(-r * 0.42, 0); ctx.lineTo(-r * 0.88, r * 0.8); ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#fff4c2';
          ctx.beginPath(); ctx.moveTo(r * 1.38, 0); ctx.lineTo(r * 0.28, -r * 0.3); ctx.lineTo(r * 0.28, r * 0.3); ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
        /* 投掷奴：倒刺铁头大标枪（沿飞行方向的长杆 + 铁矛头 + 倒刺 + 尾羽） */
        case 'javelin': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
          // 长杆
          ctx.fillStyle = '#6a4a24'; ctx.fillRect(-r * 2.5, -r * 0.18, r * 2.7, r * 0.36);
          ctx.fillStyle = '#8a6230'; ctx.fillRect(-r * 2.5, -r * 0.18, r * 2.7, r * 0.12);
          // 尾羽
          ctx.fillStyle = '#c83a3a';
          ctx.beginPath(); ctx.moveTo(-r * 2.5, 0); ctx.lineTo(-r * 3.0, -r * 0.5); ctx.lineTo(-r * 2.8, 0); ctx.lineTo(-r * 3.0, r * 0.5); ctx.closePath(); ctx.fill();
          // 铁矛头
          ctx.fillStyle = '#d8dce6';
          ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.lineTo(r * 0.2, -r * 0.42); ctx.lineTo(r * 0.2, r * 0.42); ctx.closePath(); ctx.fill();
          // 倒刺
          ctx.fillStyle = '#9aa0ae';
          ctx.beginPath(); ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 0.12, -r * 0.66); ctx.lineTo(r * 0.8, -r * 0.12); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 0.12, r * 0.66); ctx.lineTo(r * 0.8, r * 0.12); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#2c3140'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.lineTo(r * 0.2, -r * 0.42); ctx.lineTo(r * 0.2, r * 0.42); ctx.closePath(); ctx.stroke();
          ctx.restore();
          break;
        }
        /* 盾奴：大号青铜塔盾（翻滚抛射，矩形盾 + 盾脐 + 铆钉） */
        case 'shield': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(this.spin);
          const w = r * 1.7, h = r * 2.1;
          ctx.shadowColor = 'rgba(255,180,60,0.55)'; ctx.shadowBlur = 9;
          ctx.fillStyle = '#5a3e12'; ctx.fillRect(-w / 2, -h / 2, w, h);              // 深色边框
          ctx.fillStyle = '#c89036'; ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); // 青铜盾面
          ctx.fillStyle = '#e8b25a'; ctx.fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, 4);   // 顶部高光
          ctx.fillStyle = '#8a5e20'; ctx.fillRect(-w / 2 + 6, h / 2 - 10, w - 12, 4);   // 底部暗部
          // 盾脐
          ctx.fillStyle = '#e8b25a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, TAU); ctx.fill();
          ctx.fillStyle = '#7a5218'; ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, TAU); ctx.fill();
          // 铆钉
          ctx.fillStyle = '#5a3e12';
          ctx.beginPath(); ctx.arc(-w * 0.28, -h * 0.32, 2.4, 0, TAU); ctx.arc(w * 0.28, -h * 0.32, 2.4, 0, TAU);
          ctx.arc(-w * 0.28, h * 0.32, 2.4, 0, TAU); ctx.arc(w * 0.28, h * 0.32, 2.4, 0, TAU); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
          break;
        }
        /* 皮影客：竖直上投的飞刀（尖刃 + 短柄，沿飞行方向），加大刃身 + 白色拖尾 */
        case 'dart': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
          // 白色拖尾：沿来向（-x）4 段渐细渐隐光带
          for (let i = 1; i <= 4; i++) {
            const k = i / 4;
            ctx.globalAlpha = 0.4 * (1 - k);
            ctx.fillStyle = '#ffffff';
            const tl = r * (1.0 + i * 1.25);
            const tw = r * 0.34 * (1 - k * 0.55);
            ctx.beginPath();
            ctx.moveTo(-r * 0.25, -tw);
            ctx.lineTo(-r * 0.25 - tl, 0);
            ctx.lineTo(-r * 0.25, tw);
            ctx.closePath(); ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.scale(1.4, 1.4);   // 刃身整体放大 1.4 倍
          ctx.fillStyle = '#e8ecf4';
          ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r * 0.5, -r * 0.36); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.5, r * 0.36); ctx.closePath(); ctx.fill();
          // 刃面白色高光芯
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(r * 1.1, 0); ctx.lineTo(-r * 0.2, -r * 0.12); ctx.lineTo(-r * 0.05, 0); ctx.lineTo(-r * 0.2, r * 0.12); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#5a6070'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r * 0.5, -r * 0.36); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r * 0.5, r * 0.36); ctx.stroke();
          ctx.fillStyle = '#6a4a24'; ctx.fillRect(-r * 1.0, -r * 0.13, r * 0.55, r * 0.26);  // 短柄
          ctx.restore();
          break;
        }
      }
      ctx.globalAlpha = baseAlpha;
    }
    _renderBody(ctx) {
      const k = this.kind;
      /* —— 飞行弹幕小怪能量弹（纯亮矢量弹体 + 能量光带拖尾） —— */
      if (this.eb) { this.renderEnergy(ctx); return; }
      /* ================= 鸦伯爵宝石渲染（菱形彩色宝石 + 内部高亮切面 + 彩色长拖尾） ================= */
      if (k === 'gem') {
        const C = GEM_COLS[this.gemCol];
        const baseAlpha = ctx.globalAlpha;
        // 彩色长拖尾（无伤害）：沿轨迹渐细渐隐光带
        const pts = this.gemPts;
        if (pts && pts.length > 2) {
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (let i = 1; i < pts.length; i++) {
            const f = i / pts.length;          // 0=尾端 1=弹体端
            ctx.globalAlpha = baseAlpha * 0.42 * f * this.fade;
            ctx.strokeStyle = C.main;
            ctx.lineWidth = Math.max(1.5, this.r * 0.55 * f);
            ctx.beginPath();
            ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
            ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke();
          }
          ctx.globalAlpha = baseAlpha;
        }
        const R = this.r;
        const base = baseAlpha * this.fade;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spin * 0.4);           // 缓慢翻滚的宝石切面感
        ctx.globalAlpha = base;
        // 外发光
        ctx.shadowColor = C.main; ctx.shadowBlur = 8 + R * 0.18;
        // 菱形本体（纵向长菱形）
        ctx.fillStyle = C.main;
        ctx.beginPath();
        ctx.moveTo(0, -R * 1.3); ctx.lineTo(R * 0.8, 0); ctx.lineTo(0, R * 1.3); ctx.lineTo(-R * 0.8, 0);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        // 左下暗切面
        ctx.fillStyle = C.dark;
        ctx.beginPath();
        ctx.moveTo(0, -R * 1.3); ctx.lineTo(0, R * 1.3); ctx.lineTo(-R * 0.8, 0);
        ctx.closePath(); ctx.fill();
        // 右上亮切面
        ctx.fillStyle = C.lite;
        ctx.beginPath();
        ctx.moveTo(0, -R * 1.3); ctx.lineTo(R * 0.8, 0); ctx.lineTo(0, 0);
        ctx.closePath(); ctx.fill();
        // 内部切面横纹
        ctx.strokeStyle = C.lite; ctx.lineWidth = Math.max(1, R * 0.07);
        ctx.beginPath();
        ctx.moveTo(-R * 0.42, -R * 0.38); ctx.lineTo(R * 0.42, -R * 0.38);
        ctx.moveTo(-R * 0.42, R * 0.38); ctx.lineTo(R * 0.42, R * 0.38);
        ctx.stroke();
        // 白色高光星芒
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-R * 0.1, -R * 0.66); ctx.lineTo(R * 0.06, -R * 0.42); ctx.lineTo(-R * 0.1, -R * 0.3); ctx.lineTo(-R * 0.28, -R * 0.46);
        ctx.closePath(); ctx.fill();
        // 回旋宝石急停期：白色脉冲圈（提示即将折返）
        if (this.gemMode === 'ret' && this.gPhase === 'pause') {
          const k2 = Math.min(1, this.gT / Math.max(0.001, this.pauseT));
          ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k2)})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, 0, R * 1.5 + R * 0.9 * k2, 0, TAU); ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = baseAlpha;
        return;
      }
      /* ================= 深海恶霸弹种渲染 ================= */
      if (k === 'wshark') {
        // 追踪水鲨：半透明蓝灰水体，头部/背鳍/胸鳍/尾鳍轮廓清晰，身体与尾巴持续摆动
        const wag = Math.sin(this.swim * 11);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.scale(0.55, 0.55);   // 体型≈角色高度 35%（身长约 38px）
        // 尾鳍（V 形叉尾，随摆动左右甩）
        ctx.fillStyle = 'rgba(110,150,184,0.8)';
        ctx.strokeStyle = 'rgba(38,66,96,0.9)'; ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-24, 0);
        ctx.quadraticCurveTo(-36, -13 + wag * 5, -40, -19 + wag * 6);
        ctx.quadraticCurveTo(-31, -2, -40, 17 + wag * 6);
        ctx.quadraticCurveTo(-34, 11 + wag * 4, -24, 0);
        ctx.fill(); ctx.stroke();
        // 身体（纺锤形水体）
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.quadraticCurveTo(18, -15, -10, -12);
        ctx.quadraticCurveTo(-26, -8, -26, 0);
        ctx.quadraticCurveTo(-26, 8, -10, 12);
        ctx.quadraticCurveTo(18, 15, 30, 0);
        ctx.fillStyle = 'rgba(122,158,190,0.82)'; ctx.fill(); ctx.stroke();
        // 腹部亮色水光
        ctx.fillStyle = 'rgba(206,232,250,0.5)';
        ctx.beginPath();
        ctx.moveTo(24, 2);
        ctx.quadraticCurveTo(8, 11, -12, 9);
        ctx.quadraticCurveTo(0, 5, 24, 2); ctx.fill();
        // 背鳍
        ctx.fillStyle = 'rgba(96,136,170,0.85)';
        ctx.beginPath(); ctx.moveTo(6, -12);
        ctx.quadraticCurveTo(2, -26 - wag * 3, -6, -12); ctx.fill(); ctx.stroke();
        // 胸鳍（随身体摆动）
        ctx.beginPath(); ctx.moveTo(2, 8);
        ctx.quadraticCurveTo(-10, 18 + wag * 5, -16, 14 + wag * 6);
        ctx.quadraticCurveTo(-6, 10, 2, 8); ctx.fill(); ctx.stroke();
        // 鳃线 + 眼睛
        ctx.strokeStyle = 'rgba(38,66,96,0.75)'; ctx.lineWidth = 1.3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.moveTo(12 - i * 5, -7);
          ctx.quadraticCurveTo(10 - i * 5, 0, 13 - i * 5, 7); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(20,36,54,0.95)';
        ctx.beginPath(); ctx.arc(20, -4, 2.6, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(21, -5, 1, 0, TAU); ctx.fill();
        // 水体高光
        ctx.strokeStyle = 'rgba(236,248,255,0.55)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(26, -3); ctx.quadraticCurveTo(10, -11, -8, -8); ctx.stroke();
        ctx.restore();
        return;
      }
      if (k === 'wbomb') {
        const P = CFG.seaBully;
        if (this.exT < 0) {
          // 黑色圆铁壳炸弹（比角色还大）：金属铆钉 + 短引线
          const R = 34;
          ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin * 0.25);
          const grd = ctx.createRadialGradient(-9, -11, 3, 0, 0, R + 5);
          grd.addColorStop(0, '#5a5e6b'); grd.addColorStop(0.55, '#2c2e37'); grd.addColorStop(1, '#101117');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#06070a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
          ctx.fillStyle = '#767c8c';
          for (let i = 0; i < 8; i++) {
            const a = i * TAU / 8;
            ctx.beginPath(); ctx.arc(Math.cos(a) * (R - 11), Math.sin(a) * (R - 11), 3.2, 0, TAU); ctx.fill();
          }
          // 顶部引信座
          ctx.fillStyle = '#1a1c23';
          ctx.fillRect(-7, -R - 4, 14, 8);
          ctx.restore();
          // 短引线（不随弹体旋转）+ 引线火花
          ctx.strokeStyle = '#9a743f'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(this.x, this.y - R - 2);
          ctx.quadraticCurveTo(this.x + 11, this.y - R - 14, this.x + 20, this.y - R - 9); ctx.stroke();
          const fl = 1 + Math.sin(this.t * 30) * 0.35;
          ctx.fillStyle = 'rgba(255,180,60,0.95)';
          ctx.beginPath(); ctx.arc(this.x + 20, this.y - R - 9, 4.4 * fl, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,240,180,0.9)';
          ctx.beginPath(); ctx.arc(this.x + 20, this.y - R - 9, 2 * fl, 0, TAU); ctx.fill();
        } else {
          // 爆炸：外围橙红火球 + 深红黑芯
          const dur = this.enr ? P.ringDurEnr : P.ringDur;
          const tot = P.ringDelay[2] + dur + 0.16;
          const fade = clamp(1 - Math.max(0, this.exT - (tot - 0.28)) / 0.28, 0, 1);
          const grow = Math.min(1, this.exT / 0.18);
          const og = 1 - Math.pow(1 - grow, 3);
          const og2 = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, P.coreR * 1.5 * og + 6);
          og2.addColorStop(0, 'rgba(255,236,170,' + 0.95 * fade + ')');
          og2.addColorStop(0.35, 'rgba(255,106,26,' + 0.85 * fade + ')');
          og2.addColorStop(0.7, 'rgba(198,47,20,' + 0.55 * fade + ')');
          og2.addColorStop(1, 'rgba(120,10,4,0)');
          ctx.fillStyle = og2;
          ctx.beginPath(); ctx.arc(this.x, this.y, P.coreR * 1.5 * og + 6, 0, TAU); ctx.fill();
          // 深红 + 黑色中心
          const ck = Math.max(0, 1 - this.exT / 0.5);
          ctx.fillStyle = 'rgba(26,5,5,' + (0.5 + 0.5 * ck) * fade + ')';
          ctx.beginPath(); ctx.arc(this.x, this.y, P.coreR * 0.62 * og + 3, 0, TAU); ctx.fill();
          // 三道深色环形冲击波：依次向外扩大，间隔很短
          ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const rt = this.exT - P.ringDelay[i];
            if (rt < 0) continue;
            const kk = Math.min(1, rt / dur);
            const ee = 1 - Math.pow(1 - kk, 3);
            const rr = ee * P.ringMax[i];
            const a2 = (kk < 0.7 ? 1 : (1 - kk) / 0.3) * 0.92 * fade;
            ctx.strokeStyle = 'rgba(16,7,10,' + a2 + ')';
            ctx.lineWidth = P.ringBand * 0.9;
            ctx.beginPath(); ctx.arc(this.x, this.y, rr, 0, TAU); ctx.stroke();
          }
        }
        return;
      }
      if (k === 'whook') {
        // 巨型铁钩 + 粗重铁链（链节清晰）
        const P = CFG.seaBully;
        const pts = this.hkPts;
        if (pts) {
          ctx.lineCap = 'round';
          for (let i = pts.length - 1; i > 0; i--) {
            const A = pts[i], B = pts[i - 1];
            const a = Math.atan2(B.y - A.y, B.x - A.x);
            const d = Math.hypot(B.x - A.x, B.y - A.y);
            ctx.save();
            ctx.translate((A.x + B.x) / 2, (A.y + B.y) / 2);
            ctx.rotate(a + (i % 2 === 0 ? Math.PI / 2 : 0));   // 链节横竖交替
            ctx.strokeStyle = '#0c0e13'; ctx.lineWidth = 5.2;
            ctx.beginPath(); ctx.ellipse(0, 0, Math.min(8.2, d * 0.7), 4.4, 0, 0, TAU); ctx.stroke();
            ctx.strokeStyle = '#6e7685'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.ellipse(0, -0.7, Math.min(7.6, d * 0.62), 3.3, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
            ctx.restore();
          }
        }
        // 钩中玩家：钩尖与玩家之间补几节短链（绑定拖拽视觉）
        if (this.hkGrab && this.hkGrab.p) {
          const pp = this.hkGrab.p;
          const dx = pp.x - this.x, dy = pp.y - this.y;
          const dd = Math.hypot(dx, dy) || 1;
          const la = Math.atan2(dy, dx);
          ctx.lineCap = 'round';
          for (let i = 1; i <= 3; i++) {
            const t = i / 4;
            ctx.save();
            ctx.translate(this.x + dx * t, this.y + dy * t);
            ctx.rotate(la + (i % 2 === 0 ? Math.PI / 2 : 0));
            ctx.strokeStyle = '#0c0e13'; ctx.lineWidth = 5.2;
            ctx.beginPath(); ctx.ellipse(0, 0, Math.min(8.2, dd * 0.2), 4.4, 0, 0, TAU); ctx.stroke();
            ctx.strokeStyle = '#6e7685'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.ellipse(0, -0.7, Math.min(7.6, dd * 0.17), 3.3, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
            ctx.restore();
          }
        }
        // 钩头：宽大厚重的黑色金属单钩，边缘灰白高光（整体放大 hookScale，比角色还大）
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.hkAngle);
        ctx.scale(P.hookScale, P.hookScale);
        ctx.strokeStyle = '#0a0c11'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-16, 0);                       // 钩柄
        ctx.arc(-16, 10, 10, -Math.PI / 2, Math.PI / 2, false);     // 钩身圆弧
        ctx.stroke();
        ctx.strokeStyle = '#232833'; ctx.lineWidth = 8.5;
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-16, 0);
        ctx.arc(-16, 10, 10, -Math.PI / 2, Math.PI / 2, false);
        ctx.stroke();
        // 钩尖
        ctx.fillStyle = '#c9d0dc';
        ctx.beginPath(); ctx.moveTo(-16, 20); ctx.lineTo(-12, 14); ctx.lineTo(-20, 15); ctx.fill();
        // 灰白边缘高光
        ctx.strokeStyle = 'rgba(196,204,218,0.85)'; ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(12, -4.4); ctx.lineTo(-16, -4.4);
        ctx.arc(-20.4, 10, 5.6, -Math.PI / 2, -Math.PI * 0.05, false);
        ctx.stroke();
        // 钩柄连接处环箍
        ctx.fillStyle = '#0c0e13';
        ctx.fillRect(8, -6, 6, 12);
        ctx.fillStyle = '#8b93a3';
        ctx.fillRect(9, -5, 1.6, 10);
        ctx.restore();
        return;
      }
      /* ================= 雪巫弹种渲染 ================= */
      if (k === 'icicle') {
        // 蓝白六角冰晶：棱形柱晶尖端朝下，随斜落方向轻微倾斜（始终近垂直）
        const tilt = clamp(this.vx / Math.max(1, this.vy), -0.7, 0.7) * 0.55;
        const w = this.r * 0.95, L = this.r * 1.8;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(tilt);
        ctx.shadowColor = 'rgba(120,200,255,0.9)'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#bfe4ff';
        ctx.strokeStyle = '#2b7fc4'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, L);                 // 下尖端
        ctx.lineTo(w, L * 0.3);
        ctx.lineTo(w * 0.82, -L * 0.55);
        ctx.lineTo(0, -L * 0.84);        // 上尖端
        ctx.lineTo(-w * 0.82, -L * 0.55);
        ctx.lineTo(-w, L * 0.3);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        // 内部棱面（白蓝高光）
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(0, L * 0.72);
        ctx.lineTo(w * 0.42, L * 0.2);
        ctx.lineTo(w * 0.3, -L * 0.4);
        ctx.lineTo(0, -L * 0.62);
        ctx.lineTo(-w * 0.3, -L * 0.4);
        ctx.lineTo(-w * 0.42, L * 0.2);
        ctx.closePath(); ctx.fill();
        // 中央亮轴
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -L * 0.72); ctx.lineTo(0, L * 0.84); ctx.stroke();
        ctx.restore();
        return;
      }
      if (k === 'icering') {
        // 蓝白透明冰环：外圈厚环带 + 旋转冰刺，环心通透安全（中心仅极淡雪花提示）
        const grow = 1 - Math.pow(1 - this.irGrow, 3);
        const pulse = 0.97 + 0.03 * Math.sin(this.t * 6);
        const oR = this.irOuter * grow * pulse;
        const iR = this.irInner * grow;
        const big = this.irOuter > 50;
        ctx.save(); ctx.translate(this.x, this.y);
        // 极淡冰雾填充（环心与环带同色但极浅，几乎不遮挡）
        ctx.fillStyle = 'rgba(160,215,255,0.05)';
        ctx.beginPath(); ctx.arc(0, 0, oR, 0, TAU); ctx.fill();
        // 外圈冰刺（缓慢自转）
        const n = big ? 14 : 10;
        ctx.save(); ctx.rotate(this.t * 0.9);
        ctx.fillStyle = 'rgba(224,243,255,0.92)';
        ctx.strokeStyle = 'rgba(80,150,220,0.85)'; ctx.lineWidth = 1;
        for (let i = 0; i < n; i++) {
          const a = TAU / n * i;
          const ca = Math.cos(a), sa = Math.sin(a);
          ctx.beginPath();
          ctx.moveTo(ca * (oR - 3), sa * (oR - 3));
          ctx.lineTo(ca * (oR + 9), sa * (oR + 9));
          ctx.lineTo(Math.cos(a + TAU / n * 0.32) * (oR - 3), Math.sin(a + TAU / n * 0.32) * (oR - 3));
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
        // 厚环带（透明冰体）
        ctx.beginPath();
        ctx.arc(0, 0, oR, 0, TAU);
        ctx.arc(0, 0, iR, 0, TAU, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(150,205,255,0.26)';
        ctx.fill('evenodd');
        // 外/内缘描边（外圈厚亮）
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(228,245,255,0.95)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, oR, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(120,185,240,0.85)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, iR, 0, TAU); ctx.stroke();
        // 环带上的冰结晶刻面（亮点随自转缓移）
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 6; i++) {
          const a = this.t * 0.5 + i * TAU / 6;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * (oR - 5), Math.sin(a) * (oR - 5), 1.7, 0, TAU); ctx.fill();
        }
        // 环心：极淡六出雪花（安全区提示，不挡视野）
        ctx.strokeStyle = 'rgba(220,240,255,0.22)'; ctx.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) {
          const a = this.t * 0.9 + i * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(-Math.cos(a) * iR * 0.4, -Math.sin(a) * iR * 0.4);
          ctx.lineTo(Math.cos(a) * iR * 0.4, Math.sin(a) * iR * 0.4);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
      /* —— 角色专属弹种渲染 —— */
      if (k === 'knife' && this.friendly) {
        // 侠客飞刀：4 阶成长（小刀→匕首→宽刃→翠绿大剑），剑尖朝飞行方向
        const a = Math.atan2(this.vy, this.vx);
        const lv = this.glv, big = 1 + lv * 0.28;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        if (this.gmax) {
          // 最终形态：翠绿大剑（金柄 + 翠绿剑身 + 白芯），整体缩至第 3 阶飞刀大小
          ctx.scale(0.68, 0.68);
          ctx.fillStyle = '#0d2818'; ctx.fillRect(-34, -7, 62, 14);
          ctx.fillStyle = '#1e6fd0'; ctx.fillRect(-32, -4.5, 12, 9);          // 蓝宝石柄
          ctx.fillStyle = '#14532d'; ctx.fillRect(-22, -11, 7, 22);           // 护手
          ctx.fillStyle = '#0f4d2a'; ctx.fillRect(-15, -5, 44, 10);
          ctx.fillStyle = '#2fb37c'; ctx.fillRect(-14, -3.5, 42, 7);
          ctx.fillStyle = '#7ed46d'; ctx.fillRect(-12, -1.5, 38, 3);
          ctx.fillStyle = '#eafff2'; ctx.fillRect(18, -1, 9, 2);              // 剑尖亮刃
        } else {
          ctx.fillStyle = '#101018'; ctx.fillRect(-14 * big, -3.4 * big, 24 * big, 6.8 * big);
          ctx.fillStyle = lv >= 2 ? '#35d08a' : '#dfe6ee';                     // 3 阶起刃染翠绿
          ctx.fillRect(-13 * big, -1.8 * big, 20 * big, 3.6 * big);
          ctx.fillStyle = '#101018'; ctx.fillRect(-14 * big, -5.2 * big, 6 * big, 10.4 * big);
          ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-13 * big, -3.6 * big, 4.6 * big, 7.2 * big);
          if (lv >= 1) { ctx.fillStyle = '#ffd23b'; ctx.fillRect(-8.5 * big, -4.6 * big, 2, 9.2 * big); }   // 2 阶金环
        }
        ctx.restore();
        return;
      }
      if (k === 'star') {
        // 法师星星：金色五角星持续自转；最终形态彩虹大星（多彩光环）
        const r = this.r * (1 + Math.sin(this.t * 8) * 0.08);
        if (this.gmax) {
          const hue = (this.t * 140) % 360;
          ctx.fillStyle = `hsla(${hue},90%,65%,0.16)`;
          ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.4, 0, TAU); ctx.fill();
        }
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a1 = -Math.PI / 2 + (TAU / 5) * i, a2 = a1 + TAU / 10;
          ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
          ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
        }
        ctx.closePath();
        if (this.whiteStar) {
          // 纯白色五角星（法师护盾碎星）
          ctx.fillStyle = '#ffffff';
          ctx.lineWidth = 3; ctx.strokeStyle = '#e8f0ff'; ctx.stroke(); ctx.fill();
          ctx.fillStyle = '#f0f6ff';
        } else {
          ctx.fillStyle = '#fff9c4';                          // 边缘：高明度发白的柠檬黄
          ctx.lineWidth = 3; ctx.strokeStyle = '#fff9c4'; ctx.stroke(); ctx.fill();
          ctx.fillStyle = this.gmax ? '#ffe066' : '#ffd93b';
        }
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a1 = -Math.PI / 2 + (TAU / 5) * i, a2 = a1 + TAU / 10;
          ctx.lineTo(Math.cos(a1) * (r - 1.5), Math.sin(a1) * (r - 1.5));
          ctx.lineTo(Math.cos(a2) * (r - 1.5) * 0.45, Math.sin(a2) * (r - 1.5) * 0.45);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.2, r * 0.16, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'soul' && this.friendly) {
        // 魅影幽魂弹：朝飞行方向的鬼脸鬼火（鬼火尾焰 + 双眼 + 口）；最终形态幽冥鬼王（鬼角 + 强辉光）
        const a = Math.atan2(this.vy, this.vx);
        const r = this.r * (1 + Math.sin(this.t * 10) * 0.08);
        const gmax = this.gmax;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(a);
        ctx.shadowColor = 'rgba(168,116,255,0.9)';
        ctx.shadowBlur = gmax ? 16 : 10;
        // 鬼火尾焰（身后，随帧伸缩）
        const flick = 1 + Math.sin(this.t * 18) * 0.15;
        ctx.fillStyle = gmax ? '#c39bff' : '#8b55e0';
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 0.72);
        ctx.quadraticCurveTo(-r * 2.1 * flick, 0, -r * 0.4, r * 0.72);
        ctx.closePath(); ctx.fill();
        // 鬼火尾尖品红
        ctx.fillStyle = 'rgba(255,123,213,0.75)';
        ctx.beginPath();
        ctx.moveTo(-r * 1.2 * flick, -r * 0.3);
        ctx.quadraticCurveTo(-r * 2.0 * flick, 0, -r * 1.2 * flick, r * 0.3);
        ctx.closePath(); ctx.fill();
        // 幽魂头
        ctx.fillStyle = gmax ? '#b57bff' : '#6d3fd0';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = gmax ? '#d8c2ff' : '#b79af0';
        ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.12, r * 0.6, 0, TAU); ctx.fill();
        // 鬼脸：双眼 + 嘴
        ctx.fillStyle = '#1a0b33';
        ctx.fillRect(r * 0.02, -r * 0.36, r * 0.26, r * 0.36);
        ctx.fillRect(r * 0.4, -r * 0.3, r * 0.26, r * 0.36);
        ctx.fillRect(r * 0.28, r * 0.16, r * 0.16, r * 0.22);
        // 最终形态：幽冥鬼王双鬼角
        if (gmax) {
          ctx.fillStyle = '#e9d5ff';
          ctx.beginPath();
          ctx.moveTo(-r * 0.25, -r * 0.85); ctx.lineTo(-r * 0.05, -r * 0.85); ctx.lineTo(-r * 0.12, -r * 1.35);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(r * 0.3, -r * 0.85); ctx.lineTo(r * 0.5, -r * 0.85); ctx.lineTo(r * 0.42, -r * 1.3);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        return;
      }
      if (k === 'butt') {
        // 浪客烟头：白身橙红燃头；最终形态烈焰火把（木柄 + 大火苗）
        const a = Math.atan2(this.vy, this.vx);
        const big = 1 + this.glv * 0.22;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        if (this.gmax) {
          // 烈焰火把：整体缩至第 3 阶烟头大小，火苗轮廓更清晰
          ctx.scale(0.78, 0.78);
          ctx.fillStyle = '#5a3416'; ctx.fillRect(-16, -3.5, 22, 7);          // 木柄
          ctx.fillStyle = '#7a4a1e'; ctx.fillRect(-15, -2, 20, 2);
          const fl = 1 + Math.sin(this.t * 22) * 0.3;
          ctx.fillStyle = '#c94a1e';
          ctx.beginPath(); ctx.ellipse(11, 0, 9 * fl, 7 * fl, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ff7b2e';
          ctx.beginPath(); ctx.ellipse(12, 0, 6.5 * fl, 5 * fl, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd23b';
          ctx.beginPath(); ctx.ellipse(13, 0, 4 * fl, 3 * fl, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fff5d0';
          ctx.beginPath(); ctx.ellipse(14, 0, 1.8, 1.4, 0, 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = '#101018'; ctx.fillRect(-11 * big, -3 * big, 18 * big, 6 * big);
          ctx.fillStyle = '#f7f3e8'; ctx.fillRect(-10 * big, -2.2 * big, 16 * big, 4.4 * big);
          ctx.fillStyle = '#e07b2a'; ctx.fillRect(4 * big, -2.2 * big, 3 * big, 4.4 * big);   // 过滤嘴
          const fl = 1 + Math.sin(this.t * 24) * 0.35;
          ctx.fillStyle = '#ff5a1a';
          ctx.beginPath(); ctx.arc(-10.5 * big, 0, 3.6 * big * fl, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd23b';
          ctx.beginPath(); ctx.arc(-10.5 * big, 0, 1.8 * big * fl, 0, TAU); ctx.fill();
        }
        ctx.restore();
        return;
      }
      if (k === 'shieldSaw') {
        // 战狂锯齿盾牌：灰甲圆盾锯齿旋转；最终形态巨大战斧（双刃斧头旋转劈飞）
        const big = 1 + this.glv * 0.2;
        if (this.gmax) {
          ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
          ctx.scale(0.6, 0.6);   // 战斧缩至第 3 阶锯齿盾大小，双刃轮廓保持清晰
          ctx.fillStyle = '#101018'; ctx.fillRect(-26, -4, 52, 8);            // 斧柄
          ctx.fillStyle = '#5a3416'; ctx.fillRect(-24, -2.4, 48, 4.8);
          for (const s of [-1, 1]) {                                           // 双刃
            ctx.fillStyle = '#101018';
            ctx.beginPath(); ctx.moveTo(s * 14, -4); ctx.quadraticCurveTo(s * 34, -16, s * 30, 0);
            ctx.quadraticCurveTo(s * 34, 16, s * 14, 4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#b8c2cc';
            ctx.beginPath(); ctx.moveTo(s * 14, -3); ctx.quadraticCurveTo(s * 31, -13, s * 27.5, 0);
            ctx.quadraticCurveTo(s * 31, 13, s * 14, 3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#eef3f8';
            ctx.beginPath(); ctx.moveTo(s * 26, -6); ctx.quadraticCurveTo(s * 29, 0, s * 26, 6);
            ctx.quadraticCurveTo(s * 27.4, 0, s * 26, -6); ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = '#ffd23b'; ctx.fillRect(-4, -4, 8, 8);               // 中心铆钉
          ctx.restore();
        } else {
          const r = this.r * big;
          ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
          ctx.fillStyle = '#101018';
          ctx.beginPath();                                                     // 锯齿外圈
          for (let i = 0; i < 12; i++) {
            const a1 = (TAU / 12) * i, a2 = a1 + TAU / 24;
            ctx.lineTo(Math.cos(a1) * r * 1.2, Math.sin(a1) * r * 1.2);
            ctx.lineTo(Math.cos(a2) * r * 0.92, Math.sin(a2) * r * 0.92);
          }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#8d96a3';
          ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU); ctx.fill();
          ctx.fillStyle = '#b8c2cc';
          ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.fill();
          ctx.fillStyle = '#e0453a';
          ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd23b';
          ctx.beginPath(); ctx.arc(0, 0, r * 0.13, 0, TAU); ctx.fill();
          ctx.restore();
        }
        return;
      }
      if (k === 'lblock') {
        // 超猫矩形激光块（玫红）：玫红发光矩形沿飞行方向；最终形态长至屏右的粗激光束
        const a = this.angle !== undefined ? this.angle : Math.atan2(this.vy, this.vx);
        const pulse = 1 + Math.sin(this.t * 30) * 0.14;
        if (this.gmax && this.len > 0) {
          ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
          const L = this.len, Wd = this.r * 1.7 * pulse;
          ctx.fillStyle = 'rgba(255,46,136,0.08)'; ctx.fillRect(-10, -Wd * 0.7, L + 20, Wd * 1.4);   // 外光晕（更细更透，多弹道叠加不糊）
          ctx.fillStyle = 'rgba(255,46,136,0.20)'; ctx.fillRect(-6, -Wd * 0.48, L + 12, Wd * 0.96);
          ctx.fillStyle = '#ff2e88'; ctx.fillRect(0, -Wd * 0.3, L, Wd * 0.6);
          ctx.fillStyle = '#ffa3cf'; ctx.fillRect(0, -Wd * 0.16, L, Wd * 0.32);
          ctx.fillStyle = '#fff'; ctx.fillRect(0, -Wd * 0.08, L, Wd * 0.16);                          // 中心实白芯贯通整条激光
          ctx.restore();
          return;
        }
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        const L = (this.len || this.r * 3.2), Wd = this.r * 1.5 * pulse;
        ctx.fillStyle = 'rgba(255,46,136,0.28)'; ctx.fillRect(-L / 2 - 3, -Wd * 0.85 - 3, L + 6, Wd * 1.7 + 6);
        ctx.fillStyle = '#7a0e3c'; ctx.fillRect(-L / 2, -Wd * 0.6, L, Wd * 1.2);
        ctx.fillStyle = '#ff2e88'; ctx.fillRect(-L / 2 + 1, -Wd * 0.42, L - 2, Wd * 0.84);
        ctx.fillStyle = '#ffd0e6'; ctx.fillRect(-L / 2 + 2, -Wd * 0.14, L - 4, Wd * 0.28);
        ctx.restore();
        return;
      }
      if (k === 'ultlaser') {
        // 超猫大招五重激光：玫红粗光束 + 强光晕 + 前端亮头 + 明显长拖尾缎带
        const a = Math.atan2(this.vy, this.vx);
        const pulse = 1 + Math.sin(this.t * 26) * 0.16;
        // 玫红光带缎带：沿飞行轨迹的三层渐细渐隐拖尾（外玫红晕 / 中亮粉 / 内白芯）
        const pts = this.ultPts;
        if (pts && pts.length > 1) {
          const layers = [
            { rgb: '255,46,136', w: this.r * 1.9, amax: 0.30 },
            { rgb: '255,111,176', w: this.r * 1.05, amax: 0.45 },
            { rgb: '255,224,239', w: this.r * 0.42, amax: 0.62 }
          ];
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (const L of layers) {
            for (let i = 1; i < pts.length; i++) {
              const kk = i / pts.length;
              ctx.strokeStyle = 'rgba(' + L.rgb + ',' + (L.amax * kk).toFixed(3) + ')';
              ctx.lineWidth = L.w * kk;
              ctx.beginPath();
              ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
              ctx.lineTo(pts[i].x, pts[i].y);
              ctx.stroke();
            }
          }
        }
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        const Wd = this.r * 2 * pulse;
        ctx.fillStyle = 'rgba(255,46,136,0.28)'; ctx.fillRect(-46, -Wd, 52, Wd * 2);
        ctx.fillStyle = '#ff2e88'; ctx.fillRect(-34, -Wd * 0.6, 40, Wd * 1.2);
        ctx.fillStyle = '#ffb0d4'; ctx.fillRect(-34, -Wd * 0.28, 40, Wd * 0.56);
        ctx.fillStyle = '#fff'; ctx.fillRect(4, -Wd * 0.4, 8, Wd * 0.8);
        ctx.restore();
        return;
      }
      if (k === 'bolt' || k.startsWith('bolt')) {
        const st = BULLET_STYLE['bolt' + this.tier] || BULLET_STYLE.bolt0;
        // 按 this.r 缩放（BossMan 电击弹 r=13 → 放大），tier 样式为基础尺寸
        const scale = Math.max(1, this.r / st.r);
        const br = st.r * scale;
        const bl = st.len * scale;
        const a = Math.atan2(this.vy, this.vx);
        ctx.save();
        ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.shadowColor = st.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = st.edge;
        ctx.fillRect(-bl / 2 - 2, -br * 0.7, bl + 4, br * 1.4);
        ctx.fillStyle = st.color;
        ctx.fillRect(-bl / 2, -br * 0.45, bl, br * 0.9);
        ctx.fillStyle = '#fff';
        ctx.fillRect(bl / 2 - 4, -br * 0.25, 4, br * 0.5);
        ctx.restore();
        return;
      }
      if (k === 'bloodSpike') {
        // 战狂血怒铠甲反弹尖刺：长菱形（沿飞行方向拉长），血色；拖尾由 trailCols 提供
        const r = this.r;
        const ang = Math.atan2(this.vy, this.vx);
        const len = r * 2.6;    // 长半轴（沿飞行方向）
        const wid = r * 0.85;   // 短半轴（垂直方向）
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(ang);
        // 外层暗红光晕
        ctx.fillStyle = 'rgba(122,10,10,0.55)';
        ctx.beginPath();
        ctx.moveTo(len * 1.25, 0);
        ctx.lineTo(0, wid * 1.3);
        ctx.lineTo(-len * 0.6, 0);
        ctx.lineTo(0, -wid * 1.3);
        ctx.closePath();
        ctx.fill();
        // 主体血红
        ctx.fillStyle = '#ff2a0a';
        ctx.beginPath();
        ctx.moveTo(len, 0);
        ctx.lineTo(0, wid);
        ctx.lineTo(-len * 0.5, 0);
        ctx.lineTo(0, -wid);
        ctx.closePath();
        ctx.fill();
        // 高光橙黄
        ctx.fillStyle = '#ffd23b';
        ctx.beginPath();
        ctx.moveTo(len * 0.55, 0);
        ctx.lineTo(0, wid * 0.4);
        ctx.lineTo(-len * 0.1, 0);
        ctx.lineTo(0, -wid * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'orb' || k === 'spark') {
        // 元素弹道优先走自定义渲染（三层圆形像素火球/墨绿毒液团/六棱冰锥）
        if (this.element) { this.renderElement(ctx); return; }
        // 火鸡王像素火球：与玩家火焰弹同款三层圆形像素造型（尺寸保持 r 不变）
        if (this.pxFire) { drawPxFireball(ctx, this.x, this.y, this.r, this.t, this.vx, this.vy); return; }
        // 火焰弹：暗红→橙→黄→白芯分层 + 跳动闪烁
        if (this.fireTrail) {
          const r = this.r;
          const f = 1 + Math.sin(this.t * 18) * 0.16;
          ctx.fillStyle = '#7a1e08';
          ctx.fillRect(this.x - r * 1.18 * f, this.y - r * 1.18 * f, r * 2.36 * f, r * 2.36 * f);
          ctx.fillStyle = '#c94a1e';
          ctx.fillRect(this.x - r * f, this.y - r * f, r * 2 * f, r * 2 * f);
          ctx.fillStyle = '#ff7b2e';
          ctx.fillRect(this.x - r * 0.64 * f, this.y - r * 0.64 * f, r * 1.28 * f, r * 1.28 * f);
          ctx.fillStyle = '#ffd23b';
          ctx.fillRect(this.x - r * 0.34, this.y - r * 0.34, r * 0.68, r * 0.68);
          ctx.fillStyle = '#fff5d0';
          ctx.fillRect(this.x - r * 0.15, this.y - r * 0.15, r * 0.3, r * 0.3);
          return;
        }
        const c = k === 'spark' ? '#c77dff' : this.color || '#ff6b6b';
        ctx.fillStyle = '#000'; ctx.fillRect(this.x - this.r - 1, this.y - this.r - 1, (this.r + 1) * 2, (this.r + 1) * 2);
        ctx.fillStyle = c;
        ctx.fillRect(this.x - this.r, this.y - this.r, this.r * 2, this.r * 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x - this.r * 0.4, this.y - this.r * 0.4, this.r * 0.5, this.r * 0.5);
        return;
      }
      if (k === 'skull') {
        // 亡灵骷髅王小骷髅弹：蓝绿色弧线拖尾（历史轨迹点 + 中段正弦摆弧，三层发光渐细）+ 1/4 Boss 体型旋转头骨
        const baseA = ctx.globalAlpha;
        const pts = this.skullPts;
        if (pts && pts.length > 2) {
          const n = pts.length;
          // 摆弧轨迹点：偏移垂直于行进方向，首尾锚定、中段摆幅最大（sin 包络）
          const ap = pts.map((pt, i) => {
            if (i === 0) return { x: pt.x, y: pt.y };
            const dx = pt.x - pts[i - 1].x, dy = pt.y - pts[i - 1].y;
            const dl = Math.hypot(dx, dy) || 1;
            const env = Math.sin((i / n) * Math.PI);
            const w = Math.sin(this.t * 9 - i * 0.6) * 7 * env;
            return { x: pt.x + (-dy / dl) * w, y: pt.y + (dx / dl) * w };
          });
          // 三层描边：外青绿光晕 → 中青线 → 内亮青芯；宽度/亮度向尾端渐细渐暗
          const layers = [
            { w: 9, col: '#1f9e8f', a: 0.28 },
            { w: 5, col: '#2ee6a8', a: 0.5 },
            { w: 2.4, col: '#7ff5e0', a: 0.85 }
          ];
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (const L of layers) {
            ctx.strokeStyle = L.col;
            for (let i = 1; i < n; i++) {
              const f = i / n;
              ctx.globalAlpha = baseA * L.a * (0.25 + 0.75 * f);
              ctx.lineWidth = L.w * (0.3 + 0.7 * f);
              ctx.beginPath();
              ctx.moveTo(ap[i - 1].x, ap[i - 1].y);
              ctx.lineTo(ap[i].x, ap[i].y);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = baseA;
        }
        // 小头骨：Boss 7.6 倍缩放的 1/4 = 1.9 倍，自旋飞行
        drawSprite(ctx, Sprites.skullhead, this.x, this.y, 1.9, 1.9, this.spin, this.hitFlash);
        return;
      }
      if (k === 'shuriken') {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
        // 黑边外框（亮天空下清晰）
        ctx.fillStyle = '#101018';
        ctx.fillRect(-3, -10, 6, 20); ctx.fillRect(-10, -3, 20, 6);
        // 银白刃身
        ctx.fillStyle = '#e8eef7';
        ctx.fillRect(-2, -9, 4, 18); ctx.fillRect(-9, -2, 18, 4);
        // 黄色刃尖
        ctx.fillStyle = '#ffd23b';
        ctx.fillRect(-2, -9, 4, 3); ctx.fillRect(-2, 6, 4, 3);
        ctx.fillRect(-9, -2, 3, 4); ctx.fillRect(6, -2, 3, 4);
        ctx.restore();
        return;
      }
      if (k === 'axe') {
        // 斧王阶段3 追击飞斧：dawang_3futou 精灵（双刃战斧+电光），绕中心自旋
        if (this.p3spr && Sprites.axeProj) {
          const s = (this.r / 9) * 0.19;    // r=15 时精灵缩放 0.317 → 显示约 40×51
          // 发光底圈：青蓝色电弧光晕
          ctx.save();
          ctx.globalAlpha = 0.5 + Math.sin(this.t * 12) * 0.2;
          ctx.shadowColor = '#7fd8ff';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#7fe0ff';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r * 0.7, 0, TAU);
          ctx.fill();
          ctx.restore();
          drawSprite(ctx, Sprites.axeProj, this.x, this.y, s, s, this.spin, 0);
          return;
        }
        // 大王斧头弹：双刃战斧，绕中心持续旋转（spin 驱动），刃身染 this.color；大型追踪斧脉动+被击闪白
        const pulse = this.hp > 0 ? 1 + Math.sin(this.t * 5) * 0.08 : 1;
        const s = Math.min(this.r / 8, 1.5) * pulse;
        const tint = this.color || '#cfd8e3';
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spin);
        ctx.scale(s, s);
        // 斧柄：黑边木杆 + 高光 + 金属尾锤
        ctx.fillStyle = '#101018'; ctx.fillRect(-2.6, -11, 5.2, 26);
        ctx.fillStyle = '#7a4a22'; ctx.fillRect(-1.4, -10, 2.8, 24);
        ctx.fillStyle = '#a86b34'; ctx.fillRect(-1.4, -10, 1, 24);
        ctx.fillStyle = '#101018'; ctx.fillRect(-3.4, 13, 6.8, 4.4);
        ctx.fillStyle = '#5a6472'; ctx.fillRect(-2.2, 13.6, 4.4, 2);
        // 双刃：sig=1 右刃 / -1 左刃（镜像）
        for (const sig of [1, -1]) {
          const poly = pts => {
            ctx.beginPath();
            ctx.moveTo(pts[0][0] * sig, pts[0][1]);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * sig, pts[i][1]);
            ctx.closePath(); ctx.fill();
          };
          ctx.fillStyle = '#101018';       // 黑色外轮廓
          poly([[1, -13], [12, -15.5], [18.5, -9], [16.5, 1.5], [9.5, 5.5], [2, -1]]);
          ctx.fillStyle = tint;            // 染色刃身
          poly([[2.4, -11.6], [10.6, -13.6], [15.6, -8.6], [14, 0.4], [8.4, 3.8], [2.4, -1.4]]);
          ctx.fillStyle = '#e8eef7';       // 银白开刃（外缘月牙）
          poly([[10.8, -13], [15.2, -8.8], [13.8, 0.2], [11.6, 1.2], [12.8, -6.4]]);
          ctx.fillStyle = '#ffffff';       // 刃口高光
          poly([[12.4, -11.4], [14.2, -8.6], [13.4, -4], [12.4, -4.6]]);
        }
        // 中央斧脑：黑边钢块
        ctx.fillStyle = '#101018'; ctx.fillRect(-3.4, -13.4, 6.8, 7);
        ctx.fillStyle = '#8d96a3'; ctx.fillRect(-2, -12, 4, 4.4);
        // 可击爆大斧：被击中闪白
        if (this.hitFlash > 0) {
          ctx.fillStyle = `rgba(255,255,255,${clamp(this.hitFlash * 6, 0, 0.85)})`;
          ctx.beginPath(); ctx.arc(0, -4, 19, 0, TAU); ctx.fill();
        }
        ctx.restore();
        return;
      }
      if (k === 'potbomb') {
        // 斧王酒壶：陶瓷坛身（深褐外框 + 棕陶主体 + 绿酒液 + 坛口 + 高光）
        const a = Math.atan2(this.vy, this.vx) + Math.PI / 2;   // 旋转跟随抛物线切向
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        const r = this.r;
        // 坛身外框
        ctx.fillStyle = '#2a1a0e';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        // 主体陶色
        ctx.fillStyle = '#7a4a22';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, TAU); ctx.fill();
        // 高光
        ctx.fillStyle = '#a86b34';
        ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.4, 0, TAU); ctx.fill();
        // 坛口
        ctx.fillStyle = '#2a1a0e';
        ctx.fillRect(-r * 0.45, -r - 2, r * 0.9, 5);
        ctx.fillStyle = '#5a3a1e';
        ctx.fillRect(-r * 0.4, -r - 1, r * 0.8, 3);
        // 绿酒液（内盛）
        ctx.fillStyle = '#3aa64a';
        ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#5cd96a';
        ctx.beginPath(); ctx.arc(-r * 0.15, r * 0.1, r * 0.25, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'liquid') {
        // 斧王酒液弹：绿色水滴（深绿外框 + 翠绿主体 + 浅绿芯 + 高光）
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        const r = this.r;
        ctx.fillStyle = '#1c5e2a';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3aa64a';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.fill();
        ctx.fillStyle = '#5cd96a';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#b8f5c8';
        ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.22, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'feather') {
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        // 黑色描边外框（亮天空背景下保证清晰）
        ctx.fillStyle = '#141a26';
        ctx.fillRect(-11, -4, 21, 8);    // 羽片边框
        ctx.fillRect(-13, -2, 3, 4);     // 羽根
        // 羽毛主体（银白）
        ctx.fillStyle = '#eef3fa';
        ctx.fillRect(-10, -3, 19, 6);
        // 羽片下缘暗部
        ctx.fillStyle = '#aebccd';
        ctx.fillRect(-10, 1, 16, 2);
        // 羽轴（深色中脊）
        ctx.fillStyle = '#2b3344';
        ctx.fillRect(-10, -1, 17, 2);
        // 羽尖高光
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(5, -2, 4, 4);
        // 红色羽斑（铁鹰标识色）
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-9, -3, 3, 3);
        ctx.restore();
        return;
      }
      if (k === 'arrow') {
        const a = this.angle !== undefined ? this.angle : Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-8, -1, 14, 2);
        ctx.fillStyle = '#cfd8e3'; ctx.fillRect(6, -2, 4, 4);
        ctx.fillStyle = '#f7f7f2'; ctx.fillRect(-10, -3, 3, 2); ctx.fillRect(-10, 1, 3, 2);
        ctx.restore();
        return;
      }
      if (k === 'whirl') {
        ctx.save(); ctx.translate(this.x, this.y);
        const rr = this.r + 5;
        // 三道旋转风刃：黑边 + 红芯，明亮天空下依然醒目
        for (let i = 0; i < 3; i++) {
          const a0 = this.spin + (i * TAU / 3);
          ctx.strokeStyle = '#101018';
          ctx.lineWidth = 7;
          ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + 1.55); ctx.stroke();
          ctx.strokeStyle = '#ff3b3b';
          ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + 1.55); ctx.stroke();
        }
        // 中心核：黑边亮黄芯
        ctx.fillStyle = '#101018';
        ctx.fillRect(-5, -5, 10, 10);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.fillStyle = '#ffd23b';
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
        return;
      }
      if (k === 'flame') {
        const f = 1 + Math.sin(this.t * 20) * 0.25;
        ctx.fillStyle = '#c94a1e';
        ctx.fillRect(this.x - this.r * f, this.y - this.r * f, this.r * 2 * f, this.r * 2 * f);
        ctx.fillStyle = '#ff7b2e';
        ctx.fillRect(this.x - this.r * 0.66 * f, this.y - this.r * 0.66 * f, this.r * 1.32 * f, this.r * 1.32 * f);
        ctx.fillStyle = '#ffd23b';
        ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
        return;
      }
      if (k === 'greenfire') {
        // 骨龙王绿火拖尾弹：深绿外晕 → 亮绿主体 → 白芯，跳动膨胀 + 拖尾
        const f = 1 + Math.sin(this.t * 18) * 0.2;
        const r = this.r * f;
        // 拖尾（沿反速度方向）
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const tx = this.x - (this.vx / sp) * r * 1.6;
        const ty = this.y - (this.vy / sp) * r * 1.6;
        ctx.fillStyle = 'rgba(74,222,128,0.25)';
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(tx - r*0.6, ty); ctx.lineTo(tx + r*0.6, ty); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(22,101,52,0.55)';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.35, 0, TAU); ctx.fill();
        ctx.fillStyle = '#166534';
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4ade80';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.66, 0, TAU); ctx.fill();
        ctx.fillStyle = '#bbf7d0';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.3, 0, TAU); ctx.fill();
        return;
      }
      if (k === 'fireball') {
        const f = 1 + Math.sin(this.t * 14) * 0.15;
        ctx.fillStyle = '#c94a1e';
        ctx.fillRect(this.x - 11 * f, this.y - 11 * f, 22 * f, 22 * f);
        ctx.fillStyle = '#ff7b2e';
        ctx.fillRect(this.x - 8 * f, this.y - 8 * f, 16 * f, 16 * f);
        ctx.fillStyle = '#ffd23b';
        ctx.fillRect(this.x - 4, this.y - 4, 8, 8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
        return;
      }
      if (k === 'lava') {
        // 火山口巨大火焰弹：暗红外晕 → 橙 → 黄 → 白芯，跳动膨胀
        const f = 1 + Math.sin(this.t * 16) * 0.12;
        const r = this.r * f;
        ctx.fillStyle = 'rgba(201,74,30,0.5)';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c94a1e';
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff7b2e';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.72, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd23b';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.44, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff5d0';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.2, 0, TAU); ctx.fill();
        return;
      }
      if (k === 'shell') {
        // 铁炮弹：黑体高光 + 引信火花
        const f = this.r + Math.sin(this.t * 12) * 0.8;
        ctx.fillStyle = '#0d0f14';
        ctx.fillRect(this.x - f - 1, this.y - f - 1, (f + 1) * 2, (f + 1) * 2);
        ctx.fillStyle = '#3d4654';
        ctx.fillRect(this.x - f, this.y - f, f * 2, f * 2);
        ctx.fillStyle = '#6f7683';
        ctx.fillRect(this.x - f * 0.5, this.y - f * 0.7, f * 0.7, f * 0.7);
        ctx.fillStyle = '#ffd23b';
        ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
        return;
      }
      if (k === 'missile') {
        const a = this.angle !== undefined ? this.angle : Math.atan2(this.vy, this.vx);
        const ms = this.bscale || 1;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        // 弹体（黑边 + 灰甲）
        ctx.fillStyle = '#141418'; ctx.fillRect(-11 * ms, -4 * ms, 22 * ms, 8 * ms);
        ctx.fillStyle = '#8d96a3'; ctx.fillRect(-9 * ms, -2 * ms, 16 * ms, 4 * ms);
        // 弹头（红，黑边）
        ctx.fillStyle = '#141418'; ctx.fillRect(6 * ms, -4 * ms, 6 * ms, 8 * ms);
        ctx.fillStyle = '#e0453a'; ctx.fillRect(7 * ms, -2 * ms, 4 * ms, 4 * ms);
        // 尾焰（拉长 + 三色跳动）
        const fl = 1 + Math.sin(this.t * 26) * 0.25;
        ctx.fillStyle = ['#ffd23b', '#ff7b2e', '#ff2a0a'][Math.floor(this.t * 20) % 3];
        ctx.fillRect(-22 * ms * fl, -3 * ms, 11 * ms * fl, 6 * ms);
        ctx.fillStyle = '#fff5d0';
        ctx.fillRect(-15 * ms, -1.5 * ms, 4 * ms, 3 * ms);
        // 尾翼
        ctx.fillStyle = '#141418';
        ctx.fillRect(-11 * ms, -7 * ms, 4 * ms, 3 * ms); ctx.fillRect(-11 * ms, 4 * ms, 4 * ms, 3 * ms);
        ctx.fillStyle = '#3d4654';
        ctx.fillRect(-10 * ms, -6 * ms, 2 * ms, 2 * ms); ctx.fillRect(-10 * ms, 4 * ms, 2 * ms, 2 * ms);
        ctx.restore();
        // 发射后无敌时间：青色脉动护盾环
        if (this.invuln > 0) {
          const rr = 20 * ms + Math.sin(this.t * 14) * 3;
          ctx.strokeStyle = `rgba(127,231,255,${0.5 + Math.sin(this.t * 14) * 0.3})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(this.x, this.y, rr, 0, TAU); ctx.stroke();
        }
        return;
      }
      if (k === 'float') {
        // 大王漂浮弹：巨大暗红方弹，缓慢逼近，被击中闪白
        const f = 1 + Math.sin(this.t * 5) * 0.08;
        const r = this.r * f;
        ctx.fillStyle = '#101018'; ctx.fillRect(this.x - r - 3, this.y - r - 3, (r + 3) * 2, (r + 3) * 2);
        ctx.fillStyle = '#7a1622'; ctx.fillRect(this.x - r, this.y - r, r * 2, r * 2);
        ctx.fillStyle = '#e0453a'; ctx.fillRect(this.x - r * 0.72, this.y - r * 0.72, r * 1.44, r * 1.44);
        ctx.fillStyle = '#ffd23b'; ctx.fillRect(this.x - r * 0.3, this.y - r * 0.3, r * 0.6, r * 0.6);
        ctx.fillStyle = '#fff'; ctx.fillRect(this.x - r * 0.12, this.y - r * 0.12, r * 0.24, r * 0.24);
        if (this.hitFlash > 0) {
          ctx.fillStyle = `rgba(255,255,255,${clamp(this.hitFlash * 6, 0, 0.85)})`;
          ctx.fillRect(this.x - r, this.y - r, r * 2, r * 2);
        }
        return;
      }
      if (k === 'apple') {
        // 怪客玫红苹果：深酒红描边 → 深玫红果身 → 肩部暗玫 → 粉亮高光，棕柄绿叶轻摆
        const r = this.r;
        const f = 1 + Math.sin(this.t * 6) * 0.05;
        const rr = r * f;
        ctx.fillStyle = '#570a2c';
        ctx.beginPath(); ctx.arc(this.x, this.y + rr * 0.05, rr * 1.08, 0, TAU); ctx.fill();
        ctx.fillStyle = '#bf145c';
        ctx.beginPath(); ctx.arc(this.x, this.y, rr, 0, TAU); ctx.fill();
        ctx.fillStyle = '#930f48';
        ctx.beginPath(); ctx.arc(this.x, this.y - rr * 0.28, rr * 0.8, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
        ctx.fillStyle = 'rgba(255,150,200,0.95)';
        ctx.beginPath(); ctx.arc(this.x - rr * 0.34, this.y - rr * 0.3, rr * 0.24, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,232,244,0.95)';
        ctx.beginPath(); ctx.arc(this.x - rr * 0.4, this.y - rr * 0.4, rr * 0.1, 0, TAU); ctx.fill();
        // 果柄 + 绿叶（随帧轻摆）
        ctx.save();
        ctx.translate(this.x, this.y - rr * 0.92);
        ctx.rotate(Math.sin(this.t * 3) * 0.18);
        ctx.fillStyle = '#5a3416';
        ctx.fillRect(-r * 0.08, -r * 0.42, r * 0.16, r * 0.44);
        ctx.fillStyle = '#3f9e3a';
        ctx.beginPath(); ctx.ellipse(r * 0.26, -r * 0.34, r * 0.28, r * 0.13, -0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7ed46d';
        ctx.beginPath(); ctx.ellipse(r * 0.22, -r * 0.37, r * 0.14, r * 0.06, -0.5, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'cross') {
        // 怪客巨型十字弹：黑边红十字黄芯，快速自转
        const s = this.r;
        const arm = s * 1.5, th = s * 0.62;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
        ctx.fillStyle = '#101018';
        ctx.fillRect(-arm - 2, -th / 2 - 2, arm * 2 + 4, th + 4);
        ctx.fillRect(-th / 2 - 2, -arm - 2, th + 4, arm * 2 + 4);
        ctx.fillStyle = '#e0453a';
        ctx.fillRect(-arm, -th / 2, arm * 2, th);
        ctx.fillRect(-th / 2, -arm, th, arm * 2);
        ctx.fillStyle = '#ffd23b';
        ctx.fillRect(-th / 2 + 2, -th / 2 + 2, th - 4, th - 4);
        ctx.restore();
        return;
      }
      if (k === 'knife') {
        // 怪客飞刀：黑边银刃红柄
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a + Math.sin(this.t * 10) * 0.3);
        ctx.fillStyle = '#101018'; ctx.fillRect(-10, -2, 17, 4);
        ctx.fillStyle = '#dfe6ee'; ctx.fillRect(-9, -1, 13, 2);
        ctx.fillStyle = '#101018'; ctx.fillRect(4, -3, 5, 6);
        ctx.fillStyle = '#c0392b'; ctx.fillRect(5, -2, 3, 4);
        ctx.restore();
        return;
      }
      if (k === 'katana') {
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.fillStyle = '#0d1018';
        ctx.fillRect(-26, -5, 52, 10);
        ctx.fillStyle = '#e8eef7';
        ctx.fillRect(-24, -3, 44, 6);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-24, -3, 44, 2);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(16, -6, 6, 12);
        ctx.restore();
        return;
      }
      if (k === 'wave') {
        // 鹤鸣声波：高饱和青蓝脉动光球，外光晕+粗黑边+亮青内环+白芯，亮天空下清晰
        const f = 1 + Math.sin(this.t * 12) * 0.16;
        const r = this.r * f;
        ctx.fillStyle = 'rgba(56,189,248,0.30)';                 // 外光晕
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#0b1622';                                // 粗黑描边底
        ctx.beginPath(); ctx.arc(this.x, this.y, r + 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = this.color || '#38bdf8';                  // 饱和青蓝主体
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(200,242,255,0.95)';                 // 亮青内环
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff';                                // 白芯高光
        ctx.beginPath(); ctx.arc(this.x - r * 0.24, this.y - r * 0.26, r * 0.3, 0, TAU); ctx.fill();
        return;
      }
      if (k === 'windBolt') {
        // 鹤仙风炮：高速风弹——流线梭形（黑边→深青→亮青主体→白芯），尾部气流向后拖曳
        const a = this.angle !== undefined ? this.angle : Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        // 后拖气流尾迹（两层渐淡）
        ctx.fillStyle = 'rgba(120,220,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(-22, -4); ctx.lineTo(-22, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(190,240,255,0.55)';
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(-16, -2.5); ctx.lineTo(-16, 2.5); ctx.closePath(); ctx.fill();
        // 黑色描边外框（亮天空下清晰）
        ctx.fillStyle = '#0b1622';
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.quadraticCurveTo(4, -7, -10, 0);
        ctx.quadraticCurveTo(4, 7, 15, 0); ctx.closePath();
        ctx.lineWidth = 1; ctx.fill();
        // 深青内层
        ctx.fillStyle = '#1b6e8a';
        ctx.beginPath();
        ctx.moveTo(13, 0); ctx.quadraticCurveTo(3, -5.5, -9, 0);
        ctx.quadraticCurveTo(3, 5.5, 13, 0); ctx.closePath(); ctx.fill();
        // 亮青主体
        ctx.fillStyle = '#5fd0f0';
        ctx.beginPath();
        ctx.moveTo(11, 0); ctx.quadraticCurveTo(2, -3.8, -7, 0);
        ctx.quadraticCurveTo(2, 3.8, 11, 0); ctx.closePath(); ctx.fill();
        // 白芯高光
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(8, 0); ctx.quadraticCurveTo(1, -1.6, -3, 0);
        ctx.quadraticCurveTo(1, 1.6, 8, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'windBlade') {
        // 鹤仙风刃：青绿月牙刃（黑边→深青→翠青主体→白刃锋），自旋飞行
        const a = this.angle !== undefined ? this.angle : Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a + this.spin * 0.5);
        const R = this.r * 1.7, inn = this.r * 0.7;
        // 黑色描边
        ctx.fillStyle = '#0b1622';
        ctx.beginPath();
        ctx.arc(0, 0, R + 1.6, Math.PI * 0.15, Math.PI * 0.85);
        ctx.arc(R * 0.55, 0, inn + 1.6, Math.PI * 0.85, Math.PI * 0.15, true);
        ctx.closePath(); ctx.fill();
        // 深青外层
        ctx.fillStyle = '#1d6f7e';
        ctx.beginPath();
        ctx.arc(0, 0, R, Math.PI * 0.15, Math.PI * 0.85);
        ctx.arc(R * 0.55, 0, inn, Math.PI * 0.85, Math.PI * 0.15, true);
        ctx.closePath(); ctx.fill();
        // 翠青主体
        ctx.fillStyle = '#4fe0c8';
        ctx.beginPath();
        ctx.arc(0, 0, R - 2, Math.PI * 0.18, Math.PI * 0.82);
        ctx.arc(R * 0.55, 0, inn + 0.5, Math.PI * 0.82, Math.PI * 0.18, true);
        ctx.closePath(); ctx.fill();
        // 白刃锋高光
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, R - 3.5, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
        ctx.restore();
        return;
      }
      if (k === 'blackKnife') {
        // 大型蝙蝠黑色飞刀：黑刃 + 灰刃高光 + 红尾坠
        const a = this.angle !== undefined ? this.angle : Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.fillStyle = '#0a0a10';
        ctx.fillRect(-12, -2.5, 20, 5);
        ctx.fillStyle = '#454c5c';
        ctx.fillRect(-11, -1, 15, 2);
        ctx.fillStyle = '#0a0a10';
        ctx.fillRect(6, -4, 4, 8);
        ctx.fillStyle = '#ff3b3b';
        ctx.fillRect(9, -1.5, 3, 3);
        ctx.restore();
        return;
      }
      if (k === 'spike') {
        // 草龙龙鳞刺：细长梭形（蓝边 → 青绿鳞身 → 亮脊），高速直线
        const a = Math.atan2(this.vy, this.vx);
        const L = 15, w = 5;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.fillStyle = '#0b3a6e';
        ctx.beginPath();
        ctx.moveTo(-L, 0);
        ctx.quadraticCurveTo(0, -w - 1.5, L, 0);
        ctx.quadraticCurveTo(0, w + 1.5, -L, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2fb37c';
        ctx.beginPath();
        ctx.moveTo(-L + 2, 0);
        ctx.quadraticCurveTo(0, -w, L - 1, 0);
        ctx.quadraticCurveTo(0, w, -L + 2, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#bff5d6';
        ctx.beginPath();
        ctx.moveTo(-L * 0.5, 0);
        ctx.quadraticCurveTo(0, -w * 0.4, L * 0.7, 0);
        ctx.quadraticCurveTo(0, w * 0.4, -L * 0.5, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'sandspike') {
        // 沙晶锥刺：黄褐色半透明沙岩晶体，细长三棱锥
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.fillStyle = 'rgba(122,90,46,0.95)';
        ctx.beginPath();
        ctx.moveTo(17, 0); ctx.lineTo(-6, -5.5); ctx.lineTo(-11, 0); ctx.lineTo(-6, 5.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(222,182,96,0.78)';
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-5, -4); ctx.lineTo(-9, 0); ctx.lineTo(-5, 4);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,236,176,0.9)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-7, -3.4); ctx.moveTo(15, 0); ctx.lineTo(-7, 3.4); ctx.stroke();
        ctx.fillStyle = 'rgba(255,244,208,0.85)';
        ctx.fillRect(-2, -1, 6, 2);
        ctx.restore();
        return;
      }
      if (k === 'blackscale') {
        // 黑炎龙鳞：黑色菱形鳞片高速旋转，中燃暗红火炎
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
        ctx.fillStyle = 'rgba(142,27,43,0.55)';
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
        ctx.fillStyle = '#0a0a12';
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(0, -8); ctx.lineTo(-12, 0); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2c2c3a';
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(0, -6); ctx.lineTo(-9, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
        const fl = 0.75 + Math.sin(this.t * 18) * 0.25;
        ctx.fillStyle = '#8e1b2b';
        ctx.beginPath(); ctx.moveTo(6 * fl, 0); ctx.lineTo(0, -3.6 * fl); ctx.lineTo(-6 * fl, 0); ctx.lineTo(0, 3.6 * fl); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff5a3b';
        ctx.beginPath(); ctx.arc(0, 0, 2.2 * fl, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'lavafang') {
        // 熔岩龙牙：红橙尖锐獠牙形火焰弹，表布熔岩裂纹
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.fillStyle = '#8a1e0c';
        ctx.beginPath();
        ctx.moveTo(18, 0); ctx.lineTo(-8, -6.5); ctx.lineTo(-3, 0); ctx.lineTo(-8, 6.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff7b2e';
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-6, -4.6); ctx.lineTo(-2.4, 0); ctx.lineTo(-6, 4.6);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffd23b'; ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(6, -2.2); ctx.lineTo(2, 1); ctx.lineTo(-3, -1.4);
        ctx.moveTo(10, 1.6); ctx.lineTo(5, 3); ctx.lineTo(0, 2);
        ctx.stroke();
        ctx.fillStyle = '#fff5d0';
        ctx.beginPath(); ctx.arc(14, -0.8, 1.6, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'boneshard') {
        // 骨刺：白色骨片中段粗、两端尖，高速旋转
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
        ctx.fillStyle = '#a89e88';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.quadraticCurveTo(0, -6, -16, 0);
        ctx.quadraticCurveTo(0, 6, 16, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8e4d8';
        ctx.beginPath();
        ctx.moveTo(14.5, 0);
        ctx.quadraticCurveTo(0, -4.6, -14.5, 0);
        ctx.quadraticCurveTo(0, 4.6, 14.5, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d8d3c2';
        ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#b5ae9a';
        ctx.fillRect(-1.5, -4.4, 3, 2);
        ctx.fillRect(-1.5, 2.4, 3, 2);
        ctx.restore();
        return;
      }
      if (k === 'gear') {
        // 机械齿轮弹：钢齿 + 铜环 + 发光核心，高速旋转直线飞行
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin * 1.3);
        ctx.fillStyle = '#0c0f16';
        for (let i = 0; i < 8; i++) {
          const aa = (TAU / 8) * i;
          ctx.save(); ctx.rotate(aa);
          ctx.fillRect(8, -2.2, 4.5, 4.4);
          ctx.restore();
        }
        ctx.fillStyle = '#2a3040';
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#b87333'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 6.4, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#35e0ff';
        ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d8fbff';
        ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'seaspike') {
        // 深海水晶刺：蓝色半透明水晶长刺，内含水流旋涡
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.fillStyle = 'rgba(13,59,102,0.9)';
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.quadraticCurveTo(2, -7, -15, 0);
        ctx.quadraticCurveTo(2, 7, 18, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(64,158,224,0.6)';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.quadraticCurveTo(1, -5.2, -13, 0);
        ctx.quadraticCurveTo(1, 5.2, 16, 0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(216,242,255,0.9)'; ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.quadraticCurveTo(-3, -4, 3, 0);
        ctx.quadraticCurveTo(8, 3.4, 13, 0);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(5 + Math.sin(this.t * 14) * 4, -1, 1.3, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'shard') {
        // 狮身人面像石片：金色三角石质（深金边→金体→高光）+ 蓝色能量核心，缓慢自旋
        const r = this.r;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
        ctx.fillStyle = '#6b4f24';
        ctx.beginPath();
        ctx.moveTo(r + 1.6, 0); ctx.lineTo(-r * 0.82, -r * 0.78); ctx.lineTo(-r * 0.82, r * 0.78);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d9a94f';
        ctx.beginPath();
        ctx.moveTo(r, 0); ctx.lineTo(-r * 0.72, -r * 0.64); ctx.lineTo(-r * 0.72, r * 0.64);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f0d496';
        ctx.beginPath();
        ctx.moveTo(r * 0.42, 0); ctx.lineTo(-r * 0.28, -r * 0.3); ctx.lineTo(-r * 0.28, r * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1f8fd6';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.27, 0, TAU); ctx.fill();
        ctx.fillStyle = '#bfeeff';
        ctx.beginPath(); ctx.arc(-r * 0.06, -r * 0.06, r * 0.11, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'eyeGem') {
        // 神眼菱形：蓝色外光晕 + 金菱形 + 中央黑色眼睛图案（不随菱形旋转）
        const r = this.r;
        const f = 1 + Math.sin(this.t * 8) * 0.08;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.PI / 4 + this.spin * 0.35);
        ctx.fillStyle = 'rgba(64,190,255,0.28)';
        ctx.fillRect(-r * 1.55 * f, -r * 1.55 * f, r * 3.1 * f, r * 3.1 * f);
        ctx.fillStyle = '#2b6ea8';
        ctx.fillRect(-r * 1.16 * f, -r * 1.16 * f, r * 2.32 * f, r * 2.32 * f);
        ctx.fillStyle = '#e8c165';
        ctx.fillRect(-r * f, -r * f, r * 2 * f, r * 2 * f);
        ctx.fillStyle = '#fff0c0';
        ctx.fillRect(-r * 0.55 * f, -r * 0.55 * f, r * 0.5 * f, r * 0.5 * f);
        ctx.restore();
        ctx.fillStyle = '#0b0b14';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.42, 0, TAU); ctx.fill();
        ctx.fillStyle = '#54c8ff';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#dff6ff';
        ctx.beginPath(); ctx.arc(this.x - r * 0.08, this.y - r * 0.08, r * 0.07, 0, TAU); ctx.fill();
        return;
      }
      if (k === 'crescent') {
        // 月牙能量刃：蓝色月牙（双层弧相减）+ 灰金石质纹理碎点 + 白刃口
        const r = this.r;
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.fillStyle = '#0b3a66';
        ctx.beginPath();
        ctx.arc(0, 0, r + 1.5, -1.05, 1.05);
        ctx.arc(r * 0.58, 0, r * 0.86, 1.05, -1.05, true);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3fb6ff';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, -0.95, 0.95);
        ctx.arc(r * 0.46, 0, r * 0.6, 0.95, -0.95, true);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#caa45e';
        for (let i = 0; i < 3; i++) {
          const aa = -0.62 + i * 0.62, rr = r * 0.52;
          ctx.fillRect(Math.cos(aa) * rr - 1.2, Math.sin(aa) * rr - 1.2, 2.6, 2.6);
        }
        ctx.strokeStyle = 'rgba(220,245,255,0.9)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.78, -0.95, 0.95); ctx.stroke();
        ctx.restore();
        return;
      }
      if (k === 'sandSpike') {
        // 长沙尘拖尾：历史轨迹点连成沙尘色渐变线（外宽内亮、向尾端渐细渐散）
        const spts = this.sandPts;
        if (spts && spts.length > 2) {
          const n = spts.length;
          const baseA = ctx.globalAlpha;
          ctx.save();
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          // 外层沙尘宽晕
          ctx.strokeStyle = 'rgba(216,168,106,0.22)';
          ctx.lineWidth = 18;
          ctx.beginPath();
          ctx.moveTo(spts[0].x, spts[0].y);
          for (let i = 1; i < n; i++) ctx.lineTo(spts[i].x, spts[i].y);
          ctx.stroke();
          // 中层沙黄主体：逐段向尾端渐细
          for (let i = 1; i < n; i++) {
            const f = i / n;
            ctx.globalAlpha = baseA * (0.15 + 0.7 * f);
            ctx.strokeStyle = '#d8a86a';
            ctx.lineWidth = 11 * (0.25 + 0.75 * f);
            ctx.beginPath();
            ctx.moveTo(spts[i - 1].x, spts[i - 1].y);
            ctx.lineTo(spts[i].x, spts[i].y);
            ctx.stroke();
          }
          // 内层亮沙芯
          for (let i = 1; i < n; i++) {
            const f = i / n;
            ctx.globalAlpha = baseA * (0.1 + 0.8 * f);
            ctx.strokeStyle = '#f5e3b8';
            ctx.lineWidth = 4 * (0.2 + 0.8 * f);
            ctx.beginPath();
            ctx.moveTo(spts[i - 1].x, spts[i - 1].y);
            ctx.lineTo(spts[i].x, spts[i].y);
            ctx.stroke();
          }
          ctx.globalAlpha = baseA;
          ctx.restore();
        }
        // 沙之行者沙之刺：大而清晰的沙质尖刺，尖端朝飞行方向，深棕描边 + 沙黄主体 + 亮沙芯
        const r = this.r;
        const a = this.angle !== undefined ? this.angle : Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        const spikePath = () => {
          ctx.beginPath();
          ctx.moveTo(r * 1.4, 0);                                        // 尖端
          ctx.quadraticCurveTo(r * 0.15, -r * 0.55, -r * 1.15, -r * 0.2);  // 上缘
          ctx.quadraticCurveTo(-r * 0.8, 0, -r * 1.15, r * 0.2);          // 尾部收拢
          ctx.quadraticCurveTo(r * 0.15, r * 0.55, r * 1.4, 0);           // 下缘
          ctx.closePath();
        };
        ctx.fillStyle = '#4a2f14'; spikePath(); ctx.fill();   // 深棕底
        ctx.save(); ctx.scale(0.82, 0.7);
        ctx.fillStyle = '#d8a86a'; spikePath(); ctx.fill();   // 沙黄主体
        ctx.restore();
        ctx.save(); ctx.scale(0.5, 0.34);
        ctx.fillStyle = '#f5e3b8'; spikePath(); ctx.fill();   // 亮沙芯
        ctx.restore();
        // 沙粒点缀
        ctx.fillStyle = 'rgba(245,227,184,0.9)';
        for (let i = 0; i < 3; i++) {
          const gx = -r * 0.5 + i * r * 0.42, gy = (i % 2 ? 1 : -1) * r * 0.14;
          ctx.fillRect(gx, gy, 2, 2);
        }
        ctx.restore();
        return;
      }
      if (k === 'horn') {
        // 牛魔牛角弹：小型弯角，尖角朝飞行方向，黑描边 + 红角身 + 亮角尖
        const r = this.r;
        const a = this.angle !== undefined ? this.angle : Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        const hornPath = () => {
          ctx.beginPath();
          ctx.moveTo(r * 1.05, -r * 0.12);                              // 角尖
          ctx.quadraticCurveTo(r * 0.25, -r * 0.95, -r * 0.85, -r * 0.62);   // 外缘向后弯
          ctx.quadraticCurveTo(-r * 0.4, -r * 0.12, r * 1.05, r * 0.22);     // 内缘回角尖
          ctx.closePath();
        };
        ctx.fillStyle = '#101018'; hornPath(); ctx.fill();
        ctx.fillStyle = '#c92a2a';
        ctx.beginPath();
        ctx.moveTo(r * 0.9, -r * 0.08);
        ctx.quadraticCurveTo(r * 0.2, -r * 0.72, -r * 0.62, -r * 0.48);
        ctx.quadraticCurveTo(-r * 0.28, -r * 0.08, r * 0.9, r * 0.14);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff6b5e';
        ctx.beginPath(); ctx.arc(r * 0.72, -r * 0.02, r * 0.2, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'magicHorn') {
        // 牛魔追踪魔角（变大 + 角尖更尖锐）：大型弯角 + 暗红光晕脉动 + 亮红裂纹，单点收束尖角朝飞行方向
        const r = this.r;
        const f = 1 + Math.sin(this.t * 6) * 0.1;
        const a = this.angle !== undefined ? this.angle : Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a); ctx.scale(f, f);
        ctx.fillStyle = 'rgba(224,60,50,0.3)';
        ctx.beginPath(); ctx.arc(0, 0, r * 1.55, 0, TAU); ctx.fill();
        const hornPath = () => {
          ctx.beginPath();
          ctx.moveTo(r * 1.55, r * 0.05);                              // 尖锐角尖（单点收束）
          ctx.quadraticCurveTo(r * 0.3, -r * 1.05, -r * 0.9, -r * 0.66);   // 外缘向后弯
          ctx.quadraticCurveTo(-r * 0.42, -r * 0.12, r * 1.55, r * 0.05);  // 内缘回尖
          ctx.closePath();
        };
        ctx.fillStyle = '#101018'; hornPath(); ctx.fill();
        ctx.fillStyle = '#7a1622';
        ctx.beginPath();
        ctx.moveTo(r * 1.4, r * 0.03);
        ctx.quadraticCurveTo(r * 0.2, -r * 0.82, -r * 0.66, -r * 0.5);
        ctx.quadraticCurveTo(-r * 0.3, -r * 0.08, r * 1.4, r * 0.03);
        ctx.closePath(); ctx.fill();
        // 裂纹亮线
        ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = Math.max(1.4, r * 0.12); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(r * 0.85, 0); ctx.lineTo(r * 0.1, -r * 0.34); ctx.lineTo(-r * 0.3, -r * 0.3); ctx.stroke();
        // 角尖高光
        ctx.fillStyle = '#ffd23b';
        ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.16, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'qi') {
        // 牛魔魔气弹：暗红→红→橙芯脉动光球
        const f = 1 + Math.sin(this.t * 11) * 0.14;
        const r = this.r * f;
        ctx.fillStyle = 'rgba(180,30,50,0.32)';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7a1622';
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e0453a';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.68, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff8a5c';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff0d0';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.17, 0, TAU); ctx.fill();
        return;
      }
      if (k === 'capShell') {
        // 乔治船长重型炮弹：橙黄色长拖尾（外宽晕 → 橙主体 → 黄芯，向尾端渐细渐散）
        const cpts = this.capPts;
        if (cpts && cpts.length > 2) {
          const n = cpts.length;
          const baseA = ctx.globalAlpha;
          ctx.save();
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(255,120,30,0.22)';
          ctx.lineWidth = 26;
          ctx.beginPath();
          ctx.moveTo(cpts[0].x, cpts[0].y);
          for (let i = 1; i < n; i++) ctx.lineTo(cpts[i].x, cpts[i].y);
          ctx.stroke();
          for (let i = 1; i < n; i++) {
            const f = i / n;
            ctx.globalAlpha = baseA * (0.12 + 0.72 * f);
            ctx.strokeStyle = '#ff7b1e';
            ctx.lineWidth = 16 * (0.22 + 0.78 * f);
            ctx.beginPath();
            ctx.moveTo(cpts[i - 1].x, cpts[i - 1].y);
            ctx.lineTo(cpts[i].x, cpts[i].y);
            ctx.stroke();
          }
          for (let i = 1; i < n; i++) {
            const f = i / n;
            ctx.globalAlpha = baseA * (0.1 + 0.82 * f);
            ctx.strokeStyle = '#ffd23b';
            ctx.lineWidth = 6 * (0.18 + 0.82 * f);
            ctx.beginPath();
            ctx.moveTo(cpts[i - 1].x, cpts[i - 1].y);
            ctx.lineTo(cpts[i].x, cpts[i].y);
            ctx.stroke();
          }
          ctx.globalAlpha = baseA;
          ctx.restore();
        }
        // 弹体：烧红的大型铁炮弹（黑铁外壳 + 赤热箍环 + 橙红热光 + 引线火星）
        const r = this.r;
        const f = 1 + Math.sin(this.t * 10) * 0.07;
        const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.1 * f);
        glow.addColorStop(0, 'rgba(255,140,40,0.55)');
        glow.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 2.1 * f, 0, TAU); ctx.fill();
        ctx.fillStyle = '#241712';
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.12, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2620';
        ctx.beginPath(); ctx.arc(this.x - r * 0.15, this.y - r * 0.15, r * 0.95, 0, TAU); ctx.fill();
        // 赤热箍环（随速度方向横置）
        const a0 = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a0);
        ctx.strokeStyle = '#ff5a1a'; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.02, r * 0.5, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#ffb13b'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(-r * 0.3, 0, r * 0.8, r * 0.38, 0, 0, TAU); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#ff7b2e';
        ctx.beginPath(); ctx.arc(this.x + r * 0.25, this.y + r * 0.3, r * 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe39a';
        ctx.beginPath(); ctx.arc(this.x + r * 0.2, this.y + r * 0.26, r * 0.13, 0, TAU); ctx.fill();
        return;
      }
      if (k === 'fireSlash') {
        // 斩击残影：飞行路径上留下的月牙刃副本，随龄收窄 + 平方渐隐（火魂质感）
        const R = this.slashR, span = this.slashSpan;
        const fl = 1 + Math.sin(this.t * 16) * 0.05;
        const ang = Math.atan2(this.vy, this.vx);
        const baseA = ctx.globalAlpha;
        const ghosts = this.slashGhosts;
        if (ghosts && ghosts.length) {
          ctx.save();
          for (const gh of ghosts) {
            const fade = 1 - gh.age / 0.3;                  // 1=新生 0=消散
            if (fade <= 0) continue;
            const fa = fade * fade;
            ctx.save();
            ctx.translate(gh.x, gh.y); ctx.rotate(ang);
            const gband = (rad, th) => {
              ctx.beginPath();
              ctx.arc(0, 0, rad + th, -span, span);
              ctx.arc(0, 0, rad - th, span, -span, true);
              ctx.closePath();
            };
            ctx.globalAlpha = baseA * fa * 0.4; ctx.fillStyle = '#ff3c10'; gband(R, 22 + 12 * fade); ctx.fill();
            ctx.globalAlpha = baseA * fa * 0.5; ctx.fillStyle = '#ff7a1c'; gband(R, 13); ctx.fill();
            ctx.globalAlpha = baseA * fa * 0.42; ctx.fillStyle = '#ffd23b'; gband(R, 5); ctx.fill();
            ctx.restore();
          }
          ctx.restore();
          ctx.globalAlpha = baseA;
        }
        // 火焰斩本体：朝飞行方向张开的巨型弧形火刃（月牙波，宽度可填充半屏）
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(ang);
        const arcBand = (rad, th) => {
          ctx.beginPath();
          ctx.arc(0, 0, rad + th, -span, span);
          ctx.arc(0, 0, rad - th, span, -span, true);
          ctx.closePath();
        };
        // 波头扇面：弦与外弧之间填满火焰渐变，让月牙刃有厚实火浪体积
        const Rc = R * Math.cos(span), Rs = R * Math.sin(span);
        const hg = ctx.createLinearGradient(Rc, 0, R + 34 * fl, 0);
        hg.addColorStop(0, 'rgba(150,22,4,0.62)');
        hg.addColorStop(0.5, 'rgba(255,74,14,0.8)');
        hg.addColorStop(0.82, 'rgba(255,150,40,0.85)');
        hg.addColorStop(1, 'rgba(255,224,120,0.9)');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(0, 0, R + 32 * fl, -span, span);
        ctx.lineTo(Rc, -Rs);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,70,20,0.22)'; arcBand(R, 46 * fl); ctx.fill();
        ctx.fillStyle = '#c92a08'; arcBand(R, 32); ctx.fill();
        ctx.fillStyle = '#ff4a12'; arcBand(R, 24); ctx.fill();
        ctx.fillStyle = '#ff8a2a'; arcBand(R, 15); ctx.fill();
        ctx.fillStyle = '#ffd23b'; arcBand(R, 7); ctx.fill();
        // 外沿白炽刃口
        ctx.strokeStyle = 'rgba(255,240,200,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, R + 30 * fl, -span, span); ctx.stroke();
        // 两端焰尖
        for (const sgn of [-1, 1]) {
          const hx = Math.cos(span * sgn) * R, hy = Math.sin(span * sgn) * R;
          const g2 = ctx.createRadialGradient(hx, hy, 0, hx, hy, 26 * fl);
          g2.addColorStop(0, 'rgba(255,230,150,0.95)');
          g2.addColorStop(0.5, 'rgba(255,120,30,0.6)');
          g2.addColorStop(1, 'rgba(255,60,10,0)');
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(hx, hy, 26 * fl, 0, TAU); ctx.fill();
        }
        ctx.restore();
        return;
      }
      if (k === 'foxFire') {
        // 紫手狐火弹：紫色火焰短缎带拖尾
        const fpts = this.foxPts;
        if (fpts && fpts.length > 2) {
          const n = fpts.length;
          const baseA = ctx.globalAlpha;
          ctx.save();
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(150,60,255,0.24)';
          ctx.lineWidth = 13;
          ctx.beginPath();
          ctx.moveTo(fpts[0].x, fpts[0].y);
          for (let i = 1; i < n; i++) ctx.lineTo(fpts[i].x, fpts[i].y);
          ctx.stroke();
          for (let i = 1; i < n; i++) {
            const f = i / n;
            ctx.globalAlpha = baseA * (0.12 + 0.7 * f);
            ctx.strokeStyle = '#9a3cff';
            ctx.lineWidth = 7 * (0.2 + 0.8 * f);
            ctx.beginPath();
            ctx.moveTo(fpts[i - 1].x, fpts[i - 1].y);
            ctx.lineTo(fpts[i].x, fpts[i].y);
            ctx.stroke();
          }
          ctx.globalAlpha = baseA;
          ctx.restore();
        }
        // 弹体：高速锥形紫焰（外紫光晕 → 紫主体 → 白紫芯，尖端朝飞行方向）
        const r = this.r;
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
        glow.addColorStop(0, 'rgba(180,90,255,0.6)');
        glow.addColorStop(1, 'rgba(140,40,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#5a1aa0';
        ctx.beginPath();
        ctx.moveTo(r * 1.9, 0); ctx.quadraticCurveTo(-r * 0.3, -r * 1.05, -r * 1.25, 0);
        ctx.quadraticCurveTo(-r * 0.3, r * 1.05, r * 1.9, 0); ctx.fill();
        ctx.fillStyle = '#a64dff';
        ctx.beginPath();
        ctx.moveTo(r * 1.6, 0); ctx.quadraticCurveTo(-r * 0.2, -r * 0.72, -r * 0.9, 0);
        ctx.quadraticCurveTo(-r * 0.2, r * 0.72, r * 1.6, 0); ctx.fill();
        ctx.fillStyle = '#f0d8ff';
        ctx.beginPath();
        ctx.moveTo(r * 1.1, 0); ctx.quadraticCurveTo(-r * 0.1, -r * 0.32, -r * 0.5, 0);
        ctx.quadraticCurveTo(-r * 0.1, r * 0.32, r * 1.1, 0); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'purpleFan') {
        // 紫手紫红扇形弹：紫红菱形魔光弹（黑紫描边 → 洋红主体 → 亮粉芯）
        const r = this.r;
        const a = Math.atan2(this.vy, this.vx);
        const f = 1 + Math.sin(this.t * 12) * 0.12;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2 * f);
        glow.addColorStop(0, 'rgba(255,60,160,0.5)');
        glow.addColorStop(1, 'rgba(180,40,200,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, r * 2.2 * f, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4a0f38';
        ctx.beginPath(); ctx.moveTo(r * 1.25, 0); ctx.lineTo(0, -r); ctx.lineTo(-r * 1.05, 0); ctx.lineTo(0, r);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d63a9a';
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(0, -r * 0.72); ctx.lineTo(-r * 0.78, 0); ctx.lineTo(0, r * 0.72);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff8ad0';
        ctx.beginPath(); ctx.moveTo(r * 0.5, 0); ctx.lineTo(0, -r * 0.34); ctx.lineTo(-r * 0.36, 0); ctx.lineTo(0, r * 0.34);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        return;
      }
      if (k === 'pCard') {
        // 紫手巨型飞牌：高速自转的紫晶卡牌（发光牌框 + 暗紫牌面 + 中心菱形魔纹）
        const w = 27, h = 38;
        const rr = (x, y, ww, hh, rad) => {
          ctx.beginPath();
          ctx.moveTo(x + rad, y);
          ctx.arcTo(x + ww, y, x + ww, y + hh, rad);
          ctx.arcTo(x + ww, y + hh, x, y + hh, rad);
          ctx.arcTo(x, y + hh, x, y, rad);
          ctx.arcTo(x, y, x + ww, y, rad);
          ctx.closePath();
        };
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
        ctx.shadowColor = 'rgba(200,80,255,0.9)'; ctx.shadowBlur = 16;
        rr(-w, -h, w * 2, h * 2, 7);
        ctx.fillStyle = '#2a1245'; ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3; ctx.strokeStyle = '#c04dff'; ctx.stroke();
        ctx.lineWidth = 1.2; ctx.strokeStyle = '#ff8ae0';
        rr(-w + 5, -h + 5, w * 2 - 10, h * 2 - 10, 5); ctx.stroke();
        // 中心发光菱形魔纹
        const cf = 1 + Math.sin(this.t * 9) * 0.18;
        ctx.fillStyle = '#ff4fc0';
        ctx.beginPath(); ctx.moveTo(0, -15 * cf); ctx.lineTo(11 * cf, 0); ctx.lineTo(0, 15 * cf); ctx.lineTo(-11 * cf, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd8f4';
        ctx.beginPath(); ctx.moveTo(0, -7 * cf); ctx.lineTo(5 * cf, 0); ctx.lineTo(0, 7 * cf); ctx.lineTo(-5 * cf, 0);
        ctx.closePath(); ctx.fill();
        // 四角小菱形
        ctx.fillStyle = '#b06bff';
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(sx * (w - 8), sy * (h - 12) - sy * 4);
          ctx.lineTo(sx * (w - 4), sy * (h - 8));
          ctx.lineTo(sx * (w - 8), sy * (h - 4));
          ctx.lineTo(sx * (w - 12), sy * (h - 8));
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        return;
      }
    }

    /** 元素弹道专用渲染：火焰=三层圆形像素火球，毒液=墨绿粘稠液团，寒冰=六棱冰锥 */
    renderElement(ctx) {
      if (this.element === 'flame') {
        drawPxFireball(ctx, this.x, this.y, this.r, this.t, this.vx, this.vy);
      } else if (this.element === 'poison') {
        drawPxPoison(ctx, this.x, this.y, this.r, this.t, this.vx, this.vy);
      } else if (this.element === 'ice') {
        drawPxIce(ctx, this.x, this.y, this.r, this.t, this.vx, this.vy);
      }
    }
  }

  /* ---------------- 闪电（预警 → 打击）：通用线段闪电，支持纵向/横向/对角 ---------------- */
  class Lightning {
    /** 通用构造：线段 (x1,y1)→(x2,y2)，w 宽度，dmg 伤害 */
    constructor(x1, y1, x2, y2, w, dmg) {
      this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
      this.w = w; this.dmg = dmg;
      this.t = 0; this.warn = 0.95; this.strike = 0.3;
      this.dealt = false; this.dead = false;
      this.src = shooterSrc();               // 击杀者归因（雷公小怪/雷公巨兽）
      this.bolt = this.makeBolt();
    }
    /** 纵向落雷（柱中心 x） */
    static vertical(x, w, dmg) {
      return new Lightning(x, -10, x, CFG.GROUND_Y + 10, w, dmg);
    }
    /** 横向闪电（水平线 y） */
    static horizontal(y, w, dmg) {
      return new Lightning(-10, y, CFG.W + 10, y, w, dmg);
    }
    /** 对角闪电：过点 (px,py)、角度 a，向两端延伸出屏 */
    static diagonal(px, py, a, w, dmg) {
      const dx = Math.cos(a), dy = Math.sin(a), L = 1600;
      return new Lightning(px - dx * L, py - dy * L, px + dx * L, py + dy * L, w, dmg);
    }
    makeBolt() {
      const pts = [];
      const len = Math.hypot(this.x2 - this.x1, this.y2 - this.y1);
      const steps = Math.max(6, Math.floor(len / 30));
      const dx = (this.x2 - this.x1) / steps, dy = (this.y2 - this.y1) / steps;
      const nl = Math.hypot(dx, dy) || 1;
      const nx = -dy / nl, ny = dx / nl;   // 法向单位向量
      for (let i = 0; i <= steps; i++) {
        const j = (i === 0 || i === steps) ? 0 : rand(-this.w / 2, this.w / 2);
        pts.push({ x: this.x1 + dx * i + nx * j, y: this.y1 + dy * i + ny * j });
      }
      return pts;
    }
    /** 点到线段距离 */
    static distSeg(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1;
      const l2 = dx * dx + dy * dy || 1;
      let t = ((px - x1) * dx + (py - y1) * dy) / l2;
      t = clamp(t, 0, 1);
      return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
    }
    update(dt, g) {
      this.t += dt;
      if (this.t >= this.warn && !this.dealt) {
        this.dealt = true;
        SFX.shock();
        g.shake(10);
        const mx = (this.x1 + this.x2) / 2, my = (this.y1 + this.y2) / 2;
        burst(g, mx, my, 18, ['#ffe066', '#fff', '#7fe7ff'], 260, 5, 0.5, 200);
        const p = g.player;
        if (Lightning.distSeg(p.x, p.y, this.x1, this.y1, this.x2, this.y2) < this.w / 2 + p.radius * 0.7) {
          p.hurt(this.dmg, g, this.src);
        }
      }
      if (this.t > this.warn + this.strike) this.dead = true;
    }
    render(ctx) {
      if (this.t < this.warn) {
        // 预警：沿线段闪烁虚线
        const on = Math.floor(this.t * 14) % 2 === 0;
        if (on) {
          ctx.save();
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = '#ffe066';
          ctx.lineWidth = this.w * 0.8;
          ctx.lineCap = 'round';
          ctx.setLineDash([16, 14]);
          ctx.beginPath(); ctx.moveTo(this.x1, this.y1); ctx.lineTo(this.x2, this.y2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 12]);
          ctx.beginPath(); ctx.moveTo(this.x1, this.y1); ctx.lineTo(this.x2, this.y2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      } else {
        // 闪电本体：白芯 + 黄边
        const a = clamp(1 - (this.t - this.warn) / this.strike, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = this.w * 0.5;
        ctx.beginPath();
        this.bolt.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke();
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = this.w * 0.22;
        ctx.beginPath();
        this.bolt.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ---------------- 长线光束（预警 → 沿线打击） ---------------- */
  class Beam {
    /** (x,y) 起点，a 方向角，len 长度，w 光束宽；rockBreak：光束触山炸毁山石 */
    constructor(x, y, a, len, w, dmg, warn, rockBreak) {
      this.x = x; this.y = y; this.a = a; this.len = len; this.w = w;
      this.dmg = dmg;
      this.t = 0; this.warn = warn || 0.7; this.active = 0.35;
      this.dealt = false; this.dead = false;
      this.rockBreak = !!rockBreak;
      this.src = shooterSrc();               // 击杀者归因（小超人/Boss 激光）
    }
    end() {
      return { x: this.x + Math.cos(this.a) * this.len, y: this.y + Math.sin(this.a) * this.len };
    }
    update(dt, g) {
      this.t += dt;
      if (this.t >= this.warn && !this.dealt) {
        this.dealt = true;
        SFX.zap(); g.shake(8);
        const p = g.player;
        const e = this.end();
        const dx = e.x - this.x, dy = e.y - this.y;
        const t = clamp(((p.x - this.x) * dx + (p.y - this.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        const cx = this.x + dx * t, cy = this.y + dy * t;
        burst(g, cx, cy, 10, ['#ff5252', '#fff', '#ffd23b'], 200, 4, 0.35);
        if (Math.hypot(p.x - cx, p.y - cy) < this.w / 2 + p.radius * 0.7) {
          p.hurt(this.dmg, g, this.src);
        }
        // 光束触山：沿光路采样，命中即炸毁山石
        if (this.rockBreak) {
          for (const r of g.rocks) {
            if (r.dead) continue;
            for (let s = 0; s <= 1.001; s += 0.08) {
              const sx = this.x + Math.cos(this.a) * this.len * s;
              const sy = this.y + Math.sin(this.a) * this.len * s;
              if (r.contains(sx, sy, 8)) {
                burst(g, sx, sy, 18, ['#7d8794', '#a7b3c2', '#fff', '#ff7b2e'], 260, 6, 0.6, 220);
                r.destroy(g);
                break;
              }
            }
          }
        }
      }
      if (this.t > this.warn + this.active) this.dead = true;
    }
    render(ctx) {
      const e = this.end();
      ctx.save();
      if (this.t < this.warn) {
        // 预警虚线
        const on = Math.floor(this.t * 14) % 2 === 0;
        if (on) {
          ctx.strokeStyle = 'rgba(255,70,70,0.8)';
          ctx.lineWidth = 3;
          ctx.setLineDash([12, 10]);
          ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(e.x, e.y); ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        // 光束本体：白芯 + 红晕，随时间淡出
        const a = clamp(1 - (this.t - this.warn) / this.active, 0, 1);
        ctx.globalAlpha = a;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ff5252'; ctx.lineWidth = this.w;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(e.x, e.y); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = this.w * 0.4;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(e.x, e.y); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  /* ---------------- S 型弧线激光（大王眼珠攻击：自眼睛射向屏幕左缘随机落点） ---------------- */
  class CurveBeam {
    /** (x,y) 起点（眼睛）；(ex,ey) 终点（屏幕左缘落点）；amp S 波幅；w 束宽；dmg 伤害；warn 预警秒数 */
    constructor(x, y, ex, ey, amp, w, dmg, warn) {
      this.x = x; this.y = y; this.ex = ex; this.ey = ey;
      this.w = w; this.dmg = dmg;
      this.t = 0; this.warn = warn || 1.0; this.active = 0.45;
      this.dealt = false; this.dead = false;
      this.src = shooterSrc();               // 击杀者归因（大王眼珠激光）
      this.pts = this.makePath(amp);
    }
    /** 三次贝塞尔 S 曲线：1/3、2/3 处控制点沿法向反向偏移（控制点 y 钳制在屏内，凸包保证整条曲线不出界） */
    makePath(amp) {
      const S = { x: this.x, y: this.y }, E = { x: this.ex, y: this.ey };
      const dx = E.x - S.x, dy = E.y - S.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;            // 法向单位向量
      const s1 = rand(0.85, 1.25) * (Math.random() < 0.5 ? 1 : -1);
      const s2 = -s1 * rand(0.8, 1.15);              // 反向偏移 → S 形
      const P1 = {
        x: S.x + dx / 3 + nx * amp * s1,
        y: clamp(S.y + dy / 3 + ny * amp * s1, 70, CFG.GROUND_Y - 40)
      };
      const P2 = {
        x: S.x + dx * 2 / 3 + nx * amp * s2,
        y: clamp(S.y + dy * 2 / 3 + ny * amp * s2, 70, CFG.GROUND_Y - 40)
      };
      const N = 44, pts = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, u1 = 1 - u;
        const a = u1 * u1 * u1, b = 3 * u1 * u1 * u, c = 3 * u1 * u * u, d = u * u * u;
        pts.push({
          x: a * S.x + b * P1.x + c * P2.x + d * E.x,
          y: a * S.y + b * P1.y + c * P2.y + d * E.y
        });
      }
      return pts;
    }
    /** 玩家是否贴近曲线（grow<1 时只检测已射出的前段折线） */
    hitTest(p, grow) {
      const n = grow ? Math.max(2, Math.floor(this.pts.length * grow)) : this.pts.length;
      const R = this.w / 2 + p.radius * 0.7;
      for (let i = 1; i < n; i++) {
        const a = this.pts[i - 1], b = this.pts[i];
        if (Lightning.distSeg(p.x, p.y, a.x, a.y, b.x, b.y) < R) return true;
      }
      return false;
    }
    update(dt, g) {
      this.t += dt;
      if (this.t >= this.warn && !this.dealt) {
        this.dealt = true;
        SFX.zap(); g.shake(8);
        const p = g.player;
        if (this.hitTest(p, 1)) p.hurt(this.dmg, g, this.src);
        // 落点冲击爆发 + 眼部发射闪光
        burst(g, this.ex, this.ey, 12, ['#ff5252', '#fff', '#ffd23b'], 220, 5, 0.4);
        burst(g, this.x, this.y, 8, ['#ff5252', '#fff'], 160, 4, 0.3);
      }
      if (this.t > this.warn + this.active) this.dead = true;
    }
    tracePath(ctx, grow) {
      const n = grow ? Math.max(2, Math.floor(this.pts.length * grow)) : this.pts.length;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const pt = this.pts[i];
        i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y);
      }
    }
    render(ctx) {
      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (this.t < this.warn) {
        // 预警：沿 S 曲线闪烁红色虚线
        const on = Math.floor(this.t * 12) % 2 === 0;
        if (on) {
          ctx.strokeStyle = 'rgba(255,70,70,0.85)';
          ctx.lineWidth = 3;
          ctx.setLineDash([14, 12]);
          this.tracePath(ctx, 1); ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        // 光束本体：自眼睛沿 S 曲线快速射出，白芯 + 红晕，随时间淡出
        const a = clamp(1 - (this.t - this.warn) / this.active, 0, 1);
        const grow = clamp((this.t - this.warn) / 0.12, 0.15, 1);
        ctx.globalAlpha = a;
        this.tracePath(ctx, grow);
        ctx.strokeStyle = '#ff5252'; ctx.lineWidth = this.w; ctx.stroke();
        this.tracePath(ctx, grow);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = this.w * 0.4; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  /* ---------------- 玩家：飞虎 ---------------- */
  class Player {
    /** charId：出战角色 id（见 characters.js），默认小白 */
    constructor(charId) {
      const CH = window.CHARS;
      this.charId = (CH && CH.has(charId)) ? charId : 'xiaobai';
      this.char = CH ? CH.get(this.charId) : null;
      const cdef = this.char || {};
      this.x = 160; this.y = CFG.H / 2;
      this.vx = 0; this.vy = 0;
      this.radius = CFG.player.radius;
      this.maxHp = CFG.player.baseHp;
      this.hp = this.maxHp;
      this.dmg = cdef.dmg !== undefined ? cdef.dmg : CFG.player.baseDmg;   // 角色基础伤害
      this.speedMul = cdef.speedMul || 1;             // 角色速度倍率
      this.fireInt = CFG.player.fireInterval * (cdef.fireMul || 1);   // 角色射速（射击间隔）
      this.bulletSpdMul = cdef.bulletSpd || 1;        // 角色子弹飞行速度倍率（反弹类弹种较慢）
      this.kind = cdef.kind || 'bolt';                // 角色弹种
      this.charBulletLv = 0;                          // 角色子弹成长（0-3，第 4 阶为最终形态）
      this.bounceMax = cdef.bounceBase || 0;          // 反弹类弹种的基础反弹次数
      this.magicShieldT = 0;                          // 法师魔法护盾剩余时间
      this.bloodRageT = 0;                            // 战狂血怒剩余时间
      this.rageBoost = 0;                             // 血怒期间累计受到的伤害（转化为弹幕增伤）
      this.bulletCount = 1;
      this.bulletSpeedMul = 1;
      this.bulletTier = 0;
      this.bombLv = 0;
      this.sizeMul = 1;
      this.magnetRange = 150;   // 宝石引力范围（可由强化扩大）
      this.magnetLv = 0;
      // 强化等级（用于 UI 显示）
      this.lifeLv = 0; this.atkLv = 0; this.wayLv = 0;
      this.spdLv = 0; this.tierLv = 0;
      this.fireT = 0;
      this.wingT = 0;
      this.meleeT = 0;        // >0 正在近战挥击
      this.cdT = 0;           // 近战冷却
      this.invT = 0;
      this.meleeHit = null;
      this.faceTilt = 0;
      this.downT = 0;        // 被标枪击落：失控坠落+翻滚倒计时
      this.downSpin = 0;     // 击落翻滚角度
      // 大招（怒气）
      this.rage = 0;
      // 额外弹道解锁
      this.tailWay = false;   // 尾部向后弹道
      this.downWay = false;   // 下部向下弹道
      // 元素弹道（击败 Boss 后解锁）：火/冰/毒每种最多 3 条，第 1 条朝前、第 2 条朝下、第 3 条朝后
      // 满配 = 3火+3冰+3毒共 9 条，每个方向恰好火/冰/毒各 1 条，三向独立齐射（不依赖主武器 tailWay/downWay）
      this.elemWays = { front: [], down: [], back: [] };  // 各向元素队列（每向最多3条、每种元素至多1条）
      this.elemCds  = { front: [], down: [], back: [] };  // 与各向队列平行的独立冷却（火焰3s/寒冰2s；毒液0=随主射速）
      this.elementWay = [];                               // 三向拼接镜像（front+down+back），供数量/持有统计复用
      // 元素精通等级（三选一成长，0-3；决定元素弹 DoT 系数/持续/冻结时长）
      this.elemLv = { flame: 0, poison: 0, ice: 0 };
      // 闪电子弹（闪电链）
      this.chainJumps = 0;    // 链接敌人数量（0=未解锁）
      this.chainDmgLv = 0;    // 闪电伤害强化等级
      // 防护刀刃（环绕光剑）
      this.blades = 0;        // 环绕光剑数量
      this.bladeDmgLv = 0;    // 刀刃伤害强化等级
      this.bladeLenLv = 0;    // 剑刃延展等级（0-2，长度倍率 1/2/3）
      this.bladeAng = 0;      // 环绕角速度累计
      this.bladeCd = new Map();  // 刀刃命中敌人的冷却（键：敌人对象）
      // 生命条数（初始 3 条，上限 3 条）
      this.lives = 3;
      this.maxLives = 3;
      // 防护罩（成长解锁）
      this.shieldLv = 0;        // 0 = 未解锁
      this.shieldChance = 0;    // 受伤时激活概率
      this.shieldRLv = 0;       // 护罩强化等级（1-10，决定抵挡次数/冲击波/移速）
      this.shieldActive = false;// 护罩激活中
      this.shieldCharges = 0;   // 剩余抵挡次数
      this.shieldT = 0;         // 激活剩余时间
      this.shieldFlash = 0;     // 激活/破碎特效计时
      // 移动速度强化
      this.moveSpdLv = 0;
      // 受伤闪红
      this.hurtFlash = 0;

      // 角色自动技能状态（触发条件/冷却与小白爪击一致：接触敌人触发、3 秒冷却）
      this.autoSkill = null;          // 'dash'|'shield'|'throw'|'armor'|'laser'|null
      this.dashVx = 0;                // 侠客突刺水平速度
      this.dashPrevX = this.x; this.dashPrevY = this.y;
      this.rainbowShieldT = 0;        // 法师彩虹护盾剩余时间
      this.thrown = null;             // 浪客：被摔投的敌人 { e, vx, vy, bounces }
      this.bloodArmorT = 0;           // 战狂血铠剩余时间
      this.laserT = 0;                // 超猫激光剩余时间
      this.laserTarget = null;        // 激光锁定的目标敌人
      this._laserCd = new Map();      // 激光对单体伤害节流（敌人 → 下次可命中时间）
      this.heldBeamT = 0;             // 超猫最终形态：身前持续贯穿光束剩余时间（开火时不断刷新）
      this._heldBeamCd = new Map();   // 持续光束对单体伤害节流（敌人 → 下次可命中时间）
      this._heldBeamDmg = 0;          // 持续光束每跳伤害（取最近一次开火的单发伤害）
      this._heldBeamScale = 1;        // 持续光束尺寸缩放（随角色体积）
    }

    /** 刀刃长度倍率（剑刃延展：1/2/3 倍） */
    get bladeLenMul() { return 1 + (this.bladeLenLv || 0); }

    /** 刀刃 i 当前位置/角度（沿轨道环绕飞虎；延展后轨道半径同步增大） */
    bladePos(i) {
      const R = CFG.blade.orbitR * this.bladeLenMul * (0.9 + this.sizeMul * 0.15);
      const a = this.bladeAng + (TAU / this.blades) * i;
      return { x: this.x + Math.cos(a) * R, y: this.y + Math.sin(a) * R, a };
    }

    /** 防护刀刃：旋转伤害接触敌人 + 50% 概率格挡敌方子弹（导弹被剑击中 1 次必爆） */
    updateBlades(dt, g) {
      if (this.blades <= 0) return;
      this.bladeAng += CFG.blade.spin * dt;
      const dmg = CFG.blade.baseDmg + CFG.blade.dmgPerLv * (this.bladeDmgLv - 1);
      const lenMul = this.bladeLenMul;
      // 接触敌人造成伤害（命中冷却按剑数分摊：剑越多，同一敌人受击越频繁；草龙按最近露出节判定）
      const cdInterval = 0.5 / Math.max(1, this.blades);
      g.targets().forEach(e => {
        if (e.dead) return;
        if (e.isBoss && (e.state === 'enter' || e.state === 'trans' || e.state === 'phaseTrans')) return;   // Boss 入场/转场免伤
        for (let i = 0; i < this.blades; i++) {
          const bp = this.bladePos(i);
          let hx = null, hy = null;
          if (e.segments) {
            const ne = e.nearestExposed(bp.x, bp.y);
            if (ne && Math.hypot(ne.x - bp.x, ne.y - bp.y) < CFG.blade.hitR + e.radius * 0.8) {
              hx = ne.x; hy = ne.y;
            }
          } else {
            const rr = (CFG.blade.hitR + e.radius) * (0.7 + lenMul * 0.3);
            if ((e.x - bp.x) ** 2 + (e.y - bp.y) ** 2 < rr * rr) { hx = e.x; hy = e.y; }
          }
          if (hx !== null) {
            const now = g.time;
            if (now - (this.bladeCd.get(e) ?? -1) > cdInterval) {
              this.bladeCd.set(e, now);
              const kb = { x: Math.cos(bp.a) * 150, y: Math.sin(bp.a) * 150 };
              if (e.segments) e.damageAt(hx, hy, dmg, g);
              else e.takeDamage(dmg, g, kb);
              burst(g, hx, hy, 5, ['#7fe7ff', '#fff'], 160, 3, 0.25);
            }
            break;
          }
        }
      });
      // 格挡敌方子弹：单颗子弹仅判定一次；导弹被剑擦中立即引爆
      for (const b of g.bullets) {
        if (b.friendly || b.dead || b.neutralized || b.bladeRolled) continue;
        for (let i = 0; i < this.blades; i++) {
          const bp = this.bladePos(i);
          const rr = (CFG.blade.blockR + b.r) * (0.7 + lenMul * 0.3);
          if ((b.x - bp.x) ** 2 + (b.y - bp.y) ** 2 < rr * rr) {
            // 导弹发射后的无敌时间内：剑也无法引爆，留待后续帧再判定
            if (b.kind === 'missile' && b.invuln > 0) break;
            b.bladeRolled = true;
            if (b.kind === 'missile') {
              // 旋转剑击中导弹：1 次必定引爆
              b.dead = true;
              g.shellBlast(b.x, b.y, b.dmg);
            } else if (Math.random() < CFG.blade.blockChance) {
              b.dead = true;
              burst(g, b.x, b.y, 6, ['#7fe7ff', '#fff', '#ffd93b'], 180, 4, 0.3);
              SFX.melee();
            }
            break;
          }
        }
      }
    }

    /** 大招：怒气满时释放强光波 */
    tryUltimate(g) {
      if (this.rage < CFG.ultimate.rageMax) return false;
      this.rage = 0;
      g.castUltimate();
      return true;
    }
    get isMeleeing() { return this.meleeT > 0; }
    get meleeReady() { return this.meleeT <= 0 && this.cdT <= 0; }

    startMelee(g) {
      this.meleeT = CFG.player.meleeDuration;
      this.invT = Math.max(this.invT, CFG.player.meleeDuration + 0.15);
      this.meleeHit = new Set();
      SFX.melee();
      g.shake(4);
      const range = CFG.player.meleeRange * (0.9 + this.sizeMul * 0.35);
      // 爪痕挥击火花
      for (let i = 0; i < 10; i++) {
        const a = rand(-0.95, 0.95);
        g.particles.push(new Particle(
          this.x + 34 * this.sizeMul, this.y + rand(-24, 24) * this.sizeMul,
          Math.cos(a) * rand(200, 380), Math.sin(a) * rand(200, 380),
          rand(0.14, 0.3), rand(3, 5),
          Math.random() < 0.4 ? '#ffd93b' : '#ffffff'));
      }
      // 立即判定一次：前方扇形（草龙按最近露出节判定）
      const targets = g.targets();
      const meleeDmg = CFG.player.meleeDmg + this.dmg * 0.4;
      targets.forEach(e => {
        let px, py;
        if (e.segments) {
          const ne = e.nearestExposed(this.x, this.y);
          if (!ne) return;
          px = ne.x; py = ne.y;
        } else { px = e.x; py = e.y; }
        const dx = px - this.x, dy = py - this.y;
        const d = Math.hypot(dx, dy);
        if (d < range + e.radius) {
          this.meleeHit.add(e);
          if (e.segments) e.damageAt(px, py, meleeDmg, g);
          else e.takeDamage(meleeDmg, g,
            { x: (dx / (d || 1)) * 320, y: (dy / (d || 1)) * 320 });
          burst(g, px, py, 6, ['#fff', '#ffd93b', '#f7941d'], 160, 4, 0.3);
        }
      });
    }

    /** 屏幕内最近的敌人（Boss 入场/转场期跳过；死亡演出中的单位跳过） */
    nearestEnemy(g) {
      let best = null, bestD = Infinity;
      for (const e of g.targets()) {
        if (e.dead || e.dying) continue;
        if (e.isBoss && (e.state === 'enter' || e.state === 'trans' || e.state === 'phaseTrans')) continue;
        const px = e.x, py = e.y;
        const d = (px - this.x) ** 2 + (py - this.y) ** 2;
        if (d < bestD) { bestD = d; best = e; }
      }
      return best;
    }

    /** 自动技能分发：按出战角色触发对应默认技能（触发/冷却与小白爪击一致） */
    startAutoSkill(g, enemy) {
      const id = this.charId;
      if (id === 'xiake') return this.startDashThrust(g);
      if (id === 'mofashi') return this.startRainbowShield(g);
      if (id === 'buliang') return this.startThrowEnemy(g, enemy);
      if (id === 'jiaodoushi') return this.startBloodArmor(g);
      if (id === 'chaoren') return this.startTeleportLaser(g, enemy);
      return this.startMelee(g);
    }

    /* ===== 侠客：疾风突刺 ===== */
    startDashThrust(g) {
      this.autoSkill = 'dash';
      this.meleeT = 0.35;                          // 突刺持续；结束后才进 3s 冷却
      this.invT = Math.max(this.invT, 0.55);        // 突刺全程无敌
      this.meleeHit = new Set();
      this.dashVx = 700;                            // 突刺水平速度（原1450→1050→700，下调）
      this.dashPrevX = this.x; this.dashPrevY = this.y;
      SFX.melee();
      g.shake(5);
      g.toast('🗡️ 疾风突刺！', 1.1);
    }

    /* ===== 魔法师：彩虹护盾 ===== */
    startRainbowShield(g) {
      this.autoSkill = 'shield';
      this.meleeT = 2.0;                            // 护盾 2s；碎掉后才进冷却
      this.invT = Math.max(this.invT, 2.0);
      this.rainbowShieldT = 2.0;
      SFX.melee();
      g.shake(4);
      g.toast('✨ 彩虹护盾展开！', 1.1);
    }

    /* ===== 浪客：过肩摔 ===== */
    startThrowEnemy(g, enemy) {
      this.autoSkill = 'throw';
      this.meleeT = 0.5;                            // 摔投动作持续；结束后进冷却
      this.invT = Math.max(this.invT, 0.45);
      if (enemy && !enemy.dead && !enemy.isBoss && !enemy.segments) {
        const a = rand(-0.45, 0.45);
        this.thrown = {
          e: enemy,
          vx: Math.cos(a) * 920,
          vy: Math.sin(a) * 920 - 240,
          bounces: 0
        };
        enemy.throwByPlayer = true;
        enemy.spawnInvuln = 0;
      }
      SFX.melee();
      g.shake(6);
      g.toast('💥 过肩摔！', 1.1);
    }

    /* ===== 战狂：血怒铠甲 ===== */
    startBloodArmor(g) {
      this.autoSkill = 'armor';
      this.meleeT = 4.0;                            // 铠甲 4s；结束后才进冷却
      this.bloodArmorT = 4.0;
      // 不设 invT：子弹命中可被铠甲转化为红色剑气反弹
      SFX.melee();
      SFX.bossEnrage();
      g.shake(6);
      g.toast('🛡️ 血怒铠甲！', 1.1);
    }

    /* ===== 超猫：瞬移巨型激光 ===== */
    startTeleportLaser(g, enemy) {
      this.autoSkill = 'laser';
      this.meleeT = 5.0;                            // 激光 5s；结束后才进冷却
      this.invT = Math.max(this.invT, 5.0);
      this.laserT = 5.0;
      this.laserTarget = enemy || null;
      // 瞬移到接触敌人的斜上方（自动找空位）
      if (enemy && !enemy.dead) {
        const spots = [
          { x: enemy.x - 130, y: enemy.y - 110 },
          { x: enemy.x - 100, y: enemy.y - 140 },
          { x: enemy.x - 150, y: enemy.y - 80 },
          { x: enemy.x - 90, y: enemy.y - 120 }
        ];
        for (const s of spots) {
          let ok = s.x >= 60 && s.x <= CFG.W - 60 && s.y > CFG.TOP_Y + 10 && s.y < CFG.GROUND_Y - 50;
          for (const r of g.rocks) { if (r.contains(s.x, s.y, 28)) { ok = false; break; } }
          if (ok) {
            // 残影
            for (let i = 0; i < 6; i++) {
              g.particles.push(new Particle(this.x + rand(-16, 16), this.y + rand(-16, 16),
                rand(-40, 40), rand(-40, 40), rand(0.18, 0.32), rand(5, 9), '#35e0ff'));
            }
            this.x = s.x; this.y = s.y;
            for (let i = 0; i < 6; i++) {
              g.particles.push(new Particle(this.x + rand(-16, 16), this.y + rand(-16, 16),
                rand(-40, 40), rand(-40, 40), rand(0.18, 0.32), rand(5, 9), '#a5f3fc'));
            }
            break;
          }
        }
      }
      SFX.melee();
      g.shake(8);
      g.toast('🦸 巨型红色激光！', 1.1);
    }

    /** 受伤：魔法护盾直接免疫；血怒期间照常受创但不会死亡（转化为弹幕增伤）。
     *  防护罩：未激活时按概率激活；激活期间完全抵挡伤害并消耗抵挡次数，次数耗尽破碎释放金色冲击波。
     *  死亡时消耗生命条数。返回 false=无敌帧未命中（或本次伤害被护罩抵挡）。
     *  src：击杀者归因 { k:'e'小怪|'b'Boss|'env'环境, key }，供死亡死法文案使用 */
    hurt(amount, g, src) {
      if (this.invT > 0 || this.magicShieldT > 0) return false;
      let amt = Math.max(1, Math.round(amount));
      if (src) g.lastHurtSrc = src;   // 记录最近一次伤害来源（死亡时归因）
      // 防护罩：未激活时按概率激活；激活后完全抵挡本次伤害
      if (this.shieldLv > 0) {
        if (!this.shieldActive && Math.random() < this.shieldChance) this.activateShield(g);
        if (this.shieldActive) {
          this.shieldCharges--;
          this.shieldFlash = 0.4;
          SFX.zap();
          burst(g, this.x, this.y, 12, ['#ffd23b', '#fff', '#ffe9a8'], 200, 4, 0.4);
          if (this.shieldCharges <= 0) this.breakShield(g);
          return false;   // 本次伤害被护罩抵挡（不触发受击无敌/受伤归因/敌方回血等回调）
        }
      }
      // 血怒：累计受到的伤害转化为弹幕伤害提升（最高 3 倍）
      if (this.bloodRageT > 0) this.rageBoost += amt;
      this.hp -= amt;
      this.invT = CFG.player.invincibleTime;
      this.hurtFlash = 0.4;
      SFX.hurt();
      g.shake(8);
      burst(g, this.x, this.y, 10, ['#ff5252', '#fff'], 180, 4, 0.4);
      if (this.hp <= 0) {
        if (this.bloodRageT > 0) { this.hp = 1; }   // 血怒期间不会死亡
        else { this.hp = 0; this.die(g); }
      }
      if (window.Ach) window.Ach.evt('playerHurt', { g: g, amt: amt, src: src });
      return true;
    }

    /** 护罩激活：按护罩强化等级获得抵挡次数 */
    activateShield(g) {
      const def = CFG.shield.levels[Math.min(10, Math.max(1, this.shieldRLv))];
      this.shieldActive = true;
      this.shieldCharges = def.blocks;
      this.shieldT = CFG.shield.activeTime;
      this.shieldFlash = 0.55;
      burst(g, this.x, this.y, 16, ['#ffd23b', '#fff5d0', '#fff'], 220, 5, 0.5);
    }

    /** 护罩破碎：金色护罩溶解并喷出冲击波（仅对小怪生效：击退 / 减速 / Lv10 微量伤害；Boss 免疫） */
    breakShield(g) {
      this.shieldActive = false;
      this.shieldT = 0;
      this.shieldFlash = 0.55;
      const def = CFG.shield.levels[Math.min(10, Math.max(1, this.shieldRLv))] || {};
      const w = def.wave;
      g.fxRings.push({ x: this.x, y: this.y, r: 12, vr: 460 * (def.radius || 1), t: 0, life: 0.5, col: '#ffd23b' });
      burst(g, this.x, this.y, 26, ['#ffd23b', '#fff5d0', '#fff', '#ffb300'], 320, 6, 0.6, 130);
      SFX.explode(false);
      g.shake(6);
      if (w) {
        const R = 130 * (def.radius || 1);
        g.targets().forEach(e => {
          if (e.dead || e.isBoss || e.segments) return;   // 冲击波仅小怪生效
          const dx = e.x - this.x, dy = e.y - this.y;
          const d = Math.hypot(dx, dy);
          if (d < R + (e.radius || 16)) {
            const nx = dx / (d || 1), ny = dy / (d || 1);
            if (w.dmg) e.takeDamage(w.dmg, g, { x: nx * w.kb, y: ny * w.kb * 0.6 - 50 });
            else e.applyKb(nx * w.kb, ny * w.kb * 0.6 - 60);   // 冲击波同样受 3 次击退衰减上限约束（地面/免击退单位内部过滤）
            if (w.slow) e.slowT = Math.max(e.slowT || 0, w.slow);
            burst(g, e.x, e.y, 6, ['#ffd23b', '#fff'], 170, 4, 0.3);
          }
        });
      }
    }

    /** 当前护罩等级配置（未解锁返回 null） */
    get shieldDef() {
      return this.shieldLv > 0 ? (CFG.shield.levels[Math.min(10, Math.max(1, this.shieldRLv))] || null) : null;
    }

    /** 血怒增伤倍率：受创越多伤害越高，最高 3 倍 */
    get ultDmgMul() {
      if (this.bloodRageT > 0 && this.maxHp > 0) {
        return Math.min(3, 1 + this.rageBoost / (this.maxHp * 0.5));
      }
      return 1;
    }

    /** 阵亡：消耗一条生命原地重生，否则游戏结束 */
    die(g) {
      if (g.state !== 'playing') return;
      if (this.lives > 0) {
        this.lives--;
        if (window.Ach) window.Ach.evt('playerDeath', { g: g, src: g.lastHurtSrc });
        this.hp = this.maxHp;
        this.invT = 2.6;
        this.hurtFlash = 0;
        this.rage = CFG.ultimate.rageMax;   // 复活时怒气立刻回满，可释放大招
        SFX.explode(true);
        g.shake(14);
        g.flashT = 0.45; g.flashColor = '#ffd0d0';
        burst(g, this.x, this.y, 44, ['#f7941d', '#ffd93b', '#ff5252', '#fff'], 320, 7, 0.9, 140);
        g.toast(`${(this.char && this.char.name) || '飞喵'}阵亡！剩余生命 ×${this.lives}，重生！`, 2.2);
        // 月痕沙海关卡：原地（出生位置）复活，不切换地图
        if (g.mapId === 'moondesert') {
          this.x = CFG.W / 2;
          this.y = CFG.H / 2;
        } else {
          // 回到安全位置
          this.x = clamp(this.x, 80, 260);
          this.y = CFG.H * 0.4;
          // 复活后转移至另一张地图
          if (g.rerollMap) g.rerollMap();
        }
      } else {
        g.gameOver();
      }
    }

    /** 被倒刺标枪命中：失控坠落（sec 秒内无法操作、摔向地面并翻滚） */
    applyDown(sec) {
      if (this.downT > sec) return;
      this.downT = sec;
      this.vy = 140;
      g && g.shake && g.shake(5);
    }

    update(dt, g) {
      // 计时
      this.wingT += dt;
      this.invT = Math.max(0, this.invT - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      this.shieldFlash = Math.max(0, this.shieldFlash - dt);
      this.downT = Math.max(0, this.downT - dt);   // 击落状态倒计时
      // 护罩激活倒计时：超时未破碎则静默消散
      if (this.shieldT > 0) {
        this.shieldT -= dt;
        if (this.shieldT <= 0) { this.shieldT = 0; this.shieldActive = false; this.shieldCharges = 0; }
      }
      // 角色大招状态计时：魔法护盾 / 血怒（血怒结束清空增伤累计）
      const wasRage = this.bloodRageT;
      this.magicShieldT = Math.max(0, this.magicShieldT - dt);
      this.bloodRageT = Math.max(0, this.bloodRageT - dt);
      if (wasRage > 0 && this.bloodRageT <= 0) this.rageBoost = 0;
      if (this.meleeT > 0) this.meleeT -= dt;
      if (this.cdT > 0) {
        this.cdT -= dt;
        if (this.cdT <= 0 && this.meleeT <= 0) this.cdT = 0;
      }
      if (this.meleeT <= 0 && this.wasMeleeing) { this.cdT = CFG.player.meleeCooldown; this.wasMeleeing = false; }
      if (this.meleeT > 0) this.wasMeleeing = true;

      // 被深海恶霸铁钩钩住：钩体消亡/失效时安全解绑（位置由铁钩拖拽接管）
      if (this.hookedBy && (this.hookedBy.dead || this.hookedBy.neutralized ||
          !g.bullets.includes(this.hookedBy))) {
        this.hookedBy = null;
      }
      // 移动：按开局选择的操作模式 —— 键盘模式仅键盘，鼠标模式仅鼠标
      let mx = 0, my = 0;
      if (g.ctrlMode === 'mouse' && g.mouse && g.mouse.active) {
        // 鼠标引导：朝鼠标位置飞行，靠近后停住（死区 12px）
        const dx = g.mouse.x - this.x, dy = g.mouse.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d > 12) { mx = dx / d; my = dy / d; }
      } else {
        if (g.keys.up) my -= 1;
        if (g.keys.down) my += 1;
        if (g.keys.left) mx -= 1;
        if (g.keys.right) mx += 1;
        if (mx || my) { const l = Math.hypot(mx, my); mx /= l; my /= l; }
      }
      // 被标枪击落：禁用飞行输入（失控）
      if (this.downT > 0) { mx = 0; my = 0; }
      // Boss 入场演出：禁用玩家输入（由演出逻辑自动移动）
      if (g.bossIntro) { mx = 0; my = 0; }
      // 被铁钩钩住拖走：禁用飞行输入
      if (this.hookedBy) { mx = 0; my = 0; }
      // 护罩存在期间移速加成（护罩强化 Lv5/Lv8）
      const shieldSpd = (this.shieldActive && this.shieldDef && this.shieldDef.spd) ? this.shieldDef.spd : 0;
      const spd = CFG.player.speed * (this.speedMul || 1) * (1 + (this.sizeMul - 1) * 0.08)
        * (1 + (this.moveSpdLv || 0) * 0.12) * (1 + shieldSpd);
      if (this.downT > 0) {
        // 失控下坠：加速落到地面后瘫坐，同时持续翻滚
        this.downSpin += dt * 13;
        this.vx *= 0.9;
        const gyD = g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y;
        const floor = gyD - this.radius * 0.5;
        if (this.y < floor - 1) this.vy = Math.min(780, this.vy + 2400 * dt);
        else { this.vy = 0; this.y = floor; }
      } else if (this.hookedBy) {
        // 被铁钩拖走中：速度清零，位置完全由铁钩接管（不做自主位移/环境推力）
        this.downSpin = 0;
        this.vx = 0; this.vy = 0;
      } else {
        this.downSpin = 0;
        this.vx = mx * spd; this.vy = my * spd;
      }
      if (!this.hookedBy) {
        // 环境推力（海底水流 / 雪地暴风雪：弱于满速，可逆向操作对抗）
        const ef = g.envForce || null;
        this.x += (this.vx + (ef ? ef.x : 0)) * dt;
        this.y += (this.vy + (ef ? ef.y : 0)) * dt;
      }
      this.radius = CFG.player.radius;   // 碰撞体固定：生命强化只放大视觉体型，不放大受击判定
      this.x = clamp(this.x, 40, CFG.W - 60);
      // 危险地面高度：大海为波动海平面（g.groundYAt），其余地图为固定地面
      const isSea = !!(g.map && g.map.sea);
      const isCloudSea = !!(g.map && g.map.cloudSea);
      const gy = g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y;
      this.y = clamp(this.y, CFG.TOP_Y, gy - this.radius * 0.5);
      this.faceTilt += (clamp(this.vy / 900, -0.25, 0.25) - this.faceTilt) * Math.min(1, dt * 10);

      /* ===== 角色自动技能持续效果 ===== */
      // 侠客疾风突刺：高速前冲 + 飞叶拖尾 + 路径刀光/伤害/破障（被铁钩拖走期间不触发位移）
      if (this.autoSkill === 'dash' && this.meleeT > 0 && !this.hookedBy) {
        this.dashPrevX = this.x; this.dashPrevY = this.y;
        this.x += this.dashVx * dt;
        // 冲出屏幕边缘 → 瞬移到屏幕左侧中间
        if (this.x > CFG.W - 50 || this.x < 30) {
          this.x = 90; this.y = CFG.H / 2;
          burst(g, this.x, this.y, 20, ['#2fb37c', '#7ed46d', '#d8ffe8', '#fff'], 260, 5, 0.32);
        }
        // 飞叶拖尾
        for (let i = 0; i < 2; i++) {
          g.particles.push(new Particle(this.x - 18, this.y + rand(-12, 12),
            rand(-70, -20), rand(-40, 40), rand(0.22, 0.4), rand(2, 4),
            ['#2fb37c', '#7ed46d', '#a8e6a3', '#d8ffe8'][randi(0, 3)]));
        }
        // 路径上的敌人：造成伤害 + 随机横/竖/斜斩击特效
        const dmg = CFG.player.meleeDmg + this.dmg * 0.5;
        g.targets().forEach(e => {
          if (e.dead || this.meleeHit.has(e)) return;
          let px = e.x, py = e.y;
          if (e.segments) { const ne = e.nearestExposed(this.x, this.y); if (!ne) return; px = ne.x; py = ne.y; }
          if (Math.abs(py - this.y) < 70 + e.radius && px > this.x - 70 && px < this.x + 70) {
            this.meleeHit.add(e);
            if (e.segments) e.damageAt(px, py, dmg, g);
            else e.takeDamage(dmg, g, { x: 460, y: rand(-120, 120) });
            // 随机斩击特效（0 横 / 1 竖 / 2 斜）
            const st = randi(0, 2);
            for (let k = 0; k < 5; k++) {
              const t = k / 4;
              let sx, sy;
              if (st === 0) { sx = px - 36 + t * 72; sy = py; }
              else if (st === 1) { sx = px; sy = py - 36 + t * 72; }
              else { sx = px - 30 + t * 60; sy = py - 30 + t * 60; }
              g.particles.push(new Particle(sx, sy, 0, 0, rand(0.18, 0.32), rand(3, 6),
                ['#ffffff', '#d8ffe8', '#7ed46d'][randi(0, 2)]));
            }
            burst(g, px, py, 8, ['#fff', '#7ed46d', '#2fb37c'], 200, 4, 0.3);
          }
        });
        // 路径上的障碍物：直接摧毁
        g.rocks.forEach(r => {
          if (r.dead) return;
          if (this.x > r.left - 30 && this.x < r.left + r.w + 30 &&
              this.y > r.top - 40 && this.y < r.baseY + 20) {
            r.destroy(g, true);
          }
        });
      }

      // 魔法师彩虹护盾：持续无敌，结束时碎裂喷出 4 颗白色星星（带彩虹拖尾）
      if (this.rainbowShieldT > 0) {
        this.rainbowShieldT = Math.max(0, this.rainbowShieldT - dt);
        if (this.rainbowShieldT <= 0) {
          const cols = ['#ff5252', '#ffd93b', '#35e0ff', '#a78bfa', '#4ade80'];
          for (let i = 0; i < 4; i++) {
            const a = rand(0, TAU);
            g.bullets.push(new Bullet(this.x, this.y,
              Math.cos(a) * rand(200, 380), Math.sin(a) * rand(200, 380),
              { kind: 'star', friendly: true, dmg: Math.round(this.dmg * 1.3), r: 7, life: 1.6,
                spinRate: 14, whiteStar: true,
                trailCols: cols, trailLite: false }));
          }
          burst(g, this.x, this.y, 26, cols.concat('#fff'), 340, 6, 0.5);
          SFX.explode(false);
          g.shake(6);
        }
      }

      // 战狂血怒铠甲：倒计时
      if (this.bloodArmorT > 0) this.bloodArmorT = Math.max(0, this.bloodArmorT - dt);

      // 浪客过肩摔：被抛出的敌人高速旋转飞行 + 反弹
      if (this.thrown) {
        const t = this.thrown;
        if (t.e.dead) { this.thrown = null; }
        else {
          t.vy += 620 * dt;
          t.e.x += t.vx * dt;
          t.e.y += t.vy * dt;
          t.e.throwSpin = (t.e.throwSpin || 0) + dt * 22;
          // 高速旋转视觉：围绕敌人的旋转粒子环
          for (let i = 0; i < 3; i++) {
            const sa = t.e.throwSpin + (i * TAU / 3);
            const sr = t.e.radius + 6;
            g.particles.push(new Particle(
              t.e.x + Math.cos(sa) * sr, t.e.y + Math.sin(sa) * sr,
              Math.cos(sa) * 60, Math.sin(sa) * 60,
              0.25, 3, ['#ff7b2e', '#ffd23b', '#fff'][i % 3]));
          }
          let bounced = false;
          const eY = g.groundYAt ? g.groundYAt(t.e.x) : CFG.GROUND_Y;
          if (t.e.x > CFG.W - t.e.radius && t.vx > 0) { t.vx = -Math.abs(t.vx) * 0.82; t.e.x = CFG.W - t.e.radius; bounced = true; }
          if (t.e.x < t.e.radius && t.vx < 0) { t.vx = Math.abs(t.vx) * 0.82; t.e.x = t.e.radius; bounced = true; }
          if (t.e.y > eY - t.e.radius && t.vy > 0) { t.vy = -Math.abs(t.vy) * 0.72; t.e.y = eY - t.e.radius; bounced = true; }
          if (t.e.y < CFG.TOP_Y + t.e.radius && t.vy < 0) { t.vy = Math.abs(t.vy) * 0.82; bounced = true; }
          if (!bounced) {
            for (const r of g.rocks) {
              if (r.dead) continue;
              if (r.contains(t.e.x, t.e.y, t.e.radius * 0.5)) {
                const cx = clamp(t.e.x, r.left, r.left + r.w);
                const cy = clamp(t.e.y, r.top, r.baseY);
                const nx = t.e.x - cx, ny = t.e.y - cy;
                const nl = Math.hypot(nx, ny) || 1;
                const dn = (t.vx * nx + t.vy * ny) / (nl * nl);
                t.vx -= 2 * dn * nx; t.vy -= 2 * dn * ny;
                t.vx *= 0.72; t.vy *= 0.72;
                r.destroy(g);
                bounced = true;
                break;
              }
            }
          }
          if (!bounced) {
            for (const e2 of g.targets()) {
              if (e2 === t.e || e2.dead) continue;
              if (e2.isBoss && (e2.state === 'enter' || e2.state === 'trans' || e2.state === 'phaseTrans')) continue;
              if (dist(t.e, e2) < t.e.radius + e2.radius) {
                const a = Math.atan2(t.e.y - e2.y, t.e.x - e2.x);
                const sp = Math.hypot(t.vx, t.vy);
                t.vx = Math.cos(a) * sp * 0.72; t.vy = Math.sin(a) * sp * 0.72;
                e2.takeDamage(Math.round(this.dmg * 1.4), g, { x: Math.cos(a) * 220, y: Math.sin(a) * 220 });
                bounced = true;
                break;
              }
            }
          }
          if (bounced) {
            t.bounces++;
            t.e.takeDamage(Math.round(this.dmg * 0.9), g);
            burst(g, t.e.x, t.e.y, 9, ['#ff7b2e', '#ffd23b', '#fff'], 200, 4, 0.32);
            SFX.hit();
            if (t.bounces >= 4) {
              t.e.takeDamage(99999, g);
              t.e.throwByPlayer = false;
              this.thrown = null;
            }
          }
          if (this.thrown && (t.e.x < -120 || t.e.x > CFG.W + 120 || t.e.y > CFG.H + 120)) {
            t.e.takeDamage(99999, g);
            t.e.throwByPlayer = false;
            this.thrown = null;
          }
        }
      }

      // 超猫巨型红色激光：向右贯穿，驱赶 + 少量伤害
      if (this.laserT > 0) {
        this.laserT = Math.max(0, this.laserT - dt);
        const now = g.time;
        const laserW = 34;
        const lx = this.x, ly = this.y;
        g.targets().forEach(e => {
          if (e.dead) return;
          if (e.isBoss && (e.state === 'enter' || e.state === 'trans' || e.state === 'phaseTrans')) return;
          let px = e.x, py = e.y;
          if (e.segments) { const ne = e.nearestExposed(lx, ly); if (!ne) return; px = ne.x; py = ne.y; }
          if (px > lx - 10 && Math.abs(py - ly) < laserW + e.radius) {
            const nextHit = this._laserCd.get(e) || 0;
            if (now >= nextHit) {
              this._laserCd.set(e, now + 0.18);
              const dmg = Math.max(3, Math.round(this.dmg * 0.35));
              if (e.segments) e.damageAt(px, py, dmg, g);
              else e.takeDamage(dmg, g, { x: 460, y: -560 });   // 向右上方强力驱赶
              burst(g, px, py, 3, ['#ff2a0a', '#ffd23b', '#fff'], 120, 2, 0.18);
            }
          }
        });
      }

      // 超猫最终形态：身前持续挂着的玫红贯穿光束（跟随玩家上下移动，不残留飞行激光）
      if (this.heldBeamT > 0) {
        this.heldBeamT = Math.max(0, this.heldBeamT - dt);
        const now = g.time;
        const bs = this._heldBeamScale || 1;
        const beamHalfW = 15 * bs;                       // 伤害半宽（与光束视觉粗度一致）
        const lx = this.x + 40 * this.sizeMul, ly = this.y - 2;
        const tickDmg = Math.max(1, Math.round(this._heldBeamDmg || this.dmg));
        const tickInt = this.fireInt || CFG.player.fireInterval;   // 与开火同频：单体每发只吃一跳
        g.targets().forEach(e => {
          if (e.dead) return;
          if (e.isBoss && (e.state === 'enter' || e.state === 'trans' || e.state === 'phaseTrans')) return;
          let px = e.x, py = e.y;
          if (e.segments) { const ne = e.nearestExposed(lx, ly); if (!ne) return; px = ne.x; py = ne.y; }
          if (px > lx - 10 && Math.abs(py - ly) < beamHalfW + e.radius) {
            const nextHit = this._heldBeamCd.get(e) || 0;
            if (now >= nextHit) {
              this._heldBeamCd.set(e, now + tickInt);
              if (e.segments) e.damageAt(px, py, tickDmg, g);
              else e.takeDamage(tickDmg, g, { x: 220, y: 0 });   // 向右轻微击退
              burst(g, px, py, 3, ['#ff2e88', '#ffa3cf', '#fff'], 130, 2.4, 0.18);
            }
          }
        });
      }

      // 地面/海面危险区：贴地持续受伤（走统一受伤通道：取整 + 防护罩判定）；海水掉血量很少
      this.groundTick = (this.groundTick || 0) + dt;
      if (this.y + this.radius * 0.72 >= gy - 4) {
        const tickInt = isSea ? CFG.map.seaTick : 0.4;
        if (this.groundTick >= tickInt) {
          this.groundTick = 0;
          if (isSea) burst(g, this.x + rand(-20, 20), gy - 2, 6, ['#bfeaff', '#7fc6ef', '#ffffff'], 130, 4, 0.4, 160);
          else if (isCloudSea) burst(g, this.x + rand(-20, 20), gy - 2, 6, ['#f6f8ff', '#dfe3f0', '#aeb6cc'], 130, 4, 0.4, 160);
          else burst(g, this.x + rand(-20, 20), CFG.GROUND_Y - 4, 5, ['#67bd57', '#ff7b2e', '#4f9e44'], 120, 4, 0.4, 200);
          const wasInv = this.invT;
          this.invT = 0;
          this.hurt(isSea ? CFG.map.seaDmg : 8, g, { k: 'env', key: isSea ? 'sea' : 'ground' });
          if (this.invT < wasInv && wasInv > 0) this.invT = 0.3;   // 未实际受伤时保留短无敌
        }
      } else this.groundTick = 0;

      // 尾部喷射火焰（移速强化等级越高：喷焰越密、越粗、越快、越持久）
      this.flameT = (this.flameT || 0) - dt;
      if (this.flameT <= 0) {
        const mlv = this.moveSpdLv || 0;
        this.flameT = 0.04 - Math.min(0.024, mlv * 0.005);
        const s = this.sizeMul;
        const nP = 1 + Math.floor(mlv / 2);          // 每喷粒子数 1-3
        for (let i = 0; i < nP; i++) {
          g.particles.push(new Particle(
            this.x - 40 * s - mlv * 3, this.y + 6 * s + rand(-6 - mlv, 6 + mlv),
            rand(-260 - mlv * 45, -140 - mlv * 22), rand(-60 - mlv * 10, 60 + mlv * 10),
            rand(0.18, 0.38) + mlv * 0.04, rand(3, 6) * s * (1 + mlv * 0.09),
            Math.random() < 0.3 ? '#ffe066' : (Math.random() < 0.55 ? '#ff7b2e' : '#e53935')));
        }
      }

      // 自动射击（近战期间停火；射速按角色射速倍率；Boss 台词演出期间全局停火）
      if (!this.isMeleeing && !g.shootDisabled) {
        // 元素弹道独立冷却（三向各自递减；火焰3s/寒冰2s；毒液 interval=0 不走冷却）
        for (const dir of ['front', 'down', 'back']) {
          const q = this.elemWays[dir];
          for (let w = 0; w < q.length; w++) {
            const eb = CFG.elementBullet[q[w]];
            if (eb && eb.interval > 0 && this.elemCds[dir][w] > 0) this.elemCds[dir][w] = Math.max(0, this.elemCds[dir][w] - dt);
          }
        }
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = this.fireInt || CFG.player.fireInterval;
          this.fire(g);
        }
      }

      // 防护刀刃：环绕光剑旋转伤害 + 格挡子弹
      this.updateBlades(dt, g);

      // 接触检测 → 自动近战 / 受伤（草龙按露出地面的龙身节逐节判定）
      g.targets().forEach(e => {
        if (e.dying) return;   // 死亡演出中（斧头兵旋转飞天）不再接触
        let touch;
        if (e.segments && e.touchesPoint) touch = e.touchesPoint(this.x, this.y, this.radius);
        else touch = dist(this, e) < this.radius + (e.radius || 16) * 0.85;
        if (touch) {
          if (this.meleeReady) {
            this.startAutoSkill(g, e);
          } else if (!this.isMeleeing && this.invT <= 0) {
            const dmg = (e.contactDamageAt ? e.contactDamageAt(this.x, this.y) : e.contactDmg);
            if (dmg) this.hurt(dmg * g.atkScale, g, e.dsrc);
            else { this.invT = Math.max(this.invT, 0.25); }   // 零接触伤害 Boss（深海恶霸）：不伤人但给短暂无敌避免反复判定
            const a = Math.atan2(this.y - e.y, this.x - e.x);
            this.x += Math.cos(a) * 22; this.y += Math.sin(a) * 22;
          }
        }
      });
    }

    /** 按角色弹种构造一发主弹（角度/位置由 fire() 计算；尾部/下部弹道复用） */
    makeCharBullet(g, x, y, vx, vy, dmg, bscale, extraA) {
      const stage = Math.min(4, this.charBulletLv + 1);   // 子弹样式阶段 1-4
      const gmax = stage >= 4;
      const glv = stage - 1;
      const slv = Math.min(glv, 2);                      // 体积成长封顶在第 3 阶（最终形态不再变大）
      const CH = window.CHARS;
      const FIN = CH && CH.FINAL[this.charId];
      const kind = this.kind;
      // 小白：原版强化弹（tier 成长线）
      if (kind === 'bolt') {
        return new Bullet(x, y, vx, vy, {
          kind: 'bolt', friendly: true, dmg,
          r: (4 + this.bulletTier * 2) * bscale,
          pierce: this.bulletTier >= 2 ? (this.bulletTier === 3 ? 4 : 2) : 0,
          bombLv: this.bombLv, tier: this.bulletTier
        });
      }
      if (kind === 'knife') {
        // 侠客飞刀：抛射线（初射角上抬），越过屏幕 50% 后受重力下落；最高形态翠绿大剑 + 树叶拖尾
        return new Bullet(x, y, vx, vy, {
          kind: 'knife', friendly: true, dmg,
          r: (5 + slv * 2.2) * bscale, glv, gmax,
          dropX: CFG.W * 0.5, dropGrav: 900,
          trailCols: gmax && FIN ? FIN.trail : null, trailLite: gmax,
          bombLv: this.bombLv, spdTrail: this.spdLv
        });
      }
      if (kind === 'star') {
        // 法师星星：持续自转 + S 形弧线（落点整体朝向不变），命中敌人/障碍分裂
        return new Bullet(x, y, vx, vy, {
          kind: 'star', friendly: true, dmg,
          r: (6 + slv * 2) * bscale, glv, gmax,
          spinRate: 14,
          sine: { amp: 0.55, freq: 7, phase: rand(0, TAU) },
          splitN: 3,
          rockReact: true,
          trailCols: gmax && FIN ? FIN.trail : null, trailLite: gmax,
          bombLv: this.bombLv
        });
      }
      if (kind === 'butt') {
        // 浪客烟头：直射，命中敌人/障碍随机方向反弹（燃点持续燃烧），触地震伤地下龙
        return new Bullet(x, y, vx, vy, {
          kind: 'butt', friendly: true, dmg,
          r: (5 + slv * 2) * bscale, glv, gmax,
          bouncesLeft: this.bounceMax, noDieOnHit: this.bounceMax > 0,
          bounceSpd: 0.4,
          rockReact: true, burnOnHit: true, groundSlam: true,
          spinRate: 6,
          fireTrail: gmax,
          trailCols: gmax && FIN ? FIN.trail : null, trailLite: gmax,
          bombLv: this.bombLv
        });
      }
      if (kind === 'shieldSaw') {
        // 战狂锯齿盾牌：抛射线（初射角上抬，越过屏幕 40% 后下落），命中敌人/障碍反弹
        return new Bullet(x, y, vx, vy, {
          kind: 'shieldSaw', friendly: true, dmg,
          r: (7 + slv * 2.4) * bscale, glv, gmax,
          bouncesLeft: this.bounceMax, noDieOnHit: this.bounceMax > 0,
          rockReact: true,
          dropX: CFG.W * 0.4, dropGrav: 760,
          spinRate: 10,
          trailCols: gmax && FIN ? FIN.trail : null, trailLite: gmax,
          bombLv: this.bombLv
        });
      }
      if (kind === 'lblock') {
        // 超猫矩形激光块（玫红）：直射；最高形态不再发射飞行激光，而是在身前持续挂出一道贯穿至屏右的粗光束
        if (gmax) {
          // 最终形态：持续光束挂在角色身前，跟随上下移动、无残留（每发开火刷新存活时间）
          this.heldBeamT = Math.max(this.heldBeamT, 0.18);
          this._heldBeamDmg = dmg;
          this._heldBeamScale = bscale;
          return null;
        }
        return new Bullet(x, y, vx, vy, {
          kind: 'lblock', friendly: true, dmg,
          r: (5 + slv * 2) * bscale, glv, gmax,
          bombLv: this.bombLv, spdTrail: this.spdLv,
          brTrail: true                              // 前 3 阶段：简单蓝红粒子拖尾
        });
      }
      if (kind === 'soul') {
        // 魅影幽魂弹：飘忽前进（正弦摆动）+ 穿透；最终形态幽冥鬼王（大体型、穿透 4 体、紫色拖尾）
        return new Bullet(x, y, vx, vy, {
          kind: 'soul', friendly: true, dmg,
          r: (6 + slv * 2) * bscale, glv, gmax,
          sine: { amp: 0.32 + glv * 0.05, freq: 6.5, phase: rand(0, TAU) },
          pierce: gmax ? 4 : 1 + Math.min(2, glv),
          spinRate: 8,
          trailCols: gmax && FIN ? FIN.trail : null, trailLite: true,
          bombLv: this.bombLv
        });
      }
      // 兜底：普通弹
      return new Bullet(x, y, vx, vy, { kind: 'bolt', friendly: true, dmg, r: 4 * bscale });
    }

    fire(g) {
      const speed = CFG.player.bulletSpeed * this.bulletSpeedMul * this.bulletSpdMul;
      const dmg = Math.round(this.dmg * this.ultDmgMul);   // 血怒等增伤
      const muzzleX = this.x + 44 * this.sizeMul;
      const muzzleY = this.y - 2;
      const bscale = 1 + (this.sizeMul - 1) * 0.3;
      const n = this.bulletCount;
      const angles = [];
      if (n === 1) angles.push((this.kind === 'shieldSaw' || this.kind === 'knife') ? -0.16 : 0);   // 飞刀/锯齿盾抛射：初射角向上微抬
      else if (n === 2) angles.push(-0.06, 0.06);
      else {
        const spread = Math.min(0.9, (n - 1) * 0.09);
        for (let i = 0; i < n; i++) angles.push(-spread / 2 + (spread / (n - 1)) * i);
      }
      const shoot = (x, y, an, spdMul) => {
        const off = (this.kind === 'shieldSaw' || this.kind === 'knife') ? -0.16 : 0;
        const b = this.makeCharBullet(
          g, x, y,
          Math.cos(an + off) * speed * spdMul, Math.sin(an + off) * speed * spdMul,
          dmg, bscale);
        if (b) g.bullets.push(b);   // 最终形态超猫无飞行弹（返回 null，改挂持续光束）
      };
      angles.forEach((an, i) => {
        const offY = (n === 2) ? (i === 0 ? -9 : 9) : (n % 2 === 0 ? (i - n / 2 + 0.5) * 8 : (i - (n - 1) / 2) * 8);
        shoot(muzzleX, muzzleY + offY, an, 1);
      });
      // 尾部弹道：向后射击 —— 完整继承正面弹道成长（弹数/扩散/弹速/穿透/爆炸）
      if (this.tailWay) {
        angles.forEach(an => {
          const b = this.makeCharBullet(
            g, this.x - 44 * this.sizeMul, muzzleY,
            -Math.cos(an) * speed * 0.95, Math.sin(an) * speed * 0.95,
            dmg, bscale);
          if (b) g.bullets.push(b);
        });
      }
      // 下部弹道：向下射击 —— 同样继承正面弹道成长（扩散方向随弹道旋转）
      if (this.downWay) {
        angles.forEach(an => {
          const b = this.makeCharBullet(
            g, this.x + 8 * this.sizeMul, this.y + 26 * this.sizeMul,
            Math.sin(an) * speed * 0.9, Math.cos(an) * speed * 0.9,
            dmg, bscale);
          if (b) g.bullets.push(b);
        });
      }
      // 元素弹道：前/下/后三向队列各自齐射（每向最多 3 条，共 9 条；独立于主武器 tailWay/downWay 解锁）
      // 火焰/寒冰有独立发射间隔（3s/2s 重炮）；毒液 interval=0 跟随主射速高频射出
      const fireElemDir = (dir) => {
        const q = this.elemWays[dir];
        const cdq = this.elemCds[dir];
        const cnt = q.length;
        for (let w = 0; w < cnt; w++) {
          const el = q[w];
          const eb = CFG.elementBullet[el];
          if (!eb) continue;
          // 独立冷却未到：该条本次不发射
          if (eb.interval > 0 && (cdq[w] || 0) > 0) continue;
          if (eb.interval > 0) cdq[w] = eb.interval;
          const off = (cnt === 1 ? 0 : (w - (cnt - 1) / 2) * 0.42);
          const slot = (cnt === 1 ? 0 : (w - (cnt - 1) / 2) * 14);   // 同向多条时的炮口排列间距
          const eSpeed = speed * eb.spdMul;
          let bx, by, vx, vy;
          if (dir === 'front') {
            // 前向：枪口向右；火焰上抛偏置 -20（弹速÷3 后与仰角同步÷3）、毒液下沉 60
            const bias = el === 'flame' ? -20 : (el === 'poison' ? 60 : 0);
            bx = muzzleX; by = muzzleY + slot;
            vx = Math.cos(off) * eSpeed;
            vy = Math.sin(off) * eSpeed + bias;
          } else if (dir === 'back') {
            // 后向：机尾向左水平镜像（×0.95），上下偏向保留
            const bias = el === 'flame' ? -20 : (el === 'poison' ? 60 : 0);
            bx = this.x - 44 * this.sizeMul; by = muzzleY + slot;
            vx = -Math.cos(off) * eSpeed * 0.95;
            vy = (Math.sin(off) * eSpeed + bias) * 0.95;
          } else {
            // 下向：机腹垂直向下（×0.9），散开角转向屏幕前方
            bx = this.x + 8 * this.sizeMul + slot; by = this.y + 26 * this.sizeMul;
            vx = Math.sin(off) * eSpeed * 0.9;
            vy = Math.cos(off) * eSpeed * 0.9;
          }
          g.bullets.push(new Bullet(
            bx, by, vx, vy,
            { kind: 'orb', friendly: true, dmg: Math.max(1, Math.round(dmg * eb.dmgMul)), r: eb.r * bscale,
              pierce: 0, element: el, life: eb.life || 4, elemPow: this.elemLv[el] || 0 }));
          // 毒液枪口：绿色浆质喷溅 + 几颗毒液颗粒（沿发射方向喷出）
          if (el === 'poison') {
            const pvx = dir === 'down' ? rand(-130, 130) : rand(120, 320) * (dir === 'back' ? -1 : 1);
            const pvy = dir === 'down' ? rand(120, 320) : rand(-130, 130);
            for (let i = 0; i < 5; i++) {
              g.particles.push(new Particle(
                bx, by + rand(-6, 6),
                pvx + (dir === 'down' ? rand(-60, 60) : 0), pvy,
                rand(0.2, 0.42), rand(2.5, 5),
                ['#2dd44a', '#4ade80', '#0a5a12', '#7dff6a'][randi(0, 3)]));
            }
          }
        }
      };
      fireElemDir('front');
      fireElemDir('down');
      fireElemDir('back');
      SFX.shoot();
    }

    render(ctx) {
      // 受击无敌闪烁
      if (this.invT > 0 && !this.isMeleeing && Math.floor(this.invT * 12) % 2 === 0) {
        // 半透明闪烁
        ctx.globalAlpha = 0.4;
      }
      // 引力领域提示（学习过引力强化时显示淡圈）
      if (this.magnetLv > 0) {
        ctx.strokeStyle = 'rgba(116,224,255,0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.magnetRange, 0, TAU);
        ctx.stroke();
      }
      // 角色主角：绘制出战角色原图（与素材 100% 一致），原图面朝右
      const art = (Sprites.charArt && Sprites.charArt[this.charId]) || Sprites.cat;
      if (art) {
        const targetLen = 92 * this.sizeMul;
        const s = targetLen / art.width;
        const w = art.width * s, h = art.height * s;
        const bodyRot = this.downT > 0 ? this.downSpin : this.faceTilt;   // 击落时翻滚
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(bodyRot);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, -w / 2, -h / 2, w, h);
        ctx.restore();
        // 受伤闪红：红色染色叠加
        if (this.hurtFlash > 0) {
          const fa = clamp(this.hurtFlash / 0.4, 0, 1);
          drawSpriteTinted(ctx, art, this.x, this.y, w, h, bodyRot, '#ff1a1a', fa * 0.82);
        }
      }
      ctx.globalAlpha = 1;

      // 法师魔法护盾：紫色旋转魔法罩（无敌）
      if (this.magicShieldT > 0) {
        const a = Math.min(1, this.magicShieldT / 0.6) * (0.75 + Math.sin(this.wingT * 9) * 0.25);
        const r = this.radius * (1.75 + Math.sin(this.wingT * 5.2) * 0.12);
        ctx.save();
        ctx.globalAlpha = clamp(a, 0, 1) * 0.85;
        ctx.strokeStyle = '#c99bff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = clamp(a, 0, 1) * 0.22;
        ctx.fillStyle = '#8b3fd0';
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        // 环绕星屑
        for (let i = 0; i < 4; i++) {
          const sa = this.wingT * 3.4 + (TAU / 4) * i;
          ctx.globalAlpha = clamp(a, 0, 1);
          ctx.fillStyle = '#ffe066';
          ctx.fillRect(this.x + Math.cos(sa) * r - 2, this.y + Math.sin(sa) * r - 2, 4, 4);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      // 战狂血怒：红色脉动光环（增伤幅度越大越亮）
      if (this.bloodRageT > 0) {
        const p = clamp(this.rageBoost / (this.maxHp * 0.5), 0, 1);
        const r = this.radius * (1.5 + Math.sin(this.wingT * 11) * 0.14);
        ctx.save();
        ctx.globalAlpha = 0.35 + p * 0.4;
        ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 3 + p * 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.14 + p * 0.2;
        ctx.fillStyle = '#e02020';
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      /* ===== 角色自动技能特效渲染 ===== */
      // 侠客突刺：路径刀光（白→翠绿渐变拖尾光带）
      if (this.autoSkill === 'dash' && this.meleeT > 0) {
        ctx.save();
        ctx.lineCap = 'round';
        // 外层翠绿光晕
        ctx.strokeStyle = 'rgba(126,212,109,0.55)';
        ctx.lineWidth = 16;
        ctx.beginPath(); ctx.moveTo(this.dashPrevX, this.dashPrevY); ctx.lineTo(this.x, this.y); ctx.stroke();
        // 中层白光
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(this.dashPrevX, this.dashPrevY); ctx.lineTo(this.x, this.y); ctx.stroke();
        ctx.restore();
      }

      // 魔法师彩虹护盾：旋转彩虹光环
      if (this.rainbowShieldT > 0) {
        const r = this.radius * (1.8 + Math.sin(this.wingT * 6) * 0.1);
        const segs = 24;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.wingT * 2.2);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        for (let i = 0; i < segs; i++) {
          const a0 = (i / segs) * TAU, a1 = ((i + 1) / segs) * TAU;
          const hue = (i / segs) * 360;
          ctx.strokeStyle = `hsla(${hue},90%,62%,0.9)`;
          ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke();
        }
        // 内层柔光
        ctx.globalAlpha = 0.18;
        const grd = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(1, 'rgba(167,139,250,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // 战狂血怒铠甲：暗红倒刺铠甲虚影
      if (this.bloodArmorT > 0) {
        const r = this.radius * (1.55 + Math.sin(this.wingT * 9) * 0.06);
        const p = clamp(this.bloodArmorT / 4, 0, 1);
        ctx.save();
        ctx.translate(this.x, this.y);
        // 暗红色铠甲底圈
        ctx.globalAlpha = 0.28 + 0.2 * p;
        ctx.fillStyle = '#5a0d0d';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#a01818';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        // 倒刺
        const spikes = 14;
        ctx.fillStyle = '#c41e1e';
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < spikes; i++) {
          const a = (i / spikes) * TAU + this.wingT * 0.8;
          const r1 = r, r2 = r + 10 + Math.sin(this.wingT * 4 + i) * 2;
          ctx.save();
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(-3, r1); ctx.lineTo(0, r2); ctx.lineTo(3, r1);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // 超猫巨型红色激光：向右贯穿的粗激光束（起点在角色前方，不遮挡角色）
      if (this.laserT > 0) {
        const lx = this.x + 40, ly = this.y;
        const L = CFG.W - lx + 20;
        const pulse = 1 + Math.sin(this.wingT * 30) * 0.12;
        const Wd = 30 * pulse;
        ctx.save();
        ctx.translate(lx, ly);
        // 外红光晕
        ctx.fillStyle = 'rgba(255,42,10,0.16)';
        ctx.fillRect(0, -Wd * 0.9, L, Wd * 1.8);
        // 红激光主体
        ctx.fillStyle = 'rgba(255,42,10,0.5)';
        ctx.fillRect(0, -Wd * 0.55, L, Wd * 1.1);
        ctx.fillStyle = '#ff2a0a';
        ctx.fillRect(0, -Wd * 0.32, L, Wd * 0.64);
        // 亮橙黄芯
        ctx.fillStyle = '#ffd23b';
        ctx.fillRect(0, -Wd * 0.16, L, Wd * 0.32);
        ctx.fillStyle = '#fff5d0';
        ctx.fillRect(0, -Wd * 0.07, L, Wd * 0.14);
        ctx.restore();
      }

      // 超猫最终形态：持续挂在身前的玫红贯穿光束（随上下移动即时跟随，无任何残留）
      if (this.heldBeamT > 0) {
        const bs = this._heldBeamScale || 1;
        const lx = this.x + 40 * this.sizeMul, ly = this.y - 2;
        const L = CFG.W - lx + 20;
        const pulse = 1 + Math.sin(this.wingT * 30) * 0.14;
        const Wd = 9 * 1.7 * bs * pulse;              // 与原最终形态激光弹粗度一致（r=9*bscale）
        ctx.save();
        ctx.translate(lx, ly);
        ctx.fillStyle = 'rgba(255,46,136,0.08)'; ctx.fillRect(0, -Wd * 0.7, L, Wd * 1.4);
        ctx.fillStyle = 'rgba(255,46,136,0.20)'; ctx.fillRect(0, -Wd * 0.48, L, Wd * 0.96);
        ctx.fillStyle = '#ff2e88'; ctx.fillRect(0, -Wd * 0.3, L, Wd * 0.6);
        ctx.fillStyle = '#ffa3cf'; ctx.fillRect(0, -Wd * 0.16, L, Wd * 0.32);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, -Wd * 0.08, L, Wd * 0.16);        // 白芯贯通
        // 枪口亮头
        ctx.fillStyle = 'rgba(255,120,180,0.55)';
        ctx.beginPath(); ctx.arc(0, 0, Wd * 0.55, 0, TAU); ctx.fill();
        ctx.restore();
      }

      // 近战爪痕：三道爪印自上而下列过前方（仅小白爪击）
      if (this.isMeleeing && !this.autoSkill) {
        const p = 1 - this.meleeT / CFG.player.meleeDuration;
        const range = CFG.player.meleeRange * (0.9 + this.sizeMul * 0.35);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          const sweep = -1.05 + p * 2.0;            // 挥扫进度：上 → 下
          const a0 = sweep + i * 0.34;
          const a1 = a0 + 0.55;
          const r0 = range * 0.42, r1 = range * (1 - Math.abs(i) * 0.12);
          const x0 = Math.cos(a0) * r0 * 0.7, y0 = Math.sin(a0) * r0 * 0.7;
          const xm = Math.cos((a0 + a1) / 2) * r1, ym = Math.sin((a0 + a1) / 2) * r1;
          const x1 = Math.cos(a1) * r1, y1 = Math.sin(a1) * r1;
          // 橙色爪痕外边
          ctx.strokeStyle = `rgba(255,120,30,${0.85 * (1 - p * 0.45)})`;
          ctx.lineWidth = 8 * this.sizeMul;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(xm, ym, x1, y1); ctx.stroke();
          // 白色爪痕内芯
          ctx.strokeStyle = `rgba(255,255,255,${0.95 * (1 - p * 0.3)})`;
          ctx.lineWidth = 3.2 * this.sizeMul;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(xm, ym, x1, y1); ctx.stroke();
        }
        ctx.restore();
      }

      // 防护罩：激活期间金色常亮护罩（呼吸感）；激活/破碎瞬间金色光罩扩散
      if (this.shieldActive) {
        const r = this.radius * 1.7;
        const pulse = 0.85 + Math.sin(this.wingT * 6) * 0.15;
        ctx.save();
        ctx.globalAlpha = 0.5 * pulse;
        ctx.strokeStyle = '#ffd23b'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.14 * pulse;
        ctx.fillStyle = '#ffd23b';
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (this.shieldFlash > 0) {
        const a = clamp(this.shieldFlash / 0.55, 0, 1);
        const r = this.radius * (1.6 + (1 - a) * 0.7);
        ctx.save();
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = '#ffd23b';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = a * 0.25;
        ctx.fillStyle = '#ffd23b';
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.restore();
      }

      // 防护刀刃：青色光剑沿轨道环绕（刀刃沿切线方向）
      if (this.blades > 0) {
        for (let i = 0; i < this.blades; i++) {
          const bp = this.bladePos(i);
          ctx.save();
          ctx.translate(bp.x, bp.y);
          ctx.rotate(bp.a + Math.PI / 2);
          const L = (17 + Math.min(this.blades, 6) * 1.2) * this.bladeLenMul;   // 光剑长度：随数量略增 + 剑刃延展（最高 3 倍）
          // 外圈光晕
          ctx.fillStyle = 'rgba(127,231,255,0.30)';
          ctx.fillRect(-6, -L, 12, L * 2);
          // 剑刃（青色）
          ctx.fillStyle = '#7fe7ff';
          ctx.fillRect(-4, -L + 2, 8, L * 2 - 4);
          // 高亮内芯
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-1.5, -L + 5, 3, L * 2 - 10);
          // 剑柄
          ctx.fillStyle = '#33506b';
          ctx.fillRect(-3, L - 5, 6, 7);
          ctx.fillStyle = '#1d2431';
          ctx.fillRect(-4, L + 1, 8, 3);
          ctx.restore();
        }
      }
    }
  }

  /* ---------------- 敌人 ---------------- */
  class Enemy {
    constructor(type, g) {
      const def = CFG.enemies[type];
      this.type = type;
      this.def = def;
      this.name = def.name;
      this.isBoss = false;
      this.dsrc = { k: 'e', key: type };   // 击杀者归因（骨龙小段按草龙死法池归并）
      this.dead = false;
      this.radius = def.radius;
      this.contactDmg = def.contact;
      this.bulletDmg = def.bulletDmg || 0;
      this.groundUnit = !!def.ground;      // 地面单位：触碰山石不坠毁
      this.t = rand(0, 10);
      this.flash = 0;
      this.hurtT = 0;          // 持续受伤红染（>0 时叠加红色 tint，不闪烁）
      this.spawnInvuln = 0;    // 出场无敌时间
      this.kbX = 0; this.kbY = 0;
      this.kbCount = 0;        // 已被击退次数（每只小怪至多被击退 3 次，力度递减，3 次后免疫）

      // 元素持续伤害（火焰/毒液/寒冰弹道命中后生效）
      this.dotT = 0;           // DoT 剩余时间
      this.dotDps = 0;         // 每秒伤害
      this.dotType = '';       // 'flame' / 'poison' / 'ice'
      this.dotStack = 0;        // 同元素异常叠层（1-5，每层 DoT +12%；过期清零）
      this.invulnBreakT = 0;   // 破无敌倒计时（归零时清除 spawnInvuln）
      this.freezeT = 0;        // 冻结时间（>0 时停止行动）
      this.confuseT = 0;       // 困惑时间（法师魔法护盾命中：困惑并下坠）
      this.confuseVy = 0;      // 困惑下坠速度

      // 元素受击视觉（命中点相对自身坐标，随实体移动；Boss 由 game 中央驱动同一套系统）
      this.burnMarks = [];     // 灼烧暗红裂纹 [{ox,oy,seed,t,life}]
      this.frostPts = [];      // 冰霜覆盖点（从命中点向外加厚）[{ox,oy,t}]
      this.poisonPts = [];     // 腐蚀斑块 [{ox,oy,seed,t,life}]
      this.dotTickT = 0;       // DoT 离散跳伤害计时（每 0.5s 一跳 + 伤害数字）
      this._ambT = 0;          // 异常身体像素（火苗/毒泡）喷发节流

      // 难度缩放
      const round = g.round;
      const hpMul = (1 + (round - 1) * 0.16 + g.time * 0.0025) * g.diffMul;
      this.maxHp = Math.round(def.hp * hpMul);
      // 动态血量精英（如大型蝙蝠）：以本轮参考 DPS 为锚保证 5-8 秒交战时长，
      // 玩家实际 DPS 偏离只软追赶 45%（与 Boss 同一套参考曲线）
      if (def.dynamicHp && def.fightTime && g.playerDps) {
        const ord = Math.max(1, g.round);
        const refDps = CFG.boss.refDpsAt(ord);
        const soft = CFG.boss.hpSoftMul(g.playerDps() / refDps);
        this.maxHp = Math.max(this.maxHp, Math.round(refDps * rand(def.fightTime[0], def.fightTime[1]) * soft));
      }
      this.hp = this.maxHp;
      this.speedMul = 1 + (round - 1) * 0.03 + Math.min(0.25, g.time * 0.001);

      // 月痕沙海关卡：敌人从左右两侧随机刷出；其余地图固定从右侧入场
      const stage = g.mapId === 'moondesert';
      const fromLeft = stage && Math.random() < 0.5;
      this.spawnSide = fromLeft ? 'left' : 'right';
      this.x = fromLeft ? -50 : CFG.W + 50;
      // face：1=朝右（水平翻转 L 系精灵），-1=朝左（默认）。左侧入场时先朝右飞入
      this.face = fromLeft ? 1 : -1;
      // 左侧入场怪先飞到右侧的“镜像入场点”再交给原 AI（原 AI 均按“从右向左进入”设计）
      this.enterTX = null;
      if (fromLeft) {
        if (type === 'skull') this.enterTX = rand(940, 980);        // 头骨仅在 x>W-30 时开火，需从更右侧滑入
        else if (def.ground) this.enterTX = rand(860, 905);         // 地面单位：从右缘向左走/跑
        else this.enterTX = rand(750, 845);                         // 飞行单位：玩家右上悬停带
      }
      this.y = rand(CFG.TOP_Y + 40, CFG.GROUND_Y - 60);
      this.state = 'enter';
      this.stateT = 0;
      this.atkT = rand(1.2, 2.6);
      this.hoverX = 0; this.hoverY = 0; this.baseY = this.y;
      this.animT = rand(0, TAU);

      // 小弓箭手：地面行走 → 停 3-5 次射箭 → 一直向左奔跑（体积×2）
      if (type === 'archer') {
        this.y = CFG.GROUND_Y - 34;
        this.baseY = this.y;
        this.state = 'walk';
        this.archT = rand(1.8, 3.0);   // 独立倒数计时（stateT 在基类中为累加）
        this.stops = 0;
        this.stopsTotal = randi(3, 5);
        this.atkT = 0.5;
      }

      // 炮师：地面推进 → 停点抛射炮弹（3-4 次）→ 向左撤离（体积×2）
      if (type === 'cannoneer') {
        this.y = CFG.GROUND_Y - 34;
        this.baseY = this.y;
        this.state = 'walk';
        this.archT = rand(1.6, 2.6);
        this.stops = 0;
        this.stopsTotal = randi(3, 4);
        this.atkT = 0.6;
        this.spawnInvuln = 4;     // 出场 4s 无敌
      }

      // 飞天骷髅：悬停持续旋转，循环 瞄准连射 / 扇形散射 / 多方向环弹
      if (type === 'skull') {
        this.y = rand(CFG.TOP_Y + 50, CFG.GROUND_Y - 140);
        this.baseY = this.y;
        this.state = 'hover';
        this.rotA = rand(0, TAU);      // 头骨旋转角（同时改变攻击角度）
        this.aimT = rand(0.8, 1.4);
        this.fanT = rand(2.4, 3.2);
        this.ringT = rand(4.2, 5.2);
      }

      // 自爆骷髅：高速冲入屏幕中部 → 降速持续追击玩家 → 接触自爆
      if (type === 'skeleton') {
        this.state = 'rush';
        this.spawnInvuln = 5;     // 出场 5s 无敌
        this.radius = def.radius * 1.6;  // 体积变大
      }

      // 飞鹰：无出场无敌（锁血已移除，出场即可承伤）
      // 小超人：出场 7s 无敌
      if (type === 'superboy') this.spawnInvuln = 7;
      // 大型蝙蝠：飞行精英，悬停甩黑色飞刀（S 形弹/散射）；锁血已移除，全程可承伤
      if (type === 'bigbat') {
        this.state = 'hover';
        this.atkT = rand(1.4, 2.2);
        this.volley = 0;
      }

      // 刺羽鸟：悬停抖动，单发瞄准弹 / 环形散射交替发射
      if (type === 'spikebird') {
        this.state = 'hover';
        this.atkT = rand(1.2, 2.0);
        this.volley = randi(0, 1);     // 0=下一发单发瞄准 / 1=下一发环形散射；群体内错峰
        this.spawnInvuln = 1.5;
      }
      // 魔眼飞虫：锁定玩家位置后发射魔法弹
      if (type === 'eyefly') {
        this.state = 'hover';
        this.atkT = rand(1.6, 2.6);
        this.lockT = 0;       // 锁定倒计时（>0 时正在锁定）
        this.lockX = 0; this.lockY = 0;
        this.spawnInvuln = 1.5;
      }
      // 魔石甲虫：蓄力后发射高速魔法矛
      if (type === 'stonebeetle') {
        this.state = 'hover';
        this.atkT = rand(2.8, 4.0);
        this.chargeT = 0;     // 蓄力倒计时
        this.spawnInvuln = 2;
      }
      // 浮空魔花：花瓣打开后释放环形火球弹幕
      if (type === 'floatflower') {
        this.state = 'hover';
        this.atkT = rand(3.0, 4.2);
        this.openT = 0;       // 花瓣张开倒计时
        this.spawnInvuln = 2;
      }
      // 风暴飞鱼：吐出沿 S 形路线飞行的风暴弹
      if (type === 'stormfish') {
        this.state = 'hover';
        this.atkT = rand(2.4, 3.4);
        this.spawnInvuln = 1.8;
      }
      // 双头飞蛇：两个蛇头向不同方向连续射击形成交叉弹幕
      if (type === 'twinsnake') {
        this.state = 'hover';
        this.atkT = rand(2.2, 3.0);
        this.headT = 0;        // 连射节奏计时
        this.spawnInvuln = 2.5;
      }
      // 预言猫头鹰：逐次发射魔法羽毛（连续自机狙）
      if (type === 'owl') {
        this.state = 'hover';
        this.atkT = rand(1.6, 2.4);
        this.featherCd = 0;    // 每发羽毛间隔
        this.featherSeq = 0;   // 连射剩余发数
        this.spawnInvuln = 2.5;
      }

      /* ===== 斗兽场专属地面小怪（5 种）===== */
      if (type === 'javelinSlave' || type === 'ramFighter' ||
          type === 'shieldSlave' || type === 'puppet' || type === 'bombPrisoner') {
        // 站立地面 y：按精灵高度 × 3 倍缩放，使脚底贴近 GROUND_Y
        const SPR_H = { javelinSlave: 24, ramFighter: 26, shieldSlave: 24, puppet: 26, bombPrisoner: 24 };
        this.drawScale = (type === 'puppet') ? 3.1 : 3.0;
        this.restY = CFG.GROUND_Y - (SPR_H[type] * this.drawScale) / 2 + 2;
        this.y = this.restY;
        this.baseY = this.restY;
        this.air = false;          // 是否离地（跳跃中）
        this.jumpVx = 0; this.jumpVy = 0;
        this.spawnInvuln = 1.2;
        this.contactBase = def.contact;   // 普通接触伤害（空中撞击时临时提高）
      }
      // 投掷奴：行走接近 → 锁定助跑冲刺（0.7s）→ 投出倒刺标枪（低频）
      if (type === 'javelinSlave') {
        this.state = 'walk';
        this.atkT = rand(1.6, 2.6);
        this.aimT = 0; this.lockX = 0; this.lockY = 0;
      }
      // 羊头斗士：行走接近 → 锁定助跑 → 跳跃撞击（高额）→ 落回中线再跳
      if (type === 'ramFighter') {
        this.state = 'walk';
        this.atkT = rand(2.0, 3.0);
        this.windT = 0;
      }
      // 盾奴：行走到位 → 持续抛射大号塔盾（抛射弹道）
      if (type === 'shieldSlave') {
        this.state = 'walk';
        this.atkT = rand(1.4, 2.2);
        this.throwT = 0;
      }
      // 皮影客：下方左右移动对齐玩家 → 持续朝正上方投飞刀
      if (type === 'puppet') {
        this.state = 'hunt';
        this.atkT = 1.0;
      }
      // 自爆囚：缓慢移向中线 → 蓄力（闪红预警）→ 跳起撞击自爆；死亡/空中爆炸波及周围
      if (type === 'bombPrisoner') {
        this.state = 'march';
        this.windT = 0; this.redT = 0;
        this.exploded = false;
        this.midX = CFG.W * (CFG.arena.bomb.midX || 0.5);
        this.spin = 0;
      }

      /* ===== 斧王召唤：西装斧头兵（bossOnly，地面单位；行进步入→停步高弧抛斧；死亡旋转飞天落地爆炸）===== */
      if (type === 'axeMinion') {
        this.restY = CFG.GROUND_Y - 30;
        this.y = this.restY;
        this.baseY = this.restY;
        this.x = CFG.W + 50 + rand(0, 240);    // 屏外错峰入场
        this.spawnSide = 'right'; this.face = -1; this.enterTX = null;
        this.state = 'walk';
        // 按召唤序号均匀铺开站位（避免十几只叠成一团），落点铺满地面左 16%~68%
        const slot = g.enemies.filter(e => e.type === 'axeMinion').length;
        this.haltX = CFG.W * (0.16 + 0.52 * slot / Math.max(1, CFG.axeMinion.count - 1)) + rand(-12, 12);
        this.atkT = rand(1.4, 2.4);
        this.throwT = 0; this.fired = false;
        this.air = false; this.jumpVx = 0; this.jumpVy = 0;
        this.spin = 0; this.spinSpd = 0;
        this.dying = false;
        this.contactBase = def.contact;
        this.spawnInvuln = 0.6;
      }
    }

    /** 自爆骷髅：接触玩家引爆（无能量掉落，纯爆炸伤害） */
    detonate(g) {
      if (this.dead) return;
      this.dead = true;
      const p = g.player;
      const R = CFG.skeleton.blastR;
      const d = dist(this, p);
      burst(g, this.x, this.y, 30, ['#ff7b2e', '#ffd23b', '#c94a1e', '#fff'], 320, 7, 0.6, 120);
      SFX.explode(false);
      g.shake(9);
      if (d < R + p.radius) {
        const dmg = this.contactDmg * g.atkScale * (d < R * 0.55 ? 1 : 0.6);
        p.hurt(dmg, g, this.dsrc);
      }
    }

    /** 施加击退：每只小怪至多被击退 3 次，力度按 100%→60%→30% 衰减，第 4 次起免疫；地面/免击退单位不计次 */
    applyKb(kx, ky) {
      if (this.def.noKnockback || this.def.ground) return;
      if (this.kbCount >= 3) return;
      const mul = this.kbCount === 0 ? 1 : (this.kbCount === 1 ? 0.6 : 0.3);
      this.kbX += kx * mul; this.kbY += ky * mul;
      this.kbCount++;
    }

    takeDamage(dmg, g, kb) {
      if (this.dead || this.dying) return;
      if (this.spawnInvuln > 0) return;   // 出场无敌期内不受伤
      this.hp -= dmg;
      this.flash = 0.08;
      this.hurtT = 0.12;   // 持续受伤红染：连续命中时 hurtT 始终 >0，不会闪烁
      if (kb) this.applyKb(kb.x, kb.y);   // 击退统一走 applyKb：3 次递减后免疫（地面/免击退单位在其内部过滤）
      burst(g, this.x - 10, this.y, 2, ['#fff', '#ffe08a'], 120, 3, 0.18);
      SFX.hit();
      if (this.hp <= 0) this.die(g);
    }

    die(g) {
      if (this.dead || this.dying) return;
      // 斧头兵：死亡演出——旋转飞天 → 落地爆炸（奖励立即结算，爆裂演出延迟）
      if (this.type === 'axeMinion') { this.beginAxeDeath(g); return; }
      this.dead = true;
      // 灼烧/中毒期间死亡：原地小火球爆炸 / 毒云爆发
      if ((this.dotType === 'flame' || this.dotType === 'poison') && this.dotT > 0) {
        elemDeathFx(this.x, this.y, this.dotType, g, this.radius * 0.95);
      }
      g.kills++;
      if (typeof g.roundKills === 'number') g.roundKills++;   // 本轮刷怪段击杀（Boss 提前召唤门槛）
      g.score += this.def.score;
      if (window.Ach) window.Ach.evt('enemyDie', { g: g, e: this });
      g.addRage(this.def.elite ? CFG.ultimate.rageElite : CFG.ultimate.rageNormal);
      const cols = this.deathColors();
      burst(g, this.x, this.y, this.isBoss ? 60 : 16, cols, this.isBoss ? 320 : 200, this.isBoss ? 7 : 5, 0.7, 120);
      SFX.explode(this.isBoss);
      g.shake(this.isBoss ? 14 : 3);
      // 能量宝石
      const xp = this.xpValue || this.def.xp;
      if (this.isBoss) {
        for (let i = 0; i < 14; i++) g.gems.push(new Gem(this.x, this.y, Math.ceil(xp / 14)));
      } else {
        g.gems.push(new Gem(this.x, this.y, xp));
        if (Math.random() < 0.25) g.gems.push(new Gem(this.x + rand(-10, 10), this.y, this.def.xp));
      }
      // 自爆囚：被击杀后也会爆炸（非命中，波及周围敌人；已在引爆流程中则跳过）
      if (this.type === 'bombPrisoner' && !this.exploded) this.bombBoom(g, false);
    }
    deathColors() {
      return {
        eagle: ['#8a5a2b', '#f4f1e8', '#ffc02e'],
        bat: ['#4a3566', '#2b1f3d', '#ff5d73'],
        demon: ['#7a3fc9', '#e0453a', '#fff'],
        leigong: ['#2f6fd0', '#ffd23b', '#fff'],
        pig: ['#f4726b', '#ff7b2e', '#ffd23b'],
        skeleton: ['#e8eef7', '#9aa7bb', '#e0453a', '#ffd23b'],
        skull: ['#e8eef7', '#9aa7bb', '#7fe7ff', '#ff3b5c'],
        cannoneer: ['#5a6678', '#2c3545', '#ffd23b', '#fff'],
        superboy: ['#2f6fd0', '#e0453a', '#ffd23b', '#fff'],
        bigbat: ['#4a3566', '#2b1f3d', '#ff5d73', '#fff'],
        spikebird: ['#8aa94f', '#5a6e3a', '#ffd23b', '#fff'],
        eyefly: ['#6b3fa0', '#b574ff', '#ffe066', '#fff'],
        stonebeetle: ['#5a5a6e', '#35e0ff', '#7ff5ff', '#fff'],
        floatflower: ['#c83a6a', '#ffd23b', '#ff5d8f', '#fff'],
        stormfish: ['#2f8fc9', '#7fd4ff', '#ffd23b', '#fff'],
        twinsnake: ['#5a8a3a', '#8ac85a', '#e0453a', '#ffd23b'],
        owl: ['#a0784a', '#d4a86a', '#b0e8ff', '#ffd23b'],
        javelinSlave: ['#8a5a2b', '#c98f4a', '#d8d8e0', '#ffd23b'],
        ramFighter: ['#b8b8c0', '#8a8a96', '#e0453a', '#fff'],
        shieldSlave: ['#c89036', '#8a5e20', '#d8d8e0', '#ffd23b'],
        puppet: ['#3a2a4a', '#7a5a9a', '#c83a5a', '#ffd23b'],
        bombPrisoner: ['#9a9aa2', '#5a5a64', '#ff7b2e', '#ffd23b', '#e0453a'],
        axeMinion: ['#2e333d', '#e8eef7', '#d83a30', '#ffd23b']
      }[this.type] || ['#fff', '#aaa'];
    }

    /* 朝玩家发射 */
    shootAt(g, speed, kind, dmg, r, spread) {
      const p = g.player;
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      const n = spread ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const off = spread ? (i - 1) * 0.22 : 0;
        const a = base + off;
        g.bullets.push(new Bullet(this.x - 14, this.y,
          Math.cos(a) * speed, Math.sin(a) * speed,
          { kind: kind || 'orb', r: r || 6, dmg: dmg, dmgScale: g.atkScale, life: 7 }));
      }
      SFX.enemyShoot();
    }

    update(dt, g) {
      // 被浪客摔投中：由玩家更新位置/旋转，跳过常规 AI
      if (this.throwByPlayer) { return; }
      // 斧头兵死亡演出：旋转飞天 → 落地爆炸（不受冻结/困惑/击退影响）
      if (this.dying) { this.updateAxeDeath(dt, g); return; }
      this.t += dt;
      this.animT += dt;
      this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.spawnInvuln = Math.max(0, this.spawnInvuln - dt);

      // 元素 DoT 处理（离散跳伤害：每 0.5s 一跳，火焰跳出橙色伤害数字；持续冒火苗/毒泡像素）
      elemMarksTick(this, dt);
      if (this.dotT > 0) {
        this.dotT -= dt;
        const tickDmg = this.dotDps * dt;
        if (this.spawnInvuln <= 0 && tickDmg > 0) {
          this.hp -= tickDmg;
          this.hurtT = 0.12;
          this.dotTickT -= dt;
          if (this.dotTickT <= 0) {
            this.dotTickT += 0.5;
            if (g.popNum && this.dotType === 'flame') {
              g.popNum(this.x + rand(-10, 10), this.y - this.radius - 6,
                Math.max(1, Math.round(this.dotDps * 0.5)), '#ff9d2e');
            }
          }
          if (this.hp <= 0) { this.die(g); return; }
        }
        elemAmbient(this, dt, g);
        if (this.dotT <= 0) {   // 异常过期：清空叠层与类型，便于后续重新起算
          this.dotStack = 0; this.dotDps = 0; this.dotType = '';
        }
      }
      // 破无敌倒计时：归零时清除出场无敌
      if (this.invulnBreakT > 0) {
        this.invulnBreakT -= dt;
        if (this.invulnBreakT <= 0) this.spawnInvuln = 0;
      }
      // 冻结：停止行动（不减 freezeT 由下方统一处理）
      if (this.freezeT > 0) {
        this.freezeT -= dt;
        // 冻结期间仍受击退衰减但不跑 AI
        this.x += this.kbX * dt; this.y += this.kbY * dt;
        this.kbX *= 0.86; this.kbY *= 0.86;
        if (this.freezeT <= 0) { /* 解冻 */ }
        return;
      }
      // 困惑（法师魔法护盾命中）：眩晕下坠 2s，期间不行动不受控
      if (this.confuseT > 0) {
        this.confuseT -= dt;
        this.confuseVy = Math.min(360, this.confuseVy + 700 * dt);
        this.y += this.confuseVy * dt;
        this.x += this.kbX * dt; this.kbX *= 0.86;
        if (this.y > CFG.GROUND_Y - this.radius) this.y = CFG.GROUND_Y - this.radius;   // 坠到地面为止
        if (this.confuseT <= 0) this.confuseVy = 0;
        return;
      }

      // 击退衰减（悬停类敌人将垂直击退转移到 baseY，避免被 this.y=baseY+osc 覆盖）
      if (this.baseY !== undefined) this.baseY += this.kbY * dt;
      this.x += this.kbX * dt; this.y += this.kbY * dt;
      this.kbX *= 0.86; this.kbY *= 0.86;

      // 减速（护罩破碎冲击波）：行动节奏降至 45%（计时器仍按真实时间流逝，不影响击退）
      if (this.slowT > 0) { this.slowT -= dt; dt *= 0.45; }

      // 月痕沙海：从左侧入场的敌人先向右飞到镜像入场点，再交由各 AI 接管
      if (g.mapId === 'moondesert' && this.spawnSide === 'left' && this.enterTX !== null) {
        if (this.x >= this.enterTX) {
          this.enterTX = null;   // 到位：本帧继续走原 AI
        } else {
          this.x += 280 * dt;
          this.y += Math.sin(this.t * 3) * 30 * dt;
          this.face = 1;
          return;
        }
      }

      const p = g.player;
      switch (this.type) {
        case 'eagle': this.aiEagle(dt, g, p); break;
        case 'bat': this.aiBat(dt, g, p); break;
        case 'demon': this.aiDemon(dt, g, p); break;
        case 'leigong': this.aiLeigong(dt, g, p); break;
        case 'pig': this.aiPig(dt, g, p); break;
        case 'archer': this.aiArcher(dt, g, p); break;
        case 'cannoneer': this.aiCannoneer(dt, g, p); break;
        case 'skull': this.aiSkull(dt, g, p); break;
        case 'skeleton': this.aiSkeleton(dt, g, p); break;
        case 'superboy': this.aiSuperboy(dt, g, p); break;
        case 'bigbat': this.aiBigBat(dt, g, p); break;
        case 'spikebird': this.aiSpikeBird(dt, g, p); break;
        case 'eyefly': this.aiEyeFly(dt, g, p); break;
        case 'stonebeetle': this.aiStoneBeetle(dt, g, p); break;
        case 'floatflower': this.aiFloatFlower(dt, g, p); break;
        case 'stormfish': this.aiStormFish(dt, g, p); break;
        case 'twinsnake': this.aiTwinSnake(dt, g, p); break;
        case 'owl': this.aiOwl(dt, g, p); break;
        case 'javelinSlave': this.aiJavelinSlave(dt, g, p); break;
        case 'ramFighter': this.aiRamFighter(dt, g, p); break;
        case 'shieldSlave': this.aiShieldSlave(dt, g, p); break;
        case 'puppet': this.aiPuppet(dt, g, p); break;
        case 'bombPrisoner': this.aiBombPrisoner(dt, g, p); break;
        case 'axeMinion': this.aiAxeMinion(dt, g, p); break;
      }
      // 月痕沙海：入场结束后精灵朝向玩家（单一朝向写入源；入场飞行段在上方处理）
      if (g.mapId === 'moondesert' && this.enterTX === null && g.player) {
        this.face = (g.player.x >= this.x) ? 1 : -1;
      }
      // 飞离屏幕清理
      if (this.x < -80 || this.y > CFG.H + 100 || this.y < -160) this.dead = true;
    }

    /* 飞鹰：盘旋 → 蓄力 → 俯冲 → 脱离 */
    aiEagle(dt, g, p) {
      const sp = 150 * this.speedMul;
      if (this.state === 'enter') {
        this.x -= sp * dt;
        this.y += Math.sin(this.t * 3) * 40 * dt;
        if (this.x < CFG.W - 120) { this.state = 'hover'; this.stateT = 0; this.baseY = this.y; }
      } else if (this.state === 'hover') {
        this.x -= 40 * dt;
        this.y = this.baseY + Math.sin(this.t * 2.2) * 46;
        this.baseY += (clamp(p.y, 80, CFG.GROUND_Y - 80) - this.baseY) * dt * 0.5;
        if (this.stateT > rand(1.4, 2.6)) { this.state = 'windup'; this.stateT = 0; this.lockX = p.x; this.lockY = p.y; }
      } else if (this.state === 'windup') {
        this.y += Math.sin(this.t * 30) * 30 * dt;
        if (this.stateT > 0.4) {
          this.state = 'dive'; this.stateT = 0;
          this.diveFar = Math.random() < 0.5;   // 50% 概率一直冲到屏幕最左边
          const a = Math.atan2(this.lockY - this.y, this.lockX - this.x);
          const spd = (this.diveFar ? 500 : 420) * this.speedMul;
          this.diveVx = Math.cos(a) * spd;
          this.diveVy = Math.sin(a) * spd;
          if (this.diveFar) this.diveVx = -spd;  // 长冲固定全速朝左扫场（避免近垂直角时水平速度归零）
        }
      } else if (this.state === 'dive') {
        this.x += this.diveVx * dt; this.y += this.diveVy * dt;
        if (this.diveFar) {
          // 超长冲锋：前0.45s保留俯冲下坠，之后拉平机身水平扫场，直到飞出屏幕左缘（由飞离清理移除）
          if (this.stateT < 0.45) this.diveVy += 500 * dt;
          else this.diveVy *= Math.pow(0.05, dt);
          if (this.y > CFG.GROUND_Y - 46) { this.y = CFG.GROUND_Y - 46; this.diveVy = Math.min(this.diveVy, 0); }
        } else {
          this.diveVy += 500 * dt;   // 俯冲下坠（冲刺距离加长：1.1s → 1.6s）
          if (this.stateT > 1.6 || this.y > CFG.GROUND_Y - 20) { this.state = 'recover'; this.stateT = 0; }
        }
      } else if (this.state === 'recover') {
        this.x += 180 * dt; this.y -= 150 * dt;
        if (this.x > CFG.W - 140 || this.stateT > 1.6) { this.state = 'hover'; this.stateT = 0; this.baseY = clamp(this.y, 80, CFG.GROUND_Y - 100); }
      }
    }

    /* 蝙蝠：群体波浪式逼近 */
    aiBat(dt, g, p) {
      const sp = 190 * this.speedMul;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const targetX = p.x + 90;
      // 逼近到玩家右侧附近后绕飞
      if (this.x > targetX) this.x -= sp * dt * 0.9;
      else this.x += Math.sin(this.t * 2) * 70 * dt - 20 * dt;
      this.y += (dy / d) * sp * 0.7 * dt + Math.sin(this.t * 7) * 90 * dt;
      this.y = clamp(this.y, CFG.TOP_Y, CFG.GROUND_Y - 20);
    }

    /* 飞天恶魔：保持距离 + 瞄准弹幕 */
    aiDemon(dt, g, p) {
      const sp = 95 * this.speedMul;
      const wantX = p.x + 320;
      if (this.x > wantX + 30) this.x -= sp * dt;
      else if (this.x < wantX - 60) this.x += sp * 0.6 * dt;
      this.y += Math.sin(this.t * 1.8) * 70 * dt;
      this.y = clamp(this.y, CFG.TOP_Y + 30, CFG.GROUND_Y - 60);
      if (this.x < CFG.W - 40) {
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = rand(2.0, 2.8) * (g.round >= 3 ? 0.85 : 1);
          this.shootAt(g, 230, 'spark', this.bulletDmg * g.atkScale, 6, g.round >= 3);
        }
      }
    }

    /* 雷公：闪电预警打击 */
    aiLeigong(dt, g, p) {
      const sp = 70 * this.speedMul;
      if (this.x > CFG.W - 200) this.x -= sp * dt;
      this.y += Math.sin(this.t * 1.1) * 40 * dt;
      this.y = clamp(this.y, 90, CFG.GROUND_Y - 90);
      this.atkT -= dt;
      if (this.atkT <= 0 && this.x < CFG.W - 60) {
        this.atkT = rand(2.6, 3.4);
        const cols = g.round >= 4 ? 2 : 1;
        for (let i = 0; i < cols; i++) {
          const lx = clamp(p.x + (i === 0 ? 0 : (Math.random() < 0.5 ? -90 : 90)), 60, CFG.W - 60);
          g.lightnings.push(Lightning.vertical(lx, 56, this.bulletDmg * g.atkScale));
        }
      }
    }

    /* 火焰飞猪：火球 4 秒后爆炸分裂 */
    aiPig(dt, g, p) {
      const sp = 80 * this.speedMul;
      if (this.x > CFG.W - 220) this.x -= sp * dt;
      this.y += Math.sin(this.t * 1.4) * 50 * dt;
      this.y = clamp(this.y, 90, CFG.GROUND_Y - 90);
      this.atkT -= dt;
      if (this.atkT <= 0 && this.x < CFG.W - 80) {
        this.atkT = rand(2.8, 3.6);
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.fireball(g, a, 170, 10, 4);
        if (g.round >= 3) this.fireball(g, a + 0.18, 160, 9, 4);
      }
    }
    fireball(g, angle, speed, r, frags) {
      const dmg = this.bulletDmg * g.atkScale;
      const fb = new Bullet(this.x - 16, this.y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        { kind: 'fireball', r: r, dmg, life: 4.0 });
      fb.onExpire = (gg, b) => {
        gg.explodeFireball(b.x, b.y, frags, dmg * 0.7, 70, b.src);
      };
      g.bullets.push(fb);
      SFX.enemyShoot();
    }

    /* 小弓箭手：地面行走 → 停留抛射箭矢（3-5 次）→ 向左疾奔 */
    aiArcher(dt, g, p) {
      this.y = (g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y) - 34;   // 始终踩在地面（体积×2 后中心上移）；天空图跟随起伏云面
      this.kbY = 0;
      if (this.state === 'walk') {
        this.x -= 78 * this.speedMul * dt;
        this.archT -= dt;
        if (this.archT <= 0) { this.state = 'stop'; this.archT = rand(1.4, 2.0); this.atkT = 0.15; }
      } else if (this.state === 'stop') {
        this.archT -= dt;
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = 0.7;
          this.shootArrow(g, p);
        }
        if (this.archT <= 0) {
          this.stops++;
          if (this.stops >= this.stopsTotal) {
            this.state = 'run';
          } else {
            this.state = 'walk';
            this.archT = rand(2.2, 3.6);
          }
        }
      } else if (this.state === 'run') {
        this.x -= 210 * this.speedMul * dt;
      }
    }
    /* 自爆骷髅：高速冲入屏幕中部 → 降速追击 → 接近后停步颤抖预警（0.9s）→ 大范围爆炸 */
    aiSkeleton(dt, g, p) {
      const S = CFG.skeleton;
      if (this.state === 'rush') {
        this.x -= S.rushSpeed * this.speedMul * dt;
        this.y += Math.sin(this.t * 6) * 60 * dt;
        this.y = clamp(this.y, CFG.TOP_Y + 20, CFG.GROUND_Y - 40);
        if (this.x < CFG.W * 0.52) { this.state = 'chase'; this.stateT = 0; }
      } else if (this.state === 'chase') {
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = S.chaseSpeed * this.speedMul;
        // 进入触发距离即停步预警
        if (d < S.triggerD + p.radius) {
          this.state = 'windup'; this.stateT = 0;
          SFX.warn();
        } else {
          this.x += (dx / d) * sp * dt;
          this.y += (dy / d) * sp * dt + Math.sin(this.t * 8) * 26 * dt;
          this.y = clamp(this.y, CFG.TOP_Y, CFG.GROUND_Y - 20);
        }
      } else if (this.state === 'windup') {
        // 原地颤抖预警，预警结束后引爆
        if (this.stateT >= S.windup) this.detonate(g);
      }
    }

    /* 炮师：持续奔跑入场 → 停点快速连射炮弹（3-4 次）→ 向左疾奔撤离 */
    aiCannoneer(dt, g, p) {
      this.y = (g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y) - 34;   // 始终踩在地面（体积×2 后中心上移）；天空图跟随起伏云面
      this.kbY = 0;
      if (this.state === 'walk') {
        this.x -= 128 * this.speedMul * dt;
        this.archT -= dt;
        if (this.archT <= 0) { this.state = 'stop'; this.archT = rand(1.2, 1.6); this.atkT = 0.15; }
      } else if (this.state === 'stop') {
        this.archT -= dt;
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = 0.5;          // 快速射击
          this.fireShell(g, p);
        }
        if (this.archT <= 0) {
          this.stops++;
          if (this.stops >= this.stopsTotal) this.state = 'run';
          else { this.state = 'walk'; this.archT = rand(1.4, 2.2); }
        }
      } else if (this.state === 'run') {
        this.x -= 285 * this.speedMul * dt;
      }
    }

    /** 炮师：抛射铁炮弹 —— 触地/触障碍/触玩家/被我方击中即爆炸 */
    fireShell(g, p) {
      const C = CFG.cannoneer;
      const dx = p.x - this.x;
      const dy = p.y - (this.y - 10);
      const d = Math.max(140, Math.hypot(dx, dy));
      const t = clamp(d / 280, 0.6, 1.4);
      const vx = dx / t;
      const vy = (dy - 0.5 * C.shellG * t * t) / t;
      const dmg = Math.round(this.bulletDmg * g.atkScale);
      const sh = new Bullet(this.x - 14, this.y - 10, vx, vy,
        { kind: 'shell', r: 7, dmg, life: 5, grav: C.shellG, volatile: true });
      sh.onExpire = (gg, b) => gg.shellBlast(b.x, b.y, dmg, b.src);
      g.bullets.push(sh);
      SFX.enemyShoot();
    }

    /* 飞天骷髅：悬停持续旋转，循环 瞄准连射 / 扇形散射 / 多方向直线环弹 */
    aiSkull(dt, g, p) {
      this.rotA += dt * 1.6;   // 头骨持续旋转 → 攻击角随之偏转
      // 悬停游弋
      const wantX = p.x + 300;
      if (this.x > wantX + 40) this.x -= 95 * this.speedMul * dt;
      else if (this.x < wantX - 80) this.x += 45 * this.speedMul * dt;
      this.y = this.baseY + Math.sin(this.t * 2.1) * 40;
      this.baseY += (clamp(p.y - 40, CFG.TOP_Y + 40, CFG.GROUND_Y - 140) - this.baseY) * dt * 0.4;
      if (this.x > CFG.W - 30) {
        // 持续瞄准连射
        this.aimT -= dt;
        if (this.aimT <= 0) {
          this.aimT = rand(0.9, 1.3);
          this.shootAt(g, 260, 'orb', this.bulletDmg * g.atkScale, 5, false);
        }
        // 扇形散射（角度随旋转偏转）
        this.fanT -= dt;
        if (this.fanT <= 0) {
          this.fanT = rand(2.6, 3.4);
          for (let i = -2; i <= 2; i++) {
            const a = this.rotA + i * 0.24;
            g.bullets.push(new Bullet(this.x, this.y,
              Math.cos(a) * 220, Math.sin(a) * 220,
              { kind: 'orb', r: 5, dmg: this.bulletDmg * g.atkScale, dmgScale: g.atkScale, life: 6, color: '#e8eef7' }));
          }
          SFX.enemyShoot();
        }
        // 多方向直线环弹
        this.ringT -= dt;
        if (this.ringT <= 0) {
          this.ringT = rand(4.4, 5.4);
          const n = 8;
          for (let i = 0; i < n; i++) {
            const a = this.rotA + (TAU / n) * i;
            g.bullets.push(new Bullet(this.x, this.y,
              Math.cos(a) * 165, Math.sin(a) * 165,
              { kind: 'orb', r: 6, dmg: this.bulletDmg * g.atkScale, dmgScale: g.atkScale, life: 6, color: '#ffb02e' }));
          }
          SFX.enemyShoot();
        }
      }
    }

    /* 小超人：飞行逼近悬停，周期发射单束激光（激光遇障碍炸碎山石） */
    aiSuperboy(dt, g, p) {
      // 悬停游弋：保持在玩家右上方
      const wantX = p.x + 280, wantY = clamp(p.y - 60, CFG.TOP_Y + 60, CFG.GROUND_Y - 120);
      if (this.x > wantX + 30) this.x -= 105 * this.speedMul * dt;
      else if (this.x < wantX - 60) this.x += 63 * this.speedMul * dt;
      this.y += (wantY - this.y) * dt * 1.2 + Math.sin(this.t * 3.2) * 14 * dt;
      this.y = clamp(this.y, CFG.TOP_Y + 40, CFG.GROUND_Y - 80);
      this.atkT -= dt;
      if (this.atkT <= 0 && this.x < CFG.W - 20) {
        this.atkT = rand(2.2, 3.0);
        // 朝玩家方向发射一束细激光（预警后激活，光路中的山石被炸毁）
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        g.beams.push(new Beam(this.x, this.y, a, 1300, 10, Math.round(this.bulletDmg * g.atkScale), 0.85, true));
        SFX.enemyShoot();
      }
    }

    /* 大型蝙蝠：保持中距悬停，交替甩出 S 形黑色飞刀（单发）/ 散射飞刀群（5 发小幅 S 走向） */
    aiBigBat(dt, g, p) {
      const sp = 105 * this.speedMul;
      const wantX = p.x + 330;
      if (this.state === 'enter') {
        this.x -= sp * dt;
        if (this.x < CFG.W - 130) { this.state = 'hover'; this.stateT = 0; this.baseY = this.y; }
        return;
      }
      if (this.x > wantX + 40) this.x -= sp * dt;
      else if (this.x < wantX - 60) this.x += sp * 0.5 * dt;
      this.baseY += (clamp(p.y - 30, CFG.TOP_Y + 60, CFG.GROUND_Y - 150) - this.baseY) * dt * 1.1;
      this.y = this.baseY + Math.sin(this.t * 2.4) * 34;
      this.atkT -= dt;
      if (this.atkT <= 0 && this.x < CFG.W - 30) {
        this.volley++;
        const base = Math.atan2(p.y - this.y, p.x - this.x);
        const dmg = this.bulletDmg * g.atkScale;
        if (this.volley % 2 === 1) {
          // 单发：大幅 S 形黑色飞刀
          const spd = 330;
          const b = new Bullet(this.x - 18, this.y, Math.cos(base) * spd, Math.sin(base) * spd,
            { kind: 'blackKnife', r: 8, dmg, life: 6, sine: { amp: 0.55, freq: 7, phase: 0 } });
          g.bullets.push(b);
          this.atkT = rand(1.6, 2.2);
        } else {
          // 散射：5 把飞刀，各带小幅 S 摆尾与错相
          for (let i = -2; i <= 2; i++) {
            const a = base + i * 0.2;
            g.bullets.push(new Bullet(this.x - 18, this.y, Math.cos(a) * 300, Math.sin(a) * 300,
              { kind: 'blackKnife', r: 8, dmg, life: 6, sine: { amp: 0.3, freq: 9, phase: i * 1.1 } }));
          }
          this.atkT = rand(2.1, 2.9);
        }
        SFX.enemyShoot();
      }
    }

    /** 抛射箭矢：弹道解算 */
    shootArrow(g, p) {
      const dx = p.x - (this.x - 16);
      const dy = p.y - (this.y - 6);
      const d = Math.max(120, Math.hypot(dx, dy));
      const t = clamp(d / 300, 0.55, 1.5);
      const G = 520;
      const vx = dx / t;
      const vy = (dy - 0.5 * G * t * t) / t;
      g.bullets.push(new Bullet(this.x - 16, this.y - 6, vx, vy,
        { kind: 'arrow', r: 5, dmg: this.bulletDmg * g.atkScale, life: 4 }));
      SFX.enemyShoot();
    }

    /* 刺羽鸟：保持中距悬停抖动；攻击间隔较短，单发瞄准弹与环形散射交替发射 */
    aiSpikeBird(dt, g, p) {
      const sp = this.speedMul * 115;
      const wantX = p.x + 260;
      if (this.x > wantX + 30) this.x -= sp * dt;
      else if (this.x < wantX - 60) this.x += sp * 0.5 * dt;
      this.baseY += (clamp(p.y - 10, CFG.TOP_Y + 40, CFG.GROUND_Y - 100) - this.baseY) * dt * 0.8;
      this.y = this.baseY + Math.sin(this.t * 4) * 22;
      this.atkT -= dt;
      if (this.atkT <= 0 && this.x < CFG.W - 30) {
        this.atkT = rand(1.4, 2.0);     // 攻击间隔降低（原 2.6-3.6s）
        const dmg = this.bulletDmg * g.atkScale;
        this.volley = (this.volley || 0) % 2;
        if (this.volley === 0) {
          // 本轮单发：瞄准玩家高速射出一片叶片弹
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          g.bullets.push(new Bullet(this.x, this.y,
            Math.cos(a) * 280, Math.sin(a) * 280,
            { kind: 'orb', r: 6, dmg, dmgScale: g.atkScale, life: 5, eb: 'leaf' }));
        } else {
          // 本轮散射：10 向叶片环弹
          const n = 10;
          for (let i = 0; i < n; i++) {
            const a = (TAU / n) * i + rand(-0.08, 0.08);
            g.bullets.push(new Bullet(this.x, this.y,
              Math.cos(a) * 170, Math.sin(a) * 170,
              { kind: 'orb', r: 6, dmg, dmgScale: g.atkScale, life: 5, eb: 'leaf' }));
          }
        }
        this.volley++;
        SFX.flyerShoot('leaf');
      }
    }

    /* 魔眼飞虫：悬停游弋，短暂锁定玩家位置后朝锁定点发射魔法弹 */
    aiEyeFly(dt, g, p) {
      const sp = this.speedMul * 135;
      const wantX = p.x + 280;
      if (this.x > wantX + 30) this.x -= sp * dt;
      else if (this.x < wantX - 60) this.x += sp * 0.5 * dt;
      this.baseY += (clamp(p.y - 20, CFG.TOP_Y + 40, CFG.GROUND_Y - 100) - this.baseY) * dt * 0.9;
      this.y = this.baseY + Math.sin(this.t * 5) * 16;
      if (this.x > CFG.W - 30) return;
      if (this.lockT > 0) {
        // 锁定中：记录玩家位置，不发射
        this.lockT -= dt;
        this.lockX = p.x; this.lockY = p.y;
        if (this.lockT <= 0) {
          const a = Math.atan2(this.lockY - this.y, this.lockX - this.x);
          const dmg = this.bulletDmg * g.atkScale;
          g.bullets.push(new Bullet(this.x - 8, this.y,
            Math.cos(a) * 280, Math.sin(a) * 280,
            { kind: 'orb', r: 7, dmg, dmgScale: g.atkScale, life: 5, eb: 'eyeball' }));
          SFX.flyerShoot('eyeball');
        }
      } else {
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = rand(2.2, 3.0);
          this.lockT = 0.6;   // 锁定 0.6s 后发射
        }
      }
    }

    /* 魔石甲虫：保持距离，蓄力（水晶发光）后发射高速魔法矛 */
    aiStoneBeetle(dt, g, p) {
      const sp = this.speedMul * 95;
      const wantX = p.x + 340;
      if (this.x > wantX + 30) this.x -= sp * dt;
      else if (this.x < wantX - 60) this.x += sp * 0.5 * dt;
      this.baseY += (clamp(p.y - 30, CFG.TOP_Y + 50, CFG.GROUND_Y - 120) - this.baseY) * dt * 0.7;
      this.y = this.baseY + Math.sin(this.t * 2.2) * 18;
      if (this.x > CFG.W - 40) return;
      if (this.chargeT > 0) {
        this.chargeT -= dt;
        if (this.chargeT <= 0) {
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          const dmg = this.bulletDmg * g.atkScale;
          // 高速魔法矛：弹速极快
          g.bullets.push(new Bullet(this.x - 14, this.y,
            Math.cos(a) * 560, Math.sin(a) * 560,
            { kind: 'orb', r: 7, dmg, dmgScale: g.atkScale, life: 4, eb: 'flame', ebTrail: 1 }));
          SFX.flyerShoot('flame');
        }
      } else {
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = rand(3.2, 4.4);
          this.chargeT = 0.9;    // 蓄力 0.9s
        }
      }
    }

    /* 浮空魔花：悬停，花瓣张开蓄力后向四周释放环形火球弹幕 */
    aiFloatFlower(dt, g, p) {
      const sp = this.speedMul * 70;
      const wantX = p.x + 300;
      if (this.x > wantX + 30) this.x -= sp * dt;
      else if (this.x < wantX - 60) this.x += sp * 0.5 * dt;
      this.baseY += (clamp(p.y - 40, CFG.TOP_Y + 60, CFG.GROUND_Y - 140) - this.baseY) * dt * 0.6;
      this.y = this.baseY + Math.sin(this.t * 1.8) * 14;
      if (this.x > CFG.W - 40) return;
      if (this.openT > 0) {
        this.openT -= dt;
        if (this.openT <= 0) {
          const n = 12;
          const dmg = this.bulletDmg * g.atkScale;
          for (let i = 0; i < n; i++) {
            const a = (TAU / n) * i;
            g.bullets.push(new Bullet(this.x, this.y,
              Math.cos(a) * 150, Math.sin(a) * 150,
              { kind: 'orb', r: 6, dmg, dmgScale: g.atkScale, life: 5, eb: 'spikeball', ebTrail: 1 }));
          }
          SFX.flyerShoot('spikeball');
        }
      } else {
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = rand(3.4, 4.6);
          this.openT = 0.8;     // 花瓣张开 0.8s
        }
      }
    }

    /* 风暴飞鱼：悬停，吐出沿 S 形/波浪路线飞行的风暴弹 */
    aiStormFish(dt, g, p) {
      const sp = this.speedMul * 105;
      const wantX = p.x + 290;
      if (this.x > wantX + 30) this.x -= sp * dt;
      else if (this.x < wantX - 60) this.x += sp * 0.5 * dt;
      this.baseY += (clamp(p.y - 20, CFG.TOP_Y + 50, CFG.GROUND_Y - 110) - this.baseY) * dt * 0.8;
      this.y = this.baseY + Math.sin(this.t * 3) * 16;
      this.atkT -= dt;
      if (this.atkT <= 0 && this.x < CFG.W - 30) {
        this.atkT = rand(2.6, 3.6);
        const base = Math.atan2(p.y - this.y, p.x - this.x);
        const dmg = this.bulletDmg * g.atkScale;
        // 3 发波浪风暴弹，带 S 形轨迹
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.22;
          g.bullets.push(new Bullet(this.x - 10, this.y,
            Math.cos(a) * 260, Math.sin(a) * 260,
            { kind: 'orb', r: 6, dmg, dmgScale: g.atkScale, life: 5, eb: 'whiteorb', ebTrail: 1,
              sine: { amp: 0.45, freq: 8, phase: i * 1.2 } }));
        }
        SFX.flyerShoot('whiteorb');
      }
    }

    /* 双头飞蛇：悬停，两端蛇头交替向不同方向连续射击，形成交叉弹幕 */
    aiTwinSnake(dt, g, p) {
      const sp = this.speedMul * 82;
      const wantX = p.x + 320;
      if (this.x > wantX + 30) this.x -= sp * dt;
      else if (this.x < wantX - 60) this.x += sp * 0.5 * dt;
      this.baseY += (clamp(p.y - 30, CFG.TOP_Y + 60, CFG.GROUND_Y - 130) - this.baseY) * dt * 0.7;
      this.y = this.baseY + Math.sin(this.t * 2) * 18;
      if (this.x > CFG.W - 40) return;
      this.atkT -= dt;
      if (this.atkT <= 0) {
        this.atkT = rand(2.4, 3.2);
        this.headT = 0;        // 开始一轮连射
        this.headBurst = 4;    // 每轮连射 4 对
      }
      if (this.headBurst > 0) {
        this.headT -= dt;
        if (this.headT <= 0) {
          this.headT = 0.22;
          this.headBurst--;
          const dmg = this.bulletDmg * g.atkScale;
          // 左头：朝左上方偏玩家方向
          const aL = Math.atan2(p.y - this.y - 10, p.x - this.x - 20);
          // 右头：朝右下方偏玩家方向
          const aR = Math.atan2(p.y - this.y + 10, p.x - this.x + 20);
          g.bullets.push(new Bullet(this.x - 20, this.y,
            Math.cos(aL) * 240, Math.sin(aL) * 240,
            { kind: 'orb', r: 6, dmg, dmgScale: g.atkScale, life: 5, eb: 'diamond', ebTrail: 2 }));
          g.bullets.push(new Bullet(this.x + 20, this.y,
            Math.cos(aR) * 240, Math.sin(aR) * 240,
            { kind: 'orb', r: 6, dmg, dmgScale: g.atkScale, life: 5, eb: 'diamond', ebTrail: 2 }));
          SFX.flyerShoot('diamond');
        }
      }
    }

    /* 预言猫头鹰：悬停，连续观察玩家位置并逐次发射魔法羽毛（连续自机狙） */
    aiOwl(dt, g, p) {
      const sp = this.speedMul * 78;
      const wantX = p.x + 300;
      if (this.x > wantX + 30) this.x -= sp * dt;
      else if (this.x < wantX - 60) this.x += sp * 0.5 * dt;
      this.baseY += (clamp(p.y - 40, CFG.TOP_Y + 60, CFG.GROUND_Y - 140) - this.baseY) * dt * 0.7;
      this.y = this.baseY + Math.sin(this.t * 1.6) * 12;
      if (this.x > CFG.W - 40) return;
      if (this.featherSeq > 0) {
        this.featherCd -= dt;
        if (this.featherCd <= 0) {
          this.featherCd = 0.32;     // 每发间隔 0.32s
          this.featherSeq--;
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          const dmg = this.bulletDmg * g.atkScale;
          g.bullets.push(new Bullet(this.x - 12, this.y,
            Math.cos(a) * 320, Math.sin(a) * 320,
            { kind: 'orb', r: 6, dmg, dmgScale: g.atkScale, life: 4.5, eb: 'cone', ebTrail: 2 }));
          SFX.flyerShoot('cone');
        }
      } else {
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = rand(2.6, 3.6);
          this.featherSeq = 5;      // 一轮连射 5 发
          this.featherCd = 0;
        }
      }
    }

    /* ===== 斗兽场地面小怪 AI（5 种）===== */

    /** 投掷奴：行走接近 → 锁定玩家后加速助跑冲刺（0.7s）→ 投出倒刺铁头标枪（低频，击落玩家 4s） */
    aiJavelinSlave(dt, g, p) {
      const A = CFG.arena.javelin;
      this.y = this.restY; this.kbY = 0;     // 始终踩地
      if (this.state === 'walk') {
        this.x -= A.walkSpd * this.speedMul * dt;
        this.atkT -= dt;
        if (this.atkT <= 0 && this.x < CFG.W * 0.9) {
          this.state = 'aim'; this.aimT = A.aimTime;
        }
      } else if (this.state === 'aim') {
        this.lockX = p.x; this.lockY = p.y;             // 锁定玩家位置（持续跟踪）
        this.x -= A.sprintSpd * this.speedMul * dt;     // 加速助跑冲刺
        this.aimT -= dt;
        if (this.aimT <= 0) {
          this.fireJavelin(g, p);
          this.state = 'walk';
          this.atkT = rand(A.cdMin, A.cdMax);           // 低频
        }
      }
    }
    fireJavelin(g, p) {
      const A = CFG.arena.javelin;
      const x0 = this.x - 16, y0 = this.y - 6;
      const dx = this.lockX - x0, dy = this.lockY - y0;
      const d = Math.hypot(dx, dy) || 1;
      const dmg = Math.round(this.bulletDmg * g.atkScale);
      const sp = new Bullet(x0, y0, dx / d * A.spearSpd, dy / d * A.spearSpd,
        { kind: 'orb', r: A.spearR, dmg, dmgScale: g.atkScale, life: 6, eb: 'javelin' });
      // 命中玩家：造成伤害并击落（失控坠落 4s）
      sp.onPlayerHit = (gg) => { if (gg.player && gg.player.applyDown) gg.player.applyDown(A.downTime); };
      g.bullets.push(sp);
      SFX.javelinThrow();
    }

    /** 羊头斗士：行走接近 → 锁定助跑 → 跳跃撞击（高额，慢而可预判）→ 落回中线再跳；白气拖尾 + 臭屁音效 */
    aiRamFighter(dt, g, p) {
      const A = CFG.arena.ram;
      if (!this.air) { this.y = this.restY; this.kbY = 0; this.contactDmg = this.contactBase; }
      if (this.state === 'walk') {
        this.x -= A.walkSpd * this.speedMul * dt;
        this.atkT -= dt;
        if (this.atkT <= 0 && this.x < CFG.W * 0.92) {
          this.state = 'windup'; this.windT = A.windup;
          this.lockX = p.x; this.lockY = p.y;
        }
      } else if (this.state === 'windup') {
        this.lockX = p.x; this.lockY = p.y;
        this.x -= A.sprintSpd * this.speedMul * dt;     // 锁定后加速助跑
        this.windT -= dt;
        if (this.windT <= 0) {
          this.air = true; this.state = 'leap';
          this.jumpVy = -A.leapUpV;
          this.jumpVx = (this.lockX < this.x ? -1 : 1) * A.leapSpd;   // 空中水平慢、可预判
          this.contactDmg = A.leapDmg;
          SFX.fart(false);                             // 臭屁音效
          burst(g, this.x, this.y + 30, 14, ['#f2f6ff', '#dfe8f5', '#b9c6d8'], 120, 5, 0.5, 60);
        }
      } else if (this.state === 'leap') {
        this.jumpVy += A.grav * dt;
        this.x += this.jumpVx * dt; this.y += this.jumpVy * dt;
        // 白气拖尾
        g.particles.push(new Particle(this.x + rand(-6, 6), this.y + rand(0, 18),
          rand(-40, 10), rand(-30, 10), rand(0.3, 0.55), rand(3, 6),
          Math.random() < 0.5 ? '#f2f6ff' : '#cdd8e8'));
        if (this.jumpVy >= 0 && this.y >= this.restY) {
          this.y = this.restY; this.air = false; this.jumpVx = 0; this.jumpVy = 0;
          this.contactDmg = this.contactBase;
          burst(g, this.x, this.restY + 30, 18, ['#e8ddc0', '#cdb88f', '#fff'], 170, 5, 0.5, 130);  // 落地沙尘
          SFX.land();
          this.state = 'recenter';
        }
      } else if (this.state === 'recenter') {
        // 落地移动到屏幕中线位置
        const ddx = CFG.W * 0.5 - this.x;
        if (Math.abs(ddx) < 18) {
          this.state = 'windup'; this.windT = A.windup;    // 到位后再次锁定玩家起跳
          this.lockX = p.x; this.lockY = p.y;
        } else {
          this.x += Math.sign(ddx) * A.walkSpd * 1.3 * this.speedMul * dt;
        }
      }
    }

    /** 盾奴：行走到位 → 持续朝玩家抛射大号塔盾（抛射弹道，中等伤害） */
    aiShieldSlave(dt, g, p) {
      const A = CFG.arena.shieldSlave;
      this.y = this.restY; this.kbY = 0;
      if (this.state === 'walk') {
        this.x -= A.walkSpd * this.speedMul * dt;
        this.atkT -= dt;
        if (this.atkT <= 0 && this.x < CFG.W * 0.88) { this.state = 'throw'; this.throwT = 0.4; }
      } else if (this.state === 'throw') {
        if (this.x - p.x > CFG.W * 0.72) this.x -= A.walkSpd * 0.6 * this.speedMul * dt;   // 太远则缓慢逼近
        this.throwT -= dt;
        if (this.throwT <= 0) { this.throwT = A.throwCd; this.throwShield(g, p); }
      }
    }
    throwShield(g, p) {
      const A = CFG.arena.shieldSlave;
      const x0 = this.x - 16, y0 = this.y - 10;
      const dx = p.x - x0, dy = p.y - y0;
      const d = Math.max(160, Math.hypot(dx, dy));
      const t = clamp(d / A.shieldSpd, 0.7, 1.5);
      const vx = dx / t;
      const vy = (dy - 0.5 * A.shieldG * t * t) / t;
      const dmg = Math.round(this.bulletDmg * g.atkScale);
      g.bullets.push(new Bullet(x0, y0, vx, vy,
        { kind: 'orb', r: A.shieldR, dmg, dmgScale: g.atkScale, life: 5, grav: A.shieldG, eb: 'shield' }));
      SFX.shieldThrow();
    }

    /** 皮影客：下方左右移动对齐玩家 x，持续朝正上方投飞刀 */
    aiPuppet(dt, g, p) {
      const A = CFG.arena.puppet;
      this.y = this.restY; this.kbY = 0;
      const ddx = p.x - this.x;
      if (Math.abs(ddx) > 6) this.x += Math.sign(ddx) * A.moveSpd * this.speedMul * dt;   // 左右移动对齐
      this.x = clamp(this.x, 50, CFG.W - 40);
      this.atkT -= dt;
      if (this.atkT <= 0) {
        this.atkT = A.knifeCd;
        const vx = clamp(ddx * 0.12, -50, 50);     // 基本垂直，带极小水平修正
        g.bullets.push(new Bullet(this.x, this.restY - 34, vx, -A.knifeSpd,
          { kind: 'orb', r: A.knifeR, dmg: Math.round(this.bulletDmg * g.atkScale), dmgScale: g.atkScale, life: 4, eb: 'dart' }));
        SFX.knifeThrow();
      }
    }

    /** 自爆囚：缓慢移向中线 → 蓄力（预警）→ 跳起撞击（空中自转 + 火焰拖尾 + 大臭屁）；命中先闪红再自爆 */
    aiBombPrisoner(dt, g, p) {
      const A = CFG.arena.bomb;
      // 引爆前闪红：原地颤抖 0.35s 后自爆
      if (this.redT > 0) {
        this.redT -= dt;
        this.x += Math.sin(this.t * 44) * 0.8;
        if (this.redT <= 0) { this.bombBoom(g, true); this.die(g); }
        return;
      }
      if (!this.air) { this.y = this.restY; this.kbY = 0; }
      if (this.state === 'march') {
        const ddx = this.midX - this.x;
        if (Math.abs(ddx) > 14) this.x += Math.sign(ddx) * A.walkSpd * this.speedMul * dt;   // 缓慢移向中线
        else { this.state = 'windup'; this.windT = A.windup; }
      } else if (this.state === 'windup') {
        this.windT -= dt;
        if (this.windT <= 0) {
          this.air = true; this.state = 'leap'; this.spin = 0;
          this.jumpVy = -A.leapUpV;
          this.jumpVx = (p.x < this.x ? -1 : 1) * A.leapSpd;   // 偏快但可预判
          SFX.fart(true);                            // 大臭屁音效
          burst(g, this.x, this.y + 30, 16, ['#9a9aa2', '#74747c', '#ff8a3c'], 140, 6, 0.6, 80);
        }
      } else if (this.state === 'leap') {
        this.jumpVy += A.grav * dt;
        this.x += this.jumpVx * dt; this.y += this.jumpVy * dt;
        this.spin += dt * 3;                         // 空中慢慢自转
        for (let i = 0; i < 2; i++) {                // 火焰粒子拖尾
          g.particles.push(new Particle(this.x + rand(-10, 10), this.y + rand(-8, 12),
            rand(-30, 30), rand(-50, 10), rand(0.25, 0.5), rand(3, 6),
            ['#ff7b2e', '#ffd23b', '#ff3b1e', '#9a9aa2'][randi(0, 3)]));
        }
        // 命中玩家 → 先闪红再自爆
        if (Math.hypot(p.x - this.x, p.y - this.y) < this.radius + p.radius + 6) {
          this.air = false; this.jumpVx = 0; this.jumpVy = 0;
          this.state = 'preboom'; this.redT = 0.35;
          return;
        }
        // 落地未命中 → 落地沙尘后再次蓄力起跳
        if (this.jumpVy >= 0 && this.y >= this.restY) {
          this.y = this.restY; this.air = false; this.jumpVx = 0; this.jumpVy = 0;
          burst(g, this.x, this.restY + 28, 14, ['#e8ddc0', '#cdb88f', '#ff8a3c'], 150, 5, 0.5, 130);
          SFX.land();
          this.state = 'windup'; this.windT = A.windup;
        }
      }
    }
    /** 自爆囚爆炸：directHit=命中玩家（40% 最大生命）；两种爆炸都波及周围敌人 */
    bombBoom(g, directHit) {
      if (this.exploded) return;
      this.exploded = true;
      const A = CFG.arena.bomb;
      const R = A.blastR;
      burst(g, this.x, this.y, 42, ['#ff7b2e', '#ffd23b', '#ff3b1e', '#9a9aa2', '#fff'], 340, 8, 0.75, 90);
      SFX.explode(true);
      g.shake(13);
      const p = g.player;
      if (p) {
        const d = Math.hypot(p.x - this.x, p.y - this.y);
        if (directHit) {
          p.invT = 0;   // 自爆是延迟重击，无视此前接触的无敌帧，确保 40% 爆炸伤害生效
          p.hurt(Math.round(p.maxHp * A.blastHpFrac), g, this.dsrc);                                  // 命中：40% 最大生命
        } else if (d < R + p.radius) p.hurt(Math.round(18 * g.atkScale * (d < R * 0.5 ? 1 : 0.6)), g, this.dsrc);
      }
      g.aoe(this.x, this.y, R, Math.round(34 * g.atkScale));   // 波及周围敌人（含空中爆炸）
    }

    /** 斧头兵：地面行进步入 → 停步抡斧，朝玩家高弧线慢抛斧头（低伤） */
    aiAxeMinion(dt, g, p) {
      const A = CFG.axeMinion;
      if (!this.air) { this.y = this.restY; this.kbY = 0; }
      if (this.state === 'walk') {
        this.x -= A.walkSpd * this.speedMul * dt;
        this.atkT -= dt;
        if (this.x <= this.haltX) this.state = 'idle';
      } else if (this.state === 'idle') {
        if (p.x < this.x - 320) this.x -= A.walkSpd * 0.5 * this.speedMul * dt;   // 玩家离得太远时缓慢逼近
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.state = 'throwAnim';
          this.throwT = A.throwWind; this.fired = false;
          this.atkT = rand(A.throwCdMin, A.throwCdMax);
        }
      } else if (this.state === 'throwAnim') {
        this.throwT -= dt;
        // 抡到过半时松手出斧
        if (!this.fired && this.throwT <= A.throwWind * 0.5) {
          this.fired = true;
          this.throwAxe(g, p);
        }
        if (this.throwT <= 0) this.state = 'idle';
      }
    }
    /** 高弧线抛斧：飞行时间由水平距离决定（慢），大重力把斧头顶得很高 */
    throwAxe(g, p) {
      const A = CFG.axeMinion;
      const x0 = this.x - 12, y0 = this.y - 28;
      const dx = p.x - x0, dy = p.y - y0;
      const t = clamp(Math.abs(dx) / A.axeSpd, A.tMin, A.tMax);
      const vx = dx / t;
      const vy = (dy - 0.5 * A.axeG * t * t) / t;
      g.bullets.push(new Bullet(x0, y0, vx, vy,
        { kind: 'axe', r: A.axeR, dmg: Math.round(this.bulletDmg * g.atkScale), dmgScale: g.atkScale,
          life: 4, grav: A.axeG, spinRate: 11, color: '#cfd8e3' }));
      SFX.javelinThrow();
    }
    /** 死亡：立即结算奖励，身体旋转飞向天空（延迟爆炸，期间不可被选中/受伤） */
    beginAxeDeath(g) {
      this.dying = true;
      this.state = 'deathFly';
      this.hurtT = 0; this.flash = 0;   // 死亡演出不再挂红染
      g.kills++;
      if (typeof g.roundKills === 'number') g.roundKills++;
      g.score += this.def.score;
      if (window.Ach) window.Ach.evt('enemyDie', { g: g, e: this });
      g.addRage(CFG.ultimate.rageNormal);
      g.gems.push(new Gem(this.x, this.y, this.xpValue || this.def.xp));
      const A = CFG.axeMinion;
      this.air = true;
      this.jumpVy = -A.upV;
      this.jumpVx = rand(-70, 70);
      this.spin = rand(-0.4, 0.4);
      this.spinSpd = A.spinSpd * (Math.random() < 0.5 ? -1 : 1);
      burst(g, this.x, this.y + 8, 10, ['#2e333d', '#e8eef7', '#d83a30', '#ffd23b'], 150, 5, 0.4, 70);
      SFX.javelinThrow();
    }
    /** 死亡演出物理：上升 → 重力下落（衣片拖尾）→ 落地爆炸后真正移除 */
    updateAxeDeath(dt, g) {
      const A = CFG.axeMinion;
      this.jumpVy += A.deathG * dt;
      this.x += this.jumpVx * dt;
      this.y += this.jumpVy * dt;
      this.x = clamp(this.x, 24, CFG.W - 24);
      this.spin += this.spinSpd * dt;
      if (Math.random() < 0.6) {
        g.particles.push(new Particle(this.x + rand(-8, 8), this.y + rand(-10, 10),
          rand(-40, 40), rand(-60, 10), rand(0.3, 0.55), rand(2, 4),
          ['#2e333d', '#e8eef7', '#d83a30'][randi(0, 2)]));
      }
      if (this.jumpVy >= 0 && this.y >= this.restY) {
        this.y = this.restY;
        // 落地爆炸：低伤近距全额/远距六成
        burst(g, this.x, this.restY, 34, ['#ff7b2e', '#ffd23b', '#ff3b1e', '#2e333d', '#fff'], 320, 7, 0.7, 100);
        SFX.explode(false);
        g.shake(7);
        const p = g.player;
        if (p) {
          const d = Math.hypot(p.x - this.x, p.y - this.restY);
          if (d < A.blastR + p.radius) {
            p.hurt(Math.round(A.blastDmg * g.atkScale * (d < A.blastR * 0.5 ? 1 : 0.6)), g, this.dsrc);
          }
        }
        this.dead = true;
      }
    }

    /* 渲染 */
    render(ctx) {
      const flip = this.flash > 0;
      const t = this.animT;
      const hurtRed = this.hurtT > 0;   // 持续受伤红染（不闪烁）
      // 困惑：头顶旋转星圈
      if (this.confuseT > 0) {
        for (let i = 0; i < 3; i++) {
          const ca = this.t * 5 + (TAU / 3) * i;
          const sx = this.x + Math.cos(ca) * this.radius * 0.9;
          const sy = this.y - this.radius - 12 + Math.sin(ca) * 5;
          ctx.fillStyle = ['#ffd93b', '#7fe7ff', '#c99bff'][i];
          ctx.beginPath(); ctx.arc(sx, sy, 3.4, 0, TAU); ctx.fill();
        }
      }
      // 月痕沙海：朝右时整体水平翻转 L 系精灵（以自身 x 为轴）
      const mirrored = this.face > 0;
      if (mirrored) {
        ctx.save();
        ctx.translate(this.x, 0);
        ctx.scale(-1, 1);
        ctx.translate(-this.x, 0);
      }
      switch (this.type) {
        case 'eagle': {
          const spr = Math.floor(t * 7) % 2 === 0 ? Sprites.eagleAL : Sprites.eagleBL;
          drawSprite(ctx, spr, this.x, this.y, 2.2, 2.2, Math.sin(t * 2) * 0.08, this.flash);
          break;
        }
        case 'bat': {
          const spr = Math.floor(t * 12) % 2 === 0 ? Sprites.batAL : Sprites.batBL;
          drawSprite(ctx, spr, this.x, this.y, 2.0, 2.0, 0, this.flash);
          break;
        }
        case 'demon': {
          const spr = Math.floor(t * 5) % 2 === 0 ? Sprites.demonAL : Sprites.demonBL;
          drawSprite(ctx, spr, this.x, this.y, 2.3, 2.3, Math.sin(t * 1.5) * 0.06, this.flash);
          break;
        }
        case 'leigong':
          // 雷公小怪：还原旧版 19×20 像素点阵，缩放 2.2 → 显示约 42×44（Boss 雷公巨兽仍用 leigong.png 重绘图）
          drawSprite(ctx, Sprites.leigongSmallL, this.x, this.y + Math.sin(t * 2) * 3, 2.2, 2.2, 0, this.flash);
          break;
        case 'pig':
          // 火猪血量与体积 ×3（缩放 2.1 → 3.2）
          drawSprite(ctx, Sprites.pigL, this.x, this.y + Math.sin(t * 2.2) * 3, 3.2, 3.2, 0, this.flash);
          break;
        case 'archer': {
          const moving = this.state !== 'stop';
          const bob = moving ? Math.abs(Math.sin(t * (this.state === 'run' ? 16 : 9))) * -4 : 0;
          drawSprite(ctx, Sprites.archerL, this.x, this.y + bob + 8, 4.0, 4.0, 0, this.flash);
          break;
        }
        case 'cannoneer': {
          const moving = this.state !== 'stop';
          const bob = moving ? Math.abs(Math.sin(t * (this.state === 'run' ? 14 : 8))) * -4 : 0;
          drawSprite(ctx, Sprites.cannoneerL, this.x, this.y + bob + 8, 4.0, 4.0, 0, this.flash);
          if (this.state === 'stop' && this.atkT > 0.85) {
            const f = 10 + Math.sin(t * 40) * 4;
            ctx.fillStyle = '#ffd23b';
            ctx.fillRect(this.x - 84 - f, this.y + bob - 8, f, 16);
            ctx.fillStyle = '#ff7b2e';
            ctx.fillRect(this.x - 84 - f, this.y + bob - 4, f * 0.6, 8);
          }
          break;
        }
        case 'superboy': {
          drawSprite(ctx, Sprites.superboyL, this.x, this.y + Math.sin(t * 3.2) * 3, 2.6, 2.6, Math.sin(t * 3.2) * 0.05, this.flash);
          break;
        }
        case 'skull': {
          const pulse = 1 + Math.sin(t * 6) * 0.06;
          drawSprite(ctx, Sprites.skullhead, this.x, this.y, 2.1 * pulse, 2.1 * pulse, this.rotA, this.flash);
          break;
        }
        case 'skeleton': {
          // 黑色骷髅头模型，体积变大（scale 2.0→3.2）
          const pulse = this.state === 'chase' ? 1 + Math.sin(t * 16) * 0.08 : 1;
          const tremble = this.state === 'windup' ? Math.sin(t * 42) * 3 : 0;
          drawSprite(ctx, Sprites.blackSkelL, this.x + tremble, this.y + 3, 3.2 * pulse, 3.2 * pulse, 0, this.flash);
          break;
        }
        case 'bigbat': {
          const spr = Math.floor(t * 9) % 2 === 0 ? Sprites.bigbatA : Sprites.bigbatB;
          // dabianfu_A/B.png 为 352×240（旧 44×30 精灵的 8 倍），缩放 0.425 = 3.4/8，保持与旧版一致的显示尺寸
          drawSprite(ctx, spr, this.x, this.y + Math.sin(t * 3) * 4, 0.425, 0.425, Math.sin(t * 1.8) * 0.06, this.flash);
          break;
        }
        case 'spikebird': {
          const shake = (this.atkT < 0.6) ? Math.sin(t * 40) * 2 : 0;
          const spr = Math.floor(t * 10) % 2 === 0 ? Sprites.spikebirdAL : Sprites.spikebirdBL;
          drawSprite(ctx, spr, this.x + shake, this.y, 2.4, 2.4, Math.sin(t * 2) * 0.06, this.flash);
          break;
        }
        case 'eyefly': {
          const spr = Math.floor(t * 14) % 2 === 0 ? Sprites.eyeflyAL : Sprites.eyeflyBL;
          drawSprite(ctx, spr, this.x, this.y, 2.4, 2.4, 0, this.flash);
          break;
        }
        case 'stonebeetle': {
          const spr = Math.floor(t * 6) % 2 === 0 ? Sprites.stonebeetleAL : Sprites.stonebeetleBL;
          drawSprite(ctx, spr, this.x, this.y, 2.6, 2.6, Math.sin(t * 1.5) * 0.04, this.flash);
          // 蓄力中：胸口水晶发光
          if (this.chargeT > 0) {
            const k = 1 - this.chargeT / 0.9;
            ctx.fillStyle = `rgba(53,224,255,${0.3 + k * 0.5})`;
            ctx.beginPath(); ctx.arc(this.x, this.y - 2, 8 + k * 6, 0, TAU); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(this.x, this.y - 2, 3 + k * 2, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'floatflower': {
          // 花瓣张开阶段用开瓣帧
          const opening = this.openT > 0;
          const spr = opening ? Sprites.floatflowerBL : Sprites.floatflowerAL;
          const pulse = opening ? 1 + Math.sin(t * 18) * 0.06 : 1;
          drawSprite(ctx, spr, this.x, this.y, 2.4 * pulse, 2.4 * pulse, 0, this.flash);
          break;
        }
        case 'stormfish': {
          const spr = Math.floor(t * 11) % 2 === 0 ? Sprites.stormfishAL : Sprites.stormfishBL;
          drawSprite(ctx, spr, this.x, this.y, 2.6, 2.6, Math.sin(t * 2.5) * 0.05, this.flash);
          break;
        }
        case 'twinsnake': {
          const spr = Math.floor(t * 5) % 2 === 0 ? Sprites.twinsnakeAL : Sprites.twinsnakeBL;
          drawSprite(ctx, spr, this.x, this.y, 2.6, 2.6, Math.sin(t * 2) * 0.04, this.flash);
          break;
        }
        case 'owl': {
          const spr = Math.floor(t * 2) % 2 === 0 ? Sprites.owlAL : Sprites.owlBL;
          drawSprite(ctx, spr, this.x, this.y + Math.sin(t * 2) * 2, 2.8, 2.8, 0, this.flash);
          break;
        }
        /* ===== 斗兽场地面小怪（移动时轻微左右晃动）===== */
        case 'javelinSlave': {
          const moving = this.state === 'walk' || this.state === 'aim';
          const fr = this.state === 'aim' ? 14 : 9;          // 助跑冲刺晃得更快
          const sx = moving ? Math.sin(t * fr) * 2.5 : 0;
          const bob = moving ? Math.abs(Math.sin(t * fr)) * -3 : 0;
          const ang = moving ? Math.sin(t * fr) * 0.06 : 0;
          drawSprite(ctx, Sprites.javelinSlaveL, this.x + sx, this.y + bob, this.drawScale, this.drawScale, ang, this.flash);
          break;
        }
        case 'ramFighter': {
          let ang = 0, sx = 0, bob = 0;
          if (this.state === 'leap') {
            ang = clamp(this.jumpVy / 900, -0.25, 0.4);      // 空中按垂直速度俯仰
          } else {
            const moving = this.state === 'walk' || this.state === 'windup' || this.state === 'recenter';
            const fr = this.state === 'windup' ? 16 : 9;
            if (moving) { sx = Math.sin(t * fr) * 2.5; bob = Math.abs(Math.sin(t * fr)) * -3; ang = Math.sin(t * fr) * 0.06; }
          }
          drawSprite(ctx, Sprites.ramFighterL, this.x + sx, this.y + bob, this.drawScale, this.drawScale, ang, this.flash);
          break;
        }
        case 'shieldSlave': {
          const moving = this.state === 'walk';
          const sx = moving ? Math.sin(t * 9) * 2.2 : 0;
          const bob = moving ? Math.abs(Math.sin(t * 9)) * -3 : 0;
          const ang = moving ? Math.sin(t * 9) * 0.05 : 0;
          drawSprite(ctx, Sprites.shieldSlaveL, this.x + sx, this.y + bob, this.drawScale, this.drawScale, ang, this.flash);
          break;
        }
        case 'puppet': {
          // 皮影客始终在下方左右游移
          const sx = Math.sin(t * 11) * 3;
          const bob = Math.abs(Math.sin(t * 11)) * -3;
          const ang = Math.sin(t * 11) * 0.08;
          drawSprite(ctx, Sprites.puppetL, this.x + sx, this.y + bob, this.drawScale, this.drawScale, ang, this.flash);
          break;
        }
        case 'bombPrisoner': {
          let ang = 0, sx = 0, bob = 0;
          if (this.state === 'leap') {
            ang = this.spin;                                 // 跳起时自身慢慢自转
          } else if (this.redT > 0) {
            sx = Math.sin(t * 44) * 3;                       // 引爆前颤抖
            ang = Math.sin(t * 44) * 0.1;
          } else if (this.state === 'windup') {
            sx = Math.sin(t * 38) * 2.2;                     // 蓄力微颤
          } else {
            sx = Math.sin(t * 9) * 2.2; bob = Math.abs(Math.sin(t * 9)) * -3; ang = Math.sin(t * 9) * 0.05;
          }
          if (this.redT > 0 && Math.floor(t * 18) % 2 === 0) {
            const w = Sprites.bombPrisonerL.width * this.drawScale, h = Sprites.bombPrisonerL.height * this.drawScale;
            drawSpriteTinted(ctx, Sprites.bombPrisonerL, this.x + sx, this.y + bob, w, h, ang, '#ff2a1a', 0.85);  // 闪红
          } else {
            drawSprite(ctx, Sprites.bombPrisonerL, this.x + sx, this.y + bob, this.drawScale, this.drawScale, ang, this.flash);
          }
          break;
        }
        case 'axeMinion': {
          // 像素点阵西装斧头兵：行走颠簸摇摆；抡斧前摇切高举帧；死亡绕中心旋转飞天（与自爆囚 leap 同用 spin）
          const moving = !this.dying && this.state === 'walk';
          const bob = moving ? Math.abs(Math.sin(t * 9)) * -3 : 0;
          const sx = moving ? Math.sin(t * 9) * 2.2 : 0;
          const ang = this.dying ? this.spin : (moving ? Math.sin(t * 9) * 0.05 : 0);
          const spr = (!this.dying && this.state === 'throwAnim') ? Sprites.axeMinionUpL : Sprites.axeMinionL;
          drawSprite(ctx, spr, this.x + sx, this.y - 6 + bob, 3, 3, ang, this.flash);
          break;
        }
      }
      if (mirrored) ctx.restore();
      // 魔眼飞虫锁定准星：世界坐标绘制（不能随精灵镜像翻转）
      if (this.type === 'eyefly' && this.lockT > 0) {
        ctx.strokeStyle = `rgba(255,60,60,${0.5 + Math.sin(t * 20) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.lockX, this.lockY, 14, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.lockX - 20, this.lockY); ctx.lineTo(this.lockX - 8, this.lockY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.lockX + 8, this.lockY); ctx.lineTo(this.lockX + 20, this.lockY); ctx.stroke();
      }
      // 小黑骷髅自爆预警：扩张虚线圈 + 脉动爆点
      if (this.type === 'skeleton' && this.state === 'windup') {
        const S = CFG.skeleton;
        const k = clamp(this.stateT / S.windup, 0, 1);
        const r = S.blastR * k;
        ctx.save();
        ctx.strokeStyle = `rgba(255,70,30,${0.4 + k * 0.5})`;
        ctx.lineWidth = 3 + k * 4;
        ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(255,90,30,${0.08 + k * 0.18})`;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = Math.floor(t * 16) % 2 ? '#ff3b1a' : '#ffd23b';
        ctx.beginPath(); ctx.arc(this.x, this.y, 8 + k * 12, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // 持续受伤红染：叠加半透明红色（连续命中时 hurtT 不会归零，呈持续红光而非闪烁）
      if (hurtRed) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,40,40,0.32)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 1.3, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      // 元素 DoT 视觉提示
      if (this.dotT > 0) {
        const dotColor = this.dotType === 'flame' ? 'rgba(255,80,0,0.3)' :
                         this.dotType === 'poison' ? 'rgba(40,200,40,0.3)' :
                         'rgba(80,180,255,0.3)';
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 1.2, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      // 冻结：冰块覆盖
      if (this.freezeT > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(120,200,255,0.45)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 1.15, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(180,230,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      // 元素异常像素标记：灼烧裂纹 / 腐蚀斑块 / 冰霜覆盖
      renderElemMarks(ctx, this);
      // 出场无敌期：金色脉动护盾环
      if (this.spawnInvuln > 0) {
        const rr = this.radius + 6 + Math.sin(this.t * 12) * 3;
        ctx.strokeStyle = `rgba(255,210,59,${0.45 + Math.sin(this.t * 12) * 0.3})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, rr, 0, TAU); ctx.stroke();
      }
      // 小型血条（精英）
      if (this.def.elite && this.hp < this.maxHp) {
        const w = this.radius * 2.2;
        ctx.fillStyle = '#000'; ctx.fillRect(this.x - w / 2 - 1, this.y - this.radius - 12, w + 2, 6);
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(this.x - w / 2, this.y - this.radius - 11, w * clamp(this.hp / this.maxHp, 0, 1), 4);
      }
    }
  }

  /* ---------------- 地面障碍物（飞虎撞击掉 30% 生命并撞碎；各地图外形不同，阻碍特性与草地一致） ---------------- */
  const ROCK_DEBRIS = ['#7d8794', '#a7b3c2', '#5a5f66', '#fff', '#ff7b2e'];
  const OBS = {
    // 草原山石（原样保留）：grass0 大 / grass1 中 / grass2 小 / grass3 长梯形 / grass4 短梯形
    grass0: { w: 480, h: 130, shape: 'rock', v: 0 },
    grass1: { w: 240, h: 86,  shape: 'rock', v: 1 },
    grass2: { w: 192, h: 66,  shape: 'rock', v: 2 },
    grass3: { w: 420, h: 118, trap: true, trapInset: 0.27, shape: 'rock', v: 3 },
    grass4: { w: 250, h: 88,  trap: true, trapInset: 0.27, shape: 'rock', v: 4 },
    // 沙漠·仙人掌（高/中/低）
    cactusT: { w: 76, h: 152, shape: 'cactus', v: 0, debris: ['#3f8f4b', '#2f6e39', '#5cb868', '#dff2d0', '#ff7b2e'] },
    cactusM: { w: 62, h: 108, shape: 'cactus', v: 1, debris: ['#3f8f4b', '#2f6e39', '#5cb868', '#dff2d0', '#ff7b2e'] },
    cactusL: { w: 46, h: 64,  shape: 'cactus', v: 2, debris: ['#3f8f4b', '#2f6e39', '#5cb868', '#dff2d0'] },
    // 雪地·冰山（高/中/低，上窄下宽尖顶）
    iceT: { w: 150, h: 150, trap: true, trapInset: 0.40, shape: 'ice', v: 0, debris: ['#eaf7ff', '#b9dcf2', '#9fcde8', '#fff', '#8fd0ff'] },
    iceM: { w: 118, h: 100, trap: true, trapInset: 0.40, shape: 'ice', v: 1, debris: ['#eaf7ff', '#b9dcf2', '#9fcde8', '#fff'] },
    iceL: { w: 92,  h: 62,  trap: true, trapInset: 0.40, shape: 'ice', v: 2, debris: ['#eaf7ff', '#b9dcf2', '#9fcde8'] },
    // 火焰山·尖锐石头（高/中/低，暗色熔岩裂纹）
    vrockT: { w: 140, h: 140, shape: 'vrock', v: 0, debris: ['#3d2a28', '#54342d', '#6e4438', '#ff7b2e', '#ffd23b'] },
    vrockM: { w: 112, h: 92,  shape: 'vrock', v: 1, debris: ['#3d2a28', '#54342d', '#6e4438', '#ff7b2e'] },
    vrockL: { w: 88,  h: 58,  shape: 'vrock', v: 2, debris: ['#3d2a28', '#54342d', '#ff7b2e'] },
    // 紫色荒地·枯木（高/中/低，矮株为树桩）
    treeT: { w: 84, h: 164, shape: 'tree', v: 0, debris: ['#4a3340', '#35242f', '#5e4458', '#ff7b2e'] },
    treeM: { w: 70, h: 112, shape: 'tree', v: 1, debris: ['#4a3340', '#35242f', '#5e4458'] },
    treeL: { w: 58, h: 56,  shape: 'tree', v: 2, debris: ['#4a3340', '#35242f', '#5e4458'] },
    // 赛博朋克都市：电线杆（高）/ 电话亭（低）/ 小破楼（中）
    poleT:   { w: 34,  h: 172, shape: 'pole', debris: ['#54402e', '#3a2c20', '#8a8f98', '#f5d742'] },
    boothL:  { w: 66,  h: 92,  shape: 'booth', debris: ['#161c2b', '#35e0ff', '#ff4fd8', '#9fe8ff', '#fff'] },
    buildM:  { w: 224, h: 126, shape: 'building', debris: ['#2b303c', '#20252e', '#ffd93b', '#35e0ff', '#ff4fd8'] },
    // 大海：礁石（高/中，上窄下宽）/ 珊瑚（低）
    reefT:  { w: 126, h: 138, trap: true, trapInset: 0.30, shape: 'reef', v: 0, debris: ['#5f7480', '#465863', '#87a0ad', '#dff1fa'] },
    reefM:  { w: 100, h: 92,  trap: true, trapInset: 0.30, shape: 'reef', v: 1, debris: ['#5f7480', '#465863', '#87a0ad'] },
    coralL: { w: 92,  h: 70,  shape: 'coral', debris: ['#ff6f61', '#d6485e', '#ffc48a', '#fff'] },
    // 罗马角斗场·地刺（高/中/低）：铁刺条底座 + 一排向上尖刺
    spikeT: { w: 152, h: 132, trap: true, trapInset: 0.34, shape: 'spike', v: 0, debris: ['#7d8794', '#a7b3c2', '#5a5f66', '#fff', '#ff7b2e'] },
    spikeM: { w: 118, h: 96,  trap: true, trapInset: 0.34, shape: 'spike', v: 1, debris: ['#7d8794', '#a7b3c2', '#5a5f66', '#fff'] },
    spikeL: { w: 92,  h: 62,  trap: true, trapInset: 0.34, shape: 'spike', v: 2, debris: ['#7d8794', '#a7b3c2', '#5a5f66'] },

    // —— 丛林：扭曲巨树（地）/ 不规则藤蔓（顶）；含 XL 高大形态 ——
    jTrunkXL: { w: 150, h: 168, shape: 'jtrunk', v: 3, debris: ['#5a4128', '#3a2a18', '#2f6e39', '#1e4d24', '#9bc84b'] },
    jTrunkT: { w: 128, h: 140, shape: 'jtrunk', v: 0, debris: ['#5a4128', '#3a2a18', '#2f6e39', '#1e4d24', '#9bc84b'] },
    jTrunkM: { w: 104, h: 108, shape: 'jtrunk', v: 1, debris: ['#5a4128', '#3a2a18', '#2f6e39', '#5cb868'] },
    jLeafL:  { w: 112, h: 68,  shape: 'jtrunk', v: 2, debris: ['#2f6e39', '#1e4d24', '#5cb868', '#9bc84b'] },
    jVineXL: { w: 128, h: 150, trap: true, trapInset: 0.46, shape: 'jvine', v: 3, debris: ['#2f6e39', '#1e4d24', '#5cb868', '#9bc84b'] },
    jVineT:  { w: 104, h: 132, trap: true, trapInset: 0.42, shape: 'jvine', v: 0, debris: ['#2f6e39', '#1e4d24', '#5cb868', '#9bc84b'] },
    jVineM:  { w: 84,  h: 100, trap: true, trapInset: 0.42, shape: 'jvine', v: 1, debris: ['#2f6e39', '#1e4d24', '#5cb868'] },
    jVineL:  { w: 64,  h: 66,  trap: true, trapInset: 0.42, shape: 'jvine', v: 2, debris: ['#2f6e39', '#5cb868', '#9bc84b'] },
    // —— 海底：尖锐礁岩+珊瑚（地）/ 长海藻帘（顶）——
    sbReefXL:{ w: 150, h: 150, trap: true, trapInset: 0.36, shape: 'sbreef', v: 3, debris: ['#1f5a6e', '#2f7d8c', '#5fb8a8', '#ff8a6e', '#ffc48a'] },
    sbReefT: { w: 132, h: 128, trap: true, trapInset: 0.34, shape: 'sbreef', v: 0, debris: ['#1f5a6e', '#2f7d8c', '#5fb8a8', '#ff8a6e'] },
    sbReefM: { w: 104, h: 96,  trap: true, trapInset: 0.34, shape: 'sbreef', v: 1, debris: ['#1f5a6e', '#2f7d8c', '#5fb8a8'] },
    sbCoralL:{ w: 96,  h: 66,  shape: 'sbreef', v: 2, debris: ['#ff8a6e', '#d65e52', '#ffc48a', '#5fb8a8'] },
    sbKelpXL:{ w: 120, h: 158, trap: true, trapInset: 0.48, shape: 'sbkelp', v: 3, debris: ['#2f8f6e', '#1f6e58', '#7fd8b0', '#bfe8d8'] },
    sbKelpT: { w: 96,  h: 132, trap: true, trapInset: 0.45, shape: 'sbkelp', v: 0, debris: ['#2f8f6e', '#1f6e58', '#7fd8b0', '#bfe8d8'] },
    sbKelpM: { w: 76,  h: 96,  trap: true, trapInset: 0.45, shape: 'sbkelp', v: 1, debris: ['#2f8f6e', '#1f6e58', '#7fd8b0'] },
    sbKelpL: { w: 56,  h: 66,  trap: true, trapInset: 0.45, shape: 'sbkelp', v: 2, debris: ['#2f8f6e', '#7fd8b0'] },
    // —— 雪地：地面冰锥/冰壁/冰笋；顶部冰锥帘 ——
    iceWall: { w: 160, h: 118, trap: true, trapInset: 0.30, shape: 'icewall', v: 0, debris: ['#dff0fb', '#a9d2ee', '#7fb6dc', '#5f748c', '#fff'] },
    iceSpire:{ w: 96,  h: 160, trap: true, trapInset: 0.42, shape: 'ice', v: 3, debris: ['#eaf7ff', '#b9dcf2', '#9fcde8', '#8fd0ff'] },
    icicleXL:{ w: 150, h: 150, trap: true, trapInset: 0.42, shape: 'icicle', v: 3, debris: ['#eaf7ff', '#b9dcf2', '#9fcde8', '#fff', '#8fd0ff'] },
    icicleT: { w: 132, h: 128, trap: true, trapInset: 0.40, shape: 'icicle', v: 0, debris: ['#eaf7ff', '#b9dcf2', '#9fcde8', '#fff'] },
    icicleM: { w: 104, h: 96,  trap: true, trapInset: 0.40, shape: 'icicle', v: 1, debris: ['#eaf7ff', '#b9dcf2', '#9fcde8', '#fff'] },
    icicleL: { w: 84,  h: 66,  trap: true, trapInset: 0.40, shape: 'icicle', v: 2, debris: ['#eaf7ff', '#b9dcf2', '#9fcde8'] },
    // —— 城堡：石墙/塔楼/巨塔（规整石块 + 城垛）——
    cwXL:    { w: 118, h: 172, shape: 'cwall', v: 3, debris: ['#8a6a45', '#c99a5e', '#e8c084', '#7a5a3a', '#d86a3a'] },
    cwT:    { w: 104, h: 140, shape: 'cwall', v: 0, debris: ['#8a6a45', '#c99a5e', '#e8c084', '#7a5a3a', '#d86a3a'] },
    cwM:    { w: 124, h: 104, shape: 'cwall', v: 1, debris: ['#8a6a45', '#c99a5e', '#e8c084', '#7a5a3a'] },
    cwL:    { w: 80,  h: 66,  shape: 'cwall', v: 2, debris: ['#8a6a45', '#c99a5e', '#e8c084'] },
    cwTopXL:{ w: 118, h: 172, shape: 'cwall', v: 3, debris: ['#8a6a45', '#c99a5e', '#e8c084', '#7a5a3a', '#d86a3a'] },
    cwTopT: { w: 104, h: 140, shape: 'cwall', v: 0, debris: ['#8a6a45', '#c99a5e', '#e8c084', '#7a5a3a'] },
    cwTopM: { w: 124, h: 104, shape: 'cwall', v: 1, debris: ['#8a6a45', '#c99a5e', '#e8c084'] },
    cwTopL: { w: 80,  h: 66,  shape: 'cwall', v: 2, debris: ['#8a6a45', '#c99a5e', '#e8c084'] },
    // —— 天空：漂浮巨石/断柱/巨型浮岛 ——
    flXL:   { w: 150, h: 150, shape: 'floatr', v: 3, debris: ['#4a5066', '#6b7390', '#9aa2c0', '#3a4056'] },
    flT:    { w: 120, h: 136, shape: 'floatr', v: 0, debris: ['#4a5066', '#6b7390', '#9aa2c0', '#8a90a8'] },
    flM:    { w: 96,  h: 100, shape: 'floatr', v: 1, debris: ['#4a5066', '#6b7390', '#9aa2c0'] },
    flL:    { w: 74,  h: 66,  shape: 'floatr', v: 2, debris: ['#4a5066', '#6b7390', '#9aa2c0'] },
    flTopXL:{ w: 150, h: 150, shape: 'floatr', v: 3, debris: ['#4a5066', '#6b7390', '#9aa2c0'] },
    flTopT: { w: 120, h: 136, shape: 'floatr', v: 0, debris: ['#4a5066', '#6b7390', '#9aa2c0'] },
    flTopM: { w: 96,  h: 100, shape: 'floatr', v: 1, debris: ['#4a5066', '#6b7390', '#9aa2c0'] },
    flTopL: { w: 74,  h: 66,  shape: 'floatr', v: 2, debris: ['#4a5066', '#6b7390', '#9aa2c0'] },
    // —— 仙人洞：几何方石/高方柱/悬浮石板（冷青描边）——
    cbXL:   { w: 88,  h: 160, shape: 'cblock', v: 3, debris: ['#aebac4', '#d3dde5', '#eef3f7', '#6fa8b8'] },
    cbT:    { w: 76,  h: 140, shape: 'cblock', v: 0, debris: ['#c8d2dc', '#e4ecf2', '#f4f8fb', '#7fc8d8'] },
    cbM:    { w: 60,  h: 104, shape: 'cblock', v: 1, debris: ['#c8d2dc', '#e4ecf2', '#f4f8fb', '#7fc8d8'] },
    cbL:    { w: 104, h: 66,  shape: 'cblock', v: 2, debris: ['#c8d2dc', '#e4ecf2', '#7fc8d8'] },
    cbTopXL:{ w: 88,  h: 160, shape: 'cblock', v: 3, debris: ['#aebac4', '#d3dde5', '#6fa8b8'] },
    cbTopT: { w: 76,  h: 140, shape: 'cblock', v: 0, debris: ['#c8d2dc', '#e4ecf2', '#7fc8d8'] },
    cbTopM: { w: 60,  h: 104, shape: 'cblock', v: 1, debris: ['#c8d2dc', '#e4ecf2', '#7fc8d8'] },
    cbTopL: { w: 104, h: 66,  shape: 'cblock', v: 2, debris: ['#c8d2dc', '#7fc8d8'] },
    // —— 群山：尖峰/双峰/平顶山台/石笋（地）；悬崖（顶，同造型翻转）——
    mtPeak: { w: 110, h: 172, trap: true, trapInset: 0.38, shape: 'mpeak', v: 0, debris: ['#5a6268', '#7a8478', '#9aa392', '#3c4a3a', '#c8d4d0'] },
    mtTwin: { w: 150, h: 136, trap: true, trapInset: 0.36, shape: 'mpeak', v: 1, debris: ['#5a6268', '#7a8478', '#9aa392', '#c8d4d0'] },
    mtPine: { w: 88,  h: 72,  shape: 'mpeak', v: 2, debris: ['#5a6268', '#3c3226', '#3c4a3a', '#56684f'] },
    mtMesa: { w: 150, h: 118, trap: true, trapInset: 0.30, shape: 'mpeak', v: 3, debris: ['#6a7068', '#828a7e', '#a2aaa0', '#5a6268'] },
    mtSpire:{ w: 86,  h: 150, trap: true, trapInset: 0.42, shape: 'mpeak', v: 4, debris: ['#5a6268', '#7a8478', '#9aa392', '#c8d4d0'] },
    mtTopPeak: { w: 110, h: 172, trap: true, trapInset: 0.38, shape: 'mpeak', v: 0, debris: ['#5a6268', '#7a8478', '#9aa392'] },
    mtTopTwin: { w: 150, h: 136, trap: true, trapInset: 0.36, shape: 'mpeak', v: 1, debris: ['#5a6268', '#7a8478', '#9aa392'] },
    mtTopMesa: { w: 150, h: 118, trap: true, trapInset: 0.30, shape: 'mpeak', v: 3, debris: ['#6a7068', '#828a7e', '#a2aaa0'] },
    mtTopSpire:{ w: 86,  h: 150, trap: true, trapInset: 0.42, shape: 'mpeak', v: 4, debris: ['#5a6268', '#7a8478', '#9aa392'] },
    // —— 魔窟：巨型钟乳/石笋簇（上下翻转通用）——
    dcXL:   { w: 140, h: 160, trap: true, trapInset: 0.42, shape: 'dstal', v: 3, debris: ['#1a1428', '#2c2240', '#4a3868', '#7a4cd8', '#ff8a3c'] },
    dcT:    { w: 120, h: 140, trap: true, trapInset: 0.40, shape: 'dstal', v: 0, debris: ['#1a1428', '#2c2240', '#4a3868', '#7a4cd8', '#ff8a3c'] },
    dcM:    { w: 96,  h: 100, trap: true, trapInset: 0.40, shape: 'dstal', v: 1, debris: ['#1a1428', '#2c2240', '#7a4cd8'] },
    dcL:    { w: 76,  h: 66,  trap: true, trapInset: 0.40, shape: 'dstal', v: 2, debris: ['#1a1428', '#2c2240', '#ff8a3c'] },
    dcTopXL:{ w: 140, h: 160, trap: true, trapInset: 0.42, shape: 'dstal', v: 3, debris: ['#1a1428', '#2c2240', '#4a3868', '#7a4cd8'] },
    dcTopT: { w: 120, h: 140, trap: true, trapInset: 0.40, shape: 'dstal', v: 0, debris: ['#1a1428', '#2c2240', '#4a3868', '#7a4cd8'] },
    dcTopM: { w: 96,  h: 100, trap: true, trapInset: 0.40, shape: 'dstal', v: 1, debris: ['#1a1428', '#2c2240', '#7a4cd8'] },
    dcTopL: { w: 76,  h: 66,  trap: true, trapInset: 0.40, shape: 'dstal', v: 2, debris: ['#1a1428', '#2c2240'] },
    // —— 矩阵：数据方块/高塔/线框（上下对称）——
    mxXL:   { w: 104, h: 158, shape: 'datab', v: 3, debris: ['#0a0f14', '#123026', '#35ff9e', '#35e0ff', '#b46aff'] },
    mxT:    { w: 88,  h: 140, shape: 'datab', v: 0, debris: ['#0a0f14', '#123026', '#35ff9e', '#35e0ff', '#b46aff'] },
    mxM:    { w: 72,  h: 100, shape: 'datab', v: 1, debris: ['#0a0f14', '#123026', '#35ff9e', '#35e0ff'] },
    mxL:    { w: 108, h: 66,  shape: 'datab', v: 2, debris: ['#0a0f14', '#123026', '#35ff9e'] },
    mxTopXL:{ w: 104, h: 158, shape: 'datab', v: 3, debris: ['#0a0f14', '#123026', '#35ff9e'] },
    mxTopT: { w: 88,  h: 140, shape: 'datab', v: 0, debris: ['#0a0f14', '#123026', '#35ff9e'] },
    mxTopM: { w: 72,  h: 100, shape: 'datab', v: 1, debris: ['#0a0f14', '#123026', '#35ff9e'] },
    mxTopL: { w: 108, h: 66,  shape: 'datab', v: 2, debris: ['#0a0f14', '#123026', '#35ff9e'] }
  };

  /* ============================================================
   * 破碎障碍物（Breakable）：玩家子弹累计命中 hp 次炸毁；接触玩家造成伤害
   * 高度按需求取屏幕宽度的百分比（960 * ratio）；地面型锚定 GROUND_Y，漂浮型在屏幕中部上下浮动
   * ============================================================ */
  const BREAK = {
    // 城堡：中世纪军事塔楼（高=屏宽40%）
    bkTower: { w: 96,  h: Math.round(CFG.W * 0.40), hp: 40, shape: 'bktower',
      debris: ['#a89a7e', '#8a7d64', '#c8bca2', '#5e5546', '#3a342c'] },
    // 天空：巨大建筑残骸（高=屏宽50%，漂浮）
    bkWreck: { w: 128, h: Math.round(CFG.W * 0.50), hp: 40, shape: 'bkwreck', float: true,
      debris: ['#4a5468', '#333c4e', '#7fe3ff', '#9aa6bd', '#20262f'] },
    // 仙人洞：持续转动的白色魔方（高=屏宽40%，漂浮）
    bkCube: { w: Math.round(CFG.W * 0.40), h: Math.round(CFG.W * 0.40), hp: 50, shape: 'bkcube', float: true,
      debris: ['#f4f8fc', '#cdd9e6', '#8fe8ff', '#9fb4c8', '#ffffff'] },
    // 群山：巨大尖锐山峰（高=屏宽70%，接地）
    bkPeak: { w: 176, h: Math.round(CFG.W * 0.70), hp: 50, shape: 'bkpeak',
      debris: ['#6d7880', '#525c63', '#8b98a0', '#cdd8de', '#3f484e'] },
    // 群山：低矮宽阔山峰（较宽，高=屏宽50%，接地）
    bkMesa: { w: 300, h: Math.round(CFG.W * 0.50), hp: 40, shape: 'bkmesa',
      debris: ['#727d82', '#565f64', '#93a0a4', '#aab6ba', '#464e53'] },
    // 魔窟：幽蓝荧光枯木（较宽，高=屏宽80%，接地，3 种样式随机）
    bkWood: { w: 150, h: Math.round(CFG.W * 0.80), hp: 60, shape: 'bkwood', styles: 3,
      debris: ['#15122a', '#0c0a1c', '#2c2350', '#54e0ff', '#7af0ff', '#3a9cff'] }
  };

  /** 像素块填充（坐标自动取整） */
  function obsPx(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  class Rock {
    /** shapeId：OBS 表中的障碍造型 id（草原为 grass0..grass4）；fromTop=true 为顶部悬挂障碍（垂直翻转渲染，碰撞盒不变） */
    constructor(x, shapeId, fromTop) {
      this.shapeId = shapeId;
      this.kind = shapeId;
      this.def = OBS[shapeId] || OBS.grass0;
      this.w = this.def.w;
      this.h = this.def.h;
      this.trap = !!this.def.trap;
      this.fromTop = !!fromTop;
      this.x = x;                         // 中心 x
      // 地面障碍 baseY=地面；顶部障碍自屏幕上沿（y=0）垂挂，与屏幕边界衔接
      this.baseY = fromTop ? this.def.h : CFG.GROUND_Y;
      this.dead = false;
      this.warned = false;
      this.flashT = 0;       // 剩余闪白时长（秒）
      this.flashCd = 0;      // 闪白冷却剩余（秒，含闪白持续期）
    }
    get left() { return this.x - this.w / 2; }
    get top() { return this.baseY - this.h; }
    get debris() { return this.def.debris || ROCK_DEBRIS; }
    /** 被飞虎撞碎 / 野鸡撞击 / 炮弹炸毁：明显碎裂 + 爆炸（大块碎石炸飞、火星、冲击环、屏幕闪光） */
    destroy(g, big) {
      if (this.dead) return;
      this.dead = true;
      const cx = this.x, cy = this.baseY - this.h * 0.4;
      const cols = this.debris;
      // 大块碎石：像素块向上炸飞后重力坠落（碎裂主体）
      const chunkN = big ? 22 : 14;
      for (let i = 0; i < chunkN; i++) {
        const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);        // 上半圆
        const sp = rand(140, big ? 460 : 340);
        g.particles.push(new Particle(
          cx + rand(-this.w * 0.3, this.w * 0.3), cy + rand(-this.h * 0.3, this.h * 0.2),
          Math.cos(a) * sp, Math.sin(a) * sp - rand(60, 160),
          rand(0.7, big ? 1.4 : 1.1), rand(9, big ? 22 : 16),
          cols[randi(0, Math.min(cols.length - 1, 3))], 780));
      }
      // 细碎渣
      burst(g, cx, cy, big ? 30 : 22, cols, 320, 7, 0.8, 520);
      // 爆炸火星 + 白热核心
      burst(g, cx, cy, big ? 30 : 20, ['#ff7b2e', '#ffd23b', '#fff5d0', '#fff'], big ? 440 : 340, 6, 0.55, 240);
      for (let i = 0; i < (big ? 6 : 3); i++) {
        g.particles.push(new Particle(cx, cy, rand(-60, 60), rand(-60, 60), 0.22, rand(14, 24), '#fff5d0', 0));
      }
      // 冲击波环
      if (g.fxRings) g.fxRings.push({ x: cx, y: cy, r: 14, vr: big ? 1050 : 820, t: 0, life: big ? 0.45 : 0.38, col: '#ffd9b0' });
      SFX.explode(!!big);
      g.shake(big ? 10 : 7);
      if (big) { g.flashT = Math.max(g.flashT, 0.22); g.flashColor = '#ffd9b0'; }
    }
    /** 点是否在障碍截面内（梯形按上窄下宽收边） */
    contains(px, py, pad) {
      pad = pad || 0;
      if (px < this.left - pad || px > this.left + this.w + pad) return false;
      if (py < this.top - pad || py > this.baseY + pad) return false;
      if (this.trap) {
        const t = clamp((this.baseY - py) / this.h, 0, 1);
        const inset = t * this.w * (this.def.trapInset || 0.27);
        return px > this.left + inset - pad && px < this.left + this.w - inset + pad;
      }
      return true;
    }
    update(dt, g) {
      this.x -= 62 * dt * (g.map.scrollMul || 1);   // 与地面卷轴同步
      if (this.x < -this.w / 2 - 60) this.dead = true;
      // 闪白计时与触发：玩家横向接近时闪白 2s，之后 3s 冷却
      this.flashT = Math.max(0, this.flashT - dt);
      this.flashCd = Math.max(0, this.flashCd - dt);
      const p = g.player;
      if (this.flashCd <= 0 && p.hp > 0 &&
          p.x > this.left - 130 && p.x < this.left + this.w + 70) {
        this.flashT = 2;
        this.flashCd = 2 + 3;     // 闪白 2s + 冷却 3s
      }
      // 与飞虎碰撞：撞碎障碍！飞虎损失 30% 最大生命（走统一受伤通道：取整/防护罩/血怒/生命条数），障碍碎裂爆炸
      if (this.contains(p.x, p.y, p.radius * 0.55) && p.invT <= 0) {
        p.hurt(Math.round(p.maxHp * 0.3), g, { k: 'env', key: 'rock' });
        // 撞击点火花
        burst(g, p.x, p.y, 18, ['#ff7b2e', '#ffd23b', '#fff5d0', '#fff'], 380, 6, 0.5, 200);
        // 障碍碎裂爆炸（大块碎石 + 火星 + 冲击环）
        this.destroy(g, true);
        // 击退：弹向远离障碍一侧；地面障碍向上弹，顶部悬挂障碍向下弹
        p.x += (p.x < this.x ? -1 : 1) * 40;
        if (this.fromTop) p.y = Math.min(CFG.GROUND_Y, p.y + 56);
        else p.y = Math.max(CFG.TOP_Y, p.y - 56);
      }
      // 小怪撞障碍：坠毁死亡（地面单位 / Boss 不受影响）
      for (const e of g.enemies) {
        if (e.dead || e.groundUnit) continue;
        if (this.contains(e.x, e.y, e.radius * 0.7)) {
          const cols = this.debris.slice(0, 3).concat(e.deathColors());
          burst(g, e.x, e.y, 18, cols, 250, 5, 0.6, 240);
          SFX.explode(false);
          g.shake(5);
          e.die(g);
        }
      }
      // 可破坏弹（野鸡炮弹/导弹）：命中障碍 → 障碍爆炸
      for (const b of g.bullets) {
        if (b.friendly || b.dead || !b.rockBreak) continue;
        if (this.contains(b.x, b.y, b.r + 4)) {
          b.dead = true;
          burst(g, b.x, b.y, 12, ['#ff7b2e', '#ffd23b', '#fff'], 220, 5, 0.45, 120);
          this.destroy(g);
          break;
        }
      }
    }
    render(ctx) {
      const draw = (c) => {
        c.save();
        // 顶部悬挂障碍：以障碍水平中线为轴垂直翻转（宽基在顶、尖端朝下）
        if (this.fromTop) { c.translate(0, 2 * this.baseY - this.h); c.scale(1, -1); }
        switch (this.def.shape) {
          case 'cactus': drawCactus(c, this); break;
          case 'ice': drawIce(c, this); break;
          case 'vrock': drawVrock(c, this); break;
          case 'tree': drawTree(c, this); break;
          case 'pole': drawPole(c, this); break;
          case 'booth': drawBooth(c, this); break;
          case 'building': drawBuilding(c, this); break;
          case 'reef': drawReef(c, this); break;
          case 'coral': drawCoral(c, this); break;
          case 'spike': drawSpike(c, this); break;
          case 'jtrunk': drawJungleTrunk(c, this); break;
          case 'jvine': drawJungleVine(c, this); break;
          case 'sbreef': drawSeabedReef(c, this); break;
          case 'sbkelp': drawSeabedKelp(c, this); break;
          case 'icicle': drawIce(c, this); break;
          case 'icewall': drawIceWall(c, this); break;
          case 'cwall': drawCastleWall(c, this); break;
          case 'floatr': drawFloatRock(c, this); break;
          case 'cblock': drawCaveBlock(c, this); break;
          case 'mpeak': drawMountainRock(c, this); break;
          case 'dstal': drawDemonStal(c, this); break;
          case 'datab': drawDataBlock(c, this); break;
          default: this.renderRock(c);
        }
        c.restore();
      };
      if (this.flashT > 0) {
        // 闪白：先将障碍绘制到离屏画布，再生成白色剪影叠加（仅染色障碍本体像素）
        const pad = 36;
        const ow = Math.ceil(this.w + pad * 2);
        const oh = Math.ceil(this.h + pad * 2);
        const off = Rock._off || (Rock._off = document.createElement('canvas'));
        if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh; }
        const octx = off.getContext('2d');
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.globalAlpha = 1;
        octx.globalCompositeOperation = 'source-over';
        octx.clearRect(0, 0, ow, oh);
        octx.translate(-this.left + pad, -(this.baseY - this.h) + pad);
        draw(octx);
        // 白色剪影画布
        const off2 = Rock._off2 || (Rock._off2 = document.createElement('canvas'));
        if (off2.width !== ow || off2.height !== oh) { off2.width = ow; off2.height = oh; }
        const o2 = off2.getContext('2d');
        o2.setTransform(1, 0, 0, 1, 0, 0);
        o2.globalAlpha = 1;
        o2.globalCompositeOperation = 'source-over';
        o2.clearRect(0, 0, ow, oh);
        o2.fillStyle = '#ffffff';
        o2.fillRect(0, 0, ow, oh);
        o2.globalCompositeOperation = 'destination-in';
        o2.drawImage(off, 0, 0);
        o2.globalCompositeOperation = 'source-over';
        // 绘制障碍本体
        ctx.drawImage(off, this.left - pad, this.baseY - this.h - pad);
        // 叠加白色闪白（最后 0.5s 渐隐）
        const a = 0.6 * Math.min(1, this.flashT / 0.5);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.drawImage(off2, this.left - pad, this.baseY - this.h - pad);
        ctx.restore();
      } else {
        draw(ctx);
      }
    }
    /** 草原山石（原像素岩丘 / 梯形石） */
    renderRock(ctx) {
      const step = 8;   // 像素块
      const x0 = this.left, w = this.w, h = this.h, baseY = this.baseY;
      const kv = this.def.v;
      // 剪影高度剖面（锯齿岩丘 / 上窄下宽梯形石）
      const rows = Math.ceil(h / step);
      for (let r = 0; r < rows; r++) {
        const yy = baseY - r * step;
        const t = r / rows;
        // 梯形石：底部全宽，向上线性收窄；普通岩丘保持原剖面
        const inset = this.trap
          ? t * w * 0.27
          : (1 - t) * w * 0.26 + Math.sin(r * 1.7 + kv) * step * 0.5;
        let rx = x0 + Math.max(0, inset);
        let rw = w - Math.max(0, inset) * 2;
        // 顶部几行加随机缺口（尖峰感）
        if (!this.trap && r >= rows - 2) {
          rx += step * ((r % 2) ? 2 : 0);
          rw -= step * ((r % 2) ? 4 : 2);
        }
        // 颜色分层
        let col;
        if (r === rows - 1 || r >= rows - 2 && (Math.floor(this.x / step) + r) % 3 === 0) col = '#67bd57'; // 顶部草皮
        else if (r < 3) col = '#4a4f57';   // 底部深
        else col = (Math.floor((this.x + r * 13) / step) % 4 === 0) ? '#8d96a3' : '#7d8794';
        ctx.fillStyle = col;
        ctx.fillRect(rx, yy - step, rw, step);
        // 高光点
        if (r >= 3 && (Math.floor(this.x / step) + r) % 5 === 0) {
          ctx.fillStyle = '#a7b3c2';
          ctx.fillRect(rx + step, yy - step + step / 2, Math.min(step * 2, Math.max(2, rw - step * 2)), step / 2);
        }
      }
      // 黑色描边底边 + 裂纹
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(x0 + step, baseY - step * 2.2, step, step * 1.2);
      ctx.fillRect(x0 + w * 0.6, baseY - h * 0.55, step, step * 1.6);
    }
  }

  /* ============================================================
   * 破碎障碍物 Breakable
   *  - 我方子弹每命中 1 次扣 1 血（激光/穿透弹由 hitCd 限速），hp 归零爆炸
   *  - 接触玩家造成伤害并击退；小怪撞毁；敌方可破坏弹（rockBreak）一发炸毁
   *  - 地面型锚定地面随卷轴左移；漂浮型在屏幕中部上下浮动
   * ============================================================ */
  class Breakable {
    constructor(x, id, opts) {
      opts = opts || {};
      this.id = id;
      this.def = BREAK[id];
      this.w = this.def.w;
      this.h = this.def.h;
      // 耐久随轮次成长（opts.hpMul，由 spawnBreakable 按当前轮次给出）
      this.maxHp = Math.round(this.def.hp * (opts.hpMul || 1));
      this.hp = this.maxHp;
      this.x = x;
      this.float = !!this.def.float;
      this.baseY = this.float ? 0 : CFG.GROUND_Y;
      this.cy = this.float ? (opts.cy || 250) : 0;
      this.bobPh = rand(0, TAU);
      this.style = opts.style !== undefined ? opts.style
        : (this.def.styles ? randi(0, this.def.styles - 1) : 0);
      this.angle = rand(0, TAU);
      this.angV = id === 'bkCube' ? 0.62 : 0;
      this.hitCd = 0;
      this.fadeT = 0.5;
      this.t = 0;
      this.dead = false;
    }
    get left() { return this.x - this.w / 2; }
    get top() { return this.float ? this.cy - this.h / 2 : this.baseY - this.h; }
    /** 是否已进入屏幕（未进场前不参与任何命中，防止被屏外弹幕提前打爆） */
    get onScreen() { return this.x - this.w / 2 < CFG.W; }
    /** 当前纵向中心（漂浮型含上下浮动） */
    ccyNow() { return this.float ? this.cy + Math.sin(this.t * 1.1 + this.bobPh) * 20 : this.baseY - this.h / 2; }
    get debris() { return this.def.debris; }

    /** 点是否在障碍本体内（pad 为外扩） */
    contains(px, py, pad) {
      pad = pad || 0;
      const cx = this.x, cy = this.ccyNow();
      if (this.id === 'bkCube') {
        // 反向旋转到魔方本地坐标系：方形判定随转动
        const dx = px - cx, dy = py - cy;
        const c = Math.cos(-this.angle), sn = Math.sin(-this.angle);
        const lx = dx * c - dy * sn, ly = dx * sn + dy * c;
        const s = this.w * 0.40 + pad;
        return Math.abs(lx) < s && Math.abs(ly) < s;
      }
      const top = cy - this.h / 2, bot = cy + this.h / 2;
      if (py < top - pad || py > bot + pad) return false;
      const t = clamp((bot - py) / this.h, 0, 1);   // 0=底 1=顶
      let half;
      if (this.id === 'bkPeak') half = this.w / 2 * (0.10 + 0.90 * t);
      else if (this.id === 'bkMesa') half = this.w / 2 * (0.62 + 0.38 * t);
      else if (this.id === 'bkWood') half = this.w / 2 * (0.42 + 0.20 * t);
      else half = this.w / 2;
      return Math.abs(px - cx) < half + pad;
    }

    /** 我方子弹命中：累计次数（hitCd 防穿透/激光一帧多次） */
    struck(g, b) {
      if (this.hitCd > 0) return;
      this.hitCd = 0.07;
      this.hp = Math.max(0, this.hp - 1);
      const cols = this.debris;
      burst(g, b ? b.x : this.x, b ? b.y : this.ccyNow(), 6,
        [cols[0], cols[2] || cols[1], '#fff'], 150, 4, 0.35, 110);
      if (this.hp % 5 === 0) SFX.melee();
      if (this.hp <= 0) this.destroy(g, true);
    }

    update(dt, g) {
      this.t += dt;
      this.fadeT = Math.max(0, this.fadeT - dt);
      this.hitCd = Math.max(0, this.hitCd - dt);
      if (this.angV) this.angle += dt * this.angV;
      this.x -= 62 * dt * (g.map.scrollMul || 1);
      if (this.x < -this.w / 2 - 140) this.dead = true;
      // 魔窟枯木：散发幽蓝余烬
      if (this.id === 'bkWood' && Math.random() < dt * 5) {
        g.particles.push(new Particle(this.x + rand(-this.w * 0.25, this.w * 0.25),
          this.baseY - rand(60, this.h * 0.9), rand(-16, 16), rand(-46, -18),
          rand(0.6, 1.2), rand(2, 4), Math.random() < 0.5 ? '#54e0ff' : '#7af0ff'));
      }
      const p = g.player;
      // 与飞虎碰撞：受伤击退（障碍物不因此损毁）
      if (p.hp > 0 && p.invT <= 0 && this.contains(p.x, p.y, p.radius * 0.6)) {
        p.hurt(Math.round(p.maxHp * 0.15), g, { k: 'env', key: 'breakrock' });
        p.x += (p.x < this.x ? -1 : 1) * 34;
        if (this.float) p.y += (p.y < this.ccyNow() ? -1 : 1) * 44;
        else p.y = Math.max(CFG.TOP_Y, p.y - 48);
        burst(g, p.x, p.y, 12, ['#ff7b2e', '#ffd23b', '#fff'], 260, 5, 0.45, 160);
      }
      // 小怪撞毁（地面单位 / Boss 不受影响）；未进场不触发
      if (this.onScreen) for (const e of g.enemies) {
        if (e.dead || e.groundUnit) continue;
        if (this.contains(e.x, e.y, e.radius * 0.7)) {
          burst(g, e.x, e.y, 16, this.debris.slice(0, 3).concat(e.deathColors()), 240, 5, 0.55, 220);
          SFX.explode(false);
          g.shake(5);
          e.die(g);
        }
      }
      // 敌方可破坏弹（炮弹/导弹）：一发炸毁；未进场不触发
      if (this.onScreen) for (const b of g.bullets) {
        if (b.friendly || b.dead || !b.rockBreak) continue;
        if (this.contains(b.x, b.y, b.r + 4)) { b.dead = true; this.destroy(g); break; }
      }
    }

    destroy(g, big) {
      if (this.dead) return;
      this.dead = true;
      const cx = this.x, cy = this.ccyNow();
      const cols = this.debris;
      const n = big ? 30 : 22;
      for (let i = 0; i < n; i++) {
        const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
        const sp = rand(150, big ? 500 : 360);
        g.particles.push(new Particle(
          cx + rand(-this.w * 0.3, this.w * 0.3), cy + rand(-this.h * 0.35, this.h * 0.35),
          Math.cos(a) * sp, Math.sin(a) * sp - rand(60, 170),
          rand(0.8, 1.5), rand(8, 20),
          cols[randi(0, Math.min(cols.length - 1, 3))], 820));
      }
      burst(g, cx, cy, big ? 34 : 24, cols.concat('#fff'), big ? 460 : 340, 7, 0.8, 260);
      burst(g, cx, cy, big ? 26 : 18, ['#ffd23b', '#ff7b2e', '#fff5d0', '#fff'], big ? 420 : 300, 6, 0.5, 200);
      if (g.fxRings) {
        g.fxRings.push({ x: cx, y: cy, r: 16, vr: big ? 620 : 480, t: 0, life: 0.5, col: '#ffd9b0' });
        g.fxRings.push({ x: cx, y: cy, r: 8, vr: big ? 880 : 640, t: 0, life: 0.38, col: '#ffffff' });
      }
      g.shake(big ? 12 : 8);
      g.flashT = Math.max(g.flashT, big ? 0.16 : 0.1);
      g.flashColor = '#ffe9c8';
      SFX.explode(!!big);
    }

    render(ctx) {
      ctx.save();
      ctx.globalAlpha = this.fadeT > 0 ? 1 - this.fadeT / 0.5 : 1;
      const r = this;
      switch (this.def.shape) {
        case 'bktower': drawBreakTower(ctx, r); break;
        case 'bkwreck': drawBreakWreck(ctx, r); break;
        case 'bkcube': drawBreakCube(ctx, r); break;
        case 'bkpeak': drawBreakPeak(ctx, r); break;
        case 'bkmesa': drawBreakMesa(ctx, r); break;
        case 'bkwood': drawBreakWood(ctx, r); break;
      }
      // 裂纹/崩口：随掉血加深（4 个阶段）；转动魔方不叠固定裂纹
      if (this.id !== 'bkCube') drawBreakDamage(ctx, r);
      ctx.restore();
    }
  }

  /** 破碎障碍通用损伤层：裂纹折线 + 崩口暗块（随剩余血量出现） */
  function drawBreakDamage(ctx, r) {
    const stage = Math.floor((1 - r.hp / r.maxHp) * 4);   // 0..3
    if (stage <= 0) return;
    const cy = r.ccyNow();
    ctx.save();
    ctx.strokeStyle = 'rgba(20,18,24,0.62)';
    ctx.fillStyle = 'rgba(20,18,24,0.5)';
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    const seedN = r.id.length + r.style * 7;
    for (let i = 0; i < stage * 2; i++) {
      const f = ((i * 37 + seedN * 13) % 100) / 100;
      const sx = r.left + r.w * (0.18 + ((i * 53 + seedN * 7) % 100) / 100 * 0.64);
      const sy = cy - r.h * 0.42 + r.h * f * 0.84;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + ((i % 2) ? 14 : -14), sy + 16);
      ctx.lineTo(sx + ((i % 2) ? -6 : 8), sy + 32);
      ctx.stroke();
      if (i < stage) {
        ctx.beginPath();
        ctx.moveTo(sx - 7, sy); ctx.lineTo(sx + 7, sy); ctx.lineTo(sx, sy + 10);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  /** 城堡·中世纪军事塔楼：石砌塔身 + 城垛箭楼 + 旗杆 */
  function drawBreakTower(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY;
    // 底部加宽基座
    ctx.fillStyle = '#6b6252';
    ctx.fillRect(x0 - 10, base - 30, w + 20, 30);
    ctx.fillStyle = '#857a66';
    ctx.fillRect(x0 - 10, base - 30, w + 20, 6);
    // 塔身（微收分）
    const top = base - h + 44;
    const grad = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    grad.addColorStop(0, '#bdb196'); grad.addColorStop(0.45, '#a89a7e');
    grad.addColorStop(1, '#7c7260');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0 + 8, top);
    ctx.lineTo(x0 + w - 8, top);
    ctx.lineTo(x0 + w, base - 30);
    ctx.lineTo(x0, base - 30);
    ctx.closePath(); ctx.fill();
    // 石块缝线
    ctx.strokeStyle = 'rgba(60,52,40,0.45)'; ctx.lineWidth = 2;
    for (let y = top + 18; y < base - 36; y += 26) {
      ctx.beginPath(); ctx.moveTo(x0 + 4, y); ctx.lineTo(x0 + w - 4, y); ctx.stroke();
      const off = (Math.floor((y - top) / 26) % 2) ? 14 : 0;
      for (let x = x0 + 12 + off; x < x0 + w - 8; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke();
      }
    }
    // 箭窗（狭长）
    ctx.fillStyle = '#2e2820';
    for (let i = 0; i < 5; i++) {
      const wy = top + 40 + i * 58;
      ctx.fillRect(x0 + w / 2 - 5, wy, 10, 22);
      ctx.beginPath(); ctx.arc(x0 + w / 2, wy, 5, Math.PI, 0); ctx.fill();
    }
    // 底部拱门
    ctx.fillStyle = '#241f18';
    ctx.beginPath();
    ctx.moveTo(x0 + w / 2 - 15, base - 30);
    ctx.lineTo(x0 + w / 2 - 15, base - 58);
    ctx.arc(x0 + w / 2, base - 58, 15, Math.PI, 0);
    ctx.lineTo(x0 + w / 2 + 15, base - 30);
    ctx.closePath(); ctx.fill();
    // 顶部箭楼（外挑 + 城垛）
    ctx.fillStyle = '#95886e';
    ctx.fillRect(x0 - 8, top - 6, w + 16, 12);
    ctx.fillStyle = '#a89a7e';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x0 - 8 + i * ((w + 16) / 5), top - 26, (w + 16) / 5 - 8, 22);
    }
    // 旗杆与旗
    ctx.strokeStyle = '#3a342c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0 + w / 2, top - 26); ctx.lineTo(x0 + w / 2, top - 58); ctx.stroke();
    const wf = Math.sin(r.t * 6) * 4;
    ctx.fillStyle = '#8e2f28';
    ctx.beginPath();
    ctx.moveTo(x0 + w / 2, top - 58);
    ctx.lineTo(x0 + w / 2 + 26, top - 52 + wf);
    ctx.lineTo(x0 + w / 2, top - 42);
    ctx.closePath(); ctx.fill();
  }

  /** 天空·巨大建筑残骸：断裂斜倾的巨构残片，断柱/钢筋/冷光裂缝 */
  function drawBreakWreck(ctx, r) {
    const cy = r.ccyNow(), x0 = r.left, w = r.w, top = cy - r.h / 2;
    ctx.save();
    // 主体：倾斜碎裂巨板
    const grad = ctx.createLinearGradient(x0, top, x0 + w, top + r.h);
    grad.addColorStop(0, '#5a6478'); grad.addColorStop(0.55, '#3c4456'); grad.addColorStop(1, '#262d3d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0 + 18, top + r.h);
    ctx.lineTo(x0 + 6, top + 96);
    ctx.lineTo(x0 + 22, top + 40);
    ctx.lineTo(x0 + 52, top + 12);
    ctx.lineTo(x0 + 70, top + 30);
    ctx.lineTo(x0 + w - 30, top + 6);
    ctx.lineTo(x0 + w - 8, top + 34);
    ctx.lineTo(x0 + w - 20, top + 84);
    ctx.lineTo(x0 + w - 26, top + r.h);
    ctx.closePath(); ctx.fill();
    // 冷亮边
    ctx.strokeStyle = 'rgba(150,190,230,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0 + 22, top + 40); ctx.lineTo(x0 + 52, top + 12);
    ctx.lineTo(x0 + 70, top + 30); ctx.lineTo(x0 + w - 30, top + 6);
    ctx.stroke();
    // 板块分割线 / 冷光裂缝
    ctx.strokeStyle = 'rgba(10,14,22,0.6)'; ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      const y = top + 70 + i * (r.h - 110) / 6;
      ctx.beginPath(); ctx.moveTo(x0 + 12, y); ctx.lineTo(x0 + w - 18, y + 10); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(127,227,255,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.32, top + 70);
    ctx.lineTo(x0 + w * 0.44, top + 150);
    ctx.lineTo(x0 + w * 0.36, top + 230);
    ctx.lineTo(x0 + w * 0.52, top + 320);
    ctx.stroke();
    // 断柱（残鼓）
    ctx.fillStyle = '#4c5668';
    [[x0 - 14, top + 150], [x0 + w - 6, top + 300]].forEach(([px, py]) => {
      ctx.fillRect(px, py, 26, 58);
      ctx.fillStyle = 'rgba(160,180,205,0.6)';
      ctx.beginPath(); ctx.ellipse(px + 13, py, 13, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4c5668';
    });
    // 顶部伸出的扭曲钢筋
    ctx.strokeStyle = '#20262f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    [[x0 + 30, top + 30, -16, -34], [x0 + w * 0.6, top + 14, 18, -30]].forEach(([px, py, dx, dy]) => {
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + dx * 0.4, py + dy, px + dx, py + dy - 8); ctx.stroke();
      ctx.fillStyle = 'rgba(127,227,255,0.9)';
      ctx.beginPath(); ctx.arc(px + dx, py + dy - 8, 3, 0, TAU); ctx.fill();
    });
    // 环绕碎块
    ctx.fillStyle = '#343c4e';
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + r.bobPh;
      const rr = r.w * 0.62 + (i % 2) * 26;
      ctx.fillRect(r.x + Math.cos(a + r.t * 0.4) * rr - 7,
        cy + Math.sin(a + r.t * 0.4) * rr * 1.4 - 7, 14, 14);
    }
    ctx.restore();
  }

  /** 仙人洞·持续转动的白色魔方：立体框面 + 青色辉光 */
  function drawBreakCube(ctx, r) {
    const cy = r.ccyNow(), s = r.w * 0.40;
    ctx.save();
    ctx.translate(r.x, cy);
    ctx.rotate(r.angle);
    ctx.shadowColor = 'rgba(110,220,255,0.85)';
    ctx.shadowBlur = 34;
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#eef4fa'); g.addColorStop(1, '#c3d2e0');
    ctx.fillStyle = g;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.shadowBlur = 0;
    // 内层立体框面（透视立方）
    const s2 = s * 0.58, off = s * 0.26;
    ctx.fillStyle = 'rgba(150,200,225,0.35)';
    ctx.fillRect(-s2 + off, -s2 - off, s2 * 2, s2 * 2);
    ctx.strokeStyle = 'rgba(70,150,190,0.85)'; ctx.lineWidth = 3;
    ctx.strokeRect(-s2 + off, -s2 - off, s2 * 2, s2 * 2);
    ctx.strokeStyle = 'rgba(90,170,215,0.7)';
    [[-s, -s], [s, -s], [-s, s], [s, s]].forEach(([a, b]) => {
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a * s2 / s + off, b * s2 / s - off); ctx.stroke();
    });
    // 外框
    ctx.strokeStyle = '#7fdcff'; ctx.lineWidth = 5;
    ctx.strokeRect(-s, -s, s * 2, s * 2);
    // 边缘刻纹
    ctx.strokeStyle = 'rgba(80,150,190,0.8)'; ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * s * 0.34 - 8, -s); ctx.lineTo(i * s * 0.34, -s + 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * s * 0.34 - 8, s); ctx.lineTo(i * s * 0.34, s - 14); ctx.stroke();
    }
    // 中心符印
    ctx.strokeStyle = 'rgba(60,140,185,0.8)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.26, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, 0); ctx.lineTo(s * 0.36, 0);
    ctx.moveTo(0, -s * 0.36); ctx.lineTo(0, s * 0.36);
    ctx.stroke();
    ctx.restore();
  }

  /** 群山·巨大尖锐山峰：锯齿岩脊 + 亮面 + 残雪 */
  function drawBreakPeak(ctx, r) {
    const x0 = r.left, w = r.w, base = r.baseY, top = base - r.h, cx = r.x;
    // 主体锯齿三角
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, '#525c63'); g.addColorStop(0.55, '#6d7880'); g.addColorStop(1, '#464f56');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, base);
    ctx.lineTo(x0 + w * 0.18, top + r.h * 0.78);
    ctx.lineTo(x0 + w * 0.10, top + r.h * 0.58);
    ctx.lineTo(x0 + w * 0.34, top + r.h * 0.34);
    ctx.lineTo(x0 + w * 0.46, top + r.h * 0.16);
    ctx.lineTo(cx, top);
    ctx.lineTo(x0 + w * 0.62, top + r.h * 0.20);
    ctx.lineTo(x0 + w * 0.80, top + r.h * 0.42);
    ctx.lineTo(x0 + w * 0.88, top + r.h * 0.64);
    ctx.lineTo(x0 + w, base);
    ctx.closePath(); ctx.fill();
    // 亮面切面
    ctx.fillStyle = '#8b98a0';
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(x0 + w * 0.62, top + r.h * 0.20);
    ctx.lineTo(x0 + w * 0.52, top + r.h * 0.52);
    ctx.lineTo(x0 + w * 0.40, top + r.h * 0.46);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#aebcc2';
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(x0 + w * 0.46, top + r.h * 0.16);
    ctx.lineTo(x0 + w * 0.34, top + r.h * 0.34);
    ctx.lineTo(x0 + w * 0.44, top + r.h * 0.30);
    ctx.closePath(); ctx.fill();
    // 雪线
    ctx.fillStyle = '#d8e2e8';
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(x0 + w * 0.40, top + r.h * 0.26);
    ctx.lineTo(x0 + w * 0.47, top + r.h * 0.30);
    ctx.lineTo(x0 + w * 0.54, top + r.h * 0.24);
    ctx.lineTo(x0 + w * 0.62, top + r.h * 0.20);
    ctx.lineTo(x0 + w * 0.55, top + r.h * 0.34);
    ctx.lineTo(cx, top + r.h * 0.40);
    ctx.closePath(); ctx.fill();
    // 根部碎石裙
    ctx.fillStyle = '#3f484e';
    ctx.beginPath();
    ctx.moveTo(x0 - 14, base);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x0 - 14 + i * (w + 28) / 6, base - (i % 2 ? 22 : 10));
    ctx.lineTo(x0 + w + 14, base);
    ctx.closePath(); ctx.fill();
  }

  /** 群山·低矮宽阔山峰：平顶山台 + 层理 + 侵蚀沟 */
  function drawBreakMesa(ctx, r) {
    const x0 = r.left, w = r.w, base = r.baseY, top = base - r.h, cx = r.x;
    // 山台主体（顶部宽、底部略宽）
    const g = ctx.createLinearGradient(0, top, 0, base);
    g.addColorStop(0, '#8b989c'); g.addColorStop(0.5, '#68737a'); g.addColorStop(1, '#525c62');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - 12, base);
    ctx.lineTo(x0 + w * 0.16, top + 34);
    ctx.lineTo(x0 + w * 0.12, top);
    ctx.lineTo(x0 + w * 0.88, top);
    ctx.lineTo(x0 + w * 0.84, top + 34);
    ctx.lineTo(x0 + w + 12, base);
    ctx.closePath(); ctx.fill();
    // 顶部平台亮面
    ctx.fillStyle = '#aab6ba';
    ctx.fillRect(x0 + w * 0.12, top, w * 0.76, 10);
    // 水平层理
    ctx.strokeStyle = 'rgba(40,48,54,0.4)'; ctx.lineWidth = 3;
    for (let i = 1; i < 8; i++) {
      const y = top + 30 + i * (r.h - 60) / 8;
      const t01 = (y - top) / r.h;
      const ix = w * 0.16 * (1 - t01 * 0.5);
      ctx.beginPath(); ctx.moveTo(x0 + ix, y); ctx.lineTo(x0 + w - ix, y + 4); ctx.stroke();
    }
    // 竖向侵蚀沟
    ctx.strokeStyle = 'rgba(36,42,48,0.55)'; ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      const gx = x0 + w * (0.24 + i * 0.13);
      ctx.beginPath();
      ctx.moveTo(gx, top + 26);
      ctx.lineTo(gx + (i % 2 ? 10 : -10), top + r.h * 0.45);
      ctx.lineTo(gx + (i % 2 ? -6 : 8), base - 20);
      ctx.stroke();
    }
    // 亮侧棱
    ctx.strokeStyle = 'rgba(190,202,206,0.5)'; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.12, top); ctx.lineTo(x0 + w * 0.16, top + 34); ctx.lineTo(x0 - 12, base);
    ctx.stroke();
    // 根部碎石裙
    ctx.fillStyle = '#464e53';
    ctx.beginPath();
    ctx.moveTo(x0 - 22, base);
    for (let i = 0; i <= 8; i++) ctx.lineTo(x0 - 22 + i * (w + 44) / 8, base - (i % 2 ? 18 : 8));
    ctx.lineTo(x0 + w + 22, base);
    ctx.closePath(); ctx.fill();
  }

  /** 魔窟·幽蓝荧光枯木（3 样式）：扭曲狰狞树干 + 枝爪 + 荧光纹 */
  function drawBreakWood(ctx, r) {
    const x0 = r.left, w = r.w, base = r.baseY, top = base - r.h, cx = r.x;
    const s = r.style;
    // 根部
    ctx.fillStyle = '#0c0a1c';
    ctx.beginPath();
    ctx.moveTo(x0 - 6, base);
    ctx.quadraticCurveTo(cx - 40, base - 6, cx - 26 - s * 6, base - 26);
    ctx.quadraticCurveTo(cx, base - 40, cx + 26 + s * 6, base - 26);
    ctx.quadraticCurveTo(cx + 40, base - 6, x0 + w + 6, base);
    ctx.closePath(); ctx.fill();
    // 主干（不同样式扭曲倾向）
    const lean = [-1, 1, 0][s] * 22;
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, '#241d44'); g.addColorStop(0.45, '#17122f'); g.addColorStop(1, '#0a0818');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - 30, base);
    ctx.bezierCurveTo(cx - 46 + lean, base - r.h * 0.33, cx - 14 - lean, base - r.h * 0.66, cx - 8 + lean, top + 40);
    ctx.lineTo(cx + 6 + lean, top + 24);
    ctx.bezierCurveTo(cx + 30 - lean, base - r.h * 0.60, cx + 52 + lean, base - r.h * 0.30, cx + 34, base);
    ctx.closePath(); ctx.fill();
    // 树节瘤
    ctx.fillStyle = '#2c2350';
    for (let i = 0; i < 5; i++) {
      const ky = base - 80 - i * r.h * 0.16;
      const kx = cx + Math.sin(i * 2.1 + s * 2.4) * 18 + lean * (i / 5);
      ctx.beginPath(); ctx.ellipse(kx, ky, 13, 9, 0.3, 0, TAU); ctx.fill();
    }
    // 狰狞枝爪
    ctx.strokeStyle = '#15102c'; ctx.lineCap = 'round';
    const branch = (bx, by, len, ang, wd) => {
      ctx.lineWidth = wd;
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(ang - 0.4) * len * 0.6, by + Math.sin(ang - 0.4) * len * 0.6, ex, ey);
      ctx.stroke();
      // 末端分叉
      ctx.lineWidth = Math.max(3, wd * 0.45);
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(ang - 0.5) * len * 0.3, ey + Math.sin(ang - 0.5) * len * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(ang + 0.4) * len * 0.26, ey + Math.sin(ang + 0.4) * len * 0.26); ctx.stroke();
    };
    // 三种枝形布局
    const rows = [0.25, 0.42, 0.58, 0.72, 0.84];
    rows.forEach((f0, i) => {
      const by = base - r.h * f0;
      const bx = cx + lean * (1 - f0) * 0.5;
      const side = s === 2 ? (i % 2 ? 1 : -1) : (i % 2 ? 1 : -1);
      const bias = s === 0 ? 0 : s === 1 ? -0.35 : 0.25;
      const ang = side * (Math.PI * 0.18 + bias) + (s === 1 && side < 0 ? -0.25 : 0);
      branch(bx + side * 12, by, r.w * (0.55 + (i % 3) * 0.12), ang, 13 - i);
    });
    // 顶端分叉（样式2双叉）
    if (s === 2) {
      branch(cx + lean, top + 40, r.w * 0.7, -Math.PI * 0.32, 9);
      branch(cx + lean, top + 40, r.w * 0.7, -Math.PI * 0.68, 9);
    } else {
      branch(cx + lean, top + 34, r.w * 0.6, -Math.PI / 2 + lean * 0.004, 9);
    }
    // 荧光描边与裂纹
    ctx.strokeStyle = 'rgba(84,224,255,0.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 14, base - 30);
    ctx.bezierCurveTo(cx - 24 + lean, base - r.h * 0.33, cx - 8 - lean, base - r.h * 0.66, cx - 2 + lean, top + 60);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(58,156,255,0.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const gy = base - r.h * (0.3 + i * 0.16);
      ctx.beginPath();
      ctx.moveTo(cx - 6 + lean * 0.3, gy);
      ctx.lineTo(cx + 14 - lean * 0.2, gy - 26);
      ctx.lineTo(cx + 2, gy - 48);
      ctx.stroke();
    }
    // 荧光点
    ctx.fillStyle = '#9ff4ff';
    for (let i = 0; i < 5; i++) {
      const py = base - r.h * (0.2 + i * 0.17);
      ctx.beginPath(); ctx.arc(cx + Math.sin(i * 2.7 + s) * 12 + lean * 0.4, py, 2.5, 0, TAU); ctx.fill();
    }
  }

  /** 沙漠·仙人掌：主干 + 双臂 L 形，高株顶花，矮株圆胖无臂 */
  function drawCactus(ctx, r) {
    const s = 8;
    const cx = Math.round(r.x), base = r.baseY, h = r.h, v = r.def.v;
    const tw = [24, 20, 16][v];
    const dark = '#2f6e39', body = '#3f8f4b', lite = '#5cb868', spine = '#dff2d0';
    const rows = Math.ceil(h / s);
    for (let i = 0; i < rows; i++) {
      const yy = base - (i + 1) * s;
      let ww = tw;
      if (i === rows - 1) ww = tw - 8;
      else if (i === rows - 2) ww = tw - 4;
      const rx = cx - ww / 2;
      obsPx(ctx, rx, yy, ww, s, body);
      obsPx(ctx, rx, yy, s, s, dark);
      obsPx(ctx, rx + ww - s, yy, s, s, dark);
      obsPx(ctx, cx - 2, yy, 4, s, lite);
      if ((Math.floor(r.x / s) + i) % 3 === 0) obsPx(ctx, rx + s + (i % 2 ? s : 0), yy + 2, 3, 3, spine);
    }
    if (v < 2) {
      const armLen = v === 0 ? 24 : 16, armUp = v === 0 ? 40 : 28, aw = 12;
      // 左臂（高位）
      const ly = base - h + h * 0.55;
      obsPx(ctx, cx - tw / 2 - armLen, ly, armLen, aw, body);
      obsPx(ctx, cx - tw / 2 - armLen, ly - armUp, aw, armUp + aw, body);
      obsPx(ctx, cx - tw / 2 - armLen, ly - armUp, aw, s, lite);
      obsPx(ctx, cx - tw / 2 - armLen, ly, s, aw, dark);
      // 右臂（低位）
      const ry = base - h + h * 0.74;
      const aLen2 = armLen * 0.7, aUp2 = armUp * 0.6;
      obsPx(ctx, cx + tw / 2, ry, aLen2, aw, body);
      obsPx(ctx, cx + tw / 2 + aLen2 - aw, ry - aUp2, aw, aUp2 + aw, body);
      obsPx(ctx, cx + tw / 2 + aLen2 - aw, ry - aUp2, aw, s, lite);
      obsPx(ctx, cx + tw / 2 + aLen2 - s, ry, s, aw, dark);
    }
    if (v === 0) { obsPx(ctx, cx - 4, base - h - 6, 8, 6, '#ff6b8a'); obsPx(ctx, cx - 2, base - h - 4, 4, 3, '#ffd93b'); }
    obsPx(ctx, cx - tw, base - 4, tw * 2, 6, '#c9a45c');   // 根部沙堆
  }

  /** 雪地·冰山：上窄下宽尖锥，青白分层 + 高光冰裂 */
  function drawIce(ctx, r) {
    const s = 8;
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY;
    const rows = Math.ceil(h / s);
    for (let i = 0; i < rows; i++) {
      const yy = base - (i + 1) * s;
      const t = i / rows;
      let inset = Math.max(0, t * w * 0.40 + Math.sin(i * 1.9 + r.def.v) * s * 0.4);
      let rx = x0 + inset, rw = w - inset * 2;
      if (i === rows - 1) { rx += s; rw -= s * 2; }
      obsPx(ctx, rx, yy, rw, s, '#eaf7ff');
      obsPx(ctx, rx, yy, Math.min(s, rw), s, '#b9dcf2');
      obsPx(ctx, rx + rw - s, yy, Math.min(s, rw), s, '#b9dcf2');
      if (i < 2) obsPx(ctx, rx, yy, rw, s, '#9fcde8');
      if ((Math.floor(r.x / s) + i) % 4 === 0) obsPx(ctx, rx + s * 2, yy + 2, 6, 4, '#ffffff');
      if (i > 2 && (Math.floor(r.x / s) + i) % 7 === 3) obsPx(ctx, rx + rw * 0.4, yy, s, s, '#8fbedf');
    }
  }

  /** 火焰山·尖锐石头：暗色锯齿岩 + 发光熔岩裂纹 */
  function drawVrock(ctx, r) {
    const s = 8;
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY;
    const rows = Math.ceil(h / s);
    for (let i = 0; i < rows; i++) {
      const yy = base - (i + 1) * s;
      const t = i / rows;
      const inset = (1 - t) * w * 0.26 + Math.sin(i * 1.7 + r.def.v) * s * 0.5;
      let rx = x0 + Math.max(0, inset);
      let rw = w - Math.max(0, inset) * 2;
      if (i >= rows - 2) { rx += s * ((i % 2) ? 2 : 0); rw -= s * ((i % 2) ? 4 : 2); }
      const col = i < 3 ? '#1f1517' : (Math.floor((r.x + i * 13) / s) % 4 === 0 ? '#4a3029' : '#3d2a28');
      obsPx(ctx, rx, yy, rw, s, col);
      if (i >= 3 && (Math.floor(r.x / s) + i) % 5 === 0)
        obsPx(ctx, rx + s, yy + s / 2, Math.min(s * 2, Math.max(2, rw - s * 2)), s / 2, '#6e4438');
    }
    // 熔岩裂纹（自底部向上蜿蜒）
    const cracks = r.def.v === 0 ? 3 : 2;
    for (let c = 0; c < cracks; c++) {
      const cxk = x0 + w * (0.25 + 0.25 * c) + (Math.floor(r.x / s) % 3) * s;
      const ch = h * (0.35 + 0.18 * ((c + r.def.v) % 3));
      for (let j = 0; j < ch / s; j++) {
        const xx = cxk + Math.sin(j * 0.9 + c * 2) * s;
        obsPx(ctx, xx, base - j * s - s, 5, s, '#ff7b2e');
        obsPx(ctx, xx + 1, base - j * s - s + 2, 2, 4, '#ffd23b');
      }
    }
    obsPx(ctx, x0 + s, base - s * 2.2, s, s * 1.2, '#120c0d');
  }

  /** 紫色荒地·枯木：主干 + 对角枯枝（像素块折线），矮株为平顶树桩 */
  function drawTree(ctx, r) {
    const s = 8;
    const cx = Math.round(r.x), base = r.baseY, h = r.h, v = r.def.v;
    const bark = '#4a3340', dark = '#35242f', lite = '#5e4458';
    obsPx(ctx, cx - 22, base - 6, 44, 6, dark);   // 根盘
    if (v === 2) {
      const tw = 26, top = base - h;
      for (let i = 0; i < Math.ceil(h / s); i++) {
        const yy = base - (i + 1) * s;
        obsPx(ctx, cx - tw / 2, yy, tw, s, bark);
        obsPx(ctx, cx - tw / 2, yy, s, s, dark);
        obsPx(ctx, cx + tw / 2 - s, yy, s, s, dark);
      }
      obsPx(ctx, cx - tw / 2 - 4, top, tw + 8, 6, lite);
      obsPx(ctx, cx - 4, top - 8, 5, 8, dark);
      obsPx(ctx, cx + 6, top - 6, 5, 6, dark);
      return;
    }
    const tw = v === 0 ? 20 : 18;
    const top = base - h;
    const rows = Math.ceil(h / s);
    for (let i = 0; i < rows; i++) {
      const yy = base - (i + 1) * s;
      let ww = tw;
      if (i > rows - 5) ww = tw - 4;
      if (i < 2) ww = tw + 8;
      obsPx(ctx, cx - ww / 2, yy, ww, s, bark);
      obsPx(ctx, cx - ww / 2, yy, s, s, dark);
      if ((Math.floor(r.x / s) + i) % 4 === 0) obsPx(ctx, cx - 2, yy + 1, 4, 3, lite);
    }
    const limb = (ax, ay, dx, dy, len) => {
      for (let i = 0; i < len; i++) obsPx(ctx, ax + dx * i * s, ay + dy * i * s, s, s, bark);
      obsPx(ctx, ax + dx * len * s, ay + dy * len * s, s, s, dark);
    };
    if (v === 0) {
      limb(cx - 4, top + 24, -1, -1, 5);
      limb(cx + 4, top + 48, 1, 0, 3);
      limb(cx + 4, top + 32, 1, -1, 4);
      limb(cx - 8, top + 56, -1, 0, 4);
      limb(cx + 8, top + 72, 1, -1, 3);
      limb(cx - 8, top + 96, -1, -1, 3);
    } else {
      limb(cx - 4, top + 24, -1, -1, 4);
      limb(cx + 4, top + 32, 1, -1, 3);
      limb(cx - 8, top + 56, -1, 0, 3);
    }
  }

  /** 赛博都市·电线杆：木杆 + 横担绝缘子 + 变压器 + 黄黑警示底座 */
  function drawPole(ctx, r) {
    const s = 8;
    const cx = Math.round(r.x), base = r.baseY, h = r.h;
    const top = base - h;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++)
        obsPx(ctx, cx - 12 + j * s, base - (i + 1) * s, s, s, (i + j) % 2 ? '#222222' : '#f5d742');
    }
    for (let i = 2; i < h / s; i++) {
      const yy = base - (i + 1) * s;
      obsPx(ctx, cx - 8, yy, 16, s, '#54402e');
      obsPx(ctx, cx - 8, yy, 5, s, '#3a2c20');
      if (i % 3 === 0) obsPx(ctx, cx + 3, yy, 5, 3, '#6b5238');
    }
    const ay = top + 22;
    obsPx(ctx, cx - 36, ay, 72, 8, '#2e2620');
    [-24, 0, 24].forEach(dx => {
      obsPx(ctx, cx + dx - 3, ay - 8, 6, 8, '#dfeef5');
      obsPx(ctx, cx + dx - 4, ay - 12, 8, 5, '#35e0ff');
    });
    obsPx(ctx, cx + 8, top + h * 0.45, 22, 26, '#6a7280');
    obsPx(ctx, cx + 8, top + h * 0.45, 22, 6, '#4a5160');
    obsPx(ctx, cx + 8, top + h * 0.45 + 18, 22, 4, '#4a5160');
  }

  /** 赛博都市·电话亭：霓虹框 + 玻璃幕墙 + 洋红招牌 */
  function drawBooth(ctx, r) {
    const cx = Math.round(r.x), base = r.baseY, h = r.h, w = r.w;
    const x0 = cx - w / 2, top = base - h;
    obsPx(ctx, x0 - 4, base - 8, w + 8, 8, '#0e1320');
    obsPx(ctx, x0, top + 12, w, h - 20, '#161c2b');
    obsPx(ctx, x0, top + 12, 8, h - 20, '#35e0ff');
    obsPx(ctx, x0 + w - 8, top + 12, 8, h - 20, '#35e0ff');
    for (let i = 0; i < 4; i++) {
      const yy = top + 20 + i * 14;
      obsPx(ctx, x0 + 10, yy, w - 20, 10, '#7fd8f5');
      obsPx(ctx, x0 + 12, yy + 1, 5, 8, '#d8f6ff');
    }
    obsPx(ctx, cx - 2, top + 18, 4, h - 30, '#0d1220');
    obsPx(ctx, x0 - 4, top, w + 8, 14, '#ff4fd8');
    obsPx(ctx, x0 - 4, top + 10, w + 8, 4, '#35e0ff');
    obsPx(ctx, cx - 8, top + 3, 6, 6, '#ffffff');
    obsPx(ctx, cx + 2, top + 3, 6, 6, '#ffffff');
  }

  /** 赛博都市·小破楼：残顶楼体 + 霓虹窗格 + 竖招牌 + 外露钢筋 */
  function drawBuilding(ctx, r) {
    const s = 8;
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY;
    const top = base - h;
    const rows = Math.ceil(h / s);
    for (let i = 0; i < rows; i++) {
      const yy = base - (i + 1) * s;
      if (i >= rows - 2) {
        const seg = Math.floor(w / s);
        for (let j = 0; j < seg; j++) {
          if ((Math.floor(r.x / s) + i * 3 + j * 7) % 5 === 0) continue;
          obsPx(ctx, x0 + j * s, yy, s, s, j >= seg - 2 ? '#20252e' : '#2b303c');
        }
        continue;
      }
      obsPx(ctx, x0, yy, w, s, '#2b303c');
      obsPx(ctx, x0 + w - s * 2, yy, s * 2, s, '#20252e');
    }
    const winCols = Math.floor((w - 16) / 24), winRows = Math.floor((h - 36) / 26);
    for (let rr = 0; rr < winRows; rr++) {
      for (let cc = 0; cc < winCols; cc++) {
        const wx = x0 + 14 + cc * 24, wy = top + 26 + rr * 26;
        const hash = (Math.floor(r.x / s) + cc * 5 + rr * 11) % 7;
        const col = hash === 0 ? '#ffd93b' : hash === 1 ? '#35e0ff' : hash === 2 ? '#ff4fd8' : '#10141d';
        obsPx(ctx, wx, wy, 12, 14, col);
        if (col !== '#10141d') obsPx(ctx, wx + 2, wy + 2, 4, 4, '#ffffff');
      }
    }
    obsPx(ctx, x0 + 2, top + 20, 5, h - 60, '#ff4fd8');
    if (Math.floor(r.x / 100) % 2 === 0) obsPx(ctx, x0 + 2, top + 40, 5, 16, '#ffffff');
    obsPx(ctx, x0 + w / 2 - 12, base - 30, 24, 30, '#10141d');
    [[0.2, 14], [0.5, 8], [0.78, 18]].forEach(([f, uh]) => obsPx(ctx, x0 + w * f, top - uh, 5, uh + 8, '#171b24'));
    obsPx(ctx, x0 - 6, base - 8, 22, 8, '#1c2029');
    obsPx(ctx, x0 + w - 14, base - 8, 20, 8, '#1c2029');
  }

  /** 大海·礁石：上窄下宽锯齿岩，蓝灰分层 + 孔洞 + 水线浪花 */
  function drawReef(ctx, r) {
    const s = 8;
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY;
    const rows = Math.ceil(h / s);
    for (let i = 0; i < rows; i++) {
      const yy = base - (i + 1) * s;
      const t = i / rows;
      const inset = Math.max(0, t * w * 0.30 + Math.sin(i * 1.9 + r.def.v) * s * 0.5);
      let rx = x0 + inset, rw = w - inset * 2;
      if (i >= rows - 2) { rx += s * ((i % 2) ? 1 : 0); rw -= s * ((i % 2) ? 3 : 1); }
      const col = i < 3 ? '#465863' : (Math.floor((r.x + i * 11) / s) % 4 === 0 ? '#6b828f' : '#5f7480');
      obsPx(ctx, rx, yy, rw, s, col);
      if (i >= 3 && (Math.floor(r.x / s) + i) % 5 === 0) obsPx(ctx, rx + s, yy + 2, s * 2, 4, '#87a0ad');
      if (i > 2 && (Math.floor(r.x / s) + i * 3) % 9 === 4) obsPx(ctx, rx + rw * 0.5, yy, s, s, '#37464f');
      if ((Math.floor(r.x / s) + i * 2) % 11 === 5) obsPx(ctx, rx + rw * 0.3, yy + 2, s, 5, '#b9a98c');
    }
    for (let j = 0; j < w / s; j++) {
      if ((Math.floor(r.x / s) + j) % 2 === 0) obsPx(ctx, x0 + j * s, base - 6, s, 4, '#dff1fa');
    }
  }

  /** 大海·珊瑚：基座 + 七根扇形枝指，红橙配色浅色指尖 */
  function drawCoral(ctx, r) {
    const s = 8;
    const cx = Math.round(r.x), base = r.baseY;
    const main = '#ff6f61', shade = '#d6485e', tip = '#ffc48a';
    obsPx(ctx, cx - 20, base - 10, 40, 10, shade);
    obsPx(ctx, cx - 14, base - 16, 28, 8, main);
    const fingers = [[-0.85, 4], [-0.5, 6], [-0.22, 7], [0, 6], [0.22, 7], [0.5, 5], [0.85, 4]];
    fingers.forEach(([dx, len]) => {
      for (let i = 0; i < len; i++) {
        const lx = cx + dx * i * s * 0.9;
        const ly = base - 14 - i * s;
        obsPx(ctx, lx - 4, ly, 8, s, i === len - 1 ? tip : (i % 2 ? main : '#ff8a75'));
        obsPx(ctx, lx - 4, ly, 3, s, shade);
      }
    });
  }

  /** 罗马角斗场·地刺：铁制底座条（铆钉）+ 一排高低错落的向上尖刺 */
  function drawSpike(ctx, r) {
    const s = 8;
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    // 铁制底座条
    const barH = 16;
    obsPx(ctx, x0, base - barH, w, barH, '#3a3f47');
    obsPx(ctx, x0, base - barH, w, 4, '#6b7280');        // 顶沿高光
    obsPx(ctx, x0, base - 4, w, 4, '#23262c');           // 底沿阴影
    for (let k = 0; k < Math.floor(w / 24); k++) {       // 铆钉
      const rx = x0 + 12 + k * 24;
      obsPx(ctx, rx, base - barH + 5, 4, 4, '#23262c');
      obsPx(ctx, rx + 1, base - barH + 5, 2, 2, '#8d96a3');
    }
    // 尖刺排（高低错落）
    const n = Math.max(3, Math.round(w / 36));
    const maxH = h - barH;
    const hPat = [1.0, 0.66, 0.86, 0.72];
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i + 0.5) * (w / n);
      const sph = maxH * hPat[(i + v) % hPat.length];
      const sw = (w / n) * 0.62;
      const rows = Math.max(1, Math.round(sph / s));
      for (let j = 0; j < rows; j++) {
        const t = (j + 1) / rows;
        const hw = Math.max(3, sw / 2 * (1 - t * 0.9));
        const yy = base - barH - (j + 1) * s;
        const tip = j === rows - 1;
        const col = tip ? '#dfe5ee' : (j < rows * 0.3 ? '#5a5f66' : (j % 2 ? '#8d96a3' : '#7d8794'));
        obsPx(ctx, cx - hw, yy, hw * 2, s, col);
        if (!tip) {
          obsPx(ctx, cx - hw, yy, Math.min(s, hw * 2), s, '#5a5f66');       // 左棱阴影
          obsPx(ctx, cx + hw - s, yy, Math.min(s, hw * 2), s, '#a7b3c2');   // 右棱高光
        }
      }
    }
  }

  /* —— 新地图障碍造型：全部从 base 向上生长；顶部悬挂障碍由 Rock 垂直翻转后呈现 —— */

  /** 叶簇（by=叶簇底部中心；p[深/中/亮/点缀]） */
  function leafBlob(ctx, cx, by, bw, bh, p) {
    const u = 7, rows = Math.max(2, Math.ceil(bh / u));
    for (let i = 0; i < rows; i++) {
      const t = (i + 0.5) / rows;
      const ww = bw * (0.30 + 0.70 * Math.sin(t * Math.PI));
      const col = t > 0.66 ? p[2] : (i % 2 ? p[1] : p[0]);
      obsPx(ctx, cx - ww / 2, by - (i + 1) * u, ww, u, col);
    }
    for (let k = 0; k < 3; k++) obsPx(ctx, cx - bw * 0.2 + k * bw * 0.18, by - bh * (0.55 + k * 0.13), 6, 3, p[3] || p[2]);
  }
  /** 实心三角（尖顶在 cx,top，底边宽 bw 位于 base） */
  function obsTri(ctx, cx, top, base, bw, col, edge) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx, top); ctx.lineTo(cx + bw / 2, base); ctx.lineTo(cx - bw / 2, base);
    ctx.closePath(); ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke(); }
  }

  /** 多边形填充（自动闭合） */
  function obsPoly(ctx, pts, col, edge) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke(); }
  }

  /** 丛林·扭曲大树（v0/v1 扭曲单株，v3 分叉巨树，v2 矮株巨叶蕨丛） */
  function drawJungleTrunk(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    const seed = Math.floor(r.x / 30);
    if (v === 2) {
      // 矮株：苔藓土墩 + 丛生巨型蕨叶
      obsPx(ctx, x0 + 6, base - 10, w - 12, 10, '#33241a');
      obsPx(ctx, x0 + 10, base - 12, w - 20, 5, '#4a5e2c');
      const fronds = 5;
      for (let i = 0; i < fronds; i++) {
        const fx = x0 + w * (0.14 + 0.18 * i) + ((seed + i) % 3) * 3;
        const fh = h * (0.62 + 0.16 * ((seed + i * 2) % 3));
        obsPx(ctx, fx - 3, base - fh * 0.55, 6, fh * 0.55, i % 2 ? '#2f6e39' : '#357a40');
        leafBlob(ctx, fx, base - fh * 0.45, w * 0.30, fh, i % 2 ? ['#163d1c', '#2f6e39', '#5cb868', '#b8d85c'] : ['#1e4d24', '#357a40', '#7cc476', '#9bc84b']);
      }
      return;
    }
    const giant = v === 3;
    const cx0 = x0 + w / 2;
    const topY = base - h;
    const lean = (seed % 2 ? 1 : -1) * w * (giant ? 0.16 : 0.12);
    // 板状根（向外张开的根盘）
    obsPoly(ctx, [[cx0 - 6, base - 4], [cx0 - w * 0.46, base], [cx0 - w * 0.20, base - 16], [cx0 - 4, base - 14]], '#3a2a18');
    obsPoly(ctx, [[cx0 + 6, base - 4], [cx0 + w * 0.46, base], [cx0 + w * 0.20, base - 16], [cx0 + 4, base - 14]], '#2e2013');
    // 扭曲主干：逐段变宽 + 弯曲中线
    const rows = Math.ceil(h / 10);
    for (let i = 0; i < rows; i++) {
      const f = (i + 0.5) / rows;
      const yy = base - (i + 1) * 10;
      const cx = cx0 + lean * f + Math.sin(f * 5 + seed) * 7;
      const tw = (giant ? 30 : 24) + Math.sin(f * 3.2 + seed) * 5 - f * 4;
      obsPx(ctx, cx - tw / 2, yy, tw, 11, i % 2 ? '#43301c' : '#3a2a18');
      obsPx(ctx, cx - tw / 2, yy, Math.max(4, tw * 0.22), 11, '#5a4128');           // 受光面
      obsPx(ctx, cx + tw * 0.28, yy, 4, 11, '#2a1c10');                            // 暗面
      if (i % 4 === 2) obsPx(ctx, cx - 3, yy + 3, 6, 4, '#241709');                 // 节疤
    }
    // 分叉主枝（巨树两股）
    const branchY = base - h * (giant ? 0.62 : 0.78);
    const bcol = '#4a3320';
    obsPx(ctx, cx0 + lean * 0.4 - 2, branchY, w * 0.30, 9, bcol);
    obsPx(ctx, cx0 + lean * 0.4 + w * 0.24, branchY - 4, 9, 8, bcol);
    if (giant) {
      const f2x = cx0 + lean;
      for (let i = 0; i < Math.ceil(h * 0.36 / 10); i++) {
        const f = i / Math.ceil(h * 0.36 / 10);
        obsPx(ctx, f2x - 12 + f * 10, topY + i * 10, 24, 11, i % 2 ? '#43301c' : '#3a2a18');
      }
      leafBlob(ctx, f2x + 8, topY + 6, w * 0.52, h * 0.34, ['#163d1c', '#2a6233', '#4ea058', '#9bc84b']);
    }
    // 不规则叶冠：多团叶簇高低错落
    const tops = giant
      ? [[-0.22, 0.10, 0.52, 0.40], [0.16, 0.00, 0.58, 0.46], [0.02, 0.22, 0.46, 0.34]]
      : [[-0.16, 0.02, 0.50, 0.42], [0.18, 0.14, 0.42, 0.34]];
    tops.forEach((t, i) => leafBlob(ctx, cx0 + lean + w * t[0], branchY + h * t[1] + 6, w * t[2], h * t[3],
      i === 1 ? ['#163d1c', '#2f6e39', '#5cb868', '#b8d85c'] : ['#1e4d24', '#357a40', '#4ea058', '#9bc84b']));
  }

  /** 丛林·悬挂藤蔓：长短不一、粗细各异、叶距随机（翻转后自顶垂下）；v3 藤蔓帘 */
  function drawJungleVine(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    const seed = Math.floor(r.x / 26);
    const lens = v === 3 ? [1.0, 0.62, 0.86, 0.5, 0.95, 0.72] : v === 0 ? [1.0, 0.78, 0.6, 0.9] : v === 1 ? [0.9, 0.6, 0.75] : [0.8, 0.55];
    lens.forEach((lf, i) => {
      const sx = x0 + w * (i + 0.5) / lens.length + ((seed + i) % 2 ? 3 : -3);
      const seg = 10, len = seg * lf;
      const amp = 6 + ((seed + i * 3) % 5) + v * 2, ph = seed * 0.7 + i * 1.9;
      const bare = (seed + i) % 4 === 3;
      for (let j = 0; j < len; j++) {
        const f = j / seg;
        const yy = base - j * (h / seg);
        const dx = Math.sin(j * 0.62 + ph) * amp * (0.4 + f);
        const th = bare ? 4 : 5 + (j % 3 === 0 ? 2 : 0);
        obsPx(ctx, sx + dx - th / 2, yy - h / seg, th, h / seg + 1, j % 2 ? '#1e4d24' : '#2f6e39');
        if (!bare && j > 1 && (j + i) % 3 === 0) {
          const side = (j + i) % 2 ? 1 : -1;
          obsPx(ctx, sx + dx + (side > 0 ? 3 : -12), yy - 5, 9, 4, j % 2 ? '#5cb868' : '#4ea058');
        }
      }
      // 末端：大叶簇 / 裸根尖
      if (bare) {
        const ex = sx + Math.sin(len * 0.62 + ph) * amp;
        obsPx(ctx, ex - 2, base - h * lf - 6, 4, 8, '#7a5a3a');
      } else {
        const ex = sx + Math.sin(len * 0.62 + ph) * amp * lf;
        leafBlob(ctx, ex, base - h * lf + 4, w * 0.26, h * 0.20, ['#1e4d24', '#357a40', '#7cc476', '#b8d85c']);
      }
    });
    if (v === 3) {
      // 藤帘中段大叶 + 顶部横根
      obsPx(ctx, x0 + 2, base - 10, w - 4, 10, '#2e2013');
      leafBlob(ctx, x0 + w * 0.62, base - h * 0.52, w * 0.44, h * 0.26, ['#163d1c', '#2f6e39', '#5cb868', '#b8d85c']);
    }
  }

  /** 海底·尖锐礁岩群 + 分叉珊瑚（v3 巨礁多峰） */
  function drawSeabedReef(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    const seed = Math.floor(r.x / 30);
    const peaks = v === 3
      ? [[0.20, 0.72], [0.42, 1.0], [0.66, 0.84], [0.86, 0.6]]
      : v === 2 ? [[0.5, 0.55]] : v === 0 ? [[0.30, 1.0], [0.66, 0.72]] : [[0.36, 0.92], [0.7, 0.6]];
    // 岩群整体剪影
    const pts = [[x0, base]];
    peaks.forEach(p => pts.push([x0 + w * p[0] - 8, base - h * p[1] + 8], [x0 + w * p[0], base - h * p[1]], [x0 + w * p[0] + 9, base - h * p[1] + 10]));
    pts.push([x0 + w, base]);
    obsPoly(ctx, pts, v === 2 ? '#3a6a78' : '#2f7d8c', '#1d5464');
    // 岩面高光棱
    peaks.forEach((p, i) => {
      const px = x0 + w * p[0];
      obsPx(ctx, px - 3, base - h * p[1] + 12, 6, h * p[1] * 0.5, i % 2 ? '#7fc6d0' : '#5fb0c0');
    });
    // 珊瑚：分叉枝
    const coralN = v === 2 ? 3 : v === 3 ? 3 : 2;
    for (let k = 0; k < coralN; k++) {
      const cx = x0 + w * (0.2 + 0.24 * k + ((seed + k) % 3) * 0.04);
      const ch = h * (v === 2 ? 0.92 : 0.5 + 0.12 * k);
      const ccol = k % 2 ? '#ff8a6e' : '#d65e52';
      obsPx(ctx, cx - 4, base - ch, 8, ch, ccol);
      obsPx(ctx, cx - 13, base - ch * 0.78, 8, ch * 0.3, ccol);
      obsPx(ctx, cx + 5, base - ch * 0.9, 8, ch * 0.4, '#ff8a6e');
      obsPx(ctx, cx - 17, base - ch * 0.84, 7, 10, '#ffc48a');
      obsPx(ctx, cx + 10, base - ch * 0.98, 7, 10, '#ffd8a8');
    }
    // 海葵小点 + 沙底
    for (let i = 0; i < 4; i++) obsPx(ctx, x0 + 10 + ((seed * 7 + i * 31) % (w - 20)), base - 8, 5, 4, i % 2 ? '#b46ad8' : '#ff9ed0');
    obsPx(ctx, x0, base - 6, w, 6, '#c8b48a');
  }

  /** 海底·悬挂海藻：长短不一的波状长叶 + 顶端浮球（v3 海藻帘） */
  function drawSeabedKelp(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    const seed = Math.floor(r.x / 28);
    const lens = v === 3 ? [1.0, 0.7, 0.9, 0.55, 0.82] : v === 0 ? [1.0, 0.74, 0.88] : v === 1 ? [0.92, 0.62] : [0.8, 0.5];
    if (v === 3) obsPx(ctx, x0 + 2, base - 9, w - 4, 9, '#244038');   // 顶部岩座
    lens.forEach((lf, i) => {
      const sx = x0 + w * (i + 0.5) / lens.length;
      const seg = 11, len = seg * lf, ph = seed + i * 1.3, amp = 9 + (i % 3) * 3;
      for (let j = 0; j < len; j++) {
        const f = j / seg;
        const yy = base - j * (h / seg);
        const dx = Math.sin(j * 0.55 + ph) * amp * (0.3 + f * 0.9);
        const bw = 12 - f * 4;
        obsPx(ctx, sx + dx - bw / 2, yy - h / seg, bw, h / seg + 1, j % 2 ? '#1f6e58' : '#2f8f6e');
        obsPx(ctx, sx + dx - bw / 2, yy - h / seg, 3, h / seg, '#7fd8b0');
      }
      if (v === 3 || (seed + i) % 2 === 0) {
        const bx = sx + Math.sin(len * 0.55 + ph) * amp * lf;
        const by = base - h * lf;
        ctx.fillStyle = '#d8f4e8'; ctx.beginPath(); ctx.arc(bx, by, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7fd8b0'; ctx.beginPath(); ctx.arc(bx - 1, by - 1, 1.6, 0, TAU); ctx.fill();
      }
    });
  }

  /** 雪地·巨型冰壁（平顶参差、蓝白层理 + 灰黑岩基） */
  function drawIceWall(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY;
    const seed = Math.floor(r.x / 40);
    // 灰黑岩基
    obsPoly(ctx, [[x0, base], [x0 + w, base], [x0 + w - 14, base - 16], [x0 + w * 0.62, base - 10], [x0 + w * 0.3, base - 18], [x0 + 8, base - 10]], '#4a5560');
    obsPx(ctx, x0 + 6, base - 10, w - 12, 4, '#64707c');
    // 冰壁主体：两级参差顶
    const top1 = base - h, top2 = base - h * 0.74;
    obsPoly(ctx, [
      [x0 + 4, base - 12], [x0 + 4, top2 + 10], [x0 + w * 0.18, top2 + 10], [x0 + w * 0.24, top2 - 8],
      [x0 + w * 0.4, top2], [x0 + w * 0.46, top1 + 14], [x0 + w * 0.58, top1], [x0 + w * 0.66, top1 + 12],
      [x0 + w * 0.8, top2 - 6], [x0 + w - 6, top2 + 8], [x0 + w - 6, base - 12]
    ], '#b9dcf2', '#7fb6dc');
    // 层理亮带
    for (let i = 1; i <= 4; i++) obsPx(ctx, x0 + 8, base - 14 - i * h * 0.18, w - 16, 3, i % 2 ? '#eaf7ff' : '#9fcde8');
    // 顶冠积雪
    obsPx(ctx, x0 + w * 0.46, top1 + 10, w * 0.2, 5, '#ffffff');
    obsPx(ctx, x0 + w * 0.18, top2 + 6, w * 0.24, 4, '#ffffff');
    // 冰裂
    ctx.strokeStyle = '#6fa8ce'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.36 + (seed % 3) * 4, base - 18);
    ctx.lineTo(x0 + w * 0.4, top2); ctx.lineTo(x0 + w * 0.46, top1 + 16);
    ctx.moveTo(x0 + w * 0.72, base - 16); ctx.lineTo(x0 + w * 0.68, top2);
    ctx.stroke();
  }

  /** 城堡·城墙/塔楼/巨塔（v3 尖锥顶巨塔，v0 塔楼，v1 城墙段，v2 雕像旗杆） */
  function drawCastleWall(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    if (v === 2) {
      obsPx(ctx, x0 + w * 0.34, base - h * 0.86, w * 0.32, h * 0.86, '#c99a5e');
      obsPx(ctx, x0 + w * 0.28, base - h * 0.86, w * 0.44, 9, '#e8c084');
      obsPx(ctx, x0 + w * 0.46, base - h, 5, h * 0.2, '#5a4632');
      obsPx(ctx, x0 + w * 0.51, base - h * 0.97, 20, 12, '#d86a3a');
      return;
    }
    const giant = v === 3;
    const bodyH = giant ? h * 0.74 : v === 0 ? h * 0.82 : h * 0.66;
    // 主体（巨塔微收分）
    const bx = giant ? w * 0.1 : 0, bw = giant ? w * 0.8 : w;
    obsPx(ctx, x0 + bx, base - bodyH, bw, bodyH, '#c99a5e');
    obsPx(ctx, x0 + bx, base - bodyH, Math.max(6, bw * 0.16), bodyH, '#e8c084');   // 受光面
    obsPx(ctx, x0 + bx + bw - 7, base - bodyH, 7, bodyH, '#a87f4e');               // 暗面
    // 石块错缝
    for (let yy = base - bodyH + 14; yy < base - 4; yy += 16) {
      obsPx(ctx, x0 + bx, yy, bw, 2, '#8a6a45');
      const off = (Math.floor(yy / 16) % 2) ? 16 : 0;
      for (let xx = x0 + bx + 10 + off; xx < x0 + bx + bw - 8; xx += 28) obsPx(ctx, xx, yy - 13, 2, 13, '#a87f4e');
    }
    obsPx(ctx, x0 + bx, base - 6, bw, 6, '#7a5a3a');
    // 城垛
    const topY = base - bodyH;
    if (v === 1) {
      const mer = 6, mw = bw / mer;
      for (let i = 0; i < mer; i++) obsPx(ctx, x0 + bx + i * mw + mw * 0.2, topY - 9, mw * 0.6, 10, '#c99a5e');
      // 两个箭窗
      obsPx(ctx, x0 + w * 0.22, topY + bodyH * 0.3, 8, 20, '#5a4632');
      obsPx(ctx, x0 + w * 0.70, topY + bodyH * 0.3, 8, 20, '#5a4632');
    } else {
      const mer = giant ? 3 : 4, mw = bw / mer;
      for (let i = 0; i < mer; i++) obsPx(ctx, x0 + bx + i * mw + mw * 0.2, topY - 10, mw * 0.6, 11, '#c99a5e');
      // 箭窗 + 门
      const cxw = x0 + bx + bw / 2;
      obsPx(ctx, cxw - 5, topY + bodyH * 0.28, 10, 24, '#5a4632');
      obsPx(ctx, cxw - 3, topY + bodyH * 0.28, 3, 24, '#8a6a45');
      if (giant) obsPx(ctx, cxw - 11, base - 34, 22, 34, '#5a4632');
    }
    if (giant) {
      // 尖锥塔顶 + 旗帜
      const cxw = x0 + w / 2;
      obsTri(ctx, cxw, topY - h * 0.26 + 2, topY, w * 0.52, '#9e3b2e', '#6e2820');
      obsPx(ctx, cxw - 2, topY - h * 0.3, 4, h * 0.12, '#5a4632');
      obsPx(ctx, cxw + 2, topY - h * 0.28, 22, 12, '#e8b341');
    }
  }

  /** 天空·浮石/断柱/巨型浮岛（v3 浮岛：平顶遗址 + 下方锥状岩体） */
  function drawFloatRock(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    const seed = Math.floor(r.x / 30);
    if (v === 2) {
      obsPx(ctx, x0 + w * 0.34, base - h, w * 0.32, h, '#8a90a8');
      obsPx(ctx, x0 + w * 0.34, base - h, w * 0.1, h, '#aab2cc');
      obsPx(ctx, x0 + w * 0.28, base - h, w * 0.44, 9, '#6b7390');
      obsPx(ctx, x0 + w * 0.4, base - h - 12, w * 0.2, 12, '#5a6178');
      return;
    }
    const island = v === 3;
    // 顶部平台
    const platH = island ? h * 0.3 : h * 0.5;
    const pw = w * (island ? 0.92 : 0.8);
    const pcx = x0 + w / 2;
    obsPx(ctx, pcx - pw / 2, base - platH, pw, platH, v === 1 ? '#5a6178' : '#6b7390');
    obsPx(ctx, pcx - pw / 2, base - platH, pw, 8, '#8a90a8');
    obsPx(ctx, pcx - pw / 2, base - 9, pw, 9, '#454b60');
    // 下方锥状锯齿岩体（逐行收窄）
    const coneRows = Math.ceil((h - platH) / 9);
    for (let i = 0; i < coneRows; i++) {
      const f = (i + 0.5) / coneRows;
      const ww = pw * (1 - f * (island ? 0.82 : 0.55));
      const cx = pcx + Math.sin(i * 2.1 + seed) * 5;
      obsPx(ctx, cx - ww / 2, base - platH - (i + 1) * 9, ww, 9, i % 2 ? '#4a5066' : '#545c74');
    }
    // 平台上的断裂柱
    const cols = island ? 2 : v === 0 ? 1 : 0;
    for (let i = 0; i < cols; i++) {
      const ccx = pcx + (i ? pw * 0.24 : -pw * 0.22);
      const ch = h * (island ? 0.3 : 0.22) * (i ? 0.8 : 1);
      obsPx(ctx, ccx - 7, base - platH - ch, 14, ch, '#9aa2c0');
      obsPx(ctx, ccx - 7, base - platH - ch, 4, ch, '#b8c0d8');
      obsPx(ctx, ccx - 11, base - platH - ch, 22, 7, '#6b7390');
    }
    // 悬浮碎石
    obsPx(ctx, x0 - 4, base - h - 14, 12, 9, '#8a90a8');
    obsPx(ctx, x0 + w - 2, base - h - 24, 8, 6, '#9aa2c0');
    if (island) obsPx(ctx, x0 + w * 0.1, base - h - 6, 9, 7, '#7a8298');
  }

  /** 仙人洞·几何方石/方柱/悬浮石板（冷青描边，v3 三段高柱） */
  function drawCaveBlock(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    if (v === 2) {
      obsPx(ctx, x0 + 2, base - h + 4, w - 4, h - 8, '#e4ecf2');
      obsPx(ctx, x0 + 2, base - h + 4, w - 4, 5, '#f6fafc');
      obsPx(ctx, x0 + 2, base - 12, w - 4, 8, '#c2ccd6');
      ctx.strokeStyle = '#7fc8d8'; ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 2.5, base - h + 4.5, w - 5, h - 9);
      obsPx(ctx, x0 - 8, base - h, 15, 5, '#d3dde5');
      obsPx(ctx, x0 + w - 6, base - 14, 13, 5, '#d3dde5');
      return;
    }
    const tall = v === 3;
    const segs = tall ? 3 : 1;
    const segH = h / segs;
    for (let s = 0; s < segs; s++) {
      const off = tall ? (s === 1 ? 5 : s === 2 ? -4 : 0) : 0;
      const sw = w - (tall ? 6 : 0);
      const sy0 = base - (s + 1) * segH + 4, sy1 = base - s * segH;
      obsPx(ctx, x0 + 3 + off, sy0, sw - 6, segH - 5, s % 2 ? '#e0e8ee' : '#eaf1f6');
      obsPx(ctx, x0 + 3 + off, sy0, sw - 6, 6, '#f8fbfd');
      obsPx(ctx, x0 + 3 + off, sy1 - 7, sw - 6, 5, '#b9c6d0');
      obsPx(ctx, x0 + 3 + off, sy0, 6, segH - 5, '#dde6ee');
      ctx.strokeStyle = '#76b8c8'; ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 3.5 + off, sy0 + 0.5, sw - 7, segH - 6);
    }
    // 中心几何纹
    const cx = x0 + w / 2, cy = base - h / 2, rr = Math.min(w, h) * (tall ? 0.14 : 0.22);
    ctx.strokeStyle = 'rgba(90,160,180,0.9)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - rr); ctx.lineTo(cx + rr, cy); ctx.lineTo(cx, cy + rr); ctx.lineTo(cx - rr, cy);
    ctx.closePath(); ctx.stroke();
  }

  /** 群山·异形山峰：v0 尖峰 / v1 双峰 / v2 迎客松 / v3 平顶山台 / v4 细石笋 */
  function drawMountainRock(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    const seed = Math.floor(r.x / 30);
    if (v === 2) {
      // 迎客松：岩座 + 弯曲树干 + 平冠
      obsPoly(ctx, [[x0 + w * 0.18, base], [x0 + w * 0.82, base], [x0 + w * 0.66, base - 18], [x0 + w * 0.34, base - 16]], '#5a6268');
      const cx = x0 + w / 2;
      obsPx(ctx, cx - 4, base - h * 0.72, 8, h * 0.72, '#3c3226');
      obsPx(ctx, cx - 4, base - h * 0.58, 24, 6, '#3c3226');
      obsPx(ctx, cx - 22, base - h * 0.54, 20, 5, '#33291e');
      leafBlob(ctx, cx - 16, base - h * 0.52, w * 0.56, h * 0.34, ['#2c3a2c', '#3c4a3a', '#56684f', '#7d8f6e']);
      leafBlob(ctx, cx + 14, base - h * 0.7, w * 0.46, h * 0.28, ['#2c3a2c', '#3c4a3a', '#56684f']);
      return;
    }
    const snowCap = (cx, topY, spread, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx - spread, topY + h * 0.2);
      ctx.lineTo(cx - spread * 0.25, topY + h * 0.13);
      ctx.lineTo(cx + spread * 0.18, topY + h * 0.26);
      ctx.lineTo(cx + spread * 0.7, topY + h * 0.12);
      ctx.closePath(); ctx.fill();
    };
    if (v === 3) {
      // 平顶山台：陡崖 + 水平层理
      const lx = x0 + w * 0.14, rx = x0 + w * 0.86, topY = base - h;
      obsPoly(ctx, [[x0, base], [lx, topY + 14], [lx + 8, topY], [rx - 8, topY], [rx, topY + 14], [x0 + w, base]], '#828a7e', '#5a6268');
      obsPx(ctx, lx + 8, topY, rx - lx - 16, 9, '#a2aaa0');
      snowCap((lx + rx) / 2, topY + 2, (rx - lx) * 0.42, '#d4ddda');
      for (let i = 1; i <= 4; i++) obsPx(ctx, lx + 4, topY + 12 + i * h * 0.17, rx - lx - 8 - (i % 2) * 14, 3, i % 2 ? '#6a7268' : '#8e968a');
      obsPx(ctx, x0 + w * 0.2, topY + h * 0.4, 6, h * 0.34, '#5f685e');
      return;
    }
    if (v === 1) {
      // 宽阔双峰
      obsTri(ctx, x0 + w * 0.34, base - h, base, w * 0.62, '#7a8478', '#5a6268');
      obsTri(ctx, x0 + w * 0.72, base - h * 0.74, base, w * 0.5, '#8e9888', '#5a6268');
      snowCap(x0 + w * 0.34, base - h, w * 0.2, '#c8d4d0');
      snowCap(x0 + w * 0.72, base - h * 0.74, w * 0.15, '#d4ddda');
      obsPx(ctx, x0 + w * 0.24, base - h * 0.6, 6, h * 0.34, '#646e5e');
      return;
    }
    // v0 尖峰 / v4 细石笋：多折角锯齿山脊
    const narrow = v === 4;
    const cx = x0 + w / 2 + (seed % 2 ? 4 : -4);
    const bw = w * (narrow ? 0.42 : 0.9);
    obsPoly(ctx, [
      [cx - bw / 2, base], [cx - bw * 0.3, base - h * 0.45], [cx - bw * 0.12, base - h * 0.72],
      [cx, base - h], [cx + bw * 0.1, base - h * 0.66], [cx + bw * 0.3, base - h * 0.36], [cx + bw / 2, base]
    ], narrow ? '#7a8478' : '#7a8478', '#5a6268');
    snowCap(cx, base - h, bw * 0.22, '#c8d4d0');
    obsPx(ctx, cx - bw * 0.22, base - h * 0.7, 5, h * 0.4, narrow ? '#8e9888' : '#98a296');
    if (!narrow) obsTri(ctx, x0 + w * 0.84, base - h * 0.5, base, w * 0.36, '#8e9888', '#5a6268');
  }

  /** 魔窟·石笋/钟乳簇（v3 巨大簇 + 发光晶体；翻转通用） */
  function drawDemonStal(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    const seed = Math.floor(r.x / 30);
    const n = v === 3 ? 4 : v === 0 ? 3 : v === 1 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const cx = x0 + w * f + ((seed + i) % 2 ? 4 : -3);
      const ch = h * [1, 0.62, 0.82, 0.5][i % 4] * (v === 3 ? 0.96 : 1);
      const bw = (w / n) * (v === 3 ? 0.92 : 0.82);
      obsPoly(ctx, [
        [cx - bw / 2, base], [cx - bw * 0.3, base - ch * 0.55], [cx - bw * 0.08, base - ch * 0.85],
        [cx, base - ch], [cx + bw * 0.1, base - ch * 0.8], [cx + bw * 0.32, base - ch * 0.5], [cx + bw / 2, base]
      ], i % 2 ? '#2c2240' : '#34294c', '#1a1428');
      obsPx(ctx, cx - 2, base - ch * 0.85, 3, ch * 0.6, i % 2 ? '#7a4cd8' : '#ff8a3c');
      obsPx(ctx, cx - 4, base - ch + 2, 8, 5, i % 2 ? '#b48aff' : '#ffc06e');
    }
    obsPx(ctx, x0, base - 6, w, 6, '#120e1e');
    if (v === 3) {
      // 发光小晶体
      for (let i = 0; i < 3; i++) {
        const cx = x0 + w * (0.2 + 0.3 * i);
        obsTri(ctx, cx, base - 26, base - 8, 12, i % 2 ? '#b48aff' : '#ff9a52');
      }
    }
  }

  /** 矩阵·数据方块/高塔/线框（v3 多屏数据塔；黑底荧光绿） */
  function drawDataBlock(ctx, r) {
    const x0 = r.left, w = r.w, h = r.h, base = r.baseY, v = r.def.v;
    obsPx(ctx, x0 + 2, base - h + 2, w - 4, h - 4, '#0c1612');
    obsPx(ctx, x0 + 6, base - h + 6, w - 12, h - 12, '#123026');
    ctx.strokeStyle = '#35ff9e'; ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 2.5, base - h + 2.5, w - 5, h - 5);
    // 角标
    ctx.fillStyle = '#35e0ff';
    [[x0 + 2, base - h + 2], [x0 + w - 8, base - h + 2], [x0 + 2, base - 10]].forEach(p => ctx.fillRect(p[0], p[1], 6, 6));
    if (v === 3) {
      // 三层数据屏 + 竖向光带
      for (let s = 0; s < 3; s++) {
        const py = base - h + 16 + s * (h - 40) / 3;
        obsPx(ctx, x0 + 12, py, w - 24, (h - 44) / 3, '#0a241c');
        ctx.strokeStyle = 'rgba(53,255,158,0.7)'; ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 12.5, py + 0.5, w - 25, (h - 44) / 3);
        for (let k = 0; k < 3; k++) obsPx(ctx, x0 + 17, py + 6 + k * 7, (w - 34) * (0.4 + 0.18 * ((s + k) % 3)), 2, 'rgba(53,255,158,0.85)');
      }
      obsPx(ctx, x0 + w - 12, base - h + 10, 4, h - 20, '#b46aff');
      return;
    }
    // 扫描码线
    for (let yy = base - h + 10; yy < base - 8; yy += 8) {
      const code = Math.floor(r.x / 8) + yy;
      obsPx(ctx, x0 + 8, yy, w - 16, 2, code % 3 ? 'rgba(53,255,158,0.55)' : 'rgba(180,106,255,0.7)');
      const lw = 6 + ((code * 7) % Math.floor(w * 0.5));
      obsPx(ctx, x0 + 8, yy + 3, lw, 3, 'rgba(53,255,158,0.85)');
    }
  }

  /* ---------------- 草龙（长条草木龙：60 节龙身 / 随机穿梭路线 / 断裂分裂） ---------------- */
  const GRASS = {
    segCount: 60,          // 本体节数
    segR: 13,              // 本体节半径
    miniR: 11,             // 分裂小节半径
    segSpace: 16,          // 本体节间距
    miniSpace: 15,         // 小节间距
    segHp: 45,             // 本体每节基础血量（未分裂整龙 3 倍强化；再乘难度系数）
    miniHp: 12,            // 分裂小段每节血量（保持原值不变）
    sweepSpd: 155,         // 天上穿梭速度
    vertSpd: 215,          // 出土 / 下钻垂直段速度
    burrowSpd: 275,        // 钻地高速
    miniBurrowSpd: 235,
    miniVertSpd: 265,
    xL: 44, xR: 918,
    spikeSpd: 430,
    miniChunk: 8           // 分裂小段最多节数（切块）
  };

  /** 角度归一化到 [-π, π] */
  function normAng(a) {
    a = (a + Math.PI) % TAU;
    if (a < 0) a += TAU;
    return a - Math.PI;
  }

  /* ============================================================
   * 龙系怪物主题表（7 张地图各 1 种：机制完全同草龙，外形/弹丸不同）
   *  - grass 草龙（草原）/ sand 沙虫（沙漠）/ black 黑龙（雪地）/
   *    red 红龙（火焰山）/ bone 骨蛇（紫色荒地）/ mech 机器蜈蚣（赛博都市）/
   *    sea 深海蓝龙（大海）
   * ============================================================ */

  /** 草龙龙身节：蓝边青绿鳞甲 + 蓝色背鳍 */
  function dragonSegGrass(ctx, d, s, i, t, th) {
    const r = d.segRAt(i);
    const n = d.segments.length;
    ctx.fillStyle = th.fin;
    ctx.beginPath();
    ctx.moveTo(s.x - r * 0.55, s.y - r * 0.7);
    ctx.lineTo(s.x + r * 0.55, s.y - r * 0.7);
    ctx.lineTo(s.x, s.y - r - 7 - (i % 2) * 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.finHi;
    ctx.beginPath();
    ctx.moveTo(s.x - r * 0.3, s.y - r * 0.7);
    ctx.lineTo(s.x + r * 0.3, s.y - r * 0.7);
    ctx.lineTo(s.x, s.y - r - 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(s.x, s.y, r + 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = th.belly;
    ctx.beginPath(); ctx.arc(s.x, s.y + r * 0.28, r * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = th.scale;
    ctx.beginPath(); ctx.arc(s.x - r * 0.25, s.y - r * 0.2, r * 0.18, 0, TAU); ctx.fill();
    if (i >= n - 1 && n > 2) {
      const prev = segs_safe(d, i - 1);
      if (prev) {
        const fa = Math.atan2(s.y - prev.y, s.x - prev.x);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(fa);
        ctx.fillStyle = th.fin;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.4); ctx.lineTo(r * 1.6, 0); ctx.lineTo(0, r * 1.4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = th.finHi;
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(r * 1.15, 0); ctx.lineTo(0, r);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  /** 草龙头：鹿角 / 长吻 / 长须 / 鬃毛 */
  function dragonHeadGrass(ctx, d, h, t, th) {
    const r = d.segR * 1.15;
    const mouthOpen = d.isMini && d.state === 'surface';
    for (let k = 0; k < 3; k++) {
      const bx = -r * (0.2 + k * 0.55);
      ctx.fillStyle = th.fin;
      ctx.beginPath();
      ctx.moveTo(bx - 5, -r * 0.7); ctx.lineTo(bx + 6, -r * 0.7); ctx.lineTo(bx + 1, -r * 1.5 - k * 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.finHi;
      ctx.beginPath();
      ctx.moveTo(bx - 3, -r * 0.7); ctx.lineTo(bx + 3, -r * 0.7); ctx.lineTo(bx, -r * 1.25);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = th.edge;
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.9); ctx.lineTo(-r * 1.3, -r * 1.95); ctx.lineTo(-r * 0.55, -r * 0.85);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.horn;
    ctx.beginPath();
    ctx.moveTo(-r * 1.02, -r * 1.68); ctx.lineTo(-r * 1.3, -r * 1.95); ctx.lineTo(-r * 0.88, -r * 1.55);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(0, 0, r + 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = th.edge;
    ctx.fillRect(r * 0.2, -r * 0.62, r * 1.55, r * 1.24);
    ctx.fillStyle = th.snout;
    ctx.fillRect(r * 0.32, -r * 0.5, r * 1.35, r * 1.0);
    if (mouthOpen) {
      ctx.fillStyle = '#7a1622';
      ctx.fillRect(r * 0.5, r * 0.16, r * 1.1, r * 0.44);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(r * 1.32, r * 0.18, 3, 3);
    } else {
      ctx.fillStyle = th.scale;
      ctx.fillRect(r * 0.35, r * 0.32, r * 1.2, r * 0.22);
    }
    ctx.fillStyle = th.edge;
    ctx.fillRect(r * 1.45, -r * 0.28, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r * 0.35, -r * 0.62, 7, 7);
    ctx.fillStyle = '#101018';
    ctx.fillRect(r * 0.55, -r * 0.5, 3.5, 4);
    ctx.fillStyle = th.edge;
    ctx.fillRect(r * 0.28, -r * 0.8, 9, 3);
    if (th.whisker) {
      ctx.strokeStyle = th.whisker;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let w = 0; w < 2; w++) {
        const wy = (w === 0 ? -1 : 1) * r * 0.25;
        const sw = Math.sin(t * 5 + w * 2) * 6;
        ctx.beginPath();
        ctx.moveTo(r * 1.45, wy);
        ctx.quadraticCurveTo(r * 2.1, wy + sw - w * 4, r * 2.7, wy + sw * 1.6 - w * 8);
        ctx.stroke();
      }
    }
  }

  /** 沙虫龙身节：圆柱形沙岩甲壳 + 深色节缝 + 碎沙岩块 */
  function dragonSegSand(ctx, d, s, i, t, th) {
    const r = d.segRAt(i);
    const n = d.segments.length;
    ctx.fillStyle = '#6b4a24';
    ctx.beginPath(); ctx.arc(s.x, s.y, r + 2.8, 0, TAU); ctx.fill();
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(s.x, s.y, r + 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = th.scale; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.7, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.7, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    ctx.fillStyle = th.belly;
    ctx.beginPath(); ctx.arc(s.x, s.y + r * 0.3, r * 0.56, 0, TAU); ctx.fill();
    ctx.fillStyle = th.scale;
    ctx.fillRect(s.x - r * 0.55, s.y - r * 0.5, 4, 4);
    ctx.fillRect(s.x + r * 0.18, s.y - r * 0.62, 3, 3);
    ctx.fillStyle = '#e8d4a0';
    ctx.fillRect(s.x - r * 0.08, s.y - r * 0.18, 3, 3);
    ctx.fillRect(s.x + r * 0.4, s.y + r * 0.1, 3, 3);
    if (i >= n - 1 && n > 2) {
      const prev = segs_safe(d, i - 1);
      if (prev) {
        const fa = Math.atan2(s.y - prev.y, s.x - prev.x);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(fa);
        ctx.fillStyle = th.edge;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.95); ctx.lineTo(r * 1.5, 0); ctx.lineTo(0, r * 0.95);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = th.fin;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.6); ctx.lineTo(r * 1.05, 0); ctx.lineTo(0, r * 0.6);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  /** 沙虫龙头：宽大头甲 + 巨大圆形口器与四根獠牙 */
  function dragonHeadSand(ctx, d, h, t, th) {
    const r = d.segR * 1.15;
    const mouthOpen = d.isMini && d.state === 'surface';
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(0, 0, r + 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * 0.95, 0, TAU); ctx.fill();
    // 顶部沙岩板甲
    ctx.fillStyle = th.scale;
    ctx.fillRect(-r * 0.6, -r * 1.02, r * 0.9, 5);
    ctx.fillRect(-r * 0.25, -r * 1.12, r * 0.7, 5);
    ctx.fillStyle = '#e8d4a0';
    ctx.fillRect(-r * 0.1, -r * 1.05, 4, 3);
    // 巨大口器
    ctx.fillStyle = '#5a1018';
    ctx.beginPath(); ctx.arc(r * 0.66, 0, r * 0.66, 0, TAU); ctx.fill();
    ctx.fillStyle = mouthOpen ? '#a83320' : '#7a1f18';
    ctx.beginPath(); ctx.arc(r * 0.66, 0, r * 0.46, 0, TAU); ctx.fill();
    // 獠牙（口器外探四根）
    ctx.fillStyle = '#fff5d8';
    const tusk = (x, y, dx, dy) => {
      ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + dx, y + dy); ctx.lineTo(x + 3, y);
      ctx.closePath(); ctx.fill();
    };
    tusk(r * 0.95, -r * 0.3, r * 0.7, -r * 0.4);
    tusk(r * 0.6, -r * 0.52, r * 0.15, -r * 0.75);
    tusk(r * 0.95, r * 0.3, r * 0.7, r * 0.4);
    tusk(r * 0.6, r * 0.52, r * 0.15, r * 0.75);
    // 小眼
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(r * 0.05, -r * 0.62, 4, 4);
    ctx.fillRect(r * 0.4, -r * 0.5, 4, 4);
  }

  /** 黑龙龙身节：黑鳞甲片 + 锋利暗红背棘 */
  function dragonSegBlack(ctx, d, s, i, t, th) {
    const r = d.segRAt(i);
    const n = d.segments.length;
    for (let k = -1; k <= 1; k++) {
      const bx = s.x + k * r * 0.5;
      const hh = r + 7 + (k === 0 ? 4 : 0);
      ctx.fillStyle = '#3a0a12';
      ctx.beginPath();
      ctx.moveTo(bx - 4.5, s.y - r * 0.72); ctx.lineTo(bx + 4.5, s.y - r * 0.72); ctx.lineTo(bx, s.y - hh);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.fin;
      ctx.beginPath();
      ctx.moveTo(bx - 2.6, s.y - r * 0.72); ctx.lineTo(bx + 2.6, s.y - r * 0.72); ctx.lineTo(bx, s.y - hh + 3);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(s.x, s.y, r + 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = th.scale; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y - r * 0.15, r * 0.6, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.fillStyle = 'rgba(142,27,43,0.85)';
    ctx.beginPath(); ctx.arc(s.x, s.y - r * 0.08, r * 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = th.belly;
    ctx.beginPath(); ctx.arc(s.x, s.y + r * 0.3, r * 0.52, 0, TAU); ctx.fill();
    if (i >= n - 1 && n > 2) {
      const prev = segs_safe(d, i - 1);
      if (prev) {
        const fa = Math.atan2(s.y - prev.y, s.x - prev.x);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(fa);
        ctx.fillStyle = '#3a0a12';
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 1.5, 0); ctx.lineTo(0, r * 1.3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = th.fin;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.9); ctx.lineTo(r * 1.05, 0); ctx.lineTo(0, r * 0.9);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  /** 黑龙头：尖吻 / 暗红后掠龙角 / 锋利背棘 / 赤红怒眼 */
  function dragonHeadBlack(ctx, d, h, t, th) {
    const r = d.segR * 1.15;
    const mouthOpen = d.isMini && d.state === 'surface';
    for (let k = 0; k < 3; k++) {
      const bx = -r * (0.2 + k * 0.5);
      ctx.fillStyle = '#3a0a12';
      ctx.beginPath();
      ctx.moveTo(bx - 5, -r * 0.7); ctx.lineTo(bx + 5, -r * 0.7); ctx.lineTo(bx, -r * 1.55 + k * 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.fin;
      ctx.beginPath();
      ctx.moveTo(bx - 3, -r * 0.7); ctx.lineTo(bx + 3, -r * 0.7); ctx.lineTo(bx, -r * 1.28 + k * 2);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#3a0a12';
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.85); ctx.lineTo(-r * 1.4, -r * 1.75); ctx.lineTo(-r * 0.5, -r * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.fin;
    ctx.beginPath();
    ctx.moveTo(-r * 1.05, -r * 1.45); ctx.lineTo(-r * 1.4, -r * 1.75); ctx.lineTo(-r * 0.82, -r * 1.38);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(0, 0, r + 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = th.edge;
    ctx.beginPath();
    ctx.moveTo(r * 0.3, -r * 0.5); ctx.lineTo(r * 1.75, -r * 0.12);
    ctx.lineTo(r * 1.75, r * 0.12); ctx.lineTo(r * 0.3, r * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.snout;
    ctx.beginPath();
    ctx.moveTo(r * 0.42, -r * 0.36); ctx.lineTo(r * 1.58, -r * 0.07);
    ctx.lineTo(r * 1.58, r * 0.07); ctx.lineTo(r * 0.42, r * 0.36);
    ctx.closePath(); ctx.fill();
    if (mouthOpen) {
      ctx.fillStyle = '#5a0a14';
      ctx.fillRect(r * 0.62, r * 0.06, r * 0.95, r * 0.42);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(r * 1.28, r * 0.08, 3, 3);
      ctx.fillRect(r * 0.9, r * 0.08, 3, 3);
    } else {
      ctx.fillStyle = th.fin;
      ctx.fillRect(r * 0.45, r * 0.28, r * 1.15, 2.5);
    }
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(r * 0.3, -r * 0.55, 7, 6);
    ctx.fillStyle = '#ffd0c0';
    ctx.fillRect(r * 0.46, -r * 0.49, 3, 3);
    ctx.fillStyle = '#3a0a12';
    ctx.fillRect(r * 0.2, -r * 0.8, 10, 3);
  }

  /** 红龙龙身节：红鳞甲 + 火焰状金棘 + 中央金纹 */
  function dragonSegRed(ctx, d, s, i, t, th) {
    const r = d.segRAt(i);
    const n = d.segments.length;
    for (let k = -1; k <= 1; k++) {
      const bx = s.x + k * r * 0.5;
      const fl = 0.85 + Math.sin(i * 1.7 + k * 2) * 0.2;
      const hh = r + 8 * fl + (k === 0 ? 4 : 0);
      ctx.fillStyle = '#b8501a';
      ctx.beginPath();
      ctx.moveTo(bx - 5, s.y - r * 0.7); ctx.lineTo(bx + 5, s.y - r * 0.7); ctx.lineTo(bx, s.y - hh);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.fin;
      ctx.beginPath();
      ctx.moveTo(bx - 3, s.y - r * 0.7); ctx.lineTo(bx + 3, s.y - r * 0.7); ctx.lineTo(bx, s.y - hh + 4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.finHi;
      ctx.fillRect(bx - 1.4, s.y - hh + 2, 2.8, 5);
    }
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(s.x, s.y, r + 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = th.scale; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y - r * 0.15, r * 0.62, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    // 中央金黄发光纹路
    const gl = 0.75 + Math.sin(t * 5 + i) * 0.25;
    ctx.fillStyle = th.horn;
    ctx.beginPath(); ctx.arc(s.x, s.y - r * 0.1, r * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,240,170,${gl})`;
    ctx.beginPath(); ctx.arc(s.x, s.y - r * 0.1, r * 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = th.belly;
    ctx.beginPath(); ctx.arc(s.x, s.y + r * 0.28, r * 0.6, 0, TAU); ctx.fill();
    if (i >= n - 1 && n > 2) {
      const prev = segs_safe(d, i - 1);
      if (prev) {
        const fa = Math.atan2(s.y - prev.y, s.x - prev.x);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(fa);
        // 火焰尾鳍
        ctx.fillStyle = th.edge;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 1.6, 0); ctx.lineTo(0, r * 1.3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = th.fin;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.9); ctx.lineTo(r * 1.15, 0); ctx.lineTo(0, r * 0.9);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = th.finHi;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.5); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r * 0.5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  /** 红龙头：金角 / 火焰鬃 / 红吻 / 琥珀怒眼 / 金须 */
  function dragonHeadRed(ctx, d, h, t, th) {
    const r = d.segR * 1.15;
    const mouthOpen = d.isMini && d.state === 'surface';
    // 火焰鬃
    for (let k = 0; k < 3; k++) {
      const bx = -r * (0.15 + k * 0.5);
      const fl = 0.9 + Math.sin(t * 8 + k) * 0.15;
      ctx.fillStyle = th.fin;
      ctx.beginPath();
      ctx.moveTo(bx - 6, -r * 0.7); ctx.lineTo(bx + 6, -r * 0.7); ctx.lineTo(bx, -r * (1.5 + k * 0.15) * fl);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.finHi;
      ctx.fillRect(bx - 1.5, -r * (1.35 + k * 0.12) * fl, 3, 5);
    }
    // 金角
    ctx.fillStyle = '#c98a1e';
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.9); ctx.lineTo(-r * 1.3, -r * 1.95); ctx.lineTo(-r * 0.55, -r * 0.85);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.horn;
    ctx.beginPath();
    ctx.moveTo(-r * 1.02, -r * 1.68); ctx.lineTo(-r * 1.3, -r * 1.95); ctx.lineTo(-r * 0.88, -r * 1.55);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(0, 0, r + 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = th.edge;
    ctx.fillRect(r * 0.2, -r * 0.62, r * 1.55, r * 1.24);
    ctx.fillStyle = th.snout;
    ctx.fillRect(r * 0.32, -r * 0.5, r * 1.35, r * 1.0);
    if (mouthOpen) {
      ctx.fillStyle = '#7a1622';
      ctx.fillRect(r * 0.5, r * 0.16, r * 1.1, r * 0.44);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(r * 1.32, r * 0.18, 3, 3);
    } else {
      ctx.fillStyle = th.scale;
      ctx.fillRect(r * 0.35, r * 0.32, r * 1.2, r * 0.22);
    }
    ctx.fillStyle = th.edge;
    ctx.fillRect(r * 1.45, -r * 0.28, 3, 3);
    ctx.fillStyle = th.horn;
    ctx.fillRect(r * 0.32, -r * 0.62, 7, 7);
    ctx.fillStyle = '#5a0a00';
    ctx.fillRect(r * 0.52, -r * 0.5, 3.5, 4);
    ctx.fillStyle = '#7a1a10';
    ctx.fillRect(r * 0.26, -r * 0.8, 9, 3);
    ctx.strokeStyle = th.whisker;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let w = 0; w < 2; w++) {
      const wy = (w === 0 ? -1 : 1) * r * 0.25;
      const sw = Math.sin(t * 5 + w * 2) * 6;
      ctx.beginPath();
      ctx.moveTo(r * 1.45, wy);
      ctx.quadraticCurveTo(r * 2.1, wy + sw - w * 4, r * 2.7, wy + sw * 1.6 - w * 8);
      ctx.stroke();
    }
  }

  /** 骨蛇龙身节：独立脊椎骨 + 肋骨 + 脊刺（节间明显断开） */
  function dragonSegBone(ctx, d, s, i, t, th) {
    const r = d.segRAt(i);
    const n = d.segments.length;
    // 脊椎骨刺
    ctx.fillStyle = th.finHi;
    ctx.beginPath();
    ctx.moveTo(s.x - 3, s.y - r * 0.72); ctx.lineTo(s.x + 3, s.y - r * 0.72); ctx.lineTo(s.x, s.y - r - 6);
    ctx.closePath(); ctx.fill();
    // 椎骨
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.92, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.8, 0, TAU); ctx.fill();
    ctx.fillStyle = th.fin;
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.42, 0, TAU); ctx.fill();
    // 肋骨
    ctx.strokeStyle = th.fin; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x - r * 0.28, s.y - r * 0.15); ctx.lineTo(s.x - r * 0.95, s.y + r * 0.55);
    ctx.moveTo(s.x + r * 0.28, s.y - r * 0.15); ctx.lineTo(s.x + r * 0.95, s.y + r * 0.55);
    ctx.stroke();
    if (i >= n - 1 && n > 2) {
      const prev = segs_safe(d, i - 1);
      if (prev) {
        const fa = Math.atan2(s.y - prev.y, s.x - prev.x);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(fa);
        ctx.fillStyle = th.finHi;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.5); ctx.lineTo(r * 1.1, 0); ctx.lineTo(0, r * 0.5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    // 裂开效果（完全体时身体节被打至锁血1）
    if (s.cracked) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x - r * 0.5, s.y - r * 0.3);
      ctx.lineTo(s.x - r * 0.1, s.y + r * 0.1);
      ctx.lineTo(s.x + r * 0.3, s.y - r * 0.2);
      ctx.lineTo(s.x + r * 0.6, s.y + r * 0.35);
      ctx.moveTo(s.x - r * 0.2, s.y + r * 0.5);
      ctx.lineTo(s.x + r * 0.1, s.y + r * 0.15);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(74,222,128,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - r * 0.5, s.y - r * 0.3);
      ctx.lineTo(s.x + r * 0.6, s.y + r * 0.35);
      ctx.stroke();
    }
  }

  /** 骨蛇头：白骨颅骨 / 空洞眼窝 / 颚骨利齿 */
  function dragonHeadBone(ctx, d, h, t, th) {
    const r = d.segR * 1.15;
    const mouthOpen = d.isMini && d.state === 'surface';
    // 破损角桩
    ctx.fillStyle = th.fin;
    ctx.fillRect(-r * 0.55, -r * 1.3, 6, 11);
    ctx.fillRect(-r * 0.12, -r * 1.42, 5, 9);
    // 颅骨
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(-r * 0.1, 0, r + 2, 0, TAU); ctx.fill();
    ctx.fillStyle = th.belly;
    ctx.beginPath(); ctx.arc(-r * 0.1, 0, r, 0, TAU); ctx.fill();
    // 骨吻
    ctx.fillStyle = th.body;
    ctx.fillRect(r * 0.3, -r * 0.42, r * 1.4, r * 0.84);
    ctx.fillStyle = th.fin;
    ctx.fillRect(r * 0.3, r * 0.32, r * 1.4, 3);
    // 空洞眼窝
    ctx.fillStyle = '#241f1a';
    ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.26, r * 0.24, 0, TAU); ctx.fill();
    // 鼻腔
    ctx.beginPath();
    ctx.moveTo(r * 1.62, 0); ctx.lineTo(r * 1.24, -r * 0.18); ctx.lineTo(r * 1.24, r * 0.18);
    ctx.closePath(); ctx.fill();
    // 颚骨 / 利齿
    if (mouthOpen) {
      ctx.fillStyle = '#241f1a';
      ctx.fillRect(r * 0.55, r * 0.1, r * 1.05, r * 0.5);
      ctx.fillStyle = '#ffffff';
      for (let q = 0; q < 4; q++) ctx.fillRect(r * 0.62 + q * r * 0.26, r * 0.14, 3, 5);
    } else {
      ctx.fillStyle = '#ffffff';
      for (let q = 0; q < 4; q++) ctx.fillRect(r * 0.48 + q * r * 0.27, r * 0.34, 3, 3);
    }
  }

  /** 巨型骨龙王龙头：重绘美术 assets/Boss/gulongnaodai.png（白色骨龙侧头，长吻朝 +x，背景透明）。
   *  在“已 translate(头位置) + rotate(朝向)”坐标系内绘制。锚点/缩放经浏览器校准：
   *  图像素 (317,300) = 颈关节原点；s = 0.275（headR=24.4 基准），随 headR 等比缩放。
   *  侧视图朝左（hx<0）时整体旋转 180° 会令头冠朝下、上颚翻转，故沿身体纵轴（局部 x 轴）
   *  再做一次垂直镜像，保证头冠/点赞手始终朝上、吻部朝向前方。 */
  function dragonHeadBoneKing(ctx, d, h, t, th) {
    const r = d.headR || d.segR * 1.22;
    const spr = (typeof Sprites !== 'undefined') && Sprites.gulongHead;
    if (!spr || !spr.width) return;
    const k = 0.275 * (r / 24.4);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if (d.hx < 0) ctx.scale(1, -1);
    ctx.drawImage(spr, -317 * k, -300 * k, spr.width * k, spr.height * k);
    ctx.restore();
  }

  /** 机器蜈蚣龙身节：方形装甲舱 + 铜关节 + 发光核心 + 两侧机械腿 */
  function dragonSegMech(ctx, d, s, i, t, th) {
    const r = d.segRAt(i);
    const n = d.segments.length;
    // 机械腿（步态摆动）
    const swing = Math.sin(t * 12 + i * 0.9);
    ctx.strokeStyle = '#7a8599'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      const ph = swing * dir;
      ctx.beginPath();
      ctx.moveTo(s.x + dir * r * 0.72, s.y + r * 0.3);
      ctx.lineTo(s.x + dir * (r + 7), s.y + r * 0.95 + ph * 3);
      ctx.stroke();
      ctx.fillStyle = th.fin;
      ctx.fillRect(s.x + dir * (r + 6) - 2, s.y + r * 0.95 + ph * 3 - 2, 4, 4);
    }
    // 顶部液压管
    ctx.fillStyle = th.scale;
    ctx.fillRect(s.x - r * 0.5, s.y - r - 5, r, 4);
    // 方形装甲舱
    ctx.fillStyle = th.edge;
    ctx.fillRect(s.x - r * 0.98, s.y - r * 0.88, r * 1.96, r * 1.76);
    ctx.fillStyle = th.body;
    ctx.fillRect(s.x - r * 0.8, s.y - r * 0.7, r * 1.6, r * 1.4);
    // 铜色铆钉
    ctx.fillStyle = th.fin;
    ctx.fillRect(s.x - r * 0.88, s.y - r * 0.78, 4, 4);
    ctx.fillRect(s.x + r * 0.88 - 4, s.y - r * 0.78, 4, 4);
    ctx.fillRect(s.x - r * 0.88, s.y + r * 0.78 - 4, 4, 4);
    ctx.fillRect(s.x + r * 0.88 - 4, s.y + r * 0.78 - 4, 4, 4);
    // 发光核心
    const gl = 0.65 + Math.sin(t * 6 + i) * 0.35;
    ctx.fillStyle = `rgba(53,224,255,${0.3 * gl})`;
    ctx.fillRect(s.x - r * 0.42, s.y - r * 0.42, r * 0.84, r * 0.84);
    ctx.fillStyle = th.belly;
    ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    ctx.fillStyle = '#d8fbff';
    ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    if (i >= n - 1 && n > 2) {
      const prev = segs_safe(d, i - 1);
      if (prev) {
        const fa = Math.atan2(s.y - prev.y, s.x - prev.x);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(fa);
        // 排气口
        ctx.fillStyle = th.edge;
        ctx.fillRect(r * 0.6, -r * 0.4, r * 0.8, r * 0.8);
        const fl = 0.5 + Math.random() * 0.5;
        ctx.fillStyle = `rgba(255,140,40,${fl})`;
        ctx.fillRect(r * 1.3, -r * 0.22, r * 0.5 * fl + 3, r * 0.44);
        ctx.restore();
      }
    }
  }

  /** 机器蜈蚣头：方形机械头 + 光学扫描目镜 + 铜质钳形口器 + 警示灯天线 */
  function dragonHeadMech(ctx, d, h, t, th) {
    const r = d.segR * 1.15;
    // 天线 + 警示灯
    ctx.strokeStyle = '#7a8599'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.85); ctx.lineTo(-r * 0.55, -r * 1.6); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ff3b3b' : '#7a1010';
    ctx.beginPath(); ctx.arc(-r * 0.6, -r * 1.66, 3.2, 0, TAU); ctx.fill();
    // 头部装甲
    ctx.fillStyle = th.edge;
    ctx.fillRect(-r * 0.95, -r * 0.88, r * 1.95, r * 1.76);
    ctx.fillStyle = th.body;
    ctx.fillRect(-r * 0.75, -r * 0.68, r * 1.62, r * 1.36);
    // 铜钳口器
    for (const dir of [-1, 1]) {
      ctx.fillStyle = th.fin;
      ctx.beginPath();
      ctx.moveTo(r * 0.5, dir * r * 0.22);
      ctx.lineTo(r * 1.6, dir * r * 0.72);
      ctx.lineTo(r * 1.5, dir * r * 0.28);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.finHi;
      ctx.fillRect(r * 1.35, dir * r * 0.46, 5, 3);
    }
    // 光学扫描目镜
    const scan = 0.65 + Math.sin(t * 10) * 0.35;
    ctx.fillStyle = '#100608';
    ctx.fillRect(r * 0.02, -r * 0.52, r * 0.78, 8);
    ctx.fillStyle = `rgba(255,60,60,${scan})`;
    ctx.fillRect(r * 0.08, -r * 0.44, r * 0.64, 3.4);
    // 铆钉
    ctx.fillStyle = th.fin;
    ctx.fillRect(-r * 0.62, -r * 0.58, 4, 4);
    ctx.fillRect(-r * 0.62, r * 0.48, 4, 4);
  }

  /** 深海蓝龙龙身节：深蓝鱼鳞甲 + 半透明鳍膜与侧鳍 + 水光 */
  function dragonSegSea(ctx, d, s, i, t, th) {
    const r = d.segRAt(i);
    const n = d.segments.length;
    // 半透明背鳍膜
    ctx.fillStyle = 'rgba(140,220,255,0.38)';
    ctx.beginPath();
    ctx.moveTo(s.x - r * 0.72, s.y - r * 0.72);
    ctx.quadraticCurveTo(s.x, s.y - r - 12, s.x + r * 0.72, s.y - r * 0.72);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,255,0.85)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(s.x - r * 0.72, s.y - r * 0.72);
    ctx.quadraticCurveTo(s.x, s.y - r - 12, s.x + r * 0.72, s.y - r * 0.72);
    ctx.stroke();
    ctx.fillStyle = th.fin;
    for (let k = -1; k <= 1; k++) {
      const bx = s.x + k * r * 0.36;
      ctx.fillRect(bx - 1.6, s.y - r - 7 + Math.abs(k) * 5, 3.2, 8 - Math.abs(k) * 3);
    }
    // 节身
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(s.x, s.y, r + 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    // 鱼鳞弧
    ctx.strokeStyle = th.scale; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y - r * 0.2, r * 0.6, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x - r * 0.32, s.y + r * 0.12, r * 0.34, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x + r * 0.32, s.y + r * 0.12, r * 0.34, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
    // 腹
    ctx.fillStyle = th.belly;
    ctx.beginPath(); ctx.arc(s.x, s.y + r * 0.28, r * 0.6, 0, TAU); ctx.fill();
    // 半透明侧鳍
    ctx.fillStyle = 'rgba(140,220,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(s.x - r * 0.2, s.y + r * 0.25); ctx.lineTo(s.x - r * 1.15, s.y + r * 0.65); ctx.lineTo(s.x - r * 0.3, s.y + r * 0.62);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s.x + r * 0.2, s.y + r * 0.25); ctx.lineTo(s.x + r * 1.15, s.y + r * 0.65); ctx.lineTo(s.x + r * 0.3, s.y + r * 0.62);
    ctx.closePath(); ctx.fill();
    // 水光高光
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(s.x - r * 0.42, s.y - r * 0.5, 3, 3);
    if (i >= n - 1 && n > 2) {
      const prev = segs_safe(d, i - 1);
      if (prev) {
        const fa = Math.atan2(s.y - prev.y, s.x - prev.x);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(fa);
        // 叉形鱼尾鳍（半透明）
        ctx.fillStyle = 'rgba(47,184,168,0.85)';
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.5); ctx.lineTo(r * 1.5, -r * 0.3); ctx.lineTo(r * 0.5, 0); ctx.lineTo(r * 1.5, r * 0.3);
        ctx.lineTo(0, r * 1.5); ctx.lineTo(-r * 0.2, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(180,240,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 1.05, -r * 0.2); ctx.lineTo(r * 0.3, 0); ctx.lineTo(r * 1.05, r * 0.2);
        ctx.lineTo(0, r * 1.1); ctx.lineTo(-r * 0.1, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  /** 深海蓝龙头：珊瑚状分枝龙角 / 头侧鱼鳍 / 鳃弧 / 水流长须 */
  function dragonHeadSea(ctx, d, h, t, th) {
    const r = d.segR * 1.15;
    const mouthOpen = d.isMini && d.state === 'surface';
    // 珊瑚状分枝龙角
    ctx.strokeStyle = th.fin; ctx.lineCap = 'round';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.55); ctx.lineTo(-r * 0.62, -r * 1.5);
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 1.05); ctx.lineTo(-r * 0.95, -r * 1.4);
    ctx.moveTo(-r * 0.52, -r * 1.25); ctx.lineTo(-r * 0.18, -r * 1.68);
    ctx.stroke();
    // 头侧半透明鱼鳍
    ctx.fillStyle = 'rgba(140,220,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.15); ctx.lineTo(-r * 1.3, -r * 0.9); ctx.lineTo(-r * 0.72, r * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, r * 0.15); ctx.lineTo(-r * 1.3, r * 0.9); ctx.lineTo(-r * 0.72, -r * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,255,0.85)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.15); ctx.lineTo(-r * 1.3, -r * 0.9);
    ctx.moveTo(-r * 0.3, r * 0.15); ctx.lineTo(-r * 1.3, r * 0.9);
    ctx.stroke();
    // 头基
    ctx.fillStyle = th.edge;
    ctx.beginPath(); ctx.arc(0, 0, r + 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = th.body;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    // 吻
    ctx.fillStyle = th.edge;
    ctx.fillRect(r * 0.2, -r * 0.6, r * 1.52, r * 1.2);
    ctx.fillStyle = th.snout;
    ctx.fillRect(r * 0.32, -r * 0.48, r * 1.32, r * 0.96);
    // 鳃弧
    ctx.strokeStyle = th.edge; ctx.lineWidth = 2;
    for (let q = 0; q < 3; q++) {
      ctx.beginPath(); ctx.arc(-r * 0.28, 0, r * (0.34 + q * 0.17), -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
    }
    if (mouthOpen) {
      ctx.fillStyle = '#062a44';
      ctx.fillRect(r * 0.5, r * 0.16, r * 1.1, r * 0.42);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(r * 1.3, r * 0.18, 3, 3);
    } else {
      ctx.fillStyle = th.scale;
      ctx.fillRect(r * 0.35, r * 0.3, r * 1.2, r * 0.2);
    }
    ctx.fillStyle = th.edge;
    ctx.fillRect(r * 1.45, -r * 0.26, 3, 3);
    // 眼
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r * 0.35, -r * 0.6, 7, 7);
    ctx.fillStyle = '#0d3b66';
    ctx.fillRect(r * 0.55, -r * 0.48, 3.5, 4);
    ctx.fillStyle = th.edge;
    ctx.fillRect(r * 0.28, -r * 0.78, 9, 3);
    // 水流长须（半透明飘摆）
    ctx.strokeStyle = th.whisker;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let w = 0; w < 2; w++) {
      const wy = (w === 0 ? -1 : 1) * r * 0.25;
      const sw = Math.sin(t * 5 + w * 2) * 8;
      ctx.beginPath();
      ctx.moveTo(r * 1.45, wy);
      ctx.quadraticCurveTo(r * 2.2, wy + sw - w * 5, r * 2.9, wy + sw * 1.8 - w * 10);
      ctx.stroke();
    }
  }

  const DRAGON_THEMES = {
    grass: {
      id: 'grass', name: '草龙', warn: '草龙 钻出地面了！', spike: 'spike', spinRate: 9,
      edge: '#1553b0', body: '#2fb37c', belly: '#a7ecc4', fin: '#1553b0', finHi: '#2b8fe0',
      scale: '#259666', horn: '#e8f7d8', whisker: '#2b8fe0', snout: '#3cc98d',
      mound: ['#5a3d22', '#6b4a2a', '#4f9e44'],
      dust: ['#6b4a2a', '#4f9e44', '#7ed46d'],
      fx: ['#6b4a2a', '#4f9e44', '#7ed46d', '#d8c9a3'],
      hit: ['#ffffff', '#bff5d6', '#7ed46d'],
      death: ['#2fb37c', '#3cc98d', '#1e6fd0', '#d8ffe8', '#ffffff'],
      noSpine: false, seg: dragonSegGrass, head: dragonHeadGrass
    },
    sand: {
      id: 'sand', name: '沙虫', warn: '沙虫 破沙而出！', spike: 'sandspike', spinRate: 9,
      edge: '#7a5a2e', body: '#c9a05a', belly: '#e0c384', fin: '#a8843f', finHi: '#8a6a36',
      scale: '#8a6a36', horn: '#e8d4a0', whisker: null, snout: '#d4ae66',
      mound: ['#a8804a', '#c9a05a', '#e0c384'],
      dust: ['#c9a05a', '#e0c384', '#8a6a36'],
      fx: ['#c9a05a', '#e0c384', '#8a6a36', '#e8d4a0'],
      hit: ['#ffffff', '#e8d4a0', '#c9a05a'],
      death: ['#c9a05a', '#e0c384', '#8a6a36', '#f0e0b8', '#ffffff'],
      noSpine: false, seg: dragonSegSand, head: dragonHeadSand
    },
    black: {
      id: 'black', name: '黑龙', warn: '黑龙 踏雪而来！', spike: 'blackscale', spinRate: 14,
      edge: '#0a0a12', body: '#1c1c26', belly: '#3a3a4a', fin: '#8e1b2b', finHi: '#ff4a4a',
      scale: '#35354a', horn: '#8e1b2b', whisker: null, snout: '#2c2c3a',
      mound: ['#9fb4c8', '#cfe2ef', '#f2f8fc'],
      dust: ['#cfe2ef', '#f2f8fc', '#a9c4d8'],
      fx: ['#cfe2ef', '#f2f8fc', '#8e1b2b', '#ffffff'],
      hit: ['#ffffff', '#ff8a8a', '#8e1b2b'],
      death: ['#1c1c26', '#3a3a4a', '#8e1b2b', '#ff4a4a', '#ffffff'],
      noSpine: false, seg: dragonSegBlack, head: dragonHeadBlack
    },
    red: {
      id: 'red', name: '红龙', warn: '红龙 熔岩苏醒！', spike: 'lavafang', spinRate: 9,
      edge: '#7a1a10', body: '#d83a22', belly: '#ffb066', fin: '#ff8c1a', finHi: '#ffc83b',
      scale: '#a81e10', horn: '#ffc83b', whisker: '#ffc83b', snout: '#e8502e',
      mound: ['#2b1d1f', '#3a2626', '#ff7b2e'],
      dust: ['#3a2626', '#ff7b2e', '#ffd23b'],
      fx: ['#3a2626', '#ff7b2e', '#ffd23b', '#c94a1e'],
      hit: ['#ffffff', '#ffd23b', '#ff7b2e'],
      death: ['#d83a22', '#ff7b2e', '#ffc83b', '#fff5d0', '#ffffff'],
      noSpine: false, seg: dragonSegRed, head: dragonHeadRed
    },
    bone: {
      id: 'bone', name: '骨蛇', warn: '骨蛇 破土而出！', spike: 'boneshard', spinRate: 16,
      edge: '#8f8a78', body: '#d8d3c2', belly: '#e8e4d8', fin: '#b5ae9a', finHi: '#c8c2ae',
      scale: '#b5ae9a', horn: '#c8c2ae', whisker: null, snout: '#c8c2ae',
      mound: ['#3d2b4d', '#5a3f63', '#6e4f7a'],
      dust: ['#46324e', '#573f5f', '#2c1f36'],
      fx: ['#46324e', '#573f5f', '#b5ae9a', '#d8d3c2'],
      hit: ['#ffffff', '#e8e4d8', '#b5ae9a'],
      death: ['#d8d3c2', '#e8e4d8', '#b5ae9a', '#ffffff', '#8f8a78'],
      noSpine: true, seg: dragonSegBone, head: dragonHeadBone, headKing: dragonHeadBoneKing
    },
    mech: {
      id: 'mech', name: '机器蜈蚣', warn: '机器蜈蚣 钢铁来袭！', spike: 'gear', spinRate: 12,
      edge: '#0c0f16', body: '#2a3040', belly: '#454c5c', fin: '#b87333', finHi: '#e0a060',
      scale: '#454c5c', horn: '#b87333', whisker: null, snout: '#454c5c',
      core: '#35e0ff',
      mound: ['#191c24', '#2d313b', '#35e0ff'],
      dust: ['#2a3040', '#b87333', '#35e0ff'],
      fx: ['#2a3040', '#b87333', '#35e0ff', '#ff4fd8'],
      hit: ['#ffffff', '#35e0ff', '#b87333'],
      death: ['#2a3040', '#454c5c', '#b87333', '#35e0ff', '#ffffff'],
      noSpine: false, seg: dragonSegMech, head: dragonHeadMech
    },
    sea: {
      id: 'sea', name: '深海蓝龙', warn: '深海蓝龙 破浪而出！', spike: 'seaspike', spinRate: 9,
      edge: '#0d3b66', body: '#1f6fb8', belly: '#9fd9f5', fin: '#2fb8a8', finHi: '#5fe0c8',
      scale: '#2a86d0', horn: '#2fb8a8', whisker: 'rgba(180,235,255,0.8)', snout: '#2f86cc',
      mound: ['#1b5a96', '#2b7fc8', '#d8f2ff'],
      dust: ['#2b7fc8', '#7fc6ef', '#d8f2ff'],
      fx: ['#1b5a96', '#2b7fc8', '#d8f2ff', '#9fd9f5'],
      hit: ['#ffffff', '#d8f2ff', '#7fc6ef'],
      death: ['#1f6fb8', '#2fb8a8', '#9fd9f5', '#d8f2ff', '#ffffff'],
      noSpine: false, seg: dragonSegSea, head: dragonHeadSea
    },
    // —— 新地图主题龙（复用既有节/头渲染器，仅换配色与名号）——
    jungle: {
      id: 'jungle', name: '藤蔓龙', warn: '藤蔓龙 拨叶而出！', spike: 'spike', spinRate: 9,
      edge: '#14401c', body: '#2f7a3a', belly: '#a8dca0', fin: '#1f5e26', finHi: '#7cc476',
      scale: '#25602c', horn: '#d8efb0', whisker: '#9bc84b', snout: '#3c9248',
      mound: ['#244014', '#3a2a18', '#2f6e39'],
      dust: ['#2f6e39', '#5cb868', '#3a2a18'],
      fx: ['#2f6e39', '#5cb868', '#9bc84b', '#d8f5c8'],
      hit: ['#ffffff', '#bfe8b0', '#7cc476'],
      death: ['#2f7a3a', '#5cb868', '#9bc84b', '#d8f5c8', '#ffffff'],
      noSpine: false, seg: dragonSegGrass, head: dragonHeadGrass
    },
    seabed: {
      id: 'seabed', name: '珊瑚海龙', warn: '珊瑚海龙 穿水而来！', spike: 'seaspike', spinRate: 9,
      edge: '#5a2a66', body: '#9a4da8', belly: '#e8b8f0', fin: '#2fb8a8', finHi: '#7fe8d8',
      scale: '#7d3e8c', horn: '#ff9ed8', whisker: 'rgba(200,240,255,0.85)', snout: '#b25cc0',
      mound: ['#10304a', '#1f5a6e', '#ff8a6e'],
      dust: ['#2f7d8c', '#ff8a6e', '#bfe8f0'],
      fx: ['#9a4da8', '#ff8a6e', '#7fe8d8', '#e8b8f0'],
      hit: ['#ffffff', '#f0c8ff', '#7fe8d8'],
      death: ['#9a4da8', '#ff9ed8', '#7fe8d8', '#e8b8f0', '#ffffff'],
      noSpine: false, seg: dragonSegSea, head: dragonHeadSea
    },
    castle: {
      id: 'castle', name: '石像飞龙', warn: '石像飞龙 破穹降临！', spike: 'boneshard', spinRate: 12,
      edge: '#6a4e30', body: '#b08a58', belly: '#e8d4a8', fin: '#8a6a45', finHi: '#e8c084',
      scale: '#8a6a45', horn: '#e8c084', whisker: '#d86a3a', snout: '#c99a5e',
      mound: ['#6a4e30', '#8a6a45', '#c99a5e'],
      dust: ['#8a6a45', '#c99a5e', '#e8c084'],
      fx: ['#8a6a45', '#c99a5e', '#e8c084', '#ffd98a'],
      hit: ['#ffffff', '#ffe8c0', '#e8c084'],
      death: ['#b08a58', '#e8c084', '#d86a3a', '#fff0d0', '#ffffff'],
      noSpine: true, seg: dragonSegBone, head: dragonHeadBone
    },
    sky: {
      id: 'sky', name: '雷云龙', warn: '雷云龙 驾霆而至！', spike: 'blackscale', spinRate: 15,
      edge: '#1c2540', body: '#3a4a86', belly: '#b8c8f0', fin: '#6a5acd', finHi: '#c8b8ff',
      scale: '#2c3a6e', horn: '#fff08a', whisker: '#fff7b0', snout: '#4a5aa8',
      mound: ['#2a3050', '#3a4a86', '#6a7cc0'],
      dust: ['#4a5aa8', '#8fa0d8', '#d8e0f8'],
      fx: ['#fff08a', '#c8b8ff', '#8fa0d8', '#ffffff'],
      hit: ['#ffffff', '#fff7b0', '#c8b8ff'],
      death: ['#3a4a86', '#6a5acd', '#fff08a', '#d8e0f8', '#ffffff'],
      noSpine: false, seg: dragonSegGrass, head: dragonHeadGrass
    },
    cave: {
      id: 'cave', name: '白玉蟠龙', warn: '白玉蟠龙 凝光现身！', spike: 'gear', spinRate: 11,
      edge: '#7a8a96', body: '#e8f0f4', belly: '#ffffff', fin: '#9fd8d8', finHi: '#c8f0ee',
      scale: '#b8ccd2', horn: '#7fc8d8', whisker: 'rgba(127,200,216,0.9)', snout: '#d8e6ea',
      mound: ['#c8d2dc', '#e8f0f4', '#ffffff'],
      dust: ['#e8f0f4', '#ffffff', '#7fc8d8'],
      fx: ['#ffffff', '#7fc8d8', '#9fd8d8', '#d8f4f2'],
      hit: ['#ffffff', '#d8f4f2', '#7fc8d8'],
      death: ['#e8f0f4', '#7fc8d8', '#ffffff', '#d8f4f2', '#c8d2dc'],
      noSpine: true, seg: dragonSegBone, head: dragonHeadBone
    },
    mountains: {
      id: 'mountains', name: '苍岩龙', warn: '苍岩龙 崩岩现身！', spike: 'blackscale', spinRate: 9,
      edge: '#3a4244', body: '#66726a', belly: '#b4c0b2', fin: '#54625c', finHi: '#8a988c',
      scale: '#4c5850', horn: '#c8d4d0', whisker: null, snout: '#76827a',
      mound: ['#4a5048', '#5a6258', '#7a8478'],
      dust: ['#5a6258', '#8a9488', '#c8d4d0'],
      fx: ['#5a6258', '#9aa392', '#c8d4d0', '#e8eee8'],
      hit: ['#ffffff', '#d8e0d6', '#9aa392'],
      death: ['#66726a', '#9aa392', '#c8d4d0', '#e8eee8', '#ffffff'],
      noSpine: false, seg: dragonSegBlack, head: dragonHeadBlack
    },
    demoncave: {
      id: 'demoncave', name: '魔窟妖龙', warn: '魔窟妖龙 妖火乍现！', spike: 'lavafang', spinRate: 13,
      edge: '#140a26', body: '#3c1e62', belly: '#8a5ac0', fin: '#7a2cd8', finHi: '#b46aff',
      scale: '#2c1650', horn: '#ff8a3c', whisker: '#b46aff', snout: '#5a2e8c',
      mound: ['#0c0618', '#1a1030', '#7a4cd8'],
      dust: ['#2c1650', '#7a4cd8', '#ff8a3c'],
      fx: ['#7a4cd8', '#b46aff', '#ff8a3c', '#3c1e62'],
      hit: ['#ffffff', '#d8b8ff', '#ffb06e'],
      death: ['#3c1e62', '#7a4cd8', '#ff8a3c', '#d8b8ff', '#ffffff'],
      noSpine: false, seg: dragonSegRed, head: dragonHeadRed
    },
    matrix: {
      id: 'matrix', name: '数据神龙', warn: '数据神龙 入侵战场！', spike: 'gear', spinRate: 14,
      edge: '#04160e', body: '#0c3026', belly: '#1e6a48', fin: '#35ff9e', finHi: '#a8ffd8',
      scale: '#12483a', horn: '#35e0ff', whisker: '#35ff9e', snout: '#1a8a5c',
      core: '#35ff9e',
      mound: ['#04100c', '#0c3026', '#35ff9e'],
      dust: ['#0c3026', '#35ff9e', '#35e0ff'],
      fx: ['#0c3026', '#35ff9e', '#35e0ff', '#b46aff'],
      hit: ['#ffffff', '#a8ffd8', '#35ff9e'],
      death: ['#0c3026', '#35ff9e', '#35e0ff', '#a8ffd8', '#ffffff'],
      noSpine: false, seg: dragonSegMech, head: dragonHeadMech
    }
  };

  /**
   * 龙系长身怪（草龙及其 6 种地图主题变体）：
   *  - 本体：60 节龙身沿头部历史轨迹跟随（等弧长采样）；头部在天上穿梭，
   *    转向角度随机：有时 90° 直角急转、有时任意角度折线、有时平滑弧线；
   *    定期钻入地下高速穿行（土垄可见），再从他处出土，循环往复。
   *  - 龙身节被击毁：从断裂处分裂出独立小段；小段继续钻地，短暂露出地面
   *    发射主题刺弹（高速直线）。
   *  - themeId：grass 草龙 / sand 沙虫 / black 黑龙 / red 红龙 /
   *    bone 骨蛇 / mech 机器蜈蚣 / sea 深海蓝龙。
   */
  class GrassDragon {
    /** isMini=true 时 seed 为断裂处继承的坐标数组（head→tail 顺序）；themeId 决定地图主题外形 */
    constructor(g, isMini, seed, themeId) {
      const def = CFG.enemies.grassdragon;
      this.th = DRAGON_THEMES[themeId] || DRAGON_THEMES.grass;
      this.type = 'grassdragon';
      this.def = def;
      this.name = this.th.name;
      this.isBoss = false;
      this.dsrc = { k: 'e', key: 'grassdragon' };   // 击杀者归因（含地图主题变体与分裂小段，统一归草龙死法池）
      this.isMini = !!isMini;
      this.dead = false;
      this.groundUnit = true;    // 穿山钻地：触碰山石不坠毁
      this.contactDmg = def.contact;
      this.bulletDmg = def.bulletDmg;
      this.t = rand(0, 10);
      this.animT = rand(0, TAU);
      this.flash = 0;
      this.hurtT = 0;
      this.spawnInvuln = isMini ? 0.8 : 1.8;
      this.dotT = 0; this.dotDps = 0; this.dotType = '';
      this.freezeT = 0;

      const round = g.round;
      const hpMul = (1 + (round - 1) * 0.16 + g.time * 0.0025) * g.diffMul;
      this.speedMul = 1 + (round - 1) * 0.03 + Math.min(0.25, g.time * 0.001);
      this.segR = isMini ? GRASS.miniR : GRASS.segR;
      this.spacing = isMini ? GRASS.miniSpace : GRASS.segSpace;
      const segHp0 = Math.round((isMini ? GRASS.miniHp : GRASS.segHp) * hpMul);

      // 穿梭路线参数
      this.xL = GRASS.xL; this.xR = GRASS.xR;
      this.riseY = rand(160, 300);     // 本次出土的悬停高度
      this.burrowY = CFG.GROUND_Y + rand(22, 40);
      this.ha = -Math.PI / 2;          // 头部航向角
      this.hx = 0; this.hy = -1;       // 头部朝向向量
      this.turnT = 0;                  // 距下次转向
      this.arcT = 0;                   // 弧线转向剩余时间
      this.arcRate = 0;                // 弧线转向角速度（带符号）
      this.targetHa = this.ha;
      this.burrowT = 0;

      if (!isMini) {
        // 本体：从左侧地下钻出（龙身沿地下向画面外左侧排布，如刚从左钻来）
        this.x = this.xL; this.y = this.burrowY;
        this.state = 'rise';
        this.trail = [];
        for (let i = 0; i < GRASS.segCount + 2; i++) {
          this.trail.push({ x: this.xL - i * this.spacing, y: this.burrowY });
        }
      } else {
        // 分裂小段：继承断裂处坐标
        this.x = seed[0].x; this.y = seed[0].y;
        this.state = 'dive';
        this.trail = seed.map(p => ({ x: p.x, y: p.y }));
        this.dir = g.player.x >= this.x ? 1 : -1;
        this.surfCount = 0;
        this.surfX = this.x;
        this.surfY = CFG.GROUND_Y - rand(56, 86);
        this.atkT = 0;
        this.volleys = 0;
        this.surfaceT = 0;
        this.burrowT = rand(1.2, 2.2);
      }

      const n = isMini ? this.trail.length : GRASS.segCount;
      this.segments = [];
      for (let i = 0; i < n; i++) {
        const p = this.trail[Math.min(i, this.trail.length - 1)];
        this.segments.push({ x: p.x, y: p.y, hp: segHp0, maxHp: segHp0, flash: 0, dead: false });
      }
      this.radius = this.segR * 1.7;
      this.maxHp = segHp0 * n;
      this.hp = this.maxHp;
      this.dustT = 0;
      // 视觉首节（龙头）是否已在地面以上：用于检测“破土而出”的上升沿。
      // 分裂小段的断裂点可能本就在空中，初始按实际位置定，避免下钻再出土前被误判为出土
      this.headWasAbove = !!(this.segments[0] && this.segments[0].y < CFG.GROUND_Y);
    }

    /* ---------------- 行为 ---------------- */
    update(dt, g) {
      this.t += dt;
      this.animT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.spawnInvuln = Math.max(0, this.spawnInvuln - dt);
      for (const s of this.segments) s.flash = Math.max(0, s.flash - dt);

      // 元素 DoT（作用于最靠前的活节）
      if (this.dotT > 0) {
        this.dotT -= dt;
        const tick = this.dotDps * dt;
        if (this.spawnInvuln <= 0 && tick > 0) {
          const fa = this.firstAlive();
          if (fa) {
            fa.s.hp -= tick; fa.s.flash = 0.1; this.hurtT = 0.12;
            if (fa.s.hp <= 0) { this.killSegment(fa.i, g); if (this.dead) return; }
          }
        }
      }
      // 冻结：原地静止
      if (this.freezeT > 0) {
        this.freezeT -= dt;
        this.updateSegments();
        return;
      }

      const prevY = this.y;
      if (this.isMini) this.updateMini(dt, g);
      else this.updateMain(dt);

      // 钻地 / 出土跨界特效
      if ((prevY >= CFG.GROUND_Y) !== (this.y >= CFG.GROUND_Y)) {
        if (this.y >= CFG.GROUND_Y) this.burrowInFX(g);
        else this.eruptFX(g);
      }

      this.advanceTrail();
      this.updateSegments();

      // 出场无敌只保护“尚未出土”阶段：视觉龙头（首节）破土而出的瞬间，把剩余免伤截断为
      // 0.35s 的短暂出土保护——露头后龙身立即可被击中。原先固定 1.8s 无敌覆盖整个出土动画，
      // 表现为“龙从地底钻出来时怎么打都不掉血”（地下阶段仍保持无敌，不会被提前消耗）
      {
        const hd0 = this.segments[0];
        const headAbove = !!(hd0 && !hd0.dead && hd0.y < CFG.GROUND_Y);
        if (!this.headWasAbove && headAbove && this.spawnInvuln > 0.35) {
          this.spawnInvuln = 0.35;
        }
        this.headWasAbove = headAbove;
      }

      // 钻地扬尘（地面土垄追踪）
      if (this.y >= CFG.GROUND_Y) {
        this.dustT -= dt;
        if (this.dustT <= 0) {
          this.dustT = 0.05;
          const dc = this.th.dust;
          g.particles.push(new Particle(this.x + rand(-8, 8), CFG.GROUND_Y - 2,
            rand(-60, 60), rand(-130, -40), rand(0.3, 0.6), rand(2, 5),
            dc[randi(0, dc.length - 1)]));
        }
      }

      // 聚合血量
      let hp = 0;
      for (const s of this.segments) if (!s.dead) hp += Math.max(0, s.hp);
      this.hp = hp;
      if (hp <= 0 && !this.dead) this.killAll(g);
    }

    /** 本体：出土上升 → 天上随机穿梭（直角 / 折线 / 弧线）→ 触地钻入 → 地下高速穿行 → 再出土 */
    updateMain(dt, g) {
      const sm = this.speedMul;
      if (this.state === 'rise') {
        // 垂直出土
        this.ha = -Math.PI / 2; this.arcT = 0;
        this.y -= GRASS.vertSpd * sm * dt;
        if (this.y <= this.riseY) {
          this.y = this.riseY;
          this.state = 'air';
          // 出土后朝远离近侧墙的方向水平穿梭
          this.ha = this.x < CFG.W / 2 ? rand(-0.2, 0.2) : Math.PI + rand(-0.2, 0.2);
          this.turnT = rand(0.9, 2.0);
        }
      } else if (this.state === 'air') {
        // 弧线转向：航向朝目标角平滑旋转
        if (this.arcT > 0) {
          const diff = normAng(this.targetHa - this.ha);
          const step = this.arcRate * dt;
          if (Math.abs(diff) <= Math.abs(step)) { this.ha = this.targetHa; this.arcT = 0; }
          else this.ha += step;
        }
        const sp = GRASS.sweepSpd * sm;
        this.x += Math.cos(this.ha) * sp * dt;
        this.y += Math.sin(this.ha) * sp * dt;
        // 左右墙 / 顶部：瞬时反弹（天然折线顶点）
        if (this.x < this.xL && Math.cos(this.ha) < 0) {
          this.x = this.xL; this.ha = Math.PI - this.ha; this.arcT = 0;
        }
        if (this.x > this.xR && Math.cos(this.ha) > 0) {
          this.x = this.xR; this.ha = Math.PI - this.ha; this.arcT = 0;
        }
        if (this.y < 56 && Math.sin(this.ha) < 0) {
          this.y = 56; this.ha = -this.ha; this.arcT = 0;
        }
        this.ha = normAng(this.ha);
        // 触地：钻入地下高速穿行
        if (this.y >= CFG.GROUND_Y - 6) {
          this.y = CFG.GROUND_Y + rand(16, 28);
          this.state = 'burrow';
          this.burrowT = rand(1.8, 3.4);
          this.turnT = rand(0.5, 1.2);
          this.ha = Math.cos(this.ha) >= 0 ? rand(-0.25, 0.25) : Math.PI + rand(-0.25, 0.25);
          this.arcT = 0;
        } else {
          this.turnT -= dt;
          if (this.turnT <= 0) this.pickAirTurn();
        }
      } else if (this.state === 'burrow') {
        if (this.arcT > 0) {
          const diff = normAng(this.targetHa - this.ha);
          const step = this.arcRate * dt;
          if (Math.abs(diff) <= Math.abs(step)) { this.ha = this.targetHa; this.arcT = 0; }
          else this.ha += step;
        }
        const sp = GRASS.burrowSpd * sm;
        this.x += Math.cos(this.ha) * sp * dt;
        this.y += Math.sin(this.ha) * sp * dt;
        // 夹在地下土层中：触上下边界即拉平为水平航向
        const yTop = CFG.GROUND_Y + 14, yBot = CFG.GROUND_Y + 58;
        const flatten = () => {
          this.ha = Math.cos(this.ha) >= 0 ? rand(-0.25, 0.25) : Math.PI + rand(-0.25, 0.25);
          this.arcT = 0;
        };
        if (this.y < yTop) { this.y = yTop; if (Math.sin(this.ha) < 0) flatten(); }
        if (this.y > yBot) { this.y = yBot; if (Math.sin(this.ha) > 0) flatten(); }
        if (this.x < 20 && Math.cos(this.ha) < 0) { this.x = 20; this.ha = rand(-0.3, 0.3); this.arcT = 0; }
        if (this.x > CFG.W - 20 && Math.cos(this.ha) > 0) { this.x = CFG.W - 20; this.ha = Math.PI + rand(-0.3, 0.3); this.arcT = 0; }
        this.turnT -= dt;
        if (this.turnT <= 0) this.pickBurrowTurn();
        this.burrowT -= dt;
        if (this.burrowT <= 0) {
          this.state = 'rise';
          this.riseY = rand(150, 320);
          this.ha = -Math.PI / 2; this.arcT = 0;
        }
      }
      this.hx = Math.cos(this.ha); this.hy = Math.sin(this.ha);
    }

    /** 天上随机转向：40% 弧线 / 30% 直角急转 / 30% 任意角折线 */
    pickAirTurn() {
      const r = Math.random();
      if (r < 0.4) {
        // 弧线：平滑转弯
        let ta = normAng(this.ha + rand(-1.9, 1.9));
        // 贴近地面时避免朝下猛扎
        if (this.y > CFG.GROUND_Y - 200 && Math.sin(ta) > 0.45) {
          ta = rand(-2.6, -0.45);
        }
        this.targetHa = ta;
        const diff = normAng(ta - this.ha);
        this.arcRate = (diff >= 0 ? 1 : -1) * rand(1.1, 2.2);
        this.arcT = Math.abs(diff) / Math.abs(this.arcRate) + 0.05;
      } else if (r < 0.7) {
        // 直角：±90° 瞬时急转
        this.ha = normAng(this.ha + (Math.random() < 0.5 ? -1 : 1) * Math.PI / 2);
        if (this.y > CFG.GROUND_Y - 200 && Math.sin(this.ha) > 0.5) this.ha = -Math.PI / 2 + rand(-0.4, 0.4);
        this.arcT = 0;
      } else {
        // 折线：任意锐角 / 钝角瞬时转向
        this.ha = normAng(this.ha + rand(0.7, 2.4) * (Math.random() < 0.5 ? -1 : 1));
        if (this.y > CFG.GROUND_Y - 200 && Math.sin(this.ha) > 0.5) this.ha = rand(-2.6, -0.5);
        this.arcT = 0;
      }
      this.turnT = rand(1.3, 2.8);
    }

    /** 地下转向：近水平方向的弧线 / 急转 */
    pickBurrowTurn() {
      const base = Math.cos(this.ha) >= 0 ? 0 : Math.PI;
      const dir = Math.random() < 0.35 ? base + Math.PI : base;   // 35% 掉头
      const ta = normAng(dir + rand(-0.5, 0.5));
      if (Math.random() < 0.5) {
        this.targetHa = ta;
        const diff = normAng(ta - this.ha);
        this.arcRate = (diff >= 0 ? 1 : -1) * rand(1.4, 2.4);
        this.arcT = Math.abs(diff) / Math.abs(this.arcRate) + 0.05;
      } else {
        this.ha = ta; this.arcT = 0;
      }
      this.turnT = rand(0.9, 2.0);
    }

    /**
     * 小段循环（不离场）：
     * 下钻 dive → 地下巡游 burrow → 移位到玩家附近 moveX → 出土 rise
     * → 悬停发射龙鳞刺 surface → 飞出空中随机穿梭 air（直角 / 折线 / 弧线）
     * → 触地 dive … 周而复始。
     */
    updateMini(dt, g) {
      const sm = this.speedMul;
      const p = g.player;
      if (this.state === 'dive') {
        this.ha = Math.PI / 2; this.arcT = 0;
        this.y += GRASS.miniVertSpd * sm * dt;
        if (this.y >= this.burrowY) {
          this.y = this.burrowY;
          this.state = 'burrow';
          this.burrowT = rand(1.6, 2.8);
          this.dir = p.x >= this.x ? 1 : -1;
        }
      } else if (this.state === 'burrow') {
        this.ha = this.dir > 0 ? 0 : Math.PI; this.arcT = 0;
        this.x += this.dir * GRASS.miniBurrowSpd * sm * dt;
        if (this.x < 60) { this.x = 60; this.dir = 1; }
        else if (this.x > CFG.W - 60) { this.x = CFG.W - 60; this.dir = -1; }
        this.burrowT -= dt;
        if (this.burrowT <= 0) {
          this.surfX = clamp(p.x + rand(-170, 170), 80, CFG.W - 80);
          this.state = 'moveX';
        }
      } else if (this.state === 'moveX') {
        const d = this.surfX - this.x;
        this.ha = d >= 0 ? 0 : Math.PI; this.arcT = 0;
        const step = GRASS.miniBurrowSpd * sm * dt;
        if (Math.abs(d) <= step) {
          this.x = this.surfX;
          this.surfY = CFG.GROUND_Y - rand(56, 88);
          this.state = 'rise';
        } else this.x += Math.sign(d) * step;
      } else if (this.state === 'rise') {
        this.ha = -Math.PI / 2; this.arcT = 0;
        this.y -= GRASS.miniVertSpd * sm * dt;
        if (this.y <= this.surfY) {
          this.y = this.surfY;
          this.state = 'surface';
          this.surfaceT = 1.5;
          this.volleys = 0;
          this.atkT = 0.3;
          this.surfCount++;
        }
      } else if (this.state === 'surface') {
        this.ha = -Math.PI / 2; this.arcT = 0;
        this.y = this.surfY + Math.sin(this.t * 4) * 4;
        this.atkT -= dt;
        if (this.atkT <= 0 && this.volleys < 2) {
          this.volleys++;
          this.fireSpikes(g);
          this.atkT = 0.7;
        }
        this.surfaceT -= dt;
        if (this.surfaceT <= 0) {
          // 射击完毕：飞出空中穿梭（朝向远离近侧墙的水平方向）
          this.state = 'air';
          this.airT = rand(5, 8);
          this.ha = (this.x < CFG.W / 2 ? 0 : Math.PI) + rand(-0.3, 0.3);
          this.turnT = rand(0.8, 1.6);
          this.arcT = 0;
        }
      } else if (this.state === 'air') {
        // 与本体相同的随机穿梭：弧线平滑转 / 直角急转 / 任意角折线
        if (this.arcT > 0) {
          const diff = normAng(this.targetHa - this.ha);
          const step = this.arcRate * dt;
          if (Math.abs(diff) <= Math.abs(step)) { this.ha = this.targetHa; this.arcT = 0; }
          else this.ha += step;
        }
        const sp = GRASS.sweepSpd * 1.12 * sm;
        this.x += Math.cos(this.ha) * sp * dt;
        this.y += Math.sin(this.ha) * sp * dt;
        if (this.x < this.xL && Math.cos(this.ha) < 0) { this.x = this.xL; this.ha = Math.PI - this.ha; this.arcT = 0; }
        if (this.x > this.xR && Math.cos(this.ha) > 0) { this.x = this.xR; this.ha = Math.PI - this.ha; this.arcT = 0; }
        if (this.y < 56 && Math.sin(this.ha) < 0) { this.y = 56; this.ha = -this.ha; this.arcT = 0; }
        this.ha = normAng(this.ha);
        if (this.y >= CFG.GROUND_Y - 6) {
          // 触地：钻回地下，巡游后再出土射击
          this.y = CFG.GROUND_Y + rand(10, 22);
          this.state = 'dive';
        } else {
          this.turnT -= dt;
          this.airT -= dt;
          if (this.turnT <= 0) this.pickAirTurn();
          // 在空中盘旋过久：压头朝下主动钻地
          if (this.airT <= 0) { this.ha = Math.PI / 2 + rand(-0.25, 0.25); this.arcT = 0; }
        }
      }
      this.hx = Math.cos(this.ha); this.hy = Math.sin(this.ha);
    }

    /** 主题刺弹：高速直线弹（3 发小幅扇形），外形按地图主题区分；仅分裂小段发射，伤害为原值 1/3 */
    fireSpikes(g) {
      const p = g.player;
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      const dmg = Math.max(1, Math.round(this.bulletDmg * g.atkScale / 3));
      for (let i = -1; i <= 1; i++) {
        const a = base + i * 0.15;
        g.bullets.push(new Bullet(this.x - 2, this.y - 6,
          Math.cos(a) * GRASS.spikeSpd, Math.sin(a) * GRASS.spikeSpd,
          { kind: this.th.spike, r: 6, dmg, life: 5, spinRate: this.th.spinRate }));
      }
      SFX.enemyShoot();
    }

    /* ---------------- 轨迹跟随（头部历史队列 + 等弧长采样） ---------------- */
    advanceTrail() {
      this.trail.unshift({ x: this.x, y: this.y });
      const maxArc = (this.segments.length + 1) * this.spacing + 24;
      let acc = 0;
      for (let i = 1; i < this.trail.length; i++) {
        acc += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y);
        if (acc > maxArc) { this.trail.length = i + 1; break; }
      }
    }
    updateSegments() {
      for (let idx = 0; idx < this.segments.length; idx++) {
        const s = this.segments[idx];
        if (s.dead) continue;
        const target = (idx + 1) * this.spacing;
        let acc = 0, px = this.trail[0].x, py = this.trail[0].y;
        for (let i = 1; i < this.trail.length; i++) {
          const a = this.trail[i - 1], b = this.trail[i];
          const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 0.0001;
          if (acc + segLen >= target) {
            const tt = (target - acc) / segLen;
            px = a.x + (b.x - a.x) * tt; py = a.y + (b.y - a.y) * tt;
            break;
          }
          acc += segLen; px = b.x; py = b.y;
        }
        s.x = px; s.y = py;
      }
    }

    /* ---------------- 受击 / 分裂 ---------------- */
    segRAt(i) {
      const n = this.segments.length;
      return this.segR * (1 - 0.38 * (i / Math.max(1, n - 1)));
    }
    /** 露出地面判定：节中心高于地面线一定距离才算可命中/可接触 */
    exposed(s, i) {
      return !s.dead && s.y < CFG.GROUND_Y - this.segRAt(i) * 0.35;
    }
    hitTest(bx, by, br) {
      if (this.spawnInvuln > 0) return -1;
      let best = -1, bestD = Infinity;
      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        if (!this.exposed(s, i)) continue;
        const d = Math.hypot(s.x - bx, s.y - by);
        if (d < br + this.segRAt(i) * 0.95 && d < bestD) { bestD = d; best = i; }
      }
      return best;
    }
    nearestExposed(px, py) {
      let best = null, bestD = Infinity;
      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        if (!this.exposed(s, i)) continue;
        const d = Math.hypot(s.x - px, s.y - py);
        if (d < bestD) { bestD = d; best = { x: s.x, y: s.y, i }; }
      }
      return best;
    }
    touchesPoint(px, py, pr) {
      const ne = this.nearestExposed(px, py);
      return ne ? Math.hypot(ne.x - px, ne.y - py) < pr + this.segRAt(ne.i) * 0.85 : false;
    }
    firstAlive() {
      for (let i = 0; i < this.segments.length; i++) {
        if (!this.segments[i].dead) return { s: this.segments[i], i };
      }
      return null;
    }
    damageSegment(i, dmg, g, kb, element) {
      if (this.dead) return;
      const s = this.segments[i];
      if (!s || s.dead || this.spawnInvuln > 0) return;
      s.hp -= dmg;
      s.flash = 0.12;
      this.hurtT = 0.12;
      // 元素弹命中节：对应元素色火花（火焰橙红/毒液墨绿/寒冰浅蓝）；无元素保留草龙绿色
      if (element && ELEM_HIT_COLS[element]) burst(g, s.x, s.y, element === 'ice' ? 36 : (element === 'flame' ? 26 : 8), ELEM_HIT_COLS[element], element === 'ice' ? 540 : (element === 'flame' ? 260 : 130), element === 'ice' ? 9.4 : (element === 'flame' ? 6.5 : 3), 0.3, element === 'ice' ? 40 : (element === 'flame' ? 85 : 70));
      else burst(g, s.x, s.y, 3, ['#fff', '#bff5d6', '#7ed46d'], 130, 3, 0.2);
      SFX.hit();
      // 元素效果（与小怪一致：DoT / 冻结）
      if (element === 'flame') { this.dotT = 3; this.dotDps = dmg * 0.4; this.dotType = 'flame'; }
      else if (element === 'poison') { this.dotT = 6; this.dotDps = dmg * 0.25; this.dotType = 'poison'; }
      else if (element === 'ice') { this.dotT = 2; this.dotDps = dmg * 0.3; this.dotType = 'ice'; this.freezeT = 4; }
      if (s.hp <= 0) this.killSegment(i, g);
    }
    /** 连锁闪电等：伤害离龙头最近的露出节 */
    takeDamage(dmg, g) {
      if (dmg >= 10000) {
        // 大招强光波：草龙本体完全免疫；分裂小段被削去 50% 血量（每节减半）
        if (!this.isMini) return;
        for (let i = 0; i < this.segments.length; i++) {
          const s = this.segments[i];
          if (s.dead) continue;
          s.hp -= s.maxHp * 0.5;
          s.flash = 0.2;
          burst(g, s.x, s.y, 3, this.th.hit, 140, 3, 0.25);
          if (s.hp <= 0) { this.killSegment(i, g); if (this.dead) return; }
        }
        this.hurtT = 0.2;
        return;
      }
      const ne = this.nearestExposed(this.x, this.y);
      if (ne) this.damageSegment(ne.i, dmg, g, null, '');
    }
    /** 近战 / 刀刃：按指定位置找最近露出节 */
    damageAt(px, py, dmg, g) {
      const ne = this.nearestExposed(px, py);
      if (ne) this.damageSegment(ne.i, dmg, g, null, '');
    }
    /** 爆炸弹范围：波及范围内所有露出节 */
    aoeDamage(x, y, radius, dmg, g) {
      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        if (!this.exposed(s, i)) continue;
        if (Math.hypot(s.x - x, s.y - y) < radius + this.segRAt(i)) {
          this.damageSegment(i, dmg, g, null, '');
        }
      }
    }
    /** 把一组连续活节（索引数组，head→tail）脱离为独立小段 */
    detachMini(idxs, g) {
      if (idxs.length < 2) return false;
      const run = idxs.map(j => ({ x: this.segments[j].x, y: this.segments[j].y }));
      g.enemies.push(new GrassDragon(g, true, run, this.th.id));
      for (const j of idxs) this.segments[j].dead = true;
      return true;
    }
    /** 残节枯萎消散（仅粒子，不成龙） */
    wither(idxs, g) {
      for (const j of idxs) {
        const q = this.segments[j];
        if (q.dead) continue;
        q.dead = true;
        burst(g, q.x, q.y, 6, ['#2fb37c', '#1e6fd0', '#d8ffe8'], 160, 4, 0.4);
      }
    }
    /** 节被毁：断裂处向后的连续活节切块脱离为小段（过长残尾枯萎消散） */
    killSegment(i, g) {
      const s = this.segments[i];
      if (!s || s.dead) return;
      s.dead = true;
      burst(g, s.x, s.y, this.isMini ? 10 : 14,
        this.th.death, 220, 5, 0.5, 120);
      SFX.explode(false);
      g.shake(this.isMini ? 2 : 3);
      g.score += this.isMini ? 2 : 4;
      // 60 节长身：掉宝概率化，避免宝石刷屏
      if (Math.random() < (this.isMini ? 0.3 : 0.32)) {
        g.gems.push(new Gem(s.x, s.y, this.isMini ? 2 : 3));
      }

      // 龙头节被毁：整条解体，残身切成 7-9 节的小块各自化为小段（上限 4 条），余者枯萎
      if (i === 0) {
        let budget = 4, k = 1;
        const n = this.segments.length;
        while (k < n) {
          if (this.segments[k].dead) { k++; continue; }
          const run2 = [];
          let m = k;
          while (m < n && !this.segments[m].dead) { run2.push(m); m++; }
          let p = 0;
          while (p < run2.length) {
            const len = Math.min(run2.length - p, GRASS.miniChunk - 1 + Math.floor(Math.random() * 3));
            const piece = run2.slice(p, p + len);
            if (budget > 0 && this.detachMini(piece, g)) budget--;
            else this.wither(piece, g);
            p += len;
          }
          k = m;
        }
        this.die(g);
        return;
      }

      // 非龙头：断裂处向后的连续活节 → 最前一块化为小段，残尾枯萎
      const runIdx = [];
      for (let j = i + 1; j < this.segments.length; j++) {
        if (this.segments[j].dead) break;
        runIdx.push(j);
      }
      if (runIdx.length >= (this.isMini ? 4 : 2)) {
        const cap = this.isMini ? 6 : GRASS.miniChunk;
        this.detachMini(runIdx.slice(0, cap), g);
        this.wither(runIdx.slice(cap), g);
      } else {
        this.wither(runIdx, g);
      }
    }
    killAll(g) {
      if (this.dead) return;
      for (const s of this.segments) {
        if (s.dead) continue;
        s.dead = true;
        burst(g, s.x, s.y, 8, this.deathColors(), 200, 5, 0.5);
      }
      this.die(g);
    }
    die(g) {
      if (this.dead) return;
      this.dead = true;
      g.kills++;
      g.score += this.isMini ? 20 : 80;
      if (window.Ach) window.Ach.evt('enemyDie', { g: g, e: this });
      g.addRage(this.isMini ? CFG.ultimate.rageNormal : CFG.ultimate.rageElite);
      burst(g, this.x, this.y, this.isMini ? 20 : 34, this.deathColors(), 280, 6, 0.7, 140);
      SFX.explode(false);
      g.shake(this.isMini ? 3 : 6);
      const drops = this.isMini ? 2 : 8;
      for (let i = 0; i < drops; i++) {
        g.gems.push(new Gem(this.x + rand(-30, 30), this.y + rand(-30, 30), this.isMini ? 2 : 3));
      }
    }
    deathColors() { return this.th.death; }

    /* ---------------- 特效 ---------------- */
    eruptFX(g) {
      burst(g, this.x, CFG.GROUND_Y, 26, this.th.fx, 300, 6, 0.7, 160);
      SFX.explode(false);
      g.shake(this.isMini ? 4 : 6);
    }
    burrowInFX(g) {
      burst(g, this.x, CFG.GROUND_Y, 14, this.th.fx, 220, 5, 0.5, 120);
      g.shake(2);
    }

    /* ---------------- 渲染 ---------------- */
    render(ctx) {
      const t = this.animT;
      const segs = this.segments;
      const GY = CFG.GROUND_Y;

      const th = this.th;
      // 1) 钻地段：地面隆起的土垄（龙身在地下的投影），颜色按地图主题
      for (let i = segs.length - 1; i >= 0; i--) {
        const s = segs[i];
        if (s.dead || s.y < GY - 2) continue;
        const r = this.segRAt(i) * 1.15 + Math.sin(t * 12 + i) * 1.5;
        ctx.fillStyle = th.mound[0];
        ctx.beginPath(); ctx.arc(s.x, GY + 3, r, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = th.mound[1];
        ctx.beginPath(); ctx.arc(s.x, GY + 3, r * 0.78, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = th.mound[2];
        ctx.beginPath(); ctx.arc(s.x, GY + 2, r * 0.55, Math.PI * 1.12, Math.PI * 1.88); ctx.fill();
      }

      // 2) 露出地面的龙身（裁剪到地面线以上，下钻部分自然没入土中）
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, CFG.W, GY + 2); ctx.clip();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // 连接脊线：边 → 身 → 腹（骨蛇节间断开，不画脊线）
      if (!th.noSpine) {
        const spineCols = [th.edge, th.body, th.belly];
        const spineW = [2.05, 1.5, 0.6];
        for (let pass = 0; pass < 3; pass++) {
          for (let i = segs.length - 1; i >= 1; i--) {
            const a = segs[i], b = segs[i - 1];
            if (a.dead || b.dead) continue;
            if (a.y >= GY || b.y >= GY) continue;
            const r = this.segRAt(i);
            ctx.strokeStyle = spineCols[pass];
            ctx.lineWidth = r * spineW[pass];
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      // 龙身节（尾 → 头）
      for (let i = segs.length - 1; i >= 1; i--) {
        const s = segs[i];
        if (s.dead || s.y >= GY) continue;
        this.drawSeg(ctx, s, i, t);
      }
      // 龙头
      const head = segs[0];
      if (!head.dead && head.y < GY) this.drawHead(ctx, head, t);

      // 持续受伤红染
      if (this.hurtT > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,40,40,0.30)';
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          if (s.dead || s.y >= GY) continue;
          ctx.beginPath(); ctx.arc(s.x, s.y, this.segRAt(i) * 1.25, 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      // 冻结覆盖
      if (this.freezeT > 0) {
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          if (s.dead || s.y >= GY) continue;
          ctx.fillStyle = 'rgba(120,200,255,0.45)';
          ctx.beginPath(); ctx.arc(s.x, s.y, this.segRAt(i) * 1.2, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(180,230,255,0.8)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(s.x, s.y, this.segRAt(i) * 1.2, 0, TAU); ctx.stroke();
        }
      }
      ctx.restore();

      // 3) 出场无敌金环
      if (this.spawnInvuln > 0 && !head.dead) {
        const rr = this.segR * 2 + 6 + Math.sin(t * 12) * 3;
        ctx.strokeStyle = `rgba(255,210,59,${0.45 + Math.sin(t * 12) * 0.3})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(head.x, head.y, rr, 0, TAU); ctx.stroke();
      }
      // 4) 血条（本体）
      if (!this.isMini && !head.dead && this.hp < this.maxHp) {
        const w = this.segR * 3.4;
        const by = head.y - this.segR * 2.8 - 12;
        ctx.fillStyle = '#000'; ctx.fillRect(head.x - w / 2 - 1, by, w + 2, 6);
        ctx.fillStyle = '#52e08a';
        ctx.fillRect(head.x - w / 2, by + 1, w * clamp(this.hp / this.maxHp, 0, 1), 4);
      }
    }

    /** 龙身节绘制：委托当前地图主题（外形各异：鳞甲 / 沙岩甲壳 / 脊椎骨 / 机械舱 / 鱼鳞…） */
    drawSeg(ctx, s, i, t) {
      this.th.seg(ctx, this, s, i, t, this.th);
      // 受击闪白
      if (s.flash > 0) {
        const r = this.segRAt(i);
        ctx.fillStyle = `rgba(255,255,255,${clamp(s.flash * 6, 0, 0.8)})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, r + 2, 0, TAU); ctx.fill();
      }
    }

    /** 龙头绘制：委托当前地图主题（已平移旋转至头部航向） */
    drawHead(ctx, h, t) {
      const r = this.segR * 1.15;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(Math.atan2(this.hy, this.hx));
      this.th.head(ctx, this, h, t, this.th);
      ctx.restore();
      // 受击闪白
      if (h.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${clamp(h.flash * 6, 0, 0.8)})`;
        ctx.beginPath(); ctx.arc(h.x, h.y, r + 2, 0, TAU); ctx.fill();
      }
    }
  }

  /** drawSeg 尾鳍取前一节（安全访问） */
  function segs_safe(dragon, i) {
    if (i < 0 || i >= dragon.segments.length) return null;
    const s = dragon.segments[i];
    return s.dead ? null : s;
  }

  /**
   * 骨龙王分裂小段（单节脱离）：detach → float → approach → attack → reposition
   * 空中缓慢漂浮接近玩家，达安全距离停驻，连射 2 发绿火，随后横移/后退重寻距离。
   */
  class BoneDragonMini {
    constructor(g, x, y, opts) {
      opts = opts || {};
      this.type = 'bonedragonmini';
      this.isBoss = false;
      this.dsrc = { k: 'b', key: 'bonedragonking' };   // 击杀者归因：崩解骨龙群/小骨蛇统一归骨龙王死法池
      this.dead = false;
      this.groundUnit = false;
      this.pack = !!opts.pack;              // 骨龙组：3 节合体的强化小段
      this.spawnInvuln = 0.6;
      this.flash = 0; this.hurtT = 0;
      this.t = rand(0, 10); this.animT = rand(0, TAU);
      this.dotT = 0; this.dotDps = 0; this.dotType = '';
      this.freezeT = 0;             // 骨龙免疫冰冻（恒为 0）
      this.hitShake = 0;            // 受击左右摇晃计时
      const hpMul = 1 + (g.round - 1) * 0.16 + g.time * 0.0025;
      const baseHp = Math.round(40 * hpMul);
      this.maxHp = opts.hp || baseHp;       // 骨龙组血量 = 3 节血量之和
      this.hp = this.maxHp;
      const sc = opts.scale || 1;
      this.radius = Math.round(16 * sc);    // 骨龙组体型更大
      this.contactDmg = this.pack ? 16 : 12;
      this.bulletDmg = this.pack ? 12 : 10;
      this.xpValue = this.pack ? 5 : 2;
      this.x = x; this.y = y;
      this.vx = rand(-30, 30); this.vy = rand(-20, 20);
      this.state = 'float';
      this.stateT = 0;
      this.safeDist = rand(110, 160);
      this.atkT = 0;
      this.volleys = 0;
    }
    update(dt, g) {
      this.t += dt; this.animT += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.spawnInvuln = Math.max(0, this.spawnInvuln - dt);
      this.freezeT = 0;            // 骨龙免疫冰冻（覆盖冰弹/声波）
      this.hitShake = Math.max(0, this.hitShake - dt);
      // 元素 DoT
      if (this.dotT > 0) {
        this.dotT -= dt;
        if (this.spawnInvuln <= 0 && this.dotDps > 0) {
          this.hp -= this.dotDps * dt; this.flash = 0.1; this.hurtT = 0.12;
          if (this.hp <= 0) { this.die(g); return; }
        }
      }
      const p = g.player;
      // 入场阶段：从屏幕外移入，接近中线目标点后才开始正常行为
      if (this.entering && this.enterTarget) {
        const tx = this.enterTarget.x, ty = this.enterTarget.y;
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const spd = 260;
        this.x += (dx / d) * spd * dt;
        this.y += (dy / d) * spd * dt;
        if (d < 30) this.entering = false;   // 到位，结束入场
        return;   // 入场期间不射击、不远离
      }
      const dx = this.x - p.x, dy = this.y - p.y;   // 方向：从玩家指向自己（远离）
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      const safeDist = 220;   // 保持距离
      const spd = 95;
      // 距离 < safeDist → 远离；距离 ≥ safeDist → 悬停微动
      if (d < safeDist) {
        this.x += nx * spd * dt;
        this.y += ny * spd * dt;
      } else {
        // 悬停时小幅漂浮，不会飞出屏幕
        this.x += Math.sin(this.t * 2.5) * 16 * dt;
        this.y += Math.cos(this.t * 2.1) * 12 * dt;
      }
      // 持续朝角色射击（每 0.7s 一轮 2 发绿火）
      this.atkT = (this.atkT || 0) - dt;
      if (this.atkT <= 0) {
        this.atkT = 0.7;
        const base = Math.atan2(p.y - this.y, p.x - this.x);
        for (let i = 0; i < 2; i++) {
          const a = base + (i - 0.5) * 0.16;
          g.bullets.push(new Bullet(this.x, this.y,
            Math.cos(a) * 320, Math.sin(a) * 320,
            { kind: 'greenfire', r: 7, dmg: this.bulletDmg * g.atkScale, life: 4 }));
        }
        SFX.enemyShoot();
      }
      // 边界钳制（不会到屏幕外面）
      this.x = clamp(this.x, 30, CFG.W - 30);
      this.y = clamp(this.y, 60, CFG.GROUND_Y - 40);
    }
    takeDamage(dmg, g, kb) {
      if (this.dead || this.spawnInvuln > 0) return;
      this.hp -= dmg; this.flash = 0.1; this.hurtT = 0.12;
      this.hitShake = 0.22;            // 受击左右摇晃 0.22s
      if (kb) { this.x += kb.x * 0.02; this.y += kb.y * 0.02; }
      // 幽绿冥火受击特效
      burst(g, this.x, this.y, 8, ['#fff', '#bbf7d0', '#4ade80', '#166534'], 150, 4, 0.22, 80);
      SFX.hit();
      if (this.hp <= 0) this.die(g);
    }
    die(g) {
      if (this.dead) return;
      this.dead = true;
      g.kills++; g.score += this.pack ? 40 : 15;
      if (window.Ach) window.Ach.evt('enemyDie', { g: g, e: this });
      g.addRage(CFG.ultimate.rageNormal);
      burst(g, this.x, this.y, this.pack ? 22 : 14, ['#d8d3c2', '#4ade80', '#e8e4d8', '#fff'], 220, 5, 0.5);
      SFX.explode(false); g.shake(this.pack ? 4 : 2);
      const gemN = this.pack ? 3 : (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < gemN; i++) g.gems.push(new Gem(this.x + rand(-24, 24), this.y + rand(-24, 24), 2));
    }
    render(ctx) {
      // 受击左右摇晃偏移
      const shake = this.hitShake > 0 ? Math.sin(this.t * 60) * 5 * (this.hitShake / 0.22) : 0;
      const r = this.radius;
      // 骨节：边→椎骨→髓腔+肋骨
      ctx.fillStyle = '#8f8a78';
      ctx.beginPath(); ctx.arc(this.x + shake, this.y, r + 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8d3c2';
      ctx.beginPath(); ctx.arc(this.x + shake, this.y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b5ae9a';
      ctx.beginPath(); ctx.arc(this.x + shake, this.y, r * 0.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b5ae9a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x + shake - r * 0.28, this.y - r * 0.15); ctx.lineTo(this.x + shake - r * 0.9, this.y + r * 0.5);
      ctx.moveTo(this.x + shake + r * 0.28, this.y - r * 0.15); ctx.lineTo(this.x + shake + r * 0.9, this.y + r * 0.5);
      ctx.stroke();
      // 脊刺
      ctx.fillStyle = '#c8c2ae';
      ctx.beginPath();
      ctx.moveTo(this.x + shake - 3, this.y - r * 0.72); ctx.lineTo(this.x + shake + 3, this.y - r * 0.72); ctx.lineTo(this.x + shake, this.y - r - 6);
      ctx.closePath(); ctx.fill();
      // 受击红染
      if (this.hurtT > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(255,40,40,${clamp(this.hurtT / 0.12, 0, 1) * 0.5})`;
        ctx.beginPath(); ctx.arc(this.x + shake, this.y, r + 2, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  window.FT = { Particle, Gem, Bullet, Lightning, Beam, CurveBeam, Player, Enemy, Rock, Breakable, GrassDragon, BoneDragonMini, DRAGON_THEMES, burst, drawSprite, drawSpriteTinted, rand, randi, clamp, dist,
    /* 元素异常视觉（小怪/Boss 共用） */
    elemHitFx, elemMarksTick, elemAmbient, elemDeathFx, renderElemMarks,
    /* 击杀者归因：敌人/Boss 更新期间发射的弹丸/闪电/光束自动绑定来源 */
    setShooter(e) { curShooter = e; },
    clearShooter() { curShooter = null; }
  };
})();
