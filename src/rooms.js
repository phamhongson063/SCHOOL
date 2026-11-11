import * as THREE from 'three';
import { STUDY_HALLS, HALL_SIZE, hallBounds } from './studyHall.js';
import { HOUSE } from './school.js';

const WALL = 0.25;
const DOOR_MARGIN = 0.3;
const PASS = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e9);

function studyHallRoom(hall) {
  const { door, doorHeight, height } = HALL_SIZE;
  const { x0, x1, z0, z1, out } = hallBounds(hall);
  return {
    x0: x0 + WALL,
    x1: x1 - WALL,
    z0: z0 + WALL,
    z1: z1 - WALL,
    top: height + 2,
    door: { x0: hall.x - door / 2, x1: hall.x + door / 2, top: doorHeight, z: hall.front, out },
  };
}

function classroom() {
  return { x0: -11, x1: 12, z0: HOUSE.back, z1: HOUSE.front, top: 6, door: null };
}

const contains = (room, p) => p.x >= room.x0 && p.x <= room.x1 && p.z >= room.z0 && p.z <= room.z1 && p.y < room.top;

const allRooms = () => [...STUDY_HALLS.map(studyHallRoom), classroom()];

let studyRooms = null;

export function inStudyRoom(point) {
  studyRooms ??= allRooms();
  return studyRooms.some((room) => contains(room, point));
}

export function createRooms() {
  const rooms = allRooms().map((room) => ({
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
    corners[2].set(door.x1, door.top, z);
    corners[3].set(door.x0, door.top, z);
    beyond.set((door.x0 + door.x1) / 2, door.top / 2, z + door.out);
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
