/* ============================================================
 * hazards.js — 新地图特殊机关（统一调度 / Boss 与怪物潮期间停用）
 *   current   海底纵向下行水流（可逆向游动对抗）
 *   blizzard  雪地斜向暴风雪（右上→左下，向下向左推压）
 *   lightning 天空斜向落雷（预警后劈落，途径者损失一半当前生命）
 *   caveblock 仙人洞移动方石（中部出现，沿固定路线环行并随卷轴左移）
 *   datawall  矩阵移动数据墙（实体 2s / 虚拟 2s，实体接触损失 80% 当前生命）
 * 对外接口（由 game.js 调用）：
 *   FT.Hazards.reset(g) / startRound(g) / tick(g,dt) / render(g,ctx)
 * ============================================================ */
(function () {
  const { Particle, burst, rand, randi, clamp } = window.FT;
  const HZ = () => CFG.map.haz;

  /** 点到线段距离 */
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = clamp(t, 0, 1);
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  }
  /** 斜线参数（右上→左下）：给定 y 返回线上 x；x1 为顶端（y=TOP-20）x，水平落差 D */
  function diagX(y, x1) {
    const f = (y - (CFG.TOP_Y - 20)) / ((CFG.GROUND_Y + 20) - (CFG.TOP_Y - 20));
    return x1 - 380 * f;
  }

  const Hazards = {};

  Hazards.reset = (g) => { g.hz = null; g.envForce = { x: 0, y: 0 }; };

  /** 每张地图进入 / 每轮 Boss 击败后：按地图机关配置排定本轮触发时刻（刷怪段内、Boss 前） */
  Hazards.startRound = (g) => {
    g.envForce = g.envForce || { x: 0, y: 0 };
    g.envForce.x = 0; g.envForce.y = 0;
    const haz = g.map && g.map.haz;
    if (!haz) { g.hz = null; return; }
    const [a, b] = haz.n;
    const cnt = randi(a, b + 1);
    const times = [];
    for (let i = 0; i < cnt; i++) times.push(rand(6, 34));
    times.sort((x, y) => x - y);
    g.hz = { type: haz.type, t: 0, queue: times, active: null, solids: [], suppressed: false };
  };

  /** Boss/怪物潮出现：立即撤除场上移动机关，进行中的力场也立即结束 */
  Hazards.clearMoving = (g) => {
    if (!g.hz) return;
    g.hz.solids.length = 0;
    g.hz.active = null;
    g.envForce.x = 0; g.envForce.y = 0;
  };

  /* ---------------- 触发 ---------------- */

  function spawnEvent(g, hz) {
    const C = HZ();
    switch (hz.type) {
      case 'current':
        hz.active = { kind: 'current', x: rand(170, CFG.W - 170), t: 0 };
        g.toast('🌊 下行水流！向上游对抗！', 2.0);
        break;
      case 'blizzard':
        hz.active = { kind: 'blizzard', x: CFG.W + 120, t: 0 };
        g.toast('❄️ 斜向暴风雪！', 2.0);
        break;
      case 'lightning':
        hz.active = { kind: 'lightning', sx: rand(CFG.W * 0.45, CFG.W + 30), t: 0, hit: false };
        g.toast('⚡ 落雷预警！离开斜线！', 2.0);
        break;
      case 'caveblock':
        hz.solids.push(makeCaveBlock());
        if (hz.solids.length === 1) g.toast('⬜ 移动方石！注意路线！', 2.0);
        break;
      case 'datawall':
        if (!hz.solids.some(s => s.kind === 'datawall')) {
          hz.solids.push(makeDataWall());
          g.toast('🟩 数据墙！实体时避开，虚影可穿过！', 2.2);
        }
        break;
    }
  }

  /* ---------------- 仙人洞方石 ---------------- */

  const ROUTES = [
    // 逆时针方形
    [[0, -78], [-78, -78], [-78, 78], [0, 78]],
    // 逆时针连续折线（阶梯环行）
    [[0, -90], [-50, -90], [-50, -30], [-105, -30], [-105, 40], [-45, 40], [-45, 90], [0, 90]],
    // 直角三角形
    [[0, -80], [-95, 68], [0, 68]],
    // 等边三角形
    [[0, -78], [-68, 40], [68, 40]]
  ];

  function makeCaveBlock() {
    const pts = ROUTES[randi(0, ROUTES.length - 1)];
    // 预计算周长分段
    const seg = [];
    let total = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      seg.push({ a, b, l, start: total });
      total += l;
    }
    return {
      kind: 'caveblock',
      ax: rand(CFG.W * 0.32, CFG.W * 0.68), ay: rand(170, 370),
      s: rand(58, 82), u: 0, seg, total, dead: false
    };
  }
  function blockPos(b) {
    const d = b.u * b.total;
    let s = b.seg[0];
    for (const q of b.seg) if (d >= q.start) s = q;
    const t = clamp((d - s.start) / s.l, 0, 1);
    return { x: b.ax + s.a[0] + (s.b[0] - s.a[0]) * t, y: b.ay + s.a[1] + (s.b[1] - s.a[1]) * t };
  }
  function updateCaveBlock(g, b, dt) {
    b.ax -= 62 * dt * (g.map.scrollMul || 1);   // 随玩家推进逐渐左移直至屏外
    b.u = (b.u + dt / HZ().caveblock.loop) % 1;
    if (b.ax < -180) { b.dead = true; return; }
    const p = blockPos(b), h = b.s / 2;
    const pl = g.player;
    // 撞击玩家：损失 30% 最大生命并弹开（方石不毁）
    if (pl.hp > 0 && pl.invT <= 0 &&
      Math.abs(pl.x - p.x) < h + pl.radius * 0.6 && Math.abs(pl.y - p.y) < h + pl.radius * 0.6) {
      pl.hurt(Math.round(pl.maxHp * 0.3), g, { k: 'env', key: 'caveblock' });
      pl.x += (pl.x < p.x ? -1 : 1) * 44;
      pl.y = clamp(pl.y + (pl.y < b.ay ? -40 : 40), CFG.TOP_Y, CFG.GROUND_Y - 20);
      burst(g, pl.x, pl.y, 16, ['#ffffff', '#b8d8e0', '#7fc8d8'], 300, 5, 0.45, 160);
    }
    // 飞行小怪撞上坠毁（地面单位 / Boss 不受影响）
    for (const e of g.enemies) {
      if (e.dead || e.groundUnit || e.isBoss) continue;
      if (Math.abs(e.x - p.x) < h + e.radius * 0.7 && Math.abs(e.y - p.y) < h + e.radius * 0.7) {
        burst(g, e.x, e.y, 16, ['#ffffff', '#b8d8e0', '#7fc8d8'].concat(e.deathColors ? e.deathColors() : []), 250, 5, 0.6, 220);
        e.die(g);
      }
    }
  }

  /* ---------------- 矩阵数据墙 ---------------- */

  function makeDataWall() {
    const C = HZ().datawall;
    return {
      kind: 'datawall',
      x: C.w / 2 + 8, t: 0,
      gap: ['top', 'bottom', 'center'][randi(0, 2)],
      solid: false, phaseT: 0, warned: false, hit: new Set(), dead: false
    };
  }
  /** 数据墙实体覆盖的纵向区间数组（口子之外全覆盖） */
  function wallSpans(w) {
    const C = HZ().datawall, T = CFG.TOP_Y, G = CFG.GROUND_Y, gh = C.gap;
    const mid = (T + G) / 2;
    if (w.gap === 'top') return [[T + gh, G]];
    if (w.gap === 'bottom') return [[T, G - gh]];
    return [[T, mid - gh / 2], [mid + gh / 2, G]];
  }
  function updateDataWall(g, w, dt) {
    const C = HZ().datawall;
    w.t += dt;
    if (!w.warned && w.t >= C.warn) { w.warned = true; w.solid = true; w.phaseT = 0; }
    if (w.warned) {
      // 世界卷轴会把静止物体带向左侧，叠加卷轴速度保证墙体相对屏幕持续向右
      w.x += (C.vx + 62 * (g.map.scrollMul || 1)) * dt;
      w.phaseT += dt;
      if (w.phaseT >= C.phase) {
        w.phaseT = 0;
        w.solid = !w.solid;
        if (w.solid) w.hit.clear();          // 新一轮实体：可再次命中
      }
      // 扫描粒子
      if (Math.random() < dt * 14) {
        const spans = wallSpans(w);
        const sp = spans[randi(0, spans.length - 1)];
        g.particles.push(new Particle(w.x + rand(-C.w / 2, C.w / 2), rand(sp[0], sp[1]),
          rand(-40, 20), rand(-30, 30), rand(0.3, 0.6), rand(2, 4),
          Math.random() < 0.8 ? '#35ff9e' : '#35e0ff'));
      }
      if (w.solid) collideDataWall(g, w);
    }
    if (w.x > CFG.W + C.w) w.dead = true;
  }
  function collideDataWall(g, w) {
    const C = HZ().datawall;
    const spans = wallSpans(w);
    const inWallX = (tx, tr) => Math.abs(tx - w.x) < C.w / 2 + tr * 0.7;
    const inWallY = ty => spans.some(sp => ty > sp[0] - 8 && ty < sp[1] + 8);
    const dmgRatio = C.ratio;
    // 玩家
    const p = g.player;
    if (p.hp > 0 && !w.hit.has(p) && inWallX(p.x, p.radius) && inWallY(p.y)) {
      w.hit.add(p);
      p.hurt(Math.max(1, Math.ceil(p.hp * dmgRatio)), g, { k: 'env', key: 'datawall' });
      p.x = Math.max(40, p.x - 34);
      burst(g, p.x, p.y, 22, ['#35ff9e', '#a8ffd8', '#35e0ff', '#fff'], 340, 6, 0.5, 200);
      g.shake(8);
    }
    // 敌人 / Boss（入场/转场免伤）
    g.targets().forEach(e => {
      if (e.dead || w.hit.has(e)) return;
      if (e.isBoss && (e.state === 'enter' || e.state === 'trans' || e.state === 'phaseTrans')) return;
      if (inWallX(e.x, e.radius || 16) && inWallY(e.y)) {
        w.hit.add(e);
        e.takeDamage(Math.max(1, Math.ceil(e.hp * dmgRatio)), g, { x: -200, y: 0 });
        burst(g, e.x, e.y, 18, ['#35ff9e', '#a8ffd8', '#35e0ff'], 300, 5, 0.5, 180);
      }
    });
  }

  /* ---------------- 落雷伤害 ---------------- */

  function strikeLightning(g, ev) {
    const C = HZ().lightning;
    const targets = [{ x: g.player.x, y: g.player.y, r: g.player.radius, player: true }];
    g.targets().forEach(e => {
      if (e.dead) return;
      if (e.isBoss && (e.state === 'enter' || e.state === 'trans' || e.state === 'phaseTrans')) return;
      targets.push({ x: e.x, y: e.y, r: e.radius || 16, e });
    });
    for (const t of targets) {
      if (segDist(t.x, t.y, ev.sx, CFG.TOP_Y - 20, ev.sx - 380, CFG.GROUND_Y + 20) > C.band + t.r) continue;
      const dmg = Math.max(1, Math.ceil((t.player ? g.player.hp : t.e.hp) * C.ratio));
      if (t.player) {
        if (g.player.hp > 0) g.player.hurt(dmg, g, { k: 'env', key: 'lightning' });
      } else {
        t.e.takeDamage(dmg, g, { x: t.x - ev.sx + 190, y: -120 });
      }
      burst(g, t.x, t.y, 24, ['#fff7b0', '#fff08a', '#ffffff', '#c8b8ff'], 360, 7, 0.5, 220);
    }
    g.shake(9);
    g.flashT = Math.max(g.flashT, 0.16);
    g.flashColor = '#f4ffd8';
    if (window.SFX && SFX.explode) SFX.explode(false);
  }

  /* ---------------- 主更新 ---------------- */

  Hazards.tick = (g, dt) => {
    g.envForce.x = 0; g.envForce.y = 0;
    const hz = g.hz;
    if (!hz) return;
    const playing = g.state === 'playing';
    // 移动实体任何状态都先更新坐标/寿命（菜单预览不更新）
    if (playing) {
      for (const s of hz.solids) {
        if (s.kind === 'caveblock') updateCaveBlock(g, s, dt);
        else updateDataWall(g, s, dt);
      }
      hz.solids = hz.solids.filter(s => !s.dead);
    }
    if (!playing) return;
    // Boss / 怪物潮：不触发新机关，进行中力场撤除，移动实体已在出现瞬间被清空
    const suppressed = !!(g.bossActive || g.isTide);
    if (suppressed) {
      if (!hz.suppressed) Hazards.clearMoving(g);
      hz.suppressed = true;
      return;
    }
    hz.suppressed = false;
    hz.t += dt;
    while (hz.queue.length && hz.t >= hz.queue[0]) { hz.queue.shift(); spawnEvent(g, hz); }

    const ev = hz.active;
    if (!ev) return;
    const C = HZ();
    ev.t += dt;
    const p = g.player;
    if (ev.kind === 'current') {
      const cc = C.current;
      if (ev.t >= cc.warn && ev.t < cc.warn + cc.dur) {
        if (Math.abs(p.x - ev.x) < cc.w / 2) g.envForce.y = cc.fy;
        // 气泡 + 下行流线
        if (Math.random() < dt * 18) {
          g.particles.push(new Particle(ev.x + rand(-cc.w / 2, cc.w / 2), rand(CFG.TOP_Y, CFG.TOP_Y + 60),
            rand(-12, 12), rand(120, 200), rand(0.3, 0.7), rand(2, 5), '#bfe8f0'));
        }
      }
      if (ev.t >= cc.warn + cc.dur) hz.active = null;
    } else if (ev.kind === 'blizzard') {
      const cb = C.blizzard;
      if (ev.t >= cb.warn) {
        ev.x -= cb.vx * dt;
        // 斜向雪带：在玩家高度上的带中心
        const f = (p.y - (CFG.TOP_Y - 20)) / ((CFG.GROUND_Y + 20) - (CFG.TOP_Y - 20));
        const cx = ev.x - 380 * f;
        if (Math.abs(p.x - cx) < 160) { g.envForce.x = cb.fx; g.envForce.y = cb.fy; }
        if (Math.random() < dt * 40) {
          const sy = rand(CFG.TOP_Y, CFG.GROUND_Y);
          const sf2 = (sy - (CFG.TOP_Y - 20)) / ((CFG.GROUND_Y + 20) - (CFG.TOP_Y - 20));
          g.particles.push(new Particle(diagX(sy, ev.x) + rand(-150, 150), sy,
            -rand(260, 380), rand(120, 200), rand(0.3, 0.6), rand(2, 4),
            Math.random() < 0.7 ? '#eaf4ff' : '#bcd8f0'));
        }
      }
      if (ev.x < -460 || ev.t >= cb.warn + cb.dur) hz.active = null;
    } else if (ev.kind === 'lightning') {
      const cl = C.lightning;
      if (!ev.hit && ev.t >= cl.warn) { ev.hit = true; ev.hitT = 0; strikeLightning(g, ev); }
      if (ev.hit) { ev.hitT += dt; if (ev.hitT > cl.strike) hz.active = null; }
    }
  };

  /* ---------------- 渲染 ---------------- */

  Hazards.render = (g, ctx) => {
    const hz = g.hz;
    if (!hz) return;
    // 移动实体（方石 / 数据墙）
    for (const s of hz.solids) {
      if (s.kind === 'caveblock') renderCaveBlock(ctx, s);
      else renderDataWall(ctx, s);
    }
    const ev = hz.active;
    if (!ev) return;
    const C = HZ();
    if (ev.kind === 'current') renderCurrent(ctx, ev, C.current);
    else if (ev.kind === 'blizzard') renderBlizzard(ctx, ev, C.blizzard);
    else if (ev.kind === 'lightning') renderLightning(ctx, ev, C.lightning);
  };

  function renderCurrent(ctx, ev, c) {
    const active = ev.t >= c.warn;
    const a = active ? 0.30 : 0.12 + 0.1 * Math.sin(ev.t * 18);
    ctx.save();
    ctx.fillStyle = 'rgba(70,170,220,' + a + ')';
    ctx.fillRect(ev.x - c.w / 2, CFG.TOP_Y, c.w, CFG.GROUND_Y - CFG.TOP_Y);
    // 边缘流光线
    ctx.strokeStyle = 'rgba(190,235,255,' + (active ? 0.8 : 0.4) + ')';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]); ctx.lineDashOffset = -performance.now() / 100 * (active ? 3 : 1);
    ctx.strokeRect(ev.x - c.w / 2, CFG.TOP_Y, c.w, CFG.GROUND_Y - CFG.TOP_Y);
    ctx.setLineDash([]);
    if (active) {
      // 下行箭头
      ctx.fillStyle = 'rgba(220,245,255,0.85)';
      const t = performance.now() / 100;
      for (let i = 0; i < 4; i++) {
        const yy = CFG.TOP_Y + ((t * 3 + i * 110) % (CFG.GROUND_Y - CFG.TOP_Y));
        const cx = ev.x;
        ctx.beginPath();
        ctx.moveTo(cx - 12, yy); ctx.lineTo(cx + 12, yy); ctx.lineTo(cx, yy + 16);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  function renderBlizzard(ctx, ev, c) {
    const active = ev.t >= c.warn;
    ctx.save();
    // 斜向半透明风带（平行四边形）
    const x1 = ev.x;
    ctx.fillStyle = active ? 'rgba(214,232,248,0.22)' : 'rgba(214,232,248,0.08)';
    ctx.beginPath();
    ctx.moveTo(x1, CFG.TOP_Y - 20);
    ctx.lineTo(x1 - 380, CFG.GROUND_Y + 20);
    ctx.lineTo(x1 - 680, CFG.GROUND_Y + 20);
    ctx.lineTo(x1 - 300, CFG.TOP_Y - 20);
    ctx.closePath(); ctx.fill();
    if (!active) {
      // 预警：沿斜线的闪烁雪晶标记
      ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.4 * Math.sin(ev.t * 16)) + ')';
      ctx.font = '22px serif'; ctx.textAlign = 'center';
      for (let i = 0; i < 5; i++) {
        const y = CFG.TOP_Y + 30 + i * 88;
        ctx.fillText('❄', diagX(y, x1), y);
      }
    }
    ctx.restore();
  }

  function renderLightning(ctx, ev, c) {
    ctx.save();
    const ax = ev.sx, ay = CFG.TOP_Y - 20, bx = ev.sx - 380, by = CFG.GROUND_Y + 20;
    if (!ev.hit) {
      // 预警虚线 + 两端警示
      const a = 0.4 + 0.4 * Math.sin(ev.t * 20);
      ctx.strokeStyle = 'rgba(255,240,138,' + a + ')';
      ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
      ctx.font = '24px serif'; ctx.textAlign = 'center';
      ctx.fillText('⚡', ax, CFG.TOP_Y + 14);
      ctx.fillText('⚡', bx, CFG.GROUND_Y - 6);
    } else {
      // 劈落：锯齿状亮雷
      const k = ev.hitT / c.strike;
      ctx.globalAlpha = 1 - k * 0.5;
      ctx.strokeStyle = '#fff7b0'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath();
      const segs = 9;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = ax + (bx - ax) * t + (i ? rand(-16, 16) : 0);
        const y = ay + (by - ay) * t;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
  }

  function renderCaveBlock(ctx, b) {
    const p = blockPos(b), h = b.s / 2;
    ctx.save();
    // 白色方石本体
    ctx.shadowColor = 'rgba(127,200,216,0.8)'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#f2f6fa';
    ctx.fillRect(p.x - h, p.y - h, b.s, b.s);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x - h, p.y - h, b.s, 7);
    ctx.fillStyle = '#c8d2dc';
    ctx.fillRect(p.x - h, p.y + h - 7, b.s, 7);
    ctx.strokeStyle = '#7fc8d8'; ctx.lineWidth = 2;
    ctx.strokeRect(p.x - h + 1, p.y - h + 1, b.s - 2, b.s - 2);
    // 中心菱形（随环行轻微旋转感：用缩放替代）
    const rr = b.s * 0.24;
    ctx.strokeStyle = 'rgba(90,160,180,0.9)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - rr); ctx.lineTo(p.x + rr, p.y);
    ctx.lineTo(p.x, p.y + rr); ctx.lineTo(p.x - rr, p.y);
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }

  function renderDataWall(ctx, w) {
    const C = HZ().datawall;
    const spans = wallSpans(w);
    ctx.save();
    const entering = !w.warned;
    const k = entering ? clamp(w.t / C.warn, 0, 1) : 1;
    const alpha = entering ? 0.25 + 0.35 * Math.abs(Math.sin(w.t * 14)) : (w.solid ? 0.82 : 0.22);
    for (const sp of spans) {
      const y0 = sp[0], hgt = sp[1] - sp[0];
      // 墙体填充
      ctx.fillStyle = w.solid ? 'rgba(10,60,38,' + alpha + ')' : 'rgba(10,40,30,' + alpha + ')';
      ctx.fillRect(w.x - C.w / 2, y0, C.w, hgt);
      // 荧光边框
      ctx.strokeStyle = w.solid ? 'rgba(53,255,158,' + (0.55 + k * 0.4) + ')' : 'rgba(53,255,158,0.35)';
      ctx.lineWidth = w.solid ? 3 : 2;
      ctx.strokeRect(w.x - C.w / 2, y0, C.w, hgt);
      // 横向代码扫描线
      ctx.fillStyle = w.solid ? 'rgba(53,255,158,0.85)' : 'rgba(53,255,158,0.4)';
      for (let y = y0 + 8 + (Math.floor(performance.now() / 300) % 12); y < sp[1] - 4; y += 16) {
        ctx.fillRect(w.x - C.w / 2 + 6, y, C.w - 12, 2);
        const lw = 8 + ((Math.floor(y * 7 + w.x) % 28));
        ctx.fillRect(w.x - C.w / 2 + 6, y + 4, lw, 3);
      }
      // 口子边缘发光箭头
      ctx.fillStyle = 'rgba(168,255,216,0.9)';
      ctx.font = '13px monospace'; ctx.textAlign = 'center';
      const markerY = sp === spans[0] ? sp[1] - 4 : sp[0] + 10;
      if (w.gap === 'center') { ctx.fillText(sp === spans[0] ? '▲' : '▼', w.x, sp === spans[0] ? sp[1] - 4 : sp[0] + 12); }
      else { ctx.fillText(w.gap === 'top' ? '▲' : '▼', w.x, w.gap === 'top' ? sp[0] + 12 : markerY); }
    }
    // 实体/虚拟状态字
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = w.solid ? '#35ff9e' : 'rgba(53,255,158,0.6)';
    ctx.fillText(w.solid ? '实体' : '虚拟', w.x, CFG.TOP_Y + 14);
    ctx.restore();
  }

  window.FT.Hazards = Hazards;
})();
