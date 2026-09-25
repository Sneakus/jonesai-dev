import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { AnimationMixer, Group, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { findBone, holdFrame } from "./range-play";
import { ballSpot } from "./range-play";
import { clubheadPosition, correctFrame, correctionWeights, currentFix, gripPoint, placeRig } from "./swing-fix";

(globalThis as { self?: typeof globalThis }).self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });

async function loadGolfer() {
  const bytes = fs.readFileSync("public/games/golf/golfer.glb");
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const rig = new Group();
  rig.add(gltf.scene);
  const mixer = new AnimationMixer(gltf.scene);
  const action = mixer.clipAction(gltf.animations[0]);
  if (!action) throw new Error("Golfer clip did not load");
  return { rig, model: gltf.scene, action };
}

function bend(root: Vector3, mid: Vector3, end: Vector3, toward: Vector3) {
  const thigh = mid.clone().sub(root);
  const shin = end.clone().sub(mid);
  const straight = thigh.dot(shin) / Math.max(1e-8, thigh.length() * shin.length());
  const offset = mid.clone().sub(root);
  const dir = end.clone().sub(root);
  if (dir.lengthSq() > 1e-8) {
    dir.normalize();
    offset.addScaledVector(dir, -offset.dot(dir));
  }
  const want = toward.clone().sub(root);
  want.addScaledVector(dir, -want.dot(dir));
  const forward = want.lengthSq() < 1e-8 ? offset.x : offset.dot(want.clone().normalize());
  return { straight, forward, offset };
}

describe("golfer placement", () => {
  it("prints the swing checks", async () => {
    const { rig, model, action } = await loadGolfer();
    placeRig(rig, model, action);
    const saved = currentFix();
    if (!saved) throw new Error("Swing fix missing");
    const duration = action.getClip()?.duration ?? 1;
    const step = 1 / 60;
    const left = new Vector3();
    const right = new Vector3();
    const hand = new Vector3();
    const other = new Vector3();
    const head = new Vector3();
    const grip = new Vector3();
    const prev = new Vector3();
    const targetLine = new Vector3(0, 0, -1);
    const dirs: Vector3[] = [];
    let leadFoot = 0;
    let trailFoot = 0;
    let handGap = 0;
    let addressGap = Infinity;
    let impactGap = Infinity;
    let topAngle = 180;
    let flick = 0;
    let boneDrift = 0;
    let backBend = 0;
    let locked = 0;
    let rigDrift = 0;
    const home = rig.position.clone();
    const chains: [string, string, string, boolean][] = [
        ["LeftUpLeg", "LeftLeg", "LeftFoot", true],
        ["RightUpLeg", "RightLeg", "RightFoot", true],
        ["LeftArm", "LeftForeArm", "LeftHand", false],
        ["RightArm", "RightForeArm", "RightHand", false],
      ];

    for (let time = 0; time <= duration + 1e-6; time += step) {
      const now = Math.min(time, duration);
      holdFrame(action, now);
      correctFrame(model, now);
      findBone(model, "LeftFoot")?.getWorldPosition(left);
      findBone(model, "RightFoot")?.getWorldPosition(right);
      findBone(model, "RightHand")?.getWorldPosition(hand);
      findBone(model, "LeftHand")?.getWorldPosition(other);
      leadFoot = Math.max(leadFoot, left.distanceTo(saved.leftFoot));
      if (now <= saved.impactTime) trailFoot = Math.max(trailFoot, right.distanceTo(saved.rightFoot));
      gripPoint(null, grip);
      handGap = Math.max(handGap, hand.distanceTo(grip), other.distanceTo(grip));
      clubheadPosition(null, head);
      const dir = head.clone().sub(grip).normalize();
      dirs.push(dir);
      rigDrift = Math.max(rigDrift, rig.position.distanceTo(home));
      const ballThere = new Vector3(ballSpot.x, ballSpot.y, ballSpot.z);
      const gap = head.distanceTo(ballThere);
      if (now === 0) addressGap = gap;
      if (Math.abs(now - saved.impactTime) < step * 0.51) impactGap = gap;
      if (Math.abs(now - saved.topTime) < step * 0.51) {
        topAngle = Math.acos(Math.min(1, Math.max(-1, dir.dot(targetLine)))) * (180 / Math.PI);
      }
      model.traverse((node) => {
        if (!node.parent) return;
        const rest = saved.rest.get(node.name) ?? 0;
        if (rest < 1e-4 || node.name.includes("Hips")) return;
        const length = node.position.length();
        boneDrift = Math.max(boneDrift, Math.abs(length - rest) / rest);
      });
      for (const [rootName, midName, endName, knee] of chains) {
        const root = findBone(model, rootName);
        const mid = findBone(model, midName);
        const end = findBone(model, endName);
        if (!root || !mid || !end) continue;
        const a = new Vector3();
        const b = new Vector3();
        const c = new Vector3();
        root.getWorldPosition(a);
        mid.getWorldPosition(b);
        end.getWorldPosition(c);
        const toward = knee ? a.clone().add(new Vector3(1, 0, 0)) : findBone(model, "Hips")!.getWorldPosition(new Vector3());
        const result = bend(a, b, c, toward);
        const weights = correctionWeights(now);
        const leadArm = !knee && midName.includes("Left");
        const ikOn = knee ? midName.includes("Left") || weights.trailLeg > 0.05 : weights.armMoved > 0.01;
        if (!leadArm && ikOn) locked = Math.max(locked, result.straight);
        if (result.forward < -0.01) backBend = Math.max(backBend, -result.forward);
      }
    }

    for (let i = 1; i < dirs.length - 1; i += 1) {
      prev.addVectors(dirs[i - 1], dirs[i + 1]).multiplyScalar(0.5);
      if (prev.lengthSq() < 1e-8) continue;
      prev.normalize();
      const angle = Math.acos(Math.min(1, Math.max(-1, dirs[i].dot(prev)))) * (180 / Math.PI);
      flick = Math.max(flick, angle);
    }

    console.log(`lead foot ${leadFoot.toFixed(4)}`);
    console.log(`trail foot ${trailFoot.toFixed(4)}`);
    console.log(`hands ${handGap.toFixed(4)}`);
    console.log(`address gap ${addressGap.toFixed(4)}`);
    console.log(`impact gap ${impactGap.toFixed(4)}`);
    console.log(`top angle ${topAngle.toFixed(1)}`);
    console.log(`flick ${flick.toFixed(2)}`);
    console.log(`bone drift ${boneDrift.toFixed(5)}`);
    console.log(`back bend ${backBend.toFixed(4)}`);
    console.log(`straight ${locked.toFixed(4)}`);
    console.log(`rig drift ${rigDrift.toFixed(4)}`);
    console.log(`ball moved ${saved.ballMoved.toFixed(4)}`);

    expect(saved.addressGap).toBeLessThan(0.01);
    expect(leadFoot).toBeLessThan(0.01);
    expect(trailFoot).toBeLessThan(0.01);
    expect(handGap).toBeLessThan(0.02);
    expect(addressGap).toBeLessThan(0.01);
    expect(impactGap).toBeLessThan(0.03);
    expect(topAngle).toBeLessThan(30);
    expect(flick).toBeLessThan(10);
    expect(boneDrift).toBeLessThan(0.005);
    expect(backBend).toBe(0);
    expect(locked).toBeLessThan(0.999);
    expect(rigDrift).toBeLessThan(0.0001);
  });
});
