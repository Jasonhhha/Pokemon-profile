const asset = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
export const pokemonData = {
  gible: { name: '圆陆鲨', english: 'GIBLE', number: '443', type: '龙 / 地面', color: '#718eb5', habitat: '天冠山 · 岩壁洞窟', personality: '小小的身体，大大的冒险', description: '圆陆鲨从暖和的洞穴里探出头，闻到了新冒险的气息。它已经准备好和你一起出发了。', skills: ['龙之怒', '挖洞', '咬住'], asset: asset('gible.png') },
  riolu: { name: '利欧路', english: 'RIOLU', number: '447', type: '格斗', color: '#5798bc', habitat: '天冠山 · 修行石阶', personality: '波导连接着彼此的心', description: '利欧路安静地站在石阶上。感受到你的波导后，它轻轻点了点头，想成为你的同行伙伴。', skills: ['电光一闪', '双倍奉还', '发劲'], asset: asset('riolu.png') },
  piplup: { name: '波加曼', english: 'PIPLUP', number: '393', type: '水', color: '#63aacc', habitat: '心齐湖 · 湖畔码头', personality: '湖边最骄傲的小身影', description: '波加曼抖了抖身上的水珠，昂起头看着你。今天的湖水很清澈，正是练习游泳的好时候。', skills: ['泡沫', '啄', '水之波动'], asset: asset('piplup.png') },
  shinx: { name: '小猫怪', english: 'SHINX', number: '403', type: '电', color: '#6d9dc1', habitat: '双叶镇 · 201号道路', personality: '草丛里闪过一点光', description: '小猫怪的尾巴闪着微光，正好奇地观察路过的训练家。它很喜欢在小镇的花圃旁晒太阳。', skills: ['电光', '充电', '咬住'], asset: asset('shinx.png') },
  starly: { name: '姆克儿', english: 'STARLY', number: '396', type: '一般 / 飞行', color: '#92918b', habitat: '双叶镇 · 红屋顶旁', personality: '从第一声鸟鸣开始', description: '姆克儿落在小路边，歪着头唱起短短的歌。神奥的旅程，就从这个安静的早晨开始。', skills: ['电光一闪', '翅膀攻击', '叫声'], asset: asset('starly.png') },
  buizel: { name: '泳圈鼬', english: 'BUIZEL', number: '418', type: '水', color: '#df9861', habitat: '心齐湖 · 南岸浅滩', personality: '朝着水光跃进去', description: '泳圈鼬刚从湖里钻出来，尾巴还在旋转。它把一枚漂亮的小石子推到你面前。', skills: ['水流喷射', '水枪', '高速星星'], asset: asset('sinnoh/buizel.png') },
  drifloon: { name: '飘飘球', english: 'DRIFLOON', number: '425', type: '幽灵 / 飞行', color: '#b08bb8', habitat: '心齐湖 · 林间空地', personality: '风中偶然的相遇', description: '一阵轻风吹过，飘飘球晃晃悠悠地飘到了树梢旁。远处，湖面倒映着它小小的影子。', skills: ['起风', '惊吓', '聚气'], asset: asset('sinnoh/drifloon.png') },
  snover: { name: '雪笠怪', english: 'SNOVER', number: '459', type: '草 / 冰', color: '#87a79b', habitat: '天冠山 · 雪松林', personality: '雪落下来的声音', description: '雪笠怪从雪松旁走出来，身上积着薄薄的雪。山里很安静，只有脚步声和远处的风。', skills: ['细雪', '冰砾', '飞叶快刀'], asset: asset('sinnoh/snover.png') },
};
export type PokemonId = keyof typeof pokemonData;
export const pokemonIds = Object.keys(pokemonData) as PokemonId[];
export const isPokemon = (id: unknown): id is PokemonId => typeof id === 'string' && Object.hasOwn(pokemonData, id);
export type RegionId = 'twinleaf' | 'verity' | 'coronet';
export type Destination = 'about' | 'projects' | 'contact' | PokemonId;
export type Spot = { id: Destination; x: number; y: number };
export const regions: Record<RegionId, { name: string; english: string; subtitle: string; number: string; dialogue: string[]; spots: Spot[] }> = {
  twinleaf: { name: '双叶镇', english: 'TWINLEAF TOWN', subtitle: '冒险开始的地方 · 训练家资料', number: '01', dialogue: ['欢迎来到双叶镇。这里是你的训练家资料与旅程起点。', '走到东侧出口，就能沿着路线前往心齐湖。', '圆陆鲨和利欧路已经在等你了。'], spots: [{ id: 'about', x: 8, y: 9 }, { id: 'gible', x: 11, y: 11 }, { id: 'riolu', x: 18, y: 12 }, { id: 'shinx', x: 6, y: 14 }, { id: 'starly', x: 21, y: 14 }] },
  verity: { name: '心齐湖', english: 'LAKE VERITY', subtitle: '风与湖水的约定 · 湖畔观测站', number: '02', dialogue: ['湖畔观测站记录着你的量化研究与机器学习项目。', '从西侧出口回到双叶镇，向东还能继续前往天冠山。', '波加曼、泳圈鼬和飘飘球正在湖边等你发现新的线索。'], spots: [{ id: 'projects', x: 22, y: 14 }, { id: 'piplup', x: 15, y: 13 }, { id: 'buizel', x: 20, y: 14 }, { id: 'drifloon', x: 5, y: 9 }] },
  coronet: { name: '天冠山', english: 'MT. CORONET', subtitle: '时间与空间的回声 · 联系方式', number: '03', dialogue: ['山顶的信号站连接着你的联系方式与下一段合作。', '从西侧出口可以回到心齐湖，神奥路线是一条完整的旅程。', '雪笠怪在遗迹前守望，抬头望去，山顶还藏在云中。'], spots: [{ id: 'contact', x: 21, y: 12 }, { id: 'snover', x: 22, y: 14 }] },
};
export const regionIds = Object.keys(regions) as RegionId[];
