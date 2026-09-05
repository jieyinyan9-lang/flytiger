/* ============================================================
 * bosses.js —— Boss：精英强化型 × 特殊机制型
 *  精英：火焰飞猪王 / 雷公巨兽（体型×4，机制强化）
 *  特殊：飞天日本武士 / 咬剑鹰（独立技能）
 * ============================================================ */
(function () {
  'use strict';

  const { Bullet, Lightning, Beam, burst, drawSprite, rand, randi, clamp, Particle } = window.FT;
  const TAU = Math.PI * 2;

  class Boss {
    constructor(g, contactDmg, radius) {
      this.isBoss = true;
      this.dead = false;
      this.flash = 0;
      this.t = 0;
      this.kbX = 0; this.kbY = 0;
      this.state = 'enter';
      this.stateT = 0;
      this.x = CFG.W + 140;
      this.y = CFG.H / 2;
      this.baseY = CFG.H / 2;
      this.hoverX = 700;
      this.radius = radius;
      this.contactDmg = contactDmg;
      // 血量按玩家 DPS 动态生成：目标交战时长按 Boss 序号递增
      // 第1只20s / 第2只30s / 第3只40s / 第4只50s / 第5只起60-80s
      const fightTime = CFG.boss.fightTime(g.bossSpawned + 1);
      this.maxHp = Math.round(g.playerDps() * fightTime * g.bossHpMul());
      this.hp = this.maxHp;
      this.xpValue = 220;
      this.deathCols = ['#fff', '#ffd23b', '#ff7b2e'];
    }
    takeDamage(dmg, g, kb) {
      if (this.dead || this.state === 'enter') return;   // 入场免伤
      this.hp -= dmg;
      this.flash = 0.08;
      // Boss 免疫击退：忽略 kb 参数，防止被持续攻击推出屏幕外
      if (Math.random() < 0.3) burst(g, this.x - 14, this.y, 2, ['#fff', '#ffe08a'], 130, 3, 0.18);
      // 低血量狂暴（每只 Boss 仅一次）：三连警报 + 怒吼 + 震屏 + 红色爆发
      if (!this.enraged && this.hp > 0 && this.hp <= this.maxHp * 0.3) {
        this.enraged = true;
        SFX.bossEnrage();
        g.shake(10);
        g.toast(`${this.bossName} 狂暴了！`, 1.8);
        burst(g, this.x, this.y, 24, ['#ff3b3b', '#ffd23b', '#fff'], 280, 6, 0.6, 130);
      }
      if (this.hp <= 0) { this.hp = 0; this.die(g); }
    }
    die(g) {
      this.dead = true;
      g.onBossDefeated(this);
    }
    commonMove(dt) {
      this.x += this.kbX * dt; this.y += this.kbY * dt;
      this.kbX *= 0.9; this.kbY *= 0.9;
    }
    renderHpBar() { /* 由 DOM 处理 */ }
  }

  /* ================ A1. 火焰飞猪王（精英） ================ */
  class PigKing extends Boss {
    constructor(g) {
      super(g, 22, 56);
      this.bossName = '火焰飞猪王';
      this.title = '精英强化型';
      this.atkT = 2.0;
      this.deathCols = ['#f4726b', '#ff7b2e', '#ffd23b', '#fff'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 90 * dt;
        this.y += Math.sin(this.t * 2) * 30 * dt;
        if (this.x <= this.hoverX + 60) { this.state = 'fight'; this.stateT = 0; }
        return;
      }
      // 盘旋
      this.baseY += (clamp(p.y + 40, 120, CFG.GROUND_Y - 110) - this.baseY) * dt * 0.6;
      this.y = this.baseY + Math.sin(this.t * 1.3) * 40;
      this.x = this.hoverX + Math.sin(this.t * 0.7) * 60;

      // 三连大火球
      this.atkT -= dt;
      if (this.atkT <= 0) {
        this.atkT = rand(2.4, 3.1);
        const base = Math.atan2(p.y - this.y, p.x - this.x);
        for (let i = -1; i <= 1; i++) this.fireball(g, base + i * 0.22, 185);
      }

      // 弧形火焰喷射：扇形火舌，中间粗两端细，弧形覆盖
      if (this.flameDur > 0) {
        this.flameDur -= dt;
        const baseA = Math.atan2(p.y - this.y, p.x - this.x);
        const mouthX = this.x - 44, mouthY = this.y + 4;
        for (let i = 0; i < 6; i++) {
          const t0 = i / 5 - 0.5;                    // -0.5 ~ 0.5
          const a = baseA + t0 * 1.15;
          const wgt = 1 - Math.abs(t0) * 1.4;        // 中间粗、两端细
          const sp = rand(280, 440) * (0.6 + wgt * 0.5);
          const colors = ['#ff2a0a', '#ff5a1a', '#ff9d2e', '#ffd23b', '#fff5d0'];
          g.particles.push(new Particle(
            mouthX + Math.cos(a) * rand(0, 16), mouthY + Math.sin(a) * rand(0, 16),
            Math.cos(a) * sp, Math.sin(a) * sp,
            rand(0.3, 0.6), rand(5, 12) * (0.5 + wgt * 0.6),
            colors[Math.floor(Math.random() * colors.length)]));
        }
        // 喷火伤害：弧形区域判定
        const dx = p.x - mouthX, dy = p.y - mouthY;
        const d = Math.hypot(dx, dy);
        if (d < 360 && d > 30) {
          let da = Math.atan2(dy, dx) - baseA;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          if (Math.abs(da) < 0.55) p.hurt(Math.round(7 * g.atkScale), g);
        }
        if (this.flameDur <= 0) { this.flameDur = 0; this.flameBreathT = rand(5.5, 7.5); }
      } else {
        this.flameBreathT -= dt;
        if (this.flameBreathT <= 0) {
          this.flameDur = 2.4;
          g.toast('🔥 火猪王喷火！', 1.5); g.shake(5);
        }
      }
    }
    fireball(g, angle, speed) {
      const dmg = 18 * g.atkScale;
      const fb = new Bullet(this.x - 30, this.y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        { kind: 'fireball', r: 15, dmg, life: 4.0 });
      fb.onExpire = (gg, b) => gg.explodeFireball(b.x, b.y, 14, dmg * 0.75, 120);
      g.bullets.push(fb);
      SFX.enemyShoot();
    }
    render(ctx) {
      const bob = Math.sin(this.t * 2.2) * 4;
      drawSprite(ctx, Sprites.pigL, this.x, this.y + bob, 7.2, 7.2, 0, this.flash);
      // 背部火焰加强
      if (Math.floor(this.t * 10) % 2 === 0) {
        ctx.fillStyle = '#ff7b2e';
        ctx.fillRect(this.x - 30, this.y - 62, 14, 14);
        ctx.fillStyle = '#ffd23b';
        ctx.fillRect(this.x - 26, this.y - 58, 6, 8);
      }
      // 喷火时嘴部光晕
      if (this.flameDur > 0) {
        const mx = this.x - 44, my = this.y + 4;
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 42);
        glow.addColorStop(0, 'rgba(255,220,100,0.85)');
        glow.addColorStop(0.5, 'rgba(255,90,30,0.4)');
        glow.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(mx, my, 42, 0, TAU); ctx.fill();
      }
    }
  }

  /* ================ A2. 雷公巨兽（精英） ================
   * 三段攻击轮换：纵向三连落雷 / 横向双道闪电 / 对角 X 形斜闪电 */
  class ThunderBehemoth extends Boss {
    constructor(g) {
      super(g, 24, 64);
      this.bossName = '雷公巨兽';
      this.title = '精英强化型';
      this.atkT = 2.2;
      this.atkMode = 0;
      this.rageT = 2.2;      // 狂暴后持续竖雷计时（频率与常态攻击一致）
      this.deathCols = ['#2f6fd0', '#ffe066', '#7fe7ff', '#fff'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 80 * dt;
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }
      this.baseY += (clamp(p.y - 30, 130, CFG.GROUND_Y - 130) - this.baseY) * dt * 0.5;
      this.y = this.baseY + Math.sin(this.t * 1.0) * 36;
      this.x = this.hoverX + 20 + Math.sin(this.t * 0.5) * 50;

      this.atkT -= dt;
      if (this.atkT <= 0) {
        this.atkT = rand(2.2, 2.8);
        if (!this.enraged) {
          // 常态：纵向三连落雷 / 横向双道闪电 / 对角 X 形斜闪电 三段轮换
          // 狂暴后不再触发，由下方 rageT 竖雷接管（同一节奏，且只有竖雷一种）
          const dmg = Math.round(22 * g.atkScale);
          const mode = this.atkMode % 3;
          this.atkMode++;
          if (mode === 0) {
            // 纵向三连落雷（玩家位置 + 左右偏移）
            const offs = [0, -120, 120];
            offs.forEach(off => {
              const lx = clamp(p.x + off, 70, CFG.W - 70);
              g.lightnings.push(Lightning.vertical(lx, 92, dmg));
            });
          } else if (mode === 1) {
            // 横向闪电 ×2：贴玩家上下方扫过，逼走位
            g.lightnings.push(Lightning.horizontal(clamp(p.y - 95, 90, CFG.GROUND_Y - 60), 70, dmg));
            g.lightnings.push(Lightning.horizontal(clamp(p.y + 95, 120, CFG.GROUND_Y - 30), 70, dmg));
          } else {
            // 对角斜向闪电 ×2：X 形交叉点落在玩家附近
            const a = rand(0.6, 0.78);
            g.lightnings.push(Lightning.diagonal(p.x, p.y, a, 76, dmg));
            g.lightnings.push(Lightning.diagonal(p.x, p.y, -a, 76, dmg));
          }
          SFX.warn();
        }
      }

      // 狂暴（血量 ≤30%）后：持续竖雷打击 —— 玩家头顶 1 道（更粗）+ 左右随机 2 道夹击
      if (this.enraged) {
        this.rageT -= dt;
        if (this.rageT <= 0) {
          this.rageT = rand(2.2, 2.8);   // 狂暴竖雷频率与常态攻击一致
          const dmgR = Math.round(16 * g.atkScale);
          const side = () => clamp(p.x + rand(130, 280) * (Math.random() < 0.5 ? -1 : 1), 60, CFG.W - 60);
          g.lightnings.push(Lightning.vertical(clamp(p.x, 60, CFG.W - 60), 84, dmgR));
          g.lightnings.push(Lightning.vertical(side(), 60, dmgR));
          g.lightnings.push(Lightning.vertical(side(), 60, dmgR));
          SFX.zap();
          g.shake(2);
        }
      }
    }
    render(ctx) {
      drawSprite(ctx, Sprites.leigongL, this.x, this.y + Math.sin(this.t * 2) * 4, 8.0, 8.0, 0, this.flash);
      // 狂暴时周身电弧
      if (this.enraged && Math.floor(this.t * 8) % 2 === 0) {
        ctx.strokeStyle = 'rgba(140,210,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 62 + Math.sin(this.t * 20) * 6, 0, TAU);
        ctx.stroke();
      }
    }
  }

  /* ================ B1. 飞天日本武士（特殊机制） ================ */
  class Samurai extends Boss {
    constructor(g) {
      super(g, 26, 46);
      this.bossName = '飞天日本武士';
      this.title = '特殊机制型';
      this.hoverX = 690;
      this.shurikenT = 1.6;
      this.katanaT = 6.0;
      this.dashT = 9.0;
      this.aim = { x: 0, y: 0 };
      this.deathCols = ['#c0392b', '#7d8794', '#ffd23b', '#fff'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 130 * dt;
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }

      if (this.state === 'fight') {
        this.baseY += (clamp(p.y, 100, CFG.GROUND_Y - 120) - this.baseY) * dt * 1.2;
        this.y = this.baseY + Math.sin(this.t * 2.4) * 26;
        this.x = this.hoverX + Math.sin(this.t * 0.9) * 70;

        // 手里剑散射
        this.shurikenT -= dt;
        if (this.shurikenT <= 0) {
          this.shurikenT = rand(1.9, 2.4);
          const base = Math.atan2(p.y - this.y, p.x - this.x);
          for (let i = -3; i <= 3; i++) {
            const a = base + i * 0.13;
            g.bullets.push(new Bullet(this.x - 20, this.y,
              Math.cos(a) * 300, Math.sin(a) * 300,
              { kind: 'shuriken', r: 9, dmg: 12 * g.atkScale, life: 6 }));
          }
          SFX.enemyShoot();
        }
        // 武士刀投掷（蓄力）
        this.katanaT -= dt;
        if (this.katanaT <= 0) { this.katanaT = rand(7.5, 9.5); this.state = 'katanaWind'; this.stateT = 0; this.lockAim(p); }
        // 冲刺攻击
        this.dashT -= dt;
        if (this.dashT <= 0) { this.dashT = rand(9, 12); this.state = 'dashWind'; this.stateT = 0; this.lockAim(p); }
      }
      else if (this.state === 'katanaWind') {
        if (this.stateT >= 0.9) {
          this.state = 'fight'; this.stateT = 0;
          const a = Math.atan2(this.aim.y - this.y, this.aim.x - this.x);
          g.bullets.push(new Bullet(this.x - 24, this.y,
            Math.cos(a) * 560, Math.sin(a) * 560,
            { kind: 'katana', r: 16, dmg: 34 * g.atkScale, life: 4 }));
          SFX.dash();
          g.shake(6);
        }
      }
      else if (this.state === 'dashWind') {
        if (this.stateT >= 0.7) {
          this.state = 'dashing'; this.stateT = 0;
          const a = Math.atan2(this.aim.y - this.y, this.aim.x - this.x);
          this.dashVx = Math.cos(a) * 720;
          this.dashVy = Math.sin(a) * 720;
          SFX.dash();
        }
      }
      else if (this.state === 'dashing') {
        this.x += this.dashVx * dt; this.y += this.dashVy * dt;
        if (this.stateT > 0.8 || this.x < -80 || this.y < -60 || this.y > CFG.GROUND_Y + 60) {
          this.state = 'return'; this.stateT = 0;
        }
      }
      else if (this.state === 'return') {
        const tx = this.hoverX, ty = clamp(p.y, 100, CFG.GROUND_Y - 120);
        this.x += (tx - this.x) * dt * 2.2;
        this.y += (ty - this.y) * dt * 2.2;
        if (this.stateT > 1.2) { this.state = 'fight'; this.stateT = 0; }
      }
    }
    lockAim(p) { this.aim.x = p.x; this.aim.y = p.y; }
    render(ctx) {
      const spinning = this.state === 'dashing';
      const angle = spinning ? this.t * 20 : Math.sin(this.t * 2) * 0.08;
      // 蓄力预警线
      if (this.state === 'katanaWind' || this.state === 'dashWind') {
        const on = Math.floor(this.t * 12) % 2 === 0;
        if (on) {
          ctx.save();
          ctx.strokeStyle = this.state === 'katanaWind' ? '#ffe066' : '#ff5252';
          ctx.lineWidth = 3;
          ctx.setLineDash([12, 10]);
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.aim.x, this.aim.y + (this.state === 'dashWind' ? 0 : 0));
          ctx.stroke();
          ctx.restore();
        }
        drawSprite(ctx, Sprites.samuraiL, this.x, this.y, 4.6, 4.6, 0, 0.5);
      } else {
        drawSprite(ctx, Sprites.samuraiL, this.x, this.y, 4.6, 4.6, angle, this.flash);
      }
    }
  }

  /* ================ B2. 咬剑鹰（特殊机制） ================ */
  class SwordEagle extends Boss {
    constructor(g) {
      super(g, 20, 48);
      this.bossName = '咬剑鹰';
      this.title = '特殊机制型';
      this.hoverX = 680;
      this.featherT = 1.4;
      this.featherVolley = 0;   // 齐射计数：每 3 次有 1 发稀疏弹
      this.whirlT = 7.0;
      this.rushT = 12.0;
      this.spiralA = 0;
      this.deathCols = ['#8b96a8', '#e8eef7', '#c0392b', '#fff'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 170 * dt;
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }

      if (this.state === 'fight') {
        // 高速游弋
        this.baseY += (clamp(p.y, 100, CFG.GROUND_Y - 110) - this.baseY) * dt * 1.6;
        this.y = this.baseY + Math.sin(this.t * 3.2) * 60;
        this.x = this.hoverX + Math.sin(this.t * 1.4) * 90;

        // 羽毛扇形射击：密度差异化 —— 每 3 次齐射有 1 次稀疏（3 发大间隔），其余 9 发密集
        this.featherT -= dt;
        if (this.featherT <= 0) {
          this.featherVolley++;
          const sparse = this.featherVolley % 3 === 0;
          this.featherT = sparse ? rand(2.1, 2.6) : rand(1.6, 2.1);
          const base = Math.atan2(p.y - this.y, p.x - this.x);
          if (sparse) {
            for (let i = -1; i <= 1; i++) {
              const a = base + i * 0.5;
              g.bullets.push(new Bullet(this.x - 24, this.y,
                Math.cos(a) * 320, Math.sin(a) * 320,
                { kind: 'feather', r: 7, dmg: 10 * g.atkScale, life: 6 }));
            }
          } else {
            for (let i = -4; i <= 4; i++) {
              const a = base + i * 0.11;
              g.bullets.push(new Bullet(this.x - 24, this.y,
                Math.cos(a) * 320, Math.sin(a) * 320,
                { kind: 'feather', r: 7, dmg: 10 * g.atkScale, life: 6 }));
            }
          }
          SFX.enemyShoot();
        }
        this.whirlT -= dt;
        if (this.whirlT <= 0) { this.whirlT = rand(8, 10); this.state = 'whirl'; this.stateT = 0; this.spiralA = 0; }
        this.rushT -= dt;
        if (this.rushT <= 0) { this.rushT = rand(13, 16); this.state = 'rushWind'; this.stateT = 0; }
      }
      else if (this.state === 'whirl') {
        // 原地旋转喷射旋风弹
        this.spiralA += dt * 9;
        if (Math.floor(this.stateT / 0.09) !== Math.floor((this.stateT - dt) / 0.09)) {
          for (let k = 0; k < 2; k++) {
            const a = this.spiralA + k * Math.PI;
            g.bullets.push(new Bullet(this.x, this.y,
              Math.cos(a) * 150, Math.sin(a) * 150,
              { kind: 'whirl', r: 8, dmg: 12 * g.atkScale, life: 7 }));
          }
        }
        if (this.stateT >= 3.0) { this.state = 'fight'; this.stateT = 0; }
      }
      else if (this.state === 'rushWind') {
        if (this.stateT >= 0.5) { this.state = 'rush'; this.stateT = 0; SFX.dash(); }
      }
      else if (this.state === 'rush') {
        // 旋转突袭：追踪玩家 6 秒
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        const sp = 330;
        this.x += Math.cos(a) * sp * dt;
        this.y += Math.sin(a) * sp * dt;
        this.x = clamp(this.x, 80, CFG.W - 40);
        this.y = clamp(this.y, 70, CFG.GROUND_Y - 60);
        // 拖尾
        g.particles.push(new Particle(this.x + 20, this.y, rand(-40, 40), rand(-40, 40),
          0.35, 5, '#bfe9ff'));
        if (this.stateT >= 6.0) { this.state = 'fight'; this.stateT = 0; }
      }
    }
    render(ctx) {
      const spr = Math.floor(this.t * 8) % 2 === 0 ? Sprites.swordEagleAL : Sprites.swordEagleBL;
      let angle = Math.sin(this.t * 2) * 0.1;
      if (this.state === 'whirl' || this.state === 'rush') angle = this.t * 12;
      if (this.state === 'rushWind') {
        drawSprite(ctx, spr, this.x, this.y, 5.2, 5.2, 0, Math.floor(this.t * 10) % 2 ? 0.4 : 0);
      } else {
        drawSprite(ctx, spr, this.x, this.y, 5.2, 5.2, angle, this.flash);
      }
      // 爪中剑
      ctx.save();
      ctx.translate(this.x - 30, this.y + 14);
      ctx.rotate(0.5 + (this.state === 'rush' ? Math.sin(this.t * 12) * 0.4 : 0));
      ctx.fillStyle = '#0d1018'; ctx.fillRect(-22, -3, 40, 6);
      ctx.fillStyle = '#e8eef7'; ctx.fillRect(-20, -2, 34, 2);
      ctx.fillStyle = '#c0392b'; ctx.fillRect(14, -4, 6, 8);
      ctx.restore();
    }
  }

  /* ================ C1. 亡灵骷髅王（特殊机制：旋转弹幕头骨） ================
   * 小怪飞天骷髅的强化版：大体型 / 更密弹道 / 更高血量攻防
   * 弹道：瞄准连射 + 扇形散射 + 多方向直线环弹，头骨持续旋转改变攻击角度 */
  class SkullKing extends Boss {
    constructor(g) {
      super(g, 24, 58);
      this.bossName = '亡灵骷髅王';
      this.title = '特殊机制型';
      this.hoverX = 700;
      this.rotA = rand(0, TAU);
      this.aimT = 0.8;
      this.fanT = 2.4;
      this.ringT = 4.0;
      this.deathCols = ['#e8eef7', '#9aa7bb', '#7fe7ff', '#ff3b5c'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 120 * dt;
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }
      // 悬停 + 持续旋转（旋转带动弹幕角度）
      this.rotA += dt * 2.0;
      this.baseY += (clamp(p.y - 30, 110, CFG.GROUND_Y - 130) - this.baseY) * dt * 0.6;
      this.y = this.baseY + Math.sin(this.t * 2.0) * 42;
      this.x = this.hoverX + Math.sin(this.t * 0.8) * 55;

      // 持续瞄准连射
      this.aimT -= dt;
      if (this.aimT <= 0) {
        this.aimT = 0.7;
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        g.bullets.push(new Bullet(this.x, this.y,
          Math.cos(a) * 285, Math.sin(a) * 285,
          { kind: 'orb', r: 6, dmg: 12 * g.atkScale, dmgScale: g.atkScale, life: 6, color: '#e8eef7' }));
        SFX.enemyShoot();
      }
      // 扇形散射（9 发，随旋转偏转）
      this.fanT -= dt;
      if (this.fanT <= 0) {
        this.fanT = rand(2.4, 3.0);
        for (let i = -4; i <= 4; i++) {
          const a = this.rotA + i * 0.17;
          g.bullets.push(new Bullet(this.x, this.y,
            Math.cos(a) * 235, Math.sin(a) * 235,
            { kind: 'orb', r: 5, dmg: 11 * g.atkScale, dmgScale: g.atkScale, life: 6, color: '#e8eef7' }));
        }
        SFX.enemyShoot();
      }
      // 多方向直线环弹（12 向）
      this.ringT -= dt;
      if (this.ringT <= 0) {
        this.ringT = rand(4.0, 4.8);
        const n = 12;
        for (let i = 0; i < n; i++) {
          const a = this.rotA + (TAU / n) * i;
          g.bullets.push(new Bullet(this.x, this.y,
            Math.cos(a) * 175, Math.sin(a) * 175,
            { kind: 'orb', r: 6, dmg: 13 * g.atkScale, dmgScale: g.atkScale, life: 7, color: '#ffb02e' }));
        }
        SFX.enemyShoot();
        g.shake(4);
      }
    }
    render(ctx) {
      const pulse = 1 + Math.sin(this.t * 5) * 0.04;
      // 眼窝红光底晕
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(this.t * 6) * 0.12;
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * 1.1, 0, TAU); ctx.fill();
      ctx.restore();
      drawSprite(ctx, Sprites.skullhead, this.x, this.y, 7.6 * pulse, 7.6 * pulse, this.rotA, this.flash);
    }
  }

  /* ================ C2. 飞天狗王（特殊机制：两阶段解体攻击） ================
   * 第一阶段：狗头环形弹 + 两侧狗腿伸出-收回夹击
   * 第二阶段（半血）：解体 —— 肢体飞出击撞玩家再收回，收回后释放长线光束 */
  class DogKing extends Boss {
    constructor(g) {
      super(g, 28, 64);
      this.bossName = '飞天狗王';
      this.title = '特殊机制型';
      this.hoverX = 700;
      this.phase = 1;
      this.ringT = 2.0;
      this.legT = 2.4;      // 夹击计时
      this.legIdx = 0;
      // 狗腿：anchor 相对狗头的偏移，state: idle/thrust/hold/retract
      this.legs = [
        { ox: -10, oy: -110, state: 'idle', t: 0, tx: 0, ty: 0, hit: false },
        { ox: -10, oy: 110, state: 'idle', t: 0, tx: 0, ty: 0, hit: false }
      ];
      this.limbT = 1.2;     // 阶段2肢体出击计时
      this.limbIdx = 0;
      this.limbs = [
        { ox: -30, oy: -80, state: 'idle', t: 0, tx: 0, ty: 0, hit: false, beam: false },
        { ox: -50, oy: 0, state: 'idle', t: 0, tx: 0, ty: 0, hit: false, beam: false },
        { ox: -30, oy: 80, state: 'idle', t: 0, tx: 0, ty: 0, hit: false, beam: false },
        { ox: 0, oy: -120, state: 'idle', t: 0, tx: 0, ty: 0, hit: false, beam: false }
      ];
      this.deathCols = ['#8d96a3', '#e8eef7', '#ffd23b', '#fff'];
    }
    /** 肢体尖端位置：狗头锚点 → 锁定目标点插值 */
    limbTip(l, px, py) {
      const ax = this.x + l.ox, ay = this.y + l.oy;
      const prog = l.state === 'thrust' ? Math.min(1, l.t / 0.42)
        : l.state === 'hold' ? 1
          : l.state === 'retract' ? Math.max(0, 1 - l.t / 0.45) : 0;
      const ease = prog < 1 ? (1 - Math.cos(prog * Math.PI)) / 2 : 1;
      return {
        x: ax + (l.tx - ax) * ease,
        y: ay + (l.ty - ay) * ease,
        ax, ay, prog
      };
    }
    /** 发起一次肢体出击 */
    launchLimb(l, p) {
      l.state = 'thrust'; l.t = 0; l.hit = false;
      l.tx = clamp(p.x, 60, CFG.W - 40);
      l.ty = clamp(p.y, CFG.TOP_Y + 20, CFG.GROUND_Y - 30);
      SFX.dash();
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 110 * dt;
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }
      // 阶段切换：半血解体
      if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
        this.phase = 2;
        this.limbIdx = 0;
        this.limbT = 0.8;
        this.legs.forEach(l => { l.state = 'idle'; l.t = 0; });
        g.shake(14);
        g.flashT = 0.3; g.flashColor = '#fff';
        SFX.phaseRise();   // 阶段转换：电流上行 + 爆点
        g.toast('飞天狗王解体了！', 1.8);
        burst(g, this.x, this.y, 30, ['#8d96a3', '#e8eef7', '#fff'], 300, 6, 0.7, 100);
      }
      // 悬停
      this.baseY += (clamp(p.y, 120, CFG.GROUND_Y - 150) - this.baseY) * dt * 0.8;
      this.y = this.baseY + Math.sin(this.t * 1.6) * 34;
      this.x = this.hoverX + Math.sin(this.t * 0.7) * 46 + (this.phase === 2 ? Math.sin(this.t * 14) * 3 : 0);

      // 环形弹（狗头发射）
      this.ringT -= dt;
      if (this.ringT <= 0) {
        this.ringT = this.phase === 1 ? rand(2.2, 2.8) : rand(1.9, 2.4);
        const n = this.phase === 1 ? 12 : 14;
        const off = this.t * 0.9;
        for (let i = 0; i < n; i++) {
          const a = off + (TAU / n) * i;
          g.bullets.push(new Bullet(this.x, this.y,
            Math.cos(a) * 185, Math.sin(a) * 185,
            { kind: 'orb', r: 6, dmg: 14 * g.atkScale, dmgScale: g.atkScale, life: 6, color: '#ffd23b' }));
        }
        SFX.enemyShoot();
      }

      if (this.phase === 1) {
        // 两侧狗腿交替：伸出-收回夹击玩家
        this.legT -= dt;
        const active = this.legs.find(l => l.state === 'thrust' || l.state === 'hold');
        if (!active && this.legT <= 0) {
          this.legT = rand(2.4, 3.0);
          const l = this.legs[this.legIdx % 2];
          this.legIdx++;
          this.launchLimb(l, p);
        }
        this.legs.forEach(l => this.stepLimb(l, dt, g, 28));
      } else {
        // 阶段2：肢体连续出击，收回后释放长线光束
        this.limbT -= dt;
        const busy = this.limbs.find(l => l.state !== 'idle');
        if (!busy && this.limbT <= 0) {
          this.limbT = rand(1.6, 2.2);
          const l = this.limbs[this.limbIdx % this.limbs.length];
          this.limbIdx++;
          this.launchLimb(l, p);
          l.beam = true;   // 收回完成时释放光束
        }
        this.limbs.forEach(l => this.stepLimb(l, dt, g, 30, true));
      }
    }
    /** 肢体状态机：thrust → hold（接触伤害）→ retract（可选光束）→ idle */
    stepLimb(l, dt, g, w, withBeam) {
      if (l.state === 'idle') return;
      l.t += dt;
      const p = g.player;
      const tip = this.limbTip(l, p.x, p.y);
      // 接触伤害（每次出击仅一次）
      if (!l.hit && (l.state === 'thrust' || l.state === 'hold')) {
        if (Math.hypot(p.x - tip.x, p.y - tip.y) < w + p.radius) {
          l.hit = true;
          p.hurt(Math.round(22 * g.atkScale), g);
          const a = Math.atan2(p.y - tip.y, p.x - tip.x);
          p.x += Math.cos(a) * 26; p.y += Math.sin(a) * 26;
        }
      }
      if (l.state === 'thrust' && l.t >= 0.42) { l.state = 'hold'; l.t = 0; }
      else if (l.state === 'hold' && l.t >= 0.3) { l.state = 'retract'; l.t = 0; }
      else if (l.state === 'retract' && l.t >= 0.45) {
        l.state = 'idle'; l.t = 0;
        // 收回完成：从肢体锚点释放长线光束
        if (withBeam && l.beam) {
          l.beam = false;
          const a = Math.atan2(p.y - tip.ay, p.x - tip.ax);
          g.beams.push(new Beam(tip.ax, tip.ay, a, 1250, 30, Math.round(20 * g.atkScale), 0.7));
          SFX.warn();
        }
      }
    }
    render(ctx) {
      const p = window.game ? window.game.player : null;
      const drawLeg = (l, w) => {
        if (l.state === 'idle' && l.t <= 0) {
          // 收拢状态：贴在狗头侧
          const ax = this.x + l.ox * 0.25, ay = this.y + l.oy * 0.25;
          ctx.strokeStyle = '#14181f'; ctx.lineWidth = w + 4;
          ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ax, ay); ctx.stroke();
          ctx.strokeStyle = '#6f7683'; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ax, ay); ctx.stroke();
          return;
        }
        const tip = this.limbTip(l, p ? p.x : 0, p ? p.y : 0);
        ctx.strokeStyle = '#14181f'; ctx.lineWidth = w + 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tip.ax, tip.ay); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        ctx.strokeStyle = '#8d96a3'; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(tip.ax, tip.ay); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        // 爪子
        ctx.fillStyle = '#eef2f7';
        ctx.fillRect(tip.x - 8, tip.y - 8, 16, 16);
        ctx.fillStyle = '#14181f';
        ctx.fillRect(tip.x - 8, tip.y - 8, 16, 3);
      };
      // 腿画在狗头下层
      (this.phase === 1 ? this.legs : this.limbs).forEach(l => drawLeg(l, this.phase === 1 ? 12 : 11));
      // 狗头
      const ang = this.phase === 2 ? Math.sin(this.t * 10) * 0.12 : Math.sin(this.t * 1.5) * 0.06;
      drawSprite(ctx, Sprites.dogHeadL, this.x, this.y, 5.4, 5.4, ang, this.flash);
      // 阶段2：解体电弧
      if (this.phase === 2 && Math.floor(this.t * 8) % 2 === 0) {
        ctx.strokeStyle = 'rgba(127,231,255,0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a1 = rand(0, TAU), a2 = a1 + rand(1, 2);
          ctx.beginPath();
          ctx.moveTo(this.x + Math.cos(a1) * 40, this.y + Math.sin(a1) * 40);
          ctx.lineTo(this.x + Math.cos(a2) * 76, this.y + Math.sin(a2) * 76);
          ctx.stroke();
        }
      }
    }
  }

  /* ================ C3. 巨型野鸡（地面突击：撞毁障碍 + 直射/散射/追踪导弹） ================
   * 仅地面移动、巡逻范围小；身体与弹道都会炸毁山石障碍 */
  class GiantPheasant extends Boss {
    constructor(g) {
      super(g, 30, 96);
      this.bossName = '巨型野鸡王';
      this.title = '地面突击型';
      this.x = CFG.W + 120;
      this.y = CFG.GROUND_Y - 88;
      this.baseY = this.y;
      this.patrolMin = CFG.W * 0.52;
      this.patrolMax = CFG.W - 95;
      this.dir = -1;
      this.shotT = 1.3;
      this.scatterT = 5.6;
      this.missileT = 3.6;
      this.flameBreathT = 8.0;   // 喷火攻击计时器
      this.flameDur = 0;          // 喷火持续时间（>0 时正在喷火）
      this.deathCols = ['#c0562e', '#8f3a1c', '#ffd23b', '#fff'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 85 * dt;
        if (this.x <= this.patrolMax) { this.state = 'fight'; this.stateT = 0; }
      } else {
        // 地面小范围巡逻
        this.x += this.dir * 62 * dt;
        if (this.x < this.patrolMin) { this.x = this.patrolMin; this.dir = 1; }
        if (this.x > this.patrolMax) { this.x = this.patrolMax; this.dir = -1; }
      }
      this.y = this.baseY + Math.abs(Math.sin(this.t * 7)) * -6;   // 走路颠簸
      this.y = Math.min(this.y, CFG.GROUND_Y - 80);

      // 身体撞毁山石
      g.rocks.forEach(r => {
        if (!r.dead && r.contains(this.x, this.y, this.radius)) r.destroy(g);
      });

      if (this.state !== 'fight') return;

      // 鸡头直射高速炮弹（可炸毁障碍）
      this.shotT -= dt;
      if (this.shotT <= 0) {
        this.shotT = rand(1.3, 1.7);
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        g.bullets.push(new Bullet(this.x - 80, this.y - 16,
          Math.cos(a) * 500, Math.sin(a) * 500,
          { kind: 'orb', r: 27, dmg: 15 * g.atkScale, dmgScale: g.atkScale, life: 4, color: '#ffd23b', rockBreak: true, fireTrail: true }));
        SFX.enemyShoot();
        g.shake(3);
      }
      // 偶尔散射（6 向扇形）
      this.scatterT -= dt;
      if (this.scatterT <= 0) {
        this.scatterT = rand(5.5, 7.5);
        const base = Math.atan2(p.y - this.y, p.x - this.x);
        for (let i = -2; i <= 3; i++) {
          const a = base + i * 0.19;
          g.bullets.push(new Bullet(this.x - 72, this.y - 12,
            Math.cos(a) * 290, Math.sin(a) * 290,
            { kind: 'orb', r: 21, dmg: 12 * g.atkScale, dmgScale: g.atkScale, life: 5, color: '#ff9d2e', rockBreak: true, fireTrail: true }));
        }
        SFX.enemyShoot();
      }
      // 尾部喷出巨型追踪导弹（体积×3：发射后 4s 无敌，之后被子弹击中 3 次爆炸，被旋转剑击中 1 次必爆）
      this.missileT -= dt;
      if (this.missileT <= 0) {
        this.missileT = rand(3.4, 4.4);
        const m = new Bullet(this.x + 88, this.y - 52,
          160, -120,
          { kind: 'missile', r: 18, dmg: 18 * g.atkScale, dmgScale: g.atkScale, life: 12,
            homing: true, turnRate: 2.3, rockBreak: true, bscale: 3, hp: 3, invuln: 4 });
        m.onBreak = (gg, b) => gg.shellBlast(b.x, b.y, b.dmg);
        m.onExpire = (gg, b) => gg.shellBlast(b.x, b.y, b.dmg);
        g.bullets.push(m);
        SFX.dash();
      }
      // 持续喷火攻击：弧线大块面，两端细中间粗，红黄白粒子
      if (this.flameDur > 0) {
        // 正在喷火
        this.flameDur -= dt;
        const p = g.player;
        const baseA = Math.atan2(p.y - this.y, p.x - this.x);
        const mouthX = this.x - 70;
        const mouthY = this.y - 10;
        // 每帧喷射粒子：弧线分布，中间粗两端细
        const N = 6;
        for (let i = 0; i < N; i++) {
          const t = (i / (N - 1)) - 0.5;   // -0.5 ~ 0.5
          const a = baseA + t * 1.1;        // 扇形张角约 63°
          const weight = 1 - Math.abs(t) * 1.4;  // 中间粗（1.0）两端细（0.3）
          const sp = rand(650, 1050) * (0.6 + weight * 0.5);
          const px = mouthX + Math.cos(a) * rand(0, 20);
          const py = mouthY + Math.sin(a) * rand(0, 20);
          const colors = ['#ff2a0a', '#ff5a1a', '#ff9d2e', '#ffd23b', '#fff5d0'];
          const col = colors[Math.floor(Math.random() * colors.length)];
          const pr = rand(5, 12) * (0.5 + weight * 0.6);
          g.particles.push(new Particle(px, py,
            Math.cos(a) * sp, Math.sin(a) * sp,
            rand(0.5, 0.85), pr, col));
        }
        // 喷火伤害判定：弧形区域内对玩家造成伤害（覆盖至屏幕最左侧）
        const dx = p.x - mouthX, dy = p.y - mouthY;
        const dist = Math.hypot(dx, dy);
        if (dist < mouthX) {
          const ang = Math.atan2(dy, dx);
          let da = ang - baseA;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          if (Math.abs(da) < 0.55 && dist > 30) {
            p.hurt(Math.round(8 * g.atkScale), g);
          }
        }
        // 喷火结束时恢复
        if (this.flameDur <= 0) {
          this.flameDur = 0;
          this.flameBreathT = rand(7.0, 9.5);
        }
      } else {
        // 喷火充能计时
        this.flameBreathT -= dt;
        if (this.flameBreathT <= 0) {
          this.flameDur = 2.8;   // 持续喷火 2.8 秒
          g.toast('🔥 野鸡王喷火！', 1.5);
          g.shake(5);
        }
      }
    }
    render(ctx) {
      const bob = Math.abs(Math.sin(this.t * 7)) * -6;
      // 尾羽微摆（体型×2）
      drawSprite(ctx, Sprites.pheasantL, this.x, this.y + bob, 6.8, 6.8, Math.sin(this.t * 3) * 0.05, this.flash);
      // 冲冠怒气尘土
      if (Math.floor(this.t * 9) % 3 === 0) {
        ctx.fillStyle = 'rgba(140,110,70,0.5)';
        ctx.fillRect(this.x - this.radius + rand(-6, 6), CFG.GROUND_Y - 6, 10, 8);
      }
      // 喷火时嘴部光晕
      if (this.flameDur > 0) {
        const mx = this.x - 70, my = this.y - 10;
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 40);
        glow.addColorStop(0, 'rgba(255,220,100,0.8)');
        glow.addColorStop(0.5, 'rgba(255,90,30,0.4)');
        glow.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(mx, my, 40, 0, TAU); ctx.fill();
      }
    }
  }

  /* ================ D1. 祖国人（特殊机制：3 束激光扫射 / 落地冲刺 / 慢速旋转激光） ================
   * 激光遇障碍炸碎山石；旋转激光整局最多 3 次，自转速度很慢 */
  class Homelander extends Boss {
    constructor(g) {
      super(g, 28, 80);
      this.bossName = '祖国人';
      this.title = '特殊机制型';
      this.hoverX = 660;
      this.atkT = 1.8;
      this.spinUsed = 0;      // 旋转激光使用次数（上限 3）
      this.rotA = 0;
      this.spinFire = 0;
      this.deathCols = ['#e8c34a', '#2f6fd0', '#e0453a', '#fff'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 100 * dt;
        this.y += Math.sin(this.t * 2) * 30 * dt;
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }

      if (this.state === 'fight') {
        // 空中悬停
        this.baseY += (clamp(p.y - 50, 120, CFG.GROUND_Y - 170) - this.baseY) * dt * 1.4;
        this.y = this.baseY + Math.sin(this.t * 2.2) * 22;
        this.x = this.hoverX + Math.sin(this.t * 0.9) * 36;
        this.atkT -= dt;
        if (this.atkT <= 0) {
          const roll = Math.random();
          if (this.spinUsed < 3 && roll < 0.26) {
            // 慢速旋转激光（最多 3 次）
            this.state = 'spin'; this.stateT = 0;
            this.spinUsed++;
            this.rotA = Math.atan2(p.y - this.y, p.x - this.x);
            this.spinFire = 0.25;
            SFX.phaseRise();   // 危险招式提示：旋转扫射蓄力
            g.toast(`祖国人开始旋转扫射！（${this.spinUsed}/3）`, 1.8);
          } else if (roll < 0.60) {
            // 落地冲刺
            this.state = 'land'; this.stateT = 0;
          } else {
            // 三束扇形激光扫射
            this.fireBeamSweep(g, p);
            this.state = 'beam3'; this.stateT = 0;
          }
        }
      }
      else if (this.state === 'beam3') {
        this.x = this.hoverX + Math.sin(this.t * 0.9) * 36;
        if (this.stateT > 2.0) { this.state = 'fight'; this.stateT = 0; this.atkT = rand(1.4, 2.2); }
      }
      else if (this.state === 'land') {
        const gy = CFG.GROUND_Y - 90;
        this.y += (gy - this.y) * dt * 3.2;
        this.x += (this.hoverX + 40 - this.x) * dt * 2;
        if (this.stateT > 0.85) {
          this.state = 'dash'; this.stateT = 0;
          const ty = clamp(p.y, CFG.GROUND_Y - 110, CFG.GROUND_Y - 50);
          const a = Math.atan2(ty - this.y, p.x - this.x);
          this.dashVx = Math.cos(a) * 680; this.dashVy = Math.sin(a) * 320;
          SFX.dash(); g.shake(8);
        }
      }
      else if (this.state === 'dash') {
        // 贴地快速冲刺
        this.x += this.dashVx * dt; this.y += this.dashVy * dt;
        this.y = clamp(this.y, CFG.GROUND_Y - 120, CFG.GROUND_Y - 50);
        g.particles.push(new Particle(this.x + 24, this.y, rand(-80, 0), rand(-50, 20), 0.35, 5, '#ffd23b'));
        if (this.stateT > 0.95 || this.x < 80) { this.state = 'retreat'; this.stateT = 0; }
      }
      else if (this.state === 'retreat') {
        this.x += (this.hoverX - this.x) * dt * 2.4;
        this.baseY += (clamp(p.y - 50, 120, CFG.GROUND_Y - 170) - this.baseY) * dt * 2.4;
        this.y += (this.baseY - this.y) * dt * 2.4;
        if (this.stateT > 1.1) { this.state = 'fight'; this.stateT = 0; this.atkT = rand(1.6, 2.4); }
      }
      else if (this.state === 'spin') {
        // 整组激光锁定玩家方向 + 图案自身旋转，双束对射形成旋转十字
        this.spinOff -= dt * 2.0;
        const aimA = Math.atan2(p.y - this.y, p.x - this.x);
        this.x = this.hoverX + Math.sin(this.t * 0.7) * 30;
        this.y += Math.sin(this.t * 1.8) * 16 * dt;
        this.y = clamp(this.y, 140, CFG.GROUND_Y - 190);
        this.spinFire -= dt;
        if (this.spinFire <= 0) {
          this.spinFire = 0.42;
          for (let k = 0; k < 2; k++) {
            const a = aimA + this.spinOff + k * Math.PI;
            g.beams.push(new Beam(this.x, this.y, a, 1400, 13, Math.round(15 * g.atkScale), 0.72, true));
          }
          SFX.zap();
        }
        if (this.stateT > 5.5) { this.state = 'fight'; this.stateT = 0; this.atkT = rand(1.8, 2.6); }
      }
    }
    fireBeamSweep(g, p) {
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = -1; i <= 1; i++) {
        g.beams.push(new Beam(this.x - 24, this.y, base + i * 0.26, 1400, 15, Math.round(17 * g.atkScale), 0.8, true));
      }
      SFX.warn(); g.shake(4);
    }
    render(ctx) {
      const ang = this.state === 'spin' ? this.spinOff : Math.sin(this.t * 2) * 0.06;
      drawSprite(ctx, Sprites.homelanderL, this.x, this.y, 6.2, 6.2, ang, this.flash);
      // 旋转激光蓄力：双眼红光
      if (this.state === 'spin') {
        ctx.fillStyle = Math.floor(this.t * 10) % 2 ? '#ff3b3b' : '#ffd23b';
        ctx.fillRect(this.x - 30, this.y - 14, 8, 5);
        ctx.fillRect(this.x - 30, this.y + 9, 8, 5);
      }
    }
  }

  /* ================ D2. 大王（两阶段：西装巨人召唤/双手射击/漂浮弹 → 半血碎裂变身巨头） ================ */
  class BossMan extends Boss {
    constructor(g) {
      super(g, 32, 120);
      this.bossName = '大王';
      this.title = '特殊机制型';
      this.hoverX = CFG.W - 190;
      this.phase = 1;
      this.lockHp = false;
      this.actT = 2.4;
      this.actIdx = 0;
      this.summoned = false;
      // 双手（锚点相对身体）
      this.hands = [
        { ox: -40, oy: -80, px: 0, py: 0, tx: 0, ty: 0, state: 'idle', t: 0, fireT: 0 },
        { ox: -40, oy: 80, px: 0, py: 0, tx: 0, ty: 0, state: 'idle', t: 0, fireT: 0 }
      ];
      this.ringT = 2.0;
      this.eyeT = 3.0;
      this.deathCols = ['#2b2f3a', '#e8eef7', '#ffd23b', '#e0453a'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 90 * dt;
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }

      // 半血变身（阶段1）：锁血碎裂
      if (this.phase === 1 && this.state !== 'transform' && this.hp <= this.maxHp * 0.5) {
        this.state = 'transform'; this.stateT = 0;
        this.lockHp = true;
        this.hp = Math.ceil(this.maxHp * 0.5);
        this.hands.forEach(h => { h.state = 'idle'; h.t = 0; });
        g.shake(16); g.flashT = 0.4; g.flashColor = '#fff';
        SFX.bossDarkTransform();   // 黑暗变身：痛苦嘶吼悲号 + 次声震动 + 能量爆裂（3秒）
        g.toast('大王的身体碎裂了！', 2.2);
        burst(g, this.x, this.y, 44, ['#8d96a3', '#2b2f3a', '#fff', '#ffd23b'], 320, 7, 0.9, 150);
      }

      if (this.state === 'transform') {
        for (let i = 0; i < 3; i++) {
          g.particles.push(new Particle(this.x + rand(-80, 80), this.y + rand(-90, 90),
            rand(-130, 130), rand(-170, 30), 0.7, rand(4, 8),
            ['#8d96a3', '#2b2f3a', '#ffd23b'][randi(0, 2)]));
        }
        this.x += (CFG.W * 0.74 - this.x) * dt;
        this.y += (CFG.H * 0.44 - this.y) * dt;
        if (this.stateT > 2.4) {
          this.phase = 2; this.state = 'fight'; this.stateT = 0;
          this.lockHp = false;
          this.ringT = 1.2; this.eyeT = 2.6;
          g.shake(14);
          burst(g, this.x, this.y, 34, ['#fff', '#ffd23b', '#e0453a'], 300, 7, 0.8, 150);
        }
        return;
      }

      if (this.phase === 1) {
        if (this.state === 'fight') {
          // 屏幕右侧悬停
          this.baseY += (clamp(p.y - 40, 140, CFG.GROUND_Y - 200) - this.baseY) * dt * 1.2;
          this.y = this.baseY + Math.sin(this.t * 1.8) * 16;
          this.x += (this.hoverX - this.x) * dt * 1.6;
          // 开局召唤 5 个地面类敌人
          if (!this.summoned) {
            this.summoned = true;
            for (let i = 0; i < 5; i++) {
              setTimeout(() => { if (g.state === 'playing') g.spawnEnemy(i % 2 ? 'archer' : 'cannoneer'); }, 400 + i * 350);
            }
            g.toast('大王召唤了部下！', 2);
          }
          this.actT -= dt;
          if (this.actT <= 0) {
            if (this.actIdx % 2 === 0) {
              this.launchFloaters(g);
              this.actT = rand(3.4, 4.2);
            } else {
              this.state = 'toCenter'; this.stateT = 0; this.actT = 0;
            }
            this.actIdx++;
          }
        }
        else if (this.state === 'toCenter') {
          // 移动到屏幕中心
          const cx = CFG.W * 0.52, cy = CFG.H * 0.42;
          this.x += (cx - this.x) * dt * 2.2;
          this.y += (cy - this.y) * dt * 2.2;
          if (this.stateT > 0.9) {
            this.state = 'handsOut'; this.stateT = 0;
            this.hands.forEach((h, i) => {
              h.state = 'out'; h.t = 0; h.fireT = 0.35;
              h.tx = i === 0 ? CFG.W * 0.16 : CFG.W * 0.92;
              h.ty = clamp(this.y + (i === 0 ? -100 : 100), 120, CFG.GROUND_Y - 80);
            });
          }
        }
        else if (this.state === 'handsOut') {
          this.stepHands(dt, g);
          if (this.stateT > 2.6) { this.state = 'handsBack'; this.stateT = 0; this.hands.forEach(h => h.t = 0); }
        }
        else if (this.state === 'handsBack') {
          this.stepHands(dt, g);
          // 射击后回到屏幕右侧
          this.x += (this.hoverX - this.x) * dt * 2.4;
          this.baseY += (clamp(p.y - 40, 140, CFG.GROUND_Y - 200) - this.baseY) * dt * 2;
          this.y += (this.baseY - this.y) * dt * 2;
          if (this.stateT > 1.0) {
            this.state = 'fight'; this.stateT = 0; this.actT = rand(2.4, 3.2);
            this.hands.forEach(h => { h.state = 'idle'; h.t = 0; });
          }
        }
      } else {
        // 阶段2：巨头在屏幕靠右中心区域漂浮
        const cx = CFG.W * 0.74, cy = CFG.H * 0.44;
        this.x += (cx - this.x) * dt * 1.4;
        this.y = cy + Math.sin(this.t * 1.4) * 26;
        // 环形弹幕
        this.ringT -= dt;
        if (this.ringT <= 0) {
          this.ringT = rand(2.4, 3.0);
          const n = 16;
          for (let i = 0; i < n; i++) {
            const a = this.t * 0.8 + (TAU / n) * i;
            g.bullets.push(new Bullet(this.x, this.y,
              Math.cos(a) * 175, Math.sin(a) * 175,
              { kind: 'axe', r: 7, dmg: 13 * g.atkScale, dmgScale: g.atkScale, life: 7, color: '#ff5252', spinRate: 12 }));
          }
          SFX.enemyShoot(); g.shake(3);
        }
        // 眼珠伸长攻击：两条激光
        this.eyeT -= dt;
        if (this.eyeT <= 0) {
          this.eyeT = rand(3.2, 4.0);
          const base = Math.atan2(p.y - this.y, p.x - this.x);
          g.beams.push(new Beam(this.x - 70, this.y - 22, base - 0.12, 1300, 16, Math.round(18 * g.atkScale), 0.85));
          g.beams.push(new Beam(this.x - 70, this.y + 22, base + 0.12, 1300, 16, Math.round(18 * g.atkScale), 0.85));
          SFX.warn();
        }
      }
    }
    /** 双手飞出/收回：就位后向左右连射弹幕 */
    stepHands(dt, g) {
      this.hands.forEach((h, i) => {
        if (h.state === 'idle') return;
        h.t += dt;
        const ax = this.x + h.ox, ay = this.y + h.oy;
        const out = h.state === 'out';
        const k = out ? Math.min(1, h.t / 0.4) : Math.max(0, 1 - h.t / 0.4);
        h.px = ax + (h.tx - ax) * k;
        h.py = ay + (h.ty - ay) * k;
        if (out && k >= 1) {
          h.fireT -= dt;
          if (h.fireT <= 0) {
            h.fireT = 0.45;
            const dir = i === 0 ? Math.PI : 0;   // 左手向左、右手向右
            for (let s = -1; s <= 1; s++) {
              g.bullets.push(new Bullet(h.px, h.py,
                Math.cos(dir + s * 0.18) * 300, Math.sin(dir + s * 0.18) * 300,
                { kind: 'axe', r: 8, dmg: 14 * g.atkScale, dmgScale: g.atkScale, life: 5, color: '#ffd23b', spinRate: 12 }));
            }
            SFX.enemyShoot();
          }
        }
      });
    }
    /** 五颗巨大漂浮弹：缓慢追踪玩家，被击中 6 次爆炸 */
    launchFloaters(g) {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.5;
        const b = new Bullet(this.x - 50, this.y - 30,
          Math.cos(a) * 60, Math.sin(a) * 60,
          { kind: 'axe', r: 18, dmg: 18 * g.atkScale, dmgScale: g.atkScale, life: 9,
            hp: 6, homing: true, turnRate: 0.55, color: '#e0453a', spinRate: 7 });
        b.onBreak = (gg, bb) => gg.shellBlast(bb.x, bb.y, bb.dmg);
        b.onExpire = (gg, bb) => gg.shellBlast(bb.x, bb.y, bb.dmg);
        g.bullets.push(b);
      }
      SFX.warn();
    }
    render(ctx) {
      if (this.phase === 2) {
        // 变身后巨头（占据近半屏）
        const pulse = 1 + Math.sin(this.t * 4) * 0.02;
        drawSprite(ctx, Sprites.bossHeadL, this.x, this.y, 13 * pulse, 13 * pulse, Math.sin(this.t * 1.4) * 0.05, this.flash);
        return;
      }
      if (this.state !== 'transform') {
        // 西装身体（占据近半屏）
        drawSprite(ctx, Sprites.bossManL, this.x, this.y, 9.0, 9.0, Math.sin(this.t * 1.6) * 0.03, this.flash);
        // 双手：袖管 + 拳头
        this.hands.forEach(h => {
          if (h.state === 'idle') return;
          const ax = this.x + h.ox, ay = this.y + h.oy;
          ctx.strokeStyle = '#1c1f27'; ctx.lineWidth = 20; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(h.px, h.py); ctx.stroke();
          ctx.fillStyle = '#101018'; ctx.fillRect(h.px - 14, h.py - 14, 28, 28);
          ctx.fillStyle = '#e8eef7'; ctx.fillRect(h.px - 11, h.py - 11, 22, 22);
          ctx.fillStyle = '#1c1f27'; ctx.fillRect(h.px - 11, h.py - 11, 22, 5);
        });
      } else {
        // 碎裂中：身体闪烁崩坏
        drawSprite(ctx, Sprites.bossManL, this.x, this.y, 9.0, 9.0, 0, Math.floor(this.t * 14) % 2 ? 0.6 : this.flash);
      }
    }
  }

  /* ================ D3. 怪客（跳动光头巨汉：S 型冲刺 / 飞空横身扫射红苹果 / 巨型苹果 / 召唤雷公） ================ */
  class Stranger extends Boss {
    constructor(g) {
      super(g, 30, 100);
      this.bossName = '怪客';
      this.title = '特殊机制型';
      this.hoverX = CFG.W - 170;
      this.actT = 1.8;
      this.actIdx = 0;
      this.knifeFireT = 0;
      this.sy = 0;
      this.bodyAngle = 0;        // 飞空时身体横过来（-π/2：头朝左、面朝下方）
      this.deathCols = ['#d9b38c', '#8d96a3', '#e0453a', '#ffd23b'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;
      // 飞空状态身体横过来，其余状态回正
      const airState = (this.state === 'toTop' || this.state === 'knives');
      this.bodyAngle += ((airState ? -Math.PI / 2 : 0) - this.bodyAngle) * Math.min(1, dt * 5);

      if (this.state === 'enter') {
        this.x -= 150 * dt;
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }

      if (this.state === 'fight') {
        this.baseY += (clamp(p.y - 30, 140, CFG.GROUND_Y - 190) - this.baseY) * dt * 2.0;
        this.y = this.baseY;
        this.x += (this.hoverX - this.x) * dt * 2.4;
        this.actT -= dt;
        if (this.actT <= 0) {
          const act = this.actIdx % 4;
          this.actIdx++;
          if (act === 0) {
            // S 型高速冲刺
            this.state = 'sdash'; this.stateT = 0;
            this.sy = this.y;
            SFX.dash(); g.shake(6);
          } else if (act === 1) {
            this.state = 'toTop'; this.stateT = 0;
          } else if (act === 2) {
            this.state = 'cross'; this.stateT = 0;
          } else {
            // 召唤 3 只雷公小怪
            for (let i = 0; i < 3; i++) {
              setTimeout(() => { if (g.state === 'playing') g.spawnEnemy('leigong'); }, 300 + i * 320);
            }
            g.toast('怪客召唤了雷公小怪！', 2);
            this.actT = rand(2.8, 3.6);
          }
        }
      }
      else if (this.state === 'sdash') {
        // S 型路线：x 高速左冲，y 正弦摆动
        this.x -= 820 * dt;
        this.y = clamp(this.sy + Math.sin(this.stateT * 11) * 140, 100, CFG.GROUND_Y - 100);
        g.particles.push(new Particle(this.x + 30, this.y, rand(-90, 0), rand(-50, 50), 0.3, 6, '#ffd23b'));
        if (this.stateT > 1.4 || this.x < 110) { this.state = 'back'; this.stateT = 0; }
      }
      else if (this.state === 'toTop') {
        // 飞到玩家上方空域
        const tx = clamp(p.x, 130, CFG.W - 130), ty = 130;
        this.x += (tx - this.x) * dt * 3.4;
        this.y += (ty - this.y) * dt * 3.4;
        if (this.stateT > 0.6) { this.state = 'knives'; this.stateT = 0; this.knifeFireT = 0.2; SFX.bossCharge(); }
      }
      else if (this.state === 'knives') {
        // 横身飞空：身体横过来，持续 4s 向玩家逼近（保持空中距离）并向下散射红苹果
        const tx = clamp(p.x, 100, CFG.W - 100);
        const ty = clamp(p.y - 180, 90, CFG.GROUND_Y - 250);
        this.x += (tx - this.x) * dt * 1.7;
        this.y += (ty - this.y) * dt * 1.7;
        this.knifeFireT -= dt;
        if (this.knifeFireT <= 0) {
          this.knifeFireT = 0.2;
          for (let i = -4; i <= 4; i++) {
            const a = Math.PI / 2 + i * 0.16;
            g.bullets.push(new Bullet(this.x, this.y + 50,
              Math.cos(a) * 360, Math.sin(a) * 360,
              { kind: 'apple', r: 9, grav: 950, dmg: 12 * g.atkScale, dmgScale: g.atkScale, life: 5.5 }));
          }
          SFX.enemyShoot();
        }
        if (this.stateT > 4) { this.state = 'back'; this.stateT = 0; }
      }
      else if (this.state === 'cross') {
        // 回到屏幕右侧
        this.x += (this.hoverX - this.x) * dt * 3.4;
        this.baseY += (clamp(p.y - 30, 140, CFG.GROUND_Y - 190) - this.baseY) * dt * 2.6;
        this.y += (this.baseY - this.y) * dt * 2.6;
        if (this.stateT > 0.7) {
          this.state = 'back'; this.stateT = 0;
          // 向玩家抛出巨型红苹果（抛物线飞行，触地向上弹起）
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          g.bullets.push(new Bullet(this.x - 60, this.y,
            Math.cos(a) * 230, Math.sin(a) * 230,
            { kind: 'apple', r: 40, grav: 820, dmg: 22 * g.atkScale, dmgScale: g.atkScale, life: 7 }));
          SFX.dash(); g.shake(6);
        }
      }
      else if (this.state === 'back') {
        this.x += (this.hoverX - this.x) * dt * 3.2;
        this.baseY += (clamp(p.y - 30, 140, CFG.GROUND_Y - 190) - this.baseY) * dt * 3.2;
        this.y += (this.baseY - this.y) * dt * 3.2;
        if (this.stateT > 0.8) { this.state = 'fight'; this.stateT = 0; this.actT = rand(1.8, 2.6); }
      }
    }
    render(ctx) {
      // 持续跳动；飞空时身体横过来（bodyAngle → -π/2）
      const bob = Math.abs(Math.sin(this.t * 5)) * -12;
      drawSprite(ctx, Sprites.strangerL, this.x, this.y + bob, 8.5, 8.5, this.bodyAngle + Math.sin(this.t * 3) * 0.04, this.flash);
    }
  }

  /* ================ C1. 蛙哥（地面巨兽） ================
   * 巨大金绿肥硕青蛙（高占屏一半）：弧形跳跃接近 / 蓄力直线飞跃（高额伤害）/
   * 吐舌把玩家拉到面前 / 玩家近身时快速爪击 */
  class FrogKing extends Boss {
    constructor(g) {
      super(g, 20, 105);
      this.bossName = '蛙哥';
      this.title = '地面巨兽型';
      this.x = CFG.W + 130;
      this.groundY = CFG.GROUND_Y - 78;
      this.y = this.groundY;
      this.vy = 0; this.vx = 0;
      this.onGround = true;
      this.hopT = 1.2;
      this.skillT = 2.2;
      this.clawCd = 0; this.tongueCd = 3.5; this.chargeCd = 6;
      this.tongue = null;          // { t, phase:'out'|'hold'|'back', len, max, ang, grabbed }
      this.grabT = 0;              // 玩家被拉拽剩余时间
      this.contactDmgBase = 20;
      this.deathCols = ['#8fbf3f', '#6b9428', '#f2edbc', '#fff'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;
      this.clawCd = Math.max(0, this.clawCd - dt);
      this.tongueCd = Math.max(0, this.tongueCd - dt);
      this.chargeCd = Math.max(0, this.chargeCd - dt);
      // 撞毁山石
      g.rocks.forEach(r => { if (!r.dead && r.contains(this.x, this.y, this.radius)) r.destroy(g); });

      if (this.state === 'enter') {
        this.x -= 110 * dt;
        if (this.x <= CFG.W - 200) { this.state = 'fight'; this.stateT = 0; }
        return;
      }

      const dist = Math.hypot(p.x - this.x, p.y - this.y);

      /* ---- 状态机 ---- */
      if (this.state === 'fight') {
        // 落地判定 + 弧形跳跃移动
        if (this.onGround) {
          this.vx *= 0.86;
          this.hopT -= dt;
          if (this.hopT <= 0) {
            // 弧形大跳：跳得更高更远，跨屏幕追击
            this.hopT = rand(1.05, 1.5);
            this.vy = -rand(620, 720);
            this.vx = clamp((p.x - this.x) * 1.25, -440, 440);
            this.onGround = false;
            SFX.dash();
          }
          // 技能选择
          this.skillT -= dt;
          if (this.skillT <= 0) {
            this.skillT = 0.25;
            if (dist < 175 && this.clawCd <= 0) { this.state = 'clawWind'; this.stateT = 0; }
            else if (this.tongueCd <= 0 && dist > 140) { this.state = 'tongueWind'; this.stateT = 0; }
            else if (this.chargeCd <= 0 && dist > 160) { this.state = 'chargeWind'; this.stateT = 0; }
          }
        } else {
          // 空中：重力弧线
          this.vy += 1350 * dt;
          this.y += this.vy * dt;
          this.x += this.vx * dt;
          this.x = clamp(this.x, 90, CFG.W - 70);
          if (this.y >= this.groundY) {   // 落地
            this.y = this.groundY; this.vy = 0; this.onGround = true;
            g.shake(4);
            burst(g, this.x, this.y + 40, 8, ['#caa06a', '#8a5a2b', '#d8b98a'], 160, 4, 0.35);
          }
        }
      }
      else if (this.state === 'clawWind') {
        // 抬爪蓄力 0.32s
        if (this.stateT > 0.32) { this.state = 'clawHit'; this.stateT = 0; g.shake(6); SFX.hit(); }
      }
      else if (this.state === 'clawHit') {
        // 快速爪击：前方扇形判定
        if (dist < 190) {
          const da = Math.atan2(p.y - this.y, p.x - this.x) - Math.PI;   // 面朝左
          if (Math.abs(da) < 1.2) p.hurt(Math.round(16 * g.atkScale), g);
        }
        burst(g, this.x - 90, this.y - 10, 6, ['#fff', '#c8d96a'], 220, 4, 0.25);
        this.state = 'fight'; this.stateT = 0; this.clawCd = 3.2;
      }
      else if (this.state === 'tongueWind') {
        // 张嘴蓄力 0.3s，锁定发射角度
        if (this.stateT > 0.3) {
          this.state = 'tongueOut'; this.stateT = 0;
          // 初射点为嘴部（模型靠左的红色口腔）：精灵 frogL 中红口腔位于 (5,23)，6.5x 居中锚点换算
          const mx = this.x - 150, my = this.y + 6;
          this.tongueAng = Math.atan2(p.y - my, p.x - mx);
          // 舌头跨越整个屏幕
          this.tongue = { t: 0, len: 0, max: Math.hypot(CFG.W, CFG.H) * 1.1, phase: 'out', grabbed: false };
          SFX.tongueShot();
        }
      }
      else if (this.state === 'tongueOut' && this.tongue) {
        const tg = this.tongue;
        tg.t += dt;
        const mouthX = this.x - 150, mouthY = this.y + 6;   // 初射点：嘴部红色口腔
        if (tg.phase === 'out') {
          tg.len = Math.min(tg.max, tg.len + 1500 * dt);
          // 舌尖 + 整条舌身判定：玩家被舌线扫到即被卷住（舌头加宽4倍，判定同步加宽）
          const tipX = mouthX + Math.cos(this.tongueAng) * tg.len;
          const tipY = mouthY + Math.sin(this.tongueAng) * tg.len;
          if (!tg.grabbed && Lightning.distSeg(p.x, p.y, mouthX, mouthY, tipX, tipY) < 72) {
            tg.grabbed = true; tg.phase = 'back'; tg.t = 0;
            p.hurt(Math.round(8 * g.atkScale), g);
            g.toast('被蛙哥卷住了！', 1.2);
            SFX.grab();
          }
          if (tg.len >= tg.max) { tg.phase = 'hold'; tg.t = 0; }
        } else if (tg.phase === 'hold') {
          if (tg.t > 0.18) { tg.phase = 'back'; tg.t = 0; }
        } else {
          tg.len = Math.max(0, tg.len - 1300 * dt);
          // 收舌时若已卷住，把玩家拉到面前
          if (tg.grabbed) {
            const tipX = mouthX + Math.cos(this.tongueAng) * 40;
            const tipY = mouthY + Math.sin(this.tongueAng) * 40;
            p.x += (tipX - p.x) * Math.min(1, dt * 7);
            p.y += (tipY - p.y) * Math.min(1, dt * 7);
          }
          if (tg.len <= 0) {
            this.tongue = null;
            this.state = 'fight'; this.stateT = 0;
            this.tongueCd = rand(4.5, 6);
          }
        }
      }
      else if (this.state === 'chargeWind') {
        // 压扁蓄力 0.75s，锁定玩家当前位置
        if (this.stateT > 0.15 && this.stateT - dt <= 0.15) this.lockAim(p);
        if (this.stateT > 0.75) {
          this.state = 'chargeAir'; this.stateT = 0;
          this.onGround = false;
          const dx = this.aim.x - this.x, dy = this.aim.y - this.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          this.vx = dx / d * 660; this.vy = dy / d * 660;
          this.contactDmg = Math.round(28 * g.atkScale);   // 蓄力冲撞高额伤害
          g.shake(6); SFX.charge();
          g.toast('蛙哥猛冲！', 1.2);
        }
      }
      else if (this.state === 'chargeAir') {
        this.vy += 500 * dt;
        this.x += this.vx * dt; this.y += this.vy * dt;
        // 撞墙 / 落地 → 硬着陆
        if (this.x < 110 || this.x > CFG.W - 80 || this.y >= this.groundY) {
          this.x = clamp(this.x, 110, CFG.W - 80);
          this.y = Math.min(this.y, this.groundY);
          this.vy = 0; this.onGround = true;
          this.contactDmg = this.contactDmgBase;
          this.state = 'fight'; this.stateT = 0;
          this.hopT = rand(0.9, 1.3); this.chargeCd = rand(7, 9);
          g.shake(10);
          burst(g, this.x, this.y + 30, 14, ['#caa06a', '#8a5a2b', '#fff'], 240, 5, 0.45);
        }
      }
    }
    lockAim(p) { this.aim = { x: p.x, y: p.y }; }
    render(ctx) {
      // 蓄力冲撞预警线
      if (this.state === 'chargeWind' && this.aim) {
        const on = Math.floor(this.t * 12) % 2 === 0;
        if (on) {
          ctx.save();
          ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
          ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.aim.x, this.aim.y); ctx.stroke();
          ctx.restore();
        }
      }
      // 身体（压扁表现蓄力/腾空拉伸）
      let sy = 1;
      if (this.state === 'chargeWind') sy = 0.78 + Math.sin(this.stateT * 22) * 0.05;
      else if (!this.onGround) sy = 1.08;
      const w = 6.5, h = 6.5 * sy;
      drawSprite(ctx, Sprites.frogL, this.x, this.y + (6.5 * 40 - h * 40) / 2, w, h, 0, this.flash);
      // 舌头（加宽4倍：线宽12→48、舌尖13→52；初射点为模型靠左的红色口腔）
      if (this.tongue) {
        const tg = this.tongue;
        const mouthX = this.x - 150, mouthY = this.y + 6;
        const tipX = mouthX + Math.cos(this.tongueAng) * tg.len;
        const tipY = mouthY + Math.sin(this.tongueAng) * tg.len;
        ctx.strokeStyle = '#ff7ba0'; ctx.lineWidth = 48; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(mouthX, mouthY); ctx.lineTo(tipX, tipY); ctx.stroke();
        ctx.fillStyle = '#ff5d8f';
        ctx.beginPath(); ctx.arc(tipX, tipY, 52, 0, TAU); ctx.fill();
      }
      // 爪击挥影
      if (this.state === 'clawHit') {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 6;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(this.x - 40, this.y, 80 + i * 22, Math.PI * 0.75, Math.PI * 1.25);
          ctx.stroke();
        }
      }
    }
  }

  /* ================ C2. 鹤仙（特殊机制） ================
   * 巨大高瘦仙鹤（高占屏 60%）：追魂羽针（3s 无敌可击毁追踪弹）/ 鹤鸣震荡（多层环形声波）/
   * 天空俯冲（落点预警+冲击波）/ 旋羽领域（环绕羽风暴）/ 万羽天葬（半血终极：漫天落羽） */
  class CraneSage extends Boss {
    constructor(g) {
      super(g, 20, 88);
      this.bossName = '鹤仙';
      this.title = '特殊机制型';
      this.hoverX = 660;
      this.skillT = 2.6;
      this.seq = 0;                 // 技能序列：羽针→鹤鸣→俯冲→旋羽（→天葬）
      this.needles = [];            // 已发射羽针（3.2s 后提速）
      this.whirlOrbs = [];
      this.fallMarks = [];          // 万羽天葬落点预警 { x, t }
      this.waveIdx = 0; this.waveT = 0;
      this.fallRound = 0; this.fallT = 0;
      this.deathCols = ['#f4f6f2', '#c9d2cc', '#d43f2f', '#fff'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 150 * dt;
        this.y = this.baseY + Math.sin(this.t * 2) * 30;
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }

      // 羽针 3.2s 未被击毁 → 高速冲刺
      this.needles = this.needles.filter(n => !n.b.dead);
      for (const n of this.needles) {
        n.t -= dt;
        if (n.t <= 0 && !n.boosted) {
          n.boosted = true;
          n.b.vx *= 1.45; n.b.vy *= 1.45; n.b.turnRate = 2.6;
          burst(g, n.b.x, n.b.y, 5, ['#fff', '#c9d2cc'], 140, 3, 0.25);
        }
      }
      // 万羽天葬落点预警计时
      this.fallMarks = this.fallMarks.filter(m => {
        m.t -= dt;
        if (m.t <= 0) {
          g.bullets.push(new Bullet(m.x, -30, 0, 430,
            { kind: 'feather', r: 9, dmg: 12 * g.atkScale, life: 4, color: '#f4f6f2' }));
          return false;
        }
        return true;
      });

      if (this.state === 'fight') {
        // 缓慢游弋
        this.baseY += (clamp(p.y + 20, 110, CFG.GROUND_Y - 140) - this.baseY) * dt * 1.1;
        this.y = this.baseY + Math.sin(this.t * 1.7) * 42;
        this.x = this.hoverX + Math.sin(this.t * 0.9) * 66;
        this.skillT -= dt;
        if (this.skillT <= 0) {
          const order = ['needles', 'cry', 'dive', 'whirl'];
          const next = order[this.seq % order.length];
          this.seq++;
          this.stateT = 0;
          // 半血后每 3 个技能插播一次万羽天葬，节奏加快
          if (this.hp <= this.maxHp * 0.5 && this.seq % 3 === 0) {
            this.state = 'burialUp';
            this.skillT = rand(3.0, 3.8);
            return;
          }
          this.skillT = rand(3.6, 4.6);
          this.state = next;
          if (next === 'cry') { this.waveIdx = 0; this.waveT = 0.7; g.toast('鹤鸣震荡！', 1.2); SFX.sweep(); }
          if (next === 'needles') { this.needleN = 0; this.needleT = 0.1; }
          if (next === 'dive') { g.toast('鹤仙入天！', 1.2); }
          if (next === 'whirl') { this.spawnWhirl(g); g.toast('旋羽领域！', 1.2); }
        }
      }
      else if (this.state === 'needles') {
        this.hoverDrift(dt, p);
        this.needleT -= dt;
        if (this.needleT <= 0 && this.needleN < 5) {
          this.needleN++; this.needleT = 0.36;
          const a = Math.atan2(p.y - this.y, p.x - this.x) + rand(-0.3, 0.3);
          const b = new Bullet(this.x - 20, this.y - 10,
            Math.cos(a) * 350, Math.sin(a) * 350,
            { kind: 'feather', r: 7, dmg: 13 * g.atkScale, life: 7, color: '#fff',
              homing: true, turnRate: 1.0, hp: 1, invuln: 3 });
          this.needles.push({ b, t: 3.2, boosted: false });
          g.bullets.push(b);
          SFX.enemyShoot();
        }
        if (this.needleN >= 5 && this.stateT > 2.0) { this.state = 'fight'; this.stateT = 0; }
      }
      else if (this.state === 'cry') {
        this.hoverDrift(dt, p, 0.4);
        this.waveT -= dt;
        if (this.waveT <= 0 && this.waveIdx < 3) {
          // 三层声波圈：速度不同均可扩散至全屏；密度疏密交替（密圈 24 发 / 疏圈 14 发）
          const speeds = [150, 210, 280];
          const counts = [24, 14, 24];
          const sp = speeds[this.waveIdx];
          const n = counts[this.waveIdx];
          for (let i = 0; i < n; i++) {
            const a = i * TAU / n + this.waveIdx * 0.21;
            g.bullets.push(new Bullet(this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp,
              { kind: 'wave', r: this.waveIdx === 1 ? 15 : 13, dmg: 11 * g.atkScale, life: 7, color: '#38bdf8' }));
          }
          this.waveIdx++; this.waveT = 0.55;
          g.shake(3); SFX.enemyShoot();
        }
        if (this.waveIdx >= 3 && this.stateT > 3.2) { this.state = 'fight'; this.stateT = 0; }
      }
      else if (this.state === 'dive') {
        // dive 阶段内部再分：up → aim → fall → blast
        if (!this.phase || this.phase === 'up') {
          this.phase = 'up';
          this.x += (this.hoverX - this.x) * dt * 2;
          this.y += (-70 - this.y) * dt * 2.4;
          if (this.stateT > 0.9 && this.y < -20) { this.phase = 'aim'; this.stateT = 0; this.aim = { x: p.x }; }
        } else if (this.phase === 'aim') {
          // 顶部悬停锁定，落点预警
          this.aim.x += (p.x - this.aim.x) * dt * 2.0;
          if (this.stateT > 0.85) {
            this.phase = 'fall';
            this.x = this.aim.x; this.y = -40;
            this.contactDmg = Math.round(26 * g.atkScale);
            SFX.dash(); g.shake(4);
          }
        } else if (this.phase === 'fall') {
          this.y += 780 * dt;
          if (this.y >= CFG.GROUND_Y - 64) {
            this.phase = 'blast'; this.stateT = 0;
            this.contactDmg = this.contactDmgBase || 20;
            g.shake(10);
            burst(g, this.x, CFG.GROUND_Y - 30, 16, ['#fff', '#c9d2cc', '#8a5a2b'], 260, 5, 0.5);
            for (let i = 0; i < 8; i++) {
              const a = i * TAU / 8;
              g.bullets.push(new Bullet(this.x, CFG.GROUND_Y - 60, Math.cos(a) * 250, Math.sin(a) * 250,
                { kind: 'wave', r: 12, dmg: 12 * g.atkScale, life: 3, color: '#38bdf8' }));
            }
            SFX.explode();
          }
        } else if (this.phase === 'blast') {
          // 回归
          this.y += (this.baseY - this.y) * dt * 2.2;
          if (this.stateT > 0.7) { this.phase = null; this.state = 'fight'; this.stateT = 0; }
        }
      }
      else if (this.state === 'whirl') {
        this.hoverDrift(dt, p, 0.5);
        if (this.stateT > 3.0) {
          // 结束：羽沿切线飞散
          for (const b of this.whirlOrbs) b.orbit = null;
          this.whirlOrbs = [];
          this.state = 'fight'; this.stateT = 0;
        }
      }
      else if (this.state === 'burialUp') {
        this.y += (-60 - this.y) * dt * 2.2;
        this.x += (CFG.W * 0.55 - this.x) * dt * 1.5;
        if (this.stateT > 1.1 && this.y < -10) {
          this.state = 'burial'; this.stateT = 0;
          this.fallRound = 0; this.fallT = 0.2;
          g.toast('万羽天葬！', 1.6); SFX.sweep(); g.shake(5);
        }
      }
      else if (this.state === 'burial') {
        this.fallT -= dt;
        if (this.fallT <= 0 && this.fallRound < 4) {
          // 新一轮落羽：全屏宽度投放，后期密度增大、预警更短（落点疏密随机）
          this.fallRound++;
          const n = this.fallRound >= 3 ? 16 : 12;
          const warn = this.fallRound >= 3 ? 0.55 : 0.75;
          for (let i = 0; i < n; i++) this.fallMarks.push({ x: rand(40, CFG.W - 40), t: warn + i * 0.04 });
          this.fallT = 0.95;
        }
        if (this.fallRound >= 4 && this.fallMarks.length === 0 && this.stateT > 1.5) {
          this.state = 'fight'; this.stateT = 0;
        }
      }
    }
    hoverDrift(dt, p, spd = 1) {
      this.baseY += (clamp(p.y + 20, 110, CFG.GROUND_Y - 140) - this.baseY) * dt * 1.1 * spd;
      this.y = this.baseY + Math.sin(this.t * 1.7) * 42;
      this.x = this.hoverX + Math.sin(this.t * 0.9) * 66;
    }
    spawnWhirl(g) {
      // 14 根羽毛环绕，半径渐扩至全屏（70 → ~450），寿命覆盖整个领域
      for (let i = 0; i < 14; i++) {
        const ang = i * TAU / 14;
        const b = new Bullet(this.x, this.y, 0, 0,
          { kind: 'feather', r: 8, dmg: 11 * g.atkScale, life: 5.0, color: '#fff' });
        b.orbit = { ang, angSpd: 2.2, radius: 70, grow: 90, pivot: () => this.dead ? null : { x: this.x, y: this.y } };
        this.whirlOrbs.push(b);
        g.bullets.push(b);
      }
      SFX.enemyShoot();
    }
    render(ctx) {
      // 天空俯冲落点预警
      if (this.state === 'dive' && this.phase === 'aim') {
        const on = Math.floor(this.t * 10) % 2 === 0;
        ctx.save();
        ctx.fillStyle = on ? 'rgba(255,60,60,0.4)' : 'rgba(255,60,60,0.18)';
        ctx.fillRect(this.aim.x - 48, CFG.GROUND_Y - 26, 96, 26);
        ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2;
        ctx.strokeRect(this.aim.x - 48, CFG.GROUND_Y - 26, 96, 26);
        ctx.restore();
      }
      // 万羽天葬落点预警圈
      for (const m of this.fallMarks) {
        const on = Math.floor(this.t * 10) % 2 === 0;
        ctx.save();
        ctx.strokeStyle = on ? 'rgba(255,80,80,0.9)' : 'rgba(255,80,80,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(m.x, CFG.GROUND_Y - 12, 22, 0, TAU); ctx.stroke();
        ctx.fillStyle = on ? 'rgba(255,60,60,0.3)' : 'rgba(255,60,60,0.12)';
        ctx.beginPath(); ctx.arc(m.x, CFG.GROUND_Y - 12, 18, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // 俯冲时身体垂直
      const dive = this.state === 'dive' && (this.phase === 'fall');
      drawSprite(ctx, Sprites.craneL, this.x, this.y, 6.5, 6.5, dive ? Math.PI * 0.5 : Math.sin(this.t * 2) * 0.07, this.flash);
      // 鹤鸣时颈部声波纹：三层扩散环，深色底描边+饱和亮青主环，粗大清晰、范围更大
      if (this.state === 'cry') {
        const cx = this.x - 10, cy = this.y - 8;
        const prog = (this.stateT % 0.85) / 0.85;
        for (let i = 0; i < 3; i++) {
          const p = prog - i * 0.33;
          if (p <= 0) continue;
          const rr = 40 + p * 170;
          const al = 0.95 - p * 0.75;
          ctx.strokeStyle = `rgba(8,22,44,${al * 0.6})`;
          ctx.lineWidth = 8;
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
          ctx.strokeStyle = `rgba(56,189,248,${al})`;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(235,250,255,0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(cx, cy, 34 + prog * 46, 0, TAU); ctx.stroke();
      }
      // 旋羽领域旋转气旋
      if (this.state === 'whirl') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        const rr = 100 + this.stateT * 34;
        ctx.beginPath(); ctx.arc(this.x, this.y, rr, this.t * 3, this.t * 3 + Math.PI * 1.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(this.x, this.y, rr * 0.72, -this.t * 3.6, -this.t * 3.6 + Math.PI); ctx.stroke();
      }
    }
  }

  window.Bosses = { PigKing, ThunderBehemoth, Samurai, SwordEagle, SkullKing, DogKing, GiantPheasant, Homelander, BossMan, Stranger, FrogKing, CraneSage };
  /** minOrd：按 Boss 出场序号解锁（1=首只）；chance：即使解锁也只有该概率进入候选池 */
  window.BOSS_LIST = [
    { cls: PigKing, weight: 3, minOrd: 1, music: 'boss' },
    { cls: ThunderBehemoth, weight: 3, minOrd: 2, music: 'boss' },
    { cls: Samurai, weight: 3, minOrd: 2, music: 'boss' },
    { cls: SwordEagle, weight: 3, minOrd: 3, music: 'eagle' },        // 咬剑鹰：广州鼓点+鹰叫
    { cls: SkullKing, weight: 3, minOrd: 1, chance: 0.3, music: 'boss' },   // 第 1 轮起 30% 概率出现
    { cls: DogKing, weight: 3, minOrd: 1, chance: 0.3, music: 'boss' },     // 第 1 轮起 30% 概率出现
    { cls: GiantPheasant, weight: 3, minOrd: 2, music: 'pheasant' },       // 野鸡王：鸡叫融合电音
    { cls: Homelander, weight: 3, minOrd: 2, chance: 0.3, music: 'hero' },  // 祖国人：军乐+电磁声
    { cls: BossMan, weight: 3, minOrd: 1, maxOrd: 3, forceChance: { 1: 0.6, 2: 0.4, 3: 0.4 }, music: 'imperial' },  // 大王：首轮 60% 直接出场，帝王军乐
    { cls: Stranger, weight: 3, minOrd: 1, maxOrd: 3, music: 'boss' },      // 怪客：仅 1-3 轮
    { cls: FrogKing, weight: 3, minOrd: 3, music: 'boss' },                 // 蛙哥：地面巨兽，第 3 轮起
    { cls: CraneSage, weight: 3, minOrd: 4, music: 'crane' }                // 鹤仙：五技特殊型，第 4 轮起；悲壮像素摇滚
  ];
})();
