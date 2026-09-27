import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("public/portrait/portrait.json", "utf8"));
const NECK = 80;
const cols = data.cols;
const ramp = ` ${data.ramp}`;
const topv = ramp.length - 1;
const grid = data.rows.map((row) =>
  row.split("").map((ch) => (ch === " " ? 0 : ramp.indexOf(ch))),
);
const nr = grid.length;
const frames = [grid.map((row) => row.slice())];
for (const delta of data.deltas) {
  const bin = Buffer.from(delta, "base64");
  for (let k = 0; k < bin.length; k += 3) {
    const p = bin[k] | (bin[k + 1] << 8);
    grid[Math.floor(p / cols)][p % cols] = bin[k + 2];
  }
  frames.push(grid.map((row) => row.slice()));
}
const sc = Math.floor(cols / 2);
const n = sc * nr;
let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const shape = new Float32Array(n * 6);
const jx = new Float32Array(n);
const jy = new Float32Array(n);
const depth = new Float32Array(n);
const rnd1 = new Float32Array(n);
const rnd2 = new Float32Array(n);
const vmax = new Float32Array(n);
for (let i = 0; i < n; i += 1) {
  const a = rnd() * 6.283;
  for (let k = 0; k < 3; k += 1) {
    const ang = a + k * 2.09 + (rnd() - 0.5) * 0.8;
    const rr = 0.6 + rnd() * 0.4;
    shape[i * 6 + k * 2] = Math.cos(ang) * rr;
    shape[i * 6 + k * 2 + 1] = Math.sin(ang) * rr;
  }
  jx[i] = (rnd() - 0.5) * 0.35;
  jy[i] = (rnd() - 0.5) * 0.35;
  const r = Math.floor(i / sc);
  const s = i % sc;
  const dxn = (s - sc * 0.5) / (sc * 0.5);
  const dyn = (r - nr * 0.46) / (nr * 0.5);
  depth[i] = Math.max(0, 1 - Math.sqrt(dxn * dxn * 1.4 + dyn * dyn)) + rnd() * 0.15;
  rnd1[i] = rnd();
  rnd2[i] = rnd();
  let m = 0;
  for (let f = 0; f < frames.length; f += 1) {
    const vv = (frames[f][r][s * 2] + frames[f][r][s * 2 + 1]) / (2 * topv);
    if (vv > m) {
      m = vv;
    }
  }
  vmax[i] = m;
}
const order = [];
for (let i = 0; i < n; i += 1) {
  if (vmax[i] > 0.04) {
    order.push(i);
  }
}
order.sort((a, b) => Math.floor(b / sc) - Math.floor(a / sc) || a - b);
const xs = [];
for (let r = 0; r < NECK - 5; r += 1) {
  for (let s = 0; s < sc; s += 1) {
    if ((frames[0][r][s * 2] + frames[0][r][s * 2 + 1]) / (2 * topv) > 0.04) {
      xs.push(s);
    }
  }
}
xs.sort((a, b) => a - b);
let headCol = sc / 2;
if (xs.length) {
  headCol = (xs[Math.floor(xs.length * 0.05)] + xs[Math.floor(xs.length * 0.95)]) / 2;
}
const flatFrames = frames.map((rows) => {
  const flat = new Uint8Array(nr * cols);
  for (let r = 0; r < nr; r += 1) {
    flat.set(rows[r], r * cols);
  }
  return flat;
});
const rampBytes = Buffer.from(ramp, "utf8");
const eyesBytes = Buffer.from(JSON.stringify(data.eyes), "utf8");
const idle = data.idle;
const header = 38;
const bodyStart = header + rampBytes.length + eyesBytes.length + idle.length * 2;
const aligned = (value) => (value + 3) & ~3;
const tables = aligned(bodyStart);
const orderAt = tables + (n + n * 6 + n * 5) * 4;
const framesAt = aligned(orderAt + order.length * 2);
const total = framesAt + flatFrames.length * nr * cols;
const out = Buffer.alloc(total);
out.write("AJPT", 0, "ascii");
out.writeUInt16LE(data.fps, 4);
out.writeUInt16LE(cols, 6);
out.writeUInt16LE(nr, 8);
out.writeUInt16LE(sc, 10);
out.writeUInt16LE(frames.length, 12);
out.writeUInt32LE(n, 14);
out.writeUInt32LE(order.length, 18);
out.writeUInt32LE(order.length, 22);
out.writeUInt16LE(rampBytes.length, 26);
out.writeUInt16LE(idle.length, 28);
out.writeUInt32LE(eyesBytes.length, 30);
out.writeFloatLE(headCol, 34);
rampBytes.copy(out, header);
eyesBytes.copy(out, header + rampBytes.length);
let cursor = header + rampBytes.length + eyesBytes.length;
for (const frame of idle) {
  out.writeUInt16LE(frame, cursor);
  cursor += 2;
}
const writeFloats = (arr, at) => {
  for (let i = 0; i < arr.length; i += 1) {
    out.writeFloatLE(arr[i], at + i * 4);
  }
};
writeFloats(vmax, tables);
writeFloats(shape, tables + n * 4);
writeFloats(jx, tables + (n + n * 6) * 4);
writeFloats(jy, tables + (n + n * 6 + n) * 4);
writeFloats(depth, tables + (n + n * 6 + n * 2) * 4);
writeFloats(rnd1, tables + (n + n * 6 + n * 3) * 4);
writeFloats(rnd2, tables + (n + n * 6 + n * 4) * 4);
for (let i = 0; i < order.length; i += 1) {
  out.writeUInt16LE(order[i], orderAt + i * 2);
}
for (let f = 0; f < flatFrames.length; f += 1) {
  out.set(flatFrames[f], framesAt + f * nr * cols);
}
fs.writeFileSync("public/portrait/portrait.bin", out);
console.log(
  `packed ${order.length} pieces, ${frames.length} frames, ${(out.length / 1024 / 1024).toFixed(2)} MB`,
);
