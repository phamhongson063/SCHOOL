import * as THREE from 'three';
import { createWalker, createStudent } from './characters.js';
import { createBubble } from './bubble.js';
import { Gait } from './gait.js';
import { createBlobShadow } from './groundfx.js';
import { createWatering } from './watering.js';
import { createHarvesting } from './harvesting.js';
import { createClearing } from './clearing.js';
import { createAngler } from './angler.js';
import { makeRandom } from './random.js';
import { CROPS } from './crops.js';
import { ITEMS, seedId, fishId } from './inventory.js';
import { MONEY, ROUTINE, SCHOOL, VILLAGER, FISH, FISHING, ENERGY, EATERY, FOODS, LODGING, HUNTING } from './config.js';
import { INN_STAND } from './inn.js';
import { activityOf } from './stamina.js';
import { amount } from './format.js';
import { realSeconds } from './clock.js';
import { TEACHER_STAND, FLOOR, HOUSE } from './school.js';
import { FIELD_TREES, FARM_X } from './farm.js';
import { ServiceQueue } from './queue.js';
import { iconTag } from './itemArt.js';
import { DISTRICT_STREETS } from './district.js';
import { layDown, restEase, REST_TIME } from './walk.js';

const SPACING = 0.62;
const LOOKAHEAD = 0.85;
const MAX_STEP = 0.55;
const AVOID_RANGE = 1.15;
const QUEUE_DRIFT = 0.5;
const CLASSROOM = { x: 0.5, z: HOUSE.back + 9 };
const PATHS_PER_FRAME = 2;
const STUCK_TIME = 1.2;
const VISIBLE_DISTANCE = 40;
const SKIP_FRAMES = 2;
const FEELERS = [0, 0.45, 0.9, 1.35];

const HANGOUTS = [
  { x: -2.3, z: 16.8 },
  { x: 4.9, z: 20 },
  { x: 13.7, z: 16 },
  { x: -11.9, z: 14.4 },
  { x: 0.5, z: 9.8 },
  { x: -5.5, z: 23.2 },
];

const YARD = [
  [-14, 31.3, 15, 32.8],
  [-8.5, HOUSE.back + 4, 9.5, HOUSE.front - 1],
  [-11, 9, 12, 25.5],
];

const STREET = [
  [-40, 34, 40, 36],
  [48, 30.5, 97, 39.5],
  ...DISTRICT_STREETS,
];

const CHAT = ['Chào cậu!', 'Hôm nay học gì thế?', 'Ha ha!', 'Chơi ô ăn quan không?', 'Thầy nghiêm quá!', 'Tớ thuộc bài rồi!', 'Đói bụng quá...', 'Đi bắt dế không?', 'Hì hì', 'Ừ!', 'Thật á?', 'Chiều đi thả diều nhé!'];
const PLAY = ['Đuổi bắt nè!', 'Bắt được rồi!', 'Hí hí!', 'Chạy mau!', 'Không bắt được đâu!'];
const BACK = ['Sắp vào học rồi!', 'Về chỗ thôi!', 'Trống rồi kìa!', 'Chờ tớ với!'];
const LATE = ['Muộn mất rồi!', 'Chạy nhanh lên!', 'Chờ tớ với!'];
const TAKEN = ['Ơ, có người ngồi rồi!', 'Tớ ngồi chỗ khác vậy.', 'Chỗ tớ bị chiếm mất rồi!'];
const FIELD = ['Nắng quá!', 'Mùa này được giá đó!', 'Ráng làm cho xong luống này.', 'Rau năm nay tốt ghê!', 'Nghỉ tay chút đã.'];
const TEND = ['Rau lên đều quá!', 'Mai mốt là thu được rồi.', 'Đất còn ẩm, khỏi tưới.', 'Lá xanh mướt ghê!', 'Coi chừng sâu nghen...'];
const GOSSIP = ['Hôm nay trời đẹp ghê!', 'Nghe nói giá dưa lên rồi.', 'Mùa này mưa nắng thất thường quá.', 'Chiều nay ra đình chơi không?', 'Ăn cơm chưa?', 'Nhà Lý trưởng mới sơn lại cổng đó.', 'Rau muống nhà tui sắp cắt được rồi!'];
const REST = ['Nghỉ mát chút đã.', 'Gió mát quá!', 'Mỏi lưng ghê...'];
const FIELD_EDGES = [
  [-30, 37.4, 31, 37.9],
  [-1.6, 39.5, 1.8, 59.5],
  [-30, 60.6, 31, 61.2],
].map(([x0, z0, x1, z1]) => [x0 + FARM_X, z0, x1 + FARM_X, z1]);
const CAUGHT = ['Dính rồi!', 'Con này to ghê!', 'Hên quá!'];
const ESCAPED = ['Sổng mất rồi...', 'Tiếc ghê!', 'Chữ này khó quá...'];
const BAGGED = ['Bắt được rồi!', 'Hên ghê!', 'Đem ra chợ bán thôi!'];
const MISSED = ['Chạy mất rồi...', 'Nhanh quá!', 'Hụt mất!'];
const BROKE = ['Hết tiền đóng học rồi...', 'Đi làm ruộng kiếm tiền đã!', 'Mai em đi học sau.'];
const PAID = ['Em nộp học phí ạ!', 'Thưa thầy, tiền học ạ.', 'Dạ nộp tiền ạ!'];

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
  { id: 'tu', name: 'Bác Tư', look: { shirt: 0x7a5236, pants: 0x2f2a26, skin: 0xd9a479, style: 'toc', hairColor: 0x8a8580, old: true, iris: 0x4a2a18, hat: 0xe8d9a8, scarf: 0x2f3a4a } },
  { id: 'ba', name: 'Chú Ba', look: { shirt: 0x34507a, pants: 0x3a3430, skin: 0xe0ad84, style: 'khan', khan: 0x8a3a2a, iris: 0x5a3220, hat: 0xe2d29c, scarf: 0x8a3a2a } },
  { id: 'hai', name: 'Cô Hai', look: { shirt: 0x9a4a5a, pants: 0x2f2a26, skin: 0xf0c09a, style: 'bui', iris: 0x6a3a1e, hat: 0xeadcae } },
  { id: 'nam', name: 'Anh Năm', look: { shirt: 0x5a7a4a, pants: 0x4a3a30, skin: 0xe6b08a, style: 'toc', hairColor: 0x3a2618, iris: 0x4a2a18, hat: 0xe5d6a2, scarf: 0x4a6a9a } },
  { id: 'sau', name: 'Ông Sáu', look: { shirt: 0x6a5a48, pants: 0x2f2a26, skin: 0xcf9a70, style: 'toc', hairColor: 0xe6e2da, old: true, beardColor: 0xf2efe8, iris: 0x3a2214, hat: 0xdccb94 } },
  { id: 'bay', name: 'Chị Bảy', look: { shirt: 0xb07a3a, pants: 0x2f2a26, skin: 0xf0c09a, style: 'bob', hairColor: 0x3a2418, iris: 0x6a3a1e, hat: 0xece0b4 } },
  { id: 'tam', name: 'Út Tám', look: { shirt: 0x3a7a8a, pants: 0x4a3a30, skin: 0xf2c4a0, style: 'chom', iris: 0x7a4a24, hat: 0xe9dbab } },
];

const TEACHER = {
  id: 'teacher',
  name: 'Thầy đồ',
  kind: 'teacher',
  look: { shirt: 0x26252e, pants: 0x26252e, skin: 0xeab08a, style: 'khan', khan: 0x1f1e26, hairColor: 0xdedad2, old: true, beardColor: 0xf6f3ec, iris: 0x3a2a20 },
  exit: 0,
};

const SHIRTS = [0x8a5a34, 0x6e4a30, 0xa0703f, 0x4a6a9a, 0x5a7a4a, 0xb0804a];
const PANTS = [0xf1ebdc, 0x3a3430, 0xe0d4b8];
const SKINS = [0xf0c09a, 0xe6b08a, 0xf5caa6];
const STYLES = ['chom', 'bachom', 'toc', 'bui', 'khan', 'bob', 'curly'];
const HAIRS = [0x2a201b, 0x2a201b, 0x3a2418, 0x4a2e1e];
const KHANS = [0x3a3430, 0x8a3a2a, 0x4a6a9a];
const IRISES = [0x6a3a1e, 0x4a2a18, 0x7a4a24];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function canMove(nav, y, x, z) {
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
    return { id, name, kind: 'student', look, diligence: 0.82 + rand() * 0.15, exit: rand() < 0.5 ? 0 : 1 };
  });
  const farmers = FARMERS.map((farmer) => ({ ...farmer, kind: 'farmer', diligence: 0.3 + rand() * 0.3, exit: rand() < 0.5 ? 0 : 1 }));
  return [...students, ...farmers];
}

function studyTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = '#fff6d8';
  ctx.fill();
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = '#c9962f';
  ctx.stroke();
  ctx.font = `${size * 0.5}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📖', size / 2, size / 2 + size * 0.03);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let studyMaterial = null;

export function createStudyIcon() {
  studyMaterial ??= new THREE.SpriteMaterial({ map: studyTexture(), transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(studyMaterial);
  sprite.scale.setScalar(0.42);
  sprite.renderOrder = 6;
  sprite.visible = false;
  return sprite;
}

export function blinkStudyIcons(t) {
  if (studyMaterial) studyMaterial.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * 3.2));
}

class Villager {
  constructor(profile, town) {
    this.profile = profile;
    this.id = profile.id;
    this.name = profile.name;
    this.kind = profile.kind;
    this.town = town;
    this.diligence = profile.diligence ?? 0;
    this.innGoer = Math.random() < 0.35;
    this.walker = createWalker(profile.look);
    this.walker.group.rotation.order = 'YXZ';
    this.walker.group.visible = false;
    town.root.add(this.walker.group);
    this.present = false;
    this.seatedShown = false;
    this.near = true;
    this.skipDt = 0;
    this.skipCount = 0;
    this.bubble = createBubble();
    this.bubble.sprite.position.set(0, 2.05, 0);
    this.walker.group.add(this.bubble.sprite);
    this.shadow = createBlobShadow(town.root);
    this.shadow.setVisible(false);
    this.seated = null;
    this.studyIcon = null;
    if (this.kind !== 'teacher') {
      this.seated = createStudent(profile.look);
      this.seated.group.visible = false;
      town.root.add(this.seated.group);
      this.studyIcon = createStudyIcon();
      this.studyIcon.position.set(0, 1.3, 0);
      this.seated.group.add(this.studyIcon);
      this.seatBubble = createBubble();
      this.seatBubble.sprite.position.set(0, 1.55, 0);
      this.seated.group.add(this.seatBubble.sprite);
    }
    this.fx = null;

    const adult = this.kind !== 'student';
    this.walkSpeed = (adult ? 1.4 : 1.6) * between(0.85, 1.2);
    this.runSpeed = 3.3 * between(0.85, 1.15);
    this.accel = between(2.2, 4);
    this.decel = between(2.5, 4.5);
    this.turnRate = between(3, 4.5);
    this.wobbleF = between(0.35, 0.9);
    this.wobbleP = Math.random() * Math.PI * 2;
    this.stepTime = between(0.35, 0.6);
    this.chatty = between(0.6, 1.4);
    this.returnSpeed = this.walkSpeed * 1.15;
    this.returnMargin = 6;
    this.gait = new Gait({ stride: between(0.6, 0.85), armSwing: between(0.55, 1.0), bounce: adult ? 0.8 : between(0.7, 1.4) });
    this.writing = Math.random() < 0.6;
    this.seatPhase = Math.random() * Math.PI * 2;

    this.position = new THREE.Vector3();
    this.from = new THREE.Vector3();
    this.facing = Math.random() * Math.PI * 2;
    this.velocity = 0;
    this.state = 'away';
    this.task = null;
    this.timer = 0;
    this.afterWait = null;
    this.onRouteEnd = null;
    this.route = null;
    this.seg = 0;
    this.cruise = this.walkSpeed;
    this.routeTime = 0;
    this.routeBudget = 0;
    this.pauseTimer = 0;
    this.pop = 0;
    this.homeSeat = null;
    this.seatRef = null;
    this.targetSeat = null;
    this.afterLeave = null;
    this.recess = false;
    this.activity = null;
    this.slot = null;
    this.lookAt = null;
    this.nextLine = 0;
    this.playLegs = 0;
    this.job = null;
    this.studying = false;
    this.payAt = null;
    this.attendDay = null;
    this.attending = false;
    this.sitAnyway = false;
    this.wakeAt = null;
    this.lyingDown = false;
    this.restBlend = 0;
    this.restClock = 0;
    this.queue = null;
    this.queueIndex = -1;
    this.serve = null;
    this.now = 0;
  }

  get purse() {
    return this.town.ledger.purse(this.id);
  }

  get effects() {
    this.fx ??= {
      water: createWatering(this.town.root, this.walker),
      harvest: createHarvesting(this.town.root, this.walker),
      clear: createClearing(this.town.root, this.walker),
      angler: createAngler(this.town.root, this.walker),
    };
    return this.fx;
  }

  get visible() {
    return this.present;
  }

  get roaming() {
    return this.state === 'walking' || this.state === 'idle' || this.state === 'heeding' || this.state === 'working' || this.state === 'queued' || this.state === 'fishing';
  }

  get inSchool() {
    return this.task === 'class' || this.recess || this.state === 'seated' || this.state === 'sitting' || this.state === 'rising' || this.state === 'leaving';
  }

  owns(object) {
    for (let node = object; node; node = node.parent) {
      if (node === this.walker.group || node === this.seated?.group) return true;
    }
    return false;
  }

  say(text, seconds = 1.8) {
    if (this.state === 'seated') this.seatBubble?.show(text, seconds, this.now);
    else this.bubble.show(text, seconds, this.now);
  }

  greet(from) {
    if (this.state === 'idle') this.facing = Math.atan2(from.x - this.position.x, from.z - this.position.z);
    const purse = this.purse;
    const parts = [`${MONEY.icon} ${amount(purse.money)}`];
    for (const [id, amount] of purse.entries('produce')) parts.push(`${iconTag(ITEMS[id])} ${amount}`);
    const seeds = purse.total('seed');
    if (seeds) parts.push(`🌱 ${seeds}`);
    const house = this.town.estate.houseOf(this.id);
    this.say(`${this.name}: ${parts.join(' · ')}${house ? ` · 🏠 ${house.id}` : ''}`, 3);
  }

  setVisible(visible) {
    this.present = visible;
    if (!visible) this.bubble.hide();
    this.applyLod();
  }

  showSeated(shown) {
    this.seatedShown = shown;
    this.applyLod();
  }

  applyLod() {
    const near = this.present && this.near;
    this.walker.group.visible = near;
    this.shadow.setVisible(near);
    if (this.seated) this.seated.group.visible = this.seatedShown && this.near;
  }

  attendsToday(day) {
    if (this.kind === 'teacher') return false;
    if (this.attendDay !== day) {
      this.attendDay = day;
      this.attending = Math.random() < this.diligence;
      this.sitAnyway = Math.random() < VILLAGER.sitWithoutPaying;
    }
    if (!this.attending) return false;
    const purse = this.purse;
    return purse.credits > 0 || purse.money >= SCHOOL.tuition || this.sitAnyway;
  }

  shouldAttend(ctx) {
    if (!this.attendsToday(ctx.day)) return false;
    const phase = ctx.phase;
    if (phase.kind === 'free') return !!phase.next && phase.remaining <= ROUTINE.schoolLead;
    return phase.kind !== 'period';
  }

  think() {
    const ctx = this.town.context;
    this.lookAt = null;
    this.task = null;
    if (ctx.night) return this.goHome();
    if (this.wantsInn()) return this.goInn();
    if (this.wantsFood(ctx)) return this.goEat();
    if (this.shouldAttend(ctx)) return this.goToClass();
    if (ctx.shopOpen && this.town.market.wantsTrade(this)) return this.goShop();
    if (ctx.chiefOpen && this.town.estate.affordableFor(this.id, this.purse.money - VILLAGER.houseReserve)) return this.goChief();
    if (this.purse.energy < ENERGY.costs.clear) return this.wait(between(2, 4), () => this.goFarm(() => this.goRest()));
    return this.goFarm();
  }

  goRest() {
    this.task = 'rest';
    this.lookAt = null;
    this.travel(this.town.fieldEdgePoint(), {
      speed: this.walkSpeed * 0.8,
      then: () => this.lieDown(),
      fail: () => this.lieDown(),
    });
  }

  lieDown() {
    this.task = 'rest';
    this.route = null;
    this.velocity = 0;
    this.state = 'resting';
    this.lyingDown = true;
    this.say('Mệt quá, nằm nghỉ chút...', 2);
  }

  restUpdate(dt) {
    this.velocity = 0;
    const ctx = this.town.context;
    if (this.lyingDown && (ctx.night || this.purse.energy >= VILLAGER.restUntil)) this.lyingDown = false;
    this.restBlend = Math.min(1, Math.max(0, this.restBlend + (this.lyingDown ? dt : -dt) / REST_TIME));
    if (this.lyingDown || this.restBlend > 0) return;
    this.state = 'idle';
    this.timer = 0;
    this.afterWait = null;
    this.think();
  }

  activityNow(ctx) {
    if (this.state === 'away') return ctx.night ? 'sleep' : 'idle';
    if (this.state === 'inn') return 'inn';
    if (this.state === 'resting') return this.lyingDown ? 'rest' : 'idle';
    if (this.state === 'seated' || this.state === 'teaching') return 'seated';
    return activityOf(this.velocity, this.walkSpeed, this.runSpeed);
  }

  tickEnergy(ctx) {
    this.purse.liveEnergy(ctx.minutes, this.activityNow(ctx), 'sleep');
    this.tired = this.purse.energy <= 0;
  }

  wantsFood(ctx) {
    if (this.purse.energy >= ENERGY.low || ctx.minute < EATERY.open || ctx.minute >= EATERY.close) return false;
    return Object.values(FOODS).some((food) => food.price <= this.purse.money);
  }

  wantsInn() {
    return this.innGoer && this.purse.energy < ENERGY.low && this.purse.money >= LODGING.price;
  }

  goInn() {
    this.cancel();
    this.task = 'inn';
    this.travel(INN_STAND, { then: () => this.checkIn(), fail: () => this.wait(between(2, 4)) });
  }

  checkIn() {
    if (!this.purse.spend(LODGING.price)) {
      this.say('Hết tiền thuê phòng rồi...', 2);
      this.wait(between(1.5, 3));
      return;
    }
    this.cancel();
    this.task = 'inn';
    this.route = null;
    this.velocity = 0;
    this.state = 'inn';
    this.setVisible(false);
  }

  leaveInn() {
    this.task = null;
    this.position.set(INN_STAND.x, this.town.nav.heightAt(INN_STAND.x, INN_STAND.z) ?? 0, INN_STAND.z);
    this.facing = 0;
    this.velocity = 0;
    this.pop = 0.25;
    this.setVisible(true);
    this.wait(between(0.6, 1.5));
    this.say('Khoẻ re rồi!', 1.8);
  }

  goEat() {
    this.cancel();
    this.task = 'eat';
    this.enqueue(this.town.queues.eatery, () => this.eat());
  }

  eat() {
    const ctx = this.town.context;
    const purse = this.purse;
    if (ctx.minute < EATERY.open || ctx.minute >= EATERY.close) {
      this.say('Quán đóng cửa mất rồi!');
      this.wait(1.5, () => this.finishService());
      return;
    }
    const menu = Object.values(FOODS).sort((a, b) => b.energy - a.energy);
    const eaten = [];
    for (const food of menu) {
      while (purse.energy < ENERGY.max * 0.8 && purse.energy + food.energy <= ENERGY.max + 5 && purse.spend(food.price)) {
        purse.addEnergy(food.energy);
        eaten.push(food.icon);
      }
    }
    this.say(eaten.length ? `Ăn ${eaten.join('')} no bụng rồi!` : 'Hết tiền ăn rồi...', 2.2);
    this.wait(between(2, 4), () => this.finishService());
  }

  wait(seconds, then = null) {
    this.state = 'idle';
    this.timer = seconds;
    this.route = null;
    this.afterWait = then;
  }

  travel(point, { speed = this.walkSpeed, then = null, fail = null, state = 'walking' } = {}) {
    if (this.tired) speed = Math.min(speed, this.walkSpeed * ENERGY.tiredSpeed);
    const path = this.town.path(this.position, point);
    if (path === undefined) {
      this.wait(0.05 + Math.random() * 0.15, () => this.travel(point, { speed, then, fail, state }));
      return;
    }
    if (!path || !path.length) {
      if (fail) fail();
      else this.wait(1.5);
      return;
    }
    this.route = [{ x: this.position.x, z: this.position.z }, ...path.map((p) => ({ x: p.x, z: p.z }))];
    this.seg = 0;
    this.cruise = speed;
    this.state = state;
    this.pauseTimer = 0;
    this.routeTime = 0;
    this.routeBudget = (this.remainingDistance() / Math.max(0.6, speed)) * 2.5 + 4;
    this.onRouteEnd = then;
    this.onRouteFail = fail;
    this.bestRemaining = Infinity;
    this.stuckTime = 0;
    this.repaths = 0;
  }

  giveUp() {
    this.route = null;
    this.velocity = 0;
    const fail = this.onRouteFail;
    this.onRouteEnd = null;
    this.onRouteFail = null;
    this.state = 'idle';
    this.timer = 0;
    this.afterWait = null;
    if (fail) fail();
    else this.wait(between(0.8, 1.6));
  }

  unstick() {
    this.stuckTime = 0;
    this.repaths += 1;
    if (this.repaths > 2) {
      this.giveUp();
      return;
    }
    const goal = this.route[this.route.length - 1];
    const path = this.town.path(this.position, goal);
    if (path === undefined) {
      this.repaths -= 1;
      this.stuckTime = STUCK_TIME - 0.15;
      return;
    }
    if (!path || !path.length) {
      this.giveUp();
      return;
    }
    this.route = [{ x: this.position.x, z: this.position.z }, ...path.map((p) => ({ x: p.x, z: p.z }))];
    this.seg = 0;
    this.bestRemaining = Infinity;
    this.routeTime = 0;
    this.routeBudget = (this.remainingDistance() / Math.max(0.6, this.cruise)) * 2.5 + 4;
  }

  dropJob() {
    if (this.job) this.town.farm.release(this.job.index, this.id);
    this.job = null;
  }

  cancel() {
    this.dropJob();
    this.leaveQueue();
    this.town.river.leave(this);
    this.fishing = null;
    this.town.wildlife?.release(this);
    this.hunting = null;
    if (this.fx) for (const effect of Object.values(this.fx)) effect.busy && effect.cancel();
    if (this.targetSeat) this.town.seats.unreserve(this.targetSeat, this);
    this.targetSeat = null;
    this.town.releaseSlot(this);
    this.recess = false;
    this.activity = null;
    this.afterWait = null;
    this.onRouteEnd = null;
  }

  homePoint() {
    return this.town.homeOf(this);
  }

  goHome() {
    this.cancel();
    this.task = 'home';
    const home = this.homePoint();
    this.travel(home, { then: () => this.vanish(), fail: () => this.vanish() });
  }

  vanish() {
    this.cancel();
    this.task = null;
    this.route = null;
    this.velocity = 0;
    this.state = 'away';
    const home = this.homePoint();
    this.position.set(home.x, 0, home.z);
    this.setVisible(false);
  }

  appear() {
    const home = this.homePoint();
    this.position.set(home.x, this.town.nav.heightAt(home.x, home.z) ?? 0, home.z);
    this.facing = Math.random() * Math.PI * 2;
    this.velocity = 0;
    this.pop = 0.25;
    this.setVisible(true);
    this.wait(between(0.3, 1.2));
  }

  goToClass() {
    const seats = this.town.seats;
    const own = this.homeSeat && seats.isFreeFor(this.homeSeat, this) ? this.homeSeat : this.town.spareSeat(this);
    if (!own) return this.goFarm();
    this.cancel();
    this.task = 'class';
    seats.reserve(own, this);
    this.targetSeat = own;
    this.homeSeat ??= own;
    const phase = this.town.context.phase;
    const hurry = phase.kind !== 'free' || phase.remaining < 6;
    this.travel(own.spot, {
      speed: hurry ? this.runSpeed * 0.9 : this.walkSpeed * 1.1,
      then: () => this.takeSeat(),
      fail: () => {
        this.cancel();
        this.goFarm();
      },
    });
  }

  retargetSeat() {
    const seats = this.town.seats;
    seats.unreserve(this.targetSeat, this);
    const next = this.town.spareSeat(this);
    this.targetSeat = next;
    if (!next) {
      this.task = null;
      this.wait(1);
      return;
    }
    seats.reserve(next, this);
    this.say(pick(TAKEN));
    this.travel(next.spot, {
      speed: Math.max(this.cruise, this.returnSpeed),
      then: () => this.takeSeat(),
      fail: () => {
        this.cancel();
        this.goFarm();
      },
    });
  }

  takeSeat() {
    const seats = this.town.seats;
    if (!this.targetSeat || !seats.canTake(this.targetSeat, this)) {
      this.retargetSeat();
      return;
    }
    seats.occupy(this.targetSeat, this);
    this.seatRef = this.targetSeat;
    this.targetSeat = null;
    this.seatRef.place(this.seated.group);
    this.from.copy(this.position);
    this.timer = 0;
    this.state = 'sitting';
  }

  sitDown() {
    this.setVisible(false);
    this.showSeated(true);
    this.position.copy(this.seatRef.sit);
    this.facing = Math.PI;
    this.velocity = 0;
    this.state = 'seated';
    this.task = 'class';
    this.recess = false;
    const phase = this.town.context.phase;
    if (phase.kind === 'period' && !this.studying) this.payAt = this.now + between(0.1, 0.6);
    const waiting = phase.kind !== 'free' || (phase.next && phase.remaining <= ROUTINE.schoolLead);
    if (!waiting || this.town.context.night) this.rise(() => this.think(), between(1, 3));
  }

  seatDirect(seat) {
    this.cancel();
    this.town.seats.occupy(seat, this);
    this.homeSeat ??= seat;
    this.seatRef = seat;
    seat.place(this.seated.group);
    this.position.copy(seat.sit);
    this.setVisible(false);
    this.showSeated(true);
    this.state = 'seated';
    this.task = 'class';
  }

  standUp(after) {
    this.town.seats.vacate(this.seatRef, this);
    this.showSeated(false);
    this.studying = false;
    this.payAt = null;
    this.setVisible(true);
    this.position.copy(this.seatRef.sit);
    this.from.copy(this.seatRef.sit);
    this.facing = Math.PI;
    this.pop = 0.25;
    this.timer = 0;
    this.afterLeave = after;
    this.state = 'leaving';
  }

  rise(after, delay = between(0.2, 3)) {
    if (this.state !== 'seated') return false;
    this.afterLeave = after;
    this.state = 'rising';
    this.timer = delay;
    return true;
  }

  pay() {
    this.payAt = null;
    const purse = this.purse;
    if (purse.useCredit() || purse.spend(SCHOOL.tuition)) {
      this.studying = true;
      if (Math.random() < 0.35) this.say(pick(PAID), 1.6);
      return;
    }
    this.studying = false;
    if (Math.random() < 0.4) this.say(pick(BROKE), 2);
  }

  periodStart(ctx) {
    this.studying = false;
    if (this.state === 'seated') this.payAt = this.now + between(0.1, 0.6);
  }

  periodEnd() {
    this.studying = false;
    this.payAt = null;
  }

  startRecess() {
    if (this.task !== 'class') return;
    this.returnSpeed = Math.random() < 0.4 ? this.runSpeed * between(0.9, 1) : this.walkSpeed * between(1, 1.25);
    this.returnMargin = between(4, 9);
    if (this.state === 'seated') {
      this.rise(() => {
        this.recess = true;
        this.chooseActivity();
      });
      return;
    }
    if (this.state === 'sitting' || this.state === 'rising') return;
    if (this.targetSeat) this.town.seats.unreserve(this.targetSeat, this);
    this.targetSeat = null;
    this.recess = true;
    this.chooseActivity();
  }

  dueBack(breakLeft) {
    if (!this.recess || this.activity === 'return' || (this.state !== 'walking' && this.state !== 'idle')) return false;
    const spot = (this.seatRef ?? this.homeSeat)?.spot;
    if (!spot) return false;
    const distance = Math.hypot(spot.x - this.position.x, spot.z - this.position.z) * 1.35 + 2;
    return breakLeft <= distance / (this.returnSpeed * 0.8) + this.returnMargin;
  }

  endRecess(late = false) {
    if (!this.recess) return;
    if (this.state === 'rising') {
      this.state = 'seated';
      this.recess = false;
      return;
    }
    this.town.releaseSlot(this);
    this.lookAt = null;
    this.activity = 'return';
    this.pauseTimer = 0;
    this.state = 'heeding';
    this.route = null;
    this.timer = late ? between(0, 0.5) : between(0, 1.6);
    if (late) this.returnSpeed = Math.max(this.returnSpeed, this.runSpeed * between(0.9, 1));
    this.lateReturn = late;
  }

  headBack() {
    const seats = this.town.seats;
    const mine = this.seatRef ?? this.homeSeat;
    const own = mine && seats.isFreeFor(mine, this);
    const target = own ? mine : this.town.spareSeat(this);
    this.recess = false;
    this.activity = null;
    if (!target) {
      this.task = null;
      this.think();
      return;
    }
    seats.reserve(target, this);
    this.targetSeat = target;
    this.task = 'class';
    if (!own) this.say(pick(TAKEN));
    else if (Math.random() < 0.6) this.say(pick(this.lateReturn ? LATE : BACK), 1.6);
    this.travel(target.spot, { speed: this.returnSpeed, then: () => this.takeSeat(), fail: () => this.takeSeat() });
  }

  leaveSchool() {
    if (this.state === 'seated') {
      this.rise(() => this.think(), between(0.3, 4));
      return;
    }
    if (this.state === 'rising') {
      this.afterLeave = () => this.think();
      return;
    }
    if (this.recess || this.task === 'class') {
      if (this.state === 'sitting') return;
      this.cancel();
      this.task = null;
      if (this.state === 'walking' || this.state === 'idle' || this.state === 'heeding') this.think();
    }
  }

  chooseActivity() {
    this.lookAt = null;
    const r = Math.random();
    if (r < 0.45) {
      const slot = this.town.reserveSlot(this);
      if (slot) {
        this.activity = 'chat';
        this.lookAt = slot.center;
        this.travel(slot.position, { then: () => this.arriveActivity(), fail: () => this.arriveActivity() });
        return;
      }
    }
    if (r < 0.75) {
      this.activity = 'wander';
      this.travel(this.town.yardPoint(), { speed: this.walkSpeed * between(0.85, 1.1), then: () => this.arriveActivity(), fail: () => this.arriveActivity() });
      return;
    }
    this.activity = 'play';
    this.playLegs = 3 + Math.floor(Math.random() * 3);
    this.say(pick(PLAY), 1.4);
    this.travel(this.nearby(4), { speed: this.runSpeed * between(0.85, 1.05), then: () => this.arriveActivity(), fail: () => this.arriveActivity() });
  }

  arriveActivity() {
    if (!this.recess) {
      this.wait(0.5);
      return;
    }
    if (this.activity === 'chat') {
      this.wait(between(6, 11), () => this.recessNext());
      this.nextLine = between(0.5, 2.5) / this.chatty;
      return;
    }
    if (this.activity === 'play' && --this.playLegs > 0) {
      if (Math.random() < 0.3) this.say(pick(PLAY), 1.2);
      this.travel(this.nearby(4), { speed: this.runSpeed * between(0.8, 1.05), then: () => this.arriveActivity(), fail: () => this.arriveActivity() });
      return;
    }
    this.wait(between(1.5, 4.5), () => this.recessNext());
  }

  recessNext() {
    this.town.releaseSlot(this);
    if (this.recess) this.chooseActivity();
    else this.think();
  }

  nearby(radius) {
    const a = Math.random() * Math.PI * 2;
    const r = between(1.5, radius);
    return new THREE.Vector3(this.position.x + Math.cos(a) * r, 0, this.position.z + Math.sin(a) * r);
  }

  seedChoice() {
    const purse = this.purse;
    let best = null;
    let most = 0;
    for (const id of Object.keys(CROPS)) {
      const count = purse.count(seedId(id));
      if (count > most) {
        most = count;
        best = id;
      }
    }
    return best;
  }

  goFarm(idle = () => this.leisure()) {
    const farm = this.town.farm;
    const job = farm.jobFor(this, this.seedChoice());
    if (!job) {
      idle();
      return;
    }
    const stand = farm.standFor(job.index, this.position);
    farm.claim(job.index, this.id);
    this.job = job;
    this.task = 'farm';
    this.travel(stand, { then: () => this.work(), fail: () => {
      this.dropJob();
      this.wait(1.5);
    } });
  }

  canHunt() {
    const wildlife = this.town.wildlife;
    if (!wildlife) return false;
    return this.purse.energy >= HUNTING.energy + ENERGY.costs.clear && wildlife.hunters < HUNTING.villagerHunters && wildlife.hasPrey;
  }

  goHunt() {
    const wildlife = this.town.wildlife;
    const prey = wildlife.claim(this);
    if (!prey) return false;
    this.task = 'hunt';
    this.hunting = { prey };
    const stand = wildlife.standFor(prey, this.position);
    this.travel(new THREE.Vector3(stand.x, 0, stand.z), {
      then: () => this.pounce(),
      fail: () => this.endHunt(),
    });
    return true;
  }

  pounce() {
    const session = this.hunting;
    const ctx = this.town.context;
    const wildlife = this.town.wildlife;
    if (!session || ctx.night || this.shouldAttend(ctx) || !wildlife.reachable(session.prey, this.position) || !this.purse.spendEnergy(HUNTING.energy)) {
      this.endHunt();
      return;
    }
    const prey = session.prey;
    this.facing = Math.atan2(prey.x - this.position.x, prey.z - this.position.z);
    const skill = HUNTING.villagerSkill[this.kind] ?? 0.5;
    if (Math.random() < skill) {
      const item = wildlife.capture(prey);
      this.purse.add(item, 1);
      if (Math.random() < 0.7) this.say(`${pick(BAGGED)} ${iconTag(ITEMS[item])}`, 1.8);
    } else {
      wildlife.scare(prey, this.position);
      if (Math.random() < 0.6) this.say(pick(MISSED), 1.6);
    }
    this.endHunt();
  }

  endHunt() {
    this.town.wildlife?.release(this);
    this.hunting = null;
    this.task = null;
    this.wait(between(1, 2));
  }

  canFish() {
    const purse = this.purse;
    const river = this.town.river;
    return purse.count('rod') > 0 && purse.count('bait') > 0 && purse.energy >= ENERGY.costs.fish && river.hasOpenZone && river.anglers < FISHING.villagerAnglers;
  }

  goFish() {
    const spot = this.town.river.pick(this.position);
    if (!spot) return false;
    this.task = 'fish';
    const [lo, hi] = FISHING.villagerCasts;
    this.fishing = { spot, casts: lo + Math.floor(Math.random() * (hi - lo + 1)), biteAt: 0, done: false };
    this.town.river.leave(this);
    this.enqueue(spot.queue, () => this.castLine());
    return true;
  }

  nextTurn() {
    const session = this.fishing;
    session.nextCastAt = null;
    if (this.fx) this.fx.angler.stop();
    if (session.casts <= 0 || !this.town.river.hasFish(session.spot)) {
      this.endFishing();
      return;
    }
    this.leaveQueue();
    const queue = session.spot.queue;
    if (!queue.members.length) {
      this.enqueue(queue, () => this.castLine());
      return;
    }
    const aside = queue.aside(0);
    this.queue = queue;
    this.serve = () => this.castLine();
    queue.join(this);
    const rejoin = () => (this.queue === queue ? this.followQueue() : this.endFishing());
    this.travel(new THREE.Vector3(aside.x, 0, aside.z), { then: rejoin, fail: rejoin });
  }

  castLine() {
    const session = this.fishing;
    const ctx = this.town.context;
    if (!session || session.casts <= 0 || ctx.night || this.shouldAttend(ctx) || !this.town.river.hasFish(session.spot) || !this.purse.spendEnergy(ENERGY.costs.fish) || !this.purse.take('bait', 1)) {
      this.endFishing();
      return;
    }
    session.casts -= 1;
    session.done = false;
    session.reelAt = null;
    session.nextCastAt = null;
    this.facing = session.spot.facing;
    this.effects.angler.cast(session.spot.float);
    session.biteAt = this.now + 0.7 + this.town.river.biteDelay(ctx.minutes);
    this.state = 'fishing';
  }

  fishBite() {
    const session = this.fishing;
    if (!this.town.river.hasFish(session.spot)) {
      this.endFishing();
      return;
    }
    session.done = true;
    session.reelAt = this.now + between(1.5, 3);
    this.effects.angler.bite();
  }

  resolveBite() {
    const session = this.fishing;
    session.reelAt = null;
    const ctx = this.town.context;
    this.effects.angler.reel();
    const skill = FISHING.villagerSkill[this.kind] ?? 0.5;
    if (Math.random() < skill && this.town.river.take(session.spot)) {
      const fish = this.town.river.rollFish(ctx.minutes);
      this.purse.add(fishId(fish), 1);
      this.purse.markFish(ctx.day);
      const float = session.spot.float;
      this.effects.harvest.start({ count: 1, at: { x: float.x, y: 0.05, z: float.z }, height: 0.1, item: fishId(fish) });
      if (Math.random() < 0.6) this.say(`${pick(CAUGHT)} ${iconTag(ITEMS[fishId(fish)])}`, 1.8);
    } else if (Math.random() < 0.5) {
      this.say(pick(ESCAPED), 1.8);
    }
    session.nextCastAt = this.now + 1.4;
  }

  endFishing() {
    this.leaveQueue();
    this.town.river.leave(this);
    if (this.fx) this.fx.angler.stop();
    this.fishing = null;
    this.task = null;
    this.wait(between(0.5, 1.5));
  }

  leisure() {
    this.task = 'leisure';
    this.lookAt = null;
    if (Math.random() < 0.2 && this.canHunt() && this.goHunt()) return;
    if (Math.random() < 0.35 && this.canFish() && this.goFish()) return;
    const farm = this.town.farm;
    const r = Math.random();
    const plot = farm.randomPlot(this.id);
    if (r < 0.3 && plot >= 0) {
      const spot = farm.spot(plot);
      this.travel(farm.standFor(plot, this.position), {
        then: () => {
          this.facing = Math.atan2(spot.x - this.position.x, spot.z - this.position.z);
          if (Math.random() < 0.5) this.say(pick(TEND), 2.2);
          this.wait(between(3, 6));
        },
      });
      return;
    }
    if (r < 0.5) {
      const friend = this.town.companion(this, 30);
      if (friend) {
        const a = Math.random() * Math.PI * 2;
        const meet = new THREE.Vector3(friend.position.x + Math.cos(a) * 1.1, 0, friend.position.z + Math.sin(a) * 1.1);
        this.travel(meet, {
          then: () => {
            this.lookAt = friend.position;
            this.say(pick(GOSSIP), 2.6);
            if (friend.state === 'idle' && friend.task === 'leisure' && Math.random() < 0.6) {
              friend.lookAt = this.position;
              friend.say(pick(GOSSIP), 2.4);
            }
            this.wait(between(5, 9));
          },
        });
        return;
      }
    }
    if (r < 0.75 || this.kind === 'student') {
      const point = this.kind === 'student' ? this.town.strollPoint() : this.town.fieldEdgePoint();
      this.travel(point, {
        speed: this.walkSpeed * between(0.75, 0.95),
        then: () => {
          if (this.kind !== 'student' && Math.random() < 0.2) this.say(pick(FIELD), 2.2);
          this.wait(between(2, 5));
        },
      });
      return;
    }
    const [tx, tz] = pick(FIELD_TREES);
    this.travel(new THREE.Vector3(tx + 0.5 + between(-0.6, 0.6), 0, tz - 1.3), {
      then: () => {
        if (Math.random() < 0.5) this.say(pick(REST), 2);
        this.wait(between(6, 12));
      },
    });
  }

  work() {
    const job = this.job;
    const farm = this.town.farm;
    if (!job) {
      this.wait(0.5);
      return;
    }
    const cost = ENERGY.costs[job.action] ?? 0;
    if (!this.purse.spendEnergy(cost)) {
      farm.release(job.index, this.id);
      this.job = null;
      this.say('Mệt quá, nghỉ chút đã...', 1.8);
      this.wait(between(4, 8));
      return;
    }
    const spot = farm.spot(job.index);
    this.facing = Math.atan2(spot.x - this.position.x, spot.z - this.position.z);
    const effect = farm.effectFor(job.index, job.action, this.id);
    const finish = () => {
      const reply = farm.act(job.action, job.index, job.choice, this.id);
      farm.release(job.index, this.id);
      this.job = null;
      if (reply && (job.action === 'harvest' || Math.random() < 0.25)) this.say(reply);
      this.wait(0.8 + Math.random() * 1.6);
    };
    if (!effect) {
      finish();
      return;
    }
    const runner = this.effects[effect.kind];
    if (effect.applyAt === 'start') {
      finish();
      runner.start(effect);
      return;
    }
    this.state = 'working';
    farm.animate(job.index, effect.kind, effect.duration);
    runner.start(effect, () => {
      finish();
      if (effect.then) this.effects[effect.then.kind]?.start(effect.then);
    });
  }

  enqueue(queue, serve) {
    this.queue = queue;
    this.serve = serve;
    queue.join(this);
    this.followQueue();
  }

  leaveQueue() {
    if (!this.queue) return;
    this.queue.leave(this);
    this.queue = null;
    this.queueIndex = -1;
    this.serve = null;
  }

  followQueue() {
    const index = this.queue?.indexOf(this) ?? -1;
    if (index < 0) {
      this.leaveQueue();
      this.wait(0.5);
      return;
    }
    this.queueIndex = index;
    const spot = this.queue.slot(index);
    this.travel(spot, {
      then: () => {
        this.queueTries = 0;
        this.queued();
      },
      fail: () => {
        this.queueTries = (this.queueTries ?? 0) + 1;
        if (this.queueTries > 3) {
          this.queueTries = 0;
          this.finishService();
          return;
        }
        this.wait(between(0.6, 1.4), () => this.followQueue());
      },
    });
  }

  queued() {
    const index = this.queue?.indexOf(this) ?? -1;
    if (index < 0) {
      this.leaveQueue();
      this.wait(0.5);
      return;
    }
    if (index !== this.queueIndex) {
      this.followQueue();
      return;
    }
    if (index === 0) {
      this.facing = this.queue.facingAt(0);
      this.lookAt = this.queue.look;
      const serve = this.serve;
      this.serve = null;
      this.state = 'idle';
      this.timer = 0;
      serve?.();
      return;
    }
    this.state = 'queued';
  }

  finishService() {
    this.leaveQueue();
    this.fishing = null;
    this.task = null;
    this.think();
  }

  goShop() {
    this.cancel();
    this.task = 'shop';
    this.enqueue(this.town.queues.shop, () => this.trade());
  }

  trade() {
    if (!this.town.context.shopOpen) {
      this.say('Tiệm đóng cửa mất rồi!');
      this.wait(1.5, () => this.finishService());
      return;
    }
    const lines = this.town.market.trade(this);
    if (lines.length) this.say(lines.join(' · '), 2.6);
    this.wait(between(1.5, 3), () => this.finishService());
  }

  goChief() {
    this.cancel();
    this.task = 'chief';
    this.enqueue(this.town.queues.chief, () => this.visitChief());
  }

  visitChief() {
    const house = this.town.context.chiefOpen ? this.town.estate.buyFor(this.id, this.purse, VILLAGER.houseReserve) : null;
    this.say(house ? `🏠 Mua được nhà số ${house.id} rồi!` : this.town.context.chiefOpen ? 'Chưa đủ tiền mua nhà...' : 'Lý trưởng nghỉ mất rồi!', 2.6);
    this.wait(between(1.5, 3), () => this.finishService());
  }

  turnTo(angle, rate, dt) {
    const diff = wrap(angle - this.facing);
    const max = rate * dt;
    this.facing += clamp(diff, -max, max);
    return diff;
  }

  remainingDistance() {
    let d = 0;
    let x = this.position.x;
    let z = this.position.z;
    for (let i = this.seg + 1; i < this.route.length; i++) {
      d += Math.hypot(this.route[i].x - x, this.route[i].z - z);
      x = this.route[i].x;
      z = this.route[i].z;
    }
    return d;
  }

  lookAhead(distance) {
    let left = distance;
    let x = this.position.x;
    let z = this.position.z;
    for (let i = this.seg + 1; i < this.route.length; i++) {
      const dx = this.route[i].x - x;
      const dz = this.route[i].z - z;
      const len = Math.hypot(dx, dz);
      if (len >= left) return { x: x + (dx / len) * left, z: z + (dz / len) * left };
      left -= len;
      x = this.route[i].x;
      z = this.route[i].z;
    }
    return this.route[this.route.length - 1];
  }

  arrive() {
    this.route = null;
    this.velocity = 0;
    const then = this.onRouteEnd;
    this.onRouteEnd = null;
    this.onRouteFail = null;
    this.state = 'idle';
    this.timer = 0;
    this.afterWait = null;
    if (then) then();
    else this.wait(0.5);
  }

  steer(t, dt) {
    const pos = this.position;
    const route = this.route;
    while (this.seg < route.length - 1) {
      const a = route[this.seg];
      const b = route[this.seg + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      const proj = len2 > 1e-6 ? ((pos.x - a.x) * abx + (pos.z - a.z) * abz) / len2 : 1;
      if (proj >= 1 || Math.hypot(b.x - pos.x, b.z - pos.z) < 0.3) this.seg++;
      else break;
    }

    const remaining = this.remainingDistance();
    this.routeTime += dt;
    if (remaining < 0.1 || (remaining < 0.35 && this.velocity < 0.2)) {
      this.arrive();
      return;
    }
    if (this.routeTime > this.routeBudget) {
      this.giveUp();
      return;
    }
    if (this.pauseTimer <= 0) {
      if (remaining < this.bestRemaining - 0.04) {
        this.bestRemaining = remaining;
        this.stuckTime = 0;
      } else {
        this.stuckTime += dt;
      }
    }
    if (this.stuckTime > STUCK_TIME) {
      this.unstick();
      return;
    }

    const target = this.lookAhead(LOOKAHEAD);
    const running = this.cruise > this.walkSpeed * 1.6;
    const rate = this.turnRate * (running ? 1.3 : 1) * (remaining < 0.8 ? 3 : 1);
    const heading = Math.atan2(target.x - pos.x, target.z - pos.z) + this.town.avoidance(this, remaining);
    const err = this.turnTo(heading, rate, dt);

    if (this.activity === 'wander' && this.pauseTimer <= 0 && Math.random() < dt * 0.12) this.pauseTimer = between(0.6, 1.8);
    let wanted = this.cruise * (1 + 0.12 * Math.sin(t * this.wobbleF + this.wobbleP));
    wanted *= Math.max(0.3, Math.cos(err));
    wanted = Math.min(wanted, Math.sqrt(2 * this.decel * Math.max(0, remaining - 0.05)) + 0.15);
    if (this.pauseTimer > 0) {
      wanted = 0;
      if (this.velocity < 0.05) this.pauseTimer -= dt;
    }
    const accel = wanted > this.velocity ? this.accel : this.decel;
    this.velocity += clamp(wanted - this.velocity, -accel * dt, accel * dt);

    const travel = this.velocity * dt;
    if (travel <= 1e-5) return;
    const next = route[Math.min(this.seg + 1, route.length - 1)];
    const side = wrap(Math.atan2(next.x - pos.x, next.z - pos.z) - this.facing) >= 0 ? 1 : -1;
    const probe = Math.min(Math.max(travel, 0.18), Math.max(travel, remaining));
    for (const spread of FEELERS) {
      for (const sign of spread ? [side, -side] : [1]) {
        const angle = this.facing + spread * sign;
        const sx = Math.sin(angle);
        const sz = Math.cos(angle);
        if (!canMove(this.town.nav, pos.y, pos.x + sx * probe, pos.z + sz * probe)) continue;
        const step = spread ? travel * Math.cos(spread) : travel;
        pos.x += sx * step;
        pos.z += sz * step;
        if (spread) this.turnTo(angle, rate, dt);
        return;
      }
    }
    this.velocity *= 0.5;
  }

  step(dt, to, done) {
    const before = this.position.clone();
    this.timer += dt;
    const k = Math.min(1, this.timer / this.stepTime);
    this.position.lerpVectors(this.from, to, k * k * (3 - 2 * k));
    this.velocity = before.distanceTo(this.position) / Math.max(dt, 1e-4);
    this.turnTo(Math.PI, 8, dt);
    if (k >= 1) {
      this.velocity = 0;
      done();
    }
  }

  slowDown(dt) {
    this.velocity = Math.max(0, this.velocity - this.decel * dt);
    if (this.velocity <= 0) return;
    const nx = this.position.x + Math.sin(this.facing) * this.velocity * dt;
    const nz = this.position.z + Math.cos(this.facing) * this.velocity * dt;
    if (!canMove(this.town.nav, this.position.y, nx, nz)) {
      this.velocity = 0;
      return;
    }
    this.position.x = nx;
    this.position.z = nz;
  }

  idleUpdate(dt) {
    this.slowDown(dt);
    this.timer -= dt;
    const focus = this.lookAt ?? this.town.nearestRoaming(this, 2.2)?.position;
    if (focus) this.turnTo(Math.atan2(focus.x - this.position.x, focus.z - this.position.z), 4, dt);
    if (this.activity === 'chat' && this.recess) {
      this.nextLine -= dt;
      if (this.nextLine <= 0) {
        this.say(pick(CHAT), 2.2);
        this.nextLine = between(3.5, 7) / this.chatty;
      }
    }
    if (this.timer > 0) return;
    const next = this.afterWait;
    this.afterWait = null;
    if (next) next();
    else this.think();
  }

  heedUpdate(dt) {
    this.slowDown(dt);
    this.turnTo(Math.atan2(CLASSROOM.x - this.position.x, CLASSROOM.z - this.position.z), 3, dt);
    this.timer -= dt;
    if (this.timer <= 0) this.headBack();
  }

  seatedUpdate(t) {
    const s = this.seated;
    if (this.payAt !== null && t >= this.payAt) this.pay();
    this.seatBubble.update(t);
    const phase = this.town.context.phase;
    const learning = this.studying && phase.kind === 'period';
    this.studyIcon.visible = learning;
    if (!this.near) return;
    if (learning && this.writing) {
      s.head.rotation.x = 0.3 + Math.sin(t * 1.3 + this.seatPhase) * 0.04;
      s.rightArm.rotation.x = -(0.03 + (Math.sin(t * 6 + this.seatPhase) * 0.5 + 0.5) * 0.06);
      s.rightArm.rotation.y = Math.sin(t * 3 + this.seatPhase) * 0.06;
      s.face.update(t, 'open');
      return;
    }
    s.rightArm.rotation.x = 0;
    s.head.rotation.x = -0.05 + Math.sin(t * 2.4 + this.seatPhase) * 0.08;
    s.head.rotation.y = Math.sin(t * 0.5 + this.seatPhase) * (learning ? 0.12 : 0.4);
    s.face.update(t, !learning && Math.sin(t * 9 + this.seatPhase) > 0.1 ? 'talk' : 'open');
  }

  update(t, dt) {
    this.now = t;
    this.bubble.update(t);
    if (this.studyIcon && this.state !== 'seated') this.studyIcon.visible = false;
    switch (this.state) {
      case 'away':
        if (this.wakeAt !== null && t >= this.wakeAt) {
          this.wakeAt = null;
          this.appear();
        }
        return;
      case 'inn':
        if (this.purse.energy >= ENERGY.max - 0.5) this.leaveInn();
        return;
      case 'teaching':
        return;
      case 'seated':
        this.seatedUpdate(t);
        return;
      case 'rising':
        this.timer -= dt;
        if (this.timer > 0) return;
        this.standUp(this.afterLeave);
        break;
      case 'leaving':
        this.step(dt, this.seatRef.spot, () => {
          const after = this.afterLeave;
          this.afterLeave = null;
          this.state = 'idle';
          this.timer = 0;
          if (after) after();
          else this.think();
        });
        break;
      case 'sitting':
        this.step(dt, this.seatRef.sit, () => this.sitDown());
        break;
      case 'walking':
        this.steer(t, dt);
        break;
      case 'idle':
        this.idleUpdate(dt);
        break;
      case 'resting':
        this.restUpdate(dt);
        break;
      case 'heeding':
        this.heedUpdate(dt);
        break;
      case 'working':
        this.slowDown(dt);
        break;
      case 'fishing': {
        this.slowDown(dt);
        const session = this.fishing;
        if (!session) {
          this.wait(0.5);
          break;
        }
        this.turnTo(session.spot.facing, 4, dt);
        if (!session.done && t >= session.biteAt) this.fishBite();
        else if (session.reelAt != null && t >= session.reelAt) this.resolveBite();
        else if (session.nextCastAt != null && t >= session.nextCastAt) this.nextTurn();
        break;
      }
      case 'queued':
        this.slowDown(dt);
        if (this.fishing && !this.town.river.hasFish(this.fishing.spot)) {
          this.endFishing();
          break;
        }
        if (!this.queue || this.queue.indexOf(this) !== this.queueIndex) this.queued();
        else {
          const slot = this.queue.slot(this.queueIndex);
          if (Math.hypot(slot.x - this.position.x, slot.z - this.position.z) > QUEUE_DRIFT) this.followQueue();
          else this.turnTo(this.queue.facingAt(this.queueIndex), 4, dt);
        }
        break;
    }
    if (this.state !== 'seated' && this.state !== 'away') this.animate(t, dt);
    if (this.fx) for (const effect of Object.values(this.fx)) effect.update(dt, this.walker.group.visible);
  }

  animate(t, dt) {
    const pos = this.position;
    const ground = this.town.nav.heightAt(pos.x, pos.z);
    if (ground !== null && this.roaming) pos.y += (ground - pos.y) * (1 - Math.exp(-14 * dt));
    if (this.state !== 'resting') this.restBlend = 0;
    if (!this.near) return;
    const w = this.walker;
    const g = this.gait.update(w, this.velocity, dt, true);
    if (this.restBlend > 0) {
      this.restClock += dt;
      layDown(w, pos, this.facing, restEase(this.restBlend), this.restClock);
      w.group.scale.setScalar(1);
      w.face.update(t, this.bubble.visible && Math.sin(t * 11) > 0 ? 'talk' : 'open');
      this.shadow.place(pos.x, pos.y, pos.z, 0);
      return;
    }
    if (this.bubble.visible && this.state === 'idle') w.rightArm.rotation.x = -0.6 - Math.sin(t * 6) * 0.25;
    const curious = (this.state === 'idle' && !this.lookAt) || this.pauseTimer > 0;
    const headTarget = curious ? Math.sin(t * 0.9 + this.wobbleP) * 0.55 : 0;
    w.head.rotation.y += (headTarget - w.head.rotation.y) * (1 - Math.exp(-4 * dt));
    const hop = this.velocity > 2.5 ? Math.abs(Math.sin(g.phase)) * 0.08 * Math.min(1, (this.velocity - 2.5) / 0.8) : 0;
    w.group.position.set(pos.x, pos.y + g.bob + hop, pos.z);
    w.group.rotation.set(g.lean, this.facing, 0);
    if (this.pop > 0) this.pop = Math.max(0, this.pop - dt);
    w.group.scale.setScalar(this.pop > 0 ? 1 + Math.sin((1 - this.pop / 0.25) * Math.PI) * 0.08 : 1);
    w.face.update(t, this.bubble.visible && Math.sin(t * 11) > 0 ? 'talk' : 'open');
    this.shadow.place(pos.x, pos.y, pos.z, hop);
    if (g.step && this.roaming) this.town.footprints?.step(pos.x, pos.y, pos.z, this.facing, g.step.side);
  }
}

class Teacher extends Villager {
  onDuty(ctx) {
    return !ctx.night && ctx.minute >= ROUTINE.teacherArrive && ctx.minute < ROUTINE.teacherLeave;
  }

  think() {
    const ctx = this.town.context;
    this.task = null;
    if (!this.onDuty(ctx)) return this.goHome();
    this.task = 'teach';
    this.travel(TEACHER_STAND, { then: () => this.beginTeaching(), fail: () => this.beginTeaching() });
  }

  beginTeaching() {
    this.task = 'teach';
    this.route = null;
    this.velocity = 0;
    this.position.set(TEACHER_STAND.x, FLOOR, TEACHER_STAND.z);
    this.setVisible(false);
    this.state = 'teaching';
    this.town.school.setTeacherPresent(true);
  }

  stopTeaching() {
    this.town.school.setTeacherPresent(false);
    this.position.set(TEACHER_STAND.x, FLOOR, TEACHER_STAND.z);
    this.facing = 0;
    this.setVisible(true);
    this.pop = 0.25;
    this.state = 'idle';
    this.goHome();
  }

  greet() {
    this.say('Chào con! Lên bục gặp thầy để đóng trước tiền học nhé.', 3);
  }
}

export class Town {
  constructor({ root, nav, seats, school, farm, ledger, market, estate, places, river, footprints = null }) {
    this.root = root;
    this.nav = nav;
    this.seats = seats;
    this.school = school;
    this.farm = farm;
    this.ledger = ledger;
    this.market = market;
    this.estate = estate;
    this.places = places;
    this.river = river;
    this.queues = {
      shop: new ServiceQueue(places.shop.line, places.shop.look),
      chief: new ServiceQueue(places.chief.line, places.chief.look),
      eatery: new ServiceQueue(places.eatery.line, places.eatery.look),
    };
    for (const queue of Object.values(this.queues)) queue.snap = (point) => this.walkable(point);
    for (const spot of river.spots) spot.queue.snap = (point) => this.walkable(point);
    this.footprints = footprints;
    this.context = null;
    this.hangouts = HANGOUTS.map((spot) => ({ ...spot, slots: new Array(4).fill(null) }));
    this.members = villagerProfiles().map((profile) => new Villager(profile, this));
    this.teacher = new Teacher(TEACHER, this);
    this.all = [...this.members, this.teacher];
    this.budget = PATHS_PER_FRAME;
    this.frustum = new THREE.Frustum();
    this.viewProjection = new THREE.Matrix4();
    this.probe = new THREE.Sphere(new THREE.Vector3(), 1.4);
    this.lastPhaseKey = null;
    this.lastNight = null;
    this.reviewAt = 0;
    this.started = false;
  }

  walkable(point) {
    if (this.nav.heightAt(point.x, point.z) !== null) return point;
    const cell = this.nav.nearest(point.x, point.z, 3);
    if (cell < 0) return point;
    const center = this.nav.center(cell);
    return { x: center.x, z: center.z };
  }

  nameOf(id) {
    return this.all.find((member) => member.id === id)?.name ?? 'người khác';
  }

  villagerAt(object) {
    return this.all.find((member) => member.owns(object)) ?? null;
  }

  get clickables() {
    const list = [];
    for (const member of this.all) {
      if (member.walker.group.visible) list.push(member.walker.group);
      if (member.seated?.group.visible) list.push(member.seated.group);
    }
    return list;
  }

  path(from, to) {
    if (this.budget <= 0) return undefined;
    this.budget -= 1;
    return this.nav.findPath(from, to);
  }

  homeOf(member) {
    const house = this.estate.houseOf(member.id);
    if (house) return this.places.doors.get(house.id);
    return this.places.exits[member.profile.exit ?? 0];
  }

  spareSeat(member) {
    const homes = new Set();
    for (const other of this.members) if (other !== member && other.homeSeat) homes.add(other.homeSeat);
    return this.seats.nearestFree(member.position, member, (seat) => !homes.has(seat)) ?? this.seats.nearestFree(member.position, member);
  }

  displaced(member, seat) {
    if (member instanceof Villager && member.targetSeat === seat && member.state === 'walking') member.retargetSeat();
  }

  yardPoint() {
    const [x0, z0, x1, z1] = pick(YARD);
    return new THREE.Vector3(between(x0, x1), 0, between(z0, z1));
  }

  strollPoint() {
    const [x0, z0, x1, z1] = pick(Math.random() < 0.5 ? YARD : STREET);
    return new THREE.Vector3(between(x0, x1), 0, between(z0, z1));
  }

  fieldEdgePoint() {
    const [x0, z0, x1, z1] = pick(FIELD_EDGES);
    return new THREE.Vector3(between(x0, x1), 0, between(z0, z1));
  }

  companion(member, radius) {
    let best = null;
    let bestD = radius;
    for (const other of this.members) {
      if (other === member || !other.present || other.inSchool) continue;
      if (other.task !== 'leisure' && other.task !== 'farm') continue;
      const d = other.position.distanceTo(member.position);
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    return best;
  }

  fieldPoint() {
    const index = Math.floor(Math.random() * 200);
    const spot = this.farm.spot(index);
    return spot ? this.farm.standFor(index, { x: spot.x - 2, z: spot.z }) : { x: 0.5, z: 40 };
  }

  reserveSlot(member) {
    const options = [];
    for (const spot of this.hangouts) {
      const free = spot.slots.indexOf(null);
      if (free < 0) continue;
      options.push({ spot, free, weight: 1 + spot.slots.filter(Boolean).length * 2 });
    }
    if (!options.length) return null;
    let r = Math.random() * options.reduce((sum, o) => sum + o.weight, 0);
    const choice = options.find((o) => (r -= o.weight) <= 0) ?? options[options.length - 1];
    choice.spot.slots[choice.free] = member;
    member.slot = { spot: choice.spot, index: choice.free };
    const a = (choice.free / 4) * Math.PI * 2 + 0.4;
    return {
      position: new THREE.Vector3(choice.spot.x + Math.cos(a) * 0.85, 0, choice.spot.z + Math.sin(a) * 0.85),
      center: new THREE.Vector3(choice.spot.x, 0, choice.spot.z),
    };
  }

  releaseSlot(member) {
    if (!member.slot) return;
    member.slot.spot.slots[member.slot.index] = null;
    member.slot = null;
  }

  nearestRoaming(member, radius) {
    let best = null;
    let bestD = radius;
    for (const other of this.members) {
      if (other === member || !other.visible) continue;
      const d = other.position.distanceTo(member.position);
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    return best;
  }

  steerAround(position, facing, remaining, self, { range = AVOID_RANGE, gain = 0.9, includePlayer = true } = {}) {
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    let turn = 0;
    const consider = (pos) => {
      const dx = pos.x - position.x;
      const dz = pos.z - position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-3 || d > range || d > remaining) return;
      const ahead = (dx * fx + dz * fz) / d;
      if (ahead < 0.35) return;
      const side = dx * fz - dz * fx;
      const strength = (1 - d / range) * ahead;
      turn += (side >= 0 ? -1 : 1) * strength * gain;
    };
    for (const other of this.all) {
      if (other !== self && other.visible) consider(other.position);
    }
    if (includePlayer && this.player && this.player.posture === 'free') consider(this.player.position);
    return clamp(turn, -1.1, 1.1);
  }

  avoidance(member, remaining) {
    if (remaining < 0.6) return 0;
    return this.steerAround(member.position, member.facing, remaining, member);
  }

  playerAvoidance(position, dirX, dirZ, remaining) {
    if (remaining < 0.5) return 0;
    return this.steerAround(position, Math.atan2(dirX, dirZ), remaining, null, { range: 1.5, gain: 1.2, includePlayer: false });
  }

  separate(player) {
    const bodies = this.all.filter((member) => member.visible);
    const playerFree = player && player.posture === 'free';
    const count = bodies.length + (playerFree ? 1 : 0);
    const posOf = (i) => (i < bodies.length ? bodies[i].position : player.position);
    const playerMoving = playerFree && (!!player.path || Math.hypot(player.velocity.x, player.velocity.z) > 0.25);
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const a = posOf(i);
        const b = posOf(j);
        if (Math.abs(a.y - b.y) > 1.2) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= SPACING) continue;
        const nx = d < 1e-3 ? 1 : dx / d;
        const nz = d < 1e-3 ? 0 : dz / d;
        if (j >= bodies.length) {
          const villager = bodies[i];
          const full = SPACING - d;
          if (playerMoving || villager.state !== 'walking') this.nudge(player, nx * full, nz * full);
          else this.nudge(villager, -nx * full, -nz * full);
          continue;
        }
        const first = bodies[i];
        const second = bodies[j];
        const firstStill = first.state !== 'walking';
        const secondStill = second.state !== 'walking';
        const full = SPACING - d;
        if (firstStill && !secondStill) {
          this.nudge(second, nx * full, nz * full);
          continue;
        }
        if (secondStill && !firstStill) {
          this.nudge(first, -nx * full, -nz * full);
          continue;
        }
        const push = full / 2;
        this.nudge(first, -nx * push, -nz * push);
        this.nudge(second, nx * push, nz * push);
      }
    }
  }

  nudge(body, dx, dz) {
    if (body instanceof Villager) {
      const x = body.position.x + dx;
      const z = body.position.z + dz;
      if (!canMove(this.nav, body.position.y, x, z)) return;
      body.position.x = x;
      body.position.z = z;
      return;
    }
    const p = body.position;
    const next = { x: p.x + dx, y: p.y, z: p.z + dz };
    if (body.collides(next)) return;
    p.x = next.x;
    p.z = next.z;
  }

  restore(ctx) {
    this.context = ctx;
    this.started = true;
    this.lastNight = ctx.night;
    this.lastPhaseKey = ctx.phase.key;
    if (this.teacher.onDuty(ctx)) this.teacher.beginTeaching();
    else this.teacher.vanish();
    for (const member of this.members) {
      if (ctx.night) {
        member.vanish();
        continue;
      }
      const inSchool = ctx.phase.kind !== 'free' && member.attendsToday(ctx.day);
      if (inSchool) {
        const seat = this.spareSeat(member);
        if (seat) {
          member.seatDirect(seat);
          if (ctx.phase.kind === 'period') member.pay();
          if (ctx.phase.kind === 'recess') member.startRecess();
          continue;
        }
      }
      const spot = this.fieldPoint();
      const height = this.nav.heightAt(spot.x, spot.z);
      if (height === null) {
        member.vanish();
        member.wakeAt = between(0.5, 6);
        continue;
      }
      member.position.set(spot.x, height, spot.z);
      member.setVisible(true);
      member.wait(between(0.2, 3));
    }
  }

  transition(ctx, previous) {
    const phase = ctx.phase;
    if (previous?.kind === 'period') for (const member of this.members) member.periodEnd();
    if (phase.kind === 'period') {
      for (const member of this.members) {
        if (member.recess) member.endRecess(true);
        member.periodStart(ctx);
      }
      return;
    }
    if (phase.kind === 'recess') {
      for (const member of this.members) member.startRecess();
      return;
    }
    if (phase.kind === 'free') {
      for (const member of this.members) {
        if (member.inSchool) member.leaveSchool();
      }
    }
  }

  review(ctx) {
    for (const member of this.members) {
      if (member.state === 'away' || member.inSchool) continue;
      if (member.task === 'home') continue;
      if ((member.task === 'fish' || member.task === 'hunt') && member.shouldAttend(ctx)) {
        member.goToClass();
        continue;
      }
      if (member.state !== 'walking' && member.state !== 'idle') continue;
      if (member.task === 'shop' || member.task === 'chief' || member.task === 'eat' || member.task === 'inn') continue;
      if (member.shouldAttend(ctx)) member.goToClass();
    }
    const teacher = this.teacher;
    if (teacher.state === 'teaching' && !teacher.onDuty(ctx)) teacher.stopTeaching();
    else if (teacher.state === 'away' && teacher.onDuty(ctx) && teacher.wakeAt === null) teacher.wakeAt = teacher.now + between(0.5, 3);
  }

  updateLod(camera) {
    this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const member of this.all) {
      const d = camera.position.distanceTo(member.position);
      this.probe.center.set(member.position.x, member.position.y + 0.9, member.position.z);
      const near = d < VISIBLE_DISTANCE && (d <= 10 || this.frustum.intersectsSphere(this.probe));
      if (near === member.near) continue;
      member.near = near;
      member.applyLod();
    }
  }

  update(t, dt, ctx, player, camera) {
    this.budget = PATHS_PER_FRAME;
    this.player = player;
    const previous = this.context?.phase;
    this.context = ctx;
    if (!this.started) this.restore(ctx);
    if (ctx.night !== this.lastNight) {
      this.lastNight = ctx.night;
      if (ctx.night) {
        for (const member of this.all) {
          if (member.state === 'away' || member.state === 'inn') continue;
          if (member === this.teacher && member.state === 'teaching') {
            member.stopTeaching();
            continue;
          }
          if (member.state === 'seated') member.rise(() => member.goHome(), between(0.2, 2));
          else if (member.state !== 'rising' && member.state !== 'leaving' && member.state !== 'sitting' && member.state !== 'resting') member.goHome();
        }
      } else {
        for (const member of this.members) {
          if (member.state === 'away') member.wakeAt = t + between(0.5, 40);
        }
      }
    }
    if (ctx.phase.key !== this.lastPhaseKey) {
      this.lastPhaseKey = ctx.phase.key;
      this.transition(ctx, previous);
    }
    if (t >= this.reviewAt) {
      this.reviewAt = t + 1;
      this.review(ctx);
    }
    for (const member of this.all) member.tickEnergy(ctx);
    this.updateLod(camera);
    const breakLeft = ctx.phase.kind === 'recess' ? realSeconds(ctx.phase.remaining) : Infinity;
    for (const member of this.all) {
      if (breakLeft !== Infinity && member.dueBack(breakLeft)) member.endRecess();
      if (!member.near) {
        member.skipDt += dt;
        if (++member.skipCount < SKIP_FRAMES) continue;
        member.update(t, Math.min(member.skipDt, 0.15));
        member.skipDt = 0;
        member.skipCount = 0;
        continue;
      }
      member.skipDt = 0;
      member.skipCount = 0;
      member.update(t, dt);
    }
    this.separate(player);
    blinkStudyIcons(t);
  }
}
