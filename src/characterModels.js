import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { toonMaterial } from './toon.js';

const MODELS = {
  player: { url: 'assets/player/player.glb', height: 1.8 },
  girl: { url: 'assets/npc/girl.glb', height: 1.68 },
  man: { url: 'assets/npc/man.glb', height: 1.72 },
  granny: { url: 'assets/npc/granny.glb', height: 1.62, posed: true },
  scholar: { url: 'assets/npc/scholar.glb', height: 1.7, posed: true },
  farmgirl: { url: 'assets/npc/farmgirl.glb', height: 1.6, posed: true },
  worker: { url: 'assets/npc/worker.glb', height: 1.72, posed: true },
  aodai: { url: 'assets/npc/aodai.glb', height: 1.62 },
};
const SKINS = {
  'girl-jade': { model: 'girl', texture: 'assets/npc/girl_jade.jpg' },
  'man-brown': { model: 'man', texture: 'assets/npc/man_brown.jpg' },
  'granny-navy': { model: 'granny', texture: 'assets/npc/granny_navy.jpg' },
  'scholar-ink': { model: 'scholar', texture: 'assets/npc/scholar_ink.jpg' },
  'farmgirl-blue': { model: 'farmgirl', texture: 'assets/npc/farmgirl_blue.jpg' },
  'worker-brown': { model: 'worker', texture: 'assets/npc/worker_brown.jpg' },
  'aodai-blue': { model: 'aodai', texture: 'assets/npc/aodai_blue.jpg' },
};
const ARM_DROP = 1.32;
const OUTLINE = 0.007;
const SEAT_HIP = 0.13;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const templates = new Map();
const textures = new Map();
let gradient = null;

function softGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([200, 255]), 2, 1, THREE.RedFormat);
    gradient.minFilter = THREE.LinearFilter;
    gradient.magFilter = THREE.LinearFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export async function loadCharacterModels() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const images = new THREE.TextureLoader();
  await Promise.all([
    ...Object.entries(MODELS).map(async ([name, spec]) => {
      try {
        templates.set(name, (await loader.loadAsync(spec.url)).scene);
      } catch {}
    }),
    ...Object.entries(SKINS).map(async ([name, spec]) => {
      try {
        const texture = await images.loadAsync(spec.texture);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        textures.set(name, texture);
      } catch {}
    }),
  ]);
}

const modelOf = (look) => SKINS[look]?.model ?? look;

export const hasModel = (look) => templates.has(modelOf(look));

function outlineMaterial() {
  const material = new THREE.MeshBasicMaterial({ color: 0x2b1c12, side: THREE.BackSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = { value: OUTLINE };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float outlineThickness;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\nmvPosition.xyz += normalize(transformedNormal) * outlineThickness;\ngl_Position = projectionMatrix * mvPosition;');
  };
  return material;
}

const relativeQuaternion = (() => {
  const rootQ = new THREE.Quaternion();
  return (root, node, out) => {
    root.getWorldQuaternion(rootQ).invert();
    return node.getWorldQuaternion(out).premultiply(rootQ);
  };
})();

function prepare(rig, texture) {
  const meshes = [];
  rig.traverse((node) => {
    if (node.isSkinnedMesh) meshes.push(node);
  });
  for (const mesh of meshes) {
    const map = texture ?? mesh.material.map;
    if (map) map.anisotropy = 4;
    mesh.material = toonMaterial({ map, gradientMap: softGradient() });
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const outline = new THREE.SkinnedMesh(mesh.geometry, outlineMaterial());
    outline.bind(mesh.skeleton, mesh.bindMatrix);
    outline.frustumCulled = false;
    outline.raycast = () => {};
    mesh.parent.add(outline);
  }
  rig.updateMatrixWorld(true);
  meshes[0].computeBoundingBox();
  return meshes[0].boundingBox.clone();
}

function joint(rig, name) {
  const bone = rig.getObjectByName(name);
  if (!bone) throw new Error(`Missing bone ${name}`);
  return { bone, rest: relativeQuaternion(rig, bone, new THREE.Quaternion()) };
}

export function createModel(look, { seated = false } = {}) {
  const name = modelOf(look);
  const posed = !!MODELS[name].posed;
  const rig = cloneRig(templates.get(name));
  const box = prepare(rig, textures.get(look));
  const scale = MODELS[name].height / (box.max.y - box.min.y);
  rig.scale.setScalar(scale);
  rig.position.y = -box.min.y * scale;
  const group = new THREE.Group();
  group.add(rig);

  const proxy = () => new THREE.Object3D();
  const parts = { body: proxy(), head: proxy(), leftArm: proxy(), rightArm: proxy(), leftLeg: proxy(), rightLeg: proxy() };
  const drop = (side) => new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -side * ARM_DROP);
  const reach = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -1.15);
  const thigh = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -Math.PI / 2);
  const none = new THREE.Quaternion();
  rig.updateMatrixWorld(true);
  let lift = 0;
  const stance = (hipName, footName) => {
    const hip = rig.getObjectByName(hipName).getWorldPosition(new THREE.Vector3());
    const foot = rig.getObjectByName(footName).getWorldPosition(new THREE.Vector3());
    const angle = Math.atan2(foot.x - hip.x, hip.y - foot.y);
    lift = Math.max(lift, hip.distanceTo(foot) * (1 - Math.cos(angle)));
    return new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -angle);
  };
  const leftStance = stance('LeftUpLeg', 'LeftFoot');
  const rightStance = stance('RightUpLeg', 'RightFoot');
  if (!seated) rig.position.y -= lift;
  const controls = [
    { ...joint(rig, 'Neck'), part: parts.head, base: none },
    { ...joint(rig, 'LeftArm'), part: parts.leftArm, base: posed ? (seated ? reach : none) : seated ? reach.clone().multiply(drop(1)) : drop(1) },
    { ...joint(rig, 'RightArm'), part: parts.rightArm, base: posed ? (seated ? reach : none) : seated ? reach.clone().multiply(drop(-1)) : drop(-1) },
    { ...joint(rig, 'LeftUpLeg'), part: parts.leftLeg, base: seated ? thigh : leftStance },
    { ...joint(rig, 'RightUpLeg'), part: parts.rightLeg, base: seated ? thigh : rightStance },
  ];
  if (seated) {
    controls.push({ ...joint(rig, 'LeftLeg'), part: null, base: none });
    controls.push({ ...joint(rig, 'RightLeg'), part: null, base: none });
    rig.updateMatrixWorld(true);
    const hips = rig.getObjectByName('Hips').getWorldPosition(new THREE.Vector3());
    rig.position.y += SEAT_HIP - hips.y;
  }

  const delta = new THREE.Quaternion();
  const parentQ = new THREE.Quaternion();
  function pose() {
    for (const control of controls) {
      delta.copy(control.base);
      if (control.part) delta.premultiply(control.part.quaternion);
      relativeQuaternion(rig, control.bone.parent, parentQ).invert();
      control.bone.quaternion.copy(parentQ).multiply(delta).multiply(control.rest);
      control.bone.updateMatrixWorld(true);
    }
  }
  pose();

  return { group, ...parts, face: { update() {} }, pose, model: true };
}
