import fs from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { swingPose, type SwingPose } from "./swing-pose";

const html = fs.readFileSync("reference/golf-procedural.html", "utf8");
const start = html.indexOf("var CLUB = 1.12");
const end = html.indexOf("// ---------- Skeleton drawing");
const source = `
  var T = THREE;
  var deg = Math.PI / 180;
  var BALL_HOME = new T.Vector3(0, 0.046, 0);
  ${html.slice(start, end)}
  pose;
`;
const prototypePose = vm.runInNewContext(source, { THREE, Math }) as (t: number) => Record<string, THREE.Vector3>;

const times = [0, 0.3, 0.5, 0.75, 0.9, 0.98, 1.1, 1.38];
const joints = Object.keys(swingPose(0)) as (keyof SwingPose)[];

describe("procedural swing", () => {
  it("matches the signed-off prototype within 1 mm", () => {
    for (const time of times) {
      const fromFile = prototypePose(time);
      const port = swingPose(time);
      for (const name of joints) {
        const there = fromFile[name];
        const here = port[name];
        const gap = Math.hypot(there.x - here.x, there.y - here.y, there.z - here.z);
        expect(gap, `${name} at ${time}s`).toBeLessThan(0.001);
      }
    }
  });
});
