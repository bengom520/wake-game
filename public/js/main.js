/**
 * 修仙：挂机觉醒 - 前端入口（Vue 3 全局版，纯浏览器 JS，无构建）
 * 状态：登录页 + 主城页（战斗/挂机已通，其余模块待接）
 */
const { createApp, ref, onMounted, computed } = Vue;
const api = window.api;

const App = {
  setup() {
    const view = ref('login');
    const msg = ref('');
    const loading = ref(false);
    const username = ref('');
    const password = ref('');
    const nickname = ref('');
    const isRegister = ref(false);

    const game = ref(null);
    const battleLog = ref([]);
    const battleRewards = ref(null);
    const currentChapter = ref(1);
    const currentStage = ref(1);
    const afkInfo = ref(null);

    const playerName = computed(() => (game.value && game.value.player && game.value.player.nickname) || '道友');
    const lingStone = computed(() => (game.value && game.value.player && game.value.player.ling_stone) || 0);

    async function checkLogin() {
      const r = await api.me();
      if (r.ok) { await loadGame(); view.value = 'game'; }
      else view.value = 'login';
    }

    async function doAuth() {
      msg.value = '';
      if (!username.value || !password.value) { msg.value = '请填写用户名和密码'; return; }
      loading.value = true;
      try {
        const r = isRegister.value
          ? await api.register(username.value, password.value, nickname.value || username.value)
          : await api.login(username.value, password.value);
        if (r.ok) { await loadGame(); view.value = 'game'; }
        else msg.value = r.msg;
      } catch (e) {
        msg.value = '网络错误：' + ((e && e.message) || e);
      } finally {
        loading.value = false;
      }
    }

    async function logout() {
      await api.logout();
      game.value = null;
      view.value = 'login';
    }

    async function loadGame() {
      const r = await api.game();
      if (r.ok) game.value = r;
      else msg.value = r.msg;
    }

    async function doFight() {
      msg.value = '';
      const r = await api.fight(currentChapter.value, currentStage.value);
      if (!r.ok) { msg.value = r.msg; return; }
      battleLog.value = r.log || [];
      battleRewards.value = r.rewards;
      view.value = 'battle';
      if (r.win) {
        currentStage.value = Math.min(50, currentStage.value + 1);
        await loadGame();
      }
    }

    async function collectAfk() {
      const r = await api.afkCollect();
      if (r.ok) {
        afkInfo.value = r;
        msg.value = `${r.msg} → 灵石 +${r.rewards.ling} 灵气 +${r.rewards.spirit}`;
        await loadGame();
      } else msg.value = r.msg;
    }

    onMounted(checkLogin);

    return {
      view, msg, loading, username, password, nickname, isRegister,
      game, battleLog, battleRewards, currentChapter, currentStage, afkInfo,
      playerName, lingStone,
      doAuth, logout, doFight, collectAfk, loadGame,
    };
  },

  template: `
    <!-- 登录/注册页 -->
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

    <!-- 主城页 -->
    <div v-else-if="view === 'game'" class="game-page">
      <header class="top-bar">
        <span class="nick">{{ playerName }}</span>
        <span class="res">💎 {{ lingStone }} 灵石</span>
        <button class="btn-sm" @click="logout">登出</button>
      </header>

      <p v-if="msg" class="toast">{{ msg }}</p>

      <nav class="grid-menu">
        <button class="grid-item" @click="currentChapter=1; currentStage=1; doFight()">
          ⚔️ 闯关<br><small>第 {{ currentChapter }} 章 · {{ currentStage }} 关</small>
        </button>
        <button class="grid-item" @click="collectAfk()">
          🏖️ 挂机领取<br><small>次神核心</small>
        </button>
        <button class="grid-item" @click="msg='英雄养成（待实现）'">👥 英雄</button>
        <button class="grid-item" @click="msg='藏品系统（待实现）'">🏺 藏品</button>
        <button class="grid-item" @click="msg='羁绊系统（待实现）'">🔗 羁绊</button>
        <button class="grid-item" @click="msg='招募（待实现）'">🎴 招募</button>
        <button class="grid-item" @click="msg='功勋商店（待实现）'">🏪 商店</button>
        <button class="grid-item" @click="msg='任务中心（待实现）'">📋 任务</button>
      </nav>

      <section v-if="game" class="panel">
        <h3>🧙 上阵英雄</h3>
        <div class="hero-row">
          <div v-for="h in game.heroes.filter(x=>x.slot>=0)" :key="h.id" class="hero-chip">
            <img :src="h.img" :alt="h.name" @error="$event.target.style.display='none'">
            <span>{{ h.name }} Lv.{{ h.level }}</span>
          </div>
          <span v-if="game.heroes.filter(x=>x.slot>=0).length === 0" class="muted">尚未上阵（去「英雄」页上阵）</span>
        </div>

        <h3>🔗 羁绊</h3>
        <div class="bond-row">
          <span v-for="b in game.bonds" :key="b.key" class="bond-chip" :class="{active: b.active}">
            {{ b.name }} {{ b.owned }}/{{ b.total }} {{ b.active ? '✅' : '' }}
          </span>
        </div>

        <h3>📖 章节进度</h3>
        <div class="chapter-row">
          <div v-for="ch in game.chapters" :key="ch.id" class="chapter-chip">
            第{{ ch.id }}章 {{ ch.name }} · {{ ch.cleared_stage }}/50
          </div>
        </div>
      </section>
    </div>

    <!-- 战斗结果页 -->
    <div v-else class="battle-page">
      <header class="top-bar">
        <button class="btn-sm" @click="view='game'; battleLog=[]">← 返回主城</button>
        <span class="res">第 {{ currentChapter }} 章 · {{ currentStage }} 关</span>
      </header>
      <div class="battle-log">
        <p v-for="(l,i) in battleLog" :key="i">{{ l }}</p>
      </div>
      <div v-if="battleRewards && battleRewards.ling > 0" class="reward-box">
        🎁 胜利奖励：灵石 +{{ battleRewards.ling }} · 修为 +{{ battleRewards.exp }} · 灵气 +{{ battleRewards.spirit }}
      </div>
      <button class="btn-primary btn-block" @click="view='game'; doFight()">继续下一关</button>
    </div>
  `,
};

const app = createApp(App);
app.mount('#app');
