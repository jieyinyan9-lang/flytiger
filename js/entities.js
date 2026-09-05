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
    /** kind: bolt / orb / shuriken / feather / whirl / flame / fireball / katana / spark / shell / missile / float / cross / knife */
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
      // S 形弹道：飞行方向绕基准角正弦摆动（飞刀线性 S 走向）
      if (this.sineWave && !this.neutralized) {
        const s = this.sineWave;
        if (!s.inited) { s.inited = true; s.baseA = Math.atan2(this.vy, this.vx); }
        const spd = Math.hypot(this.vx, this.vy);
        const a = s.baseA + Math.sin(this.t * s.freq + s.phase) * s.amp;
        this.vx = Math.cos(a) * spd; this.vy = Math.sin(a) * spd;
        this.angle = a;
      }
      // 追踪导弹 / 漂浮弹：按转向速率缓慢修正朝向玩家
      if (this.homing && !this.neutralized) {
        const p = g.player;
        const ta = Math.atan2(p.y - this.y, p.x - this.x);
        let cur = Math.atan2(this.vy, this.vx);
        let d = ta - cur;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        cur += clamp(d, -this.turnRate * dt, this.turnRate * dt);
        const sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(cur) * sp; this.vy = Math.sin(cur) * sp;
        this.angle = cur;
        // 尾焰仅导弹有
        if (this.kind === 'missile') {
          this.trail += dt;
          if (this.trail > 0.05) {
            this.trail = 0;
            g.particles.push(new Particle(this.x, this.y,
              rand(-20, 20), rand(-20, 20), 0.3, rand(2, 4),
              Math.random() < 0.5 ? '#ff7b2e' : '#ffd23b'));
          }
        }
      }
      if (this.kind === 'arrow') {
        this.vy += 520 * dt;              // 抛射：重力
        this.angle = Math.atan2(this.vy, this.vx);
        if (this.y > CFG.GROUND_Y - 4) { this.dead = true; burst(g, this.x, CFG.GROUND_Y - 6, 4, ['#8a5a2b', '#6b4a2a'], 90, 3, 0.3); }
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
      if (this.life <= 0 && !this.dead) {
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
        // 元素弹道优先走自定义渲染（火焰圆形/毒液菱形/寒冰锥型）
        if (this.element) { this.renderElement(ctx); return; }
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
        // 尾焰
        ctx.fillStyle = Math.floor(this.t * 20) % 2 ? '#ffd23b' : '#ff7b2e';
        ctx.fillRect(-16 * ms, -2 * ms, 5 * ms, 4 * ms);
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
      if (k === 'cross') {
        // 怪客巨型十字弹：黑边红十字黄芯
        const s = this.r;
        const arm = s * 1.5, th = s * 0.62;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.sin(this.t * 2) * 0.12);
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
    }

    /** 元素弹道专用渲染：火焰=红色圆形，毒液=绿色菱形，寒冰=蓝色锥型 */
    renderElement(ctx) {
      const r = this.r;
      if (this.element === 'flame') {
        ctx.fillStyle = '#cc1a00'; ctx.beginPath(); ctx.arc(this.x, this.y, r + 2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff3b1a'; ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffdd55'; ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.45, 0, TAU); ctx.fill();
      } else if (this.element === 'poison') {
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.fillStyle = '#0a3a0a';
        ctx.beginPath(); ctx.moveTo(0, -r - 2); ctx.lineTo(r + 2, 0); ctx.lineTo(0, r + 2); ctx.lineTo(-r - 2, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2dd44a';
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a6ffa6';
        ctx.beginPath(); ctx.moveTo(0, -r * 0.4); ctx.lineTo(r * 0.4, 0); ctx.lineTo(0, r * 0.4); ctx.lineTo(-r * 0.4, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (this.element === 'ice') {
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        ctx.fillStyle = '#1a5a8a';
        ctx.beginPath(); ctx.moveTo(r + 3, 0); ctx.lineTo(-r - 1, -r - 1); ctx.lineTo(-r - 1, r + 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4ab8ff';
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r, -r * 0.8); ctx.lineTo(-r, r * 0.8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e0f7ff';
        ctx.beginPath(); ctx.moveTo(r * 0.5, 0); ctx.lineTo(-r * 0.5, -r * 0.35); ctx.lineTo(-r * 0.5, r * 0.35); ctx.closePath(); ctx.fill();
        ctx.restore();
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
          p.hurt(this.dmg, g);
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
          p.hurt(this.dmg, g);
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
      // 元素弹道（击败 Boss 后解锁，总最多 3 条，FIFO 替换最早获得的）
      this.elementWay = [];     // ['flame', 'poison', 'ice', ...] 顺序代表获得先后
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
      this.shieldChance = 0;    // 触发概率
      this.shieldReduce = 0;    // 减伤比例
      this.shieldFlash = 0;     // 触发特效计时
      // 移动速度强化
      this.moveSpdLv = 0;
      // 受伤闪红
      this.hurtFlash = 0;
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
      // 接触敌人造成伤害（每敌 0.5s 一次）
      g.targets().forEach(e => {
        if (e.dead) return;
        if (e.isBoss && e.state === 'enter') return;   // Boss 入场免伤
        for (let i = 0; i < this.blades; i++) {
          const bp = this.bladePos(i);
          const rr = (CFG.blade.hitR + e.radius) * (0.7 + lenMul * 0.3);
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

    /** 受伤：防护罩概率减免，伤害取整；死亡时消耗生命条数 */
    hurt(amount, g) {
      if (this.invT > 0) return;
      let amt = Math.max(1, Math.round(amount));
      // 防护罩：概率触发减伤
      if (this.shieldLv > 0 && Math.random() < this.shieldChance) {
        amt = Math.max(1, Math.round(amt * (1 - this.shieldReduce)));
        this.shieldFlash = 0.55;
        SFX.zap();
        burst(g, this.x, this.y, 12, ['#7fe7ff', '#fff', '#c9f6ff'], 200, 4, 0.4);
      }
      this.hp -= amt;
      this.invT = CFG.player.invincibleTime;
      this.hurtFlash = 0.4;
      SFX.hurt();
      g.shake(8);
      burst(g, this.x, this.y, 10, ['#ff5252', '#fff'], 180, 4, 0.4);
      if (this.hp <= 0) { this.hp = 0; this.die(g); }
    }

    /** 阵亡：消耗一条生命原地重生，否则游戏结束 */
    die(g) {
      if (g.state !== 'playing') return;
      if (this.lives > 0) {
        this.lives--;
        this.hp = this.maxHp;
        this.invT = 2.6;
        this.hurtFlash = 0;
        this.rage = CFG.ultimate.rageMax;   // 复活时怒气立刻回满，可释放大招
        SFX.explode(true);
        g.shake(14);
        g.flashT = 0.45; g.flashColor = '#ffd0d0';
        burst(g, this.x, this.y, 44, ['#f7941d', '#ffd93b', '#ff5252', '#fff'], 320, 7, 0.9, 140);
        g.toast(`飞虎阵亡！剩余生命 ×${this.lives}，重生！`, 2.2);
        // 回到安全位置
        this.x = clamp(this.x, 80, 260);
        this.y = CFG.H * 0.4;
      } else {
        g.gameOver();
      }
    }

    update(dt, g) {
      // 计时
      this.wingT += dt;
      this.invT = Math.max(0, this.invT - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      this.shieldFlash = Math.max(0, this.shieldFlash - dt);
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
      const spd = CFG.player.speed * (1 + (this.sizeMul - 1) * 0.08) * (1 + (this.moveSpdLv || 0) * 0.12);
      this.vx = mx * spd; this.vy = my * spd;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.radius = CFG.player.radius * (0.75 + this.sizeMul * 0.25);
      this.x = clamp(this.x, 40, CFG.W - 60);
      this.y = clamp(this.y, CFG.TOP_Y, CFG.GROUND_Y - this.radius * 0.5);
      this.faceTilt += (clamp(this.vy / 900, -0.25, 0.25) - this.faceTilt) * Math.min(1, dt * 10);

      // 地面危险区：贴地持续灼伤（走统一受伤通道：取整 + 防护罩判定）
      this.groundTick = (this.groundTick || 0) + dt;
      if (this.y + this.radius * 0.72 >= CFG.GROUND_Y - 4) {
        if (this.groundTick >= 0.4) {
          this.groundTick = 0;
          burst(g, this.x + rand(-20, 20), CFG.GROUND_Y - 4, 5, ['#67bd57', '#ff7b2e', '#4f9e44'], 120, 4, 0.4, 200);
          const wasInv = this.invT;
          this.invT = 0;
          this.hurt(8, g);
          if (this.invT < wasInv && wasInv > 0) this.invT = 0.3;   // 未实际受伤时保留短无敌
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
      // 尾部弹道：向后射击 —— 完整继承正面弹道成长（弹数/扩散/弹速/穿透/爆炸）
      if (this.tailWay) {
        angles.forEach(an => {
          g.bullets.push(new Bullet(
            this.x - 44 * this.sizeMul, muzzleY,
            -Math.cos(an) * speed * 0.95, Math.sin(an) * speed * 0.95,
            {
              kind: 'bolt', friendly: true, dmg,
              r: (4 + this.bulletTier * 2) * bscale,
              pierce, bombLv: this.bombLv, tier: this.bulletTier
            }));
        });
      }
      // 下部弹道：向下射击 —— 同样继承正面弹道成长（扩散方向随弹道旋转）
      if (this.downWay) {
        angles.forEach(an => {
          g.bullets.push(new Bullet(
            this.x + 8 * this.sizeMul, this.y + 26 * this.sizeMul,
            Math.sin(an) * speed * 0.9, Math.cos(an) * speed * 0.9,
            {
              kind: 'bolt', friendly: true, dmg,
              r: (4 + this.bulletTier * 2) * bscale,
              pierce, bombLv: this.bombLv, tier: this.bulletTier
            }));
        });
      }
      // 元素弹道：遍历 elementWay 队列，按获得顺序发射（总最多 3 条）
      const elemCount = this.elementWay.length;
      for (let w = 0; w < elemCount; w++) {
        const off = (elemCount === 1 ? 0 : (w - (elemCount - 1) / 2) * 0.42);
        const el = this.elementWay[w];
        const eOffY = (elemCount === 1 ? 0 : (w - (elemCount - 1) / 2) * 14);
        let vy = 0, vx = Math.cos(off) * speed * 0.88;
        if (el === 'flame') vy = Math.sin(off) * speed * 0.85 - 60;
        else if (el === 'poison') vy = Math.sin(off) * speed * 0.85 + 60;
        else vy = Math.sin(off) * speed * 0.88;
        g.bullets.push(new Bullet(
          muzzleX, muzzleY + eOffY, vx, vy,
          { kind: 'orb', friendly: true, dmg: Math.round(dmg * 0.7), r: 7 * bscale,
            pierce: 0, element: el, life: 4 }));
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

      // 防护罩触发特效：青色光罩扩散
      if (this.shieldFlash > 0) {
        const a = clamp(this.shieldFlash / 0.55, 0, 1);
        const r = this.radius * (1.6 + (1 - a) * 0.7);
        ctx.save();
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = '#7fe7ff';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = a * 0.25;
        ctx.fillStyle = '#7fe7ff';
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

      // 元素持续伤害（火焰/毒液/寒冰弹道命中后生效）
      this.dotT = 0;           // DoT 剩余时间
      this.dotDps = 0;         // 每秒伤害
      this.dotType = '';       // 'flame' / 'poison' / 'ice'
      this.invulnBreakT = 0;   // 破无敌倒计时（归零时清除 spawnInvuln）
      this.freezeT = 0;        // 冻结时间（>0 时停止行动）

      // 难度缩放
      const round = g.round;
      const hpMul = (1 + (round - 1) * 0.16 + g.time * 0.0025) * g.diffMul;
      this.maxHp = Math.round(def.hp * hpMul);
      // 动态血量精英（如大型蝙蝠）：按玩家当前 DPS 反推血量，保证 5-8 秒交战时长
      if (def.dynamicHp && def.fightTime && g.playerDps) {
        this.maxHp = Math.max(this.maxHp, Math.round(g.playerDps() * rand(def.fightTime[0], def.fightTime[1])));
      }
      this.hp = this.maxHp;
      this.speedMul = 1 + (round - 1) * 0.03 + Math.min(0.25, g.time * 0.001);

      this.x = CFG.W + 50;
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

      // 飞鹰：出场 3s 无敌
      if (type === 'eagle') this.spawnInvuln = 3;
      // 小超人：出场 7s 无敌
      if (type === 'superboy') this.spawnInvuln = 7;
      // 大型蝙蝠：飞行精英，悬停甩黑色飞刀（S 形弹/散射）
      if (type === 'bigbat') {
        this.state = 'hover';
        this.atkT = rand(1.4, 2.2);
        this.volley = 0;
        this.spawnInvuln = 2;
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
      if (this.spawnInvuln > 0) return;   // 出场无敌期内不受伤
      this.hp -= dmg;
      this.flash = 0.08;
      this.hurtT = 0.12;   // 持续受伤红染：连续命中时 hurtT 始终 >0，不会闪烁
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
        skeleton: ['#e8eef7', '#9aa7bb', '#e0453a', '#ffd23b'],
        skull: ['#e8eef7', '#9aa7bb', '#7fe7ff', '#ff3b5c'],
        cannoneer: ['#5a6678', '#2c3545', '#ffd23b', '#fff'],
        superboy: ['#2f6fd0', '#e0453a', '#ffd23b', '#fff'],
        bigbat: ['#4a3566', '#2b1f3d', '#ff5d73', '#fff']
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
      this.t += dt;
      this.animT += dt;
      this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.spawnInvuln = Math.max(0, this.spawnInvuln - dt);

      // 元素 DoT 处理
      if (this.dotT > 0) {
        this.dotT -= dt;
        const tickDmg = this.dotDps * dt;
        if (this.spawnInvuln <= 0 && tickDmg > 0) {
          this.hp -= tickDmg;
          this.hurtT = 0.12;
          if (this.hp <= 0) { this.die(g); return; }
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
        case 'cannoneer': this.aiCannoneer(dt, g, p); break;
        case 'skull': this.aiSkull(dt, g, p); break;
        case 'skeleton': this.aiSkeleton(dt, g, p); break;
        case 'superboy': this.aiSuperboy(dt, g, p); break;
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
        gg.explodeFireball(b.x, b.y, frags, dmg * 0.7, 70);
      };
      g.bullets.push(fb);
      SFX.enemyShoot();
    }

    /* 小弓箭手：地面行走 → 停留抛射箭矢（3-5 次）→ 向左疾奔 */
    aiArcher(dt, g, p) {
      this.y = CFG.GROUND_Y - 34;   // 始终踩在地面（体积×2 后中心上移）
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
      this.y = CFG.GROUND_Y - 34;   // 始终踩在地面（体积×2 后中心上移）
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
      sh.onExpire = (gg, b) => gg.shellBlast(b.x, b.y, dmg);
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

    /* 渲染 */
    render(ctx) {
      const flip = this.flash > 0;
      const t = this.animT;
      const hurtRed = this.hurtT > 0;   // 持续受伤红染（不闪烁）
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
          drawSprite(ctx, spr, this.x, this.y + Math.sin(t * 3) * 4, 3.4, 3.4, Math.sin(t * 1.8) * 0.06, this.flash);
          break;
        }
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

  /* ---------------- 地面山石（触碰暴毙） ---------------- */
  const ROCK_DEFS = [
    { w: 480, h: 130 },               // 大：屏幕宽 1/2
    { w: 240, h: 86 },                // 中：屏幕宽 1/4
    { w: 192, h: 66 },                // 小：屏幕宽 1/5
    { w: 420, h: 118, trap: true },   // 长梯形石：上窄下宽（≤屏幕一半）
    { w: 250, h: 88, trap: true }     // 短梯形石：上窄下宽
  ];
  class Rock {
    /** kind: 0 大 / 1 中 / 2 小 / 3 长梯形 / 4 短梯形 */
    constructor(x, kind) {
      this.kind = kind;
      this.w = ROCK_DEFS[kind].w;
      this.h = ROCK_DEFS[kind].h;
      this.trap = !!ROCK_DEFS[kind].trap;
      this.x = x;                         // 中心 x
      this.baseY = CFG.GROUND_Y;
      this.dead = false;
      this.warned = false;
    }
    get left() { return this.x - this.w / 2; }
    get top() { return this.baseY - this.h; }
    /** 被野鸡撞击 / 炮弹炸毁：障碍爆炸 */
    destroy(g) {
      if (this.dead) return;
      this.dead = true;
      burst(g, this.x, this.baseY - this.h * 0.4, 30,
        ['#7d8794', '#a7b3c2', '#5a5f66', '#fff', '#ff7b2e'], 300, 7, 0.8, 260);
      SFX.explode(false);
      g.shake(7);
    }
    /** 点是否在岩石截面内（梯形按上窄下宽收边） */
    contains(px, py, pad) {
      pad = pad || 0;
      if (px < this.left - pad || px > this.left + this.w + pad) return false;
      if (py < this.top - pad || py > this.baseY + pad) return false;
      if (this.trap) {
        const t = clamp((this.baseY - py) / this.h, 0, 1);
        const inset = t * this.w * 0.27;
        return px > this.left + inset - pad && px < this.left + this.w - inset + pad;
      }
      return true;
    }
    update(dt, g) {
      this.x -= 62 * dt;                  // 与地面卷轴同步
      if (this.x < -this.w / 2 - 60) this.dead = true;
      // 与飞虎碰撞：暴毙（走生命条数系统）
      const p = g.player;
      if (this.contains(p.x, p.y, p.radius * 0.55) && p.invT <= 0) {
        SFX.shock();
        burst(g, p.x, p.y, 40, ['#7d8794', '#a7b3c2', '#fff', '#f7941d'], 320, 7, 0.9, 260);
        p.hp = 0;
        p.die(g);
      }
      // 小怪撞山：坠毁死亡（地面单位 / Boss 不受影响）
      for (const e of g.enemies) {
        if (e.dead || e.groundUnit) continue;
        if (this.contains(e.x, e.y, e.radius * 0.7)) {
          const cols = ['#7d8794', '#a7b3c2', '#fff'].concat(e.deathColors());
          burst(g, e.x, e.y, 18, cols, 250, 5, 0.6, 240);
          SFX.explode(false);
          g.shake(5);
          e.die(g);
        }
      }
      // 可破坏弹（野鸡炮弹/导弹）：命中山石 → 障碍爆炸
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
      const step = 8;   // 像素块
      const x0 = this.left, w = this.w, h = this.h, baseY = this.baseY;
      // 剪影高度剖面（锯齿岩丘 / 上窄下宽梯形石）
      const rows = Math.ceil(h / step);
      for (let r = 0; r < rows; r++) {
        const yy = baseY - r * step;
        const t = r / rows;
        // 梯形石：底部全宽，向上线性收窄；普通岩丘保持原剖面
        const inset = this.trap
          ? t * w * 0.27
          : (1 - t) * w * 0.26 + Math.sin(r * 1.7 + this.kind) * step * 0.5;
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

  window.FT = { Particle, Gem, Bullet, Lightning, Beam, Player, Enemy, Rock, burst, drawSprite, rand, randi, clamp, dist };
})();
