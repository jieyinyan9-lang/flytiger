/* ============================================================
 * entities.js —— 玩家 / 子弹 / 敌人 / 粒子 / 宝石 / 闪电
 * ============================================================ */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
      // 落地面：草原地面 / 山石顶部（homed 能量不受地形影响，直飞玩家）
      if (!this.homed) {
        let floorY = CFG.GROUND_Y - 8;
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

  class Bullet {
    /** kind: bolt / orb / shuriken / feather / whirl / flame / fireball / katana / spark */
    constructor(x, y, vx, vy, opts) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.kind = opts.kind || 'orb';
      this.friendly = !!opts.friendly;
      this.dmg = opts.dmg || 10;
      this.r = opts.r || 5;
      this.life = opts.life || 6;
      this.dead = false;
      this.t = 0;
      this.pierce = opts.pierce || 0;
      this.hitSet = null;
      this.bombLv = opts.bombLv || 0;
      this.tier = opts.tier || 0;
      this.dmgScale = opts.dmgScale || 1;   // 敌人子弹伤害系数（Boss成长）
      this.grav = opts.grav || 0;           // 重力（抛射弹道）
      this.spin = rand(0, TAU);
      this.onExpire = opts.onExpire || null;
      this.trail = 0;
      this.neutralized = false;   // Boss 死亡后弹幕失效
      this.fade = 1;             // 失效后逐渐淡出
    }
    /** Boss 死亡：弹幕无效化，减速并逐渐消失 */
    neutralize() {
      if (this.neutralized) return;
      this.neutralized = true;
      this.onExpire = null;      // 火球等不再触发爆炸
    }
    update(dt, g) {
      this.t += dt; this.life -= dt;
      this.spin += dt * 9;
      if (this.neutralized) {
        this.fade = Math.max(0, this.fade - dt * 1.15);
        this.vx *= (1 - dt * 2.2); this.vy *= (1 - dt * 2.2);
        if (this.fade <= 0) { this.dead = true; return; }
      }
      if (this.grav) { this.vy += this.grav * dt; }
      if (this.kind === 'arrow') {
        this.vy += 520 * dt;              // 抛射：重力
        this.angle = Math.atan2(this.vy, this.vx);
        if (this.y > CFG.GROUND_Y - 4) { this.dead = true; burst(g, this.x, CFG.GROUND_Y - 6, 4, ['#8a5a2b', '#6b4a2a'], 90, 3, 0.3); }
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
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.life <= 0) {
        if (this.onExpire) this.onExpire(g, this);
        this.dead = true;
      }
      if (this.x < -80 || this.x > CFG.W + 80 || this.y < -80 || this.y > CFG.H + 80) {
        if (this.onExpire && this.kind === 'fireball') this.onExpire(g, this);
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
    _renderBody(ctx) {
      const k = this.kind;
      if (k === 'bolt' || k.startsWith('bolt')) {
        const st = BULLET_STYLE['bolt' + this.tier] || BULLET_STYLE.bolt0;
        const a = Math.atan2(this.vy, this.vx);
        ctx.save();
        ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.fillStyle = st.edge;
        ctx.fillRect(-st.len / 2 - 2, -st.r * 0.7, st.len + 4, st.r * 1.4);
        ctx.fillStyle = st.color;
        ctx.fillRect(-st.len / 2, -st.r * 0.45, st.len, st.r * 0.9);
        ctx.fillStyle = '#fff';
        ctx.fillRect(st.len / 2 - 4, -st.r * 0.25, 4, st.r * 0.5);
        ctx.restore();
        return;
      }
      if (k === 'orb' || k === 'spark') {
        const c = k === 'spark' ? '#c77dff' : this.color || '#ff6b6b';
        ctx.fillStyle = '#000'; ctx.fillRect(this.x - this.r - 1, this.y - this.r - 1, (this.r + 1) * 2, (this.r + 1) * 2);
        ctx.fillStyle = c;
        ctx.fillRect(this.x - this.r, this.y - this.r, this.r * 2, this.r * 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x - this.r * 0.4, this.y - this.r * 0.4, this.r * 0.5, this.r * 0.5);
        return;
      }
      if (k === 'shuriken') {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin);
        ctx.fillStyle = '#cfd8e3';
        ctx.fillRect(-2, -9, 4, 18); ctx.fillRect(-9, -2, 18, 4);
        ctx.fillStyle = '#5a6678';
        ctx.fillRect(-2, -7, 4, 3); ctx.fillRect(-2, 4, 4, 3);
        ctx.fillRect(-7, -2, 3, 4); ctx.fillRect(4, -2, 3, 4);
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
        // 红色羽斑（咬剑鹰标识色）
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
        // 三道旋转风刃：黑边 + 青芯，明亮天空下依然醒目
        for (let i = 0; i < 3; i++) {
          const a0 = this.spin + (i * TAU / 3);
          ctx.strokeStyle = '#0e2430';
          ctx.lineWidth = 7;
          ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + 1.55); ctx.stroke();
          ctx.strokeStyle = '#35d4ff';
          ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + 1.55); ctx.stroke();
        }
        // 中心核：黑边亮芯
        ctx.fillStyle = '#0e2430';
        ctx.fillRect(-5, -5, 10, 10);
        ctx.fillStyle = '#bff4ff';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.fillStyle = '#ffffff';
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
    }
  }

  /* ---------------- 闪电（预警 → 打击） ---------------- */
  class Lightning {
    /** x: 柱中心, w: 柱宽 */
    constructor(x, w, dmg) {
      this.x = x; this.w = w; this.dmg = dmg;
      this.t = 0; this.warn = 0.95; this.strike = 0.3;
      this.dealt = false; this.dead = false;
      this.bolt = this.makeBolt();
    }
    makeBolt() {
      const pts = [];
      let y = -10;
      let x = this.x + rand(-6, 6);
      while (y < CFG.GROUND_Y) {
        pts.push({ x, y });
        y += rand(18, 34);
        x = this.x + rand(-this.w / 2, this.w / 2);
      }
      return pts;
    }
    update(dt, g) {
      this.t += dt;
      if (this.t >= this.warn && !this.dealt) {
        this.dealt = true;
        SFX.shock();
        g.shake(10);
        burst(g, this.x + rand(-this.w / 2, this.w / 2), CFG.GROUND_Y - 40, 18,
          ['#ffe066', '#fff', '#7fe7ff'], 260, 5, 0.5, 200);
        const p = g.player;
        if (Math.abs(p.x - this.x) < this.w / 2 + p.radius * 0.6 && p.y < CFG.GROUND_Y) {
          p.hurt(this.dmg, g);
        }
      }
      if (this.t > this.warn + this.strike) this.dead = true;
    }
    render(ctx) {
      if (this.t < this.warn) {
        // 预警柱（闪烁虚线）
        const on = Math.floor(this.t * 14) % 2 === 0;
        if (on) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#ffe066';
          ctx.fillRect(this.x - this.w / 2, 0, this.w, CFG.GROUND_Y);
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = '#fff';
          for (let y = 0; y < CFG.GROUND_Y; y += 28) {
            ctx.fillRect(this.x - this.w / 2, y, 4, 12);
            ctx.fillRect(this.x + this.w / 2 - 4, y + 14, 4, 12);
          }
          ctx.globalAlpha = 1;
        }
      } else {
        // 闪电本体
        const a = clamp(1 - (this.t - this.warn) / this.strike, 0, 1);
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = this.w * 0.5;
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        this.bolt.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke();
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = this.w * 0.22;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ---------------- 玩家：飞虎 ---------------- */
  class Player {
    constructor() {
      this.x = 160; this.y = CFG.H / 2;
      this.vx = 0; this.vy = 0;
      this.radius = CFG.player.radius;
      this.maxHp = CFG.player.baseHp;
      this.hp = this.maxHp;
      this.dmg = CFG.player.baseDmg;
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
      // 大招（怒气）
      this.rage = 0;
      // 额外弹道解锁
      this.tailWay = false;   // 尾部向后弹道
      this.downWay = false;   // 下部向下弹道
      // 闪电子弹（闪电链）
      this.chainJumps = 0;    // 链接敌人数量（0=未解锁）
      this.chainDmgLv = 0;    // 闪电伤害强化等级
      // 防护刀刃（环绕光剑）
      this.blades = 0;        // 环绕光剑数量
      this.bladeDmgLv = 0;    // 刀刃伤害强化等级
      this.bladeAng = 0;      // 环绕角速度累计
      this.bladeCd = new Map();  // 刀刃命中敌人的冷却（键：敌人对象）
      // 受伤闪红
      this.hurtFlash = 0;
    }

    /** 刀刃 i 当前位置/角度（沿轨道环绕飞虎） */
    bladePos(i) {
      const R = CFG.blade.orbitR * (0.9 + this.sizeMul * 0.15);
      const a = this.bladeAng + (TAU / this.blades) * i;
      return { x: this.x + Math.cos(a) * R, y: this.y + Math.sin(a) * R, a };
    }

    /** 防护刀刃：旋转伤害接触敌人 + 50% 概率格挡敌方子弹 */
    updateBlades(dt, g) {
      if (this.blades <= 0) return;
      this.bladeAng += CFG.blade.spin * dt;
      const dmg = CFG.blade.baseDmg + CFG.blade.dmgPerLv * (this.bladeDmgLv - 1);
      // 接触敌人造成伤害（每敌 0.5s 一次）
      g.targets().forEach(e => {
        if (e.dead) return;
        if (e.isBoss && e.state === 'enter') return;   // Boss 入场免伤
        for (let i = 0; i < this.blades; i++) {
          const bp = this.bladePos(i);
          const rr = CFG.blade.hitR + e.radius;
          if ((e.x - bp.x) ** 2 + (e.y - bp.y) ** 2 < rr * rr) {
            const now = g.time;
            if (now - (this.bladeCd.get(e) ?? -1) > 0.5) {
              this.bladeCd.set(e, now);
              e.takeDamage(dmg, g, { x: Math.cos(bp.a) * 150, y: Math.sin(bp.a) * 150 });
              burst(g, bp.x, bp.y, 5, ['#7fe7ff', '#fff'], 160, 3, 0.25);
            }
            break;
          }
        }
      });
      // 格挡敌方子弹：单颗子弹仅判定一次
      for (const b of g.bullets) {
        if (b.friendly || b.dead || b.neutralized || b.bladeRolled) continue;
        for (let i = 0; i < this.blades; i++) {
          const bp = this.bladePos(i);
          const rr = CFG.blade.blockR + b.r;
          if ((b.x - bp.x) ** 2 + (b.y - bp.y) ** 2 < rr * rr) {
            b.bladeRolled = true;
            if (Math.random() < CFG.blade.blockChance) {
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
      // 立即判定一次：前方扇形
      const targets = g.targets();
      targets.forEach(e => {
        const dx = e.x - this.x, dy = e.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d < range + e.radius) {
          this.meleeHit.add(e);
          e.takeDamage(CFG.player.meleeDmg + this.dmg * 0.4, g,
            { x: (dx / (d || 1)) * 320, y: (dy / (d || 1)) * 320 });
          burst(g, e.x, e.y, 6, ['#fff', '#ffd93b', '#f7941d'], 160, 4, 0.3);
        }
      });
    }

    hurt(amount, g) {
      if (this.invT > 0) return;
      this.hp -= amount;
      this.invT = CFG.player.invincibleTime;
      this.hurtFlash = 0.4;
      SFX.hurt();
      g.shake(8);
      burst(g, this.x, this.y, 10, ['#ff5252', '#fff'], 180, 4, 0.4);
      if (this.hp <= 0) { this.hp = 0; g.gameOver(); }
    }

    update(dt, g) {
      // 计时
      this.wingT += dt;
      this.invT = Math.max(0, this.invT - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      if (this.meleeT > 0) this.meleeT -= dt;
      if (this.cdT > 0) {
        this.cdT -= dt;
        if (this.cdT <= 0 && this.meleeT <= 0) this.cdT = 0;
      }
      if (this.meleeT <= 0 && this.wasMeleeing) { this.cdT = CFG.player.meleeCooldown; this.wasMeleeing = false; }
      if (this.meleeT > 0) this.wasMeleeing = true;

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
      const spd = CFG.player.speed * (1 + (this.sizeMul - 1) * 0.08);
      this.vx = mx * spd; this.vy = my * spd;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.radius = CFG.player.radius * (0.75 + this.sizeMul * 0.25);
      this.x = clamp(this.x, 40, CFG.W - 60);
      this.y = clamp(this.y, CFG.TOP_Y, CFG.GROUND_Y - this.radius * 0.5);
      this.faceTilt += (clamp(this.vy / 900, -0.25, 0.25) - this.faceTilt) * Math.min(1, dt * 10);

      // 地面危险区：贴地持续灼伤
      this.groundTick = (this.groundTick || 0) + dt;
      if (this.y + this.radius * 0.72 >= CFG.GROUND_Y - 4) {
        if (this.groundTick >= 0.4) {
          this.groundTick = 0;
          this.hp -= 8;
          this.invT = 0.3;
          this.hurtFlash = 0.3;
          g.shake(4);
          burst(g, this.x + rand(-20, 20), CFG.GROUND_Y - 4, 5, ['#67bd57', '#ff7b2e', '#4f9e44'], 120, 4, 0.4, 200);
          if (this.hp <= 0) { this.hp = 0; g.gameOver(); }
        }
      } else this.groundTick = 0;

      // 尾部喷射火焰
      this.flameT = (this.flameT || 0) - dt;
      if (this.flameT <= 0) {
        this.flameT = 0.04;
        const s = this.sizeMul;
        g.particles.push(new Particle(
          this.x - 40 * s, this.y + 6 * s + rand(-6, 6),
          rand(-260, -140), rand(-60, 60),
          rand(0.18, 0.38), rand(3, 6) * s,
          Math.random() < 0.3 ? '#ffe066' : (Math.random() < 0.55 ? '#ff7b2e' : '#e53935')));
      }

      // 自动射击（近战期间停火）
      if (!this.isMeleeing) {
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = CFG.player.fireInterval;
          this.fire(g);
        }
      }

      // 防护刀刃：环绕光剑旋转伤害 + 格挡子弹
      this.updateBlades(dt, g);

      // 接触检测 → 自动近战 / 受伤
      g.targets().forEach(e => {
        const d = dist(this, e);
        if (d < this.radius + e.radius * 0.85) {
          if (this.meleeReady) {
            this.startMelee(g);
          } else if (!this.isMeleeing && this.invT <= 0) {
            this.hurt(e.contactDmg * g.atkScale, g);
            const a = Math.atan2(this.y - e.y, this.x - e.x);
            this.x += Math.cos(a) * 22; this.y += Math.sin(a) * 22;
          }
        }
      });
    }

    fire(g) {
      const n = this.bulletCount;
      const speed = CFG.player.bulletSpeed * this.bulletSpeedMul;
      const dmg = this.dmg;
      const muzzleX = this.x + 44 * this.sizeMul;
      const muzzleY = this.y - 2;
      const bscale = 1 + (this.sizeMul - 1) * 0.3;
      const pierce = this.bulletTier >= 2 ? (this.bulletTier === 3 ? 4 : 2) : 0;
      const angles = [];
      if (n === 1) angles.push(0);
      else if (n === 2) angles.push(-0.06, 0.06);
      else {
        const spread = Math.min(0.9, (n - 1) * 0.09);
        for (let i = 0; i < n; i++) angles.push(-spread / 2 + (spread / (n - 1)) * i);
      }
      angles.forEach((an, i) => {
        const offY = (n === 2) ? (i === 0 ? -9 : 9) : (n % 2 === 0 ? (i - n / 2 + 0.5) * 8 : (i - (n - 1) / 2) * 8);
        g.bullets.push(new Bullet(
          muzzleX, muzzleY + offY,
          Math.cos(an) * speed, Math.sin(an) * speed,
          {
            kind: 'bolt', friendly: true, dmg,
            r: (4 + this.bulletTier * 2) * bscale,
            pierce, bombLv: this.bombLv, tier: this.bulletTier
          }));
      });
      // 尾部弹道：向后射击
      if (this.tailWay) {
        g.bullets.push(new Bullet(
          this.x - 44 * this.sizeMul, muzzleY,
          -speed * 0.95, 0,
          {
            kind: 'bolt', friendly: true, dmg,
            r: (4 + this.bulletTier * 2) * bscale,
            pierce, bombLv: this.bombLv, tier: this.bulletTier
          }));
      }
      // 下部弹道：向下射击
      if (this.downWay) {
        g.bullets.push(new Bullet(
          this.x + 8 * this.sizeMul, this.y + 26 * this.sizeMul,
          0, speed * 0.9,
          {
            kind: 'bolt', friendly: true, dmg,
            r: (4 + this.bulletTier * 2) * bscale,
            pierce, bombLv: this.bombLv, tier: this.bulletTier
          }));
      }
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
      // 白猫主角：直接绘制原图（与素材 100% 一致），原图面朝右
      const cat = Sprites.cat;
      if (cat) {
        const targetLen = 92 * this.sizeMul;
        const s = targetLen / cat.width;
        const w = cat.width * s, h = cat.height * s;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.faceTilt);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cat, -w / 2, -h / 2, w, h);
        ctx.restore();
        // 受伤闪红：红色染色叠加
        if (this.hurtFlash > 0) {
          const fa = clamp(this.hurtFlash / 0.4, 0, 1);
          drawSpriteTinted(ctx, cat, this.x, this.y, w, h, this.faceTilt, '#ff1a1a', fa * 0.82);
        }
      }
      ctx.globalAlpha = 1;

      // 近战爪痕：三道爪印自上而下列过前方
      if (this.isMeleeing) {
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

      // 防护刀刃：青色光剑沿轨道环绕（刀刃沿切线方向）
      if (this.blades > 0) {
        for (let i = 0; i < this.blades; i++) {
          const bp = this.bladePos(i);
          ctx.save();
          ctx.translate(bp.x, bp.y);
          ctx.rotate(bp.a + Math.PI / 2);
          const L = 17 + Math.min(this.blades, 6) * 1.2;   // 光剑长度随数量略增
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
      this.dead = false;
      this.radius = def.radius;
      this.contactDmg = def.contact;
      this.bulletDmg = def.bulletDmg || 0;
      this.t = rand(0, 10);
      this.flash = 0;
      this.kbX = 0; this.kbY = 0;

      // 难度缩放
      const round = g.round;
      const hpMul = (1 + (round - 1) * 0.16 + g.time * 0.0025) * g.diffMul;
      this.maxHp = Math.round(def.hp * hpMul);
      this.hp = this.maxHp;
      this.speedMul = 1 + (round - 1) * 0.03 + Math.min(0.25, g.time * 0.001);

      this.x = CFG.W + 50;
      this.y = rand(CFG.TOP_Y + 40, CFG.GROUND_Y - 60);
      this.state = 'enter';
      this.stateT = 0;
      this.atkT = rand(1.2, 2.6);
      this.hoverX = 0; this.hoverY = 0; this.baseY = this.y;
      this.animT = rand(0, TAU);

      // 小弓箭手：地面行走 → 停 3-5 次射箭 → 一直向左奔跑
      if (type === 'archer') {
        this.y = CFG.GROUND_Y - 22;
        this.baseY = this.y;
        this.state = 'walk';
        this.archT = rand(1.8, 3.0);   // 独立倒数计时（stateT 在基类中为累加）
        this.stops = 0;
        this.stopsTotal = randi(3, 5);
        this.atkT = 0.5;
      }

      // 自爆骷髅：高速冲入屏幕中部 → 降速持续追击玩家 → 接触自爆
      if (type === 'skeleton') {
        this.state = 'rush';
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
        p.hurt(dmg, g);
      }
    }

    takeDamage(dmg, g, kb) {
      if (this.dead) return;
      this.hp -= dmg;
      this.flash = 0.08;
      if (kb) { this.kbX += kb.x; this.kbY += kb.y; }
      burst(g, this.x - 10, this.y, 2, ['#fff', '#ffe08a'], 120, 3, 0.18);
      SFX.hit();
      if (this.hp <= 0) this.die(g);
    }

    die(g) {
      this.dead = true;
      g.kills++;
      g.score += this.def.score;
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
    }
    deathColors() {
      return {
        eagle: ['#8a5a2b', '#f4f1e8', '#ffc02e'],
        bat: ['#4a3566', '#2b1f3d', '#ff5d73'],
        demon: ['#7a3fc9', '#e0453a', '#fff'],
        leigong: ['#2f6fd0', '#ffd23b', '#fff'],
        pig: ['#f4726b', '#ff7b2e', '#ffd23b'],
        skeleton: ['#e8eef7', '#9aa7bb', '#e0453a', '#ffd23b']
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
          { kind: kind || 'orb', r: r || 5, dmg: dmg, dmgScale: g.atkScale, life: 7 }));
      }
      SFX.enemyShoot();
    }

    update(dt, g) {
      this.t += dt;
      this.animT += dt;
      this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      // 击退衰减
      this.x += this.kbX * dt; this.y += this.kbY * dt;
      this.kbX *= 0.86; this.kbY *= 0.86;

      const p = g.player;
      switch (this.type) {
        case 'eagle': this.aiEagle(dt, g, p); break;
        case 'bat': this.aiBat(dt, g, p); break;
        case 'demon': this.aiDemon(dt, g, p); break;
        case 'leigong': this.aiLeigong(dt, g, p); break;
        case 'pig': this.aiPig(dt, g, p); break;
        case 'archer': this.aiArcher(dt, g, p); break;
        case 'skeleton': this.aiSkeleton(dt, g, p); break;
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
          const a = Math.atan2(this.lockY - this.y, this.lockX - this.x);
          this.diveVx = Math.cos(a) * 420 * this.speedMul;
          this.diveVy = Math.sin(a) * 420 * this.speedMul;
        }
      } else if (this.state === 'dive') {
        this.x += this.diveVx * dt; this.y += this.diveVy * dt;
        this.diveVy += 500 * dt;   // 俯冲下坠
        if (this.stateT > 1.1 || this.y > CFG.GROUND_Y - 20) { this.state = 'recover'; this.stateT = 0; }
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
          g.lightnings.push(new Lightning(lx, 56, this.bulletDmg * g.atkScale));
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
        gg.explodeFireball(b.x, b.y, frags, dmg * 0.7, 70);
      };
      g.bullets.push(fb);
      SFX.enemyShoot();
    }

    /* 小弓箭手：地面行走 → 停留抛射箭矢（3-5 次）→ 向左疾奔 */
    aiArcher(dt, g, p) {
      this.y = CFG.GROUND_Y - 22;   // 始终踩在地面
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
    /* 自爆骷髅：高速冲入屏幕中部 → 降速持续追击玩家 → 接触自爆 */
    aiSkeleton(dt, g, p) {
      const S = CFG.skeleton;
      if (this.state === 'rush') {
        this.x -= S.rushSpeed * this.speedMul * dt;
        this.y += Math.sin(this.t * 6) * 60 * dt;
        this.y = clamp(this.y, CFG.TOP_Y + 20, CFG.GROUND_Y - 40);
        if (this.x < CFG.W * 0.52) this.state = 'chase';
      } else {
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = S.chaseSpeed * this.speedMul;
        this.x += (dx / d) * sp * dt;
        this.y += (dy / d) * sp * dt + Math.sin(this.t * 8) * 26 * dt;
        this.y = clamp(this.y, CFG.TOP_Y, CFG.GROUND_Y - 20);
        if (d < S.triggerD + p.radius * 0.3) this.detonate(g);
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

    /* 渲染 */
    render(ctx) {
      const flip = this.flash > 0;
      const t = this.animT;
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
          drawSprite(ctx, Sprites.leigongL, this.x, this.y + Math.sin(t * 2) * 3, 2.2, 2.2, 0, this.flash);
          break;
        case 'pig':
          drawSprite(ctx, Sprites.pigL, this.x, this.y + Math.sin(t * 2.2) * 3, 2.1, 2.1, 0, this.flash);
          break;
        case 'archer': {
          const moving = this.state !== 'stop';
          const bob = moving ? Math.abs(Math.sin(t * (this.state === 'run' ? 16 : 9))) * -2 : 0;
          drawSprite(ctx, Sprites.archerL, this.x, this.y + bob + 4, 2.0, 2.0, 0, this.flash);
          break;
        }
        case 'skeleton': {
          // 追击时爆核急促脉动闪烁，提示即将自爆
          const pulse = this.state === 'chase' ? 1 + Math.sin(t * 16) * 0.08 : 1;
          drawSprite(ctx, Sprites.skeletonL, this.x, this.y + 3, 2.0 * pulse, 2.0 * pulse, 0, this.flash);
          break;
        }
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

  /* ---------------- 地面山石（触碰暴毙） ---------------- */
  const ROCK_DEFS = [
    { w: 480, h: 130 },   // 大：屏幕宽 1/2
    { w: 240, h: 86 },    // 中：屏幕宽 1/4
    { w: 192, h: 66 }     // 小：屏幕宽 1/5
  ];
  class Rock {
    /** kind: 0 大 / 1 中 / 2 小 */
    constructor(x, kind) {
      this.kind = kind;
      this.w = ROCK_DEFS[kind].w;
      this.h = ROCK_DEFS[kind].h;
      this.x = x;                         // 中心 x
      this.baseY = CFG.GROUND_Y;
      this.dead = false;
      this.warned = false;
    }
    get left() { return this.x - this.w / 2; }
    get top() { return this.baseY - this.h; }
    update(dt, g) {
      this.x -= 62 * dt;                  // 与地面卷轴同步
      if (this.x < -this.w / 2 - 60) this.dead = true;
      // 与飞虎碰撞：暴毙
      const p = g.player;
      const cx = clamp(p.x, this.left, this.left + this.w);
      const cy = clamp(p.y, this.top, this.baseY);
      if ((p.x - cx) ** 2 + (p.y - cy) ** 2 < (p.radius * 0.75) ** 2) {
        if (p.invT <= 0) {
          SFX.shock();
          burst(g, p.x, p.y, 40, ['#7d8794', '#a7b3c2', '#fff', '#f7941d'], 320, 7, 0.9, 260);
          p.hp = 0;
          g.gameOver();
        }
      }
      // 小怪撞山：坠毁死亡（Boss 不受影响）
      for (const e of g.enemies) {
        if (e.dead) continue;
        const ex = clamp(e.x, this.left, this.left + this.w);
        const ey = clamp(e.y, this.top, this.baseY);
        if ((e.x - ex) ** 2 + (e.y - ey) ** 2 < (e.radius * 0.8) ** 2) {
          const cols = ['#7d8794', '#a7b3c2', '#fff'].concat(e.deathColors());
          burst(g, e.x, e.y, 18, cols, 250, 5, 0.6, 240);
          SFX.explode(false);
          g.shake(5);
          e.die(g);
        }
      }
    }
    render(ctx) {
      const step = 8;   // 像素块
      const x0 = this.left, w = this.w, h = this.h, baseY = this.baseY;
      // 剪影高度剖面（锯齿岩丘）
      const rows = Math.ceil(h / step);
      for (let r = 0; r < rows; r++) {
        const yy = baseY - r * step;
        // 顶部锯齿：根据行生成左右收窄
        const t = r / rows;
        const inset = (1 - t) * w * 0.26 + Math.sin(r * 1.7 + this.kind) * step * 0.5;
        let rx = x0 + Math.max(0, inset);
        let rw = w - Math.max(0, inset) * 2;
        // 顶部几行加随机缺口（尖峰感）
        if (r >= rows - 2) {
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
          ctx.fillRect(rx + step, yy - step + step / 2, Math.min(step * 2, rw - step * 2), step / 2);
        }
      }
      // 黑色描边底边 + 裂纹
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(x0 + step, baseY - step * 2.2, step, step * 1.2);
      ctx.fillRect(x0 + w * 0.6, baseY - h * 0.55, step, step * 1.6);
    }
  }

  window.FT = { Particle, Gem, Bullet, Lightning, Player, Enemy, Rock, burst, drawSprite, rand, randi, clamp, dist };
})();
