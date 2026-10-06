/**
 * 战斗引擎（回合制，逻辑参考浅眠 v2.14.0 runBattle，纯 TypeScript 重写）
 * 次神风：5 人上阵（前排 2 / 中排 2 / 后排 1），按 speed 排序出手
 */

export interface Combatant {
  key: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  crit: number;        // 暴击率 0~1
  skills: string[];    // 技能 key 列表
  isEnemy: boolean;
}

export interface BattleConfig {
  stage: number;
  chapter: number;
  enemyName: string;
  enemyHp: number;
  enemyAtk: number;
  enemyDef: number;
  maxRounds: number;
}

/** 生成关卡 BOSS/怪物属性（指数成长，参考浅眠 $STAGES） */
export function generateEnemy(cfg: BattleConfig): Combatant {
  return {
    key: `enemy_${cfg.chapter}_${cfg.stage}`,
    name: cfg.enemyName,
    hp: cfg.enemyHp,
    maxHp: cfg.enemyHp,
    atk: cfg.enemyAtk,
    def: cfg.enemyDef,
    speed: 50 + Math.random() * 30,
    crit: 0.05,
    skills: ['basic_attack'],
    isEnemy: true,
  };
}

/** 玩家英雄 → Combatant */
export function heroToCombatant(hero: {
  key: string; name: string; level: number; quality: number;
  base_attack: number; hp_mult?: number;
}): Combatant {
  const lv = hero.level;
  const qualityMult = 1 + (hero.quality - 1) * 0.35;  // 品质加成
  const atk = Math.round(hero.base_attack * qualityMult * (1 + lv * 0.08));
  const hp = Math.round(100 * (hero.hp_mult ?? 1.0) * qualityMult * (1 + lv * 0.1));
  return {
    key: hero.key,
    name: hero.name,
    hp, maxHp: hp,
    atk,
    def: Math.round(atk * 0.3),
    speed: 50 + Math.random() * 30,
    crit: 0.05 + (hero.quality - 1) * 0.03,
    skills: ['basic_attack'],
    isEnemy: false,
  };
}

/** 单次伤害计算（暴击 / 克制 / 减伤） */
function calcDamage(atk: Combatant, def: Combatant): { dmg: number; crit: boolean } {
  const base = atk.atk - def.def * 0.5;
  const variance = 0.9 + Math.random() * 0.2;   // ±10% 浮动
  const isCrit = Math.random() < atk.crit;
  const critMult = isCrit ? 1.6 : 1.0;
  return { dmg: Math.max(1, Math.round(base * variance * critMult)), crit: isCrit };
}

/**
 * 执行一场战斗
 * @returns win / lose / rounds / log
 */
export function runBattle(team: Combatant[], enemy: Combatant, maxRounds = 30): {
  win: boolean; rounds: number; log: string[];
} {
  const log: string[] = [];
  const all = [...team, enemy];
  let rounds = 0;

  log.push(`⚔️ 战斗开始：${team.map(h => h.name).join('、')} vs ${enemy.name}`);

  while (rounds < maxRounds) {
    rounds++;
    // 按 speed 降序（速度高的先手）
    const order = [...all].sort((a, b) => b.speed - a.speed);

    for (const actor of order) {
      if (actor.hp <= 0) continue;
      // 选目标：敌方优先
      const targets = all.filter(t => t.hp > 0 && t.isEnemy !== actor.isEnemy);
      if (targets.length === 0) break;
      const target = targets[Math.floor(Math.random() * targets.length)];

      const { dmg, crit } = calcDamage(actor, target);
      target.hp = Math.max(0, target.hp - dmg);
      log.push(
        `R${rounds} ${actor.name} 攻击 ${target.name} → ${dmg} 伤害${crit ? '（暴击！）' : ''}` +
        `（${target.hp}/${target.maxHp}）`
      );

      if (target.hp <= 0) {
        log.push(`💀 ${target.name} 被击败！`);
      }
    }

    // 胜负判定
    if (enemy.hp <= 0) { log.push(`🎉 战斗胜利！用时 ${rounds} 回合`); return { win: true, rounds, log }; }
    if (team.every(h => h.hp <= 0)) { log.push(`💀 战斗失败…坚持 ${rounds} 回合`); return { win: false, rounds, log }; }
  }

  log.push('⏱️ 超时未分胜负，判定失败');
  return { win: false, rounds, log };
}

/** 章节关卡属性生成 */
export function stageConfig(chapter: number, stage: number): BattleConfig {
  const globalStage = (chapter - 1) * 50 + stage;
  return {
    stage,
    chapter,
    enemyName: `守关妖物 #${globalStage}`,
    enemyHp: Math.round(150 * Math.pow(1.12, globalStage)),
    enemyAtk: Math.round(30 * Math.pow(1.1, globalStage)),
    enemyDef: Math.round(10 * Math.pow(1.08, globalStage)),
    maxRounds: 30,
  };
}
