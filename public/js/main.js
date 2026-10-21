/**
 * 修仙：挂机觉醒 v2.0 - 前端主程序
 * 多视图 + 战斗动画 + 抽卡翻牌 + 数字滚动
 */
const { createApp, ref, onMounted, computed, nextTick } = Vue;
const api = window.api;

// ─── 数字滚动动画工具 ───
function animateNumber(el, from, to, duration = 800) {
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const p = Math.min(1, (now - start) / duration);
    const val = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    el.textContent = val.toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const App = {
  setup() {
    // ─── 全局状态 ───
    const view = ref('login'); // login | game | heroes | gacha | battle | artifacts | bonds | shop | tasks | chapters
    const msg = ref('');
    const loading = ref(false);
    const username = ref('');
    const password = ref('');
    const nickname = ref('');
    const isRegister = ref(false);

    // ─── 游戏数据 ───
    const game = ref(null);
    const heroesList = ref([]);
    const gachaInfo = ref(null);
    const gachaResult = ref(null);
    const shopData = ref(null);
    const tasksData = ref(null);
    const artifactsData = ref(null);
    const chaptersData = ref(null);
    const bondsData = ref(null);

    // ─── 战斗状态 ───
    const battleLog = ref([]);
    const battleRewards = ref(null);
    const battleWin = ref(false);
    const currentChapter = ref(1);
    const currentStage = ref(1);
    const battleAnim = ref([]); // 动画帧 { actor, target, dmg, crit, round }

    // ─── 挂机 ───
    const afkInfo = ref(null);
    const showAfkModal = ref(false);

    // ─── 弹窗 ───
    const showGachaModal = ref(false);
    const gachaCards = ref([]);

    // ─── 计算属性 ───
    const playerName = computed(() => (game.value?.player?.nickname) || '道友');
    const lingStone = computed(() => (game.value?.player?.ling_stone) || 0);
    const spirit = computed(() => (game.value?.player?.spirit) || 0);
    const gongxun = computed(() => (game.value?.player?.gongxun) || 0);
    const realmLevel = computed(() => {
      const lv = game.value?.player?.realm_level || 1;
      return ['练气','筑基','金丹','元婴','化神'][lv-1] || '练气';
    });

    // ─── 消息提示 ───
    function toast(text) {
      msg.value = text;
      setTimeout(() => { if (msg.value === text) msg.value = ''; }, 3000);
    }

    // ─── 登录/注册 ───
    async function checkLogin() {
      const r = await api.me();
      if (r.ok) { await loadGame(); view.value = 'game'; }
      else view.value = 'login';
    }

    async function doAuth() {
      msg.value = '';
      if (!username.value || !password.value) { toast('请填写用户名和密码'); return; }
      loading.value = true;
      try {
        const r = isRegister.value
          ? await api.register(username.value, password.value, nickname.value || username.value)
          : await api.login(username.value, password.value);
        if (r.ok) { await loadGame(); view.value = 'game'; }
        else toast(r.msg);
      } catch (e) { toast('网络错误：' + (e?.message || e)); }
      finally { loading.value = false; }
    }

    async function logout() {
      await api.logout();
      game.value = null;
      view.value = 'login';
    }

    // ─── 加载主城数据 ───
    async function loadGame() {
      const r = await api.game();
      if (r.ok) {
        const oldLing = game.value?.player?.ling_stone || 0;
        game.value = r;
        // 数字滚动动画
        nextTick(() => {
          const el = document.querySelector('.res-ling');
          if (el) animateNumber(el, oldLing, r.player.ling_stone);
        });
      } else toast(r.msg);
    }

    // ─── 视图切换 ───
    async function navigate(v) {
      view.value = v;
      if (v === 'heroes') await loadHeroes();
      if (v === 'gacha') await loadGacha();
      if (v === 'artifacts') await loadArtifacts();
      if (v === 'bonds') await loadBonds();
      if (v === 'shop') await loadShop();
      if (v === 'tasks') await loadTasks();
      if (v === 'chapters') await loadChapters();
    }

    // ─── 英雄 ───
    async function loadHeroes() {
      const r = await api.heroes();
      if (r.ok) heroesList.value = r.heroes;
    }

    async function deployHero(id, slot) {
      const r = await api.heroDeploy(id, slot);
      if (r.ok) { toast(r.msg); await loadHeroes(); await loadGame(); }
      else toast(r.msg);
    }

    async function levelupHero(id) {
      const r = await api.heroLevelup(id);
      if (r.ok) { toast(r.msg); await loadHeroes(); await loadGame(); }
      else toast(r.msg);
    }

    async function starupHero(id) {
      const r = await api.heroStarup(id);
      if (r.ok) { toast(r.msg); await loadHeroes(); await loadGame(); }
      else toast(r.msg);
    }

    // ─── 抽卡 ───
    async function loadGacha() {
      const r = await api.gachaInfo();
      if (r.ok) gachaInfo.value = r;
    }

    async function doSingle() {
      const r = await api.gachaSingle();
      if (!r.ok) { toast(r.msg); return; }
      gachaCards.value = [{ name: r.name, quality: r.quality, key: r.key, action: r.action }];
      showGachaModal.value = true;
      await loadGacha(); await loadGame();
    }

    async function doTen() {
      const r = await api.gachaTen();
      if (!r.ok) { toast(r.msg); return; }
      gachaCards.value = r.results;
      showGachaModal.value = true;
      await loadGacha(); await loadGame();
    }

    // ─── 战斗 ───
    async function doFight(chapter, stage) {
      chapter = chapter || currentChapter.value;
      stage = stage || currentStage.value;
      currentChapter.value = chapter;
      currentStage.value = stage;

      const r = await api.fight(chapter, stage);
      if (!r.ok) { toast(r.msg); return; }

      battleLog.value = [];
      battleRewards.value = r.rewards;
      battleWin.value = r.win;
      view.value = 'battle';

      // 逐行动画显示日志
      r.log.forEach((line, i) => {
        setTimeout(() => { battleLog.value.push(line); }, i * 400);
      });

      if (r.win) {
        currentStage.value = Math.min(50, stage + 1);
        setTimeout(() => loadGame(), r.log.length * 400);
      }
    }

    // ─── 挂机 ───
    async function collectAfk() {
      const r = await api.afkCollect();
      if (r.ok) {
        afkInfo.value = r;
        showAfkModal.value = true;
        await loadGame();
      } else toast(r.msg);
    }

    // ─── 商店 ───
    async function loadShop() {
      const r = await api.shop();
      if (r.ok) shopData.value = r;
    }

    async function buyItem(key) {
      const r = await api.shopBuy(key);
      if (r.ok) { toast(r.msg); await loadShop(); await loadGame(); }
      else toast(r.msg);
    }

    // ─── 任务 ───
    async function loadTasks() {
      const r = await api.tasks();
      if (r.ok) tasksData.value = r;
    }

    async function claimTask(key) {
      const r = await api.taskClaim(key);
      if (r.ok) { toast(r.msg); await loadTasks(); await loadGame(); }
      else toast(r.msg);
    }

    // ─── 藏品 ───
    async function loadArtifacts() {
      const r = await api.artifacts();
      if (r.ok) artifactsData.value = r;
    }

    async function upgradeArtifact(key) {
      const r = await api.artifactUpgrade(key);
      if (r.ok) { toast(r.msg); await loadArtifacts(); await loadGame(); }
      else toast(r.msg);
    }

    // ─── 章节 ───
    async function loadChapters() {
      const r = await api.chapters();
      if (r.ok) chaptersData.value = r;
    }

    async function fightBoss(chapter) {
      const r = await api.chapterBoss(chapter);
      if (!r.ok) { toast(r.msg); return; }
      battleLog.value = [];
      battleWin.value = r.win;
      battleRewards.value = { ling: 0, exp: 0, spirit: 0 };
      view.value = 'battle';
      r.log.forEach((line, i) => {
        setTimeout(() => { battleLog.value.push(line); }, i * 400);
      });
      if (r.win) setTimeout(() => loadChapters(), r.log.length * 400);
    }

    // ─── 羁绊 ───
    async function loadBonds() {
      const r = await api.bonds();
      if (r.ok) bondsData.value = r;
    }

    // ─── 品质颜色 ───
    function qualityColor(q) {
      return ['', '#aaa','#4a90e2','#9b59b6','#f39c12','#e74c3c'][q] || '#aaa';
    }
    function qualityName(q) {
      return ['','白','蓝','紫','金','红'][q] || '?';
    }

    onMounted(checkLogin);

    return {
      view, msg, loading, username, password, nickname, isRegister,
      game, heroesList, gachaInfo, gachaResult, shopData, tasksData,
      artifactsData, chaptersData, bondsData,
      battleLog, battleRewards, battleWin, currentChapter, currentStage, battleAnim,
      afkInfo, showAfkModal, showGachaModal, gachaCards,
      playerName, lingStone, spirit, gongxun, realmLevel,
      doAuth, logout, loadGame, navigate,
      deployHero, levelupHero, starupHero,
      doSingle, doTen,
      doFight, collectAfk, buyItem, claimTask, upgradeArtifact, fightBoss,
      qualityColor, qualityName, toast,
    };
  },

  template: `
    <!-- ═══════ 登录页 ═══════ -->
    <div v-if="view === 'login'" class="auth-page">
      <div class="auth-card">
        <h1 class="game-title">修仙：挂机觉醒</h1>
        <p class="game-sub">Awakening of the Idle Cultivator</p>
        <div class="auth-tabs">
          <button :class="{active: !isRegister}" @click="isRegister=false; msg=''">登录</button>
          <button :class="{active: isRegister}" @click="isRegister=true; msg=''">注册</button>
        </div>
        <label>道号<input v-model="username" placeholder="用户名" autocomplete="username"></label>
        <label>秘钥<input v-model="password" type="password" placeholder="密码（≥6位）" autocomplete="current-password"></label>
        <label v-if="isRegister">道号名<input v-model="nickname" placeholder="游戏内名字（默认同用户名）"></label>
        <p v-if="msg" class="auth-msg">{{ msg }}</p>
        <button class="btn-primary btn-block" :disabled="loading" @click="doAuth">
          {{ loading ? '处理中…' : (isRegister ? '注册并开始' : '进入游戏') }}
        </button>
      </div>
    </div>

    <!-- ═══════ 主城页 ═══════ -->
    <div v-else-if="view === 'game'" class="game-page">
      <header class="top-bar">
        <span class="nick">⚡ {{ playerName }}</span>
        <span class="realm">{{ realmLevel }}</span>
        <span class="res res-ling">💎 {{ lingStone }}</span>
        <span class="res">✨ {{ spirit }}</span>
        <span class="res">🎖️ {{ gongxun }}</span>
        <button class="btn-sm" @click="logout">登出</button>
      </header>

      <p v-if="msg" class="toast">{{ msg }}</p>

      <!-- 挂机横幅 -->
      <div class="afk-banner" @click="collectAfk">
        <span>🏖️ 挂机收益待领取</span>
        <button class="btn-primary btn-sm">领取</button>
      </div>

      <!-- 主功能宫格 -->
      <nav class="grid-menu">
        <button class="grid-item" @click="navigate('chapters')">
          <span class="grid-icon">⚔️</span>闯关<br><small>第{{ currentChapter }}章·{{ currentStage }}关</small>
        </button>
        <button class="grid-item" @click="collectAfk">
          <span class="grid-icon">🏖️</span>挂机<br><small>离线收益</small>
        </button>
        <button class="grid-item" @click="navigate('heroes')">
          <span class="grid-icon">👥</span>英雄<br><small>上阵/养成</small>
        </button>
        <button class="grid-item" @click="navigate('gacha')">
          <span class="grid-icon">🎴</span>招募<br><small>云台招将</small>
        </button>
        <button class="grid-item" @click="navigate('artifacts')">
          <span class="grid-icon">🏺</span>藏品<br><small>收集强化</small>
        </button>
        <button class="grid-item" @click="navigate('bonds')">
          <span class="grid-icon">🔗</span>羁绊<br><small>缘分加成</small>
        </button>
        <button class="grid-item" @click="navigate('shop')">
          <span class="grid-icon">🏪</span>商店<br><small>功勋兑换</small>
        </button>
        <button class="grid-item" @click="navigate('tasks')">
          <span class="grid-icon">📋</span>任务<br><small>每日奖励</small>
        </button>
      </nav>

      <!-- 上阵英雄预览 -->
      <section v-if="game" class="panel">
        <h3>🧙 上阵阵容</h3>
        <div class="hero-row">
          <div v-for="h in game.heroes.filter(x=>x.slot>=0)" :key="h.id" class="hero-chip"
               :style="{borderColor: qualityColor(h.quality)}">
            <div class="hero-avatar" :style="{background: qualityColor(h.quality)+'33'}">
              {{ h.name.charAt(0) }}
            </div>
            <span class="hero-name">{{ h.name }}</span>
            <span class="hero-lv">Lv.{{ h.level }} {{ '★'.repeat(h.star) }}</span>
          </div>
          <span v-if="game.heroes.filter(x=>x.slot>=0).length===0" class="muted">尚未上阵</span>
        </div>

        <h3>🔗 激活羁绊</h3>
        <div class="bond-row">
          <span v-for="b in game.bonds.filter(x=>x.active)" :key="b.key" class="bond-chip active">
            {{ b.name }} ✅
          </span>
          <span v-if="game.bonds.filter(x=>x.active).length===0" class="muted">暂无激活羁绊</span>
        </div>
      </section>
    </div>

    <!-- ═══════ 英雄页 ═══════ -->
    <div v-else-if="view === 'heroes'" class="page">
      <header class="top-bar">
        <button class="btn-sm" @click="navigate('game')">← 返回</button>
        <span class="page-title">👥 英雄阵容</span>
      </header>
      <p v-if="msg" class="toast">{{ msg }}</p>

      <!-- 上阵槽位 -->
      <div class="deploy-slots">
        <div v-for="slot in 5" :key="slot" class="slot" @click="deployHero(0, slot-1)" :data-slot="slot">
          {{ ['前排','前排','中排','后排','后排'][slot-1] }}
        </div>
      </div>

      <!-- 英雄列表 -->
      <div class="hero-list">
        <div v-for="h in heroesList" :key="h.id" class="hero-card"
             :style="{borderTop: `3px solid ${qualityColor(h.quality)}`}">
          <div class="hero-card-left">
            <div class="hero-avatar-lg" :style="{background: qualityColor(h.quality)+'33'}">
              {{ h.name.charAt(0) }}
            </div>
            <div>
              <div class="hero-card-name" :style="{color: qualityColor(h.quality)}">
                {{ h.name }} <small>{{ qualityName(h.quality) }} {{ '★'.repeat(h.star) }}</small>
              </div>
              <div class="hero-card-info">{{ h.role }} · {{ h.skill }}</div>
              <div class="hero-card-lv">Lv.{{ h.level }}</div>
            </div>
          </div>
          <div class="hero-card-actions">
            <button class="btn-sm" @click="deployHero(h.id, h.slot>=0 ? -1 : 0)">
              {{ h.slot >= 0 ? '下阵' : '上阵' }}
            </button>
            <button class="btn-sm" @click="levelupHero(h.id)">升级({{ h.level*50 }}💎)</button>
            <button class="btn-sm" @click="starupHero(h.id)">升星({{ h.star*200+100 }}💎)</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ 抽卡页 ═══════ -->
    <div v-else-if="view === 'gacha'" class="page">
      <header class="top-bar">
        <button class="btn-sm" @click="navigate('game')">← 返回</button>
        <span class="page-title">🎴 云台招将</span>
      </header>
      <p v-if="msg" class="toast">{{ msg }}</p>

      <div v-if="gachaInfo" class="gacha-panel">
        <div class="gacha-pity">保底进度：{{ gachaInfo.pity_count }}/50（50抽必金）</div>
        <div class="gacha-actions">
          <button class="btn-primary" @click="doSingle">单抽（{{ gachaInfo.cost_single }}💎）</button>
          <button class="btn-primary gold" @click="doTen">十连（{{ gachaInfo.cost_ten }}💎）</button>
        </div>
        <div class="gacha-balance">当前灵石：💎 {{ gachaInfo.ling_stone }}</div>
      </div>

      <!-- 抽卡结果弹窗 -->
      <div v-if="showGachaModal" class="modal-overlay" @click.self="showGachaModal=false">
        <div class="gacha-modal">
          <h3>✨ 招将结果 ✨</h3>
          <div class="gacha-cards">
            <div v-for="(card, i) in gachaCards" :key="i" class="gacha-card"
                 :style="{borderColor: qualityColor(card.quality), background: qualityColor(card.quality)+'11'}"
                 :class="{flip: true}">
              <div class="gacha-card-name" :style="{color: qualityColor(card.quality)}">
                {{ card.name }}
              </div>
              <div class="gacha-card-quality">{{ qualityName(card.quality) }}</div>
              <div class="gacha-card-action">{{ card.action }}</div>
            </div>
          </div>
          <button class="btn-primary btn-block" @click="showGachaModal=false">收入麾下</button>
        </div>
      </div>
    </div>

    <!-- ═══════ 战斗页 ═══════ -->
    <div v-else-if="view === 'battle'" class="page battle-page">
      <header class="top-bar">
        <button class="btn-sm" @click="navigate('game')">← 返回</button>
        <span class="page-title">⚔️ 战斗中</span>
        <span class="res">{{ battleWin ? '🎉 胜利' : '💀 失败' }}</span>
      </header>

      <div class="battle-arena">
        <div class="fighter">我方阵容</div>
        <div class="vs">VS</div>
        <div class="fighter enemy">敌方妖物</div>
      </div>

      <div class="battle-log">
        <p v-for="(l, i) in battleLog" :key="i" class="log-line">{{ l }}</p>
      </div>

      <div v-if="battleRewards && battleRewards.ling > 0" class="reward-box">
        🎁 胜利奖励：💎{{ battleRewards.ling }} · 📖{{ battleRewards.exp }} · ✨{{ battleRewards.spirit }}
      </div>
      <button v-if="battleWin" class="btn-primary btn-block" @click="doFight(currentChapter, currentStage)">继续下一关</button>
    </div>

    <!-- ═══════ 藏品页 ═══════ -->
    <div v-else-if="view === 'artifacts'" class="page">
      <header class="top-bar">
        <button class="btn-sm" @click="navigate('game')">← 返回</button>
        <span class="page-title">🏺 藏品</span>
      </header>
      <p v-if="msg" class="toast">{{ msg }}</p>
      <div v-if="artifactsData" class="artifact-grid">
        <div v-for="a in artifactsData.artifacts" :key="a.key" class="artifact-card"
             :class="{owned: a.owned}">
          <div class="artifact-icon">{{ a.owned ? '🏺' : '❓' }}</div>
          <div class="artifact-name">{{ a.owned ? a.name : '？？？' }}</div>
          <div class="artifact-effect">{{ a.owned ? a.effect : '通关章节解锁' }}</div>
          <div v-if="a.owned" class="artifact-lv">Lv.{{ a.level }}</div>
          <button v-if="a.owned" class="btn-sm" @click="upgradeArtifact(a.key)">升级({{ a.level*100+50 }}💎)</button>
        </div>
      </div>
    </div>

    <!-- ═══════ 羁绊页 ═══════ -->
    <div v-else-if="view === 'bonds'" class="page">
      <header class="top-bar">
        <button class="btn-sm" @click="navigate('game')">← 返回</button>
        <span class="page-title">🔗 羁绊</span>
      </header>
      <div v-if="bondsData" class="bond-list">
        <div v-for="b in bondsData.bonds" :key="b.key" class="bond-card" :class="{owned: b.owned}">
          <div class="bond-name">{{ b.name }}</div>
          <div class="bond-members">{{ b.members.join(' + ') }}</div>
          <div class="bond-effect">{{ b.effect }}</div>
          <div class="bond-status">{{ b.owned ? '✅ 已激活' : '🔒 未激活' }}</div>
        </div>
      </div>
    </div>

    <!-- ═══════ 商店页 ═══════ -->
    <div v-else-if="view === 'shop'" class="page">
      <header class="top-bar">
        <button class="btn-sm" @click="navigate('game')">← 返回</button>
        <span class="page-title">🏪 功勋商店</span>
        <span class="res">🎖️ {{ shopData?.gongxun || 0 }}</span>
      </header>
      <p v-if="msg" class="toast">{{ msg }}</p>
      <div v-if="shopData" class="shop-list">
        <div v-for="item in shopData.items" :key="item.key" class="shop-card">
          <div class="shop-info">
            <div class="shop-name">{{ item.name }}</div>
            <div class="shop-desc">{{ item.desc }}</div>
            <div class="shop-limit">限购：剩余 {{ item.remaining }}/{{ item.limit }}</div>
          </div>
          <button class="btn-primary" :disabled="item.remaining<=0" @click="buyItem(item.key)">
            {{ item.cost }}🎖️
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════ 任务页 ═══════ -->
    <div v-else-if="view === 'tasks'" class="page">
      <header class="top-bar">
        <button class="btn-sm" @click="navigate('game')">← 返回</button>
        <span class="page-title">📋 每日任务</span>
      </header>
      <p v-if="msg" class="toast">{{ msg }}</p>
      <div v-if="tasksData" class="task-list">
        <div v-for="t in tasksData.tasks" :key="t.key" class="task-card" :class="{claimed: t.claimed}">
          <div class="task-info">
            <div class="task-name">{{ t.name }}</div>
            <div class="task-desc">{{ t.desc }}</div>
            <div class="task-progress">进度：{{ t.progress }}/{{ t.target }}</div>
            <div class="task-reward">奖励：{{ t.reward_gongxun }}🎖️ {{ t.reward_ling ? '💎'+t.reward_ling : '' }}</div>
          </div>
          <button v-if="!t.claimed && t.done" class="btn-primary" @click="claimTask(t.key)">领取</button>
          <span v-else-if="t.claimed" class="muted">已领取</span>
          <span v-else class="muted">未完成</span>
        </div>
      </div>
    </div>

    <!-- ═══════ 章节页 ═══════ -->
    <div v-else-if="view === 'chapters'" class="page">
      <header class="top-bar">
        <button class="btn-sm" @click="navigate('game')">← 返回</button>
        <span class="page-title">⚔️ 闯关</span>
      </header>
      <p v-if="msg" class="toast">{{ msg }}</p>
      <div v-if="chaptersData" class="chapter-list">
        <div v-for="ch in chaptersData.chapters" :key="ch.id" class="chapter-card">
          <div class="chapter-info">
            <div class="chapter-name">第{{ ch.id }}章 · {{ ch.name }}</div>
            <div class="chapter-progress">进度：{{ ch.cleared_stage }}/50</div>
            <div class="chapter-boss">
              Boss：{{ ch.boss_name }} {{ ch.boss_cleared ? '✅已击败' : '🔒' }}
            </div>
          </div>
          <div class="chapter-actions">
            <button class="btn-primary" @click="doFight(ch.id, Math.min(ch.cleared_stage+1, 50))">
              {{ ch.cleared_stage >= 50 ? ('已通关' + (ch.boss_cleared ? '' : '·打Boss')) : `挑战第 ${ch.cleared_stage+1} 关` }}
            </button>
            <button v-if="ch.cleared_stage >= 50 && !ch.boss_cleared" class="btn-primary gold"
                    @click="fightBoss(ch.id)">
              ⚔️ Boss战
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ 挂机收益弹窗 ═══════ -->
    <div v-if="showAfkModal" class="modal-overlay" @click.self="showAfkModal=false">
      <div class="afk-modal">
        <h3>🏖️ 挂机收益</h3>
        <p>{{ afkInfo?.msg }}</p>
        <div class="afk-rewards">
          <div class="afk-reward">💎 灵石 +{{ afkInfo?.rewards?.ling || 0 }}</div>
          <div class="afk-reward">✨ 灵气 +{{ afkInfo?.rewards?.spirit || 0 }}</div>
          <div v-if="afkInfo?.rewards?.stone" class="afk-reward">💎 星石 +{{ afkInfo.rewards.stone }}</div>
          <div v-if="afkInfo?.rewards?.pill" class="afk-reward">💊 神药 +{{ afkInfo.rewards.pill }}</div>
        </div>
        <button class="btn-primary btn-block" @click="showAfkModal=false">收下收益</button>
      </div>
    </div>
  `,
};

const app = createApp(App);
app.mount('#app');
