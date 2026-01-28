import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "lil-gui";

const canvas = document.querySelector("#scene");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(18, 18, 26);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 6, 0);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(18, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const fill = new THREE.DirectionalLight(0x8ad9ff, 0.35);
fill.position.set(-18, 10, -16);
scene.add(fill);

const grid = new THREE.GridHelper(60, 60, 0x28404a, 0x1a2b32);
grid.position.y = -0.01;
scene.add(grid);

const towerGroup = new THREE.Group();
scene.add(towerGroup);

const params = {
  floors: 40,
  floorHeight: 0.7,
  slabWidth: 8,
  slabDepth: 8,
  slabThickness: 0.4,
  shapeBottom: "square",
  shapeTop: "circle",
  shapeCurve: "smoothstep",
  scaleMin: 0.65,
  scaleMax: 1.25,
  twistXMin: 0,
  twistXMax: 0,
  twistXCurve: "smoothstep",
  twistYMin: -15,
  twistYMax: 55,
  twistYCurve: "smoothstep",
  twistZMin: 0,
  twistZMax: 0,
  twistZCurve: "smoothstep",
  scaleCurve: "smoothstep",
  bendAngle: 25,
  bendDirection: 0,
  bendCurve: "smoothstep",
  colorBottom: "#2aa4ff",
  colorTop: "#ff7b57",
  roughness: 0.45,
  metalness: 0.1,
};

const curveOptions = {
  linear: "linear",
  smoothstep: "smoothstep",
  easeInOutCubic: "easeInOutCubic",
};

const shapeOptions = {
  square: "square",
  circle: "circle",
  triangle: "triangle",
};


const lerp = (a, b, t) => a + (b - a) * t;

const applyCurve = (t, type) => {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  switch (type) {
    case "smoothstep":
      return clamped * clamped * (3 - 2 * clamped);
    case "easeInOutCubic":
      return clamped < 0.5
        ? 4 * clamped * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
    case "linear":
    default:
      return clamped;
  }
};

const polarRadiusForShape = (type, theta) => {
  const angle = THREE.MathUtils.euclideanModulo(theta, Math.PI * 2);
  const polygonRadius = (sides) => {
    const slice = (Math.PI * 2) / sides;
    const inner = THREE.MathUtils.euclideanModulo(angle, slice);
    return Math.cos(Math.PI / sides) / Math.cos(inner - Math.PI / sides);
  };

  switch (type) {
    case "triangle":
      return polygonRadius(3);
    case "square":
      return polygonRadius(4);
    case "circle":
    default:
      return 1;
  }
};

const createSlabGeometry = (t) => {
  const shapeT = applyCurve(t, params.shapeCurve);
  const segments = 64;
  const points = [];

  for (let i = 0; i < segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    const rBottom = polarRadiusForShape(params.shapeBottom, theta);
    const rTop = polarRadiusForShape(params.shapeTop, theta);
    const r = lerp(rBottom, rTop, shapeT);
    const x = Math.cos(theta) * r * 0.5 * params.slabWidth;
    const y = Math.sin(theta) * r * 0.5 * params.slabDepth;
    points.push(new THREE.Vector2(x, y));
  }

  const shape = new THREE.Shape(points);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: params.slabThickness,
    bevelEnabled: false,
    curveSegments: segments,
  });

  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, params.slabThickness * 0.5, 0);
  return geometry;
};

const disposeTower = () => {
  while (towerGroup.children.length > 0) {
    const child = towerGroup.children.pop();
    if (!child) continue;
    child.geometry?.dispose();
    child.material?.dispose();
  }
};

const rebuildTower = () => {
  disposeTower();

  const floors = Math.max(1, Math.floor(params.floors));
  for (let i = 0; i < floors; i += 1) {
    const t = floors === 1 ? 0 : i / (floors - 1);
    const twistXT = applyCurve(t, params.twistXCurve);
    const twistYT = applyCurve(t, params.twistYCurve);
    const twistZT = applyCurve(t, params.twistZCurve);
    const scaleT = applyCurve(t, params.scaleCurve);

    const twistX = lerp(params.twistXMin, params.twistXMax, twistXT);
    const twistY = lerp(params.twistYMin, params.twistYMax, twistYT);
    const twistZ = lerp(params.twistZMin, params.twistZMax, twistZT);
    const scale = lerp(params.scaleMin, params.scaleMax, scaleT);
    const bendT = applyCurve(t, params.bendCurve);
    const totalAngle = THREE.MathUtils.degToRad(params.bendAngle);
    const bendYaw = THREE.MathUtils.degToRad(params.bendDirection);
    const totalHeight = (floors - 1) * params.floorHeight || 1;
    const radius =
      Math.abs(totalAngle) < 1e-4 ? 0 : totalHeight / totalAngle;
    const angle = totalAngle * bendT;

    let localX = 0;
    let localY = t * totalHeight;
    let tangent = new THREE.Vector3(0, 1, 0);

    if (radius !== 0) {
      localX = radius * (1 - Math.cos(angle));
      localY = radius * Math.sin(angle);
      tangent = new THREE.Vector3(
        Math.sin(angle),
        Math.cos(angle),
        0
      ).normalize();
    }

    const endX = radius === 0 ? 0 : radius * (1 - Math.cos(totalAngle));
    const endY = radius === 0 ? totalHeight : radius * Math.sin(totalAngle);
    const offset = new THREE.Vector3(endX * 0.5, endY * 0.5, 0);
    const localPos = new THREE.Vector3(localX, localY, 0).sub(offset);
    localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), bendYaw);
    const bendX = localPos.x;
    const bendZ = localPos.z;

    const color = new THREE.Color(params.colorBottom).lerp(
      new THREE.Color(params.colorTop),
      t
    );

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: params.roughness,
      metalness: params.metalness,
    });

    const slabGeometry = createSlabGeometry(t);
    const slab = new THREE.Mesh(slabGeometry, material);
    slab.castShadow = true;
    slab.receiveShadow = true;

    slab.scale.set(scale, 1, scale);

    slab.position.set(bendX, localPos.y, bendZ);

    const twistEuler = new THREE.Euler(
      THREE.MathUtils.degToRad(twistX),
      THREE.MathUtils.degToRad(twistY),
      THREE.MathUtils.degToRad(twistZ),
      "XYZ"
    );
    const twistQuat = new THREE.Quaternion().setFromEuler(twistEuler);
    const bendQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      tangent.applyAxisAngle(new THREE.Vector3(0, 1, 0), bendYaw)
    );
    slab.quaternion.copy(bendQuat).multiply(twistQuat);

    towerGroup.add(slab);
  }
};

const gui = new GUI({ width: 300 });

gui.title("Tower Controls");

const defaults = structuredClone(params);

const makeReset = (folder, keys, controllers) => {
  const controllerMap = new Map(
    controllers.map((controller) => [controller._key, controller])
  );

  folder.add(
    {
      reset: () => {
        keys.forEach((key) => {
          params[key] = defaults[key];
          const controller = controllerMap.get(key);
          if (controller) controller.setValue(params[key]);
        });
        rebuildTower();
      },
    },
    "reset"
  );
};

const addControl = (folder, key, ...args) => {
  const controller = folder.add(params, key, ...args).onChange(rebuildTower);
  controller._key = key;
  return controller;
};

const addColorControl = (folder, key) => {
  const controller = folder.addColor(params, key).onChange(rebuildTower);
  controller._key = key;
  return controller;
};

const layoutFolder = gui.addFolder("Layout");
const layoutControllers = [
  addControl(layoutFolder, "floors", 1, 200, 1),
  addControl(layoutFolder, "floorHeight", 0.2, 2, 0.01),
  addControl(layoutFolder, "slabWidth", 2, 20, 0.1),
  addControl(layoutFolder, "slabDepth", 2, 20, 0.1),
  addControl(layoutFolder, "slabThickness", 0.1, 1.2, 0.01),
];
makeReset(layoutFolder, [
  "floors",
  "floorHeight",
  "slabWidth",
  "slabDepth",
  "slabThickness",
], layoutControllers);

const shapeFolder = gui.addFolder("Shape Gradient");
const shapeControllers = [
  addControl(shapeFolder, "shapeBottom", shapeOptions),
  addControl(shapeFolder, "shapeTop", shapeOptions),
  addControl(shapeFolder, "shapeCurve", curveOptions),
];
makeReset(shapeFolder, ["shapeBottom", "shapeTop", "shapeCurve"], shapeControllers);

const twistXFolder = gui.addFolder("Twist X");
const twistXControllers = [
  addControl(twistXFolder, "twistXMin", -180, 180, 1),
  addControl(twistXFolder, "twistXMax", -180, 180, 1),
  addControl(twistXFolder, "twistXCurve", curveOptions),
];
makeReset(twistXFolder, ["twistXMin", "twistXMax", "twistXCurve"], twistXControllers);

const twistYFolder = gui.addFolder("Twist Y");
const twistYControllers = [
  addControl(twistYFolder, "twistYMin", -180, 180, 1),
  addControl(twistYFolder, "twistYMax", -180, 180, 1),
  addControl(twistYFolder, "twistYCurve", curveOptions),
];
makeReset(twistYFolder, ["twistYMin", "twistYMax", "twistYCurve"], twistYControllers);

const twistZFolder = gui.addFolder("Twist Z");
const twistZControllers = [
  addControl(twistZFolder, "twistZMin", -180, 180, 1),
  addControl(twistZFolder, "twistZMax", -180, 180, 1),
  addControl(twistZFolder, "twistZCurve", curveOptions),
];
makeReset(twistZFolder, ["twistZMin", "twistZMax", "twistZCurve"], twistZControllers);

const scaleFolder = gui.addFolder("Scale Gradient");
const scaleControllers = [
  addControl(scaleFolder, "scaleMin", 0.2, 2, 0.01),
  addControl(scaleFolder, "scaleMax", 0.2, 2, 0.01),
  addControl(scaleFolder, "scaleCurve", curveOptions),
];
makeReset(scaleFolder, ["scaleMin", "scaleMax", "scaleCurve"], scaleControllers);

const bendFolder = gui.addFolder("Bend");
const bendControllers = [
  addControl(bendFolder, "bendAngle", -180, 180, 1),
  addControl(bendFolder, "bendDirection", -180, 180, 1),
  addControl(bendFolder, "bendCurve", curveOptions),
];
makeReset(bendFolder, ["bendAngle", "bendDirection", "bendCurve"], bendControllers);

const colorFolder = gui.addFolder("Color");
const colorControllers = [
  addColorControl(colorFolder, "colorBottom"),
  addColorControl(colorFolder, "colorTop"),
];
makeReset(colorFolder, ["colorBottom", "colorTop"], colorControllers);

const materialFolder = gui.addFolder("Material");
const materialControllers = [
  addControl(materialFolder, "roughness", 0, 1, 0.01),
  addControl(materialFolder, "metalness", 0, 1, 0.01),
];
makeReset(materialFolder, ["roughness", "metalness"], materialControllers);

rebuildTower();

const resize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
};

window.addEventListener("resize", resize);

const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};

animate();
