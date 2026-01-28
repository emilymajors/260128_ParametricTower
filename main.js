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
  twistMin: -15,
  twistMax: 55,
  twistAxis: "y",
  twistCurve: "smoothstep",
  scaleCurve: "smoothstep",
  bendAmount: 6,
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

const axisOptions = {
  x: "x",
  y: "y",
  z: "z",
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
  const height = (floors - 1) * params.floorHeight;
  const baseY = height * 0.5;

  for (let i = 0; i < floors; i += 1) {
    const t = floors === 1 ? 0 : i / (floors - 1);
    const twistT = applyCurve(t, params.twistCurve);
    const scaleT = applyCurve(t, params.scaleCurve);

    const twist = lerp(params.twistMin, params.twistMax, twistT);
    const scale = lerp(params.scaleMin, params.scaleMax, scaleT);
    const bendT = applyCurve(t, params.bendCurve);

    const bendDistance = params.bendAmount * bendT;
    const bendAngleRad = THREE.MathUtils.degToRad(params.bendDirection);
    const bendX = Math.cos(bendAngleRad) * bendDistance;
    const bendZ = Math.sin(bendAngleRad) * bendDistance;

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

    slab.position.set(bendX, i * params.floorHeight - baseY, bendZ);

    if (params.twistAxis === "x") {
      slab.rotation.x = THREE.MathUtils.degToRad(twist);
    } else if (params.twistAxis === "z") {
      slab.rotation.z = THREE.MathUtils.degToRad(twist);
    } else {
      slab.rotation.y = THREE.MathUtils.degToRad(twist);
    }

    towerGroup.add(slab);
  }
};

const gui = new GUI({ width: 300 });

gui.title("Tower Controls");

const layoutFolder = gui.addFolder("Layout");
layoutFolder.add(params, "floors", 1, 200, 1).onChange(rebuildTower);
layoutFolder.add(params, "floorHeight", 0.2, 2, 0.01).onChange(rebuildTower);
layoutFolder.add(params, "slabWidth", 2, 20, 0.1).onChange(rebuildTower);
layoutFolder.add(params, "slabDepth", 2, 20, 0.1).onChange(rebuildTower);
layoutFolder
  .add(params, "slabThickness", 0.1, 1.2, 0.01)
  .onChange(rebuildTower);

const shapeFolder = gui.addFolder("Shape Gradient");
shapeFolder.add(params, "shapeBottom", shapeOptions).onChange(rebuildTower);
shapeFolder.add(params, "shapeTop", shapeOptions).onChange(rebuildTower);
shapeFolder.add(params, "shapeCurve", curveOptions).onChange(rebuildTower);

const twistFolder = gui.addFolder("Twist Gradient");
twistFolder.add(params, "twistMin", -180, 180, 1).onChange(rebuildTower);
twistFolder.add(params, "twistMax", -180, 180, 1).onChange(rebuildTower);
twistFolder.add(params, "twistAxis", axisOptions).onChange(rebuildTower);
twistFolder
  .add(params, "twistCurve", curveOptions)
  .onChange(rebuildTower);

const scaleFolder = gui.addFolder("Scale Gradient");
scaleFolder.add(params, "scaleMin", 0.2, 2, 0.01).onChange(rebuildTower);
scaleFolder.add(params, "scaleMax", 0.2, 2, 0.01).onChange(rebuildTower);
scaleFolder
  .add(params, "scaleCurve", curveOptions)
  .onChange(rebuildTower);

const bendFolder = gui.addFolder("Bend");
bendFolder.add(params, "bendAmount", 0, 20, 0.1).onChange(rebuildTower);
bendFolder.add(params, "bendDirection", -180, 180, 1).onChange(rebuildTower);
bendFolder.add(params, "bendCurve", curveOptions).onChange(rebuildTower);

const colorFolder = gui.addFolder("Color");
colorFolder.addColor(params, "colorBottom").onChange(rebuildTower);
colorFolder.addColor(params, "colorTop").onChange(rebuildTower);

const materialFolder = gui.addFolder("Material");
materialFolder.add(params, "roughness", 0, 1, 0.01).onChange(rebuildTower);
materialFolder.add(params, "metalness", 0, 1, 0.01).onChange(rebuildTower);

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
