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
      if (kb) { this.kbX += kb.x * 0.25; this.kbY += kb.y * 0.25; }
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

  /* ================ A2. 雷公巨兽（精英） ================
   * 三段攻击轮换：纵向三连落雷 / 横向双道闪电 / 对角 X 形斜闪电 */
  class ThunderBehemoth extends Boss {
    constructor(g) {
      super(g, 24, 64);
      this.bossName = '雷公巨兽';
      this.title = '精英强化型';
      this.atkT = 2.2;
      this.atkMode = 0;
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
          { kind: 'orb', r: 9, dmg: 15 * g.atkScale, dmgScale: g.atkScale, life: 4, color: '#ffd23b', rockBreak: true }));
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
            { kind: 'orb', r: 7, dmg: 12 * g.atkScale, dmgScale: g.atkScale, life: 5, color: '#ff9d2e', rockBreak: true }));
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
          const sp = rand(260, 420) * (0.6 + weight * 0.5);
          const px = mouthX + Math.cos(a) * rand(0, 20);
          const py = mouthY + Math.sin(a) * rand(0, 20);
          const colors = ['#ff2a0a', '#ff5a1a', '#ff9d2e', '#ffd23b', '#fff5d0'];
          const col = colors[Math.floor(Math.random() * colors.length)];
          const pr = rand(5, 12) * (0.5 + weight * 0.6);
          g.particles.push(new Particle(px, py,
            Math.cos(a) * sp, Math.sin(a) * sp,
            rand(0.3, 0.6), pr, col));
        }
        // 喷火伤害判定：弧形区域内对玩家造成伤害
        const dx = p.x - mouthX, dy = p.y - mouthY;
        const dist = Math.hypot(dx, dy);
        if (dist < 320) {
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
        // 空中缓慢逆时针自转，周期发射激光
        this.rotA -= dt * 1.25;
        this.x = this.hoverX + Math.sin(this.t * 0.7) * 30;
        this.y += Math.sin(this.t * 1.8) * 16 * dt;
        this.y = clamp(this.y, 140, CFG.GROUND_Y - 190);
        this.spinFire -= dt;
        if (this.spinFire <= 0) {
          this.spinFire = 0.5;
          g.beams.push(new Beam(this.x, this.y, this.rotA, 1400, 13, Math.round(15 * g.atkScale), 0.65, true));
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
      const ang = this.state === 'spin' ? this.rotA : Math.sin(this.t * 2) * 0.06;
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
              { kind: 'orb', r: 7, dmg: 13 * g.atkScale, dmgScale: g.atkScale, life: 7, color: '#ff5252' }));
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
                { kind: 'orb', r: 8, dmg: 14 * g.atkScale, dmgScale: g.atkScale, life: 5, color: '#ffd23b' }));
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
          { kind: 'float', r: 18, dmg: 18 * g.atkScale, dmgScale: g.atkScale, life: 9,
            hp: 6, homing: true, turnRate: 0.55 });
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

  /* ================ D3. 怪客（跳动光头巨汉：S 型冲刺 / 顶端飞刀散射 / 巨型十字弹 / 召唤雷公） ================ */
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
      this.deathCols = ['#d9b38c', '#8d96a3', '#e0453a', '#ffd23b'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

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
        // 移动到屏幕顶端
        const tx = CFG.W * 0.5, ty = 120;
        this.x += (tx - this.x) * dt * 3.4;
        this.y += (ty - this.y) * dt * 3.4;
        if (this.stateT > 0.6) { this.state = 'knives'; this.stateT = 0; this.knifeFireT = 0.2; SFX.bossCharge(); }
      }
      else if (this.state === 'knives') {
        // 顶端向下大范围散射飞刀（9 发/轮，扇形覆盖 ±0.64 弧度）
        this.x = CFG.W * 0.5 + Math.sin(this.t * 1.2) * 70;
        this.y = 120;
        this.knifeFireT -= dt;
        if (this.knifeFireT <= 0) {
          this.knifeFireT = 0.2;
          for (let i = -4; i <= 4; i++) {
            const a = Math.PI / 2 + i * 0.16;
            g.bullets.push(new Bullet(this.x, this.y + 50,
              Math.cos(a) * 360, Math.sin(a) * 360,
              { kind: 'knife', r: 9, dmg: 12 * g.atkScale, dmgScale: g.atkScale, life: 5.5 }));
          }
          SFX.enemyShoot();
        }
        if (this.stateT > 2.8) { this.state = 'back'; this.stateT = 0; }
      }
      else if (this.state === 'cross') {
        // 回到屏幕右侧
        this.x += (this.hoverX - this.x) * dt * 3.4;
        this.baseY += (clamp(p.y - 30, 140, CFG.GROUND_Y - 190) - this.baseY) * dt * 2.6;
        this.y += (this.baseY - this.y) * dt * 2.6;
        if (this.stateT > 0.7) {
          this.state = 'back'; this.stateT = 0;
          // 向左发射巨大十字型子弹（体积×2）
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          g.bullets.push(new Bullet(this.x - 60, this.y,
            Math.cos(a) * 210, Math.sin(a) * 210,
            { kind: 'cross', r: 52, dmg: 22 * g.atkScale, dmgScale: g.atkScale, life: 6 }));
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
      // 持续跳动
      const bob = Math.abs(Math.sin(this.t * 5)) * -12;
      drawSprite(ctx, Sprites.strangerL, this.x, this.y + bob, 8.5, 8.5, Math.sin(this.t * 3) * 0.04, this.flash);
    }
  }

  window.Bosses = { PigKing, ThunderBehemoth, Samurai, SwordEagle, SkullKing, DogKing, GiantPheasant, Homelander, BossMan, Stranger };
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
    { cls: Stranger, weight: 3, minOrd: 1, maxOrd: 3, music: 'boss' }      // 怪客：仅 1-3 轮
  ];
})();
