import * as THREE from 'three';

const TURN_RATE = 6;
const MAX_STEP = 0.1;
const origin = new THREE.Vector3();
const parentTurn = new THREE.Quaternion();
const parentEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function parentYaw(group) {
  if (!group.parent) return 0;
  group.parent.getWorldQuaternion(parentTurn);
  return parentEuler.setFromQuaternion(parentTurn, 'YXZ').y;
}

export function createAttention(group, { range = 4.5 } = {}) {
  const rest = group.rotation.y;
  let guest = null;
  let hold = null;
  let until = Infinity;
  let last = null;

  return {
    attend(member, seconds = null) {
      guest = member;
      hold = seconds;
      until = Infinity;
    },
    release(member) {
      if (!member || guest === member) guest = null;
    },
    update(t) {
      const dt = last === null ? 0 : Math.min(MAX_STEP, t - last);
      last = t;
      group.getWorldPosition(origin);
      if (guest && hold !== null) {
        until = t + hold;
        hold = null;
      }
      if (guest && (t > until || Math.hypot(guest.position.x - origin.x, guest.position.z - origin.z) > range)) guest = null;
      const goal = guest ? Math.atan2(guest.position.x - origin.x, guest.position.z - origin.z) - parentYaw(group) : rest;
      const diff = Math.atan2(Math.sin(goal - group.rotation.y), Math.cos(goal - group.rotation.y));
      group.rotation.y += diff * Math.min(1, TURN_RATE * dt);
    },
  };
}
