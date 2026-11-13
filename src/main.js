import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelWorld } from './world.js';
import { buildWorld, populate, stairHeight, CX, TEACHER_STAND, TEACHER_Z } from './school.js';
import { createScenery } from './scenery.js';
import { createPlayer, createSeatedPlayer, createWalker } from './characters.js';
import { loadCharacterModels, hasModel, createModel, setCharacterShadows } from './characterModels.js';
import { createRooms, inStudyRoom } from './rooms.js';
import { Seats } from './seats.js';
import { SeatWaitlist } from './seatWait.js';
import { PlayerController, WALK_SPEED, RUN_SPEED } from './walk.js';
import { NavGrid } from './nav.js';
import { createSky, createClouds } from './sky.js';
import { Dust, createBlobShadow } from './groundfx.js';
import { StepSound } from './stepSound.js';
import { Music } from './music.js';
import { Ambience } from './ambience.js';
import { StudyMusic } from './studyMusic.js';
import { createTargetMarker } from './targetMarker.js';
import { createBroadcast } from './broadcast.js';
import { createUiSounds } from './uiSound.js';
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
import { ITEMS, Ledger, PLAYER } from './inventory.js';
import { createBag } from './bag.js';
import { createMailbox } from './mailbox.js';
import { createAtms, createAtmUI } from './atm.js';
import { LOW_POWER } from './quality.js';
import { freeze } from './toon.js';
import { gameNow, dayOf, minuteOfDay, DAY_MINUTES, hoursText } from './clock.js';
import { ROUTINE, ENERGY, WORLD, HUNTING, VENDOR, FIREFLY, QUIZ, BLESSING, CERTIFY } from './config.js';
import { createBlessing, createBlessingDialog } from './blessing.js';
import { createMarket, createShopUI, createFishShopUI, createMartUI, shopOpen, shopHours, fishShopOpen, fishShopHours, martOpen, martHours } from './market.js';
import { createEstate, createChiefUI, chiefOpen, chiefHours } from './estate.js';
import { Town } from './villagers.js';
import { createAwaySim } from './villagerAway.js';
import { createStudyIcon } from './studyIcon.js';
import { villagerProfiles } from './villagerData.js';
import { createVillage } from './village.js';
import { createQuarter, plazaFloor } from './quarter.js';
import { createFieldMart } from './fieldMart.js';
import { createMountain } from './mountain.js';
import { createCountryside } from './countryside.js';
import { createDistrict } from './district.js';
import { book, leaveRoom } from './lodging.js';
import { MOUNTAIN, terrainHeight, terrainFloor, navSurface, nearShelter } from './terrain.js';
import { createNoticeBoard } from './notice.js';
import { createSettings, wipeGame } from './settings.js';
import { watchUpdates, updateOffered } from './updates.js';
import { createFullscreenToggle } from './fullscreen.js';
import { createRiver } from './river.js';
import { createAngler } from './angler.js';
import { createKanjiQuiz } from './kanjiQuiz.js';
import { createPlayerFishing } from './fishing.js';
import { createVitals } from './vitals.js';
import { paintPortrait } from './portrait.js';
import { buildStudyHall, createStudyHall, hallBounds, STUDY_HALLS } from './studyHall.js';
import { createInn, INN_STAND, INN_DOOR } from './inn.js';
import { createStudy } from './study.js';
import { createExams } from './exams.js';
import { createExamHall, examOpen, qualifyTag } from './examHall.js';
import { createInternalDialog } from './internalDialog.js';
import { createHallIntro } from './hallIntro.js';
import { certify } from './certify.js';
import { DECKS } from './studyDecks.js';
import { activityOf, homeActivity, moodOf } from './stamina.js';
import { createFoodUI, eateryOpen, eateryHours } from './eatery.js';
import { createBank, createBankUI, bankOpen, bankHours } from './bank.js';
import { createRanking } from './ranking.js';
import { economy, SHOPKEEPERS } from './economy.js';
import { loadingStep, loadingDone, hasEntered } from './loading.js';
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
import { writeGameItem, removeGameItem } from './seal.js';
import { worldKey } from './saveKeys.js';
import { createArena } from './arena.js';
import { ISLAND_BOUNDS, createArenaIsland, islandFloor, islandNavFloor } from './arenaIsland.js';
import { createArenaTrip } from './arenaTrip.js';
import { createArenaFx } from './arenaFx.js';
import { createArenaBattle } from './arenaBattle.js';
import { createArenaDuel } from './arenaDuel.js';
import { createArenaCast } from './arenaCast.js';
import { BOARD_SIZE, PALETTES, bracketKey, createBracketDialog, drawBracket } from './arenaBoard.js';
import { arenaLines, createArenaDesk } from './arenaDesk.js';

const FRAME_RATE = LOW_POWER ? 30 : 60;
const IDLE_FRAME_RATE = 10;
const READING_FRAME_RATE = 10;
const POPUP_FRAME_RATE = 10;
const BAG_FRAME_RATE = Math.min(FRAME_RATE, 30);
const SCENE_POPUP_FRAME_RATE = Math.min(FRAME_RATE, 30);
const WATCHING_FRAME_RATE = Math.min(FRAME_RATE, 30);
const SLEEP_FRAME_RATE = 2;
const STUDY_FRAME_RATE = 10;
const MAX_STEP = 0.12;
const SIM_SPAN = 0.6;
const IDLE_AFTER = 20000;
const SHADOW_SPAN = LOW_POWER ? 30 : 45;
const NAV_BOUNDS = { x0: WORLD.x0, x1: Math.max(WORLD.x1, ISLAND_BOUNDS.x1), z0: MOUNTAIN.z0, z1: 84 };

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
await loadingStep(0.4, 'Dựng trường khảo thí');
const world = new VoxelWorld();
const layout = buildWorld(world);
for (const hall of STUDY_HALLS) buildStudyHall(world, hall);
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
const studyHalls = STUDY_HALLS.map((hall) => createStudyHall(scene, hall));
const studyHallSeats = studyHalls.flatMap((hall) => hall.seats);
const internalHallSeats = studyHalls.flatMap((hall) => hall.internalSeats);
const inn = createInn(scene);
const quarter = createQuarter();
const blessing = createBlessing(scene);
const countryside = createCountryside();
const district = createDistrict();
school.obstacles.push(
  ...notice.obstacles,
  ...atms.obstacles,
  ...village.obstacles,
  ...river.obstacles,
  ...studyHalls.flatMap((hall) => hall.obstacles),
  ...inn.obstacles,
  ...quarter.obstacles,
  ...blessing.obstacles,
  ...countryside.obstacles,
  ...district.obstacles,
  ...streetLamps.obstacles,
);

await loadingStep(0.62, 'Gieo mạ, mở chợ');
const modelReady = hasModel('player');
const avatar = modelReady ? createModel('player') : createPlayer();
scene.add(avatar.group);
const dust = new Dust(scene);
const stepSound = new StepSound();
const uiSounds = createUiSounds();
const villageMusic = new Music(['assets/music/village.ogg', 'assets/music/village.m4a']);
const fieldMusic = new Music(['assets/music/field.ogg', 'assets/music/field.m4a']);
const blessingTracks = ['blessing-1', 'blessing-2'].map((name) => new Music([`assets/music/${name}.ogg`, `assets/music/${name}.m4a`]));
let blessingTrack = null;
const riverAmbience = new Ambience({ bed: 'assets/music/river', volume: 0.3 });
const FIELD_REGIONS = new Set(['farm', 'bancoFarm', 'country-rice']);
const QUIET_REGIONS = new Set(['farm', 'bancoFarm', 'country-rice', 'river', 'mountain']);
let soundRegion = null;
function updateSoundscape(focus) {
  const village = soundRegion !== null && !QUIET_REGIONS.has(soundRegion);
  const shore = village ? regions.shoreAt(focus.x, focus.z) : null;
  riverAmbience.set(soundRegion === 'river' || shore?.zone === 'near');
  const blessed = blessing.member(PLAYER, context.minutes);
  if (!blessed) blessingTrack = null;
  else blessingTrack ??= blessingTracks[Math.floor(Math.random() * blessingTracks.length)];
  for (const track of blessingTracks) track.set(track === blessingTrack);
  fieldMusic.set(FIELD_REGIONS.has(soundRegion) && !studyMusic.playing && !blessed);
  villageMusic.set(village && !shore && !studyMusic.playing && !blessed);
}
const player = new PlayerController({
  camera,
  domElement: renderer.domElement,
  world,
  obstacles: school.obstacles,
  avatar,
  dust,
  stepSound,
  shadow: createBlobShadow(scene, 0.34),
});
player.surfaceAt = (x, z) => islandFloor(x, z) ?? stairHeight(x, z) ?? plazaFloor(x, z) ?? terrainFloor(x, z);
player.terrainAt = terrainHeight;

const ledger = new Ledger();
const purse = ledger.purse(PLAYER);
if (purse.sleeping && purse.lodging) book(purse.lodging, PLAYER);
createBag(purse);
const mailbox = createMailbox({
  onTravel: travelTo,
  onClaim({ money = 0, intellect = 0 }) {
    if (money > 0) {
      economy.reward(purse, money);
      regen.coin(money, player.position);
    }
    if (intellect > 0) {
      purse.addIntellect(intellect);
      regen.intellect(intellect, player.position);
    }
    uiSounds.correct();
  },
});
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
  mailbox.notify({ icon: '🏦', lines, place: 'Ngân hàng · Xóm Bàn Cờ', point: district.bankDoor });
});

createFullscreenToggle();

let placeLocked = false;
createSettings({
  onReset() {
    renderer.setAnimationLoop(null);
    haltStores();
    placeLocked = true;
    wipeGame();
    window.location.reload();
  },
});
watchUpdates();

const regions = new RegionManager({ scene, obstacles: school.obstacles });
regions.add({
  id: 'school',
  name: 'Trường khảo thí',
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
    openArena: () => arenaDesk.open(),
    minutes: () => gameNow(),
  }),
);
const farm = createFarm({ ledger, nameOf, nav: () => player.nav });
regions.add(farm);
const arenaIsland = createArenaIsland({ onPortal: () => arenaTrip?.leave(), onBoard: () => bracketDialog.open(), boardSize: BOARD_SIZE, camera, night: () => shownNight });
regions.add(arenaIsland.region);
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
const PLACE_KEY = 'langsch.player';
const BLESSING_KEY = 'langsch.blessing';
const VILLAGERS_KEY = worldKey('villagers');
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
  surfaceAt: (x, z) => (x > WORLD.x1 ? islandNavFloor(x, z) : stairHeight(x, z) ?? plazaFloor(x, z) ?? navSurface(x, z)),
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
  if (region) soundRegion = region.id;
  for (const control of regionControls) control.hidden = control.dataset.region !== region?.id;
  hoverTip.reset();
  picker.close();
};

const playerBubble = createBubble();
playerBubble.sprite.position.set(0, modelReady ? 2.12 : 1.95, 0);
avatar.group.add(playerBubble.sprite);
const sayPlayer = (text, seconds = 2.2, options) => playerBubble.show(text, seconds, clock.elapsedTime, options);
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
    const farmed = task.region.farmland && task.region.didChange?.();
    if (farmed) {
      uiSounds.pop();
      if (task.action.id === 'fertilize') sayPlayer(ITEMS.fertilizer.icon, 1.2, { plain: true });
      if (task.action.id === 'harvest' && reply) sayPlayer(reply, 1.2, { plain: true });
      if (task.action.id === 'harvest' && !kanjiQuiz.open && !exams.running && Math.random() < CERTIFY.harvestQuiz) workQuiz.ask({ icon: '🧺', quick: true });
    } else if (reply) sayPlayer(reply, 1.8);
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

let arenaTrip = null;
function savePlace() {
  if (placeLocked) return;
  const at = arenaTrip?.returnSpot() ?? (player.posture === 'free' || !player.seat ? player.position : player.seat.spot);
  try {
    writeGameItem(PLACE_KEY, JSON.stringify({ x: at.x, z: at.z, yaw: player.yaw, facing: player.facing, resting: player.resting }));
    writeGameItem(BLESSING_KEY, JSON.stringify(blessing.standing(PLAYER, gameNow())));
    if (town?.started) writeGameItem(VILLAGERS_KEY, JSON.stringify(town.snapshot(clock.elapsedTime, context.minutes)));
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

const marker = createTargetMarker(scene);
let tripPending = false;
player.onTarget = (point) => {
  if (point) marker.show(point);
  else marker.hide();
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
const playerSeats = new Seats([...school.seats, ...studyHallSeats, ...internalHallSeats]);
const studySeats = new Seats(studyHallSeats);
const internalSeats = new Seats(internalHallSeats);
const seatWait = new SeatWaitlist(
  studySeats,
  STUDY_HALLS.map((hall, i) => ({ deck: hall.deck, waitSpots: studyHalls[i].waitSpots, look: studyHalls[i].teacher.at, area: hallBounds(hall), entry: studyHalls[i].entry })),
);
const seatedAvatar = modelReady ? createModel('player', { seated: true }) : createSeatedPlayer();
const playerStudyIcon = createStudyIcon();
playerStudyIcon.position.set(0, modelReady ? 1.75 : 1.3, 0);
seatedAvatar.group.add(playerStudyIcon);
let bookIconOn = false;
let bookTurn = 0;
scene.add(seatedAvatar.group);
player.attachSeating({
  seats: playerSeats,
  model: seatedAvatar,
  onDisplace: (member, seat) => town?.displaced(member, seat),
});

town = new Town({
  root: villagerRoot,
  stepSound,
  nav: player.nav,
  seats,
  studySeats,
  internalSeats,
  seatWait,
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
  classrooms: studyHalls.map((hall, i) => ({ deck: STUDY_HALLS[i].deck, teacher: hall.teacher })),
  dust,
});

try {
  town.saved = JSON.parse(localStorage.getItem(VILLAGERS_KEY) ?? 'null');
} catch {}
player.avoid = (position, dirX, dirZ, remaining) => town.playerAvoidance(position, dirX, dirZ, remaining);
player.blockers = () => town.restingBlockers();
town.martStands = [quarter.martStand, fieldMart.stand];
town.blessing = blessing;
const arena = createArena({ ledger, roster: () => town.members.map((member) => member.id) });
const arenaFx = createArenaFx(scene);
arenaTrip = createArenaTrip({ arena, player, town, busy: () => exams.running || fishing.active, say: (text) => sayPlayer(text, 2.4), warp: (at, color, size) => arenaFx.beam(at, color, size) });
town.arena = arena;
town.arenaDesk = district.arenaDesk;
const portraits = new Map();
function portraitOf(id) {
  if (portraits.has(id)) return portraits.get(id);
  const profile = town.members.find((member) => member.id === id)?.profile;
  const model = id === PLAYER ? (modelReady ? createModel('player') : createPlayer()) : profile ? (profile.model && hasModel(profile.model) ? createModel(profile.model) : createWalker(profile.look)) : null;
  const img = new Image();
  if (model) paintPortrait(renderer, model, img);
  portraits.set(id, img.getAttribute('src'));
  return portraits.get(id);
}
function sayInArena(id, text) {
  if (id === PLAYER) sayPlayer(text, 1.4);
  else town.members.find((member) => member.id === id)?.say(text, 1.4);
}
const arenaBattle = createArenaBattle({ arena, fx: arenaFx, nameOf, portraitOf, sayOf: sayInArena, here: () => arenaTrip.here, cast: createArenaCast({ nameOf }), hidden: () => arenaDuel.open, onHit: (stage) => arenaTrip.cheer(stage) });
const arenaDuel = createArenaDuel({ arena, nameOf, portraitOf, now: () => gameNow(), sounds: uiSounds, onTurn: () => arenaBattle.played(), onLeave: () => arenaTrip.leave() });
const bracketDialog = createBracketDialog({ arena, nameOf, now: () => gameNow() });
const arenaDesk = createArenaDesk({ arena, minutes: () => gameNow(), greet: (text) => district.arenaDesk?.say(text), onBracket: () => bracketDialog.open() });
arena.onFinish((event) => {
  if (!event.entrants.includes(PLAYER)) return;
  mailbox.notify({ icon: '⚔️', lines: arenaLines(event, nameOf), keep: true });
});
const arenaPresent = (id) => id === PLAYER && mode === 'play' && !purse.sleeping;

function updateArena(dt) {
  arena.tick(gameNow(), { present: arenaPresent });
  const now = gameNow();
  arenaTrip.update(now, clock.elapsedTime);
  arenaBattle.update(now, dt, player.position);
  arenaIsland.paintBoard(bracketKey(arena.event, now), (ctx) => drawBracket(ctx, BOARD_SIZE, arena.event, { nameOf, now, palette: PALETTES.board }));
  if (!arenaDuel.running && arenaTrip.fighting && arena.liveMatch(PLAYER) && !kanjiQuiz.open && !exams.running) arenaDuel.run();
}
const blessingDialog = createBlessingDialog({
  blessing,
  minutes: () => context.minutes,
  onJoin: () => {
    const joined = blessing.join(PLAYER, context.minutes);
    if (joined) {
      dropBlessingMail();
      openTally(blessing.session(context.minutes));
    }
    return joined;
  },
  onStart: () => blessing.startTest(PLAYER, context.minutes),
});
try {
  blessing.resume(PLAYER, JSON.parse(localStorage.getItem(BLESSING_KEY) ?? 'null'), gameNow());
} catch {}
const everyone = [{ id: PLAYER, name: 'Bạn' }, ...town.all.map((member) => ({ id: member.id, name: member.name })), ...SHOPKEEPERS];
await economy.start({
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
  away: createAwaySim({ town, contextAt }),
  progress: (share) => loadingStep(0.82 + share * 0.08, 'Làng qua những ngày vắng'),
});
createRanking({ ledger, bank, estate, arena, people: everyone, now: gameNow });

let context = null;

function contextAt(minutes) {
  const minute = minuteOfDay(minutes);
  return {
    minutes,
    minute,
    day: dayOf(minutes),
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

function dropIntellect() {
  if (Math.random() >= CERTIFY.dropChance) return;
  purse.addIntellect(1);
  regen.intellect(1, player.position);
  uiSounds.correct();
}

function sideAsk(options, skipEmpty) {
  return kanjiQuiz.ask({ ...options, keys: certify.pool(PLAYER) }).then((result) => {
    if (result.empty) return skipEmpty ? { correct: true, entry: null, skipped: true } : result;
    if (result.entry && !result.cancelled) certify.markWeak(PLAYER, result.entry.key, result.correct);
    if (result.correct) dropIntellect();
    return result;
  });
}

const sideQuiz = (skipEmpty) => ({
  get open() {
    return kanjiQuiz.open;
  },
  ask: (options) => sideAsk(options, skipEmpty),
  cancel: () => kanjiQuiz.cancel(),
});
const workQuiz = sideQuiz(true);

const quiz = createQuiz({
  quiz: sideQuiz(false),
  onPass: () => {
    purse.earn(QUIZ.reward);
    regen.coin(QUIZ.reward, player.position);
  },
  onEmpty: () => sayPlayer('📖 Chưa có từ nào để ôn, hãy tới phòng tự học nhé!', 3),
  onVillagers: () => town?.quizRound(),
});
const fishing = createPlayerFishing({
  river,
  purse,
  angler,
  quiz: workQuiz,
  harvest: effects.harvest,
  player,
  say: (text, seconds) => sayPlayer(text, seconds),
  now: () => clock.elapsedTime,
  minutes: () => context.minutes,
});
const mountain = createMountain({
  nav: () => player.nav,
  stepSound,
  purse,
  quiz: workQuiz,
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

const studyMusic = new StudyMusic(['assets/music/study-1', 'assets/music/study-2']);
const exams = createExams({ quiz: kanjiQuiz, sounds: uiSounds });
const examHall = createExamHall({ purse, exams, mailbox, minutes: () => context.minutes, say: (text) => sayPlayer(text, 3), onRegister: (deck) => goExamSeat(deck) });
const endOfDay = () => (dayOf(context.minutes) + 1) * DAY_MINUTES;
const study = createStudy({
  purse,
  music: studyMusic,
  exams,
  onQualified(deck) {
    mailbox.removeTag(qualifyTag(deck));
    mailbox.notify({
      icon: '📝',
      lines: [`Bạn đã đậu thi nội bộ lớp ${DECKS[deck].label}, đủ điều kiện dự khảo thí hôm nay. Hãy tới Trường khảo thí (${hoursText({ open: CERTIFY.open, close: CERTIFY.close })}) gặp quan coi thi để đăng ký.`],
      place: 'Trường khảo thí',
      point: TEACHER_STAND,
      keep: true,
      expires: endOfDay(),
      tag: qualifyTag(deck),
    });
  },
  onSitOver() {
    const seat = player.seat;
    if (!seat?.study) return;
    playerSeats.rest(seat, 'player', clock.elapsedTime + CERTIFY.seatRest);
    player.standUp();
    sayPlayer(`Hết lượt ngồi. Sang ghế khác hoặc đợi ${Math.round(CERTIFY.seatRest / 60)} phút.`, 3);
  },
});
player.lookTarget = school.teacherHead;
player.onFacingTeacher = () => {
  if (player.seat?.study) study.open(player.seat.deck);
  if (player.seat?.internal) beginInternalExam();
  if (player.seat && player.seat === examTrip?.seat) beginExamSitting();
};
player.onStand = () => {
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
    catching: mode === 'play' && player.posture === 'free' && !player.lying && !purse.sleeping && !exams.running,
  });
  if (!caught) return;
  purse.add('firefly', caught);
  sayPlayer(`✨ ${purse.count('firefly')}`, 1.2);
}

const PLAYER_ATTEND = 2.5;
const listeners = new Set();

function attendPlayer(npc, busy = null) {
  npc.attend(player, busy ? null : PLAYER_ATTEND);
  if (busy) listeners.add({ npc, busy });
}

function updateListeners() {
  for (const entry of listeners) {
    if (entry.busy()) continue;
    entry.npc.release(player);
    listeners.delete(entry);
  }
}

const teacherDesk = {
  act() {
    if (exams.running) return null;
    if (!examOpen(context.minutes)) {
      attendPlayer(school.teacherAttention);
      return `Trường khảo thí mở cửa ${hoursText({ open: CERTIFY.open, close: CERTIFY.close })}, bạn quay lại sau nhé!`;
    }
    examHall.open();
    attendPlayer(school.teacherAttention, () => examHall.isOpen || exams.running);
    return null;
  },
};
const internalDialog = createInternalDialog();
const hallIntro = createHallIntro();
const examSitting = {
  get isOpen() {
    return internalDialog.isOpen || exams.running;
  },
};

const sitDim = document.getElementById('sitDim');
const SIT_DIM_MS = 1200;
let internalTrip = null;

function internalSeatFor(deck) {
  return internalSeats.nearestFree(player.position, 'player', (seat) => seat.deck === deck);
}

function internalReady(deck) {
  return exams.running || !!study.internalBlocker(deck) || !!internalSeatFor(deck);
}

function serveInternal(deck, teacher) {
  const seat = exams.running ? null : internalSeatFor(deck);
  const blocker = exams.running ? null : study.internalBlocker(deck);
  if (blocker) teacher.say(blocker, clock.elapsedTime);
  if (!seat || blocker) {
    teacher.attend(player, PLAYER_ATTEND);
    return;
  }
  teacher.attend(player);
  internalSeats.reserve(seat, 'player');
  internalDialog.ask(deck, {
    onAccept: () => {
      teacher.attend(player, PLAYER_ATTEND);
      leaveLine();
      internalTrip = { deck, teacher, seat, started: false };
      player.requestSeat(seat);
    },
    onCancel: () => {
      internalSeats.unreserve(seat, 'player');
      teacher.attend(player, PLAYER_ATTEND);
    },
  });
}

function updateInternalTrip() {
  const trip = internalTrip;
  if (!trip || trip.started) return;
  if (player.seat === trip.seat || player.pendingSeat === trip.seat) return;
  internalSeats.unreserve(trip.seat, 'player');
  internalTrip = null;
}

function beginInternalExam() {
  const trip = internalTrip;
  if (!trip || trip.started || player.seat !== trip.seat) return;
  trip.started = true;
  sitDim.classList.add('on');
  setTimeout(async () => {
    const line = player.seat === trip.seat ? await study.takeInternal(trip.deck) : null;
    sitDim.classList.remove('on');
    internalTrip = null;
    if (line) trip.teacher.say(line, clock.elapsedTime);
    if (player.seat === trip.seat) player.standUp();
  }, SIT_DIM_MS);
}

let examTrip = null;

function goExamSeat(deck) {
  if (examTrip && !examTrip.started) seats.unreserve(examTrip.seat, 'player');
  examTrip = null;
  const seat = seats.nearestFree(player.position, 'player');
  if (!seat) {
    sayPlayer('Hết ghế trống rồi, đợi chút nhé.', 2.4);
    return;
  }
  seats.reserve(seat, 'player');
  examTrip = { deck, seat, started: false };
  player.requestSeat(seat);
}

function updateExamTrip() {
  const trip = examTrip;
  if (!trip || trip.started) return;
  if (player.posture === 'standing' || player.pendingAction) return;
  if (player.seat === trip.seat || player.pendingSeat === trip.seat) return;
  seats.unreserve(trip.seat, 'player');
  examTrip = null;
}

function beginExamSitting() {
  const trip = examTrip;
  if (!trip || trip.started || player.seat !== trip.seat) return;
  trip.started = true;
  sitDim.classList.add('on');
  setTimeout(async () => {
    if (player.seat === trip.seat) await examHall.sit(trip.deck);
    sitDim.classList.remove('on');
    examTrip = null;
    if (player.seat === trip.seat) player.standUp();
  }, SIT_DIM_MS);
}
const TEACHER_MENU = [
  { id: 'book', name: 'Đặt chỗ', icon: '🪑', art: 'scroll' },
  { id: 'internal', name: 'Kiểm tra nội bộ', icon: '📝', art: 'scroll' },
  { id: 'about', name: 'Giới thiệu', icon: '❓', art: 'question' },
];
const BOOK_REACH = 1.2;
const BOOK_RETRIES = 3;
let booking = null;

function endBooking() {
  if (!booking) return;
  seatWait.leave('player');
  if (booking.seat && player.seat !== booking.seat) studySeats.unreserve(booking.seat, 'player');
  booking = null;
  bookIconOn = false;
}

function takeBookedSeat(seat) {
  if (!booking) {
    studySeats.unreserve(seat, 'player');
    return;
  }
  booking.seat = seat;
  player.requestSeat(seat);
}

function bookSeat(deck, teacher) {
  leaveLine();
  if (booking?.deck === deck && !booking.seat) {
    booking.retries = 0;
    player.requestMove(booking.target, false);
    return;
  }
  endBooking();
  const spot = seatWait.join(deck, 'player', { ready: () => true, take: takeBookedSeat });
  if (!spot) {
    teacher.say('Chỗ chờ kín rồi con.', clock.elapsedTime);
    return;
  }
  booking = { deck, target: spot.clone(), seat: null, retries: 0, settled: false };
  bookIconOn = true;
  player.requestMove(booking.target, false);
  seatWait.update(clock.elapsedTime);
}

function updateBookIcon() {
  bookTurn = bookIconOn ? seatWait.turnOf('player') || bookTurn || 1 : 0;
  playerBubble.setTurn(bookTurn || null);
}

function updateBooking() {
  const b = booking;
  if (!b) return;
  if (player.lying || player.posture === 'standing' || player.pendingAction) return;
  if (b.seat) {
    if (player.seat === b.seat) {
      booking = null;
      bookIconOn = false;
    } else if (player.pendingSeat !== b.seat) endBooking();
    return;
  }
  if (player.posture !== 'free' || player.destination !== b.target) {
    endBooking();
    return;
  }
  if (player.path) return;
  if (Math.hypot(b.target.x - player.position.x, b.target.z - player.position.z) > BOOK_REACH) {
    if (b.retries++ >= BOOK_RETRIES) endBooking();
    else player.requestMove(b.target, false);
    return;
  }
  if (b.settled) return;
  b.settled = true;
  const look = seatWait.look(b.deck);
  if (look) player.faceToward(look.x, look.z);
}

const noticeSpot = {
  act() {
    scheduleBoard.open();
    return null;
  },
};
const lodgeDesk = createLodgeDesk({ purse, onRent: (id) => sleepAtLodge(id) });

const blessingAltar = {
  act() {
    blessingDialog.openStatue(PLAYER);
    return null;
  },
};

const blessingDesk = {
  act() {
    blessingDialog.open(PLAYER);
    attendPlayer(blessing.official, () => blessingDialog.isOpen);
    return null;
  },
};

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

function joinLine(kind, open, dialog, ready = null) {
  const queue = town.queues[kind];
  if (playerLine?.queue === queue) {
    if (playerLine.joined) stepInLine();
    else approachLine();
    return;
  }
  leaveLine();
  playerLine = { queue, open, dialog, ready, index: -1, joined: false, served: false, retries: 0, retryAt: 0 };
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
  if (line.ready && !line.ready()) return;
  line.served = true;
  line.open();
}

function goDo(region, target, id) {
  fieldTask = { region, target, action: { id }, choice: null };
  player.requestMove(new THREE.Vector3(target.stand.x, 0, target.stand.z), false);
}

function clickTargets() {
  return [...scenery.clickables, ...regions.clickables, ...town.clickables, ...notice.clickables, ...atms.clickables, school.root, ...studyHalls.flatMap((hall) => [hall.group, hall.teacher.group]), ...blessing.clickables, inn.group];
}

function sceneClick(clientX, clientY, run) {
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const targets = clickTargets();
  if (roof.visible) targets.push(roof);
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return false;
  player.getUp();
  stopWork();
  const queueing = playerLine;
  const villager = town.villagerAt(hit.object);
  if (villager === town.vendor) {
    leaveLine();
    visitVendor();
    return true;
  }
  if (villager) {
    villager.greet(player.position);
    return true;
  }
  if (school.isTeacher(hit.object)) {
    leaveLine();
    goDo(teacherDesk, { stand: TEACHER_STAND, x: CX, z: TEACHER_Z }, 'teacher');
    return true;
  }
  const classroom = studyHalls.findIndex((hall) => hall.teacher.owns(hit.object));
  if (classroom >= 0) {
    const { deck } = STUDY_HALLS[classroom];
    const { teacher } = studyHalls[classroom];
    picker.open({ title: `Lớp ${DECKS[deck].label}`, options: TEACHER_MENU, x: clientX, y: clientY, menu: true }, (option) => {
      if (option.id === 'about') {
        hallIntro.open(deck);
        return;
      }
      if (option.id === 'book') {
        bookSeat(deck, teacher);
        return;
      }
      endBooking();
      joinLine(`teacher:${deck}`, () => serveInternal(deck, teacher), examSitting, () => internalReady(deck));
    });
    return true;
  }
  if (blessing.ownsStatue(hit.object)) {
    leaveLine();
    if (blessing.onPlaza(player.position)) blessingDialog.openStatue(PLAYER);
    else goDo(blessingAltar, { stand: blessing.altar, x: blessing.statueAt.x, z: blessing.statueAt.z }, 'altar');
    return true;
  }
  if (blessing.official.owns(hit.object)) {
    leaveLine();
    goDo(blessingDesk, { stand: blessing.official.stand, x: blessing.official.at.x, z: blessing.official.at.z }, 'blessing');
    return true;
  }
  if (inn.owns(hit.object)) {
    leaveLine();
    goDo(innDesk, { stand: INN_STAND, x: INN_DOOR.x, z: INN_DOOR.z }, 'inn');
    return true;
  }
  if (notice.owns(hit.object)) {
    leaveLine();
    goDo(noticeSpot, { stand: notice.stand, x: notice.group.position.x, z: notice.group.position.z }, 'notice');
    return true;
  }
  const atm = atms.atmOf(hit.object);
  if (atm) {
    joinLine(`atm:${atm.id}`, () => atmUI.open(atm), atmUI);
    return true;
  }
  const region = regions.regionOf(hit.object) ?? regions.active;
  if (region?.interact?.(hit.object, player.position)) {
    leaveLine();
    return true;
  }
  const target = region?.target?.(hit, player.position);
  const blank = target ? null : region?.blankTap?.(hit);
  if (blank) {
    if (queueing) leaveLine();
    sayPlayer(blank, 1.8);
    return false;
  }
  const kind = target?.kind;
  const venue = VENUES[kind];
  if (target && venue && town.queues[kind]) {
    if (!venue.isOpen(gameNow())) {
      leaveLine();
      sayPlayer(region.act('visit', target), 2.4);
      return true;
    }
    joinLine(
      kind,
      () => {
        const reply = region.act('visit', target);
        if (reply) sayPlayer(reply, 2.4);
      },
      venue.ui,
    );
    return true;
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
    return true;
  }
  const point = hit.point.clone();
  if (hit.face) {
    normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    point.addScaledVector(normal, 0.3);
  }
  const seat = playerSeats.at(hit.point);
  if (seat && !seat.internal && playerSeats.canTake(seat, 'player')) {
    if (seat.study && player.seat !== seat && !seatWait.openTo(seat, 'player', clock.elapsedTime)) {
      sayPlayer('Ghế này đã có người đặt.', 2.4);
      return false;
    }
    const rest = playerSeats.restLeft(seat, 'player', clock.elapsedTime);
    if (rest > 0 && player.seat !== seat) {
      sayPlayer(`Ghế này phải đợi ${Math.ceil(rest / 60)} phút nữa.`, 2.4);
      return false;
    }
    player.requestSeat(seat, run);
    return true;
  }
  player.requestMove(point, run);
  return false;
}

player.onClick = (clientX, clientY, run) => {
  if (sceneClick(clientX, clientY, run)) uiSounds.click();
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

const scheduleBoard = createScheduleBoard({ sky, context: () => context });

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

const blessingReminded = new Set();
let blessingMail = null;
let blessingMailKey = null;
function dropBlessingMail() {
  if (blessingMail !== null) mailbox.remove(blessingMail);
  blessingMail = null;
  blessingMailKey = null;
}

const broadcast = createBroadcast();
let blessingAnnounced;
function announceBlessing() {
  const session = blessing.session(context.minutes);
  if (blessingAnnounced === undefined) blessingAnnounced = session;
  if (!session || session === blessingAnnounced) return;
  blessingAnnounced = session;
  broadcast.show('Sự kiện chúc phúc đã bắt đầu! Hãy tới quảng trường chúc phúc để nhận chúc phúc.');
}

function remindBlessing() {
  const next = blessing.upcoming(context.minutes, BLESSING.remindBefore);
  if (blessingMailKey && next?.key !== blessingMailKey && blessing.session(context.minutes) !== blessingMailKey) dropBlessingMail();
  if (!next || blessingReminded.has(next.key)) return;
  blessingReminded.add(next.key);
  blessingMailKey = next.key;
  blessingMail = mailbox.notify({
    icon: '✨',
    lines: [`Giờ chúc phúc ${next.hours} sắp bắt đầu. Bạn hãy tới sân tượng gặp quan để tham gia nhận chúc phúc.`],
    place: 'Sân chúc phúc · Xóm Văn Miếu',
    point: blessing.official.stand,
  });
}

let blessingQuizIn = BLESSING.firstQuiz;
function updateBlessingQuiz(dt) {
  if (mode !== 'play' || purse.sleeping || !blessing.blessed(PLAYER, player.position, context.minutes) || !blessing.testing(PLAYER, context.minutes)) {
    blessingQuizIn = BLESSING.firstQuiz;
    return;
  }
  if (kanjiQuiz.open || quiz.open || fishing.active || exams.running || popupOpen()) return;
  blessingQuizIn -= dt;
  if (blessingQuizIn > 0) return;
  blessingQuizIn = BLESSING.quizSeconds;
  const keys = certify.pool(PLAYER);
  if (!keys.length) return;
  const session = blessing.session(context.minutes);
  const correct = blessingTally?.session === session ? blessingTally.correct : 0;
  kanjiQuiz.ask({ keys, icon: '✨', note: `✅ ${correct}`, quick: true, brief: true, closeAfter: BLESSING.quizCloseMs, choices: 3, kind: Math.random() < 0.5 ? 'reading' : 'meaning', onAnswer: (correct) => (correct ? uiSounds.correct() : uiSounds.wrong()) }).then((result) => {
    if (result.entry && !result.cancelled) certify.markWeak(PLAYER, result.entry.key, result.correct);
    if (result.correct && session) tallyBlessing(session);
  });
}

const TALLY_KEY = 'langsch.blessingTally';
function loadTally() {
  try {
    const saved = JSON.parse(localStorage.getItem(TALLY_KEY) ?? 'null');
    if (saved && typeof saved.session === 'string' && Number.isFinite(saved.correct)) return saved;
  } catch {}
  return null;
}
let blessingTally = loadTally();
function saveTally() {
  try {
    if (blessingTally) writeGameItem(TALLY_KEY, JSON.stringify(blessingTally));
    else removeGameItem(TALLY_KEY);
  } catch {}
}
function openTally(session) {
  if (!session || blessingTally?.session === session) return;
  settleBlessing();
  blessingTally = { session, correct: 0 };
  saveTally();
}
function tallyBlessing(session) {
  openTally(session);
  blessingTally.correct += 1;
  saveTally();
}
function settleBlessing() {
  if (!blessingTally) return;
  const { correct } = blessingTally;
  blessingTally = null;
  saveTally();
  const money = Math.floor(correct / CERTIFY.blessingCoinPer);
  const intellect = Math.floor(correct / CERTIFY.blessingIntellectPer);
  const lines = [`Buổi chúc phúc đã kết thúc. Bạn trả lời đúng ${correct} câu.`];
  if (!money && !intellect) lines.push('Chưa đủ số câu đúng để nhận thưởng, lần sau cố gắng hơn nhé!');
  mailbox.notify({
    icon: '✨',
    lines,
    keep: true,
    expires: endOfDay(),
    attach: money || intellect ? { money, intellect } : null,
  });
}
function updateBlessingRewards() {
  if (blessingTally && blessing.session(context.minutes) !== blessingTally.session) settleBlessing();
}

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
  const resting = lodging || homeActivity(estate.houseOf(PLAYER));
  const lying = nearShelter(player.position.x, player.position.z) ? 'shelter' : inStudyRoom(player.position) ? 'studyRest' : 'rest';
  const studying = !!player.seat?.study;
  const activity = asleep ? resting : player.resting ? lying : player.posture === 'seated' ? (studying ? (lampLit() ? 'lampStudy' : 'study') : 'seated') : moving;
  const offline = asleep ? lodging || 'idle' : player.resting ? lying : 'idle';
  purse.liveEnergy(context.minutes, activity, asleep ? resting : offline, offline, blessing.recoveryAt(PLAYER, player.position, context.minutes));
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
renderer.setAnimationLoop((time) => {
  const busy = !!player.path || Math.hypot(player.velocity.x, player.velocity.z) > 0.2 || player.lying || !!effectTask || fishing.active;
  if (busy) lastInput = performance.now();
  const idle = performance.now() - lastInput > IDLE_AFTER;
  const watching = scenePopupOpen();
  const popup = !watching && popupOpen();
  if (popup && performance.now() - lastScroll < SCROLL_PAUSE) return;
  const reading = study.visible;
  const resting = reading || idle;
  const still = resting && !town.anyMoving() && !mountain.moving();
  const frameRate = purse.sleeping
    ? SLEEP_FRAME_RATE
    : study.focused
      ? STUDY_FRAME_RATE
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
  const night = sky.update(context.minutes, camera, mode === 'overview' ? orbit.target : player.position, SHADOW_SPAN);
  tuning.refreshShadows(t);
  if (Math.abs(night - shownNight) > 0.01) {
    shownNight = night;
    school.setNight(night);
    for (const hall of studyHalls) hall.setNight(night);
    inn.setNight(night);
    village.setNight(night);
    river.setNight(night);
    streetLamps.setNight(night);
  }
  notice.refresh(context.day);
  dust.update(t);
  stepSound.listen(camera);
  riverAmbience.update(dt);
  playerStudyIcon.visible = !!player.seat?.study && study.focused;
  mailbox.tick();
  scheduleBoard.refresh();
  refreshRest();
  if (farm.tick()) mailbox.sync(farm.chores(PLAYER, player.position));
  cullRooms();
  const simSpan = Math.min(elapsed, SIM_SPAN);
  const simSteps = Math.max(1, Math.ceil(simSpan / MAX_STEP));
  if (!economy.catching) {
    for (let i = 0; i < simSteps; i++) town.update(t, simSpan / simSteps, context, player, camera, i === simSteps - 1);
    updateArena(dt);
  }
  if (shopUI.isOpen && !context.shopOpen) {
    shopUI.close();
    sayPlayer(`Tiệm đóng cửa rồi, mở ${shopHours()} nhé!`, 2.4);
  }
  if (fishShopUI.isOpen && !context.fishOpen) {
    fishShopUI.close();
    sayPlayer(`Hàng cá đóng cửa rồi, mở ${fishShopHours()} nhé!`, 2.4);
  }
  if (!economy.catching) {
    bank.tick(context.minutes);
    bank.mature();
  }
  if (bankUI.isOpen && !context.bankOpen) {
    bankUI.close();
    sayPlayer(`Ngân hàng đóng cửa rồi, mở ${bankHours()} nhé!`, 2.4);
  }
  district.update(t, context, camera);
  updateLine();
  updateInternalTrip();
  updateExamTrip();
  seatWait.update(t);
  updateBooking();
  updateBookIcon();
  updateListeners();
  school.update(t);
  for (const hall of studyHalls) hall.update(t, camera);
  inn.update(t);
  village.update(t, context, camera);
  streetLamps.update(t);
  river.update(dt, context.minutes);
  clouds.update(dt, night);
  player.held = kanjiQuiz.open || arenaTrip.fighting;
  player.update(dt);
  arenaDuel.frame(camera);
  placeBubble();
  updateBubbles(camera, t);
  regen.update(dt, t, player.position, player.restAmount, player.resting, context.minutes);
  for (const effect of Object.values(effects)) effect.update(dt);
  fishing.update();
  countryside.update(context.day);
  mountain.update(dt, { camera, night, rest: context.night, canHit: mode === 'play' && player.posture === 'free' && !player.lying && !kanjiQuiz.open && !purse.sleeping });
  angler.update(dt);
  const focus = mode === 'overview' ? orbit.target : player.position;
  regions.update(t, dt, focus);
  updateSoundscape(focus);
  quiz.update(dt, hasEntered() && !updateOffered() && regions.active?.id !== 'school' && !arenaTrip.here && !fishing.active && !exams.running && !study.focused);
  blessing.update(dt, context.minutes, camera, night);
  updateBlessingQuiz(dt);
  updateBlessingRewards();
  remindBlessing();
  announceBlessing();
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
  marker.update(t);
  if (!study.dimmed) renderer.render(scene, camera);
  if (framesShown < 2 && ++framesShown === 2) loadingDone();
});
