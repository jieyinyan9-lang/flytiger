/* ============================================================
 * sprites.js —— 16bit 像素点阵精灵
 * 所有精灵均朝向右绘制；敌人绘制时水平翻转。
 * ============================================================ */
(function () {
  'use strict';

  /** 根据字符画数组构建离屏 canvas（自动补齐行宽） */
  function build(rows, pal) {
    const h = rows.length;
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const c = row[x];
        if (c === '.' || c === ' ') continue;
        const col = pal[c];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return cv;
  }

  /** 水平翻转 */
  function flip(cv) {
    const c = document.createElement('canvas');
    c.width = cv.width; c.height = cv.height;
    const ctx = c.getContext('2d');
    ctx.translate(cv.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(cv, 0, 0);
    return c;
  }

  /* ---------------- 飞虎（玩家，程序化像素绘制，严格参考白翅飞虎） ----------------
   * 朝右飞扑：白色飞羽(灰羽影)在背上方，橙虎身白腹黑纹，
   * 右侧虎头白鬃怒吼张口，条纹尾在左，白爪。 */
  const TCOL = {
    K: '#17110a',  // 黑轮廓/纹/瞳孔
    O: '#f59e0b',  // 橙毛
    o: '#d97706',  // 深橙
    W: '#f7f7f2',  // 白羽/鬃/腹/爪/牙
    g: '#a7b3c2',  // 浅灰羽影
    G: '#7d8794',  // 深灰
    R: '#e53935',  // 红口
    P: '#5c1414',  // 暗口腔
    Y: '#ffe066'   // 眼
  };

  /** 程序化绘制飞虎（frame: 0 翅膀上扬 / 1 翅膀下扇），返回 64×38 canvas */
  function buildTiger(frame) {
    const W = 64, H = 38;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const C = TCOL;
    const wing = frame === 0 ? 0 : 4;   // 下扇时翅膀整体下移

    /* ---- 条纹尾巴（最左） ---- */
    px(1, 22, 15, 4, C.K);
    px(2, 22, 13, 2, C.O);
    px(2, 24, 13, 1, C.o);
    px(5, 22, 2, 4, C.K);
    px(9, 22, 2, 4, C.K);
    px(12, 22, 2, 4, C.K);
    px(0, 23, 2, 2, C.O);             // 尾尖

    /* ---- 白色翅膀（背部上方，羽毛层叠朝左） ---- */
    const feathers = [
      { y: 19, x: 7, len: 33 },
      { y: 16, x: 10, len: 30 },
      { y: 13, x: 14, len: 26 },
      { y: 10, x: 18, len: 22 },
      { y: 7,  x: 22, len: 18 }
    ];
    feathers.forEach(f => {
      const y = f.y + wing;
      px(f.x - 1, y - 1, f.len + 2, 5, C.K);        // 黑边
      px(f.x, y, f.len, 3, C.W);                     // 白羽
      px(f.x + 3, y + 2, f.len - 8, 1, C.g);         // 灰羽影
      px(f.x, y, 2, 3, C.K);                         // 羽尖黑
    });
    px(32, 13 + wing, 8, 9, C.G);                    // 翼根灰

    /* ---- 身体（橙背白腹） ---- */
    px(14, 18, 32, 13, C.K);        // 轮廓
    px(15, 19, 30, 7, C.O);         // 橙背
    px(15, 26, 30, 4, C.W);         // 白腹
    px(15, 29, 30, 1, C.o);
    // 黑纹
    px(21, 19, 2, 7, C.K);
    px(27, 19, 2, 8, C.K);
    px(33, 19, 2, 7, C.K);
    px(39, 20, 2, 6, C.K);

    /* ---- 后腿（左下方） ---- */
    px(17, 29, 8, 7, C.K);
    px(18, 29, 6, 4, C.O);
    px(17, 32, 8, 3, C.W);          // 白爪
    px(18, 35, 2, 2, C.K);
    px(22, 35, 2, 2, C.K);

    /* ---- 头部（右侧） ---- */
    // 白色鬃毛（头顶/颈背，锯齿簇）
    const mane = [[38, 10], [41, 8], [44, 7], [47, 7], [50, 9], [53, 11]];
    mane.forEach(m => { px(m[0] - 1, m[1] - 1, 4, 7, C.K); px(m[0], m[1], 3, 5, C.W); });
    // 脸
    px(43, 13, 19, 14, C.K);        // 轮廓
    px(44, 14, 17, 8, C.O);         // 橙脸
    px(44, 21, 17, 5, C.W);         // 白颊/嘴周
    // 眼
    px(49, 13, 4, 3, C.K);
    px(50, 13, 2, 2, C.Y);
    // 鼻
    px(59, 15, 3, 2, C.K);
    // 怒吼张口（右前）
    px(52, 18, 11, 10, C.K);
    px(53, 19, 9, 8, C.P);
    px(54, 19, 7, 4, C.R);
    // 牙
    px(54, 18, 2, 3, C.W);
    px(58, 18, 2, 3, C.W);
    px(55, 26, 2, 2, C.W);
    px(59, 26, 2, 2, C.W);

    /* ---- 前腿 / 前爪（向前伸出） ---- */
    px(47, 26, 15, 7, C.K);
    px(48, 26, 11, 4, C.O);
    px(57, 26, 6, 6, C.W);          // 白爪
    px(58, 31, 2, 2, C.K);
    px(61, 31, 2, 2, C.K);

    return cv;
  }


  /* ---------------- 飞鹰（程序化像素，粗描边扁平风） ---------------- */
  const EAGLE_PAL = {
    K: '#17110a',  // 描边
    dk: '#5b3a1e', // 翼/尾 深褐
    bd: '#8a5a2b', // 褐身
    hd: '#f4f1e8', // 白头
    bk: '#ffc02e'  // 黄喙
  };
  const SWORD_EAGLE_PAL = {
    K: '#0d1018',
    dk: '#5f6b7e',
    bd: '#97a2b4',
    hd: '#eef3fa',
    bk: '#ffd93b'
  };

  /** 程序化绘制飞鹰（frame: 0 展翅上扬 / 1 下扇），面朝右，28×20 */
  function buildEagle(frame, pal) {
    const cv = document.createElement('canvas');
    cv.width = 28; cv.height = 20;
    const c = cv.getContext('2d');
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const C = pal;

    // 尾扇（左侧）
    px(1, 9, 10, 4, C.K);
    px(2, 9, 8, 2, C.dk);
    px(2, 11, 8, 1, C.bd);
    px(1, 8, 2, 1, C.K); px(1, 13, 2, 1, C.K);  // 尾尖缺口

    // 身体
    px(8, 8, 12, 8, C.K);
    px(9, 9, 10, 5, C.bd);
    px(9, 14, 10, 1, C.dk);

    // 翅膀（两层：先画翼再让身体压住翼根）
    const bars = frame === 0
      ? [{ x: 14, y: 8 }, { x: 11, y: 5 }, { x: 8, y: 2 }, { x: 5, y: 0 }]    // 上扬
      : [{ x: 14, y: 10 }, { x: 11, y: 13 }, { x: 8, y: 16 }];                 // 下扇
    bars.forEach(b => {
      px(b.x, b.y, 9, 4, C.K);
      px(b.x + 1, b.y + 1, 7, 2, C.dk);
      px(b.x, b.y + 1, 2, 2, C.K);   // 羽尖
    });

    // 头（右侧白色）
    px(17, 4, 9, 8, C.K);
    px(18, 5, 7, 6, C.hd);
    // 钩喙
    px(25, 8, 3, 3, C.K);
    px(26, 8, 2, 2, C.bk);
    px(27, 10, 1, 1, C.bk);
    // 眼
    px(22, 6, 2, 2, C.K);

    return cv;
  }


  /* ---------------- 飞天恶魔 ---------------- */
  const DEMON_PAL = {
    R: '#e0453a',  // 红角
    P: '#7a3fc9',  // 紫身
    p: '#5a2a9e',
    v: '#4a2380',  // 翼膜
    W: '#ffffff',
    K: '#180a28'
  };
  const DEMON_A = [
    'v..R......R..v',
    'vv..R....R..vv',
    'vvv.PPPPPPPP.vvv',
    'vvvPPPPPPPPPPvvv',
    '.vvPPPWPPPWPPPvv',
    '..vPPPKPPPKPPPv',
    '...PPPPKKPPPP',
    '...PPPKWWKPPP',
    '....PPPPPPPP',
    '...pPPPPPPPPp',
    '...pPPPPPPPPp',
    '....pPPPPPPp',
    '.....pPPPPp',
    '......pPPp',
    '.......pp'
  ];
  const DEMON_B = [
    '',
    '..R......R..',
    '...R....R...',
    '..PPPPPPPPPP..v',
    '.PPPPPPPPPPPP.vv',
    '.PPPWPPPWPPPvvvv',
    '.PPPKPPPKPPPvvvv',
    '..PPPPKKPPPP.vv',
    '..PPPKWWKPPP..v',
    '...pPPPPPPp',
    '...pPPPPPPp',
    '....pPPPPp',
    '.....pPPp',
    '......pp',
    ''
  ];

  /* ---------------- 蝙蝠 ---------------- */
  const BAT_PAL = {
    B: '#4a3566',
    m: '#2b1f3d',
    W: '#ff5d73',
    K: '#0d0818'
  };
  const BAT_A = [
    'B............B',
    'BB..........BB',
    'BBB........BBB',
    'BBBB......BBBB',
    'BBBBB....BBBBB',
    '.BBBBB..BBBBB',
    '..BBBBBBBBBB',
    '...BBBmmBBB',
    '....mWWWWm',
    '.....mKKm',
    '......mm'
  ];
  const BAT_B = [
    '',
    '.....mm',
    '....mWWm',
    'BBB.mKKm..BBB',
    'BBBBBmm.BBBB',
    '.BBBBBBBBBB',
    '..BBBBBBBBB',
    '...BBBBBBB',
    '....BBBBB',
    '.....BBB',
    '......B'
  ];

  /* ---------------- 雷公 ---------------- */
  const LEI_PAL = {
    Y: '#ffd23b',  // 黄（鼓/装饰/电）
    W: '#f4f1e8',  // 白脸
    J: '#ff9d2e',  // 喙
    K: '#101828',
    B: '#2f6fd0',  // 蓝身
    b: '#1e4d92',
    L: '#ffe066'   // 闪电
  };
  const LEIGONG = [
    '.......YYYY',
    '......YWWWWY',
    '.....WWWWWWWW',
    '....WWKKWWKKWW',
    '....WWWWJJWWWW',
    '.....WWWWWWWW...L',
    '....BBBBBBBBBB..LL',
    'Y..BBBBBBBBBBBB.LLL',
    'YK.BBBBBBBBBBBB.LLL',
    'YK.BBBBBBBBBBBB..L',
    'Y..BBbBBBBbBBBB',
    '...BBbBBBBbBBBB',
    '..YBBBBBBBBBBY',
    '..YKBBBBBBBBKY',
    '...YBBBBBBBBY',
    '....BBbBBbBB',
    '.....BBBBBB',
    '......BBBB',
    '.......BB',
    '........b'
  ];

  /* ---------------- 火焰飞猪 ---------------- */
  const PIG_PAL = {
    P: '#f4726b',
    p: '#c94a44',
    J: '#ffb3a8',
    K: '#5c1f1c',
    F: '#ff7b2e',
    L: '#ffd23b',
    v: '#a83a5a',
    W: '#ffffff'
  };
  const PIG = [
    '......FFF',
    '.....FLFLF',
    '....FLLLLLF....v',
    '...PPPPPPPPPP..vv',
    '..PPPPPPPPPPPPvvv',
    '..vPPKKPPKKPPv.v',
    '.vvPPPPPPPPPPvv',
    '...PPPPPPPPPPPP',
    '...PPPPPPPPPPPPP',
    '...pPPPPPPPPPPJ',
    '...pPPPPPPPPJJJJ',
    '....pPPPPPPPJJKKJ',
    '.....pPPPPPPPPJJJ',
    '......pPPPPPPp',
    '.......pPPPPp',
    '........ppp'
  ];

  /* ---------------- 小弓箭手（地面敌人） ---------------- */
  const ARCHER_PAL = {
    K: '#17110a',
    Y: '#e0b13c',  // 草帽
    y: '#b8892a',
    S: '#f2c9a0',  // 皮肤
    G: '#4f9e44',  // 绿衣
    g: '#3c7d34',
    L: '#6b4a2a',  // 裹腿
    B: '#8a5a2b',  // 弓
    W: '#f7f7f2'   // 弓弦
  };
  const ARCHER = [
    '......KK',
    '.....KYYK',
    '....KYYYYK',
    '...KYYYYYYK....B',
    '....KSSSK.....B',
    '....KSKSK.....B',
    '...KKKKKK....B',
    '..GGGGGGGK..B',
    '.GGGGGGGGK.WB',
    '.gGGGGGGg.WB',
    '..GGGGGG..B',
    '..GG..GG..B',
    '..LL..LL.B',
    '.LLL..LLL.B',
    '.KKK..KKK'
  ];

  /* ---------------- 自爆骷髅（白骨骷髅 + 胸口红色爆核） ---------------- */
  const SKEL_PAL = {
    K: '#101018',  // 骨描边/眼洞/颌
    W: '#e8eef7',  // 白骨
    R: '#e0453a',  // 爆核红
    F: '#ffd23b'   // 爆核炽心
  };
  const SKEL = [
    '.....KKKK.....',
    '....KWWWWK....',
    '...KWWWWWWK...',
    '...KWKWWWKWK..',
    '...KWWWKWWWK..',
    '....KWWWWWK...',
    '....KKKKKK....',
    '...KWRRRRWK...',
    '..KWRFFFFRWK..',
    '..KWRFFFFRWK..',
    '...KWRRRRWK...',
    '....KWWWWK....',
    '....KW..WK....',
    '...KKK..KKK...'
  ];

  /* ---------------- 飞天日本武士 ---------------- */
  const SAMURAI_PAL = {
    G: '#ffd23b',  // 金角
    g: '#7d8794',  // 盔灰
    K: '#0d1018',
    R: '#c0392b',  // 红面甲
    W: '#f4f1e8',
    D: '#2c3545',  // 铠甲
    s: '#5a6678',  // 肩甲
    d: '#1d2431',
    S: '#9aa7bb'
  };
  const SAMURAI = [
    '..G..........G',
    '..GG........GG',
    '...GG......GG',
    '....GGggggGG',
    '...gggggggggg',
    '..gggggggggggg',
    '..ggKggggggKgg',
    '...RRRRRRRRRR',
    '...RKWWKKWWKR',
    '...RRRRRRRRRR',
    '....DDDDDDDD',
    '..s.DDDDDDDD.s',
    '.sssDDDRRRDDDsss',
    '.ss.DDDRRRRDD.ss',
    '..s.DDDRRRRDD.s',
    '....DDDDDDDDD',
    '....DDD..DDD',
    '....DD....DD',
    '....dd....dd',
    '....dd....dd',
    '...SSS....SSS',
    '................'
  ];

  const Sprites = {
    cat: null,   // 白猫主角：assets/cat.png 原图（异步加载）
    eagleA: buildEagle(0, EAGLE_PAL),
    eagleB: buildEagle(1, EAGLE_PAL),
    demonA: build(DEMON_A, DEMON_PAL),
    demonB: build(DEMON_B, DEMON_PAL),
    batA: build(BAT_A, BAT_PAL),
    batB: build(BAT_B, BAT_PAL),
    leigong: build(LEIGONG, LEI_PAL),
    pig: build(PIG, PIG_PAL),
    archer: build(ARCHER, ARCHER_PAL),
    skeleton: build(SKEL, SKEL_PAL),
    samurai: build(SAMURAI, SAMURAI_PAL),
    swordEagleA: buildEagle(0, SWORD_EAGLE_PAL),
    swordEagleB: buildEagle(1, SWORD_EAGLE_PAL),
  };

  // 敌人统一朝向：翻转成朝左
  Sprites.eagleAL = flip(Sprites.eagleA);
  Sprites.eagleBL = flip(Sprites.eagleB);
  Sprites.demonAL = flip(Sprites.demonA);
  Sprites.demonBL = flip(Sprites.demonB);
  Sprites.batAL = flip(Sprites.batA);
  Sprites.batBL = flip(Sprites.batB);
  Sprites.leigongL = flip(Sprites.leigong);
  Sprites.pigL = flip(Sprites.pig);
  Sprites.archerL = flip(Sprites.archer);
  Sprites.skeletonL = flip(Sprites.skeleton);
  Sprites.samuraiL = flip(Sprites.samurai);
  Sprites.swordEagleAL = flip(Sprites.swordEagleA);
  Sprites.swordEagleBL = flip(Sprites.swordEagleB);

  // 白猫主角：直接加载原图文件渲染（保证与素材 100% 一致）
  Sprites.whenReady = new Promise(resolve => {
    const im = new Image();
    im.onload = () => { Sprites.cat = im; resolve(im); };
    im.onerror = () => { console.warn('[Sprites] 未找到 assets/cat.png，白猫素材缺失'); resolve(null); };
    im.src = 'assets/cat.png';
  });

  window.Sprites = Sprites;
})();
