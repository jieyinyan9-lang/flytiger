/* ============================================================
 * game.js —— 主循环 / 背景 / 刷怪 / 成长 / Boss 调度 / 碰撞
 * ============================================================ */
(function () {
  'use strict';

  const { Player, Enemy, Gem, Bullet, Particle, Rock, Breakable, GrassDragon, burst, rand, randi, clamp } = window.FT;
  const { setShooter, clearShooter } = window.FT;
  const Hazards = window.FT.Hazards;
  const TAU = Math.PI * 2;

  /* ============================================================
   * 死法文案：格式「{角色名}被{敌人名}{action}」
   * action 接在敌人名之后（部分以"的/用"开头），红色大字显示
   * ============================================================ */
  const DEATH_LINES = {
    enemy: {
      eagle: ['俯冲撞穿了胸膛', '用翅膀扇下了悬崖摔死了'],
      bat: ['群活活撞烂了脸', '缠住了脖子窒息而亡'],
      skeleton: ['贴身炸成了碎块', '的自爆冲击波震碎了五脏六腑'],
      demon: ['的火花弹打穿了脑门', '双发火花弹夹击烧成了灰', '悬停瞄准后一枪爆了头'],
      skull: ['连射光弹打成了筛子', '瞄准扫射击碎了膝盖后倒地再被射穿', '持续锁定连射钉死在了墙上'],
      archer: ['抛物线箭矢射穿了天灵盖', '冷箭射中了喉咙', '从背后一箭穿心'],
      cannoneer: ['重型炮弹炸飞了半边身子', '连射重炮轰成了肉渣', '定点炮击直接砸成了肉饼'],
      superboy: ['细激光切断了脖子', '激光射穿了眼窝烧进了脑子', '细激光炸毁山石后活埋了'],
      leigong: ['纵向闪电从头顶劈成了焦炭', '双雷夹击电得连骨头都冒烟了', '落雷劈中后跳起来又挨了第二下'],
      pig: ['火球炸成了烤全人', '双发火球爆裂后的碎片扎成了刺猬', '火球碎片崩瞎了双眼后踩空摔死'],
      bigbat: ['S形黑飞刀削掉了天灵盖', '5发散射飞刀钉成了门板', '贴身撞飞后落地摔断了脖子', '飞刀割断了脚筋后被活活咬死'],
      grassdragon: ['龙鳞刺射穿了太阳穴', '钻地时撞断了双腿后吞掉了', '分裂的小段缠住身体绞成了肉泥', '从地下破土而出顶穿了肚子'],
      spikebird: ['10向散射羽毛弹打成了蜂窝', '羽毛弹糊了一脸窒息而亡'],
      eyefly: ['锁定魔法弹正中眉心', '连发魔法弹轰碎了胸膛'],
      stonebeetle: ['蓄力魔法矛贯穿了心脏', '极快魔法矛钉穿后拖行了百米'],
      floatflower: ['12向环形刺球弹幕绞成了肉馅', '刺球弹幕从脚到头打成了筛子'],
      stormfish: ['S形波浪风暴弹撞断了肋骨', '三发风暴弹连环命中炸成了碎片'],
      twinsnake: ['交叉菱形弹幕切开了喉咙', '双头交替连射打成了烂泥'],
      owl: ['追踪魔法羽毛追到天涯海角后穿心', '连续5发自机狙羽毛扎成了仙人掌'],
      javelinSlave: [
        '的倒刺标枪贯穿了胸口，拔都拔不出来',
        '瞄准齿轮眼锁定了三秒后一枪钉穿了脑门',
        '标枪上的倒刺扯断了整条肋骨',
        '连续两发标枪钉在了墙上像挂件一样'
      ],
      ramFighter: [
        '巨型螺旋羊角顶穿了肚子',
        '三叉短戟捅了个对穿',
        '弹簧腿一脚踹飞出去撞碎了脊柱',
        '脖子上的生锈铁链勒住了喉咙活活拖死'
      ],
      shieldSlave: [
        '弧形青铜塔盾拍扁了脑袋',
        '短铁棒敲碎了天灵盖',
        '盾推着撞上了墙壁挤成了肉饼',
        '铁棒抡断了三根肋骨后吐血而亡'
      ],
      puppet: [
        '飞刀插满了后背像只刺猬',
        '飞刀割断了膝盖的筋，跪下后又被抹了脖子',
        '石膏裂纹手指戳进了眼窝',
        '纸片般的身形绕到背后一刀捅穿了腰子'
      ],
      bombPrisoner: [
        '贴脸自爆炸飞了半边身子',
        '火油麻布点燃后活活烧成了焦炭',
        '引信火花溅到身上炸成了一团火球',
        '金属箍崩断后碎片扎穿了喉咙'
      ],
      axeMinion: [
        '一斧头抡在了天灵盖上',
        '双刃飞斧转着圈劈中了眉心',
        '高抛的斧头落下来时削掉了脑袋',
        '西装革履地走来，一斧头劈开了胸膛'
      ]
    },
    boss: {
      pigking: ['三连大火球炸上了天摔死了', '弧形扇形火焰喷成了烤乳猪', '盘旋走位时一头撞飞掉进了岩浆'],
      thunderbehemoth: ['纵三连落雷劈成了三段', '横双道闪电切成了三截', 'X形对角斜闪电钉穿后电成灰', '半血狂暴竖雷夹击电到脑浆迸裂'],
      samurai: ['手里剑散射割断了颈动脉', '蓄力掷出的武士刀钉穿了肚子', '蓄力冲刺斩拦腰砍成了两段'],
      swordeagle: ['白尾扫断了脖子', '羽毛扇形齐射打成了漏勺', '旋风弹卷飞后高空坠落摔碎了', '蓄力旋转突袭冲锋撞烂了胸腔'],
      skullking: ['瞄准连射打穿了脑壳', '扇形9连弹轰成了肉末', '12向环弹带着魂火拖尾烧穿了全身'],
      dogking: ['狗头环形弹咬掉了脑袋', '机械狗腿夹击挤成了肉饼', '半血解体后肢体连击打碎了所有骨头', '长线光束扫过拦腰切成了两半'],
      giantpheasant: ['高速炮弹炸飞了脑袋', '炮口散射打成了蜂窝煤', '弧形喷火烧成了焦尸', '尾部巨型追踪导弹追到炸成了碎渣'],
      homelander: ['三束激光同时烧穿了三个洞', '贴地冲刺撞断了所有肋骨', '旋转激光扫射切成了一段一段的', '瞬移激光从背后射穿了后脑勺'],
      bossman: ['西装巨人漂浮弹砸扁了', '召唤的军队乱刀砍成了肉泥', '半血变身破损巨头双眼激光烧化了半边身子'],
      stranger: ['S形冲刺撞碎了头骨', '飞刀插满了全身', '巨型十字弹追击后碎裂扎穿了', '十字弹命中后被吸干了血'],
      frogking: ['弧形跳跃砸扁了脑壳', '蓄力冲撞顶飞后撞墙撞死了', '吐舌贯穿全屏卷过去后摔断了脖子', '贴脸爪击掏出了心脏'],
      cranesage: ['风炮连射击穿了胸膛', '龙卷风卷碎了全身骨头', '镜面反射的激光切成了两半', '高速风刃凌迟成了碎片', '锁血气波冲击震碎了内脏'],
      sphinx: ['双爪扇形石片割开了喉咙', '贴地冲击波震断了双腿后倒地摔死', '双眼扫射烧穿了胸腔', '横冲撞甩月牙刃腰斩了', '双螺旋弹幕和三组连击绞成了肉渣'],
      niumo: ['牛角散射射穿了五脏六腑', '牛头冲撞顶碎了胸腔', '双角夹击挤成了肉饼', '追踪魔角追击后穿颅而亡', '魔王爆发齐射轰成了碎末'],
      bonedragonking: ['钻地出土时冲撞砸烂了全身', '绿火连射烧成了骨渣', '头部碎裂后崩解的骨龙群啃食殆尽', '小骨蛇缠满全身绞断了每一根骨头'],
      madhyena: ['怒吼声波震裂了全身骨骼', '疾冲撞击顶穿了胸膛', '钻地突袭从脚下刺穿了肚子'],
      raccoonrover: ['玫红能量印记炸碎了半边身子', '悬浮板疾冲撞飞后高空坠落摔死', '游走轨迹的连环能量残爆撕碎了内脏'],
      sandwalker: ['巨型沙之刺钉穿了身体', '全屏沙刺弹幕扎成了筛子', '召唤的双头飞蛇缠住绞杀了'],
      captaingeorge: ['大号橙红炮弹轰成了碎渣', '弧形俯冲撞碎了全身骨头', '俯冲过后的炮火追着炸成了焦炭'],
      fireblind: ['半屏宽火焰斩拦腰烧成了两截', '火龙冲刺挥刀劈成了两半', '三道窄火焰斩交错切成了碎片'],
      purplehand: ['紫红扇形魔弹打成了筛子', '高速狐火弹贯穿了心脏', '自转巨牌弧线扫中后削掉了脑袋', '六牌阵齐射的魔光绞成了肉末']
    }
  };
  /** Boss 死法池 key → 显示名 */
  const BOSS_DEATH_NAMES = {
    pigking: '火焰飞猪王', thunderbehemoth: '雷公巨兽', samurai: '飞天日本武士',
    swordeagle: '铁鹰', skullking: '亡灵骷髅王', dogking: '飞天狗王',
    giantpheasant: '火鸡王', homelander: '怒星使', bossman: '斧王',
    stranger: '怪客', frogking: '蛙哥', cranesage: '鹤仙',
    sphinx: '狮身人面像', niumo: '牛魔', bonedragonking: '巨型骨龙王',
    madhyena: '癫狂鬣狗', raccoonrover: '浣熊漫游者', sandwalker: '沙之行者',
    captaingeorge: '乔治船长', fireblind: '火遮眼', purplehand: '紫手'
  };
  /** 死亡演出时序（秒）：黑气涌入 2.4s → 文本逐字 → 完全显示后停留 3s（总上限 10s）→ 黑色淡出 1.6s */
  const DEATH_FX = { BLACK_IN: 2.4, HOLD_AFTER: 3, AUTO_MAX: 10, FADE_OUT: 1.6 };


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
        bossBarGhost: document.getElementById('boss-bar-ghost'),
        bossBarFlash: document.getElementById('boss-bar-flash'),
        bossBarFx: document.getElementById('boss-bar-fx'),
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
        menuMapBtn: document.getElementById('menu-map-btn'),
        charSel: document.getElementById('charsel'),
        charGrid: document.getElementById('char-grid'),
        charSelTitle: document.getElementById('charsel-title'),
        standbyName: document.getElementById('standby-name'),
        standbyAvatar: document.getElementById('standby-avatar'),
        standbyDetail: document.getElementById('standby-detail'),
        reward: document.getElementById('reward')
      };
      // 按钮统一走 onClick 安全绑定：元素缺失（如浏览器缓存了旧版 HTML）时仅跳过并告警，
      // 绝不能让构造函数中断——否则 reset()/主循环不启动，背景音乐与音效会全部静默
      this.onClick('start-btn', () => this.start());
      this.onClick('select-btn', () => this.openCharSelect());
      this.onClick('ach-btn', () => { if (window.Ach) Ach.openPanel(); });
      this.onClick('menu-wh-btn', () => { if (window.WH) WH.openPanel(); });
      // 任务委托 / 秘境发现入口
      this.onClick('menu-mission-btn', () => { if (window.MISSIONS) MISSIONS.openPanel(); });
      this.onClick('menu-discover-btn', () => { if (window.MISSIONS) MISSIONS.openDiscover(); });
      if (window.MISSIONS) {
        // 派遣/归来：刷新选角状态；若备战猫被派出则自动改派
        MISSIONS.onCharDirty(() => this.syncMissionStatuses());
        // 发现面板启动特殊关：前哨遭遇复用月痕沙海关卡
        MISSIONS.onLaunchStage(s => {
          if (s && s.launch === 'moondesert') { MISSIONS.notifyLaunched(s.id); this.startStage(); }
        });
        MISSIONS.refreshDots();
      }
      // 仓库藏品圆满解锁角色：刷新选角列表 + 菜单提示（解锁音效由仓库投币链路播放）
      if (window.WH) WH.onUnlock(id => {
        try { this.buildCharGrid(); } catch (e) {}
        const c = window.CHARS && window.CHARS.get(id);
        this.toast(`🏮 新角色「${c ? c.name : id}」已加入角色选择！`, 3.2, 'lt');
      });
      this.onClick('restart-btn', () => this.start());
      this.onClick('home-btn', () => this.backToMenu());
      this.onClick('pause-restart-btn', () => this.start());
      this.onClick('pause-resume-btn', () => this.togglePause());
      this.onClick('pause-select-btn', () => this.openCharSelect(true));
      this.onClick('char-back-btn', () => this.closeCharSelect());
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

      // 月痕沙海奖励页：点击任意位置退回主界面
      const rewardEl = this.el.reward;
      if (rewardEl) rewardEl.addEventListener('click', () => this.closeReward());

      // 地图选择偏好（'random' 或具体地图 id）：从 localStorage 恢复
      try {
        const saved = localStorage.getItem('flytiger_map');
        this.mapChoice = (saved === 'random' || (saved && CFG.maps.some(m => m.id === saved))) ? saved : 'random';
      } catch (e) { this.mapChoice = 'random'; }

      // 出战角色：从 localStorage 恢复；无偏好或角色仍处于锁定态则随机备战（仅从已解锁角色中取）
      try {
        const sc = localStorage.getItem('flytiger_char');
        this.charId = (sc && window.CHARS && window.CHARS.has(sc) && window.CHARS.isUnlocked(sc)) ? sc : null;
      } catch (e) { this.charId = null; }
      if (!this.charId) {
        const all = (window.CHARS && window.CHARS.ORDER) || ['xiaobai'];
        const pool = window.CHARS ? all.filter(id => window.CHARS.isUnlocked(id)) : all;
        this.charId = pool[Math.floor(Math.random() * pool.length)] || 'xiaobai';
        try { localStorage.setItem('flytiger_char', this.charId); } catch (e) {}
      }
      // 角色状态表（id → 空闲/备战/探索/委托）；默认仅备战角色为 ready
      this.charStatus = {};
      if (window.CHARS) window.CHARS.ORDER.forEach(id => { this.charStatus[id] = (id === this.charId) ? 'ready' : 'idle'; });
      // 委托中的猫咪（跨局持久化）覆盖状态；备战猫被派出时自动改派
      this.syncMissionStatuses();
      this.moodT = 0;                 // 心情刷新计时（局外每 10s 刷新一次）
      this.ultBubble = null;          // 大招气泡 { text, t }
      this.syncStandbyName();
      this.buildCharGrid();

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
          if (this.deathScene) { this.skipDeathScene(); e.preventDefault(); return; }
          if (this.settleOpen) { e.preventDefault(); return; }   // 委托结算浮层打开期间禁用重开
          if (this.state === 'menu' || this.state === 'gameover') this.start();
          else if (this.state === 'playing' && e.code === 'Space') this.player.tryUltimate(this);
          e.preventDefault();
        }
        if (e.code === 'KeyJ' && this.state === 'playing') this.player.tryUltimate(this);
        if ((e.code === 'KeyP' || e.code === 'Escape') && (this.state === 'playing' || this.state === 'paused')) {
          this.togglePause();
          e.preventDefault();
        }
        if (e.code === 'KeyM') this.toggleMute();
        if (e.code === 'KeyN') this.toggleBgm();
        // 月痕沙海关卡：仅可从「发现秘境」面板进入（已移除主界面按 1 快捷键）
        // 奖励页：点击任意位置或按键退回主界面（4s 后可操作）
        if (this.rewardShown && this.rewardCanClose) { this.closeReward(); e.preventDefault(); return; }
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
      ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach(ev =>
        window.addEventListener(ev, unlockAudio));
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

    /* ---------------- 背景音乐场景路由（assets/BGM 音频文件，切歌自动淡入淡出） ----------------
     * 局外 bgm-zhujiemian；地图：明亮(草原/沙漠/大海) bgm-mingliang、阴暗(火焰山/荒地) bgm-yinan、
     * 赛博都市 bgm-saibopengke、角斗场 bgm-jiaodouchang、月痕沙海 bgm-anheishamo；
     * 怪物潮 bgm-guaiwuchao；Boss 各自专属曲目（见 BOSS_LIST 的 music 字段），兜底 boss-1 */
    musicScene() {
      if (this.state === 'menu' || this.state === 'gameover') return 'bgm-zhujiemian';
      if (this.warnT > 0) return this.pendingBossMusic || 'boss-1';
      if (this.bosses.length) return this.bosses[0].musicTheme || 'boss-1';
      if (this.state === 'playing') {
        if (this.isTide) return 'bgm-guaiwuchao';
        switch (this.mapId) {
          case 'volcano':
          case 'wasteland':
          case 'seabed':
          case 'sky':
          case 'demoncave': return 'bgm-yinan';
          case 'cyber':
          case 'cave':
          case 'matrix': return 'bgm-saibopengke';
          case 'colosseum': return 'bgm-jiaodouchang';
          case 'moondesert': return 'bgm-anheishamo';
          // grassland / desert / ocean / jungle / snow / castle / mountains 及兜底：明亮风格
          default: return 'bgm-mingliang';
        }
      }
      return null;   // 三选一/暂停：保持当前曲目
    }
    updateMusic() {
      if (!window.Music) return;
      const scene = this.musicScene();
      if (scene) Music.play(scene);
    }

    /* ---------------- 开局 / 重置 ---------------- */
    reset() {
      this.player = new Player(this.charId);
      this.enemies = [];
      this.bosses = [];
      this.bullets = [];
      this.gems = [];
      this.particles = [];
      this.lightnings = [];
      this.beams = [];         // 长线光束（狗王解体攻击）
      this.arcs = [];          // 闪电链电弧视觉
      this.fxRings = [];       // 冲击波环（障碍碎裂爆炸等）{ x,y,r,vr,t,life,col }
      this.rocks = [];
      this.breakables = [];   // 破碎障碍物（子弹打满次数爆炸）
      this.breakQueue = [];   // 本轮破碎障碍出场时刻表
      this.envForce = { x: 0, y: 0 };   // 地图机关环境推力（水流/暴风雪）
      this.hz = null;                    // 当前地图机关调度状态（Hazards 模块）
      this.toasts = [];
      this.toastQueue = [];   // 待显示的 toast 队列（避免多条同时出现）
      this.activeToast = null; // 当前正在显示的 toast
      this.bossMaskAlpha = 0; // Boss 战黑红蒙版透明度（0~1）
      this.resetBossBarFx();  // Boss 血条斩击/灼烧演出状态
      this.ctrlMode = this.ctrlMode || 'keyboard';   // 操作模式：'keyboard' | 'mouse'（菜单选择）
      this.loopErr = null;      // 主循环异常捕获（首帧错误堆栈）

      this.time = 0;
      this.scrollX = 0;
      this.score = 0;
      this.kills = 0;
      this.bossCount = 0;       // 已击败 Boss 数（成长叠加）
      this.bossSpawned = 0;     // 已出现 Boss 数
      // 上一只出场 Boss（禁止连续两轮重复）；跨局读取持久化记录，
      // 使新一局第一只也不会与上一局最后一只相同（杜绝连续两场相同 Boss）
      this.lastBossName = null;
      try { this.lastBossName = localStorage.getItem('flytiger_last_boss') || null; } catch (e) {}
      this.totalLevels = 0;
      this.xp = 0;
      this.xpNeed = CFG.xpNeed(0);
      this.bossSeen = new Set();  // 本局已出场过的 Boss（后续出场权重减半；所有非专属 Boss 轮完一遍后清空恢复）

      this.spawnT = 1.2;
      this.rockT = 7;
      this.tideT = 0;          // 怪物潮剩余时间（每击败 3 个 Boss 触发）
      this.bossT = CFG.boss.roundSchedAt(1)[1];   // 首轮刷怪段硬上限 Tmax（到点强制出 Boss）
      this.roundT = 0;         // 本轮刷怪段已进行时间（Boss 战/预警期间暂停累计）
      this.roundKills = 0;      // 本轮刷怪段累计击杀数（达 K 门槛且过 Tmin 即可提前召唤）
      this.warnT = 0;
      this.pendingBoss = null;
      this.pendingBossMusic = null;   // 预警中 Boss 对应曲目（boss-1/boss-2/各 Boss 专属曲目）
      this.shakeMag = 0;
      this.timeScale = 1;
      this.slowmoT = 0;
      this.flashT = 0;        // 屏幕闪光剩余时间
      this.flashColor = '#fff';
      this.ultWave = null;    // 大招光波特效
      this.slashFx = null;    // 侠客大招斩击特效 { x, y, t }
      this.soundwaveT = 0;    // 浪客声波禁锢剩余时间（敌人子弹冻结）
      this.ultBubble = null;  // 大招口头禅气泡 { text, t }
      this.round = 1;
      this.wayPicksThisRound = 0;   // 每轮弹道类成长选择次数（上限 3）
      this.elemPicksThisRound = 0;  // 每轮元素弹道成长选择次数（上限 2）
      this.grassDragonThisRound = false;   // 草龙每轮至多出现一次
      this.unlockedFlyers = new Set();      // 已解锁的飞行弹幕敌人（每轮 30% 概率解锁）
      this._idleAnchor = null;              // 成就：长时间不移动判定锚点（每局重置）
      // 月痕沙海关卡模式状态
      this.stageMode = false;               // 是否处于月痕沙海关卡
      this.stageTime = 0;                   // 关卡已进行时间（秒）
      this.stageWavesTriggered = new Set(); // 已触发的怪物潮序号
      this.stageBossSpawned = false;        // 最终 Boss 是否已出场
      this.stageUnlocked = new Set();       // 关卡内按时间表已解锁的小怪类型
      this.stageSpawnsDone = new Set();     // 时间表中已保底刷出的条目（按类型去重）
      this.shootDisabled = false;           // Boss 台词演出期间停火
      this.letterbox = 0;                   // 上下黑边压下进度（0~1，1=完全压下）
      this.bossIntro = null;                // Boss 入场演出状态机
      this.dialogueBox = null;              // 当前 Boss 台词 {text, t}
      this.rewardShown = false;             // 奖励页是否已显示
      // 地图专属 Boss（狮身人面像/牛魔/骨龙王）：强制概率轮内独立掷骰（未命中本轮不入池），
      // 离开强制轮后无论是否命中过，都拉平为等权普通池成员——但地图限定永久生效、可反复出场
      this.diffMul = 1;
      this.clouds = [];
      for (let i = 0; i < 7; i++) {
        this.clouds.push({ x: rand(0, CFG.W), y: rand(50, 300), s: rand(1.5, 3), sp: rand(14, 40) });
      }

      // 地图：每次进入游戏随机刷新一张（阻碍特性与草地一致）
      this.rollMap();
      // 罗马角斗场：Boss 出现间隔减半（首场）
      if (this.mapId === 'colosseum') {
        this.bossT = Math.max(1, Math.round(this.bossT * CFG.map.arenaBossTimeMul));
      }
    }

    /** 地图 → 龙系主题（草龙仅草原；沙虫/黑龙/红龙/骨蛇/机器蜈蚣/深海蓝龙各属其图；角斗场钢铁林立沿用机器蜈蚣） */
    static get MAP_THEME() {
      return {
        grassland: 'grass', desert: 'sand', snow: 'black', volcano: 'red', wasteland: 'bone',
        cyber: 'mech', ocean: 'sea', colosseum: 'mech',
        jungle: 'jungle', seabed: 'seabed', castle: 'castle', sky: 'sky',
        cave: 'cave', mountains: 'mountains', demoncave: 'demoncave', matrix: 'matrix'
      };
    }

    /** 地图选择按钮文案：多元宇宙（随机） / 具体地图名 */
    mapChoiceLabel() {
      if (this.mapChoice === 'random') return '🌀 多元宇宙';
      const m = CFG.maps.find(x => x.id === this.mapChoice);
      return m ? `${m.icon} ${m.name}` : '🌀 多元宇宙';
    }
    /** 同步菜单地图按钮文案 + 角斗场火焰按钮态 */
    syncMapBtns() {
      const label = this.mapChoiceLabel();
      if (this.el && this.el.menuMapBtn) {
        this.el.menuMapBtn.textContent = label;
        this.el.menuMapBtn.classList.toggle('flame-btn', this.mapChoice === 'colosseum');
      }
    }
    /** 循环切换地图选择：多元宇宙 → 草原 → 沙漠 → … → 角斗场 → 多元宇宙 */
    cycleMapChoice() {
      const ids = ['random'].concat(CFG.maps.map(m => m.id));
      const i = Math.max(0, ids.indexOf(this.mapChoice));
      this.mapChoice = ids[(i + 1) % ids.length];
      try { localStorage.setItem('flytiger_map', this.mapChoice); } catch (e) {}
      this.syncMapBtns();
      if (this.state === 'menu') this.rollMap();   // 菜单中切换：立即预览所选地图背景
      // 选到罗马角斗场：观众席一阵欢呼 + 满屏碎礼花
      if (this.mapChoice === 'colosseum') this.arenaCelebrate();
      else SFX.hit();
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
        // 随机池：罗马角斗场 / 月痕沙海 永不参与随机（仅主界面主动选择进入）
        let pool = CFG.maps.filter(m => m.id !== 'colosseum' && m.id !== 'moondesert');
        if (opts.excludeOcean) pool = pool.filter(m => m.id !== 'ocean');
        if (opts.forceDiff) pool = pool.filter(m => m.id !== this.mapId);
        if (!pool.length) pool = CFG.maps.filter(m => m.id !== 'colosseum' && m.id !== 'moondesert' && m.id !== this.mapId);
        if (!pool.length) pool = CFG.maps.filter(m => m.id !== 'colosseum' && m.id !== 'moondesert');
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
      // 天空：起伏云海地面，每 12s 一次云涌（云团翻滚幅度变大 + 云层整体上升），云层为实体地面无接触伤害
      this.cloudSea = map.cloudSea
        ? { t: 0, surgeT: CFG.map.cloudSurgeInterval, surging: false, surgeT2: 0, rise: 0, amp: CFG.map.cloudAmp }
        : null;
      // 新地图特殊机关：排定本轮触发时刻（无机关地图返回 null）
      if (Hazards) Hazards.startRound(this);
      // 破碎障碍物：清空残留并排定本轮出场时刻
      this.breakables.length = 0;
      this.startBreakRound();
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
     *  随机切换；若场上有地面类敌人，则不会切到大海（大海不出现地面类敌人）。
     *  角斗场特殊规则：角斗场内死亡复活仍留在角斗场；其它地图死亡不会随机进角斗场（rollMap 已排除） */
    rerollMap() {
      if (this.mapId === 'colosseum') {
        // 角斗场：不换图，仅清空战场障碍/残留龙系
        this.rollMap({ honorChoice: true });
      } else {
        this.rollMap({ forceDiff: true, honorChoice: false, excludeOcean: this.hasGroundUnits() });
      }
      this.rocks.length = 0;
      this.rockT = 1.2;
      // 旧地图的龙系怪物随之消失，新地图的龙当轮可再次出场
      for (const e of this.enemies) {
        if (e.type === 'grassdragon') e.dead = true;
      }
      this.grassDragonThisRound = false;
      this.toast(`${this.map.icon} 转移至：${this.map.name}！`, 2.6);
    }

    /** 角斗场庆祝：满屏碎礼花（DOM 覆盖层，菜单/局内均可显示）+ 观众鼓掌欢呼 */
    arenaCelebrate() {
      if (SFX.crowdCheer) SFX.crowdCheer();
      try {
        const wrap = document.getElementById('game-wrap');
        if (wrap) {
          let layer = document.getElementById('confetti-layer');
          if (!layer) {
            layer = document.createElement('div');
            layer.id = 'confetti-layer';
            wrap.appendChild(layer);
          }
          const colors = ['#ff4d4d', '#ffd93b', '#4dff88', '#4dc3ff', '#b44dff', '#ff9a3b', '#ffffff'];
          for (let i = 0; i < 110; i++) {
            const p = document.createElement('i');
            p.className = 'confetti-piece';
            const size = 6 + Math.floor(Math.random() * 8);
            p.style.left = Math.random() * 100 + '%';
            p.style.width = size + 'px';
            p.style.height = (size * 1.6) + 'px';
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
            p.style.animationDelay = (Math.random() * 0.8) + 's';
            p.style.setProperty('--sway', (Math.random() * 160 - 80) + 'px');
            p.addEventListener('animationend', () => p.remove());
            layer.appendChild(p);
          }
          // 清理空层
          setTimeout(() => { if (layer && !layer.children.length) layer.remove(); }, 5200);
        }
      } catch (e) {}
    }

    /* ---------------- 角色选择 ---------------- */
    /** 状态轮转顺序：空闲 → 备战 → 探索 → 委托 → 空闲 */
    static CHAR_CYCLE = ['idle', 'ready', 'explore', 'mission'];
    statusLabel(s) {
      return { idle: '空闲', ready: '备战', explore: '探索', mission: '委托' }[s] || '空闲';
    }
    /** 大招名称 */
    ultName(ult) {
      return { wave: '强光波', slash: '前方大斩击', shield: '魔法护盾', soundwave: '禁锢声波', bloodrage: '血怒', lasers: '五重激光串', phantom: '百鬼夜行' }[ult] || ult;
    }
    /** 自动技能（近战）名称 */
    autoSkillName(id) {
      return { xiaobai: '爪击', xiake: '疾风突刺', mofashi: '彩虹护盾', buliang: '过肩摔', jiaodoushi: '血怒铠甲', chaoren: '巨型激光', meiying: '幽魂爪' }[id] || '爪击';
    }
    /** 自动技能图标字 */
    autoSkillIcon(id) {
      return { xiaobai: '爪', xiake: '突', mofashi: '盾', buliang: '摔', jiaodoushi: '甲', chaoren: '激', meiying: '魅' }[id] || '爪';
    }
    /** 角色参数可读串 */
    charParams(c) {
      // 速度：>1 更快为「+」；射速(fireMul 为射击间隔倍率)：>1 更慢为「-」
      const spdPct = (m) => m === 1 ? '标准' : (m > 1 ? `+${Math.round((m - 1) * 100)}%` : `-${Math.round((1 - m) * 100)}%`);
      const firePct = (m) => m === 1 ? '标准' : (m > 1 ? `-${Math.round((m - 1) * 100)}%` : `+${Math.round((1 - m) * 100)}%`);
      let s = `速度 ${spdPct(c.speedMul)} · 伤害 ${c.dmg} · 射速 ${firePct(c.fireMul || 1)}`;
      if (c.bounceBase) s += ` · 反弹 ${c.bounceBase}`;
      return s + ` ｜ 大招：${this.ultName(c.ult)}`;
    }
    /** 构建头像节点：程序化角色（canvas，如魅影）复制一份 canvas；其余用 Image */
    faceNode(id) {
      const CH = window.CHARS;
      const c = CH && CH.get(id);
      if (!c) return null;
      const fm = CH.face(id);
      if (fm instanceof HTMLCanvasElement) {
        const cv = document.createElement('canvas');
        cv.width = fm.width; cv.height = fm.height;
        cv.getContext('2d').drawImage(fm, 0, 0);
        return cv;
      }
      const im = new Image();
      im.alt = c.name;
      if (fm && fm.complete && fm.naturalWidth) im.src = fm.src;
      else im.src = c.face || c.art;
      return im;
    }
    /** 构建竖排横长条角色列表（前 6 个可用，其余「尚未发现此猫咪」） */
    buildCharGrid() {
      if (!this.el.charGrid || !window.CHARS) return;
      const CH = window.CHARS;
      const grid = this.el.charGrid;
      grid.innerHTML = '';
      this._statusBadges = {};   // id → 状态徽章 DOM
      this._moodEls = {};         // id → 心情条 DOM
      for (let i = 0; i < CH.SLOTS; i++) {
        const id = CH.ORDER[i];
        const bar = document.createElement('div');
        if (id) {
          const c = CH.get(id);
          const st = this.charStatus[id] || 'idle';
          const locked = !!c.lock && !CH.isUnlocked(id);
          const busy = !locked && !!(window.MISSIONS && MISSIONS.isBusy(id));   // 委托中
          bar.className = 'char-bar' + (id === this.charId ? ' picked' : '') + (locked ? ' char-lock' : '') + (busy ? ' on-mission' : '');
          bar.dataset.id = id;
          const avatar = document.createElement('div');
          avatar.className = 'char-bar-avatar';
          avatar.appendChild(this.faceNode(id));
          const info = document.createElement('div');
          info.className = 'char-bar-info';
          info.innerHTML =
            `<div class="char-bar-name">${c.name}${locked ? ' 🔒' : ''}</div>` +
            `<div class="char-bar-intro">${c.intro || c.desc}</div>` +
            `<div class="char-bar-params">${this.charParams(c)}</div>`;
          // 右上角状态徽章：仅展示状态，不可点击（点击穿透到角色框，由框体统一处理备战/提示）
          const badge = document.createElement('div');
          badge.className = 'char-status ' + (busy ? 'mission' : st);
          badge.textContent = busy ? (window.MISSIONS.busyLabel(id) || '委托中') : this.statusLabel(st);
          badge.title = busy ? '正在执行委托，归来前无法备战' : '';
          const mood = document.createElement('div');
          mood.className = 'char-mood';
          mood.textContent = CH.randMood(id);
          bar.appendChild(avatar);
          bar.appendChild(info);
          bar.appendChild(badge);
          bar.appendChild(mood);
          if (locked) {
            // 锁定角色：紫标 + 中部遮罩提示，点击只弹提示，不可备战
            const tag = document.createElement('div');
            tag.className = 'char-lock-tag';
            tag.textContent = '🔒 未解锁';
            const mask = document.createElement('div');
            mask.className = 'char-lock-mask';
            mask.textContent = '藏品「黑人财神雕像」圆满后加入';
            bar.appendChild(tag);
            bar.appendChild(mask);
            bar.addEventListener('click', () => {
              this.toast('🔒「' + c.name + '」尚未解锁：仓库供奉黑人财神雕像至圆满即可加入', 3);
              try { SFX.hit(); } catch (e) {}
            });
          } else if (busy) {
            // 委托中：不可备战
            bar.addEventListener('click', () => {
              this.toast('📜「' + c.name + '」正在执行委托，归来前无法选为备战（剩余轮数见徽章）', 2.6);
              try { SFX.hit(); } catch (e) {}
            });
          } else {
            // 点框体任意位置 = 设为备战
            bar.addEventListener('click', () => this.setStandby(id));
          }
          this._statusBadges[id] = badge;
          this._moodEls[id] = mood;
        } else {
          bar.className = 'char-bar locked char-bar-empty';
          bar.innerHTML = `<div class="char-empty-note">尚未发现此猫咪</div>`;
        }
        grid.appendChild(bar);
      }
    }
    /** 设为备战角色：叮一声 + 边框发光，其余清回空闲 */
    setStandby(id) {
      const CH = window.CHARS;
      if (!CH || !CH.has(id)) return;
      if (!CH.isUnlocked(id)) {
        const c = CH.get(id);
        this.toast('🔒「' + c.name + '」尚未解锁：仓库供奉黑人财神雕像至圆满即可加入', 3);
        try { SFX.hit(); } catch (e) {}
        return;
      }
      if (window.MISSIONS && MISSIONS.isBusy(id)) {
        const c = CH.get(id);
        this.toast('📜「' + c.name + '」正在执行委托，归来前无法选为备战', 2.6);
        try { SFX.hit(); } catch (e) {}
        return;
      }
      this.charId = id;
      CH.ORDER.forEach(oid => { this.charStatus[oid] = ((window.MISSIONS && MISSIONS.isBusy(oid)) ? 'mission' : (oid === id ? 'ready' : 'idle')); });
      try { localStorage.setItem('flytiger_char', id); } catch (e) {}
      // 刷新所有徽章与选中态
      CH.ORDER.forEach(oid => {
        this.refreshStatusBadge(oid);
        const bar = this.el.charGrid.querySelector(`.char-bar[data-id="${oid}"]`);
        if (bar) bar.classList.toggle('picked', oid === id);
      });
      this.syncStandbyName();
      SFX.levelup();   // 叮
    }
    /** 委托系统联动：同步委托中状态；若备战猫被派出，自动改派一只空闲已解锁猫（至少留 1 只备战由派遣侧保证） */
    syncMissionStatuses() {
      const CH = window.CHARS;
      if (!CH || !window.MISSIONS) return;
      const M = window.MISSIONS;
      CH.ORDER.forEach(id => {
        this.charStatus[id] = M.isBusy(id) ? 'mission' : (id === this.charId ? 'ready' : 'idle');
      });
      if (M.isBusy(this.charId)) {
        const free = CH.ORDER.filter(id => CH.isUnlocked(id) && !M.isBusy(id));
        if (free.length) {
          this.charId = free[0];
          try { localStorage.setItem('flytiger_char', this.charId); } catch (e) {}
          CH.ORDER.forEach(id => { this.charStatus[id] = M.isBusy(id) ? 'mission' : (id === this.charId ? 'ready' : 'idle'); });
          this.syncStandbyName();
          const c = CH.get(this.charId);
          this.toast('📜 备战角色已派出执行委托，自动改派「' + (c ? c.name : this.charId) + '」备战', 3);
        }
      }
      try { this.buildCharGrid(); } catch (e) {}
      M.refreshDots();
    }
    /** 刷新单个角色状态徽章 */
    refreshStatusBadge(id) {
      const b = this._statusBadges && this._statusBadges[id];
      if (!b) return;
      const st = this.charStatus[id] || 'idle';
      if (st === 'mission' && window.MISSIONS && MISSIONS.isBusy(id)) {
        b.className = 'char-status mission';
        b.textContent = MISSIONS.busyLabel(id) || '委托中';
        return;
      }
      b.className = 'char-status ' + st;
      b.textContent = this.statusLabel(st);
    }
    /** 同步主菜单备战角色信息（名称 + 头像 + 能力/大招/自动技能） */
    syncStandbyName() {
      const c = window.CHARS && window.CHARS.get(this.charId);
      if (!c) return;
      if (this.el.standbyName) this.el.standbyName.textContent = `${c.icon} ${c.name}`;
      // 头像（程序化角色为 canvas 克隆，其余为 Image）
      if (this.el.standbyAvatar) {
        this.el.standbyAvatar.innerHTML = '';
        const node = this.faceNode(this.charId);
        if (node) this.el.standbyAvatar.appendChild(node);
      }
      // 能力 / 大招 / 自动技能
      if (this.el.standbyDetail) {
        this.el.standbyDetail.innerHTML =
          `<span class="sd-line sd-trait"><b>能力</b>　${c.trait}</span>` +
          `<span class="sd-line sd-ult"><b>大招</b>　${this.ultName(c.ult)}</span>` +
          `<span class="sd-line sd-auto"><b>自动技能</b>　${this.autoSkillName(c.id)}（接触敌人触发，3 秒冷却）</span>`;
      }
    }
    /** 局外每 10s 随机刷新各角色心情语录 */
    refreshMoods() {
      if (!window.CHARS || !this._moodEls) return;
      window.CHARS.ORDER.forEach(id => {
        const el = this._moodEls[id];
        if (el) el.textContent = window.CHARS.randMood(id);
      });
    }
    /** 打开角色选择界面（fromPause=true 表示从局内暂停返回局外） */
    openCharSelect(fromPause) {
      if (fromPause) {
        // 局内返回：清场并回到局外菜单状态
        this.el.pause.classList.add('hidden');
        this.el.hud.classList.add('hidden');
        this.el.bossHud.classList.add('hidden');
        this.el.warn.classList.add('hidden');
        this.el.levelup.classList.add('hidden');
        this.state = 'menu';
        this.stageMode = false;   // 退出到菜单：清除月痕沙海关卡标记，避免下次开局误入
        this.shakeMag = 0;        // 局内退出到菜单：立即停止震屏
      }
      this.buildCharGrid();
      this.moodT = 10;   // 进入选角即开始 10s 倒计时
      if (this.el.charSelTitle) {
        this.el.charSelTitle.textContent = fromPause ? '重新选择出战角色' : '选择出战角色';
      }
      if (this.el.charSel) this.el.charSel.classList.remove('hidden');
      if (window.Music) Music.play('bgm-zhujiemian');
    }
    /** 关闭角色选择界面（返回菜单） */
    closeCharSelect() {
      if (this.el.charSel) this.el.charSel.classList.add('hidden');
      this.syncStandbyName();
      // 从局内暂停进入（state 已是 menu、主菜单被隐藏）时：恢复主菜单显示
      if (this.state === 'menu' && this.el.menu) this.el.menu.classList.remove('hidden');
      SFX.hit();
    }

    start() {
      if (!Sprites.cat) {
        alert('未找到白猫素材：请把图片保存为 assets/cat.png 后刷新页面');
        return;
      }
      SFX.unlock();
      const wasStage = this.stageMode;
      this.reset();
      this.stageMode = wasStage;
      if (this.stageMode) {
        // 月痕沙海关卡：锁定地图、玩家出生在屏幕中线
        const m = CFG.maps.find(x => x.id === 'moondesert');
        this.map = m; this.mapId = 'moondesert';
        this.crater = null; this.sea = null;
        this.player.x = CFG.W / 2;
        this.player.y = CFG.H / 2;
      }
      this.state = 'playing';
      if (window.Ach) { Ach.beginRun(this.charId); Ach.evt('runStart', { g: this }); }
      this.el.menu.classList.add('hidden');
      this.el.gameover.classList.add('hidden');
      this.el.levelup.classList.add('hidden');
      this.el.pause.classList.add('hidden');
      this.el.warn.classList.add('hidden');
      this.el.hud.classList.remove('hidden');
      this.el.bossHud.classList.add('hidden');
      this.syncBgmBtn();     // HUD 首次显示：音乐按钮文案与实际开关状态对齐
      if (this.stageMode) {
        this.toast('🌙 月痕沙海 · 6 分钟生存战，击败狮身人面像！', 3.2);
      } else {
        this.toast(`${this.map.icon} ${this.map.name} · 第 1 轮战斗开始！`, 2.8);
        const c = window.CHARS && window.CHARS.get(this.charId);
        if (c) this.toast(`${c.icon} ${c.name} 参战！`, 2.6);
      }
    }

    /** 从「发现秘境」面板进入月痕沙海关卡 */
    startStage() {
      this.stageMode = true;
      this.start();
    }

    /** 死亡结算「返回主页」：放弃再战，清场回到主菜单（reset 会清空战局残留并重滚地图） */
    backToMenu() {
      this.reset();
      this.state = 'menu';
      this.shakeMag = 0;        // 回主界面：立即停止一切残留震屏
      this.flashT = 0;
      this.el.gameover.classList.add('hidden');
      this.el.hud.classList.add('hidden');
      this.el.bossHud.classList.add('hidden');
      this.el.warn.classList.add('hidden');
      this.el.levelup.classList.add('hidden');
      this.el.pause.classList.add('hidden');
      this.el.menu.classList.remove('hidden');
      this.syncMapBtns();
      if (window.Music) Music.play('bgm-zhujiemian');
      SFX.hit();
    }

    gameOver() {
      if (this.state === 'gameover') return;
      this.state = 'gameover';
      // 本次从发现面板进入的特殊关未通关：取消通关标记关联
      if (window.MISSIONS) { try { MISSIONS.notifyLaunched(null); } catch (e) {} }
      if (window.Ach) Ach.evt('gameOver', { g: this, src: this.lastHurtSrc });
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
      // 死亡演出：黑气涌入 → 死法文本 → 淡出后亮出结算界面（不再直接弹结算）
      this.deathScene = this.makeDeathScene(this.lastHurtSrc);
    }

    /* ---------------- 死亡演出（黑气 + 死法文本） ---------------- */
    /** 按击杀者归因组装死法文案；归因缺失时兜底为最近的存活敌人/Boss */
    makeDeathScene(src) {
      const charName = (this.player && this.player.char && this.player.char.name) || '飞喵';
      let pool = null, enemyName = null;
      const pick = arr => arr[Math.floor(Math.random() * arr.length)];
      if (src && src.k === 'e') {
        const def = CFG.enemies[src.key];
        if (def && DEATH_LINES.enemy[src.key]) { pool = DEATH_LINES.enemy[src.key]; enemyName = def.name; }
      } else if (src && src.k === 'b') {
        if (DEATH_LINES.boss[src.key]) { pool = DEATH_LINES.boss[src.key]; enemyName = BOSS_DEATH_NAMES[src.key]; }
      }
      // 兜底：取离死亡位置最近的存活敌人/Boss
      if (!pool) {
        let best = null, bestD = Infinity;
        for (const e of this.targets()) {
          if (e.dead || e.dying) continue;
          const d = (e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2;
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best && best.dsrc) {
          const p2 = best.dsrc.k === 'b' ? DEATH_LINES.boss[best.dsrc.key] : DEATH_LINES.enemy[best.dsrc.key];
          if (p2) {
            pool = p2;
            enemyName = best.dsrc.k === 'b' ? BOSS_DEATH_NAMES[best.dsrc.key]
              : (CFG.enemies[best.dsrc.key] && CFG.enemies[best.dsrc.key].name);
          }
        }
      }
      // 最终兜底：全场随机一条（环境击杀且屏幕无敌人时）
      if (!pool) {
        const all = [];
        for (const k in DEATH_LINES.enemy) all.push({ arr: DEATH_LINES.enemy[k], name: CFG.enemies[k].name });
        const f = all[Math.floor(Math.random() * all.length)];
        pool = f.arr; enemyName = f.name;
      }
      const action = pick(pool);
      return {
        phase: 'black', t: 0, total: 0,
        line1: `${charName}被${enemyName}`,
        action,
        smokes: [], smokeT: 0,
        fadeT: 0, fullAt: 0
      };
    }

    /** 死亡演出推进：黑气涌入(black) → 文本显现(text) → 停留(hold) → 黑色淡出(fade) → 结算界面 */
    updateDeathScene(dt) {
      this.updateFx(dt);   // 死亡爆炸粒子/震屏/闪光继续
      const ds = this.deathScene;
      ds.total += dt;
      // 黑气烟雾：黑气涌入阶段从四边持续灌入，停留阶段少量余烟
      const smokeRate = ds.phase === 'black' ? 0.03 : (ds.phase === 'fade' ? 0.5 : 0.12);
      ds.smokeT -= dt;
      if (ds.smokeT <= 0 && ds.phase !== 'fade') {
        ds.smokeT = smokeRate;
        const edge = Math.floor(Math.random() * 4);
        let x, y, vx, vy;
        const sp = rand(26, 70);
        if (edge === 0) { x = rand(0, CFG.W); y = -30; vx = rand(-14, 14); vy = sp; }
        else if (edge === 1) { x = rand(0, CFG.W); y = CFG.H + 30; vx = rand(-14, 14); vy = -sp; }
        else if (edge === 2) { x = -30; y = rand(0, CFG.H); vx = sp; vy = rand(-14, 14); }
        else { x = CFG.W + 30; y = rand(0, CFG.H); vx = -sp; vy = rand(-14, 14); }
        ds.smokes.push({ x, y, vx, vy, r: rand(34, 80), grow: rand(14, 30), life: rand(1.6, 2.8), t: 0 });
      }
      for (const s of ds.smokes) {
        s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.grow * dt;
      }
      ds.smokes = ds.smokes.filter(s => s.t < s.life);

      if (ds.phase === 'black') {
        ds.t += dt;
        if (ds.t >= DEATH_FX.BLACK_IN) { ds.phase = 'text'; ds.t = 0; }
      } else if (ds.phase === 'text') {
        ds.t += dt;
        // 上行淡入(0.9s) + 红字逐字(每字 0.12s) 全部显示后进入停留
        const fullT = 0.9 + ds.action.length * 0.12 + 0.2;
        if (ds.t >= fullT) { ds.phase = 'hold'; ds.t = 0; ds.fullAt = ds.total; }
      } else if (ds.phase === 'hold') {
        ds.t += dt;
        if (ds.t >= DEATH_FX.HOLD_AFTER || ds.total >= DEATH_FX.AUTO_MAX) ds.phase = 'fade';
      } else if (ds.phase === 'fade') {
        ds.fadeT += dt;
        if (ds.fadeT >= DEATH_FX.FADE_OUT) {
          // 黑色淡出完毕：有已完成委托先弹委托结算（多任务可翻页/跳过），关闭后再亮出普通结算
          this.deathScene = null;
          if (window.MISSIONS && MISSIONS.hasPending()) {
            this.settleOpen = true;
            MISSIONS.showSettlement(() => {
              this.settleOpen = false;
              this.el.gameover.classList.remove('hidden');
            });
          } else {
            this.el.gameover.classList.remove('hidden');
          }
        }
      }
    }

    /** 点击/空格跳过：仅文本完全显示后生效，直接进入淡出退场 */
    skipDeathScene() {
      const ds = this.deathScene;
      if (!ds || ds.phase === 'fade') return;
      if (ds.phase === 'hold') ds.phase = 'fade';
    }

    /** 死亡演出渲染（屏幕空间，不受震屏影响） */
    renderDeathScene(ctx) {
      const ds = this.deathScene;
      if (!ds) return;
      const D = DEATH_FX;
      // 黑气覆盖率
      let cov;
      if (ds.phase === 'black') cov = ds.t / D.BLACK_IN;
      else if (ds.phase === 'fade') cov = 1 - ds.fadeT / D.FADE_OUT;
      else cov = 1;
      cov = clamp(cov, 0, 1);
      const ease = cov * cov * (3 - 2 * cov);   // smoothstep
      ctx.save();
      // 黑气烟雾团（深灰紫，边缘涌入）
      for (const s of ds.smokes) {
        const a = clamp(1 - s.t / s.life, 0, 1) * 0.5 * ease;
        if (a <= 0.01) continue;
        const g = ctx.createRadialGradient(s.x, s.y, s.r * 0.2, s.x, s.y, s.r);
        g.addColorStop(0, `rgba(26,20,34,${a})`);
        g.addColorStop(0.7, `rgba(14,10,20,${a * 0.8})`);
        g.addColorStop(1, 'rgba(8,6,12,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }
      // 边缘不规则黑气条带（随覆盖率向内推进）
      const t = ds.total;
      const band = Math.max(6, ease * 150);
      ctx.fillStyle = `rgba(6,4,10,${0.92 * ease})`;
      for (let x = 0; x < CFG.W; x += 10) {
        const jT = Math.sin(t * 5 + x * 0.05) * 10 + Math.sin(t * 9 + x * 0.11) * 7;
        const jB = Math.sin(t * 6 + x * 0.07 + 2) * 10 + Math.sin(t * 10 + x * 0.13) * 7;
        ctx.fillRect(x, 0, 10, band * 0.55 + jT * ease);
        ctx.fillRect(x, CFG.H - band * 0.55 - jB * ease, 10, band * 0.55 + jB * ease);
      }
      for (let y = 0; y < CFG.H; y += 10) {
        const jL = Math.sin(t * 5.5 + y * 0.06) * 10 + Math.sin(t * 9.5 + y * 0.1) * 7;
        const jR = Math.sin(t * 6.5 + y * 0.08 + 3) * 10 + Math.sin(t * 10.5 + y * 0.12) * 7;
        ctx.fillRect(0, y, band * 0.55 + jL * ease, 10);
        ctx.fillRect(CFG.W - band * 0.55 - jR * ease, y, band * 0.55 + jR * ease, 10);
      }
      // 纯黑覆盖
      ctx.fillStyle = `rgba(0,0,0,${0.985 * ease})`;
      ctx.fillRect(0, 0, CFG.W, CFG.H);

      // 死法文本
      if (ds.phase !== 'black') {
        const cx = CFG.W / 2, cy = CFG.H / 2;
        const textA = ds.phase === 'fade' ? clamp(1 - ds.fadeT / (D.FADE_OUT * 0.6), 0, 1) : 1;
        // 上行：白色「角色名 被 敌人名」
        const a1in = ds.phase === 'text'
          ? textA * clamp((ds.t - 0.15) / 0.8, 0, 1)
          : textA;
        ctx.save();
        ctx.globalAlpha = a1in;
        ctx.textAlign = 'center';
        ctx.font = 'bold 30px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#000';
        ctx.fillText(ds.line1, cx + 2, cy - 44 + 2);
        ctx.fillStyle = '#f2f2f2';
        ctx.fillText(ds.line1, cx, cy - 44);
        ctx.restore();
        // 下行：亮红色大号具体死法，逐字弹出 + 缓慢跳动
        const pulse = 1 + Math.sin(ds.total * 2.4) * 0.035;
        ctx.save();
        ctx.translate(cx, cy + 24);
        ctx.scale(pulse, pulse);
        ctx.textAlign = 'center';
        ctx.font = 'bold 46px "Microsoft YaHei", sans-serif';
        const chars = [...ds.action];
        const step = 0.12, start = 0.95;
        // 先量总宽以便逐字居中
        const widths = chars.map(ch => ctx.measureText(ch).width);
        const totalW = widths.reduce((s, w) => s + w, 0);
        let penX = -totalW / 2;
        for (let i = 0; i < chars.length; i++) {
          const ap = ds.phase === 'text'
            ? clamp((ds.t - (start + i * step)) / 0.25, 0, 1)
            : 1;
          if (ap <= 0) { penX += widths[i]; continue; }
          const pop = 0.7 + 0.3 * Math.min(1, ap * 1.6);
          ctx.save();
          ctx.globalAlpha = textA * ap;
          ctx.translate(penX + widths[i] / 2, 0);
          ctx.scale(pop, pop);
          ctx.shadowColor = 'rgba(255,0,0,0.75)';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#ff2020';
          ctx.fillText(chars[i], 0, 0);
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ff8a80';
          ctx.globalAlpha = textA * ap * 0.5;
          ctx.fillText(chars[i], -1, -1);
          ctx.restore();
          penX += widths[i];
        }
        ctx.restore();
        // 退场提示（文本完全显示后淡入）
        if (ds.phase === 'hold') {
          const hintA = clamp((ds.t - 0.6) / 0.8, 0, 1) * clamp(1 - ds.fadeT / 0.5, 0, 1);
          ctx.save();
          ctx.globalAlpha = hintA * (0.55 + Math.sin(ds.total * 3) * 0.25);
          ctx.textAlign = 'center';
          ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
          ctx.fillStyle = '#cfcfcf';
          ctx.fillText('点击屏幕或按空格继续', cx, cy + 96);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    /* ---------------- 数值 ---------------- */
    get bossActive() { return this.bosses.length > 0 || this.warnT > 0; }
    get atkScale() {
      const base = 1 + this.time * 0.0015 + (this.round - 1) * 0.05;
      return this.bossActive ? base * (1 + this.bossSpawned * CFG.boss.atkGrow) : base;
    }
    /**
     * Boss / 动态血精英的血量软追赶系数。
     * 以参考 DPS 曲线为锚：玩家实际 DPS 偏离参考值时，血量只追赶 45%，
     * 堆成长带来的击杀加速收益归玩家（旧公式 1:1 反推会让成长完全无感）。
     */
    hpSoftMul(ord) {
      return CFG.boss.hpSoftMul(this.playerDps() / CFG.boss.refDpsAt(ord));
    }
    /**
     * 元素弹命中结算：DoT 系数/持续/冻结吃元素精通等级（CFG.elementMaster）。
     * 同元素重复命中 → 叠层（上限 5，每层 DoT +12%）并刷新持续；不同元素 → 覆盖。
     * @param pow 子弹携带的元素精通等级（b.elemPow，0-3）
     */
    applyElement(e, type, hitDmg, pow) {
      const m = CFG.elementMaster[type];
      if (!m) return;
      const lv = Math.max(0, Math.min(3, pow | 0));
      const stack = (e.dotType === type && e.dotT > 0) ? Math.min(5, (e.dotStack || 1) + 1) : 1;
      e.dotStack = stack;
      e.dotType = type;
      e.dotT = m.durBase + m.durPerLv * lv;
      e.dotDps = hitDmg * (m.dpsBase + m.dpsPerLv * lv) * (1 + 0.12 * (stack - 1));
      if (type === 'ice') {
        e.freezeT = Math.max(e.freezeT || 0, m.freezeBase + m.freezePerLv * lv);
      }
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
    toast(text, dur, slot) {
      this.toastQueue.push({ text, t: dur || 2, max: dur || 2, slot: slot || 'center' });
    }

    /** 击杀积累怒气 */
    addRage(v) {
      if (!this.player) return;
      this.player.rage = Math.min(CFG.ultimate.rageMax, this.player.rage + v);
    }

    /** 大招分发：按出战角色释放对应大招 */
    castUltimate() {
      if (this.state !== 'playing') return;
      // 口头禅气泡：角色旁弹出，显示 3 秒
      const cp = this.player.char && this.player.char.catchphrase;
      if (cp) this.ultBubble = { text: cp, t: 3 };
      const ult = this.player.char ? this.player.char.ult : 'wave';
      if (window.Ach) Ach.evt('ult', { g: this, ult: ult });
      if (ult === 'slash') return this.ultSlash();
      if (ult === 'shield') return this.ultMagicShield();
      if (ult === 'soundwave') return this.ultSoundwave();
      if (ult === 'bloodrage') return this.ultBloodrage();
      if (ult === 'lasers') return this.ultLasers();
      if (ult === 'phantom') return this.ultPhantom();
      return this.ultWaveBlast();
    }

    /** [小白] 强光波 —— 肃清屏幕内全部小怪，对 Boss 造成 20% 最大生命伤害 */
    ultWaveBlast() {
      SFX.ultimate();
      this.shake(18);
      this.flashT = 0.5; this.flashColor = '#fff';
      this.ultWave = { r: 40, a: 1 };
      // 大招破解无敌：清除所有敌人出场无敌 + Boss 锁血（草龙本体免疫大招，保留其出场无敌）
      this.enemies.forEach(e => {
        if (e.type === 'grassdragon' && !e.isMini) return;
        e.spawnInvuln = 0;
      });
      const bossLock = new Map(this.bosses.map(b => [b, b.lockHp]));   // 先快照，伤害后恢复锁血
      this.bosses.forEach(b => { b.lockHp = false; });
      // 屏幕内小怪全灭
      const killsBefore = this.kills;
      this.enemies.slice().forEach(e => {
        if (!e.dead) e.takeDamage(99999, this);
      });
      if (window.Ach) Ach.evt('ultWaveKills', { g: this, n: this.kills - killsBefore });
      // Boss 受到 20% 最大生命伤害（入场免伤状态除外），大招无视无敌；原本锁血的 Boss 伤害后恢复锁血
      this.bosses.forEach(b => {
        if (!b.dead && b.state !== 'enter' && b.state !== 'trans') {
          b.lockHp = false;
          b.takeDamage(b.maxHp * CFG.ultimate.bossDmgRatio, this);
          if (bossLock.get(b)) b.lockHp = true;  // 恢复锁血状态标记（但伤害已造成）
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

    /** [魅影] 百鬼夜行 —— 群鬼破匣横扫全屏：小怪全灭，对 Boss 造成 20% 最大生命伤害 */
    ultPhantom() {
      const p = this.player;
      SFX.ultimate();
      this.shake(17);
      this.flashT = 0.45; this.flashColor = '#c99bff';
      const x0 = p.x, y0 = p.y;
      // 鬼群演出：每只鬼从角色身上向各自方向飘掠，带正弦幽魂轨迹
      const ghosts = [];
      const N = 16;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU + rand(-0.12, 0.12);
        ghosts.push({
          a, spd: rand(520, 820), dist: 0,
          size: rand(13, 22), ph: rand(0, TAU),
          magenta: Math.random() < 0.28
        });
      }
      this.phantomFx = { x: x0, y: y0, t: 0.95, max: 0.95, r: 30, ghosts };
      // 大招破解无敌：清除所有敌人出场无敌 + Boss 锁血（草龙本体免疫大招，保留其出场无敌）
      this.enemies.forEach(e => {
        if (e.type === 'grassdragon' && !e.isMini) return;
        e.spawnInvuln = 0;
      });
      const bossLock = new Map(this.bosses.map(b => [b, b.lockHp]));   // 先快照，伤害后恢复锁血
      this.bosses.forEach(b => { b.lockHp = false; });
      // 屏幕内小怪全灭（草龙本体改为幽焰持续灼烧）
      this.enemies.slice().forEach(e => {
        if (e.dead) return;
        if (e.type === 'grassdragon' && !e.isMini) {
          e.dotT = 4; e.dotDps = 42 * this.atkScale; e.dotType = 'flame';
          e.spawnInvuln = 0;
          return;
        }
        e.takeDamage(99999, this);
      });
      // 草龙分裂小段：幽焰灼烧 + 重伤
      this.enemies.slice().forEach(e => {
        if (e.dead || !e.segments || !e.isMini) return;
        for (let i = 0; i < e.segments.length; i++) {
          const s = e.segments[i];
          if (s.dead) continue;
          e.damageSegment(i, 32, this, null, '');
          e.dotT = Math.max(e.dotT || 0, 3); e.dotDps = Math.max(e.dotDps || 0, 26); e.dotType = 'flame';
        }
      });
      // Boss 受到 20% 最大生命伤害（入场免伤状态除外），大招无视无敌；原本锁血的 Boss 伤害后恢复锁血
      this.bosses.forEach(b => {
        if (!b.dead && b.state !== 'enter' && b.state !== 'trans') {
          b.lockHp = false;
          b.takeDamage(b.maxHp * CFG.ultimate.bossDmgRatio, this);
          if (bossLock.get(b)) b.lockHp = true;
        }
      });
      // 鬼火粒子
      for (let i = 0; i < 52; i++) {
        const a = rand(0, TAU);
        this.particles.push(new Particle(
          x0, y0,
          Math.cos(a) * rand(260, 720), Math.sin(a) * rand(260, 720),
          rand(0.35, 0.8), rand(3, 7),
          Math.random() < 0.5 ? '#b57bff' : (Math.random() < 0.5 ? '#ff7bd5' : '#8ff0ff')));
      }
      this.toast('👻 百鬼夜行！', 1.8);
    }

    /** [侠客] 前方大斩击：大范围剑气斩，秒杀接触小怪、直接摧毁障碍、龙类持续灼烧 */
    ultSlash() {
      const p = this.player;
      SFX.ultimate();
      this.shake(14);
      this.flashT = 0.35; this.flashColor = '#d8ffe8';
      const x0 = p.x, y0 = p.y;
      const R = 340;                       // 斩击半径（前方大范围）
      this.slashFx = { x: x0, y: y0, t: 0.4, max: 0.4 };
      // 前方矩形区域：小怪全灭
      this.enemies.slice().forEach(e => {
        if (e.dead || e.isMini) return;
        if (e.x > x0 - 40 && e.x < x0 + R && Math.abs(e.y - y0) < 300) {
          if (e.type === 'grassdragon') {
            // 龙类本体：持续灼烧 DoT（不吃秒杀，保留既有免疫约定）
            e.dotT = 4; e.dotDps = 40 * this.atkScale; e.dotType = 'flame';
            e.spawnInvuln = 0;
          } else {
            e.spawnInvuln = 0;
            e.takeDamage(99999, this);
          }
        }
      });
      // 龙类分裂小段：灼烧 + 重伤
      this.enemies.slice().forEach(e => {
        if (e.dead || !e.segments || !e.isMini) return;
        for (let i = 0; i < e.segments.length; i++) {
          const s = e.segments[i];
          if (s.dead || s.x < x0 - 40 || s.x > x0 + R || Math.abs(s.y - y0) > 300) continue;
          e.damageSegment(i, 30, this, null, '');
          e.dotT = Math.max(e.dotT || 0, 3); e.dotDps = Math.max(e.dotDps || 0, 24); e.dotType = 'flame';
        }
      });
      // 接触的障碍物直接摧毁
      this.rocks.slice().forEach(r => {
        if (r.dead) return;
        if (r.left < x0 + R && r.left + r.w > x0 - 40 && r.top < y0 + 300 && r.baseY > y0 - 300) r.destroy(this);
      });
      // 剑气粒子
      for (let i = 0; i < 36; i++) {
        const a = rand(-1.2, 1.2);
        this.particles.push(new Particle(
          x0 + Math.cos(a) * rand(60, R), y0 + Math.sin(a) * rand(60, 300) * (Math.random() < 0.5 ? 1 : -1) * 0.5,
          Math.cos(a) * rand(200, 620), Math.sin(a) * rand(60, 220),
          rand(0.25, 0.6), rand(3, 7),
          ['#2fb37c', '#7ed46d', '#d8ffe8', '#fff'][randi(0, 3)]));
      }
      this.toast('🗡️ 疾风斩！', 1.6);
    }

    /** [法师] 魔法护盾：无敌 5s，期间击中的敌人困惑并下坠 2s（困惑逻辑在 collisions 中施加） */
    ultMagicShield() {
      SFX.ultimate();
      const p = this.player;
      p.magicShieldT = 5;
      this.shake(6);
      this.flashT = 0.3; this.flashColor = '#c99bff';
      for (let i = 0; i < 30; i++) {
        const a = rand(0, TAU);
        this.particles.push(new Particle(
          p.x, p.y, Math.cos(a) * rand(120, 340), Math.sin(a) * rand(120, 340),
          rand(0.4, 0.8), rand(3, 6), ['#c99bff', '#8b3fd0', '#ffe066', '#fff'][randi(0, 3)]));
      }
      this.toast('✨ 魔法护盾展开！无敌 5 秒', 2);
    }

    /** [浪客] 禁锢声波：禁锢所有敌人（小怪）与敌人子弹 4s */
    ultSoundwave() {
      SFX.ultimate();
      this.shake(10);
      this.flashT = 0.35; this.flashColor = '#7fe7ff';
      this.ultWave = { r: 40, a: 1 };
      this.soundwaveT = 4;                 // 敌方子弹冻结（update 中生效）
      let frozen = 0;
      this.enemies.forEach(e => {
        if (e.dead) return;                // 龙类（含分裂小段）也有 freezeT 支持，一并禁锢
        e.freezeT = Math.max(e.freezeT || 0, 4);
        frozen++;
      });
      if (window.Ach) Ach.evt('ultSoundwave', { g: this, n: frozen });
      for (let i = 0; i < 44; i++) {
        const a = rand(0, TAU);
        this.particles.push(new Particle(
          this.player.x, this.player.y,
          Math.cos(a) * rand(300, 780), Math.sin(a) * rand(300, 780),
          rand(0.3, 0.7), rand(3, 7), ['#7fe7ff', '#fff', '#35e0ff'][randi(0, 2)]));
      }
      this.toast('🔊 禁锢声波！敌人静止 4 秒', 2);
    }

    /** [战狂] 血怒：无敌（不死亡）5s，受创越多弹幕增伤越高（最高 3 倍） */
    ultBloodrage() {
      SFX.ultimate();
      SFX.bossEnrage();
      const p = this.player;
      p.bloodRageT = 5;
      p.rageBoost = 0;
      this.shake(12);
      this.flashT = 0.4; this.flashColor = '#ff5252';
      for (let i = 0; i < 40; i++) {
        const a = rand(0, TAU);
        this.particles.push(new Particle(
          p.x, p.y, Math.cos(a) * rand(150, 420), Math.sin(a) * rand(150, 420),
          rand(0.35, 0.75), rand(3, 7), ['#ff2a0a', '#ff5a1a', '#ffd23b', '#fff'][randi(0, 3)]));
      }
      this.toast('🩸 血怒开启！受创越多，弹幕越强', 2.2);
    }

    /** [超猫] 五重激光串：5 道追踪激光，秒杀小怪（含地下龙类）、每道对 Boss 造成 4% 最大生命、摧毁障碍；
     *  5 道初射角度各不相同（扇形展开），发射后由追踪转向修正命中目标 */
    ultLasers() {
      SFX.ultimate();
      this.shake(12);
      this.flashT = 0.4; this.flashColor = '#35e0ff';
      const p = this.player;
      // 收集屏幕内目标（含地下龙类小段：以首节为代表目标；本体草龙免疫秒杀的约定保留——激光只杀伤小段与普通敌人）
      const targets = [];
      this.enemies.forEach(e => {
        if (e.dead) return;
        if (e.segments) {
          if (e.isMini) { const fa = e.firstAlive(); if (fa) targets.push(fa.s); }   // 小段：以首节为追踪目标
        } else targets.push(e);
      });
      this.bosses.forEach(b => { if (!b.dead && b.state !== 'enter' && b.state !== 'trans') targets.push(b); });
      for (let i = 0; i < 5; i++) {
        const t = targets.length ? targets[i % targets.length] : null;
        const a = t ? Math.atan2((t.y || CFG.H / 2) - p.y, (t.x || CFG.W / 2) - p.x) : 0;
        // 初射角度以瞄准角为中心扇形展开（i=0..4 → -0.64/-0.32/0/+0.32/+0.64 rad，各不相同）
        const la = a + (i - 2) * 0.32;
        this.bullets.push(new Bullet(p.x + 30, p.y, Math.cos(la) * 560, Math.sin(la) * 560, {
          kind: 'ultlaser', friendly: true, dmg: 60, r: 9,
          homing: true, turnRate: 5.5, target: t, life: 3.2,
          ultraKill: true, bossDmgRatio: 0.04, rockBreak: true, rockReact: true,
          trailCols: ['#35e0ff', '#a5f3fc', '#fff', '#7fe7ff'], trailLite: true
        }));
      }
      this.toast('🦸 五重激光串！', 1.8);
    }

    gainXp(v) {
      // 骨龙王崩解（分裂）阶段不累计经验：该阶段三选一被彻底禁用，
      // 经验在 Boss 死亡时统一结算为固定 1 次三选一，避免累积后连弹
      const boneSplit = (this.bosses || []).some(b => !b.dead && b.headAlive === false);
      if (boneSplit) return;
      this.xp += v;
      this.tryLevelUp();
    }

    /** 满足条件即弹出成长选择；无冷却锁，能量可连续触发（门槛随次数递增） */
    tryLevelUp() {
      if (this.state !== 'playing') return;
      if (this.xp < this.xpNeed) return;
      // 骨龙王崩解（分裂）阶段不弹三选一
      const boneSplit = (this.bosses || []).some(b => !b.dead && b.headAlive === false);
      if (boneSplit) return;
      this.xp -= this.xpNeed;
      this.totalLevels++;
      this.xpNeed = CFG.xpNeed(this.totalLevels);   // 下一次需求更高：成长越来越难
      this.openLevelup();
    }

    /* ---------------- 三选一强化 ---------------- */
    /** 卡池选项权重：按玩家当前短板投放（缺什么给什么），拿到后形成正反馈；
     *  guaranteed 强制项不经过此加权。所有规则只调权重不做硬过滤，保留随机性与惊喜感 */
    upgradeWeight(u) {
      const p = this.player;
      let w = 1;
      const hpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
      // 残血且续航差：生存类权重提高
      if (['life', 'heal', 'shield', 'shieldC', 'shieldR', 'lifeUp'].includes(u.id) && hpRatio < 0.45) w *= 2.6;
      // 理论 DPS 低于本轮参考值 80%：攻击强化优先
      if (u.id === 'atk' && this.playerDps() < CFG.boss.refDpsAt(this.round) * 0.8) w *= 1.7;
      // 弹道数低于"轮次推荐"（1+round，封顶7）：新炮管 / 弹道优先
      if (['way', 'tail', 'down'].includes(u.id) && p.bulletCount < Math.min(7, this.round + 1)) w *= 1.8;
      // 还没有任何元素弹道：优先开元素维度（元素精通卡 P3 也在此加权）
      if (['flame', 'poison', 'ice'].includes(u.id) && p.elementWay.length === 0) w *= 1.6;
      if (u.id === 'flameM' && p.elementWay.includes('flame')) w *= 1.5;
      if (u.id === 'poisonM' && p.elementWay.includes('poison')) w *= 1.5;
      if (u.id === 'iceM' && p.elementWay.includes('ice')) w *= 1.5;
      // 已有体系的连贯强化：闪电链 / 刀刃系
      if (u.id === 'chainN' || u.id === 'bladeN' || u.id === 'bladeL') w *= 1.5;
      return w;
    }
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
        // 角色限定项：仅指定角色可见（如小白的子弹升级）
        if (u.charOnly && this.player.charId !== u.charOnly) return false;
        return true;
      });
      // 角色专属「子弹成长」项注入（侠客/法师/浪客/战狂/超猫）
      const cb = window.CHARS && window.CHARS.bulletUpgrade(this.player.charId);
      if (cb && cb.can(this.player)) pool.push(cb);
      const opts = [];
      // guaranteed 项强制放入选项（从 pool 中提取，can 已验证通过）
      const guaranteed = pool.filter(u => u.guaranteed && u.guaranteed(this.player, this));
      guaranteed.forEach(u => {
        const idx = pool.indexOf(u);
        if (idx >= 0) pool.splice(idx, 1);
        opts.push(u);
      });
      while (opts.length < 3 && pool.length) {
        // 缺口加权抽样（权重见 upgradeWeight）：残血给生存、DPS 落后给攻击/炮管、缺元素给元素
        let total = 0;
        const weights = pool.map(u => { const w = this.upgradeWeight(u); total += w; return w; });
        let roll = Math.random() * total;
        let i = 0;
        for (; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) break; }
        if (i >= pool.length) i = pool.length - 1;
        opts.push(pool.splice(i, 1)[0]);
      }
      this.pendingOptions = opts;
      this.el.luCards.innerHTML = '';
      opts.forEach((u, i) => {
        const card = document.createElement('div');
        const isGuaranteed = guaranteed.includes(u);
        card.className = 'lu-card ' + u.cls + (isGuaranteed ? ' lu-recommend' : '');
        const lv = u.level(this.player);
        const descText = typeof u.desc === 'function' ? u.desc(this.player, this) : u.desc;
        card.innerHTML =
          `<div class="card-key">${i + 1}</div>` +
          (isGuaranteed ? '<div class="card-rec">★ 推荐</div>' : '') +
          `<div class="card-icon">${u.icon}</div>` +
          `<div class="card-name">${u.name}</div>` +
          `<div class="card-lv">${lv > 0 ? '当前 Lv.' + lv : '未拥有'}</div>` +
          `<div class="card-desc">${descText}</div>`;
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
      if (window.Ach) Ach.evt('upgrade', { g: this, id: u.id, name: u.name });
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
      // 首次获得新能力时弹出提示（右下角）
      if (isNew) this.toast(u.id === 'chain' ? '⚡ 闪电子弹解锁！' : '† 防护刀刃解锁！', 2, 'rb');
      // 元素弹道选择提示（右下角）
      if (['flame', 'poison', 'ice'].includes(u.id)) {
        const names = { flame: '🔥火焰', poison: '☠毒液', ice: '❄寒冰' };
        const cnt = this.player.elementWay.filter(x => x === u.id).length;
        this.toast(`${names[u.id]}弹道 ${cnt}/3`, 1.5, 'rb');
      }
      this.state = 'playing';
      // 无冷却锁：若剩余能量仍满足门槛，下一帧会连续弹出下一次成长选择
    }

    /* ---------------- Boss 调度 ---------------- */
    scheduleNextBoss() {
      // bossT = 本轮刷怪段硬上限 Tmax；满足 Tmin + 击杀门槛 K 时主循环会提前触发
      this.bossT = CFG.boss.roundSchedAt(this.round)[1];
      // 罗马角斗场：Boss 出现间隔减半（硬上限同步缩短）
      if (this.mapId === 'colosseum') {
        this.bossT = Math.max(1, Math.round(this.bossT * CFG.map.arenaBossTimeMul));
      }
      this.roundT = 0;
      this.roundKills = 0;
    }
    triggerBossWarn() {
      // 所有 Boss 等权，每一轮都可能出现；本局已出场过的 Boss 后续出场权重持续减半（bossSeen），
      // 直至所有非专属 Boss 全部轮过一遍后清空记录、概率恢复正常（spawnBoss 中重置）
      // 地图专属 Boss（狮身人面像/牛魔/骨龙王）：
      //   ① 强制概率轮（forceChance 声明的序号）内独立掷骰，命中直接出场、未命中本轮不入随机池；
      //   ② 离开强制轮后（无论强制轮内是否命中过）拉平为等权普通池成员，可反复出场，
      //      但地图限定永久生效（狮身人面像仅沙漠、牛魔仅草原、骨龙王仅荒地）
      const ord = this.bossSpawned + 1;
      // ordOk：minOrd 之前不可出场；专属 Boss 无 maxOrd——强制轮结束后仍留在池中
      const ordOk = b =>
        (b.minOrd === undefined || b.minOrd <= ord) &&
        (b.maxOrd === undefined || ord <= b.maxOrd);
      // map：专属 Boss 永久锁定本图；大海不出现地面移动型 Boss（蛙哥/野鸡王）；
      // 群山无立足之地：不出现地面移动型 Boss，斧王（BossMan，非地面标记）也永不进入群山
      const mapOk = b =>
        (b.map === undefined || b.map === this.mapId) &&
        !(b.ground && (this.mapId === 'ocean' || this.mapId === 'mountains')) &&
        !(this.mapId === 'mountains' && b.cls.name === 'BossMan');
      let pool = window.BOSS_LIST.filter(b => ordOk(b) && mapOk(b));
      if (!pool.length) {
        // 兜底1：放宽大海地面限制等通用地图限制（地图限定 Boss 均带 map 属性，不可放宽，防止空池卡死）；
        // 群山的斧王/地面 Boss 禁令属硬性规则，兜底也不放宽
        pool = window.BOSS_LIST.filter(b => ordOk(b) && b.map === undefined && mapOk(b));
      }
      if (!pool.length) pool = window.BOSS_LIST.slice();
      // 不连续两轮出现同一个 Boss：从最终候选池剔除上一只（池中有其他选择时才剔除）
      if (this.lastBossName) {
        const withoutLast = pool.filter(b => b.cls.name !== this.lastBossName);
        if (withoutLast.length) pool = withoutLast;
      }
      // forceChance：专属 Boss 在强制概率轮有独立的直接出场概率；未命中则不参与本轮随机池；
      // 离开强制轮后 forceChance[ord] 为空，自然作为普通等权成员进入随机池
      const forceable = b => b.forceChance && b.forceChance[ord] !== undefined;
      let pick = null;
      const forceList = pool.filter(forceable);
      for (const b of forceList) {
        if (Math.random() < b.forceChance[ord]) { pick = b; break; }
      }
      // 加权随机：基础权重一致（等权），本局已出场过的 Boss 权重 ×0.5
      const randomPool = pool.filter(b => !forceable(b));
      if (!pick) {
        const p2 = randomPool.length ? randomPool : pool;
        const weights = p2.map(b => (b.weight || 1) * (this.bossSeen.has(b.cls.name) ? 0.5 : 1));
        let total = 0;
        for (const w of weights) total += w;
        let r = Math.random() * total;
        for (let i = 0; i < p2.length; i++) {
          r -= weights[i];
          if (r <= 0) { pick = p2[i]; break; }
        }
        if (!pick) pick = p2[p2.length - 1];   // 浮点兜底
      }
      this.pendingBoss = pick.cls;
      this.pendingBossMusic = pick.music || 'boss-1';   // 预警期即切到该 Boss 专属曲目
      this.warnT = CFG.boss.warnTime;
      this.el.warnSub.textContent = '强大的气息逼近了！';
      this.el.warn.classList.remove('hidden');
      SFX.bossWarn();   // 三轮递进警笛（紧张感逐级抬升）
    }
    spawnBoss(cls) {
      const b = new cls(this);
      const entry = (window.BOSS_LIST || []).find(e => e.cls === cls);
      b.musicTheme = (entry && entry.music) || 'boss-1';   // 专属 BGM（boss-1/boss-2/各 Boss 专属曲目）
      if (window.Ach) Ach.evt('bossSpawn', { g: this, name: cls.name });
      this.bosses.push(b);
      this.bossSpawned++;
      this.lastBossName = cls.name;   // 记录上一只：下一轮抽取时剔除，禁止连续重复
      try { localStorage.setItem('flytiger_last_boss', cls.name); } catch (e) {}  // 跨局记忆：新局首只也剔除
      this.bossSeen.add(cls.name);   // 登记出场：后续抽取权重减半
      // 所有非地图限定 Boss（带 map 属性的专属 Boss 永久留在本图普通池）均已轮过一遍
      // → 清空记录，概率恢复正常。专属 Boss 无单次限制：仅受权重减半与不连续重复约束
      const cyclable = (window.BOSS_LIST || []).filter(e => e.map === undefined);
      if (cyclable.length && cyclable.every(e => this.bossSeen.has(e.cls.name))) {
        this.bossSeen.clear();
      }
      this.el.bossName.textContent = `${b.bossName}`;
      this.el.bossHud.classList.remove('hidden');
      this.resetBossBarFx();   // 新 Boss：血条满状态，清空斩击/灼烧残留
      this.toast(`${b.bossName} 出现！`, 2, 'lt');
      if (b.musicTheme === 'boss-fuwang') {
        SFX.bossArmy();   // 大王登场：万军齐吼"好！好！好！" + 战鼓号角
      } else {
        SFX.bossRoar();   // 登场咆哮：低频砸地 + 不和谐音簇轰鸣
      }
      this.shake(6);
      // 癫狂鬣狗出场：场景内刷出更多障碍物（草原山石），增加战场复杂度
      if (cls.name === 'MadHyena') {
        for (let i = 0; i < 6; i++) {
          const kind = Math.floor(Math.random() * 5);
          const rock = new Rock(0, 'grass' + kind);
          rock.x = CFG.W + 100 + i * 170 + Math.random() * 80;
          this.rocks.push(rock);
        }
        this.toast('场景中出现了更多障碍物！', 1.6, 'lt');
      }
    }
    onBossDefeated(boss) {
      this.bossCount++;
      // 击败 1 个 Boss = 通过 1 轮
      this.round = this.bossCount + 1;
      this.wayPicksThisRound = 0;   // 新一轮重置弹道成长计数
      this.elemPicksThisRound = 0;  // 新一轮重置元素弹道成长计数
      this.grassDragonThisRound = false;   // 新一轮重置草龙出场标记
      if (Hazards) Hazards.startRound(this);   // 新一轮重排特殊机关触发时刻
      this.startBreakRound();                   // 新一轮重排破碎障碍物出场时刻
      // 飞行弹幕敌人：每轮 30% 概率解锁各档次中 1 只未解锁的
      this.rollFlyerUnlocks();
      this.score += 500;
      this.kills++;
      this.addRage(CFG.ultimate.rageBoss);
      // 成就系统：Boss 击败结算 + 轮次推进（须在回血奖励之前读取残血状态）
      if (window.Ach) {
        Ach.evt('bossDefeated', { g: this, boss: boss });
        Ach.evt('round', { g: this, round: this.round });
      }
      // Boss 死亡：场上所有敌方弹幕无效化，逐渐消失
      this.bullets.forEach(b => { if (!b.friendly) b.neutralize(); });
      // 击败 Boss 默认回复 40% 生命
      const heal = Math.round(this.player.maxHp * 0.4);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      // 每击败 1 只 Boss 解锁 1 种新小怪
      const unlocked = Object.keys(CFG.enemies)
        .filter(t => (CFG.enemies[t].minBossKills || 0) === this.bossCount)
        .map(t => CFG.enemies[t].name);
      // 怪物潮：普通地图每击败 3 个 Boss 触发一次（30 秒）；
      // 罗马角斗场每过 1 轮（击败任意 Boss）即触发，时长 60 秒（普通地图 2 倍），小怪数量 ×3
      const arena = this.mapId === 'colosseum';
      const tide = arena || this.bossCount % 3 === 0;
      if (tide) {
        this.tideT = arena ? CFG.map.arenaTideTime : 30;
        this.toast(arena ? `⚠ 角斗场怪物潮来袭：小怪数量 ×3！坚持 ${CFG.map.arenaTideTime} 秒！` : `⚠ 怪物潮来袭：小怪数量 ×3！`, 3.6);
      }
      void unlocked;   // 解锁信息静默处理，不再弹 tips
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
      // 骨龙王：死亡后固定只结算 1 次三选一（分裂阶段已禁用经验累积）
      if (boss.constructor && boss.constructor.name === 'BoneDragonKing') {
        this.totalLevels++;
        this.xpNeed = CFG.xpNeed(this.totalLevels);
        this.openLevelup();
      }
      // 任务委托：击败 1 只 Boss = 全局推进 1 轮（进行中委托据此结算/超时）
      if (window.MISSIONS) {
        try { MISSIONS.advanceRound(); } catch (e) {}
      }
      // 月痕沙海关卡：击败最终 Boss → 弹出奖励页
      if (this.stageMode) {
        this.showReward();
      }
    }

    /* ---------------- 火球爆炸 ---------------- */
    explodeFireball(x, y, frags, fragDmg, radius, src) {
      burst(this, x, y, 26, ['#ff7b2e', '#ffd23b', '#c94a1e', '#fff'], 280, 6, 0.6, 100);
      SFX.explode(false);
      this.shake(7);
      // 分裂火焰弹（继承原弹的击杀归因）
      for (let i = 0; i < frags; i++) {
        const a = (TAU / frags) * i + rand(-0.1, 0.1);
        this.bullets.push(new Bullet(x, y,
          Math.cos(a) * 150, Math.sin(a) * 150,
          { kind: 'flame', r: 6, dmg: fragDmg, life: 3.2, src }));
      }
      // 玩家在爆炸范围内受伤
      const p = this.player;
      if (Math.hypot(p.x - x, p.y - y) < radius + p.radius) p.hurt(fragDmg, this, src);
    }

    /* ---------------- 炮弹爆炸（炮师 / 可引爆弹） ---------------- */
    shellBlast(x, y, dmg, src) {
      const R = CFG.cannoneer.blastR;
      burst(this, x, y, 30, ['#ff7b2e', '#ffd23b', '#c94a1e', '#fff'], 300, 7, 0.6, 120);
      SFX.explode(false);
      this.shake(8);
      const p = this.player;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < R + p.radius) {
        p.hurt(Math.round(dmg * (d < R * 0.55 ? 1 : 0.6)), this, src);
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
      let hits = 0;
      this.targets().forEach(e => {
        if (e.segments) {
          // 草龙：爆炸范围内的露出节全部受伤
          const wasAlive = !e.dead;
          e.aoeDamage(x, y, radius, dmg, this);
          if (wasAlive && e.dead) hits++;
          return;
        }
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < radius + e.radius) {
          hits++;
          e.takeDamage(dmg, this, {
            x: (e.x - x) / (d || 1) * 180,
            y: (e.y - y) / (d || 1) * 180
          });
        }
      });
      if (window.Ach && hits >= 2) Ach.evt('aoeHits', { g: this, n: hits });
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

    /** 飞行弹幕敌人解锁：通过指定关卡后，每轮各档次 30% 概率解锁 1 只未解锁的 */
    rollFlyerUnlocks() {
      const tierMinBoss = { weak: 2, medium: 3, strong: 4 };
      for (const tier of Object.keys(tierMinBoss)) {
        if (this.bossCount < tierMinBoss[tier]) continue;
        if (Math.random() > 0.30) continue;          // 每轮 30% 概率
        const candidates = Object.keys(CFG.enemies).filter(t => {
          const d = CFG.enemies[t];
          return d.flyer && d.flyerTier === tier && !this.unlockedFlyers.has(t);
        });
        if (!candidates.length) continue;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        this.unlockedFlyers.add(pick);
        const tierName = tier === 'weak' ? '弱型' : tier === 'medium' ? '中型' : '强型';
        this.toast(`✨ 新${tierName}飞行敌人登场：${CFG.enemies[pick].name}！`, 2.8);
      }
    }

    /** 按权重随机抽取一种当前可出场的敌人（精英/地面单位场上限 1；草龙每轮限 1 只） */
    pickEnemyType() {
      const table = [];
      Object.keys(CFG.enemies).forEach(type => {
        const def = CFG.enemies[type];
        if (def.bossOnly) return;            // Boss 专属召唤怪（斧王斧头兵）：永不进入普通刷怪池
        // 月痕沙海：时间表已解锁的小怪，无视 Boss 击败数 / 飞行解锁 / 斗兽场限定三道门槛
        const stageOk = this.stageMode && this.stageUnlocked.has(type);
        if ((def.minBossKills || 0) > this.bossCount && !stageOk) return;        // 未达成 Boss 击败数：每击败1只Boss解锁1种
        if (def.flyer && !this.unlockedFlyers.has(type) && !stageOk) return;    // 飞行弹幕敌人：仅已解锁的出场
        if (def.ground && (this.mapId === 'ocean' || this.mapId === 'mountains')) return;           // 大海/群山：不出现地面类敌人（弓箭手/炮师）
        if (def.arenaOnly && this.mapId !== 'colosseum' &&
            !(this.mapId === 'moondesert' && stageOk)) return;      // 斗兽场专属小怪（投掷奴/羊头斗士/盾奴/皮影客/自爆囚）
        if (def.oncePerRound && this.grassDragonThisRound) return;   // 草龙：每轮至多一次
        if ((def.elite || def.ground) && this.enemies.some(e => e.type === type && !e.isMini)) return;  // 精英/地面单位场上限 1（分裂小段不计）
        // 罗马角斗场：地面类敌人（弓箭手/炮师）刷出权重 ×3，明显更常见
        const w = def.weight * (def.ground && this.mapId === 'colosseum' ? CFG.map.arenaGroundWeight : 1);
        for (let i = 0; i < w; i++) table.push(type);
      });
      return table.length ? table[Math.floor(Math.random() * table.length)] : null;
    }

    /* ---------------- 月痕沙海关卡 ---------------- */
    stageTick(dt) {
      if (this.bossIntro) { this.updateBossIntro(dt); return; }
      this.stageTime += dt;
      const cfg = CFG.moondesert;
      // 中途怪物潮：第 2 / 4 分钟各一次，每次 30 秒
      cfg.waveTime.forEach((wt, idx) => {
        if (!this.stageWavesTriggered.has(idx) && this.stageTime >= wt) {
          this.stageWavesTriggered.add(idx);
          this.tideT = cfg.waveDur;
          this.toast(`⚠ 月痕沙海怪物潮来袭：小怪数量 ×3！坚持 ${cfg.waveDur} 秒！`, 3.2);
          SFX.warn();
        }
      });
      // 按关卡时间解锁小怪：到点保底刷出（horde 为一次群体），之后加入随机池
      (cfg.spawnSchedule || []).forEach(s => {
        if (this.stageSpawnsDone.has(s.type) || this.stageTime < s.t) return;
        this.stageSpawnsDone.add(s.type);
        this.stageUnlocked.add(s.type);
        const def = CFG.enemies[s.type];
        if (s.horde) {
          // 群体事件：直接构造，绕过同类型场上限与普通刷怪上限（40 只硬顶）
          for (let i = 0; i < s.horde && this.enemies.length < 40; i++) {
            this.enemies.push(new Enemy(s.type, this));
          }
          this.toast(`⚠ 大量${def.name}蜂拥而来！`, 3.2);
          SFX.warn();
        } else {
          this.spawnEnemy(s.type);
          this.toast(`✨ ${def.name} 出现在月痕沙海！`, 2.8);
        }
      });
      // 6 分钟到点：召唤最终 Boss 狮身人面像（带专属入场演出）
      if (!this.stageBossSpawned && this.stageTime >= cfg.duration && !this.bossActive && this.warnT <= 0) {
        this.stageBossSpawned = true;
        this.tideT = 0;
        this.enemies.forEach(e => e.dead = true);   // 清场小怪
        this.bullets.forEach(b => { if (!b.friendly) b.neutralize(); });
        this.startBossIntro();
      }
      // 台词计时
      if (this.dialogueBox) {
        this.dialogueBox.t -= dt;
        if (this.dialogueBox.t <= 0) this.dialogueBox = null;
      }
    }

    /** Boss 入场演出：黑边压下 → 感叹号 → Boss 从右入场+台词1 → 玩家左移+台词2 → 黑边收回 */
    startBossIntro() {
      this.shootDisabled = true;
      this.bossIntro = { phase: 'bars', t: 0, mark: false };
    }
    updateBossIntro(dt) {
      const bi = this.bossIntro;
      if (!bi) return;
      bi.t += dt;
      // 台词计时在演出期间也要走（否则渐入透明度恒为 0，台词全程不可见）
      if (this.dialogueBox) {
        this.dialogueBox.t -= dt;
        if (this.dialogueBox.t <= 0) this.dialogueBox = null;
      }
      if (bi.phase === 'bars') {
        // 黑边压下（0.8s）
        this.letterbox = Math.min(1, this.letterbox + dt / 0.8);
        if (bi.t > 0.9) {
          bi.phase = 'line1'; bi.t = 0;
          bi.mark = true;                          // 玩家身边弹出感叹号
          this.spawnStageBoss();                   // Boss 从屏幕右侧入场（cinematicHold：只滑入不开火）
          this.showDialogue('又一个来翻我东西的。上一个——算了，你站的地方就是上一个。', 4.5);
        }
      } else if (bi.phase === 'line1') {
        // 玩家自动左移到屏幕左侧
        const p = this.player;
        p.x += (120 - p.x) * Math.min(1, dt * 2.0);
        if (bi.t > 4.2) {
          bi.phase = 'line2'; bi.t = 0;
          this.showDialogue('别动。你脚上沾着灰，老灰，地底深处那种。你去过我的墓室。你看见了吧？那个空着的地方。', 5.5);
        }
      } else if (bi.phase === 'line2') {
        const p = this.player;
        p.x += (120 - p.x) * Math.min(1, dt * 1.5);
        if (bi.t > 5.2) {
          bi.phase = 'out'; bi.t = 0;
          const b = this.bosses[0];
          if (b) b.cinematicHold = false;          // 放行：Boss 滑向中场，正式开打
        }
      } else if (bi.phase === 'out') {
        // 黑边收回，恢复射击
        this.letterbox = Math.max(0, this.letterbox - dt / 0.6);
        if (this.letterbox <= 0) {
          this.letterbox = 0;
          this.shootDisabled = false;
          this.bossIntro = null;
          this.dialogueBox = null;
        }
      }
    }

    /** 生成关卡最终 Boss（狮身人面像）并播放专属 BGM */
    spawnStageBoss() {
      const entry = (window.BOSS_LIST || []).find(e => e.cls.name === 'Sphinx');
      if (!entry) return;
      const b = new entry.cls(this);
      b.musicTheme = entry.music || 'boss-shishenrenmian';
      b.x = CFG.W + 120; b.y = 150;   // 从屏幕右侧入场
      b.state = 'enter';
      b.cinematicHold = true;         // 入场演出期间只滑入悬停，不开火；演出结束放行
      this.bosses.push(b);
      this.bossSpawned++;
      this.lastBossName = 'Sphinx';
      try { localStorage.setItem('flytiger_last_boss', 'Sphinx'); } catch (e) {}  // 跨局记忆：关卡后新局首只也不再是 Sphinx
      this.el.bossName.textContent = `${b.bossName}`;
      this.el.bossHud.classList.remove('hidden');
      this.resetBossBarFx();
      this.toast(`${b.bossName} 出现！`, 2, 'lt');
      SFX.bossRoar();
      this.shake(6);
    }

    /** 显示 Boss 台词（底部对白框） */
    showDialogue(text, dur) {
      this.dialogueBox = { text, t: dur || 4, max: dur || 4 };
    }

    /** 关卡通关奖励页 */
    showReward() {
      this.rewardShown = true;
      this.rewardCanClose = false;
      this.rewardT = 0;
      this.state = 'reward';
      this.shakeMag = 0;        // 通关瞬间清掉死亡爆炸等残留震屏，奖励页不抖动
      if (this.el.reward) {
        this.el.reward.classList.remove('hidden');
      }
      // 延迟 0.5s 播放惊喜音效
      setTimeout(() => { if (SFX.rewardSurprise) SFX.rewardSurprise(); }, 500);
      // 4 秒后允许点击/按键关闭
      setTimeout(() => { this.rewardCanClose = true; }, 4000);
    }
    closeReward() {
      if (!this.rewardCanClose) return;
      this.rewardShown = false;
      this.rewardCanClose = false;
      this.stageMode = false;
      if (this.el.reward) this.el.reward.classList.add('hidden');
      // 特殊关通关：通知任务系统（发现面板移除卡片、限时任务永久关闭）
      if (window.MISSIONS) { try { MISSIONS.notifyStageCleared(); } catch (e) {} }
      // 退回主界面
      this.state = 'menu';
      this.shakeMag = 0;        // 回主界面：立即停止一切残留震屏
      this.el.hud.classList.add('hidden');
      this.el.bossHud.classList.add('hidden');
      this.el.menu.classList.remove('hidden');
      this.rollMap();
    }

    spawnTick(dt) {
      if (this.bossActive || this.bossIntro) return;      // Boss 战/入场演出不刷普通怪
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
        } else if (type === 'spikebird') {
          // 刺羽鸟：5 个一组出场
          const n = 5 * (tide ? 3 : 1);
          for (let i = 0; i < n; i++) setTimeout(() => {
            if (this.state === 'playing') this.spawnEnemy('spikebird');
          }, i * 180);
        } else if (type === 'eagle' && Math.random() < 0.4) {
          this.spawnEnemy('eagle');
          setTimeout(() => { if (this.state === 'playing') this.spawnEnemy('eagle'); }, 500);
        } else {
          this.spawnEnemy(type);
        }
      }
    }

    /* ---------------- 山石障碍 ---------------- */
    /** 场上障碍上限：单侧地图沿用旧值；上下双侧新地图基础 5，随轮次缓增 */
    rockMaxCount() {
      if (this.map && this.map.obsTop) return Math.min(9, 5 + Math.floor((this.round - 1) / 4));
      return 2 + Math.floor((this.round - 1) / 3);
    }
    rockTick(dt) {
      this.rockT -= dt;
      if (this.rockT > 0) return;
      if (this.rocks.length >= this.rockMaxCount()) { this.rockT = 1.5; return; }
      // Boss / 怪物潮：障碍出现概率降到较低水准（长间隔 + 50% 落空），特殊机关由 Hazards 模块停用
      const lowDensity = !!(this.bossActive || this.isTide);
      if (lowDensity) {
        this.rockT = rand(CFG.map.bossRockGap[0], CFG.map.bossRockGap[1]);
        if (Math.random() < 0.5) return;
      }
      // 造型：草原沿用原 5 种山石权重；其余地图从本地图障碍表（高/中/低）随机；
      // 新地图障碍上下交错：obs 地面生长 / obsTop 顶部悬挂，各 50%
      let rock;
      if (this.map && this.map.obs) {
        if (this.map.obsTop && Math.random() < 0.5) {
          const shapeId = this.map.obsTop[Math.floor(Math.random() * this.map.obsTop.length)];
          rock = new Rock(0, shapeId, true);
        } else {
          const shapeId = this.map.obs[Math.floor(Math.random() * this.map.obs.length)];
          rock = new Rock(0, shapeId);
        }
      } else {
        const roll = Math.random();
        const kind = roll < 0.26 ? 2 : roll < 0.44 ? 4 : roll < 0.60 ? 1 : roll < 0.78 ? 3 : 0;
        rock = new Rock(0, 'grass' + kind);
      }
      const halfW = rock.w / 2;
      // 与上一块障碍保持安全间隔
      const rightmost = this.rocks.reduce((m, r) => Math.max(m, r.x), -9999);
      rock.x = Math.max(CFG.W + halfW + 260, rightmost + halfW + rand(480, 820));
      // 斧王 Boss 战：障碍物刷出后立刻爆炸，形成圆形范围爆炸特效
      const bossManHere = this.bosses.some(b => b.constructor.name === 'BossMan' && !b.dead);
      if (bossManHere) {
        const cx = rock.x, cy = rock.baseY - rock.h * 0.4;
        this.rocks.push(rock);
        rock.destroy(this, true);
        // 圆形范围爆炸：双层扩散冲击波环 + 大范围火球
        if (this.fxRings) {
          this.fxRings.push({ x: cx, y: cy, r: 10, vr: 520, t: 0, life: 0.55, col: '#ff7b2e' });
          this.fxRings.push({ x: cx, y: cy, r: 6, vr: 780, t: 0, life: 0.4, col: '#ffd23b' });
        }
        burst(this, cx, cy, 26, ['#ff7b2e', '#ffd23b', '#fff5d0', '#c94a1e', '#fff'], 420, 7, 0.7, 200);
        this.rockT = rand(1.8, 2.8);
        return;
      }
      this.rocks.push(rock);
      // 刷出间隔：新地图按各自密度配置（gap），旧地图固定 2.0-3.5s
      this.rockT = this.map && this.map.gap ? rand(this.map.gap[0], this.map.gap[1]) : rand(2.0, 3.5);
    }

    /* ---------------- 破碎障碍物（子弹打满次数爆炸） ---------------- */
    /** 每轮开始：按地图 brk 配置排定出场时刻（p<1 时按概率决定本轮是否出现） */
    startBreakRound() {
      this.breakQueue = [];
      const specs = this.map && this.map.brk;
      if (!specs) return;
      for (const spec of specs) {
        let n = randi(spec.n[0], spec.n[1]);
        if (spec.p !== undefined && spec.p < 1 && Math.random() > spec.p) n = 0;
        for (let i = 0; i < n; i++) {
          // 均匀散布在约 8-44s 的刷怪窗口（每类独立），加随机抖动
          const t = 8 + 36 / Math.max(1, n) * (i + rand(0.15, 0.95)) + rand(-2, 2);
          this.breakQueue.push({ t: Math.max(6, t), spec });
        }
      }
      this.breakQueue.sort((a, b) => a.t - b.t);
    }
    /** 出场时刻到点：Boss / 怪物潮期间仅保留 15% 低概率，其余顺延落空 */
    breakTick(dt) {
      if (!this.breakQueue.length) return;
      this.breakQueue[0].t -= dt;
      if (this.breakQueue[0].t > 0) return;
      const ev = this.breakQueue.shift();
      if ((this.bossActive || this.isTide) && Math.random() > 0.15) return;
      this.spawnBreakable(ev.spec);
    }
    spawnBreakable(spec) {
      const b = new Breakable(0, spec.id, { style: spec.styles ? randi(0, spec.styles - 1) : 0 });
      const rightmost = this.breakables.reduce((m, q) => Math.max(m, q.x), -9999);
      b.x = Math.max(CFG.W + b.w / 2 + 220, rightmost + b.w / 2 + rand(320, 620));
      if (b.float) b.cy = rand(195, 285);   // 漂浮在屏幕中部
      this.breakables.push(b);
    }

    /* ---------------- 地图机制（火山口 / 大海） ---------------- */
    /** 危险地面高度：大海为波动海平面，天空为起伏云面，其余地图为固定地面 */
    groundYAt(x) {
      if (this.sea) return this.seaSurfaceY(x);
      if (this.cloudSea) return this.cloudSeaY(x);
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
    /** 云海面 y（含云团起伏 / 云涌上升；双频正弦模拟滚滚云层） */
    cloudSeaY(x, tOverride) {
      const s = this.cloudSea;
      const t = tOverride !== undefined ? tOverride : s.t;
      const w1 = Math.sin(x * 0.016 + t * 1.2) * s.amp;
      const w2 = Math.sin(x * 0.037 - t * 2.1) * s.amp * 0.5;
      const w3 = Math.sin(x * 0.009 + t * 0.6) * s.amp * 0.3;
      return CFG.GROUND_Y - s.rise + w1 + w2 + w3;
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
      // 天空云海：每 12s 一次云涌 —— 云面翻滚幅度变大、云层整体上升；云层是实体地面（无伤害）
      if (this.cloudSea) {
        const s = this.cloudSea;
        s.t += dt;
        s.surgeT -= dt;
        if (s.surgeT <= 0 && !s.surging) {
          s.surging = true;
          s.surgeT2 = CFG.map.cloudSurgeDur;
          this.toast('☁️ 云层上升！当心被云吞没！', 2.4);
          this.shake(4);
        }
        if (s.surging) {
          s.surgeT2 -= dt;
          if (s.surgeT2 <= 0) { s.surging = false; s.surgeT = CFG.map.cloudSurgeInterval; }
        }
        const riseTarget = s.surging ? CFG.map.cloudRise : 0;
        const ampTarget = s.surging ? CFG.map.cloudSurgeAmp : CFG.map.cloudAmp;
        s.rise += (riseTarget - s.rise) * Math.min(1, dt * (s.surging ? 2.2 : 1.4));
        s.amp += (ampTarget - s.amp) * Math.min(1, dt * 2.0);
        // 云面飘散的小云絮
        if (Math.random() < dt * (s.surging ? 10 : 3)) {
          const fx = rand(0, CFG.W);
          this.particles.push(new Particle(fx, this.cloudSeaY(fx) - rand(6, 26),
            rand(-46, -10), rand(-16, 6), rand(0.4, 0.8), rand(3, 6),
            Math.random() < 0.7 ? '#eef1f8' : '#c2c8d8'));
        }
      }
      // 火焰山火山口：场景物件，随卷轴向左移动，移出屏幕后从右侧重新出现；
      // 喷发前 0.9s 蓄力（震动 + 火星），随后抛射巨大火焰弹
      if (this.crater) {
        const c = this.crater;
        c.x -= 62 * dt * (this.map.scrollMul || 1);           // 与地面卷轴同步
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
    /** 火山弹落地爆炸：大范围火焰伤害 + 波及障碍炸毁（火山环境伤害） */
    lavaBlast(x, y, dmg) {
      const R = CFG.map.lavaBlastR;
      burst(this, x, y, 44, ['#ff7b2e', '#ffd23b', '#c94a1e', '#fff5d0', '#fff'], 360, 8, 0.8, 150);
      SFX.explode(true);
      this.shake(11);
      const p = this.player;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < R + p.radius) p.hurt(Math.round(dmg * (d < R * 0.55 ? 1 : 0.6)), this, { k: 'env', key: 'lava' });
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
          if (this.deathScene) {
            this.updateDeathScene(dt);   // 死亡演出：黑气/死法文本推进
            // 死亡演出本身不衰减震屏，这里补衰减，防止震屏值冻结后画面一直抖
            this.shakeMag = Math.max(0, this.shakeMag - dt * 30);
            if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
          } else {
            this.updateFx(dt);   // 结算界面：死亡爆炸特效继续播放
          }
        } else {
          // 菜单 / 奖励 / 升级 / 暂停：只衰减残留的震屏与闪光，避免跨状态冻结导致主界面持续震动
          this.shakeMag = Math.max(0, this.shakeMag - dt * 30);
          if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
        }
        this.updateMusic();    // 场景→曲目路由（菜单/小怪/怪物潮/各类Boss）
        if (window.Ach) Ach.tick(dt);   // 成就解锁通知队列推进
        // 局外选角界面：每 10s 随机刷新角色心情语录
        if (this.state === 'menu' && this.el.charSel && !this.el.charSel.classList.contains('hidden')) {
          this.moodT -= dt;
          if (this.moodT <= 0) { this.moodT = 10; this.refreshMoods(); }
        }
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
      this.scrollX += dt * 110 * (this.map.scrollMul || 1);
      this.shakeMag = Math.max(0, this.shakeMag - dt * 30);
      if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
      // 月痕沙海关卡模式计时与流程
      if (this.stageMode && this.state === 'playing') this.stageTick(dt);
      // 怪物潮倒计时（Boss 战/预警期间暂停，不浪费潮次）
      if (this.tideT > 0 && !this.bossActive) {
        this.tideT = Math.max(0, this.tideT - dt);
        // 角斗场：挺过怪物潮 → 观众席撒碎礼花 + 鼓掌欢呼
        if (this.tideT === 0 && this.mapId === 'colosseum') {
          this.arenaCelebrate();
          this.toast('🎉 角斗场怪物潮被击退！观众欢呼！', 3);
        }
      }
      // 大招光波扩散
      if (this.ultWave) {
        this.ultWave.r += 2600 * dt;
        this.ultWave.a = Math.max(0, 1 - this.ultWave.r / 1500);
        if (this.ultWave.a <= 0) this.ultWave = null;
      }
      // 声波禁锢 / 斩击特效计时
      if (this.soundwaveT > 0) this.soundwaveT -= dt;
      if (this.slashFx) { this.slashFx.t -= dt; if (this.slashFx.t <= 0) this.slashFx = null; }
      // 百鬼夜行特效：紫环扩散 + 群鬼飘掠
      if (this.phantomFx) {
        const fx = this.phantomFx;
        fx.t -= dt;
        fx.r += 1500 * dt;
        for (let i = 0; i < fx.ghosts.length; i++) fx.ghosts[i].dist += fx.ghosts[i].spd * dt;
        if (fx.t <= 0) this.phantomFx = null;
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
      } else if (!this.bossActive && !this.stageMode) {
        this.bossT -= dt;
        this.roundT += dt;
        if (this.bossT <= 0) {
          this.triggerBossWarn();   // 硬上限 Tmax：强制召唤，防空转
        } else {
          // 双条件：刷怪段 ≥ Tmin 且本轮击杀达 K → 提前召唤（清怪越快，Boss 来得越早）
          const sch = CFG.boss.roundSchedAt(this.round);
          if (this.roundT >= sch[0] && this.roundKills >= sch[2]) this.triggerBossWarn();
        }
      }

      this.spawnTick(dt);
      this.rockTick(dt);
      this.breakTick(dt);
      this.mapTick(dt);
      if (Hazards) Hazards.tick(this, dt);   // 新地图机关（水流/暴风雪/落雷/方石/数据墙）

      // 实体更新（敌人/Boss 更新期间绑定 shooter 上下文，其发射的子弹归因到自己——用于死亡死法判定）
      this.player.update(dt, this);
      this.enemies.forEach(e => {
        setShooter(e);
        try { e.update(dt, this); } finally { clearShooter(); }
      });
      this.bosses.forEach(b => {
        // 声波禁锢：Boss 行动冻结（骨龙王免疫——身体太长会被卡死）
        if (this.soundwaveT > 0 && !b.segments) return;
        setShooter(b);
        try { b.update(dt, this); } finally { clearShooter(); }
      });
      this.bullets.forEach(b => {
        // 声波禁锢：敌方子弹冻结原地（仍可被击爆）
        if (this.soundwaveT > 0 && !b.friendly) return;
        b.update(dt, this);
      });
      this.gems.forEach(g2 => g2.update(dt, this));
      this.particles.forEach(p => p.update(dt));
      this.lightnings.forEach(l => l.update(dt, this));
      this.beams.forEach(b => {
        // 声波禁锢：敌方激光（预警/本体）一并冻结
        if (this.soundwaveT > 0) return;
        b.update(dt, this);
      });
      this.rocks.forEach(r => r.update(dt, this));
      this.breakables.forEach(r => r.update(dt, this));
      this.arcs.forEach(a => a.t += dt);
      this.fxRings.forEach(ring => { ring.t += dt; ring.r += ring.vr * dt; });

      this.collisions();

      // ===== 成就系统：局内帧统计 =====
      if (window.Ach) {
        Ach.frame(dt, this);
        const pl = this.player;
        let enemyBullets = 0, starBullets = 0;
        for (const b of this.bullets) {
          if (b.friendly) {
            if (!b.dead && b.kind === 'star') starBullets++;
            // 飞刀飞出屏幕/触地未命中：连击中断
            if (b.kind === 'knife' && b.dead && !b._achKnifeSettled) {
              b._achKnifeSettled = true;
              if (!b._achHit) Ach.evt('knifeMiss', { g: this });
            }
            continue;
          }
          if (b.dead || b.neutralized) continue;
          enemyBullets++;
          // 擦弹闪避：子弹进入贴身环（未命中）计一次闪避
          if (!b._achDodged) {
            const d = Math.hypot(b.x - pl.x, b.y - pl.y);
            if (d < pl.radius * 0.8 + b.r + 26) {
              b._achDodged = true;
              Ach.evt('dodge', { g: this });
            }
          }
        }
        // 高密度弹幕：场上 55 发以上敌方弹幕时累计存活时间
        if (enemyBullets >= 55) Ach.evt('dense', { g: this, dt: dt });
        // 法师：场上同时存在 12 颗以上星星弹
        if (starBullets >= 12) Ach.evt('starField', { g: this, n: starBullets });
        // 飞刀命中标记回填（命中后不死的穿透飞刀也算命中）
        for (const b of this.bullets) {
          if (b.kind === 'knife' && b.hitSet && b.hitSet.size > 0) b._achHit = true;
        }
        // 长时间不移动：锚点 25 秒内位移小于 12px
        if (!this._idleAnchor) this._idleAnchor = { x: pl.x, y: pl.y, t: 0, fired: false };
        const an = this._idleAnchor;
        if (Math.hypot(pl.x - an.x, pl.y - an.y) > 12) {
          an.x = pl.x; an.y = pl.y; an.t = 0;
        } else {
          an.t += dt;
          if (an.t >= 25 && !an.fired) { an.fired = true; Ach.evt('idleLong', { g: this }); }
        }
      }

      // 清理
      this.enemies = this.enemies.filter(e => !e.dead);
      this.bosses = this.bosses.filter(b => !b.dead);
      this.bullets = this.bullets.filter(b => !b.dead);
      this.gems = this.gems.filter(g2 => !g2.dead);
      this.particles = this.particles.filter(p => !p.dead);
      this.lightnings = this.lightnings.filter(l => !l.dead);
      this.beams = this.beams.filter(b => !b.dead);
      this.rocks = this.rocks.filter(r => !r.dead);
      this.breakables = this.breakables.filter(r => !r.dead);
      this.arcs = this.arcs.filter(a => a.t < a.life);
      this.fxRings = this.fxRings.filter(ring => ring.t < ring.life);
      if (this.bosses.length === 0) {
        if (!this.el.bossHud.classList.contains('hidden')) this.resetBossBarFx();
        this.el.bossHud.classList.add('hidden');
      }

      // 能量满足门槛即触发选择（可连续触发，无冷却锁）
      this.tryLevelUp();

      // Toast 队列：同一时间只显示一条，结束后再显示下一条
      if (!this.activeToast && this.toastQueue.length) {
        this.activeToast = this.toastQueue.shift();
      }
      if (this.activeToast) {
        this.activeToast.t -= dt;
        if (this.activeToast.t <= 0) this.activeToast = null;
      }
      // activeToast 供渲染使用
      this.toasts = this.activeToast ? [this.activeToast] : [];

      // Boss 战黑红蒙版：Boss 正式入场后渐入（1.2s），结束后淡出（1.5s）
      {
        const target = this.bosses.length > 0 ? 1 : 0;
        if (target > 0) {
          this.bossMaskAlpha = Math.min(1, this.bossMaskAlpha + dt / 1.2);
        } else {
          this.bossMaskAlpha = Math.max(0, this.bossMaskAlpha - dt / 1.5);
        }
      }

      // 大招口头禅气泡倒计时
      if (this.ultBubble) {
        this.ultBubble.t -= dt;
        if (this.ultBubble.t <= 0) this.ultBubble = null;
      }

      this.updateHud(dt);
    }

    /* ---------------- 碰撞 ---------------- */
    collisions() {
      const p = this.player;
      // 我方子弹 vs 敌人/Boss
      for (const b of this.bullets) {
        if (!b.friendly || b.dead) continue;
        for (const e of this.targets()) {
          if (e.dead || e.dying) continue;
          if (e.isBoss && (e.state === 'enter' || e.state === 'trans' || e.state === 'phaseTrans' || e.state === 'summon' || e.state === 'transform')) continue;   // Boss 入场/转场/锁血期免伤（子弹穿透不吞弹）
          if (b.hitSet && b.hitSet.has(e)) continue;
          // 草龙：子弹逐节命中（仅露出地面的节）
          let hitSeg = -1;
          if (e.segments) hitSeg = e.hitTest(b.x, b.y, b.r);
          const rr = b.r + e.radius;
          const circleHit = !e.segments && (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr;
          if (hitSeg >= 0 || circleHit) {
            if (!b.hitSet) b.hitSet = new Set();
            b.hitSet.add(e);
            // 成就：侠客飞刀命中计数（同时标记已命中，避免同帧误判脱靶）
            if (b.kind === 'knife') b._achHit = true;
            if (window.Ach && b.kind === 'knife') Ach.evt('knifeHit', { g: this });
            const aliveBefore = !e.dead;
            // 超猫激光串：秒杀小怪（含龙类小段全灭）；Boss 不在此列，落到下方按比例承伤
            if (b.ultraKill && !e.isBoss) {
              if (e.segments) {
                if (e.isMini) {
                  for (let i = e.segments.length - 1; i >= 0; i--) {
                    if (!e.segments[i].dead) e.damageSegment(i, 99999, this, null, '');
                  }
                } else e.damageSegment(hitSeg, b.dmg, this, null, '');
              } else {
                e.spawnInvuln = 0;
                e.takeDamage(999999, this);
                if (window.Ach) {
                  Ach.evt('ultLaserHit', { g: this, target: e });
                  if (aliveBefore && e.dead) Ach.evt('bulletKill', { g: this, kind: b.kind, bounced: false, ult: true });
                }
              }
              burst(this, b.x, b.y, 16, ['#35e0ff', '#a5f3fc', '#fff'], 260, 5, 0.5);
              b.dead = true;
              break;
            }
            // 激光串对 Boss：每道按最大生命 4% 承伤
            if (b.bossDmgRatio > 0 && e.isBoss) {
              e.takeDamage(e.maxHp * b.bossDmgRatio, this);
              if (window.Ach) Ach.evt('ultLaserHit', { g: this, target: e });
              burst(this, b.x, b.y, 16, ['#35e0ff', '#fff'], 260, 5, 0.5);
              b.dead = true;
              break;
            }
            if (e.segments) {
              // 节命中：DoT / 冻结由 damageSegment 内部处理
              e.damageSegment(hitSeg, b.dmg, this, { x: 220, y: rand(-60, 60) }, b.element || '');
            } else {
              e.takeDamage(b.dmg, this, { x: 220, y: rand(-60, 60) });
              // 成就：子弹击杀归因（星星/烟头/反弹烟头）
              if (window.Ach && aliveBefore && e.dead) {
                Ach.evt('bulletKill', { g: this, kind: b.kind, bounced: !!b._achBounced, ult: false });
              }
              // 元素弹道命中：施加 DoT / 破无敌 / 冻结（系数吃元素精通等级，同元素可叠层）
              if (b.element === 'flame') {
                this.applyElement(e, 'flame', b.dmg, b.elemPow);
                if (e.spawnInvuln > 0) e.invulnBreakT = 1;   // 火焰：1s 后破无敌
              } else if (b.element === 'poison') {
                this.applyElement(e, 'poison', b.dmg, b.elemPow);
                if (e.spawnInvuln > 0) e.invulnBreakT = 3;   // 毒液：3s 后破无敌
              } else if (b.element === 'ice') {
                this.applyElement(e, 'ice', b.dmg, b.elemPow);
                if (e.spawnInvuln > 0) e.invulnBreakT = 0.5; // 寒冰也破无敌
              }
              // 法师魔法护盾期间击中敌人：困惑并下坠 2s
              if (p.magicShieldT > 0) { e.confuseT = 2; e.confuseVy = 0; }
              // 烟头/火把命中点燃：持续燃烧 DoT（不参与精通叠层，仅在无火异常时占位 1 层）
              if (b.burnOnHit) {
                e.dotT = Math.max(e.dotT || 0, 2.5);
                e.dotDps = Math.max(e.dotDps || 0, b.dmg * 0.45);
                e.dotType = 'flame';
                if (!e.dotStack) e.dotStack = 1;
              }
            }
            // 闪电子弹：命中后闪电链跳跃链接附近敌人
            if (p.chainJumps >= 1 && !e.dead && !e.dying) this.chainLightning(e, b.dmg);
            // 爆炸弹：命中即范围爆炸（不再吞弹 —— 随后正常消耗穿透/反弹次数，与穿透、反弹、贯穿激光协同）
            if (b.bombLv > 0) {
              const radius = 34 + b.bombLv * 12;
              this.aoe(b.x, b.y, radius, b.dmg * (0.55 + b.bombLv * 0.16));
            }
            if (b.noDieOnHit && b.bouncesLeft > 0 && b.pierce <= 0) {
              // 烟头/锯齿盾命中敌人：朝任意方向反弹（消耗反弹次数，不消失），反弹后速度/伤害减半
              b.bouncesLeft--;
              const rc = (hitSeg >= 0 && e.segments[hitSeg]) ? e.segments[hitSeg] : e;
              const dx = b.x - rc.x, dy = b.y - rc.y;
              const dl = Math.hypot(dx, dy) || 1;
              const dn = (b.vx * dx + b.vy * dy) / (dl * dl);
              b.vx -= 2 * dn * dx; b.vy -= 2 * dn * dy;
              b.vx += rand(-90, 90); b.vy += rand(-90, 90);
              const bspd = b.bounceSpd || 0.5;                  // 反弹减速（浪客烟头仅保留 0.4，更慢）
              b.vx *= bspd; b.vy *= bspd;
              b.dmg = Math.max(1, Math.round(b.dmg * 0.5));   // 反弹后伤害降低一半
              b.angle = Math.atan2(b.vy, b.vx);
              if (b.kind === 'butt') b._achBounced = true;     // 成就：反弹烟头标记
              // 浪客烟头反弹火花：更小更少（战狂锯齿盾保持原样）
              if (b.kind === 'butt') burst(this, b.x, b.y, 3, ['#ff9d2e', '#ffd23b'], 90, 2, 0.2);
              else burst(this, b.x, b.y, 5, ['#fff', '#ff9d2e'], 150, 3, 0.25);
              SFX.melee();
            } else {
              b.pierce--;
              if (b.pierce < 0) b.dead = true;
            }
            if (b.dead) break;
          }
        }
      }
      // 角色弹 vs 障碍山石：反弹（烟头/盾牌/最终激光）/ 分裂（星星）/ 击穿摧毁（大招激光）
      for (const b of this.bullets) {
        if (!b.friendly || b.dead) continue;
        if (!(b.rockReact || b.rockBreak)) continue;
        for (const r of this.rocks) {
          if (r.dead) continue;
          if (!r.contains(b.x, b.y, b.r + 2)) continue;
          if (b.rockBreak) {
            // 激光串：直接摧毁障碍并继续飞行
            r.destroy(this);
            break;
          }
          if (b.splitN) { b.dead = true; break; }   // 星星：撞石碎裂（触发分裂）
          if (b.bouncesLeft > 0) {
            b.bouncesLeft--;
            const cx = clamp(b.x, r.left, r.left + r.w);
            const cy = clamp(b.y, r.top, r.baseY);
            const nx = b.x - cx, ny = b.y - cy;
            const nl = Math.hypot(nx, ny) || 1;
            const dn = (b.vx * nx + b.vy * ny) / (nl * nl);
            b.vx -= 2 * dn * nx; b.vy -= 2 * dn * ny;       // 镜面反射
            b.x = cx + (nx / nl) * (b.r + 5); b.y = cy + (ny / nl) * (b.r + 5);
            b.vx += rand(-70, 70); b.vy += rand(-70, 70);   // 随机扰动（任意方向反弹）
            const bspd = b.bounceSpd || 0.5;                  // 反弹减速（浪客烟头仅保留 0.4，更慢）
            b.vx *= bspd; b.vy *= bspd;
            b.dmg = Math.max(1, Math.round(b.dmg * 0.5));   // 反弹后伤害降低一半
            b.angle = Math.atan2(b.vy, b.vx);
            if (b.kind === 'butt') b._achBounced = true;     // 成就：反弹烟头标记
            // 浪客烟头反弹火花：更小更少（战狂锯齿盾保持原样）
            if (b.kind === 'butt') burst(this, b.x, b.y, 3, ['#ff9d2e', '#caa06a'], 90, 2, 0.2);
            else burst(this, b.x, b.y, 5, ['#fff', '#caa06a'], 150, 3, 0.25);
            SFX.melee();
          } else b.dead = true;
          break;
        }
      }
      // 我方子弹 vs 破碎障碍物：累计命中次数，打满爆炸
      for (const b of this.bullets) {
        if (!b.friendly || b.dead) continue;
        for (const k of this.breakables) {
          if (k.dead) continue;
          if (!k.contains(b.x, b.y, b.r)) continue;
          if (b.rockBreak) { k.destroy(this, true); break; }   // 激光串一击摧毁
          k.struck(this, b);
          // 穿透 / 长条激光 / 边缘反弹弹不被吞（命中次数由 k.hitCd 限速）；普通子弹命中即消失
          const beam = b.pierce > 0 || b.len > 0 || b.boxW > 0 || b.edgeBounce;
          if (!beam) b.dead = true;
          break;
        }
      }
      // 星星死亡分裂（命中敌人/障碍/过期统一触发）
      for (const b of this.bullets) {
        if (b.splitN && b.dead && !b.splitDone) b.splitStars(this);
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
              this.shellBlast(eb.x, eb.y, eb.dmg, eb.src);
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
                else this.shellBlast(eb.x, eb.y, eb.dmg, eb.src);
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
        let hit = (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr;
        // 火焰斩：圆形之外追加沿飞行方向的旋转矩形大判定盒（半屏宽弧形斩）
        if (!hit && b.boxW > 0 && (b.vx || b.vy)) {
          const sp = Math.hypot(b.vx, b.vy);
          const ux = b.vx / sp, uy = b.vy / sp;
          const dx = p.x - b.x, dy = p.y - b.y;
          const lx = dx * ux + dy * uy - (b.boxOff || 0);   // 弹体局部：前后（盒中心前移 boxOff）
          const ly = -dx * uy + dy * ux;                    // 弹体局部：左右
          const pr = p.radius * 0.8;
          if (Math.abs(lx) < b.boxW / 2 + pr && Math.abs(ly) < b.boxH / 2 + pr) hit = true;
        }
        if (hit) {
          // 战狂血怒铠甲：命中的子弹转化为血色尖刺（长菱形），朝最近敌人反弹
          if (p.bloodArmorT > 0) {
            b.dead = true;
            const tgt = p.nearestEnemy(this);
            const a = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : rand(0, TAU);
            this.bullets.push(new Bullet(p.x, p.y, Math.cos(a) * 540, Math.sin(a) * 540,
              { kind: 'bloodSpike', friendly: true, dmg: Math.round(p.dmg * 1.6), r: 9, life: 1.3,
                color: '#ff2a0a',
                trailCols: ['#7a0a0a', '#ff2a0a', '#ff6a1a', '#ffd23b'], trailLite: false }));
            burst(this, b.x, b.y, 6, ['#ff2a0a', '#ff5a1a', '#fff'], 170, 4, 0.28);
            SFX.melee();
            continue;
          }
          if (b.kind === 'fireball') {
            b.dead = true;
            this.explodeFireball(b.x, b.y, 12, b.dmg * 0.75, 90, b.src);
          } else if (b.kind === 'shell') {
            b.dead = true;
            this.shellBlast(b.x, b.y, b.dmg, b.src);
          } else if (b.kind === 'lava') {
            // 火山口巨大火焰弹：命中玩家即引爆（环境伤害）
            b.dead = true;
            this.lavaBlast(b.x, b.y, b.dmg);
          } else if (b.kind === 'potbomb') {
            // 斧王酒壶：命中玩家即爆炸（触发 onExpire 走酒壶爆炸流程）
            b.dead = true;
            if (b.onExpire) b.onExpire(this, b);
          } else if (b.kind === 'missile' || b.hp > 0) {
            // 可击爆弹（导弹/漂浮战斧等 hp>0）撞到玩家：直接引爆
            b.dead = true;
            this.shellBlast(b.x, b.y, b.dmg, b.src);
          } else {
            b.dead = true;
            // 命中玩家回调（怪客十字弹吸血、大王斧击无敌等）：玩家无敌帧未实际命中则不触发
            if (p.hurt(b.dmg, this, b.src) !== false && b.onPlayerHit) b.onPlayerHit(this, b);
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
          if (e.dead || e.dying || linked.has(e)) continue;
          if (e.isBoss && (e.state === 'enter' || e.state === 'trans' || e.state === 'phaseTrans' || e.state === 'summon' || e.state === 'transform')) continue;   // 入场/转场/锁血期免伤不链接
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
    updateHud(dt) {
      const p = this.player;
      this.el.hpBar.style.width = clamp(p.hp / p.maxHp, 0, 1) * 100 + '%';
      this.el.hpText.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
      this.el.xpBar.style.width = clamp(this.xp / this.xpNeed, 0, 1) * 100 + '%';
      this.el.xpText.textContent = `${this.xp}/${this.xpNeed}`;
      // 怒气 / 大招
      const rageRatio = clamp(p.rage / CFG.ultimate.rageMax, 0, 1);
      this.el.rageBar.style.width = rageRatio * 100 + '%';
      this.el.rageText.textContent = rageRatio >= 1 ? '大招就绪！' : `${Math.floor(p.rage)}/100`;
      this.el.rageBox.classList.toggle('ready', rageRatio >= 1);
      this.el.roundText.textContent = `第 ${this.round} 轮`;
      this.el.levelText.textContent = `成长 ${this.totalLevels} 次`;
      this.el.scoreText.textContent = `击破 ${this.kills}`;
      // 生命条数
      if (this.el.livesText) {
        this.el.livesText.textContent = '❤'.repeat(this.player.lives) + '·'.repeat(3 - this.player.lives);
      }
      // 近战冷却（按角色显示对应默认技能图标）
      const cdTotal = CFG.player.meleeCooldown;
      const cdRatio = p.isMeleeing ? 0 : clamp(p.cdT / cdTotal, 0, 1);
      this.el.meleeCd.style.height = cdRatio * 100 + '%';
      this.el.meleeIcon.style.color = p.meleeReady ? '#ffd166' : '#8a7a55';
      this.el.meleeIcon.textContent = this.autoSkillIcon(p.charId);
      const meleeBox = document.getElementById('melee-box');
      if (meleeBox) meleeBox.title = `${this.autoSkillName(p.charId)}（接触敌人触发，3 秒冷却）`;
      // Boss 血条（像素斩击 + 灼烧 + 亮黄追伤演出）
      if (this.bosses.length) {
        const b = this.bosses[0];
        this.updateBossBar(clamp(b.hp / b.maxHp, 0, 1), dt);
      }
    }

    /* ---------------- Boss 血条演出（扣血斩击 / 灼烧火星 / 闪白 / 亮黄追伤） ---------------- */
    resetBossBarFx() {
      this.bossBar = {
        ctx: null, lastRatio: null, ghost: 1, ghostDelay: 0,
        pendingDmg: 0,  // 累积待演出伤害（ratio 单位）：高频小伤害合并后一次性斩击
        fxCd: 0,        // 演出最小间隔（秒）
        flash: null,    // 闪白段 { from, to, t, dur }
        slashes: [],    // 斩击 { x, y, ang, maxLen, t, dur, w }
        embers: []      // 锻打火花 { x, y, vx, vy, t, life, size, col, seed }
      };
      if (this.el) {
        if (this.el.bossBarGhost) this.el.bossBarGhost.style.width = '100%';
        if (this.el.bossBarFlash) this.el.bossBarFlash.style.opacity = '0';
        if (this.el.bossBarFx) {
          const c = this.el.bossBarFx.getContext('2d');
          if (c) c.clearRect(0, 0, this.el.bossBarFx.width, this.el.bossBarFx.height);
        }
      }
    }

    updateBossBar(ratio, dt) {
      if (!this.bossBar) this.resetBossBarFx();
      const fx = this.bossBar;
      const cv = this.el.bossBarFx;
      if (!fx.ctx && cv) fx.ctx = cv.getContext('2d');
      const ctx = fx.ctx;
      if (ctx && cv) {
        const w = cv.clientWidth, h = cv.clientHeight;   // 内容盒像素尺寸
        if (w > 0 && h > 0 && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      }
      // 特效画布与条体同尺寸：斩击/火星一律压缩在框体内
      const W = cv ? cv.width : 0, BAR_H = cv ? cv.height : 16;
      const BAR_TOP = 0;

      if (fx.lastRatio === null) { fx.lastRatio = ratio; fx.ghost = ratio; }
      // 扣血累积：高频弹幕小伤害合并演出，冷却结束或大伤害（≥4%）时一次性斩击
      if (ratio < fx.lastRatio - 0.0005) {
        fx.pendingDmg += fx.lastRatio - ratio;
      }
      fx.fxCd -= dt;
      if (fx.pendingDmg > 0.0005 && (fx.fxCd <= 0 || fx.pendingDmg >= 0.04)) {
        const fromRatio = ratio + fx.pendingDmg;   // 本次演出段起点
        fx.flash = { from: fromRatio, to: ratio, t: 0, dur: 0.34 };
        fx.ghostDelay = 0.12;   // 亮黄段只作短暂停顿，随即快速冷却追赶
        this.spawnBossBarSlash(ratio, W, BAR_TOP, BAR_H);
        this.spawnBossBarEmbers(ratio, fromRatio, W, BAR_TOP, BAR_H);
        fx.pendingDmg = 0;
        fx.fxCd = 0.14;
      }
      if (ratio > fx.ghost + 0.001) {
        // 回血 / 阶段回满（狮身人面像）：追伤条立即追上，不演出
        fx.ghost = ratio;
        fx.pendingDmg = 0;
        fx.flash = null;
        if (this.el.bossBarFlash) this.el.bossBarFlash.style.opacity = '0';
      }
      fx.lastRatio = ratio;
      this.el.bossBar.style.width = (ratio * 100) + '%';

      // 亮黄追伤条：极短停顿后急速冷却追赶；露头长度封顶一小格（9%），绝不长留
      if (fx.ghost > ratio) {
        if (fx.ghostDelay > 0) fx.ghostDelay -= dt;
        else fx.ghost = Math.max(ratio, fx.ghost - Math.max((fx.ghost - ratio) * dt * 16, dt * 0.9));
        if (fx.ghost > ratio + 0.09) fx.ghost = ratio + 0.09;
      }
      if (this.el.bossBarGhost) this.el.bossBarGhost.style.width = (fx.ghost * 100) + '%';

      // 闪白：前段保持满白，后段快速褪去（露出亮黄追伤边）
      const fl = this.el.bossBarFlash;
      if (fx.flash && fl) {
        fx.flash.t += dt;
        const p = fx.flash.t / fx.flash.dur;
        if (p >= 1) { fx.flash = null; fl.style.opacity = '0'; }
        else {
          fl.style.left = (fx.flash.to * 100) + '%';
          fl.style.width = ((fx.flash.from - fx.flash.to) * 100) + '%';
          fl.style.opacity = (p < 0.18 ? 1 : Math.max(0, 1 - (p - 0.18) / 0.82)).toFixed(3);
        }
      }

      // 粒子推进（直线飞溅、阻尼减速）+ 画布绘制；出框即灭，压缩在条体内
      for (const e of fx.embers) {
        e.t += dt;
        e.x += e.vx * dt; e.y += e.vy * dt;
        e.vx *= (1 - Math.min(1, dt * 3.2));
        e.vy *= (1 - Math.min(1, dt * 3.2));
      }
      fx.embers = fx.embers.filter(e =>
        e.t < e.life && e.x >= 0 && e.x <= W && e.y >= BAR_TOP && e.y <= BAR_TOP + BAR_H);
      for (const s of fx.slashes) s.t += dt;
      fx.slashes = fx.slashes.filter(s => s.t < s.dur);
      this.drawBossBarFx(fx, ctx, W, BAR_H);
    }

    /** 斩击：亮白主斜劈 + 反向小划，劈在扣除点 */
    spawnBossBarSlash(ratio, W, BAR_TOP, BAR_H) {
      const cx = Math.max(12, Math.min(W - 12, ratio * W));
      const cy = BAR_TOP + BAR_H / 2;
      this.bossBar.slashes.push(
        { x: cx, y: cy, ang: -Math.PI / 4.2, maxLen: BAR_H * 3 + 22, t: 0, dur: 0.22, w: 3 },
        { x: cx + 10, y: cy, ang: Math.PI / 4.2, maxLen: BAR_H * 1.6 + 8, t: 0.03, dur: 0.18, w: 2 }
      );
    }

    /** 锻打火花：少量白热粒子，在扣除段内向两侧直线飞溅（不出框） */
    spawnBossBarEmbers(ratio, oldRatio, W, BAR_TOP, BAR_H) {
      const x0 = ratio * W, span = Math.max(8, oldRatio * W - x0);
      const cols = ['#ffffff', '#fff3b0', '#ffe76a', '#ffd23e'];
      for (let i = 0; i < 4; i++) {
        this.bossBar.embers.push({
          x: x0 + Math.random() * span,
          y: BAR_TOP + 2 + Math.random() * (BAR_H - 4),
          vx: (Math.random() < 0.5 ? -1 : 1) * (22 + Math.random() * 42),
          vy: (Math.random() - 0.5) * 24,
          t: 0, life: 0.22 + Math.random() * 0.22,
          size: Math.random() < 0.3 ? 2 : 1,
          col: cols[(Math.random() * cols.length) | 0],
          seed: Math.random() * 6.28
        });
      }
      for (let i = 0; i < 2; i++) {
        this.bossBar.embers.push({
          x: x0 + (Math.random() - 0.5) * 6,
          y: BAR_TOP + 2 + Math.random() * (BAR_H - 4),
          vx: (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 20),
          vy: -6 - Math.random() * 12,
          t: 0, life: 0.2 + Math.random() * 0.18,
          size: 1, col: '#ffffff', seed: Math.random() * 6.28
        });
      }
    }

    drawBossBarFx(fx, ctx, W, H) {
      if (!ctx || W <= 0) return;
      ctx.clearRect(0, 0, W, H);
      // 灼烧火星（像素方块 + 亮芯 + 闪烁）
      for (const e of fx.embers) {
        const p = e.t / e.life;
        const a = Math.max(0, 1 - p) * (0.6 + 0.4 * Math.sin(e.t * 38 + e.seed));
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.fillStyle = e.col;
        ctx.fillRect(e.x | 0, e.y | 0, e.size, e.size);
        if (p < 0.5 && e.size >= 2) {
          ctx.globalAlpha = Math.max(0, a * 0.85);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect((e.x | 0) + (e.size >> 1) - 1, (e.y | 0), 1, 1);
        }
      }
      // 斩击：沿斜线铺亮白像素块（淡白光晕 + 纯白芯），快速劈出后淡出
      for (const s of fx.slashes) {
        const p = s.t / s.dur;
        const grow = Math.min(1, p * 3.6);
        const fade = p < 0.3 ? 1 : Math.max(0, 1 - (p - 0.3) / 0.7);
        const len = s.maxLen * grow;
        const dx = Math.cos(s.ang), dy = Math.sin(s.ang);
        const nx = -dy, ny = dx;
        const steps = Math.max(2, (len / 4) | 0);
        for (let i = 0; i <= steps; i++) {
          const d = -len / 2 + len * (i / steps);
          const bx = s.x + dx * d, by = s.y + dy * d;
          ctx.globalAlpha = fade * 0.35;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect((bx - nx * (s.w + 1)) | 0, (by - ny * (s.w + 1)) | 0, s.w + 3, s.w + 3);
          ctx.globalAlpha = fade;
          ctx.fillRect(bx | 0, by | 0, s.w, s.w);
        }
      }
      ctx.globalAlpha = 1;
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

      /* —— 雪地：冷蓝灰阴天，灰黑岩脊 + 蓝白雪山 + 斜向风雪 —— */
      this.bg.snow = {
        sky: sky([[0, '#6d8397'], [0.55, '#91a6b7'], [1, '#c2d0db']], x => {
          disk(x, 790, 84, 4, '#eef4fa', '#ffffff');
          // 低空冷雾
          const hz = x.createLinearGradient(0, 200, 0, 420);
          hz.addColorStop(0, 'rgba(220,232,242,0)'); hz.addColorStop(1, 'rgba(220,232,242,0.35)');
          x.fillStyle = hz; x.fillRect(0, 180, CFG.W, 260);
        }),
        far: strip(480, 200, (c, w, h) => {
          // 灰黑远岩脊
          bumps(c, w, h, [[0, 150], [46, 78], [96, 132], [150, 40], [210, 112], [268, 66], [330, 122], [392, 50], [448, 106], [480, 84]], '#5b646e');
          // 蓝白雪山前层
          bumps(c, w, h, [[0, 184], [40, 118], [96, 158], [146, 72], [200, 140], [256, 92], [316, 150], [372, 76], [426, 134], [480, 108]], '#d9e6f0');
          // 雪坡上的灰黑岩面
          c.fillStyle = '#8a98a8';
          [[146, 72], [256, 92], [372, 76]].forEach(([px, py]) => {
            c.beginPath(); c.moveTo(px + 4, py + 30); c.lineTo(px + 26, py + 70); c.lineTo(px + 8, py + 70); c.closePath(); c.fill();
          });
          // 雪亮峰顶
          c.fillStyle = '#ffffff';
          [[146, 72], [372, 76], [40, 118]].forEach(([px, py]) => {
            c.beginPath(); c.moveTo(px - 18, py + 26); c.lineTo(px, py); c.lineTo(px + 18, py + 26); c.closePath(); c.fill();
          });
          // 斜向风雪走向（右上→左下细线）
          c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 2;
          for (let i = 0; i < 34; i++) {
            const sx = rand(0, w), sy = rand(0, 160);
            c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - 12, sy + 12); c.stroke();
          }
        }),
        mid: strip(480, 120, (c, w, h) => {
          // 参差冰崖（深蓝阴影 + 雪顶）
          bumps(c, w, h, [[0, 104], [60, 52], [130, 92], [200, 44], [270, 86], [340, 50], [410, 90], [480, 64]], '#8fb2c8');
          c.fillStyle = '#6f96b2';
          [[60, 52], [200, 44], [340, 50]].forEach(([px, py]) => {
            c.beginPath(); c.moveTo(px, py + 18); c.lineTo(px + 22, 96); c.lineTo(px + 2, 96); c.closePath(); c.fill();
          });
          c.fillStyle = '#f4f9fd';
          bumps(c, w, h, [[0, 100], [60, 48], [130, 88], [200, 40], [270, 82], [340, 46], [410, 86], [480, 60]], '#f4f9fd');
          // 冰裂缝
          c.strokeStyle = '#5a7ea0'; c.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            const cx = i * 60 + 20;
            c.beginPath(); c.moveTo(cx, 60); c.lineTo(cx + 6, 100); c.stroke();
          }
        }),
        groundTop: strip(480, 86, (c, w, h) => {
          // 起伏雪丘（底色与 ground 顶带同色）
          bumps(c, w, h, [[0, 60], [70, 46], [150, 56], [230, 38], [310, 52], [390, 42], [480, 54]], '#eaf2f9');
          c.fillStyle = '#ffffff';
          bumps(c, w, h, [[0, 58], [70, 44], [150, 54], [230, 36], [310, 50], [390, 40], [480, 52]], '#ffffff');
          // 蓝灰雪坡阴影折面
          c.fillStyle = '#c2d8e8';
          [[150, 56], [310, 52]].forEach(([px, py]) => {
            c.beginPath(); c.moveTo(px - 20, py); c.lineTo(px, py - 10); c.lineTo(px + 20, py); c.closePath(); c.fill();
          });
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#d4e2ee'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#eaf2f9'; c.fillRect(0, 0, w, 18);
          c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, 6);
          c.fillStyle = '#b9d0e2';
          for (let i = 0; i < 30; i++) c.fillRect(rand(0, w), rand(20, 80), 24, 5);
          c.fillStyle = '#9fbcd2';
          for (let i = 0; i < 12; i++) c.fillRect(rand(0, w), rand(30, 84), 14, 3);
        }),
        cloud: cloud('#f4f8ff', '#d4e2ef')
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

      /* —— 罗马角斗场：三层拱券石墙 + 满座欢呼观众，沙场满布斩击/炮击痕迹 —— */
      this.bg.colosseum = {
        sky: sky([[0, '#6fb4e0'], [0.55, '#a8d4ec'], [1, '#f3e0b8']], x => {
          disk(x, 800, 84, 5, '#fff0b8', '#fff9e0');
        }),
        far: strip(480, 200, (c, w, h) => {
          const stone = '#c9a06a', stoneDark = '#a8845a', archCol = '#7a5a38';
          const crowdCols = ['#c9463a', '#e8d8b8', '#8a5a34', '#4a6a9a', '#d8c9a3', '#7a3a2a', '#e8a03a', '#f0e6d2'];
          // 远景外壁：三层拱券
          for (let tier = 0; tier < 3; tier++) {
            const ty = 36 + tier * 54;
            // 石墙
            c.fillStyle = stone;
            c.fillRect(0, ty, w, 48);
            c.fillStyle = stoneDark;
            c.fillRect(0, ty, w, 4);
            c.fillRect(0, ty + 44, w, 4);
            // 拱门洞（下层 34px 拱券）
            for (let ax = 6; ax < w; ax += 40) {
              c.fillStyle = archCol;
              c.fillRect(ax + 7, ty + 22, 22, 22);
              c.beginPath();
              c.arc(ax + 18, ty + 22, 11, Math.PI, 0);
              c.fill();
              // 拱柱
              c.fillStyle = stone;
              c.fillRect(ax + 2, ty + 22, 6, 22);
              c.fillRect(ax + 28, ty + 22, 6, 22);
              c.fillStyle = stoneDark;
              c.fillRect(ax + 2, ty + 22, 2, 22);
            }
            // 拱券上方观众席：密密麻麻欢呼人潮（小人头 + 高举手臂）
            for (let i = 0; i < 95; i++) {
              const px = rand(0, w), py = ty + rand(6, 16);
              c.fillStyle = crowdCols[randi(0, crowdCols.length - 1)];
              c.fillRect(px, py, 3, 4);
              if (Math.random() < 0.28) c.fillRect(px + (Math.random() < 0.5 ? -2 : 3), py - 3, 2, 3);
            }
          }
          // 顶部旗杆战旗
          for (let bx = 24; bx < w; bx += 96) {
            c.fillStyle = '#5a3a2a'; c.fillRect(bx, 18, 2, 18);
            c.fillStyle = '#c93a2a'; c.fillRect(bx + 2, 18, 16, 10);
            c.fillStyle = '#e8c04a'; c.fillRect(bx + 8, 20, 5, 3);
          }
        }),
        mid: strip(480, 120, (c, w, h) => {
          const stone = '#b8905c', stoneDark = '#96704a', gate = '#543a24';
          const crowdCols = ['#c9463a', '#e8d8b8', '#8a5a34', '#4a6a9a', '#d8c9a3', '#7a3a2a', '#e8a03a'];
          // 近景竞技场围墙
          c.fillStyle = stoneDark;
          c.fillRect(0, 30, w, h - 30);
          c.fillStyle = stone;
          c.fillRect(0, 34, w, h - 34);
          c.fillStyle = stoneDark;
          c.fillRect(0, 34, w, 4);
          // 墙顶观众（更近更大：人头 + 身躯 + 高举手臂）
          for (let i = 0; i < 130; i++) {
            const px = rand(0, w);
            c.fillStyle = crowdCols[randi(0, crowdCols.length - 1)];
            c.fillRect(px, 40 + rand(0, 8), 4, 6);
            if (Math.random() < 0.32) {
              c.fillRect(px + (Math.random() < 0.5 ? -2 : 4), 37, 2, 5);
              c.fillRect(px + (Math.random() < 0.5 ? 0 : 2), 40 + rand(0, 8), 4, 6);
            }
          }
          // 大型出战拱门 + 铁栅
          for (let ax = -16; ax < w; ax += 112) {
            c.fillStyle = gate;
            c.fillRect(ax + 20, 64, 52, h - 64);
            c.beginPath();
            c.arc(ax + 46, 64, 26, Math.PI, 0);
            c.fill();
            c.fillStyle = '#2e2620';
            for (let gx = ax + 26; gx < ax + 66; gx += 9) c.fillRect(gx, 68, 4, h - 68);
            c.fillStyle = stone;
            c.fillRect(ax + 14, 64, 8, h - 64);
            c.fillRect(ax + 70, 64, 8, h - 64);
          }
          // 红金战旗
          for (let bx = 40; bx < w; bx += 130) {
            c.fillStyle = '#5a3a2a'; c.fillRect(bx, 42, 3, 30);
            c.fillStyle = '#c93a2a'; c.fillRect(bx + 3, 42, 24, 17);
            c.fillStyle = '#e8c04a'; c.fillRect(bx + 12, 47, 7, 5);
          }
        }),
        ground: strip(480, 100, (c, w, h) => {
          // 沙场底色
          c.fillStyle = '#b08a52'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#c9a468'; c.fillRect(0, 0, w, 12);
          c.fillStyle = '#96703e';
          for (let i = 0; i < 90; i++) c.fillRect(rand(0, w), rand(14, h - 6), 6, 3);
          // 斩击痕迹：细长暗刃痕 + 斜向高光刃边
          for (let i = 0; i < 18; i++) {
            const sx = rand(0, w), sy = rand(18, h - 10);
            const ang = rand(-0.7, 0.7) + (Math.random() < 0.5 ? 0 : Math.PI);
            const len = rand(18, 36);
            c.save();
            c.translate(sx, sy); c.rotate(ang);
            c.fillStyle = '#5a3d22'; c.fillRect(-len / 2, -1.5, len, 3);
            c.fillStyle = '#7a5a36'; c.fillRect(-len / 2, -3, len * 0.55, 1.5);
            c.restore();
          }
          // 炮击焦痕：深色焦圆 + 放射裂纹 + 残火余烬
          for (let i = 0; i < 8; i++) {
            const sx = rand(24, w - 24), sy = rand(26, h - 10), r = rand(9, 17);
            c.fillStyle = '#3a2818';
            c.beginPath(); c.ellipse(sx, sy, r, r * 0.6, 0, 0, TAU); c.fill();
            c.fillStyle = '#241710';
            c.beginPath(); c.ellipse(sx, sy, r * 0.55, r * 0.32, 0, 0, TAU); c.fill();
            c.fillStyle = '#5a3a22';
            for (let k = 0; k < 5; k++) {
              const a = (TAU / 5) * k + rand(-0.25, 0.25);
              c.fillRect(sx + Math.cos(a) * r * 0.8, sy + Math.sin(a) * r * 0.5, 7, 2);
            }
            if (Math.random() < 0.65) { c.fillStyle = '#ff7b2e'; c.fillRect(sx - 2, sy - 2, 3, 3); }
          }
        }),
        cloud: cloud('#ffe8c8', '#e8d0a8')
      };

      // 密闭空间图（丛林/海底/仙人洞/魔窟）不使用云：cloud 槽位改为主题飘移元素（透明背景小 sprite）
      const leafMotif = strip(34, 34, (c) => {
        const cols = ['#5cb868', '#9bc84b', '#c89a3a'];
        [[8, 9, -0.5], [23, 15, 0.5], [14, 25, 1.0]].forEach(([lx, ly, rot], i) => {
          c.save(); c.translate(lx, ly); c.rotate(rot);
          c.fillStyle = cols[i];
          c.beginPath(); c.ellipse(0, 0, 7, 3.4, 0, 0, TAU); c.fill();
          c.strokeStyle = 'rgba(20,50,20,0.5)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.stroke();
          c.restore();
        });
      });
      const bubbleMotif = strip(30, 30, (c) => {
        c.strokeStyle = 'rgba(210,242,255,0.85)'; c.lineWidth = 2;
        c.beginPath(); c.arc(15, 15, 9, 0, TAU); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.28)';
        c.beginPath(); c.arc(15, 15, 7, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.75)';
        c.fillRect(10, 8, 4, 4);
      });
      const mistMotif = strip(52, 26, (c) => {
        c.fillStyle = 'rgba(214,228,236,0.20)';
        [[16, 16, 14, 7], [30, 11, 17, 9], [42, 17, 11, 6]].forEach(([mx, my, rx, ry]) => {
          c.beginPath(); c.ellipse(mx, my, rx, ry, 0, 0, TAU); c.fill();
        });
        c.fillStyle = 'rgba(238,246,250,0.16)';
        c.beginPath(); c.ellipse(28, 13, 8, 4, 0, 0, TAU); c.fill();
      });
      const emberMotif = strip(24, 24, (c) => {
        [[7, 8, '#ff8a3c'], [16, 14, '#7a4cd8'], [10, 19, '#ffb05e']].forEach(([ex, ey, col]) => {
          c.fillStyle = col + '33'; c.fillRect(ex - 5, ey - 5, 10, 10);
          c.fillStyle = col + '88'; c.fillRect(ex - 3, ey - 3, 6, 6);
          c.fillStyle = col; c.fillRect(ex - 1, ey - 1, 3, 3);
        });
      });

      /* —— 丛林：深绿墨绿潮湿密林；层叠树冠、扭曲树干、光柱、雾 —— */
      this.bg.jungle = {
        sky: sky([[0, '#10281a'], [0.5, '#1e4528'], [1, '#336033']], x => {
          // 树冠压顶：顶部两片暗冠
          x.fillStyle = 'rgba(8,24,12,0.85)';
          x.beginPath(); x.ellipse(120, -30, 200, 90, 0, 0, TAU); x.fill();
          x.beginPath(); x.ellipse(830, -50, 240, 100, 0, 0, TAU); x.fill();
          // 少量漏下的光柱
          x.fillStyle = 'rgba(220,255,180,0.10)';
          for (let i = 0; i < 5; i++) {
            const rx = 120 + i * 190;
            x.beginPath(); x.moveTo(rx, 0); x.lineTo(rx + 40, 0); x.lineTo(rx + 120, 320); x.lineTo(rx + 60, 320); x.closePath(); x.fill();
          }
          // 萤火 / 孢子光点
          x.fillStyle = 'rgba(190,230,120,0.5)';
          for (let i = 0; i < 26; i++) x.fillRect(rand(0, CFG.W), rand(40, 360), 2, 2);
        }),
        far: strip(480, 200, (c, w, h) => {
          // 后层密林冠：大小高低错落地铺满
          c.fillStyle = '#122c18';
          for (let i = 0; i < 16; i++) {
            c.beginPath();
            c.ellipse(i * 34 + rand(-10, 10), rand(70, 150), rand(30, 52), rand(26, 44), 0, 0, TAU); c.fill();
          }
          // 前层冠（更亮更大，形成层次遮挡）
          c.fillStyle = '#1a3e20';
          for (let i = 0; i < 12; i++) {
            c.beginPath();
            c.ellipse(i * 46 + 10, rand(110, 168), rand(34, 58), rand(28, 42), 0, 0, TAU); c.fill();
          }
          // 垂落藤蔓剪影
          c.strokeStyle = '#0d2413'; c.lineWidth = 3;
          for (let i = 0; i < 10; i++) {
            const vx = i * 52 + rand(-12, 12);
            c.beginPath(); c.moveTo(vx, 0);
            c.bezierCurveTo(vx + rand(-14, 14), 40, vx + rand(-14, 14), 80, vx + rand(-8, 8), rand(90, 140));
            c.stroke();
          }
          // 低处雾气
          c.fillStyle = 'rgba(150,190,160,0.10)';
          c.fillRect(0, 138, w, 42);
        }),
        mid: strip(480, 120, (c, w, h) => {
          // 扭曲树干（分段错位）+ 分叉 + 错落叶冠
          for (let i = 0; i < 6; i++) {
            const tx = i * 84 + rand(20, 50);
            c.fillStyle = '#3a2a18';
            let ty = 118;
            for (let s = 0; s < 4; s++) {
              c.fillRect(tx + ((s % 2) ? 4 : -3), ty - 20, 11, 22); ty -= 19;
            }
            c.fillRect(tx - 12, 44, 12, 5); c.fillRect(tx + 10, 52, 14, 5);
            c.fillStyle = ['#2c6434', '#25602d', '#357a3c'][i % 3];
            c.beginPath(); c.ellipse(tx, 34, 30, 22, 0, 0, TAU); c.fill();
            c.fillStyle = '#468a42';
            c.beginPath(); c.ellipse(tx - 12, 28, 14, 10, 0, 0, TAU); c.fill();
          }
          // 大叶蕨丛
          c.fillStyle = '#3f7a38';
          for (let i = 0; i < 16; i++) c.fillRect(rand(0, w), rand(86, 114), rand(10, 22), 5);
          // 彩色巨菇
          for (let i = 0; i < 3; i++) {
            const mx = rand(40, w - 40);
            c.fillStyle = '#8a5a3a'; c.fillRect(mx - 3, 92, 6, 16);
            c.fillStyle = ['#c85a8a', '#d8a040', '#7a5ac8'][i];
            c.fillRect(mx - 12, 82, 24, 11);
          }
        }),
        groundTop: strip(480, 86, (c, w, h) => {
          // 大块起伏土丘（底色与 ground 顶带同色，无缝）
          bumps(c, w, h, [[0, 58], [40, 44], [110, 52], [180, 30], [260, 48], [340, 36], [410, 50], [480, 42]], '#3f5e2c');
          // 苔藓亮边
          bumps(c, w, h, [[0, 56], [40, 42], [110, 50], [180, 28], [260, 46], [340, 34], [410, 48], [480, 40]], '#54874a');
          // 一段弯弯曲曲横卧的巨木
          c.fillStyle = '#5a4128';
          for (let i = 0; i < 30; i++) {
            const lx = 50 + i * 12;
            c.fillRect(lx, 50 + Math.round(Math.sin(i * 0.35) * 5), 13, 15);
          }
          // 巨木端面年轮 + 插入土丘的根
          c.fillStyle = '#4a3420';
          c.beginPath(); c.ellipse(52, 57, 8, 9, 0, 0, TAU); c.fill();
          c.strokeStyle = '#6e5234'; c.lineWidth = 2;
          c.beginPath(); c.ellipse(52, 57, 4, 5, 0, 0, TAU); c.stroke();
          c.fillStyle = '#3a2a18';
          c.fillRect(398, 44, 16, 8); c.fillRect(406, 38, 10, 8);
          // 巨木顶部苔衣
          c.fillStyle = '#4a7a38';
          for (let i = 0; i < 30; i++) {
            c.fillRect(52 + i * 12, 46 + Math.round(Math.sin(i * 0.35) * 5), 11, 4);
          }
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#2c3a1e'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#3f5e2c'; c.fillRect(0, 0, w, 18);
          c.fillStyle = '#54874a';
          for (let i = 0; i < 70; i++) c.fillRect(rand(0, w), rand(0, 12), 5, 3);
          c.fillStyle = '#22301a';
          for (let i = 0; i < 60; i++) c.fillRect(rand(0, w), rand(22, h - 6), 7, 4);
          c.fillStyle = '#3a2a18';
          for (let i = 0; i < 12; i++) c.fillRect(rand(0, w), rand(26, 60), 4, 10);
        }),
        cloud: leafMotif
      };

      /* —— 海底：深海渐变、水面粼光、光柱、沉船、海带林、沙底透视 —— */
      this.bg.seabed = {
        sky: sky([[0, '#031228'], [0.5, '#0a3864'], [1, '#13598a']], x => {
          // 水面粼光顶带
          const sg = x.createLinearGradient(0, 0, 0, 70);
          sg.addColorStop(0, 'rgba(170,225,255,0.35)'); sg.addColorStop(1, 'rgba(170,225,255,0)');
          x.fillStyle = sg; x.fillRect(0, 0, CFG.W, 70);
          // 顶部波纹亮线
          x.strokeStyle = 'rgba(220,245,255,0.5)'; x.lineWidth = 2;
          for (let r = 0; r < 3; r++) {
            x.beginPath();
            for (let xx = 0; xx <= CFG.W; xx += 20) {
              const yy = 10 + r * 14 + Math.sin(xx * 0.05 + r) * 3;
              if (xx === 0) x.moveTo(xx, yy); else x.lineTo(xx, yy);
            }
            x.stroke();
          }
          // 斜射光柱
          x.fillStyle = 'rgba(180,240,255,0.08)';
          for (let i = 0; i < 6; i++) {
            const rx = 40 + i * 160;
            x.beginPath(); x.moveTo(rx, 0); x.lineTo(rx + 26, 0); x.lineTo(rx + 130, 360); x.lineTo(rx + 70, 360); x.closePath(); x.fill();
          }
          // 远处鱼群剪影
          x.fillStyle = 'rgba(6,30,54,0.7)';
          for (let i = 0; i < 7; i++) {
            const fx = 120 + i * 110 + (i % 2) * 30, fy = 120 + (i % 3) * 60;
            x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + 14, fy - 5); x.lineTo(fx + 14, fy + 5); x.closePath(); x.fill();
          }
          // 悬浮浮游颗粒
          x.fillStyle = 'rgba(200,240,255,0.4)';
          for (let i = 0; i < 60; i++) x.fillRect(rand(0, CFG.W), rand(30, 420), 2, 2);
        }),
        far: strip(480, 200, (c, w, h) => {
          // 深海礁脊（最远最暗）
          bumps(c, w, h, [[0, 168], [60, 120], [130, 150], [200, 96], [270, 140], [350, 108], [420, 146], [480, 126]], '#0e3450');
          // 巨型海带林剪影
          c.strokeStyle = '#0a2c42'; c.lineWidth = 7;
          for (let i = 0; i < 9; i++) {
            const kx = i * 56 + 14;
            c.beginPath(); c.moveTo(kx, 170);
            c.bezierCurveTo(kx + 12, 130, kx - 12, 90, kx + 8, rand(30, 70));
            c.stroke();
          }
          // 沉船剪影（船身 + 断桅 + 帆）
          c.fillStyle = '#08243c';
          c.beginPath();
          c.moveTo(250, 150); c.lineTo(258, 118); c.lineTo(350, 112); c.lineTo(366, 132);
          c.lineTo(360, 150); c.closePath(); c.fill();
          c.fillRect(300, 70, 5, 48);
          c.beginPath(); c.moveTo(305, 74); c.lineTo(338, 92); c.lineTo(305, 96); c.closePath(); c.fill();
        }),
        mid: strip(480, 120, (c, w, h) => {
          // 近层礁岩
          bumps(c, w, h, [[0, 96], [70, 58], [150, 88], [230, 50], [310, 82], [390, 56], [480, 78]], '#17546e');
          // 珊瑚枝
          const corals = [[60, 96, '#d8705a'], [120, 88, '#e8a06a'], [300, 82, '#c85a6a'], [360, 86, '#e8a06a'], [430, 78, '#d8705a']];
          corals.forEach(([cx, cy0, col]) => {
            c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round';
            [[0, 0], [-8, -14], [9, -18], [-4, -28]].forEach(([dx, dy]) => {
              c.beginPath(); c.moveTo(cx, cy0); c.lineTo(cx + dx, cy0 + dy); c.stroke();
            });
          });
          // 海带
          c.strokeStyle = '#1f6e62'; c.lineWidth = 5;
          for (let i = 0; i < 6; i++) {
            const kx = i * 82 + 30;
            c.beginPath(); c.moveTo(kx, 106);
            c.bezierCurveTo(kx + 10, 86, kx - 8, 66, kx + 6, 46);
            c.stroke();
          }
          // 近景鱼群
          c.fillStyle = '#0a2c44';
          for (let i = 0; i < 9; i++) {
            const fx = 20 + i * 26 + (i % 2) * 8, fy = 30 + (i % 3) * 14;
            c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + 10, fy - 4); c.lineTo(fx + 10, fy + 4); c.closePath(); c.fill();
          }
        }),
        groundTop: strip(480, 86, (c, w, h) => {
          // 起伏沙丘（底色与 ground 顶带同色）
          bumps(c, w, h, [[0, 62], [60, 48], [140, 58], [220, 40], [300, 54], [380, 44], [480, 56]], '#c8aa74');
          c.fillStyle = '#d8bc86';
          bumps(c, w, h, [[0, 60], [60, 46], [140, 56], [220, 38], [300, 52], [380, 42], [480, 54]], '#d8bc86');
          // 礁石 + 海星
          c.fillStyle = '#2a4a5a';
          [[90, 60], [262, 56], [408, 58]].forEach(([rx, ry]) => {
            c.beginPath(); c.moveTo(rx - 12, ry); c.lineTo(rx - 6, ry - 16); c.lineTo(rx + 4, ry - 12); c.lineTo(rx + 12, ry); c.closePath(); c.fill();
          });
          c.fillStyle = '#e07a5a';
          for (let i = 0; i < 5; i++) c.fillRect(rand(20, w - 20), rand(50, 72), 4, 4);
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#a88c5a'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#c8aa74'; c.fillRect(0, 0, w, 18);
          c.fillStyle = '#d8bc86'; c.fillRect(0, 0, w, 6);
          // 沙纹透视
          c.strokeStyle = 'rgba(120,96,56,0.5)'; c.lineWidth = 2;
          for (let y = 24; y < h; y += 16) {
            c.beginPath();
            for (let xx = 0; xx <= w; xx += 16) {
              const yy = y + Math.sin(xx * 0.05 + y) * 3;
              if (xx === 0) c.moveTo(xx, yy); else c.lineTo(xx, yy);
            }
            c.stroke();
          }
          // 砾石 / 贝壳
          c.fillStyle = '#5a4a38';
          for (let i = 0; i < 36; i++) c.fillRect(rand(0, w), rand(24, h - 8), 5, 4);
          c.fillStyle = '#e8d8b8';
          for (let i = 0; i < 10; i++) c.fillRect(rand(0, w), rand(28, 70), 6, 4);
        }),
        cloud: bubbleMotif
      };

      /* —— 城堡：夕阳中世纪城池，密集塔楼尖顶、连续城墙、城门双塔 —— */
      this.bg.castle = {
        sky: sky([[0, '#4a1e4a'], [0.5, '#b0483c'], [0.78, '#ef9a4e'], [1, '#ffd98a']], x => {
          disk(x, 700, 150, 7, '#ffd98a', '#fff0c8');   // 低垂夕阳
          // 归鸟
          x.strokeStyle = 'rgba(60,26,40,0.7)'; x.lineWidth = 2;
          for (let i = 0; i < 5; i++) {
            const bx = 120 + i * 44, by = 90 + (i % 2) * 14;
            x.beginPath();
            x.moveTo(bx - 6, by); x.quadraticCurveTo(bx, by - 5, bx + 1, by);
            x.quadraticCurveTo(bx + 6, by - 5, bx + 12, by); x.stroke();
          }
        }),
        far: strip(480, 200, (c, w, h) => {
          // 远山
          bumps(c, w, h, [[0, 150], [80, 110], [170, 140], [260, 100], [350, 134], [480, 112]], '#7a4a5a');
          // 远城：连续城墙 + 墙垛
          c.fillStyle = '#8a5a50';
          c.fillRect(0, 128, w, 46);
          for (let x = 8; x < w; x += 26) c.fillRect(x, 120, 12, 10);
          // 形态各异的塔楼（0 锥顶 / 1 城垛平顶旗杆 / 2 高耸尖顶）
          const farTow = (tx, bw, bh, roof) => {
            const by = 132;
            c.fillStyle = '#94624c'; c.fillRect(tx - bw / 2, by - bh, bw, bh);
            c.fillStyle = '#7a3e44';
            if (roof === 0) {
              c.beginPath(); c.moveTo(tx - bw / 2 - 3, by - bh); c.lineTo(tx, by - bh - 26); c.lineTo(tx + bw / 2 + 3, by - bh); c.closePath(); c.fill();
            } else if (roof === 1) {
              c.fillRect(tx - bw / 2, by - bh - 12, bw, 12);
              c.fillStyle = '#5a2e38'; c.fillRect(tx - 2, by - bh - 22, 4, 12);
            } else {
              c.beginPath(); c.moveTo(tx - bw / 2, by - bh); c.lineTo(tx, by - bh - 38); c.lineTo(tx + bw / 2, by - bh); c.closePath(); c.fill();
            }
          };
          farTow(40, 30, 84, 0); farTow(110, 24, 56, 1); farTow(180, 34, 108, 2);
          farTow(250, 26, 64, 0); farTow(318, 32, 96, 0); farTow(388, 24, 50, 1); farTow(452, 30, 80, 2);
          // 万家灯火
          c.fillStyle = '#ffd98a';
          for (let i = 0; i < 26; i++) c.fillRect(rand(10, w - 10), rand(70, 126), 3, 4);
        }),
        mid: strip(480, 120, (c, w, h) => {
          // 主城墙
          c.fillStyle = '#c99a5e';
          c.fillRect(0, 60, w, 60);
          c.fillStyle = '#b08450';
          c.fillRect(0, 104, w, 16);
          for (let x = 4; x < w; x += 28) c.fillRect(x, 52, 16, 10);
          // 石块缝线
          c.strokeStyle = 'rgba(120,84,46,0.6)'; c.lineWidth = 2;
          for (let y = 74; y < 104; y += 16) {
            for (let xx = ((y / 16) % 2) * 18; xx < w; xx += 36) {
              c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + 16); c.stroke();
            }
          }
          // 城门楼双塔：尖锥顶 + 旗帜 + 箭窗
          [150, 330].forEach(tx => {
            c.fillStyle = '#d8ac70'; c.fillRect(tx - 22, 30, 44, 90);
            c.fillStyle = '#a87f4e'; c.fillRect(tx - 22, 104, 44, 16);
            c.fillStyle = '#8a3e32';
            c.beginPath(); c.moveTo(tx - 26, 30); c.lineTo(tx, 2); c.lineTo(tx + 26, 30); c.closePath(); c.fill();
            c.fillStyle = '#5a2a24'; c.fillRect(tx - 1, 2, 2, 16);
            c.fillStyle = '#e8c084';
            c.beginPath(); c.moveTo(tx + 1, 4); c.lineTo(tx + 16, 8); c.lineTo(tx + 1, 13); c.closePath(); c.fill();
            c.fillStyle = '#6a4028';
            for (let yy = 44; yy < 96; yy += 22) c.fillRect(tx - 7, yy, 6, 9);
          });
          // 中央拱门
          c.fillStyle = '#4a2e22';
          c.beginPath(); c.moveTo(218, 120); c.lineTo(218, 78); c.arc(240, 78, 22, Math.PI, 0); c.lineTo(262, 120); c.closePath(); c.fill();
          // 城墙暖窗
          c.fillStyle = '#ffe0a0';
          for (let i = 0; i < 12; i++) c.fillRect(rand(8, w - 8), rand(70, 96), 4, 6);
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#a8825a'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#d8b078'; c.fillRect(0, 0, w, 12);
          // 块石路面
          c.strokeStyle = '#8a6a45'; c.lineWidth = 2;
          for (let y = 16; y < h; y += 22) {
            for (let xx = ((y / 22) % 2) * 24; xx < w; xx += 48) c.strokeRect(xx, y, 46, 20);
          }
          c.fillStyle = '#c89a5e';
          for (let i = 0; i < 22; i++) c.fillRect(rand(0, w), rand(20, 80), 4, 3);
        }),
        cloud: cloud('#ffd8a8', '#e8a878')
      };

      /* —— 天空：阴沉雷云天幕，滚滚云层暗藏闪电；地面为动态起伏云海（renderCloudSea）—— */
      this.bg.sky = {
        sky: sky([[0, '#121828'], [0.5, '#28304a'], [1, '#4a5478']], x => {
          // 云后冷光：暗藏闪电的云团辉光
          const glow = x.createRadialGradient(520, 90, 10, 520, 90, 210);
          glow.addColorStop(0, 'rgba(220,228,255,0.22)'); glow.addColorStop(1, 'rgba(220,228,255,0)');
          x.fillStyle = glow; x.fillRect(0, 0, CFG.W, 320);
          // 两道隐雷（一明一暗藏在云后）
          const bolt = (bx, seg, alpha) => {
            x.strokeStyle = 'rgba(214,222,255,' + alpha + ')'; x.lineWidth = 2;
            x.beginPath(); let lx = bx, ly = 0; x.moveTo(lx, ly);
            for (let i = 0; i < seg; i++) { lx += (i % 2 ? 12 : -9); ly += 30; x.lineTo(lx, ly); }
            x.stroke();
          };
          bolt(520, 7, 0.30); bolt(300, 5, 0.16);
        }),
        far: strip(480, 200, (c, w, h) => {
          // 后层雷云团（暗）
          c.fillStyle = '#222a42';
          for (let i = 0; i < 14; i++) {
            c.beginPath();
            c.ellipse(i * 40 + rand(-8, 8), rand(60, 150), rand(34, 60), rand(18, 30), 0, 0, TAU); c.fill();
          }
          // 前层雷云（更大更暗，压向底部）
          c.fillStyle = '#333c5a';
          for (let i = 0; i < 10; i++) {
            c.beginPath();
            c.ellipse(i * 54 + 20, rand(104, 168), rand(42, 70), rand(22, 34), 0, 0, TAU); c.fill();
          }
          // 云腹冷亮边
          c.fillStyle = 'rgba(150,160,200,0.30)';
          for (let i = 0; i < 8; i++) c.fillRect(i * 60 + rand(0, 20), rand(120, 160), rand(20, 40), 3);
        }),
        mid: strip(480, 120, (c, w, h) => {
          // 近层滚云架
          c.fillStyle = '#48506c';
          for (let i = 0; i < 8; i++) {
            c.beginPath(); c.ellipse(i * 66 + 20, rand(76, 106), rand(38, 58), 20, 0, 0, TAU); c.fill();
          }
          // 浮岛遗址 + 断柱
          [[70, 78, 84], [380, 70, 64]].forEach(([px, py, pw]) => {
            c.fillStyle = '#3a4056';
            c.beginPath(); c.ellipse(px, py, pw / 2, 15, 0, 0, TAU); c.fill();
            c.beginPath();
            c.moveTo(px - pw / 2, py); c.lineTo(px + pw / 2, py);
            c.lineTo(px + pw * 0.18, py + 40); c.lineTo(px - pw * 0.2, py + 44);
            c.closePath(); c.fill();
            c.fillStyle = '#6a718c';
            c.fillRect(px - 4, py - 34, 8, 34);
            c.fillRect(px + 14, py - 22, 6, 22);
          });
          // 空中碎石
          c.fillStyle = '#5a6178';
          for (let i = 0; i < 6; i++) c.fillRect(rand(0, w), rand(30, 60), 10, 8);
        }),
        // 无 ground / groundTop：地面即动态云海（renderCloudSea 按帧绘制）
        cloud: cloud('#9aa2c4', '#5a6280')
      };

      /* —— 仙人洞：深灰青洞天，暗几何层次，仅地面最亮且有起伏 —— */
      this.bg.cave = {
        sky: sky([[0, '#28323b'], [0.6, '#3b4853'], [1, '#505d69']], x => {
          // 极淡的几何方洞轮廓（嵌套大矩形）
          x.strokeStyle = 'rgba(180,200,210,0.07)'; x.lineWidth = 3;
          for (let i = 0; i < 5; i++) x.strokeRect(60 + i * 190, 50 + (i % 2) * 80, 130, 130);
          x.strokeStyle = 'rgba(180,200,210,0.05)';
          for (let i = 0; i < 4; i++) x.strokeRect(120 + i * 220, 180 + (i % 2) * 60, 90, 90);
        }),
        far: strip(480, 200, (c, w, h) => {
          // 暗几何层：层叠方洞壁（中灰 / 深青）
          c.fillStyle = '#333f49';
          for (let i = 0; i < 7; i++) c.fillRect(i * 74 - 14, 60 + (i % 2) * 30, 88, 150);
          c.fillStyle = '#3c4852';
          for (let i = 0; i < 6; i++) c.fillRect(i * 86 + 10, 20 + (i % 2) * 42, 64, 160);
          // 深色方洞开口
          c.fillStyle = '#2a343d';
          for (let i = 0; i < 8; i++) c.fillRect(i * 66 + 6, 100 + (i % 3) * 28, 26, 30);
        }),
        mid: strip(480, 120, (c, w, h) => {
          // 石柱（中灰，仅顶边一线冷青高光）
          for (let i = 0; i < 5; i++) {
            const cx = i * 100 + 34, cy = 26 + (i % 2) * 16;
            c.fillStyle = '#667480'; c.fillRect(cx, cy, 26, 94);
            c.fillStyle = '#525f6a'; c.fillRect(cx + 18, cy, 8, 94);
            c.fillStyle = 'rgba(140,200,212,0.8)'; c.fillRect(cx, cy, 26, 3);
          }
          // 悬浮石板
          [[60, 30, 64], [190, 46, 58], [310, 28, 70], [400, 44, 52]].forEach(([sx, sy, sw]) => {
            c.fillStyle = '#5d6b77'; c.fillRect(sx, sy, sw, 12);
            c.fillStyle = 'rgba(140,200,212,0.5)'; c.fillRect(sx, sy, sw, 2);
          });
        }),
        groundTop: strip(480, 86, (c, w, h) => {
          // 起伏地面：全图最亮处（底色与 ground 顶带同色）
          bumps(c, w, h, [[0, 60], [50, 48], [120, 56], [190, 40], [270, 52], [350, 44], [420, 54], [480, 46]], '#d3dbe1');
          c.fillStyle = '#e8eef2';
          bumps(c, w, h, [[0, 58], [50, 46], [120, 54], [190, 38], [270, 50], [350, 42], [420, 52], [480, 44]], '#e8eef2');
          // 几何切面（浅灰三角折面）
          c.fillStyle = '#b8c4cc';
          [[80, 56], [220, 52], [360, 54]].forEach(([qx, qy]) => {
            c.beginPath(); c.moveTo(qx - 16, qy); c.lineTo(qx, qy - 10); c.lineTo(qx + 16, qy); c.closePath(); c.fill();
          });
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#aebac2'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#d3dbe1'; c.fillRect(0, 0, w, 18);
          // 斜向石纹
          c.strokeStyle = 'rgba(120,138,148,0.5)'; c.lineWidth = 2;
          for (let x = 0; x < w; x += 48) {
            c.beginPath(); c.moveTo(x, 4); c.lineTo(x + 12, h); c.stroke();
          }
          c.fillStyle = '#c2ccd4';
          for (let i = 0; i < 30; i++) c.fillRect(rand(0, w), rand(20, 80), 8, 4);
        }),
        cloud: mistMotif
      };

      /* —— 群山：无地平线，满屏形态各异山峰（尖/方/双峰/高低），青灰苍茫 —— */
      this.bg.mountains = {
        sky: sky([[0, '#7c8a94'], [0.55, '#9aa8b0'], [1, '#bcc8cc']], x => {
          // 最远峰层：峰尖直插天幕高处，没有统一地平线
          x.fillStyle = 'rgba(168,182,186,0.7)';
          x.beginPath(); x.moveTo(0, 300);
          [[0, 110], [70, 40], [140, 90], [220, 24], [300, 80], [380, 36], [470, 74], [560, 18], [650, 70], [740, 40], [830, 84], [920, 30], [960, 66]]
            .forEach(p => x.lineTo(p[0], p[1]));
          x.lineTo(CFG.W, 300); x.closePath(); x.fill();
          // 次远峰层
          x.fillStyle = 'rgba(148,164,170,0.65)';
          x.beginPath(); x.moveTo(0, 340);
          [[0, 160], [90, 80], [180, 140], [270, 60], [360, 130], [460, 70], [560, 140], [660, 60], [760, 128], [860, 74], [960, 120]]
            .forEach(p => x.lineTo(p[0], p[1]));
          x.lineTo(CFG.W, 340); x.closePath(); x.fill();
          // 冷雾带横亘山腰
          x.fillStyle = 'rgba(220,228,230,0.18)';
          x.fillRect(0, 250, CFG.W, 26);
        }),
        far: strip(480, 200, (c, w, h) => {
          // 形态各异远峰：尖峰 / 双峰 / 平顶山台交错
          bumps(c, w, h, [[0, 150], [44, 46], [86, 120], [120, 70], [156, 26], [200, 110], [240, 60], [286, 60], [330, 118], [372, 36], [408, 86], [446, 58], [480, 104]], '#8a989c');
          // 岩面亮侧
          c.fillStyle = '#a6b4b6';
          [[44, 46], [156, 26], [372, 36]].forEach(([px, py]) => {
            c.beginPath(); c.moveTo(px, py); c.lineTo(px + 26, py + 60); c.lineTo(px + 6, py + 60); c.closePath(); c.fill();
          });
          // 双峰凹槽 + 平顶山台层理
          c.fillStyle = '#78868c';
          c.fillRect(230, 62, 66, 8);
          // 近一层异峰（更暗）
          bumps(c, w, h, [[0, 176], [60, 110], [110, 150], [170, 84], [230, 70], [300, 140], [360, 96], [430, 150], [480, 124]], '#6f7d78');
          c.fillStyle = '#8a988e';
          [[170, 84], [230, 70], [360, 96]].forEach(([px, py]) => {
            c.beginPath(); c.moveTo(px, py); c.lineTo(px + 20, py + 50); c.lineTo(px + 4, py + 50); c.closePath(); c.fill();
          });
        }),
        mid: strip(480, 120, (c, w, h) => {
          // 近峰：尖锐与方崖并存
          bumps(c, w, h, [[0, 112], [52, 44], [110, 96], [168, 30], [224, 84], [280, 52], [312, 52], [368, 92], [420, 40], [480, 86]], '#5c6860');
          // 崖壁亮切面
          c.fillStyle = '#6e7a70';
          [[52, 44], [168, 30], [420, 40]].forEach(([px, py]) => {
            c.beginPath(); c.moveTo(px, py); c.lineTo(px + 22, py + 56); c.lineTo(px + 4, py + 56); c.closePath(); c.fill();
          });
          // 平顶山崖顶
          c.fillStyle = '#4c5850';
          c.fillRect(280, 52, 34, 10);
          // 迎客松（生于峰侧）
          [[104, 96], [360, 92]].forEach(([px, py]) => {
            c.fillStyle = '#3a2c20'; c.fillRect(px - 2, py - 26, 5, 26);
            c.fillStyle = '#3c4a3a';
            c.fillRect(px - 18, py - 28, 16, 5); c.fillRect(px + 2, py - 32, 18, 5);
            c.fillRect(px - 12, py - 34, 10, 4);
          });
        }),
        groundTop: strip(480, 86, (c, w, h) => {
          // 参差近基岩：与障碍根部咬合（底色与 ground 顶带同色）
          bumps(c, w, h, [[0, 64], [34, 40], [78, 56], [120, 28], [170, 50], [214, 34], [268, 54], [320, 30], [372, 48], [424, 36], [480, 52]], '#66726a');
          c.fillStyle = '#7a867a';
          [[34, 40], [120, 28], [214, 34], [320, 30], [424, 36]].forEach(([px, py]) => {
            c.beginPath(); c.moveTo(px, py); c.lineTo(px + 12, 56); c.lineTo(px + 2, 56); c.closePath(); c.fill();
          });
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#525a52'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#66726a'; c.fillRect(0, 0, w, 18);
          c.fillStyle = '#7a847c';
          for (let i = 0; i < 50; i++) c.fillRect(rand(0, w), rand(0, 12), 7, 3);
          c.fillStyle = '#444c46';
          for (let i = 0; i < 46; i++) c.fillRect(rand(0, w), rand(20, h - 8), 9, 5);
        }),
        cloud: cloud('#e8eee8', '#c2d0c8')
      };

      /* —— 魔窟：黑蓝深紫、巨大钟乳石群、蓝紫妖火 —— */
      this.bg.demoncave = {
        sky: sky([[0, '#080512'], [0.55, '#150e2c'], [1, '#241648']], x => {
          // 妖火微光
          [[140, 200, '#7a4cd8'], [620, 150, '#ff8a3c'], [860, 230, '#3a7ad8']].forEach(([cx, cy, col]) => {
            const g = x.createRadialGradient(cx, cy, 2, cx, cy, 70);
            g.addColorStop(0, col + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)');
            x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 70, 0, TAU); x.fill();
          });
        }),
        far: strip(480, 200, (c, w, h) => {
          // 巨大钟乳石群（自顶部垂下）
          c.fillStyle = '#1a1230';
          for (let i = 0; i < 8; i++) { const cx = i * 64 + 20, ch = 60 + (i % 4) * 26; c.beginPath(); c.moveTo(cx - 22, 0); c.lineTo(cx + 22, 0); c.lineTo(cx, ch); c.closePath(); c.fill(); }
          c.fillStyle = '#241a40';
          for (let i = 0; i < 6; i++) { const cx = i * 84 + 40, ch = 40 + (i % 3) * 20; c.beginPath(); c.moveTo(cx - 16, 0); c.lineTo(cx + 16, 0); c.lineTo(cx, ch); c.closePath(); c.fill(); }
        }),
        mid: strip(480, 120, (c, w, h) => {
          // 岩壁 + 岩柱 + 妖火 + 发光植物
          c.fillStyle = '#2c1e4c';
          bumps(c, w, h, [[0, 96], [100, 56], [210, 92], [320, 52], [430, 88], [480, 70]], '#2c1e4c');
          c.fillStyle = '#3c2a60';
          for (let i = 0; i < 4; i++) c.fillRect(i * 120 + 40, 40, 20, 70);
          c.fillStyle = '#ff8a3c';
          for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(rand(20, w - 20), rand(70, 106), 3, 0, TAU); c.fill(); }
          c.fillStyle = '#7a4cd8';
          for (let i = 0; i < 8; i++) c.fillRect(rand(0, w), rand(76, 110), 3, 8);
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#120c22'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#1e1438'; c.fillRect(0, 0, w, 12);
          c.fillStyle = '#2c1e4c';
          for (let i = 0; i < 50; i++) c.fillRect(rand(0, w), rand(12, h - 6), 9, 4);
          c.fillStyle = '#7a4cd8';
          for (let i = 0; i < 14; i++) c.fillRect(rand(0, w), rand(0, 10), 2, 4);
        }),
        cloud: emberMotif
      };

      /* —— 矩阵：黑底荧光绿、无限数据空间、网格与信息流 —— */
      this.bg.matrix = {
        sky: sky([[0, '#020806'], [0.6, '#06140e'], [1, '#0a2018']], x => {
          // 透视网格
          x.strokeStyle = 'rgba(53,255,158,0.18)'; x.lineWidth = 1;
          for (let gx = 0; gx <= CFG.W; gx += 80) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, CFG.H); x.stroke(); }
          // 数据雨
          x.fillStyle = 'rgba(53,255,158,0.6)'; x.font = '12px monospace';
          for (let i = 0; i < 70; i++) x.fillText(Math.random() < 0.5 ? '1' : '0', rand(0, CFG.W), rand(0, 300));
        }),
        far: strip(480, 200, (c, w, h) => {
          // 巨大数据库柱 + 防火墙
          c.strokeStyle = 'rgba(53,255,158,0.35)'; c.lineWidth = 2;
          for (let i = 0; i < 5; i++) { const bx = i * 100 + 20, bh = 90 + (i % 3) * 30; c.strokeRect(bx, 180 - bh, 56, bh); }
          c.fillStyle = 'rgba(180,106,255,0.25)';
          for (let i = 0; i < 4; i++) c.fillRect(i * 130 + 60, 0, 8, h);
        }),
        mid: strip(480, 120, (c, w, h) => {
          // 漂浮数据块 + 发光代码线
          c.strokeStyle = '#35ff9e'; c.lineWidth = 2;
          for (let i = 0; i < 7; i++) { const s = 20 + (i % 3) * 12; const bx = i * 70 + 10, by = 40 + (i % 2) * 26; c.strokeRect(bx, by, s, s); }
          c.fillStyle = 'rgba(53,224,255,0.6)';
          for (let i = 0; i < 12; i++) c.fillRect(rand(0, w), rand(80, 110), rand(14, 40), 2);
        }),
        ground: strip(480, 100, (c, w, h) => {
          c.fillStyle = '#04100b'; c.fillRect(0, 0, w, h);
          c.strokeStyle = 'rgba(53,255,158,0.30)';
          for (let gx = 0; gx <= w; gx += 24) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, h); c.stroke(); }
          for (let gy = 0; gy <= h; gy += 20) { c.beginPath(); c.moveTo(0, gy); c.lineTo(w, gy); c.stroke(); }
          c.fillStyle = '#35ff9e';
          for (let i = 0; i < 30; i++) c.fillRect(rand(0, w), rand(0, 14), 6, 2);
        }),
        cloud: cloud('#1a6a48', '#0c3026')
      };

      /* —— 月痕沙海：夜晚玫红沙漠、缺角巨月漏沙、金字塔、河流、骸骨、炊烟火光 —— */
      this.bg.moondesert = {
        sky: sky([[0, '#3a1a3e'], [0.4, '#7a2e5e'], [0.75, '#c04a6e'], [1, '#e88a6a']], x => {
          // 星点
          x.fillStyle = '#fff';
          for (let i = 0; i < 60; i++) {
            const sx = rand(0, CFG.W), sy = rand(20, 220);
            const sz = Math.random() < 0.85 ? 1 : 2;
            x.fillRect(sx, sy, sz, sz);
          }
          // 硕大的缺角月亮（右上），缺口往外漏沙
          const mx = 760, my = 110, mr = 52;
          x.fillStyle = '#f5ecd0';
          x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.fill();
          x.fillStyle = '#e8dcb4';
          for (let i = 0; i < 6; i++) {
            x.beginPath(); x.arc(mx + rand(-20, 20), my + rand(-20, 20), rand(4, 10), 0, TAU); x.fill();
          }
          // 缺角（月牙形缺口，朝向左下）
          x.fillStyle = '#5a2050';   // 与夜空同色，营造缺角
          x.beginPath();
          x.arc(mx - 22, my + 18, mr * 0.92, 0, TAU);
          x.fill();
          // 缺口漏沙：金棕色沙粒瀑布
          for (let i = 0; i < 70; i++) {
            const sx = mx - 28 + rand(-14, 6);
            const sy = my + 22 + rand(0, 200);
            x.fillStyle = Math.random() < 0.5 ? '#e8c06a' : '#d4a04a';
            x.fillRect(sx, sy, 2, 2);
          }
          // 月光晕
          x.fillStyle = 'rgba(245,236,208,0.12)';
          x.beginPath(); x.arc(mx, my, mr + 24, 0, TAU); x.fill();
        }),
        far: strip(480, 200, (c, w, h) => {
          // 远处金字塔群（三座，剪影）
          const pyr = [[120, 180, 150], [300, 185, 110], [420, 178, 90]];
          pyr.forEach(([px, py, pw]) => {
            c.fillStyle = '#5a2a5a';
            c.beginPath(); c.moveTo(px - pw / 2, py); c.lineTo(px, py - 90); c.lineTo(px + pw / 2, py); c.closePath(); c.fill();
            // 右侧受光面
            c.fillStyle = '#7a3a6a';
            c.beginPath(); c.moveTo(px, py - 90); c.lineTo(px + pw / 2, py); c.lineTo(px + pw * 0.18, py); c.closePath(); c.fill();
          });
          // 河流：远处蜿蜒蓝带
          c.fillStyle = '#4a6ab0';
          c.beginPath();
          c.moveTo(0, 150);
          c.bezierCurveTo(120, 120, 200, 170, 320, 140);
          c.bezierCurveTo(400, 125, 440, 160, 480, 150);
          c.lineTo(480, 162);
          c.bezierCurveTo(400, 172, 320, 152, 200, 182);
          c.bezierCurveTo(120, 192, 60, 158, 0, 162);
          c.closePath(); c.fill();
          c.fillStyle = '#6a8ad0';
          c.beginPath();
          c.moveTo(0, 152);
          c.bezierCurveTo(120, 122, 200, 172, 320, 142);
          c.bezierCurveTo(400, 127, 440, 162, 480, 152);
          c.lineTo(480, 156);
          c.bezierCurveTo(400, 131, 320, 146, 200, 176);
          c.bezierCurveTo(120, 186, 60, 156, 0, 156);
          c.closePath(); c.fill();
          // 零星火光（远处营地）
          for (let i = 0; i < 10; i++) {
            const fx = rand(20, w - 20), fy = rand(160, 195);
            c.fillStyle = '#ff7b2e'; c.fillRect(fx, fy, 3, 3);
            c.fillStyle = '#ffd23b'; c.fillRect(fx + 1, fy - 2, 1, 2);
          }
        }),
        mid: strip(480, 120, (c, w, h) => {
          // 中景沙丘剪影
          bumps(c, w, h, [[0, 75], [80, 40], [180, 70], [280, 35], [380, 65], [480, 50]], '#7a3560');
          c.fillStyle = '#8a4570';
          for (let i = 0; i < 30; i++) c.fillRect(rand(0, w), rand(45, 100), 8, 2);
          // 炊烟（几缕上升烟柱）
          for (let i = 0; i < 4; i++) {
            const sx = 60 + i * 110;
            for (let j = 0; j < 14; j++) {
              const sy = 60 - j * 4 + rand(-2, 2);
              c.fillStyle = `rgba(180,170,200,${0.35 - j * 0.02})`;
              c.fillRect(sx + rand(-3, 3), sy, 6, 4);
            }
            // 烟柱底部火堆
            c.fillStyle = '#ff7b2e'; c.fillRect(sx - 2, 70, 6, 5);
            c.fillStyle = '#ffd23b'; c.fillRect(sx, 68, 2, 3);
          }
        }),
        ground: strip(480, 100, (c, w, h) => {
          // 沙地底色（夜晚偏紫）
          c.fillStyle = '#8a5a6a'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#a06a7a'; c.fillRect(0, 0, w, 12);
          c.fillStyle = '#6a4050';
          for (let i = 0; i < 50; i++) c.fillRect(rand(0, w), rand(14, 40), 10, 2);
          c.fillStyle = '#9a6070';
          for (let i = 0; i < 30; i++) c.fillRect(rand(0, w), rand(30, h - 8), 5, 4);
          // 地面骸骨（散落的头骨与肋骨）
          for (let i = 0; i < 5; i++) {
            const bx = rand(20, w - 20), by = rand(30, h - 12);
            // 头骨
            c.fillStyle = '#e8dcc0';
            c.fillRect(bx, by, 10, 8);
            c.fillRect(bx + 1, by - 3, 8, 3);
            c.fillStyle = '#3a2a3a';
            c.fillRect(bx + 2, by + 2, 2, 2); c.fillRect(bx + 6, by + 2, 2, 2);
            c.fillRect(bx + 4, by + 5, 2, 2);
            // 肋骨（偶尔）
            if (Math.random() < 0.5) {
              c.fillStyle = '#d8ccb0';
              for (let k = 0; k < 4; k++) c.fillRect(bx + 12 + k * 3, by + 1, 2, 6);
            }
          }
          // 零星火光余烬
          for (let i = 0; i < 8; i++) {
            const fx = rand(0, w), fy = rand(10, h - 6);
            c.fillStyle = Math.random() < 0.5 ? '#ff7b2e' : '#ffd23b';
            c.fillRect(fx, fy, 2, 2);
          }
        }),
        cloud: cloud('#d8c0e0', '#b89cc8')
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

    /** 天空：滚滚云海地面（逐帧绘制；云涌期间云面翻滚幅度变大 + 云层整体上升）。
     *  云海为实体地面：仅作活动区边界，无接触伤害（与大海区分） */
    renderCloudSea(ctx) {
      const s = this.cloudSea;
      const t = this.state === 'menu' ? performance.now() / 1000 : s.t;
      const base = CFG.GROUND_Y - s.rise;
      // 云体深部：自上而下的厚度色带（亮 → 暗 → 更暗，表现云海纵深）
      ctx.fillStyle = '#6b7388';
      ctx.fillRect(0, base + 34, CFG.W, CFG.H - (base + 34));
      ctx.fillStyle = '#828aa2';
      ctx.fillRect(0, base + 20, CFG.W, 26);
      ctx.fillStyle = '#9aa2ba';
      ctx.fillRect(0, base + 10, CFG.W, 18);
      // 滚滚云面：逐块成团云团（亮顶白冠 + 灰腹 + 暗底），伪随机哈希错位避免机械规律
      for (let x = -16; x <= CFG.W + 16; x += 16) {
        const sxw = x + 8;
        const sy = this.cloudSeaY(sxw, t);
        const hash = Math.abs(Math.sin(sxw * 12.9898 + Math.floor(t * 0.5) * 78.233) % 1);
        const lumpH = 18 + hash * 16 + (Math.sin(sxw * 0.016 + t * 1.2) > 0.2 ? 8 : 0);
        ctx.fillStyle = '#aeb6cc';
        ctx.fillRect(x, sy - 2, 16, lumpH);
        ctx.fillStyle = '#8c94ac';
        ctx.fillRect(x, sy + lumpH - 8, 16, 8);
        ctx.fillStyle = '#dfe3f0';
        ctx.fillRect(x + 2, sy - 6, 12, 6);
        ctx.fillStyle = '#f6f8ff';
        ctx.fillRect(x + 3, sy - 9, 8, 4);
      }
      // 高空游离小云团（云涌时更密集）
      const puffN = s.surging ? 7 : 4;
      for (let i = 0; i < puffN; i++) {
        const px = ((i * 173 + t * (18 + i * 7)) % (CFG.W + 120)) - 60;
        const py = base - 40 - ((i * 53) % 70) + Math.sin(t + i) * 6;
        ctx.fillStyle = 'rgba(200,206,224,0.85)';
        ctx.fillRect(px, py, 26, 10);
        ctx.fillStyle = 'rgba(238,241,248,0.9)';
        ctx.fillRect(px + 4, py - 4, 16, 6);
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
      // 震屏仅作用于战斗 / Boss 预警 / 死亡结算；菜单/奖励/升级/暂停不抖动（否则残留震屏值会让主界面持续震动）
      const shakeState = this.state === 'playing' || this.state === 'warn' || this.state === 'gameover';
      if (shakeState && this.shakeMag > 0.2) {
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
      if (this.cloudSea) {
        // 天空：动态起伏云海本身就是"地面"（无 bg.ground）
        this.renderCloudSea(ctx);
      } else {
        // 近地表起伏层 groundTop：透明背景，峰顶可高出 GROUND_Y 最多 46px，与 ground 同视差锁死、同底色无缝
        if (bg.groundTop) this.drawTiled(bg.groundTop, CFG.GROUND_Y - 46, 0.55, 86);
        if (bg.ground) this.drawTiled(bg.ground, CFG.GROUND_Y, 0.55, CFG.H - CFG.GROUND_Y);
      }
      // 大海：动态波浪海平面（画在实体层前，礁石/珊瑚立在海中）
      if (this.sea) this.renderSea(ctx);
      // 火焰山：火山口场景装饰（无碰撞）
      if (this.crater) this.renderCrater(ctx);

      // Boss 战黑红蒙版：覆盖背景（障碍物/UI/小怪/tips 之上不覆盖）
      if (this.bossMaskAlpha > 0.01) {
        const t = performance.now() / 1000;
        // 边缘抖动：用不规则边缘 noise 模拟"围绕抖动"
        ctx.save();
        ctx.globalAlpha = this.bossMaskAlpha;
        // 主体半透明黑红蒙版
        ctx.fillStyle = 'rgba(40, 0, 0, 0.55)';   // 淡淡的黑红色
        ctx.fillRect(0, 0, CFG.W, CFG.H);
        // 边缘抖动：在四边绘制噪声扰动的暗红色条带
        ctx.fillStyle = 'rgba(120, 10, 10, 0.6)';
        const edgeW = 24;
        // 上下边
        for (let x = 0; x < CFG.W; x += 8) {
          const jT = Math.sin(t * 8 + x * 0.05) * 6 + Math.sin(t * 13 + x * 0.1) * 4;
          const jB = Math.sin(t * 9 + x * 0.07 + 1) * 6 + Math.sin(t * 11 + x * 0.13) * 4;
          ctx.fillRect(x, 0, 8, edgeW + jT);
          ctx.fillRect(x, CFG.H - edgeW - jB, 8, edgeW + jB);
        }
        // 左右边
        for (let y = 0; y < CFG.H; y += 8) {
          const jL = Math.sin(t * 7 + y * 0.06) * 6 + Math.sin(t * 12 + y * 0.11) * 4;
          const jR = Math.sin(t * 8 + y * 0.08 + 2) * 6 + Math.sin(t * 14 + y * 0.09) * 4;
          ctx.fillRect(0, y, edgeW + jL, 8);
          ctx.fillRect(CFG.W - edgeW - jR, y, edgeW + jR, 8);
        }
        ctx.restore();
      }

      if (this.state !== 'menu') {
        // 山石障碍（地面层）
        this.rocks.forEach(r => r.render(ctx));
        // 破碎障碍物（塔楼/残骸/魔方/巨峰/枯木）
        this.breakables.forEach(r => r.render(ctx));
        // 宝石
        this.gems.forEach(g2 => g2.render(ctx));
        // 闪电预警层
        this.lightnings.forEach(l => { if (l.t < l.warn) l.render(ctx); });
        // 敌人 / Boss
        this.enemies.forEach(e => e.render(ctx));
        this.bosses.forEach(b => b.render(ctx));
        // 新地图机关（水流/暴风雪/落雷/移动方石/数据墙）
        if (Hazards) Hazards.render(this, ctx);
        // 声波禁锢视觉：Boss / 龙类覆盖冰蓝色罩（普通敌人自带冻结渲染）
        if (this.soundwaveT > 0) {
          ctx.save();
          ctx.fillStyle = 'rgba(110,200,255,0.30)';
          ctx.strokeStyle = 'rgba(180,235,255,0.75)';
          ctx.lineWidth = 2;
          this.bosses.forEach(b => {
            if (b.dead) return;
            const r = (b.radius || 40) * 1.25;
            ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill(); ctx.stroke();
          });
          this.enemies.forEach(e => {
            if (e.dead || !e.segments) return;
            const r = (e.segR || 13) * 1.35;
            ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill(); ctx.stroke();
          });
          ctx.restore();
        }
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
        // 侠客大招斩击特效：巨型翠绿剑气弧
        if (this.slashFx) {
          const fx = this.slashFx;
          const pr = clamp(fx.t / fx.max, 0, 1);
          const reach = 60 + (1 - pr) * 300;
          ctx.save();
          ctx.translate(fx.x, fx.y);
          ctx.globalAlpha = pr * 0.9;
          ctx.strokeStyle = '#2fb37c'; ctx.lineWidth = 14 * pr + 4;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(0, 0, reach, -1.15, 1.15); ctx.stroke();
          ctx.strokeStyle = '#7ed46d'; ctx.lineWidth = 7 * pr + 2;
          ctx.beginPath(); ctx.arc(0, 0, reach, -1.05, 1.05); ctx.stroke();
          ctx.strokeStyle = '#eafff2'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, 0, reach, -0.95, 0.95); ctx.stroke();
          ctx.restore();
          ctx.globalAlpha = 1;
        }
        // 魅影大招：百鬼夜行（扩散紫环 + 十六鬼火飘掠）
        if (this.phantomFx) {
          const fx = this.phantomFx;
          const pr = clamp(fx.t / fx.max, 0, 1);
          // 扩散鬼门环
          ctx.save();
          ctx.globalAlpha = pr * 0.8;
          ctx.strokeStyle = '#8b55e0'; ctx.lineWidth = 18 * pr + 3;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, TAU); ctx.stroke();
          ctx.strokeStyle = '#ff7bd5'; ctx.lineWidth = 6 * pr + 1.5;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * 0.82, 0, TAU); ctx.stroke();
          ctx.restore();
          // 群鬼：沿放射方向飘掠、垂直方向正弦游荡
          fx.ghosts.forEach(g => {
            const wob = Math.sin(fx.t * 10 + g.ph) * 16;
            const gx = fx.x + Math.cos(g.a) * g.dist + Math.cos(g.a + Math.PI / 2) * wob;
            const gy = fx.y + Math.sin(g.a) * g.dist + Math.sin(g.a + Math.PI / 2) * wob;
            const s = g.size * (0.8 + pr * 0.4);
            ctx.save();
            ctx.translate(gx, gy);
            ctx.rotate(g.a);
            ctx.globalAlpha = Math.min(1, pr * 1.7) * 0.92;
            ctx.shadowColor = 'rgba(168,116,255,.9)'; ctx.shadowBlur = 12;
            // 鬼火拖尾
            ctx.fillStyle = g.magenta ? '#ff7bd5' : '#8b55e0';
            ctx.beginPath();
            ctx.moveTo(-s * 0.4, -s * 0.72);
            ctx.quadraticCurveTo(-s * 1.9, 0, -s * 0.4, s * 0.72);
            ctx.closePath(); ctx.fill();
            // 鬼头
            ctx.fillStyle = g.magenta ? '#c0509c' : '#6d3fd0';
            ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#d8c2ff';
            ctx.beginPath(); ctx.arc(-s * 0.12, -s * 0.12, s * 0.58, 0, TAU); ctx.fill();
            // 鬼脸：双眼
            ctx.fillStyle = '#1a0b33';
            ctx.fillRect(s * 0.02, -s * 0.34, s * 0.24, s * 0.32);
            ctx.fillRect(s * 0.38, -s * 0.28, s * 0.24, s * 0.32);
            ctx.restore();
          });
          ctx.globalAlpha = 1;
        }
        // Toast（按 slot 分位置渲染）
        this.toasts.forEach(t => {
          const a = clamp(t.t / 0.5, 0, 1);
          ctx.globalAlpha = a;
          ctx.font = 'bold 26px "Microsoft YaHei", sans-serif';
          let x, y, align;
          if (t.slot === 'lt') {        // 左上：顶部 HUD / Boss 血条下方
            align = 'left'; x = 14; y = 106;
          } else if (t.slot === 'rb') { // 右下角
            align = 'right'; x = CFG.W - 14; y = CFG.H - 18;
          } else {                      // 中上（默认）
            align = 'center'; x = CFG.W / 2; y = 120;
          }
          ctx.textAlign = align;
          ctx.fillStyle = '#000';
          ctx.fillText(t.text, x + 2, y + 2);
          ctx.fillStyle = '#ffe08a';
          ctx.fillText(t.text, x, y);
          ctx.globalAlpha = 1;
          ctx.textAlign = 'left';
        });
        // 大招口头禅气泡（角色右侧，显示 3 秒，首末 0.3s 淡入淡出）
        if (this.ultBubble && this.player) {
          const ub = this.ultBubble;
          ctx.save();
          ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          const tw = ctx.measureText(ub.text).width;
          const padX = 14, padY = 9, bh = 18 + padY * 2;
          const bw = tw + padX * 2;
          let a = 1;
          if (ub.t > 2.7) a = (3 - ub.t) / 0.3;
          else if (ub.t < 0.3) a = ub.t / 0.3;
          ctx.globalAlpha = clamp(a, 0, 1);
          const px = this.player.x;
          const py = this.player.y;
          // 气泡在角色右侧；空间不够则翻到左侧
          let bx = px + this.player.radius + 12;
          if (bx + bw > CFG.W - 6) bx = px - this.player.radius - 12 - bw;
          if (bx < 6) bx = 6;
          const by = Math.max(6, Math.min(CFG.H - bh - 6, py - bh / 2));
          const r = 10;
          ctx.beginPath();
          ctx.moveTo(bx + r, by);
          ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
          ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
          ctx.arcTo(bx, by + bh, bx, by, r);
          ctx.arcTo(bx, by, bx + bw, by, r);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255,255,255,.97)';
          ctx.fill();
          ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
          ctx.stroke();
          // 小尾巴指向角色（气泡左侧中点）
          ctx.beginPath();
          const tailY = Math.max(by + 12, Math.min(by + bh - 12, py));
          ctx.moveTo(bx, tailY - 7);
          ctx.lineTo(bx, tailY + 7);
          ctx.lineTo(bx - 9, tailY);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255,255,255,.97)';
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#222';
          ctx.textAlign = 'center';
          ctx.fillText(ub.text, bx + bw / 2, by + bh / 2 + 1);
          ctx.restore();
        }
        // 成就解锁炫彩通知（最顶层）
        if (window.Ach) Ach.render(ctx);
      } else {
        // 菜单展示出战角色（右下角浮空，直接绘制原图）
        const cat = (Sprites.charArt && Sprites.charArt[this.charId]) || Sprites.cat;
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
        // 菜单左上角：备战角色头像（assets/Role/ 或程序化 canvas）—— 方形边框、放大、清晰
        const faceImg = (Sprites.charFace && Sprites.charFace[this.charId]) || null;
        const faceReady = faceImg && (faceImg instanceof HTMLCanvasElement || (faceImg.complete && faceImg.naturalWidth));
        if (faceReady) {
          const bob2 = Math.sin(performance.now() / 420) * 4;
          const sz = 120;
          const cx = 82, cy = 82 + bob2;
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          // 方形头像底框
          ctx.fillStyle = 'rgba(10,16,36,.9)';
          ctx.fillRect(cx - sz / 2 - 5, cy - sz / 2 - 5, sz + 10, sz + 10);
          ctx.lineWidth = 4; ctx.strokeStyle = '#ffd166';
          ctx.strokeRect(cx - sz / 2 - 5, cy - sz / 2 - 5, sz + 10, sz + 10);
          // 方形剪裁绘制
          ctx.beginPath();
          ctx.rect(cx - sz / 2, cy - sz / 2, sz, sz);
          ctx.clip();
          const fw = faceImg.naturalWidth || faceImg.width, fh = faceImg.naturalHeight || faceImg.height;
          const r = Math.max(sz / fw, sz / fh);
          const dw = fw * r, dh = fh * r;
          ctx.drawImage(faceImg, cx - dw / 2, cy - dh / 2, dw, dh);
          ctx.restore();
          // 名称
          const c = window.CHARS && window.CHARS.get(this.charId);
          if (c) {
            ctx.save();
            ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#000'; ctx.fillText(c.name, cx + 1, cy + sz / 2 + 10 + bob2);
            ctx.fillStyle = '#ffe08a'; ctx.fillText(c.name, cx, cy + sz / 2 + 8 + bob2);
            ctx.restore();
          }
        }
      }

      // 冲击波环（障碍碎裂爆炸等）
      if (this.fxRings.length) {
        ctx.save();
        for (const ring of this.fxRings) {
          const k = ring.t / ring.life;
          ctx.globalAlpha = (1 - k) * 0.75;
          ctx.strokeStyle = ring.col; ctx.lineWidth = 16 * (1 - k) + 4;
          ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, TAU); ctx.stroke();
          ctx.globalAlpha = (1 - k) * 0.55;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * (1 - k) + 2;
          ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r * 0.8, 0, TAU); ctx.stroke();
        }
        ctx.restore();
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

      // 月痕沙海：上下黑边（Boss 入场演出）
      if (this.letterbox > 0.01) {
        const bh = Math.round((CFG.H * 0.22) * this.letterbox);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CFG.W, bh);
        ctx.fillRect(0, CFG.H - bh, CFG.W, bh);
      }
      // 玩家头顶感叹号（Boss 入场提示）
      if (this.bossIntro && this.bossIntro.mark && this.player) {
        const t = performance.now() / 1000;
        const yy = this.player.y - this.player.radius - 30 + Math.sin(t * 8) * 3;
        ctx.save();
        ctx.font = 'bold 36px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText('!', this.player.x + 1, yy + 1);
        ctx.fillStyle = '#ff3b3b';
        ctx.fillText('!', this.player.x, yy);
        ctx.restore();
      }
      // Boss 台词框（底部居中）
      if (this.dialogueBox) {
        const d = this.dialogueBox;
        const a = clamp(Math.min(d.t, d.max - d.t) / 0.4, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        const padX = 28, padY = 16;
        ctx.font = '20px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(d.text).width;
        const bw = Math.min(CFG.W - 80, tw + padX * 2);
        const bh2 = 20 + padY * 2;
        const bx = (CFG.W - bw) / 2;
        const by = CFG.H - bh2 - 70;
        // 半透明黑底 + 金框
        ctx.fillStyle = 'rgba(20,10,30,0.88)';
        ctx.fillRect(bx, by, bw, bh2);
        ctx.strokeStyle = '#e8c06a'; ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, bw - 2, bh2 - 2);
        ctx.fillStyle = '#fff5d0';
        // 文本自动换行（按宽度切分）
        const maxW = bw - padX * 2;
        if (tw <= maxW) {
          ctx.fillText(d.text, CFG.W / 2, by + bh2 / 2);
        } else {
          // 简单按字符切分两行
          const chars = d.text.split('');
          let line1 = '', line2 = '', cur = '';
          for (const ch of chars) {
            const test = cur + ch;
            if (ctx.measureText(test).width > maxW / 2 && !line2) { line2 = ch; cur = test; }
            else cur = test;
          }
          // 简化：前半/后半
          const half = Math.ceil(chars.length / 2);
          ctx.fillText(chars.slice(0, half).join(''), CFG.W / 2, by + bh2 / 2 - 11);
          ctx.fillText(chars.slice(half).join(''), CFG.W / 2, by + bh2 / 2 + 11);
        }
        ctx.restore();
      }

      // 死亡演出（黑气涌入 + 死法文本，全屏不受震屏影响，盖在一切之上）
      if (this.deathScene) this.renderDeathScene(ctx);
    }
  }

  window.game = new Game();
})();
