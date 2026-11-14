export const TIME_ZONE_MINUTES = 9 * 60;

export const WORLD = { x0: -150, x1: 200 };

export const DAYLIGHT = { sunrise: 5 * 60 + 30, sunset: 18 * 60 };

export const ROUTINE = {
  wake: 5 * 60 + 30,
  home: 21 * 60,
};

export const MONEY = { icon: '🪙', name: 'đồng' };

export const SHOP = { open: 5 * 60 + 30, close: 21 * 60, fertilizer: 2 };
export const FISH_SHOP = { open: 5 * 60, close: 19 * 60 };

export const CHIEF = { open: 6 * 60, close: 20 * 60 };

export const CROP_TIME_FACTOR = 0.00625;

export const CROP_ECONOMY = {
  waterSpinach: { days: 20, seed: 1, price: 3 },
  bokChoy: { days: 30, seed: 1, price: 4 },
  tomato: { days: 75, seed: 2, price: 2 },
  corn: { days: 70, seed: 2, price: 6 },
  watermelon: { days: 65, seed: 2, price: 11 },
  sweetPotato: { days: 100, seed: 2, price: 5 },
};

export const growDays = (crop) => (CROP_ECONOMY[crop]?.days ?? 30) * CROP_TIME_FACTOR;

export const FARMING = {
  thirstShare: 0.6,
  missPenalty: 0.18,
  minVigor: 0.25,
  villagerPlots: 10,
  leases: [
    { days: 3, price: 27 },
    { days: 7, price: 54 },
    { days: 15, price: 99 },
  ],
  spentMinutes: 6 * 60,
};

export const STARTER = { 'seed:waterSpinach': 6, rod: 1, bait: 10 };

export const FISH = {
  carp: { name: 'Cá diếc', icon: '🐟', price: 2, weight: 30, color: 0xa8b0a0 },
  perch: { name: 'Cá rô đồng', icon: '🐟', price: 3, weight: 30, color: 0x7a8a3a },
  shrimp: { name: 'Tôm càng', icon: '🦐', price: 6, weight: 15, color: 0x5a7a9a },
  catfish: { name: 'Cá trê', icon: '🐟', price: 8, weight: 17, color: 0x4a4038 },
  snakehead: { name: 'Cá lóc', icon: '🐟', price: 18, weight: 8, color: 0x3a4a3a },
};

export const FISHING = {
  rod: 40,
  baitPack: 3,
  baitPerPack: 5,
  zones: 5,
  zoneFish: [4, 8],
  zoneRespawn: [9, 18],
  zoneLife: [12, 24],
  biteSeconds: 3,
  villagerAnswer: [2, 6],
  quizSeconds: 20,
  villagerSkill: { student: 0.6, farmer: 0.45 },
  villagerAnglers: 3,
  villagerCasts: [3, 7],
  villagerSellAt: 3,
  villagerBaitBelow: 3,
  villagerBaitFunds: 2,
  castPause: 1.6,
};

export const PHRASE_QUIZ = { clozeSeconds: 40, meaningSeconds: 20, choices: 4 };

export const WILDLIFE = {
  rabbit: { name: 'Thỏ rừng', icon: '🐇', price: 6, gentle: true, count: 7, speed: 1.5, flee: 5.4, wary: 0.35 },
  pheasant: { name: 'Gà rừng', icon: '🐓', price: 9, gentle: true, count: 5, speed: 1.2, flee: 4.6, wary: 0.3 },
  deer: { name: 'Hoẵng', icon: '🦌', price: 22, gentle: true, count: 4, speed: 1.6, flee: 6.4, wary: 0.45 },
  boar: { name: 'Lợn rừng', icon: '🐗', gentle: false, count: 3, speed: 1.3, charge: 5.2 },
};

export const HUNTING = {
  energy: 4,
  catchRange: 2.4,
  watchRange: 8,
  noticeRange: 3.6,
  runNotice: 9,
  respawn: [540, 1080],
  boarSight: 7,
  boarHit: 6,
  boarCooldown: 6,
  knockback: 6,
  villagerHunters: 2,
  villagerSkill: { student: 0.45, farmer: 0.55 },
};

export const HOUSE_PRICES = { small: 700000, medium: 1200000, large: 2000000 };

export const VILLAGER = {
  sellWhen: 6,
  seedStock: 4,
  houseReserve: 30,
  restUntil: 10,
  studyReserve: 2,
  leaseReserve: 20,
  leaseCycles: 3,
  renewBefore: 0.5,
  lodgeNights: 3,
  frugalFull: 0.5,
  nightAwakeHours: 1,
  morningEnergy: 60,
  resumeMinutes: 10,
};

export const MIND = {
  energyCoin: 0.4,
  comfortMoney: 200,
  debtFloor: 0.5,
  studyValue: 4.5,
  reviewValue: 3,
  weakValue: 8,
  internalValue: 40,
  leisureValue: 1,
  intellectValue: 2,
  workSeconds: 5,
  castSeconds: 9,
  huntSeconds: 5,
  queueSeconds: 60,
  harvestShare: { harvest: 1, plant: 0.5, lease: 0.5, water: 0.18, fertilize: 0.18, clear: 0.1, clearOther: 0.05 },
  crowdCut: 0.4,
  taste: [0.75, 1.25],
  farmerFarmTaste: 0.15,
  noise: [0.85, 1.15],
  stick: 1.2,
  stickSeconds: 120,
};

export const ENERGY = {
  max: 100,
  costs: { plant: 2 / 3, water: 2 / 3, fertilize: 2 / 3, harvest: 1, clear: 0, fish: 2 },
  workMin: 1,
  drain: { seated: 2, idle: 2, walk: 4, study: 6, run: 8 },
  nightFactor: 2,
  sleepPerHour: 10,
  homePerHour: { small: 40, medium: 48, large: 56 },
  restPerHour: 10,
  studyRestPerHour: 15,
  shelterPerHour: 15,
  tiredSpeed: 0.5,
  low: 20,
};

export const MOVE = { walk: 2, run: 3 };

export const AWAY = { step: 15, walk: 1.5 };

export const LODGES = {
  inn: { price: 25, perHour: 28, comfort: 0.6 },
  cheap: { price: 20, perHour: 20, comfort: 0.2 },
  cozy: { price: 30, perHour: 36, comfort: 0.7 },
  grand: { price: 45, perHour: 52, comfort: 1 },
};

export const LODGE_ROOMS = {
  inn: { tier: 'inn', name: 'Quán trọ' },
  cheap: { tier: 'cheap', name: 'Nhà trọ Bình Dân' },
  cozy: { tier: 'cozy', name: 'Nhà trọ An Khang' },
  grand: { tier: 'grand', name: 'Nhà trọ Phú Quý' },
  'banco-1': { tier: 'cheap', name: 'Nhà trọ Cây Đa' },
  'banco-2': { tier: 'cheap', name: 'Nhà trọ Bến Đò' },
  'banco-3': { tier: 'cozy', name: 'Nhà trọ Hoa Sen' },
  'banco-4': { tier: 'cozy', name: 'Nhà trọ Thanh Bình' },
  'banco-5': { tier: 'grand', name: 'Nhà trọ Kim Long' },
};

export const EATERY = { open: 5 * 60, close: 21 * 60 + 30 };

export const FOODS = {
  che: { icon: '🍧', name: 'Chè đậu xanh', price: 10, energy: 12 },
  banhmi: { icon: '🥖', name: 'Bánh mì thịt', price: 20, energy: 25 },
  caolau: { icon: '🍜', name: 'Cao lầu', price: 30, energy: 45 },
  comga: { icon: '🍛', name: 'Cơm gà Hội An', price: 35, energy: 55 },
};

export const CERTIFY = {
  batch: 5,
  remember: 1,
  viewSeconds: 5 * 60,
  learnFee: 1,
  reviewFee: 1,
  sitSeconds: 15 * 60,
  sitWords: 2,
  seatRest: 5 * 60,
  internalFee: 4,
  internalMinutes: 5,
  internalTries: 3,
  examFee: 10,
  retakeFee: 20,
  retakeReserve: 30,
  examTries: 2,
  examIntellect: 20,
  starterIntellect: 20,
  examMinutes: 10,
  pass: 0.9,
  seconds: { n2: 30, sugu1: 60 },
  open: 5 * 60,
  close: 22 * 60,
  dropChance: 0.05,
  harvestQuiz: 0.1,
  blessingCoinPer: 10,
  blessingIntellectPer: 5,
};

export const MART = { open: 6 * 60, close: 22 * 60, house: 'd1', reserve: 80, chance: 0.15, stock: 2 };

export const SNACKS = {
  banhngot: { icon: '🥐', name: 'Bánh ngọt', price: 15, energy: 8 },
  migoi: { icon: '🍜', name: 'Mì ly', price: 22, energy: 12 },
  comnam: { icon: '🍙', name: 'Cơm nắm', price: 32, energy: 18 },
};

export const VENDOR = {
  open: 21 * 60,
  close: 60,
  pause: [5, 9],
  hold: 8,
  reach: 2.4,
  chat: 1.3,
  lure: 18,
  roamPause: [8, 18],
  foods: {
    cheden: { icon: '🍧', name: 'Chè đậu đen', price: 8, energy: 10 },
    banhgio: { icon: '🥟', name: 'Bánh giò', price: 15, energy: 20 },
    xoixeo: { icon: '🍙', name: 'Xôi xéo', price: 18, energy: 25 },
    phoganh: { icon: '🍜', name: 'Phở gánh', price: 30, energy: 45 },
  },
};

export const GUARD = {
  day: [6 * 60, 18 * 60],
  pause: 4,
  lag: 1.4,
  gap: 1.3,
  callChance: 0.5,
};

export const PRAYER = { energy: 10 };

export const FIREFLY = {
  count: 40,
  catchRadius: 0.9,
  respawn: [25, 60],
  lampMin: 3,
  lampMinutesPerFly: 60,
};

export const ECONOMY = {
  vat: 0.1,
  keep: { teacher: 0.9, cook: 0.2, vendor: 0.3, keeper: 0.3, fishmonger: 0.3, grocer: 0.3 },
  wages: { guard: 12, teacher: 10, chief: 15, mayor: 20 },
  fundSeed: 5000,
  living: 12,
  pollTax: 2,
  houseTax: 0.0001,
  buyback: 0.8,
  thrift: 0.6,
  incomeTax: 0.2,
  offline: { sampleDays: 3, minSample: 120 },
};

export const QUIZ = { seconds: 5 * 60, reward: 1 };

export const ABSORB = {
  min: 0.3,
  max: 1,
  talent: [0.4, 0.9],
  start: [0.3, 0.95],
  rate: 0.1,
  catchUp: 30,
  study: 0.1,
  idle: 0.1,
  tired: 0.1,
  debt: 0.05,
  guess: 0.25,
  fade: 0.1,
  ceiling: 0.99,
  forget: 0.3,
  grasp: { certified: 1, studied: 0.95, weak: 0.85, seen: 0.35, new: 0 },
  think: { sure: 0.07, slow: 0.8, guess: [0.55, 1], jitter: [0.85, 1.15] },
};

export const ARENA = {
  deck: 'n2',
  size: { day: 16, night: 8 },
  stages: 8,
  starts: Array.from({ length: 12 }, (_, i) => (2 * i + 1) * 60),
  lead: 30,
  opening: 0.25,
  breather: 15,
  pause: 1.5,
  setPause: 4,
  grace: 2,
  fee: 2,
  hp: 140,
  hit: 18,
  speed: 0.6,
  seconds: 15,
  hardSeconds: 10,
  read: 5,
  turns: 12,
  finalSets: 3,
  tiers: { easy: 2, hard: 6 },
  combo: { step: 0.2, max: 3 },
  rage: { below: 0.3, boost: 1.5 },
  guard: 0.5,
  reward: { base: 1, perWin: 1, champion: 1 },
  champions: 30,
  rounds: { 4: 'Tứ kết', 2: 'Bán kết', 1: 'Chung kết' },
  npc: { reserve: 10, eager: 0.15, rethink: 5 },
};

export const HERALD = { lead: 15, every: 3 };

export const TOWNHALL = {
  reserveDays: 5,
  spend: 0.2,
  blessingShare: 0.5,
  blessingMin: 2,
  history: 14,
};

export const BLESSING = {
  cost: 15,
  windows: Array.from({ length: 9 }, (_, i) => [(6 + 2 * i) * 60, (6 + 2 * i) * 60 + 15]),
  quizSeconds: 3,
  quizCloseMs: 500,
  remindBefore: 10,
  firstQuiz: 3,
  villagerStay: [5 * 60, 15 * 60],
};

export const RANKING = {
  hours: Array.from({ length: 24 }, (_, hour) => hour * 60),
};

export const BANK = {
  open: 7 * 60,
  close: 17 * 60,
  capital: 3000,
  reserve: 0.2,
  utilization: 0.3,
  deposit: { base: 0.006, min: 0.0015, max: 0.02, swing: 0.9 },
  loan: { spread: 0.007, min: 0.006, max: 0.045, swing: 1.2 },
  noise: 0.12,
  smoothing: 0.5,
  savingTerms: [
    { days: 0, bonus: 0 },
    { days: 3, bonus: 0.0015 },
    { days: 7, bonus: 0.004 },
    { days: 15, bonus: 0.008 },
  ],
  loanTerms: [
    { days: 3, bonus: -0.001 },
    { days: 7, bonus: 0 },
    { days: 15, bonus: 0.003 },
  ],
  overdue: 1.5,
  credit: { base: 200, perRepaid: 100, cap: 1500, house: 0.5 },
  minDeposit: 10,
  minLoan: 20,
  maxLoans: 3,
  maxTerms: 5,
  catchUpDays: 60,
  npc: { keepBase: 40, keepSpread: 60, broke: 15, need: 40, repayShare: 0.5, repayMin: 10, dueSoon: 1, maxLine: 3, urgentGap: 60, restGap: 8 * 60 },
};

export const ATM = {
  fee: 0,
  minWithdraw: 10,
  detour: 40,
  spots: [
    { id: 'school', name: 'Trường khảo thí', x: 6.6, z: 30.2 },
    { id: 'market', name: 'Phố cổ', x: 49.3, z: 30.2 },
    { id: 'fieldMart', name: 'Siêu thị cánh đồng', x: -82, z: 30.3 },
  ],
};

export const FLUORESCENT = 0xeef4ff;
