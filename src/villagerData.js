import { makeRandom } from './random.js';
import { HOUSE } from './school.js';
import { FARM_X } from './farm.js';
import { DISTRICT_STREETS } from './district.js';
import { ROAD } from './road.js';

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
export const SELF_STUDY = { chance: 0.25, stay: [90, 240], cooldown: 300 };
export const CLASSROOM = { x: 0.5, z: HOUSE.back + 9 };
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
  [-14, 31.3, 15, 32.8],
  [-8.5, HOUSE.back + 4, 9.5, HOUSE.front - 1],
  [-11, 9, 12, 25.5],
];

export const STREET = [
  [-40, 34, 40, 36],
  [48, 30.5, 97, 39.5],
  ...DISTRICT_STREETS,
];

export const CHAT = ['Chào cậu!', 'Hôm nay học gì thế?', 'Ha ha!', 'Chơi ô ăn quan không?', 'Thầy nghiêm quá!', 'Tớ thuộc bài rồi!', 'Đói bụng quá...', 'Đi bắt dế không?', 'Hì hì', 'Ừ!', 'Thật á?', 'Chiều đi thả diều nhé!'];
export const PLAY = ['Đuổi bắt nè!', 'Bắt được rồi!', 'Hí hí!', 'Chạy mau!', 'Không bắt được đâu!'];
export const BACK = ['Sắp vào học rồi!', 'Về chỗ thôi!', 'Trống rồi kìa!', 'Chờ tớ với!'];
export const LATE = ['Muộn mất rồi!', 'Chạy nhanh lên!', 'Chờ tớ với!'];
export const TAKEN = ['Ơ, có người ngồi rồi!', 'Tớ ngồi chỗ khác vậy.', 'Chỗ tớ bị chiếm mất rồi!'];
export const FIELD = ['Nắng quá!', 'Mùa này được giá đó!', 'Ráng làm cho xong luống này.', 'Rau năm nay tốt ghê!', 'Nghỉ tay chút đã.'];
export const TEND = ['Rau lên đều quá!', 'Mai mốt là thu được rồi.', 'Đất còn ẩm, khỏi tưới.', 'Lá xanh mướt ghê!', 'Coi chừng sâu nghen...'];
export const GOSSIP = ['Hôm nay trời đẹp ghê!', 'Nghe nói giá dưa lên rồi.', 'Mùa này mưa nắng thất thường quá.', 'Chiều nay ra đình chơi không?', 'Ăn cơm chưa?', 'Nhà Lý trưởng mới sơn lại cổng đó.', 'Rau muống nhà tui sắp cắt được rồi!'];
export const REST = ['Nghỉ mát chút đã.', 'Gió mát quá!', 'Mỏi lưng ghê...'];
export const FIELD_EDGES = [
  [-30, 37.4, 31, 37.9],
  [-1.6, 39.5, 1.8, 59.5],
  [-30, 60.6, 31, 61.2],
].map(([x0, z0, x1, z1]) => [x0 + FARM_X, z0, x1 + FARM_X, z1]);
export const CAUGHT = ['Dính rồi!', 'Con này to ghê!', 'Hên quá!'];
export const ESCAPED = ['Sổng mất rồi...', 'Tiếc ghê!', 'Chữ này khó quá...'];
export const BAGGED = ['Bắt được rồi!', 'Hên ghê!', 'Đem ra chợ bán thôi!'];
export const MISSED = ['Chạy mất rồi...', 'Nhanh quá!', 'Hụt mất!'];
export const BROKE = ['Hết tiền đóng học rồi...', 'Đi làm ruộng kiếm tiền đã!', 'Mai em đi học sau.'];
export const PAID = ['Em nộp học phí ạ!', 'Thưa thầy, tiền học ạ.', 'Dạ nộp tiền ạ!'];

const STUDENT_MODELS = { na: 'farmgirl', bong: 'farmgirl-blue', mit: 'aodai', su: 'aodai-blue', hen: 'vendor-indigo', ti: 'schoolboy', teo: 'schoolboy-blue' };

const STUDENTS = [
  ['ti', 'Tí'],
  ['teo', 'Tèo'],
  ['na', 'Bé Na'],
  ['bin', 'Cu Bin'],
  ['mit', 'Mít'],
  ['bong', 'Bống'],
  ['su', 'Su'],
  ['tun', 'Tũn'],
  ['bi', 'Bi'],
  ['co', 'Cò'],
  ['hen', 'Hến'],
  ['nhim', 'Nhím'],
];

const FARMERS = [
  { id: 'tu', name: 'Bác Tư', model: 'worker-brown', look: { shirt: 0x7a5236, pants: 0x2f2a26, skin: 0xd9a479, style: 'toc', hairColor: 0x8a8580, old: true, iris: 0x4a2a18, hat: 0xe8d9a8, scarf: 0x2f3a4a } },
  { id: 'ba', name: 'Chú Ba', model: 'man', look: { shirt: 0x34507a, pants: 0x3a3430, skin: 0xe0ad84, style: 'khan', khan: 0x8a3a2a, iris: 0x5a3220, hat: 0xe2d29c, scarf: 0x8a3a2a } },
  { id: 'hai', name: 'Cô Hai', model: 'girl', look: { shirt: 0x9a4a5a, pants: 0x2f2a26, skin: 0xf0c09a, style: 'bui', iris: 0x6a3a1e, hat: 0xeadcae } },
  { id: 'nam', name: 'Anh Năm', model: 'man-brown', look: { shirt: 0x5a7a4a, pants: 0x4a3a30, skin: 0xe6b08a, style: 'toc', hairColor: 0x3a2618, iris: 0x4a2a18, hat: 0xe5d6a2, scarf: 0x4a6a9a } },
  { id: 'sau', name: 'Ông Sáu', look: { shirt: 0x6a5a48, pants: 0x2f2a26, skin: 0xcf9a70, style: 'toc', hairColor: 0xe6e2da, old: true, beardColor: 0xf2efe8, iris: 0x3a2214, hat: 0xdccb94 } },
  { id: 'bay', name: 'Chị Bảy', model: 'girl-jade', look: { shirt: 0xb07a3a, pants: 0x2f2a26, skin: 0xf0c09a, style: 'bob', hairColor: 0x3a2418, iris: 0x6a3a1e, hat: 0xece0b4 } },
  { id: 'tam', name: 'Út Tám', model: 'worker', look: { shirt: 0x3a7a8a, pants: 0x4a3a30, skin: 0xf2c4a0, style: 'chom', iris: 0x7a4a24, hat: 0xe9dbab } },
];

export const TEACHER = {
  id: 'teacher',
  name: 'Thầy đồ',
  kind: 'teacher',
  model: 'scholar-ink',
  look: { shirt: 0x26252e, pants: 0x26252e, skin: 0xeab08a, style: 'khan', khan: 0x1f1e26, hairColor: 0xdedad2, old: true, beardColor: 0xf6f3ec, iris: 0x3a2a20 },
  exit: 0,
};

export const PEDDLER = {
  id: 'vendor',
  name: 'Cô hàng rong',
  kind: 'vendor',
  model: 'vendor',
  look: { shirt: 0x5a4a6a, pants: 0x2f2a26, skin: 0xe6b08a, style: 'bui', hairColor: 0x4a3a30, old: true, iris: 0x4a2a18, hat: 0xe5d6a2 },
  exit: 0,
};

export const BLOCKED = { radius: 0.8, nagEvery: 8 };
export const NAGS = ['Mua xong rồi thì nhường chỗ với!', 'Xong rồi thì tránh ra cho người ta mua với!', 'Đứng mãi thế, người ta chờ nãy giờ!'];

const GUARD_LOOK = { pants: 0x2a2622, style: 'khan', khan: 0x8a2a1a, sash: 0x9a2a1a, iris: 0x4a2a18 };
export const GUARDS = [
  { id: 'guard-hung', name: 'Dân binh Hùng', shift: 'day', follower: false, exit: 0, look: { ...GUARD_LOOK, shirt: 0x5a3a24, skin: 0xe0ad84 } },
  { id: 'guard-dung', name: 'Dân binh Dũng', shift: 'day', follower: true, exit: 0, look: { ...GUARD_LOOK, shirt: 0x4a3420, skin: 0xd9a479 } },
  { id: 'guard-luc', name: 'Dân binh Lực', shift: 'night', follower: false, exit: 1, look: { ...GUARD_LOOK, shirt: 0x3a3a3a, skin: 0xe6b08a } },
  { id: 'guard-manh', name: 'Dân binh Mạnh', shift: 'night', follower: true, exit: 1, look: { ...GUARD_LOOK, shirt: 0x34302c, skin: 0xd9a479 } },
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
export const PACE = { chance: 0.4, every: [25, 50], stops: [1, 3], pause: [4, 8], speed: 0.5, watch: 3 };
export const LANE = 0.7;
export const GROUP = { size: [2, 4], start: [0.3, 7], spread: 0.8, lanes: [-0.7, -0.2, 0.3, 0.8], speed: [0.95, 1.05], together: 40 };
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
  const students = STUDENTS.map(([id, name]) => {
    const look = { shirt: choose(SHIRTS), pants: choose(PANTS), skin: choose(SKINS), style: choose(STYLES), khan: choose(KHANS), iris: choose(IRISES) };
    look.hairColor = HAIRS[Math.floor(tint() * HAIRS.length)];
    return { id, name, kind: 'student', model: STUDENT_MODELS[id], look, diligence: 0.82 + rand() * 0.15, exit: rand() < 0.5 ? 0 : 1 };
  });
  const farmers = FARMERS.map((farmer) => ({ ...farmer, kind: 'farmer', diligence: 0.3 + rand() * 0.3, exit: rand() < 0.5 ? 0 : 1 }));
  return [...students, ...farmers];
}
