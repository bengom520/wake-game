-- 修仙：挂机觉醒 v1.0 - 种子数据
-- 用法：wrangler d1 execute wake-game-db --remote --file=workers/db/seed.sql

-- ─── 11 英雄模板 ───
DELETE FROM site_meta WHERE mkey LIKE 'template:%';
INSERT INTO site_meta (mkey, mval) VALUES
  ('template:heroes', '[
    {"key":"prince","name":"王子","quality":5,"attack":150,"role":"主C","skill":"王威/继承者","img":"/assets/heroes/01-prince.png"},
    {"key":"knight","name":"骑士","quality":4,"attack":130,"hp":1.3,"role":"坦克","skill":"铁壁/冲锋","img":"/assets/heroes/02-knight.png"},
    {"key":"mage","name":"法师","quality":4,"attack":120,"role":"群攻","skill":"冰爆/烈焰","img":"/assets/heroes/03-mage.png"},
    {"key":"archer","name":"弓箭手","quality":3,"attack":110,"role":"远程","skill":"穿透箭/陷阱","img":"/assets/heroes/04-archer.png"},
    {"key":"assassin","name":"刺客","quality":3,"attack":100,"role":"爆发","skill":"影袭/瞬杀","img":"/assets/heroes/05-assassin.png"},
    {"key":"priest","name":"祭司","quality":2,"attack":70,"role":"治疗","skill":"圣愈/净化","img":"/assets/heroes/06-priest.png"},
    {"key":"paladin","name":"圣骑士","quality":5,"attack":140,"role":"护盾","skill":"圣盾/裁决","img":"/assets/heroes/07-paladin.png"},
    {"key":"druid","name":"德鲁伊","quality":2,"attack":80,"role":"召唤","skill":"树人/自然之力","img":"/assets/heroes/08-druid.png"},
    {"key":"bard","name":"吟游诗人","quality":2,"attack":75,"role":"辅助","skill":"战歌/buff","img":"/assets/heroes/09-bard.png"},
    {"key":"monk","name":"武僧","quality":3,"attack":105,"role":"反击","skill":"金刚身/反击","img":"/assets/heroes/10-monk.png"},
    {"key":"summoner","name":"召唤师","quality":4,"attack":125,"role":"召唤","skill":"召唤兽/强化","img":"/assets/heroes/11-summoner.png"}
  ]');

-- ─── 4 章节 + BOSS ───
INSERT INTO site_meta (mkey, mval) VALUES
  ('template:chapters', '[
    {"id":1,"name":"觉醒之路","stages":50,"boss":"shadow_king","boss_name":"影之王","reward":"ling_10000 + 藏品「苏醒之刃」","img":"/assets/chapters/1.png"},
    {"id":2,"name":"王座争夺","stages":50,"boss":"iron_emperor","boss_name":"铁之王","reward":"ling_20000 + 藏品「铁王冠」","img":"/assets/chapters/2.png"},
    {"id":3,"name":"深渊试炼","stages":50,"boss":"abyss_lord","boss_name":"深渊领主","reward":"ling_50000 + 藏品「深渊之眼」","img":"/assets/chapters/3.png"},
    {"id":4,"name":"光之觉醒","stages":50,"boss":"final_prince","boss_name":"最终君主","reward":"全技能解锁 + 称号「光之神」","img":"/assets/chapters/4.png"}
  ]');

-- ─── 羁绊（次神特色）──
INSERT INTO site_meta (mkey, mval) VALUES
  ('template:bonds', '[
    {"key":"brotherhood_2","name":"兄弟情深","members":["prince","knight"],"bonus":"atk+10%","img":"/assets/bonds/1.png"},
    {"key":"royal_3","name":"王国铁三角","members":["prince","knight","paladin"],"bonus":"hp+25%","img":"/assets/bonds/2.png"},
    {"key":"light_5","name":"光之五重奏","members":["prince","knight","mage","archer","paladin"],"bonus":"all+30%","img":"/assets/bonds/3.png"},
    {"key":"shadow_2","name":"影与光","members":["assassin","mage"],"bonus":"crit+20%","img":"/assets/bonds/4.png"},
    {"key":"nature_2","name":"自然之盟","members":["druid","priest"],"bonus":"heal+40%","img":"/assets/bonds/5.png"},
    {"key":"trinity_3","name":"元素三重奏","members":["mage","archer","summoner"],"bonus":"magic+30%","img":"/assets/bonds/6.png"}
  ]');

-- ─── 藏品（次神特色）──
INSERT INTO site_meta (mkey, mval) VALUES
  ('template:artifacts', '[
    {"key":"reaper_knife","name":"死神餐刀","type":"餐具","effect":"atk+20%","chapter":2,"img":"/assets/artifacts/1.png"},
    {"key":"gold_bowl","name":"金饭碗","type":"餐具","effect":"ling_rate+30%","chapter":2,"img":"/assets/artifacts/2.png"},
    {"key":"goddess","name":"胜利女神像","type":"雕像","effect":"crit+15%","chapter":3,"img":"/assets/artifacts/3.png"},
    {"key":"wind_mask","name":"风之面具","type":"面具","effect":"dodge+30%","chapter":3,"img":"/assets/artifacts/4.png"},
    {"key":"awaken_blade","name":"苏醒之刃","type":"武器","effect":"atk+35%","chapter":1,"img":"/assets/artifacts/5.png"},
    {"key":"iron_crown","name":"铁王冠","type":"王冠","effect":"def+40%","chapter":2,"img":"/assets/artifacts/6.png"},
    {"key":"abyss_eye","name":"深渊之眼","type":"饰品","effect":"magic+25%","chapter":3,"img":"/assets/artifacts/7.png"},
    {"key":"light_seal","name":"光明之印","type":"印章","effect":"all+15%","chapter":4,"img":"/assets/artifacts/8.png"}
  ]');

-- ─── 每日任务（8 个）──
INSERT INTO site_meta (mkey, mval) VALUES
  ('template:daily_tasks', '[
    {"key":"daily_login","name":"今日登录","desc":"登录游戏","target":1,"reward_gongxun":5,"reward_ling":0,"reward_spirit":0},
    {"key":"daily_summon","name":"招募 1 次","desc":"在云台招将","target":1,"reward_gongxun":5,"reward_ling":0,"reward_spirit":0},
    {"key":"daily_battle","name":"闯关 5 次","desc":"在剧情关卡中获胜 5 次","target":5,"reward_gongxun":15,"reward_ling":100,"reward_spirit":0},
    {"key":"daily_afk","name":"挂机 1 小时","desc":"累计挂机 60 分钟","target":60,"reward_gongxun":10,"reward_ling":200,"reward_spirit":0},
    {"key":"daily_artifact","name":"升级藏品 1 次","desc":"升级任意藏品 1 次","target":1,"reward_gongxun":8,"reward_ling":0,"reward_spirit":0},
    {"key":"daily_boss","name":"挑战 BOSS","desc":"击败任意章节 BOSS","target":1,"reward_gongxun":20,"reward_ling":300,"reward_spirit":0},
    {"key":"daily_bond","name":"激活羁绊 1 个","desc":"上阵触发任意羁绊","target":1,"reward_gongxun":12,"reward_ling":0,"reward_spirit":0},
    {"key":"daily_shop","name":"商店消费 100 灵石","desc":"在功勋商店消费累计 100 灵石","target":100,"reward_gongxun":10,"reward_ling":0,"reward_spirit":0}
  ]');

-- ─── 功勋商店（8 商品）──
INSERT INTO site_meta (mkey, mval) VALUES
  ('template:shop_items', '[
    {"key":"summon_1","name":"单抽招募券 ×1","cost":30,"period":"daily","limit":5,"type":"free_summon_1","desc":"可在「云台招将」抵一次单抽的灵石消耗"},
    {"key":"summon_10","name":"十连招募券 ×1","cost":250,"period":"weekly","limit":1,"type":"free_summon_10","desc":"可在「云台招将」抵一次十连的灵石消耗"},
    {"key":"foundation_pill","name":"突破丹 ×1","cost":50,"period":"weekly","limit":3,"type":"item","item_key":"foundation_pill","desc":"渡劫成功率 +30%"},
    {"key":"revive_token","name":"复活符 ×1","cost":15,"period":"daily","limit":10,"type":"item","item_key":"revive_token","desc":"游历九死一生时免陨落"},
    {"key":"god_pill","name":"神药 ×1","cost":80,"period":"daily","limit":2,"type":"item","item_key":"god_pill","desc":"修为 +50%"},
    {"key":"ling_stone_1000","name":"1000 灵石","cost":20,"period":"daily","limit":3,"type":"ling","qty":1000,"desc":"立即获得 1000 灵石"},
    {"key":"artifact_token_10","name":"精魄 ×10","cost":60,"period":"weekly","limit":5,"type":"item","item_key":"artifact_token","qty":10,"desc":"升级藏品的材料"},
    {"key":"title_gongxun","name":"称号「功勋之首」","cost":500,"period":"lifetime","limit":1,"type":"title","title_name":"功勋之首","desc":"永久称号（仅一次）"}
  ]');

-- ─── 招募保底阈值 ───
INSERT INTO site_meta (mkey, mval) VALUES
  ('template:pity', '{"hero":{"purple":10,"gold":50,"red":200,"min_purple":5,"min_gold":6},"weapon":{"purple":10,"gold":50,"red":200}}'),
  ('template:summon_cost', '{"hero_ling_1":30,"hero_ling_10":250,"weapon_ling_1":60,"weapon_ling_10":500}'),
  ('template:battle_reward', '{"ling_min":15,"ling_max":40,"exp_base":20,"exp_mult":1.08,"spirit_base":10,"spirit_mult":1.05}'),
  ('template:afk', '{"max_minutes":480,"ling_per_hour":50,"spirit_per_hour":30,"stone_per_hour":5,"pill_per_hour":1}'),
  ('template:game_version', 'v1.0.0');
