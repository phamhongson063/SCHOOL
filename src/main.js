import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelWorld } from './world.js';
import { buildWorld, populate, stairHeight, CX, TEACHER_STAND, TEACHER_Z } from './school.js';
import { createScenery } from './scenery.js';
import { createPlayer, createStudent } from './characters.js';
import { Seats } from './seats.js';
import { createLesson } from './lesson.js';
import { LESSONS } from './lessons.js';
import { PlayerController, WALK_SPEED, RUN_SPEED } from './walk.js';
import { NavGrid } from './nav.js';
import { createSky, createClouds } from './sky.js';
import { Footprints, createBlobShadow } from './groundfx.js';
import { RegionManager } from './regions.js';
import { createPicker } from './picker.js';
import { CURSORS } from './cursors.js';
import { createWatering } from './watering.js';
import { createHarvesting } from './harvesting.js';
import { createClearing } from './clearing.js';
import { createQuiz } from './quiz.js';
import { createFarm } from './farm.js';
import { createRoad, SPAWN } from './road.js';
import { createBubble } from './bubble.js';
import { Ledger, PLAYER } from './inventory.js';
import { createBag } from './bag.js';
import { LOW_POWER } from './quality.js';
import { outlineMaterial, freeze } from './toon.js';
import { gameNow, dayOf, minuteOfDay, clockText, durationText } from './clock.js';
import { phaseAt, sessionLabel } from './timetable.js';
import { ROUTINE, SCHOOL, MONEY, ENERGY, WORLD, LODGING } from './config.js';
import { createMarket, createShopUI, shopOpen, shopHours } from './market.js';
import { createEstate, createChiefUI, chiefOpen, chiefHours } from './estate.js';
import { createTuition } from './tuition.js';
import { Town, createStudyIcon, villagerProfiles } from './villagers.js';
import { createVillage } from './village.js';
import { createNoticeBoard } from './notice.js';
import { createSettings, wipeGame } from './settings.js';
import { createRiver } from './river.js';
import { createAngler } from './angler.js';
import { createKanjiQuiz } from './kanjiQuiz.js';
import { createPlayerFishing } from './fishing.js';
import { createVitals } from './vitals.js';
import { buildStudyHall, createStudyHall } from './studyHall.js';
import { createInn, INN_STAND, INN_DOOR } from './inn.js';
import { createStudy } from './study.js';
import { activityOf } from './stamina.js';
import { createFoodUI, eateryOpen, eateryHours } from './eatery.js';
import { loadingStep, loadingDone } from './loading.js';
import { createRegen } from './regen.js';
import { loadItemImages } from './itemArt.js';

const FRAME_RATE = LOW_POWER ? 30 : 60;
const IDLE_FRAME_RATE = LOW_POWER ? 20 : 30;
const READING_FRAME_RATE = 20;
const POPUP_FRAME_RATE = 15;
const IDLE_AFTER = 20000;
const MAX_PIXEL_RATIO = Math.min(window.devicePixelRatio, LOW_POWER ? 1.25 : 1.5);
const MIN_PIXEL_RATIO = 0.75;
const SHADOW_SPAN = LOW_POWER ? 30 : 45;
const OUTLINE_DISTANCE = 26;
const NAV_BOUNDS = { x0: WORLD.x0, x1: WORLD.x1, z0: -68, z1: 84 };

let pixelRatio = MAX_PIXEL_RATIO;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOW_POWER ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

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
const school = populate(scene);
const clouds = createClouds(scene);
const notice = createNoticeBoard(scene);
const village = createVillage();
const river = createRiver();
const studyHall = createStudyHall(scene);
const inn = createInn(scene);
school.obstacles.push(...notice.obstacles, ...village.obstacles, ...river.obstacles, ...studyHall.obstacles, ...inn.obstacles);

await loadingStep(0.62, 'Gieo mạ, mở chợ');
const avatar = createPlayer();
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
player.surfaceAt = stairHeight;

const ledger = new Ledger();
const purse = ledger.purse(PLAYER);
createBag(purse);
createVitals(purse);
const market = createMarket();
const shopUI = createShopUI({ market, purse });
const estate = createEstate({ houses: village.houses });
let town = null;
const NAMES = new Map(villagerProfiles().map((profile) => [profile.id, profile.name]));
const nameOf = (id) => (id === PLAYER ? 'bạn' : NAMES.get(id) ?? 'người khác');
const chiefUI = createChiefUI({ estate, purse, nameOf });
const foodUI = createFoodUI({ purse });

createSettings({
  onReset() {
    renderer.setAnimationLoop(null);
    ledger.halt();
    wipeGame();
    window.location.reload();
  },
});

const regions = new RegionManager({ scene, obstacles: school.obstacles });
regions.add({
  id: 'school',
  name: 'Trường làng',
  bounds: { x0: -28, z0: -59, x1: 29, z1: 33 },
  pinned: true,
  overview: { position: new THREE.Vector3(CX + 60, 70, 20), target: new THREE.Vector3(CX, 0, -7) },
});
regions.add(createRoad());
const farm = createFarm({ ledger, nameOf, nav: () => player.nav });
regions.add(farm);
for (const region of village.regions({
    estate,
    nameOf,
    openShop: () => shopUI.open(),
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
  })) {
  regions.add(region);
}
regions.add(
  river.region({
    player,
    day: () => context.day,
    startFishing: (spot) => fishing.start(spot),
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
player.nav = new NavGrid(world, (p) => player.collides(p), NAV_BOUNDS, { surfaceAt: stairHeight });
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
let hoverRegion = null;
regions.onChange = (region) => {
  for (const control of regionControls) control.hidden = control.dataset.region !== region?.id;
  hoverRegion?.highlight?.(null);
  hoverRegion = null;
  hoverTip.hidden = true;
  picker.close();
};

const playerBubble = createBubble();
playerBubble.sprite.position.set(0, 1.95, 0);
avatar.group.add(playerBubble.sprite);
const sayPlayer = (text, seconds = 2.2) => playerBubble.show(text, seconds, clock.elapsedTime);
const BUBBLE_STAND = new THREE.Vector3(0, 1.95, 0);
const BUBBLE_LYING = new THREE.Vector3(0, 1.15, -1.1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
function placeBubble() {
  const k = player.restAmount;
  const anchor = playerBubble.sprite.position.lerpVectors(BUBBLE_STAND, BUBBLE_LYING, k);
  if (k > 0) anchor.applyAxisAngle(X_AXIS, -avatar.group.rotation.x);
}

const quiz = createQuiz({ onPass: () => sayPlayer('🎉 Đúng rồi! Chơi tiếp nào!') });

const effects = {
  water: createWatering(scene, avatar),
  harvest: createHarvesting(scene, avatar),
  clear: createClearing(scene, avatar),
};
const regen = createRegen({ scene, camera, purse });
const busyEffect = () => Object.values(effects).find((effect) => effect.busy);
let effectTask = null;

let fieldTask = null;
player.onArrive = () => {
  const task = fieldTask;
  fieldTask = null;
  if (!task || Math.hypot(task.target.stand.x - player.position.x, task.target.stand.z - player.position.z) > 0.8) return;
  player.faceToward(task.target.x, task.target.z);
  const cost = task.region.id === 'farm' ? ENERGY.costs[task.action.id] ?? 0 : 0;
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
if (savedClear) player.place(new THREE.Vector3(savedPlace.x, savedY, savedPlace.z), savedPlace.yaw);
else player.place(new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z), 0);

function savePlace() {
  const at = player.posture === 'free' || !player.seat ? player.position : player.seat.spot;
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify({ x: at.x, z: at.z, yaw: player.yaw }));
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
player.onTarget = (point) => {
  marker.visible = !!point;
  if (point) marker.position.set(point.x, point.y + 0.03, point.z);
};

await loadingStep(0.82, 'Gọi dân làng');
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const normal = new THREE.Vector3();
const seats = new Seats(school.seats);
const playerSeats = new Seats([...school.seats, ...studyHall.seats]);
const seatedAvatar = createStudent({ shirt: 0x3b6fb0, pants: 0xf4efe2, skin: 0xf6caa4, style: 'player', iris: 0x7a4422 });
const playerStudyIcon = createStudyIcon();
playerStudyIcon.position.set(0, 1.3, 0);
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
  school,
  farm: farm.crew,
  ledger,
  market,
  estate,
  places: village.places,
  river,
  footprints,
});

player.avoid = (position, dirX, dirZ, remaining) => town.playerAvoidance(position, dirX, dirZ, remaining);

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
    chiefOpen: chiefOpen(minutes),
  };
}
context = contextAt(gameNow());

const angler = createAngler(scene, avatar);
const kanjiQuiz = createKanjiQuiz();
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
let lastDay = context.day;
if (ledger.spoilFish(context.day).includes(PLAYER)) setTimeout(() => sayPlayer('Cá để lâu ươn hết rồi, đành bỏ đi...', 3), 1500);

const lesson = createLesson();
const study = createStudy();
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

const teacherDesk = {
  act() {
    if (!school.teacherPresent) return 'Thầy về nhà rồi, mai quay lại nhé!';
    tuition.openTeacher();
    return null;
  },
};
const noticeSpot = {
  act() {
    openSchedule();
    return null;
  },
};
const innDesk = {
  act() {
    if (purse.energy >= ENERGY.max - 0.5) return 'Còn khoẻ lắm, chưa cần nghỉ!';
    if (!purse.spend(LODGING.price)) return `Không đủ tiền! Cần ${LODGING.price} ${MONEY.icon}.`;
    sleepAtInn();
    return null;
  },
};

let playerLine = null;

function stepInLine() {
  const index = playerLine.queue.indexOf(player);
  playerLine.index = index;
  const spot = playerLine.queue.slot(index);
  player.requestMove(new THREE.Vector3(spot.x, 0, spot.z), false);
}

function leaveLine() {
  if (!playerLine) return;
  playerLine.queue.leave(player);
  playerLine = null;
}

function joinLine(kind, open, dialog) {
  const queue = town.queues[kind];
  if (playerLine?.queue === queue) {
    stepInLine();
    return;
  }
  leaveLine();
  queue.join(player);
  playerLine = { queue, open, dialog, index: -1, served: false, retries: 0 };
  stepInLine();
}

function updateLine() {
  const line = playerLine;
  if (!line) return;
  if (line.served) {
    if (!line.dialog.isOpen) leaveLine();
    return;
  }
  const index = line.queue.indexOf(player);
  if (index !== line.index) {
    stepInLine();
    return;
  }
  if (player.path || player.posture !== 'free' || player.lying) return;
  const spot = line.queue.slot(index);
  if (Math.hypot(spot.x - player.position.x, spot.z - player.position.z) > 1.5) {
    if (line.retries++ < 3) stepInLine();
    else leaveLine();
    return;
  }
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

player.onClick = (clientX, clientY, run) => {
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const targets = [...scenery.clickables, ...regions.clickables, ...town.clickables, ...notice.clickables, school.root, studyHall.group, inn.group];
  if (roof.visible) targets.push(roof);
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return;
  player.getUp();
  stopWork();
  const queueing = playerLine;
  const villager = town.villagerAt(hit.object);
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
  const region = regions.regionOf(hit.object) ?? regions.active;
  if (region?.interact?.(hit.object, player.position)) {
    leaveLine();
    return;
  }
  const target = region?.target?.(hit, player.position);
  const kind = target?.kind;
  if (target && town.queues[kind]) {
    const now = gameNow();
    const open = kind === 'shop' ? shopOpen(now) : kind === 'chief' ? chiefOpen(now) : eateryOpen(now);
    if (!open) {
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
      kind === 'shop' ? shopUI : kind === 'chief' ? chiefUI : foodUI,
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

const hoverPointer = new THREE.Vector2();
const hoverTip = document.getElementById('hoverTip');
let hovering = false;
renderer.domElement.addEventListener('pointermove', (event) => {
  hovering = event.pointerType === 'mouse';
  hoverPointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
});

const tipAnchor = new THREE.Vector3();
function showHoverTip(text, anchor) {
  let visible = !!text && !!anchor;
  if (visible) visible = tipAnchor.copy(anchor).project(camera).z < 1;
  hoverTip.hidden = !visible;
  if (!visible) return;
  if (hoverTip.textContent !== text) hoverTip.textContent = text;
  const { width, height } = hoverTip.getBoundingClientRect();
  const x = ((tipAnchor.x + 1) / 2) * window.innerWidth - width / 2;
  const y = ((1 - tipAnchor.y) / 2) * window.innerHeight - height;
  hoverTip.style.transform = `translate(${x}px, ${y}px)`;
}
renderer.domElement.addEventListener('pointerleave', () => {
  hovering = false;
});

const HOVER_INTERVAL = 0.1;
let hoverAt = 0;
let hoverText = null;
let hoverAnchor = null;

function updateHover(t) {
  if (player.drag) {
    hoverTip.hidden = true;
    return;
  }
  if (t < hoverAt) {
    showHoverTip(hoverText, hoverAnchor);
    return;
  }
  hoverAt = t + HOVER_INTERVAL;
  let region = null;
  let target = null;
  if (hovering && mode === 'play') {
    raycaster.setFromCamera(hoverPointer, camera);
    const hit = raycaster.intersectObjects(regions.clickables, true)[0];
    if (hit) {
      region = regions.regionOf(hit.object);
      if (region?.target) target = region.target(hit, player.position);
    }
  }
  if (hoverRegion && hoverRegion !== region) hoverRegion.highlight?.(null);
  if (!target && !hoverRegion) {
    hoverText = null;
    hoverAnchor = null;
    renderer.domElement.style.cursor = '';
    return;
  }
  region?.highlight?.(target);
  hoverRegion = target ? region : null;
  const working = target && effectTask?.region === region && effectTask.target.index === target.index;
  const hint = target && !working ? region.actionFor(target).hint : null;
  renderer.domElement.style.cursor = hint ? CURSORS[hint] : '';
  const label = target ? region.labelOf?.(target) : null;
  const left = target && !label ? region.timeLeft?.(target) : null;
  hoverText = label ?? (left == null ? null : durationText(left));
  hoverAnchor = hoverText == null ? null : region.topOf(target);
  showHoverTip(hoverText, hoverAnchor);
}

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.48;
orbit.minDistance = 2;
orbit.maxDistance = 90;
orbit.enabled = false;
function overviewFor(region) {
  if (region?.overview) return region.overview;
  const target = player.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  const back = camera.position.clone().sub(player.position).setY(0);
  if (back.lengthSq() < 1e-6) back.set(0, 0, 1);
  back.normalize();
  return { target, position: target.clone().addScaledVector(back, 20).add(new THREE.Vector3(0, 12, 0)) };
}

const ui = {
  viewBtn: document.getElementById('viewBtn'),
  modeBtn: document.getElementById('modeBtn'),
};


let mode = 'play';

function setLabel(button, text) {
  button.title = text;
  button.setAttribute('aria-label', text);
}

function refreshUI() {
  frameCamera();
  ui.viewBtn.classList.toggle('active', player.firstPerson);
  ui.viewBtn.disabled = mode !== 'play';
  setLabel(ui.viewBtn, player.firstPerson ? 'Chuyển sang góc nhìn thứ ba' : 'Chuyển sang góc nhìn thứ nhất');
  ui.modeBtn.classList.toggle('active', mode === 'overview');
  setLabel(ui.modeBtn, mode === 'overview' ? 'Quay lại nhập vai' : 'Xem toàn cảnh');
}

const mapTap = { id: null, x: 0, y: 0, at: 0 };
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode !== 'overview' || e.button !== 0) return;
  Object.assign(mapTap, { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now() });
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (mode !== 'overview' || e.pointerId !== mapTap.id) return;
  mapTap.id = null;
  if (Math.hypot(e.clientX - mapTap.x, e.clientY - mapTap.y) > 8 || performance.now() - mapTap.at > 500) return;
  setMode('play');
  player.onClick?.(e.clientX, e.clientY, false);
});

function setMode(next) {
  if (next === mode) return;
  mode = next;
  if (mode === 'overview') {
    const view = overviewFor(regions.active);
    player.setEnabled(false);
    camera.position.copy(view.position);
    orbit.target.copy(view.target);
    orbit.enabled = true;
    orbit.update();
  } else {
    orbit.enabled = false;
    player.setEnabled(true);
  }
  refreshUI();
}

ui.viewBtn.addEventListener('click', () => {
  player.setFirstPerson(!player.firstPerson);
  refreshUI();
});
ui.modeBtn.addEventListener('click', () => setMode(mode === 'play' ? 'overview' : 'play'));

const restBtn = document.getElementById('restBtn');
let restShown = '';
function refreshRest() {
  const lying = player.resting;
  const usable = lying || (mode === 'play' && player.posture === 'free' && !purse.sleeping);
  const key = `${lying}|${usable}`;
  if (key === restShown) return;
  restShown = key;
  restBtn.disabled = !usable;
  restBtn.setAttribute('aria-pressed', String(lying));
  setLabel(restBtn, lying ? 'Đứng dậy' : 'Nằm nghỉ');
}
restBtn.addEventListener('click', () => {
  if (player.resting) player.getUp();
  else {
    leaveLine();
    stopWork();
    player.lieDown();
  }
  refreshRest();
});

for (const button of [ui.viewBtn, ui.modeBtn, restBtn]) {
  button.addEventListener('pointerup', () => button.blur());
}

const phaseUI = {
  pill: document.getElementById('phasePill'),
  bell: document.getElementById('phaseBell'),
  clock: document.getElementById('phaseClock'),
  icon: document.getElementById('phaseIcon'),
  time: document.getElementById('phaseTime'),
  dialog: document.getElementById('scheduleDialog'),
  form: document.getElementById('scheduleForm'),
  dayClock: document.getElementById('scheduleClock'),
  list: document.getElementById('scheduleList'),
  hint: document.getElementById('scheduleHint'),
  cancel: document.getElementById('cancelBtn'),
  close: document.getElementById('scheduleClose'),
  modes: [...document.querySelectorAll('.mode-option')],
};

const lessonChoice = document.getElementById('lessonChoice');
const lessonSelect = document.getElementById('lessonSelect');
lessonSelect.replaceChildren(
  ...LESSONS.map((item) => {
    const phrase = item.phrase.replace(/\{[^}]*\}/g, '').replace(/[[\]]/g, '');
    return new Option(`Bài ${item.no} · ${phrase} (${item.romaji})`, String(item.no));
  }),
);

let pendingMode = lesson.mode;
function showMode(next) {
  pendingMode = next;
  for (const option of phaseUI.modes) option.setAttribute('aria-checked', String(option.dataset.mode === next));
  lessonChoice.hidden = next !== 'choose';
}
for (const option of phaseUI.modes) option.addEventListener('click', () => showMode(option.dataset.mode));

const MOONS = [
  [0.03, '🌑 Trăng non'],
  [0.22, '🌒 Trăng lưỡi liềm'],
  [0.28, '🌓 Trăng thượng huyền'],
  [0.47, '🌔 Trăng gần rằm'],
  [0.53, '🌕 Trăng rằm'],
  [0.72, '🌖 Trăng khuyết dần'],
  [0.78, '🌗 Trăng hạ huyền'],
  [0.97, '🌘 Trăng lưỡi liềm cuối'],
  [1.01, '🌑 Trăng non'],
];
const moonName = (phase) => MOONS.find(([max]) => phase <= max)[1];
const minutesLeft = (m) => `${Math.max(1, Math.ceil(m))}'`;

function phaseStatus(ctx) {
  const phase = ctx.phase;
  if (phase.kind === 'period') {
    if (phase.paying) return { icon: '🪙', text: `Tiết ${phase.period} · thu học phí`, tone: '' };
    return { icon: '📖', text: `Tiết ${phase.period} · còn ${minutesLeft(phase.remaining)}`, tone: '' };
  }
  if (phase.kind === 'rest') return { icon: '☕', text: `Nghỉ tại chỗ · ${minutesLeft(phase.remaining)}`, tone: 'break' };
  if (phase.kind === 'recess') return { icon: '🪁', text: `Ra chơi · ${minutesLeft(phase.remaining)}`, tone: 'break' };
  if (ctx.night) return { icon: '🌙', text: 'Ban đêm', tone: 'night' };
  if (phase.next) {
    const soon = phase.remaining <= SCHOOL.alertBefore;
    return {
      icon: soon ? '🔔' : '⏳',
      text: soon ? `Tiết ${phase.next.period} sau ${minutesLeft(phase.remaining)}` : `Tiết ${phase.next.period} lúc ${clockText(phase.next.start)}`,
      tone: '',
      alert: soon,
    };
  }
  return { icon: '🏡', text: 'Tan học', tone: '' };
}

let shownKey = '';
function refreshPhase(force = false) {
  const status = phaseStatus(context);
  const clockLabel = clockText(context.minutes);
  const key = `${clockLabel}|${status.text}`;
  if (!force && key === shownKey) return;
  shownKey = key;
  phaseUI.clock.textContent = clockLabel;
  phaseUI.icon.textContent = status.icon;
  phaseUI.time.textContent = status.text;
  phaseUI.bell.hidden = !status.alert;
  phaseUI.pill.classList.toggle('break', status.tone === 'break');
  phaseUI.pill.classList.toggle('night', status.tone === 'night');
  phaseUI.pill.classList.toggle('alert', !!status.alert);
  const label = `Ngày ${context.day}, ${clockLabel} · ${status.text}`;
  phaseUI.pill.title = label;
  phaseUI.pill.setAttribute('aria-label', `${label}. Mở thời khoá biểu`);
  if (phaseUI.dialog.open) renderSchedule();
}

function renderSchedule() {
  const { phase, minute, day } = context;
  const schedule = phase.schedule;
  phaseUI.dayClock.textContent = `Ngày ${day} · ${clockText(context.minutes)} · ${moonName(sky.phase)} · ${sessionLabel(schedule.plan)}`;
  const items = [];
  let lastEnd = 0;
  for (const seg of schedule.segments) {
    if (lastEnd && seg.start - lastEnd > 60) {
      const li = document.createElement('li');
      li.className = 'lunch';
      li.textContent = `${seg.start >= 18 * 60 ? 'Nghỉ tối' : 'Nghỉ trưa'} · ${clockText(lastEnd)} – ${clockText(seg.start)}`;
      items.push(li);
    }
    lastEnd = seg.end;
    const li = document.createElement('li');
    const name = seg.kind === 'period' ? `📖 Tiết ${seg.period}` : seg.kind === 'rest' ? '☕ Nghỉ tại chỗ' : '🪁 Ra chơi';
    const label = document.createElement('span');
    label.textContent = name;
    const time = document.createElement('span');
    time.textContent = `${clockText(seg.start)} – ${clockText(seg.end)}`;
    li.append(label, time);
    li.classList.toggle('break', seg.kind !== 'period');
    li.classList.toggle('now', minute >= seg.start && minute < seg.end);
    li.classList.toggle('past', minute >= seg.end);
    items.push(li);
  }
  phaseUI.list.replaceChildren(...items);
  const status = phaseStatus(context);
  const credits = purse.credits ? ` · đã đóng trước ${purse.credits} tiết` : '';
  phaseUI.hint.textContent = `${status.icon} ${status.text} · học phí ${SCHOOL.tuition} ${MONEY.icon}/tiết${credits}`;
  phaseUI.hint.classList.toggle('break', status.tone === 'break');
}

function openSchedule() {
  lessonSelect.value = String(lesson.choice);
  showMode(lesson.mode);
  renderSchedule();
  phaseUI.dialog.showModal();
}

phaseUI.pill.addEventListener('click', openSchedule);
phaseUI.pill.addEventListener('pointerup', () => phaseUI.pill.blur());
phaseUI.cancel.addEventListener('click', () => phaseUI.dialog.close());
phaseUI.close.addEventListener('click', () => phaseUI.dialog.close());
phaseUI.dialog.addEventListener('click', (e) => {
  if (e.target === phaseUI.dialog) phaseUI.dialog.close();
});
phaseUI.form.addEventListener('submit', (e) => {
  e.preventDefault();
  lesson.setMode(pendingMode, Number(lessonSelect.value));
  phaseUI.dialog.close();
});

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
  const following = mode === 'play' && !player.firstPerson;
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
refreshPhase(true);

const clock = new THREE.Clock();
let lastFrame = 0;
let lastInput = performance.now();
for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel']) {
  window.addEventListener(type, () => (lastInput = performance.now()), { passive: true });
}

const pace = { target: FRAME_RATE, frames: 0, since: 0, steady: 0 };
function adaptResolution(time, target) {
  if (target !== pace.target || !pace.since) {
    Object.assign(pace, { target, frames: 0, since: time });
    return;
  }
  pace.frames += 1;
  const span = time - pace.since;
  if (span < 3000) return;
  const fps = (pace.frames * 1000) / span;
  pace.frames = 0;
  pace.since = time;
  let next = pixelRatio;
  if (fps < target * 0.8) {
    next = Math.max(MIN_PIXEL_RATIO, pixelRatio - 0.25);
    pace.steady = 0;
  } else if (fps >= target * 0.95 && ++pace.steady >= 5) {
    next = Math.min(MAX_PIXEL_RATIO, pixelRatio + 0.25);
    pace.steady = 0;
  }
  if (next === pixelRatio) return;
  pixelRatio = next;
  renderer.setPixelRatio(pixelRatio);
}

const outlines = [];
scene.traverse((object) => {
  if (object.isMesh && object.material === outlineMaterial()) outlines.push(object);
});
const outlinePoint = new THREE.Vector3();
let outlineCheck = 0;
function updateOutlines(t) {
  if (t < outlineCheck) return;
  outlineCheck = t + 0.5;
  for (const outline of outlines) {
    outline.getWorldPosition(outlinePoint);
    outline.visible = outlinePoint.distanceToSquared(camera.position) < OUTLINE_DISTANCE * OUTLINE_DISTANCE;
  }
}

const dialogs = [...document.querySelectorAll('dialog')];
const bagPanel = document.getElementById('bagPanel');
const popupOpen = () => purse.sleeping || !bagPanel.hidden || dialogs.some((dialog) => dialog.open);

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
  const resting = lodging ? 'inn' : 'sleep';
  const activity = asleep ? resting : player.resting ? 'rest' : player.posture === 'seated' ? 'seated' : moving;
  purse.liveEnergy(context.minutes, activity, asleep ? resting : 'idle');
  player.tired = purse.energy <= 0;
  if (!asleep) return;
  if (lodging && purse.energy >= ENERGY.max - 0.01) {
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

function sleepAtInn() {
  if (purse.sleeping) return;
  fishing.stop();
  player.getUp();
  purse.setSleeping(true, true);
  showSleep(true);
}

function wakeUp(message) {
  purse.setSleeping(false);
  showSleep(false);
  sayPlayer(message, 2.4);
}

document.getElementById('wakeBtn').addEventListener('click', () => wakeUp('Dậy rồi!'));
if (purse.sleeping) showSleep(true);

await itemImages;
await loadingStep(0.9, 'Thắp đèn lồng');
await renderer.compileAsync(scene, camera).catch(() => {});
await loadingStep(0.97);

let shownNight = -1;
let framesShown = 0;
renderer.setAnimationLoop((time) => {
  const idle = performance.now() - lastInput > IDLE_AFTER;
  const popup = popupOpen();
  const frameRate = popup ? POPUP_FRAME_RATE : lesson.visible || study.visible ? READING_FRAME_RATE : idle ? IDLE_FRAME_RATE : FRAME_RATE;
  if (time - lastFrame < 1000 / frameRate - 2) return;
  lastFrame = time;
  if (LOW_POWER) {
    if (popup) pace.since = 0;
    else adaptResolution(time, frameRate);
  }
  const dt = Math.min(clock.getDelta(), 0.07);
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
  const night = sky.update(context.minutes, camera, player.position, SHADOW_SPAN);
  if (Math.abs(night - shownNight) > 0.01) {
    shownNight = night;
    school.setNight(night);
    studyHall.setNight(night);
    inn.setNight(night);
    village.setNight(night);
    river.setNight(night);
  }
  notice.refresh(context.day);
  if (context.day !== lastDay) {
    lastDay = context.day;
    if (ledger.spoilFish(context.day).includes(PLAYER)) sayPlayer('Cá để lâu ươn hết rồi, đành bỏ đi...', 3);
  }
  footprints.update(t);
  tuition.update(context, inClass());
  playerStudyIcon.visible = inClass() && learningNow() && !context.phase.paying;
  refreshPhase();
  refreshRest();
  farm.tick();
  town.update(t, dt, context, player, camera);
  updateLine();
  school.update(t, context.phase.kind === 'period' && !context.phase.paying);
  studyHall.update(t);
  inn.update(t);
  village.update(t, context, camera);
  river.update(dt, context.minutes);
  clouds.update(dt, night);
  player.update(dt);
  placeBubble();
  regen.update(dt, t, player.position, player.restAmount, player.resting, context.minutes);
  for (const effect of Object.values(effects)) effect.update(dt);
  fishing.update();
  angler.update(dt);
  regions.update(t, dt, player.position);
  quiz.update(dt, regions.active?.id !== 'school');
  updateHover(t);
  updateOutlines(t);
  playerBubble.update(t);
  avatar.face.update(t, player.restAmount > 0.6 ? 'blink' : 'open');
  if (seatedAvatar.group.visible) {
    seatedAvatar.face.update(t);
    seatedAvatar.head.rotation.x = 0.12 + Math.sin(t * 1.1) * 0.05;
    seatedAvatar.head.rotation.y = Math.sin(t * 0.4) * 0.2;
  }
  if (mode === 'overview') orbit.update();
  if (marker.visible) marker.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
  renderer.render(scene, camera);
  if (framesShown < 2 && ++framesShown === 2) loadingDone();
});
