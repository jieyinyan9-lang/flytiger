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
      this.tier = opts.tier || 0;
      this.dmgScale = opts.dmgScale || 1;   // 敌人子弹伤害系数（Boss成长）
      this.grav = opts.grav || 0;           // 重力（抛射弹道）
      this.spin = rand(0, TAU);
      this.spinRate = opts.spinRate || 9;   // 自转角速度（斧头弹等持续旋转）
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
      this.sineWave = opts.sine || null;       // S 形弹道：{ amp, freq, phase }（飞刀线性 S 走向）
      this.fireTrail = !!opts.fireTrail;       // 火焰弹：飞行时喷射火焰粒子拖尾 + 火焰分层渲染
      this.trailCols = opts.trailCols || null; // 自定义拖尾粒子配色（紫焰苹果等），设置后即启用拖尾
    }
    /** Boss 死亡：弹幕无效化，减速并逐渐消失 */
    neutralize() {
      if (this.neutralized) return;
      this.neutralized = true;
      this.onExpire = null;      // 火球等不再触发爆炸
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
      if (this.kind === 'arrow') {
        this.vy += 520 * dt;              // 抛射：重力
        this.angle = Math.atan2(this.vy, this.vx);
        if (this.y > CFG.GROUND_Y - 4) { this.dead = true; burst(g, this.x, CFG.GROUND_Y - 6, 4, ['#8a5a2b', '#6b4a2a'], 90, 3, 0.3); }
      }
      // 龙系刺弹（草龙龙鳞刺 / 沙晶锥刺 / 黑炎龙鳞 / 熔岩龙牙 / 骨刺 / 齿轮弹 / 深海水晶刺）：高速直线，触地（海）即消
      if (SPIKE_KINDS[this.kind] && !this.dead) {
        const gy = g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y;
        if (this.y > gy - 4) {
          this.dead = true;
          burst(g, this.x, gy - 4, 4, SPIKE_FX[this.kind] || SPIKE_FX.spike, 100, 3, 0.3);
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
      if (this.kind === 'fireball') {
        this.trail += dt;
        if (this.trail > 0.05) {
          this.trail = 0;
          g.particles.push(new Particle(this.x, this.y,
            rand(-30, 30), rand(-50, -10), 0.4, rand(3, 6),
            Math.random() < 0.5 ? '#ff7b2e' : '#ffd23b'));
        }
      }
      // 火焰弹拖尾：沿飞行反方向持续喷射火焰粒子（弹体越大粒子越粗）；trailCols 可自定义配色（紫焰苹果）
      if ((this.fireTrail || this.trailCols) && !this.neutralized) {
        this.trail += dt;
        if (this.trail > 0.03) {
          this.trail = 0;
          const spd = Math.hypot(this.vx, this.vy);
          const bx = spd > 1 ? this.vx / spd : -1, by = spd > 1 ? this.vy / spd : 0;
          const fireCols = this.trailCols || ['#ff2a0a', '#ff5a1a', '#ff9d2e', '#ffd23b', '#fff5d0'];
          for (let i = 0; i < 3; i++) {
            const ja = rand(0, TAU), jr = rand(10, 60);
            g.particles.push(new Particle(
              this.x + rand(-this.r * 0.4, this.r * 0.4),
              this.y + rand(-this.r * 0.4, this.r * 0.4),
              -bx * rand(50, 140) + Math.cos(ja) * jr,
              -by * rand(50, 140) + Math.sin(ja) * jr - 30,
              rand(0.35, 0.7), rand(this.r * 0.35, this.r * 0.8),
              fireCols[randi(0, fireCols.length - 1)]));
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
      this.x += this.vx * dt; this.y += this.vy * dt;
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
      if (this.life <= 0 && !this.dead) {
        if (this.onExpire) this.onExpire(g, this);
        this.dead = true;
      }
      if (this.x < -80 || this.x > CFG.W + 80 || this.y < -80 || this.y > CFG.H + 80) {
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

  /* ---------------- S 型弧线激光（大王眼珠攻击：自眼睛射向屏幕左缘随机落点） ---------------- */
  class CurveBeam {
    /** (x,y) 起点（眼睛）；(ex,ey) 终点（屏幕左缘落点）；amp S 波幅；w 束宽；dmg 伤害；warn 预警秒数 */
    constructor(x, y, ex, ey, amp, w, dmg, warn) {
      this.x = x; this.y = y; this.ex = ex; this.ey = ey;
      this.w = w; this.dmg = dmg;
      this.t = 0; this.warn = warn || 1.0; this.active = 0.45;
      this.dealt = false; this.dead = false;
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
        if (this.hitTest(p, 1)) p.hurt(this.dmg, g);
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
      // 接触敌人造成伤害（每敌 0.5s 一次；草龙按最近露出节判定）
      g.targets().forEach(e => {
        if (e.dead) return;
        if (e.isBoss && (e.state === 'enter' || e.state === 'trans')) return;   // Boss 入场/转场免伤
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
            if (now - (this.bladeCd.get(e) ?? -1) > 0.5) {
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

    /** 受伤：防护罩概率减免，伤害取整；死亡时消耗生命条数。返回 false=无敌帧未命中 */
    hurt(amount, g) {
      if (this.invT > 0) return false;
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
      return true;
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
        // 复活后转移至另一张地图
        if (g.rerollMap) g.rerollMap();
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
      // 危险地面高度：大海为波动海平面（g.groundYAt），其余地图为固定地面
      const isSea = !!(g.map && g.map.sea);
      const gy = g.groundYAt ? g.groundYAt(this.x) : CFG.GROUND_Y;
      this.y = clamp(this.y, CFG.TOP_Y, gy - this.radius * 0.5);
      this.faceTilt += (clamp(this.vy / 900, -0.25, 0.25) - this.faceTilt) * Math.min(1, dt * 10);

      // 地面/海面危险区：贴地持续受伤（走统一受伤通道：取整 + 防护罩判定）；海水掉血量很少
      this.groundTick = (this.groundTick || 0) + dt;
      if (this.y + this.radius * 0.72 >= gy - 4) {
        const tickInt = isSea ? CFG.map.seaTick : 0.4;
        if (this.groundTick >= tickInt) {
          this.groundTick = 0;
          if (isSea) burst(g, this.x + rand(-20, 20), gy - 2, 6, ['#bfeaff', '#7fc6ef', '#ffffff'], 130, 4, 0.4, 160);
          else burst(g, this.x + rand(-20, 20), CFG.GROUND_Y - 4, 5, ['#67bd57', '#ff7b2e', '#4f9e44'], 120, 4, 0.4, 200);
          const wasInv = this.invT;
          this.invT = 0;
          this.hurt(isSea ? CFG.map.seaDmg : 8, g);
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

      // 接触检测 → 自动近战 / 受伤（草龙按露出地面的龙身节逐节判定）
      g.targets().forEach(e => {
        let touch;
        if (e.segments) touch = e.touchesPoint(this.x, this.y, this.radius);
        else touch = dist(this, e) < this.radius + e.radius * 0.85;
        if (touch) {
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
      // 大型蝙蝠：飞行精英，悬停甩黑色飞刀（S 形弹/散射）；无敌 4s / 可承伤 4s 持续循环
      if (type === 'bigbat') {
        this.state = 'hover';
        this.atkT = rand(1.4, 2.2);
        this.volley = 0;
        this.invPhase = true;      // true=无敌期，false=可承伤期
        this.invCycleT = 4;        // 阶段倒计时（每 4s 切换）
        this.spawnInvuln = 4;      // 首个无敌期 4s
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
        case 'bigbat': this.aiBigBat(dt, g, p); break;
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
      // 无敌 4s → 可承伤 4s 持续循环；无敌期借用 spawnInvuln（免伤/金色护盾环/元素弹破无敌/大招清除均自动生效）
      this.invCycleT -= dt;
      if (this.invCycleT <= 0) {
        this.invCycleT = 4;
        this.invPhase = !this.invPhase;
        if (this.invPhase) {
          this.spawnInvuln = 4;     // 进入无敌期
          this.invulnBreakT = 0;    // 清掉元素弹留下的破无敌倒计时，防止新无敌期被旧计时提前打断
        } else {
          this.spawnInvuln = 0;     // 进入可承伤期
        }
      }
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

  /* ---------------- 地面障碍物（触碰暴毙；各地图外形不同，阻碍特性与草地一致） ---------------- */
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
    coralL: { w: 92,  h: 70,  shape: 'coral', debris: ['#ff6f61', '#d6485e', '#ffc48a', '#fff'] }
  };

  /** 像素块填充（坐标自动取整） */
  function obsPx(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  class Rock {
    /** shapeId：OBS 表中的障碍造型 id（草原为 grass0..grass4） */
    constructor(x, shapeId) {
      this.shapeId = shapeId;
      this.kind = shapeId;
      this.def = OBS[shapeId] || OBS.grass0;
      this.w = this.def.w;
      this.h = this.def.h;
      this.trap = !!this.def.trap;
      this.x = x;                         // 中心 x
      this.baseY = CFG.GROUND_Y;
      this.dead = false;
      this.warned = false;
      this.flashT = 0;       // 剩余闪白时长（秒）
      this.flashCd = 0;      // 闪白冷却剩余（秒，含闪白持续期）
    }
    get left() { return this.x - this.w / 2; }
    get top() { return this.baseY - this.h; }
    get debris() { return this.def.debris || ROCK_DEBRIS; }
    /** 被野鸡撞击 / 炮弹炸毁：障碍爆炸 */
    destroy(g) {
      if (this.dead) return;
      this.dead = true;
      burst(g, this.x, this.baseY - this.h * 0.4, 30, this.debris, 300, 7, 0.8, 260);
      SFX.explode(false);
      g.shake(7);
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
      // 与飞虎碰撞：暴毙（走生命条数系统）
      if (this.contains(p.x, p.y, p.radius * 0.55) && p.invT <= 0) {
        SFX.shock();
        burst(g, p.x, p.y, 40, this.debris.concat(['#f7941d']), 320, 7, 0.9, 260);
        p.hp = 0;
        p.die(g);
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
          default: this.renderRock(c);
        }
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

  /* —— 各地图障碍造型（像素风，统一 8px 块；原点：r.x 中心 / r.baseY 地面） —— */

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
      noSpine: true, seg: dragonSegBone, head: dragonHeadBone
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
      burst(g, s.x, s.y, 3, ['#fff', '#bff5d6', '#7ed46d'], 130, 3, 0.2);
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

  window.FT = { Particle, Gem, Bullet, Lightning, Beam, CurveBeam, Player, Enemy, Rock, GrassDragon, DRAGON_THEMES, burst, drawSprite, rand, randi, clamp, dist };
})();
