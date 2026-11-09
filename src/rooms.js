import * as THREE from 'three';
import { STUDY_HALL } from './studyHall.js';
import { HOUSE } from './school.js';

const WALL = 0.25;
const DOOR_TOP = 2.6;
const DOOR_MARGIN = 0.3;
const PASS = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e9);

function studyHallRoom() {
  const { x, front, width, depth, door, height } = STUDY_HALL;
  return {
    x0: x - width / 2 + WALL,
    x1: x + width / 2 - WALL,
    z0: front + WALL,
    z1: front + depth - WALL,
    top: height + 2,
    door: { x0: x - door / 2, x1: x + door / 2, z: front, out: -1 },
  };
}

function classroom() {
  return { x0: -11, x1: 12, z0: HOUSE.back, z1: HOUSE.front, top: 6, door: null };
}

const contains = (room, p) => p.x >= room.x0 && p.x <= room.x1 && p.z >= room.z0 && p.z <= room.z1 && p.y < room.top;

export function createRooms() {
  const rooms = [studyHallRoom(), classroom()].map((room) => ({
    ...room,
    box: new THREE.Box3(new THREE.Vector3(room.x0, -1, room.z0), new THREE.Vector3(room.x1, room.top, room.z1)),
  }));
  const portal = new THREE.Frustum();
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const beyond = new THREE.Vector3();
  let current = null;
  let culling = false;

  function aim(room, eye) {
    const { door } = room;
    const z = door.z;
    corners[0].set(door.x0, 0, z);
    corners[1].set(door.x1, 0, z);
    corners[2].set(door.x1, DOOR_TOP, z);
    corners[3].set(door.x0, DOOR_TOP, z);
    beyond.set((door.x0 + door.x1) / 2, DOOR_TOP / 2, z + door.out);
    for (let i = 0; i < 4; i++) {
      const plane = portal.planes[i].setFromCoplanarPoints(eye, corners[i], corners[(i + 1) % 4]);
      if (plane.distanceToPoint(beyond) < 0) plane.negate();
    }
    portal.planes[4].setFromNormalAndCoplanarPoint(beyond.set(0, 0, door.out), corners[0]);
    portal.planes[5].copy(PASS);
  }

  return {
    get indoors() {
      return !!current;
    },
    update(camera) {
      const eye = camera.position;
      current = rooms.find((room) => contains(room, eye)) ?? null;
      culling = !!current?.door && (eye.z - current.door.z) * -current.door.out > DOOR_MARGIN;
      if (culling) aim(current, eye);
    },
    sees(point, sphere) {
      if (!culling || contains(current, point)) return true;
      return portal.intersectsSphere(sphere);
    },
    seesBox(box) {
      if (!culling || box.intersectsBox(current.box)) return true;
      return portal.intersectsBox(box);
    },
  };
}
