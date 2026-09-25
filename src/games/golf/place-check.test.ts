import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { AnimationMixer, Group, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { rangeSettings as range } from "./settings";
import { holdFrame } from "./range-play";
import { clubheadPosition, correctFrame, currentFix, gripDistance, placeRig } from "./swing-fix";

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
  const club = new Group();
  return { rig, model: gltf.scene, action, club };
}

function measure(rig: Group, model: Group, action: NonNullable<ReturnType<AnimationMixer["clipAction"]>>, club: Group) {
  const ball = new Vector3(range.ball[0], range.ball[1], range.ball[2]);
  const fix = placeRig(rig, model, action, club);
  const saved = currentFix();
  if (!saved) throw new Error("Swing fix missing");
  holdFrame(action, 0);
  correctFrame(model, club, 0);
  const leftHome = saved.leftFoot.clone();
  const rightHome = saved.rightFoot.clone();
  const home = rig.position.clone();
  const foot = new Vector3();
  const hand = new Vector3();
  const head = new Vector3();
  let footDrift = 0;
  let handGap = 0;
  let rigDrift = 0;
  let addressGap = Infinity;
  for (const time of saved.times) {
    holdFrame(action, time);
    correctFrame(model, club, time);
    saved.leftFoot && foot.copy(saved.leftFoot);
    const leftBone = model.getObjectByName("mixamorig12LeftFoot");
    const rightBone = model.getObjectByName("mixamorig12RightFoot");
    const rightHand = model.getObjectByName("mixamorig12RightHand");
    leftBone?.getWorldPosition(foot);
    footDrift = Math.max(footDrift, foot.distanceTo(leftHome));
    rightBone?.getWorldPosition(foot);
    footDrift = Math.max(footDrift, foot.distanceTo(rightHome));
    rightHand?.getWorldPosition(hand);
    handGap = Math.max(handGap, gripDistance(club, hand));
    rigDrift = Math.max(rigDrift, rig.position.distanceTo(home));
    if (time === saved.times[0]) {
      clubheadPosition(club, head);
      addressGap = head.distanceTo(ball);
    }
  }
  holdFrame(action, saved.impactTime);
  correctFrame(model, club, saved.impactTime);
  clubheadPosition(club, head);
  return { footDrift, handGap, rigDrift, impactGap: head.distanceTo(ball), addressGap, fix };
}

describe("golfer placement", () => {
  it("prints the swing checks", async () => {
    const { rig, model, action, club } = await loadGolfer();
    const angles = [-0.3, 0, 0.3];
    const lengths = [1.14, 1.15, 1.16];
    let best = Infinity;
    let winner = { euler: [0, 0, 0] as [number, number, number], length: 1.15, score: Infinity };
    for (const length of lengths) {
      for (const x of angles) {
        for (const y of angles) {
          for (const z of angles) {
            range.clubLength = length;
            range.gripEuler = [x, y, z];
            const score = measure(rig, model as Group, action, club);
            const total = score.addressGap + score.impactGap * 4 + score.handGap;
            if (total < best) {
              best = total;
              winner = { euler: [x, y, z], length, score: total };
            }
          }
        }
      }
    }
    range.clubLength = winner.length;
    range.gripEuler = winner.euler;
    const final = measure(rig, model as Group, action, club);
    const lines = [
      `grip ${winner.euler.map((n) => n.toFixed(3)).join(" ")} length ${winner.length.toFixed(3)}`,
      `feet drift ${final.footDrift.toFixed(3)}`,
      `trail hand ${final.handGap.toFixed(3)}`,
      `impact gap ${final.impactGap.toFixed(3)}`,
      `address gap ${final.addressGap.toFixed(3)}`,
      `rig drift ${final.rigDrift.toFixed(3)}`,
      `rig ${final.fix ? "" : ""}`,
    ];
    const placed = rig.position;
    lines[6] = `rig ${placed.x.toFixed(3)} ${placed.y.toFixed(3)} ${placed.z.toFixed(3)}`;
    console.log(lines.join("\n"));
    expect(final.footDrift).toBeLessThan(0.01);
    expect(final.handGap).toBeLessThan(0.02);
    expect(final.impactGap).toBeLessThan(0.03);
    expect(final.rigDrift).toBeLessThan(0.0001);
  });
});
