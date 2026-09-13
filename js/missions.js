/* ============================================================
 * missions.js —— 任务委托 / 秘境发现系统
 *  - 随机任务（先做 6 个）：每次板上 2 个一组，完成后隐藏轮数 CD，支持一次性任务
 *  - 限时任务（先做 1 个：沙漠风暴侦察）：接取后 5 轮内完成，超时/失败 3~6 轮后再现
 *  - 全局「推进轮数」持久化时钟：每击败 1 只 Boss +1（跨局保留）
 *  - 派遣猫咪占用备战名额（至少留 1 只）；成功率五档：惨败/失败/成功/大成功（+超时）
 *  - 已完成委托在玩家阵亡时弹出结算（多个可翻页 / 跳过全部）
 *  - 秘境发现面板：特殊关卡片，红点，通关后卡片消失
 *  - localStorage 持久化（flytiger_mission_v1）
 * ============================================================ */
(function () {
  'use strict';

  const STORE_KEY = 'flytiger_mission_v1';
  const BOARD_SIZE = 2;

  /* ---------------- 可参与委托的猫咪：所有已解锁英雄（含藏品解锁的魅影） ---------------- */
  const BASE_CATS = ['xiaobai', 'xiake', 'mofashi', 'buliang', 'jiaodoushi', 'chaoren'];
  /** 当前可派遣猫咪：动态读取角色系统，新解锁的英雄立即可参与委托 */
  function allCats() {
    if (window.CHARS && CHARS.ORDER) return CHARS.ORDER.filter(id => id && (!CHARS.isUnlocked || CHARS.isUnlocked(id)));
    return BASE_CATS.slice();
  }
  const catName = id => { const c = window.CHARS && CHARS.get(id); return c ? c.name : id; };
  const catFace = id => { const c = window.CHARS && CHARS.get(id); return c ? (c.face || c.art || '') : ''; };

  /* ---------------- 随机任务（6 个） ---------------- */
  const RANDOM = [
    {
      id: 'caravan', name: '失踪的商队', rounds: 2, cd: 3, slots: 1,
      rec: ['xiake', 'mofashi'], fish: 35, special: 0.30,
      desc: '驿站老板把一袋银币拍在桌上：“谁去河滩看一眼，钱就是谁的。别碰水，别喝河水，别问那鳞片是从什么身上掉的。”他老婆在柜台后小声补了一句：“第三个去的人还没回来。”'
    },
    {
      id: 'tower', name: '老哨塔的信', rounds: 3, cd: 4, slots: 1,
      rec: ['jiaodoushi', 'buliang'], fish: 50, special: 0,
      desc: '酒馆里有人说，哨塔的灯只在月缺时亮。去过的人回来就发烧，嘴里念叨“信是写给死人的”。驻军队长不信邪，但他把信锁进铁盒，钥匙扔进了井里。'
    },
    {
      id: 'well', name: '井底的回声', rounds: 2, cd: 3, slots: 1,
      rec: ['xiaobai', 'mofashi'], fish: 40, special: 0,
      desc: '绿洲长老说那是祖先在说话。但守井人已经跑了，跑之前跟每个人说：“你喊‘有人吗’，它回‘太远了’。你没喊，它说‘快走’。”'
    },
    {
      id: 'stonewatch', name: '石刻的守夜人', rounds: 3, cd: 4, slots: 1,
      rec: ['jiaodoushi', 'buliang'], fish: 55, special: 0,
      desc: '驼队领队在酒馆里发誓，他半夜听见石头磨地，像刀在磨刀石上走。第二天所有石人转向西，骆驼丢了两头，鞍具被割断，切口齐得像刽子手干的。他建议：去的话带壶酒，那不是给活人喝的。'
    },
    {
      id: 'reedeyes', name: '芦苇荡的眼睛', rounds: 2, cd: 3, slots: 2,
      rec: ['xiake', 'mofashi'], fish: 65, special: 0,
      desc: '渔夫把船桨折了，说芦苇荡里有眼睛。他捞起一颗黑点，在手心里裂开，空的。三个村民不信，划船进去，再没回来。村里人说他们疯了，但没人敢去芦苇荡收尸。'
    },
    {
      id: 'stillwater', name: '静水之下', rounds: 3, cd: 4, slots: 2,
      rec: ['xiaobai', 'chaoren', 'jiaodoushi'], fish: 70, special: 0,
      desc: '猎人们围在火堆旁打赌。有人说静水潭的脚印是三趾，有人说是五趾。老猎人吐了口烟：“数不清。”他们决定派一个人去看。回来了就请喝酒；没回来，就别再派人去了。'
    }
  ];

  /* ---------------- 限时任务（1 个） ---------------- */
  const TIMED = {
    id: 'storm', name: '沙漠风暴侦察', timed: true,
    rounds: 3, deadline: 5, slots: 1,
    rec: ['xiaobai', 'xiake', 'mofashi'], fish: 50, special: 0.70,
    specialStage: 'sphinx_outpost',
    desc: '月亮缺了一角，缺口往外漏沙。沙落之地，石猫从地里长出，全朝东方。游方僧说：狮身人面像醒了，它在找东西。接过沙子的人都会梦见巨爪之下，抬头看不见脸，只听见——“还给我。”哨站把沙子沉井，井第二天被沙填平。月亮又多了一个洞。'
  };

  const DEF_MAP = {};
  RANDOM.forEach(d => { DEF_MAP[d.id] = d; });
  DEF_MAP[TIMED.id] = TIMED;

  /* ---------------- 秘境（特殊关） ---------------- */
  const STAGES = [
    { id: 'sphinx_outpost', name: '狮身人面像·前哨遭遇', tag: '遭遇关', icon: '🌙', launch: 'moondesert' }
  ];
  const STAGE_MAP = {};
  STAGES.forEach(s => { STAGE_MAP[s.id] = s; });
  const DISCOVER_SLOTS = 9;   // 发现面板槽位（已解锁彩色 + 其余 ??? 占位）

  /* ---------------- 结果档位 ---------------- */
  // 0 惨败 / 1 失败 / 2 成功（险胜）/ 3 成功（稳赢）/ 4 大成功
  const BAND_LABEL = ['惨败', '失败', '成功', '成功', '大成功'];
  const FISH_MUL = [0, 0.5, 1, 1, 1.5];
  const ITEM_BONUS = { luckstar: 0.35, clover: 0.7 };   // 幸运星 +15% / 四叶草 +30%（折算档位权重）

  /* ---------------- 持久化 ---------------- */
  const defaultData = () => ({
    rounds: 0,            // 累计推进轮数（全局时钟）
    board: [],            // 当前可接随机任务 defId
    active: [],           // 进行中 {uid,def,cats,item,start,finish,deadline,timed}
    pending: [],          // 已完成待阵亡结算
    cd: {},               // 随机任务 defId -> CD 截止轮数
    once: {},             // 一次性任务 defId -> true（完成后永不再刷）
    timedCdUntil: 0,      // 限时任务 CD 截止轮数
    timedLock: false,     // 限时任务永不再刷（特殊关已通关）
    timedActive: false,   // 限时任务是否在进行中（同一时间仅 1 个）
    stages: { unlocked: {}, seen: {}, cleared: {} }
  });
  let data = defaultData();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          const def = defaultData();
          data.rounds = Math.max(0, d.rounds | 0);
          data.board = Array.isArray(d.board) ? d.board.slice() : [];
          data.active = Array.isArray(d.active) ? d.active.slice() : [];
          data.pending = Array.isArray(d.pending) ? d.pending.slice() : [];
          data.cd = d.cd && typeof d.cd === 'object' ? d.cd : {};
          data.once = d.once && typeof d.once === 'object' ? d.once : {};
          data.timedCdUntil = Math.max(0, d.timedCdUntil | 0);
          data.timedLock = !!d.timedLock;
          data.timedActive = !!d.timedActive;
          data.stages = {
            unlocked: d.stages && d.stages.unlocked ? d.stages.unlocked : {},
            seen: d.stages && d.stages.seen ? d.stages.seen : {},
            cleared: d.stages && d.stages.cleared ? d.stages.cleared : {}
          };
        }
      }
    } catch (e) { /* 存档损坏：静默使用默认值 */ }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  load();

  /* ---------------- 外部钩子 ---------------- */
  const hooks = { charDirty: [], launchStage: null };
  function onCharDirty(fn) { hooks.charDirty.push(fn); }
  function fireCharDirty() { hooks.charDirty.forEach(fn => { try { fn(); } catch (e) {} }); }
  function onLaunchStage(fn) { hooks.launchStage = fn; }

  /* ---------------- 查询 ---------------- */
  function busyCats() {
    const arr = [];
    data.active.forEach(m => m.cats.forEach(c => { if (arr.indexOf(c) < 0) arr.push(c); }));
    return arr;
  }
  function isBusy(catId) { return data.active.some(m => m.cats.indexOf(catId) >= 0); }
  function missionOf(catId) {
    for (let i = 0; i < data.active.length; i++) if (data.active[i].cats.indexOf(catId) >= 0) return data.active[i];
    return null;
  }
  /** 选角界面徽章文案：委托中·剩 N 轮 */
  function busyLabel(catId) {
    const m = missionOf(catId);
    if (!m) return '';
    const left = Math.max(0, m.finish - data.rounds);
    return (m.timed ? '限时委托' : '委托中') + '·剩' + left + '轮';
  }
  /** 空闲（可派遣/可备战）猫咪：所有已解锁英雄扣除委托中的 */
  function freeCats(def) {
    const allow = (def && def.cats) || allCats();
    return allow.filter(id => !isBusy(id));
  }
  function hasPending() { return data.pending.length > 0; }
  function rounds() { return data.rounds; }

  /* ---------------- 随机任务板 ---------------- */
  function randomEligible() {
    return RANDOM.filter(d =>
      !data.once[d.id] &&
      data.board.indexOf(d.id) < 0 &&
      !data.active.some(m => m.def === d.id) &&
      (data.cd[d.id] || 0) <= data.rounds
    );
  }
  function timedEligible() {
    if (data.timedActive || data.timedLock) return false;
    if (data.timedCdUntil > data.rounds) return false;
    // 特殊关已通关：限时任务永不再刷
    if (data.stages.cleared[TIMED.specialStage]) return false;
    return true;
  }
  /** 补足随机任务板至 2 个（CD/一次性/进行中均排除） */
  function refillBoard() {
    let guard = 0;
    while (data.board.length < BOARD_SIZE && guard++ < 20) {
      const pool = randomEligible();
      if (!pool.length) break;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      data.board.push(pick.id);
    }
  }
  refillBoard();

  /* ---------------- 成功率 ---------------- */
  function expectedPower(def, cats, item) {
    const n = cats.length;
    if (!n) return null;
    // 普通猫权重在前 3 档（期望 1），推荐猫在后 3 档（期望 3）
    const avg = cats.reduce((s, cid) => s + (def.rec.indexOf(cid) >= 0 ? 3 : 1), 0) / n;
    const eff = 0.72 + 0.28 * (n / def.slots);    // 派满员有效度最高
    let p = avg * eff;
    if (item && ITEM_BONUS[item]) p += ITEM_BONUS[item];
    return Math.max(0, Math.min(4, p));
  }
  function powerBand(p) {
    if (p < 0.85) return 0;
    if (p < 1.7) return 1;
    if (p < 2.6) return 2;
    if (p < 3.5) return 3;
    return 4;
  }
  function bandWord(p) {
    if (p < 1.7) return '完全不可能';
    if (p < 2.6) return '可能成功';
    if (p < 3.5) return '稳赢';
    return '大成功在望';
  }
  /** 成功率区间（整数百分比，随机浮动） */
  function successRange(def, cats, item) {
    const p = expectedPower(def, cats, item);
    if (p == null) return null;
    const ctr = Math.round(Math.max(5, Math.min(96, 10 + p * 21)));
    const lo = Math.max(1, ctr - (6 + Math.floor(Math.random() * 6)));
    let hi = Math.min(99, ctr + (6 + Math.floor(Math.random() * 6)));
    if (hi <= lo) hi = Math.min(99, lo + 3);
    return { lo, hi, word: bandWord(p) };
  }
  /** 派遣结算：实际档位掷骰 */
  function rollBand(def, cats, item) {
    const n = cats.length;
    const sum = cats.reduce((s, cid) => {
      const rec = def.rec.indexOf(cid) >= 0;
      return s + (rec ? 2 + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 3));
    }, 0);
    const avg = sum / n;
    const eff = 0.72 + 0.28 * (n / def.slots);
    let p = avg * eff;
    if (item && ITEM_BONUS[item]) p += ITEM_BONUS[item];
    return powerBand(Math.max(0, Math.min(4, p)));
  }

  /* ---------------- 派遣 ---------------- */
  function canDispatch(def, cats) {
    if (!def || !cats || !cats.length) return { ok: false, msg: '请先选择猫咪' };
    if (cats.length > def.slots) return { ok: false, msg: '最多派遣 ' + def.slots + ' 只' };
    if (def.timed && data.timedActive) return { ok: false, msg: '限时任务已在进行中' };
    for (const cid of cats) {
      if (isBusy(cid)) return { ok: false, msg: '「' + catName(cid) + '」正在执行其它委托' };
      if (def.cats && def.cats.indexOf(cid) < 0) return { ok: false, msg: '「' + catName(cid) + '」不适合此任务' };
    }
    // 至少留下一只猫备战
    if (freeCats(null).length - cats.length < 1) return { ok: false, msg: '至少留下一只猫备战，推进轮数' };
    return { ok: true };
  }
  function dispatch(defId, cats, item) {
    const def = DEF_MAP[defId];
    const chk = canDispatch(def, cats);
    if (!chk.ok) return chk;
    // 道具消耗
    if (item && ITEM_BONUS[item]) {
      if (window.WH && WH.itemCount(item) <= 0) return { ok: false, msg: '道具数量不足' };
      if (window.WH) WH.removeItem(item, 1);
    }
    const m = {
      uid: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
      def: def.id, cats: cats.slice(), item: item || null,
      start: data.rounds, finish: data.rounds + def.rounds,
      deadline: def.timed ? data.rounds + def.deadline : 0,
      timed: !!def.timed
    };
    data.active.push(m);
    if (def.timed) data.timedActive = true;
    else {
      const i = data.board.indexOf(def.id);
      if (i >= 0) data.board.splice(i, 1);
      refillBoard();
    }
    save();
    fireCharDirty();
    renderAll();
    return { ok: true };
  }

  /* ---------------- 轮数推进 / 任务完成 ---------------- */
  function resolveMission(m) {
    const def = DEF_MAP[m.def];
    const band = rollBand(def, m.cats, m.item);
    const fish = Math.round(def.fish * FISH_MUL[band]);
    // 特殊关触发：失败/惨败不触发；险胜/稳赢按概率；大成功必触发
    let stageId = null;
    if (def.special > 0) {
      if (band === 4) stageId = def.specialStage || null;
      else if (band >= 2 && Math.random() < def.special) stageId = def.specialStage || null;
    }
    if (stageId) data.stages.unlocked[stageId] = true;
    // 随机任务：完成后进入隐藏 CD（失败同样进入）；一次性任务永久排除
    if (!m.timed) {
      if (def.once) data.once[def.id] = true;
      else data.cd[def.id] = data.rounds + def.cd;
    } else {
      data.timedActive = false;
      // 特殊关已通关 → 永不再刷；否则 4 轮 CD（未解锁 / 解锁未通关同此）
      if (stageId && data.stages.cleared[stageId]) data.timedLock = true;
      else data.timedCdUntil = data.rounds + 4;
    }
    const code = band === 4 ? 'great' : (band >= 2 ? 'success' : (band === 1 ? 'fail' : 'crash'));
    const firstCat = m.cats[0];
    data.pending.push({
      uid: m.uid, name: def.name, timed: !!m.timed,
      cats: m.cats.map(catName),
      code, label: BAND_LABEL[band], band,
      fish, stage: stageId ? STAGE_MAP[stageId].name : null,
      quote: (window.CHARS && CHARS.randMood) ? CHARS.randMood(firstCat) : ''
    });
  }
  function expireTimed(m) {
    data.timedActive = false;
    data.timedCdUntil = data.rounds + 3 + Math.floor(Math.random() * 4);  // 3~6 轮
    data.pending.push({
      uid: m.uid, name: DEF_MAP[m.def].name, timed: true,
      cats: m.cats.map(catName),
      code: 'timeout', label: '超时', band: -1,
      fish: 0, stage: null,
      quote: (window.CHARS && CHARS.randMood) ? CHARS.randMood(m.cats[0]) : ''
    });
  }
  /** 每击败 1 只 Boss 调用：全局轮数 +1，结算到期任务 */
  function advanceRound() {
    data.rounds++;
    const remain = [];
    let changed = false;
    data.active.forEach(m => {
      if (data.rounds >= m.finish) { resolveMission(m); changed = true; }
      else if (m.timed && data.rounds > m.deadline) { expireTimed(m); changed = true; }
      else remain.push(m);
    });
    data.active = remain;
    refillBoard();
    save();
    if (changed) fireCharDirty();
    renderAll();
    refreshDots();
  }

  /* ---------------- 阵亡委托结算 ---------------- */
  function grantAll() {
    data.pending.forEach(p => {
      if (p.fish > 0 && window.WH) WH.addFish(p.fish);
    });
  }
  let settleIdx = 0, settleCb = null;

  /* ============================================================
   * 面板 DOM
   * ============================================================ */
  let built = false, panelEl, listEl, detailEl, dvEl, dvGridEl, settleEl;
  let curSel = null;          // 当前详情选中 {defId, timed}
  let selCats = [];           // 详情中已选猫咪
  let selItem = null;         // 详情中已选道具

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

  function build() {
    if (built) return;
    panelEl = $('ms-panel'); listEl = $('ms-list'); detailEl = $('ms-detail');
    dvEl = $('dv-panel'); dvGridEl = $('dv-grid');
    settleEl = $('ms-settle');
    if (!panelEl) return;
    $('ms-back-btn').addEventListener('click', closePanel);
    $('dv-back-btn').addEventListener('click', closeDiscover);
    $('mss-skip').addEventListener('click', closeSettlement);
    $('mss-next').addEventListener('click', nextSettlement);
    built = true;
  }

  function openPanel() {
    build();
    if (!panelEl) return;
    refillBoard(); save();
    panelEl.classList.remove('hidden');
    curSel = null; selCats = []; selItem = null;
    renderList(); renderDetail(); renderFish();
    try { if (window.SFX && SFX.pick) SFX.pick(); } catch (e) {}
  }
  function closePanel() {
    if (panelEl) panelEl.classList.add('hidden');
    try { if (window.SFX && SFX.hit) SFX.hit(); } catch (e) {}
  }
  function renderAll() {
    if (!built || !panelEl || panelEl.classList.contains('hidden')) return;
    renderList(); renderDetail(); renderFish();
  }
  function renderFish() {
    const el = $('ms-fish');
    if (el) el.textContent = '🐟 小鱼干 ' + (window.WH ? WH.fish() : 0);
  }

  /* ---------- 左栏任务列表 ---------- */
  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';

    // 进行中
    if (data.active.length) {
      listEl.appendChild(sectionTitle('委托进行中'));
      data.active.forEach(m => {
        const def = DEF_MAP[m.def];
        const left = Math.max(0, m.finish - data.rounds);
        const card = document.createElement('div');
        card.className = 'ms-card ms-active' + (curSel && curSel.uid === m.uid ? ' picked' : '');
        card.innerHTML =
          `<div class="ms-card-name">${esc(def.name)}${m.timed ? '<span class="ms-tag ms-tag-timed">限时</span>' : ''}</div>` +
          `<div class="ms-card-meta">派出：${m.cats.map(c => esc(catName(c))).join('、')}</div>` +
          `<div class="ms-card-meta ms-left">剩余 <b>${left}</b> 轮（共需 ${def.rounds} 轮）</div>`;
        card.addEventListener('click', () => { curSel = { uid: m.uid }; renderList(); renderDetail(); });
        listEl.appendChild(card);
      });
    }

    // 限时任务（可接）
    if (timedEligible()) {
      listEl.appendChild(sectionTitle('限时委托'));
      listEl.appendChild(taskCard(TIMED, true));
    }

    // 随机任务
    listEl.appendChild(sectionTitle('可接委托'));
    if (!data.board.length) {
      const empty = document.createElement('div');
      empty.className = 'ms-empty';
      empty.textContent = '猫爪印都新鲜着呢——先去推进几轮，新的委托正在路上。';
      listEl.appendChild(empty);
    } else {
      data.board.forEach(id => {
        const def = DEF_MAP[id];
        if (def) listEl.appendChild(taskCard(def, false));
      });
    }
  }
  function sectionTitle(txt) {
    const d = document.createElement('div');
    d.className = 'ms-sec-title';
    d.textContent = txt;
    return d;
  }
  function taskCard(def, timed) {
    const card = document.createElement('div');
    card.className = 'ms-card' + (curSel && curSel.defId === def.id ? ' picked' : '');
    const specialTxt = def.special ? `<span class="ms-card-sp">⚡ ${Math.round(def.special * 100)}% 特殊关</span>` : '';
    card.innerHTML =
      `<div class="ms-card-name">${esc(def.name)}${timed ? '<span class="ms-tag ms-tag-timed">限时</span>' : ''}</div>` +
      `<div class="ms-card-meta">耗时 ${def.rounds} 轮 · 可派 ${def.slots} 猫 · 🐟×${def.fish}</div>` +
      `<div class="ms-card-meta">推荐：${def.rec.map(c => esc(catName(c))).join('、')} ${specialTxt}</div>`;
    card.addEventListener('click', () => {
      curSel = { defId: def.id };
      selCats = []; selItem = null;
      renderList(); renderDetail();
    });
    return card;
  }

  /* ---------- 右栏详情 ---------- */
  function renderDetail() {
    if (!detailEl) return;
    detailEl.innerHTML = '';
    // 进行中任务（只读）
    if (curSel && curSel.uid) {
      const m = data.active.find(x => x.uid === curSel.uid);
      if (m) { renderActiveDetail(m); return; }
      curSel = null;
    }
    if (!curSel || !curSel.defId) {
      detailEl.innerHTML = '<div class="ms-detail-empty">← 从左侧选择一条委托，查看详情并派遣猫咪</div>';
      return;
    }
    const def = DEF_MAP[curSel.defId];
    if (!def) { detailEl.innerHTML = '<div class="ms-detail-empty">委托已不在公告板上。</div>'; return; }

    const head = document.createElement('div');
    head.className = 'ms-d-head';
    head.innerHTML =
      `<div class="ms-d-name">📋 ${esc(def.name)} ${def.timed ? '<span class="ms-tag ms-tag-timed">限时</span>' : ''}</div>` +
      `<div class="ms-d-tags">` +
      `<span>⏳ 消耗 ${def.rounds} 轮</span>` +
      `<span>🐱 可派 ${def.slots} 只</span>` +
      (def.timed ? `<span class="ms-tag-timed">⏰ 接取后 ${def.deadline} 轮内完成，超时消失</span>` : '') +
      `</div>`;
    detailEl.appendChild(head);

    const desc = document.createElement('div');
    desc.className = 'ms-d-desc';
    desc.textContent = def.desc;
    detailEl.appendChild(desc);

    const rew = document.createElement('div');
    rew.className = 'ms-d-reward';
    rew.innerHTML =
      `<div class="ms-d-sub">🎁 报酬</div>` +
      `<div class="ms-d-reward-line">🐟 小鱼干 ×${def.fish}（大成功 ×${Math.round(def.fish * 1.5)}）</div>` +
      (def.special ? `<div class="ms-d-reward-line">⚡ ${Math.round(def.special * 100)}% 概率发现特殊关「狮身人面像·前哨遭遇」<small>（大成功必定发现）</small></div>` : '');
    detailEl.appendChild(rew);

    // 推荐猫
    const rec = document.createElement('div');
    rec.className = 'ms-d-rec';
    rec.innerHTML = `<span class="ms-d-sub">推荐猫咪</span> ` + def.rec.map(c => `<span class="ms-rec-chip">${esc(catName(c))}</span>`).join(' ');
    detailEl.appendChild(rec);

    // 选猫
    const free = freeCats(def);
    const catBox = document.createElement('div');
    catBox.className = 'ms-d-cats';
    catBox.appendChild(subTitle('选择派遣猫咪（' + (def.slots > 1 ? '最多 ' + def.slots + ' 只' : '1 只') + '）'));
    const row = document.createElement('div');
    row.className = 'ms-cat-row';
    const eligible = def.cats || allCats();
    eligible.forEach(id => {
      const busy = isBusy(id);
      const chip = document.createElement('div');
      chip.className = 'ms-cat-chip' +
        (busy ? ' busy' : '') +
        (selCats.indexOf(id) >= 0 ? ' sel' : '') +
        (def.rec.indexOf(id) >= 0 ? ' rec' : '');
      chip.innerHTML =
        `<img class="ms-cat-face" src="${catFace(id)}" alt="">` +
        `<span class="ms-cat-nm">${esc(catName(id))}</span>` +
        (def.rec.indexOf(id) >= 0 ? '<span class="ms-cat-rec">荐</span>' : '') +
        (busy ? '<span class="ms-cat-busy">委托中</span>' : '');
      if (!busy) chip.addEventListener('click', () => {
        const i = selCats.indexOf(id);
        if (i >= 0) selCats.splice(i, 1);
        else {
          if (selCats.length >= def.slots) selCats.shift();
          selCats.push(id);
        }
        renderDetail();
      });
      row.appendChild(chip);
    });
    catBox.appendChild(row);
    detailEl.appendChild(catBox);

    // 选道具
    const itemBox = document.createElement('div');
    itemBox.className = 'ms-d-items';
    itemBox.appendChild(subTitle('携带道具（派遣时消耗）'));
    const irow = document.createElement('div');
    irow.className = 'ms-item-row';
    const itemDefs = [
      { id: null, name: '不带道具', icon: '✖️', count: -1, eff: '' },
      { id: 'luckstar', name: '幸运星', icon: '🌟', count: window.WH ? WH.itemCount('luckstar') : 0, eff: '成功率 +15%' },
      { id: 'clover', name: '四叶草', icon: '🍀', count: window.WH ? WH.itemCount('clover') : 0, eff: '成功率 +30%' }
    ];
    itemDefs.forEach(it => {
      const chip = document.createElement('div');
      const noStock = it.id && it.count <= 0;
      chip.className = 'ms-item-chip' + (selItem === it.id ? ' sel' : '') + (noStock ? ' disabled' : '');
      chip.innerHTML =
        `<span class="ms-item-ic">${it.icon}</span>` +
        `<span class="ms-item-nm">${esc(it.name)}${it.count >= 0 ? ' ×' + it.count : ''}</span>` +
        (it.eff ? `<span class="ms-item-eff">${it.eff}</span>` : '');
      if (!noStock) chip.addEventListener('click', () => { selItem = it.id; renderDetail(); });
      irow.appendChild(chip);
    });
    itemBox.appendChild(irow);
    detailEl.appendChild(itemBox);

    // 成功率区间
    const rate = document.createElement('div');
    rate.className = 'ms-d-rate';
    if (selCats.length) {
      const r = successRange(def, selCats, selItem);
      rate.innerHTML = `成功率预估 <b>${r.lo}%—${r.hi}%</b> <span class="ms-rate-word">${r.word}</span>` +
        (selCats.length < def.slots && def.slots > 1 ? '<small>　派满 ' + def.slots + ' 只成功率更高</small>' : '');
    } else {
      rate.innerHTML = '<span class="ms-rate-none">选择猫咪后显示成功率区间</span>';
    }
    detailEl.appendChild(rate);

    // 派遣按钮
    const chk = canDispatch(def, selCats);
    const btn = document.createElement('button');
    btn.className = 'ms-dispatch-btn' + (chk.ok ? ' can' : '');
    btn.textContent = chk.ok ? '📜 派遣出发！' : (chk.msg || '不可派遣');
    btn.disabled = !chk.ok;
    if (chk.ok) btn.addEventListener('click', () => {
      const res = dispatch(def.id, selCats, selItem);
      if (res.ok) {
        try { if (window.SFX && SFX.levelup) SFX.levelup(); } catch (e) {}
        curSel = null; selCats = []; selItem = null;
        renderList(); renderDetail(); renderFish(); refreshDots();
      } else {
        btn.textContent = res.msg; btn.disabled = true;
      }
    });
    detailEl.appendChild(btn);
  }
  function renderActiveDetail(m) {
    const def = DEF_MAP[m.def];
    const left = Math.max(0, m.finish - data.rounds);
    const itemName = m.item ? ((WH.ITEMS.find(x => x.id === m.item) || {}).name || '道具') : '';
    detailEl.innerHTML =
      `<div class="ms-d-head"><div class="ms-d-name">📋 ${esc(def.name)} ${m.timed ? '<span class="ms-tag ms-tag-timed">限时</span>' : ''}</div>` +
      `<div class="ms-d-tags"><span class="ms-doing">委托进行中……</span></div></div>` +
      `<div class="ms-active-info">` +
      `<div>派出猫咪：${m.cats.map(c => esc(catName(c))).join('、')}</div>` +
      `<div>已推进 <b>${data.rounds - m.start}</b> / ${def.rounds} 轮，还需 <b>${left}</b> 轮</div>` +
      (m.item ? `<div>携带道具：${esc(itemName)}（已消耗）</div>` : '<div>未携带道具</div>') +
      (m.timed ? `<div class="ms-deadline">⏰ 须在第 ${m.deadline} 轮前完成（当前第 ${data.rounds} 轮），超时委托消失</div>` : '') +
      `<div class="ms-active-hint">猫咪归来前无法选其备战；委托结果将在你阵亡时一并结算。</div>` +
      `</div>`;
  }
  function subTitle(txt) {
    const d = document.createElement('div');
    d.className = 'ms-d-sub';
    d.textContent = txt;
    return d;
  }

  /* ---------------- 秘境发现 ---------------- */
  function openDiscover() {
    build();
    if (!dvEl) return;
    // 查看即消红点
    Object.keys(data.stages.unlocked).forEach(id => { data.stages.seen[id] = true; });
    save();
    renderDiscover();
    dvEl.classList.remove('hidden');
    refreshDots();
    try { if (window.SFX && SFX.pick) SFX.pick(); } catch (e) {}
  }
  function closeDiscover() {
    if (dvEl) dvEl.classList.add('hidden');
    try { if (window.SFX && SFX.hit) SFX.hit(); } catch (e) {}
  }
  function renderDiscover() {
    if (!dvGridEl) return;
    dvGridEl.innerHTML = '';
    const unlocked = STAGES.filter(s => data.stages.unlocked[s.id] && !data.stages.cleared[s.id]);
    const total = Math.max(DISCOVER_SLOTS, unlocked.length + (3 - unlocked.length % 3) % 3);
    for (let i = 0; i < total; i++) {
      const s = unlocked[i];
      const card = document.createElement('div');
      if (s) {
        card.className = 'dv-card';
        card.innerHTML =
          `<div class="dv-icon">${s.icon}</div>` +
          `<div class="dv-name">${esc(s.name)}</div>` +
          `<div class="dv-tag">${esc(s.tag)}</div>`;
        card.addEventListener('click', () => launchStage(s));
      } else {
        card.className = 'dv-card locked';
        card.innerHTML = '<div class="dv-icon">🔒</div><div class="dv-name">???</div><div class="dv-tag">尚未发现</div>';
      }
      dvGridEl.appendChild(card);
    }
  }
  function launchStage(s) {
    closeDiscover(); closePanel();
    try { if (window.SFX && SFX.bossWarn) SFX.bossWarn(); } catch (e) {}
    if (typeof hooks.launchStage === 'function') hooks.launchStage(s);
  }
  /** 特殊关通关回调（由 game.js 通关奖励页关闭时调用） */
  let lastStageId = null;
  function notifyLaunched(id) { lastStageId = id; }
  function notifyStageCleared() {
    if (!lastStageId) return;
    if (data.stages.unlocked[lastStageId]) {
      data.stages.cleared[lastStageId] = true;
      // 通关后卡片从发现面板消失；限时任务因通关而永不再刷
      if (lastStageId === TIMED.specialStage) data.timedLock = true;
      save();
      renderDiscover();
      refreshDots();
    }
    lastStageId = null;
  }
  /** 主界面「发现」红点：有已解锁未查看的特殊关 */
  function hasNewStage() {
    return Object.keys(data.stages.unlocked).some(id => !data.stages.seen[id] && !data.stages.cleared[id]);
  }
  function refreshDots() {
    const btn = $('menu-discover-btn');
    if (btn) btn.classList.toggle('has-dot', hasNewStage());
  }

  /* ---------------- 阵亡结算浮层 ---------------- */
  function showSettlement(cb) {
    build();
    if (!settleEl) { cb && cb(); return; }
    if (!data.pending.length) { cb && cb(); return; }
    grantAll();
    settleCb = cb || null;
    settleIdx = 0;
    settleEl.classList.remove('hidden');
    renderSettlement();
    try { if (window.SFX && SFX.rewardSurprise) SFX.rewardSurprise(); } catch (e) {}
  }
  function renderSettlement() {
    const p = data.pending[settleIdx];
    const body = $('mss-body');
    const count = $('mss-count');
    const next = $('mss-next');
    count.textContent = `委托结果  ${settleIdx + 1}/${data.pending.length}`;
    next.textContent = settleIdx >= data.pending.length - 1 ? '关闭' : '下一个';
    const resCls = { great: 'great', success: 'success', fail: 'fail', crash: 'crash', timeout: 'timeout' }[p.code] || '';
    const spark = p.code === 'great' ? ' ✨' : '';
    let rewardHtml = '';
    if (p.code === 'timeout') {
      rewardHtml = '<div class="mss-line mss-empty-r">风沙吞没了足迹，猫咪在时限内没能赶回，空手而归。</div>';
    } else if (p.fish > 0) {
      rewardHtml = `<div class="mss-line">🎁 获得</div><div class="mss-line mss-fish">🐟 小鱼干 ×${p.fish}</div>`;
    } else {
      rewardHtml = '<div class="mss-line mss-empty-r">🎁 获得：无（惨败，只捡回一条命）</div>';
    }
    const stageHtml = p.stage
      ? `<div class="mss-line mss-stage">⚡ 解锁特殊关：${esc(p.stage)}</div><div class="mss-line mss-stage-hint">（入口已出现在主界面「发现」）</div>`
      : '';
    const quoteHtml = p.quote ? `<div class="mss-line mss-quote">🐱 ${esc(p.cats[0] || '猫咪')}：“${esc(p.quote)}”</div>` : '';
    body.innerHTML =
      `<div class="mss-line mss-name">📋 ${esc(p.name)}${p.timed ? ' <span class="ms-tag ms-tag-timed">限时</span>' : ''}</div>` +
      `<div class="mss-line">派出：${p.cats.map(esc).join('、')}</div>` +
      `<div class="mss-line mss-result ${resCls}">结果：${esc(p.label)}${spark}</div>` +
      rewardHtml + stageHtml + quoteHtml;
    // 新解锁特殊关：刷新红点
    refreshDots();
  }
  function nextSettlement() {
    if (settleIdx < data.pending.length - 1) { settleIdx++; renderSettlement(); }
    else closeSettlement();
  }
  function closeSettlement() {
    if (settleEl) settleEl.classList.add('hidden');
    data.pending = [];
    save();
    const cb = settleCb;
    settleCb = null;
    if (cb) cb();
  }

  /* ---------------- 调试/测试支持 ---------------- */
  function _debugRound(n) { let k = n || 1; while (k--) advanceRound(); }
  function _debugReset() {
    data = defaultData();
    refillBoard();
    save();
    fireCharDirty(); renderAll(); refreshDots();
  }

  /* ---------------- 导出 ---------------- */
  window.MISSIONS = {
    // 查询
    busyCats, isBusy, missionOf, busyLabel, freeCats, hasPending, rounds,
    timedEligible, hasNewStage, refreshDots,
    // 行为
    dispatch, advanceRound, showSettlement,
    openPanel, closePanel, openDiscover, closeDiscover,
    onCharDirty, onLaunchStage, notifyLaunched, notifyStageCleared,
    RANDOM, TIMED, STAGES,
    _debugRound, _debugReset
  };

  // 首次加载即刷新红点状态（DOM 就绪后 game.js 也会再调一次）
  setTimeout(refreshDots, 0);
})();
