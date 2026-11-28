export const TIME_ZONE_MINUTES = 9 * 60;

export const WORLD = { x0: -200, x1: 200 };

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
  villagerHoles: 10,
  villagerHolesMax: 20,
  holesPerCoins: 150,
  leases: [
    { days: 3, perHole: 2.7 },
    { days: 7, perHole: 5.4 },
    { days: 15, perHole: 9.9 },
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
  quizCloseMs: 500,
  villagerAnglers: 3,
  villagerCasts: [3, 7],
  villagerSellAt: 3,
  villagerBaitBelow: 3,
  villagerBaitFunds: 2,
  castPause: 1.6,
};

export const PHRASE_QUIZ = { clozeSeconds: 40, meaningSeconds: 20, choices: 4, readFreeChars: 80, readCharsPerSecond: 3 };

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
};

export const HOUSE_PRICES = { small: 700000, medium: 1200000, large: 2000000 };

export const SELF_STUDY = { cooldown: 20 * 60, waitPoll: 1.5, waitMax: 5 * 60 };

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
  nightStir: [20, 40],
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
  prepValue: 6,
  speakValue: 3,
  noise: [0.85, 1.15],
  stick: 1.2,
  stickSeconds: 120,
};

export const ENERGY = {
  max: 100,
  costs: { plant: 2 / 3, water: 2 / 3, fertilize: 2 / 3, harvest: 1, clear: 0, fish: 1 },
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

export const MAX_STEP = 0.55;

export const ODDS_MINUTES = 10;

export const AWAY = { step: 15, walk: 1.5 };

export const LODGES = {
  inn: { price: 18, perHour: 28, comfort: 0.6, beds: 5 },
  cheap: { price: 14, perHour: 20, comfort: 0.2, beds: 2 },
  cozy: { price: 21, perHour: 36, comfort: 0.7, beds: 2 },
  grand: { price: 32, perHour: 52, comfort: 1, beds: 2 },
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
  che: { icon: '🍧', name: 'Chè đậu xanh', price: 10, energy: 12, uses: { produce: 5 } },
  banhmi: { icon: '🥖', name: 'Bánh mì thịt', price: 20, energy: 25, uses: { produce: 4, protein: 7 } },
  caolau: { icon: '🍜', name: 'Cao lầu', price: 30, energy: 45, uses: { produce: 6, protein: 10 } },
  comga: { icon: '🍛', name: 'Cơm gà Hội An', price: 35, energy: 55, uses: { produce: 8, protein: 12 } },
};

export const CERTIFY = {
  batch: 5,
  remember: 1,
  viewSeconds: 5 * 60,
  learnFee: 1,
  reviewFee: 1,
  speakFee: 1,
  practiceFee: 1,
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
  seconds: { n2: 30, sugu1: 60, kanjiN2: 40, kanjiN3: 40, grammarN2: 60 },
  feeScale: { grammarN2: 2 },
  open: 5 * 60 + 30,
  close: 23 * 60 + 30,
  dropChance: 0.05,
  harvestQuiz: 0.25,
  harvestQuizIcons: { harvest: '🧺', water: '💧' },
  harvestDrop: 0.5,
  harvestIntellectCap: 25,
  harvestCoin: 1,
  blessingCoinPer: 10,
  blessingIntellectPer: 5,
  blessingIntellectCap: 30,
};

export const SPEAK = {
  pass: [0.8, 0.7],
  passLength: [10, 30],
  repeatSounds: 3,
  retry: 3,
  dialogs: 3,
  dialogSeconds: 4 * 60,
  minLength: 5,
  lineSeconds: [4, 8],
  kanaSeconds: 0.18,
  minChance: 0.15,
  fillers: ['ううん', 'うーん', 'うん', 'ええ', 'ええと', 'えっと', 'えーと', 'あの', 'あのう', 'あのー', 'まあ', 'へえ', 'へー', 'ふうん', 'ふーん', 'ああ', 'あっ', 'えっ', 'おお', 'おっ', 'ほら', 'さあ', 'ねえ'],
};

export const MART = { open: 6 * 60, close: 22 * 60, house: 'd1', reserve: 80, chance: 0.15, stock: 2 };

export const SNACKS = {
  banhngot: { icon: '🥐', name: 'Bánh ngọt', price: 15, energy: 8 },
  migoi: { icon: '🍜', name: 'Mì ly', price: 22, energy: 12 },
  comnam: { icon: '🍙', name: 'Cơm nắm', price: 32, energy: 18, uses: { produce: 10, protein: 7 } },
};

export const ENERGY_PRICE = Object.values(SNACKS).reduce((sum, snack) => sum + snack.price / snack.energy, 0) / Object.keys(SNACKS).length;

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
    cheden: { icon: '🍧', name: 'Chè đậu đen', price: 8, energy: 10, uses: { produce: 4 } },
    banhgio: { icon: '🥟', name: 'Bánh giò', price: 15, energy: 20, uses: { produce: 3, protein: 5 } },
    xoixeo: { icon: '🍙', name: 'Xôi xéo', price: 18, energy: 25, uses: { produce: 6, protein: 4 } },
    phoganh: { icon: '🍜', name: 'Phở gánh', price: 30, energy: 45, uses: { produce: 6, protein: 10 } },
  },
};

export const GATES = { west: -188, east: 188 };

export const GUARD = {
  stride: 20,
  gateInset: 3,
  pause: 4,
  lag: 1.4,
  gap: 1.3,
  callChance: 0.5,
};

export const PRAYER = { energy: 10 };

export const FIREFLY = {
  density: 0.004,
  catchRadius: 0.9,
  respawn: [25, 60],
  lampMin: 3,
  lampMinutesPerFly: 60,
  villagerKeep: 6,
  villagerSwat: 8,
};

export const ECONOMY = {
  vat: 0.1,
  wages: { guard: 12, chief: 15, mayor: 20, host: 10 },
  tuitionShare: { examiner: 0.05, classroom: 0.1 },
  fundSeed: 5000,
  living: 12,
  pollTax: 2,
  houseTax: 0.0001,
  buyback: 0.8,
  thrift: 0.6,
  incomeTax: 0.2,
  offline: { sampleDays: 3, minSample: 120 },
};

export const TRADE = {
  buyHigh: 0.9,
  buyLow: 0.5,
  exportRate: 0.6,
  importRate: 0.6,
  cap: { produce: 150, fish: 100, game: 20 },
  opening: { produce: 60, fish: 40, game: 8 },
  pantry: {
    cook: { produce: 150, protein: 200 },
    vendor: { produce: 80, protein: 80 },
    grocer: { produce: 60, protein: 40 },
  },
  stock: { seed: 30, fertilizer: 20, bait: 60, rod: 3, snack: 20 },
  restockBelow: 0.5,
  capital: 400,
  cashFloor: 0.25,
  richLift: 0.5,
  marketFee: 0.05,
  scarce: { protein: 1.5 },
  turnoverWeight: 0.3,
};

export const QUIZ = { seconds: 5 * 60, reward: 1, closeMs: 500, intellectCap: 5 };

export const TRAITS = {
  anchor: [0.5, 0.7],
  startSpread: 0.15,
  diligence: [0.3, 0.97],
  skill: [0.3, 0.9],
  skillStart: [0.45, 0.55],
  skillDepth: 20,
  skillForget: 0.02,
  fullDayEffort: 120,
  taste: [0.75, 1.25],
  habitPull: 0.25,
  habitRate: 0.15,
  innGoer: 0.35,
  rate: 0.1,
  catchUp: 30,
  studyPull: 0.2,
  idlePull: 0.1,
  passPull: 0.1,
  failPull: 0.15,
  tiredPull: 0.1,
  debtPull: 0.05,
  practiceGap: 2,
};

export const FLUENCY = { gain: 0.3, slip: 0.2, keep: 0.97, floor: 0.45 };

export const STIPEND = { share: 0.3, top: 3, minCerts: 20 };

export const FATE = { sick: 0.02, sickEnergy: 15, medicine: 12 };

export const CENSUS = { days: 31, tiers: 3 };

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
  schedule: [
    { weekdays: [1, 2, 3, 4, 5], hours: [1, 5, 9, 13, 15, 21] },
    { weekdays: [6, 0], hours: [1, 5, 9, 15, 17, 19, 21] },
  ],
  lead: 30,
  opening: 0.25,
  breather: 15,
  pause: 1.5,
  setPause: 4,
  grace: 2,
  fee: 2,
  draftCut: 0.3,
  hp: 140,
  hit: 18,
  speed: 0.4,
  seconds: 15,
  hardSeconds: 10,
  read: 5,
  turns: 12,
  finalSets: 3,
  tiers: { easy: 2, hard: 6 },
  combo: { step: 0.15, max: 3 },
  rage: { below: 0.3, boost: 1.5 },
  guard: 0.5,
  reward: { base: 1, perWin: 1, champion: 1 },
  intellectPerWin: 1,
  champions: 30,
  rounds: { 4: 'Tứ kết', 2: 'Bán kết', 1: 'Chung kết' },
  npc: { reserve: 10, eager: 0.15, rethink: 5 },
  prep: { before: 120, minCards: 5 },
};

export const HERALD = { lead: 15, every: 3 };

export const TOWNHALL = {
  reserveDays: 5,
  spend: 0.45,
  blessingShare: 0.3,
  arenaShare: 0.23,
  fireworksShare: 0.02,
  history: 14,
  lanternShare: 0.2,
  questShare: 0.15,
  lotoShare: 0.1,
};

export const FIREWORKS = {
  fee: 5,
  slots: [
    { start: 12 * 60, signOpen: 11 * 60, weekdays: [6, 0] },
    { start: 23 * 60, signOpen: 18 * 60 },
  ],
  night: 23 * 60,
  dusk: 1.5,
  minutes: 15,
  gather: 5,
  heraldLead: 15,
  deck: 'kanjiN2',
  aimSeconds: 5.5,
  wordSlack: 1.56,
  hostShare: 0.1,
  sky: { rise: 0.9, hang: 14, fade: 1.6, retire: 0.35, deal: 1.6, wait: [0.3, 1.6], pop: 0.6 },
  words: 240,
  decoys: 26,
  answerCopies: 2,
  prizes: [0.5, 0.3, 0.2],
  intellectPer: 5,
  intellectCap: 20,
  champions: 30,
  sample: 12,
};

export const LOTO = {
  deck: 'kanjiN3',
  clues: ['meaning'],
  fee: 5,
  purse: 300,
  signOpen: 18 * 60,
  start: 22 * 60,
  callSeconds: 12,
  rounds: 3,
  prizes: [0.6, 0.25, 0.15],
  places: 5,
  intellect: 10,
  pool: 40,
  size: 4,
  wordsPerKanji: 2,
  slip: 0.5,
  gather: 5,
  heraldLead: 15,
};

export const KEEPER_SHIFT = { arrive: 30, linger: 15 };

export const QUEST = {
  pull: 0.5,
  deckPull: 1,
  active: 3,
  minFit: 0.6,
  day: { count: 6, slots: 6 },
  week: {
    count: 3,
    slots: 3,
    weight: 6,
    paths: [
      { weight: 3, steps: ['learn', 'internal', 'exam'] },
      { weight: 2, steps: ['review', 'learn', 'internal'] },
      { weight: 2, steps: ['learn', 'review', 'speak'] },
      { weight: 1, steps: ['sit', 'review', 'exam'] },
      { weight: 2, steps: ['farm', 'fish', 'hunt'] },
    ],
  },
  kinds: {
    learn: { icon: '📖', mind: 'study', deck: true, fee: 'learnFee', weight: 3, day: [2, 5], week: [3, 5] },
    sit: { icon: '⏳', mind: 'study', deck: true, fee: 'learnFee', weight: 1, unit: 5, day: [10, 25], week: [15, 30] },
    review: { icon: '🔁', mind: 'study', deck: true, fee: 'reviewFee', weight: 2, day: [1, 2], week: [2, 3] },
    speak: { icon: '🎤', mind: 'study', deck: true, needs: 'speak', fee: 'speakFee', weight: 1, day: [1, 3], week: [3, 6] },
    internal: { icon: '🏫', mind: 'study', deck: true, fee: 'internalFee', weight: 2, day: [1, 1], week: [1, 2] },
    exam: { icon: '🎓', mind: 'study', deck: true, fee: 'examFee', weight: 1, day: [1, 1], week: [1, 2] },
    farm: { icon: '🌾', mind: 'farm', weight: 1, day: [6, 10], week: [8, 15] },
    fish: { icon: '🎣', mind: 'fish', weight: 1, day: [2, 4], week: [3, 5] },
    hunt: { icon: '🏹', mind: 'hunt', weight: 1, day: [1, 2], week: [1, 3] },
  },
};

export const LANTERN = {
  fee: 3,
  signOpen: 6 * 60,
  start: 19 * 60 + 30,
  end: 21 * 60 + 30,
  heraldLead: 10,
  remindEvery: 15,
  count: 10,
  stagger: 1.5,
  fall: 0.4,
  rise: 0.15,
  sky: 45,
  hover: 1.9,
  candidates: 30,
  bankGap: 1.5,
  reach: 3,
  lock: 20,
  extraTiles: 3,
  thinkSeconds: 8,
  readSeconds: 1,
  tapSeconds: 0.55,
  reward: { energy: 1, intellect: 1 },
  prepare: 60,
};

export const BLESSING = {
  fee: 6,
  windows: [6, 12, 14, 20].map((hour) => [hour * 60, hour * 60 + 15]),
  quizSeconds: 3,
  quizCloseMs: 500,
  remindBefore: 10,
  firstQuiz: 3,
  villagerStay: [5 * 60, 15 * 60],
  villagerAnswer: [2.4, 7.2],
  wrongCost: 0.5,
  answerLock: 2,
  lateMinutes: 5,
};

export const TRAINING = {
  fee: 3,
  minutes: 15,
  gap: 1,
  villagerAnswer: [7, 15],
  intellectPer: 25,
  shortValue: 10,
};

export const RANKING = {
  hours: Array.from({ length: 24 }, (_, hour) => hour * 60),
  dailyHour: 0,
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
  credit: { base: 200, perRepaid: 100, cap: 1500, house: 0.5, perCert: 2, certCap: 300 },
  minDeposit: 10,
  minLoan: 20,
  maxLoans: 3,
  maxTerms: 5,
  catchUpDays: 60,
  npc: { keepBase: 40, keepSpread: 60, broke: 15, merchantBroke: 0.25, need: 40, repayShare: 0.5, repayMin: 10, dueSoon: 1, maxLine: 3, urgentGap: 60, restGap: 8 * 60 },
};

export const ATM = {
  fee: 0,
  minWithdraw: 10,
  detour: 40,
  spots: [
    { id: 'school', name: 'Trường khảo thí', x: 6.6, z: 30.2 },
    { id: 'market', name: 'Phố cổ', x: 48.8, z: 28.8 },
    { id: 'fieldMart', name: 'Siêu thị cánh đồng', x: -156.9, z: 28.9 },
  ],
};

export const FLUORESCENT = 0xeef4ff;
