import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelWorld } from './world.js';
import { buildWorld, populate, stairHeight, CX, TEACHER_STAND, TEACHER_Z } from './school.js';
import { createScenery } from './scenery.js';
import { createPlayer, createSeatedPlayer } from './characters.js';
import { loadCharacterModels, hasModel, createModel, setCharacterShadows } from './characterModels.js';
import { createRooms, inStudyRoom } from './rooms.js';
import { Seats } from './seats.js';
import { createLesson } from './lesson.js';
import { PlayerController, WALK_SPEED, RUN_SPEED } from './walk.js';
import { NavGrid } from './nav.js';
import { createSky, createClouds } from './sky.js';
import { Footprints, createBlobShadow } from './groundfx.js';
import { RegionManager } from './regions.js';
import { createPicker } from './picker.js';
import { createWatering } from './watering.js';
import { createHarvesting } from './harvesting.js';
import { createClearing } from './clearing.js';
import { createQuiz } from './quiz.js';
import { createFarm, FARM_X } from './farm.js';
import { createFireflies, createFireflyLamp } from './fireflies.js';
import { createRoad, SPAWN } from './road.js';
import { createStreetLamps } from './streetLamps.js';
import { createBubble, updateBubbles, setBubbleOcclusion } from './bubble.js';
import { Ledger, PLAYER } from './inventory.js';
import { createBag } from './bag.js';
import { createMailbox } from './mailbox.js';
import { createAtms, createAtmUI } from './atm.js';
import { LOW_POWER } from './quality.js';
import { freeze } from './toon.js';
import { gameNow, dayOf, minuteOfDay } from './clock.js';
import { phaseAt } from './timetable.js';
import { ROUTINE, ENERGY, WORLD, HUNTING, VENDOR, FIREFLY, QUIZ } from './config.js';
import { createMarket, createShopUI, createFishShopUI, createMartUI, shopOpen, shopHours, fishShopOpen, fishShopHours, martOpen, martHours } from './market.js';
import { createEstate, createChiefUI, chiefOpen, chiefHours } from './estate.js';
import { createTuition } from './tuition.js';
import { Town } from './villagers.js';
import { createStudyIcon } from './studyIcon.js';
import { villagerProfiles } from './villagerData.js';
import { createVillage } from './village.js';
import { createQuarter } from './quarter.js';
import { createFieldMart } from './fieldMart.js';
import { createMountain } from './mountain.js';
import { createCountryside } from './countryside.js';
import { createDistrict } from './district.js';
import { book, leaveRoom } from './lodging.js';
import { MOUNTAIN, terrainHeight, terrainFloor, navSurface, nearShelter } from './terrain.js';
import { createNoticeBoard } from './notice.js';
import { createSettings, wipeGame } from './settings.js';
import { createFullscreenToggle } from './fullscreen.js';
import { createRiver } from './river.js';
import { createAngler } from './angler.js';
import { createKanjiQuiz } from './kanjiQuiz.js';
import { createPlayerFishing } from './fishing.js';
import { createVitals } from './vitals.js';
import { paintPortrait } from './portrait.js';
import { buildStudyHall, createStudyHall } from './studyHall.js';
import { createInn, INN_STAND, INN_DOOR } from './inn.js';
import { createStudy } from './study.js';
import { createSummon } from './summon.js';
import { activityOf, moodOf } from './stamina.js';
import { createFoodUI, eateryOpen, eateryHours } from './eatery.js';
import { createBank, createBankUI, bankOpen, bankHours } from './bank.js';
import { createRanking } from './ranking.js';
import { economy, SHOPKEEPERS } from './economy.js';
import { loadingStep, loadingDone } from './loading.js';
import { createRegen } from './regen.js';
import { loadItemImages } from './itemArt.js';
import { JOIN_RADIUS } from './queue.js';
import { redrawCanvases } from './canvasRestore.js';
import { createLodgeDesk } from './lodgeDesk.js';
import { createScheduleBoard } from './scheduleBoard.js';
import { createHoverTip } from './hoverTip.js';
import { createRenderTuning, MAX_PIXEL_RATIO } from './renderTuning.js';
import { coins } from './format.js';
import { haltStores } from './persist.js';

const FRAME_RATE = LOW_POWER ? 30 : 60;
const IDLE_FRAME_RATE = 10;
const READING_FRAME_RATE = 10;
const POPUP_FRAME_RATE = 10;
const BAG_FRAME_RATE = Math.min(FRAME_RATE, 30);
const SCENE_POPUP_FRAME_RATE = Math.min(FRAME_RATE, 30);
const WATCHING_FRAME_RATE = Math.min(FRAME_RATE, 30);
const SLEEP_FRAME_RATE = 2;
const MAX_STEP = 0.12;
const SIM_SPAN = 0.6;
const IDLE_AFTER = 20000;
const SHADOW_SPAN = LOW_POWER ? 30 : 45;
const NAV_BOUNDS = { x0: WORLD.x0, x1: WORLD.x1, z0: MOUNTAIN.z0, z1: 84 };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(MAX_PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOW_POWER ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
document.getElementById('app').appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextrestored', () => {
  redrawCanvases();
  tuning.invalidateShadows();
});

const scene = new THREE.Scene();
const sky = createSky(scene, { renderer });
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 500);

const sun = sky.light;
const shadowSize = LOW_POWER ? 1024 : renderer.capabilities.maxTextureSize >= 8192 ? 4096 : 2048;
sun.shadow.mapSize.set(shadowSize, shadowSize);
Object.assign(sun.shadow.camera, { left: -SHADOW_SPAN, right: SHADOW_SPAN, top: SHADOW_SPAN, bottom: -SHADOW_SPAN, near: 1, far: 140 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
const tuning = createRenderTuning({ renderer, scene, camera, sun, frameRate: FRAME_RATE });

const itemImages = loadItemImages();
await loadingStep(0.4, 'Dựng trường làng');
const world = new VoxelWorld();
const layout = buildWorld(world);
buildStudyHall(world);
const scenery = createScenery(scene, layout);
const roof = scenery.roof;

for (const child of scene.children) {
  if (child.isMesh || child === roof) freeze(child);
}

await loadingStep(0.52, 'Dựng nhà, khơi sông');
await loadCharacterModels();
const school = populate(scene);
const clouds = createClouds(scene);
const notice = createNoticeBoard(scene);
const atms = createAtms(scene, terrainFloor);
const village = createVillage();
scene.add(village.lights);
const streetLamps = createStreetLamps();
scene.add(streetLamps.group);
const river = createRiver();
const studyHall = createStudyHall(scene);
const inn = createInn(scene);
const quarter = createQuarter();
const countryside = createCountryside();
const district = createDistrict();
school.obstacles.push(
  ...notice.obstacles,
  ...atms.obstacles,
  ...village.obstacles,
  ...river.obstacles,
  ...studyHall.obstacles,
  ...inn.obstacles,
  ...quarter.obstacles,
  ...countryside.obstacles,
  ...district.obstacles,
);

await loadingStep(0.62, 'Gieo mạ, mở chợ');
const modelReady = hasModel('player');
const avatar = modelReady ? createModel('player') : createPlayer();
scene.add(avatar.group);
const footprints = new Footprints(scene);
const player = new PlayerController({
  camera,
  domElement: renderer.domElement,
  world,
  obstacles: school.obstacles,
  avatar,
  footprints,
  shadow: createBlobShadow(scene, 0.34),
});
player.surfaceAt = (x, z) => stairHeight(x, z) ?? terrainFloor(x, z);
player.terrainAt = terrainHeight;

const ledger = new Ledger();
const purse = ledger.purse(PLAYER);
if (purse.sleeping && purse.lodging) book(purse.lodging, PLAYER);
createBag(purse);
const mailbox = createMailbox({ onTravel: travelTo });
createVitals(purse);
paintPortrait(renderer, modelReady ? createModel('player') : createPlayer(), document.getElementById('vitalsPortrait'));
const market = createMarket();
const shopUI = createShopUI({ market, purse });
const fishShopUI = createFishShopUI({ market, purse });
const martUI = createMartUI({ market, purse });
const estate = createEstate({ houses: [...village.houses, ...quarter.homes] });
let town = null;
const NAMES = new Map(villagerProfiles().map((profile) => [profile.id, profile.name]));
const nameOf = (id) => (id === PLAYER ? 'bạn' : NAMES.get(id) ?? 'người khác');
const chiefUI = createChiefUI({ estate, purse, nameOf });
const foodUI = createFoodUI({ purse });
const bank = createBank({ ledger, estate, now: gameNow });
const bankUI = createBankUI({ bank, purse });
const atmUI = createAtmUI({ bank, purse });
const VENUES = {
  shop: { isOpen: shopOpen, ui: shopUI },
  fish: { isOpen: fishShopOpen, ui: fishShopUI },
  chief: { isOpen: chiefOpen, ui: chiefUI },
  bank: { isOpen: bankOpen, ui: bankUI },
  eatery: { isOpen: eateryOpen, ui: foodUI },
};
bank.onCollect((owner, taken) => {
  if (owner === PLAYER) sayPlayer(`🏦 Ngân hàng trừ ${coins(taken)} nợ quá hạn`, 3);
});
bank.onMature((owner, term) => {
  if (owner !== PLAYER) return;
  const lines = [`Sổ ${term.days} ngày đã đáo hạn, ${coins(term.value)} (gốc + lãi) đã chuyển vào tài khoản không kỳ hạn.`];
  if (bank.overdue(PLAYER)) lines.push('Bạn đang có khoản vay quá hạn, số tiền này có thể bị trừ để trả nợ.');
  mailbox.notify({ icon: '🏦', title: 'Sổ tiết kiệm đáo hạn', lines, place: 'Ngân hàng · Xóm Bàn Cờ', point: district.bankDoor });
});

createFullscreenToggle();

createSettings({
  onReset() {
    renderer.setAnimationLoop(null);
    haltStores();
    wipeGame();
    window.location.reload();
  },
});

const regions = new RegionManager({ scene, obstacles: school.obstacles });
regions.add({
  id: 'school',
  name: 'Trường làng',
  bounds: { x0: -22, z0: -42, x1: 23, z1: 33 },
  pinned: true,
});
regions.add(createRoad());
const martOptions = { openMart: () => martUI.open(), isMartOpen: () => martOpen(gameNow()), martHours };
const fieldMart = createFieldMart(martOptions);
regions.add(
  quarter.region({
    ...martOptions,
    estate,
    nameOf,
    isNight: () => context.night,
    sleep: () => sleepAtHome(),
  }),
);
regions.add(fieldMart.region);
for (const region of countryside.regions()) regions.add(region);
regions.add(
  district.region({
    rentLodge: (id) => lodgeDesk.rent(id),
    bank,
    openBank: () => bankUI.open(),
    minutes: () => gameNow(),
  }),
);
const farm = createFarm({ ledger, nameOf, nav: () => player.nav });
regions.add(farm);
for (const region of farm.extraRegions) regions.add(region);
for (const region of village.regions({
    estate,
    nameOf,
    openShop: () => shopUI.open(),
    openFishShop: () => fishShopUI.open(),
    isFishShopOpen: () => fishShopOpen(gameNow()),
    fishShopHours,
    openChief: () => chiefUI.open(),
    openEatery: () => foodUI.open(),
    isEateryOpen: () => eateryOpen(gameNow()),
    eateryHours,
    isShopOpen: () => shopOpen(gameNow()),
    isChiefOpen: () => chiefOpen(gameNow()),
    shopHours,
    chiefHours,
    isNight: () => context.night,
    sleep: () => sleepAtHome(),
    rentLodge: (id) => lodgeDesk.rent(id),
  })) {
  regions.add(region);
}
regions.add(
  river.region({
    player,
    day: () => context.day,
    startFishing: (spot, berth) => fishing.start(spot, berth),
  }),
);
const PLACE_KEY = 'truong-lang-xua.player';
function loadPlace() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null');
    if (saved && [saved.x, saved.z, saved.yaw].every(Number.isFinite)) return saved;
  } catch {}
  return null;
}
const savedPlace = loadPlace();
regions.stream(savedPlace?.x ?? SPAWN.x, savedPlace?.z ?? SPAWN.z);

await loadingStep(0.72, 'Mở lối đi');
player.nav = new NavGrid(world, (p) => player.collides(p), NAV_BOUNDS, {
  surfaceAt: (x, z) => stairHeight(x, z) ?? navSurface(x, z),
  blocked: (p) => player.blocks(p),
});
regions.onLoad = (region) => {
  if (!region.staticNav) player.nav.bake(region.bounds);
};
regions.onUnload = (region) => {
  if (!region.staticNav) player.nav.bake(region.bounds);
};

const villagerRoot = new THREE.Group();
scene.add(villagerRoot);

const picker = createPicker();
const regionControls = [...document.querySelectorAll('[data-region]')];
const hoverTip = createHoverTip({ renderer, camera, regions, player, playing: () => mode === 'play', working: () => effectTask });
regions.onChange = (region) => {
  for (const control of regionControls) control.hidden = control.dataset.region !== region?.id;
  hoverTip.reset();
  picker.close();
};

const playerBubble = createBubble();
playerBubble.sprite.position.set(0, modelReady ? 2.12 : 1.95, 0);
avatar.group.add(playerBubble.sprite);
const sayPlayer = (text, seconds = 2.2) => playerBubble.show(text, seconds, clock.elapsedTime);
const coordsX = document.getElementById('coordsX');
const coordsY = document.getElementById('coordsY');
let coordsKey = '';
function showCoords() {
  const x = Math.round(player.position.x);
  const y = Math.round(player.position.z);
  const key = `${x},${y}`;
  if (key === coordsKey) return;
  coordsKey = key;
  coordsX.textContent = x;
  coordsY.textContent = y;
}
const VIEW_STEP = 0.4;

function segmentHitsBox(from, to, box) {
  let enter = 0;
  let exit = 1;
  for (const [a, b, min, max] of [
    [from.x, to.x, box.minX, box.maxX],
    [from.y, to.y, box.minY ?? 0, box.maxY ?? 3],
    [from.z, to.z, box.minZ, box.maxZ],
  ]) {
    const d = b - a;
    if (Math.abs(d) < 1e-9) {
      if (a < min || a > max) return false;
      continue;
    }
    let t0 = (min - a) / d;
    let t1 = (max - a) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    enter = Math.max(enter, t0);
    exit = Math.min(exit, t1);
    if (enter > exit) return false;
  }
  return true;
}

setBubbleOcclusion((from, to) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const steps = Math.ceil(Math.hypot(dx, dy, dz) / VIEW_STEP);
  for (let i = 1; i < steps; i++) {
    const k = i / steps;
    if (world.blocksView(Math.floor(from.x + dx * k), Math.floor(from.y + dy * k), Math.floor(from.z + dz * k), player.hiddenLayers)) return true;
  }
  for (const box of school.obstacles) {
    if (to.x >= box.minX && to.x <= box.maxX && to.z >= box.minZ && to.z <= box.maxZ) continue;
    if (from.x >= box.minX && from.x <= box.maxX && from.z >= box.minZ && from.z <= box.maxZ) continue;
    if (segmentHitsBox(from, to, box)) return true;
  }
  return false;
});
const BUBBLE_STAND = new THREE.Vector3(0, modelReady ? 2.12 : 1.95, 0);
const BUBBLE_LYING = new THREE.Vector3(0, 1.15, -1.1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
function placeBubble() {
  const k = player.restAmount;
  const anchor = playerBubble.sprite.position.lerpVectors(BUBBLE_STAND, BUBBLE_LYING, k);
  if (k > 0) anchor.applyAxisAngle(X_AXIS, -avatar.group.rotation.x);
}

const effects = {
  water: createWatering(scene, avatar),
  harvest: createHarvesting(scene, avatar),
  clear: createClearing(scene, avatar),
};
const regen = createRegen({ scene, camera, purse });
const busyEffect = () => Object.values(effects).find((effect) => effect.busy);
let effectTask = null;

let fieldTask = null;
const VENDOR_MENU = {
  title: 'Gánh hàng rong',
  icon: '🏮',
  foods: VENDOR.foods,
  seller: 'vendor',
  hungry: 'Cô hàng: "Ăn gì không em? Nóng hổi đây!"',
  full: 'Cô hàng: "Em còn no mà, lát đói gọi cô nghen!"',
};
let vendorVisit = false;
let servingVendor = false;

function visitVendor() {
  const vendor = town.vendor;
  vendor.hold();
  const dx = player.position.x - vendor.position.x;
  const dz = player.position.z - vendor.position.z;
  const gap = Math.hypot(dx, dz);
  if (gap <= VENDOR.reach) {
    vendorVisit = false;
    servingVendor = true;
    player.faceToward(vendor.position.x, vendor.position.z);
    vendor.say('Ăn gì không em?', 2);
    foodUI.open(VENDOR_MENU);
    return;
  }
  vendorVisit = true;
  const keep = VENDOR.chat / gap;
  player.requestMove(new THREE.Vector3(vendor.position.x + dx * keep, 0, vendor.position.z + dz * keep), false);
}

player.onArrive = () => {
  if (vendorVisit) {
    vendorVisit = false;
    visitVendor();
    return;
  }
  const task = fieldTask;
  fieldTask = null;
  if (!task || Math.hypot(task.target.stand.x - player.position.x, task.target.stand.z - player.position.z) > 0.8) return;
  player.faceToward(task.target.x, task.target.z);
  const cost = task.region.farmland ? ENERGY.costs[task.action.id] ?? 0 : 0;
  if (cost && purse.energy < cost) {
    sayPlayer('Đói quá, hết sức làm rồi! Ra quán ăn nạp năng lượng nhé.', 2.6);
    return;
  }
  const stand = { x: player.position.x, z: player.position.z };
  player.faceTarget(task.target, {
    work: true,
    then: () => {
      if (fieldTask || player.path || player.posture !== 'free' || Math.hypot(player.position.x - stand.x, player.position.z - stand.z) > 0.3) return;
      perform(task, cost);
    },
  });
};

function stopWork() {
  fieldTask = null;
  vendorVisit = false;
  fishing.stop();
  busyEffect()?.cancel();
  if (effectTask) effectTask.region.animate?.(effectTask.target, null);
  effectTask = null;
}

function perform(task, cost) {
  const finish = () => {
    const reply = task.region.act(task.action.id, task.target, task.choice);
    if (reply) sayPlayer(reply, 1.8);
    if (cost && task.region.didChange?.()) purse.spendEnergy(cost);
  };
  const settings = task.action.effect;
  const effect = settings && effects[settings.kind];
  if (!effect) {
    finish();
    return;
  }
  if (settings.applyAt === 'start') {
    finish();
    effect.start(settings);
    return;
  }
  effectTask = task;
  task.region.animate?.(task.target, settings.kind, settings.duration);
  effect.start(settings, () => {
    effectTask = null;
    finish();
    if (settings.then) effects[settings.then.kind]?.start(settings.then);
  });
}
const savedY = savedPlace ? player.nav.heightAt(savedPlace.x, savedPlace.z) : null;
const savedClear = savedY !== null && !player.collides({ x: savedPlace.x, y: savedY, z: savedPlace.z });
if (savedClear) {
  player.place(new THREE.Vector3(savedPlace.x, savedY, savedPlace.z), savedPlace.yaw);
  if (Number.isFinite(savedPlace.facing)) player.facing = savedPlace.facing;
  if (savedPlace.resting) player.restoreRest();
} else player.place(new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z), 0);

function savePlace() {
  const at = player.posture === 'free' || !player.seat ? player.position : player.seat.spot;
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify({ x: at.x, z: at.z, yaw: player.yaw, facing: player.facing, resting: player.resting }));
  } catch {}
}
let placeSavedAt = 0;
addEventListener('pagehide', () => {
  ledger.flush();
  savePlace();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return;
  ledger.flush();
  savePlace();
});
player.setEnabled(true);

const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.2, 0.32, 4, 1),
  new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9, depthWrite: false }),
);
marker.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
marker.visible = false;
scene.add(marker);
let tripPending = false;
player.onTarget = (point) => {
  marker.visible = !!point;
  if (point) marker.position.set(point.x, point.y + 0.03, point.z);
  playerBubble.setTrip(tripPending && !!point);
  tripPending = false;
};
function travelTo(point) {
  stopWork();
  setMode('play');
  tripPending = true;
  player.requestMove(new THREE.Vector3(point.x, 0, point.z), true);
  if (player.posture === 'free' && !player.lying && !player.path) tripPending = false;
}

await loadingStep(0.82, 'Gọi dân làng');
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const normal = new THREE.Vector3();
const seats = new Seats(school.seats);
const playerSeats = new Seats([...school.seats, ...studyHall.seats]);
const studySeats = new Seats(studyHall.seats);
const seatedAvatar = modelReady ? createModel('player', { seated: true }) : createSeatedPlayer();
const playerStudyIcon = createStudyIcon();
playerStudyIcon.position.set(0, modelReady ? 1.75 : 1.3, 0);
seatedAvatar.group.add(playerStudyIcon);
scene.add(seatedAvatar.group);
player.attachSeating({
  seats: playerSeats,
  model: seatedAvatar,
  onDisplace: (member, seat) => town?.displaced(member, seat),
});

town = new Town({
  root: villagerRoot,
  nav: player.nav,
  seats,
  studySeats,
  school,
  farm: farm.crew,
  ledger,
  market,
  estate,
  places: { ...village.places, homes: new Map([...village.places.doors, ...quarter.homeDoors]) },
  lodges: district.lodges,
  river,
  bank,
  bankDesk: district.bankDesk,
  atms: atms.list,
  footprints,
});

player.avoid = (position, dirX, dirZ, remaining) => town.playerAvoidance(position, dirX, dirZ, remaining);
town.martStands = [quarter.martStand, fieldMart.stand];
const everyone = [{ id: PLAYER, name: 'Bạn' }, ...town.all.map((member) => ({ id: member.id, name: member.name })), ...SHOPKEEPERS];
economy.start({
  ledger,
  bank,
  estate,
  staff: () => [
    { id: town.teacher.id, role: 'teacher' },
    { id: town.vendor.id },
    ...town.guards.map((guard) => ({ id: guard.id, role: 'guard' })),
  ],
  people: () => everyone.map((person) => person.id),
  now: gameNow,
});
createRanking({ ledger, bank, estate, people: everyone, now: gameNow });

let context = null;

function contextAt(minutes) {
  const minute = minuteOfDay(minutes);
  return {
    minutes,
    minute,
    day: dayOf(minutes),
    phase: phaseAt(minutes),
    night: minute >= ROUTINE.home || minute < ROUTINE.wake,
    shopOpen: shopOpen(minutes),
    fishOpen: fishShopOpen(minutes),
    martOpen: martOpen(minutes),
    chiefOpen: chiefOpen(minutes),
    bankOpen: bankOpen(minutes),
  };
}
context = contextAt(gameNow());

const angler = createAngler(scene, avatar);
const kanjiQuiz = createKanjiQuiz();
const quiz = createQuiz({
  quiz: kanjiQuiz,
  onPass: () => {
    purse.earn(QUIZ.reward);
    regen.coin(QUIZ.reward, player.position);
  },
  onVillagers: () => {
    for (const member of town?.all ?? []) {
      const pass = member.kind === 'student' ? member.diligence : QUIZ.villagerPass;
      if (Math.random() < pass) member.purse.earn(QUIZ.reward);
    }
  },
});
const fishing = createPlayerFishing({
  river,
  purse,
  angler,
  quiz: kanjiQuiz,
  harvest: effects.harvest,
  player,
  say: (text, seconds) => sayPlayer(text, seconds),
  now: () => clock.elapsedTime,
  minutes: () => context.minutes,
  day: () => context.day,
});
const mountain = createMountain({
  nav: () => player.nav,
  purse,
  quiz: kanjiQuiz,
  player,
  say: (text, seconds) => sayPlayer(text, seconds),
  day: () => context.day,
  onBoarHit(dx, dz) {
    stopWork();
    leaveLine();
    player.knockBack(dx, dz, HUNTING.knockback);
    const lost = Math.min(purse.energy, HUNTING.boarHit);
    if (lost > 0) purse.spendEnergy(lost);
    sayPlayer('Ui da! Lợn rừng húc!', 2);
  },
});
regions.add(mountain.region());
town.wildlife = mountain.wildlife;
function dropSpoiledFish(delay = 0) {
  if (!ledger.spoilFish(context.day).includes(PLAYER)) return;
  setTimeout(() => sayPlayer('Có cá để lâu bị ươn, đành bỏ đi...', 3), delay);
}
dropSpoiledFish(1500);

const lesson = createLesson();
const study = createStudy({ purse });
const inClass = () => player.posture === 'seated' && !player.seat?.study;
const learningNow = () => context.phase.kind === 'period' && tuition.studying;
const tuition = createTuition({
  purse,
  onStudy: () => {
    sayPlayer('📖 Vào học thôi!', 1.6);
    if (inClass()) lesson.open();
  },
  onCredit: (left) => sayPlayer(`Trừ 1 tiết đã đóng trước (còn ${left})`, 2.4),
});
player.lookTarget = school.teacherHead;
player.onFacingTeacher = () => {
  if (player.seat?.study) study.open();
  else if (learningNow()) lesson.open();
};
player.onStand = () => {
  lesson.close();
  study.close();
};

const fireflies = createFireflies({
  scene,
  zones: [
    { x0: -30 + FARM_X, x1: 31 + FARM_X, z0: 40, z1: 62, weight: 3 },
    ...river.spots.map(({ stand }) => ({ x0: stand.x - 4, x1: stand.x + 4, z0: stand.z - 2.5, z1: stand.z + 1, weight: 1 })),
  ],
  heightAt: (x, z) => player.nav.heightAt(x, z),
});
const fireflyLamp = createFireflyLamp(scene);
let lampSeat = null;
let lampMinutes = 0;
let lampAt = null;

function lampLit() {
  return context.night && player.posture === 'seated' && !!player.seat?.study && purse.count('firefly') >= FIREFLY.lampMin;
}

function updateLamp(t) {
  const lit = lampLit();
  const seat = lit ? player.seat : null;
  if (seat !== lampSeat) {
    lampSeat = seat;
    fireflyLamp.show(seat);
  }
  fireflyLamp.update(t);
  const now = context.minutes;
  if (lit && lampAt !== null && now > lampAt) {
    lampMinutes += now - lampAt;
    if (lampMinutes >= FIREFLY.lampMinutesPerFly) {
      lampMinutes -= FIREFLY.lampMinutesPerFly;
      purse.take('firefly', 1);
    }
  }
  lampAt = lit ? now : null;
}

function catchFireflies(t, dt) {
  const caught = fireflies.update(t, dt, {
    night: context.night,
    player: player.position,
    catching: mode === 'play' && player.posture === 'free' && !player.lying && !purse.sleeping && !summon.active,
  });
  if (!caught) return;
  purse.add('firefly', caught);
  sayPlayer(`✨ ${purse.count('firefly')}`, 1.2);
}

const summon = createSummon({
  scene,
  models: () => [avatar.group],
  ready: () =>
    mode === 'play' &&
    player.posture === 'free' &&
    !player.lying &&
    !purse.sleeping &&
    !popupOpen() &&
    !kanjiQuiz.open &&
    !quiz.open &&
    !fishing.active &&
    !fieldTask &&
    !effectTask,
  inClass,
  prepare() {
    stopWork();
    leaveLine();
    player.setEnabled(false);
    player.shadow?.setVisible(false);
    return player.position.clone();
  },
  teleport() {
    const free = school.seats.filter((seat) => seats.isFreeFor(seat, 'player'));
    const seat = free.length ? free[Math.floor(Math.random() * free.length)] : null;
    const spot = (seat ?? school.seats[0]).spot.clone();
    player.place(spot, 0);
    player.clearPath();
    player.shadow?.setVisible(true);
    player.setEnabled(mode === 'play');
    return { spot, seat };
  },
  settle({ seat }) {
    if (!seat || player.posture !== 'free' || player.path || !playerSeats.canTake(seat, 'player')) return;
    if (Math.hypot(seat.spot.x - player.position.x, seat.spot.z - player.position.z) > 0.7) return;
    player.beginSit(seat);
  },
});

const teacherDesk = {
  act() {
    if (!school.teacherPresent) return 'Thầy về nhà rồi, mai quay lại nhé!';
    tuition.openTeacher();
    return null;
  },
};
const noticeSpot = {
  act() {
    scheduleBoard.open();
    return null;
  },
};
const lodgeDesk = createLodgeDesk({ purse, onRent: (id) => sleepAtLodge(id) });

const innDesk = {
  act() {
    return lodgeDesk.rent('inn');
  },
};

let playerLine = null;

function stepInLine() {
  const index = playerLine.queue.indexOf(player);
  playerLine.index = index;
  const spot = playerLine.queue.slot(index);
  player.requestMove(new THREE.Vector3(spot.x, 0, spot.z), false);
}

function approachLine() {
  const tail = playerLine.queue.tail();
  player.requestMove(new THREE.Vector3(tail.x, 0, tail.z), false);
}

function leaveLine() {
  if (!playerLine) return;
  playerLine.queue.leave(player);
  playerLine = null;
}

function joinLine(kind, open, dialog) {
  const queue = town.queues[kind];
  if (playerLine?.queue === queue) {
    if (playerLine.joined) stepInLine();
    else approachLine();
    return;
  }
  leaveLine();
  playerLine = { queue, open, dialog, index: -1, joined: false, served: false, retries: 0, retryAt: 0 };
  approachLine();
}

function retryLine(line, move) {
  const t = clock.elapsedTime;
  if (t < line.retryAt) return;
  line.retryAt = t + (line.retries++ < 3 ? 0 : 1);
  move();
}

function updateLine() {
  const line = playerLine;
  if (!line) return;
  if (line.served) {
    if (!line.dialog.isOpen) leaveLine();
    return;
  }
  if (!line.joined) {
    if (line.queue.reached(player.position)) {
      line.joined = true;
      line.retries = 0;
      line.queue.join(player);
      stepInLine();
      return;
    }
    if (player.path || player.posture !== 'free' || player.lying) return;
    retryLine(line, approachLine);
    return;
  }
  const index = line.queue.indexOf(player);
  if (index !== line.index) {
    line.retries = 0;
    stepInLine();
    return;
  }
  if (player.path || player.posture !== 'free' || player.lying) return;
  const spot = line.queue.slot(index);
  const reach = index === 0 ? JOIN_RADIUS : 1.5;
  if (Math.hypot(spot.x - player.position.x, spot.z - player.position.z) > reach) {
    retryLine(line, stepInLine);
    return;
  }
  line.retries = 0;
  const look = index === 0 ? line.queue.look : line.queue.slot(index - 1);
  player.faceToward(look.x, look.z);
  if (index > 0) return;
  line.served = true;
  line.open();
}

function goDo(region, target, id) {
  fieldTask = { region, target, action: { id }, choice: null };
  player.requestMove(new THREE.Vector3(target.stand.x, 0, target.stand.z), false);
}

function clickTargets() {
  return [...scenery.clickables, ...regions.clickables, ...town.clickables, ...notice.clickables, ...atms.clickables, school.root, studyHall.group, inn.group];
}

player.onClick = (clientX, clientY, run) => {
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const targets = clickTargets();
  if (roof.visible) targets.push(roof);
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return;
  player.getUp();
  stopWork();
  const queueing = playerLine;
  const villager = town.villagerAt(hit.object);
  if (villager === town.vendor) {
    leaveLine();
    visitVendor();
    return;
  }
  if (villager) {
    villager.greet(player.position);
    return;
  }
  if (school.isTeacher(hit.object)) {
    leaveLine();
    goDo(teacherDesk, { stand: TEACHER_STAND, x: CX, z: TEACHER_Z }, 'teacher');
    return;
  }
  if (inn.owns(hit.object)) {
    leaveLine();
    goDo(innDesk, { stand: INN_STAND, x: INN_DOOR.x, z: INN_DOOR.z }, 'inn');
    return;
  }
  if (notice.owns(hit.object)) {
    leaveLine();
    goDo(noticeSpot, { stand: notice.stand, x: notice.group.position.x, z: notice.group.position.z }, 'notice');
    return;
  }
  const atm = atms.atmOf(hit.object);
  if (atm) {
    joinLine(`atm:${atm.id}`, () => atmUI.open(atm), atmUI);
    return;
  }
  const region = regions.regionOf(hit.object) ?? regions.active;
  if (region?.interact?.(hit.object, player.position)) {
    leaveLine();
    return;
  }
  const target = region?.target?.(hit, player.position);
  const blank = target ? null : region?.blankTap?.(hit);
  if (blank) {
    if (queueing) leaveLine();
    sayPlayer(blank, 1.8);
    return;
  }
  const kind = target?.kind;
  const venue = VENUES[kind];
  if (target && venue && town.queues[kind]) {
    if (!venue.isOpen(gameNow())) {
      leaveLine();
      sayPlayer(region.act('visit', target), 2.4);
      return;
    }
    joinLine(
      kind,
      () => {
        const reply = region.act('visit', target);
        if (reply) sayPlayer(reply, 2.4);
      },
      venue.ui,
    );
    return;
  }
  if (queueing) leaveLine();
  if (target) {
    const action = region.actionFor(target);
    const go = (choice) => {
      fieldTask = { region, target, action, choice };
      player.requestMove(new THREE.Vector3(target.stand.x, 0, target.stand.z), run);
    };
    if (action.choices) picker.open({ ...action.choices, x: clientX, y: clientY }, (option) => go(option.id));
    else go();
    return;
  }
  const point = hit.point.clone();
  if (hit.face) {
    normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    point.addScaledVector(normal, 0.3);
  }
  const seat = playerSeats.at(hit.point);
  if (seat && playerSeats.canTake(seat, 'player')) {
    player.requestSeat(seat, run);
    return;
  }
  player.requestMove(point, run);
};

const MAP_VIEW = { height: 95, tilt: 0.45, near: 2, min: 25, max: 170, fogNear: 400, fogFar: 900, tapGap: 350, tapSlop: 12 };
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.enableRotate = false;
orbit.minPolarAngle = MAP_VIEW.tilt;
orbit.maxPolarAngle = MAP_VIEW.tilt;
orbit.minDistance = MAP_VIEW.min;
orbit.maxDistance = MAP_VIEW.max;
orbit.screenSpacePanning = false;
orbit.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
orbit.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
orbit.enabled = false;
const ui = {
  modeBtn: document.getElementById('modeBtn'),
};

let mode = 'play';

function setLabel(button, text) {
  button.title = text;
  button.setAttribute('aria-label', text);
}

function refreshUI() {
  frameCamera();
  ui.modeBtn.classList.toggle('active', mode === 'overview');
  setLabel(ui.modeBtn, mode === 'overview' ? 'Quay lại nhập vai' : 'Xem toàn cảnh');
}

function clampMapView() {
  const x = THREE.MathUtils.clamp(orbit.target.x, NAV_BOUNDS.x0, NAV_BOUNDS.x1);
  const z = THREE.MathUtils.clamp(orbit.target.z, NAV_BOUNDS.z0, NAV_BOUNDS.z1);
  if (x === orbit.target.x && z === orbit.target.z) return;
  camera.position.x += x - orbit.target.x;
  camera.position.z += z - orbit.target.z;
  orbit.target.x = x;
  orbit.target.z = z;
}

function setMode(next) {
  if (next === mode) return;
  mode = next;
  if (mode === 'overview') {
    player.setEnabled(false);
    orbit.target.set(player.position.x, 0, player.position.z);
    camera.position.set(player.position.x, MAP_VIEW.height, player.position.z + MAP_VIEW.height * Math.tan(MAP_VIEW.tilt));
    savedFog = { near: scene.fog.near, far: scene.fog.far };
    scene.fog.near = MAP_VIEW.fogNear;
    scene.fog.far = MAP_VIEW.fogFar;
    savedNear = camera.near;
    camera.near = MAP_VIEW.near;
    camera.updateProjectionMatrix();
    orbit.enabled = true;
    orbit.update();
  } else {
    orbit.enabled = false;
    if (savedFog) Object.assign(scene.fog, savedFog);
    savedFog = null;
    if (savedNear !== null) camera.near = savedNear;
    savedNear = null;
    camera.updateProjectionMatrix();
    player.setEnabled(true);
  }
  refreshUI();
}

let savedFog = null;
let savedNear = null;
let mapPress = null;
let mapTap = null;

function mapPoint(clientX, clientY) {
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(clickTargets(), true)[0]?.point ?? null;
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (mode === 'overview') mapPress = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (mode !== 'overview' || !mapPress) return;
  const moved = Math.hypot(event.clientX - mapPress.x, event.clientY - mapPress.y) > MAP_VIEW.tapSlop;
  mapPress = null;
  if (moved) {
    mapTap = null;
    return;
  }
  const now = performance.now();
  const second = mapTap && now - mapTap.at < MAP_VIEW.tapGap && Math.hypot(event.clientX - mapTap.x, event.clientY - mapTap.y) <= MAP_VIEW.tapSlop * 2;
  mapTap = second ? null : { at: now, x: event.clientX, y: event.clientY };
  if (!second) return;
  const point = mapPoint(event.clientX, event.clientY);
  setMode('play');
  if (point) player.requestMove(new THREE.Vector3(point.x, 0, point.z), true);
});

ui.modeBtn.addEventListener('click', () => setMode(mode === 'play' ? 'overview' : 'play'));

const restBtn = document.getElementById('restBtn');
const actionBar = document.getElementById('actionBar');
let restShown = '';
function refreshRest() {
  const lying = player.resting;
  const seated = player.posture !== 'free';
  const usable = lying || (mode === 'play' && !seated && !purse.sleeping && !town.restBlocked(player.position));
  const key = `${lying}|${usable}|${seated}`;
  if (key === restShown) return;
  restShown = key;
  actionBar.hidden = seated;
  restBtn.disabled = !usable;
  restBtn.setAttribute('aria-pressed', String(lying));
  setLabel(restBtn, lying ? 'Đứng dậy' : 'Nằm nghỉ');
}
restBtn.addEventListener('click', () => {
  if (player.resting) player.getUp();
  else if (!town.restBlocked(player.position)) {
    leaveLine();
    stopWork();
    player.lieDown();
  }
  refreshRest();
});

for (const button of [ui.modeBtn, restBtn]) {
  button.addEventListener('pointerup', () => button.blur());
}

const scheduleBoard = createScheduleBoard({ lesson, purse, sky, context: () => context });

let lastPhaseKey = context.phase.key;
function onPhaseChange(ctx) {
  const kind = ctx.phase.kind;
  if (kind === 'period') {
    lesson.nextPeriod();
    return;
  }
  lesson.close();
  if (inClass() && (kind === 'recess' || kind === 'free')) player.standUp();
}

const BASE_FOV = 55;
function frameCamera() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const narrow = Math.max(0, 1 - width / height);
  const following = mode === 'play';
  camera.fov = BASE_FOV + narrow * 32;
  camera.setViewOffset(width, height, 0, following ? -narrow * 0.3 * height : 0, width, height);
  player.distanceScale = 1 + narrow * 0.75;
}
function fitView() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  frameCamera();
}
window.addEventListener('resize', fitView);
fitView();

refreshUI();
scheduleBoard.refresh(true);

const clock = new THREE.Clock();
let lastFrame = 0;
let lastInput = performance.now();
for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel']) {
  window.addEventListener(type, () => (lastInput = performance.now()), { passive: true });
}
const SCROLL_PAUSE = 300;
let lastScroll = -Infinity;
document.addEventListener('scroll', () => (lastScroll = performance.now()), { capture: true, passive: true });

tuning.trackOutlines();

const rooms = createRooms();
town.view = rooms;
const regionBox = (region) =>
  (region.cullBox ??= new THREE.Box3(new THREE.Vector3(region.bounds.x0, -2, region.bounds.z0), new THREE.Vector3(region.bounds.x1, 30, region.bounds.z1)));
function cullRooms() {
  rooms.update(camera);
  setCharacterShadows(false);
  for (const region of regions.regions) {
    const group = region.handle?.group;
    if (group) group.visible = rooms.seesBox(regionBox(region));
  }
}

const dialogs = [...document.querySelectorAll('dialog')];
const bagPanel = document.getElementById('bagPanel');
const popupOpen = () => purse.sleeping || !bagPanel.hidden || dialogs.some((dialog) => dialog.open);
const scenePopups = [() => fishing.active && kanjiQuiz.open];
const scenePopupOpen = () => !purse.sleeping && bagPanel.hidden && scenePopups.some((open) => open());

const sleepVeil = document.getElementById('sleepVeil');
const sleepEnergy = document.getElementById('sleepEnergy');

function showSleep(on) {
  sleepVeil.classList.toggle('on', on);
  player.setEnabled(!on && mode === 'play');
}

function drainEnergy() {
  const asleep = purse.sleeping;
  const lodging = asleep && purse.lodging;
  const moving = activityOf(Math.hypot(player.velocity.x, player.velocity.z), WALK_SPEED, RUN_SPEED);
  const resting = lodging || 'sleep';
  const lying = nearShelter(player.position.x, player.position.z) ? 'shelter' : inStudyRoom(player.position) ? 'studyRest' : 'rest';
  const studying = player.seat?.study || (inClass() && learningNow());
  const activity = asleep ? resting : player.resting ? lying : player.posture === 'seated' ? (studying ? (lampLit() ? 'lampStudy' : 'study') : 'seated') : moving;
  const offline = asleep ? lodging || 'idle' : player.resting ? lying : 'idle';
  purse.liveEnergy(context.minutes, activity, asleep ? resting : offline, offline);
  player.tired = purse.energy <= 0;
  if (!asleep) return;
  if (lodging && purse.full) {
    wakeUp('Khoẻ re rồi, đi tiếp thôi!');
    return;
  }
  if (!lodging && !context.night) {
    wakeUp('☀️ Sáng rồi, dậy thôi!');
    return;
  }
  const text = `⚡ ${Math.floor(purse.energy)}/${ENERGY.max}`;
  if (sleepEnergy.textContent !== text) sleepEnergy.textContent = text;
}

function sleepAtHome() {
  if (purse.sleeping) return;
  fishing.stop();
  purse.setSleeping(true);
  showSleep(true);
}

function sleepAtLodge(id) {
  if (purse.sleeping) return;
  fishing.stop();
  player.getUp();
  purse.setSleeping(true, id);
  showSleep(true);
}

function wakeUp(message) {
  leaveRoom(PLAYER);
  purse.setSleeping(false);
  showSleep(false);
  sayPlayer(message, 2.4);
}

document.getElementById('wakeBtn').addEventListener('click', () => wakeUp('Dậy rồi!'));
if (purse.sleeping) showSleep(true);

await itemImages;
await loadingStep(0.9, 'Thắp đèn lồng');
await regions.warmUp(() => renderer.compileAsync(scene, camera)).catch(() => {});
await loadingStep(0.97);

let shownNight = -1;
let framesShown = 0;
let lastDay = context.day;
renderer.setAnimationLoop((time) => {
  const busy = !!player.path || Math.hypot(player.velocity.x, player.velocity.z) > 0.2 || player.lying || !!effectTask || fishing.active;
  if (busy) lastInput = performance.now();
  const idle = performance.now() - lastInput > IDLE_AFTER;
  const watching = scenePopupOpen();
  const popup = !watching && popupOpen();
  if (popup && performance.now() - lastScroll < SCROLL_PAUSE) return;
  const reading = lesson.visible || study.visible;
  const resting = reading || idle;
  const still = resting && !town.anyMoving() && !mountain.moving();
  const frameRate = purse.sleeping
    ? SLEEP_FRAME_RATE
    : watching
      ? SCENE_POPUP_FRAME_RATE
      : popup
        ? bagPanel.hidden
          ? POPUP_FRAME_RATE
          : BAG_FRAME_RATE
        : still
          ? reading
            ? READING_FRAME_RATE
            : IDLE_FRAME_RATE
          : resting
            ? WATCHING_FRAME_RATE
            : FRAME_RATE;
  if (time - lastFrame < 1000 / frameRate - 2) return;
  lastFrame = time;
  if (LOW_POWER) {
    if (popup) tuning.pauseResolution();
    else tuning.adaptResolution(time, frameRate);
  }
  const elapsed = clock.getDelta();
  const dt = Math.min(elapsed, MAX_STEP);
  const t = clock.elapsedTime;
  context = contextAt(gameNow());
  drainEnergy();
  if (t >= placeSavedAt) {
    placeSavedAt = t + 3;
    savePlace();
  }
  if (context.phase.key !== lastPhaseKey) {
    lastPhaseKey = context.phase.key;
    onPhaseChange(context);
  }
  const night = sky.update(context.minutes, camera, mode === 'overview' ? orbit.target : player.position, SHADOW_SPAN);
  tuning.refreshShadows(t);
  if (Math.abs(night - shownNight) > 0.01) {
    shownNight = night;
    school.setNight(night);
    studyHall.setNight(night);
    inn.setNight(night);
    village.setNight(night);
    river.setNight(night);
    streetLamps.setNight(night);
  }
  notice.refresh(context.day);
  if (context.day !== lastDay) {
    lastDay = context.day;
    dropSpoiledFish();
  }
  footprints.update(t);
  tuition.update(context, inClass());
  playerStudyIcon.visible = inClass() && learningNow();
  scheduleBoard.refresh();
  refreshRest();
  if (farm.tick()) mailbox.sync(farm.chores(PLAYER, player.position));
  cullRooms();
  const simSpan = Math.min(elapsed, SIM_SPAN);
  const simSteps = Math.max(1, Math.ceil(simSpan / MAX_STEP));
  for (let i = 0; i < simSteps; i++) town.update(t, simSpan / simSteps, context, player, camera, i === simSteps - 1);
  if (shopUI.isOpen && !context.shopOpen) {
    shopUI.close();
    sayPlayer(`Tiệm đóng cửa rồi, mở ${shopHours()} nhé!`, 2.4);
  }
  if (fishShopUI.isOpen && !context.fishOpen) {
    fishShopUI.close();
    sayPlayer(`Hàng cá đóng cửa rồi, mở ${fishShopHours()} nhé!`, 2.4);
  }
  bank.tick(context.minutes);
  bank.mature();
  if (bankUI.isOpen && !context.bankOpen) {
    bankUI.close();
    sayPlayer(`Ngân hàng đóng cửa rồi, mở ${bankHours()} nhé!`, 2.4);
  }
  district.update(t, context, camera);
  updateLine();
  school.update(t, context.phase.kind === 'period');
  studyHall.update(t);
  inn.update(t);
  village.update(t, context, camera);
  streetLamps.update(t);
  river.update(dt, context.minutes);
  clouds.update(dt, night);
  player.held = kanjiQuiz.open;
  player.update(dt);
  placeBubble();
  updateBubbles(camera, t);
  regen.update(dt, t, player.position, player.restAmount, player.resting, context.minutes);
  for (const effect of Object.values(effects)) effect.update(dt);
  fishing.update();
  countryside.update(context.day);
  mountain.update(dt, { camera, night, rest: context.night, canHit: mode === 'play' && player.posture === 'free' && !player.lying && !kanjiQuiz.open && !purse.sleeping });
  angler.update(dt);
  regions.update(t, dt, mode === 'overview' ? orbit.target : player.position);
  quiz.update(dt, regions.active?.id !== 'school' && !fishing.active && !summon.active);
  summon.update(dt, context);
  catchFireflies(t, dt);
  updateLamp(t);
  if (servingVendor) {
    if (foodUI.isOpen) town.vendor.hold(2);
    else servingVendor = false;
  }
  hoverTip.update(t);
  tuning.updateOutlines(t);
  playerBubble.update(t);
  showCoords();
  playerBubble.setMood(moodOf(purse.energy));
  avatar.face.update(t, player.restAmount > 0.6 ? 'blink' : 'open');
  if (seatedAvatar.group.visible) {
    seatedAvatar.face.update(t);
    seatedAvatar.head.rotation.x = 0.12 + Math.sin(t * 1.1) * 0.05;
    seatedAvatar.head.rotation.y = Math.sin(t * 0.4) * 0.2;
    seatedAvatar.pose?.();
  }
  if (avatar.group.visible) avatar.pose?.();
  if (mode === 'overview') {
    orbit.update();
    clampMapView();
  }
  if (marker.visible) marker.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
  renderer.render(scene, camera);
  if (framesShown < 2 && ++framesShown === 2) loadingDone();
});
