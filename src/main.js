import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelWorld } from './world.js';
import { buildWorld, populate, stairHeight, CX, SPAWN } from './school.js';
import { createScenery, createSky } from './scenery.js';
import { createPlayer, createStudent } from './characters.js';
import { Seats } from './seats.js';
import { createLesson } from './lesson.js';
import { PlayerController } from './walk.js';
import { NavGrid } from './nav.js';
import { createClouds } from './sky.js';
import { Schedule } from './schedule.js';
import { Classmates } from './npc.js';
import { Footprints, createBlobShadow } from './groundfx.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
const shadowSize = renderer.capabilities.maxTextureSize >= 8192 ? 4096 : 2048;
sun.shadow.mapSize.set(shadowSize, shadowSize);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

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
player.nav = new NavGrid(world, (p) => player.collides(p), { x0: -44, x1: 45, z0: -36, z1: 47 }, { surfaceAt: stairHeight });
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
let lessonRequestedAt = null;
const LESSON_WAIT_LIMIT = 20000;
player.onFacingTeacher = () => {
  if (schedule.phase === 'class') lessonRequestedAt = performance.now();
};
player.onStand = () => {
  lessonRequestedAt = null;
  lesson.close();
};

player.onClick = (clientX, clientY) => {
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const targets = roof.visible ? [...scenery.clickables, roof, school.root] : [...scenery.clickables, school.root];
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return;
  const point = hit.point.clone();
  if (hit.face) {
    normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    point.addScaledVector(normal, 0.3);
  }
  const seat = seats.at(hit.point);
  if (seat && seats.canTake(seat, 'player')) {
    player.requestSeat(seat);
    return;
  }
  player.requestMove(point);
};

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.48;
orbit.minDistance = 2;
orbit.maxDistance = 90;
orbit.enabled = false;
const overview = {
  position: new THREE.Vector3(CX + 14, 8, 30),
  target: new THREE.Vector3(CX, 3, -2),
};

const ui = {
  help: document.getElementById('help'),
  viewBtn: document.getElementById('viewBtn'),
  modeBtn: document.getElementById('modeBtn'),
  roofBtn: document.getElementById('roofBtn'),
};

const HELP = {
  play: 'Click chuột trái: đi tới chỗ đó · Click vào chỗ ngồi trống: ngồi xuống · Kéo chuột: xoay camera · Lăn chuột: gần/xa',
  overview: 'Kéo chuột trái: xoay · Chuột phải: dời khung hình · Lăn chuột: phóng to/thu nhỏ',
};

let mode = 'play';

function setLabel(button, text) {
  button.title = text;
  button.setAttribute('aria-label', text);
}

function refreshUI() {
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
    player.setEnabled(false);
    camera.position.copy(overview.position);
    orbit.target.copy(overview.target);
    orbit.enabled = true;
    orbit.update();
  } else {
    overview.position.copy(camera.position);
    overview.target.copy(orbit.target);
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
  label: document.getElementById('phaseLabel'),
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

let pendingMode = lesson.mode;
function showMode(mode) {
  pendingMode = mode;
  for (const option of phaseUI.modes) option.setAttribute('aria-checked', String(option.dataset.mode === mode));
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
  phaseUI.label.textContent = inClass ? 'Giờ học' : 'Ra chơi';
  phaseUI.time.textContent = formatTime(schedule.remaining);
  phaseUI.pill.classList.toggle('break', !inClass);
  phaseUI.skip.textContent = inClass ? '⏩ Ra chơi ngay' : '⏩ Vào học ngay';
  phaseUI.hint.textContent = `${inClass ? '📖 Đang trong giờ học' : '🪁 Đang ra chơi'} · còn ${formatTime(schedule.remaining)}`;
  phaseUI.hint.classList.toggle('break', !inClass);
}

function openSchedule() {
  phaseUI.classInput.value = schedule.classMinutes;
  phaseUI.breakInput.value = schedule.breakMinutes;
  showMode(lesson.mode);
  refreshPhase(true);
  phaseUI.dialog.showModal();
}

schedule.onChange((phase) => {
  classmates.setPhase(phase);
  if (phase === 'break') {
    lessonRequestedAt = null;
    player.standUp();
  } else {
    lesson.nextPeriod();
    if (player.posture === 'seated') lessonRequestedAt = performance.now();
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
  lesson.setMode(pendingMode);
  refreshPhase(true);
  phaseUI.dialog.close();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

refreshUI();
refreshPhase(true);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  footprints.update(t);
  schedule.update(dt);
  refreshPhase();
  classmates.update(t, dt);
  if (lessonRequestedAt !== null && schedule.phase === 'class' && player.posture === 'seated') {
    if (classmates.allSeated() || performance.now() - lessonRequestedAt > LESSON_WAIT_LIMIT) {
      lessonRequestedAt = null;
      lesson.open();
    }
  }
  school.update(t, schedule.phase === 'class');
  clouds.update(dt);
  player.update(dt);
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
