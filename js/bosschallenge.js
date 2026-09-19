/* ============================================================
 * bosschallenge.js —— Boss 挑战界面
 *  - Boss 卡片（评级 / 性格 / 特征属性 / 特别能力 / 讨伐状态）
 *  - 场景限定 Boss 优先，其次通用 Boss；一行三个，可上下滚动
 *  - 讨伐状态持久化（flytiger_boss_chal_v1）
 *  - 结算面板 + 小鱼干奖励
 * ============================================================ */
(function () {
  'use strict';

  const STORE_KEY = 'flytiger_boss_chal_v1';

  /** 评级档位（顺序即强度）与对应小鱼干奖励 */
  const RATING_RANK = { 'B+': 1, 'A': 2, 'A+': 3, 'S': 4, 'SS': 5, 'SSS': 6 };
  const FISH_REWARD = { 'B+': 10, 'A': 15, 'A+': 20, 'S': 25, 'SS': 30, 'SSS': 50 };

  /**
   * Boss 元信息（key = Boss 类名）
   *  name 名称 / rating 评级 / personality 性格 / trait 特征属性 / ability 特别能力
   */
  const META = {
    /* —— 通用 Boss —— */
    PigKing:          { name: '火焰飞猪王', rating: 'B+', personality: '暴躁鲁莽', trait: '精英强化 · 火系冲撞', ability: '巨型火球与烈焰冲撞' },
    ThunderBehemoth:  { name: '雷公巨兽',   rating: 'B+', personality: '沉闷凶悍', trait: '精英强化 · 雷电重甲', ability: '落雷轰击与重型弹幕' },
    GiantPheasant:    { name: '火鸡王',     rating: 'A+', personality: '急躁好斗', trait: '地面突击 · 俯冲近战', ability: '贴地高速俯冲突袭' },
    DogKing:          { name: '飞天狗王',   rating: 'B+', personality: '狡诈张狂', trait: '空中机动 · 解体光束', ability: '解体分裂与长线光束' },
    SwordEagle:       { name: '铁鹰',       rating: 'SS', personality: '凌厉果决', trait: '空中机动 · 飞剑弹幕', ability: '飞剑齐射与俯冲斩' },
    Samurai:          { name: '赤鬼',       rating: 'S',  personality: '孤傲自律', trait: '空中机动 · 剑道技击', ability: '居合斩与分身斩' },
    SkullKing:        { name: '亡灵骷髅王', rating: 'A',  personality: '阴冷无情', trait: '空中机动 · 亡灵召唤', ability: '召唤骷髅亡灵大军' },
    Stranger:         { name: '怪客',       rating: 'A',  personality: '乖张莫测', trait: '空中机动 · 诡异弹道', ability: '无规则诡异弹幕' },
    /* —— 场景限定 Boss（评级 A 起） —— */
    MadHyena:         { name: '癫狂鬣狗',   rating: 'A',  personality: '癫狂嗜血', trait: '限定草原 · 地面奔袭', ability: '召唤山石封锁战场' },
    SandWalker:       { name: '沙之行者',   rating: 'A',  personality: '隐忍诡诈', trait: '限定沙漠 · 沙隐突袭', ability: '潜入沙中突然袭击' },
    FrogKing:         { name: '蛙哥',       rating: 'A+', personality: '粗野强横', trait: '通用巨兽 · 重炮近战', ability: '巨舌横扫与重炮跳跃' },
    BossMan:          { name: '斧王',       rating: 'S',  personality: '霸道专横', trait: '空中强攻 · 重斧压制', ability: '巨斧旋风与追踪飞斧' },
    Homelander:       { name: '怒星使',     rating: 'A+', personality: '傲慢冷酷', trait: '空中压制 · 镭射轰击', ability: '双目镭射与热能冲击' },
    NiuMo:            { name: '牛魔',       rating: 'SSS', personality: '凶暴执拗', trait: '限定草原 · 多段变身', ability: '三段变身毁天灭地' },
    CaptainGeorge:    { name: '乔治船长',   rating: 'A+', personality: '老辣狡黠', trait: '限定大海 · 炮击俯冲', ability: '连环炮击接俯冲突袭' },
    FireBlind:        { name: '火遮眼',     rating: 'A+', personality: '炽烈决绝', trait: '限定火山 · 火焰斩击', ability: '火焰斩接火龙冲锋' },
    CraneSage:        { name: '鹤仙',       rating: 'S',  personality: '超然飘逸', trait: '通用特殊 · 五技仙术', ability: '五种仙术切换运用' },
    Sphinx:           { name: '狮身人面像', rating: 'SSS', personality: '威严睿智', trait: '限定沙漠 · 谜题诅咒', ability: '谜题试炼与诅咒弹幕' },
    RaccoonRover:     { name: '浣熊漫游者', rating: 'A+', personality: '机敏圆滑', trait: '限定都市 · 游击漫游', ability: '穿梭游击与道具奇袭' },
    PurpleHand:       { name: '紫手',       rating: 'A+', personality: '邪魅深沉', trait: '限定荒地 · 角牌法阵', ability: '随机仙术与角牌阵' },
    BoneDragonKing:   { name: '巨型骨龙王', rating: 'SSS', personality: '阴森桀骜', trait: '限定荒地 · 崩解分裂', ability: '崩解为骨龙群再重组' },
    SeaBully:         { name: '深海恶霸',   rating: 'A+', personality: '残忍嗜虐', trait: '限定海底 · 黑帮打手', ability: '追踪水鲨 / 炸弹冲击波 / 转向铁钩' },
    SnowWitch:        { name: '雪巫',       rating: 'A+', personality: '冷酷妖艳', trait: '限定雪地 · 永动冰霜', ability: '冰晶雨与冰环无缝连打' },
    CrowCount:        { name: '鸦伯爵',     rating: 'A+', personality: '优雅阴鸷', trait: '限定城堡 · 瞬移珠宝', ability: '瞬移躲击 + 宝石三档反转弹幕' }
  };

  /* ---------------- 持久化：讨伐结果 ---------------- */
  let saved = { results: {} };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && typeof d === 'object' && d.results) saved = d;
    }
  } catch (e) {}
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch (e) {}
  }

  /** 状态：defeated 已成功讨伐 / failed 未成功讨伐 / none 未讨伐 */
  function getStatus(clsName) {
    const r = saved.results[clsName];
    if (r === true) return 'defeated';
    if (r === false) return 'failed';
    return 'none';
  }
  /** 记录一次挑战结果（已成功讨伐后不因后续失败而降级） */
  function setResult(clsName, win) {
    if (getStatus(clsName) === 'defeated') return;
    saved.results[clsName] = !!win;
    persist();
  }

  /* ---------------- Boss 列表（合并 BOSS_LIST） ---------------- */
  function mapName(id) {
    const m = CFG.maps.find(x => x.id === id);
    return m ? { name: m.name, icon: m.icon } : null;
  }

  /** 返回 { limited: [...], generic: [...] }，每项含界面所需全部字段 */
  function list() {
    const all = (window.BOSS_LIST || []).map(e => {
      const clsName = e.cls.name;
      const m = META[clsName] || {
        name: clsName, rating: 'B+', personality: '不明', trait: '—', ability: '—'
      };
      const scene = e.map ? mapName(e.map) : null;
      return {
        cls: e.cls, clsName,
        name: m.name, rating: m.rating,
        personality: m.personality, trait: m.trait, ability: m.ability,
        limited: !!e.map,
        sceneId: e.map || null,
        sceneName: scene ? scene.name : null,
        sceneIcon: scene ? scene.icon : null,
        status: getStatus(clsName)
      };
    });
    const byRank = (a, b) => (RATING_RANK[a.rating] || 0) - (RATING_RANK[b.rating] || 0);
    // 场景限定：按地图表顺序分组，同图内按评级
    const sceneOrder = id => CFG.maps.findIndex(m => m.id === id);
    const limited = all.filter(b => b.limited)
      .sort((a, b) => (sceneOrder(a.sceneId) - sceneOrder(b.sceneId)) || byRank(a, b));
    const generic = all.filter(b => !b.limited).sort(byRank);
    return { limited, generic };
  }

  /* ---------------- DOM ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  const STATUS_TXT = {
    defeated: '<span class="bc-st bc-st-ok">✓ 已成功讨伐</span>',
    failed:   '<span class="bc-st bc-st-fail">✗ 未成功讨伐</span>',
    none:     '<span class="bc-st bc-st-none">· 未讨伐</span>'
  };

  function cardHtml(b) {
    return '<div class="bc-rate r' + esc(b.rating).replace('+', 'p') + '">' + esc(b.rating) + '</div>' +
      (b.limited ? '<div class="bc-scene-tag">' + b.sceneIcon + ' ' + esc(b.sceneName) + '</div>' : '') +
      '<div class="bc-name">' + esc(b.name) + '</div>' +
      '<div class="bc-line"><b>性格</b>' + esc(b.personality) + '</div>' +
      '<div class="bc-line"><b>特征</b>' + esc(b.trait) + '</div>' +
      '<div class="bc-line"><b>能力</b>' + esc(b.ability) + '</div>' +
      '<div class="bc-status-line">' + STATUS_TXT[b.status] + '</div>';
  }

  function renderSection(container, title, items) {
    if (!items.length) return;
    const sec = document.createElement('div');
    sec.className = 'bc-section';
    sec.innerHTML = '<div class="bc-sec-title">' + title + '</div>';
    const grid = document.createElement('div');
    grid.className = 'bc-grid';
    items.forEach(b => {
      const card = document.createElement('div');
      card.className = 'bc-card';
      card.innerHTML = cardHtml(b);
      card.addEventListener('click', () => {
        if (window.game && window.game.startChallenge) {
          window.game.startChallenge(b.clsName);
        }
      });
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    container.appendChild(sec);
  }

  function render() {
    const body = $('bc-list-body');
    if (!body) return;
    body.innerHTML = '';
    const { limited, generic } = list();
    renderSection(body, '🏰 场景限定 Boss', limited);
    renderSection(body, '🌌 通用 Boss', generic);
    const fishEl = $('bc-fish');
    if (fishEl) fishEl.textContent = '🐟 小鱼干 ' + (window.WH ? WH.fish() : 0);
  }

  function openPanel() {
    const p = $('bc-panel');
    if (!p) return;
    render();
    p.classList.remove('hidden');
    if (window.SFX) SFX.hit();
  }
  function closePanel() {
    const p = $('bc-panel');
    if (p) p.classList.add('hidden');
    if (window.SFX) SFX.hit();
  }

  /* ---------------- 结算面板 ---------------- */
  function fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + '分' + (s < 10 ? '0' : '') + s + '秒';
  }

  /**
   * 弹出结算（战斗结算 + 委托结果）
   *  opts: { win, name, rating, time, kills, sceneName, sceneIcon }
   */
  function openSettle(o) {
    const p = $('bc-settle');
    if (!p) return;
    const amount = FISH_REWARD[o.rating] || 0;
    const win = !!o.win;
    p.classList.toggle('win', win);
    const head = $('bc-settle-title');
    head.textContent = win ? '🏆 讨伐成功' : '💀 讨伐失败';
    $('bc-settle-stat').innerHTML =
      '<div class="bc-ss-row">目标 <b>' + esc(o.name) + '</b>' +
      '<span class="bc-rate sm r' + esc(o.rating).replace('+', 'p') + '">' + esc(o.rating) + '</span></div>' +
      '<div class="bc-ss-row">战场 <b>' + (o.sceneIcon ? o.sceneIcon + ' ' : '') + esc(o.sceneName || '随机场景') + '</b></div>' +
      '<div class="bc-ss-row">耗时 <b>' + fmtTime(o.time) + '</b>　击破 <b>' + o.kills + '</b></div>' +
      '<div class="bc-ss-row">战前部署 <b>24</b> 次三选一</div>';
    // 委托结果
    $('bc-settle-mission').innerHTML =
      '<div class="bc-ms-title">📜 委托结果</div>' +
      '<div class="bc-ms-card ' + (win ? 'ok' : 'fail') + '">' +
        '<div class="bc-ms-name">Boss 讨伐委托 · ' + esc(o.name) + '</div>' +
        '<div class="bc-ms-state">' + (win ? '✓ 委托已完成' : '✗ 委托未完成') + '</div>' +
        '<div class="bc-ms-reward">' + (win ? '🐟 小鱼干 ×' + amount : '无奖励') + '</div>' +
      '</div>';
    const btn = $('bc-settle-btn');
    if (win) {
      btn.textContent = '🎁 领取奖励';
      btn.className = 'bc-settle-btn go';
      btn.onclick = () => openReward(o.rating);
    } else {
      btn.textContent = '返回主页';
      btn.className = 'bc-settle-btn';
      btn.onclick = () => { if (window.game) game.backToMenu(); };
    }
    p.classList.remove('hidden');
  }

  /* ---------------- 奖励面板 ---------------- */
  /** 成功奖励：按评级发放小鱼干 */
  function openReward(rating) {
    const amount = FISH_REWARD[rating] || 0;
    if (window.WH) WH.addFish(amount);
    const p = $('bc-reward');
    if (!p) return;
    $('bc-rw-name').textContent = '讨伐赏 · ' + rating + ' 级';
    $('bc-rw-amount').textContent = '🐟 × ' + amount;
    p.classList.remove('hidden');
    const btn = $('bc-rw-btn');
    btn.onclick = () => {
      p.classList.add('hidden');
      if (window.game) game.backToMenu();
    };
  }

  /** 隐藏挑战相关全部面板（回主菜单时用） */
  function hideAll() {
    ['bc-panel', 'bc-settle', 'bc-reward', 'bc-countdown'].forEach(id => {
      const el = $(id);
      if (el) el.classList.add('hidden');
    });
  }

  window.BC = {
    list, getStatus, setResult,
    openPanel, closePanel, hideAll,
    openSettle, openReward,
    fishReward: r => FISH_REWARD[r] || 0,
    ratingRank: r => RATING_RANK[r] || 0
  };
})();
