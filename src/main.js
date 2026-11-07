import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelWorld } from './world.js';
import { buildWorld, populate, stairHeight, CX } from './school.js';
import { createScenery, createSky } from './scenery.js';
import { createPlayer, createStudent } from './characters.js';
import { Seats } from './seats.js';
import { createLesson } from './lesson.js';
import { LESSONS } from './lessons.js';
import { PlayerController } from './walk.js';
import { NavGrid } from './nav.js';
import { createClouds } from './sky.js';
import { Schedule } from './schedule.js';
import { Classmates } from './npc.js';
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
import { Inventory } from './inventory.js';
import { createBag } from './bag.js';

const touchDevice = window.matchMedia('(pointer: coarse)').matches;
const FRAME_RATE = touchDevice ? 30 : 60;
const READING_FRAME_RATE = 20;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
createSky(scene);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 500);

scene.add(new THREE.HemisphereLight(0xf2f8ff, 0x8a7350, 1.0));
scene.add(new THREE.AmbientLight(0xfff4e0, 0.45));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.position.set(28, 40, 36);
sun.castShadow = true;
const shadowSize = !touchDevice && renderer.capabilities.maxTextureSize >= 8192 ? 4096 : 2048;
sun.shadow.mapSize.set(shadowSize, shadowSize);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const SUN_OFFSET = sun.position.clone();
const sunCenter = new THREE.Vector3(0, 0, 0);
function followSun(position) {
  if (Math.hypot(position.x - sunCenter.x, position.z - sunCenter.z) < 12) return;
  sunCenter.set(Math.round(position.x / 4) * 4, 0, Math.round(position.z / 4) * 4);
  sun.target.position.copy(sunCenter);
  sun.position.copy(sunCenter).add(SUN_OFFSET);
}

const world = new VoxelWorld();
const layout = buildWorld(world);
const scenery = createScenery(scene, layout);
const roof = scenery.roof;

const school = populate(scene);
const clouds = createClouds(scene);

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

const regions = new RegionManager({ scene, obstacles: school.obstacles });
regions.add({
  id: 'school',
  name: 'Trường làng',
  bounds: { x0: -28, z0: -20, x1: 29, z1: 31 },
  pinned: true,
  overview: { position: new THREE.Vector3(CX + 14, 8, 30), target: new THREE.Vector3(CX, 3, -2) },
});
regions.add(createRoad());
const inventory = new Inventory();
createBag(inventory);
regions.add(createFarm({ inventory, nav: () => player.nav }));
regions.stream(SPAWN.x, SPAWN.z);

player.nav = new NavGrid(world, (p) => player.collides(p), { x0: -44, x1: 45, z0: -36, z1: 67 }, { surfaceAt: stairHeight });
regions.onLoad = (region) => player.nav.bake(region.bounds);
regions.onUnload = (region) => player.nav.bake(region.bounds);

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

const quiz = createQuiz({ onPass: () => playerBubble.show('🎉 Đúng rồi! Chơi tiếp nào!', 2.2, clock.elapsedTime) });

const effects = {
  water: createWatering(scene, avatar),
  harvest: createHarvesting(scene, avatar),
  clear: createClearing(scene, avatar),
};
const busyEffect = () => Object.values(effects).find((effect) => effect.busy);
let effectTask = null;

let fieldTask = null;
player.onArrive = () => {
  const task = fieldTask;
  fieldTask = null;
  if (!task || Math.hypot(task.target.stand.x - player.position.x, task.target.stand.z - player.position.z) > 0.8) return;
  player.faceToward(task.target.x, task.target.z);
  const finish = () => {
    const reply = task.region.act(task.action.id, task.target, task.choice);
    if (reply) playerBubble.show(reply, 1.6, clock.elapsedTime);
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
};
player.place(new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z), 0);
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

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const normal = new THREE.Vector3();
const seats = new Seats(school.seats);
const seatedAvatar = createStudent({ shirt: 0x3b6fb0, pants: 0xf4efe2, skin: 0xf6caa4, style: 'player', iris: 0x7a4422 });
scene.add(seatedAvatar.group);
player.attachSeating({
  seats,
  model: seatedAvatar,
  onDisplace: (member, seat) => classmates.displaced(member, seat),
});

const lesson = createLesson();
player.lookTarget = school.teacherHead;
player.onFacingTeacher = () => {
  if (schedule.phase === 'class') lesson.open();
};
player.onStand = () => lesson.close();

player.onClick = (clientX, clientY, run) => {
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const targets = [...scenery.clickables, ...regions.clickables, school.root];
  if (roof.visible) targets.push(roof);
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return;
  fieldTask = null;
  busyEffect()?.cancel();
  if (effectTask) effectTask.region.animate?.(effectTask.target, null);
  effectTask = null;
  const region = regions.active;
  if (region?.interact?.(hit.object, player.position)) return;
  const target = region?.target?.(hit.point, player.position, hit.object);
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
  const seat = seats.at(hit.point);
  if (seat && seats.canTake(seat, 'player')) {
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

function updateHover() {
  if (player.drag) {
    hoverTip.hidden = true;
    return;
  }
  const region = regions.active;
  let target = null;
  if (hovering && mode === 'play' && region?.target) {
    raycaster.setFromCamera(hoverPointer, camera);
    const hit = raycaster.intersectObjects(regions.clickables, true)[0];
    if (hit) target = region.target(hit.point, player.position, hit.object);
  }
  if (!target && !hoverRegion) return;
  region?.highlight?.(target);
  hoverRegion = target ? region : null;
  const working = target && effectTask?.region === region && effectTask.target.index === target.index;
  const hint = target && !working ? region.actionFor(target).hint : null;
  renderer.domElement.style.cursor = hint ? CURSORS[hint] : '';
  const left = target ? region.timeLeft?.(target) : null;
  showHoverTip(left == null ? null : formatTime(left / 1000), left == null ? null : region.topOf(target));
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
  help: document.getElementById('help'),
  viewBtn: document.getElementById('viewBtn'),
  modeBtn: document.getElementById('modeBtn'),
  roofBtn: document.getElementById('roofBtn'),
};

const HELP = {
  play: 'Click chuột trái: đi tới chỗ đó · Click vào chỗ ngồi trống: ngồi xuống · Ở ruộng: click đất trống để gieo hạt, cây khát nước để tưới, cây chín để hái, cây đã hái để dọn, click nông dân để xem túi của họ · Kéo chuột: xoay camera · Lăn chuột: gần/xa',
  overview: 'Kéo chuột trái: xoay · Chuột phải: dời khung hình · Lăn chuột: phóng to/thu nhỏ',
};

let mode = 'play';

function setLabel(button, text) {
  button.title = text;
  button.setAttribute('aria-label', text);
}

function refreshUI() {
  frameCamera();
  ui.help.textContent = HELP[mode];
  ui.viewBtn.classList.toggle('active', player.firstPerson);
  ui.viewBtn.disabled = mode !== 'play';
  setLabel(ui.viewBtn, player.firstPerson ? 'Chuyển sang góc nhìn thứ ba' : 'Chuyển sang góc nhìn thứ nhất');
  ui.modeBtn.classList.toggle('active', mode === 'overview');
  setLabel(ui.modeBtn, mode === 'overview' ? 'Quay lại nhập vai' : 'Xem toàn cảnh');
  ui.roofBtn.classList.toggle('active', !roof.visible);
  setLabel(ui.roofBtn, roof.visible ? 'Ẩn mái nhà' : 'Hiện mái nhà');
}

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
ui.roofBtn.addEventListener('click', () => {
  roof.visible = !roof.visible;
  if (roof.visible) player.hiddenLayers.delete('roof');
  else player.hiddenLayers.add('roof');
  refreshUI();
});
for (const button of [ui.viewBtn, ui.modeBtn, ui.roofBtn]) {
  button.addEventListener('pointerup', () => button.blur());
}

const schedule = new Schedule();
const classmates = new Classmates({ students: school.students, nav: player.nav, root: school.root, seats, footprints });

const phaseUI = {
  pill: document.getElementById('phasePill'),
  icon: document.getElementById('phaseIcon'),
  time: document.getElementById('phaseTime'),
  button: document.getElementById('scheduleBtn'),
  dialog: document.getElementById('scheduleDialog'),
  form: document.getElementById('scheduleForm'),
  classInput: document.getElementById('classInput'),
  breakInput: document.getElementById('breakInput'),
  hint: document.getElementById('scheduleHint'),
  skip: document.getElementById('skipBtn'),
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
function showMode(mode) {
  pendingMode = mode;
  for (const option of phaseUI.modes) option.setAttribute('aria-checked', String(option.dataset.mode === mode));
  lessonChoice.hidden = mode !== 'choose';
}
for (const option of phaseUI.modes) option.addEventListener('click', () => showMode(option.dataset.mode));

function formatTime(seconds) {
  const total = Math.ceil(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

let shownSecond = -1;
function refreshPhase(force = false) {
  const second = Math.ceil(schedule.remaining);
  if (!force && second === shownSecond) return;
  shownSecond = second;
  const inClass = schedule.phase === 'class';
  phaseUI.icon.textContent = inClass ? '📖' : '🪁';
  phaseUI.time.textContent = formatTime(schedule.remaining);
  const status = `${inClass ? 'Giờ học' : 'Ra chơi'} · còn ${formatTime(schedule.remaining)}`;
  phaseUI.pill.title = status;
  phaseUI.pill.setAttribute('aria-label', `${status}. Mở cài đặt`);
  phaseUI.pill.classList.toggle('break', !inClass);
  phaseUI.skip.textContent = inClass ? '⏩ Ra chơi ngay' : '⏩ Vào học ngay';
  phaseUI.hint.textContent = `${inClass ? '📖 Đang trong giờ học' : '🪁 Đang ra chơi'} · còn ${formatTime(schedule.remaining)}`;
  phaseUI.hint.classList.toggle('break', !inClass);
}

function openSchedule() {
  phaseUI.classInput.value = schedule.classMinutes;
  phaseUI.breakInput.value = schedule.breakMinutes;
  lessonSelect.value = String(lesson.choice);
  showMode(lesson.mode);
  refreshPhase(true);
  phaseUI.dialog.showModal();
}

schedule.onChange((phase) => {
  classmates.setPhase(phase);
  if (phase === 'break') {
    player.standUp();
  } else {
    lesson.nextPeriod();
    if (player.posture === 'seated') lesson.open();
  }
  refreshPhase(true);
});

phaseUI.button.addEventListener('click', openSchedule);
phaseUI.pill.addEventListener('click', openSchedule);
phaseUI.button.addEventListener('pointerup', () => phaseUI.button.blur());
phaseUI.pill.addEventListener('pointerup', () => phaseUI.pill.blur());
phaseUI.cancel.addEventListener('click', () => phaseUI.dialog.close());
phaseUI.close.addEventListener('click', () => phaseUI.dialog.close());
for (const step of phaseUI.form.querySelectorAll('.step')) {
  step.addEventListener('click', () => {
    const input = document.getElementById(step.dataset.target);
    const value = Number(input.value) || 0;
    const next = Number(step.dataset.dir) > 0 ? (value < 1 ? 1 : Math.floor(value) + 1) : value <= 1 ? 0.5 : Math.ceil(value) - 1;
    input.value = Math.min(180, Math.max(0.5, next));
  });
}
phaseUI.skip.addEventListener('click', () => {
  schedule.advance();
  phaseUI.dialog.close();
});
phaseUI.dialog.addEventListener('click', (e) => {
  if (e.target === phaseUI.dialog) phaseUI.dialog.close();
});
phaseUI.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const classMinutes = Number(phaseUI.classInput.value);
  const breakMinutes = Number(phaseUI.breakInput.value);
  if (!schedule.setMinutes(classMinutes, breakMinutes)) return;
  lesson.setMode(pendingMode, Number(lessonSelect.value));
  refreshPhase(true);
  phaseUI.dialog.close();
});

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
renderer.setAnimationLoop((time) => {
  const frameRate = lesson.visible ? READING_FRAME_RATE : FRAME_RATE;
  if (time - lastFrame < 1000 / frameRate - 2) return;
  lastFrame = time;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  footprints.update(t);
  schedule.update(dt);
  refreshPhase();
  classmates.update(t, dt, schedule.phase === 'break' ? schedule.remaining : Infinity);
  school.update(t, schedule.phase === 'class');
  clouds.update(dt);
  player.update(dt);
  for (const effect of Object.values(effects)) effect.update(dt);
  regions.update(t, dt, player.position);
  quiz.update(dt, regions.active?.id !== 'school');
  updateHover();
  followSun(player.position);
  playerBubble.update(t);
  avatar.face.update(t);
  if (seatedAvatar.group.visible) {
    seatedAvatar.face.update(t);
    seatedAvatar.head.rotation.x = 0.12 + Math.sin(t * 1.1) * 0.05;
    seatedAvatar.head.rotation.y = Math.sin(t * 0.4) * 0.2;
  }
  if (mode === 'overview') orbit.update();
  if (marker.visible) marker.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
  renderer.render(scene, camera);
});
