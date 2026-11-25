import { makeRandom } from './random.js';

function tomatoVarieties() {
  const rand = makeRandom(4040);
  const count = 10;
  return Array.from({ length: count }, (_, i) => {
    const height = 1 + (2 * i) / (count - 1) + (rand() - 0.5) * 0.15;
    return { height, fruits: Math.round(4 + (height - 1) * 4 + rand() * 6), seed: 500 + i * 7 };
  });
}

function cornVarieties() {
  const rand = makeRandom(5150);
  const count = 8;
  return Array.from({ length: count }, (_, i) => {
    const height = 1.4 + 1.8 * Math.pow(i / (count - 1), 1.4) + (rand() - 0.5) * 0.12;
    const clump = 2 + (rand() < 0.5 ? 1 : 0);
    const stalks = Array.from({ length: clump }, (_, k) => {
      const a = (k / clump) * Math.PI * 2 + rand();
      return {
        dx: Math.cos(a) * 0.12,
        dz: Math.sin(a) * 0.12,
        scale: 0.88 + rand() * 0.16,
        ears: 1 + (rand() < 0.45 ? 1 : 0),
        lean: [(rand() - 0.5) * 0.05, (rand() - 0.5) * 0.05],
        yaw: rand() * Math.PI,
      };
    });
    return { height, stalks, fruits: stalks.reduce((sum, stalk) => sum + stalk.ears, 0), seed: 900 + i * 11 };
  });
}

function watermelonVarieties() {
  const rand = makeRandom(6161);
  return Array.from({ length: 6 }, (_, i) => {
    const main = 0.9 + rand() * 1.0;
    const runners = [
      { angle: (rand() - 0.5) * 0.25, length: main * (0.85 + rand() * 0.3), wiggle: rand() * 6 },
      { angle: Math.PI + (rand() - 0.5) * 0.25, length: main * (0.85 + rand() * 0.3), wiggle: rand() * 6 },
    ];
    const sides = Math.floor(rand() * 3);
    for (let k = 0; k < sides; k++) {
      const side = rand() < 0.5 ? -1 : 1;
      runners.push({ angle: side * (1 + rand() * 0.7) + (rand() < 0.5 ? 0 : Math.PI), length: 0.5 + rand() * 0.6, wiggle: rand() * 6 });
    }
    return {
      height: 0.24 + rand() * 0.08,
      runners,
      size: 0.16 + rand() * 0.06,
      fruits: 1 + Math.floor(rand() * 3),
      seed: 1300 + i * 17,
    };
  });
}

function waterSpinachVarieties() {
  const rand = makeRandom(8383);
  return Array.from({ length: 5 }, (_, i) => ({
    height: 0.34 + rand() * 0.14,
    shoots: 7 + Math.floor(rand() * 4),
    fruits: 2 + Math.floor(rand() * 3),
    seed: 2100 + i * 23,
  }));
}

function bokChoyVarieties() {
  const rand = makeRandom(9494);
  return Array.from({ length: 5 }, (_, i) => ({
    height: 0.3 + rand() * 0.1,
    leaves: 9 + Math.floor(rand() * 4),
    fruits: 2 + Math.floor(rand() * 3),
    seed: 2500 + i * 29,
  }));
}

function sweetPotatoVarieties() {
  const rand = makeRandom(7272);
  return Array.from({ length: 6 }, (_, i) => {
    const spread = 0.5 + rand() * 0.6;
    const count = 4 + Math.floor(rand() * 4);
    const runners = Array.from({ length: count }, (_, k) => ({
      angle: (k / count) * Math.PI * 2 + (rand() - 0.5) * 0.6,
      length: spread * (0.7 + rand() * 0.5),
      wiggle: rand() * 6,
    }));
    return {
      height: 0.28 + rand() * 0.12,
      runners,
      fruits: 3 + Math.floor(rand() * 6),
      seed: 1700 + i * 19,
    };
  });
}

export const CROPS = {
  waterSpinach: {
    icon: '🌿',
    name: 'Rau muống',
    seedName: 'Hạt rau muống',
    unit: 'bó',
    stages: { 3: 'Cây con', 4: 'Bén rễ', 5: 'Ra ngọn', 6: 'Đủ lứa cắt', 7: 'Đã cắt' },
    varieties: waterSpinachVarieties(),
    crown: 0.08,
    stageHeight: (stage, height) => [0, 0.12, 0.2, height * 0.3, height * 0.55, height * 0.8, height, height * 0.22][stage],
  },
  bokChoy: {
    icon: '🥬',
    name: 'Cải ngọt',
    seedName: 'Hạt cải ngọt',
    unit: 'bó',
    stages: { 3: 'Cây con', 4: 'Ra lá', 5: 'Cuốn bẹ', 6: 'Đủ lứa thu', 7: 'Đã nhổ' },
    varieties: bokChoyVarieties(),
    crown: 0.06,
    stageHeight: (stage, height) => [0, 0.12, 0.2, height * 0.35, height * 0.6, height * 0.85, height, height * 0.5][stage],
  },
  tomato: {
    icon: '🍅',
    name: 'Cà chua',
    seedName: 'Hạt cà chua',
    unit: 'quả',
    varieties: tomatoVarieties(),
    crown: 0.25,
    stageHeight: (stage, height) => [0, 0.12, 0.3, Math.max(0.4, height * 0.3), height * 0.72, height, height, height * 0.96][stage],
  },
  corn: {
    icon: '🌽',
    name: 'Bắp',
    seedName: 'Hạt bắp',
    unit: 'trái',
    stages: { 4: 'Trổ cờ', 5: 'Bắp non', 6: 'Bắp chín' },
    varieties: cornVarieties(),
    crown: 0.3,
    stageHeight: (stage, height) => [0, 0.12, 0.3, Math.max(0.5, height * 0.3), height * 0.85, height, height, height * 0.95][stage],
  },
  watermelon: {
    icon: '🍉',
    name: 'Dưa hấu',
    seedName: 'Hạt dưa hấu',
    unit: 'quả',
    stages: { 5: 'Trái non', 6: 'Trái chín' },
    varieties: watermelonVarieties(),
    crown: 0.15,
    aligned: true,
    stageHeight: (stage, height) => [0, 0.12, 0.3, 0.15, height * 0.8, height, height, height * 0.7][stage],
  },
  sweetPotato: {
    icon: '🍠',
    name: 'Khoai lang',
    seedName: 'Dây khoai lang',
    unit: 'củ',
    stages: { 4: 'Ra hoa', 5: 'Ra củ', 6: 'Củ già', 7: 'Đã đào' },
    varieties: sweetPotatoVarieties(),
    crown: 0.15,
    aligned: true,
    harvest: 'dig',
    stageHeight: (stage, height) => [0, 0.12, 0.3, 0.15, height * 0.75, height, height, height * 0.6][stage],
  },
};
