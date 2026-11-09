import * as THREE from 'three';
import { CURSORS } from './cursors.js';
import { countdownText } from './clock.js';
import { setRich } from './goldArt.js';

const HOVER_INTERVAL = 0.1;

export function createHoverTip({ renderer, camera, regions, player, playing, working }) {
  const tip = document.getElementById('hoverTip');
  const tipText = document.getElementById('hoverTipText');
  const tipBar = document.getElementById('hoverTipBar');
  const tipFill = tipBar.firstElementChild;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tipAnchor = new THREE.Vector3();
  const lastCamera = new THREE.Matrix4();
  let hovering = false;
  let dirty = true;
  let picked = { region: null, target: null };
  let tipSize = null;
  let shownRegion = null;
  let nextAt = 0;
  let text = null;
  let anchor = null;
  let progress = null;

  renderer.domElement.addEventListener('pointermove', (event) => {
    hovering = event.pointerType === 'mouse';
    dirty = true;
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    hovering = false;
  });
  window.addEventListener('resize', () => (tipSize = null));

  function show(label, at, fill = null) {
    let visible = !!label && !!at;
    if (visible) visible = tipAnchor.copy(at).project(camera).z < 1;
    tip.hidden = !visible;
    if (!visible) return;
    if (tipText.dataset.label !== label) {
      tipText.dataset.label = label;
      setRich(tipText, label);
      tipSize = null;
    }
    const timed = fill != null;
    if (tipBar.hidden === timed) {
      tipBar.hidden = !timed;
      tipSize = null;
    }
    if (timed) tipFill.style.transform = `scaleX(${fill})`;
    tipSize ??= tip.getBoundingClientRect();
    const { width, height } = tipSize;
    const x = ((tipAnchor.x + 1) / 2) * window.innerWidth - width / 2;
    const y = ((1 - tipAnchor.y) / 2) * window.innerHeight - height;
    tip.style.transform = `translate(${x}px, ${y}px)`;
  }

  function nearbyTimer() {
    const region = regions.active;
    const target = region?.nearbyTarget?.(player.position);
    const left = target ? region.timeLeft?.(target) : null;
    if (left == null) return null;
    return { text: countdownText(left), progress: region.growth?.(target) ?? null, anchor: region.topOf(target) };
  }

  function update(t) {
    if (player.drag) {
      tip.hidden = true;
      return;
    }
    if (t < nextAt) {
      show(text, anchor, progress);
      return;
    }
    nextAt = t + HOVER_INTERVAL;
    let region = null;
    let target = null;
    if (hovering && playing()) {
      if (dirty || !lastCamera.equals(camera.matrixWorld)) {
        dirty = false;
        lastCamera.copy(camera.matrixWorld);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(regions.clickables, true)[0];
        if (hit) {
          region = regions.regionOf(hit.object);
          if (region?.target) target = region.target(hit, player.position);
        }
        picked = { region, target };
      } else ({ region, target } = picked);
    }
    if (shownRegion && shownRegion !== region) shownRegion.highlight?.(null);
    if (!target) {
      shownRegion?.highlight?.(null);
      shownRegion = null;
      renderer.domElement.style.cursor = '';
      const near = playing() ? nearbyTimer() : null;
      text = near?.text ?? null;
      progress = near?.progress ?? null;
      anchor = near?.anchor ?? null;
      show(text, anchor, progress);
      return;
    }
    region?.highlight?.(target);
    shownRegion = target ? region : null;
    const task = working();
    const busy = target && task?.region === region && task.target.index === target.index;
    const hint = target && !busy ? region.actionFor(target).hint : null;
    renderer.domElement.style.cursor = hint ? CURSORS[hint] : '';
    const label = target ? region.labelOf?.(target) : null;
    const left = target && !label ? region.timeLeft?.(target) : null;
    text = label ?? (left == null ? null : countdownText(left));
    progress = left == null ? null : region.growth?.(target) ?? null;
    anchor = text == null ? null : region.topOf(target);
    show(text, anchor, progress);
  }

  function reset() {
    shownRegion?.highlight?.(null);
    shownRegion = null;
    tip.hidden = true;
  }

  return { update, reset };
}
