/* ============================================================
 * game.js —— 主循环 / 背景 / 刷怪 / 成长 / Boss 调度 / 碰撞
 * ============================================================ */
(function () {
  'use strict';

  const { Player, Enemy, Gem, Bullet, Particle, Rock, GrassDragon, burst, rand, randi, clamp } = window.FT;
  const TAU = Math.PI * 2;

  class Game {
    constructor() {
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      this.keys = { up: false, down: false, left: false, right: false };
      this.state = 'menu';
      this.bindInput();
      this.buildBackground();
      this.fitWrap();
      window.addEventListener('resize', () => this.fitWrap());

      // DOM
      this.el = {
        hud: document.getElementById('hud'),
        hpBar: document.getElementById('hp-bar'),
        hpText: document.getElementById('hp-text'),
        xpBar: document.getElementById('xp-bar'),
        xpText: document.getElementById('xp-text'),
        rageBar: document.getElementById('rage-bar'),
        rageText: document.getElementById('rage-text'),
        rageBox: document.getElementById('rage-box'),
        roundText: document.getElementById('round-text'),
        levelText: document.getElementById('level-text'),
        scoreText: document.getElementById('score-text'),
        livesText: document.getElementById('lives-text'),
        meleeCd: document.getElementById('melee-cd'),
        meleeIcon: document.getElementById('melee-icon'),
        bossHud: document.getElementById('boss-hud'),
        bossBar: document.getElementById('boss-bar'),
        bossName: document.getElementById('boss-name'),
        warn: document.getElementById('boss-warn'),
        warnSub: document.getElementById('warn-sub'),
        levelup: document.getElementById('levelup'),
        luCards: document.getElementById('lu-cards'),
        menu: document.getElementById('menu'),
        pause: document.getElementById('pause'),
        gameover: document.getElementById('gameover'),
        goStats: document.getElementById('go-stats'),
        muteBtn: document.getElementById('mute-btn'),
        bgmBtn: document.getElementById('bgm-btn'),
        menuBgmBtn: document.getElementById('menu-bgm-btn'),
        modeKeyboard: document.getElementById('mode-keyboard'),
        modeMouse: document.getElementById('mode-mouse'),
        menuMapBtn: document.getElementById('menu-map-btn')
      };
      // 按钮统一走 onClick 安全绑定：元素缺失（如浏览器缓存了旧版 HTML）时仅跳过并告警，
      // 绝不能让构造函数中断——否则 reset()/主循环不启动，背景音乐与音效会全部静默
      this.onClick('start-btn', () => this.start());
      this.onClick('restart-btn', () => this.start());
      this.onClick('menu-map-btn', () => this.cycleMapChoice());
      this.syncMapBtns();
      this.onClick('mute-btn', () => this.toggleMute());
      this.onClick('bgm-btn', () => this.toggleBgm());
      this.onClick('menu-bgm-btn', () => this.toggleBgm());
      this.syncBgmBtn();
      // 操作模式选择（菜单）
      this.ctrlMode = 'keyboard';
      this.onClick('mode-keyboard', () => this.setCtrlMode('keyboard'));
      this.onClick('mode-mouse', () => this.setCtrlMode('mouse'));

      // 地图选择偏好（'random' 或具体地图 id）：从 localStorage 恢复
      try {
        const saved = localStorage.getItem('flytiger_map');
        this.mapChoice = (saved === 'random' || (saved && CFG.maps.some(m => m.id === saved))) ? saved : 'random';
      } catch (e) { this.mapChoice = 'random'; }

      this.reset();
      this.last = performance.now();
      requestAnimationFrame(t => this.loop(t));
    }

    /** 画布按窗口等比缩放 */
    fitWrap() {
      const wrap = document.getElementById('game-wrap');
      const s = Math.min(window.innerWidth / CFG.W, window.innerHeight / CFG.H);
      wrap.style.transform = `translate(-50%, -50%) scale(${s})`;
    }

    /** 安全绑定点击：元素不存在（旧缓存 HTML / 新版缺节点）时跳过并告警，避免构造函数整体崩溃 */
    onClick(id, fn) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
      else console.warn('[flytiger] 缺少按钮节点，已跳过绑定: #' + id);
    }

    /* ---------------- 输入 ---------------- */
    bindInput() {
      const map = {
        ArrowUp: 'up', KeyW: 'up',
        ArrowDown: 'down', KeyS: 'down',
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right'
      };
      window.addEventListener('keydown', e => {
        if (map[e.code]) { this.keys[map[e.code]] = true; e.preventDefault(); }
        if (e.code === 'Space' || e.code === 'Enter') {
          if (this.state === 'menu' || this.state === 'gameover') this.start();
          else if (this.state === 'playing' && e.code === 'Space') this.player.tryUltimate(this);
          e.preventDefault();
        }
        if (e.code === 'KeyJ' && this.state === 'playing') this.player.tryUltimate(this);
        if (e.code === 'KeyP' && (this.state === 'playing' || this.state === 'paused')) this.togglePause();
        if (e.code === 'KeyM') this.toggleMute();
        if (e.code === 'KeyN') this.toggleBgm();
        if (this.state === 'levelup' && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')) {
          const idx = e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : 2;
          if (this.pendingOptions[idx]) this.pickUpgrade(idx);
        }
      });
      window.addEventListener('keyup', e => {
        if (map[e.code]) this.keys[map[e.code]] = false;
      });

      // 鼠标控制：移动鼠标引导飞虎飞行（键盘操作优先；坐标按画布缩放自动换算）
      this.mouse = { x: CFG.W / 2, y: CFG.H / 2, active: false };
      window.addEventListener('mousemove', e => {
        const rect = this.canvas.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom) return;
        this.mouse.x = (e.clientX - rect.left) / rect.width * CFG.W;
        this.mouse.y = (e.clientY - rect.top) / rect.height * CFG.H;
        this.mouse.active = true;
      });

      // 首次交互解锁音频（浏览器自动播放策略）：菜单背景音乐随手势启动
      const unlockAudio = () => { SFX.unlock(); if (window.Music) Music.unlock(); };
      window.addEventListener('pointerdown', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
    }

    toggleMute() {
      const m = !SFX.isMuted();
      SFX.setMuted(m);
      if (this.el.muteBtn) this.el.muteBtn.textContent = m ? '音效 关' : '音效 开';
    }

    /** 切换背景音乐开/关（HUD 按钮、菜单按钮、N 键共用） */
    toggleBgm() {
      if (!window.Music) return;
      Music.setMuted(!Music.isMuted());
      this.syncBgmBtn();
    }

    /** 按当前静音状态同步两处按钮文案 */
    syncBgmBtn() {
      const m = window.Music ? Music.isMuted() : false;
      if (this.el.bgmBtn) this.el.bgmBtn.textContent = m ? '音乐 关' : '音乐 开';
      if (this.el.menuBgmBtn) {
        this.el.menuBgmBtn.textContent = m ? '🎵 背景音乐：关' : '🎵 背景音乐：开';
        this.el.menuBgmBtn.classList.toggle('off', m);
      }
    }

    /** 切换操作模式（菜单选择，战斗中不可改） */
    setCtrlMode(mode) {
      this.ctrlMode = mode;
      if (this.el.modeKeyboard) this.el.modeKeyboard.classList.toggle('active', mode === 'keyboard');
      if (this.el.modeMouse) this.el.modeMouse.classList.toggle('active', mode === 'mouse');
      SFX.pick();
    }

    togglePause() {
      if (this.state === 'playing') {
        this.state = 'paused'; this.el.pause.classList.remove('hidden');
        if (window.Music) Music.setDuck(0.2);   // 暂停时音乐压低
      } else if (this.state === 'paused') {
        this.state = 'playing'; this.el.pause.classList.add('hidden');
        if (window.Music) Music.setDuck(1);
      }
    }

    /* ---------------- 背景音乐场景路由 ----------------
     * casual 日常休闲（菜单/局外 + 打小怪） / tide 怪物潮 / boss 通用Boss
     * pheasant 巨型野鸡王 / eagle 咬剑鹰 / hero 祖国人 / imperial 大王 / crane 鹤仙 */
    musicScene() {
      if (this.state === 'menu' || this.state === 'gameover') return 'casual';
      if (this.warnT > 0) return this.pendingBossMusic || 'boss';
      if (this.bosses.length) return this.bosses[0].musicTheme || 'boss';
      if (this.state === 'playing') return this.isTide ? 'tide' : 'casual';
      return null;   // 三选一/暂停：保持当前曲目
    }
    updateMusic() {
      if (!window.Music) return;
      const scene = this.musicScene();
      if (scene) Music.play(scene);
    }

    /* ---------------- 开局 / 重置 ---------------- */
    reset() {
      this.player = new Player();
      this.enemies = [];
      this.bosses = [];
      this.bullets = [];
      this.gems = [];
      this.particles = [];
      this.lightnings = [];
      this.beams = [];         // 长线光束（狗王解体攻击）
      this.arcs = [];          // 闪电链电弧视觉
      this.rocks = [];
      this.toasts = [];
      this.ctrlMode = this.ctrlMode || 'keyboard';   // 操作模式：'keyboard' | 'mouse'（菜单选择）
      this.loopErr = null;      // 主循环异常捕获（首帧错误堆栈）

      this.time = 0;
      this.scrollX = 0;
      this.score = 0;
      this.kills = 0;
      this.bossCount = 0;       // 已击败 Boss 数（成长叠加）
      this.bossSpawned = 0;     // 已出现 Boss 数
      this.totalLevels = 0;
      this.xp = 0;
      this.xpNeed = CFG.xpNeed(0);
      this.lastBossCls = null;  // 上一只 Boss（排斥：下轮不再出现）

      this.spawnT = 1.2;
      this.rockT = 7;
      this.tideT = 0;          // 怪物潮剩余时间（每击败 3 个 Boss 触发）
      this.bossT = rand(CFG.boss.firstMin, CFG.boss.firstMax);
      this.warnT = 0;
      this.pendingBoss = null;
      this.pendingBossMusic = null;   // 预警中 Boss 对应曲目（boss/eagle/pheasant/hero）
      this.shakeMag = 0;
      this.timeScale = 1;
      this.slowmoT = 0;
      this.flashT = 0;        // 屏幕闪光剩余时间
      this.flashColor = '#fff';
      this.ultWave = null;    // 大招光波特效
      this.round = 1;
      this.wayPicksThisRound = 0;   // 每轮弹道类成长选择次数（上限 3）
      this.elemPicksThisRound = 0;  // 每轮元素弹道成长选择次数（上限 2）
      this.grassDragonThisRound = false;   // 草龙每轮至多出现一次
      this.sphinxSpawned = false;         // 狮身人面像每局至多出现一次（沙漠专属）
      this.diffMul = 1;
      this.clouds = [];
      for (let i = 0; i < 7; i++) {
        this.clouds.push({ x: rand(0, CFG.W), y: rand(50, 300), s: rand(1.5, 3), sp: rand(14, 40) });
      }

      // 地图：每次进入游戏随机刷新一张（阻碍特性与草地一致）
      this.rollMap();
    }

    /** 地图 → 龙系主题（草龙仅草原；沙虫/黑龙/红龙/骨蛇/机器蜈蚣/深海蓝龙各属其图） */
    static get MAP_THEME() {
      return { grassland: 'grass', desert: 'sand', snow: 'black', volcano: 'red', wasteland: 'bone', cyber: 'mech', ocean: 'sea' };
    }

    /** 地图选择按钮文案：随机 / 具体地图名 */
    mapChoiceLabel() {
      if (this.mapChoice === 'random') return '🎲 随机地图';
      const m = CFG.maps.find(x => x.id === this.mapChoice);
      return m ? `${m.icon} ${m.name}` : '🎲 随机地图';
    }
    /** 同步菜单地图按钮文案 */
    syncMapBtns() {
      const label = this.mapChoiceLabel();
      if (this.el && this.el.menuMapBtn) this.el.menuMapBtn.textContent = label;
    }
    /** 循环切换地图选择：随机 → 草原 → 沙漠 → … → 大海 → 随机 */
    cycleMapChoice() {
      const ids = ['random'].concat(CFG.maps.map(m => m.id));
      const i = Math.max(0, ids.indexOf(this.mapChoice));
      this.mapChoice = ids[(i + 1) % ids.length];
      try { localStorage.setItem('flytiger_map', this.mapChoice); } catch (e) {}
      this.syncMapBtns();
      if (this.state === 'menu') this.rollMap();   // 菜单中切换：立即预览所选地图背景
      SFX.hit();
    }

    /**
     * 抽取并应用一张地图。
     *  - honorChoice：菜单中已指定地图时始终使用该地图（开局/菜单预览）；死亡换图传 false 强制随机
     *  - forceDiff：保证与当前地图不同（复活换图）
     *  - excludeOcean：排除大海（场上存在地面类敌人时，大海无其立足之地）
     */
    rollMap(opts) {
      opts = opts || {};
      let map = null;
      if (opts.honorChoice !== false && this.mapChoice && this.mapChoice !== 'random') {
        map = CFG.maps.find(m => m.id === this.mapChoice);
      }
      if (!map) {
        let pool = CFG.maps.slice();
        if (opts.excludeOcean) pool = pool.filter(m => m.id !== 'ocean');
        if (opts.forceDiff) pool = pool.filter(m => m.id !== this.mapId);
        if (!pool.length) pool = CFG.maps.filter(m => m.id !== this.mapId);
        if (!pool.length) pool = CFG.maps.slice();
        map = pool[Math.floor(Math.random() * pool.length)];
      }
      this.map = map;
      this.mapId = map.id;
      // 火焰山火山口：场景物件，与障碍一样随卷轴向左移动（移出屏幕后从右侧重新出现）；
      // 每 5s 抛射巨大火焰弹（接触火山口本身不死亡不掉血）
      this.crater = map.crater
        ? { x: CFG.W + rand(140, 340), t: CFG.map.craterInterval, rumble: 0 }
        : null;
      // 大海：波浪海平面，每 10s 一次波动（幅度变大 + 海平面上升），接触微量掉血
      this.sea = map.sea
        ? { t: 0, surgeT: CFG.map.seaSurgeInterval, surging: false, surgeT2: 0, rise: 0, amp: CFG.map.seaAmp }
        : null;
    }

    /** 场上是否存在地面类敌人：地面小怪（弓箭手/炮师）或地面移动型 Boss（蛙哥/野鸡王）。
     *  龙系怪物虽钻地但属飞行长身怪，不在此列 */
    hasGroundUnits() {
      if (this.enemies.some(e => !e.dead && CFG.enemies[e.type] && CFG.enemies[e.type].ground)) return true;
      if (this.bosses && this.bosses.some(b => !b.dead &&
          (window.BOSS_LIST || []).some(e => e.cls === b.constructor && e.ground))) return true;
      return false;
    }

    /** 死亡复活后刷新至另一张地图：清空旧地图障碍与残留龙系，保留轮次/成长/生命。
     *  随机切换；若场上有地面类敌人，则不会切到大海（大海不出现地面类敌人） */
    rerollMap() {
      this.rollMap({ forceDiff: true, honorChoice: false, excludeOcean: this.hasGroundUnits() });
      this.rocks.length = 0;
      this.rockT = 1.2;
      // 旧地图的龙系怪物随之消失，新地图的龙当轮可再次出场
      for (const e of this.enemies) {
        if (e.type === 'grassdragon') e.dead = true;
      }
      this.grassDragonThisRound = false;
      this.toast(`${this.map.icon} 转移至：${this.map.name}！`, 2.6);
    }

    start() {
      if (!Sprites.cat) {
        alert('未找到白猫素材：请把图片保存为 assets/cat.png 后刷新页面');
        return;
      }
      SFX.unlock();
      this.reset();
      this.state = 'playing';
      this.el.menu.classList.add('hidden');
      this.el.gameover.classList.add('hidden');
      this.el.levelup.classList.add('hidden');
      this.el.pause.classList.add('hidden');
      this.el.warn.classList.add('hidden');
      this.el.hud.classList.remove('hidden');
      this.el.bossHud.classList.add('hidden');
      this.syncBgmBtn();     // HUD 首次显示：音乐按钮文案与实际开关状态对齐
      this.toast(`${this.map.icon} ${this.map.name} · 第 1 轮战斗开始！`, 2.8);
    }

    gameOver() {
      if (this.state === 'gameover') return;
      this.state = 'gameover';
      SFX.explode(true);
      // 死亡爆炸：大火球 + 碎石 + 屏幕闪光
      this.flashT = 0.6; this.flashColor = '#ffc078';
      this.shakeMag = 18;
      burst(this, this.player.x, this.player.y, 70, ['#f7941d', '#ffd93b', '#ff5252', '#fff'], 360, 8, 1.1, 160);
      burst(this, this.player.x, this.player.y, 24, ['#7d8794', '#a7b3c2', '#5a5f66'], 260, 6, 0.9, 300);
      this.el.hud.classList.add('hidden');
      this.el.bossHud.classList.add('hidden');
      this.el.levelup.classList.add('hidden');
      this.el.warn.classList.add('hidden');
      const mins = Math.floor(this.time / 60), secs = Math.floor(this.time % 60);
      this.el.goStats.innerHTML =
        `存活轮次：<b>第 ${this.round} 轮</b><br>` +
        `成长次数：<b>${this.totalLevels}</b> 次　　击破敌人：<b>${this.kills}</b><br>` +
        `讨伐 Boss：<b>${this.bossCount}</b> 只　　得分：<b>${this.score}</b><br>` +
        `存活时间：<b>${mins}分${secs}秒</b>`;
      setTimeout(() => this.el.gameover.classList.remove('hidden'), 600);
    }

    /* ---------------- 数值 ---------------- */
    get bossActive() { return this.bosses.length > 0 || this.warnT > 0; }
    get atkScale() {
      const base = 1 + this.time * 0.0015 + (this.round - 1) * 0.05;
      return this.bossActive ? base * (1 + this.bossSpawned * CFG.boss.atkGrow) : base;
    }
    bossHpMul() {
      return (1 + this.bossSpawned * CFG.boss.hpGrow) * (1 + (this.round - 1) * CFG.boss.roundHpMul);
    }
    targets() { return this.enemies.concat(this.bosses); }

    /** 玩家当前理论秒伤（用于 Boss 血量动态缩放） */
    playerDps() {
      const p = this.player;
      const shotsPerSec = p.bulletCount / CFG.player.fireInterval;
      let dps = shotsPerSec * p.dmg * 0.55;       // 命中率折减
      if (p.bombLv > 0) dps *= 1.25;              // 爆炸溅射
      if (p.bulletTier >= 2) dps *= 1.15;         // 穿透
      return dps;
    }

    shake(m) { this.shakeMag = Math.max(this.shakeMag, m); }
    toast(text, dur) { this.toasts.push({ text, t: dur || 2, max: dur || 2 }); }

    /** 击杀积累怒气 */
    addRage(v) {
      if (!this.player) return;
      this.player.rage = Math.min(CFG.ultimate.rageMax, this.player.rage + v);
    }

    /** 大招：强光波 —— 肃清屏幕内全部小怪，对 Boss 造成 20% 最大生命伤害 */
    castUltimate() {
      if (this.state !== 'playing') return;
      SFX.ultimate();
      this.shake(18);
      this.flashT = 0.5; this.flashColor = '#fff';
      this.ultWave = { r: 40, a: 1 };
      // 大招破解无敌：清除所有敌人出场无敌 + Boss 锁血（草龙本体免疫大招，保留其出场无敌）
      this.enemies.forEach(e => {
        if (e.type === 'grassdragon' && !e.isMini) return;
        e.spawnInvuln = 0;
      });
      this.bosses.forEach(b => { b.lockHp = false; });
      // 屏幕内小怪全灭
      this.enemies.slice().forEach(e => {
        if (!e.dead) e.takeDamage(99999, this);
      });
      // Boss 受到 20% 最大生命伤害（入场免伤状态除外），大招无视无敌
      this.bosses.forEach(b => {
        if (!b.dead && b.state !== 'enter') {
          const wasInv = b.lockHp;
          b.lockHp = false;
          b.takeDamage(b.maxHp * CFG.ultimate.bossDmgRatio, this);
          if (wasInv) b.lockHp = true;  // 恢复锁血状态标记（但伤害已造成）
        }
      });
      // 光波放射粒子
      for (let i = 0; i < 46; i++) {
        const a = rand(0, TAU);
        this.particles.push(new Particle(
          this.player.x, this.player.y,
          Math.cos(a) * rand(320, 760), Math.sin(a) * rand(320, 760),
          rand(0.3, 0.7), rand(4, 8),
          Math.random() < 0.5 ? '#ffffff' : '#ffd93b'));
      }
      this.toast('★ 强光波爆发！★', 1.8);
    }

    gainXp(v) {
      this.xp += v;
      this.tryLevelUp();
    }

    /** 满足条件即弹出成长选择；无冷却锁，能量可连续触发（门槛随次数递增） */
    tryLevelUp() {
      if (this.state !== 'playing') return;
      if (this.xp < this.xpNeed) return;
      this.xp -= this.xpNeed;
      this.totalLevels++;
      this.xpNeed = CFG.xpNeed(this.totalLevels);   // 下一次需求更高：成长越来越难
      this.openLevelup();
    }

    /* ---------------- 三选一强化 ---------------- */
    openLevelup() {
      this.state = 'levelup';
      SFX.levelup();
      // pool: can() 通过的项（can 可能含随机概率，只调用一次）
      // 每轮弹道类成长最多 3 次，超限后从池中排除弹道类选项
      // 元素弹道每轮最多 2 次，超限后从池中排除
      const WAY_IDS = ['way', 'tail', 'down', 'flame', 'poison', 'ice'];
      const ELEM_IDS = ['flame', 'poison', 'ice'];
      const wayLimitReached = this.wayPicksThisRound >= 3;
      const elemLimitReached = this.elemPicksThisRound >= 2;
      const pool = CFG.upgrades.filter(u => {
        if (!u.can(this.player, this)) return false;
        if (wayLimitReached && WAY_IDS.includes(u.id)) return false;
        if (elemLimitReached && ELEM_IDS.includes(u.id)) return false;
        return true;
      });
      const opts = [];
      // guaranteed 项强制放入选项（从 pool 中提取，can 已验证通过）
      const guaranteed = pool.filter(u => u.guaranteed && u.guaranteed(this.player, this));
      guaranteed.forEach(u => {
        const idx = pool.indexOf(u);
        if (idx >= 0) pool.splice(idx, 1);
        opts.push(u);
      });
      while (opts.length < 3 && pool.length) {
        const i = Math.floor(Math.random() * pool.length);
        opts.push(pool.splice(i, 1)[0]);
      }
      this.pendingOptions = opts;
      this.el.luCards.innerHTML = '';
      opts.forEach((u, i) => {
        const card = document.createElement('div');
        const isGuaranteed = guaranteed.includes(u);
        card.className = 'lu-card ' + u.cls + (isGuaranteed ? ' lu-recommend' : '');
        const lv = u.level(this.player);
        card.innerHTML =
          `<div class="card-key">${i + 1}</div>` +
          (isGuaranteed ? '<div class="card-rec">★ 推荐</div>' : '') +
          `<div class="card-icon">${u.icon}</div>` +
          `<div class="card-name">${u.name}</div>` +
          `<div class="card-lv">${lv > 0 ? '当前 Lv.' + lv : '未拥有'}</div>` +
          `<div class="card-desc">${u.desc}</div>`;
        card.addEventListener('click', () => this.pickUpgrade(i));
        this.el.luCards.appendChild(card);
      });
      this.el.levelup.classList.remove('hidden');
    }
    pickUpgrade(i) {
      const u = this.pendingOptions && this.pendingOptions[i];
      if (!u) return;
      const isNew = (u.id === 'chain' && !this.player.chainJumps) ||
                    (u.id === 'blade' && !this.player.blades);
      u.apply(this.player);
      // 弹道类成长计数（每轮上限 3 次）
      if (['way', 'tail', 'down', 'flame', 'poison', 'ice'].includes(u.id)) {
        this.wayPicksThisRound++;
      }
      // 元素弹道单独计数（每轮上限 2 次）
      if (['flame', 'poison', 'ice'].includes(u.id)) {
        this.elemPicksThisRound++;
      }
      this.pendingOptions = null;
      this.el.levelup.classList.add('hidden');
      // 专属升级提示音效：闪电子弹（电流升腾）/ 防护刀刃（金属出鞘）
      if (u.id === 'chain' || u.id === 'chainN') {
        SFX.chainGet();
        burst(this, this.player.x, this.player.y, 28, ['#fff', '#ffe066', '#7fe7ff'], 260, 5, 0.6);
      } else if (u.id === 'blade' || u.id === 'bladeN') {
        SFX.bladeGet();
        burst(this, this.player.x, this.player.y, 28, ['#7fe7ff', '#fff', '#c9f6ff'], 260, 5, 0.6);
      } else {
        burst(this, this.player.x, this.player.y, 24, ['#ffd93b', '#fff', '#74e0ff'], 240, 5, 0.6);
      }
      // 首次获得新能力时弹出提示
      if (isNew) this.toast(u.id === 'chain' ? '⚡ 闪电子弹解锁！' : '† 防护刀刃解锁！');
      // 元素弹道选择提示
      if (['flame', 'poison', 'ice'].includes(u.id)) {
        const names = { flame: '🔥火焰', poison: '☠毒液', ice: '❄寒冰' };
        const cnt = this.player.elementWay.filter(x => x === u.id).length;
        this.toast(`${names[u.id]}弹道 ${cnt}/3`, 1.5);
      }
      this.state = 'playing';
      // 无冷却锁：若剩余能量仍满足门槛，下一帧会连续弹出下一次成长选择
    }

    /* ---------------- Boss 调度 ---------------- */
    scheduleNextBoss() {
      this.bossT = rand(CFG.boss.nextMin, CFG.boss.nextMax);
    }
    triggerBossWarn() {
      // Boss 按出场序号解锁：第1只飞猪王，第2只起解锁雷公巨兽/武士，第3只起解锁咬剑鹰
      // 排斥规则：上一只出现的 Boss 本次不再出现
      // chance：部分 Boss（骷髅王/狗王）即使解锁也只有 30% 概率进入候选池
      const ord = this.bossSpawned + 1;
      const ordOk = b => b.minOrd <= ord && (b.maxOrd === undefined || ord <= b.maxOrd);
      // map：地图限定 Boss（如狮身人面像仅沙漠）；大海不出现地面移动型 Boss（蛙哥/野鸡王）
      // sphinxSpawned：每局至多一次
      const mapOk = b => (b.map === undefined || b.map === this.mapId) &&
                         !(b.ground && this.mapId === 'ocean') &&
                         (b.cls.name !== 'Sphinx' || !this.sphinxSpawned);
      let pool = window.BOSS_LIST.filter(b =>
        ordOk(b) &&
        mapOk(b) &&
        b.cls.name !== this.lastBossCls &&
        (b.chance === undefined || Math.random() < b.chance));
      if (!pool.length) {
        // 兜底1：忽略概率权重（防止空池）
        pool = window.BOSS_LIST.filter(b => ordOk(b) && mapOk(b) && b.cls.name !== this.lastBossCls);
      }
      if (!pool.length) {
        // 兜底2：当前序号无其他可选 Boss 时，允许重复出现（防止空池卡死；仍受地图/单次限制）
        pool = window.BOSS_LIST.filter(b => ordOk(b) && mapOk(b));
      }
      if (!pool.length) pool = window.BOSS_LIST.slice();
      // forceChance：部分 Boss 在指定出场序号有独立的直接出场概率（如大王首轮 60%）；
      // 未命中强制概率的该类 Boss 不再参与本轮随机池
      let pick = null;
      // 地图限定 Boss（如狮身人面像仅沙漠）优先掷强制骰，避免被通用强制 Boss（大王）抢场而压低其出场率
      const forceList = pool.filter(b => b.forceChance && b.forceChance[ord] !== undefined);
      forceList.sort((a, b) => (a.map ? 0 : 1) - (b.map ? 0 : 1));
      for (const b of forceList) {
        if (Math.random() < b.forceChance[ord]) { pick = b; break; }
      }
      // 未命中强制概率的 Boss 不进随机池
      const randomPool = pool.filter(b => !(b.forceChance && b.forceChance[ord] !== undefined));
      if (!pick) {
        const p2 = randomPool.length ? randomPool : pool;
        pick = p2[Math.floor(Math.random() * p2.length)];
      }
      this.pendingBoss = pick.cls;
      this.pendingBossMusic = pick.music || 'boss';   // 预警期即切到该 Boss 专属曲目
      this.warnT = CFG.boss.warnTime;
      this.el.warnSub.textContent = '强大的气息逼近了！';
      this.el.warn.classList.remove('hidden');
      SFX.bossWarn();   // 三轮递进警笛（紧张感逐级抬升）
    }
    spawnBoss(cls) {
      const b = new cls(this);
      const entry = (window.BOSS_LIST || []).find(e => e.cls === cls);
      b.musicTheme = (entry && entry.music) || 'boss';   // 专属 BGM（boss/eagle/pheasant/hero）
      this.bosses.push(b);
      this.bossSpawned++;
      this.lastBossCls = cls.name;
      if (cls.name === 'Sphinx') this.sphinxSpawned = true;   // 狮身人面像每局至多一次
      this.el.bossName.textContent = `${b.bossName}（${b.title}）`;
      this.el.bossHud.classList.remove('hidden');
      this.toast(`${b.bossName} 出现！`, 2);
      if (b.musicTheme === 'imperial') SFX.bossArmy();   // 大王登场：万军齐吼"好！好！好！" + 战鼓号角
      else SFX.bossRoar();   // 登场咆哮：低频砸地 + 不和谐音簇轰鸣
      this.shake(6);
    }
    onBossDefeated(boss) {
      this.bossCount++;
      // 击败 1 个 Boss = 通过 1 轮
      this.round = this.bossCount + 1;
      this.wayPicksThisRound = 0;   // 新一轮重置弹道成长计数
      this.elemPicksThisRound = 0;  // 新一轮重置元素弹道成长计数
      this.grassDragonThisRound = false;   // 新一轮重置草龙出场标记
      this.score += 500;
      this.kills++;
      this.addRage(CFG.ultimate.rageBoss);
      // Boss 死亡：场上所有敌方弹幕无效化，逐渐消失
      this.bullets.forEach(b => { if (!b.friendly) b.neutralize(); });
      // 击败 Boss 默认回复 40% 生命
      const heal = Math.round(this.player.maxHp * 0.4);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      // 每击败 1 只 Boss 解锁 1 种新小怪
      const unlocked = Object.keys(CFG.enemies)
        .filter(t => (CFG.enemies[t].minBossKills || 0) === this.bossCount)
        .map(t => CFG.enemies[t].name);
      let msg = `击败 ${boss.bossName}！通过第 ${this.bossCount} 轮，回复 ${heal} 生命！`;
      if (unlocked.length) msg += `　新敌人解锁：${unlocked.join('、')}！`;
      // 怪物潮：每击败 3 个 Boss（通过第 3/6/9… 轮）触发一次，持续 30 秒，小怪数量 ×3
      const tide = this.bossCount % 3 === 0;
      if (tide) {
        this.tideT = 30;
        msg += '　⚠ 怪物潮来袭：小怪数量 ×3！';
      }
      this.toast(msg, (unlocked.length || tide) ? 3.6 : 2.8);
      burst(this, this.player.x, this.player.y, 20, ['#7CFC00', '#fff', '#ffd93b'], 200, 5, 0.7);
      // 连续爆炸
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          burst(this, boss.x + rand(-50, 50), boss.y + rand(-60, 60), 26,
            boss.deathCols, 320, 7, 0.8, 120);
          SFX.explode(true);
          this.shake(12);
        }, i * 120);
      }
      // 能量宝石：Boss 掉落的能量直接飞向玩家
      const each = Math.ceil(boss.xpValue / 14);
      for (let i = 0; i < 14; i++) this.gems.push(new Gem(boss.x, boss.y, each, true));
      SFX.bossDie();
      this.slowmoT = 0.9;
      this.scheduleNextBoss();
    }

    /* ---------------- 火球爆炸 ---------------- */
    explodeFireball(x, y, frags, fragDmg, radius) {
      burst(this, x, y, 26, ['#ff7b2e', '#ffd23b', '#c94a1e', '#fff'], 280, 6, 0.6, 100);
      SFX.explode(false);
      this.shake(7);
      // 分裂火焰弹
      for (let i = 0; i < frags; i++) {
        const a = (TAU / frags) * i + rand(-0.1, 0.1);
        this.bullets.push(new Bullet(x, y,
          Math.cos(a) * 150, Math.sin(a) * 150,
          { kind: 'flame', r: 6, dmg: fragDmg, life: 3.2 }));
      }
      // 玩家在爆炸范围内受伤
      const p = this.player;
      if (Math.hypot(p.x - x, p.y - y) < radius + p.radius) p.hurt(fragDmg, this);
    }

    /* ---------------- 炮弹爆炸（炮师 / 可引爆弹） ---------------- */
    shellBlast(x, y, dmg) {
      const R = CFG.cannoneer.blastR;
      burst(this, x, y, 30, ['#ff7b2e', '#ffd23b', '#c94a1e', '#fff'], 300, 7, 0.6, 120);
      SFX.explode(false);
      this.shake(8);
      const p = this.player;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < R + p.radius) {
        p.hurt(Math.round(dmg * (d < R * 0.55 ? 1 : 0.6)), this);
      }
      // 爆炸波及范围内的山石一并炸毁
      for (const r of this.rocks) {
        if (!r.dead && r.contains(x, y, R * 0.6)) r.destroy(this);
      }
    }

    /* ---------------- 范围伤害（爆炸弹） ---------------- */
    aoe(x, y, radius, dmg) {
      burst(this, x, y, 16, ['#ff7b2e', '#ffd23b', '#fff'], 240, 5, 0.45, 80);
      SFX.explode(false);
      this.shake(5);
      this.targets().forEach(e => {
        if (e.segments) {
          // 草龙：爆炸范围内的露出节全部受伤
          e.aoeDamage(x, y, radius, dmg, this);
          return;
        }
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < radius + e.radius) {
          e.takeDamage(dmg, this, {
            x: (e.x - x) / (d || 1) * 180,
            y: (e.y - y) / (d || 1) * 180
          });
        }
      });
    }

    /* ---------------- 刷怪导演 ---------------- */
    /** 怪物潮：每击败 3 个 Boss 触发一次，持续期间小怪数量 ×3 */
    get isTide() { return this.tideT > 0; }
    /** 场上小怪上限：怪物潮期间 ×3 */
    enemyCap() { return this.isTide ? 66 : 22; }

    spawnEnemy(type) {
      if (this.enemies.length >= this.enemyCap()) return;   // 上限保护（含延迟生成的蝙蝠群）
      if (type === 'grassdragon') {
        // 龙系特殊小怪：机制/节数/出场轮数与草龙完全相同，外形按当前地图主题区分
        const thId = Game.MAP_THEME[this.mapId] || 'grass';
        this.grassDragonThisRound = true;
        const dragon = new GrassDragon(this, false, null, thId);
        this.enemies.push(dragon);
        this.toast(dragon.th.warn, 2.2);
        return;
      }
      this.enemies.push(new Enemy(type, this));
    }

    /** 按权重随机抽取一种当前可出场的敌人（精英/地面单位场上限 1；草龙每轮限 1 只） */
    pickEnemyType() {
      const table = [];
      Object.keys(CFG.enemies).forEach(type => {
        const def = CFG.enemies[type];
        if ((def.minBossKills || 0) > this.bossCount) return;        // 未达成 Boss 击败数：每击败1只Boss解锁1种
        if (def.ground && this.mapId === 'ocean') return;           // 大海：不出现地面类敌人（弓箭手/炮师）
        if (def.oncePerRound && this.grassDragonThisRound) return;   // 草龙：每轮至多一次
        if ((def.elite || def.ground) && this.enemies.some(e => e.type === type && !e.isMini)) return;  // 精英/地面单位场上限 1（分裂小段不计）
        for (let i = 0; i < def.weight; i++) table.push(type);
      });
      return table.length ? table[Math.floor(Math.random() * table.length)] : null;
    }

    spawnTick(dt) {
      if (this.bossActive) return;      // Boss 战不刷普通怪
      this.spawnT -= dt;
      if (this.spawnT > 0 || this.enemies.length >= this.enemyCap()) return;
      const interval = clamp(2.2 - (this.round - 1) * 0.12 - this.time * 0.003, 0.8, 2.2);
      this.spawnT = interval * rand(0.7, 1.3);

      // 怪物潮：每次刷怪放出 3 批小怪，蝙蝠群数量同步 ×3；非潮次节奏不变
      const tide = this.isTide;
      const batches = tide ? 3 : 1;
      for (let k = 0; k < batches; k++) {
        const type = this.pickEnemyType();
        if (!type) return;
        if (type === 'bat') {
          const n = (3 + Math.floor(Math.random() * 3)) * (tide ? 3 : 1);
          for (let i = 0; i < n; i++) setTimeout(() => {
            if (this.state === 'playing') this.spawnEnemy('bat');
          }, i * 220);
        } else if (type === 'eagle' && Math.random() < 0.4) {
          this.spawnEnemy('eagle');
          setTimeout(() => { if (this.state === 'playing') this.spawnEnemy('eagle'); }, 500);
        } else {
          this.spawnEnemy(type);
        }
      }
    }

    /* ---------------- 山石障碍 ---------------- */
    /** 场上山石上限：1-3 轮 1-2 个，之后每 3 轮 +1 */
    rockMaxCount() {
      return 2 + Math.floor((this.round - 1) / 3);
    }
    rockTick(dt) {
      this.rockT -= dt;
      if (this.rockT > 0) return;
      if (this.rocks.length >= this.rockMaxCount()) { this.rockT = 1.5; return; }
      // 造型：草原沿用原 5 种山石权重；其余地图从本地图障碍表（高/中/低）随机
      let rock;
      if (this.map && this.map.obs) {
        const shapeId = this.map.obs[Math.floor(Math.random() * this.map.obs.length)];
        rock = new Rock(0, shapeId);
      } else {
        const roll = Math.random();
        const kind = roll < 0.26 ? 2 : roll < 0.44 ? 4 : roll < 0.60 ? 1 : roll < 0.78 ? 3 : 0;
        rock = new Rock(0, 'grass' + kind);
      }
      const halfW = rock.w / 2;
      // 与上一块障碍保持安全间隔
      const rightmost = this.rocks.reduce((m, r) => Math.max(m, r.x), -9999);
      rock.x = Math.max(CFG.W + halfW + 260, rightmost + halfW + rand(480, 820));
      this.rocks.push(rock);
      this.rockT = rand(2.0, 3.5);
    }

    /* ---------------- 地图机制（火山口 / 大海） ---------------- */
    /** 危险地面高度：大海为波动海平面，其余地图为固定地面 */
    groundYAt(x) {
      if (this.sea) return this.seaSurfaceY(x);
      return CFG.GROUND_Y;
    }
    /** 海平面 y（含波浪起伏 / 波动上升） */
    seaSurfaceY(x, tOverride) {
      const s = this.sea;
      const t = tOverride !== undefined ? tOverride : s.t;
      const w1 = Math.sin(x * 0.018 + t * 1.7) * s.amp;
      const w2 = Math.sin(x * 0.041 - t * 2.9) * s.amp * 0.45;
      return CFG.GROUND_Y - s.rise + w1 + w2;
    }
    mapTick(dt) {
      // 大海：每 10s 一次波动 —— 波浪幅度变大、海平面上升一段距离
      if (this.sea) {
        const s = this.sea;
        s.t += dt;
        s.surgeT -= dt;
        if (s.surgeT <= 0 && !s.surging) {
          s.surging = true;
          s.surgeT2 = CFG.map.seaSurgeDur;
          this.toast('🌊 大海波动！海平面上升！', 2.2);
          this.shake(5);
        }
        if (s.surging) {
          s.surgeT2 -= dt;
          if (s.surgeT2 <= 0) { s.surging = false; s.surgeT = CFG.map.seaSurgeInterval; }
        }
        const riseTarget = s.surging ? CFG.map.seaRise : 0;
        const ampTarget = s.surging ? CFG.map.seaSurgeAmp : CFG.map.seaAmp;
        s.rise += (riseTarget - s.rise) * Math.min(1, dt * (s.surging ? 2.6 : 1.6));
        s.amp += (ampTarget - s.amp) * Math.min(1, dt * 2.2);
        // 浪尖飞沫
        if (Math.random() < dt * (s.surging ? 12 : 3)) {
          const fx = rand(0, CFG.W);
          this.particles.push(new Particle(fx, this.seaSurfaceY(fx) - 4,
            rand(-30, 30), rand(-90, -30), rand(0.3, 0.6), rand(3, 5), '#d8f2ff'));
        }
      }
      // 火焰山火山口：场景物件，随卷轴向左移动，移出屏幕后从右侧重新出现；
      // 喷发前 0.9s 蓄力（震动 + 火星），随后抛射巨大火焰弹
      if (this.crater) {
        const c = this.crater;
        c.x -= 62 * dt;                        // 与地面卷轴同步
        if (c.x < -120) {                      // 完全移出屏幕：从右侧重新出现
          c.x = CFG.W + rand(160, 420);
          c.t = CFG.map.craterInterval;
          c.rumble = 0;
        } else if (c.x < CFG.W + 20) {         // 进入屏幕后才开始蓄力/喷发
          c.t -= dt;
          if (c.t < CFG.map.craterRumble) {
            c.rumble = 1 - c.t / CFG.map.craterRumble;
            this.shake(3 * c.rumble);
            if (Math.random() < dt * 20) {
              this.particles.push(new Particle(c.x + rand(-26, 26), CFG.GROUND_Y - 34,
                rand(-40, 40), rand(-230, -120), rand(0.3, 0.7), rand(3, 6),
                Math.random() < 0.5 ? '#ff7b2e' : '#ffd23b'));
            }
          } else c.rumble = 0;
          if (c.t <= 0) { this.eruptCrater(); c.t = CFG.map.craterInterval; }
        }
      }
    }
    /** 火山口喷发：巨大火焰弹抛物线抛射至左右任意位置 */
    eruptCrater() {
      const c = this.crater, M = CFG.map;
      const x0 = c.x, y0 = CFG.GROUND_Y - 44;
      const tx = rand(70, CFG.W - 70);           // 落点：左右任意位置
      const T = rand(1.2, 1.6);
      const g = 620;
      const vx = (tx - x0) / T;
      const vy = (34 - 0.5 * g * T * T) / T;     // y(T) 落到 GROUND_Y-10
      const dmg = Math.max(M.lavaDmg, Math.round(M.lavaDmg * this.atkScale));
      this.bullets.push(new Bullet(x0, y0, vx, vy, {
        kind: 'lava', r: M.lavaR, dmg, life: 6, grav: g, fireTrail: true,
        onExpire: (gg, b) => gg.lavaBlast(b.x, b.y, b.dmg)
      }));
      burst(this, x0, y0, 26, ['#ff7b2e', '#ffd23b', '#c94a1e', '#fff'], 320, 7, 0.6, 180);
      SFX.explode(true);
      this.shake(9);
    }
    /** 火山弹落地爆炸：大范围火焰伤害 + 波及障碍炸毁 */
    lavaBlast(x, y, dmg) {
      const R = CFG.map.lavaBlastR;
      burst(this, x, y, 44, ['#ff7b2e', '#ffd23b', '#c94a1e', '#fff5d0', '#fff'], 360, 8, 0.8, 150);
      SFX.explode(true);
      this.shake(11);
      const p = this.player;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < R + p.radius) p.hurt(Math.round(dmg * (d < R * 0.55 ? 1 : 0.6)), this);
      for (const r of this.rocks) {
        if (!r.dead && r.contains(x, y, R * 0.6)) r.destroy(this);
      }
    }

    /* ---------------- 主循环 ---------------- */
    loop(now) {
      let dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      try {
        if (this.state === 'playing' || this.state === 'warn') {
          if (this.slowmoT > 0) { this.slowmoT -= dt; this.timeScale = 0.3; }
          else this.timeScale = 1;
          this.update(dt * this.timeScale);
        } else if (this.state === 'gameover') {
          this.updateFx(dt);   // 死亡爆炸特效继续播放
        }
        this.updateMusic();    // 场景→曲目路由（菜单/小怪/怪物潮/各类Boss）
        this.render();
      } catch (err) {
        // 单帧异常不得冻结整个游戏：记录首个错误堆栈，后续帧照常调度
        if (!this.loopErr) this.loopErr = (err && err.stack) ? err.stack : String(err);
        try { console.error('[game loop]', err); } catch (e) {}
      }
      requestAnimationFrame(t => this.loop(t));
    }

    /** 仅更新粒子 / 震屏 / 闪光（游戏结束后让死亡爆炸可见） */
    updateFx(dt) {
      this.particles.forEach(p => p.update(dt));
      this.particles = this.particles.filter(p => !p.dead);
      this.shakeMag = Math.max(0, this.shakeMag - dt * 30);
      if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
    }

    update(dt) {
      this.time += dt;
      this.scrollX += dt * 110;
      this.shakeMag = Math.max(0, this.shakeMag - dt * 30);
      if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
      // 怪物潮倒计时（Boss 战/预警期间暂停，不浪费潮次）
      if (this.tideT > 0 && !this.bossActive) this.tideT = Math.max(0, this.tideT - dt);
      // 大招光波扩散
      if (this.ultWave) {
        this.ultWave.r += 2600 * dt;
        this.ultWave.a = Math.max(0, 1 - this.ultWave.r / 1500);
        if (this.ultWave.a <= 0) this.ultWave = null;
      }

      // 云
      this.clouds.forEach(c => {
        c.x -= c.sp * dt;
        if (c.x < -90) { c.x = CFG.W + 60; c.y = rand(50, 320); c.s = rand(1.5, 3); }
      });

      // Boss 预警倒计时
      if (this.warnT > 0) {
        this.warnT -= dt;
        if (this.warnT <= 0) {
          this.el.warn.classList.add('hidden');
          this.spawnBoss(this.pendingBoss);
          this.pendingBoss = null;
        }
      } else if (!this.bossActive) {
        this.bossT -= dt;
        if (this.bossT <= 0) this.triggerBossWarn();
      }

      this.spawnTick(dt);
      this.rockTick(dt);
      this.mapTick(dt);

      // 实体更新
      this.player.update(dt, this);
      this.enemies.forEach(e => e.update(dt, this));
      this.bosses.forEach(b => b.update(dt, this));
      this.bullets.forEach(b => b.update(dt, this));
      this.gems.forEach(g2 => g2.update(dt, this));
      this.particles.forEach(p => p.update(dt));
      this.lightnings.forEach(l => l.update(dt, this));
      this.beams.forEach(b => b.update(dt, this));
      this.rocks.forEach(r => r.update(dt, this));
      this.arcs.forEach(a => a.t += dt);

      this.collisions();

      // 清理
      this.enemies = this.enemies.filter(e => !e.dead);
      this.bosses = this.bosses.filter(b => !b.dead);
      this.bullets = this.bullets.filter(b => !b.dead);
      this.gems = this.gems.filter(g2 => !g2.dead);
      this.particles = this.particles.filter(p => !p.dead);
      this.lightnings = this.lightnings.filter(l => !l.dead);
      this.beams = this.beams.filter(b => !b.dead);
      this.rocks = this.rocks.filter(r => !r.dead);
      this.arcs = this.arcs.filter(a => a.t < a.life);
      if (this.bosses.length === 0) this.el.bossHud.classList.add('hidden');

      // 能量满足门槛即触发选择（可连续触发，无冷却锁）
      this.tryLevelUp();

      // Toast
      this.toasts.forEach(t => t.t -= dt);
      this.toasts = this.toasts.filter(t => t.t > 0);

      this.updateHud();
    }

    /* ---------------- 碰撞 ---------------- */
    collisions() {
      const p = this.player;
      // 我方子弹 vs 敌人/Boss
      for (const b of this.bullets) {
        if (!b.friendly || b.dead) continue;
        for (const e of this.targets()) {
          if (e.dead) continue;
          if (e.isBoss && e.state === 'enter') continue;   // Boss 入场免伤
          if (b.hitSet && b.hitSet.has(e)) continue;
          // 草龙：子弹逐节命中（仅露出地面的节）
          let hitSeg = -1;
          if (e.segments) hitSeg = e.hitTest(b.x, b.y, b.r);
          const rr = b.r + e.radius;
          const circleHit = !e.segments && (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr;
          if (hitSeg >= 0 || circleHit) {
            if (!b.hitSet) b.hitSet = new Set();
            b.hitSet.add(e);
            if (e.segments) {
              // 节命中：DoT / 冻结由 damageSegment 内部处理
              e.damageSegment(hitSeg, b.dmg, this, { x: 220, y: rand(-60, 60) }, b.element || '');
            } else {
              e.takeDamage(b.dmg, this, { x: 220, y: rand(-60, 60) });
              // 元素弹道命中：施加 DoT / 破无敌 / 冻结
              if (b.element === 'flame') {
                e.dotT = 3; e.dotDps = b.dmg * 0.4; e.dotType = 'flame';
                if (e.spawnInvuln > 0) e.invulnBreakT = 1;   // 火焰：1s 后破无敌
              } else if (b.element === 'poison') {
                e.dotT = 6; e.dotDps = b.dmg * 0.25; e.dotType = 'poison';
                if (e.spawnInvuln > 0) e.invulnBreakT = 3;   // 毒液：3s 后破无敌
              } else if (b.element === 'ice') {
                e.dotT = 2; e.dotDps = b.dmg * 0.3; e.dotType = 'ice';
                e.freezeT = 4;                                // 寒冰：冻结 4s
                if (e.spawnInvuln > 0) e.invulnBreakT = 0.5; // 寒冰也破无敌
              }
            }
            // 闪电子弹：命中后闪电链跳跃链接附近敌人
            if (p.chainJumps >= 1 && !e.dead) this.chainLightning(e, b.dmg);
            // 爆炸弹
            if (b.bombLv > 0) {
              const radius = 34 + b.bombLv * 12;
              this.aoe(b.x, b.y, radius, b.dmg * (0.55 + b.bombLv * 0.16));
              b.dead = true;
            } else {
              b.pierce--;
              if (b.pierce < 0) b.dead = true;
            }
            if (b.dead) break;
          }
        }
      }
      // 我方子弹 vs 敌方炮弹/可击爆弹：
      //  - 炮弹（volatile）：击中即引爆
      //  - 可击爆弹（hp>0，如巨型导弹/漂浮弹）：累计命中次数，达到后引爆（旋转剑在 entities 中 1 击必爆）
      for (const fb of this.bullets) {
        if (!fb.friendly || fb.dead) continue;
        for (const eb of this.bullets) {
          if (eb.friendly || eb.dead || eb.neutralized) continue;
          if (!eb.volatile && !(eb.hp > 0)) continue;
          if (eb.invuln > 0) continue;   // 发射后无敌时间内：子弹直接穿过，不消耗
          const rr = fb.r + eb.r + 2;
          if ((fb.x - eb.x) ** 2 + (fb.y - eb.y) ** 2 < rr * rr) {
            if (eb.volatile) {
              fb.dead = true;
              eb.dead = true;
              this.shellBlast(eb.x, eb.y, eb.dmg);
            } else {
              if (eb.hitCd > 0) continue;
              eb.hitCd = 0.08;
              eb.hp--;
              eb.hitFlash = 0.12;
              burst(this, eb.x, eb.y, 4, ['#fff', '#ffd23b'], 150, 3, 0.2);
              fb.pierce--;
              if (fb.pierce < 0) fb.dead = true;
              if (eb.hp <= 0) {
                eb.dead = true;
                if (eb.onBreak) eb.onBreak(this, eb);
                else this.shellBlast(eb.x, eb.y, eb.dmg);
              }
            }
            if (fb.dead) break;
          }
        }
      }
      // 敌方子弹 vs 玩家（Boss 死亡后已失效的弹幕不造成伤害）
      for (const b of this.bullets) {
        if (b.friendly || b.dead || b.neutralized) continue;
        const rr = b.r + p.radius * 0.8;
        if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr) {
          if (b.kind === 'fireball') {
            b.dead = true;
            this.explodeFireball(b.x, b.y, 12, b.dmg * 0.75, 90);
          } else if (b.kind === 'shell') {
            b.dead = true;
            this.shellBlast(b.x, b.y, b.dmg);
          } else if (b.kind === 'lava') {
            // 火山口巨大火焰弹：命中玩家即引爆
            b.dead = true;
            this.lavaBlast(b.x, b.y, b.dmg);
          } else if (b.kind === 'missile' || b.hp > 0) {
            // 可击爆弹（导弹/漂浮战斧等 hp>0）撞到玩家：直接引爆
            b.dead = true;
            this.shellBlast(b.x, b.y, b.dmg);
          } else {
            b.dead = true;
            // 命中玩家回调（怪客十字弹吸血、大王斧击无敌等）：玩家无敌帧未实际命中则不触发
            if (p.hurt(b.dmg, this) !== false && b.onPlayerHit) b.onPlayerHit(this, b);
            burst(this, b.x, b.y, 6, ['#ff5252', '#fff'], 160, 4, 0.3);
          }
        }
      }
    }

    /** 闪电子弹：从被命中目标起，电弧主动跳跃链接附近最近的敌人 */
    chainLightning(first, baseDmg) {
      const p = this.player;
      const C = CFG.chain;
      // 首个受击点（草龙取最近露出节）
      const startPt = first.segments
        ? (first.nearestExposed(first.x, first.y) || { x: first.x, y: first.y })
        : { x: first.x, y: first.y };
      const linked = new Set([first]);
      let from = { x: startPt.x, y: startPt.y };
      const segPts = [{ x: startPt.x, y: startPt.y }];
      for (let jump = 0; jump < p.chainJumps; jump++) {
        // 找未链过、未死亡、在链接范围内的最近目标（草龙按露出节取点）
        let best = null, bestD = C.range, bestPt = null;
        for (const e of this.targets()) {
          if (e.dead || linked.has(e)) continue;
          if (e.isBoss && e.state === 'enter') continue;
          // 草龙：最近露出节即受击点；整龙全在地下则跳过
          const pt = e.segments ? e.nearestExposed(from.x, from.y) : { x: e.x, y: e.y };
          if (!pt) continue;
          const d = Math.hypot(pt.x - from.x, pt.y - from.y);
          if (d < bestD) { bestD = d; best = e; bestPt = pt; }
        }
        if (!best) break;
        linked.add(best);
        // 伤害：基础系数 + 强化等级，每跳衰减 15%
        const mul = (C.baseMul + C.dmgPerLv * p.chainDmgLv) * Math.pow(0.85, jump);
        if (best.segments) best.damageAt(bestPt.x, bestPt.y, baseDmg * mul, this);
        else best.takeDamage(baseDmg * mul, this, {
          x: (best.x - from.x) * 2.2, y: (best.y - from.y) * 2.2
        });
        burst(this, bestPt.x, bestPt.y, 4, ['#fff', '#ffe066', '#7fe7ff'], 130, 3, 0.22);
        segPts.push({ x: bestPt.x, y: bestPt.y });
        from = bestPt;
      }
      if (segPts.length > 1) {
        // 折线电弧：相邻目标间生成抖动折点
        const pts = [];
        for (let i = 0; i < segPts.length - 1; i++) {
          const a = segPts[i], b = segPts[i + 1];
          pts.push({ x: a.x, y: a.y });
          const segs = 4;
          for (let s = 1; s < segs; s++) {
            const t = s / segs;
            pts.push({
              x: a.x + (b.x - a.x) * t + rand(-10, 10),
              y: a.y + (b.y - a.y) * t + rand(-10, 10)
            });
          }
        }
        pts.push(segPts[segPts.length - 1]);
        this.arcs.push({ pts, t: 0, life: 0.18 });
        SFX.zap();
      }
    }

    /* ---------------- HUD ---------------- */
    updateHud() {
      const p = this.player;
      this.el.hpBar.style.width = clamp(p.hp / p.maxHp, 0, 1) * 100 + '%';
      this.el.hpText.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
      this.el.xpBar.style.width = clamp(this.xp / this.xpNeed, 0, 1) * 100 + '%';
      this.el.xpText.textContent = `${this.xp}/${this.xpNeed}`;
      // 怒气 / 大招
      const rageRatio = clamp(p.rage / CFG.ultimate.rageMax, 0, 1);
      this.el.rageBar.style.width = rageRatio * 100 + '%';
      this.el.rageText.textContent = rageRatio >= 1 ? '大招就绪！空格/J' : `怒气 ${Math.floor(p.rage)}/100`;
      this.el.rageBox.classList.toggle('ready', rageRatio >= 1);
      this.el.roundText.textContent = `第 ${this.round} 轮`;
      this.el.levelText.textContent = `成长 ${this.totalLevels} 次`;
      this.el.scoreText.textContent = `击破 ${this.kills}`;
      // 生命条数
      if (this.el.livesText) {
        this.el.livesText.textContent = '❤'.repeat(this.player.lives) + '·'.repeat(3 - this.player.lives);
      }
      // 近战冷却
      const cdTotal = CFG.player.meleeCooldown;
      const cdRatio = p.isMeleeing ? 0 : clamp(p.cdT / cdTotal, 0, 1);
      this.el.meleeCd.style.height = cdRatio * 100 + '%';
      this.el.meleeIcon.style.color = p.meleeReady ? '#ffd166' : '#8a7a55';
      // Boss 血条
      if (this.bosses.length) {
        const b = this.bosses[0];
        this.el.bossBar.style.width = clamp(b.hp / b.maxHp, 0, 1) * 100 + '%';
      }
    }

    /* ---------------- 背景（七张地图主题：草原 / 沙漠 / 雪地 / 火焰山 / 紫荒地 / 赛博都市 / 大海） ---------------- */
    buildBackground() {
      const strip = (w, h, fn) => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        fn(c.getContext('2d'), w, h);
        return c;
      };
      /** 整屏天空：渐变 + 天体绘制 */
      const sky = (stops, celest) => {
        const c = document.createElement('canvas');
        c.width = CFG.W; c.height = CFG.H;
        const x = c.getContext('2d');
        const gr = x.createLinearGradient(0, 0, 0, CFG.H);
        stops.forEach(s => gr.addColorStop(s[0], s[1]));
        x.fillStyle = gr;
        x.fillRect(0, 0, CFG.W, CFG.H);
        if (celest) celest(x);
        return c;
      };
      /** 像素太阳/月亮：逐层加宽圆盘 */
      const disk = (x, cx, cy, r, col, coreCol) => {
        x.fillStyle = col;
        for (let i = 0; i < r; i++) {
          const ww = r * 7 - i * 11, yy = cy - r * 7 + i * 13;
          if (ww > 0) x.fillRect(cx - ww / 2, yy, ww, 11);
        }
        if (coreCol) { x.fillStyle = coreCol; x.fillRect(cx - r * 3, cy - r * 2, r * 6, r * 4); }
      };
      /** 云（可着色：火山灰云 / 夜空云） */
      const cloud = (col, shade) => strip(64, 28, (c) => {
        c.fillStyle = col;
        c.fillRect(12, 8, 40, 12);
        c.fillRect(4, 14, 56, 8);
        c.fillRect(20, 4, 24, 8);
        c.fillStyle = shade;
        c.fillRect(4, 18, 56, 4);
      });
      /** 底部起伏剪影（远山/沙丘/雪丘通用） */
      const bumps = (c, w, h, pts, col) => {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(0, h);
        pts.forEach(p => c.lineTo(p[0], p[1]));
        c.lineTo(w, h);
        c.closePath(); c.fill();
      };

      this.bg = {};

      /* —— 草原（原版） —— */
      this.bg.grassland = {
        sky: sky([[0, '#5fb4e8'], [0.55, '#a8ddf5'], [1, '#e6f6ff']], x => {
          x.fillStyle = '#ffe08a';
          for (let r = 0; r < 5; r++) {
            const w = 70 - r * 10, y = 66 + r * 12;
            x.fillRect(830 - w / 2, y, w, 10);
          }
          x.fillStyle = '#fff3c4';
          x.fillRect(806, 90, 48, 26);
        }),
        far: strip(480, 200, (c, w, h) => {
          bumps(c, w, h, [[0, 150], [70, 70], [150, 130], [230, 50], [320, 120], [400, 80], [480, 140]], '#8ba6c4');
          c.fillStyle = '#a9c0da';
          [[70, 70], [230, 50], [400, 80]].forEach(p => c.fillRect(p[0] - 10, p[1] + 8, 20, 8));
        }),
        mid: strip(480, 120, (c, w, h) => {
          bumps(c, w, h, [[0, 80], [90, 40], [200, 75], [310, 35], [420, 70], [480, 55]], '#6ab85c');
          c.fillStyle = '#86d078';
          for (let i = 0; i < 60; i++) c.fillRect(rand(0, w), rand(45, 100), 4, 4);
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#4f9e44'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#67bd57'; c.fillRect(0, 0, w, 14);
          c.fillStyle = '#7ed46d';
          for (let i = 0; i < 90; i++) c.fillRect(rand(0, w), rand(0, 12), 6, 3);
          c.fillStyle = '#3c7d34';
          for (let i = 0; i < 70; i++) c.fillRect(rand(0, w), rand(20, h - 6), 4, 6);
          c.fillStyle = '#2f6629';
          for (let i = 0; i < 40; i++) c.fillRect(rand(0, w), rand(30, h - 10), 8, 4);
          for (let i = 0; i < 8; i++) { c.fillStyle = '#ffd93b'; c.fillRect(rand(0, w), rand(6, 14), 4, 4); }
        }),
        cloud: cloud('#ffffff', '#dceeff')
      };

      /* —— 沙漠：仙人掌地图，黄沙烈日 —— */
      this.bg.desert = {
        sky: sky([[0, '#8fd0ef'], [0.6, '#f3e3b3'], [1, '#f7d98c']], x => {
          disk(x, 820, 86, 5, '#fff0b8', '#fff9e0');
        }),
        far: strip(480, 200, (c, w, h) => {
          bumps(c, w, h, [[0, 160], [120, 130], [260, 150], [380, 120], [480, 145]], '#e0bd7c');
          // 远处金字塔
          c.fillStyle = '#c9a45c';
          [[110, 170, 120], [330, 175, 90]].forEach(([px, py, pw]) => {
            c.beginPath(); c.moveTo(px - pw / 2, py); c.lineTo(px, py - 78); c.lineTo(px + pw / 2, py); c.closePath(); c.fill();
            c.fillStyle = '#d9b46e';
            c.beginPath(); c.moveTo(px, py - 78); c.lineTo(px + pw / 2, py); c.lineTo(px + pw * 0.18, py); c.closePath(); c.fill();
            c.fillStyle = '#c9a45c';
          });
        }),
        mid: strip(480, 120, (c, w, h) => {
          bumps(c, w, h, [[0, 85], [100, 45], [220, 80], [340, 40], [480, 70]], '#e6c37f');
          c.fillStyle = '#d4af6f';
          for (let i = 0; i < 40; i++) c.fillRect(rand(0, w), rand(50, 100), 8, 2);
          c.fillStyle = '#c9a45c';
          for (let i = 0; i < 20; i++) c.fillRect(rand(0, w), rand(60, 105), 4, 4);
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#e0b874'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#f0d496'; c.fillRect(0, 0, w, 14);
          c.fillStyle = '#d4af6f';
          for (let i = 0; i < 60; i++) c.fillRect(rand(0, w), rand(14, 40), 10, 2);
          c.fillStyle = '#b98d4e';
          for (let i = 0; i < 50; i++) c.fillRect(rand(0, w), rand(30, h - 8), 5, 4);
          c.fillStyle = '#c9a45c';
          for (let i = 0; i < 30; i++) c.fillRect(rand(0, w), rand(40, h - 10), 8, 3);
        }),
        cloud: cloud('#ffffff', '#f0e2c0')
      };

      /* —— 雪地：冰山地图，灰白阴天 —— */
      this.bg.snow = {
        sky: sky([[0, '#b8cfe0'], [0.6, '#dfeaf3'], [1, '#f6fafc']], x => {
          disk(x, 800, 80, 4, '#fdfdfd', '#ffffff');
        }),
        far: strip(480, 200, (c, w, h) => {
          c.fillStyle = '#cfe2ef';
          const peaks = [[0, 180], [60, 60], [130, 140], [200, 40], [280, 120], [360, 70], [430, 130], [480, 100]];
          c.beginPath(); c.moveTo(0, h);
          peaks.forEach(p => c.lineTo(p[0], p[1]));
          c.lineTo(w, h); c.closePath(); c.fill();
          c.fillStyle = '#ffffff';
          peaks.filter(p => p[1] < 100).forEach(p => {
            c.beginPath(); c.moveTo(p[0] - 26, p[1] + 30); c.lineTo(p[0], p[1]); c.lineTo(p[0] + 26, p[1] + 30); c.closePath(); c.fill();
          });
        }),
        mid: strip(480, 120, (c, w, h) => {
          bumps(c, w, h, [[0, 85], [110, 50], [240, 85], [360, 45], [480, 75]], '#f2f8fc');
          c.fillStyle = '#d2e4f0';
          for (let i = 0; i < 50; i++) c.fillRect(rand(0, w), rand(50, 105), 6, 3);
          c.fillStyle = '#bfe0f5';
          for (let i = 0; i < 12; i++) c.fillRect(rand(0, w), rand(60, 100), 22, 5);
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#eef6fd'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, 14);
          c.fillStyle = '#d2e4f0';
          for (let i = 0; i < 70; i++) c.fillRect(rand(0, w), rand(16, h - 8), 7, 3);
          c.fillStyle = '#bfe0f5';
          for (let i = 0; i < 16; i++) c.fillRect(rand(0, w), rand(30, h - 12), 26, 6);
          c.fillStyle = '#ffffff';
          for (let i = 0; i < 60; i++) c.fillRect(rand(0, w), rand(0, 12), 5, 4);
        }),
        cloud: cloud('#f4f8ff', '#dce8f5')
      };

      /* —— 火焰山：尖石地图，暗红火山天空 —— */
      this.bg.volcano = {
        sky: sky([[0, '#2e1a22'], [0.55, '#6b2f2c'], [1, '#c2602e']], x => {
          disk(x, 760, 96, 5, '#e8804a', '#ffb066');
          x.fillStyle = 'rgba(255,140,60,0.18)';
          x.fillRect(0, 380, CFG.W, 160);
        }),
        far: strip(480, 200, (c, w, h) => {
          c.fillStyle = '#2e1a1a';
          const cones = [[0, 180, 110], [120, 170, 150], [300, 175, 120], [420, 165, 130]];
          cones.forEach(([px, py, pw]) => {
            c.beginPath(); c.moveTo(px - pw / 2, py); c.lineTo(px, py - 90); c.lineTo(px + pw / 2, py); c.closePath(); c.fill();
          });
          // 火山口红光
          c.fillStyle = '#ff7b2e';
          c.fillRect(118, 76, 10, 8);
          c.fillStyle = '#ffd23b';
          c.fillRect(120, 78, 6, 4);
        }),
        mid: strip(480, 120, (c, w, h) => {
          bumps(c, w, h, [[0, 90], [80, 40], [180, 80], [280, 30], [380, 75], [480, 50]], '#5a3730');
          c.fillStyle = '#ff7b2e';
          for (let i = 0; i < 10; i++) c.fillRect(rand(0, w), rand(60, 105), 4, 4);
          c.fillStyle = '#ffd23b';
          for (let i = 0; i < 6; i++) c.fillRect(rand(0, w), rand(70, 105), 3, 3);
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#3a2b27'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#4a362f'; c.fillRect(0, 0, w, 14);
          c.fillStyle = '#2b1d1f';
          for (let i = 0; i < 50; i++) c.fillRect(rand(0, w), rand(20, h - 8), 8, 6);
          // 熔岩裂纹
          for (let i = 0; i < 7; i++) {
            let lx = rand(0, w), ly = rand(20, h - 20), ll = randi(3, 7);
            c.fillStyle = '#ff7b2e';
            for (let j = 0; j < ll; j++) { c.fillRect(lx, ly, 10, 4); lx += 8; ly += rand(-8, 8); }
            c.fillStyle = '#ffd23b';
            c.fillRect(lx - 8 * ll + 2, 0, 0, 0);
          }
          c.fillStyle = '#ffd23b';
          for (let i = 0; i < 14; i++) c.fillRect(rand(0, w), rand(20, h - 10), 3, 3);
        }),
        cloud: cloud('#5a504c', '#453d3a')
      };

      /* —— 紫色荒地：枯木地图，黄昏紫天 —— */
      this.bg.wasteland = {
        sky: sky([[0, '#241b3a'], [0.55, '#4a2f5c'], [1, '#8e4a78']], x => {
          disk(x, 780, 84, 4, '#e8dff5', '#f5efff');
          x.fillStyle = '#cdbfe0';
          x.fillRect(770, 78, 6, 4); x.fillRect(792, 92, 5, 4);
        }),
        far: strip(480, 200, (c, w, h) => {
          // 平顶山（mesa）
          c.fillStyle = '#3d2b4d';
          [[40, 90, 120], [230, 70, 150], [400, 100, 110]].forEach(([px, top, pw]) => {
            c.fillRect(px - pw / 2, top, pw, h - top);
            c.fillStyle = '#4e3762'; c.fillRect(px - pw / 2, top, pw, 10); c.fillStyle = '#3d2b4d';
          });
          // 枯树剪影
          c.fillStyle = '#2a1d38';
          for (let i = 0; i < 5; i++) {
            const tx = rand(20, w - 20), ty = rand(120, 180);
            c.fillRect(tx - 2, ty, 5, h - ty);
            c.fillRect(tx - 14, ty - 10, 12, 4);
            c.fillRect(tx + 4, ty - 18, 12, 4);
          }
        }),
        mid: strip(480, 120, (c, w, h) => {
          bumps(c, w, h, [[0, 85], [110, 50], [240, 80], [360, 45], [480, 70]], '#5a3f63');
          c.fillStyle = '#33243b';
          for (let i = 0; i < 40; i++) c.fillRect(rand(0, w), rand(50, 105), 4, 7);
          c.fillStyle = '#6e4f7a';
          for (let i = 0; i < 30; i++) c.fillRect(rand(0, w), rand(55, 100), 6, 3);
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#46324e'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#573f5f'; c.fillRect(0, 0, w, 14);
          c.fillStyle = '#2c1f36';
          for (let i = 0; i < 60; i++) c.fillRect(rand(0, w), rand(18, 40), 3, 8);
          c.fillStyle = '#33243b';
          for (let i = 0; i < 40; i++) c.fillRect(rand(0, w), rand(30, h - 10), 9, 3);
          c.fillStyle = '#6e4f7a';
          for (let i = 0; i < 25; i++) c.fillRect(rand(0, w), rand(36, h - 8), 6, 4);
        }),
        cloud: cloud('#4a3d5e', '#372c48')
      };

      /* —— 赛博朋克都市：电线杆/电话亭/破楼地图，霓虹夜空 —— */
      this.bg.cyber = {
        sky: sky([[0, '#0b0e26'], [0.55, '#1c1440'], [1, '#43205f']], x => {
          for (let i = 0; i < 50; i++) {
            x.fillStyle = ['#ffffff', '#35e0ff', '#ff4fd8'][i % 3];
            x.fillRect(rand(0, CFG.W), rand(10, 300), 2, 2);
          }
          disk(x, 800, 80, 4, '#b8c0ff', '#e8e0ff');
          x.fillStyle = 'rgba(255,79,216,0.12)';
          x.fillRect(0, 360, CFG.W, 110);
          x.fillStyle = 'rgba(53,224,255,0.10)';
          x.fillRect(0, 420, CFG.W, 50);
        }),
        far: strip(480, 200, (c, w, h) => {
          c.fillStyle = '#141830';
          let bx = 0;
          while (bx < w) {
            const bw = randi(30, 60), bh = randi(60, 150);
            c.fillRect(bx, h - bh, bw, bh);
            for (let wy = h - bh + 8; wy < h - 10; wy += 14) {
              for (let wx = bx + 5; wx < bx + bw - 6; wx += 10) {
                if (Math.random() < 0.35) {
                  c.fillStyle = ['#ffd93b', '#35e0ff', '#ff4fd8'][randi(0, 2)];
                  c.fillRect(wx, wy, 4, 6);
                  c.fillStyle = '#141830';
                }
              }
            }
            bx += bw + randi(2, 8);
          }
        }),
        mid: strip(480, 120, (c, w, h) => {
          c.fillStyle = '#232a44';
          let bx = 0;
          while (bx < w) {
            const bw = randi(50, 90), bh = randi(50, 105);
            c.fillRect(bx, h - bh, bw, bh);
            for (let wy = h - bh + 8; wy < h - 8; wy += 16) {
              for (let wx = bx + 6; wx < bx + bw - 8; wx += 14) {
                if (Math.random() < 0.5) {
                  c.fillStyle = ['#ffd93b', '#35e0ff', '#ff4fd8', '#ffffff'][randi(0, 3)];
                  c.fillRect(wx, wy, 6, 8);
                }
              }
            }
            // 霓虹竖招牌
            if (Math.random() < 0.5) {
              c.fillStyle = Math.random() < 0.5 ? '#ff4fd8' : '#35e0ff';
              c.fillRect(bx + 2, h - bh + 10, 3, bh - 24);
            }
            bx += bw + 4;
          }
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#23262e'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#2d313b'; c.fillRect(0, 0, w, 14);
          // 车道虚线
          c.fillStyle = '#f5d742';
          for (let x = 0; x < w; x += 48) c.fillRect(x, 52, 26, 5);
          // 霓虹路边灯
          c.fillStyle = '#35e0ff';
          for (let i = 0; i < 20; i++) c.fillRect(rand(0, w), 16, 3, 3);
          c.fillStyle = '#ff4fd8';
          for (let i = 0; i < 20; i++) c.fillRect(rand(0, w), 24, 3, 3);
          c.fillStyle = '#191c24';
          for (let i = 0; i < 25; i++) c.fillRect(rand(0, w), rand(30, h - 8), 10, 4);
        }),
        cloud: cloud('#2a2f4a', '#1d2138')
      };

      /* —— 大海：礁石/珊瑚地图，海水动态绘制（无地面条带） —— */
      this.bg.ocean = {
        sky: sky([[0, '#7cc8ee'], [0.6, '#b7e6fb'], [1, '#eaf9ff']], x => {
          disk(x, 820, 86, 5, '#fff0b8', '#fff9e0');
        }),
        far: strip(480, 200, (c, w, h) => {
          // 远海波浪条带
          c.fillStyle = '#7fbfe6';
          for (let y = 90; y < h; y += 22) c.fillRect(0, y, w, 8);
          c.fillStyle = '#a8d8f0';
          for (let y = 100; y < h; y += 22) c.fillRect(0, y, w, 5);
          c.fillStyle = '#d8f2ff';
          for (let i = 0; i < 30; i++) c.fillRect(rand(0, w), rand(90, 180), 14, 3);
          // 远处小岛
          c.fillStyle = '#d9c18a';
          c.beginPath(); c.ellipse(360, 168, 46, 14, 0, 0, TAU); c.fill();
          c.fillStyle = '#5fae6a';
          c.fillRect(356, 150, 10, 18);
        }),
        mid: strip(480, 120, (c, w, h) => {
          c.fillStyle = '#9fd0ec';
          for (let y = 40; y < h; y += 26) {
            for (let x = 0; x < w; x += 64) c.fillRect(x + (y % 52 ? 0 : 20), y, 34, 7);
          }
          c.fillStyle = '#ffffff';
          for (let i = 0; i < 40; i++) c.fillRect(rand(0, w), rand(30, 110), 16, 3);
        }),
        ground: null,
        cloud: cloud('#ffffff', '#dceeff')
      };

      // 兼容旧引用
      this.sky = this.bg.grassland.sky;
      this.mountains = this.bg.grassland.far;
      this.hills = this.bg.grassland.mid;
      this.ground = this.bg.grassland.ground;
      this.cloud = this.bg.grassland.cloud;
    }

    /** 大海：波浪海平面（逐帧绘制；波动期间幅度变大 + 海面上升） */
    renderSea(ctx) {
      const s = this.sea;
      const t = this.state === 'menu' ? performance.now() / 1000 : s.t;
      const base = CFG.GROUND_Y - s.rise;
      // 深水 / 中水色带
      ctx.fillStyle = '#1b5a96';
      ctx.fillRect(0, base + 26, CFG.W, CFG.H - (base + 26));
      ctx.fillStyle = '#2b7fc8';
      ctx.fillRect(0, base + 10, CFG.W, 24);
      // 波浪表面：逐列亮带 + 波峰白浪
      for (let x = 0; x <= CFG.W; x += 8) {
        const w1 = Math.sin(x * 0.018 + t * 1.7) * s.amp;
        const w2 = Math.sin(x * 0.041 - t * 2.9) * s.amp * 0.45;
        const sy = base + w1 + w2;
        ctx.fillStyle = '#4aa3e0';
        ctx.fillRect(x, sy, 8, 12);
        ctx.fillStyle = '#7fc6ef';
        ctx.fillRect(x, sy, 8, 5);
        const crest = Math.sin(x * 0.018 + t * 1.7);
        if (crest > 0.55) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, sy - 2, 8, 3); }
        else if (crest > 0.15) { ctx.fillStyle = '#d8f2ff'; ctx.fillRect(x, sy - 1, 8, 2); }
      }
    }

    /** 火焰山火山口：地面熔岩丘装饰（无碰撞，接触不死亡不掉血） */
    renderCrater(ctx) {
      const c = this.crater;
      const cx = c.x, base = CFG.GROUND_Y;
      const rumble = c.rumble || 0;
      const jx = rumble > 0 ? rand(-2, 2) : 0;
      // 玄武岩矮丘（梯形分层）
      const w = 200;
      for (let r = 0; r < 5; r++) {
        const yy = base - 10 - r * 8;
        const inset = r * 15;
        ctx.fillStyle = r < 2 ? '#1d1416' : (r % 2 ? '#3a2626' : '#2b1d20');
        ctx.fillRect(cx - w / 2 + inset + jx, yy, w - inset * 2, 8);
      }
      // 中央喷火口：脉动熔岩
      const pulse = 0.85 + Math.sin(performance.now() / 130) * 0.15 + rumble * 0.6;
      const gw = 68 * pulse, gh = 14 + rumble * 8;
      ctx.fillStyle = '#c94a1e';
      ctx.fillRect(cx - gw / 2 - 6, base - 50, gw + 12, gh + 10);
      ctx.fillStyle = '#ff7b2e';
      ctx.fillRect(cx - gw / 2, base - 48, gw, gh);
      ctx.fillStyle = '#ffd23b';
      ctx.fillRect(cx - gw * 0.35, base - 46, gw * 0.7, gh * 0.55);
      ctx.fillStyle = '#fff5d0';
      ctx.fillRect(cx - gw * 0.16, base - 44, gw * 0.32, gh * 0.3);
      // 喷口黑岩沿
      ctx.fillStyle = '#1d1416';
      ctx.fillRect(cx - gw / 2 - 12, base - 52, 12, 22);
      ctx.fillRect(cx + gw / 2, base - 52, 12, 22);
    }

    drawTiled(img, y, par, totalH) {
      const w = img.width;
      const off = (this.scrollX * par) % w;
      for (let x = -off; x < CFG.W + w; x += w) {
        this.ctx.drawImage(img, x, y, w, totalH || img.height);
      }
    }

    /* ---------------- 渲染 ---------------- */
    render() {
      const ctx = this.ctx;
      ctx.save();
      if (this.shakeMag > 0.2) {
        ctx.translate(rand(-this.shakeMag, this.shakeMag) * 0.5, rand(-this.shakeMag, this.shakeMag) * 0.5);
      }

      // 背景（按当前地图主题）
      const bg = this.bg[this.mapId] || this.bg.grassland;
      ctx.drawImage(bg.sky, 0, 0);
      this.clouds.forEach(c => {
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(bg.cloud, c.x, c.y, bg.cloud.width * c.s, bg.cloud.height * c.s);
      });
      ctx.globalAlpha = 1;
      this.drawTiled(bg.far, 300, 0.12, 200);
      this.drawTiled(bg.mid, 400, 0.28, 120);
      if (bg.ground) this.drawTiled(bg.ground, CFG.GROUND_Y, 0.55, CFG.H - CFG.GROUND_Y);
      // 大海：动态波浪海平面（画在实体层前，礁石/珊瑚立在海中）
      if (this.sea) this.renderSea(ctx);
      // 火焰山：火山口场景装饰（无碰撞）
      if (this.crater) this.renderCrater(ctx);

      if (this.state !== 'menu') {
        // 山石障碍（地面层）
        this.rocks.forEach(r => r.render(ctx));
        // 宝石
        this.gems.forEach(g2 => g2.render(ctx));
        // 闪电预警层
        this.lightnings.forEach(l => { if (l.t < l.warn) l.render(ctx); });
        // 敌人 / Boss
        this.enemies.forEach(e => e.render(ctx));
        this.bosses.forEach(b => b.render(ctx));
        // 玩家
        if (this.player.hp > 0) this.player.render(ctx);
        // 闪电链电弧（子弹层前）：白色粗线 + 黄色细线
        this.arcs.forEach(a => {
          const alpha = clamp(1 - a.t / a.life, 0, 1);
          ctx.globalAlpha = alpha;
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5;
          ctx.beginPath();
          a.pts.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y));
          ctx.stroke();
          ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
        // 子弹
        this.bullets.forEach(b => b.render(ctx));
        // 闪电打击层
        this.lightnings.forEach(l => { if (l.t >= l.warn) l.render(ctx); });
        // 长线光束（狗王解体攻击）
        this.beams.forEach(b => b.render(ctx));
        // 粒子
        this.particles.forEach(p => p.render(ctx));
        // Toast
        this.toasts.forEach(t => {
          const a = clamp(t.t / 0.5, 0, 1);
          ctx.globalAlpha = a;
          ctx.font = 'bold 26px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#000';
          ctx.fillText(t.text, CFG.W / 2 + 2, 122);
          ctx.fillStyle = '#ffe08a';
          ctx.fillText(t.text, CFG.W / 2, 120);
          ctx.globalAlpha = 1;
          ctx.textAlign = 'left';
        });
      } else {
        // 菜单展示白猫主角（右下角浮空，直接绘制原图）
        const cat = Sprites.cat;
        if (cat) {
          const bob = Math.sin(performance.now() / 400) * 8;
          const targetLen = 230;
          const sc = targetLen / cat.width;
          const w = cat.width * sc, h = cat.height * sc;
          ctx.save();
          ctx.globalAlpha = 0.96;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cat, CFG.W - 110 - w / 2, CFG.H - 150 - h / 2 + bob, w, h);
          ctx.restore();
        } else {
          // 素材缺失提示
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('未找到 assets/cat.png，请放入白猫图片', CFG.W - 260, CFG.H - 120);
          ctx.restore();
        }
      }

      // 大招光波（金光扩散环）
      if (this.ultWave) {
        const w = this.ultWave;
        const cx = this.player.x, cy = this.player.y;
        ctx.save();
        ctx.globalAlpha = w.a;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 24;
        ctx.beginPath(); ctx.arc(cx, cy, w.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#ffd93b'; ctx.lineWidth = 12;
        ctx.beginPath(); ctx.arc(cx, cy, w.r * 0.86, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,236,170,0.7)'; ctx.lineWidth = 30;
        ctx.beginPath(); ctx.arc(cx, cy, w.r * 0.7, 0, TAU); ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      // 屏幕闪光（全屏，不受震屏影响）
      if (this.flashT > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.85, this.flashT / 0.5) * 0.85;
        ctx.fillStyle = this.flashColor || '#fff';
        ctx.fillRect(0, 0, CFG.W, CFG.H);
        ctx.restore();
      }
    }
  }

  window.game = new Game();
})();
