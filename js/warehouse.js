/* ============================================================
 * warehouse.js —— 仓库系统（背包）
 *  - 三个标签页：藏品（20 槽位）/ 文书（20 槽位）/ 道具
 *  - 藏品带 0~100% 进度条（名称 / 进度 / 来源 / 发现者），圆满触发解锁
 *  - 文书：标题 / 作者 / 已读未读；阅读界面含正文与程序绘制像素插图
 *  - 道具：幸运星 / 四叶草 / 古钱币（供奉藏品）/ 委托券
 *  - localStorage 持久化；面板 DOM 仅以 .hidden class 控制显隐（状态源唯一）
 * ============================================================ */
(function () {
  'use strict';

  const STORE_KEY = 'flytiger_wh_v1';
  const COLL_SLOTS = 20;
  const DOC_SLOTS = 20;

  /* ---------------- 藏品定义（第 1 件：黑人财神雕像；其余为未发现槽位） ---------------- */
  const COLLS = [
    {
      id: 'caishen',
      name: '黑人财神雕像',
      source: '沼泽黑市 · 南方覆灭帝国遗珍',
      finder: '法师',
      reward: '圆满解锁：新角色「魅影」',
      rewardChar: 'meiying',
      desc: '矮壮敦实的黑财神法相：反戴黑色鸭舌帽、金框圆墨镜、粗金链挂“$”大金牌；左手托一只戴金链的金色吐宝鼠，右手持骰子造型的发光宝珠，松散霸气地盘坐于低音炮莲台之上。卫衣暗纹藏传吉祥图案，背面烫金藏文“༄”。以南方覆灭帝国的古钱币供奉，五枚圆满，神像苏醒。'
    }
  ];
  const COLL_MAP = {};
  COLLS.forEach(c => { COLL_MAP[c.id] = c; });

  /* 供奉进度档位：投入古钱币，每颗 20%，5 颗集满（档位仅驱动雕像外观，不展示文字） */
  function stageIndex(prog) {
    if (prog >= 100) return 5;
    return Math.floor(prog / 20);
  }

  /* ---------------- 文书定义（第 1 篇：黑珍珠的危机） ---------------- */
  const DOCS = [
    {
      id: 'blackpearl',
      title: '黑珍珠的危机',
      author: '法师',
      art: 'ninjas',
      paras: [
        '我在冥想时听见了那颗珍珠的声音。',
        '它沉在沼泽最深处的泥潭里，被藤蔓缠了三百年，被淤泥埋了三百年。可它还在低声说话，像是从很远的山谷那头传来的风声。',
        '黑珍珠不是珍珠。',
        '是一颗被封印的眼球。',
        '古卷里记载过，很久以前有人把不干净的东西封进黑色的石头里，沉入水中，以为这样就结束了。可水是活的，水会流动，会把封印泡软，会把诅咒带到下游。',
        '下游有人在喝水，有人在种地，有人在打捞螺蛳。',
        '我顺着河岸走了一段，看见草丛里躺着几只翻肚皮的鱼。眼睛没了。空的。',
        '就在我准备离开的时候，余光扫到远处的山脊线——密密麻麻的黑影在移动。是忍者集团。他们不知道从哪里得到了消息，正在向这片沼泽聚集。',
        '数量太多了。',
        '这不是寻常的巡逻或试探，他们在搜山。用刀锋拨开每一丛草，拿刀尖刺入每一寸泥。他们在找什么东西——或者说，他们已经知道东西就在这里，只是还没摸到具体位置。',
        '风停了。周围的虫鸣也断了。整个沼泽都在屏住呼吸。',
        '我蹲在芦苇丛里数了数，山脊上的黑影至少上百。还在继续增加。他们很快就会把整片沼泽翻过来，一寸一寸地搜。',
        '我不确定他们找到了黑珍珠会做什么，但他们既然派了这么多人来找一颗藏了三百年的东西，那一定不是为了把它重新埋回去。',
        '我得比他们先找到。',
        '——法师手记'
      ]
    }
  ];
  const DOC_MAP = {};
  DOCS.forEach(d => { DOC_MAP[d.id] = d; });

  /* ---------------- 道具定义（先做 4 个） ---------------- */
  const ITEMS = [
    {
      id: 'luckstar', name: '幸运星', icon: 'star',
      desc: '粉红色的星星，据说会给人带来幸运。委托成功率 +15%。',
      note: '持有后生效 · 委托系统开放时启用'
    },
    {
      id: 'clover', name: '四叶草', icon: 'clover',
      desc: '神秘的四叶草，生长于荒地之中，月夜会散发银白色的光芒。委托成功率 +30%。',
      note: '持有后生效 · 委托系统开放时启用'
    },
    {
      id: 'coin', name: '古钱币', icon: 'coin',
      desc: '古老的钱币，传说来自南方覆灭的帝国。投入「黑人财神雕像」可提升 20% 完成度。',
      note: '唯一用途：供奉藏品',
      usable: 'caishen'
    },
    {
      id: 'ticket', name: '委托券', icon: 'ticket',
      desc: '可进行对传奇敌人的狩猎。持有后额外获得 1 次传奇委托机会。',
      note: '持有后生效 · 委托系统开放时启用'
    }
  ];
  const ITEM_MAP = {};
  ITEMS.forEach(it => { ITEM_MAP[it.id] = it; });

  /* ---------------- 持久化 ---------------- */
  const defaultData = () => ({
    collProgress: { caishen: 0 },   // 藏品 id -> 0~100
    docRead: {},                    // 文书 id -> 阅读时间戳
    items: { luckstar: 1, clover: 1, coin: 5, ticket: 1 },
    chars: { meiying: false }       // 解锁的角色
  });
  let saved = defaultData();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          saved.collProgress = Object.assign(defaultData().collProgress, d.collProgress || {});
          saved.docRead = Object.assign({}, d.docRead);
          saved.items = Object.assign(defaultData().items, d.items || {});
          saved.chars = Object.assign(defaultData().chars, d.chars || {});
        }
      }
    } catch (e) { /* 存档损坏：静默使用默认值 */ }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch (e) {}
  }
  load();

  /* ---------------- 数据 API ---------------- */
  const unlockHooks = [];
  function collProgress(id) { return Math.max(0, Math.min(100, saved.collProgress[id] || 0)); }
  function itemCount(id) { return saved.items[id] || 0; }
  function addItem(id, n) {
    if (!ITEM_MAP[id]) return;
    saved.items[id] = Math.max(0, (saved.items[id] || 0) + (n || 1));
    save();
  }
  function removeItem(id, n) {
    if (!ITEM_MAP[id]) return;
    saved.items[id] = Math.max(0, (saved.items[id] || 0) - (n || 1));
    save();
  }
  function isRead(id) { return !!saved.docRead[id]; }
  function markRead(id) {
    if (!saved.docRead[id]) { saved.docRead[id] = Date.now(); save(); }
  }
  function isCharUnlocked(id) { return !!saved.chars[id]; }
  function unlockChar(id) {
    if (saved.chars[id]) return;
    saved.chars[id] = true;
    save();
    unlockHooks.forEach(fn => { try { fn(id); } catch (e) {} });
  }
  function onUnlock(fn) { if (typeof fn === 'function') unlockHooks.push(fn); }

  /** 投入 1 枚古钱币供奉指定藏品：成功 true / 无币或已满 false */
  function investCoin(collId) {
    const def = COLL_MAP[collId];
    if (!def) return false;
    const cur = collProgress(collId);
    if (cur >= 100 || itemCount('coin') <= 0) return false;
    removeItem('coin', 1);
    const nv = Math.min(100, cur + 20);
    saved.collProgress[collId] = nv;
    if (nv >= 100 && def.rewardChar) unlockChar(def.rewardChar);
    save();
    return true;
  }

  /* ============================================================
   * 程序化美术
   * ============================================================ */

  /* ---------- 黑人财神雕像（220×262 像素点阵，stage 0~5 对应 0/20/40/60/80/100%） ---------- */
  function statuePalette(stage) {
    const full = stage >= 5;
    const G = {
      skin: '#9aa0ad', skinD: '#7e848f',
      hood: '#8e94a2', hoodD: '#73798a',
      pants: '#a7adba', pantsD: '#898f9d',
      shoe: '#c6cbd6', cap: '#797f8d',
      box: '#707685', boxD: '#5c616e',
      mouse: '#b3b9c4', mouseD: '#949aa6',
      edge: '#5e636f', dullGold: '#b9bfca'
    };
    return {
      G,
      skin: full ? '#7a4a2b' : G.skin, skinD: full ? '#5b351d' : G.skinD,
      hood: full ? '#171722' : G.hood, hoodD: full ? '#0d0d15' : G.hoodD,
      pants: full ? '#c9302e' : G.pants, pantsD: full ? '#971f1d' : G.pantsD,
      shoe: full ? '#f2f2f2' : G.shoe, cap: full ? '#12121a' : G.cap,
      box: full ? '#262631' : G.box, boxD: full ? '#17171f' : G.boxD,
      mouse: full ? '#ece6f4' : G.mouse, mouseD: full ? '#b3a9c8' : G.mouseD,
      edge: full ? '#0c0c12' : G.edge,
      gold: '#ffd23b', goldD: '#e0a012', goldHi: '#fff3b0',
      dullGold: G.dullGold,
      hasGold: stage >= 1,    // 金链/铜钱/鼠金链
      hasGlass: stage >= 2,   // 墨镜金膜
      hasDice: stage >= 3,    // 骰子宝珠发光、点数
      hasPattern: stage >= 4, // 卫衣暗纹
      hasGlyph: stage >= 4,   // 藏文浮现
      raised: stage >= 4,     // 抬手街舞姿态
      full
    };
  }

  function drawStatue(cv, stage, t) {
    if (cv.__stage === stage && cv.__t && t == null) return;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cv.width, cv.height);
    if (t == null) t = cv.__t || 0;
    cv.__t = t; cv.__stage = stage;
    const P = statuePalette(stage);
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h)); };
    const circ = (cx, cy, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); };
    const gold = (g) => g ? P.gold : P.dullGold;
    const goldD = (g) => g ? P.goldD : '#969cab';

    c.save();
    if (P.full) c.translate(0, Math.round(Math.sin(t * 2) * 1.5));

    /* 圆满：金色法光 */
    if (P.full) {
      const pulse = 0.85 + Math.sin(t * 2.4) * 0.15;
      const g = c.createRadialGradient(110, 132, 24, 110, 132, 168);
      g.addColorStop(0, 'rgba(255,210,80,' + (0.20 * pulse).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,210,80,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 220, 262);
    }

    /* 藏文“༄”法印浮现（帽顶上方，stage4 半显 / stage5 烫金脉动） */
    if (P.hasGlyph) {
      const a = P.full ? (0.85 + Math.sin(t * 3) * 0.15) : 0.62;
      c.save();
      c.globalAlpha = a;
      c.translate(110, 20);
      c.rotate(P.full ? Math.sin(t * 1.6) * 0.06 : 0);
      c.font = 'bold 30px "KaiTi","STKaiti","SimSun",serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = P.full ? 'rgba(255,210,60,0.95)' : 'rgba(255,210,60,0.5)';
      c.shadowBlur = P.full ? 18 : 8;
      c.fillStyle = P.full ? '#ffe98a' : '#b9a05a';
      c.fillText('༄', 0, 0);
      c.restore();
    }

    /* ===== 低音炮莲台（音响座） ===== */
    px(40, 196, 140, 50, P.boxD);
    px(44, 200, 132, 42, P.box);
    px(44, 196, 132, 5, P.full ? '#3d3d4d' : '#82889a');          // 顶面金属面
    // 提手
    px(62, 188, 5, 10, P.boxD); px(153, 188, 5, 10, P.boxD);
    px(62, 185, 96, 5, P.boxD);
    // 双低音喇叭
    [76, 144].forEach(wx => {
      circ(wx, 222, 18, P.edge); circ(wx, 222, 16, P.boxD);
      circ(wx, 222, 12, P.full ? '#0c0c12' : '#4a4f5c');
      circ(wx, 222, 6, P.full ? '#23232e' : '#6a7080');
      circ(wx, 222, 2.5, '#000');
      c.strokeStyle = P.full ? 'rgba(255,210,60,0.25)' : 'rgba(255,255,255,0.08)';
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(wx, 222, 13.5, 0, Math.PI * 2); c.stroke();
    });
    // 中部磁带舱
    px(102, 214, 17, 11, P.edge); px(104, 216, 13, 7, P.full ? '#0a0a10' : '#464b58');
    circ(107, 219, 1.8, P.full ? '#a974ff' : '#777d8c');
    circ(114, 219, 1.8, P.full ? '#8ff0ff' : '#777d8c');
    // 声波可视化（仅全彩）
    if (P.full) {
      const cols = ['#ffd23b', '#a974ff', '#8ff0ff', '#ffd23b', '#ff7bd5'];
      for (let i = 0; i < 5; i++) {
        const h = 3 + Math.abs(Math.sin(t * 6 + i * 1.4)) * 11;
        px(104 + i * 4, 240 - h, 2.4, h, cols[i]);
      }
    } else {
      for (let i = 0; i < 5; i++) px(104 + i * 4, 237, 2.4, 2, '#6a6f7d');
    }

    /* ===== 红色运动裤 + 白球鞋（松散坐姿，双腿分开） ===== */
    px(58, 150, 30, 48, P.pants); px(58, 150, 8, 48, P.pantsD);
    px(44, 196, 34, 32, P.pants); px(44, 196, 9, 32, P.pantsD);
    px(132, 150, 30, 48, P.pants); px(154, 150, 8, 48, P.pantsD);
    px(142, 196, 34, 32, P.pants); px(167, 196, 9, 32, P.pantsD);
    // 球鞋
    px(28, 224, 44, 18, P.shoe); px(26, 238, 48, 5, P.edge);
    px(28, 224, 44, 4, P.full ? '#ffffff' : '#d2d7e0');
    px(32, 232, 32, 3, P.pantsD);
    px(148, 224, 44, 18, P.shoe); px(146, 238, 48, 5, P.edge);
    px(148, 224, 44, 4, P.full ? '#ffffff' : '#d2d7e0');
    px(156, 232, 32, 3, P.pantsD);

    /* ===== 卫衣下摆 + 腰间古钱串 ===== */
    px(56, 146, 108, 16, P.hoodD);
    px(56, 146, 108, 2, P.full ? '#26263a' : '#8a909e');
    for (let x = 60; x < 160; x += 8) px(x, 150, 2, 10, P.full ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)');
    c.strokeStyle = gold(false); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(66, 152); c.lineTo(154, 152); c.stroke();
    [72, 92, 110, 128, 148].forEach(wx => {
      circ(wx, 157, 5.5, P.edge);
      circ(wx, 157, 4.5, gold(P.hasGold));
      px(wx - 1.6, 155.4, 3.2, 3.2, P.hasGold ? '#7a4a08' : '#6a6f7d');
    });

    /* ===== 卫衣躯干（Oversize） ===== */
    // 风帽
    circ(84, 82, 13, P.hoodD); circ(136, 82, 13, P.hoodD);
    px(80, 68, 60, 26, P.hoodD);
    // 肩 + 身
    circ(60, 92, 13, P.hood); circ(160, 92, 13, P.hood);
    px(56, 88, 108, 62, P.hood);
    px(56, 88, 8, 62, P.hoodD); px(156, 88, 8, 62, P.hoodD);
    px(56, 132, 108, 18, P.hoodD);
    // 袋鼠兜
    px(72, 118, 76, 24, P.hoodD);
    c.strokeStyle = P.full ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(74, 122); c.lineTo(146, 122); c.stroke();
    // 帽口阴影 + 抽绳
    px(92, 72, 36, 18, P.full ? '#08080e' : '#60667a');
    c.strokeStyle = P.full ? '#2c2c3c' : '#82889a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(101, 86); c.lineTo(99, 102); c.stroke();
    c.beginPath(); c.moveTo(119, 86); c.lineTo(121, 102); c.stroke();
    px(97, 101, 4, 4, P.hasGold ? P.goldD : '#73798a');
    px(119, 101, 4, 4, P.hasGold ? P.goldD : '#73798a');

    // 卫衣正面暗纹（藏传吉祥结，stage4 暗紫 / stage5 暗金）
    if (P.hasPattern) {
      const knotCol = P.full ? 'rgba(214,176,74,0.55)' : 'rgba(120,100,180,0.6)';
      const knot = (kx, ky, s) => {
        px(kx, ky, s * 3, s, knotCol); px(kx, ky + s * 2, s * 3, s, knotCol);
        px(kx, ky, s, s * 3, knotCol); px(kx + s * 2, ky, s, s * 3, knotCol);
      };
      knot(80, 126, 2.6); knot(110, 132, 2.6); knot(132, 126, 2.6);
      knot(98, 112, 2); knot(108, 112, 2);
    }

    /* ===== 粗金链 + “$”大金牌 ===== */
    const drawChainLine = (x0, y0, x1, y1) => {
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const x = x0 + (x1 - x0) * (i / steps);
        const y = y0 + (y1 - y0) * (i / steps);
        circ(x, y, 2.6, P.edge);
        circ(x, y, 1.8, gold(P.hasGold));
      }
      // 流光
      if (P.hasGold) {
        const sh = (t * 1.6) % 1;
        const sx = x0 + (x1 - x0) * sh, sy = y0 + (y1 - y0) * sh;
        px(sx - 1, sy - 3, 2, 2, P.goldHi);
      }
    };
    drawChainLine(78, 94, 110, 126);
    drawChainLine(142, 94, 110, 126);
    // 金牌
    circ(110, 132, 12, P.edge);
    circ(110, 132, 10.5, gold(P.hasGold));
    circ(110, 132, 10.5, P.hasGold ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0)');
    c.font = 'bold 13px "Courier New",monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = P.hasGold ? '#6b4400' : '#62677a';
    c.fillText('$', 110, 133);

    /* ===== 右臂（观众左侧）持骰子宝珠：stage4 起抬手街舞姿态 ===== */
    if (!P.raised) {
      px(48, 92, 20, 32, P.hood); px(46, 120, 24, 8, P.hoodD);   // 袖 + 罗纹袖口
      circ(58, 132, 7, P.skin);                                    // 手
      dice(50, 112, 17);
    } else {
      px(38, 66, 18, 38, P.hood); circ(48, 84, 9, P.hood);
      px(34, 98, 24, 8, P.hoodD);                                  // 袖口
      circ(45, 63, 7, P.skin);                                     // 高举的手
      dice(34, 42, 20);
    }
    function dice(x, y, s) {
      // 宝珠辉光
      if (P.hasDice) {
        const pu = 0.7 + Math.sin(t * 4) * 0.3;
        c.save();
        c.globalAlpha = pu;
        c.shadowColor = 'rgba(255,235,150,0.95)'; c.shadowBlur = 14;
        circ(x + s / 2, y + s / 2, s * 0.72, '#fff2b0');
        c.restore();
      }
      px(x, y, s, s, P.edge);
      px(x + 1.5, y + 1.5, s - 3, s - 3, P.hasDice ? '#f6f3fa' : P.G.dullGold);
      if (P.hasDice) {
        // 骰子五点
        const d = s / 2;
        c.fillStyle = '#232030';
        [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]].forEach(([gx, gy]) => {
          circ(x + d + gx * s * 0.24, y + d + gy * s * 0.24, s * 0.085, '#232030');
        });
        px(x + 2, y + 2, s * 0.22, s * 0.14, 'rgba(255,255,255,0.85)');
      }
    }

    /* ===== 左臂（观众右侧）托金色吐宝鼠 ===== */
    px(152, 92, 20, 34, P.hood); px(150, 122, 24, 8, P.hoodD);
    circ(161, 132, 9, P.skin);                                   // 摊开的手掌
    // 鼠身
    circ(166, 124, 7.5, P.mouseD); circ(166, 123, 7, P.mouse);
    circ(147, 119, 6.5, P.mouse);                                 // 头
    px(142, 114, 3, 4, P.mouse); px(150, 114, 3, 4, P.mouse);    // 耳
    px(144, 117, 1.6, 1.8, P.edge);                               // 眼
    px(141, 121, 2.4, 2.4, '#d86a9a');                            // 鼻
    // 卷曲长尾
    c.strokeStyle = P.mouseD; c.lineWidth = 3.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(172, 123); c.quadraticCurveTo(184, 118, 180, 108); c.stroke();
    c.strokeStyle = P.mouse; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(172, 122); c.quadraticCurveTo(182, 117, 179, 110); c.stroke();
    // 金链项圈
    px(150, 117, 10, 3.4, P.hasGold ? P.gold : P.dullGold);
    px(154, 120, 3, 3, P.hasGold ? P.goldD : '#969cab');
    // 吐宝：口中小宝珠
    if (P.hasDice) {
      c.save();
      c.shadowColor = 'rgba(255,235,150,0.9)'; c.shadowBlur = 8;
      circ(140.5, 124, 2.4 + Math.sin(t * 5) * 0.6, P.gold);
      c.restore();
    }

    /* ===== 头部：深棕光头 / 反戴鸭舌帽 / 金框圆墨镜 ===== */
    px(98, 70, 24, 10, P.skinD);                 // 颈
    circ(82, 58, 5, P.skin); circ(138, 58, 5, P.skin);
    px(86, 40, 48, 38, P.skin);
    circ(90, 42, 6, P.skin); circ(130, 42, 6, P.skin);
    px(86, 64, 48, 14, P.skinD);                 // 下颌阴影
    if (P.full) px(94, 43, 16, 3, '#9a6238');    // 光头高光
    // 鸭舌帽（帽檐朝后：右后方伸出）
    px(86, 26, 48, 15, P.cap);
    circ(92, 30, 6, P.cap); circ(128, 30, 6, P.cap);
    px(90, 22, 40, 8, P.cap);
    px(132, 24, 24, 8, P.cap); px(152, 27, 7, 5, P.capD);
    px(107, 19, 6, 4, P.capD);                   // 顶扣
    px(88, 38, 44, 3, P.full ? '#23232e' : '#6a6f7d');  // 帽檐圈/帽带
    // 圆框墨镜
    const lens = P.full ? '#07070d' : '#3e424d';
    [97, 123].forEach(lx => {
      circ(lx, 56, 9, P.hasGlass ? P.gold : P.G.edge);
      circ(lx, 56, 8, P.hasGlass ? P.goldD : '#7d828d');
      circ(lx, 56, 6.6, lens);
    });
    px(104, 54, 5, 3, P.hasGlass ? P.gold : '#7d828d');
    px(84, 54, 6, 2.6, P.hasGlass ? P.goldD : '#7d828d');
    px(130, 54, 6, 2.6, P.hasGlass ? P.goldD : '#7d828d');
    if (P.hasGlass) {
      px(93, 52, 3, 2, 'rgba(255,255,255,0.85)');
      px(119, 52, 3, 2, 'rgba(255,255,255,0.85)');
    }
    // 鼻 + 坏笑（金牙）
    px(108, 60, 4, 3, P.skinD);
    px(99, 68, 20, 2.4, P.edge);
    px(100, 67, 3, 1.4, P.skinD);
    if (P.full) px(107, 68, 3.4, 2, P.gold);

    /* ===== 全彩特效：金粉星光 ===== */
    if (P.full) {
      const pts = [
        [30, 50], [188, 60], [64, 96], [158, 92], [110, 150],
        [40, 168], [180, 170], [70, 206], [150, 206], [110, 32]
      ];
      pts.forEach(([sx, sy], i) => {
        const tw = Math.sin(t * 3.2 + i * 1.7);
        if (tw > 0.4) {
          c.globalAlpha = Math.min(1, tw);
          px(sx - 0.5, sy - 3.5, 1, 7, P.goldHi);
          px(sx - 3.5, sy - 0.5, 7, 1, P.goldHi);
        }
      });
      c.globalAlpha = 1;
    }
    c.restore();
  }

  /* ---------- 文书插图：月夜沼泽 · 群山上的忍者（160×120，彩色抽象像素，4:3） ----------
   * 紫暮夜空 + 冷月雾霭 + 三层山脊，忍者为融入山脊线的深色简影，
   * 仅以刀光与零星红眼跳出；前景沼泽映着碎月。重氛围（压迫/暗流）而非具象。 */
  function drawNinjaScene(cv) {
    const c = cv.getContext('2d');
    const W = 160, H = 120;
    c.imageSmoothingEnabled = false;
    // 固定种子随机（保证每次绘制一致）
    let seed = 20260913;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const mix = (a, b, t) => {
      const A = hex(a), B = hex(b);
      return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
    };
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h)); };
    // 像素实心圆（保持像素风，不走 arc 平滑）
    const disc = (cx0, cy0, r, col, a) => {
      c.fillStyle = col;
      if (a != null) c.globalAlpha = a;
      const cx = Math.round(cx0), cy = Math.round(cy0), r2 = r * r;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r2) c.fillRect(cx + x, cy + y, 1, 1);
      }
      if (a != null) c.globalAlpha = 1;
    };

    /* 1. 夜空：深紫黑 → 紫暮 → 山脊上方冷紫的逐行渐变 */
    for (let y = 0; y < 102; y++) {
      const t = y / 102;
      px(0, y, W, 1, t < 0.55 ? mix('#120e2e', '#2b2150', t / 0.55) : mix('#2b2150', '#5d4b85', (t - 0.55) / 0.45));
    }
    // 星点
    for (let i = 0; i < 30; i++) {
      const sx = Math.floor(rnd() * W), sy = Math.floor(rnd() * 42) + 2;
      px(sx, sy, 1, 1, rnd() < 0.3 ? '#ffffff' : '#aeb8e8');
    }
    /* 2. 冷月（右上）：双层光晕 + 冷白月体 + 暗斑 + 一抹斜云 */
    disc(123, 21, 19, '#8f86d8', 0.10);
    disc(123, 21, 15, '#b9b6ef', 0.14);
    disc(123, 21, 10, '#e9ecff');
    disc(120, 19, 2, '#b6bce4', 0.8);
    disc(126, 23, 1.6, '#c3c8ec', 0.8);
    disc(124, 18, 1.2, '#c3c8ec', 0.7);
    c.globalAlpha = 0.5; px(108, 16, 30, 1, '#4c3f78'); px(112, 17, 24, 1, '#57497f'); c.globalAlpha = 1;

    /* 3. 三层锯齿山脊（远 → 近，色相逐层加深） */
    const makeRidge = (base, amp, ph, rough) => {
      const arr = [];
      for (let x = 0; x <= W; x++) {
        const y = base + Math.sin(x * 0.045 + ph) * amp + Math.sin(x * 0.13 + ph * 2) * amp * 0.5
                + Math.sin(x * 0.3) * 2 + (rnd() - 0.5) * rough;
        arr.push(Math.max(38, Math.min(100, y)));
      }
      return arr;
    };
    const fillRidge = (arr, bottom, col) => {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(0, bottom);
      for (let x = 0; x <= W; x++) c.lineTo(x, arr[x]);
      c.lineTo(W, bottom); c.closePath(); c.fill();
    };
    const far = makeRidge(60, 8, 1.7, 2);
    const mid = makeRidge(72, 10, 0.4, 2.5);
    const near = makeRidge(88, 9, 2.6, 3);
    fillRidge(far, 102, '#463a6e');
    // 山间雾带（一）
    for (let i = 0; i < 16; i++) {
      c.globalAlpha = 0.07 + rnd() * 0.10;
      px(rnd() * W, 62 + rnd() * 5, 10 + rnd() * 22, 1, '#b9aee6');
    }
    c.globalAlpha = 1;
    fillRidge(mid, 102, '#2a2350');
    // 山间雾带（二）
    for (let i = 0; i < 18; i++) {
      c.globalAlpha = 0.08 + rnd() * 0.12;
      px(rnd() * W, 78 + rnd() * 6, 10 + rnd() * 26, 1, '#cfc6f2');
    }
    c.globalAlpha = 1;
    fillRidge(near, 102, '#0d0a1e');
    // 近山脊顶部一道冷紫轮廓光（忍者黑块压在这条线上）
    for (let x = 0; x <= W; x += 2) px(x, near[x], 2, 1, '#2c2152');

    /* 4. 忍者：沿近山脊排列的抽象简影——黑块 + 一线刀光，偶现红眼 */
    const ninja = (fx0, fy0, dir, redEye) => {
      const fx = Math.round(fx0), fy = Math.round(fy0);
      const P = (dx, dy, w, h, col) => {
        c.fillStyle = col;
        for (let xi = 0; xi < w; xi++) for (let yi = 0; yi < h; yi++) {
          c.fillRect(dir > 0 ? fx + dx + xi : fx + (6 - dx - xi), fy + dy + yi, 1, 1);
        }
      };
      P(2, -6, 2, 2, '#04030c');                                   // 头
      P(1, -4, 4, 1, '#060510'); P(0, -3, 6, 2, '#05040d');        // 蹲躯
      P(0, -1, 2, 1, '#04030c'); P(4, -1, 2, 1, '#04030c');        // 蹲腿
      // 刀：仅一线冷青寒光斜指出去
      P(6, -5, 1, 1, '#aee0ff'); P(7, -6, 1, 1, '#aee0ff'); P(8, -8, 1, 2, '#d7f2ff');
      if (redEye) P(3, -6, 1, 1, '#ff5a4d');                       // 零星红眼
    };
    for (let i = 0; i < 24; i++) {
      let x = 3 + i * 6.5 + (rnd() - 0.5) * 2.5;
      x = Math.max(2, Math.min(W - 11, x));
      const yi = near[Math.round(x)];
      const uphill = (i % 5 === 2) ? 7 : 0;
      ninja(x, yi - uphill, i % 2 ? 1 : -1, rnd() < 0.22);
    }

    /* 5. 前景沼泽：深蓝紫水面 + 碎月倒影 + 横向波纹 */
    for (let y = 102; y < H; y++) {
      const t = (y - 102) / (H - 102);
      px(0, y, W, 1, mix('#0a0e28', '#05060f', t));
    }
    // 碎月倒影（随波横向错开的冷白像素）
    for (let y = 104; y < 119; y += 2) {
      const w = 2 + Math.floor(rnd() * 3);
      const ox = Math.round(Math.sin(y * 0.9) * 3 + (rnd() - 0.5) * 3);
      c.globalAlpha = 0.25 + rnd() * 0.3;
      px(123 - (w >> 1) + ox, y, w, 1, '#aebbe8');
    }
    c.globalAlpha = 1;
    // 三组错相波纹（蓝紫冷色虚线）
    const waveCols = ['#33488f', '#556bb8', '#8498d6'];
    [106, 111, 116].forEach((y, ri2) => {
      c.fillStyle = waveCols[ri2];
      for (let x = (ri2 * 5) % 9; x < W; x += 10) c.fillRect(x, y, 6, 1);
    });
    /* 6. 左下角沼泽芦苇剪影（暗示观测点在沼泽边缘） */
    for (let i = 0; i < 7; i++) {
      const rx = 2 + i * 4 + Math.floor(rnd() * 2);
      const rh = 6 + Math.floor(rnd() * 9);
      px(rx, 120 - rh, 1, rh, '#070612');
      px(rx - 1, 120 - rh, 1, 1, '#1d1740');
    }
  }

  /* ---------- 道具图标（36×36 像素） ---------- */
  function drawItemIcon(kind, cv) {
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, 36, 36);
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    if (kind === 'star') {
      // 粉红幸运星
      const drawStar = (R, r, col) => {
        c.fillStyle = col;
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (Math.PI / 5) * i;
          const rr = i % 2 === 0 ? R : r;
          c.lineTo(18 + Math.cos(a) * rr, 18 + Math.sin(a) * rr);
        }
        c.closePath(); c.fill();
      };
      drawStar(16, 7, '#c02f72'); drawStar(14.5, 6.2, '#ff6fb0'); drawStar(11, 4.6, '#ff9ecb');
      px(13, 11, 3, 3, '#ffd6e8');
    } else if (kind === 'clover') {
      // 四叶草
      c.strokeStyle = '#1f7a33'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(18, 22); c.quadraticCurveTo(17, 28, 14, 31); c.stroke();
      const leaf = (cx, cy, a) => {
        c.save(); c.translate(cx, cy); c.rotate(a);
        c.fillStyle = '#1f7a33';
        c.beginPath(); c.ellipse(0, 0, 6.6, 7.4, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3fbf57';
        c.beginPath(); c.ellipse(0.6, -0.6, 5.4, 6, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      };
      leaf(13, 14, -0.5); leaf(23, 14, 0.5); leaf(13, 23, 0.5); leaf(23, 23, -0.5);
      px(17, 17, 2, 2, '#b9f5c8');
    } else if (kind === 'coin') {
      // 古钱币（金铜色，方孔）
      c.fillStyle = '#7a4a08'; c.beginPath(); c.arc(18, 18, 16, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d9a53b'; c.beginPath(); c.arc(18, 18, 14.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f0c75e'; c.beginPath(); c.arc(15, 15, 10, 0, Math.PI * 2); c.fill();
      px(13, 13, 10, 10, '#7a4a08');
      px(15, 15, 6, 6, '#3d2404');
      px(8, 8, 4, 2, '#f7dd8e');
    } else if (kind === 'ticket') {
      // 委托券
      px(2, 9, 32, 19, '#2c237a');
      px(3, 10, 30, 17, '#5b4bd8');
      px(3, 10, 30, 3, '#8a7bff');
      // 齿孔
      for (let y = 12; y < 27; y += 5) { px(2, y, 2, 2, '#0b1020'); px(32, y, 2, 2, '#0b1020'); }
      const drawStar = (cx, cy, R, r) => {
        c.fillStyle = '#ffd23b';
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (Math.PI / 5) * i;
          const rr = i % 2 === 0 ? R : r;
          c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        c.closePath(); c.fill();
      };
      drawStar(18, 18.5, 6, 2.6);
    }
  }
  function makeIconCanvas(kind, size) {
    const cv = document.createElement('canvas');
    cv.width = 36; cv.height = 36;
    cv.style.width = (size || 44) + 'px';
    cv.style.height = (size || 44) + 'px';
    drawItemIcon(kind, cv);
    return cv;
  }
  function makeStatueCanvas(stage, w, h, t) {
    const cv = document.createElement('canvas');
    cv.width = 220; cv.height = 262;
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    drawStatue(cv, stage, t == null ? Math.random() * 10 : t);
    return cv;
  }

  /* ============================================================
   * 面板 DOM
   * ============================================================ */
  let built = false;
  let panelEl, bodyEl, tabBtns;
  let views = {};
  let rafId = null, t0 = 0;
  let curTab = 'coll';

  function $(id) { return document.getElementById(id); }

  function buildPanel() {
    panelEl = $('wh-panel');
    if (!panelEl) return;
    bodyEl = $('wh-body');
    views = {
      collList: $('wh-coll-list'), collDetail: $('wh-coll-detail'),
      docList: $('wh-doc-list'), docReader: $('wh-doc-reader'),
      itemList: $('wh-item-list')
    };
    tabBtns = Array.prototype.slice.call(panelEl.querySelectorAll('.wh-tab'));
    tabBtns.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    const back = $('wh-back-btn');
    if (back) back.addEventListener('click', closePanel);
    const cdBack = $('wh-cd-back');
    if (cdBack) cdBack.addEventListener('click', () => showView('collList'));
    const drBack = $('wh-dr-back');
    if (drBack) drBack.addEventListener('click', () => { markRead(null); showView('docList'); renderDocList(); });
    const invest = $('wh-invest-btn');
    if (invest) invest.addEventListener('click', () => doInvest());
    built = true;
  }

  function openPanel(tab) {
    if (!built) buildPanel();
    if (!panelEl) return;
    switchTab(tab || 'coll');
    panelEl.classList.remove('hidden');
    t0 = performance.now();
    startRaf();
    try { if (window.SFX && SFX.pick) SFX.pick(); } catch (e) {}
  }
  function closePanel() {
    if (panelEl) panelEl.classList.add('hidden');
    stopRaf();
    try { if (window.SFX && SFX.hit) SFX.hit(); } catch (e) {}
  }

  function switchTab(tab) {
    curTab = tab;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'coll') { renderCollList(); showView('collList'); }
    else if (tab === 'doc') { renderDocList(); showView('docList'); }
    else { renderItemList(); showView('itemList'); }
  }
  function showView(name) {
    Object.keys(views).forEach(k => views[k].classList.toggle('hidden', k !== name));
  }

  /* ---------- 藏品列表（20 槽位） ---------- */
  function renderCollList() {
    const el = views.collList;
    el.innerHTML = '';
    for (let i = 0; i < COLL_SLOTS; i++) {
      const def = COLLS[i];
      const card = document.createElement('div');
      if (def) {
        const prog = collProgress(def.id);
        const st = stageIndex(prog);
        card.className = 'wh-card wh-coll-card' + (prog >= 100 ? ' done' : '');
        const icon = document.createElement('div');
        icon.className = 'wh-coll-icon';
        icon.appendChild(makeStatueCanvas(st, 76, 90));
        const info = document.createElement('div');
        info.className = 'wh-card-info';
        info.innerHTML =
          `<div class="wh-card-name">${def.name}${prog >= 100 ? ' <span class="wh-badge-done">圆满</span>' : ''}</div>` +
          `<div class="wh-prog-row"><div class="wh-prog-outer"><div class="wh-prog-inner" style="width:${prog}%"></div></div>` +
          `<span class="wh-prog-txt">${prog}%</span></div>` +
          `<div class="wh-card-meta">来源：${def.source}</div>` +
          `<div class="wh-card-meta">发现者：${def.finder}</div>`;
        card.appendChild(icon);
        card.appendChild(info);
        card.addEventListener('click', () => openCollDetail(def.id));
      } else {
        card.className = 'wh-card wh-coll-card locked';
        card.innerHTML =
          `<div class="wh-coll-icon">🔒</div>` +
          `<div class="wh-card-info"><div class="wh-card-name">未发现藏品</div>` +
          `<div class="wh-card-meta">？？？　进度 --%</div>` +
          `<div class="wh-card-meta">来源：未知</div><div class="wh-card-meta">发现者：--</div></div>`;
      }
      el.appendChild(card);
    }
  }

  /* ---------- 藏品详情：大雕像 + 信息 + 投币 ---------- */
  function openCollDetail(id) {
    const def = COLL_MAP[id];
    if (!def) return;
    $('wh-cd-name').textContent = def.name;
    $('wh-cd-desc').textContent = def.desc;
    $('wh-cd-source').textContent = def.source;
    $('wh-cd-finder').textContent = def.finder;
    $('wh-cd-reward').textContent = def.reward;
    renderCollDetail();
    showView('collDetail');
    try { if (window.SFX && SFX.pick) SFX.pick(); } catch (e) {}
  }

  function renderCollDetail() {
    const def = COLLS[0];
    const prog = collProgress(def.id);
    const st = stageIndex(prog);
    // 大雕像（占据屏幕较大区域，300×357）
    const icon = $('wh-cd-canvas-box');
    if (icon) {
      icon.innerHTML = '';
      const cv = document.createElement('canvas');
      cv.id = 'wh-statue-cv';
      cv.width = 220; cv.height = 262;
      icon.appendChild(cv);
      drawStatue(cv, st, (performance.now() - t0) / 1000);
    }
    $('wh-cd-prog-txt').textContent = `完成度 ${prog}%（${prog / 20}/5 枚古钱币）`;
    const bar = $('wh-cd-prog-inner');
    if (bar) bar.style.width = prog + '%';
    // 投币按钮
    const btn = $('wh-invest-btn');
    const coins = itemCount('coin');
    if (prog >= 100) {
      btn.textContent = '✓ 已圆满 · 魅影已加入角色选择';
      btn.disabled = true;
      btn.className = 'wh-invest-btn done';
    } else if (coins <= 0) {
      btn.textContent = '🪙 古钱币不足（去战斗/委托中获取）';
      btn.disabled = true;
      btn.className = 'wh-invest-btn';
    } else {
      btn.textContent = `🪙 投入古钱币（持有 ${coins}）· 完成度 +20%`;
      btn.disabled = false;
      btn.className = 'wh-invest-btn can';
    }
  }

  function doInvest() {
    const wasDone = collProgress('caishen') >= 100;
    const ok = investCoin('caishen');
    if (!ok) return;
    const nowDone = collProgress('caishen') >= 100;
    renderCollDetail();
    renderCollList();
    try {
      if (!wasDone && nowDone) { if (window.SFX && SFX.unlock) SFX.unlock(); }
      else if (window.SFX && SFX.levelup) SFX.levelup();
    } catch (e) {}
  }

  /* ---------- 文书列表（20 槽位） ---------- */
  function renderDocList() {
    const el = views.docList;
    el.innerHTML = '';
    for (let i = 0; i < DOC_SLOTS; i++) {
      const def = DOCS[i];
      const card = document.createElement('div');
      if (def) {
        const read = isRead(def.id);
        card.className = 'wh-card wh-doc-card' + (read ? ' read' : ' unread');
        card.innerHTML =
          `<div class="wh-doc-icon">${read ? '📖' : '📜'}</div>` +
          `<div class="wh-card-info">` +
          `<div class="wh-card-name">${def.title}</div>` +
          `<div class="wh-card-meta">作者：${def.author}</div></div>` +
          `<div class="wh-doc-state">${read ? '已读' : '<span class="wh-dot"></span>未读'}</div>`;
        card.addEventListener('click', () => openReader(def.id));
      } else {
        card.className = 'wh-card wh-doc-card locked';
        card.innerHTML =
          `<div class="wh-doc-icon">🔒</div>` +
          `<div class="wh-card-info"><div class="wh-card-name">未发现文书</div>` +
          `<div class="wh-card-meta">作者：--</div></div><div class="wh-doc-state">--</div>`;
      }
      el.appendChild(card);
    }
  }

  /* ---------- 文书阅读器（插图 4:3 + 正文） ---------- */
  let readingDoc = null;
  function openReader(id) {
    const def = DOC_MAP[id];
    if (!def) return;
    readingDoc = id;
    $('wh-dr-title').textContent = def.title;
    $('wh-dr-author').textContent = '作者：' + def.author;
    const art = $('wh-dr-art');
    if (art) {
      art.innerHTML = '';
      if (def.art === 'ninjas') {
        const cv = document.createElement('canvas');
        cv.width = 160; cv.height = 120;
        drawNinjaScene(cv);
        art.appendChild(cv);
      }
    }
    const txt = $('wh-dr-text');
    if (txt) {
      txt.innerHTML = '';
      def.paras.forEach(p => {
        const d = document.createElement('p');
        d.className = 'wh-dr-p';
        d.textContent = p;
        txt.appendChild(d);
      });
    }
    markRead(id);
    showView('docReader');
    try { if (window.SFX && SFX.pick) SFX.pick(); } catch (e) {}
  }

  /* ---------- 道具列表 ---------- */
  function renderItemList() {
    const el = views.itemList;
    el.innerHTML = '';
    ITEMS.forEach(def => {
      const n = itemCount(def.id);
      const card = document.createElement('div');
      card.className = 'wh-card wh-item-card';
      const icon = document.createElement('div');
      icon.className = 'wh-item-icon';
      icon.appendChild(makeIconCanvas(def.icon, 52));
      const cnt = document.createElement('div');
      cnt.className = 'wh-item-count';
      cnt.textContent = '×' + n;
      icon.appendChild(cnt);
      const info = document.createElement('div');
      info.className = 'wh-card-info';
      info.innerHTML =
        `<div class="wh-card-name">${def.name}</div>` +
        `<div class="wh-card-desc">${def.desc}</div>` +
        `<div class="wh-item-note">${def.note}</div>`;
      card.appendChild(icon);
      card.appendChild(info);
      if (def.usable) {
        const btn = document.createElement('button');
        btn.className = 'wh-item-use';
        btn.textContent = '去供奉';
        btn.addEventListener('click', () => {
          switchTab('coll');
          openCollDetail(def.usable);
        });
        card.appendChild(btn);
      }
      el.appendChild(card);
    });
  }

  /* ---------- 动画循环：详情雕像声波/辉光 ---------- */
  function startRaf() {
    stopRaf();
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (!panelEl || panelEl.classList.contains('hidden')) return;
      if (!views.collDetail.classList.contains('hidden')) {
        const cv = $('wh-statue-cv');
        if (cv) {
          const prog = collProgress('caishen');
          drawStatue(cv, stageIndex(prog), (performance.now() - t0) / 1000);
        }
      }
    };
    rafId = requestAnimationFrame(loop);
  }
  function stopRaf() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* ---------------- 导出 ---------------- */
  window.WH = {
    openPanel, closePanel,
    collProgress, itemCount, addItem, removeItem,
    isRead, isCharUnlocked, unlockChar, onUnlock,
    investCoin,
    COLLS, DOCS, ITEMS,
    drawStatue, drawNinjaScene, drawItemIcon
  };
})();
