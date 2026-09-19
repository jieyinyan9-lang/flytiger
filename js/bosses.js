/* ============================================================
 * bosses.js —— Boss：精英强化型 × 特殊机制型
 *  精英：火焰飞猪王 / 雷公巨兽（体型×4，机制强化）
 *  特殊：飞天日本武士 / 铁鹰（独立技能）
 * ============================================================ */
(function () {
  'use strict';

  const { Bullet, Lightning, Beam, CurveBeam, burst, drawSprite, drawSpriteTinted, rand, randi, clamp, Particle, BoneDragonMini, GrassDragon, Enemy, DRAGON_THEMES,
    elemHitFx, elemDeathFx } = window.FT;
  const TAU = Math.PI * 2;

  /** Boss 受击闪红时长（秒）与冷却（秒，含闪红持续期） */
  const BOSS_FLASH_TIME = 0.3, BOSS_FLASH_CD = 4;
  /** 闪红当前强度 0..0.85：前 0.18s 满重色，随后快速衰减 */
  function bossFlashAlpha(flash) {
    return flash > 0 ? 0.85 * Math.min(1, flash / 0.18) : 0;
  }
  /** Boss 精灵绘制：正常绘制 + 受击时重色红染叠层（替代 drawSprite 的 brightness 白闪） */
  function drawBossSprite(ctx, spr, x, y, sx, sy, angle, flash) {
    sy = sy || sx;
    drawSprite(ctx, spr, x, y, sx, sy, angle, 0);
    const a = bossFlashAlpha(flash);
    if (a > 0) drawSpriteTinted(ctx, spr, x, y, spr.width * sx, spr.height * sy, angle || 0, '#ff1e10', a);
  }

  /** Boss 类名 → 死法文案池 key（game.js DEATH_LINES） */
  const BOSS_DSRC = {
    PigKing: 'pigking', ThunderBehemoth: 'thunderbehemoth', Samurai: 'samurai',
    SwordEagle: 'swordeagle', SkullKing: 'skullking', DogKing: 'dogking',
    GiantPheasant: 'giantpheasant', Homelander: 'homelander', BossMan: 'bossman',
    Stranger: 'stranger', FrogKing: 'frogking', CraneSage: 'cranesage',
    Sphinx: 'sphinx', NiuMo: 'niumo', BoneDragonKing: 'bonedragonking',
    MadHyena: 'madhyena', RaccoonRover: 'raccoonrover', SandWalker: 'sandwalker',
    CaptainGeorge: 'captaingeorge', FireBlind: 'fireblind', PurpleHand: 'purplehand',
    SeaBully: 'seabully', SnowWitch: 'snowwitch', CrowCount: 'crowCount'
  };

  class Boss {
    constructor(g, contactDmg, radius) {
      this.isBoss = true;
      this.dead = false;
      this.dsrc = { k: 'b', key: BOSS_DSRC[this.constructor.name] || 'boss' };   // 击杀者归因（死法文案）
      this.flash = 0;            // 受击闪红剩余时长（秒）
      this.lastFlashT = -999;    // 上次触发闪红的时间戳（this.t 轴），4s 冷却
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
      // 血量以参考 DPS 曲线为锚（正常成长→交战≈fightTime），实际 DPS 偏离只软追赶 45%
      // 第1只30s 起步，之后每只 +3.2s，58s 封顶
      const fightTime = CFG.boss.fightTime(g.bossSpawned + 1);
      this.maxHp = Math.round(CFG.boss.refDpsAt(g.bossSpawned + 1) * fightTime * g.hpSoftMul(g.bossSpawned + 1));
      this.hp = this.maxHp;
      this.xpValue = 220;
      this.deathCols = ['#fff', '#ffd23b', '#ff7b2e'];
    }
    takeDamage(dmg, g, kb) {
      if (this.dead || this.state === 'enter') return;   // 入场免伤
      this.hp -= dmg;
      this.hitFlash();
      // Boss 免疫击退：忽略 kb 参数，防止被持续攻击推出屏幕外
      if (Math.random() < 0.3) burst(g, this.x - 14, this.y, 2, ['#ff3b3b', '#ff7b2e'], 130, 3, 0.18);
      // 低血量狂暴（每只 Boss 仅一次）：三连警报 + 怒吼 + 震屏 + 红色爆发
      if (!this.enraged && this.hp > 0 && this.hp <= this.maxHp * 0.3) {
        this.enraged = true;
        SFX.bossEnrage();
        g.shake(10);
        g.toast(`${this.bossName} 狂暴了！`, 1.8, 'lt');
        burst(g, this.x, this.y, 24, ['#ff3b3b', '#ffd23b', '#fff'], 280, 6, 0.6, 130);
      }
      if (this.hp <= 0) { this.hp = 0; this.die(g); }
    }
    die(g) {
      // 灼烧/中毒期间被击杀：原地小火球爆炸 / 毒云爆发（骨龙等无 radius 的用默认值）
      if (elemDeathFx && (this.dotType === 'flame' || this.dotType === 'poison') && (this.dotT || 0) > 0) {
        elemDeathFx(this.x, this.y, this.dotType, g, (this.radius || 30) * 1.1);
      }
      this.dead = true;
      g.onBossDefeated(this);
    }
    /** 受击闪红：4s 冷却一次，重色红染 0.3s（冷却期内受击不重复闪） */
    hitFlash() {
      if (this.t - this.lastFlashT >= BOSS_FLASH_CD) {
        this.lastFlashT = this.t;
        this.flash = BOSS_FLASH_TIME;
      }
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
          g.toast('🔥 火猪王喷火！', 1.5, 'lt'); g.shake(5);
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
      drawBossSprite(ctx, Sprites.pigL, this.x, this.y + bob, 7.2, 7.2, 0, this.flash);
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
      // leigong.png 152×160 正面图，缩放 1.0 → 显示 152×160（与旧像素精灵 8.0 倍尺寸一致）
      drawBossSprite(ctx, Sprites.leigongL, this.x, this.y + Math.sin(this.t * 2) * 4, 1.0, 1.0, 0, this.flash);
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
        drawBossSprite(ctx, Sprites.samuraiL, this.x, this.y, 0.74, 0.74, 0, 0.5);
      } else {
        drawBossSprite(ctx, Sprites.samuraiL, this.x, this.y, 0.74, 0.74, angle, this.flash);
      }
    }
  }

  /* ================ B2. 铁鹰（特殊机制） ================ */
  class SwordEagle extends Boss {
    constructor(g) {
      super(g, 20, 48);
      this.bossName = '铁鹰';
      this.title = '特殊机制型';
      this.hoverX = 680;
      this.featherT = 1.4;
      this.featherVolley = 0;   // 齐射计数：每 3 次有 1 发稀疏弹
      this.whirlT = 7.0;
      this.rushT = 12.0;
      this.rushA = 0;          // 突袭冲锋朝向（转向速率受限，不再逐帧完美追踪）
      this.spiralA = 0;
      this.trail = [];          // 移动白色拖尾轨迹点（{x,y,life}）
      this.deathCols = ['#8b96a8', '#e8eef7', '#c0392b', '#fff'];
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      // 拖尾点寿命衰减
      for (let i = this.trail.length - 1; i >= 0; i--) {
        this.trail[i].life -= dt;
        if (this.trail[i].life <= 0) this.trail.splice(i, 1);
      }
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 170 * dt;
        this.recordTrail(this.x + 62, this.y + 6);   // 尾部炮管锚点
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }

      if (this.state === 'fight') {
        // 高速游弋
        this.baseY += (clamp(p.y, 100, CFG.GROUND_Y - 110) - this.baseY) * dt * 1.6;
        this.y = this.baseY + Math.sin(this.t * 3.2) * 60;
        this.x = this.hoverX + Math.sin(this.t * 1.4) * 90;
        this.recordTrail(this.x + 62, this.y + 6);   // 尾部炮管锚点（高速游弋）

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
        this.recordTrail(this.x, this.y);   // 原地旋转：基本不产生新点，旧拖尾自然消散
      }
      else if (this.state === 'rushWind') {
        // 蓄力结束：起飞方向锁定为当时玩家方位，随后转向速率受限（玩家有反应窗口）
        if (this.stateT >= 0.5) {
          this.state = 'rush'; this.stateT = 0;
          this.rushA = Math.atan2(p.y - this.y, p.x - this.x);
          SFX.dash();
        }
      }
      else if (this.state === 'rush') {
        // 旋转突袭：转向受限的追踪冲锋 —— 朝玩家方位逐步偏转（每秒最多约 143°），
        // 无法瞬间掉头，玩家垂直急转/折返可使其冲过头；命中穿身后会沿惯性滑开，不再贴身连撞
        const want = Math.atan2(p.y - this.y, p.x - this.x);
        let da = want - this.rushA;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        this.rushA += clamp(da, -2.5 * dt, 2.5 * dt);
        const sp = 320;
        this.x += Math.cos(this.rushA) * sp * dt;
        this.y += Math.sin(this.rushA) * sp * dt;
        // 撞边反弹：保持冲锋惯性折返，不会卡在边界黏住玩家
        if (this.x < 80) { this.x = 80; this.rushA = Math.PI - this.rushA; }
        if (this.x > CFG.W - 40) { this.x = CFG.W - 40; this.rushA = Math.PI - this.rushA; }
        if (this.y < 70) { this.y = 70; this.rushA = -this.rushA; }
        if (this.y > CFG.GROUND_Y - 60) { this.y = CFG.GROUND_Y - 60; this.rushA = -this.rushA; }
        this.recordTrail(this.x, this.y);   // 突袭高速冲锋（身体旋转中）：从中心拉出白色光尾
        // 拖尾
        g.particles.push(new Particle(this.x + 20, this.y, rand(-40, 40), rand(-40, 40),
          0.35, 5, '#bfe9ff'));
        if (this.stateT >= 3.8) { this.state = 'fight'; this.stateT = 0; }
      }
    }
    /** 记录拖尾点：静止（帧位移 < 2px）时不记录，队列硬上限 30 点 */
    recordTrail(px, py) {
      const tr = this.trail;
      const last = tr[tr.length - 1];
      if (last && Math.hypot(px - last.x, py - last.y) < 2) return;
      tr.push({ x: px, y: py, life: 0.55 });
      if (tr.length > 30) tr.shift();
    }
    render(ctx) {
      // 白色线性拖尾：双层描边（外发光 + 内亮芯），随寿命渐变收细变淡，画在鹰身下
      const tr = this.trail;
      if (tr.length > 1) {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 1; i < tr.length; i++) {
            const a = tr[i - 1], b = tr[i];
            const f = clamp(b.life / 0.55, 0, 1);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = pass === 0
              ? `rgba(255,255,255,${(0.22 * f).toFixed(3)})`
              : `rgba(255,255,255,${(0.85 * f).toFixed(3)})`;
            ctx.lineWidth = pass === 0 ? 1 + 9 * f : 0.5 + 3.5 * f;
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      const spr = Math.floor(this.t * 8) % 2 === 0 ? Sprites.swordEagleAL : Sprites.swordEagleBL;
      let angle = Math.sin(this.t * 2) * 0.1;
      if (this.state === 'whirl' || this.state === 'rush') angle = this.t * 12;
      // ying1/ying2 224×160，缩放 0.65 → 显示约 146×104（与旧像素精灵 5.2 倍尺寸一致）
      if (this.state === 'rushWind') {
        drawSprite(ctx, spr, this.x, this.y, 0.65, 0.65, 0, Math.floor(this.t * 10) % 2 ? 0.4 : 0);
      } else {
        drawBossSprite(ctx, spr, this.x, this.y, 0.65, 0.65, angle, this.flash);
      }
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
          { kind: 'skull', r: 12, dmg: 12 * g.atkScale, dmgScale: g.atkScale, life: 6, spinRate: 5 }));
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
            { kind: 'skull', r: 11, dmg: 11 * g.atkScale, dmgScale: g.atkScale, life: 6, spinRate: 5 }));
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
            { kind: 'skull', r: 12, dmg: 13 * g.atkScale, dmgScale: g.atkScale, life: 7, spinRate: 5 }));
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
      drawBossSprite(ctx, Sprites.skullhead, this.x, this.y, 7.6 * pulse, 7.6 * pulse, this.rotA, this.flash);
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
        g.toast('飞天狗王解体了！', 1.8, 'lt');
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
          p.hurt(Math.round(22 * g.atkScale), g, this.dsrc);
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
      // 狗头：goutou.png 272×192，缩放 0.68 → 显示约 185×131（与原像素精灵 5.4 倍尺寸一致）
      const ang = this.phase === 2 ? Math.sin(this.t * 10) * 0.12 : Math.sin(this.t * 1.5) * 0.06;
      drawBossSprite(ctx, Sprites.dogHeadL, this.x, this.y, 0.68, 0.68, ang, this.flash);
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

  /* ================ C3. 火鸡王（地面突击：撞毁障碍 + 直射/散射/追踪导弹） ================
   * 仅地面移动、巡逻范围小；身体与弹道都会炸毁山石障碍 */
  class GiantPheasant extends Boss {
    constructor(g) {
      super(g, 30, 96);
      this.bossName = '火鸡王';
      this.title = '地面突击型';
      this.x = CFG.W + 120;
      this.y = CFG.GROUND_Y - 88;
      this.baseY = this.y;
      this.patrolMin = CFG.W * 0.52;
      this.patrolMax = CFG.W - 95;
      this.dir = -1;
      this.shotT = 1.3;
      this.scatterT = 7.5;
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
          Math.cos(a) * 310, Math.sin(a) * 310,
          { kind: 'orb', r: 27, dmg: 15 * g.atkScale, dmgScale: g.atkScale, life: 6, color: '#ffd23b', rockBreak: true, fireTrail: true }));
        SFX.enemyShoot();
        g.shake(3);
      }
      // 偶尔散射（6 向扇形）
      this.scatterT -= dt;
      if (this.scatterT <= 0) {
        this.scatterT = rand(7.5, 9.5);
        const base = Math.atan2(p.y - this.y, p.x - this.x);
        for (let i = -2; i <= 3; i++) {
          const a = base + i * 0.19;
          g.bullets.push(new Bullet(this.x - 72, this.y - 12,
            Math.cos(a) * 215, Math.sin(a) * 215,
            { kind: 'orb', r: 15, dmg: 12 * g.atkScale, dmgScale: g.atkScale, life: 6, color: '#ff9d2e', rockBreak: true, fireTrail: true, pxFire: true }));
        }
        SFX.enemyShoot();
      }
      // 尾部喷出巨型追踪导弹（体积×3：发射后 4s 无敌，之后被子弹击中 3 次爆炸，被旋转剑击中 1 次必爆）
      this.missileT -= dt;
      if (this.missileT <= 0) {
        this.missileT = rand(3.4, 4.4);
        const m = new Bullet(this.x + 88, this.y - 52,
          120, -90,
          { kind: 'missile', r: 18, dmg: 18 * g.atkScale, dmgScale: g.atkScale, life: 14,
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
            p.hurt(Math.round(8 * g.atkScale), g, this.dsrc);
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
          g.toast('🔥 火鸡王喷火！', 1.5, 'lt');
          g.shake(5);
        }
      }
    }
    render(ctx) {
      const bob = Math.abs(Math.sin(this.t * 7)) * -6;
      // 尾羽微摆：huoji.png 368×208，缩放 0.85 → 显示约 313×177（与旧像素精灵 6.8 倍尺寸一致）
      drawBossSprite(ctx, Sprites.pheasantL, this.x, this.y + bob, 0.85, 0.85, Math.sin(this.t * 3) * 0.05, this.flash);
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

  /* ================ D1. 怒星使（特殊机制：3 束激光扫射 / 落地冲刺 / 慢速旋转激光） ================
   * 激光遇障碍炸碎山石；旋转激光整局最多 3 次，自转速度很慢 */
  class Homelander extends Boss {
    constructor(g) {
      super(g, 28, 80);
      this.bossName = '怒星使';
      this.title = '特殊机制型';
      this.hoverX = 660;
      this.atkT = 1.8;
      this.spinUsed = 0;      // 旋转激光使用次数（上限 3）
      this.rotA = 0;
      this.spinFire = 0;
      this.spinOff = 0;       // 旋转扫射自转相位（必须初始化，否则 undefined-dt=NaN 导致光束方向 NaN 无法绘制/命中）
      this.teleX = 0; this.teleY = 0;   // 瞬移激光落点
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
          if (this.spinUsed < 3 && roll < 0.22) {
            // 慢速旋转激光（最多 3 次）
            this.state = 'spin'; this.stateT = 0;
            this.spinUsed++;
            this.spinOff = 0;   // 每次进入旋转扫射重置自转相位（防 NaN 累积）
            this.rotA = Math.atan2(p.y - this.y, p.x - this.x);
            this.spinFire = 0.25;
            SFX.phaseRise();   // 危险招式提示：旋转扫射蓄力
            g.toast(`怒星使开始旋转扫射！（${this.spinUsed}/3）`, 1.8, 'lt');
          } else if (roll < 0.42) {
            // 瞬移激光：原地闪烁后瞬移至玩家下方，朝上释放垂直激光
            this.state = 'teleOut'; this.stateT = 0;
            SFX.bossCharge();
            g.toast('怒星使瞬移了！', 1.4, 'lt');
          } else if (roll < 0.66) {
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
            g.beams.push(new Beam(this.x, this.y - 30, a, 1400, 13, Math.round(15 * g.atkScale), 0.72, true));
          }
          SFX.zap();
        }
        if (this.stateT > 5.5) { this.state = 'fight'; this.stateT = 0; this.atkT = rand(1.8, 2.6); }
      }
      else if (this.state === 'teleOut') {
        // 瞬移前 0.35s：原地高频闪烁（走位提示）
        this.x = this.hoverX + Math.sin(this.t * 0.9) * 36;
        this.y = this.baseY + Math.sin(this.t * 2.2) * 22;
        if (this.stateT > 0.35) {
          // 锁定玩家当前位置，瞬移到其正下方贴地处
          this.teleX = clamp(p.x, 110, CFG.W - 110);
          this.teleY = CFG.GROUND_Y - 92;
          burst(g, this.x, this.y, 18, ['#ffd23b', '#2f6fd0', '#fff'], 240, 5, 0.5, 120);
          this.x = this.teleX; this.y = this.teleY; this.baseY = this.teleY;
          this.state = 'teleAim'; this.stateT = 0;
          burst(g, this.x, this.y, 18, ['#ff3b3b', '#ffd23b', '#fff'], 260, 5, 0.5, 120);
          g.shake(6);
          SFX.phaseRise();
          g.toast('小心头顶！', 1.2, 'lt');
        }
      }
      else if (this.state === 'teleAim') {
        // 落点蓄力 0.55s：垂直红色预警线（render 绘制），玩家可走位躲避
        this.x = this.teleX; this.y = this.teleY;
        if (this.stateT > 0.55) {
          // 朝上三束紧密垂直激光（中间竖直、两侧微偏）
          for (let k = -1; k <= 1; k++) {
            g.beams.push(new Beam(this.x, this.y - 34, -Math.PI / 2 + k * 0.13, 1500, 15,
              Math.round(18 * g.atkScale), 0.08, false));
          }
          SFX.warn(); g.shake(8);
          this.state = 'teleBack'; this.stateT = 0;
        }
      }
      else if (this.state === 'teleBack') {
        // 发射后归位
        this.x += (this.hoverX - this.x) * dt * 2.6;
        this.baseY += (clamp(p.y - 50, 120, CFG.GROUND_Y - 170) - this.baseY) * dt * 2.6;
        this.y += (this.baseY - this.y) * dt * 2.6;
        if (this.stateT > 0.9) { this.state = 'fight'; this.stateT = 0; this.atkT = rand(1.4, 2.2); }
      }
    }
    fireBeamSweep(g, p) {
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = -1; i <= 1; i++) {
        g.beams.push(new Beam(this.x, this.y - 34, base + i * 0.26, 1400, 15, Math.round(17 * g.atkScale), 0.8, true));
      }
      SFX.warn(); g.shake(4);
    }
    render(ctx) {
      // 瞬移前：高频闪烁（隔帧只画金色残影光圈）
      if (this.state === 'teleOut' && Math.floor(this.t * 30) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,210,59,0.25)';
        ctx.beginPath(); ctx.arc(this.x, this.y, 60 + Math.sin(this.t * 20) * 8, 0, TAU); ctx.fill();
        return;
      }
      const ang = this.state === 'spin' ? this.spinOff : Math.sin(this.t * 2) * 0.06;
      // zuguoren.png 240×256 正面图，缩放 0.78 → 显示约 187×200（与原像素精灵 6.2 倍尺寸一致）
      drawBossSprite(ctx, Sprites.homelanderL, this.x, this.y, 0.78, 0.78, ang, this.flash);
      // 旋转激光 / 瞬移激光蓄力：双眼红光（正面图双眼在头部左右）
      if (this.state === 'spin' || this.state === 'teleAim') {
        ctx.fillStyle = Math.floor(this.t * 10) % 2 ? '#ff3b3b' : '#ffd23b';
        ctx.fillRect(this.x - 32, this.y - 38, 14, 8);
        ctx.fillRect(this.x + 18, this.y - 38, 14, 8);
      }
      // 瞬移落点：三条垂直红色预警虚线（与实际激光同轨迹）
      if (this.state === 'teleAim') {
        const on = Math.floor(this.t * 14) % 2 === 0;
        if (on) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,70,70,0.85)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
          for (let k = -1; k <= 1; k++) {
            const a = -Math.PI / 2 + k * 0.13;
            ctx.beginPath(); ctx.moveTo(this.x, this.y - 34);
            ctx.lineTo(this.x + Math.cos(a) * 1500, this.y - 34 + Math.sin(a) * 1500);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
  }

  /* ================ D2. 斧王（两阶段：西装巨人召唤/双手射击/漂浮弹 → 半血碎裂变身巨头） ================ */
  class BossMan extends Boss {
    constructor(g) {
      super(g, 32, 100);
      this.bossName = '斧王';
      this.title = '特殊机制型';
      this.hoverX = CFG.W - 190;
      this.phase = 1;
      this.lockHp = false;
      this.actT = 2.4;
      this.actIdx = 0;
      // 开场锁血召唤斧头兵团
      this.summonLeft = 0;
      this.summonGap = 0;
      // 双手（锚点相对身体）：dawang_1.png 正面图，双手举斧在肩部两侧
      this.hands = [
        { ox: -55, oy: -6, px: 0, py: 0, tx: 0, ty: 0, state: 'idle', t: 0, fireT: 0 },
        { ox: 55, oy: -6, px: 0, py: 0, tx: 0, ty: 0, state: 'idle', t: 0, fireT: 0 }
      ];
      this.ringT = 2.0;
      this.eyeT = 3.0;
      this.invulnT = 0;        // 斧头命中玩家获得的无敌时间（可叠加）
      this.deathCols = ['#2b2f3a', '#e8eef7', '#ffd23b', '#e0453a'];
      // ── 阶段3（火车入场 + 蜥蜴脸飞空形态）──
      this.life = 1;                  // 1=第一命（阶段1-2），2=第二命（阶段3）
      this.phase3Invuln = 0;          // P3 酒壶无敌期（玫红光环）
      this.phase3InvulnMax = 5;      // P3 无敌持续 5s
      this.train = null;             // 火车对象 {x,y,w,h,vx,stopped,parts:[{dead}×5],partsLeft,exploded}
      this.p3 = null;                // 阶段3 子状态机辅助字段
      this.dialogueShown = false;    // 阶段3 开场台词气泡
      this.enraged = true;           // 阶段3 不触发通用低血狂暴（P5 自行处理）
    }
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      this.invulnT = Math.max(0, this.invulnT - dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x -= 90 * dt;
        if (this.x <= this.hoverX) {
          // 入场结束 → 开场锁血 6s，召唤一大批斧头兵
          this.state = 'summon'; this.stateT = 0;
          this.lockHp = true;
          this.summonLeft = CFG.axeMinion.count;
          this.summonGap = 0.2;
          g.toast('斧王召唤了斧头兵团！', 2.4, 'lt');
          SFX.warn();
        }
        return;
      }

      // 半血变身（阶段1）：锁血碎裂
      if (this.phase === 1 && this.state !== 'transform' && this.state !== 'summon' && this.hp <= this.maxHp * 0.5) {
        this.state = 'transform'; this.stateT = 0;
        this.lockHp = true;
        this.hp = Math.ceil(this.maxHp * 0.5);
        this.hands.forEach(h => { h.state = 'idle'; h.t = 0; });
        g.shake(16); g.flashT = 0.4; g.flashColor = '#fff';
        SFX.bossDarkTransform();   // 黑暗变身：痛苦嘶吼悲号 + 次声震动 + 能量爆裂（3秒）
        g.toast('斧王的身体碎裂了！', 2.2, 'lt');
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

      // 开场锁血召唤：悬停在右侧，错峰直接投放斧头兵（绕过普通刷怪上限），6s 后解除锁血
      if (this.state === 'summon') {
        this.baseY += (clamp(p.y - 40, 140, CFG.GROUND_Y - 200) - this.baseY) * dt * 1.2;
        this.y = this.baseY + Math.sin(this.t * 1.8) * 16;
        this.x += (this.hoverX - this.x) * dt * 1.6;
        this.summonGap -= dt;
        if (this.summonLeft > 0 && this.summonGap <= 0) {
          this.summonGap = CFG.axeMinion.spawnGap;
          this.summonLeft--;
          g.enemies.push(new Enemy('axeMinion', g));
          // 召唤金光：从斧王袖口洒出，落向入场方向
          burst(g, this.x - 46, this.y + rand(-30, 40), 10,
            ['#ffd23b', '#fff3c4', '#e8eef7', '#c62f26'], 200, 5, 0.45, -40);
        }
        if (this.stateT >= CFG.axeMinion.lockTime) {
          this.state = 'fight'; this.stateT = 0;
          this.lockHp = false;
          this.actT = 2.4;
          g.toast('斧头兵团列阵完毕！', 1.8, 'lt');
          burst(g, this.x, this.y, 22, ['#ffd23b', '#fff', '#c62f26'], 260, 6, 0.55, 80);
        }
        return;
      }

      if (this.phase === 3) { this.updateP3(dt, g); return; }

      if (this.phase === 1) {
        if (this.state === 'fight') {
          // 屏幕右侧悬停
          this.baseY += (clamp(p.y - 40, 140, CFG.GROUND_Y - 200) - this.baseY) * dt * 1.2;
          this.y = this.baseY + Math.sin(this.t * 1.8) * 16;
          this.x += (this.hoverX - this.x) * dt * 1.6;
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
          if (this.stateT > 5.0) { this.state = 'handsBack'; this.stateT = 0; this.hands.forEach(h => h.t = 0); }
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
        // 眼珠伸长攻击：两条 S 型弧线激光（自双眼黑瞳射出，落点为屏幕左缘随机两点）
        this.eyeT -= dt;
        if (this.eyeT <= 0) {
          this.eyeT = rand(3.2, 4.0);
          // 双眼位置：bossHeadL 为 dawang_2.png（192×176）缩放 1.625 倍居中绘制
          // 炮管/加特林双眼在精灵坐标 (62,90)/(128,91)，换算为相对中心的局部偏移 (±54,+6) 并随头部微旋
          const th = Math.sin(this.t * 1.4) * 0.05;
          const co = Math.cos(th), si = Math.sin(th);
          const eyeAt = (lx, ly) => ({
            x: this.x + lx * co - ly * si,
            y: this.y + lx * si + ly * co
          });
          const eyes = [eyeAt(-54, 6), eyeAt(54, 6)];
          // 屏幕最左竖轴上的两个随机落点，彼此保持一定距离
          const lo = 80, hi = CFG.GROUND_Y - 60;
          let y1 = rand(lo, hi), y2 = rand(lo, hi);
          for (let i = 0; i < 8 && Math.abs(y2 - y1) < 150; i++) y2 = rand(lo, hi);
          if (Math.abs(y2 - y1) < 150) {
            y2 = clamp(y1 + (y1 < (lo + hi) / 2 ? 1 : -1) * rand(170, 240), lo, hi);
          }
          const lands = [y1, y2];
          if (Math.random() < 0.5) { eyes.reverse(); }
          eyes.forEach((e, i) => {
            g.beams.push(new CurveBeam(e.x, e.y, 0, lands[i],
              rand(110, 210), 16, Math.round(18 * g.atkScale), 1.0));
          });
          SFX.warn();
        }
      }
    }
    /** 双手飞出/收回：就位后朝玩家快速连射斧头弹幕（持续 5s；斧头命中玩家则斧王获得无敌） */
    stepHands(dt, g) {
      const p = g.player;
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
            h.fireT = 0.22;   // 快速连射
            const base = Math.atan2(p.y - h.py, p.x - h.px);   // 朝向玩家
            for (let s = -1; s <= 1; s++) {
              const a = base + s * 0.13;
              g.bullets.push(new Bullet(h.px, h.py,
                Math.cos(a) * 380, Math.sin(a) * 380,
                { kind: 'axe', r: 8, dmg: 14 * g.atkScale, dmgScale: g.atkScale, life: 5, color: '#ffd23b', spinRate: 12,
                  onPlayerHit: () => this.grantAxeInvuln(g) }));
            }
            SFX.enemyShoot();
          }
        }
      });
    }
    /** 斧头命中玩家：斧王获得 1s 无敌，效果可叠加 */
    grantAxeInvuln(g) {
      if (this.dead) return;
      const wasZero = this.invulnT <= 0;
      this.invulnT = Math.min(this.invulnT + 1, 8);
      if (wasZero) {
        g.toast('斧王吸收了斧击，进入无敌状态！', 1.2, 'lt');
        SFX.phaseRise();
        burst(g, this.x, this.y, 20, ['#9fe8ff', '#fff', '#7fd0ff'], 260, 6, 0.55, -60);
      }
    }
    takeDamage(dmg, g, kb) {
      // 锁血（开场召唤斧头兵团 6s / 半血碎裂变身 2.4s / 阶段3 火车入场）：免疫常规伤害
      if (this.lockHp) {
        if (Math.random() < 0.3) {
          burst(g, this.x + rand(-60, 40), this.y + rand(-90, 90), 2, ['#ffd23b', '#fff3c4'], 140, 3, 0.2);
        }
        return;
      }
      if (this.invulnT > 0) {
        // 无敌中：格挡火花，不掉血
        if (Math.random() < 0.35) {
          burst(g, this.x + rand(-70, 30), this.y + rand(-100, 100), 2, ['#9fe8ff', '#fff'], 150, 3, 0.2);
        }
        return;
      }
      // 阶段3 P3 酒壶无敌：玫红高亮度光环，不掉血
      if (this.phase3Invuln > 0) {
        if (Math.random() < 0.4) {
          burst(g, this.x + rand(-50, 40), this.y + rand(-70, 70), 2, ['#ff3bd0', '#fff'], 150, 3, 0.2);
        }
        return;
      }
      super.takeDamage(dmg, g, kb);
    }
    /** 多命机制：阶段2（巨头）血量打空时不真正死亡，转阶段3（火车入场）；阶段3 血空才真死 */
    die(g) {
      if (this.life < 2) { this.startPhase3(g); return; }
      super.die(g);
    }
    /** 五颗巨大漂浮弹：缓慢追踪玩家，被击中 6 次爆炸 */
    launchFloaters(g) {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.5;
        const b = new Bullet(this.x, this.y - 60,
          Math.cos(a) * 60, Math.sin(a) * 60,
          { kind: 'axe', r: 18, dmg: 18 * g.atkScale, dmgScale: g.atkScale, life: 9,
            hp: 6, homing: true, turnRate: 0.55, color: '#e0453a', spinRate: 7 });
        b.onBreak = (gg, bb) => gg.shellBlast(bb.x, bb.y, bb.dmg, bb.src);
        b.onExpire = (gg, bb) => gg.shellBlast(bb.x, bb.y, bb.dmg, bb.src);
        g.bullets.push(b);
      }
      SFX.warn();
    }
    render(ctx) {
      // 无敌护盾光环（斧头命中玩家获得，可叠加）
      if (this.invulnT > 0) {
        const a = 0.5 + Math.sin(this.t * 16) * 0.22;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#9fe8ff';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#7fd0ff';
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.phase === 2 ? 178 : 150, this.phase === 2 ? 155 : 178, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      // 开场召唤锁血护盾：金色脉动环 + 旋转碎点（提示常规伤害无效，大招可破）
      if (this.lockHp && this.state === 'summon') {
        const pk = 1 + Math.sin(this.t * 12) * 0.04;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(pk, pk);
        ctx.strokeStyle = `rgba(255,210,59,${0.55 + Math.sin(this.t * 9) * 0.25})`;
        ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.ellipse(0, 0, 150, 178, 0, 0, TAU); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,243,196,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 158, 186, 0, 0, TAU); ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = -this.t * 2.2 + i * (TAU / 8);
          ctx.fillStyle = 'rgba(255,225,130,0.75)';
          ctx.beginPath(); ctx.arc(Math.cos(a) * 154, Math.sin(a) * 182, 3, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      if (this.phase === 3) { this.renderP3(ctx); return; }
      if (this.phase === 2) {
        // 变身后巨头（占据近半屏）：dawang_2.png 192×176，缩放 1.625 → 显示约 312×286
        const pulse = 1 + Math.sin(this.t * 4) * 0.02;
        drawBossSprite(ctx, Sprites.bossHeadL, this.x, this.y, 1.625 * pulse, 1.625 * pulse, Math.sin(this.t * 1.4) * 0.05, this.flash);
        return;
      }
      if (this.state !== 'transform') {
        // 西装身体（占据近半屏）：dawang_1.png 240×304，缩放 1.125 → 显示约 270×342
        drawBossSprite(ctx, Sprites.bossManL, this.x, this.y, 1.125, 1.125, Math.sin(this.t * 1.6) * 0.03, this.flash);
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
        // 碎裂中：身体闪烁崩坏（白闪为碎裂演出，非受击反馈）
        drawSprite(ctx, Sprites.bossManL, this.x, this.y, 1.125, 1.125, 0, Math.floor(this.t * 14) % 2 ? 0.6 : 0);
      }
    }

    /* ============================================================
     *  阶段3：火车入场（P0）→ 飞斧（P1）→ 电击（P2）→ 酒壶（P3）→ 混合（P4）→ 狂暴（P5）
     *  蜥蜴脸西装礼帽持双斧的飞空形态，体积约为玩家最大体积的 2 倍
     * ============================================================ */
    /** 阶段2 巨头血空 → 启动阶段3：火车入场演出 */
    startPhase3(g) {
      this.life = 2;
      this.phase = 3;
      this.state = 'p3train'; this.stateT = 0;
      this.lockHp = true;            // 火车入场期间锁血
      this.hp = 1;                   // 占位，演出结束回满
      // 阶段3 第二命血量：以参考 DPS 曲线 + 标准交战时长为锚（独立于阶段1-2 的 maxHp）
      const fightTime = CFG.boss.fightTime(g.bossSpawned + 1);
      this.maxHp = Math.round(CFG.boss.refDpsAt(g.bossSpawned + 1) * fightTime * g.hpSoftMul(g.bossSpawned + 1));
      // 火车：从右下入场，1.6s 高速横穿后停稳占据整个下半屏（1 车头 + 4 节可复制车厢 = 5 个可破坏部位）
      this.train = this.makeP3Train();
      const stopX = Math.max(8, CFG.W - this.train.w - 12);   // 停稳后车头贴左、整车横亘下半屏
      this.train.vx = (stopX - this.train.x) / 1.6;   // 1.6s 高速横穿到位
      this.p3 = { phase: 'p0', actT: 0, fireT: 0, cycle: 0, dashT: 0, targetX: 0, targetY: 0 };
      // 阶段3 Boss 体积缩小：碰撞半径贴合实际模型（蜥蜴脸精灵 240×304 缩放 0.68 ≈ 163×207）
      this.radius = 80;
      // 巨头消失：爆裂粒子
      burst(g, this.x, this.y, 40, ['#2b2f3a', '#e8eef7', '#ffd23b', '#e0453a'], 320, 7, 0.9, 150);
      g.shake(14);
      SFX.bossRoar();
      g.toast('斧王逃上了火车！', 2.2, 'lt');
    }

    /** 阶段3 主更新：按子状态路由 */
    updateP3(dt, g) {
      const p = g.player;
      this.phase3Invuln = Math.max(0, this.phase3Invuln - dt);
      this.commonMove(dt);
      // 阶段3 血量打空 → 真正死亡（火车入场锁血期除外）
      if (this.hp <= 0 && !this.lockHp && this.phase3Invuln <= 0) {
        this.hp = 0; this.die(g); return;
      }
      // 火车部件矩形随车体同步（车头 + 4 车厢宽度不等）；被毁部件持续下沉
      if (this.train) {
        const tr = this.train;
        for (let i = 0; i < 5; i++) {
          const part = tr.parts[i];
          if (part.dead) {
            // 残骸持续下沉直到飞出屏幕外（无上限）
            part.sinkVy += 900 * dt;       // 重力加速
            part.sinkY += part.sinkVy * dt;
          } else {
            const r = this.trainPartRect(tr, i);
            part.x = r.x;
            part.w = r.w;
          }
        }
        // 爆炸冲击波环扩张
        if (tr.rings) {
          for (let i = tr.rings.length - 1; i >= 0; i--) {
            const r = tr.rings[i];
            r.t += dt; r.r += r.vr * dt;
            if (r.t >= r.life) tr.rings.splice(i, 1);
          }
        }
      }
      switch (this.state) {
        case 'p3train': this.updateP3Train(dt, g); break;
        case 'p3axe':   this.updateP3Axe(dt, g, p); break;
        case 'p3elec':  this.updateP3Elec(dt, g, p); break;
        case 'p3pot':   this.updateP3Pot(dt, g, p); break;
        case 'p3mix':   this.updateP3Mix(dt, g, p); break;
        case 'p3rage':  this.updateP3Rage(dt, g, p); break;
      }
      // 飞斧击中火车部件检测（敌方 axe 弹幕未命中玩家时可能击中火车）
      this.checkAxeHitTrain(dt, g);
    }

    /** 构造阶段3 火车：青电朋克机车（源图 x∈[0,58)）+ 4 节复制车厢（源图 x∈[58,106)）。
     *  高占屏幕 50%（270），贴屏幕底边；总宽 = 车头宽 + 4×车厢宽（约 938）。 */
    makeP3Train() {
      const tH = Math.round(CFG.H * 0.5);     // 270
      const kSc = tH / 72;                    // 源图高 72 → 显示缩放 3.75
      const engW = Math.round(58 * kSc);      // 车头显示宽 ≈ 218
      const carW = Math.round(48 * kSc);      // 单节车厢显示宽 = 180
      return {
        x: CFG.W + 80, y: CFG.H - tH, w: engW + carW * 4, h: tH,
        engW, carW,
        vx: 0, stopped: false, exploded: false,
        partsLeft: 5,
        // sx/sw 为精灵源图内的横向裁剪区间（车头 0..58，车厢 58..106）
        // sinkY/sinkVy：部件被摧毁后持续下沉的位移与速度
        parts: [
          { sx: 0, sw: 58, x: 0, w: engW, dead: false, sinkY: 0, sinkVy: 0 },
          { sx: 58, sw: 48, x: 0, w: carW, dead: false, sinkY: 0, sinkVy: 0 },
          { sx: 58, sw: 48, x: 0, w: carW, dead: false, sinkY: 0, sinkVy: 0 },
          { sx: 58, sw: 48, x: 0, w: carW, dead: false, sinkY: 0, sinkVy: 0 },
          { sx: 58, sw: 48, x: 0, w: carW, dead: false, sinkY: 0, sinkVy: 0 }
        ]
      };
    }

    /** 第 i 个部件（0=车头，1..4=车厢）在屏幕上的矩形 {x,w} */
    trainPartRect(tr, i) {
      return i === 0
        ? { x: tr.x, w: tr.engW }
        : { x: tr.x + tr.engW + (i - 1) * tr.carW, w: tr.carW };
    }

    /* ── P0 火车入场（高速横穿 + 轮轨火星，无伤害仅推开）── */
    updateP3Train(dt, g) {
      const tr = this.train;
      const st = this.stateT;
      // 0..0.8s 预警（右下灯光 + 烟尘 + 文字）
      if (st < 0.8) {
        if (st < 0.1 && !this._warnToast) { this._warnToast = true; g.toast('右下方传来轰鸣……！', 1.6, 'lt'); SFX.warn(); }
        return;
      }
      // 0.8..2.4s 火车高速横穿（1.6s）
      if (!tr.stopped) {
        tr.x += tr.vx * dt;
        // 烟囱烟尘
        if (Math.random() < 0.7) {
          g.particles.push(new Particle(tr.x + tr.engW * (15 / 58) + rand(-8, 8), tr.y + rand(0, 24),
            rand(60, 160), rand(-40, -6), 0.8, rand(4, 8), 'rgba(200,200,210,0.6)'));
        }
        // 轮轨火星：高速行驶时底盘擦出大量火星
        for (let s = 0; s < 4; s++) {
          const wx = tr.x + rand(20, tr.w - 20);
          g.particles.push(new Particle(wx, tr.y + tr.h - 4,
            rand(-220, -60), rand(-180, -40), 0.35, rand(1.5, 3.2),
            Math.random() < 0.5 ? '#ffd23b' : '#ff7b2e'));
        }
        // 车体擦撞玩家：无伤害，仅向左上方推开（避免卡在车内）
        const pl = g.player;
        if (pl.x > tr.x - pl.radius && pl.x < tr.x + tr.w + pl.radius &&
            pl.y > tr.y - pl.radius && pl.y < tr.y + tr.h + pl.radius) {
          pl.x = tr.x - pl.radius - 4;
          pl.y = Math.min(pl.y, tr.y - pl.radius - 18);
          // 撞击火星
          burst(g, pl.x + pl.radius, pl.y, 8, ['#ffd23b', '#ff7b2e', '#fff'], 200, 3, 0.3);
        }
        if (st >= 2.4) {
          tr.stopped = true;
          tr.x = Math.max(8, CFG.W - tr.w - 12);   // 钉死停止位置
          // 急停冲击：大范围火星 + 冲击波 + 烟尘
          burst(g, tr.x + tr.w, tr.y + tr.h * 0.5, 44,
            ['#ffd23b', '#ff7b2e', '#c94a1e', '#fff', '#888'], 420, 8, 0.7, 160);
          // 地面横向溅射火星
          for (let s = 0; s < 18; s++) {
            g.particles.push(new Particle(tr.x + rand(0, tr.w), tr.y + tr.h - 2,
              rand(-380, 380), rand(-120, -20), 0.5, rand(2, 4),
              ['#ffd23b', '#ff7b2e', '#fff'][s % 3]));
          }
          SFX.explode(false); g.shake(16);
        }
      } else if (!tr.exploded) {
        // 停稳 1.5s 后斧王从火车中飞出
        if (st >= 3.9) {
          tr.exploded = true;
          this.x = tr.x + tr.w * 0.6;
          this.y = tr.y - 56;
          this.baseY = this.y;
          this.hp = this.maxHp;
          this.lockHp = false;
          if (g.showDialogue) g.showDialogue('为了理想而战！！！', 2.6);
          else g.toast('为了理想而战！！！', 2.6, 'lt');
          burst(g, this.x, this.y, 30, ['#2e8b6f', '#5cbf9a', '#fff', '#ffd23b'], 280, 6, 0.6, 130);
          SFX.phaseRise();
          this.state = 'p3axe'; this.stateT = 0;
          this.p3.phase = 'p1'; this.p3.fireT = 1.2; this.p3.actT = 0;
        }
      }
    }

    /* ── P1 飞斧（投掷飞斧，命中火车部件则损毁；5 部件全毁 → P2）── */
    updateP3Axe(dt, g, p) {
      // 中高速横向飞空
      this.flyHover(dt, g, p, 1.0);
      this.p3.fireT -= dt;
      if (this.p3.fireT <= 0) {
        this.p3.fireT = rand(1.3, 1.9);
        this.throwAxe(g, p, 360);
      }
      // 火车全部损毁 → 大型爆炸 → P2
      if (this.train && this.train.partsLeft <= 0) {
        const tr = this.train;
        burst(g, tr.x + tr.w * 0.5, tr.y + tr.h * 0.5, 50,
          ['#ff7b2e', '#ffd23b', '#c94a1e', '#fff', '#3a4152'], 360, 8, 0.9, 150);
        SFX.explode(false); g.shake(16);
        this.train = null;            // 火车消失
        this.state = 'p3elec'; this.stateT = 0;
        this.p3.phase = 'p2'; this.p3.actT = 2.0; this.p3.cycle = 0;
        g.toast('火车彻底损毁！', 2.0, 'lt');
      }
    }

    /* ── P2 电击（飞至玩家上方，悬停瞄准 0.5s，释放直线电击弹，换位后投斧）── */
    updateP3Elec(dt, g, p) {
      const pp = this.p3;
      if (pp.actT > 0) {
        // 间隔期：悬停飞空
        pp.actT -= dt;
        this.flyHover(dt, g, p, 1.0);
        // 间隔中投一斧
        pp.fireT = (pp.fireT || 0) - dt;
        if (pp.fireT <= 0) { pp.fireT = 1.6; this.throwAxe(g, p, 360); }
        if (pp.actT <= 0) {
          // 飞至玩家上方
          pp.targetX = p.x;
          pp.targetY = clamp(p.y - 150, 60, CFG.GROUND_Y - 220);
          pp.sub = 'approach'; pp.subT = 0;
        }
        return;
      }
      // 子状态：approach → aim → bolt → reposition
      if (pp.sub === 'approach') {
        this.x += (pp.targetX - this.x) * dt * 4;
        this.y += (pp.targetY - this.y) * dt * 4;
        pp.subT += dt;
        if (pp.subT > 0.5 || Math.hypot(pp.targetX - this.x, pp.targetY - this.y) < 14) {
          pp.sub = 'aim'; pp.subT = 0;
        }
      } else if (pp.sub === 'aim') {
        pp.subT += dt;
        // 瞄准期间锁定玩家当前位置
        pp.boltA = Math.atan2(p.y - this.y, p.x - this.x);
        if (pp.subT >= 0.5) {
          // 释放电击弹（高速直线）
          this.fireEbolt(g, pp.boltA);
          pp.sub = 'reposition'; pp.subT = 0;
          // 目标：移到另一侧
          pp.targetX = this.x < CFG.W * 0.5 ? CFG.W * 0.78 : CFG.W * 0.22;
          pp.targetY = clamp(p.y - 40, 80, CFG.GROUND_Y - 180);
        }
      } else if (pp.sub === 'reposition') {
        this.x += (pp.targetX - this.x) * dt * 3.2;
        this.y += (pp.targetY - this.y) * dt * 3.2;
        pp.subT += dt;
        if (pp.subT > 0.7 || Math.hypot(pp.targetX - this.x, pp.targetY - this.y) < 18) {
          pp.cycle++;
          pp.sub = null;
          pp.actT = 2.4;   // 回到间隔期
          // 3 轮电击后 → P3 酒壶
          if (pp.cycle >= 3) {
            this.state = 'p3pot'; this.stateT = 0;
            this.p3.phase = 'p3';
            // 进入 5s 无敌
            this.phase3Invuln = this.phase3InvulnMax;
            g.toast('斧王进入无敌状态！', 1.8, 'lt');
            SFX.phaseRise();
            burst(g, this.x, this.y, 24, ['#ff3bd0', '#fff', '#ff8be0'], 260, 6, 0.6, 130);
          }
        }
      }
    }

    /* ── P3 酒壶炸弹（5s 无敌（仍持续投斧攻击） → 虚影碎裂 → 投掷酒壶抛物线，落地爆炸 + 8 向溅射）── */
    updateP3Pot(dt, g, p) {
      const pp = this.p3;
      // 无敌期间减速悬停 + 持续投斧攻击
      if (this.phase3Invuln > 0) {
        this.flyHover(dt, g, p, 0.4);
        pp.fireT = (pp.fireT || 0) - dt;
        if (pp.fireT <= 0) {
          pp.fireT = rand(1.0, 1.5);
          this.throwAxe(g, p, 360);
        }
        // 无敌结束瞬间：虚影碎裂效果
        if (this.phase3Invuln <= dt) {
          burst(g, this.x, this.y, 28, ['#ff3bd0', '#ff8be0', '#fff'], 300, 6, 0.7, 140);
          g.shake(8); SFX.phaseRise();
          g.toast('无敌解除！', 1.4, 'lt');
          pp.fireT = 0.5;
        }
        return;
      }
      // 无敌后：投掷酒壶
      this.flyHover(dt, g, p, 0.8);
      // dash 换位中
      if (pp.sub === 'dash') {
        this.x += (pp.targetX - this.x) * dt * 5;
        this.y += (pp.targetY - this.y) * dt * 5;
        pp.subT += dt;
        if (pp.subT > 0.5 || Math.hypot(pp.targetX - this.x, pp.targetY - this.y) < 20) {
          pp.sub = null;
          // 4 次酒壶完成 → P4 混合
          if ((pp.cycle || 0) >= 4) {
            this.state = 'p3mix'; this.stateT = 0;
            this.p3.phase = 'p4'; pp.cycle = 0; pp.fireT = 1.0; pp.sub = 'axe';
            return;
          }
        }
        return;
      }
      // 等待投壶计时
      pp.fireT = (pp.fireT || 0) - dt;
      if (pp.fireT <= 0) {
        pp.fireT = rand(1.8, 2.4);
        pp.cycle = (pp.cycle || 0) + 1;
        this.throwPot(g, p);
        // 爆炸间隙高速换位
        pp.targetX = this.x < CFG.W * 0.5 ? rand(CFG.W * 0.6, CFG.W * 0.85) : rand(CFG.W * 0.15, CFG.W * 0.4);
        pp.targetY = clamp(p.y - rand(80, 180), 60, CFG.GROUND_Y - 200);
        pp.sub = 'dash'; pp.subT = 0;
      }
    }

    /* ── P4 飞斧＋酒壶（循环：飞斧 → 换位 → 酒壶 → 电击）── */
    updateP3Mix(dt, g, p) {
      const pp = this.p3;
      this.flyHover(dt, g, p, 1.2);
      pp.fireT -= dt;
      if (pp.fireT <= 0) {
        if (pp.sub === 'axe') {
          this.throwAxe(g, p, 420);
          pp.fireT = 0.7; pp.sub = 'reposition';
        } else if (pp.sub === 'reposition') {
          pp.targetX = this.x < CFG.W * 0.5 ? rand(CFG.W * 0.6, CFG.W * 0.85) : rand(CFG.W * 0.15, CFG.W * 0.4);
          pp.targetY = clamp(p.y - rand(60, 160), 60, CFG.GROUND_Y - 200);
          pp.sub = 'pot'; pp.fireT = 0.5;
        } else if (pp.sub === 'pot') {
          this.throwPot(g, p);
          pp.sub = 'elec'; pp.fireT = 0.8;
        } else if (pp.sub === 'elec') {
          // 电击（蓄力 0.4s + 释放）
          pp.targetX = p.x; pp.targetY = clamp(p.y - 130, 60, CFG.GROUND_Y - 220);
          pp.boltA = Math.atan2(p.y - this.y, p.x - this.x);
          this.fireEbolt(g, pp.boltA);
          pp.sub = 'axe'; pp.fireT = 1.2;
          // 换位
          const tx = this.x < CFG.W * 0.5 ? CFG.W * 0.78 : CFG.W * 0.22;
          pp.targetX = tx; pp.targetY = clamp(p.y - 40, 80, CFG.GROUND_Y - 180);
          this.x += (pp.targetX - this.x) * 0.3;
        }
      } else if (pp.sub === 'reposition') {
        this.x += (pp.targetX - this.x) * dt * 5;
        this.y += (pp.targetY - this.y) * dt * 5;
      }
      // HP ≤ 35% → P5 狂暴
      if (this.hp <= this.maxHp * 0.35) {
        this.state = 'p3rage'; this.stateT = 0;
        this.p3.phase = 'p5'; pp.fireT = 0.8; pp.sub = 'axe'; pp.cycle = 0; pp.dashT = 0;
        g.toast('斧王狂暴了！', 2.0, 'lt');
        SFX.bossEnrage(); g.shake(12);
        burst(g, this.x, this.y, 30, ['#ff3b3b', '#ffd23b', '#fff', '#2e8b6f'], 300, 6, 0.7, 140);
      }
    }

    /* ── P5 狂暴（全速提升，16 向溅射，斧击突进，电击蓄力 0.3s）── 持续循环直到死亡 ── */
    updateP3Rage(dt, g, p) {
      const pp = this.p3;
      // 突进/归位期间禁用 flyHover，避免横向漂移与归位判定互相打架导致卡死
      const inDash = pp.sub === 'dash';
      if (!inDash) this.flyHover(dt, g, p, 1.5);
      pp.fireT -= dt;
      if (pp.fireT <= 0) {
        if (pp.sub === 'axe') {
          // 飞斧 + 斜向切入
          this.throwAxe(g, p, 480, true);
          pp.fireT = 0.55; pp.sub = 'pot';
        } else if (pp.sub === 'pot') {
          // 酒壶（16 向溅射）
          this.throwPot(g, p, true);
          pp.sub = 'elec'; pp.fireT = 0.5;
        } else if (pp.sub === 'elec') {
          // 电击蓄力 0.3s
          pp.boltA = Math.atan2(p.y - this.y, p.x - this.x);
          pp.fireT = 0.3; pp.sub = 'elecFire';
        } else if (pp.sub === 'elecFire') {
          this.fireEbolt(g, pp.boltA, 1.3);
          pp.sub = 'dash'; pp.fireT = 0.4; pp.dashT = 0; pp.subT = 0;
          // 斧击突进：锁定玩家方向
          pp.dashA = Math.atan2(p.y - this.y, p.x - this.x);
          pp.dashDone = false;
        }
      }
      // 斧击突进
      if (inDash && !pp.dashDone) {
        pp.dashT += dt;
        const dashSpd = 720;
        this.x += Math.cos(pp.dashA) * dashSpd * dt;
        this.y += Math.sin(pp.dashA) * dashSpd * dt;
        // 突进尾迹
        if (Math.random() < 0.8) {
          g.particles.push(new Particle(this.x, this.y, rand(-30, 30), rand(-30, 30), 0.4, rand(3, 6), '#ff3b3b'));
        }
        if (pp.dashT > 0.5 || this.x < 20 || this.x > CFG.W - 20 || this.y < 20 || this.y > CFG.GROUND_Y - 20) {
          pp.dashDone = true;
          // 拉开距离
          pp.targetX = this.x < CFG.W * 0.5 ? CFG.W * 0.8 : CFG.W * 0.2;
          pp.targetY = clamp(p.y - 60, 80, CFG.GROUND_Y - 180);
        }
      } else if (inDash && pp.dashDone) {
        pp.subT += dt;
        this.x += (pp.targetX - this.x) * dt * 4;
        this.y += (pp.targetY - this.y) * dt * 4;
        // 计时 0.7s 或距离足够近即回到飞斧，保证循环绝不卡死
        if (pp.subT > 0.7 || Math.hypot(pp.targetX - this.x, pp.targetY - this.y) < 30) {
          pp.sub = 'axe'; pp.fireT = 0.6;
        }
      }
      // 保险：异常子状态（如 dash 标记丢失）直接重启循环
      if (['axe', 'pot', 'elec', 'elecFire', 'dash'].indexOf(pp.sub) < 0) {
        pp.sub = 'axe'; pp.fireT = 0.3;
      }
    }

    /* ── 飞斧击中火车部件检测（车头宽 + 4 车厢等宽，各部件独立矩形）── */
    checkAxeHitTrain(dt, g) {
      if (!this.train || this.train.stopped === false) return;   // 火车未停或已消失不检测
      const tr = this.train;
      for (const b of g.bullets) {
        if (b.dead) continue;
        // 敌方飞斧（未命中玩家时击中火车）或 玩家子弹（主动轰击火车部件）
        const isEnemyAxe = b.kind === 'axe' && !b.friendly;
        const isPlayerShot = b.friendly;
        if (!isEnemyAxe && !isPlayerShot) continue;
        for (let i = 0; i < 5; i++) {
          const part = tr.parts[i];
          if (part.dead) continue;
          // 矩形碰撞：子弹进入部件区域（顶部留 12px 烟囱/车顶余量）
          if (b.x > part.x && b.x < part.x + part.w && b.y > tr.y + 10 && b.y < tr.y + tr.h) {
            part.dead = true;
            tr.partsLeft--;
            b.dead = true;
            // 范围爆炸：大火球 + 冲击波环 + 浓烟
            const cx = part.x + part.w * 0.5, cy = tr.y + tr.h * 0.45;
            burst(g, cx, cy, 34, ['#ff7b2e', '#ffd23b', '#c94a1e', '#fff', '#3a4152'], 360, 7, 0.7, 200);
            // 冲击波环（由 renderTrain 绘制为扩散圈）
            if (!tr.rings) tr.rings = [];
            tr.rings.push({ x: cx, y: cy, r: 8, vr: 380, t: 0, life: 0.5, color: '#ffd23b' });
            tr.rings.push({ x: cx, y: cy, r: 4, vr: 560, t: 0, life: 0.4, color: '#ff7b2e' });
            // 残骸带初速下沉（先微弹再坠落）
            part.sinkVy = rand(-120, -40);
            SFX.explode(false); g.shake(6);
            // 爆炸范围伤害
            const p = g.player;
            const d = Math.hypot(p.x - cx, p.y - cy);
            if (d < 110 + p.radius) p.hurt(Math.round(10 * g.atkScale), g, this.dsrc);
            if (tr.partsLeft <= 0) return;
            break;
          }
        }
      }
    }

    /* ── 辅助：飞空悬停（横向移动 + 正弦垂直）── spd 倍率控制速度档 ── */
    flyHover(dt, g, p, spd) {
      const v = (spd || 1) * 130;
      // 横向往返
      const targetX = this._hoverDir < 0 ? CFG.W * 0.22 : CFG.W * 0.78;
      if (this._hoverDir === undefined) this._hoverDir = 1;
      this.x += this._hoverDir * v * dt;
      if (this.x < CFG.W * 0.18) this._hoverDir = 1;
      if (this.x > CFG.W * 0.82) this._hoverDir = -1;
      // 火车（P0/P1）占下半屏时 Boss 只在上半屏飞；火车炸毁后恢复全空域
      const hoverMaxY = this.train ? CFG.H * 0.5 - 45 : CFG.GROUND_Y - 180;
      this.baseY = clamp(p.y - 60, 60, hoverMaxY);
      this.y += (this.baseY - this.y) * dt * 1.6;
      this.y += Math.sin(this.t * 2.4) * 14 * dt * 4;
    }

    /* ── 投掷飞斧（高速直线，朝玩家）── diag=true 增加斜向切入 ──
     *  阶段3 飞斧使用重绘精灵 dawang_3futou（双刃战斧+电光，p3spr 走精灵渲染分支）。 */
    throwAxe(g, p, speed, diag) {
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      const n = diag ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? (i - 1) * 0.28 : 0);
        g.bullets.push(new Bullet(this.x - 30, this.y - 10,
          Math.cos(a) * speed, Math.sin(a) * speed,
          { kind: 'axe', r: 15, dmg: 13 * g.atkScale, dmgScale: g.atkScale, life: 5,
            spinRate: 12, color: '#cfd8e3', src: this.dsrc, p3spr: true }));
      }
      SFX.enemyShoot();
    }

    /* ── 投掷酒壶（抛物线，落地爆炸 + N 向溅射）── big=true 16 向溅射 ── */
    throwPot(g, p, big) {
      // 抛物线：算到玩家当前位置的落点
      const tx = p.x, ty = clamp(p.y, 60, CFG.GROUND_Y - 20);
      const dx = tx - this.x, dy = ty - this.y;
      const tFly = 1.2;           // 飞行时间
      const g0 = 520;             // 重力（与 arrow 一致量级）
      const vx = dx / tFly;
      const vy = (dy - 0.5 * g0 * tFly * tFly) / tFly;
      const self = this;
      const b = new Bullet(this.x - 20, this.y, vx, vy,
        { kind: 'potbomb', r: 17, dmg: 16 * g.atkScale, dmgScale: g.atkScale, life: 5,
          grav: g0, spinRate: 6, src: this.dsrc });
      b.onExpire = (gg, bb) => {
        // 爆炸范围伤害
        const R = big ? 130 : 90;
        burst(gg, bb.x, bb.y, big ? 28 : 18, ['#3aa64a', '#5cd96a', '#7a4a22', '#fff'], 260, 6, 0.6, 110);
        SFX.explode(false); gg.shake(big ? 8 : 5);
        const pl = gg.player;
        const d = Math.hypot(pl.x - bb.x, pl.y - bb.y);
        if (d < R + pl.radius) pl.hurt(Math.round(bb.dmg * (d < R * 0.5 ? 1 : 0.6)), gg, bb.src);
        // N 向酒液溅射
        const dirs = big ? 16 : 8;
        for (let i = 0; i < dirs; i++) {
          const a = (TAU / dirs) * i + rand(-0.06, 0.06);
          const sp = (big ? 230 : 180) + rand(-20, 20);
          gg.bullets.push(new Bullet(bb.x, bb.y, Math.cos(a) * sp, Math.sin(a) * sp,
            { kind: 'liquid', r: 10, dmg: 9 * gg.atkScale, dmgScale: gg.atkScale, life: 4,
              spinRate: 4, src: self.dsrc }));
        }
      };
      g.bullets.push(b);
      SFX.enemyShoot();
    }

    /* ── 释放电击弹（高速直线子弹，电蓝色）── mul 速度倍率 ── */
    fireEbolt(g, ang, mul) {
      const sp = 620 * (mul || 1);
      const b = new Bullet(this.x, this.y + 10, Math.cos(ang) * sp, Math.sin(ang) * sp,
        { kind: 'bolt', r: 13, dmg: 14 * g.atkScale, dmgScale: g.atkScale, life: 2.2,
          color: '#7fe0ff', spinRate: 0, src: this.dsrc });
      // 电击拖尾色
      b.trailCols = ['#3b9eff', '#7fe0ff', '#ffffff'];
      b.fireTrail = true;
      g.bullets.push(b);
      SFX.warn();
    }

    /* ── 阶段3 渲染：火车 + 蜥蜴脸飞空形态 + 无敌光环 ── */
    renderP3(ctx) {
      // 火车（P0 入场及 P1 停留期间渲染）
      if (this.train) this.renderTrain(ctx);
      // P0 火车入场期间斧王尚未现身（藏在车里），不绘制本体
      if (this.state === 'p3train' && !(this.train && this.train.exploded)) return;

      // P3 酒壶无敌：玫红高亮度光环 + 虚影
      if (this.phase3Invuln > 0) {
        const k = this.phase3Invuln / this.phase3InvulnMax;
        const a = 0.45 + Math.sin(this.t * 18) * 0.25;
        ctx.save();
        ctx.globalAlpha = a;
        // 外层虚影（放大淡红拷贝）
        const ghost = 1 + Math.sin(this.t * 10) * 0.06 + (1 - k) * 0.1;
        ctx.shadowColor = '#ff3bd0'; ctx.shadowBlur = 36;
        ctx.strokeStyle = '#ff3bd0'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(this.x, this.y, 104 * ghost, 144 * ghost, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,139,224,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(this.x, this.y, 120 * ghost, 160 * ghost, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      // 蜥蜴脸飞空形态：dawang_3 240×304，缩放 0.68 → 显示约 163×207（约玩家 2 倍体积；精灵已朝左）
      const pulse = 1 + Math.sin(this.t * 4) * 0.025;
      const scl = 0.68 * pulse;
      drawBossSprite(ctx, Sprites.bossMan3L, this.x, this.y, scl, scl, Math.sin(this.t * 1.8) * 0.05, this.flash);
      // 斧击突进尾迹（P5 dash 时额外红光残影）
      if (this.state === 'p3rage' && this.p3.sub === 'dash' && !this.p3.dashDone) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 18;
        drawBossSprite(ctx, Sprites.bossMan3L, this.x, this.y, scl, scl, 0, 0);
        ctx.restore();
      }
    }

    /* ── 火车渲染（车体 + 5 部件状态 + 预警灯光）── */
    renderTrain(ctx) {
      const tr = this.train;
      const st = this.stateT;
      // P0 预警期（< 1s）：右下车头灯（源图车灯 y≈20/72）+ 光锥 + 烟尘
      if (this.state === 'p3train' && st < 1.0) {
        const lx = CFG.W - 30;
        const ly = tr.y + tr.h * (20 / 72);
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(this.t * 20) * 0.3;
        ctx.fillStyle = '#ffd23b';
        ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 40;
        ctx.beginPath(); ctx.arc(lx, ly, 16, 0, TAU); ctx.fill();
        // 光锥（车头朝左，光柱向左铺开）
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#bfeaff';
        ctx.beginPath();
        ctx.moveTo(lx, ly); ctx.lineTo(lx - 210, ly - 48); ctx.lineTo(lx - 210, ly + 48); ctx.closePath(); ctx.fill();
        ctx.restore();
        return;
      }
      // 车体：部件 0 = 车头（源图 sx0/sw58），部件 1..4 = 复制车厢（源图 sx58/sw48）
      if (Sprites.train && Sprites.train.width >= 106) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(tr.x, tr.y);
        for (let i = 0; i < 5; i++) {
          const part = tr.parts[i];
          const dx = i === 0 ? 0 : tr.engW + (i - 1) * tr.carW;
          const dw = part.w;
          ctx.save();
          if (part.dead) {
            // 残骸：随 sinkY 持续下沉，并随下沉距离渐隐（不裁剪，使其可坠落到车体下方）
            const sink = part.sinkY;
            const alpha = clamp(1 - sink / (tr.h * 1.6), 0, 1);
            if (alpha <= 0) { ctx.restore(); continue; }
            ctx.globalAlpha = alpha;
            ctx.translate(0, sink);
            ctx.fillStyle = '#141018';
            ctx.fillRect(dx + 5, tr.h * 0.32, dw - 10, tr.h * 0.52);
            ctx.fillStyle = '#2b2330';
            ctx.fillRect(dx + 12, tr.h * 0.42, dw - 24, tr.h * 0.3);
            ctx.fillStyle = '#5a2a1e';
            for (let e = 0; e < 3; e++) {
              ctx.fillRect(dx + 14 + e * (dw - 28) / 3, tr.h * 0.5 + (e % 2) * 12, 7, 5);
            }
            ctx.fillStyle = '#0d0f16';
            ctx.fillRect(dx, tr.h * 0.8, dw, tr.h * 0.2);
          } else {
            ctx.beginPath(); ctx.rect(dx, 0, dw, tr.h); ctx.clip();
            ctx.drawImage(Sprites.train, part.sx, 0, part.sw, 72, dx, 0, dw, tr.h);
          }
          ctx.restore();
        }
        ctx.restore();
      } else {
        // 兜底：纯色块（精灵尚未加载完时短暂出现）
        ctx.fillStyle = '#3a4152';
        ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
      }
      // 运动烟尘（横穿中，车尾右侧）
      if (!tr.stopped) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(200,200,210,0.6)';
        ctx.beginPath(); ctx.arc(tr.x + tr.w + 20, tr.y + 10, 14, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // 部件摧毁时的范围爆炸冲击波环（世界坐标）
      if (tr.rings) {
        for (const r of tr.rings) {
          const k = 1 - r.t / r.life;
          ctx.save();
          ctx.globalAlpha = k * 0.8;
          ctx.strokeStyle = r.color;
          ctx.lineWidth = 3 + k * 4;
          ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
          ctx.restore();
        }
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
            g.toast('怪客召唤了雷公小怪！', 2, 'lt');
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
              { kind: 'apple', r: 9, grav: 950, dmg: 12 * g.atkScale, dmgScale: g.atkScale, life: 5.5,
                trailCols: ['#7b1fa2', '#a020d8', '#c85cf0', '#e3a4ff', '#f6e4ff'] }));
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
          // 巨型十字弹：快速自转 → 高速追击玩家 → 逼近后绕屏幕边缘转一圈再碎裂
          // 命中玩家则怪客回复 20% 生命，每次十字弹招式仅可回复 1 次
          this.crossHealed = false;
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          g.bullets.push(new Bullet(this.x - 60, this.y,
            Math.cos(a) * 260, Math.sin(a) * 260,
            { kind: 'cross', r: 52, spinRate: 14, dmg: 22 * g.atkScale, dmgScale: g.atkScale, life: 12,
              onPlayerHit: (gg) => {
                if (this.crossHealed || this.dead) return;
                this.crossHealed = true;
                const heal = Math.round(this.maxHp * 0.2);
                this.hp = Math.min(this.maxHp, this.hp + heal);
                gg.toast(`十字弹命中！怪客回复 ${heal} 点生命（20%）！`, 2, 'lt');
                burst(gg, this.x, this.y, 18, ['#7CFC00', '#c8f98a', '#ffffff'], 220, 5, 0.6);
                SFX.levelup();
              } }));
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
      // guaike.png 224×288，缩放 1.06 → 显示约 237×305（与原像素精灵 8.5 倍尺寸一致）
      const bob = Math.abs(Math.sin(this.t * 5)) * -12;
      drawBossSprite(ctx, Sprites.strangerL, this.x, this.y + bob, 1.06, 1.06, this.bodyAngle + Math.sin(this.t * 3) * 0.04, this.flash);
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
      this.deathCols = ['#7cae3a', '#5a7d24', '#b8860b', '#f2edbc', '#8a5a2b'];
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
            // 蛙哥落地常贴玩家脸：爪击仅贴脸(<150)优先，舌头从中近距(>60)即可吐（舌头贯穿全屏），
            // 避免贴身时舌头永远达不到旧的 dist>140 触发线而"打不出来"
            if (dist < 150 && this.clawCd <= 0) { this.state = 'clawWind'; this.stateT = 0; }
            else if (this.tongueCd <= 0 && dist > 60) { this.state = 'tongueWind'; this.stateT = 0; }
            else if (this.chargeCd <= 0 && dist > 160) { this.state = 'chargeWind'; this.stateT = 0; }
            else if (dist < 200 && this.clawCd <= 0) { this.state = 'clawWind'; this.stateT = 0; }
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
        if (this.stateT > 0.32) { this.state = 'clawHit'; this.stateT = 0; g.shake(6); SFX.hit(true); }   // Boss 爪击：关键事件强制播放
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
            p.hurt(Math.round(8 * g.atkScale), g, this.dsrc);
            g.toast('被蛙哥卷住了！', 1.2, 'lt');
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
          g.toast('蛙哥猛冲！', 1.2, 'lt');
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
      // 身体（压扁表现蓄力/腾空拉伸）；Wage.png 448×352，缩放 0.82 → 显示约 367×289
      const FS = 0.82, FH = 352;
      let sy = 1;
      if (this.state === 'chargeWind') sy = 0.78 + Math.sin(this.stateT * 22) * 0.05;
      else if (!this.onGround) sy = 1.08;
      const w = FS, h = FS * sy;
      drawBossSprite(ctx, Sprites.frogL, this.x, this.y + (FS * FH - h * FH) / 2, w, h, 0, this.flash);
      // 舌头（细、深红、带黑边；初射点为口腔）
      if (this.tongue) {
        const tg = this.tongue;
        const mouthX = this.x - 36, mouthY = this.y + 9;
        const tipX = mouthX + Math.cos(this.tongueAng) * tg.len;
        const tipY = mouthY + Math.sin(this.tongueAng) * tg.len;
        const TW = 26, TR = 30;
        // 黑边
        ctx.strokeStyle = '#1a0a08'; ctx.lineWidth = TW + 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(mouthX, mouthY); ctx.lineTo(tipX, tipY); ctx.stroke();
        ctx.fillStyle = '#1a0a08';
        ctx.beginPath(); ctx.arc(tipX, tipY, TR + 5, 0, TAU); ctx.fill();
        // 深红主体
        ctx.strokeStyle = '#b83a2a'; ctx.lineWidth = TW;
        ctx.beginPath(); ctx.moveTo(mouthX, mouthY); ctx.lineTo(tipX, tipY); ctx.stroke();
        ctx.fillStyle = '#c94a38';
        ctx.beginPath(); ctx.arc(tipX, tipY, TR, 0, TAU); ctx.fill();
      }
      // 爪击挥影（新美术左爪/火把位于身体左侧）
      if (this.state === 'clawHit') {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 6;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(this.x - 100, this.y, 80 + i * 22, Math.PI * 0.75, Math.PI * 1.25);
          ctx.stroke();
        }
      }
    }
  }

  /* ================ C2. 鹤仙（特殊机制：双阶段） ================
   * P1（第一条血）：羽针 needles → 鹤鸣 cry → 俯冲 dive → 旋羽 whirl 固定循环，间隔 3.6-4.6s；
   *                半血后每 3 个技能插播 1 次万羽天葬 burial，间隔缩短 3.0-3.8s。
   * 阶段转换：第一条血打完（HP≤0）→ 血量回满 + 锁血10s（全身闪蓝 + 气波冲击）
   * P2（第二条血）：持续飞行 + 4浮空镜面反射激光 + 双龙卷风 + 高速风刃/风炮
   * ---------------------------------------------------------------- */
  class CraneSage extends Boss {
    constructor(g) {
      super(g, 20, 88);
      this.bossName = '鹤仙';
      this.title = '特殊机制型';
      this.hoverX = 660;
      // —— P1 技能序列字段（原版）——
      this.phase = 1;               // 1 / 2（大阶段；俯冲子阶段用 divePhase）
      this.skillT = 2.6;
      this.seq = 0;                 // 技能序列：羽针→鹤鸣→俯冲→旋羽（→天葬）
      this.needles = [];            // 已发射羽针 {b,t,boosted}（3.2s 后提速）
      this.whirlOrbs = [];
      this.fallMarks = [];          // 万羽天葬落点预警 { x, t }
      this.waveIdx = 0; this.waveT = 0;
      this.fallRound = 0; this.fallT = 0;
      this.needleN = 0; this.needleT = 0;
      this.divePhase = null;        // 俯冲子阶段：up/aim/fall/blast
      // —— P2 风之机制字段 ——
      this.act = null;              // P2 子状态机
      this.actT = 0;
      this.actFired = false;        // 当前子状态是否已触发一次性动作
      this.tornadoes = [];           // {x,t,dir,spd,freq,amp,ph,life,hitCd,topR,botR,height,spin,born}
      this.mirrors = [];             // {x,y,ang,spin,t,born,dy,hp,maxHp,flash,dead,size}
      this.beams = [];               // {segs:[{x1,y1,x2,y2}],t,warn,active,dealt,dmg,dead}
      this.shockwaves = [];          // {x,y,r,vr,t,life,dmg,dealt}
      this.blueFlash = 0;           // 阶段转换蓝闪强度 0..1
      this.teleFade = 0;            // 瞬移淡入淡出 0=可见 1=不可见
      this.teleTarget = null;       // 瞬移目标点
      this.teleGlow = [];            // 瞬移残影点 {x,y,t}
      this.cannonN = 0;             // 风炮已发数
      this.cannonT = 0;             // 风炮发射计时
      this.phaseTransT = 0;         // 锁血剩余秒数
      this.spinAng = 0;             // Boss 旋转角度（生成龙卷风时的高速自旋）
      this.spinT = 0;               // 自旋剩余时间
      this._contactBase = this.contactDmg;   // 基础接触伤害（瞬移/锁血期间置 0）
      this.deathCols = ['#f4f6f2', '#7fd8ff', '#3a8f9e', '#bfe9ff', '#fff'];
    }
    /* ---------- 伤害与阶段转换（唯一权威入口） ---------- */
    takeDamage(dmg, g) {
      if (this.dead || this.state === 'enter' || this.state === 'phaseTrans') return;   // 入场/锁血免伤
      this.hp -= dmg;
      this.hitFlash();
      if (Math.random() < 0.3) burst(g, this.x - 14, this.y, 2, ['#7fd8ff', '#fff'], 130, 3, 0.18);
      // P1：第一条血打完（锁血到 0，防高爆发跳过阶段机）→ 转阶段
      if (this.phase === 1) {
        if (this.hp <= 0) { this.hp = 0; this.startPhaseTrans(g); }
        return;
      }
      // P2：正常死亡
      if (this.hp <= 0) { this.hp = 0; this.die(g); }
    }
    startPhaseTrans(g) {
      this.hp = this.maxHp;                 // 第二条血回满
      this.phase = 2;
      this.state = 'phaseTrans';
      this.stateT = 0;
      this.phaseTransT = 10;               // 锁血10s
      this.blueFlash = 1.0;
      this.contactDmg = 0;                 // 锁血期不造成接触伤害
      this.act = null;
      this.divePhase = null;
      // P1 残留实体清理
      this.needles.length = 0;
      this.whirlOrbs.length = 0;
      this.fallMarks.length = 0;
      // 形成气波：中半径冲击波驱离贴脸玩家
      this.shockwaves.push({ x: this.x, y: this.y, r: 24, vr: 460, t: 0, life: 1.0,
        dmg: Math.round(20 * g.atkScale), dealt: false });
      g.toast('鹤仙·第二阶段！', 2.4, 'lt');
      SFX.phaseRise(); g.shake(10);
      // 清理残留敌方弹幕与场上龙卷风/镜子/激光
      g.bullets.forEach(b => { if (!b.friendly) b.neutralize(); });
      this.tornadoes.length = 0;
      this.mirrors.length = 0;
      this.beams.length = 0;
      this.teleGlow.length = 0;
    }
    die(g) {
      this.tornadoes.length = 0;
      this.mirrors.length = 0;
      this.beams.length = 0;
      this.shockwaves.length = 0;
      this.needles.length = 0;
      this.whirlOrbs.length = 0;
      this.fallMarks.length = 0;
      super.die(g);
    }
    /* ---------- 主更新 ---------- */
    update(dt, g) {
      this.t += dt; this.stateT += dt; this.actT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.blueFlash = Math.max(0, this.blueFlash - dt * 0.4);
      // Boss 自旋（P2 生成龙卷风时高速旋转，衰减回 0）
      if (this.spinT > 0) {
        this.spinT -= dt;
        this.spinAng += dt * 18;
      } else {
        this.spinAng *= (1 - dt * 4);
      }
      this.commonMove(dt);
      const p = g.player;

      // 场上实体更新
      this.updateTornadoes(dt, g, p);
      this.updateMirrors(dt, g);
      this.updateBeams(dt, g, p);
      this.updateShockwaves(dt, g, p);
      for (let i = this.teleGlow.length - 1; i >= 0; i--) {
        this.teleGlow[i].t -= dt;
        if (this.teleGlow[i].t <= 0) this.teleGlow.splice(i, 1);
      }

      if (this.state === 'enter') {
        this.x -= 150 * dt;
        this.y = this.baseY + Math.sin(this.t * 2) * 30;
        if (this.x <= this.hoverX) { this.state = 'fight'; this.stateT = 0; }
        return;
      }
      if (this.state === 'phaseTrans') this.updatePhaseTrans(dt, g, p);
      else if (this.state === 'p2') this.updateP2(dt, g, p);
      else this.updateP1States(dt, g, p);   // fight/needles/cry/dive/whirl/burialUp/burial
    }
    /* ---------- P1：羽针 / 鹤鸣 / 俯冲 / 旋羽 / 万羽天葬（原版恢复） ---------- */
    updateP1States(dt, g, p) {
      // 羽针 3.2s 未被击毁 → 高速冲刺（任何状态都计时）
      this.needles = this.needles.filter(n => !n.b.dead);
      for (const n of this.needles) {
        n.t -= dt;
        if (n.t <= 0 && !n.boosted) {
          n.boosted = true;
          n.b.vx *= 1.45; n.b.vy *= 1.45; n.b.turnRate = 2.6;
          burst(g, n.b.x, n.b.y, 5, ['#fff', '#c9d2cc'], 140, 3, 0.25);
        }
      }
      // 万羽天葬落点预警计时（任何状态都结算）
      this.fallMarks = this.fallMarks.filter(m => {
        m.t -= dt;
        if (m.t <= 0) {
          g.bullets.push(new Bullet(m.x, -30, 0, 430,
            { kind: 'feather', r: 9, dmg: Math.round(12 * g.atkScale), life: 4, color: '#f4f6f2' }));
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
          if (next === 'cry') { this.waveIdx = 0; this.waveT = 0.7; g.toast('鹤鸣震荡！', 1.2, 'lt'); SFX.sweep(); }
          if (next === 'needles') { this.needleN = 0; this.needleT = 0.1; }
          if (next === 'dive') { g.toast('鹤仙入天！', 1.2, 'lt'); }
          if (next === 'whirl') { this.spawnWhirl(g); g.toast('旋羽领域！', 1.2, 'lt'); }
        }
      }
      else if (this.state === 'needles') {
        this.hoverDrift(dt, p);
        this.needleT -= dt;
        if (this.needleT <= 0 && this.needleN < 5) {
          this.needleN++; this.needleT = 0.36;
          const a = Math.atan2(p.y - this.y, p.x - this.x) + rand(-0.3, 0.3);
          const b = new Bullet(this.x - 60, this.y - 25,
            Math.cos(a) * 350, Math.sin(a) * 350,
            { kind: 'feather', r: 7, dmg: Math.round(13 * g.atkScale), life: 7, color: '#fff',
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
          // 三层声波圈：速度不同均可扩散至全屏；疏密交替（密 24 / 疏 14 / 密 24）
          const speeds = [150, 210, 280];
          const counts = [24, 14, 24];
          const sp = speeds[this.waveIdx];
          const n = counts[this.waveIdx];
          for (let i = 0; i < n; i++) {
            const a = i * TAU / n + this.waveIdx * 0.21;
            g.bullets.push(new Bullet(this.x - 50, this.y - 25, Math.cos(a) * sp, Math.sin(a) * sp,
              { kind: 'wave', r: this.waveIdx === 1 ? 15 : 13, dmg: Math.round(11 * g.atkScale), life: 7, color: '#38bdf8' }));
          }
          this.waveIdx++; this.waveT = 0.55;
          g.shake(3); SFX.enemyShoot();
        }
        if (this.waveIdx >= 3 && this.stateT > 3.2) { this.state = 'fight'; this.stateT = 0; }
      }
      else if (this.state === 'dive') {
        // 子阶段：up → aim → fall → blast
        if (!this.divePhase || this.divePhase === 'up') {
          this.divePhase = 'up';
          this.x += (this.hoverX - this.x) * dt * 2;
          this.y += (-70 - this.y) * dt * 2.4;
          if (this.stateT > 0.9 && this.y < -20) { this.divePhase = 'aim'; this.stateT = 0; this.aim = { x: p.x }; }
        } else if (this.divePhase === 'aim') {
          // 顶部悬停锁定，落点预警
          this.aim.x += (p.x - this.aim.x) * dt * 2.0;
          if (this.stateT > 0.85) {
            this.divePhase = 'fall';
            this.x = this.aim.x; this.y = -40;
            this.contactDmg = Math.round(26 * g.atkScale);
            SFX.dash(); g.shake(4);
          }
        } else if (this.divePhase === 'fall') {
          this.y += 780 * dt;
          if (this.y >= CFG.GROUND_Y - 64) {
            this.divePhase = 'blast'; this.stateT = 0;
            this.contactDmg = this._contactBase;
            g.shake(10);
            burst(g, this.x, CFG.GROUND_Y - 30, 16, ['#fff', '#c9d2cc', '#8a5a2b'], 260, 5, 0.5);
            for (let i = 0; i < 8; i++) {
              const a = i * TAU / 8;
              g.bullets.push(new Bullet(this.x, CFG.GROUND_Y - 60, Math.cos(a) * 250, Math.sin(a) * 250,
                { kind: 'wave', r: 12, dmg: Math.round(12 * g.atkScale), life: 3, color: '#38bdf8' }));
            }
            SFX.explode();
          }
        } else if (this.divePhase === 'blast') {
          // 回归
          this.y += (this.baseY - this.y) * dt * 2.2;
          if (this.stateT > 0.7) { this.divePhase = null; this.state = 'fight'; this.stateT = 0; }
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
          g.toast('万羽天葬！', 1.6, 'lt'); SFX.sweep(); g.shake(5);
        }
      }
      else if (this.state === 'burial') {
        this.fallT -= dt;
        if (this.fallT <= 0 && this.fallRound < 4) {
          // 新一轮落羽：全屏宽度投放，后期密度增大、预警更短
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
          { kind: 'feather', r: 8, dmg: Math.round(11 * g.atkScale), life: 5.0, color: '#fff' });
        b.orbit = { ang, angSpd: 2.2, radius: 70, grow: 90, pivot: () => this.dead ? null : { x: this.x, y: this.y } };
        this.whirlOrbs.push(b);
        g.bullets.push(b);
      }
      SFX.enemyShoot();
    }
    /* ---------- 阶段转换：锁血10s（无敌但持续攻击） ---------- */
    updatePhaseTrans(dt, g, p) {
      // 缓慢升至场中高空
      this.baseY += (CFG.H * 0.34 - this.baseY) * dt * 0.8;
      this.y = this.baseY + Math.sin(this.t * 1.5) * 18;
      this.x += (CFG.W * 0.5 - this.x) * dt * 0.8;
      this.phaseTransT -= dt;
      // 蓝光粒子环绕
      if (Math.random() < 0.6) {
        g.particles.push(new Particle(
          this.x + rand(-44, 44), this.y + rand(-54, 54),
          rand(-30, 30), rand(-50, -10), rand(0.4, 0.8), rand(3, 6), '#7fd8ff'));
      }
      // 锁血期持续攻击：风炮连射
      this.cannonT = (this.cannonT || 0) - dt;
      if (this.cannonT <= 0) {
        this.cannonT = 0.28;
        this.fireWindCannon(g, p);
      }
      if (this.phaseTransT <= 0) {
        this.state = 'p2'; this.stateT = 0;
        this.contactDmg = this._contactBase;
        // 入 P2 冲击波
        this.shockwaves.push({ x: this.x, y: this.y, r: 20, vr: 500, t: 0, life: 1.0,
          dmg: Math.round(18 * g.atkScale), dealt: false });
        g.shake(8); SFX.phaseRise();
        this.blueFlash = 0.6;
        this.setAct('fly');
      }
    }
    /* ---------- P2：飞行 + 镜面 + 反射激光 + 双龙卷风 + 风刃 ---------- */
    updateP2(dt, g, p) {
      // P2 持续飞行，攻击频率更高
      this.baseY += (clamp(p.y + 10, 100, CFG.GROUND_Y - 160) - this.baseY) * dt * 1.4;
      this.y = this.baseY + Math.sin(this.t * 2.2) * 50;
      this.x = this.hoverX + Math.sin(this.t * 1.1) * 100;

      if (this.act === 'fly') {
        if (this.actT > 0.8) this.setAct('placeMirrors');
      }
      else if (this.act === 'placeMirrors') {
        if (!this.actFired) { this.actFired = true; this.placeMirrors(g); g.toast('镜面阵！', 0.9, 'lt'); }
        if (this.actT > 0.7) this.setAct('reflectLaser');
      }
      else if (this.act === 'reflectLaser') {
        if (!this.actFired && this.actT > 0.25) { this.actFired = true; this.fireReflectLaser(g, p); }
        if (this.actT > 1.5) this.setAct('dualTornadoSpin');
      }
      else if (this.act === 'dualTornadoSpin') {
        // Boss 旋转蓄力 → 双龙卷风（用独立标志，场上旧龙卷风不阻塞新生成）
        if (!this.actFired && this.actT > 0.15) {
          this.actFired = true;
          this.spinT = 0.45;
          g.toast('双龙卷风！', 0.9, 'lt');
        }
        if (this.actT > 0.6 && this.spinT <= 0 && !this._tornSpawned) {
          this._tornSpawned = true;
          this.spawnTornado(g, p, 2);
        }
        if (this.actT > 1.6) this.setAct('windBlade');
      }
      else if (this.act === 'windBlade') {
        if (!this.actFired && this.actT > 0.2) { this.actFired = true; this.fireWindBlade(g, p); }
        if (this.actT > 0.8) { this.cannonN = 0; this.cannonT = 0.1; this.setAct('rapidCannon'); }
      }
      else if (this.act === 'rapidCannon') {
        // P2 追加：快速 8 发风炮连射（提升密度）
        this.hoverDrift(dt, p, 0.8);
        this.cannonT -= dt;
        if (this.cannonT <= 0 && this.cannonN < 8) {
          this.cannonN++; this.cannonT = 0.1;
          this.fireWindCannon(g, p);
        }
        if (this.cannonN >= 8 && this.actT > 0.3) {
          this.pickTelePos(g); this.setAct('teleportEnd');
        }
      }
      else if (this.act === 'teleportEnd') {
        this.updateTeleport(dt, g, () => this.setAct('fly'));
      }
    }
    /* ---------- 瞬移通用逻辑 ---------- */
    updateTeleport(dt, g, onDone) {
      // 0~0.13s 淡出；0.13~0.17s 瞬移跳点；0.17~0.4s 淡入；0.4s 完成
      if (this.actT < 0.13) {
        this.teleFade = this.actT / 0.13;
        this.contactDmg = 0;
      } else if (this.actT < 0.17) {
        if (this.teleTarget) {
          // 残影点（旧位置）
          for (let i = 0; i < 12; i++) {
            this.teleGlow.push({ x: this.x + rand(-36, 36), y: this.y + rand(-48, 48), t: 0.45 });
          }
          this.x = this.teleTarget.x; this.y = this.teleTarget.y;
          this.baseY = this.y;
          this.teleTarget = null;
          // 新位置爆点
          burst(g, this.x, this.y, 14, ['#7fd8ff', '#bfe9ff', '#fff'], 180, 5, 0.4);
          // 落点环形气波
          this.teleGlow.push({ x: this.x, y: this.y, t: 0.5 });
          SFX.craneTele();
        }
      } else if (this.actT < 0.4) {
        this.teleFade = 1 - (this.actT - 0.17) / 0.23;
      } else {
        this.teleFade = 0;
        this.contactDmg = this._contactBase;
        onDone();
      }
    }
    pickTelePos(g) {
      this.teleTarget = {
        x: rand(CFG.W * 0.22, CFG.W * 0.78),
        y: rand(110, CFG.GROUND_Y - 210)
      };
    }
    setAct(act) { this.act = act; this.actT = 0; this.actFired = false; this._tornSpawned = false; }
    /* ---------- 攻击：风炮（P2 更大更密 + 风拖尾） ---------- */
    fireWindCannon(g, p) {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const p2 = this.phase === 2;
      const r = p2 ? 12 : 8;
      const dmg = Math.round((p2 ? 14 : 11) * g.atkScale);
      const opts = { kind: 'windBolt', r, dmg, life: 4, angle: a };
      if (p2) opts.trailCols = ['#bfe9ff', '#5fd0f0', '#1d6f7e'];   // P2 风拖尾
      g.bullets.push(new Bullet(this.x - 50, this.y - 20,
        Math.cos(a) * 520, Math.sin(a) * 520, opts));
      SFX.craneWind();
    }
    /* ---------- 攻击：风刃（P2：5 发扇形 + 风拖尾 + 更大） ---------- */
    fireWindBlade(g, p) {
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      const p2 = this.phase === 2;
      const r = p2 ? 13 : 9;
      const dmg = Math.round((p2 ? 16 : 13) * g.atkScale);
      const n = p2 ? 5 : 3;
      const spread = p2 ? 0.22 : 0.3;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * spread;
        const a = base + off;
        const opts = { kind: 'windBlade', r, dmg, life: 4, angle: a, spinRate: 8 };
        if (p2) opts.trailCols = ['#bfe9ff', '#5fd0f0', '#1d6f7e'];
        g.bullets.push(new Bullet(this.x - 40, this.y - 10,
          Math.cos(a) * 440, Math.sin(a) * 440, opts));
      }
      SFX.craneWind();
    }
    /* ---------- 攻击：龙卷风（漏斗形：上宽下窄，贴地蛇形横移，留顶部空隙） ---------- */
    spawnTornado(g, p, count) {
      for (let i = 0; i < count; i++) {
        const sx = count === 1
          ? rand(CFG.W * 0.3, CFG.W * 0.7)
          : (i === 0 ? CFG.W * 0.28 : CFG.W * 0.72);
        // 龙卷风底部贴地，高度约 300px，顶部在 GROUND_Y-300=170，与屏幕顶(40)留 130px 空隙
        const dir = p.x > sx ? 1 : -1;   // 初始朝玩家方向横移
        this.tornadoes.push({
          x: sx, t: 0,
          dir, spd: 65, freq: 1.6, amp: 0.5, ph: rand(0, TAU),
          life: 9, hitCd: 0,
          topR: 48, botR: 14, height: 300,
          spin: 0, born: 0   // born: 0→1 渐入动画
        });
      }
      SFX.craneTornado();
    }
    updateTornadoes(dt, g, p) {
      for (let i = this.tornadoes.length - 1; i >= 0; i--) {
        const t = this.tornadoes[i];
        t.t += dt; t.life -= dt; t.spin += dt * 7;
        t.born = Math.min(1, t.born + dt * 3);
        if (t.hitCd > 0) t.hitCd -= dt;
        // 蛇形横移：方向 dir ± 正弦摆动（仅水平移动，贴地不动）
        const sway = Math.sin(t.t * t.freq + t.ph) * t.amp;
        const moveDir = t.dir + sway * 0.6;
        t.x += moveDir * t.spd * dt;
        // 左右边界反弹
        if (t.x < 50) { t.x = 50; t.dir = 1; }
        if (t.x > CFG.W - 50) { t.x = CFG.W - 50; t.dir = -1; }
        // 接触判定：漏斗形主体（底部 y=GROUND_Y，顶部 y=GROUND_Y-height）
        // 玩家在漏斗高度范围内、水平距离 < 该高度处的漏斗半径时受伤
        const botY = CFG.GROUND_Y;
        const topY = CFG.GROUND_Y - t.height;
        if (p.y > topY && p.y < botY) {
          const yt = (p.y - topY) / t.height;   // 0=顶部 1=底部
          const curR = t.topR + (t.botR - t.topR) * yt;
          if (t.hitCd <= 0 && Math.abs(t.x - p.x) < curR + p.radius * 0.6) {
            t.hitCd = 0.5;
            p.hurt(Math.round(14 * g.atkScale), g, this.dsrc);
            burst(g, p.x, p.y, 5, ['#7fd8ff', '#fff'], 150, 3, 0.25);
          }
        }
        if (t.life <= 0 || this.dead) this.tornadoes.splice(i, 1);
      }
    }
    /* ---------- 镜面（P2，可被玩家击碎，至少 10 下；每轮仅补齐缺失位） ---------- */
    placeMirrors(g) {
      const ps = [
        { x: CFG.W * 0.22, y: CFG.GROUND_Y - 200 },
        { x: CFG.W * 0.78, y: CFG.GROUND_Y - 200 },
        { x: CFG.W * 0.32, y: CFG.GROUND_Y - 340 },
        { x: CFG.W * 0.68, y: CFG.GROUND_Y - 340 }
      ];
      let spawned = 0;
      for (const pos of ps) {
        // 该位置 60px 内已有存活镜子则保留（不重置玩家已打掉的血量）
        const exists = this.mirrors.some(m => !m.dead && Math.hypot(m.x - pos.x, m.y - pos.y) < 60);
        if (!exists) {
          this.mirrors.push({ x: pos.x, y: pos.y, ang: rand(0, TAU), spin: 1.4, t: 0, born: 0, dy: 0,
            hp: 10, maxHp: 10, flash: 0, dead: false, size: 22 });
          spawned++;
        }
      }
      if (spawned > 0) SFX.craneMirror();
    }
    updateMirrors(dt, g) {
      for (let i = this.mirrors.length - 1; i >= 0; i--) {
        const m = this.mirrors[i];
        m.t += dt;
        m.born = Math.min(1, m.born + dt * 2);
        m.ang += m.spin * dt;
        m.dy = Math.sin(m.t * 1.5) * 8;
        m.flash = Math.max(0, m.flash - dt * 4);
        // 死亡后渐隐
        if (m.dead) {
          m.born -= dt * 3;
          if (m.born <= 0) this.mirrors.splice(i, 1);
        }
      }
      // 玩家子弹 vs 镜面
      for (const b of g.bullets) {
        if (!b.friendly || b.dead) continue;
        for (const m of this.mirrors) {
          if (m.dead) continue;
          const s = m.size * m.born;
          if (s < 4) continue;
          const dx = b.x - m.x, dy = b.y - (m.y + m.dy);
          if (dx * dx + dy * dy < (s + b.r) * (s + b.r)) {
            m.hp--;
            m.flash = 1;
            b.dead = true;
            burst(g, b.x, b.y, 4, ['#bfe9ff', '#fff', '#5fd0f0'], 140, 3, 0.22);
            SFX.melee();
            if (m.hp <= 0) {
              m.dead = true;
              // 镜面碎裂：玻璃飞溅粒子 + 冲击波
              burst(g, m.x, m.y + m.dy, 18, ['#bfe9ff', '#5fd0f0', '#fff', '#1d6f7e'], 240, 5, 0.5);
              this.shockwaves.push({ x: m.x, y: m.y + m.dy, r: 12, vr: 320, t: 0, life: 0.5,
                dmg: 0, dealt: true });   // 纯视觉气波（无伤害）
              g.shake(4);
              SFX.explode();
            }
            break;
          }
        }
      }
    }
    /* ---------- 反射激光（boss → mirror → 延伸方向，P2 多发齐射） ---------- */
    fireReflectLaser(g, p) {
      const alive = this.mirrors.filter(m => !m.dead && m.born > 0.5);
      if (alive.length === 0) return;
      // P2：同时打 2 面镜子（提升密度），P1 路径不会走到这
      const n = Math.min(2, alive.length);
      const picked = [];
      for (let k = 0; k < n; k++) {
        let m;
        do { m = alive[randi(0, alive.length - 1)]; }
        while (picked.includes(m));
        picked.push(m);
        const seg1 = { x1: this.x, y1: this.y, x2: m.x, y2: m.y };
        const dx = p.x - m.x, dy = p.y - m.y;
        const len = Math.hypot(dx, dy) || 1;
        const seg2 = { x1: m.x, y1: m.y, x2: m.x + dx / len * 900, y2: m.y + dy / len * 900 };
        this.beams.push({
          segs: [seg1, seg2], t: 0, warn: 0.7, active: 0.4,
          dealt: false, dead: false, dmg: Math.round(16 * g.atkScale)
        });
      }
      SFX.craneLaser();
    }
    updateBeams(dt, g, p) {
      for (let i = this.beams.length - 1; i >= 0; i--) {
        const b = this.beams[i];
        b.t += dt;
        if (b.t >= b.warn && !b.dealt) {
          b.dealt = true;
          g.shake(6); SFX.zap();
          for (const seg of b.segs) {
            const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
            const tt = clamp(((p.x - seg.x1) * dx + (p.y - seg.y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
            const cx = seg.x1 + dx * tt, cy = seg.y1 + dy * tt;
            burst(g, cx, cy, 8, ['#7fd8ff', '#fff', '#5fd0f0'], 180, 4, 0.3);
            if ((p.x - cx) ** 2 + (p.y - cy) ** 2 < (11 + p.radius * 0.7) ** 2) {
              p.hurt(b.dmg, g, this.dsrc);
            }
          }
        }
        if (b.t > b.warn + b.active) b.dead = true;
        if (b.dead) this.beams.splice(i, 1);
      }
    }
    /* ---------- 气波冲击 ---------- */
    updateShockwaves(dt, g, p) {
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const s = this.shockwaves[i];
        s.t += dt;
        s.r += s.vr * dt;
        s.vr *= (1 - dt * 0.8);
        // 环带判定
        if (!s.dealt && s.t > 0.08 && s.dmg > 0) {
          const d = Math.hypot(p.x - s.x, p.y - s.y);
          if (d < s.r + 28 && d > s.r - 28) {
            s.dealt = true;
            p.hurt(s.dmg, g, this.dsrc);
          }
        }
        if (s.t > s.life) this.shockwaves.splice(i, 1);
      }
    }
    /* ---------- 渲染 ---------- */
    render(ctx) {
      // 龙卷风
      this.renderTornadoes(ctx);
      // 镜面
      this.renderMirrors(ctx);
      // 反射激光
      this.renderBeams(ctx);
      // 气波
      this.renderShockwaves(ctx);
      // —— P1 特效：万羽天葬落点预警圈（地面红色脉动圈）——
      for (const m of this.fallMarks) {
        const blink = Math.floor(this.t * 10) % 2 === 0;
        if (blink) {
          ctx.strokeStyle = 'rgba(255,60,60,0.85)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(m.x, CFG.GROUND_Y - 18, 16, 0, TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,120,120,0.5)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(m.x, CFG.GROUND_Y - 18, 22, 0, TAU); ctx.stroke();
        }
      }
      // —— P1 特效：俯冲锁定地面红色预警条 ——
      if (this.state === 'dive' && this.divePhase === 'aim' && this.aim) {
        const on = Math.floor(this.stateT * 12) % 2 === 0;
        if (on) {
          ctx.save();
          ctx.strokeStyle = '#ff3838'; ctx.lineWidth = 5; ctx.setLineDash([16, 10]);
          ctx.beginPath();
          ctx.moveTo(this.aim.x, 0); ctx.lineTo(this.aim.x, CFG.GROUND_Y);
          ctx.stroke();
          ctx.restore();
        }
      }
      // 瞬移残影
      for (const gl of this.teleGlow) {
        const a = clamp(gl.t / 0.4, 0, 1);
        ctx.fillStyle = `rgba(120,220,255,${a * 0.5})`;
        ctx.beginPath(); ctx.arc(gl.x, gl.y, 6 * a + 2, 0, TAU); ctx.fill();
      }
      // Boss 本体（瞬移淡入淡出；Hexian.png 272×416，缩放 0.8125）
      const alpha = 1 - this.teleFade;
      if (alpha > 0.02) {
        ctx.save();
        ctx.globalAlpha = alpha;
        // 角度：待机微倾 + P2 自旋 + 俯冲下落时精灵旋转 90° 垂直
        let ang = Math.sin(this.t * 2) * 0.07 + this.spinAng;
        if (this.state === 'dive' && this.divePhase === 'fall') ang += Math.PI * 0.5;
        drawBossSprite(ctx, Sprites.craneL, this.x, this.y, 0.8125, 0.8125, ang, this.flash);
        // 阶段转换蓝闪
        if (this.blueFlash > 0) {
          drawSpriteTinted(ctx, Sprites.craneL, this.x, this.y,
            Sprites.craneL.width * 0.8125, Sprites.craneL.height * 0.8125, ang, '#5fd0f0', this.blueFlash * 0.85);
        }
        ctx.restore();
      }
      // —— P1 特效：鹤鸣时喙部三层声波纹（喙部锚点 x-60,y-30）——
      if (this.state === 'cry') {
        const t = this.stateT;
        for (let i = 0; i < 3; i++) {
          const k = (t - i * 0.55) / 1.6;
          if (k > 0 && k < 1) {
            const rr = 30 + k * 110;
            ctx.strokeStyle = `rgba(120,220,255,${0.6 * (1 - k)})`;
            ctx.lineWidth = 3 - i * 0.6;
            ctx.beginPath();
            ctx.arc(this.x - 60, this.y - 30, rr, -0.9, 0.9);
            ctx.stroke();
          }
        }
      }
      // —— P1 特效：旋羽领域双弧旋转气旋 ——
      if (this.state === 'whirl') {
        const grow = Math.min(this.stateT / 3.0, 1);
        const sR = 70 + grow * 380;
        const sp = this.t * 2.2;
        for (let d = 0; d < 2; d++) {
          const a0 = sp * (d === 0 ? 1 : -1) + d * Math.PI;
          ctx.strokeStyle = d === 0 ? 'rgba(191,233,255,0.55)' : 'rgba(95,208,240,0.4)';
          ctx.lineWidth = d === 0 ? 2.5 : 4;
          ctx.beginPath();
          ctx.arc(this.x, this.y, sR, a0, a0 + Math.PI * 1.3);
          ctx.stroke();
        }
      }
      // Boss 自旋时的青色旋转气环（P2 视觉强调）
      if (this.spinT > 0) {
        const sR = 50 + Math.sin(this.t * 10) * 10;
        ctx.strokeStyle = `rgba(95,208,240,${0.5 * (this.spinT / 0.5)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, sR, this.spinAng, this.spinAng + Math.PI * 1.4); ctx.stroke();
        ctx.strokeStyle = `rgba(191,233,255,${0.7 * (this.spinT / 0.5)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, sR * 0.7, -this.spinAng * 1.3, -this.spinAng * 1.3 + Math.PI); ctx.stroke();
      }
      // 锁血期蓝光光环
      if (this.state === 'phaseTrans') {
        const r = 70 + Math.sin(this.t * 4) * 12;
        ctx.strokeStyle = `rgba(95,208,240,${0.35 + Math.sin(this.t * 4) * 0.15})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.7, 0, TAU); ctx.stroke();
      }
    }
    renderTornadoes(ctx) {
      for (const t of this.tornadoes) {
        const fade = clamp(t.life / 1.5, 0, 1);   // 末期淡出
        const born = t.born;                      // 0→1 渐入
        ctx.save();
        ctx.globalAlpha = fade * born;
        // 用重绘的龙卷风精灵贴图（Hexian-feng.png 144×404）
        // 图像底部对齐 GROUND_Y，顶部在 GROUND_Y - drawH
        const spr = Sprites.hexianFeng;
        const imgW = spr.width, imgH = spr.height;   // 144 × 404
        // 目标显示高度 = t.height（300），按比例缩放宽度
        const drawH = t.height * born;
        const scale = drawH / imgH;
        const drawW = imgW * scale;
        const cx = t.x;
        const botY = CFG.GROUND_Y;
        const drawX = cx - drawW / 2;
        const drawY = botY - drawH;

        // 1. 底部接地扬尘阴影（精灵图底部增强接地感）
        ctx.fillStyle = 'rgba(60,50,40,0.35)';
        ctx.beginPath(); ctx.ellipse(cx, botY - 2, drawW * 0.2 * born + 10, 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(120,100,80,0.22)';
        ctx.beginPath(); ctx.ellipse(cx, botY - 2, drawW * 0.28 * born + 16, 9, 0, 0, TAU); ctx.fill();

        // 2. 龙卷风精灵贴图
        if (spr.width > 0 && spr.height > 0) {
          ctx.drawImage(spr, drawX, drawY, drawW, drawH);
        }

        // 3. 旋转气流强调：2 道旋转弧线叠在精灵上（黑边 + 青白线，增强动感）
        const topR = drawW * 0.33, botR = drawW * 0.1;
        const topY = drawY;
        const N = 10;
        for (let s = 0; s < 2; s++) {
          const phase = t.spin + s * Math.PI;
          ctx.strokeStyle = 'rgba(11,22,34,0.55)'; ctx.lineWidth = 3.5;
          ctx.beginPath();
          for (let j = 0; j <= N; j++) {
            const yt = j / N;
            const yy = topY + yt * drawH;
            const rr = topR + (botR - topR) * yt;
            const ang = phase + yt * Math.PI * 2.0;
            const px = cx + Math.cos(ang) * rr;
            const py = yy + Math.sin(ang) * rr * 0.3;
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.strokeStyle = 'rgba(191,233,255,0.5)'; ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let j = 0; j <= N; j++) {
            const yt = j / N;
            const yy = topY + yt * drawH;
            const rr = topR + (botR - topR) * yt;
            const ang = phase + yt * Math.PI * 2.0;
            const px = cx + Math.cos(ang) * rr;
            const py = yy + Math.sin(ang) * rr * 0.3;
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }

        // 4. 底部碎屑扬尘粒子（少量，旋转飞溅）
        for (let d = 0; d < 4; d++) {
          const ang = t.spin * 0.5 + d * TAU / 4;
          const dx = Math.cos(ang) * botR * 1.5;
          const dy = Math.sin(ang) * botR * 0.4;
          ctx.fillStyle = 'rgba(140,120,90,0.5)';
          ctx.beginPath(); ctx.arc(cx + dx, botY - 4 + dy, 2.5, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
    renderMirrors(ctx) {
      for (const m of this.mirrors) {
        const s = m.size * m.born;
        if (s < 1) continue;
        const hpRatio = m.hp / m.maxHp;   // 1=满血 0=快碎
        ctx.save();
        ctx.translate(m.x, m.y + m.dy);
        // 光晕（受损时光晕变红）
        const haloA = m.flash > 0 ? 0.5 + m.flash * 0.5 : 0.22;
        ctx.fillStyle = m.flash > 0 ? `rgba(255,120,120,${haloA})` : 'rgba(120,220,255,0.22)';
        ctx.beginPath(); ctx.arc(0, 0, s * 1.9, 0, TAU); ctx.fill();
        ctx.rotate(m.ang);
        // 黑边菱形
        ctx.fillStyle = '#0b1622';
        ctx.beginPath();
        ctx.moveTo(0, -s - 2); ctx.lineTo(s + 2, 0); ctx.lineTo(0, s + 2); ctx.lineTo(-s - 2, 0); ctx.closePath(); ctx.fill();
        // 镜面深青（受损时变暗偏红）
        ctx.fillStyle = hpRatio > 0.5 ? '#1d6f7e' : (hpRatio > 0.25 ? '#5a4a4a' : '#6a2a2a');
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); ctx.fill();
        // 镜面亮青（受损时减弱）
        ctx.fillStyle = hpRatio > 0.5 ? '#5fd0f0' : `rgba(95,208,240,${hpRatio * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(0, -s + 2); ctx.lineTo(s - 2, 0); ctx.lineTo(0, s - 2); ctx.lineTo(-s + 2, 0); ctx.closePath(); ctx.fill();
        // 白色高光斜线（受损时减弱）
        ctx.strokeStyle = `rgba(255,255,255,${0.6 + m.flash * 0.4})`; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.3); ctx.lineTo(s * 0.3, s * 0.5); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.3 + m.flash * 0.4})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.3); ctx.lineTo(s * 0.4, -s * 0.4); ctx.stroke();
        // 裂纹（HP 越低裂纹越多）—— 受损后出现
        if (hpRatio < 0.8) {
          const cracks = Math.floor((1 - hpRatio) * 5) + 1;   // 1~5 道裂纹
          ctx.strokeStyle = `rgba(20,20,30,${0.7})`; ctx.lineWidth = 1.4;
          for (let c = 0; c < cracks; c++) {
            const a0 = c * 2.4 + (m.t * 0.3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a0) * s * 0.9, Math.sin(a0) * s * 0.9);
            ctx.stroke();
          }
        }
        // 受击白闪叠加
        if (m.flash > 0) {
          ctx.fillStyle = `rgba(255,255,255,${m.flash * 0.5})`;
          ctx.beginPath();
          ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
    renderBeams(ctx) {
      for (const b of this.beams) {
        ctx.save();
        if (b.t < b.warn) {
          // 预警虚线
          const on = Math.floor(b.t * 14) % 2 === 0;
          if (on) {
            ctx.strokeStyle = 'rgba(95,208,240,0.7)';
            ctx.lineWidth = 3;
            ctx.setLineDash([12, 10]);
            for (const seg of b.segs) {
              ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
            }
            ctx.setLineDash([]);
          }
        } else {
          // 激光本体：深青外层 → 亮青 → 白芯
          const a = clamp(1 - (b.t - b.warn) / b.active, 0, 1);
          ctx.globalAlpha = a;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#3a8f9e'; ctx.lineWidth = 14;
          for (const seg of b.segs) { ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke(); }
          ctx.strokeStyle = '#5fd0f0'; ctx.lineWidth = 8;
          for (const seg of b.segs) { ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke(); }
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
          for (const seg of b.segs) { ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke(); }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
    }
    renderShockwaves(ctx) {
      for (const s of this.shockwaves) {
        const a = clamp(1 - s.t / s.life, 0, 1);
        ctx.save();
        ctx.strokeStyle = `rgba(95,208,240,${a * 0.8})`;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${a * 0.9})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ================ S1. 狮身人面像（沙漠专属：三循环 × 三阶段） ================
   * 循环 cycle 1-3，每循环 P1 双爪拍击 → P2 神眼扫射 → P3 狮王狂怒
   * 任意阶段 HP 打空立即跳过（新阶段回满血）；P3 后 cycle<3 回血 100% 进下一循环，cycle3 死亡
   * ---------------------------------------------------------------- */
  class Sphinx extends Boss {
    constructor(g) {
      super(g, 26, 92);
      this.bossName = '狮身人面像';
      this.title = '沙漠远古守护神';
      // 单循环血条：目标 40s 交战（整场 3 循环），按参考 DPS 曲线 + 软追赶缩放
      // 注意：40 为独立于 CFG.boss.fightTime 的史诗战常量（仅 ord 1-2 沙漠限定出场），调整全局曲线时无需跟随
      this.maxHp = Math.round(CFG.boss.refDpsAt(g.bossSpawned + 1) * 40 * g.hpSoftMul(g.bossSpawned + 1));
      this.hp = this.maxHp;
      this.cycle = 1;            // 循环 1-3
      this.phase = 'p1';         // p1 / p2 / p3
      this.act = null;           // 阶段内子动作
      this.actT = 0;
      this.hazards = [];         // 地面冲击波环 {x,y,r,vr,band,maxR,life,t,dmg,dealt,seed}
      this.marks = [];           // 爪击落点预警 {x,y,t}
      this.debris = [];          // 环绕浮石 {ang,rad,spd,sz}
      this.pendingSlam = null;   // {t, pts:[{x,y}], kind}
      this.clawSeq = 0;
      this.clawTimer = 1.0;
      this.slamFlash = 0;
      this.spinAng = 0;
      this.spirA = 0;
      this.beamT = 0;
      this.ringT = 0;
      this.ringRot = 0;
      this.wpIdx = 0;
      this.movingDir = 0;
      this.deathCols = ['#7fe0ff', '#9fd8ff', '#ffd98a', '#c9a45c', '#fff'];
      this.xpValue = 260;
    }

    /* ---------------- 状态机 ---------------- */
    update(dt, g) {
      this.t += dt; this.stateT += dt; this.actT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.slamFlash = Math.max(0, this.slamFlash - dt);
      this.commonMove(dt);
      const dir = this.x - (this._lastX || this.x);
      if (Math.abs(dir) > 0.5) this.movingDir = dir > 0 ? 1 : -1;
      this._lastX = this.x;

      if (this.state === 'enter') {
        if (this.cinematicHold) {
          // 入场演出中：只从右侧滑入到右侧悬停点，不转阶段、不开火
          const hx = CFG.W * 0.78, hy = 150;
          this.x += (hx - this.x) * Math.min(1, dt * 1.8);
          this.y += (hy - this.y) * Math.min(1, dt * 1.8);
          this.updateDebris(dt);
          return;
        }
        const tx = CFG.W / 2, ty = 150;
        this.x += (tx - this.x) * Math.min(1, dt * 2.2);
        this.y += (ty - this.y) * Math.min(1, dt * 2.2);
        if (Math.hypot(this.x - tx, this.y - ty) < 12) {
          this.x = tx; this.y = ty;
          this.state = 'p1'; this.stateT = 0; this.phase = 'p1';
          this.setupPhase(g);
        }
        return;
      }

      if (this.state === 'trans') {
        const a = this.anchorFor(this.phase);
        this.x += (a.x - this.x) * Math.min(1, dt * 2.6);
        this.y += (a.y - this.y) * Math.min(1, dt * 2.6);
        if (this.stateT > 1.5) { this.state = this.phase; this.stateT = 0; this.setupPhase(g); }
        this.updateHazards(dt, g);
        this.updateDebris(dt);
        return;
      }

      // 阶段自然结束（P3 由 finale 自行收尾）
      if ((this.state === 'p1' && this.stateT > 13.5) ||
          (this.state === 'p2' && this.stateT > 15.5)) {
        this.advancePhase(g, false);
        return;
      }

      if (this.state === 'p1') this.updateP1(dt, g);
      else if (this.state === 'p2') this.updateP2(dt, g);
      else if (this.state === 'p3') this.updateP3(dt, g);

      this.updateHazards(dt, g);
      this.updateDebris(dt);
    }

    anchorFor(ph) {
      if (ph === 'p1') return { x: CFG.W / 2, y: 150 };
      if (ph === 'p2') return { x: CFG.W / 2, y: 210 };
      return { x: CFG.W / 2, y: 230 };
    }

    setupPhase(g) {
      this.actT = 0;
      this.hazards.length = 0;
      this.marks.length = 0;
      this.pendingSlam = null;
      this.beamT = 0.9; this.ringT = 1.1; this.ringRot = rand(0, TAU);
      this._sweepA0 = null; this._triA0 = null; this._tbA0 = null;   // 扫射瞄准角锁定（开火瞬间锁定玩家位置）
      if (this.phase === 'p1') {
        this.act = 'slam';
        this.clawSeq = 0; this.clawTimer = 1.0;
        this.anchor = this.anchorFor('p1');
        g.toast('双爪拍击！', 1.6, 'lt');
      } else if (this.phase === 'p2') {
        this.act = 'sweepL';
        this.anchor = this.anchorFor('p2');
        g.toast('神眼扫射！', 1.6, 'lt');
        SFX.phaseRise();
      } else {
        this.act = 'charge'; this.wpIdx = 0;
        this.beamT = 0.22;   // 冲撞段尾刃快速起手，保证中→左段也有月牙刃
        this.contactDmg = 30;
        // 一次性攻击闩锁复位：防止上循环 P3 跳阶后下一循环合击/终章静默丢失
        this._clapped = false; this._f1 = false; this._f2 = false; this._f3 = false;
        this.anchor = this.anchorFor('p3');
        this.debris = [];
        for (let i = 0; i < 8; i++) {
          this.debris.push({ ang: rand(0, TAU), rad: rand(100, 150), spd: rand(0.5, 1.1) * (i % 2 ? 1 : -1), sz: rand(5, 11) });
        }
        g.toast(`狮王狂怒！（第 ${this.cycle} 循环）`, 2.2, 'lt');
        SFX.phaseRise(); g.shake(10);
      }
    }

    takeDamage(dmg, g) {
      if (this.dead || this.state === 'enter' || this.state === 'trans') return;   // 入场/转场免伤
      this.hp -= dmg;
      this.hitFlash();
      if (Math.random() < 0.3) burst(g, this.x - 14, this.y, 2, ['#ff3b3b', '#ff7b2e'], 130, 3, 0.18);
      // 月痕沙海：第三循环剩余 30% 生命时触发台词（仅一次）
      if (g.mapId === 'moondesert' && this.cycle === 3 && !this._faceLineSaid &&
          this.hp > 0 && this.hp <= this.maxHp * 0.3) {
        this._faceLineSaid = true;
        g.showDialogue('……等等。你的脸。你每天照镜子的时候，有没有觉得哪里不对？那张脸……本来不是你的。', 6);
      }
      if (this.hp <= 0) { this.hp = 0; this.advancePhase(g, true); }
    }

    /** skipped=true：HP 打空强制跳过，新阶段回满血防连锁瞬跳 */
    advancePhase(g, skipped) {
      if (this.dead || this.state === 'trans' || this.state === 'enter') return;
      this.marks.length = 0;
      this.pendingSlam = null;
      if (this.phase === 'p1') {
        this.phase = 'p2'; this.state = 'trans'; this.stateT = 0;
        if (skipped) this.hp = this.maxHp * 0.6;
        SFX.phaseRise(); g.shake(6);
        if (g.mapId === 'moondesert') g.showDialogue('你在跟整片沙漠打架，小猫。', 4);
      } else if (this.phase === 'p2') {
        this.phase = 'p3'; this.state = 'trans'; this.stateT = 0;
        if (skipped) this.hp = this.maxHp * 0.6;
        SFX.phaseRise(); g.shake(8);
        if (g.mapId === 'moondesert') {
          const line = this.cycle === 3
            ? '把脸还来。我让你活着离开沙漠。不还——那我就自己从你身上拿。'
            : '不错。上一个来偷东西的，连我一根爪子都没撑过。你比他强。比他也蠢。';
          g.showDialogue(line, this.cycle === 3 ? 5.5 : 5);
        }
      } else {
        // P3 结束
        if (this.cycle < 3) {
          this.cycle++;
          this.hp = this.maxHp;
          g.bullets.forEach(b => { if (!b.friendly) b.neutralize(); });
          this.hazards.length = 0;
          this.phase = 'p1'; this.state = 'trans'; this.stateT = 0;
          this.contactDmg = 26;
          g.toast(`狮身人面像恢复了！（第 ${this.cycle} 循环）`, 2.6, 'lt');
          SFX.phaseRise(); g.shake(10);
          if (g.mapId === 'moondesert') {
            const line = this.cycle === 2
              ? '这就完了？我在沙子底下躺了八百年，小猫。八百年，就为了等一个能让我认真起来的对手。'
              : '好。好！我承认——你有点本事。那就这样吧。不玩了。';
            g.showDialogue(line, 5.5);
          }
          burst(g, this.x, this.y, 30, this.deathCols, 300, 7, 0.8, 130);
          for (let i = 0; i < 14; i++) {
            g.particles.push(new Particle(this.x + rand(-70, 70), this.y + rand(-40, 60),
              rand(-60, 60), rand(-40, 80), rand(0.5, 1.0), rand(4, 9),
              ['#b98d4e', '#c9a45c', '#8a6a38'][randi(0, 2)]));
          }
        } else {
          super.die(g);
        }
      }
    }

    /* ---------------- 弹幕助手 ---------------- */
    /** 瞄准角：发射点 (x,y) → 玩家当前位置 */
    aimAt(g, x, y) {
      const p = g.player;
      return Math.atan2(p.y - y, p.x - x);
    }
    eyePos(g) {
      // 与 drawFace 绘制位置对齐：双眼面部 (±17,-14)、额头第三眼 (0,-34)
      return { L: { x: this.x - 17, y: this.y - 14 }, R: { x: this.x + 17, y: this.y - 14 }, F: { x: this.x, y: this.y - 34 } };
    }
    chestPos() { return { x: this.x, y: this.y + 56 }; }

    fireBeam(g, ox, oy, a, dmg, w) {
      g.beams.push(new Beam(ox, oy, a, 1500, w || 13, Math.round(dmg * g.atkScale), 0.42, false));
    }

    /** 扇形弹幕：centerA 中心角，spread 张角，n 发 */
    fireFan(g, x, y, centerA, spread, n, kind, sp0, sp1, r, dmg) {
      for (let i = 0; i < n; i++) {
        const tt = n === 1 ? 0.5 : i / (n - 1);
        const a = centerA - spread / 2 + spread * tt;
        const sp = rand(sp0, sp1);
        g.bullets.push(new Bullet(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
          { kind, r, dmg: Math.round(dmg * g.atkScale), life: 4.5, spinRate: kind === 'shard' ? rand(2.5, 4.5) : 2 }));
      }
      SFX.enemyShoot();
    }

    /** 环形弹幕：n 发圆周布弹，gapAng 处跳过 gapArc 弧度的缺口 */
    fireRing(g, x, y, n, gapAng, gapArc, spd, r, dmg) {
      const base = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = base + (i / n) * TAU;
        let diff = a - gapAng;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        if (Math.abs(diff) < gapArc / 2) continue;
        g.bullets.push(new Bullet(x, y, Math.cos(a) * spd, Math.sin(a) * spd,
          { kind: 'eyeGem', r, dmg: Math.round(dmg * g.atkScale), life: 5, spinRate: 2 }));
      }
      SFX.enemyShoot();
    }

    /** 爪拍冲击波：沿地面扩散的能量环（贴地扁平环；飞高可躲避） */
    shockRing(g, x, y) {
      const hy = CFG.GROUND_Y - 28;
      this.hazards.push({ x, y: hy, r: 20, vr: 430, band: 30, maxR: 620, life: 1.45, t: 0,
        dmg: Math.round(14 * g.atkScale), dealt: false, seed: rand(0, TAU) });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.particles.push(new Particle(x, hy, Math.cos(a) * rand(60, 140), Math.sin(a) * rand(30, 80),
          0.4, rand(3, 6), '#7fd4ff'));
      }
    }

    updateHazards(dt, g) {
      const p = g.player;
      for (const h of this.hazards) {
        h.t += dt; h.r += h.vr * dt;
        if (!h.dealt && p) {
          const dx = Math.abs(p.x - h.x);
          // 地面冲击波：水平方向随环扩散判定，近地高度带才受伤（飞行高度可躲避）
          if (Math.abs(dx - h.r) < h.band / 2 + p.radius * 0.7 &&
              Math.abs(p.y - h.y) < 70 + p.radius) { h.dealt = true; p.hurt(h.dmg, g); }
        }
      }
      this.hazards = this.hazards.filter(h => h.t < h.life && h.r < h.maxR);
    }

    updateDebris(dt) {
      const show = this.state === 'p3' || this.cycle >= 3;
      if (!show) { if (this.debris.length) this.debris.length = 0; return; }
      if (!this.debris.length) {
        for (let i = 0; i < 6; i++) {
          this.debris.push({ ang: rand(0, TAU), rad: rand(105, 160), spd: rand(0.5, 1.0) * (i % 2 ? 1 : -1), sz: rand(5, 10) });
        }
      }
      for (const d of this.debris) d.ang += d.spd * dt;
    }

    /* ---------------- P1：双爪拍击 ---------------- */
    updateP1(dt, g) {
      this.x += (this.anchor.x - this.x) * Math.min(1, dt * 3);
      this.y = this.anchor.y + Math.sin(this.t * 1.6) * 6;

      // 预警倒计时
      if (this.pendingSlam) {
        this.pendingSlam.t -= dt;
        this.marks.forEach(m => { m.t -= dt; });
        this.marks = this.marks.filter(m => m.t > 0);
        if (this.pendingSlam.t <= 0) {
          const { pts, kind } = this.pendingSlam;
          this.pendingSlam = null;
          this.slamFlash = 0.22;
          g.shake(9); SFX.shock();
          // 扇形中线 = 爪落点 → 玩家当前位置（单爪120°、双爪各~92°，均覆盖玩家所在侧）
          if (kind === 0 || kind === 1) {
            this.fireFan(g, pts[0].x, pts[0].y, this.aimAt(g, pts[0].x, pts[0].y), 2.1, 8, 'shard', 210, 280, 9, 13);
          } else {
            this.fireFan(g, pts[0].x, pts[0].y, this.aimAt(g, pts[0].x, pts[0].y), 1.6, 7, 'shard', 220, 290, 9, 13);
            this.fireFan(g, pts[1].x, pts[1].y, this.aimAt(g, pts[1].x, pts[1].y), 1.6, 7, 'shard', 220, 290, 9, 13);
          }
          for (const pt of pts) {
            this.shockRing(g, pt.x, pt.y);
            burst(g, pt.x, pt.y, 14, ['#c9a45c', '#f0d496', '#7fd4ff'], 200, 5, 0.5);
          }
        }
      }
      this.clawTimer -= dt;
      if (this.clawTimer <= 0 && !this.pendingSlam) {
        const kind = this.clawSeq % 3;   // 0 右爪 / 1 左爪 / 2 双爪
        this.clawSeq++;
        const pts = kind === 0
          ? [{ x: this.x + 140, y: 382 }]
          : kind === 1
            ? [{ x: this.x - 140, y: 382 }]
            : [{ x: this.x - 140, y: 382 }, { x: this.x + 140, y: 382 }];
        this.pendingSlam = { t: 0.62, pts, kind };
        pts.forEach(pt => this.marks.push({ x: pt.x, y: pt.y, t: 0.62 }));
        SFX.bossCharge();
        this.clawTimer = 2.35;
      }
    }

    /* ---------------- P2：神眼扫射 ---------------- */
    updateP2(dt, g) {
      this.x += (this.anchor.x - this.x) * Math.min(1, dt * 3);
      this.y = this.anchor.y + Math.sin(this.t * 1.8) * 5;
      const T = this.stateT;
      const e = this.eyePos(g);
      const dmg = 15;

      // 子动作：sweepL(0-3) sweepR(3-6) triEye(6-11) eyeRing(11-15.5)
      let act = null;
      if (T < 3) act = 'sweepL'; else if (T < 6) act = 'sweepR'; else if (T < 11) act = 'triEye'; else act = 'eyeRing';
      this.act = act;

      if (act === 'sweepL' || act === 'sweepR') {
        const local = act === 'sweepL' ? T : T - 3;
        if (local <= 0.7) { this._sweepA0 = null; }   // 蓄力期：待开火瞬间锁定玩家
        if (local > 0.7) {   // 蓄力后开火
          if (this._sweepA0 == null) this._sweepA0 = this.aimAt(g, this.x, e.L.y);
          const u = clamp((local - 0.7) / 2.3, 0, 1);
          // 扫射以玩家方向为中心 ±1.1rad：sweepL 右→左（扫过玩家并覆盖其左侧），sweepR 反向
          const a = act === 'sweepL' ? this._sweepA0 - 1.1 + u * 2.2 : this._sweepA0 + 1.1 - u * 2.2;
          this.beamT -= dt;
          if (this.beamT <= 0) {
            this.beamT = 0.32;
            this.fireBeam(g, e.L.x, e.L.y, a, dmg, 12);
            this.fireBeam(g, e.R.x, e.R.y, a, dmg, 12);
          }
        }
      } else if (act === 'triEye') {
        const local = T - 6;
        if (local <= 0.7) { this._triA0 = null; }
        if (local > 0.7) {
          if (this._triA0 == null) this._triA0 = this.aimAt(g, e.F.x, e.F.y);
          const u = clamp((local - 0.7) / 4.3, 0, 1);
          const off = 0.42 * Math.cos(u * TAU);   // 左→中→右→中→左（中束扫过玩家，左束覆盖玩家左侧）
          this.beamT -= dt;
          if (this.beamT <= 0) {
            this.beamT = 0.34;
            this.fireBeam(g, e.L.x, e.L.y, this._triA0 + 0.99 + off, 16, 13);
            this.fireBeam(g, e.F.x, e.F.y, this._triA0 + off, 16, 13);
            this.fireBeam(g, e.R.x, e.R.y, this._triA0 - 0.99 + off, 16, 13);
          }
        }
      } else {
        // 神眼环：金菱形环外扩，缺口顺时针旋转
        const c = this.chestPos();
        this.ringT -= dt;
        if (this.ringT <= 0) {
          this.ringT = 1.05;
          this.ringRot += 0.6;   // 缺口顺时针（屏幕角增大=视觉顺时针）
          this.fireRing(g, c.x, c.y, 15, this.ringRot, 0.9, 185, 10, 13);
        }
      }
    }

    /* ---------------- P3：狮王狂怒 ---------------- */
    updateP3(dt, g) {
      const T = this.stateT;
      const e = this.eyePos(g);
      const c = this.chestPos();

      if (this.act === 'charge') {
        // 中 → 左 → 右 → 中
        const wps = [{ x: 480, y: 250 }, { x: 140, y: 280 }, { x: 820, y: 280 }, { x: 480, y: 250 }];
        if (this.wpIdx < wps.length) {
          const wp = wps[this.wpIdx];
          const dx = wp.x - this.x, dy = wp.y - this.y, d = Math.hypot(dx, dy);
          const sp = 600 * dt;
          if (d < sp) { this.x = wp.x; this.y = wp.y; this.wpIdx++; if (this.wpIdx === 2 || this.wpIdx === 3) g.shake(6); }   // wp0→1 为开场20px微移不震屏；撞左(wpIdx2)/撞右(wpIdx3)震屏
          else { this.x += dx / d * sp; this.y += dy / d * sp; }
          // 残影粒子
          g.particles.push(new Particle(this.x + rand(-30, 30), this.y + rand(-20, 40),
            rand(-40, 40), rand(-20, 30), 0.35, 5, '#9fd8ff'));
          // 尾尖月牙刃：初射方向 = 尾尖 → 玩家当前位置（小扇形覆盖玩家）
          this.beamT -= dt;
          if (this.beamT <= 0 && this.movingDir !== 0) {
            this.beamT = 0.28;
            const tipX = this.x - this.movingDir * 78, tipY = this.y - 50;
            this.fireFan(g, tipX, tipY, this.aimAt(g, tipX, tipY), 0.75, 3, 'crescent', 280, 330, 12, 15);
          }
        }
        if (T > 5.0) { this.act = 'clap'; this.actT = 0; }
      } else if (this.act === 'clap') {
        this.x += (this.anchor.x - this.x) * Math.min(1, dt * 4);
        this.y += (this.anchor.y - this.y) * Math.min(1, dt * 4);
        if (this.actT > 0.9 && !this._clapped) {
          this._clapped = true;
          g.shake(8); SFX.shock();
          // 双爪合击：两扇均以爪位 → 玩家为中线，向玩家所在处拍合
          this.fireFan(g, this.x - 95, this.y + 30, this.aimAt(g, this.x - 95, this.y + 30), 1.4, 9, 'shard', 240, 300, 11, 14);
          this.fireFan(g, this.x + 95, this.y + 30, this.aimAt(g, this.x + 95, this.y + 30), 1.4, 9, 'shard', 240, 300, 11, 14);
        }
        if (T > 7.4) { this.act = 'triBeam'; this.actT = 0; this._clapped = false; }
      } else if (this.act === 'triBeam') {
        this.x += (this.anchor.x - this.x) * Math.min(1, dt * 4);
        this.y += (this.anchor.y - this.y) * Math.min(1, dt * 4);
        if (this.actT <= 0.8) { this._tbA0 = null; }
        if (this.actT > 0.8) {
          if (this._tbA0 == null) this._tbA0 = this.aimAt(g, e.F.x, e.F.y);
          const u = clamp((this.actT - 0.8) / 4.4, 0, 1);
          const off = 0.42 * Math.cos(u * TAU);   // 中束扫过玩家，左右束覆盖两侧（左束达玩家左侧外）
          this.beamT -= dt;
          if (this.beamT <= 0) {
            this.beamT = 0.34;
            this.fireBeam(g, e.L.x, e.L.y, this._tbA0 + 0.99 + off, 16, 14);
            this.fireBeam(g, e.F.x, e.F.y, this._tbA0 + off, 16, 14);
            this.fireBeam(g, e.R.x, e.R.y, this._tbA0 - 0.99 + off, 16, 14);
          }
        }
        if (T > 13.0) { this.act = 'spin'; this.actT = 0; }
      } else if (this.act === 'spin') {
        this.spinAng += dt * 2.6;
        this.x = this.anchor.x + Math.cos(this.t * 0.7) * 16;
        this.y = this.anchor.y + Math.sin(this.t * 1.3) * 8;
        // 左半身顺时针螺旋 / 右半身逆时针螺旋
        this.beamT -= dt;
        if (this.beamT <= 0) {
          this.beamT = 0.15;
          this.spirA += 2.9 * dt * 2.2;
          const a1 = this.spirA, a2 = -this.spirA;
          const sp = 225;
          g.bullets.push(new Bullet(this.x - 40, this.y, Math.cos(a1) * sp, Math.sin(a1) * sp,
            { kind: 'eyeGem', r: 9, dmg: Math.round(12 * g.atkScale), life: 5, spinRate: 2 }));
          g.bullets.push(new Bullet(this.x + 40, this.y, Math.cos(a2) * sp, Math.sin(a2) * sp,
            { kind: 'eyeGem', r: 9, dmg: Math.round(12 * g.atkScale), life: 5, spinRate: 2 }));
        }
        // 中心环形弹：缺口跟随旋转
        this.ringT -= dt;
        if (this.ringT <= 0) {
          this.ringT = 0.9;
          this.fireRing(g, c.x, c.y, 14, this.spinAng, 0.95, 200, 10, 13);
        }
        if (T > 18.4) { this.act = 'finale'; this.actT = 0; }
      } else if (this.act === 'finale') {
        const u = this.actT;
        // 蓄力：三眼最亮 / 太阳环高速旋转（渲染体现）
        if (u > 1.1 && !this._f1) {
          this._f1 = true;
          g.shake(9); SFX.shock();
          // 双爪弹幕：两扇中线均指向玩家
          this.fireFan(g, this.x - 100, this.y + 20, this.aimAt(g, this.x - 100, this.y + 20), 1.3, 11, 'shard', 250, 310, 11, 14);
          this.fireFan(g, this.x + 100, this.y + 20, this.aimAt(g, this.x + 100, this.y + 20), 1.3, 11, 'shard', 250, 310, 11, 14);
        }
        if (u > 1.7 && !this._f2) {
          this._f2 = true;
          // 三眼激光：中束直指玩家，左右束各偏 0.99rad 覆盖两侧（含玩家左侧）
          const a0 = this.aimAt(g, e.F.x, e.F.y);
          this.fireBeam(g, e.L.x, e.L.y, a0 + 0.99, 18, 15);
          this.fireBeam(g, e.F.x, e.F.y, a0, 18, 15);
          this.fireBeam(g, e.R.x, e.R.y, a0 - 0.99, 18, 15);
          g.shake(8);
        }
        if (u > 2.3 && !this._f3) {
          this._f3 = true;
          g.shake(12); SFX.bossCharge();
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * TAU;
            g.bullets.push(new Bullet(c.x, c.y, Math.cos(a) * 235, Math.sin(a) * 235,
              { kind: 'eyeGem', r: 16, dmg: Math.round(16 * g.atkScale), life: 5, spinRate: 2 }));
          }
          SFX.enemyShoot();
        }
        if (u > 3.6) { this._f1 = this._f2 = this._f3 = false; this.advancePhase(g, false); }
      }
    }

    /* ---------------- 程序化渲染 ---------------- */
    render(ctx) {
      const cyc = this.cycle;
      const inP2 = this.state === 'p2' || (this.state === 'trans' && this.phase === 'p2');
      const inP3 = this.state === 'p3' || (this.state === 'trans' && this.phase === 'p3');
      const scale = cyc >= 3 ? 1.08 : 1;
      const col = {
        stone: '#c9a45c', stoneD: '#a8854a', stoneDD: '#8a6a38', stoneL: '#dbb977',
        gold: '#e8c165', blue: '#54c8ff', blueL: '#9fe6ff', deep: '#0b3a66'
      };

      // —— 落点预警（世界坐标） ——
      for (const m of this.marks) {
        const pulse = 0.5 + Math.sin(this.t * 18) * 0.3;
        ctx.strokeStyle = `rgba(255,90,60,${pulse + 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(m.x, m.y, 34, 12, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(255,120,80,${0.15 + pulse * 0.2})`;
        ctx.beginPath(); ctx.ellipse(m.x, m.y, 34, 12, 0, 0, TAU); ctx.fill();
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(scale, scale);

      // 翼展角度：P1 收拢 / P2 45° / P3 全展
      const wingSpread = inP3 ? 1.45 : inP2 ? 0.8 : 0.25;
      const wingLen = inP3 ? 150 : inP2 ? 128 : 64;

      // —— 尾巴：P1 盘于身后右侧，P3 伸展甩动 ——
      ctx.fillStyle = col.stoneD;
      if (inP3) {
        const tside = this.movingDir !== 0 ? -this.movingDir : 1;   // 尾巴拖在移动反侧（冲左尾在右、冲右尾在左）
        const sway = Math.sin(this.t * 9) * 22 * Math.max(0.4, Math.abs(this.movingDir));
        ctx.strokeStyle = col.stoneD; ctx.lineWidth = 15; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(30 * tside, -70);
        ctx.quadraticCurveTo((96 + sway * 0.4) * tside, -100, (128 + sway) * tside, -78);
        ctx.stroke();
        ctx.strokeStyle = col.blue; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(30 * tside, -70);
        ctx.quadraticCurveTo((96 + sway * 0.4) * tside, -100, (128 + sway) * tside, -78);
        ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(106, -78, 26, 0, TAU * 0.8); ctx.lineWidth = 13; ctx.strokeStyle = col.stoneD; ctx.stroke();
        ctx.beginPath(); ctx.arc(106, -78, 14, 0, TAU); ctx.lineWidth = 10; ctx.stroke();
      }

      // —— 双翼（先画，压在身体后） ——
      this.drawWing(ctx, -1, wingSpread, wingLen, col, cyc);
      this.drawWing(ctx, 1, wingSpread, wingLen, col, cyc);

      // —— 躯干（趴伏狮身） ——
      ctx.fillStyle = col.stoneDD;
      ctx.beginPath(); ctx.ellipse(0, -46, 118, 62, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = col.stoneD;
      ctx.beginPath(); ctx.ellipse(0, -50, 110, 56, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = col.stone;
      ctx.beginPath(); ctx.ellipse(0, -54, 100, 48, 0, 0, TAU); ctx.fill();
      // 石板块纹理
      ctx.strokeStyle = col.stoneDD; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.ellipse(0, -54 + i * 22, 96 - Math.abs(i) * 14, 6, 0, 0, Math.PI); ctx.stroke();
      }
      // 后腿
      ctx.fillStyle = col.stoneD;
      ctx.beginPath(); ctx.ellipse(-92, -20, 34, 26, 0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(92, -20, 34, 26, -0.3, 0, TAU); ctx.fill();

      // —— 双前爪（伸向玩家侧） ——
      this.drawPaws(ctx, col, inP3);

      // —— 人面（法老面像） ——
      this.drawFace(ctx, col, inP2, inP3, cyc);

      // —— 胸口太阳圆环（P2 起） ——
      if (inP2 || inP3) this.drawSunRing(ctx, col, inP3, cyc);

      // —— 循环破损：裂纹（P3 动态发光）——
      if (cyc >= 2) this.drawCracks(ctx, cyc, col, inP3);

      // P3 蓝色能量体表辉光（裂纹渗光叠加）
      if (inP3) {
        const ep = 0.12 + Math.sin(this.t * 4) * 0.06;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(84,200,255,${ep})`;
        ctx.beginPath(); ctx.ellipse(0, -46, 110, 56, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }

      // —— 环绕浮石 ——
      for (const d of this.debris) {
        const dx = Math.cos(d.ang) * d.rad, dy = Math.sin(d.ang) * d.rad * 0.82;
        ctx.fillStyle = col.stoneD;
        ctx.fillRect(dx - d.sz / 2, dy - d.sz / 2, d.sz, d.sz);
        ctx.fillStyle = col.stoneL;
        ctx.fillRect(dx - d.sz / 2, dy - d.sz / 2, d.sz, 2);
      }

      // —— 受击闪红（重色，4s 冷却一次）：径向渐变，中心满红、边缘淡出，避免在天空留下硬边 ——
      const sphinxFlashA = bossFlashAlpha(this.flash);
      if (sphinxFlashA > 0) {
        const gr = ctx.createRadialGradient(0, 0, 20, 0, 0, 175);
        gr.addColorStop(0, `rgba(255,30,16,${sphinxFlashA})`);
        gr.addColorStop(1, 'rgba(255,30,16,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.ellipse(0, 0, 180, 170, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();

      // —— 冲击波环（世界坐标，贴地扁平蓝能量环 + 石裂纹） ——
      for (const h of this.hazards) {
        const alpha = clamp(1.2 - h.t / h.life, 0, 1);
        const ry = Math.max(12, h.r * 0.22);
        ctx.strokeStyle = `rgba(64,190,255,${0.25 * alpha})`;
        ctx.lineWidth = h.band * 0.55;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, ry, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(159,230,255,${0.9 * alpha})`;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, ry, 0, 0, TAU); ctx.stroke();
        // 石质裂纹边：环周锯齿
        ctx.strokeStyle = `rgba(201,164,92,${0.8 * alpha})`;
        ctx.lineWidth = 3;
        for (let i = 0; i < 18; i++) {
          const a = h.seed + (i / 18) * TAU;
          const j1 = Math.sin(a * 7 + h.seed) * 8, j2 = Math.cos(a * 5) * 6;
          ctx.beginPath();
          ctx.moveTo(h.x + Math.cos(a) * (h.r - 8), h.y + Math.sin(a) * (ry - 3));
          ctx.lineTo(h.x + Math.cos(a) * (h.r + 10 + j1), h.y + Math.sin(a) * (ry + 4 + j1 * 0.4));
          ctx.lineTo(h.x + Math.cos(a + 0.05) * (h.r - 4 + j2), h.y + Math.sin(a + 0.05) * (ry - 1));
          ctx.stroke();
        }
      }

      // —— 砸地瞬间冲击星芒 ——
      if (this.slamFlash > 0 && this.pendingSlam === null && this.marks.length === 0) {
        // 由 burst 粒子承担，无需额外绘制
      }
    }

    drawWing(ctx, side, spread, len, col, cyc) {
      ctx.save();
      ctx.translate(side * 66, -58);
      ctx.rotate(side * (-0.9 - spread * 0.7));
      // 翅根到翅尖的扇形羽片：P3 全展 5 片，P1/P2 4 片
      const nFeat = len > 140 ? 5 : 4;
      ctx.fillStyle = col.stoneDD;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * len * 0.5, -len * 0.5, side * len, -len * 0.28);
      ctx.lineTo(side * len * 0.82, len * 0.1);
      ctx.quadraticCurveTo(side * len * 0.4, len * 0.2, 0, 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = col.stoneD;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(side * len * 0.5, -len * 0.42, side * (len - 8), -len * 0.22);
      ctx.lineTo(side * len * 0.78, len * 0.06);
      ctx.quadraticCurveTo(side * len * 0.4, len * 0.14, 0, 8);
      ctx.closePath(); ctx.fill();
      // 羽片分隔 + 蓝色能量翼缘
      ctx.strokeStyle = col.stoneDD; ctx.lineWidth = 2;
      for (let i = 1; i <= nFeat; i++) {
        const tt = i / nFeat;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.quadraticCurveTo(side * len * tt * 0.7, -len * 0.3 * tt, side * len * tt * 0.92, -len * 0.2 * tt + 6);
        ctx.stroke();
      }
      ctx.strokeStyle = col.blue; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(side * len * 0.5, -len * 0.42, side * (len - 8), -len * 0.22);
      ctx.stroke();
      // 循环2 翼缺口 / 循环3 破损
      if (cyc >= 2) {
        ctx.fillStyle = 'rgba(11,58,102,0.9)';
        ctx.beginPath();
        ctx.moveTo(side * len * 0.72, -len * 0.2);
        ctx.lineTo(side * len * 0.88, -len * 0.12);
        ctx.lineTo(side * len * 0.78, -len * 0.02);
        ctx.closePath(); ctx.fill();
      }
      if (cyc >= 3) {
        ctx.fillStyle = 'rgba(11,58,102,0.95)';
        ctx.beginPath();
        ctx.moveTo(side * len * 0.5, -len * 0.3);
        ctx.lineTo(side * len * 0.66, -len * 0.22);
        ctx.lineTo(side * len * 0.56, -len * 0.1);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = col.blueL; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(side * len * 0.5, -len * 0.3); ctx.lineTo(side * len * 0.62, -len * 0.18); ctx.stroke();
      }
      ctx.restore();
    }

    drawPaws(ctx, col, inP3) {
      // 拍击动作：windup 抬爪 / slam 伸出
      let rLift = 0, lLift = 0, rReach = 0, lReach = 0;
      if (this.pendingSlam) {
        const p = 1 - this.pendingSlam.t / 0.62;
        const arc = Math.sin(p * Math.PI);
        if (this.pendingSlam.kind === 0) { rLift = arc; rReach = p; }
        else if (this.pendingSlam.kind === 1) { lLift = arc; lReach = p; }
        else { rLift = arc; lLift = arc; rReach = p; lReach = p; }
      }
      const paw = (side, lift, reach) => {
        const px = side * (62 + reach * 70);
        const py = 66 + reach * 34 - lift * 26;
        ctx.fillStyle = col.stoneD;
        ctx.fillRect(side * 44, 30, side * 26, 44);                 // 前臂
        ctx.fillStyle = col.stone;
        ctx.beginPath(); ctx.ellipse(px, py, inP3 ? 30 : 24, inP3 ? 20 : 16, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = col.stoneL;
        ctx.beginPath(); ctx.ellipse(px - side * 4, py - 5, (inP3 ? 30 : 24) * 0.6, 7, 0, 0, TAU); ctx.fill();
        // 爪尖：P3 蓝色能量利刃
        for (let i = -1; i <= 1; i++) {
          if (inP3) {
            ctx.fillStyle = col.blue;
            ctx.beginPath();
            ctx.moveTo(px + i * 12, py + 8);
            ctx.lineTo(px + i * 12 + side * 4, py + 24);
            ctx.lineTo(px + i * 12 + side * 10, py + 10);
            ctx.closePath(); ctx.fill();
          } else {
            ctx.fillStyle = col.stoneDD;
            ctx.fillRect(px + i * 10 - 2, py + 8, 5, 9);
          }
        }
      };
      paw(1, rLift, rReach);
      paw(-1, lLift, lReach);
    }

    drawFace(ctx, col, inP2, inP3, cyc) {
      // 尼美斯头巾（金蓝条纹冠）
      ctx.fillStyle = col.gold;
      ctx.beginPath();
      ctx.moveTo(-46, -6); ctx.quadraticCurveTo(-52, -78, 0, -84);
      ctx.quadraticCurveTo(52, -78, 46, -6);
      ctx.quadraticCurveTo(30, 10, 0, 12);
      ctx.quadraticCurveTo(-30, 10, -46, -6);
      ctx.closePath(); ctx.fill();
      // 头巾垂肩
      ctx.fillStyle = col.gold;
      ctx.beginPath(); ctx.moveTo(-44, -20); ctx.quadraticCurveTo(-56, 30, -40, 62); ctx.lineTo(-26, 58); ctx.quadraticCurveTo(-34, 20, -28, -14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(44, -20); ctx.quadraticCurveTo(56, 30, 40, 62); ctx.lineTo(26, 58); ctx.quadraticCurveTo(34, 20, 28, -14); ctx.closePath(); ctx.fill();
      // 蓝色条纹
      ctx.fillStyle = col.deep;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(i * 14 - 3, -76, 6, 30);
      }
      ctx.fillRect(-40, -10, 6, 52); ctx.fillRect(34, -10, 6, 52);
      // 人面
      ctx.fillStyle = cyc >= 3 ? '#c9a06a' : '#e8c89a';
      ctx.beginPath();
      ctx.moveTo(-30, -40); ctx.quadraticCurveTo(-34, 8, 0, 30);
      ctx.quadraticCurveTo(34, 8, 30, -40);
      ctx.quadraticCurveTo(0, -52, -30, -40);
      ctx.closePath(); ctx.fill();
      // 第三只眼（P2 起，额头；循环3 永久常亮）
      if (inP2 || inP3 || cyc >= 3) {
        const glow = 0.7 + Math.sin(this.t * 6) * 0.3;
        ctx.fillStyle = `rgba(84,200,255,${0.35 * glow})`;
        ctx.beginPath(); ctx.arc(0, -34, 13, 0, TAU); ctx.fill();
        ctx.fillStyle = col.deep;
        ctx.beginPath(); ctx.ellipse(0, -34, 9, 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = inP3 || cyc >= 3 ? col.blueL : col.blue;
        ctx.beginPath(); ctx.arc(0, -34, 3.6, 0, TAU); ctx.fill();
      }
      // 双眼：P1 蓝色睁眼；P2 各小招蓄力段闭合、发射段睁开（双眼扫 0.5s 后/三眼横扫/神眼环）；P3 与循环3永久睁开
      const eyesOpen = !inP2 || inP3 || cyc >= 3 ||
        this.act === 'triEye' || this.act === 'eyeRing' ||
        ((this.act === 'sweepL' || this.act === 'sweepR') && this.actT > 0.5);
      for (const side of [-1, 1]) {
        const ex = side * 17, ey = -14;
        ctx.fillStyle = col.deep;
        if (eyesOpen) {
          ctx.beginPath(); ctx.ellipse(ex, ey, 7.5, 5.5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = col.blue;
          ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, TAU); ctx.fill();
          ctx.fillStyle = col.blueL;
          ctx.beginPath(); ctx.arc(ex - 1, ey - 1, 1.5, 0, TAU); ctx.fill();
        } else {
          ctx.fillRect(ex - 7, ey - 1.5, 14, 3);
        }
      }
      // 鼻口
      ctx.strokeStyle = '#8a6a38'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 20); ctx.quadraticCurveTo(0, 25, 8, 20); ctx.stroke();
      // 循环3：人面破碎动画（多块崩裂 + 震动 + 蓝色能量渗出）
      if (cyc >= 3) {
        const sh = inP3 ? Math.sin(this.t * 15) * 1.4 : 0;   // P3 人面微震
        const fp = 0.5 + Math.sin(this.t * 7) * 0.3;
        // 人面扩展裂纹
        ctx.strokeStyle = col.blue; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -40); ctx.lineTo(-8, -20); ctx.lineTo(-4, 4); ctx.lineTo(-12, 18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(6, -28); ctx.lineTo(12, -8); ctx.lineTo(4, 10);
        ctx.stroke();
        ctx.strokeStyle = `rgba(159,230,255,${0.4 * fp})`; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -40); ctx.lineTo(-8, -20); ctx.lineTo(-4, 4);
        ctx.stroke();
        // 缺块1：左脸大面积脱落
        ctx.fillStyle = 'rgba(11,58,102,0.95)';
        ctx.beginPath();
        ctx.moveTo(-30 + sh, -2); ctx.lineTo(-14 + sh, 6); ctx.lineTo(-22 + sh, 22); ctx.lineTo(-30 + sh, 16);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(84,200,255,${0.3 * fp})`;
        ctx.beginPath(); ctx.arc(-22 + sh, 12, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = col.blue;
        ctx.beginPath(); ctx.arc(-22 + sh, 12, 3, 0, TAU); ctx.fill();
        // 缺块2：右额头崩裂
        ctx.fillStyle = 'rgba(11,58,102,0.9)';
        ctx.beginPath();
        ctx.moveTo(20 - sh, -38); ctx.lineTo(28 - sh, -28); ctx.lineTo(22 - sh, -14); ctx.lineTo(12 - sh, -24);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(84,200,255,${0.25 * fp})`;
        ctx.beginPath(); ctx.arc(20 - sh, -28, 5, 0, TAU); ctx.fill();
        // 缺块3：下巴碎裂
        ctx.fillStyle = 'rgba(11,58,102,0.85)';
        ctx.beginPath();
        ctx.moveTo(8 + sh, 20); ctx.lineTo(18 + sh, 24); ctx.lineTo(10 + sh, 28);
        ctx.closePath(); ctx.fill();
      }
    }

    drawSunRing(ctx, col, inP3, cyc) {
      const rot = this.t * (inP3 ? 6 : 1.6);
      ctx.save();
      ctx.translate(0, 56);
      // 循环3：胸口破裂，蓝色能量核心暴露
      if (cyc >= 3) {
        const pulse = 0.7 + Math.sin(this.t * 8) * 0.3;
        ctx.fillStyle = `rgba(84,200,255,${0.4 * pulse})`;
        ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
        ctx.fillStyle = col.deep;
        ctx.beginPath();
        ctx.moveTo(-20, -14); ctx.lineTo(-6, -4); ctx.lineTo(-14, 12); ctx.lineTo(6, 18);
        ctx.lineTo(20, 6); ctx.lineTo(10, -12); ctx.lineTo(20, -20);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = col.blueL;
        ctx.beginPath(); ctx.arc(0, 0, 9 * pulse + 3, 0, TAU); ctx.fill();
      }
      // 太阳圆环
      ctx.rotate(rot);
      ctx.strokeStyle = col.gold; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke();
      ctx.strokeStyle = col.blue; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ctx.fillStyle = i % 2 ? col.gold : col.blue;
        ctx.fillRect(Math.cos(a) * 30 - 2, Math.sin(a) * 30 - 2, 5, 5);
      }
      ctx.restore();
    }

    drawCracks(ctx, cyc, col, inP3) {
      const pulse = inP3 ? (0.55 + Math.sin(this.t * 5) * 0.35) : cyc >= 3 ? 0.7 : 1;
      // 人面裂纹
      ctx.strokeStyle = cyc >= 3 ? col.blue : col.stoneDD;
      ctx.lineWidth = cyc >= 3 ? 2.5 : 2;
      ctx.beginPath();
      ctx.moveTo(-12, -30); ctx.lineTo(-6, -16); ctx.lineTo(-14, -2); ctx.lineTo(-6, 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(14, -24); ctx.lineTo(8, -10); ctx.lineTo(16, 4);
      ctx.stroke();
      if (cyc >= 3) {
        // 躯干主裂缝：蓝色能量脉冲渗出
        ctx.strokeStyle = `rgba(84,200,255,${0.7 * pulse})`; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-60, -60); ctx.lineTo(-40, -46); ctx.lineTo(-52, -30); ctx.lineTo(-30, -16);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(58, -56); ctx.lineTo(40, -40); ctx.lineTo(52, -24);
        ctx.stroke();
        // 内层亮线
        ctx.strokeStyle = `rgba(159,230,255,${0.5 * pulse})`; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-60, -60); ctx.lineTo(-40, -46); ctx.lineTo(-52, -30);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(58, -56); ctx.lineTo(40, -40); ctx.lineTo(52, -24);
        ctx.stroke();
        // P3 额外裂纹网络
        if (inP3) {
          ctx.strokeStyle = `rgba(84,200,255,${0.45 * pulse})`; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(-90, -40); ctx.lineTo(-72, -28); ctx.lineTo(-80, -10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(88, -36); ctx.lineTo(70, -22); ctx.lineTo(78, -4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-20, -70); ctx.lineTo(-8, -58); ctx.lineTo(-14, -42); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(22, -66); ctx.lineTo(10, -54); ctx.lineTo(18, -38); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-70, -10); ctx.lineTo(-58, 0); ctx.lineTo(-64, 14); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(68, -6); ctx.lineTo(56, 6); ctx.lineTo(62, 20); ctx.stroke();
          // 裂纹能量火花（沿裂缝随机闪烁）
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + this.t * 0.3;
            const r = 55 + Math.sin(this.t * 4 + i * 1.7) * 30;
            const sx = Math.cos(a) * r, sy = Math.sin(a) * r * 0.6 - 30;
            const sa = 0.3 + Math.sin(this.t * 9 + i * 1.3) * 0.25;
            ctx.fillStyle = `rgba(159,230,255,${Math.max(0, sa)})`;
            ctx.beginPath(); ctx.arc(sx, sy, 1.8, 0, TAU); ctx.fill();
          }
        }
      }
    }
  }

  /* ================ 特殊：牛魔（草原魔王·三阶段循环） ================
   * 单血条按时间无限循环：P1 牛角围攻 → P2 魔牛追杀 → P3 魔王爆发 → P1…
   *  P1：牛角散射 / 牛头冲撞+360°冲击波 / 牛角回旋（绕玩家一圈回收）
   *  P2：上下夹角（悬停夹击）/ 追踪魔角（慢转向）/ 魔气缺口环（缺口旋转）/ 连续冲撞×3
   *  P3：魔角包围（四角悬停后回收）/ 旋转魔角（顺逆绕飞后切线飞出）/ 四向连续冲撞+四向弹 / 魔王爆发（扇形角弹+双眼激光+360°魔气弹）
   * 出场规则见 game.js：草原永久限定、第2-4轮强制概率、2倍血量；强制轮后拉平为草原普通池等权成员（可反复出场）。
   * 魔角为 Boss 自管演员（this.horns，不入 g.bullets）；冲击波为自管外扩环（this.rings）。 */
  class NiuMo extends Boss {
    constructor(g) {
      super(g, 26, 78);
      this.bossName = '牛魔';
      this.title = '草原魔王';
      // 血量：当前轮数普通 Boss 的 2 倍，有效交战时长封顶 80s（通用期后期不再失控）
      this.maxHp = Math.round(CFG.boss.refDpsAt(g.bossSpawned + 1) * Math.min(CFG.boss.fightTime(g.bossSpawned + 1) * 2, 80) * g.hpSoftMul(g.bossSpawned + 1));
      this.hp = this.maxHp;
      this.phase = 'p1';
      this.act = null;          // move / chargeWind / chargeAir / c4 / finale
      this.actT = 0;
      this.horns = [];          // 脚本化魔角演员 {x,y,ang,r,dmg,state,t,hitCd,...}
      this.rings = [];          // 360° 冲击波环 {x,y,r,vr,maxR,band,t,life,dmg,dealt}
      this.aim = null;          // 冲撞锁定点
      this.ringRot = rand(0, TAU);
      this.scl = 1;             // 体型（随阶段成长，平滑过渡）
      this._auraT = 0;
      this._f = {};             // 动作闩锁
      this._c4 = null;          // P3 四连冲撞状态
      this.hoverX = 750;
      this.baseY = CFG.H / 2;
      this.lockHp = false;        // 生命剩余10%时触发的3s锁血（仅一次）
      this.lockHpT = 0;           // 锁血剩余时间
      this.deathCols = ['#ff3b3b', '#ff7b2e', '#ffd23b', '#fff'];
      this.xpValue = 260;
    }

    bodyScale() { return this.state === 'p3' ? 1.28 : this.state === 'p2' ? 1.12 : 1; }

    /* ---------------- 状态机 ---------------- */
    update(dt, g) {
      this.t += dt; this.stateT += dt; this.actT += dt;
      this.flash = Math.max(0, this.flash - dt);
      if (this.lockHpT > 0) this.lockHpT = Math.max(0, this.lockHpT - dt);
      this.commonMove(dt);
      const p = g.player;
      this.scl += (this.bodyScale() - this.scl) * Math.min(1, dt * 3);

      if (this.state === 'enter') {
        const ty = clamp(p.y, 150, CFG.GROUND_Y - 130);
        this.x += (this.hoverX - this.x) * Math.min(1, dt * 2);
        this.y += (ty - this.y) * Math.min(1, dt * 2);
        if (Math.hypot(this.x - this.hoverX, this.y - ty) < 16) {
          this.state = 'p1'; this.phase = 'p1'; this.stateT = 0;
          this.setupPhase(g);
        }
        return;
      }

      if (this.state === 'trans') {
        const ty = clamp(p.y, 150, CFG.GROUND_Y - 130);
        this.x += (this.hoverX - this.x) * Math.min(1, dt * 2.6);
        this.y += (ty - this.y) * Math.min(1, dt * 2.6);
        this.auraTick(dt, g);
        this.updateRings(dt, g);
        this.updateHorns(dt, g);
        if (this.stateT > 1.15) { this.state = this.phase; this.stateT = 0; this.setupPhase(g); }
        return;
      }

      if (this.state === 'p1') this.updateP1(dt, g);
      else if (this.state === 'p2') this.updateP2(dt, g);
      else this.updateP3(dt, g);

      this.auraTick(dt, g);
      this.updateRings(dt, g);
      this.updateHorns(dt, g);
    }

    takeDamage(dmg, g) {
      if (this.dead || this.state === 'enter' || this.state === 'trans') return;   // 入场/转场免伤
      if (this.lockHpT > 0) return;                                              // 锁血期免疫伤害（护盾环为反馈）
      this.hp -= dmg;
      this.hitFlash();
      if (Math.random() < 0.3) burst(g, this.x - 14, this.y, 2, ['#ff3b3b', '#ff7b2e'], 130, 3, 0.18);
      if (!this.enraged && this.hp > 0 && this.hp <= this.maxHp * 0.3) {
        this.enraged = true;
        SFX.bossEnrage(); g.shake(10);
        g.toast(`${this.bossName} 狂暴了！`, 1.8, 'lt');
        burst(g, this.x, this.y, 24, ['#ff3b3b', '#ffd23b', '#fff'], 280, 6, 0.6, 130);
      }
      // 生命剩余10%：3s 锁血（仅一次），锁定在10%线
      if (!this.lockHp && this.hp > 0 && this.hp <= this.maxHp * 0.1) {
        this.lockHp = true; this.lockHpT = 3;
        this.hp = Math.ceil(this.maxHp * 0.1);
        SFX.bossEnrage(); g.shake(12);
        g.toast('牛魔进入锁血状态！', 2, 'lt');
        burst(g, this.x, this.y, 28, ['#ff3b3b', '#ffd23b', '#fff'], 300, 6, 0.65, 140);
      }
      if (this.hp <= 0) { this.hp = 0; this.die(g); }
    }

    setupPhase(g) {
      this.actT = 0;
      this.act = 'move';
      this.aim = null;
      this._c4 = null;
      this.ringRot = rand(0, TAU);
      this._f = {};
      this.contactDmg = 26;
      if (this.phase === 'p1') {
        g.toast('牛角围攻！', 1.6, 'lt');
      } else if (this.phase === 'p2') {
        g.toast('魔牛追杀！', 1.8, 'lt');
        SFX.phaseRise(); g.shake(6);
      } else {
        g.toast('魔王爆发！', 2.0, 'lt');
        SFX.phaseRise(); g.shake(8);
        burst(g, this.x, this.y, 26, ['#ff3b3b', '#ff7b2e', '#ffd23b'], 300, 7, 0.7, 120);
      }
    }

    /** P3→P1 无限循环；转场清场（魔角爆散、冲击波清空），转场免伤 */
    advancePhase(g) {
      if (this.state !== 'p1' && this.state !== 'p2' && this.state !== 'p3') return;
      for (const h of this.horns) burst(g, h.x, h.y, 5, ['#ff5a4a', '#ffd23b'], 140, 3, 0.3);
      this.horns.length = 0;
      this.rings.length = 0;
      this.contactDmg = 26;
      if (this.phase === 'p1') this.phase = 'p2';
      else if (this.phase === 'p2') this.phase = 'p3';
      else this.phase = 'p1';
      this.state = 'trans'; this.stateT = 0;
      SFX.phaseRise();
    }

    /* ---------------- 通用助手 ---------------- */
    drift(dt, g, x, y) {
      this.x += (x - this.x) * Math.min(1, dt * 2.2);
      this.y += (y - this.y) * Math.min(1, dt * 2.2);
    }
    /** 双角尖世界坐标（与 drawHorn 对齐）：side 0 左角 / 1 右角 */
    tipPos(side) {
      const s = this.scl, len = this.state === 'p3' ? 1.25 : this.state === 'p2' ? 1.12 : 1;
      return { x: this.x + (side ? 60 : -60) * len * s, y: this.y - 66 * len * s };
    }
    charging() { return this.act === 'chargeWind' || this.act === 'chargeAir'; }
    beginCharge(g, p) {
      this.act = 'chargeWind'; this.actT = 0;
      this.aim = { x: p.x, y: p.y };
      SFX.bossCharge();
    }
    /** 冲撞子状态：蓄力 wind 秒 → 冲刺；到位返回 true（由调用方放冲击波/弹幕） */
    chargeTick(dt, g, wind) {
      if (this.act === 'chargeWind') {
        const p = g.player;
        if (this.actT > wind - 0.15) { this.aim.x = clamp(p.x, 80, CFG.W - 80); this.aim.y = clamp(p.y, 80, CFG.GROUND_Y - 70); }
        if (this.actT > wind) {
          this.act = 'chargeAir'; this.actT = 0;
          this.contactDmg = 30; SFX.charge(); g.shake(5);
        }
        return false;
      }
      if (this.act === 'chargeAir') return this.doCharge(dt, g);
      return false;
    }
    doCharge(dt, g) {
      const dx = this.aim.x - this.x, dy = this.aim.y - this.y, d = Math.hypot(dx, dy) || 1;
      const sp = 680 * dt;
      g.particles.push(new Particle(this.x + rand(-26, 26), this.y + rand(-20, 20),
        rand(-50, 50), rand(-30, 30), 0.3, 5, '#ff6b5e'));
      g.rocks.forEach(r => { if (!r.dead && r.contains(this.x, this.y, this.radius)) r.destroy(g); });
      if (d < sp + 16 || this.actT > 0.85) {
        this.x = this.aim.x; this.y = this.aim.y;
        burst(g, this.x, this.y, 12, ['#ff5a4a', '#ffd23b', '#fff'], 220, 5, 0.4);
        return true;
      }
      this.x += dx / d * Math.min(sp, d); this.y += dy / d * Math.min(sp, d);
      return false;
    }
    /** 360° 圆形冲击波：外扩能量环，环带扫到玩家造成伤害 */
    shockwave(g, dmg) {
      this.rings.push({ x: this.x, y: this.y, r: this.radius * 0.5, vr: 440, maxR: 800, band: 30,
        t: 0, life: 1.9, dmg: Math.round(dmg * g.atkScale), dealt: false });
      g.shake(7); SFX.shock();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.particles.push(new Particle(this.x, this.y,
          Math.cos(a) * rand(140, 280), Math.sin(a) * rand(140, 280), 0.4, rand(3, 6), '#ff6b5e'));
      }
    }
    updateRings(dt, g) {
      const p = g.player;
      for (const r of this.rings) {
        r.t += dt; r.r += r.vr * dt;
        if (!r.dealt && Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - r.r) < r.band + p.radius * 0.7) {
          r.dealt = true; p.hurt(r.dmg, g, this.dsrc);
        }
      }
      this.rings = this.rings.filter(r => r.t < r.life && r.r < r.maxR);
    }
    /** 牛角散射：双角尖各 n 发，朝左扇形覆盖 */
    fireScatter(g) {
      const t0 = this.tipPos(0), t1 = this.tipPos(1);
      this.fireHornFan(g, t0.x, t0.y, 5, 0.95, 13);
      this.fireHornFan(g, t1.x, t1.y, 5, 0.95, 13);
      g.shake(3);
    }
    fireHornFan(g, x, y, n, spread, dmg) {
      for (let i = 0; i < n; i++) {
        const tt = n === 1 ? 0.5 : i / (n - 1);
        const a = Math.PI + (tt - 0.5) * spread;
        const sp = rand(270, 340);
        g.bullets.push(new Bullet(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
          { kind: 'horn', r: 8, dmg: Math.round(dmg * g.atkScale), life: 5 }));
      }
      SFX.enemyShoot();
    }
    /** 魔气缺口环：n 发圆周布弹，gapAng 处留缺口 */
    fireQiRing(g, n, gapAng, spd, r, dmg) {
      const base = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = base + (i / n) * TAU;
        let diff = a - gapAng;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        if (Math.abs(diff) < 0.5) continue;
        g.bullets.push(new Bullet(this.x, this.y, Math.cos(a) * spd, Math.sin(a) * spd,
          { kind: 'qi', r, dmg: Math.round(dmg * g.atkScale), life: 6, spinRate: 2 }));
      }
      SFX.enemyShoot();
    }
    /** 追踪魔角：双角各一发，转向速率低（玩家移动后不会立即跟随） */
    fireHomingPair(g) {
      [this.tipPos(0), this.tipPos(1)].forEach(tp => {
        const a = Math.PI + rand(-0.3, 0.3);
        const sp = 240;
        g.bullets.push(new Bullet(tp.x, tp.y, Math.cos(a) * sp, Math.sin(a) * sp,
          { kind: 'magicHorn', r: 20, dmg: Math.round(15 * g.atkScale), life: 5.5,
            homing: true, turnRate: 1.6 }));
      });
      SFX.enemyShoot();
    }
    /** 四方向魔气弹（P3 连撞段尾） */
    burst4(g) {
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        g.bullets.push(new Bullet(this.x, this.y, Math.cos(a) * 300, Math.sin(a) * 300,
          { kind: 'qi', r: 11, dmg: Math.round(14 * g.atkScale), life: 5 }));
      }
      g.shake(6); SFX.shock();
      burst(g, this.x, this.y, 10, ['#ff5a4a', '#ffd23b'], 200, 5, 0.4);
    }
    /** 红色魔气光环粒子（P2 少量 / P3 大量） */
    auraTick(dt, g) {
      const inP3 = this.state === 'p3' || (this.state === 'trans' && this.phase === 'p3');
      const inP2 = this.state === 'p2' || (this.state === 'trans' && this.phase === 'p2');
      const lvl = inP3 ? 2 : inP2 ? 1 : 0;
      if (!lvl) return;
      this._auraT -= dt;
      if (this._auraT <= 0) {
        this._auraT = lvl === 2 ? 0.05 : 0.1;
        const n = lvl === 2 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const a = rand(0, TAU), rr = rand(36, 78) * this.scl;
          g.particles.push(new Particle(this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr,
            rand(-30, 30), rand(-70, -20), rand(0.4, 0.8), rand(3, 7),
            lvl === 2 ? ['#ff3b3b', '#ff7b2e', '#c92a2a'][randi(0, 2)] : '#e0453a'));
        }
      }
    }

    /* ---------------- 魔角演员 ---------------- */
    spawnHorn(g, x, y, opts) {
      this.horns.push(Object.assign({
        x, y, ang: rand(0, TAU), r: 15, dmg: Math.round(15 * g.atkScale),
        state: 'travel', t: 0, hitCd: 0, spd: 460, tx: x, ty: y,
        hoverT: 0.6, afterHover: 'lunge', orbitR: 130, orbitDir: 1, orbitTurns: 1,
        orbitSpd: 3.4, orbitAcc: 0, orbitAng: null, lungeSpd: 660,
        vx: 0, vy: 0, retSide: 0, trail: []
      }, opts));
    }
    /** P1-4 牛角回旋：双角飞向玩家上/下方，绕一圈后回收 */
    boomerang(g, p) {
      const R = 120;
      const t0 = this.tipPos(0), t1 = this.tipPos(1);
      this.spawnHorn(g, t0.x, t0.y,
        { tx: p.x, ty: clamp(p.y - R, 90, CFG.GROUND_Y - 80), afterHover: 'orbit',
          orbitDir: -1, orbitTurns: 1, orbitR: R, orbitSpd: 3.2, retSide: 0 });
      this.spawnHorn(g, t1.x, t1.y,
        { tx: p.x, ty: clamp(p.y + R, 90, CFG.GROUND_Y - 80), afterHover: 'orbit',
          orbitDir: 1, orbitTurns: 1, orbitR: R, orbitSpd: 3.2, retSide: 1 });
      SFX.bossCharge();
    }
    /** P2-1 上下夹角：双角飞至玩家上/下方悬停预警，再同时向玩家刺击 */
    pincer(g, p) {
      const t0 = this.tipPos(0), t1 = this.tipPos(1);
      this.spawnHorn(g, t0.x, t0.y,
        { tx: clamp(p.x, 120, CFG.W - 120), ty: clamp(p.y - 160, 90, CFG.GROUND_Y - 90),
          hoverT: 0.55, afterHover: 'lunge', lungeSpd: 680, retSide: 0 });
      this.spawnHorn(g, t1.x, t1.y,
        { tx: clamp(p.x, 120, CFG.W - 120), ty: clamp(p.y + 160, 90, CFG.GROUND_Y - 90),
          hoverT: 0.55, afterHover: 'lunge', lungeSpd: 680, retSide: 1 });
      SFX.bossCharge();
    }
    /** P3-1 魔角包围：四角飞至玩家上/下/左上/左下，悬停预警后全体回收 */
    surround(g, p) {
      const tgts = [
        { x: p.x, y: clamp(p.y - 175, 90, CFG.GROUND_Y - 90) },
        { x: p.x, y: clamp(p.y + 175, 90, CFG.GROUND_Y - 90) },
        { x: clamp(p.x - 165, 90, CFG.W - 90), y: clamp(p.y - 120, 90, CFG.GROUND_Y - 90) },
        { x: clamp(p.x - 165, 90, CFG.W - 90), y: clamp(p.y + 120, 90, CFG.GROUND_Y - 90) }
      ];
      tgts.forEach((t, i) => {
        this.spawnHorn(g, this.x + (i % 2 ? 40 : -40) * this.scl, this.y + (i < 2 ? -40 : 40) * this.scl,
          { tx: t.x, ty: t.y, hoverT: 1.1, afterHover: 'return', retSide: i % 2, r: 16 });
      });
      SFX.bossCharge();
    }
    /** P3-2 旋转魔角：双角绕玩家顺/逆时针飞绕 2.2 圈后切线飞出 */
    spinHorns(g, p) {
      const R = 135;
      const a1 = -0.75, a2 = 0.75;
      const t0 = this.tipPos(0), t1 = this.tipPos(1);
      this.spawnHorn(g, t0.x, t0.y,
        { tx: p.x + Math.cos(a1) * R, ty: p.y + Math.sin(a1) * R, spd: 520,
          afterHover: 'orbit', orbitDir: 1, orbitTurns: 2.2, orbitR: R, orbitSpd: 3.6, afterOrbit: 'fling' });
      this.spawnHorn(g, t1.x, t1.y,
        { tx: p.x + Math.cos(a2) * R, ty: p.y + Math.sin(a2) * R, spd: 520,
          afterHover: 'orbit', orbitDir: -1, orbitTurns: 2.2, orbitR: R, orbitSpd: 3.6, afterOrbit: 'fling' });
      SFX.bossCharge();
    }
    updateHorns(dt, g) {
      const p = g.player;
      for (const h of this.horns) {
        h.t += dt; h.hitCd = Math.max(0, h.hitCd - dt);
        if (h.state === 'travel') {
          const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy) || 1;
          h.ang = Math.atan2(dy, dx);
          const st = h.spd * dt;
          if (d < st + 12) { h.x = h.tx; h.y = h.ty; h.t = 0; h.state = 'hover'; }
          else { h.x += dx / d * st; h.y += dy / d * st; }
        } else if (h.state === 'hover') {
          h.ang += dt * 3.2;
          if (h.t > h.hoverT) {
            h.t = 0;
            if (h.afterHover === 'lunge') {
              h.state = 'lunge';
              const a = Math.atan2(p.y - h.y, p.x - h.x);
              h.vx = Math.cos(a) * h.lungeSpd; h.vy = Math.sin(a) * h.lungeSpd; h.ang = a;
            } else if (h.afterHover === 'orbit') {
              h.state = 'orbit'; h.orbitAng = null; h.orbitAcc = 0;
            } else { h.state = 'return'; }
          }
        } else if (h.state === 'lunge') {
          h.x += h.vx * dt; h.y += h.vy * dt;
          if (h.t > 1.4) h.dead = true;
        } else if (h.state === 'orbit') {
          // 枢轴为玩家实时位置；绕满圈数后回收或切线飞出
          const cx = p.x, cy = p.y;
          if (h.orbitAng === null) h.orbitAng = Math.atan2(h.y - cy, h.x - cx);
          const da = h.orbitDir * h.orbitSpd * dt;
          h.orbitAng += da; h.orbitAcc += Math.abs(da);
          h.x = cx + Math.cos(h.orbitAng) * h.orbitR;
          h.y = cy + Math.sin(h.orbitAng) * h.orbitR;
          h.ang = h.orbitAng + (h.orbitDir > 0 ? Math.PI / 2 : -Math.PI / 2);
          if (h.orbitAcc > h.orbitTurns * TAU) {
            h.t = 0;
            if (h.afterOrbit === 'fling') {
              h.state = 'fling';
              h.vx = Math.cos(h.ang) * 560; h.vy = Math.sin(h.ang) * 560;
            } else { h.state = 'return'; }
          }
        } else if (h.state === 'return') {
          const tip = this.tipPos(h.retSide);
          const dx = tip.x - h.x, dy = tip.y - h.y, d = Math.hypot(dx, dy) || 1;
          h.ang = Math.atan2(dy, dx);
          const st = 580 * dt;
          if (d < st + 14) { h.dead = true; burst(g, tip.x, tip.y, 5, ['#ff5a4a', '#ffd23b'], 130, 3, 0.3); }
          else { h.x += dx / d * st; h.y += dy / d * st; }
        } else if (h.state === 'fling') {
          h.x += h.vx * dt; h.y += h.vy * dt;
          h.ang = Math.atan2(h.vy, h.vx);
          if (h.t > 2.4 || h.x < -90 || h.x > CFG.W + 90 || h.y < -90 || h.y > CFG.H + 90) h.dead = true;
        }
        // 红色极长拖尾：记录轨迹点（静止悬停不记，避免堆叠成团）
        const last = h.trail[h.trail.length - 1];
        if (!last || (last.x - h.x) ** 2 + (last.y - h.y) ** 2 > 4) {
          h.trail.push({ x: h.x, y: h.y });
          if (h.trail.length > 26) h.trail.shift();
        }
        // 碰撞（悬停预警期不造成伤害；转场/入场免伤）
        if (!h.dead && h.state !== 'hover' && h.hitCd <= 0 &&
            this.state !== 'trans' && this.state !== 'enter') {
          if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.radius * 0.8) {
            p.hurt(h.dmg, g, this.dsrc); h.hitCd = 0.7;
            burst(g, h.x, h.y, 6, ['#ff5a4a', '#ffd23b'], 150, 4, 0.3);
          }
        }
      }
      this.horns = this.horns.filter(h => !h.dead);
    }

    /* ---------------- P1：牛角围攻 ---------------- */
    updateP1(dt, g) {
      const p = g.player;
      const T = this.stateT, f = this._f;
      this.baseY += (clamp(p.y, 150, CFG.GROUND_Y - 130) - this.baseY) * dt * 1.2;
      const ax = this.hoverX + Math.sin(this.t * 0.7) * 34;
      const ay = this.baseY + Math.sin(this.t * 1.3) * 26;
      if (!this.charging()) this.drift(dt, g, ax, ay);

      // 牛角散射（0.4s / 2.7s）
      if (T > 0.4 && !f.s1) { f.s1 = true; this.fireScatter(g); }
      if (T > 2.7 && !f.s2) { f.s2 = true; this.fireScatter(g); }

      // 牛头冲撞 1（4.4s 蓄力 → 冲撞 → 360° 冲击波）
      if (T > 4.4 && !f.c1) { f.c1 = true; this.beginCharge(g, p); }
      if (f.c1 && !f.c1d && this.charging() &&
          this.chargeTick(dt, g, 0.65)) { f.c1d = true; this.act = 'move'; this.shockwave(g, 14); this.contactDmg = 26; }

      // 牛角回旋（6.6s 放出，绕玩家一圈回收）
      if (T > 6.6 && !f.bm) { f.bm = true; this.boomerang(g, p); }

      // 第二轮散射（11.9s / 13.8s）
      if (T > 11.9 && !f.s3) { f.s3 = true; this.fireScatter(g); }
      if (T > 13.8 && !f.s4) { f.s4 = true; this.fireScatter(g); }

      // 牛头冲撞 2（14.6s）
      if (T > 14.6 && !f.c2) { f.c2 = true; this.beginCharge(g, p); }
      if (f.c2 && !f.c2d && this.charging() &&
          this.chargeTick(dt, g, 0.65)) { f.c2d = true; this.act = 'move'; this.shockwave(g, 14); this.contactDmg = 26; }

      if (T > 16.8) this.advancePhase(g);
    }

    /* ---------------- P2：魔牛追杀 ---------------- */
    updateP2(dt, g) {
      const p = g.player;
      const T = this.stateT, f = this._f;
      const inRing = T >= 8.8 && T < 13.4;
      if (!this.charging() && !inRing) {
        this.baseY += (clamp(p.y, 150, CFG.GROUND_Y - 130) - this.baseY) * dt * 1.2;
        this.drift(dt, g, this.hoverX + Math.sin(this.t * 0.8) * 30,
          this.baseY + Math.sin(this.t * 1.4) * 24);
      }

      // 上下夹角
      if (T > 0.5 && !f.pn) { f.pn = true; this.pincer(g, p); }
      // 追踪魔角 ×2 对（慢转向）
      if (T > 5.0 && !f.h1) { f.h1 = true; this.fireHomingPair(g); }
      if (T > 6.9 && !f.h2) { f.h2 = true; this.fireHomingPair(g); }

      // 魔气环：移到玩家右上方，缺口缓慢旋转
      if (inRing) {
        this.drift(dt, g, clamp(p.x + 235, 300, CFG.W - 80), clamp(p.y - 140, 90, CFG.GROUND_Y - 160));
        if (!f.r1 && T > 9.2) { f.r1 = true; this.ringRot += 0.7; this.fireQiRing(g, 18, this.ringRot, 195, 10, 13); }
        if (!f.r2 && T > 10.4) { f.r2 = true; this.ringRot += 0.7; this.fireQiRing(g, 18, this.ringRot, 205, 10, 13); }
        if (!f.r3 && T > 11.6) { f.r3 = true; this.ringRot += 0.7; this.fireQiRing(g, 20, this.ringRot, 215, 10, 13); }
        if (!f.r4 && T > 12.8) { f.r4 = true; this.ringRot += 0.7; this.fireQiRing(g, 20, this.ringRot, 225, 11, 14); }
      }

      // 连续冲撞 ×3（每次结束 360° 冲击波）
      [13.6, 15.4, 17.2].forEach((tt, i) => {
        const k = 'ch' + i, kd = k + 'd';
        if (T > tt && !f[k]) { f[k] = true; this.beginCharge(g, p); }
        if (f[k] && !f[kd] && this.charging() &&
            this.chargeTick(dt, g, 0.55)) { f[kd] = true; this.act = 'move'; this.shockwave(g, 14); this.contactDmg = 26; }
      });

      if (T > 18.8) this.advancePhase(g);
    }

    /* ---------------- P3：魔王爆发 ---------------- */
    updateP3(dt, g) {
      const p = g.player;
      const T = this.stateT, f = this._f;
      if (!this.charging() && this.act !== 'c4' && this.act !== 'finale') {
        this.baseY += (clamp(p.y, 150, CFG.GROUND_Y - 130) - this.baseY) * dt * 1.2;
        this.drift(dt, g, this.hoverX + Math.sin(this.t * 0.6) * 26,
          this.baseY + Math.sin(this.t * 1.2) * 20);
      }

      // 魔角包围（四角悬停后回收）
      if (T > 0.6 && !f.su) { f.su = true; this.surround(g, p); }
      // 旋转魔角（顺逆绕飞 2.2 圈后切线飞出）
      if (T > 5.0 && !f.sp) { f.sp = true; this.spinHorns(g, p); }

      // 连续冲撞：右侧 → 玩家上方 → 玩家下方 → 右侧，每段四方向扩散
      if (T > 11.4 && !f.c4) { f.c4 = true; this.act = 'c4'; this.actT = 0; this._c4 = { leg: 0, mode: 'repos' }; }
      if (this.act === 'c4') this.tickC4(dt, g);

      // 魔王爆发：停在玩家右侧，扇形角弹 + 双眼激光 + 360° 魔气弹
      if (T > 16.6 && !f.fin) { f.fin = true; this.act = 'finale'; this.actT = 0; }
      if (this.act === 'finale') {
        this.drift(dt, g, clamp(p.x + 300, 220, CFG.W - 90), clamp(p.y, 130, CFG.GROUND_Y - 100));
        if (this.actT > 1.15 && !f.finFire) { f.finFire = true; this.fireFinale(g, p); }
        if (this.actT > 2.6) this.advancePhase(g);
      }

      if (T > 22.5) this.advancePhase(g);   // 兜底
    }

    /** P3 四连冲撞：repos（快速移位）→ wind（锁定）→ air（冲撞）→ 四向弹，共 4 段 */
    tickC4(dt, g) {
      const p = g.player;
      const c = this._c4;
      if (!c) return;
      const anchors = [
        { x: clamp(p.x + 300, 200, CFG.W - 90), y: clamp(p.y, 120, CFG.GROUND_Y - 90) },
        { x: clamp(p.x, 100, CFG.W - 100), y: clamp(p.y - 210, 80, CFG.GROUND_Y - 120) },
        { x: clamp(p.x, 100, CFG.W - 100), y: clamp(p.y + 200, 120, CFG.GROUND_Y - 70) },
        { x: clamp(p.x + 300, 200, CFG.W - 90), y: clamp(p.y, 120, CFG.GROUND_Y - 90) }
      ];
      const a = anchors[c.leg];
      if (c.mode === 'repos') {
        const dx = a.x - this.x, dy = a.y - this.y, d = Math.hypot(dx, dy) || 1;
        const sp = 780 * dt;
        g.particles.push(new Particle(this.x + rand(-24, 24), this.y + rand(-18, 18),
          rand(-40, 40), rand(-25, 25), 0.3, 5, '#ff8a70'));
        if (d < sp + 14) { c.mode = 'wind'; this.actT = 0; this.aim = { x: p.x, y: p.y }; SFX.bossCharge(); }
        else { this.x += dx / d * Math.min(sp, d); this.y += dy / d * Math.min(sp, d); }
      } else if (c.mode === 'wind') {
        if (this.actT > 0.3) { this.aim = { x: clamp(p.x, 80, CFG.W - 80), y: clamp(p.y, 80, CFG.GROUND_Y - 70) }; }
        if (this.actT > 0.45) { c.mode = 'air'; this.actT = 0; this.contactDmg = 30; SFX.charge(); g.shake(5); }
      } else {
        if (this.doCharge(dt, g)) {
          this.contactDmg = 26;
          this.burst4(g);
          c.leg++;
          if (c.leg >= 4) { this.act = 'move'; this._c4 = null; }
          else { c.mode = 'repos'; this.actT = 0; }
        }
      }
    }

    /** P3-4 魔王爆发：三种弹幕同时释放 */
    fireFinale(g, p) {
      const s = this.scl;
      // 牛角扇形弹 ×2 组（双角尖，朝左扇形扩散）
      this.fireHornFan(g, this.x - 60 * 1.25 * s, this.y - 66 * 1.25 * s, 6, 1.0, 14);
      this.fireHornFan(g, this.x + 60 * 1.25 * s, this.y - 66 * 1.25 * s, 6, 1.0, 14);
      // 眼部激光 ×2（双眼瞄向玩家区域；锚点对齐 niu3 重绘图红眼中心）
      const eyes = [{ x: this.x - 22 * s, y: this.y - 28 * s }, { x: this.x + 22 * s, y: this.y - 28 * s }];
      eyes.forEach((e, i) => {
        const a = Math.atan2(p.y - e.y, p.x - e.x) + (i ? 0.12 : -0.12);
        g.beams.push(new Beam(e.x, e.y, a, 1500, 14, Math.round(18 * g.atkScale), 0.55, false));
      });
      // 360° 魔气弹
      this.fireQiRing(g, 24, this.ringRot, 240, 11, 15);
      g.shake(10); SFX.shock();
    }

    /* ---------------- 程序化渲染 ---------------- */
    render(ctx) {
      const inP2 = this.state === 'p2' || (this.state === 'trans' && this.phase === 'p2');
      const inP3 = this.state === 'p3' || (this.state === 'trans' && this.phase === 'p3');
      const s = this.scl;

      // —— 360° 冲击波环（世界坐标） ——
      for (const r of this.rings) {
        const alpha = clamp(1.25 - r.t / r.life, 0, 1);
        ctx.strokeStyle = `rgba(255,70,50,${0.22 * alpha})`;
        ctx.lineWidth = r.band * 0.8;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,140,90,${0.85 * alpha})`;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      }

      // —— 冲撞预警虚线 ——
      if (((this.act === 'chargeWind') || (this.act === 'c4' && this._c4 && this._c4.mode === 'wind')) && this.aim) {
        if (Math.floor(this.t * 12) % 2 === 0) {
          ctx.save();
          ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
          ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.aim.x, this.aim.y); ctx.stroke();
          ctx.restore();
        }
      }

      // —— 魔角演员 ——
      for (const h of this.horns) this.drawMagicHorn(ctx, h.x, h.y, h.ang, h.r / 15, h.state === 'hover', inP3, h.trail);

      // —— Boss 本体 ——
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(s, s);

      // —— 重绘美术：niu1/niu2/niu3 三阶段正面牛头（含双角与阶段光晕）。
      //    参考图由 scale(2)×bodyScale 渲染后 autocrop 导出，故图像素→基准坐标
      //    系数 k = 1/(2×bodyScale)；原点为牛头中心，角部高耸故图心在原点上方。
      const niuSpr = inP3 ? Sprites.niu3 : inP2 ? Sprites.niu2 : Sprites.niu1;
      const niuK = inP3 ? 1 / 2.56 : inP2 ? 1 / 2.24 : 0.5;
      const nw = niuSpr.width * niuK, nh = niuSpr.height * niuK;
      const niuOX = 0;
      const niuOY = inP3 ? -22 : inP2 ? -28 : -34;
      ctx.drawImage(niuSpr, -nw / 2 + niuOX, -nh / 2 + niuOY, nw, nh);

      // —— 锁血护盾（生命≤10%触发期）：脉动红环 + 金边 ——
      if (this.lockHpT > 0) {
        const pk = 1 + Math.sin(this.t * 14) * 0.05;
        ctx.save();
        ctx.scale(pk, pk);
        ctx.strokeStyle = `rgba(255,60,40,${0.5 + Math.sin(this.t * 10) * 0.25})`;
        ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, 72, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,200,120,0.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 79, 0, TAU); ctx.stroke();
        // 旋转碎点
        for (let i = 0; i < 6; i++) {
          const a = this.t * 2.4 + i * (TAU / 6);
          ctx.fillStyle = `rgba(255,180,90,${0.6})`;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 75, Math.sin(a) * 75, 2.6, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      // 受击闪红（重色，4s 冷却一次）：离屏红染只作用于牛魔图像素，不染背景天空
      const niuFlashA = bossFlashAlpha(this.flash);
      if (niuFlashA > 0) {
        drawSpriteTinted(ctx, niuSpr, niuOX, niuOY, nw, nh, 0, '#ff1e10', niuFlashA);
      }
      ctx.restore();
    }

    /** 头上弯角：纯黑角身 + 白色横向细致花纹（整体化），向上收束成更尖锐的长角尖 */
    drawHorn(ctx, side, inP2, inP3) {
      const len = inP3 ? 1.25 : inP2 ? 1.12 : 1;
      const w = inP3 ? 1.3 : inP2 ? 1.15 : 1;
      ctx.save();
      ctx.scale(side, 1);
      // 角根落在该侧眉毛外端的左上/右上侧（眉毛外端=眼心外推8px、y=browY-4=-20）
      const bx = 30, by = -22;                     // 角根（贴眉外端左/右上侧）
      const cx = 50 * len, cy = -50 * len;          // 控制点
      const tx = 66 * len, ty = -66 * len;          // 角身终点
      const px = 70 * len, py = -116 * len;         // 拉长的尖锐角尖
      // —— 纯黑角身（butt cap，避免顶端圆头；角身止于 tx,ty，角尖另画长锥） ——
      ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0a0606'; ctx.lineWidth = 20 * w;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(cx, cy, tx, ty);
      ctx.stroke();
      // —— 尖锐长角尖：底边匹配角身宽度，长锥收束成尖点 ——
      ctx.fillStyle = '#0a0606';
      ctx.beginPath();
      ctx.moveTo(tx - 9.5 * w, ty + 5);
      ctx.lineTo(tx + 9.5 * w, ty + 5);
      ctx.lineTo(px, py);
      ctx.closePath(); ctx.fill();
      // —— 白色横向细致花纹 ——
      ctx.strokeStyle = '#f5efe2';
      // 角身段（二次曲线）
      for (let i = 1; i <= 6; i++) {
        const t = i / 7, omt = 1 - t;
        const sx = omt * omt * bx + 2 * omt * t * cx + t * t * tx;
        const sy = omt * omt * by + 2 * omt * t * cy + t * t * ty;
        let tgx = 2 * omt * (cx - bx) + 2 * t * (tx - cx);
        let tgy = 2 * omt * (cy - by) + 2 * t * (ty - cy);
        const tl = Math.hypot(tgx, tgy) || 1; tgx /= tl; tgy /= tl;
        const nx = -tgy, ny = tgx;
        const half = (9 - i * 0.7) * w;           // 靠尖处纹路渐细
        ctx.lineWidth = 1.4 * w;
        ctx.beginPath();
        ctx.moveTo(sx - nx * half, sy - ny * half);
        ctx.lineTo(sx + nx * half, sy + ny * half);
        ctx.stroke();
      }
      // 角尖段（直线 tx,ty → px,py，两条细纹）
      for (let i = 1; i <= 2; i++) {
        const t = i / 3;
        const sx = tx + (px - tx) * t;
        const sy = ty + (py - ty) * t;
        let tgx = px - tx, tgy = py - ty;
        const tl = Math.hypot(tgx, tgy) || 1; tgx /= tl; tgy /= tl;
        const nx = -tgy, ny = tgx;
        const half = (5 - i * 1.6) * w;            // 角尖纹路更细
        ctx.lineWidth = 1.1 * w;
        ctx.beginPath();
        ctx.moveTo(sx - nx * half, sy - ny * half);
        ctx.lineTo(sx + nx * half, sy + ny * half);
        ctx.stroke();
      }
      // —— 角尖红光（P2/P3） ——
      const tipGlow = inP3 ? 1 : inP2 ? 0.75 : 0.4;
      if (inP2 || inP3) {
        ctx.strokeStyle = `rgba(255,70,50,${tipGlow})`; ctx.lineWidth = 6 * w;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
      if (inP3) {
        ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(36, -36); ctx.lineTo(46, -48); ctx.lineTo(40, -60);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(54, -52); ctx.lineTo(60, -66);
        ctx.stroke();
      }
      ctx.restore();
    }

    /** 魔角演员（世界坐标）：弯角尖角朝 +x，悬停预警时脉动 */
    drawMagicHorn(ctx, x, y, ang, size, hover, p3, trail) {
      const pulse = hover ? 1 + Math.sin(this.t * 16) * 0.15 : 1;
      // —— 红色极长拖尾（世界坐标，先画压在角身下；尾淡头亮，三层叠加） ——
      if (trail && trail.length > 1) {
        const n = trail.length;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 0; i < n - 1; i++) {
          const t = (i + 1) / n;                 // 0=尾端(旧) → 1=头端(新,近角)
          const a = trail[i], b = trail[i + 1];
          // 外层柔光（暗红，最宽）
          ctx.strokeStyle = `rgba(255,60,40,${0.05 + 0.25 * t})`;
          ctx.lineWidth = 4 + 14 * t;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          // 中层橙红
          ctx.strokeStyle = `rgba(255,130,80,${0.15 + 0.6 * t})`;
          ctx.lineWidth = 1.5 + 4.5 * t;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          // 内层热白芯
          ctx.strokeStyle = `rgba(255,225,170,${0.6 * t})`;
          ctx.lineWidth = 0.5 + 1.8 * t;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.scale(size * pulse, size * pulse);
      // 暗红光晕
      ctx.fillStyle = p3 ? 'rgba(255,60,40,0.42)' : 'rgba(224,60,50,0.3)';
      ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.fill();
      // —— 纯黑角身（整体化）+ 尖锐角尖 ——
      const P0x = -16, P0y = 8, P1x = 5, P1y = -17, tx = 25, ty = -13;
      const px = 32, py = -19;                       // 尖锐角尖
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0a0606'; ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(P0x, P0y);
      ctx.quadraticCurveTo(P1x, P1y, tx, ty);
      ctx.lineTo(px, py);
      ctx.stroke();
      // —— 白色横向细致花纹 ——
      ctx.strokeStyle = '#f5efe2';
      for (let i = 1; i <= 6; i++) {
        const t = i / 7, omt = 1 - t;
        const bx = omt * omt * P0x + 2 * omt * t * P1x + t * t * tx;
        const by = omt * omt * P0y + 2 * omt * t * P1y + t * t * ty;
        let tgx = 2 * omt * (P1x - P0x) + 2 * t * (tx - P1x);
        let tgy = 2 * omt * (P1y - P0y) + 2 * t * (ty - P1y);
        const tl = Math.hypot(tgx, tgy) || 1; tgx /= tl; tgy /= tl;
        const nx = -tgy, ny = tgx;
        const half = 6.5 - i * 0.6;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(bx - nx * half, by - ny * half);
        ctx.lineTo(bx + nx * half, by + ny * half);
        ctx.stroke();
      }
      // —— 尖锐角尖（纯黑三角） ——
      ctx.fillStyle = '#0a0606';
      ctx.beginPath();
      ctx.moveTo(tx - 3.5, ty + 2); ctx.lineTo(tx + 3.5, ty + 2); ctx.lineTo(px, py);
      ctx.closePath(); ctx.fill();
      // —— 角尖红光（P3 更亮） ——
      ctx.strokeStyle = p3 ? 'rgba(255,70,50,1)' : 'rgba(255,90,74,0.55)';
      ctx.lineWidth = p3 ? 5 : 4;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
      // 角尖黄芯高光
      ctx.fillStyle = '#ffd23b';
      ctx.beginPath(); ctx.arc(px - 2, py + 2, 2.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /* ================ Z. 荒地·巨型骨龙王（地图专属分段 Boss） ================ */
  /**
   * 巨型分段骨龙 / 弹幕 Boss：头部 + 200 节身体（单节约普通龙小段 2~3 倍）。
   * 核心机制：本体（头）未击溃时，200 节身体全部无敌；击溃头部后身体解除无敌，
   * 逐节击杀，被击毁的身体节脱离为独立小怪（BoneDragonMini）。
   * 攻击：巨体冲撞 + 绿色拖尾火焰弹连射。
   * 出场：仅荒地（wasteland）地图，第 2-3 轮强制高概率；强制轮后拉平为荒地普通池等权成员（可反复出场）。
   */
  class BoneDragonKing extends Boss {
    constructor(g) {
      super(g, 26, 36);
      this.bossName = '巨型骨龙王';
      this.title = '分段弹幕型';
      this.deathCols = ['#d8d3c2', '#8f8a78', '#4ade80', '#e8e4d8', '#fff'];
      this.contactDmg = 26;          // 头部接触伤害
      this.bodyContactDmg = 10;      // 身体节接触伤害（轻微）
      // 龙身参数
      this.segR = 20;                  // 身体节半径（约普通龙小段 miniR=11 的 1.8 倍）
      this.headR = this.segR * 1.22;   // 头部半径
      this.segSpace = 30;              // 节间距
      this.segCount = 201;             // 0=头，1~200=身体
      this.isMini = false;             // 供 DRAGON_THEMES.bone.seg/head 读取
      this.state = 'rise';
      this.headAlive = true;
      // 身体节血量（按轮数成长）
      const hpMul = 1 + (g.round - 1) * 0.16 + g.time * 0.0025;
      this.bodySegHp = Math.round(40 * hpMul);
      this.headMaxHp = this.maxHp;     // 头部血量 = Boss 基础血量（fightTime×DPS）
      // 初始化轨迹 + 节
      this.xL = 44; this.xR = CFG.W - 44;
      this.riseY = rand(160, 300);
      this.burrowY = CFG.GROUND_Y + rand(22, 40);
      this.ha = -Math.PI / 2;
      this.hx = 0; this.hy = -1;
      this.turnT = 0; this.arcT = 0; this.arcRate = 0; this.targetHa = this.ha;
      this.burrowT = 0;
      this.burrowHpThreshold = 0.7;   // 头部血量降到 70% 时强制钻地（逐级 0.7→0.4→0.1）
      this.chaseT = 0;                // 出土后追击玩家时长
      // 冲撞 / 射击
      this.chargeT = rand(2.5, 4.5);
      this.chargeCd = 0;
      this.fireT = 0.6;
      // 从屏幕右侧中心钻出入场：头部在右边缘地面下，龙身向右延伸出屏
      this.x = this.xR; this.y = this.burrowY;
      this.trail = [];
      for (let i = 0; i < this.segCount + 2; i++) {
        this.trail.push({ x: this.xR + i * this.segSpace, y: this.burrowY });
      }
      this.segments = [];
      for (let i = 0; i < this.segCount; i++) {
        const p = this.trail[Math.min(i, this.trail.length - 1)];
        this.segments.push({ x: p.x, y: p.y, hp: this.bodySegHp, maxHp: this.bodySegHp, flash: 0, dead: false });
      }
      this.segments[0].hp = this.headMaxHp;
      this.segments[0].maxHp = this.headMaxHp;
      this.radius = this.headR;
      this.maxMini = 12;   // 同时在场的分裂小段上限
      this.booms = [];     // 分裂爆炸队列（分帧播放，避免一帧上千粒子卡顿）
      this.spawnInvuln = 1.8;
    }

    /* ---------- 轨迹 / 节 ---------- */
    segRAt(i) {
      const n = this.segments.length;
      return this.segR * (1 - 0.38 * (i / Math.max(1, n - 1)));
    }
    advanceTrail() {
      // 跳过几乎重合的点：冻结 / 极慢速时避免轨迹无限增长导致 updateSegments 爆量卡死
      const last = this.trail[0];
      if (!last || Math.hypot(this.x - last.x, this.y - last.y) > 0.5) {
        this.trail.unshift({ x: this.x, y: this.y });
      }
      const maxArc = (this.segments.length + 1) * this.segSpace + 30;
      let acc = 0;
      for (let i = 1; i < this.trail.length; i++) {
        acc += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y);
        if (acc > maxArc) { this.trail.length = i + 1; break; }
      }
      // 硬上限兜底，防止极端情况下轨迹无限增长
      if (this.trail.length > 2000) this.trail.length = 2000;
    }
    updateSegments() {
      // 单次扫描：存活节紧凑排列（死掉的节不占位），共用一个轨迹指针，O(n+m)
      const trail = this.trail;
      if (trail.length < 2) return;
      let ti = 1;
      let acc = 0;
      let a = trail[0], b = trail[1];
      let segLen = Math.hypot(b.x - a.x, b.y - a.y) || 0.0001;
      let aliveIdx = 0;   // 存活节序号：随死亡递增压缩，避免龙身残留远处导致卡关
      for (let idx = 0; idx < this.segments.length; idx++) {
        const s = this.segments[idx];
        if (s.dead) continue;
        const target = (aliveIdx + 1) * this.segSpace;
        aliveIdx++;
        while (ti < trail.length - 1 && acc + segLen < target) {
          acc += segLen;
          ti++;
          a = trail[ti - 1]; b = trail[ti];
          segLen = Math.hypot(b.x - a.x, b.y - a.y) || 0.0001;
        }
        const tt = (target - acc) / segLen;
        s.x = a.x + (b.x - a.x) * tt;
        s.y = a.y + (b.y - a.y) * tt;
      }
    }

    /* ---------- 受击 ---------- */
    /** 露出判定：高于地面一定距离才可命中/接触 */
    exposed(s, i) {
      return !s.dead && s.y < CFG.GROUND_Y - this.segRAt(i) * 0.35;
    }
    hitTest(bx, by, br) {
      if (this.spawnInvuln > 0) return -1;
      // 完全体（头部存活）：头部 + 露出的身体节都可命中，取最近
      let best = -1, bestD = Infinity;
      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        if (!this.exposed(s, i)) continue;
        const d = Math.hypot(s.x - bx, s.y - by);
        const rr = i === 0 ? this.headR : this.segRAt(i);
        if (d < br + rr * 0.95 && d < bestD) { bestD = d; best = i; }
      }
      return best;
    }
    touchesPoint(px, py, pr) {
      if (this.spawnInvuln > 0) return false;
      if (this.headAlive) {
        // 完全体：头部 + 露出的身体节都可接触玩家（身体造成轻微伤害）
        const head = this.segments[0];
        if (this.exposed(head, 0) && Math.hypot(head.x - px, head.y - py) < pr + this.headR) return true;
        for (let i = 1; i < this.segments.length; i++) {
          const s = this.segments[i];
          if (!this.exposed(s, i)) continue;
          if (Math.hypot(s.x - px, s.y - py) < pr + this.segRAt(i) * 0.8) return true;
        }
        return false;
      }
      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        if (!this.exposed(s, i)) continue;
        const rr = i === 0 ? this.headR : this.segRAt(i);
        if (Math.hypot(s.x - px, s.y - py) < pr + rr * 0.85) return true;
      }
      return false;
    }
    /** 根据玩家触碰位置返回对应伤害值（头部高伤 / 身体节轻伤） */
    contactDamageAt(px, py) {
      if (this.headAlive) {
        const head = this.segments[0];
        if (this.exposed(head, 0) && Math.hypot(head.x - px, head.y - py) < this.headR + 30) return this.contactDmg;
        return this.bodyContactDmg;
      }
      return this.contactDmg;
    }
    nearestExposed(px, py) {
      let best = null, bestD = Infinity;
      // 完全体/崩解态：所有露出节均可选为目标
      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        if (!s || !this.exposed(s, i)) continue;
        const d = Math.hypot(s.x - px, s.y - py);
        if (d < bestD) { bestD = d; best = { x: s.x, y: s.y, i }; }
      }
      return best;
    }
    damageAt(px, py, dmg, g) {
      const ne = this.nearestExposed(px, py);
      if (ne) this.damageSegment(ne.i, dmg, g, null, '');
    }
    aoeDamage(x, y, radius, dmg, g) {
      // 完全体/崩解态：范围内所有露出节均受伤
      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        if (!s || !this.exposed(s, i)) continue;
        const rr = i === 0 ? this.headR : this.segRAt(i);
        if (Math.hypot(s.x - x, s.y - y) < radius + rr) {
          this.damageSegment(i, dmg, g, null, '');
        }
      }
    }
    damageSegment(i, dmg, g, kb, element) {
      if (this.dead) return;
      const s = this.segments[i];
      if (!s || s.dead || this.spawnInvuln > 0) return;
      if (element === 'flame') { this.dotT = 3; this.dotDps = dmg * 0.4; this.dotType = 'flame'; burst(g, s.x, s.y, 26, ['#ff7b2e', '#ff5a1a', '#ffd23b', '#c23408'], 260, 6.5, 0.34, 85); burst(g, s.x, s.y, 10, ['#fff3a8', '#ffe94d', '#ffd23b'], 180, 4, 0.24, 50); }
      else if (element === 'poison') { this.dotT = 6; this.dotDps = dmg * 0.25; this.dotType = 'poison'; burst(g, s.x, s.y, 8, ['#2dd44a', '#7dff6a', '#4ade80', '#0a3a0a'], 120, 3, 0.34, 90); }
      else if (element === 'ice') { this.dotT = 2; this.dotDps = dmg * 0.3; this.dotType = 'ice'; this.freezeT = 0; burst(g, s.x, s.y, 36, ['#bfe9ff', '#eaf7ff', '#7fc6ef'], 540, 9.4, 0.36, 40); }
      // 骨龙王体积庞大、免疫冰冻（不再设置 freezeT），持续冰弹也不会将其冻住卡死

      if (this.headAlive && i !== 0) {
        // 完全体打身体：身体受 70%（锁血1，裂开），头部传导受 50%
        s.hp -= dmg * 0.7;
        s.flash = 0.12; this.hurtT = 0.12;
        burst(g, s.x, s.y, 3, ['#fff', '#4ade80', '#d8d3c2'], 130, 3, 0.2);
        if (s.hp <= 1) { s.hp = 1; s.cracked = true; }
        // 头部传导 40% 伤害
        const head = this.segments[0];
        if (head && !head.dead) {
          head.hp -= dmg * 0.4;
          head.flash = 0.1;
          burst(g, head.x, head.y, 2, ['#fff', '#4ade80'], 100, 2, 0.15);
          if (head.hp <= 0) { this.killSegment(0, g); return; }
        }
        SFX.hit();
      } else {
        // 头部直接受击 / 崩解态身体节
        s.hp -= dmg;
        s.flash = 0.12; this.hurtT = 0.12;
        burst(g, s.x, s.y, 3, ['#fff', '#4ade80', '#d8d3c2'], 130, 3, 0.2);
        SFX.hit();
        if (s.hp <= 0) this.killSegment(i, g);
      }
    }
    takeDamage(dmg, g) {
      if (dmg >= 10000) {
        // 大招强光波：完全体时头部 + 所有身体节各削 30%；崩解态所有身体节各削 50%
        const ratio = this.headAlive ? 0.3 : 0.5;
        for (let i = 0; i < this.segments.length; i++) {
          const s = this.segments[i];
          if (s.dead) continue;
          s.hp -= s.maxHp * ratio; s.flash = 0.2;
          burst(g, s.x, s.y, i === 0 ? 6 : 3, this.deathCols, 140, 3, 0.25);
          if (s.hp <= 0) {
            if (this.headAlive && i !== 0) { s.hp = 1; s.cracked = true; }   // 完全体身体节锁血裂开
            else { this.killSegment(i, g); if (this.dead) return; }
          }
        }
        this.hurtT = 0.2;
        return;
      }
      const ne = this.nearestExposed(this.x, this.y);
      if (ne) this.damageSegment(ne.i, dmg, g, null, '');
    }
    /** 击毁头部 → 崩解，身体解除无敌；击毁身体节 → 脱离为独立小怪 */
    killSegment(i, g) {
      const s = this.segments[i];
      if (!s || s.dead) return;
      s.dead = true;
      burst(g, s.x, s.y, i === 0 ? 40 : 12, this.deathCols, 240, 6, 0.5, 130);
      SFX.explode(false);
      g.shake(i === 0 ? 10 : 3);
      g.score += i === 0 ? 50 : 8;
      if (i === 0) {
        // 头部碎裂
        this.headAlive = false;
        g.toast('骨龙王头部碎裂！身体节解除无敌！', 2.2, 'lt');
        // 按关卡决定直接爆炸比例：1关60% 2关40% 3关20% 3关后10%
        const round = g.round || 1;
        const explodeRatio = round <= 1 ? 0.6 : round === 2 ? 0.4 : round === 3 ? 0.2 : 0.1;
        // 收集所有存活身体节
        const alive = [];
        for (let j = 1; j < this.segments.length; j++) {
          if (!this.segments[j].dead) alive.push(j);
        }
        // 按 HP 升序排列：锁血(1hp)的优先爆炸
        alive.sort((a, b) => this.segments[a].hp - this.segments[b].hp);
        const explodeCount = Math.floor(alive.length * explodeRatio);
        // 爆炸节：标记死亡 + 入队分帧播放特效（避免一帧上千粒子卡顿）
        for (let k = 0; k < explodeCount && k < alive.length; k++) {
          const bs = this.segments[alive[k]];
          bs.dead = true;
          g.score += 5;
          this.booms.push({ x: bs.x, y: bs.y, t: 0.05 + k * 0.012 });
        }
        // 剩余存活节：每 3 节合为 1 个「骨龙组」（血量合并为 1 只强化小段），分批出场
        this.packs = [];
        for (let k = explodeCount; k < alive.length; k += 3) {
          let hp = 0;
          for (let m = k; m < Math.min(k + 3, alive.length); m++) {
            const bs = this.segments[alive[m]];
            hp += Math.max(1, bs.hp);
            bs.dead = true;   // 转化为骨龙组，从龙身链移除
          }
          this.packs.push({ hp, maxHp: hp, state: 'pending', enemy: null });
        }
        this.packWave = 0;            // 骨龙组刷出波次：1,2,3,4... 递增
        this.packSpawnCd = 1.5;       // 首批 1.5s 后涌出，杜绝卡顿
        // 碎裂瞬间立即召唤 2 条日常骨蛇小怪（GrassDragon bone 主题，击杀掉落能量）
        // bossOwned=true：Boss 召唤的龙，Boss 战/怪物潮清场不离场
        for (let m = 0; m < 2; m++) {
          g.enemies.push(new GrassDragon(g, false, null, 'bone', true));
        }
        g.shake(8);
        this.recalcHp(g);
      } else {
        // 身体节脱离：若在场小段未达上限则生成独立敌人
        const aliveMini = g.enemies.filter(e => e.type === 'bonedragonmini' && !e.dead).length;
        if (aliveMini < this.maxMini) {
          g.enemies.push(new BoneDragonMini(g, s.x, s.y));
        }
        this.recalcHp(g);
      }
    }
    recalcHp(g) {
      if (this.headAlive) {
        // 完全体：血条显示头部血量（第一条血）
        this.maxHp = this.headMaxHp;
        this.hp = Math.max(0, this.segments[0].hp);
      } else if (this.packs) {
        // 崩解态：血条 = 所有骨龙组（含未出场）血量总和
        let hp = 0, max = 0;
        for (const pk of this.packs) {
          max += pk.maxHp;
          if (pk.state === 'active' && pk.enemy) hp += Math.max(0, pk.enemy.hp);
          else if (pk.state === 'pending') hp += pk.hp;
        }
        this.maxHp = max || 1;
        this.hp = hp;
        if (hp <= 0 && !this.dead) this.die(g);
      } else {
        this.maxHp = 1; this.hp = 0;
        if (!this.dead) this.die(g);
      }
    }

    /** 崩解态：骨龙组按"击杀触发"分批涌出。
     *  第 1 波刷 1 只 → 全部击杀后等 1.5s → 第 2 波刷 2 只 → 全部击杀后等 1.5s → 第 3 波 3 只…
     *  剩余组数 < 本波计划数时一次刷出全部剩余，全灭 Boss 才死亡 */
    updatePacks(dt, g) {
      this.packSpawnCd = Math.max(0, (this.packSpawnCd || 0) - dt);
      // 同步在场骨龙组状态
      let active = 0;
      for (const pk of this.packs) {
        if (pk.state === 'active') {
          if (!pk.enemy || pk.enemy.dead) pk.state = 'dead';
          else active++;
        }
      }
      // 场上无存活骨龙组 且 冷却已到 → 刷下一波
      if (active === 0 && this.packSpawnCd <= 0) {
        const pending = this.packs.filter(p => p.state === 'pending');
        if (pending.length > 0) {
          this.packWave = (this.packWave || 0) + 1;
          const want = this.packWave;                          // 第 N 波刷 N 只
          const toSpawn = Math.min(want, pending.length);      // 剩余不足则全刷
          for (let i = 0; i < toSpawn; i++) {
            const pk = pending[i];
            // 从屏幕外（左/右/上边缘随机一侧）生成，再移入屏幕接近中线
            const edge = randi(0, 3);   // 0=左 1=右 2=上
            let sx, sy;
            if (edge === 0) { sx = -40; sy = rand(100, CFG.GROUND_Y - 80); }
            else if (edge === 1) { sx = CFG.W + 40; sy = rand(100, CFG.GROUND_Y - 80); }
            else { sx = rand(120, CFG.W - 120); sy = -40; }
            const mini = new BoneDragonMini(g, sx, sy, { hp: pk.hp, scale: 1.3, pack: true });
            // 入场目标：屏幕中线附近
            mini.entering = true;
            mini.enterTarget = { x: clamp(this.x + rand(-120, 120), 140, CFG.W - 140), y: clamp(CFG.H * 0.42 + rand(-40, 40), 120, CFG.GROUND_Y - 80) };
            g.enemies.push(mini);
            pk.enemy = mini; pk.state = 'active';
            burst(g, sx, sy, 10, this.deathCols, 180, 5, 0.4, 110);
          }
          this.packSpawnCd = 1.5;   // 本波全灭后 1.5s 再刷下一波
        }
      }
      this.recalcHp(g);
    }

    /* ---------- AI ---------- */
    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.hurtT = Math.max(0, (this.hurtT || 0) - dt);
      this.spawnInvuln = Math.max(0, this.spawnInvuln - dt);
      for (const s of this.segments) s.flash = Math.max(0, s.flash - dt);
      // 分裂爆炸队列：每帧只放 2 个，避免同帧粒子暴增卡顿
      if (this.booms.length) {
        let fired = 0;
        for (let k = this.booms.length - 1; k >= 0; k--) {
          const bm = this.booms[k];
          bm.t -= dt;
          if (bm.t <= 0) {
            burst(g, bm.x, bm.y, 6, this.deathCols, 180, 4, 0.35, 90);
            this.booms.splice(k, 1);
            if (++fired >= 2) break;
          }
        }
      }
      // 元素 DoT（作用于头部 / 最前活节）
      if (this.dotT > 0) {
        this.dotT -= dt;
        const tick = this.dotDps * dt;
        if (this.spawnInvuln <= 0 && tick > 0) {
          if (this.headAlive) this.damageSegment(0, tick, g, null, '');
          else {
            const fa = this.firstAliveBody();
            if (fa) this.damageSegment(fa, tick, g, null, '');
          }
          if (this.dead) return;
        }
      }
      if (this.freezeT > 0) { this.freezeT -= dt; this.advanceTrail(); this.updateSegments(); return; }
      const prevY = this.y;
      if (this.headAlive) this.updateMain(dt, g);
      else this.updatePacks(dt, g);
      // 钻地 / 出土跨界特效
      if ((prevY >= CFG.GROUND_Y) !== (this.y >= CFG.GROUND_Y)) {
        if (this.y >= CFG.GROUND_Y) { burst(g, this.x, CFG.GROUND_Y, 14, this.deathCols, 220, 5, 0.5, 120); g.shake(2); }
        else { burst(g, this.x, CFG.GROUND_Y, 26, this.deathCols, 300, 6, 0.7, 160); SFX.explode(false); g.shake(6); }
      }
      this.advanceTrail();
      this.updateSegments();
      // 钻地扬尘
      if (this.y >= CFG.GROUND_Y) {
        this.dustT = (this.dustT || 0) - dt;
        if (this.dustT <= 0) {
          this.dustT = 0.05;
          g.particles.push(new Particle(this.x + rand(-10, 10), CFG.GROUND_Y - 2,
            rand(-70, 70), rand(-150, -50), rand(0.3, 0.6), rand(3, 6),
            ['#46324e', '#573f5f', '#b5ae9a'][randi(0, 2)]));
        }
      }
      // 头部存活时头部血量同步到 this.hp（血条显示）
      if (this.headAlive) {
        this.hp = Math.max(0, this.segments[0].hp);
        this.maxHp = this.headMaxHp;
      }
    }
    firstAliveBody() {
      for (let i = 1; i < this.segments.length; i++) if (!this.segments[i].dead) return i;
      return -1;
    }
    /** 头部存活：简化状态机 —— 出土 → 空中追击（冲撞+绿火）→ 钻地
     *  去掉弧线转向/随机转向，始终直接朝玩家转向，避免卡住或速度异常。
     */
    updateMain(dt, g) {
      const p = g.player;
      const head = this.segments[0];
      // 受伤 30% 触发钻地（逐级 0.7→0.4→0.1）
      if ((this.state === 'air' || this.state === 'charge') && this.burrowHpThreshold > 0) {
        if (head.hp / this.headMaxHp <= this.burrowHpThreshold) {
          this.burrowHpThreshold = Math.max(0, this.burrowHpThreshold - 0.3);
          this.y = CFG.GROUND_Y + rand(16, 28); this.state = 'burrow'; this.stateT = 0;
          this.burrowT = 5;
          burst(g, this.x, CFG.GROUND_Y, 20, this.deathCols, 280, 6, 0.6, 150);
          SFX.explode(false); g.shake(5);
          return;
        }
      }
      if (this.state === 'rise') {
        this.y -= 215 * dt;
        // 钻出过程：头部平滑转正上方，避免沿用钻地前旧朝向导致扭曲
        const upA = -Math.PI / 2;
        const dUp = ((upA - this.ha + Math.PI) % TAU + TAU) % TAU - Math.PI;
        this.ha += clamp(dUp, -8 * dt, 8 * dt);
        if (this.y <= this.riseY) {
          this.y = this.riseY; this.state = 'air'; this.stateT = 0;
          this.chaseT = 4;
          // 不瞬转玩家：由 air 状态按追击转向率平滑转向
        }
      } else if (this.state === 'charge') {
        const sp = 520;
        this.x += this.hx * sp * dt; this.y += this.hy * sp * dt;
        this.chargeDur = (this.chargeDur || 0.9) - dt;
        if (this.x < this.xL) { this.x = this.xL; this.hx = Math.abs(this.hx); }
        if (this.x > this.xR) { this.x = this.xR; this.hx = -Math.abs(this.hx); }
        if (this.y < 50) { this.y = 50; this.hy = Math.abs(this.hy); }
        if (this.chargeDur <= 0) { this.state = 'air'; this.chargeT = rand(3, 5); }
      } else if (this.state === 'air') {
        // 朝玩家转向，但靠近边界时强制远离墙（避免卡死）
        let dx = p.x - this.x, dy = p.y - this.y;
        const margin = 100;
        if (this.x < this.xL + margin) dx = Math.abs(dx) + margin;       // 靠左墙→强制朝右
        if (this.x > this.xR - margin) dx = -(Math.abs(dx) + margin);    // 靠右墙→强制朝左
        if (this.y < 56 + margin) dy = Math.abs(dy) + margin;            // 靠顶→强制朝下
        const targetA = Math.atan2(dy, dx);
        const diff = ((targetA - this.ha + Math.PI) % TAU + TAU) % TAU - Math.PI;
        const turnRate = this.chaseT > 0 ? 6.0 : 3.0;
        this.ha += Math.sign(diff) * Math.min(Math.abs(diff), turnRate * dt);
        if (this.chaseT > 0) this.chaseT -= dt;
        const sp = 220;
        this.x += Math.cos(this.ha) * sp * dt;
        this.y += Math.sin(this.ha) * sp * dt;
        // 边界硬修正（防止穿透）
        if (this.x < this.xL) { this.x = this.xL; this.ha = Math.cos(this.ha) < 0 ? 0 : this.ha; }
        if (this.x > this.xR) { this.x = this.xR; this.ha = Math.cos(this.ha) > 0 ? Math.PI : this.ha; }
        if (this.y < 56) { this.y = 56; this.ha = Math.sin(this.ha) < 0 ? Math.PI / 2 : this.ha; }
        this.ha = ((this.ha + Math.PI) % TAU + TAU) % TAU - Math.PI;
        if (this.y >= CFG.GROUND_Y - 6) {
          // 触地 → 钻地
          this.y = CFG.GROUND_Y + rand(16, 28); this.state = 'burrow'; this.stateT = 0;
          this.burrowT = 5;
        } else {
          // 冲撞：朝玩家冲刺
          this.chargeT -= dt;
          if (this.chargeT <= 0 && Math.random() < 0.6) {
            const a = Math.atan2(p.y - this.y, p.x - this.x);
            this.ha = a; this.hx = Math.cos(a); this.hy = Math.sin(a);
            this.state = 'charge'; this.chargeDur = 0.9;
          }
          // 绿火连射
          this.fireT -= dt;
          if (this.fireT <= 0) {
            this.fireT = this.chaseT > 0 ? rand(0.25, 0.45) : rand(0.5, 0.9);
            const base = Math.atan2(p.y - this.y, p.x - this.x);
            const spread = this.chaseT > 0 ? 5 : 3;
            for (let i = 0; i < spread; i++) {
              const a = base + (i - (spread - 1) / 2) * 0.18;
              g.bullets.push(new Bullet(this.segments[0].x, this.segments[0].y,
                Math.cos(a) * 340, Math.sin(a) * 340,
                { kind: 'greenfire', r: 8, dmg: 14 * g.atkScale, life: 5 }));
            }
            SFX.enemyShoot();
          }
        }
      } else if (this.state === 'burrow') {
        // 地下：水平高速朝玩家 x 方向穿梭
        const sp = 700;
        const dir = p.x > this.x ? 1 : -1;
        this.x += dir * sp * dt;
        // 土层内轻微上下浮动
        this.y = CFG.GROUND_Y + 22 + Math.sin(this.t * 4) * 16;
        if (this.x < 20) this.x = 20;
        if (this.x > CFG.W - 20) this.x = CFG.W - 20;
        this.burrowT -= dt;
        if (this.burrowT <= 0) {
          this.state = 'rise';
          this.riseY = Math.min(rand(150, 260), p.y);
          this.chaseT = 4;
          burst(g, this.x, CFG.GROUND_Y, 26, this.deathCols, 300, 6, 0.7, 160);
          SFX.explode(false); g.shake(6);
        }
      }
      this.hx = Math.cos(this.ha); this.hy = Math.sin(this.ha);
    }

    /* ---------- 渲染 ---------- */
    render(ctx) {
      const t = this.t;
      const segs = this.segments;
      const th = DRAGON_THEMES.bone;
      // 土垄（钻地段）—— 头部土堆更大更醒目，突出高速感
      for (let i = segs.length - 1; i >= 0; i--) {
        const s = segs[i];
        if (s.dead || s.y < CFG.GROUND_Y - 2) continue;
        const isHead = (i === 0);
        const baseR = this.segRAt(i) * (isHead ? 1.6 : 1.15);
        const r = baseR + Math.sin(t * 12 + i) * (isHead ? 3 : 1.5);
        ctx.fillStyle = isHead ? '#7a4f8a' : '#5a3f63';
        ctx.beginPath(); ctx.arc(s.x, CFG.GROUND_Y + 3, r, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = isHead ? '#9a6faa' : '#6e4f7a';
        ctx.beginPath(); ctx.arc(s.x, CFG.GROUND_Y + 3, r * 0.78, Math.PI, TAU); ctx.fill();
        if (isHead) {
          // 头部扬尘尾迹，强化速度感
          const dir = this.hx >= 0 ? -1 : 1;
          ctx.fillStyle = 'rgba(140,100,160,0.35)';
          for (let k = 1; k <= 4; k++) {
            ctx.beginPath();
            ctx.arc(s.x + dir * k * 12, CFG.GROUND_Y + 3 + Math.sin(t*10+k)*2, r * (1 - k*0.18), Math.PI, TAU);
            ctx.fill();
          }
        }
      }
      // 连接脊线：骨蛇节间断开（noSpine=true），不画
      // 龙身节（尾→头）
      for (let i = segs.length - 1; i >= 1; i--) {
        const s = segs[i];
        if (s.dead || s.y >= CFG.GROUND_Y) continue;
        th.seg(ctx, this, s, i, t, th);
      }
      // 龙头（仅头部存活时绘制）—— 使用骨龙王专属巨龙头
      const head = segs[0];
      if (!head.dead && head.y < CFG.GROUND_Y) {
        ctx.save();
        ctx.translate(head.x, head.y);
        ctx.rotate(Math.atan2(this.hy, this.hx));
        (th.headKing || th.head)(ctx, this, head, t, th);
        ctx.restore();
      }
      // 持续受伤红染
      if (this.hurtT > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(255,40,40,${clamp(this.hurtT / 0.12, 0, 1) * 0.3})`;
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          if (s.dead || s.y >= CFG.GROUND_Y) continue;
          const rr = i === 0 ? this.headR : this.segRAt(i);
          ctx.beginPath(); ctx.arc(s.x, s.y, rr * 1.2, 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  /* ================ 癫狂鬣狗（草原限定） ================
   * 怒吼 3 道环形声波 ↔ 瞄准冲刺，持续循环；每损 30% 血钻入地面 4s，
   * 出土后锁定玩家进行一次瞄准冲刺。美术：caoyuan-1.png（368×208，已朝左） */
  class MadHyena extends Boss {
    constructor(g) {
      super(g, 24, 60);
      this.bossName = '癫狂鬣狗';
      this.title = '草原猎手';
      this.x = CFG.W + 130;
      this.y = CFG.GROUND_Y - 60;
      this.baseY = this.y;
      this.loop = 'roar';        // roar ↔ dash 持续循环
      this.sub = '';             // 冲刺子状态 wind / air / rest
      this.subT = 0;
      this.roarFired = 0;        // 本次怒吼已发出的声波道数
      this.rings = [];           // 声波 {x,y,r,vr,life,t,dealt,dmg}
      this.aim = null;           // 冲刺锁定点
      this.nextBurrowAt = this.maxHp * 0.7;   // 下次钻地血线：70% → 40% → 10%
      this.burrowPhase = '';     // '' / sink / under / emerge
      this.burrowT = 0;
      this.face = -1;            // -1 朝左（默认贴图）/ 1 朝右（水平翻转）
      this.contactBase = 24;
      this.tilt = 0;             // 当前身体旋转角（撞击前微调，让正面垂直于玩家连线）
      this.targetTilt = 0;       // 目标旋转角
      this.dashWarn = false;     // 冲刺路径预警标记
      this.dashCount = 0;        // 本轮已撞击次数（达 4~6 次后回怒吼发声波）
      this.dashTarget = 5;       // 本轮撞击目标次数（roar 时随机 4~6）
      this.deathCols = ['#8a6a3a', '#c9a05a', '#5a4426', '#fff'];
      this.xpValue = 240;
    }

    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;
      this._px = p.x; this._py = p.y;   // 缓存玩家位置供 render 画预警线

      if (this.state === 'enter') {
        this.x -= 200 * dt;
        this.y = CFG.GROUND_Y - 60 + Math.abs(Math.sin(this.t * 9)) * -6;
        this.face = -1;
        if (this.x <= CFG.W - 250) { this.state = 'fight'; this.stateT = 0; this.subT = 0; }
        return;
      }

      // 钻地突袭：期间免伤、无接触伤害、无碰撞体积（radius=0）
      if (this.burrowPhase) { this.updateBurrow(dt, g); this.updateRings(dt, g); return; }
      if (this.state !== 'fight') return;

      if (this.loop === 'roar') this.updateRoar(dt, g);
      else this.updateDash(dt, g);
      this.updateRings(dt, g);

      // 地面巡逻：仅怒吼阶段缓慢逼近玩家；冲刺全阶段（wind/air/rest/fall）保持位置不被拉回
      if (this.loop === 'roar') {
        const dx = p.x - this.x;
        if (Math.abs(dx) > 130) {
          this.x += Math.sign(dx) * 58 * dt;
          this.face = dx > 0 ? 1 : -1;
        }
        this.x = clamp(this.x, CFG.W * 0.4, CFG.W - 80);
        this.y = CFG.GROUND_Y - 60 + Math.abs(Math.sin(this.t * 8)) * -6;
      }
      // 撞毁山石
      g.rocks.forEach(r => { if (!r.dead && r.contains(this.x, this.y, this.radius)) r.destroy(g); });
    }

    /* —— 怒吼：发 2 道声波（配狗叫），结束后进入撞击循环（撞击 4~6 次才回怒吼）—— */
    updateRoar(dt, g) {
      this.subT += dt;
      // 进入怒吼时重置撞击计数并随机下一轮撞击目标次数（4~6）
      if (this.roarFired === 0 && this.subT <= dt + 0.001) {
        this.dashCount = 0;
        this.dashTarget = 4 + Math.floor(Math.random() * 3);   // 4, 5, 6
      }
      if (this.subT > 0.4 + this.roarFired * 0.35 && this.roarFired < 2) {
        this.roarFired++;
        this.fireRing(g);
        SFX.bark();            // 声波时狗叫一声
        if (this.roarFired === 1) g.shake(4);
      }
      if (this.subT > 1.1) {
        this.loop = 'dash'; this.sub = 'wind'; this.subT = 0;
        this.aim = null;
        SFX.bossCharge();
        g.toast('癫狂鬣狗压低了身子！', 1.2, 'lt');
      }
    }

    /* —— 冲刺：wind 1.5s 狗叫+路径预警+角度微调（最后 0.15s 锁定撞击点）→ air 朝锁定点冲（不追踪）→ 低概率下落 → 怒吼 —— */
    updateDash(dt, g) {
      const p = g.player;
      this.subT += dt;
      if (this.sub === 'wind') {
        // 撞击前转向面向玩家
        this.face = p.x > this.x ? 1 : -1;
        // 狗叫 + 路径预警（进入 wind 时触发一次）
        if (this.subT <= dt + 0.001) {
          SFX.bark();
          this.dashWarn = true;
          this.aim = null;
        }
        // 头部面对玩家：贴图头部默认朝左(180°)，face=1 翻转后朝右(0°)
        // face=1 时 tilt=a 即头朝玩家；face=-1 时 tilt=a-π 即头朝玩家
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.targetTilt = this.face === -1 ? a - Math.PI : a;
        this.tilt += (this.targetTilt - this.tilt) * Math.min(1, dt * 14);
        // 最后 0.15s 锁定撞击点（玩家当前位置），之后不再更新——玩家可躲开
        if (this.subT > 1.35 && !this.aim) {
          this.aim = { x: p.x, y: p.y };
        }
        if (this.subT > 1.5) {
          if (!this.aim) this.aim = { x: p.x, y: p.y };
          this.sub = 'air'; this.subT = 0;
          this.contactDmg = 30;   // 冲刺撞击高额伤害（接触伤害由 Player.update 统一结算）
          this.dashWarn = false;
          SFX.dash(); g.shake(5);
        }
      } else if (this.sub === 'air') {
        // 朝 wind 阶段锁定的撞击点冲刺（不持续追踪玩家，玩家可横向躲开）
        this.face = this.aim.x > this.x ? 1 : -1;
        // 夸张拖尾：大量尘土粒子
        for (let i = 0; i < 5; i++) {
          g.particles.push(new Particle(this.x + rand(-26, 26), this.y + rand(-16, 20),
            rand(-120, 120), rand(-60, 30), 0.35, rand(4, 10), i % 2 ? '#b09468' : '#8a6a3a'));
        }
        // 变速：ease-in 加速，lerp 系数从 3（慢）平方增长到 25（快），整体再次降速，前半段明显更慢
        const prog = clamp(this.subT / 0.5, 0, 1);
        const lerpK = 3 + prog * prog * 22;
        const k = Math.min(1, dt * lerpK);
        this.x += (this.aim.x - this.x) * k;
        this.y += (this.aim.y - this.y) * k;
        // 到达锁定撞击点即判定命中（玩家不在该点则扑空）
        if (Math.hypot(this.aim.x - this.x, this.aim.y - this.y) < 14 || this.subT > 0.55) {
          this.onDashHit(g);
          return;
        }
      } else if (this.sub === 'fall') {
        // 撞到点后下落：视觉表现鬣狗冲撞力竭下坠
        this.y += 540 * dt;
        if (this.subT > 0.45) {
          this.loop = 'roar'; this.sub = ''; this.subT = 0; this.roarFired = 0;
          this.y = CFG.GROUND_Y - 60;
          this.contactDmg = this.contactBase;
        }
      } else if (this.sub === 'rest') {
        // 撞击后停留在撞击位置，短暂停顿：达目标次数回怒吼发声波，否则继续瞄准玩家撞击
        if (this.subT > 0.35) {
          this.contactDmg = this.contactBase;
          if (this.dashCount >= this.dashTarget) {
            this.loop = 'roar'; this.sub = ''; this.subT = 0; this.roarFired = 0;
          } else {
            this.sub = 'wind'; this.subT = 0;
          }
        }
      }
      // 非 air/wind 阶段：tilt 逐步回正到小幅摆动
      if (this.sub !== 'air' && this.sub !== 'wind') {
        this.tilt += (Math.sin(this.t * 3) * 0.04 - this.tilt) * Math.min(1, dt * 6);
      }
    }
    /** 冲刺命中：夸张爆炸特效 + 强震屏 + 计数 + 10% 概率落地，90% 停在撞击点 */
    onDashHit(g) {
      this.dashCount++;   // 累计撞击次数
      // 夸张爆炸：大量粒子 + 双层冲击波环 + 强震屏
      burst(g, this.x, this.y, 32, ['#ffd23b', '#fff', '#b09468', '#8a6a3a', '#ff6a1e'], 380, 9, 0.55);
      g.fxRings.push({ x: this.x, y: this.y, r: 10, vr: 680, t: 0, life: 0.5, col: '#ffd23b' });
      g.fxRings.push({ x: this.x, y: this.y, r: 6, vr: 920, t: 0, life: 0.35, col: '#fff' });
      g.shake(11); SFX.shock();
      this.contactDmg = this.contactBase;
      // 10% 概率落地（落地后回怒吼），90% 短暂停顿后继续瞄准玩家撞击
      if (Math.random() < 0.1) {
        this.sub = 'fall'; this.subT = 0;
      } else {
        this.sub = 'rest'; this.subT = 0;
      }
    }

    /* —— 钻地突袭：下沉 0.45s → 地下潜行 3s → 出土后直接瞬移到玩家位置撞击 —— */
    startBurrow(g) {
      this.burrowPhase = 'sink'; this.burrowT = 0;
      this.contactDmg = 0; this.radius = 0;
      this.rings.length = 0;
      g.toast('癫狂鬣狗钻入了地面！', 1.6, 'lt');
      SFX.shock(); g.shake(4);
      burst(g, this.x, CFG.GROUND_Y - 10, 12, ['#8a6a3a', '#b09468', '#5a4426'], 180, 5, 0.5);
    }
    updateBurrow(dt, g) {
      const p = g.player;
      this.burrowT += dt;
      if (this.burrowPhase === 'sink') {
        this.y += 130 * dt;
        this.face = p.x > this.x ? 1 : -1;
        if (this.burrowT > 0.45) { this.burrowPhase = 'under'; this.burrowT = 0; }
      } else if (this.burrowPhase === 'under') {
        // 地下潜行：朝玩家 x 缓慢移动，地面留尘土
        const dx = p.x - this.x;
        if (Math.abs(dx) > 24) this.x += Math.sign(dx) * 140 * dt;
        this.x = clamp(this.x, 60, CFG.W - 60);
        this.y = CFG.GROUND_Y + 14;
        if (Math.random() < 0.4) {
          g.particles.push(new Particle(this.x + rand(-20, 20), CFG.GROUND_Y - 4,
            rand(-40, 40), rand(-90, -30), 0.4, rand(3, 6), '#8a6a3a'));
        }
        if (this.burrowT > 3.0) {
          this.burrowPhase = 'emerge'; this.burrowT = 0;
          this.radius = 60; this.contactDmg = this.contactBase;
          this.y = CFG.GROUND_Y - 50;
          burst(g, this.x, CFG.GROUND_Y - 20, 20, ['#8a6a3a', '#b09468', '#ffd23b', '#fff'], 260, 6, 0.55);
          SFX.shock(); g.shake(8);
        }
      } else if (this.burrowPhase === 'emerge') {
        this.y += (CFG.GROUND_Y - 60 - this.y) * Math.min(1, dt * 8);
        if (this.burrowT > 0.4) {
          this.burrowPhase = '';
          // 地下突袭：不用转向，直接移到玩家位置撞击
          const p2 = g.player;
          this.contactDmg = 30;
          this.x = p2.x; this.y = p2.y;
          // 夸张拖尾：大量尘土粒子从地下冲起
          for (let i = 0; i < 26; i++) {
            g.particles.push(new Particle(this.x + rand(-55, 55), this.y + rand(-45, 45),
              rand(-200, 200), rand(-160, 70), 0.6, rand(4, 11), i % 2 ? '#8a6a3a' : '#b09468'));
          }
          g.fxRings.push({ x: this.x, y: CFG.GROUND_Y - 10, r: 16, vr: 700, t: 0, life: 0.5, col: '#8a6a3a' });
          g.shake(9); SFX.shock();
          this.onDashHit(g);
        }
      }
    }

    fireRing(g) {
      this.rings.push({
        x: this.x + 62 * this.face, y: this.y - 16,
        r: 26, vr: 330, t: 0, dealt: false,
        maxR: 230,   // 飞行到此半径后衰减消失
        dmg: Math.round(12 * g.atkScale)
      });
      SFX.shock();
    }
    updateRings(dt, g) {
      const p = g.player;
      for (const r of this.rings) {
        r.t += dt; r.r += r.vr * dt;
        if (!r.dealt && Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - r.r) < 26 + p.radius * 0.7) {
          r.dealt = true; p.hurt(r.dmg, g, this.dsrc);
        }
      }
      // 飞行距离达到 maxR 即衰减消失
      this.rings = this.rings.filter(r => r.r < r.maxR);
    }

    takeDamage(dmg, g) {
      if (this.dead || this.state === 'enter' || this.burrowPhase) return;   // 入场/钻地免伤
      this.hp -= dmg;
      this.hitFlash();
      if (Math.random() < 0.3) burst(g, this.x - 14, this.y, 2, ['#ff3b3b', '#ff7b2e'], 130, 3, 0.18);
      if (!this.enraged && this.hp > 0 && this.hp <= this.maxHp * 0.3) {
        this.enraged = true;
        SFX.bossEnrage(); g.shake(10);
        g.toast(`${this.bossName} 狂暴了！`, 1.8, 'lt');
        burst(g, this.x, this.y, 24, ['#ff3b3b', '#ffd23b', '#fff'], 280, 6, 0.6, 130);
      }
      // 每损 30% 血：钻入地面（一次大额伤害跨多条血线只触发一次，剩余血线顺延）
      if (this.hp > 0 && this.hp <= this.nextBurrowAt) {
        while (this.nextBurrowAt > 0 && this.hp <= this.nextBurrowAt) this.nextBurrowAt -= this.maxHp * 0.3;
        this.startBurrow(g);
      }
      if (this.hp <= 0) { this.hp = 0; this.die(g); }
    }

    render(ctx) {
      // 声波：双层虚线圆环，随扩散距离衰减
      for (const r of this.rings) {
        const a = 1 - r.r / r.maxR;
        ctx.save();
        ctx.strokeStyle = `rgba(255,214,130,${0.6 * a})`;
        ctx.lineWidth = 5;
        ctx.setLineDash([16, 11]);
        ctx.lineDashOffset = -r.t * 90;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * a})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, r.r - 9), 0, TAU); ctx.stroke();
        ctx.restore();
      }
      // 钻地期间只画地面尘土堆
      if (this.burrowPhase === 'sink' || this.burrowPhase === 'under') {
        ctx.fillStyle = 'rgba(138,106,58,0.75)';
        ctx.beginPath(); ctx.ellipse(this.x, CFG.GROUND_Y - 4, 52, 14, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(90,68,38,0.6)';
        ctx.beginPath(); ctx.ellipse(this.x, CFG.GROUND_Y - 2, 30, 8, 0, Math.PI, TAU); ctx.fill();
        return;
      }
      const bob = Math.abs(Math.sin(this.t * 8)) * -5;
      // 冲刺路径预警：wind 阶段画一条从鬣狗到玩家的红色虚线，末端圆圈标记撞击点
      if (this.dashWarn && this._px !== undefined) {
        const px = this._px, py = this._py;
        ctx.save();
        ctx.strokeStyle = `rgba(255,60,40,${0.4 + 0.3 * Math.sin(this.t * 12)})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -this.t * 60;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(px, py); ctx.stroke();
        // 撞击点标记圈
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(255,80,60,${0.5 + 0.3 * Math.sin(this.t * 10)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 24 + Math.sin(this.t * 8) * 4, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      // caoyuan-1.png 368×208 缩放 0.62 → 约 228×129；图像中鬣狗躯干偏左，
      // 按朝向平移让碰撞中心对准身体；朝右冲刺时水平翻转
      const dx = this.face === -1 ? 28 : -28;
      const sx = this.face === -1 ? 0.62 : -0.62;
      // 使用 this.tilt（撞击前微调角度，让正面垂直于玩家连线）
      drawBossSprite(ctx, Sprites.hyena, this.x + dx, this.y + bob, sx, 0.62, this.tilt, this.flash);
      // 怒吼蓄势红光
      if (this.loop === 'roar' && this.subT > 0.2 && this.roarFired < 3) {
        const mx = this.x + 62 * this.face, my = this.y - 16;
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 34);
        glow.addColorStop(0, 'rgba(255,120,60,0.55)');
        glow.addColorStop(1, 'rgba(255,60,30,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(mx, my, 34, 0, TAU); ctx.fill();
      }
    }
  }

  /* ================ 浣熊漫游者（霓虹喵都限定） ================
   * 不停快速移动：围绕玩家 → 瞄准突进 → 走边框，各 5s 循环；
   * 移动处留下玫红能量印记（4s 消散），玩家接触触发小范围爆炸。美术：saibo-1.png（500×300，已朝左） */
  class RaccoonRover extends Boss {
    constructor(g) {
      super(g, 20, 52);
      this.bossName = '浣熊漫游者';
      this.title = '霓虹浪客';
      this.x = CFG.W + 130;
      this.y = 150;
      this.route = 'orbit';      // orbit → aim → border 循环，各 5s
      this.routeT = 0;
      this.orbitAng = 0;
      this.aimSub = 'wind';      // 瞄准路线子状态 wind / dash / brake
      this.aimT = 0;
      this.aimV = null;          // 突进速度向量
      this.borderIdx = 0;
      this.marks = [];           // 玫红印记 {x,y,r,life,max,hit}
      this.markT = 0;
      this.face = -1;
      this.deathCols = ['#ff2ec8', '#b46bff', '#45e6ff', '#fff'];
      this.xpValue = 240;
    }

    /** 边框路点：贴着屏幕边框的八点环路 */
    borderPts() {
      return [[CFG.W - 110, 110], [CFG.W / 2, 80], [110, 110], [80, CFG.H / 2],
        [110, CFG.GROUND_Y - 100], [CFG.W / 2, CFG.GROUND_Y - 70],
        [CFG.W - 110, CFG.GROUND_Y - 100], [CFG.W - 80, CFG.H / 2]];
    }

    update(dt, g) {
      this.t += dt; this.stateT += dt; this.routeT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x += (CFG.W - 250 - this.x) * Math.min(1, dt * 2.4);
        this.y += (150 - this.y) * Math.min(1, dt * 2.4);
        this.face = -1;
        if (Math.abs(this.x - (CFG.W - 250)) < 14) { this.state = 'fight'; this.stateT = 0; }
        this.dropMark(dt, g);
        return;
      }
      if (this.state !== 'fight') return;

      if (this.route === 'orbit') this.updateOrbit(dt, g);
      else if (this.route === 'aim') this.updateAim(dt, g);
      else this.updateBorder(dt, g);

      // 路线切换：各 5s，orbit → aim → border 循环
      if (this.routeT > 5) {
        this.routeT = 0;
        this.route = this.route === 'orbit' ? 'aim' : this.route === 'aim' ? 'border' : 'orbit';
        this.aimSub = 'wind'; this.aimT = 0; this.aimV = null;
        if (this.route === 'orbit') this.orbitAng = Math.atan2(this.y - p.y, this.x - p.x);
        if (this.route === 'border') this.nearestBorderPt();
        g.toast('浣熊漫游者改变了路线！', 1.2, 'lt');
      }

      this.x = clamp(this.x, 46, CFG.W - 46);
      this.y = clamp(this.y, 60, CFG.GROUND_Y - 60);
      this.dropMark(dt, g);
      this.updateMarks(dt, g);
    }

    updateOrbit(dt, g) {
      const p = g.player;
      this.orbitAng += 2.6 * dt;
      const tx = p.x + Math.cos(this.orbitAng) * 195;
      const ty = clamp(p.y + Math.sin(this.orbitAng) * 195, 80, CFG.GROUND_Y - 80);
      const px = this.x;
      this.x += (tx - this.x) * Math.min(1, dt * 10);
      this.y += (ty - this.y) * Math.min(1, dt * 10);
      if (Math.abs(this.x - px) > 0.5) this.face = this.x > px ? 1 : -1;
    }

    updateAim(dt, g) {
      const p = g.player;
      this.aimT += dt;
      if (this.aimSub === 'wind') {
        // 原地高频抖动蓄力
        this.x += Math.sin(this.t * 42) * 26 * dt;
        this.y += Math.cos(this.t * 38) * 20 * dt;
        this.face = p.x > this.x ? 1 : -1;
        if (this.aimT > 0.5) {
          this.aimSub = 'dash'; this.aimT = 0;
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          this.aimV = { x: Math.cos(a) * 560, y: Math.sin(a) * 560 };
          this.face = this.aimV.x >= 0 ? 1 : -1;
          SFX.dash();
        }
      } else if (this.aimSub === 'dash') {
        this.x += this.aimV.x * dt; this.y += this.aimV.y * dt;
        g.particles.push(new Particle(this.x + rand(-16, 16), this.y + rand(-10, 22),
          rand(-40, 40), rand(-20, 30), 0.3, rand(2, 5), '#ff2ec8'));
        if (this.aimT > 0.55) { this.aimSub = 'brake'; this.aimT = 0; }
      } else {
        this.x += this.aimV.x * dt * (1 - this.aimT / 0.45) * 0.4;
        this.y += this.aimV.y * dt * (1 - this.aimT / 0.45) * 0.4;
        if (this.aimT > 0.45) { this.aimSub = 'wind'; this.aimT = 0; }
      }
    }

    updateBorder(dt, g) {
      const pts = this.borderPts();
      const wp = pts[this.borderIdx];
      const dx = wp[0] - this.x, dy = wp[1] - this.y, d = Math.hypot(dx, dy) || 1;
      const st = 430 * dt;
      if (Math.abs(dx) > 2) this.face = dx > 0 ? 1 : -1;
      if (d < st + 12) this.borderIdx = (this.borderIdx + 1) % pts.length;
      else { this.x += dx / d * Math.min(st, d); this.y += dy / d * Math.min(st, d); }
    }
    nearestBorderPt() {
      const pts = this.borderPts();
      let best = 0, bestD = Infinity;
      pts.forEach((wp, i) => {
        const d = (wp[0] - this.x) ** 2 + (wp[1] - this.y) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      });
      this.borderIdx = best;
    }

    /* —— 玫红印记：移动沿途撒落，4s 消散；玩家接触即小范围爆炸 —— */
    dropMark(dt, g) {
      this.markT -= dt;
      if (this.markT > 0) return;
      this.markT = 0.11;
      this.marks.push({ x: this.x, y: this.y + 42, r: 21, life: 4, max: 4, hit: false });
      if (this.marks.length > 48) this.marks.shift();
    }
    updateMarks(dt, g) {
      const p = g.player;
      for (const m of this.marks) {
        m.life -= dt;
        if (!m.hit && m.life > 0 &&
            Math.hypot(p.x - m.x, p.y - m.y) < m.r + p.radius * 0.65) {
          m.hit = true; m.life = 0;
          // 小范围爆炸
          p.hurt(Math.round(13 * g.atkScale), g, this.dsrc);
          burst(g, m.x, m.y, 16, ['#ff2ec8', '#b46bff', '#fff', '#45e6ff'], 220, 5, 0.45);
          g.fxRings.push({ x: m.x, y: m.y, r: 10, vr: 640, t: 0, life: 0.45, col: '#ff2ec8' });
          SFX.explode(false); g.shake(5);
        }
      }
      this.marks = this.marks.filter(m => m.life > 0);
    }

    render(ctx) {
      // 玫红印记：将沿途落点连成一条粗笔画线（像喷漆涂鸦），带发光，越靠近头部越淡
      const baseA = ctx.globalAlpha;
      const ms = this.marks;
      if (ms.length > 1) {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // 外层发光晕
        ctx.shadowColor = '#ff2ec8';
        ctx.shadowBlur = 16;
        ctx.strokeStyle = 'rgba(255,46,200,0.32)';
        ctx.lineWidth = 30;
        ctx.beginPath();
        ctx.moveTo(ms[0].x, ms[0].y);
        for (let i = 1; i < ms.length; i++) ctx.lineTo(ms[i].x, ms[i].y);
        ctx.stroke();
        // 中层玫红主体
        ctx.shadowBlur = 8;
        ctx.strokeStyle = 'rgba(255,46,200,0.78)';
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.moveTo(ms[0].x, ms[0].y);
        for (let i = 1; i < ms.length; i++) ctx.lineTo(ms[i].x, ms[i].y);
        ctx.stroke();
        // 内层亮粉高光：逐段按生命衰减（最老的点最淡，形成笔画起笔消散效果）
        ctx.shadowBlur = 0;
        for (let i = 1; i < ms.length; i++) {
          const a = ms[i].life / ms[i].max;
          ctx.strokeStyle = `rgba(255,180,235,${0.85 * a})`;
          ctx.lineWidth = 9 * (0.5 + 0.5 * a);
          ctx.beginPath();
          ctx.moveTo(ms[i - 1].x, ms[i - 1].y);
          ctx.lineTo(ms[i].x, ms[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }
      const bob = Math.sin(this.t * 3.2) * 7;
      // saibo-1.png 500×300 缩放 0.46 → 约 230×138；朝右时水平翻转
      const sx = this.face === -1 ? 0.46 : -0.46;
      const tilt = this.route === 'aim' && this.aimSub === 'dash' ? 0.1 * this.face : Math.sin(this.t * 2) * 0.05;
      drawBossSprite(ctx, Sprites.rover, this.x, this.y + bob, sx, 0.46, tilt, this.flash);
      // 瞄准蓄力红眼光晕
      if (this.route === 'aim' && this.aimSub === 'wind') {
        const ex = this.x + 40 * this.face, ey = this.y - 26 + bob;
        const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 26);
        glow.addColorStop(0, 'rgba(255,46,90,0.65)');
        glow.addColorStop(1, 'rgba(255,46,90,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(ex, ey, 26, 0, TAU); ctx.fill();
      }
    }
  }

  /* ================ 沙之行者（沙漠限定） ================
   * 双阶段弹幕循环：①上中下循环移动 ②S 路线走边框；血量 50%-100% 时①比重更长，
   * 0-50% 时②比重更长；每损 10% 血召唤 1 只双头蛇。美术：shamo-1.png（368×208，已朝左） */
  class SandWalker extends Boss {
    constructor(g) {
      super(g, 22, 58);
      this.bossName = '沙之行者';
      this.title = '荒漠术士';
      this.x = CFG.W + 130;
      this.y = 150;
      this.phase = 1;            // 1 上中下循环 / 2 S 路线边框
      this.phaseT = 0;
      this.pDur = 6;             // 当前阶段时长（按血量比重动态计算）
      this.lane = 1;             // 0 上 / 1 中 / 2 下
      this.laneT = 0;
      this.fireT = 1.2;
      this.bpIdx = 0;
      this.nextSummonAt = this.maxHp * 0.9;   // 每损 10% 血召唤 1 只双头蛇
      this.face = -1;
      this.deathCols = ['#d8a86a', '#8a5a2e', '#a86bd8', '#fff'];
      this.xpValue = 260;
    }

    laneY(i) { return [110, CFG.H / 2 - 10, CFG.GROUND_Y - 115][i]; }
    borderPts() {
      return [[CFG.W - 120, 120], [CFG.W / 2, 190], [120, 120], [190, CFG.H / 2],
        [120, CFG.GROUND_Y - 110], [CFG.W / 2, CFG.GROUND_Y - 150],
        [CFG.W - 120, CFG.GROUND_Y - 110], [CFG.W - 190, CFG.H / 2]];
    }

    update(dt, g) {
      this.t += dt; this.stateT += dt; this.phaseT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;

      if (this.state === 'enter') {
        this.x += (CFG.W - 240 - this.x) * Math.min(1, dt * 2.2);
        this.y += (265 - this.y) * Math.min(1, dt * 2.2);
        this.face = -1;
        if (Math.abs(this.x - (CFG.W - 240)) < 14) {
          this.state = 'fight'; this.stateT = 0;
          this.pDur = this.phaseDur();
        }
        return;
      }
      if (this.state !== 'fight') return;

      if (this.phase === 1) this.updateLanes(dt, g);
      else this.updateSRoute(dt, g);

      // 阶段切换：血量 50%-100% 时阶段①比重更长，0-50% 时阶段②更长
      if (this.phaseT > this.pDur) {
        this.phase = this.phase === 1 ? 2 : 1;
        this.phaseT = 0; this.pDur = this.phaseDur();
        this.laneT = 0;
        if (this.phase === 2) this.nearestBorderPt();
        burst(g, this.x, this.y, 14, ['#d8a86a', '#f5e3b8', '#a86bd8'], 200, 5, 0.45);
        g.toast('沙之行者变换了走位！', 1.3, 'lt');
        SFX.enemyShoot();
      }

      // 弹幕：大而清晰的沙之刺，指向玩家
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = this.phase === 1 ? 1.05 : 0.95;
        this.fireSpikes(g, p);
      }

      this.x = clamp(this.x, 60, CFG.W - 60);
      this.y = clamp(this.y, 70, CFG.GROUND_Y - 70);
      // 沙尘拖尾
      if (Math.random() < 0.35) {
        g.particles.push(new Particle(this.x + rand(-30, 30), this.y + rand(-16, 30),
          rand(-30, 10), rand(-14, 26), 0.45, rand(2, 5), '#d8b078'));
      }
    }

    /** 阶段时长：4s 基础 + 4s 按血量比重线性倾斜（满血 8/4，残血 4/8） */
    phaseDur() {
      const ratio = clamp(this.hp / this.maxHp, 0, 1);
      return this.phase === 1 ? 4 + 4 * ratio : 4 + 4 * (1 - ratio);
    }

    /* —— 阶段①：上中下三条航道循环移动 —— */
    updateLanes(dt, g) {
      this.laneT += dt;
      if (this.laneT > 1.5) { this.laneT = 0; this.lane = (this.lane + 1) % 3; }
      const ty = this.laneY(this.lane);
      const px = this.x;
      this.x = 700 + Math.sin(this.t * 1.1) * 130;
      this.y += (ty - this.y) * Math.min(1, dt * 3.2);
      if (Math.abs(this.x - px) > 0.5) this.face = this.x > px ? 1 : -1;
    }

    /* —— 阶段②：S 路线贴边框巡游 —— */
    updateSRoute(dt, g) {
      const pts = this.borderPts();
      const wp = pts[this.bpIdx];
      const dx = wp[0] - this.x, dy = wp[1] - this.y, d = Math.hypot(dx, dy) || 1;
      const st = 300 * dt;
      if (Math.abs(dx) > 2) this.face = dx > 0 ? 1 : -1;
      if (d < st + 12) this.bpIdx = (this.bpIdx + 1) % pts.length;
      else { this.x += dx / d * Math.min(st, d); this.y += dy / d * Math.min(st, d); }
    }
    nearestBorderPt() {
      const pts = this.borderPts();
      let best = 0, bestD = Infinity;
      pts.forEach((wp, i) => {
        const d = (wp[0] - this.x) ** 2 + (wp[1] - this.y) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      });
      this.bpIdx = best;
    }

    /** 沙之刺扇形齐射：阶段① 4 发 / 阶段② 3 发（不密但持续覆盖全屏） */
    fireSpikes(g, p) {
      const n = this.phase === 1 ? 4 : 3;
      const spread = this.phase === 1 ? 0.5 : 0.75;
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = 0; i < n; i++) {
        const tt = n === 1 ? 0.5 : i / (n - 1);
        const a = base + (tt - 0.5) * spread;
        const sp = this.phase === 1 ? 255 : 245;
        g.bullets.push(new Bullet(this.x - 30, this.y - 6,
          Math.cos(a) * sp, Math.sin(a) * sp,
          { kind: 'sandSpike', r: 13, dmg: Math.round(12 * g.atkScale), life: 6 }));
      }
      SFX.enemyShoot();
    }

    takeDamage(dmg, g) {
      super.takeDamage(dmg, g);
      if (this.dead || this.hp <= 0) return;
      // 每损 10% 血判定一次，20% 概率召唤双头蛇（大额伤害跨多条血线逐条补齐；场上软上限 4 只）
      while (this.nextSummonAt > 0 && this.hp <= this.nextSummonAt) {
        this.nextSummonAt -= this.maxHp * 0.1;
        if (Math.random() < 0.2) this.summonSnake(g);
      }
    }
    summonSnake(g) {
      if (g.enemies.filter(e => e.type === 'twinsnake' && !e.dead).length >= 4) return;
      g.enemies.push(new Enemy('twinsnake', g));
      burst(g, this.x, this.y, 14, ['#d8a86a', '#8a5a2e', '#f5e3b8'], 200, 5, 0.4);
      g.toast('沙之行者召唤了双头飞蛇！', 1.4, 'lt');
      SFX.enemyShoot();
    }

    render(ctx) {
      const bob = Math.sin(this.t * 2.6) * 9;
      // shamo-1.png 368×208 缩放 0.72 → 约 265×150；蛇尾拖影在身后，无需翻转平移
      const sx = this.face === -1 ? 0.72 : -0.72;
      drawBossSprite(ctx, Sprites.sandWalker, this.x, this.y + bob, sx, 0.72, Math.sin(this.t * 1.8) * 0.06, this.flash);
      // 掌中紫焰魔珠光晕（对应立绘中的紫色魔珠）
      const ox = this.x - 66 * (this.face === -1 ? 1 : -1), oy = this.y - 28 + bob;
      const pul = 1 + Math.sin(this.t * 5) * 0.16;
      const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, 24 * pul);
      glow.addColorStop(0, 'rgba(170,80,255,0.6)');
      glow.addColorStop(1, 'rgba(170,80,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(ox, oy, 24 * pul, 0, TAU); ctx.fill();
    }
  }

  /* ================ 乔治船长（大海限定） ================
   * 常驻屏幕右上/右侧区域小幅上下移动；固定循环 炮击 → 俯冲：
   *  炮击：停下瞄准 → 3 发大型慢速橙红炮弹（橙黄长拖尾、威力不俗）；
   *  俯冲：短暂停顿瞄准 → 沿随机弧线快速斜向俯冲，冲过玩家后离场、右上方重新出现。
   * 低血量（狂暴）：俯冲加速，炮击增至 5 发。美术：haishang-1.png（500×300，已朝左） */
  class CaptainGeorge extends Boss {
    constructor(g) {
      super(g, 24, 50);
      this.bossName = '乔治船长';
      this.title = '深海劫掠者';
      this.x = CFG.W + 140;
      this.y = 150;
      this.homeX = CFG.W - 150;
      this.homeY = 146;
      this.act = 'cannon';      // cannon ↔ dive 固定循环（首招炮击）
      this.sub = '';
      this.subT = 0;
      this.dive = null;         // 俯冲贝塞尔 {P0,P1,P2,u,rate}
      this.aimX = 0; this.aimY = 0;
      this.face = -1;
      this.tilt = 0;
      this.contactBase = 24;
      this.bubT = 0;
      this.deathCols = ['#2b6ea8', '#45c8ff', '#ff9d2e', '#fff'];
      this.xpValue = 250;
    }

    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;
      this._px = p.x; this._py = p.y;

      if (this.state === 'enter') {
        this.x += (this.homeX - this.x) * Math.min(1, dt * 2.2);
        this.y += (this.homeY - this.y) * Math.min(1, dt * 2.2);
        this.tilt += (0 - this.tilt) * Math.min(1, dt * 5);
        if (Math.abs(this.x - this.homeX) < 14) {
          this.state = 'fight'; this.stateT = 0;
          this.startCannon();
        }
        this.bubbles(dt, g);
        return;
      }
      if (this.state !== 'fight') return;

      if (this.act === 'cannon') this.updateCannon(dt, g);
      else this.updateDive(dt, g);
      this.bubbles(dt, g);
    }

    startCannon() {
      this.act = 'cannon'; this.sub = 'wind'; this.subT = 0;
      // 本轮炮击 2-4 次、间隔 1.5s；其中随机一轮为连发 2 次（间隔 0.28s）
      this.shotTotal = 2 + Math.floor(Math.random() * 3);
      this.doubleShot = Math.floor(Math.random() * this.shotTotal);
      this.shotsFired = 0;
      this.doubleDone = false;
    }
    startDive() { this.act = 'dive'; this.sub = 'pause'; this.subT = 0; this.dive = null; }
    get windTime() { return this.enraged ? 0.5 : 0.72; }
    get gapTime() { return this.enraged ? 1.15 : 1.5; }
    get pauseTime() { return this.enraged ? 0.36 : 0.5; }

    /* —— 炮击：停泊上下浮动 + 炮口蓄力；2-4 轮齐射（一轮双连发）后进入俯冲 —— */
    updateCannon(dt, g) {
      const p = g.player;
      this.subT += dt;
      this.x += (this.homeX - this.x) * Math.min(1, dt * 4);
      this.y += (this.homeY + Math.sin(this.t * 1.7) * 22 - this.y) * Math.min(1, dt * 4);
      this.tilt += (Math.sin(this.t * 1.7) * 0.05 - this.tilt) * Math.min(1, dt * 6);
      if (this.sub === 'wind') {
        if (this.subT > this.windTime) {
          this.fireCannon(g, p);
          this.shotsFired = 1; this.doubleDone = false;
          this.sub = 'gap'; this.subT = 0;
        }
      } else {
        const idx = this.shotsFired - 1;   // 刚发射的是第几轮
        // 指定轮次的快速双连发：主射击后 0.28s 追加一轮
        if (idx === this.doubleShot && !this.doubleDone && this.subT > 0.28) {
          this.fireCannon(g, p);
          this.doubleDone = true;
        }
        if (this.subT > this.gapTime) {
          if (this.shotsFired >= this.shotTotal) { this.startDive(); return; }
          this.fireCannon(g, p);
          this.shotsFired++; this.doubleDone = false;
          this.subT = 0;
        }
      }
    }

    fireCannon(g, p) {
      const mx = this.x - 74, my = this.y - 8;
      const n = this.enraged ? 5 : 3;
      const spread = n === 5 ? 0.36 : 0.22;
      const base = Math.atan2(p.y - my, p.x - mx);
      for (let i = 0; i < n; i++) {
        const tt = n === 1 ? 0 : i / (n - 1);
        const a = base + (tt - 0.5) * spread;
        g.bullets.push(new Bullet(mx, my, Math.cos(a) * 188, Math.sin(a) * 188,
          { kind: 'capShell', r: 15, dmg: Math.round(15 * g.atkScale), life: 5.5 }));
      }
      SFX.shock(); g.shake(4);
      burst(g, mx, my, 12, ['#ff9d2e', '#ffd23b', '#fff0b0', '#6a4a3a'], 200, 5, 0.4);
    }

    /* —— 俯冲：停顿瞄准 → 随机弧线贝塞尔斜冲 → 离场 → 右上复返 —— */
    updateDive(dt, g) {
      const p = g.player;
      this.subT += dt;
      if (this.sub === 'pause') {
        this.x += (this.homeX - this.x) * Math.min(1, dt * 5);
        this.aimX = p.x; this.aimY = p.y;   // 离弦瞬间锁定玩家当前位置
        this.tilt += (0 - this.tilt) * Math.min(1, dt * 6);
        if (this.subT > this.pauseTime) {
          this.setupDive();
          this.sub = 'fly'; this.subT = 0;
          this.contactDmg = 30;
          SFX.dash(); g.shake(5);
        }
      } else if (this.sub === 'fly') {
        const d = this.dive;
        d.u += dt * d.rate;
        const u = Math.min(1, d.u), iu = 1 - u;
        this.x = iu * iu * d.P0.x + 2 * iu * u * d.P1.x + u * u * d.P2.x;
        this.y = iu * iu * d.P0.y + 2 * iu * u * d.P1.y + u * u * d.P2.y;
        // 机头沿贝塞尔切线方向
        const vx = 2 * iu * (d.P1.x - d.P0.x) + 2 * u * (d.P2.x - d.P1.x);
        const vy = 2 * iu * (d.P1.y - d.P0.y) + 2 * u * (d.P2.y - d.P1.y);
        this.tilt = Math.atan2(vy, vx) + Math.PI;
        for (let i = 0; i < 4; i++) {
          g.particles.push(new Particle(this.x + rand(-26, 26), this.y + rand(-16, 26),
            rand(-130, 60), rand(-90, 60), rand(0.3, 0.6), rand(2.5, 6),
            Math.random() < 0.5 ? '#45c8ff' : '#bfeeff'));
        }
        if (u >= 1) {
          this.sub = 'back'; this.subT = 0;
          this.x = CFG.W + 150; this.y = rand(60, 180);
          this.contactDmg = this.contactBase;
          this.tilt = 0;
          burst(g, CFG.W + 30, this.y, 18, ['#45c8ff', '#bfeeff', '#fff'], 220, 5, 0.5);
        }
      } else if (this.sub === 'back') {
        this.x += (this.homeX - this.x) * Math.min(1, dt * 2.6);
        this.y += (this.homeY - this.y) * Math.min(1, dt * 2.6);
        this.tilt += (0 - this.tilt) * Math.min(1, dt * 5);
        if (Math.abs(this.x - this.homeX) < 14) this.startCannon();
      }
    }

    /** 二次贝塞尔俯冲：出口在玩家身后屏幕外，控制点加随机大弯（弧上/弧下各半） */
    setupDive() {
      const P0 = { x: this.x, y: this.y };
      const aa = Math.atan2(this.aimY - P0.y, this.aimX - P0.x);
      const exit = {
        x: -180,
        y: clamp(this.aimY + Math.sin(aa) * 360, -60, CFG.GROUND_Y - 20)
      };
      const bend = (0.45 + Math.random() * 0.65) * (Math.random() < 0.5 ? -1 : 1) * 280;
      const P1 = {
        x: (P0.x + exit.x) / 2 + -Math.sin(aa) * bend,
        y: (P0.y + exit.y) / 2 + Math.cos(aa) * bend
      };
      const chord = Math.hypot(exit.x - P0.x, exit.y - P0.y);
      const arcLen = chord + Math.abs(bend) * 0.9;
      const speed = this.enraged ? 660 : 480;
      this.dive = { P0, P1, P2: exit, u: 0, rate: speed / arcLen };
    }

    /** 常驻蓝色水泡/水花点缀 */
    bubbles(dt, g) {
      this.bubT -= dt;
      if (this.bubT > 0) return;
      this.bubT = 0.12;
      g.particles.push(new Particle(
        this.x - 70 + rand(-20, 30), this.y + rand(-20, 30),
        rand(-60, -10), rand(-50, -14), rand(0.4, 0.8), rand(2, 5),
        Math.random() < 0.6 ? 'rgba(120,200,255,0.85)' : '#bfeeff'));
    }

    render(ctx) {
      // 炮击蓄力：炮口橙红光晕 + 瞄准虚线
      if (this.act === 'cannon' && this.sub === 'wind') {
        const mx = this.x - 74, my = this.y - 8;
        const k = clamp(this.subT / this.windTime, 0, 1);
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 22 + 24 * k);
        glow.addColorStop(0, `rgba(255,180,60,${0.5 + 0.3 * k})`);
        glow.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(mx, my, 22 + 24 * k, 0, TAU); ctx.fill();
        if (this._px !== undefined) {
          ctx.save();
          ctx.strokeStyle = `rgba(255,150,60,${0.25 + 0.3 * k})`;
          ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
          ctx.lineDashOffset = -this.t * 50;
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(this._px, this._py); ctx.stroke();
          ctx.restore();
        }
      }
      // 俯冲停顿：红色预警线 + 锁定圈
      if (this.act === 'dive' && this.sub === 'pause' && this._px !== undefined) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,70,50,${0.4 + 0.3 * Math.sin(this.t * 12)})`;
        ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -this.t * 60;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this._px, this._py); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(255,90,70,${0.5 + 0.3 * Math.sin(this.t * 10)})`;
        ctx.beginPath(); ctx.arc(this._px, this._py, 22 + Math.sin(this.t * 8) * 4, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      const bob = Math.sin(this.t * 3) * 5;
      // haishang-1.png 500×300 缩放 .5 → 250×150；躯干偏左，右移 35 让碰撞中心对准身体
      drawBossSprite(ctx, Sprites.captain, this.x + 35, this.y + bob, 0.5, 0.5, this.tilt, this.flash);
    }
  }

  /* ================ 深海恶霸（深海限定） ================
   * 屏幕右侧缓慢上下移动，攻击前明显蓄力，动作笨重迟缓。三种攻击：
   *  追踪水鲨：张口喷半透明蓝灰水鲨，先弧线直游、再惯性追踪玩家，气泡拖尾，本体单次伤害；
   *  炸弹投掷：铁壳炸弹抛物线（出手锁定玩家当前位置），落地深红黑爆炸 + 3 道深色环形冲击波；
   *  巨型铁钩：铁钩水平高速飞到屏幕中部，做唯一一次出手已定的 90° 转向，绷直铁链有伤害。
   * 66% 血触发一次「鲨鱼围猎」高潮（7s，只用水鲨+铁钩）；30% 血基类狂暴：只提速/频率/密度。
   * 美术：haidi-1.png（500×300，已朝左） */
  class SeaBully extends Boss {
    constructor(g) {
      super(g, 0, 52);                 // 本体无接触伤害，伤害全部来自三种弹丸
      this.bossName = '深海恶霸';
      this.title = '海底黑帮打手';
      this.x = CFG.W + 140;
      this.y = 220;
      this.baseY = 220;
      this.homeX = CFG.seaBully.homeX;
      this.act = 'gap';                // gap → wind（蓄力）→ 出招 → hold → gap
      this.actT = 0.7;
      this.pending = '';               // 蓄力对应的攻击 shark/bomb/hook
      this.hkDir = 1;                  // 铁钩转向（蓄力末随机定死）
      this.tilt = 0;
      this.bubT = 0;
      this.climaxDone = false;         // 鲨鱼围猎只触发一次
      this.climaxT = 0;
      this.climaxSharkT = 0;
      this.climaxHookT = 0;
      this.deathCols = ['#6fa8c9', '#2b6ea8', '#45c8ff', '#fff'];
      this.xpValue = 250;
      this.hkAnchor = { x: this.x - 78, y: this.y - 4 };   // 铁链锚点（立绘手部，同一对象逐帧更新）
    }

    get windTime() { return this.enraged ? CFG.seaBully.windEnr : CFG.seaBully.wind; }

    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      this.hkAnchor.x = this.x - 10; this.hkAnchor.y = this.y - 6;
      const p = g.player;

      if (this.state === 'enter') {
        this.x += (this.homeX - this.x) * Math.min(1, dt * 1.7);
        this.baseY += (clamp(p.y, 90, CFG.GROUND_Y - 90) - this.baseY) * Math.min(1, dt * 1.2);
        this.y = this.baseY + Math.sin(this.t * 1.1) * 10;
        this.tilt += (0 - this.tilt) * Math.min(1, dt * 4);
        if (Math.abs(this.x - this.homeX) < 16) { this.state = 'fight'; this.stateT = 0; }
        this.bubbles(dt, g);
        return;
      }
      if (this.state !== 'fight') return;

      // 高潮触发（一次）：hp ≤ 66%
      if (!this.climaxDone && this.hp > 0 && this.hp <= this.maxHp * CFG.seaBully.climaxHp) {
        this.climaxDone = true;
        this.climaxT = CFG.seaBully.climaxDur;
        this.climaxSharkT = 0.2;
        this.climaxHookT = 1.2;
        g.toast('鲨鱼围猎！', 1.8, 'lt');
        SFX.bossEnrage(); g.shake(7);
      }
      if (this.climaxT > 0) { this.updateClimax(dt, g); this.bubbles(dt, g); return; }
      this.updateFight(dt, g);
      this.bubbles(dt, g);
    }

    /** 笨重迟缓的纵向跟随 + 缓慢上下浮动（fight 全程生效） */
    driftVertical(dt, p, rate) {
      this.baseY += (clamp(p.y, 80, CFG.GROUND_Y - 70) - this.baseY) * Math.min(1, dt * rate);
      this.y = this.baseY + Math.sin(this.t * 1.1) * 12;
    }

    updateFight(dt, g) {
      const p = g.player;
      const P = CFG.seaBully;
      this.driftVertical(dt, p, 1.5);
      this.actT += dt;
      if (this.act === 'gap') {
        this.tilt += (0 - this.tilt) * Math.min(1, dt * 5);
        if (this.actT >= 0) {
          // 随机选招（避免与上一招完全相同）
          const choices = ['shark', 'bomb', 'hook'];
          let pick = choices[Math.floor(Math.random() * 3)];
          if (pick === this.pending) pick = choices[Math.floor(Math.random() * 3)];
          this.pending = pick;
          this.act = 'wind'; this.actT = 0;
        }
      } else if (this.act === 'wind') {
        // 明显蓄力：身体后仰（tilt 缓慢增大，笨重感）
        const k = clamp(this.actT / this.windTime, 0, 1);
        this.tilt += (0.2 * k - this.tilt) * Math.min(1, dt * 6);
        if (this.actT >= this.windTime) {
          if (this.pending === 'shark') this.fireShark(g, p);
          else if (this.pending === 'bomb') this.fireBomb(g, p);
          else this.fireHook(g);
          this.act = 'hold'; this.actT = 0;
        }
      } else if (this.act === 'hold') {
        this.tilt += (0 - this.tilt) * Math.min(1, dt * 6);
        if (this.actT > 0.16) {
          this.act = 'gap';
          const lo = this.enraged ? P.gapEnrMin : P.gapMin;
          const hi = this.enraged ? P.gapEnrMax : P.gapMax;
          this.actT = -rand(lo, hi);
        }
      }
    }

    /** 高潮「鲨鱼围猎」：连续水鲨（不同高度弧入）+ 铁钩（不同方向切入），不投炸弹 */
    updateClimax(dt, g) {
      const P = CFG.seaBully;
      const p = g.player;
      this.driftVertical(dt, p, 1.5);
      this.climaxT -= dt;
      this.tilt += (0.06 + Math.sin(this.t * 6) * 0.03 - this.tilt) * Math.min(1, dt * 6);
      this.climaxSharkT -= dt;
      if (this.climaxSharkT <= 0) {
        this.climaxSharkT = P.climaxSharkGap;
        this.fireShark(g, p, P.climaxSharkN);
      }
      this.climaxHookT -= dt;
      if (this.climaxHookT <= 0) {
        this.climaxHookT = P.climaxHookGap;
        this.fireHook(g);
      }
      if (this.climaxT <= 0) {
        this.climaxT = 0;
        this.act = 'gap'; this.actT = -0.4;
      }
    }

    get mouthX() { return this.x - 74; }
    get mouthY() { return this.y - 10; }

    /** 攻击1 追踪水鲨：狂暴时一次 2～3 条 */
    fireShark(g, p, forceN) {
      const P = CFG.seaBully;
      const n = forceN || (this.enraged ? (Math.random() < 0.5 ? 2 : P.sharkNEnr) : 1);
      const mx = this.mouthX, my = this.mouthY;
      for (let i = 0; i < n; i++) {
        const base = Math.atan2(p.y - my, p.x - mx);
        const a = base + rand(-0.4, 0.4) + (n > 1 ? (i - (n - 1) / 2) * 0.22 : 0);
        const sp = this.enraged ? P.sharkSpdEnr : P.sharkSpd;
        g.bullets.push(new Bullet(mx, my, Math.cos(a) * sp, Math.sin(a) * sp, {
          kind: 'wshark', r: P.sharkR, dmg: Math.round(P.sharkDmg * g.atkScale),
          life: P.sharkLife, enr: this.enraged
        }));
      }
      SFX.sweep(); g.shake(4);
      burst(g, mx, my, 12, ['#6fa8c9', '#bfe4ff', '#eaf8ff'], 200, 5, 0.4);
    }

    /** 攻击2 炸弹投掷：出手瞬间锁定玩家当前位置，抛物线反解（飞行不追踪） */
    fireBomb(g, p) {
      const P = CFG.seaBully;
      const mx = this.mouthX, my = this.mouthY;
      const tx = clamp(p.x, 50, CFG.W - 60);
      const ty = clamp(p.y, 70, CFG.GROUND_Y - 18);
      const T = P.bombT;
      const vx = (tx - mx) / T;
      const vy = (ty - my) / T - 0.5 * P.bombG * T;     // 前上方用力抛出
      g.bullets.push(new Bullet(mx, my, vx, vy, {
        kind: 'wbomb', r: P.bombR, dmg: Math.round(P.bombDmg * g.atkScale),
        life: 9, grav: P.bombG, enr: this.enraged, tx, ty, noTouch: true
      }));
      SFX.dash(); g.shake(3);
    }

    /** 攻击3 巨型铁钩：转向方向出手时随机定死（向上/向下），不看玩家位置 */
    fireHook(g) {
      const P = CFG.seaBully;
      const hx = this.x - 24, hy = this.y;
      const dir = Math.random() < 0.5 ? 1 : -1;
      g.bullets.push(new Bullet(hx, hy, -P.hookSpd, 0, {
        kind: 'whook', r: P.hookW / 2, dmg: Math.round(P.hookDmg * g.atkScale),
        life: 12, enr: this.enraged, hkDir: dir,
        hkSpd: this.enraged ? P.hookSpdEnr : P.hookSpd,
        hkTurnT: this.enraged ? P.hookTurnTEnr : P.hookTurnT,
        hkAnchor: this.hkAnchor, noTouch: true
      }));
      SFX.dash(); g.shake(6);
    }

    bubbles(dt, g) {
      this.bubT -= dt;
      if (this.bubT > 0) return;
      this.bubT = 0.16;
      g.particles.push(new Particle(
        this.x - 70 + rand(-16, 24), this.y + rand(-18, 22),
        rand(-52, -8), rand(-44, -10), rand(0.4, 0.8), rand(1.8, 4.4),
        Math.random() < 0.6 ? 'rgba(120,200,255,0.85)' : '#bfeeff'));
    }

    render(ctx) {
      const P = CFG.seaBully;
      // 蓄力特效（按攻击类型）
      if (this.act === 'wind') {
        const k = clamp(this.actT / this.windTime, 0, 1);
        const mx = this.mouthX, my = this.mouthY;
        if (this.pending === 'shark') {
          // 口部蓝色水光汇聚
          const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 18 + 26 * k);
          glow.addColorStop(0, `rgba(150,220,255,${0.55 + 0.3 * k})`);
          glow.addColorStop(1, 'rgba(80,160,255,0)');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(mx, my, 18 + 26 * k, 0, TAU); ctx.fill();
        } else if (this.pending === 'bomb') {
          // 高举的炸弹暗红光
          const hx = this.x - 30, hy = this.y - 64;
          const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16 + 20 * k);
          glow.addColorStop(0, `rgba(255,120,50,${0.45 + 0.3 * k})`);
          glow.addColorStop(1, 'rgba(255,80,20,0)');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(hx, hy, 16 + 20 * k, 0, TAU); ctx.fill();
        } else {
          // 铁钩后甩：屏幕中部 90° 弧线预瞄（灰黑淡弧 + 箭头）
          const cx = P.hookMidX, cy = this.y;
          ctx.save();
          ctx.strokeStyle = `rgba(210,218,230,${0.25 + 0.35 * k})`;
          ctx.lineWidth = 3; ctx.setLineDash([9, 9]);
          ctx.lineDashOffset = -this.t * 40;
          ctx.beginPath();
          ctx.arc(cx, cy, 30, -Math.PI / 2, 0);           // 向下转弧
          ctx.arc(cx, cy, 46, Math.PI, Math.PI * 1.5);   // 向上转弧
          ctx.stroke();
          ctx.restore();
        }
      }
      // 高潮：右侧蓝光脉冲
      if (this.climaxT > 0) {
        const a = 0.14 + 0.08 * Math.sin(this.t * 9);
        ctx.fillStyle = `rgba(90,180,255,${a})`;
        ctx.beginPath(); ctx.arc(this.x, this.y, 120, 0, TAU); ctx.fill();
      }
      const bob = Math.sin(this.t * 3) * 4;
      // haidi-1.png 500×300 缩放 .5 → 250×150；躯干偏左，右移 35 让碰撞中心对准身体
      drawBossSprite(ctx, Sprites.seaBully, this.x + 35, this.y + bob, 0.5, 0.5, this.tilt, this.flash);
    }
  }
  window.SeaBully = SeaBully;

  /* ================ 雪巫（雪地限定） ================
   * 悬浮屏幕右上方、缓慢上下移动；攻击前展翼、凝聚冰霜。节奏总原则「永不停歇，只换节奏」，
   * 攻击之间零空档，用速度/密度/方向变化制造节奏感。
   *  攻击1 冰晶雨：短暂蓄力→法阵出现→冰晶持续落下，稀疏3/s↔密集8/s 四段循环无缝切换；
   *               法阵发射角以有限角速度缓慢扫向玩家（非即时锁死，可横向甩开），
   *               蓝白六角冰晶尖端朝下，沿瞄准角左右交错、速度有差异，白蓝冰雾拖尾（无伤害）。
   *  攻击2 冰环：短暂蓄力→冰环一颗接一颗，大环慢160↔小环快280 无缝交替；
   *             蓝白透明冰环外圈厚带冰刺，水平向左不追踪，环中心为安全区。
   *  高潮 冰霜风暴（66%血触发一次，三段无空档）：密集冰晶雨 → 大/小环交替 → 双环+冰晶雨齐爆。
   *  30%血基类狂暴：雨切换更快、密度上限提高；小环更快、大环更慢；高潮三段衔接更紧。
   * 美术：bingxue-1.png（500×300，已朝左） */
  class SnowWitch extends Boss {
    constructor(g) {
      super(g, 18, 46);                 // 本体悬在右上方，接触伤害仅为兜底
      this.bossName = '雪巫';
      this.title = '冰雪巫女';
      this.x = CFG.W + 140;
      this.y = CFG.iceWitch.hoverY;
      this.baseY = CFG.iceWitch.hoverY;
      // 攻击节奏状态机：rainWind→rain→ringWind→ring 循环（wind 是短暂蓄力，前一波弹幕仍在场，零空档）
      this.act = 'rainWind';
      this.actT = 0;
      this.phase = 0;                  // 冰晶雨密度段索引（偶数稀疏/奇数密集）
      this.phaseT = 0;
      this.rainAcc = 0;                // 冰晶发射数量累加器
      this.ringT = 0;                  // 冰环发射倒计时
      this.ringIdx = 0;                // 大环/小环交替（偶=大环，奇=小环）
      this.driftAlt = 0;               // 斜落左右交错
      this.rainAim = Math.PI * 0.75;   // 冰晶雨发射角（初值=左下45°，战斗中缓慢扫向玩家）
      // 高潮「冰霜风暴」
      this.climaxDone = false;
      this.cl = '';                    // c1/c2/c3
      this.clT = 0;
      this.clRainAcc = 0;
      this.clRingT = 0;
      this.clRingIdx = 0;
      this.frostT = 0;
      this.snowT = 0;
      this.deathCols = ['#dff1ff', '#8ecbff', '#4a9fe0', '#ffffff'];
      this.xpValue = 250;
    }

    get windTime() { return this.enraged ? CFG.iceWitch.windEnr : CFG.iceWitch.wind; }
    /** 法阵/出手锚点（立绘左手前侧） */
    get castX() { return this.x - 92; }
    get castY() { return this.y - 62; }

    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const P = CFG.iceWitch;

      if (this.state === 'enter') {
        this.x += (P.homeX - this.x) * Math.min(1, dt * 1.7);
        this.baseY += (P.hoverY - this.baseY) * Math.min(1, dt * 2);
        this.y = this.baseY + Math.sin(this.t * P.hoverFreq) * P.hoverAmp;
        this.ambientSnow(dt, g);
        if (Math.abs(this.x - P.homeX) < 16) {
          this.state = 'fight'; this.stateT = 0;
          SFX.bossCharge();            // 入场即开始第一发蓄力
        }
        return;
      }
      if (this.state !== 'fight') return;

      // 悬浮屏幕右上方，缓慢上下移动（固定区域，不追踪玩家）
      this.x = P.homeX + Math.sin(this.t * 0.5) * 12;
      this.y = P.hoverY + Math.sin(this.t * P.hoverFreq) * P.hoverAmp;
      this.ambientSnow(dt, g);

      // 高潮触发（一次）：hp ≤ 66%
      if (!this.climaxDone && this.hp > 0 && this.hp <= this.maxHp * P.climaxHp) {
        this.climaxDone = true;
        this.startClimax(g);
      }
      if (this.cl) { this.updateClimax(dt, g); return; }
      this.updateFight(dt, g);
    }

    /** 常态：冰晶雨 ↔ 冰环 循环；两种攻击各自连绵不断，切换时只有短暂蓄力 */
    updateFight(dt, g) {
      const P = CFG.iceWitch;
      const enr = this.enraged;
      this.actT += dt;

      if (this.act === 'rainWind' || this.act === 'ringWind') {
        // 展翼凝聚冰霜（render 画法阵/凝环，这里汇聚冰霜微粒）
        this.gatherFrost(dt, g, this.act === 'rainWind' ? 'rain' : 'ring');
        if (this.act === 'rainWind') this.aimRain(dt, g);   // 蓄力期间法阵就开始缓慢转向玩家
        if (this.actT >= this.windTime) {
          if (this.act === 'rainWind') {
            this.act = 'rain'; this.phase = 0; this.phaseT = 0; this.rainAcc = 0;
          } else {
            this.act = 'ring'; this.ringIdx = 0; this.ringT = 0.12;   // 蓄力结束立刻出环
          }
          this.actT = 0;
        }
        return;
      }

      if (this.act === 'rain') {
        // 稀疏↔密集循环：到点瞬时换密度，中间无停顿
        this.aimRain(dt, g);
        this.phaseT += dt;
        const seg = enr ? P.phaseTEnr : P.phaseT;
        if (this.phaseT >= seg) { this.phaseT -= seg; this.phase = Math.min(3, this.phase + 1); }
        const dense = this.phase % 2 === 1;
        const rate = dense
          ? (enr ? P.denseRateEnr : P.denseRate)
          : (enr ? P.sparseRateEnr : P.sparseRate);
        this.rainAcc += rate * dt;
        while (this.rainAcc >= 1) { this.rainAcc -= 1; this.spawnCrystal(g); }
        if (this.actT >= (enr ? P.rainActTEnr : P.rainActT)) {
          this.act = 'ringWind'; this.actT = 0; SFX.bossCharge();
        }
      } else {
        // 冰环一颗接一颗：大环慢 → 小环快，无缝衔接
        this.ringT -= dt;
        if (this.ringT <= 0) {
          const big = this.ringIdx % 2 === 0;
          this.spawnRing(g, big, 0);
          this.ringIdx++;
          this.ringT = big
            ? (enr ? P.bigGapEnr : P.bigGap)
            : (enr ? P.smallGapEnr : P.smallGap);
        }
        if (this.actT >= (enr ? P.ringActTEnr : P.ringActT)) {
          this.act = 'rainWind'; this.actT = 0; SFX.bossCharge();
        }
      }
    }

    /** 法阵发射角以有限角速度缓慢扫向玩家（角度限制在左下扇形，保证仍是“雨”） */
    aimRain(dt, g) {
      const P = CFG.iceWitch;
      const want = clamp(
        Math.atan2(g.player.y - this.castY, g.player.x - this.castX),
        P.aimMin, P.aimMax);
      let d = want - this.rainAim;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      const maxTurn = (this.enraged ? P.aimTurnEnr : P.aimTurn) * dt;
      this.rainAim += clamp(d, -maxTurn, maxTurn);
    }

    /** 攻击1：沿法阵瞄准角射一颗蓝白六角冰晶（左右交错、速度有差异，尖端朝运动方向） */
    spawnCrystal(g) {
      const P = CFG.iceWitch;
      this.driftAlt ^= 1;
      const sx = this.castX + rand(-30, 42);
      const sy = this.castY + rand(-18, 22);
      const spd = rand(P.rainSpdMin, P.rainSpdMax);
      const a = this.rainAim + (this.driftAlt ? P.aimSpread : -P.aimSpread) + rand(-P.aimJit, P.aimJit);
      g.bullets.push(new Bullet(sx, sy, Math.cos(a) * spd, Math.sin(a) * spd, {
        kind: 'icicle', r: P.rainR, dmg: Math.round(P.rainDmg * g.atkScale),
        life: P.rainLife, enr: this.enraged
      }));
    }

    /** 攻击2：出一颗冰环（出手高度锁定玩家当前 y±抖动，环体水平向左、不追踪） */
    spawnRing(g, big, yOff) {
      const P = CFG.iceWitch;
      const enr = this.enraged;
      const spd = big
        ? (enr ? P.bigSpdEnr : P.bigSpd)
        : (enr ? P.smallSpdEnr : P.smallSpd);
      const outer = big ? P.bigOuter : P.smallOuter;
      const inner = big ? P.bigInner : P.smallInner;
      const ry = clamp(g.player.y + yOff + rand(-P.ringYJit, P.ringYJit), 96, CFG.GROUND_Y - 100);
      g.bullets.push(new Bullet(this.x - 44, ry, -spd, 0, {
        kind: 'icering', r: outer, irOuter: outer, irInner: inner,
        dmg: Math.round(P.ringDmg * g.atkScale), life: P.ringLife,
        noTouch: true, enr: enr
      }));
      SFX.sweep();
    }

    /** 高潮「冰霜风暴」三段连打（段间无空档） */
    startClimax(g) {
      const P = CFG.iceWitch;
      this.cl = 'c1';
      this.clT = this.enraged ? P.cl1TEnr : P.cl1T;
      this.clRainAcc = 0;
      g.toast('❄️ 冰霜风暴！', 1.8, 'lt');
      SFX.bossEnrage(); g.shake(8);
      burst(g, this.castX, this.castY, 24, ['#dff1ff', '#8ecbff', '#4a9fe0'], 280, 5, 0.6, -20);
    }
    updateClimax(dt, g) {
      const P = CFG.iceWitch;
      const enr = this.enraged;
      this.clT -= dt;

      if (this.cl === 'c1') {
        // 第一段：冰晶雨密集压迫
        this.aimRain(dt, g);
        const rate = enr ? P.cl1RateEnr : P.cl1Rate;
        this.clRainAcc += rate * dt;
        while (this.clRainAcc >= 1) { this.clRainAcc -= 1; this.spawnCrystal(g); }
        if (this.clT <= 0) {
          this.cl = 'c2'; this.clT = enr ? P.cl2TEnr : P.cl2T;
          this.clRingIdx = 0; this.clRingT = 0.1;   // 立即接环，无空档
          SFX.phaseRise(); g.shake(5);
        }
      } else if (this.cl === 'c2') {
        // 第二段：大环小环交替
        this.clRingT -= dt;
        if (this.clRingT <= 0) {
          const big = this.clRingIdx % 2 === 0;
          this.spawnRing(g, big, 0);
          this.clRingIdx++;
          this.clRingT = big
            ? (enr ? P.bigGapEnr : P.bigGap)
            : (enr ? P.smallGapEnr : P.smallGap);
        }
        if (this.clT <= 0) {
          this.cl = 'c3'; this.clT = enr ? P.cl3TEnr : P.cl3T;
          this.clRainAcc = 0; this.clRingT = 0.3; this.clRingIdx = 0;
          SFX.phaseRise(); g.shake(6);
        }
      } else {
        // 第三段：双环 + 冰晶雨同时爆发
        this.aimRain(dt, g);
        const rate = enr ? P.cl3RateEnr : P.cl3Rate;
        this.clRainAcc += rate * dt;
        while (this.clRainAcc >= 1) { this.clRainAcc -= 1; this.spawnCrystal(g); }
        this.clRingT -= dt;
        if (this.clRingT <= 0) {
          const off = P.cl3RingOff;
          const bigTop = this.clRingIdx % 2 === 0;
          this.spawnRing(g, bigTop, -off);
          this.spawnRing(g, !bigTop, off);
          this.clRingIdx++;
          this.clRingT = enr ? P.cl3RingGapEnr : P.cl3RingGap;
          g.shake(3);
        }
        if (this.clT <= 0) {
          this.cl = '';
          this.act = 'rainWind'; this.actT = 0;   // 回到常态循环
          SFX.bossCharge();
        }
      }
    }

    /** 周身常年飘雪（冷域氛围） */
    ambientSnow(dt, g) {
      this.snowT -= dt;
      if (this.snowT > 0) return;
      this.snowT = 0.12;
      g.particles.push(new Particle(
        this.x + rand(-130, 110), this.y + rand(-96, 70),
        rand(-34, 8), rand(10, 44),
        rand(0.8, 1.6), rand(1.6, 3.4),
        Math.random() < 0.6 ? 'rgba(232,245,255,0.85)' : 'rgba(160,208,255,0.7)'));
    }
    /** 蓄力时冰霜微粒从四周向凝聚点汇聚 */
    gatherFrost(dt, g, type) {
      this.frostT -= dt;
      if (this.frostT > 0) return;
      this.frostT = 0.05;
      const cx = this.castX, cy = type === 'rain' ? this.castY : this.y;
      const a = rand(0, TAU), rr = rand(50, 96);
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      g.particles.push(new Particle(px, py,
        (cx - px) * 1.6 + rand(-20, 20), (cy - py) * 1.6 + rand(-20, 20),
        rand(0.3, 0.55), rand(2, 5),
        Math.random() < 0.5 ? '#dff1ff' : '#8ecbff'));
    }
    /** 冰霜法阵：双环 + 符文刻线 + 六出雪花芯，自转 */
    drawSigil(ctx, cx, cy, a) {
      if (a <= 0.02) return;
      const R = 46 * (0.4 + 0.6 * a);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(cx, cy);
      ctx.rotate(this.t * 1.2);
      ctx.strokeStyle = '#aee3ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const ang = i * TAU / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * R * 0.62, Math.sin(ang) * R * 0.62);
        ctx.lineTo(Math.cos(ang) * R, Math.sin(ang) * R);
        ctx.stroke();
      }
      ctx.rotate(-this.t * 2.4);
      ctx.strokeStyle = '#eaf7ff'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const ang = i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(ang) * R * 0.34, -Math.sin(ang) * R * 0.34);
        ctx.lineTo(Math.cos(ang) * R * 0.34, Math.sin(ang) * R * 0.34);
        ctx.stroke();
      }
      ctx.restore();
    }

    render(ctx) {
      // 高潮：周身冰蓝脉冲
      if (this.cl) {
        const a = 0.13 + 0.07 * Math.sin(this.t * 9);
        ctx.fillStyle = `rgba(120,190,255,${a})`;
        ctx.beginPath(); ctx.arc(this.x, this.y, 118, 0, TAU); ctx.fill();
      }
      // 法阵：冰晶雨蓄力时成形；落雨/高潮雨段淡显常驻
      const rainOn = this.act === 'rainWind' || this.act === 'rain' || this.cl === 'c1' || this.cl === 'c3';
      if (rainOn) {
        let ka;
        if (this.act === 'rainWind') ka = clamp(this.actT / this.windTime, 0, 1);
        else if (this.act === 'rain') ka = 0.22 + 0.08 * Math.sin(this.t * 5);
        else ka = 0.3 + 0.1 * Math.sin(this.t * 7);
        this.drawSigil(ctx, this.castX, this.castY, ka);
        // 瞄准刻痕：法阵外缘一道冰蓝光痕，随发射角缓慢扫向玩家（可预判）
        if (ka > 0.15) {
          const a0 = this.rainAim;
          ctx.save();
          ctx.globalAlpha = Math.min(0.9, ka + 0.2);
          ctx.strokeStyle = '#eaf7ff';
          ctx.lineWidth = 3.5; ctx.lineCap = 'round';
          ctx.shadowColor = '#8ecbff'; ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(this.castX + Math.cos(a0) * 32, this.castY + Math.sin(a0) * 32);
          ctx.lineTo(this.castX + Math.cos(a0) * 70, this.castY + Math.sin(a0) * 70);
          ctx.stroke();
          ctx.restore();
        }
      }
      // 冰环蓄力：手边凝聚中的残缺冰环（逐渐补圆、放大）
      if (this.act === 'ringWind') {
        const k = clamp(this.actT / this.windTime, 0, 1);
        ctx.save();
        ctx.strokeStyle = `rgba(180,225,255,${0.3 + 0.5 * k})`;
        ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(this.x - 70, this.y, 22 + 18 * k, -this.t * 4, -this.t * 4 + TAU * (0.4 + 0.6 * k));
        ctx.stroke();
        ctx.restore();
      }
      // 展翼：蓄力瞬间整体微胀 + 轻微后仰；高潮持续轻微振翼
      const winding = this.act === 'rainWind' || this.act === 'ringWind';
      const wk = winding ? clamp(this.actT / this.windTime, 0, 1) : 0;
      const s = 1 + 0.06 * wk + (this.cl ? 0.02 * Math.sin(this.t * 8) : 0);
      const tilt = -0.05 * wk + Math.sin(this.t * 1.4) * 0.02;
      const bob = Math.sin(this.t * 2.2) * 3;
      // bingxue-1.png 500×300 缩放 .5 → 250×150；躯干偏左，右移 30 让碰撞中心对准身体
      drawBossSprite(ctx, Sprites.iceWitch, this.x + 30, this.y + bob, 0.5 * s, 0.5 * s, tilt, this.flash);
    }
  }
  window.SnowWitch = SnowWitch;

  /* ================ 鸦伯爵（城堡限定） ================
   * 礼帽单片镜的珠宝大盗渡鸦，悬浮屏幕右侧；玩家接近时全屏连闪 3-5 个远点躲玩家
   * （落点尽量远、每点停留0.5s、旧位置留残影，CD 10s）。
   * 节奏总原则「永不停歇，只换节奏」：靠射击方式组合制造节奏。
   *  宝石三档（玩家 48px=1x）：小 0.5x≈24px 快 / 中 1.5x≈72px 中 / 大 2x≈96px 慢；本体有伤害、拖尾无伤害。
   * 攻击1 宝石飞掷（砰——唰唰——滴滴滴）：蓄力掷→连掷→单掷三拍循环——
   *        第1拍强：蓄力0.5s 掷出 2x 大宝石慢速封路，大宝石飞出2s后中/小拍才启动；
   *        第2拍中：一次甩出两颗 1.5x 分列玩家两侧；第3拍弱：快速连抛三颗 0.5x 各锁周边随机点；
   *        每颗宝石飞离枪口约屏幕中段时各自加速（强拍加速最猛）；各弹独立瞄准点，弹道不叠加。
   * 攻击2 宝石回旋（唰——咚咚咚——咻咻）：连掷去（一次甩出5-7颗直线去程）→按发射顺序依次180°折返
   *        （微偏向玩家旧位置）→折返同时从上方抛下2颗封走位。
   * 高潮 珠宝盗窃（66% 血触发一次，射击方式对位）：组A蓄力掷 2x 大宝石依次掷出不折返（低音鼓占位）
   *        对位组B连掷 0.5x 小宝石快速连掷提前折返（高音镲骚扰），组B折返时穿过组A缝隙；
   *        Boss 连续横向瞬移位置不断变化。
   * 狂暴（30% 基类）：蓄力时间缩短 / 连掷数量+1 / 单掷间隔缩短 / 抛掷落点更刁钻 / 折返更突然，
   *        射击方式不变，只是更快更密。
   * 美术：chengbao-1.png（500×300，已朝左） */
  class CrowCount extends Boss {
    constructor(g) {
      super(g, 14, 46);                 // 本体悬浮远处靠瞬移躲避，主要威胁来自宝石
      this.bossName = '鸦伯爵';
      this.title = '珠宝大盗·城堡贵族';
      this.x = CFG.W + 140;
      this.y = 200;
      this.baseY = 200;
      this.homeX = CFG.crowCount.homeX;
      this.act = 'gap';                 // gap → wind（蓄力）→ volley（三拍序列）/ lobwait（回旋抛掷）→ hold → gap
      this.actT = 0.8;
      this.pending = '';                // 蓄力对应的攻击 throw/ret
      this.tRound = 0;                  // 飞掷三拍循环轮次
      this.tStep = '';                  // 三拍序列步进 big/gap1/gap2
      this.tSmall = 0;                  // 单掷已抛颗数
      this.volleyT = 0;                 // 拍点间隔计时
      this.lobIdx = 0; this.lobT = 0;   // 抛掷已抛颗数/间隔计时
      this.tpCd = 2.5;                  // 瞬移冷却（开局稍后可用）
      this.tpLeft = 0;                  // 剩余连闪点数
      this.tpT = 0;                     // 连闪计时
      this.afterimgs = [];              // 瞬移残影
      this.climaxDone = false;          // 珠宝盗窃只触发一次
      this.climaxT = 0;
      this.cAT = 0.5; this.cChA = 0; this.clChg = 0.5;   // 组A节拍计时/蓄力剩余/蓄力总长
      this.cBT = 0.7; this.cBurst = 0; this.cBT2 = 0;    // 组B节拍计时/连掷剩余/连掷间隔
      this.tpCx = 0;                    // 高潮横向瞬移计时
      this.deathCols = ['#3a2f52', '#6a5a9a', '#ffd23b', '#fff'];
      this.xpValue = 250;
    }

    /** 蓄力时长（狂暴缩短） */
    get windTime() {
      const P = CFG.crowCount;
      return this.enraged ? P.chargeT * P.chargeEnrMul : P.chargeT;
    }

    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;
      // 残影衰减（每点停留0.5s，残影留存略久保证肉眼可见）
      for (const a of this.afterimgs) a.age += dt;
      this.afterimgs = this.afterimgs.filter(a => a.age < 0.55);

      if (this.state === 'enter') {
        this.x += (this.homeX - this.x) * Math.min(1, dt * 2.2);
        this.baseY += (clamp(p.y, 90, CFG.GROUND_Y - 100) - this.baseY) * Math.min(1, dt * 1.6);
        this.y = this.baseY + Math.sin(this.t * 2.2) * CFG.crowCount.bobAmp;
        if (Math.abs(this.x - this.homeX) < 16) { this.state = 'fight'; this.stateT = 0; }
        return;
      }
      if (this.state !== 'fight') return;

      // 高潮触发（一次）：hp ≤ 66%
      if (!this.climaxDone && this.hp > 0 && this.hp <= this.maxHp * CFG.crowCount.climaxHp) {
        this.climaxDone = true;
        this.climaxT = CFG.crowCount.climaxDur;
        this.cAT = 0.35; this.cChA = 0;
        this.cBT = 0.7; this.cBurst = 0;
        this.tpCx = 0.5;
        g.toast('珠宝盗窃！', 1.8, 'lt');
        SFX.bossEnrage(); g.shake(7);
      }
      if (this.climaxT > 0) {
        this.updateClimax(dt, g);
        this.updateTeleport(dt, g);
        return;
      }
      this.updateFight(dt, g);
      this.updateTeleport(dt, g);
    }

    /** 轻盈悬浮：较快纵向跟随 + 小幅上下浮动（贵族盗贼的灵巧感） */
    driftVertical(dt, p, rate) {
      this.baseY += (clamp(p.y, 80, CFG.GROUND_Y - 90) - this.baseY) * Math.min(1, dt * rate);
      this.y = this.baseY + Math.sin(this.t * 2.2) * CFG.crowCount.bobAmp;
    }

    /** 瞬移系统：玩家接近 → 全屏连闪 3-5 个远点躲玩家（每点停留0.5s，CD 10s） */
    updateTeleport(dt, g) {
      const P = CFG.crowCount;
      if (this.tpLeft > 0) {
        this.tpT -= dt;
        if (this.tpT <= 0) {
          this.tpT = P.tpBlinkGap;
          this.tpLeft--;
          this.doBlink(g, true);                        // 躲玩家：全屏远点（纵+横随机）
          if (this.tpLeft <= 0) this.tpCd = P.tpCd;
        }
        return;
      }
      this.tpCd -= dt;
      if (this.tpCd <= 0 && Math.hypot(g.player.x - this.x, g.player.y - this.y) < P.tpDist) {
        this.tpLeft = randi(P.tpPointsMin, P.tpPointsMax);   // 连闪 3-5 个点
        this.tpT = 0;
      }
    }

    /** 高潮「珠宝盗窃」：组A蓄力掷 对位 组B连掷 + 连续横向瞬移 */
    updateClimax(dt, g) {
      const P = CFG.crowCount, p = g.player;
      this.climaxT -= dt;
      this.driftVertical(dt, p, 2.2);
      const chg = this.enraged ? P.clACharge * P.chargeEnrMul : P.clACharge;
      // 组A｜蓄力掷（低音鼓，占位）：每拍蓄力后掷出一颗 2x 大宝石，不折返，中段加速最猛
      this.cAT -= dt;
      if (this.cAT <= 0) { this.cChA = chg; this.clChg = chg; this.cAT = P.clACycle + chg; }
      if (this.cChA > 0) {
        this.cChA -= dt;
        if (this.cChA <= 0) this.fireFwdGem(g, p);
      }
      // 组B｜连掷（高音镲，折返骚扰）：4颗小宝石快速连掷（狂暴+1），提前折返穿组A缝隙
      this.cBT -= dt;
      if (this.cBT <= 0) {
        this.cBurst = P.clBN + (this.enraged ? 1 : 0);
        this.cBT2 = 0;
        this.cBT = P.clBCycle;
      }
      if (this.cBurst > 0) {
        this.cBT2 -= dt;
        if (this.cBT2 <= 0) { this.fireClRetGem(g, p); this.cBurst--; this.cBT2 = P.clBGap; }
      }
      // Boss 连续横向瞬移，位置不断变化
      this.tpCx -= dt;
      if (this.tpCx <= 0) {
        this.tpCx = P.tpClimaxGap;
        this.doBlink(g, false);                      // 横向瞬移：y 小幅变化
      }
      if (this.climaxT <= 0) {
        this.climaxT = 0;
        this.cChA = 0; this.cBurst = 0;
        this.act = 'gap'; this.actT = -0.3;
      }
    }

    updateFight(dt, g) {
      const P = CFG.crowCount, p = g.player;
      // 连闪停留期间锁定纵向（落点就是落点，不滑向玩家）；平时轻盈悬浮跟随
      if (this.tpLeft > 0) this.y = this.baseY + Math.sin(this.t * 2.2) * P.bobAmp;
      else this.driftVertical(dt, p, 2.0);
      this.actT += dt;
      if (this.act === 'gap') {
        if (this.actT >= 0) {
          // 随机选招（避免与上一招完全相同）
          let pick = Math.random() < 0.5 ? 'throw' : 'ret';
          if (pick === this.pending) pick = Math.random() < 0.5 ? 'throw' : 'ret';
          this.pending = pick;
          this.tRound = 0; this.tSmall = 0;
          this.act = 'wind'; this.actT = 0;
        }
      } else if (this.act === 'wind') {
        // 蓄力（飞掷＝第1拍蓄力掷的蓄力；回旋＝甩出前凝气）
        if (this.actT >= this.windTime) {
          if (this.pending === 'throw') {
            this.act = 'volley'; this.actT = 0;
            this.tStep = 'big'; this.volleyT = 0;
          } else {
            this.fireRetFan(g, p);                  // 第一段：连掷去（一次甩出）
            this.act = 'lobwait'; this.actT = 0;
            this.lobIdx = 0; this.lobT = 0;
          }
        }
      } else if (this.act === 'volley') {
        // 三拍序列：蓄力掷(强) → 连掷(中) → 单掷(弱) → 弱拍后立刻接下一轮
        this.volleyT -= dt;
        if (this.tStep === 'big') {
          if (this.volleyT <= 0) {
            this.fireBeatBig(g, p);                 // 第1拍（强）：蓄力掷 2x 慢速封路
            this.tStep = 'gap1'; this.volleyT = P.gapStrong;
          }
        } else if (this.tStep === 'gap1') {
          if (this.volleyT <= 0) {
            this.fireDblGem(g, p);                  // 第2拍（中）：连掷一次甩出两颗
            this.tStep = 'gap2'; this.volleyT = P.gapMid; this.tSmall = 0;
          }
        } else if (this.tStep === 'gap2') {
          if (this.volleyT <= 0) {
            this.fireRapGem(g, p);                  // 第3拍（弱）：单掷快速连抛
            this.tSmall++;
            this.volleyT = P.rapGap * (this.enraged ? P.rapGapEnrMul : 1);
            if (this.tSmall >= P.rapN) {
              this.tRound++;
              if (this.tRound >= P.throwRounds) { this.act = 'hold'; this.actT = 0; }
              else { this.act = 'wind'; this.actT = 0; }   // 弱拍后立刻接下一轮（下一拍蓄力掷）
            }
          }
        }
      } else if (this.act === 'lobwait') {
        // 第二段：宝石按发射顺序依次折返（折返点随序号递增）
        // 第三段：折返同时从上方抛下2颗封走位
        this.lobT -= dt;
        const folding = g.bullets.some(b => b.kind === 'gem' && b.gemMode === 'ret' && b.gPhase !== 'out');
        if (folding && this.lobIdx < P.lobN && this.lobT <= 0) {
          this.fireLobGem(g, p, this.lobIdx);
          this.lobIdx++;
          this.lobT = P.lobGap;
        }
        if ((this.lobIdx >= P.lobN && this.lobT <= 0) || this.actT > 7) {
          this.act = 'hold'; this.actT = 0;
        }
      } else if (this.act === 'hold') {
        if (this.actT > 0.28) {
          this.act = 'gap';
          // 永不停歇只换节奏：间隔很短
          const lo = this.enraged ? 0.35 : 0.6, hi = this.enraged ? 0.8 : 1.15;
          this.actT = -rand(lo, hi);
        }
      }
    }

    /** 枪口：始终在朝向玩家的一侧（全屏瞬移到玩家左侧时也能正手发射） */
    muzzle(p) {
      return { mx: this.x + (p.x < this.x ? -46 : 46), my: this.y - 8 };
    }

    /** 攻击1·第1拍（强）蓄力掷：2x 大宝石慢速封路，瞄准点贴玩家，飞2s后中/小拍才启动 */
    fireBeatBig(g, p) {
      const P = CFG.crowCount;
      const { mx, my } = this.muzzle(p);
      const oa = rand(0, TAU), off = rand(0, P.aimBig);
      const ox = Math.cos(oa) * off, oy = Math.sin(oa) * off;
      const a = Math.atan2(p.y + oy - my, p.x + ox - mx);
      g.bullets.push(new Bullet(mx, my, Math.cos(a), Math.sin(a), {
        kind: 'gem', r: P.gemR[2], dmg: Math.round(P.gemDmg * g.atkScale),
        life: 8, gemTier: 2, gemMode: 'throw', aimOffX: ox, aimOffY: oy,
        gemV0: P.throwV0, gemV1: P.accV[0], spinRate: 2.4, enr: this.enraged
      }));
      burst(g, mx, my, 8, ['#35e0ff', '#fff', '#ffd23b'], 170, 4, 0.3);
      SFX.dash();
    }

    /** 攻击1·第2拍（中）连掷：一次甩出两颗 1.5x（狂暴+1），分列玩家两侧两条独立弹道 */
    fireDblGem(g, p) {
      const P = CFG.crowCount;
      const n = P.dblN + (this.enraged ? 1 : 0);
      const { mx, my } = this.muzzle(p);
      for (let i = 0; i < n; i++) {
        const ox = (i - (n - 1) / 2) * (n === 2 ? 2 * P.aimDbl : P.aimDbl);
        const oy = rand(-42, 42);
        const a = Math.atan2(p.y + oy - my, p.x + ox - mx);
        g.bullets.push(new Bullet(mx, my, Math.cos(a), Math.sin(a), {
          kind: 'gem', r: P.gemR[1], dmg: Math.round(P.gemDmg * g.atkScale),
          life: 8, gemTier: 1, gemMode: 'throw', aimOffX: ox, aimOffY: oy,
          gemV0: P.throwV0, gemV1: P.accV[1], spinRate: 2.4, enr: this.enraged
        }));
      }
      burst(g, mx, my, 8, ['#a855f7', '#fff', '#ffd23b'], 170, 4, 0.3);
      SFX.dash();
    }

    /** 攻击1·第3拍（弱）单掷：快速连抛 0.5x 小宝石（本方法每颗调用一次），各锁玩家周边一个随机点 */
    fireRapGem(g, p) {
      const P = CFG.crowCount;
      const { mx, my } = this.muzzle(p);
      const oa = rand(0, TAU), off = P.aimRap * rand(0.55, 1);
      const ox = Math.cos(oa) * off, oy = Math.sin(oa) * off;
      const a = Math.atan2(p.y + oy - my, p.x + ox - mx);
      g.bullets.push(new Bullet(mx, my, Math.cos(a), Math.sin(a), {
        kind: 'gem', r: P.gemR[0], dmg: Math.round(P.gemDmg * g.atkScale),
        life: 8, gemTier: 0, gemMode: 'throw', aimOffX: ox, aimOffY: oy,
        gemV0: P.throwV0, gemV1: P.accV[2], spinRate: 2.4, enr: this.enraged
      }));
      if (this.tSmall === 0) SFX.sweep();       // 滴滴滴一串只配一声
    }

    /** 攻击2·第一段连掷去：朝玩家所在方向扇形甩出 5~7 颗（狂暴+1）；折返距离随序号递增＝依次折返 */
    fireRetFan(g, p) {
      const P = CFG.crowCount;
      const n = randi(P.retNMin, P.retNMax) + (this.enraged ? 1 : 0);
      const { mx, my } = this.muzzle(p);
      const dir = p.x < this.x ? -1 : 1;                // 玩家在哪边就朝哪边放（全屏瞬移不空手）
      const ca = dir < 0 ? Math.PI : 0;
      let hasBig = false;
      for (let i = 0; i < n; i++) {
        const roll = Math.random();
        let tier = roll < 0.62 ? 0 : (roll < 0.82 ? 1 : 2);   // 0.5x 为主穿插 1.5x/2x
        if (i === n - 1 && !hasBig) tier = 2;                  // 保底一颗大宝石封路
        if (tier === 2) hasBig = true;
        const foldDist = P.retFoldMin + (n > 1 ? i * (P.retFoldMax - P.retFoldMin) / (n - 1) : 0) + rand(-12, 12);
        const a = ca + (n > 1 ? (i / (n - 1) - 0.5) * 2 * P.retAmp : 0) + rand(-0.03, 0.03);
        g.bullets.push(new Bullet(mx, my, Math.cos(a), Math.sin(a), {
          kind: 'gem', r: P.gemR[tier], dmg: Math.round(P.gemDmg * g.atkScale),
          life: 9, gemTier: tier, gemMode: 'ret',
          foldDir: dir, foldDist,
          pauseT: P.retPause[tier] * (this.enraged ? P.retPauseEnrMul : 1),
          spinRate: 2.4, enr: this.enraged
        }));
      }
      SFX.dash();
    }

    /** 攻击2·第三段抛掷：从上方抛下宝石封走位（狂暴落点更刁钻+预判提前量） */
    fireLobGem(g, p, i) {
      const P = CFG.crowCount;
      const { mx, my } = this.muzzle(p);
      const off = this.enraged ? P.lobOffEnr : P.lobOff;
      const lead = this.enraged ? p.vx * 0.35 : 0;            // 狂暴：预判走位
      const tx = clamp(p.x + lead + rand(-off, off), 40, CFG.W - 40);
      const ty = (g.groundYAt ? g.groundYAt(tx) : CFG.GROUND_Y) - 10;
      const T = P.lobT;
      const vx = (tx - mx) / T;
      const vy = (ty - my) / T - 0.5 * P.lobG * T;            // 抛物线：先升后降，从上方落下
      const tier = i % 2;                                     // 中宝石+小宝石各一颗
      g.bullets.push(new Bullet(mx, my, vx, vy, {
        kind: 'gem', r: P.gemR[tier], dmg: Math.round(P.gemDmg * g.atkScale),
        life: 6, gemTier: tier, gemMode: 'lob', spinRate: 3.2, enr: this.enraged
      }));
      SFX.sweep();
    }

    /** 高潮组A·蓄力掷：2x 大宝石不折返（低音鼓），慢-慢-慢，各瞄玩家周边错开标线 */
    fireFwdGem(g, p) {
      const P = CFG.crowCount;
      const { mx, my } = this.muzzle(p);
      const oa = rand(0, TAU), off = rand(0, 48);
      const ox = Math.cos(oa) * off, oy = Math.sin(oa) * off;
      const a = Math.atan2(p.y + oy - my, p.x + ox - mx);
      g.bullets.push(new Bullet(mx, my, Math.cos(a), Math.sin(a), {
        kind: 'gem', r: P.gemR[2], dmg: Math.round(P.gemDmg * g.atkScale),
        life: 8, gemTier: 2, gemMode: 'fwd', aimOffX: ox, aimOffY: oy,
        gemV0: P.throwV0, gemV1: P.accV[0], spinRate: 2.4, enr: this.enraged
      }));
      SFX.dash();
    }

    /** 高潮组B·连掷：0.5x 小宝石快速连掷，刚放出即折返骚扰（高音镲，朝玩家一侧放出） */
    fireClRetGem(g, p) {
      const P = CFG.crowCount;
      const { mx, my } = this.muzzle(p);
      const dir = p.x < this.x ? -1 : 1;
      const ca = dir < 0 ? Math.PI : 0;
      const a = ca + rand(-0.1, 0.1);
      g.bullets.push(new Bullet(mx, my, Math.cos(a), Math.sin(a), {
        kind: 'gem', r: P.gemR[0], dmg: Math.round(P.gemDmg * g.atkScale),
        life: 9, gemTier: 0, gemMode: 'ret',
        foldDir: dir, foldDist: rand(P.clFoldMin, P.clFoldMax),
        pauseT: P.retPause[0] * (this.enraged ? P.retPauseEnrMul : 1),
        spinRate: 2.4, enr: this.enraged
      }));
    }

    /** 瞬移：旧位置留残影 + 羽尘爆发；全屏范围挑远点（离当前点尽量远、离玩家保持距离），落点再爆发 */
    doBlink(g, vertical) {
      const P = CFG.crowCount;
      this.afterimgs.push({ x: this.x, y: this.y, age: 0 });
      if (this.afterimgs.length > 6) this.afterimgs.shift();
      burst(g, this.x, this.y, 10, ['#3a2f52', '#6a5a9a', '#c9b8ff', '#fff'], 220, 5, 0.35);
      // 多抽几次：先找同时满足「距当前点≥tpMinJump、距玩家≥tpMinPlayer」的点；找不到取综合最远
      let bx = this.x, by = this.baseY, best = -1e9, ok = false;
      for (let k = 0; k < 8 && !ok; k++) {
        const cx = rand(P.tpXMin, P.tpXMax);
        const cy = vertical
          ? rand(P.tpYTop, CFG.GROUND_Y - P.tpYBot)
          : clamp(this.baseY + rand(-46, 46), 80, CFG.GROUND_Y - 90);
        const dj = Math.hypot(cx - this.x, cy - this.y);
        const dp = Math.hypot(cx - g.player.x, cy - g.player.y);
        if (dj >= P.tpMinJump && dp >= P.tpMinPlayer) { bx = cx; by = cy; ok = true; }
        else {
          const score = dj + Math.min(dp, P.tpMinPlayer) * 0.5;
          if (score > best) { best = score; bx = cx; by = cy; }
        }
      }
      this.x = bx;
      this.baseY = by;
      this.y = by;
      burst(g, this.x, this.y, 10, ['#6a5a9a', '#c9b8ff', '#fff', '#ffd23b'], 220, 5, 0.35);
      SFX.dash();
    }

    render(ctx) {
      const P = CFG.crowCount;
      // 瞬移残影：停留0.5s期间旧位置残影保持可见，随后快速淡出
      for (const a of this.afterimgs) {
        ctx.globalAlpha = 0.34 * Math.max(0, 1 - a.age / 0.55);
        drawSprite(ctx, Sprites.crowCount, a.x, a.y, 0.5, 0.5, 0, 0);
      }
      ctx.globalAlpha = 1;
      // 蓄力特效：掌心彩色宝石光点汇聚（攻击蓄力 / 高潮组A每拍蓄力）
      let cg = -1;
      if (this.act === 'wind') { cg = clamp(this.actT / this.windTime, 0, 1); }
      else if (this.cChA > 0) { cg = clamp(1 - this.cChA / Math.max(0.001, this.clChg), 0, 1); }
      if (cg >= 0) {
        const k = cg;
        const hx = this.x - 58, hy = this.y - 8;
        const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14 + 22 * k);
        glow.addColorStop(0, `rgba(255,214,120,${0.5 + 0.35 * k})`);
        glow.addColorStop(0.55, `rgba(168,85,247,${0.3 + 0.3 * k})`);
        glow.addColorStop(1, 'rgba(168,85,247,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(hx, hy, 14 + 22 * k, 0, TAU); ctx.fill();
        for (let i = 0; i < 3; i++) {
          const aa = this.t * 7 + i * TAU / 3;
          const rr = (1 - k) * 26 + 4;
          ctx.fillStyle = ['#ff4a6a', '#35e0ff', '#ffd23b'][i];
          ctx.globalAlpha = 0.5 + 0.5 * k;
          ctx.beginPath(); ctx.arc(hx + Math.cos(aa) * rr, hy + Math.sin(aa) * rr, 2.6, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // 高潮：金紫脉冲
      if (this.climaxT > 0) {
        const a = 0.12 + 0.07 * Math.sin(this.t * 9);
        ctx.fillStyle = `rgba(255,205,90,${a})`;
        ctx.beginPath(); ctx.arc(this.x, this.y, 116, 0, TAU); ctx.fill();
      }
      const bob = Math.sin(this.t * 3.2) * 3;
      const tilt = Math.sin(this.t * 2.2) * 0.06;   // 悬浮轻微摆动
      // chengbao-1.png 500×300 缩放 .5 → 250×150；躯干居中，左移 -6 让喙部朝向玩家
      drawBossSprite(ctx, Sprites.crowCount, this.x - 6, this.y + bob, 0.5, 0.5, tilt, this.flash);
    }
  }
  window.CrowCount = CrowCount;

  /* ================ 火遮眼（火焰山限定） ================
   * 固定屏幕右侧小幅上下移动；固定循环 火焰斩 → 火龙冲锋：
   *  火焰斩：举刀蓄力 → 1 道红橙色弧形火焰斩（红黄色长拖尾，斩击宽度填充半屏）；
   *  冲锋：低身蓄力 → 快速冲刺挥刀，冲过玩家后离场、从右侧重新出现。
   * 低血量（狂暴）：攻击节奏加快，火焰斩变为 3 道窄斩。美术：huoyanshan-1.png（500×300，已朝左） */
  class FireBlind extends Boss {
    constructor(g) {
      super(g, 26, 52);
      this.bossName = '火遮眼';
      this.title = '熔岩刀客';
      this.x = CFG.W + 140;
      this.y = 205;
      this.homeX = CFG.W - 150;
      this.homeY = 205;
      this.act = 'slash';       // slash ↔ charge 固定循环（首招火焰斩）
      this.sub = '';
      this.subT = 0;
      this.chargeV = null;      // 冲锋速度向量
      this.chargePts = [];      // 火龙冲锋长段火焰拖尾点
      this.aimX = 0; this.aimY = 0;
      this.face = -1;
      this.tilt = 0;
      this.contactBase = 26;
      this.emberT = 0;
      this.deathCols = ['#ff3b10', '#ff8a2a', '#ffd23b', '#5a1a08'];
      this.xpValue = 260;
    }

    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.commonMove(dt);
      const p = g.player;
      this._px = p.x; this._py = p.y;

      if (this.state === 'enter') {
        this.x += (this.homeX - this.x) * Math.min(1, dt * 2.2);
        this.y += (this.homeY - this.y) * Math.min(1, dt * 2.2);
        this.tilt += (0 - this.tilt) * Math.min(1, dt * 5);
        if (Math.abs(this.x - this.homeX) < 14) {
          this.state = 'fight'; this.stateT = 0;
          this.startSlash();
        }
        this.embers(dt, g);
        return;
      }
      if (this.state !== 'fight') return;

      if (this.act === 'slash') this.updateSlash(dt, g);
      else this.updateCharge(dt, g);
      // 冲锋火焰拖尾老化（冲锋结束后仍渐隐半秒）
      if (this.chargePts && this.chargePts.length) {
        for (const q of this.chargePts) q.age += dt;
        this.chargePts = this.chargePts.filter(q => q.age < 0.5);
      }
      this.embers(dt, g);
    }

    startSlash() {
      this.act = 'slash'; this.sub = 'wind'; this.subT = 0;
      // 本轮斩击 3-4 次、间隔 2s；其中随机一次为连发 3 道（每道间隔 0.22s）
      this.slashTotal = 3 + Math.floor(Math.random() * 2);
      this.tripleSlash = Math.floor(Math.random() * this.slashTotal);
      this.slashCount = 0;
      this.tripleStage = 0;
    }
    startCharge() {
      this.act = 'charge'; this.sub = 'wind'; this.subT = 0; this.chargeV = null;
      this.chargePts = [];   // 火龙冲锋长段火焰拖尾
    }
    get slashWindTime() { return this.enraged ? 0.5 : 0.78; }
    get slashGapTime() { return this.enraged ? 1.4 : 2; }
    get chargeWindTime() { return this.enraged ? 0.42 : 0.62; }

    /* —— 火焰斩：蓄力 → 3-4 道斩击（间隔 2s，其中一次三连发）→ 冲锋 —— */
    updateSlash(dt, g) {
      const p = g.player;
      this.subT += dt;
      this.x += (this.homeX - this.x) * Math.min(1, dt * 4);
      this.y += (this.homeY + Math.sin(this.t * 1.8) * 18 - this.y) * Math.min(1, dt * 4);
      this.tilt += (0 - this.tilt) * Math.min(1, dt * 6);
      if (this.sub === 'wind') {
        if (this.subT > this.slashWindTime) {
          this.fireSlashWave(g, p);
          this.slashCount = 1; this.tripleStage = 0;
          this.sub = 'gap'; this.subT = 0;
        }
      } else {
        const idx = this.slashCount - 1;  // 刚挥出的是第几斩
        // 指定斩次的三连发：主斩之后 0.22s / 0.44s 各追加一道
        if (idx === this.tripleSlash && this.tripleStage < 2 &&
            this.subT > 0.22 * (this.tripleStage + 1)) {
          this.fireSlashWave(g, p);
          this.tripleStage++;
        }
        if (this.subT > this.slashGapTime) {
          if (this.slashCount >= this.slashTotal) { this.startCharge(); return; }
          this.fireSlashWave(g, p);
          this.slashCount++; this.tripleStage = 0;
          this.subT = 0;
        }
      }
    }

    fireSlashWave(g, p) {
      const mx = this.x - 82, my = this.y - 18;
      const base = Math.atan2(p.y - my, p.x - mx);
      if (this.enraged) {
        // 狂暴：3 道窄斩（弧幅收窄 + 扇出加大，三道之间留出躲避缝）
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.28;
          g.bullets.push(new Bullet(mx, my, Math.cos(a) * 330, Math.sin(a) * 330, {
            kind: 'fireSlash', r: 40, dmg: Math.round(13 * g.atkScale), life: 4,
            boxW: 104, boxH: 128, boxOff: 100, slashR: 120, slashSpan: 0.5
          }));
        }
      } else {
        g.bullets.push(new Bullet(mx, my, Math.cos(base) * 300, Math.sin(base) * 300, {
          kind: 'fireSlash', r: 44, dmg: Math.round(15 * g.atkScale), life: 4,
          boxW: 150, boxH: 300, boxOff: 112, slashR: 150, slashSpan: 1.02
        }));
      }
      SFX.sweep(); g.shake(5);
      burst(g, mx, my, 16, ['#ff3b10', '#ff8a2a', '#ffd23b', '#fff0b0'], 240, 6, 0.45);
    }

    /* —— 火龙冲锋：低身蓄力锁定 → 直线高速冲刺挥刀 → 冲出屏幕 → 右侧复返 —— */
    updateCharge(dt, g) {
      const p = g.player;
      this.subT += dt;
      if (this.sub === 'wind') {
        this.x += (this.homeX - this.x) * Math.min(1, dt * 4);
        this.aimX = p.x; this.aimY = p.y;
        this.tilt += (0 - this.tilt) * Math.min(1, dt * 6);
        if (this.subT > this.chargeWindTime) {
          const a = Math.atan2(this.aimY - this.y, this.aimX - this.x);
          const sp = this.enraged ? 780 : 620;
          this.chargeV = { x: Math.cos(a) * sp, y: Math.sin(a) * sp };
          this.sub = 'fly'; this.subT = 0;
          this.contactDmg = 32;
          SFX.dash(); g.shake(6);
          SFX.bossCharge();
        }
      } else if (this.sub === 'fly') {
        const v = this.chargeV;
        this.x += v.x * dt; this.y += v.y * dt;
        this.tilt = Math.atan2(v.y, v.x) + Math.PI;
        // 长段火焰拖尾：在身后记录轨迹点（约 0.77s、随冲锋速 620 可达近一屏长）
        const sp = Math.hypot(v.x, v.y) || 1;
        this.chargePts.push({ x: this.x - v.x / sp * 36, y: this.y - v.y / sp * 36, age: 0 });
        if (this.chargePts.length > 46) this.chargePts.shift();
        for (let i = 0; i < 5; i++) {
          g.particles.push(new Particle(this.x + rand(-30, 30), this.y + rand(-24, 30),
            rand(-120, 80), rand(-80, 80), rand(0.25, 0.55), rand(3, 7),
            ['#ff3b10', '#ff7b1e', '#ffb13b'][randi(0, 2)]));
        }
        if (this.x < -160 || this.x > CFG.W + 220 || this.y < -150 || this.y > CFG.H + 130) {
          this.sub = 'back'; this.subT = 0;
          this.x = CFG.W + 150; this.y = rand(90, 270);
          this.contactDmg = this.contactBase;
          this.tilt = 0;
          burst(g, CFG.W + 30, this.y, 18, ['#ff3b10', '#ff8a2a', '#ffd23b'], 220, 5, 0.5);
        }
      } else if (this.sub === 'back') {
        this.x += (this.homeX - this.x) * Math.min(1, dt * 2.6);
        this.y += (this.homeY - this.y) * Math.min(1, dt * 2.6);
        this.tilt += (0 - this.tilt) * Math.min(1, dt * 5);
        if (Math.abs(this.x - this.homeX) < 14) this.startSlash();
      }
    }

    /** 熔岩余烬环境粒子 */
    embers(dt, g) {
      this.emberT -= dt;
      if (this.emberT > 0) return;
      this.emberT = 0.1;
      g.particles.push(new Particle(
        this.x + rand(-40, 50), this.y + rand(-30, 40),
        rand(-30, 20), rand(-70, -20), rand(0.4, 0.8), rand(2, 5),
        Math.random() < 0.6 ? '#ff7b1e' : '#ffd23b'));
    }

    render(ctx) {
      // 火焰斩蓄力：刀位红橙弧形火光涨大 + 细预警线
      if (this.act === 'slash' && this.sub === 'wind') {
        const mx = this.x - 76, my = this.y - 14;
        const k = clamp(this.subT / this.slashWindTime, 0, 1);
        const rr = 20 + 34 * k;
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, rr);
        glow.addColorStop(0, `rgba(255,210,80,${0.55 + 0.3 * k})`);
        glow.addColorStop(0.5, 'rgba(255,90,20,0.45)');
        glow.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(mx, my, rr, 0, TAU); ctx.fill();
        if (this._px !== undefined) {
          ctx.save();
          ctx.strokeStyle = `rgba(255,90,40,${0.2 + 0.25 * k})`;
          ctx.lineWidth = 2; ctx.setLineDash([12, 12]);
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(this._px, this._py); ctx.stroke();
          ctx.restore();
        }
      }
      // 冲锋蓄力：低身红色锁定线 + 锁定圈
      if (this.act === 'charge' && this.sub === 'wind' && this._px !== undefined) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,50,30,${0.45 + 0.3 * Math.sin(this.t * 14)})`;
        ctx.lineWidth = 3.5; ctx.setLineDash([16, 10]);
        ctx.lineDashOffset = -this.t * 70;
        ctx.beginPath(); ctx.moveTo(this.x - 40, this.y); ctx.lineTo(this._px, this._py); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(255,80,50,${0.55 + 0.3 * Math.sin(this.t * 11)})`;
        ctx.beginPath(); ctx.arc(this._px, this._py, 24 + Math.sin(this.t * 9) * 5, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      const bob = Math.sin(this.t * 3.2) * 5;
      const crouch = (this.act === 'charge' && this.sub === 'wind') ? 7 : 0;
      // 火龙冲锋长段火焰拖尾：五层粗火流（外焰→橙→黄→白芯），头部与身体同宽、向尾端渐细渐隐
      const cp = this.chargePts;
      if (cp && cp.length > 1) {
        const baseA = ctx.globalAlpha;
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const layers = [
          { w: 48, col: 'rgba(255,60,16,0.22)' },
          { w: 31, col: '#d8320c' },
          { w: 17, col: '#ff7a1c' },
          { w: 8, col: '#ffc24b' },
          { w: 3.5, col: '#fff3c8' }
        ];
        for (let i = 1; i < cp.length; i++) {
          const f0 = clamp(1 - cp[i - 1].age / 0.5, 0, 1);
          const f1 = clamp(1 - cp[i].age / 0.5, 0, 1);
          const fa = Math.min(f0, f1);
          const fw = 0.3 + 0.7 * f1 * (1 + 0.12 * Math.sin(this.t * 25 + i * 1.7));
          for (const L of layers) {
            ctx.globalAlpha = baseA * fa * 0.92;
            ctx.strokeStyle = L.col;
            ctx.lineWidth = L.w * fw;
            ctx.beginPath();
            ctx.moveTo(cp[i - 1].x, cp[i - 1].y);
            ctx.lineTo(cp[i].x, cp[i].y);
            ctx.stroke();
          }
        }
        ctx.restore();
        ctx.globalAlpha = baseA;
      }
      // huoyanshan-1.png 500×300 缩放 .5 → 250×150；躯干中心略偏左，右移 18 对齐
      drawBossSprite(ctx, Sprites.fireBlind, this.x + 18, this.y + bob + crouch, 0.5, 0.5, this.tilt, this.flash);
    }
  }

  /* ================ 紫手（紫色荒地限定，第1轮起出场） ================
   * 固定屏幕右侧小幅上下移动，偶尔瞬移；行为 a → b 循环：
   *  a：随机 ①3 发紫红扇形弹（红拖尾）②1 发高速直线狐火弹（紫焰拖尾）③投掷自转弧线巨型卡牌；
   *  b：4 张巨牌在四角浮现，短暂预警后依次向玩家发射紫红扇形弹。
   * 低血量（狂暴）：攻击节奏加快，角牌增至 6 张（左 3 右 3）。美术：huangyuan-1.png（500×300，已朝左） */
  class PurpleHand extends Boss {
    constructor(g) {
      super(g, 20, 48);
      this.bossName = '紫手';
      this.title = '幻狐卡师';
      this.x = CFG.W + 140;
      this.y = 190;
      this.homeX = CFG.W - 160;
      this.homeY = 190;
      this.mode = 'a';          // a（随机攻击） ↔ b（角牌齐射）
      this.sub = 'wind';
      this.subT = 0;
      this.ringCards = [];      // b 阶段角牌 {x,y,fired,flash,sp}
      this.bT = 0;
      this.teleT = 2.2;         // 瞬移计时
      this.teleFlash = 0;       // 瞬移后的残像闪烁
      this.face = -1;
      this.deathCols = ['#7a2bff', '#c06bff', '#ff5ad0', '#fff'];
      this.xpValue = 270;
    }

    update(dt, g) {
      this.t += dt; this.stateT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.teleFlash = Math.max(0, this.teleFlash - dt);
      this.commonMove(dt);

      if (this.state === 'enter') {
        this.x += (this.homeX - this.x) * Math.min(1, dt * 2.2);
        this.y += (this.homeY - this.y) * Math.min(1, dt * 2.2);
        if (Math.abs(this.x - this.homeX) < 14) {
          this.state = 'fight'; this.stateT = 0;
          this.beginA();
        }
        return;
      }
      if (this.state !== 'fight') return;

      // 右侧小幅上下移动（b 阶段角牌齐射时保持悬停）
      this.x += (this.homeX - this.x) * Math.min(1, dt * 3);
      this.y += (this.homeY + Math.sin(this.t * 1.9) * 16 - this.y) * Math.min(1, dt * 3);

      if (this.mode === 'a') this.updateA(dt, g);
      else this.updateB(dt, g);
    }

    get aWindTime() { return this.enraged ? 0.38 : 0.55; }
    get aWaitTime() { return this.enraged ? 0.62 : 1.0; }
    get bWarnTime() { return this.enraged ? 0.85 : 1.15; }
    get bStagger() { return this.enraged ? 0.26 : 0.34; }

    beginA() { this.mode = 'a'; this.sub = 'wind'; this.subT = 0; }

    updateA(dt, g) {
      const p = g.player;
      this.subT += dt;
      if (this.sub === 'wind') {
        if (this.subT > this.aWindTime) {
          this.doAttack(g, p);
          this.sub = 'wait'; this.subT = 0;
        }
      } else {
        // 等待期间偶尔瞬移
        this.teleT -= dt;
        if (this.teleT <= 0) {
          this.teleT = 2.2 + Math.random() * 1.4;
          if (Math.random() < 0.65) this.teleport(g);
        }
        if (this.subT > this.aWaitTime) this.startB(g);
      }
    }

    /** a 阶段：三选一随机攻击 */
    doAttack(g, p) {
      const mx = this.x - 70, my = this.y - 8;
      const pick = randi(0, 2);
      if (pick === 0) {
        // ① 3 发紫红扇形弹（红色拖尾）
        const base = Math.atan2(p.y - my, p.x - mx);
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.17;
          g.bullets.push(new Bullet(mx, my, Math.cos(a) * 265, Math.sin(a) * 265, {
            kind: 'purpleFan', r: 9, dmg: Math.round(11 * g.atkScale), life: 6,
            trailCols: ['#6a0a20', '#ff2a3a', '#ff7a6a', '#ffd0c0']
          }));
        }
        SFX.enemyShoot();
      } else if (pick === 1) {
        // ② 1 发高速直线狐火弹（紫色火焰拖尾）
        const a = Math.atan2(p.y - my, p.x - mx);
        g.bullets.push(new Bullet(mx, my, Math.cos(a) * 570, Math.sin(a) * 570, {
          kind: 'foxFire', r: 9, dmg: Math.round(14 * g.atkScale), life: 3.2,
          trailCols: ['#4a0a8a', '#9a3cff', '#c98aff', '#e9d0ff']
        }));
        SFX.enemyShoot();
      } else {
        // ③ 投掷巨大卡牌：自转 + 正弦弧线打向玩家
        const a = Math.atan2(p.y - my, p.x - mx);
        g.bullets.push(new Bullet(mx, my, Math.cos(a) * 300, Math.sin(a) * 300, {
          kind: 'pCard', r: 28, dmg: Math.round(16 * g.atkScale), life: 6,
          spinRate: 5, sine: { amp: 0.5, freq: 2.4, phase: rand(0, TAU) }
        }));
        SFX.enemyShoot();
      }
      burst(g, mx, my, 8, ['#7a2bff', '#c06bff', '#ff5ad0'], 160, 4, 0.35);
    }

    /** 瞬移到右侧另一高度（紫色魔光爆散） */
    teleport(g) {
      burst(g, this.x, this.y, 18, ['#7a2bff', '#c06bff', '#ff5ad0', '#fff'], 240, 6, 0.5);
      this.x = this.homeX + rand(-70, 50);
      this.y = rand(110, CFG.GROUND_Y - 110);
      this.teleFlash = 0.25;
      burst(g, this.x, this.y, 18, ['#7a2bff', '#c06bff', '#ff5ad0', '#fff'], 240, 6, 0.5);
      if (SFX.craneTele) SFX.craneTele();
    }

    /** b 阶段：四角（狂暴 6 张：左 3 右 3）巨牌浮现 */
    startB(g) {
      this.mode = 'b'; this.bT = 0;
      let pos;
      if (this.enraged) {
        const ys = [110, CFG.H / 2 - 15, CFG.GROUND_Y - 110];
        const L = ys.map(y => ({ x: 100, y }));
        const R = ys.map(y => ({ x: CFG.W - 100, y }));
        pos = [L[0], R[0], L[1], R[1], L[2], R[2]];   // 左右交替依次发射
      } else {
        pos = [
          { x: 120, y: 120 }, { x: CFG.W - 120, y: 120 },
          { x: 120, y: CFG.GROUND_Y - 120 }, { x: CFG.W - 120, y: CFG.GROUND_Y - 120 }
        ];
      }
      this.ringCards = pos.map((q, i) => ({ x: q.x, y: q.y, fired: false, flash: 0, sp: rand(0, TAU) + i }));
      g.toast(this.enraged ? '紫手张开了六牌阵！' : '紫手张开了卡牌阵！', 1.5, 'lt');
      SFX.phaseRise();
    }

    updateB(dt, g) {
      const p = g.player;
      this.bT += dt;
      const n = this.ringCards.length;
      this.ringCards.forEach((c, i) => {
        c.flash = Math.max(0, c.flash - dt);
        // 预警结束后各牌依次开火
        if (!c.fired && this.bT > this.bWarnTime + i * this.bStagger) {
          c.fired = true; c.flash = 0.2;
          this.fireCardFan(g, p, c);
        }
      });
      if (this.bT > this.bWarnTime + n * this.bStagger + 0.5) {
        // 阵散：紫光爆点后回到 a
        this.ringCards.forEach(c =>
          burst(g, c.x, c.y, 8, ['#7a2bff', '#c06bff', '#ff5ad0'], 180, 4, 0.4));
        this.ringCards = [];
        this.beginA();
      }
    }

    /** 角牌向当前玩家位置发射 3 发紫红扇形弹（红色拖尾） */
    fireCardFan(g, p, c) {
      const base = Math.atan2(p.y - c.y, p.x - c.x);
      for (let i = -1; i <= 1; i++) {
        const a = base + i * 0.21;
        g.bullets.push(new Bullet(c.x, c.y, Math.cos(a) * 255, Math.sin(a) * 255, {
          kind: 'purpleFan', r: 9, dmg: Math.round(11 * g.atkScale), life: 6,
          trailCols: ['#6a0a20', '#ff2a3a', '#ff7a6a', '#ffd0c0']
        }));
      }
      SFX.enemyShoot();
    }

    render(ctx) {
      // 角牌阵（画在 Boss 本体之下层）
      this.ringCards.forEach((c, i) => {
        const warning = !c.fired;
        const w = 30, h = 44;
        ctx.save();
        ctx.translate(c.x, c.y);
        const floatY = Math.sin(this.t * 2.4 + c.sp) * 5;
        ctx.translate(0, floatY);
        if (warning) {
          // 预警：红粉色脉动虚牌 + 感叹号
          const k = 0.5 + 0.5 * Math.sin(this.t * 13 + c.sp);
          ctx.globalAlpha = 0.45 + 0.4 * k;
          ctx.rotate(Math.sin(this.t * 3 + c.sp) * 0.08);
          ctx.shadowColor = 'rgba(255,60,140,0.9)'; ctx.shadowBlur = 18;
          ctx.fillStyle = '#3a0f33';
          roundCard(ctx, -w, -h, w * 2, h * 2, 8); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = `rgba(255,${Math.round(60 + 120 * k)},${Math.round(120 + 80 * k)},0.95)`;
          ctx.stroke();
          // 中心感叹号
          ctx.fillStyle = `rgba(255,${Math.round(90 + 120 * k)},120,0.95)`;
          ctx.fillRect(-2.5, -14, 5, 20);
          ctx.beginPath(); ctx.arc(0, 15, 3, 0, TAU); ctx.fill();
        } else {
          // 就绪/已开火：实体紫牌（开火瞬间白闪）
          ctx.shadowColor = 'rgba(200,80,255,0.9)'; ctx.shadowBlur = 14;
          ctx.fillStyle = c.flash > 0 ? '#4a2a6a' : '#2a1245';
          roundCard(ctx, -w, -h, w * 2, h * 2, 8); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.lineWidth = 2.5; ctx.strokeStyle = '#c04dff'; ctx.stroke();
          ctx.fillStyle = c.flash > 0 ? '#fff' : '#ff4fc0';
          ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 0); ctx.lineTo(0, 13); ctx.lineTo(-9, 0);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      });
      const bob = Math.sin(this.t * 2.6) * 4;
      // huangyuan-1.png 500×300 缩放 .46 → 230×138；狐身偏左，右移 34 对齐碰撞中心
      drawBossSprite(ctx, Sprites.purpleHand, this.x + 34, this.y + bob, 0.46, 0.46, 0, this.flash);
      // 瞬移残像：紫白光环
      if (this.teleFlash > 0) {
        const a = this.teleFlash / 0.25;
        ctx.save();
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = '#d08aff';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x + 34, this.y, 40 + (1 - a) * 46, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** 紫手角牌圆角矩形路径（bosses.js 局部助手） */
  function roundCard(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  window.Bosses = { PigKing, ThunderBehemoth, Samurai, SwordEagle, SkullKing, DogKing, GiantPheasant, Homelander, BossMan, Stranger, FrogKing, CraneSage, Sphinx, NiuMo, BoneDragonKing, MadHyena, RaccoonRover, SandWalker, CaptainGeorge, FireBlind, PurpleHand, SeaBully, SnowWitch, CrowCount };
  /**
   * Boss 池：所有 Boss 等权（weight 相同），每一轮都可能出现。
   * 本局已出场过的 Boss 后续抽取权重持续减半（game.js bossSeen 加权抽取）；
   * 当所有非地图专属 Boss 全部轮过一遍后清空记录，概率恢复正常。
   * ground：地面移动型（大海地图不出场）；map：地图永久限定（专属 Boss 仅在本图出场）。
   * 地图专属 Boss（狮身人面像/牛魔/骨龙王）出场规则：
   *   minOrd 之前不出场；forceChance 声明的轮次为强制概率轮（独立掷骰，命中直接出场、
   *   未命中本轮不入随机池）；离开强制轮后无论是否命中过，都拉平为等权普通池成员、可反复出场，
   *   但地图限定永久生效（无 maxOrd、无每局单次限制）。
   */
  window.BOSS_LIST = [
    { cls: PigKing, weight: 3, music: 'boss-1' },          // 火焰飞猪王
    { cls: ThunderBehemoth, weight: 3, music: 'boss-1' }, // 雷公巨兽
    { cls: Samurai, weight: 3, music: 'boss-wushi' },     // 飞天日本武士
    { cls: SwordEagle, weight: 3, music: 'boss-ying' },   // 铁鹰
    { cls: SkullKing, weight: 3, music: 'boss-2' },       // 亡灵骷髅王
    { cls: DogKing, weight: 3, music: 'boss-1' },         // 飞天狗王
    { cls: GiantPheasant, weight: 3, ground: true, music: 'boss-1' },  // 火鸡王：地面突击型
    { cls: Homelander, weight: 3, music: 'boss-2' },      // 怒星使
    { cls: BossMan, weight: 3, music: 'boss-fuwang' },    // 斧王
    { cls: Stranger, weight: 3, music: 'boss-2' },        // 怪客
    { cls: FrogKing, weight: 3, ground: true, music: 'boss-2' },  // 蛙哥：地面巨兽
    { cls: CraneSage, weight: 3, music: 'boss-hexian' },  // 鹤仙：五技特殊型
    // 狮身人面像：沙漠永久限定（map）；第1轮50%/第2轮70%独立强制出场，
    // 强制轮后（无论是否命中过）拉平为沙漠普通池等权成员，可反复出场
    { cls: Sphinx, weight: 3, minOrd: 1, map: 'desert',
      forceChance: { 1: 0.5, 2: 0.7 }, music: 'boss-shishenrenmian' },
    // 牛魔：草原永久限定（map）；第2轮60%/第3轮70%/第4轮80%独立强制出场，
    // 强制轮后（无论是否命中过）拉平为草原普通池等权成员，可反复出场
    { cls: NiuMo, weight: 3, map: 'grassland', minOrd: 2,
      forceChance: { 2: 0.6, 3: 0.7, 4: 0.8 }, music: 'boss-niumowang' },
    // 巨型骨龙王：荒地永久限定（map）；第2轮70%/第3轮80%独立强制出场，
    // 强制轮后（无论是否命中过）拉平为荒地普通池等权成员，可反复出场
    { cls: BoneDragonKing, weight: 3, map: 'wasteland', minOrd: 2,
      forceChance: { 2: 0.7, 3: 0.8 }, music: 'boss-gulongwang' },
    // —— 新批次地图限定 Boss（癫狂鬣狗起，共 9 只）：debutChance 0.9 ——
    // 本局首次登场前为首秀状态：地图限定永久生效，仅在该 Boss 专属地图预警时纳入随机顺序独立掷骰 90%；
    // 该只登场（bossSeen 登记）后，仅它自己在本图拉平入普通池；其余未登场新 Boss 仍保持 90%
    // 癫狂鬣狗：草原永久限定（map）
    { cls: MadHyena, weight: 3, map: 'grassland', ground: true, debutChance: 0.9, music: 'boss-1' },
    // 浣熊漫游者：霓虹喵都永久限定（map）
    { cls: RaccoonRover, weight: 3, map: 'cyber', debutChance: 0.9, music: 'boss-2' },
    // 沙之行者：沙漠永久限定（map）
    { cls: SandWalker, weight: 3, map: 'desert', debutChance: 0.9, music: 'boss-1' },
    // 乔治船长：大海永久限定（map），炮击→俯冲循环，低血狂暴炮击5发/俯冲加速
    { cls: CaptainGeorge, weight: 3, map: 'ocean', debutChance: 0.9, music: 'boss-1' },
    // 火遮眼：火焰山永久限定（map），火焰斩→火龙冲锋循环，狂暴3道窄斩
    { cls: FireBlind, weight: 3, map: 'volcano', debutChance: 0.9, music: 'boss-1' },
    // 紫手：紫色荒地永久限定（map）；a随机攻击↔b角牌阵，狂暴6牌
    { cls: PurpleHand, weight: 3, map: 'wasteland', debutChance: 0.9, music: 'boss-2' },
    // 深海恶霸：深海永久限定（map）；追踪水鲨/炸弹3环冲击波/90°转向铁钩链，66%血鲨鱼围猎高潮
    { cls: SeaBully, weight: 3, map: 'seabed', debutChance: 0.9, music: 'boss-1' },
    // 雪巫：雪地永久限定（map）；冰晶雨密度循环/冰环环心安全，66%血冰霜风暴三段连打
    { cls: SnowWitch, weight: 3, map: 'snow', debutChance: 0.9, music: 'boss-2' },
    // 鸦伯爵：城堡永久限定（map）；瞬移躲玩家（10s CD）+宝石三档弹道反转（飞掷前慢后快/回旋去回/珠宝盗窃两组交叉）
    { cls: CrowCount, weight: 3, map: 'castle', debutChance: 0.9, music: 'boss-2' }
  ];
})();
