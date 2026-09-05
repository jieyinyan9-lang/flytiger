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

  /* ---------------- 黑骷髅头（自爆骷髅新模型：黑色头骨，红眼） ---------------- */
  const BLACK_SKEL_PAL = {
    K: '#000000',  // 纯黑骨
    D: '#1a1a22',  // 暗部
    R: '#ff3b3b',  // 爆核红
    F: '#ffd23b'   // 爆核炽心
  };
  const BLACK_SKEL = [
    '......KKKK......',
    '.....KDDDDK.....',
    '....KDDDDDDK....',
    '...KDDDDDDDDK...',
    '...KDKKDDKKDK...',
    '...KDRRDDRRDK...',
    '...KDDDDDDDDK...',
    '...KKKDDDDKKK...',
    '....KKDDDDKK....',
    '...KDDRRRRDDK...',
    '..KDDRFFFFRDDK..',
    '..KDDRRRRRRDDK..',
    '...KDDRRRRDDK...',
    '....KDDDDDDK....',
    '....KD....DK....',
    '...KKK....KKK...'
  ];

  /* ---------------- 飞天骷髅头（持续旋转的攻击头骨） ---------------- */
  const SKULLHEAD_PAL = {
    K: '#101018',
    W: '#e8eef7',
    R: '#ff3b5c',  // 眼窝红光
    r: '#8b1e3c'
  };
  const SKULLHEAD = [
    '.....KKKKKK.....',
    '...KKWWWWWWKK...',
    '..KWWWWWWWWWWK..',
    '.KWWWWWWWWWWWWK.',
    '.KWKRRKWWKRRKWK.',
    '.KWKrRKWWKRrKWK.',
    'KWWWWWWWWWWWWWWK',
    'KWWWKKWWWWKKWWWK',
    'KWWWWWWWWWWWWWWK',
    '.KWWKWWKKWWKWWK.',
    '..KKKKKKKKKKKK..'
  ];

  /* ---------------- 炮师（地面炮兵，铁盔 + 右向炮管） ---------------- */
  const CAN_PAL = {
    K: '#141418',
    M: '#5a6678',  // 铁盔
    m: '#3d4654',
    S: '#f2c9a0',  // 皮肤
    C: '#2c3545',  // 深蓝炮服
    c: '#1d2431',
    W: '#cfd8e3',  // 炮管
    Y: '#8a5a2b'   // 炮架
  };
  const CANNONEER = [
    '.....KKKKK........',
    '....KMMMMMK.......',
    '...KMMMMMMMK......',
    '....KSSSSSK.......',
    '....KSKKSK........',
    '.....KSSK.........',
    '....KCCCCK........',
    '...KCCCCCCK.......',
    '...KcCCCCcKWWWWWWK',
    '...KcCCCCcKWWWWWWK',
    '...KcCCCCcKWWKWWK.',
    '....KCCCCK....KK..',
    '....KC..CK........',
    '...KKY..YKK.......',
    '..KYKY..KYKY......'
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

  /* ---------------- 飞天狗王狗头（程序化像素，面朝右） ---------------- */
  function buildDogHead() {
    const W = 34, H = 24;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const K = '#14181f', F = '#8d96a3', f = '#6f7683', Wt = '#eef2f7', R = '#ff3b3b', N = '#10141b', P = '#5c1414';
    // 竖耳（两只）
    px(4, 0, 5, 7, K); px(5, 1, 3, 5, F);
    px(13, 0, 5, 7, K); px(14, 1, 3, 5, F);
    // 头部轮廓 + 灰毛
    px(1, 5, 28, 12, K);
    px(2, 6, 26, 10, F);
    px(2, 12, 26, 4, f);                 // 下颊阴影
    px(6, 6, 2, 3, f); px(11, 6, 2, 3, f); px(16, 6, 2, 3, f);   // 额毛纹
    // 红瞳怒目
    px(20, 8, 4, 3, K); px(21, 9, 2, 2, R);
    // 白色口鼻
    px(19, 11, 13, 8, K);
    px(20, 12, 11, 5, Wt);
    px(28, 12, 3, 3, N);                 // 鼻头
    // 张开的獠牙口
    px(20, 16, 11, 7, K);
    px(21, 17, 9, 4, P);
    px(21, 17, 2, 2, Wt); px(25, 17, 2, 2, Wt); px(28, 19, 2, 2, Wt);
    return cv;
  }

  /* ---------------- 巨型野鸡（程序化像素，面朝右，长尾在左） ---------------- */
  function buildPheasant() {
    const W = 46, H = 26;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const K = '#17110a', B = '#b34a24', b = '#8f3a1c', G = '#d97706', Wt = '#f7f7f2', R = '#e0453a', Y = '#ffc02e';
    // 长尾羽（左侧后掠，4 根层叠）
    for (let i = 0; i < 4; i++) {
      const y0 = 3 + i * 4;
      px(0, y0 + 2, 14, 3, K);
      px(1, y0 + 2, 12, 2, i % 2 ? G : b);
    }
    px(13, 6, 7, 9, K);                  // 尾根
    // 躯干
    px(14, 6, 20, 13, K);
    px(15, 7, 18, 8, B);
    px(15, 13, 18, 4, b);
    // 翅膀斑纹
    px(18, 8, 9, 5, K); px(19, 9, 7, 3, G);
    px(20, 10, 4, 1, Wt);
    // 颈 + 红头
    px(32, 5, 9, 10, K);
    px(33, 6, 7, 7, R);
    px(37, 7, 2, 2, K);                  // 眼
    // 黄喙（右侧）
    px(41, 9, 4, 3, K); px(41, 9, 3, 2, Y);
    // 红肉垂
    px(38, 13, 3, 4, K); px(39, 14, 2, 3, R);
    // 双腿
    px(20, 19, 3, 5, K); px(19, 23, 5, 2, Y);
    px(27, 19, 3, 5, K); px(26, 23, 5, 2, Y);
    return cv;
  }

  /* ---------------- 小超人（少年超人，蓝战衣红披风，面朝右） ---------------- */
  function buildSuperboy() {
    const cv = document.createElement('canvas');
    cv.width = 24; cv.height = 24;
    const c = cv.getContext('2d');
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const K = '#101018', S = '#f2c9a0', B = '#2f6fd0', b = '#1e4d92',
          R = '#e0453a', Y = '#ffd23b', W = '#f7f7f2';
    // 红披风（身后左侧飘动）
    px(2, 8, 7, 3, K); px(2, 11, 6, 3, K); px(3, 14, 5, 3, K);
    px(3, 9, 5, 2, R); px(3, 12, 4, 2, R); px(4, 15, 3, 1, R);
    // 头
    px(12, 2, 9, 3, K); px(19, 1, 2, 2, K);            // 黑发 + 额前卷
    px(12, 3, 9, 8, K);
    px(13, 4, 7, 6, S);
    px(17, 5, 2, 2, K);                                // 眼
    // 身体（蓝战衣）
    px(9, 10, 11, 8, K);
    px(10, 11, 9, 5, B);
    px(13, 11, 4, 4, K); px(14, 12, 2, 2, Y);          // 胸盾
    px(10, 16, 9, 2, Y);                               // 黄腰带
    px(12, 17, 5, 2, R);                               // 红裤
    // 前冲拳（右）
    px(19, 11, 4, 4, K); px(20, 12, 3, 2, S);
    // 后拳（左）
    px(6, 12, 4, 4, K); px(7, 13, 2, 2, S);
    // 腿 + 红靴
    px(10, 18, 4, 5, K); px(11, 19, 2, 3, b); px(9, 22, 5, 2, K); px(9, 22, 5, 2, R);
    px(15, 18, 4, 5, K); px(16, 19, 2, 3, b); px(14, 22, 5, 2, K); px(14, 22, 5, 2, R);
    return cv;
  }

  /* ---------------- 祖国人（大型超人：金发蓝战衣红披风，面朝右） ---------------- */
  function buildHomelander() {
    const cv = document.createElement('canvas');
    cv.width = 30; cv.height = 32;
    const c = cv.getContext('2d');
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const K = '#101018', S = '#f2c9a0', B = '#2f6fd0', b = '#1e4d92',
          R = '#e0453a', Y = '#ffd23b', W = '#f7f7f2';
    // 大红披风
    px(3, 9, 10, 4, K); px(3, 13, 9, 4, K); px(4, 17, 8, 4, K); px(5, 21, 6, 2, K);
    px(4, 10, 8, 2, R); px(4, 14, 7, 2, R); px(5, 18, 6, 2, R); px(6, 21, 4, 1, R);
    // 金发头
    px(15, 2, 11, 3, K);
    px(15, 3, 10, 9, K);
    px(16, 4, 8, 2, Y);                                // 金发顶
    px(16, 6, 8, 5, S);                                // 脸
    px(22, 7, 2, 2, K); px(23, 7, 1, 1, R);           // 眼 + 激光红瞳
    px(20, 10, 3, 1, K);                               // 紧抿嘴
    // 身体
    px(10, 12, 14, 9, K);
    px(11, 13, 12, 6, B);
    px(15, 13, 6, 6, K); px(16, 14, 4, 4, W); px(17, 15, 2, 2, R);  // 胸盾
    px(11, 19, 12, 2, Y);                              // 腰带
    px(14, 20, 7, 2, R);                               // 红裤
    // 前拳
    px(23, 13, 5, 5, K); px(24, 14, 4, 3, S);
    // 后拳
    px(6, 14, 5, 5, K); px(7, 15, 3, 3, S);
    // 腿 + 红靴
    px(12, 21, 5, 7, K); px(13, 22, 3, 5, b); px(11, 28, 7, 3, K); px(11, 28, 7, 3, R);
    px(18, 21, 5, 7, K); px(19, 22, 3, 5, b); px(17, 28, 7, 3, K); px(17, 28, 7, 3, R);
    return cv;
  }

  /* ---------------- 大王（西装革履男子，面朝右） ---------------- */
  function buildBossMan() {
    const cv = document.createElement('canvas');
    cv.width = 30; cv.height = 38;
    const c = cv.getContext('2d');
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const K = '#0d0f16', D = '#23262f', S = '#f2c9a0',
          W = '#f4f1e8', R = '#c0392b';
    // 油头
    px(9, 1, 13, 3, K); px(9, 3, 3, 3, K); px(19, 3, 3, 3, K);
    // 脸
    px(10, 3, 11, 10, K);
    px(11, 5, 9, 7, S);
    px(12, 6, 3, 2, K); px(17, 6, 3, 2, K);            // 怒眉
    px(13, 8, 2, 2, K); px(17, 8, 2, 2, K);            // 眼
    px(14, 11, 4, 1, K);                               // 紧嘴
    // 西装身
    px(7, 12, 17, 14, K);
    px(8, 13, 15, 12, D);
    // 白衬衫 + 红领带 + 翻领
    px(13, 13, 5, 9, W);
    px(15, 13, 2, 2, R); px(15, 15, 2, 6, R);
    px(12, 13, 2, 9, K); px(17, 13, 2, 9, K);
    // 双臂（西装袖 + 白袖口 + 手）
    px(4, 13, 4, 10, K); px(5, 14, 3, 7, D); px(5, 21, 3, 2, W); px(4, 23, 4, 4, K); px(5, 23, 3, 3, S);
    px(23, 13, 4, 10, K); px(24, 14, 3, 7, D); px(24, 21, 3, 2, W); px(23, 23, 4, 4, K); px(24, 23, 3, 3, S);
    // 西裤 + 皮鞋
    px(9, 26, 6, 9, K); px(10, 27, 4, 7, D); px(8, 34, 8, 3, K);
    px(17, 26, 6, 9, K); px(18, 27, 4, 7, D); px(16, 34, 8, 3, K);
    return cv;
  }

  /* ---------------- 大王巨头（变身后，面朝右） ---------------- */
  function buildBossHead() {
    const cv = document.createElement('canvas');
    cv.width = 24; cv.height = 22;
    const c = cv.getContext('2d');
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const K = '#0d0f16', S = '#f2c9a0', W = '#f4f1e8', R = '#c0392b';
    // 油头
    px(4, 1, 17, 4, K); px(2, 4, 3, 4, K); px(20, 4, 3, 4, K);
    // 脸
    px(4, 4, 17, 15, K);
    px(5, 6, 15, 12, S);
    // 耳
    px(3, 9, 2, 4, K); px(4, 10, 1, 2, S);
    px(20, 9, 2, 4, K); px(20, 10, 1, 2, S);
    // 怒眉
    px(7, 8, 5, 2, K); px(13, 8, 5, 2, K);
    // 眼白 + 瞳
    px(8, 10, 4, 3, W); px(13, 10, 4, 3, W);
    px(9, 11, 2, 2, K); px(14, 11, 2, 2, K);
    // 鼻
    px(11, 12, 1, 3, K); px(12, 14, 3, 1, K);
    // 咬牙嘴
    px(7, 16, 11, 3, K); px(8, 16, 9, 1, W);
    // 下颌
    px(6, 18, 13, 2, S);
    return cv;
  }

  /* ---------------- 怪客（持续跳动的光头男子，面朝右） ---------------- */
  function buildStranger() {
    const cv = document.createElement('canvas');
    cv.width = 28; cv.height = 36;
    const c = cv.getContext('2d');
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const K = '#0d0f16', P = '#e6ddc8', J = '#3a4152', j = '#2a3040',
          W = '#f4f1e8', R = '#ff3b3b';
    // 光头
    px(7, 1, 14, 3, K);
    px(7, 3, 14, 13, K);
    px(8, 4, 12, 11, P);
    // 眉骨 + 怒眼（红瞳）
    px(8, 8, 12, 2, K);
    px(10, 9, 3, 2, K); px(16, 9, 3, 2, K);
    px(11, 9, 1, 1, R); px(17, 9, 1, 1, R);
    // 鼻
    px(13, 11, 2, 3, K);
    // 咧嘴牙
    px(9, 14, 11, 3, K); px(10, 14, 9, 2, W);
    px(12, 14, 1, 2, K); px(15, 14, 1, 2, K); px(18, 14, 1, 2, K);
    // 身躯（拘束衣感深夹克）
    px(6, 15, 17, 12, K);
    px(7, 16, 15, 10, J);
    px(10, 16, 3, 10, j); px(16, 16, 3, 10, j);       // 绑带
    // 大拳头
    px(2, 17, 5, 9, K); px(3, 18, 4, 6, J); px(2, 25, 6, 5, K); px(3, 26, 4, 3, P);
    px(22, 17, 5, 9, K); px(23, 18, 4, 6, J); px(21, 25, 6, 5, K); px(22, 26, 4, 3, P);
    // 腿 + 鞋
    px(9, 27, 5, 7, K); px(10, 28, 3, 5, J); px(8, 33, 7, 3, K);
    px(16, 27, 5, 7, K); px(17, 28, 3, 5, J); px(15, 33, 7, 3, K);
    return cv;
  }

  /** 程序化绘制蛙哥（巨大金绿肥硕青蛙，朝右蹲姿），返回 56×40 canvas */
  function buildFrog() {
    const W = 56, H = 40;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const F = '#8fbf3f', f = '#6b9428', L = '#c8d96a', B = '#f2edbc', K = '#1c2410', D = '#4a6618', R = '#a8402f';
    const ell = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
    // 后腿（左侧粗壮折叠大腿）
    ell(12, 27, 11, 9, f);
    ell(8, 33, 8, 5, f);
    // 脚蹼
    c.fillStyle = f; c.fillRect(2, 35, 12, 4);
    for (let i = 0; i < 3; i++) c.fillRect(2 + i * 4, 38, 3, 2);
    // 主身体（肥硕大椭圆）
    ell(28, 21, 24, 15, F);
    // 背部高光
    ell(22, 12, 14, 5, L);
    // 肚皮（米黄大肚）
    ell(26, 29, 17, 8, B);
    // 背部深绿斑点
    ell(14, 13, 3, 2, D); ell(22, 9, 2, 2, D); ell(32, 12, 3, 2, D); ell(10, 20, 2, 2, D);
    // 大嘴线（右侧横向咧嘴，嘴角上扬）
    c.strokeStyle = K; c.lineWidth = 2;
    c.beginPath(); c.moveTo(30, 17); c.quadraticCurveTo(44, 20, 53, 15); c.stroke();
    // 嘴腔
    ell(46, 19, 6, 2, R);
    // 眼睛鼓包（右前方双眼）
    ell(44, 7, 6, 6, F); ell(52, 9, 5, 5, F);
    ell(44, 7, 4.5, 4.5, '#ffffff'); ell(52, 9, 3.5, 3.5, '#ffffff');
    c.fillStyle = K; c.fillRect(45, 5, 3, 4); c.fillRect(53, 7, 2, 3);
    // 眼上高光
    c.fillStyle = L; c.fillRect(42, 3, 3, 2); c.fillRect(50, 5, 2, 2);
    // 前肢（右下撑地爪）
    c.fillStyle = f; c.fillRect(36, 30, 5, 7); c.fillRect(40, 32, 5, 5);
    c.fillStyle = K; c.fillRect(40, 36, 8, 3); c.fillRect(46, 33, 2, 3);
    // 喉部呼吸起伏纹
    c.strokeStyle = f; c.lineWidth = 1;
    c.beginPath(); c.moveTo(34, 25); c.quadraticCurveTo(42, 26, 48, 23); c.stroke();
    return cv;
  }

  /** 程序化绘制鹤仙（巨大高瘦丹顶鹤，朝右飞行），返回 30×50 canvas（Boss 6.5x ≈ 高 325px 占屏 60%）
   * 白身黑翎：黑翼尖/黑尾/黑腿是"鹤"形识别关键，红顶+深金喙点睛 */
  function buildCrane() {
    const W = 30, H = 50;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const C = '#f4f6f2', c2 = '#c9d2cc', K = '#20241f', R = '#d43f2f', Y = '#b9862e', G = '#aab7bd';
    const ell = (x, y, rx, ry, col, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill(); };
    /* ---- 远侧翅（体后，灰白斜下） ---- */
    ell(8, 29, 9, 2, c2, 0.45);
    /* ---- 近侧大翅（细长斜上，双段） ---- */
    ell(8, 13, 12, 2.6, C, -0.95);
    ell(10, 17, 10, 2.2, C, -0.8);
    // 翅上羽纹
    c.strokeStyle = G; c.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      c.beginPath(); c.moveTo(4 + i * 3, 15 - i * 3); c.lineTo(13 + i * 2, 20 - i * 2); c.stroke();
    }
    // 翅尖黑翎（丹顶鹤标志）
    ell(0.8, 5.2, 3.2, 1.8, K, -0.95);
    ell(2.6, 9.8, 2.6, 1.6, K, -0.8);
    /* ---- 躯干（瘦长竖椭圆：上胸+下腹） ---- */
    ell(14, 23, 5, 6, C);
    ell(13, 32, 4.5, 7, C);
    // 胸腹阴影线
    c.strokeStyle = c2; c.lineWidth = 1;
    c.beginPath(); c.moveTo(16, 20); c.quadraticCurveTo(18, 28, 15, 37); c.stroke();
    /* ---- 长颈（S 形细颈：躯干上方向右上到头） ---- */
    c.strokeStyle = C; c.lineWidth = 2.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(15, 19); c.quadraticCurveTo(21, 14, 22, 7); c.stroke();
    // 颈侧阴影
    c.strokeStyle = c2; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(16.5, 19); c.quadraticCurveTo(22, 14.5, 23, 8); c.stroke();
    /* ---- 头（小巧）+ 红顶 + 眼 + 长喙 ---- */
    ell(22.5, 5, 3.2, 2.8, C);
    c.fillStyle = R; c.fillRect(21, 1, 3, 3);          // 丹顶
    c.fillStyle = K; c.fillRect(23, 4, 1.5, 1.5);      // 眼
    c.fillStyle = Y;                                    // 长喙（深金）
    c.beginPath(); c.moveTo(25, 4); c.lineTo(30, 6); c.lineTo(25, 7.2); c.fill();
    /* ---- 尾羽（左下黑色初级飞羽束） ---- */
    c.fillStyle = K;
    c.beginPath(); c.moveTo(10, 36); c.lineTo(3, 45); c.lineTo(11, 42); c.fill();
    c.beginPath(); c.moveTo(12, 38); c.lineTo(6, 48); c.lineTo(14, 43); c.fill();
    /* ---- 双腿（飞行姿态向后伸直）+ 爪 ---- */
    c.strokeStyle = K; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(12, 39); c.lineTo(4, 46); c.stroke();
    c.beginPath(); c.moveTo(14, 40); c.lineTo(6, 48); c.stroke();
    c.fillStyle = K; c.fillRect(2.5, 45.5, 3, 1.6); c.fillRect(4.5, 47.5, 3, 1.6);
    return cv;
  }

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
    blackSkel: build(BLACK_SKEL, BLACK_SKEL_PAL),
    skullhead: build(SKULLHEAD, SKULLHEAD_PAL),
    cannoneer: build(CANNONEER, CAN_PAL),
    samurai: build(SAMURAI, SAMURAI_PAL),
    swordEagleA: buildEagle(0, SWORD_EAGLE_PAL),
    swordEagleB: buildEagle(1, SWORD_EAGLE_PAL),
    dogHead: buildDogHead(),
    pheasant: buildPheasant(),
    superboy: buildSuperboy(),
    homelander: buildHomelander(),
    bossMan: buildBossMan(),
    bossHead: buildBossHead(),
    stranger: buildStranger(),
    frog: buildFrog(),
    crane: buildCrane(),
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
  Sprites.blackSkelL = flip(Sprites.blackSkel);
  Sprites.cannoneerL = flip(Sprites.cannoneer);
  Sprites.samuraiL = flip(Sprites.samurai);
  Sprites.swordEagleAL = flip(Sprites.swordEagleA);
  Sprites.swordEagleBL = flip(Sprites.swordEagleB);
  Sprites.dogHeadL = flip(Sprites.dogHead);
  Sprites.pheasantL = flip(Sprites.pheasant);
  Sprites.superboyL = flip(Sprites.superboy);
  Sprites.homelanderL = flip(Sprites.homelander);
  Sprites.bossManL = flip(Sprites.bossMan);
  Sprites.bossHeadL = flip(Sprites.bossHead);
  Sprites.strangerL = flip(Sprites.stranger);
  Sprites.frogL = flip(Sprites.frog);
  Sprites.craneL = flip(Sprites.crane);

  // 白猫主角：直接加载原图文件渲染（保证与素材 100% 一致）
  Sprites.whenReady = new Promise(resolve => {
    const im = new Image();
    im.onload = () => { Sprites.cat = im; resolve(im); };
    im.onerror = () => { console.warn('[Sprites] 未找到 assets/cat.png，白猫素材缺失'); resolve(null); };
    im.src = 'assets/cat.png';
  });

  window.Sprites = Sprites;
})();
