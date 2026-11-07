export const TIME_SCALE = 20;

export const START = { day: 1, minute: 6 * 60 };

export const WORLD = { x0: -150, x1: 200 };

export const DAYLIGHT = { sunrise: 5 * 60 + 30, sunset: 18 * 60 };

export const ROUTINE = {
  wake: 5 * 60 + 30,
  home: 21 * 60,
  teacherArrive: 6 * 60 + 15,
  teacherLeave: 21 * 60,
  schoolLead: 50,
};

export const SCHOOL = {
  period: 120,
  rest: 5,
  recess: 15,
  morning: 7 * 60 + 30,
  afternoon: 13 * 60 + 30,
  evening: 19 * 60,
  plans: [{ morning: 2, afternoon: 2, evening: 1 }],
  alertBefore: 10,
  payWindowSeconds: 5,
  tuition: 1,
  maxPrepaid: 30,
};

export const MONEY = { icon: '🪙', name: 'đồng' };

export const SHOP = { open: 5 * 60 + 30, close: 21 * 60, fertilizer: 2 };

export const CHIEF = { open: 6 * 60, close: 20 * 60 };

export const CROP_TIME_FACTOR = 0.2;

export const CROP_ECONOMY = {
  waterSpinach: { days: 20, seed: 1, price: 3 },
  bokChoy: { days: 30, seed: 1, price: 4 },
  tomato: { days: 75, seed: 2, price: 2 },
  corn: { days: 70, seed: 1, price: 3 },
  watermelon: { days: 65, seed: 2, price: 18 },
  sweetPotato: { days: 100, seed: 1, price: 3 },
};

export const growDays = (crop) => (CROP_ECONOMY[crop]?.days ?? 30) * CROP_TIME_FACTOR;

export const FARMING = {
  thirstShare: 0.6,
  missPenalty: 0.18,
  minVigor: 0.25,
  villagerPlots: 10,
};

export const STARTER = { 'seed:waterSpinach': 6, rod: 1, bait: 10 };

export const FISH = {
  carp: { name: 'Cá diếc', icon: '🐟', price: 4, weight: 30, color: 0xa8b0a0 },
  perch: { name: 'Cá rô đồng', icon: '🐠', price: 6, weight: 30, color: 0x7a8a3a },
  shrimp: { name: 'Tôm càng', icon: '🦐', price: 12, weight: 15, color: 0x5a7a9a },
  catfish: { name: 'Cá trê', icon: '🐡', price: 15, weight: 17, color: 0x4a4038 },
  snakehead: { name: 'Cá lóc', icon: '🦈', price: 35, weight: 8, color: 0x3a4a3a },
};

export const FISHING = {
  rod: 40,
  baitPack: 3,
  baitPerPack: 10,
  zones: 8,
  zoneFish: [3, 8],
  zoneRespawn: [60, 180],
  biteSeconds: [10, 40],
  quizSeconds: 20,
  spoilDays: 2,
  villagerSkill: { student: 0.6, farmer: 0.45 },
  villagerAnglers: 3,
  villagerCasts: [3, 7],
};

export const HOUSE_PRICES = { small: 350000, medium: 600000, large: 1000000 };

export const VILLAGER = {
  sellWhen: 6,
  seedStock: 4,
  houseReserve: 30,
  sitWithoutPaying: 0.3,
};

export const ENERGY = {
  max: 100,
  costs: { plant: 1, water: 1, fertilize: 1, harvest: 1.5, clear: 3, fish: 0.5 },
  drain: { seated: 0.5, idle: 1, walk: 2, run: 4 },
  nightFactor: 2,
  sleepPerHour: 8,
  tiredSpeed: 0.6,
  low: 20,
};

export const EATERY = { open: 5 * 60, close: 21 * 60 + 30 };

export const FOODS = {
  che: { icon: '🍧', name: 'Chè đậu xanh', price: 10, energy: 12 },
  banhmi: { icon: '🥖', name: 'Bánh mì thịt', price: 20, energy: 25 },
  caolau: { icon: '🍜', name: 'Cao lầu', price: 30, energy: 45 },
  comga: { icon: '🍛', name: 'Cơm gà Hội An', price: 35, energy: 55 },
};
