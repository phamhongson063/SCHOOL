import { makeRandom } from './random.js';
import { HOUSE } from './school.js';
import { FIELDS } from './fieldPlan.js';
import { DISTRICT_STREETS } from './district.js';
import { ROAD } from './road.js';
import { NPC } from './npcIds.js';

export const SPACING = 0.62;
export const PASS_SPACING = 0.85;
export const STREET_MID = (ROAD.z0 + ROAD.z1) / 2;
export const STOP_SPACING = 2;
export const LOOKAHEAD = 0.85;
const MAX_STEP = 0.55;
export const AVOID_RANGE = 1.5;
export const PLAYER_AVOID_RANGE = 1.8;
export const AVOID_PROBE = 0.6;
export const QUEUE_DRIFT = 0.5;
export const NO_REST_RADIUS = 3;
export const BED_SCATTER = 1.8;
export const BED_GAP = 1.9;
export const BED_REACH = 7;
export const PATHS_PER_FRAME = 2;
export const STUCK_TIME = 1.2;
export const VISIBLE_DISTANCE = 40;
export const FAR_STEP = 0.15;
export const FAR_MAX_DT = 0.2;
export const FEELERS = [0, 0.45, 0.9, 1.35];

export const HANGOUTS = [
  { x: -2.3, z: 16.8 },
  { x: 4.9, z: 20 },
  { x: 13.7, z: 16 },
  { x: -11.9, z: 14.4 },
  { x: 0.5, z: 9.8 },
  { x: -5.5, z: 23.2 },
];

export const YARD = [
  [-14, 30.7, 15, 31.7],
  [-8.5, HOUSE.back + 4, 9.5, HOUSE.front - 1],
  [-11, 9, 12, 25.5],
];

export const STREET = [
  [-40, 33.5, 40, 37.5],
  [46, 29, 150, 42],
  ...DISTRICT_STREETS,
];

export const FIELD = ['Nắng quá!', 'Mùa này được giá đó!', 'Ráng làm cho xong luống này.', 'Rau năm nay tốt ghê!', 'Nghỉ tay chút đã.'];
export const TEND = ['Rau lên đều quá!', 'Mai mốt là thu được rồi.', 'Đất còn ẩm, khỏi tưới.', 'Lá xanh mướt ghê!', 'Coi chừng sâu nghen...'];
export const GOSSIP = ['Hôm nay trời đẹp ghê!', 'Nghe nói giá dưa lên rồi.', 'Mùa này mưa nắng thất thường quá.', 'Chiều nay ra đình chơi không?', 'Ăn cơm chưa?', 'Nhà Lý trưởng mới sơn lại cổng đó.', 'Rau muống nhà tui sắp cắt được rồi!'];
export const REST = ['Nghỉ mát chút đã.', 'Gió mát quá!', 'Mỏi lưng ghê...'];
export const FIELD_EDGES = FIELDS.map(({ soil: [{ x0, z0, x1, z1 }], beds: [{ heading }] }) => (heading ? [x0, z1, x1, z1 + 0.5] : [x0, z0 - 0.5, x1, z0]));
export const CAUGHT = ['Dính rồi!', 'Con này to ghê!', 'Hên quá!'];
export const ESCAPED = ['Sổng mất rồi...', 'Tiếc ghê!', 'Chữ này khó quá...'];
export const BAGGED = ['Bắt được rồi!', 'Hên ghê!', 'Đem ra chợ bán thôi!'];
export const MISSED = ['Chạy mất rồi...', 'Nhanh quá!', 'Hụt mất!'];

const STUDENTS = [
  ['v-mbo9l42o', 'Kaito', 'schoolboy'],
  ['v-7newhpr4', 'Minho', 'schoolboy-blue'],
  ['v-7kg4cjjr', 'Mei', 'farmgirl'],
  ['v-sgrj5qqz', 'Jake'],
  ['v-uan21ofg', 'Yuna', 'aodai'],
  ['v-qa0jrjjr', 'Sakura', 'farmgirl-blue'],
  ['v-bnyem3h1', 'Lily', 'aodai-blue'],
  ['v-w014att1', 'Haoran'],
  ['v-1qbg63ix', 'Riley'],
  ['v-0t1cnctd', 'Haru'],
  ['v-sxoy9ccm', 'Xiaoyu', 'vendor-indigo'],
  ['v-fz5u01pw', 'Jiwoo'],
];

const FARMERS = [
  { id: 'v-hsw9uzli', name: 'Hiroshi', model: 'worker-brown', look: { shirt: 0x7a5236, pants: 0x2f2a26, skin: 0xd9a479, style: 'toc', hairColor: 0x8a8580, old: true, iris: 0x4a2a18, hat: 0xe8d9a8, scarf: 0x2f3a4a } },
  { id: 'v-h3y0b1j5', name: 'Wei', model: 'man', look: { shirt: 0x34507a, pants: 0x3a3430, skin: 0xe0ad84, style: 'khan', khan: 0x8a3a2a, iris: 0x5a3220, hat: 0xe2d29c, scarf: 0x8a3a2a } },
  { id: 'v-p153parw', name: 'Emily', model: 'girl', look: { shirt: 0x9a4a5a, pants: 0x2f2a26, skin: 0xf0c09a, style: 'bui', iris: 0x6a3a1e, hat: 0xeadcae } },
  { id: 'v-otd9chxx', name: 'Taeyang', model: 'man-brown', look: { shirt: 0x5a7a4a, pants: 0x4a3a30, skin: 0xe6b08a, style: 'toc', hairColor: 0x3a2618, iris: 0x4a2a18, hat: 0xe5d6a2, scarf: 0x4a6a9a } },
  { id: 'v-e4l5gn5e', name: 'Walter', look: { shirt: 0x6a5a48, pants: 0x2f2a26, skin: 0xcf9a70, style: 'toc', hairColor: 0xe6e2da, old: true, beardColor: 0xf2efe8, iris: 0x3a2214, hat: 0xdccb94 } },
  { id: 'v-2ow0byhz', name: 'Soojin', model: 'girl-jade', look: { shirt: 0xb07a3a, pants: 0x2f2a26, skin: 0xf0c09a, style: 'bob', hairColor: 0x3a2418, iris: 0x6a3a1e, hat: 0xece0b4 } },
  { id: 'v-qe1kyu4a', name: 'Ryo', model: 'worker', look: { shirt: 0x3a7a8a, pants: 0x4a3a30, skin: 0xf2c4a0, style: 'chom', iris: 0x7a4a24, hat: 0xe9dbab } },
  { id: 'v-ot0cyhf4', name: 'Liang', look: { shirt: 0x7a3a2e, pants: 0x2f2a26, skin: 0xd9a479, style: 'khan', khan: 0x2f3a4a, iris: 0x4a2a18, hat: 0xe2d29c, scarf: 0x5a7a4a } },
  { id: 'v-pkpyc2ke', name: 'Martha', look: { shirt: 0x4a3a5a, pants: 0x2f2a26, skin: 0xe0ad84, style: 'bui', hairColor: 0xdcd8d0, old: true, iris: 0x3a2214, hat: 0xe8d9a8 } },
  { id: 'v-zqyh4704', name: 'Jianguo', look: { shirt: 0x8a7a5a, pants: 0x3a3430, skin: 0xcf9a70, style: 'toc', hairColor: 0xb8b2a8, old: true, beardColor: 0xe6e2da, iris: 0x3a2214, hat: 0xdccb94, scarf: 0x7a3a2a } },
  { id: 'v-osc2h19s', name: 'Akemi', look: { shirt: 0x3a6a5a, pants: 0x2f2a26, skin: 0xf0c09a, style: 'bob', hairColor: 0x2a201b, iris: 0x6a3a1e, hat: 0xeadcae } },
  { id: 'v-cqiv6k5e', name: 'Hyejin', look: { shirt: 0xa05a3a, pants: 0x3a3430, skin: 0xe6b08a, style: 'bui', hairColor: 0x3a2418, iris: 0x5a3220, hat: 0xe5d6a2, scarf: 0x34507a } },
  { id: 'v-imdax894', name: 'Fang', look: { shirt: 0x6a4a7a, pants: 0x2f2a26, skin: 0xf2c4a0, style: 'curly', hairColor: 0x2a201b, iris: 0x6a3a1e, hat: 0xece0b4 } },
  { id: 'v-x03venco', name: 'Tyler', look: { shirt: 0x4a6a9a, pants: 0x4a3a30, skin: 0xe0ad84, style: 'bachom', hairColor: 0x2a201b, iris: 0x7a4a24, hat: 0xe9dbab } },
];

const NEWCOMERS = [
  { id: 'v-sqz3dux2', name: 'Sora', look: { shirt: 0x3a5a8a, pants: 0xf1ebdc, skin: 0xf0c09a, style: 'chom', hairColor: 0x2a201b, iris: 0x4a2a18 } },
  { id: 'v-hula1fyg', name: 'Hana', look: { shirt: 0xa0604a, pants: 0x3a3430, skin: 0xf5caa6, style: 'bob', hairColor: 0x3a2418, iris: 0x6a3a1e } },
  { id: 'v-bojm575a', name: 'Daniel', look: { shirt: 0xc89a3a, pants: 0x3a3430, skin: 0xe6b08a, style: 'toc', hairColor: 0x4a2e1e, iris: 0x7a4a24 } },
  { id: 'v-fwh6qovx', name: 'Eunji', look: { shirt: 0x3a8a7a, pants: 0xe0d4b8, skin: 0xf0c09a, style: 'bui', hairColor: 0x2a201b, iris: 0x6a3a1e } },
  { id: 'v-u1eheepu', name: 'Kenji', look: { shirt: 0x7a5236, pants: 0xf1ebdc, skin: 0xe6b08a, style: 'bachom', hairColor: 0x2a201b, iris: 0x4a2a18 } },
  { id: 'v-081sseh2', name: 'Meiling', look: { shirt: 0xa83a2a, pants: 0x3a3430, skin: 0xf5caa6, style: 'bob', hairColor: 0x2a201b, iris: 0x6a3a1e } },
  { id: 'v-40lhd03r', name: 'Noah', look: { shirt: 0x5a6a3a, pants: 0xe0d4b8, skin: 0xf0c09a, style: 'toc', hairColor: 0x4a2e1e, iris: 0x7a4a24 } },
  { id: 'v-83bas3vc', name: 'Takeshi', look: { shirt: 0x5a4a3a, pants: 0x2f2a26, skin: 0xcf9a70, style: 'toc', hairColor: 0xe6e2da, old: true, beardColor: 0xf2efe8, iris: 0x3a2214, hat: 0xe2d29c } },
  { id: 'v-jwkvwby6', name: 'Grace', look: { shirt: 0x6a5a7a, pants: 0x2f2a26, skin: 0xe0ad84, style: 'bui', hairColor: 0xdcd8d0, old: true, iris: 0x3a2214, hat: 0xe8d9a8, scarf: 0x7a5236 } },
  { id: 'v-i822927q', name: 'Dongwoo', look: { shirt: 0x4a5a6a, pants: 0x3a3430, skin: 0xd9a479, style: 'khan', khan: 0x8a2a1a, iris: 0x4a2a18, hat: 0xe5d6a2 } },
  { id: 'v-runpspd8', name: 'Yumi', look: { shirt: 0x3a3450, pants: 0x2f2a26, skin: 0xf0c09a, style: 'curly', hairColor: 0x2a201b, iris: 0x6a3a1e, hat: 0xeadcae } },
  { id: 'v-0psn2cox', name: 'Henry', look: { shirt: 0x8a6a4a, pants: 0x4a3a30, skin: 0xf2c4a0, style: 'toc', hairColor: 0x4a2e1e, iris: 0x7a4a24, hat: 0xe9dbab, scarf: 0x4a6a9a } },
  { id: 'v-ezb8w5p1', name: 'Minji', look: { shirt: 0xb06a3a, pants: 0x2f2a26, skin: 0xf5caa6, style: 'bob', hairColor: 0x3a2418, iris: 0x6a3a1e, hat: 0xece0b4 } },
  { id: 'v-uh3279au', name: 'Zhiwei', look: { shirt: 0x4a7a3a, pants: 0x3a3430, skin: 0xe6b08a, style: 'chom', hairColor: 0x2a201b, iris: 0x4a2a18, hat: 0xe2d29c } },
  { id: 'v-qy7m2o15', name: 'Clara', look: { shirt: 0x6a3a3a, pants: 0x2f2a26, skin: 0xe0ad84, style: 'bui', hairColor: 0x3a2418, iris: 0x5a3220, hat: 0xe8d9a8, scarf: 0x9a2a1a } },
];

export const TEACHER = {
  id: NPC.teacher,
  name: 'Shen',
  kind: 'teacher',
  model: 'scholar-ink',
  look: { shirt: 0x26252e, pants: 0x26252e, skin: 0xeab08a, style: 'khan', khan: 0x1f1e26, hairColor: 0xdedad2, old: true, beardColor: 0xf6f3ec, iris: 0x3a2a20 },
  exit: 0,
};

export const PEDDLER = {
  id: NPC.vendor,
  name: 'Sunhee',
  kind: 'vendor',
  model: 'vendor',
  look: { shirt: 0x5a4a6a, pants: 0x2f2a26, skin: 0xe6b08a, style: 'bui', hairColor: 0x4a3a30, old: true, iris: 0x4a2a18, hat: 0xe5d6a2 },
  exit: 0,
};

export const BLOCKED = { radius: 0.8, nagEvery: 8 };
export const NAGS = ['Mua xong rồi thì nhường chỗ với!', 'Xong rồi thì tránh ra cho người ta mua với!', 'Đứng mãi thế, người ta chờ nãy giờ!'];

const GUARD_LOOK = { pants: 0x2a2622, style: 'khan', khan: 0x8a2a1a, sash: 0x9a2a1a, iris: 0x4a2a18 };
export const GUARDS = [
  { id: NPC.guardHung, name: 'Ken', follower: false, look: { ...GUARD_LOOK, shirt: 0x5a3a24, skin: 0xe0ad84 } },
  { id: NPC.guardDung, name: 'Mason', follower: true, look: { ...GUARD_LOOK, shirt: 0x4a3420, skin: 0xd9a479 } },
].map((guard) => ({ ...guard, kind: 'guard', model: 'police' }));
export const GUARD_DAY_CALLS = ['Dân binh đi tuần đây!', 'Bà con yên tâm làm ăn nhé!', 'Trật tự, trật tự nào!'];
export const GUARD_NIGHT_CALLS = ['Cốc! Cốc! Bình an vô sự!', 'Khuya rồi, đóng cửa cẩn thận nhé!', 'Canh khuya, giữ lửa cẩn thận!'];

export const PEDDLER_DAY_CALLS = ['Rau tươi đây, ai mua rau không!', 'Hàng rong đi một vòng đây!'];
export const PEDDLER_CALLS = ['Ai chè đậu đen, bánh giò đâyyy!', 'Phở nóng đâyyy!', 'Xôi xéo nóng hổi đâyyy!', 'Ai ăn gì không nàooo!'];

const SHIRTS = [0x8a5a34, 0x6e4a30, 0xa0703f, 0x4a6a9a, 0x5a7a4a, 0xb0804a];
const PANTS = [0xf1ebdc, 0x3a3430, 0xe0d4b8];
const SKINS = [0xf0c09a, 0xe6b08a, 0xf5caa6];
const STYLES = ['chom', 'bachom', 'toc', 'bui', 'khan', 'bob', 'curly'];
const HAIRS = [0x2a201b, 0x2a201b, 0x3a2418, 0x4a2e1e];
const KHANS = [0x3a3430, 0x8a3a2a, 0x4a6a9a];
const IRISES = [0x6a3a1e, 0x4a2a18, 0x7a4a24];

export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const LANE = 0.7;
export const TURN_RATE = 3.75;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function canMove(nav, y, x, z) {
  const to = nav.heightAt(x, z);
  return to !== null && Math.abs(to - y) <= MAX_STEP;
}

export function villagerProfiles() {
  const rand = makeRandom(77);
  const choose = (list) => list[Math.floor(rand() * list.length)];
  const tint = makeRandom(91);
  const students = STUDENTS.map(([id, name, model]) => {
    const look = { shirt: choose(SHIRTS), pants: choose(PANTS), skin: choose(SKINS), style: choose(STYLES), khan: choose(KHANS), iris: choose(IRISES) };
    look.hairColor = HAIRS[Math.floor(tint() * HAIRS.length)];
    return { id, name, kind: 'villager', model, look, seed: rand(), exit: rand() < 0.5 ? 0 : 1 };
  });
  const farmers = FARMERS.map((farmer) => ({ ...farmer, kind: 'villager', seed: rand(), exit: rand() < 0.5 ? 0 : 1 }));
  const later = makeRandom(131);
  const newcomers = NEWCOMERS.map((villager) => ({
    ...villager,
    kind: 'villager',
    seed: later(),
    exit: later() < 0.5 ? 0 : 1,
  }));
  return [...students, ...farmers, ...newcomers];
}
