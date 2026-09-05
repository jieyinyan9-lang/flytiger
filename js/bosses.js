/* ============================================================
 * bosses.js —— Boss：精英强化型 × 特殊机制型
 *  精英：火焰飞猪王 / 雷公巨兽（体型×4，机制强化）
 *  特殊：飞天日本武士 / 咬剑鹰（独立技能）
 * ============================================================ */
(function () {
  'use strict';

  const { Bullet, Lightning, burst, drawSprite, rand, clamp, Particle } = window.FT;
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
      if (kb) { this.kbX += kb.x * 0.25; this.kbY += kb.y * 0.25; }
      if (Math.random() < 0.3) burst(g, this.x - 14, this.y, 2, ['#fff', '#ffe08a'], 130, 3, 0.18);
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
    }
  }

  /* ================ A2. 雷公巨兽（精英） ================ */
  class ThunderBehemoth extends Boss {
    constructor(g) {
      super(g, 24, 64);
      this.bossName = '雷公巨兽';
      this.title = '精英强化型';
      this.atkT = 2.2;
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
        const offs = [0, -120, 120];
        offs.forEach(off => {
          const lx = clamp(p.x + off, 70, CFG.W - 70);
          g.lightnings.push(new Lightning(lx, 92, 22 * g.atkScale));
        });
        SFX.warn();
      }
    }
    render(ctx) {
      drawSprite(ctx, Sprites.leigongL, this.x, this.y + Math.sin(this.t * 2) * 4, 8.0, 8.0, 0, this.flash);
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

        // 羽毛扇形射击
        this.featherT -= dt;
        if (this.featherT <= 0) {
          this.featherT = rand(1.6, 2.1);
          const base = Math.atan2(p.y - this.y, p.x - this.x);
          for (let i = -4; i <= 4; i++) {
            const a = base + i * 0.11;
            g.bullets.push(new Bullet(this.x - 24, this.y,
              Math.cos(a) * 320, Math.sin(a) * 320,
              { kind: 'feather', r: 7, dmg: 10 * g.atkScale, life: 6 }));
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

  window.Bosses = { PigKing, ThunderBehemoth, Samurai, SwordEagle };
  /** minOrd：按 Boss 出场序号解锁（1=首只必出飞猪王，2=解锁雷公巨兽/武士，3=解锁咬剑鹰） */
  window.BOSS_LIST = [
    { cls: PigKing, weight: 3, minOrd: 1 },
    { cls: ThunderBehemoth, weight: 3, minOrd: 2 },
    { cls: Samurai, weight: 3, minOrd: 2 },
    { cls: SwordEagle, weight: 3, minOrd: 3 }
  ];
})();
