import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { AnimationMixer, Group, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { rangeSettings as range } from "./settings";
import { clubheadPosition, findBone, placeRig, soleHeight, stature } from "./range-play";

(globalThis as { self?: typeof globalThis }).self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });

async function loadGolfer() {
  const bytes = fs.readFileSync("public/games/golf/golfer.glb");
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const rig = new Group();
  rig.add(gltf.scene);
  const mixer = new AnimationMixer(gltf.scene);
  const clip = gltf.animations[0];
  const action = mixer.clipAction(clip);
  if (!action) throw new Error("Golfer clip did not load");
  return { rig, model: gltf.scene, action, mixer, clip };
}

function pose(mixer: AnimationMixer, action: NonNullable<ReturnType<AnimationMixer["clipAction"]>>, time: number) {
  action.play();
  action.paused = true;
  mixer.setTime(time);
}

describe("golfer placement", () => {
  it("prints the fixed layout", async () => {
    const { rig, model, action, mixer } = await loadGolfer();
    const placed = placeRig(rig, model, action);
    const ball = new Vector3(range.ball[0], range.ball[1], range.ball[2]);
    const hips = findBone(model, "Hips");
    const leftHand = findBone(model, "LeftHand");
    const rightHand = findBone(model, "RightHand");
    pose(mixer, action, 0);
    model.updateMatrixWorld(true);
    const feet = soleHeight(model);
    const height = stature(model);

    pose(mixer, action, range.impactTime);
    model.updateMatrixWorld(true);
    const club = new Vector3();
    if (leftHand && rightHand) clubheadPosition(leftHand, rightHand, club);
    const gap = club.distanceTo(ball);

    let highest = 0;
    let highY = -Infinity;
    const hand = new Vector3();
    for (let step = 0; step <= 80; step += 1) {
      const time = (range.impactTime * step) / 80;
      pose(mixer, action, time);
      model.updateMatrixWorld(true);
      leftHand?.getWorldPosition(hand);
      if (hand.y > highY) {
        highY = hand.y;
        highest = time;
      }
    }

    const hip = new Vector3();
    let hipTravel = 0;
    let hipStart: Vector3 | null = null;
    const moments = [0, highest, range.impactTime, action.getClip()?.duration ?? 0];
    const spots: string[] = [];
    for (const time of moments) {
      pose(mixer, action, time);
      model.updateMatrixWorld(true);
      spots.push(`${rig.position.x.toFixed(3)} ${rig.position.y.toFixed(3)} ${rig.position.z.toFixed(3)}`);
    }
    const steps = 40;
    const duration = action.getClip()?.duration ?? 0;
    for (let step = 0; step <= steps; step += 1) {
      pose(mixer, action, (duration * step) / steps);
      model.updateMatrixWorld(true);
      hips?.getWorldPosition(hip);
      if (!hipStart) hipStart = hip.clone();
      hipTravel = Math.max(hipTravel, Math.hypot(hip.x - hipStart.x, hip.z - hipStart.z));
    }

    const lines = [
      `height ${height.toFixed(3)}`,
      `feet ${feet.toFixed(3)}`,
      `clubhead ${club.x.toFixed(3)} ${club.y.toFixed(3)} ${club.z.toFixed(3)}`,
      `clubhead gap ${gap.toFixed(3)}`,
      `address ${spots[0]}`,
      `backswing ${spots[1]}`,
      `impact ${spots[2]}`,
      `finish ${spots[3]}`,
      `hips sideways ${hipTravel.toFixed(3)}`,
      `hip track ${placed.hipTravel.toFixed(3)}`,
    ];
    console.log(lines.join("\n"));

    expect(height).toBeGreaterThan(1.7);
    expect(height).toBeLessThan(1.9);
    expect(Math.abs(feet)).toBeLessThan(0.02);
    expect(gap).toBeLessThan(0.03);
    expect(spots[0]).toBe(spots[1]);
    expect(spots[0]).toBe(spots[2]);
    expect(spots[0]).toBe(spots[3]);
  });
});
