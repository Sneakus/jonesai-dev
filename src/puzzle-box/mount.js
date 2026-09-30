import * as THREE from "three-160";
import { RoomEnvironment } from "three-160/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three-160/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three-160/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three-160/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three-160/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three-160/examples/jsm/postprocessing/OutputPass.js";
import { HorizontalBlurShader } from "three-160/examples/jsm/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three-160/examples/jsm/shaders/VerticalBlurShader.js";

export async function mountPuzzleBox(stage) {
  const breathe = () => new Promise((resolve) => { setTimeout(resolve, 0); });
  const setupStarted = performance.now();
  let contactDirty = true;
  let touchable = false;

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const DPR = Math.min(devicePixelRatio || 1, coarse ? 1.75 : 2);
const TEX = {
  wood: "/puzzle-box/wood.jpg",
  woodRough: "/puzzle-box/woodRough.jpg",
  woodBump: "/puzzle-box/woodBump.jpg",
  brassRough: "/puzzle-box/brassRough.jpg",
};


// ---------------- renderer, scene, camera ----------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

// a studio backdrop in the page's paper tones, lighter in the middle, like a lit sweep
(function backdrop() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  const g = x.createRadialGradient(256, 230, 20, 256, 300, 380);
  g.addColorStop(0, '#fffaf1'); g.addColorStop(0.55, '#efe6d6'); g.addColorStop(1, '#d9ceba');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
})();

// ---------------- light: a proper studio environment for reflections, a warm key with soft shadows, a cool rim ----------------
await breathe();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.03).texture;
await breathe();
const key = new THREE.DirectionalLight(0xfff1de, 2.0);
key.position.set(3.2, 6.5, 3.8); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 4; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 3, far: 13 });
scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe8ff, 0.8); rim.position.set(-4, 3, -5); scene.add(rim);
scene.add(new THREE.HemisphereLight(0xfff7ec, 0xcfc3ae, 0.35));

// the table top: catches the key light's shadow faintly
const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: 0.12 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// ---------------- materials ----------------
const aniso = renderer.capabilities.getMaxAnisotropy();
async function tex(uri, srgb, rx, ry) {
  await breathe();
  const bitmap = await createImageBitmap(await (await fetch(uri)).blob());
  await breathe();
  const t = new THREE.Texture(bitmap);
  t.needsUpdate = true;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  if (rx) t.repeat.set(rx, ry);
  contactDirty = true;
  return t;
}
const woodMap = await tex(TEX.wood, true), woodRoughMap = await tex(TEX.woodRough), woodBumpMap = await tex(TEX.woodBump);
const wood = new THREE.MeshPhysicalMaterial({ map: woodMap, roughnessMap: woodRoughMap, roughness: 1, bumpMap: woodBumpMap, bumpScale: 0.6,
  clearcoat: 0.3, clearcoatRoughness: 0.32, envMapIntensity: 0.7 });   // a satin oil finish, not a plastic gloss
const brassRough = await tex(TEX.brassRough, false, 2, 2);
const brass = new THREE.MeshStandardMaterial({ color: 0xB8914E, metalness: 1, roughness: 1, roughnessMap: brassRough, envMapIntensity: 0.9 });   // aged, softly polished brass
const darkBrass = new THREE.MeshStandardMaterial({ color: 0x8C6B34, metalness: 1, roughness: 0.5 });
const recess = new THREE.MeshStandardMaterial({ color: 0x1f150e, roughness: 0.85 });
const inlayMat = new THREE.MeshStandardMaterial({ color: 0xD9B98A, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

function boxUV(g, scale, yOff) {
  // One board wrapped round the box: the grain runs continuously from the front, round each corner, along the sides and
  // back, and on up into the lid, the way a fine box is cut from a single piece of wood. The top folds over from the front.
  g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i), ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const X = p.getX(i), Y = p.getY(i) + yOff, Z = p.getZ(i);
    let U, V = Y;
    if (ay >= ax && ay >= az) { U = X + W / 2; V = ny > 0 ? Y + (D / 2 - Z) : -Y - (D / 2 - Z); }   // top folds over from the front
    else if (az >= ax && nz > 0) U = X + W / 2;                       // front
    else if (ax > az && nx > 0) U = W + (D / 2 - Z);                  // right side
    else if (az >= ax) U = W + D + (W / 2 - X);                       // back
    else U = 2 * W + D + (Z + D / 2);                                 // left side
    uv[i * 2] = U * scale; uv[i * 2 + 1] = V * scale * 2;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ---------------- the box ----------------
const W = 2.4, D = 1.6, H = 1.0, LID = 0.34, GAP = 0.012, R = 0.05;
const box = new THREE.Group(); scene.add(box);
// the body is hollow: walls with rounded, bevelled edges, a floor, and a baize lining (so there is something to open)
const T = 0.1, FLOOR = 0.27, BEV2 = 0.018;
function rrect(w, d, r, hole) {
  const s = hole ? new THREE.Path() : new THREE.Shape(), x0 = -w / 2, z0 = -d / 2, x1 = w / 2, z1 = d / 2;
  s.moveTo(x0 + r, z0); s.lineTo(x1 - r, z0); s.quadraticCurveTo(x1, z0, x1, z0 + r); s.lineTo(x1, z1 - r); s.quadraticCurveTo(x1, z1, x1 - r, z1);
  s.lineTo(x0 + r, z1); s.quadraticCurveTo(x0, z1, x0, z1 - r); s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
  return s;
}
function walls(w, d, t, h, bev) {
  const shape = rrect(w - 2 * bev, d - 2 * bev, R, false);
  shape.holes.push(rrect(w - 2 * t + 2 * bev, d - 2 * t + 2 * bev, 0.02, true));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(Math.PI / 2); g.translate(0, h - bev, 0);   // extrude downwards from the top edge, so the walls stand from 0 to h
  return g;
}
// the walls are drawn everywhere except inside a pocket's opening (marked first in the stencil), so pockets are real holes
const cutWood = Object.assign(wood.clone(), { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.KeepStencilOp });
await breathe();
const body = new THREE.Mesh(boxUV(walls(W, D, T, H, BEV2), 0.25, 0), cutWood);
body.castShadow = body.receiveShadow = true; box.add(body);
await breathe();
const baize = new THREE.MeshStandardMaterial({ color: 0x2c5a40, roughness: 1, metalness: 0 });
const floorSlab = new THREE.Mesh(boxUV(new THREE.BoxGeometry(W - 2 * T + 0.03, FLOOR, D - 2 * T + 0.03).translate(0, FLOOR / 2, 0), 0.25, 0), wood); box.add(floorSlab);
const liningFloor = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * T, D - 2 * T), baize); liningFloor.rotation.x = -Math.PI / 2; liningFloor.position.y = FLOOR + 0.001; liningFloor.receiveShadow = true; box.add(liningFloor);
// the seam between lid and body: a thin dark frame you glimpse in the gap
const seam = new THREE.Mesh(walls(W - 0.03, D - 0.03, T - 0.015, GAP + 0.01, 0.001), recess); seam.position.y = H - 0.005; box.add(seam);
const lid = new THREE.Group(); lid.position.set(0, H + GAP, -D / 2); box.add(lid);   // hinged along the back edge
await breathe();
const lidMesh = new THREE.Mesh(boxUV(new RoundedBoxGeometry(W, LID, D, 6, R).translate(0, LID / 2, 0), 0.25, H + GAP), wood);
lidMesh.position.z = D / 2; lidMesh.castShadow = lidMesh.receiveShadow = true; lid.add(lidMesh);
await breathe();
const lidLining = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * T, D - 2 * T), baize); lidLining.rotation.x = Math.PI / 2; lidLining.position.set(0, -0.001, D / 2); lid.add(lidLining);
// a pale maple stringing line inlaid round the lid
(function inlay() {
  const ix = W / 2 - 0.2, iz = D / 2 - 0.2, w = 0.018, y = LID + 0.0005;
  [[0, iz, ix * 2 + w, w], [0, -iz, ix * 2 + w, w], [ix, 0, w, iz * 2], [-ix, 0, w, iz * 2]].forEach(([x, z, sx, sz]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), inlayMat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z + D / 2); m.receiveShadow = true; lid.add(m);
  });
})();

// brass corner guards: they wrap each corner and stand a little proud of the wood, with small pins
const capGeo = new RoundedBoxGeometry(0.2, 0.2, 0.2, 4, 0.025), pinGeo = new THREE.SphereGeometry(0.012, 12, 8);
function cornerGuard(parent, x, y, z, sx, sy, sz) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const c = new THREE.Mesh(capGeo, brass); c.castShadow = true; c.receiveShadow = true; g.add(c);
  [[sx * 0.1, 0, 0], [0, sy * 0.1, 0], [0, 0, sz * 0.1]].forEach(([px, py, pz]) => { const p = new THREE.Mesh(pinGeo, darkBrass); p.position.set(px + (px ? 0.004 * sx : 0), py + (py ? 0.004 * sy : 0), pz + (pz ? 0.004 * sz : 0)); g.add(p); });
}
const OUT = 0.012;   // how far the brass stands proud of the wood
[-1, 1].forEach(sx => [-1, 1].forEach(sz => {
  cornerGuard(box, sx * (W / 2 - 0.1 + OUT), 0.1 - OUT + 0.002, sz * (D / 2 - 0.1 + OUT), sx, -1, sz);
  cornerGuard(lid, sx * (W / 2 - 0.1 + OUT), LID - 0.1 + OUT, sz * (D / 2 - 0.1 + OUT) + D / 2, sx, 1, sz);
}));
// hinges: a barrel of alternating knuckles on the back
[-0.7, 0.7].forEach(x => {
  for (let k = 0; k < 5; k++) {
    const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.066, 24), k % 2 ? brass : darkBrass);
    kn.rotation.z = Math.PI / 2; kn.position.set(x - 0.14 + k * 0.07, H + GAP / 2, -D / 2 - 0.03); kn.castShadow = true; box.add(kn);
  }
  const leaf = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.14, 0.012, 2, 0.004), brass); leaf.position.set(x, H - 0.07, -D / 2 - 0.007); box.add(leaf);
});
// feet: four small brass bun feet so it sits like a proper box
let footG = null;
[-1, 1].forEach(sx => [-1, 1].forEach(sz => {
  if (sx === 1 && sz === 1) {
    // this one is knurled round its edge, where the others are smooth, and it turns
    const g = new THREE.CylinderGeometry(0.055, 0.07, 0.04, 96, 2), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const rr = Math.hypot(v.x, v.z); if (rr < 0.05) continue; const a = Math.atan2(v.x, v.z), k = 1 - 0.05 * Math.abs(((a * 24 / Math.PI) % 2 + 2) % 2 - 1); p.setXYZ(i, v.x * k, v.y, v.z * k); }
    g.computeVertexNormals();
    footG = new THREE.Group(); footG.position.set(sx * (W / 2 - 0.2), -0.02, sz * (D / 2 - 0.2)); box.add(footG);
    const f = new THREE.Mesh(g, brass); f.castShadow = true; footG.add(f); return;
  }
  const f = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.04, 24), brass); f.position.set(sx * (W / 2 - 0.2), -0.02, sz * (D / 2 - 0.2)); f.castShadow = true; box.add(f);
}));
box.position.y = 0.04;
await breathe();

// ---------------- the lock: a brass escutcheon plate on the front, holding the keyhole and its swivel cover ----------------
const lock = new THREE.Group(); lock.position.set(0, H * 0.52, D / 2 + 0.006); box.add(lock);
const plate = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.44, 0.03, 4, 0.014), brass); plate.castShadow = plate.receiveShadow = true; lock.add(plate);
// four slotted screws
[[-0.13, 0.17], [0.13, 0.17], [-0.13, -0.17], [0.13, -0.17]].forEach(([x, y]) => {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 20), darkBrass); s.rotation.x = Math.PI / 2; s.position.set(x, y, 0.018); lock.add(s);
  const cut = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), recess); cut.position.set(x, y, 0.024); cut.rotation.z = Math.random() * Math.PI; lock.add(cut);
});
const rings = [];   // (no combination dials any more: the key is the last lock)
const ringValue = () => 0;

// ---------------- contact shadow: a soft, blurred shadow right under the box (the studio "grounding") ----------------
const CW = 3.6, CH = 2.8, CAM_H = 1.6;
const shadowGroup = new THREE.Group(); shadowGroup.position.y = 0.002; scene.add(shadowGroup);
const rtA = new THREE.WebGLRenderTarget(512, 512), rtB = new THREE.WebGLRenderTarget(512, 512);
rtA.texture.generateMipmaps = rtB.texture.generateMipmaps = false;
const planeGeo = new THREE.PlaneGeometry(CW, CH).rotateX(Math.PI / 2);
const contact = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: rtA.texture, opacity: 0.75, transparent: true, depthWrite: false }));
contact.renderOrder = 1; contact.scale.y = -1; shadowGroup.add(contact);
const blurPlane = new THREE.Mesh(planeGeo); blurPlane.visible = false; shadowGroup.add(blurPlane);
const shadowCam = new THREE.OrthographicCamera(-CW / 2, CW / 2, CH / 2, -CH / 2, 0, CAM_H); shadowCam.rotation.x = Math.PI / 2; shadowGroup.add(shadowCam);
const depthMat = new THREE.MeshDepthMaterial(); depthMat.userData.darkness = { value: 1.4 };
depthMat.onBeforeCompile = (sh) => { sh.uniforms.darkness = depthMat.userData.darkness; sh.fragmentShader = 'uniform float darkness;\n' + sh.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.12, 0.08, 0.05 ), ( 1.0 - fragCoordZ ) * darkness );'); };
depthMat.depthTest = depthMat.depthWrite = false;
const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader), vBlur = new THREE.ShaderMaterial(VerticalBlurShader); hBlur.depthTest = vBlur.depthTest = false;
function blurShadow(a) {
  blurPlane.visible = true;
  blurPlane.material = hBlur; hBlur.uniforms.tDiffuse.value = rtA.texture; hBlur.uniforms.h.value = a / 256;
  renderer.setRenderTarget(rtB); renderer.render(blurPlane, shadowCam);
  blurPlane.material = vBlur; vBlur.uniforms.tDiffuse.value = rtB.texture; vBlur.uniforms.v.value = a / 256;
  renderer.setRenderTarget(rtA); renderer.render(blurPlane, shadowCam);
  blurPlane.visible = false;
}
function renderContact() {
  const iv = typeof inspectG !== 'undefined' && inspectG.visible; if (iv) inspectG.visible = false;
  const bg = scene.background; scene.background = null; contact.visible = false; floor.visible = false;
  scene.overrideMaterial = depthMat; const ca = renderer.getClearAlpha(); renderer.setClearAlpha(0);
  renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(scene, shadowCam);
  scene.overrideMaterial = null; blurShadow(3.2); blurShadow(1.3);
  renderer.setRenderTarget(null); renderer.setClearAlpha(ca); scene.background = bg; contact.visible = true; floor.visible = true;
  contactDirty = false; if (iv) inspectG.visible = true;
}

// ---------------- post: a soft glow on the brightest brass highlights, then film-style tone and colour ----------------
await breathe();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType, stencilBuffer: true }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.05, 0.4, 0.98);   // only the very brightest glints glow, faintly
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------- sound: every material sounds like itself (made live for now; recorded sounds come in the site version) ----------------
let actx = null, noiseBuf = null;
function audio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function burst(freq, q, gain, decay, type) {   // a filtered noise hit: the body of a knock
  const a = audio(), t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  s.connect(f).connect(g).connect(a.destination); s.start(t, Math.random() * 0.3); s.stop(t + decay + 0.02);
}
function tone(freq, gain, decay, type, bend) {   // a ringing partial: the voice of metal
  const a = audio(), t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, t + decay);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + decay + 0.02);
}
const vary = (x, v) => x * (1 + (Math.random() - 0.5) * v);
const SND = {
  wood(strength) {
    // a knock on a hollow wooden box: a short click where your knuckle meets the wood, then the box body ringing
    // at a few low, quickly-dying frequencies (like knocking on a jewellery box), each slightly different every time
    try {
      burst(vary(3800, 0.1), 0.9, 0.05 * strength, 0.012, 'lowpass');
      [[175, 0.16, 0.07], [292, 0.11, 0.06], [468, 0.08, 0.04], [735, 0.055, 0.022], [1180, 0.035, 0.012]].forEach(([f, d, g]) => tone(vary(f, 0.06), g * strength, d, 'sine', 0.985));
      burst(vary(620, 0.1), 1.4, 0.035 * strength, 0.05);
    } catch (e) {}
  },
  brass(strength) { try { tone(vary(2350, 0.05), 0.035 * strength, 0.22); tone(vary(3710, 0.05), 0.02 * strength, 0.14); burst(5200, 3, 0.03 * strength, 0.02); } catch (e) {} },
  clunk() { try { tone(95, 0.16, 0.18, 'sine', 0.6); burst(420, 1.2, 0.12, 0.09); burst(2600, 4, 0.03, 0.03); } catch (e) {} },
  tick(engaged, strong) {
    try {
      if (engaged) { burst(vary(3200, 0.08), 6, strong ? 0.09 : 0.06, 0.025); tone(vary(1900, 0.05), 0.02, 0.05); }   // crisp and weighted
      else { burst(vary(1500, 0.1), 3, 0.045, 0.04); tone(vary(700, 0.08), 0.018, 0.06, 'triangle'); }                   // hollow and loose
    } catch (e) {}
  }
};

// ---------------- camera: glides and settles, never snaps; you can look underneath, and zoom in on any spot ----------------
const cam = { az: 0.05, el: 0.3, dist: 6.2 }, camT = { az: 0.05, el: 0.3, dist: 6.2 };
const HOME = new THREE.Vector3(0, 0.66, 0), target = HOME.clone(), targetT = HOME.clone();
let introT = reduce ? 1 : 0, zoomed = false;
if (reduce) { cam.az = camT.az = 0.55; }
function placeCamera() {
  camera.position.set(target.x + cam.dist * Math.cos(cam.el) * Math.sin(cam.az), target.y + cam.dist * Math.sin(cam.el), target.z + cam.dist * Math.cos(cam.el) * Math.cos(cam.az));
  camera.lookAt(target);
}

// ---------------- the mechanisms (stage 3) ----------------
// 1 a panel on the right-hand end slides up (it sits a hair proud and its grain runs a touch off)
// 2 behind it, a flush brass push-button; press it and a hidden drawer in the same end pops out
// 3 in the drawer, on baize, a brass key with three numbers stamped on its bow
// 4 a small brass cover under the dials swings aside to reveal a keyhole; turn the key and the dials wake
// 5 set the dials to the key's numbers: three pins drop, the bolt slides, the lid springs up
const brassBright = brass;
function tex2(draw, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
const P = {};   // the parts, by name

// --- 1 the end panel ---
const XE = W / 2;                                     // the right-hand end face
// where the panel normally sits the end was never varnished: paler, duller wood (as under any sliding panel)
const bareWood = new THREE.MeshStandardMaterial({ map: wood.map, color: 0xffffff, roughness: 0.92, emissive: 0x2e2116, emissiveMap: wood.map,
  stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.KeepStencilOp });
// a pocket cut into the right-hand end: an opening that removes the wall there, and a small lined cavity behind it
const pockets = [];
function pocketX(y, z, w, hgt, depth) {
  const mask = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp }));
  mask.rotation.y = Math.PI / 2; mask.position.set(XE + 0.0003, y, z); mask.renderOrder = -10; mask.userData.noTouch = true; box.add(mask);
  const cav = new THREE.Mesh(new THREE.BoxGeometry(depth, hgt, w), new THREE.MeshStandardMaterial({ color: 0x5a3c26, roughness: 0.95, side: THREE.BackSide }));
  cav.position.set(XE - depth / 2 + 0.0002, y, z); cav.receiveShadow = true; cav.userData.noTouch = true; box.add(cav);
  pockets.push({ y, z, w, h: hgt });
}
const panelSlot = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), bareWood); panelSlot.rotation.y = Math.PI / 2; panelSlot.position.set(XE + 0.0004, 0.51, 0); box.add(panelSlot);
{ const uv = panelSlot.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.225 + 0.62, uv.getY(i) * 0.21 + 0.12); }
const panelG = new THREE.Group(); panelG.position.set(XE, 0.51, 0); box.add(panelG);
(function panel() {
  const g = boxUV(new RoundedBoxGeometry(0.007, 0.42, 0.9, 2, 0.0025), 0.25, 0.51);
  const uv = g.attributes.uv, a = 0.07;   // grain turned a few degrees: it doesn't quite match the board around it
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, u * Math.cos(a) - v * Math.sin(a) + 0.37, u * Math.sin(a) + v * Math.cos(a)); }
  const m = new THREE.Mesh(g, wood); m.position.x = 0.0042; m.castShadow = m.receiveShadow = true; panelG.add(m);   // a thin board riding on the end, 0.8 mm proud
  // the fine shadow line round the panel's edges travels with it
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.908, 0.428), recess); edge.rotation.y = Math.PI / 2; edge.position.x = 0.0007; panelG.add(edge);

})();
P.panel = { group: panelG, kind: 'slide', axis: new THREE.Vector3(0, 1, 0), value: 0, min: 0, max: 0.24, base: 0.51, stop: 0, locked: true, apply(v) { panelG.position.y = this.base + v; } };

// --- 0 the first move: a strip along the back slides a few millimetres sideways, which frees the end panel ---
const ZB = -D / 2;
const stripBare = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.1), bareWood); stripBare.rotation.y = Math.PI; stripBare.position.set(0, 0.3, ZB - 0.0004); box.add(stripBare);
const stripG = new THREE.Group(); stripG.position.set(0, 0.3, ZB); box.add(stripG);
(function strip() {
  const g = boxUV(new RoundedBoxGeometry(1.4, 0.1, 0.02, 3, 0.005), 0.25, 0.3);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.21, uv.getY(i) + 0.03);   // its own piece of wood
  const m = new THREE.Mesh(g, wood); m.position.z = -0.003 + 0.01; m.castShadow = m.receiveShadow = true; stripG.add(m);
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(1.408, 0.108), recess); edge.rotation.y = Math.PI; edge.position.z = -0.0007; stripG.add(edge);
})();
P.strip = { group: stripG, kind: 'slide', axis: new THREE.Vector3(1, 0, 0), value: 0, min: 0, max: 0.08, base: 0, stop: 0, apply(v) { stripG.position.x = v; if (v >= 0.07 && P.panel.locked) { P.panel.locked = false; setTimeout(() => SND.latch(), 60); } } };

// --- 2 behind the panel, a slim brass pin lies in a groove: a tool (like a SIM-tray pin, for the pinhole in the drawer below) ---
pocketX(0.42, 0.01, 0.36, 0.045, 0.04);   // the groove the tool lies in
function makeTool() {
  const t = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 14), brass); rod.rotation.x = Math.PI / 2; t.add(rod);
  const gripG = new THREE.CylinderGeometry(0.014, 0.014, 0.07, 48, 1), gp = gripG.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < gp.count; i++) { v.fromBufferAttribute(gp, i); const rr = Math.hypot(v.x, v.z); if (rr < 0.012) continue; const a = Math.atan2(v.x, v.z), k = 1 - 0.12 * Math.abs(((a * 12 / Math.PI) % 2 + 2) % 2 - 1); gp.setXYZ(i, v.x * k, v.y, v.z * k); }
  gripG.computeVertexNormals();
  const grip = new THREE.Mesh(gripG, brass); grip.rotation.x = Math.PI / 2; grip.position.z = -0.14; t.add(grip);
  t.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const grip2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), new THREE.MeshBasicMaterial({ visible: false })); grip2.rotation.x = Math.PI / 2; grip2.position.z = -0.02; t.add(grip2);
  return t;
}
const toolInGroove = makeTool(); toolInGroove.position.set(XE - 0.018, 0.42, 0.01); box.add(toolInGroove);   // sits below the surface
P.toolPickup = { group: toolInGroove, kind: 'pickup', what: 'tool' };
// --- 3 the drawer, hidden in the same end, and the key inside it ---
const drawerG = new THREE.Group(); drawerG.position.set(XE, 0.135, 0); box.add(drawerG);
const hair = new THREE.Mesh(new THREE.PlaneGeometry(1.0025, 0.1725), recess); hair.rotation.y = Math.PI / 2; hair.position.set(XE + 0.0003, 0.135, 0); box.add(hair);   // the finest seam
(function drawer() {
  const front = new THREE.Mesh(boxUV(new RoundedBoxGeometry(0.02, 0.17, 1.0, 2, 0.004), 0.25, 0.135), wood); front.position.x = -0.0095; front.castShadow = true; drawerG.add(front);
  const inner = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.8 });
  const sides = [[-0.46, 0, -0.49, 0.9, 0.15, 0.012], [-0.46, 0, 0.49, 0.9, 0.15, 0.012], [-0.9, 0, 0, 0.012, 0.15, 0.97]];
  sides.forEach(([x, y, z, sx, sy, sz]) => { const s = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), inner); s.position.set(x, y, z); drawerG.add(s); });
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.97), inner); bottom.position.set(-0.46, -0.072, 0); drawerG.add(bottom);
  const lining = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.95), baize); lining.rotation.x = -Math.PI / 2; lining.position.set(-0.46, -0.065, 0); drawerG.add(lining);
})();
function makeKey() {
  const k = new THREE.Group();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 16, 40), brass); k.add(bow);   // a plain ring bow
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.16, 16), brass); shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.14; k.add(shaft);
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.036, 0.008), brass); bit.position.set(0.2, -0.022, 0); k.add(bit);
  k.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return k;
}
const pinhole = new THREE.Group(); pinhole.position.set(0.0012, 0, 0); drawerG.add(pinhole);
const ph = new THREE.Mesh(new THREE.CircleGeometry(0.006, 16), new THREE.MeshBasicMaterial({ color: 0x0b0806 })); ph.rotation.y = Math.PI / 2; pinhole.add(ph);
const phHit = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ visible: false })); phHit.rotation.y = Math.PI / 2; phHit.position.x = 0.001; pinhole.add(phHit);
const toolInHole = makeTool(); toolInHole.rotation.y = Math.PI / 2; toolInHole.position.x = 0.13; toolInHole.visible = false; pinhole.add(toolInHole);   // pushed in, it stays there
P.pinhole = { group: phHit, kind: 'pinhole' };
P.drawer = { group: drawerG, kind: 'slide', axis: new THREE.Vector3(1, 0, 0), value: 0, min: 0.05, max: 0.72, base: XE, locked: true, stop: 0, apply(v) { drawerG.position.x = this.base + v; } };
const keyInDrawer = makeKey(); keyInDrawer.rotation.x = -Math.PI / 2; keyInDrawer.position.set(-0.36, -0.058, 0.05); keyInDrawer.rotation.z = 0.4; drawerG.add(keyInDrawer);
await breathe();
P.keyPickup = { group: keyInDrawer, kind: 'pickup', what: 'key' };
let holding = null, toolUsed = false, keyUsed = false;   // what's in your hand: null, 'tool' or 'key'

// --- 4 the cover and the keyhole, under the dials ---
const coverPivot = new THREE.Group(); coverPivot.position.set(0, 0.03, 0.016); lock.add(coverPivot);
const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.008, 36), brass); cover.rotation.x = Math.PI / 2; cover.position.set(0, -0.032, 0.004); cover.castShadow = true; coverPivot.add(cover);
const coverRivet = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), darkBrass); coverRivet.position.set(0, 0, 0.008); coverPivot.add(coverRivet);
const keyhole = new THREE.Group(); keyhole.position.set(0, -0.002, 0.0155); lock.add(keyhole);
const khA = new THREE.Mesh(new THREE.CircleGeometry(0.009, 20), new THREE.MeshBasicMaterial({ color: 0x0b0806 })); keyhole.add(khA);
const khB = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.02), khA.material); khB.position.y = -0.011; keyhole.add(khB);
const khHit = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ visible: false })); khHit.position.z = 0.002; keyhole.add(khHit);
P.cover = { group: coverPivot, kind: 'swivel', angle: 0, target: 0, min: 0, max: 1.9, pivotObj: coverPivot, stop: 0, apply(v) { coverPivot.rotation.z = v; },
  limit() { return footTurned ? 1.9 : 0.05; } };   // until the foot is turned it only rattles a hair
let footTurned = false, coverSwing = null;
P.foot = { group: footG, kind: 'knob', angle: 0, target: 0, min: 0, max: Math.PI / 2, pivotObj: footG, stop: 0, apply(v) {
  footG.rotation.y = -v; const notch = Math.floor(v / (Math.PI / 12)); if (notch !== this.notch) { this.notch = notch; SND.ratchet(); }
  if (v >= Math.PI / 2 - 0.02 && !footTurned) { footTurned = true; SND.latch(); give.vel.y += 0.06; coverSwing = { t: 0, from: P.cover.angle }; setTimeout(SND.whirr, 120); } }, limit() { return Math.PI / 2; } };
P.keyhole = { group: khHit, kind: 'keyhole' };
const keyHolder = new THREE.Group(); keyHolder.rotation.y = Math.PI / 2; keyHolder.position.z = 0.2; keyhole.add(keyHolder);   // shaft pointing into the plate
const keyInLock = makeKey(); keyInLock.visible = false; keyHolder.add(keyInLock);
// a generous, invisible grip round the bow: seen head-on a key in a lock is only a thin edge
const keyGrip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); keyInLock.add(keyGrip);
P.keyTurn = { group: keyInLock, kind: 'turn', angle: 0, target: 0, min: 0, max: Math.PI / 2, pivotObj: keyhole, done: false };

// --- the dials and the lid, as parts ---
const lidState = { angle: 0, target: 0, vel: 0, bumped: false, unlocked: false };
P.lid = { group: lid, kind: 'lid' };
let dialsEngaged = false, opened = false;

// tag each part's meshes so a touch finds its part
// the most specific part wins: a pinhole in the drawer is the pinhole, not the drawer (deepest parts are labelled first, and never overwritten)
const depthOf = o => { let d = 0; for (; o.parent && d < 50; o = o.parent) d++; return d; };
Object.entries(P).map(([name, p]) => [name, p.group || (p.ring && p.ring.group)]).filter(([, g]) => g)
  .sort((a, b) => depthOf(b[1]) - depthOf(a[1]))
  .forEach(([name, g]) => g.traverse(o => { if (o.isMesh && !o.userData.part) o.userData.part = name; }));
const readTags = () => { const out = {}; box.traverse(o => { if (o.isMesh && o.userData.part) out[o.userData.part] = (out[o.userData.part] || 0) + 1; }); return out; };
if (process.env.NEXT_PUBLIC_PUZZLE_TEST === "1") window.__tags = readTags;

// ---------------- the reward: a small Newton's cradle, standing on the baize inside ----------------
const cradle = new THREE.Group(); cradle.position.set(0, FLOOR, 0); box.add(cradle);
const NB = 5, BR = 0.055, LEN = 0.44, PY = 0.6, GRAV = 78;   // ball radius, string length, pivot height (box units: 1 unit is about 12.5 cm)
const steel = new THREE.MeshStandardMaterial({ color: 0xCFB27A, metalness: 1, roughness: 0.12 });
(function frame() {
  const barX = NB * BR * 2 + 0.2, postH = PY + 0.03;
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, postH, 12), darkBrass); p.position.set(sx * barX / 2, postH / 2, sz * 0.12); p.castShadow = true; cradle.add(p); }));
  [-1, 1].forEach(sz => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, barX, 12), darkBrass); b.rotation.z = Math.PI / 2; b.position.set(0, postH, sz * 0.12); cradle.add(b); });
  const base = new THREE.Mesh(new RoundedBoxGeometry(barX + 0.06, 0.03, 0.32, 2, 0.008), brass); base.position.y = 0.015; base.castShadow = true; base.receiveShadow = true; cradle.add(base);
})();
const balls = [], strings = [];
const strMat = new THREE.MeshBasicMaterial({ color: 0x3a3028 });
for (let i = 0; i < NB; i++) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(BR, 32, 20), steel); b.castShadow = true; cradle.add(b);
  b.userData.part = 'ball' + i;
  const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 1, 5), strMat), s2 = s1.clone(); cradle.add(s1); cradle.add(s2);
  balls.push({ mesh: b, px: (i - (NB - 1) / 2) * BR * 2, th: 0, w: 0, held: false }); strings.push([s1, s2]);
  P['ball' + i] = { kind: 'ball', i };
}
const up = new THREE.Vector3(0, 1, 0), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function placeString(s, a, b) { tmpA.subVectors(b, a); s.position.copy(a).addScaledVector(tmpA, 0.5); s.scale.set(1, tmpA.length(), 1); s.quaternion.setFromUnitVectors(up, tmpA.normalize()); }
function drawCradle() {
  balls.forEach((b, i) => {
    const x = b.px + LEN * Math.sin(b.th), y = PY - LEN * Math.cos(b.th); b.mesh.position.set(x, y, 0);
    [-0.12, 0.12].forEach((z, k) => placeString(strings[i][k], new THREE.Vector3(b.px, PY + 0.03, z), new THREE.Vector3(x, y + BR * 0.9, 0)));
  });
}
drawCradle();
await breathe();
let lastClack = 0;
function stepCradle(dt) {
  // each ball is a pendulum; when neighbours touch, equal balls swap their speeds (that's the whole trick of a Newton's cradle)
  let moving = false; const n = 8, h = dt / n;
  for (let s = 0; s < n; s++) {
    balls.forEach(b => {
      if (b.held) { b.w *= Math.exp(-10 * h); return; }   // held still, your hand soaks up its speed
      b.w += -(GRAV / LEN) * Math.sin(b.th) * h; b.w *= Math.exp(-0.05 * h); b.th += b.w * h;
      if (b.th > 2.7) { b.th = 2.7; if (b.w > 0) b.w *= -0.3; } if (b.th < -2.7) { b.th = -2.7; if (b.w < 0) b.w *= -0.3; }   // it can swing right up, but not wrap round the bar
    });
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < NB - 1; i++) {
        const a = balls[i], c = balls[i + 1];
        const xa = a.px + LEN * Math.sin(a.th), xc = c.px + LEN * Math.sin(c.th), over = 2 * BR - (xc - xa);
        if (over <= 0) continue;
        // sideways speed of each ball where they meet; equal balls hand their speed on (a little is lost in the clack)
        const ca = Math.max(0.2, Math.cos(a.th)), cc = Math.max(0.2, Math.cos(c.th)), va = LEN * a.w * ca, vc = LEN * c.w * cc;
        if (va - vc > 0) {
          const e = 0.992, speed = va - vc;
          if (a.held) { c.w = va / (LEN * cc); }                       // a ball in your hand strikes like a hammer
          else if (c.held) { a.w = vc / (LEN * ca); }
          else { a.w = vc * e / (LEN * ca); c.w = va * e / (LEN * cc); }
          if (speed > 0.05 && performance.now() - lastClack > 22) { lastClack = performance.now(); SND.clack2(Math.min(1, speed / 1.6)); }
        }
        // no overlapping: push apart whichever isn't in your hand
        if (a.held && !c.held) c.th = Math.asin(Math.max(-0.99, Math.min(0.99, (xa + 2 * BR - c.px) / LEN)));
        else if (c.held && !a.held) a.th = Math.asin(Math.max(-0.99, Math.min(0.99, (xc - 2 * BR - a.px) / LEN)));
        else if (!a.held && !c.held) { a.th -= over / (2 * LEN); c.th += over / (2 * LEN); }
      }
    }
  }
  balls.forEach(b => { if (Math.abs(b.w) > 0.02 || Math.abs(b.th) > 0.004 || b.held) moving = true; });
  drawCradle();
  return moving;
}

// ---------------- more sounds for the mechanisms ----------------
Object.assign(SND, {
  slide() { try { burst(vary(2300, 0.2), 0.7, 0.022, 0.06); burst(vary(700, 0.2), 1.0, 0.015, 0.06); } catch (e) {} },
  stopThunk() { try { SND.wood(1.1); tone(120, 0.06, 0.1, 'sine', 0.7); } catch (e) {} },
  tok() { try { tone(620, 0.08, 0.06, 'sine', 0.6); burst(1800, 2, 0.05, 0.03); SND.wood(0.7); } catch (e) {} },
  pinClick() { try { burst(4200, 5, 0.06, 0.02); tone(2900, 0.03, 0.06); } catch (e) {} },
  pickup() { try { tone(3100, 0.03, 0.25); tone(4700, 0.015, 0.18); burst(3000, 2, 0.03, 0.05); } catch (e) {} },
  keyIn() { try { const a = audio(), t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(3400, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.16); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + 0.2); } catch (e) {} },
  clack() { try { tone(150, 0.16, 0.2, 'sine', 0.6); burst(900, 1.5, 0.12, 0.08); SND.brass(1.2); } catch (e) {} },
  gate() { try { tone(330, 0.1, 0.14, 'sine', 0.62); burst(1100, 2, 0.07, 0.05); } catch (e) {} },
  bolt() { try { const a = audio(), t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.3); g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + 0.36); } catch (e) {} },
  spring() { try { tone(240, 0.08, 0.3, 'triangle', 1.8); SND.wood(0.8); } catch (e) {} },
  creak() { try { burst(vary(650, 0.2), 9, 0.02, 0.12); } catch (e) {} },
  latch() { try { burst(2600, 4, 0.05, 0.02); tone(1500, 0.025, 0.05); SND.wood(0.35); } catch (e) {} },
  ratchet() { try { burst(vary(3600, 0.1), 6, 0.03, 0.015); } catch (e) {} },
  rattle() { try { burst(vary(2900, 0.1), 5, 0.035, 0.02); setTimeout(() => burst(vary(2700, 0.1), 5, 0.025, 0.02), 45); } catch (e) {} },
  clack2(s) { try { burst(vary(4200, 0.08), 5, 0.1 * s + 0.01, 0.018); tone(vary(3300, 0.04), 0.045 * s + 0.005, 0.07); } catch (e) {} },
  lidSlide() { try { burst(vary(2100, 0.1), 0.8, 0.03, 0.1); } catch (e) {} },
  whirr() { try { for (let k = 0; k < 7; k++) setTimeout(() => burst(vary(3000, 0.15), 6, 0.022, 0.015), k * 70); } catch (e) {} }
});

// ---------------- what a touch does to each kind of part ----------------
function screenOf(v) { const p = v.clone().project(camera), r = renderer.domElement.getBoundingClientRect(); return new THREE.Vector2(r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height); }
function beginPart(name, e, hit) {
  const p = P[name];
  if (p.kind === 'slide') {
    if (p.locked) return null;
    const o = new THREE.Vector3(); p.group.getWorldPosition(o);
    const a = screenOf(o), b = screenOf(o.clone().add(p.axis)); const dir = b.sub(a);   // how the slide direction looks on screen
    return { name, x: e.clientX, y: e.clientY, start: p.value, dir };
  }
  if (p.kind === 'pickup') {
    if (holding) return null;
    if (p.what === 'tool' && P.panel.value > 0.18 && !toolUsed) { toolInGroove.visible = false; holding = 'tool'; SND.pickup(); showHand('tool'); setTimeout(() => inspect(true), 120); return { name }; }
    if (p.what === 'key' && P.drawer.value > 0.3 && !keyUsed) { keyInDrawer.visible = false; holding = 'key'; SND.pickup(); showHand('key'); setTimeout(() => inspect(true), 120); return { name }; }
    return null;
  }
  if (p.kind === 'pinhole') {
    if (holding !== 'tool' || !P.drawer.locked) return null;
    holding = null; toolUsed = true; showHand(null); toolInHole.visible = true; SND.keyIn(); refreshTouchables();
    setTimeout(() => { SND.pinClick(); popDrawer(); }, 380);
    return { name };
  }
  if (p.kind === 'keyhole') {
    if (holding === 'key' && P.cover.angle > 1.2) { holding = null; keyUsed = true; showHand(null); keyInLock.visible = true; SND.keyIn(); refreshTouchables(); return { name }; }
    return null;
  }
  if (p.kind === 'knob') return { name, x: e.clientX, start: p.angle };
  if (p.kind === 'swivel' || p.kind === 'turn') {
    if (p.kind === 'turn' && p.done) return null;
    const o = new THREE.Vector3(); p.pivotObj.getWorldPosition(o); const c = screenOf(o);
    return { name, c, a0: Math.atan2(e.clientY - c.y, e.clientX - c.x), start: p.angle };
  }
  if (p.kind === 'ring') { const r = p.ring; r.dragging = true; return { name, y: e.clientY, start: r.target }; }
  if (p.kind === 'lid') return { name, y: e.clientY, start: lidState.angle };
  if (p.kind === 'ball') {
    if (lidState.angle < 1.3) return null;
    const b = balls[p.i]; b.held = true; b.w = 0;
    const o = new THREE.Vector3(), nrm = new THREE.Vector3(0, 0, 1).transformDirection(cradle.matrixWorld); cradle.getWorldPosition(o);
    return { name, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(nrm, o), t: performance.now() };
  }
  return null;
}
function movePart(d, e) {
  const p = P[d.name];
  if (p.kind === 'slide') {
    const dx = e.clientX - d.x, dy = e.clientY - d.y, len2 = d.dir.lengthSq() || 1;
    const v = Math.max(p.min, Math.min(p.max, d.start + (dx * d.dir.x + dy * d.dir.y) / len2));
    if (Math.abs(v - p.value) > 0.004) SND.slide();
    if ((v >= p.max && p.value < p.max) || (v <= p.min && p.value > p.min)) SND.stopThunk();
    p.value = v; p.apply(v);
  } else if (p.kind === 'knob') {
    const v = Math.max(p.min, Math.min(p.max, d.start + (e.clientX - d.x) * 0.014)); p.angle = v; p.apply(v);
  } else if (p.kind === 'swivel' || p.kind === 'turn') {
    let da = Math.atan2(e.clientY - d.c.y, e.clientX - d.c.x) - d.a0; da = Math.atan2(Math.sin(da), Math.cos(da));
    const mx = p.limit ? p.limit() : p.max, v = Math.max(p.min, Math.min(mx, d.start - da));
    if (p.kind === 'swivel' && (v >= mx && p.angle < mx || v <= p.min && p.angle > p.min)) (mx < p.max ? SND.rattle : SND.pinClick)();
    p.angle = v;
    if (p.kind === 'swivel') p.apply(v);
    else { p.group.rotation.x = -v; if (v >= p.max - 0.02 && !p.done) { p.done = true; p.angle = p.max; dialsEngaged = true; SND.clack(); give.vel.z -= 0.1; setTimeout(unlockLid, 350); } }
  } else if (p.kind === 'ring') { p.ring.target = d.start + (e.clientY - d.y) * (dialsEngaged ? 0.012 : 0.016); }
  else if (p.kind === 'ball') {
    // where your pointer meets the cradle's swing plane: the ball's wire points there, all the way round
    const b = balls[p.i], r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    const hitP = ray.ray.intersectPlane(d.plane, new THREE.Vector3()); if (!hitP) return;
    const lp = cradle.worldToLocal(hitP), th = Math.max(-2.6, Math.min(2.6, Math.atan2(lp.x - b.px, PY - lp.y)));
    const now2 = performance.now(), dts = Math.max(0.008, (now2 - d.t) / 1000); d.t = now2;
    b.w = Math.max(-28, Math.min(28, b.w * 0.5 + ((th - b.th) / dts) * 0.5));   // how fast you're moving it is what it keeps when you let go
    b.th = th;
  }
  else if (p.kind === 'lid') {
    if (!lidState.unlocked) {
      const want = Math.max(0, Math.min(0.018, -(e.clientY - d.y) * 0.0006)); lidState.target = want;
      if (want >= 0.018 && !lidState.bumped) { lidState.bumped = true; SND.clunk(); give.vel.y -= 0.12; }
      if (want < 0.012) lidState.bumped = false;
    } else {
      const want = Math.max(0.05, Math.min(1.95, d.start - (e.clientY - d.y) * 0.006));
      if (Math.abs(want - lidState.target) > 0.05) SND.creak();
      lidState.target = want;
    }
  }
}
function endPart(d) {
  const p = P[d.name], name = d.name;
  if (p.kind === 'ball') balls[p.i].held = false;
  if (p.kind === 'ring') { const step = Math.PI / 5, r = p.ring; r.target = Math.round(r.target / step) * step; r.dragging = false; setTimeout(checkDials, 180); }
  if (p.kind === 'lid') {
    if (!lidState.unlocked) { lidState.target = 0; lidState.bumped = false; }
    else { lidState.target = lidState.target > 1.0 ? 1.95 : 0.05; if (lidState.target === 1.95 && !opened) { opened = true; } }
  }
  if (name === 'cover' && !footTurned) { P.cover.angle = 0; P.cover.apply(0); }
}
function popDrawer() { P.drawer.locked = false; P.drawer.value = 0.05; P.drawer.apply(0.05); SND.tok(); give.vel.x += 0.08; wake(); }
function checkDials() {}
function unlockLid() {
  if (lidState.unlocked) return;
  // the key's turn works the bolt: three levers lift, the bolt slides back, and the lid springs up
  [0, 160, 320].forEach(t => setTimeout(() => SND.pinClick(), t));
  setTimeout(SND.bolt, 520);
  setTimeout(() => { lidState.unlocked = true; lidState.target = 0.05; SND.spring(); wake(); }, 900);
}

// the key "in your hand": a small, wordless brass disc in the corner while you're holding it
const hand = document.createElement('div'); hand.className = 'hand'; hand.setAttribute('aria-label', 'Holding a key');
const ICON = {
  tool: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 38L34 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M31 11l6 6" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>',
  key: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="15" cy="24" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M23 24h18M35 24v7M40 24v5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  cube: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8l14 7v18l-14 7-14-7V15z M10 15l14 7 14-7 M24 22v18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>' };
stage.appendChild(hand);
function showHand(kind) { hand.classList.toggle('on', !!kind); if (kind) { hand.innerHTML = ICON[kind]; hand.setAttribute('aria-label', kind === 'key' ? 'Holding a key' : 'Holding a small box'); } }
const inspectG = new THREE.Group(); inspectG.visible = false; camera.add(inspectG); scene.add(camera);
const veil = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x1c140e, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
veil.position.z = -3; veil.renderOrder = 10; inspectG.add(veil);
function asHeld(obj) { obj.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => { const c = m.clone(); c.transparent = true; return c; }) : Object.assign(o.material.clone(), { transparent: true }); o.renderOrder = 11; o.castShadow = false; } }); return obj; }
const heldKey = asHeld(makeKey());
const heldTool = asHeld(makeTool()); heldTool.visible = false;
const heldPivot = new THREE.Group(); heldPivot.position.set(0, 0, -1.1); inspectG.add(heldPivot);
heldKey.position.x = -0.13; heldPivot.add(heldKey); heldPivot.add(heldTool);
// Always in the scene, even while the held view is hidden. Switching a light on would change the light count and rebuild every material.
const inspectLight = new THREE.PointLight(0xfff1de, 0, 6); inspectLight.position.set(0.6, 0.8, -0.2); camera.add(inspectLight);
const closeBtn = document.createElement('button'); closeBtn.className = 'closeInspect'; closeBtn.setAttribute('aria-label', 'Put it down');
closeBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
stage.appendChild(closeBtn);
let inspecting = false, spin = { x: 0.9, y: -0.4 }, spinT = { x: 0.9, y: -0.4 }, heldZoom = 1;
function inspect(on) {
  inspecting = on; inspectG.visible = on; inspectLight.intensity = on ? 3 : 0; closeBtn.classList.toggle('on', on); hand.classList.toggle('open', on);
  if (on) {
    heldKey.visible = holding === 'key'; heldTool.visible = holding === 'tool';
    // fit it to about half of the smaller side of the view, whatever the screen
    const visH = 2 * 1.1 * Math.tan(camera.fov * Math.PI / 360), fit = 0.5 * Math.min(visH, visH * camera.aspect), size = holding === 'key' ? 0.27 : 0.37;
    heldKey.scale.setScalar(fit / 0.27); heldTool.scale.setScalar(fit / size);
    spinT.x = holding === 'key' ? 0.9 : 0.4; spinT.y = -0.4; heldZoom = 1; heldPivot.scale.setScalar(0.6);
  }
  wake();
}
closeBtn.addEventListener('pointerdown', e => { e.stopPropagation(); });
closeBtn.addEventListener('click', e => { e.stopPropagation(); inspect(false); });
hand.addEventListener('pointerdown', e => { e.stopPropagation(); });
hand.addEventListener('click', e => { e.stopPropagation(); if (holding) { audio(); inspect(!inspecting); } });
const onKey = (e) => { if (e.key === 'Escape' && inspecting) inspect(false); };
addEventListener('keydown', onKey);
function tapHeld(e) {}   // (nothing to open in your hands now: the tool and key are just to look at)

// ---------------- the feel ----------------
// Nothing about the pointer changes over special parts. Instead, everything is physical:
// press any surface and the box yields a touch with the right sound; the lid lifts a hair and clunks (locked);
// the dials spin loose and hollow until they're earned. Grab a part to move it; drag anywhere else to turn the box.
const matOf = new Map();   // which material each mesh is made of, for its sound
box.traverse(o => { if (o.isMesh) { const m = Array.isArray(o.material) ? o.material[0] : o.material; matOf.set(o, (m === brass || m === darkBrass) ? 'brass' : 'wood'); } });
const touchables = [];
function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
function refreshTouchables() { touchables.length = 0; box.traverse(o => { if (o.isMesh && shown(o) && !o.userData.noTouch) touchables.push(o); }); }
refreshTouchables();
function partOf(o) { for (; o; o = o.parent) if (o.userData && o.userData.part) return o.userData.part; return null; }
function isIn(obj, group) { for (let o = obj; o; o = o.parent) if (o === group) return true; return false; }
const give = { off: new THREE.Vector3(), vel: new THREE.Vector3() };   // the whole box's tiny yield when pressed

const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function hitAt(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(touchables, false);
  for (const h of hits) {
    if (h.object === body || h.object === panelSlot) {
      const lp = box.worldToLocal(h.point.clone());
      if (lp.x > XE - 0.002 && pockets.some(pk => Math.abs(lp.y - pk.y) < pk.h / 2 && Math.abs(lp.z - pk.z) < pk.w / 2)) continue;
    }
    return h;
  }
  return null;
}
let drag = null, lastTap = { t: 0, x: 0, y: 0 };
const pointers = {}; let pinch0 = 0;
stage.addEventListener('pointerdown', e => {
  if (!touchable) return;
  audio();   // sound can only start from a touch or click
  if (inspecting) {
    stage.setPointerCapture(e.pointerId); pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ids = Object.keys(pointers);
    if (ids.length === 2) { const a = pointers[ids[0]], b = pointers[ids[1]]; drag = { kind: 'inspectPinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: heldZoom }; return; }
    drag = { kind: 'inspect', x: e.clientX, y: e.clientY, sx: spinT.x, sy: spinT.y, moved: false }; return;
  }
  stage.setPointerCapture(e.pointerId); pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  const ids = Object.keys(pointers);
  if (ids.length === 2) { const a = pointers[ids[0]], b = pointers[ids[1]]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); drag = { kind: 'pinch', dist0: camT.dist }; wake(); return; }
  introT = 1;
  const hit = hitAt(e), now = performance.now();
  // double tap / double click: zoom in on that spot, or back out
  if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24) {
    lastTap.t = 0;
    if (hit && !zoomed) { targetT.copy(hit.point); camT.dist = 3.0; zoomed = true; } else { targetT.copy(HOME); camT.dist = 6.2; zoomed = false; }
    drag = null; wake(); return;
  }
  lastTap = { t: now, x: e.clientX, y: e.clientY };
  if (hit) {
    const obj = hit.object;
    // press: the box yields a touch away from your finger, and knocks with the sound of what you touched
    const n = hit.face ? hit.face.normal.clone().transformDirection(obj.matrixWorld) : new THREE.Vector3(0, 0, 1);
    give.vel.addScaledVector(n, -0.12);
    (matOf.get(obj) === 'wood' ? SND.wood : SND.brass)(0.8);
    const name = partOf(obj), d = name ? beginPart(name, e, hit) : null;
    if (d) { drag = { kind: 'part', d }; refreshTouchables(); }
    else drag = { kind: 'probe', x: e.clientX, y: e.clientY, orbiting: false, az: camT.az, el: camT.el };
  } else { drag = { kind: 'orbit', x: e.clientX, y: e.clientY, az: camT.az, el: camT.el, orbiting: true }; stage.classList.add('grabbing'); }
  wake();
});
stage.addEventListener('pointermove', e => {
  if (pointers[e.pointerId]) { pointers[e.pointerId].x = e.clientX; pointers[e.pointerId].y = e.clientY; }
  if (!drag) return;
  if (drag.kind === 'pinch') {
    const ids = Object.keys(pointers); if (ids.length < 2) return;
    const a = pointers[ids[0]], b = pointers[ids[1]], dd = Math.hypot(a.x - b.x, a.y - b.y);
    const want = Math.max(2.6, Math.min(9, drag.dist0 * pinch0 / Math.max(1, dd)));
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, want / camT.dist);
    // two fingers moving together turn the box
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    if (drag.cx === undefined) { drag.cx = cx; drag.cy = cy; drag.az = camT.az; drag.el = camT.el; }
    camT.az = drag.az - (cx - drag.cx) * 0.006; camT.el = Math.max(-0.55, Math.min(1.25, drag.el + (cy - drag.cy) * 0.004));
    wake(); return;
  }
  if (drag.kind === 'inspectPinch') { const ids = Object.keys(pointers); if (ids.length < 2) return; const a = pointers[ids[0]], b = pointers[ids[1]]; heldZoom = Math.max(0.8, Math.min(3.2, drag.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, drag.d0))); wake(); return; }
  if (drag.kind === 'inspect') { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true; spinT.y = drag.sy + (e.clientX - drag.x) * 0.012; spinT.x = drag.sx + (e.clientY - drag.y) * 0.012; wake(); return; }
  if (drag.kind === 'part') { movePart(drag.d, e); wake(); return; }   // a part stays in your hand until you let go
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  // a press that turns into a drag becomes turning the box (after a small, physical-feeling threshold)
  if (!drag.orbiting && Math.hypot(dx, dy) > 8) { drag.orbiting = true; stage.classList.add('grabbing'); }
  if (drag.orbiting) {
    camT.az = drag.az - dx * 0.006;
    camT.el = Math.max(-0.55, Math.min(1.25, drag.el + dy * 0.004));   // low enough to see the underside and the feet
    wake();
  }
});
function endDrag(e) {
  delete pointers[e.pointerId];
  if (drag && drag.kind === 'inspect' && !drag.moved) tapHeld(e);
  if (drag && drag.kind === 'part') { endPart(drag.d); refreshTouchables(); }
  drag = null; stage.classList.remove('grabbing'); wake();
}
stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
// the turntable: drag it and the box turns, however much of the screen the box fills
const tt = stage.querySelector('#turntable');
let ttDrag = null;
tt.addEventListener('pointerdown', e => { if (!touchable) return; e.stopPropagation(); audio(); tt.setPointerCapture(e.pointerId); ttDrag = { x: e.clientX, y: e.clientY, az: camT.az, el: camT.el }; introT = 1; });
tt.addEventListener('pointermove', e => { if (!ttDrag) return; e.stopPropagation(); camT.az = ttDrag.az - (e.clientX - ttDrag.x) * 0.012; camT.el = Math.max(-0.55, Math.min(1.25, ttDrag.el + (e.clientY - ttDrag.y) * 0.008)); wake(); });
['pointerup', 'pointercancel'].forEach(t => tt.addEventListener(t, e => { e.stopPropagation(); ttDrag = null; }));
tt.addEventListener('keydown', e => { const k = { ArrowLeft: [0.25, 0], ArrowRight: [-0.25, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key]; if (k) { e.preventDefault(); camT.az += k[0]; camT.el = Math.max(-0.55, Math.min(1.25, camT.el + k[1])); wake(); } });
function zoomAt(clientX, clientY, factor) {
  const old = camT.dist, nd = Math.max(2.6, Math.min(9, old * factor));
  if (nd < old) {
    // find the point under the pointer: on the box if you're over it, otherwise at the box's depth
    const hit = hitAt({ clientX, clientY }); let pt;
    if (hit) pt = hit.point; else { const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), target); pt = ray.ray.intersectPlane(pl, new THREE.Vector3()); }
    if (pt) targetT.lerp(pt, 1 - nd / old);   // move towards it by the same share you zoomed in
  } else targetT.lerp(HOME, Math.min(1, (nd - old) / Math.max(0.001, 9 - old)));   // zooming out drifts back to the whole box
  camT.dist = nd; zoomed = camT.dist < 5.5; wake();
}
stage.addEventListener('wheel', e => { e.preventDefault(); if (!touchable) return; if (inspecting) { heldZoom = Math.max(0.8, Math.min(3.2, heldZoom * (1 - e.deltaY * 0.0012))); wake(); return; } zoomAt(e.clientX, e.clientY, 1 + e.deltaY * 0.001); }, { passive: false });

// ---------------- loop: only runs while something is moving ----------------
let running = false, last = 0;
function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } }
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let moving = false;
  if (introT < 1) { introT = Math.min(1, introT + dt / 2.8); const e = 1 - Math.pow(1 - introT, 3); camT.az = 0.05 + 0.5 * e; moving = true; }
  const k = 1 - Math.pow(0.0008, dt);
  cam.az += (camT.az - cam.az) * k; cam.el += (camT.el - cam.el) * k; cam.dist += (camT.dist - cam.dist) * k;
  target.lerp(targetT, k);
  if (Math.abs(camT.az - cam.az) + Math.abs(camT.el - cam.el) + Math.abs(camT.dist - cam.dist) + target.distanceTo(targetT) > 0.0005) moving = true;
  // the box's yield when pressed: a stiff little spring
  give.vel.addScaledVector(give.off, -900 * dt); give.vel.multiplyScalar(Math.exp(-28 * dt)); give.off.addScaledVector(give.vel, dt);
  box.position.set(give.off.x, 0.04 + give.off.y, give.off.z);   // a few tenths of a millimetre, felt more than seen
  if (give.off.lengthSq() + give.vel.lengthSq() > 1e-8) moving = true; else { give.off.set(0, 0, 0); give.vel.set(0, 0, 0); }
  // the lid: lifts a hair on its hinge and drops back
  const la = (lidState.target - lidState.angle) * 500 - lidState.vel * 30; lidState.vel += la * dt; lidState.angle += lidState.vel * dt;
  if (lidState.angle < 0) { if (lidState.vel < -0.08) SND.wood(0.6); lidState.angle = 0; lidState.vel = 0; }
  lid.rotation.x = -lidState.angle;
  if (lidState.unlocked && lidState.target > 1.9 && lidState.angle > 1.93 && !lidState.thunked) { lidState.thunked = true; SND.stopThunk(); }
  if (Math.abs(lidState.angle - (lidState.shadowAt || 0)) > 0.08 || Math.abs(P.drawer.value - (P.drawer.shadowAt || 0)) > 0.05) { lidState.shadowAt = lidState.angle; P.drawer.shadowAt = P.drawer.value; contactDirty = true; }
  if (coverSwing) { coverSwing.t += dt / 0.9; const u = Math.min(1, coverSwing.t), e = 1 - Math.pow(1 - u, 3); P.cover.angle = coverSwing.from + (1.9 - coverSwing.from) * e; P.cover.apply(P.cover.angle); if (u >= 1) { coverSwing = null; SND.pinClick(); } moving = true; }
  if (Math.abs(lidState.target - lidState.angle) + Math.abs(lidState.vel) > 1e-5) moving = true;
  placeCamera();
  if (lidState.angle > 0.5 && stepCradle(dt)) moving = true;
  if (inspecting) {
    spin.x += (spinT.x - spin.x) * Math.min(1, dt * 10); spin.y += (spinT.y - spin.y) * Math.min(1, dt * 10);
    heldPivot.rotation.set(spin.x, spin.y, 0);
    const sc = heldPivot.scale.x + (heldZoom - heldPivot.scale.x) * Math.min(1, dt * 9); heldPivot.scale.setScalar(sc);
    if (Math.abs(spinT.x - spin.x) + Math.abs(spinT.y - spin.y) + Math.abs(heldZoom - sc) > 0.001) moving = true;
  }
  rings.forEach(r => {
    const acc = (r.target - r.angle) * (dialsEngaged ? 260 : 160) - r.vel * (dialsEngaged ? 24 : 14);   // loose until earned
    r.vel += acc * dt; r.angle += r.vel * dt;
    if (Math.abs(r.target - r.angle) > 0.0005 || Math.abs(r.vel) > 0.001) moving = true; else { r.angle = r.target; r.vel = 0; }
    r.group.rotation.x = r.angle;
    const seat = P['ring' + rings.indexOf(r)].seated ? -0.004 : 0; r.group.position.z += (0.09 + seat - r.group.position.z) * Math.min(1, dt * 20);
    const det = Math.round(r.angle / (Math.PI / 5));
    if (det !== r.lastDetent) { SND.tick(dialsEngaged, !r.dragging); r.lastDetent = det; }
  });
  const below = camera.position.y < 0.03; contact.visible = floor.visible = !below;   // looking up from underneath: no table in the way
  if (contactDirty) renderContact();
  composer.render();
  if (moving || drag) requestAnimationFrame(tick); else running = false;
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); composer.setPixelRatio(DPR); composer.setSize(w, h); bloom.resolution.set(w, h);
  camera.aspect = w / h; camera.fov = w < 520 ? 38 : 30; camera.updateProjectionMatrix(); wake();
}
function litCount() {
  let n = 0;
  scene.traverse(object => {
    if (!object.isLight) return;
    let node = object;
    while (node) { if (node.visible === false) return; node = node.parent; }
    n += 1;
  });
  return n;
}
function sizeNow() {
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false); composer.setPixelRatio(DPR); composer.setSize(w, h); bloom.resolution.set(w, h);
  camera.aspect = w / h; camera.fov = w < 520 ? 38 : 30; camera.updateProjectionMatrix();
}
// Compile every material that shows up later, while the loading line is still covering the box.
const warmup = [toolInGroove, toolInHole, keyInDrawer, keyInLock, heldKey, heldTool, inspectG, cradle];
const warmupWas = warmup.map(object => object.visible);
warmup.forEach(object => { object.visible = true; });
sizeNow(); placeCamera();
if (contactDirty) renderContact();
await renderer.compileAsync(scene, camera);
composer.render();
warmup.forEach((object, index) => { object.visible = warmupWas[index]; });
inspectLight.intensity = 0;
composer.render();
await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const loading = stage.querySelector("#loading");
if (loading) {
  loading.classList.add("out");
  if (process.env.NEXT_PUBLIC_PUZZLE_TEST === "1") performance.mark("puzzle-fade");
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const retire = () => loading.remove();
  if (typeof requestIdleCallback === "function") requestIdleCallback(retire, { timeout: 4000 });
  else setTimeout(retire, 2000);
}
touchable = true;
const stageObserver = new ResizeObserver(resize); stageObserver.observe(stage);
wake();
if (process.env.NEXT_PUBLIC_PUZZLE_TEST === "1") {
  window.__puzzleReady = { t: performance.now(), setupMs: performance.now() - setupStarted, shaders: window.__shaderCompiles || 0, lights: litCount(), programs: renderer.info.programs.length };
  window.__test = { beginPart, movePart, endPart, wake, get holding() { return holding; }, set holding(v) { holding = v; }, checkDials, lidState, balls, stepCradle, lights: litCount, programs: () => renderer.info.programs.length };
  window.__box = { P, rings, value: () => rings.map(ringValue).join(''), state: () => ({ panel: P.panel.value, drawer: P.drawer.value, holding, toolUsed, footTurned, strip: P.strip.value, keyUsed, cover: P.cover.angle, keyTurned: P.keyTurn.done, dialsEngaged, unlocked: lidState.unlocked, lid: lidState.angle }) };
}
return function disposePuzzle() {
  running = false;
  removeEventListener('keydown', onKey);
  stageObserver.disconnect();
  renderer.dispose();
  composer.dispose();
  pmrem.dispose();
  if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  if (process.env.NEXT_PUBLIC_PUZZLE_TEST === "1" && !stage.querySelector("canvas")) {
    delete window.__test;
    delete window.__tags;
    delete window.__box;
  }
};

}
